// Logistic regression: the straight line that learned to gamble. A weighted
// sum scores the evidence, a sigmoid turns the score into a probability,
// and gradient descent drags the decision boundary into place — for real,
// in this file, no faked numbers.

import { plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'logistic-regression',
  title: 'Logistic Regression',
  category: 'AI & ML',
  summary: 'A weighted sum, a sigmoid squash, and a boundary that gradient descent drags into place before your eyes.',
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['the boundary learn', 'the sigmoid up close'], defaultValue: 'the boundary learn' },
  ],
  run,
};

// Emails as 2 features: [exclamation marks, ALL-CAPS words, label] (1 = spam).
const DATA = [
  [4, 3, 1], [5, 1, 1], [3, 4, 1], [5, 4, 1], [2, 3, 1],
  [0, 1, 0], [1, 0, 0], [2, 1, 0], [1, 2, 0], [3, 1, 0],
];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

const dataMarkers = (model) =>
  DATA.map(([x, y, t], i) => {
    const id = t ? `s${i}` : `h${i}`;
    const first = t ? i === 0 : i === 5;
    const label = model ? sigmoid(model.w1 * x + model.w2 * y + model.b).toFixed(2) : first ? (t ? 'spam' : 'ham') : '';
    return { id, x, y, label };
  });

const boundarySeries = ({ w1, w2, b }) => ({
  id: 'boundary',
  label: 'p = 0.5',
  points: [0, 6].map((x) => ({ x, y: -(w1 * x + b) / w2 })),
});

const AXES = { x: { label: 'exclamation marks', min: 0, max: 6 }, y: { label: 'ALL-CAPS words', min: -1, max: 6 } };

function* boundaryLearns() {
  yield {
    state: plotState({ axes: AXES, markers: dataMarkers(null) }),
    highlight: { active: ['s0'], compare: ['h5'] },
    explanation: 'Where do classifier scores — the ones ROC Curves & AUC swept and Calibration audited — actually COME FROM? Here is the simplest factory. Ten emails, two features each: how many exclamation marks, how many ALL-CAPS words. Spam crowds the upper right, ham the lower left. The model we want is a probability: p(spam) for any point on this plane. Logistic regression makes the boldest simplification possible — assume one STRAIGHT LINE can separate the classes, and confidence should grow with distance from it.',
  };

  const model = { w1: 0, w2: 0, b: 0 };
  const lr = 0.5;
  const stats = () => {
    let loss = 0;
    let errors = 0;
    for (const [x, y, t] of DATA) {
      const p = sigmoid(model.w1 * x + model.w2 * y + model.b);
      loss += -(t * Math.log(p) + (1 - t) * Math.log(1 - p));
      if ((p >= 0.5 ? 1 : 0) !== t) errors += 1;
    }
    return { loss: loss / DATA.length, errors };
  };
  const epochStep = () => {
    let g1 = 0;
    let g2 = 0;
    let gb = 0;
    for (const [x, y, t] of DATA) {
      const p = sigmoid(model.w1 * x + model.w2 * y + model.b);
      g1 += (p - t) * x;
      g2 += (p - t) * y;
      gb += p - t;
    }
    model.w1 -= (lr * g1) / DATA.length;
    model.w2 -= (lr * g2) / DATA.length;
    model.b -= (lr * gb) / DATA.length;
  };

  const checkpoints = [
    { epoch: 1, note: 'The model starts ignorant — all weights zero, every email scored exactly 50%. One gradient step later, a boundary exists: each point pushes the line with force (p − truth) — the formula Backpropagation derives. Mislabeled-by-a-lot pushes hard; barely-wrong nudges. The line is still terrible. That is fine. It knows which way to move.' },
    { epoch: 15, note: 'Epoch 15: the line has rotated to face the real separating direction — most points are on their correct side now. Watch the per-point labels: they show p(spam), the SIGMOID of the weighted sum. Points far from the line are approaching 0 or 1; the stragglers near it still hover around 0.5, and they are exactly the ones still steering the gradient.' },
    { epoch: 60, note: 'Epoch 60: every point classified correctly — but gradient descent does not stop. Look at the loss: cross-entropy keeps paying for UNDER-CONFIDENCE, so the weights keep growing, sharpening the probability ramp around the boundary. (On perfectly separable data they would grow forever — the door regularization walks in through.)' },
    { epoch: 200, note: 'Epoch 200: the boundary has settled and the probabilities are committed — near-0.99 deep in spam territory, near-0.01 deep in ham. This is the entire model: three numbers (w₁, w₂, b). It cannot draw a curve, which is its weakness and its superpower — nothing to overfit with, instantly trainable, and every weight is readable: w₁ tells you exactly how much one exclamation mark raises the spam evidence.' },
  ];
  let epoch = 0;
  for (const { epoch: target, note } of checkpoints) {
    while (epoch < target) {
      epochStep();
      epoch += 1;
    }
    const { loss, errors } = stats();
    yield {
      state: plotState({ axes: AXES, series: [boundarySeries(model)], markers: dataMarkers(model) }),
      highlight: {
        active: ['boundary'],
        compare: DATA.flatMap(([x, y, t], i) => {
          const p = sigmoid(model.w1 * x + model.w2 * y + model.b);
          return (p >= 0.5 ? 1 : 0) !== t ? [t ? `s${i}` : `h${i}`] : [];
        }),
      },
      explanation: `Epoch ${epoch} — average loss ${loss.toFixed(3)}, misclassified ${errors}/10. ${note}`,
      invariant: 'The boundary is the set of points where w·x + b = 0 — exactly where the sigmoid outputs 0.5.',
    };
  }
}

