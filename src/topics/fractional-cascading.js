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
  const catalogs = [
    { id: 'l1', label: 'L1', values: [24,64,65,80,93] },
    { id: 'l2', label: 'L2', values: [23,25,26] },
    { id: 'l3', label: 'L3', values: [13,44,62,66] },
    { id: 'l4', label: 'L4', values: [11,35,46,79,81] },
  ];
  const queryVal = 50;
  yield {
    state: labelMatrix(
      'Naive repeated search',
      catalogs.map(({ id, label }) => ({ id, label })),
      [{ id: 'list', label: 'sorted list' }, { id: 'work', label: `work for x=${queryVal}` }],
      [
        ['24,64,65,80,93', 'binary search'],
        ['23,25,26', 'binary search'],
        ['13,44,62,66', 'binary search'],
        ['11,35,46,79,81', 'binary search'],
      ],
    ),
    highlight: { active: ['l1:work', 'l2:work', 'l3:work', 'l4:work'] },
    explanation: `The problem fractional cascading solves is repeated predecessor or successor search for x=${queryVal} across ${catalogs.length} related sorted lists. Searching each list independently costs ${catalogs.length} binary searches.`,
    invariant: `The query value ${queryVal} is the same across all ${catalogs.length} catalogs; only the catalog changes.`,
  };

  const augmented = ['m1', 'm2', 'm3', 'm4'];
  yield {
    state: catalogGraph('Copy a fraction of each later catalog backward'),
    highlight: { active: ['m1', 'm2', 'm3', 'm4', 'e-m1-m2', 'e-m2-m3'], compare: ['q'] },
    explanation: `Fractional cascading augments each of the ${catalogs.length} catalogs (${augmented.join(' -> ')}) with sampled items from the next catalog. Each augmented item stores bridge positions into its own original list and the next augmented list.`,
  };

  const binarySearches = 1;
  const bridgeFollows = catalogs.length - binarySearches;
  yield {
    state: labelMatrix(
      `Query x=${queryVal} after preprocessing`,
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
    explanation: `After ${binarySearches} binary search in M1, the remaining ${bridgeFollows} catalogs each start near the answer via bridge pointers. A constant number of comparisons fixes the position in each list.`,
    invariant: `Query time becomes O(log n + ${catalogs.length}) instead of O(${catalogs.length} log n).`,
  };

  const tradeoffDims = [
    { id: 'space', label: 'space' },
    { id: 'build', label: 'build' },
    { id: 'query', label: 'query' },
    { id: 'updates', label: 'updates' },
  ];
  yield {
    state: labelMatrix(
      'What the extra pointers buy',
      tradeoffDims,
      [{ id: 'effect', label: 'effect' }, { id: 'tradeoff', label: 'tradeoff' }],
      [
        ['linear extra samples', 'more metadata'],
        ['merge lists with bridges', 'preprocessing cost'],
        ['one search plus bridges', 'fast repeated search'],
        ['harder dynamically', 'maintenance complexity'],
      ],
    ),
    highlight: { found: ['query:effect'], compare: ['updates:tradeoff'] },
    explanation: `This structure trades across ${tradeoffDims.length} dimensions (${tradeoffDims.map(t => t.label).join(', ')}). It is elegant when ${catalogs.length} catalogs are static or rebuilt in batches, and less attractive when every list changes constantly.`,
  };
}

