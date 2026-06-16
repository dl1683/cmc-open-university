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
      heading: 'What it is',
      paragraphs: [
        'KLL is a compact randomized quantile sketch. It keeps small buffers at increasing weights, compacts full buffers by keeping half the sorted values, and promotes those survivors to higher levels. The result is a mergeable summary of a stream distribution.',
        'This page belongs beside Greenwald-Khanna Quantile Summary, t-digest Quantile Sketch, DDSketch Relative-Error Quantiles, Reservoir Sampling, and HyperLogLog. It is another example of a bounded-memory streaming structure whose local summaries can become global summaries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Level 0 receives raw stream items with weight 1. When a level fills, it sorts that buffer, chooses odd or even positions at random, discards the other half, and promotes the survivors to the next level with doubled weight. Higher levels compact less frequent but heavier items.',
        'A quantile query sorts the retained weighted items and walks cumulative weight until it reaches the requested rank. Merging sketches concatenates levels from multiple sketches and recompacts levels that overflow.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'KLL achieves strong space efficiency for rank-error quantile approximation. The randomness is part of the contract: it prevents consistent bias from always keeping the same side during compaction. Lower rank error means larger buffers and more retained items.',
        'The guarantee is rank error, not direct value error. For smooth distributions this is often good enough. For highly skewed latency distributions, a small rank error may still produce a large value error, which is where DDSketch or tail-specialized sketches enter.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A stream processor tracks approximate p50, p90, and p99 request sizes by endpoint. Each worker updates a KLL sketch for its partition. Every minute, coordinators merge sketches into endpoint-level and fleet-level summaries. Dashboards can query quantiles without shipping all events or retaining raw samples forever.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'KLL is not a reservoir sample. Retained values have weights and compaction history. It is also not automatically the best latency-alert sketch; rank-error and value-error guarantees answer different operational questions. Finally, merge settings must be compatible across shards if the rollup is meant to preserve the guarantee.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Karnin, Lang, and Liberty, Optimal Quantile Approximation in Streams, at https://arxiv.org/abs/1603.05346, and Apache DataSketches KLL documentation at https://datasketches.apache.org/docs/KLL/KLLSketch.html. Study Greenwald-Khanna Quantile Summary for the deterministic predecessor, DDSketch Relative-Error Quantiles for production relative-error percentiles, and t-digest Quantile Sketch for tail-weighted centroids.',
      ],
    },
  ],
};
