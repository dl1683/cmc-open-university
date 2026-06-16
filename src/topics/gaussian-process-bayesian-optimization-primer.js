// Gaussian process Bayesian optimization: a kernel matrix becomes a posterior
// mean and uncertainty band, then an acquisition function picks the next trial.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'gaussian-process-bayesian-optimization-primer',
  title: 'Gaussian Process Bayesian Optimization Primer',
  category: 'AI & ML',
  summary: 'A kernel-surrogate primer for expensive search: kernel matrices, Cholesky state, posterior mean/variance, acquisition scores, and scaling limits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['kernel posterior', 'acquisition loop'], defaultValue: 'kernel posterior' },
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

function gpGraph(title) {
  return graphState({
    nodes: [
      { id: 'trials', label: 'trials', x: 0.7, y: 3.4, note: 'x,y' },
      { id: 'kernel', label: 'kernel', x: 2.2, y: 3.4, note: 'K' },
      { id: 'chol', label: 'Chol', x: 3.7, y: 2.0, note: 'factor' },
      { id: 'alpha', label: 'alpha', x: 3.7, y: 4.8, note: 'dual' },
      { id: 'post', label: 'posterior', x: 5.4, y: 3.4, note: 'mean+var' },
      { id: 'acq', label: 'acq', x: 7.1, y: 3.4, note: 'score' },
      { id: 'next', label: 'next x', x: 8.7, y: 3.4, note: 'try' },
    ],
    edges: [
      { id: 'e-trials-kernel', from: 'trials', to: 'kernel' },
      { id: 'e-kernel-chol', from: 'kernel', to: 'chol' },
      { id: 'e-kernel-alpha', from: 'kernel', to: 'alpha' },
      { id: 'e-chol-post', from: 'chol', to: 'post' },
      { id: 'e-alpha-post', from: 'alpha', to: 'post' },
      { id: 'e-post-acq', from: 'post', to: 'acq' },
      { id: 'e-acq-next', from: 'acq', to: 'next' },
      { id: 'e-next-trials', from: 'next', to: 'trials' },
    ],
  }, { title });
}

const TRIALS = [
  { id: 't1', x: 0.10, y: 0.20 },
  { id: 't2', x: 0.35, y: 0.65 },
  { id: 't3', x: 0.65, y: 0.55 },
  { id: 't4', x: 0.90, y: 0.25 },
];

const xs = Array.from({ length: 21 }, (_, i) => i / 20);
const mean = (x) => 0.25 + 0.42 * Math.exp(-((x - 0.38) ** 2) / 0.025) + 0.28 * Math.exp(-((x - 0.68) ** 2) / 0.04);
const sigma = (x) => 0.05 + 0.38 * Math.min(...TRIALS.map((t) => Math.abs(x - t.x)));
const acq = (x) => mean(x) + 1.4 * sigma(x);
const fmt = (v, d = 2) => v.toFixed(d);

