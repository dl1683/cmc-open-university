#!/usr/bin/env node

import { topics } from '../src/registry.js';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const [key, inlineValue] = arg.slice(2).split('=');
  const next = process.argv[i + 1];
  if (inlineValue !== undefined) args.set(key, inlineValue);
  else if (next && !next.startsWith('--')) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, true);
  }
}

const limit = Number(args.get('limit') ?? 40);
const minWords = Number(args.get('min-words') ?? 1200);
const failAbove = Number(args.get('fail-above') ?? Number.POSITIVE_INFINITY);

const mechanicalPatterns = [
  /Read the animation as an execution trace for/i,
  /Track active and compared items as the live decision/i,
  /Start with the initial frame, then follow the active highlights/i,
];

const proseFogPatterns = [
  /\bdelve\b/i,
  /\bunpack\b/i,
  /\bleverage\b/i,
  /\bharness\b/i,
  /\bunderscore\b/i,
  /\bpivotal\b/i,
  /\bparamount\b/i,
  /\btransformative\b/i,
  /\bgame-changing\b/i,
  /\bcrucial\b/i,
  /\bprofound\b/i,
  /\bthis is (where things get interesting|important|significant)\b/i,
  /\bwith that in mind\b/i,
  /\bnow that we understand\b/i,
  /\bin other words\b/i,
  /\bput differently\b/i,
];

const coverageChecks = [
  { key: 'why', label: 'why/context', pattern: /\b(why this exists|what it is|problem|constraint|history|baseline)\b/i },
  { key: 'wall', label: 'obvious approach/wall', pattern: /\b(obvious|naive|baseline|first attempt|wall|fails?|breaks?)\b/i },
  { key: 'insight', label: 'core insight', pattern: /\b(core insight|invariant|layout|contract|the trick|the idea)\b/i },
  { key: 'mechanism', label: 'mechanism', pattern: /\b(how it works|mechanism|step|compute|update|state|pipeline)\b/i },
  { key: 'correctness', label: 'why it works', pattern: /\b(why it works|correctness|proof|safe|invariant|monotonic|lineariz|exchange|induction)\b/i },
  { key: 'cost', label: 'cost/tradeoff', pattern: /\b(cost|complexity|tradeoff|latency|memory|space|time|throughput|O\(|tax)\b/i },
  { key: 'uses', label: 'real uses', pattern: /\b(real-world|where it wins|production|case study|used in|database|runtime|compiler|browser|model|system)\b/i },
  { key: 'fails', label: 'limits/failure', pattern: /\b(where it fails|pitfall|misconception|failure|wrong tool|limit|hazard|adversarial|stale|fragile)\b/i },
  { key: 'study', label: 'study next', pattern: /\b(study next|sources and study next|next)\b/i },
];

function flattenArticle(article) {
  const sections = article?.sections ?? [];
  return sections.map((section) => {
    const heading = String(section.heading ?? '');
    const paragraphs = (section.paragraphs ?? []).map((paragraph) => String(paragraph));
    return `${heading}\n${paragraphs.join('\n')}`;
  }).join('\n\n');
}

function wordCount(text) {
  return (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) ?? []).length;
}

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

const rows = [];

for (const entry of topics) {
  const mod = await entry.module();
  const articleText = flattenArticle(mod.article);
  const words = wordCount(articleText);
  const sections = mod.article?.sections?.length ?? 0;
  const mechanical = countMatches(articleText, mechanicalPatterns);
  const fog = countMatches(articleText, proseFogPatterns);
  const missing = coverageChecks
    .filter((check) => !check.pattern.test(articleText))
    .map((check) => check.label);

  let score = 0;
  score += Math.max(0, minWords - words);
  score += Math.max(0, 8 - sections) * 100;
  score += mechanical * 500;
  score += fog * 75;
  score += missing.length * 140;

  rows.push({
    id: entry.id,
    title: entry.title,
    category: entry.category,
    score,
    words,
    sections,
    mechanical,
    fog,
    missing,
  });
}

rows.sort((a, b) => b.score - a.score || a.words - b.words || a.id.localeCompare(b.id));

const failing = rows.filter((row) => row.score > 0);
const overThreshold = rows.filter((row) => row.score > failAbove);

console.log(JSON.stringify({
  total: rows.length,
  failing: failing.length,
  minWords,
  failAbove: Number.isFinite(failAbove) ? failAbove : null,
  overThreshold: overThreshold.length,
  worst: rows.slice(0, limit),
}, null, 2));

if (overThreshold.length > 0) {
  process.exitCode = 1;
}
