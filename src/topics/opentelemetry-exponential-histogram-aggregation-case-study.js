// OpenTelemetry exponential histograms: base-2 bucket indexes, scale,
// positive/negative ranges, min/max, temporality, views, and export.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'opentelemetry-exponential-histogram-aggregation-case-study',
  title: 'OpenTelemetry Exponential Histogram Aggregation',
  category: 'Systems',
  summary: 'How OpenTelemetry SDKs aggregate measurements into base-2 exponential histograms with scale, bucket indexes, temporality, min/max, and exporter compatibility.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sdk aggregation', 'export compatibility'], defaultValue: 'sdk aggregation' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function otelGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'measure', label: 'measure', x: 0.7, y: 3.8, note: notes.measure ?? 'latency' },
      { id: 'view', label: 'view', x: 2.2, y: 2.1, note: notes.view ?? 'agg choice' },
      { id: 'scale', label: 'scale', x: 4.0, y: 2.1, note: notes.scale ?? 'resolution' },
      { id: 'index', label: 'index', x: 5.7, y: 2.1, note: notes.index ?? 'bucket id' },
      { id: 'pos', label: '+buckets', x: 7.4, y: 2.1, note: notes.pos ?? 'counts' },
      { id: 'zero', label: 'zero', x: 4.0, y: 5.5, note: notes.zero ?? 'near 0' },
      { id: 'neg', label: '-buckets', x: 5.7, y: 5.5, note: notes.neg ?? 'counts' },
      { id: 'point', label: 'point', x: 7.4, y: 5.5, note: notes.point ?? 'OTLP' },
      { id: 'export', label: 'export', x: 9.1, y: 3.8, note: notes.export ?? 'backend' },
    ],
    edges: [
      { id: 'e-measure-view', from: 'measure', to: 'view', weight: '' },
      { id: 'e-view-scale', from: 'view', to: 'scale', weight: 'config' },
      { id: 'e-scale-index', from: 'scale', to: 'index', weight: 'map' },
      { id: 'e-index-pos', from: 'index', to: 'pos', weight: '+' },
      { id: 'e-index-neg', from: 'index', to: 'neg', weight: '-' },
      { id: 'e-scale-zero', from: 'scale', to: 'zero', weight: '' },
      { id: 'e-pos-point', from: 'pos', to: 'point', weight: '' },
      { id: 'e-neg-point', from: 'neg', to: 'point', weight: '' },
      { id: 'e-zero-point', from: 'zero', to: 'point', weight: '' },
      { id: 'e-point-export', from: 'point', to: 'export', weight: 'OTLP' },
    ],
  }, { title });
}

