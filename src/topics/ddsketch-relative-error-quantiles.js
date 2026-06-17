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
      heading: 'Why approximate quantiles exist',
      paragraphs: [
        "Percentiles turn a distribution into operational numbers: p50 for the common case, p95 for bad-but-common cases, and p99 for the slow tail. Exact percentiles require enough order information to find the value at a requested rank.",
        "DDSketch exists because many production metrics are positive and long-tailed. For latency, a rank-near answer can still be far away in milliseconds. DDSketch changes the contract from rank error to relative error in the returned value.",
      ],
    },
    {
      heading: 'The exact baseline',
      paragraphs: [
        "The exact baseline stores every observation, sorts the observations, and returns the item at rank floor(q * n). A monitoring backend can do this for a small batch of samples. It cannot do it cheaply for high-cardinality metrics across hosts, routes, versions, and time windows.",
        "A fixed histogram is the usual compromise. It stores bucket counts instead of raw values. Equal-width buckets are a poor fit for latency because the difference between 1 ms and 2 ms matters differently from the difference between 1001 ms and 1002 ms.",
      ],
    },
    {
      heading: 'The exact wall',
      paragraphs: [
        "The wall is scale. A useful latency sketch needs narrow buckets near small values and wider buckets near large values, while keeping the same relative precision. It also needs to merge cleanly because production percentiles are rolled up across agents, tags, and retention windows.",
        "Rank-error sketches such as GK and KLL answer a different question. They can tell you that a value is near the requested rank. DDSketch is built for the case where the dashboard promise is closer to: the reported value is within a configured percentage of the true quantile value.",
      ],
    },
    {
      heading: 'Core sketch invariant',
      paragraphs: [
        "DDSketch maps positive values into logarithmically spaced buckets. Bucket width grows with the value, so a bucket near 10 ms is narrow in milliseconds and a bucket near 1 second is wider in milliseconds.",
        "The invariant is relative value containment. Every positive value assigned to a bucket is close to that bucket's representative by the configured relative accuracy. Counts can move through the system because the bucket index, not the raw sample, carries the accuracy contract.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "Choose a relative accuracy alpha. The implementation derives a logarithmic base from alpha, maps each incoming positive value to an integer bucket index, and increments that bucket's count.",
        "A quantile query walks bucket counts in value order until the cumulative count reaches the requested rank. The sketch returns the representative value for that bucket. Merging two compatible sketches adds counts for equal bucket indices.",
      ],
    },
    {
      heading: 'Accuracy argument',
      paragraphs: [
        "The logarithmic mapping makes multiplicative error stable across the value range. If two values land in the same bucket, replacing either one with the bucket representative changes the value by at most the configured relative factor.",
        "Merge works because counts are additive. If one agent saw 20 values in bucket 81 and another saw 7 values in bucket 81, the merged sketch saw 27 values in that same approximate value range. The combined cumulative count gives the same quantile query you would get from one sketch over the union, subject to the same bucket approximation.",
      ],
    },
    {
      heading: 'Cost, memory, and merge behavior',
      paragraphs: [
        "Update cost is constant after the mapping calculation: compute the bucket index and increment a count. Query cost depends on how many occupied buckets must be scanned to reach the requested rank.",
        "Memory grows with the number of occupied bucket indices, roughly with the logarithmic span between the smallest and largest positive values. Dense stores are fast when the index range is tight. Sparse stores save memory when buckets are far apart. Collapsing stores cap memory by sacrificing accuracy in a chosen region.",
      ],
    },
    {
      heading: 'Production use',
      paragraphs: [
        "DDSketch fits APM and metrics systems that ship distributions from many agents. Agents can emit sketches by service, endpoint, status code, customer tier, and release. The backend merges compatible sketches by adding counts.",
        "This avoids a common percentile error: averaging per-host p99 values. The fleet p99 must be computed from the merged distribution, not from the mean of local percentiles.",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "DDSketch assumes a value mapping. Zeros, negatives, NaN values, and infinities need explicit handling outside the positive logarithmic map. Different mappings or accuracy settings cannot be merged as if they were the same sketch.",
        "The value-error guarantee does not fix low sample counts. A p99 over 80 requests is intrinsically unstable. Collapsing policies can also weaken the guarantee for the region they collapse, so memory caps are part of the data-structure contract.",
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        "Suppose an API service records latencies from 1 ms to 2,000 ms and uses DDSketch with 2% relative accuracy. A 10 ms observation lands in a narrow bucket whose representative is close to 10 ms. A 1,000 ms observation lands in a much wider bucket, but the bucket is still close in percentage terms.",
        "If the merged fleet sketch reports p99 as 500 ms, the intended promise is value-relative: the true p99 is near 500 ms within the configured percentage, assuming the sketch did not collapse that region and the window has enough traffic to make p99 meaningful.",
      ],
    },
    {
      heading: 'Why relative error matters',
      paragraphs: [
        "Latency is usually judged on a ratio scale. A 5 ms miss around a 10 ms endpoint is a serious error; a 5 ms miss around a 2 second endpoint is noise. Equal-width buckets spend the same resolution everywhere, even though operators do not read all regions of the distribution the same way.",
        "DDSketch puts the precision budget where it matches that ratio view. Buckets are tight near zero and widen as values grow. The dashboard can then make a statement such as p99 is within 2% of the true p99 value, rather than only saying the answer came from a nearby rank.",
        "This is especially useful for long-tailed systems. One sketch can represent fast cache hits, ordinary database calls, slow retries, and rare timeouts without choosing a single millisecond bucket width that is wrong for most of the range.",
      ],
    },
    {
      heading: 'Zero and negative values',
      paragraphs: [
        "The logarithmic map is naturally for positive values. Real metrics pipelines still see zeros, negative values, NaN, and infinity. A production implementation must define that boundary before merge and query semantics are trusted.",
        "Common designs keep a separate zero count, use a mirrored mapping for negative values when the metric can be negative, and reject or count invalid floating-point values outside the quantile sketch. Latency usually should be nonnegative, so a negative latency observation is often a data-quality bug rather than a sketch input.",
        "This edge handling is not cosmetic. If one agent drops zeros and another stores them in a special bucket, merged percentiles are no longer describing the same distribution. Sketch compatibility includes value-domain policy, not only alpha.",
      ],
    },
    {
      heading: 'Store choices',
      paragraphs: [
        "The mapping turns values into integer bucket indexes. The store decides how those index-to-count pairs are kept. A dense array is fast when occupied bucket indexes are near each other. A sparse map saves memory when the range is wide and most buckets are empty.",
        "Some systems use collapsing stores to enforce a maximum number of buckets. Collapsing is an explicit accuracy trade. If the store collapses high buckets, tail accuracy changes. If it collapses low buckets, small-value accuracy changes. The memory cap becomes part of the observable sketch contract.",
        "For a hot metrics agent, the store is often the performance bottleneck rather than the mathematical idea. Updates should avoid allocation where possible, merges should be linear in occupied buckets, and serialization should preserve the bucket indexes exactly.",
      ],
    },
    {
      heading: 'Merge and versioning rules',
      paragraphs: [
        "A merge is valid only when the sketches share the same mapping and compatible policies. The relative accuracy, index calculation, zero handling, negative handling, collapsing policy, and serialization version all affect whether bucket counts mean the same thing.",
        "When those policies match, merge is just addition of counts by bucket index. That is why DDSketch is attractive for agents, collectors, and rollup jobs. A local process can summarize millions of samples, send a compact sketch, and the backend can still compute a percentile over the union.",
        "When those policies do not match, forcing a merge creates a false distribution. A careful system should reject the merge, convert through a documented path with known accuracy loss, or keep the sketches separate.",
      ],
    },
    {
      heading: 'Choosing alpha',
      paragraphs: [
        "A smaller alpha gives tighter value accuracy and more buckets across the same value range. A larger alpha gives a smaller sketch and coarser answers. There is no universal best setting because the right trade depends on alert thresholds, traffic volume, retention, and cardinality.",
        "For SLO dashboards, choose alpha by asking what answer would change an operator decision. If a 200 ms p99 alert threshold is meaningful, a reported value that can drift by 10% may be too coarse. For broad capacity dashboards, a coarser value may be acceptable.",
        "Also remember that sketch error is not the only uncertainty. A p99 over a tiny window can jump because there are too few samples. DDSketch preserves a distribution compactly; it does not make sparse data statistically stable.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study Greenwald-Khanna and KLL to see rank-error quantile sketches. Study t-digest for a tail-weighted centroid design used in latency dashboards. Study Tail Latency and p99 Thinking before using any sketch for alerts, because the aggregation plan can be wrong even when the sketch is implemented correctly.",
        "Primary sources: the DDSketch PVLDB paper, Datadog's engineering write-up on accurate percentiles, and the Datadog sketches implementations.",
      ],
    },
  ],
};
