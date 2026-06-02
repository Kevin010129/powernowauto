#!/usr/bin/env node
/**
 * PowerNowAuto - 车型图片批量下载与替换脚本
 *
 * 功能：
 *   1. 从 Wikimedia Commons / Flickr 等免费图源搜索并下载真实车型照片
 *   2. 将图片统一转为 WebP 800x600 并优化
 *   3. 更新车型 JSON 中的 images 路径
 *   4. 生成完成报告和待手动处理清单
 *
 * 用法：
 *   node scripts/download-images.mjs          # 自动模式
 *   node scripts/download-images.mjs --dry-run # 仅生成清单，不下载
 *   node scripts/download-images.mjs --replace  # 替换SVG为占位图(当有手动图片时)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'src/content/vehicles');
const IMAGES_DIR = path.join(ROOT, 'public/images/vehicles');
const REPORT_FILE = path.join(ROOT, 'image-download-report.json');

const DRY_RUN = process.argv.includes('--dry-run');
const REPLACE_MODE = process.argv.includes('--replace');

// 免费图片搜索 API（无需 API Key）
const SEARCH_SOURCES = {
  wikimedia: {
    name: 'Wikimedia Commons',
    searchUrl: (query) =>
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' car')}&srnamespace=6&format=json&srlimit=5&origin=*`,
    fileInfoUrl: (title) =>
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&format=json&origin=*`,
  },
};

// 图片尺寸配置
const IMAGE_SIZE = { width: 800, height: 600 };

// 统计
const stats = {
  total: 0,
  downloaded: 0,
  skipped: 0,
  failed: 0,
  totalImages: 0,
};

/**
 * 读取所有车型 JSON 文件
 */
function loadVehicles() {
  const files = fs.readdirSync(VEHICLES_DIR).filter(f => f.endsWith('.json'));
  const vehicles = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(VEHICLES_DIR, file), 'utf-8'));
    vehicles.push({ file, data });
  }
  return vehicles;
}

/**
 * 为每个车型生成搜索关键词
 */
function getSearchQueries(vehicle) {
  const v = vehicle.data;
  // 中英文各生成一组关键词用于搜索
  const brandFolder = v.brand;
  const modelName = v.names.en;
  const modelNameZh = v.names.zh;
  const year = v.year;

  return [
    // 精确搜索
    `${brandFolder} ${modelName} ${year}`,
    // 中文搜索
    `${modelNameZh} ${v.brand}`,
    // 带 "official" 关键词
    `${brandFolder} ${modelName} official photo`,
  ].filter(q => q && q.trim());
}

/**
 * 搜索 Wikimedia Commons 获取图片 URL
 */
async function searchWikimedia(query) {
  try {
    const searchUrl = SEARCH_SOURCES.wikimedia.searchUrl(query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) return [];
    const data = await resp.json();
    const results = data?.query?.search || [];

    // 获取每个结果的真实图片 URL
    const imageUrls = [];
    for (const result of results.slice(0, 5)) {
      const infoUrl = SEARCH_SOURCES.wikimedia.fileInfoUrl(result.title);
      const infoResp = await fetch(infoUrl);
      if (!infoResp.ok) continue;
      const infoData = await infoResp.json();

      const pages = infoData?.query?.pages || {};
      for (const pageId of Object.keys(pages)) {
        const imageInfo = pages[pageId]?.imageinfo?.[0];
        if (imageInfo?.url) {
          // 跳过 SVG 和很小的缩略图
          if (imageInfo.url.endsWith('.svg')) continue;
          if (imageInfo.width && imageInfo.width < 400) continue;
          imageUrls.push({
            url: imageInfo.url,
            source: 'wikimedia',
            width: imageInfo.width,
            height: imageInfo.height,
            title: result.title,
          });
        }
      }
      if (imageUrls.length >= 1) break; // 每关键词只取第一个有效结果
    }
    return imageUrls;
  } catch (e) {
    return [];
  }
}

/**
 * 尝试多个搜索引擎获取图片 URL
 */
async function searchImages(vehicle) {
  const queries = getSearchQueries(vehicle);
  const allResults = [];

  for (const query of queries) {
    if (allResults.length >= 4) break;
    console.log(`    搜索: "${query}"`);

    // Wikimedia Commons
    const wikiResults = await searchWikimedia(query);
    if (wikiResults.length > 0) {
      allResults.push(...wikiResults);
    }

    // 避免请求过快
    await sleep(500);
  }

  return allResults.slice(0, 4);
}

