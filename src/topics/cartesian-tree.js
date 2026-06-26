// Cartesian tree: in-order array positions plus heap order by value.

import { treeState, sequenceState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cartesian-tree',
  title: 'Cartesian Tree',
  category: 'Data Structures',
  summary: 'A tree whose in-order traversal is the array order and whose heap property exposes range minima and RMQ-to-LCA reductions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rmq reduction', 'linear construction'], defaultValue: 'rmq reduction' },
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

function arrayQueue(title) {
  return sequenceState('queue', [
    { id: 'i0', value: 'a[0]=5' },
    { id: 'i1', value: 'a[1]=2' },
    { id: 'i2', value: 'a[2]=6' },
    { id: 'i3', value: 'a[3]=1' },
    { id: 'i4', value: 'a[4]=3' },
    { id: 'i5', value: 'a[5]=4' },
  ], { title });
}

function cartesianTree(title) {
  return treeState([
    { id: 'n3', value: '3:1', left: 'n1', right: 'n4' },
    { id: 'n1', value: '1:2', left: 'n0', right: 'n2' },
    { id: 'n0', value: '0:5' },
    { id: 'n2', value: '2:6' },
    { id: 'n4', value: '4:3', right: 'n5' },
    { id: 'n5', value: '5:4' },
  ], 'n3', { title });
}

function stackState(items, title) {
  return sequenceState('stack', items.map((item) => ({ id: item.id, value: item.value })), { title });
}

