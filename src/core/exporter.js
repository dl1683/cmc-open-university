// Video export: replays a topic's steps onto a canvas and records it with
// the browser's own MediaRecorder — no libraries, no server. The result is
// a shareable WebM with the explanation text and watermark baked into
// every frame. Recording happens in real time at the chosen speed.

import { renderStep } from './visualizer.js';

export const WATERMARK = 'CMC Open University';
const SITE_URL = 'dl1683.github.io/cmc-open-university';

// Fixed light palette: a shared video must look right everywhere,
// independent of the viewer's theme.
const C = {
  bg: '#f6f8fb', panel: '#ffffff', line: '#d7dee8',
  text: '#18202e', muted: '#5d6b7d', accent: '#1769e0',
};

const W = 1280;
const H = 720;

export function supportsVideoExport() {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export async function exportVideo({ steps, title, speed = 1, onProgress = () => {} }) {
  const stepMs = Math.max(400, Math.round(5000 / speed));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9' : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
  const finished = new Promise((resolve) => { recorder.onstop = resolve; });

  recorder.start(1000);
  for (let i = 0; i < steps.length; i += 1) {
    onProgress(`Recording step ${i + 1}/${steps.length}…`);
    const image = await stepImage(steps[i]);
    drawFrame(ctx, steps[i], image, i, steps.length, title);
    await sleep(stepMs);
  }
  await sleep(400); // let the last frame register
  recorder.stop();
  await finished;
  return new Blob(chunks, { type: 'video/webm' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ------------------------------------------------------------ internals

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Render the step's SVG offscreen, freeze its CSS into inline styles
// (an <img> can't see the stylesheet), and rasterize it.
async function stepImage(step) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;';
  document.body.appendChild(host);
  try {
    renderStep(host, step);
    const svgEl = host.querySelector('svg');
    inlineStyles(svgEl);
    const viewBox = svgEl.getAttribute('viewBox').split(' ').map(Number);
    svgEl.setAttribute('width', viewBox[2]);
    svgEl.setAttribute('height', viewBox[3]);
    const markup = new XMLSerializer().serializeToString(svgEl);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    host.remove();
  }
}

const STYLE_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
  'opacity', 'font-family', 'font-size', 'font-weight',
  'text-anchor', 'dominant-baseline',
];

function inlineStyles(svgEl) {
  for (const el of [svgEl, ...svgEl.querySelectorAll('*')]) {
    const computed = getComputedStyle(el);
    let css = '';
    for (const prop of STYLE_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value) css += `${prop}:${value};`;
    }
    el.setAttribute('style', css);
  }
}

function drawFrame(ctx, step, image, index, total, title) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // header: title left, watermark top-right (always on, every frame)
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.text;
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText(title, 40, 54);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.muted;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(WATERMARK, W - 40, 54);

  // explanation block: measure first, then draw bg, then text
  const exY0 = 72;
  ctx.textAlign = 'left';
  ctx.font = '24px system-ui, sans-serif';
  let y = measureWrapText(ctx, step.explanation, W - 112, 34, 4, exY0 + 32);
  if (step.invariant) {
    ctx.font = 'italic 20px system-ui, sans-serif';
    y = measureWrapText(ctx, `Invariant: ${step.invariant}`, W - 112, 26, 2, y + 6);
  }
  const exH = y - exY0 + 12;
  ctx.fillStyle = '#e8f0fb';
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  roundRect(ctx, 40, exY0, W - 80, exH, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.text;
  ctx.font = '24px system-ui, sans-serif';
  y = wrapText(ctx, step.explanation, 56, exY0 + 32, W - 112, 34, 4);
  if (step.invariant) {
    ctx.fillStyle = C.accent;
    ctx.font = 'italic 20px system-ui, sans-serif';
    y = wrapText(ctx, `Invariant: ${step.invariant}`, 56, y + 6, W - 112, 26, 2);
  }

  // visualization panel
  const panelTop = Math.max(y + 18, 252);
  const panel = { x: 40, y: panelTop, w: W - 80, h: H - panelTop - 56 };
  ctx.fillStyle = C.panel;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 12);
  ctx.fill();
  ctx.stroke();

  const pad = 18;
  const scale = Math.min(
    (panel.w - pad * 2) / image.width,
    (panel.h - pad * 2) / image.height,
    2.2,
  );
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, panel.x + (panel.w - dw) / 2, panel.y + (panel.h - dh) / 2, dw, dh);

  // footer: step counter left, site URL right
  ctx.fillStyle = C.muted;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`Step ${index + 1} of ${total}`, 40, H - 22);
  ctx.textAlign = 'right';
  ctx.fillText(SITE_URL, W - 40, H - 22);
  ctx.textAlign = 'left';
}

function measureWrapText(ctx, text, maxWidth, lineHeight, maxLines, startY) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  let y = startY;
  for (let i = 0; i < words.length; i += 1) {
    const attempt = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines += 1;
      if (lines === maxLines) return y + lineHeight;
      y += lineHeight;
      line = words[i];
    } else {
      line = attempt;
    }
  }
  if (line) y += lineHeight;
  return y;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i += 1) {
    const attempt = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines += 1;
      if (lines === maxLines) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = words[i];
    } else {
      line = attempt;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
