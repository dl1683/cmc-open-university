// KLL quantile sketch: randomized compaction levels for compact mergeable quantiles.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kll-quantile-sketch',
  title: 'KLL Quantile Sketch',
  category: 'Data Structures',
  summary: 'A compact randomized quantile sketch: fill small buffers, sort and compact them, promote weighted survivors, and merge summaries across shards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compaction levels', 'merge rollup'], defaultValue: 'compaction levels' },
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

function levelGraph(title) {
  return graphState({
    nodes: [
      { id: 'stream', label: 'in', x: 0.5, y: 3.5, note: 'stream' },
      { id: 'l0', label: 'L0', x: 2.6, y: 3.5, note: 'w1' },
      { id: 'sort', label: 'sort', x: 4.7, y: 5.7, note: 'full' },
      { id: 'compact', label: 'compact', x: 4.7, y: 1.3, note: 'half' },
      { id: 'l1', label: 'L1', x: 6.8, y: 3.5, note: 'w2' },
      { id: 'l2', label: 'L2', x: 8.2, y: 3.5, note: 'w4' },
      { id: 'rank', label: 'rank', x: 9.5, y: 3.5, note: 'query' },
    ],
    edges: [
      { id: 'e-stream-l0', from: 'stream', to: 'l0', weight: '' },
      { id: 'e-l0-sort', from: 'l0', to: 'sort', weight: '' },
      { id: 'e-sort-compact', from: 'sort', to: 'compact', weight: '' },
      { id: 'e-compact-l1', from: 'compact', to: 'l1', weight: '' },
      { id: 'e-l1-l2', from: 'l1', to: 'l2', weight: '' },
      { id: 'e-l2-rank', from: 'l2', to: 'rank', weight: '' },
    ],
  }, { title });
}

function mergeGraph(title) {
  return graphState({
    nodes: [
      { id: 'hostA', label: 'host A', x: 0.8, y: 1.8, note: 'KLL' },
      { id: 'hostB', label: 'host B', x: 0.8, y: 3.5, note: 'KLL' },
      { id: 'hostC', label: 'host C', x: 0.8, y: 5.2, note: 'KLL' },
      { id: 'concat', label: 'concat', x: 3.2, y: 3.5, note: 'levels' },
      { id: 'recompact', label: 'compact', x: 5.5, y: 3.5, note: 'same rule' },
      { id: 'global', label: 'global', x: 7.7, y: 3.5, note: 'p50,p99' },
    ],
    edges: [
      { id: 'e-a-concat', from: 'hostA', to: 'concat', weight: 'levels' },
      { id: 'e-b-concat', from: 'hostB', to: 'concat', weight: 'levels' },
      { id: 'e-c-concat', from: 'hostC', to: 'concat', weight: 'levels' },
      { id: 'e-concat-recompact', from: 'concat', to: 'recompact', weight: 'overflow' },
      { id: 'e-recompact-global', from: 'recompact', to: 'global', weight: 'query' },
    ],
  }, { title });
}

function rankPlot(title) {
  return plotState({
    axes: {
      x: { label: 'value', min: 0, max: 100 },
      y: { label: 'rank', min: 0, max: 1 },
    },
    series: [
      { id: 'cdf', label: 'KLL CDF', points: [{ x: 8, y: 0.08 }, { x: 20, y: 0.25 }, { x: 35, y: 0.45 }, { x: 52, y: 0.68 }, { x: 76, y: 0.90 }, { x: 94, y: 0.98 }] },
    ],
    markers: [
      { id: 'p50', x: 38, y: 0.5, label: 'p50' },
      { id: 'p90', x: 76, y: 0.9, label: 'p90' },
      { id: 'eps', x: 52, y: 0.72, label: '+/- rank err' },
    ],
  }, { title });
}

