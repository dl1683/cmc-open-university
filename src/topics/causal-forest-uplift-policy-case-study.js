// Causal forests: honest tree neighborhoods estimate heterogeneous treatment
// effects, then policy targeting ranks users by expected uplift.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'causal-forest-uplift-policy-case-study',
  title: 'Causal Forest Uplift Policy',
  category: 'AI & ML',
  summary: 'Estimate heterogeneous treatment effects with honest forest leaves, then target the users whose predicted uplift justifies intervention.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['honest leaves', 'uplift policy'], defaultValue: 'honest leaves' },
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

function forestGraph(title) {
  return graphState({
    nodes: [
      { id: 'logs', label: 'logs', x: 0.7, y: 3.2, note: 'T,Y,X' },
      { id: 'nuisance', label: 'nuis', x: 2.15, y: 2.0, note: 'm,e' },
      { id: 'split', label: 'split', x: 2.15, y: 4.35, note: 'honest' },
      { id: 'trees', label: 'forest', x: 3.85, y: 3.2, note: 'leaves' },
      { id: 'leaf', label: 'leaf', x: 5.35, y: 3.2, note: 'neighbors' },
      { id: 'cate', label: 'CATE', x: 6.85, y: 2.0, note: 'effect' },
      { id: 'rank', label: 'rank', x: 6.85, y: 4.35, note: 'uplift' },
      { id: 'policy', label: 'policy', x: 8.4, y: 3.2, note: 'target' },
    ],
    edges: [
      { id: 'e-logs-nuisance', from: 'logs', to: 'nuisance' },
      { id: 'e-logs-split', from: 'logs', to: 'split' },
      { id: 'e-split-trees', from: 'split', to: 'trees' },
      { id: 'e-nuisance-trees', from: 'nuisance', to: 'trees' },
      { id: 'e-trees-leaf', from: 'trees', to: 'leaf' },
      { id: 'e-leaf-cate', from: 'leaf', to: 'cate' },
      { id: 'e-cate-rank', from: 'cate', to: 'rank' },
      { id: 'e-rank-policy', from: 'rank', to: 'policy' },
    ],
  }, { title });
}

