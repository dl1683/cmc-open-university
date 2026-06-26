// Regularization: the leash on the weights. Without it, a separable dataset
// sends logistic weights growing forever; with it, models stay humble.
// L2 shrinks everything smoothly; L1 deletes features outright.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'regularization',
  title: 'Regularization: L1 & L2',
  category: 'AI & ML',
  summary: 'The leash on the weights: L2 shrinks everything smoothly, L1 deletes features outright — watch both paths.',
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['weights explode, then behave', 'L1 delete features, L2 keep them'], defaultValue: 'weights explode, then behave' },
  ],
  run,
};

// The same 10 emails Logistic Regression trained on — perfectly separable.
const DATA = [
  [4, 3, 1], [5, 1, 1], [3, 4, 1], [5, 4, 1], [2, 3, 1],
  [0, 1, 0], [1, 0, 0], [2, 1, 0], [1, 2, 0], [3, 1, 0],
];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// Gradient descent with weight decay: w -= lrÂ·(âˆ‡loss + λÂ·w).
function train(lambda, epochs) {
  const m = { w1: 0, w2: 0, b: 0 };
  const lr = 0.5;
  const path = [];
  for (let e = 1; e <= epochs; e++) {
    let g1 = 0;
    let g2 = 0;
    let gb = 0;
    for (const [x, y, t] of DATA) {
      const p = sigmoid(m.w1 * x + m.w2 * y + m.b);
      g1 += (p - t) * x;
      g2 += (p - t) * y;
      gb += p - t;
    }
    m.w1 -= lr * (g1 / DATA.length + lambda * m.w1);
    m.w2 -= lr * (g2 / DATA.length + lambda * m.w2);
    m.b -= (lr * gb) / DATA.length;
    if (e % 50 === 0) path.push({ x: e, y: Math.hypot(m.w1, m.w2) });
  }
  let maxP = 0;
  for (const [x, y] of DATA) maxP = Math.max(maxP, sigmoid(m.w1 * x + m.w2 * y + m.b));
  return { path, maxP, norm: Math.hypot(m.w1, m.w2) };
}

function* weightsExplode() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const nEmails = DATA.length;
  const epochs = 1000;
  const lambda = 0.1;
  const free = train(0, epochs);
  const leashed = train(lambda, epochs);

  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: '‖w‖ — size of the weights' } },
      series: [{ id: 'free', label: 'λ = 0', points: free.path.slice(0, 8) }],
    }),
    highlight: { active: ['free'] },
    explanation: `Logistic Regression ended on a warning: on perfectly separable data, the weights "would grow forever." Here is that promise kept — the SAME ${nEmails} emails, the same gradient descent, just run ${epochs} epochs, plotting the size of the weight vector. It never flattens — by epoch ${epochs} the norm has reached ${r2(free.norm)}. Why? Cross-entropy always pays a little for any probability short of 1.0, and bigger weights mean sharper probabilities — so the optimizer keeps inflating them. Nothing in the loss ever says "enough."`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: '‖w‖ — size of the weights' } },
      series: [
        { id: 'free', label: 'λ = 0', points: free.path },
        { id: 'leashed', label: 'λ = 0.1', points: leashed.path },
      ],
    }),
    highlight: { compare: ['free'], found: ['leashed'] },
    explanation: `The fix is one term: add λÂ·‖w‖² to the loss — a rent charged on every unit of weight, paid every step (in the update it appears as WEIGHT DECAY: w shrinks by λÂ·w each step before the gradient pushes back). Now two forces balance: the data pushes weights up, the penalty pulls them down, and they settle where the marginal confidence gain equals the rent — ‖w‖ plateaus at ${leashed.norm.toFixed(2)} while the unleashed run sails past ${free.norm.toFixed(1)} and keeps going. This is L2 regularization, ridge regression\'s engine and the "decay" in AdamW.`,
    invariant: 'L2 equilibrium: weights stop growing where the gradient of the loss equals λÂ·w.',
  };

  yield {
    state: matrixState({
      title: 'What the leash actually buys (epoch 1000)',
      rows: [{ id: 'free', label: 'λ = 0' }, { id: 'leashed', label: 'λ = 0.1' }],
      columns: [{ id: 'norm', label: '‖w‖' }, { id: 'maxp', label: 'most confident p(spam)' }],
      values: [[free.norm, free.maxP], [leashed.norm, leashed.maxP]],
      format: (v) => (v > 0.9 && v < 1 ? `${(v * 100).toFixed(2)}%` : v.toFixed(2)),
    }),
    highlight: { removed: ['free:maxp'], found: ['leashed:maxp'] },
    explanation: `Same boundary, same ${nEmails}/${nEmails} accuracy — but the unregularized model (norm ${r2(free.norm)}) now claims ${(free.maxP * 100).toFixed(2)}% certainty on points it has seen ${nEmails} of, while the leashed model (norm ${r2(leashed.norm)}) says a defensible ${(leashed.maxP * 100).toFixed(2)}%. That runaway sharpness IS the overconfidence that temperature scaling later repairs — regularization treats it at the source. And on noisy data the stakes rise from cosmetic to fatal: huge weights let the boundary contort around individual noisy points (overfitting); the rent at lambda = ${lambda} makes contortions unaffordable. Smoothness is exactly what generalizes.`,
  };
}

