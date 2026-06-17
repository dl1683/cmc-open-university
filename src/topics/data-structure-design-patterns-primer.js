// A capstone primer that links advanced data structures by recurring design
// patterns: locality, indirection, summaries, persistence, and precomputation.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'data-structure-design-patterns-primer',
  title: 'Data Structure Design Patterns Primer',
  category: 'Concepts',
  summary: 'A cross-linking primer for advanced structures: locality, indirection, summaries, persistence, approximation, and precomputation as reusable design moves.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pattern map', 'tradeoff audit'], defaultValue: 'pattern map' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* patternMap() {
  yield {
    state: graphState({
      nodes: [
        { id: 'locality', label: 'locality', x: 0.8, y: 2.8, note: 'bytes' },
        { id: 'summary', label: 'summary', x: 2.7, y: 2.8, note: 'shrink' },
        { id: 'precompute', label: 'precompute', x: 4.8, y: 2.8, note: 'repeat' },
        { id: 'version', label: 'version', x: 6.9, y: 2.8, note: 'history' },
        { id: 'approx', label: 'approx', x: 8.8, y: 2.8, note: 'bounded error' },
      ],
      edges: [
        { id: 'e-locality-summary', from: 'locality', to: 'summary', weight: '' },
        { id: 'e-summary-precompute', from: 'summary', to: 'precompute', weight: '' },
        { id: 'e-precompute-version', from: 'precompute', to: 'version', weight: '' },
        { id: 'e-version-approx', from: 'version', to: 'approx', weight: '' },
      ],
    }, { title: 'Five reusable moves behind advanced structures' }),
    highlight: { active: ['locality', 'summary', 'precompute'], found: ['version', 'approx'] },
    explanation: 'Advanced structures usually come from a reusable move: change layout, summarize state, precompute a query shape, preserve versions, or accept bounded error.',
  };

  yield {
    state: labelMatrix(
      'Reusable design moves',
      [
        { id: 'locality', label: 'local' },
        { id: 'summary', label: 'sum' },
        { id: 'precompute', label: 'pre' },
      ],
      [
        { id: 'question', label: 'ask' },
        { id: 'example', label: 'ex' },
      ],
      [
        ['bytes?', 'Swiss'],
        ['shrink?', 'FM'],
        ['repeat?', 'Pinot'],
      ],
    ),
    highlight: { active: ['locality:example', 'summary:example'], found: ['precompute:example'] },
    explanation: 'The same move appears in many topics: SwissTable is a locality lesson, FM-index is a summary lesson, and Pinot star-tree is a precomputation lesson.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'problem', label: 'problem', x: 0.8, y: 2.8, note: 'workload' },
        { id: 'shape', label: 'shape', x: 2.5, y: 2.8, note: 'query/update' },
        { id: 'pattern', label: 'pattern', x: 4.2, y: 2.8, note: 'choose move' },
        { id: 'structure', label: 'structure', x: 6.2, y: 2.8, note: 'data layout' },
        { id: 'system', label: 'system', x: 8.2, y: 2.8, note: 'case study' },
      ],
      edges: [
        { id: 'e-problem-shape', from: 'problem', to: 'shape', weight: '' },
        { id: 'e-shape-pattern', from: 'shape', to: 'pattern', weight: '' },
        { id: 'e-pattern-structure', from: 'pattern', to: 'structure', weight: '' },
        { id: 'e-structure-system', from: 'structure', to: 'system', weight: '' },
      ],
    }, { title: 'Design starts from workload shape, not names' }),
    highlight: { active: ['shape', 'pattern'], found: ['structure', 'system'] },
    explanation: 'The question is not "which famous structure do I know?" It is "what shape of work repeats, and what invariant would make that work cheap?"',
    invariant: 'A data structure is a workload-specific invariant with an update cost.',
  };

  yield {
    state: labelMatrix(
      'Pattern to topic routes',
      [
        { id: 'layout', label: 'layout' },
        { id: 'range', label: 'range' },
        { id: 'text', label: 'text' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'starter', label: 'starter' },
        { id: 'advanced', label: 'advanced' },
      ],
      [
        ['B-tree', 'SwissTable'],
        ['segment tree', 'fractional'],
        ['suffix array', 'FM-index'],
        ['LRU', 'SIEVE/S3'],
      ],
    ),
    highlight: { found: ['layout:advanced', 'text:advanced', 'cache:advanced'] },
    explanation: 'This primer is a map through the repo. Each advanced topic is easier if you first name the pattern it amplifies from simpler material.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'query speed gained', min: 0, max: 10 }, y: { label: 'update/storage cost paid', min: 0, max: 10 } },
      series: [
        { id: 'points', label: 'design moves', points: [
          { x: 8, y: 7 }, { x: 6, y: 2 }, { x: 4, y: 4 }, { x: 9, y: 8 }, { x: 5, y: 1 },
        ] },
      ],
      markers: [
        { id: 'pinot', x: 9, y: 8, label: 'pre-agg' },
        { id: 'swiss', x: 6, y: 2, label: 'layout' },
        { id: 'filter', x: 5, y: 1, label: 'approx' },
      ],
    }),
    highlight: { active: ['points'], found: ['pinot', 'swiss', 'filter'] },
    explanation: 'Every design move buys speed somewhere and pays somewhere else. The engineering question is whether the workload spends more often on the path you made cheap.',
  };
}

