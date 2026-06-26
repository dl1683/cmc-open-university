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
  const numBatches = 4;
  const numCentroids = 6;
  const quantiles = ['p50', 'p95', 'p99'];

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
    explanation: `Quantile monitoring cannot keep every latency forever. Across ${numBatches} batches of arriving samples, a t-digest keeps a compact summary that can answer rank questions like ${quantiles.join(', ')} while the stream continues to arrive.`,
  };

  yield {
    state: centroidTable('Compress sorted samples into weighted centroids'),
    highlight: { active: ['c3:mean', 'c3:weight', 'c4:mean', 'c4:weight'], found: ['c1:weight', 'c6:weight'] },
    explanation: `The digest stores ${numCentroids} centroids: each centroid has a mean and a weight. Middle ranks can tolerate larger clusters because a small rank error near ${quantiles[0]} is usually acceptable. The tails get small clusters because ${quantiles[2]} accuracy is where operators notice pain.`,
    invariant: `Centroids are ordered by mean; ${numCentroids} weights approximate how many samples each centroid represents.`,
  };

  yield {
    state: distributionPlot('Tail-aware compression gives more resolution near p99'),
    highlight: { active: ['p95', 'p99'], compare: ['p50'], found: ['cdf'] },
    explanation: `The sketch is designed for relative accuracy near the tails. It tracks ${quantiles.length} key quantiles (${quantiles.join(', ')}). That is why t-digest is popular for latency SLOs: the question is rarely "what is the exact average?" It is "how bad is the slow tail?"`,
  };

  const siblingSketchNames = ['HyperLogLog', 'Count-Min', 't-digest', 'reservoir'];
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
    explanation: `Sketches are not interchangeable — this table compares ${siblingSketchNames.length} sketch types: ${siblingSketchNames.join(', ')}. HyperLogLog answers cardinality, Count-Min Sketch answers approximate frequencies, and t-digest answers rank statistics.`,
  };
}

