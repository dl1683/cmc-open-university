// Point-in-time feature joins: index feature history by entity and event time
// so training rows cannot see values produced after prediction time.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'point-in-time-feature-join-index-case-study',
  title: 'Point-in-Time Feature Join Index',
  category: 'Systems',
  summary: 'Build training rows with as-of feature lookups: entity key, timestamp fence, latest-valid value, and leakage audit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['as-of join', 'leakage audit'], defaultValue: 'as-of join' },
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

function pitGraph(title) {
  return graphState({
    nodes: [
      { id: 'spine', label: 'spine', x: 0.75, y: 3.2, note: 'labels' },
      { id: 'entity', label: 'entity', x: 2.25, y: 2.0, note: 'key' },
      { id: 'time', label: 'time', x: 2.25, y: 4.35, note: 't_pred' },
      { id: 'history', label: 'history', x: 4.0, y: 3.2, note: 'features' },
      { id: 'index', label: 'index', x: 5.75, y: 3.2, note: 'key,time' },
      { id: 'join', label: 'join', x: 7.25, y: 3.2, note: 'as-of' },
      { id: 'train', label: 'train', x: 8.75, y: 2.1, note: 'rows' },
      { id: 'audit', label: 'audit', x: 8.75, y: 4.35, note: 'no future' },
    ],
    edges: [
      { id: 'e-spine-entity', from: 'spine', to: 'entity' },
      { id: 'e-spine-time', from: 'spine', to: 'time' },
      { id: 'e-entity-index', from: 'entity', to: 'index' },
      { id: 'e-time-index', from: 'time', to: 'index' },
      { id: 'e-history-index', from: 'history', to: 'index' },
      { id: 'e-index-join', from: 'index', to: 'join' },
      { id: 'e-join-train', from: 'join', to: 'train' },
      { id: 'e-join-audit', from: 'join', to: 'audit' },
    ],
  }, { title });
}

