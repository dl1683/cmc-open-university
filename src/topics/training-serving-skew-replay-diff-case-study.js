// Training-serving skew replay: compare online feature vectors with offline
// recomputation so production ML failures become diffable artifacts.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'training-serving-skew-replay-diff-case-study',
  title: 'Training-Serving Skew Replay Diff',
  category: 'Systems',
  summary: 'Log online feature vectors, replay them through offline definitions, and diff values to catch skew before model metrics drift.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shadow replay', 'diff ledger'], defaultValue: 'shadow replay' },
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

function replayGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.7, y: 3.25, note: 'prod' },
      { id: 'online', label: 'online', x: 2.25, y: 2.0, note: 'lookup' },
      { id: 'log', label: 'log', x: 2.25, y: 4.45, note: 'features' },
      { id: 'queue', label: 'queue', x: 3.95, y: 4.45, note: 'replay' },
      { id: 'offline', label: 'offline', x: 5.45, y: 2.0, note: 'recompute' },
      { id: 'diff', label: 'diff', x: 6.9, y: 3.25, note: 'compare' },
      { id: 'ledger', label: 'ledger', x: 8.2, y: 2.0, note: 'skew' },
      { id: 'gate', label: 'gate', x: 8.2, y: 4.45, note: 'release' },
    ],
    edges: [
      { id: 'e-request-online', from: 'request', to: 'online' },
      { id: 'e-online-log', from: 'online', to: 'log' },
      { id: 'e-log-queue', from: 'log', to: 'queue' },
      { id: 'e-queue-offline', from: 'queue', to: 'offline' },
      { id: 'e-online-diff', from: 'online', to: 'diff' },
      { id: 'e-offline-diff', from: 'offline', to: 'diff' },
      { id: 'e-diff-ledger', from: 'diff', to: 'ledger' },
      { id: 'e-diff-gate', from: 'diff', to: 'gate' },
    ],
  }, { title });
}

function* shadowReplay() {
  yield {
    state: replayGraph('Production lookups become replayable evidence'),
    highlight: { active: ['request', 'online', 'log'], compare: ['offline'] },
    explanation: 'Training-serving skew is hard to see from model metrics alone. A replay diff starts by logging the exact online feature vector used for prediction, with feature versions, timestamps, defaults, and request context.',
  };

  yield {
    state: labelMatrix(
      'Online feature vector log',
      [
        { id: 'f1', label: 'rides_7d' },
        { id: 'f2', label: 'charge_1h' },
        { id: 'f3', label: 'city_lvl' },
        { id: 'f4', label: 'device_age' },
      ],
      [
        { id: 'online', label: 'online' },
        { id: 'meta', label: 'meta' },
        { id: 'ver', label: 'version' },
      ],
      [
        ['12', 'fresh', 'v8'],
        ['0', 'default', 'v8'],
        ['high', 'fresh', 'v4'],
        ['301', 'fresh', 'v2'],
      ],
    ),
    highlight: { active: ['f2:online', 'f2:meta'], found: ['f1:ver', 'f3:ver'] },
    explanation: 'Logging only the prediction score is not enough. The replay job needs the feature vector and metadata that explain where each value came from.',
    invariant: 'You cannot diff what you did not log.',
  };

  yield {
    state: replayGraph('Offline definitions recompute the same request later'),
    highlight: { active: ['queue', 'offline', 'diff'], found: ['ledger'] },
    explanation: 'A replay worker takes sampled production requests, recomputes feature values using the offline definitions and point-in-time rules, then compares the result against the online vector.',
  };

  yield {
    state: labelMatrix(
      'Replay diff result',
      [
        { id: 'rides', label: 'rides_7d' },
        { id: 'charge', label: 'charge_1h' },
        { id: 'city', label: 'city_lvl' },
        { id: 'device', label: 'device_age' },
      ],
      [
        { id: 'online', label: 'online' },
        { id: 'offline', label: 'offline' },
        { id: 'diff', label: 'diff' },
      ],
      [
        ['12', '12', 'ok'],
        ['0', '2', 'skew'],
        ['high', 'high', 'ok'],
        ['301', '301', 'ok'],
      ],
    ),
    highlight: { removed: ['charge:diff'], found: ['rides:diff', 'city:diff', 'device:diff'] },
    explanation: 'The skew appears before labels arrive. Online served a default for chargebacks while offline recomputation found a valid value. That points to an online materialization or freshness problem, not a model architecture problem.',
  };

  yield {
    state: replayGraph('Release gates can block skewed models'),
    highlight: { active: ['diff', 'ledger', 'gate'], compare: ['request'], found: ['offline'] },
    explanation: 'A model or feature-definition release can be gated on replay diff rates. If online and offline values disagree beyond tolerance, the release pauses before users discover the skew through degraded outcomes.',
  };
}

