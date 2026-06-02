#!/usr/bin/env node
/**
 * PowerNowAuto - 车型数据审计脚本
 *
 * 基于2025-2026年公开搜索数据，核实381款车型真实性
 * 输出: vehicle-audit.json (isReal标记)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const AUDIT_OUTPUT = path.join(ROOT, 'vehicle-audit.json');

// ========================================
// 2025-2026 中国新能源车真实车型知识库
// 来源: 汽车之家/懂车帝/搜索汇总
// ========================================

// 真实存在的车型（品牌+车型名关键词）
const REAL_MODELS = {
  // --- 比亚迪 ---
  byd: [
    '宋PLUS DM-i', '宋PLUS EV', '宋Pro DM-i', '宋Pro EV', '宋L DM-i', '宋L EV',
    '秦PLUS DM-i', '秦PLUS EV', '秦L DM-i', '秦L EV',
    '汉DM-i', '汉EV', '汉L DM-i', '汉L EV',
    '唐DM-i', '唐EV',
    '元PLUS', '元UP', '元Pro',
    '海豹', '海豹06', '海豹06GT', '海豹07',
    '海豚', '海鸥',
    '海狮05', '海狮06', '海狮07',
    '驱逐舰05', '护卫舰07',
    'e2', 'e3', 'e6', 'e7', 'e9', 'D1',
    '大唐', '大汉', '海豹08', '海狮08', '宋Ultra', '宋L GT',
  ],

  // --- 仰望 ---
  yangwang: ['U5', 'U6', 'U7', 'U8', 'U8 豪华版', 'U9', 'U9 超跑'],

  // --- 腾势 ---
  denza: ['D9', 'D9 商务版', 'N7', 'N7 长续航版', 'N8', 'N8 越野版', 'N8L', 'N9', 'Z9', 'Z9GT', 'Z'],

  // --- 方程豹 ---
  formula_leopard: ['3', '5', '5 越野版', '6', '7', '8', '8 豪华版', '9'],

  // --- 埃安 ---
  aion: ['LX', 'S', 'S Max', 'UT', 'V', 'V Plus', 'Y', 'Y Plus', 'RT', 'N60', 'i60', 'AY5'],

  // --- 问界 ---
  aito: ['M5', 'M5 EV', 'M7', 'M8', 'M9'],

  // --- 理想 ---
  li_auto: ['L6', 'L7', 'L8', 'L9', 'MEGA'],

  // --- 蔚来 ---
  nio: ['ET5', 'ET5T', 'ET7', 'ET9', 'ES6', 'ES8', 'EC6', 'EC7'],

  // --- 小鹏 ---
  xpeng: ['P5', 'P7', 'P7i', 'P7+', 'G3i', 'G6', 'G7', 'G9', 'X9', 'GX'],

  // --- 极氪 ---
  zeekr: ['001', '001 FR', '007', '007GT', '009', 'X', '7X', '8X', '9X', 'MIX'],

  // --- 小米 ---
  xiaomi: ['SU7', 'SU7 Pro', 'SU7 Max', 'SU7 Ultra', 'YU7', 'YU9'],

  // --- 零跑 ---
  leapmotor: ['C01', 'C10', 'C11', 'T03', 'C16'],

  // --- 智己 ---
  zhiji: ['L6', 'L7', 'LS6', 'LS7'],

  // --- 阿维塔 ---
  avatr: ['06', '07', '11', '12'],

  // --- 深蓝 ---
  deepal: ['SL03', 'L07', 'S05', 'S07', 'G318', 'S09'],

  // --- 哪吒 ---
  hozon: ['S', 'L', 'GT', 'X', 'U', 'V'],

  // --- 银河 ---
  geely_galaxy: ['E5', 'E8', 'L6', 'L7'],

  // --- 岚图 ---
  voyah: ['FREE', 'FREE 增程版', '梦想家', '追光', '知音'],

  // --- 极狐 ---
  jihu: ['阿尔法S', '阿尔法S5', '阿尔法T', '阿尔法T5', '考拉'],

  // --- 飞凡 ---
  feifan: ['F7', 'R7'],

  // --- 凯迪拉克 ---
  cadillac: ['LYRIQ', 'OPTIQ', 'VISTIQ', 'ESCALADE IQ', 'XT4', 'XT5'],

  // --- 宝马i ---
  bmw_i: ['i3', 'i4', 'i5', 'i7', 'iX', 'iX1', 'iX3', 'iX5'],

  // --- 奔驰EQ ---
  benz_eq: ['EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'EQV', 'EQE SUV', 'EQS SUV'],

  // --- 奥迪e-tron ---
  audi_etron: ['Q4 e-tron', 'Q5 e-tron', 'Q6 e-tron', 'Q8 e-tron', 'e-tron GT', 'RS e-tron GT'],

  // --- 保时捷 ---
  porsche: ['Taycan', 'Taycan 4S', 'Taycan Turbo', 'Taycan Turbo S', 'Macan EV', 'Macan 4 EV', 'Cayenne E-Hybrid'],

  // --- Polestar ---
  polestar: ['Polestar 2', 'Polestar 3', 'Polestar 4', 'Polestar 5'],

  // --- 沃尔沃 ---
  volvo: ['C40 Recharge', 'EX30', 'EX90', 'XC40 Recharge', 'XC60 Recharge', 'XC90 Recharge'],

  // --- 大众ID ---
  vw_id: ['ID.3', 'ID.4', 'ID.5', 'ID.6', 'ID.7', 'ID. Buzz'],

  // --- 领克 ---
  lynkco: ['01 EM-P', '05 EM-P', '06 EM-P', '07 EM-P', '08 EM-P', '09 EM-P'],

  // --- 捷途 ---
  jetour: ['山海L9', '山海L6', '山海L7', '山海T1', '山海T2', '旅行者', '大圣'],

  // --- 风云 ---
  chery_fengyun: ['A8', 'A8L', 'A9', 'A9L', 'T6', 'T7', 'T8', 'T8L', 'T9', 'T10', 'T11'],

  // --- 路特斯 ---
  lotus: ['Eletre', 'Emira', 'Evija'],

  // --- 现代 ---
  hyundai: ['IONIQ 5', 'IONIQ 6', 'IONIQ 7'],

  // --- 起亚 ---
  kia: ['EV5', 'EV6', 'EV9', 'Niro EV'],

  // --- 日产 ---
  nissan_ev: ['Ariya', 'Leaf', 'Note e-Power', 'Qashqai e-Power', 'X-Trail e-Power'],

  // --- 丰田 ---
  toyota_ev: ['bZ3', 'bZ4X', '皇冠 SportCross PHEV', 'RAV4 双擎 E+'],

  // --- 本田 ---
  honda_ev: ['e:NP1', 'e:NP2', 'e:NS1', 'e:NS2', 'CR-V e:PHEV'],

  // --- 福特 ---
  ford_ev: ['Mustang Mach-E', 'F-150 Lightning', 'E-Transit'],

  // --- 雪铁龙 ---
  citroen: ['ë-C4', 'ë-Berlingo', 'ë-SpaceTourer'],

  // --- 标致 ---
  peugeot: ['e-2008', 'e-208', 'e-308', 'e-5008', '3008 PHEV', '508 PHEV'],

  // --- 雷诺 ---
  renault: ['Megane E-Tech', 'Zoe', 'Captur E-Tech', 'Scénic E-Tech'],

  // --- 马自达 ---
  mazda: ['MX-30', 'CX-60 PHEV', 'CX-90 PHEV'],

  // --- 三菱 ---
  mitsubishi: ['Outlander PHEV', 'Eclipse Cross PHEV'],

  // --- 斯巴鲁 ---
  subaru: ['Solterra'],

  // --- 英菲尼迪 ---
  infiniti_ev: ['QX60 EV'],

  // --- 其他 ---
  hechuang: ['007', 'A06', 'V09', 'Z03'],
  hyundai_casper: ['Casper Electric'],
  qichen: ['D60 EV', '大V DD-i', 'T60 EV'],
  renault_alpine: ['A110 EV'],
  saic_maxus: ['MIFA 6', 'MIFA 7', 'MIFA 9', 'EV30', 'EG10'],
  hyundai_santafe: ['Santa Fe PHEV'],
  hyundai_tucson: ['Tucson PHEV'],
  kia_sportage: ['Sportage PHEV'],
  kia_sorento: ['Sorento PHEV'],
  hyundai_nexo: ['Nexo'],
};

/**
 * 检查车型是否真实存在
 */
