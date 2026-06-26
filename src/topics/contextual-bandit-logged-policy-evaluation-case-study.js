// Contextual bandit logged policy evaluation: the production bridge between
// bandit exploration, sparse online learners, delayed labels, and offline
// counterfactual gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'contextual-bandit-logged-policy-evaluation-case-study',
  title: 'Contextual Bandit Logged Policy Evaluation Case Study',
  category: 'AI & ML',
  summary: 'How production recommenders log contexts, actions, rewards, and propensities so future policies can be evaluated before they touch users.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['logged propensities', 'off-policy estimator'], defaultValue: 'logged propensities' },
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

function decisionGraph(title) {
  return graphState({
    nodes: [
      { id: 'ctx', label: 'context', x: 0.6, y: 3.4, note: 'features' },
      { id: 'policy', label: 'policy', x: 2.0, y: 3.4, note: 'old pi' },
      { id: 'pmf', label: 'pmf', x: 3.4, y: 2.0, note: 'probs' },
      { id: 'sample', label: 'sample', x: 4.8, y: 2.0, note: 'chosen' },
      { id: 'log', label: 'log', x: 6.2, y: 3.4, note: 'row' },
      { id: 'reward', label: 'reward', x: 4.8, y: 4.8, note: 'delayed' },
      { id: 'join', label: 'join', x: 6.2, y: 4.8, note: 'label' },
      { id: 'ope', label: 'OPE', x: 7.8, y: 3.4, note: 'eval' },
      { id: 'gate', label: 'gate', x: 9.2, y: 3.4, note: 'ship' },
    ],
    edges: [
      { id: 'e-ctx-policy', from: 'ctx', to: 'policy' },
      { id: 'e-policy-pmf', from: 'policy', to: 'pmf' },
      { id: 'e-pmf-sample', from: 'pmf', to: 'sample' },
      { id: 'e-sample-log', from: 'sample', to: 'log' },
      { id: 'e-reward-join', from: 'reward', to: 'join' },
      { id: 'e-join-log', from: 'join', to: 'log' },
      { id: 'e-log-ope', from: 'log', to: 'ope' },
      { id: 'e-ope-gate', from: 'ope', to: 'gate' },
    ],
  }, { title });
}

function replayGraph(title) {
  return graphState({
    nodes: [
      { id: 'logs', label: 'logs', x: 0.8, y: 3.3, note: 'frozen' },
      { id: 'cand', label: 'new pi', x: 2.4, y: 2.0, note: 'scores' },
      { id: 'match', label: 'match', x: 4.1, y: 3.3, note: 'same act' },
      { id: 'weight', label: 'weight', x: 5.8, y: 3.3, note: 'p/q' },
      { id: 'model', label: 'model', x: 5.8, y: 5.0, note: 'reward' },
      { id: 'value', label: 'value', x: 7.5, y: 3.3, note: 'estimate' },
      { id: 'ab', label: 'A/B', x: 9.0, y: 3.3, note: 'final' },
    ],
    edges: [
      { id: 'e-logs-match', from: 'logs', to: 'match' },
      { id: 'e-cand-match', from: 'cand', to: 'match' },
      { id: 'e-match-weight', from: 'match', to: 'weight' },
      { id: 'e-weight-value', from: 'weight', to: 'value' },
      { id: 'e-model-value', from: 'model', to: 'value' },
      { id: 'e-value-ab', from: 'value', to: 'ab' },
    ],
  }, { title });
}

const LOG_ROWS = [
  { id: 'r1', label: 'req 1', ctx: 'home', act: 'story A', q: 0.50, r: 1, p: 0.20 },
  { id: 'r2', label: 'req 2', ctx: 'search', act: 'story C', q: 0.10, r: 1, p: 0.60 },
  { id: 'r3', label: 'req 3', ctx: 'deal', act: 'story B', q: 0.20, r: 0, p: 0.40 },
  { id: 'r4', label: 'req 4', ctx: 'fresh', act: 'story D', q: 0.05, r: 1, p: 0.20 },
  { id: 'r5', label: 'req 5', ctx: 'cold', act: 'story E', q: 0.15, r: 0, p: 0.00 },
];

