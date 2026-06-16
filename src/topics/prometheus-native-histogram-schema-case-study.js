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
      heading: 'What it is',
      paragraphs: [
        'Prometheus native histograms add a richer histogram sample type. Instead of exposing every classic bucket as a separate time series with an le label, a native histogram sample carries bucket populations, schema information, zero-bucket configuration, count, sum, and reset hints together.',
        'The data-structure change is important. A native histogram is a compact sparse distribution object, not a bundle of scalar bucket counters. That lowers some cardinality pressure but requires histogram-aware ingestion, storage, remote write, rules, and queries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Native histograms use bucket schemas to define bucket boundaries. They can store positive and negative bucket spans, which lets the encoding skip long runs of empty buckets. A zero bucket captures values near zero, where exponential bucket logic needs special handling. Count and sum keep the ordinary aggregate facts available.',
        'Queries and aggregations must preserve the meaning of the buckets. Matching schemas are straightforward to add. Different schemas or zero thresholds require reconciliation, conversion, or warnings. Counter-style histograms also need reset handling so rate calculations do not silently invent or erase observations.',
      ],
    },
    {
      heading: 'Complete case study: p95 latency rollout',
      paragraphs: [
        'An API team wants p95 latency by route, method, and status class. Classic histograms create one series per bucket per label set, so bucket count multiplies series cardinality. Native histograms keep the distribution in one sample per label set. The team enables instrumentation, Prometheus ingestion, remote-write support, recording rules, and dashboard functions that understand native histograms.',
        'The payoff is more flexible resolution with fewer explicit bucket series. The risk is compatibility. If a remote backend drops native histograms, if rules use scalar-only functions, or if dashboards assume le buckets, the rollout can look successful at scrape time but fail at query time.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Native histograms do not make cardinality free. Labels still define series. A user_id label on a native histogram is still dangerous. Native histograms reduce bucket-series multiplication; they do not remove label economics.',
        'Another trap is treating quantiles as exact. A histogram quantile is an estimate derived from bucket populations. Better bucket schemas can improve accuracy, but query output is still constrained by how observations were bucketed and merged.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus native histogram specification at https://prometheus.io/docs/specs/native_histograms/ and Prometheus querying basics for native histograms at https://prometheus.io/docs/prometheus/latest/querying/basics/#notes-about-the-experimental-native-histograms. Study Prometheus TSDB Case Study, Metric Label Cardinality Control, Metric Exemplars Trace Correlation, OpenTelemetry Exponential Histogram Aggregation, DDSketch Relative-Error Quantiles, and SLO Error Budget Burn Rate Alert next.',
      ],
    },
  ],
};
