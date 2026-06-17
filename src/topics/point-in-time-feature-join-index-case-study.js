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
      heading: 'Why this exists',
      paragraphs: [
        'Training rows are easy to build incorrectly. If a label row from 10:05 joins to a feature value computed at 10:50, the model has seen the future. Offline metrics improve, production behavior gets worse, and the team may never notice until launch.',
        'A point-in-time feature join index exists to prevent that time travel. For each prediction example, it finds the newest feature value for the same entity that was available at or before the prediction timestamp, then records proof fields so the join can be audited later.',
        'This is one of the places where data engineering and model evaluation become the same problem. A model can only be fairly evaluated if its training and validation rows contain information the serving system would actually have had at prediction time.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The wrong shortcut is a latest-value join. It is simple, fast, and often disastrous because "latest" is relative to training-table construction time, not prediction time. It teaches early examples facts that only became true later.',
        'Another shortcut is to trust event_time alone. Availability time can differ from event time. A late-arriving event may describe the past but still be unavailable when the model would have predicted.',
        'A third shortcut is to keep only an online key-value store. Online stores are usually built for latest lookup at serving time. They are not enough to reconstruct historical training examples unless lookup logs or full feature history are retained.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Feature history is indexed by entity key and feature timestamp. For each training example, the joiner probes the matching entity history, filters rows with feature_time <= prediction_time, orders by feature_time descending, and takes the first row. If no valid row exists, it emits a default with a reason code.',
        'The invariant is the inequality: feature_time <= prediction_time, refined by the availability semantics of the pipeline. A mature system also keeps feature timestamp, source partition, transformation version, data delay, feature view id, and default reason beside the value.',
        'The index is not only an accelerator. It is the enforcement mechanism for an information boundary. The model should learn from the past as the serving system would have seen it, not from a cleaned-up future snapshot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The process starts with a label spine: entity id, prediction timestamp, label timestamp, and label value. The spine defines the row count and the time fence for every feature lookup.',
        'Each feature view stores history by entity and time. The physical implementation may be a sorted SQL table, partitioned lake files, a database range index, or a feature-store engine. The logical operation is the same: find the latest valid feature row at or before the prediction time.',
        'The joiner should emit both feature values and audit metadata: feature timestamp, freshness age, feature view version, source id, source partition, transformation version, and default reason. Those fields let teams prove the row was legal and debug training-serving skew.',
        'Late-arriving data complicates the rule. A timestamp can describe when something happened, but availability time describes when the system knew it. For strict leakage control, the as-of fence may need to use availability time or a conservative watermark rather than raw event time.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The as-of join view starts from the label spine. That spine is the authority for entity key and prediction time. The feature history is then searched under a timestamp fence, not simply joined by key.',
        'The leakage audit view shows the operational output. The join should emit training rows plus evidence: selected feature timestamp, source, freshness, version, and whether a default was used. Without those fields, the team cannot prove the experiment was run against the past.',
        'The as-of lookup table proves the failure of latest joins. The latest value may be valid for later predictions but illegal for earlier rows. The correct value is the newest row that satisfies the time fence.',
        'The implementation table proves why online and offline stores differ. Offline training needs history and audit. Online serving usually needs latest values with low latency. A feature platform has to make those two views consistent without pretending they are the same object.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Point-in-time joins work because most leakage is a boundary violation, not a modeling mystery. If the joiner can prove every feature value existed at prediction time, then one large class of inflated offline metrics disappears.',
        'They also work because sorted history makes the operation mechanical. Group by entity, order by time, use a range lookup, and choose the latest legal row. The complexity is in scale and semantics, not in the core rule.',
        'Audit fields make the result trustworthy. When a metric changes, engineers can inspect whether it came from fresher features, stale defaults, late data, feature definition drift, or a real model improvement.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'As-of joins are temporal nearest-neighbor lookups over large histories, so partitioning, sorting, clustering, and range indexes matter. Lakehouse implementations must control small files and skew; streaming implementations must handle late data; online stores usually keep only latest values and cannot replace offline history by themselves.',
        'There is a storage tradeoff. Keeping full history costs more than keeping latest state, but without history the team cannot reproduce training rows or investigate leakage. Retention policy should follow model audit needs, not only storage cost.',
        'There is also a freshness tradeoff. Tight freshness requirements produce more missing or defaulted values when pipelines lag. Loose freshness requirements avoid nulls but may let stale features weaken production performance. The feature contract should say which tradeoff is intended.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Point-in-time joins matter in fraud, ranking, recommendations, ads, credit risk, ETA, and any system where labels or features mature over time. Leakage-Safe Target Encoding uses the same as-of rule for category aggregate maps. Delayed Feedback Attribution applies a sibling rule to labels: do not finalize outcomes before the attribution window makes them knowable.',
        'The fraud chargeback case is the clean example. A model predicts at 10:05. A chargeback arrives at 10:50. Latest-value join leaks the chargeback into the 10:05 row; point-in-time join returns the earlier value and records why.',
        'It also wins in feature stores because it gives offline and online teams a shared contract. Offline training uses historical as-of reconstruction. Online serving uses current values. Both are generated from feature definitions that can be versioned and audited.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'As-of joins are temporal nearest-neighbor lookups over large histories, so partitioning, sorting, clustering, and range indexes matter. Lakehouse implementations must control small files and skew; streaming implementations must handle late data; online stores usually keep only latest values and cannot replace offline history by themselves.',
        'Defaults are not harmless. A default can encode cold start, missing source, freshness breach, or pipeline failure. Keep default reason codes and evaluate their rates by slice.',
        'Another failure is using the wrong clock. Event time, processing time, ingestion time, availability time, label time, and prediction time answer different questions. Leakage hides in those differences.',
        'A final failure is not auditing after the join. A point-in-time join without proof fields can still be wrong, and the team may have no way to prove it later.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary and official sources: Feast point-in-time joins at https://docs.feast.dev/getting-started/concepts/point-in-time-joins, Feast feature retrieval at https://docs.feast.dev/getting-started/concepts/feature-retrieval, Databricks point-in-time feature joins at https://docs.databricks.com/aws/en/machine-learning/feature-store/time-series, Uber Michelangelo at https://www.uber.com/us/en/blog/michelangelo-machine-learning-platform/, and Uber Palette at https://www.uber.com/us/en/blog/palette-meta-store-journey/. Study Feature Store, Leakage-Safe Target Encoding Case Study, Delayed Feedback Attribution Window Case Study, Data Leakage, Streaming Watermarks, Cross-Validation, and MLOps next.',
      ],
    },
  ],
};
