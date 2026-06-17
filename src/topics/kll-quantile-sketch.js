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
  yield {
    state: levelGraph('KLL keeps compactors at increasing weights'),
    highlight: { active: ['stream', 'l0', 'e-stream-l0'], compare: ['l1', 'l2'] },
    explanation: 'KLL starts like a tiny reservoir at level 0. Incoming values fill a small buffer. When the buffer overflows, it sorts and compacts the buffer instead of growing forever.',
    invariant: 'Higher levels represent more original stream items per retained value.',
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
    explanation: 'A compaction sorts the buffer, randomly chooses odd or even positions, discards the other half, and promotes the kept half with doubled weight. The random offset prevents systematic rank bias.',
  };

  yield {
    state: levelGraph('Promoted survivors move to the next level'),
    highlight: { active: ['sort', 'compact', 'l1', 'e-sort-compact', 'e-compact-l1'], found: ['l2'] },
    explanation: 'The kept values now each stand for two original values. If level 1 overflows, the same idea repeats and survivors move to level 2 with weight four.',
  };

  yield {
    state: rankPlot('Quantile queries read weighted retained items'),
    highlight: { active: ['cdf', 'p50', 'p90'], compare: ['eps'] },
    explanation: 'To query a quantile, sort retained items by value and walk cumulative weights. The guarantee is about rank error: the returned value has a rank close to the requested rank.',
  };
}

