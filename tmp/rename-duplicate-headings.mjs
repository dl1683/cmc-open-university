import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { learningTracks } from './src/tracks.js';

const trackIds = [...new Set(learningTracks.flatMap((track) => track.modules.flatMap((m) => m.topicIds)))];
let filesUpdated = 0;
let totalReplacements = 0;

function normalizeHeading(v) {
  return String(v || '').trim().replace(/\s*\(\d+\)\s*$/, '').trim();
}

for (const id of trackIds) {
  const filePath = path.join('src', 'topics', `${id}.js`);
  if (!fs.existsSync(filePath)) continue;

  let text = fs.readFileSync(filePath, 'utf8');
  const marker = 'export const article =';
  const start = text.indexOf(marker);
  if (start === -1) continue;

  const startBrace = text.indexOf('{', start);
  if (startBrace === -1) continue;

  const endBrace = (() => {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = startBrace; i < text.length; i++) {
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
        if (!escaped && ch === '\\') { escaped = true; continue; }
        if (!escaped && ch === "'") inSingle = false;
        if (escaped) escaped = false;
        continue;
      }
      if (inDouble) {
        if (!escaped && ch === '\\') { escaped = true; continue; }
        if (!escaped && ch === '"') inDouble = false;
        if (escaped) escaped = false;
        continue;
      }
      if (inTemplate) {
        if (!escaped && ch === '\\') { escaped = true; continue; }
        if (!escaped && ch === '`') inTemplate = false;
        if (escaped) escaped = false;
        continue;
      }

      if (ch === '/' && next === '/') { inLineComment = true; i += 1; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
      if (ch === "'") { inSingle = true; continue; }
      if (ch === '"') { inDouble = true; continue; }
      if (ch === '`') { inTemplate = true; continue; }

      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  })();

  if (endBrace === -1) continue;

  const before = text.slice(0, startBrace);
  const articleBlock = text.slice(startBrace, endBrace + 1);
  const after = text.slice(endBrace + 1);

  const headingRegex = /(heading:\s*)([`'`])([\s\S]*?)\2/g;
  const replacements = [];
  const seen = new Map();
  let match;

  while ((match = headingRegex.exec(articleBlock)) !== null) {
    const raw = String(match[3] || '').trim();
    if (!raw) continue;
    const base = normalizeHeading(raw);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    if (count > 1) {
      const replacement = `${match[1]}${match[2]}${base} (${count})${match[2]}`;
      replacements.push({ start: match.index, end: headingRegex.lastIndex, replacement });
    }
  }

  if (replacements.length === 0) continue;

  totalReplacements += replacements.length;
  let rebuilt = '';
  let cursor = 0;
  for (const rep of replacements) {
    rebuilt += articleBlock.slice(cursor, rep.start);
    rebuilt += rep.replacement;
    cursor = rep.end;
  }
  rebuilt += articleBlock.slice(cursor);

  filesUpdated += 1;
  text = before + rebuilt + after;
  fs.writeFileSync(filePath, text, 'utf8');
}

console.log(`files_updated=${filesUpdated}`);
console.log(`total_replacements=${totalReplacements}`);
