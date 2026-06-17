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
    explanation: `The trial scores ${fitness(trial).toFixed(2)} versus the target's ${fitness(target).toFixed(2)}, so it replaces the target. Differential Evolution is simple, embarrassingly parallel, and surprisingly strong when the objective is noisy, irregular, or impossible to differentiate.`,
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
      heading: 'Why this exists',
      paragraphs: [
        'Evolutionary search exists for optimization problems where you can score a candidate but cannot use a trustworthy gradient. The candidate might be a vector, prompt, compiler flag set, routing policy, neural architecture, controller, or whole program. The evaluator might be a simulator, benchmark, unit test suite, loss function, or preference model.',
        'The method is useful when the objective is discrete, non-differentiable, noisy, delayed, or hidden behind an API. It only asks a blunt question: did this candidate score better than the alternatives under the evaluator?',
        'That makes it a useful companion to modern AI workflows. When a model can propose variants but only an external judge, test suite, simulator, or benchmark can score them, evolutionary search provides the outer loop that turns generation into improvement.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is random search: sample many candidates, keep the best one, and hope. That can work when evaluation is cheap and the space is small. It fails when useful structure is rare, when good partial solutions should be reused, or when the search needs to keep improving over generations.',
        'Gradient Descent is the other obvious approach. It fails when there is no differentiable path from candidate to score, or when the objective is a simulator, compiler, judge, or real-world trial that only returns a number.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The canonical loop has four parts: initialize a population, evaluate every candidate, select parents or survivors, then generate variants by mutation and crossover. Mutation explores local neighborhoods. Crossover recombines partial structure from multiple candidates. Selection turns random variation into directed improvement.',
        'Differential Evolution makes the mutation step more geometric. For each target vector, choose two other population members a and b, compute a - b, scale it, and add it to a base candidate. The resulting trial competes against the target. This adapts step size to population spread: early search jumps widely, later search narrows naturally.',
        'The deeper insight is that search pressure comes entirely from the evaluator. The algorithm does not know what a good design means. It preserves and recombines candidates only because measured scores say they are worth keeping.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A generation begins with a population of candidates. The evaluator scores each one. Selection chooses parents, survivors, or elites. Variation creates children through mutation, crossover, recombination, or model-generated edits. The next generation repeats the cycle.',
        'Mutation rate controls exploration. Too little mutation causes premature convergence. Too much mutation turns the search into random sampling. Crossover is useful when candidates have reusable parts, such as hyperparameter blocks, code fragments, or controller subroutines.',
        'Differential Evolution is a concrete numeric variant. It creates a trial vector from population differences, then keeps the trial only if it beats the target. The population itself supplies the step scale, which is why the method is simple and often strong on black-box numeric problems.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'In the classic loop view, watch the population rather than one marker. Selection keeps high-scoring parents, variation creates children near or between them, and survivor selection moves the population toward better regions without ever drawing a gradient arrow.',
        `In the Differential Evolution view, the difference between two candidates becomes a mutation direction. Read the population spread as the algorithm's step-size memory: wide spread creates broad exploration, while convergence naturally shrinks moves.`,
        'The leaderboard proves the role of selection. The search is not magic because it mutates; mutation alone is noise. It becomes search when evaluation decides which variants survive.',
        'The final cluster near the optimum proves both success and risk. The population has found a good region, but it may also have lost diversity. That is when restarts, islands, or novelty pressure become useful.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Evolutionary search works when useful candidates are locally or compositionally related. Mutation can improve a candidate by small changes, and crossover can preserve useful pieces from different candidates.',
        'It also works when the evaluator is cheaper than deriving a gradient or when no gradient exists. The method treats the objective as a black box and spends evaluator calls to map the landscape.',
        'Population diversity is the hedge against local traps. Multiple candidates can explore different regions at once, and selection can keep several promising directions alive instead of committing to one path too early.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The dominant cost is evaluation count: population_size times generations. If a generation has 64 candidates and each benchmark run takes 20 seconds, one generation costs over 21 minutes of serial time, though most evaluations can run in parallel.',
        'Memory is usually small compared with the evaluator, unless candidates are large programs or models. The right metric is not Big-O alone; it is evaluator calls per useful improvement.',
        'The tradeoff is sample efficiency versus generality. Gradient methods can be far more efficient when gradients are valid. Evolutionary search is broader but may burn many evaluations. It is strongest when evaluation is parallelizable and gradients are unavailable or misleading.',
        'There is also a representation tradeoff. A mutation operator that changes meaningless syntax or random bits wastes evaluations. A mutation operator that changes meaningful structure, such as a hyperparameter block or code function, gives selection better material to work with.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Evolutionary search appears in hyperparameter tuning, neural architecture search, compiler optimization, trading-rule search, robotics controllers, feature selection, and fuzzing. Modern AI systems use the same pattern at larger scale: generate many candidate solutions, verify them with tests or automated judges, and keep the best.',
        'AlphaEvolve is a high-end example where LLMs propose code and automatic evaluators supply the selection pressure. The pattern is strongest when generation is cheap enough, evaluation is reliable enough, and the search space rewards incremental variation.',
        'It is also useful when many candidates can be evaluated independently. A cluster can score a generation in parallel, making wall-clock time depend more on the slowest evaluator than on the number of candidates.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The evaluator is the product. If your benchmark is weak, the search will exploit it. This is not a flaw unique to evolution; it is Goodhart's law applied to optimization. Add holdout tests, adversarial examples, and multiple metrics when possible.`,
        'Another trap is premature convergence: once every candidate looks similar, mutation loses useful diversity. Keep random restarts, novelty pressure, or island populations when the search space is broad. Evolutionary search is overkill when gradients are cheap and trustworthy, and dangerous when the evaluator can be gamed.',
        'A third failure is noisy selection. If score variance is high, the algorithm may promote lucky candidates. Reruns, confidence intervals, tournament rules, or robust aggregations can keep noise from becoming the selection signal.',
        'A fourth failure is forgetting the deployment constraint. A candidate can win the offline score while being too slow, too brittle, too expensive, or too hard to audit. Treat latency, cost, safety, and interpretability as part of the fitness function when they matter in production.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read AlphaEvolve Case Study to see evolutionary search scaled with LLM-generated code. Study Hyperparameter Search for a practical ML version of the same loop. Self-Organizing AI Design Pattern shows why evolutionary and archive-based search matter when the objective is many robust outcomes, not one champion. Then connect it to Beam Search: both keep multiple partial candidates, but beam search expands structured sequences while evolutionary search mutates complete candidates.',
        'For implementation practice, build the simplest loop first: a population array, a scorer, an elitism rule, a mutation operator, and a log of every candidate. Once that is honest, add crossover, restarts, islands, or learned proposal models only when the baseline shows where it is stuck.',
      ],
    },
  ],
};
