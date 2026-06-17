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

// Gradient descent with weight decay: w -= lr·(∇loss + λ·w).
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
  const free = train(0, 1000);
  const leashed = train(0.1, 1000);

  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: '‖w‖ — size of the weights' } },
      series: [{ id: 'free', label: 'λ = 0', points: free.path.slice(0, 8) }],
    }),
    highlight: { active: ['free'] },
    explanation: 'Logistic Regression ended on a warning: on perfectly separable data, the weights "would grow forever." Here is that promise kept — the SAME 10 emails, the same gradient descent, just run longer, plotting the size of the weight vector. It never flattens. Why? Cross-entropy always pays a little for any probability short of 1.0, and bigger weights mean sharper probabilities — so the optimizer keeps inflating them. Nothing in the loss ever says "enough." The boundary stopped moving around epoch 60; everything after is pure confidence inflation.',
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
    explanation: `The fix is one term: add λ·‖w‖² to the loss — a rent charged on every unit of weight, paid every step (in the update it appears as WEIGHT DECAY: w shrinks by λ·w each step before the gradient pushes back). Now two forces balance: the data pushes weights up, the penalty pulls them down, and they settle where the marginal confidence gain equals the rent — ‖w‖ plateaus at ${leashed.norm.toFixed(2)} while the unleashed run sails past ${free.norm.toFixed(1)} and keeps going. This is L2 regularization, ridge regression's engine and the "decay" in AdamW.`,
    invariant: 'L2 equilibrium: weights stop growing where the gradient of the loss equals λ·w.',
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
    explanation: 'Same boundary, same 10/10 accuracy — but the unregularized model now claims 99.999% certainty on points it has seen ten of, while the leashed model says a defensible 98.7%. Recall Calibration & Reliability Diagrams: that runaway sharpness IS the overconfidence that temperature scaling later repairs — regularization treats it at the source. And on noisy data the stakes rise from cosmetic to fatal: huge weights let the boundary contort around individual noisy points (overfitting); the rent makes contortions unaffordable. Smoothness is exactly what generalizes.',
  };
}