function* l1VersusL2() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const FEATURES = [
    { id: 'excl', label: 'exclamation marks', w: 2.0 },
    { id: 'caps', label: 'ALL-CAPS words', w: 1.2 },
    { id: 'len', label: 'avg word length', w: 0.4 },
    { id: 'hour', label: 'send hour', w: 0.15 },
  ];
  const nFeats = FEATURES.length;
  const maxLambda = 4;
  const LAMBDAS = Array.from({ length: 21 }, (_, i) => i * 0.2);
  const ridge = (w, lam) => w / (1 + lam);
  const lasso = (w, lam) => Math.sign(w) * Math.max(0, Math.abs(w) - lam / 2);
  // Lambda at which each feature hits zero under L1: lambda = 2*|w|
  const hourZeroLam = r2(2 * FEATURES[3].w);
  const lenZeroLam = r2(2 * FEATURES[2].w);
  const capsZeroLam = r2(2 * FEATURES[1].w);
  const hourAtMax = r2(ridge(FEATURES[3].w, maxLambda));

  yield {
    state: matrixState({
      title: 'Four features the spam model learned (no penalty)',
      rows: FEATURES.map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'w', label: 'weight' }],
      values: FEATURES.map((f) => [f.w]),
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['len:w', 'hour:w'] },
    explanation: `A richer spam model with ${nFeats} features — but look at the bottom two weights. "${FEATURES[2].label}" and "${FEATURES[3].label}" barely matter (${FEATURES[2].w.toFixed(2)}, ${FEATURES[3].w.toFixed(2)}); they are mostly noise the model memorized. An unpenalized fit keeps every feature it ever touched. The two classic penalties handle these hangers-on very differently — we will sweep the penalty strength lambda from 0 to ${maxLambda} and trace what each does to all ${nFeats} weights.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'penalty strength λ' }, y: { label: 'weight value' } },
      series: FEATURES.map((f) => ({ id: f.id, label: f.label, points: LAMBDAS.map((lam) => ({ x: lam, y: ridge(f.w, lam) })) })),
    }),
    highlight: { active: ['excl', 'caps'], compare: ['len', 'hour'] },
    explanation: `The L2 (ridge) path: each weight follows w/(1+lambda) — a smooth, proportional shrink. Crank lambda to ${maxLambda} and "${FEATURES[3].label}" falls from ${FEATURES[3].w.toFixed(2)} to ${hourAtMax}… but it NEVER reaches zero. L2 is a diplomat: it taxes big weights hardest (the penalty lambda*w^2 has a gradient proportional to w itself), making no weight special and no weight dead. All ${nFeats} features stay in the model forever, just quieter. Great for keeping correlated features balanced; useless for telling you which features matter.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'penalty strength λ' }, y: { label: 'weight value' } },
      series: FEATURES.map((f) => ({ id: f.id, label: f.label, points: LAMBDAS.map((lam) => ({ x: lam, y: lasso(f.w, lam) })) })),
    }),
    highlight: { active: ['excl'], removed: ['len', 'hour'] },
    explanation: `The L1 (lasso) path: each weight is SOFT-THRESHOLDED — slide toward zero by lambda/2 and STOP there: max(0, |w| - lambda/2). Watch the executions: "${FEATURES[3].label}" hits exactly zero at lambda = ${hourZeroLam}, "${FEATURES[2].label}" at ${lenZeroLam}, and by lambda = ${capsZeroLam} even ${FEATURES[1].label} is gone. Not small — ZERO, deleted from the model. The difference is the penalty’s shape: L1 charges |w|, whose pull is the SAME constant near zero (where L2’s proportional pull has faded to nothing), so it can push a weight the last millimeter. L1 is feature selection performed by calculus.`,
    invariant: 'L1 zeroes a weight exactly when its usefulness falls below the constant penalty pull λ/2.',
  };

  yield {
    state: matrixState({
      title: 'Choosing your leash',
      rows: [{ id: 'l2', label: 'L2 (ridge)' }, { id: 'l1', label: 'L1 (lasso)' }, { id: 'en', label: 'elastic net' }],
      columns: [{ id: 'effect', label: 'effect on weights' }, { id: 'use', label: 'reach for it when' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'all shrink, none die', 'default; correlated features', 'irrelevant ones hit exact 0', 'you want few features, interpretable', 'both penalties mixed', 'many correlated + want sparsity'][v],
    }),
    highlight: { active: ['en:effect'] },
    explanation: `The decision table, plus the hybrid: ELASTIC NET mixes both penalties, getting sparsity without lasso's habit of arbitrarily keeping one feature from each correlated group. By lambda = ${maxLambda}, L2 still has all ${nFeats} features alive (smallest = ${hourAtMax}), while L1 zeroed ${nFeats - 1} of ${nFeats}. The deeper lesson generalizes past linear models: Dropout regularizes by randomly silencing neurons, early stopping by cutting training short, data augmentation by multiplying experience — every one is the same bet that a model prevented from being too sure, too sharp, or too dependent on any single signal will tell the truth on data it has never seen.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'weights explode, then behave') yield* weightsExplode();
  else if (view === 'L1 delete features, L2 keep them') yield* l1VersusL2();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the weight-norm view as a price meter. Without a penalty, the optimizer keeps increasing weights because training loss still improves by making probabilities more extreme. With regularization, the model must pay for that extra weight.',
        'Read the L1 and L2 paths as different kinds of pressure. L2 shrinks coefficients smoothly. L1 can drive weak coefficients exactly to zero, which means feature selection.',
        {type: 'image', src: './assets/gifs/regularization.gif', alt: 'Animated walkthrough of the regularization visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Regularization exists because minimizing training loss alone can reward brittle explanations. A model may use large weights or weak accidental features to fit noise in the training set. That can lower training error while raising future error.',
        'A regularizer adds a cost for complexity during training. The model can still use complexity, but only if the improvement in data loss is worth the added price.',
        {type: `callout`, text: `Regularization prices fragile complexity, so a model must prove that extra weight, features, or training time improve future performance rather than only training loss.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to let the optimizer fit the training data as well as possible. If a model has enough parameters, it can often separate or memorize the examples. The training metric looks good because the model is allowed to spend capacity freely.',
        'That approach is not foolish on clean simple data. If the model class is small and the data is representative, plain loss minimization can work. The danger appears when the model has more flexibility than the evidence can justify.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is generalization. The optimizer sees the training set, not the future population. If noise happens to correlate with the label in the sample, unconstrained training can treat that noise as signal.',
        'More training can make this worse. On separable data, cross-entropy keeps rewarding larger margins even after the classification boundary stops changing. The probabilities become more confident without becoming more honest.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Regularization is a price system for fragile behavior. L2 makes large weights increasingly expensive by adding lambda times the squared weight. L1 charges a fixed cost per unit of absolute weight, which can make weak features disappear.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg`, alt: `Rosenbrock function surface with a curved valley`, caption: `Loss landscapes can contain narrow valleys; regularization changes which solutions are affordable rather than simply chasing the lowest training point. Source: https://commons.wikimedia.org/wiki/File:Rosenbrock_function.svg.`},
        'The chosen penalty encodes a belief about what should generalize. L2 says many small effects are plausible. L1 says only a smaller set of features should survive.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training minimizes a modified objective: data loss plus a penalty. For L2, the penalty is lambda * sum(w_i^2). For L1, the penalty is lambda * sum(abs(w_i)).',
        'In gradient descent, L2 adds a pull proportional to the current weight, so large weights shrink harder than small weights. L1 adds a constant pull toward zero for every nonzero weight. Near zero, that constant pull can overpower weak evidence and set the weight to exactly zero.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Regularization works when the penalty matches the data-generating problem. If large weights are more likely to be noise than signal, L2 reduces variance by discouraging extreme solutions. If only a few features should matter, L1 reduces variance by deleting weak features.',
        'The correctness argument is about objective optimization and validation, not guaranteed truth. The optimizer is correct if it minimizes the penalized objective. The regularizer is useful only if held-out data confirms that the added bias lowered future error more than it hurt fit.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The arithmetic cost is small: each update adds one penalty term per weight. Inference cost is usually unchanged for L2 because the model shape is the same. L1 can reduce inference cost if zero weights are represented sparsely.',
        'The real cost is choosing lambda. When lambda doubles, the penalty doubles for the same weights, so the model needs stronger evidence to keep complexity. Too little penalty overfits; too much penalty underfits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'L2 weight decay is standard for linear models and many neural networks. AdamW is common because it applies weight decay directly instead of mixing it into Adam\'s adaptive gradient scaling. Ridge regression is the classical linear-model version.',
        'L1 is used when sparse models matter, such as feature selection for tabular prediction or high-dimensional text. Elastic net combines L1 and L2 when correlated features make pure L1 unstable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Regularization does not fix bad data. Leakage, mislabeled examples, train-test distribution shift, and target contamination can survive a smaller model. A penalty can make a wrong model simpler without making it true.',
        'It also fails when the simplicity assumption is wrong. Heavy L1 can delete redundant but useful signals. Heavy L2 can wash out small real effects. The validation protocol must choose the penalty, not aesthetics.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take weights [5.0, -3.0, 0.2] with lambda = 0.1. The L2 penalty is 0.1 * (25 + 9 + 0.04) = 3.404. The gradient contribution is [1.0, -0.6, 0.04] if the derivative uses 2 * lambda * w.',
        'For L1 with the same weights and lambda, the penalty is 0.1 * (5 + 3 + 0.2) = 0.82. The gradient contribution is [0.1, -0.1, 0.1] away from zero. The tiny 0.2 weight gets the same absolute push as the 5.0 weight, so weak features can vanish.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Core references: Tikhonov and Arsenin on regularization of ill-posed problems; Tibshirani, Regression Shrinkage and Selection via the Lasso, 1996; Loshchilov and Hutter, Decoupled Weight Decay Regularization, 2019.',
        'Study next: logistic regression for separable-data weight growth, gradient descent for update mechanics, cross-validation for lambda selection, dropout for neural regularization, and early stopping for time-based regularization.',
      ],
    },
  ],
};