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
  const features = [
    ['rides7d', 'rider_rides_7d'],
    ['cancel1h', 'driver_cancel_1h'],
    ['city', 'city_surge_level'],
    ['device', 'device_age_days'],
  ];
  const risks = [
    ['Spark window includes full day', 'Redis window at request time', 'definition drift'],
    ['computed after trip closes', 'not available yet', 'time travel'],
    ['hourly batch table', 'stream updates every minute', 'freshness gap'],
    ['same library, same timestamp', 'same library, same timestamp', 'healthy'],
  ];
  const unhealthy = risks.filter(r => r[2] !== 'healthy');
  yield {
    state: labelMatrix(
      'The bug feature stores were built to kill',
      features,
      [
        ['offline', 'training value'],
        ['online', 'serving value'],
        ['risk', 'risk'],
      ],
      risks,
    ),
    highlight: {
      removed: ['rides7d:risk', 'cancel1h:risk', 'city:risk'],
      found: ['device:risk'],
    },
    explanation: `A model is trained offline and served online. If those two paths compute "the same" feature differently, the model learns one world and lives in another. Of ${features.length} features examined, ${unhealthy.length} show skew — feature stores exist to make features reusable, governed, and consistent: one definition, materialized into an offline history for training and an online value for low-latency serving.`,
    invariant: `A feature is production-ready only if the training value and serving value obey the same definition at the same prediction time — ${unhealthy.length} of ${features.length} features here violate that.`,
  };

  const pipelineNodes = ['events', 'definition', 'offline', 'online', 'training', 'serving'];
  yield {
    state: pipelineGraph('one definition, two materializations'),
    highlight: {
      active: ['definition'],
      compare: ['offline', 'online'],
      found: ['e-definition-offline', 'e-definition-online'],
    },
    explanation: `The core architecture is deliberately boring. ${pipelineNodes.length} nodes form the pipeline: raw events feed one feature definition. That definition writes historical rows into the offline store and fresh values into the online store. Training reads historical snapshots; serving reads the current online row. The hard part is not drawing the ${pipelineNodes.length} boxes — the hard part is proving both materializations came from the same contract.`,
  };

  const contractFields = [
    ['entity', 'entity key'],
    ['time', 'event timestamp'],
    ['window', 'window logic'],
    ['freshness', 'freshness SLO'],
    ['owner', 'owner + tests'],
  ];
  yield {
    state: labelMatrix(
      'Feature contract: what must be written down',
      contractFields,
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
    explanation: `A feature store is more governance system than database. Every feature needs ${contractFields.length} contract fields — ${contractFields.map(f => f[1]).join(', ')} — plus lineage. Without those, reuse becomes copy-paste with better branding. With them, teams can share features without reopening the same leakage and skew bugs in every project.`,
  };
}

