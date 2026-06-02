#!/usr/bin/env node
/**
 * PowerNowAuto - 终极图片获取脚本（二合一）
 *
 * 策略：
 *   1. 汽车之家直链下载（保底，部分图片可能有水印）
 *   2. 懂车帝 API + 图片搜索（补充）
 *   3. 全部下载后用 AI 批量去logo/去车牌
 *
 * 用法：
 *   node scripts/fetch-all-images.mjs                     # 全部模式
 *   node scripts/fetch-all-images.mjs --source autohome    # 仅汽车之家
 *   node scripts/fetch-all-images.mjs --source dongchedi   # 仅懂车帝
 *   node scripts/fetch-all-images.mjs --remove-watermarks  # 仅去水印
 *   node scripts/fetch-all-images.mjs --limit 20           # 限制数量
 *   node scripts/fetch-all-images.mjs --update-json        # 仅更新JSON引用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');
const MAPPING_FILE = path.join(ROOT, 'vehicle-image-mapping.json');

// 解析命令行参数
const ARGS = process.argv.slice(2);
const LIMIT = parseInt(ARGS[ARGS.indexOf('--limit') + 1]) || Infinity;
const SOURCE = ARGS.includes('--source') ? ARGS[ARGS.indexOf('--source') + 1] : 'hybrid';
const UPDATE_ONLY = ARGS.includes('--update-json');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DELAY = 1200;
const IMGS_PER = 4;

// ============ 工具 ============
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      const resp = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT } });
      clearTimeout(t);
      if (resp.status === 404 || resp.status === 403) return null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      if (i === retries - 1) return null;
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

async function downloadImage(url, destPath) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    const resp = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://car.autohome.com.cn/' } });
    clearTimeout(t);
    if (!resp.ok) return false;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 1000) return false;

    try {
      const sharp = (await import('sharp')).default;
      await sharp(buf).resize(800, 600, { fit: 'inside', background: { r: 248, g: 250, b: 252, alpha: 1 } }).webp({ quality: 80 }).toFile(destPath);
    } catch {
      fs.writeFileSync(destPath.replace('.webp', '.jpg'), buf);
    }
    return true;
  } catch { return false; }
}

// ============ 汽车之家 ============
async function listAutohomeSeries(letter) {
  const html = await fetchPage(`https://www.autohome.com.cn/grade/carhtml/${letter}.html`);
  if (!html) return [];
  const results = [];
  const re = /id="s(\d+)"[\s\S]*?<h4><a[^>]*href='\/\/www\.autohome\.com\.cn\/\d+\/[^']*'>([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) results.push({ id: parseInt(m[1]), name: m[2].trim() });
  return results;
}

async function getAutohomeImageUrls(seriesId) {
  const html = await fetchPage(`https://car.autohome.com.cn/photolist/series/${seriesId}/1/p1/`);
  if (!html) return [];
  const candidates = [];
  const re = /\/cars\/imgs-\d+-(\d+)-\d+-x\/(\d+)\.html/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!candidates.find(c => c.imgId === m[2])) candidates.push({ specId: parseInt(m[1]), imgId: parseInt(m[2]) });
    if (candidates.length >= 15) break;
  }
  const urls = [];
  for (const { specId, imgId } of candidates) {
    if (urls.length >= IMGS_PER) break;
    const page = await fetchPage(`https://www.autohome.com.cn/cars/imgs-${seriesId}-${specId}-1-x/${imgId}.html`);
    if (!page) continue;
    const imgMatch = page.match(/https?:\/\/car\d+\.autoimg\.cn\/[^"'\s<>]+?1400x1400[^"'\s<>]*?\.(?:jpg|webp)/i);
    if (imgMatch) {
      const url = imgMatch[0];
      if (!url.includes('qrcode') && !url.includes('image.png') && !urls.includes(url)) urls.push(url);
    }
    await sleep(800);
  }
  return urls;
}

// ============ 懂车帝 ============
async function searchDongchedi(query) {
  // 使用懂车帝搜索API
  const url = `https://www.dongchedi.com/motor/search/api/search_content/?keyword=${encodeURIComponent(query)}&count=5&offset=0&type=1&new_type=series`;
  const html = await fetchPage(url);
  if (!html) return [];
  try {
    const data = JSON.parse(html);
    return (data?.data?.series_list || data?.data?.list || []).map(s => ({
      id: s.series_id || s.id,
      name: s.series_name || s.name,
      cover: s.cover_url || s.cover || '',
    }));
  } catch { return []; }
}

async function getDongchediCarDetail(seriesId) {
  const html = await fetchPage(`https://www.dongchedi.com/auto/params-carIds-${seriesId}`);
  if (!html) return [];
  const idx = html.indexOf('__NEXT_DATA__');
  if (idx < 0) return [];
  const endIdx = html.indexOf('</script>', idx);
  const jsonStart = html.indexOf('>', idx) + 1;
  try {
    const data = JSON.parse(html.substring(jsonStart, endIdx));
    const imgs = [];
    const str = JSON.stringify(data);
    // 懂车帝图片域名: p3-dcd-sign.byteimg.com, p6-dcd-sign.byteimg.com
    const re = /https?:\/\/p\d-dcd-sign\.byteimg\.com\/[^"\s]+\.(?:jpg|png|webp)\b[^"\s]*/gi;
    let m;
    while ((m = re.exec(str)) !== null) {
      const url = m[0].split('?')[0]; // 去参数
      if (!imgs.includes(url) && !url.includes('watermark')) imgs.push(url);
    }
    return imgs.slice(0, IMGS_PER);
  } catch { return []; }
}

