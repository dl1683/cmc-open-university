import fs from 'node:fs';
import path from 'node:path';
import { learningTracks } from './src/tracks.js';

function findMatching(text, start, open, close) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (!escaped && ch === '\\') {
        escaped = true;
        continue;
      }
      if (!escaped && ch === "'") {
        inSingle = false;
      }
      if (escaped) escaped = false;
      continue;
    }
    if (inDouble) {
      if (!escaped && ch === '\\') {
        escaped = true;
        continue;
      }
      if (!escaped && ch === '"') {
        inDouble = false;
      }
      if (escaped) escaped = false;
      continue;
    }
    if (inTemplate) {
      if (!escaped && ch === '\\') {
        escaped = true;
        continue;
      }
      if (!escaped && ch === '`') {
        inTemplate = false;
      }
      if (escaped) escaped = false;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function normalizeHeading(value) {
  return String(value || '').trim().replace(/\s*\(\d+\)\s*$/, '').trim();
}

const trackIds = [...new Set(learningTracks.flatMap((track) => track.modules.flatMap((m) => m.topicIds)))];
let filesUpdated = 0;
let totalReplacements = 0;

for (const id of trackIds) {
  const filePath = path.join('src', 'topics', `${id}.js`);
  if (!fs.existsSync(filePath)) continue;

  let text = fs.readFileSync(filePath, 'utf8');
  const marker = 'export const article =';
  const start = text.indexOf(marker);
  if (start === -1) continue;

  const open = text.indexOf('{', start);
  if (open === -1) continue;
  const close = findMatching(text, open, '{', '}');
  if (close === -1) continue;

  const before = text.slice(0, open);
  const articleBlock = text.slice(open, close + 1);
  const after = text.slice(close + 1);

  const headingRegex = /(heading:\s*)([`'`])([\s\S]*?)\2/g;
  const seen = new Map();
  const replacements = [];
  let match;

  while ((match = headingRegex.exec(articleBlock)) !== null) {
    const raw = String(match[3] || '').trim();
    if (!raw) continue;
    const base = normalizeHeading(raw);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);

    if (count > 1) {
      const newText = `${match[1]}${match[2]}${base} (${count})${match[2]}`;
      replacements.push({ start: match.index, end: match.index + match[0].length, replacement: newText });
    }
  }

  if (!replacements.length) continue;

  let rebuilt = '';
  let cursor = 0;
  for (const rep of replacements) {
    rebuilt += articleBlock.slice(cursor, rep.start);
    rebuilt += rep.replacement;
    cursor = rep.end;
    totalReplacements += 1;
  }
  rebuilt += articleBlock.slice(cursor);

  filesUpdated += 1;
  text = before + rebuilt + after;
  fs.writeFileSync(filePath, text, 'utf8');
}

console.log(`files_updated=${filesUpdated}`);
console.log(`total_replacements=${totalReplacements}`);
