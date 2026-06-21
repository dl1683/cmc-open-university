// Hyperparameter search: the model learns its weights, but somebody must
// choose the knobs — lr, λ, depth. Grid search wastes most of its budget,
// random search embarrassingly beats it, and smarter methods learn as they go.

import { plotState, scatterState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hyperparameter-search',
  title: 'Hyperparameter Search',
  category: 'AI & ML',
  summary: 'Grid wastes its budget, random embarrassingly wins, and Bayesian search plays bandits over configurations.',
  controls: [
    { id: 'view', label: 'Search', type: 'select', options: ['grid vs random, fairly raced', 'smarter: Bayesian & Hyperband'], defaultValue: 'grid vs random, fairly raced' },
  ],
  run,
};

// Ground truth this toy world hides from the searcher: accuracy depends
// strongly on lr (peak at 0.1) and barely at all on λ.
const accOf = (lr) => 0.9 - 0.05 * (Math.log10(lr) + 1) ** 2;
const GRID_LR = [0.001, 0.03, 1];
const GRID_LAMBDA = [0.001, 0.01, 0.1];
const RANDOM_LR = [0.0015, 0.004, 0.012, 0.04, 0.09, 0.2, 0.35, 0.6, 0.8];
const RANDOM_LAMBDA = [0.07, 0.002, 0.5, 0.013, 0.09, 0.0007, 0.27, 0.033, 0.004];
const logX = (lr) => Math.log10(lr) + 3.2;

function* race() {
  yield {
    state: plotState({
      axes: { x: { label: 'learning rate (log scale)' }, y: { label: 'true validation accuracy' } },
      series: [{
        id: 'truth',
        label: 'acc(lr) — hidden from the searcher',
        points: Array.from({ length: 31 }, (_, i) => 10 ** (-3 + i * 0.1)).map((lr) => ({ x: logX(lr), y: accOf(lr) })),
      }],
      markers: [{ id: 'peak', x: logX(0.1), y: 0.9, label: 'best: lr = 0.1' }],
    }),
    highlight: { found: ['peak'], active: ['truth'] },
    explanation: 'Gradient descent learns the WEIGHTS, but someone must pick the knobs above the learning: learning rate, λ (Regularization), tree depth, batch size — the HYPERPARAMETERS. Each evaluation of a candidate costs a full training run plus Cross-Validation, so a search budget of 9 trials is realistic and precious. Here is the toy world\'s hidden truth: accuracy peaks sharply at lr = 0.1 and — like many real problems — barely depends on the second knob, λ. The searcher cannot see this curve. It can only spend trials. Watch two ways to spend nine of them.',
  };

  yield {
    state: scatterState({
      axes: { x: { label: 'learning rate (log scale)', min: 0, max: 3.5 }, y: { label: 'λ (log scale)', min: 0, max: 3 } },
      points: GRID_LR.flatMap((lr, i) =>
        GRID_LAMBDA.map((lam, j) => ({
          id: `g${i}${j}`,
          x: logX(lr),
          y: Math.log10(lam) + 3,
          label: j === 1 ? accOf(lr).toFixed(2) : '',
        }))),
    }),
    highlight: { compare: ['g00', 'g01', 'g02'], active: ['g10', 'g11', 'g12'] },
    explanation: `GRID SEARCH: the tidy instinct — 3 values of lr Ã— 3 values of λ, every combination, 9 trials. Now count what was actually LEARNED about the dimension that matters: the nine trials contain only THREE distinct learning rates, each tested three times against λ values that change nothing. Six of nine trials are duplicates in disguise. Best found: lr = 0.03 at ${accOf(0.03).toFixed(3)} — the peak at 0.1 fell between the grid lines, and no budget remains to look.`,
    invariant: 'A kÃ—k grid tests only k distinct values per dimension — the rest of the budget re-asks answered questions.',
  };

  yield {
    state: scatterState({
      axes: { x: { label: 'learning rate (log scale)', min: 0, max: 3.5 }, y: { label: 'λ (log scale)', min: 0, max: 3 } },
      points: RANDOM_LR.map((lr, i) => ({
        id: `r${i}`,
        x: logX(lr),
        y: Math.log10(RANDOM_LAMBDA[i]) + 3,
        label: accOf(lr) > 0.895 ? accOf(lr).toFixed(3) : '',
      })),
    }),
    highlight: { found: ['r4'], visited: RANDOM_LR.map((_, i) => `r${i}`).filter((_, i) => i !== 4) },
    explanation: `RANDOM SEARCH: same nine trials, every knob drawn independently at random (log-uniform — knobs that span orders of magnitude are searched in log space, always). Now every trial carries a FRESH learning rate: nine distinct values probe the axis that matters, and trial five lands at lr = 0.09 — accuracy ${accOf(0.09).toFixed(3)}, a whisker from the true optimum. This is the Bergstra & Bengio (2012) result that retired grid search: when only a few dimensions matter (the usual case), random search explores each important dimension kÃ— more densely for the same budget. Projection is the whole proof: project the grid onto the lr axis and 9 points collapse to 3; project random and all 9 survive.`,
  };

  yield {
    state: matrixState({
      title: 'Nine trials, two strategies',
      rows: [{ id: 'grid', label: 'grid 3Ã—3' }, { id: 'random', label: 'random Ã—9' }],
      columns: [{ id: 'distinct', label: 'distinct lr values probed' }, { id: 'best', label: 'best accuracy found' }],
      values: [[3, accOf(0.03)], [9, accOf(0.09)]],
      format: (v) => (v <= 9 ? String(v) : v.toFixed(3)),
    }),
    highlight: { compare: ['grid:distinct', 'random:distinct'], found: ['random:best'] },
    explanation: 'The scoreboard. Grid\'s weakness is structural, not unlucky: it commits its full budget before seeing a single result, and spends it on a lattice that duplicates coverage of every unimportant dimension. Random fixes the coverage but shares the second flaw — trial nine ignores everything trials one through eight discovered. Nine results sit in a notebook, screaming "the good region is around 0.1," and the search strategy cannot hear them. Fixing THAT is the next view.',
  };
}

