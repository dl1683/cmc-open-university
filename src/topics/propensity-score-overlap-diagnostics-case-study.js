// Propensity score diagnostics: collapse observed covariates into treatment
// probability, then audit balance and overlap before trusting adjustment.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'propensity-score-overlap-diagnostics-case-study',
  title: 'Propensity Score Overlap Diagnostics',
  category: 'Concepts',
  summary: 'Estimate treatment propensity, bin or weight units, and inspect overlap so observational causal estimates do not extrapolate outside support.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['balance table', 'overlap trim'], defaultValue: 'balance table' },
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

function propensityGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'X', x: 0.75, y: 3.2, note: 'covars' },
      { id: 'treat', label: 'T', x: 2.0, y: 2.0, note: 'choice' },
      { id: 'model', label: 'model', x: 3.45, y: 3.2, note: 'P(T|X)' },
      { id: 'score', label: 'score', x: 4.95, y: 3.2, note: 'e(x)' },
      { id: 'bins', label: 'bins', x: 6.4, y: 2.0, note: 'overlap' },
      { id: 'weights', label: 'weights', x: 6.4, y: 4.35, note: 'IPW' },
      { id: 'balance', label: 'balance', x: 8.05, y: 2.0, note: 'audit' },
      { id: 'effect', label: 'effect', x: 8.35, y: 4.35, note: 'ATE' },
    ],
    edges: [
      { id: 'e-x-model', from: 'x', to: 'model' },
      { id: 'e-treat-model', from: 'treat', to: 'model' },
      { id: 'e-model-score', from: 'model', to: 'score' },
      { id: 'e-score-bins', from: 'score', to: 'bins' },
      { id: 'e-score-weights', from: 'score', to: 'weights' },
      { id: 'e-bins-balance', from: 'bins', to: 'balance' },
      { id: 'e-weights-effect', from: 'weights', to: 'effect' },
      { id: 'e-balance-effect', from: 'balance', to: 'effect' },
    ],
  }, { title });
}

function* balanceTable() {
  yield {
    state: propensityGraph('Propensity scores summarize observed treatment selection'),
    highlight: { active: ['x', 'treat', 'model', 'score'], compare: ['effect'] },
    explanation: 'In observational data, treatment was not randomized. A propensity score estimates the probability of treatment given observed covariates. It is not magic; it is a balancing score for the variables you measured.',
  };

  yield {
    state: labelMatrix(
      'Raw covariates are imbalanced',
      [
        { id: 'age', label: 'age' },
        { id: 'risk', label: 'risk' },
        { id: 'prior', label: 'prior use' },
        { id: 'region', label: 'region' },
      ],
      [
        { id: 'treated', label: 'treated' },
        { id: 'control', label: 'control' },
        { id: 'SMD', label: 'SMD' },
      ],
      [
        ['61', '48', '0.72'],
        ['high', 'low', '0.94'],
        ['44%', '12%', '0.81'],
        ['urban', 'mixed', '0.36'],
      ],
    ),
    highlight: { removed: ['age:SMD', 'risk:SMD', 'prior:SMD'], compare: ['region:SMD'] },
    explanation: 'Before adjustment, treated and control groups can differ sharply. Standardized mean differences expose this imbalance in units that are comparable across features.',
  };

  yield {
    state: propensityGraph('Scores create bins or weights for adjustment'),
    highlight: { active: ['score', 'bins', 'weights'], found: ['balance'] },
    explanation: 'After estimating e(x), units can be matched, subclassified into score bins, weighted by inverse propensity, or used in a doubly robust estimator. The next question is whether balance actually improved.',
    invariant: 'Estimate the score, then audit balance. Do not skip the audit.',
  };

  yield {
    state: labelMatrix(
      'Balance after score adjustment',
      [
        { id: 'age', label: 'age' },
        { id: 'risk', label: 'risk' },
        { id: 'prior', label: 'prior use' },
        { id: 'region', label: 'region' },
      ],
      [
        { id: 'raw', label: 'raw SMD' },
        { id: 'weighted', label: 'wt SMD' },
        { id: 'verdict', label: 'verdict' },
      ],
      [
        ['0.72', '0.06', 'ok'],
        ['0.94', '0.09', 'ok'],
        ['0.81', '0.18', 'watch'],
        ['0.36', '0.04', 'ok'],
      ],
    ),
    highlight: { found: ['age:verdict', 'risk:verdict', 'region:verdict'], compare: ['prior:verdict'] },
    explanation: 'Good propensity diagnostics are table-driven. If important covariates remain imbalanced after weighting or matching, the estimate is not ready to interpret.',
  };

  yield {
    state: propensityGraph('Balanced observed covariates feed the effect estimate'),
    highlight: { active: ['balance', 'weights', 'effect'], compare: ['x'] },
    explanation: 'The effect estimate is downstream of the design. The design step asks whether treated and control units are comparable on observed covariates before outcome modeling gets a vote.',
  };
}

