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
    {
      heading: 'What it is',
      paragraphs: [
        'A training-serving skew replay diff compares online feature vectors consumed in production with offline recomputation of the same requests. It turns a vague production ML complaint into a diffable artifact: which feature, which version, which value, which timestamp, which owner, and which model were affected.',
        'Feature stores aim to prevent skew by sharing definitions, but prevention is not proof. Replay diffs are the measurement layer that catches code drift, materialization lag, default bursts, timestamp bugs, and deployment mismatches.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The serving layer logs sampled request ids, entity keys, prediction timestamps, feature values, feature timestamps, defaults, versions, and model ids. A replay queue later feeds those requests into the offline feature definitions with point-in-time joins. The diff step compares online and offline values under a tolerance policy and writes a skew ledger.',
        'The ledger is queryable by feature, model, owner, source, version, tenant, and time window. Release gates can block a new model or feature definition if replay diff rates exceed a threshold, and incident response can use the ledger to isolate whether a regression came from data lag, feature version drift, serving defaults, or model behavior.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is logging volume and replay compute. Teams usually sample requests, prioritize high-value models, and replay only features that changed or look suspicious. Privacy and access control matter because feature logs can contain sensitive user or business data.',
        'The implementation must handle tolerances. Exact categorical values should match exactly. Floating aggregates may differ slightly because of window boundaries or numerical precision. Counts need threshold policies. Embeddings need vector-distance thresholds. The diff system should avoid both false panic and silent drift.',
      ],
    },
    {
      heading: 'Complete case study: fraud model production gap',
      paragraphs: [
        'A fraud model reports strong offline AUC but misses live fraud after launch. Product metrics show a gap, but the model code did not change. Replay diff finds the cause: online chargebacks_1h often defaults to zero during queue lag, while offline recomputation finds valid chargeback counts for the same prediction timestamps.',
        'The fix is not a larger model. The team tightens freshness SLOs, adds fallback logging, blocks releases when default bursts exceed threshold, and reruns the offline evaluation with production-like defaults. The replay ledger becomes evidence for the incident review and a gate for the next release.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not log only model scores. You need feature values and metadata to debug skew. Do not compare online latest values against offline latest values; replay must use the original prediction timestamp. Do not ignore defaults, because default paths are often the entire skew bug.',
        'Replay diffs do not prove the model is good. They prove the model saw consistent feature semantics. You still need validation, calibration, online experiments, delayed-label audits, and monitoring for data distribution shift.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Uber Michelangelo at https://www.uber.com/us/en/blog/michelangelo-machine-learning-platform/, Uber Palette at https://www.uber.com/us/en/blog/palette-meta-store-journey/, Feast feature retrieval at https://docs.feast.dev/getting-started/concepts/feature-retrieval, and Operationalizing Machine Learning at https://arxiv.org/abs/2209.09125. Study Feature Store, Point-in-Time Feature Join Index, Feature Freshness SLO Monitor, Distributed Tracing, Data Leakage, and MLOps next.',
      ],
    },
  ],
};
