import { topics } from '../src/registry.js';

const limitArg = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 40;

const wordCount = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;

const coveragePatterns = [
  { key: 'why', re: /why|exists|problem|need/i },
  { key: 'obvious', re: /obvious|first|naive|simple approach/i },
  { key: 'wall', re: /wall|fail|limit|pitfall|tradeoff|wrong/i },
  { key: 'insight', re: /insight|invariant|layout|contract|core/i },
  { key: 'correctness', re: /works|correct|proof|guarantee|safe/i },
  { key: 'cost', re: /cost|complexity|runtime|memory|behavior|latency/i },
  { key: 'use', re: /use|wins|where|works well/i },
  { key: 'next', re: /study next|next/i },
];

const captionStart = /^(move|visit|compare|swap|insert|remove|delete|push|pop|enqueue|dequeue|mark|highlight|select|choose|scan|check|set)\b/i;

function scoreArticle(article) {
  const sections = article?.sections ?? [];
  const text = sections.flatMap((section) => [
    section.heading ?? '',
    ...(section.paragraphs ?? []),
  ]).join(' ');
  const words = wordCount(text);
  const coverage = coveragePatterns.filter(({ re }) => re.test(text)).map(({ key }) => key);
  const missing = coveragePatterns.filter(({ key }) => !coverage.includes(key)).map(({ key }) => key);
  const score =
    Math.max(0, 260 - words) +
    Math.max(0, 7 - sections.length) * 25 +
    Math.max(0, 5 - coverage.length) * 25;

  return { words, sections: sections.length, coverage, missing, articleScore: score };
}

function defaultInput(topic) {
  const input = {};
  for (const control of topic.controls ?? []) {
    input[control.id] = control.defaultValue ?? (control.options ? control.options[0] : '');
  }
  return input;
}

function scoreSteps(topic) {
  let steps = [];
  try {
    steps = Array.from(topic.run(defaultInput(topic)));
  } catch {
    return { steps: 0, avgStepWords: 0, shortSteps: 0, captionish: 0, stepScore: 50 };
  }

  const explanations = steps.map((step) => step.explanation).filter(Boolean);
  const avgStepWords = explanations.length
    ? explanations.reduce((sum, text) => sum + wordCount(text), 0) / explanations.length
    : 0;
  const shortSteps = explanations.filter((text) => wordCount(text) < 9).length;
  const captionish = explanations.filter((text) => captionStart.test(text) && wordCount(text) < 14).length;
  const stepScore = shortSteps * 3 + captionish * 5 + Math.max(0, 13 - avgStepWords) * 4;

  return {
    steps: explanations.length,
    avgStepWords: Number(avgStepWords.toFixed(1)),
    shortSteps,
    captionish,
    stepScore: Number(stepScore.toFixed(1)),
  };
}

const rows = [];

for (const entry of topics) {
  if (entry.type !== 'visualization') continue;
  try {
    const mod = await entry.module();
    const article = scoreArticle(mod.article);
    const steps = scoreSteps(mod.topic);
    rows.push({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      ...article,
      ...steps,
      score: Number((article.articleScore + steps.stepScore).toFixed(1)),
    });
  } catch (error) {
    rows.push({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      score: 999,
      error: error.message,
    });
  }
}

rows.sort((a, b) => b.score - a.score);

console.log(`Audited ${rows.length} visualization topics.`);
console.log('score\twords\tsections\tcoverage\tavgStep\tcaption\tcategory\tid\tmissing');
for (const row of rows.slice(0, limit)) {
  console.log([
    row.score,
    row.words ?? '',
    row.sections ?? '',
    row.coverage?.length ?? '',
    row.avgStepWords ?? '',
    row.captionish ?? '',
    row.category,
    row.id,
    row.missing?.join(',') ?? row.error ?? '',
  ].join('\t'));
}
