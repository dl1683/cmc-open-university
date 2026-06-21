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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/gaussian-process-bayesian-optimization-primer.gif', alt: 'Animated walkthrough of the gaussian process bayesian optimization primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why Bayesian optimization exists',
      paragraphs: [
        `Bayesian optimization exists for settings where each experiment is expensive enough that a bad search policy has a real cost. Training a large model configuration may take six hours. A robotics run may risk hardware. A lab assay may consume scarce material. A simulation may occupy a cluster queue. In those settings, "try a lot of things and keep the best" is not a strategy; it is a budget leak.`,
        `The central problem is that the objective function is unknown. You can ask for the validation score at one learning rate, one regularization value, or one compiler setting, but you cannot see the whole surface. Bayesian optimization builds a cheap statistical model of that unknown surface, uses the model to choose the next experiment, pays for the real evaluation, and then updates the model. A Gaussian process is one of the cleanest surrogates for this loop because it gives both a predicted mean and a predicted uncertainty.`,
        {type: `callout`, text: `Bayesian optimization buys information, not just scores: the surrogate tracks both what looks good and where ignorance is still valuable.`},
      ],
    },
    {
      heading: 'The naive approach and the wall',
      paragraphs: [
        `The obvious baseline is grid search. Pick a list of possible values for each knob, evaluate every combination, and select the winner. Grid search is easy to explain, but it collapses as dimensions grow. Ten values for six knobs already means one million experiments. It also wastes trials on axes that may barely matter while undersampling sensitive axes where small changes decide the result.`,
        `Random search is usually a stronger baseline. It avoids the rigid grid, explores more combinations, and is hard to embarrass when only a few dimensions matter. But random search still has no memory beyond the best score seen so far. It can spend a trial in a region that previous observations already made implausible. It can also ignore a nearby uncertain region that might contain a better answer. The wall is not only dimensionality; it is the cost of treating each trial as isolated from the evidence already purchased.`,
      ],
    },
    {
      heading: 'The Gaussian process surrogate',
      paragraphs: [
        `A Gaussian process is a distribution over functions. Before seeing data, it says which functions are plausible. After seeing trials, it conditions that belief on the observed inputs and scores. For any candidate point, the fitted GP returns a posterior mean, which is the current best estimate of the objective there, and a posterior variance, which measures how uncertain the surrogate remains at that point.`,
        `The kernel defines the prior notion of similarity. If two learning rates are close, their scores should usually be more related than two learning rates far apart. The kernel matrix stores those pairwise relationships among observed trials. A smooth radial basis kernel assumes very smooth functions. A Matern kernel allows rougher behavior and is often a safer default for real tuning problems. A white-noise term accounts for measurement noise, such as randomness from initialization, data order, or nondeterministic hardware.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Gaussian_process_draws_from_prior_distribution.png/330px-Gaussian_process_draws_from_prior_distribution.png`, alt: `Gaussian process prior samples under different kernels`, caption: `Different kernels produce different function priors, so kernel choice is an assumption about smoothness before any trial is run. Source: Wikimedia Commons, Gaussian process prior examples.`},
      ],
    },
    {
      heading: 'What the stored state means',
      paragraphs: [
        `A practical GP implementation stores the tried inputs X_train, their observed scores y_train, the kernel matrix K with a noise term on the diagonal, a Cholesky factor L, and a vector often called alpha. The Cholesky factor matters because direct matrix inversion is numerically fragile and unnecessary. Instead of computing K^-1 explicitly, the implementation solves triangular systems using L. That is how it obtains alpha for posterior means and reuses the same factor for posterior variances.`,
        `At a candidate x, the model computes a vector k(x, X_train): the similarity between x and every tried point. The posterior mean is a weighted combination of observed scores, with weights determined by the kernel and alpha. The posterior variance starts from the prior uncertainty and subtracts the part explained by nearby observations. This is why the uncertainty band pinches near tried points and widens in gaps. The band is not decoration; it is the search policy's reason to explore.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Gaussian_Process_Regression.png/250px-Gaussian_Process_Regression.png`, alt: `Gaussian process regression showing prior, posterior, and uncertainty`, caption: `The posterior mean and uncertainty band are the state that the acquisition function consumes. Source: Wikimedia Commons, Gaussian Process Regression.`},
      ],
    },
    {
      heading: 'Acquisition is the decision rule',
      paragraphs: [
        `The GP posterior estimates the objective; the acquisition function decides where to spend the next real trial. This distinction is important. The acquisition curve is not the predicted validation score. It is a score for the action "evaluate here next." It combines exploitation, which favors high posterior mean, with exploration, which favors high uncertainty.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Regressions_sine_demo.svg/250px-Regressions_sine_demo.svg.png`, alt: `Regression comparison on noisy sine data with uncertainty bands`, caption: `Surrogate uncertainty changes the next-point decision: a candidate can be valuable because it is promising or because it reduces a costly unknown. Source: Wikimedia Commons, regression sine demo.`},
        `Upper confidence bound acquisition is the simplest to read: acquisition(x) = mean(x) + beta * sigma(x). A larger beta makes the search more optimistic about uncertain regions. Expected improvement asks how much a candidate is expected to beat the current best observation. Probability of improvement asks how likely it is to beat the current best, but can become too local because it does not care by how much. Thompson sampling draws one plausible function from the posterior and optimizes that draw. Each acquisition family spends uncertainty differently; none removes the need to define the search space well.`,
      ],
    },
    {
      heading: 'A concrete tuning example',
      paragraphs: [
        `Suppose a team is tuning a model and each training run takes six hours. The variables are learning rate, weight decay, batch size, and dropout. The team begins with a small random design so the surrogate is not fitted to a single corner of the space. After those initial runs, the GP learns that high learning rates fail, medium weight decay is promising, and dropout has a noisy effect.`,
        `The acquisition function then evaluates many candidate configurations cheaply against the surrogate. One candidate may have the best predicted score but low uncertainty because it is close to prior trials. Another may have a slightly lower predicted score but wider uncertainty because it sits in an underexplored region near promising results. Bayesian optimization may choose the second candidate because the possible upside is worth one expensive run. After the real run finishes, the observation is appended, the posterior changes, and the next decision is made with more evidence.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The method works when the surrogate's assumptions are close enough to the real objective that the posterior guides trials better than chance. Smoothness is the usual reason. Hyperparameter surfaces are rarely perfectly smooth, but neighboring configurations often have related behavior. A learning rate of 0.001 and 0.0012 are usually more alike than 0.001 and 0.1. The kernel turns that intuition into covariance.`,
        `It also works because uncertainty is explicit. Greedy search repeatedly samples what currently looks best, which can lock onto a local favorite. Pure exploration samples unknown regions even when they are unlikely to matter. Bayesian optimization prices both. Early in the budget, uncertainty can dominate because the system needs information. Later, if the posterior is confident, the acquisition can concentrate near the best regions. This budget-aware behavior is the reason BO is useful when trials are scarce.`,
      ],
    },
    {
      heading: 'Cost and scaling limits',
      paragraphs: [
        `Exact Gaussian processes are elegant but expensive. Fitting requires a matrix factorization that costs O(n^3) in the number of completed trials, and storing the covariance matrix costs O(n^2). For hyperparameter search with dozens or a few hundred trials, that is often acceptable because the real experiments are much more expensive than the surrogate update. For millions of observations, exact GPs are the wrong tool unless approximations are used.`,
        `Prediction and acquisition also have engineering costs. The system must optimize the acquisition function, handle failed trials, avoid duplicate suggestions when workers run in parallel, track pending experiments, and decide how to handle noisy measurements. Larger or higher-dimensional problems may need sparse GPs, inducing points, trust-region BO, random embeddings, tree-structured Parzen estimators, or other surrogate families. The clean GP story is the base case, not a universal production recipe.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `GP Bayesian optimization is strongest when evaluations are expensive, the number of tunable dimensions is moderate, the objective has local structure, and sequential feedback is acceptable. Hyperparameter tuning is the standard example, but the same pattern appears in robotics, materials search, compiler optimization, database configuration, simulation calibration, and experimental design.`,
        `It is also useful when reporting uncertainty matters. The surrogate can say, "we believe this region is good," and separately, "we do not know this nearby region well enough." That separation helps teams decide whether another experiment is worth the cost. Random search gives an unbiased sample history, but it does not explain where uncertainty remains.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `It fails when the search space is badly specified. If the true best configuration lies outside the bounds, the optimizer cannot find it. If the parameterization is poor, the kernel may treat meaningful differences as small or meaningless differences as large. If the objective is discontinuous, adversarial, or dominated by categorical interactions, a smooth GP can become confidently wrong.`,
        `It also fails when noise is ignored. A single lucky validation run can pull the posterior upward and attract more trials. A single failed run can make a useful region look bad. Replicates, noise models, noise-aware objectives, and honest logging are not paperwork; they protect the optimizer from chasing randomness. Finally, repeated tuning on the same validation set can overfit the evaluation process. A strong BO result still needs a final untouched test or production validation.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the kernel posterior view, follow the path from trials to kernel, Cholesky factor, alpha, and posterior. The trial points are the expensive evidence. The kernel matrix is the memory of similarity. The Cholesky factor is the stable numerical representation of that memory. The posterior mean and variance are the usable prediction state.`,
        `In the acquisition loop view, watch the split between modeling and decision-making. The posterior feeds the acquisition function, the acquisition chooses the next x, and the completed trial returns to the training set. The loop is the concept. Bayesian optimization is not a one-time fit; it is a repeated contract between a cheap belief model and an expensive reality check.`,
      ],
    },
    {
      heading: 'Production protocol',
      paragraphs: [
        `A responsible BO run starts by declaring the objective, bounds, budget, random seed policy, failure handling, and final evaluation procedure. It logs every trial, not only the winner. It records pending jobs so parallel workers do not duplicate each other. It stores the acquisition parameters and kernel choices so the run can be reproduced or audited later.`,
        `The final report should compare against random search under the same budget. Random search is the baseline because it is simple, parallel, and often strong. If Bayesian optimization wins only after many hidden warmup runs, cherry-picked restarts, or repeated validation reuse, the claimed efficiency may be false. The engineering question is not "did BO find a good point?" The question is "did BO buy better information per expensive trial than the baseline?"`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Hyperparameter Search for the outer evaluation protocol, LinUCB for another example of optimism under uncertainty, Calibration & Reliability Diagrams for the difference between scores and trustworthy probabilities, and Sherman-Morrison Rank-One Update for the linear-algebra idea behind cheap updates. For deeper theory, read Gaussian Processes for Machine Learning by Rasmussen and Williams, then study expected improvement, upper confidence bounds, Thompson sampling, and modern trust-region Bayesian optimization.`,
      ],
    },
  ],
};