function* smarter() {
  const tried = [
    { lr: 0.001, acc: accOf(0.001) },
    { lr: 0.8, acc: accOf(0.8) },
    { lr: 0.04, acc: accOf(0.04) },
  ];
  yield {
    state: plotState({
      axes: { x: { label: 'learning rate (log scale)' }, y: { label: 'modeled accuracy' } },
      series: [
        {
          id: 'mean',
          label: 'surrogate belief',
          points: Array.from({ length: 31 }, (_, i) => 10 ** (-3 + i * 0.1)).map((lr) => ({ x: logX(lr), y: accOf(lr) * 0.96 })),
        },
        {
          id: 'upper',
          label: 'uncertainty',
          points: Array.from({ length: 31 }, (_, i) => 10 ** (-3 + i * 0.1)).map((lr) => {
            const dist = Math.min(...tried.map((t) => Math.abs(Math.log10(lr) - Math.log10(t.lr))));
            return { x: logX(lr), y: accOf(lr) * 0.96 + 0.04 * Math.min(dist, 1.2) };
          }),
        },
      ],
      markers: [
        ...tried.map((t, i) => ({ id: `t${i}`, x: logX(t.lr), y: t.acc, label: t.acc.toFixed(2) })),
        { id: 'next', x: logX(0.13), y: 0.93, label: 'try next' },
      ],
    }),
    highlight: { visited: ['t0', 't1', 't2'], found: ['next'], compare: ['upper'] },
    explanation: 'BAYESIAN OPTIMIZATION: make the search itself learn. After each trial, fit a cheap SURROGATE model (typically a Gaussian process) over the results: a belief curve with a mean — what accuracy do I expect here? — and an uncertainty band that pinches to zero at tried points and balloons in unexplored gaps. The next trial maximizes an ACQUISITION score that wants both: high predicted mean (exploit near the 0.04 success) and high uncertainty (explore the untouched right side). You have seen this dilemma before, wearing a hospital gown: it is Thompson Sampling\'s explore/exploit trade, played over a continuous space of configurations instead of discrete arms.',
    invariant: 'The surrogate is certain where it has looked and curious where it has not; acquisition spends trials on promising ignorance.',
  };

  yield {
    state: matrixState({
      title: 'Successive halving: breadth on the cheap, depth for the worthy',
      rows: [
        { id: 'rung1', label: 'rung 1' },
        { id: 'rung2', label: 'rung 2' },
        { id: 'rung3', label: 'rung 3' },
        { id: 'rung4', label: 'rung 4' },
      ],
      columns: [{ id: 'configs', label: 'configs alive' }, { id: 'budget', label: 'epochs each' }, { id: 'cost', label: 'rung cost' }],
      values: [[27, 1, 27], [9, 3, 27], [3, 9, 27], [1, 27, 27]],
      format: String,
    }),
    highlight: { active: ['rung1:configs'], found: ['rung4:budget'] },
    explanation: 'The orthogonal trick — SUCCESSIVE HALVING — attacks the budget itself: most bad configurations reveal their badness EARLY, so why train them fully? Start 27 candidates with one epoch each; keep the best third, triple their budget; repeat. Total cost: 108 epochs — the price of fully training four configs — but 27 were screened. The risk is the slow starter (a config that blooms late gets culled at rung one), which HYPERBAND hedges by running several halving brackets at different aggression levels. Combine the two views — Bayesian choice of WHAT to try, halving choice of HOW LONG to try it — and you have roughly the inside of every AutoML service.',
  };

  yield {
    state: matrixState({
      title: 'The search protocol card',
      rows: [
        { id: 'baseline', label: 'baseline' },
        { id: 'scale', label: 'ranges' },
        { id: 'data', label: 'evaluation' },
        { id: 'honesty', label: 'reporting' },
      ],
      columns: [{ id: 'rule', label: 'rule' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'random search first — beat it before going fancy', 'log-scale anything spanning decades (lr, λ)', 'CV folds for every trial; test set stays sealed', 'state the search budget — 9 trials or 9,000?'][v],
    }),
    highlight: { active: ['data:rule'], compare: ['honesty:rule'] },
    explanation: 'The protocol card that keeps searches honest. Evaluate every trial with Cross-Validation and never let the search peek at the test set — a hyperparameter search is hundreds of chances to overfit the evaluation, the forking-paths trap from A/B Testing & p-values at industrial scale. And report the budget: "our model reached 94%" means something different after 9 trials than after 9,000 (the difference is often the entire claimed improvement over the baseline). Final perspective: tuning is optimization of a function that is expensive, noisy, and gradient-free — everything Gradient Descent is not — which is why this corner of ML looks like statistics and casinos instead of calculus.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'grid vs random, fairly raced') yield* race();
  else if (view === 'smarter: Bayesian & Hyperband') yield* smarter();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view races grid search against random search on an identical budget of nine trials. A hidden accuracy curve depends strongly on learning rate and barely on the regularization knob lambda. Neither searcher can see this curve; each can only spend trials and observe scores. Watch the scatter plots: each dot is one trial. Project both scatter plots onto the learning-rate axis and count distinct values -- that projection is the entire argument.',
        {type: 'callout', text: 'Hyperparameter search is budget allocation under uncertainty: every trial should either cover a new region or exploit evidence from earlier trials.'},
        'The second view shows two smarter ideas. Bayesian optimization fits a surrogate belief curve (mean plus uncertainty band) and picks the next trial where expected improvement is highest. Successive halving starts many candidates cheaply and promotes only survivors. The matrix at the end shows the protocol card: the rules that keep a search honest.',
        'Colors: "found" (green) marks the best configuration discovered. "Visited" (blue) marks evaluated candidates. "Compare" (orange) highlights the structural contrast between strategies. "Active" (yellow) marks the current evaluation step.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model learns its weights by gradient descent, but someone must choose the knobs above the learning: learning rate, regularization strength, depth, batch size, dropout rate. These are the hyperparameters. Each evaluation costs a full training run plus cross-validation scoring, so a budget of nine trials is realistic. Spending them well is an optimization problem in its own right -- one where you cannot take gradients, each function evaluation is expensive, and the landscape is noisy.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Three-dimensional Rosenbrock function surface with a curved valley', caption: 'Expensive black-box search often feels like navigating a curved objective surface when gradients are unavailable or untrusted. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Rosenbrock_function.svg'},
        'The core tension: most hyperparameter spaces have low effective dimensionality. One or two knobs dominate the score; the rest barely matter. But you do not know which knobs matter until after you have searched. A search strategy that wastes budget re-asking answered questions along irrelevant axes leaves the important axes undersampled.',
        {
          type: 'quote',
          text: 'For most data sets only a few of the hyperparameters really matter, but ... different hyperparameters are important on different data sets. This phenomenon makes grid search a poor choice for configuring algorithms.',
          attribution: 'James Bergstra & Yoshua Bengio, "Random Search for Hyper-Parameter Optimization," JMLR 2012',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Grid search is the tidy instinct. Pick k values for each of d knobs, train every combination, pick the winner. It feels fair, exhaustive, and reproducible. For two knobs with three values each, you get a clean 3x3 lattice of nine trials.',
        'The other naive approach is manual tuning: try a setting, inspect the loss curve, tweak a knob, repeat. Experts can be surprisingly effective at this, but the process is impossible to reproduce, impossible to parallelize, and easy to overfit to a favorite validation slice. A serious search treats the trial budget as part of the experimental protocol.',
        {
          type: 'diagram',
          label: 'Grid vs random coverage in 2D (important axis = lr)',
          text: [
            'Grid search (3x3 = 9 trials):       Random search (9 trials):',
            '',
            'lambda |  x     x     x              lambda |     x',
            '       |                                     |  x        x',
            '       |  x     x     x                     |        x',
            '       |                                     |  x  x',
            '       |  x     x     x                     |           x  x',
            '       +--+-----+-----+-- lr                +--+-+-+--+-+-+--+-- lr',
            '          |     |     |                        | | |  | | |  |',
            '       3 distinct lr values               9 distinct lr values',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Grid search hits the curse of dimensionality in a way unique to hyperparameter spaces. A k-per-dimension grid in d dimensions costs k^d trials. With five knobs and five values each, the grid demands 3,125 full training runs. But the real damage is subtler than combinatorial explosion.',
        'Project a 3x3 grid onto the learning-rate axis: nine trials collapse to three distinct values. Six of the nine trials differ only along lambda, which barely affects the score. The grid spends two-thirds of its budget re-asking already-answered questions. If the true optimum falls between grid lines -- lr = 0.1 sitting between 0.03 and 1.0 -- no budget remains to look there.',
        'This is the effective dimensionality problem. In most real search spaces, a small subset of knobs explains nearly all the variance in the score. Grid search cannot exploit this structure because it commits its budget uniformly across all dimensions before seeing a single result. The important axis gets k samples regardless of whether it deserves k^d.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Random search draws each knob independently from its range. For knobs spanning orders of magnitude (learning rate from 1e-4 to 1), sample in log space so each decade gets equal coverage. Nine random trials yield nine distinct learning rates, nine distinct lambdas -- every trial is fresh along every axis.',
        {
          type: 'code',
          language: 'python',
          text: [
            '# Random search with log-uniform sampling',
            'import numpy as np',
            '',
            'def log_uniform(lo, hi):',
            '    """Sample uniformly in log space: each decade gets equal probability."""',
            '    return np.exp(np.random.uniform(np.log(lo), np.log(hi)))',
            '',
            'def random_search(n_trials, train_and_eval):',
            '    best_score, best_config = -np.inf, None',
            '    for _ in range(n_trials):',
            '        config = {',
            '            "lr": log_uniform(1e-4, 1.0),',
            '            "weight_decay": log_uniform(1e-5, 1e-1),',
            '            "dropout": np.random.uniform(0.0, 0.5),',
            '            "depth": np.random.randint(2, 8),',
            '        }',
            '        score = train_and_eval(config)',
            '        if score > best_score:',
            '            best_score, best_config = score, config',
            '    return best_config, best_score',
          ].join('\n'),
        },
        'Bayesian optimization (BO) makes the search learn from its history. After each trial, fit a cheap surrogate model -- a Gaussian process (GP-BO) or tree-structured Parzen estimator (TPE) -- that predicts the score at untried points plus an uncertainty band. An acquisition function (expected improvement, upper confidence bound) picks the next trial where the surrogate predicts either high score (exploit) or high uncertainty (explore). This is the same explore/exploit tradeoff from Thompson Sampling and multi-armed bandits, played over a continuous configuration space.',
        'Successive halving attacks the per-trial cost. Start 27 candidates with one epoch each. Keep the top third, triple their budget, repeat. Total cost: 4 rungs x 27 epoch-units = 108 epochs, the price of four full 27-epoch trainings, but 27 candidates were screened. Hyperband hedges the early-stopping aggressiveness by running multiple halving brackets in parallel: one aggressive (many candidates, tiny initial budget), one conservative (few candidates, long initial budget).',
        {type: 'image', src: 'https://scikit-learn.org/stable/_images/sphx_glr_plot_successive_halving_iterations_001.png', alt: 'Successive halving plot showing candidate counts shrinking as iterations receive more resources', caption: 'Successive halving spends tiny budgets broadly, then concentrates training resources on survivors. Source: scikit-learn example gallery: https://scikit-learn.org/stable/auto_examples/model_selection/plot_successive_halving_iterations.html'},
        'BOHB (Bayesian Optimization and Hyperband) combines both: TPE chooses which configurations to sample, Hyperband decides how long each one trains. Population-Based Training (PBT) goes further -- it mutates hyperparameters during training, letting a population of models share discoveries in real time rather than restarting from scratch.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Random search works because of projection. In a k-per-dimension grid, projecting onto any single axis collapses k^(d-1) trials onto the same k points. Independent random draws preserve all n distinct values along every axis. When only a few dimensions matter (the usual case), random search explores each important dimension n times more densely than a grid with the same total budget. The proof is geometric: draw both scatter plots, project onto the dominant axis, and count.',
        'Bayesian optimization works because the surrogate model concentrates trials in promising regions while maintaining uncertainty-driven exploration. The GP posterior is exact at observed points (zero uncertainty) and uncertain in unexplored gaps. The acquisition function balances known-good regions against unknown ones, preventing the search from either exploiting too greedily or exploring too wastefully.',
        'Successive halving works because early performance correlates with final performance for most configurations. A configuration that scores poorly after one epoch rarely recovers to beat the leaders at epoch 27. This correlation is not guaranteed -- some architectures need warmup, some learning-rate schedules look bad early and good late -- which is why Hyperband hedges across brackets with different aggression levels.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'Trial cost', 'Overhead', 'Parallelism', 'When to use'],
          rows: [
            ['Grid search', 'k^d full trainings', 'None', 'Fully parallel', 'Tiny spaces (1-2 knobs, few values)'],
            ['Random search', 'n full trainings', 'None', 'Fully parallel', 'Default baseline; always run first'],
            ['Bayesian (GP-BO)', 'n full trainings', 'O(n^3) surrogate fit', 'Sequential (but batch BO exists)', 'Expensive models, small budgets (<100 trials)'],
            ['Bayesian (TPE)', 'n full trainings', 'O(n log n) density estimation', 'Sequential', 'High-dimensional spaces; Optuna default'],
            ['Hyperband', 'n partial trainings', 'Bracket bookkeeping', 'Parallel within brackets', 'Cheap early signal; budget-constrained'],
            ['BOHB', 'n partial trainings', 'TPE + bracket bookkeeping', 'Parallel within brackets', 'Best of both; modern AutoML default'],
            ['PBT', 'Population x full training', 'Mutation + migration', 'Fully parallel', 'Long training; schedules that co-adapt'],
          ],
        },
        'Grid cost explodes exponentially with dimensionality: five knobs at five values each is 3,125 trials. Random and Bayesian cost exactly what you budget. The surrogate fitting cost in GP-BO is O(n^3) per trial, but n is usually tens or hundreds -- trivial compared to a full model training run. The real cost metric is wall-clock time, which depends on parallelism: random search is embarrassingly parallel, while sequential BO must wait for each trial to finish before choosing the next.',
        'Successive halving is budget-efficient but not free. A 4-rung bracket with factor-of-3 reduction screens 27 candidates for the cost of ~4 full trainings. The hidden cost is infrastructure: you need checkpointing, metric reporting at each rung, and a scheduler that can pause and resume jobs. Hyperband multiplies this by running several brackets.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Random search is the universal baseline. It is trivially parallelizable, requires zero implementation beyond a loop and a random sampler, and is surprisingly hard to beat at budgets under 20 trials. The Bergstra-Bengio result showed it matching or beating grid search in less wall-clock time across multiple neural network tasks -- not because random is clever, but because grid is structurally wasteful.',
        'Bayesian optimization dominates when each trial is expensive (hours or days of training) and the budget is small (10-100 trials). Drug discovery, material science, and large-model fine-tuning all fit this profile. TPE-based tools like Optuna and Hyperopt have made BO accessible without understanding GP internals.',
        'Hyperband and BOHB dominate when early stopping is informative -- most deep learning and gradient boosting workflows. They screen orders of magnitude more candidates than sequential BO for the same compute budget. Real AutoML services (Google Vizier, AWS SageMaker, Ray Tune) use variants of BOHB internally.',
        'PBT wins in long-running training where hyperparameters should change over time -- learning-rate schedules, data augmentation strength, loss weights. DeepMind used PBT to tune AlphaGo and population-based agents in StarCraft.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Every search method fails when the space is badly designed. If the optimal learning rate is outside your chosen range, no strategy will find it. If you sample linearly over a range spanning four orders of magnitude, 99% of trials land in the top decade and the bottom three decades are nearly unsampled. Log-uniform sampling is mandatory for magnitude-spanning knobs.',
        'Bayesian optimization fails in high dimensions (above ~20 knobs). The surrogate model struggles to fit a useful surface, acquisition optimization becomes its own hard problem, and the overhead per trial grows. For very large spaces, random search or population methods are more robust.',
        'Successive halving fails on slow starters: a configuration that needs learning-rate warmup or a schedule that ramps up late will look bad at rung one and get killed. Hyperband mitigates this by running a conservative bracket, but cannot eliminate the risk entirely.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal distribution diagram showing standard deviation intervals around the mean', caption: 'Validation noise matters because search repeatedly samples from a score distribution, not from a perfectly stable scalar. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg'},
        'The deepest failure is overfit through search itself. Every trial is a chance to exploit noise in the validation set. A 9,000-trial search that reports its best score is practicing multiple testing at industrial scale -- the forking-paths problem from A/B testing. The test set must stay sealed until the search is complete, and the search budget must be reported alongside the final number. A model that "reaches 94%" after 9 trials and one that "reaches 94%" after 9,000 trials are making different claims.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Bergstra & Bengio, "Random Search for Hyper-Parameter Optimization," JMLR 2012 -- the paper that retired grid search with a clean geometric argument.',
            'Li et al., "Hyperband: A Novel Bandit-Based Approach to Hyperparameter Optimization," JMLR 2018 -- successive halving with multi-bracket hedging.',
            'Falkner et al., "BOHB: Robust and Efficient Hyperparameter Optimization at Scale," ICML 2018 -- combines TPE with Hyperband.',
            'Jaderberg et al., "Population Based Training of Neural Networks," DeepMind 2017 -- in-training hyperparameter adaptation.',
            'Snoek, Larochelle & Adams, "Practical Bayesian Optimization of Machine Learning Algorithms," NeurIPS 2012 -- GP-based Bayesian optimization for ML.',
          ],
        },
        'Prerequisite: study Cross-Validation & Honest Evaluation to understand why each trial must be scored carefully, and Gradient Descent to see what the hyperparameters are controlling. Extension: study Gaussian Process Bayesian Optimization Primer for the surrogate model inside BO, and Learning-Rate Schedules & Warmup for the single most sensitive knob. Contrast: study Multi-Armed Bandits and Thompson Sampling to see the explore/exploit framework that acquisition functions generalize.',
        {
          type: 'note',
          text: 'The practical default is simple: start with random search, sample magnitude-spanning knobs in log space, log every trial, keep the test set sealed, and report the search budget. Beat that baseline before reaching for Bayesian or halving methods.',
        },
      ],
    },
  ],
};
