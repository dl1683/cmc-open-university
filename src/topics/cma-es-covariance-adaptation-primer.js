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
  const loopNodes = 8;
  const loopEdges = 10;
  const populationSize = 8;
  const covParams = 5;

  yield {
    state: loopGraph('CMA-ES learns a sampling distribution'),
    highlight: { active: ['mean', 'sample', 'eval', 'rank', 'e-mean-sample', 'e-sample-eval', 'e-eval-rank'], found: ['cov'] },
    explanation: `CMA-ES does not mutate one candidate by a fixed rule. Across ${loopNodes} loop stages linked by ${loopEdges} edges, it maintains a Gaussian search distribution, samples a population, ranks samples by fitness, and uses the winners to change the distribution.`,
    invariant: `The population of ${populationSize} samples teaches the optimizer where future samples should be more likely.`,
  };

  yield {
    state: samplePlot('Early samples explore a broad region'),
    highlight: { active: ['early', 'mean', 'step'], found: ['best'] },
    explanation: `At the start, the sampling cloud is broad across ${populationSize} candidates. The mean moves toward selected samples, but the covariance is still generic enough to explore several directions.`,
  };

  yield {
    state: covarianceTable('Selected steps reshape the covariance matrix'),
    highlight: { active: ['var1:after', 'cov12:after', 'var2:after', 'path:after'], compare: ['var1:before', 'cov12:before'] },
    explanation: `Covariance is the memory of useful directions. Tracking ${covParams} parameters (variance, covariance, sigma, and paths), if selected samples repeatedly move along a diagonal valley, the covariance matrix rotates and stretches the sampling cloud along that valley.`,
  };

  yield {
    state: samplePlot('Later samples align with the valley', true),
    highlight: { active: ['shaped', 'axis', 'best'], compare: ['mean'] },
    explanation: `After adaptation, the distribution is no longer isotropic. With ${populationSize} shaped samples, it samples more aggressively along directions that previously produced progress and less in directions that wasted evaluations.`,
  };
}

