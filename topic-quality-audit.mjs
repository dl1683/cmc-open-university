import { topics } from './src/registry.js';

const REQUIRED_SECTION_HEADINGS = [
  'How to read the animation',
  'Why this exists',
  'The obvious approach',
  'The wall',
  'The core insight',
  'How it works',
  'Why it works',
  'Cost and behavior',
  'Cost and complexity',
  'Real-world uses',
  'Where it fails',
  'Study next',
  'Sources and study next',
  'Worked example',
  'Learning map',
  'Frame-by-frame checkpoints',
  'Micro checks',
  'Try this now',
];

const HEADING_ALIASES = {
  'cost and complexity': 'cost and behavior',
  'cost and behavior section': 'cost and behavior',
  'cost and complexity section': 'cost and behavior',
  'real use and failures': 'real-world uses',
  'real uses': 'real-world uses',
  'where it fails': 'where it fails',
  'why this exists': 'why this exists',
  'sources and study next': 'sources and study next',
  'frame by frame checkpoints': 'frame-by-frame checkpoints',
  'micro checks': 'micro checks',
  'try this now': 'try this now',
};

function normalizeHeading(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim();
}

function canonicalHeading(raw) {
  const normalized = normalizeHeading(raw);
  return HEADING_ALIASES[normalized] ?? normalized;
}

const required = [...new Set(REQUIRED_SECTION_HEADINGS.map(canonicalHeading))];
const targets = topics.filter((topic) => topic.type === 'visualization');
const missingMap = {};
const counts = {
  ok: 0,
  missing: 0,
  noSections: 0,
  importError: 0,
};

for (const topic of targets) {
  const articlePath = `./src/topics/${topic.id}.js`;
  try {
    const mod = await import(new URL(articlePath, import.meta.url));
    const sections = mod.article?.sections;
    if (!Array.isArray(sections)) {
      missingMap[topic.id] = ['article.missing-sections'];
      counts.noSections += 1;
      continue;
    }

    const present = new Set(sections.map((section) => canonicalHeading(section?.heading)).filter(Boolean));
    const missing = required.filter((name) => !present.has(name));
    if (missing.length === 0) {
      counts.ok += 1;
    } else {
      counts.missing += 1;
      missingMap[topic.id] = missing.map((name) => String(name).replace(/-/g, ' '));
    }
  } catch (error) {
    counts.importError += 1;
    missingMap[topic.id] = ['import-failed'];
  }
}

console.log(`topics=${targets.length}`);
console.log(`ok=${counts.ok}`);
console.log(`missing_sections=${counts.missing}`);
console.log(`no_sections=${counts.noSections}`);
console.log(`import_errors=${counts.importError}`);

for (const [id, entries] of Object.entries(missingMap).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${id}: ${entries.join(', ')}`);
}
