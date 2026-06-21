// Differential evolution: a population-based optimizer for black-box,
// non-differentiable search spaces.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'differential-evolution',
  title: 'Differential Evolution',
  category: 'Concepts',
  summary: 'A black-box optimizer that mutates candidates by adding scaled population differences, crosses them with a target, and keeps only improvements.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mutation and crossover', 'black-box attack loop'], defaultValue: 'mutation and crossover' },
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

function populationTable(title) {
  return labelMatrix(
    title,
    [
      { id: 'target', label: 'target x_i' },
      { id: 'base', label: 'base a' },
      { id: 'p1', label: 'point b' },
      { id: 'p2', label: 'point c' },
      { id: 'mutant', label: 'mutant v' },
    ],
    [
      { id: 'x', label: 'x' },
      { id: 'y', label: 'y' },
      { id: 'score', label: 'loss' },
    ],
    [
      ['2.0', '4.5', '14.2'],
      ['6.0', '2.0', '9.6'],
      ['4.0', '6.0', '12.5'],
      ['1.0', '3.0', '18.4'],
      ['7.5', '3.5', 'pending'],
    ],
  );
}

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'pop', label: 'population', x: 0.8, y: 3.8, note: 'candidate pool' },
      { id: 'diff', label: 'difference', x: 2.7, y: 2.2, note: 'b - c' },
      { id: 'mut', label: 'mutant', x: 4.6, y: 2.2, note: 'a + F(b-c)' },
      { id: 'cross', label: 'crossover', x: 6.4, y: 3.8, note: 'trial vector' },
      { id: 'score', label: 'score', x: 4.6, y: 5.4, note: 'black-box call' },
      { id: 'keep', label: 'survivor', x: 8.4, y: 3.8, note: 'best stays' },
    ],
    edges: [
      { id: 'e-pop-diff', from: 'pop', to: 'diff', weight: '' },
      { id: 'e-diff-mut', from: 'diff', to: 'mut', weight: '' },
      { id: 'e-mut-cross', from: 'mut', to: 'cross', weight: '' },
      { id: 'e-cross-score', from: 'cross', to: 'score', weight: '' },
      { id: 'e-score-keep', from: 'score', to: 'keep', weight: '' },
      { id: 'e-keep-pop', from: 'keep', to: 'pop', weight: '' },
    ],
  }, { title });
}

function* mutationAndCrossover() {
  yield {
    state: populationTable('Start with a population, not one current point'),
    highlight: { active: ['target:x', 'target:y'], compare: ['base:x', 'p1:x', 'p2:x'] },
    explanation: 'Differential Evolution keeps many candidate solutions. For each target candidate, it samples other population members to build a mutation direction from actual population geometry.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'parameter 1', min: 0, max: 9 }, y: { label: 'parameter 2', min: 0, max: 7 } },
      series: [
        { id: 'population', label: 'population', points: [
          { x: 2.0, y: 4.5 }, { x: 6.0, y: 2.0 }, { x: 4.0, y: 6.0 }, { x: 1.0, y: 3.0 },
        ] },
      ],
      markers: [
        { id: 'target', x: 2.0, y: 4.5, label: 'target' },
        { id: 'base', x: 6.0, y: 2.0, label: 'a' },
        { id: 'mutant', x: 7.5, y: 3.5, label: 'v' },
      ],
      vectors: [
        { id: 'spread', from: { x: 1.0, y: 3.0 }, to: { x: 4.0, y: 6.0 }, label: 'b - c' },
        { id: 'scaled', from: { x: 6.0, y: 2.0 }, to: { x: 7.5, y: 3.5 }, label: 'F(b-c)' },
      ],
    }),
    highlight: { active: ['spread', 'scaled'], found: ['mutant'], compare: ['target'] },
    explanation: 'The signature move is v = a + F(b - c). The mutation step does not need a gradient; it borrows direction and scale from the current population spread.',
    invariant: 'Population differences adapt the step size to the search cloud.',
  };

  yield {
    state: labelMatrix(
      'Crossover mixes target and mutant coordinates',
      [
        { id: 'target', label: 'target x_i' },
        { id: 'mutant', label: 'mutant v' },
        { id: 'mask', label: 'crossover mask' },
        { id: 'trial', label: 'trial u' },
      ],
      [
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'note', label: 'source' },
      ],
      [
        ['2.0', '4.5', 'current candidate'],
        ['7.5', '3.5', 'mutated candidate'],
        ['take v', 'keep x_i', 'binomial crossover'],
        ['7.5', '4.5', 'one coordinate changed'],
      ],
    ),
    highlight: { active: ['mask:x', 'trial:x'], compare: ['mask:y', 'trial:y'] },
    explanation: 'Crossover prevents the mutant from replacing every coordinate blindly. A trial vector inherits some coordinates from the target and some from the mutant.',
  };

  yield {
    state: labelMatrix(
      'Greedy selection keeps whichever scores better',
      [
        { id: 'target', label: 'target x_i' },
        { id: 'trial', label: 'trial u' },
        { id: 'survivor', label: 'next population slot' },
      ],
      [
        { id: 'candidate', label: 'candidate' },
        { id: 'loss', label: 'loss' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['(2.0, 4.5)', '14.2', 'replaced'],
        ['(7.5, 4.5)', '8.1', 'wins'],
        ['(7.5, 4.5)', '8.1', 'carry forward'],
      ],
    ),
    highlight: { active: ['trial:loss', 'trial:decision'], found: ['survivor:candidate'] },
    explanation: 'Selection is local and ruthless: if the trial is better than the target, it occupies that population slot. Otherwise the original target survives unchanged.',
  };
}

