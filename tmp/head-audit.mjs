import { topics } from '../src/registry.js';

const canonical = [
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
  'Study next',
];

const normalize = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let total = 0;
let missingCount = 0;

for (const entry of topics) {
  if (entry.type !== 'visualization') continue;
  total += 1;
  try {
    const mod = await entry.module();
    const seen = new Set((mod.article?.sections ?? []).map((s) => normalize(s.heading)));
    const missing = canonical.filter((h) => !seen.has(normalize(h)));
    if (missing.length > 0) {
      missingCount += 1;
      console.log(`${entry.id}\t${missing.join(' | ')}`);
    }
  } catch (error) {
    missingCount += 1;
    console.log(`ERR\t${entry.id}\t${error.message}`);
  }
}

console.log(`TOTAL\t${total}\tMISSING\t${missingCount}`);
