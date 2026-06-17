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
  yield {
    state: arrayQueue('Array: [5, 2, 6, 1, 3, 4]'),
    highlight: { active: ['i3'], compare: ['i0', 'i1', 'i2', 'i4', 'i5'] },
    explanation: 'A min Cartesian tree starts from an array. The smallest value becomes the root. Everything left of it becomes the left subtree, everything right of it becomes the right subtree, recursively.',
  };

  yield {
    state: cartesianTree('In-order positions stay sorted; values obey min-heap order'),
    highlight: { found: ['n3'], active: ['n1', 'n4'], compare: ['n0', 'n2', 'n5'] },
    explanation: 'Read the tree in-order and you recover indexes 0, 1, 2, 3, 4, 5. Read parent-to-child values and every parent is smaller than its children. Those two invariants make the tree unique when values are distinct.',
    invariant: 'In-order traversal equals array order; parent value <= child value.',
  };

  yield {
    state: cartesianTree('RMQ [0, 2] becomes LCA of endpoints 0 and 2'),
    highlight: { active: ['n0', 'n2'], found: ['n1'], compare: ['n3'] },
    explanation: 'The minimum in range [0,2] is value 2 at index 1. In the Cartesian tree, that node is the lowest common ancestor of endpoints 0 and 2. RMQ has become an LCA query.',
  };

  yield {
    state: labelMatrix(
      'Range-minimum tools',
      [
        { id: 'scan', label: 'scan range' },
        { id: 'segment', label: 'Segment Tree' },
        { id: 'sparse', label: 'Sparse Table' },
        { id: 'cart', label: 'Cartesian Tree + LCA' },
      ],
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
    explanation: 'Cartesian trees are less about replacing Segment Trees in ordinary code and more about showing a deep equivalence: static RMQ can be reduced to LCA.',
  };
}

