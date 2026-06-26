// Feature freshness monitor: track event-time progress, materialization lag,
// TTL expiry, and fallback behavior for online ML features.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'feature-freshness-slo-monitor-case-study',
  title: 'Feature Freshness SLO Monitor',
  category: 'Systems',
  summary: 'Track last update time, watermark lag, TTL expiry, and fallback paths so online feature values do not silently go stale.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lag heap', 'stale fallback'], defaultValue: 'lag heap' },
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

function freshnessGraph(title) {
  return graphState({
    nodes: [
      { id: 'events', label: 'events', x: 0.8, y: 3.2, note: 'source' },
      { id: 'stream', label: 'stream', x: 2.25, y: 3.2, note: 'lag' },
      { id: 'wm', label: 'wm', x: 3.7, y: 2.0, note: 'progress' },
      { id: 'mat', label: 'material', x: 3.7, y: 4.35, note: 'compute' },
      { id: 'online', label: 'online', x: 5.35, y: 3.2, note: 'KV' },
      { id: 'heap', label: 'heap', x: 6.9, y: 2.0, note: 'deadlines' },
      { id: 'alert', label: 'alert', x: 8.45, y: 2.0, note: 'page' },
      { id: 'model', label: 'model', x: 7.5, y: 4.4, note: 'lookup' },
      { id: 'fallback', label: 'fallback', x: 8.9, y: 4.4, note: 'safe' },
    ],
    edges: [
      { id: 'e-events-stream', from: 'events', to: 'stream' },
      { id: 'e-stream-wm', from: 'stream', to: 'wm' },
      { id: 'e-stream-mat', from: 'stream', to: 'mat' },
      { id: 'e-mat-online', from: 'mat', to: 'online' },
      { id: 'e-online-heap', from: 'online', to: 'heap' },
      { id: 'e-heap-alert', from: 'heap', to: 'alert' },
      { id: 'e-online-model', from: 'online', to: 'model' },
      { id: 'e-model-fallback', from: 'model', to: 'fallback' },
    ],
  }, { title });
}

function* lagHeap() {
  yield {
    state: freshnessGraph('Freshness is a serving contract'),
    highlight: { active: ['events', 'stream', 'mat', 'online'], compare: ['model'] },
    explanation: 'Online feature stores usually serve latest values. Latest is only useful if the pipeline is fresh enough for the model. A freshness SLO turns that expectation into a monitored data structure.',
  };

  yield {
    state: labelMatrix(
      'Per-feature freshness table',
      [
        { id: 'rides', label: 'rides_7d' },
        { id: 'charge', label: 'charge_1h' },
        { id: 'city', label: 'city_lvl' },
        { id: 'device', label: 'device_age' },
      ],
      [
        { id: 'last', label: 'last upd' },
        { id: 'SLO', label: 'SLO' },
        { id: 'age', label: 'age' },
        { id: 'state', label: 'state' },
      ],
      [
        ['10:58', '10m', '2m', 'ok'],
        ['10:35', '5m', '25m', 'late'],
        ['10:50', '15m', '10m', 'ok'],
        ['daily', '24h', '8h', 'ok'],
      ],
    ),
    highlight: { active: ['charge:age'], removed: ['charge:state'], found: ['rides:state', 'city:state'] },
    explanation: 'The monitor stores last successful materialization time, expected SLO, current age, source watermark, and owner. A single stale feature can degrade every model that depends on it.',
    invariant: 'A feature value without freshness metadata is an unbounded assumption.',
  };

  yield {
    state: freshnessGraph('A deadline heap finds the next feature to breach'),
    highlight: { active: ['online', 'heap'], found: ['alert'], compare: ['wm'] },
    explanation: 'A priority queue keyed by next breach time keeps monitoring cheap. Each successful update pushes the feature deadline forward. The heap top tells the system which feature will violate freshness next.',
  };

  yield {
    state: labelMatrix(
      'Watermark and freshness signals differ',
      [
        { id: 'wm', label: 'watermark' },
        { id: 'lag', label: 'source lag' },
        { id: 'mat', label: 'mat lag' },
        { id: 'lookup', label: 'lookup age' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'alert', label: 'alert on' },
      ],
      [
        ['event done?', 'stuck wm'],
        ['input delayed?', 'queue lag'],
        ['job delayed?', 'missed run'],
        ['value stale?', 'TTL breach'],
      ],
    ),
    highlight: { active: ['wm:asks', 'mat:alert', 'lookup:alert'], compare: ['lag:alert'] },
    explanation: 'Watermarks describe event-time completeness. Freshness describes whether the online value is recent enough for prediction. Both matter, but they catch different failures.',
  };

  yield {
    state: freshnessGraph('Alerts should name the dependent models'),
    highlight: { active: ['heap', 'alert'], found: ['model'], compare: ['fallback'] },
    explanation: 'A useful alert says which feature is stale, why it is stale, which models depend on it, and what fallback path is active. Otherwise the monitor creates noise rather than incident response.',
  };
}

