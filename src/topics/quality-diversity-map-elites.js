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
    explanation: `${topic.title.split(':')[1].trim()} stores solutions in an archive indexed by behavior descriptors. In this toy archive, columns are speed bins and rows are height bins. Each filled cell stores the best solution found for that niche.`,
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
    explanation: `The behavior descriptor decides where the candidate belongs in ${topic.title.split(':')[1].trim()}. The fitness score decides whether it replaces the current elite in that cell.`,
    invariant: `Diversity is represented by archive coordinates; quality is represented inside each cell — that is the ${topic.title.split(':')[0].trim()} contract.`,
  };

  yield {
    state: archiveState('The archive improves and fills out', [
      ['F:58', 'A:72', 'empty'],
      ['B:64', 'C:81', 'G:86'],
      ['empty', 'E:77', 'H:69'],
    ]),
    highlight: { found: ['mid:fast', 'low:slow', 'high:fast'], compare: ['low:fast'] },
    explanation: `${topic.title.split(':')[1].trim()} does not ask for only one champion. It asks for the best known slow-low, medium-high, fast-mid, and so on. The output is a repertoire.`,
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
    explanation: `${topic.title.split(':')[0].trim()} may sacrifice a little best-score speed to discover a broader set of useful behaviors. That breadth is the point.`,
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
    explanation: `The ${topic.title.split(':')[1].trim()} loop is evolutionary: select an elite, mutate it, evaluate the child, compute its behavior descriptor, and update that niche if the child is better.`,
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
    explanation: `The hardest ${topic.title.split(':')[1].trim()} design decision is often not mutation. It is the descriptor space. The archive can only preserve diversity along dimensions you chose to measure.`,
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
    explanation: `For self-organizing AI, a single target can be too narrow. A ${topic.title.split(':')[0].trim().toLowerCase()} archive can discover many viable growth patterns, robot gaits, or controllers before deployment surprises arrive.`,
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
    explanation: `A ${topic.title.split(':')[0].trim()} claim needs both axes: coverage and quality. A huge archive of bad solutions is not useful, and one excellent solution is not a diverse repertoire.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the archive as a table where the row and column are behavior descriptors. A descriptor is a measured behavior feature, such as speed, height, difficulty, or symmetry.',
        'The value inside a filled cell is the current elite, meaning the best candidate found so far for that niche. Active cells show where a new candidate belongs, and found cells show archive updates.',
        {type: 'image', src: './assets/gifs/quality-diversity-map-elites.gif', alt: 'Animated walkthrough of the quality diversity map elites visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many searches do not need one champion; they need a repertoire. A damaged robot needs backup gaits, a game generator needs many playable styles, and a design tool needs alternatives under different constraints.',
        {type: 'callout', text: 'MAP-Elites makes diversity a storage address and quality a local replacement rule.'},
        'Quality Diversity is the family of algorithms that optimize for good solutions spread across behavior space. MAP-Elites is the cleanest version: store the best solution found in each behavior cell.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is single-objective optimization. Define one fitness score, mutate candidates, and keep the best one.',
        'That is reasonable when the deployment really has one target. If the only goal is highest accuracy under fixed constraints, preserving a repertoire may waste budget.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the best score is brittle. A robot optimized only for flat-ground speed can fail on rough terrain or after damage.',
        'Single-objective pressure also erases alternatives before they can prove useful. A medium-speed but stable gait may disappear because it loses against the fastest gait in the global ranking.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to split behavior from quality. Behavior chooses the archive address, while fitness chooses the winner inside that address.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt: 'Colored Voronoi cells partitioning a plane around points', caption: 'A descriptor archive is a designed partition of behavior space; this Voronoi diagram gives the same visual intuition of regions owning candidates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euclidean_Voronoi_diagram.svg.'},
        'A slow-high solution and a fast-low solution do not compete as if they solve the same niche. They compete only against previous elites with the same descriptor bin.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an empty archive over descriptor bins. Generate or seed candidates, evaluate each candidate\'s fitness, compute its descriptor, and map it to a cell.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/MCTS_Algorithm.png/250px-MCTS_Algorithm.png', alt: 'Monte Carlo tree search phases of selection expansion simulation and backpropagation', caption: 'Quality-diversity search is not MCTS, but both make search pressure visible as a loop over selection, evaluation, and update. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:MCTS_Algorithm.png.'},
        'If the cell is empty, insert the candidate. If the cell already has an elite, replace it only when the candidate\'s fitness is higher.',
        'The loop then samples elites from the archive, mutates them, evaluates children, and updates cells. The archive is both memory and search guide.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is local elitism. Each filled cell stores the best candidate seen so far for that behavior niche.',
        'This protects useful local optima that a global optimizer would discard. The method is correct about its archive rule, but the result is useful only if the chosen descriptors describe behaviors that matter.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is evaluation. If one candidate requires a physics rollout, game playthrough, docking simulation, or human rating, the runtime is the number of candidates times that evaluation cost.',
        'Memory is archive cells times elite size and metadata. A 50 by 50 grid has 2,500 cells; storing a 2 KB controller per filled cell uses about 5 MB before scores and descriptors.',
        'Descriptor resolution controls behavior. Coarse bins hide differences, while fine bins spread the same evaluation budget over too many cells.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MAP-Elites fits robotics, procedural content generation, engineering design, molecule search, material design, controller search, and self-organizing systems. The shared pattern is that deployment values options.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Learned controllers and generative systems often need many viable behaviors, not one isolated optimum. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'It is also useful for analysis. A filled archive shows which regions of behavior space are reachable, which are empty, and which contain high-quality designs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MAP-Elites fails when the descriptors are easy to measure but irrelevant. The archive can look diverse while preserving differences that users do not care about.',
        'It also fails under tiny budgets or noisy fitness. A lucky evaluation can replace a better elite, and a sparse budget can leave most cells empty.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a robot gait search with two descriptors: speed bucket and body-height bucket. A 3 by 3 archive has 9 niches.',
        'Candidate G has behavior fast-mid and fitness 86. The current fast-mid cell stores D with fitness 70, so G replaces D.',
        'Candidate H has behavior medium-high and fitness 74. If that cell already stores E with fitness 77, H is discarded even though it might beat elites in other cells.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Mouret and Clune, "Illuminating Search Spaces by Mapping Elites", and the Quality Diversity survey by Pugh, Soros, and Stanley. Then study evolutionary search, novelty search, differential evolution, multi-armed bandits, hyperparameter search, neural cellular automata, and uncertainty-aware evaluation.',
      ],
    },
  ],
};
