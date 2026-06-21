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
      heading: 'How to read the animation',
      paragraphs: [
        'The compaction-levels view shows the full lifecycle of a single buffer. Values stream into level 0. When the buffer overflows, KLL sorts it, randomly picks odd or even positions, discards the rest, and promotes survivors to level 1 with doubled weight. Active nodes glow during the step they participate in; dimmed nodes show downstream levels waiting for overflow to cascade.',
        { type: 'callout', text: 'KLL keeps rank information by randomly compacting sorted pairs, so every promoted item represents more stream mass without storing the raw stream.' },
        'The merge-rollup view shows the distributed story. Three hosts hold independent KLL sketches. The coordinator concatenates matching levels, recompacts any level that exceeds its capacity, and answers quantile queries from the merged weighted items. Watch the highlighted edges to see which shard contributes to each merge step.',
        'In both views, the matrix tables show the concrete values, weights, and keep/drop decisions at each compaction. Read the weight column to verify that every promotion doubles the weight. If a level-1 buffer overflows, the same compaction rule fires again, producing level-2 items at weight 4.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A quantile asks: what value sits at a given rank in the sorted stream? The median is rank 0.50, p90 is rank 0.90, p99 is rank 0.99. These are operational numbers. A latency p99 drives an alert. A billing p95 sets a contract. A storage p50 guides capacity planning.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Quantilsregression.svg', alt: 'Quantile curves over a scatter plot', caption: 'Quantile curves show that a rank target is a position in the distribution, not a guarantee about absolute value distance. Source: https://commons.wikimedia.org/wiki/File:Quantilsregression.svg.' },
        'Exact quantiles require keeping every value and sorting. A fleet that records billions of latencies per hour cannot ship raw samples to a central node and sort them for every dashboard refresh. The question is whether you can answer "what is p99?" using a summary that fits in a few kilobytes, merges across shards, and carries an explicit error bound.',
        'KLL (Karnin, Lang, Liberty, 2016) answers yes. It keeps a compact, weighted summary of the stream and guarantees that the returned value has a rank within epsilon of the requested rank, with failure probability at most delta. The space it needs is O(1/epsilon * log log(1/delta)) -- optimal for a comparison-based quantile sketch.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The exact baseline stores every observed value, sorts the collection, and reads the item at position floor(q * n). For one million latencies, p90 is the 900,000th item in sorted order. This is simple, correct, and hard to beat when all the data fits in memory on one machine.',
        'A streaming exact version can maintain a balanced order-statistic tree or just buffer all values and sort on query. Both preserve full order information. Both grow linearly with the number of observations. Neither is mergeable -- you cannot combine two sorted arrays into a quantile answer without seeing every element.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not comparison cost. The wall is memory and network movement. A telemetry pipeline that handles 10 billion events per day cannot store all of them in RAM for a percentile query. Sorting at query time is out of the question.',
        'Simple bounded-memory substitutes do not solve the same problem. A reservoir sample keeps raw examples, but its tail estimates are noisy. A fixed sorted buffer must choose what to evict, and any deterministic eviction rule can bias ranks systematically.',
        'Distributed systems add a second wall: mergeability. If each host builds a local summary, the coordinator must combine summaries without seeing raw values. A quantile sketch that cannot merge is far less useful for SQL engines, stream processors, and cross-region dashboards. The Greenwald-Khanna summary is deterministic and mergeable, but its space bound is O(1/epsilon * log(epsilon * n)) -- it grows with the stream length. KLL breaks that dependence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'KLL maintains a stack of compactors, one per level. Level 0 receives raw stream values. Each compactor has a capacity that grows with level number. When a compactor overflows, it sorts its buffer, randomly selects either odd-indexed or even-indexed items, discards the other half, and pushes the survivors into the next level with doubled weight.',
        {
          type: 'diagram',
          label: 'Multi-level compaction with growing capacities',
          text: [
            'Stream --> [ Level 0 ] capacity k0 (smallest)',
            '              |  overflow: sort, pick parity, promote',
            '              v',
            '          [ Level 1 ] capacity k1 > k0',
            '              |  overflow: same rule, weight doubles again',
            '              v',
            '          [ Level 2 ] capacity k2 > k1',
            '              |',
            '              v',
            '          [ Level H ] capacity kH (largest)',
            '',
            'Weight at level j = 2^j',
            'Capacity grows with j so higher levels compact less often.',
            'Total retained items = k0 + k1 + ... + kH = O(1/eps * log log(1/delta))',
          ].join('\n'),
        },
        'To query a quantile, gather all retained items from every level, sort them by value, and walk cumulative weight until the running total reaches the target rank. The answer is the value where you stop. The rank error is bounded by epsilon with probability at least 1 - delta.',
        'Merging two KLL sketches concatenates corresponding levels, then recompacts any level that exceeds its capacity. This is the same compaction rule used during ingestion, so the merged sketch has the same error guarantee. No raw values cross the network -- only the compact level arrays.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each compaction replaces adjacent sorted pairs with one representative. If the sketch always kept the lower item, ranks would drift low. If it always kept the upper item, ranks would drift high. KLL chooses the parity randomly, so each pair contributes zero expected rank bias. The rank error from a single compaction is a bounded random variable.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Normal_Distribution_CDF.svg', alt: 'Cumulative distribution function curves for normal distributions', caption: 'A CDF makes the sketch contract visible: KLL controls rank position on the vertical axis, not numeric distance along the horizontal value axis. Source: https://commons.wikimedia.org/wiki/File:Normal_Distribution_CDF.svg.' },
        'Errors from successive compactions accumulate, but the level capacities are chosen to keep the total variance small. Higher levels have larger buffers, so they compact less frequently and contribute less cumulative error. The capacity schedule is tuned so the total rank error across all levels stays below epsilon with probability at least 1 - delta.',
        'The key result from the paper: this schedule achieves space O(1/epsilon * log log(1/delta)), which is optimal for any comparison-based streaming quantile algorithm. The double-log in the failure probability is the surprising part -- it means you can push delta very small (say 10^-6) with almost no extra space beyond what epsilon already demands.',
        'The guarantee is about rank, not about value distance. If the sorted distribution has a cliff -- say latencies jump from 50ms to 500ms between rank 0.98 and 0.99 -- two nearby ranks map to very different values. That is not a KLL bug. It is the contract: rank error, not value error.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'Notes'],
          rows: [
            ['Insert', 'O(1) amortized', 'Append to level 0; compaction fires rarely'],
            ['Compaction', 'O(k log k)', 'Sort the overflowing buffer of size k, promote k/2 items'],
            ['Query', 'O(S log S)', 'S = total retained items; sort by value, walk cumulative weight'],
            ['Merge', 'O(S)', 'Concatenate levels, recompact overflow; same cost model as insert'],
            ['Space', 'O(1/eps * log log(1/delta))', 'Independent of stream length n'],
          ],
        },
        'Most inserts just append to the level-0 buffer. Compaction only triggers when a buffer overflows, and higher levels overflow exponentially less often. The amortized cost per insert is O(1). When compaction does fire, the dominant cost is sorting the buffer.',
        'Memory is controlled by the accuracy parameters (epsilon, delta), not by stream length. A sketch configured for 1% rank error with delta = 10^-4 uses a few hundred to a few thousand retained items regardless of whether the stream has one million or one trillion values. Doubling the stream adds zero memory.',
        {
          type: 'table',
          headers: ['Sketch', 'Space', 'Error type', 'Mergeable', 'Notes'],
          rows: [
            ['GK (Greenwald-Khanna)', 'O(1/eps * log(eps*n))', 'Deterministic rank', 'Yes (complex)', 'Space grows with stream length'],
            ['KLL', 'O(1/eps * log log(1/delta))', 'Randomized rank', 'Yes (simple)', 'Optimal space; stream-length independent'],
            ['t-digest', 'O(1/delta) heuristic', 'Adaptive rank (tails tighter)', 'Yes', 'No formal worst-case bound; good tail accuracy in practice'],
            ['DDSketch', 'O(1/alpha * log(max/min))', 'Relative value error', 'Yes', 'Error is on the value axis, not the rank axis'],
          ],
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'KLL is the default choice when you need compact, mergeable, rank-error quantiles with a formal guarantee. It fits approximate SQL percentile functions, stream processors (Flink, Spark), metrics rollup pipelines, and per-partition summaries in distributed storage engines.',
        'The merge path is the main production advantage. Each machine summarizes local traffic into a KLL sketch. A coordinator merges sketches by time window, region, or service. The raw event stream never crosses the network. Apache DataSketches provides the reference implementation used in production at scale -- it is integrated into Druid, Hive, Pig, and Spark.',
        'A common telemetry design keeps one KLL sketch per (service, route, status class, time bucket). Rollup jobs merge sketches into larger windows. Dashboards query p50, p90, and p99 from the merged sketch. The approximation contract is explicit: every answer carries a stated rank-error bound.',
        'The fully mergeable property also means sketches can be stored as column values in a database. A query like "SELECT approx_percentile(latency, 0.99) FROM requests WHERE region = \'us-east\' GROUP BY hour" merges pre-built sketches instead of scanning raw rows.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'KLL guarantees rank error, not value error. On a distribution with a sharp cliff -- latencies that jump from 50ms to 500ms between rank 0.98 and 0.99 -- the returned value for p99 could be either 50ms or 500ms despite having a rank very close to 0.99. If the product promise is "p99 latency within 1% of the true value," DDSketch is a better fit because its error bound is on the value axis.',
        'KLL is randomized. It is not the right sketch when an audit requires a deterministic certificate of correctness. Greenwald-Khanna provides deterministic rank-error bounds, though at higher space cost.',
        'The retained items are not a random sample. They carry weights and compaction history. Feeding them into a downstream estimator that assumes uniform sampling -- a mean, a variance, a histogram -- produces misleading results. The sketch answers rank queries. It is not a general-purpose sample.',
        'Bad merges are a silent failure mode. Mixing sketches with incompatible accuracy parameters, different value transforms (raw vs. log-scaled), or inconsistent pre-filters produces an answer that looks authoritative but violates the stated guarantee. Sketch metadata -- algorithm version, epsilon, delta, value units, filter predicates, time window -- must travel with the payload.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'Primary source: Karnin, Lang, and Liberty, "Optimal Quantile Approximation in Streams" (FOCS 2016). The paper proves the O(1/epsilon * log log(1/delta)) space bound is optimal for comparison-based streaming quantile sketches. Implementation reference: Apache DataSketches KLL documentation and Java/C++/Python libraries (datasketches.apache.org).',
        },
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Compaction step: the core of KLL',
            'function compact(buffer) {',
            '  buffer.sort((a, b) => a.value - b.value);',
            '  const parity = Math.random() < 0.5 ? 0 : 1;  // random offset',
            '  const survivors = [];',
            '  for (let i = parity; i < buffer.length; i += 2) {',
            '    survivors.push({',
            '      value: buffer[i].value,',
            '      weight: buffer[i].weight * 2,  // doubled weight',
            '    });',
            '  }',
            '  return survivors;  // promote to next level',
            '}',
          ].join('\n'),
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Greenwald-Khanna Quantile Summary to see the deterministic rank-error baseline and understand why its space depends on stream length.',
            'Alternative: study DDSketch Relative-Error Quantiles when the user-facing contract is "returned value within alpha% of the true value" rather than "returned rank within epsilon of the true rank."',
            'Complement: study t-digest when the design goal is tighter tail accuracy for p95/p99 dashboards, at the cost of weaker formal guarantees.',
            'Production case: Apache DataSketches KLL integration in Apache Druid for real-time approximate percentile queries over billions of rows.',
          ],
        },
      ],
    },
  ],
};
