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
    explanation: 'The split is the guarantee boundary. Training fits the base model; calibration measures errors on data the model did not train on. Future sets then inherit a quantile of those held-out errors instead of trusting the model score directly.',
    invariant: 'The calibration data must be exchangeable with future data for the guarantee to apply.',
  };

  yield {
    state: residualPlot(0.34),
    highlight: { active: ['scores', 'qhat'], compare: ['new'] },
    explanation: 'The horizontal line is qhat, the chosen residual quantile. A new regression prediction keeps the model center yhat but expands it by plus or minus qhat, so past calibration misses become the width of future intervals.',
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
    explanation: 'The classification set is the visible cost of ambiguity. If the top label is not enough to satisfy the coverage rule, the wrapper includes additional plausible labels rather than pretending the top-1 answer is certain.',
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
    explanation: 'The guarantee row is precise, not magical. Under exchangeability, marginal coverage holds over future draws. The table also names what is not promised: every subgroup, every individual, fixed set size, or validity after distribution shift.',
  };
}

function* coverageCalibration() {
  yield {
    state: plotState({
      axes: { x: { label: 'target coverage', min: 0.5, max: 0.99 }, y: { label: 'average set size', min: 1, max: 6 } },
      series: [
        { id: 'sets', label: 'coverage-size frontier', points: [{ x: 0.6, y: 1.1 }, { x: 0.75, y: 1.4 }, { x: 0.85, y: 2.0 }, { x: 0.9, y: 2.7 }, { x: 0.95, y: 3.8 }, { x: 0.99, y: 5.5 }] },
      ],
      markers: [
        { id: 'p90', x: 0.9, y: 2.7, label: '90%' },
        { id: 'p95', x: 0.95, y: 3.8, label: '95%' },
      ],
    }),
    highlight: { active: ['sets'], compare: ['p90', 'p95'] },
    explanation: 'The frontier shows the main tradeoff. Raising target coverage means choosing a larger quantile, which widens intervals or adds labels. Conformal prediction buys coverage by making uncertainty visible.',
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
    explanation: 'The average can hide who is being failed. Overall 90% coverage is compatible with one group being overcovered and another undercovered, so high-stakes deployments need slice-level coverage checks.',
    invariant: 'Coverage is a property of a data-generating process, not a moral certificate.',
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
    explanation: 'The table separates questions. Calibration asks whether probabilities mean what they say; MC dropout estimates model uncertainty; conformal prediction asks whether the returned set will cover under its assumptions. Better scores usually mean smaller conformal sets.',
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
    explanation: 'The wrapper is simple code, but the guarantee is operational. A contaminated calibration split, stale distribution, unexamined subgroup, or confusing set interface can make the statistical promise useless in practice.',
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
      heading: `What it is`,
      paragraphs: [
        `Conformal prediction is a way to wrap a model so it returns a set of plausible answers with a user-chosen coverage level. A classifier does not have to return only "cat." If the evidence is ambiguous, it can return {"cat", "dog"} and still make a useful promise about how often the true label will be inside the returned set. A regression model does not have to return only a point forecast. It can return an interval around the forecast.`,
        `The method is attractive because it is model-agnostic. It can wrap a neural network, random forest, Gradient Boosting model, nearest-neighbor system, or any predictor that produces a meaningful score. The basic split conformal recipe needs a trained model and a held-out calibration set drawn from the same process as future examples. It then uses the model's past errors on calibration data to decide how wide future intervals or label sets should be.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach is to trust the model's probability or error estimate. If a classifier says the top label has probability 0.92, choose it. If a regression model says the next value is 41, maybe attach a standard error or a normal-theory confidence interval. This feels natural, but it assumes the model's uncertainty numbers mean what they claim. Many modern models are overconfident. Even a calibrated model answers a different question: whether predicted probabilities match frequencies on average, not whether a returned set covers the next true label at a target rate.`,
        `The wall appears in deployment. A doctor, reviewer, auditor, inventory planner, or safety operator needs a decision rule, not a vague confidence score. "The model is uncertain" is not enough. The system must decide whether to act, defer, widen an interval, include more labels, ask for more evidence, or route to a human. Conformal prediction gives a direct operational object: a set or interval whose long-run coverage can be checked and governed.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is to stop asking the model to know its own uncertainty perfectly. Instead, hold back data the model did not train on, measure how nonconforming the true answers were under the model's scores, and use a quantile of those scores as the future threshold. If the calibration examples are exchangeable with future examples, the rank of the next example's score among the calibration scores is controlled. That rank argument gives finite-sample marginal coverage without assuming normal residuals or knowing the model internals.`,
        `Nonconformity is the key abstraction. A nonconformity score measures how strange the true answer looks under the model. In regression, a simple score is the absolute residual: |y - y_hat|. In classification, a score can be one minus the probability assigned to the true label, or a cumulative-probability score that supports adaptive label sets. Larger scores mean the model was more surprised. Conformal prediction turns a distribution of past surprise into a rule for future sets.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `Split conformal regression is the simplest case. First, divide data into a training split and a calibration split. Train the base model on the training split. On each calibration example, compute the absolute residual between the true value and the model prediction. Sort those residuals and choose a high quantile based on the target miscoverage alpha. For a new input, predict y_hat and return [y_hat - q_hat, y_hat + q_hat], where q_hat is the chosen calibration residual quantile.`,
        `Classification follows the same pattern but returns labels instead of numeric intervals. The model assigns scores to candidate labels. Calibration examples show how much score mass was needed before the true label was included. At prediction time, include enough labels to satisfy the threshold. More advanced variants use adaptive scores, class-conditional calibration, conformalized quantile regression, cross-conformal methods, or online updates. The shared structure remains the same: train the predictor separately, reserve calibration evidence, compute nonconformity scores, choose a threshold, and return a set rather than a naked point prediction.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The computation is usually cheap compared with training the base model. Split conformal needs one calibration pass, a stored threshold or small collection of thresholds, and a set-construction rule at prediction time. The real cost is statistical and product discipline. Holding out calibration data reduces the data available for training. Higher target coverage increases interval width or label-set size. Smaller calibration sets produce coarser quantiles. Updating the model, features, prompts, or data filters usually means recalibrating before the old coverage claim can be trusted.`,
        `There is also a user-interface cost. A returned set must be actionable. If a classifier returns five possible document types, the downstream workflow needs a rule for routing, asking for more information, or escalating. If a forecast interval is wide, the planner needs a policy for conservative allocation. Conformal prediction is not a decorative uncertainty badge; it changes the object the system hands to users.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The guarantee works because of exchangeability. Informally, the calibration examples and the future example must be reorderable draws from the same data-generating process. If that condition holds, the future nonconformity score is like one more score inserted into the calibration list. Choosing the right quantile means the future score will fall below the threshold with probability near 1 - alpha. This is a finite-sample statement. It is not an asymptotic promise that appears only with infinite data.`,
        `The guarantee is marginal coverage. Over many future draws from the same process, the returned set contains the truth at the target rate. It does not promise coverage for every individual point, every narrow subgroup, every time period, or every adversarially chosen example. It also does not promise small sets. A weak model can be conformal and still return huge intervals or many labels. Conformal prediction does not create knowledge. It makes uncertainty visible and gives a coverage rule for handling it.`,
      ],
    },
    {
      heading: `Where it is useful`,
      paragraphs: [
        `Conformal prediction is useful when a workflow can act on a set. In medical triage, a large set can trigger review instead of an automatic label. In fraud operations, uncertain cases can move to a human queue. In demand forecasting, interval upper bounds can guide safety stock. In document classification, a multi-label set can request more evidence. In moderation, autonomy, law, credit, and science, a set can be safer than a confident but wrong single answer.`,
        `It is especially practical when replacing the model is expensive. A team can keep a trained Gradient Boosting system, random forest, neural network, or retrieval classifier and add a calibration wrapper around it. That wrapper can be audited separately. The approach also teaches a useful design habit: the prediction object should match the decision. If the decision can defer, route, widen, hedge, or ask for more information, the model should not be forced to pretend one answer is always enough.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The first failure is data leakage. The calibration split must not be used as ordinary training data or tuned repeatedly until the coverage looks good. If the model, threshold, prompts, features, or preprocessing are selected by peeking at calibration performance, the coverage claim weakens. The second failure is distribution shift. If tomorrow's examples do not match the calibration process, the old quantile may be stale. Exchangeability is a condition, not a slogan.`,
        `The third failure is hidden subgroup undercoverage. Overall 90% coverage can coexist with 97% coverage for one group and 80% for another. High-stakes systems need slice-level coverage checks, and group-conditional conformal methods need enough calibration data per group. The fourth failure is unusable set size. If intervals are too wide or label sets too large, the wrapper may be statistically valid but operationally useless. The answer is not to shrink sets until they look nice. The answer is to improve the base model, gather better features, split the problem, or change the decision workflow.`,
      ],
    },
    {
      heading: `Evaluation signals and study next`,
      paragraphs: [
        `Evaluate conformal prediction with empirical coverage, average interval width, average label-set size, conditional coverage by slice, abstention or escalation rate, calibration-set age, drift indicators, and downstream decision cost. Plot the frontier between target coverage and set size. Check whether missed examples cluster by subgroup, time, geography, class, confidence band, or input source. Compare against plain model probabilities, Calibration & Reliability Diagrams, threshold rules, and uncertainty methods such as MC dropout. A valid wrapper that nobody can use is not a successful deployment.`,
        `Primary sources are A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification at https://arxiv.org/abs/2107.07511 and the accompanying code at https://github.com/aangelopoulos/conformal-prediction. Study Uncertainty: Teaching Models to Say "I Don't Know", Calibration & Reliability Diagrams, Threshold Optimization, Cross-Validation & Honest Evaluation, Random Forest, Gradient Boosting, Fairness Metrics, Benchmark Variance & Model Selection, and AI Audit Evidence Packet Case Study next. The central lesson is that uncertainty is not a decoration on a prediction. It is part of the prediction object.`,
      ],
    },
  ],
};
