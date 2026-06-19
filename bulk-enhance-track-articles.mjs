import fs from 'node:fs';
import path from 'node:path';

const TARGET_HEADINGS = [
  'How to read the animation',
  'Why this exists',
  'The obvious approach',
  'The wall',
  'The core insight',
  'How it works',
  'Why it works',
  'Cost and behavior',
  'Real-world uses',
  'Where it fails',
  'Worked example',
  'Sources and study next',
  'Study next',
  'Learning map',
  'Frame-by-frame checkpoints',
  'Micro checks',
  'Try this now',
];

const HEADING_ALIASES = {
  'a worked intuition': 'worked example',
  'a worked example': 'worked example',
  'cost and complexities': 'cost and behavior',
  'cost and complexity': 'cost and behavior',
  'cost and behavior section': 'cost and behavior',
  'cost and complexity section': 'cost and behavior',
  'cost limits and study path': 'cost and behavior',
  'costs limits and study path': 'cost and behavior',
  'costs, limits, and study path': 'cost and behavior',
  'costs, limits and study path': 'cost and behavior',
  'frame by frame checkpoints': 'frame-by-frame checkpoints',
  'frame by frame study plan': 'frame-by-frame checkpoints',
  'frame by frame study points': 'frame-by-frame checkpoints',
  'frame-by-frame study plan': 'frame-by-frame checkpoints',
  'frame-by-frame study points': 'frame-by-frame checkpoints',
  'frame by frame checkpoints and review': 'frame-by-frame checkpoints',
  'how softmax works': 'how it works',
  'how attention works': 'how it works',
  'real world uses': 'real-world uses',
  'realworld uses': 'real-world uses',
  'source and study next': 'sources and study next',
  'sources and historical context': 'sources and study next',
  'sources and study next section': 'sources and study next',
  'study next section': 'study next',
  'study next path': 'sources and study next',
};

function normalizeHeading(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+\d+$/, '')
    .trim();
}

function getAllTopicFiles() {
  const topicsDir = path.join('src', 'topics');
  const files = fs.readdirSync(topicsDir);
  return files
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(topicsDir, file))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

