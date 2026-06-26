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
        'Read the tables as a gradient ledger. Each row has a per-example loss, a count, and a total contribution to the update. The key question is not which examples exist, but which examples get enough weight to steer learning.',
        'The curve view shows the same idea continuously. Plain cross-entropy still charges easy correct examples a tiny amount, and a huge number of tiny charges can dominate. Focal loss bends the confident side of the curve down so solved examples become quiet.',
        {type: 'callout', text: 'Focal loss is difficulty-aware weighting: the label chooses the target, but model confidence chooses how much the example can steer the update.'},
        {type: 'image', src: './assets/gifs/focal-loss.gif', alt: 'Animated walkthrough of the focal loss visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Focal loss exists because some training problems are imbalanced by difficulty, not just by class. Dense object detectors may evaluate tens of thousands of candidate boxes per image. Most are easy background, while the valuable object boxes are rare and often harder.',
        'Ordinary cross-entropy treats every candidate as part of the same sum. A single easy background box contributes little, but a crowd of easy boxes can dominate the total gradient. The model can spend too much learning capacity polishing cases it already gets right.',
        'The goal is to make training attention follow current difficulty. A solved example should still be checked, but it should not speak as loudly as an example the model is failing. Focal loss gives each example that dynamic volume control.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is class weighting. If positive boxes are rare, multiply positive examples by a larger constant and negative examples by a smaller one. That helps when the main problem is label frequency.',
        'But class weighting is blind to difficulty inside each class. There are easy positives, hard positives, easy negatives, and hard negatives. A fixed class multiplier cannot know whether this specific example is already solved.',
      ],
    },
 




   {
      heading: 'The wall',
      paragraphs: [
        'Cross-entropy for the true class is -log(p), where p is the probability assigned to the correct label. At p = 0.99, the loss is about 0.010. At p = 0.1, the loss is about 2.30.',
        'The wall appears when counts multiply those losses. In the animation, 99,900 easy examples at p = 0.99 contribute about 1,004 total loss, while 100 hard examples at p = 0.1 contribute about 230. The optimizer mostly hears examples that are already correct.',
        'Hard-example mining attacks this by selecting the worst examples. That can work, but it introduces sorting, cutoffs, and all-or-nothing inclusion. Focal loss keeps all examples while smoothly reducing the weight of confident ones.',
      ],
  

  },
    {
      heading: 'The core insight',
      paragraphs: [
        'Focal loss multiplies cross-entropy by (1 - p)^gamma. When gamma is 0, the factor is 1 and the loss is ordinary cross-entropy. When gamma is positive, the factor shrinks quickly as p approaches 1.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1708.02002/assets/x0.png', alt: 'Focal loss curves showing easy examples down-weighted as gamma increases', caption: 'The focal loss paper plots cross-entropy against focal loss for several gamma values, making the easy-example damping visible. Source: Lin et al., Focal Loss for Dense Object Detection, ar5iv.'},
        'With gamma = 2, an easy correct example at p = 0.99 gets a multiplier of 0.0001. A hard example at p = 0.1 gets a multiplier of 0.81. The hard example keeps most of its training signal while the solved example nearly disappears.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each example, compute the ordinary cross-entropy for the correct class. Then compute the modulating factor from the model confidence on that same correct class. Multiply the two values and reduce over the batch or anchors as usual.',
        'The effect updates during training. An example that starts hard has a low p and receives a large weight. Once the model learns it, p rises, the focal factor falls, and the example stops dominating future updates.',
        'Alpha weighting is often added beside gamma. Alpha handles class balance, while gamma handles easy-hard balance. Keeping those roles separate prevents a common mistake: using focal loss to solve a problem that is really a class-prior or threshold problem.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Focal loss works because it reallocates gradient mass toward examples with low confidence on the correct class. It does not need a separate hard-example label. The model probability supplies a difficulty estimate at every step.',
        'This is a strong fit for one-stage detectors. They keep dense anchor classification for speed, but dense anchors create a flood of easy background. Focal loss lets the detector keep the dense architecture while stopping easy anchors from owning the objective.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1708.02002/assets/x2.png', alt: 'RetinaNet architecture with feature pyramid and classification and box subnetworks', caption: 'RetinaNet applies focal loss to dense anchors across a feature pyramid, where easy background examples are abundant. Source: Lin et al., Focal Loss for Dense Object Detection, ar5iv.'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
 





       'Focal loss adds little asymptotic cost over cross-entropy. The model already computed the logits and probabilities; focal loss adds a scalar factor and an exponentiation per example. The expensive part remains the network forward and backward pass.',
        'The practical complexity is hyperparameter tuning. Gamma controls how aggressively easy examples are suppressed, and alpha may control class balance. Too little focusing behaves like cross-entropy; too much can shrink the effective batch to a small, noisy set of hard cases.',
        'It also changes score behavior. Because focal loss is not optimized purely for probability calibration, predicted probabilities may need post-training calibration. Detection metrics can improve while raw probabilities become less reliable as probabilities.',
      ],
  

  },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The original use was RetinaNet-style dense object detection. Focal loss helped one-stage detectors compete with two-stage detectors by handling the background anchor flood. The use case matched the loss perfectly: many easy negatives, few hard positives, and a need for fast dense prediction.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1708.02002/assets/x1.png', alt: 'RetinaNet speed and COCO AP comparison chart', caption: 'The focal loss paper shows RetinaNet moving the speed-accuracy frontier for one-stage detection. Source: Lin et al., Focal Loss for Dense Object Detection, ar5iv.'},
        'The same pattern appears in medical segmentation, defect detection, fraud screening, abuse detection, and moderation. The domain is secondary. The real test is whether easy examples dominate the ledger while clean hard examples carry the value.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Focal loss fails when the hard examples are hard for bad reasons. If the high-loss cases are mislabeled, ambiguous, duplicated, corrupted, or outside the intended distribution, a larger gamma can make the model chase noise. Inspect hard examples before treating them as precious signal.',
        'It also fails when the deployment problem is threshold choice rather than training attention. Focal loss changes how the model learns; it does not pick the operating point. Precision, recall, cost-sensitive thresholds, and calibration still need separate evaluation.',
        'Finally, focal loss is not always better than cross-entropy. Balanced tasks with clean labels and no easy-example flood may not benefit. In those cases, the extra focusing can slow convergence or hurt probability quality without improving the metric that matters.',
      ],
    },    {
      heading: 'Worked example',
      paragraphs: [
        'Take one easy example with p = 0.99 for the correct class. Cross-entropy is -log(0.99), about 0.010. With gamma = 2, the focal factor is (1 - 0.99)^2 = 0.0001, so the focal loss is about 0.000001.',
        'Now take one hard example with p = 0.1. Cross-entropy is -log(0.1), about 2.303. The focal factor is (1 - 0.1)^2 = 0.81, so the focal loss is about 1.865.',
        'Multiply by the detector counts. 99,900 easy examples contribute about 0.10 total focal loss, while 100 hard examples contribute about 186.5. The ledger flips from easy-dominated under cross-entropy to hard-dominated under focal loss.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Lin et al., "Focal Loss for Dense Object Detection," for the RetinaNet result, the formula, and the gamma experiments. Review Shannon, "A Mathematical Theory of Communication," for the information view behind -log(p). Read Szegedy et al., "Rethinking the Inception Architecture," if you want the label-smoothing contrast.',
        'Study cross-entropy before focal loss, then precision and recall for the rare-case metrics it is meant to improve. Study imbalanced data to separate class weighting from difficulty weighting. Then compare focal loss with online hard-example mining, Dice loss, class-balanced loss, and calibration diagrams.',
      ],
    },
  ],
};
