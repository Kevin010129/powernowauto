#!/usr/bin/env node
/**
 * PowerNowAuto - 车型-汽车之家车系ID映射生成器
 * 输出: vehicle-series-mapping.json
 *
 * 匹配策略：
 *   1. 中文名在汽车之家catalog中精确查找
 *   2. 去掉品牌前缀后查找
 *   3. 手动规则（变体名映射）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const MAPPING_FILE = path.join(ROOT, 'autohome-mapping.json');
const OUTPUT = path.join(ROOT, 'vehicle-series-mapping.json');

// 品牌名变体映射 — 我们的brand → 汽车之家品牌前缀
const BRAND_PREFIX_MAP = {
  aion: ['AION', '埃安', '广汽埃安'],
  aito: ['问界', 'AITO'],
  audi_etron: ['奥迪', 'AUDI', 'e-tron'],
  avatr: ['阿维塔', 'AVATR'],
  benz_eq: ['奔驰', '梅赛德斯', 'EQ', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'EQV'],
  bmw_i: ['宝马', 'BMW', 'i3', 'i4', 'i7', 'i8', 'iX'],
  byd: ['比亚迪', 'BYD', '腾势', '仰望', '方程豹', '宋', '唐', '元', '汉', '秦', '海豹', '海豚', '海鸥', '海狮', '驱逐舰', '护卫舰', 'e2', 'e3', 'e6', 'e7', 'e9', 'D1'],
  cadillac: ['凯迪拉克', 'CADILLAC', 'LYRIQ', '锐歌', 'OPTIQ'],
  chery_fengyun: ['风云', '奇瑞'],
  citroen: ['雪铁龙', 'CITROEN', 'CITROËN', 'ë-C4', 'ë-Berlingo', 'ë-SpaceTourer'],
  deepal: ['深蓝'],
  denza: ['腾势'],
  feifan: ['飞凡'],
  ford_ev: ['福特', 'FORD', 'Bronco', 'Mustang', 'Transit', 'Escape', 'Explorer', 'F-150'],
  formula_leopard: ['方程豹', '豹'],
  geely_galaxy: ['银河', '吉利', 'GEELY'],
  hechuang: ['合创', 'HECHUANG'],
  honda_ev: ['本田', 'HONDA', 'e:N', 'e:NP', 'e:NS', '极湃', 'Accord', 'Civic', 'CR-V', 'HR-V'],
  hozon: ['哪吒', 'HOZON', 'Neta'],
  hyundai: ['现代', 'HYUNDAI', 'IONIQ', 'Kona', 'Nexo', 'Santa', 'Tucson', 'Casper'],
  infiniti_ev: ['英菲尼迪', 'INFINITI', 'QX', 'Q50', 'Q60', 'FX', 'JX'],
  jetour: ['捷途', 'JETOUR', '山海', '大圣', '旅行者'],
  jihu: ['极狐', 'ARCFOX', 'JIHU', '阿尔法', '考拉'],
  kia: ['起亚', 'KIA', 'Niro', 'Sorento', 'Soul', 'Sportage', 'Stinger'],
  leapmotor: ['零跑', 'LEAPMOTOR', 'C01', 'C10', 'C11', 'T03', 'S01'],
  li_auto: ['理想', 'LI', 'MEGA', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'i9'],
  lotus: ['路特斯', 'LOTUS', '莲花', 'Eletre', 'Emira', 'Evija'],
  lynkco: ['领克', 'LYNK', 'LYNKCO'],
  mazda: ['马自达', 'MAZDA', 'CX-', 'MX-', 'Mazda'],
  mitsubishi: ['三菱', 'MITSUBISHI', 'Eclipse', 'i-MiEV', 'L200', 'Mirage', 'Outlander', 'Pajero', 'Xpander', 'ASX'],
  nio: ['蔚来', 'NIO', 'ET5', 'ET7', 'ET9', 'ES6', 'ES8', 'EC6', 'EC7'],
  nissan_ev: ['日产', 'NISSAN', 'Ariya', 'Leaf', 'e-Power', 'Note', 'Qashqai', 'Rogue', 'X-Trail', 'Altima', 'Maxima'],
  ora: ['欧拉', 'ORA', '好猫', '闪电猫', '芭蕾猫', '樱桃猫', 'iQ'],
  peugeot: ['标致', 'PEUGEOT', 'e-2008', 'e-208', 'e-308', 'e-5008'],
  polestar: ['极星', 'Polestar', 'POLESTAR'],
  porsche: ['保时捷', 'PORSCHE', 'Taycan', 'Macan', 'Cayenne', 'Panamera'],
  qichen: ['启辰', 'QICHEN', 'V-Online', 'DD-i', 'Venucia'],
  renault: ['雷诺', 'RENAULT', 'E-Tech', 'Zoe', 'Captur', 'Clio', 'Kangoo', 'Master', 'Megane', 'Scénic', 'Alpine'],
  saic_maxus: ['大通', 'MAXUS', 'MIFA', '上汽大通', 'EG10', 'EV30', 'T90', 'D90', 'G90'],
  subaru: ['斯巴鲁', 'SUBARU', 'Crosstrek', 'Forester', 'Impreza', 'Outback', 'Solterra', 'WRX', 'Ascent', 'BRZ'],
  toyota_ev: ['丰田', 'TOYOTA', 'bZ', '皇冠', 'RAV4', 'SportCross'],
  volvo: ['沃尔沃', 'VOLVO', 'C40', 'S60', 'S90', 'XC40', 'XC60', 'XC90', 'Recharge'],
  voyah: ['岚图', 'VOYAH', 'FREE', '梦想家', '追光', '知音', '泰山'],
  vw_id: ['大众', 'VOLKSWAGEN', 'VW', 'ID.', 'ID. Buzz'],
  wey: ['魏牌', 'WEY', '坦克', 'TANK', '摩卡', '蓝山', '高山'],
  xiaomi: ['小米', 'XIAOMI', 'SU7', 'YU7', 'YU9'],
  xpeng: ['小鹏', 'XPENG', 'G3', 'G6', 'G7', 'G9', 'P5', 'P7', 'X9'],
  yangwang: ['仰望', 'YANGWANG'],
  zeekr: ['极氪', 'ZEEKR', '001', '007', '009', 'MIX', '7X', '8X', '9X'],
  zhiji: ['智己', 'IM', 'LS6', 'LS7', 'LS9', 'L5', 'L6', 'L7'],
};

// 清洗名称
function cleanName(name) {
  return name
    .replace(/[（(][^)）]*[)）]/g, '')  // 去括号内容  "(进口)"
    .replace(/[\s\-_]+/g, '')           // 去空格连字符
    .toLowerCase();
}

// 提取车型核心名（去掉品牌前缀和版本后缀）
function extractCoreModelName(fullName, brand) {
  let n = fullName.trim();

  // 去掉品牌前缀
  const prefixes = BRAND_PREFIX_MAP[brand] || [];
  for (const p of prefixes.sort((a, b) => b.length - a.length)) {
    const cleanP = cleanName(p);
    const cleanN = cleanName(n);
    if (cleanN.startsWith(cleanP)) {
      n = n.substring(p.length).trim();
      break;
    }
  }

  // 去掉版本后缀
  n = n.replace(/\s*[增程版标配航涂][\s ]*/g, '') // 增程版/标航版 等
       .replace(/\s*\(EV\)\s*/gi, '')
       .replace(/\s*PHEV\s*/gi, '')
       .replace(/\s*EV\s*/gi, '')
       .trim();

  return n;
}

