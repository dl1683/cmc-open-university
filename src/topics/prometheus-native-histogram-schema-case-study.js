// Prometheus native histograms: sparse bucket spans, exponential schemas,
// zero buckets, merge rules, counter reset hints, and quantile tradeoffs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'prometheus-native-histogram-schema-case-study',
  title: 'Prometheus Native Histogram Schema Case Study',
  category: 'Systems',
  summary: 'How Prometheus native histograms encode sparse bucket spans, exponential schemas, zero buckets, counter reset hints, merges, and quantile queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bucket schema', 'merge query case'], defaultValue: 'bucket schema' },
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

function histGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'obs', label: 'obs', x: 0.8, y: 3.8, note: notes.obs ?? 'latency' },
      { id: 'schema', label: 'schema', x: 2.4, y: 2.0, note: notes.schema ?? 'scale' },
      { id: 'zero', label: 'zero', x: 2.4, y: 5.6, note: notes.zero ?? 'near 0' },
      { id: 'pos', label: '+spans', x: 4.3, y: 2.0, note: notes.pos ?? 'sparse' },
      { id: 'neg', label: '-spans', x: 4.3, y: 5.6, note: notes.neg ?? 'optional' },
      { id: 'sum', label: 'sum', x: 6.2, y: 2.0, note: notes.sum ?? 'total' },
      { id: 'count', label: 'count', x: 6.2, y: 5.6, note: notes.count ?? 'n' },
      { id: 'sample', label: 'sample', x: 7.9, y: 3.8, note: notes.sample ?? 'native hist' },
      { id: 'promql', label: 'PromQL', x: 9.4, y: 3.8, note: notes.promql ?? 'quantile' },
    ],
    edges: [
      { id: 'e-obs-schema', from: 'obs', to: 'schema', weight: 'bucket' },
      { id: 'e-obs-zero', from: 'obs', to: 'zero', weight: 'near' },
      { id: 'e-schema-pos', from: 'schema', to: 'pos', weight: '+' },
      { id: 'e-schema-neg', from: 'schema', to: 'neg', weight: '-' },
      { id: 'e-pos-sample', from: 'pos', to: 'sample', weight: 'counts' },
      { id: 'e-neg-sample', from: 'neg', to: 'sample', weight: 'counts' },
      { id: 'e-zero-sample', from: 'zero', to: 'sample', weight: 'count' },
      { id: 'e-sum-sample', from: 'sum', to: 'sample', weight: '' },
      { id: 'e-count-sample', from: 'count', to: 'sample', weight: '' },
      { id: 'e-sample-promql', from: 'sample', to: 'promql', weight: 'query' },
    ],
  }, { title });
}