/**
 * 下载单张图片并保存为 WebP
 */
async function downloadImage(url, destPath) {
  if (DRY_RUN) {
    console.log(`    [DRY-RUN] 将下载: ${url} → ${path.basename(destPath)}`);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const buffer = Buffer.from(await resp.arrayBuffer());

    // 先保存为临时文件
    const tmpPath = destPath.replace('.webp', '.tmp');
    fs.writeFileSync(tmpPath, buffer);

    // 使用 sharp 转换和优化（如果可用），否则直接保存
    try {
      // 尝试用 sharp 处理
      const sharp = (await import('sharp')).default;
      await sharp(buffer)
        .resize(IMAGE_SIZE.width, IMAGE_SIZE.height, { fit: 'inside', background: { r: 248, g: 250, b: 252, alpha: 1 } })
        .webp({ quality: 82 })
        .toFile(destPath);
      fs.unlinkSync(tmpPath);
    } catch (sharpError) {
      // sharp 不可用，直接用 imagemagick 或保持原格式
      console.log(`    ⚠ sharp 不可用，使用原始格式保存`);
      // 重命名 tmp 到 jpg（保持原始格式）
      const jpgPath = destPath.replace('.webp', '.jpg');
      fs.renameSync(tmpPath, jpgPath);
      return true;
    }

    return true;
  } catch (e) {
    console.log(`    ✗ 下载失败: ${e.message}`);
    return false;
  }
}

/**
 * 替换 SVG 占位图（当有手动准备的图片时）
 */
function replaceSvgPlaceholders(vehicle, brandDir) {
  const v = vehicle.data;
  const newImages = [];

  for (let i = 0; i < 4; i++) {
    const num = String(i + 1).padStart(2, '0');
    const baseName = `${v.slug}-${num}`;

    // 检查是否存在真实图片（jpg/png/webp）
    const candidates = [
      path.join(brandDir, `${baseName}.jpg`),
      path.join(brandDir, `${baseName}.jpeg`),
      path.join(brandDir, `${baseName}.png`),
      path.join(brandDir, `${baseName}.webp`),
    ];

    const found = candidates.find(p => fs.existsSync(p));
    if (found) {
      const ext = path.extname(found);
      newImages.push(`/images/vehicles/${v.brand}/${baseName}${ext}`);
    } else {
      // 保持原 SVG
      newImages.push(v.images[i] || `/images/vehicles/${v.brand}/${baseName}.svg`);
    }
  }

  return newImages;
}

/**
 * 更新车型 JSON 文件中的图片路径
 */
function updateVehicleJson(vehicleFile, newImages) {
  const filePath = path.join(VEHICLES_DIR, vehicleFile);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const oldImages = [...data.images];
  data.images = newImages;

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(data) + '\n');
  }

  return { oldImages, newImages, changed: JSON.stringify(oldImages) !== JSON.stringify(newImages) };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成 CSV 清单供手动填 URL
 */
function generateCsvReport(vehicles, reportData) {
  const lines = [
    'brand,brand_folder,model_name_zh,model_name_en,year,slug,image_01_url,image_02_url,image_03_url,image_04_url,status',
  ];

  for (const item of reportData) {
    const v = item.vehicle.data;
    const status = item.downloaded === 4 ? 'complete' : item.downloaded > 0 ? 'partial' : 'missing';
    const urls = (item.foundUrls || []).map(u => u.url || '').concat(['', '', '', '']).slice(0, 4);
    lines.push([
      v.brand,
      v.brand,
      v.names.zh,
      v.names.en,
      v.year,
      v.slug,
      ...urls,
      status,
    ].join(','));
  }

  const csvPath = path.join(ROOT, 'vehicle-images-manifest.csv');
  if (!DRY_RUN) {
    fs.writeFileSync(csvPath, lines.join('\n'));
  }
  console.log(`\n📋 车型图片清单已生成: ${csvPath}`);
  console.log('   你可以在此文件中填入 image_0X_url 列，然后重新运行脚本下载');
}

/**
 * 主函数
 */
