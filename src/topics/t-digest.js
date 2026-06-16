// t-digest: an online quantile sketch that compresses sorted samples into
// weighted centroids with extra resolution near distribution tails.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 't-digest',
  title: 't-digest Quantile Sketch',
  category: 'Data Structures',
  summary: 'Approximate p50, p95, and p99 from streams by compressing sorted samples into mergeable centroids.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['centroid compression', 'merge quantiles'], defaultValue: 'centroid compression' },
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

function centroidTable(title) {
  return labelMatrix(
    title,
    [
      { id: 'c1', label: 'centroid 1' },
      { id: 'c2', label: 'centroid 2' },
      { id: 'c3', label: 'centroid 3' },
      { id: 'c4', label: 'centroid 4' },
      { id: 'c5', label: 'centroid 5' },
      { id: 'c6', label: 'centroid 6' },
    ],
    [
      { id: 'mean', label: 'mean latency' },
      { id: 'weight', label: 'weight' },
      { id: 'rank', label: 'rank region' },
      { id: 'reason', label: 'why size differs' },
    ],
    [
      ['22 ms', '1', '0.00-0.05', 'left tail kept sharp'],
      ['31 ms', '4', '0.05-0.25', 'small cluster'],
      ['45 ms', '18', '0.25-0.65', 'middle compressed'],
      ['70 ms', '12', '0.65-0.90', 'middle compressed'],
      ['140 ms', '3', '0.90-0.98', 'tail detail'],
      ['460 ms', '1', '0.98-1.00', 'p99 outlier preserved'],
    ],
  );
}

function distributionPlot(title) {
  return plotState({
    axes: {
      x: { label: 'latency ms', min: 0, max: 520 },
      y: { label: 'relative rank', min: 0, max: 1 },
    },
    series: [
      {
        id: 'cdf',
        label: 'compressed CDF',
        points: [
          { x: 22, y: 0.03 },
          { x: 31, y: 0.16 },
          { x: 45, y: 0.48 },
          { x: 70, y: 0.78 },
          { x: 140, y: 0.95 },
          { x: 460, y: 0.995 },
        ],
      },
    ],
    markers: [
      { id: 'p50', x: 46, y: 0.50, label: 'p50' },
      { id: 'p95', x: 140, y: 0.95, label: 'p95' },
      { id: 'p99', x: 360, y: 0.99, label: 'p99' },
    ],
  }, { title });
}

function* centroidCompression() {
  yield {
    state: labelMatrix(
      'Raw latency stream arrives in arbitrary order',
      [
        { id: 'b1', label: 'batch 1' },
        { id: 'b2', label: 'batch 2' },
        { id: 'b3', label: 'batch 3' },
        { id: 'b4', label: 'batch 4' },
      ],
      [
        { id: 'samples', label: 'samples' },
        { id: 'problem', label: 'problem' },
      ],
      [
        ['31, 45, 22, 70', 'stream order'],
        ['42, 44, 47, 49', 'middle is dense'],
        ['61, 73, 140', 'right tail begins'],
        ['460, 39, 41', 'rare outlier matters'],
      ],
    ),
    highlight: { active: ['b1:samples', 'b2:samples', 'b3:samples', 'b4:samples'], compare: ['b4:samples'] },
    explanation: 'Quantile monitoring cannot keep every latency forever. A t-digest keeps a compact summary that can answer rank questions like p50, p95, and p99 while the stream continues to arrive.',
  };

  yield {
    state: centroidTable('Compress sorted samples into weighted centroids'),
    highlight: { active: ['c3:mean', 'c3:weight', 'c4:mean', 'c4:weight'], found: ['c1:weight', 'c6:weight'] },
    explanation: 'The digest stores centroids: each centroid has a mean and a weight. Middle ranks can tolerate larger clusters because a small rank error near p50 is usually acceptable. The tails get small clusters because p99 accuracy is where operators notice pain.',
    invariant: 'Centroids are ordered by mean; weights approximate how many samples each centroid represents.',
  };

  yield {
    state: distributionPlot('Tail-aware compression gives more resolution near p99'),
    highlight: { active: ['p95', 'p99'], compare: ['p50'], found: ['cdf'] },
    explanation: 'The sketch is designed for relative accuracy near the tails. That is why t-digest is popular for latency SLOs: the question is rarely "what is the exact average?" It is "how bad is the slow tail?"',
  };

  yield {
    state: labelMatrix(
      'How t-digest compares to sibling sketches',
      [
        { id: 'hll', label: 'HyperLogLog' },
        { id: 'cms', label: 'Count-Min' },
        { id: 'td', label: 't-digest' },
        { id: 'reservoir', label: 'reservoir' },
      ],
      [
        { id: 'question', label: 'answers' },
        { id: 'state', label: 'state kept' },
        { id: 'merge', label: 'mergeable?' },
      ],
      [
        ['count distinct', 'registers', 'yes'],
        ['frequency estimate', 'counter rows', 'yes'],
        ['quantiles', 'weighted centroids', 'yes'],
        ['sample inspection', 'raw samples', 'partly'],
      ],
    ),
    highlight: { found: ['td:question', 'td:state', 'td:merge'], compare: ['hll:question', 'cms:question'] },
    explanation: 'Sketches are not interchangeable. HyperLogLog answers cardinality, Count-Min Sketch answers approximate frequencies, and t-digest answers rank statistics. A serious observability system often uses several sketches side by side.',
  };
}

