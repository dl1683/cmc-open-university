import { learningTracks } from './src/tracks.js';
import fs from 'node:fs';
import path from 'node:path';

const ids = [...new Set(learningTracks.flatMap((t) => t.modules.flatMap((m) => m.topicIds)))];

function findMatchingBracket(text, start, open, close) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLine = false;
  let inBlock = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inLine) {
      if (ch === '\n') inLine = false;
      continue;
    }
    if (inBlock) {
      if (ch === '*' && text[i + 1] === '/') {
        inBlock = false;
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      if (!escaped && ch === '\\') escaped = true;
      else {
        if (!escaped && ch === "'") inSingle = false;
        escaped = false;
      }
      continue;
    }
    if (inDouble) {
      if (!escaped && ch === '\\') escaped = true;
      else {
        if (!escaped && ch === '"') inDouble = false;
        escaped = false;
      }
      continue;
    }
    if (inTemplate) {
      if (!escaped && ch === '\\') escaped = true;
      else {
        if (!escaped && ch === '`') inTemplate = false;
        escaped = false;
      }
      continue;
    }

    if (ch === '/' && text[i + 1] === '/') {
      inLine = true;
      i += 1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      inBlock = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

for (const id of ids) {
  const file = path.join('src/topics', `${id}.js`);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const sectionsMatch = text.match(/sections\s*:\s*\[/);
  if (!sectionsMatch) continue;
  const sectionsOpen = sectionsMatch.index + text.slice(0, sectionsMatch.index).length + sectionsMatch[0].indexOf('[') + 1;
  const sectionsClose = findMatchingBracket(text, sectionsOpen - 1, '[', ']');
  const arrayBody = text.slice(sectionsOpen, sectionsClose);
  const headings = [...arrayBody.matchAll(/heading\s*:\s*([`'\"])([\s\S]*?)\1/g)]
    .map((m) => m[2].trim().toLowerCase());
  const seen = new Set();
  const duplicates = [];
  for (const h of headings) {
    if (seen.has(h)) duplicates.push(h);
    else seen.add(h);
  }
  if (duplicates.length > 0) {
    console.log(id, [...new Set(duplicates)]);
  }
}