const fmt = (v, d = 2) => v.toFixed(d);
const weight = (row) => (row.q === 0 ? Infinity : row.p / row.q);

function* loggedPropensities() {
  yield {
    state: decisionGraph('Bandit logging is a future-evaluation contract'),
    highlight: { active: ['ctx', 'policy', 'pmf', 'sample', 'log', 'e-policy-pmf', 'e-pmf-sample', 'e-sample-log'], compare: ['reward', 'join'] },
    explanation: 'A contextual bandit observes user and item features, scores the available actions, samples from a probability mass function, and logs the exact probability of the action it actually took. That propensity field is not instrumentation trivia. It is the price tag that lets a future policy reuse this row honestly.',
    invariant: 'Every logged decision must preserve context, action set, chosen action, reward, policy version, and chosen-action probability.',
  };

  yield {
    state: labelMatrix(
      'Minimum useful logged bandit row',
      LOG_ROWS.map(({ id, label }) => ({ id, label })),
      [
        { id: 'ctx', label: 'ctx' },
        { id: 'act', label: 'act' },
        { id: 'old', label: 'p_old' },
        { id: 'reward', label: 'r' },
        { id: 'new', label: 'p_new' },
        { id: 'w', label: 'w' },
      ],
      LOG_ROWS.map((row) => [
        row.ctx,
        row.act,
        fmt(row.q),
        String(row.r),
        fmt(row.p),
        row.p === 0 ? '0.0x' : `${fmt(weight(row), 1)}x`,
      ]),
    ),
    highlight: { active: ['r1:old', 'r1:new', 'r1:w', 'r2:w', 'r4:w'], compare: ['r5:w'] },
    explanation: 'The candidate policy is evaluated only on actions the logger actually took. Row 2 matters a lot because the new policy would choose story C six times as often as the old policy did. Row 5 contributes nothing to this candidate because the candidate would never choose the logged action.',
    invariant: 'The importance weight w = pi_new(a|x) / pi_old(a|x) says how many candidate-policy worlds one logged row represents.',
  };

  yield {
    state: labelMatrix(
      'Support audit before any score is trusted',
      [
        { id: 'covered', label: 'covered' },
        { id: 'thin', label: 'thin arm' },
        { id: 'missing', label: 'missing' },
        { id: 'changed', label: 'changed set' },
        { id: 'stale', label: 'stale ctx' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'result', label: 'result' },
      ],
      [
        ['q > 0', 'usable'],
        ['q tiny', 'high var'],
        ['q = 0', 'no OPE'],
        ['new action', 'needs log'],
        ['new feats', 'rerun log'],
      ],
    ),
    highlight: { active: ['covered:result'], compare: ['thin:result'], removed: ['missing:result', 'changed:result'] },
    explanation: 'Off-policy evaluation starts with support, not with an estimator. If the old policy never displayed an action that the new policy wants to display, there is no reward evidence for that counterfactual. If support exists but is thin, the estimator may be unbiased and still too noisy to decide anything.',
  };

  yield {
    state: labelMatrix(
      'The data structures hiding in the log',
      [
        { id: 'pmf', label: 'PMF array' },
        { id: 'cat', label: 'catalog' },
        { id: 'row', label: 'event row' },
        { id: 'join', label: 'label join' },
        { id: 'eval', label: 'eval table' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['action probs', 'p_old'],
        ['eligible ids', 'support'],
        ['ctx+act+r', 'replay'],
        ['late reward', 'truth'],
        ['p_new,w,DR', 'gate'],
      ],
    ),
    highlight: { active: ['pmf:stores', 'row:stores', 'eval:stores'], compare: ['join:stores'] },
    explanation: 'The production structure is usually mundane: arrays for action probabilities, an action catalog for eligibility, an append-only event row, a delayed label join, and an evaluation table that materializes candidate probabilities and weights. The rigor lives in preserving the contract across time.',
  };

  yield {
    state: decisionGraph('Complete case: homepage news slot'),
    highlight: { active: ['ctx', 'pmf', 'log', 'reward', 'join', 'ope', 'gate'], found: ['gate'] },
    explanation: 'A news homepage has a changing pool of articles. The logging policy uses user context, time, device, and article features to sample a story, logs the selected-story probability, waits for click or dwell feedback, then lets future rankers be replayed on the same rows. This is why Vowpal Wabbit examples return both an action and the probability of choosing it.',
  };

  yield {
    state: labelMatrix(
      'What breaks the case study',
      [
        { id: 'prop', label: 'no prop' },
        { id: 'det', label: 'determinism' },
        { id: 'dupe', label: 'dupes' },
        { id: 'delay', label: 'delay' },
        { id: 'leak', label: 'leakage' },
      ],
      [
        { id: 'breaks', label: 'breaks' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['p/q', 'log PMF'],
        ['support', 'explore'],
        ['counting', 'id key'],
        ['labels', 'window'],
        ['eval', 'freeze'],
      ],
    ),
    highlight: { active: ['prop:guard', 'det:guard', 'delay:guard'], removed: ['leak:breaks'] },
    explanation: 'The common failures are engineering failures: no propensity, deterministic logging, duplicate events, premature negative labels, or candidate features computed with future data. The estimator cannot repair a broken log contract.',
  };
}

function* offPolicyEstimator() {
  const contributions = LOG_ROWS.map((row) => {
    const w = weight(row);
    const base = row.id === 'r1' ? 0.55 : row.id === 'r2' ? 0.65 : row.id === 'r3' ? 0.58 : row.id === 'r4' ? 0.52 : 0.42;
    const qhat = row.id === 'r1' ? 0.50 : row.id === 'r2' ? 0.70 : row.id === 'r3' ? 0.30 : row.id === 'r4' ? 0.45 : 0.25;
    const ips = w * row.r;
    const dr = base + w * (row.r - qhat);
    return { ...row, w, ips, base, dr };
  });

  yield {
    state: labelMatrix(
      'Estimator menu for logged bandits',
      [
        { id: 'dm', label: 'DM' },
        { id: 'ipw', label: 'IPW' },
        { id: 'snipw', label: 'SNIPW' },
        { id: 'dr', label: 'DR' },
        { id: 'switch', label: 'Switch' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['reward model', 'model bias'],
        ['p_new/p_old', 'weight var'],
        ['ratio norm', 'ratio bias'],
        ['model+resid', 'both wrong'],
        ['clip high w', 'clip bias'],
      ],
    ),
    highlight: { active: ['ipw:uses', 'dr:uses'], compare: ['dm:risk', 'ipw:risk'], found: ['switch:uses'] },
    explanation: 'The estimator choice is a risk trade. Direct method trusts a reward model. IPW trusts logged propensities. SNIPW stabilizes the ratio. DR uses the reward model as a baseline and weights only residuals. Switch estimators fall back to the model when weights are too large.',
    invariant: 'Estimator choice comes after the support audit; no estimator makes missing actions observable.',
  };

  yield {
    state: labelMatrix(
      'Per-row estimator contributions',
      contributions.map(({ id, label }) => ({ id, label })),
      [
        { id: 'w', label: 'w' },
        { id: 'ips', label: 'IPW' },
        { id: 'base', label: 'DM base' },
        { id: 'dr', label: 'DR' },
      ],
      contributions.map((row) => [
        `${fmt(row.w, 1)}x`,
        fmt(row.ips),
        fmt(row.base),
        fmt(row.dr),
      ]),
    ),
    highlight: { active: ['r2:w', 'r2:ips', 'r4:w', 'r4:ips'], compare: ['r2:dr', 'r4:dr'] },
    explanation: 'High weights make single rows loud. IPW lets the full reward ride on those weights. DR starts from a model-based baseline and weights the residual, so a useful reward model can make the same rows much less violent. With tiny examples the numbers can still swing; the point is the data structure of the calculation.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'logged decisions', min: 0, max: 10000 }, y: { label: 'effective samples', min: 0, max: 9000 } },
      series: [
        { id: 'good', label: 'good log', points: [{ x: 0, y: 0 }, { x: 1000, y: 820 }, { x: 3000, y: 2460 }, { x: 10000, y: 8200 }] },
        { id: 'thin', label: 'thin log', points: [{ x: 0, y: 0 }, { x: 1000, y: 180 }, { x: 3000, y: 540 }, { x: 10000, y: 1800 }] },
        { id: 'clip', label: 'clip 10', points: [{ x: 0, y: 0 }, { x: 1000, y: 430 }, { x: 3000, y: 1290 }, { x: 10000, y: 4300 }] },
      ],
      markers: [
        { id: 'floor', x: 3000, y: 1500, label: 'ESS floor' },
      ],
    }),
    highlight: { active: ['good'], compare: ['thin', 'clip', 'floor'] },
    explanation: 'Effective sample size is the receipt for the variance bill. A broad exploration logger preserves most of the data. A thin deterministic-ish logger burns data power because a few rare rows carry huge weights. Clipping improves variance but intentionally biases the estimate toward the logger.',
    invariant: 'More rows do not fix poor overlap quickly; better logging changes the slope of usable evidence.',
  };

  yield {
    state: replayGraph('Offline replay is a promotion gate, not a launch proof'),
    highlight: { active: ['logs', 'cand', 'match', 'weight', 'value'], compare: ['model'], found: ['ab'] },
    explanation: 'Replay and OPE are a gate before live exposure. They can reject obviously bad candidate policies, compare plausible variants, and estimate risk. They do not replace a final randomized launch guard when the change is material, because logged data cannot reveal outcomes in regions it did not explore.',
  };

  yield {
    state: labelMatrix(
      'Production gate checklist',
      [
        { id: 'support', label: 'support' },
        { id: 'ess', label: 'ESS' },
        { id: 'clip', label: 'clip' },
        { id: 'delay', label: 'delay' },
        { id: 'replay', label: 'replay' },
        { id: 'ab', label: 'A/B' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'if fail' },
      ],
      [
        ['all q>0', 'no OPE'],
        ['>= floor', 'collect more'],
        ['declared', 'bias note'],
        ['final label', 'wait/fix'],
        ['frozen code', 'leaky eval'],
        ['launch gate', 'no ship'],
      ],
    ),
    highlight: { active: ['support:check', 'ess:check', 'delay:check', 'replay:check'], found: ['ab:check'] },
    explanation: 'A serious bandit review has a checklist. Verify support, set an ESS floor, declare clipping or switch thresholds before reading outcomes, use finalized delayed labels, freeze replay code, and treat A/B as the final live guard for high-impact policy changes.',
  };

  yield {
    state: replayGraph('Complete case: search and ad placement'),
    highlight: { active: ['logs', 'cand', 'weight', 'model', 'value', 'ab'], compare: ['match'] },
    explanation: 'In search, recommendation, and ad placement, the candidate ranker often shares infrastructure with FTRL-Proximal Online CTR Case Study and Delayed Feedback Attribution Window Case Study. The logged policy must store propensities and action eligibility now so future counterfactual evaluation is not guesswork later.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'logged propensities') yield* loggedPropensities();
  else if (view === 'off-policy estimator') yield* offPolicyEstimator();
  else throw new InputError('Pick a contextual bandit view.');
}


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The logged-propensities view shows the future evaluation contract being written at decision time. Active nodes are context, old policy, probability mass function, sampled action, log row, and delayed reward join.',
    'The estimator view shows how a candidate policy reuses the frozen log. The weight column is the key: w = p_new / p_old says how many candidate-policy worlds one observed reward represents.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'A contextual bandit observes context, chooses one action, and receives reward only for that action. A recommender shows one story, an ad system shows one ad, and the log never contains what the user would have done for unshown actions.',
    'Logged policy evaluation exists so teams can reject risky candidate policies before live traffic. It requires the old policy to log the probability of the chosen action, called the propensity, so later evaluation can correct for action-selection bias.',
    {type:'callout', text:'Logged bandit evaluation is only honest where the old policy propensity log gives the new policy overlapping, weighted evidence.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious approach is to train on historical rows and compare predicted rewards. That treats the log like ordinary supervised data, but the old policy chose which actions appear, so the data is biased toward what the old system already liked.',
    'Another approach is replay matching: keep rows where the candidate would have chosen the same action and average those rewards. It wastes data and breaks down for stochastic policies that assign probabilities rather than one deterministic action.',
  ] },
  { heading: 'The wall', paragraphs: [
    'The first wall is support. If the old policy had zero probability of showing action A in context X, the log contains no reward evidence for a candidate that wants A in X.',
    'The second wall is variance. If p_old is 0.01 and p_new is 0.50, the weight is 50, so one lucky click can dominate the estimate even when the estimator is unbiased under its assumptions.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'A useful logged bandit row stores context, eligible actions, chosen action, logging policy version, chosen-action probability, reward, and join identifiers. That row lets a future policy ask how likely it would have been to choose the action that was actually observed.',
    'The invariant is overlap. Propensities reweight observed rewards inside the region explored by the logger, but they do not create counterfactual rewards for actions the logger never tried.',
  ] },
  { heading: 'How it works', paragraphs: [
    'Online, the policy scores eligible actions, converts scores into a probability mass function, samples one action, shows it, and logs the selected action with its final probability after filters and overrides. Reward arrives later through a click, dwell, purchase, complaint, or conversion join.',
    'Offline, the candidate policy computes p_new for the logged action in the logged context. The evaluator computes weights, support diagnostics, effective sample size, and estimator contributions such as inverse propensity weighting, self-normalized weighting, direct method, or doubly robust estimates.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'Inverse propensity weighting is a change of measure. The log was generated by the old policy, and each reward is multiplied by how often the candidate would choose the logged action relative to how often the logger chose it.',
    'Doubly robust estimation adds a reward model baseline and weights only the residual on observed actions. It can reduce variance when the model is useful, but it still depends on correct propensities, valid joins, and support.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'The online cost is exploration regret. A logger that gives every eligible story at least 0.05 probability may show weaker items today so tomorrow\'s policies have measurable support.',
    'The data cost is larger logs. A million decisions with 20 eligible actions each may need action ids, feature versions, probabilities, policy versions, timestamps, and join keys; compact hashes can help, but missing probability makes the row much less useful.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'This pattern fits news recommendation, search ranking treatments, ad placement, notification timing, offer ranking, and homepage modules. The common shape is one chosen action, partial feedback, and a need to screen candidate policies before live exposure.',
    'It is also used as a promotion gate. Offline evaluation rejects policies with missing support, high variance, bad segment behavior, or label leakage before an A/B test spends user risk.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'It fails when propensities are missing, reconstructed incorrectly, or logged before production overrides. The evaluator then weights the wrong policy and the estimate can look precise while being false.',
    'It also fails when rewards are delayed or duplicated. Reading a seven-day conversion label after one day creates false negatives, while duplicate joins can make one conversion count several times.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'A news logger has five rows. Row 1 has reward 1, p_old 0.50, p_new 0.20, so w=0.4 and IPW contribution is 0.4; row 2 has reward 1, p_old 0.10, p_new 0.60, so w=6.0 and contribution is 6.0.',
    'Across rows with contributions 0.4, 6.0, 0, 4.0, and 0, the average IPW estimate is 2.08 before normalization, dominated by two rare actions. A support audit and effective sample size warning should force more exploration data or clipping before anyone treats that number as a launch decision.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: Li et al. on unbiased offline evaluation of contextual-bandit news recommendation, Dudik, Langford, and Li on doubly robust policy evaluation, Vowpal Wabbit contextual bandit docs, and Open Bandit Pipeline docs. Study inverse propensity weighting, effective sample size, clipping, and delayed feedback next.',
    'Then connect this topic to LinUCB, Thompson Sampling, FTRL-Proximal CTR, A/B testing, training-serving skew, calibration curves, and reinforcement learning off-policy evaluation. The shared discipline is honest counterfactual evidence.',
  ] },
] };
