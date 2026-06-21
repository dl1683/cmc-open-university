// Merge-sort trees store a sorted catalog at every segment-tree node, turning
// range counting into canonical range decomposition plus binary search.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'merge-sort-tree-range-counting',
  title: 'Merge-Sort Tree Range Counting',
  category: 'Data Structures',
  summary: 'Store a sorted list at every segment-tree node so static range count, successor, and kth-style queries become searches over canonical catalogs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['range count', 'fractional cascading'], defaultValue: 'range count' },
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

function treeGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: '[0..7]', x: 4.8, y: 0.9, note: '1,2,3,4,5,6,7,8' },
      { id: 'left', label: '[0..3]', x: 2.7, y: 2.7, note: '2,3,5,7' },
      { id: 'right', label: '[4..7]', x: 6.9, y: 2.7, note: '1,4,6,8' },
      { id: 'a', label: '[0..1]', x: 1.5, y: 4.6, note: '3,7' },
      { id: 'b', label: '[2..3]', x: 3.7, y: 4.6, note: '2,5' },
      { id: 'c', label: '[4..5]', x: 5.9, y: 4.6, note: '1,6' },
      { id: 'd', label: '[6..7]', x: 8.1, y: 4.6, note: '4,8' },
      { id: 'query', label: 'query', x: 4.8, y: 6.6, note: '[2..6], <=5' },
    ],
    edges: [
      { id: 'e-root-left', from: 'root', to: 'left' },
      { id: 'e-root-right', from: 'root', to: 'right' },
      { id: 'e-left-a', from: 'left', to: 'a' },
      { id: 'e-left-b', from: 'left', to: 'b' },
      { id: 'e-right-c', from: 'right', to: 'c' },
      { id: 'e-right-d', from: 'right', to: 'd' },
      { id: 'e-query-b', from: 'query', to: 'b' },
      { id: 'e-query-c', from: 'query', to: 'c' },
      { id: 'e-query-d', from: 'query', to: 'd' },
    ],
  }, { title });
}

function bridgeGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x=5', x: 0.9, y: 3.4, note: 'same key' },
      { id: 'n1', label: '[2..3]', x: 2.8, y: 1.6, note: '2,5' },
      { id: 'n2', label: '[4..5]', x: 4.8, y: 3.2, note: '1,6' },
      { id: 'n3', label: '[6..6]', x: 6.8, y: 4.8, note: '4' },
      { id: 'ans', label: 'sum', x: 8.7, y: 3.4, note: 'counts add' },
    ],
    edges: [
      { id: 'e-x-n1', from: 'x', to: 'n1' },
      { id: 'e-n1-n2', from: 'n1', to: 'n2' },
      { id: 'e-n2-n3', from: 'n2', to: 'n3' },
      { id: 'e-n3-ans', from: 'n3', to: 'ans' },
    ],
  }, { title });
}

function* rangeCount() {
  yield {
    state: treeGraph('Every segment node stores a sorted catalog'),
    highlight: { active: ['root', 'left', 'right'], found: ['a', 'b', 'c', 'd'] },
    explanation: 'A merge-sort tree is a segment tree where every node stores the values in its interval as a sorted list. Construction is exactly the merge step from Merge Sort applied at every internal node.',
    invariant: 'Each array value appears in one node per level, so total storage is O(n log n).',
  };

  yield {
    state: treeGraph('Range [2..6] decomposes into canonical nodes'),
    highlight: { active: ['query', 'b', 'c', 'd', 'e-query-b', 'e-query-c', 'e-query-d'], compare: ['a'], found: ['root'] },
    explanation: 'The range query does not scan positions one by one. It decomposes the interval into O(log n) disjoint segment-tree nodes, then searches each node catalog.',
  };

  yield {
    state: labelMatrix(
      'Count values <= 5 in query catalogs',
      [
        { id: 'b', label: '[2..3]' },
        { id: 'c', label: '[4..5]' },
        { id: 'd', label: '[6..6]' },
        { id: 'total', label: 'total' },
      ],
      [
        { id: 'catalog', label: 'sorted catalog' },
        { id: 'count', label: '<= 5' },
      ],
      [
        ['2,5', '2'],
        ['1,6', '1'],
        ['4', '1'],
        ['add counts', '4'],
      ],
    ),
    highlight: { active: ['b:count', 'c:count', 'd:count'], found: ['total:count'] },
    explanation: 'Each catalog answer is one Binary Search. The range count is the sum of those local counts.',
  };

  yield {
    state: labelMatrix(
      'Cost model',
      [
        { id: 'build', label: 'build' },
        { id: 'space', label: 'space' },
        { id: 'count', label: 'count <= x' },
        { id: 'update', label: 'point update' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'reason' },
      ],
      [
        ['O(n log n)', 'merge catalogs'],
        ['O(n log n)', 'one copy per level'],
        ['O(log^2 n)', 'nodes times search'],
        ['expensive', 'catalog maintenance'],
      ],
    ),
    highlight: { found: ['count:cost'], compare: ['update:cost'], active: ['build:reason'] },
    explanation: 'Merge-sort trees shine for static arrays or batched rebuilds. Fully dynamic updates require balanced containers in each node or a different structure.',
  };
}

