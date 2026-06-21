// Focal loss: when 99,900 easy examples shout louder than the 100 hard ones
// that matter, multiply every voice by (1âˆ’p)^γ — confidence becomes silence,
// and the gradient finally listens to the difficult cases.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'focal-loss',
  title: 'Focal Loss & Hard Examples',
  category: 'AI & ML',
  summary: 'Easy examples drown the gradient by sheer headcount — (1âˆ’p)^γ mutes the confident and amplifies the struggling.',
  controls: [
    { id: 'view', label: 'See', type: 'select', options: ['easy examples drown the loss', 'the (1âˆ’p)^γ fix'], defaultValue: 'easy examples drown the loss' },
  ],
  run,
};

// The RetinaNet ledger: 100k candidate boxes, ~100 contain objects.
const EASY = { n: 99900, p: 0.99 };  // background, model already sure
const HARD = { n: 100, p: 0.1 };     // objects, model still failing
const ce = (p) => -Math.log(p);
const focal = (p, g) => ((1 - p) ** g) * ce(p);
const PS = Array.from({ length: 33 }, (_, i) => 0.03 + i * 0.03);

function* drown() {
  yield {
    state: matrixState({
      title: 'An object detector grades 100,000 candidate boxes',
      rows: [{ id: 'easy', label: 'easy background' }, { id: 'hard', label: 'actual objects' }],
      columns: [{ id: 'n', label: 'count' }, { id: 'p', label: 'p(correct class)' }],
      values: [[EASY.n, EASY.p], [HARD.n, HARD.p]],
      format: (v) => (v >= 1 ? v.toLocaleString('en-US') : `${(v * 100).toFixed(0)}%`),
    }),
    highlight: { compare: ['easy:n', 'hard:n'] },
    explanation: 'The scenario that forced this invention: a one-stage object detector (RetinaNet-style) proposes ~100,000 candidate boxes per image and classifies each. About 100 contain objects — the rest are sky, grass, wall: background the model already nails with 99% confidence. This is Imbalanced Data pushed to 999:1, but with a twist the class-weight fix cannot reach: the problem is not just that one CLASS outnumbers the other — it is that EASY examples outnumber hard ones. Watch what that headcount does to the loss.',
  };

  const easyTotal = EASY.n * ce(EASY.p);
  const hardTotal = HARD.n * ce(HARD.p);
  yield {
    state: matrixState({
      title: 'The cross-entropy ledger: who does the gradient listen to?',
      rows: [{ id: 'easy', label: '99,900 easy' }, { id: 'hard', label: '100 hard' }],
      columns: [{ id: 'per', label: 'loss each' }, { id: 'total', label: 'total loss' }, { id: 'share', label: 'share of gradient' }],
      values: [[ce(EASY.p), easyTotal, easyTotal / (easyTotal + hardTotal)], [ce(HARD.p), hardTotal, hardTotal / (easyTotal + hardTotal)]],
      format: (v) => (v < 0.02 ? v.toFixed(3) : v <= 1 ? `${(v * 100).toFixed(0)}%` : v.toFixed(1)),
    }),
    highlight: { removed: ['easy:share'], compare: ['hard:share'] },
    explanation: `Each easy background box costs almost nothing — cross-entropy âˆ’log(0.99) = 0.010, the small print of Entropy & Information. But 99,900 almost-nothings total ${easyTotal.toFixed(0)}, while the 100 genuinely hard objects (p = 0.1, loss 2.30 each) total only ${hardTotal.toFixed(0)}. Read the last column: 81% of the training signal comes from examples the model has ALREADY MASTERED. Every gradient step mostly polishes the trivial; the rare objects — the entire point of the detector — whisper from 19%. Death by a hundred thousand paper cuts.`,
    invariant: 'Total loss = per-example loss Ã— count: a horde of tiny losses can outvote the few that matter.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'p assigned to the true class' }, y: { label: 'loss' } },
      series: [{ id: 'ce', label: 'cross-entropy', points: PS.map((p) => ({ x: p, y: ce(p) })) }],
      markers: [
        { id: 'mEasy', x: 0.99, y: ce(0.99), label: 'easy: 0.01 Ã— 99,900' },
        { id: 'mHard', x: 0.1, y: ce(0.1), label: 'hard: 2.30 Ã— 100' },
      ],
    }),
    highlight: { active: ['mEasy'], compare: ['mHard'] },
    explanation: 'The shape of the problem on the loss curve itself. Cross-entropy never reaches zero — even a 99%-confident correct answer pays a little, by design (that is what keeps Logistic Regression sharpening forever). Usually harmless; here, multiplied by 99,900, it is a tyranny of the comfortable. Note what we need: not a different THRESHOLD (that is post-training), not class WEIGHTS (the easy/hard split is not the class split — there are easy positives and hard negatives too). We need the loss to notice DIFFICULTY itself — to ask each example "how sure were you?" and scale accordingly.',
  };
}

