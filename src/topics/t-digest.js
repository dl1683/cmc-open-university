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
      heading: 'Why this exists',
      paragraphs: [
        "Many systems care less about the average than about the slow tail. A web service can have a fine mean latency while one percent of users wait several seconds. A database can look healthy at p50 while p99 exposes compaction, lock contention, or a bad shard. Percentiles turn a pile of measurements into rank questions: what value is larger than 50%, 95%, or 99% of the observations?",
        "The hard part is scale. A single host might emit millions of latencies per minute, and a fleet might emit billions. Keeping every sample just to answer p95 later is often too expensive. t-digest exists for online and distributed quantile estimation: it keeps a compact, mergeable summary that preserves enough rank information to estimate useful percentiles, with extra care near distribution tails.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The exact method is simple: store every value, sort the values, and pick the element at rank floor(q * n). That method is not wrong. It is the definition most learners should start from, and it gives exact answers for any quantile after the data is sorted.",
        "The exact method also has a clean distributed version in theory. Send every raw value to one place, sort the global list, and query it. That preserves the combined distribution. It also creates a hot coordinator, large network traffic, expensive storage, and a delay between measurement and answer. The method is exact because it refuses to summarize, and that is exactly why it fails in telemetry pipelines.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The first wall is memory. A stream does not end just because a dashboard query starts. If the only way to answer a percentile is to retain all samples, memory grows with traffic and retention time. A bounded monitoring agent needs a summary whose size is controlled by a parameter, not by the number of requests seen so far.",
        "The second wall is tail detail. Equal-width histograms waste buckets in empty regions and blur the tail when values span a wide range. Averaging local p99 values is worse: percentiles are ranks in a combined distribution, so four shard p99s cannot be averaged into a correct global p99. A useful sketch must summarize locally, merge globally, and still spend more resolution where rare slow values matter.",
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        "A t-digest represents the distribution as ordered weighted centroids. A centroid has a mean and a weight. The mean says where a cluster of nearby values sits. The weight says how many samples the cluster represents. If a centroid has mean 45 ms and weight 18, it stands in for 18 observations near 45 ms.",
        "The key invariant is not just sorted means. It is rank-shaped cluster size. Centroids near q = 0 and q = 1 should be small, often singletons at the extremes. Centroids near the middle may be larger. A scale function controls which cluster sizes are allowed at each rank. That rule makes the digest spend memory near p99 instead of treating all ranks equally.",
      ],
    },
    {
      heading: 'How updates work',
      paragraphs: [
        "Most practical t-digest implementations buffer new samples, sort them, and merge them into the current centroid list. Sorting matters because the digest is a rank structure. The update path walks values in order and tries to absorb a value into a nearby centroid when doing so would not violate the scale rule for that rank region.",
        "When a value joins a centroid, the centroid mean is updated by weighted averaging and the weight increases by one. When no centroid can accept the value under the compression rule, the value starts a new centroid. Periodic compression walks the ordered list again and combines adjacent centroids where the rank budget allows it. The digest keeps throwing away exact identities while preserving approximate cumulative rank.",
      ],
    },
    {
      heading: 'How queries and merges work',
      paragraphs: [
        "A quantile query walks centroids in mean order while accumulating weight. The target rank is q times the total weight. When the cumulative weight reaches the target region, the implementation interpolates through the compressed cumulative distribution and returns an estimated value. The answer is not necessarily one raw observation. It is a value inferred from the weighted summary.",
        "Merging uses the same idea. Concatenate centroids from several local digests, sort by centroid mean, and compress the combined list under the same scale rule. This is why t-digest fits map-reduce jobs, stream processors, and service telemetry. Local summaries are first-class data. A coordinator can roll up per-process digests into per-host, per-region, and global digests without replaying raw events.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The correctness argument is approximate but concrete. If each centroid near the tail has very small weight, then crossing one centroid changes cumulative rank by very little. A p99 query may still interpolate, but it is interpolating through fine-grained tail clusters rather than through a giant bucket that contains many ranks. The tail estimate is less blurred because the representation made tail clusters small on purpose.",
        "The merge argument depends on weighted order. A centroid is a compact claim about mass near a mean. When centroids from different shards are sorted together, their weights reconstruct an approximate global rank walk. Recompression can lose information, especially if the digest is too small or merged repeatedly with poor settings, but it preserves the same shape rule that made the local digests useful.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Memory is controlled by the compression parameter and implementation limits, not by stream length. Higher compression keeps more centroids. That usually improves accuracy and costs more CPU, memory, and serialized bytes. Lower compression makes the digest smaller but can hide spikes or smear tail values into larger clusters.",
        "Update cost depends on the implementation. Buffered sorted updates are efficient because they turn many inserts into an ordered merge. Merge cost is proportional to the number of centroids being combined plus sorting and recompression. That is much smaller than merging raw samples, but it is not free. A high-cardinality metrics system can still create too many digests if it keeps one per route, customer, status, region, build, and feature flag.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Suppose four API shards each handle one minute of traffic. The first shard sees mostly 20 to 80 ms requests with a few 190 ms delays. The second sees search requests with a 420 ms tail. The third sees moderate traffic around 260 ms. The fourth is small but has 900 ms failures. Each shard builds a local t-digest with small centroids near its own slow tail.",
        "The coordinator receives hundreds of centroids instead of millions of raw latencies. It sorts the centroids by mean, compresses them again, and asks for p99. The result is a traffic-weighted estimate from the combined distribution. That is much better than averaging the shard p99 values, because a low-traffic shard and a high-traffic shard should not contribute equally to the global rank.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "t-digest is a strong fit for latency dashboards, load testing, stream processors, tracing rollups, database approximate percentile functions, and SLO reporting. The common access pattern is the same: measurements arrive continuously, exact retention is too expensive, and operators need percentile queries over time windows, tags, or shards.",
        "It is especially useful when tail ranks matter more than a perfect model of the middle. A service can maintain one digest per route and status code, merge digests for a dashboard interval, and query p50, p95, p99, and p99.9 without replaying logs. Because the summary is mergeable, it works naturally with distributed aggregation trees.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "t-digest is not an exact quantile data structure. It is also not the right tool when the contract requires a deterministic rank-error bound. Greenwald-Khanna and KLL-style sketches are better starting points when the guarantee itself matters more than practical tail accuracy. Different t-digest implementations, scale functions, compression values, interpolation rules, and merge patterns can produce different answers.",
        "Aggregate percentiles can still mislead. A global p99 can look acceptable while one customer tier, endpoint, region, or shard is burning. Tiny windows are also unstable because any tail estimate has little evidence when the sample count is small. A percentile sketch does not replace dimensional breakdowns, minimum sample thresholds, incident traces, or direct inspection of raw examples.",
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        "Keep the compression setting visible in metrics metadata. A percentile without the digest configuration is hard to compare across releases. Record total count, min, max, centroid count, compression parameter, implementation version, and whether the digest was merged, downsampled, or windowed.",
        "Use t-digest as part of a measurement design. Keep separate digests for the dimensions that define user pain, but control cardinality before it explodes. Use rolling windows carefully. Alert on enough traffic to make the tail meaningful. Keep raw exemplars or traces for the worst requests so an approximate p99 can lead to a concrete diagnosis.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study Greenwald-Khanna Quantile Summary for deterministic rank-error bounds. Study KLL sketches for compact randomized quantile summaries. Study DDSketch for relative value error over positive measurements. Study Count-Min Sketch and HyperLogLog to see how different sketches answer different questions.",
        "Then study Tail Latency, SLO Error Budget Burn Rate Alerting, Prometheus Native Histogram Schema, OpenTelemetry Exponential Histogram Aggregation, and Distributed Tracing. The sketch tells you where a percentile sits. The surrounding observability system decides whether that number is actionable.",
      ],
    },
  ],
};