function isRealVehicle(brand, zhName, enName) {
  const models = REAL_MODELS[brand] || [];
  const name = zhName.trim();

  for (const m of models) {
    // 精确匹配
    if (name === m) return true;
    // 包含匹配（去掉版本后缀）
    const clean = name.replace(/\s*(增程|纯电|混动|版|标配航涂)$/g, '').trim();
    if (clean === m) return true;
    if (m.includes(clean) || clean.includes(m)) return true;
  }
  return false;
}

function audit() {
  console.log('🔍 审计 381 款车型数据真实性...\n');

  const files = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'));
  const results = { real: [], fake: [], uncertain: [], totalReal: 0, totalFake: 0, totalUncertain: 0 };

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(VEHICLES_DIR, file), 'utf-8'));
    const zh = data.names.zh.trim();
    const en = data.names.en.trim();
    const brand = data.brand;

    const entry = { file, brand, zh, en, year: data.year, type: data.type };

    if (isRealVehicle(brand, zh, en)) {
      results.real.push(entry);
      results.totalReal++;
    } else {
      // 检查是否是已知虚构模式
      const fakePatterns = [
        // 海外品牌EV变体（大量虚构）
        'EV', 'PHEV', 'Hybrid',
        // 不存在的理想型号
        '理想 L4', '理想 L5', '理想 i9',
        // 不存在的问界变体
        '问界 M5 增程', '问界 M9 纯电',
        // 重复+变体版本
        '纯电版', '纯电', '长续航版',
      ];
      const isFake = fakePatterns.some(p => zh.includes(p) || en.includes(p));
      if (isFake) {
        results.fake.push({ ...entry, reason: '虚构/不存在' });
        results.totalFake++;
      } else {
        results.uncertain.push(entry);
        results.totalUncertain++;
      }
    }
  }

  // 统计
  console.log(`✅ 真实车型: ${results.totalReal}`);
  console.log(`❌ 虚构车型: ${results.totalFake}`);
  console.log(`⚠️ 待确认: ${results.totalUncertain}`);
  console.log(`📦 总计: ${files.length}\n`);

  // 列出虚构车型
  if (results.fake.length > 0) {
    console.log('=== 虚构车型 (建议删除) ===');
    results.fake.sort((a, b) => a.brand.localeCompare(b.brand)).forEach(v =>
      console.log(`  ❌ [${v.brand}] ${v.zh} (${v.file})`)
    );
  }

  // 保存审计文件
  fs.writeFileSync(AUDIT_OUTPUT, JSON.stringify(results, null, 2));
  console.log(`\n📄 审计报告: ${AUDIT_OUTPUT}`);
}

audit();
