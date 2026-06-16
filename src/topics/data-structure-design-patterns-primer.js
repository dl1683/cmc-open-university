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
      heading: 'What it is',
      paragraphs: [
        'This primer is a map of recurring design patterns that appear across the repo. Advanced data structures are not a bag of unrelated tricks. They repeatedly use the same moves: improve locality, add indirection, summarize a large set, precompute a frequent query, preserve versions, or accept a bounded error.',
        'The value of the primer is connective tissue. SwissTable Hash Map, Eytzinger Layout Binary Search, FM-Index, Ribbon Filter, Piece Table Text Buffer, Apache Pinot Star-Tree Index, and Modern Cache Eviction look unrelated until you ask what invariant each one buys and what cost it pays.',
      ],
    },
    {
      heading: 'How to use it',
      paragraphs: [
        'Start with the workload. If the problem is dominated by CPU stalls, study layout topics such as SwissTable and Eytzinger. If the problem is dominated by repeated range queries, study Segment Tree, Sparse Table, Fractional Cascading, and Cartesian Tree. If raw data is too large, study filters, sketches, compressed indexes, and pre-aggregated storage.',
        'Then ask what can be weakened safely. Bloom-style filters allow false positives but no false negatives. Count-Min Sketch allows overestimates. HyperLogLog estimates cardinality. Pinot star-trees restrict themselves to configured query shapes. Piece tables preserve edit history by avoiding destructive mutation of the original buffer. Finger trees preserve versions while weakening the interface into associative measures that can be cached. The same method works when reading papers: translate the novelty into one invariant, one cheap path, and one new cost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every invariant has an update cost. A precomputed index can make queries fast and writes slow. A compressed index can save memory and complicate updates. A flat hash table can improve cache locality and weaken pointer stability. Scapegoat trees trade small per-update rotations for occasional large subtree rebuilds. A cache policy can improve hit rate while increasing metadata and tuning complexity. The job is to make the paid cost land on the colder path.',
      ],
    },
    {
      heading: 'Case-study routes',
      paragraphs: [
        'For systems, follow Database Indexing into Parquet, Druid, Pinot, DuckDB, Lucene, and RocksDB. For text, follow Suffix Array into Wavelet Tree and FM-Index. For memory-resident performance, follow Hash Table into SwissTable and the approximate-membership filters. For ordered integer search, follow van Emde Boas Tree into X-Fast & Y-Fast Tries and compare that indirection move with Skip List towers. For cache behavior, follow LRU into W-TinyLFU and SIEVE/S3-FIFO.',
        'For game and editor runtimes, follow Slab Allocator into Generational Arena Slot Map, then Sparse Set Entity Index, then Archetype ECS Column Store. That route shows the same design pattern at three levels: stable handles protect object identity, sparse sets make optional membership cheap, and archetype columns make repeated scans cheap.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not choose by asymptotic notation alone. Constant factors, cache lines, distribution skew, update frequency, concurrency, and operational observability decide many real systems. Also avoid cargo-culting production structures: a star-tree, learned filter, or fancy cache policy is only justified when the workload actually matches its invariant.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Representative sources behind the routes include Abseil SwissTable notes at https://abseil.io/about/design/swisstables, TinyLFU at https://arxiv.org/abs/1512.00727, Apache Pinot star-tree documentation at https://docs.pinot.apache.org/build-with-pinot/indexing/star-tree-index, and Unity Entities archetype documentation at https://docs.unity3d.com/Packages/com.unity.entities%401.0/manual/concepts-archetypes.html. Study SwissTable Hash Map, Ribbon Filter, FM-Index & Burrows-Wheeler Transform, Piece Table Text Buffer, Apache Pinot Star-Tree Index Case Study, Generational Arena Slot Map, and Modern Cache Eviction next.',
      ],
    },
  ],
};
