// CMA-ES: learn a sampling distribution for black-box continuous optimization
// by adapting the mean, covariance matrix, and step size from selected samples.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'cma-es-covariance-adaptation-primer',
  title: 'CMA-ES Covariance Adaptation Primer',
  category: 'Concepts',
  summary: 'A covariance-matrix adaptation primer: sample candidates from a Gaussian, rank them by fitness, move the mean, update covariance, and control step size with evolution paths.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['adaptation loop', 'covariance memory'], defaultValue: 'adaptation loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'mean', label: 'mean', x: 0.8, y: 3.5, note: 'm' },
      { id: 'sample', label: 'sample', x: 2.3, y: 2.0, note: 'N(m,C)' },
      { id: 'eval', label: 'eval', x: 4.0, y: 2.0, note: 'fitness' },
      { id: 'rank', label: 'rank', x: 5.6, y: 3.5, note: 'select' },
      { id: 'path', label: 'path', x: 4.0, y: 5.2, note: 'steps' },
      { id: 'cov', label: 'cov', x: 7.2, y: 2.0, note: 'C' },
      { id: 'sigma', label: 'sigma', x: 7.2, y: 5.2, note: 'scale' },
      { id: 'next', label: 'next', x: 9.0, y: 3.5, note: 'gen' },
    ],
    edges: [
      { id: 'e-mean-sample', from: 'mean', to: 'sample' },
      { id: 'e-sample-eval', from: 'sample', to: 'eval' },
      { id: 'e-eval-rank', from: 'eval', to: 'rank' },
      { id: 'e-rank-path', from: 'rank', to: 'path' },
      { id: 'e-rank-cov', from: 'rank', to: 'cov' },
      { id: 'e-path-cov', from: 'path', to: 'cov' },
      { id: 'e-path-sigma', from: 'path', to: 'sigma' },
      { id: 'e-cov-next', from: 'cov', to: 'next' },
      { id: 'e-sigma-next', from: 'sigma', to: 'next' },
      { id: 'e-next-mean', from: 'next', to: 'mean' },
    ],
  }, { title });
}

function samplePlot(title, adapted = false) {
  const early = [
    { x: 2.3, y: 5.0 }, { x: 2.8, y: 3.7 }, { x: 3.5, y: 5.4 }, { x: 4.0, y: 4.1 },
    { x: 4.3, y: 2.8 }, { x: 5.0, y: 4.5 }, { x: 5.4, y: 3.4 }, { x: 6.0, y: 2.5 },
  ];
  const shaped = [
    { x: 3.0, y: 5.3 }, { x: 3.5, y: 4.8 }, { x: 4.1, y: 4.2 }, { x: 4.8, y: 3.6 },
    { x: 5.3, y: 3.2 }, { x: 5.9, y: 2.7 }, { x: 6.5, y: 2.2 }, { x: 7.0, y: 1.8 },
  ];
  return plotState({
    axes: { x: { label: 'x1', min: 0, max: 9 }, y: { label: 'x2', min: 0, max: 7 } },
    series: [
      { id: adapted ? 'shaped' : 'early', label: adapted ? 'fit' : 'wide', points: adapted ? shaped : early },
    ],
    markers: [
      { id: 'mean', x: adapted ? 5.1 : 4.1, y: adapted ? 3.5 : 3.9, label: 'm' },
      { id: 'best', x: 6.5, y: 2.2, label: 'best' },
    ],
    vectors: adapted ? [
      { id: 'axis', from: { x: 3.7, y: 4.6 }, to: { x: 6.5, y: 2.2 }, label: 'C axis' },
    ] : [
      { id: 'step', from: { x: 4.1, y: 3.9 }, to: { x: 5.1, y: 3.5 }, label: 'mean step' },
    ],
  }, { title });
}

function covarianceTable(title) {
  return labelMatrix(
    title,
    [
      { id: 'var1', label: 'var x1' },
      { id: 'cov12', label: 'cov' },
      { id: 'var2', label: 'var x2' },
      { id: 'sigma', label: 'sigma' },
      { id: 'path', label: 'path' },
    ],
    [
      { id: 'before', label: 'before' },
      { id: 'after', label: 'after' },
    ],
    [
      ['1.0', '2.2'],
      ['0.0', '-1.1'],
      ['1.0', '1.5'],
      ['wide', 'narrow'],
      ['short', 'aligned'],
    ],
  );
}

function* adaptationLoop() {
  yield {
    state: loopGraph('CMA-ES learns a sampling distribution'),
    highlight: { active: ['mean', 'sample', 'eval', 'rank', 'e-mean-sample', 'e-sample-eval', 'e-eval-rank'], found: ['cov'] },
    explanation: 'CMA-ES does not mutate one candidate by a fixed rule. It maintains a Gaussian search distribution, samples a population, ranks samples by fitness, and uses the winners to change the distribution.',
    invariant: 'The population teaches the optimizer where future samples should be more likely.',
  };

  yield {
    state: samplePlot('Early samples explore a broad region'),
    highlight: { active: ['early', 'mean', 'step'], found: ['best'] },
    explanation: 'At the start, the sampling cloud is broad. The mean moves toward selected samples, but the covariance is still generic enough to explore several directions.',
  };

  yield {
    state: covarianceTable('Selected steps reshape the covariance matrix'),
    highlight: { active: ['var1:after', 'cov12:after', 'var2:after', 'path:after'], compare: ['var1:before', 'cov12:before'] },
    explanation: 'Covariance is the memory of useful directions. If selected samples repeatedly move along a diagonal valley, the covariance matrix rotates and stretches the sampling cloud along that valley.',
  };

  yield {
    state: samplePlot('Later samples align with the valley', true),
    highlight: { active: ['shaped', 'axis', 'best'], compare: ['mean'] },
    explanation: 'After adaptation, the distribution is no longer isotropic. It samples more aggressively along directions that previously produced progress and less in directions that wasted evaluations.',
  };
}

