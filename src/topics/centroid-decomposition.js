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
  const componentNodes = ['a', 'b', 'd', 'e', 'f', 'g'];
  yield {
    state: centroidGraph('A centroid splits every remaining component to <= half'),
    highlight: { active: ['c'], found: componentNodes, compare: ['ct'] },
    explanation: `A centroid is a balance cut, not a distance center. Removing it leaves no component with more than half the current ${componentNodes.length + 1}-node tree, so recursion cannot keep one giant side alive.`,
    invariant: `After removing a centroid, every recursive subproblem has size at most ${Math.floor((componentNodes.length + 1) / 2)}.`,
  };
  const testRows = [
    { id: 'left', label: 'left component' },
    { id: 'right', label: 'right component' },
    { id: 'parent', label: 'parent side' },
    { id: 'result', label: 'node 4' },
  ];
  const testData = [
    ['3', '<= 3.5'],
    ['3', '<= 3.5'],
    ['0', '<= 3.5'],
    ['largest side 3', 'centroid'],
  ];
  yield {
    state: labelMatrix(
      'Centroid test for node 4',
      testRows,
      [{ id: 'size' }, { id: 'ok' }],
      testData,
    ),
    highlight: { active: ['left:ok', 'right:ok'], found: ['result:ok'] },
    explanation: `For ${componentNodes.length + 1} nodes, no side may exceed ${(componentNodes.length + 1) / 2} nodes. Removing node 4 leaves ${testRows.length - 1} sides checked, with the largest at ${testData[0][0]}, so it is a ${testData[3][1]}.`,
  };
  const recurseCompare = ['a', 'e'];
  yield {
    state: centroidGraph('Recurse on each component and build a centroid tree'),
    highlight: { active: ['c', 'ct', 'e-c-ct'], compare: recurseCompare },
    explanation: `After choosing a centroid, each remaining component (such as ${recurseCompare.join(' and ')}) becomes an independent subproblem. The chosen centroids form a new index tree whose height is bounded by repeated halving.`,
  };
  const levelRows = [
    { id: 'root', label: 'level 0' },
    { id: 'level1', label: 'level 1' },
    { id: 'level2', label: 'level 2' },
    { id: 'bound', label: 'height' },
  ];
  yield {
    state: labelMatrix(
      'Why queries become logarithmic',
      levelRows,
      [{ id: 'subproblem' }, { id: 'reason' }],
      [
        ['n', 'whole tree'],
        ['<= n/2', 'centroid split'],
        ['<= n/4', 'split again'],
        ['O(log n)', 'halving depth'],
      ],
    ),
    highlight: { found: ['bound:reason'], active: ['level1:subproblem', 'level2:subproblem'] },
    explanation: `Centroid decomposition creates a secondary tree of logarithmic height across ${levelRows.length - 1} demonstrated levels. Updates and queries can walk centroid ancestors instead of scanning the original tree.`,
  };
}

