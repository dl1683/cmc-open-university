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
    explanation: `A Gaussian process is a distribution over functions. ${TRIALS.length} observed trials define a ${TRIALS.length}x${TRIALS.length} kernel matrix: how similar every tried x is to every other tried x. Conditioning that prior on the observations gives a posterior mean and uncertainty band at every candidate x (${xs.length} candidates from ${fmt(xs[0])} to ${fmt(xs[xs.length - 1])}).`,
    invariant: `The kernel decides which of the ${TRIALS.length} observations should influence which of the ${xs.length} candidate points.`,
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
    explanation: `Nearby trials have high kernel similarity, distant trials have little influence. The ${TRIALS.length}x${TRIALS.length} kernel matrix is the GP data structure: it stores the covariance implied by the prior plus noise on the diagonal for numerical stability. Trial ${TRIALS[0].id} at x=${fmt(TRIALS[0].x)} and ${TRIALS[1].id} at x=${fmt(TRIALS[1].x)} are close, so K[1,2]=0.46; ${TRIALS[0].id} and ${TRIALS[3].id} at x=${fmt(TRIALS[3].x)} are far apart, so K[1,4]=0.00.`,
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
    explanation: `Implementations usually avoid explicitly inverting the ${TRIALS.length}x${TRIALS.length} K. They factor K with Cholesky into a lower-triangular L and solve triangular systems. The alpha vector (length ${TRIALS.length}) is the dual coefficient state K^-1 y used for posterior means. Posterior variance reuses the same Cholesky factor L.`,
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
    explanation: `The mean interpolates the ${TRIALS.length} trials across ${xs.length} candidate points (x from ${fmt(xs[0])} to ${fmt(xs[xs.length - 1])}). At x=${fmt(TRIALS[1].x)}, mean=${fmt(mean(TRIALS[1].x))} and sigma=${fmt(sigma(TRIALS[1].x))} (tight near a trial). At x=${fmt(0.5)}, mean=${fmt(mean(0.5))} and sigma=${fmt(sigma(0.5))} (wider in a gap). That uncertainty is not decoration: it is exactly what lets Bayesian optimization spend a trial in promising ignorance rather than repeatedly sampling the current best point.`,
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
    explanation: `A GP is only as honest as its kernel. RBF assumes very smooth functions. Matern allows rougher functions and is often a safer default for the ${TRIALS.length}-trial regime. White kernels model observation noise (our trials have y values from ${fmt(Math.min(...TRIALS.map(t => t.y)))} to ${fmt(Math.max(...TRIALS.map(t => t.y)))}). Periodic kernels are powerful when cycles are real and harmful when they are wishful thinking.`,
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
    explanation: `Exact Gaussian processes are elegant and expensive. The kernel matrix grows as n^2 (with n=${TRIALS.length} trials, that is ${TRIALS.length * TRIALS.length} entries). Fit cost is O(n^3)=${TRIALS.length}^3=${TRIALS.length ** 3} operations. That is fine for hyperparameter search where n may be dozens, not millions. Larger settings need sparse approximations, inducing points, batching, or low-rank update tricks.`,
  };
}