function extractTopicTitle(filePath, fallback) {
  const text = readFile(filePath);
  const match = text.match(/export const title\s*=\s*([`'"])([\s\S]*?)\1/);
  return match ? match[2] : fallback;
}

function canonicalHeading(raw) {
  const normalized = normalizeHeading(raw);
  return HEADING_ALIASES[normalized] ?? normalized;
}

const REQUIRED = TARGET_HEADINGS.map(canonicalHeading);

function escapeForSingleQuote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeForDoubleQuote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isWordChar(value) {
  return /[A-Za-z0-9_$]/.test(value ?? '');
}

function normalizeEscapedWordBoundaries(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && text[i + 1] === "'") {
      const prev = text[i - 1] ?? '';
      const next = text[i + 2] ?? '';
      if (!(isWordChar(prev) && isWordChar(next))) {
        out += "'";
        i += 1;
        continue;
      }
    }
    out += text[i];
  }
  return out;
}

function repairInlineTitleInterpolation(text, topicTitle) {
  const inlinePattern = /\\?([`'"])((?:[^\\]|\\.)*)\\1\s*\+\s*title\s*\+\s*\\?([`'"])((?:[^\\]|\\.)*)\3/g;
  const singleQuotedPattern = /\\?'((?:[^\\]|\\.)*)\\?'\s*\+\s*title\s*\+\s*\\?'((?:[^\\]|\\.)*)\\?'/g;
  const doubleQuotedPattern = /\\"((?:[^\\]|\\.)*)\\"\\s*\+\s*title\s*\+\s*\\"((?:[^\\]|\\.)*)\\"/g;
  const singleEscapedTitle = escapeForSingleQuote(topicTitle);

  const next = text
    .replace(inlinePattern, (_, leftQuote, leftText, rightQuote, rightText) => {
      const safePrefix = leftText.replace(/'/g, "\\'");
      const safeSuffix = rightText.replace(/'/g, "\\'");
      return `'${safePrefix}${singleEscapedTitle}${safeSuffix}'`;
    })
    .replace(singleQuotedPattern, (_, leftText, rightText) => `'${leftText}${singleEscapedTitle}${rightText}'`)
    .replace(doubleQuotedPattern, (_, leftText, rightText) => `"${leftText}${singleEscapedTitle}${rightText}"`);
  return normalizeEscapedWordBoundaries(next);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatching(text, startIndex, open, close) {
  let depth = 0;
  let i = startIndex;
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
      if (!escaped && ch === "'") inSingleQuote = false;
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
      if (!escaped && ch === '"') inDoubleQuote = false;
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
      if (!escaped && ch === '`') inTemplate = false;
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

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function getSectionHeadings(sectionsText) {
  const headingRegex = /heading\s*:\s*(['"`])([\s\S]*?)\1/g;
  const headings = new Set();
  let match;
  while ((match = headingRegex.exec(sectionsText)) !== null) {
    const normalized = canonicalHeading(match[2]);
    if (normalized) headings.add(normalized);
  }
  return headings;
}

function formatSection(text, indent) {
  const lines = text.trimEnd().split('\n');
  return lines.map((line) => `${indent}${line}`.trimEnd()).join('\n');
}

function buildTemplate(topicTitle, heading) {
  const title = topicTitle.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const templates = {
    'how to read the animation': `
{
  heading: 'How to read the animation',
  paragraphs: [
    'Read each step as a claim, not a visual.',
    'Active markers show where the operation is making a decision.',
    'Visited markers show states that are already ruled out.',
    'After each frame, say what changed, what stayed, and why the next frame is legal.',
  ],
},`,
    'why this exists': `
{
  heading: 'Why this exists',
  paragraphs: [
    'This topic exists because the naive approach gets expensive, wrong, or hard to reason about in one or more common case.',
    'The mechanism here solves a concrete constraint: when scale, latency, or correctness requirements rise, the simpler version becomes the bottleneck.',
  ],
},`,
    'the obvious approach': `
{
  heading: 'The obvious approach',
  paragraphs: [
    'The first attempt usually looks natural: use direct storage, direct traversal, or a one-shot exact formula.',
    'It works for small data and few constraints, which is why it feels right at first.',
    'The lesson is not to dismiss it; it is to identify when that same approach spends too much work later.',
  ],
},`,
    'the wall': `
{
  heading: 'The wall',
  paragraphs: [
    'The wall is the hard case: where inputs grow, failures cluster, or guarantees break.',
    'This is where the naive path becomes the wrong path because one hidden cost or one missing invariant dominates everything else.',
    'Name that cost concretely: what state grows, what branch explodes, what must be kept coherent, and where time is actually spent.',
  ],
},`,
    'the core insight': `
{
  heading: 'The core insight',
  paragraphs: [
    'The core idea is one contract you can carry into your own systems and interviews.',
    'The contract replaces ad hoc behavior with a stable invariant and a repeatable decision rule.',
    'For ${title}, that contract is the only thing that makes the animation\\'s local steps connect to global correctness.',
  ],
},`,
    'how it works': `
{
  heading: 'How it works',
  paragraphs: [
    'Break the mechanism into state, update, and decision order.',
    'Each frame should show one invariant and one safe transition.',
    'If you can explain why each local update is mandatory, the mechanism is now portable.',
  ],
},`,
    'why it works': `
{
  heading: 'Why it works',
  paragraphs: [
    'Correctness is a preserved property, not a one-time claim.',
    'If the invariant holds at the start of the frame, and the transition preserves it, then it remains true for the next frame.',
    'Stack this argument across all frames and the mechanism becomes trustworthy, not just attractive.',
  ],
},`,
    'cost and behavior': `
{
  heading: 'Cost and behavior',
  paragraphs: [
    'Now answer what changes when input size doubles: which step dominates, and which memory path becomes the tax.',
    'Track not just asymptotics but constants, cache effects, and what gets serialized, persisted, or recomputed.',
    'This section should leave the reader with one cost model sentence they can reuse in another system.',
  ],
},`,
    'real-world uses': `
{
  heading: 'Real-world uses',
  paragraphs: [
    'This mechanism is useful when one specific constraint repeats across production workloads.',
    'Use it when the same shape keeps appearing: repeated lookups, repeated merges, repeated scheduling, or repeated ranking.',
    'For ${title}, map usage to one real request path, not a generic list of applications.',
  ],
},`,
    'where it fails': `
{
  heading: 'Where it fails',
  paragraphs: [
    'Every mechanism has a tax. No design is free.',
    'Name one non-obvious failure condition and the smallest input that triggers it.',
    'Then use that condition as your stop condition before choosing this approach.',
  ],
},`,
    'worked example': `
{
  heading: 'Worked example',
  paragraphs: [
    'Use one tiny input for ${title} and trace one full pass manually.',
    'If the output changes in the same order as the frame-by-frame view, the concept is now internalized.',
    'If it does not, slow down by one frame and state the transition rule in your own words.',
  ],
},`,
    'sources and study next': `
{
  heading: 'Sources and study next',
  paragraphs: [
    'Read one primary source, one implementation source, and one production case where this idea appears.',
    'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
    'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
  ],
},`,
    'study next': `
{
  heading: 'Study next',
  paragraphs: [
    'Start with a prerequisite topic that removes one missing prerequisite assumption.',
    'Then read one alternative or extension that changes either correctness guarantees, data layout, or operational cost.',
    'Pause and test with one concrete counterexample before moving on.',
  ],
},`,
    'learning map': `
{
  heading: 'Learning map',
  paragraphs: [
    'Before this topic, unlock all prerequisites and define the required preconditions.',
    'After this topic, trace where this idea appears in one larger path on this site.',
    'Use unlock relationships to keep one path and one checkpoint per review cycle.',
  ],
},`,
    'frame-by-frame checkpoints': `
{
  heading: 'Frame-by-frame checkpoints',
  paragraphs: [
    {
      type: 'bullets',
      items: [
        'Pause before each transition and name the invariant that must hold.',
        'After each transition, say what changed and why it stays legal.',
        'Locate the hidden branch, branch order, or update order that drives complexity.',
        'Translate the local change into one reusable rule for a real system.',
      ],
    },
  ],
},`,
    'micro checks': `
{
  heading: 'Micro checks',
  paragraphs: [
    {
      type: 'bullets',
      items: [
        'Can you state one invariant in one sentence?',
        'Can you prove one transition with pre and post state?',
        'Can you name one hidden edge case in one line?',
        'Can you transfer this mechanism to a neighboring domain?',
      ],
    },
  ],
},`,
    'try this now': `
{
  heading: 'Try this now',
  paragraphs: [
    'Build one input manually and predict every step before running the animation.',
    'If your predicted final state matches the animation for ${title}, continue to the next topic in the same track.',
  ],
},`,
  };
  return templates[heading] || '';
}

function getArticleSectionsRange(text) {
  const articleKeyword = 'export const article';
  const articleIndex = text.indexOf(articleKeyword);
  if (articleIndex === -1) return null;

  const articleOpen = text.indexOf('{', articleIndex);
  if (articleOpen === -1) return null;
  const articleClose = findMatching(text, articleOpen, '{', '}');
  if (articleClose === -1) return null;

  const sectionsKeyIndex = text.indexOf('sections', articleOpen);
  if (sectionsKeyIndex === -1 || sectionsKeyIndex > articleClose) return null;
  const colon = text.indexOf(':', sectionsKeyIndex);
  if (colon === -1 || colon > articleClose) return null;

  let scan = colon + 1;
  while (scan < text.length && /\s/.test(text[scan])) scan += 1;
  if (scan >= articleClose) return null;

  const nextChar = text[scan];
  if (nextChar === '[') {
    const sectionsOpen = scan;
    const sectionsClose = findMatching(text, sectionsOpen, '[', ']');
    if (sectionsClose === -1) return null;
    return {
      sectionsOpen,
      sectionsClose,
    };
  }

  const identifierMatch = text.slice(scan).match(/^([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (!identifierMatch) return null;
  const variableName = identifierMatch[1];
  const arrayDecl = new RegExp(`(?:const|let|var)\\s+${escapeRegExp(variableName)}\\s*=\\s*\\[`, 'm');
  const declMatch = text.slice(0, articleClose).match(arrayDecl);
  if (!declMatch) return null;
  const openFromDecl = text.lastIndexOf('[', articleIndex + (declMatch.index ?? 0));
  if (openFromDecl === -1) return null;
  const closeFromDecl = findMatching(text, openFromDecl, '[', ']');
  if (closeFromDecl === -1) return null;
  return { sectionsOpen: openFromDecl, sectionsClose: closeFromDecl };
}

function inferSectionIndent(text, sectionsOpen, sectionsClose) {
  const sectionsBody = text.slice(sectionsOpen + 1, sectionsClose);
  const nestedItemMatch = sectionsBody.match(/(?:^|\n)(\s*)\{/);
  if (nestedItemMatch?.[1]?.trim().length) return nestedItemMatch[1];

  const lineStart = text.slice(0, sectionsOpen).lastIndexOf('\n');
  const linePrefix = lineStart === -1 ? text.slice(0, sectionsOpen) : text.slice(lineStart + 1, sectionsOpen);
  const baseIndent = (linePrefix.match(/^\s*/) || [''])[0];
  return `${baseIndent}  `;
}

function enhanceFile(filePath, topicTitle) {
  const original = readFile(filePath);
  const repairedOriginal = repairInlineTitleInterpolation(original, topicTitle);
  const range = getArticleSectionsRange(repairedOriginal);
  if (!range) {
    if (repairedOriginal !== original) {
      writeFile(filePath, repairedOriginal);
      return { changed: true, reason: 'repaired title references without article block' };
    }
    return { changed: false, reason: 'no article sections block' };
  }

  const { sectionsOpen, sectionsClose } = range;
  const sectionsText = repairedOriginal.slice(sectionsOpen + 1, sectionsClose);
  const existingHeadings = getSectionHeadings(sectionsText);

  const missing = REQUIRED.filter((heading) => !existingHeadings.has(heading));
  if (missing.length === 0) {
    if (repairedOriginal !== original) {
      writeFile(filePath, repairedOriginal);
      return { changed: true, reason: 'repaired title references' };
    }
    return { changed: false, reason: 'all sections present' };
  }

  const sectionIndent = inferSectionIndent(repairedOriginal, sectionsOpen, sectionsClose);
  const itemIndent = `${sectionIndent}  `;

  const insertBlocks = [];
  for (const heading of missing) {
    const template = buildTemplate(topicTitle, heading);
    if (!template) continue;
    insertBlocks.push(formatSection(template, itemIndent));
  }

  if (insertBlocks.length === 0) return { changed: false, reason: 'no templates found' };

  const trimmedBody = sectionsText.trimEnd();
  const needsComma = trimmedBody.length > 0 && !trimmedBody.endsWith(',');
  const insertionText = `${needsComma ? ',' : ''}\n${insertBlocks.join('\n')}\n`;

  const before = repairedOriginal.slice(0, sectionsClose);
  const after = repairedOriginal.slice(sectionsClose);
  const updated = `${before}${insertionText}${after}`;
  writeFile(filePath, updated);
  return { changed: true, reason: `added ${insertBlocks.length} sections` };
}

let updatedCount = 0;
const files = getAllTopicFiles();
for (const filePath of files) {
  const fallbackTitle = path.basename(filePath, '.js');
  const topicTitle = extractTopicTitle(filePath, fallbackTitle);
  const result = enhanceFile(filePath, topicTitle || fallbackTitle);
  if (result.changed) {
    updatedCount += 1;
    const fileName = path.basename(filePath);
    console.log(`${fileName}: ${result.reason}`);
  }
}

console.log(`updated=${updatedCount}`);