function* tradeoffAudit() {
  yield {
    state: labelMatrix(
      'Before choosing a structure',
      [
        { id: 'ops', label: 'ops' },
        { id: 'dist', label: 'dist' },
        { id: 'bytes', label: 'bytes' },
        { id: 'error', label: 'error' },
        { id: 'change', label: 'change' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['query/update mix?', 'wrong cost'],
        ['skew/heavy tails?', 'bad average'],
        ['cache lines?', 'pointer chase'],
        ['false positives ok?', 'bad answer'],
        ['versions needed?', 'lost history'],
      ],
    ),
    highlight: { found: ['ops:ask', 'dist:ask', 'bytes:ask', 'error:ask', 'change:ask'] },
    explanation: 'The practical audit starts before code. Name operation mix, distribution, memory layout, error tolerance, and versioning needs before choosing the structure.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'exact', label: 'exact', x: 0.9, y: 2.8, note: 'truth' },
        { id: 'approx', label: 'approx', x: 2.6, y: 2.8, note: 'cheap' },
        { id: 'static', label: 'static', x: 4.3, y: 3.5, note: 'build once' },
        { id: 'dynamic', label: 'dynamic', x: 4.3, y: 2.1, note: 'updates' },
        { id: 'local', label: 'local', x: 6.2, y: 2.8, note: 'CPU' },
        { id: 'remote', label: 'remote', x: 8.1, y: 2.8, note: 'system' },
      ],
      edges: [
        { id: 'e-exact-approx', from: 'exact', to: 'approx', weight: '' },
        { id: 'e-approx-static', from: 'approx', to: 'static', weight: '' },
        { id: 'e-approx-dynamic', from: 'approx', to: 'dynamic', weight: '' },
        { id: 'e-static-local', from: 'static', to: 'local', weight: '' },
        { id: 'e-dynamic-local', from: 'dynamic', to: 'local', weight: '' },
        { id: 'e-local-remote', from: 'local', to: 'remote', weight: '' },
      ],
    }, { title: 'Tradeoffs compound across levels' }),
    highlight: { active: ['approx', 'static', 'dynamic'], found: ['local', 'remote'] },
    explanation: 'A local data-structure choice often becomes a system behavior: false positives affect storage IO, cache policy affects latency, and pre-aggregation affects freshness.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'index', label: 'index' },
        { id: 'cache', label: 'cache' },
        { id: 'text', label: 'text' },
        { id: 'graph', label: 'graph' },
      ],
      [
        { id: 'smell', label: 'smell' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['too broad', 'predicate data'],
        ['scan poison', 'admission'],
        ['updates slow', 'piece/rope'],
        ['frontier huge', 'summaries'],
      ],
    ),
    highlight: { found: ['index:fix', 'cache:fix', 'text:fix'] },
    explanation: 'Good design often starts by naming the failure mode of the simple structure, then adding the smallest invariant that removes it.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'implementation complexity', min: 0, max: 10 }, y: { label: 'operational risk', min: 0, max: 10 } },
      series: [
        { id: 'frontier', label: 'design frontier', points: [{ x: 1, y: 1 }, { x: 3, y: 2 }, { x: 5, y: 4 }, { x: 7, y: 7 }, { x: 9, y: 9 }] },
      ],
      markers: [
        { id: 'simple', x: 2, y: 2, label: 'simple' },
        { id: 'fancy', x: 8, y: 8, label: 'fancy' },
        { id: 'fit', x: 5, y: 3.5, label: 'fit' },
      ],
    }),
    highlight: { active: ['frontier'], found: ['fit'], compare: ['fancy'] },
    explanation: 'The best structure is not the cleverest structure. It is the simplest one that makes the dominant workload cheap and leaves enough observability to know when that assumption stops holding.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pattern map') yield* patternMap();
  else if (view === 'tradeoff audit') yield* tradeoffAudit();
  else throw new InputError('Pick a data-structure design-pattern view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        `This primer exists because advanced data structures can look like a long shelf of unrelated names. SwissTable, FM-index, wavelet tree, segment tree beats, radix heap, roaring bitmap, piece table, and star-tree index seem separate until you ask what design move each one repeats.`,
        `The useful question is not "what is this structure called?" The useful question is: what invariant makes the important operation cheap, and what cost does that invariant add? Once you learn that question, the curriculum becomes a map. New structures become variations on locality, summaries, precomputation, indirection, persistence, approximation, and workload shape.`,
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The obvious approach is to memorize a catalog: arrays are O(1), heaps are O(log n), hash tables are expected O(1), B-trees are for databases, Bloom filters are approximate. That is a decent starting list, but it does not teach design. It does not tell you why one structure fits a workload and another becomes a liability.`,
        `A second obvious approach is to choose the most advanced structure you know. That usually makes systems worse. A star-tree without stable query shapes wastes storage. A sketch where exactness is required gives wrong answers. A clever cache policy before measuring reuse hides the real bottleneck under complexity.`,
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        `The wall is workload shape. Two structures with the same asymptotic lookup time can behave differently because one follows cache lines and the other pointer-chases. Two indexes can answer the same query, but one tolerates writes and the other assumes a mostly static table. Two approximate structures can both save memory, but one permits false positives and another overestimates counts.`,
        `Big-O is necessary, but it is not enough. Real choices depend on distribution skew, update frequency, range scans, memory layout, concurrency, failure recovery, and whether an occasional wrong answer is allowed. A design pattern primer helps because it names those hidden dimensions before a learner reaches for a famous name.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `A data structure is a workload-specific invariant with an update cost. The invariant may be sorted order, heap order, hash placement, tree balance, prefix sharing, segment summaries, bitmap compression, reference counts, or probabilistic bit patterns. The update cost is the work required to keep that invariant true as data changes.`,
        `Design means weakening the right thing. A Bloom filter gives up false-positive-free membership to save memory. A Count-Min Sketch gives up exact counts. A sparse table gives up cheap updates for fast static range queries. A piece table avoids rewriting an edited document by keeping original and add buffers. These are not tricks. They are explicit trades.`,
        `Each pattern works by preserving information in a form that matches future work. Sorted order lets binary search discard half the candidates. Heap order exposes the minimum without sorting everything. A trie shares prefixes. A segment tree stores enough summaries to combine subranges. A Bloom filter stores enough hashed evidence to prove absence when any required bit is missing.`,
        `The proof style changes by structure, but the theme is stable. State the invariant, show it is true after construction, show each update preserves it, and show each query reads enough of the invariant to answer correctly or within the promised error. If you cannot state that chain, the structure is not understood yet.`,
      ],
    },
    {
      heading: 'Locality and Layout',
      paragraphs: [
        `Locality is the design move that asks where the next byte will come from. A linked list has simple pointer updates, but traversal can miss cache on every node. A B-tree stores many keys per node so one disk page or cache line eliminates many possibilities. SwissTable packs control bytes and probes in a way that makes hash lookup friendly to SIMD and cache behavior.`,
        `The layout pattern wins when memory movement dominates arithmetic. Column stores make analytical scans fast because the query touches only needed columns. Archetype ECS stores components by shape so a game loop scans dense arrays. The tax is rigidity: changing shape, moving objects, or preserving stable references becomes harder.`,
      ],
    },
    {
      heading: 'Summaries and Precomputation',
      paragraphs: [
        `Summaries make repeated questions cheap by storing partial answers. Segment trees store range summaries. Fenwick trees store prefix summaries. Sparse tables precompute overlapping intervals for static queries. Zone maps, min-max indexes, and block statistics let databases skip data that cannot match a predicate.`,
        `Precomputation is the same move with a larger bill. Apache Pinot star-trees pre-aggregate configured query shapes, making common analytical queries fast by storing grouped results ahead of time. The wall is freshness and flexibility. If the query shape changes or writes are frequent, the precomputed structure may cost more than it saves.`,
      ],
    },
    {
      heading: 'Indirection, Versions, and Approximation',
      paragraphs: [
        `Indirection adds a level of naming so data can move without breaking users. Handles, page tables, mapping tables, ropes, tries, and LSM manifests all use this idea. The extra lookup is a cost, but the benefit is freedom: move blocks, split nodes, compact files, or keep stable references while storage changes underneath.`,
        `Versioning is indirection through time. Persistent segment trees copy only the nodes on an update path. MVCC databases keep old versions so readers and writers do not block each other. Piece tables preserve the original file and append new text elsewhere. The tax is garbage collection, memory growth, and more complicated reasoning about which version a reader sees.`,
        `Approximate structures are useful when the exact answer is too expensive and the product can tolerate a bounded kind of error. Bloom filters answer "definitely absent or maybe present." Count-Min Sketch estimates frequencies with one-sided error. HyperLogLog estimates cardinality. Quantile sketches summarize distributions without storing every value.`,
        `The important discipline is to name the allowed error before choosing the structure. False positives may be fine for avoiding unnecessary disk reads, but not for authorizing access. Overestimated counts may be fine for telemetry, but not for billing. Approximation is a contract, not a shortcut.`,
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        `The pattern-map view is a routing diagram. Locality, summary, precompute, version, and approximation are not ranked from basic to advanced. They are questions to ask about the workload. Is the pain bytes? repeated queries? lost history? too much raw data? bounded error?`,
        `The tradeoff-audit view shows why design starts before implementation. Operation mix, skew, memory layout, error tolerance, and version needs decide whether a structure fits. The plot makes the main engineering point: every move buys speed somewhere and pays in updates, storage, complexity, or risk somewhere else.`,
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        `The costs are not decorative. Locality can require relocation. Precomputation slows writes. Compression complicates random access. Persistence grows memory until old versions are collected. Approximation needs parameter choices and error monitoring. Indirection adds extra lookups and can hide fragmentation.`,
        `There is also an organizational cost. A plain array or hash map is easy to inspect, profile, serialize, and recover. A custom index needs tests, metrics, rebuild paths, corruption checks, and migration rules. Choose the simplest structure that makes the dominant workload cheap enough and keeps the failure modes visible.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `This primer wins when a learner is moving from individual algorithms to systems design. It helps connect database indexing, compiler tables, text search, graph traversal, caches, column stores, storage engines, editors, and game runtimes. The same few moves recur at different scales.`,
        `For systems, follow Database Indexing into B-tree, LSM, zone maps, star-trees, and columnar formats. For text, follow Suffix Array into Wavelet Tree and FM-index. For memory-resident performance, follow Hash Table into SwissTable and filters. For editors, follow Rope and Piece Table. For runtime identity, follow Slab Allocator into Generational Arena Slot Map and Sparse Set Entity Index.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `The main failure mode is pattern shopping. If every problem looks like it needs an advanced structure, the primer has been misused. Many workloads are best served by an array, a hash map, a heap, a sorted file, or a database index already maintained by the storage engine.`,
        `Another failure mode is hiding the workload. Average-case benchmarks can miss skew. Microbenchmarks can miss cache effects under real object sizes. Exactness requirements can rule out sketches. Concurrency can turn a clean invariant into a locking problem. Measure the real access pattern before and after the design change.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Big-O Growth, Arrays, Hash Tables, Heaps, Binary Search Trees, B-trees, and Tries as the base vocabulary. Then study SwissTable Hash Map for locality, Segment Tree and Sparse Table for summaries, FM-index and Wavelet Tree for compressed text, Bloom Filter and Count-Min Sketch for approximation, and Piece Table Text Buffer for persistence.`,
        `For production case studies, read Apache Pinot Star-Tree Index, RocksDB LSM, Lucene Inverted Index, DuckDB Vectorized Execution, Archetype ECS Column Store, and Modern Cache Eviction. Keep one question in front: what invariant made the important operation cheap, and what tax did the system accept to keep that invariant true?`,
      ],
    },
  ],
};
