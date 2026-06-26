// Conformal prediction: calibrate a model's residuals on held-out data, then
// return prediction sets with finite-sample coverage guarantees.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'conformal-prediction',
  title: 'Conformal Prediction',
  category: 'AI & ML',
  summary: 'Turn model scores into prediction sets with distribution-free coverage using calibration residuals and quantiles.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['split conformal', 'coverage calibration'], defaultValue: 'split conformal' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function residualPlot(threshold) {
  const points = [0.04, 0.08, 0.12, 0.15, 0.18, 0.21, 0.26, 0.31, 0.34, 0.42].map((y, i) => ({ x: i + 1, y }));
  return plotState({
    axes: { x: { label: 'calibration example', min: 0, max: 11 }, y: { label: 'nonconformity score', min: 0, max: 0.5 } },
    series: [
      { id: 'scores', label: 'sorted calibration scores', points },
      { id: 'qhat', label: 'chosen quantile', points: [{ x: 0.5, y: threshold }, { x: 10.5, y: threshold }] },
    ],
    markers: [
      { id: 'new', x: 6.0, y: 0.0, label: 'new point interval uses qhat' },
    ],
  });
}

function* splitConformal() {
  const splitParts = 4;
  const calScores = 10;
  const qhat = 0.34;
  const candidateLabels = 4;
  const guaranteeRows = 4;

  yield {
    state: labelMatrix(
      'Split conformal uses data the model did not train on',
      [
        { id: 'train', label: 'train set' },
        { id: 'cal', label: 'calibration set' },
        { id: 'test', label: 'new point' },
        { id: 'guarantee', label: 'coverage target' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['fit model', 'ordinary training'],
        ['measure errors', 'do not tune on it'],
        ['make set', 'use calibration quantile'],
        ['1 - alpha', 'finite-sample marginal coverage'],
      ],
    ),
    highlight: { active: ['cal:purpose', 'cal:rule'], found: ['guarantee:rule'] },
    explanation: `The split across ${splitParts} data roles is the guarantee boundary. Training fits the base model; calibration measures errors on ${calScores} held-out examples the model did not train on. Future sets then inherit a quantile of those held-out errors instead of trusting the model score directly.`,
    invariant: `The ${calScores} calibration examples must be exchangeable with future data for the guarantee to apply.`,
  };

  yield {
    state: residualPlot(qhat),
    highlight: { active: ['scores', 'qhat'], compare: ['new'] },
    explanation: `The horizontal line is qhat = ${qhat}, the chosen residual quantile from ${calScores} calibration scores. A new regression prediction keeps the model center yhat but expands it by plus or minus ${qhat}, so past calibration misses become the width of future intervals.`,
  };

  yield {
    state: labelMatrix(
      'Classification conformal sets',
      [
        { id: 'cat', label: 'cat 0.62' },
        { id: 'dog', label: 'dog 0.27' },
        { id: 'fox', label: 'fox 0.08' },
        { id: 'eel', label: 'eel 0.03' },
      ],
      [
        { id: 'include', label: 'include?' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['yes', 'enough cumulative confidence'],
        ['yes', 'uncertainty requires set'],
        ['maybe no', 'below threshold'],
        ['no', 'too unlikely'],
      ],
    ),
    highlight: { found: ['cat:include', 'dog:include'], compare: ['fox:include', 'eel:include'] },
    explanation: `The classification set ranks ${candidateLabels} candidate labels by decreasing score. If the top label is not enough to satisfy the coverage rule, the wrapper includes additional plausible labels rather than pretending the top-1 answer is certain.`,
  };

  yield {
    state: labelMatrix(
      'What the guarantee actually says',
      [
        { id: 'marginal', label: 'marginal coverage' },
        { id: 'conditional', label: 'conditional coverage' },
        { id: 'size', label: 'set size' },
        { id: 'shift', label: 'distribution shift' },
      ],
      [
        { id: 'status', label: 'status' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['guaranteed', 'averaged over future draws'],
        ['not guaranteed generally', 'harder requirement'],
        ['not fixed', 'uncertainty becomes larger sets'],
        ['breaks guarantee', 'calibration no longer matches'],
      ],
    ),
    highlight: { found: ['marginal:status'], compare: ['conditional:status', 'shift:status'] },
    explanation: `The guarantee row is precise across ${guaranteeRows} conditions, not magical. Under exchangeability, marginal coverage holds over future draws. The table also names what is not promised: every subgroup, every individual, fixed set size, or validity after distribution shift.`,
  };
}

function* coverageCalibration() {
  const frontierPoints = 6;
  const sizeAt90 = 2.7;
  const sizeAt95 = 3.8;
  const subgroupRows = 4;
  const uncertaintyMethods = 4;
  const checklistItems = 4;

  yield {
    state: plotState({
      axes: { x: { label: 'target coverage', min: 0.5, max: 0.99 }, y: { label: 'average set size', min: 1, max: 6 } },
      series: [
        { id: 'sets', label: 'coverage-size frontier', points: [{ x: 0.6, y: 1.1 }, { x: 0.75, y: 1.4 }, { x: 0.85, y: 2.0 }, { x: 0.9, y: sizeAt90 }, { x: 0.95, y: sizeAt95 }, { x: 0.99, y: 5.5 }] },
      ],
      markers: [
        { id: 'p90', x: 0.9, y: sizeAt90, label: '90%' },
        { id: 'p95', x: 0.95, y: sizeAt95, label: '95%' },
      ],
    }),
    highlight: { active: ['sets'], compare: ['p90', 'p95'] },
    explanation: `The frontier shows the main tradeoff across ${frontierPoints} coverage levels. At 90% coverage the average set size is ${sizeAt90}; at 95% it grows to ${sizeAt95}. Conformal prediction buys coverage by making uncertainty visible.`,
  };

  yield {
    state: labelMatrix(
      'Coverage can hide subgroup failures',
      [
        { id: 'overall', label: 'overall' },
        { id: 'groupA', label: 'group A' },
        { id: 'groupB', label: 'group B' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'coverage', label: 'coverage' },
        { id: 'interpretation', label: 'interpretation' },
      ],
      [
        ['90%', 'target met'],
        ['95%', 'overcovered'],
        ['80%', 'undercovers risky slice'],
        ['group calibration', 'needs enough data'],
      ],
    ),
    highlight: { found: ['overall:coverage'], removed: ['groupB:coverage'], compare: ['fix:interpretation'] },
    explanation: `The average across ${subgroupRows} rows can hide who is being failed. Overall 90% coverage is compatible with one group at 95% and another at 80%, so high-stakes deployments need slice-level coverage checks.`,
    invariant: `Coverage is a property of a data-generating process across ${subgroupRows} groups, not a moral certificate.`,
  };

  yield {
    state: labelMatrix(
      'Where conformal fits beside uncertainty methods',
      [
        { id: 'calibration', label: 'calibration curve' },
        { id: 'dropout', label: 'MC dropout' },
        { id: 'conformal', label: 'conformal' },
        { id: 'human', label: 'abstention' },
      ],
      [
        { id: 'question', label: 'question answered' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['are probabilities honest?', 'not a set guarantee'],
        ['model uncertainty?', 'heuristic'],
        ['will set cover?', 'exchangeability needed'],
        ['should we defer?', 'policy choice'],
      ],
    ),
    highlight: { active: ['conformal:question'], compare: ['calibration:question', 'dropout:limit'] },
    explanation: `The table separates ${uncertaintyMethods} uncertainty methods and their distinct questions. Calibration asks whether probabilities mean what they say; MC dropout estimates model uncertainty; conformal prediction asks whether the returned set will cover under its assumptions.`,
  };

  yield {
    state: labelMatrix(
      'Operational checklist',
      [
        { id: 'split', label: 'clean split' },
        { id: 'drift', label: 'drift monitoring' },
        { id: 'slices', label: 'slice coverage' },
        { id: 'ux', label: 'set UX' },
      ],
      [
        { id: 'requirement', label: 'requirement' },
        { id: 'failure', label: 'failure if skipped' },
      ],
      [
        ['holdout calibration', 'leakage'],
        ['refresh or alarm', 'stale quantile'],
        ['audit groups', 'hidden undercoverage'],
        ['explain sets', 'users pick wrong label'],
      ],
    ),
    highlight: { found: ['split:requirement', 'drift:requirement', 'slices:requirement', 'ux:requirement'] },
    explanation: `The wrapper is simple code, but all ${checklistItems} operational checks must pass. A contaminated calibration split, stale distribution, unexamined subgroup, or confusing set interface can make the statistical promise useless in practice.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'split conformal') yield* splitConformal();
  else if (view === 'coverage calibration') yield* coverageCalibration();
  else throw new InputError('Pick a conformal-prediction view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "split conformal" view walks through the full procedure: data split, calibration scoring, quantile selection, and set construction. Active cells mark the current step. Found cells mark guarantees that hold under the stated assumptions. The residual plot shows sorted calibration scores with a horizontal threshold line -- that line becomes the width of every future interval.',
        {type: 'callout', text: 'Conformal prediction turns held-out model errors into future prediction sets with a finite-sample coverage promise.'},
        'The "coverage calibration" view shows what happens when you change the target coverage level. The frontier plot traces the tradeoff: higher coverage means wider intervals or larger label sets. Active series mark the curve; compare markers show specific operating points.',
        'At each frame, ask: what data produced this threshold, why is this quantile the right one, and what assumption must hold for the guarantee to transfer to new data.',
        {type: 'image', src: './assets/gifs/conformal-prediction.gif', alt: 'Animated walkthrough of the conformal prediction visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Models return point predictions. A classifier says "cat." A regression model says 41.3. Neither tells you how much to trust the answer. In deployment, trust matters: a doctor routing a scan, a planner setting safety stock, a fraud analyst triaging alerts -- each needs to know not just the best guess but how wrong the guess might be.',
        {type: 'quote', text: 'Conformal prediction provides a framework for producing prediction sets that are guaranteed to contain the true label with a user-specified probability, without any assumptions on the distribution of the data.', attribution: 'Vladimir Vovk, Algorithmic Learning in a Random World (2005)'},
        'Conformal prediction wraps any trained model so it returns a set -- an interval for regression, a label set for classification -- with a finite-sample coverage guarantee. The guarantee is distribution-free: it requires exchangeability of the data (the order of examples does not matter), not normality, not correct model specification, not Bayesian priors. The method dates to Vovk, Gammerman, and Shafer (2005), but split conformal prediction made it practical enough for production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is to trust the model\\\'s own uncertainty estimate. If a neural network outputs softmax probabilities, threshold on the top-class probability. If a regression model has a standard error, build a normal-theory confidence interval. This is fast, requires no extra data, and feels principled.',
        'The problem is that model-reported probabilities are often wrong. Modern deep networks are systematically overconfident -- a softmax score of 0.95 does not mean the model is right 95% of the time. Even after temperature scaling or Platt calibration, the corrected probabilities answer a different question: "do predicted probabilities match observed frequencies on average?" That is calibration. It is not a coverage guarantee for the next prediction set.',
        {type: 'table', headers: ['Method', 'Assumption', 'Guarantee', 'Finite-sample?'], rows: [['Conformal set', 'Exchangeability', 'P(Y in C(X)) >= 1 - alpha', 'Yes'], ['Bayesian credible interval', 'Correct prior + likelihood', 'Posterior probability mass', 'Yes, given model'], ['Frequentist confidence interval', 'Parametric model (e.g. normality)', 'Long-run frequency coverage', 'Asymptotic usually']]},
        'Conformal prediction is the only row that works without distributional assumptions. The price is that it needs held-out calibration data and returns sets whose size it does not control.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that model confidence and actual coverage are different quantities. A model can be perfectly calibrated in the probabilistic sense and still fail to provide valid prediction sets, because calibration averages over all predictions while coverage is a promise about the next one. There is no general way to convert a model\\\'s internal score into a coverage guarantee without external validation data.',
        'In deployment, the gap becomes operational. "The model is 92% confident" is not a decision rule. A safety system needs to know: if I act on every prediction set this model returns, how often will the true answer be missing? That question requires measuring the model\\\'s errors on data it did not train on, then using those errors to set future thresholds. That is exactly what conformal prediction does.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that the rank of a new example\\\'s error among calibration errors is uniformly distributed, as long as the data is exchangeable. Exchangeability means the joint distribution of all examples does not depend on their order. This is weaker than requiring independent and identically distributed data. It holds for random splits of a fixed dataset, for i.i.d. draws, and for many randomized sampling schemes.',
        'Because the rank is uniform, the probability that the new example\\\'s error falls below the k-th sorted calibration error is exactly k / (n + 1), where n is the calibration set size. Choosing k = ceil((n + 1)(1 - alpha)) gives coverage at least 1 - alpha. This is a finite-sample result. It holds for any n, any model, any data distribution. The guarantee is an algebraic consequence of exchangeability, not an approximation that improves with more data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Split conformal prediction has four steps. Train the base model on a training split. Compute non-conformity scores on a held-out calibration split. Choose a quantile of those scores. At prediction time, use that quantile to build the set.',
        {type: 'image', src: 'https://mermaid.ink/svg/pako:TcxNCsIwEIbhfU4xF-gVBPvnRoqIu5BFTKftQJppJ6PF24sVxO3zfnxD5C1MXhTOV3O0N_GWEI2Ql0jqoCgOUNqWFGbuMTpT2cpHuotX4vS_qm3HKXAaWGbSF-TAgtmZeq-NrfiJ4keE9eGTUkRYJ6_OlHtvbYcbLII9hc-zM83uJ3v5GWRUZ9qvvwE', alt: 'Split conformal pipeline from training split and calibration split to nonconformity scores, quantile, and prediction set.', caption: 'The guarantee boundary is the calibration split: held-out errors define qhat, and qhat wraps new predictions into sets. Source: https://mermaid.ink/svg/pako:TcxNCsIwEIbhfU4xF-gVBPvnRoqIu5BFTKftQJppJ6PF24sVxO3zfnxD5C1MXhTOV3O0N_GWEI2Ql0jqoCgOUNqWFGbuMTpT2cpHuotX4vS_qm3HKXAaWGbSF-TAgtmZeq-NrfiJ4keE9eGTUkRYJ6_OlHtvbYcbLII9hc-zM83uJ3v5GWRUZ9qvvwE'},
        {type: 'diagram', text: 'Data --> [Training Set] --> fit model\n     --> [Calibration Set] --> compute scores s_i = |y_i - y_hat_i|\n                             --> sort scores\n                             --> pick q_hat = quantile(scores, (1-alpha)(1 + 1/n))\n\nNew x --> y_hat = model(x) --> prediction interval = [y_hat - q_hat, y_hat + q_hat]', label: 'Split conformal regression pipeline'},
        'The non-conformity score measures how surprising the true answer is under the model. For regression, the absolute residual |y - y_hat| is the standard choice. For classification, common scores include 1 minus the softmax probability of the true class, or the cumulative probability mass needed before the true class appears (the APS score). Larger scores mean the model was more wrong.',
        {type: 'code', language: 'python', text: '# Split conformal prediction in ~20 lines\nimport numpy as np\n\ndef split_conformal(model, X_cal, y_cal, X_test, alpha=0.1):\n    """Return prediction intervals with 1-alpha marginal coverage."""\n    # Step 1: compute non-conformity scores on calibration set\n    y_hat_cal = model.predict(X_cal)\n    scores = np.abs(y_cal - y_hat_cal)\n\n    # Step 2: compute the corrected quantile\n    n = len(scores)\n    q_level = np.ceil((n + 1) * (1 - alpha)) / n\n    q_hat = np.quantile(scores, min(q_level, 1.0))\n\n    # Step 3: form prediction intervals\n    y_hat_test = model.predict(X_test)\n    lower = y_hat_test - q_hat\n    upper = y_hat_test + q_hat\n    return lower, upper'},
        'Classification conformal sets work the same way. Sort candidate labels by decreasing model score. Include labels until the cumulative score crosses the calibration threshold. If the model is confident, the set contains one label. If the model is uncertain, the set grows -- that growth is the visible cost of ambiguity, not a failure. Adaptive conformal inference (Gibbs and Candes, 2021) extends this to sequential settings where exchangeability may not hold exactly, adjusting the threshold online.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The guarantee rests on one assumption: exchangeability. The calibration examples and the future test example must be reorderable draws from the same process. Under exchangeability, the rank of the new example\\\'s non-conformity score among the n calibration scores is uniformly distributed over {1, 2, ..., n+1}. Choosing q_hat as the ceil((n+1)(1-alpha))/n quantile ensures the new score falls below q_hat with probability at least 1 - alpha. This is a finite-sample result -- it holds for any n, any model, any data distribution.',
        'The guarantee is marginal: averaged over future draws from the exchangeable process, the set contains the truth at rate 1 - alpha. It does not promise conditional coverage within every subgroup, and it does not promise small sets. A terrible model wrapped in conformal prediction returns enormous intervals. The method makes uncertainty visible; it does not create accuracy.',
        {type: 'image', src: 'https://mermaid.ink/svg/pako:NY1BDoIwEADvvGI_wBdMpAg-gMRD08MWF9hYW9lu8fsGiOeZzEwhfccFRWFoqqsdUGZSGNNGgjNB-Tio6ws09s7zQgJrwagcyFXNAYx98JMEOCrJhiFDEngnIQjoKWRXmcNrrfk3N87s98LNtpxV2BflFCEvPOm566zBwF7wBIq73h2ot31BwahE4IXwld0P', alt: 'Higher target coverage selects a larger quantile and wider sets, while distribution shift makes calibration stale.', caption: 'Coverage is bought with larger sets, and the exchangeability assumption breaks when deployment data shifts away from calibration data. Source: https://mermaid.ink/svg/pako:NY1BDoIwEADvvGI_wBdMpAg-gMRD08MWF9hYW9lu8fsGiOeZzEwhfccFRWFoqqsdUGZSGNNGgjNB-Tio6ws09s7zQgJrwagcyFXNAYx98JMEOCrJhiFDEngnIQjoKWRXmcNrrfk3N87s98LNtpxV2BflFCEvPOm566zBwF7wBIq73h2ot31BwahE4IXwld0P'},
        {type: 'note', text: 'Exchangeability is weaker than i.i.d. -- it allows dependence in the joint distribution as long as order does not matter. But it still rules out distribution shift, concept drift, and adversarial ordering. If tomorrow\\\'s data comes from a different process than the calibration set, the coverage guarantee breaks.'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computational cost is negligible compared to training. Split conformal needs one forward pass over the calibration set, a sort of n scores (O(n log n)), and one quantile lookup. At prediction time, the overhead is a single comparison per candidate. Storage is one scalar (q_hat) for fixed-width regression intervals, or a small lookup table for class-conditional thresholds.',
        'The real costs are statistical and organizational. Holding out a calibration set reduces training data -- typically 10-20% of labeled examples are reserved. Smaller calibration sets produce coarser quantiles: with 100 calibration points and alpha = 0.1, the quantile is the 91st sorted score, giving granularity of about 1%. Retraining the model, changing features, or updating preprocessing invalidates the calibration and requires a fresh split.',
        'There is also a product cost. Returning a set changes the user interface. A classifier that returns {"cat", "dog", "fox"} needs a workflow that can handle multiple labels: route to a human, request more evidence, or display ranked options. If the downstream system expects a single answer, conformal prediction requires redesigning the decision boundary.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Conformal prediction is strongest when the workflow can act on a set. Medical triage: a large prediction set triggers specialist review instead of auto-labeling. Fraud detection: uncertain transactions go to a human queue. Demand forecasting: the upper bound of the interval sets safety stock. Document classification: a multi-label set triggers a request for more evidence. In each case, the set is the decision object, not a nuisance.',
        'It is also practical when the model is expensive to replace. A team with a deployed gradient boosting system or fine-tuned LLM can add a conformal wrapper without retraining. The wrapper can be audited independently: check empirical coverage on held-out data, slice by subgroup, track coverage over time. If coverage drifts, recalibrate the wrapper instead of retraining the model.',
        {type: 'bullets', items: ['Model-agnostic: wraps any predictor that produces scores.', 'Finite-sample guarantee: no asymptotics, works with hundreds of calibration points.', 'Cheap to compute: one quantile, no retraining.', 'Auditable: coverage is a single number that can be monitored in production.', 'Composable: works alongside calibration, MC dropout, and ensemble methods.']},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Data leakage kills the guarantee. If calibration data is used for training, hyperparameter tuning, or threshold selection, the quantile no longer represents held-out error. The coverage claim becomes circular. This is the most common implementation mistake.',
        'Distribution shift breaks exchangeability. If the deployment distribution drifts from the calibration distribution, the old quantile is stale. Adaptive conformal inference mitigates this in sequential settings by adjusting the threshold online, but it requires a feedback signal -- the true label must eventually arrive so coverage can be tracked.',
        'Marginal coverage hides subgroup failures. Overall 90% coverage is compatible with 97% for one group and 78% for another. High-stakes deployments need slice-level coverage checks. Group-conditional conformal methods exist but require enough calibration data per group, which is often the bottleneck.',
        'Unusable set size is a silent failure. If intervals are so wide or label sets so large that no one acts on them, the wrapper is statistically valid but operationally dead. The fix is to improve the base model or redesign the decision workflow to handle uncertainty explicitly, not to shrink sets artificially.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A regression model predicts house prices. After training, 10 calibration houses are held out. The model predicts each one and the absolute residuals are: 12k, 18k, 25k, 31k, 35k, 42k, 48k, 55k, 63k, 80k (sorted). The target is 90% coverage, so alpha = 0.1.',
        'The corrected quantile level is ceil((10 + 1) * 0.9) / 10 = ceil(9.9) / 10 = 10 / 10 = 1.0. Since the quantile level is 1.0, q_hat is the maximum score: 80k. Every future prediction interval is y_hat plus or minus 80k. That is wide because 10 calibration points give coarse resolution.',
        'With 100 calibration points and alpha = 0.1, the quantile level is ceil(101 * 0.9) / 100 = ceil(90.9) / 100 = 91 / 100 = 0.91. q_hat is the 91st sorted residual. If that residual is 38k, the interval is y_hat plus or minus 38k. More calibration data produces tighter, more informative intervals. The method never undercovers on average, but it can only be as precise as the calibration set allows.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: ['Vovk, Gammerman, Shafer -- "Algorithmic Learning in a Random World" (2005). The foundational monograph defining conformal prediction.', 'Angelopoulos and Bates -- "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification" (2021), arxiv.org/abs/2107.07511. The standard modern tutorial with code at github.com/aangelopoulos/conformal-prediction.', 'Lei et al. -- "Distribution-Free Predictive Inference for Regression" (2018). Formalizes split conformal for regression with finite-sample guarantees.', 'Romano, Patterson, Candes -- "Conformalized Quantile Regression" (2019). Produces adaptive-width intervals by combining quantile regression with conformal calibration.', 'Gibbs and Candes -- "Adaptive Conformal Inference Under Distribution Shift" (2021). Online threshold adjustment for sequential settings where exchangeability fails.']},
        'Study Calibration and Reliability Diagrams to understand the difference between calibrated probabilities and coverage guarantees. Study Cross-Validation and Honest Evaluation for the data-splitting discipline conformal prediction depends on. Study Threshold Optimization to see how conformal sets interact with downstream decision rules.',
      ],
    },
  ],
};
