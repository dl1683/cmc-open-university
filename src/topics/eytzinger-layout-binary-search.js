// Eytzinger layout: store sorted keys in breadth-first binary-search-tree order
// so repeated searches get predictable branches and cache prefetch behavior.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'eytzinger-layout-binary-search',
  title: 'Eytzinger Layout Binary Search',
  category: 'Data Structures',
  summary: 'A cache-aware sorted-array layout: place keys in heap/BFS order and search with predictable child indices.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['layout transform', 'search path'], defaultValue: 'layout transform' },
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

function tree(title) {
  return graphState({
    nodes: [
      { id: 'n1', label: '8', x: 4.9, y: 0.9, note: 'index 1' },
      { id: 'n2', label: '4', x: 2.6, y: 2.6, note: 'index 2' },
      { id: 'n3', label: '12', x: 7.2, y: 2.6, note: 'index 3' },
      { id: 'n4', label: '2', x: 1.3, y: 4.8, note: 'index 4' },
      { id: 'n5', label: '6', x: 3.8, y: 4.8, note: 'index 5' },
      { id: 'n6', label: '10', x: 6.0, y: 4.8, note: 'index 6' },
      { id: 'n7', label: '14', x: 8.4, y: 4.8, note: 'index 7' },
    ],
    edges: [
      { id: 'e1-2', from: 'n1', to: 'n2', weight: 'left=2i' },
      { id: 'e1-3', from: 'n1', to: 'n3', weight: 'right=2i+1' },
      { id: 'e2-4', from: 'n2', to: 'n4', weight: 'left' },
      { id: 'e2-5', from: 'n2', to: 'n5', weight: 'right' },
      { id: 'e3-6', from: 'n3', to: 'n6', weight: 'left' },
      { id: 'e3-7', from: 'n3', to: 'n7', weight: 'right' },
    ],
  }, { title });
}

