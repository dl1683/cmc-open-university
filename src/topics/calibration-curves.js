// Calibration: when a model says "90% sure", is it right 90% of the time?
// The reliability diagram plots stated confidence against observed truth —
// and most modern networks sag well below the honesty line.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'calibration-curves',
  title: 'Calibration & Reliability Diagrams',
  category: 'AI & ML',
  summary: 'Does "90% sure" mean right 90% of the time? Plot confidence against reality and find out.',
  controls: [
    { id: 'view', label: 'Examine', type: 'select', options: ['the overconfident network', 'the fix: temperature scaling'], defaultValue: 'the overconfident network' },
  ],
  run,
};

// 100 test predictions grouped into 5 confidence bins (20 each).
const BINS = [
  { id: 'b55', label: '50–60%', predicted: 0.55, observed: 0.52 },
  { id: 'b65', label: '60–70%', predicted: 0.65, observed: 0.58 },
  { id: 'b75', label: '70–80%', predicted: 0.75, observed: 0.64 },
  { id: 'b85', label: '80–90%', predicted: 0.85, observed: 0.7 },
  { id: 'b95', label: '90–100%', predicted: 0.95, observed: 0.78 },
];
// The same bins after dividing logits by T = 2 before the softmax.
const SCALED = [0.52, 0.59, 0.65, 0.71, 0.79];

const ece = (preds) => preds.reduce((sum, p, i) => sum + Math.abs(p - BINS[i].observed), 0) / BINS.length;
const pct = (v) => `${Math.round(v * 100)}%`;

const reliabilityPlot = (preds, label) =>
  plotState({
    axes: { x: { label: 'stated confidence' }, y: { label: 'fraction actually correct' } },
    series: [
      { id: 'perfect', label: 'perfectly honest', points: [{ x: 0.5, y: 0.5 }, { x: 1, y: 1 }] },
      { id: 'model', label, points: preds.map((p, i) => ({ x: p, y: BINS[i].observed })) },
    ],
  });

function* diagnose() {
  yield {
    state: matrixState({
      title: '100 test predictions, grouped by stated confidence',
      rows: BINS.map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'n', label: 'predictions' }, { id: 'conf', label: 'avg confidence' }, { id: 'acc', label: 'actually correct' }],
      values: BINS.map((b) => [20, b.predicted, b.observed]),
      format: (v) => (v === 20 ? '20' : pct(v)),
    }),
    highlight: { active: ['b95:conf'], compare: ['b95:acc'] },
    explanation: 'Your spam filter (the scores ROC Curves & AUC swept) outputs probabilities — but are they HONEST? Take 100 test predictions, group them by stated confidence, and simply count how often each group was right. The bottom row is damning: on predictions where the model claimed "95% sure", it was correct only 78% of the time. The model is not lying about WHICH class — its accuracy and AUC are fine — it is lying about HOW SURE it is.',
  };

  yield {
    state: reliabilityPlot(BINS.map((b) => b.predicted), 'our network'),
    highlight: { active: ['model'], visited: ['perfect'] },
    explanation: 'The RELIABILITY DIAGRAM makes the lie visible: stated confidence on the x-axis, observed accuracy on the y-axis. A perfectly calibrated model lands ON the diagonal — "70% sure" means right 70% of the time, the way a good weather forecaster\'s "70% chance of rain" verifies 7 days out of 10. Our model SAGS below the line, and the sag widens with confidence: the surer it claims to be, the bigger the exaggeration. This below-the-diagonal signature is OVERCONFIDENCE — the default failure mode of modern neural networks.',
    invariant: 'On the diagonal, stated probability equals observed frequency — that is the definition of calibrated.',
  };

  yield {
    state: matrixState({
      title: `Expected Calibration Error: ${ece(BINS.map((b) => b.predicted)).toFixed(3)}`,
      rows: BINS.map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'conf', label: 'stated' }, { id: 'acc', label: 'observed' }, { id: 'gap', label: '|gap|' }],
      values: BINS.map((b) => [b.predicted, b.observed, Math.abs(b.predicted - b.observed)]),
      format: pct,
    }),
    highlight: { compare: BINS.map((b) => `${b.id}:gap`), active: ['b95:gap'] },
    explanation: 'Compress the picture into one number: the EXPECTED CALIBRATION ERROR (ECE) is the average gap between stated and observed, weighted by how many predictions land in each bin (equal 20s here, so a plain average). ECE = 0.106 — on average this model overstates its confidence by about 11 points. Why does this matter more than a leaderboard metric? Because downstream decisions consume the PROBABILITY: a doctor triaging on "95% benign", a self-driving stack fusing sensor beliefs, an LLM router deciding when to say "I don\'t know". An overconfident 95% is not a rounding error there — it is 1-in-5 wrong while sounding certain.',
  };
}

