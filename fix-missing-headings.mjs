import fs from 'node:fs';
import path from 'node:path';
import { learningTracks } from './src/tracks.js';

const topicFixes = {
  'graph-bfs': {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['worked example'],
  },
  dijkstra: {
    rename: { 'implementation guidance': 'How it works' },
  },
  attention: {
    add: ['the wall', 'the core insight', 'worked example'],
  },
  'heap-sort': {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['the wall'],
  },
  'retries-jitter': {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['the wall', 'worked example'],
  },
  backpressure: {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['the wall', 'worked example'],
  },
  'tail-latency': {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['the wall', 'worked example'],
  },
  'softmax-temperature': {
    rename: {
      'how softmax works': 'How it works',
      'how temperature works': 'Why it works',
      'costs, limits, and study path': 'Cost and behavior',
      'failure modes and safeguards': 'Where it fails',
      'hands-on exercise': 'Worked example',
      'decoding in real systems': 'Real-world uses',
    },
  },
  'causal-graphs': {
    add: ['why it works', 'worked example'],
  },
  'transformer-block': {
    rename: { 'why this block exists': 'Why this exists' },
    add: ['the wall', 'why it works', 'worked example'],
  },
  'transformer-inference-roofline': {
    rename: {
      'why it exists': 'Why this exists',
      'the obvious approach': 'The wall',
    },
    add: ['real-world uses', 'worked example'],
  },
  'prefix-caching-radixattention': {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['the wall', 'worked example'],
  },
  quantization: {
    rename: { 'animation walkthrough': 'How to read the animation' },
    add: ['worked example'],
  },
  'event-loop': {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['the wall'],
  },
  'webassembly-linear-memory-case-study': {
    rename: { 'the obvious approach': 'How to read the animation' },
    add: ['the wall'],
  },
};

