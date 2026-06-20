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
        {
          type: 'note',
          text: 'If a covariate still shows a large standardized mean difference after adjustment, the design is not ready. The animation highlights this with "watch" verdicts. Do not interpret the treatment effect until every important covariate is balanced.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In observational data, treatment is not assigned by coin flip. Sicker patients are more likely to enroll in care programs. Heavy users are more likely to receive retention offers. High-risk accounts are more likely to get a phone call. A raw comparison of outcomes between treated and untreated groups confounds the effect of treatment with the reasons treatment was assigned.',
        'Propensity score diagnostics exist to answer a question that comes before estimation: does the data contain fair comparisons at all? They cannot prove causality. They can show whether the proposed adjustment is staying inside the region of covariate space where both treated and untreated units exist, and whether the adjusted groups look similar on measured pre-treatment characteristics.',
        {
          type: 'quote',
          text: 'The propensity score is the conditional probability of assignment to a particular treatment given a vector of observed covariates.',
          attribution: 'Paul Rosenbaum and Donald Rubin, "The central role of the propensity score in observational studies for causal effects," Biometrika 70(1), 1983',
        },
        'Rosenbaum and Rubin proved that conditioning on this single scalar balances all the observed covariates used to compute it. That result converts a high-dimensional matching problem into a one-dimensional design problem -- but it only works for the covariates you actually measured.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to fit an outcome regression: regress the outcome on treatment plus covariates, and read the treatment coefficient. This looks like ordinary prediction work. Teams reach for it because the tooling is familiar, the output is a single number, and adding more covariates feels like adding more control.',
        {
          type: 'diagram',
          label: 'Outcome regression: treatment effect as a coefficient',
          text: [
            'Y = beta_0 + beta_1 * T + beta_2 * age + beta_3 * risk + ... + epsilon',
            '',
            'Read beta_1 as "the treatment effect."',
            '',
            'Problem: beta_1 is only valid if treated and control',
            'units overlap on every covariate. If treated patients',
            'are all age 70+ and controls are all age 30-50, the',
            'model extrapolates across a 20-year gap it never saw.',
          ].join('\n'),
        },
        'The approach works when treatment assignment is close to random, covariates are balanced by design, and the outcome model is correctly specified. In a well-run A/B test, it is fine. In observational data, at least one of those conditions usually fails.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is common support. If treated units live in a covariate region where no comparable control units exist, the outcome model is guessing what would have happened without treatment. It is fitting a surface through a region with no data and calling the extrapolation a causal effect.',
        {
          type: 'table',
          headers: ['Failure mode', 'What happens', 'Why the model hides it'],
          rows: [
            ['No overlap', 'Treated and control groups occupy different covariate regions', 'The regression draws a line between two clusters and reports the gap as a treatment effect'],
            ['Near-deterministic assignment', 'Propensity scores near 0 or 1', 'Inverse-propensity weights explode; one or two rows dominate the entire estimate'],
            ['Specification error', 'Outcome model is wrong in the treatment-control gap', 'A linear model cannot detect its own misspecification in a region without comparison data'],
            ['Collider conditioning', 'Post-treatment variable included as covariate', 'Balance on a mediator or collider opens new confounding paths the analyst did not intend'],
          ],
        },
        'A more flexible model -- gradient boosting, a neural net -- does not solve the common support problem. It can make the lack of overlap harder to detect by fitting complex extrapolation patterns without complaint. The issue is not modeling power. The issue is that there is no data to model.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The propensity score is a design tool, not an estimation tool. It estimates e(x) = P(T = 1 | X): the probability that a unit receives treatment given observed pre-treatment covariates. Units with similar propensity scores had similar measured chances of receiving treatment, even if their raw covariate vectors are high-dimensional.',
        {
          type: 'note',
          text: 'The balancing property: if two units have the same propensity score, the distribution of observed covariates X is the same for the treated and untreated subpopulations at that score value. This is a theorem, not a heuristic -- but it holds only for the covariates included in the score model.',
        },
        'That single number gives the analyst a practical handle. Match units with similar scores. Form score bands and compare within bands. Weight each unit by the inverse of its treatment probability. In each case, the propensity score is not the treatment effect. It is a way to construct and audit a comparison before outcomes are examined.',
        {
          type: 'diagram',
          label: 'Propensity score pipeline: design comes before estimation',
          text: [
            '  Covariates (X)  -->  Score model  -->  e(x) = P(T=1|X)',
            '  Treatment (T)  -/                        |',
            '                                    +------+------+',
            '                                    |             |',
            '                                 Matching      Weighting',
            '                                 or bins       (IPW)',
            '                                    |             |',
            '                                    +------+------+',
            '                                           |',
            '                                    Balance audit',
            '                                    (SMD table)',
            '                                           |',
            '                                  Pass?  --+--> Estimate effect',
            '                                  Fail?  --+--> Revise design',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The diagnostic pipeline has five stages. Each one must pass before the next is meaningful.',
        {
          type: 'bullets',
          items: [
            'Stage 1 -- Covariate selection: Choose only pre-treatment variables that are plausible common causes of both treatment assignment and the outcome. Excluding a real confounder biases the estimate. Including a post-treatment variable (a mediator or collider) opens new bias paths.',
            'Stage 2 -- Score estimation: Fit a model (logistic regression, GBM, BART) predicting treatment from those covariates. The goal is balance, not prediction accuracy. A model that perfectly separates treated from control is a warning sign: it means the groups do not overlap.',
            'Stage 3 -- Adjustment: Use the score to match, stratify, or weight. For the ATE, treated units get weight 1/e(x) and controls get weight 1/(1-e(x)). For the ATT, only controls are reweighted. Matching uses calipers on the score distance.',
            'Stage 4 -- Balance audit: Compute the standardized mean difference (SMD) for every covariate, before and after adjustment. The threshold is typically SMD < 0.1 for continuous covariates and < 0.05 for dichotomous ones.',
            'Stage 5 -- Overlap inspection: Check the propensity score distribution in both groups. Trim or down-weight units in regions where one group has near-zero density. Report the resulting target population explicitly.',
          ],
        },
        {
          type: 'code',
          language: 'javascript',
          label: 'Standardized mean difference: the core balance metric',
          text: [
            '// SMD: difference in means scaled by pooled standard deviation.',
            '// An absolute SMD above 0.1 signals residual imbalance after adjustment.',
            'function smd(treatedValues, controlValues) {',
            '  const meanT = mean(treatedValues);',
            '  const meanC = mean(controlValues);',
            '  const varT = variance(treatedValues);',
            '  const varC = variance(controlValues);',
            '  const pooledSD = Math.sqrt((varT + varC) / 2);',
            '  return (meanT - meanC) / pooledSD;',
            '}',
            '',
            '// After IPW adjustment, compute weighted SMD:',
            'function weightedSMD(treatedVals, treatedWts, controlVals, controlWts) {',
            '  const wMeanT = weightedMean(treatedVals, treatedWts);',
            '  const wMeanC = weightedMean(controlVals, controlWts);',
            '  // Use unweighted pooled SD as the denominator (Austin 2009)',
            '  const pooledSD = Math.sqrt((variance(treatedVals) + variance(controlVals)) / 2);',
            '  return (wMeanT - wMeanC) / pooledSD;',
            '}',
          ].join('\n'),
        },
        'The SMD uses the unweighted pooled standard deviation in the denominator even after weighting. This follows Austin (2009): using the weighted variance would let extreme weights shrink the denominator and mask persistent imbalance.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The Rosenbaum-Rubin theorem (1983) proves that the propensity score is a balancing score. Formally: if treatment assignment is strongly ignorable given X -- meaning (Y(0), Y(1)) is independent of T conditional on X -- then it is also strongly ignorable given e(X) alone. Conditioning on the scalar e(X) removes confounding bias from every observed covariate simultaneously.',
        {
          type: 'diagram',
          label: 'Why the balancing property works',
          text: [
            'Without propensity score:',
            '  Must balance X = (age, risk, prior_use, region, ...)',
            '  Curse of dimensionality: sparse cells in high-D space',
            '',
            'With propensity score:',
            '  e(X) collapses all covariates into one dimension',
            '  At any value e(X) = c, the distribution of X is',
            '  the same for treated and untreated units',
            '',
            'This is not an approximation. It is a mathematical',
            'consequence of the definition of conditional probability.',
            'But it holds ONLY for covariates included in the model.',
          ].join('\n'),
        },
        'Two conditions must hold for the result to support causal claims. First, strong ignorability: no unmeasured confounders exist. This is untestable from data alone and must be argued from domain knowledge. Second, positivity: every unit must have a nonzero probability of receiving either treatment or control. Positivity violations show up as propensity scores near 0 or 1, and they are exactly what overlap diagnostics detect.',
        {
          type: 'note',
          text: 'The word "observed" in "observed covariates" is doing all the heavy lifting. Propensity scores balance what you measured. They cannot balance what you did not measure, what you measured after treatment, or what you included in a way that opens collider bias. The score helps only inside a credible causal design.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computational cost of propensity diagnostics is negligible compared to the data collection it relies on. Fitting a logistic regression on n units with p covariates is O(np) per iteration. Computing SMDs is O(np). The real costs are statistical and inferential.',
        {
          type: 'table',
          headers: ['Cost dimension', 'Mechanism', 'Practical impact'],
          rows: [
            ['Variance inflation', 'Extreme IPW weights let a few rows dominate', 'Confidence intervals widen by 2-10x in poor-overlap settings; effective sample size can drop to single digits'],
            ['Scope narrowing', 'Trimming non-overlap regions changes the estimand', 'The result applies to the overlap population, not necessarily the full population of interest'],
            ['Model dependence', 'Score model specification affects which units match', 'Different models (logit vs. GBM) produce different scores, different overlap boundaries, different estimates'],
            ['Multiple testing', 'Checking many covariates for balance', 'No formal multiplicity correction is standard; interpret the full balance table, not individual p-values'],
            ['Iteration cost', 'Revising the score model to improve balance', 'Each revision risks overfitting the design to the data; pre-register the covariate list when possible'],
          ],
        },
        'The modeling tradeoff is subtle. A score model should be good enough to balance confounders, but prediction accuracy is not the goal. A model with AUC = 0.99 means the groups are almost perfectly separable -- which means there is almost no overlap. For causal estimation, that is a crisis, not a victory.',
        {
          type: 'code',
          language: 'javascript',
          label: 'IPW weight explosion near the boundaries',
          text: [
            '// For the ATE, IPW weights are:',
            '//   Treated: w = 1 / e(x)',
            '//   Control: w = 1 / (1 - e(x))',
            '',
            '// Example: what happens as e(x) approaches 0 or 1',
            '// e(x) = 0.50  =>  T weight = 2.0,   C weight = 2.0    (stable)',
            '// e(x) = 0.10  =>  T weight = 10.0,   C weight = 1.1   (T inflated)',
            '// e(x) = 0.03  =>  T weight = 33.3,   C weight = 1.03  (T dominates)',
            '// e(x) = 0.97  =>  T weight = 1.03,  C weight = 33.3   (C dominates)',
            '',
            '// Stabilized weights reduce variance:',
            '// sw_treated = P(T=1) / e(x)',
            '// sw_control = P(T=0) / (1 - e(x))',
            '// This replaces the numerator 1 with the marginal treatment probability.',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Propensity diagnostics appear wherever treatment was not randomized and the stakes of a wrong causal claim are high.',
        {
          type: 'table',
          headers: ['Domain', 'Treatment', 'Outcome', 'Why propensity diagnostics matter'],
          rows: [
            ['Epidemiology', 'Drug exposure or surgical procedure', 'Mortality, adverse events', 'FDA requires comparative effectiveness studies when RCTs are infeasible; propensity analyses are standard in pharmacoepidemiology'],
            ['Education policy', 'Charter school attendance', 'Test scores, graduation rates', 'Students self-select into programs; overlap diagnostics reveal which students have comparable peers in traditional schools'],
            ['Tech product experiments', 'Feature rollout to opted-in users', 'Engagement, revenue', 'When an A/B test is contaminated or a feature launched without randomization, propensity methods are the fallback'],
            ['Labor economics', 'Job training program enrollment', 'Employment, wages', 'LaLonde (1986) showed that observational methods can fail badly; propensity diagnostics quantify how badly'],
            ['Marketing', 'Coupon or discount offer', 'Purchase, retention', 'Customers who receive offers are already more engaged; raw lift numbers are meaningless without overlap-checked adjustment'],
          ],
        },
        'The diagnostics work best as part of a complete design report: causal graph, covariate justification, score model specification, overlap histogram, trimming rule, balance table, weight summary, and sensitivity analysis. The table and the histogram are the evidence that the comparison was constructed, not merely asserted.',
        {
          type: 'quote',
          text: 'Estimation of the average causal effect of a treatment [...] requires strong assumptions that are not refutable from the data. Rather than debating such assumptions, the focus should be on the design of studies that best approximate a randomized experiment.',
          attribution: 'Guido Imbens, "Nonparametric Estimation of Average Treatment Effects Under Exogeneity: A Review," Review of Economics and Statistics, 2004',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Propensity score methods fail in predictable ways. Each failure mode is detectable if the analyst looks.',
        {
          type: 'bullets',
          items: [
            'Unmeasured confounders: If physician judgment, patient motivation, socioeconomic status, or managerial intent drives both treatment and outcome but is not captured, perfect balance on measured covariates still leaves a biased estimate. No amount of propensity modeling fixes missing data.',
            'Weak overlap: When treated and control propensity distributions barely touch, matching discards most of the sample, weighting produces extreme variance, and the effective sample size collapses. The Crump et al. (2009) rule trims units with e(x) outside [0.1, 0.9], but this can remove the most policy-relevant population.',
            'Post-treatment covariates: Including a variable affected by treatment (a mediator) as a covariate in the score model opens new confounding paths. The balance table looks clean, but the estimate is biased by conditioning on a descendant of treatment.',
            'Collider bias: Adjusting for a common effect of treatment and outcome induces a spurious association. This is a structural error in the causal graph, not a modeling error, and propensity diagnostics cannot detect it without domain knowledge.',
            'Model-as-leaderboard: Treating the propensity model as a prediction contest (maximize AUC, use 200 features) misses the point. The goal is balance, not classification accuracy. A perfect classifier means zero overlap.',
          ],
        },
        {
          type: 'note',
          text: 'Sensitivity analysis (Rosenbaum bounds, E-values) can quantify how strong an unmeasured confounder would need to be to explain away the observed effect. This does not prove the absence of confounding, but it tells you whether the result is robust to plausible hidden bias.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A hospital system wants to estimate whether a nurse outreach program reduces 30-day readmissions. The program was not randomized: clinical staff enrolled patients they judged to be at highest risk of returning.',
        {
          type: 'table',
          headers: ['Covariate', 'Treated (n=312)', 'Control (n=1,847)', 'Raw SMD'],
          rows: [
            ['Mean age', '68.4', '52.1', '0.72'],
            ['Risk score (0-100)', '74.2', '41.8', '0.94'],
            ['Prior admissions (12 mo)', '2.8', '0.9', '0.81'],
            ['Urban residence', '78%', '61%', '0.36'],
            ['Diabetes diagnosis', '44%', '22%', '0.48'],
            ['Medicaid coverage', '62%', '34%', '0.57'],
          ],
        },
        'Every covariate is severely imbalanced. The treated patients are older, sicker, and more disadvantaged. A raw comparison showing lower readmission rates for treated patients is uninterpretable -- the program was given to people the staff expected to need it most.',
        'The team fits a logistic propensity model using these six covariates. The overlap histogram reveals the problem:',
        {
          type: 'diagram',
          label: 'Propensity score distributions before trimming',
          text: [
            'Control group:     Treated group:',
            '',
            '  ||||                          ',
            '  ||||||                        |',
            '  ||||||||                    |||',
            '  ||||||||||||            |||||||',
            '  ||||||||||||||||||  ||||||||||||',
            '  --------------------------------',
            '  0.0  0.2  0.4  0.6  0.8  1.0',
            '',
            'Controls cluster at low scores (low treatment probability).',
            'Treated patients cluster at high scores.',
            'Overlap region: roughly e(x) in [0.15, 0.75].',
            'Tails have no counterparts -- trim these bands.',
          ].join('\n'),
        },
        'After trimming units with e(x) < 0.10 or e(x) > 0.90, the team applies stabilized IPW and recomputes the balance table:',
        {
          type: 'table',
          headers: ['Covariate', 'Raw SMD', 'Weighted SMD', 'Verdict'],
          rows: [
            ['Age', '0.72', '0.06', 'Balanced'],
            ['Risk score', '0.94', '0.09', 'Balanced'],
            ['Prior admissions', '0.81', '0.18', 'Imbalanced -- revise'],
            ['Urban residence', '0.36', '0.04', 'Balanced'],
            ['Diabetes', '0.48', '0.07', 'Balanced'],
            ['Medicaid', '0.57', '0.05', 'Balanced'],
          ],
        },
        'Prior admissions remain imbalanced (SMD = 0.18). The team adds an interaction term (risk score * prior admissions) to the propensity model, re-estimates scores, and re-checks balance. After revision, prior admissions drops to SMD = 0.08. All covariates pass the 0.10 threshold.',
        'The effective sample size after weighting is 189 treated and 423 control units -- smaller than the raw sample because extreme weights were stabilized. The estimated treatment effect is a 4.2 percentage-point reduction in 30-day readmissions (95% CI: -7.1 to -1.3). The team reports this as the effect for the overlap population (moderate-risk patients), not for all patients, because the highest-risk treated patients had no comparable controls.',
        {
          type: 'note',
          text: 'The discipline is the point: the study did not report the treatment effect until the balance table was clean, the overlap population was defined, and the weight distribution was stable. The causal claim starts with the design, not with the outcome regression.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Rosenbaum and Rubin, "The central role of the propensity score in observational studies for causal effects," Biometrika 70(1), 1983. Available at https://academic.oup.com/biomet/article/70/1/41/240879. This paper proves the balancing property and defines the theoretical foundation.',
            'Balance diagnostics: Austin, "Balance diagnostics for comparing the distribution of baseline covariates between treatment groups in propensity-score matched samples," Statistics in Medicine 28(25), 2009. Establishes the SMD < 0.1 threshold and the use of unweighted pooled SD in the denominator.',
            'Overlap trimming: Crump, Hotz, Imbens, and Mitnik, "Dealing with limited overlap in estimation of average treatment effects," Biometrika 96(1), 2009. Derives the optimal trimming rule for efficient ATE estimation.',
            'Sensitivity analysis: Rosenbaum, "Observational Studies," Springer, 2002 (2nd edition). Develops the framework for bounding the effect of unmeasured confounders.',
            'Practical guide: Imbens and Rubin, "Causal Inference for Statistics, Social, and Biomedical Sciences," Cambridge University Press, 2015. Chapters 12-14 walk through propensity methods with worked examples.',
          ],
        },
        {
          type: 'table',
          headers: ['Study next', 'Role', 'Why'],
          rows: [
            ['Causal Graphs (DAGs)', 'Prerequisite', 'Propensity score covariate selection depends on understanding which variables are confounders, mediators, and colliders'],
            ['Doubly Robust Estimation', 'Extension', 'Combines propensity weighting with outcome modeling; consistent if either the propensity or outcome model is correct'],
            ['Causal Forest Uplift Policy', 'Case study', 'Uses propensity scores as nuisance parameters inside a heterogeneous treatment effect estimator'],
            ['Instrumental Variables', 'Alternative', 'When overlap is too weak or unmeasured confounding is too likely, IV methods use a different identification strategy'],
            ['Importance Sampling', 'Connection', 'IPW in causal inference is mathematically identical to importance sampling in Monte Carlo estimation'],
          ],
        },
      ],
    },
  ],
};
