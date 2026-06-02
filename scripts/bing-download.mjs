#!/usr/bin/env node
/**
 * PowerNowAuto - Bing 图片搜索下载
 *
 * 通过 Bing Images API 搜索真实车型照片（无水印）
 * 搜索关键词："{车型名} {年份} car official photo"
 * 自动下载 -> sharp resize -> webp 编码
 *
 * 用法：
 *   node scripts/bing-download.mjs              # 全部
 *   node scripts/bing-download.mjs --limit 20   # 前20
 *   node scripts/bing-download.mjs --only-json  # 仅更新JSON
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');

const ARGS = process.argv.slice(2);
const LIMIT = parseInt(ARGS[ARGS.indexOf('--limit') + 1]) || Infinity;
const ONLY_JSON = ARGS.includes('--only-json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const DELAY = 2000;
const IMGS_PER = 4;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Bing 图片搜索 - 返回图片URL数组
 */
async function bingImageSearch(query, count = 10) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1&cw=1903&ch=1093`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    });
    clearTimeout(t);
    if (!resp.ok) return [];
    const html = await resp.text();

    // Bing HTML 中 murl 可能以多种编码存在
    // murl&quot;:&quot;URL&quot;  或  murl":"URL"
    const re = /murl.{0,30}(https?:\/\/[^&"'\s]+\.(?:jpg|jpeg|png|webp)[^&"'\s]*)/gi;
    const urls = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[1].replace(/\\u002f/g, '/');
      if (!u.includes('bing.com') && !u.includes('mm.bing.net') &&
          !u.includes('logo') && !u.includes('icon') && !urls.includes(u)) {
        urls.push(u);
      }
      if (urls.length >= count) break;
    }
    return urls;
  } catch { return []; }
}

/**
 * 下载并转为 webp
 */
async function downloadAndConvert(imgUrl, destPath) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const resp = await fetch(imgUrl, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Referer': 'https://www.bing.com/' },
    });
    clearTimeout(t);
    if (!resp.ok) return false;

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 2000) return false;

    try {
      const sharp = (await import('sharp')).default;
      await sharp(buf)
        .resize(800, 600, { fit: 'inside', background: { r: 248, g: 250, b: 252, alpha: 1 } })
        .webp({ quality: 80 })
        .toFile(destPath);
    } catch {
      fs.writeFileSync(destPath.replace('.webp', '.jpg'), buf);
    }
    return true;
  } catch { return false; }
}

/**
 * 构建搜索关键词
 */
function buildSearchQuery(vehicle) {
  const zh = (vehicle.names.zh || '').trim();
  const en = (vehicle.names.en || '').trim();
  const year = vehicle.year || 2025;
  const brand = vehicle.brand.replace(/_/g, ' ');

  // 构建搜索关键词（优先英文 + 品牌上下文）
  const isEnglish = /^[A-Za-z0-9\s\-+\.]+$/.test(zh) && !/[一-鿿]/.test(zh);

  // 品牌名翻译映射
  const brandEnMap = {
    xpeng: 'Xpeng', xiaomi: 'Xiaomi', zeekr: 'Zeekr', zhiji: 'IM Motors',
    polestar: 'Polestar', volvo: 'Volvo', porsche: 'Porsche', renault: 'Renault',
    toyota_ev: 'Toyota', peugeot: 'Peugeot', vw_id: 'Volkswagen',
    nissan_ev: 'Nissan', subaru: 'Subaru', qichen: 'Venucia',
    saic_maxus: 'Maxus', voyah: 'Voyah', yangwang: 'Yangwang',
    geely_galaxy: 'Geely Galaxy', hechuang: 'Hiphi', ora: 'Ora', wey: 'Wey',
    hozon: 'Neta', deepal: 'Deepal', denza: 'Denza',
    formula_leopard: 'Fangchengbao', feifan: 'Rising Auto',
    chery_fengyun: 'Chery Fengyun', jetour: 'Jetour', jihu: 'Arcfox',
    li_auto: 'Li Auto', nio: 'Nio', aion: 'Aion', aito: 'Aito',
    avatr: 'Avatr', benz_eq: 'Mercedes', bmw_i: 'BMW', byd: 'BYD',
    cadillac: 'Cadillac', citroen: 'Citroen', ford_ev: 'Ford',
    honda_ev: 'Honda', hyundai: 'Hyundai', infiniti_ev: 'Infiniti',
    kia: 'Kia', leapmotor: 'Leapmotor', lotus: 'Lotus', lynkco: 'Lynk&Co',
    mazda: 'Mazda', mitsubishi: 'Mitsubishi',
  };
  const brandEn = brandEnMap[vehicle.brand] || brand;

  if (isEnglish) {
    return `${brandEn} ${zh} ${year} exterior official`;
  } else {
    return `${brandEn} ${zh} ${year} 外观`;
  }
}

/**
 * 更新JSON引用
 */
function updateAllJson() {
  console.log('\n📝 更新JSON引用...\n');
  let updated = 0, partial = 0, svgOnly = 0;

  for (const file of fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'))) {
    const fp = path.join(VEHICLES_DIR, file);
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const brandDir = path.join(IMAGES_DIR, data.brand);
    const newImgs = [];
    let changed = false;

    for (let i = 1; i <= 4; i++) {
      const num = String(i).padStart(2, '0');
      let found = false;
      for (const ext of ['.webp', '.jpg', '.jpeg', '.png']) {
        const p = path.join(brandDir, data.slug + '-' + num + ext);
        if (fs.existsSync(p)) {
          newImgs.push(`/images/vehicles/${data.brand}/${data.slug}-${num}${ext}`);
          found = true;
          break;
        }
      }
      if (!found) {
        newImgs.push(data.images[i - 1] || null);
      } else {
        changed = true;
      }
    }

    newImgs.forEach((img, i) => {
      if (!img) newImgs[i] = `/images/vehicles/${data.brand}/${data.slug}-${String(i + 1).padStart(2, '0')}.svg`;
    });

    if (changed) {
      data.images = newImgs;
      fs.writeFileSync(fp, JSON.stringify(data) + '\n');
      const real = newImgs.filter(i => !i.endsWith('.svg')).length;
      if (real === 4) updated++;
      else partial++;
    } else {
      svgOnly++;
    }
  }

  console.log(`  ✅ 完整(4张): ${updated} | ⚠ 部分: ${partial} | ❌ 仅SVG: ${svgOnly}`);
}

// ============ 主逻辑 ============
async function main() {
  if (ONLY_JSON) { updateAllJson(); return; }

  console.log('🔍 PowerNowAuto - Bing图片搜索下载\n');

  // 加载车型
  let vehicles = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(VEHICLES_DIR, f), 'utf-8')) }));
  if (LIMIT < Infinity) vehicles = vehicles.slice(0, LIMIT);

  // 过滤已有完整图片的
  const toDownload = [];
  for (const v of vehicles) {
    let hasAll = 0;
    for (let i = 1; i <= 4; i++) {
      const num = String(i).padStart(2, '0');
      for (const ext of ['.webp', '.jpg', '.jpeg', '.png'])
        if (fs.existsSync(path.join(IMAGES_DIR, v.data.brand, v.data.slug + '-' + num + ext))) { hasAll++; break; }
    }
    if (hasAll < 4) toDownload.push(v);
  }

  console.log(`📦 总车型: ${vehicles.length} | 需下载: ${toDownload.length}\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < toDownload.length; i++) {
    const { file, data: v } = toDownload[i];
    const brandDir = path.join(IMAGES_DIR, v.brand);
    if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });

    const query = buildSearchQuery(v);
    process.stdout.write(`[${i + 1}/${toDownload.length}] ${v.names.zh}... `);

    // 搜索 Bing
    const urls = await bingImageSearch(query, 8);
    if (urls.length === 0) {
      console.log('❌ 0结果');
      fail++;
      await sleep(DELAY);
      continue;
    }
    process.stdout.write(`${urls.length}条→`);

    // 下载
    let dl = 0;
    for (let j = 0; j < urls.length && dl < IMGS_PER; j++) {
      const num = String(dl + 1).padStart(2, '0');
      const dest = path.join(brandDir, `${v.slug}-${num}.webp`);
      if (fs.existsSync(dest)) { dl++; continue; }
      if (await downloadAndConvert(urls[j], dest)) dl++;
      await sleep(500);
    }

    if (dl > 0) {
      console.log(`✅ ${dl}张`);
      ok++;
    } else {
      console.log('❌ 下载失败');
      fail++;
    }

    await sleep(DELAY);
  }

  console.log(`\n📊 完成: ${ok} | 失败: ${fail}`);

  // 更新JSON
  updateAllJson();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
