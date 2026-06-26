// Evolutionary search: keep a population, generate variants, score them with
// an evaluator, and let selection ratchet the population toward better code,
// hyperparameters, or algorithms.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'evolutionary-search',
  title: 'Evolutionary Search',
  category: 'Concepts',
  summary: 'Population, mutation, crossover, selection: optimization when gradients are absent or the search space is weird.',
  controls: [
    { id: 'mode', label: 'Search mode', type: 'select', options: ['classic population loop', 'differential evolution step'], defaultValue: 'classic population loop' },
  ],
  run,
};

const fitness = (x) => Math.max(0, 30 - (x - 7.2) ** 2 - 0.8 * Math.sin(3 * x));
const curve = Array.from({ length: 81 }, (_, i) => {
  const x = i / 8;
  return { x, y: fitness(x) };
});

function populationPlot(values, label = 'fitness landscape') {
  return plotState({
    axes: { x: { label: 'candidate value', min: 0, max: 10 }, y: { label: 'score', min: 0, max: 32 } },
    series: [{ id: 'landscape', label, points: curve }],
    markers: values.map((x, i) => ({ id: `c${i}`, x, y: fitness(x), label: `${x.toFixed(1)} -> ${fitness(x).toFixed(1)}` })),
  });
}

function leaderboard(values, title) {
  const sorted = [...values].sort((a, b) => fitness(b) - fitness(a));
  return matrixState({
    title,
    rows: sorted.map((x, i) => ({ id: `r${i}`, label: `rank ${i + 1}` })),
    columns: [{ id: 'x', label: 'candidate' }, { id: 'score', label: 'score' }, { id: 'role', label: 'role' }],
    values: sorted.map((x, i) => [x, fitness(x), i < 2 ? 1 : 2]),
    format: (v) => {
      if (v === 1) return 'parent';
      if (v === 2) return 'discard';
      return Number(v).toFixed(2);
    },
  });
}

function* classicLoop() {
  const start = [0.8, 2.4, 5.4, 8.9];
  yield {
    state: populationPlot(start),
    highlight: {},
    explanation: 'Evolutionary search starts with a population, not one guess. Each marker is a candidate solution on a rugged score surface. Unlike Gradient Descent, we do not need derivatives; we only need an evaluator that can score a candidate.',
  };

  yield {
    state: leaderboard(start, 'Selection: keep the strongest parents'),
    highlight: { active: ['r0', 'r1'] },
    explanation: 'Evaluate every candidate and select the best few as parents. Selection is the pressure that makes the population improve instead of wandering randomly. The price is evaluator calls: every generation spends real compute on scoring.',
    invariant: 'No score, no search. The evaluator is the source of truth.',
  };

  const children = [5.4, 8.9, 6.15, 7.55, 6.85, 8.25];
  yield {
    state: populationPlot(children),
    highlight: { active: ['c2', 'c3', 'c4', 'c5'], found: ['c0', 'c1'] },
    explanation: 'Generate children by recombining and mutating the parents. Crossover blends good partial structure; mutation pushes into nearby unexplored space. The best systems tune this pressure: too little mutation stalls, too much mutation becomes random search.',
  };

  const next = [6.15, 7.55, 6.85, 8.25];
  yield {
    state: leaderboard(next, 'Next generation after survivor selection'),
    highlight: { active: ['r0', 'r1', 'r2', 'r3'] },
    explanation: 'Survivor selection forms the next generation. Notice what was learned: the population moved toward the high-score region around x = 7 without ever computing a gradient. That is why evolutionary methods work for discrete code, simulator objectives, non-differentiable metrics, and black-box APIs.',
  };

  yield {
    state: populationPlot([6.6, 7.0, 7.25, 7.55]),
    highlight: { found: ['c1', 'c2'] },
    explanation: 'After a few generations, the population clusters near the optimum. This is the pattern AlphaEvolve scales up: proposals are programs, mutation is code editing by LLMs, and the evaluator is a test suite, benchmark, or proof checker.',
  };
}

