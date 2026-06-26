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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces the diagnostic pipeline that must run before any observational treatment effect is reported. Active nodes mark the current stage of work. Found markers flag audit results that passed. Removed markers flag covariates or propensity bands that failed the balance or overlap check.',
        'In the balance-table view, follow the path from raw covariates through the propensity model into score-based adjustment, then into the balance audit that decides whether the comparison is fair. The important frame is not the fitted score; it is the standardized mean difference table after weighting.',
        'In the overlap-trim view, watch the propensity bands. Bands where one group has almost no representation are marked removed. That is not a statistical weakness -- it is a scope decision. The estimate after trimming answers a narrower question about a population where both treatment arms actually exist.',
        {type:'callout', text:'Propensity diagnostics are a design gate: estimate the score, prove overlap and balance, then report only the population that remains comparable.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A treatment is an action whose effect we want to estimate, such as a drug, outreach call, or discount. In observational data, people were not assigned by coin flip. Sicker patients may receive the program, and more engaged customers may receive the offer.',
        'A raw comparison mixes treatment effect with selection. Propensity diagnostics exist to ask whether the data contains fair comparisons before estimating an effect. They check overlap, meaning both treated and untreated units exist in the same covariate region, and balance, meaning measured pre-treatment variables look similar after adjustment.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is outcome regression. Regress the outcome on treatment and covariates, then read the treatment coefficient. This looks familiar because it returns one number and seems to control for many variables at once.',
        'That approach is reasonable when treatment is nearly random and the model only interpolates between comparable units. In a clean A/B test, a regression adjustment can be fine. Observational data usually has stronger assignment patterns, so the model may be asked to guess across regions where one group is absent.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is common support. If treated patients are all high-risk and untreated patients are all low-risk, the model must invent what high-risk untreated outcomes would have been. More flexible models do not fix missing comparisons; they only extrapolate with more machinery.',
        'Weights can also explode near propensity scores of 0 or 1. A propensity score is P(T = 1 | X), the probability of treatment given observed covariates. For average-treatment weighting, a treated unit with score 0.03 gets weight 33.3, so one unusual row can dominate the estimate.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The propensity score is a design tool. It compresses observed pre-treatment covariates into one probability of treatment. Units with similar scores had similar measured chances of receiving treatment, so matching, stratifying, or weighting by the score can create comparable groups.',
        'The score is not the effect. It is a way to build and audit the comparison before looking at outcomes. The diagnostic contract is strict: prove overlap, prove balance with standardized mean differences, and report the population that remains after trimming.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose covariates measured before treatment that could affect both treatment assignment and outcome. Fit a model predicting treatment from those covariates. Then use the resulting propensity score for matching, score bands, or inverse-propensity weighting.',
        'After adjustment, compute the standardized mean difference for each covariate. SMD is the difference in group means divided by a pooled standard deviation. Values below about 0.1 are often treated as acceptable balance, but the whole table and the overlap plot matter more than one threshold.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Rosenbaum and Rubin showed that the propensity score is a balancing score. If treatment assignment is ignorable given the measured covariates, then conditioning on the score balances those measured covariates between treated and untreated units. That converts a high-dimensional matching problem into a one-dimensional diagnostic problem.',
        'The correctness argument has two assumptions. First, there are no unmeasured confounders strong enough to drive both treatment and outcome. Second, positivity holds, meaning every analyzed unit had some chance of either treatment or control. Diagnostics can reveal positivity failures, but unmeasured confounding must be argued from domain knowledge.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computational cost is modest: fitting a logistic model is roughly O(np) per iteration for n units and p covariates, and computing balance tables is O(np). The real cost is inferential. Poor overlap shrinks the target population, inflates variance, and makes estimates sensitive to a few rows.',
        'When weights get extreme, effective sample size can collapse. A raw sample of 2000 controls may behave like 120 weighted controls if most weight sits on a small overlap band. Trimming improves stability but changes the question from the full population to the overlap population.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Propensity diagnostics are used in epidemiology, health services research, education policy, labor economics, marketing measurement, and product launches that were not randomized. They fit cases where random assignment was impossible or already missed, but measured pre-treatment data is rich.',
        'They are strongest as part of a complete design report. The report should show the causal question, covariate choice, score model, overlap plot, trimming rule, balance table, weight distribution, and sensitivity analysis. The estimate comes after those artifacts, not before them.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when important confounders were not measured. Motivation, clinician judgment, manager intent, or socioeconomic factors can drive both treatment and outcome while staying absent from the dataset. Perfect balance on measured covariates cannot repair a missing cause.',
        'It also fails when analysts include post-treatment variables, optimize the score model for prediction accuracy, or treat no overlap as an inconvenience. A score model with AUC 0.99 may mean the groups are almost separable. For causal design, that is a warning, not a victory.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A hospital studies whether nurse outreach reduces 30-day readmission. The program has 312 treated patients and 1847 controls. Before adjustment, treated patients have mean age 68.4 versus 52.1, risk score 74.2 versus 41.8, and prior admissions 2.8 versus 0.9; the SMDs are 0.72, 0.94, and 0.81.',
        'The team fits a propensity model and trims scores below 0.10 or above 0.90. Stabilized weighting lowers age SMD to 0.06 and risk SMD to 0.09, but prior admissions remains 0.18. After adding a pre-treatment interaction between risk score and prior admissions, that SMD drops to 0.08, and the estimate is reported only for the overlap population with an effective sample of 189 treated and 423 controls.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Rosenbaum and Rubin 1983 on the central role of the propensity score, Austin 2009 on balance diagnostics, Crump, Hotz, Imbens, and Mitnik 2009 on limited overlap, and Imbens and Rubin 2015 on causal inference design.',
        'Study causal graphs before choosing covariates, then doubly robust estimation, causal forests, instrumental variables, and importance sampling. The next practical skill is writing a design report that separates diagnostics from outcome estimation.',
      ],
    },
  ],
};
