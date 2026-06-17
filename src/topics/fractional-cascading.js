// Fractional cascading: one binary search, then constant-time bridges through
// related sorted catalogs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fractional-cascading',
  title: 'Fractional Cascading',
  category: 'Data Structures',
  summary: 'Speed up repeated searches for the same key across related sorted lists by copying samples forward and storing bridge pointers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['catalog bridges', 'segment tree queries'], defaultValue: 'catalog bridges' },
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

function catalogGraph(title) {
  return graphState({
    nodes: [
      { id: 'q', label: 'query x=50', x: 0.8, y: 4.0, note: 'one value' },
      { id: 'm1', label: 'M1', x: 2.8, y: 1.5, note: 'augmented list' },
      { id: 'm2', label: 'M2', x: 4.8, y: 2.8, note: 'bridge from M1' },
      { id: 'm3', label: 'M3', x: 6.8, y: 4.1, note: 'bridge from M2' },
      { id: 'm4', label: 'M4', x: 8.8, y: 5.4, note: 'last catalog' },
      { id: 'ans', label: 'positions', x: 9.2, y: 2.0, note: 'one per list' },
    ],
    edges: [
      { id: 'e-q-m1', from: 'q', to: 'm1', weight: 'binary search' },
      { id: 'e-m1-m2', from: 'm1', to: 'm2', weight: 'bridge' },
      { id: 'e-m2-m3', from: 'm2', to: 'm3', weight: 'bridge' },
      { id: 'e-m3-m4', from: 'm3', to: 'm4', weight: 'bridge' },
      { id: 'e-m4-ans', from: 'm4', to: 'ans', weight: 'report' },
    ],
  }, { title });
}

function* catalogBridges() {
  yield {
    state: labelMatrix(
      'Naive repeated search',
      [
        { id: 'l1', label: 'L1' },
        { id: 'l2', label: 'L2' },
        { id: 'l3', label: 'L3' },
        { id: 'l4', label: 'L4' },
      ],
      [{ id: 'list', label: 'sorted list' }, { id: 'work', label: 'work for x=50' }],
      [
        ['24,64,65,80,93', 'binary search'],
        ['23,25,26', 'binary search'],
        ['13,44,62,66', 'binary search'],
        ['11,35,46,79,81', 'binary search'],
      ],
    ),
    highlight: { active: ['l1:work', 'l2:work', 'l3:work', 'l4:work'] },
    explanation: 'The problem fractional cascading solves is repeated predecessor or successor search for the same value across related sorted lists. Searching each list independently costs k binary searches.',
    invariant: 'The query value is the same; only the catalog changes.',
  };

  yield {
    state: catalogGraph('Copy a fraction of each later catalog backward'),
    highlight: { active: ['m1', 'm2', 'm3', 'm4', 'e-m1-m2', 'e-m2-m3'], compare: ['q'] },
    explanation: 'Fractional cascading augments each catalog with sampled items from the next catalog. Each augmented item stores bridge positions into its own original list and the next augmented list.',
  };

  yield {
    state: labelMatrix(
      'Query x=50 after preprocessing',
      [
        { id: 'first', label: 'M1' },
        { id: 'second', label: 'M2' },
        { id: 'third', label: 'M3' },
        { id: 'fourth', label: 'M4' },
      ],
      [{ id: 'operation', label: 'operation' }, { id: 'cost', label: 'cost' }],
      [
        ['binary search once', 'O(log n)'],
        ['follow pointer, adjust locally', 'O(1)'],
        ['follow pointer, adjust locally', 'O(1)'],
        ['follow pointer, adjust locally', 'O(1)'],
      ],
    ),
    highlight: { found: ['first:cost', 'second:cost', 'third:cost', 'fourth:cost'] },
    explanation: 'After the first binary search, every later catalog starts near the answer. A constant number of comparisons fixes the position in each list.',
    invariant: 'Query time becomes O(log n + k) instead of O(k log n).',
  };

  yield {
    state: labelMatrix(
      'What the extra pointers buy',
      [
        { id: 'space', label: 'space' },
        { id: 'build', label: 'build' },
        { id: 'query', label: 'query' },
        { id: 'updates', label: 'updates' },
      ],
      [{ id: 'effect', label: 'effect' }, { id: 'tradeoff', label: 'tradeoff' }],
      [
        ['linear extra samples', 'more metadata'],
        ['merge lists with bridges', 'preprocessing cost'],
        ['one search plus bridges', 'fast repeated search'],
        ['harder dynamically', 'maintenance complexity'],
      ],
    ),
    highlight: { found: ['query:effect'], compare: ['updates:tradeoff'] },
    explanation: 'This is a classic space-for-query-time structure. It is elegant when catalogs are static or rebuilt in batches, and less attractive when every list changes constantly.',
  };
}

