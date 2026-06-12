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
        `An adversarial example is a deliberately crafted input that fools a machine learning model. Take a spam filter trained to be 97 percent confident in its classification of scam emails — high confidence, rock-solid right? Feed it a tiny, invisible edit to that same scam (drop two words, rewrite two features) and confidence collapses to 14 percent. The text and intent of the email never changed. Only the surface features moved. A deep neural network trained to recognize pandas can be tricked into calling a panda a "gibbon, 99.3 percent sure" by adding imperceptible noise. These are adversarial examples: inputs found not by chance, but by pointing the model's own learning mechanism backward at itself. The same gradient that trains the weights can point you toward inputs that break it.`,
        `Why does this matter for you? Because it exposes a gap between confidence and robustness. A model can be well-calibrated on honest data — saying "97 percent" on examples it has actually seen — and still be trivially evadable by someone who gets to move the input on purpose. Understanding adversarial examples is defensive education: it teaches you why confident machine learning systems need additional layers (rate limits, human review, ensemble voting) before they should ever gate something important, and it grounds you in the principle that models are not oracle boxes, they are locally linear functions in high dimensions.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The Fast Gradient Sign Method (FGSM) is the simplest attack. Here is the trick: gradients do not just tell you how to change the weights to reduce loss; they also tell you how to change the input to INCREASE loss. The model learns via the chain rule — loss shrinks as weights move down the gradient. If you invert that and ask "which direction should the input move to make loss bigger?" the answer is the same gradient, and the method is a one-liner: x′ = x − ε·sign(∇ₓ loss). For each input dimension (each feature), take the sign of its gradient and step it in the damaging direction by a small epsilon.`,
        `In the spam filter demo, the weights are (1.1, 1.6) — exclamation marks push the model toward spam, caps words push it harder. So to evade, you subtract from each: reduce exclamation marks, reduce caps. In one step, confidence drops from 97 percent to 71 percent. In two steps, it is 14 percent. The email is safe. For image models, the same principle applies, but in high dimension the math shifts. A 150,000-pixel image nudged by ε in every direction at once accumulates damage across all dimensions — ε times the sum of all weights — and that sum is enormous. With ε small enough that no human eye detects the change per pixel (1 part in 255), the cumulative logit shift exceeds the decision boundary. Trainability and attackability are two faces of one coin: a neural network's smooth, locally linear structure that lets Gradient Descent find good weights also lets an attacker find the exploit.`,
        `The second demo isolates why tiny steps fool big models: as dimensionality climbs (2-feature toy, 3,000-pixel image, 150,000-pixel ImageNet), the same imperceptible epsilon nudge causes exponentially larger logit shifts. The toy model needs visible edits because the feature space is small. Images are defenseless because the damage sums across 150,000 directions simultaneously.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Launching FGSM: one forward pass (to compute the loss), one backward pass (to get the gradient with respect to inputs), then a sign-and-step operation. Total time: O(1) relative to model complexity. You are piggybacking on the inference and backpropagation machinery the model already has. Detecting or defending: far costlier. Adversarial training (training on attacked copies of your data) requires generating attacks during training, multiplying training time by a small constant (typically 2–3×) and sacrificing 2–5 percentage points of clean accuracy on honest data. Randomized smoothing (voting over noisy copies of the input) requires multiple forward passes at test time and only certifies robustness within a small perturbation radius, leaving larger attacks undefended. Gradient masking — attempts to hide gradients so attackers cannot compute them — has collapsed repeatedly: transfer attacks (crafted on a substitute model, then applied to your real model) bypass the mask, and it is the defense equivalent of security through obscurity.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The panda-to-gibbon result (Goodfellow, 2014) shocked the field and sparked a decade of research in robust machine learning. Adversarial robustness is now a published requirement for models used in security (malware detection, fraud scoring, intrusion detection) and safety (autonomous vehicle perception, medical imaging diagnosis). Spam and phishing filters have long fought evasion — spammers discovered many FGSM-like tricks before the term existed, from "FR-EE" tricks to character substitution. Modern work includes: adversarially trained vision models for self-driving cars, certified defenses for mission-critical classifiers (with mathematical guarantees on robustness within a radius), and ensemble voting (multiple models agreeing before flagging a case as high-risk). You will also encounter adversarial examples in capture-the-flag security competitions and in your own defensive reasoning about model deployments: if your model scores something suspicious, assume an attacker could find a variation of it that scores normal.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Myth 1: "My high confidence means high robustness." Calibration — ensuring 97 percent truly means 97 percent on honest data — is separate from robustness. Adversarial distance and confident-data distance are orthogonal concepts. A model can be perfectly calibrated on honest inputs and still lie three steps away from an evaded boundary chosen by an attacker.`,
        `Myth 2: "Gradient masking solves this." It does not. Attackers can craft attacks on a substitute model or use derivative-free methods (genetic algorithms, random search over the input space). Hiding your gradient is like having a lock with a fake keyhole — it slows detection but fails against an motivated adversary.`,
        `Myth 3: "A little adversarial training fixes everything." It helps significantly for a cost: you trade accuracy and compute for robustness, and the guarantee is local (robustness within radius ε around training data). Larger perturbations can still break it, and the model does not generalize robustly to attacks it never saw during training. Randomized smoothing gives mathematical certificates, but only for small radii. Nothing is free.`,
        `Reality: Assume any gradient-trained model is locally evadable. Price that into your system. For high-stakes decisions, layer defenses: rate limits (an attacker must probe the model thousands of times, flag after N failures), ensemble voting (multiple independent models agree), human review on boundary-case scores, and uncertainty flags (model says "I am unsure" instead of guessing). Confidence is not a substitute for security.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `You have just seen that gradients work on inputs. Go deepen your gradient intuition with Gradient Descent, which optimizes weights using the same calculus. Then study Backpropagation to understand how the chain rule flows gradients backward through a network. For defensive thinking, learn Calibration & Reliability Diagrams so you can audit whether a model's reported confidence is honest. Study Logistic Regression (the demo's underlying classifier) to see why linear models have smooth boundaries and why adding noise crosses them. Finally, explore Uncertainty: Teaching Models to Say "I Don't Know" to see how a committee of models (MC Dropout) can flag adversarial examples that a single confident model would miss. These pieces fit together: a transparent, explainable model (Logistic Regression) is easiest to attack, a deep model is harder to interpret but easier to exploit (locally linear, high dimension), and a well-calibrated uncertainty estimate is your best defense signal.`,
      ],
    },
  ],
};
