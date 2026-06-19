import { topics } from '../src/registry.js';

const required = [
  'why this exists',
  'obvious',
  'wall',
  'core insight',
  'how it works',
  'why it works',
  'cost',
  'where it wins',
  'where it fails',
  'study next',
];

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function wordCount(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

const report = [];

for (const entry of topics.filter((entry) => entry.type === 'visualization')) {
  const module = await import(`../src/topics/${entry.id}.js`);
  const article = module.article || { sections: [] };
  const sections = Array.isArray(article.sections) ? article.sections : [];

  const lowerHeadings = sections.map((s) => normalizeText(s.heading).toLowerCase());
  const missing = [];
  const hitMap = {};

  for (const req of required) {
    const hit = lowerHeadings.some((h) => h.includes(req));
    hitMap[req] = hit;
    if (!hit) missing.push(req);
  }

  const shortParas = sections.filter((section) => {
    const paras = section.paragraphs || [];
    return paras.length > 0 && paras.every((p) => wordCount(p) < 35);
  }).length;

  const totalParagraphs = sections.reduce((acc, section) => acc + (section.paragraphs?.length || 0), 0);
  const totalWords = sections.flatMap((section) => section.paragraphs || []).reduce((acc, p) => acc + wordCount(p), 0);
  const avgWords = totalParagraphs ? Math.round(totalWords / totalParagraphs) : 0;

  report.push({
    id: entry.id,
    title: entry.title,
    sectionCount: sections.length,
    coverage: required.length - missing.length,
    missing,
    shortParaSections: shortParas,
    avgWords,
    hasHowToRead: lowerHeadings.some((h) => h === 'how to read the animation'),
  });
}

report.sort((a, b) => a.coverage - b.coverage || b.sectionCount - a.sectionCount || a.shortParaSections - b.shortParaSections);
console.log(JSON.stringify(report, null, 2));
