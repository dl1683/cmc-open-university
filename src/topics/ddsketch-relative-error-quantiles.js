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
  yield {
    state: bucketGraph('DDSketch maps values into logarithmic buckets'),
    highlight: { active: ['value', 'map', 'b1', 'b2', 'e-value-map', 'e-map-b1', 'e-map-b2'], compare: ['rank'] },
    explanation: 'DDSketch gives a relative-error value guarantee. Instead of promising only that the returned value has a nearby rank, it maps each observed value to a logarithmic bucket whose representative is within a chosen relative error.',
    invariant: 'Bucket width grows with value, so the same relative accuracy applies at milliseconds and seconds.',
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
    explanation: 'Counts, not raw samples, are stored. Higher-value buckets are wider in absolute milliseconds but similar in relative error. That is why the structure fits long-tailed latency.',
  };

  yield {
    state: relPlot('Relative error scales with the value'),
    highlight: { active: ['err', 'm500', 'm1000'], compare: ['m10'] },
    explanation: 'A 5% value error means +/-0.5ms near 10ms and +/-50ms near 1s. This scale-aware contract is often closer to how humans and SLOs experience latency.',
  };

  yield {
    state: bucketGraph('Quantile query walks cumulative bucket counts'),
    highlight: { active: ['b0', 'b1', 'b2', 'b3', 'rank', 'answer', 'e-b2-rank', 'e-rank-answer'], found: ['answer'] },
    explanation: 'To answer p99, the sketch walks bucket counts until cumulative count reaches the requested rank, then returns the bucket representative. The returned value has the configured relative accuracy if it remains in retained buckets.',
  };
}