function* honestLeaves() {
  yield {
    state: forestGraph('Causal forests estimate effects that vary by covariates'),
    highlight: { active: ['logs', 'trees', 'leaf'], compare: ['policy'] },
    explanation: 'A causal forest is not just a random forest that predicts outcomes. It builds adaptive neighborhoods where treated and control outcomes can be compared to estimate heterogeneous treatment effects.',
  };

  yield {
    state: labelMatrix(
      'Honesty splits roles',
      [
        { id: 'split', label: 'split set' },
        { id: 'estimate', label: 'estimate set' },
        { id: 'nuisance', label: 'nuisance' },
        { id: 'test', label: 'test set' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why' },
      ],
      [
        ['choose leaves', 'avoid bias'],
        ['estimate CATE', 'honest effects'],
        ['m(x),e(x)', 'deconfound'],
        ['evaluate', 'no peeking'],
      ],
    ),
    highlight: { active: ['split:role', 'estimate:role'], found: ['test:why'], compare: ['nuisance:role'] },
    explanation: 'Honest trees separate the data used to decide splits from the data used to estimate effects inside leaves. That reduces adaptive overfitting to noisy treatment-effect differences.',
    invariant: 'A leaf is useful only if it contains comparable treated and control evidence.',
  };

  yield {
    state: forestGraph('Leaves become adaptive causal neighborhoods'),
    highlight: { active: ['trees', 'leaf', 'cate'], found: ['nuisance'] },
    explanation: 'Each tree routes a user to a leaf. Across many trees, the forest produces weights over similar training examples. Those weighted neighbors estimate the conditional treatment effect for that user.',
  };

  yield {
    state: labelMatrix(
      'Leaf-level effect estimate',
      [
        { id: 'young', label: 'young low' },
        { id: 'loyal', label: 'loyal' },
        { id: 'new', label: 'new users' },
        { id: 'churn', label: 'churn risk' },
      ],
      [
        { id: 'treated Y', label: 'T mean' },
        { id: 'control Y', label: 'C mean' },
        { id: 'uplift', label: 'uplift' },
      ],
      [
        ['0.28', '0.23', '+0.05'],
        ['0.42', '0.41', '+0.01'],
        ['0.30', '0.18', '+0.12'],
        ['0.24', '0.29', '-0.05'],
      ],
    ),
    highlight: { found: ['new:uplift'], compare: ['loyal:uplift'], removed: ['churn:uplift'] },
    explanation: 'The forest is valuable when effects differ. A coupon may help new users, do almost nothing for loyal users, and harm churn-risk users by training them to wait for discounts.',
  };

  yield {
    state: forestGraph('CATE estimates feed policy learning'),
    highlight: { active: ['cate', 'rank', 'policy'], compare: ['leaf'] },
    explanation: 'The output is not only an average effect. It is a ranking surface: who benefits enough from treatment to justify cost, risk, and capacity limits.',
  };
}

function* upliftPolicy() {
  yield {
    state: labelMatrix(
      'Target by net uplift, not response rate',
      [
        { id: 'u1', label: 'user A' },
        { id: 'u2', label: 'user B' },
        { id: 'u3', label: 'user C' },
        { id: 'u4', label: 'user D' },
      ],
      [
        { id: 'pY', label: 'P(Y)' },
        { id: 'uplift', label: 'uplift' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['0.80', '+0.01', 'skip'],
        ['0.31', '+0.14', 'treat'],
        ['0.46', '-0.03', 'skip'],
        ['0.22', '+0.09', 'treat'],
      ],
    ),
    highlight: { found: ['u2:decision', 'u4:decision'], compare: ['u1:pY'], removed: ['u3:decision'] },
    explanation: 'Uplift targeting differs from ordinary response modeling. A user with high purchase probability may buy anyway, so the treatment effect is small. Target the incremental gain, not the raw outcome probability.',
  };

  yield {
    state: forestGraph('Policy targeting applies cost and capacity constraints'),
    highlight: { active: ['rank', 'policy'], found: ['cate'], compare: ['logs'] },
    explanation: 'A policy layer sorts by estimated treatment effect minus treatment cost, then applies budget, fairness, eligibility, and safety constraints.',
  };

  yield {
    state: labelMatrix(
      'Qini-style uplift buckets',
      [
        { id: 'top10', label: 'top 10%' },
        { id: 'top20', label: 'top 20%' },
        { id: 'top40', label: 'top 40%' },
        { id: 'all', label: 'all' },
      ],
      [
        { id: 'gain', label: 'gain' },
        { id: 'cost', label: 'cost' },
        { id: 'net', label: 'net' },
      ],
      [
        ['+120', '30', '+90'],
        ['+190', '70', '+120'],
        ['+230', '160', '+70'],
        ['+250', '400', '-150'],
      ],
    ),
    highlight: { found: ['top20:net'], compare: ['top40:net'], removed: ['all:net'] },
    explanation: 'The best policy may treat only a fraction of users. Uplift curves show whether the ranking concentrates incremental impact or merely finds people who would have converted anyway.',
  };

  yield {
    state: labelMatrix(
      'Complete case: retention coupon',
      [
        { id: 'log', label: 'logs' },
        { id: 'forest', label: 'forest' },
        { id: 'policy', label: 'policy' },
        { id: 'ab', label: 'A/B' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['randomized', 'best'],
        ['CATE rank', 'target'],
        ['top 20%', 'budget'],
        ['holdout', 'verify'],
      ],
    ),
    highlight: { active: ['forest:lesson', 'policy:lesson'], found: ['ab:lesson'] },
    explanation: 'Case study: a retention coupon should not go to everyone. A causal forest ranks users by expected incremental retention, the policy treats the top budget-constrained slice, and an A/B holdout verifies the gain.',
  };

  yield {
    state: forestGraph('Causal forests need causal design discipline'),
    highlight: { active: ['logs', 'nuisance', 'cate'], found: ['policy'], compare: ['split'] },
    explanation: 'The forest does not erase confounding. Randomized logs are strongest. Observational logs need propensity, outcome nuisance models, overlap checks, and doubly robust discipline.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'honest leaves') yield* honestLeaves();
  else if (view === 'uplift policy') yield* upliftPolicy();
  else throw new InputError('Pick a causal forest view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A causal forest estimates heterogeneous treatment effects: how much a treatment changes an outcome for different kinds of units. It adapts random-forest neighborhoods to causal questions, then ranks units by predicted uplift for policy targeting.',
        'This is different from predicting who will buy, churn, recover, or click. Uplift asks who changes because of treatment. A high-probability user may have low uplift if they would act anyway.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Causal forests build many trees that split on covariates to find leaves where treatment effects differ. Honest estimation separates split selection from effect estimation. Modern generalized random forest workflows also estimate nuisance functions such as outcome baselines and propensity scores, then use residualized comparisons to estimate CATE.',
        'The policy layer ranks units by estimated effect minus cost, then applies eligibility, fairness, capacity, and safety constraints. Offline uplift ranking should be verified by randomized holdouts whenever possible.',
      ],
    },
    {
      heading: 'Complete case study: retention coupon',
      paragraphs: [
        'A subscription company wants to send retention coupons. A normal response model targets users likely to renew, wasting coupons on people who would renew anyway. A causal forest estimates incremental renewal lift and finds that new price-sensitive users respond strongly, loyal users barely move, and some churn-risk users react negatively.',
        'The policy treats the top uplift slice under a budget constraint and keeps a randomized holdout. The business evaluates incremental renewals and coupon cost, not raw renewal rate among targeted users.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A causal forest is not a confounding eraser. If treatment assignment is observational, the estimate depends on measured covariates, overlap, nuisance models, and causal assumptions. Without comparable treated and control examples in a region, leaf estimates are extrapolation.',
        'Do not optimize only for uplift rank offline. Policies can fail under capacity limits, fairness constraints, treatment interference, delayed outcomes, or targeting feedback loops. Always separate estimation from policy evaluation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Generalized Random Forests at https://arxiv.org/pdf/1610.01271 and the grf project at https://grf-labs.github.io/grf/. Study Random Forest, Doubly Robust Estimation, Propensity Score Overlap Diagnostics, Causal Graphs, A/B Testing, and Multi-Armed Bandits next.',
      ],
    },
  ],
};
