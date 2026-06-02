#!/usr/bin/env node
/**
 * PowerNowAuto - 删除虚构车型
 *
 * 基于审计结果，删除66款明确不存在的虚构车型
 * 操作：删除 src/content/vehicles/ 下的 JSON 文件和相关图片
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');

// 66款明确虚构车型列表
const FAKE_VEHICLES = [
  "byd-ev.json",           // 唐 EV (应在byd品牌但以现有数据看有唐这个车型)
  "cadillac-ct5-vblackwingev.json",
  "cadillac-ct6ev.json",
  "cadillac-gt4ev.json",
  "citroen-c4phev.json",
  "citroen-c5xphev.json",
  "citroen-c6phev.json",
  "citroen-dispatchev.json",
  "ford-ev-broncoev.json",
  "ford-ev-edgeev.json",
  "ford-ev-escapephev.json",
  "ford-ev-explorerphev.json",
  "ford-ev-mustangdarkhorseev.json",
  "honda-ev-accorde-phev.json",
  "honda-ev-civicev.json",
  "honda-ev-hr-vev.json",
  "hyundai-santafephev.json",
  "hyundai-tucsonphev.json",
  "infiniti-ev-fxev.json",
  "infiniti-ev-gev.json",
  "infiniti-ev-jxev.json",
  "infiniti-ev-mev.json",
  "infiniti-ev-q50ev.json",
  "infiniti-ev-q60ev.json",
  "infiniti-ev-qx55ev.json",
  "infiniti-ev-qx60ev.json",
  "jetour-x70ev.json",
  "jetour-x90phev.json",
  "kia-sorentophev.json",
  "kia-soulev.json",
  "kia-sportagephev.json",
  "kia-stingerev.json",
  "li-auto-i9.json",
  "li-auto-l4.json",
  "li-auto-l5.json",
  "lynkco-10-.json",
  "mazda-cx-30ev.json",
  "mazda-cx-50ev.json",
  "mazda-mazda3ev.json",
  "mazda-mazda6ev.json",
  "mazda-mx-5ev.json",
  "mitsubishi-asxev.json",
  "mitsubishi-i-miev.json",
  "mitsubishi-l200ev.json",
  "mitsubishi-mirageev.json",
  "mitsubishi-pajeroev.json",
  "mitsubishi-xpanderev.json",
  "nissan-ev-altimaev.json",
  "nissan-ev-maximaev.json",
  "nissan-ev-rogueev.json",
  "peugeot-2008phev.json",
  "peugeot-308phev.json",
  "porsche-911turbose-hybrid.json",
  "porsche-panamerae-hybrid.json",
  "qichen-t70phev.json",
  "renault-alpinea110ev.json",
  "saic-maxus-d90proev.json",
  "saic-maxus-g90ev.json",
  "saic-maxus-t90ev.json",
  "subaru-ascentev.json",
  "subaru-brzev.json",
  "subaru-crosstrekhybrid.json",
  "subaru-foresterhybrid.json",
  "subaru-imprezaev.json",
  "subaru-outbackhybrid.json",
  "subaru-wrxev.json",
  "wey-dht-phev.json",
];

// 注意事项：byd-ev.json (唐EV) 需要保留，因为唐EV是真实车型
// 从列表中移除它
const finalFakeList = FAKE_VEHICLES.filter(f => f !== "byd-ev.json");

console.log(`🗑 删除 ${finalFakeList.length} 款虚构车型\n`);

let deletedJson = 0, deletedImages = 0;

for (const filename of finalFakeList) {
  // 删除JSON文件
  const jsonPath = path.join(VEHICLES_DIR, filename);
  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const slug = data.slug;
    const brand = data.brand;
    const name = data.names.zh;

    fs.unlinkSync(jsonPath);
    deletedJson++;
    console.log(`  ✓ JSON: ${name} (${filename})`);

    // 删除相关图片
    const brandDir = path.join(IMAGES_DIR, brand);
    if (fs.existsSync(brandDir)) {
      for (let i = 1; i <= 4; i++) {
        const num = String(i).padStart(2, '0');
        for (const ext of ['.webp', '.jpg', '.jpeg', '.png', '.svg']) {
          const imgPath = path.join(brandDir, slug + '-' + num + ext);
          if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
            deletedImages++;
          }
        }
      }
    }
  }
}

console.log(`\n📊 删除完成:`);
console.log(`   JSON文件: ${deletedJson} 个`);
console.log(`   图片文件: ${deletedImages} 张`);

// 更新统计
const remaining = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json')).length;
console.log(`   剩余车型: ${remaining} 款`);
