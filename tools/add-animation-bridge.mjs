import { readFileSync, writeFileSync } from 'node:fs';
import { topics } from '../src/registry.js';

const dryRun = process.argv.includes('--dry-run');

const headingRe = /how to read the animation/i;
const insertionHeadings = [
  'How it works',
  'Agent Card discovery',
  'Task state',
  'Protocol shape',
  'Data structures',
  'Core structures',
  'Core data structures',
  'How lookup works',
  'How routing works',
  'Quorum certificates as data structures',
  'DAG mempool as a data structure',
  'Mandates as data structures',
  'Registry and compatibility',
  'Case study: ACT',
  'Case study: CALM',
  'Case study: top-k capacity',
  'Case study: Mixture-of-Depths',
  'Case study: Set Transformer',
  'Case study: Perceiver',
  'Case study: Vision Transformers Need Registers',
  'Why it works',
  'Cost and complexity',
  'Cost and behavior',
  'Real-world uses',
  'Complete case study',
  'Case study',
  'Pitfalls',
  'Failure modes',
  'Study next',
];

function sentence(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '-')
    .trim();
}

function viewSentence(topic) {
  const controls = topic.controls ?? [];
  const select = controls.find((control) => control.type === 'select' && Array.isArray(control.options) && control.options.length > 1);
  if (!select) {
    return 'Start with the initial frame, then follow the active highlights as the state changes.';
  }

  const options = select.options.slice(0, 4).map((option) => `"${sentence(option)}"`).join(', ');
  const more = select.options.length > 4 ? ', and the remaining views' : '';
  return `Use the ${sentence(select.label ?? select.id)} control to compare ${options}${more}; each view isolates a different state transition or tradeoff.`;
}

function bridgeSection(entry, topic) {
  const title = sentence(entry.title ?? topic.title ?? entry.id);
  const summary = sentence(entry.summary ?? topic.summary ?? '');
  const first = summary
    ? `Read the animation as an execution trace for ${title}. ${summary}. ${viewSentence(topic)}`
    : `Read the animation as an execution trace for ${title}. ${viewSentence(topic)}`;
  const second = `Track active and compared items as the live decision. Visited, removed, and found marks are proof: they show what the algorithm or system has ruled out or committed to. After each frame, ask what changed, why it is safe, and where the idea helps or fails.`;

  return [
    '    {',
    "      heading: 'How to read the animation',",
    '      paragraphs: [',
    `        ${JSON.stringify(first)},`,
    `        ${JSON.stringify(second)},`,
    '      ],',
    '    },',
  ].join('\n');
}

function insertBeforeHeading(source, section) {
  for (const heading of insertionHeadings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\n\\s*\\{\\s*(?:\\r?\\n\\s*)?heading: ([\`'])${escaped}\\1,`, 'i');
    const match = source.match(re);
    if (match) {
      return source.slice(0, match.index + 1) + section + source.slice(match.index + 1);
    }
  }
  return null;
}

const changed = [];
const skipped = [];

for (const entry of topics) {
  if (entry.type !== 'visualization') continue;
  const module = await entry.module();
  const sections = module.article?.sections ?? [];
  if (sections.some((section) => headingRe.test(String(section.heading ?? '')))) continue;

  const path = `src/topics/${entry.id}.js`;
  const source = readFileSync(path, 'utf8');
  const section = bridgeSection(entry, module.topic ?? {});
  const next = insertBeforeHeading(source, section);
  if (!next) {
    skipped.push(entry.id);
    continue;
  }

  changed.push(path);
  if (!dryRun) writeFileSync(path, next);
}

console.log(JSON.stringify({ dryRun, changed: changed.length, skipped }, null, 2));
