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
    explanation: `GRID SEARCH: the tidy instinct — 3 values of lr × 3 values of λ, every combination, 9 trials. Now count what was actually LEARNED about the dimension that matters: the nine trials contain only THREE distinct learning rates, each tested three times against λ values that change nothing. Six of nine trials are duplicates in disguise. Best found: lr = 0.03 at ${accOf(0.03).toFixed(3)} — the peak at 0.1 fell between the grid lines, and no budget remains to look.`,
    invariant: 'A k×k grid tests only k distinct values per dimension — the rest of the budget re-asks answered questions.',
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
    explanation: `RANDOM SEARCH: same nine trials, every knob drawn independently at random (log-uniform — knobs that span orders of magnitude are searched in log space, always). Now every trial carries a FRESH learning rate: nine distinct values probe the axis that matters, and trial five lands at lr = 0.09 — accuracy ${accOf(0.09).toFixed(3)}, a whisker from the true optimum. This is the Bergstra & Bengio (2012) result that retired grid search: when only a few dimensions matter (the usual case), random search explores each important dimension k× more densely for the same budget. Projection is the whole proof: project the grid onto the lr axis and 9 points collapse to 3; project random and all 9 survive.`,
  };

  yield {
    state: matrixState({
      title: 'Nine trials, two strategies',
      rows: [{ id: 'grid', label: 'grid 3×3' }, { id: 'random', label: 'random ×9' }],
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
      heading: `What it is`,
      paragraphs: [
        `Hyperparameter search is the problem of choosing the knobs above the learning: learning rate, regularization strength, tree depth, batch size — anything you set once before training, as opposed to weights that the model adjusts itself. Neural networks learn their weights through gradient descent. You must choose the learning rate. Forests learn how to split; you choose how many trees. A Bayesian classifier learns word probabilities; you choose whether to smooth with Laplace. These choices are hyperparameters, and unlike weights, they do not respond to gradients — a hyperparameter search is an optimization problem without derivatives, where every evaluation costs a full training run plus cross-validation. This makes it expensive, noisy, and qualitatively different from gradient descent.`,
        `The challenge is the budget. You have maybe 9 to 9000 trials depending on scale, and you must spend them wisely. Grid search looks tidy: set 3 learning rates and 3 regularization values, test all 9 combinations, pick the best. Random search looks unruly: draw each hyperparameter independently at random, ignoring the others. Smarter methods — Bayesian Optimization, Hyperband — treat the search as a learning problem itself: they study your trial results and concentrate the remaining budget on the most promising regions.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Grid search commits your budget to a lattice *before* seeing any results. If you choose 3 values for learning rate and 3 for regularization, those 9 trials are fixed. Now here is the trap: a 3×3 grid tests only 3 distinct learning rates — each is tried 3 times against different regularization values that, in this problem, barely matter. You burn 6 trials on re-asking the same learning-rate questions. If the optimum falls between grid lines, you miss it entirely and have no budget left to recover.`,
        `Random search fixes this in a counterintuitive way. Draw each hyperparameter independently at random (in log-space for anything spanning orders of magnitude — learning rates, regularization, depths). Now 9 trials contain 9 distinct learning rates probing the dimension that matters. This is the Bergstra & Bengio (2012) result: when low-dimensional projections matter more than their interactions (the typical case), random search explores each important dimension more densely than any grid with the same budget. The intuition is "projection": collapse a grid onto one axis and 9 points become 3 copies; collapse random onto any axis and all 9 points scatter across it.`,
        `Bayesian Optimization treats the hyperparameter space as a continuous landscape you must climb with a tiny sample budget. After each trial, fit a cheap surrogate model (usually a Gaussian process) that predicts accuracy with a mean curve and an uncertainty band that pinches to zero at points you have tried and balloons in unexplored gaps. Use an acquisition function — typically trading expected improvement and uncertainty — to pick the next trial. This is Thompson Sampling played over a configuration space: you want high mean (exploit) and high uncertainty (explore), and you balance them with a principled score.`,
        `Successive Halving attacks the budget itself. Most bad configurations reveal their badness early. Start with 27 candidates and train each for 1 epoch; keep the top third and triple their budget to 3 epochs; repeat until one remains. Total cost: 27 + 9 + 3 + 1 = 40 epochs (equivalent to 4 full trainings), yet you screened 27 candidates. The risk is the slow starter — a configuration that blooms late gets eliminated at the first rung. Hyperband hedges this by running several halving brackets at different aggression levels, combining what Bayesian Optimization does (choose smart configurations) with what halving does (allocate training budget unevenly based on early signals).`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Grid search: training cost is |grid| × (single-model cost), where |grid| = k^d for k values per dimension in d dimensions. No learning overhead; the grid is fixed before any trial runs. Testing and decision are O(1) — pick the highest score. Space is O(k^d) to store results.`,
        `Random search: cost is (budget) × (single-model cost). No overhead; samples are drawn once. Testing is O(budget).`,
        `Bayesian Optimization: cost is (budget) × (single-model cost + surrogate fit). Fitting the surrogate is O(n^3) where n is the number of prior trials; with n around 100, this is noticeable but negligible next to a full training run. Storage is O(budget × dimension count).`,
        `Successive Halving: cost is (budget) × (single-model cost), distributed unevenly across rungs. Early filtering is cheap; late rungs are full-budget trials on the survivors.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every machine-learning pipeline that leaves hyperparameters to humans (rather than learning them) requires a search strategy. Random search became the industry standard after Bergstra & Bengio's paper because it is simple, parallelizable, and hard to beat at small budgets. Bayesian Optimization powers commercial AutoML services (Google Vertex AI, AWS SageMaker) and research hyperparameter frameworks (Hyperopt, Optuna) where you want to maximize the value from a costly budget (maybe 100 models, each taking hours). Successive Halving and Hyperband are the backbone of cutting-edge AutoML systems; Hyperband especially appears in competition-winning solutions because it does more with less budget. In practice, teams often start with random search as a baseline (it is the protocol card rule: beat random before going fancy) and switch to Bayesian Optimization when the budget justifies the overhead, or use Hyperband when they need to search thousands of configurations with limited compute. The very largest efforts (foundation model tuning) combine multiple strategies: Bayesian choice of configurations plus halving to ration training time, plus parallel evaluation across many machines.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Forgetting the budget in the headline: "our model reached 94%" is meaningless without stating how many trials it took. Nine trials and 9,000 trials paint entirely different pictures; the latter often attributes its gain to lucky hyperparameter discovery rather than model quality. This is the forking-paths trap from A/B Testing & p-values, played at a scale that dwarfs single A/B tests.`,
        `Ignoring the baseline: if random search reaches 0.88 accuracy, beating it with Bayesian Optimization at 0.89 is a 1% gain that might be noise. The protocol card rule is hard for a reason: random search is free overhead and often wins. Use it as the yardstick.`,
        `Overfitting the hyperparameters to the validation set: every trial is a chance to overfit. This is why Cross-Validation with its k-fold protocol matters — don't let a single validation fold dominate. And never let the searcher see the test set, or the improvement you measure will evaporate on held-out data.`,
        `Assuming linear scales when the truth is exponential: learning rate spans from 0.00001 to 10, and that is just one order of magnitude on each end. Always search in log space for hyperparameters that control magnitude (rates, regularization, depths). The visualization shows grid search in log space; without it, the advantage vanishes.`,
        `The slow-starter trap: Successive Halving can eliminate configurations that learn slowly. If your model is known to warm up gradually, you may need more lenient halving thresholds or the full Hyperband approach that runs multiple brackets at different aggression levels.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Hyperparameter search is the outer loop of model development; Cross-Validation & Honest Evaluation is the inner loop — how you evaluate each trial fairly. Thompson Sampling is the explore-exploit framework that Bayesian Optimization applies to continuous spaces. Gradient Boosting is a model type that needs careful hyperparameter tuning (tree depth, learning rate, subsampling) — watch it in the site once hyperparameter search intuition is solid. A/B Testing & p-values covers the statistical pitfalls of high-volume testing, the same forking-paths problem that hyperparameter search exhibits. Regularization: L1 & L2 covers one of the most-tuned hyperparameters; after understanding the search problem, understanding what the regularization strength knob does inside the loss is the next step.`,
      ],
    },
  ],
};
