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
      heading: `What it is`,
      paragraphs: [
        `Logistic Regression is a linear classifier that returns a score you can interpret as a probability once it has been checked. The model takes a weighted sum, z = w1*x1 + w2*x2 + b, and passes it through the sigmoid curve so negative evidence moves toward 0, positive evidence moves toward 1, and z = 0 means 0.5. The visualization uses ten emails with two features: exclamation marks and ALL-CAPS words. Spam points cluster toward the upper right, ham toward the lower left, and the learned line is the p = 0.5 boundary.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The model starts with all weights at zero, so every email receives p(spam) = 0.5. Gradient Descent then updates the three parameters using cross-entropy loss. With sigmoid plus cross-entropy, the gradient simplifies to (p - truth) times the feature, so a badly wrong confident prediction pushes hard and a nearly right one nudges. In the demo, epoch 1 creates a rough boundary, epoch 15 has most points on the correct side, epoch 60 classifies all ten emails correctly, and epoch 200 mostly sharpens confidence. The boundary itself is exactly the line where w*x + b = 0.`,
        `The close-up view shows why the sigmoid matters. Near z = 0 it is steep, so small evidence changes can flip an uncertain decision. In the tails it saturates: z = 6 and z = 60 both mean almost certain. Entropy & Information explains the -log(p) penalty behind cross-entropy, and Softmax & Temperature extends the same idea to many classes. Neural Network Forward Pass is built from this weighted-sum-then-nonlinearity pattern, stacked many times.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For N examples, d features, and E epochs, batch training costs O(E * N * d). This demo has d = 2 and N = 10, so even 200 epochs are tiny. Storage is d weights plus one bias, and prediction costs O(d): multiply, add, apply sigmoid. The simplicity is why Logistic Regression remains a baseline in fraud, ads, medicine, and search. FTRL-Proximal Online CTR Case Study shows the massive sparse version: hashed ad features, online updates, and per-coordinate optimizer state. It is also easy to inspect: each coefficient changes log-odds, not vague feature importance. That makes failure analysis concrete: if all-caps gets a large positive weight, you can see exactly which cue moved the boundary.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Teams use it anywhere a transparent probability score is valuable: credit risk, churn, spam, medical triage, and ad click prediction. ROC Curves & AUC compares how well those scores rank positives above negatives. Precision, Recall & the Confusion Matrix turns the scores into concrete errors after a threshold is chosen. Calibration & Reliability Diagrams checks whether a displayed 80% behaves like 80% in reality.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The line is both the strength and the limit. If the classes need a curve, interactions, or a tree-shaped rule, this model underfits unless you add better features. Perfectly separable data also creates a subtle failure: without Regularization: L1 & L2, cross-entropy keeps rewarding bigger weights forever because 0.999 is still better than 0.99. High probabilities on tiny data can be fantasy, and correlated features can make individual weights look unstable even when predictions are good. Cross-Validation & Honest Evaluation is how you test the model without grading its homework.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Gradient Descent for the optimizer moving the line, Regularization: L1 & L2 for the leash that stops runaway weights, FTRL-Proximal Online CTR Case Study for sparse online logistic learning, and Calibration & Reliability Diagrams before treating sigmoid outputs as trustworthy probabilities. Then use ROC Curves & AUC and Precision, Recall & the Confusion Matrix to evaluate the score and choose an operating threshold.`,
      ],
    },
  ],
};
