import { topics } from '../src/registry.js';

const headings = new Map();
const totals = {
  topics: 0,
  withArticle: 0,
  missing: 0,
  totalSections: 0,
  short: 0,
  long: 0,
  hasHowToRead: 0,
  hasStudyNext: 0,
  noHeading: 0,
  noPara: 0,
};
const bad = [];

const wordCount = (str) => String(str ?? '').trim().split(/\s+/).filter(Boolean).length;

for (const entry of topics.filter((topic) => topic.type === 'visualization')) {
  totals.topics += 1;
  try {
    const module = await import(`../src/topics/${entry.id}.js`);
    const article = module.article;

    if (!article || !Array.isArray(article.sections)) {
      bad.push({ id: entry.id, reason: 'missing article sections' });
      totals.missing += 1;
      continue;
    }

    const sections = article.sections;
    totals.withArticle += 1;

    if (sections.length === 0) {
      bad.push({ id: entry.id, reason: 'empty article' });
      continue;
    }

    if (sections.some((section) => /^How to read the animation$/i.test(String(section.heading || '')))) {
      totals.hasHowToRead += 1;
    }

    if (sections.some((section) => /^study next$/i.test(String(section.heading || '')))) {
      totals.hasStudyNext += 1;
    }

    totals.totalSections += sections.length;

    for (const section of sections) {
      const heading = String(section.heading || '').trim();
      headings.set(heading, (headings.get(heading) ?? 0) + 1);

      if (!heading) {
        totals.noHeading += 1;
      }

      if (!Array.isArray(section.paragraphs) || section.paragraphs.length === 0) {
        totals.noPara += 1;
        continue;
      }

      if (section.paragraphs.some((p) => wordCount(p) < 35)) {
        totals.short += 1;
      }
      if (section.paragraphs.some((p) => wordCount(p) > 220)) {
        totals.long += 1;
      }
    }
  } catch (error) {
    bad.push({ id: entry.id, reason: error.message });
  }
}

console.log(JSON.stringify({
  totals,
  topHeadings: [...headings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
  bad: bad.slice(0, 30),
}, null, 2));