function* mergeDistributions() {
  yield {
    state: mergeGraph('DDSketch merges by summing matching bucket counts'),
    highlight: { active: ['api', 'search', 'billing', 'add', 'e-api-add', 'e-search-add', 'e-billing-add'], compare: ['global'] },
    explanation: 'DDSketch is fully mergeable when sketches use the same mapping. A coordinator adds matching bucket counts, then queries the combined distribution.',
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
    explanation: 'The fleet percentile is computed from the merged distribution, not by averaging per-service p99s. This connects directly to Tail Latency & p99 Thinking.',
  };

  yield {
    state: mergeGraph('Production case: APM distributions roll up by tags'),
    highlight: { active: ['add', 'global', 'p99', 'e-add-global', 'e-global-p99'], compare: ['api', 'search', 'billing'] },
    explanation: 'A tracing or metrics backend can keep DDSketch distributions by service, route, status code, and version. Rollups preserve approximate distributions across time windows and tags.',
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
    explanation: 'The distinguishing move is the promise. DDSketch is built for relative error in the quantile value, which is often what latency dashboards and operators actually care about.',
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
        'The "log buckets" view shows a single DDSketch ingesting latency values. Active nodes mark the current stage of the pipeline: a raw value enters, the logarithmic mapping assigns it a bucket index, and the bucket count increments. Found markers show the quantile answer after a rank walk.',
        'The "merge distributions" view shows three service-level sketches combining into one fleet sketch. Active edges carry bucket counts from each source into the addition step. The found marker is the merged p99, computed from the combined distribution rather than averaged from per-service percentiles.',
        'In both views, compared nodes show state that is relevant context but not the current operation. Watch how bucket width grows with value in the first view, and how merge is just count addition in the second.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Monitoring systems need percentiles: p50 for the typical request, p95 for the bad-but-common case, p99 for the slow tail that drives user complaints and SLO breaches. Computing exact percentiles requires storing every observation in sorted order, which is impractical when thousands of hosts each report millions of latency samples per minute.',
        'Approximate quantile sketches solve the storage problem, but most of them (Greenwald-Khanna, KLL) promise rank accuracy: the returned value comes from a rank close to the one you asked for. That is a weaker promise than it sounds. If a distribution has a long tail, a value whose rank is close to p99 can still be far from the true p99 in milliseconds. An SLO that says "p99 latency is under 200 ms" cares about the value, not about whether the answer came from rank 0.989 or 0.991.',
        'DDSketch, introduced by Masson, Rim, and Lee at Datadog in 2019, changes the contract. It guarantees that the returned quantile value is within a configurable relative error of the true value. For latency monitoring, this is a better fit: the sketch promises "p99 is 204 ms, accurate to within 2%," not "the value at some rank near 0.99 is 204 ms."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest quantile computation sorts all observations and reads off the value at the desired rank. This works for small batches. A metrics pipeline handling 100 billion events per day across 10,000 services cannot store raw samples for on-demand sorting.',
        'Fixed histograms are the standard compromise. Prometheus, for example, uses predefined bucket boundaries and stores counts per bucket. This works if you guess the bucket boundaries correctly. But latency spans five or six orders of magnitude: 0.1 ms cache hits, 5 ms database reads, 200 ms API calls, 30-second timeouts. Equal-width buckets waste resolution. If you choose 1 ms buckets, you need 30,000 buckets to cover 30 seconds and most are empty. If you choose 100 ms buckets, you cannot distinguish a 3 ms response from a 90 ms one.',
        'Hand-tuned bucket boundaries help, but they break when traffic shifts to a new latency regime. They also make merging across services fragile: different services may use different boundaries, and the merged histogram loses information at every boundary mismatch.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Two constraints collide. First, the sketch must give equal relative precision across the entire value range: a 2% error at 5 ms and a 2% error at 5 seconds. Equal-width or hand-tuned buckets cannot satisfy this without an impractical number of boundaries. Second, the sketch must merge cleanly across agents, time windows, and tag dimensions, because production percentiles are rolled up from thousands of sources. Averaging per-host p99 values is a well-known statistical error.',
        'Rank-error sketches like GK and KLL merge correctly and give bounded rank error, but they do not control value error. A sketch might return a value at rank 0.9905 instead of 0.99, and if the distribution is steep near p99, that rank difference maps to a large value difference. The operator sees a number that is technically rank-close but operationally misleading.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'DDSketch rests on one structural choice: logarithmic bucket boundaries. Choose a relative accuracy parameter alpha (for example, 0.02 for 2% accuracy). The mapping function assigns each positive value v to bucket index floor(log(v) / log(gamma)), where gamma = (1 + alpha) / (1 - alpha). Every value in a bucket is within a factor of gamma of the bucket representative, which guarantees relative error at most alpha.',
        {
          type: 'diagram',
          label: 'Logarithmic bucket mapping',
          text: 'value axis (log scale):\n\n|------|---------|------------|------------------|---------------------------------|\n0.5    1        2            4                  8                                16\n  b0      b1         b2            b3                      b4\n\nBucket b0: [0.5, 1)    width 0.5\nBucket b1: [1,   2)    width 1\nBucket b2: [2,   4)    width 2\nBucket b3: [4,   8)    width 4\nBucket b4: [8,  16)    width 8\n\nAbsolute width doubles each bucket.\nRelative width (width / midpoint) is constant.',
        },
        'To insert a value, compute the bucket index and increment its count. No raw values are stored. To query a quantile at rank q, walk bucket counts in index order, accumulating a running total, until the cumulative count reaches ceil(q * n). Return the representative value of that bucket. The answer is within alpha of the true quantile value, assuming no collapsing has occurred.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Bucket index for a positive value v\n// gamma = (1 + alpha) / (1 - alpha)\n// multiplier = 1 / Math.log(gamma)\nfunction bucketIndex(v, multiplier) {\n  return Math.ceil(Math.log(v) * multiplier);\n}\n\n// Example: alpha = 0.02, gamma ~= 1.0408\n// multiplier = 1 / Math.log(1.0408) ~= 25.01\n// bucketIndex(10)  = ceil(ln(10) * 25.01) = ceil(57.6) = 58\n// bucketIndex(100) = ceil(ln(100) * 25.01) = ceil(115.1) = 116',
        },
        'Merging two sketches that share the same alpha is addition: for each bucket index, add the counts. The merged sketch represents the combined distribution exactly as if one sketch had seen all the values. This works because every sketch with the same alpha uses the same bucket boundaries.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts. First, the logarithmic mapping guarantees that any value v and its bucket representative r satisfy |v - r| / v <= alpha. This follows from the bucket boundaries being powers of gamma: consecutive boundaries are gamma and gamma^(k+1), so the ratio of any two values in the same bucket is at most gamma = (1 + alpha) / (1 - alpha), which means the relative distance from either value to the geometric midpoint is at most alpha.',
        'Second, merge preserves the guarantee because all sketches with the same mapping use identical bucket boundaries. Adding counts for bucket index k in sketch A and sketch B is equivalent to one sketch that saw all values landing in bucket k. The cumulative count walk on the merged sketch produces the same rank-to-bucket assignment as if the values had been streamed into a single sketch.',
        'The monotonicity property: once a value is assigned to a bucket, no future insertion changes that assignment. Bucket counts only increase. This makes the sketch append-friendly and safe for concurrent updates with atomic increments.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'Notes'],
          rows: [
            ['Insert', 'O(1)', 'One log, one ceil, one counter increment'],
            ['Query quantile', 'O(b)', 'Walk b occupied buckets to find the rank'],
            ['Merge', 'O(b)', 'Add counts for each occupied bucket index'],
            ['Space', 'O(b)', 'b = number of occupied buckets'],
          ],
        },
        'The number of occupied buckets b depends on the log-span of the data and the accuracy parameter. For alpha = 0.01 (1% accuracy) covering values from 1 ms to 60 seconds, b is roughly 2 * log(60000) / log(gamma), which works out to about 2,200 buckets. At alpha = 0.05, that drops to roughly 440 buckets. Each bucket stores one counter, so memory is typically a few KB.',
        'Doubling the value range adds a fixed number of buckets (proportional to 1/log(gamma)), not a proportional number. Doubling the number of observations does not change the bucket count at all. This is the key space advantage over exact storage.',
        'The insert path is fast: one floating-point log, one multiply, one ceiling, one array or map update. In practice, the log can be replaced by bit manipulation on the IEEE 754 exponent for an even cheaper approximation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'DDSketch is the quantile sketch behind Datadog APM distributions. Every trace span carries a DDSketch, and the backend merges sketches across services, endpoints, status codes, versions, and time windows to produce fleet-wide percentile dashboards. This is the canonical use case: high-cardinality latency monitoring where you need to roll up percentiles from many sources without the "average of p99s" error.',
        {
          type: 'table',
          headers: ['Sketch', 'Error guarantee', 'Mergeability', 'Space'],
          rows: [
            ['DDSketch', 'Relative value error (alpha)', 'Exact merge (same alpha)', 'O(log(max/min) / log(gamma))'],
            ['t-digest', 'Heuristic, best at tails', 'Approximate (centroid merge)', 'O(compression param)'],
            ['GK', 'Rank error (epsilon)', 'Exact merge', 'O((1/epsilon) * log(epsilon*n))'],
            ['KLL', 'Rank error (epsilon)', 'Exact merge', 'O(1/epsilon * log(log(1/delta)))'],
          ],
        },
        'The value-error guarantee is what distinguishes DDSketch from rank-error sketches. When an SLO says "p99 under 200 ms," the operator wants to know the value is close to 200 ms, not that the rank is close to 0.99. DDSketch speaks the language of SLOs directly.',
        'Mergeability is also a strength. Unlike t-digest, which merges by combining centroids with heuristic weight limits, DDSketch merge is exact when sketches share the same mapping. No information is lost. This makes it safe for multi-level rollup: agent to collector to regional aggregator to global dashboard.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The logarithmic mapping is defined only for positive values. Zeros need a separate counter. Negative values need a mirrored mapping or a separate sketch. NaN and infinity must be rejected or tracked outside the sketch. If different agents handle these edge cases differently, merged percentiles describe an inconsistent distribution. Sketch compatibility is not just alpha; it includes value-domain policy.',
        'Collapsing stores trade accuracy for bounded memory. The collapsingLowest strategy merges the lowest-index buckets when the bucket count exceeds a cap. This saves space but degrades accuracy for small values. The collapsingHighest strategy does the inverse. Either way, the relative-error guarantee weakens in the collapsed region, and the operator may not realize it. Memory caps are part of the data-structure contract, not a free optimization.',
        'The value-error guarantee says nothing about sample size. A p99 computed from 50 observations is statistically unstable regardless of how accurate the sketch is. DDSketch compresses a distribution; it does not stabilize one.',
        {
          type: 'note',
          text: 'Different alpha values produce incompatible sketches. Merging sketches with alpha = 0.01 and alpha = 0.05 is not valid. A fleet must agree on a single alpha before deployment.',
        },
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
          ],
        },
        {
          type: 'quote',
          text: 'Existing quantile sketches [...] provide guarantees on the rank error [...] but not on the relative error of the quantile values, which is a more natural measure of accuracy for values such as latencies.',
          attribution: 'Masson, Rim, Lee (2019)',
        },
        'Prerequisite: study Greenwald-Khanna to understand rank-error quantile sketches and why rank accuracy differs from value accuracy. Extension: study t-digest to see a centroid-based alternative that gives good tail accuracy without formal guarantees. Related: study Tail Latency and p99 Thinking to understand why the aggregation plan around a sketch matters as much as the sketch itself.',
      ],
    },
  ],
};