function* l1VersusL2() {
  const FEATURES = [
    { id: 'excl', label: 'exclamation marks', w: 2.0 },
    { id: 'caps', label: 'ALL-CAPS words', w: 1.2 },
    { id: 'len', label: 'avg word length', w: 0.4 },
    { id: 'hour', label: 'send hour', w: 0.15 },
  ];
  const LAMBDAS = Array.from({ length: 21 }, (_, i) => i * 0.2);
  const ridge = (w, lam) => w / (1 + lam);
  const lasso = (w, lam) => Math.sign(w) * Math.max(0, Math.abs(w) - lam / 2);

  yield {
    state: matrixState({
      title: 'Four features the spam model learned (no penalty)',
      rows: FEATURES.map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'w', label: 'weight' }],
      values: FEATURES.map((f) => [f.w]),
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['len:w', 'hour:w'] },
    explanation: 'A richer spam model with four features — but look at the bottom two weights. "Average word length" and "send hour" barely matter (0.40, 0.15); they are mostly noise the model memorized. An unpenalized fit keeps every feature it ever touched. The two classic penalties handle these hangers-on very differently — we will sweep the penalty strength λ from 0 to 4 and trace what each does to all four weights.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'penalty strength λ' }, y: { label: 'weight value' } },
      series: FEATURES.map((f) => ({ id: f.id, label: f.label, points: LAMBDAS.map((lam) => ({ x: lam, y: ridge(f.w, lam) })) })),
    }),
    highlight: { active: ['excl', 'caps'], compare: ['len', 'hour'] },
    explanation: 'The L2 (ridge) path: each weight follows w/(1+λ) — a smooth, proportional shrink. Crank λ to 4 and "send hour" falls from 0.15 to 0.03… but it NEVER reaches zero. L2 is a diplomat: it taxes big weights hardest (the penalty λ·w² has a gradient proportional to w itself), making no weight special and no weight dead. Every feature stays in the model forever, just quieter. Great for keeping correlated features balanced; useless for telling you which features matter.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'penalty strength λ' }, y: { label: 'weight value' } },
      series: FEATURES.map((f) => ({ id: f.id, label: f.label, points: LAMBDAS.map((lam) => ({ x: lam, y: lasso(f.w, lam) })) })),
    }),
    highlight: { active: ['excl'], removed: ['len', 'hour'] },
    explanation: 'The L1 (lasso) path: each weight is SOFT-THRESHOLDED — slide toward zero by λ/2 and STOP there: max(0, |w| − λ/2). Watch the executions: "send hour" hits exactly zero at λ = 0.3, "word length" at 0.8, and by λ = 2.4 even ALL-CAPS is gone. Not small — ZERO, deleted from the model. The difference is the penalty\'s shape: L1 charges |w|, whose pull is the SAME constant near zero (where L2\'s proportional pull has faded to nothing), so it can push a weight the last millimeter. L1 is feature selection performed by calculus.',
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
    explanation: 'The decision table, plus the hybrid: ELASTIC NET mixes both penalties, getting sparsity without lasso\'s habit of arbitrarily keeping one feature from each correlated group. The deeper lesson generalizes past linear models: Dropout regularizes by randomly silencing neurons, early stopping by cutting training short, data augmentation by multiplying experience — every one is the same bet that a model prevented from being too sure, too sharp, or too dependent on any single signal will tell the truth on data it has never seen. Constraint is not the enemy of learning; it is most of it.',
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
      heading: `What it is`,
      paragraphs: [
        `Regularization is a constraint added to training so a model cannot buy tiny training-loss improvements with huge, fragile weights. The demo starts from the same separable email data used by Logistic Regression. Without a penalty, Gradient Descent keeps increasing the weight norm long after the boundary classifies all ten points correctly, because cross-entropy still rewards turning 0.99 into 0.999. With lambda = 0.1, the norm plateaus near 1.38 instead of climbing past 3.68, and the most confident spam probability is a humbler 98.67% instead of 99.999%.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `L2 regularization adds a squared-weight rent to the loss. In the update, that appears as weight decay: w moves against the data gradient, then lambda*w pulls it back toward zero. The equilibrium is the point where extra confidence is no longer worth the rent. L2 shrinks all weights smoothly, which is useful when several correlated features all carry some signal.`,
        `L1 regularization uses an absolute-value rent. In the demo's feature sweep, the L1 path soft-thresholds weights: each slides toward zero by a fixed amount and then stops exactly at zero. The weak send hour feature dies at lambda = 0.3, average word length at lambda = 0.8, while exclamation marks survive longer. That is feature selection by optimization. FTRL-Proximal Online CTR Case Study shows the production sparse-online version, where lazy L1 thresholding keeps a huge hashed model compact. Elastic net mixes L1 and L2, keeping sparsity while avoiding lasso's habit of choosing one arbitrary feature from a correlated group.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `Read the weight-norm plot as confidence pressure. On separable data, the boundary can stop changing while cross-entropy still rewards larger weights. L2 adds a counterforce, so the useful signal and the penalty settle into a finite balance.`,
        `Read the L1/L2 paths as two different constraints. L2 turns every coefficient down smoothly and keeps correlated signals alive. L1 applies a constant pull near zero, so weak features can disappear entirely. The right question is which constraint improves held-out behavior, not which makes the prettiest weights.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious way to reduce training error is to let the model fit as hard as it can. On separable data, that can push weights upward forever because the loss keeps rewarding more confidence. The decision boundary may stop changing, but the probabilities become sharper and less honest.`,
        `The wall is generalization. A model that can contort itself around every training quirk may look brilliant on the training set and fragile on new data. Regularization adds a cost for complexity so the model must spend capacity only where the evidence is worth it.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Regularization is not punishment for learning. It is a price system. Large weights, too many active features, too much co-adaptation, or too much training time all become expensive. The model can still use them, but only when they buy enough reduction in the data loss.`,
        `L2 says every additional unit of weight gets increasingly expensive. L1 says each feature must clear a fixed usefulness threshold or disappear. Dropout, augmentation, and early stopping use different mechanisms, but the same idea: constrain the easy path to memorization.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Regularization works when the penalty matches a real belief about future data. L2 works well when many features may carry small related signals and large coefficients are more likely to be noise than truth. L1 works when only a smaller set of features should survive. Dropout works when a neural network should not depend too heavily on one activation path.`,
        `The method improves generalization because the model must explain the training data with less fragile machinery. It can no longer spend unlimited weight, unlimited features, or unlimited training time to memorize quirks. If the constraint is chosen honestly with validation data, it can lower variance more than it raises bias.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `A spam model has four features: exclamation marks, all-caps words, average word length, and send hour. The first two carry real signal. The last two are weak artifacts of a small training set. Without regularization, all four survive because the optimizer has no reason to delete small but noisy correlations.`,
        `With L2, every weight shrinks, so the weak features become quieter but remain present. With L1, send hour and average word length hit exact zero as lambda rises. The model becomes smaller and more interpretable, but it might arbitrarily choose one feature from a correlated group. Elastic net is the compromise when correlated signals and sparsity both matter.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The arithmetic is cheap: one extra term per weight during training. Inference cost is unchanged because the final model is still the same shape. The real cost is choosing lambda. Cross-Validation & Honest Evaluation gives the right protocol: try candidate penalties on validation folds, pick the one with the best held-out score, retrain, then test once. Learning Curves & Bias–Variance explains what lambda trades: more penalty usually lowers variance but raises bias. The demo makes that trade visible as weight size rather than abstract error: the leashed line is less extreme, not less informed.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `L2 weight decay is a default for linear models and neural networks, including optimizers such as AdamW. L1 is popular when a sparse, readable model matters: medicine, credit, fraud, and any domain where you must explain which features survived. Dropout is a randomized regularizer for neural nets. Early Stopping & Patience regularizes by cutting training before validation turns upward. Low-rank adaptation constrains fine-tuning by learning a small update instead of rewriting every weight. The mechanisms differ, but the promise is the same: reduce dependence on quirks of the training set.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Smaller weights are not automatically better. Too much penalty can underfit and lower both training and validation performance. A feature zeroed by L1 is not necessarily useless; it may be redundant with a correlated survivor. Regularization does not repair Data Leakage & Contamination, label errors, or a bad split. It also does not guarantee honest probabilities; Calibration & Reliability Diagrams is still needed when downstream decisions consume confidence. Random Forest reduces overfitting mostly by averaging randomized trees, which is a different regularization strategy than penalizing coefficients.`,
      ],
    },
    {
      heading: `Operational signals`,
      paragraphs: [
        `Track train loss, validation loss, weight norm, number of nonzero features, calibration error, slice performance, chosen lambda, and variance across folds. If validation improves while train loss worsens slightly, the penalty is doing its job. If both collapse, the penalty is too strong or the model is too weak.`,
        `For neural networks, track weight decay separately from learning rate and optimizer state. AdamW exists because L2-style decay inside Adam's adaptive denominator behaves differently from direct weight decay. The regularization knob should mean what the team thinks it means.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Regularization fails when it is used to hide bad data. If labels are noisy, features leak the target, or train and test come from different distributions, a penalty may make the model smaller without making it true. Fix the measurement and data contract first.`,
        `It also fails when the penalty fights the task. A highly sparse L1 model can drop redundant but important signals. Heavy L2 can underfit small but real effects. Dropout can hurt architectures where co-adaptation is useful. Every regularizer encodes an assumption about what kind of simplicity should generalize.`,
      ],
    },
    {
      heading: `What to remember`,
      paragraphs: [
        `Regularization buys generalization by making fragile complexity expensive. L2 shrinks, L1 selects, dropout disrupts co-adaptation, early stopping limits training time, and augmentation widens the experience the model must survive.`,
        `For course design, teach this after bias-variance and before model selection. Students should learn that the right penalty is chosen by honest validation, not by aesthetics or a desire for small weights.`,
        `The central question is not "how do I make the model simpler?" It is "which complexity is likely to be spurious for the future data?" That question turns regularization from a formula into an engineering judgment.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Logistic Regression to see why separable data makes weights grow, Gradient Descent to understand the update rule, FTRL-Proximal Online CTR Case Study for L1 sparsity in an online system, LinUCB Personalized News Case Study for ridge state inside a contextual bandit, and Cross-Validation & Honest Evaluation to choose lambda without cheating. Then compare Dropout, Early Stopping & Patience, and Regularization: L1 & L2 as three different ways to spend a little bias to buy a lot less variance.`,
      ],
    },
  ],
};
