// Focal loss: when 99,900 easy examples shout louder than the 100 hard ones
// that matter, multiply every voice by (1−p)^γ — confidence becomes silence,
// and the gradient finally listens to the difficult cases.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'focal-loss',
  title: 'Focal Loss & Hard Examples',
  category: 'AI & ML',
  summary: 'Easy examples drown the gradient by sheer headcount — (1−p)^γ mutes the confident and amplifies the struggling.',
  controls: [
    { id: 'view', label: 'See', type: 'select', options: ['easy examples drown the loss', 'the (1−p)^γ fix'], defaultValue: 'easy examples drown the loss' },
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
    explanation: `Each easy background box costs almost nothing — cross-entropy −log(0.99) = 0.010, the small print of Entropy & Information. But 99,900 almost-nothings total ${easyTotal.toFixed(0)}, while the 100 genuinely hard objects (p = 0.1, loss 2.30 each) total only ${hardTotal.toFixed(0)}. Read the last column: 81% of the training signal comes from examples the model has ALREADY MASTERED. Every gradient step mostly polishes the trivial; the rare objects — the entire point of the detector — whisper from 19%. Death by a hundred thousand paper cuts.`,
    invariant: 'Total loss = per-example loss × count: a horde of tiny losses can outvote the few that matter.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'p assigned to the true class' }, y: { label: 'loss' } },
      series: [{ id: 'ce', label: 'cross-entropy', points: PS.map((p) => ({ x: p, y: ce(p) })) }],
      markers: [
        { id: 'mEasy', x: 0.99, y: ce(0.99), label: 'easy: 0.01 × 99,900' },
        { id: 'mHard', x: 0.1, y: ce(0.1), label: 'hard: 2.30 × 100' },
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
      markers: [{ id: 'mEasy', x: 0.99, y: focal(0.99, 2), label: 'easy, γ=2: ≈0' }],
    }),
    highlight: { active: ['g2'], visited: ['g0'], found: ['mEasy'] },
    explanation: 'FOCAL LOSS: multiply cross-entropy by (1−p)^γ — one factor, one new knob. When the model is already confident (p → 1), the factor (1−p)^γ collapses toward zero and CRUSHES the loss; when the model is struggling (p small), the factor stays near 1 and the loss survives almost intact. γ controls the ferocity: γ = 0 is plain cross-entropy; γ = 2 (the paper\'s choice) mutes a 99%-confident example by 10,000× while a struggling p = 0.1 example keeps 81% of its voice. The curves tell the story: every γ > 0 bends the right side of the curve down to the floor and leaves the left side standing.',
    invariant: 'Focal loss = (1−p)^γ · CE: damping grows with confidence, never with class.',
  };

  const g = 2;
  yield {
    state: matrixState({
      title: 'The same ledger, refereed by γ = 2',
      rows: [{ id: 'easy', label: '99,900 easy' }, { id: 'hard', label: '100 hard' }],
      columns: [{ id: 'damp', label: '(1−p)²' }, { id: 'total', label: 'total loss' }, { id: 'share', label: 'gradient share (%)' }],
      values: [
        [(1 - EASY.p) ** g, EASY.n * focal(EASY.p, g), (100 * EASY.n * focal(EASY.p, g)) / (EASY.n * focal(EASY.p, g) + HARD.n * focal(HARD.p, g))],
        [(1 - HARD.p) ** g, HARD.n * focal(HARD.p, g), (100 * HARD.n * focal(HARD.p, g)) / (EASY.n * focal(EASY.p, g) + HARD.n * focal(HARD.p, g))],
      ],
      format: (v) => (v < 0.005 ? v.toExponential(1) : v < 10 ? v.toFixed(2) : v.toFixed(1)),
    }),
    highlight: { found: ['hard:share'], removed: ['easy:share'] },
    explanation: 'The coup, in numbers. The easy horde\'s damping factor is (1−0.99)² = 0.0001: their collective roar of 1,004 drops to 0.10. The hard examples\' factor is (1−0.1)² = 0.81: their 230 barely dips to 187. The gradient share flips from 81/19 to 0.05/99.95 — the hundred examples that matter now steer essentially ALL of the learning, and nobody had to label which ones were hard. The loss function measures difficulty for free, per example, every step, automatically re-aiming as examples graduate from hard to easy.',
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
      format: (v) => ['', 'smooth (1−p)^γ damping', 'per example, continuous', 'train ONLY the worst k', 'per example, all-or-nothing', 'fixed multiplier per class', 'per class, blind to difficulty'][v],
    }),
    highlight: { active: ['focal:grain'], compare: ['ohem:how', 'weights:grain'] },
    explanation: 'Where it sits in the family: OHEM — Online Hard Example Mining — had the same instinct discretely (sort by loss, train on the worst k, ignore the rest); focal loss is its smooth, differentiable cousin. Class weights (Imbalanced Data) re-price by CLASS, blind to whether an individual example is easy. The 2017 RetinaNet paper (Lin et al., "Focal Loss for Dense Object Detection") used this one factor to make cheap one-stage detectors match expensive two-stage ones — a loss-function fix beating an architecture fix. One sharp caution before you bolt it onto everything: focal loss obsesses over whatever it cannot fit, and if your labels are NOISY, the unfittable examples are the mislabeled ones — γ cranks up the volume on your data\'s mistakes. Difficulty weighting assumes the difficulty is legitimate.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'easy examples drown the loss') yield* drown();
  else if (view === 'the (1−p)^γ fix') yield* fix();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `Why it exists`,
      paragraphs: [
        `Focal loss exists because some training sets are not merely imbalanced by class. They are imbalanced by difficulty. Dense object detection is the clean example. A detector may evaluate tens of thousands of candidate boxes in one image. Almost all are easy background: sky, wall, road, table, blank space. A tiny fraction contain objects, and an even smaller fraction contain objects the model currently finds hard. If ordinary cross-entropy sums every candidate, the gradient can be dominated by examples the model already understands.`,
        `The naive reaction is class weighting. If positives are rare, multiply positive loss by a larger number. That helps when the problem is mainly class frequency. It does not solve the harder pattern: easy negatives are numerous, hard negatives exist, easy positives exist, and hard positives are the ones you most need to learn. A fixed class multiplier cannot tell whether an individual example is already solved. It only knows the label.`,
        `Focal loss changes the question from "which class is this?" to "how confidently did the model handle this example?" It keeps the cross-entropy foundation but multiplies each example by a difficulty factor. Confident correct examples become quiet. Struggling examples remain loud. The method is simple, but the shift is important: the loss function starts allocating training attention dynamically, per example, as the model improves.`,
      ],
    },
    {
      heading: `The naive wall`,
      paragraphs: [
        `Cross-entropy for the true class is -log(p), where p is the model's assigned probability to the correct answer. A very wrong prediction with p = 0.1 pays about 2.30. A confident correct prediction with p = 0.99 pays about 0.010. One easy example hardly matters. The wall appears when there are 99,900 easy examples and 100 hard examples. The easy examples contribute 99,900 times 0.010, about 1,004 total loss. The hard examples contribute 100 times 2.30, about 230 total loss. The easy majority wins the gradient ledger.`,
        `That is a strange failure. Cross-entropy is doing exactly what it was asked to do: penalize wrong predictions much more than correct predictions. But the reduction over a giant batch or image turns many tiny losses into a large force. The optimizer spends most of its step polishing background boxes from 99 percent confidence to 99.1 percent confidence while the rare object cases remain undertrained.`,
        `Hard-example mining attacks the same wall by sorting examples by loss and training on the worst ones. That can work, but it is discrete and operationally awkward. Which k examples count? How often should the set change? Do you ignore every easy example completely? Focal loss gives a smooth answer: do not choose a hard set by hand; make every example weight itself by current confidence.`,
      ],
    },
    {
      heading: `Core insight: the focal factor`,
      paragraphs: [
        `Focal loss multiplies cross-entropy by (1 - p)^gamma. When gamma is 0, the factor is 1 and the loss is ordinary cross-entropy. When gamma is positive, the factor shrinks as p approaches 1. A confident correct example with p = 0.99 and gamma = 2 receives a multiplier of 0.0001. A hard example with p = 0.1 receives a multiplier of 0.81. The hard example keeps most of its loss; the easy example is almost silenced.`,
        `In the detector ledger, gamma = 2 changes the totals dramatically. The easy background group falls from roughly 1,004 total cross-entropy to about 0.10 focal loss. The hard group falls from roughly 230 to about 187. The share of training signal flips from easy-dominated to hard-dominated without an explicit rule that says "these examples are hard." The current model probability supplies that information every step.`,
        `Alpha weighting is often paired with focal loss. Alpha is a class-balancing multiplier; gamma is the focusing parameter. They solve different problems. Alpha says one class should count more. Gamma says confident examples should count less. In practice, alpha can help with positive-negative imbalance while gamma handles easy-hard imbalance inside and across those classes.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The mechanism works because it changes gradient allocation, not just reported loss values. Easy examples still flow through the model, but their contribution to parameter updates becomes tiny. Hard examples retain a large derivative because the focal factor is near one when p is low. As training progresses, an example that used to be hard becomes confident, its focal factor shrinks, and attention moves elsewhere. The curriculum updates itself.`,
        `This is especially useful in one-stage object detectors. Two-stage detectors first propose a smaller set of candidate regions, which reduces the easy-background flood. One-stage detectors classify dense grids of anchors directly, which is faster but creates a huge imbalance. Focal loss was the loss-function fix that let RetinaNet-style one-stage detection compete with two-stage approaches: keep dense detection, but stop easy anchors from owning the gradient.`,
        `The shape is also related to margin thinking. Focal loss does not merely ask whether an example is correct; it asks whether the model is confidently correct. A borderline correct example still receives attention. A solved example fades. This is why focal loss can improve rare-event recall and detection quality even when class weights alone are insufficient.`,
      ],
    },
    {
      heading: `How to use it`,
      paragraphs: [
        `Start by proving that the easy-example flood is real. Inspect per-example or per-anchor loss totals, not just average loss. If most of the loss comes from examples with high p for the true class, focal loss is a candidate. If the model is failing because all examples are noisy, labels are inconsistent, or the feature representation is weak, focal loss may make the wrong cases louder without solving the underlying problem.`,
        `Gamma is the central hyperparameter. The RetinaNet paper used gamma = 2 as a strong default, but the best value depends on label quality, class frequency, model capacity, and task risk. Low gamma behaves closer to cross-entropy. High gamma aggressively suppresses easy examples and can hurt calibration or stability. If alpha is used, tune it separately from gamma; do not treat class imbalance and difficulty imbalance as the same diagnosis.`,
        `Evaluate with metrics that reflect the reason you used focal loss. In detection, inspect average precision at relevant IoU thresholds, false positives per image, recall for small or rare objects, and class-specific performance. In binary rare-event classifiers, inspect precision-recall curves, recall at required precision, calibration, and performance on slices. A lower training loss is not enough; focal loss can reshape scores in ways that affect downstream thresholding.`,
      ],
    },
    {
      heading: `Where it is used`,
      paragraphs: [
        `Focal loss is best known for dense object detection, but the pattern appears anywhere easy negatives are overwhelming. Medical image segmentation often has large background regions and small lesions. Defect detection may have many normal patches and few subtle flaws. Fraud, abuse, and moderation systems may see huge volumes of obvious benign cases and a small number of hard positives. In each case, accuracy can look healthy while the valuable rare cases receive weak training pressure.`,
        `It is also used in multi-label classification, instance segmentation, and variants of segmentation loss where foreground regions are small. The important match is not the domain label; it is the loss ledger. If easy examples dominate because of count, and hard examples are genuinely informative, focal loss is a reasonable tool. If the hard examples are mostly annotation errors, duplicated records, adversarial edge cases outside the product scope, or unresolvable ambiguity, the same tool can overfit the mess.`,
      ],
    },
    {
      heading: `Failure modes`,
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
  ],
};
