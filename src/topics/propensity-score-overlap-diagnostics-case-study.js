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
      heading: 'Why this exists',
      paragraphs: [
        'In an observational study, people do not receive treatment by coin flip. Sicker patients are more likely to get a care program. Heavy users are more likely to receive a discount. High-risk accounts are more likely to get a retention call. A raw treated-versus-control comparison mixes the effect of the treatment with the reasons the treatment was assigned.',
        'Propensity score diagnostics exist before effect estimation. They ask whether the data contains fair comparisons at all. The diagnostics do not prove causality, but they can show whether the proposed adjustment is staying inside the part of the data where treated and untreated units both exist.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to fit an outcome model with a treatment column and call the coefficient the treatment effect. That is tempting because it looks like ordinary prediction work: add covariates, add treatment, report the treatment term.',
        'The wall is common support. If treated units live in a covariate region where there are no comparable controls, the model is guessing what would have happened under control. If propensity scores are near 0 or 1, inverse-propensity weights can let one or two unusual rows dominate the estimate. A more flexible model does not solve that; it can make the lack of overlap easier to hide.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The propensity score is a design tool. It estimates e(x) = P(T = 1 | X), the probability that a unit receives treatment given observed pre-treatment covariates. Units with similar scores had similar measured chances of treatment, even if their raw covariate vectors are large.',
        'That single score gives the study a practical handle: match similar treated and control units, form score bands, compute weights, inspect overlap, and audit balance. The score is not the treatment effect. It is a way to build and test a comparison before outcomes are interpreted.',
      ],
    },
    {
      heading: 'What to inspect in the visual',
      paragraphs: [
        'In the balance-table view, follow the path from covariates and treatment assignment into the score, then into bins or weights, and finally into the balance audit. The important move is not the fitted score by itself. The important move is whether the adjusted treated and control groups now look similar on pre-treatment covariates.',
        'In the overlap-trim view, watch the tails. A band with many treated units and almost no controls is not a weak estimate; it is a different kind of claim. It asks the analysis to infer a missing counterfactual from outside the support of the observed data. Trimming those bands can make the remaining estimate more credible, but it narrows the population being studied.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a causal design decision: choose only pre-treatment covariates that are plausible common causes of treatment and outcome. Estimate the propensity score from those covariates. Then use the score to match units, subclassify them into score bands, or weight them so treated and control groups represent a common target population.',
        'After adjustment, compute standardized mean differences for the covariates. This is the balance audit. A good result is not "the propensity model predicted treatment well." A good result is "important covariates are balanced after adjustment, and both groups have support in the score range used by the estimate."',
        'Then inspect weight stability. For the average treatment effect, treated units often receive weight 1 / e(x), and controls receive weight 1 / (1 - e(x)). Scores near 0 or 1 create large weights. Stabilized weights, trimming, matching calipers, or a narrower estimand may be needed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The key theorem is that the propensity score is a balancing score: under the usual assumptions, conditioning on the true propensity score balances the observed covariates between treated and untreated units. That lets a high-dimensional adjustment problem become a lower-dimensional design problem.',
        'The word "observed" matters. Propensity scores cannot balance variables that were not measured, variables measured after treatment, or variables chosen in a way that opens collider bias. The score helps only inside a credible causal design.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main statistical cost is variance. Extreme weights make the estimate sensitive to a small number of units, so confidence intervals widen and small data errors matter more. The main design cost is scope. Trimming non-overlap often improves credibility, but the estimand becomes the effect for the overlap population, not the effect for everyone.',
        'There is also a modeling tradeoff. A score model must be good enough to balance confounders, but not judged only by treatment-prediction accuracy. A model that perfectly separates treated from control units is a warning sign for causal estimation, not a victory.',
        'Good reports make that scope change explicit. If trimming removes the sickest patients or newest accounts, the final estimate should name the remaining population. Otherwise a careful overlap decision can be misread as a claim about everyone.',
        'The diagnostic output should therefore include both the original population and the retained overlap population.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Propensity diagnostics are useful when treatment is observational, the analyst has rich pre-treatment covariates, and there is real overlap between treated and control groups. They are especially helpful in healthcare, education, pricing, marketing, policy evaluation, and product experiments where randomization was absent or incomplete.',
        'They work best as part of a full design report: causal graph, covariate list, score model, overlap plot, trimming rule, balance table, weight summary, and sensitivity checks. The diagnostics are the evidence that the comparison was constructed rather than merely asserted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when important confounders are missing. If physician judgment, income, disease severity, sales intent, or user motivation drives both treatment and outcome but is not captured, balance on measured covariates can still leave a biased estimate.',
        'It also fails when overlap is weak, when post-treatment variables are included, when colliders are adjusted for, or when the score model is treated as a black-box leaderboard problem. The target is a credible comparison, not the highest AUC.',
      ],
    },
    {
      heading: 'Worked case study',
      paragraphs: [
        'A hospital wants to estimate whether a nurse outreach program reduces 30-day readmissions. The treated patients are older, have higher risk scores, and used more care before enrollment. The raw readmission rate is lower for treated patients, but that number is not interpretable because program staff selected patients deliberately.',
        'The team estimates propensity from age, prior admissions, diagnosis group, risk score, region, and pre-treatment utilization. The overlap table shows that the lowest-risk controls and highest-risk treated patients have no good counterparts, so those bands are trimmed. The estimand is now the effect for patients who could plausibly have been in either group.',
        'After weighting, age, risk score, and region are balanced, but prior utilization still has a standardized mean difference of 0.18. The study does not report the treatment effect yet. It revises the score model, checks matching calipers, and reports the balance table with the final estimate. That discipline is the point of the method: the causal claim starts with the design, not with the outcome regression.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Rosenbaum and Rubin, "The central role of the propensity score in observational studies for causal effects" at https://academic.oup.com/biomet/article/70/1/41/240879 and a PDF mirror at https://www.stat.cmu.edu/~ryantibs/journalclub/rosenbaum_1983.pdf.',
        'Study Causal Graphs, Doubly Robust Estimation, Importance Sampling, Instrumental Variables, and Causal Forest Uplift Policy next.',
      ],
    },
  ],
};
