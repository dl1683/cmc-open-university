import fs from 'node:fs';
import { topics } from '../src/registry.js';

const required = [
  'Why this exists',
  'The obvious approach',
  'The wall',
  'The core insight',
  'How it works',
  'Why it works',
  'Cost and complexity',
  'Real-world uses',
  'Where it fails',
  'Worked example',
  'Sources and study next',
  'How to read the animation',
];

const rows = [];
const headingFrequency = new Map();

for (const entry of topics) {
  if (entry.type !== 'visualization') continue;
  const path = `../src/topics/${entry.id}.js`;
  const text = fs.readFileSync(path, 'utf8');
  const articleMatch = text.match(/export const article\s*=\s*{[\s\S]*?\n};/);

  const sections = [];
  if (articleMatch) {
    const articleText = articleMatch[0];
    const headingRe = /heading:\s*([`'\"])(.*?)\1/g;
    let match;
    while ((match = headingRe.exec(articleText)) !== null) {
      const heading = String(match[2]);
      sections.push(heading);
      headingFrequency.set(heading, (headingFrequency.get(heading) || 0) + 1);
    }
  }

  const normalized = new Set(sections.map((h) => h.toLowerCase().trim()));
  const missing = required.filter((h) => !normalized.has(h.toLowerCase()));

  rows.push({
    id: entry.id,
    sections: sections.length,
    headings: sections,
    missing,
  });
}

rows.sort((a, b) => {
  if (a.sections !== b.sections) return a.sections - b.sections;
  return a.id.localeCompare(b.id);
});

const noSections = rows.filter((row) => row.sections === 0).map((row) => row.id);
console.log(`TOTAL_VISUALIZATIONS=${rows.length}`);
console.log(`NO_SECTIONS=${noSections.length}`);
if (noSections.length) {
  console.log('NO_SECTION_IDS');
  for (const id of noSections) console.log(id);
}

console.log('MISSING_REQUIRED_START');
for (const row of rows.filter((row) => row.missing.length > 0)) {
  console.log(`${row.id}|${row.sections}|${row.missing.join('; ')}`);
}

const top = Array.from(headingFrequency.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
console.log('TOP_HEADINGS_START');
for (const [heading, count] of top.slice(0, 120)) {
  console.log(`${count}\t${heading}`);
}