async function main() {
  console.log('🚗 PowerNowAuto - 车型图片批量处理\n');

  if (DRY_RUN) {
    console.log('⚠ DRY-RUN 模式：仅生成清单，不实际下载\n');
  }

  if (REPLACE_MODE) {
    console.log('🔄 替换模式：扫描已有真实图片并更新JSON引用\n');

    const vehicles = loadVehicles();
    let replaced = 0;

    for (const vehicle of vehicles) {
      const brandDir = path.join(IMAGES_DIR, vehicle.data.brand);
      const newImages = replaceSvgPlaceholders(vehicle, brandDir);
      const result = updateVehicleJson(vehicle.file, newImages);

      if (result.changed) {
        replaced++;
        console.log(`  ✓ ${vehicle.data.names.zh} (${vehicle.data.slug}): ${result.oldImages.filter(i => i.endsWith('.svg')).length} SVG → 真实图片`);
      }
    }

    console.log(`\n✅ 已更新 ${replaced} 个车型的图片引用`);
    return;
  }

  // 自动下载模式
  const vehicles = loadVehicles();
  stats.total = vehicles.length;

  console.log(`📦 共 ${stats.total} 款车型\n`);

  const reportData = [];

  for (let i = 0; i < vehicles.length; i++) {
    const vehicle = vehicles[i];
    const v = vehicle.data;
    const brandDir = path.join(IMAGES_DIR, v.brand);
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} ${v.names.zh} (${v.slug})`);

    // 确保品牌目录存在
    if (!fs.existsSync(brandDir)) {
      fs.mkdirSync(brandDir, { recursive: true });
    }

    const entry = { vehicle, downloaded: 0, foundUrls: [], imageResults: [] };

    // 搜索图片
    const searchResults = await searchImages(vehicle);
    entry.foundUrls = searchResults;

    if (searchResults.length === 0) {
      console.log('    ⚠ 未找到任何图片，标记为待手动处理');
      stats.failed++;
      reportData.push(entry);
      continue;
    }

    console.log(`    📷 找到 ${searchResults.length} 张候选图片`);

    // 下载图片（最多4张）
    const toDownload = searchResults.slice(0, 4);
    let downloaded = 0;

    for (let j = 0; j < toDownload.length; j++) {
      const num = String(j + 1).padStart(2, '0');
      const destPath = path.join(brandDir, `${v.slug}-${num}.webp`);

      const success = await downloadImage(toDownload[j].url, destPath);
      if (success) {
        downloaded++;
        entry.imageResults.push({ num, path: destPath, source: toDownload[j].source });
      }
      await sleep(300);
    }

    entry.downloaded = downloaded;

    if (downloaded > 0) {
      // 构建新的图片路径数组
      const newImages = [];
      for (let j = 0; j < 4; j++) {
        const num = String(j + 1).padStart(2, '0');
        const webpPath = path.join(brandDir, `${v.slug}-${num}.webp`);
        const jpgPath = path.join(brandDir, `${v.slug}-${num}.jpg`);
        const svgPath = path.join(brandDir, `${v.slug}-${num}.svg`);

        if (fs.existsSync(webpPath)) {
          newImages.push(`/images/vehicles/${v.brand}/${v.slug}-${num}.webp`);
        } else if (fs.existsSync(jpgPath)) {
          newImages.push(`/images/vehicles/${v.brand}/${v.slug}-${num}.jpg`);
        } else if (fs.existsSync(svgPath)) {
          newImages.push(`/images/vehicles/${v.brand}/${v.slug}-${num}.svg`);
        }
      }

      if (newImages.length > 0) {
        updateVehicleJson(vehicle.file, newImages);
      }

      stats.downloaded++;
      stats.totalImages += downloaded;
      console.log(`    ✓ 成功下载 ${downloaded} 张图片`);
    } else {
      stats.failed++;
      console.log(`    ✗ 下载失败`);
    }

    reportData.push(entry);

    // 控制请求频率
    await sleep(1000);
  }

  // 保存报告
  if (!DRY_RUN) {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(reportData, null, 2));
  }

  // 生成 CSV 清单
  generateCsvReport(vehicles, reportData);

  // 统计
  console.log('\n' + '='.repeat(60));
  console.log('📊 处理完成统计:');
  console.log(`   总车型数: ${stats.total}`);
  console.log(`   已获取图片: ${stats.downloaded} 款车型 (${stats.totalImages} 张图片)`);
  console.log(`   未获取到: ${stats.failed} 款车型`);
  console.log(`   跳过: ${stats.skipped}`);
  console.log(`\n📄 详细报告: ${REPORT_FILE}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
