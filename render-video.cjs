/**
 * Render hu-yang-video.html to MP4 using Playwright's built-in video recording.
 *
 * This produces a smooth, real-time video by recording the browser viewport.
 *
 * Run: node render-video.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/powernowauto/public';
const HTML_FILE = path.join(ROOT, 'hu-yang-video.html');
const OUTPUT_VIDEO = path.join(ROOT, 'hu-yang-powernow-video.mp4');
const OUTPUT_WEBM = path.join(ROOT, 'hu-yang-powernow-video.webm');

const SCENE_DURATION = 5; // seconds per scene
const TRANSITION_DURATION = 0.65; // CSS transition time
const TOTAL_SCENES = 8;
const WIDTH = 1920;
const HEIGHT = 1080;

// Total: 8 scenes * 5s + 7 transitions * 0.65s + 2s buffer = ~46.6s
const TOTAL_DURATION = TOTAL_SCENES * SCENE_DURATION + (TOTAL_SCENES - 1) * TRANSITION_DURATION + 3;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Launching Chromium headless...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: ROOT,
      size: { width: WIDTH, height: HEIGHT },
    },
  });

  const page = await context.newPage();

  const fileUrl = `file:///${HTML_FILE.replace(/\\/g, '/')}`;
  console.log(`📄 Loading: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for initial animations (scene 1 fade-ins take up to 1.5s)
  console.log('⏳ Waiting for initial animations...');
  await delay(2000);

  // Now auto-advance through all scenes using JavaScript in the page
  console.log('🎬 Playing through all scenes...\n');

  for (let sceneIdx = 1; sceneIdx < TOTAL_SCENES; sceneIdx++) {
    console.log(`   Scene ${sceneIdx + 1}/${TOTAL_SCENES} — holding ${SCENE_DURATION}s...`);

    // Click the next dot to trigger transition
    await page.evaluate((idx) => {
      const dots = document.querySelectorAll('.dot');
      if (dots[idx]) {
        dots[idx].click();
      }
    }, sceneIdx);

    // Wait for CSS transition to finish
    await delay(TRANSITION_DURATION * 1000 + 100);

    // Hold on this scene
    await delay(SCENE_DURATION * 1000);
  }

  // Wait a bit on the last scene
  console.log('   Final scene — holding...');
  await delay(2000);

  console.log('\n💾 Saving video...');
  await context.close();
  await browser.close();

  // Playwright saves as .webm by default
  // Find the recorded video file
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.webm'));
  const recordedFile = files.sort((a, b) => {
    return fs.statSync(path.join(ROOT, b)).mtime - fs.statSync(path.join(ROOT, a)).mtime;
  })[0];

  if (recordedFile) {
    const srcPath = path.join(ROOT, recordedFile);
    // Copy to output name
    fs.copyFileSync(srcPath, OUTPUT_WEBM);
    console.log(`\n✅ Video exported successfully!`);
    console.log(`   📁 ${OUTPUT_WEBM}`);
    const stats = fs.statSync(OUTPUT_WEBM);
    console.log(`   📏 ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   ⏱️  ~${Math.round(TOTAL_DURATION)} seconds`);

    // Clean up the auto-named file
    try { fs.unlinkSync(srcPath); } catch {}

    console.log(`\n🎉 Done! Open the video file to view.`);
  } else {
    console.log('⚠️  Could not find recorded video file. Check the directory.');
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