function* kernelPosterior() {
  yield {
    state: gpGraph('A function prior becomes a posterior band'),
    highlight: { active: ['trials', 'kernel', 'chol', 'alpha', 'post'], compare: ['acq', 'next'] },
    explanation: 'A Gaussian process is a distribution over functions. Observed trials define a kernel matrix: how similar every tried x is to every other tried x. Conditioning that prior on the observations gives a posterior mean and uncertainty band at every candidate x.',
    invariant: 'The kernel decides which observations should influence which candidate points.',
  };

  yield {
    state: labelMatrix(
      'Kernel matrix: similarity between tried points',
      TRIALS.map((t) => ({ id: t.id, label: t.id })),
      TRIALS.map((t) => ({ id: t.id, label: t.id })),
      [
        ['1.00', '0.46', '0.05', '0.00'],
        ['0.46', '1.00', '0.32', '0.03'],
        ['0.05', '0.32', '1.00', '0.46'],
        ['0.00', '0.03', '0.46', '1.00'],
      ],
    ),
    highlight: { active: ['t2:t2', 't2:t3', 't3:t4'], compare: ['t1:t4'] },
    explanation: 'Nearby trials have high kernel similarity, distant trials have little influence. The kernel matrix is the GP data structure: it stores the covariance implied by the prior plus noise on the diagonal for numerical stability.',
  };

  yield {
    state: labelMatrix(
      'Stored fit state',
      [
        { id: 'X', label: 'X_train' },
        { id: 'y', label: 'y_train' },
        { id: 'K', label: 'K+noise' },
        { id: 'L', label: 'Chol L' },
        { id: 'a', label: 'alpha' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'job', label: 'job' },
      ],
      [
        ['tried x', 'query k'],
        ['scores', 'targets'],
        ['covariance', 'fit'],
        ['factor', 'solves'],
        ['K^-1 y', 'mean'],
      ],
    ),
    highlight: { active: ['K:stores', 'L:stores', 'a:stores'], compare: ['X:job'] },
    explanation: 'Implementations usually avoid explicitly inverting K. They factor K with Cholesky and solve triangular systems. The alpha vector is the dual coefficient state used for posterior means. Posterior variance reuses the same factor.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'learning rate', min: 0, max: 1 }, y: { label: 'validation score', min: 0, max: 1 } },
      series: [
        { id: 'upper', label: 'upper', points: xs.map((x) => ({ x, y: Math.min(1, mean(x) + sigma(x)) })) },
        { id: 'mean', label: 'mean', points: xs.map((x) => ({ x, y: mean(x) })) },
        { id: 'lower', label: 'lower', points: xs.map((x) => ({ x, y: Math.max(0, mean(x) - sigma(x)) })) },
      ],
      markers: TRIALS.map((t) => ({ id: t.id, x: t.x, y: t.y, label: t.id })),
    }),
    highlight: { active: ['mean'], compare: ['upper', 'lower'], visited: ['t1', 't2', 't3', 't4'] },
    explanation: 'The mean interpolates the useful trials. The band pinches near tried points and widens in gaps. That uncertainty is not decoration: it is exactly what lets Bayesian optimization spend a trial in promising ignorance rather than repeatedly sampling the current best point.',
  };

  yield {
    state: labelMatrix(
      'Kernel choices encode assumptions',
      [
        { id: 'rbf', label: 'RBF' },
        { id: 'matern', label: 'Matern' },
        { id: 'white', label: 'white' },
        { id: 'period', label: 'periodic' },
      ],
      [
        { id: 'assume', label: 'assume' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['smooth', 'too smooth'],
        ['rougher', 'good default'],
        ['noise', 'hides signal'],
        ['cycles', 'wrong prior'],
      ],
    ),
    highlight: { active: ['matern:assume', 'white:assume'], compare: ['rbf:risk', 'period:risk'] },
    explanation: 'A GP is only as honest as its kernel. RBF assumes very smooth functions. Matern allows rougher functions. White kernels model observation noise. Periodic kernels are powerful when cycles are real and harmful when they are wishful thinking.',
  };

  yield {
    state: labelMatrix(
      'Scaling limits',
      [
        { id: 'fit', label: 'fit' },
        { id: 'store', label: 'store' },
        { id: 'predict', label: 'predict' },
        { id: 'update', label: 'update' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['O(n^3)', 'small n'],
        ['O(n^2)', 'sparse GP'],
        ['O(n)', 'cache'],
        ['rank add', 'Woodbury'],
      ],
    ),
    highlight: { active: ['fit:cost', 'store:cost'], compare: ['update:fix'] },
    explanation: 'Exact Gaussian processes are elegant and expensive. The kernel matrix grows with the number of trials. That is fine for hyperparameter search where n may be dozens, not millions. Larger settings need sparse approximations, inducing points, batching, or low-rank update tricks.',
  };
}

function* acquisitionLoop() {
  yield {
    state: gpGraph('Bayesian optimization loop'),
    highlight: { active: ['post', 'acq', 'next', 'trials'], found: ['next'] },
    explanation: 'Bayesian optimization uses the GP posterior to choose the next expensive experiment. The acquisition function turns mean and uncertainty into one score. After the trial finishes, append the observation and refit the surrogate.',
    invariant: 'The surrogate is cheap; the real experiment is expensive.',
  };

  yield {
    state: labelMatrix(
      'Candidate acquisition scores',
      [
        { id: 'x20', label: 'x=.20' },
        { id: 'x45', label: 'x=.45' },
        { id: 'x75', label: 'x=.75' },
        { id: 'x98', label: 'x=.98' },
      ],
      [
        { id: 'mean', label: 'mean' },
        { id: 'sigma', label: 'sigma' },
        { id: 'ucb', label: 'UCB' },
      ],
      [
        ['0.45', '0.11', '0.60'],
        ['0.70', '0.09', '0.83'],
        ['0.59', '0.15', '0.80'],
        ['0.27', '0.08', '0.38'],
      ],
    ),
    highlight: { active: ['x45:ucb', 'x75:sigma'], compare: ['x98:ucb'] },
    explanation: 'UCB acquisition is the same shape as LinUCB: mean plus an uncertainty bonus. x=.45 looks best by mean and still has uncertainty, so it wins. x=.75 is worth watching because uncertainty can compensate for a lower mean.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'candidate x', min: 0, max: 1 }, y: { label: 'score', min: 0, max: 1 } },
      series: [
        { id: 'mean', label: 'mean', points: xs.map((x) => ({ x, y: mean(x) })) },
        { id: 'ucb', label: 'UCB', points: xs.map((x) => ({ x, y: Math.min(1, acq(x)) })) },
      ],
      markers: [
        { id: 'next', x: 0.45, y: 0.83, label: 'next' },
      ],
    }),
    highlight: { active: ['ucb', 'next'], compare: ['mean'] },
    explanation: 'The acquisition curve is not the model prediction. It is a policy for spending the next trial. Exploitation alone would maximize the mean. UCB lifts uncertain regions so the search can escape a local favorite.',
  };

  yield {
    state: labelMatrix(
      'Acquisition families',
      [
        { id: 'ucb', label: 'UCB' },
        { id: 'ei', label: 'EI' },
        { id: 'pi', label: 'PI' },
        { id: 'ts', label: 'TS' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['mean+var', 'beta tune'],
        ['improve', 'greedy'],
        ['beat best', 'too local'],
        ['sample func', 'noisy'],
      ],
    ),
    highlight: { active: ['ucb:uses', 'ei:uses', 'ts:uses'], compare: ['pi:risk'] },
    explanation: 'Different acquisitions spend uncertainty differently. UCB is explicit optimism. Expected improvement values the amount by which a candidate might beat the incumbent. Probability of improvement can be too local. Thompson sampling draws a plausible function and optimizes that draw.',
  };

  yield {
    state: labelMatrix(
      'Production BO contract',
      [
        { id: 'budget', label: 'budget' },
        { id: 'space', label: 'space' },
        { id: 'noise', label: 'noise' },
        { id: 'parallel', label: 'parallel' },
        { id: 'report', label: 'report' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['trial cap', 'overclaim'],
        ['bounds', 'bad prior'],
        ['replicates', 'chasing'],
        ['pending', 'dup work'],
        ['all trials', 'cherry pick'],
      ],
    ),
    highlight: { active: ['budget:record', 'space:record', 'report:record'], compare: ['noise:risk'] },
    explanation: 'The engineering contract matters as much as the acquisition. Predeclare the budget, define bounds, handle noisy trials, mark pending jobs so parallel workers do not duplicate each other, and report the full search history rather than the single winner.',
  };

  yield {
    state: gpGraph('Complete case: expensive model tuning'),
    highlight: { active: ['trials', 'post', 'acq', 'next'], compare: ['kernel', 'chol'] },
    explanation: 'A training run takes six hours. Random search is the baseline. Once a few trials exist, a GP surrogate models the score surface, proposes a learning rate and regularization value, waits for the real run, then updates the posterior. Hyperparameter Search shows the wider protocol; this module shows the surrogate data structure inside it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'kernel posterior') yield* kernelPosterior();
  else if (view === 'acquisition loop') yield* acquisitionLoop();
  else throw new InputError('Pick a Gaussian-process view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Gaussian process is a probability distribution over functions. For regression, it turns observed inputs and targets into a posterior mean and variance at every candidate input. Bayesian optimization uses that posterior as a cheap surrogate for an expensive objective, such as validation score after a long training run.',
        'The main data structure is the kernel matrix K over observed inputs. The kernel encodes similarity: nearby or structurally similar inputs should have correlated function values. Conditioning on observations produces a mean curve and an uncertainty band.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Fit stores X_train, y_train, K plus noise, a Cholesky factor L, and alpha = K^-1 y computed through triangular solves. Prediction at a candidate x uses the vector of kernel similarities k(x, X_train). The posterior mean is k^T alpha. The posterior variance subtracts the amount explained by the training points, so uncertainty shrinks near observations and widens in unexplored regions.',
        'Bayesian optimization adds an acquisition function. UCB uses mean plus a multiple of standard deviation. Expected improvement values how much a point might beat the current best. Thompson sampling draws one plausible function and optimizes it. All three are ways to spend expensive trials on promising uncertainty.',
      ],
    },
    {
      heading: 'Complete case study: model tuning',
      paragraphs: [
        'Suppose each model-training run costs six hours. Random search is still the baseline, but after a handful of completed trials a GP can model the score surface over learning rate and regularization. The acquisition function proposes the next trial. When the job finishes, append the result, rebuild or update the kernel state, and choose again.',
        'This connects Hyperparameter Search to LinUCB Personalized News Case Study. Both use a mean-plus-uncertainty decision rule. LinUCB does it over discrete actions with ridge state; GP Bayesian optimization does it over a continuous search space with a kernel covariance matrix.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A GP surrogate is not magic global optimization. Bad search bounds, a misleading kernel, noisy scores, and repeated peeking at the same validation split can all overfit the search. Exact GPs also scale cubically in the number of observations, which is fine for dozens of expensive trials and wrong for millions of cheap rows.',
        'Always report the full search budget and failed trials. A best score found after 500 trials is not comparable to a best score found after 20 unless the search bill is part of the claim.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Rasmussen and Williams, Gaussian Processes for Machine Learning at https://gaussianprocess.org/gpml/chapters/RW.pdf; scikit-learn Gaussian process documentation at https://scikit-learn.org/stable/modules/gaussian_process.html and GaussianProcessRegressor API at https://scikit-learn.org/stable/modules/generated/sklearn.gaussian_process.GaussianProcessRegressor.html; Jones, Schonlau, and Welch on efficient global optimization, referenced in acquisition-function literature such as https://ideas.repec.org/a/taf/jnlasa/v119y2024i546p1619-1632.html; and Wilson, Hutter, and Deisenroth on maximizing acquisition functions at https://papers.neurips.cc/paper/8194-maximizing-acquisition-functions-for-bayesian-optimization.pdf.',
        "Study next: Hyperparameter Search, LinUCB Personalized News Case Study, Sherman-Morrison Rank-One Update Primer, Uncertainty: Teaching Models to Say I Don't Know, Regularization, Eigenvalues & Eigenvectors, and PCA: Principal Component Analysis.",
      ],
    },
  ],
};
