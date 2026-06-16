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
    explanation: 'Conformal prediction wraps a trained model with a calibration layer. The calibration set is held out. It measures how wrong the model tends to be, then uses a quantile of those errors to form future prediction sets.',
    invariant: 'The calibration data must be exchangeable with future data for the guarantee to apply.',
  };

  yield {
    state: residualPlot(0.34),
    highlight: { active: ['scores', 'qhat'], compare: ['new'] },
    explanation: 'For regression, a nonconformity score can be the absolute residual. Sort calibration residuals and pick a high quantile. A new prediction yhat becomes an interval: yhat minus qhat to yhat plus qhat.',
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
    explanation: 'For classification, conformal prediction returns a set of labels instead of one label. Easy examples may get one label; ambiguous examples may get two or more; very uncertain examples can produce a large set.',
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
    explanation: 'Conformal prediction is powerful because the guarantee is finite-sample and model-agnostic. It is also specific: marginal coverage under exchangeability, not perfect confidence for every subgroup or every individual point.',
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
    explanation: 'Higher coverage requires larger sets. Conformal prediction makes the uncertainty visible instead of hiding it inside an overconfident top-1 answer.',
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
    explanation: 'The standard guarantee is marginal. If one subgroup is undercovered and another is overcovered, the average can still look correct. High-stakes uses need slice audits.',
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
    explanation: 'Conformal prediction does not replace model uncertainty. It wraps model scores with a coverage guarantee. Calibration, ensembles, and uncertainty scores can still improve the efficiency of the resulting sets.',
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
    explanation: 'A conformal wrapper is simple; deploying it well is not. You must protect the calibration split, monitor drift, audit slices, and design a workflow for prediction sets.',
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
      heading: 'What it is',
      paragraphs: [
        'Conformal prediction turns model scores into prediction sets or intervals with a user-chosen coverage target. Instead of saying only "cat," the model may return {"cat", "dog"} when evidence is ambiguous. Instead of a point regression prediction, it returns an interval.',
        'The method is model-agnostic. It can wrap neural networks, random forests, gradient boosting, or any model that produces a useful score. The key ingredient is a held-out calibration set drawn from the same process as future data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Split conformal trains the model on one split and calibrates on another. For regression, the calibration score might be absolute residual. Pick a quantile of calibration residuals, then add and subtract it from future predictions. For classification, scores define which labels must be included so the true label is covered with the target probability.',
        'The guarantee is finite-sample and distribution-free under exchangeability. That is the appeal: no Gaussian residual assumption, no asymptotic argument, and no need to know the model internals.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is set size and data discipline. Higher coverage produces wider intervals or larger label sets. The calibration split cannot be reused casually for tuning. Distribution shift can invalidate the guarantee. Subgroup coverage can fail even when marginal coverage looks correct.',
        'There is a product cost too: users and downstream systems must know what to do with a set. A medical triage system may route large sets to human review. A document classifier may ask for more evidence. A forecasting system may allocate inventory using the upper bound. Conformal prediction is only useful when the workflow can act on uncertainty.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Conformal prediction is useful in medical triage, fraud review, demand forecasting, document classification, moderation, autonomy, and any workflow where a model can defer or return a set. It connects directly to Uncertainty Quantification, Calibration Curves, Threshold Optimization, and Cross-Validation & Honest Evaluation.',
        'It is especially practical because it wraps existing models. Teams can keep a trained Gradient Boosting model, neural net, or retrieval classifier and add a calibration layer around it. That makes conformal methods attractive in regulated systems where replacing the whole model would be slower than adding a statistically auditable uncertainty wrapper.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Conformal prediction does not make a weak model strong. It exposes uncertainty by returning bigger sets. It also does not automatically guarantee fairness across every subgroup. You need slice audits, drift monitoring, and a product workflow that knows what to do with multi-label sets or wide intervals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification at https://arxiv.org/abs/2107.07511 and the accompanying code at https://github.com/aangelopoulos/conformal-prediction. Study Uncertainty: Teaching Models to Say "I Don\'t Know", Calibration Curves, Threshold Optimization, Cross-Validation & Honest Evaluation, and Fairness Metrics next.',
      ],
    },
  ],
};