function* compactionLevels() {
  const bufferSize = 6;  // items in the compaction buffer
  const survivorCount = 3;  // half kept after compaction
  const levels = 3;  // L0, L1, L2

  yield {
    state: levelGraph('KLL keeps compactors at increasing weights'),
    highlight: { active: ['stream', 'l0', 'e-stream-l0'], compare: ['l1', 'l2'] },
    explanation: `KLL starts like a tiny reservoir at level 0. Incoming values fill a small buffer of ${bufferSize} items. When the buffer overflows, it sorts and compacts the buffer instead of growing forever.`,
    invariant: `Higher levels represent more original stream items per retained value across ${levels} compaction levels.`,
  };

  yield {
    state: labelMatrix(
      'Compact L0',
      [
        { id: 'a', label: '8' },
        { id: 'b', label: '13' },
        { id: 'c', label: '20' },
        { id: 'd', label: '27' },
        { id: 'e', label: '35' },
        { id: 'f', label: '44' },
      ],
      [
        { id: 'sorted', label: 'sorted' },
        { id: 'keep', label: 'keep?' },
        { id: 'weight', label: 'w' },
      ],
      [
        ['8', 'drop', '1'],
        ['13', 'keep', '2'],
        ['20', 'drop', '1'],
        ['27', 'keep', '2'],
        ['35', 'drop', '1'],
        ['44', 'keep', '2'],
      ],
    ),
    highlight: { active: ['b:keep', 'd:keep', 'f:keep'], removed: ['a:keep', 'c:keep', 'e:keep'] },
    explanation: `A compaction sorts the ${bufferSize}-item buffer, randomly chooses odd or even positions, discards ${bufferSize - survivorCount} items, and promotes the kept ${survivorCount} with doubled weight. The random offset prevents systematic rank bias.`,
  };

  yield {
    state: levelGraph('Promoted survivors move to the next level'),
    highlight: { active: ['sort', 'compact', 'l1', 'e-sort-compact', 'e-compact-l1'], found: ['l2'] },
    explanation: `The kept ${survivorCount} values now each stand for two original values. If level 1 overflows, the same idea repeats and survivors move to level 2 with weight ${2 ** 2}.`,
  };

  yield {
    state: rankPlot('Quantile queries read weighted retained items'),
    highlight: { active: ['cdf', 'p50', 'p90'], compare: ['eps'] },
    explanation: `To query a quantile, sort retained items by value and walk cumulative weights across all ${levels} levels. The guarantee is about rank error: the returned value has a rank close to the requested rank.`,
  };
}