function* blackBoxAttackLoop() {
  yield {
    state: loopGraph('The optimizer only needs candidate scores'),
    highlight: { active: ['pop', 'mut', 'cross', 'score'], found: ['keep'] },
    explanation: 'Differential Evolution wraps any scoring function: simulate a design, run a model query, measure latency, evaluate a loss, or ask whether an adversarial edit fooled a classifier.',
  };

  yield {
    state: labelMatrix(
      'One-pixel attack candidate as a DE vector',
      [
        { id: 'x', label: 'x coordinate' },
        { id: 'y', label: 'y coordinate' },
        { id: 'r', label: 'red' },
        { id: 'g', label: 'green' },
        { id: 'b', label: 'blue' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'bounds', label: 'bounds' },
        { id: 'fitness', label: 'fitness role' },
      ],
      [
        ['17', 'image width', 'where to edit'],
        ['9', 'image height', 'where to edit'],
        ['255', '0..255', 'color channel'],
        ['20', '0..255', 'color channel'],
        ['20', '0..255', 'color channel'],
      ],
    ),
    highlight: { active: ['x:value', 'y:value', 'r:value', 'g:value', 'b:value'] },
    explanation: 'The one-pixel attack uses exactly the DE shape: each candidate is a small vector, and the model confidence after applying that edit becomes the fitness score.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'model queries', min: 0, max: 80 }, y: { label: 'best target probability', min: 0, max: 1 } },
      series: [
        { id: 'best', label: 'best candidate so far', points: [
          { x: 0, y: 0.04 }, { x: 10, y: 0.11 }, { x: 20, y: 0.22 }, { x: 30, y: 0.35 },
          { x: 40, y: 0.52 }, { x: 50, y: 0.68 }, { x: 60, y: 0.79 }, { x: 70, y: 0.83 },
        ] },
      ],
      markers: [
        { id: 'start', x: 0, y: 0.04, label: 'original' },
        { id: 'flip', x: 50, y: 0.68, label: 'class flips' },
      ],
    }),
    highlight: { active: ['best'], found: ['flip'], compare: ['start'] },
    explanation: 'The best-so-far curve is a useful mental model: the algorithm spends queries testing candidates and keeps edits that push the score toward the target.',
  };

  yield {
    state: labelMatrix(
      'Use DE when the score is visible but gradients are not',
      [
        { id: 'good', label: 'good fit' },
        { id: 'bad', label: 'bad fit' },
        { id: 'knobs', label: 'knobs' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'example', label: 'example' },
      ],
      [
        ['black-box, noisy, non-smooth', 'attacks, design tuning'],
        ['high dimension, cheap gradients', 'use gradient descent first'],
        ['population, F, crossover rate', 'budget vs exploration'],
        ['rerun with seeds and baselines', 'avoid lucky searches'],
      ],
    ),
    highlight: { found: ['good:rule', 'knobs:example', 'audit:rule'], compare: ['bad:rule'] },
    explanation: 'DE is a pragmatic search tool, not a universal optimizer. It shines when the evaluator is the only thing you can call and the candidate vector is not too huge.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mutation and crossover') yield* mutationAndCrossover();
  else if (view === 'black-box attack loop') yield* blackBoxAttackLoop();
  else throw new InputError('Pick a Differential Evolution view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Differential Evolution exists for numeric optimization problems where the only reliable operation is "try this vector and score it." The objective may be a simulator, a lab measurement, a model query, a compiler benchmark, a controller rollout, or a black-box loss. It may be noisy, discontinuous, nonconvex, or unavailable as a formula. Gradient descent wants derivatives. Grid search wants a small number of dimensions. Differential Evolution asks for something weaker: bounded parameters and enough budget to evaluate a population of candidates.`,
        {type: `callout`, text: `Differential Evolution turns population differences into candidate moves, so the search learns step directions from the geometry it has already sampled.`},
        `The method is useful because many real design problems expose a score long before they expose a smooth landscape. Tune five PID gains. Choose ten simulation constants. Search a small adversarial perturbation. Calibrate a model where each run returns an error number. In these settings, the question is not "what is the exact derivative?" It is "how can the candidates teach each other where useful steps might be?" Differential Evolution answers by turning differences between population members into new moves.`,
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The first attempt is often random search. Pick vectors inside the bounds, evaluate them, keep the best. This is honest and sometimes surprisingly strong because it makes few assumptions. Its wall is that it throws away geometry. If one candidate is better than another, random search does not learn a direction, a scale, or which coordinates might move together. As dimensions increase, most samples miss the interesting region unless the evaluation budget grows painfully.`,
        `The second attempt is local noise around the current best candidate. That uses more information, but it introduces a new problem: the mutation scale has to be lucky. Too small and the search crawls inside one basin. Too large and it jumps over useful structure. A single fixed scale is especially weak when different coordinates have different sensitivity. Gradient methods are still the right tool when gradients are cheap and meaningful. Differential Evolution is for the cases where the evaluator returns only a score and the search still needs structured exploration.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core move is the differential mutation: mutant = a + F * (b - c). The vector b - c is a direction and scale borrowed from the current population. If the population is spread out, differences are large and exploration is wider. If the population has clustered, differences shrink and search becomes more local. The algorithm does not need a hand-designed step size for every coordinate; the population supplies candidate moves from its own geometry.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ackley.gif/250px-Ackley.gif`, alt: `Differential Evolution population minimizing the two-dimensional Ackley function`, caption: `A live population exploring the Ackley function makes the mutation-selection loop visible as moving candidate points. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ackley.gif/250px-Ackley.gif`},
        `Differential Evolution then uses crossover and greedy selection. Crossover mixes the target vector with the mutant vector, producing a trial that changes some coordinates while preserving others. Selection evaluates the trial and replaces the target only if the trial is at least as good under the objective. That makes each population slot a small tournament between the old candidate and a structured variation. The algorithm never accepts a nice story over a measured score.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A generation starts by choosing a target candidate. The algorithm samples other distinct population members to play the roles of base and difference vectors. In the common DE/rand/1/bin strategy, it builds one mutant from a random base plus one scaled difference. Other strategies use the current best candidate, multiple differences, or different crossover rules, but the basic structure remains: create a plausible alternative from population relationships.`,
        `After mutation, binomial crossover decides coordinate by coordinate whether the trial inherits from the target or the mutant. At least one coordinate must come from the mutant so the trial is not identical to the target. Bounds are enforced by clipping, resampling, reflection, or a problem-specific repair rule. The objective evaluates the trial. If the problem is minimization and the trial score is lower, the trial replaces the target in the next population; otherwise the target survives. Repeat this for every population member and many generations.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The mutation view proves that the method is not blind noise. The arrow b - c is a concrete vector between two existing candidates. Scaling it by F and adding it to a base point creates a move whose magnitude reflects population diversity. The target is not overwritten by that move. Crossover makes a trial, and selection requires measured improvement before replacement. The visual separates exploration, recombination, and acceptance.`,
        `The black-box attack view proves the same idea in a less abstract setting. The candidate vector is the editable object, such as a pixel location and color. The model confidence is just the score function. The best-so-far curve shows query budget being converted into better candidates, but it also shows why a single successful run is not enough evidence. A lucky curve may depend on seed, budget, bounds, and target choice. The visual supports the sober reading: Differential Evolution is a budgeted search process, not a guarantee of global discovery.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Differential Evolution has no universal correctness proof that says it will find the global optimum quickly on every landscape. Its justification is behavioral. Population differences adapt step scale to the current search distribution. Crossover can test partial coordinate changes without discarding the entire target. Greedy selection keeps each slot from getting worse under the measured objective. Together, these rules create a simple pressure: preserve good candidates, perturb them using live population geometry, and keep changes that score better.`,
        `That pressure is enough to be useful on many rough landscapes because it avoids two extremes. It is less wasteful than independent random sampling because it reuses population structure. It is less brittle than a local hill climber because multiple candidates explore multiple regions at once, and differences can jump between basins. Still, "works well often" is not the same as "proves optimal." Serious use treats Differential Evolution as an empirical optimizer that must be compared against baselines under the same evaluation budget.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The cost is dominated by objective evaluations. With population size P and generation count G, the loop performs roughly P * G trial evaluations after initialization. Vector arithmetic is usually cheap; the evaluator is the bill. If each score call is a millisecond simulation, the method is easy to run. If each score call trains a model, drives a robot, or queries a paid service, the budget becomes the algorithm's central constraint.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG/250px-DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG`, alt: `Differential Evolution meta-fitness landscape over tuning parameters`, caption: `DE itself has a search landscape: population size, mutation scale, and crossover settings change how quickly evaluations become evidence. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG/250px-DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG`},
        `The knobs matter. F controls mutation scale. The crossover rate controls how aggressively mutant coordinates enter the trial. Population size trades diversity against evaluation cost. Bounds and repair rules shape the search more than many users admit. High-dimensional problems often need larger populations or domain-specific structure because random coordinate mixing becomes inefficient. Noisy objectives may require repeated evaluations or robust selection, which multiplies cost. Parallel hardware helps because population evaluations are often independent, but parallelism does not reduce the number of scores required for evidence.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `Differential Evolution appears in engineering design, simulation calibration, parameter estimation, signal processing, operations research, robotics, adversarial machine learning, and AutoML-style searches. It is a good fit when candidates are real-valued vectors with meaningful bounds, gradients are unavailable or unreliable, and evaluation is expensive enough that random wandering is wasteful but cheap enough that a population can be tested. The One Pixel Attack is a memorable example because the candidate vector is tiny and the classifier can be queried as a black box.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/St_5-xband-antenna.jpg/250px-St_5-xband-antenna.jpg`, alt: `NASA ST5 evolved X-band antenna`, caption: `Antenna design is a classic optimization setting where a simulator can score candidates long before a simple derivative is available. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/St_5-xband-antenna.jpg/250px-St_5-xband-antenna.jpg`},
        `It fails when used as a default substitute for thinking. If gradients are cheap and reliable, gradient methods often scale better. If the problem is mostly discrete or constrained by complex validity rules, naive vector mutation may generate many illegal candidates unless repair is carefully designed. If the objective is noisy, greedy replacement can prefer lucky measurements. If the evaluation budget is uneven across methods, comparisons become misleading. Differential Evolution can find a high-scoring candidate without explaining causality, so results should be paired with diagnostics, ablations, and domain review.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources are Storn and Price's Differential Evolution paper, the original technical report, SciPy's differential_evolution documentation for implementation details, and the One Pixel Attack paper for an applied black-box search example. Study Evolutionary Search first for the broader population-based pattern. Then read Gradient Descent to understand the tool Differential Evolution is often compared against, One-Pixel Attack Case Study for a compact adversarial use case, Hyperparameter Search and Neural Architecture Search for evaluation-budget discipline, and Bayesian Optimization for a contrasting black-box optimizer that builds a surrogate model instead of relying only on population differences.`,
      ],
    },
    {
      heading: 'Sources',
      paragraphs: [
        `The original paper is Storn and Price, Differential Evolution, at https://doi.org/10.1023/A:1008202821328. The earlier technical report is mirrored at https://www1.icsi.berkeley.edu/~storn/TR-95-012.pdf. A practical implementation reference is SciPy's documentation at https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.differential_evolution.html. The black-box attack example is One Pixel Attack for Fooling Deep Neural Networks at https://arxiv.org/abs/1710.08864.`,
      ],
    },
  ],
};