function* rmqReduction() {
  const rootActive = ['i3'];
  const otherItems = ['i0', 'i1', 'i2', 'i4', 'i5'];
  yield {
    state: arrayQueue('Array: [5, 2, 6, 1, 3, 4]'),
    highlight: { active: rootActive, compare: otherItems },
    explanation: `A min Cartesian tree starts from an array. The smallest value becomes the root (highlighted at position ${rootActive[0].slice(1)}). Everything left of it becomes the left subtree, everything right of it becomes the right subtree, recursively.`,
  };

  const treeFound = ['n3'];
  const treeActive = ['n1', 'n4'];
  const treeCompare = ['n0', 'n2', 'n5'];
  yield {
    state: cartesianTree('In-order positions stay sorted; values obey min-heap order'),
    highlight: { found: treeFound, active: treeActive, compare: treeCompare },
    explanation: `Read the tree in-order and you recover indexes 0, 1, 2, 3, 4, 5. Read parent-to-child values and every parent is smaller than its children. Those ${treeActive.length + treeCompare.length + treeFound.length} nodes make the tree unique when values are distinct.`,
    invariant: `In-order traversal equals array order; parent value <= child value (root is ${treeFound[0]}).`,
  };

  const rmqEndpoints = ['n0', 'n2'];
  const lcaNode = ['n1'];
  yield {
    state: cartesianTree('RMQ [0, 2] becomes LCA of endpoints 0 and 2'),
    highlight: { active: rmqEndpoints, found: lcaNode, compare: ['n3'] },
    explanation: `The minimum in range [0,2] is value 2 at index ${lcaNode[0].slice(1)}. In the Cartesian tree, that node is the lowest common ancestor of endpoints ${rmqEndpoints[0].slice(1)} and ${rmqEndpoints[1].slice(1)}. RMQ has become an LCA query.`,
  };

  const toolRows = [
    { id: 'scan', label: 'scan range' },
    { id: 'segment', label: 'Segment Tree' },
    { id: 'sparse', label: 'Sparse Table' },
    { id: 'cart', label: 'Cartesian Tree + LCA' },
  ];
  yield {
    state: labelMatrix(
      'Range-minimum tools',
      toolRows,
      [
        { id: 'update', label: 'updates?' },
        { id: 'query', label: 'query' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['yes', 'O(k)', 'simple baseline'],
        ['yes', 'O(log n)', 'dynamic ranges'],
        ['no', 'O(1)', 'static idempotent queries'],
        ['no', 'O(1) after LCA prep', 'structure equivalence'],
      ],
    ),
    highlight: { active: ['cart:lesson'], compare: ['segment:query', 'sparse:query'] },
    explanation: `Cartesian trees are less about replacing Segment Trees in ordinary code and more about showing a deep equivalence: static RMQ can be reduced to LCA. This matrix compares ${toolRows.length} approaches.`,
  };
}

function* linearConstruction() {
  const initialStack = [{ id: 's0', value: '0:5' }];
  yield {
    state: stackState(initialStack, 'Monotonic stack holds the right spine'),
    highlight: { active: ['s0'] },
    explanation: `The linear construction scans left to right and keeps the right spine of the partial Cartesian tree in a monotonic stack (starting with ${initialStack[0].value}). New smaller values pop larger spine nodes.`,
  };

  const nextStack = [
    { id: 's1', value: '1:2' },
    { id: 's2', value: '2:6' },
  ];
  yield {
    state: stackState(nextStack, 'After 2 arrives, 5 is popped under it; then 6 extends the spine'),
    highlight: { active: ['s1', 's2'] },
    explanation: `When value ${nextStack[0].value.split(':')[1]} arrives, value 5 can no longer stay above it because the heap property requires smaller values nearer the root. Later value ${nextStack[1].value.split(':')[1]} is larger, so it becomes the current right child.`,
  };

  const finalRoot = ['n3'];
  const finalActive = ['n1', 'n4'];
  yield {
    state: cartesianTree('Final tree after scanning all values once'),
    highlight: { found: finalRoot, active: finalActive, compare: ['n0', 'n2', 'n5'] },
    explanation: `Value 1 pops the spine and becomes the root (${finalRoot[0]}). Values 3 and 4 then attach on the right. Each array item is pushed once and popped at most once, matching Monotonic Queue style amortization.`,
  };

  const constructionRows = [
    { id: 'spine', label: 'right spine stack' },
    { id: 'pop', label: 'pop larger values' },
    { id: 'attach', label: 'attach last popped' },
    { id: 'finish', label: 'finish scan' },
  ];
  yield {
    state: labelMatrix(
      'Construction invariant',
      constructionRows,
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['candidate ancestors', 'O(1) amortized update'],
        ['new value must sit above them', 'one pop per item'],
        ['last popped becomes left child', 'pointer fixup'],
        ['tree is unique', 'O(n) total'],
      ],
    ),
    highlight: { found: ['finish:cost'], active: ['spine:meaning', 'pop:cost'] },
    explanation: `The algorithm is another expression of dominance across ${constructionRows.length} steps. A smaller later value dominates larger nodes on the right spine until it finds a smaller ancestor.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rmq reduction') yield* rmqReduction();
  else if (view === 'linear construction') yield* linearConstruction();
  else throw new InputError('Pick a Cartesian-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The "rmq reduction" view starts from a flat array, builds the Cartesian tree, and then demonstrates how a range minimum query becomes a lowest-common-ancestor query on that tree. The "linear construction" view shows the monotonic-stack algorithm building the same tree in a single left-to-right scan. Use the slider or play button to step through frames.',
        {type: 'image', src: './assets/gifs/cartesian-tree.gif', alt: 'Animated walkthrough of the cartesian tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Found (green) nodes mark results that are now established. Active (highlighted) nodes are the current operation focus. Compare (gray) nodes show alternatives or excluded items. At each frame, check: does the in-order traversal still match array order, and does every parent have a value smaller than its children?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some array problems have a hidden tree inside them. An array gives one order: positions from left to right. The values give a second order: smaller values dominate larger ones when the question is about minima. A Cartesian tree combines both orders into a single binary tree. Its in-order traversal returns the original array positions, and its heap property makes every parent\'s value smaller than its children\'s values.',
        {type: `callout`, text: `A Cartesian tree fuses array order and heap order so range minima become ancestor questions.`},
        'This combination matters because it turns a flat question -- "what is the minimum value between positions i and j?" -- into a tree question: "what is the lowest common ancestor of nodes i and j?" That is not just a trick for one data structure. It is a bridge connecting arrays, trees, range minimum query (RMQ) preprocessing, suffix-array LCP queries, and divide-and-conquer decompositions. Understanding the Cartesian tree means understanding why RMQ and LCA are structurally the same problem.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest way to answer a range minimum query is to scan the requested range and return the smallest value. For one or two queries this is hard to beat. It fails when a static array receives many queries: a range of length k costs O(k) every time, so millions of long-range queries repeat the same comparisons endlessly.',
        'A segment tree is the standard next step: O(log n) per query with O(n) space, and it supports updates. A sparse table gives O(1) queries after O(n log n) preprocessing for static data. Both are practical, but neither explains the deeper equivalence between RMQ and lowest-common-ancestor queries. They answer RMQ; they do not reveal why RMQ and LCA are the same static problem.',
        'The obvious way to build a Cartesian tree follows the recursive definition directly: find the minimum, make it the root, recurse on the left side and the right side. This is correct but can degenerate to O(n^2) on sorted or nearly sorted input, because each recursive minimum search scans almost the entire remaining subarray. The definition teaches the shape; it is not the algorithm you want at scale.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is the cost of repeated minimum searches. The recursive definition finds the global minimum (O(n)), splits, then finds the minimum of each half, and so on. On a sorted array like [1, 2, 3, ..., n], every split produces one empty side and one side of length n-1. The total work is n + (n-1) + (n-2) + ... + 1 = n(n+1)/2, which is O(n^2). You need a construction algorithm that never rescans.',
        'The second wall is the gap between answering RMQ and understanding RMQ. Segment trees and sparse tables give you fast answers, but they hide the structural reason that range minima have tree-shaped solutions. Without the Cartesian tree, the connection between RMQ and LCA remains an opaque theorem rather than a visible construction.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A Cartesian tree is defined by two invariants enforced simultaneously. First, in-order traversal visits nodes in original array index order: if the array is [5, 2, 6, 1, 3, 4], the nodes appear as index 0, 1, 2, 3, 4, 5 when read left-root-right. Second, every parent has a value less than or equal to its children (min-heap order). The root is therefore the minimum of the full array.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg`, alt: `Binary tree diagram with parent and child nodes`, caption: `The in-order traversal of a binary tree gives Cartesian trees their array-order half of the invariant. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.`},
        'With distinct values, those two invariants define exactly one tree. The global minimum must be the root (heap order puts it above everything). In-order order forces every element to the left of that minimum into the left subtree and every element to the right into the right subtree. The same argument applies recursively at every node. Equal values require a tie-breaking policy (leftmost-minimum or rightmost-minimum); without one, the shape is not unique.',
        'The key consequence: for any range [i, j], the minimum value in that range is the value at the lowest common ancestor of nodes i and j. The array order is preserved as in-order traversal; the priority order is preserved as the ancestor relation. RMQ is LCA.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The linear construction uses a monotonic stack that maintains the right spine of the partial Cartesian tree -- the path you reach by repeatedly following right-child pointers from the current root. For a min-Cartesian tree, values on this spine are increasing from root to leaf.',
        'Scan the array left to right. For each new value, pop stack elements that are larger than the new value. The last popped node becomes the new node\'s left child (it was the rightmost node that the new value now dominates). The new node becomes the right child of whatever remains on top of the stack (the nearest smaller ancestor to its left). Then push the new node.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/69/Min-heap.png`, alt: `Complete binary min heap with the smallest value at the root`, caption: `The heap side of a Cartesian tree is a parent-value order constraint, even though the shape is forced by the array order rather than heap array layout. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Min-heap.png.`},
        'Each element is pushed exactly once and popped at most once, so the total work is O(n). The stack is not an arbitrary worklist; it is a compact representation of exactly the part of the tree that a future value can still displace. Nodes that have already left the right spine have a smaller ancestor to their right and will never be rearranged by later array elements.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Take any range [i, j]. The nodes for indexes i through j form a contiguous slice in the tree\'s in-order traversal. The lowest common ancestor (LCA) of nodes i and j is the shallowest node whose subtree contains both endpoints. Because the subtree is contiguous in in-order order, that LCA\'s subtree covers the entire interval [i, j].',
        'Heap order then supplies the minimum. The LCA node sits above every descendant inside the interval and has a value no larger than any of them (otherwise it would violate the heap property). The LCA is precisely the root of the subproblem spanning [i, j] -- the same node that the recursive definition would have chosen as the minimum of that range. Therefore RMQ(i, j) = value at LCA(node_i, node_j).',
        'This equivalence is bidirectional. Cartesian trees reduce RMQ to LCA. Euler-tour techniques reduce LCA back to RMQ. The two problems are the same problem wearing different hats, and the Cartesian tree is the structure that makes this visible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The naive recursive construction costs O(n^2) in the worst case (sorted input). The monotonic-stack construction costs O(n) time and O(n) space: every element enters and leaves the stack at most once. The resulting tree stores n nodes with left, right, and optionally parent pointers.',
        'Query cost depends on the LCA structure layered on top. With Euler-tour + sparse-table LCA preprocessing, static RMQ queries cost O(1) after O(n) or O(n log n) preprocessing depending on the method. A sparse table alone gives O(1) static RMQ with O(n log n) memory. A segment tree gives O(log n) per query but supports updates.',
        'The tradeoff is not "Cartesian tree always beats segment tree." The tree is best when the static RMQ-to-LCA equivalence matters -- for theoretical reductions, for suffix-array algorithms, or when the hierarchy of minima is itself meaningful. A segment tree wins when the array changes. A sparse table is often simpler when you only need static idempotent range queries and do not care about the structural equivalence.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cartesian trees appear in suffix-array algorithms, where longest-common-prefix queries between suffixes reduce to RMQ over the LCP array. The Cartesian tree explains why that LCP array has a natural ancestor structure: the LCP of two suffixes is determined by the minimum LCP in the range between them.',
        'They also appear in divide-and-conquer decompositions where the minimum (or maximum) of an interval splits the problem into independent left and right subproblems. The largest rectangle in a histogram is a classic example: the shortest bar in a range limits any rectangle spanning the range, then the left and right sides become independent subproblems. The Cartesian tree makes that recursive split structure explicit as a tree you can traverse.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure mode is unclear tie handling. Equal values are common in real arrays. If the builder, query layer, and tests do not agree on leftmost-minimum versus rightmost-minimum, two valid-looking trees produce different answer indexes for the same query. Decide the tie policy once and bake it into the comparison function everywhere.',
        'The second failure is using the tree for the wrong workload. Cartesian trees are static-friendly. If array values change frequently, the heap-order and in-order constraints can force cascading structural changes. Rebuilding the tree after every update throws away the construction advantage.',
        'The third failure is confusing value minima with index minima. RMQ usually asks for the index of the minimum value in a range, not just the value itself. If the implementation returns only the value, it cannot break ties, reconstruct intervals, or feed downstream algorithms that need positions. Always store both value and original index in each node.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array: [5, 2, 6, 1, 3, 4]. The global minimum is 1 at index 3, so index 3 becomes the root. Left subarray [5, 2, 6]: minimum is 2 at index 1, so index 1 is the left child of index 3. Index 1\'s left child is index 0 (value 5), its right child is index 2 (value 6). Right subarray [3, 4]: minimum is 3 at index 4, so index 4 is the right child of index 3. Index 4\'s right child is index 5 (value 4). The final tree has root 3:1, left subtree rooted at 1:2, right subtree rooted at 4:3.',
        'Query RMQ(0, 2): endpoints are nodes 0 and 2. Their LCA is node 1 (value 2). That is the minimum of [5, 2, 6]. Query RMQ(2, 5): endpoints are nodes 2 and 5. Their LCA is node 3 (value 1). That is the minimum of [6, 1, 3, 4]. Query RMQ(4, 5): endpoints are nodes 4 and 5. Their LCA is node 4 (value 3). That is the minimum of [3, 4]. Every range minimum is an ancestor lookup.',
        'Stack construction of the same tree. Push 0:5. Value 2 arrives: pop 5 (5 > 2), so node 0 becomes node 1\'s left child. Push 1:2. Value 6 arrives: 6 > 2, so node 2 becomes node 1\'s right child. Push 2:6. Value 1 arrives: pop 6 (6 > 1), pop 2 (2 > 1). Last popped subtree (rooted at node 1) becomes node 3\'s left child. Push 3:1. Value 3 arrives: 3 > 1, so node 4 becomes node 3\'s right child. Push 4:3. Value 4 arrives: 4 > 3, so node 5 becomes node 4\'s right child. Push 5:4. Stack drains; root is node 3. Total pushes: 6. Total pops: 3. Total operations: 9 = O(n).',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The Cartesian tree was introduced in Jean Vuillemin\'s "A Unifying Look at Data Structures" (1980). For the RMQ-LCA equivalence, see Bender and Farach-Colton\'s "The LCA Problem Revisited" (2000). Gabow, Bentley, and Tarjan\'s work on scaling and linear-time algorithms provides additional depth.',
        'Study Monotonic Stack for the right-spine construction pattern in its simplest form. Study Segment Tree and Lazy Propagation for mutable range queries. Study Sparse Table for the other main O(1) static RMQ path. Study Suffix Array and LCP to see how RMQ appears in string search. Study Tree Traversals and Binary Search Tree if the in-order invariant is not yet automatic.',
      ],
    },
  ],
};
