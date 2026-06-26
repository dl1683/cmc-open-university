// DDSketch: relative-error quantile sketch with logarithmic buckets and mergeable counts.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ddsketch-relative-error-quantiles',
  title: 'DDSketch Relative-Error Quantiles',
  category: 'Data Structures',
  summary: 'A production quantile sketch for latency distributions: map values into logarithmic buckets, count bucket populations, and merge sketches by adding counts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['log buckets', 'merge distributions'], defaultValue: 'log buckets' },
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

function bucketGraph(title) {
  return graphState({
    nodes: [
      { id: 'value', label: 'val', x: 0.5, y: 3.5, note: 'latency' },
      { id: 'map', label: 'map', x: 2.9, y: 3.5, note: 'log' },
      { id: 'b0', label: '1ms', x: 5.0, y: 1.1, note: 'count' },
      { id: 'b1', label: '10ms', x: 5.0, y: 2.8, note: 'count' },
      { id: 'b2', label: '100ms', x: 5.0, y: 4.5, note: 'count' },
      { id: 'b3', label: '1s', x: 5.0, y: 6.2, note: 'count' },
      { id: 'rank', label: 'rank', x: 7.3, y: 3.5, note: 'p99' },
      { id: 'answer', label: 'answer', x: 9.4, y: 3.5, note: '+/- e' },
    ],
    edges: [
      { id: 'e-value-map', from: 'value', to: 'map', weight: '' },
      { id: 'e-map-b0', from: 'map', to: 'b0', weight: '' },
      { id: 'e-map-b1', from: 'map', to: 'b1', weight: '' },
      { id: 'e-map-b2', from: 'map', to: 'b2', weight: '' },
      { id: 'e-map-b3', from: 'map', to: 'b3', weight: '' },
      { id: 'e-b2-rank', from: 'b2', to: 'rank', weight: '' },
      { id: 'e-rank-answer', from: 'rank', to: 'answer', weight: '' },
    ],
  }, { title });
}

function mergeGraph(title) {
  return graphState({
    nodes: [
      { id: 'api', label: 'api', x: 0.8, y: 1.6, note: 'DDS' },
      { id: 'search', label: 'search', x: 0.8, y: 3.5, note: 'DDS' },
      { id: 'billing', label: 'billing', x: 0.8, y: 5.4, note: 'DDS' },
      { id: 'add', label: 'add bins', x: 3.5, y: 3.5, note: 'same map' },
      { id: 'global', label: 'global', x: 6.2, y: 3.5, note: 'distribution' },
      { id: 'p99', label: 'p99', x: 8.5, y: 3.5, note: 'latency' },
    ],
    edges: [
      { id: 'e-api-add', from: 'api', to: 'add', weight: 'bins' },
      { id: 'e-search-add', from: 'search', to: 'add', weight: 'bins' },
      { id: 'e-billing-add', from: 'billing', to: 'add', weight: 'bins' },
      { id: 'e-add-global', from: 'add', to: 'global', weight: 'sum' },
      { id: 'e-global-p99', from: 'global', to: 'p99', weight: 'rank' },
    ],
  }, { title });
}

function relPlot(title) {
  return plotState({
    axes: {
      x: { label: 'true value', min: 0, max: 1200 },
      y: { label: 'allowed +/-', min: 0, max: 60 },
    },
    series: [
      { id: 'err', label: '5% relative band', points: [{ x: 10, y: 0.5 }, { x: 100, y: 5 }, { x: 500, y: 25 }, { x: 1000, y: 50 }] },
    ],
    markers: [
      { id: 'm10', x: 10, y: 0.5, label: '10ms' },
      { id: 'm500', x: 500, y: 25, label: '500ms' },
      { id: 'm1000', x: 1000, y: 50, label: '1s' },
    ],
  }, { title });
}