function* segmentTreeQueries() {
  yield {
    state: labelMatrix(
      'Merge-sort tree range query',
      [
        { id: 'node1', label: 'node [0,3]' },
        { id: 'node2', label: 'node [4,7]' },
        { id: 'node3', label: 'node [8,11]' },
        { id: 'node4', label: 'node [12,15]' },
      ],
      [{ id: 'catalog', label: 'sorted catalog' }, { id: 'query', label: 'count <= x' }],
      [
        ['2,5,7,9', 'binary search'],
        ['1,4,6,8', 'binary search'],
        ['3,10,11,12', 'binary search'],
        ['0,13,14,15', 'binary search'],
      ],
    ),
    highlight: { active: ['node1:query', 'node2:query', 'node3:query', 'node4:query'] },
    explanation: 'A range query over a merge-sort tree may touch several segment-tree nodes. Each node has a sorted catalog, so a naive implementation binary-searches each one.',
  };

  yield {
    state: catalogGraph('Bridge the catalogs visited by the query'),
    highlight: { active: ['q', 'm1', 'm2', 'm3', 'm4'], found: ['ans'] },
    explanation: 'Fractional cascading can store cross-catalog links so the query performs one binary search at the first relevant node, then follows links into the next visited catalogs.',
  };

  yield {
    state: labelMatrix(
      'Case study: many range successor queries',
      [
        { id: 'input', label: 'input array' },
        { id: 'tree', label: 'segment tree' },
        { id: 'query', label: '[l,r], x' },
        { id: 'answer', label: 'successor' },
      ],
      [{ id: 'structure', label: 'structure' }, { id: 'reason', label: 'reason' }],
      [
        ['static values', 'can preprocess'],
        ['sorted lists per node', 'range decomposes'],
        ['same x in all nodes', 'bridges apply'],
        ['min candidate', 'merge node answers'],
      ],
    ),
    highlight: { active: ['query:reason'], found: ['answer:structure'] },
    explanation: 'The complete case is a static array with many queries asking for the smallest value >= x inside a range. The query decomposes into catalogs; fractional cascading reduces the repeated search cost.',
  };

  yield {
    state: labelMatrix(
      'When not to use it',
      [
        { id: 'few', label: 'few queries' },
        { id: 'dynamic', label: 'many updates' },
        { id: 'single', label: 'one catalog' },
        { id: 'simple', label: 'small n' },
      ],
      [{ id: 'issue', label: 'issue' }, { id: 'simpler_choice', label: 'simpler choice' }],
      [
        ['preprocessing not repaid', 'plain binary search'],
        ['bridges hard to maintain', 'balanced trees'],
        ['no repeated search', 'one sorted array'],
        ['constants dominate', 'direct scan'],
      ],
    ),
    highlight: { compare: ['dynamic:issue', 'few:issue'], found: ['single:simpler_choice'] },
    explanation: 'Fractional cascading is powerful because it targets a narrow bottleneck. If the bottleneck is not repeated sorted-list search for the same key, it is probably the wrong tool.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'catalog bridges') yield* catalogBridges();
  else if (view === 'segment tree queries') yield* segmentTreeQueries();
  else throw new InputError('Pick a fractional-cascading view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many data structures answer one logical query by searching several sorted catalogs. A range query over a merge-sort tree may decompose into several segment-tree nodes. A geometric query may walk across related layers or slabs. In each catalog, the task is often the same: find the predecessor, successor, or rank of one key.',
        'The repeated key is the opportunity. If the query value is `x = 50`, every catalog is being asked where 50 would be inserted. Independent binary searches treat those questions as unrelated, even though the query key is identical and the catalogs were built by one data structure.',
        'Fractional cascading exists to remove that repeated search cost. It preprocesses related sorted lists so the first list pays for a full binary search and later lists receive near positions through stored bridge pointers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to binary-search every catalog separately. It is simple, local, and easy to implement. For k catalogs of comparable size, the query cost is O(k log n), or more generally the sum of the logarithms of the catalog sizes.',
        'That approach is often fine. If there are only two lists, if queries are rare, or if the catalogs are small, repeated binary search may be clearer and faster in practice. Fractional cascading is worth learning because it attacks a specific bottleneck, not because every sorted list needs bridge pointers.',
        'The baseline also has a useful correctness property: each search is independent. If one catalog changes, only that catalog has to be maintained. Fractional cascading gives up some of that simplicity to make repeated queries faster.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when k is large enough and queries are frequent enough that the logarithmic factor repeats constantly. A merge-sort tree range query may touch O(log n) node catalogs. If each touched node performs its own binary search, the total query becomes O(log^2 n) for rank-like work that feels like it should share effort.',
        'The waste is not that binary search is slow. The waste is that every binary search relearns the same placement of the same key. Once one catalog has located 50 between two nearby values, a related catalog should not have to start with the full interval again.',
        'The missing structure is a way to carry a position from one catalog to the next while keeping the correction small. A raw array index in one list is not enough because the lists contain different values. Fractional cascading adds sampled values and explicit bridge pointers so an index becomes transferable.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A binary search gives a placement, not just an answer. It tells where x belongs in sorted order. Fractional cascading preserves enough cross-catalog order so that placement can be reused in the next catalog.',
        'The technique augments each catalog with a fraction of the next catalog and stores bridge pointers. The first augmented catalog pays for binary search. Each later catalog is reached by following a pointer to a position that is close to the true answer, then checking a constant-size neighborhood.',
        'The word fractional matters. Copying every item from every later catalog would make queries easy but blow up space. Copying a regular fraction, such as every second item in the classic path-shaped construction, gives enough landmarks to bound the local correction while keeping total space linear under the usual assumptions.',
      ],
    },
    {
      heading: 'Preprocessing mechanism',
      paragraphs: [
        'In the classic path-shaped version, build from the end toward the start. The last augmented catalog is just the last original catalog. The previous augmented catalog merges its own original items with every second item sampled from the next augmented catalog. Continue backward until the first catalog has been augmented.',
        'Each augmented item stores at least two positions: where it lands in the local original catalog and where it points in the next augmented catalog. The local pointer answers predecessor, successor, or rank for the current original list. The bridge pointer lets the query move to the next catalog without a new full search.',
        'The construction is a set of sorted merges. Because the sampled items are interleaved into the previous catalog, a binary search in the previous augmented catalog brackets the query key using a mixture of local values and landmarks copied from the next catalog. Those copied landmarks are what make the bridge accurate enough.',
      ],
    },
    {
      heading: 'Query mechanism',
      paragraphs: [
        'A query starts with one binary search in the first augmented catalog. The result gives the local answer for the first original list and a bridge position into the second augmented catalog. The query follows that bridge, checks the neighboring entries needed to correct the position, reports the second answer, and follows the next bridge.',
        'Because sampled items from the next catalog were copied backward at regular density, the bridge lands near the true position of x. The correction is constant in the classic static construction: inspect a bounded number of adjacent entries, then continue. Repeating that step across k catalogs gives O(log n + k) query time instead of O(k log n).',
        'The output still contains one answer per catalog. Fractional cascading does not merge the problem into one global answer. It changes how the search positions are found.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose four catalogs need the successor of 50. Independently, L1 returns 64, L2 has no successor, L3 returns 62, and L4 returns 79. The naive method discovers those facts with four separate binary searches.',
        'With fractional cascading, the first augmented catalog is searched once. The found slot also contains a bridge into the second augmented catalog. That bridge lands near where 50 belongs in the second list, so a few comparisons decide whether a successor exists. The same pointer-and-correct step continues through the third and fourth catalogs.',
        'The important point is that the query still respects each list. If L2 has no successor, the structure reports that fact for L2. It does not assume that the successor in L1 or L3 applies everywhere. The bridge only saves search work; it does not erase catalog-specific answers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The copied fraction creates a coarse map of the next catalog inside the current one. If two copied samples from the next catalog bracket x in the current augmented catalog, then the true position of x in the next catalog is trapped near the bridge targets for those samples.',
        'The density of copied samples bounds the correction. With every second item copied in the classic construction, there cannot be a long unsampled run between bridge landmarks. The bridge may not land exactly on the answer, but it lands close enough that a constant number of comparisons repairs it.',
        'The cascade is safe because sorted order is carried by explicit pointers. The algorithm is not guessing that nearby values in one list imply nearby values in another. It built augmented catalogs whose copied samples are real elements from the next catalog, and it stored the exact positions needed to cross lists.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Static fractional cascading can answer k related catalog searches in O(log n + k) time with linear total augmentation under the usual assumptions. The cost moves into preprocessing, extra sampled elements, bridge metadata, and more complicated catalog construction.',
        'The space overhead is not just the copied values. Each augmented entry needs enough metadata to report a position in the local original catalog and cross into the next augmented catalog. For compact numeric arrays, that pointer metadata may dominate the copied values.',
        'The technique is most attractive when catalogs are stable and query volume is high. It is less attractive when k is small, when values are tiny and cache behavior makes repeated binary search cheap, or when the implementation complexity would create more risk than the asymptotic win removes.',
        'Updates are the main tradeoff. Inserting or deleting a value can change sample positions and bridge pointers across multiple augmented catalogs. Static fractional cascading is simple and elegant. Dynamic fractional cascading exists, but it is a different engineering problem.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'A merge-sort tree is the easiest application to remember. Each segment-tree node stores a sorted list. A range query decomposes into O(log n) nodes, and each touched node needs the rank, predecessor, or successor of the same x. Fractional cascading links those node catalogs so the query pays one binary search and then follows bridges across the relevant catalogs.',
        'Computational geometry gives the historical motivation. Layered range searching and planar subdivisions often ask related catalogs the same key question while moving through a search structure. Fractional cascading turns the repeated sorted-list searches into a cascade of constant-time transfers after the first search.',
        'The decision rule is concrete: many related catalogs, one query key, frequent queries, and enough stability to repay preprocessing. If any of those pieces is missing, the technique loses its reason to exist.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with a plain version first. Build the segment tree, range tree, or catalog chain with independent binary searches. Measure how many catalogs a typical query touches and how much time is actually spent inside those searches. Fractional cascading should be a targeted optimization, not a reflex.',
        'Keep augmented and original catalogs distinct in code. The original catalog is what the query reports against. The augmented catalog is the search accelerator. Confusing those layers causes off-by-one errors, especially for predecessor versus successor queries and for duplicate keys.',
        'Test boundary cases aggressively: x below every value, x above every value, x equal to a copied sample, x equal to a local-only value, empty catalogs if the application allows them, duplicate values, and paths that touch only one catalog. Most bugs in this structure are not in the big idea; they are in pointer correction at boundaries.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Dynamic updates are the hard case. Insertions and deletions can invalidate bridge positions and sampled structure across several catalogs. There are dynamic variants, but the simple static idea should not be dropped into a high-churn system without a maintenance plan.',
        'The technique fails conceptually when the searches are unrelated. If every catalog is searched for a different key, or if the catalogs do not form a useful relationship, there is no placement to cascade. Independent binary search is then the honest structure.',
        'It can also lose to cache and constant factors. A few small arrays may fit in cache so well that bridge metadata slows the program down. A clean implementation should compare against the naive baseline on the expected workload.',
        'Finally, fractional cascading can complicate persistence and serialization. Augmented catalogs contain derived pointers whose meaning depends on exact list versions. If original catalogs are rebuilt, sorted differently, compressed, or deduplicated, the bridge layer must be rebuilt or versioned with them.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: Chazelle and Guibas, "Fractional Cascading: I. A Data Structuring Technique", https://www.cs.princeton.edu/~chazelle/pubs/FractionalCascading1.pdf, and CP-Algorithms Segment Tree notes on fractional cascading, https://cp-algorithms.com/data_structures/segment_tree.html.',
        'Study Binary Search first, because fractional cascading reuses a binary-search placement. Then study Segment Tree, Merge Sort Tree, Range Tree, Wavelet Tree, Sparse Table, Disjoint Sparse Table, and persistent segment trees. The useful contrast is static preprocessing for faster repeated catalog search versus dynamic balanced trees for high-update workloads.',
      ],
    },
  ],
};
