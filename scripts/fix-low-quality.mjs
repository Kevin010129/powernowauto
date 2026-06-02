#!/usr/bin/env node
/**
 * PowerNowAuto - 修复低质量/Bing搜索结果中的错误图片
 *
 * 策略:
 *   1. 识别 <14KB 的webp图片（可能是二维码/图标/低质量图）
 *   2. 对每个需要修复的车型，用 Bing 重新搜索，跳过已有好图的编号位
 *   3. 下载高清图替换低质量图
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const FIX_LIST = path.join(ROOT, 'fixlist.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const MIN_KB = 14;
const DELAY = 2000;

// 品牌英文名映射
const BRAND_EN = {
  aion: 'Aion', aito: 'Aito', audi_etron: 'Audi', avatr: 'Avatr', benz_eq: 'Mercedes',
  bmw_i: 'BMW', byd: 'BYD', cadillac: 'Cadillac', chery_fengyun: 'Chery',
  citroen: 'Citroen', deepal: 'Deepal', denza: 'Denza', feifan: 'Rising Auto',
  ford_ev: 'Ford', formula_leopard: 'Fangchengbao', geely_galaxy: 'Geely Galaxy',
  hechuang: 'Hiphi', honda_ev: 'Honda', hozon: 'Neta', hyundai: 'Hyundai',
  infiniti_ev: 'Infiniti', jetour: 'Jetour', jihu: 'Arcfox', kia: 'Kia',
  leapmotor: 'Leapmotor', li_auto: 'Li Auto', lotus: 'Lotus', lynkco: 'Lynk & Co',
  mazda: 'Mazda', mitsubishi: 'Mitsubishi', nio: 'Nio', nissan_ev: 'Nissan',
  ora: 'Ora', peugeot: 'Peugeot', polestar: 'Polestar', porsche: 'Porsche',
  qichen: 'Venucia', renault: 'Renault', saic_maxus: 'Maxus', subaru: 'Subaru',
  toyota_ev: 'Toyota', volvo: 'Volvo', voyah: 'Voyah', vw_id: 'Volkswagen',
  wey: 'Wey', xiaomi: 'Xiaomi', xpeng: 'Xpeng', yangwang: 'Yangwang',
  zeekr: 'Zeekr', zhiji: 'IM Motors',
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function bingSearch(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
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
    const re = /murl.{0,30}(https?:\/\/[^&"'\s]+\.(?:jpg|jpeg|png|webp)[^&"'\s]*)/gi;
    const urls = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[1].replace(/\\u002f/g, '/');
      if (!u.includes('bing.com') && !u.includes('mm.bing.net') &&
          !u.includes('logo') && !u.includes('icon') && !urls.includes(u)) {
        urls.push(u);
      }
      if (urls.length >= 8) break;
    }
    return urls;
  } catch { return []; }
}

async function downloadAndConvert(url, dest) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Referer': 'https://www.bing.com/' },
    });
    clearTimeout(t);
    if (!resp.ok) return false;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 3000) return false;

    const sharp = (await import('sharp')).default;
    await sharp(buf)
      .resize(800, 600, { fit: 'inside', background: { r: 248, g: 250, b: 252, alpha: 1 } })
      .webp({ quality: 80 })
      .toFile(dest);
    return true;
  } catch { return false; }
}

async function main() {
  console.log('🔧 修复低质量图片\n');

  // 加载待修复列表
  const fixList = JSON.parse(fs.readFileSync(FIX_LIST, 'utf-8'));

  // 按品牌+slug分组
  const groups = {};
  for (const item of fixList) {
    const key = item.brand + '/' + item.slug;
    if (!groups[key]) groups[key] = { brand: item.brand, slug: item.slug, files: [] };
    groups[key].files.push(item);
  }

  // 同时检查是否有用户指定的AION LX 01/AION S 01
  // 这些虽然没有<14KB但被用户确认是二维码
  const manualFixes = JSON.parse(fs.readFileSync(FIX_LIST, 'utf-8'));
  // 把所有需要修的加到组里
  for (const item of manualFixes) {
    const key = item.brand + '/' + item.slug;
    if (!groups[key]) groups[key] = { brand: item.brand, slug: item.slug, files: [] };
    if (!groups[key].files.find(f => f.file === item.file)) {
      groups[key].files.push(item);
    }
  }

  const entries = Object.entries(groups);
  // 手动追加 AION LX 01 和 AION S 01（虽然>14KB但是二维码）
  const extraFix = [
    { brand: 'aion', slug: 'aion-aionlx', file: 'aion-aionlx-01.webp', size: 20092 },
    { brand: 'aion', slug: 'aion-aions', file: 'aion-aions-01.webp', size: 21274 },
  ];
  for (const item of extraFix) {
    const key = item.brand + '/' + item.slug;
    if (!groups[key]) groups[key] = { brand: item.brand, slug: item.slug, files: [] };
    if (!groups[key].files.find(f => f.file === item.file)) {
      groups[key].files.push(item);
    }
  }

  console.log(`📦 需修复: ${entries.length} 个车型\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < entries.length; i++) {
    const [key, group] = entries[i];
    const { brand, slug } = group;

    // 从车型JSON获取名称
    const vehicleJson = path.join(VEHICLES_DIR, slug + '.json');
    let vehicleName = slug;
    if (fs.existsSync(vehicleJson)) {
      const data = JSON.parse(fs.readFileSync(vehicleJson, 'utf-8'));
      vehicleName = data.names.zh || data.names.en;
    }

    process.stdout.write(`[${i + 1}/${entries.length}] ${vehicleName}... `);

    const brandEn = BRAND_EN[brand] || brand.replace(/_/g, ' ');
    const query = `${brandEn} ${vehicleName.replace(brandEn, '').trim()} 2025 car`;
    const urls = await bingSearch(query);

    if (urls.length === 0) {
      console.log('❌ 0结果');
      fail++;
      await sleep(DELAY);
      continue;
    }

    // 每个需要修复的图片位下载一张
    const brandDir = path.join(IMAGES_DIR, brand);
    let dl = 0;
    let urlIdx = 0;

    for (const item of group.files) {
      if (urlIdx >= urls.length) break;
      const dest = path.join(brandDir, item.file);
      const tmp = path.join(brandDir, item.file + '.tmp');

      if (await downloadAndConvert(urls[urlIdx], tmp)) {
        const newSize = fs.statSync(tmp).size;
        if (newSize > MIN_KB * 1024) {
          // 足够大，不是二维码，替换
          fs.renameSync(tmp, dest);
          dl++;
          console.log(`✅ ${item.file}(${(newSize/1024).toFixed(0)}KB)`);
        } else {
          // 太小了，尝试下一个URL
          fs.unlinkSync(tmp);
          urlIdx++;
          continue;
        }
      }
      urlIdx++;
      await sleep(500);
    }

    if (dl > 0) ok++;
    await sleep(DELAY);
  }

  console.log(`\n📊 修复完成: ${ok} | 失败: ${fail}`);
  // 更新JSON引用
  console.log('📝 更新JSON...');
  const vDir = VEHICLES_DIR;
  let updated = 0;
  for (const file of fs.readdirSync(vDir).filter(f => f.endsWith('.json'))) {
    const fp = path.join(vDir, file);
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
      if (!found) newImgs.push(data.images[i-1] || '');
      else if (!data.images[i-1]?.endsWith(newImgs[newImgs.length-1].split('.').pop())) changed = true;
    }
    if (changed) {
      data.images = newImgs;
      fs.writeFileSync(fp, JSON.stringify(data) + '\n');
      updated++;
    }
  }
  console.log(`  JSON更新: ${updated}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
