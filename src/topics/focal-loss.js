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
        `Focal loss is a tiny one-factor tweak to the standard cross-entropy loss that fixes a big problem: when you have vastly more easy examples than hard ones, the easy ones shout so loud that the gradient ignores the rare, difficult cases that matter most. The fix is simple — multiply cross-entropy by (1−p)^γ, where p is the model's confidence in the correct class and γ is a tuning parameter (usually 2) — and suddenly the confident, trivial examples fade to whispers while the struggling cases reclaim the training signal. Focal loss measures difficulty for free, per example, every step, without any manual labeling of which examples are hard.`,
        `The visualization shows the exact scenario where this matters: an object detector scanning 100,000 candidate boxes in an image, of which only about 100 contain actual objects. The remaining 99,900 are background — sky, grass, wall — that the model has already learned to ignore with 99% confidence. Cross-entropy accepts these confident-correct predictions happily with loss 0.010 each, which sounds trivial until you multiply by 99,900. Meanwhile the true objects (p = 0.1, loss 2.30 each) are what you actually care about, yet they contribute only 19% of the total gradient. The focal loss factory (1−p)² rescales this: the easy horde gets damped by 0.0001, their combined roar shrinks to almost nothing, and the hard examples — now with damping factor 0.81 — steer 99% of the learning.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with the standard cross-entropy loss for a single example: CE(p) = −log(p), where p is the probability assigned to the true class. A confident correct prediction (p = 0.99) pays a small tax (0.010); a wrong guess (p = 0.1) pays a steep penalty (2.30). This loss is good at encouraging confidence, but it treats every example the same. Focal loss multiplies this by the damping factor (1−p)^γ. When the model is already sure (p close to 1), the factor (1−p)^γ collapses toward zero and CRUSHES the loss to near silence. When the model is struggling (p small), the factor stays close to 1 and the loss is barely affected. The strength of the dampening is controlled by γ: at γ = 0, you have plain cross-entropy; at γ = 2 (the most common choice from the 2017 RetinaNet paper), a p = 0.99 example gets muted by 10,000× while a p = 0.1 example keeps 81% of its original voice.`,
        `In practice, you compute focal loss = (1−p)^γ · CE(p) for each example, then average or sum across your dataset. Backpropagation follows the chain rule as normal; the (1−p)^γ factor simply scales the gradient. The beauty is that this rescaling happens automatically for every example based on its own confidence — you never have to manually decide which examples are hard. An example becomes easier and easier as the model learns it; the damping factor relaxes correspondingly, and the gradient naturally shifts focus to the still-struggling cases. It is a self-adjusting difficulty weighting, learned by the loss function itself.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computational cost is negligible compared to cross-entropy: you compute (1−p)^γ (a single subtraction, one exponentiation) and multiply by the cross-entropy loss. On modern hardware with GPUs, this is a few cycles per example and is drowned out by the forward and backward passes. Storage is unchanged — you do not store anything extra. The only new hyperparameter is γ, which you set once (usually to 2) and rarely adjust. For small datasets or when you run out of hard examples (the model gets really good), you can reduce γ toward 0, which gradually reverts to plain cross-entropy and prevents loss from vanishing entirely. Unlike class weighting, which requires knowing your class imbalance ratio upfront, focal loss adapts to imbalance in difficulty without tuning — a huge practical win.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Focal loss rose to fame in 2017 when Lin et al. used it in RetinaNet, a one-stage object detector that matched the accuracy of expensive two-stage detectors (like Faster R-CNN) while running in real time. Object detection is the canonical use case: you propose tens of thousands of candidate boxes; the vast majority are negative (background) and easy to classify correctly; the few objects are what you care about. Without focal loss, the background horde drowns the object signal; with it, the balance flips and learning focuses on finding and localizing the rare positive boxes. The method has since been applied to instance segmentation, 3D object detection, panoptic segmentation, and any dense-prediction task with inherent class or example imbalance. Medical imaging, where a tiny nodule might be lost among millions of normal tissue pixels, is another natural home. Anomaly detection — finding rare defects in a sea of good parts — benefits from focal loss because anomalies are both rare and hard. Any imbalanced classification problem where you care more about the minority class can potentially benefit.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most common misconception is confusing focal loss with class weighting (Imbalanced Data: When 99% Is One Class). Class weights address CLASS imbalance — if your dataset is 90% negative and 10% positive, you upweight the positive class in the loss. Focal loss addresses DIFFICULTY imbalance — if your model finds 99,900 easy negatives but struggles with 100 rare positives, focal loss rescales by difficulty regardless of class. A task can have class imbalance, difficulty imbalance, or both; focal loss targets the second, so you might still need class weights for the first. Another trap: focal loss assumes the imbalance in difficulty is *legitimate*, not a symptom of data corruption. If your training set is full of mislabeled examples, focal loss will obsess over the unfittable ones — the noise — and amplify the learning signal from your errors. Noisy labels become noisier. If you suspect noisy data, clean first; apply focal loss only to clean labels. Finally, do not crank γ too high on small datasets — you can zero out the loss on easy examples so thoroughly that you stop making progress, and the model learns nothing. Use γ = 2 as your default and experiment only if needed.`,
        `A subtle point: focal loss does NOT work well when your imbalance comes from under-sampling or over-sampling the training data. If you artificially duplicate the hard examples, focal loss still sees them as hard and dampens them; you have not fooled it into thinking they are more common. For synthetic over-sampling, you might pair focal loss with other techniques like mixup or progressive sampling. And remember that focal loss is a gradient-shaper, not a threshold-setter: it does not change how you decide the final class prediction; it only changes how you learn.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Focal loss sits in a family of difficulty-weighting techniques. Online Hard Example Mining (OHEM) had the same intuition but implemented it discretely: sort examples by loss and train only on the worst k. Focal loss is the smooth, differentiable cousin. For the foundations, study Entropy & Information to understand why cross-entropy is −log(p) and why logarithms turn multiplication into addition (essential for understanding the math). Logistic Regression is where cross-entropy comes from; understanding the sigmoid and the log-odds perspective is crucial. If your problem involves rare classes, explore Imbalanced Data: When 99% Is One Class to see class weighting and other balancing tricks. In the neural network domain, Convolution is how object detectors build the features they classify, and Regularization: L1 & L2 covers other ways to shape the gradient. Finally, when you have multiple learning objectives competing — say, detection AND segmentation — look into multi-task learning and how focal loss compounds with other per-example rescalings.`,
      ],
    },
  ],
};

