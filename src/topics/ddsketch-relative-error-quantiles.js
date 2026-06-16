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
      heading: 'What it is',
      paragraphs: [
        'DDSketch is a mergeable quantile sketch with relative-error guarantees on returned values. It is designed for long-tailed distributions such as latency, where a small rank error can correspond to a large value error.',
        'The structure stores counts in logarithmically spaced buckets. Values are mapped to representatives whose relative distance from the true value is bounded by a configured accuracy parameter. Merging sketches means adding counts for matching buckets.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a relative accuracy target. Build a logarithmic mapping from positive values to bucket indices so every value in a bucket is close to the bucket representative by that relative factor. On update, increment one bucket count. To query a quantile, walk cumulative counts until the requested rank is reached and return that bucket representative.',
        'Because every sketch uses the same bucket mapping, distributed merge is straightforward: add counts bucket by bucket. Dense implementations are fast when the bucket range is compact; sparse or collapsing variants control memory when the value range is wide.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'DDSketch spends memory on buckets covering the value range it sees. The number of buckets grows with the logarithm of the ratio between maximum and minimum tracked values, not linearly with the number of samples. The contract is value-relative error, which differs from GK, KLL, and many rank-error sketches.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An APM system tracks endpoint latency across thousands of services. Each agent emits DDSketch distributions tagged by service, resource, status, and version. The backend merges distributions by tag and time window, then computes p50, p95, p99, and histograms without retaining every span latency. This avoids averaging percentiles and keeps p99 rollups meaningful.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'DDSketch is not an exact histogram. Bucket mapping and collapsing policy matter. If values include zeros or negatives, the implementation needs explicit handling for a zero bucket and negative stores. Also remember that relative value error is not the same as statistical confidence; low traffic windows can still make p99 noisy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DDSketch PVLDB paper at https://www.vldb.org/pvldb/vol12/p2195-masson.pdf, Datadog engineering write-up at https://www.datadoghq.com/blog/engineering/computing-accurate-percentiles-with-ddsketch/, and DataDog sketches-go repository at https://github.com/DataDog/sketches-go. Study Tail Latency & p99 Thinking, t-digest Quantile Sketch, KLL Quantile Sketch, Greenwald-Khanna Quantile Summary, and Distributed Tracing next.',
      ],
    },
  ],
};
