// Adversarial examples: the gradient that trains a model can be pointed
// back at its input. One small, deliberate nudge and 97% "spam" becomes
// 14% — same scam, two fewer exclamation marks. Confidence ≠ robustness.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'adversarial-examples',
  title: 'Adversarial Examples & FGSM',
  category: 'AI & ML',
  summary: 'Point the gradient at the input instead of the weights: one deliberate nudge turns 97% spam into 14%.',
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['fooling the spam filter', 'why tiny steps fool big models'], defaultValue: 'fooling the spam filter' },
  ],
  run,
};

// The trained spam model from Logistic Regression (epoch 200, rounded).
const W = { w1: 1.1, w2: 1.6, b: -5.6 };
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const p = (x, y) => sigmoid(W.w1 * x + W.w2 * y + W.b);
const AXES = { x: { label: 'exclamation marks', min: 0, max: 6 }, y: { label: 'ALL-CAPS words', min: -1, max: 6 } };
const boundary = { id: 'boundary', label: 'p = 0.5', points: [0, 6].map((x) => ({ x, y: (5.6 - W.w1 * x) / W.w2 })) };

function* foolTheFilter() {
  yield {
    state: plotState({
      axes: AXES,
      series: [boundary],
      markers: [{ id: 'scam', x: 4, y: 3, label: `p(spam) = ${p(4, 3).toFixed(2)}` }],
    }),
    highlight: { active: ['scam'], visited: ['boundary'] },
    explanation: 'The spam filter Logistic Regression trained, deployed and confident: a scam email with 4 exclamation marks and 3 ALL-CAPS words scores 97% spam — flagged, junked, done. Now switch sides: you are the SPAMMER, and you can read (or probe) the model. You want this exact scam delivered. Question: what is the SMALLEST edit to the email that flips the verdict? You do not need to guess — the model itself will tell you.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [boundary],
      markers: [{ id: 'scam', x: 4, y: 3, label: '0.97' }],
      vectors: [{ id: 'grad', label: '−∇ (the escape route)', from: { x: 4, y: 3 }, to: { x: 2.9, y: 1.9 } }],
    }),
    highlight: { active: ['grad'] },
    explanation: 'The trick that makes this a one-liner: GRADIENTS WORK ON INPUTS TOO. Training asked "how should the WEIGHTS change to reduce the loss?" — backpropagation\'s question. The attacker asks "how should the INPUT change to increase it?" — same calculus, different variable. For this model the input-gradient is just the weight vector (1.1, 1.6): exclamation marks and caps push spam-ward, so their negatives are the escape route. FGSM — the Fast Gradient Sign Method — takes the sign of each gradient component and steps every feature one ε in its most damaging direction: x′ = x − ε·sign(∇ₓ). The arrow IS the model\'s own knowledge, weaponized.',
    invariant: 'The attack direction is read directly off the model: no search, one gradient evaluation.',
  };

  const path = [[4, 3], [3, 2], [2, 1]];
  yield {
    state: plotState({
      axes: AXES,
      series: [boundary],
      markers: path.map(([x, y], i) => ({ id: `step${i}`, x, y, label: p(x, y).toFixed(2) })),
      vectors: [
        { id: 'v1', label: 'ε = 1', from: { x: 4, y: 3 }, to: { x: 3.05, y: 2.05 } },
        { id: 'v2', label: 'ε = 2', from: { x: 3, y: 2 }, to: { x: 2.05, y: 1.05 } },
      ],
    }),
    highlight: { active: ['step2'], compare: ['step1'], visited: ['step0'] },
    explanation: `Walk the escape route. One step (ε = 1): drop one exclamation mark, one caps word → p falls from 0.97 to ${p(3, 2).toFixed(2)} — still flagged, barely. Second step → (2, 1): p = ${p(2, 1).toFixed(2)}, comfortably under the threshold. The email sails into the inbox. Read the labels again: the TEXT of the scam never changed — same link, same lie — only two surface features moved. Real spammers discovered this before the term existed: "FR-EE", "C1ALIS", spelling tricks that subtract trigger features while preserving the payload. Every evasion is a walk down the model's gradient.`,
  };

  yield {
    state: matrixState({
      title: 'The attack, summarized',
      rows: [{ id: 'orig', label: 'original scam' }, { id: 'adv', label: 'adversarial scam' }],
      columns: [{ id: 'excl', label: 'excl. marks' }, { id: 'caps', label: 'CAPS words' }, { id: 'p', label: 'p(spam)' }, { id: 'verdict', label: 'verdict' }],
      values: [[4, 3, p(4, 3), 1], [2, 1, p(2, 1), 2]],
      format: (v) => (v === 1 ? 'JUNKED' : v === 2 ? 'inbox ✗' : v < 1 ? `${(v * 100).toFixed(0)}%` : String(v)),
    }),
    highlight: { removed: ['adv:verdict'], compare: ['orig:p', 'adv:p'] },
    explanation: 'The before/after ledger. Notice what the 97% confidence was actually worth: the scam sat two small steps from acquittal the whole time. High confidence describes distance from the boundary ALONG THE DATA the model has seen — it says nothing about how close the boundary is in the direction an adversary gets to choose. Calibration & Reliability Diagrams audits whether 97% means 97% on honest inputs; this page shows the number can be simultaneously calibrated and trivially evadable. Different failure, different defense.',
  };
}