function* differentialEvolution() {
  const start = [1.1, 3.2, 5.8, 8.6];
  yield {
    state: populationPlot(start),
    highlight: { active: ['c0', 'c1', 'c2', 'c3'] },
    explanation: 'Differential Evolution is a sharp variant of evolutionary search for numeric vectors. Instead of inventing a mutation scale by hand, it uses differences between existing candidates: target + F * (a - b). The population teaches itself the scale of useful moves.',
  };

  const target = start[1];
  const a = start[3];
  const b = start[0];
  const trial = target + 0.65 * (a - b);
  yield {
    state: populationPlot([target, a, b, trial]),
    highlight: { active: ['c0'], compare: ['c1', 'c2'], found: ['c3'] },
    explanation: `Pick target ${target.toFixed(1)}, then borrow the population difference (${a.toFixed(1)} - ${b.toFixed(1)}) and scale it by F = 0.65. The trial lands at ${trial.toFixed(2)}. This is mutation with geometry: big population spread creates big jumps; convergence naturally shrinks them.`,
  };

  yield {
    state: matrixState({
      title: 'Selection is a tournament against the target',
      rows: [{ id: 'target', label: 'target' }, { id: 'trial', label: 'trial' }],
      columns: [{ id: 'x', label: 'candidate' }, { id: 'score', label: 'score' }, { id: 'verdict', label: 'verdict' }],
      values: [[target, fitness(target), 1], [trial, fitness(trial), 2]],
      format: (v) => {
        if (v === 1) return 'replace if worse';
        if (v === 2) return fitness(trial) > fitness(target) ? 'wins' : 'loses';
        return Number(v).toFixed(2);
      },
    }),
    highlight: { active: ['trial:verdict'] },
    explanation: `The trial scores ${fitness(trial).toFixed(2)} versus the target\'s ${fitness(target).toFixed(2)}, so it replaces the target. Differential Evolution is simple, embarrassingly parallel, and surprisingly strong when the objective is noisy, irregular, or impossible to differentiate.`,
  };

  yield {
    state: populationPlot([1.1, trial, 5.8, 8.6]),
    highlight: { found: ['c1'] },
    explanation: 'One local improvement has entered the population. Repeat this tournament for every target, generation after generation. The algorithm is just mutation plus selection, but the mutation is anchored in population geometry instead of a fixed random step.',
    invariant: 'Keep the trial only if the evaluator says it is better. The algorithm never trusts plausibility over measured score.',
  };
}