function* mergeQuantiles() {
  yield {
    state: labelMatrix(
      'Each shard builds a local digest',
      [
        { id: 'api', label: 'api shard' },
        { id: 'search', label: 'search shard' },
        { id: 'ads', label: 'ads shard' },
        { id: 'billing', label: 'billing shard' },
      ],
      [
        { id: 'centroids', label: 'centroids' },
        { id: 'tail', label: 'tail sample' },
        { id: 'traffic', label: 'traffic' },
      ],
      [
        ['12', '190 ms', '8k req/s'],
        ['18', '420 ms', '3k req/s'],
        ['10', '260 ms', '5k req/s'],
        ['7', '900 ms', '300 req/s'],
      ],
    ),
    highlight: { active: ['api:centroids', 'search:centroids', 'ads:centroids', 'billing:centroids'], compare: ['billing:tail'] },
    explanation: 'A distributed service cannot ship every raw request latency to one coordinator. Each shard summarizes locally. The coordinator merges the centroids, compresses again, and estimates global quantiles.',
  };

  yield {
    state: labelMatrix(
      'Merging digests preserves weighted rank information',
      [
        { id: 'append', label: 'append centroids' },
        { id: 'sort', label: 'sort by mean' },
        { id: 'compress', label: 'compress' },
        { id: 'query', label: 'query rank' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'operation', label: 'operation' },
        { id: 'output', label: 'output' },
      ],
      [
        ['local digests', 'concatenate', 'many centroids'],
        ['means', 'order', 'rank walk'],
        ['scale rule', 'merge small clusters', 'global digest'],
        ['q=0.99', 'interpolate', 'estimated p99'],
      ],
    ),
    highlight: { active: ['append:operation', 'sort:operation', 'compress:operation'], found: ['query:output'] },
    explanation: 'The merge path is why t-digest fits distributed telemetry. Local summaries are first-class data. You can roll them up per host, rack, region, and service without replaying raw events.',
  };

  yield {
    state: distributionPlot('Read p95 and p99 from the merged summary'),
    highlight: { found: ['p95', 'p99'], active: ['cdf'] },
    explanation: 'After merging, quantile queries walk cumulative centroid weights until the desired rank is reached. The answer is an interpolation through the compressed CDF, not a raw observation.',
  };

  yield {
    state: labelMatrix(
      'Operational lessons',
      [
        { id: 'compression', label: 'compression' },
        { id: 'ordering', label: 'ordering' },
        { id: 'tail', label: 'tail accuracy' },
        { id: 'alerts', label: 'alerting' },
      ],
      [
        { id: 'good', label: 'good when' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['memory is bounded', 'too much compression hides spikes'],
        ['batches can be sorted', 'bad implementation can bias ranks'],
        ['SLO uses p95/p99', 'tiny rare classes need separate views'],
        ['rolling windows are needed', 'global p99 can mask per-shard p99'],
      ],
    ),
    highlight: { active: ['tail:good', 'alerts:danger'], compare: ['compression:danger'] },
    explanation: 'The sketch is only part of the monitoring design. Tail latency must still be broken down by route, customer tier, shard, and release. Otherwise a globally good p99 can hide a small group having a terrible day.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'centroid compression') yield* centroidCompression();
  else if (view === 'merge quantiles') yield* mergeQuantiles();
  else throw new InputError('Pick a t-digest view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A t-digest is a compact, mergeable quantile sketch. It summarizes a stream with ordered weighted centroids, then answers questions like p50, p95, p99, or "what value sits at rank q?" without storing every raw sample.',
        'The data-structure lesson is that not all approximation is the same. t-digest spends more resolution near distribution tails, where latency and risk decisions usually live. That makes it a natural sibling to HyperLogLog and Count-Min Sketch in observability and analytics systems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Samples are sorted or buffered, then merged into centroids. A centroid stores a mean and a weight. The compression rule limits how large centroids may become as a function of rank, allowing larger clusters near the middle and smaller clusters near the tails. Querying a quantile walks cumulative weights and interpolates through the compressed distribution.',
        'Merging is the killer property. Each shard can build a local digest. A coordinator concatenates centroids, sorts them, compresses again, and gets a global digest. That fits streaming telemetry, distributed dashboards, rollups, and long retention windows.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Memory is bounded by the compression parameter and implementation details rather than by stream length. Higher compression preserves more centroids and improves accuracy but costs more memory and CPU. Ordered or adversarial inputs need careful handling, and extremely small subpopulations should often have separate digests so their tails are not washed out by global traffic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        't-digest is useful in latency dashboards, distributed tracing rollups, database approximate percentile functions, stream processors, load-testing tools, and SLO alerting. It is especially useful when a system must merge quantile summaries across hosts or time windows.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A t-digest is not a histogram with equal-width buckets. It is a rank-aware sketch. It also does not make p99 automatically trustworthy. You still need labels, per-shard views, sampling sanity checks, and an alerting design that does not hide minority failures under aggregate traffic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: "Computing Extremely Accurate Quantiles Using t-Digests" at https://arxiv.org/abs/1902.04023 and the reference project at https://github.com/tdunning/t-digest. Study Greenwald-Khanna Quantile Summary for deterministic rank bounds, KLL Quantile Sketch for randomized compaction, DDSketch Relative-Error Quantiles for production latency distributions, then Tail Latency & p99 Thinking, Distributed Tracing, HyperLogLog, Count-Min Sketch, Reservoir Sampling, and Load Shedding & Graceful Degradation.',
      ],
    },
  ],
};
