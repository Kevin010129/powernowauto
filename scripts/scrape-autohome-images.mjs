#!/usr/bin/env node
/**
 * PowerNowAuto - 汽车之家图片爬虫
 *
 * 流程：
 *   1. 从汽车之家 A-Z 品牌页面提取所有车系的 seriesId
 *   2. 将我们的 381 款车型与汽车之家车系列表匹配
 *   3. 逐车系爬取图片（外观照，每款4张）
 *   4. 下载并保存为 webp 格式
 *   5. 更新车型 JSON 中的 images 引用
 *
 * 用法：
 *   node scripts/scrape-autohome-images.mjs                # 全部车型
 *   node scripts/scrape-autohome-images.mjs --limit 10     # 仅前10款
 *   node scripts/scrape-autohome-images.mjs --only brand1,brand2  # 仅指定品牌
 *   node scripts/scrape-autohome-images.mjs --update-only  # 仅更新JSON引用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');
const MAPPING_FILE = path.join(ROOT, 'autohome-mapping.json');
const REPORT_FILE = path.join(ROOT, 'scrape-report.json');

const LIMIT = parseInt(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity;
const ONLY_BRANDS = (() => {
  const idx = process.argv.indexOf('--only');
  if (idx > -1) return process.argv[idx + 1].split(',');
  return null;
})();
const UPDATE_ONLY = process.argv.includes('--update-only');

// ============ 配置 ============
const CONCURRENCY = 3;
const DELAY_MS = 1500;
const IMAGES_PER_VEHICLE = 4;
const MAX_SIZE_PX = 1400; // 最大下载尺寸

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ============ 工具函数 ============
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slug(name) {
  let s = name.toLowerCase()
    .replace(/[^a-z0-9一-鿿\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  // 防止纯中文
  if (/^[一-鿿]+$/.test(s)) s = s + '-';
  return s;
}

async function fetchWithRetry(url, opts = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch(url, {
        ...opts,
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, ...(opts.headers || {}) },
      });
      clearTimeout(timeout);
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}

// ============ 步骤1: 提取汽车之家所有车系 ============
async function scrapeGradePage(letter) {
  const url = `https://www.autohome.com.cn/grade/carhtml/${letter}.html`;
  console.log(`  获取 ${letter} 页...`);
  const resp = await fetchWithRetry(url);
  if (!resp) return [];
  const html = await resp.text();

  // 实际格式: <li id="s3170">...<h4><a href='//www.autohome.com.cn/3170/'>奥迪A3</a></h4>...
  const results = [];
  // 解析车系编号和名称
  const linkRegex = /id="s(\d+)"[\s\S]*?<h4><a[^>]*href='\/\/www\.autohome\.com\.cn\/\d+\/[^']*'>([^<]+)<\/a>/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    results.push({
      seriesId: parseInt(match[1]),
      name: match[2].trim(),
    });
  }

  return results;
}

async function buildAutohomeCatalog() {
  console.log('\n📋 步骤1: 构建汽车之家车系目录...\n');

  if (fs.existsSync(MAPPING_FILE)) {
    const cached = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
    const age = Date.now() - cached._timestamp;
    if (age < 7 * 24 * 3600 * 1000) {
      console.log(`  使用缓存的映射文件 (${Math.round(age/3600000)}小时前)`);
      console.log(`  ${cached.totalSeries} 个车系，${cached.matches} 个已匹配\n`);
      return cached;
    }
    console.log('  缓存已过期，重新构建');
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const allSeries = [];
  const brandMap = {};

  for (const letter of letters) {
    const series = await scrapeGradePage(letter);
    allSeries.push(...series);
    await sleep(500);
  }

  console.log(`  共获取 ${allSeries.length} 个车系\n`);

  const catalog = {
    _timestamp: Date.now(),
    totalSeries: allSeries.length,
    series: allSeries,
    matches: 0,
  };

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(catalog, null, 2));
  return catalog;
}

// ============ 品牌名映射：我们的brand_id → 汽车之家品牌中文名 ============
const BRAND_NAME_MAP = {
  aion: ['AION', '埃安', '广汽埃安'],
  aito: ['问界', 'AITO', 'aito'],
  audi_etron: ['奥迪', 'AUDI', 'e-tron'],
  avatr: ['阿维塔', 'AVATR'],
  benz_eq: ['奔驰', 'BENZ', '梅赛德斯', 'EQ'],
  bmw_i: ['宝马', 'BMW', 'i3', 'i4', 'i5', 'i7', 'i8', 'iX'],
  byd: ['比亚迪', 'BYD', '宋', '唐', '元', '汉', '海豹', '海豚', '海鸥', '海狮', '秦', '驱逐舰', '护卫舰', 'e2', 'e3', 'e6', 'e7', 'e9', 'D1', 'M9', '海'],
  cadillac: ['凯迪拉克', 'CADILLAC', 'LYRIQ', '锐歌'],
  chery_fengyun: ['风云', '奇瑞', 'chery'],
  citroen: ['雪铁龙', 'Citroën', 'CITROEN', 'ë'],
  deepal: ['深蓝', 'DEEPAL'],
  denza: ['腾势', 'DENZA'],
  feifan: ['飞凡', 'FEIFAN'],
  ford_ev: ['福特', 'FORD', 'Bronco', 'Mustang', 'Transit', 'Edge', 'Escape', 'Explorer', 'F-150'],
  formula_leopard: ['方程豹', '豹'],
  geely_galaxy: ['银河', '吉利', 'GEELY'],
  hechuang: ['合创', 'HECHUANG'],
  honda_ev: ['本田', 'HONDA', 'e:N', 'e:NP', 'e:NS', '极湃'],
  hozon: ['哪吒', 'HOZON', '哪吒汽车'],
  hyundai: ['现代', 'HYUNDAI', 'IONIQ', 'Kona', 'Santa', 'Tucson', 'Casper'],
  infiniti_ev: ['英菲尼迪', 'INFINITI', 'QX', 'Q50', 'Q60', 'FX', 'JX'],
  jetour: ['捷途', 'JETOUR', '山海'],
  jihu: ['极狐', 'ARCFOX', 'JIHU', '阿尔法', '考拉'],
  kia: ['起亚', 'KIA', 'Niro', 'Sorento', 'Soul', 'Sportage', 'Stinger'],
  leapmotor: ['零跑', 'LEAPMOTOR'],
  li_auto: ['理想', 'LI', 'MEGA'],
  lotus: ['路特斯', 'LOTUS', '莲花', 'Eletre', 'Emira', 'Evija'],
  lynkco: ['领克', 'LYNK', 'LYNKCO'],
  mazda: ['马自达', 'MAZDA', 'CX-', 'MX-'],
  mitsubishi: ['三菱', 'MITSUBISHI', 'Eclipse', 'i-MiEV', 'L200', 'Mirage', 'Outlander', 'Pajero', 'Xpander', 'ASX'],
  nio: ['蔚来', 'NIO', 'ET5', 'ET7', 'ET9', 'ES6', 'ES8', 'EC6', 'EC7'],
  nissan_ev: ['日产', 'NISSAN', 'e-Power', 'Ariya', 'Leaf', 'Note', 'Qashqai', 'Rogue', 'X-Trail', 'Altima', 'Maxima'],
  ora: ['欧拉', 'ORA', '好猫', '闪电猫', '芭蕾猫'],
  peugeot: ['标致', 'Peugeot', 'PEUGEOT', 'e-2008', 'e-208', 'e-308', 'e-5008'],
  polestar: ['极星', 'Polestar', 'POLESTAR'],
  porsche: ['保时捷', 'PORSCHE', 'Taycan', 'Macan', 'Cayenne', 'Panamera'],
  qichen: ['启辰', 'QICHEN', 'Venucia', 'V-Online', 'DD-i'],
  renault: ['雷诺', 'RENAULT', 'E-Tech', 'Zoe', 'Captur', 'Clio', 'Kangoo', 'Master', 'Megane', 'Scénic', 'Alpine'],
  saic_maxus: ['大通', 'MAXUS', '上汽大通', 'MIFA', 'EG10', 'EV30', 'T90', 'D90', 'G90'],
  subaru: ['斯巴鲁', 'SUBARU', 'Crosstrek', 'Forester', 'Impreza', 'Outback', 'Solterra', 'WRX', 'Ascent', 'BRZ'],
  toyota_ev: ['丰田', 'TOYOTA', 'bZ', '皇冠', 'RAV4'],
  volvo: ['沃尔沃', 'VOLVO', 'C40', 'S60', 'S90', 'XC40', 'XC60', 'XC90', 'Recharge'],
  voyah: ['岚图', 'VOYAH', 'FREE', '梦想家', '追光', '知音', '泰山'],
  vw_id: ['大众', 'ID.', 'VOLKSWAGEN', 'VW', 'ID. Buzz'],
  wey: ['魏牌', 'WEY', '坦克', 'TANK', '摩卡', '蓝山', '高山'],
  xiaomi: ['小米', 'XIAOMI', 'SU7', 'YU7', 'YU9'],
  xpeng: ['小鹏', 'XPENG', 'G3', 'G6', 'G7', 'G9', 'P5', 'P7', 'X9'],
  yangwang: ['仰望', 'YANGWANG'],
  zeekr: ['极氪', 'ZEEKR', '001', '007', '009', 'X', 'MIX', '7X', '8X', '9X'],
  zhiji: ['智己', 'ZHJI', 'IM', 'LS6', 'LS7', 'LS9', 'L5', 'L6', 'L7'],
};

// 车型名标准化：去除品牌前缀、后缀修饰词
function normalizeModelName(rawName, brand) {
  let name = rawName.trim();

  // 统一大小写
  const lower = name.toLowerCase();

  // 去掉品牌前缀
  const brandPrefixes = BRAND_NAME_MAP[brand] || [];
  for (const prefix of brandPrefixes) {
    if (lower.startsWith(prefix.toLowerCase())) {
      name = name.substring(prefix.length).trim();
      break;
    }
    if (lower.startsWith(prefix.toLowerCase() + ' ')) {
      name = name.substring(prefix.length + 1).trim();
      break;
    }
  }

  // 去掉常见后缀修饰
  name = name
    .replace(/\s*(增程|纯电|[版标配置准航]|高性能|旗舰|豪华|越野|长续航|超跑|超长续航|EV|PHEV|HEV|电动|混动|插电混|插混|纯电动)$/g, '')
    .replace(/\s*(版|款|型)$/, '')
    .trim();

  return name;
}

// 汽车之家名称标准化
function normalizeAutoHomeName(name) {
  return name
    // 去掉(进口)、(海外)等
    .replace(/[（(][^)）]*[)）]/g, '')
    // 去掉空格和连字符
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .trim();
}

// ============ 步骤2: 匹配我们的车型到汽车之家车系 ============
function matchVehicles(vehicles, catalog) {
  console.log('📋 步骤2: 匹配车型...\n');

  // 建立索引：名称→seriesId（多种变体）
  const nameToIds = new Map(); // 精确匹配
  const normToIds = new Map(); // 标准化后匹配
  const allSeries = catalog.series;

  for (const s of allSeries) {
    // 精确名
    nameToIds.set(s.name, s.seriesId);
    // 标准化名
    const norm = normalizeAutoHomeName(s.name);
    if (norm && norm.length > 0) {
      const existing = normToIds.get(norm) || [];
      existing.push({ id: s.seriesId, name: s.name });
      normToIds.set(norm, existing);
    }
  }

  const matches = [];
  const unmatched = [];

  for (const vehicle of vehicles) {
    const v = vehicle.data;
    const zhRaw = (v.names.zh || v.names.en).trim();
    const enRaw = (v.names.en || v.names.zh).trim();

    const zhNorm = normalizeModelName(zhRaw, v.brand);
    const enNorm = normalizeModelName(enRaw, v.brand);

    let seriesId = null;

    // 策略1: 原始中文名精确匹配
    seriesId = nameToIds.get(zhRaw);
    if (!seriesId) seriesId = nameToIds.get(enRaw);

    // 策略2: 标准化后精确匹配
    if (!seriesId && zhNorm) {
      const zhNormFlat = normalizeAutoHomeName(zhNorm);
      const candidates = findInCatalog(zhNormFlat, allSeries, nameToIds, normToIds);
      if (candidates.length > 0) seriesId = pickBestCandidate(candidates, v, allSeries);
    }

    // 策略3: 英文标准化匹配
    if (!seriesId && enNorm && enNorm !== zhNorm) {
      const enNormFlat = normalizeAutoHomeName(enNorm);
      const candidates = findInCatalog(enNormFlat, allSeries, nameToIds, normToIds);
      if (candidates.length > 0) seriesId = pickBestCandidate(candidates, v, allSeries);
    }

    // 策略4: 模糊匹配 + 品牌约束
    if (!seriesId) {
      const candidates = fuzzyMatch(zhRaw, enRaw, zhNorm, enNorm, v.brand, allSeries);
      if (candidates.length > 0) seriesId = pickBestCandidate(candidates, v, allSeries);
    }

    if (seriesId) {
      matches.push({ vehicle, seriesId, method: 'match' });
    } else {
      unmatched.push(vehicle);
    }
  }

  console.log(`  ✅ 匹配成功: ${matches.length}`);
  console.log(`  ❌ 未匹配: ${unmatched.length}`);

  if (unmatched.length > 0 && unmatched.length < 50) {
    const list = unmatched.map(v => `${v.data.names.zh} (${v.data.slug}) [${v.data.brand}]`);
    console.log('  未匹配车型:');
    list.forEach(l => console.log(`    - ${l}`));
  }

  return { matches, unmatched };
}

function findInCatalog(query, allSeries, nameToIds, normToIds) {
  // 精确查找
  if (nameToIds.has(query)) return [{ id: nameToIds.get(query), name: query }];

  const candidates = [];

  // 标准化匹配
  if (normToIds.has(query)) {
    for (const c of normToIds.get(query)) {
      candidates.push(c);
    }
  }

  // 包含关系查找
  for (const s of allSeries) {
    const sn = normalizeAutoHomeName(s.name);
    if (sn.includes(query) || query.includes(sn)) {
      candidates.push({ id: s.seriesId, name: s.name });
    }
  }

  return candidates;
}

function fuzzyMatch(zhRaw, enRaw, zhNorm, enNorm, brand, allSeries) {
  const candidates = [];
  const brandKeywords = BRAND_NAME_MAP[brand] || [brand];
  const searchNames = [zhRaw, enRaw, zhNorm, enNorm].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  for (const s of allSeries) {
    const sn = normalizeAutoHomeName(s.name);
    // 检查品牌是否匹配
    const brandMatch = brandKeywords.some(bk =>
      s.name.includes(bk) || sn.toLowerCase().includes(bk.toLowerCase())
    );
    if (!brandMatch) continue;

    // 检查车型名匹配
    for (const query of searchNames) {
      if (!query) continue;
      const qn = normalizeAutoHomeName(query);
      if (qn.length < 2) continue;

      if (sn.includes(qn) || qn.includes(sn)) {
        candidates.push({ id: s.seriesId, name: s.name });
        break;
      }

      // 数字+字母模式匹配（如 M5、L6、SU7）
      if (qn.length <= 6 && sn.endsWith(qn)) {
        candidates.push({ id: s.seriesId, name: s.name });
        break;
      }

      // 逐个字比较（中文）
      if (/[一-鿿]/.test(qn) && qn.length >= 2) {
        const chars = qn.split('');
        const matchCount = chars.filter(c => sn.includes(c)).length;
        if (matchCount >= chars.length * 0.6 && chars.length >= 2) {
          candidates.push({ id: s.seriesId, name: s.name });
          break;
        }
      }
    }
  }

  return candidates;
}

function pickBestCandidate(candidates, vehicle, allSeries) {
  if (candidates.length === 0) return null;

  // 去重
  const unique = [];
  const seen = new Set();
  for (const c of candidates) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      unique.push(c);
    }
  }

  if (unique.length === 1) return unique[0].id;

  // 选名称最短的（最精确）
  unique.sort((a, b) => a.name.length - b.name.length);
  return unique[0].id;
}

// ============ 步骤3: 爬取单张图片URL ============
async function getImageUrlFromPage(seriesId, specId, imgId) {
  const url = `https://www.autohome.com.cn/cars/imgs-${seriesId}-${specId}-1-x/${imgId}.html`;

  try {
    const resp = await fetchWithRetry(url);
    if (!resp) return null;
    const html = await resp.text();

    // 提取: >https://x.autoimg.cn/cardfs/product/.../<
    // 图片 URL 格式: car{num}.autoimg.cn/cardfs/product/{path}/{sizeOpt}_autohomecar__{hash}.jpg

    // 匹配所有可能的图片URL
    const patterns = [
      /(https?:\/\/car\d+\.autoimg\.cn\/[^"'\s<>]+\.(?:jpg|webp|png))/gi,
      /src="(https?:\/\/\S+?autoimg\.cn\/\S+?\.(?:jpg|webp|png))"/gi,
    ];

    let urls = [];
    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        urls = matches
          .map(m => m.replace(/^src="|"$/g, ''))
          .filter(u => !u.includes('/image.png') && !u.includes('weather_blank'));
      }
    }

    if (urls.length === 0) return null;

    // 选择最大的图片
    // URL可能包含尺寸前缀如 1400x1050_
    const sizedUrls = urls.filter(u => /\d+x\d+/.test(u));
    const bestUrl = sizedUrls.length > 0 ? sizedUrls[0] : urls[urls.length - 1];

    // 过滤掉非车型图片（二维码、图标等）
    if (!bestUrl) return null;
    if (bestUrl.includes('pcm/image') || bestUrl.includes('m/img/image') ||
        bestUrl.includes('qrcode') || bestUrl.includes('icon') ||
        bestUrl.includes('logo')) {
      return null;
    }

    // 确保获取最高分辨率版本
    return bestUrl.replace(/\/[^/]+_autohomecar__/, `/${MAX_SIZE_PX}x${MAX_SIZE_PX}_0__autohomecar__`);
  } catch (e) {
    return null;
  }
}

// ============ 步骤4: 爬取车系的图片列表 ============
async function scrapeSeriesImages(seriesId, count = IMAGES_PER_VEHICLE) {
  const imageUrls = [];

  // 先从外观照(category=1)的photolist获取图片ID
  const photoUrl = `https://car.autohome.com.cn/photolist/series/${seriesId}/1/p1/`;

  try {
    const resp = await fetchWithRetry(photoUrl);
    if (!resp) return imageUrls;
    const html = await resp.text();

    // 提取所有 imgs 链接中的参数
    // /cars/imgs-{series}-{spec}-{type}-x/{imgId}.html
    const imgLinkRegex = /\/cars\/imgs-\d+-(\d+)-\d+-x\/(\d+)\.html/g;
    let match;
    const candidates = [];

    while ((match = imgLinkRegex.exec(html)) !== null) {
      const specId = parseInt(match[1]);
      const imgId = parseInt(match[2]);
      if (!candidates.find(c => c.imgId === imgId)) {
        candidates.push({ specId, imgId });
      }
      if (candidates.length >= count * 3) break; // 多取一些作为备选
    }

    // 逐个获取真实图片URL
    for (const { specId, imgId } of candidates) {
      if (imageUrls.length >= count) break;

      const imgUrl = await getImageUrlFromPage(seriesId, specId, imgId);
      if (imgUrl && !imageUrls.includes(imgUrl)) {
        imageUrls.push(imgUrl);
        console.log(`    📷 [${imageUrls.length}/${count}] ${imgUrl.substring(0, 80)}...`);
      }

      await sleep(DELAY_MS);
    }

  } catch (e) {
    console.log(`    ⚠ 爬取出错: ${e.message}`);
  }

  return imageUrls;
}

// ============ 步骤5: 下载图片 ============
async function downloadImage(url, destPath) {
  try {
    const resp = await fetchWithRetry(url);
    if (!resp) return false;

    const buffer = Buffer.from(await resp.arrayBuffer());

    // 用 sharp 优化并转 webp
    try {
      const sharp = (await import('sharp')).default;
      await sharp(buffer)
        .resize(800, 600, { fit: 'inside', background: { r: 248, g: 250, b: 252, alpha: 1 } })
        .webp({ quality: 82 })
        .toFile(destPath.replace('.webp', '.webp'));
      return true;
    } catch {
      // sharp 不可用则直接保存为 jpg
      fs.writeFileSync(destPath.replace('.webp', '.jpg'), buffer);
      return true;
    }
  } catch (e) {
    return false;
  }
}

// ============ 更新 JSON 引用 ============
function updateVehicleImages(vehicleFile, newImages) {
  const filePath = path.join(VEHICLES_DIR, vehicleFile);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const oldImages = [...data.images];
  // 用新图片替换，保留旧SVG作为后备
  const updated = [];
  for (let i = 0; i < 4; i++) {
    if (i < newImages.length) {
      updated.push(newImages[i]);
    } else if (i < oldImages.length) {
      updated.push(oldImages[i]);
    }
  }

  data.images = updated;
  fs.writeFileSync(filePath, JSON.stringify(data) + '\n');

  return { oldImages, newImages: updated, changed: true };
}

// ============ 主流程 ============
async function main() {
  console.log('🚗 PowerNowAuto - 汽车之家图片爬虫\n');
  console.log(`模式: ${UPDATE_ONLY ? '仅更新引用' : '完整爬取'}`);
  if (LIMIT < Infinity) console.log(`限制: 前 ${LIMIT} 款车型`);
  if (ONLY_BRANDS) console.log(`品牌: ${ONLY_BRANDS.join(', ')}`);

  // 加载项目车型
  const vehicleFiles = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'));
  let vehicles = vehicleFiles.map(f => ({
    file: f,
    data: JSON.parse(fs.readFileSync(path.join(VEHICLES_DIR, f), 'utf-8')),
  }));

  if (ONLY_BRANDS) {
    vehicles = vehicles.filter(v => ONLY_BRANDS.includes(v.data.brand));
  }
  if (LIMIT < Infinity) {
    vehicles = vehicles.slice(0, LIMIT);
  }

  console.log(`📦 目标车型: ${vehicles.length} 款\n`);

  if (UPDATE_ONLY) {
    // 仅扫描已有真实图片并更新 JSON
    let updatedCount = 0;
    for (const vehicle of vehicles) {
      const brandDir = path.join(IMAGES_DIR, vehicle.data.brand);
      const newImages = [];

      for (let i = 0; i < 4; i++) {
        const num = String(i + 1).padStart(2, '0');
        const basePath = path.join(brandDir, `${vehicle.data.slug}-${num}`);

        let found = false;
        for (const ext of ['.webp', '.jpg', '.jpeg', '.png']) {
          if (fs.existsSync(basePath + ext)) {
            newImages.push(`/images/vehicles/${vehicle.data.brand}/${vehicle.data.slug}-${num}${ext}`);
            found = true;
            break;
          }
        }
        if (!found && vehicle.data.images[i]) {
          newImages.push(vehicle.data.images[i]);
        }
      }

      if (newImages.length > 0 && newImages.join() !== vehicle.data.images.join()) {
        updateVehicleImages(vehicle.file, newImages);
        updatedCount++;
        console.log(`  ✓ ${vehicle.data.names.zh}: ${newImages.filter(i => !i.includes('.svg')).length} 张真实图片`);
      }
    }
    console.log(`\n✅ 已更新 ${updatedCount} 个车型的图片引用`);
    return;
  }

  // 步骤1: 构建汽车之家目录
  const catalog = await buildAutohomeCatalog();

  // 步骤2: 匹配车型
  const { matches, unmatched } = matchVehicles(vehicles, catalog);

  // 更新映射文件
  catalog.matches = matches.length;
  catalog.unmatched = unmatched.map(v => v.data.names.zh);
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(catalog, null, 2));

  console.log(`\n📋 步骤3: 爬取图片 (${matches.length} 款已匹配车型)\n`);

  const report = { success: [], failed: [], skipped: [] };
  let globalIdx = 0;

  // 串行处理，控制频率
  for (const { vehicle, seriesId } of matches) {
    globalIdx++;
    const v = vehicle.data;
    const brandDir = path.join(IMAGES_DIR, v.brand);

    if (!fs.existsSync(brandDir)) {
      fs.mkdirSync(brandDir, { recursive: true });
    }

    console.log(`[${globalIdx}/${matches.length}] ${v.names.zh} (seriesId=${seriesId})`);

    // 检查是否已有真实图片
    const existingImages = [];
    for (let i = 0; i < 4; i++) {
      const num = String(i + 1).padStart(2, '0');
      for (const ext of ['.webp', '.jpg', '.jpeg', '.png']) {
        const p = path.join(brandDir, `${v.slug}-${num}${ext}`);
        if (fs.existsSync(p)) {
          existingImages.push(`/images/vehicles/${v.brand}/${v.slug}-${num}${ext}`);
          break;
        }
      }
    }

    if (existingImages.length >= 4) {
      console.log('  ⏭ 已有完整图片，跳过');
      report.skipped.push({ slug: v.slug, name: v.names.zh });
      continue;
    }

    // 爬取图片
    const imgUrls = await scrapeSeriesImages(seriesId, IMAGES_PER_VEHICLE);

    if (imgUrls.length === 0) {
      console.log('  ❌ 未获取到图片');
      report.failed.push({ slug: v.slug, name: v.names.zh, seriesId });
      // 仍更新 JSON 中有图片的部分
      if (existingImages.length > 0) {
        updateVehicleImages(vehicle.file, existingImages);
      }
      continue;
    }

    // 下载图片
    const newImagePaths = [...existingImages];
    let downloaded = 0;

    for (const imgUrl of imgUrls) {
      if (newImagePaths.length >= 4) break;

      const num = String(newImagePaths.length + 1).padStart(2, '0');
      // 如果已存在，跳过
      const destPath = path.join(brandDir, `${v.slug}-${num}.webp`);

      const success = await downloadImage(imgUrl, destPath);
      if (success) {
        newImagePaths.push(`/images/vehicles/${v.brand}/${v.slug}-${num}.webp`);
        downloaded++;
      }

      await sleep(DELAY_MS);
    }

    // 更新 JSON
    if (newImagePaths.length > 0) {
      updateVehicleImages(vehicle.file, newImagePaths);
      console.log(`  ✅ 共 ${newImagePaths.length} 张图片 (新增 ${downloaded})`);
      report.success.push({
        slug: v.slug,
        name: v.names.zh,
        seriesId,
        images: newImagePaths,
      });
    }

    // 控制间隔
    await sleep(DELAY_MS * 2);
  }

  // 保存报告
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 爬取完成');
  console.log(`   成功: ${report.success.length}`);
  console.log(`   失败: ${report.failed.length}`);
  console.log(`   跳过: ${report.skipped.length}`);
  console.log(`   未匹配: ${unmatched.length}`);
  console.log(`\n📄 详细报告: ${REPORT_FILE}`);
  console.log(`📄 未匹配车型: 代码中已打印`);
  console.log('='.repeat(60));
}

main().catch(e => {
  console.error('❌ 错误:', e.message);
  console.error(e.stack);
});
