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
      heading: 'What it is',
      paragraphs: [
        'A feature freshness SLO monitor tracks whether online feature values are recent enough for prediction. It stores per-feature update times, source watermarks, materialization lag, TTLs, owners, dependent models, and fallback policies.',
        'The data structure is simple but important: a table of feature states plus a priority queue keyed by next freshness breach. The operational contract is that a model should never silently consume a value older than the feature definition allows.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each feature view reports successful materialization time, source watermark, row counts, error status, and online publication time. The monitor computes age and lag, compares them with the SLO, and updates a deadline heap. The heap top is the next feature likely to breach; alerts include owners and dependent models.',
        'At serving time, lookups should return not just a value but a freshness decision: fresh, stale with fallback, missing with default, or blocked. The decision is logged so delayed-label analysis can later separate model weakness from data-pipeline failure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Freshness monitoring is cheap compared with model inference, but it requires accurate clocks, event-time semantics, source lag metrics, materialization status, and dependency metadata. The hardest part is policy: deciding when to serve stale values, when to fall back, and when to block predictions.',
        'Watermarks, TTLs, SLOs, and freshness alerts should not be conflated. A watermark says how complete event time appears. A TTL says when a value is too old to serve. An SLO says when humans or automation should respond. A stale lookup log says what the model actually consumed.',
      ],
    },
    {
      heading: 'Complete case study: ETA road-speed feature',
      paragraphs: [
        'An ETA model depends on route_speed_5m. During a traffic spike, the stream processor falls behind and the online store keeps serving a 25-minute-old speed. Predictions look confident but are wrong in the busiest region. Without freshness metadata, this looks like model drift.',
        'With a freshness monitor, the deadline heap detects the SLO breach, the serving layer switches to a route-average fallback, and the alert names the lagging stream job plus every affected model. The incident is now a pipeline freshness problem, not a vague ML quality mystery.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use one freshness threshold for every feature. Static profile features, one-minute fraud counts, and real-time location features have different risk. Do not alert only on global averages; slice by region, tenant, model, and feature source. Do not let stale fallback become invisible, because the fallback may be safer but lower quality.',
        'Another mistake is relying on online-store write success alone. A write can succeed while the source is delayed, the watermark is stuck, or the transformation logic is wrong. Freshness must track the whole path from event source to model lookup.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Feast feature store concepts at https://feast.dev/blog/what-is-a-feature-store/, Tecton materialization docs at https://docs.tecton.ai/docs/1.0/materializing-features, Tecton introduction at https://docs.tecton.ai/docs/introduction, and Uber Palette at https://www.uber.com/us/en/blog/palette-meta-store-journey/. Study Feature Store, Streaming Watermarks, Message Queues, Cache Invalidation, Distributed Tracing, and MLOps next.',
      ],
    },
  ],
};
