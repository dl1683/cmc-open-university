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
      heading: 'What it is',
      paragraphs: [
        'Differential Evolution is a population-based optimizer for problems where the score is available but gradients are not. Instead of moving one point downhill, it keeps a population of candidate vectors. For each target vector, it samples other members, forms a difference vector, scales that difference, adds it to a base vector, crosses the result with the target, evaluates the trial, and keeps whichever candidate scores better.',
        'The central formula is simple: mutant = a + F * (b - c). The difference b - c is not symbolic biology; it is a search direction extracted from the current population. If candidates are spread out, steps are larger. If the population has narrowed around a basin, steps shrink. That is why DE often behaves well on black-box numerical optimization without requiring hand-written derivatives.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DE generation has three practical moves. Mutation creates a mutant vector from existing population members. Crossover chooses which coordinates come from the target and which come from the mutant, creating a trial vector. Selection evaluates the trial and replaces the target only if the trial is better. This greedy replacement makes progress easy to understand: each population slot is either preserved or improved under the objective.',
        'The algorithm connects directly to Evolutionary Search, Hyperparameter Search, Neural Architecture Search, and One-Pixel Attack Case Study. In the one-pixel attack, a candidate vector is x, y, red, green, and blue; the black-box classifier supplies the fitness score. In systems work, the same pattern can tune policy parameters, simulator knobs, or non-differentiable latency/quality tradeoffs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is dominated by objective evaluations. If a population has P candidates and runs for G generations, the loop performs about P * G score calls, plus cheap vector arithmetic. That is fine when an evaluation is milliseconds and painful when each evaluation means training a model. DE also struggles as dimensionality grows unless the budget, population size, bounds, and mutation strategy are chosen carefully.',
        'The knobs matter. F controls the mutation scale. The crossover rate controls how aggressively the mutant rewrites coordinates. Population size trades exploration against cost. Bounds and repair rules decide what happens when a vector leaves the legal domain. A serious experiment reports seeds, budgets, baselines, and variance rather than one lucky curve.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DE appears in engineering design, parameter estimation, simulation calibration, adversarial machine learning, robotics, signal processing, operations research, and AutoML-style searches. Its appeal is not that it is the mathematically purest optimizer. Its appeal is that many real systems expose a score function long before they expose a useful gradient. If you can call the evaluator and the candidate is a bounded vector, DE is often a defensible baseline.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use DE just because a problem feels mysterious. If gradients are cheap and reliable, Gradient Descent and its variants will often scale better. Do not compare DE to weak baselines with a much larger evaluation budget. Do not confuse black-box success with causal understanding: DE can find a high-scoring candidate without explaining why the system behaved that way. Pair it with diagnostics, ablations, and domain constraints.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Storn and Price, Differential Evolution, at https://doi.org/10.1023/A:1008202821328. The original technical report is mirrored at https://www1.icsi.berkeley.edu/~storn/TR-95-012.pdf. For an applied black-box attack, read One Pixel Attack for Fooling Deep Neural Networks at https://arxiv.org/abs/1710.08864. For a production-grade implementation reference, see SciPy differential_evolution at https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.differential_evolution.html. Study Evolutionary Search, One-Pixel Attack Case Study, Hyperparameter Search, Neural Architecture Search, and Gradient Descent next.',
      ],
    },
  ],
};