function* diffLedger() {
  yield {
    state: labelMatrix(
      'Diff ledger schema',
      [
        { id: 'req', label: 'request id' },
        { id: 'feat', label: 'feature' },
        { id: 'vals', label: 'values' },
        { id: 'root', label: 'root cause' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['stable key', 'join logs'],
        ['name+ver', 'pin blame'],
        ['on/offline', 'measure gap'],
        ['lag/default', 'fix path'],
      ],
    ),
    highlight: { active: ['feat:stores', 'vals:stores', 'root:stores'], found: ['req:why'] },
    explanation: 'The ledger should make skew queryable by feature, version, owner, model, tenant, and request slice. Without that, a diff system produces anecdotes instead of operational signals.',
  };

  yield {
    state: replayGraph('Complete case: fraud model production gap'),
    highlight: { active: ['request', 'online', 'log', 'queue', 'offline', 'diff'], found: ['ledger'] },
    explanation: 'Case study: a fraud model has strong offline metrics but misses live chargebacks. Replay diff shows that the online feature path defaults chargebacks_1h during Kafka lag, while offline training rows had the correct values.',
  };

  yield {
    state: labelMatrix(
      'Skew root-cause buckets',
      [
        { id: 'lag', label: 'lag' },
        { id: 'version', label: 'version' },
        { id: 'default', label: 'default' },
        { id: 'clock', label: 'clock' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['freshness gap', 'SLO alert'],
        ['def mismatch', 'pin deploy'],
        ['cold start', 'backfill'],
        ['time skew', 'clock audit'],
      ],
    ),
    highlight: { active: ['lag:fix', 'version:fix', 'default:fix'], compare: ['clock:signal'] },
    explanation: 'Diffs should be categorized. A numerical difference is just the symptom; the useful output is a root cause that points to a pipeline owner and release control.',
  };

  yield {
    state: labelMatrix(
      'Tolerance policy',
      [
        { id: 'exact', label: 'categorical' },
        { id: 'float', label: 'float' },
        { id: 'count', label: 'count' },
        { id: 'embed', label: 'embedding' },
      ],
      [
        { id: 'compare', label: 'compare' },
        { id: 'alert', label: 'alert' },
      ],
      [
        ['exact', 'any change'],
        ['epsilon', 'drift band'],
        ['absolute', 'over limit'],
        ['cosine', 'large move'],
      ],
    ),
    highlight: { active: ['exact:compare', 'float:compare', 'count:alert'], compare: ['embed:compare'] },
    explanation: 'Not every feature diff is binary. Floating aggregates need tolerances. Counts need absolute and relative checks. Embeddings need distance thresholds. Categorical values often need exact equality.',
  };

  yield {
    state: replayGraph('Replay diffs become MLOps incident evidence'),
    highlight: { active: ['ledger', 'gate'], found: ['diff'], compare: ['log'] },
    explanation: 'The diff ledger closes the loop between Feature Store, Distributed Tracing, MLOps, and Data Leakage. It gives the team a concrete artifact when offline and production behavior diverge.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shadow replay') yield* shadowReplay();
  else if (view === 'diff ledger') yield* diffLedger();
  else throw new InputError('Pick a replay diff view.');
}


export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the animation as an audit loop around a live prediction. Active nodes show online lookup, replay, or diff work; found nodes show evidence written to the ledger.', 'A feature is a model input. Training-serving skew means training saw one feature reality while production served another. If online and replayed point-in-time values differ beyond policy, production did not match training.', {type:'callout', text:'Replay diffs make production feature vectors the audit artifact, so skew becomes a data-path incident instead of a vague model regression.'}]},
    { heading: 'Why this exists', paragraphs: ['A model can be unchanged and still fail if its live feature vector changes. Fraud counts can default to zero online while training rows had real counts.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is watching model metrics and business outcomes. That is late and ambiguous because the same movement can come from model drift, data lag, version mismatch, label delay, or traffic shift.']},
    { heading: 'The wall', paragraphs: ['Aggregate metrics do not preserve the input vector that caused a prediction. Recomputing from today\'s warehouse can also be wrong because late events and backfills change what was knowable at prediction time.']},
    { heading: 'The core insight', paragraphs: ['Make the served feature vector replayable. Log feature names, versions, values, timestamps, freshness, default flags, entity keys, model ID, and prediction time, then compare replayed point-in-time values under feature-specific tolerances.']},
    { heading: 'How it works', paragraphs: ['The serving path writes an evidence record beside the prediction. A replay worker reconstructs the offline context for that timestamp, runs the training feature definitions, and writes mismatches to a ledger with owner and root-cause fields.']},
    { heading: 'Why it works', paragraphs: ['The invariant is same entity, same prediction time, same feature definition. If both paths implement the same contract, values should match within tolerance; if they do not, the data path rather than the model weights is suspect.']},
    { heading: 'Cost and complexity', paragraphs: ['Cost grows with vector width and sample rate. Logging 1,000 predictions per minute with 200 features and about 40 bytes of value plus metadata per feature writes roughly 8 MB per minute before compression.']},
    { heading: 'Real-world uses', paragraphs: ['Replay diffs fit fraud, ads, recommendations, pricing, ETA, credit risk, search ranking, and marketplace matching. Release gates can block when a critical feature exceeds a skew threshold before labels arrive.']},
    { heading: 'Where it fails', paragraphs: ['Replay fails when the online log omits versions, default reasons, timestamps, or entity keys. It also fails when the offline replay leaks future data or uses the wrong point-in-time join.']},
    { heading: 'Worked example', paragraphs: ['A fraud request at 10:05 serves rides_7d=12, chargebacks_1h=0, city_risk=high, and device_age=301. Replay as of 10:05 gets chargebacks_1h=2, making 1 of 4 features skewed for that request and 7.8 percent skew across the release sample.']},
    { heading: 'Sources and study next', paragraphs: ['Study feature stores, point-in-time joins, feature freshness monitoring, data leakage, MLOps release gates, Distributed Tracing, Data Lineage, and Online Experimentation. Feast and large-scale ML platform writeups are useful production references.']},
  ],
};