#!/usr/bin/env node
// Generate animated GIFs for every topic's animation.
// Usage: node tools/generate-gifs.mjs [--concurrency=4] [--filter=topicId]
//
// Requires: playwright (npm), ffmpeg, python3 (for local server).
// Output:   assets/gifs/{topicId}.gif

import { execSync, spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'playwright'));
const sharp = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'openclaw', 'node_modules', 'sharp'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GIF_DIR = path.join(ROOT, 'assets', 'gifs');
const FRAME_DIR = path.join(ROOT, 'assets', '_frames');
const PORT = 8787;
const BASE = `http://localhost:${PORT}`;
const GIF_WIDTH = 480;

const args = process.argv.slice(2);
const concurrency = parseInt((args.find(a => a.startsWith('--concurrency=')) || '').split('=')[1] || '6', 10);
const filterTopic = (args.find(a => a.startsWith('--filter=')) || '').split('=')[1] || '';
const skipExisting = args.includes('--skip-existing');

fs.mkdirSync(GIF_DIR, { recursive: true });
fs.mkdirSync(FRAME_DIR, { recursive: true });

function getTopicIds() {
  return fs.readdirSync(path.join(ROOT, 'src', 'topics'))
    .filter(f => f.endsWith('.js') && !f.includes('case-study'))
    .map(f => f.replace('.js', ''));
}

function startServer() {
  const server = spawn('python', ['-m', 'http.server', String(PORT)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: true,
  });
  return new Promise((resolve) => {
    const onData = () => { resolve(server); };
    server.stderr.on('data', onData);
    server.stdout.on('data', onData);
    setTimeout(() => resolve(server), 2000);
  });
}

// Capture animation frames for a single topic
async function captureTopic(page, topicId) {
  const frameDir = path.join(FRAME_DIR, topicId);
  fs.mkdirSync(frameDir, { recursive: true });

  try {
    await page.goto(`${BASE}/topic.html?topic=${topicId}`, {
      waitUntil: 'networkidle', timeout: 15000,
    });

    await page.waitForSelector('[data-visualization] svg, [data-visualization] canvas', {
      timeout: 8000,
    }).catch(() => {});

    await page.waitForTimeout(600);

    const totalSteps = await page.evaluate(() => {
      const slider = document.querySelector('[data-slider]');
      return slider ? parseInt(slider.max, 10) + 1 : 0;
    });

    if (totalSteps === 0) return null;

    // Capture each frame by screenshotting the .vis-stage element directly
    for (let i = 0; i < totalSteps; i++) {
      await page.evaluate((stepIdx) => {
        const slider = document.querySelector('[data-slider]');
        if (slider) {
          slider.value = stepIdx;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, i);

      await page.waitForTimeout(200);

      const visStage = await page.$('.vis-stage');
      if (visStage) {
        await visStage.screenshot({
          path: path.join(frameDir, `raw-${String(i).padStart(3, '0')}.png`),
          type: 'png',
        });
      }
    }

    return totalSteps;
  } catch (err) {
    console.error(`  [FAIL] ${topicId}: ${err.message}`);
    return null;
  }
}

// Normalize all frames to same dimensions using sharp, then combine with ffmpeg
async function framesToGif(topicId) {
  const frameDir = path.join(FRAME_DIR, topicId);
  const outFile = path.join(GIF_DIR, `${topicId}.gif`);

  const rawFiles = fs.readdirSync(frameDir)
    .filter(f => f.startsWith('raw-') && f.endsWith('.png'))
    .sort();

  if (rawFiles.length === 0) return false;

  try {
    // Find max dimensions across all frames
    let maxW = 0, maxH = 0;
    for (const f of rawFiles) {
      const meta = await sharp(path.join(frameDir, f)).metadata();
      if (meta.width > maxW) maxW = meta.width;
      if (meta.height > maxH) maxH = meta.height;
    }

    // Scale target: GIF_WIDTH wide, proportional height
    const scale = GIF_WIDTH / maxW;
    const targetW = GIF_WIDTH;
    const targetH = Math.ceil(maxH * scale);

    // Normalize each frame: resize + extend (pad) to targetW x targetH
    for (let i = 0; i < rawFiles.length; i++) {
      const input = path.join(frameDir, rawFiles[i]);
      const output = path.join(frameDir, `frame-${String(i).padStart(3, '0')}.png`);
      await sharp(input)
        .resize(targetW, targetH, { fit: 'contain', background: '#ffffff' })
        .png()
        .toFile(output);
    }

    // Generate GIF with ffmpeg two-pass (palette + encode)
    const frameRate = 0.4; // ~2.5s per frame
    const paletteFile = path.join(frameDir, 'palette.png');
    const framePattern = path.join(frameDir, 'frame-%03d.png');

    execFileSync('ffmpeg', [
      '-y', '-framerate', String(frameRate),
      '-i', framePattern,
      '-vf', 'palettegen=max_colors=64',
      paletteFile,
    ], { stdio: 'pipe' });

    execFileSync('ffmpeg', [
      '-y', '-framerate', String(frameRate),
      '-i', framePattern,
      '-i', paletteFile,
      '-lavfi', 'paletteuse=dither=bayer:bayer_scale=3',
      '-loop', '0',
      outFile,
    ], { stdio: 'pipe' });

    return true;
  } catch (err) {
    console.error(`  [GIF FAIL] ${topicId}: ${err.message}`);
    return false;
  }
}

function cleanFrames(topicId) {
  try { fs.rmSync(path.join(FRAME_DIR, topicId), { recursive: true, force: true }); } catch {}
}

async function processBatch(browser, topics) {
  const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
    deviceScaleFactor: 1,
  });

  for (const topicId of topics) {
    if (skipExisting && fs.existsSync(path.join(GIF_DIR, `${topicId}.gif`))) continue;

    const page = await context.newPage();
    const stepCount = await captureTopic(page, topicId);
    await page.close();

    if (stepCount) {
      const ok = await framesToGif(topicId);
      if (ok) {
        const size = (fs.statSync(path.join(GIF_DIR, `${topicId}.gif`)).size / 1024).toFixed(0);
        console.log(`  ✓ ${topicId} (${stepCount} steps, ${size}KB)`);
      }
    }
    cleanFrames(topicId);
  }

  await context.close();
}

async function main() {
  let topicIds = getTopicIds();
  if (filterTopic) topicIds = topicIds.filter(id => id.includes(filterTopic));

  console.log(`Generating GIFs for ${topicIds.length} topics (concurrency=${concurrency})...`);

  const server = await startServer();
  console.log(`Local server started on port ${PORT}`);

  const browser = await chromium.launch({ headless: true });

  const batchSize = Math.ceil(topicIds.length / concurrency);
  const batches = [];
  for (let i = 0; i < topicIds.length; i += batchSize) {
    batches.push(topicIds.slice(i, i + batchSize));
  }

  const startTime = Date.now();
  await Promise.all(batches.map(batch => processBatch(browser, batch)));
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  await browser.close();
  server.kill();
  try { fs.rmSync(FRAME_DIR, { recursive: true, force: true }); } catch {}

  const gifCount = fs.readdirSync(GIF_DIR).filter(f => f.endsWith('.gif')).length;
  console.log(`\nDone! ${gifCount} GIFs generated in ${elapsed} minutes.`);
}

main().catch(err => { console.error(err); process.exit(1); });