// 主逻辑
function buildMapping() {
  console.log('🔗 构建车型-车系映射...\n');

  // 加载汽车之家 catalog
  const catalog = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
  const ahSeries = catalog.series;

  // 加载我们的车型
  const vehicleFiles = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'));
  const vehicles = vehicleFiles.map(f => ({
    file: f,
    data: JSON.parse(fs.readFileSync(path.join(VEHICLES_DIR, f), 'utf-8')),
  }));

  // 构建快速查找索引
  const ahByName = new Map();     // 精确名→seriesId
  const ahByCleanName = new Map(); // 清洗后名→seriesId

  for (const s of ahSeries) {
    ahByName.set(s.name, s.seriesId);
    const clean = cleanName(s.name);
    if (!ahByCleanName.has(clean) || s.name.length < 10) {
      ahByCleanName.set(clean, s.seriesId);
    }
  }

  const matched = [];
  const unmatched = [];

  for (const vehicle of vehicles) {
    const brand = vehicle.data.brand;
    const zhName = (vehicle.data.names.zh || vehicle.data.names.en).trim();
    const enName = (vehicle.data.names.en || vehicle.data.names.zh).trim();

    let seriesId = null;
    let matchName = null;

    // === 匹配策略（按优先级） ===

    // 1. 原始中文名精确匹配
    if (ahByName.has(zhName)) {
      seriesId = ahByName.get(zhName);
      matchName = zhName + ' [精确中文]';
    }

    // 2. 清洗后名匹配
    if (!seriesId) {
      const cleanZh = cleanName(zhName);
      if (ahByCleanName.has(cleanZh)) {
        seriesId = ahByCleanName.get(cleanZh);
        matchName = zhName + ' [清洗中文]';
      }
    }

    // 3. 英文名匹配
    if (!seriesId && enName !== zhName) {
      if (ahByName.has(enName)) {
        seriesId = ahByName.get(enName);
        matchName = enName + ' [精确英文]';
      }
      const cleanEn = cleanName(enName);
      if (!seriesId && ahByCleanName.has(cleanEn)) {
        seriesId = ahByCleanName.get(cleanEn);
        matchName = enName + ' [清洗英文]';
      }
    }

    // 4. 核心名匹配（去品牌前缀后匹配）
    if (!seriesId) {
      const core = extractCoreModelName(zhName, brand);
      const coreClean = cleanName(core);
      if (coreClean.length >= 2 && ahByCleanName.has(coreClean)) {
        seriesId = ahByCleanName.get(coreClean);
        matchName = zhName + ' → ' + core + ' [核心名]';
      }
    }

    // 5. 在全部catalog中模糊搜索
    if (!seriesId) {
      // 在 catalog 中找品牌匹配的车系，再搜索
      const brandPrefixes = BRAND_PREFIX_MAP[brand] || [];
      const zhClean = cleanName(zhName);

      // 找到品牌相关的所有车系
      const brandSeries = ahSeries.filter(s =>
        brandPrefixes.some(bp => cleanName(s.name).includes(cleanName(bp)))
      );

      // 在这些车系中找最佳匹配
      let best = null, bestScore = 0;
      for (const s of brandSeries) {
        const sn = cleanName(s.name);
        if (sn === zhClean) { best = s; break; }

        let score = 0;
        if (sn.includes(zhClean) || zhClean.includes(sn)) score = 8;
        else {
          // 字符匹配
          const common = [...new Set(sn.split('').filter(c => zhClean.includes(c)))].length;
          score = common / Math.max(zhClean.length, sn.length) * 5;
        }

        if (score > bestScore) { bestScore = score; best = s; }
      }

      if (best && bestScore >= 5) {
        seriesId = best.seriesId;
        matchName = zhName + ' → ' + best.name + ` [模糊:${bestScore.toFixed(1)}]`;
      }
    }

    if (seriesId) {
      matched.push({
        slug: vehicle.data.slug,
        brand,
        zhName,
        enName,
        seriesId,
        matchName,
      });
    } else {
      unmatched.push({
        slug: vehicle.data.slug,
        brand,
        zhName,
        enName,
      });
    }
  }

  // 输出结果
  console.log(`✅ 匹配: ${matched.length}/${vehicles.length}`);
  console.log(`❌ 未匹配: ${unmatched.length}`);

  // 打印未匹配列表
  if (unmatched.length > 0) {
    console.log('\n未匹配车型:');
    unmatched.forEach(u => console.log(`  - ${u.zhName} [${u.brand}]`));
  }

  // 打印部分匹配结果
  console.log('\n匹配示例:');
  matched.slice(0, 10).forEach(m => console.log(`  ✓ ${m.zhName} → seriesId=${m.seriesId} (${m.matchName})`));

  // 保存
  fs.writeFileSync(OUTPUT, JSON.stringify({ matched, unmatched, _timestamp: Date.now() }, null, 2));
  console.log(`\n📄 映射已保存: ${OUTPUT}`);
  console.log(`   匹配率: ${(matched.length / vehicles.length * 100).toFixed(1)}%`);
}

buildMapping();