function* covarianceMemory() {
  const stateVars = 5;
  const maxGen = 20;
  const fixedFinal = 4.2;
  const cmaFinal = 0.7;
  const usageCriteria = 4;

  yield {
    state: loopGraph('Evolution paths stabilize adaptation'),
    highlight: { active: ['rank', 'path', 'cov', 'sigma', 'e-rank-path', 'e-path-cov', 'e-path-sigma'], compare: ['sample'] },
    explanation: `CMA-ES uses evolution paths so one lucky step does not dominate. Across ${stateVars} state variables, paths summarize consecutive successful movement and help decide whether to stretch covariance or change global step size.`,
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
    explanation: `The important data structure is the optimizer state. All ${stateVars} variables — mean, covariance, step size, and evolution paths — together describe the next search distribution.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'generation', min: 0, max: maxGen }, y: { label: 'relative error', min: 0, max: 10 } },
      series: [
        { id: 'fixed', label: 'fixed', points: [{ x: 0, y: 9 }, { x: 5, y: 6.8 }, { x: 10, y: 5.5 }, { x: 15, y: 4.7 }, { x: maxGen, y: fixedFinal }] },
        { id: 'cma', label: 'CMA', points: [{ x: 0, y: 9 }, { x: 5, y: 5.3 }, { x: 10, y: 2.6 }, { x: 15, y: 1.2 }, { x: maxGen, y: cmaFinal }] },
      ],
      markers: [
        { id: 'shape', x: 10, y: 2.6, label: 'shape' },
      ],
    }),
    highlight: { active: ['cma', 'shape'], compare: ['fixed'] },
    explanation: `On ill-conditioned continuous problems, adapting the search coordinate system matters: after ${maxGen} generations CMA-ES reaches error ${cmaFinal} while fixed isotropic mutation stalls at ${fixedFinal}.`,
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
    explanation: `CMA-ES is strong for continuous black-box optimization — ${usageCriteria} criteria (continuity, eval budget, parallelism, and audit discipline) determine whether it fits. It is not a replacement for gradients when gradients are cheap and trustworthy.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/cma-es-covariance-adaptation-primer.gif', alt: 'Animated walkthrough of the cma es covariance adaptation primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why CMA-ES exists',
      paragraphs: [
        'CMA-ES exists for continuous black-box optimization. The objective gives you a score for a candidate vector, but it does not give a useful derivative, symbolic structure, or cheap local model. That is common in simulator tuning, controller design, robot policy search, engineering calibration, and noisy benchmark optimization.',
        {type: 'callout', text: 'CMA-ES treats the sampling distribution as the data structure, so successful directions reshape future search.'},
        'The important assumption is not that the landscape is random. The assumption is that good regions have shape. A valley may be long, narrow, rotated, or scaled differently across variables. CMA-ES, short for covariance matrix adaptation evolution strategy, learns that shape while it searches.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The obvious approach is random search around the current best point. Pick a mutation radius, sample a round cloud, evaluate the candidates, keep the best, and repeat. This can work on small friendly problems, but it wastes evaluations when the useful direction is not aligned with the coordinate axes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density curves', caption: 'CMA-ES starts from Gaussian sampling intuition, then replaces the fixed scalar spread with a learned covariance shape. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Normal_Distribution_PDF.svg.'},
        'A fixed round cloud has no memory of direction. If the optimum lies down a diagonal valley, most samples fall into the valley walls instead of along the valley. Shrinking the radius avoids bad jumps but also slows progress. Increasing it explores faster but throws more samples away.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'CMA-ES does not treat mutation as a fixed noise source. It treats the search distribution as the main data structure. The state contains a mean vector, a covariance matrix, a global step size, evolution paths, and weights for the best ranked candidates.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Concept_of_directional_optimization_in_CMA-ES_algorithm.png', alt: 'CMA-ES generations showing an adapting elliptical sampling distribution', caption: 'The orange ellipse makes covariance adaptation visible: selected samples stretch and rotate the next search distribution. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Concept_of_directional_optimization_in_CMA-ES_algorithm.png.'},
        'The mean says where the next population is centered. The covariance matrix says which directions should be sampled more or less often. The step size says how large the overall cloud should be. Together they form a moving coordinate system learned from successful samples.',
      ],
    },
    {
      heading: 'One generation',
      paragraphs: [
        'A generation starts by sampling a population from a multivariate Gaussian centered at the current mean. Each candidate is evaluated by the black-box objective. The candidates are ranked, not used through raw score magnitudes, so the method is mostly driven by ordering rather than fragile scale assumptions.',
        'The best ranked candidates pull the mean. Their steps also update the covariance and path variables. Then the next generation samples from the new distribution. This loop is simple to state, but the state update is doing a lot of work: it converts a batch of scalar scores into a better search geometry.',
        'Selection pressure is controlled by how many top candidates contribute and by their weights. Using several winners is less brittle than chasing the single best sample, especially when evaluations are noisy. The population is a small experiment about the local search shape.',
      ],
    },
    {
      heading: 'Covariance memory',
      paragraphs: [
        'Covariance is the part that makes CMA-ES more than hill climbing. A covariance matrix records variance along each dimension and correlation between dimensions. When winning steps repeatedly move along a diagonal direction, the matrix rotates and stretches the sampling cloud along that direction.',
        'This matters because a rotated search distribution can make a hard problem look easier. Instead of spending most samples sideways against a narrow valley, the optimizer spends more samples along the valley. It is not learning the objective formula. It is learning an empirical coordinate system that makes useful moves more likely.',
      ],
    },
    {
      heading: 'Step size and paths',
      paragraphs: [
        'The covariance matrix handles shape, but CMA-ES also needs a global scale. If steps are consistently aligned, the optimizer can often move faster. If steps cancel each other or bounce around, it should shrink the cloud. Sigma, the global step size, controls that pressure.',
        'Evolution paths are smoothed traces of recent successful movement. They keep the algorithm from overreacting to a single lucky sample. A one-generation accident should not reshape the whole distribution. A repeated trend should change both the covariance and the step size.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The adaptation-loop view is showing the optimizer state, not a single champion candidate. The useful thing to follow is the distribution: mean to samples, samples to rankings, rankings to paths, paths to covariance and sigma, then back to the next generation.',
        'The early plot is deliberately broad and generic. The later plot is tilted toward the useful direction. That visual change is the lesson. CMA-ES turns repeated selected steps into a sampling shape, so the next population is not just near the previous best point. It is biased toward directions that have produced progress.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'CMA-ES works because it uses population-level evidence. One candidate score is weak information. A ranked batch of candidates gives a direction of improvement and a rough picture of which movements were useful. Accumulated over generations, that evidence can recover scale and correlation information even without gradients.',
        'The method is also relatively insensitive to monotonic transformations of the objective because rankings drive selection. If one score scale is distorted but the order of candidates stays the same, the update usually sees the same winners. That is useful when objective values come from simulations, noisy measurements, or arbitrary scoring functions.',
        'The covariance update is also a form of memory. It does not store every past sample. It compresses repeated success into a matrix that changes future sampling probabilities. That compression is why the optimizer can exploit structure without building a full surrogate model of the objective.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main external cost is objective evaluation. CMA-ES often spends many evaluations per generation, although those evaluations can be parallelized. Internally, full covariance adaptation has memory and linear algebra costs that grow with dimension, including covariance updates and decompositions.',
        'That makes the method strongest in moderate-dimensional continuous spaces with expensive or unreliable gradients. It is less attractive for very high-dimensional parameter vectors, cheap differentiable objectives, or problems where the useful structure is discrete rather than geometric.',
        'Restarts are another practical tradeoff. A restart can escape a bad local basin, and larger restart populations can explore more broadly, but every restart spends budget. In serious use, the evaluation budget and restart policy are part of the algorithm, not afterthoughts.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CMA-ES is a good fit when the candidate is a real-valued vector and a black-box scorer is the only reliable feedback. Examples include PID or controller tuning, simulator calibration, morphology search, graphics and physics parameter fitting, continuous hyperparameter tuning, and benchmark functions designed to test ill-conditioned optimization.',
        'It also wins when you can evaluate a population in parallel. A cluster can score many candidates at once, then the optimizer performs one state update. That makes CMA-ES practical for workloads where one evaluation is slow but batch evaluation is available.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'CMA-ES can fail when the search space is too large for full covariance learning, when constraints are handled carelessly, when the objective is dominated by noise, or when the variables are really categorical choices disguised as numbers. Bounds also need attention because naive clipping can distort the distribution.',
        'Evaluation discipline matters. Do not trust one lucky run. Report random seeds, budgets, stopping rules, restarts, constraints, and baselines such as random search, gradient methods where available, Bayesian optimization, Differential Evolution, or problem-specific heuristics.',
        'A good failure report says whether the method explored the wrong scale, learned the wrong shape, hit constraints, or simply ran out of evaluations before adaptation had enough evidence.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Nikolaus Hansen, The CMA Evolution Strategy tutorial at https://arxiv.org/abs/1604.00772, the CMA-ES project site at https://cma-es.github.io/, and the source-code reference page at https://cma-es.github.io/cmaes_sourcecode_page.html.',
        'Study Evolutionary Search for the population-search family, Differential Evolution for a different way to use population differences, PCA and Eigenvectors for covariance intuition, Gaussian Process Bayesian Optimization for surrogate-based search, and Hyperparameter Search for practical budget tradeoffs.',
      ],
    },
  ],
};
