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
  const popSize = 5;
  const dims = 2;
  yield {
    state: populationTable('Start with a population, not one current point'),
    highlight: { active: ['target:x', 'target:y'], compare: ['base:x', 'p1:x', 'p2:x'] },
    explanation: `Differential Evolution keeps ${popSize} candidate solutions across ${dims} dimensions. For each target candidate, it samples other population members to build a mutation direction from actual population geometry.`,
  };

  const popPoints = [
    { x: 2.0, y: 4.5 }, { x: 6.0, y: 2.0 }, { x: 4.0, y: 6.0 }, { x: 1.0, y: 3.0 },
  ];
  const mutantPos = { x: 7.5, y: 3.5 };
  const basePos = { x: 6.0, y: 2.0 };
  yield {
    state: plotState({
      axes: { x: { label: 'parameter 1', min: 0, max: 9 }, y: { label: 'parameter 2', min: 0, max: 7 } },
      series: [
        { id: 'population', label: 'population', points: popPoints },
      ],
      markers: [
        { id: 'target', x: popPoints[0].x, y: popPoints[0].y, label: 'target' },
        { id: 'base', x: basePos.x, y: basePos.y, label: 'a' },
        { id: 'mutant', x: mutantPos.x, y: mutantPos.y, label: 'v' },
      ],
      vectors: [
        { id: 'spread', from: { x: 1.0, y: 3.0 }, to: { x: 4.0, y: 6.0 }, label: 'b - c' },
        { id: 'scaled', from: { x: basePos.x, y: basePos.y }, to: { x: mutantPos.x, y: mutantPos.y }, label: 'F(b-c)' },
      ],
    }),
    highlight: { active: ['spread', 'scaled'], found: ['mutant'], compare: ['target'] },
    explanation: `The signature move is v = a + F(b - c). From base (${basePos.x}, ${basePos.y}) the mutant lands at (${mutantPos.x}, ${mutantPos.y}). The mutation step does not need a gradient; it borrows direction and scale from the ${popPoints.length}-member population spread.`,
    invariant: `Population differences across ${popPoints.length} candidates adapt the step size to the search cloud.`,
  };

  const crossRows = [
    { id: 'target', label: 'target x_i' },
    { id: 'mutant', label: 'mutant v' },
    { id: 'mask', label: 'crossover mask' },
    { id: 'trial', label: 'trial u' },
  ];
  const crossCols = [
    { id: 'x', label: 'x' },
    { id: 'y', label: 'y' },
    { id: 'note', label: 'source' },
  ];
  yield {
    state: labelMatrix(
      'Crossover mixes target and mutant coordinates',
      crossRows,
      crossCols,
      [
        ['2.0', '4.5', 'current candidate'],
        ['7.5', '3.5', 'mutated candidate'],
        ['take v', 'keep x_i', 'binomial crossover'],
        ['7.5', '4.5', 'one coordinate changed'],
      ],
    ),
    highlight: { active: ['mask:x', 'trial:x'], compare: ['mask:y', 'trial:y'] },
    explanation: `Crossover prevents the mutant from replacing every coordinate blindly. Across ${crossCols.length - 1} dimensions, the ${crossRows[crossRows.length - 1].label} vector inherits some coordinates from the ${crossRows[0].label} and some from the ${crossRows[1].label}.`,
  };

  const selRows = [
    { id: 'target', label: 'target x_i' },
    { id: 'trial', label: 'trial u' },
    { id: 'survivor', label: 'next population slot' },
  ];
  const targetLoss = 14.2;
  const trialLoss = 8.1;
  yield {
    state: labelMatrix(
      'Greedy selection keeps whichever scores better',
      selRows,
      [
        { id: 'candidate', label: 'candidate' },
        { id: 'loss', label: 'loss' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['(2.0, 4.5)', String(targetLoss), 'replaced'],
        ['(7.5, 4.5)', String(trialLoss), 'wins'],
        ['(7.5, 4.5)', String(trialLoss), 'carry forward'],
      ],
    ),
    highlight: { active: ['trial:loss', 'trial:decision'], found: ['survivor:candidate'] },
    explanation: `Selection is local and ruthless: the trial loss ${trialLoss} beats the target loss ${targetLoss}, so it occupies that population slot. Otherwise the original ${selRows[0].label} survives unchanged.`,
  };
}

