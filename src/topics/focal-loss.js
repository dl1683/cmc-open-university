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
      heading: `What it is`,
      paragraphs: [
        `Focal loss is cross-entropy with a difficulty dial. Entropy & Information explains why cross-entropy is -log(p): a correct 99% prediction still pays about 0.010, while a struggling 10% prediction pays 2.30. That tiny easy-example tax is normally fine. In the detector demo, there are 99,900 easy background boxes and only 100 hard object boxes, so easy losses add up to about 1,004 and hard losses only to about 230. The model spends 81% of its training signal polishing examples it already handles.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Focal loss multiplies cross-entropy by (1 - p)^gamma. With gamma = 2, an easy p = 0.99 example gets damped by 0.0001, so the easy horde falls from 1,004 total loss to about 0.10. A hard p = 0.1 example keeps factor 0.81, so the hard total remains about 187. The gradient share flips from easy-dominated to almost entirely hard-example driven. Logistic Regression supplies the cross-entropy baseline; focal loss changes which examples get heard without manually naming them.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The extra compute is one subtraction, one power, and one multiply per example, negligible beside Convolution and backprop. There is no new state. The new hyperparameter is gamma, usually 2, and sometimes alpha class weighting is added when Imbalanced Data: When 99% Is One Class is also severe. Because gamma reshapes gradients continuously, it is smoother than hard-example mining, which sorts examples and trains only on the worst few.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `RetinaNet made focal loss famous because dense object detection creates enormous easy-background imbalance. The same pattern appears in medical segmentation, defect detection, fraud review, and rare-event classifiers. Precision, Recall & the Confusion Matrix usually reveals the pain first: accuracy looks high while recall on rare hard positives is poor. Picking a Threshold with Real Costs happens after training; focal loss changes the training signal before thresholding. That distinction matters: the loss teaches the model what to learn, while the threshold decides how to act on scores.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Focal loss is not the same as class weighting. It weights by difficulty, not label. That is powerful only if difficulty is legitimate. If labels are corrupted, focal loss will obsess over the impossible cases, so check Data Leakage & Contamination and mislabeled examples before raising gamma. Too high a gamma can silence easy examples so aggressively that calibration suffers. A clean rare-class problem may benefit; a messy label-noise problem may get worse.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Hyperparameter Search for tuning gamma and Regularization: L1 & L2 for another way to shape gradients without changing the model architecture. The core habit is to distinguish class imbalance, difficulty imbalance, and decision-threshold imbalance; focal loss solves only the middle one.`,
        `Before using it, inspect a batch-level loss ledger like the demo. Count how many easy examples are contributing small but numerous losses, and compare that total with the few hard examples. If the easy total does not dominate, focal loss may add complexity without solving a real problem.`,
        `The visualization also shows why the method is self-updating. An example that starts hard keeps most of its loss; once the model learns it and p rises, the damping factor automatically turns that example down. The focus moves as training moves. That is cleaner than maintaining a separate hard-example list, and safer than permanently upweighting a class when only some members of that class are actually difficult during training.`,
      ],
    },
  ],
};
