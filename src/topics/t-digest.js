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
        { type: 'callout', text: 'A t-digest spends centroid budget by rank, keeping the tails sharp while allowing the middle to compress.' },
        'The "centroid compression" view shows raw latency samples arriving in batches, then being compressed into weighted centroids ordered by mean. Active highlights mark the centroids being built or merged right now. Found highlights mark the quantile estimates (p50, p95, p99) read from the compressed summary. The CDF plot shows where each centroid sits in cumulative rank space.',
        'The "merge quantiles" view shows four distributed shards, each building a local digest. The coordinator concatenates their centroids, sorts by mean, recompresses under the same scale rule, and reads global quantile estimates from the merged result. Watch how the billing shard contributes few centroids but its 900 ms tail still appears in the final answer because weights carry traffic volume.',
        'At each frame, ask: how many samples does this centroid represent, what rank region does it cover, and why is that cluster allowed to be that size? The scale function is the answer to the third question every time.',
      
        {type: 'image', src: './assets/gifs/t-digest.gif', alt: 'Animated walkthrough of the t digest visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
        {
          type: 'quote',
          text: 'The key feature of the t-digest is that it provides high accuracy estimates of extreme quantiles such as the 99.9th percentile. This accuracy is achieved by maintaining higher resolution (smaller clusters) near q = 0 and q = 1.',
          attribution: 'Ted Dunning, "Computing Extremely Accurate Quantiles Using t-Digests" (2019)',
        },
        'Most systems care less about the average than about the slow tail. A web service can report a fine mean latency while one percent of users wait several seconds. A database can look healthy at p50 while p99 exposes lock contention, compaction stalls, or a single bad shard. Percentiles turn a pile of measurements into rank questions: what value is larger than 99% of the observations?',
        'The hard part is scale. A single host might emit millions of latency samples per minute and a fleet might emit billions. Keeping every sample just to answer p95 later is too expensive in memory, network, and storage. t-digest exists to answer rank queries from a compact, mergeable summary that preserves extra resolution where it matters most: at the distribution tails.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The exact method is simple: store every value, sort, pick the element at rank floor(q * n). It gives perfect answers for any quantile and it is the definition learners should start from. The distributed version is the same idea: ship every raw value to one coordinator, sort the global list, query it.',
        'That preserves the full combined distribution. It also creates a hot coordinator, large network traffic, expensive storage, and a delay between measurement and answer. The method is exact because it refuses to summarize, and that refusal is exactly why it fails in telemetry pipelines that must answer "what is p99 right now?" every ten seconds across thousands of hosts.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is memory. A stream does not stop because a dashboard query starts. If the only way to answer a percentile is to retain all samples, memory grows with traffic and retention time. A bounded monitoring agent needs a summary whose size is controlled by a parameter, not by the number of requests seen so far.',
        'The second wall is tail detail. Equal-width histograms waste buckets in empty regions and blur the tail when values span a wide range. Averaging local p99 values is worse: percentiles are ranks in a combined distribution, so four shard p99 values cannot be averaged into a correct global p99. The average of four p99s is not the p99 of the union. A useful sketch must summarize locally, merge globally, and still spend more resolution where rare slow values matter.',
        {
          type: 'note',
          text: 'This is not a theoretical concern. Prometheus histogram_quantile over pre-aggregated buckets and Datadog "average of percentiles" both produce incorrect global percentiles unless the user takes explicit steps to avoid it. t-digest was designed to make the merge path correct by construction.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A t-digest represents the distribution as an ordered list of weighted centroids. Each centroid has a mean (where a cluster of nearby values sits) and a weight (how many samples it represents). A centroid with mean 45 ms and weight 18 stands in for 18 observations near 45 ms. The centroids are kept sorted by mean at all times.',
        {
          type: 'diagram',
          label: 'Centroid density across the rank space',
          text: [
            'rank:   0.0        0.25       0.50       0.75       1.0',
            '        |          |          |          |          |',
            '        * *  * *   ****  ********  ****   * *  * *  *',
            '        ^  ^                                  ^  ^  ^',
            '       tiny       medium centroids          tiny',
            '       (tail)     (middle bulk)             (tail)',
            '',
            'Scale function controls max cluster weight at each rank.',
            'Near q=0 and q=1: clusters must be small (high resolution).',
            'Near q=0.5: clusters may be large (compression saves space).',
          ].join('\n'),
        },
        'The scale function is the mechanism that enforces this shape. Dunning defines two main variants. k1 maps quantile q to k1(q) = (delta / 2pi) * arcsin(2q - 1), producing a cluster-size budget that is smallest at the extremes and largest in the middle. k2 uses k2(q) = (delta / 2pi) * log(q / (1 - q)), which gives even more resolution near q = 0 and q = 1. The compression parameter delta controls total centroid count: higher delta means more centroids, finer resolution, and more memory.',
        'Updates work by buffering incoming samples, sorting them, and merging into the current centroid list. For each value in sorted order, the algorithm finds the nearest centroid and checks whether adding this value would make that centroid exceed the weight limit imposed by the scale function at its current rank. If the centroid can absorb the value, it updates its mean by weighted average and increments its weight. If not, the value starts a new centroid.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Centroid merging with k1 scale function',
            'function compress(centroids, delta) {',
            '  const totalWeight = centroids.reduce((s, c) => s + c.weight, 0);',
            '  const merged = [centroids[0]];',
            '  let cumulative = centroids[0].weight;',
            '',
            '  for (let i = 1; i < centroids.length; i++) {',
            '    const c = centroids[i];',
            '    const last = merged[merged.length - 1];',
            '    const q = (cumulative + c.weight / 2) / totalWeight;',
            '',
            '    // k1 scale function: max weight at quantile q',
            '    const maxWeight = 4 * totalWeight * q * (1 - q) / delta;',
            '',
            '    if (last.weight + c.weight <= maxWeight) {',
            '      // Absorb: weighted mean update',
            '      last.mean = (last.mean * last.weight + c.mean * c.weight)',
            '                  / (last.weight + c.weight);',
            '      last.weight += c.weight;',
            '    } else {',
            '      // Start new centroid',
            '      merged.push({ mean: c.mean, weight: c.weight });',
            '    }',
            '    cumulative += c.weight;',
            '  }',
            '  return merged;',
            '}',
          ].join('\n'),
        },
        'The expression 4 * q * (1 - q) is the derivative of the k1 scale function. It reaches its maximum of 1.0 at q = 0.5 (allowing large clusters in the middle) and drops to zero at q = 0 and q = 1 (forcing tiny clusters at the tails). Dividing by delta means a larger delta allows more total centroids, so each one can be smaller and the sketch is more accurate.',
        'Quantile queries walk the centroid list in order, accumulating weight until the cumulative weight reaches the target rank q * totalWeight. The answer is interpolated from the centroid means surrounding that rank. Merging two digests concatenates their centroid lists, sorts by mean, and runs compression again under the same scale rule. This is why the merging property holds: the scale function is defined over normalized rank, so it applies identically to any combined centroid set regardless of which shards produced it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg',
          alt: 'Normal distribution with standard deviation bands marked around the mean.',
          caption: 'Tail bands are visually small but operationally important; t-digest protects these rank regions instead of treating every part of the distribution equally. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.',
        },
        'The correctness argument is approximate but concrete. If each centroid near the tail has weight 1 or 2, then crossing one centroid shifts cumulative rank by at most 2/n. A p99 query interpolates through these fine-grained tail clusters rather than through a giant bucket spanning many ranks. The tail estimate is accurate because the representation forced tail clusters to be small.',
        'The scale function is the invariant that makes this possible. At every compression step, each centroid obeys its rank-dependent weight budget. Because the budget is tightest near q = 0 and q = 1, the tails always retain fine resolution regardless of how many samples arrive or how many merges occur. The middle is allowed to coarsen because a rank error near the median rarely matters for operational decisions.',
        'The merge argument depends on weighted order. A centroid is a compact claim: "this much mass lives near this mean." When centroids from different shards are sorted together, their weights reconstruct an approximate global rank walk. Recompression under the same scale function re-enforces the same tail-resolution guarantee. Information is lost in the middle, where the budget allows it, and preserved at the tails, where it matters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            't-digest: empirical accuracy without a formal worst-case bound; O(delta) centroids; O(delta log delta) merge; excellent at p99 and p99.9 latency monitoring.',
            'GK summary: deterministic rank error epsilon; O((1/eps) log(eps*n)) space; best when a formal rank-error contract matters.',
            'DDSketch: relative value error alpha; O(log(max/min)/alpha) buckets; useful for positive measurements where relative error matters.',
            'KLL sketch: probabilistic rank error epsilon; compact sketch size; useful when uniform rank accuracy is more important than tail emphasis.',
            'Exact sort: zero error with O(n) space and O(n log n) sorting; right for small offline datasets.',
          ],
        },
        'Memory is controlled by the compression parameter delta and internal limits, not by stream length. A typical delta of 100 to 200 produces roughly 100 to 600 centroids depending on the distribution. Each centroid stores a mean (8 bytes) and a weight (4 to 8 bytes), so a digest fits in a few kilobytes. That is constant with respect to n, the number of samples seen.',
        'Update cost for the buffered merge variant is amortized O(1) per sample with periodic O(delta log delta) compression passes when the buffer fills. Merge cost is O(c1 + c2) to concatenate plus O((c1 + c2) log(c1 + c2)) to sort and recompress, where c1 and c2 are the centroid counts of the two digests. That is much smaller than merging raw samples, but it is not free. A high-cardinality metrics system can still create too many digests if it keeps one per route, customer, status, region, build, and feature flag.',
        'When delta doubles, centroid count roughly doubles, accuracy improves (especially in the middle), and serialized size doubles. Tail accuracy is already good at delta = 100 for most latency distributions because the tails get small centroids regardless of delta. Increasing delta helps the middle more than the extremes.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The killer use case is p99 latency monitoring in distributed systems. Each host, container, or shard maintains a local t-digest. A collector merges digests across the fleet every scrape interval and queries p50, p95, p99, and p99.9 from the merged result. No raw samples cross the network. The merge is mathematically sound because the scale function operates on normalized rank.',
        'Elasticsearch, Apache Spark, Apache Druid, and ClickHouse all ship t-digest implementations for approximate percentile functions. Load testing tools (Gatling, k6) use t-digest to report tail latencies from millions of requests without storing every response time. Stream processors (Flink, Kafka Streams) use it to compute rolling-window quantiles over unbounded event streams.',
        'The merging property is what separates t-digest from naive approaches. A service can maintain one digest per route and status code, merge digests for a dashboard interval, roll up per-host into per-region into global, and query any quantile at any level of the aggregation tree without replaying events. That compositional property is why t-digest became the default quantile sketch in observability infrastructure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        't-digest provides no formal error bound. The accuracy is empirically excellent at the tails, but "empirically excellent" is not a theorem. If the contract requires a deterministic guarantee on rank error -- for example, "the returned value has rank within eps*n of the true rank" -- then Greenwald-Khanna or KLL sketches are the right starting point. They trade tail accuracy for a provable worst-case bound.',
        'Different implementations can give different answers for the same data. The original paper describes the algorithm in terms of the scale function and compression, but leaves room for variation in interpolation, buffer management, centroid ordering during merge, and handling of duplicate values. The reference Java implementation (MergingDigest, AVLTreeDigest) and the Go/Rust/C++ ports do not always agree on edge cases.',
        'Aggregate percentiles can still mislead even with a correct sketch. A global p99 can look acceptable while one customer tier, endpoint, or shard is burning. Tiny time windows are unstable because the tail has very few samples. A percentile sketch does not replace dimensional breakdowns, minimum-sample thresholds, or raw traces for the worst requests. The sketch tells you the number; the rest of the observability system tells you whether that number is actionable.',
        {
          type: 'note',
          text: 'A common operational trap: alerting on p99 computed from a 10-second window over a low-traffic endpoint. With 50 requests in the window, p99 is determined by the single slowest request. One GC pause fires the alert. Use p99 over enough traffic that the tail contains at least tens of observations, or switch to a count-based trigger for low-volume routes.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Ted Dunning, "Computing Extremely Accurate Quantiles Using t-Digests," arXiv:1902.04023 (2019). The primary reference for the scale-function formulation, k1 and k2 derivations, and accuracy analysis.',
            'Ted Dunning and Otmar Ertl, "The t-Digest: Efficient Estimates of Distributions," Software Impacts 7 (2021). The journal version consolidating the merging digest algorithm and practical guidance.',
            'GitHub: tdunning/t-digest. The reference Java implementation with MergingDigest (production) and AVLTreeDigest (pedagogical) variants.',
            'Michael Greenwald and Sanjeev Khanna, "Space-Efficient Online Computation of Quantile Summaries," SIGMOD 2001. The deterministic rank-error alternative.',
            'Charles Masson, Jee E. Rim, and Homin K. Lee, "DDSketch: A Fast and Fully-Mergeable Quantile Sketch with Relative-Error Guarantees," PVLDB 2019. The relative-value-error alternative for positive measurements.',
          ],
        },
        'Study Greenwald-Khanna Quantile Summary for deterministic rank-error bounds. Study KLL Sketch for compact probabilistic quantile summaries with provable guarantees. Study DDSketch for relative value error over positive measurements, which gives uniform relative accuracy across the entire range instead of focusing resolution at the tails.',
        'Then study Count-Min Sketch and HyperLogLog to see how different sketches answer different questions: frequency estimation and cardinality estimation, respectively. For the operational context around t-digest, study Tail Latency, SLO Error Budget Burn Rate Alerting, and Distributed Tracing. The sketch tells you where a percentile sits. The surrounding system decides whether that number demands action.',
      ],
    },
  ],
};