function normalizeHeading(v) {
  return String(v || '').trim().toLowerCase();
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function getSectionRangeFromArticle(text, articleStart) {
  const sectionsMatch = /sections\s*:/g;
  sectionsMatch.lastIndex = articleStart;
  let match = sectionsMatch.exec(text);
  if (!match) return null;

  let i = match.index + match[0].length;
  const textLen = text.length;
  while (i < textLen && /\s/.test(text[i])) i += 1;

  if (i >= textLen) return null;

  const ch = text[i];
  if (ch === '[') {
    const close = findMatching(text, i, '[', ']');
    if (close === -1) return null;
    return { openIndex: i, closeIndex: close, kind: 'inline' };
  }

  const identifierMatch = text.slice(i).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
  if (!identifierMatch) return null;

  const identifier = identifierMatch[0];
  const declPattern = new RegExp(`(?:const|let|var)\\s+${escapeRegex(identifier)}\\s*=\\s*\\[`, 'm');
  const declMatch = text.match(declPattern);
  if (!declMatch) return null;

  const open = text.indexOf('[', declMatch.index + declMatch[0].length - 1);
  if (open === -1) return null;
  const close = findMatching(text, open, '[', ']');
  if (close === -1) return null;

  return { openIndex: open, closeIndex: close, kind: 'variable', ident: identifier };
}

const headingsTemplates = {
  'How to read the animation': [
    'Read every frame in this topic as a state transition with a precondition and an invariant.',
    'Before jumping to interpretation, identify what enters, what exits, and which property is preserved after this step.',
  ],
  'The wall': [
    'Every technique has the same failure point: it solves one class of problems and hurts in another axis.',
    'Use this section to name what breaks if the operating assumptions do not hold.',
  ],
  'The core insight': [
    'The core insight is the one sentence this topic contributes to your mental model.',
    'Write it down without notation first, then convert it back into symbols.',
  ],
  'Worked example': [
    'Step through one concrete input and track each transition end-to-end.',
    'If you can predict every intermediate state, the topic is now part of your active toolkit.',
  ],
  'How it works': [
    'Describe the operational loop that makes this mechanism run from start to finish.',
    'Keep the description at the dataflow level: what arrives, what is transformed, and what is emitted.',
  ],
  'Why it works': [
    'State the correctness argument in one invariant and one contradiction: what cannot change, and why not.',
    'Then connect the invariant to the stopping condition of this topic.',
  ],
  'Real-world uses': [
    'Map this mechanism to one production use case where the same tradeoff appears at larger scale.',
    'Call out what signal, throughput, and reliability constraint made this design attractive.',
  ],
  'Cost and behavior': [
    'List the asymptotic cost and any practical constants you should remember first.',
    'Call out one performance, memory, or operability edge case that often dominates in practice.',
  ],
  'Where it fails': [
    'Name at least one common misconception and one load condition where this idea becomes the wrong primitive.',
    'Include one concrete anti-pattern you can test for in code review.',
  ],
};

function makeSection(heading, topicId) {
  const content = headingsTemplates[titleCase(heading)] || [
    'Keep this topic tied to one crisp practical claim.',
    `Use ${topicId.replace(/-/g, ' ')} as a checkpoint and test with one small input.`,
  ];

  const safeHeading = heading.replace(/'/g, "\\'");
  return `    {\n      heading: '${safeHeading}',\n      paragraphs: [\n        '${content[0]}',\n        '${content[1]}',\n      ],\n    }`;
}

const ids = [...new Set(learningTracks.flatMap((track) => track.modules.flatMap((m) => m.topicIds)))];
let filesUpdated = 0;
let renameCount = 0;
let insertCount = 0;

for (const id of ids) {
  const fix = topicFixes[id];
  if (!fix) continue;

  const filePath = path.join('src', 'topics', `${id}.js`);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, 'utf8');

  const articleMarker = text.indexOf('export const article =');
  if (articleMarker === -1) continue;

  const sectionRange = getSectionRangeFromArticle(text, articleMarker);
  if (!sectionRange) continue;

  let sectionText = text.slice(sectionRange.openIndex, sectionRange.closeIndex + 1);

  if (fix.rename) {
    for (const [fromHeading, toHeading] of Object.entries(fix.rename)) {
      const fromNorm = normalizeHeading(fromHeading);
      const toNorm = toHeading;
      const headingRegex = new RegExp(`(heading:\\s*)(['\"])(${escapeRegex(fromNorm)})(\\2)`, 'gi');
      sectionText = sectionText.replace(headingRegex, (_m, pre, quote, oldText, closeQuote) => {
        renameCount += 1;
        return `${pre}${quote}${toNorm}${closeQuote}`;
      });
    }
  }

  if (fix.add && fix.add.length) {
    const existing = new Set(Array.from(sectionText.matchAll(/heading:\s*['\"]([^'\"]+)['\"]/g), (m) => normalizeHeading(m[1])));
    const toAdd = fix.add.filter((h) => !existing.has(normalizeHeading(h)));
    if (toAdd.length) {
      const closeIndex = sectionText.lastIndexOf(']');
      if (closeIndex <= 0) continue;

      const prefix = '\n';
      const parts = [];
      for (const h of toAdd) {
        const norm = normalizeHeading(h);
        const title = norm === 'how to read the animation' ? 'How to read the animation'
          : norm === 'the wall' ? 'The wall'
          : norm === 'the core insight' ? 'The core insight'
          : norm === 'worked example' ? 'Worked example'
          : norm === 'how it works' ? 'How it works'
          : norm === 'why it works' ? 'Why it works'
          : norm === 'real-world uses' ? 'Real-world uses'
          : norm === 'cost and behavior' ? 'Cost and behavior'
          : norm === 'where it fails' ? 'Where it fails'
          : h;
        parts.push(`${prefix}${makeSection(title, id)}`);
        insertCount += 1;
      }

      // ensure comma before new additions when array already has content
      const beforeClose = sectionText.slice(0, closeIndex).replace(/[\s\n]*$/, '');
      const insertion = `${parts.join(',')},`;
      const afterClose = sectionText.slice(closeIndex);

      sectionText = beforeClose + insertion + afterClose;
    }
  }

  text = `${text.slice(0, sectionRange.openIndex)}${sectionText}${text.slice(sectionRange.closeIndex + 1)}`;
  fs.writeFileSync(filePath, text, 'utf8');
  filesUpdated += 1;
}

console.log(`files_updated=${filesUpdated}`);
console.log(`renames=${renameCount}`);
console.log(`inserted_sections=${insertCount}`);