function* sigmoidCloseUp() {
  const zs = Array.from({ length: 49 }, (_, i) => -6 + i * 0.25);
  yield {
    state: plotState({
      axes: { x: { label: 'z = w·x + b (the evidence score)' }, y: { label: 'p(spam)' } },
      series: [{ id: 'sigmoid', label: 'σ(z)', points: zs.map((z) => ({ x: z, y: sigmoid(z) })) }],
      markers: [
        { id: 'mNeg', x: -4, y: sigmoid(-4), label: '0.02' },
        { id: 'mZero', x: 0, y: 0.5, label: '0.50' },
        { id: 'mPos', x: 2, y: sigmoid(2), label: '0.88' },
      ],
    }),
    highlight: { active: ['mZero'], found: ['sigmoid'] },
    explanation: 'The squashing function itself: σ(z) = 1/(1 + e⁻ᶻ) takes the raw evidence score — any number from −∞ to +∞ — and bends it into a probability. Zero evidence lands exactly on 0.50; the curve is steepest there, so near the boundary a little evidence moves the verdict a lot. Out in the tails it SATURATES: the difference between z = 6 and z = 60 is invisible, which is the mathematical way of saying "I was already sure." This same S-curve is the neuron activation in Neural Network Forward Pass, and softmax (see Softmax & Temperature) is its many-class generalization.',
  };

  const ps = Array.from({ length: 39 }, (_, i) => 0.025 + i * 0.025);
  yield {
    state: plotState({
      axes: { x: { label: 'p assigned to the TRUE class' }, y: { label: 'penalty −log(p)' } },
      series: [{ id: 'logloss', label: '−log p', points: ps.map((p) => ({ x: p, y: -Math.log(p) })) }],
      markers: [
        { id: 'confident', x: 0.95, y: -Math.log(0.95), label: '0.05' },
        { id: 'unsure', x: 0.5, y: -Math.log(0.5), label: '0.69' },
        { id: 'wrong', x: 0.05, y: -Math.log(0.05), label: '3.00' },
      ],
    }),
    highlight: { active: ['wrong'], compare: ['unsure'] },
    explanation: 'What the model is punished with: CROSS-ENTROPY loss, −log of the probability it gave the true class — the same −log surprise from Entropy & Information. Being right and confident costs ~0.05. Being unsure costs 0.69 (that is log 2 — one bit of surprise). But confidently WRONG costs 3.0 and climbs toward infinity: the loss is built to make overconfident mistakes the cardinal sin. Squared error would shrug at the same mistake; this curve screams at it.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'z = w·x + b (the evidence score)' }, y: { label: 'p(spam)' } },
      series: [{ id: 'sigmoid', label: 'σ(z)', points: zs.map((z) => ({ x: z, y: sigmoid(z) })) }],
      markers: [{ id: 'mZero', x: 0, y: 0.5, label: 'gradient = (p − y)·x' }],
    }),
    highlight: { found: ['mZero'] },
    explanation: 'The miracle that makes training trivial: pair the sigmoid with cross-entropy and the calculus collapses — the gradient for each weight is just (p − y)·x, prediction error times input. No second-guessing, no vanishing chain of derivatives, and the loss surface is CONVEX: one global valley, so Gradient Descent cannot get trapped. This is why logistic regression is the first model reached for at every fraud desk and ad platform, the baseline every neural network must beat, and — with one feature renamed "neuron" — the cell deep learning is built from.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the boundary learn') yield* boundaryLearns();
  else if (view === 'the sigmoid up close') yield* sigmoidCloseUp();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Logistic regression exists because many decisions need a probability score, not just a label. A fraud system, ad click model, spam filter, medical triage tool, or churn model needs to rank cases by risk, choose thresholds, explain feature effects, and calibrate confidence. A hard yes/no rule is usually too crude.',
        'The model is intentionally simple. It computes a weighted sum of features, turns that evidence score into a probability with the sigmoid curve, and learns the weights from labeled examples. The result is a linear decision boundary with a probabilistic interpretation.',
        'That simplicity is the point. Logistic regression is often the baseline a more complex model must beat. It trains quickly, predicts cheaply, handles sparse features well, and gives coefficients that can be inspected as changes in log-odds. When it fails, the failure is usually informative.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a hand-written threshold: if an email has more than three exclamation marks, call it spam. That kind of rule is brittle. It ignores combinations of evidence, cannot learn relative feature strength from data, and produces no honest probability for downstream tradeoffs.',
        'Another obvious approach is ordinary linear regression on labels 0 and 1. That gives scores, but it can predict values below 0 or above 1, and squared error is poorly matched to classification confidence. A probability model needs outputs in the interval from 0 to 1 and a loss that punishes confident wrong answers strongly.',
        'Logistic regression keeps the linear evidence score but changes the output and loss. The sigmoid maps any real number to a probability. Cross-entropy measures how surprised the model should be by the true label. The pair gives clean gradients and a convex training problem for the basic model.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is log-odds. Logistic regression assumes the log-odds of the positive class are a linear function of the features. If z = w * x + b, then sigmoid(z) is the probability. A one-unit feature increase changes the log-odds by that feature weight, holding other features fixed.',
        'The p = 0.5 boundary is where z = 0. On one side, the weighted evidence favors the positive class. On the other side, it favors the negative class. Distance from the boundary becomes confidence because the sigmoid moves probabilities toward 0 or 1 as z becomes more negative or positive.',
        'This is why the model is interpretable but limited. It can say how each feature shifts linear evidence. It cannot discover a curved boundary unless you provide transformed features, interaction terms, splines, buckets, or other representation work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The model starts with weights and a bias. For an example x, it computes z = w1*x1 + w2*x2 + ... + b. The sigmoid function 1 / (1 + exp(-z)) turns z into p, the predicted probability of the positive class. The prediction rule can be p >= 0.5, but production systems usually choose thresholds based on cost, recall, precision, or capacity.',
        'Training minimizes cross-entropy. For a positive example, the loss is -log(p). For a negative example, the loss is -log(1 - p). This loss barely penalizes confident correct predictions, penalizes uncertainty moderately, and punishes confident wrong predictions heavily.',
        'With sigmoid plus cross-entropy, the gradient has a simple form: prediction error times feature value. If p is too high for a negative example, the model pushes weights downward in proportion to that example’s features. If p is too low for a positive example, it pushes upward. Gradient descent repeats this until the boundary and probabilities fit the training data.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The boundary-learning view proves that a linear probability model can be trained by error-driven movement of a line. At the start, every point receives 0.5. As training proceeds, wrongly placed or uncertain points steer the weights. The boundary rotates and shifts until spam-like examples sit on the high-probability side and ham-like examples sit on the low-probability side.',
        'The late epochs prove an important subtlety. Once every toy point is classified correctly, cross-entropy still rewards sharper confidence. On perfectly separable data, weights can keep growing without regularization because 0.999 is still better than 0.99 for the correct class. Correct labels do not automatically mean well-behaved probabilities.',
        'The sigmoid close-up proves how scores become probabilities. Around z = 0, the curve is steep and small evidence changes matter. In the tails, the curve saturates. The log-loss view then proves why overconfident mistakes are dangerous: assigning 0.05 probability to the true class costs far more than being unsure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because many risk signals combine roughly additively on the log-odds scale. In spam detection, each exclamation mark, all-caps word, suspicious domain, or phrase can shift evidence toward spam. In credit risk or churn, each feature can shift evidence toward the event. The model is simple, but the feature set can be rich.',
        'It also works because the training objective is convex for the basic model. There is one global basin rather than a maze of local minima. That makes optimization reliable and diagnostics clearer. If the model performs poorly, the problem is usually representation, data quality, leakage, class imbalance, or the linear assumption, not a mysterious optimization failure.',
        'Finally, it works well with sparse high-dimensional data. Text, ads, user IDs, query terms, and categorical features can produce millions of mostly zero features. Logistic regression with regularization or online optimizers can handle that scale efficiently.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'For N examples, d features, and E epochs, batch training costs O(E * N * d). Prediction costs O(d) for dense features or O(number of nonzero features) for sparse inputs. Storage is one weight per feature plus a bias. That makes the model cheap enough for real-time scoring and large sparse systems.',
        'The tradeoff is bias. A linear boundary is stable and readable, but it cannot represent feature interactions unless you create them. If exclamation marks matter only when combined with a suspicious sender, the basic model will miss that interaction unless a feature encodes it. Tree models and neural networks can learn richer interactions automatically, but they cost more and are harder to inspect.',
        'Regularization is usually necessary. L2 keeps weights small and stable. L1 can drive weak features to zero. Without regularization, separable data can push weights toward infinity and correlated features can make coefficients unstable. Regularization is not just overfitting prevention; it is part of making the probability model usable.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Teams use logistic regression anywhere a transparent probability score is valuable: credit risk, churn, spam, fraud, medical triage, moderation queues, ad click prediction, search ranking features, and operational alert scoring. It is especially strong when the data is sparse, the baseline must be reliable, and the organization needs to explain why a score moved.',
        'It is also useful as a calibration and evaluation anchor. ROC Curves & AUC compares how well the scores rank positives above negatives. Precision, Recall & the Confusion Matrix turns the scores into concrete errors after a threshold is chosen. Calibration & Reliability Diagrams checks whether a displayed 80% behaves like 80% in reality.',
        'In production systems, logistic regression often sits inside larger stacks. It may score candidates before a neural reranker, provide a simple fallback, or serve as an interpretable benchmark. A complex model that cannot beat a well-regularized logistic baseline probably has a data or evaluation problem.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The line is both the strength and the limit. If the classes need a curve, interactions, or a tree-shaped rule, the model underfits unless you add better features. Nonlinear feature engineering can help, but at some point another model class may be the honest answer.',
        'Probability output is not automatically calibrated. Small datasets, class imbalance, label noise, leakage, distribution shift, and over-regularization can all produce probabilities that look precise but are wrong. Treat sigmoid output as a model score until calibration has been checked on held-out data.',
        'Interpretability can also be overstated. A coefficient is readable when features are stable, independent enough, and measured consistently. With correlated features, missingness artifacts, or leakage, a coefficient may explain the training data without explaining the world. Cross-validation, ablations, and feature audits are still required.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Gradient Descent for the optimizer moving the line, Cross-Entropy and Entropy for the loss, Regularization: L1 & L2 for controlling weights, FTRL-Proximal Online CTR Case Study for sparse online logistic learning, and Calibration & Reliability Diagrams before treating sigmoid outputs as trustworthy probabilities.',
        'Then use ROC Curves & AUC to evaluate ranking, Precision and Recall to choose thresholds, Feature Hashing for sparse categorical inputs, Naive Bayes for another simple probabilistic baseline, and Neural Network Forward Pass to see how logistic regression becomes one layer inside deeper models.',
      ],
    },
  ],
};
