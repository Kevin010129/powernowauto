#!/usr/bin/env node
/**
 * 基于已知映射表，批量下载汽车之家车型图片
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');
const MAPPING_FILE = path.join(ROOT, 'vehicle-series-mapping.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DELAY = 1200;

async function fetchText(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

async function downloadImg(url, dest) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Referer': 'https://car.autohome.com.cn/' } });
    clearTimeout(t);
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 2000) return false;

    try {
      const sharp = (await import('sharp')).default;
      await sharp(buf).resize(800, 600, { fit: 'inside', background: { r: 248, g: 250, b: 252, alpha: 1 } })
        .webp({ quality: 80 }).toFile(dest);
    } catch {
      fs.writeFileSync(dest.replace('.webp', '.jpg'), buf);
    }
    return true;
  } catch { return false; }
}

async function getImageUrls(seriesId, count = 4) {
  const html = await fetchText(`https://car.autohome.com.cn/photolist/series/${seriesId}/1/p1/`);
  if (!html) return [];

  const candidates = [];
  const re = /\/cars\/imgs-\d+-(\d+)-\d+-x\/(\d+)\.html/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!candidates.find(c => c.imgId === m[2])) candidates.push({ specId: parseInt(m[1]), imgId: parseInt(m[2]) });
    if (candidates.length >= 12) break;
  }

  const urls = [];
  for (const c of candidates) {
    if (urls.length >= count) break;
    const page = await fetchText(`https://www.autohome.com.cn/cars/imgs-${seriesId}-${c.specId}-1-x/${c.imgId}.html`);
    if (!page) continue;
    const match = page.match(/https?:\/\/car\d+\.autoimg\.cn\/[^"'\s<>]+?1400x1400[^"'\s<>]*?\.(?:jpg|webp)/i);
    if (match && !urls.includes(match[0]) &&
        !match[0].includes('qrcode') && !match[0].includes('image.png')) {
      urls.push(match[0]);
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return urls;
}

async function main() {
  console.log('🚗 批量下载汽车之家图片\n');

  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
  const matched = mapping.matched;

  // 过滤已有图片的
  const toDownload = [];
  for (const m of matched) {
    let hasAll = true;
    for (let i = 1; i <= 4; i++) {
      const num = String(i).padStart(2, '0');
      let found = false;
      for (const ext of ['.webp', '.jpg', '.jpeg', '.png']) {
        if (fs.existsSync(path.join(IMAGES_DIR, m.brand, m.slug + '-' + num + ext))) { found = true; break; }
      }
      if (!found) hasAll = false;
    }
    if (!hasAll) toDownload.push(m);
  }

  console.log(`📦 需下载: ${toDownload.length} 款车型\n`);

  let done = 0, fail = 0;

  for (let i = 0; i < toDownload.length; i++) {
    const m = toDownload[i];
    const brandDir = path.join(IMAGES_DIR, m.brand);
    if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });

    process.stdout.write(`[${i + 1}/${toDownload.length}] ${m.zhName} (seriesId=${m.seriesId})... `);

    const urls = await getImageUrls(m.seriesId, 4);
    if (urls.length === 0) {
      console.log('❌ 无图片');
      fail++;
      await new Promise(r => setTimeout(r, DELAY));
      continue;
    }

    let dlCount = 0;
    for (let j = 0; j < urls.length; j++) {
      const num = String(j + 1).padStart(2, '0');
      const dest = path.join(brandDir, `${m.slug}-${num}.webp`);
      if (await downloadImg(urls[j], dest)) dlCount++;
      await new Promise(r => setTimeout(r, 800));
    }

    if (dlCount > 0) {
      console.log(`✅ ${dlCount} 张`);
      done++;
    } else {
      console.log('❌ 下载失败');
      fail++;
    }

    await new Promise(r => setTimeout(r, DELAY));
  }

  console.log(`\n📊 完成: ${done} | 失败: ${fail}`);

  // 更新JSON引用
  console.log('\n📝 更新JSON...');
  const vehiclesDir = path.join(ROOT, 'src/content/vehicles');
  let updated = 0;
  for (const file of fs.readdirSync(vehiclesDir).filter(f => f.endsWith('.json'))) {
    const fp = path.join(vehiclesDir, file);
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
      if (!found) newImgs.push(data.images[i - 1] || `/images/vehicles/${data.brand}/${data.slug}-${num}.svg`);
      if (!found || (found && data.images[i - 1] && !data.images[i - 1].endsWith(path.extname(newImgs[newImgs.length-1])))) changed = true;
    }

    if (changed) {
      data.images = newImgs;
      fs.writeFileSync(fp, JSON.stringify(data) + '\n');
      updated++;
    }
  }
  console.log(`  已更新: ${updated} 个JSON文件`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