function* acquisitionLoop() {
  yield {
    state: gpGraph('Bayesian optimization loop'),
    highlight: { active: ['post', 'acq', 'next', 'trials'], found: ['next'] },
    explanation: `Bayesian optimization uses the GP posterior (fitted on ${TRIALS.length} trials) to choose the next expensive experiment. The acquisition function turns mean and uncertainty into one score across ${xs.length} candidates. After the trial finishes, append the observation and refit the ${TRIALS.length + 1}x${TRIALS.length + 1} surrogate.`,
    invariant: `The surrogate is cheap (evaluate ${xs.length} candidates instantly); the real experiment is expensive.`,
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
    explanation: `UCB acquisition is the same shape as LinUCB: mean plus an uncertainty bonus (beta=1.4). At x=0.45, mean=${fmt(mean(0.45))} + 1.4*sigma=${fmt(sigma(0.45))} gives UCB=${fmt(acq(0.45))}. At x=0.75, mean=${fmt(mean(0.75))} but sigma=${fmt(sigma(0.75))} is higher, giving UCB=${fmt(acq(0.75))}. x=0.45 wins because its mean dominates; x=0.75 is worth watching because uncertainty can compensate for a lower mean.`,
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
    explanation: `The acquisition curve is not the model prediction. It is a policy for spending the next trial. The peak mean is ${fmt(Math.max(...xs.map(x => mean(x))))} but the peak UCB is ${fmt(Math.max(...xs.map(x => Math.min(1, acq(x)))))} — the gap is the exploration premium. Exploitation alone would maximize the mean. UCB lifts uncertain regions so the search can escape a local favorite.`,
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
    explanation: `Different acquisitions spend uncertainty differently. UCB (beta=1.4 here) is explicit optimism. Expected improvement values the amount by which a candidate might beat the incumbent (current best y=${fmt(Math.max(...TRIALS.map(t => t.y)))} at ${TRIALS.reduce((a, b) => a.y > b.y ? a : b).id}). Probability of improvement can be too local. Thompson sampling draws a plausible function and optimizes that draw.`,
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
    explanation: `The engineering contract matters as much as the acquisition. Predeclare the budget (we spent ${TRIALS.length} trials so far), define bounds (x in [${fmt(xs[0])}, ${fmt(xs[xs.length - 1])}]), handle noisy trials, mark pending jobs so parallel workers do not duplicate each other, and report the full search history (all ${TRIALS.length} trials) rather than the single winner.`,
  };

  yield {
    state: gpGraph('Complete case: expensive model tuning'),
    highlight: { active: ['trials', 'post', 'acq', 'next'], compare: ['kernel', 'chol'] },
    explanation: `A training run takes six hours. Random search is the baseline. Once ${TRIALS.length} trials exist (best y=${fmt(Math.max(...TRIALS.map(t => t.y)))} at x=${fmt(TRIALS.reduce((a, b) => a.y > b.y ? a : b).x)}), a GP surrogate models the score surface across ${xs.length} candidates, proposes a learning rate and regularization value, waits for the real run, then updates the posterior. Hyperparameter Search shows the wider protocol; this module shows the surrogate data structure inside it.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. Kernel posterior walks through the data structure: trial points become a kernel matrix, the matrix is factored, and the posterior mean and uncertainty band emerge. Acquisition loop shows the decision cycle: the posterior feeds a scoring function that picks the next expensive experiment. Step through one frame at a time so you can watch each quantity update.',
        {type: 'image', src: './assets/gifs/gaussian-process-bayesian-optimization-primer.gif', alt: 'Animated walkthrough of the gaussian process bayesian optimization primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Highlighted nodes are active in the current step. Comparison nodes show what comes next. The matrix frames display real numbers so you can verify the math yourself.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some experiments are expensive. Training a neural network configuration might take six hours. A robotics trial risks hardware damage. A materials-science assay consumes reagents that cannot be recovered. In these settings, every evaluation has a cost measured in time, money, or physical resources, and a bad search policy wastes that budget on uninformative trials.',
        'The objective function is unknown. You can query it at one input (one learning rate, one alloy composition, one compiler flag setting) and receive one noisy score, but you never see the full surface. Bayesian optimization builds a cheap statistical model of the unknown surface, uses the model to choose the most informative next experiment, pays for the real evaluation, and updates the model with the result. A Gaussian process (GP) is one of the cleanest surrogates for this loop because it produces both a best-guess prediction and a calibrated uncertainty estimate at every candidate point.',
        {type: 'callout', text: 'Bayesian optimization buys information, not just scores: the surrogate tracks both what looks good and where ignorance is still valuable.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Grid search is the textbook starting point. Pick a list of candidate values for each knob, evaluate every combination, keep the best. With 10 values per knob and 6 knobs, that is 10^6 = 1,000,000 experiments. Grid search also distributes trials uniformly across all axes, so it wastes budget on axes that barely affect the score while undersampling axes where small changes matter.',
        'Random search improves on the grid by sampling configurations independently. It covers more unique values per axis and is hard to embarrass when only a few dimensions are important. Bergstra and Bengio (2012) showed random search outperforms grid search in moderate dimensions precisely because it does not waste trials on inert axes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Random search has no memory. After 20 trials, it knows the best score seen so far, but it does not model why that score was good. It can spend a trial in a region that previous observations already ruled out. It can ignore a nearby uncertain region that might contain a better answer. Each trial is treated as independent of all prior evidence.',
        'The wall is the cost of ignorance. When each evaluation takes six hours, even one wasted trial means six hours lost. The gap between random search and an informed search grows as budgets tighten: with 100 trials the waste is tolerable, with 10 trials it is decisive. What is needed is a model that remembers every past result, estimates the score at untried points, and quantifies how uncertain each estimate is so the search can spend trials where they buy the most information.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A Gaussian process is a distribution over functions. Before seeing any data, it assigns a probability to every possible function shape, controlled by a kernel that encodes assumptions about smoothness. After observing trial results, it conditions that distribution on the data and produces a posterior: a new distribution over functions that agrees with the observations and remains uncertain elsewhere. The posterior gives two outputs at every candidate point: a mean (best guess) and a variance (how unsure the guess is).',
        'The insight that makes Bayesian optimization work is using the variance as a resource, not just a diagnostic. A point with high mean and low variance is worth exploiting. A point with moderate mean but high variance is worth exploring because the true score might be much higher than the current guess. The acquisition function combines these two signals into a single score that ranks every candidate by the value of evaluating it next. This turns an expensive search into a sequence of cheap surrogate queries punctuated by single expensive evaluations.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Gaussian_process_draws_from_prior_distribution.png/330px-Gaussian_process_draws_from_prior_distribution.png', alt: 'Gaussian process prior samples under different kernels', caption: 'Different kernels produce different function priors, so kernel choice is an assumption about smoothness before any trial is run. Source: Wikimedia Commons, Gaussian process prior examples.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with n observed trials: inputs X = [x1, ..., xn] and scores y = [y1, ..., yn]. The kernel function k(xi, xj) measures the similarity between any two inputs. For a radial basis function (RBF) kernel, k(xi, xj) = exp(-(xi - xj)^2 / (2 * l^2)), where l is a length scale. Close inputs get kernel values near 1; distant inputs get values near 0. Compute the n-by-n kernel matrix K where entry (i,j) is k(xi, xj), then add a small noise term sigma_n^2 to the diagonal for numerical stability and to model observation noise.',
        'Factor K + sigma_n^2 * I using Cholesky decomposition into a lower-triangular matrix L such that L * L^T = K + sigma_n^2 * I. Then solve for the weight vector alpha = (K + sigma_n^2 * I)^-1 * y by two triangular solves: L * z = y, then L^T * alpha = z. This avoids explicit matrix inversion, which is numerically fragile. At any candidate point x*, compute the kernel vector k* = [k(x*, x1), ..., k(x*, xn)]. The posterior mean is mu(x*) = k*^T * alpha. The posterior variance is sigma^2(x*) = k(x*, x*) - k*^T * (K + sigma_n^2 * I)^-1 * k*, also computed via Cholesky solves.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Gaussian_Process_Regression.png/250px-Gaussian_Process_Regression.png', alt: 'Gaussian process regression showing prior, posterior, and uncertainty', caption: 'The posterior mean and uncertainty band are the state that the acquisition function consumes. Source: Wikimedia Commons, Gaussian Process Regression.'},
        'The acquisition function converts the posterior into a decision. Upper confidence bound (UCB) is the simplest: acq(x*) = mu(x*) + beta * sigma(x*), where beta controls the exploration-exploitation tradeoff. Expected improvement (EI) computes the expected amount by which x* would beat the current best score. The optimizer evaluates the acquisition function across all candidates (cheap, since each query is O(n)), picks the maximizer, runs the real experiment there, appends the result to the dataset, refactors the kernel matrix, and repeats.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method succeeds when neighboring inputs produce related outputs, which is the smoothness assumption encoded by the kernel. A learning rate of 0.001 and 0.0012 usually yield similar validation scores; 0.001 and 0.1 usually do not. The kernel converts that intuition into covariance entries, and the posterior interpolates between observed trials according to those entries. As long as the real objective is not wildly rougher than the kernel assumes, the surrogate guides the search better than random sampling.',
        'Uncertainty is the mechanism that prevents premature convergence. A greedy search that always picks the highest predicted score will lock onto a local favorite and never leave. Pure exploration that samples unknown regions regardless of predicted score wastes trials on unpromising areas. The acquisition function prices both: early in the budget, high uncertainty can dominate because the model needs information; later, as the posterior tightens, the acquisition concentrates near the best-known regions. This adaptive shift is why BO outperforms random search most dramatically when the budget is tight.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Regressions_sine_demo.svg/250px-Regressions_sine_demo.svg.png', alt: 'Regression comparison on noisy sine data with uncertainty bands', caption: 'Surrogate uncertainty changes the next-point decision: a candidate can be valuable because it is promising or because it reduces a costly unknown. Source: Wikimedia Commons, regression sine demo.'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Fitting the GP costs O(n^3) for the Cholesky factorization and O(n^2) to store the kernel matrix, where n is the number of completed trials. With n = 4 trials that is 64 operations and 16 matrix entries, trivial. With n = 1000 trials that is 10^9 operations and 10^6 entries, which takes seconds on a modern CPU. With n = 10,000 the cubic cost becomes a bottleneck.',
        'Each posterior prediction at a new candidate costs O(n) for the kernel vector and the dot product with alpha. Evaluating 1000 candidates costs O(1000 * n). For typical hyperparameter searches with n under a few hundred, the surrogate update and acquisition optimization together take milliseconds to seconds, negligible compared to the hours-long real evaluation. When n grows large, sparse GP approximations (inducing points, structured kernels) reduce the cubic cost to O(n * m^2) where m is a smaller inducing set.',
        'Memory is O(n^2) for the full kernel matrix and O(n) for alpha and y. Parallel workers add coordination cost: pending trials must be tracked to avoid duplicate suggestions, and batch acquisition strategies (like fantasized observations or q-EI) replace the sequential loop with a batch proposal that accounts for the information each pending trial will eventually provide.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hyperparameter tuning is the canonical application. A team training a neural network might tune learning rate, weight decay, batch size, and dropout over 30 trials, each taking 4 hours. BO typically finds configurations within 1-2% of the best random-search result using 3-5x fewer trials. Libraries like BoTorch, Ax, Optuna, and Hyperopt implement the full loop.',
        'The same pattern appears in robotics (gait parameters for a walking robot, tested by physical runs), materials discovery (alloy compositions tested by lab synthesis), compiler optimization (flag combinations tested by benchmark suites), database tuning (buffer sizes and cache policies tested under load), and drug design (molecular candidates tested by bioassay). In each case the shared structure is an expensive black-box evaluation, a moderate number of continuous or ordinal parameters, and a budget small enough that random sampling leaves too much on the table.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the search space is misspecified. If the true optimum lies outside the declared bounds, the optimizer cannot reach it. If the parameterization is poor (e.g., searching over raw learning rate instead of log learning rate), the kernel treats meaningful differences as small and meaningless differences as large, distorting the posterior.',
        'It fails in high dimensions. The GP posterior becomes diffuse when the number of parameters exceeds roughly 10-20, because the number of trials needed to cover the space grows exponentially. Trust-region BO and random-embedding methods partially address this, but a 100-dimensional search is usually better served by evolutionary strategies or reinforcement-learning-based tuners.',
        'It fails when noise is ignored. A single lucky validation run pulls the posterior upward and attracts more trials to a misleading region. Replicates, explicit noise modeling (adding sigma_n to the kernel diagonal), and noise-aware acquisition functions protect against this. Finally, repeated tuning on the same validation set can overfit the evaluation procedure itself. A strong BO result still requires a held-out test or production validation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team tunes a classifier\'s learning rate (search range [0.0, 1.0]) with a 6-hour training run per trial. They start with 4 random trials: x=0.10 scores y=0.20, x=0.35 scores y=0.65, x=0.65 scores y=0.55, x=0.90 scores y=0.25. The current best is y=0.65 at x=0.35.',
        'Build the 4x4 kernel matrix using an RBF kernel with length scale l=0.3. Entry K[1,2] = exp(-(0.10 - 0.35)^2 / (2 * 0.09)) = exp(-0.347) = 0.707. Entry K[1,4] = exp(-(0.10 - 0.90)^2 / 0.18) = exp(-3.556) = 0.029. Add noise sigma_n^2 = 0.01 to the diagonal. Cholesky-factor the result to get L, solve for alpha.',
        'Now evaluate UCB at candidate x=0.50 with beta=1.4. The posterior mean at x=0.50 interpolates the four observations, weighted by kernel similarity: mu(0.50) = 0.62. The posterior standard deviation is sigma(0.50) = 0.08 (moderate, since x=0.50 sits between trials at 0.35 and 0.65). UCB(0.50) = 0.62 + 1.4 * 0.08 = 0.73. Compare to x=0.15, where mu(0.15) = 0.28 and sigma(0.15) = 0.12: UCB(0.15) = 0.28 + 1.4 * 0.12 = 0.45. The optimizer picks x=0.50 because its combined exploitation-plus-exploration score is higher. After running the real 6-hour training at x=0.50 and observing y=0.70, the team appends the result, refactors the now 5x5 kernel matrix, and the posterior tightens around the promising region near x=0.35-0.50.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Rasmussen and Williams, Gaussian Processes for Machine Learning (MIT Press, 2006) is the standard reference for GP theory, kernels, and inference. Snoek, Larochelle, and Adams, Practical Bayesian Optimization of Machine Learning Algorithms (NeurIPS, 2012) introduced GP-based hyperparameter tuning to the ML community. Bergstra and Bengio, Random Search for Hyper-Parameter Optimization (JMLR, 2012) established random search as the baseline to beat.',
        'On this site, study Hyperparameter Search for the outer evaluation protocol that wraps the surrogate loop. Study LinUCB for another application of optimism under uncertainty in a different domain (contextual bandits). Study Calibration and Reliability Diagrams for why predicted scores need calibration before they can be trusted. Study Sherman-Morrison Rank-One Update for the linear algebra behind cheap incremental matrix updates that some GP implementations use when adding a single trial.',
      ],
    },
  ],
};
