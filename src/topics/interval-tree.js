// Interval tree: a balanced search tree augmented with subtree max endpoints,
// used to answer overlap and stabbing queries quickly.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'interval-tree',
  title: 'Interval Tree',
  category: 'Data Structures',
  summary: 'Store ranges in a balanced tree, augment each node with max end, and skip whole subtrees during overlap queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['overlap query', 'maintain max endpoint'], defaultValue: 'overlap query' },
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

function intervalGraph(title) {
  return graphState({
    nodes: [
      { id: 'n16', label: '[16,21]', x: 4.8, y: 1.0, note: 'max 30' },
      { id: 'n8', label: '[8,9]', x: 2.5, y: 2.8, note: 'max 23' },
      { id: 'n25', label: '[25,30]', x: 7.2, y: 2.8, note: 'max 30' },
      { id: 'n5', label: '[5,8]', x: 1.2, y: 4.8, note: 'max 10' },
      { id: 'n15', label: '[15,23]', x: 3.6, y: 4.8, note: 'max 23' },
      { id: 'n17', label: '[17,19]', x: 6.2, y: 4.8, note: 'max 19' },
      { id: 'n26', label: '[26,26]', x: 8.4, y: 4.8, note: 'max 26' },
      { id: 'query', label: 'query [22,25]', x: 4.8, y: 6.8, note: 'find overlap' },
    ],
    edges: [
      { id: 'e-16-8', from: 'n16', to: 'n8', weight: 'left' },
      { id: 'e-16-25', from: 'n16', to: 'n25', weight: 'right' },
      { id: 'e-8-5', from: 'n8', to: 'n5', weight: 'left' },
      { id: 'e-8-15', from: 'n8', to: 'n15', weight: 'right' },
      { id: 'e-25-17', from: 'n25', to: 'n17', weight: 'left' },
      { id: 'e-25-26', from: 'n25', to: 'n26', weight: 'right' },
      { id: 'e-query-15', from: 'query', to: 'n15', weight: 'overlap' },
      { id: 'e-query-25', from: 'query', to: 'n25', weight: 'overlap' },
    ],
  }, { title });
}

function* overlapQuery() {
  yield {
    state: intervalGraph('Intervals are ordered by start, augmented by subtree max'),
    highlight: { active: ['n16', 'n8', 'n25'], found: ['query'] },
    explanation: 'An interval tree starts as a balanced Binary Search Tree ordered by low endpoint. Each node also stores the maximum high endpoint in its subtree. That extra number is the pruning signal.',
    invariant: 'node.max = max(node.high, left.max, right.max).',
  };

  yield {
    state: intervalGraph('Query [22,25]: root does not overlap'),
    highlight: { active: ['query', 'n16'], compare: ['n16'], found: ['n8'] },
    explanation: 'The root interval [16,21] does not overlap [22,25]. But the left child has max 23, so the left subtree might still contain an interval reaching into the query. The search descends left before discarding it.',
  };

  yield {
    state: intervalGraph('Left subtree finds [15,23]'),
    highlight: { active: ['n8', 'n15', 'e-8-15'], found: ['n15', 'e-query-15'], removed: ['n5'] },
    explanation: 'The [8,9] node does not overlap, and [5,8] cannot reach the query. The right child [15,23] does overlap. The max endpoint made the search skip irrelevant intervals without scanning the whole set.',
  };

  yield {
    state: intervalGraph('Right subtree can also be explored for all overlaps'),
    highlight: { active: ['n25', 'e-query-25'], found: ['n15', 'n25'], compare: ['n17', 'n26'] },
    explanation: 'To find one overlap, the search can stop at [15,23]. To find all overlaps, continue exploring branches whose max endpoints and starts make overlap possible. The same structure powers calendars, genome ranges, and compiler liveness ranges.',
  };
}

