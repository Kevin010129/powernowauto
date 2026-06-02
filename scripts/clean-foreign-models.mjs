#!/usr/bin/env node
/**
 * 清理海外品牌中不在中国市场销售的型号
 * + 补充国产新能源车型（日产N7等）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');

// 不在中国销售的海外特供型号
const DELETE_LIST = [
  // 日产 - 日本/欧洲特供
  'nissan-ev-notee-power', 'nissan-ev-qashqaie-power', 'nissan-ev-x-traile-power',
  // 雷诺 - 全系不在中国销售（雷诺退出中国市场）
  'renault-clioe-tech', 'renault-kangooe-tech', 'renault-mastere-tech',
  'renault-meganee-tech', 'renault-sc-nice-tech', 'renault-capture-techphev',
  'renault-zoe',
  // 马自达 - 欧美特供
  'mazda-cx-60phev', 'mazda-cx-90phev',
  // 三菱 - 不在中国销售（三菱退出中国）
  'mitsubishi-eclipsecrossphev', 'mitsubishi-outlanderphev',
  // 雪铁龙 - 不进口中国
  'citroen-berlingo', 'citroen-spacetourer',
  // 标致 - 中国已停产
  'peugeot-3008phev', 'peugeot-508phev',
  // 福特 - 未进口中国
  'ford-ev-e-transit',
  // 凯迪拉克 - CT5/CT6/GT4 EV 不存在
  'cadillac-xt4ev', 'cadillac-xt5ev',
  // 本田 - CR-V e:PHEV中国版本是CR-V 锐·混动e+ (应保留但要改名)
  // 'honda-ev-cr-ve-phev',  // 保留！中国有
  // 丰田 - 皇冠SportCross PHEV 日本特供
  'toyota-ev-sportcrossphev',
  // 保时捷 - Macan EV/Cayenne E-Hybrid 中国以纯进口形式存在，暂时保留
  // 起亚 - EV5/EV6/EV9在中国有售（悦达起亚），EV5国产, EV6/EV9进口
  // 现代 - IONIQ/Kona/Nexo/Casper 全部在中国有售或进口
];

// 新增国产新能源车型
const NEW_VEHICLES = [
  // 日产 N7/N6/NX8
  {
    slug: 'nissan-ev-n7',
    brand: 'nissan_ev',
    names: { zh: '日产 N7', en: 'Nissan N7' },
    type: 'SEDAN', fuelType: 'electric', year: 2025,
    specs: { seats: 5, drive: 'FWD', range_km: 625, battery_kwh: 73, power_kw: 200 },
    description: { zh: '日产N7纯电轿车现可在PowerNowAuto进行出口咨询。', en: 'Nissan N7 electric sedan available for export.' },
  },
  {
    slug: 'nissan-ev-n6',
    brand: 'nissan_ev',
    names: { zh: '日产 N6', en: 'Nissan N6' },
    type: 'SEDAN', fuelType: 'plug_in_hybrid', year: 2025,
    specs: { seats: 5, drive: 'FWD', engine: '1.5T' },
    description: { zh: '日产N6插混轿车现可在PowerNowAuto进行出口咨询。', en: 'Nissan N6 PHEV sedan available for export.' },
  },
  {
    slug: 'nissan-ev-nx8',
    brand: 'nissan_ev',
    names: { zh: '日产 NX8', en: 'Nissan NX8' },
    type: 'SUV', fuelType: 'electric', year: 2026,
    specs: { seats: 5, drive: 'AWD', range_km: 620, battery_kwh: 90 },
    description: { zh: '日产NX8纯电SUV现可在PowerNowAuto进行出口咨询。', en: 'Nissan NX8 electric SUV available for export.' },
  },
  // 本田CR-V 中国版本（保留现有，增加CR-V 锐·混动e+）
  // CR-V e:PHEV 实际是存在的（东风本田CR-V 锐·混动e+），保留！
];

function makeVehicle(data) {
  return {
    id: data.slug,
    names: data.names,
    slug: data.slug,
    brand: data.brand,
    type: data.type,
    fuelType: data.fuelType,
    year: data.year,
    images: [
      `/images/vehicles/${data.brand}/${data.slug}-01.svg`,
      `/images/vehicles/${data.brand}/${data.slug}-02.svg`,
      `/images/vehicles/${data.brand}/${data.slug}-03.svg`,
      `/images/vehicles/${data.brand}/${data.slug}-04.svg`,
    ],
    specs: { seats: 5, drive: 'FWD', ...data.specs },
    featured: false,
    inStock: true,
    isNew: data.year >= 2025,
    order: 200,
    description: data.description,
  };
}

// 执行
let deleted = 0, added = 0;

// 删除
for (const slug of DELETE_LIST) {
  const fp = path.join(VEHICLES_DIR, slug + '.json');
  if (fs.existsSync(fp)) {
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    console.log(`  🗑 ${data.names.zh} (${slug})`);
    fs.unlinkSync(fp);
    // 删除图片
    const brandDir = path.join(IMAGES_DIR, data.brand);
    for (let i = 1; i <= 4; i++) {
      const num = String(i).padStart(2, '0');
      for (const ext of ['.webp', '.svg']) {
        const img = path.join(brandDir, slug + '-' + num + ext);
        if (fs.existsSync(img)) fs.unlinkSync(img);
      }
    }
    deleted++;
  }
}

// 新增
for (const v of NEW_VEHICLES) {
  const fp = path.join(VEHICLES_DIR, v.slug + '.json');
  if (fs.existsSync(fp)) {
    console.log(`  ⏭ 已存在: ${v.names.zh}`);
    continue;
  }
  const vehicle = makeVehicle(v);
  fs.writeFileSync(fp, JSON.stringify(vehicle) + '\n');
  console.log(`  ✅ ${v.names.zh} (${v.slug})`);
  added++;
}

// 统计
const total = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json')).length;
console.log(`\n📊 删除: ${deleted} | 新增: ${added} | 总计: ${total} 款`);