function* linearConstruction() {
  yield {
    state: stackState([{ id: 's0', value: '0:5' }], 'Monotonic stack holds the right spine'),
    highlight: { active: ['s0'] },
    explanation: 'The linear construction scans left to right and keeps the right spine of the partial Cartesian tree in a monotonic stack. New smaller values pop larger spine nodes.',
  };

  yield {
    state: stackState([
      { id: 's1', value: '1:2' },
      { id: 's2', value: '2:6' },
    ], 'After 2 arrives, 5 is popped under it; then 6 extends the spine'),
    highlight: { active: ['s1', 's2'] },
    explanation: 'When value 2 arrives, value 5 can no longer stay above it because the heap property requires smaller values nearer the root. Later value 6 is larger, so it becomes the current right child.',
  };

  yield {
    state: cartesianTree('Final tree after scanning all values once'),
    highlight: { found: ['n3'], active: ['n1', 'n4'], compare: ['n0', 'n2', 'n5'] },
    explanation: 'Value 1 pops the spine and becomes the root. Values 3 and 4 then attach on the right. Each array item is pushed once and popped at most once, matching Monotonic Queue style amortization.',
  };

  yield {
    state: labelMatrix(
      'Construction invariant',
      [
        { id: 'spine', label: 'right spine stack' },
        { id: 'pop', label: 'pop larger values' },
        { id: 'attach', label: 'attach last popped' },
        { id: 'finish', label: 'finish scan' },
      ],
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
    explanation: 'The algorithm is another expression of dominance. A smaller later value dominates larger nodes on the right spine until it finds a smaller ancestor.',
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
      heading: 'Why This Exists',
      paragraphs: [
        `A Cartesian tree exists because some array problems have a hidden tree inside them. The array gives one order: positions from left to right. The values give another order: smaller values should dominate larger values when the question is about minima. A Cartesian tree combines those orders into one structure. Its in-order traversal returns the original array positions, while its heap property makes smaller values ancestors of larger values.`,
        `That combination is useful for range minimum queries. Given an array and a query range [i, j], the answer is the index of the smallest value in that interval. A Cartesian tree turns that flat question into a tree question: the minimum in [i, j] is the lowest common ancestor of the nodes for i and j. This is not only a trick for one data structure. It is a bridge between arrays, trees, RMQ preprocessing, suffix-array LCP queries, and divide-and-conquer decompositions.`,
        `The structure is also a teaching object. It shows how two invariants can define a unique shape. Preserve array order in traversal, enforce heap order by value, and the hierarchy of minima becomes visible.`,
      ],
    },
    {
      heading: 'Why The Obvious Approach Fails',
      paragraphs: [
        `The simplest RMQ algorithm scans the requested range and returns the smallest value. It is easy to write and hard to beat for one or two queries. It fails when a static array receives many queries: a range of length k costs O(k) every time, so a workload with millions of long ranges repeats the same comparisons again and again.`,
        `A segment tree is the practical next step. It supports updates and answers range minima in O(log n). A sparse table answers static idempotent queries in O(1) after preprocessing. Those structures are often the right engineering choice, but they hide a deeper equivalence. They tell you how to answer RMQ; they do not explain why RMQ and lowest common ancestor are essentially the same static problem.`,
        `The obvious way to build a Cartesian tree follows the definition: find the minimum value, make it the root, recursively build the left side from elements before the minimum, and recursively build the right side from elements after it. That is clear but can be O(n^2). A sorted or nearly sorted array makes each recursive minimum search scan almost the whole remaining subarray. The definition teaches the shape; it is not the implementation you want at scale.`,
      ],
    },
    {
      heading: 'Core Invariant',
      paragraphs: [
        `A min Cartesian tree has two invariants. First, in-order traversal visits nodes in original array index order. If the array is [5, 2, 6, 1, 3, 4], the nodes must appear as index 0, index 1, index 2, index 3, index 4, index 5 when read left-root-right. Second, every parent has value less than or equal to its children. The root is therefore the minimum of the full array.`,
        `With distinct values, those two invariants define exactly one tree. The global minimum must be the root because heap order puts the smallest value above every other node. In-order traversal then forces every element left of that minimum into the left subtree and every element right of it into the right subtree. The same argument applies recursively. Equal values require a tie policy, such as always treating the leftmost minimum or rightmost minimum as smaller, otherwise the shape is not unique.`,
        `This dual-order view is the main idea. The array order is never discarded; it becomes the tree's in-order order. The priority order is never stored in a separate heap array; it becomes the ancestor relation.`,
      ],
    },
    {
      heading: 'How The Visual Model Teaches It',
      paragraphs: [
        `The RMQ view starts from the array because the tree should not feel like a separate object invented after the fact. The highlighted minimum becomes the root, and the remaining positions stay on their original sides. That teaches the recursive definition: pick the interval minimum, split left and right, and repeat.`,
        `The tree view then makes the two invariants visible at the same time. Read left-root-right and the indexes are still sorted. Read from parent to child and the values are heap ordered. The RMQ highlight shows the payoff: choosing two endpoint nodes and finding their lowest common ancestor recovers the minimum of the interval between them.`,
        `The linear-construction view teaches the implementation idea. The stack is the current right spine, not an arbitrary work list. When a smaller value arrives, it takes over the larger nodes it pops; when a larger value arrives, it extends the right spine. That is why the algorithm is linear: each node can be displaced from the spine only once.`,
      ],
    },
    {
      heading: 'Core Mechanism',
      paragraphs: [
        `The recursive mechanism is easy to state. Choose the minimum element as root. Build the left subtree from the prefix before that element. Build the right subtree from the suffix after that element. That gives a correct tree, but repeated minimum searches are too expensive.`,
        `The linear mechanism uses a monotonic stack. Scan the array from left to right. Maintain the right spine of the partial Cartesian tree: the path reached by repeatedly following right children from the current root. Values on this spine are increasing for a min Cartesian tree. When a new value arrives, pop larger spine nodes until the top is smaller than the new value. The last popped node becomes the new node's left child, and the new node becomes the right child of the remaining stack top if one exists. Then push the new node.`,
        `Each element is pushed once and popped at most once, so the construction is O(n). The stack is not an auxiliary guess; it is a compact representation of exactly the part of the tree that a future value can still dominate. Nodes away from the right spine already have a smaller ancestor to their right boundary and will never be rearranged by later array positions.`,
      ],
    },
    {
      heading: 'Why It Works: RMQ Becomes LCA',
      paragraphs: [
        `Take any range [i, j]. In the Cartesian tree, the nodes for indexes i through j form a contiguous slice in in-order traversal. The lowest common ancestor of the endpoint nodes i and j is the shallowest node whose subtree contains both endpoints. Because its subtree is contiguous in in-order order, it covers the whole interval between them.`,
        `Heap order then supplies the minimum. A node that is above both endpoints and still lies inside the interval must have value no larger than descendants inside that interval. The lowest such common ancestor is the root of exactly the subproblem spanning the interval, which is the minimum chosen by the recursive definition. Therefore RMQ(i, j) returns LCA(node i, node j).`,
        `The result is powerful because LCA has many fast preprocessing methods. A static RMQ problem can be converted to a tree, preprocessed for LCA, and answered through ancestor queries. The direction also works historically in algorithms: Euler tours of trees produce RMQ instances for LCA, and Cartesian trees show how the two formulations mirror each other.`,
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `Use the array [5, 2, 6, 1, 3, 4]. The minimum is 1 at index 3, so index 3 becomes the root. The left side [5, 2, 6] has minimum 2 at index 1, so index 1 becomes the left child of index 3. Its left child is index 0 with value 5, and its right child is index 2 with value 6. The right side [3, 4] has minimum 3 at index 4, so index 4 becomes the right child of index 3, with index 5 as its right child.`,
        `Now ask RMQ(0, 2). The endpoint nodes are index 0 and index 2. Their lowest common ancestor is index 1, whose value is 2. That is the minimum of [5, 2, 6]. Ask RMQ(2, 5). The endpoint nodes are index 2 and index 5. Their lowest common ancestor is index 3, value 1, which is the minimum of [6, 1, 3, 4].`,
        `The stack construction reaches the same tree without rescanning subarrays. Start with 5 on the stack. When 2 arrives, pop 5 because 2 must sit above it; 5 becomes 2's left child. When 6 arrives, it is larger than 2, so it becomes 2's right child. When 1 arrives, it pops 6 and 2, becomes the new root, and attaches the last popped subtree on its left. Values 3 and 4 then extend the right spine.`,
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        `Represent nodes by array index when possible. Each node needs left, right, and parent pointers or index arrays. Keeping the original index is essential because the answer to RMQ is usually an index, not just a value. If values can repeat, bake the tie policy into the comparison function. For a leftmost-minimum tree, compare by (value, index). For a rightmost-minimum tree, compare by (value, -index) or an equivalent rule.`,
        `The monotonic stack implementation should update parent pointers carefully. When popping nodes, remember the last popped node. After the pop loop, set lastPopped as the new node's left child. If the stack still has a top, set the new node as that top's right child. Push the new node. At the end, the bottom of the stack or the node with no parent is the root.`,
        `Do not use a Cartesian tree as a mutable range-minimum structure unless updates are rare and rebuilding is acceptable. A single value change can alter ancestors across a large part of the tree. For online point updates, Segment Tree & Lazy Propagation is the ordinary tool. For static queries where preprocessing is allowed, Sparse Table or Cartesian Tree plus LCA are the main competitors.`,
      ],
    },
    {
      heading: 'Cost And Tradeoffs',
      paragraphs: [
        `The recursive definition with naive minimum searches can take O(n^2) time. The monotonic-stack construction takes O(n) time and O(n) space because every element enters and leaves the stack at most once. The tree itself stores O(n) nodes and pointers.`,
        `RMQ query cost depends on the LCA structure placed on top. With common LCA preprocessing, static queries can be answered in O(1) after O(n) or O(n log n) preprocessing depending on the method. Sparse Table also gives O(1) static RMQ with O(n log n) memory and simpler implementation for many applications. Segment trees give O(log n) queries and updates with O(n) memory.`,
        `So the tradeoff is not "Cartesian tree always beats segment tree." The tree is best when the static RMQ-to-LCA equivalence is useful, when a proof or reduction matters, or when the hierarchy of minima is itself meaningful. A segment tree is better when updates matter. A sparse table is often easier when all you need is static idempotent range queries.`,
      ],
    },
    {
      heading: 'Where It Wins And Common Uses',
      paragraphs: [
        `Cartesian trees matter in static RMQ theory, suffix-array algorithms, LCP interval processing, histogram rectangle decomposition, nearest-smaller-element reasoning, and tree/array reductions. In suffix arrays, longest-common-prefix queries between suffixes reduce to RMQ over the LCP array. Cartesian trees help explain why that array has a natural ancestor structure.`,
        `They also matter in divide-and-conquer problems where the minimum or maximum of an interval splits the problem into independent left and right intervals. The largest rectangle in a histogram can be viewed this way: the smallest bar in a range limits any rectangle spanning the range, then the left and right sides become subproblems. A Cartesian tree makes that decomposition explicit.`,
      ],
    },
    {
      heading: 'Limits And Failure Modes',
      paragraphs: [
        `The first failure mode is unclear tie handling. Equal values are common in real arrays. If the builder, query layer, and tests do not agree on leftmost versus rightmost minimum, two valid-looking trees can produce different answer indexes. Decide the policy once and use it in comparisons and expected outputs.`,
        `The second failure is using the tree for the wrong workload. Cartesian trees are static-friendly. If an application changes array values frequently, the heap-order and in-order constraints can force many structural changes. Rebuilding after every update throws away the advantage.`,
        `The third failure is confusing value minima with index minima. RMQ usually asks for the index of the minimum value in a range. If the implementation returns only the value, it may be unable to break ties, reconstruct intervals, or feed later algorithms that need positions. Store both value and index.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Monotonic Stack next for the right-spine construction pattern in its simplest form. Study Segment Tree & Lazy Propagation for mutable range queries. Study Sparse Table: O(1) Range Minimum for the other main static RMQ path. Study Suffix Array & LCP to see why RMQ appears in string search. Study Tree Traversals and Binary Search Tree if the in-order invariant is not yet automatic. For a historical source, read Jean Vuillemin's "A Unifying Look at Data Structures," which introduced Cartesian trees as part of a broader view of data structures.`,
      ],
    },
  ],
};
