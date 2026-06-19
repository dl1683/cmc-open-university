import fs from 'node:fs';
import path from 'node:path';
import { learningTracks } from './src/tracks.js';

const TRACK_IDS = [...new Set(learningTracks.flatMap((track) => track.modules.flatMap((module) => module.topicIds)))];

const TARGET_HEADING_SET = new Set([
  'learning map',
  'frame-by-frame checkpoints',
  'micro checks',
  'try this now',
].map((value) => normalizeHeading(value)));

function normalizeHeading(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim();
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatching(text, start, open, close) {
  let depth = 0;
  let i = start;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  while (i < text.length) {
    const ch = text[i];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && text[i + 1] === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      if (!escaped && ch === '\\') {
        escaped = true;
        i += 1;
        continue;
      }
      if (!escaped && ch === "'") {
        inSingleQuote = false;
      }
      escaped = false;
      i += 1;
      continue;
    }

    if (inDoubleQuote) {
      if (!escaped && ch === '\\') {
        escaped = true;
        i += 1;
        continue;
      }
      if (!escaped && ch === '"') {
        inDoubleQuote = false;
      }
      escaped = false;
      i += 1;
      continue;
    }

    if (inTemplate) {
      if (!escaped && ch === '\\') {
        escaped = true;
        i += 1;
        continue;
      }
      if (!escaped && ch === '`') {
        inTemplate = false;
      }
      escaped = false;
      i += 1;
      continue;
    }

    if (ch === '/' && text[i + 1] === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && text[i + 1] === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      i += 1;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      i += 1;
      continue;
    }

    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }

    i += 1;
  }

  return -1;
}

function getSectionsArrayRange(text, articleIndex) {
  const eqIndex = text.indexOf('=', articleIndex);
  if (eqIndex === -1) return null;

  const objectOpen = text.indexOf('{', eqIndex);
  if (objectOpen === -1) return null;

  const objectClose = findMatching(text, objectOpen, '{', '}');
  if (objectClose === -1) return null;

  const objectText = text.slice(objectOpen, objectClose + 1);
  const sectionsMatch = objectText.match(/sections\s*:/);
  if (!sectionsMatch) return null;

  const sectionsStart = objectOpen + sectionsMatch.index + sectionsMatch[0].length;
  let cursor = sectionsStart;

  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;

  if (text[cursor] === '[') {
    const sectionsClose = findMatching(text, cursor, '[', ']');
    if (sectionsClose === -1) return null;
    return { sectionsOpen: cursor, sectionsClose, kind: 'inline' };
  }

  const identMatch = text.slice(cursor).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
  if (!identMatch) return null;

  const identifier = identMatch[0];
  const declPattern = new RegExp(`(?:const|let|var)\\s+${escapeRegExp(identifier)}\\s*=\\s*\\[`, 'g');
  const declMatch = text.match(declPattern);
  if (!declMatch) return null;

  const declIndex = text.indexOf(declMatch[0]);
  if (declIndex === -1) return null;

  const arrayOpen = text.indexOf('[', declIndex);
  if (arrayOpen === -1) return null;

  const arrayClose = findMatching(text, arrayOpen, '[', ']');
  if (arrayClose === -1) return null;

  return { sectionsOpen: arrayOpen, sectionsClose: arrayClose, kind: 'variable', identifier };
}

function cleanupSectionsInRange(text, sectionsOpen, sectionsClose) {
  const rangeStart = sectionsOpen + 1;
  const rangeEnd = sectionsClose;
  let i = rangeStart;
  let lastCursor = rangeStart;
  let removed = 0;
  const seen = new Set();
  const keptParts = [];

  while (i < rangeEnd) {
    const ch = text[i];
    if (/\s/.test(ch) || ch === ',') {
      i += 1;
      continue;
    }

    if (text[i] !== '{') {
      i += 1;
      continue;
    }

    const blockStart = i;
    const blockEnd = findMatching(text, i, '{', '}');
    if (blockEnd === -1 || blockEnd >= rangeEnd) {
      i += 1;
      continue;
    }

    let blockClose = blockEnd;
    if (text[blockClose + 1] === ',') blockClose += 1;

    const blockText = text.slice(blockStart, blockEnd + 1);
    const headingMatch = blockText.match(/heading\s*:\s*([`'\"])([\s\S]*?)\1/);
    const heading = headingMatch ? normalizeHeading(headingMatch[2]) : null;

    const isDuplicateTargetHeading = heading && TARGET_HEADING_SET.has(heading) && seen.has(heading);
    if (!isDuplicateTargetHeading) {
      if (heading) seen.add(heading);
      keptParts.push(text.slice(lastCursor, blockStart));
      keptParts.push(text.slice(blockStart, blockClose + 1));
    } else {
      removed += 1;
    }

    lastCursor = blockClose + 1;
    i = blockClose + 1;
  }

  if (removed === 0) return { updated: false, removed: 0, content: text };

  const rebuilt = text.slice(0, rangeStart) + keptParts.join('') + text.slice(lastCursor, rangeEnd) + text.slice(rangeEnd);
  return { updated: true, removed, content: rebuilt };
}

let processed = 0;
let changed = 0;
let removedTotal = 0;

for (const topicId of TRACK_IDS) {
  const filePath = path.join('src', 'topics', `${topicId}.js`);
  if (!fs.existsSync(filePath)) continue;

  let text = readFile(filePath);
  const articleIndex = text.indexOf('export const article');
  if (articleIndex === -1) continue;

  const range = getSectionsArrayRange(text, articleIndex);
  if (!range) continue;

  const result = cleanupSectionsInRange(text, range.sectionsOpen, range.sectionsClose);
  processed += 1;
  if (result.updated) {
    writeFile(filePath, result.content);
    changed += 1;
    removedTotal += result.removed;
    console.log(`${topicId}: removed ${result.removed} duplicate target headings`);
  }
}

console.log(`processed=${processed}`);
console.log(`changed=${changed}`);
console.log(`removed=${removedTotal}`);