function* asOfJoin() {
  yield {
    state: pitGraph('Training starts from a label spine'),
    highlight: { active: ['spine', 'entity', 'time'], compare: ['history'] },
    explanation: 'A point-in-time training set starts with a spine: one row per prediction example, including entity key, prediction timestamp, and label. Every feature lookup must be evaluated as of that timestamp.',
  };

  yield {
    state: labelMatrix(
      'Feature history is sorted by entity and time',
      [
        { id: 'r1', label: 'row 1' },
        { id: 'r2', label: 'row 2' },
        { id: 'r3', label: 'row 3' },
        { id: 'r4', label: 'row 4' },
      ],
      [
        { id: 'entity', label: 'entity' },
        { id: 'feat t', label: 'feat time' },
        { id: 'value', label: 'value' },
      ],
      [
        ['acct-7', '10:00', '0'],
        ['acct-7', '10:20', '1'],
        ['acct-7', '10:50', '3'],
        ['acct-9', '10:15', '5'],
      ],
    ),
    highlight: { active: ['r1:entity', 'r2:entity', 'r3:entity'], compare: ['r3:feat t'] },
    explanation: 'The physical index can be a sorted table, partitioned files, a database index, or a feature-store engine. The logical contract is the same: group by entity, order by feature timestamp, and never choose a row after prediction time.',
  };

  yield {
    state: labelMatrix(
      'As-of lookup chooses latest value <= t',
      [
        { id: 'p1', label: 'pred 10:05' },
        { id: 'p2', label: 'pred 10:30' },
        { id: 'p3', label: 'pred 10:55' },
      ],
      [
        { id: 'latest', label: 'latest' },
        { id: 'asof', label: 'as-of' },
        { id: 'verdict', label: 'verdict' },
      ],
      [
        ['3', '0', 'future leak'],
        ['3', '1', 'latest leaks'],
        ['3', '3', 'valid'],
      ],
    ),
    highlight: { removed: ['p1:latest', 'p2:latest'], found: ['p1:asof', 'p2:asof', 'p3:asof'] },
    explanation: 'A latest-value join silently teaches the model about the future. An as-of join asks for the newest value with feature_time <= prediction_time, which is the same information boundary serving will face.',
    invariant: 'The inequality feature_time <= prediction_time is the leakage guardrail.',
  };

  yield {
    state: pitGraph('The joiner emits training rows plus proof fields'),
    highlight: { active: ['index', 'join', 'train'], found: ['audit'] },
    explanation: 'A robust join keeps proof fields beside the feature value: feature timestamp, source partition, transformation version, and null/default reason. Those fields make audits and replay diffs possible later.',
  };

  yield {
    state: labelMatrix(
      'Index implementation choices',
      [
        { id: 'sql', label: 'SQL' },
        { id: 'lake', label: 'lake files' },
        { id: 'online', label: 'online KV' },
        { id: 'stream', label: 'stream' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['range index', 'sort spill'],
        ['partition', 'file count'],
        ['latest only', 'no history'],
        ['state table', 'late data'],
      ],
    ),
    highlight: { active: ['sql:shape', 'lake:shape', 'stream:shape'], compare: ['online:watch'] },
    explanation: 'Offline as-of joins need history. Online stores usually serve latest values by entity key, so they are not enough to reconstruct training examples unless online lookup logs are retained.',
  };
}

function* leakageAudit() {
  yield {
    state: labelMatrix(
      'Leakage audit columns',
      [
        { id: 'ft', label: 'feat time' },
        { id: 'pt', label: 'pred time' },
        { id: 'fresh', label: 'age' },
        { id: 'src', label: 'source' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail if' },
      ],
      [
        ['<= pred', '> pred'],
        ['label time', 'missing'],
        ['within TTL', 'too stale'],
        ['same view', 'wrong def'],
      ],
    ),
    highlight: { active: ['ft:check', 'fresh:check', 'src:check'], removed: ['ft:fail'] },
    explanation: 'The audit is mechanical. Every joined value should carry enough metadata to prove it existed at prediction time, came from the intended feature view, and was not stale beyond the model contract.',
  };

  yield {
    state: pitGraph('Complete case: fraud chargeback features'),
    highlight: { active: ['spine', 'history', 'index', 'join'], found: ['audit'] },
    explanation: 'Case study: a fraud model predicts at 10:05. Chargebacks logged at 10:50 are useful for later examples, but they are illegal for the 10:05 row. The as-of index returns the 10:00 value and records that choice.',
  };

  yield {
    state: labelMatrix(
      'What the audit catches',
      [
        { id: 'future', label: 'future row' },
        { id: 'stale', label: 'stale val' },
        { id: 'wrong', label: 'wrong view' },
        { id: 'default', label: 'default' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'action', label: 'action' },
      ],
      [
        ['AUC spike', 'block join'],
        ['prod gap', 'raise TTL'],
        ['skew', 'pin def'],
        ['null burst', 'trace lag'],
      ],
    ),
    highlight: { removed: ['future:action'], active: ['stale:action', 'wrong:action'], compare: ['default:action'] },
    explanation: 'The point-in-time index is not only a training convenience. It gives the evaluation pipeline evidence for why a model score changed and whether the change is trustworthy.',
  };

  yield {
    state: labelMatrix(
      'Where it links in this repo',
      [
        { id: 'leak', label: 'leakage' },
        { id: 'store', label: 'feature' },
        { id: 'water', label: 'watermark' },
        { id: 'mlops', label: 'MLOps' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'next', label: 'study next' },
      ],
      [
        ['time fence', 'Data Leak'],
        ['shared defs', 'Feature Store'],
        ['late data', 'Watermarks'],
        ['lineage', 'MLOps'],
      ],
    ),
    highlight: { found: ['leak:role', 'store:role', 'mlops:role'] },
    explanation: 'Point-in-time correctness is where data structures and evaluation discipline meet: sorted history, timestamp fences, lineage, and leakage checks all serve the same boundary.',
  };

  yield {
    state: pitGraph('The final output is an auditable training table'),
    highlight: { active: ['train', 'audit'], compare: ['history'], found: ['join'] },
    explanation: 'The best training table is not just features plus labels. It is features, labels, timestamps, feature versions, source ids, and audit fields that can prove the experiment was actually run against the past.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'as-of join') yield* asOfJoin();
  else if (view === 'leakage audit') yield* leakageAudit();
  else throw new InputError('Pick a point-in-time join view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the label spine as the authority for one training example: entity id, prediction time, and label. A feature row is legal only if it belongs to the same entity and was available no later than that prediction time.',
        'In the as-of join view, the highlighted feature is not the globally latest value. It is the newest value inside the legal past, and the audit fields explain why that value was selected.',
        {type:'callout', text:'Point-in-time joins make model evaluation honest by indexing feature history against the exact information boundary serving would have faced.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A machine-learning feature is an input value used by a model, such as account age or chargeback count. Point-in-time joins exist because training data is valid only when each feature value could have been known when the model would have predicted.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a latest-value join by entity id. It is simple because every customer, merchant, or item has one current feature row, but current means current at dataset construction time.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is time travel. A row predicted at 10:05 can accidentally receive a feature computed at 10:50, and the model learns from evidence that did not exist at serving time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Index feature history by entity and time, then answer each lookup as an as-of query. As-of means newest row whose availability timestamp is less than or equal to the prediction timestamp.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The join starts from a label spine that fixes the row set and the time fence. For every feature view, the engine searches matching entity history, chooses the last legal row, and emits audit metadata beside the value.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the inequality availability_time <= prediction_time. Sorting by time then makes the selected row maximal among legal rows, so no later future value can enter the example.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is a temporal nearest-neighbor lookup for every training row and feature view. With 10 million examples and 40 feature views, the system has 400 million logical lookups unless batching, partitioning, or clustering removes repeated work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Point-in-time joins are used in fraud, recommendations, ranking, credit risk, delivery ETA, ads, and churn modeling. Feature stores use the pattern to keep offline training and online serving under one versioned contract.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the wrong clock is used. Event time, ingestion time, processing time, availability time, label time, and prediction time answer different questions, and leakage hides in those gaps.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A fraud model predicts at 10:05 for merchant M7. The history has chargeback_count = 2 available at 09:40 and chargeback_count = 3 available at 10:50, so the legal join returns 2 with freshness age 25 minutes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: Feast point-in-time joins at https://docs.feast.dev/getting-started/concepts/point-in-time-joins, Feast feature retrieval at https://docs.feast.dev/getting-started/concepts/feature-retrieval, Databricks point-in-time feature joins at https://docs.databricks.com/aws/en/machine-learning/feature-store/time-series, Uber Michelangelo at https://www.uber.com/us/en/blog/michelangelo-machine-learning-platform/, and Uber Palette at https://www.uber.com/us/en/blog/palette-meta-store-journey/. Study Feature Store, Data Leakage, Streaming Watermarks, Delayed Feedback Attribution Window, Leakage-Safe Target Encoding, and Cross-Validation next.',
      ],
    },
  ],
};
