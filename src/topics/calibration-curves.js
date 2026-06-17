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
      heading: `The problem calibration solves`,
      paragraphs: [
        `Calibration asks whether a model's probability numbers mean what they claim to mean. If a classifier says 90 percent confident on many similar cases, about 90 percent of those cases should be correct. If it says 60 percent, about 60 percent should be correct. A calibrated model is not perfect on every example. It is honest in aggregate.`,
        `This is different from accuracy, precision, recall, and AUC. A model can rank cases well and still attach exaggerated probabilities to them. For example, a spam filter might put real spam above real mail most of the time, so its ROC curve looks strong. But if its 95 percent confidence bucket is correct only 78 percent of the time, downstream systems that treat 95 percent as near certainty will make bad decisions. Calibration is about the meaning of the score, not only the ordering of examples.`,
        `Reliability diagrams make this visible. They group predictions by stated confidence, compute the empirical accuracy inside each group, and plot confidence against observed correctness. The diagonal is the ideal line. Points below the diagonal mean overconfidence: the model claims more certainty than the world supports. Points above the diagonal mean underconfidence: the model is better than it admits. Modern neural networks often have excellent discrimination and poor calibration, especially after aggressive training, distribution shift, or fine-tuning that rewards confident answers.`,
      ],
    },
    {
      heading: `The naive approach and its wall`,
      paragraphs: [
        `The naive approach is to trust the largest softmax probability as confidence. This is tempting because softmax outputs nonnegative numbers that sum to one. In a multiclass classifier, the top probability looks like a probability of being correct. In a language model, the probability of a token looks like a measure of belief. But softmax is only a normalization of logits. It does not guarantee that a 0.95 output will be correct 95 percent of the time.`,
        `The wall appears when probability drives an action. A medical triage system may send low-risk cases home. A fraud system may approve transactions automatically below a risk threshold. A model router may skip a more expensive model when the cheap model sounds confident. A self-driving stack may fuse object probabilities across sensors. In all of these systems, a miscalibrated score is not just a bad chart. It changes resource allocation and risk.`,
        `Ranking metrics cannot solve this wall by themselves. AUC says whether positives tend to score above negatives. It does not say whether 0.8 means 80 percent. Accuracy says how often the final prediction is correct after a threshold. It does not say whether the score before the threshold was usable. Calibration fills that missing layer between raw model scoring and decision-making.`,
      ],
    },
    {
      heading: `Core insight: confidence should mean frequency`,
      paragraphs: [
        `A reliability diagram starts with held-out predictions. For each example, record the model's stated confidence for the predicted class and whether that prediction was correct. Then divide the examples into bins, such as 50-60 percent, 60-70 percent, and so on. Inside each bin, compute two numbers: the average stated confidence and the fraction actually correct.`,
        `The demo uses five bins of twenty examples each. In the 50-60 percent bin, the average confidence is 55 percent and observed accuracy is 52 percent. That is close. In the 90-100 percent bin, the average confidence is 95 percent and observed accuracy is only 78 percent. That is a serious gap. The model may still be useful, but its high-confidence scores are not reliable probabilities.`,
        `Expected Calibration Error, or ECE, compresses the diagram into one number. For each bin, take the absolute difference between average confidence and observed accuracy. Weight that gap by the number of examples in the bin. Sum across bins. With equal-size bins, this is just the average gap. In the demo, the gaps are 3, 7, 11, 15, and 17 percentage points, giving an ECE of 0.106. A lower ECE is better, but the plot is still important because one number can hide where the problem lives.`,
      ],
    },
    {
      heading: `Temperature scaling`,
      paragraphs: [
        `Temperature scaling is a simple post-training calibration method. The model produces logits as usual. Before softmax converts them into probabilities, divide every logit by a positive scalar T. If T is greater than 1, the distribution becomes flatter and confidence decreases. If T is less than 1, the distribution becomes sharper and confidence increases. For overconfident neural networks, the fitted temperature is usually above 1.`,
        `The important property is monotonicity. Dividing every logit by the same positive number does not change which class has the largest logit. It does not change the order of examples by score. It does not change the ROC curve or AUC. It changes the probability values while preserving the model's decisions and rankings. That is why temperature scaling is such a clean repair when the model discriminates well but exaggerates confidence.`,
        `The correct workflow uses a validation set. Train the model on training data. Freeze it. Choose T on a calibration validation set by minimizing negative log likelihood or a calibration objective. Then evaluate once on the final test set. Do not choose T on the test set, because that leaks information from the report into the model selection process. Temperature scaling is cheap enough that it removes almost every excuse for leaving a high-stakes classifier uncalibrated, but it still needs honest data separation.`,
      ],
    },
    {
      heading: `Why calibration works and where it fails`,
      paragraphs: [
        `Calibration works because many models learn useful relative evidence but produce logits on the wrong scale. Cross-entropy training rewards pushing the correct class above alternatives. With separable training data, large models can keep increasing logit gaps even after classification accuracy has saturated. The rank ordering may remain useful, while the numeric confidence becomes too extreme. Temperature scaling corrects the global scale of those logit gaps.`,
        `That global correction is also its limitation. One scalar cannot fix every calibration problem. A model may be well calibrated for common classes and badly calibrated for rare classes. It may be calibrated on the validation distribution and unreliable under distribution shift. It may be overconfident on one demographic slice and underconfident on another. It may assign confident scores to inputs outside the training distribution. In those cases, a single temperature can improve the average diagram while leaving important failures hidden.`,
        `More flexible methods exist. Platt scaling fits a sigmoid mapping. Isotonic regression fits a monotone staircase. Classwise or vector scaling can adjust classes separately. Bayesian methods, ensembles, conformal prediction, and abstention systems address related uncertainty problems. The tradeoff is data hunger and overfitting risk. A flexible calibrator can memorize validation quirks if the calibration set is small. Temperature scaling is popular because it is simple, robust, and hard to overfit, not because it is the most expressive possible method.`,
      ],
    },
    {
      heading: `Where it is used`,
      paragraphs: [
        `Calibration matters anywhere a score is consumed as a probability. In medicine, it affects triage, second-opinion routing, and patient communication. In fraud and trust systems, it affects queue priority and automatic approval. In advertising and recommendations, calibrated click or conversion probabilities feed bidding, ranking, and expected value calculations. In search and question answering, confidence can decide whether to answer, abstain, retrieve more evidence, or escalate to a stronger model.`,
        `LLM systems need the same distinction, though they often hide it. A model can sound certain while being wrong. Token probabilities are not direct truth probabilities, and preference tuning can make verbal confidence less reliable. Still, calibration concepts show up in model routers, early-exit transformers, selective generation, verifier thresholds, and systems that teach models to say they do not know. The principle remains the same: if confidence controls compute, risk, or user trust, it must be measured against observed outcomes.`,
        `Calibration also matters in threshold design. Picking a Threshold with Real Costs assumes the score approximates a probability. If a false negative costs ten times a false positive, a clean decision rule can be derived only when the score has probabilistic meaning. If the model is overconfident, the threshold may look mathematically justified while being operationally wrong.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Treat calibration as a monitored property, not a one-time chart. Keep a held-out calibration set, report reliability diagrams by important slice, track ECE with the binning scheme, and alert when confidence buckets drift. A model can remain accurate while becoming less honest about its uncertainty, especially after data shift or fine-tuning.`,
        `When scores drive decisions, store the score, chosen threshold, observed outcome, slice metadata, model version, and calibrator version. That record lets teams ask whether a bad decision came from ranking quality, threshold choice, calibration drift, or missing outcome feedback. Without that ledger, calibration turns into a static report instead of an operational control.`,
      ],
    },
    {
      heading: `Pitfalls, tradeoffs, and study next`,
      paragraphs: [
        `Do not confuse calibration with correctness. A calibrated 70 percent forecast is still wrong three times out of ten. Do not confuse average calibration with subgroup calibration. A model can look good overall while failing on rare classes, shifted data, or high-stakes slices. Do not tune the calibrator on the final test set. Do not report only ECE without the binning scheme, because different bin choices can produce different summaries. Too few bins hide structure; too many bins produce noisy estimates.`,
        `There is also a privacy and security tradeoff. Rich confidence outputs can leak information. Membership inference and model inversion attacks often become easier when an API exposes detailed probability vectors rather than only labels. Calibration improves the usefulness of probabilities, but exposing useful probabilities may increase attack surface. Production systems need to decide who receives calibrated scores, at what precision, and under what monitoring.`,
        `Study Softmax and Temperature first, because it explains the logit scaling used by temperature calibration. Then study ROC Curves and AUC to separate ranking quality from probability quality. Precision, Recall, and the Confusion Matrix explains what happens after a threshold is chosen. Picking a Threshold with Real Costs shows why calibrated probabilities are operationally valuable. FTRL-Proximal Online CTR Case Study shows calibration in a production online-learning setting. Finally, study Uncertainty: Teaching Models to Say I Don't Know, Membership Inference, and Model Inversion to understand why confidence is both useful signal and potential liability.`,
      ],
    },
  ],
};