function* sdkAggregation() {
  yield {
    state: otelGraph('The SDK aggregates many measurements into one data point'),
    highlight: { active: ['measure', 'view', 'scale', 'index', 'point'], compare: ['export'] },
    explanation: 'An application records many measurements. The OpenTelemetry SDK view and aggregation decide whether those measurements become sums, explicit histograms, or exponential histograms before export.',
    invariant: 'Aggregation happens before export; the backend sees data points, not every raw measurement.',
  };

  yield {
    state: labelMatrix(
      'Exponential histogram parts',
      [
        { id: 'scale', label: 'scale' },
        { id: 'pos', label: '+range' },
        { id: 'neg', label: '-range' },
        { id: 'zero', label: 'zero' },
        { id: 'minmax', label: 'min/max' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['precision', 'size'],
        ['positive', 'offset'],
        ['negative', 'rare'],
        ['near 0', 'width'],
        ['bounds', 'compat'],
      ],
    ),
    highlight: { active: ['scale:role', 'pos:role', 'zero:role'], compare: ['minmax:risk'] },
    explanation: 'OpenTelemetry exponential histograms carry a scale, positive and negative bucket ranges, a zero count, count, sum, and optional min/max. The scale controls relative precision and bucket count.',
  };

  yield {
    state: otelGraph('Bucket indexes are compact over high dynamic range', { scale: 's=4', index: 'floor(log2)', pos: 'sparse counts' }),
    highlight: { active: ['scale', 'index', 'pos', 'e-scale-index', 'e-index-pos'], compare: ['zero'] },
    explanation: 'The bucket mapping is exponential. That keeps relative error more stable across small and large values than a fixed-width linear histogram while avoiding hand-picked bucket boundaries for every instrument.',
  };

  yield {
    state: labelMatrix(
      'Temporality choices',
      [
        { id: 'delta', label: 'delta' },
        { id: 'cumul', label: 'cumul' },
        { id: 'reset', label: 'reset' },
        { id: 'merge', label: 'merge' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['interval', 'gaps'],
        ['since start', 'resets'],
        ['restart', 'spike'],
        ['same attrs', 'scale'],
      ],
    ),
    highlight: { active: ['delta:means', 'cumul:means'], compare: ['reset:watch', 'merge:watch'] },
    explanation: 'Histograms still obey metric-stream rules. Delta and cumulative temporality change how downstream systems compute rates, detect resets, and merge streams.',
  };
}

function* exportCompatibility() {
  yield {
    state: otelGraph('OTLP carries exponential histograms to a collector or backend', { point: 'ExpHist', export: 'collector' }),
    highlight: { active: ['point', 'export', 'e-point-export'], found: ['view'], compare: ['measure'] },
    explanation: 'The OTLP data model can represent exponential histograms directly. A collector or backend then decides whether to store them natively, translate them, downscale them, or reject them.',
  };

  yield {
    state: labelMatrix(
      'Backend compatibility',
      [
        { id: 'native', label: 'native' },
        { id: 'down', label: 'downscale' },
        { id: 'classic', label: 'classic' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['keep dist', 'needs support'],
        ['fewer buckets', 'less exact'],
        ['le series', 'cardinality'],
        ['none', 'blind'],
      ],
    ),
    highlight: { active: ['native:effect', 'down:effect'], compare: ['classic:risk', 'drop:risk'] },
    explanation: 'Compatibility is the rollout risk. A backend that supports native or exponential histograms can keep the distribution. Translation to classic buckets can reintroduce bucket-series cost.',
  };

  yield {
    state: otelGraph('Scale may change to fit size limits', { view: 'max buckets', scale: 'reduce', pos: 'merged', export: 'ok' }),
    highlight: { active: ['view', 'scale', 'pos', 'point', 'export', 'e-view-scale', 'e-pos-point'], compare: ['index'] },
    explanation: 'Implementations can adjust scale to respect size limits. Lower scale merges neighboring buckets, reducing payload size while increasing quantile error.',
    invariant: 'A scale change is a lossy compaction decision, not just metadata.',
  };

  yield {
    state: labelMatrix(
      'Rollout checklist',
      [
        { id: 'sdk', label: 'SDK' },
        { id: 'view', label: 'view' },
        { id: 'coll', label: 'collector' },
        { id: 'store', label: 'store' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'bad', label: 'if bad' },
      ],
      [
        ['version', 'no type'],
        ['scale cap', 'huge'],
        ['pass', 'drop'],
        ['native', 'convert'],
        ['hist fn', 'wrong'],
      ],
    ),
    highlight: { active: ['sdk:check', 'coll:check', 'store:check'], compare: ['query:bad'] },
    explanation: 'The complete path includes SDK version, aggregation view, collector behavior, backend storage, remote-write compatibility, and query functions. Every hop must preserve the histogram type intentionally.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sdk aggregation') yield* sdkAggregation();
  else if (view === 'export compatibility') yield* exportCompatibility();
  else throw new InputError('Pick an OpenTelemetry histogram view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'OpenTelemetry exponential histograms are a metrics data-point type for recording distributions with exponential bucket boundaries. They are useful for latency, size, and duration measurements that span orders of magnitude because they target relative error rather than fixed absolute bucket width.',
        'The data-structure lesson is aggregation with controlled compaction. The SDK maps measurements to bucket indexes using a scale parameter, stores positive and negative bucket ranges plus zero count, and exports a compact distribution rather than a raw event stream.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An instrument records measurements. A view selects aggregation behavior. With exponential histogram aggregation, values are mapped into base-2 exponential buckets. The scale controls resolution: higher scale means more buckets and better precision, while lower scale merges buckets and reduces payload size.',
        'The exported data point includes count, sum, bucket counts, zero count, scale, and optionally min and max. Delta or cumulative temporality changes whether the point describes one collection interval or accumulated process lifetime.',
      ],
    },
    {
      heading: 'Complete case study: service latency',
      paragraphs: [
        'A service records request latency with an OpenTelemetry histogram instrument. The SDK view configures base-2 exponential histogram aggregation with a bucket limit. The Collector receives OTLP, preserves the exponential histogram, and exports it to a backend that can store it as a Prometheus native histogram or another compatible representation.',
        'If the backend cannot store the type, the pipeline may drop, downscale, or translate it. That is why the rollout has to test dashboards and alerts, not just telemetry ingestion. A metric can arrive successfully while quantile queries silently lose fidelity.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Exponential histograms do not eliminate label cardinality. They change the distribution encoding for each metric stream. Attributes still define streams, and unbounded attributes still create unbounded cost.',
        'Another trap is assuming every backend treats exponential and native histograms the same way. Prometheus native histograms and OpenTelemetry exponential histograms are compatible in important ways, but fields such as explicit min/max, temporality, reset behavior, and query functions still need careful handling.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenTelemetry metrics data model at https://opentelemetry.io/docs/specs/otel/metrics/data-model/ and OpenTelemetry Metrics SDK aggregation specification at https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/sdk.md. Study Prometheus Native Histogram Schema, Metric Label Cardinality Control, OpenTelemetry Collector Case Study, DDSketch Relative-Error Quantiles, and SLO Error Budget Burn Rate Alert next.',
      ],
    },
  ],
};