function* covarianceMemory() {
  yield {
    state: loopGraph('Evolution paths stabilize adaptation'),
    highlight: { active: ['rank', 'path', 'cov', 'sigma', 'e-rank-path', 'e-path-cov', 'e-path-sigma'], compare: ['sample'] },
    explanation: 'CMA-ES uses evolution paths so one lucky step does not dominate. Paths summarize consecutive successful movement and help decide whether to stretch covariance or change global step size.',
  };

  yield {
    state: labelMatrix(
      'State variables',
      [
        { id: 'm', label: 'mean' },
        { id: 'C', label: 'cov' },
        { id: 'sig', label: 'sigma' },
        { id: 'pc', label: 'path C' },
        { id: 'ps', label: 'path s' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['center', 'sample x'],
        ['shape', 'dirs'],
        ['scale', 'step'],
        ['trend', 'cov'],
        ['trend', 'sigma'],
      ],
    ),
    highlight: { active: ['C:stores', 'sig:stores', 'pc:why', 'ps:why'], found: ['m:stores'] },
    explanation: 'The important data structure is the optimizer state. Mean, covariance, step size, and evolution paths together describe the next search distribution.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'generation', min: 0, max: 20 }, y: { label: 'relative error', min: 0, max: 10 } },
      series: [
        { id: 'fixed', label: 'fixed', points: [{ x: 0, y: 9 }, { x: 5, y: 6.8 }, { x: 10, y: 5.5 }, { x: 15, y: 4.7 }, { x: 20, y: 4.2 }] },
        { id: 'cma', label: 'CMA', points: [{ x: 0, y: 9 }, { x: 5, y: 5.3 }, { x: 10, y: 2.6 }, { x: 15, y: 1.2 }, { x: 20, y: 0.7 }] },
      ],
      markers: [
        { id: 'shape', x: 10, y: 2.6, label: 'shape' },
      ],
    }),
    highlight: { active: ['cma', 'shape'], compare: ['fixed'] },
    explanation: 'On ill-conditioned continuous problems, adapting the search coordinate system can matter more than trying random mutations with one fixed isotropic scale.',
  };

  yield {
    state: labelMatrix(
      'When to use CMA-ES',
      [
        { id: 'good', label: 'good' },
        { id: 'cost', label: 'cost' },
        { id: 'bad', label: 'bad' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'example', label: 'ex' },
      ],
      [
        ['cont', 'tune'],
        ['evals', 'parallel'],
        ['discrete', 'other'],
        ['seed', 'report'],
      ],
    ),
    highlight: { active: ['good:rule', 'cost:example', 'audit:rule'], compare: ['bad:rule'] },
    explanation: 'CMA-ES is strong for continuous black-box optimization with moderate dimension and enough evaluation budget. It is not a replacement for gradients when gradients are cheap and trustworthy.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'adaptation loop') yield* adaptationLoop();
  else if (view === 'covariance memory') yield* covarianceMemory();
  else throw new InputError('Pick a CMA-ES view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'CMA-ES, covariance matrix adaptation evolution strategy, is a stochastic optimizer for continuous black-box problems. It samples a population from a multivariate Gaussian, ranks samples by fitness, moves the mean toward winners, adapts the covariance matrix, and controls a global step size.',
        'This is the next conceptual step after Differential Evolution. Differential Evolution gets mutation directions from population differences. CMA-ES turns successful directions into an explicit sampling distribution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The optimizer state is the data structure: mean vector, covariance matrix, step size, evolution paths, and ranking weights. Each generation samples candidates from the current distribution, evaluates them, sorts by fitness, and uses the best candidates to update the state.',
        'The covariance matrix captures dependencies between variables. If progress repeatedly occurs along a diagonal direction, future samples are stretched along that direction. Evolution paths keep adaptation from overreacting to one lucky generation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The expensive part is objective evaluation. Internally, full covariance adaptation also has linear algebra cost, including covariance updates and decompositions. That makes CMA-ES attractive for moderate-dimensional problems with expensive, non-differentiable, or noisy objectives, but less attractive for huge parameter vectors where gradients or structured search are available.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CMA-ES is used for controller tuning, robotics, simulation calibration, engineering design, benchmark optimization, and hyperparameter-like continuous tuning. It is especially useful when the objective is a simulator or physical process that returns a scalar score but not a useful derivative.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not read one successful run as proof. Report seeds, evaluation budgets, termination criteria, and baseline optimizers. Do not ignore bounds and constraint handling. Do not use CMA-ES where the real problem is discrete structure, symbolic search, or a cheap differentiable objective.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Hansen, The CMA Evolution Strategy tutorial at https://arxiv.org/abs/1604.00772, the CMA-ES official site at https://cma-es.github.io/, and CMA-ES source-code references at https://cma-es.github.io/cmaes_sourcecode_page.html. Study Evolutionary Search, Differential Evolution, PCA, Eigenvectors, Gaussian Process Bayesian Optimization, Hyperparameter Search, and AlphaEvolve next.',
      ],
    },
  ],
};
