// Feature stores: one feature definition, two materializations, and the
// timestamp discipline that keeps training and serving from disagreeing.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'feature-store',
  title: 'Feature Store: Offline/Online Consistency',
  category: 'Systems',
  summary: 'Reusable ML features with point-in-time joins for training and low-latency lookups for serving.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['training-serving skew', 'point-in-time joins'], defaultValue: 'training-serving skew' },
  ],
  run,
};

function labelMatrix(title, rowLabels, columnLabels, labelsByRow) {
  const labels = [''];
  const ids = new Map();
  const code = (label) => {
    if (!ids.has(label)) {
      ids.set(label, labels.length);
      labels.push(label);
    }
    return ids.get(label);
  };
  return matrixState({
    title,
    rows: rowLabels.map(([id, label]) => ({ id, label })),
    columns: columnLabels.map(([id, label]) => ({ id, label })),
    values: labelsByRow.map((row) => row.map(code)),
    format: (v) => labels[v],
  });
}

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'events', label: 'events', x: 0.9, y: 4.0, note: 'Kafka / logs' },
      { id: 'definition', label: 'feature definition', x: 3.0, y: 4.0, note: 'one contract' },
      { id: 'offline', label: 'offline store', x: 5.2, y: 2.2, note: 'history' },
      { id: 'online', label: 'online store', x: 5.2, y: 5.8, note: 'low latency' },
      { id: 'training', label: 'training data', x: 7.6, y: 2.2, note: 'PIT join' },
      { id: 'serving', label: 'serving request', x: 7.6, y: 5.8, note: 'lookup now' },
    ],
    edges: [
      { id: 'e-events-definition', from: 'events', to: 'definition', weight: 'compute' },
      { id: 'e-definition-offline', from: 'definition', to: 'offline', weight: 'backfill' },
      { id: 'e-definition-online', from: 'definition', to: 'online', weight: 'stream' },
      { id: 'e-offline-training', from: 'offline', to: 'training', weight: 'as-of time' },
      { id: 'e-online-serving', from: 'online', to: 'serving', weight: '<10 ms' },
    ],
  }, { title });
}

function* trainingServingSkew() {
  yield {
    state: labelMatrix(
      'The bug feature stores were built to kill',
      [
        ['rides7d', 'rider_rides_7d'],
        ['cancel1h', 'driver_cancel_1h'],
        ['city', 'city_surge_level'],
        ['device', 'device_age_days'],
      ],
      [
        ['offline', 'training value'],
        ['online', 'serving value'],
        ['risk', 'risk'],
      ],
      [
        ['Spark window includes full day', 'Redis window at request time', 'definition drift'],
        ['computed after trip closes', 'not available yet', 'time travel'],
        ['hourly batch table', 'stream updates every minute', 'freshness gap'],
        ['same library, same timestamp', 'same library, same timestamp', 'healthy'],
      ],
    ),
    highlight: {
      removed: ['rides7d:risk', 'cancel1h:risk', 'city:risk'],
      found: ['device:risk'],
    },
    explanation: 'A model is trained offline and served online. If those two paths compute "the same" feature differently, the model learns one world and lives in another. Feature stores exist to make features reusable, governed, and consistent: one definition, materialized into an offline history for training and an online value for low-latency serving.',
    invariant: 'A feature is production-ready only if the training value and serving value obey the same definition at the same prediction time.',
  };

  yield {
    state: pipelineGraph('one definition, two materializations'),
    highlight: {
      active: ['definition'],
      compare: ['offline', 'online'],
      found: ['e-definition-offline', 'e-definition-online'],
    },
    explanation: 'The core architecture is deliberately boring. Raw events feed one feature definition. That definition writes historical rows into the offline store and fresh values into the online store. Training reads historical snapshots; serving reads the current online row. The hard part is not drawing the boxes. The hard part is proving both boxes came from the same contract.',
  };

  yield {
    state: labelMatrix(
      'Feature contract: what must be written down',
      [
        ['entity', 'entity key'],
        ['time', 'event timestamp'],
        ['window', 'window logic'],
        ['freshness', 'freshness SLO'],
        ['owner', 'owner + tests'],
      ],
      [
        ['question', 'question'],
        ['failure', 'if missing'],
      ],
      [
        ['which object is this about?', 'training rows join to wrong user/item'],
        ['when would this value exist?', 'Data Leakage & Contamination'],
        ['what exact interval is counted?', 'offline/online skew'],
        ['how stale may serving be?', 'silent model drift'],
        ['who fixes broken features?', 'orphaned production dependency'],
      ],
    ),
    highlight: { active: ['time:question', 'window:question'], compare: ['freshness:failure'] },
    explanation: 'A feature store is more governance system than database. Every feature needs an entity key, timestamp semantics, window definition, freshness target, owner, tests, and lineage. Without those, reuse becomes copy-paste with better branding. With them, teams can share features without reopening the same leakage and skew bugs in every project.',
  };
}