function* pointInTimeJoins() {
  const predictions = [
    ['t1005', '10:05 prediction'],
    ['t1020', '10:20 prediction'],
    ['t1050', '10:50 prediction'],
  ];
  const leakedRows = predictions.slice(0, -1);
  yield {
    state: labelMatrix(
      'Wrong join: latest value leaks the future',
      predictions,
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
    explanation: `Training data construction is where many feature stores earn their keep. With ${predictions.length} prediction times, a latest-value join leaks the future into ${leakedRows.length} of them. The model trains on tomorrow. A point-in-time join instead asks: "what was the last known feature value as of this prediction timestamp?" That is Data Leakage & Contamination defense in database form.`,
    invariant: `For each of the ${predictions.length} training rows at time t, every joined feature must be computed from information available at or before t.`,
  };

  const joinSteps = [
    ['lookup', 'lookup key'],
    ['filter', 'time filter'],
    ['rank', 'rank values'],
    ['select', 'select value'],
  ];
  yield {
    state: labelMatrix(
      'Point-in-time join mechanics',
      joinSteps,
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
    explanation: `Mechanically, the point-in-time join is a ${joinSteps.length}-step constrained nearest-neighbor lookup in time: ${joinSteps.map(s => s[1]).join(' → ')}. This sounds like SQL plumbing until you see the consequence: Cross-Validation & Honest Evaluation can be perfectly coded and still meaningless if feature joins leaked future rows before the split.`,
  };

  yield {
    state: pipelineGraph('operational loop: freshness, tracing, rollback'),
    highlight: {
      active: ['events', 'online', 'serving'],
      compare: ['training', 'offline'],
      found: ['e-online-serving', 'e-offline-training'],
    },
    explanation: `In production, the feature store is watched like any other serving system. All ${joinSteps.length} join steps must execute within latency budgets — Message Queues deliver events, online stores need cache-like freshness guarantees, offline stores need backfills, and Distributed Tracing needs to show which feature lookup slowed or failed. The model is only one dependency; the feature pipeline is the nervous system feeding it.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization runs two views. The training-serving skew view lays out a table of features, comparing how each one is computed during training versus serving, and flags the risk when they disagree. The point-in-time joins view walks through the timeline of raw events, showing which feature values a correct join would select for a given prediction timestamp. Watch for the moment a naive latest-value join grabs a future event that a point-in-time join correctly excludes.',
        {type: 'image', src: './assets/gifs/feature-store.gif', alt: 'Animated walkthrough of the feature store visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Each frame highlights one operation. The slider lets you scrub back to any step. Pay attention to timestamps on events and feature rows — the core lesson lives in which values land in training rows and why.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A machine learning model consumes input values called features — numbers or categories that describe an entity (a user, a transaction, a product) at a moment in time. During training, you build a dataset of historical features joined to known outcomes. During serving, you look up the freshest feature values for a live entity and feed them to the model for a prediction. The problem is that these two paths — historical scan and live lookup — are built with different tools, run at different speeds, and can silently disagree about what a feature means.',
        {
          type: `callout`,
          text: `A feature store is the contract layer between historical training rows and low-latency serving values, with time as the invariant that keeps them aligned.`,
        },
        'A feature store is a system that enforces a single definition for each feature and materializes it into both an offline store (for training) and an online store (for serving). It is not a database with ML columns. It is a registry of definitions, each specifying an entity key, a time semantics, a computation, an owner, and a freshness contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to let each team write its own SQL for training and its own code for serving. A data scientist writes a Spark job that counts a rider\'s trips over closed daily partitions. A backend engineer writes a streaming counter that increments on each trip event. Both columns are named rider_trips_7d, but they compute different things: one uses calendar-day boundaries, the other uses a sliding 168-hour window from the request timestamp.',
        'A second instinct is to share a warehouse table of precomputed columns without formal contracts. Anyone can read the table, but nobody documents which column is the entity key, what the event-time semantics are, what the aggregation window means, who owns it, or what happens when the source schema changes. Reuse without discipline spreads bugs across every model that touches the table.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'These approaches break when models go online. A batch model retrained weekly on warehouse data can tolerate loose feature definitions because the same pipeline produces both training data and batch predictions. But the moment you serve predictions in real time — fraud scoring at checkout, ETA estimates on ride request, ad ranking on page load — the training pipeline and the serving pipeline diverge. They run on different infrastructure, at different latencies, with different data freshness.',
        'The result is training-serving skew: the model trained on features computed one way, but at prediction time it receives features computed another way. The model\'s accuracy in offline evaluation does not transfer to production. Worse, the failure is silent. No error is thrown. The model simply makes slightly worse predictions, and the degradation is invisible until someone builds a monitoring system to detect it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The fix is to define each feature exactly once and materialize it into two stores from that single definition. The definition specifies: the entity key (e.g., rider_id), the source data (e.g., trip_events stream), the computation (e.g., COUNT where event_time is within 7 days of the anchor timestamp), the default value (e.g., 0 for new riders), and the freshness target (e.g., online value must be no more than 5 minutes stale).',
        'The offline store holds historical feature values keyed by (entity, timestamp). It supports point-in-time joins for training dataset construction. The online store holds the latest feature value keyed by entity alone. It supports low-latency lookups for serving. The storage engines can be completely different — Parquet files in S3 for offline, Redis or DynamoDB for online — but both are populated from the same definition, so the semantics are guaranteed to match.',
        {
          type: `image`,
          src: `https://docs.feast.dev/~gitbook/image?dpr=3&quality=100&sign=cfd7770a&sv=2&url=https%3A%2F%2F3574186616-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FvCDTUDp5EGcTxNy4CVdG%252Fuploads%252Fgit-blob-9f7df7c01969608f5a8b1d48b21f20ddeaed5590%252Ffeast_marchitecture.png%3Falt%3Dmedia&width=768`,
          alt: `Feast feature store architecture with request, stream, and batch sources feeding online and offline features`,
          caption: `Feast separates feature registration, storage, and serving while exposing online features for inference and offline features for training. Source: Feast documentation, https://docs.feast.dev/`,
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A feature store operates on three planes. The registry plane stores feature definitions — name, entity key, type, computation logic, owner, freshness SLO. The materialization plane runs pipelines that read source data and write computed values into both offline and online stores. The serving plane exposes an API: given an entity key, return the current feature vector for prediction.',
        'The offline materialization path typically runs as a batch job. It reads event logs or warehouse tables, applies the feature computation at every historical timestamp, and writes (entity, timestamp, value) tuples into columnar storage. The online materialization path runs as a streaming job or a scheduled micro-batch. It reads the same source events, applies the same computation, and upserts the latest value into a key-value store.',
        'Point-in-time joins are the critical offline operation. When constructing a training row for entity E at prediction time T, the join selects the feature value with the largest timestamp that is still less than or equal to T. This ensures the training row sees only information that was available before the prediction moment. The join rule is: same entity, feature_time <= prediction_time, newest qualifying row wins.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is simple. If training and serving both derive feature values from the same definition, and the offline join respects temporal ordering, then the features a model trains on match the features it will see in production. There is no skew because there is no second implementation to disagree with the first.',
        'The point-in-time join eliminates data leakage by construction. A fraud label at 10:05 AM can only join to feature values computed before 10:05 AM. If a chargeback event arrived at 10:50 AM and updated the feature, that update is invisible to the 10:05 training row. This means offline evaluation metrics reflect what the model would actually achieve in production, not an artificially inflated score from peeking at the future.',
        'Timestamp discipline converts feature engineering into a temporal database problem. Every event has an event time (when it happened), an ingestion time (when the system recorded it), and sometimes a processing time (when the pipeline computed it). A correct feature store tracks event time and uses it consistently across both stores.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The primary cost is operational overhead. Each feature definition requires a computation pipeline, storage in two systems, freshness monitoring, backfill support, and an owner. For a team with one batch model and no real-time serving, this overhead outweighs the benefit. The break-even point is roughly when you have multiple models reusing the same features or when you serve predictions online.',
        'Storage cost scales with the number of features times the number of entities times the historical depth. A feature store with 500 features, 10 million entities, and 90 days of daily snapshots holds 450 billion (entity, feature, timestamp) tuples offline. Online storage is cheaper because it only holds the latest value per entity: 500 features times 10 million entities is 5 billion key-value pairs, which fits in a Redis cluster or a DynamoDB table.',
        'Latency cost depends on the online store. A Redis lookup returns in under 1 ms. DynamoDB single-digit milliseconds. The serving API adds serialization and network overhead, so typical end-to-end feature retrieval for a single entity runs 2-10 ms. Batch retrieval for multiple entities can be parallelized.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Fraud detection at payment companies is a canonical use case. A transaction arrives, the serving layer looks up the merchant\'s chargeback rate over the past 30 days, the user\'s average transaction amount, the device\'s age, and the IP\'s country. All of these are features maintained in the online store. The fraud model scores the transaction in under 50 ms. The same features, joined point-in-time to historical fraud labels, form the training set.',
        'Ride-hailing ETA prediction uses features like driver_trips_completed, surge_multiplier_zone, traffic_speed_segment, and rider_cancellation_rate. Uber\'s Michelangelo platform and its successor Palette manage thousands of such features across dozens of models. The feature store is part of a larger ML platform that handles training, serving, monitoring, and experimentation as a unified system.',
        'Recommendation systems at e-commerce and content platforms rely on user-item interaction features (click_rate_30d, purchase_count_7d, time_since_last_visit) that must be fresh for serving and historically accurate for training. A shared feature store prevents every recommendation team from building its own feature pipeline.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A feature store centralizes definitions, but centralization does not guarantee quality. A reusable feature can encode a proxy for a protected attribute (zip code as a proxy for race), leak the label (joining to post-outcome data), collapse under distribution shift (a feature trained on pre-COVID behavior applied post-COVID), or go stale after a product change (a feature counting app opens after the app is redesigned). The store makes reuse easy; it does not make reuse safe without tests and review.',
        'The serving path inherits distributed-systems failure modes. Message queues can lag, duplicate, or reorder events. Online stores can miss writes during failover. Schema changes can silently null a column, causing the model to receive default values instead of real ones. A stale feature is as dangerous as a stale cache — the model trusts it with high confidence and nobody notices the degradation until metrics are reviewed.',
        'Rollback hazards also apply. If you revert model code to a previous version but the feature store now materializes features under a newer definition, the old model reads features it was never trained on. Feature versioning and model-feature compatibility checks are necessary but often missing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you run a food delivery app and want to predict delivery time. You define a feature restaurant_avg_prep_minutes_7d: entity key is restaurant_id, source is order_completed events, computation is AVG(prep_time) over events in the 7-day window before the anchor timestamp, default is 15.0 for new restaurants.',
        'Your offline store has these rows for restaurant_id=42: (June 1, 12.3), (June 2, 13.1), (June 3, 11.8), (June 4, 14.0), (June 5, 12.5). A training example labeled at June 3 18:00 needs a point-in-time join. The join selects the row with the largest timestamp <= June 3 18:00, which is (June 3, 11.8). It does not use June 4\'s value of 14.0, even though that row exists in the table, because it was computed after the prediction moment.',
        'Your online store holds the latest value for restaurant_id=42: 12.5 (from June 5). When a customer opens the app on June 5 and the model predicts delivery time, it retrieves 12.5 from the online store in 3 ms. The training row and the serving lookup use the same AVG(prep_time) computation. The only difference is the time anchor: historical for training, now for serving.',
        'If instead you had used a naive latest-value join for training, the June 3 training row would have joined to 12.5 (the latest value in the table at query time), not 11.8 (the value known at June 3). The model would have trained on future information, and its offline accuracy would overestimate its real-world performance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Uber Michelangelo: https://www.uber.com/us/en/blog/michelangelo-machine-learning-platform/. Uber Palette: https://www.uber.com/us/en/blog/palette-meta-store-journey/. Feast open-source feature store: https://feast.dev/ and its architecture documentation at https://docs.feast.dev/.',
        'Study Data Leakage & Contamination and Cross-Validation & Honest Evaluation next — the point-in-time join is the mechanism that prevents the leakage those topics describe. Then explore Message Queues, Cache Invalidation & Versioning, and Distributed Tracing for the infrastructure that online feature serving depends on. LSM Trees (How Cassandra Writes) explains the storage engine behind many online feature stores.',
      ],
    },
  ],
};