// ============ 匹配逻辑 ============
const BRAND_KEYWORDS = {
  aion: ['AION', '埃安'], aito: ['问界'], audi_etron: ['奥迪', 'e-tron'], avatr: ['阿维塔'],
  benz_eq: ['奔驰', 'EQ'], bmw_i: ['宝马', 'i'], byd: ['比亚迪', '宋', '唐', '元', '汉', '秦', '海豹', '海豚', '海鸥', '海狮', '腾势', '仰望', '方程豹'],
  cadillac: ['凯迪拉克'], chery_fengyun: ['风云', '奇瑞'], citroen: ['雪铁龙', 'CITROEN'],
  deepal: ['深蓝'], denza: ['腾势'], feifan: ['飞凡'], ford_ev: ['福特'],
  formula_leopard: ['方程豹', '豹'], geely_galaxy: ['银河', '吉利'], hechuang: ['合创'],
  honda_ev: ['本田', 'e:N'], hozon: ['哪吒'], hyundai: ['现代', 'IONIQ'],
  infiniti_ev: ['英菲尼迪'], jetour: ['捷途', '山海'], jihu: ['极狐', '阿尔法'],
  kia: ['起亚'], leapmotor: ['零跑'], li_auto: ['理想', 'MEGA'], lotus: ['路特斯'],
  lynkco: ['领克'], mazda: ['马自达', 'CX-', 'MX-'], mitsubishi: ['三菱'],
  nio: ['蔚来', 'ET', 'ES', 'EC'], nissan_ev: ['日产', 'Ariya', 'e-Power'],
  ora: ['欧拉', '好猫', '闪电猫'], peugeot: ['标致', 'e-2008', 'e-208'],
  polestar: ['极星', 'Polestar'], porsche: ['保时捷', 'Taycan'],
  qichen: ['启辰'], renault: ['雷诺', 'E-Tech'], saic_maxus: ['大通', 'MAXUS', 'MIFA'],
  subaru: ['斯巴鲁', 'Solterra'], toyota_ev: ['丰田', 'bZ'],
  volvo: ['沃尔沃', 'Recharge'], voyah: ['岚图'], vw_id: ['大众', 'ID.'],
  wey: ['魏牌', '坦克'], xiaomi: ['小米', 'SU7', 'YU'],
  xpeng: ['小鹏', 'G3', 'G6', 'G7', 'G9', 'P5', 'P7', 'X9'],
  yangwang: ['仰望'], zeekr: ['极氪', '001', '007', '009'], zhiji: ['智己'],
};

