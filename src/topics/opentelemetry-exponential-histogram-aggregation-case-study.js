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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows how raw measurements become a compact distribution. A histogram counts how many measurements fall into value ranges called buckets. An exponential histogram uses bucket ranges that grow by a constant ratio instead of a constant width.',
        'Active nodes show the measurement or bucket being processed. Found nodes show counts added to the exported data point. Compare nodes show scale and bucket-boundary decisions. Removed nodes show detail lost when buckets are downscaled or merged.',
        'The safe inference rule is that the bucket counts are meaningful only with the scale, offsets, zero count, count, sum, and temporality. Counts without bucket interpretation are not a distribution.',
        {type:'callout', text:'Exponential histograms make distribution cost explicit by trading scale for precision before raw measurements leave the SDK.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/2a/Wikipedia_bincounts.svg', alt:'Three histograms of the same data using different bin counts.', caption:'Sample histogram with different bin sizes; image by Zckub, CC0 public domain dedication, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Telemetry systems need distributions because averages hide behavior. A service can have a healthy mean latency while the p99 is broken. Request size, queue time, retry delay, and RPC duration can span orders of magnitude.',
        'OpenTelemetry exponential histograms exist so SDKs can aggregate high-dynamic-range measurements before export. The application records many events, but the metrics pipeline sends a compact summary. That keeps cost bounded while preserving shape.',
        'The design is especially useful when teams do not know stable bucket boundaries in advance. A latency metric may need to represent 2 ms cache hits and 20 second timeouts in the same stream.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to export every measurement and compute quantiles later. That preserves detail, but it turns a metrics pipeline into an event pipeline. Ordinary service telemetry becomes too expensive to store and query.',
        'Another approach is a fixed explicit bucket list. That works when domain thresholds are known, such as 100 ms, 300 ms, and 1 second SLO boundaries. It fails when values range widely or when the chosen buckets age badly.',
        'The worst approach is an average. A mean collapses the distribution before the data leaves the process. No backend can reconstruct tail latency or burst shape from one scalar.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is dynamic range. A fixed 10 ms bucket width gives good detail near 100 ms but creates thousands of buckets near 20 seconds. A fixed 1 second width is cheap but useless near a 50 ms service.',
        'There is also an aggregation wall. Metrics from many processes must merge. If each process exports raw samples, volume explodes. If each process exports incompatible bucket layouts, the backend must translate or lose accuracy.',
        'Temporality is another wall. Delta points describe one collection interval. Cumulative points describe the stream since start. Treating cumulative points as independent deltas can invent spikes or erase real observations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use buckets whose boundaries grow exponentially. Bucket width grows with the value, so the representation has more stable relative precision across small and large measurements. Being off by 1 ms near 2 ms matters; being off by 1 ms near 20 seconds does not.',
        'The control knob is scale. Higher scale means adjacent buckets are closer together, so precision improves and more buckets may be needed. Lower scale merges ranges, reducing memory and wire size while losing detail.',
        'Scale is therefore a cost decision. It decides how much precision the SDK keeps before measurements leave the process. Later systems can downscale, but they cannot recover detail that was already merged away.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An instrument records a measurement such as request duration. The SDK view chooses exponential histogram aggregation for that metric stream. The stream is defined by metric name, resource, scope, and attributes.',
        'A positive value maps to a positive bucket index using the exponential scale. Negative values map to a separate negative range. Values near zero use a zero bucket because a pure logarithmic mapping is not meaningful at zero.',
        'The exported data point carries count, sum, zero count, positive bucket ranges, negative bucket ranges, scale, and possibly min and max. A backend merges compatible streams by adding counts into corresponding buckets after handling scale and temporality.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation of counts under a known mapping. Each raw measurement increments exactly one bucket or the zero count. The total count and sum preserve how many measurements were seen and their total value.',
        'Aggregation is safe when streams represent the same metric identity and bucket interpretation. If two points use different scales, a backend can downscale the higher-resolution point to a lower scale before adding counts. That loses precision but preserves count mass.',
        'The representation works for operational data because relative error is often the right error model. A bucket that spans 1,000 to 1,010 ms and a bucket that spans 10 to 10.1 ms both keep roughly similar relative meaning.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Memory cost is roughly proportional to the number of active metric streams times the number of populated buckets per stream. Attributes are therefore the global multiplier. A high-cardinality label creates many independent histograms.',
        'Scale is the local multiplier. If scale increases and a stream fills 80 buckets instead of 20, memory and payload size can quadruple for that stream. Downscaling from 80 to 20 buckets reduces size but widens bucket ranges.',
        'Backend cost depends on native support. If the Collector, exporter, storage engine, or query layer converts exponential histograms into coarse explicit buckets, the type may survive syntactically while its precision is lost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Exponential histograms fit latency, duration, payload size, queue time, retry delay, and other positive distributions with wide ranges. They help instrumentation authors avoid hand-designing bucket boundaries for every metric.',
        'They are useful when a backend understands the type natively or translates it deliberately into a compatible representation such as a native histogram. Native preservation keeps distribution data compact until query time.',
        'They also help during SLO work. A team can inspect p95 and p99 behavior without exporting every request duration, as long as the query engine understands the histogram representation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the pipeline does not preserve semantics. The SDK may emit exponential histograms, but an exporter, remote endpoint, storage engine, or query layer may drop, downscale, translate, or misinterpret them.',
        'It fails when domain thresholds are more important than relative precision. If an alert must fire at exactly 300 ms and 1 second, explicit buckets around those thresholds may be easier to reason about.',
        'It fails when teams ignore cardinality. Exponential histograms reduce sample volume, not label explosion. A user id label can still create one histogram per user and overwhelm the metrics backend.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service records 100,000 request durations in one minute. Exporting each duration as an event at 16 bytes would send about 1.6 MB before metadata. A histogram point can summarize the same stream in a few dozen buckets.',
        'Suppose scale 4 produces 60 populated buckets for the route /checkout. If each bucket count is 8 bytes, bucket counts use about 480 bytes plus metadata for that route and attribute set. Ten routes with four status classes create 40 streams, so the same scale costs about 19 KB of counts per minute before encoding overhead.',
        'If traffic expands from durations near 50 ms to timeouts near 20 seconds, the exponential layout adds buckets across the range instead of requiring a hand-built boundary list. If the backend downscales from 60 buckets to 30, query payload falls, but p99 precision becomes coarser.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the OpenTelemetry Metrics data model, the Metrics SDK aggregation specification, and Prometheus native histogram documentation for related storage and query behavior. Use them to check scale, temporality, and exporter compatibility.',
        'Study Metric Label Cardinality Control for stream economics, OpenTelemetry Collector for pipeline behavior, DDSketch for relative-error quantiles, Prometheus Native Histograms for backend representation, and SLO Error Budget Burn Rate for alerting from distributions.',
      ],
    },
  ],
};