function* whyTiny() {
  const dims = [
    { id: 'toy', label: 'spam toy (2 features)', d: 2 },
    { id: 'cifar', label: 'CIFAR image (3,072 pixels)', d: 3072 },
    { id: 'imagenet', label: 'ImageNet (150,528 pixels)', d: 150528 },
  ];
  const eps = 0.01;
  const avgW = 0.1;
  yield {
    state: matrixState({
      title: 'The same ε = 0.01 nudge, applied to EVERY input dimension',
      rows: dims.map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'per', label: 'per-feature change' }, { id: 'shift', label: 'total logit shift ≈ ε·Σ|wᵢ|' }],
      values: dims.map(({ d }) => [eps, eps * avgW * d]),
      format: (v) => (v === eps ? '0.01 (invisible)' : v.toFixed(v < 1 ? 3 : 1)),
    }),
    highlight: { compare: ['toy:shift'], removed: ['imagenet:shift'] },
    explanation: 'In our 2-feature toy the attack needed VISIBLE edits — whole exclamation marks. So why are image attacks invisible? Dimensionality. FGSM nudges EVERY dimension by a tiny ε simultaneously, and each nudge ε·sign(wᵢ) adds |wᵢ|·ε to the logit — the damage SUMS across dimensions: ε·Σ|wᵢ| ≈ ε·d·avg|w|. Two features: shift 0.002, nothing. An ImageNet image (150,528 values, each moved by 1/255th — below what a monitor can show): shift ≈ 150. The boundary is not crossed by one big step in one direction, but by 150,528 imperceptible steps in ALL directions at once. High dimension is the attacker\'s lever.',
    invariant: 'Per-dimension damage stays ε·|wᵢ|; total damage grows linearly with dimension count.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'input dimensions (thousands)' }, y: { label: 'logit shift from invisible ε' } },
      series: [{
        id: 'shift',
        label: 'ε·d·avg|w|',
        points: [0.002, 1, 5, 20, 50, 100, 150.5].map((d) => ({ x: d, y: d * 1000 * eps * avgW })),
      }],
      markers: [
        { id: 'mToy', x: 0.002, y: 0.002, label: 'toy: safe-ish' },
        { id: 'mImg', x: 150.5, y: 150.5, label: 'ImageNet: defenseless' },
      ],
    }),
    highlight: { active: ['shift'], removed: ['mImg'] },
    explanation: 'The line every vision model lives on. This is the 2014 Goodfellow result that named FGSM: a panda, plus noise no human can see, becomes "gibbon, 99.3% confidence." The model was not broken or badly trained — linear-ish functions in high dimension are INHERENTLY this sensitive, and neural networks are locally linear almost everywhere (the same property that makes them trainable by Gradient Descent!). Trainability and attackability are two faces of one coin: smooth gradients help the optimizer find the weights and help the adversary find the exploit.',
  };

  yield {
    state: matrixState({
      title: 'The defense menu, honestly',
      rows: [
        { id: 'advtrain', label: 'adversarial training' },
        { id: 'mask', label: 'gradient masking' },
        { id: 'smooth', label: 'randomized smoothing' },
        { id: 'detect', label: 'uncertainty detection' },
      ],
      columns: [{ id: 'how', label: 'idea' }, { id: 'verdict', label: 'verdict' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'train on attacked copies', 'works; costs accuracy + compute', 'hide the gradient', 'FALSE security — bypassed', 'vote over noisy copies', 'certified, small radius only', 'flag weird inputs (MC dropout)', 'helps; strong attacks fool it too'][v],
    }),
    highlight: { found: ['advtrain:verdict'], removed: ['mask:verdict'] },
    explanation: 'A decade of defenses, scored. ADVERSARIAL TRAINING — generate attacks during training and train on them — remains the only thing that reliably works, and it costs: more compute, and a few points of clean accuracy traded for robustness. GRADIENT MASKING (make gradients useless) collapsed famously — attackers route around it with transfer attacks crafted on substitute models. RANDOMIZED SMOOTHING gives mathematical certificates, but only within small perturbation radii. Uncertainty methods (the MC dropout committee) catch lazy attacks and miss adaptive ones. The honest summary for practice: assume any gradient-trained model is evadable, price that into the system — rate limits, ensembles, human review on high-stakes flips — and never let a confidence score stand in for security.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fooling the spam filter') yield* foolTheFilter();
  else if (view === 'why tiny steps fool big models') yield* whyTiny();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `An adversarial example is an input deliberately changed to fool a model while preserving the thing a human cares about. The demo uses a Logistic Regression spam filter with two features. The original scam has four exclamation marks, three ALL-CAPS words, and p(spam) = 97%. After two small feature edits, it becomes two exclamation marks and one caps word, and p(spam) drops to 14%. The scam did not become safe; it moved across the model boundary. The gap between meaning and model features is the vulnerability.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `FGSM uses the fact that gradients work on inputs, not just weights. Gradient Descent asks how weights should move to reduce loss. An attacker asks how the input should move to increase or reduce a target score. For this linear spam model, the input gradient points along weights (1.1, 1.6), so moving negative on both features is the escape route. One epsilon step drops the score to 71%; two steps cross the 0.5 boundary.`,
        `The high-dimensional view explains why image perturbations can be invisible. A tiny epsilon applied to every pixel adds epsilon times the sum of many small sensitivities. The demo is linear in dimension count, not exponential: two features barely move the logit, while 150,528 ImageNet inputs can accumulate a huge shift from changes too small to notice individually. Backpropagation makes the direction cheap to compute, which is why the simplest attack is also fast.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `FGSM costs one forward pass, one backward pass, then a sign step, so it is almost as cheap as ordinary training machinery. Defenses cost more. Adversarial training generates attacked copies during training, often multiplying compute and trading away clean accuracy. Randomized smoothing votes over noisy copies. Gradient masking looks attractive but fails when attacks transfer from substitute models or use gradient-free probes. Robustness is a system property, not a post-hoc confidence score.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Spam, phishing, malware, fraud, and vision systems all face evasion pressure. Calibration & Reliability Diagrams can tell you whether 97% confidence is honest on normal data, but robustness is a different property: the boundary can still be close in an attacker-chosen direction. Uncertainty: Teaching Models to Say "I Don't Know" can flag some strange inputs, but adaptive attacks can target the detector too. Rate limits, ensembles, review queues, and monitoring matter because attackers learn from feedback.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `High confidence is not security. A locally linear model can be confident and close to a boundary at the same time. Loss Landscapes & Optimization Geometry explains the broader geometry: smooth gradients are what make learning possible, and they also reveal attack directions. Saliency Maps & Feature Attribution uses the same input gradients for explanation, which is why explanations and attacks are mathematically adjacent. Do not sell gradient masking as a defense; test against adaptive and transfer attacks.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `After this, study the gradient machinery, the linear classifier boundary, calibration, and saliency. The main takeaway is defensive: any model trained by smooth gradients exposes some local direction of change, so high-stakes deployments need layers around the classifier, not faith in the classifier alone.`,
        `A practical security review should ask how many probes an attacker gets, what feedback they see, and whether small input edits preserve the harmful intent. Robustness is weaker when the attacker can iterate cheaply.`,
        `The demo is small so the boundary is visible, but the habit generalizes: reason about the attacker's allowed moves, not just the model's average accuracy.`,
      ],
    },
  ],
};
