import { topics } from './src/registry.js';
import fs from 'node:fs';

const canons = {
  'How to read the animation': ['how to read', 'animation notes', 'animation guide', 'how this animation', 'visual notes', 'what this visual proves', 'the visual is'],
  'Why this exists': ['why this exists', 'why this topic exists', 'what is', 'what it is', 'the problem', 'what this topic', 'why this technique', 'why this data structure'],
  'The obvious approach': ['obvious approach', 'naive approach', 'reasonable first', 'baseline', 'first attempt', 'tempting', 'simple approach', 'the obvious'],
  'The wall': ['wall', 'where it breaks', 'wall and', 'why it fails', 'failure', 'failing'],
  'The core insight': ['core insight', 'core idea', 'core mechanism', 'trick', 'the trick', 'key insight', 'invariant', 'contract', 'layout'],
  'How it works': ['how it works', 'mechanism', 'how does', 'how it does', 'how the', 'workflow', 'operation', 'process', 'algorithm'],
  'Why it works': ['why it works', 'why it is correct', 'correctness', 'proof', 'safety', 'invariant', 'monotonic', 'exchange', 'induction', 'cut property'],
  'Cost and behavior': ['cost', 'complexity', 'tradeoff', 'tradeoffs', 'time', 'space', 'performance', 'behavior', 'asymptotic', 'growth', 'efficiency', 'overhead', 'memory'],
  'Real-world uses': ['real-world', 'real world', 'where it wins', 'where it is useful', 'production', 'used in', 'use cases', 'in use', 'use case'],
  'Where it fails': ['where it fails', 'pitfalls', 'misconceptions', 'limitations', 'limits', 'failure modes', 'wrong tool', 'not right', 'when it breaks'],
  'Worked example': ['worked example', 'concrete example', 'case study', 'example case', 'step-by-step example'],
  'Study next': ['study next', 'next to read', 'what to study next', 'sources', 'next'],
};

const normalize = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function mapHeading(raw) {
  const compact = normalize(raw);

  if (!compact) return null;
  for (const [canonical, pats] of Object.entries(canons)) {
    for (const pat of pats) {
      if (compact.includes(pat)) {
        // guard: avoid classifying 'why this exists' from 'what it is' etc
        if (canonical === 'Why it works' && compact.startsWith('why this')) continue;
        return canonical;
      }
    }
  }

  if (compact === 'what it is') return 'Why this exists';
  if (compact === 'what it is for') return 'Why this exists';
  if (compact === 'the mechanism') return 'How it works';
  if (compact === 'where it works') return 'Real-world uses';
  if (compact === 'where it matters') return 'Real-world uses';
  if (compact === 'where it could fail' || compact === 'where it might fail') return 'Where it fails';
  if (compact === 'where it wins' || compact === 'where this is useful') return 'Real-world uses';
  if (compact === 'how the mechanism works') return 'How it works';
  if (compact === 'costs and tradeoffs' || compact === 'tradeoffs') return 'Cost and behavior';

  return null;
}

const source = new Set();
let totalMissing = 0;
let totalTopics = 0;

for (const entry of topics) {
  if (entry.type !== 'visualization') continue;
  totalTopics += 1;
  const mod = await entry.module();
  const file = `src/topics/${entry.id}.js`;
  const text = fs.readFileSync(file, 'utf8');
  const re = /heading:\s*([`\"'])(.*?)\1/g;
  const headings = Array.from(text.matchAll(re)).map((m)=>m[2]);
  const mapped = headings.map((h) => mapHeading(h));
  const seen = new Set(mapped.filter(Boolean).map((h)=>h.toLowerCase()));
  const required = [
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
    'Study next',
  ];
  const misses = required.filter((h) => !seen.has(h.toLowerCase()));
  if (misses.length) {
    totalMissing += 1;
    if (totalMissing <= 20) {
      console.log(`${entry.id} -> ${misses.join(', ')}`);
      console.log(`  raw: ${headings.slice(0, 12).join(' | ')}`);
    }
  }
}
console.log(`topics ${totalTopics}`);
console.log(`missing required ${totalMissing}`);