function* layoutTransform() {
  yield {
    state: labelMatrix(
      'Same sorted keys, different memory order',
      [
        { id: 'sorted', label: 'sorted array' },
        { id: 'eytz', label: 'Eytzinger array' },
        { id: 'meaning', label: 'tree meaning' },
      ],
      [
        { id: 'i0', label: '0' },
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
        { id: 'i4', label: '4' },
        { id: 'i5', label: '5' },
        { id: 'i6', label: '6' },
      ],
      [
        ['2', '4', '6', '8', '10', '12', '14'],
        ['8', '4', '12', '2', '6', '10', '14'],
        ['root', 'left', 'right', 'LL', 'LR', 'RL', 'RR'],
      ],
    ),
    highlight: { active: ['sorted:i3', 'eytz:i0'], found: ['meaning:i0'] },
    explanation: 'Eytzinger layout stores the sorted keys as an implicit complete binary-search tree in breadth-first order. The median becomes the root, then child subtrees follow like a heap.',
  };

  yield {
    state: tree('Heap-like child indices give a branch path'),
    highlight: { active: ['n1', 'n2', 'n3'], found: ['e1-2', 'e1-3'] },
    explanation: 'Search starts at index 1 in the one-based view. At node i, go left to 2i or right to 2i+1. That regular index arithmetic is why the layout is friendly to prefetching.',
    invariant: 'The sorted order is in the tree relation, not in adjacent memory cells.',
  };

  yield {
    state: labelMatrix(
      'Why it can beat ordinary binary search',
      [
        { id: 'branch', label: 'branch prediction' },
        { id: 'cache', label: 'cache misses' },
        { id: 'prefetch', label: 'prefetch' },
        { id: 'small', label: 'small arrays' },
      ],
      [
        { id: 'ordinary', label: 'ordinary sorted array' },
        { id: 'eytzinger', label: 'Eytzinger layout' },
      ],
      [
        ['hard-to-predict mid jumps', 'regular child path'],
        ['jumps across array', 'BFS packs upper levels'],
        ['less obvious', 'children addresses predictable'],
        ['often already cached', 'layout overhead may not matter'],
      ],
    ),
    highlight: { found: ['cache:eytzinger', 'prefetch:eytzinger'], compare: ['small:ordinary'] },
    explanation: 'The asymptotic complexity is still O(log n). The improvement is mechanical sympathy: fewer painful cache stalls and more predictable memory access for repeated searches.',
  };

  yield {
    state: labelMatrix(
      'Build by inorder fill',
      [
        { id: 'left', label: 'fill left subtree' },
        { id: 'root', label: 'write root' },
        { id: 'right', label: 'fill right subtree' },
        { id: 'array', label: 'array position' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['recurse to 2i', 'smaller keys'],
        ['write next sorted key at i', 'inorder property'],
        ['recurse to 2i+1', 'larger keys'],
        ['BFS index receives inorder value', 'search tree in array'],
      ],
    ),
    highlight: { active: ['left:rule', 'root:rule', 'right:rule'], found: ['array:effect'] },
    explanation: 'To build the layout, walk the implicit tree in inorder while consuming the sorted array. The result preserves binary-search order through parent/child relationships.',
  };
}

function* searchPath() {
  yield {
    state: tree('Search lower_bound(11)'),
    highlight: { active: ['n1', 'n3', 'n6'], compare: ['e1-3', 'e3-6'] },
    explanation: 'For lower_bound(11), compare 11 with 8 and go right. Compare with 12 and record it as a candidate, then go left to 10. Since 10 is too small, the candidate 12 wins.',
  };

  yield {
    state: labelMatrix(
      'Search trace',
      [
        { id: 'step1', label: 'index 1 value 8' },
        { id: 'step2', label: 'index 3 value 12' },
        { id: 'step3', label: 'index 6 value 10' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'comparison', label: 'comparison' },
        { id: 'move', label: 'move' },
        { id: 'candidate', label: 'candidate' },
      ],
      [
        ['11 > 8', 'right to 3', 'none'],
        ['11 <= 12', 'left to 6', '12'],
        ['11 > 10', 'right past leaf', '12'],
        ['smallest >= 11', 'stop', '12'],
      ],
    ),
    highlight: { active: ['step1:move', 'step2:candidate', 'step3:move'], found: ['answer:candidate'] },
    explanation: 'The logical comparisons are ordinary binary search. The difference is the memory path: 1, 3, 6 are heap-style indices rather than midpoints in a sorted array.',
  };

  yield {
    state: labelMatrix(
      'Layout choices for repeated lookup',
      [
        { id: 'sorted', label: 'sorted order' },
        { id: 'eytz', label: 'Eytzinger' },
        { id: 'btree', label: 'implicit B-tree' },
        { id: 'veb', label: 'van Emde Boas' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['simple and compact', 'branch/cache stalls on large arrays'],
        ['fast in RAM with prefetch', 'rebuild layout for sorted data'],
        ['cache-line block search', 'more complex'],
        ['cache-oblivious recursion', 'complex layout'],
      ],
    ),
    highlight: { found: ['eytz:strength'], compare: ['btree:tradeoff', 'veb:tradeoff'] },
    explanation: 'Eytzinger is one member of a layout family. The surprising lesson from the paper is that a simple heap-order layout can be very competitive on modern hardware.',
  };

  yield {
    state: tree('Final frame: tree order, array storage'),
    highlight: { found: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'] },
    explanation: 'The final mental model: keep the binary-search-tree relation, but store it in array order that the processor can walk predictably.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'layout transform') yield* layoutTransform();
  else if (view === 'search path') yield* searchPath();
  else throw new InputError('Pick an Eytzinger layout view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Binary search uses sorted order perfectly in the comparison model. With 1,000,000 keys, it needs about 20 comparisons. That sounds like the end of the story until the array is large enough that memory stalls and branch mispredictions dominate the comparisons.',
        'Ordinary binary search jumps from the middle to the middle of a half, then to the middle of a quarter. Those addresses are hard for the CPU to predict, and the branch direction depends on the query. Two O(log n) searches can have very different hardware cost.',
        'Eytzinger layout keeps the same binary-search decision tree but stores it in breadth-first order. The algorithm still discards half the remaining ranks at each comparison; the machine sees a more regular path through memory.',
      ],
    },
    {
      heading: 'The Baseline And The Wall',
      paragraphs: [
        'The reasonable baseline is a sorted array searched with lower_bound. It is compact, simple, and optimal up to constant factors if each comparison has the same cost.',
        'The wall is that comparisons do not have the same cost on real hardware. A comparison that hits in L1 cache is cheap. A comparison that waits on memory is expensive. A branch that the predictor gets wrong flushes useful work.',
        'For repeated lookup over a read-mostly array, layout becomes part of the data structure. The question changes from how many comparisons to which memory locations the comparisons touch.',
      ],
    },
    {
      heading: 'Core Layout',
      paragraphs: [
        'Eytzinger layout stores an implicit complete binary search tree in array order. In the one-based view, index i has left child 2i and right child 2i + 1. The array relation looks like a heap, but the value rule is binary-search-tree order.',
        'The sorted ranks live in the inorder traversal. Every value in the left subtree of a node is smaller. Every value in the right subtree is larger. Breadth-first storage only changes where the nodes sit in memory.',
        'For keys [2, 4, 6, 8, 10, 12, 14], ordinary sorted order is [2, 4, 6, 8, 10, 12, 14]. Eytzinger order is [8, 4, 12, 2, 6, 10, 14]. The median sits first because it is the root of the comparison tree.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Build the layout by walking the implicit tree in inorder while consuming the sorted input. Recurse to the left child, write the next sorted key at the current index, then recurse to the right child. This puts sorted order into the tree relation.',
        'Search starts at index 1 in a one-based implementation. If the query is less than or equal to the current value, record the current index as a lower_bound candidate and move to the left child. If the query is larger, move to the right child.',
        'The loop stops when the child index passes the array length. The answer is the last candidate. For exact search, the same path is followed, but the algorithm can stop early when the current key equals the query.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Correctness comes from the inorder invariant. At each node, all keys in the left subtree are smaller than the node key, and all keys in the right subtree are larger. A comparison discards exactly the subtree whose ranks cannot contain the answer.',
        'For lower_bound, the candidate rule preserves the smallest known key that is still >= query. Moving left searches for a smaller valid candidate. Moving right is safe only after proving the current value and its left subtree are too small.',
        'The array permutation does not change the comparison tree. It changes address order. The search returns the same answer ordinary binary search would return over the sorted keys.',
      ],
    },
    {
      heading: 'Cost And Behavior',
      paragraphs: [
        'The build step is O(n) after the input is sorted. Search is O(log n) comparisons and O(1) extra space, the same asymptotic cost as ordinary binary search.',
        'The practical difference is memory behavior. Upper tree levels sit near the start of the array and are reused across many searches. Child indices are regular, so tuned implementations can prefetch descendants or use branchless comparisons.',
        'The cost is update pain. Inserting one key into the logical sorted set can require rebuilding the layout. Eytzinger is for static or batched data, not for a set with frequent individual updates.',
      ],
    },
    {
      heading: 'Implementation Checklist',
      paragraphs: [
        'Choose and document the indexing convention first. Many explanations use one-based indices because children are 2i and 2i + 1. JavaScript arrays are zero-based, so code either reserves index 0 as unused or rewrites the formulas to left = 2i + 1 and right = 2i + 2. Mixing those conventions is the easiest way to return the wrong lower_bound.',
        'Handle non-perfect sizes explicitly. Real arrays rarely contain exactly 2^k - 1 keys, so the implicit tree has missing leaves near the end. The builder and search loop must agree on which indices are valid, how candidates are stored, and what happens when the query is larger than every key.',
        'Benchmark with the real query distribution. Eytzinger layout is about memory behavior, so a microbenchmark over tiny arrays or sequential queries can tell the wrong story. Compare against ordinary binary search, branchless sorted-array search, and B-tree-style block search on the data sizes that matter.',
      ],
    },
    {
      heading: 'Testing It',
      paragraphs: [
        'Property tests are straightforward. Generate sorted arrays with distinct keys and duplicates if lower_bound supports them, build the Eytzinger layout, then compare every query result with a trusted sorted-array lower_bound. Include empty arrays, one-element arrays, powers of two, and sizes just below or above powers of two.',
        'Also test the builder independently by traversing the implicit tree inorder and checking that it produces the original sorted sequence. That test proves the layout invariant directly instead of only testing search through it.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'The layout fits read-heavy in-memory indexes: analytics columns, routing tables, sorted dictionaries, search kernels, and database components that run many lookups over the same sorted keys.',
        'It is most useful when the data is large enough to miss cache and stable enough to justify a conversion step. The improvement comes from fewer expensive stalls, not from fewer comparisons.',
        'It is also a good lesson in performance thinking. The abstract data structure is still binary search, but the physical arrangement changes how the processor experiences that search.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'Small arrays usually do not benefit because the whole search path is already hot in cache. A plain sorted array is also easier to inspect, serialize, update, and share across code that expects sorted order.',
        'The heap-like index formula causes a common mistake: treating the values as a heap. They are not heap-ordered. The root is the median, not the minimum.',
        'Low-level implementations need boundary discipline. One-based indexing, sentinel padding, prefetch distance, and duplicate-key lower_bound rules can all create off-by-one bugs even when the high-level idea is correct.',
      ],
    },
    {
      heading: 'Concrete Example',
      paragraphs: [
        'Store [2, 4, 6, 8, 10, 12, 14] as [8, 4, 12, 2, 6, 10, 14]. To compute lower_bound(11), compare with 8 and move right. Compare with 12, record 12 as the best candidate, and move left. Compare with 10 and move right past the leaf. The answer is 12.',
        'The same comparisons happen in a normal binary-search tree. The difference is that the nodes are array positions 1, 3, and 6. The path can be computed with multiplication and addition instead of midpoint arithmetic.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Binary Search first because Eytzinger layout keeps its decision rule. Study Binary Heap to separate heap-shaped indexing from heap ordering. Study B-Tree and implicit B-tree layouts for cache-line-sized search blocks. Study van Emde Boas layout for cache-oblivious recursion.',
        'Primary sources: Array Layouts for Comparison-Based Searching, https://arxiv.org/abs/1509.05053, and ACM DOI page, https://dl.acm.org/doi/10.1145/3053370.',
      ],
    },
  ],
};