function* bucketSchema() {
  yield {
    state: histGraph('A native histogram stores one sample with bucket counts'),
    highlight: { active: ['obs', 'schema', 'zero', 'pos', 'sum', 'count', 'sample'], compare: ['promql'] },
    explanation: 'Classic Prometheus histograms expose many bucket time series. A native histogram stores bucket populations, sum, count, zero bucket, and schema information inside one histogram sample.',
    invariant: 'A histogram sample is not one float; it is a compact distribution snapshot.',
  };

  yield {
    state: labelMatrix(
      'Native histogram fields',
      [
        { id: 'schema', label: 'schema' },
        { id: 'zero', label: 'zero' },
        { id: 'span', label: 'span' },
        { id: 'count', label: 'count' },
        { id: 'hint', label: 'reset' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['bucket scale', 'merge'],
        ['near 0', 'width'],
        ['offset+len', 'sparse'],
        ['pop', 'size'],
        ['counter', 'reset'],
      ],
    ),
    highlight: { active: ['schema:means', 'zero:means', 'span:means'], compare: ['hint:risk'] },
    explanation: 'The important fields are structural: schema controls bucket boundaries, spans make sparse buckets compact, the zero bucket handles values near zero, and reset hints help counter-style interpretation.',
  };

  yield {
    state: histGraph('Sparse spans avoid carrying empty buckets', { pos: 'offset+len', neg: 'empty ok', sample: 'few buckets' }),
    highlight: { active: ['schema', 'pos', 'sample', 'e-schema-pos', 'e-pos-sample'], compare: ['neg'] },
    explanation: 'Native histograms can encode only populated bucket runs. That is a major reason they are practical for wide latency ranges: empty buckets do not all need their own time series.',
  };

  yield {
    state: labelMatrix(
      'Classic versus native',
      [
        { id: 'series', label: 'series' },
        { id: 'bucket', label: 'bucket' },
        { id: 'merge', label: 'merge' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'classic', label: 'classic' },
        { id: 'native', label: 'native' },
      ],
      [
        ['many', 'one'],
        ['fixed le', 'schema'],
        ['sum le', 'align'],
        ['bucket fn', 'hist fn'],
      ],
    ),
    highlight: { found: ['series:native', 'bucket:native'], compare: ['merge:native', 'query:native'] },
    explanation: 'The tradeoff shifts. Classic histograms are simple counters by le label. Native histograms reduce series count but require histogram-aware storage, merging, wire format, and query semantics.',
  };
}

function* mergeQueryCase() {
  yield {
    state: histGraph('Aggregation must reconcile schema and zero bucket choices', { schema: 'schema A/B', zero: 'threshold', sample: 'merge', promql: 'sum by job' }),
    highlight: { active: ['schema', 'zero', 'pos', 'sample', 'promql', 'e-sample-promql'], compare: ['neg'] },
    explanation: 'When histograms are aggregated, bucket schemas and zero thresholds have to be compatible or reconciled. Merging distributions is stricter than adding scalar counters.',
    invariant: 'A query cannot add distributions safely unless their bucket interpretation is known.',
  };

  yield {
    state: labelMatrix(
      'Merge ledger',
      [
        { id: 'same', label: 'same schema' },
        { id: 'diff', label: 'diff schema' },
        { id: 'zero', label: 'zero diff' },
        { id: 'reset', label: 'reset hint' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['add', 'cheap'],
        ['convert', 'error'],
        ['widen', 'less exact'],
        ['check', 'unknown'],
      ],
    ),
    highlight: { active: ['same:action', 'zero:action'], compare: ['diff:cost', 'reset:cost'] },
    explanation: 'The easy case adds matching buckets. Harder cases need schema conversion, zero-bucket adjustment, or reset handling. Those choices change accuracy and may produce warnings or unknown reset state.',
  };

  yield {
    state: histGraph('histogram_quantile estimates from bucket populations', { promql: 'p95', sample: 'bucket CDF', count: 'n=all' }),
    highlight: { active: ['sample', 'promql', 'pos', 'zero', 'count', 'e-sample-promql'], found: ['sum'] },
    explanation: 'Quantile functions turn bucket populations into an estimated cumulative distribution. Native histograms can preserve more resolution across a wide range than coarse classic buckets, but the result is still bucket-based.',
  };

  yield {
    state: labelMatrix(
      'Production checklist',
      [
        { id: 'ingest', label: 'ingest' },
        { id: 'remote', label: 'remote' },
        { id: 'rules', label: 'rules' },
        { id: 'dash', label: 'dash' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'bad', label: 'if bad' },
      ],
      [
        ['enabled', 'drop'],
        ['supports', 'loss'],
        ['hist fn', 'wrong'],
        ['native ok', 'blank'],
        ['buckets', 'bill'],
      ],
    ),
    highlight: { active: ['ingest:check', 'remote:check', 'rules:check'], compare: ['cost:bad'] },
    explanation: 'The complete rollout verifies every hop: target instrumentation, Prometheus ingest, remote write, long-term storage, recording rules, dashboards, alerts, and billing or sample accounting.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bucket schema') yield* bucketSchema();
  else if (view === 'merge query case') yield* mergeQueryCase();
  else throw new InputError('Pick a native histogram view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the bucket-schema view as one observation becoming a distribution sample. Active nodes show fields being populated, compare nodes show compatibility risks, and found nodes show values that query functions can use. A histogram stores counts across ranges; a native histogram stores those counts inside one richer Prometheus sample instead of many bucket time series.',
        'The merge-query view is about meaning preservation. A query may add histograms only when it understands their bucket schema, zero bucket, count, sum, and reset behavior. The safe inference is that bucket counts are useful only with the schema that defines their boundaries.',
        {type:'callout', text:'Native histograms trade bucket-series explosion for richer distribution samples that every storage and query hop must understand.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/53/Cumulative_vs_normal_histogram.svg', alt:'Side-by-side ordinary and cumulative histograms for a normal sample.', caption:'Ordinary and cumulative histograms by Kierano, via Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Service latency is a distribution, not one average. A checkout API can have a fine mean while the slowest percent of requests breaks the user experience. Operators need tail estimates such as p95 and p99 without storing every request.',
      'Classic Prometheus histograms create one time series per bucket for each label set. More resolution means more series, more remote-write traffic, more storage, and more query work. Native histograms exist to keep distribution structure in one sample while preserving useful quantile queries.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a classic histogram with fixed le buckets. Pick boundaries, export cumulative counters, and use histogram_quantile over rates. It is simple and works well when the important thresholds are known.',
      'When estimates are too coarse, teams add buckets. That helps near the added boundaries but multiplies cost across every route, method, status class, job, and instance label combination. The design turns precision into cardinality.',
    ] },
    { heading: 'The wall', paragraphs: [
      'Classic buckets force an early guess about future data shape. If latency shifts from milliseconds to seconds, precision may sit in the wrong range. If one endpoint needs tight buckets near 100 ms and another needs second-scale buckets, one shared layout wastes something.',
      'Native histograms hit a different wall. Instrumentation, scraping, Prometheus storage, remote write, long-term storage, recording rules, dashboards, and alerts must preserve the histogram sample type. A single unsupported hop can drop or flatten the benefit.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Make the histogram a first-class sample. The sample carries count, sum, schema, zero-bucket information, and sparse positive or negative bucket spans. Empty bucket runs do not need their own time series.',
      'The invariant is distribution meaning. A bucket count without its schema is not interpretable. Aggregation must either add compatible buckets or convert them with known accuracy costs.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A schema maps bucket indexes to numeric boundaries, often with exponential spacing. Spans encode consecutive populated buckets, so wide value ranges can remain compact when most buckets are empty. The zero bucket handles values near zero where the exponential layout needs special treatment.',
      'PromQL functions can operate on histogram samples. histogram_count and histogram_sum extract aggregate fields, while histogram_quantile estimates percentiles from bucket populations. Aggregation must check schema compatibility and reset behavior before treating samples as one distribution.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The representation works because many observability distributions are sparse over a wide range. A latency metric may need microseconds through seconds, but one scrape interval usually occupies a small region. Sparse spans store populated runs instead of a dense wall of empty buckets.',
      'Quantile estimation works because it needs cumulative bucket populations, not individual events. Native histograms keep those populations with count and sum in one typed sample. The query engine can reason about the whole distribution instead of joining many scalar bucket series by label.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Native histograms reduce bucket-series multiplication, but they do not make labels cheap. A metric with 300 label sets and 20 classic buckets creates about 6,600 series when count and sum are included. Native histograms can keep that closer to 300 series, but each sample is larger than a float.',
      'Accuracy is still bucket-based. Schema choice, downscaling, zero-bucket width, merge conversion, and reset handling affect results. A p99 from native histograms is a structured estimate, not a stored raw percentile.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Native histograms fit latency, request size, payload size, queue wait, RPC duration, and other metrics that span orders of magnitude. They are strongest when teams want distribution detail without hand-building many explicit buckets.',
      'They also fit migrations where classic histogram bucket count is the pain and label cardinality is already controlled. A safe rollout keeps old and new metrics side by side until important alerts and dashboards agree under real traffic.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Native histograms do not fix unbounded labels. If a metric labels user_id, request_id, or raw URL, the cardinality problem remains. The sample type changes bucket cost, not label explosion.',
      'They are also a poor fit when exact custom thresholds are the operational contract. A classic histogram with buckets around a service-level objective can be easier to audit. Partial pipeline support can also produce blank dashboards or misleading alert migrations.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'An API exposes latency by route, method, and status class with 300 label sets. A classic histogram with 20 buckets creates 6,000 bucket series plus 600 count and sum series. Adding 20 more buckets for tail precision adds another 6,000 bucket series.',
      'With native histograms, the same 300 label sets can each emit one histogram sample per scrape. If most requests fall between 20 ms and 2 s, sparse spans carry the populated buckets in that range. The team still tests p95 and p99 against the old metric before switching alerts because the quantile estimate can shift.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Prometheus native histogram specification at https://prometheus.io/docs/specs/native_histograms/, Prometheus histogram practices at https://prometheus.io/docs/practices/histograms/, and Prometheus querying basics at https://prometheus.io/docs/prometheus/latest/querying/basics/. Check current Prometheus docs before a migration because native histogram support has changed across releases.',
      'Study Prometheus TSDB storage, metric label cardinality, OpenTelemetry exponential histograms, DDSketch relative-error quantiles, remote write behavior, and SLO burn-rate alerting before using native histograms for production pages.',
    ] },
  ],
};
