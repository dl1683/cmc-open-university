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
      heading: 'What it is',
      paragraphs: [
        'Evolutionary search is a family of black-box optimization methods. Keep many candidates, produce variations, score them, and let better candidates survive. The candidates can be numbers, neural architectures, prompts, compiler flags, routing policies, or whole programs. The evaluator can be a formula, a simulator, a benchmark, a unit test suite, or a human preference model.',
        'The core idea is useful whenever Gradient Descent is unavailable or dishonest. If the objective is discrete, non-differentiable, noisy, or hidden behind an API, gradients may not exist. Evolutionary search only asks one question: did this candidate score better than the old one?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The canonical loop has four parts: initialize a population, evaluate every candidate, select parents or survivors, then generate variants by mutation and crossover. Mutation explores local neighborhoods. Crossover recombines partial structure from multiple candidates. Selection turns random variation into directed improvement.',
        'Differential Evolution makes the mutation step more geometric. For each target vector, choose two other population members a and b, compute a - b, scale it, and add it to a base candidate. The resulting trial competes against the target. This simple difference vector adapts step size to population spread: early search jumps widely, later search narrows naturally.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is evaluation count: population_size times generations. If a generation has 64 candidates and each benchmark run takes 20 seconds, one generation costs over 21 minutes of serial time, though most evaluations can run in parallel. Memory is usually small compared with the evaluator, unless candidates are large programs or models. The right metric is not Big-O alone; it is evaluator calls per useful improvement.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Evolutionary search appears in hyperparameter tuning, neural architecture search, compiler optimization, trading-rule search, robotics controllers, feature selection, and fuzzing. Modern AI systems use the same pattern at larger scale: generate many candidate solutions, verify them with tests or automated judges, and keep the best. AlphaEvolve is a high-end example where LLMs propose code and automatic evaluators supply the selection pressure.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The evaluator is the product. If your benchmark is weak, the search will exploit it. This is not a flaw unique to evolution; it is Goodhart's law applied to optimization. Add holdout tests, adversarial examples, and multiple metrics when possible. Another trap is premature convergence: once every candidate looks similar, mutation loses useful diversity. Keep random restarts, novelty pressure, or island populations when the search space is broad.`,
        'Evolutionary search is not magic proof of creativity. It explores the space you encode and optimizes the score you provide. Its strength is operational: it turns weak proposal mechanisms into strong search when evaluation is cheap, objective, and reliable.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read AlphaEvolve Case Study to see evolutionary search scaled with LLM-generated code. Study Hyperparameter Search for a practical ML version of the same loop. Self-Organizing AI Design Pattern shows why evolutionary and archive-based search matter when the objective is many robust outcomes, not one champion. Then connect it to Beam Search: both keep multiple partial candidates, but beam search expands structured sequences while evolutionary search mutates complete candidates.',
      ],
    },
  ],
};