function* nearestMarked() {
  const opRows = [
    { id: 'mark', label: 'update(red x)' },
    { id: 'walk', label: 'walk centroid ancestors' },
    { id: 'store', label: 'best[c]' },
    { id: 'query', label: 'query(v)' },
  ];
  const opData = [
    ['mark a node red', 'O(log n)'],
    ['x -> centroid parent chain', 'O(log n)'],
    ['min distance from c to any red', 'updated per ancestor'],
    ['min best[c] + dist(v,c)', 'O(log n)'],
  ];
  yield {
    state: labelMatrix(
      'Maintain nearest red node',
      opRows,
      [{ id: 'move' }, { id: 'cost' }],
      opData,
    ),
    highlight: { active: ['walk:move', 'store:move'], found: ['query:move'] },
    explanation: `The nearest-marked query stores one summary per centroid ancestor across ${opRows.length} operations. An update pushes a red node into every scale (each at ${opData[0][1]}); a query checks those same scales for the best meeting point.`,
  };
  const distFound = ['a', 'g'];
  const distCompare = ['e-c-a', 'e-c-e'];
  yield {
    state: centroidGraph('Distances are measured in the original tree'),
    highlight: { active: ['c', 'ct'], found: distFound, compare: distCompare },
    explanation: `The centroid tree is an index, not the metric. Distances between nodes like ${distFound[0]} and ${distFound[1]} still come from the original tree, often precomputed from each node to its centroid ancestors.`,
    invariant: `For any node pair (e.g. ${distFound.join(' and ')}), some centroid ancestor separates their recursive component at the level that matters.`,
  };
  const exampleRows = [
    { id: 'red2', label: 'mark node 2' },
    { id: 'c4', label: 'ancestor centroid 4' },
    { id: 'c1', label: 'sub-centroid 1' },
    { id: 'ask7', label: 'query node 7' },
  ];
  const exampleData = [
    ['red', 'source'],
    ['best[4]=dist(2,4)', 'candidate for all sides'],
    ['best[1]=dist(2,1)', 'local candidate'],
    ['best[4]+dist(7,4)', 'cross-subtree answer'],
  ];
  yield {
    state: labelMatrix(
      'Update/query example',
      exampleRows,
      [{ id: 'stored' }, { id: 'answerUse' }],
      exampleData,
    ),
    highlight: { found: ['ask7:answerUse'], active: ['c4:stored'] },
    explanation: `The centroid at which two nodes fall into different recursive components acts as the meeting point for an answer candidate. This example traces ${exampleRows.length} steps from ${exampleRows[0].label} to ${exampleRows[exampleRows.length - 1].label}.`,
  };
  const neighborRows = [
    { id: 'hld', label: 'Heavy-Light' },
    { id: 'binary', label: 'Binary Lifting' },
    { id: 'centroid', label: 'Centroid Decomposition' },
    { id: 'lct', label: 'Link-Cut Tree' },
  ];
  yield {
    state: labelMatrix(
      'Neighbors',
      neighborRows,
      [{ id: 'best' }, { id: 'topology' }],
      [
        ['path ranges', 'static'],
        ['ancestors/LCA', 'static'],
        ['distance updates over tree', 'static'],
        ['path queries with link/cut', 'dynamic'],
      ],
    ),
    highlight: { found: ['centroid:best'], compare: ['lct:topology'] },
    explanation: `Use centroid decomposition when the query is global over distances through a static tree, not just one contiguous path. Compare against ${neighborRows.length - 1} alternative tree structures: ${neighborRows.filter(r => r.id !== 'centroid').map(r => r.label).join(', ')}.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'This visualization has two modes. "Find centroid" walks through the algorithm that picks a balanced cut node from a tree: it computes subtree sizes, tests candidates, and highlights the winner. "Nearest marked" shows a prebuilt centroid index answering distance queries -- you will see the query node walk up its centroid ancestor chain, checking each checkpoint.',
        'Each frame is one operation. Bright nodes are currently being examined or updated; dimmed nodes are finished or removed from the active component. Two separate structures appear on screen: the original tree (where real edges and distances live) and the centroid tree (the recursive index built by balanced cuts). They share the same nodes but have different edges -- do not confuse them.',
        'Hit play and let it run at reading pace, or drag the slider to jump around. The most important thing to watch is the ancestor-chain walk during updates and queries: that short walk is the entire reason this technique is fast.',
        {type: 'image', src: './assets/gifs/centroid-decomposition.gif', alt: 'Animated walkthrough of the centroid decomposition visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Picture a fixed tree with n = 100,000 nodes -- a network of servers, or cities, or routers. Some nodes are "marked" (active, healthy, open for business), and the set of marked nodes changes over time. The topology never changes. You need to answer two operations: "mark node x" and "which marked node is closest to node v?"',
        'The naive answer is BFS from v every time a query arrives. That costs O(n) per query. With Q = 100,000 queries, you pay O(nQ) = 10^10 operations. On a modern machine doing ~10^9 simple operations per second, that is 10 seconds of pure traversal -- and the constant factors make it worse. You need sub-linear queries.',
        {type: 'callout', text: 'A centroid tree turns one static tree into logarithmically many balanced distance checkpoints that every update and query can reuse.'},
        'Centroid decomposition builds a second tree -- the centroid tree -- as an index over the original. This index has height O(log n), so every mark and every query touches at most O(log n) nodes. For n = 100,000, that is at most 17 steps per operation instead of 100,000. The original tree is untouched; the centroid tree is a separate lookup structure layered on top.',
        'The constraint is "static tree." Edges never change. Only node metadata (marks, weights, colors) changes. If the topology changes, the index is invalid. This is a technique for fixed-shape trees with evolving node labels.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Given a query "nearest marked node to v," the simplest correct algorithm is BFS from v. Expand outward one hop at a time across the tree. The first marked node you reach is the answer. No preprocessing, no extra memory, trivially correct.',
        {type: 'image', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tree_graph.svg', alt: 'Small labeled undirected tree graph', caption: 'A tree has one simple path between any two nodes, which makes distance summaries meaningful once cuts are balanced. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Tree_graph.svg.'},
        'You might try caching: store each node\'s nearest-marked answer so repeated queries are O(1). But when a new node gets marked, every cached answer in the tree can go stale. Node v\'s nearest marked node was 50 hops away in one direction; now a freshly marked node is 2 hops away in a completely different subtree. Figuring out which cached entries to invalidate is itself an O(n) scan, so caching does not help asymptotically.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Heavy-Light Decomposition (HLD) handles path-aggregate queries efficiently -- "what is the sum (or max) of values along the path from u to v?" Binary Lifting computes lowest common ancestors in O(log n). But nearest-marked-node is not a path query between two known endpoints. The answer could be any node in any branch. No single path decomposition captures it.',
        'What you need is a summary structure at every scale of the tree -- from the whole tree down to small local neighborhoods. Each summary must track how far away the nearest marked node is, and it must update cheaply when marks change. A flat path decomposition gives you one scale. You need logarithmically many nested scales, each covering roughly half the nodes of the one above it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Cut by size, not by depth. Define the centroid of a tree (or connected component) as a node whose removal leaves no remaining piece larger than half the original component. Every tree has at least one such node -- this is a theorem, not an assumption. (Proof sketch: start at any node, move toward the heaviest subtree; the "heaviest subtree" size strictly decreases while the "rest of tree" size increases; they must cross at or below n/2.)',
        {type: 'image', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Binary_tree.svg', alt: 'Rooted binary tree diagram', caption: 'A rooted tree view helps separate original parent-child structure from the extra centroid-parent index built during decomposition. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.'},
        'Find the centroid of the full tree. Remove it. Each remaining piece is a connected component of size at most n/2. Recursively find the centroid of each piece. The centroids, linked parent-to-child by which recursion level found them, form the centroid tree. Because every level halves component sizes, the centroid tree has height at most log2(n). For n = 100,000, that is at most 17 levels.',
        'The centroid tree is not a subtree of the original. It has the same node set but entirely different parent-child relationships. Node A might be node B\'s parent in the original tree but B\'s grandchild in the centroid tree. The two structures coexist: the original tree stores real edge distances, and the centroid tree stores which checkpoints each node must consult.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build phase. Start with the full tree as one component. Run a DFS to compute subtree sizes. Walk from any node toward its heaviest child until no child\'s subtree exceeds half the component size -- that node is the centroid. Record it, mark it "removed" (conceptually -- you just skip it in future DFS calls), and recurse on each remaining connected piece. Each piece\'s centroid becomes a child of the current centroid in the centroid tree. Total build cost: O(n) work per level times O(log n) levels = O(n log n).',
        'Precomputation. For every node v, store an array of its centroid ancestors (the path from v up to the root of the centroid tree) and the original-tree distance from v to each ancestor. If v has centroid ancestors [c_0 = v itself, c_1, c_2, ..., c_k], also store [dist(v, c_0), dist(v, c_1), ..., dist(v, c_k)]. There are at most log2(n) ancestors per node, so this costs O(n log n) space total. Distances are computed once during construction by BFS/DFS from each centroid within its component.',
        'Update (mark node x). Walk x\'s centroid ancestor chain. At each ancestor c_i, set best[c_i] = min(best[c_i], dist(x, c_i)). Here best[c_i] tracks the shortest original-tree distance from c_i to any marked node that has reported to it. Initially every best[] value is infinity. This update touches O(log n) ancestors, each in O(1) time.',
        'Query (nearest marked node to v). Walk v\'s centroid ancestor chain. At each ancestor c_i, compute candidate = best[c_i] + dist(v, c_i). Return the minimum candidate over all ancestors. The logic: v is dist(v, c_i) away from checkpoint c_i in the original tree, and the nearest marked node that reported to c_i is best[c_i] away from c_i. The triangle inequality in a tree is an equality along the unique path, so this sum is a valid upper bound, and the correct answer always appears at some level.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one fact: for any two nodes x and v in the original tree, there exists a centroid c that is an ancestor of both x and v in the centroid tree, and c lies on the unique path between x and v in the original tree. Specifically, c is the centroid of the smallest component during construction that still contained both x and v. One level deeper, x and v were separated into different sub-components (or c is one of them).',
        'Because c is on the x-to-v path in the original tree, dist(x, v) = dist(x, c) + dist(c, v). When x was marked, it set best[c] <= dist(x, c). When v queries, it computes best[c] + dist(v, c) <= dist(x, c) + dist(c, v) = dist(x, v). So the true nearest marked node\'s distance always appears as one of the candidates. Other ancestors may produce worse candidates -- the minimum filters them out.',
        'This is a completeness argument: no optimal pair is missed. The O(log n) bound comes from the centroid tree height. The correctness comes from the separating-centroid property.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build: O(n log n) time and space. Each of the O(log n) recursion levels does O(n) total work (one DFS pass over all components at that level). The ancestor-distance arrays consume O(n log n) integers total.',
        'Update: O(log n) time. Walk the ancestor chain (at most log2(n) entries), do one min-comparison and one array read per step. No heap, no rebalancing -- just a scan.',
        'Query: O(log n) time. Same chain walk, one addition and one min-comparison per step.',
        'Space: O(n log n). Each node stores O(log n) ancestor pointers and distances. The best[] array is O(n) -- one slot per node. For n = 100,000 with log2(n) ~ 17, total storage is about 2 * 100,000 * 17 = 3.4 million integers for ancestor data, plus 100,000 for best[]. At 4 bytes each, that is under 14 MB.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network monitoring. A tree-shaped service topology (common in hierarchical data centers) where nodes go healthy or unhealthy. "Which is the nearest healthy node to server v?" is nearest-marked-node. The topology is fixed hardware; health status changes constantly. Updates are O(log n) per health-check event; queries are O(log n) per routing decision.',
        'Competitive programming. Centroid decomposition is a standard technique for USACO Platinum and Codeforces Division 1 problems. Typical patterns: "count pairs of nodes with tree-distance exactly k" (at each centroid, count paths passing through it from different child subtrees), "find the node minimizing the sum of distances to a set of marked nodes" (aggregate over centroid ancestors), and xor-distance queries on weighted trees.',
        'Geographic routing on spanning trees. After simplifying a road graph into a spanning tree, centroid decomposition supports fast nearest-facility queries. The tree structure is static (road layout); facility availability (open stores, available ambulances) changes in real time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Dynamic topology. If edges are inserted or deleted, the centroid tree can become arbitrarily wrong. Adding one edge can change which node is the centroid of a component, invalidating the entire decomposition. Rebuilding costs O(n log n), which erases the per-operation savings. For trees with changing edges, use Link-Cut Trees or Euler Tour Trees instead.',
        'Mark deletion. The basic version uses a scalar best[c] that only decreases (we take min on every update). If marks can be removed, best[c] might need to increase, which means you need the second-best value, then the third-best, and so on. The standard fix is a min-heap or sorted multiset at each centroid, which raises update cost to O(log^2 n) and adds significant implementation complexity.',
        'Confusing centroid with center. The centroid minimizes the size of the largest remaining component after removal. The center minimizes eccentricity (maximum distance to any node). These are different nodes in general. On a path graph 1-2-3-4-5-6-7, both happen to be node 4. On an asymmetric tree -- say a star with one long arm -- they diverge. Using the center instead of the centroid produces an unbalanced decomposition whose height can be Omega(n), destroying the logarithmic guarantee.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Tree: 7 nodes, edges 1-2, 2-3, 3-4, 4-5, 5-6, 5-7. This is a path 1-2-3-4-5 with node 5 branching to leaves 6 and 7. All edge weights are 1.',
        'Build, level 0: full tree, n = 7. Test node 4 as centroid. Removing node 4 leaves two components: {1,2,3} with size 3 and {5,6,7} with size 3. Both sizes are <= floor(7/2) = 3. Node 4 is a valid centroid. It becomes the centroid tree root.',
        'Build, level 1a: component {1,2,3}, n = 3. Removing node 2 leaves {1} (size 1) and {3} (size 1). Both <= floor(3/2) = 1. Node 2 is the centroid, becomes a child of node 4 in the centroid tree. Nodes 1 and 3 are singletons, trivially their own centroids, children of node 2.',
        'Build, level 1b: component {5,6,7}, n = 3. Removing node 5 leaves {6} (size 1) and {7} (size 1). Node 5 is the centroid, child of node 4. Nodes 6 and 7 become children of node 5. Final centroid tree: root 4, children {2, 5}; node 2 has children {1, 3}; node 5 has children {6, 7}. Height = 2, which satisfies log2(7) ~ 2.8.',
        'Precompute ancestor chains. Node 1\'s centroid ancestors: [1, 2, 4] with distances [0, 1, 3]. Node 7\'s centroid ancestors: [7, 5, 4] with distances [0, 1, 2]. (Distance from 7 to 4 in the original tree: 7->5->4, length 2.)',
        'Mark node 1. Walk ancestors: best[1] = min(inf, 0) = 0. best[2] = min(inf, dist(1,2)) = min(inf, 1) = 1. best[4] = min(inf, dist(1,4)) = min(inf, 3) = 3. Three updates, done.',
        'Query: nearest marked node to node 7. Walk ancestors: candidate from centroid 7: best[7] + dist(7,7) = inf + 0 = inf (no mark reported here). Candidate from centroid 5: best[5] + dist(7,5) = inf + 1 = inf (no mark reported here either). Candidate from centroid 4: best[4] + dist(7,4) = 3 + 2 = 5. Minimum is 5. The actual path 7-5-4-3-2-1 has length 5 in the original tree. Correct answer found by checking 3 centroids instead of visiting all 7 nodes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references. The CP-Algorithms tutorial at https://cp-algorithms.com/graph/centroid_decomposition.html gives pseudocode, proofs, and implementation details. The USACO Guide platinum section at https://usaco.guide/plat/centroid covers contest applications with graded problem sets. For the original theory, see the 1869 paper by Jordan proving centroid existence in any tree.',
        'Prerequisites: understand tree traversals (DFS, BFS) and how to compute subtree sizes. Binary Lifting for LCA is needed if you want to compute original-tree distances in O(log n) per pair. Study next: Heavy-Light Decomposition for path-aggregate queries (sum, max along a path), Euler Tour Trees or Link-Cut Trees for trees with dynamic edges, and Virtual Trees (Auxiliary Trees) for compressing a tree to just the relevant marked nodes before running queries.',
      ],
    },
  ],
};
