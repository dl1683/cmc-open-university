// MAP-Elites: a quality-diversity algorithm that stores the best solution found
// for each behavior niche instead of searching for only one global champion.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'quality-diversity-map-elites',
  title: 'Quality Diversity: MAP-Elites',
  category: 'AI & ML',
  summary: 'Search for a map of diverse high-performing solutions: each behavior cell stores its current elite, making diversity an explicit data structure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['elite archive', 'search loop'], defaultValue: 'elite archive' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function archiveState(title, labels) {
  return labelMatrix(
    title,
    [
      { id: 'low', label: 'low h' },
      { id: 'mid', label: 'mid h' },
      { id: 'high', label: 'high h' },
    ],
    [
      { id: 'slow', label: 'slow' },
      { id: 'med', label: 'med' },
      { id: 'fast', label: 'fast' },
    ],
    labels,
  );
}

function* eliteArchive() {
  yield {
    state: archiveState('Archive indexed by behavior', [
      ['empty', 'A:72', 'empty'],
      ['B:64', 'C:81', 'D:70'],
      ['empty', 'E:77', 'empty'],
    ]),
    highlight: { found: ['mid:med', 'high:med', 'mid:slow'], compare: ['low:slow', 'low:fast'] },
    explanation: 'MAP-Elites stores solutions in an archive indexed by behavior descriptors. In this toy archive, columns are speed bins and rows are height bins. Each filled cell stores the best solution found for that niche.',
  };

  yield {
    state: labelMatrix(
      'A new candidate is placed by behavior, judged by quality',
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'quality', label: 'quality' },
        { id: 'cell', label: 'cell' },
        { id: 'decision', label: 'decision' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['fast, mid h', 'archive address'],
        ['86', 'fitness score'],
        ['mid:fast has D:70', 'current elite'],
        ['replace', '86 beats 70'],
      ],
    ),
    highlight: { active: ['behavior:value', 'quality:value'], found: ['decision:value'] },
    explanation: 'The behavior descriptor decides where the candidate belongs. The fitness score decides whether it replaces the current elite in that cell.',
    invariant: 'Diversity is represented by archive coordinates; quality is represented inside each cell.',
  };

  yield {
    state: archiveState('The archive improves and fills out', [
      ['F:58', 'A:72', 'empty'],
      ['B:64', 'C:81', 'G:86'],
      ['empty', 'E:77', 'H:69'],
    ]),
    highlight: { found: ['mid:fast', 'low:slow', 'high:fast'], compare: ['low:fast'] },
    explanation: 'MAP-Elites does not ask for only one champion. It asks for the best known slow-low, medium-high, fast-mid, and so on. The output is a repertoire.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'coverage', min: 0, max: 1 }, y: { label: 'best fitness', min: 0, max: 100 } },
      series: [
        { id: 'single', label: 'single-objective', points: [
          { x: 0.1, y: 40 }, { x: 0.16, y: 65 }, { x: 0.18, y: 82 }, { x: 0.19, y: 88 },
        ] },
        { id: 'qd', label: 'MAP-Elites', points: [
          { x: 0.1, y: 40 }, { x: 0.35, y: 62 }, { x: 0.62, y: 78 }, { x: 0.82, y: 86 },
        ] },
      ],
      markers: [
        { id: 'repertoire', x: 0.82, y: 86, label: 'many good options' },
      ],
    }),
    highlight: { active: ['qd'], compare: ['single'], found: ['repertoire'] },
    explanation: 'Quality diversity may sacrifice a little best-score speed to discover a broader set of useful behaviors. That breadth is the point.',
  };
}