function* pointInTimeJoins() {
  yield {
    state: labelMatrix(
      'Wrong join: latest value leaks the future',
      [
        ['t1005', '10:05 prediction'],
        ['t1020', '10:20 prediction'],
        ['t1050', '10:50 prediction'],
      ],
      [
        ['latest', 'latest join'],
        ['pit', 'point-in-time join'],
        ['verdict', 'verdict'],
      ],
      [
        ['chargebacks_1h = 3', 'chargebacks_1h = 0', 'latest saw the future'],
        ['chargebacks_1h = 3', 'chargebacks_1h = 1', 'latest saw 10:50'],
        ['chargebacks_1h = 3', 'chargebacks_1h = 3', 'valid as-of 10:50'],
      ],
    ),
    highlight: {
      removed: ['t1005:latest', 't1020:latest'],
      found: ['t1005:pit', 't1020:pit', 't1050:pit'],
    },
    explanation: 'Training data construction is where many feature stores earn their keep. If you join every label row to the latest feature value, early examples inherit facts that happened later. The model trains on tomorrow. A point-in-time join instead asks: "what was the last known feature value as of this prediction timestamp?" That is Data Leakage & Contamination defense in database form.',
    invariant: 'For training row at time t, every joined feature must be computed from information available at or before t.',
  };

  yield {
    state: labelMatrix(
      'Point-in-time join mechanics',
      [
        ['lookup', 'lookup key'],
        ['filter', 'time filter'],
        ['rank', 'rank values'],
        ['select', 'select value'],
      ],
      [
        ['operation', 'operation'],
        ['why', 'why it matters'],
      ],
      [
        ['entity_id = rider_42', 'join the right entity'],
        ['feature_time <= prediction_time', 'block time travel'],
        ['ORDER BY feature_time DESC', 'find most recent known value'],
        ['take row 1 or default', 'training matches serving'],
      ],
    ),
    highlight: { active: ['filter:operation'], compare: ['rank:operation'], found: ['select:why'] },
    explanation: 'Mechanically, the point-in-time join is a constrained nearest-neighbor lookup in time: same entity, timestamp no later than prediction time, newest qualifying value wins. This sounds like SQL plumbing until you see the consequence: Cross-Validation & Honest Evaluation can be perfectly coded and still meaningless if feature joins leaked future rows before the split.',
  };

  yield {
    state: pipelineGraph('operational loop: freshness, tracing, rollback'),
    highlight: {
      active: ['events', 'online', 'serving'],
      compare: ['training', 'offline'],
      found: ['e-online-serving', 'e-offline-training'],
    },
    explanation: 'In production, the feature store is watched like any other serving system. Message Queues deliver events, online stores need cache-like freshness guarantees, offline stores need backfills, and Distributed Tracing needs to show which feature lookup slowed or failed. The model is only one dependency; the feature pipeline is the nervous system feeding it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'training-serving skew') yield* trainingServingSkew();
  else if (view === 'point-in-time joins') yield* pointInTimeJoins();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A feature store is the shared data layer for production machine learning features. It stores feature definitions, historical feature values for training, and low-latency feature values for serving. The central promise is not "a database for ML." The central promise is consistency: the model should train on the same feature semantics it will see in production.`,
        `Feature stores sit between data engineering and ML. They package entity keys, timestamps, aggregation windows, freshness targets, ownership, tests, and access control. Without that contract, every model team rewrites the same joins and silently creates training-serving skew.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A feature definition reads raw events or tables and computes values such as rider_rides_7d, merchant_chargebacks_1h, or document_click_rate_30d. The offline path stores historical values for training and backtesting. The online path serves the latest values by entity key during prediction. The two paths may use different storage systems, but they must implement the same definition.`,
        `Training data uses point-in-time joins. For each labeled example at prediction time t, the join selects feature values for the same entity with feature_time <= t, usually choosing the most recent qualifying value. That one inequality is the wall between honest evaluation and time travel. It is the production version of Data Leakage & Contamination discipline. Leakage-Safe Target Encoding Case Study applies the same contract to categorical aggregate maps: the map version, smoothing, and time boundary are feature-store state too.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The offline store optimizes history, scans, and reproducibility; the online store optimizes low-latency key lookups. That split creates operational costs: backfills, dual writes, freshness monitoring, schema evolution, TTLs, access control, lineage, and rollback. Serving a stale feature can be as damaging as serving a stale cache, so Cache Invalidation & Versioning intuition applies. The pipeline also inherits Message Queues failure modes: lag, duplicates, out-of-order events, and replay.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Feature stores are common in recommender systems, fraud detection, ETA prediction, ranking, ads, risk scoring, and personalization. Uber's Michelangelo platform introduced a centralized feature store layer for sharing curated features, and its Palette system focused on consistent feature engineering across offline training and online serving. Feast, Tecton, Hopsworks, Vertex AI Feature Store, and cloud-native internal platforms implement similar ideas with different tradeoffs.`,
        `The most important case study is not a brand name; it is the skew bug. A fraud model trains on a batch-computed "chargebacks in the next hour" feature, launches with an online system that cannot know the future, and collapses. A target-encoded merchant fraud-rate map can fail the same way if the offline map uses labels that the online map would not have yet. A feature store's point-in-time join and feature contract are designed to make those bugs hard to write.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A feature store does not automatically make features good. It can centralize bad definitions just as easily as good ones. Owners still need tests, monitoring, backfills, and model impact reviews. Another trap is assuming online and offline code are identical because they share a name. Verify by replaying historical events through the online path and comparing against offline values. Also do not confuse feature reuse with causal validity: a reusable feature can still encode a proxy, leak the label, or break under distribution shift.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Sources: Uber's Michelangelo overview at https://www.uber.com/us/en/blog/michelangelo-machine-learning-platform/ and Uber's Palette feature-store writeup at https://www.uber.com/us/en/blog/palette-meta-store-journey/. Study AI Engineering Stack: Five Parts Primer, Point-in-Time Feature Join Index, Leakage-Safe Target Encoding Case Study, Feature Freshness SLO Monitor, Training-Serving Skew Replay Diff, Data Leakage & Contamination, Cross-Validation & Honest Evaluation, Message Queues, Cache Invalidation & Versioning, Distributed Tracing, and LSM Trees (How Cassandra Writes) to understand the full production path.`,
      ],
    },
  ],
};
