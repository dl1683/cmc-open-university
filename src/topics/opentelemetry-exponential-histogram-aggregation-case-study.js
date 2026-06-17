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
      heading: 'Why this exists',
      paragraphs: [
        'Telemetry systems need distributions, not only averages. A service can have a healthy mean latency while the p99 is broken. Request size, queue time, retry delay, and RPC duration can also span orders of magnitude, so a small number of fixed-width buckets often puts resolution in the wrong place.',
        'OpenTelemetry exponential histograms exist to let SDKs aggregate high-dynamic-range measurements into a compact distribution. The representation gives roughly stable relative precision across small and large values while keeping aggregation inside the metrics pipeline instead of exporting every raw event.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'One wrong answer is to export every measurement and calculate quantiles later. That turns a metrics pipeline into an event pipeline and quickly becomes too expensive for ordinary service telemetry. Another wrong answer is to use a small fixed bucket set forever. Fixed bucket boundaries age badly as latency ranges and service behavior change.',
        'Averages are worse. They discard distribution shape before the data leaves the process. A downstream backend cannot recover tail behavior, merge distributions correctly, or explain an SLO burn from a scalar mean.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Use buckets whose boundaries grow exponentially. When bucket width grows with the value, the same scale can represent 2 ms and 20 s observations with more consistent relative error than a linear bucket layout. The SDK no longer needs a custom explicit bucket list for every metric.',
        'The control knob is scale. Higher scale means a smaller growth factor between adjacent buckets, more buckets, larger payloads, and better precision. Lower scale merges ranges, reducing payload size while losing detail. Scale is therefore an accuracy and cost decision, not just a display setting.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'An instrument records measurements. A view in the SDK chooses the aggregation. With exponential histogram aggregation, a positive value is mapped to a bucket index based on a base-2 exponential scale. The exported data point carries count, sum, positive bucket ranges, negative bucket ranges, a zero count, scale, and optionally min and max.',
        'Positive and negative ranges are separate because a distribution can include negative measurements such as temperature deltas or signed errors. A zero bucket handles values near zero, where pure logarithmic mapping is not meaningful. Temporality then decides whether the point describes only the current collection interval or the cumulative stream since process start.',
      ],
    },
    {
      heading: 'Invariants',
      paragraphs: [
        'A histogram data point is meaningful only together with its scale, bucket offsets, bucket counts, zero-count rule, count, sum, and temporality. Bucket count without bucket interpretation is not a distribution. Scale conversion is allowed, but it is lossy when it lowers resolution.',
        'Merging is safe only when stream identity and bucket interpretation are handled deliberately. Attribute sets define metric streams. Delta and cumulative temporality have different reset behavior. A backend that receives cumulative points but treats them like independent deltas can invent spikes or erase real observations.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because many operational measurements care about ratios. Being off by 1 ms near 2 ms is a large error; being off by 1 ms near 20 s is irrelevant. Exponential buckets align representation error with that operational intuition.',
        'It also works because aggregation happens before export. The application process records many measurements, but the backend receives distribution summaries for each metric stream. That keeps the metrics path bounded while preserving enough shape for quantile-style analysis.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Scale is the main local cost knob. Higher scale improves precision but can increase bucket count, memory, and wire size. Implementations may downscale to fit bucket limits, which merges neighboring buckets and changes later quantile estimates. That is often the right trade, but it should be understood as compaction.',
        'Attributes are the global cost knob. Exponential histograms do not make labels free. A high-cardinality attribute still creates many metric streams, and each stream carries its own distribution state.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common failure is assuming compatibility. The SDK may emit exponential histograms, the Collector may pass them through, but the exporter, remote endpoint, storage engine, or query layer may drop, downscale, translate, or misinterpret them. Successful ingestion is not proof that distribution semantics survived.',
        'Other failures include mismatched temporality, reset handling errors, missing min or max when a backend expects them, silent conversion to coarse explicit buckets, and dashboards that call scalar functions on histogram streams. Every hop needs an intentional behavior.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Exponential histograms are useful for latency, duration, payload size, queue depth, retry delay, and other positive distributions whose range is wide and whose bucket boundaries are hard to choose in advance. They let instrumentation authors use a principled aggregation rather than hand-designing every boundary list.',
        'They are strongest when the downstream path understands the type natively or translates it deliberately into a compatible representation such as a Prometheus native histogram. Native preservation keeps the distribution compact and avoids reintroducing explicit bucket cardinality too early.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'They are not a replacement for tracing when individual outliers must be inspected. They are not a cure for unbounded labels. They are also not automatically better than explicit buckets when a domain has stable, meaningful thresholds such as SLO boundaries or protocol size classes.',
        'They can be a poor rollout choice if the organization has a backend or alerting stack that cannot preserve or query them correctly. In that case, explicit histograms with known semantics may be safer until the pipeline is upgraded.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the sdk-aggregation view, follow the path from measurement to view, scale, bucket index, positive or negative ranges, zero bucket, and OTLP point. The important transition is that raw measurements disappear into an aggregate data point before export.',
        'In the export-compatibility view, watch the same data point move through the Collector and backend boundary. The downscale frame is the key warning: reducing scale keeps the type alive but changes precision. The rollout checklist is not paperwork; it is the list of places where histogram semantics can be lost.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A service records HTTP request latency with an OpenTelemetry histogram instrument. The SDK view selects exponential histogram aggregation with a bucket limit. The Collector receives OTLP data points and exports them to a backend that can store exponential or native histograms. The team then queries p95 and p99 by route and status class.',
        'The validation plan checks SDK version, view configuration, scale behavior, Collector pass-through, exporter support, backend storage, query functions, dashboards, recording rules, alerts, and remote storage. The goal is not just to see data arrive. The goal is to prove that the distribution can still be queried with the intended accuracy.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Start with one high-value metric before changing the whole metrics estate. Record the SDK aggregation choice, scale limits, temporality, exporter path, backend storage type, and the exact query functions used by dashboards and alerts. Then compare old and new p95 or p99 behavior during the same traffic window.',
        'Watch payload size, stream cardinality, bucket downscaling, dropped points, and query compatibility. Exponential histograms are a better distribution representation only if the full path preserves them and operators can still ask the questions they need during incidents.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: OpenTelemetry metrics data model at https://opentelemetry.io/docs/specs/otel/metrics/data-model/ and OpenTelemetry Metrics SDK aggregation specification at https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/sdk.md.',
        'Study Prometheus Native Histogram Schema for the Prometheus-side representation, Metric Label Cardinality Control for stream economics, OpenTelemetry Collector Case Study for pipeline behavior, DDSketch Relative-Error Quantiles for another relative-error sketch, and SLO Error Budget Burn Rate Alert for how distributions affect alerting.',
      ],
    },
  ],
};