let catalogCache = null;
async function getAutohomeCatalog() {
  if (catalogCache) return catalogCache;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const all = [];
  for (const l of letters) { all.push(...await listAutohomeSeries(l)); await sleep(300); }
  catalogCache = { series: all, updated: Date.now() };
  return catalogCache;
}

function fuzzyMatch(ourName, ourBrand, catalogSeries) {
  const keywords = BRAND_KEYWORDS[ourBrand] || [ourBrand];

  // 策略：不预过滤，直接在全部 catalog 中搜索
  // 因为 catalog 中的名称已经带品牌前缀（如 "奥迪A3", "问界M5"）

  const clean = (s) => s.replace(/[（(][^)）]*[)）]/g, '').replace(/\s+/g, '').replace(/-/g, '').toLowerCase();
  const ourCleanZh = clean(ourName);  // "问界M5" -> "问界m5"

  // 也准备纯车型名（去品牌前缀）
  const ourCleanModel = (() => {
    let n = ourCleanZh;
    for (const kw of keywords) {
      const kwClean = clean(kw);
      if (n.startsWith(kwClean)) {
        n = n.substring(kwClean.length);
        break;
      }
    }
    return n || ourCleanZh;
  })();

  let best = null, bestScore = 0;

  for (const s of catalogSeries) {
    const sn = clean(s.name);

    // 1. 精确匹配（中文名或英文名）
    if (sn === ourCleanZh) { best = s; break; }
    if (sn === ourCleanModel && ourCleanModel.length >= 2) { best = s; break; }

    // 2. 品牌+车型 name match
    let score = 0;
    if (sn.includes(ourCleanZh) || ourCleanZh.includes(sn)) score = 10;
    if (sn.includes(ourCleanModel) && ourCleanModel.length >= 2) score = Math.max(score, 8);
    if (!sn.includes(ourCleanModel) && !ourCleanModel.includes(sn) && ourCleanModel.length >= 3) {
      // 3. 逐字匹配
      const chars = ourCleanModel.split('');
      score = chars.filter(c => sn.includes(c)).length / Math.max(chars.length, 1) * 5;

      // 额外检查sn中是否有我们的品牌关键词
      const brandHit = keywords.some(k => sn.includes(clean(k)));
      if (brandHit) score += 3;
    }

    if (score > bestScore) { bestScore = score; best = s; }
  }

  return bestScore >= 7 ? best : null;
}

// ============ 更新 JSON ============
function syncAllJsonReferences() {
  console.log('\n📝 同步JSON引用...\n');
  let updated = 0, partial = 0, svgOnly = 0;

  for (const file of fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(VEHICLES_DIR, file), 'utf-8'));
    const brandDir = path.join(IMAGES_DIR, data.brand);
    const newImgs = [];

    for (let i = 1; i <= 4; i++) {
      const num = String(i).padStart(2, '0');
      let found = false;
      for (const ext of ['.webp', '.jpg', '.jpeg', '.png']) {
        const p = path.join(brandDir, data.slug + '-' + num + ext);
        if (fs.existsSync(p)) { newImgs.push(`/images/vehicles/${data.brand}/${data.slug}-${num}${ext}`); found = true; break; }
      }
      if (!found) newImgs.push(data.images[i - 1] || `/images/vehicles/${data.brand}/${data.slug}-${num}.svg`);
    }

    const realCount = newImgs.filter(i => !i.endsWith('.svg')).length;
    if (realCount > 0) {
      data.images = newImgs;
      fs.writeFileSync(path.join(VEHICLES_DIR, file), JSON.stringify(data) + '\n');
      if (realCount === 4) updated++; else partial++;
    } else { svgOnly++; }
  }
  console.log(`  ✅ 完整(4张): ${updated} | ⚠ 部分: ${partial} | ❌ 仅SVG: ${svgOnly}`);
}