function* mergeRollup() {
  yield {
    state: mergeGraph('Local KLL sketches merge by combining levels'),
    highlight: { active: ['hostA', 'hostB', 'hostC', 'concat', 'e-a-concat', 'e-b-concat', 'e-c-concat'], compare: ['recompact'] },
    explanation: 'Each host can build a local sketch. A coordinator concatenates same-weight levels and recompacts any level that becomes too full. Raw values do not have to cross the network.',
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
    explanation: 'The global sketch is much smaller than the raw traffic. Its size is governed by accuracy parameters and compaction levels, not by the total event count.',
  };

  yield {
    state: mergeGraph('Recompaction restores the size budget'),
    highlight: { active: ['concat', 'recompact', 'e-concat-recompact'], found: ['global', 'e-recompact-global'] },
    explanation: 'Mergeability is the production feature. Distributed databases and telemetry systems can roll sketches up per machine, partition, time bucket, and region.',
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
    explanation: 'KLL is a strong default when you need compact mergeable rank-error quantiles. DDSketch is stronger when the product promise is relative error in the returned value.',
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
      heading: 'Why approximate quantiles exist',
      paragraphs: [
        "A quantile asks for the value at a rank: the median is rank 0.50, p90 is rank 0.90, and p99 is rank 0.99. Exact quantiles are easy after the data is sorted, but streams, telemetry systems, and distributed databases often see too many values to keep.",
        "KLL is for the common case where a small rank error is acceptable. The sketch keeps a weighted summary of the stream and returns a value whose rank is close to the requested rank with high probability.",
        "This matters because quantiles are usually operational numbers. A latency p99 can drive an alert, a billing p95 can set a contract, and a storage p50 can guide capacity planning. Systems need answers that are cheap enough to compute continuously and honest enough about the error they carry.",
      ],
    },
    {
      heading: 'The exact baseline',
      paragraphs: [
        "The exact baseline stores every value, sorts the full collection, and reads the item at rank floor(q * n). For a one-million-item stream, p90 is the 900,000th item in sorted order. This is simple, exact, and hard to beat when the data fits in memory.",
        "A streaming exact version can keep a balanced tree with counts, or store all values and sort later. Both preserve the full order information. Both make memory grow with the number of observations.",
      ],
    },
    {
      heading: 'The exact wall',
      paragraphs: [
        "The wall is not comparison cost. The wall is memory and movement. A fleet that records billions of latencies per hour cannot ship raw samples to one place and sort them for every dashboard query.",
        "Simple bounded-memory substitutes do not solve the same problem. A reservoir sample keeps raw examples, but its tails can be noisy. A fixed sorted buffer must choose what to evict, and deterministic eviction can bias ranks in one direction.",
        "Distributed systems add a second wall: mergeability. If each host computes a local summary, the coordinator should be able to combine summaries without seeing raw values. A quantile sketch that cannot merge cleanly is much less useful for telemetry, SQL engines, and stream processors.",
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        "KLL keeps compactors at increasing weights. Level 0 items have weight 1. After compaction, survivors move to the next level with weight 2, then 4, then 8, and so on.",
        "The invariant is weighted rank preservation. A retained item at level j represents 2^j original stream items. Compaction may add rank error, but it must not create a one-sided drift that always pushes ranks up or down.",
        "The insight is that the sketch can throw away values if it preserves enough rank information. KLL does not promise to keep representative raw samples. It keeps a compressed, weighted view of the order distribution.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "New values enter level 0. When a level gets too full, KLL sorts that level, randomly chooses odd or even positions, drops the other positions, and promotes the kept half to the next level with doubled weight.",
        "A query gathers all retained items from all levels, sorts them by value, and walks cumulative weight until it reaches the requested rank. Merging sketches concatenates matching levels from each shard and recompacts any level that exceeds its size budget.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Each compaction replaces adjacent sorted pairs with one representative. If the sketch always kept the lower item, ranks would drift low. If it always kept the upper item, ranks would drift high. KLL chooses the parity randomly, so each pair contributes zero expected rank bias.",
        "Errors from many compactions still accumulate, so the level capacities matter. KLL chooses a compaction schedule that keeps enough items at each weight to bound total rank error with high probability while using much less space than deterministic summaries at similar accuracy.",
        "The guarantee is about rank, not about distance on the value axis. If the sorted distribution has a cliff, two neighboring ranks can have very different values. That is not a KLL bug; it is the meaning of the contract.",
      ],
    },
    {
      heading: 'Cost, memory, and merge behavior',
      paragraphs: [
        "Update cost is usually small because most inserts only append to level 0. The expensive step is compaction, which sorts an overflowing buffer and promotes half of it. That cost is amortized across many updates.",
        "Memory is controlled by the configured accuracy, not by the stream length. Lower rank error needs larger buffers and more retained weighted items. Merge cost is proportional to the retained items plus any recompaction triggered by the merged levels.",
        "Queries usually sort or merge the retained weighted items, then walk cumulative weight. Some implementations maintain enough order to make repeated queries cheaper. The engineering question is whether the sketch is write-heavy, query-heavy, or merge-heavy.",
      ],
    },
    {
      heading: 'Production use',
      paragraphs: [
        "KLL fits systems that need compact, mergeable rank-error quantiles: approximate SQL percentile functions, stream processors, metrics rollups, and per-partition summaries in distributed storage engines.",
        "The merge path is the main production advantage. Each machine can summarize local traffic, a coordinator can merge summaries by time window or region, and the raw event stream does not have to cross the network.",
        "A common telemetry design keeps one KLL sketch per service, route, status class, and time bucket. Rollup jobs merge sketches into larger windows. Dashboards query p50, p90, and p99 from the merged sketch while preserving an explicit approximation contract.",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "KLL gives a rank-error guarantee, not a value-error guarantee. On a distribution with a sharp cliff, two values with nearby ranks can be far apart in milliseconds, dollars, or bytes.",
        "It is randomized, so it is not the right sketch when an audit requires a deterministic certificate. It also is not a reservoir sample. The retained values carry weights and compaction history; treating them as ordinary samples gives misleading downstream statistics.",
        "Bad merges are another failure mode. Mixing sketches with incompatible parameters, different value transforms, or inconsistent filtering rules produces a number that looks official but no longer has the intended meaning. The sketch metadata is part of the data.",
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        "Choose the error contract before choosing the sketch. If the product says p99 latency should be within one percent in milliseconds, DDSketch may fit better. If the product says the returned value should have rank close to the requested rank, KLL is a strong default.",
        "Store sketch metadata with the payload: algorithm version, configured accuracy, value units, filters, time window, and merge lineage. Test against exact quantiles on sampled windows, but report rank error in the same language the sketch actually guarantees.",
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        "The compaction view shows the whole algorithm in miniature. Level 0 fills, the buffer is sorted, one parity of adjacent items survives, and those survivors move up with doubled weight. Higher levels represent more original stream items per retained value.",
        "The merge-rollup view shows why KLL is useful in distributed systems. Hosts do not send raw values. They send compact level summaries. The coordinator concatenates compatible levels, recompacts overflow, and answers quantile queries from the weighted retained items.",
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        "Suppose three hosts record 6,000,000 request latencies and the dashboard asks for p90. The exact answer would sort all 6,000,000 values and return the value at rank 5,400,000.",
        "With a KLL sketch configured for about 1% rank error, the returned p90 should have a true rank near that target, roughly within 60,000 ranks with high probability. If the answer is 180 ms, the promise is about where 180 ms sits in the sorted stream, not that the exact p90 value is within 1% of 180 ms.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study Greenwald-Khanna Quantile Summary to see the deterministic rank-error baseline. Study DDSketch Relative-Error Quantiles when the user-facing contract is value error rather than rank error. Study t-digest when the design goal is extra tail resolution for p95 and p99 dashboards.",
        "Primary sources: Karnin, Lang, and Liberty, Optimal Quantile Approximation in Streams, and the Apache DataSketches KLL documentation.",
      ],
    },
  ],
};