function* fix() {
  yield {
    state: plotState({
      axes: { x: { label: 'p assigned to the true class' }, y: { label: 'loss' } },
      series: [0, 0.5, 2, 5].map((g) => ({
        id: `g${String(g).replace('.', '')}`,
        label: g === 0 ? 'γ=0 (CE)' : `γ=${g}`,
        points: PS.map((p) => ({ x: p, y: focal(p, g) })),
      })),
      markers: [{ id: 'mEasy', x: 0.99, y: focal(0.99, 2), label: 'easy, γ=2: â‰ˆ0' }],
    }),
    highlight: { active: ['g2'], visited: ['g0'], found: ['mEasy'] },
    explanation: 'FOCAL LOSS: multiply cross-entropy by (1âˆ’p)^γ — one factor, one new knob. When the model is already confident (p â†’ 1), the factor (1âˆ’p)^γ collapses toward zero and CRUSHES the loss; when the model is struggling (p small), the factor stays near 1 and the loss survives almost intact. γ controls the ferocity: γ = 0 is plain cross-entropy; γ = 2 (the paper\'s choice) mutes a 99%-confident example by 10,000Ã— while a struggling p = 0.1 example keeps 81% of its voice. The curves tell the story: every γ > 0 bends the right side of the curve down to the floor and leaves the left side standing.',
    invariant: 'Focal loss = (1âˆ’p)^γ Â· CE: damping grows with confidence, never with class.',
  };

  const g = 2;
  yield {
    state: matrixState({
      title: 'The same ledger, refereed by γ = 2',
      rows: [{ id: 'easy', label: '99,900 easy' }, { id: 'hard', label: '100 hard' }],
      columns: [{ id: 'damp', label: '(1âˆ’p)²' }, { id: 'total', label: 'total loss' }, { id: 'share', label: 'gradient share (%)' }],
      values: [
        [(1 - EASY.p) ** g, EASY.n * focal(EASY.p, g), (100 * EASY.n * focal(EASY.p, g)) / (EASY.n * focal(EASY.p, g) + HARD.n * focal(HARD.p, g))],
        [(1 - HARD.p) ** g, HARD.n * focal(HARD.p, g), (100 * HARD.n * focal(HARD.p, g)) / (EASY.n * focal(EASY.p, g) + HARD.n * focal(HARD.p, g))],
      ],
      format: (v) => (v < 0.005 ? v.toExponential(1) : v < 10 ? v.toFixed(2) : v.toFixed(1)),
    }),
    highlight: { found: ['hard:share'], removed: ['easy:share'] },
    explanation: 'The coup, in numbers. The easy horde\'s damping factor is (1âˆ’0.99)² = 0.0001: their collective roar of 1,004 drops to 0.10. The hard examples\' factor is (1âˆ’0.1)² = 0.81: their 230 barely dips to 187. The gradient share flips from 81/19 to 0.05/99.95 — the hundred examples that matter now steer essentially ALL of the learning, and nobody had to label which ones were hard. The loss function measures difficulty for free, per example, every step, automatically re-aiming as examples graduate from hard to easy.',
  };

  yield {
    state: matrixState({
      title: 'The difficulty-weighting family',
      rows: [
        { id: 'focal', label: 'focal loss' },
        { id: 'ohem', label: 'OHEM (hard mining)' },
        { id: 'weights', label: 'class weights' },
      ],
      columns: [{ id: 'how', label: 'mechanism' }, { id: 'grain', label: 'granularity' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'smooth (1âˆ’p)^γ damping', 'per example, continuous', 'train ONLY the worst k', 'per example, all-or-nothing', 'fixed multiplier per class', 'per class, blind to difficulty'][v],
    }),
    highlight: { active: ['focal:grain'], compare: ['ohem:how', 'weights:grain'] },
    explanation: 'Where it sits in the family: OHEM — Online Hard Example Mining — had the same instinct discretely (sort by loss, train on the worst k, ignore the rest); focal loss is its smooth, differentiable cousin. Class weights (Imbalanced Data) re-price by CLASS, blind to whether an individual example is easy. The 2017 RetinaNet paper (Lin et al., "Focal Loss for Dense Object Detection") used this one factor to make cheap one-stage detectors match expensive two-stage ones — a loss-function fix beating an architecture fix. One sharp caution before you bolt it onto everything: focal loss obsesses over whatever it cannot fit, and if your labels are NOISY, the unfittable examples are the mislabeled ones — γ cranks up the volume on your data\'s mistakes. Difficulty weighting assumes the difficulty is legitimate.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'easy examples drown the loss') yield* drown();
  else if (view === 'the (1âˆ’p)^γ fix') yield* fix();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Focal Loss & Hard Examples. Easy examples drown the gradient by sheer headcount — (1âˆ’p)^γ mutes the confident and amplifies the struggling..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        {type: "callout", text: "Focal loss is difficulty-aware weighting: the label chooses the target, but model confidence chooses how much the example can steer the update."},
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/focal-loss.gif', alt: 'Animated walkthrough of the focal loss visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why it exists`,
      paragraphs: [
        `Focal loss exists because some training sets are not merely imbalanced by class. They are imbalanced by difficulty. Dense object detection is the clean example. A detector may evaluate tens of thousands of candidate boxes in one image. Almost all are easy background: sky, wall, road, table, blank space. A tiny fraction contain objects, and an even smaller fraction contain objects the model currently finds hard. If ordinary cross-entropy sums every candidate, the gradient can be dominated by examples the model already understands.`,
        `The naive reaction is class weighting. If positives are rare, multiply positive loss by a larger number. That helps when the problem is mainly class frequency. It does not solve the harder pattern: easy negatives are numerous, hard negatives exist, easy positives exist, and hard positives are the ones you most need to learn. A fixed class multiplier cannot tell whether an individual example is already solved. It only knows the label.`,
        `Focal loss changes the question from "which class is this?" to "how confidently did the model handle this example?" It keeps the cross-entropy foundation but multiplies each example by a difficulty factor. Confident correct examples become quiet. Struggling examples remain loud. The method is simple, but the shift is important: the loss function starts allocating training attention dynamically, per example, as the model improves.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `Cross-entropy for the true class is -log(p), where p is the model\'s assigned probability to the correct answer. A very wrong prediction with p = 0.1 pays about 2.30. A confident correct prediction with p = 0.99 pays about 0.010. One easy example hardly matters. The wall appears when there are 99,900 easy examples and 100 hard examples. The easy examples contribute 99,900 times 0.010, about 1,004 total loss. The hard examples contribute 100 times 2.30, about 230 total loss. The easy majority wins the gradient ledger.`,
        `That is a strange failure. Cross-entropy is doing exactly what it was asked to do: penalize wrong predictions much more than correct predictions. But the reduction over a giant batch or image turns many tiny losses into a large force. The optimizer spends most of its step polishing background boxes from 99 percent confidence to 99.1 percent confidence while the rare object cases remain undertrained.`,
        `Hard-example mining attacks the same wall by sorting examples by loss and training on the worst ones. That can work, but it is discrete and operationally awkward. Which k examples count? How often should the set change? Do you ignore every easy example completely? Focal loss gives a smooth answer: do not choose a hard set by hand; make every example weight itself by current confidence.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Focal loss multiplies cross-entropy by (1 - p)^gamma. When gamma is 0, the factor is 1 and the loss is ordinary cross-entropy. When gamma is positive, the factor shrinks as p approaches 1. A confident correct example with p = 0.99 and gamma = 2 receives a multiplier of 0.0001. A hard example with p = 0.1 receives a multiplier of 0.81. The hard example keeps most of its loss; the easy example is almost silenced.`,
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1708.02002/assets/x0.png', alt: 'Focal loss curves showing easy examples down-weighted as gamma increases', caption: 'The focal loss paper plots cross-entropy against focal loss for several gamma values, making the easy-example damping visible. Source: Lin et al., Focal Loss for Dense Object Detection, ar5iv.'},
        `In the detector ledger, gamma = 2 changes the totals dramatically. The easy background group falls from roughly 1,004 total cross-entropy to about 0.10 focal loss. The hard group falls from roughly 230 to about 187. The share of training signal flips from easy-dominated to hard-dominated without an explicit rule that says "these examples are hard." The current model probability supplies that information every step.`,
        `Alpha weighting is often paired with focal loss. Alpha is a class-balancing multiplier; gamma is the focusing parameter. They solve different problems. Alpha says one class should count more. Gamma says confident examples should count less. In practice, alpha can help with positive-negative imbalance while gamma handles easy-hard imbalance inside and across those classes.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The mechanism works because it changes gradient allocation, not just reported loss values. Easy examples still flow through the model, but their contribution to parameter updates becomes tiny. Hard examples retain a large derivative because the focal factor is near one when p is low. As training progresses, an example that used to be hard becomes confident, its focal factor shrinks, and attention moves elsewhere. The curriculum updates itself.`,
        `This is especially useful in one-stage object detectors. Two-stage detectors first propose a smaller set of candidate regions, which reduces the easy-background flood. One-stage detectors classify dense grids of anchors directly, which is faster but creates a huge imbalance. Focal loss was the loss-function fix that let RetinaNet-style one-stage detection compete with two-stage approaches: keep dense detection, but stop easy anchors from owning the gradient.`,
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1708.02002/assets/x2.png', alt: 'RetinaNet architecture with feature pyramid and classification and box subnetworks', caption: 'RetinaNet applies focal loss to dense anchors across a feature pyramid, where easy background examples are abundant. Source: Lin et al., Focal Loss for Dense Object Detection, ar5iv.'},
        `The shape is also related to margin thinking. Focal loss does not merely ask whether an example is correct; it asks whether the model is confidently correct. A borderline correct example still receives attention. A solved example fades. This is why focal loss can improve rare-event recall and detection quality even when class weights alone are insufficient.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start by proving that the easy-example flood is real. Inspect per-example or per-anchor loss totals, not just average loss. If most of the loss comes from examples with high p for the true class, focal loss is a candidate. If the model is failing because all examples are noisy, labels are inconsistent, or the feature representation is weak, focal loss may make the wrong cases louder without solving the underlying problem.`,
        `Gamma is the central hyperparameter. The RetinaNet paper used gamma = 2 as a strong default, but the best value depends on label quality, class frequency, model capacity, and task risk. Low gamma behaves closer to cross-entropy. High gamma aggressively suppresses easy examples and can hurt calibration or stability. If alpha is used, tune it separately from gamma; do not treat class imbalance and difficulty imbalance as the same diagnosis.`,
        `Evaluate with metrics that reflect the reason you used focal loss. In detection, inspect average precision at relevant IoU thresholds, false positives per image, recall for small or rare objects, and class-specific performance. In binary rare-event classifiers, inspect precision-recall curves, recall at required precision, calibration, and performance on slices. A lower training loss is not enough; focal loss can reshape scores in ways that affect downstream thresholding.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Focal loss is best known for dense object detection, but the pattern appears anywhere easy negatives are overwhelming. Medical image segmentation often has large background regions and small lesions. Defect detection may have many normal patches and few subtle flaws. Fraud, abuse, and moderation systems may see huge volumes of obvious benign cases and a small number of hard positives. In each case, accuracy can look healthy while the valuable rare cases receive weak training pressure.`,
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1708.02002/assets/x1.png', alt: 'RetinaNet speed and COCO AP comparison chart', caption: 'The focal loss paper shows RetinaNet moving the speed-accuracy frontier for one-stage detection. Source: Lin et al., Focal Loss for Dense Object Detection, ar5iv.'},
        `It is also used in multi-label classification, instance segmentation, and variants of segmentation loss where foreground regions are small. The important match is not the domain label; it is the loss ledger. If easy examples dominate because of count, and hard examples are genuinely informative, focal loss is a reasonable tool. If the hard examples are mostly annotation errors, duplicated records, adversarial edge cases outside the product scope, or unresolvable ambiguity, the same tool can overfit the mess.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The main failure mode is label noise. Focal loss asks the model to focus on examples it cannot fit. If those examples are mislabeled, ambiguous, or outside the intended distribution, increasing gamma can make the model chase errors. Before raising gamma, inspect high-loss examples manually. Many focal-loss "wins" come from clean hard examples; many losses come from treating bad labels as precious signal.`,
        `Calibration can also suffer. Cross-entropy is closely tied to probability estimation. Focal loss changes the incentive by downweighting confident examples, so predicted probabilities may become less reliable even when ranking or detection metrics improve. If downstream decisions depend on probability thresholds, run calibration checks and consider post-training calibration.`,
        `Another misconception is that focal loss replaces threshold selection. It does not. Focal loss changes training. Thresholds change deployment behavior. A model can be trained with focal loss and still need a different threshold for high precision, high recall, or cost-sensitive action. Precision, Recall and the Confusion Matrix remains the evaluation surface after the loss has done its work.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Cross-Entropy and Logistic Regression for the baseline loss, Imbalanced Data for class-frequency fixes, Precision and Recall for the metrics that reveal rare-case behavior, and Hyperparameter Search for tuning gamma and alpha without fooling yourself. Then compare focal loss with online hard-example mining, class-balanced loss, Dice loss for segmentation, and calibration diagrams. The durable lesson is to separate three problems: class imbalance, difficulty imbalance, and decision-cost imbalance. Focal loss is built for the second one.`,
      ],
    },
    {
      heading: 'The cross-entropy foundation',
      paragraphs: [
        `Focal loss modifies cross-entropy, so the cross-entropy formula is the prerequisite. Shannon (1948) defined information content as -log(p): a certain event (p = 1) carries zero information, a coin flip (p = 0.5) carries 1 bit, and a 1-in-100 event carries about 6.6 bits. Cross-entropy H(p, q) = -sum(p_i * log(q_i)) measures how expensive it is to encode events drawn from the true distribution p using a model distribution q. When p is a one-hot label — the standard classification case — the sum collapses to a single term: -log(q_correct), the negative log probability the model assigned to the true class.`,
        `Binary cross-entropy handles two classes: BCE = -[y * log(q) + (1 - y) * log(1 - q)], where y is 0 or 1 and q is the predicted probability for class 1. If y = 1 and q = 0.9, BCE = -log(0.9) = 0.105. If y = 1 and q = 0.01, BCE = -log(0.01) = 4.605 — a confident wrong prediction is catastrophically expensive. Categorical cross-entropy generalizes to K classes: CE = -sum_{i=1}^{K} y_i * log(q_i). With one-hot labels, only the true class contributes, so CE = -log(q_correct) regardless of K.`,
        `The -log(p) penalty has a specific shape that makes it right for classification. At p = 1, the loss is 0 — no penalty for perfect confidence in the right answer. At p = 0.5, the loss is 0.693 — moderate penalty for a coin-flip prediction. As p approaches 0, the loss approaches infinity — the model was confident about the wrong answer and pays unbounded cost. This asymmetry is the mechanism that forces models away from confident errors, unlike mean squared error which caps the penalty at 1 for a maximally wrong binary prediction.`,
      ],
    },
    {
      heading: 'Why MSE fails for classification and the KL divergence connection',
      paragraphs: [
        `MSE between a one-hot label and a softmax output has a gradient proportional to (y - q) * q * (1 - q). Near q = 0 or q = 1, the q * (1 - q) factor drives the gradient toward zero. A model that confidently predicts the wrong class (q near 0 for the true class) gets a tiny gradient — exactly when it most needs a large correction. Cross-entropy avoids this because its gradient for the true class is -1/q, which grows without bound as q approaches 0. The worse the prediction, the stronger the push.`,
        `Cross-entropy connects to KL divergence through a clean identity: H(p, q) = H(p) + D_KL(p || q). Entropy H(p) measures the irreducible uncertainty in the true distribution. KL divergence D_KL(p || q) measures the extra cost of using q instead of p. For one-hot labels, H(p) = 0 (no uncertainty when the label is certain), so minimizing cross-entropy is identical to minimizing KL divergence. When labels are soft — as in knowledge distillation or label smoothing — H(p) > 0 and acts as a constant offset that does not affect optimization.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Computing cross-entropy over K classes costs O(K): one log and one multiply per nonzero probability, then a sum. For focal loss, add one exponentiation per example for the (1 - p)^gamma factor. With K = 1000 (ImageNet) this is negligible. The dominant cost is always the forward pass that produces the softmax distribution, not the loss computation itself.`,
        `Focal loss adds no memory overhead beyond standard cross-entropy. It stores the same predicted distribution and target. The only extra computation is the per-example modulating factor (1 - p_t)^gamma, which is a scalar multiply on the already-computed cross-entropy value. In detection, the number of candidate anchors (tens of thousands per image) makes the loss summation nontrivial, but focal loss does not change the asymptotic cost — it changes the weights.`,
        `The hyperparameter gamma controls a tradeoff: higher gamma suppresses easy examples more aggressively, concentrating gradients on hard cases. At gamma = 0, focal loss equals cross-entropy. At gamma = 2 (the RetinaNet default), a 99%-confident example receives 10,000 times less weight than it would under cross-entropy. At gamma = 5, the suppression is even more extreme and training can become unstable if most examples are easy, because the effective batch size shrinks to just the hard ones.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Three-class problem. True label: class 0 (one-hot [1, 0, 0]). Model predicts softmax output [0.7, 0.2, 0.1]. Cross-entropy: CE = -log(0.7) = 0.357. With gamma = 2, the focal factor is (1 - 0.7)^2 = 0.09. Focal loss = 0.09 * 0.357 = 0.032. The model is fairly confident and correct, so focal loss reduces the penalty by about 91%.`,
        `Same setup, worse model. Model predicts [0.1, 0.5, 0.4]. Cross-entropy: CE = -log(0.1) = 2.303. Focal factor: (1 - 0.1)^2 = 0.81. Focal loss = 0.81 * 2.303 = 1.865. The model is wrong and uncertain, so the focal factor barely reduces the loss — this example still drives substantial gradient.`,
        `The detector ledger. 99,900 easy examples at p = 0.99: each has CE = 0.010, focal = (0.01)^2 * 0.010 = 0.000001. Total easy focal loss = 99,900 * 0.000001 = 0.10. 100 hard examples at p = 0.1: each has CE = 2.303, focal = (0.9)^2 * 2.303 = 1.865. Total hard focal loss = 100 * 1.865 = 186.5. The gradient share flips from 81% easy / 19% hard under cross-entropy to 0.05% easy / 99.95% hard under focal loss. No manual selection of hard examples was needed — the model's own confidence did the work.`,
      ],
    },
    {
      heading: 'Label smoothing interaction',
      paragraphs: [
        `Label smoothing (Szegedy et al. 2016) replaces a one-hot target [1, 0, 0] with a softened version like [0.9, 0.05, 0.05]. This prevents the model from being rewarded for pushing output probabilities to extremes, which improves calibration and generalization. The cross-entropy with smoothed labels becomes -0.9 * log(q_0) - 0.05 * log(q_1) - 0.05 * log(q_2), penalizing all outputs mildly instead of only the true class.`,
        `Combining label smoothing with focal loss requires care. Smoothed labels increase H(p), so the baseline loss is higher. Focal loss then modulates by (1 - p_t)^gamma, but p_t is now evaluated against the smoothed target rather than a hard one-hot. In practice, the interaction is usually benign: label smoothing prevents overconfidence while focal loss prevents easy-example dominance. But if gamma is high and labels are heavily smoothed, the model may receive weak gradients from both easy and hard examples, slowing convergence.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Lin et al. 2017, "Focal Loss for Dense Object Detection" (the RetinaNet paper), introduced the focal loss formula and demonstrated it on COCO. Shannon 1948, "A Mathematical Theory of Communication," defined information, entropy, and cross-entropy. Szegedy et al. 2016, "Rethinking the Inception Architecture," introduced label smoothing.`,
        `Study Softmax for the function that produces the probability distribution q consumed by cross-entropy. Study Activation Functions for the nonlinearities that shape network outputs before softmax. Study Gradient Descent for how cross-entropy gradients flow backward through the network. Study Entropy and Information for the full information-theoretic foundation: Shannon entropy, KL divergence, compression floors, and perplexity.`,
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        `Prerequisites: cross-entropy (how -log(p) penalizes wrong predictions), softmax (the function that turns logits into probabilities), and gradient descent (how loss gradients update parameters). Without these, the focal modulation factor has no anchor.`,
        `This topic unlocks: object detection architectures (RetinaNet, FCOS, DETR) that use focal loss as their training signal, imbalanced classification strategies beyond class weighting, and calibration analysis for post-training probability correction. The central transfer: any loss function can be modulated by a difficulty-aware factor, and the choice between smooth modulation (focal) and hard selection (OHEM) is a design decision about gradient stability.`,
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you compute -log(0.7) and explain why it is the cross-entropy for a correct prediction at 70% confidence?',
            'Can you explain why (1 - 0.99)^2 = 0.0001 silences a 99%-confident easy example under focal loss with gamma = 2?',
            'Can you state why MSE gradients vanish near 0 and 1 for classification while cross-entropy gradients grow?',
            'Can you name a scenario where focal loss hurts — specifically, when noisy labels make the hardest examples the worst ones to amplify?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Pick three examples: one easy (p = 0.95 for the true class), one moderate (p = 0.5), one hard (p = 0.05). Compute cross-entropy -log(p) for each. Then compute the focal factor (1 - p)^2 and the focal loss for each. Verify that the easy example loses over 99% of its weight while the hard example keeps about 90%. Run the animation to confirm your numbers match the loss curve.',
        'Then try gamma = 0 and gamma = 5. At gamma = 0 the three examples have equal modulation (all factors = 1). At gamma = 5, the easy example is suppressed by a factor of about 10^-7. Ask yourself: at what gamma does the effective training set become so small that gradient estimates become noisy?',
      ],
    },
  ],
};
