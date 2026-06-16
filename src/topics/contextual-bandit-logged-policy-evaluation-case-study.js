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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A contextual bandit chooses one action from an eligible set after observing context, then sees reward only for that chosen action. A production news, ads, or recommendation system therefore needs a log that can answer a future counterfactual: what would have happened if a different policy had chosen the action? The minimum row is context, eligible action set or action features, chosen action, logged policy version, chosen-action probability, reward, and event identifiers for delayed label joins.',
        'The chosen-action probability is the critical field. Without it, old logs are mostly descriptive analytics. With it, the system can compute importance weights, doubly robust estimates, support checks, effective sample size, and promotion gates for future policies.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The online loop uses a context feature vector, an action catalog, a probability mass function over eligible actions, a sampler, and an append-only decision log. The offline loop adds a delayed label join, an evaluation table that materializes candidate probabilities, and estimator columns such as weight, IPW contribution, direct-method baseline, and doubly robust correction.',
        'This is the bridge between several nearby topics. Multi-Armed Bandits and Thompson Sampling explain why a logger must explore. Feature Hashing Signed Projection Primer and FTRL-Proximal Online CTR Case Study explain how sparse policies score actions at production scale. Delayed Feedback Attribution Window Case Study explains why the reward column may not be final when the decision row is written.',
      ],
    },
    {
      heading: 'How off-policy evaluation works',
      paragraphs: [
        'For each logged row, compute w = pi_new(a|x) / pi_old(a|x), where a is the action actually chosen by the logger. IPW multiplies the observed reward by w and averages. SNIPW divides the weighted reward total by the weighted count. The direct method fits a reward model and asks that model what the new policy would earn. Doubly robust estimation combines them: start with the model estimate and use importance-weighted residuals to correct it.',
        'The support audit comes before every estimator. If pi_old(a|x) is zero where pi_new(a|x) is positive, the log contains no evidence for that counterfactual. If pi_old is positive but tiny, the estimate may be unbiased and still unusably noisy. Effective sample size is the practical diagnostic: it tells you how much statistical power survived the weights.',
      ],
    },
    {
      heading: 'Complete case study: news personalization',
      paragraphs: [
        'A homepage chooses one story for each user visit. The context includes user segment, device, time of day, location, and recent behavior. The action set changes constantly as stories expire and new stories arrive. The logger scores eligible stories, samples from a PMF, shows one story, logs the selected-story probability, and later joins click or dwell feedback. A future ranker can be evaluated by replaying its probability for the action that was actually shown and weighting the observed reward.',
        'The same structure appears in search and ad placement. Candidate rankers are too risky to send directly to all users, but logged propensities let a team reject bad policies, compare variants, and size a safer A/B test. The offline gate is not a final proof: it is a filter that protects users and traffic before live randomization.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common failure is treating logs as if they came from a clean randomized experiment. Deterministic ranking destroys support. Missing propensities destroy IPW and DR. Changing the eligible action set without logging it makes candidate probabilities incomparable. Premature negative labels create false rewards. Reusing feature code that can see the future creates leakage. These are data-structure and contract failures, not estimator failures.',
        'Another misconception is that more logged data always fixes OPE. More data helps only along the overlap that exists. If a logger almost never explores a candidate action, you need better exploration, a constrained candidate policy, or a live experiment. Raw sample count is less informative than support, weight distribution, and ESS.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Vowpal Wabbit contextual bandit documentation at https://vowpalwabbit.org/docs/vowpal_wabbit/python/latest/tutorials/python_Contextual_bandits_and_Vowpal_Wabbit.html and news personalization tutorial at https://vowpalwabbit.org/docs/vowpal_wabbit/python/latest/tutorials/python_Simulating_a_news_personalization_scenario_using_Contextual_Bandits.html; Dudik, Langford, and Li, Doubly Robust Policy Evaluation and Learning at https://arxiv.org/abs/1103.4601; Open Bandit Pipeline documentation at https://zr-obp.readthedocs.io/en/latest/ and estimator notes at https://zr-obp.readthedocs.io/en/latest/estimators.html; the Cornell SIGIR counterfactual evaluation tutorial at https://www.cs.cornell.edu/~adith/CfactSIGIR2016/; Li et al. on unbiased offline evaluation of contextual-bandit news recommendation at https://arxiv.org/abs/1003.5956; and Li et al. on LinUCB news recommendation at https://arxiv.org/abs/1003.0146.',
        'Study next: LinUCB Personalized News Case Study, Importance Sampling & Off-Policy Estimation, Doubly Robust Estimation, Multi-Armed Bandits, Thompson Sampling, A/B Testing & p-values, RL Experiment Reproducibility Ledger, FTRL-Proximal Online CTR Case Study, Delayed Feedback Attribution Window Case Study, Feature Hashing Signed Projection Primer, Calibration Curves, and Training-Serving Skew Replay Diff.',
      ],
    },
  ],
};
