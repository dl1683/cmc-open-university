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
      heading: 'Why this exists',
      paragraphs: [
        `A contextual bandit chooses one action after observing context, then receives reward only for the action it actually took. A news site shows one story. An ad system shows one ad. A search page chooses one ranking treatment. The system never observes what the user would have done if a different action had been shown.`,
        `That missing counterfactual is the central problem. Product teams want to improve policies without sending every risky candidate directly to users. They want to ask whether a new ranker, exploration rule, or personalization model would have performed better using old traffic. Ordinary analytics logs cannot answer that question because they record what happened, not how likely the old policy was to make the choice it made.`,
        `Logged policy evaluation exists to make future counterfactual evaluation possible. The online system logs enough information about each randomized decision that a future policy can be evaluated honestly before live exposure. The most important field is the propensity: the probability that the logging policy assigned to the action it actually chose.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to train a new policy on historical logs and compare its predictions to the rewards in those logs. If the new model scores clicked stories higher than unclicked stories, it looks better. This is useful for supervised learning, but it is not enough for policy evaluation. The old policy chose which actions entered the log, so the data is biased toward actions the old policy preferred.`,
        `Another obvious approach is replay matching. Run the candidate policy on each old context and keep only rows where the candidate would have chosen the same action as the logger. Average the rewards of those matching rows. This can work for simple randomized experiments, but it wastes data and fails when the candidate is stochastic or assigns different probabilities rather than deterministic choices.`,
        `The approach that scales is to log the old decision probability and use it during evaluation. The candidate policy is evaluated on the action that was actually shown, but the row is weighted by how much more or less likely the candidate would have been to choose that action. This turns the log into a reusable evaluation contract.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is support. If the logging policy never chose an action in a context where the candidate policy wants to choose it, the log contains no reward evidence for that counterfactual. No estimator can recover a missing outcome. A policy can be mathematically clever and still unevaluable because the old traffic did not explore the region it now wants to use.`,
        `The second wall is variance. If the logger chose an action with probability 0.01 and the candidate would choose it with probability 0.50, that row receives a weight of 50. One row can become as loud as many ordinary rows. The estimate may be unbiased under the right assumptions and still too noisy to decide whether the candidate is safe.`,
        `The third wall is log integrity. Missing propensities, changed action sets, duplicate events, delayed rewards marked too early, feature leakage, and stale policy versions break the evaluation contract. These are not minor instrumentation bugs. They change the mathematical object being estimated.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A logged bandit row is a counterfactual contract. It must preserve the context, eligible actions or action features, chosen action, logging policy version, chosen-action probability, reward, and event identifiers needed to join delayed labels. Given that row, a future policy can ask: how likely would I have been to take the logged action in the same context?`,
        `The importance weight is w = pi_new(a | x) / pi_old(a | x), where a is the logged action and x is the logged context. If the candidate policy would have chosen the logged action more often than the old policy, the row represents more candidate-policy worlds. If it would have chosen the action less often, the row represents fewer. If the old probability is zero, the row cannot support that counterfactual at all.`,
        `The core invariant is that evaluation is honest only over overlap between the logging policy and the candidate policy. Propensities let the evaluator reweight observed rewards inside that overlap. They do not create observations for actions the logger never tried.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The online loop starts with context features and an eligible action set. The policy scores the actions, converts scores into a probability mass function, samples one action, shows it, and writes an append-only decision row. The row should include a stable request id, user or session join key when allowed, policy version, feature version, action set representation, selected action, propensity, and enough metadata to reproduce eligibility.`,
        `Reward arrives later. A click, conversion, dwell threshold, purchase, complaint, or cancellation may be joined minutes or days after the decision. The log therefore needs event ids, timestamps, attribution windows, and rules for finalizing labels. A premature negative label is a false reward. A duplicate join can count one reward twice. A missing join can make an action look worse than it was.`,
        `Offline evaluation materializes candidate probabilities for the logged action. For each row, the evaluator computes pi_new(a | x), w, estimator contributions, support diagnostics, and effective sample size. The evaluation table is separate from the raw log so candidate code can be frozen, audited, and compared across policies without rewriting history.`,
        `The animation's logged-propensity view shows this data path: context enters the old policy, the policy emits a probability distribution, a sampled action is logged with its probability, reward is joined later, and OPE uses the frozen rows. The estimator view then shows how large weights can dominate IPW and how model-based baselines can reduce variance in doubly robust estimation.`,
      ],
    },
    {
      heading: 'Estimator choices',
      paragraphs: [
        `Inverse propensity weighting, also called IPW or IPS in this setting, multiplies each observed reward by w and averages. Under the usual logged-bandit assumptions, it corrects for the logging policy's action bias. Its weakness is variance. Rows with tiny old propensities and high candidate probabilities can dominate the estimate.`,
        `Self-normalized IPW divides the weighted reward sum by the sum of weights. This often stabilizes estimates, but it introduces bias because the denominator is itself random. Clipping or capping weights reduces variance further by limiting how loud any row can be, but it intentionally biases the answer toward the logging policy.`,
        `The direct method trains a reward model and uses it to predict what the candidate policy would earn. It can use every context-action pair the model can score, but it inherits model bias. Doubly robust estimation combines a reward model with importance-weighted residuals. If the reward model is useful, DR can reduce variance. If both the model and propensities are wrong, DR is not magic.`,
        `Estimator choice comes after support. A support audit asks whether every candidate action with positive probability has positive logging probability in the relevant context region. Effective sample size asks how much usable evidence remains after weighting. A high raw row count with poor overlap can have a small effective sample size.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The basic IPW argument is a change of measure. The log was generated by the old policy. Each observed reward for action a in context x is reweighted by how often the candidate would choose a compared with how often the logger chose a. Averaged over many randomized logged decisions, those weights make the old-policy sample estimate the candidate-policy value over the overlapping action support.`,
        `The argument depends on the logging policy actually randomizing according to the recorded probabilities. If the logged propensity says 0.20 but a downstream rule always overrides the sampler, the weight is wrong. If the action set used by the candidate differs from the logged eligible set, the probability comparison is wrong. If reward labels are joined with future information unavailable at decision time, the estimate is contaminated.`,
        `Doubly robust estimators work by using a model as a baseline and applying importance weighting to the residual error on observed actions. The model supplies broad coverage, while the weighted residual corrects the model where logged evidence exists. The name "doubly robust" refers to consistency when either the reward model or propensity model is correct under the estimator's assumptions, but production logs still need both to be treated seriously.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The online cost is exploration. A logger that always chooses the current best action creates poor support for future policies. Adding exploration may reduce short-term reward, annoy users, or spend inventory on lower-ranked actions. The payoff is future learnability. The product must decide how much regret it is willing to spend for better evidence.`,
        `The storage cost is a richer decision log. Context features, action features, eligible sets, probabilities, policy versions, timestamps, and join ids can be large. Teams often store compact feature hashes, action ids, model version references, and reproducible eligibility snapshots instead of full payloads. The log must still be sufficient to recompute or audit candidate probabilities later.`,
        `The offline cost is variance management and replay discipline. Evaluating many candidate policies on the same log can overfit to logged noise. Thresholds for support, effective sample size, clipping, confidence intervals, and delayed-label finalization should be declared before looking at outcomes. Otherwise OPE becomes a leaderboard over historical quirks.`,
        `The operational tradeoff is that OPE is a promotion gate, not a launch proof. It can reject policies with missing support, dangerous variance, or bad expected value. It can compare plausible candidates and size a safer experiment. It cannot reveal outcomes in regions the logger did not explore, and it cannot replace a live randomized guard for high-impact changes.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Missing propensities are fatal for IPW and DR. If the old policy probability was not logged, later teams may try to reconstruct it from model code, but that reconstruction often misses overrides, filtering, exploration buckets, feature changes, or action-set differences. The logged probability should be the probability after all production gates that affected the sampled action.`,
        `Deterministic logging destroys support. A recommender that always shows the top-ranked item cannot later evaluate a policy that would have explored the second item, because there is no reward for the second item in that context. More rows do not fix zero probability. The system needs exploration, constrained candidates, or a live experiment.`,
        `Delayed labels can poison evaluation. If a conversion window is seven days and the evaluator reads labels after one day, many eventual positives look negative. If the join key is not unique, duplicates inflate reward. If the candidate feature pipeline can see data created after the decision, the policy is evaluated with information it would not have had online.`,
        `Changing the action universe without logging eligibility makes probabilities incomparable. A candidate cannot assign a meaningful probability to an item that was not eligible at logging time unless the evaluation explicitly models that difference. Action catalogs, filters, inventory constraints, and policy rules are part of the counterfactual state.`,
      ],
    },
    {
      heading: 'Concrete case study',
      paragraphs: [
        `A news homepage chooses one story for each visit. The context includes device, coarse location, time of day, referrer, user segment, and recent behavior. The action set changes constantly as stories expire and new stories arrive. The logging policy scores eligible stories, converts scores to a PMF with exploration, samples one story, shows it, and logs the selected-story probability.`,
        `Reward arrives as click, dwell time, subscription action, or a negative feedback signal. The evaluation pipeline waits for the attribution window, joins the reward to the decision row, and freezes a dataset. A candidate ranker is then run on the same context and eligible action set. For each logged action, the evaluator records the candidate probability, computes w, and builds IPW, self-normalized, direct-method, and doubly robust estimates.`,
        `If the candidate puts most probability on stories the logger almost never showed, the support audit fails or the effective sample size collapses. The correct decision is not to ship because the estimated value looks high on a few lucky rows. The correct decision is to collect better exploration data, restrict the candidate, or run a guarded A/B test.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Log the final chosen-action probability after all production filters, exploration rules, business rules, and fallback paths. If an override changes the selected action after the probability is computed, log the probability of the action that was actually displayed under the final decision process. Otherwise the evaluator weights the wrong policy.`,
        `Version everything that affects replay: feature extraction, action eligibility, policy code, exploration settings, reward definitions, attribution windows, and deduplication rules. Store enough identifiers to rerun or audit the candidate probability calculation. A row that cannot be replayed is a descriptive event, not a reliable OPE row.`,
        `Make support and variance diagnostics first-class outputs. Report action coverage, zero-propensity regions, weight histograms, maximum weight, effective sample size, clipped fraction, confidence intervals, delayed-label completeness, and segment-level estimates. A single overall value estimate hides the reasons it should or should not be trusted.`,
        `Use OPE to reduce user risk, not to avoid experimentation forever. A healthy workflow is: exploration logger produces valid rows, offline evaluation rejects bad candidates, a small live experiment tests plausible candidates, and successful policies become new loggers with their own exploration contract.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Vowpal Wabbit contextual bandit documentation at https://vowpalwabbit.org/docs/vowpal_wabbit/python/latest/tutorials/python_Contextual_bandits_and_Vowpal_Wabbit.html and news personalization tutorial at https://vowpalwabbit.org/docs/vowpal_wabbit/python/latest/tutorials/python_Simulating_a_news_personalization_scenario_using_Contextual_Bandits.html; Dudik, Langford, and Li, Doubly Robust Policy Evaluation and Learning at https://arxiv.org/abs/1103.4601; Open Bandit Pipeline documentation at https://zr-obp.readthedocs.io/en/latest/ and estimator notes at https://zr-obp.readthedocs.io/en/latest/estimators.html; the Cornell SIGIR counterfactual evaluation tutorial at https://www.cs.cornell.edu/~adith/CfactSIGIR2016/; Li et al. on unbiased offline evaluation of contextual-bandit news recommendation at https://arxiv.org/abs/1003.5956; and Li et al. on LinUCB news recommendation at https://arxiv.org/abs/1003.0146.`,
        `Study next: LinUCB Personalized News Case Study, Importance Sampling and Off-Policy Estimation, Doubly Robust Estimation, Multi-Armed Bandits, Thompson Sampling, A/B Testing and p-values, RL Experiment Reproducibility Ledger, FTRL-Proximal Online CTR Case Study, Delayed Feedback Attribution Window Case Study, Feature Hashing Signed Projection Primer, Calibration Curves, and Training-Serving Skew Replay Diff.`,
      ],
    },
  ],
};