function* searchLoop() {
  yield {
    state: graphState({
      nodes: [
        { id: 'archive', label: 'archive', x: 0.8, y: 3.8, note: 'elites' },
        { id: 'select', label: 'select', x: 2.7, y: 2.4, note: 'parent' },
        { id: 'mutate', label: 'mutate', x: 4.8, y: 2.4, note: 'variation' },
        { id: 'eval', label: 'evaluate', x: 6.8, y: 3.8, note: 'fitness+behavior' },
        { id: 'place', label: 'place', x: 4.8, y: 5.3, note: 'niche' },
        { id: 'update', label: 'update', x: 2.7, y: 5.3, note: 'replace if better' },
      ],
      edges: [
        { id: 'e-archive-select', from: 'archive', to: 'select', weight: '' },
        { id: 'e-select-mutate', from: 'select', to: 'mutate', weight: '' },
        { id: 'e-mutate-eval', from: 'mutate', to: 'eval', weight: '' },
        { id: 'e-eval-place', from: 'eval', to: 'place', weight: '' },
        { id: 'e-place-update', from: 'place', to: 'update', weight: '' },
        { id: 'e-update-archive', from: 'update', to: 'archive', weight: '' },
      ],
    }, { title: 'MAP-Elites is a generate-evaluate-archive loop' }),
    highlight: { active: ['select', 'mutate', 'eval', 'place'], found: ['archive'] },
    explanation: 'The loop is evolutionary: select an elite, mutate it, evaluate the child, compute its behavior descriptor, and update that niche if the child is better.',
  };

  yield {
    state: labelMatrix(
      'Descriptor choice defines the search map',
      [
        { id: 'robot', label: 'robot' },
        { id: 'level', label: 'game' },
        { id: 'molecule', label: 'molecule' },
        { id: 'nca', label: 'NCA' },
      ],
      [
        { id: 'descriptor', label: 'descriptor' },
        { id: 'fitness', label: 'fitness' },
      ],
      [
        ['speed, gait', 'distance'],
        ['difficulty, style', 'playability'],
        ['shape, charge', 'binding'],
        ['size, symmetry', 'target score'],
      ],
    ),
    highlight: { found: ['robot:descriptor', 'level:descriptor', 'nca:descriptor'] },
    explanation: 'The hardest design decision is often not mutation. It is the descriptor space. The archive can only preserve diversity along dimensions you chose to measure.',
  };

  yield {
    state: labelMatrix(
      'Why QD helps self-organizing systems',
      [
        { id: 'target', label: 'one target' },
        { id: 'qd', label: 'QD' },
        { id: 'repair', label: 'repair' },
        { id: 'transfer', label: 'transfer' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'benefit', label: 'benefit' },
      ],
      [
        ['overfits one shape', 'narrow'],
        ['many niches', 'repertoire'],
        ['damage differs', 'fallback behaviors'],
        ['new setting', 'more options'],
      ],
    ),
    highlight: { active: ['qd:benefit', 'repair:benefit', 'transfer:benefit'], compare: ['target:problem'] },
    explanation: 'For self-organizing AI, a single target can be too narrow. A quality-diversity archive can discover many viable growth patterns, robot gaits, or controllers before deployment surprises arrive.',
  };

  yield {
    state: labelMatrix(
      'Audit a QD result',
      [
        { id: 'cover', label: 'coverage' },
        { id: 'best', label: 'best' },
        { id: 'desc', label: 'desc' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'why', label: 'why' },
      ],
      [
        ['how many cells?', 'diversity'],
        ['how fit?', 'quality'],
        ['meaningful bins?', 'real novelty'],
        ['eval budget?', 'fair comparison'],
      ],
    ),
    highlight: { found: ['cover:ask', 'best:ask', 'desc:ask', 'cost:ask'] },
    explanation: 'A QD claim needs both axes: coverage and quality. A huge archive of bad solutions is not useful, and one excellent solution is not a diverse repertoire.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'elite archive') yield* eliteArchive();
  else if (view === 'search loop') yield* searchLoop();
  else throw new InputError('Pick a quality-diversity view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Quality Diversity algorithms search for many different high-performing solutions, not just one best solution. MAP-Elites is the canonical example. It builds an archive indexed by behavior descriptors. Each cell in the archive stores the best solution found so far for that niche. Diversity is therefore not an afterthought; it is represented directly by the data structure.',
        'This is a different search objective from standard Evolutionary Search or Differential Evolution. A single-objective optimizer may converge on one champion. MAP-Elites tries to illuminate the space: what is the best slow robot, fast robot, tall gait, short gait, stable gait, and so on? The result is a repertoire.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First choose behavior descriptors and divide them into bins. Then generate candidate solutions, evaluate their fitness, compute their descriptor, and place them into the matching archive cell. If the cell is empty, insert the candidate. If the cell already has an elite, replace it only if the candidate has higher fitness. Future candidates are often produced by mutating elites already in the archive.',
        'The descriptor is the design lever. For robot locomotion it might be final position, gait pattern, or body height. For generated levels it might be difficulty and style. For self-organizing systems it might be size, symmetry, stability, or repair ability. If the descriptor is meaningless, the archive preserves meaningless diversity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MAP-Elites can be expensive because it evaluates many candidates. Memory is the archive size times solution representation. Runtime is dominated by simulation or task evaluation. The payoff is exploration: instead of betting on one brittle optimum, the algorithm finds alternatives that may transfer better when the environment changes, the robot is damaged, or the downstream user wants a different tradeoff.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quality Diversity is used in robotics, procedural content generation, design optimization, material discovery, creative tools, synthetic biology analogies, and open-ended artificial-life research. The local corpus connects it to self-organizing AI because NCA-like systems trained for one target may not discover new forms; QD explicitly rewards a map of diverse outcomes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'QD is not random search with nicer plots. The archive changes selection pressure by preserving niche elites. But it also does not guarantee useful novelty. Poor descriptors, tiny budgets, noisy evaluations, and overbroad bins can produce a decorative archive rather than a deployable repertoire. Report coverage, best fitness, average elite fitness, descriptor meaning, and evaluation budget.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MAP-Elites at https://arxiv.org/abs/1504.04909, Quality Diversity: A New Frontier for Evolutionary Computation at https://arxiv.org/abs/2012.00528, and the GECCO tutorial material at https://quality-diversity.github.io/. Study Evolutionary Search, Differential Evolution, Neural Cellular Automata, Self-Organizing AI Design Pattern, Multi-Armed Bandits, Hyperparameter Search, and Conformal Prediction next.',
      ],
    },
  ],
};
