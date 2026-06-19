import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tracksModule = await import(pathToFileURL(path.resolve('src/tracks.js')).href);
const learningTracks = tracksModule.learningTracks;

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

const ids = [...new Set(learningTracks.flatMap((track) => track.modules.flatMap((m) => m.topicIds)))];
let filesChanged = 0;
let fixCount = 0;

for (const id of ids) {
  const filePath = path.join('src', 'topics', `${id}.js`);
  if (!fs.existsSync(filePath)) continue;

  let text = fs.readFileSync(filePath, 'utf8');
  const marker = 'export const article =';
  const articleStart = text.indexOf(marker);
  if (articleStart === -1) continue;

  const braceStart = text.indexOf('{', articleStart);
  if (braceStart === -1) continue;
  const braceEnd = findMatching(text, braceStart, '{', '}');
  if (braceEnd === -1) continue;

  const before = text.slice(0, braceStart);
  const articleBlock = text.slice(braceStart, braceEnd + 1);
  const after = text.slice(braceEnd + 1);

  const repaired = articleBlock.replace(/\n(\s*)\},\r?\n(\s*)heading:/g, (match, indent) => {
    fixCount += 1;
    return `\n${indent}},\n${indent}{\n${indent}  heading:`;
  });

  if (repaired !== articleBlock) {
    filesChanged += 1;
    text = before + repaired + after;
    fs.writeFileSync(filePath, text, 'utf8');
  }
}

console.log(`files_changed=${filesChanged}`);
console.log(`headings_fixes=${fixCount}`);
