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
      heading: 'Why this exists',
      paragraphs: [
        'Services are judged by distributions, not averages. A checkout API can have a fine mean latency while the slowest 1 percent of requests break the user experience. Observability systems need p90, p95, p99, and tail shape without storing every request.',
        'Classic Prometheus histograms answer this with fixed buckets, but each bucket is a separate time series for every label set. More resolution means more series. Native histograms exist to keep the distribution as one richer histogram sample with bucket populations, count, sum, schema, zero-bucket information, and counter-reset context.',
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        'The standard approach is a classic histogram: choose bucket boundaries, export cumulative counters with an le label, then use histogram_quantile over rates. It is simple, widely supported, and good enough when the important thresholds are known in advance.',
        'Teams naturally add buckets when the first set is too coarse. That improves estimates near the new boundaries, but it multiplies ingest volume, storage, remote-write traffic, rule work, and dashboard query cost across every label combination.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Classic buckets force an early guess about the future. If the service gets faster, slower, or more variable, the old buckets may put precision in the wrong place. If one route needs millisecond buckets and another needs second-scale buckets, a shared bucket layout wastes either accuracy or cost.',
        'Native histograms hit a different wall: the whole pipeline must understand the richer sample type. Instrumentation, scraping, Prometheus ingestion, remote write, long-term storage, recording rules, alert queries, and dashboards all need to preserve histogram meaning.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A native histogram is a first-class distribution sample, not a bundle of scalar bucket counters. One time series can carry a count, sum, zero bucket, positive and negative bucket spans, and the schema that explains bucket boundaries.',
        'The tradeoff moves from series explosion to sample complexity. Labels still create series, and populated buckets still cost bytes, but empty bucket runs do not need their own time series and query functions can operate on histogram samples directly.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the bucket-schema view, follow one observation as it becomes structure: schema chooses the bucket scale, sparse spans hold populated positive or negative runs, the zero bucket handles values near zero, and count plus sum preserve aggregate facts. The state changes matter because a native histogram is more than one float.',
        'In the merge-query view, focus on compatibility. Matching schemas add cleanly. Different schemas, zero thresholds, reset hints, or downstream support force conversion, warnings, or loss. That is the production lesson: histogram samples are useful only when every hop keeps their interpretation intact.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A schema defines how bucket indexes map to boundaries. Standard schemas are exponential, so buckets scale with magnitude. Positive and negative spans describe consecutive bucket runs, which lets the encoding skip empty areas. A zero bucket covers observations close to zero, where exponential indexing needs a special case.',
        'PromQL sees native histogram samples as histogram values. Functions such as histogram_count, histogram_sum, histogram_avg, histogram_fraction, and histogram_quantile can operate on them. Aggregation has to preserve bucket meaning: identical schemas are easy, compatible schemas may be converted, and incompatible or reset-ambiguous cases can produce warnings or weaker results.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The representation works because many real distributions are sparse across a wide numeric range. A latency metric may need to represent microseconds through seconds, but any one scrape interval usually occupies only part of that range. Sparse spans store the occupied runs instead of a dense wall of empty buckets.',
        'The query model works because quantile estimation needs bucket populations, not individual events. Native histograms keep those populations inside the sample, so the query engine can reason about count, sum, buckets, and histogram flavor together instead of reconstructing a distribution from many independent float series.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An API team wants p95 latency by route, method, and status class. With a classic histogram, 20 buckets create 20 bucket series plus count and sum for every label set. If there are 300 label sets, that is 6,600 series before adding more buckets.',
        'A native histogram keeps one histogram sample per label set, with the populated buckets inside the sample. The team still has 300 label-defined series, but it no longer pays one time series per bucket boundary. The migration is not finished until scrape config, remote write, storage, rules, dashboards, and alerts all read the native type correctly.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Native histograms reduce bucket-series multiplication, but they do not make labels cheap. A route label with bounded values can be fine. A user_id, request_id, or raw URL label is still a cardinality incident.',
        'Quantiles are still estimates from buckets. Schema choice, downscaling, sparse bucket population, merge behavior, and zero-bucket settings affect accuracy. The sample type gives the query engine more structure; it does not recreate the original observations.',
        'A safe rollout keeps old and new metrics side by side for the alerts that matter. Compare p95 and p99 over real incidents, check remote-write behavior, and document which dashboards now consume histogram samples directly instead of classic bucket series.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Native histograms fit latency, request size, payload size, queue wait, RPC duration, and other metrics whose values span orders of magnitude and whose tail behavior matters. They are strongest when the team wants useful quantiles without hand-picking a large explicit bucket layout for every metric.',
        'They also fit migrations from coarse classic histograms where the main pain is bucket count, not label count. A side-by-side rollout can compare old and new queries before dashboards and alerts switch over.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Native histograms are the wrong fix for unbounded labels. If a metric has user_id, session_id, or full path labels, moving from classic to native changes the bucket cost but leaves the core cardinality problem intact.',
        'They are also a poor fit when precise custom bucket thresholds are the product requirement. A classic histogram with carefully chosen buckets around an SLO boundary may be easier to audit than a standard exponential schema, especially during a conservative alerting migration.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common operational failures are partial support, silent conversion, remote-write drops, recording rules that expect float samples, dashboards still querying _bucket series, alerts comparing old and new quantiles without a dual-write window, and billing models that surprise teams by charging for populated buckets inside samples.',
        'The common analytical failures are treating histogram_quantile as exact, ignoring merge warnings, mixing counter and gauge histograms, changing schemas midstream without understanding the effect, and comparing quantiles across jobs that used different instrumentation choices.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Prometheus native histogram specification at https://prometheus.io/docs/specs/native_histograms/, Prometheus histograms and summaries at https://prometheus.io/docs/practices/histograms/, and Prometheus querying basics at https://prometheus.io/docs/prometheus/latest/querying/basics/. Check current Prometheus configuration docs before a real migration because feature flags and defaults have changed across releases.',
        'Study Prometheus TSDB Case Study for storage layout, Metric Label Cardinality Control for the real cost boundary, OpenTelemetry Exponential Histogram Aggregation for the related telemetry model, DDSketch Relative-Error Quantiles for sketch-based alternatives, and SLO Error Budget Burn Rate Alert for alerting on distribution-derived signals.',
      ],
    },
  ],
};
