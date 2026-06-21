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
        "Read the animation as the execution trace for Evolutionary Search. Population, mutation, crossover, selection: optimization when gradients are absent or the search space is weird..",
        {
          type: "callout",
          text: "Evolutionary search turns a black-box evaluator into pressure over a population: score candidates, keep better structure, and vary what survives.",
        },
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
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
        'Optimize a function with no gradient. Traveling salesman: n! permutations, brute force is impossible for n > 20. Hill climbing: start with a random solution, make small changes, keep improvements. Gets stuck in local optima.',
        'Simulated annealing: accept bad moves with decreasing probability. Better, but one solution at a time.',
        'Genetic Algorithm (Holland 1975): maintain a POPULATION of solutions. Each individual is a chromosome (bit string or sequence). A fitness function scores each one. Selection picks parents proportional to fitness (roulette wheel) or by tournament. Crossover combines two parents via single-point, two-point, or uniform crossover. Mutation randomly flips bits with small probability. Replace the old population with offspring. Repeat for generations.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Estimation_of_Distribution_Algorithm_animation.gif',
          alt: 'Animated population search converging around high-scoring regions',
          caption: 'Population methods repeatedly sample, score, and reshape candidate distributions around better regions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Estimation_of_Distribution_Algorithm_animation.gif',
        },
        'Why it works: crossover recombines good building blocks (schema theorem, Holland 1975). Mutation maintains diversity. Selection drives improvement. The population explores multiple regions of the search space simultaneously, avoiding the single-point trap of hill climbing.',
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
    }
  ],
};