function* mergeQuantiles() {
  const shards = ['api', 'search', 'ads', 'billing'];
  const mergeSteps = ['append centroids', 'sort by mean', 'compress', 'query rank'];
  const totalCentroids = 12 + 18 + 10 + 7;

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
    explanation: `A distributed service with ${shards.length} shards (${shards.join(', ')}) cannot ship every raw request latency to one coordinator. Each shard summarizes locally into a combined ${totalCentroids} centroids. The coordinator merges them, compresses again, and estimates global quantiles.`,
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
    explanation: `The ${mergeSteps.length}-step merge path (${mergeSteps.join(' -> ')}) is why t-digest fits distributed telemetry. Local summaries are first-class data. You can roll them up per host, rack, region, and service without replaying raw events.`,
  };

  yield {
    state: distributionPlot('Read p95 and p99 from the merged summary'),
    highlight: { found: ['p95', 'p99'], active: ['cdf'] },
    explanation: `After merging ${totalCentroids} centroids from ${shards.length} shards, quantile queries walk cumulative centroid weights until the desired rank is reached. The answer is an interpolation through the compressed CDF, not a raw observation.`,
  };

  const operationalLessons = ['compression', 'ordering', 'tail accuracy', 'alerting'];
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
    explanation: `The sketch is only part of the monitoring design — ${operationalLessons.length} lessons (${operationalLessons.join(', ')}) apply. Tail latency must still be broken down by route, customer tier, shard, and release. Otherwise a globally good p99 can hide a small group having a terrible day.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        {
          type: 'callout',
          text: 'A t-digest spends centroid budget by rank, keeping the tails sharp while allowing the middle to compress.',
        },
        'Read each centroid as a weighted summary of nearby samples. Its mean says where the cluster sits, and its weight says how much rank mass it represents.',
        'The CDF view is a cumulative distribution function, which maps a value to the fraction of samples at or below it. Found markers such as p95 and p99 are rank queries over that compressed CDF.',
        {
          type: 'image',
          src: './assets/gifs/t-digest.gif',
          alt: 'Animated walkthrough of the t digest visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Normal_Distribution_CDF.svg',
          alt: 'Cumulative distribution function curves for normal distributions.',
          caption: 'Quantile queries read the value at a target cumulative rank; t-digest stores enough ordered mass to approximate that CDF without raw samples. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Normal_Distribution_CDF.svg.',
        },
        'Monitoring systems need percentiles, not only averages. A service can have normal p50 latency while p99 exposes lock contention, queueing, or one bad shard.',
        'Keeping every latency sample is too expensive for large streams. t-digest exists to answer approximate quantile questions from a compact summary that can be merged across machines.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The exact approach stores every sample, sorts the list, and selects the value at rank q times n. It is simple and gives the definition of a quantile.',
        'That approach fails for streaming telemetry. Memory grows with request volume, and distributed systems would need to ship raw samples to one coordinator just to answer p99.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is bounded memory with tail accuracy. A sketch must stay small while still preserving rare high-latency values that determine p99 and p999.',
        'Averaging local p99 values is not a valid global p99. Percentiles are ranks in the combined distribution, so local summaries must be mergeable without destroying rank order.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store the distribution as ordered centroids, and spend centroid budget by rank. The middle of the distribution can be compressed aggressively, while the tails use small clusters.',
        'This works because operational percentiles often care most about q near 0 or 1. A small rank error near p99 can change an alert; a similar rank error near p50 usually changes little.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg',
          alt: 'Normal distribution with standard deviation bands marked around the mean.',
          caption: 'Tail bands are visually small but operationally important; t-digest protects these rank regions instead of treating every part of the distribution equally. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.',
        },
        'Incoming samples are buffered, sorted, and merged into existing centroids. A centroid absorbs a nearby value only if the scale function allows its weight at that rank.',
        'The scale function is the rule that makes middle centroids larger and tail centroids smaller. Merging digests concatenates centroids from several sources, sorts by mean, and compresses again under the same rule.',
        'A quantile query walks cumulative centroid weights until it reaches the target rank. The returned value is an interpolation through centroids, not necessarily an observed raw sample.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is ordered weighted mass. Centroids stay sorted by mean, and each centroid weight approximates how many samples occupy that part of rank space.',
        'Tail accuracy comes from limiting centroid weight near q = 0 and q = 1. If a tail centroid has weight 1 or 2, crossing it changes rank by at most a few samples, so p99 is not smeared across a large bucket.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Memory is O(delta), where delta is the compression setting that controls centroid count. It is bounded with respect to the number of samples seen.',
        'Compression costs sorting and merging centroid lists, commonly O(c log c) for c centroids in a batch. Doubling delta roughly doubles serialized size and merge work, while improving accuracy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        't-digest fits latency dashboards, service-level objectives, and distributed telemetry where each host can summarize locally. It is useful when p95, p99, and p999 matter more than exact medians.',
        'It also fits rollups. A service can merge per-process digests into host, rack, region, and fleet digests without replaying raw measurements.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        't-digest is approximate and does not provide the same deterministic rank-error bound as Greenwald-Khanna summaries. If a compliance report requires a formal worst-case error, use a sketch with that contract.',
        'It can also mislead when cardinality explodes. Keeping separate digests for every route, tenant, region, status code, and build can consume more memory than the sketch saves.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 100 latency samples are summarized into centroids: 45 ms with weight 70, 90 ms with weight 20, 160 ms with weight 8, 420 ms with weight 1, and 900 ms with weight 1. The p95 rank is sample 95, which lands inside the 160 ms centroid because cumulative weight reaches 98 there.',
        'The p99 rank is sample 99. It lands at the 420 ms centroid, and p100 lands at 900 ms. The two tail samples were not averaged into the 70-sample middle centroid, so the slow edge remains visible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Ted Dunning and Otmar Ertl on t-digest, plus DDSketch, KLL, and Greenwald-Khanna summaries for alternatives. Next study tail latency, histograms, streaming algorithms, and distributed metrics aggregation.',
      ],
    },
  ],
};