export function* run(input) {
  const mode = String(input.mode);
  if (mode === 'classic population loop') yield* classicLoop();
  else if (mode === 'differential evolution step') yield* differentialEvolution();
  else throw new InputError('Pick an evolutionary-search mode.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation runs two modes. The classic population loop shows four candidates on a rugged fitness landscape, scores them, selects the best two as parents, breeds children through crossover and mutation, then forms the next generation. The differential evolution mode shows one target-vs-trial tournament: pick a target, compute a trial from population differences, and replace the target only if the trial scores higher.',
        {
          type: 'callout',
          text: 'Evolutionary search turns a black-box evaluator into pressure over a population: score candidates, keep better structure, and vary what survives.',
        },
        'Active markers are the candidates currently being evaluated or mutated. Found markers are candidates that survived selection and entered the next generation. Visited markers are candidates that lost a tournament or were discarded by survivor selection.',
        'At each frame, track which candidates survived and why. The only reason a candidate persists is that the evaluator scored it higher than the alternative. No gradient, no model of the landscape, just measured score.',
        {type: 'image', src: './assets/gifs/evolutionary-search.gif', alt: 'Animated walkthrough of the evolutionary search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many optimization problems have no usable gradient. The objective might be a simulator that returns a single score, a test suite that reports pass/fail counts, a benchmark with noisy results, or a human preference model that only ranks candidates. Gradient descent requires a differentiable loss surface with a computable derivative at every point. When the search space is discrete (code, circuit layouts, schedules), noisy, or hidden behind an API, that requirement fails.',
        'Evolutionary search needs only one thing from the problem: a fitness function that takes a candidate and returns a number. The candidate can be a bit string, a real-valued vector, a neural architecture specification, a compiler flag set, or an entire program. The fitness function can be as simple as "run this code and count how many tests pass." Given that single interface, the algorithm turns random variation into directed improvement across a population.',
        'This makes evolutionary search the natural outer loop for modern AI workflows. When a language model can propose code variants but only an external judge can score them, you need a method that converts generation into optimization without ever differentiating through the judge.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest gradient-free optimizer is hill climbing. Start with one random candidate, make a small change (flip a bit, nudge a parameter), evaluate the new candidate, and keep it if the score improved. This works on smooth, unimodal landscapes, but any problem with multiple peaks traps it in the nearest local optimum.',
        'Simulated annealing improves on hill climbing by occasionally accepting worse candidates. A "temperature" parameter starts high (accepting many bad moves) and decreases over time (becoming pickier). This lets the search escape shallow local optima. But it still maintains only one candidate at a time, so it explores the space serially and can waste many evaluations climbing out of the same basin repeatedly.',
        'Random restart hill climbing runs multiple independent hill climbs from different starting points. Each run finds its local optimum, and you keep the best. This is parallel, but it wastes information: each run learns nothing from the others. A run that lands near a great region cannot share that knowledge with a run stuck in a bad region.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Single-candidate methods hit a fundamental limitation: they cannot transfer partial structure between solutions. Suppose candidate A has a good left half and candidate B has a good right half. Hill climbing on A will never discover B\'s right half because the path from A to B passes through bad intermediate states. Random restart might find both eventually, but it has no mechanism to combine them.',
        'The cost grows with landscape ruggedness. A landscape with k local optima can require O(k) restarts to find the global optimum with constant probability. Real problems in circuit design, scheduling, and program synthesis have astronomically many local optima. Serial search through that space is not tractable.',
        'The missing piece is a way to maintain multiple candidates simultaneously and recombine their good parts. That requires a population, a selection mechanism, and variation operators that can blend structure across candidates.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Maintain a population of candidates, not one. Each generation, evaluate every candidate with the fitness function, select the best as parents, and produce children by recombining parents (crossover) and introducing small random changes (mutation). The children become the next generation. Repeat.',
        'Selection is the engine. It converts random variation into directional pressure. Without selection, mutation and crossover produce a random walk. With selection, the population concentrates around high-scoring regions generation after generation. The key monotonic property: the best score in the population never decreases if you always keep the best candidate (elitism).',
        'The deeper insight is that the algorithm knows nothing about the problem. It does not model the landscape, compute gradients, or learn a surrogate. All improvement comes from the evaluator\'s scores filtered through selection. This makes the method domain-agnostic: the same loop optimizes antenna shapes, neural network hyperparameters, trading strategies, and program code.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize: create N candidates, usually by random sampling across the search space. Each candidate is a chromosome, which is a fixed-length representation of a solution. For bit-string problems, this is a binary vector. For continuous optimization, it is a real-valued vector. For program synthesis, it might be an abstract syntax tree.',
        'Evaluate: run the fitness function on every candidate. This is often the expensive step. If the evaluator is a physics simulator or a neural network training run, each evaluation can take seconds to hours. The algorithm\'s sample efficiency (progress per evaluation) matters more than its wall-clock speed.',
        'Select parents: pick candidates to reproduce. Tournament selection draws k candidates at random and picks the best. Roulette-wheel selection picks with probability proportional to fitness. Rank selection sorts by fitness and assigns selection probability by rank, which avoids domination by a single very fit candidate.',
        'Crossover: combine two parents to produce one or two children. Single-point crossover picks a random position and swaps everything after it. Two-point crossover swaps a segment. Uniform crossover flips a coin at each position. The bet is that good building blocks (short, high-fitness subsequences called schemata) will survive crossover and combine.',
        'Mutation: flip each bit with probability p_m (typically 1/L where L is chromosome length) or add Gaussian noise to each real-valued gene. Mutation maintains diversity and prevents premature convergence where the population collapses to copies of one candidate.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Estimation_of_Distribution_Algorithm_animation.gif',
          alt: 'Animated population search converging around high-scoring regions',
          caption: 'Population methods repeatedly sample, score, and reshape candidate distributions around better regions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Estimation_of_Distribution_Algorithm_animation.gif',
        },
        'Replace: form the next generation. Generational replacement discards all parents and uses only children. Steady-state replacement inserts children one at a time, replacing the worst current member. Elitism copies the best k candidates unchanged into the next generation, guaranteeing the best score never drops.',
        'Differential Evolution (DE) is a variant for continuous optimization that replaces crossover and mutation with a geometric operator. For each target vector x_i, pick three other population members a, b, c at random. Compute a mutant vector: v = a + F * (b - c), where F is a scaling factor typically between 0.5 and 1.0. Then do binomial crossover between v and x_i: for each dimension, use the mutant\'s value with probability CR, otherwise keep the target\'s value. If the resulting trial vector scores better than x_i, it replaces x_i. Otherwise x_i survives unchanged.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on two properties: selection pressure and variation. Selection ensures that high-fitness candidates contribute more offspring to the next generation. Over time, this biases the population toward better regions of the search space. Variation (mutation and crossover) ensures the population does not collapse to a single point, maintaining the ability to discover new solutions.',
        'Holland\'s Schema Theorem (1975) gives a more formal argument for genetic algorithms. A schema is a pattern like 1**0*1 that matches multiple chromosomes. Short, low-order schemata with above-average fitness receive exponentially increasing representation in the population across generations. This means useful building blocks propagate faster than they are destroyed by crossover, provided the building blocks are short relative to the chromosome.',
        'For Differential Evolution, convergence follows from the greedy selection rule. Each target vector is replaced only by a trial that scores strictly better. The population\'s mean fitness is monotonically non-decreasing. Combined with the self-adaptive step size (large population spread produces large mutations; convergence shrinks mutations automatically), DE reliably contracts around optima on continuous landscapes.',
        'Neither method guarantees finding the global optimum in finite time. Both are heuristics. But with sufficient population size and generation count, they concentrate probability mass on high-fitness regions, and elitism ensures the best-found solution is never lost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each generation costs O(N) fitness evaluations, where N is the population size. Selection, crossover, and mutation are O(N * L) where L is the chromosome length, but in practice the evaluator dominates. If one evaluation takes T seconds, a generation takes N * T seconds (or N * T / P seconds with P parallel workers).',
        'Total cost is O(G * N) evaluations across G generations. Typical settings: N = 50-200 for continuous problems, N = 100-1000 for combinatorial problems, G = 100-10000 depending on budget. A 100-candidate population running 500 generations spends 50,000 evaluations. If each evaluation is a 10-second simulation, that is about 139 hours sequentially or 1.4 hours with 100 parallel workers.',
        'Memory is O(N * L): store every candidate in the current population. This is almost never the bottleneck. The evaluator\'s cost per call is the bottleneck. Evolutionary methods are sample-inefficient compared to gradient-based optimization, which uses partial derivative information to update in O(L) per step rather than requiring O(N) full evaluations. The tradeoff: gradient methods need differentiability and a smooth loss surface. Evolutionary methods work on anything with a score.',
        'Differential Evolution has the same O(N) evaluations per generation but is embarrassingly parallel: each target-vs-trial tournament is independent and can run on a separate core or machine. The constant overhead per candidate is O(L) for the vector arithmetic, which is negligible.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Antenna design at NASA (2006): the ST5 spacecraft antenna was evolved by a genetic algorithm. The fitness function was an electromagnetic simulation scoring gain pattern and impedance. The evolved antenna outperformed human designs and had an irregular shape no engineer would have proposed. The evaluator (simulation) was expensive but automatable, and the search space (3D wire shapes) had no useful gradient.',
        'Hyperparameter optimization: population-based training (PBT, Jaderberg et al. 2017) runs a population of neural network training jobs in parallel, periodically copying weights from high-performing members and mutating their hyperparameters. This jointly optimizes hyperparameters and weights without the cost of separate grid-search or Bayesian optimization passes.',
        'Program synthesis: Google DeepMind\'s AlphaEvolve (2025) uses evolutionary search where the candidates are programs, mutation is performed by a language model that edits code, and the evaluator is a test suite or mathematical verifier. It discovered a new matrix multiplication algorithm and improved bin-packing heuristics used in Google\'s data centers. The evolutionary loop provides the selection pressure; the LLM provides the variation operator.',
        'Vehicle routing and scheduling: logistics companies use genetic algorithms to optimize delivery routes under constraints (time windows, vehicle capacity, driver hours). The fitness function encodes total distance plus penalty terms for constraint violations. Exact solvers work for small instances; evolutionary methods scale to thousands of stops where branch-and-bound is too slow.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sample efficiency is the primary tax. A gradient step uses O(L) partial derivatives to update L parameters simultaneously. An evolutionary generation uses O(N) full evaluations to update one generation. For problems where gradients exist and the landscape is smooth, evolutionary search is wasteful. Training a standard neural network with a genetic algorithm instead of backpropagation is orders of magnitude slower.',
        'Representation sensitivity: the algorithm\'s performance depends heavily on how solutions are encoded. A bad encoding can make crossover destructive, breaking good solutions more often than combining them. If the building blocks the schema theorem relies on are scattered across the chromosome, crossover tears them apart. Designing a good encoding requires domain knowledge the algorithm itself does not provide.',
        'Premature convergence: if selection pressure is too strong or the population is too small, the population loses diversity and collapses to a single mediocre solution. Once all candidates are near-copies, crossover produces no new information and mutation becomes the only exploration mechanism, which is slow for high-dimensional problems.',
        'Scalability in dimensions: for high-dimensional continuous optimization (thousands of parameters), DE and genetic algorithms struggle. The search space volume grows exponentially, and population-based exploration becomes sparse. Bayesian optimization or CMA-ES (which learns a covariance matrix to guide mutation) handles moderate dimensions better. For very high dimensions, gradient-based methods are the only practical option when they are available.',
        'Evaluator cost: when each fitness evaluation is expensive (hours-long simulations, full training runs), the total budget of G * N evaluations becomes prohibitive. Surrogate-assisted methods fit a cheap model to approximate the evaluator and reduce the number of real evaluations, but building an accurate surrogate is its own challenge.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Concrete trace of one generation of a genetic algorithm, then one step of Differential Evolution.',
        'Genetic algorithm on a 6-bit string. Fitness function: count the number of 1-bits (OneMax problem, maximum fitness = 6). Population of 4:',
        'Candidate A = 101100, fitness = 3. Candidate B = 110011, fitness = 4. Candidate C = 010010, fitness = 2. Candidate D = 111001, fitness = 4.',
        'Tournament selection (k=2): draw {A, C}, pick A (fitness 3 > 2). Draw {B, D}, pick B (fitness 4 = 4, tie broken randomly). Parents are A = 101100 and B = 110011.',
        'Single-point crossover at position 3: A\'s left half is 101, B\'s right half is 011. Child 1 = 101011, fitness = 4. Child 2 = 110100, fitness = 3.',
        'Mutation with p_m = 1/6 per bit. Child 1: bit 2 flips (101011 becomes 111011), fitness = 5. Child 2: no bits flip, stays 110100, fitness = 3.',
        'Generational replacement with elitism (keep best 1): the elite is B = 110011 (fitness 4) or D = 111001 (fitness 4). Keep D. New population: D = 111001 (4), Child 1 = 111011 (5), Child 2 = 110100 (3), plus one more child from a second parent pair. Best fitness improved from 4 to 5 in one generation.',
        'Differential Evolution on 3D vectors. Fitness function: f(x) = -(x1^2 + x2^2 + x3^2), a simple sphere (maximum at origin). Population of 4 vectors:',
        'x0 = [2.0, 3.0, 1.0], f = -(4 + 9 + 1) = -14. x1 = [-1.0, 2.0, -3.0], f = -(1 + 4 + 9) = -14. x2 = [0.5, -1.0, 0.5], f = -(0.25 + 1 + 0.25) = -1.5. x3 = [3.0, 0.0, -2.0], f = -(9 + 0 + 4) = -13.',
        'Target: x0. Pick a = x2, b = x1, c = x3. Scaling factor F = 0.7. Mutant v = x2 + 0.7 * (x1 - x3) = [0.5, -1.0, 0.5] + 0.7 * ([-1.0 - 3.0, 2.0 - 0.0, -3.0 - (-2.0)]) = [0.5, -1.0, 0.5] + 0.7 * [-4.0, 2.0, -1.0] = [0.5 - 2.8, -1.0 + 1.4, 0.5 - 0.7] = [-2.3, 0.4, -0.2].',
        'Binomial crossover with CR = 0.9. For each dimension, draw a uniform random number. Dim 1: 0.32 < 0.9, use mutant: -2.3. Dim 2: 0.87 < 0.9, use mutant: 0.4. Dim 3: 0.95 > 0.9, keep target: 1.0. Trial = [-2.3, 0.4, 1.0], f = -(5.29 + 0.16 + 1.0) = -6.45.',
        'Tournament: trial f = -6.45 vs. target x0 f = -14.0. The trial is better (closer to 0), so it replaces x0. The population\'s best member is still x2 at -1.5, but x0 improved from -14.0 to -6.45 in a single step. Repeat this tournament for every target in the population, and one generation moves the entire population closer to the origin.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Holland, J.H. "Adaptation in Natural and Artificial Systems" (1975) introduced genetic algorithms and the schema theorem. Storn and Price, "Differential Evolution" (1997) defined DE and demonstrated it on benchmark functions. Jaderberg et al., "Population Based Training of Neural Networks" (2017) applied evolutionary ideas to hyperparameter schedules during training.',
        'Google DeepMind, "AlphaEvolve: A Gemini-Powered Coding Agent for Designing Advanced Algorithms" (2025) scaled evolutionary search to program synthesis with LLM-generated mutations. Hansen, "The CMA Evolution Strategy: A Tutorial" (2016) covers covariance matrix adaptation for continuous optimization in moderate dimensions.',
        'Study simulated annealing to understand the single-candidate baseline that evolutionary search improves upon. Study gradient descent and backpropagation to understand the alternative when differentiability is available and why evolutionary methods are sample-inefficient by comparison. Study particle swarm optimization for another population-based metaheuristic with different information sharing. Study Monte Carlo tree search for a different approach to search without gradients that builds a tree rather than a flat population.',
      ],
    },
  ],
};