function* logBuckets() {
  const bucketNodes = 8;
  const bucketEdges = 7;
  const numBuckets = 4;
  const bucketFields = 3;
  const plotMarkers = 3;
  const errorPct = 5;
  const lowVal = 10;
  const highVal = 1000;
  const lowError = lowVal * errorPct / 100;
  const highError = highVal * errorPct / 100;

  yield {
    state: bucketGraph('DDSketch maps values into logarithmic buckets'),
    highlight: { active: ['value', 'map', 'b1', 'b2', 'e-value-map', 'e-map-b1', 'e-map-b2'], compare: ['rank'] },
    explanation: `DDSketch gives a relative-error value guarantee across ${bucketNodes} pipeline nodes connected by ${bucketEdges} edges. Instead of promising only that the returned value has a nearby rank, it maps each observed value to one of ${numBuckets} logarithmic buckets whose representative is within a chosen relative error.`,
    invariant: `Bucket width grows with value, so the same relative accuracy applies across all ${numBuckets} buckets from milliseconds to seconds.`,
  };

  yield {
    state: labelMatrix(
      'Bucket counts',
      [
        { id: 'b0', label: '1ms' },
        { id: 'b1', label: '10ms' },
        { id: 'b2', label: '100ms' },
        { id: 'b3', label: '1s' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'count', label: 'count' },
        { id: 'rep', label: 'rep' },
      ],
      [
        ['0.9-1.1', '12k', '1'],
        ['9-11', '80k', '10'],
        ['90-110', '7k', '100'],
        ['0.9-1.1s', '120', '1s'],
      ],
    ),
    highlight: { active: ['b1:count', 'b2:count'], found: ['b3:count'] },
    explanation: `Counts, not raw samples, are stored across ${numBuckets} buckets with ${bucketFields} fields each. Higher-value buckets are wider in absolute milliseconds but similar in relative error. That is why the structure fits long-tailed latency.`,
  };

  yield {
    state: relPlot('Relative error scales with the value'),
    highlight: { active: ['err', 'm500', 'm1000'], compare: ['m10'] },
    explanation: `A ${errorPct}% value error means +/-${lowError}ms near ${lowVal}ms and +/-${highError}ms near ${highVal / 1000}s. The plot marks ${plotMarkers} reference points showing this scale-aware contract, which is often closer to how humans and SLOs experience latency.`,
  };

  yield {
    state: bucketGraph('Quantile query walks cumulative bucket counts'),
    highlight: { active: ['b0', 'b1', 'b2', 'b3', 'rank', 'answer', 'e-b2-rank', 'e-rank-answer'], found: ['answer'] },
    explanation: `To answer p99, the sketch walks all ${numBuckets} bucket counts until cumulative count reaches the requested rank, then returns the bucket representative. The returned value has the configured relative accuracy if it remains in the retained buckets.`,
  };
}

