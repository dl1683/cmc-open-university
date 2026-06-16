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
        `Hyperparameter search chooses the knobs the model does not learn: learning rate, Regularization: L1 & L2 strength, depth, batch size, tree count, dropout rate. Each trial usually means training a model and scoring it with Cross-Validation & Honest Evaluation, so the budget is precious. The demo hides a truth curve where accuracy depends strongly on learning rate and barely on lambda, then asks grid search and random search to spend the same nine trials. That setup mirrors real work: a few knobs matter, many barely move the score, and you do not know which is which in advance.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Grid search tries a tidy 3 by 3 lattice: three learning rates crossed with three lambdas. The problem is projection. Those nine trials contain only three distinct learning rates, and six trials mostly repeat already answered questions. The best grid value is lr = 0.03, while the true peak near 0.1 sits between grid lines. Random search draws nine independent log-scale learning rates, so all nine project to different places on the important axis; one lands near 0.09 and nearly matches the hidden optimum.`,
        `Bayesian optimization learns from previous trials. It fits a surrogate belief curve with mean and uncertainty, then chooses the next point by an acquisition score. That is Thompson Sampling style explore/exploit in configuration space. Successive halving attacks the training budget: 27 configs for 1 epoch, 9 for 3, 3 for 9, 1 for 27. The demo cost is 108 epoch-units, the price of four full 27-epoch trainings, while screening 27 candidates.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Grid cost is k^d full trainings. Random cost is exactly the number of sampled trials. Bayesian optimization adds surrogate fitting, often O(n^3) for a Gaussian process, but n is usually small compared with model-training cost. Hyperband and halving spend unevenly, giving cheap tests to many configs and real budget only to survivors. The accounting must include failed runs too; a leaderboard result that ignores the search bill is not an honest engineering number.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Random search is the baseline because it is parallel, simple, and hard to embarrass at small budgets. Bayesian search appears in AutoML systems when each model is expensive. Halving is natural when early metrics predict final quality, which is why Early Stopping & Patience feels like the one-model version. Gradient Boosting and Random Forest workflows tune depth, tree count, learning rate, and subsampling this way. Deep-learning teams often combine random exploration, a range test, and a final local sweep.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Always report the search budget. A 94% model after nine trials and a 94% model after 9,000 trials are not the same claim. Every trial is also another chance to overfit validation, the forking-paths danger from A/B Testing & p-values and Multiple Testing & False Discoveries. Use log scales for magnitude knobs, keep the test set sealed, and beat random before celebrating fancy search. Be careful with slow starters: aggressive halving can kill a configuration that needs warmup before it shines.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Gaussian Process Bayesian Optimization Primer for the surrogate model behind Bayesian search, then Learning-Rate Schedules & Warmup for the most sensitive knob. Then focus on evaluation discipline and early-budget pruning. The key mental shift is that hyperparameter tuning is optimization without gradients: expensive, noisy, and easy to overclaim unless the protocol is written down before the search begins.`,
        `For students, the practical default is simple: run a random baseline, log every trial, and keep the final test set untouched until the search is over. Reproducible tuning beats clever tuning.`,
      ],
    },
  ],
};
