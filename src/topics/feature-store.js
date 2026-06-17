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
      heading: 'Why this exists',
      paragraphs: [
        `A model is only as good as the values it sees at prediction time. Training wants large historical scans, backfills, and joins over labels. Serving wants a few fresh values in milliseconds. Without a shared system, those two paths drift apart: the offline feature is computed one way, the online feature another, and the model learns a world it will never actually see.`,
        `A feature store exists to make reusable ML features obey one contract across training and serving. It is not just a database for ML. It is a system for definitions, timestamps, materialization, lineage, ownership, freshness, and point-in-time correctness.`,
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        `The obvious approach is to let each model team write its own training SQL and serving code. That feels fast. It also creates two implementations for the same idea. A Spark job may count events using closed daily partitions while a serving path counts streaming events up to the request time. Both are called rider_rides_7d, but they are not the same feature.`,
        `Another weak answer is to publish shared tables without contracts. A table full of columns is not a feature store if no one knows the entity key, event time, aggregation window, freshness target, owner, or intended serving behavior. Reuse without discipline spreads skew and leakage across more models.`,
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        `A feature definition describes how to compute a value for an entity at a time. Examples include rider_rides_7d, merchant_chargebacks_1h, item_click_rate_30d, or device_age_days. The definition should name the entity key, timestamp semantics, source data, window logic, default value, freshness expectation, owner, and tests.`,
        `The feature store materializes that definition in two places. The offline store keeps historical values for training and backtesting. The online store serves current values by key during prediction. The storage engines can be different. The semantics must be the same.`,
      ],
    },
    {
      heading: 'Offline and online paths',
      paragraphs: [
        `The offline path is optimized for history. It reads event logs, warehouse tables, lakehouse files, or backfilled corrections. It builds training rows, evaluates historical behavior, and supports reproducible experiments. Because it can scan large data, it is usually batch-oriented and slower than serving.`,
        `The online path is optimized for latency. It stores the latest feature values in a key-value store, cache, or low-latency database. A prediction request supplies entity ids, the serving system looks up feature values, and the model runs. This path needs freshness monitoring, fallbacks, and predictable tail latency.`,
      ],
    },
    {
      heading: 'Point-in-time joins',
      paragraphs: [
        `Training data construction is where many feature stores prove their value. For each labeled example at prediction time t, the training set must join features that were known at or before t. The basic operation is: same entity, feature_time <= prediction_time, newest qualifying value wins. That small inequality blocks a large class of leakage bugs.`,
        `A latest-value join is wrong for training. If a fraud example from 10:05 joins to a chargeback count computed at 10:50, the model is training on the future. Offline validation may look excellent because the feature contains information unavailable in production. A point-in-time join makes the offline row match what serving could have known.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The skew visual proves that a shared name is not a shared feature. Training and serving can disagree because of window boundaries, delayed availability, future data, stale online state, or separate implementations. The risk column names the bug that the feature store is supposed to make visible.`,
        `The pipeline visual proves the central architecture: one definition, two materializations. Raw events feed the definition. The same contract writes historical rows into the offline store and fresh rows into the online store. Training asks what was known then. Serving asks what is known now.`,
      ],
    },
    {
      heading: 'Why timestamp discipline works',
      paragraphs: [
        `Timestamp discipline turns feature engineering into a temporal database problem. Every event has an event time, an ingestion time, and sometimes a processing time. Every feature value has a time at which it became valid. Every label row has a prediction time. Correct training data respects those boundaries.`,
        `This is why feature stores connect directly to Data Leakage & Contamination and Cross-Validation & Honest Evaluation. A perfect model split cannot rescue a dataset whose features already leaked future information before the split. The point-in-time join is the guardrail that keeps history honest.`,
      ],
    },
    {
      heading: 'Operations and monitoring',
      paragraphs: [
        `A production feature store is watched like any other serving dependency. Online features need freshness SLOs, latency budgets, error rates, fallback behavior, and alerting. Offline features need backfill status, data quality checks, schema-change detection, and reproducible snapshots. Both paths need lineage so teams can see which models depend on a feature before changing it, and dashboards should show whether serving values still match the latest valid offline computation.`,
        `Replay tests are especially valuable. Run historical events through the online computation path, compare the resulting values with offline feature rows, and inspect differences. This catches timestamp mismatches, late-event handling bugs, duplicate messages, out-of-order updates, and window-definition drift.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Feature stores win when many models reuse the same signals and when training-serving consistency matters. Recommenders, fraud detection, ETA prediction, ads ranking, credit risk, marketplace matching, and personalization all depend on fresh, reusable, entity-keyed features. A shared store prevents every team from rediscovering the same skew and leakage failures.`,
        `Uber Michelangelo and Palette are useful case studies because they show feature management as part of a larger ML platform. The feature store is not isolated from training, serving, monitoring, governance, or experimentation. It is the contract layer that keeps those systems aligned around the values the model actually consumes.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Feature stores add platform cost. Teams must define features formally, operate pipelines, maintain online storage, manage backfills, document ownership, and keep offline and online paths in sync. For a small project with one batch model, that overhead may be unnecessary.`,
        `The tradeoff becomes favorable when the same feature is reused, when predictions happen online, or when leakage risk is high. Centralization also creates governance pressure. A feature that is wrong, biased, stale, or poorly documented can harm many models at once. The store makes reuse easier, so it also has to make review and deprecation explicit.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `A feature store can centralize bad definitions just as easily as good ones. Reusable does not mean causal, fair, stable, or safe. A feature can encode a proxy for a protected attribute, leak the label, collapse under distribution shift, or become stale after a product change. Owners still need tests, monitoring, model-impact review, and deprecation policy.`,
        `The serving path inherits distributed-systems bugs. Message queues can lag, duplicate, replay, or reorder events. Online stores can miss updates. Schema changes can silently default a column. A stale feature can be as damaging as a stale cache because the model may rely on it with high confidence. Rollbacks also need care: reverting model code without reverting feature definitions can leave the old model reading a new feature contract.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Sources: Uber Michelangelo at https://www.uber.com/us/en/blog/michelangelo-machine-learning-platform/ and Uber Palette at https://www.uber.com/us/en/blog/palette-meta-store-journey/. For implementation patterns, compare Feast at https://feast.dev/ and the feature-store materialization model it documents.`,
        `Study AI Engineering Stack: Five Parts Primer, Point-in-Time Feature Join Index, Leakage-Safe Target Encoding Case Study, Feature Freshness SLO Monitor, Training-Serving Skew Replay Diff, Data Leakage & Contamination, Cross-Validation & Honest Evaluation, Message Queues, Cache Invalidation & Versioning, Distributed Tracing, and LSM Trees (How Cassandra Writes) next.`,
        `A useful design review asks four questions for every feature: what event time defines it, what entity key owns it, what freshness window is acceptable online, and what historical join proves it did not see the future. If those answers are vague, the feature is not ready to be reused across models.`,
      ],
    },
  ],
};