function* mergeDistributions() {
  const mergeNodes = 6;
  const mergeEdges = 5;
  const serviceSources = 3;
  const sketchVariants = 4;
  const rollupColumns = 3;
  const contractColumns = 2;
  const totalEvents = '15M';
  const fleetP99 = '500ms';

  yield {
    state: mergeGraph('DDSketch merges by summing matching bucket counts'),
    highlight: { active: ['api', 'search', 'billing', 'add', 'e-api-add', 'e-search-add', 'e-billing-add'], compare: ['global'] },
    explanation: `DDSketch is fully mergeable when sketches use the same mapping. ${serviceSources} service sketches feed into the ${mergeNodes}-node merge graph through ${mergeEdges} edges. A coordinator adds matching bucket counts, then queries the combined distribution.`,
  };

  yield {
    state: labelMatrix(
      'Fleet rollup',
      [
        { id: 'api', label: 'api' },
        { id: 'search', label: 'search' },
        { id: 'bill', label: 'bill' },
        { id: 'fleet', label: 'fleet' },
      ],
      [
        { id: 'events', label: 'events' },
        { id: 'bins', label: 'bins' },
        { id: 'p99', label: 'p99' },
      ],
      [
        ['10M', '280', '210ms'],
        ['4M', '240', '460ms'],
        ['1M', '160', '900ms'],
        ['15M', '330', '500ms'],
      ],
    ),
    highlight: { active: ['api:bins', 'search:bins', 'bill:bins'], found: ['fleet:p99'] },
    explanation: `The fleet percentile of ${fleetP99} is computed from the merged distribution of ${totalEvents} events across ${serviceSources} services with ${rollupColumns} tracked columns, not by averaging per-service p99s. This connects directly to Tail Latency & p99 Thinking.`,
  };

  yield {
    state: mergeGraph('Production case: APM distributions roll up by tags'),
    highlight: { active: ['add', 'global', 'p99', 'e-add-global', 'e-global-p99'], compare: ['api', 'search', 'billing'] },
    explanation: `A tracing or metrics backend can keep DDSketch distributions across ${serviceSources} services by route, status code, and version. Rollups preserve approximate distributions across time windows and tags via the ${mergeEdges}-edge merge pipeline.`,
  };

  yield {
    state: labelMatrix(
      'Sketch contracts',
      [
        { id: 'gk', label: 'GK' },
        { id: 'kll', label: 'KLL' },
        { id: 'td', label: 't-dig' },
        { id: 'dds', label: 'DDS' },
      ],
      [
        { id: 'promise', label: 'promise' },
        { id: 'best', label: 'best' },
      ],
      [
        ['rank', 'det'],
        ['rank', 'compact'],
        ['tail rank', 'p99'],
        ['value %', 'APM'],
      ],
    ),
    highlight: { active: ['dds:promise', 'dds:best'], compare: ['gk:promise', 'kll:promise'] },
    explanation: `The distinguishing move is the promise. Across ${sketchVariants} sketch variants compared on ${contractColumns} contract dimensions, DDSketch is the one built for relative error in the quantile value, which is often what latency dashboards and operators actually care about.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'log buckets') yield* logBuckets();
  else if (view === 'merge distributions') yield* mergeDistributions();
  else throw new InputError('Pick a DDSketch view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "log buckets" view follows a single DDSketch ingesting latency values. Active nodes mark the current pipeline stage: a raw value enters on the left, the logarithmic mapping picks a bucket index, and the matching bucket counter increments. When the sketch answers a quantile query, the found marker lights up on the answer node after a cumulative-count walk across buckets.',
        {type: 'callout', text: 'DDSketch turns latency percentiles into a mergeable log-bucket count problem, so p99 rollups can preserve value accuracy without storing raw samples.'},
        'The "merge distributions" view shows three service-level sketches (api, search, billing) combining into one fleet sketch. Active edges carry bucket counts from each source into the addition step. The found marker is the merged p99 -- computed from the combined distribution, not averaged from per-service percentiles. That distinction matters: averaging percentiles is a well-known statistical error.',
        'In both views, compared nodes show relevant context that is not the current operation. Watch how bucket width grows with value in the first view, and how merge is pure count addition in the second.',
        {type: 'image', src: './assets/gifs/ddsketch-relative-error-quantiles.gif', alt: 'Animated walkthrough of the ddsketch relative error quantiles visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Production monitoring needs percentiles. The p50 (median) tells you the typical request latency. The p95 tells you the bad-but-common case. The p99 tells you the slow tail that drives user complaints and SLO breaches. To compute an exact percentile, you sort every observation and pick the value at the desired rank. That requires storing every sample.',
        'At scale this is impossible. A metrics pipeline handling 100 billion events per day across 10,000 microservices cannot sort and store raw samples. Approximate quantile sketches exist to solve this: they ingest a stream of values, use bounded memory, and answer "what is the value at rank q?" with some error guarantee.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Discrete_probability_distribution_illustration.svg/250px-Discrete_probability_distribution_illustration.svg.png', alt: 'Cumulative distribution functions for discrete, continuous, and mixed distributions', caption: 'CDF curves make the rank-to-value translation visible: a tiny rank movement can land on a very different value when the curve is steep. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Discrete_probability_distribution_illustration.svg/250px-Discrete_probability_distribution_illustration.svg.png'},
        'But most sketches (Greenwald-Khanna, KLL) promise rank accuracy: the returned value comes from a rank close to the one you asked for. That sounds reasonable until you consider long-tailed distributions. If the CDF is steep near p99, a tiny rank error can map to a huge value error. An SLO that says "p99 latency under 200 ms" cares about the value, not whether the answer came from rank 0.989 or 0.991. DDSketch, introduced by Masson, Rim, and Lee at Datadog in 2019, changes the contract: it guarantees the returned quantile value is within a configurable relative error of the true value.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest quantile computation sorts all observations and reads the value at the desired rank. For 1,000 observations, that is trivial. For 100 billion events per day, it is physically impossible to store the raw samples.',
        'Fixed-boundary histograms are the standard compromise. Prometheus, for example, uses predefined bucket boundaries and stores counts per bucket. You configure boundaries like [5, 10, 25, 50, 100, 250, 500, 1000] milliseconds and count how many observations fall into each range. To answer "p99," you interpolate within the bucket that contains the 99th percentile rank.',
        'This works when the bucket boundaries match the data. But latency spans five or six orders of magnitude: 0.1 ms cache hits, 5 ms database reads, 200 ms API calls, 30-second timeouts. Equal-width buckets waste resolution. If you choose 1 ms buckets to cover 30 seconds, you need 30,000 buckets and most are empty. If you choose 100 ms buckets, you cannot distinguish a 3 ms response from a 90 ms one. Hand-tuned boundaries help, but they break when traffic shifts to a new latency regime, and different services may use different boundaries, making cross-service merging fragile.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Two constraints collide. First, the sketch must give equal relative precision across the entire value range: 2% error at 5 ms and 2% error at 5 seconds. Equal-width or hand-tuned buckets cannot satisfy this without an impractical number of boundaries. Second, the sketch must merge cleanly across agents, time windows, and tag dimensions, because production percentiles are rolled up from thousands of sources. You cannot average per-host p99 values -- that is a well-known statistical error that underestimates tail latency.',
        'Rank-error sketches like Greenwald-Khanna (GK) and KLL merge correctly and give bounded rank error, but they do not control value error. A GK sketch might return a value at rank 0.9905 instead of 0.99. If the distribution is steep near p99 -- which it usually is for latency -- that small rank shift maps to a large value difference. The operator sees a number that is technically rank-close but operationally misleading. The dashboard says "p99 is 180 ms" when the true p99 is 310 ms, because the value at rank 0.9905 happens to be much lower.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use logarithmic bucket boundaries instead of linear ones. If every bucket spans a constant multiplicative range -- say each bucket\'s upper boundary is 1.04x its lower boundary -- then any value and its bucket\'s representative differ by at most 2% regardless of magnitude. A bucket near 10 ms spans [9.8, 10.2]. A bucket near 10,000 ms spans [9,800, 10,200]. The absolute width grows, but the relative width is constant. This is exactly the guarantee you want for latency: proportional accuracy everywhere.',
        'The second half of the insight is that logarithmic boundaries are universal: they depend only on the accuracy parameter, not on the data. Every DDSketch agent with the same accuracy uses the same bucket boundaries. That means merging is trivial -- just add the counts for each bucket index. No rebalancing, no centroid merging, no heuristics. The structure is both accurate in the right sense and trivially mergeable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'DDSketch has three components: a mapping function, a store of bucket counts, and a total count. The mapping function converts a positive value v to a bucket index. The store is a sparse array (or map) from bucket indices to counts. The total count tracks how many values the sketch has seen.',
        'The mapping is defined by a single parameter alpha, the maximum relative error. From alpha, derive gamma = (1 + alpha) / (1 - alpha). The bucket index for value v is ceil(log(v) / log(gamma)). Bucket k covers the range [gamma^(k-1), gamma^k). Every value in that range is within a factor of gamma of the bucket\'s representative (the geometric midpoint), which guarantees relative error at most alpha.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Logarithmic_Scales-mkII.svg/500px-Logarithmic_Scales-mkII.svg.png', alt: 'Comparison of logarithmic and linear graph scales', caption: 'Logarithmic spacing is the geometry behind DDSketch buckets: equal visual steps represent multiplicative value changes. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Logarithmic_Scales-mkII.svg/500px-Logarithmic_Scales-mkII.svg.png'},
        {
          type: 'diagram',
          label: 'Logarithmic bucket mapping',
          text: 'value axis (log scale):\n\n|------|---------|------------|------------------|---------------------------------|\n0.5    1        2            4                  8                                16\n  b0      b1         b2            b3                      b4\n\nBucket b0: [0.5, 1)    width 0.5\nBucket b1: [1,   2)    width 1\nBucket b2: [2,   4)    width 2\nBucket b3: [4,   8)    width 4\nBucket b4: [8,  16)    width 8\n\nAbsolute width doubles each bucket.\nRelative width (width / midpoint) is constant.',
        },
        'To insert a value: compute the bucket index (one log, one multiply, one ceiling), increment that bucket\'s count, increment the total count. No raw values are stored.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Bucket index for a positive value v\n// gamma = (1 + alpha) / (1 - alpha)\n// multiplier = 1 / Math.log(gamma)\nfunction bucketIndex(v, multiplier) {\n  return Math.ceil(Math.log(v) * multiplier);\n}\n\n// Example: alpha = 0.02, gamma ~= 1.0408\n// multiplier = 1 / Math.log(1.0408) ~= 25.01\n// bucketIndex(10)  = ceil(ln(10) * 25.01) = ceil(57.6) = 58\n// bucketIndex(100) = ceil(ln(100) * 25.01) = ceil(115.1) = 116',
        },
        'To query quantile at rank q: walk bucket indices in ascending order, accumulating counts, until the cumulative count reaches ceil(q * n). Return the representative value of that bucket (typically gamma^(k-0.5), the geometric center). The answer is within alpha of the true quantile value, assuming no bucket collapsing has occurred.',
        'To merge two sketches with the same alpha: for each bucket index, add the counts. Add the total counts. The merged sketch represents the combined distribution exactly as if one sketch had seen all values. This works because every sketch with the same alpha uses identical bucket boundaries.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts. First, the logarithmic mapping guarantees that any value v and its bucket representative r satisfy |v - r| / v <= alpha. Here is why: consecutive bucket boundaries are gamma^(k-1) and gamma^k. The ratio of any two values in bucket k is at most gamma^k / gamma^(k-1) = gamma = (1 + alpha) / (1 - alpha). The geometric midpoint of the bucket is gamma^(k-0.5). For any value v in [gamma^(k-1), gamma^k), the relative distance to the midpoint is at most (gamma - 1) / (gamma + 1) = alpha. So the representative is within alpha of every value in the bucket.',
        'Second, merge preserves the guarantee because all sketches with the same mapping use identical bucket boundaries. Adding counts for bucket index k in sketch A and sketch B is equivalent to one sketch that saw all values in bucket k. The cumulative-count walk on the merged sketch produces the same rank-to-bucket assignment as if the values had been streamed into a single sketch. No information is lost, no approximation is introduced.',
        'A useful monotonicity property: once a value is assigned to a bucket, no future insertion changes that assignment. Bucket counts only increase. This makes the sketch append-friendly and safe for concurrent updates using atomic increments -- no locks needed on the hot path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert is O(1): one floating-point log, one multiply, one ceiling, one counter increment. In practice, the log can be replaced with bit manipulation on the IEEE 754 exponent field, making the mapping even cheaper -- essentially a right-shift and a mask.',
        'Quantile query is O(b), where b is the number of occupied buckets. You walk them in index order until cumulative count reaches the target rank. Merge is also O(b): iterate the occupied bucket indices from both sketches and add counts.',
        'Space is O(b), and b depends on the log-span of the data divided by log(gamma). For alpha = 0.01 (1% accuracy) covering values from 1 ms to 60 seconds, b is roughly log(60000) / log(1.0202) = log(60000) / 0.020 = 552 buckets. For alpha = 0.05 (5% accuracy), gamma = 1.1053, and b drops to log(60000) / log(1.1053) = 110 buckets. Each bucket stores one 64-bit counter, so the sketch fits in a few KB even at high accuracy.',
        'Doubling the value range adds a fixed number of buckets (proportional to log(2) / log(gamma)), not a proportional number. Doubling the number of observations does not change the bucket count at all. Space depends on the spread of the data, not its volume. This is the key advantage over exact storage.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DDSketch is the quantile engine behind Datadog APM distributions. Every trace span carries a DDSketch, and the backend merges sketches across services, endpoints, status codes, versions, and time windows to produce fleet-wide percentile dashboards. This is the canonical use case: high-cardinality latency monitoring where percentiles must be rolled up from thousands of sources without the "average of p99s" error.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/CDF_plot_with_two_red_rectangles%2C_illustrating_%28-x%29F%28x%29_and_x%281-F%28x%29%29.png/250px-CDF_plot_with_two_red_rectangles%2C_illustrating_%28-x%29F%28x%29_and_x%281-F%28x%29%29.png', alt: 'CDF plot with highlighted rectangles near the tails', caption: 'Tail queries read values from the steep regions of a distribution, which is why the value-error contract matters. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/CDF_plot_with_two_red_rectangles%2C_illustrating_%28-x%29F%28x%29_and_x%281-F%28x%29%29.png/250px-CDF_plot_with_two_red_rectangles%2C_illustrating_%28-x%29F%28x%29_and_x%281-F%28x%29%29.png'},
        'The value-error guarantee is what distinguishes DDSketch from rank-error sketches. When an SLO says "p99 under 200 ms," the operator wants to know the returned value is close to the true p99 in milliseconds, not that the rank is close to 0.99. DDSketch speaks the language of SLOs directly.',
        'Mergeability is equally important in practice. Unlike t-digest, which merges by combining centroids with heuristic weight limits and loses formal guarantees in the process, DDSketch merge is exact when sketches share the same mapping. No information is lost. This makes it safe for multi-level rollup: agent to collector to regional aggregator to global dashboard, with the same alpha guarantee at every level.',
        'Beyond latency monitoring, DDSketch applies anywhere you need mergeable percentiles on positive-valued distributions: request sizes, queue depths, payment amounts, sensor readings. Any domain where the natural measure of accuracy is "within X% of the true value" rather than "within X ranks of the true rank" benefits from the relative-error contract.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The logarithmic mapping is defined only for positive values. Zero needs a separate counter. Negative values require a mirrored mapping (a second set of buckets indexed by ceil(log(-v) * multiplier)) or a completely separate sketch. NaN and infinity must be rejected or tracked outside the sketch. If different agents in a fleet handle these edge cases differently, merged percentiles describe an inconsistent distribution. Sketch compatibility is not just alpha -- it includes the value-domain policy.',
        'Collapsing stores trade accuracy for bounded memory. The collapsingLowest strategy merges the lowest-index buckets when the bucket count exceeds a configured cap. This saves space but silently degrades accuracy for small values. The collapsingHighest strategy does the inverse. Either way, the relative-error guarantee weakens in the collapsed region, and the operator may not realize their sketch is now less accurate for a portion of the distribution. Memory caps are part of the data-structure contract, not a free optimization.',
        'The value-error guarantee says nothing about sample size. A p99 computed from 50 observations is statistically unstable regardless of how accurate the sketch is. DDSketch compresses a distribution; it does not stabilize one. You still need enough observations for the percentile itself to be meaningful.',
        {
          type: 'note',
          text: 'Different alpha values produce incompatible sketches. Merging sketches with alpha = 0.01 and alpha = 0.05 is not valid. A fleet must agree on a single alpha before deployment.',
        },
        'Finally, DDSketch gives no rank-error guarantee. If you ask for p99 and the sketch returns a value from rank 0.97, the value will still be within alpha of the true value at whatever rank it came from -- but it is not the true p99. In practice this is rare because the rank error is bounded by the ratio of the bucket count to the total count, but the formal contract only covers value error.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you configure alpha = 0.05 (5% relative error). Then gamma = (1 + 0.05) / (1 - 0.05) = 1.05 / 0.95 = 1.10526. The multiplier is 1 / ln(1.10526) = 1 / 0.10008 = 9.992, call it 10.0 for this example.',
        'Insert five latency values: 12 ms, 47 ms, 103 ms, 205 ms, 980 ms. Compute bucket indices: bucketIndex(12) = ceil(ln(12) * 10.0) = ceil(2.485 * 10) = ceil(24.85) = 25. Similarly: bucketIndex(47) = ceil(ln(47) * 10) = ceil(38.5) = 39. bucketIndex(103) = ceil(ln(103) * 10) = ceil(46.3) = 47. bucketIndex(205) = ceil(ln(205) * 10) = ceil(53.2) = 54. bucketIndex(980) = ceil(ln(980) * 10) = ceil(68.9) = 69.',
        'The sketch stores: {25: 1, 39: 1, 47: 1, 54: 1, 69: 1}, totalCount = 5. Five buckets, five counters. Five 64-bit integers plus a small map overhead.',
        'Now query p50 (rank 0.5). Target count = ceil(0.5 * 5) = 3. Walk buckets in index order: bucket 25 (cumulative 1), bucket 39 (cumulative 2), bucket 47 (cumulative 3) -- stop. The representative of bucket 47 is gamma^(47 - 0.5) = 1.10526^46.5. Compute: ln(representative) = 46.5 * 0.10008 = 4.654, so representative = e^4.654 = 105.1 ms. The true median of {12, 47, 103, 205, 980} is 103 ms. Relative error: |105.1 - 103| / 103 = 2.0%, which is within the 5% guarantee.',
        'Now merge with a second sketch from another service that saw values 8 ms, 55 ms, and 500 ms. Their bucket indices: 21, 40, and 62. The merged store is {21: 1, 25: 1, 39: 1, 40: 1, 47: 1, 54: 1, 62: 1, 69: 1}, totalCount = 8. Query p99: target count = ceil(0.99 * 8) = 8. Walk all 8 buckets -- the last is bucket 69, representative = 1.10526^68.5. ln(rep) = 68.5 * 0.10008 = 6.856, so representative = e^6.856 = 950 ms. The true p99 of {8, 12, 47, 55, 103, 205, 500, 980} is 980 ms. Relative error: |950 - 980| / 980 = 3.1%, within the 5% guarantee.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Masson, Rim, Lee. "DDSketch: A Fast and Fully-Mergeable Quantile Sketch with Relative-Error Guarantees." PVLDB 12(12), 2019.',
            'Implementation: Datadog sketches-go and sketches-py open-source libraries on GitHub.',
            'Production case: Datadog engineering blog, "Computing Accurate Percentiles with DDSketch."',
            'Comparison: Dunning and Ertl. "Computing Extremely Accurate Quantiles Using t-Digests." (arXiv, 2019) -- the centroid-based alternative with heuristic tail accuracy.',
          ],
        },
        {
          type: 'quote',
          text: 'Existing quantile sketches [...] provide guarantees on the rank error [...] but not on the relative error of the quantile values, which is a more natural measure of accuracy for values such as latencies.',
          attribution: 'Masson, Rim, Lee (2019)',
        },
        'Prerequisite: study Greenwald-Khanna to understand rank-error quantile sketches and why rank accuracy differs from value accuracy. The GK sketch is the clearest example of the rank-error contract and its limitations on long-tailed data.',
        'Extension: study t-digest to see a centroid-based alternative that gives good tail accuracy without formal guarantees but with practical performance that makes it the default in Elasticsearch. Compare its heuristic compression parameter to DDSketch\'s mathematically grounded alpha.',
        'Related: study Tail Latency and p99 Thinking to understand why the aggregation plan around a sketch matters as much as the sketch itself -- a perfect sketch with incorrect rollup logic still produces wrong percentiles.',
      ],
    },
  ],
};
