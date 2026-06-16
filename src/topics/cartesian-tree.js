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
      heading: 'What it is',
      paragraphs: [
        'A Cartesian tree for an array is a binary tree with two simultaneous invariants. Its in-order traversal returns the array positions in order, and it obeys heap order by array value. In a min Cartesian tree, every parent has value less than or equal to its children.',
        'The structure is a bridge between arrays, heaps, binary trees, and range-minimum queries. It belongs near Monotonic Queue, Segment Tree, Sparse Table, Binary Search Tree, and Tree Traversals because it converts a flat array problem into a tree problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The recursive definition is direct: choose the minimum value as root, build the left subtree from values to its left, and build the right subtree from values to its right. With distinct values, the tree is unique. The root of any subarray is the minimum value of that subarray.',
        'The linear construction uses a monotonic stack. Scan positions from left to right, maintain the right spine of the partial tree, pop larger values when a smaller value arrives, and reconnect the last popped node as the new node left child. Each index is pushed once and popped at most once, so construction is O(n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building by repeated minimum search is O(n log n) or O(n^2), depending on implementation. Building with the monotonic stack is O(n) time and O(n) space. Static RMQ can be reduced to Lowest Common Ancestor on the Cartesian tree: the minimum in range [i, j] is the LCA of nodes i and j.',
        'That reduction is mainly a theory and preprocessing lesson. If the array changes, Segment Tree or Fenwick Tree variants are usually a better fit. If queries are static and idempotent, Sparse Table is often simpler.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cartesian trees appear in RMQ and LCA algorithms, suffix-array LCP range queries, nearest-smaller-value problems, histogram rectangle algorithms, parsing of priority-ordered intervals, and geometric data structures. The structure makes an implicit hierarchy visible.',
        'A complete case study is a suffix-array search tool. The LCP array tells how many characters adjacent suffixes share. Range minimum over LCP intervals answers longest-common-prefix queries between suffixes. A Cartesian tree exposes those range minima as ancestors, connecting string search to tree navigation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A Cartesian tree is not sorted by value in-order. It is ordered by index in-order and by value vertically. Ties need a deterministic rule such as stable leftmost minimum. Another trap is treating it as a dynamic range structure; the clean RMQ reduction assumes the array is static.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Vuillemin, A Unifying Look at Data Structures, at https://www.cs.princeton.edu/courses/archive/spr09/cos423/Lectures/geo-st.pdf. Study Segment Tree, Sparse Table, Suffix Array & LCP, Monotonic Queue, Tree Traversals, and Binary Search Tree next.',
      ],
    },
  ],
};