function* fractionalCascading() {
  yield {
    state: bridgeGraph('Same x is searched across every visited catalog'),
    highlight: { active: ['x', 'n1', 'n2', 'n3'], found: ['ans'] },
    explanation: 'The query value x is identical for all canonical nodes. That repeated-search pattern is exactly where Fractional Cascading can remove most binary searches.',
    invariant: 'The catalogs are related by the segment-tree structure and mostly static.',
  };

  yield {
    state: labelMatrix(
      'Without and with bridges',
      [
        { id: 'plain', label: 'plain tree' },
        { id: 'bridged', label: 'with bridges' },
        { id: 'successor', label: 'successor query' },
        { id: 'kth', label: 'kth by value' },
      ],
      [
        { id: 'query', label: 'query plan' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['O(log n) catalogs * binary search', 'simple'],
        ['one search, then pointers', 'more metadata'],
        ['min across node candidates', 'natural fit'],
        ['usually use Wavelet Tree instead', 'cleaner'],
      ],
    ),
    highlight: { active: ['plain:query', 'bridged:query'], found: ['successor:query'], compare: ['kth:tradeoff'] },
    explanation: 'Fractional cascading augments catalogs with bridge positions. It is excellent for range successor and count-style searches when the array is static enough.',
  };

  yield {
    state: bridgeGraph('Bridge pointers carry the search position forward'),
    highlight: { active: ['e-x-n1', 'e-n1-n2', 'e-n2-n3', 'n1', 'n2'], compare: ['x'], found: ['ans'] },
    explanation: 'After one full binary search, each next catalog starts near the correct rank. A small local adjustment gives the count or successor position for that node.',
  };

  yield {
    state: labelMatrix(
      'Choosing among neighbors',
      [
        { id: 'fenwick', label: 'Fenwick Tree' },
        { id: 'segment', label: 'Segment Tree' },
        { id: 'mst', label: 'merge-sort tree' },
        { id: 'wavelet', label: 'Wavelet Tree' },
      ],
      [
        { id: 'best_for', label: 'best for' },
        { id: 'limit' },
      ],
      [
        ['prefix sums', 'not value ranks'],
        ['dynamic aggregates', 'one summary per node'],
        ['static range values', 'O(n log n) space'],
        ['static rank/select/quantile', 'more specialized'],
      ],
    ),
    highlight: { active: ['mst:best_for'], found: ['wavelet:best_for'], compare: ['fenwick:limit', 'segment:limit'] },
    explanation: 'The structure belongs between general Segment Tree ideas and succinct sequence indexes. It is often the easiest way to understand why Wavelet Tree is useful.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'range count') yield* rangeCount();
  else if (view === 'fractional cascading') yield* fractionalCascading();
  else throw new InputError('Pick a merge-sort tree view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some range questions are not about a single aggregate like sum or min. They ask about value ranks inside an index interval: how many values are <= x, what is the successor, or which values fall under a threshold.',
        'A merge-sort tree exists for static range value queries. It adds sorted catalogs to segment-tree nodes so each canonical range can answer by binary search.',
        {type: 'callout', text: 'A merge-sort tree is a two-axis index: the tree chooses positions, and each sorted catalog answers value thresholds.'},
        'The structure is useful because many arrays have two meanings at once. The position may be time, document order, customer index, genomic coordinate, or row number. The value may be price, score, latency, size, or rank. A query such as "how many orders between days 20 and 80 were at most 50" is not just a range query over positions and not just a search over values. It is both at the same time.',
        'A normal segment tree is excellent when every covered segment can be summarized by one value. Range sum stores a sum. Range min stores a minimum. Range counting under a threshold needs more information: it needs part of the value distribution inside each covered position interval. The merge-sort tree stores that distribution in the simplest useful form, a sorted list.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to scan arr[l..r] and count values. That is too slow across many queries.',
        'A normal segment tree stores one compact aggregate per node. That works for sums or minima, but it cannot answer "how many values in this segment are <= x?" without more information.',
        'Another obvious approach is to sort the whole array by value. That helps with thresholds but loses the ability to restrict by original position. You can find every value <= x, but then you still need to know which of those values fall between l and r. The problem is two-dimensional: one axis is array position, the other is value. Solving only one axis leaves the other expensive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the query has two axes: position range and value threshold. A single segment aggregate collapses away the distribution of values.',
        'The second wall is updates. Sorted catalogs are easy to build once and annoying to maintain after arbitrary point changes.',
        'The third wall is duplicates and boundary semantics. "Less than x", "less than or equal to x", "first value at least x", and "kth smallest" all sound similar but use different binary-search positions. A good implementation has to define those semantics exactly or it will be off by one around equal values.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep the segment-tree range decomposition, but store a sorted list at each node instead of one aggregate. The index dimension is handled by canonical nodes; the value dimension is handled by binary search inside catalogs.',
        'The build is literally merge sort that keeps every intermediate merge result.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Merge_sort_algorithm_diagram.svg/600px-Merge_sort_algorithm_diagram.svg.png', alt: 'Merge sort diagram showing sorted runs merging into larger runs', caption: 'The build keeps every intermediate merge result instead of discarding it after sorting. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.'},
        'That is why the name is so good. A segment tree gives the node hierarchy over positions. Merge sort gives the sorted catalogs. During build, every internal node merges the sorted lists from its children. The root has the entire array sorted. A node covering [4, 7] has only those positions sorted. A leaf has one value. Every level preserves a different granularity of the same array.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        `In the range-count view, the active nodes are the canonical segment-tree nodes that exactly cover the query interval. The query does not inspect every array position. It asks each selected node's sorted catalog how many values satisfy the threshold, then adds those independent counts.`,
        `In the fractional-cascading view, watch the repeated search key x. Plain merge-sort trees binary-search x in every selected catalog. Fractional cascading adds bridge positions so one search can be carried forward, replacing many independent searches with one search plus local pointer moves.`,
        `The important habit is to watch both filters. The tree traversal filters by position. The binary searches filter by value. If a node is not part of the canonical cover, its catalog is irrelevant even if it contains small values. If a node is selected, its catalog is searched without looking back at individual positions because the node already certifies the position interval.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build the segment-tree shape over positions. A leaf catalog contains one value. An internal catalog is the sorted merge of its child catalogs. Each value appears once per tree level.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree diagram with parent and child nodes', caption: 'The position index is a binary range tree; each selected node owns one disjoint interval. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.'},
        'To answer count <= x in [l, r], decompose [l, r] into O(log n) canonical nodes. For each node, binary-search its catalog for the last value <= x and add the counts.',
        'Successor queries use the same catalogs differently. For each canonical node, binary-search for the first value >= x. That gives one local candidate per node. The answer for the whole range is the minimum of those candidates. Predecessor queries search for the last value <= x and take the maximum local candidate. Range count in [a, b] is count <= b minus count < a.',
        'Kth-smallest queries are possible, but they add another layer. One common method binary-searches over the value domain and asks the merge-sort tree how many values in [l, r] are <= mid. That costs an extra logarithmic factor over the value range or coordinate-compressed domain. A wavelet tree often serves kth and rank queries more directly, which is one reason this topic leads naturally into wavelet trees.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because segment-tree decomposition gives disjoint position ranges, and sorted catalogs make threshold counts inside each position range logarithmic.',
        'The query is a composition of two simple tools: canonical range cover plus binary search.',
        'The counts add because the canonical nodes are disjoint. No array position appears in two selected nodes for the same query cover, so summing local catalog counts neither misses nor double-counts values.',
        'The sorted catalogs are valid because each catalog contains exactly the multiset of values for its node range. Sorting changes order inside the catalog, but it does not change membership. The segment-tree node remembers the position interval; the catalog remembers the value multiset for that interval. That separation is the whole trick.',
        'Duplicates are handled naturally if the binary search is chosen correctly. upper_bound(x) gives the number of values <= x. lower_bound(x) gives the number of values < x. The catalog may contain repeated values, and the insertion position accounts for all copies before the boundary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For array positions [2..6], the segment tree may decompose the interval into nodes [2..3], [4..5], and [6..6]. If the threshold is 5, search catalogs [2,5], [1,6], and [4]. Their local counts are 2, 1, and 1, so the answer is 4.',
        'The sorted catalogs are what make the value threshold cheap. Without them, each selected node would still need to scan its values. With them, each selected node is just an upper_bound search.',
        'For a successor example, use the same canonical nodes and ask for the first value at least 5. Catalog [2,5] returns 5, catalog [1,6] returns 6, and catalog [4] has no local successor. The range successor is the minimum available candidate, so the answer is 5. The position cover did not change; only the catalog operation changed.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Build time and space are O(n log n). A range counting query is O(log^2 n): O(log n) canonical nodes times O(log n) binary search. Fractional cascading can reduce repeated searches at the cost of extra metadata.',
        'Point updates are the weak spot. Changing one value means updating catalogs along a root-to-leaf path. That requires balanced containers, rebuilds, or a different structure.',
        'The O(n log n) space comes from value duplication across levels. Each original array value appears in one node per level of the segment tree. That is the price paid for fast static queries. If n is large and values are simple integers, a wavelet tree or compressed variant may be more memory efficient. If the array is moderate and the implementation needs to be obvious, merge-sort trees are often easier to build and audit.',
        'Fractional cascading changes the query tradeoff. Plain queries perform independent binary searches in each selected catalog. With bridge metadata, the first search can guide later searches, reducing the repeated logarithmic factor for supported query patterns. The cost is a more complex build, more stored pointers, and harder updates. It is an optimization for stable catalogs with many queries, not a default requirement.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for static snapshots with many value-threshold queries: order amounts by time, scores by index range, versioned metrics, and range successor questions.',
        'It is often the easiest stepping stone toward wavelet trees because it makes the rank-in-range problem explicit.',
        'It also wins in teaching and verification. The build is just a segment tree whose combine step is sorted merge, and the query is just range decomposition plus binary search. That transparency matters when a team needs a correct static index quickly and does not yet need the tighter memory model or richer operations of a wavelet tree.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when frequent updates matter, when memory is tight, or when a specialized Wavelet Tree gives cleaner rank/select/quantile operations.',
        'It can also be overkill. Square-root decomposition may be easier for moderate n and custom block-local logic.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'B-tree with grouped sorted keys in internal nodes', caption: 'Mutable database indexes solve a broader problem than a static merge-sort tree, including inserts, deletes, and changing row order. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
        'It can fail through bad value-domain assumptions. If kth queries binary-search over raw 64-bit values without coordinate compression, the value search can add unnecessary work. If floating-point values are involved, boundary and equality semantics need extra care. If the query wants top-k values rather than counts or successors, each catalog may need a different stored summary.',
        'It is also not a general replacement for an ordered database index. A merge-sort tree is built over one fixed array order. If the position dimension changes because rows are inserted, deleted, resorted, or filtered by arbitrary predicates, the static tree no longer represents the query space. At that point the system may need a database index, a Fenwick tree of ordered sets, a persistent segment tree, or a rebuilt snapshot.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An analytics dashboard has a static snapshot of customer order amounts and asks: how many orders between days 20 and 80 were at most $50? The merge-sort tree decomposes the day interval into canonical nodes and binary-searches each node catalog.',
        'For range successor, it finds the first value >= $50 in each selected catalog and returns the smallest candidate. The same catalog structure supports both queries.',
        'The operational rule is to rebuild on snapshot boundaries. If the dashboard ingests yesterday once, builds the tree, and serves thousands of exploratory queries, the structure fits. If orders update continuously and the dashboard demands second-by-second freshness, the maintenance cost may outweigh the query speed. The data lifecycle decides whether the static assumption is acceptable.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with coordinate and boundary definitions. Decide whether queries are zero-based or one-based, inclusive or half-open, and whether count thresholds use <, <=, >, or >=. Write helper functions with names such as countLessThan and countLessOrEqual rather than scattering raw lower_bound and upper_bound calls through the code.',
        'Store catalogs as arrays when the structure is static. Arrays give compact memory, binary search, and good cache behavior. During build, merge child arrays into a new sorted array. Avoid repeatedly sorting from scratch at internal nodes; that loses the merge-sort structure and increases build cost.',
        'Test with duplicates, all equal values, strictly increasing values, strictly decreasing values, empty query ranges if the API allows them, thresholds below the minimum and above the maximum, and ranges that align exactly with a node boundary. Most merge-sort tree bugs are not in the idea; they are in range decomposition and binary-search boundary handling.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary study links: CP-Algorithms Segment Tree notes cover sorted lists at nodes and fractional cascading at https://cp-algorithms.com/data_structures/segment_tree.html, Chazelle and Guibas introduce Fractional Cascading at https://www.cs.princeton.edu/~chazelle/pubs/FractionalCascading1.pdf, and MIT 6.851 range searching notes discuss nested range structures at https://courses.csail.mit.edu/6.851/spring10/scribe/lec03.pdf. Study Segment Tree & Lazy Propagation, Fractional Cascading, Wavelet Tree, Square-Root Decomposition Range Queries, and 2D Fenwick Tree & Coordinate Compression next.',
      ],
    },
  ],
};