function* overlapTrim() {
  yield {
    state: labelMatrix(
      'Overlap by propensity band',
      [
        { id: 'b1', label: '0.0-0.2' },
        { id: 'b2', label: '0.2-0.4' },
        { id: 'b3', label: '0.4-0.6' },
        { id: 'b4', label: '0.6-0.8' },
        { id: 'b5', label: '0.8-1.0' },
      ],
      [
        { id: 'treated', label: 'treated' },
        { id: 'control', label: 'control' },
        { id: 'action', label: 'action' },
      ],
      [
        ['2', '84', 'trim'],
        ['20', '63', 'keep'],
        ['44', '48', 'keep'],
        ['71', '26', 'keep'],
        ['91', '3', 'trim'],
      ],
    ),
    highlight: { removed: ['b1:action', 'b5:action'], found: ['b2:action', 'b3:action', 'b4:action'] },
    explanation: 'Overlap is the common-support check. If treated units have no comparable controls, or controls have no comparable treated units, the estimate requires extrapolation rather than adjustment.',
  };

  yield {
    state: propensityGraph('Trimming changes the estimand'),
    highlight: { active: ['bins', 'balance', 'effect'], removed: ['score'] },
    explanation: 'Trimming non-overlap can make the estimate more credible, but it changes the target population. The result becomes an effect for the overlap population, not necessarily everyone.',
  };

  yield {
    state: labelMatrix(
      'Weights need stability checks',
      [
        { id: 'small', label: 'e=0.03' },
        { id: 'mid', label: 'e=0.48' },
        { id: 'large', label: 'e=0.96' },
      ],
      [
        { id: 'treated wt', label: 'T wt' },
        { id: 'control wt', label: 'C wt' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['33.3', '1.0', 'huge T wt'],
        ['2.1', '1.9', 'stable'],
        ['1.0', '25.0', 'huge C wt'],
      ],
    ),
    highlight: { removed: ['small:risk', 'large:risk'], found: ['mid:risk'] },
    explanation: 'Extreme propensity scores produce extreme inverse-propensity weights. That can make a few observations dominate the estimate. Stabilization, trimming, or a different design may be needed.',
    invariant: 'No overlap means no design-based estimate for that region.',
  };

  yield {
    state: labelMatrix(
      'Complete case: treatment uptake study',
      [
        { id: 'raw', label: 'raw data' },
        { id: 'score', label: 'scores' },
        { id: 'trim', label: 'trimmed' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['confounded', 'do not compare'],
        ['modeled', 'not enough'],
        ['overlap pop', 'state scope'],
        ['balanced', 'estimate'],
      ],
    ),
    highlight: { active: ['score:lesson', 'trim:lesson', 'audit:lesson'], removed: ['raw:lesson'] },
    explanation: 'Case study: a high-risk patient program looks effective in raw data because treated patients differ from controls. Propensity diagnostics show which patients have comparable controls and which tail regions must be excluded.',
  };

  yield {
    state: propensityGraph('Diagnostics are part of the causal claim'),
    highlight: { active: ['bins', 'balance', 'effect'], found: ['weights'], compare: ['model'] },
    explanation: 'A credible observational estimate reports the design: score model, overlap, trimming rules, balance table, weight stability, and sensitivity to choices. The estimator alone is not the argument.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'balance table') yield* balanceTable();
  else if (view === 'overlap trim') yield* overlapTrim();
  else throw new InputError('Pick a propensity diagnostic view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A propensity score is the probability of treatment assignment given observed covariates. Propensity diagnostics turn that score into a causal-design checklist: do treated and control units overlap, do covariates balance after adjustment, and do weights remain stable enough to trust?',
        'The score is not a causal effect. It is a data structure for designing a comparison from observational data. It compresses many observed covariates into one balancing score, then forces the analyst to confront where the comparison is unsupported.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Estimate e(x) = P(T = 1 | X) from pre-treatment covariates. Then match, subclassify, or weight units using the score. The diagnostic table checks standardized mean differences before and after adjustment. A separate overlap table checks whether both treated and control units exist across the score range.',
        'The score only balances observed covariates. Hidden confounding remains a causal assumption, not a modeling detail. That is why propensity diagnostics belong next to Causal Graphs, Doubly Robust Estimation, and sensitivity analysis.',
      ],
    },
    {
      heading: 'Complete case study: patient program uptake',
      paragraphs: [
        'A hospital wants to estimate whether an outreach program reduces readmissions. Treated patients are older and higher risk, so raw comparisons are misleading. A propensity model estimates treatment probability from age, prior utilization, risk score, and region. The overlap table shows the highest-risk treated patients have almost no comparable controls, so those rows are trimmed.',
        'After trimming and weighting, most standardized mean differences fall below a practical threshold, but prior utilization remains imbalanced. The study reports the overlap population, revises the model, and shows balance diagnostics before presenting any effect estimate.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A high-quality propensity model for predicting treatment is not automatically a good causal design. A very accurate score can create extreme weights if treatment is nearly deterministic in parts of the covariate space. The goal is balance and overlap, not leaderboard accuracy.',
        'Do not adjust for post-treatment variables or colliders. Propensity covariates should be pre-treatment common causes of treatment and outcome, guided by the causal graph. Also report how trimming changes the estimand.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Rosenbaum and Rubin, "The central role of the propensity score in observational studies for causal effects" at https://academic.oup.com/biomet/article/70/1/41/240879 and a PDF mirror at https://www.stat.cmu.edu/~ryantibs/journalclub/rosenbaum_1983.pdf. Study Causal Graphs, Doubly Robust Estimation, Importance Sampling, Instrumental Variables, and Causal Forest Uplift Policy next.',
      ],
    },
  ],
};
