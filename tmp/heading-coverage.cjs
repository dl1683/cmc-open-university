const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('src/topics').filter((f) => f.endsWith('.js'));
const canonical = [
  'why this exists',
  'the obvious approach',
  'the wall',
  'the core insight',
  'how it works',
  'why it works',
  'cost and complexity',
  'real-world uses',
  'where it fails',
  'worked example',
  'sources and study next',
  'how to read the animation',
];

const aliases = {
  'why this exists': [
    'what it is', 'the problem', 'problem', 'why this topic exists', 'why it matters', 'why it matters',
    'the real problem', 'this topic is for', 'this topic exists', 'what it solves',
  ],
  'the obvious approach': [
    'the obvious approach and the wall', 'the obvious approach and wall', 'the obvious approach and its wall',
    'the naive approach', 'naive approach', 'the naive design', 'the naive baseline',
    'the naive baseline and wall', 'the baseline approach', 'the baseline and the wall',
    'obvious approach', 'the naive attempt', 'the reasonable first attempt', 'the tempting wrong answer',
  ],
  'the wall': [
    'the wall', 'failure modes', 'limits', 'limits and failure modes', 'failure modes and limits',
    'where it fails', 'where it fails', 'where it matters and fails', 'uses and failure modes',
    'costs and failure modes', 'where it is useful and where it fails', 'failure modes and misconceptions',
    'pitfalls and misconceptions', 'common misconceptions', 'limitations',
  ],
  'the core insight': [
    'core insight', 'core idea', 'core invariant', 'invariant', 'the core idea', 'core mechanism',
    'the mechanism', 'core data structures', 'mechanism',
  ],
  'how it works': [
    'how it works', 'how the mechanism works', 'mechanics', 'how the system works',
    'the mechanism and data structures', 'how the algorithm works', 'how the visual model works',
  ],
  'why it works': [
    'why it works', 'the design works', 'the design works', 'why this topic works', 'why this method works',
    'the design principle', 'reliability argument', 'correctness', 'proof and safety',
  ],
  'cost and complexity': [
    'cost and tradeoffs', 'costs and tradeoffs', 'cost behavior', 'costs and complexity',
    'costs and tradeoff', 'real-world costs', 'cost and behavior',
  ],
  'real-world uses': [
    'where it wins', 'where it matters', 'where it fits', 'where it works', 'real-world uses',
    'real uses', 'practical use', 'use cases', 'production uses', 'practical cases', 'where it is useful',
    'where it is useful and where it fails',
  ],
  'where it fails': [
    'where it fails', 'failure modes', 'limits', 'limitations', 'pitfalls', 'misconceptions',
    'failure modes to test', 'concrete failures',
  ],
  'worked example': [
    'worked example', 'a worked example', 'concrete example', 'worked case', 'worked case study',
    'a worked case', 'concrete case study',
  ],
  'sources and study next': [
    'study next', 'study next', 'what to study next', 'sources and study next', 'sources and Study Next',
    'what to watch next', 'what to study next', 'next up',
  ],
  'how to read the animation': [
    'how to read the animation', 'how to read the visualization', 'how to read the visual model',
    'reading the visualization', 'the visual model teaches it', 'the visual is proving',
    'what the animation shows', 'what the visual teaches', 'animation guide',
    'animation notes', 'how the visual model teaches it', 'the visual model',
  ],
};

const aliasToCanonical = new Map();
for (const [canonicalName, names] of Object.entries(aliases)) {
  aliasToCanonical.set(canonicalName, canonicalName);
  for (const n of names) aliasToCanonical.set(n, canonicalName);
}

function normalizeHeading(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const totals = new Map();
const missing = [];

for (const f of files) {
  const source = fs.readFileSync(`src/topics/${f}`, 'utf8');
  const re = /heading:\s*['"]([^'"]+)['"]/g;
  let m;
  let set = new Set();
  while ((m = re.exec(source)) !== null) {
    const key = normalizeHeading(m[1]);
    const canonical = aliasToCanonical.get(key);
    if (canonical) {
      set.add(canonical);
    } else if (key && /^read|visual|animation|how it/i.test(key)) {
      // keep unknown visual headings as covered for read section
      set.add('how to read the animation');
    }
  }
  const missingInTopic = canonical.filter((c) => !set.has(c));
  if (missingInTopic.length > 4) {
    missing.push({ file: f, missingCount: missingInTopic.length, missing: missingInTopic, present: set.size });
  }
  totals.set(f, set.size);
}

missing.sort((a, b) => b.missingCount - a.missingCount || a.file.localeCompare(b.file));
console.log('topics missing >4 canonical sections:', missing.length);
for (const row of missing.slice(0, 80)) {
  console.log(`${row.file}\t${row.missingCount}\t${row.present}`);
  console.log('   '+row.missing.join(' | '));
}

const presentBuckets = Array.from({ length: 13 }, () => 0);
for (const c of totals.values()) {
  presentBuckets[c] += 1;
}
for (let i = 0; i < presentBuckets.length; i += 1) {
  if (presentBuckets[i]) console.log(i, presentBuckets[i]);
}
