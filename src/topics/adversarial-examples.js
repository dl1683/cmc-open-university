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
        "Read the animation as the execution trace for Adversarial Examples & FGSM. Point the gradient at the input instead of the weights: one deliberate nudge turns 97% spam into 14%..",
        {type: 'callout', text: 'An adversarial example is a geometry failure: the model can stay confident while a tiny input move crosses the boundary.'},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/adversarial-examples.gif', alt: 'Animated walkthrough of the adversarial examples visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Adversarial examples exist because model features are not the same as human meaning. A spam filter may represent an email through counts, tokens, phrases, and learned weights. A vision model may represent an image through millions of pixel-derived activations. Those features can change in ways that preserve the human-level object: the scam is still a scam, the stop sign is still a stop sign, the panda is still a panda. The model can still cross its decision boundary.`,
        `This matters because a confidence score is not a robustness guarantee. A classifier can assign 97 percent spam to a message and still be only two small edits from sending it to the inbox. The model is confident at the observed point, but an attacker chooses the direction of movement. The security question is not just "How accurate is the model on normal data?" It is "How close is a harmful input to an allowed input under the attacker's edit budget?"`,
        {type: 'image', src: 'https://blog.keras.io/img/limitations-of-dl/adversarial_example.png', alt: 'Panda adversarial example classified as gibbon after a tiny perturbation.', caption: 'Classic adversarial image example showing human-stable meaning and model-unstable prediction. (Source: blog.keras.io)'},
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The naive defense is to train a more accurate classifier and trust its confidence. That helps against ordinary mistakes, but it does not answer adaptive pressure. If the attacker can probe the model, see rejections, or approximate the decision boundary, they can search for edits that preserve intent while changing features. In spam, that might be spelling tricks, punctuation changes, image text, or phrase substitutions. In vision, it can be pixel-level noise that a human does not notice.`,
        `Another naive reaction is to hide the exact model. Secrecy raises the attacker's cost, but it is not a clean boundary. Attacks can transfer from substitute models, and gradient-free search can exploit feedback from the deployed system. The wall is geometry. Smooth models trained by gradient methods tend to expose local directions where the score changes quickly. Accuracy on clean validation data does not measure how much movement is needed in those directions.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The same calculus used for training can be aimed at the input. During training, backpropagation asks how weights should change to reduce loss. During an attack, the question changes: how should the input change to increase a target loss, lower a spam score, or force a chosen class? For a linear model, the input gradient is especially visible because the weights themselves describe how each feature pushes the score.`,
        `FGSM, the Fast Gradient Sign Method, turns that idea into a cheap attack. Compute the gradient of loss with respect to the input, keep only the sign of each component, and move each allowed feature by epsilon in the harmful direction. The sign step is crude, but it is fast and coordinated. In many dimensions, many tiny movements can add into a large logit shift even when each individual movement is small.`,
        {type: 'image', src: 'https://docs.pytorch.org/tutorials/_images/fgsm_panda_image.png', alt: 'FGSM panda example showing original image, perturbation, and adversarial result.', caption: 'FGSM uses the input gradient to build a coordinated perturbation. (Source: docs.pytorch.org)'},
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The toy spam filter has two features: exclamation marks and ALL-CAPS words. Logistic regression computes a weighted sum, then passes it through a sigmoid. The original scam sits on the spam side of the boundary. Because both feature weights are positive, reducing both features moves the message away from spam according to the model. One step lowers the score but may not cross the threshold. A second step can cross from flagged to inbox while the malicious payload remains intact.`,
        `In images, the mechanism is the same but the scale is different. A two-feature spam example needs visible edits because there are only two dimensions contributing to the logit. An ImageNet-sized input has 150,528 pixel-channel values. If each value moves by a tiny epsilon in the gradient sign direction, the total score shift is roughly epsilon times the sum of many sensitivities. The perturbation can be visually tiny while the model's internal score moves a long distance.`,
      ],
    },
    {
      heading: `How it works (2)`,
      paragraphs: [
        `The spam-filter plot proves that evasion is a boundary problem, not a meaning problem. The plotted point moves across the learned line while the human interpretation of the email stays the same. The arrow is not a random edit; it is the model revealing the direction that changes its own score fastest under the chosen features. The before-and-after table makes the security failure concrete: confidence was high, yet the allowed edit budget was small.`,
        `The high-dimensional view proves why "imperceptible" does not mean "irrelevant." A small per-feature change is harmless in two dimensions, but the same per-feature budget applied across thousands of dimensions can dominate a classifier's logit. The plot is linear in dimension count. That is enough to explain why attacks can be cheap, why they can transfer, and why a model can be both trainable by gradients and vulnerable through gradients.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `FGSM works because many neural networks are locally close to linear over small neighborhoods. The exact global function may be complex, but near a particular input the first-order gradient often gives a useful direction. The attacker does not need to solve the whole model. One backward pass supplies a local map. If the allowed perturbation set includes many dimensions, the sign step uses all of them at once.`,
        `The attack also works because human-preserving transformations and model-preserving transformations are different. Humans treat "FREE", "FR-EE", and "F R E E" as the same sales trick; a feature extractor may not. Humans ignore tiny pixel changes; a model may add their effects. The robustness gap is the distance between semantic equivalence for the user and feature equivalence for the model.`,
      ],
    },
    {
      heading: `Tradeoffs and defenses`,
      paragraphs: [
        `FGSM is cheap: one forward pass, one backward pass, and one sign step. Stronger attacks iterate, tune step sizes, project back into an allowed perturbation set, or optimize for a targeted class. Defenses are more expensive. Adversarial training generates attacked examples during training and teaches the model to classify them correctly, often trading clean accuracy and compute for robustness. Randomized smoothing can certify small radii but does not make large edit budgets safe.`,
        {type: 'image', src: 'https://docs.pytorch.org/tutorials/_images/sphx_glr_fgsm_tutorial_001.png', alt: 'Accuracy decreases as adversarial epsilon increases.', caption: 'The epsilon curve makes the robustness tradeoff visible as perturbation budget grows. (Source: docs.pytorch.org)'},
        `Gradient masking is the classic trap. If a defense only makes gradients look useless, attackers may route around it with transfer attacks, gradient-free probes, or a differentiable substitute. Uncertainty detection, ensembles, rate limits, and human review can reduce harm, but adaptive attackers can target the detector too. Robustness has to be evaluated against the attacker's allowed actions, feedback, and budget, not against a single canned perturbation.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Adversarial thinking applies to spam, phishing, malware classification, fraud models, content moderation, face recognition, medical imaging, autonomous driving perception, and any model whose output changes an adversary's payoff. It also applies beyond security. A recommender can be gamed by behavior that preserves the actor's goal while changing model features. A ranking model can be pushed by keyword stuffing. A fraud model can be tested by small transaction-shape edits.`,
        `The main failure mode is confusing validation accuracy with safety. Another is evaluating only non-adaptive attacks. A third is assuming that a human-inspection standard is enough: if the model consumes normalized tokens, resized images, compressed audio, or extracted features, the attack surface is that preprocessing pipeline too. Calibration and reliability diagrams answer whether probabilities are honest on a distribution. They do not answer whether a nearby adversarial input can change the outcome.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Logistic Regression for the linear boundary, Gradient Descent and Backpropagation for why input gradients are available, Loss Landscapes and Optimization Geometry for local linear behavior, Saliency Maps and Feature Attribution for the explanation side of the same gradients, Calibration and Reliability Diagrams for the difference between honest confidence and robustness, and Uncertainty methods for detection limits. Then read the original FGSM work by Goodfellow, Shlens, and Szegedy, plus later work on adversarial training and transfer attacks.`,
        `The durable habit is to specify the adversary. What edits are allowed? How many probes do they get? What feedback do they see? Does the harmful intent survive the edit? Which preprocessing steps create new handles? A model that answers those questions may still be imperfect, but it is being evaluated as a deployed system rather than as a clean-data leaderboard score.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Neural networks achieve superhuman accuracy on image classification. But add imperceptible noise to an image and the classifier fails catastrophically. A panda image plus a tiny perturbation is classified as "gibbon" with 99.3% confidence (Goodfellow et al. 2015). The noise is invisible to humans — the image looks identical.',
        'FGSM (Fast Gradient Sign Method, Goodfellow et al. 2015): compute the gradient of the loss with respect to the input image. x_adv = x + ε · sign(∇_x L(θ, x, y)). Move each pixel in the direction that increases the loss. ε = 0.007 (in [0,1] pixel range): imperceptible to humans, catastrophic for classifiers.',
        'Why it works: neural networks are approximately linear in high dimensions. In a 224×224×3 image (150,528 dimensions), even a tiny perturbation per pixel accumulates to a large dot product with the weight vector. The linear model’s decision boundary is a hyperplane — moving perpendicular to it (along the gradient) crosses it with minimal input change. PGD (Projected Gradient Descent, Madry et al. 2018): iterative FGSM within an ε-ball. Stronger attack, harder to defend against. The standard benchmark for robustness evaluation.',
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        '2D classifier: decision boundary at x₁ + x₂ = 1. Point (0.3, 0.3) → class A (sum = 0.6 < 1). Gradient of loss w.r.t. input: [1, 1] (the normal to the boundary). FGSM with ε = 0.25: x_adv = (0.3 + 0.25, 0.3 + 0.25) = (0.55, 0.55). Sum = 1.1 > 1 → class B. Misclassified. Perturbation magnitude: √(0.25² + 0.25²) = 0.35.',
        'In high dimensions (d = 150,528): perturbation per pixel = ε/√d ≈ 0.0006. Invisible to humans. But the total perturbation magnitude = ε·√d ≈ 2.7. Massive impact on the classifier’s linear dot product. This is the curse of dimensionality working against robustness.',
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Adversarial training (Madry et al. 2018): generate PGD adversarial examples during training. Loss = max_δ L(θ, x + δ, y) subject to ||δ|| ≤ ε. Train on the worst-case perturbation. Result: roughly 50% robust accuracy on CIFAR-10 at ε = 8/255 (vs roughly 0% for standard models). Cost: 3–10x more compute than standard training (must run PGD at every step). Accuracy tradeoff: robust models are roughly 10% less accurate on clean data. The price of robustness is reduced standard accuracy — a fundamental tension.',
        'Physical-world adversarial examples: a printed sticker on a stop sign causes misclassification by self-driving car vision systems (Eykholt et al. 2018). Adversarial patches: a small image patch that causes any object it is placed on to be classified as a target class. These work in the physical world — robust to angle, distance, and lighting changes. Defense research is an arms race: every proposed defense has been broken by stronger attacks, except adversarial training (which merely reduces but does not eliminate the problem).',
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        'Goodfellow et al. 2015 (Explaining and Harnessing Adversarial Examples — FGSM, linearity hypothesis). Madry et al. 2018 (Towards Deep Learning Models Resistant to Adversarial Attacks — PGD, adversarial training). Szegedy et al. 2014 (Intriguing Properties of Neural Networks — first discovery of adversarial examples).',
        'Study next: Gradient Descent (adversarial examples use gradient ascent on the input), CNN (the models being attacked), Loss Functions (the objective being maximized), Backpropagation (computing input gradients), Activation Functions (linearity enables FGSM).',
      ],
    },
],
};

