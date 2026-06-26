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
        'The visualization shows two views. The adaptation-loop view draws the sampling distribution as an ellipse over a 2D fitness landscape. Each generation, new candidate points appear around the mean, the best are highlighted, and the ellipse updates its center, shape, and orientation. Watch the ellipse: it starts round and drifts toward the shape of the fitness contours.',
        'The covariance-memory view isolates the covariance matrix itself. You see the eigenvectors as arrows and the eigenvalues as their lengths. As generations pass, the arrows rotate and stretch to align with the directions where good candidates have been found. The step-size sigma scales the whole ellipse; when progress stalls, sigma shrinks.',
        {type: 'image', src: './assets/gifs/cma-es-covariance-adaptation-primer.gif', alt: 'Animated walkthrough of the cma es covariance adaptation primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some optimization problems hand you a function f(x) that takes a vector of real numbers and returns a score, but nothing else. No gradient, no symbolic formula you can differentiate, no cheap local model. You can evaluate f at any point, but each evaluation might be expensive: running a physics simulator, testing a robot controller, or scoring a design in a wind tunnel. These are called black-box continuous optimization problems.',
        {type: 'callout', text: 'CMA-ES treats the sampling distribution as the data structure, so successful directions reshape future search.'},
        'CMA-ES (Covariance Matrix Adaptation Evolution Strategy) is a search algorithm built for exactly this setting. Instead of following a gradient, it maintains a probability distribution over candidate solutions, samples a population each generation, ranks them by fitness, and reshapes the distribution so that future samples concentrate where good solutions have been found. The key idea is that the distribution itself, not any single candidate, is the thing being optimized.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest black-box strategy is isotropic random search. Pick a center point, sample candidates from a spherical Gaussian with some fixed radius sigma, evaluate them all, move the center to the best one, and repeat. This is sometimes called (1+lambda)-ES with a fixed step size. It works on small, well-conditioned problems where the fitness landscape is roughly bowl-shaped and axis-aligned.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density curves', caption: 'CMA-ES starts from Gaussian sampling intuition, then replaces the fixed scalar spread with a learned covariance shape. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Normal_Distribution_PDF.svg.'},
        'A spherical cloud treats all directions equally. If the real fitness contours are elliptical, meaning progress is fast along one direction and slow along another, the round cloud wastes most of its samples on directions that yield little improvement. In a 10-dimensional space with a condition number of 100 (one axis matters 100 times more than another), a round cloud needs roughly 100 times more evaluations than one aligned with the landscape.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixing the step size does not help. If sigma is large, samples overshoot narrow valleys. If sigma is small, the search creeps. Adapting sigma alone (the 1/5th success rule from classical ES) still leaves the shape round. In d dimensions, a round search must sample O(d) points per useful step along each axis, because it cannot distinguish directions.',
        'The deeper problem is that real fitness landscapes are rotated and scaled in ways that do not align with the coordinate axes. A narrow diagonal valley in 2D means the useful search direction is at 45 degrees. No axis-aligned step size can capture that. You need a way to learn which directions matter and how much, from the fitness evaluations themselves.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'CMA-ES replaces the fixed round cloud with a full multivariate Gaussian parameterized by a mean vector m, a covariance matrix C, and a global step size sigma. The mean says where to search. The covariance matrix C encodes the shape: its eigenvectors define the principal axes of the search ellipse, and its eigenvalues define how far to stretch along each axis. Sigma scales everything uniformly.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Concept_of_directional_optimization_in_CMA-ES_algorithm.png', alt: 'CMA-ES generations showing an adapting elliptical sampling distribution', caption: 'The orange ellipse makes covariance adaptation visible: selected samples stretch and rotate the next search distribution. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Concept_of_directional_optimization_in_CMA-ES_algorithm.png.'},
        'After each generation, the algorithm updates C using the directions that the best-ranked candidates moved. If the top candidates all moved northeast, C stretches the ellipse along the northeast direction. Over several generations, C converges toward the inverse Hessian of the fitness landscape (or its low-rank approximation), which is exactly the shape that makes gradient-free search most efficient. The distribution becomes the data structure: it encodes everything the optimizer has learned about the local geometry.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'State: mean vector m (d-dimensional), covariance matrix C (d x d, symmetric positive-definite), step size sigma (scalar), evolution path p_c (for covariance), evolution path p_sigma (for step size), and selection weights w_1 >= w_2 >= ... >= w_mu for the top mu candidates out of lambda total.',
        'Sample: generate lambda candidates x_i = m + sigma * N(0, C) for i = 1..lambda. Evaluate f(x_i) for all i. Rank them by fitness. The top mu candidates are the "selected" set.',
        'Update mean: m_new = sum of w_i * x_(i:lambda) for i = 1..mu, where x_(i:lambda) is the i-th best candidate. This moves the center toward the weighted average of the winners.',
        'Update evolution paths: p_c accumulates the direction m moved, normalized by C. p_sigma accumulates the same direction but normalized by the square root of C. Both paths use exponential smoothing with a decay constant around 1/sqrt(d), so they average over roughly sqrt(d) generations.',
        'Update C: the new covariance is a weighted combination of the old C (with decay), the outer product of p_c (the "rank-one" update capturing the overall drift direction), and the sum of outer products of the selected steps (the "rank-mu" update capturing the spread of good directions). Concretely, C_new = (1 - c1 - c_mu) * C + c1 * p_c * p_c^T + c_mu * sum of w_i * (x_i - m_old)(x_i - m_old)^T / sigma^2.',
        'Update sigma: compare the length of p_sigma to its expected length under random selection. If p_sigma is longer than expected (steps are correlated, meaning consistent progress), increase sigma. If shorter (steps are canceling, meaning overshooting), decrease sigma. The update is sigma_new = sigma * exp((||p_sigma|| / E[||N(0,I)||] - 1) * c_sigma / d_sigma).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Ranking instead of raw fitness values makes the algorithm invariant to monotonic transformations of f. If you replace f with log(f) or f^3, the rankings stay the same and so does the update. This is critical when fitness values come from noisy simulations or arbitrary scoring functions where the scale is meaningless.',
        'The rank-one update (from p_c) captures the direction the mean has been drifting. If the mean consistently moves northeast over several generations, p_c points northeast and the outer product p_c * p_c^T adds variance in that direction. The rank-mu update captures the spread of good candidates within a single generation: if winners are spread along a diagonal, that diagonal gets more variance. Together, they let C adapt both from multi-generation trends and single-generation evidence.',
        'The evolution paths prevent single lucky generations from distorting C. A path is an exponentially weighted running average, so one noisy generation gets diluted by the history. This is analogous to momentum in gradient descent: it smooths the update signal. The step-size control via p_sigma is equally important. Without it, C might learn the right shape but at the wrong scale, causing the optimizer to overshoot or creep.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per generation, CMA-ES evaluates lambda candidates (the external cost, often dominant) and performs O(d^2) internal work for the covariance update plus O(d^3) for the eigendecomposition of C (needed every O(d/10) generations to sample from N(0,C)). Storage is O(d^2) for C.',
        'The default population size is lambda = 4 + floor(3 * ln(d)). For d=10, that is about 11 candidates per generation. For d=100, about 18. A typical run to convergence uses O(d^2) to O(d^3) function evaluations, depending on the condition number of the landscape. On the 20-dimensional Rosenbrock function (condition ~1000), CMA-ES converges in roughly 10,000 evaluations.',
        'For d > 1000, the O(d^2) storage and O(d^3) decomposition become prohibitive. Variants like sep-CMA (diagonal covariance, O(d) storage) or VD-CMA (low-rank + diagonal) trade adaptation quality for scalability. Full CMA-ES is most practical for d roughly in the range 2 to 500.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Robot gait optimization: the candidate vector is a set of controller parameters (joint angles, timing, PD gains), the fitness function is distance walked in simulation. Each evaluation takes seconds to minutes. CMA-ES learns correlated parameter directions (e.g., left and right leg timing should be symmetric) that random search would take orders of magnitude longer to discover.',
        'Neural network weight initialization and hyperparameter tuning: when the search space is continuous and moderate-dimensional (under ~100 parameters), CMA-ES outperforms grid search and random search because it exploits correlations between hyperparameters. OpenAI used it for reinforcement learning policy search in early work on Atari games.',
        'Engineering design: airfoil shape optimization, antenna geometry, combustion engine calibration. These problems have expensive simulators (minutes to hours per evaluation), noisy outputs, and no analytic gradients. CMA-ES is the standard baseline in these domains.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High dimensions (d > 1000): the covariance matrix has d^2 entries and the eigendecomposition is O(d^3). In a 10,000-dimensional space, C alone requires 800MB of memory. Use gradient-based methods, natural evolution strategies with diagonal covariance, or evolutionary strategies with learned step sizes per coordinate instead.',
        'Cheap differentiable objectives: if you can compute the gradient of f in O(d) time (e.g., via automatic differentiation), gradient descent converges in O(d) steps while CMA-ES needs O(d^2). There is no reason to use CMA-ES on a smooth loss function with available gradients.',
        'Discrete or combinatorial search spaces: CMA-ES samples from a continuous Gaussian. If the real variables are integers, categories, or graph structures, the continuous relaxation is lossy and rounding introduces artifacts. Use combinatorial optimizers, genetic algorithms with appropriate operators, or Bayesian optimization with categorical kernels instead.',
        'Heavily constrained problems: naive handling of constraints (clipping candidates to feasible bounds) distorts the Gaussian shape that C is trying to learn. If half the population gets clipped to a boundary, C sees a truncated distribution and learns the wrong shape. Proper constraint handling requires penalty functions, repair operators, or augmented Lagrangian wrappers, which add complexity and tuning.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Minimize f(x1, x2) = x1^2 + 100*x2^2 (an axis-aligned ellipse with condition number 100) starting from m = (5, 5), sigma = 1, C = I (identity). Population lambda = 6, selected mu = 3 with weights w = (0.5, 0.33, 0.17).',
        'Generation 1: sample 6 points from N((5,5), I). Suppose the ranked winners are (4.2, 4.8), (4.5, 4.6), (4.8, 4.3). Weighted mean: m_new = 0.5*(4.2,4.8) + 0.33*(4.5,4.6) + 0.17*(4.8,4.3) = (4.40, 4.65). The mean moved mostly in the x2 direction because the fitness contours are much tighter in x2, so candidates with smaller x2 scored better.',
        'After a few generations, the covariance matrix C develops a small eigenvalue along x2 (the steep direction) and a larger eigenvalue along x1 (the shallow direction). The sampling ellipse becomes a thin horizontal stripe. This means most candidates are spread along x1, which is where the remaining improvement lies. The step size sigma also shrinks as the mean approaches the optimum.',
        'After roughly 200 evaluations (~33 generations), m converges to within 1e-8 of the origin. By contrast, isotropic random search with the same sigma and population size would need roughly 100 times as many evaluations because it would keep wasting samples in the x2 direction, which contributes almost nothing once x2 is already near zero.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hansen, N. (2016). The CMA Evolution Strategy: A Tutorial. arXiv:1604.00772. This is the definitive reference: 100 pages covering the algorithm, its invariance properties, parameter settings, and convergence proofs. The CMA-ES project site at https://cma-es.github.io/ hosts reference implementations in Python (pycma), MATLAB, and C.',
        'For mathematical background, study eigenvectors and eigenvalues (they define the axes of the sampling ellipse), multivariate Gaussian distributions (the sampling mechanism), and positive-definite matrices (the constraint on C that keeps sampling well-defined). For algorithmic relatives, study Differential Evolution (another population-based optimizer, but without covariance learning), Bayesian Optimization with Gaussian Processes (a surrogate-based approach better suited when evaluations are extremely expensive, d < 20), and Natural Evolution Strategies (NES, which uses the natural gradient of the expected fitness instead of explicit covariance updates).',
      ],
    },
  ],
};
