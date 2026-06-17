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
      heading: 'Why this exists',
      paragraphs: [
        'Interval overlap questions show up in calendars, genome features, compiler live ranges, trace spans, text annotations, and one-dimensional collision windows.',
        'An interval tree exists because ordered point keys are not enough. The query is about ranges that can overlap even when their start points are far away.',
        'The data model is simple but easy to underestimate. An event has a start and an end. A query may ask whether a proposed meeting conflicts, which genes cover a coordinate, which spans were active at a timestamp, or which live ranges interfere in a compiler. In each case, the answer depends on both endpoints, not just on where the interval begins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to scan every interval and test overlap. That is simple, correct, and too slow when the set is large or overlap checks are frequent.',
        'A normal binary search tree ordered by start point helps find nearby starts, but it cannot safely ignore intervals with earlier starts that extend far to the right.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is pruning. To skip a subtree, you need proof that no interval inside it can reach the query. Start order alone does not provide that proof.',
        'The second wall is mutation. If the tree rotates or deletes nodes, the pruning metadata must remain correct or the structure can silently miss overlaps.',
        'This is why interval trees are more than a convenience wrapper around binary search. They encode a certificate for absence. When the search skips a branch, it is not guessing that the branch looks unlikely. It is using a stored maximum endpoint to prove that the branch cannot contain an overlapping interval.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Order intervals by low endpoint, but augment every node with the maximum high endpoint in its subtree. That one scalar says whether a subtree can possibly overlap a query starting at qLow.',
        'The invariant is local: node.max = max(node.high, left.max, right.max). Because it is local, balanced-tree rotations can preserve it with a few recomputations.',
        'That is the whole trick. The tree order answers "which intervals start before or after this point?" The max endpoint answers "can anything in this branch reach far enough to matter?" Together they turn overlap search from a scan into a directed walk.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        `In the overlap-query view, each max endpoint is a pruning certificate. If the left subtree's max endpoint is less than the query start, no interval in that subtree can reach the query, so it is safe to skip. If the max endpoint reaches the query start, the subtree remains possible even when the current node does not overlap.`,
        `In the maintain-max-endpoint view, insertion follows ordinary BST ordering by low endpoint, but the path back to the root recomputes max endpoints. Rotations are allowed only if they also repair the augmented values; stale max data can turn a correct tree shape into wrong search answers.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To find one overlap, compare the current interval with the query. If it overlaps, return it. Otherwise, go left only if left.max is at least qLow; if the left subtree cannot reach the query, go right.',
        'To find all overlaps, continue exploring every subtree that could contain a match. Insert and delete follow the underlying balanced tree, then recompute max endpoints on the affected path and rotated nodes.',
        'The overlap predicate depends on endpoint convention. For closed intervals, [a,b] overlaps [c,d] when a <= d and c <= b. For half-open intervals, [a,b) overlaps [c,d) when a < d and c < b. Production systems should make that convention explicit because meeting schedulers, genomic ranges, and compiler live ranges often choose different boundary rules.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because max endpoint converts a negative search decision into proof. If every interval in a subtree ends before qLow, no interval in that subtree can overlap [qLow, qHigh].',
        'It also works because the augmentation is cheap to maintain. The tree order stays about low endpoints; the max field adds just enough range knowledge for overlap pruning.',
        'The overlap predicate itself is simple: intervals [a,b] and [c,d] overlap when a <= d and c <= b, assuming closed intervals. The tree is useful because it avoids applying that predicate to every stored interval.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Search for an interval overlapping [22,25]. The root [16,21] does not overlap. Its left child has max 23, so the left subtree could still contain an interval that reaches 22. Descending left eventually finds [15,23], which overlaps.',
        'If a subtree had max 21, the search could skip it entirely because every interval inside ends before 22. That is the exact proof the augmentation provides.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Finding one overlap is O(log n) on a balanced tree. Reporting all overlaps costs O(log n + k), where k is the number of intervals reported, when pruning is implemented correctly. Space is O(n).',
        'The constant factor is small, but correctness is fragile under updates. A stale max endpoint can cause false negatives, which are worse than slow queries because they look like valid "no overlap" answers.',
        'The structure also inherits the quality of its balancing scheme. A plain unbalanced BST can degrade to a chain. Most real implementations use a red-black tree, AVL tree, treap, or another balanced map and attach the max endpoint as augmentation data.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for dynamic one-dimensional overlap search: calendars, scheduling, genome annotation, compiler live ranges, trace spans, text annotations, subtitles, and timestamp windows.',
        'It is also a clean example of augmentation: keep a familiar balanced tree and add one summary field that unlocks a new query.',
        'It is especially useful when the set changes over time. If all intervals are known offline, a sweep-line algorithm or sorted endpoint arrays may be faster and simpler. If intervals arrive and leave while queries continue, the interval tree gives a strong online default.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the task is aggregate range queries over coordinates. That is Segment Tree territory. It also fails for multidimensional rectangles, where R-trees, range trees, k-d trees, sweep-line algorithms, or BVHs may fit better.',
        'Terminology can also confuse readers. This page teaches the CLRS-style dynamic max-endpoint tree, not every computational-geometry structure that has been called an interval tree.',
        'It is also not automatically the best structure for dense integer coordinates. If the universe is small and fixed, bitsets, Fenwick trees, segment trees, or prefix counts can answer related questions with simpler memory access. The interval tree earns its place when intervals are sparse, dynamic, and endpoint values are drawn from a large ordered domain.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Store low, high, and max separately, and update max in one helper used by insert, delete, and rotation code. Bugs often appear when rotation logic changes child pointers but forgets to recompute the rotated nodes in bottom-up order.',
        'Test with adversarial layouts: nested intervals, touching endpoints, duplicates, empty intervals if your domain permits them, deletions of nodes with two children, and queries that should return no overlap. A slow scan oracle is excellent for tests because the interval predicate is easy to implement directly.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study sources: MIT OpenCourseWare lecture on augmenting data structures and interval trees at https://ocw.mit.edu/courses/6-046j-introduction-to-algorithms-sma-5503-fall-2005/resources/lecture-11-augmenting-data-structures-dynamic-order-statistics-interval-trees/, MIT augmentation lecture notes at https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/fc870caae0e6812787bb5d50ea4d5e24_MIT6_046JS15_lec09.pdf, and USFCA interval-tree lecture notes at https://www.cs.usfca.edu/galles/cs673/lecture/lecture8.pdf. Study Red-Black Tree, AVL Tree Rotations, Order-Statistics Tree, Segment Tree & Lazy Propagation, Priority Search Tree Range Reporting, R-Tree Spatial Index, Distributed Tracing, and Peritext Rich-Text CRDT Case Study next.',
      ],
    },
  ],
};