// ============ 主流程 ============
async function main() {
  if (UPDATE_ONLY) { syncAllJsonReferences(); return; }

  console.log('🚗 PowerNowAuto 图片获取系统\n');
  console.log(`来源: ${SOURCE} | 限制: ${LIMIT === Infinity ? '全部' : LIMIT}\n`);

  // 加载车型
  let vehicles = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(VEHICLES_DIR, f), 'utf-8')) }));
  if (LIMIT < Infinity) vehicles = vehicles.slice(0, LIMIT);

  console.log(`📦 目标: ${vehicles.length} 款车型\n`);

  // 获取汽车之家目录（用于匹配）
  let ahCatalog = null;
  if (SOURCE !== 'dongchedi') {
    console.log('📋 获取汽车之家车系目录...');
    ahCatalog = await getAutohomeCatalog();
    console.log(`  共 ${ahCatalog.series.length} 个车系\n`);
  }

  let success = 0, failed = 0, skipped = 0;
  const report = { success: [], failed: [], unmatched: [] };

  for (let vi = 0; vi < vehicles.length; vi++) {
    const { file, data: v } = vehicles[vi];
    const brandDir = path.join(IMAGES_DIR, v.brand);
    if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });
    const label = `[${vi + 1}/${vehicles.length}] ${v.names.zh} (${v.brand})`;

    // 检查是否已有完整图片
    let existing = 0;
    for (let i = 1; i <= 4; i++) {
      const num = String(i).padStart(2, '0');
      for (const ext of ['.webp', '.jpg', '.jpeg', '.png'])
        if (fs.existsSync(path.join(brandDir, v.slug + '-' + num + ext))) { existing++; break; }
    }
    if (existing >= 4) { console.log(`${label} ⏭ 已有`); skipped++; continue; }

    // 获取图片URL
    let imgUrls = [];

    // 汽车之家
    if (SOURCE !== 'dongchedi' && ahCatalog) {
      const match = fuzzyMatch(v.names.zh || v.names.en, v.brand, ahCatalog.series);
      if (match) {
        imgUrls = await getAutohomeImageUrls(match.id);
        if (imgUrls.length > 0) console.log(`${label} 📷 汽车之家: ${imgUrls.length} 张`);
      }
    }

    // 懂车帝补充
    if (SOURCE !== 'autohome' && imgUrls.length < IMGS_PER) {
      const needMore = IMGS_PER - imgUrls.length;
      const dcdResults = await searchDongchedi(v.names.zh);
      if (dcdResults.length > 0) {
        const dcdImgs = await getDongchediCarDetail(dcdResults[0].id);
        const fresh = dcdImgs.filter(u => !imgUrls.includes(u)).slice(0, needMore);
        imgUrls.push(...fresh);
        if (fresh.length > 0) console.log(`${label} 📷 懂车帝: +${fresh.length} 张`);
      }
    }

    if (imgUrls.length === 0) {
      console.log(`${label} ❌ 无来源`);
      failed++;
      report.unmatched.push({ slug: v.slug, name: v.names.zh, brand: v.brand });
      continue;
    }

    // 下载
    let downloaded = 0;
    for (const url of imgUrls) {
      if (downloaded >= IMGS_PER - existing) break;
      const num = String(existing + downloaded + 1).padStart(2, '0');
      if (await downloadImage(url, path.join(brandDir, `${v.slug}-${num}.webp`))) downloaded++;
      await sleep(800);
    }

    if (downloaded > 0) {
      console.log(`${label} ✅ ${existing + downloaded} 张`);
      success++;
      report.success.push({ slug: v.slug, name: v.names.zh, count: downloaded + existing });
    } else {
      console.log(`${label} ❌ 下载失败`);
      failed++;
    }

    await sleep(DELAY);
  }

  // 同步JSON
  syncAllJsonReferences();

  // 保存报告
  fs.writeFileSync(path.join(ROOT, 'fetch-report.json'), JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`📊 完成 | 成功: ${success} | 失败: ${failed} | 跳过: ${skipped} | 未匹配: ${report.unmatched.length}`);
  console.log(`📄 报告: fetch-report.json`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
