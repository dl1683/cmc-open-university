// Centroid decomposition: divide a tree by repeatedly removing centroids.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'centroid-decomposition',
  title: 'Centroid Decomposition',
  category: 'Data Structures',
  summary: 'A divide-and-conquer structure for trees: remove a centroid, recurse on the remaining components, and answer distance-style updates through centroid ancestors.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['find centroid', 'nearest marked'], defaultValue: 'find centroid' },
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

function centroidGraph(title) {
  return graphState({
    nodes: [
      { id: 'c', label: '4 centroid', x: 4.8, y: 2.8, note: 'largest side <= n/2' },
      { id: 'a', label: '1', x: 2.4, y: 1.0, note: 'component' },
      { id: 'b', label: '2', x: 2.4, y: 2.8, note: 'component' },
      { id: 'd', label: '3', x: 2.4, y: 4.6, note: 'component' },
      { id: 'e', label: '5', x: 7.0, y: 1.6, note: 'component' },
      { id: 'f', label: '6', x: 7.3, y: 3.4, note: 'component' },
      { id: 'g', label: '7', x: 7.0, y: 5.2, note: 'component' },
      { id: 'ct', label: 'centroid tree', x: 9.0, y: 3.4, note: 'recursive index' },
    ],
    edges: [
      { id: 'e-c-a', from: 'c', to: 'a', weight: 'tree edge' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'tree edge' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: 'tree edge' },
      { id: 'e-c-e', from: 'c', to: 'e', weight: 'tree edge' },
      { id: 'e-e-f', from: 'e', to: 'f', weight: 'tree edge' },
      { id: 'e-f-g', from: 'f', to: 'g', weight: 'tree edge' },
      { id: 'e-c-ct', from: 'c', to: 'ct', weight: 'root of decomposition' },
    ],
  }, { title });
}

function* findCentroid() {
  yield {
    state: centroidGraph('A centroid splits every remaining component to <= half'),
    highlight: { active: ['c'], found: ['a', 'b', 'd', 'e', 'f', 'g'], compare: ['ct'] },
    explanation: 'A centroid is a balance cut, not a distance center. Removing it leaves no component with more than half the current tree, so recursion cannot keep one giant side alive.',
    invariant: 'After removing a centroid, every recursive subproblem has size at most n/2.',
  };
  yield {
    state: labelMatrix(
      'Centroid test for node 4',
      [
        { id: 'left', label: 'left component' },
        { id: 'right', label: 'right component' },
        { id: 'parent', label: 'parent side' },
        { id: 'result', label: 'node 4' },
      ],
      [{ id: 'size' }, { id: 'ok' }],
      [
        ['3', '<= 3.5'],
        ['3', '<= 3.5'],
        ['0', '<= 3.5'],
        ['largest side 3', 'centroid'],
      ],
    ),
    highlight: { active: ['left:ok', 'right:ok'], found: ['result:ok'] },
    explanation: 'For seven nodes, no side may exceed 3.5 nodes. Removing node 4 leaves two size-3 components, so it is a centroid.',
  };
  yield {
    state: centroidGraph('Recurse on each component and build a centroid tree'),
    highlight: { active: ['c', 'ct', 'e-c-ct'], compare: ['a', 'e'] },
    explanation: 'After choosing a centroid, each remaining component becomes an independent subproblem. The chosen centroids form a new index tree whose height is bounded by repeated halving.',
  };
  yield {
    state: labelMatrix(
      'Why queries become logarithmic',
      [
        { id: 'root', label: 'level 0' },
        { id: 'level1', label: 'level 1' },
        { id: 'level2', label: 'level 2' },
        { id: 'bound', label: 'height' },
      ],
      [{ id: 'subproblem' }, { id: 'reason' }],
      [
        ['n', 'whole tree'],
        ['<= n/2', 'centroid split'],
        ['<= n/4', 'split again'],
        ['O(log n)', 'halving depth'],
      ],
    ),
    highlight: { found: ['bound:reason'], active: ['level1:subproblem', 'level2:subproblem'] },
    explanation: 'Centroid decomposition creates a secondary tree of logarithmic height. Updates and queries can walk centroid ancestors instead of scanning the original tree.',
  };
}

