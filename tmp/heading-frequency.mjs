import fs from 'node:fs';
import path from 'node:path';
import { topics } from './src/registry.js';

const normalize = (text) => String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ').trim();
const counts = new Map();

for (const entry of topics) {
  if (entry.type !== 'visualization') continue;
  const modulePath = `src/topics/${entry.id}.js`;
  const source = fs.readFileSync(modulePath, 'utf8');
  const re = /heading:\s*([`"'])((?:\\.|(?!\1).)*)\1/g;
  let match;
  while ((match = re.exec(source))) {
    const value = match[2];
    if (!value) continue;
    const key = normalize(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
}

const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([heading, count]) => `${count}\t${heading}`);
const outPath = path.join('tmp', 'heading-frequency.txt');
fs.mkdirSync('tmp', { recursive: true });
fs.writeFileSync(outPath, rows.join('\n'));
console.log(`UNIQUE\t${counts.size}`);
console.log(`WROTE\t${outPath}`);