function* mergeRollup() {
  const hostCount = 3;  // hosts A, B, C
  const sketchTypes = 4;  // GK, KLL, t-dig, DDS

  yield {
    state: mergeGraph('Local KLL sketches merge by combining levels'),
    highlight: { active: ['hostA', 'hostB', 'hostC', 'concat', 'e-a-concat', 'e-b-concat', 'e-c-concat'], compare: ['recompact'] },
    explanation: `Each of ${hostCount} hosts can build a local sketch. A coordinator concatenates same-weight levels and recompacts any level that becomes too full. Raw values do not have to cross the network.`,
  };

  yield {
    state: labelMatrix(
      'Shard rollup',
      [
        { id: 'a', label: 'host A' },
        { id: 'b', label: 'host B' },
        { id: 'c', label: 'host C' },
        { id: 'g', label: 'global' },
      ],
      [
        { id: 'items', label: 'items' },
        { id: 'kept', label: 'kept' },
        { id: 'query', label: 'query' },
      ],
      [
        ['2M', '240', 'p95'],
        ['3M', '260', 'p95'],
        ['1M', '190', 'p95'],
        ['6M', '410', 'p95'],
      ],
    ),
    highlight: { active: ['a:kept', 'b:kept', 'c:kept'], found: ['g:query'] },
    explanation: `The global sketch merging ${hostCount} shards is much smaller than the raw traffic. Its size is governed by accuracy parameters and compaction levels, not by the total event count.`,
  };

  yield {
    state: mergeGraph('Recompaction restores the size budget'),
    highlight: { active: ['concat', 'recompact', 'e-concat-recompact'], found: ['global', 'e-recompact-global'] },
    explanation: `Mergeability is the production feature. Distributed databases and telemetry systems can roll sketches from ${hostCount} hosts up per machine, partition, time bucket, and region.`,
  };

  yield {
    state: labelMatrix(
      'Quantile sketch choice',
      [
        { id: 'gk', label: 'GK' },
        { id: 'kll', label: 'KLL' },
        { id: 'td', label: 't-dig' },
        { id: 'dds', label: 'DDS' },
      ],
      [
        { id: 'error', label: 'error' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['det rank', 'audit'],
        ['rand rank', 'compact'],
        ['tail rank', 'latency'],
        ['rel value', 'scale'],
      ],
    ),
    highlight: { active: ['kll:error', 'kll:fit'], found: ['dds:fit'], compare: ['gk:fit'] },
    explanation: `KLL is a strong default among ${sketchTypes} common sketch types when you need compact mergeable rank-error quantiles. DDSketch is stronger when the product promise is relative error in the returned value.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compaction levels') yield* compactionLevels();
  else if (view === 'merge rollup') yield* mergeRollup();
  else throw new InputError('Pick a KLL view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each level as a buffer whose retained items represent different amounts of stream mass. Active nodes are filling, sorting, or compacting; found nodes are survivors promoted to a higher level.',
        { type: 'callout', text: 'KLL keeps rank information by randomly compacting sorted pairs, so every promoted item represents more stream mass without storing the raw stream.' },
        'The safe inference rule is that promoted items carry weight. A level-1 item stands for two raw values, a level-2 item stands for four, and quantile queries walk weighted retained values by rank.',
        {type: 'image', src: './assets/gifs/kll-quantile-sketch.gif', alt: 'Animated walkthrough of the kll quantile sketch visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A quantile is a value at a rank in sorted data. The median is rank 0.50, p90 is rank 0.90, and p99 is rank 0.99.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Quantilsregression.svg', alt: 'Quantile curves over a scatter plot', caption: 'Quantile curves show that a rank target is a position in the distribution, not a guarantee about absolute value distance. Source: https://commons.wikimedia.org/wiki/File:Quantilsregression.svg.' },
        'Exact quantiles require storing all values or maintaining an exact order structure. Telemetry systems, stream processors, and distributed databases need percentiles over billions of events without shipping every raw value to one machine.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The exact approach stores every value, sorts the list, and reads the value at floor(q * n). For one million latencies, p90 is the 900,000th value after sorting.',
        'This is correct and simple when the data fits on one machine. It fails when the stream is unbounded, when memory is fixed, or when each shard must summarize locally before a global rollup.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is memory and movement, not the definition of a percentile. A system that sees ten billion events per day cannot keep all raw samples in dashboard memory.',
        'A plain random sample is smaller but gives noisy tails. A deterministic eviction rule can bias ranks, and a non-mergeable summary is weak in a distributed system because the coordinator still needs raw values.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'KLL stores a weighted sketch of rank order. When a buffer fills, it sorts values, randomly keeps either even or odd positions, discards the rest, and promotes survivors with doubled weight.',
        'Random parity removes systematic high or low bias. Growing capacities across levels keep accumulated rank error bounded while letting memory stay independent of stream length.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Level 0 receives raw values at weight 1. When it overflows, KLL sorts the buffer and compacts adjacent sorted pairs by keeping one side chosen with a random offset.',
        'The survivors move to level 1 with weight 2. If level 1 overflows, the same rule promotes weight-4 survivors to level 2, and the pattern continues upward.',
        'To answer a quantile query, gather all retained items, sort them by value, and walk cumulative weights until the target rank is reached. To merge sketches, concatenate matching levels and recompact overflow with the same rule.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each compaction replaces sorted pairs with one representative. Keeping lower items every time would bias ranks low, and keeping upper items every time would bias ranks high.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Normal_Distribution_CDF.svg', alt: 'Cumulative distribution function curves for normal distributions', caption: 'A CDF makes the sketch contract visible: KLL controls rank position on the vertical axis, not numeric distance along the horizontal value axis. Source: https://commons.wikimedia.org/wiki/File:Normal_Distribution_CDF.svg.' },
        'Randomly choosing parity makes each compaction error zero in expectation. The level capacity schedule limits how those bounded random errors accumulate, giving an epsilon rank-error guarantee with failure probability delta.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space is O(1/epsilon * log log(1/delta)) for the KLL sketch, independent of stream length n. Most inserts append to level 0, so insertion is O(1) amortized, with occasional sorting when a compactor overflows.',
        'Doubling the stream does not double memory. Tightening epsilon from 0.01 to 0.005 roughly doubles the retained-item budget because the user is asking for half the rank error.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'KLL fits approximate SQL percentile functions, metrics rollups, stream processors, and distributed storage engines. Each host can keep a local sketch and send only compact levels to a coordinator.',
        'The common access pattern is many inserts and occasional percentile reads. A dashboard can merge sketches by service, route, region, and time bucket without rereading raw events.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'KLL controls rank error, not value error. If latencies jump from 50 ms to 500 ms near p99, a small rank error can produce a large value difference.',
        'It is also randomized and specialized. Use Greenwald-Khanna when deterministic rank certificates matter, and use DDSketch when the contract is relative error in the returned value rather than error in rank.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose level 0 capacity is 6 and the stream values are 8, 13, 20, 27, 35, and 44. The buffer fills, sorts to the same order, and randomly chooses odd positions this time.',
        'Keeping odd positions gives 13, 27, and 44. Those three values move to level 1 with weight 2, so they represent the six raw values that were compacted.',
        'If the next six values are 50, 55, 60, 70, 80, and 90, another compaction may keep 50, 60, and 80 at weight 2. A p50 query now sorts retained weighted items and walks cumulative weight until reaching rank 6 of 12.',
        'If the walk crosses rank 6 at value 50 or 55-like territory, the answer is a rank approximation. The sketch is not promising that the numeric value is close in milliseconds; it is promising that the returned rank is close.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Karnin, Lang, and Liberty, Optimal Quantile Approximation in Streams, 2016, https://arxiv.org/abs/1603.05346. The paper proves the optimal comparison-based space bound for randomized quantile sketches.',
        'Study Greenwald-Khanna first for deterministic rank summaries, then t-digest for practical tail-focused dashboards, and DDSketch for relative value error. Apache DataSketches is the production reference family for KLL implementations and merge APIs.',
      ],
    },
  ],
};