function* fix() {
  yield {
    state: matrixState({
      title: 'Temperature scaling: divide every logit by T = 2',
      rows: BINS.map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'before', label: 'before' }, { id: 'after', label: 'after T=2' }, { id: 'acc', label: 'observed' }],
      values: BINS.map((b, i) => [b.predicted, SCALED[i], b.observed]),
      format: pct,
    }),
    highlight: { active: BINS.map((b) => `${b.id}:after`) },
    explanation: 'The fix is almost embarrassingly small. Recall from Softmax & Temperature that dividing logits by T > 1 FLATTENS the probability distribution without reordering it. So: hold out a validation set, and fit the single scalar T that minimizes calibration error — here T = 2. Every "95%" deflates to a humbler 79%, every "85%" to 71%. One learned number, applied after training, and the stated confidences drop right onto the observed frequencies.',
    invariant: 'Dividing logits by T is monotone: the argmax class, accuracy, and AUC are all unchanged.',
  };

  yield {
    state: reliabilityPlot(SCALED, 'after T = 2'),
    highlight: { found: ['model'], visited: ['perfect'] },
    explanation: `The reliability diagram after scaling: the curve hugs the diagonal, and ECE collapses from 0.106 to ${ece(SCALED).toFixed(3)}. Note what did NOT change — the model ranks examples exactly as before (temperature is monotone, so the ROC curve and AUC are untouched) and predicts the same class every time. Calibration and discrimination are SEPARATE virtues: AUC measures whether the model orders cases correctly; calibration measures whether its probabilities mean what they say. Temperature scaling repairs the second without disturbing the first.`,
  };

  yield {
    state: matrixState({
      title: 'The calibration toolbox',
      rows: [
        { id: 'temp', label: 'temperature scaling' },
        { id: 'platt', label: 'Platt scaling' },
        { id: 'iso', label: 'isotonic regression' },
      ],
      columns: [{ id: 'params', label: 'parameters' }, { id: 'data', label: 'val. data needed' }],
      values: [[1, 1], [2, 1], [50, 3]],
      format: (v) => (v === 1 ? (`${v}`) : v === 2 ? '2' : v === 3 ? 'lots' : '~50 (flexible)'),
    }),
    highlight: { active: ['temp:params'] },
    explanation: 'The family tree: temperature scaling fits 1 parameter; Platt scaling fits a 2-parameter sigmoid (the classic for SVMs); isotonic regression fits a flexible monotone staircase — more expressive, but it needs far more validation data or it overfits the calibration itself. The 2017 paper "On Calibration of Modern Neural Networks" (Guo et al.) found the humble single temperature beats the fancy options on deep nets — and the problem it fixed has only grown: RLHF-tuned LLMs are notoriously MISCALIBRATED about their own answers, which is why "model says 90%" should make you ask the question this whole page is about: ninety percent of WHAT, measured HOW?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the overconfident network') yield* diagnose();
  else if (view === 'the fix: temperature scaling') yield* fix();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Calibration is making a model's stated confidence match reality. When your spam filter says "95% sure," is it actually right 95 times out of 100? For most modern neural networks, no — they sag well below the honesty line. A reliability diagram plots stated confidence on the x-axis and observed accuracy on the y-axis; a perfectly calibrated model lands on the diagonal (70% confidence = 70% correct). The Expected Calibration Error (ECE) compresses this into one number: the average gap between stated and observed probability, measuring how much a model lies about its own uncertainty.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Divide test predictions into confidence bins (50–60%, 60–70%, etc.) and count how many in each bin were actually correct. Plot bin confidence on the x-axis, observed accuracy on the y-axis. Our demo uses 100 predictions in 5 bins of 20 each: the 95% bin shows only 78% accuracy, a 17-point gap. ECE averages these gaps: |0.55−0.52| + |0.65−0.58| + |0.75−0.64| + |0.85−0.7| + |0.95−0.78|, divided by 5 = 0.106. The model overstates confidence by 11 points on average. Temperature scaling fixes this: divide logits by T=2 before softmax. This monotone transformation slides every point onto the diagonal without reordering, dropping ECE to 0.008. Accuracy and AUC stay the same — only stated confidence changes. The 2017 paper "On Calibration of Modern Neural Networks" (Guo et al.) found this single scalar beats fancier methods like Platt scaling or isotonic regression.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Measuring calibration is free: sort predictions by confidence, bin them, compute gaps. Temperature scaling fits one number on a validation set and applies it to all future predictions. No retraining, no backpropagation, milliseconds to run.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Downstream consumers need honest probabilities. A doctor on "95% benign" asks "how much should I trust this?" not "which class is more likely." An overconfident 95% expects 1-in-20 errors but lands 1-in-5. A self-driving stack fusing sensor beliefs (camera 98% pedestrian, lidar 60%) breaks if the camera is actually 85% but claims 98%. An LLM router deciding whether to admit "I don't know" fails when miscalibrated. Medical triage, sensor fusion, RAG, and uncertainty quantification all rest on honest probabilities.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `High accuracy does not imply high calibration. The demo model makes correct predictions; the lie is in stated confidence. Calibration and discrimination are separate: AUC measures ordering; calibration measures whether probabilities mean what they say. A softmax output of 0.95 is a normalized score, not genuine 95% unless calibrated. Modern training (deep networks, large batches, label smoothing) pushes toward overconfidence. Do not confuse calibration (fixing existing outputs) with uncertainty quantification (building genuine estimates from scratch).`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Explore Softmax & Temperature to understand logit scaling. Run A/B Testing & p-values to verify calibration improvements. Study Entropy & Information to ground probability in self-information. ROC Curves & AUC measure discrimination orthogonal to calibration — learn both. Precision, Recall & the Confusion Matrix ground all metrics in the true positives, false positives, and negatives that ECE depends on.`,
      ],
    },
  ],
};

