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
        `Calibration asks whether a model's probabilities mean what they say. If a classifier says 90% confident on 100 similar cases, about 90 should be correct. Calibration & Reliability Diagrams plots stated confidence on the x-axis and observed accuracy on the y-axis. The diagonal is honesty. This is separate from discrimination: ROC Curves & AUC can be strong even when probabilities are exaggerated. The demo's network ranks reasonably, but its high-confidence bins sit far below the diagonal. That separation is the central lesson of this entire page.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization groups 100 test predictions into five bins of 20. In the 50-60% bin, average stated confidence is 55% and observed accuracy is 52%. The lie grows with confidence: the 90-100% bin claims 95% but is correct only 78%. Expected Calibration Error averages the absolute gaps, weighted by bin size. Here the gaps are 3, 7, 11, 15, and 17 points, so ECE is 0.106.`,
        `Temperature scaling is the one-parameter repair shown in the second view. Divide every logit by T = 2 before Softmax & Temperature turns logits into probabilities. Because division by a positive constant is monotone, the top class, ranking, and AUC do not change. The confidences deflate to 52%, 59%, 65%, 71%, and 79%, almost exactly matching observed accuracies, and ECE falls to 0.008. You fit T on a validation set, not on the final test set.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Measuring calibration is linear in the number of predictions after you choose bins. Temperature scaling fits one scalar, so it is cheap: no retraining of the base model, no new features, and almost no inference overhead. Platt scaling fits a two-parameter sigmoid. Isotonic regression fits a flexible monotone staircase, which can work but needs more validation data or it overfits the calibration step itself. Cross-Validation & Honest Evaluation supplies the held-out discipline. In practice, teams keep a calibration set separate from both training and final testing, because choosing T on the same examples used for the report would make the report optimistic.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Calibration matters whenever a probability drives an action. Picking a Threshold with Real Costs can use a closed-form cutoff only if probabilities are honest. Medical triage, fraud queues, sensor fusion, recommender abstention, model routers, and ad-click ranking all consume confidence. FTRL-Proximal Online CTR Case Study shows why calibration is part of the production learner, not a chart added after the fact. Uncertainty: Teaching Models to Say "I Don't Know" goes further by separating different kinds of doubt, but even a simple classifier must first make its stated probabilities match observed frequencies. A well-calibrated model can still be wrong on an individual case; calibration is a population promise, not a personal guarantee.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `High accuracy does not imply good calibration. A model can rank cases well, classify most cases correctly, and still overstate confidence by 15 points. Precision, Recall & the Confusion Matrix counts decisions after a threshold; calibration checks the score before the threshold. Do not trust a softmax number just because it sums to one. Do not tune temperature on the test set. Watch binning choices too: too few bins hide structure, too many bins make noisy estimates. A/B Testing & p-values can verify whether a calibration change improves downstream decisions, not just the diagram.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Softmax & Temperature for the logit-scaling mechanism, ROC Curves & AUC for discrimination, FTRL-Proximal Online CTR Case Study for calibrated probabilities in online ads, and Picking a Threshold with Real Costs for why calibrated probabilities make deployment arithmetic possible. Early-Exit Transformer Layer Skipping is a modern LLM serving case where calibrated confidence decides how much compute a token receives. Then use Precision, Recall & the Confusion Matrix to see how calibrated scores become concrete decisions, and study Membership Inference plus Model Inversion to see why rich confidence outputs can also become privacy attack signal.`,
      ],
    },
  ],
};
