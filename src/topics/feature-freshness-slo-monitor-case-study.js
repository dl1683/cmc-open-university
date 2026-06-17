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
    {
      heading: 'Why this exists',
      paragraphs: [
        `Online models do not only depend on model weights. They depend on data arriving on time. A fraud model may need a card velocity feature from the last few minutes. An ETA model may need fresh road speed. A ranking model may need recent clicks. If those values are old, the model can still return a confident score, but the score is now answering yesterday's question.`,
        `A feature freshness SLO monitor exists to make that hidden contract explicit. The contract is not "the feature job is running." It is "the value served to this model for this entity is fresh enough for this prediction." That distinction matters because online feature systems have several clocks: event time at the source, processing time in the stream, materialization time in the feature pipeline, publication time in the online store, and lookup time at serving.`,
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The first reasonable attempt is job monitoring. If the stream processor is up, the scheduled materialization job is green, and the online store is responding, the system looks healthy. This is useful basic observability. A failed job should page someone, and a broken online store should be visible immediately.`,
        `The second reasonable attempt is a simple age check. Store one last_update timestamp beside each feature and alert when now minus last_update exceeds a threshold. This is easy to explain, easy to graph, and good enough for a small feature set where every feature has the same cadence and the same business risk.`,
      ],
    },
    {
      heading: 'Where that breaks',
      paragraphs: [
        `Job status is too far away from the prediction. A pipeline can be green while its source is late, while one partition is missing, while the event-time watermark is stuck, or while the online store is still serving an old value because the final publication step failed. Green infrastructure does not prove fresh features.`,
        `A single global threshold also collapses facts that should stay separate. A daily profile feature, a five-minute road-speed feature, and a thirty-second fraud counter do not deserve the same SLO. Watermark lag is not the same as materialization lag. A TTL is not the same as an alert threshold. A fallback decision at lookup time is not the same as the feature being healthy. Once those facts are mixed together, the monitor cannot tell whether to wait, page, degrade, block, or replay.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to treat freshness as serving state, not as a dashboard decoration. Each online feature needs a small record that says when the value was last produced, which source watermark it reflects, when it entered the online store, how old it is allowed to be, which models depend on it, who owns it, and what serving should do when it is stale.`,
        `The useful data structure is a feature-state table plus a priority queue keyed by next breach time. The table holds the facts. The heap makes monitoring cheap. When a feature materializes successfully, the monitor updates its timestamps and pushes the next deadline forward. The heap top is the next feature expected to violate its contract, so the monitor does not have to scan every feature every second.`,
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `At write time, the feature pipeline publishes both a value and metadata. The metadata should include at least the feature id, entity key, source event-time watermark, materialization timestamp, online publication timestamp, row count or coverage signal, version, and producer. The feature registry supplies the SLO, TTL, owner, dependent models, and fallback policy.`,
        `At monitor time, the system computes the next breach deadline for each feature or feature slice. For example, if route_speed_5m was last published at 10:58 with a five-minute SLO, its alert deadline is 11:03 and its serve TTL may be 11:08. Those can be different because alerting should start before serving becomes unsafe. A min-heap or timer wheel keeps the nearest deadlines visible. When the heap top is in the past, the monitor verifies the current table entry, emits an alert, and marks affected serving paths as degraded if the policy requires it.`,
        `At lookup time, serving checks freshness before handing a value to the model. The decision can be return fresh value, return fallback, return default, block, or ask for manual review. That decision is logged with feature id, model id, entity, age, fallback used, and reason. Those logs are not bookkeeping. They let later model evaluation separate "the model was weak" from "the model was fed stale inputs."`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The lag-heap view proves that freshness monitoring is a deadline system. Events, stream processing, materialization, online storage, model lookup, fallback, and alerting are not independent boxes. They form a control loop. The table shows that the monitor must store per-feature state, while the heap shows why the next breach can be found without repeatedly scanning the whole catalog.`,
        `The stale-fallback view proves the second half: detecting staleness is not enough. A production system has to decide what the model consumes when the value is late or missing. A stale fraud count may require holding a transaction. A stale ETA speed may fall back to a route average. A low-risk profile field may serve the last good value. The visual ties freshness to the actual serving decision, which is where users feel the failure.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The monitor works because it preserves a simple invariant: a served feature value is never just a value. It is a value plus an age, source progress signal, policy, and serving decision. If any of those pieces is missing, the system is guessing.`,
        `The priority queue is correct for deadline detection for the same reason a scheduler heap is correct: the earliest deadline is always at the top. If the top feature has not breached yet, no later-deadline feature has breached under the same clock. If the top has breached, the monitor checks whether a newer materialization already moved the deadline; if so, it updates the heap entry and continues. This lazy-update pattern keeps the monitor cheap while still handling frequent feature updates.`,
        `The lookup log closes the loop. Once fresh, fallback, missing, default, and blocked decisions are recorded, offline replay can evaluate model behavior under the data the model actually saw. That is the correctness test for the whole design: can an incident reviewer reconstruct which stale feature affected which model predictions, which fallback ran, and when the feature recovered?`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Freshness monitoring costs metadata, storage writes, alert design, and operational discipline. Per-entity freshness can become large, so systems often monitor both coarse feature-level deadlines and important slices such as region, tenant, merchant class, or route. The deeper the slicing, the better the detection and the higher the cardinality.`,
        `Alerting has its own tax. If the SLO is too tight, normal late events become noise. If it is too loose, stale predictions reach users. If fallback is too aggressive, the model may degrade more often than necessary. If fallback is too relaxed, the model may consume values that should have been blocked. Freshness SLOs are product contracts, not only engineering thresholds.`,
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        `Freshness monitoring matters most when features drive immediate decisions: fraud scoring, ETA, dispatch, risk limits, pricing, ads, recommendations, search ranking, support routing, and abuse detection. In each case, one stale feature can affect many predictions because the online store fans out into multiple serving paths.`,
        `The ETA example is typical. During a traffic spike, a route speed stream falls behind. Without a freshness monitor, the ETA model continues serving old speeds with clean infrastructure dashboards. With freshness state, the deadline breach is detected, serving switches to a route-average fallback, and the alert names the source stream, affected feature, dependent model, region, and owner.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The common failure is averaging away the incident. A global freshness chart can look healthy while one city, tenant, feature slice, or source partition is stale enough to break the product. Slice the SLO around the way predictions are made, not around the way dashboards look neat.`,
        `Clock mistakes are another source of false confidence. Event time, processing time, publication time, and lookup time must be named separately. Late events can move a watermark differently from a materialization timestamp. Retries can update publication time without improving source completeness. Backfills can create fresh writes for old event time. If the monitor does not distinguish those cases, it will page for the wrong reason.`,
        `A final failure is invisible fallback. Fallback can be the right safety move, but it still changes product behavior. If the system does not log fallback use, a team may blame model quality for a data incident or miss that one high-value slice has been running degraded for days.`,
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        `Study feature stores to understand offline-online consistency, streaming watermarks to understand event-time progress, message queues to understand source lag and delivery semantics, cache invalidation to understand stale reads, distributed tracing to connect data incidents to serving paths, and MLOps monitoring to connect feature health to model quality. Useful public references include Feast feature store concepts at https://feast.dev/blog/what-is-a-feature-store/, Tecton materialization documentation at https://docs.tecton.ai/docs/1.0/materializing-features, and Uber Palette at https://www.uber.com/us/en/blog/palette-meta-store-journey/.`,
      ],
    },
  ],
};
