#!/usr/bin/env node
/**
 * PowerNowAuto - 去水印（覆盖原图+备份）
 *
 * 策略：写入新文件名 -> 删除原图 -> 重命名新文件为原文件名
 * 这样避免 EPREM (文件被占用) 错误
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');

async function main() {
  const sharp = (await import('sharp')).default;
  console.log('🖼 去水印批量处理\n');

  const dirs = fs.readdirSync(IMAGES_DIR);
  let ok = 0, err = 0, skipNew = 0;

  for (const brand of dirs) {
    const brandDir = path.join(IMAGES_DIR, brand);
    if (!fs.statSync(brandDir).isDirectory()) continue;

    // 只处理 .webp 文件，跳过已有 '_w.' 文件的（已处理过的）
    const files = fs.readdirSync(brandDir)
      .filter(f => f.endsWith('.webp') && !f.endsWith('_w.webp'));

    let brandOk = 0;

    for (const file of files) {
      const input = path.join(brandDir, file);
      const output = path.join(brandDir, file.replace('.webp', '_w.webp'));

      // 跳过已处理的
      if (fs.existsSync(output)) { skipNew++; continue; }

      try {
        const meta = await sharp(input).metadata();
        const w = meta.width || 800;
        const h = meta.height || 600;
        const cropH = Math.floor(h * 0.94);

        // 写入新文件（带 _w 后缀）
        await sharp(input)
          .resize(w, Math.ceil(h * 1.06), { fit: 'fill', position: 'top' })
          .extract({ left: 0, top: 0, width: w, height: cropH })
          .resize(800, 600, { fit: 'fill', background: { r: 248, g: 250, b: 252 } })
          .webp({ quality: 78 })
          .toFile(output);

        brandOk++;
        ok++;
      } catch (e) {
        err++;
        try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
      }
    }

    if (brandOk > 0) {
      console.log(`  ✓ ${brand}: ${brandOk} 张 → *_w.webp`);
    }
  }

  console.log(`\n📊 处理: ${ok} | 已跳过: ${skipNew} | 失败: ${err}`);
  console.log('\n⚠ 下一步: 手动执行以下命令替换原文件:');
  console.log('  find public/images/vehicles -name "*_w.webp" | while read f; do');
  console.log('    orig="${f%_w.webp}.webp";');
  console.log('    rm "$orig" && mv "$f" "$orig";');
  console.log('  done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
