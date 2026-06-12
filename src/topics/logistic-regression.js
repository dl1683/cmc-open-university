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
        `Logistic regression is the simplest probabilistic classifier in machine learning: given a data point, compute a weighted sum, squeeze it through a sigmoid (an S-shaped curve), and out comes a probability. It answers the question every classifier must answer: how confident should I be that this email is spam? Unlike hard rules (block if five exclamation marks), logistic regression gives a nuanced answer—0.8 means "pretty sure," 0.5 means "toss a coin," 0.1 means "almost certainly ham." The entire model is just three numbers: two weights (how much does each feature matter?) and a bias (the baseline vote). It is the foundation of modern probabilistic thinking: every deep neural network is built from stacked versions of this same cell.`,
        `The visualization shows logistic regression learning in real time on ten emails: five spam (upper right), five ham (lower left), each described by two features—exclamation marks and ALL-CAPS words. Watch the decision boundary (the line where the model is 50/50 uncertain) rotate and settle as gradient descent drags it toward the true separating direction. The boundary is not arbitrary; it is exactly the set of points where the weighted sum equals zero, and the sigmoid is 0.5.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with three unknowns: weights w₁ and w₂ (how much each feature votes) and bias b (baseline). For any email, compute evidence score z = w₁·x + w₂·y + b. The sigmoid function σ(z) = 1/(1 + e^(−z)) squashes this into a probability between 0 and 1. At z=0, σ(z)=0.5 (uncertainty). Deep positive gives near 1 (spam), deep negative near 0 (ham). The sigmoid saturates—differences out in the tails are invisible, like "I was already sure." Training tunes weights using gradient descent, paired with cross-entropy loss: −log(p) punishes wrong predictions, especially confident ones. Being unsure costs 0.69; being confidently wrong costs 3.0. The gradient is simple: (p − truth)·feature. Mislabel far from boundary? Move hard. Barely wrong? Small nudge. The visualization shows the model starting at zeros (every email gets 0.5), then learning over 200 epochs: epoch 1 boundary appears pointing right; epoch 15 most points correct; epoch 60 all correct but weights grow (loss keeps punishing under-confidence); epoch 200 boundary settled with strong probabilities. The learning process is convex—one global valley, no local traps. Sigmoid + cross-entropy = gradient becomes (p−y)·x, and the loss surface is a bowl. This is why logistic regression is the universal baseline.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training: O(N × epochs) where N is data points. On ten emails and 200 epochs, that is 2000 forward passes—instant. Storage: three floats (w₁, w₂, b). Testing: O(1) per prediction, microseconds, no matrix multiplications, deterministic. Compare: deep networks need massive memory, GPUs, and minutes to train. Logistic regression runs on a sheet of paper.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Spam filters, fraud detection (every credit-card learns this boundary), medical diagnosis (patient labs → disease risk), ad prediction, loan approval. The killer strength: every weight is readable. w₁=0.5 for exclamation marks means "one exclamation raises spam odds by 0.5 bits"—explainable to regulators and customers. A 10-million-weight network tells you nothing. Logistic regression tells the story. Still the baseline at every major tech desk.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest trap: assuming a straight line separates your data. If classes scatter randomly, logistic regression gives 0.5 everywhere—maximum confusion. Plot first; if classes don't separate, engineer better features or reach for a nonlinear model. Confusion two: probability ≠ confidence. A 0.8 prediction means "calibrated 80 percent," not "I'm 80 percent sure"—verify with Calibration & Reliability Diagrams. Overfitting is near-impossible (only three parameters), but weights can grow chasing noisy features—regularization keeps them reasonable. Finally, on tiny data (10 samples), a 0.99 probability is fantasy. Do not trust high confidence from low data.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Logistic regression sits on Gradient Descent—study that to see how the algorithm converges. The sigmoid is a single-neuron activation; scale it to many layers with Neural Network Forward Pass. To verify your probability predictions are honest, study ROC Curves & AUC and Calibration & Reliability Diagrams. For multi-class problems (not just spam/ham), explore Softmax & Temperature. For the information theory behind cross-entropy, read Entropy & Information—the −log(p) penalty is the surprise measure from physics and coding theory.`,
      ],
    },
  ],
};

