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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The first, "the overconfident network," takes 100 test predictions from a classifier, groups them into five confidence bins, and compares stated confidence against observed accuracy. You will see a table of bins, then a reliability diagram where the diagonal is perfection, then the ECE calculation. The second view, "the fix: temperature scaling," shows the same bins after dividing logits by T = 2, then replots the reliability diagram to show the improvement.',
        {type: 'callout', text: 'A confidence score is useful only when many predictions with that score are right about that often.'},
        'Active highlights mark the current bin or metric under examination. Visited markers show data already processed. Found markers indicate a result that has been confirmed. At each frame, notice two things: how far the model\'s dot falls below the diagonal (the size of the lie), and whether the gap grows as confidence increases (a signature of systematic overconfidence).',
        {type: 'image', src: './assets/gifs/calibration-curves.gif', alt: 'Animated walkthrough of the calibration curves visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A classifier outputs a number between 0 and 1 for each prediction. Most people treat that number as a probability: "the model is 90% sure this is spam." Calibration asks whether that interpretation is justified. Specifically, if you collect every prediction where the model said "90% confident," were about 90% of those predictions actually correct? If only 72% were correct, the model is overconfident. The number 0.9 does not mean what it appears to mean.',
        'This matters because other metrics do not catch it. A model can have high accuracy (it usually picks the right class), strong AUC (it ranks positives above negatives), and still produce meaningless probability scores. A spam filter might correctly rank spam above non-spam 98% of the time, but its "95% confident" predictions might be right only 78% of the time. If a downstream system uses that 95% to skip human review, it will make costly mistakes that the AUC number never warned about.',
        'A reliability diagram is the tool that makes calibration visible. Group predictions by stated confidence into bins (50-60%, 60-70%, etc.). For each bin, compute the fraction that were actually correct. Plot stated confidence on the x-axis and observed accuracy on the y-axis. A perfectly calibrated model traces the diagonal. Points below the diagonal mean overconfidence. Points above mean underconfidence. Modern deep networks almost always sag below the diagonal, especially at high confidence levels.',
        {type: 'image', src: 'https://scikit-learn.org/stable/_images/sphx_glr_plot_calibration_curve_001.png', alt: 'Reliability diagram comparing predicted probability with observed positive fraction', caption: 'A reliability diagram makes calibration visible by comparing stated probability with observed frequency. Source: scikit-learn documentation, https://scikit-learn.org/stable/auto_examples/calibration/plot_calibration_curve.html.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is to trust the softmax output directly. Softmax takes raw logits (unbounded real numbers) and converts them into non-negative values that sum to one. The largest value looks like a probability of being correct. Since the numbers sum to one and sit in [0,1], they feel like probabilities, and many tutorials treat them that way without qualification.',
        'This works reasonably well for simple models on clean data. Logistic regression, for instance, is often well-calibrated out of the box because its training objective (log loss) directly penalizes miscalibrated probabilities, and the model has limited capacity to overfit. Small decision trees and naive Bayes classifiers also tend to produce scores whose scale roughly matches empirical frequency, at least on the training distribution.',
        'The approach starts breaking with deep networks. A ResNet or transformer has enough capacity to push logits far apart even after classification accuracy saturates. Cross-entropy loss rewards making the correct logit larger than the alternatives, but it does not penalize making it too large. With enough parameters and enough training, the model drives logit gaps wider than the evidence warrants. The softmax output converges toward 0 or 1, producing extreme confidences that no longer match observed correctness rates.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall hits when a miscalibrated confidence score drives a real-world decision. A medical triage system sends patients home when the model says "95% benign." A fraud detector auto-approves transactions below a risk threshold. A model router skips the expensive large model when the cheap model sounds confident. In each case, the system treats the probability as a literal statement about risk, not just a ranking signal. If 95% actually means 78%, the system is taking risks it does not know about.',
        'Ranking metrics cannot see this wall. AUC measures whether positive examples tend to score higher than negative ones. It says nothing about whether 0.85 means 85%. Accuracy measures how often the top prediction is correct. It says nothing about whether the attached confidence is truthful. You can have AUC = 0.99 and accuracy = 96% while the model\'s stated probabilities are wildly wrong. Calibration is a separate axis of quality that ranking and classification metrics do not measure.',
        'The wall is also invisible during standard model evaluation. A team trains a model, reports accuracy and F1 on a test set, and ships it. Nobody plots the reliability diagram. Nobody checks whether the confidence scores mean what they say. The model works fine as a ranker, but the moment someone writes a threshold rule like "if confidence > 0.9, skip review," they are implicitly trusting calibration that was never verified.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that you can measure calibration error with a simple binning procedure and fix it with a single learned parameter, without retraining the model or changing its predictions. The reliability diagram and ECE (Expected Calibration Error) are the measurement. Temperature scaling is the fix. Together, they close the gap between what the model says and what it means.',
        'ECE works like this: take a held-out set of N predictions. Sort them into B bins by stated confidence. For each bin b, compute the average confidence (the mean of the model\'s stated probabilities in that bin) and the accuracy (the fraction of predictions in that bin that were correct). ECE is the weighted average of the absolute gaps: ECE = sum over all bins of (n_b / N) * |accuracy_b - confidence_b|. With equal-size bins, this simplifies to a plain average of the gaps.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Cumulative_vs_normal_histogram.svg', alt: 'Ordinary and cumulative histograms for a normal sample', caption: 'Calibration bins are histograms over model confidence, so bin choice changes what the summary exposes or hides. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cumulative_vs_normal_histogram.svg.'},
        'Temperature scaling fixes overconfidence by dividing every logit by a positive scalar T before the softmax. If T > 1, the softmax distribution flattens: high probabilities decrease, low probabilities increase. If T < 1, the distribution sharpens. The key property is monotonicity: dividing all logits by the same positive constant does not change which class has the largest logit. So the model\'s predictions, rankings, accuracy, and AUC are all unchanged. Only the probability values change. You fit T on a validation set by minimizing negative log-likelihood or ECE, then apply it at inference time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a trained model. Freeze all weights. Collect predictions on a held-out calibration set (not the test set). For each example, record the logit vector and the true label. Introduce a single scalar parameter T, initialized to 1.0. For each example, compute softmax(logits / T) instead of softmax(logits). Optimize T to minimize negative log-likelihood on the calibration set. This is a one-dimensional convex optimization problem; gradient descent, grid search, or scipy.optimize.minimize_scalar all work.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Logistic-curve.svg', alt: 'Logistic curve rising smoothly from zero toward one', caption: 'Temperature and sigmoid-style calibrators reshape score scale without changing the underlying evidence order. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Logistic-curve.svg.'},
        'Once T is fitted, apply it at inference: for every new input, compute logits as usual, divide by T, then apply softmax. The resulting probabilities will be closer to the diagonal on the reliability diagram. The model predicts the same classes in the same order. The only thing that changes is the numeric confidence attached to each prediction.',
        'Alternative calibration methods exist along a complexity spectrum. Platt scaling fits a two-parameter sigmoid: P(correct) = 1 / (1 + exp(a * logit + b)). It was designed for SVMs and works when the relationship between logit and true probability is roughly sigmoidal. Isotonic regression fits a non-parametric monotone function: it can capture any shape, but it needs more validation data to avoid overfitting the calibration mapping itself. Guo et al. (2017) found that temperature scaling, with just one parameter, matched or beat these more flexible methods on modern deep networks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Temperature scaling works because modern neural networks typically learn a good rank ordering of examples but produce logits on the wrong scale. Cross-entropy training rewards making the correct-class logit larger than the others. With enough capacity and enough epochs, the model can push logit gaps far beyond what is needed for correct classification. The softmax converts these inflated gaps into probabilities near 0 and 1, even when the true uncertainty is much higher.',
        'Dividing by T > 1 shrinks all logit gaps uniformly. If the model\'s ranking is good (logits are ordered correctly), then the ranking survives division by any positive constant. What changes is the spread: softmax(z/T) with T > 1 produces a flatter distribution than softmax(z). The probabilities move away from the extremes and toward the center. For a model that is overconfident everywhere by roughly the same factor, one scalar is enough to correct the entire probability surface.',
        'The correctness argument is simple: let z_1 > z_2 > ... > z_k be the logits for k classes. After dividing by T > 0, we get z_1/T > z_2/T > ... > z_k/T. The ordering is preserved. The argmax is preserved. Any metric that depends only on the ordering of scores (AUC, rank correlation, precision-recall at any threshold on the raw logits) is unchanged. What changes is the softmax output, which now assigns less extreme probabilities. The ECE drops because those new probabilities better match observed frequencies.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Temperature scaling adds negligible cost. Fitting T requires one forward pass over the calibration set to collect logits, then a one-dimensional optimization. With a grid search over T in [0.1, 10] at 0.01 resolution, you evaluate 1000 candidates, each requiring a vectorized softmax and an NLL computation. On a calibration set of 5,000 examples, the entire process finishes in under a second on a laptop CPU. The memory cost is storing the logit matrix: N examples times K classes times 4 bytes per float.',
        'At inference time, the cost is one scalar division per logit, which is lost in the noise of any real model forward pass. There is no additional learned layer, no additional memory, no change to the model architecture. The T value can be baked into the final layer bias if desired, though most implementations just keep it as a post-processing constant.',
        'The practical cost that matters is the need for a clean calibration set. You cannot use the training set (the model has memorized it) or the test set (you would leak evaluation data into the model). You need a held-out validation split that is representative of the deployment distribution. For small datasets, this means giving up some training data. For shifting distributions, it means periodically refreshing the calibration set and refitting T. The one-parameter fit is cheap; the data governance around it is the real operational cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Medical decision support systems consume calibrated probabilities directly. A pathology model that says "92% malignant" informs whether a biopsy gets rushed or queued. If 92% actually means 75%, the queue priorities are wrong. The Guo et al. (2017) paper showed that even well-known architectures like ResNet and DenseNet are badly miscalibrated out of the box, which matters immediately in any clinical deployment where probability drives triage.',
        'Ad-tech and recommendation systems depend on calibrated click-through-rate (CTR) predictions. In a second-price auction, a bidder computes expected value as P(click) times value-per-click. If P(click) is overconfident, the bidder overpays. Google\'s ad prediction system (McMahan et al., 2013) explicitly monitors and corrects calibration because even small biases at billions of impressions per day translate to large revenue misallocations.',
        'LLM routing and selective generation use confidence to decide when a cheap model is good enough versus when to call a more expensive one. If the cheap model\'s token probabilities are overconfident, the router will skip the expensive model too often, producing worse answers than a simpler always-use-the-big-model policy. Calibration is the mechanism that makes cost-quality tradeoffs in model cascades actually work as intended.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Temperature scaling applies one correction globally. If the model is overconfident on common classes and underconfident on rare ones, a single T averages over both failure modes. The reliability diagram may look good in aggregate while individual classes remain badly calibrated. Class-conditional or group-wise calibration requires more parameters (vector scaling, class-specific temperatures), which in turn needs more calibration data to fit reliably.',
        'Distribution shift breaks calibration guarantees. A model calibrated on hospital A\'s patient population may be miscalibrated when deployed at hospital B. The calibration set must be representative of the deployment distribution, and when that distribution drifts, T becomes stale. There is no alarm bell built into temperature scaling itself; you need external monitoring (tracking ECE over rolling windows) to detect when recalibration is needed.',
        'Calibration also does not fix a model that ranks examples badly. If the model cannot distinguish positive from negative cases (low AUC), no amount of temperature scaling will produce useful probabilities. Temperature scaling is a post-hoc correction for the scale of logits, not for the quality of learned features. A model with bad discrimination and perfect calibration would give you honest probabilities that are all near the base rate, which is correct but useless.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 3-class classifier (cat, dog, bird) produces logits [4.0, 1.0, 0.5] for a test image. Compute the partition function Z = exp(4) + exp(1) + exp(0.5) = 54.60 + 2.72 + 1.65 = 58.97. Softmax gives: cat = 54.60/58.97 = 0.926, dog = 2.72/58.97 = 0.046, bird = 1.65/58.97 = 0.028. The model says "92.6% cat." But across 100 predictions where the model said 90-100% confident, only 79 were right. The stated 92.6% is dishonest in aggregate.',
        'Now apply T = 2. Scaled logits: [4/2, 1/2, 0.5/2] = [2.0, 0.5, 0.25]. New partition function Z = exp(2) + exp(0.5) + exp(0.25) = 7.389 + 1.649 + 1.284 = 10.322. Softmax: cat = 7.389/10.322 = 0.716, dog = 1.649/10.322 = 0.160, bird = 1.284/10.322 = 0.124. The model now says "71.6% cat" instead of "92.6% cat." The predicted class is still cat. The ranking is still cat > dog > bird. But 71.6% is much closer to the 79% observed accuracy of this confidence range.',
        'To compute ECE for the full demo: five bins with gaps |0.55-0.52| = 0.03, |0.65-0.58| = 0.07, |0.75-0.64| = 0.11, |0.85-0.70| = 0.15, |0.95-0.78| = 0.17. Average gap = (0.03 + 0.07 + 0.11 + 0.15 + 0.17) / 5 = 0.106. After temperature scaling, the new confidences [0.52, 0.59, 0.65, 0.71, 0.79] give gaps |0.52-0.52| = 0.00, |0.59-0.58| = 0.01, |0.65-0.64| = 0.01, |0.71-0.70| = 0.01, |0.79-0.78| = 0.01. Average gap = 0.008. ECE dropped from 0.106 to 0.008 with one parameter.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Guo et al., "On Calibration of Modern Neural Networks" (ICML 2017), which demonstrated that modern deep networks are significantly less calibrated than older, simpler architectures and that temperature scaling is a surprisingly effective fix. Platt\'s original paper, "Probabilistic Outputs for Support Vector Machines" (1999), introduced sigmoid calibration for SVMs. Niculescu-Mizil and Caruana, "Predicting Good Probabilities with Supervised Learning" (ICML 2005), compared calibration methods across model families.',
        'For implementation, scikit-learn provides CalibratedClassifierCV with both sigmoid (Platt) and isotonic options. The reliability_diagram function in sklearn.calibration.calibration_curve computes the binned data needed for the plot. For deep learning, the temperature scaling code from Guo et al. is a single-file PyTorch script that fits T by gradient descent on the validation NLL.',
        'Study Softmax and Temperature next, since it explains the logit scaling that temperature calibration exploits. ROC Curves and AUC clarifies the distinction between ranking quality and probability quality. Precision, Recall, and the Confusion Matrix covers what happens after a threshold is applied to a probability. Picking a Threshold with Real Costs shows why calibrated scores are essential for cost-sensitive decisions. For the broader uncertainty picture, study Uncertainty: Teaching Models to Say I Don\'t Know and Conformal Prediction.',
      ],
    },
  ],
};

