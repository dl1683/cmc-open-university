import { readFileSync, writeFileSync } from 'node:fs';
import { topics } from '../src/registry.js';

const dryRun = process.argv.includes('--dry-run');

const canonicalHeadings = [
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

const exactAlias = {
  // Existence
  'why this topic exists': 'Why this exists',
  'what this topic is for': 'Why this exists',
  'what this topic is about': 'Why this exists',
  'what is': 'Why this exists',
  'what it is': 'Why this exists',
  'what this is': 'Why this exists',
  'the problem': 'Why this exists',
  'the real problem': 'Why this exists',
  'the goal': 'Why this exists',
  'what it solves': 'Why this exists',
  'the need': 'Why this exists',
  'the constraint': 'Why this exists',

  // Problem framing and the wall
  'why the method works': 'Why it works',
  'the design works': 'Why it works',
  'the naive approach and the wall': 'The wall',
  'the obvious approach and the wall': 'The wall',
  'obvious approach and wall': 'The wall',
  'obvious approach and its wall': 'The wall',
  'the baseline and the wall': 'The wall',
  'naive baseline and wall': 'The wall',
  'naive approach and wall': 'The wall',
  'naive approach and the wall': 'The wall',
  'the naive baseline and the wall': 'The wall',
  'the reasonable first attempt and its wall': 'The wall',
  'the obvious approach and baseline wall': 'The wall',
  'obvious approach and its wall': 'The wall',

  // Core insight family
  'core insight': 'The core insight',
  'core idea': 'The core insight',
  'the core idea': 'The core insight',
  'core mechanism': 'The core insight',
  'core mechanism and invariant': 'The core insight',
  'core insight and invariant': 'The core insight',
  'core layout': 'The core insight',
  'the core data model': 'The core insight',
  'core data layout': 'The core insight',
  'core data structure': 'The core insight',
  'core model': 'The core insight',
  'core state model': 'The core insight',
  'core mechanism and layout': 'The core insight',
  'core invariant': 'The core insight',

  // How it works / reading
  'the mechanism': 'How it works',
  'mechanism': 'How it works',
  'mechanics': 'How it works',
  'how the mechanism works': 'How it works',
  'how the system works': 'How it works',
  'how the pipeline works': 'How it works',
  'how the mechanism and its proof': 'How it works',
  'how the algorithm works': 'How it works',
  'the workflow': 'How it works',
  'process': 'How it works',
  'operation': 'How it works',
  'animation notes': 'How to read the animation',
  'how to read': 'How to read the animation',
  'how to read the visualization': 'How to read the animation',
  'reading the visualization': 'How to read the animation',
  'animation guide': 'How to read the animation',
  'animation walkthrough': 'How to read the animation',
  'how to use the visualization': 'How to read the animation',
  'how to watch the animation': 'How to read the animation',
  'legacy visual note': 'How to read the animation',
  'what the visual is proving': 'How it works',
  'what the visual proves': 'How it works',
  'what the animation teaches': 'How it works',
  'what this visual teaches': 'How it works',
  'how the visual model teaches it': 'How it works',
  'the visual model teaches it': 'How it works',
  'animation and readouts': 'How it works',
  'what to watch in production': 'Cost and behavior',
  'animation meaning': 'How to read the animation',
  'animation focus': 'How to read the animation',
  'animation lesson': 'How to read the animation',
  'animation lesson plan': 'How to read the animation',
  'animation walk-through': 'How it works',
  'visual proof': 'How it works',

  // Cost
  'costs and tradeoffs': 'Cost and behavior',
  'cost and tradeoffs': 'Cost and behavior',
  'cost and complexity': 'Cost and behavior',
  'cost behavior': 'Cost and behavior',
  'costs': 'Cost and behavior',
  'costs and failure modes': 'Cost and behavior',
  'cost model': 'Cost and behavior',
  'tradeoff': 'Cost and behavior',
  'tradeoffs': 'Cost and behavior',
  'cost and tradeoff': 'Cost and behavior',
  'tradeoffs and cost': 'Cost and behavior',
  'cost and signals': 'Cost and behavior',
  'cost and overhead': 'Cost and behavior',
  'runtime cost': 'Cost and behavior',

  // Real-world / failures
  'where it wins': 'Real-world uses',
  'where it is useful': 'Real-world uses',
  'where it is useful and where it fails': 'Real-world uses',
  'where it matters': 'Real-world uses',
  'where it fits': 'Real-world uses',
  'where it is used': 'Real-world uses',
  'production uses': 'Real-world uses',
  'real-world uses': 'Real-world uses',
  'real uses': 'Real-world uses',
  'use cases': 'Real-world uses',
  'use case': 'Real-world uses',
  'use': 'Real-world uses',
  'real use cases': 'Real-world uses',
  'common use cases': 'Real-world uses',
  'practical use': 'Real-world uses',
  'where it breaks': 'Where it fails',
  'where it helps and where it fails': 'Where it fails',
  'where that fails': 'Where it fails',
  'where the naive approach breaks': 'Where it fails',
  'where it is the wrong tool': 'Where it fails',
  'where it does not work': 'Where it fails',
  'not for': 'Where it fails',
  'failure modes': 'Where it fails',
  'failure modes and limits': 'Where it fails',
  'failure modes and tradeoffs': 'Where it fails',
  'failure modes and misconceptions': 'Where it fails',
  'limits': 'Where it fails',
  'limits and failure modes': 'Where it fails',
  'limits and failure cases': 'Where it fails',
  'pitfalls': 'Where it fails',
  'pitfalls and misconceptions': 'Where it fails',
  'pitfalls and limitations': 'Where it fails',
  'misconceptions': 'Where it fails',
  'common misconceptions': 'Where it fails',
  'where that breaks': 'Where it fails',
  'common mistakes': 'Where it fails',

  // Why/correctness
  'why it is correct': 'Why it works',
  'why it can work': 'Why it works',
  'why it is reliable': 'Why it works',
  'reliability argument': 'Why it works',
  'correctness': 'Why it works',
  'invariant': 'Why it works',
  'proof': 'Why it works',

  // Obvious approach
  'the obvious approach': 'The obvious approach',
  'obvious approach': 'The obvious approach',
  'naive approach': 'The obvious approach',
  'naive baseline': 'The obvious approach',
  'the naive approach': 'The obvious approach',
  'the naive baseline': 'The obvious approach',
  'the baseline approach': 'The obvious approach',
  'the reasonable first attempt': 'The obvious approach',
  'reasonable first attempt': 'The obvious approach',
  'tempting wrong answer': 'The obvious approach',
  'the tempting approach': 'The obvious approach',
  'naive baseline': 'The obvious approach',
  'naive design': 'The obvious approach',
  'the naive design': 'The obvious approach',
  'obvious attempt': 'The obvious approach',

  // Worked example and study next
  'worked case': 'Worked example',
  'worked case study': 'Worked example',
  'concrete example': 'Worked example',
  'complete case study': 'Worked example',
  'complete case': 'Worked example',
  'a worked case': 'Worked example',
  'a worked example': 'Worked example',
  'worked examples': 'Worked example',
  'concrete case study': 'Worked example',
  'case study': 'Worked example',
  'case studies': 'Worked example',
  'worked example': 'Worked example',
  'example case': 'Worked example',
  'concrete case': 'Worked example',
  'sources and study next': 'Study next',
  'study next': 'Study next',
  'what to study next': 'Study next',
  'study next and sources': 'Study next',
  'what to remember': 'How to read the animation',
};

const patternAlias = [
  {
    canonical: 'How to read the animation',
    pattern: /\bhow\b.*\b(read|watch|follow|interpret|understand)\b|animation.*\bnotes?|visual.*\bguid/i,
  },
  {
    canonical: 'Study next',
    pattern: /\b(study|read)\b.*\bnext\b|\bsources?\b.*\bstudy next\b|\bstudy next\b.*\bsources?\b/i,
  },
  {
    canonical: 'Worked example',
    pattern: /\b(worked|concrete|complete|case|walk.?through)\b.*\b(example|case|case study|trace)\b|\bexample\b/i,
  },
  {
    canonical: 'Where it fails',
    pattern: /\bfailure|fail|pitfall|misconception|wrong tool|edge case|breaks|not .* fit|where .* not/i,
  },
  {
    canonical: 'Real-world uses',
    pattern: /\b(real[- ]world|production|use(s)? case|used in|practical)/i,
  },
  {
    canonical: 'Cost and behavior',
    pattern: /\b(cost|tradeoff|complexity|time|space|performance|latency|throughput|memory|overhead|behavior)\b/i,
  },
  {
    canonical: 'Why it works',
    pattern: /\b(why it works|proof|correct|reliable|reliability|invariant|exchange|induction|cut property)\b/i,
  },
  {
    canonical: 'How it works',
    pattern: /\b(how (?:the|it) works|how (?:to|the)|mechanism|algorithm|operation|pipeline|workflow|steps?)/i,
  },
  {
    canonical: 'The core insight',
    pattern: /\b(core|key)\b.*\b(insight|idea|invariant|trick|contract|state|layout|model)\b/i,
  },
  {
    canonical: 'The wall',
    pattern: /\b(the wall|wall)\b/i,
  },
  {
    canonical: 'The obvious approach',
    pattern: /\b(obvious|naive|baseline|reasonable|first attempt|temptation|tempting)\b/i,
  },
  {
    canonical: 'Why this exists',
    pattern: /\b(why this exists|the problem|problem statement|motivation|constraint|real problem|purpose)\b/i,
  },
];

const fallbackParagraphs = {
  'How to read the animation': (topic, topicModule) => {
    return [
      `Read the animation as the execution trace for ${String(topic.title || topicModule.title || topic.id)}. ${summarySentence(topic, topicModule)}`,
      'Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.',
      'Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.',
      'At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.',
    ];
  },
  'Why this exists': () => [
    'State the real constraint this topic fixes before introducing the mechanism.',
    'A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.',
    'Without that, every optimization appears decorative.',
  ],
  'The obvious approach': () => [
    'Name the reasonable first attempt and why teams reach for it.',
    'Then show the exact place that approach stops scaling or starts breaking.',
    'Treat this section as contrast, not a rejection.',
  ],
  'The wall': () => [
    'The wall is the precise failure mode that blocks the obvious approach.',
    'Make it concrete: the missing invariant, the extra operation, or the case that forces failure.',
    'If you can reproduce this wall in one example, the rest of the page is motivated.',
  ],
  'The core insight': () => [
    'The core insight is the smallest idea that changes what can be proven.',
    'Phrase it as an invariant, boundary, or contract that stays true across all transitions.',
    'Everything else in the topic should serve this one sentence.',
  ],
  'How it works': () => [
    'Describe the mechanism as a sequence of state transitions, not as a story.',
    'Each step should say what changes, what stays true, and why the move is legal.',
    'The animation should look like this section made concrete.',
  ],
  'Why it works': () => [
    'Give the proof sketch as a preservation argument: invariant before, move, invariant after.',
    'If there is a nontrivial corner case, name it explicitly.',
    'When correctness is explicit, readers can transfer the method to new inputs.',
  ],
  'Cost and behavior': () => [
    'Cost is both asymptotic and practical.',
    'State what grows, what stays flat, and what setup cost dominates before the method becomes useful.',
    'If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.',
  ],
  'Real-world uses': () => [
    'Show where this approach appears in products, libraries, or service designs.',
    'Tie each use case to a workload shape, not a brand name.',
    'The learner should know exactly when this pattern should be chosen next.',
  ],
  'Where it fails': () => [
    'List the failure modes and the conditions that trigger them.',
    'Most methods have at least one silent failure mode; expose the silent ones.',
    'A method without explicit failure conditions is an invitation for misuse.',
  ],
  'Worked example': () => [
    'Walk one concrete input all the way through.',
    'Keep this short and exact: state the state, the move, and the outcome at each step.',
    'The goal is prediction, not a one-off demonstration.',
  ],
  'Study next': () => [
    'List follow-up topics in a deliberate order: prerequisite, contrast, then extension.',
    'Close with one project or prompt that forces the same idea to be reused.',
    'Avoid flat lists of everything with the same topic label.',
  ],
};

const headingRe = /heading:\s*([`'"])(.*?)\1/g;

function normalizeHeading(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mapHeading(raw) {
  const heading = String(raw ?? '').trim();
  const compact = normalizeHeading(heading);
  if (!compact) return null;

  if (exactAlias[compact]) return exactAlias[compact];

  if (compact === 'where it works') return 'Real-world uses';
  if (compact === 'where it is the wrong tool') return 'Where it fails';
  if (compact === 'the obvious approach and wall') return 'The wall';
  if (compact === 'the wall') return 'The wall';
  if (compact === 'the obvious approach and the wall') return 'The wall';
  if (compact === 'obvious approach and wall') return 'The wall';
  if (compact === 'the naive approach and wall') return 'The wall';
  if (compact === 'the obvious approach and its wall') return 'The wall';
  if (compact === 'why the obvious approach fails') return 'The wall';
  if (compact === 'obvious approach and baseline') return 'The wall';
  if (compact === 'the naive approaches') return 'The obvious approach';

  if (compact === 'where it is useful and where it fails') return 'Real-world uses';
  if (compact === 'where it wins and fails') return 'Real-world uses';
  if (compact === 'where it wins and where it fails') return 'Real-world uses';
  if (compact === 'where it is useful') return 'Real-world uses';
  if (compact === 'where useful') return 'Real-world uses';

  for (const rule of patternAlias) {
    if (rule.pattern.test(compact)) return rule.canonical;
  }

  return null;
}

function uniqueCanonical(headings) {
  return Array.from(new Set(
    headings
      .map((heading) => mapHeading(heading) ?? heading)
      .map((heading) => normalizeHeading(heading)),
  ));
}

function getSectionHeadings(source) {
  return Array.from(source.matchAll(headingRe)).map((match) => match[2]);
}

function hasCanonicalSection(source, heading) {
  const normalized = normalizeHeading(heading);
  return uniqueCanonical(getSectionHeadings(source)).includes(normalized);
}

function summarySentence(topic, topicModule) {
  const summary = (topic.summary || topicModule?.summary || '').trim();
  if (summary) return `${summary}.`;

  const controls = topicModule?.controls ?? [];
  const select = controls.find((c) => c.type === 'select' && Array.isArray(c.options) && c.options.length > 1);
  if (select) {
    const values = select.options.slice(0, 4).map((entry) => `"${String(entry)}"`).join(', ');
    const tail = select.options.length > 4 ? ', and remaining views' : '';
    return `Use the ${String(select.label || select.id)} control to compare ${values}${tail}.`;
  }

  return 'The animation is the live trace for every state transition in this topic.';
}

function buildSection(topic, topicModule, heading) {
  const builder = fallbackParagraphs[heading];
  const paragraphs = builder ? builder(topic, topicModule) : ['Fill this section with mechanism-specific detail.'];

  return [
    '    {',
    `      heading: '${heading}',`,
    '      paragraphs: [',
    ...paragraphs.map((text) => `        ${JSON.stringify(text)},`),
    '      ],',
    '    },',
    '',
  ].join('\n');
}

function canonicalizeHeadings(source) {
  return source.replace(headingRe, (match, quote, heading) => {
    const canonical = mapHeading(heading);
    return canonical ? `heading: ${quote}${canonical}${quote}` : match;
  });
}

function insertHowToRead(source, topic, topicModule) {
  if (hasCanonicalSection(source, 'How to read the animation')) return source;
  const marker = /sections:\s*\[\s*\n/i.exec(source);
  if (!marker) return source;

  const section = buildSection(topic, topicModule, 'How to read the animation');
  const insertAt = marker.index + marker[0].length;
  return `${source.slice(0, insertAt)}${section}${source.slice(insertAt)}`;
}

function findSectionsBlock(source, sectionsMatchIndex) {
  const open = source.indexOf('[', sectionsMatchIndex);
  if (open < 0) return null;

  let depth = 0;
  let inString = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (escape) {
      escape = false;
      continue;
    }

    if (inString) {
      if (char === '\\') {
        escape = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      inString = char;
      continue;
    }

    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return [open, i];
    }
  }
  return null;
}

function insertMissingSections(source, topic, topicModule) {
  const marker = /sections:\s*\[/i.exec(source);
  if (!marker) return source;

  const block = findSectionsBlock(source, marker.index);
  if (!block) return source;

  const [open, close] = block;
  const canonicalHeadingsInSource = uniqueCanonical(getSectionHeadings(source));
  const missing = canonicalHeadings.filter((heading) => !canonicalHeadingsInSource.includes(normalizeHeading(heading)));
  if (!missing.length) return source;

  const insert = missing.map((heading) => buildSection(topic, topicModule, heading)).join('\n');
  const separator = source.slice(close - 1, close).trim() ? '\n' : '';
  return `${source.slice(0, close)}${separator}${insert}${source.slice(close)}`;
}

function canonicalizeSource(source, topic, topicModule) {
  let next = canonicalizeHeadings(source);
  next = insertHowToRead(next, topic, topicModule);
  next = insertMissingSections(next, topic, topicModule);
  return next;
}

const changed = [];
const skipped = [];

for (const entry of topics) {
  if (entry.type !== 'visualization') continue;
  const path = `src/topics/${entry.id}.js`;

  try {
    const module = await entry.module();
    const topic = module.topic || {};

    const source = readFileSync(path, 'utf8');
    const before = source;
    const next = canonicalizeSource(source, entry, topic);

    if (next !== before) {
      changed.push(entry.id);
      if (!dryRun) writeFileSync(path, next);
    }
  } catch (error) {
    skipped.push({ id: entry.id, reason: error.message });
  }
}

console.log(JSON.stringify({
  dryRun,
  changed: changed.length,
  skipped,
}, null, 2));

