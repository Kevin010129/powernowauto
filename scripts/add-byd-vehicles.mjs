#!/usr/bin/env node
/**
 * PowerNowAuto - 补充BYD缺失车型
 *
 * 在 src/content/vehicles/ 中创建缺失的比亚迪车型 JSON
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');

// 车型模板
function makeVehicle(slug, zh, en, type, fuelType, year, specs = {}) {
  return {
    id: slug,
    names: { en, zh },
    slug,
    brand: 'byd',
    type,
    fuelType,
    year,
    images: [
      `/images/vehicles/byd/${slug}-01.svg`,
      `/images/vehicles/byd/${slug}-02.svg`,
      `/images/vehicles/byd/${slug}-03.svg`,
      `/images/vehicles/byd/${slug}-04.svg`,
    ],
    specs: {
      seats: specs.seats || 5,
      drive: specs.drive || 'FWD',
      ...specs,
    },
    featured: false,
    inStock: true,
    isNew: year >= 2025,
    order: 100,
    description: {
      en: `${en} is available for export at PowerNowAuto.`,
      zh: `${zh}现可在 PowerNowAuto 进行出口咨询。`,
    },
  };
}

// 需要补充的 BYD 车型列表
const newVehicles = [
  // 海洋系列
  makeVehicle('byd-seagull', '海鸥', '海鸥', 'MINI', 'electric', 2025, { seats: 4, drive: 'FWD', range_km: 405, battery_kwh: 38.88 }),
  makeVehicle('byd-dolphin', '海豚', '海豚', 'MINI', 'electric', 2025, { seats: 5, drive: 'FWD', range_km: 420, battery_kwh: 44.9 }),
  makeVehicle('byd-seal06', '海豹06', '海豹06', 'SEDAN', 'electric', 2025, { seats: 5, drive: 'RWD', range_km: 550, battery_kwh: 60.48 }),
  makeVehicle('byd-sealion05', '海狮05 EV', '海狮05 EV', 'SUV', 'electric', 2025, { seats: 5, drive: 'AWD', range_km: 520, battery_kwh: 71.8 }),
  makeVehicle('byd-sealion07', '海狮07 EV', '海狮07 EV', 'SUV', 'electric', 2025, { seats: 5, drive: 'AWD', range_km: 610, battery_kwh: 80.64 }),

  // 王朝系列
  makeVehicle('byd-han', '汉', '汉', 'SEDAN', 'electric', 2025, { seats: 5, drive: 'AWD', range_km: 715, battery_kwh: 85.44 }),
  makeVehicle('byd-han-dmi', '汉 DM-i', '汉 DM-i', 'SEDAN', 'plug_in_hybrid', 2025, { seats: 5, drive: 'FWD', engine: '1.5T', range_km: 1210 }),
  makeVehicle('byd-qin-plus', '秦 PLUS', '秦 PLUS', 'SEDAN', 'electric', 2025, { seats: 5, drive: 'FWD', range_km: 510, battery_kwh: 57.6 }),
  makeVehicle('byd-qin-l', '秦 L', '秦 L', 'SEDAN', 'electric', 2025, { seats: 5, drive: 'FWD', range_km: 550, battery_kwh: 60.48 }),
  makeVehicle('byd-song-pro', '宋 Pro', '宋 Pro', 'SUV', 'electric', 2025, { seats: 5, drive: 'AWD', range_km: 520, battery_kwh: 71.8 }),
  makeVehicle('byd-song-l', '宋 L', '宋 L', 'SUV', 'electric', 2025, { seats: 5, drive: 'AWD', range_km: 662, battery_kwh: 87.04 }),
  makeVehicle('byd-tang-l', '唐 L', '唐 L', 'SUV', 'electric', 2026, { seats: 7, drive: 'AWD', range_km: 730, battery_kwh: 100 }),
  makeVehicle('byd-yuan-up', '元 UP', '元 UP', 'MINI', 'electric', 2025, { seats: 5, drive: 'FWD', range_km: 401, battery_kwh: 38.88 }),
];

// 同时提供汽车之家 seriesId 以直接下载图片
const seriesIdMap = {
  'byd-seagull': 6762,
  'byd-dolphin': 6139,
  'byd-seal06': 7588,
  'byd-sealion05': 7807,
  'byd-sealion07': 6851,
  'byd-han': 5499,
  'byd-han-dmi': 5499,
  'byd-qin-plus': 7981,
  'byd-qin-l': 7822,
  'byd-song-pro': 5279,
  'byd-song-l': 7220,
  'byd-tang-l': 7977,
  'byd-yuan-up': 7538,
};

// 创建 JSON
let created = 0;
for (const v of newVehicles) {
  const fp = path.join(VEHICLES_DIR, v.slug + '.json');
  // 不覆盖已有
  if (fs.existsSync(fp)) {
    console.log('  ⏭ 已存在: ' + v.names.zh);
    continue;
  }
  const specSeriesId = seriesIdMap[v.slug];
  fs.writeFileSync(fp, JSON.stringify(v) + '\n');
  created++;
  console.log(`  ✅ ${v.names.zh} (seriesId=${specSeriesId}, type=${v.type})`);
}

console.log(`\n📊 新增: ${created} 款车型`);
console.log(`   总计 BYD 车型: ${fs.readdirSync(VEHICLES_DIR).filter(f => f.startsWith('byd-')).length} 款`);

// 保存 seriesId 映射供下载脚本使用
fs.writeFileSync(
  path.join(ROOT, 'byd-seriesid-map.json'),
  JSON.stringify(seriesIdMap, null, 2)
);
console.log('   seriesId映射: byd-seriesid-map.json');
