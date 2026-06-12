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
        `Regularization is the leash on your model's weights. When you train a classifier on perfectly separable data — emails that are obviously spam and obviously not spam — the weights grow larger and larger, making the model more and more confident, until it claims 99.999% certainty. This is not wisdom; it is overfitting disguised as confidence. Regularization adds a penalty to the loss function, a rent charged on every unit of weight, to keep the model humble and force it to be honest about uncertainty. Without it, the boundary learns to contort around noise and outliers (because it can afford the contortion). With it, contortion becomes expensive, and the model stays smooth and generalizable.`,
        `There are many flavors of regularization. L2 (ridge regression) adds λ·‖w‖² to the loss, shrinking all weights smoothly and proportionally, never quite zeroing any of them. L1 (lasso) adds λ·‖w‖, which applies a constant pull toward zero, allowing weights to be deleted outright — not merely small, but exactly zero. Elastic net mixes both. Dropout randomly silences neurons. Early stopping cuts training short. Data augmentation multiplies the number of examples the model sees. All of these are the same bet: prevent the model from being too sure, too sharp, or too dependent on any single signal, and it will tell the truth on data it has never seen.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with the gradient descent update rule without regularization: w ← w − lr·∇loss. Now insert the penalty: w ← w − lr·(∇loss + λ·w). That extra term λ·w is weight decay. Every step, the weights shrink before the gradient pushes them back up. Two forces balance: the data pushes the weights up (trying to explain the examples), and the penalty pulls them down (taxing the size of the weights themselves). When the data push equals the penalty pull, the weights stop growing — they reach an equilibrium, a plateau where the marginal benefit of a bigger weight no longer exceeds its rent.`,
        `For L1 regularization, the update is slightly different. Instead of a smooth shrink proportional to w, L1 applies a soft threshold: each weight slides toward zero by a constant amount λ/2 and stops there. Mathematically, the weight becomes max(0, |w| − λ/2), sign-preserving. This constant pull is the key insight: near zero, where L2's pull (gradient λ·w) fades to almost nothing, L1's pull is still λ/2 — large and relentless. So L1 can push a weight all the way to exactly zero and keep it there. L2 can only make it very small. The result: L1 performs feature selection by calculus. At λ = 0.3, a barely-useful feature might die outright; at λ = 0.8, another one vanishes. L2 instead shrinks all features proportionally, keeping all of them alive and correlated.`,
        `Elastic net, the hybrid, mixes both penalties: w ← w − lr·(∇loss + λ₁·w + λ₂·|sign(w)|). You get the sparsity (feature deletion) of L1 and the correlated-feature balance of L2, without L1's arbitrariness of keeping one feature from each correlated cluster. The demo shows both paths live: watch L2 shrink "send hour" from 0.15 all the way down to 0.03, never touching zero; watch L1 delete "send hour" at λ = 0.3 and "word length" at λ = 0.8, exactly zero.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Regularization adds almost no computational cost. The weight decay term λ·w is a single multiplication per weight, O(1) per gradient step. For L1, the soft threshold max(0, |w| − λ/2) is also O(1). Storage is unchanged; you just carry one more hyperparameter: λ, the penalty strength. Tuning λ is the real expense: you train multiple models with different λ values (a grid search or Bayesian optimization) and measure accuracy on a validation set, then pick the λ that minimizes validation error. This train-tune-validate loop happens at the design stage, not in production; the inference cost is zero.`,
        `Memory impact is nil. Time impact at training is negligible — a few percent slowdown from the extra arithmetic. The practical cost is in human time: picking the right λ requires experimentation and domain knowledge. A medical system and a fraud detector need different regularization (the former cannot tolerate false negatives; the latter has a higher tolerance). The beauty of regularization is that it is one knob you can tune to trade off training accuracy for validation accuracy — it is the algorithm's answer to the bias-variance tradeoff.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Ridge regression (L2) is the default in almost every production system. Linear models, logistic regression, neural networks — add weight decay (the neural-network version of L2) to nearly any optimizer and you immediately improve generalization. The reason: weight decay is extremely robust. It works whether your features are correlated or independent, whether your problem is classification or regression, whether you have noise or not. It is the "try this first" of regularization and is built into AdamW (Adam With Decoupled Weight Decay), the dominant neural-network optimizer.`,
        `Lasso (L1) is the choice when you need interpretability and feature selection. In medicine, when a doctor must understand why the model said "pneumonia," keeping the ten most important symptoms and deleting the rest is far more defensible than keeping all five thousand features at tiny shrunk weights. In fraud detection, regulators often demand a white-box explanation: "this transaction was flagged because of these three features." L1 delivers that. Elastic net splits the difference in production systems where you have some correlated features (common in real data) and want both the robustness of L2 and the interpretability of L1.`,
        `The deeper generalization: any mechanism that prevents the model from being too confident, too sharp, or too dependent on any single training example improves generalization. Early stopping (training for fewer epochs) achieves this by halting before overfitting. Dropout achieves it by randomly silencing neurons — the model must solve the problem with incomplete information. Data augmentation achieves it by multiplying examples, so the model never quite memorizes any individual one. Regularization is the direct penalty approach, and it is the most analyzable.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest trap: mistaking regularization magnitude for model quality. A model with λ = 10 (heavy regularization) will have smaller weights and lower training accuracy, but it may have better validation accuracy than λ = 0.001 (light regularization). Training accuracy going down is not a failure — it is the point. The correct metric is validation accuracy: accuracy on data the model has never seen. Never regularize based on training performance.`,
        `Another common error: conflating weight size with model complexity. A model with weight norm 0.5 is not automatically simpler or better than one with norm 3.5. What matters is whether the weights generalize — whether the model's decisions make sense on new data. Regularization is a tool to improve generalization; it is not a measure of generalization itself. Also, do not assume that zeroing a feature (in L1) means the feature was useless. It might be useful but correlated with another feature; L1 arbitrarily killed it to save regularization budget.`,
        `Finally, avoid tuning λ on the training set. If you pick λ by trying many values and choosing the one with the lowest training loss, you have just tuned the regularization strength to overfit. Always pick λ on a held-out validation set, never on training data. This is why machine learning practitioners split their data into train, validation, and test: train to fit, validate to tune, test to measure.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Regularization lives inside Logistic Regression — review how the weights' growth pattern changed when you added λ back there. Gradient Descent is the engine that applies the weight decay term; understand how weight decay emerges from the math. Dropout and Calibration & Reliability Diagrams are closely related: both tackle overconfidence, one by regularizing during training, the other by correcting the model's posterior probabilities after training. LoRA Fine-tuning uses a regularization-like constraint (low-rank updates) to prevent catastrophic forgetting when you adapt a large pretrained model to a new task. Random Forest and ensemble methods attack the same problem (overfitting) from a different angle: many weak learners, each regularized or randomized differently, vote to smooth out the noise any single learner would memorize.`,
      ],
    },
  ],
};