function* blackBoxAttackLoop() {
  const loopNodes = ['pop', 'mut', 'cross', 'score', 'keep'];
  yield {
    state: loopGraph('The optimizer only needs candidate scores'),
    highlight: { active: loopNodes.slice(0, 4), found: [loopNodes[4]] },
    explanation: `Differential Evolution wraps any scoring function through a ${loopNodes.length}-node loop from "${loopNodes[0]}" to "${loopNodes[loopNodes.length - 1]}": simulate a design, run a model query, measure latency, evaluate a loss, or ask whether an adversarial edit fooled a classifier.`,
  };

  const pixelDims = [
    { id: 'x', label: 'x coordinate' },
    { id: 'y', label: 'y coordinate' },
    { id: 'r', label: 'red' },
    { id: 'g', label: 'green' },
    { id: 'b', label: 'blue' },
  ];
  yield {
    state: labelMatrix(
      'One-pixel attack candidate as a DE vector',
      pixelDims,
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
    explanation: `The one-pixel attack uses exactly the DE shape: each candidate is a ${pixelDims.length}-element vector (${pixelDims.map(d => d.label).join(', ')}), and the model confidence after applying that edit becomes the fitness score.`,
  };

  const queryPoints = [
    { x: 0, y: 0.04 }, { x: 10, y: 0.11 }, { x: 20, y: 0.22 }, { x: 30, y: 0.35 },
    { x: 40, y: 0.52 }, { x: 50, y: 0.68 }, { x: 60, y: 0.79 }, { x: 70, y: 0.83 },
  ];
  const startProb = queryPoints[0].y;
  const flipQuery = 50;
  const flipProb = 0.68;
  yield {
    state: plotState({
      axes: { x: { label: 'model queries', min: 0, max: 80 }, y: { label: 'best target probability', min: 0, max: 1 } },
      series: [
        { id: 'best', label: 'best candidate so far', points: queryPoints },
      ],
      markers: [
        { id: 'start', x: 0, y: startProb, label: 'original' },
        { id: 'flip', x: flipQuery, y: flipProb, label: 'class flips' },
      ],
    }),
    highlight: { active: ['best'], found: ['flip'], compare: ['start'] },
    explanation: `The best-so-far curve across ${queryPoints.length} checkpoints is a useful mental model: starting from probability ${startProb}, the algorithm spends queries testing candidates until the class flips at query ${flipQuery} (probability ${flipProb}).`,
  };

  const guideRows = [
    { id: 'good', label: 'good fit' },
    { id: 'bad', label: 'bad fit' },
    { id: 'knobs', label: 'knobs' },
    { id: 'audit', label: 'audit' },
  ];
  yield {
    state: labelMatrix(
      'Use DE when the score is visible but gradients are not',
      guideRows,
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
    explanation: `DE is a pragmatic search tool covering ${guideRows.length} usage scenarios, not a universal optimizer. It shines when the evaluator is the only thing you can call and the candidate vector is not too huge.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "mutation and crossover" view walks through a single generation of Differential Evolution on a two-dimensional problem. You see five candidates plotted as points. One is selected as the target. Three others play roles: a base point and two points whose difference becomes the mutation direction. An arrow shows the scaled difference vector being added to the base, landing on the mutant. Then crossover mixes coordinates from the target and the mutant to form a trial vector. Finally, greedy selection compares the trial\'s score against the target\'s and keeps whichever is better.',
        {type: 'image', src: './assets/gifs/differential-evolution.gif', alt: 'Animated walkthrough of the differential evolution visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The "black-box attack loop" view shows the same algorithm applied to an adversarial image attack. Each candidate is a five-element vector encoding a pixel location and color. The model\'s confidence becomes the fitness score. A best-so-far curve tracks how query budget converts into better attacks. Watch for the moment the target class flips -- that is the point where the population\'s accumulated geometry finally produced a candidate that fools the classifier.',
        'In both views, highlighted cells mark the active operation. Green marks candidates that survive selection. Orange marks values being compared. Step through slowly to see how the population\'s own spread determines where the next candidate lands.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many optimization problems hand you a score but nothing else. You can evaluate a candidate -- run a simulation, query a model, measure a physical system -- and get back a number. You cannot take the derivative of that number with respect to your parameters. The objective might be noisy, discontinuous, or defined only by a black-box program. Gradient descent is off the table. Grid search is off the table once you pass four or five dimensions. You need a method that can explore a real-valued parameter space using only candidate evaluations.',
        {type: 'callout', text: 'Differential Evolution turns population differences into candidate moves, so the search learns step directions from the geometry it has already sampled.'},
        'Differential Evolution (DE) was introduced by Storn and Price in 1997 for exactly this setting. It maintains a population of candidate solution vectors. Each generation, it creates new candidates by combining existing ones through a mutation operator that uses the difference between two population members as a step direction. That difference is not random noise; it encodes real geometric information about where the population has already explored. The result is a search that adapts its step sizes and directions to the landscape it has sampled so far, without ever computing a gradient.',
        'The practical value is large. Tuning a controller with five gains, calibrating a simulator with ten constants, searching for an adversarial perturbation to a neural network, optimizing an antenna shape for a target frequency response -- all of these expose a score long before they expose a smooth surface. DE fills the gap between random guessing and gradient-based optimization for continuous parameter spaces.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest thing to try is random search. Sample vectors uniformly inside the parameter bounds, evaluate each one, keep the best. Random search is honest: it makes no assumptions about the landscape and never gets stuck in a local basin. For very low-dimensional problems or when computation is nearly free, it can be competitive. But it throws away geometry. If candidate A scored 3.2 and candidate B scored 7.1, random search learns nothing about which direction to move or how far. Every new sample is independent of every previous one.',
        'The next attempt is a local search: take the current best candidate, add Gaussian noise to each coordinate, evaluate the perturbed vector, and keep it if it improves. This reuses the best-so-far information, which is progress. But it introduces a fragile parameter: the noise scale. If the standard deviation is 0.01 on a coordinate that needs to move by 5.0, the search will take thousands of steps to get there. If the standard deviation is 5.0 on a coordinate that is already well-tuned, the search will wastefully jitter around the optimum. You need a different noise scale for each coordinate, and you do not know what those scales should be.',
        'You could try adapting the noise scale over time, shrinking it as the search progresses. Simulated annealing does something like this. But a single candidate still explores one region at a time. If the landscape has multiple basins, you are betting everything on the starting point. A population of candidates exploring simultaneously would hedge that bet, but then you need a rule for how the candidates should influence each other. That is exactly what Differential Evolution provides.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the step-size problem. Every mutation-based optimizer must decide how far to move a candidate and in what direction. Fixed step sizes are wrong for most problems because different coordinates have different sensitivities and the right scale changes as the search progresses. Early on you want large steps to cover the space; late in the search you want small steps to refine a promising basin. Coordinate-wise, one parameter might span [0, 1] while another spans [0, 10000], so a single noise magnitude is either too large for one or too small for the other.',
        'Gradient methods solve this elegantly: the gradient itself encodes both direction and a local scale. But when gradients are unavailable, you need another source of directional information. Random noise is directionless by construction. Historical best-so-far gives you a point but not a direction. Maintaining a covariance matrix (as CMA-ES does) works but adds quadratic memory and computation in the number of dimensions.',
        'The wall, then, is: how do you get a meaningful step direction and scale from the information a population-based search already has, without computing gradients, without storing a full covariance matrix, and without hand-tuning per-coordinate noise? The answer needs to be simple enough to implement in a few lines, robust enough to work across problem types, and cheap enough to run at population scale every generation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The insight is: use the difference between two existing population members as the mutation step. If you have candidates b and c, the vector (b - c) is a direction and magnitude that already lives in the problem\'s coordinate system. It is large when the population is spread out and small when the population has converged. It automatically scales per-coordinate because the difference reflects the actual range the population occupies along each axis. No covariance matrix, no hand-tuned noise, no gradient -- just subtraction.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ackley.gif/250px-Ackley.gif', alt: 'Differential Evolution population minimizing the two-dimensional Ackley function', caption: 'A live population exploring the Ackley function makes the mutation-selection loop visible as moving candidate points. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ackley.gif/250px-Ackley.gif'},
        'The full mutation formula is: v = a + F * (b - c), where a is a base vector (another population member), F is a scalar scaling factor (typically 0.5 to 1.0), and b and c are two distinct members chosen to provide the difference. The base point a decides where the step starts. The difference (b - c) decides the direction and natural scale. F lets you control how aggressive the step is. Three population members collaborate to produce one candidate move, and that move inherits the population\'s own geometry.',
        'This is the idea that makes DE distinct from other evolutionary algorithms. Genetic algorithms cross bit strings. Evolution strategies add Gaussian noise. Particle swarm follows velocity vectors toward personal and global bests. DE uniquely builds its perturbation from the arithmetic difference of actual candidates. The population is both the search state and the source of search directions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize a population of P vectors sampled uniformly within the parameter bounds. P is typically 5 to 10 times the number of dimensions. Evaluate every initial candidate to get its fitness score. These P scored vectors are the starting generation.',
        'For each target vector x_i in the current generation, select three distinct population members a, b, c (none of them x_i). Compute the mutant: v = a + F * (b - c). This is the DE/rand/1 strategy -- "rand" because a is chosen randomly, "1" because one difference vector is used. Other strategies exist: DE/best/1 uses the current best candidate as the base, DE/rand/2 uses two difference vectors, and DE/current-to-best/1 blends the target with a step toward the best. The classic DE/rand/1/bin is the standard starting point.',
        'After mutation, apply binomial crossover. For each coordinate j, draw a uniform random number. If it falls below the crossover rate CR (typically 0.7 to 0.9), the trial vector u takes coordinate j from the mutant v; otherwise it keeps coordinate j from the target x_i. At least one coordinate must come from the mutant (enforced by choosing a random index j_rand that always inherits from v). This ensures the trial differs from the target in at least one dimension.',
        'Enforce parameter bounds on the trial vector. Common strategies are clipping to the nearest bound, reflecting off the bound, or resampling the violating coordinate uniformly. Then evaluate the trial\'s fitness. If the trial scores at least as well as the target (for minimization: f(u) <= f(x_i)), the trial replaces the target in the next generation. Otherwise the target survives unchanged. This is greedy one-to-one selection -- each slot runs its own tournament, and the population never gets worse under the measured objective.',
        'Repeat for all P targets to complete one generation. Then start the next generation. Continue until the budget of function evaluations is exhausted, the population converges below a tolerance, or a target fitness is reached.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'DE has no theorem guaranteeing convergence to a global optimum in finite time on arbitrary landscapes. Its effectiveness is structural, not proven. Three mechanisms combine to make it a reliable searcher in practice.',
        'First, self-adaptive step sizes. The population\'s spread determines the mutation magnitude. Early in the search, candidates are scattered and differences are large, producing exploratory steps. As the population clusters around good regions, differences shrink and steps become refinement moves. This happens without any explicit schedule or parameter decay -- it is an emergent property of using population differences.',
        'Second, diversity through multiple candidates. P independent slots explore simultaneously. Unlike a single-candidate hill climber, DE maintains coverage of multiple basins. If one candidate is stuck in a local minimum, others may be exploring a better region, and their differences can pull the stuck candidate out through mutation. The population is a hedge against premature convergence.',
        'Third, strict quality control through greedy selection. Every replacement is evidence-based: the trial must actually score better than the target it would replace. The population never accepts a worse candidate on faith. Combined with the other two mechanisms, this means DE explores broadly, steps at problem-appropriate scales, and only locks in measured improvements. That combination is enough to work well on a wide class of nonconvex, noisy, and multimodal landscapes, even without theoretical guarantees.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is function evaluations. Each generation evaluates P trial vectors. Over G generations, that is P * G evaluations total (plus P for initialization). The vector arithmetic -- subtraction, scaling, crossover masking -- is O(D) per candidate where D is the number of dimensions, which is almost always negligible compared to the cost of the objective function. Memory is O(P * D) for the population plus O(P) for the fitness values.',
        'Concrete example: a population of 50 candidates in 10 dimensions, run for 200 generations, produces 10,000 function evaluations. If each evaluation takes 1 millisecond (a simple simulation), the entire run finishes in 10 seconds. If each evaluation takes 10 seconds (a complex physics simulation), the run takes about 28 hours. The objective function is the budget bottleneck, and that fact should drive every design decision about population size and generation count.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG/250px-DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG', alt: 'Differential Evolution meta-fitness landscape over tuning parameters', caption: 'DE itself has a search landscape: population size, mutation scale, and crossover settings change how quickly evaluations become evidence. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG/250px-DE_Meta-Fitness_Landscape_%28Sphere_and_Rosenbrock%29.JPG'},
        'Parallelism helps significantly. All P trial evaluations within a generation are independent and can run concurrently on P cores or GPU threads. This reduces wall-clock time by up to a factor of P but does not reduce the total number of evaluations. The algorithm is embarrassingly parallel at the evaluation level, which makes it a natural fit for cluster computing, cloud batch jobs, and simulation farms.',
        'Tuning DE\'s own parameters -- F, CR, and P -- is itself an optimization problem. F too low produces timid steps; F too high produces wild jumps that rarely improve. CR too low changes only one coordinate per trial, which is slow in high dimensions; CR too high loses the target\'s good coordinates. P too small loses diversity; P too large wastes evaluations. Adaptive variants like JADE and SHADE learn F and CR during the run by tracking which settings produced successful replacements.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Engineering design optimization is the classic application. NASA used evolutionary methods including DE to design the X-band antenna for the ST5 spacecraft. The objective was electromagnetic performance simulated by a field solver, which returns a score but no gradient with respect to antenna geometry parameters. DE explored a space of wire shapes and lengths to find designs that met gain and bandwidth requirements -- shapes no human engineer would have drawn.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/St_5-xband-antenna.jpg/250px-St_5-xband-antenna.jpg', alt: 'NASA ST5 evolved X-band antenna', caption: 'Antenna design is a classic optimization setting where a simulator can score candidates long before a simple derivative is available. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/St_5-xband-antenna.jpg/250px-St_5-xband-antenna.jpg'},
        'Adversarial machine learning uses DE for black-box attacks. The One Pixel Attack encodes a perturbation as a 5-element vector (x, y, r, g, b) and uses DE to find a single pixel change that flips a classifier\'s prediction. The classifier is queried as a black box returning class probabilities. DE needs only a few hundred queries to find effective attacks on standard image classifiers, which is far fewer than random search because the population differences direct the search toward sensitive pixel locations and colors.',
        'Other applications include calibrating simulation parameters for physical systems (hydrology, chemical engineering, power systems), tuning hyperparameters of machine learning models when the training pipeline is treated as a black box, optimizing control system gains where each evaluation requires a rollout, and fitting nonlinear models to experimental data where the residual surface is rough. DE appears in SciPy as scipy.optimize.differential_evolution, making it accessible as a drop-in optimizer for any Python-callable objective.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DE fails relative to gradient descent whenever gradients are available and reliable. On a smooth, convex, 1000-dimensional function, gradient descent with line search will converge in a few hundred steps. DE with a population of 5000 will need millions of evaluations to reach the same accuracy. If you can differentiate your objective, do so. DE is for the problems where you genuinely cannot.',
        'High dimensionality is a fundamental weakness. Binomial crossover changes a random subset of coordinates, but in 500 dimensions, changing 350 coordinates at once (CR = 0.7) is unlikely to produce a coherent improvement. The trial differs from the target in too many places, and most changes are harmful. Effective DE in high dimensions requires either very large populations (expensive), problem-specific crossover strategies, or dimensionality reduction before optimization.',
        'Noisy objectives break greedy selection. If the fitness function returns different values for the same input due to stochastic simulation or measurement noise, a trial might replace a target based on a lucky evaluation rather than genuine improvement. Over many generations, this noise accumulates and the population drifts. Mitigations include averaging multiple evaluations per candidate (which multiplies cost), using statistical tests instead of direct comparison, or switching to noise-tolerant selection schemes.',
        'DE also struggles with heavily constrained problems where most of the parameter space is infeasible. Mutation and crossover can easily produce vectors that violate constraints. Simple bound clipping works for box constraints, but nonlinear constraints (like "parameter 3 must be less than the square of parameter 7") require repair operators or penalty functions that are themselves design choices. If the feasible region is a thin, curved manifold in the parameter space, DE will spend most of its evaluations on infeasible candidates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Minimize f(x, y) = (x - 3)^2 + (y - 5)^2 over the bounds x in [0, 10], y in [0, 10]. The global minimum is obviously at (3, 5) with f = 0. We use this simple function to trace the mechanics, not because DE is needed here.',
        'Initialize P = 4 candidates randomly: x0 = (1.0, 8.0) with f = 13.0; x1 = (7.0, 2.0) with f = 25.0; x2 = (5.0, 6.0) with f = 5.0; x3 = (2.0, 1.0) with f = 17.0. Set F = 0.8 and CR = 0.9.',
        'Process target x0 = (1.0, 8.0). Select a = x2 = (5.0, 6.0), b = x3 = (2.0, 1.0), c = x1 = (7.0, 2.0). Compute difference: b - c = (2.0 - 7.0, 1.0 - 2.0) = (-5.0, -1.0). Scale: F * (b - c) = 0.8 * (-5.0, -1.0) = (-4.0, -0.8). Mutant: v = a + F * (b - c) = (5.0 - 4.0, 6.0 - 0.8) = (1.0, 5.2). Both coordinates are within bounds. Apply crossover with CR = 0.9: suppose both coins land below 0.9, so the trial u = (1.0, 5.2), inheriting both coordinates from the mutant. Evaluate: f(1.0, 5.2) = (1.0 - 3)^2 + (5.2 - 5)^2 = 4.0 + 0.04 = 4.04. Compare to f(x0) = 13.0. Since 4.04 < 13.0, the trial replaces x0. The population improves in this slot.',
        'Process target x1 = (7.0, 2.0). Select a = x0_new = (1.0, 5.2), b = x3 = (2.0, 1.0), c = x2 = (5.0, 6.0). Difference: (-3.0, -5.0). Scaled: (-2.4, -4.0). Mutant: (1.0 - 2.4, 5.2 - 4.0) = (-1.4, 1.2). Clip x to bound: x = 0.0. So v = (0.0, 1.2). Suppose crossover keeps both mutant coordinates. Evaluate: f(0.0, 1.2) = 9.0 + 14.44 = 23.44. Compare to f(x1) = 25.0. Since 23.44 < 25.0, the trial replaces x1. Even a modest improvement survives.',
        'After processing all four targets, the population has moved closer to (3, 5). The differences between the updated candidates are smaller than the original differences, so the next generation\'s mutation steps will be naturally smaller. This is the self-adaptive step size in action: no schedule, no decay parameter, just the population\'s geometry shrinking as it converges. Run this for 20-30 generations and all four candidates cluster near (3, 5) with fitness values near zero.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Storn and Price, "Differential Evolution -- A Simple and Efficient Heuristic for Global Optimization over Continuous Spaces," Journal of Global Optimization, 1997 (https://doi.org/10.1023/A:1008202821328). The original technical report with implementation details is at https://www1.icsi.berkeley.edu/~storn/TR-95-012.pdf. For a production-ready implementation, see SciPy\'s scipy.optimize.differential_evolution (https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.differential_evolution.html).',
        'The One Pixel Attack paper by Su, Vargas, and Sakurai (https://arxiv.org/abs/1710.08864) is the clearest demonstration of DE as a black-box attack tool. For adaptive DE variants that tune F and CR during the run, read Zhang and Sanderson\'s JADE paper and Tanabe and Fukunaga\'s SHADE paper.',
        'Study Evolutionary Search first for the broader population-based optimization framework. Then read Gradient Descent to understand the tool DE is most often compared against. Bayesian Optimization offers a contrasting black-box approach that builds a surrogate model instead of relying on population differences. For applications, look at Hyperparameter Search and Neural Architecture Search for evaluation-budget discipline in machine learning contexts.',
      ],
    },
  ],
};