function* nearestMarked() {
  yield {
    state: labelMatrix(
      'Maintain nearest red node',
      [
        { id: 'mark', label: 'update(red x)' },
        { id: 'walk', label: 'walk centroid ancestors' },
        { id: 'store', label: 'best[c]' },
        { id: 'query', label: 'query(v)' },
      ],
      [{ id: 'move' }, { id: 'cost' }],
      [
        ['mark a node red', 'O(log n)'],
        ['x -> centroid parent chain', 'O(log n)'],
        ['min distance from c to any red', 'updated per ancestor'],
        ['min best[c] + dist(v,c)', 'O(log n)'],
      ],
    ),
    highlight: { active: ['walk:move', 'store:move'], found: ['query:move'] },
    explanation: 'The nearest-marked query stores one summary per centroid ancestor. An update pushes a red node into every scale that can use it; a query checks those same scales for the best meeting point.',
  };
  yield {
    state: centroidGraph('Distances are measured in the original tree'),
    highlight: { active: ['c', 'ct'], found: ['a', 'g'], compare: ['e-c-a', 'e-c-e'] },
    explanation: 'The centroid tree is an index, not the metric. Distances still come from the original tree, often precomputed from each node to its centroid ancestors.',
    invariant: 'For any node pair, some centroid ancestor separates their recursive component at the level that matters.',
  };
  yield {
    state: labelMatrix(
      'Update/query example',
      [
        { id: 'red2', label: 'mark node 2' },
        { id: 'c4', label: 'ancestor centroid 4' },
        { id: 'c1', label: 'sub-centroid 1' },
        { id: 'ask7', label: 'query node 7' },
      ],
      [{ id: 'stored' }, { id: 'answerUse' }],
      [
        ['red', 'source'],
        ['best[4]=dist(2,4)', 'candidate for all sides'],
        ['best[1]=dist(2,1)', 'local candidate'],
        ['best[4]+dist(7,4)', 'cross-subtree answer'],
      ],
    ),
    highlight: { found: ['ask7:answerUse'], active: ['c4:stored'] },
    explanation: 'The centroid at which two nodes fall into different recursive components acts as the meeting point for an answer candidate.',
  };
  yield {
    state: labelMatrix(
      'Neighbors',
      [
        { id: 'hld', label: 'Heavy-Light' },
        { id: 'binary', label: 'Binary Lifting' },
        { id: 'centroid', label: 'Centroid Decomposition' },
        { id: 'lct', label: 'Link-Cut Tree' },
      ],
      [{ id: 'best' }, { id: 'topology' }],
      [
        ['path ranges', 'static'],
        ['ancestors/LCA', 'static'],
        ['distance updates over tree', 'static'],
        ['path queries with link/cut', 'dynamic'],
      ],
    ),
    highlight: { found: ['centroid:best'], compare: ['lct:topology'] },
    explanation: 'Use centroid decomposition when the query is global over distances through a static tree, not just one contiguous path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'find centroid') yield* findCentroid();
  else if (view === 'nearest marked') yield* nearestMarked();
  else throw new InputError('Pick a centroid-decomposition view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Centroid decomposition exists for static trees where many operations ask global distance-style questions. The original tree keeps the real edges. The centroid tree is a second index built by repeatedly removing balanced cut vertices.',
        'The problem is reuse. A breadth-first search or depth-first search from the query node can always find the nearest marked node, count paths, or explore far branches. But if updates and queries repeat thousands of times, scanning the original tree every time throws away too much previous work.',
      ],
    },
    {
      heading: 'Obvious approach and wall',
      paragraphs: [
        'The obvious approach for nearest marked node is to search outward from the query node until a marked node is found. That is easy to reason about, but one query can touch the whole tree. Caching one answer per node also breaks after updates because a newly marked node in another branch can become the nearest answer.',
        'Heavy-Light Decomposition helps when the query is about paths. Binary Lifting helps with ancestors and LCA. The wall is that nearest marked node is not confined to one path. The answer may cross a high-level cut between branches, so the data structure needs reusable summaries at several tree scales.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is to cut the tree by size, not by depth. A centroid is a node whose removal leaves every component with at most half the current nodes. Repeating that cut creates a centroid tree of height O(log n).',
        'The invariant is the halving bound: after removing a centroid, every recursive subproblem has size at most half of the current component. Because of that invariant, each original node has only O(log n) centroid ancestors, but those ancestors represent cuts from the whole tree down to local components.',
        'For nearest-marked-node queries, `update(x)` walks centroid ancestors of `x` and improves `best[c]` with `dist(x, c)`. `query(v)` walks centroid ancestors of `v` and minimizes `best[c] + dist(v, c)`. The original tree supplies the distance; the centroid tree supplies the small candidate set.',
      ],
    },
    {
      heading: 'Build mechanism',
      paragraphs: [
        'To build the decomposition, work inside one current component. Compute subtree sizes, then walk toward any child whose side has more than half the component. When no side is too large, the current node is a centroid. Mark it removed for construction and recurse on each remaining component.',
        'The chosen centroids become nodes in a new centroid tree. The first centroid is the root. Centroids found inside the remaining components become its children. This index tree is separate from the original adjacency list; it records recursive cuts, not original edges.',
        'Most implementations also store, for each original node, the chain of centroid ancestors and the distance from the node to each ancestor. That makes later updates and queries simple loops over arrays instead of repeated graph searches.',
      ],
    },
    {
      heading: 'Query mechanism',
      paragraphs: [
        'For the insert-only nearest marked problem, each centroid stores `best[c]`, the smallest original-tree distance from `c` to any marked node that has updated it. Initially every `best[c]` is infinity. When node `x` becomes marked, update every centroid ancestor `c` of `x` with `min(best[c], dist(x, c))`.',
        'To answer `query(v)`, walk every centroid ancestor `c` of `v` and compute `best[c] + dist(v, c)`. The minimum over those ancestors is the answer. Each candidate means: travel from `v` to a centroid-level meeting point, then use the best marked node known from that meeting point.',
        'The centroid tree is not used as a distance metric. Distances are still measured in the original tree. The index only decides which O(log n) meeting points are enough to check.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument uses the first separating centroid. Take any marked node `x` and query node `v`. During the recursive decomposition, there is a highest level where both are in the same current component. At the next relevant cut, either the centroid is one of them or `x` and `v` fall into different child components.',
        'That centroid lies on the centroid-ancestor chain for both nodes. When `x` was marked, it updated that centroid with `dist(x, c)`. When `v` is queried, it checks the same centroid and forms `dist(v, c) + best[c]`. Therefore the query considers a candidate for the level that separates `x` from `v`.',
        'Taking the minimum over all ancestors is safe because every candidate is a real original-tree distance through some centroid, and the separating centroid for the nearest marked node is included in the checked set. The data structure may check extra candidates, but it does not miss the one needed for the optimum.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Building the decomposition is usually O(n log n). Each level processes nodes in components whose total size is O(n), and there are O(log n) levels because of the halving invariant. Careful code can reduce constants, but O(n log n) is the common mental model.',
        'Updates and queries cost O(log n) when distances to centroid ancestors are precomputed. If distance is computed through LCA, add the LCA lookup cost. Space is commonly O(n log n) for ancestor chains and distances, plus arrays for centroid parent, removed flags, and per-centroid summaries.',
        'The main tradeoff is implementation and memory. Centroid decomposition is much more complex than one BFS. It pays off only when many operations reuse the same static tree index.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Centroid decomposition fits static tree metrics with online updates: nearest activated warehouse, nearest unhealthy service, nearest red node, distance to a marked region, or path-count problems that can be solved by counting through each centroid cut.',
        'It wins when the tree topology is fixed and many operations would otherwise search far-away branches. A service topology, road-tree simplification, dependency tree, or contest tree can all benefit if marks change often but edges do not.',
        'It sits next to other tree tools. Heavy-Light Decomposition handles path ranges. Binary Lifting handles ancestors and LCA. Virtual trees build small per-query trees for known marked sets. Rerooting DP scores all roots with two passes. Centroid decomposition builds one reusable online index for global distance summaries.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The biggest limit is topology changes. If edges are inserted or deleted, the centroid index can become stale and expensive to rebuild. Link-Cut Trees or Euler Tour Trees are better fits when the tree itself changes online.',
        'A common failure mode is confusing centroid with center. A centroid minimizes the largest remaining component size after removal. It is not necessarily the midpoint of the diameter and does not minimize maximum distance.',
        'Deletion of marks is another hazard. Insert-only marking is easy because `best[c]` only decreases. If marks can be removed, each centroid needs a multiset, heap with lazy deletion, or another structure that can expose the nearest still-active mark. One scalar `best[c]` is not enough.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Keep three structures separate: the original adjacency list, the removed-centroid flags used during construction, and the centroid-parent index used after construction. Mixing those roles causes subtle bugs because the centroid tree is not the original tree.',
        'Precompute distances from each node to each centroid ancestor when query volume is high. Store ancestors and distances in the same order so update and query loops are simple. Initialize `best[c]` to infinity, update every ancestor of marked nodes, and query every ancestor of the requested node.',
        'Use centroid decomposition when the tree is static, the metric is original-tree distance, and each operation would otherwise consider far-away branches. Do not use it when a simpler path structure solves the problem.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a seven-node tree where node 4 connects a three-node left branch and a three-node right branch. Removing node 4 leaves components of size 3 and 3, so 4 is a centroid. It becomes the root of the centroid tree. The left and right branches are decomposed independently.',
        'Now mark node 2 red and query node 7. A plain search might walk across the tree. The centroid index checks centroid ancestors of 7. At centroid 4, `best[4]` already stores `dist(2, 4)`, and the query computes `dist(7, 4) + best[4]`. That candidate represents the cross-branch answer without scanning the branch containing node 2.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        'The find-centroid view highlights the size test. A node is accepted only when every remaining side is at most half the component. That is the reason the centroid tree height is logarithmic.',
        'The nearest-marked view highlights the summary rule. Updates push distances from a marked node to its centroid ancestors. Queries combine stored distances with the query node distance to the same ancestors. The visual separates the original tree, where distances live, from the centroid tree, where the reusable summaries live.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: CP-Algorithms centroid decomposition at https://cp-algorithms.com/graph/centroid_decomposition.html and USACO Guide centroid notes at https://usaco.guide/plat/centroid.',
        'Study Tree Traversals for DFS fundamentals, Binary Lifting LCA for distance support, Heavy-Light Decomposition for path queries, Virtual Tree LCA Compression for per-query marked sets, Rerooting DP: All Roots Tree DP for all-root scoring, and Link-Cut Tree for dynamic topology.',
      ],
    },
  ],
};