function* staleFallback() {
  yield {
    state: labelMatrix(
      'Fallback policy by feature class',
      [
        { id: 'fraud', label: 'fraud cnt' },
        { id: 'eta', label: 'ETA speed' },
        { id: 'profile', label: 'profile' },
        { id: 'risk', label: 'risk flag' },
      ],
      [
        { id: 'fallback', label: 'fallback' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['deny/hold', 'safety'],
        ['route avg', 'quality'],
        ['last good', 'low'],
        ['manual gate', 'high'],
      ],
    ),
    highlight: { active: ['fraud:fallback', 'risk:fallback'], compare: ['eta:risk'], found: ['profile:fallback'] },
    explanation: 'Not every stale feature deserves the same response. A stale fraud count may require blocking or manual review. A stale ETA speed can fall back to a regional average. The feature contract should say what happens before an incident.',
  };

  yield {
    state: freshnessGraph('Complete case: ETA feature lag'),
    highlight: { active: ['events', 'stream', 'mat', 'online', 'model'], removed: ['heap'], found: ['fallback'] },
    explanation: 'Case study: an ETA model depends on current road speed. A stream processor falls behind during a traffic spike. The monitor sees the deadline breach, marks the feature stale, and switches lookup to a route-average fallback while alerting the owner.',
  };

  yield {
    state: labelMatrix(
      'Serving decision record',
      [
        { id: 'ok', label: 'fresh' },
        { id: 'late', label: 'stale' },
        { id: 'miss', label: 'missing' },
        { id: 'bad', label: 'bad src' },
      ],
      [
        { id: 'return', label: 'return' },
        { id: 'log', label: 'log' },
      ],
      [
        ['feature', 'age=2m'],
        ['fallback', 'age=25m'],
        ['default', 'cold start'],
        ['block', 'bad source'],
      ],
    ),
    highlight: { found: ['ok:return'], active: ['late:return', 'late:log'], removed: ['bad:return'] },
    explanation: 'Every serving lookup should log the decision: fresh value, fallback, default, or block. Those logs feed skew replay and delayed-label analysis later.',
  };

  yield {
    state: labelMatrix(
      'Freshness controls',
      [
        { id: 'ttl', label: 'TTL' },
        { id: 'slo', label: 'SLO' },
        { id: 'owner', label: 'owner' },
        { id: 'slice', label: 'slice' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'pitfall', label: 'pitfall' },
      ],
      [
        ['serve limit', 'too loose'],
        ['alert limit', 'too noisy'],
        ['fix team', 'orphaned'],
        ['who hurt?', 'avg hides'],
      ],
    ),
    highlight: { active: ['ttl:meaning', 'slo:meaning', 'slice:meaning'], compare: ['owner:pitfall'] },
    explanation: 'Freshness must be sliced by model, entity, region, and source. A global average can hide that one city, merchant segment, or tenant is stale enough to break predictions.',
  };

  yield {
    state: freshnessGraph('Freshness closes the feature-store control loop'),
    highlight: { active: ['heap', 'alert', 'model', 'fallback'], found: ['online'], compare: ['wm'] },
    explanation: 'The monitor connects data engineering to model serving. It turns stream lag into a model-facing state change and gives incident response enough context to fix the right pipeline.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lag heap') yield* lagHeap();
  else if (view === 'stale fallback') yield* staleFallback();
  else throw new InputError('Pick a freshness view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The animation tracks feature freshness. A feature is an input value used by a model, such as a user\'s recent click count or a merchant\'s fraud score. Active nodes are updates moving through the pipeline, found nodes are features inside the freshness target, and compare nodes are stale features near or beyond the limit.',
      'SLO means service-level objective: a measurable reliability target. Here the target is not whether the service is up, but whether online features are recent enough for safe prediction. The safe inference rule is: a prediction should use a feature only if its event time or materialization time is inside the allowed age window.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Machine-learning systems often fail because inputs age out, not because the model code crashes. A fraud model trained on one-minute transaction counts can behave badly if the online store serves counts from 40 minutes ago. The model still returns a score, but the score is based on stale evidence.',
      'A freshness SLO makes that failure visible. It defines an age budget, measures lag per feature or feature group, and decides whether to alert, fallback, or block serving. The monitor turns silent data delay into an operational signal.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is job health monitoring. Check whether Kafka consumers are running, batch jobs succeeded, and the online store accepts writes. These checks are useful because broken infrastructure often causes stale features.',
      'They are not enough because green jobs can still produce old data. A consumer may be running but 30 minutes behind. A batch job may succeed using yesterday\'s partition because today\'s source file was late.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that freshness is end-to-end. Source event time, stream processing lag, batch schedule delay, materialization lag, and online-store read age all contribute to the value a model sees. Monitoring one component cannot prove the final feature is fresh.',
      'The wall also includes uneven feature criticality. A profile age feature may tolerate one day of staleness, while a fraud velocity feature may tolerate 90 seconds. A single global data-delay alert is too blunt for model behavior.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Attach an age budget to each feature or feature view, then measure the served value against that budget. Feature view means a logical group of feature columns built from a source and used for online or offline retrieval. Freshness is computed as now minus the timestamp that proves when the feature was valid.',
      'The monitor should track percentiles, not just averages. A p50 age of 20 seconds can hide a p99 age of 30 minutes. The SLO is a contract over the tail because a small stale slice can harm the most important requests.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Each materialized feature carries a timestamp, usually event time or feature computation time. The online read path or a shadow monitor samples entities and computes age = now - feature_timestamp. The monitor groups those ages by feature view, tenant, region, and model.',
      'A freshness SLO might say that 99 percent of fraud_velocity reads must be younger than 120 seconds over a rolling 10-minute window. If the p99 age crosses 120 seconds, the system burns error budget. If it crosses a hard safety threshold, serving can switch to fallback features or reject the prediction.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness comes from measuring the same value the model consumes. If the online store returns a feature timestamp of 12:00:40 and the request arrives at 12:02:00, the feature age is 80 seconds. That is the age that matters, regardless of whether the upstream job reports healthy.',
      'The SLO is valid when timestamps have clear meaning and clock skew is bounded. Event-time freshness answers how old the real-world observation is. Processing-time freshness answers how long the pipeline took to publish it.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Cost behaves with sampled reads times feature count. If a model uses 200 features and the monitor samples 1,000 requests per minute, naive per-feature logging emits 200,000 age records per minute. Aggregating at feature-view level can cut volume while preserving useful diagnosis.',
      'The operational cost is false confidence versus alert noise. A 99 percent SLO allows 1 stale read per 100. At 50,000 predictions per minute, that is 500 stale predictions per minute before the SLO is technically violated.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Freshness SLOs fit fraud detection, recommendations, logistics ETA, ad ranking, credit risk, and marketplace trust systems. These models depend on recent behavior, and stale inputs can create wrong decisions without throwing exceptions. The access pattern is online prediction backed by streamed or scheduled feature materialization.',
      'They also fit feature stores. A feature store gives teams a shared place to define, materialize, and retrieve features. Freshness monitoring adds the missing reliability layer: whether the feature served now still represents the world the model was trained to expect.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Freshness monitoring fails when timestamps are missing, overwritten, or semantically wrong. If a batch job stamps every row with load time instead of event time, a week-old source can look fresh. The monitor then proves only that the bad data was loaded recently.',
      'It also fails when fallback behavior is untested. A system can detect stale features and then route all traffic to a default that the model never saw during training. Freshness SLOs need offline evaluation of fallback paths, not just dashboards.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose a fraud model uses transaction_count_5m with an SLO: 99 percent of reads must be under 120 seconds old. During one 10-minute window, the service handles 60,000 predictions. The SLO allows at most 600 reads over 120 seconds.',
      'The monitor samples 6,000 predictions and finds 90 stale reads. That is 1.5 percent stale, which estimates 900 stale reads across the full window. The system has exceeded the budget by about 300 stale reads and should alert.',
      'A fallback rule says that if feature age exceeds 300 seconds, use a conservative risk score and tag the decision. In the sample, 12 reads exceed 300 seconds. Those predictions should not silently use the stale count because the model would treat it as current behavior.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Google SRE material on SLOs and Feast documentation on feature views, feature retrieval, stream feature views, and validation. For production design, study feature-store documentation that distinguishes event time from materialization time.',
      'Study next: feature stores, streaming watermarks, backpressure, delayed data, model monitoring, training-serving skew, and error budgets. The main lesson is that data freshness is a serving contract, not a dashboard afterthought.',
    ] },
  ],
};