function* maintainMaxEndpoint() {
  yield {
    state: labelMatrix(
      'Insert a new interval [6,14]',
      [
        { id: 'root', label: '[16,21]' },
        { id: 'left', label: '[8,9]' },
        { id: 'child', label: '[5,8]' },
        { id: 'new', label: '[6,14]' },
      ],
      [
        { id: 'compare', label: 'BST compare' },
        { id: 'oldmax', label: 'old max' },
        { id: 'newmax', label: 'new max' },
      ],
      [
        ['6 < 16 go left', '30', '30'],
        ['6 < 8 go left', '23', '23'],
        ['6 > 5 go right', '10', '14'],
        ['insert as child', '-', '14'],
      ],
    ),
    highlight: { active: ['root:compare', 'left:compare', 'child:compare'], found: ['child:newmax', 'new:newmax'] },
    explanation: 'Insertion follows the ordinary binary-search-tree rule on low endpoints. Then the path back to the root recomputes max endpoints. The augmentation is local, which is why the structure stays efficient.',
  };

  yield {
    state: intervalGraph('Rotations preserve order but require max recomputation'),
    highlight: { active: ['n16', 'n8', 'e-16-8'], compare: ['n15', 'n5'] },
    explanation: 'Most implementations use a Red-Black Tree or AVL Tree Rotations underneath. Rotations keep intervals ordered by start, but max endpoints must be recomputed for rotated nodes before queries remain correct.',
  };

  yield {
    state: labelMatrix(
      'What max endpoints buy',
      [
        { id: 'calendar', label: 'calendar booking' },
        { id: 'genome', label: 'genome feature' },
        { id: 'compiler', label: 'register allocation' },
        { id: 'observability', label: 'trace spans' },
      ],
      [
        { id: 'query', label: 'query' },
        { id: 'why', label: 'why interval tree helps' },
      ],
      [
        ['does new meeting overlap?', 'skip finished branches'],
        ['which genes cover this coordinate?', 'range overlap'],
        ['which live ranges interfere?', 'all overlaps'],
        ['which spans cover this timestamp?', 'stabbing query'],
      ],
    ),
    highlight: { found: ['calendar:why', 'compiler:why', 'observability:why'], active: ['genome:query'] },
    explanation: 'Interval trees are a clean example of augmentation: take a familiar tree and add exactly one summary value that unlocks a new query pattern.',
  };

  yield {
    state: labelMatrix(
      'Interval tree versus neighboring structures',
      [
        { id: 'segment', label: 'Segment Tree' },
        { id: 'interval', label: 'Interval Tree' },
        { id: 'btree', label: 'B-tree' },
        { id: 'rtree', label: 'R-tree' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['range aggregates', 'fixed coordinate decomposition'],
        ['dynamic overlap search', 'BST plus max endpoint'],
        ['ordered scalar keys', 'disk page tree'],
        ['spatial boxes', 'bounding rectangle tree'],
      ],
    ),
    highlight: { active: ['interval:best', 'interval:shape'], compare: ['segment:best', 'rtree:shape'] },
    explanation: 'The right range structure depends on the question. Segment trees aggregate over coordinates. Interval trees find overlapping intervals. R-trees handle multidimensional rectangles.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'overlap query') yield* overlapQuery();
  else if (view === 'maintain max endpoint') yield* maintainMaxEndpoint();
  else throw new InputError('Pick an interval-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An interval tree is a balanced search tree for ranges. It stores intervals ordered by low endpoint and augments every node with the maximum high endpoint in that node\'s subtree. That one extra field lets overlap queries skip whole branches.',
        'The structure is a classic augmentation pattern: start with Binary Search Tree or Red-Black Tree behavior, then add a summary value that makes a new query efficient. The key invariant is local: a node\'s max endpoint is the maximum of its own high endpoint, its left child max, and its right child max. Because the field depends only on nearby tree state, rotations can preserve it with a few recomputations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To find an interval overlapping a query [qLow, qHigh], compare the current node interval with the query. If it overlaps, return it. Otherwise, inspect the left child only if left.max is at least qLow; if the left subtree cannot reach the query, go right. To find all overlaps, continue exploring every subtree that could contain a match.',
        'Insertion and deletion follow the underlying balanced tree. After structural changes or rotations, recompute max endpoints from children. The augmentation is local, so operations stay logarithmic for ordinary balanced-tree workloads. This is exactly the same design habit behind Order-Statistics Tree: keep the search-tree order, add one carefully maintained summary field, and make a new query cheap.',
        'There are several names in the wild. Some computational-geometry courses use "interval tree" for a median-split structure over elementary intervals, while the CLRS-style data structure is a red-black tree augmented with max endpoints. This page teaches the CLRS-style dynamic overlap tree because it is the version most directly useful for calendars, live ranges, and timestamp spans.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Finding one overlap is O(log n) on a balanced tree. Reporting all overlaps costs O(log n + k), where k is the number of intervals reported, when the implementation prunes correctly. The structure stores O(n) intervals and one max endpoint per node. Degenerate or incorrectly maintained balance destroys the guarantee.',
        'The constant factors are friendly because each node stores only one extra scalar. The fragile part is correctness under mutation. Insert, delete, rotate, or bulk-load code that forgets to update max endpoints can return false negatives: the query prunes a branch that actually contains an overlapping interval. That failure is worse than a slow query because it is silent.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Interval trees fit calendars, room scheduling, genome annotation, compiler live ranges, trace-span lookup, time-window indexing, subtitle ranges, and collision broad phases in one dimension. They are often the simplest answer when the question is "which ranges overlap this range?" Priority Search Tree Range Reporting shows a computational-geometry reduction that maps interval intersection into a three-sided point query.',
        'They also connect to rich-text and observability systems. A collaborative editor may need to know which comments, links, or formatting marks overlap the visible text span, while a tracing UI may need all spans active at a timestamp. Peritext Rich-Text CRDT Case Study and Distributed Tracing are higher-level systems that need this kind of range thinking even if their production indexes use specialized variants.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An interval tree is not the same as a Segment Tree & Lazy Propagation. Segment trees are usually coordinate-decomposition structures for aggregate queries. Interval trees are dynamic sets of intervals optimized for overlap search. Another common bug is forgetting to update max endpoints after rotations or deletion.',
        'A second trap is forcing multidimensional geometry into this one-dimensional structure. Rectangles, bounding boxes, and spatial joins usually need R-Tree Spatial Index, k-d Tree, range trees, sweep-line algorithms, or domain-specific indexes. Interval trees are excellent when every item is one continuous interval on one ordered axis.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study sources: MIT OpenCourseWare lecture on augmenting data structures and interval trees at https://ocw.mit.edu/courses/6-046j-introduction-to-algorithms-sma-5503-fall-2005/resources/lecture-11-augmenting-data-structures-dynamic-order-statistics-interval-trees/, MIT augmentation lecture notes at https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/fc870caae0e6812787bb5d50ea4d5e24_MIT6_046JS15_lec09.pdf, and USFCA interval-tree lecture notes at https://www.cs.usfca.edu/galles/cs673/lecture/lecture8.pdf. Study Red-Black Tree, AVL Tree Rotations, Order-Statistics Tree, Segment Tree & Lazy Propagation, Priority Search Tree Range Reporting, R-Tree Spatial Index, Distributed Tracing, and Peritext Rich-Text CRDT Case Study next.',
      ],
    },
  ],
};
