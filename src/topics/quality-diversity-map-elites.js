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
      heading: 'Why this exists',
      paragraphs: [
        'Quality Diversity exists because one best score is often too narrow. A robot may need several gaits for different terrain. A game generator may need many playable styles. A molecule search may need different shapes with similar binding quality. A self-organizing system may need fallback behaviors when conditions change. In these settings, the output should be a repertoire, not one champion.',
        'MAP-Elites is the canonical Quality Diversity algorithm. It builds an archive indexed by behavior descriptors, then stores the best solution found so far in each cell. Diversity is not a post-processing chart. It is represented directly by the data structure that guides search.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is standard evolutionary search, hill climbing, Bayesian optimization, or differential evolution: define one scalar fitness, mutate candidates, and keep the best. That is reasonable when the product truly wants one answer. If the only goal is shortest path length or highest validation accuracy, diversity may be unnecessary overhead.',
        'The wall appears when the best scalar answer is brittle or incomplete. A robot optimized only for speed may learn one gait that fails after damage. A level generator optimized only for player completion may converge on one dull style. A neural cellular automaton trained only for one target image may never discover nearby forms that would repair better. Single-objective pressure tends to erase alternatives before anyone knows they were useful.',
        'A second shortcut is random search plus a diversity plot afterward. That shows variety, but it does not protect variety during search. MAP-Elites changes selection pressure while search is happening. Candidates compete locally inside niches, so a medium-speed, high-stability gait does not have to beat the fastest gait in the whole population to survive.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to split quality from behavior. Behavior descriptors choose the address in the archive. Fitness chooses the winner inside that address. A candidate that is fast and low-height goes to one cell. A candidate that is slow and high-height goes to another. They are not forced to compete as if they solved the same problem.',
        'This turns diversity into an index. First choose descriptors and divide them into bins. Then generate candidates, evaluate fitness, compute descriptors, and place each candidate into the matching archive cell. If the cell is empty, insert it. If the cell already has an elite, replace it only if the candidate has higher fitness.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A MAP-Elites run starts with an archive, usually a grid or sparse map over descriptor bins. The initial archive may be empty or seeded with random candidates. The loop then selects an existing elite, mutates or recombines it, evaluates the child, computes the child behavior descriptor, and maps that descriptor to a cell.',
        'The update rule is simple. Empty cell means insert. Filled cell means compare fitness against the current elite in that cell. If the child is better, replace the elite. If not, discard the child. Selection can be uniform over filled cells, biased toward high performers, biased toward underexplored regions, or combined with more advanced variation operators.',
        'The descriptor is the main design lever. For robot locomotion it might be final position, gait pattern, contact timing, or body height. For generated levels it might be difficulty and style. For molecule or material design it might be shape, charge, stability, or manufacturability. For self-organizing systems it might be size, symmetry, persistence, or repair ability. If the descriptor is meaningless, the archive preserves meaningless diversity.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The archive view proves the data-structure idea. Rows and columns are behavior descriptors. A candidate is addressed by behavior and judged by fitness. The same high score can be irrelevant if it belongs in a different cell. The archive asks "best for this niche," not "best overall."',
        'The search-loop view proves the algorithmic pressure. Selection comes from the archive, variation creates a candidate, evaluation produces both quality and behavior, and update changes one niche. The coverage plot must be read with both axes. A useful run needs enough filled cells and enough quality inside those cells. One excellent solution is not a repertoire; a huge archive of poor solutions is not useful.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MAP-Elites works by preserving local optima that a global optimizer would throw away. The invariant is that each filled cell stores the best candidate found so far for that behavior niche. A new child can improve a niche without needing to beat every other niche. That keeps exploration alive while still applying quality pressure.',
        'This is not a guarantee that the archive covers every useful behavior. It is a guarantee about the archive rule: diversity is protected only along the descriptors that were chosen, and quality is improved only inside the cells that receive evaluated candidates. The method works when those descriptors carve the search space into niches that matter for the downstream use.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is evaluation budget. MAP-Elites wants many candidates because it is trying to fill and improve many niches, not only chase one optimum. If each candidate requires a physics simulation, game playthrough, molecular docking run, or human rating, runtime is dominated by evaluation. Parallel evaluation helps, but it does not remove the budget question.',
        'Memory is archive size times solution representation plus metadata. A small two-dimensional grid is cheap. A high-dimensional descriptor space can explode into mostly empty cells. Sparse archives help, but then coverage becomes harder to interpret. Bin resolution is also a tax: coarse bins hide useful differences, while fine bins spread the budget too thin.',
        'Noisy evaluations add another tradeoff. A lucky candidate can replace a true elite if fitness is noisy. Serious runs often need repeated evaluation, confidence intervals, or conservative replacement rules. Reporting should include coverage, best fitness, average or median elite fitness, descriptor definitions, binning choices, and total evaluation budget.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Quality Diversity is useful when deployment is varied, users need options, or a single objective hides important behavioral differences. Robotics is the classic case: a repertoire of gaits can support adaptation after damage or terrain change. Procedural content generation can use an archive of levels across difficulty and style. Engineering design can search many feasible shapes rather than one peak design.',
        'The local self-organizing AI connection is natural. NCA-like systems trained for one target may learn one path to one shape. A QD archive can search for many stable, repairable, or symmetric outcomes before deployment. That matters when the environment changes or when the researcher wants to study the space of possible behaviors rather than one trained endpoint.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MAP-Elites is overkill when one robust scalar objective is enough. If the product wants the cheapest valid route, the most accurate classifier, or the fastest implementation under fixed constraints, a repertoire may waste budget. Quality Diversity is also weak when the descriptors are chosen because they are easy to measure rather than meaningful.',
        'Poor descriptors, tiny budgets, noisy evaluations, and overbroad bins can produce a decorative archive. The grid may look full while storing behaviors nobody needs. The opposite failure is a beautiful best score with almost no coverage. A QD result is only convincing when the behavior dimensions, quality metric, and evaluation budget match the claim.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MAP-Elites at https://arxiv.org/abs/1504.04909, Quality Diversity: A New Frontier for Evolutionary Computation at https://arxiv.org/abs/2012.00528, and the GECCO tutorial material at https://quality-diversity.github.io/. Study Evolutionary Search for the variation loop, Differential Evolution for another population optimizer, Novelty Search for diversity pressure without an elite grid, Multi-Armed Bandits for exploration budgets, Hyperparameter Search for black-box optimization, Neural Cellular Automata for self-organizing targets, Self-Organizing AI Design Pattern for repertoire use, and Conformal Prediction for uncertainty-aware deployment decisions.',
      ],
    },
  ],
};
