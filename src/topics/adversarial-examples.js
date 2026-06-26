// Adversarial examples: the gradient that trains a model can be pointed
// back at its input. One small, deliberate nudge and 97% "spam" becomes
// 14% — same scam, two fewer exclamation marks. Confidence â‰  robustness.

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
      vectors: [{ id: 'grad', label: 'âˆ’âˆ‡ (the escape route)', from: { x: 4, y: 3 }, to: { x: 2.9, y: 1.9 } }],
    }),
    highlight: { active: ['grad'] },
    explanation: 'The trick that makes this a one-liner: GRADIENTS WORK ON INPUTS TOO. Training asked "how should the WEIGHTS change to reduce the loss?" — backpropagation\'s question. The attacker asks "how should the INPUT change to increase it?" — same calculus, different variable. For this model the input-gradient is just the weight vector (1.1, 1.6): exclamation marks and caps push spam-ward, so their negatives are the escape route. FGSM — the Fast Gradient Sign Method — takes the sign of each gradient component and steps every feature one ε in its most damaging direction: x′ = x âˆ’ εÂ·sign(âˆ‡â‚“). The arrow IS the model\'s own knowledge, weaponized.',
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
    explanation: `Walk the escape route. One step (ε = 1): drop one exclamation mark, one caps word â†’ p falls from 0.97 to ${p(3, 2).toFixed(2)} — still flagged, barely. Second step â†’ (2, 1): p = ${p(2, 1).toFixed(2)}, comfortably under the threshold. The email sails into the inbox. Read the labels again: the TEXT of the scam never changed — same link, same lie — only two surface features moved. Real spammers discovered this before the term existed: "FR-EE", "C1ALIS", spelling tricks that subtract trigger features while preserving the payload. Every evasion is a walk down the model's gradient.`,
  };

  yield {
    state: matrixState({
      title: 'The attack, summarized',
      rows: [{ id: 'orig', label: 'original scam' }, { id: 'adv', label: 'adversarial scam' }],
      columns: [{ id: 'excl', label: 'excl. marks' }, { id: 'caps', label: 'CAPS words' }, { id: 'p', label: 'p(spam)' }, { id: 'verdict', label: 'verdict' }],
      values: [[4, 3, p(4, 3), 1], [2, 1, p(2, 1), 2]],
      format: (v) => (v === 1 ? 'JUNKED' : v === 2 ? 'inbox âœ—' : v < 1 ? `${(v * 100).toFixed(0)}%` : String(v)),
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
      columns: [{ id: 'per', label: 'per-feature change' }, { id: 'shift', label: 'total logit shift â‰ˆ εÂ·Σ|wáµ¢|' }],
      values: dims.map(({ d }) => [eps, eps * avgW * d]),
      format: (v) => (v === eps ? '0.01 (invisible)' : v.toFixed(v < 1 ? 3 : 1)),
    }),
    highlight: { compare: ['toy:shift'], removed: ['imagenet:shift'] },
    explanation: 'In our 2-feature toy the attack needed VISIBLE edits — whole exclamation marks. So why are image attacks invisible? Dimensionality. FGSM nudges EVERY dimension by a tiny ε simultaneously, and each nudge εÂ·sign(wáµ¢) adds |wáµ¢|Â·ε to the logit — the damage SUMS across dimensions: εÂ·Σ|wáµ¢| â‰ˆ εÂ·dÂ·avg|w|. Two features: shift 0.002, nothing. An ImageNet image (150,528 values, each moved by 1/255th — below what a monitor can show): shift â‰ˆ 150. The boundary is not crossed by one big step in one direction, but by 150,528 imperceptible steps in ALL directions at once. High dimension is the attacker\'s lever.',
    invariant: 'Per-dimension damage stays εÂ·|wáµ¢|; total damage grows linearly with dimension count.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'input dimensions (thousands)' }, y: { label: 'logit shift from invisible ε' } },
      series: [{
        id: 'shift',
        label: 'εÂ·dÂ·avg|w|',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the plot as a decision boundary, not as a map of human meaning. The point is the current input, the line is the classifier threshold, and the arrow shows the input direction that most reduces the spam score. If a tiny move crosses the line while the scam intent stays the same, the model has a robustness problem.',
        {type: 'callout', text: 'An adversarial example is a geometry failure: the model can stay confident while a tiny input move crosses the boundary.'},
        'Active marks show the edit being tested now. Compared marks show the old score so you can see how much confidence was lost. The safe inference is local: this gradient step is legal because it follows the model slope at the current input.',
        {type: 'image', src: './assets/gifs/adversarial-examples.gif', alt: 'Animated walkthrough of the adversarial examples visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Adversarial examples exist because model features and human meaning are not the same object. A spam filter may count punctuation, capitalization, tokens, or embeddings while a human sees the same fraud pitch. If an attacker can change model-facing features without changing the harmful intent, clean accuracy is not enough.',
        'The risk is highest when model decisions create incentives. A spammer wants delivery, a fraudster wants approval, and a malicious user wants a moderation system to miss the payload. The practical question is how far a harmful input is from an allowed region under the edits the attacker can actually make.',
        {type: 'image', src: 'https://blog.keras.io/img/limitations-of-dl/adversarial_example.png', alt: 'Panda adversarial example classified as gibbon after a tiny perturbation.', caption: 'Classic adversarial image example showing human-stable meaning and model-unstable prediction. (Source: blog.keras.io)'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train a more accurate classifier and trust high confidence. That works for ordinary mistakes because more data, better features, and stronger models usually improve clean validation accuracy. It feels reasonable because the model is not merely guessing; it can be 97 percent confident at the original point.',
        'A second obvious approach is to hide the model. If the attacker cannot see the exact weights, the attack should be harder. Secrecy can raise cost, but deployed systems leak information through scores, rejections, labels, retries, and substitute models trained on similar data.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that confidence measures the current point, not the nearby attack surface. A classifier can be confidently correct on natural examples while a small chosen edit crosses its boundary. The attacker chooses the direction of movement, so average performance on honest data does not measure the relevant risk.',
        'Hiding gradients also fails as a full defense. Attacks can transfer from other models, use finite-difference probes, or optimize against a softened copy of the system. If the underlying boundary is close, removing the obvious map does not remove the nearby exit.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The same gradient that trains a model can be aimed back at the input. Training asks how the weights should change to reduce loss. An attack asks how the input should change to increase a target loss or lower an unwanted score.',
        'FGSM, the Fast Gradient Sign Method, makes the move cheap. Compute the gradient of the loss with respect to the input, keep only the sign of each component, and move each feature by epsilon in the damaging direction. In a linear spam model, the weights themselves tell you which feature edits move the score.',
        {type: 'image', src: 'https://docs.pytorch.org/tutorials/_images/fgsm_panda_image.png', alt: 'FGSM panda example showing original image, perturbation, and adversarial result.', caption: 'FGSM uses the input gradient to build a coordinated perturbation. (Source: docs.pytorch.org)'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In the spam animation, the original scam starts with four exclamation marks and three all-caps words. The logistic model gives those features positive weight, so reducing both moves the point away from the spam side of the boundary. One edit lowers the score, and a second edit crosses the threshold.',
        'In an image model, the same mechanism spreads across many more dimensions. Each pixel channel can move by a tiny amount that a human barely notices. The model adds those small score changes across thousands of coordinates, so the total logit shift can be large.',
        'FGSM is intentionally simple. It does not search over every possible edit or solve a long optimization problem. One forward pass and one backward pass expose a local direction that is often good enough to fool the classifier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'FGSM works because many neural networks are locally close to linear over small neighborhoods. The full function may be complicated, but the first-order gradient near one input often points toward a higher-loss region. The attack only needs a useful local direction, not a global explanation of the model.',
        'High dimension makes the attack stronger. If epsilon is tiny but applied to 150,528 image values, the effects can accumulate in the model score. The perturbation is small per coordinate, yet the combined dot product can cross the decision boundary.',
        'The deeper reason is a mismatch between semantic distance and model distance. Humans may treat two images or messages as equivalent, while the feature vector has moved enough to change the prediction. Robustness means aligning those distances better under the attack budget.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'FGSM is cheap: one gradient evaluation plus a sign step. Its time cost is close to one normal training backward pass for the input batch. Its memory cost is also modest because it only needs the input gradient and the usual model activations.',
        'Stronger attacks cost more. Projected gradient descent repeats many small FGSM-like steps and projects the result back into the allowed perturbation set. Black-box attacks spend queries instead of gradients, which moves the cost from compute to probing budget and rate-limit pressure.',
        {type: 'image', src: 'https://docs.pytorch.org/tutorials/_images/sphx_glr_fgsm_tutorial_001.png', alt: 'Accuracy decreases as adversarial epsilon increases.', caption: 'The epsilon curve makes the robustness tradeoff visible as perturbation budget grows. (Source: docs.pytorch.org)'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Adversarial examples matter in spam filtering, phishing detection, malware classification, fraud scoring, content moderation, face recognition, medical imaging, and autonomous driving perception. The common pattern is not the data type. The common pattern is a model decision that an adversary has reason to change.',
        'They also matter outside classic security. Search rankings, recommender systems, and marketplace moderation can all be gamed by inputs that preserve a user goal while changing model features. Thinking adversarially helps engineers define allowed edits, feedback channels, and review paths before deployment.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FGSM is a first-order attack, so it can understate risk when the real adversary can run stronger optimization. A model that survives FGSM may still fail under projected gradient descent, transfer attacks, or adaptive black-box probing. Passing one attack is not a certificate of safety.',
        'Defenses fail when they only hide or break gradients. Gradient masking can make FGSM look weak while leaving the decision boundary close. Robust evaluation must include adaptive attacks that know the defense and can route around brittle preprocessing.',
        'Adversarial training helps, but it is not free. It adds compute, can reduce clean accuracy, and only improves robustness inside the perturbation family used during training. If the real attacker can make semantic edits outside that family, the guarantee does not carry over.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the toy spam model from the animation. The original point is 4 exclamation marks and 3 all-caps words, which the model scores near 0.97 spam. Reducing both features by one gives 3 and 2, which lowers the score but can still leave the email flagged.',
        'A second step gives 2 exclamation marks and 1 all-caps word. The score falls below the decision threshold, so the same scam intent moves from junk to inbox. The edit is small in feature space, but it crosses the learned boundary.',
        'For images, replace the two visible edits with thousands of nearly invisible ones. If each coordinate moves by 1/255 in the gradient sign direction, the human image can look unchanged while the model score changes sharply. That is the high-dimensional version of the same boundary crossing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Szegedy et al., "Intriguing Properties of Neural Networks," for the discovery that small perturbations can change predictions. Then read Goodfellow, Shlens, and Szegedy, "Explaining and Harnessing Adversarial Examples," for FGSM and the linearity argument. Madry et al., "Towards Deep Learning Models Resistant to Adversarial Attacks," is the standard reference for projected gradient descent and adversarial training.',
        'Study logistic regression for the visible boundary, backpropagation for input gradients, loss functions for the objective being attacked, and calibration for the difference between honest probabilities and robustness. Then study uncertainty and evaluation design, because a deployed defense is only meaningful against a clearly specified adversary.',
      ],
    },
  ],
};