function* segmentTreeQueries() {
  const treeNodes = [
    { id: 'node1', label: 'node [0,3]', size: 4 },
    { id: 'node2', label: 'node [4,7]', size: 4 },
    { id: 'node3', label: 'node [8,11]', size: 4 },
    { id: 'node4', label: 'node [12,15]', size: 4 },
  ];
  yield {
    state: labelMatrix(
      'Merge-sort tree range query',
      treeNodes.map(({ id, label }) => ({ id, label })),
      [{ id: 'catalog', label: 'sorted catalog' }, { id: 'query', label: 'count <= x' }],
      [
        ['2,5,7,9', 'binary search'],
        ['1,4,6,8', 'binary search'],
        ['3,10,11,12', 'binary search'],
        ['0,13,14,15', 'binary search'],
      ],
    ),
    highlight: { active: ['node1:query', 'node2:query', 'node3:query', 'node4:query'] },
    explanation: `A range query over a merge-sort tree may touch ${treeNodes.length} segment-tree nodes, each with a sorted catalog of ${treeNodes[0].size} elements. A naive implementation binary-searches each one independently.`,
  };

  yield {
    state: catalogGraph('Bridge the catalogs visited by the query'),
    highlight: { active: ['q', 'm1', 'm2', 'm3', 'm4'], found: ['ans'] },
    explanation: `Fractional cascading can store cross-catalog links across ${treeNodes.length} visited nodes so the query performs one binary search at the first relevant node, then follows links into the remaining ${treeNodes.length - 1} catalogs.`,
  };

  const caseStudyRows = [
    { id: 'input', label: 'input array' },
    { id: 'tree', label: 'segment tree' },
    { id: 'query', label: '[l,r], x' },
    { id: 'answer', label: 'successor' },
  ];
  yield {
    state: labelMatrix(
      'Case study: many range successor queries',
      caseStudyRows,
      [{ id: 'structure', label: 'structure' }, { id: 'reason', label: 'reason' }],
      [
        ['static values', 'can preprocess'],
        ['sorted lists per node', 'range decomposes'],
        ['same x in all nodes', 'bridges apply'],
        ['min candidate', 'merge node answers'],
      ],
    ),
    highlight: { active: ['query:reason'], found: ['answer:structure'] },
    explanation: `The complete case has ${caseStudyRows.length} layers: ${caseStudyRows.map(r => r.label).join(', ')}. A static array with many queries asking for the smallest value >= x inside a range decomposes into catalogs; fractional cascading reduces the repeated search cost across ${treeNodes.length} nodes.`,
  };

  const antipatterns = [
    { id: 'few', label: 'few queries' },
    { id: 'dynamic', label: 'many updates' },
    { id: 'single', label: 'one catalog' },
    { id: 'simple', label: 'small n' },
  ];
  yield {
    state: labelMatrix(
      'When not to use it',
      antipatterns,
      [{ id: 'issue', label: 'issue' }, { id: 'simpler_choice', label: 'simpler choice' }],
      [
        ['preprocessing not repaid', 'plain binary search'],
        ['bridges hard to maintain', 'balanced trees'],
        ['no repeated search', 'one sorted array'],
        ['constants dominate', 'direct scan'],
      ],
    ),
    highlight: { compare: ['dynamic:issue', 'few:issue'], found: ['single:simpler_choice'] },
    explanation: `${antipatterns.length} antipatterns show when fractional cascading is the wrong tool: ${antipatterns.map(a => a.label).join(', ')}. If the bottleneck is not repeated sorted-list search for the same key, it adds complexity without benefit.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. "Catalog bridges" shows four sorted lists, their augmented versions with sampled elements copied backward, and a query that binary-searches once then follows bridge pointers. "Segment tree queries" shows the same idea applied to a merge-sort tree, where a range query touches several node catalogs. Step through with the slider or play button; each frame highlights one operation and explains it in the panel below.',
        {type: 'image', src: './assets/gifs/fractional-cascading.gif', alt: 'Animated walkthrough of the fractional cascading visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Watch for two colors: active cells mark the current operation, and found cells mark the cost or answer being reported. The invariant line at the bottom of each step states the structural guarantee that makes the step correct.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many data structures answer a single logical query by searching the same key across several sorted lists. A merge-sort tree range query decomposes into O(log n) segment-tree nodes, each storing a sorted catalog. A geometric slab query walks through related layers. In every case, the task per catalog is the same: find the predecessor, successor, or rank of one value x.',
        {type: 'callout', text: 'Fractional cascading makes a search position portable: pay for one binary search, then use bridge pointers to repair each later catalog in constant time.'},
        'The repeated key is the wasted opportunity. If x = 50, every catalog is being asked where 50 would sit in sorted order. Independent binary searches treat those questions as unrelated, even though the key never changes. Fractional cascading removes that redundancy by preprocessing the catalogs so the first search pays full cost and every subsequent catalog inherits a near-correct position through stored pointers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Binary-search each catalog independently. For k catalogs each of size n, the total query cost is O(k log n). The implementation is trivial: loop over the catalogs, call binary search on each, collect results.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'B-tree with sorted keys grouped in nodes', caption: 'Wide sorted nodes show the baseline idea of searching ordered catalogs. Fractional cascading optimizes a chain of such searches, not one isolated lookup. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
        'This baseline is often correct. If k is 2, queries are rare, or each catalog fits in a cache line, repeated binary search is simpler and may even be faster in wall-clock time. The baseline also has a clean maintenance property: each catalog is independent, so inserting into one list never invalidates another.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when k grows with the input. In a merge-sort tree, k = O(log n), so the naive query costs O(log^2 n). For n = 10^6, that is roughly 20 binary searches of 20 comparisons each, versus 1 binary search plus 19 constant-time bridge steps. At high query volume the difference compounds.',
        'The waste is specific: every binary search rediscovers where x sits among sorted values. The first catalog already learned that x = 50 falls between 46 and 64. The second catalog has different values but a related sorted structure. Starting over from scratch ignores that learned position.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'The catalog graph view is the general setting: each vertex owns a sorted list, and the query walks a path while searching the same key. Source: Wikimedia Commons, David W., public domain.'},
        'What is missing is a way to carry a position from one catalog to the next while keeping the correction bounded. A raw index in one list means nothing in another list because the values differ. Fractional cascading solves this by copying sampled values between lists and storing explicit bridge pointers that translate an index in one augmented catalog into a nearby index in the next.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A binary search produces a placement, not just an answer. It locates the exact slot where x belongs in a sorted sequence. Fractional cascading preserves enough cross-catalog structure so that one placement can be reused in every subsequent catalog.',
        'The mechanism is augmentation. Each catalog is enriched with a fraction of the next catalog\'s elements. Those copied elements carry bridge pointers back to the positions they came from. When a query finds its slot in the current augmented catalog, the nearest copied sample tells it approximately where to look in the next catalog.',
        'The word "fractional" is load-bearing. Copying every element from the next catalog would make bridges trivial but would blow up space to O(kn). Copying every second element (the classic choice) gives enough density to bound the correction to O(1) comparisons, while the geometric series 1 + 1/2 + 1/4 + ... keeps total augmented size at most 2n per catalog, or O(n) total across all k catalogs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build from the last catalog backward. The last augmented catalog M_k is just the original catalog L_k unchanged. For each earlier catalog L_i, construct the augmented catalog M_i by merging L_i with every second element sampled from M_{i+1}. During the merge, annotate each entry in M_i with two pointers: (1) a local pointer into L_i giving the predecessor or successor position in the original list, and (2) a bridge pointer into M_{i+1} giving the position of the nearest sampled element from that next catalog.',
        'A query for key x starts with one binary search in M_1, the first augmented catalog. The result gives the answer for L_1 (via the local pointer) and a bridge into M_2 (via the bridge pointer). The query follows that bridge, landing at a position in M_2 that is at most 2 entries away from the true position of x. It checks those neighbors, reports the answer for L_2, then follows the next bridge into M_3. This repeats until all k catalogs have been answered.',
        'The correction at each bridge step is bounded because of the sampling density. Between any two consecutive samples from M_{i+1} in M_i, there can be at most one unsampled element from M_{i+1}. So the bridge target is off by at most one position, and checking two neighbors suffices.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on one invariant: after the bridge step from M_i to M_{i+1}, the query position in M_{i+1} is within a constant offset of the true position of x. This holds because the copied samples from M_{i+1} are real elements from that catalog, placed into M_i at their correct sorted position. When binary search finds x between two elements in M_i, and at least one of those neighbors is a sample from M_{i+1}, the bridge pointer from that sample lands exactly where that value lives in M_{i+1}. Since x was between that sample and the next one, x\'s true position in M_{i+1} is within one slot of the bridge target.',
        'The space argument uses a geometric series. M_k has |L_k| elements. M_{k-1} has |L_{k-1}| + |M_k|/2 elements. M_{k-2} has |L_{k-2}| + |M_{k-1}|/2 elements. If every original catalog has n elements, the total augmented size is at most n + n + n/2 + n/4 + ... = O(kn) in the worst case, but for the path-shaped chain the telescoping gives O(n) per catalog. The preprocessing is a sequence of sorted merges, each costing time linear in the output size.',
        'The cascade is safe because it never guesses. Every bridge pointer was computed from an explicit element that appears in both M_i and M_{i+1}. The algorithm does not infer that similar values in one catalog imply similar positions in another; it placed landmarks that make the relationship exact.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Query time: O(log n + k). One binary search costs O(log n) in the first augmented catalog. Each of the remaining k - 1 bridge steps costs O(1). For a merge-sort tree with k = O(log n), the query drops from O(log^2 n) to O(log n).',
        'Preprocessing time: O(n * k) in the naive construction, dominated by k sorted merges each of size O(n). For the path chain, each merge is linear in its output, and the total output across all catalogs is O(n) by the geometric argument, so preprocessing is O(n) total.',
        'Space: O(n * k) in the general case, O(n) for the classic path chain with every-second-element sampling. Each augmented entry stores two pointers (local and bridge), so the constant factor on space is roughly 3x the original catalog size (value + two pointers).',
        'Updates are expensive. Inserting or deleting one element in L_i can change the sampled elements propagated into M_{i-1}, M_{i-2}, and so on. The static construction assumes the catalogs are built once. Dynamic fractional cascading (Mehlhorn and Naher, 1990) maintains the structure under updates but adds significant implementation complexity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Merge-sort trees are the most common application. A segment tree where each node stores a sorted list of elements in its range decomposes a range query into O(log n) nodes. Each node must answer "how many elements <= x?" or "what is the successor of x?" for the same x. Fractional cascading links those node catalogs to bring the query from O(log^2 n) down to O(log n).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree with parent and child nodes', caption: 'A segment tree decomposes one range query into several node catalogs. Fractional cascading links those catalogs so the same key search is not repeated from scratch. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'Computational geometry is the historical origin. Chazelle and Guibas invented the technique for layered range searching and planar point location. In these problems, a query walks through a sequence of slabs or layers, each with a sorted catalog of edges or endpoints. The same key (usually a coordinate) is searched in every layer.',
        'Competitive programming uses it to optimize offline range queries. When the array is static and many queries ask for rank or successor of the same value across different ranges, fractional cascading on the merge-sort tree is a clean O(n log n) preprocessing, O(log n) per query solution.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Dynamic data kills the simple version. Inserting a value into one original catalog may require re-merging and re-pointing several augmented catalogs. If insertions and deletions are frequent, a balanced BST per catalog (with O(log n) per operation, no cross-catalog coupling) is simpler and often faster in practice.',
        'Unrelated searches gain nothing. If every catalog is searched for a different key, there is no position to cascade. The bridge pointers become useless because they were built for one shared query value. Independent binary search is then the honest and correct structure.',
        'Small catalogs or few catalogs can lose to cache effects. If each catalog has 8 elements, binary search touches 3 comparisons in cache-resident memory. The bridge pointer metadata (two extra pointers per entry) may increase memory footprint enough to hurt. Measure before optimizing.',
        'Persistence and serialization become harder. Augmented catalogs contain derived pointers whose validity depends on exact list contents and ordering. If the original catalogs are rebuilt, compressed, or deduplicated independently, the bridge layer must be rebuilt or versioned alongside them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Four original catalogs: L1 = [24, 64, 65, 80, 93], L2 = [23, 25, 26], L3 = [13, 44, 62, 66], L4 = [11, 35, 46, 79, 81]. The query is: find the successor of x = 50 in each list. Independently, L1 gives 64, L2 gives nothing (all values < 50 except none >= 50... actually 23, 25, 26 are all below 50, so no successor), L3 gives 62, L4 gives 79. Four binary searches, each O(log n).',
        'Build augmented catalogs backward. M4 = L4 = [11, 35, 46, 79, 81]. Sample every second element of M4: {35, 79}. Merge into L3: M3 = [13, 35*, 44, 62, 66, 79*] where starred entries are samples from M4 carrying bridge pointers. Sample every second element of M3: {35*, 62, 79*} -- pick indices 1, 3, 5, so {35, 62, 79}. Merge into L2: M2 = [23, 25, 26, 35*, 62*, 79*]. Sample every second element of M2: {25, 35*, 79*} -- pick indices 1, 3, 5, so {25, 35, 79}. Merge into L1: M1 = [24, 25*, 64, 65, 79*, 80, 93] (35* merges between 24 and 64, but let us keep it clean: M1 = [24, 25*, 35*, 64, 65, 79*, 80, 93]).',
        'Query x = 50 in M1. Binary search finds 50 between 35* (index 2) and 64 (index 3). The local pointer for index 3 says L1\'s successor of 50 is 64. The bridge pointer from the nearest sample (35* came from M2) points to position 3 in M2. In M2, position 3 holds 35*. Check neighbors: position 4 is 62*, position 5 is 79*. The first value >= 50 among L2\'s own elements is... none (23, 25, 26 are all < 50), so L2 has no successor. The bridge from 62* points into M3. In M3, we land near 62 and check neighbors: 62 >= 50 and belongs to L3, so L3\'s successor is 62. Follow the bridge to M4, land near 79, check: 79 >= 50 and belongs to L4, so L4\'s successor is 79. Total cost: 1 binary search + 3 constant-time bridge steps.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original paper is Chazelle and Guibas, "Fractional Cascading: I. A Data Structuring Technique" (Algorithmica, 1986). PDF: https://www.cs.princeton.edu/~chazelle/pubs/FractionalCascading1.pdf. The dynamic version is covered in Part II of the same paper series. CP-Algorithms has a practical treatment in its segment tree article: https://cp-algorithms.com/data_structures/segment_tree.html.',
        'Prerequisites: study Binary Search first, because fractional cascading reuses a binary-search placement as its starting point. Then study Segment Tree and Merge Sort Tree, which are the most common hosts for fractional cascading. Related structures worth comparing: Range Tree (uses fractional cascading in its original formulation), Wavelet Tree (solves similar rank/select queries with a different approach), Persistent Segment Tree (trades space for versioning rather than bridge pointers), and Sparse Table (another static preprocessing technique for different query types).',
      ],
    },
  ],
};
