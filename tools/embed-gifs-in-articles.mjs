#!/usr/bin/env node
// Embed animation GIF references into each topic's article.
// - If "How to read the animation" section exists: insert GIF image block into it.
// - If section is missing: add it as the first article section with GIF.
//
// Usage: node tools/embed-gifs-in-articles.mjs [--dry-run]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOPICS_DIR = path.join(ROOT, 'src', 'topics');
const GIF_DIR = path.join(ROOT, 'assets', 'gifs');
const dryRun = process.argv.includes('--dry-run');

let updated = 0;
let sectionAdded = 0;
let skipped = 0;
let noGif = 0;

const files = fs.readdirSync(TOPICS_DIR)
  .filter(f => f.endsWith('.js') && !f.includes('case-study'));

for (const file of files) {
  const topicId = file.replace('.js', '');
  const filePath = path.join(TOPICS_DIR, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  const gifPath = path.join(GIF_DIR, `${topicId}.gif`);
  if (!fs.existsSync(gifPath)) {
    noGif++;
    continue;
  }

  if (content.includes(`assets/gifs/${topicId}.gif`)) {
    skipped++;
    continue;
  }

  const topicName = topicId.replace(/-/g, ' ');
  const gifBlock = `{type: 'image', src: './assets/gifs/${topicId}.gif', alt: 'Animated walkthrough of the ${topicName} visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}`;

  const sectionPattern = /heading:\s*['"`]How to read the animation['"`],\s*paragraphs:\s*\[/;
  const match = sectionPattern.exec(content);

  if (match) {
    // Section exists — insert GIF block at end of paragraphs array
    const startIdx = match.index + match[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < content.length && depth > 0) {
      if (content[i] === '[' || content[i] === '{') depth++;
      else if (content[i] === ']' || content[i] === '}') depth--;
      if (content[i] === "'" || content[i] === '"' || content[i] === '`') {
        const quote = content[i];
        i++;
        while (i < content.length && content[i] !== quote) {
          if (content[i] === '\\') i++;
          i++;
        }
      }
      i++;
    }

    if (depth !== 0) {
      console.error(`  [PARSE FAIL] ${topicId}: Could not find end of paragraphs array`);
      continue;
    }

    const insertPos = i - 1;
    const gifInsert = `\n        ${gifBlock},`;
    content = content.slice(0, insertPos) + gifInsert + content.slice(insertPos);
    updated++;
  } else {
    // Section missing — add as first section in article.sections array
    const sectionsPattern = /sections:\s*\[/;
    const sectionsMatch = sectionsPattern.exec(content);

    if (!sectionsMatch) {
      console.error(`  [NO ARTICLE] ${topicId}: No article.sections found`);
      continue;
    }

    const insertPos = sectionsMatch.index + sectionsMatch[0].length;
    const newSection = `\n    {\n      heading: 'How to read the animation',\n      paragraphs: [\n        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',\n        ${gifBlock},\n      ],\n    },`;

    content = content.slice(0, insertPos) + newSection + content.slice(insertPos);
    sectionAdded++;
  }

  if (!dryRun) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

console.log(`\nResults:`);
console.log(`  GIF inserted into existing section: ${updated}`);
console.log(`  New section added with GIF: ${sectionAdded}`);
console.log(`  Already had GIF reference: ${skipped}`);
console.log(`  No GIF file found: ${noGif}`);
if (dryRun) console.log(`  (dry run — no files written)`);
