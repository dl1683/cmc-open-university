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
      heading: 'How to read the animation',
      paragraphs: [
        'Each node is one interval drawn as a labeled bar with a start and end value. The tree arranges these intervals into a BST ordered by the low endpoint. Every node carries a "max" annotation: the largest high endpoint anywhere in its subtree. During a query, active (highlighted) nodes are being examined. Found nodes overlap the query range. Removed or dimmed nodes belong to subtrees that were pruned -- their max endpoint proved no interval inside could possibly reach the query.',
        'Switch between the two views to see both halves of the design. The overlap-query view traces a search through the tree, showing where the max annotation lets the algorithm skip entire branches. The maintain-max-endpoint view shows the cost side: how insertions propagate max updates back toward the root, and why rotations must recompute max before queries stay correct.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many real problems boil down to the same question: given a collection of intervals, which ones overlap a query point or range? A calendar must find scheduling conflicts. A genome browser must locate every gene that spans a coordinate. A database with temporal columns must retrieve all records valid during a time window. A game engine must detect which axis-aligned bounding boxes collide.',
        'Each of these needs fast access to intervals based on both their endpoints, not just where they start. A plain BST ordered by start point can find intervals that begin near a query, but it cannot tell you whether some far-left interval extends all the way past the query. The interval tree solves this by adding one extra number to each node.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Scan all n stored intervals and check each one. Two closed intervals [a,b] and [c,d] overlap when a <= d and c <= b. This is correct and costs O(n) per query. For a calendar with 50,000 bookings and 200 proposed meetings per day, that is 10 million comparisons daily just for conflict detection.',
        'Sorting intervals by start helps with point lookups -- binary search can find where a query point falls among the starts -- but it does not help with overlap. An interval [2, 999] starts near the beginning and overlaps almost everything. Sorting by start alone cannot tell you how far each interval extends, so it cannot skip intervals that start early and end late.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fundamental barrier is pruning. To beat O(n), the search must skip groups of intervals without inspecting them individually. That requires a proof that nothing in the skipped group can overlap the query. Start order alone does not supply that proof because an interval\'s end is independent of its start.',
        'A secondary barrier is dynamism. If intervals are inserted and deleted, and the tree rebalances, any pruning metadata must be repaired. A stale annotation does not cause a crash -- it causes a silent false negative, which is worse because the system reports "no conflict" when one exists.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Augment a balanced BST with one extra field per node: the maximum high endpoint in that node\'s entire subtree. This single number is a pruning certificate. If a subtree\'s max is less than the query\'s low value, every interval in that subtree ends before the query begins, so none can overlap. The entire branch is safe to skip.',
        'The invariant is local: node.max = max(node.high, left.max, right.max). It depends only on the node and its two children, so rotations can repair it in O(1) per affected node.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build a balanced BST (typically red-black or AVL) keyed on each interval\'s low endpoint. At every node, store the interval itself plus the max high endpoint in the subtree rooted there.',
        'To query "find all intervals overlapping [lo, hi]": start at the root. If the current node\'s interval overlaps [lo, hi], report it. If the left child exists and left.max >= lo, recurse into the left subtree -- something there might reach the query. If the current node\'s start <= hi, recurse into the right subtree -- intervals starting after hi cannot overlap, so this check prunes rightward. The search visits O(log n + k) nodes, where k is the number of matches.',
        'To insert an interval, follow BST insertion by low endpoint. On the walk back up to the root, update the max field at each ancestor. Deletion works the same way: remove the node by BST rules, then fix max fields along the path. Rotations during rebalancing require recomputing max for the two rotated nodes, bottom-up, before the tree is query-ready again.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The max-endpoint annotation lets the search convert "I do not know" into "provably nothing here." Consider a left subtree with max = 14 and a query [lo, hi] where lo = 18. Every interval [a, b] in that subtree satisfies b <= 14 < 18 = lo, so the overlap condition a <= hi and lo <= b fails on the second clause. The subtree is empty of results, proven without opening a single node inside it.',
        'The BST ordering by start handles the other direction: if a node\'s start is greater than hi, then every node in its right subtree starts even later, so none can overlap. Between the two pruning rules -- max on the left, start order on the right -- each level of the tree eliminates at least one branch, giving O(log n) for a single-result query and O(log n + k) when reporting all k matches.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert: O(log n). Delete: O(log n). Query for one overlap: O(log n). Query for all k overlaps: O(log n + k). Space: O(n) -- one node per interval, each carrying low, high, max, color bit, and child pointers.',
        'When n doubles, the tree grows one level deeper, adding one comparison per query. The per-node overhead is small: one extra integer (the max field) on top of a normal BST node. The practical bottleneck is the balancing machinery. Every rotation touches two nodes\' max fields, and red-black trees perform at most three rotations per insert or delete, so the augmentation cost is bounded.',
        'A subtle correctness risk: if a bug in deletion or rotation leaves a stale max value, the tree will silently skip valid overlaps. The failure mode is a false negative, not an exception. Testing should include a brute-force oracle that scans all intervals and compares results against the tree\'s query output.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Calendar and scheduling systems query "does this proposed meeting conflict with any existing booking?" Each booking is an interval on the time axis. The interval tree answers in O(log n) instead of scanning every event.',
        'Database temporal queries retrieve all records whose valid-time range includes a query timestamp or overlaps a query window. PostgreSQL\'s GiST index on range types uses an interval-tree-like structure internally.',
        'Computational geometry sweep-line algorithms maintain an interval tree of active segments. As the sweep line advances, segments are inserted and deleted, and vertical queries find all segments crossing a given x-coordinate.',
        'Genomic annotation browsers find which genes, exons, or regulatory regions cover a base-pair coordinate. Genomic intervals are sparse across billions of positions, which is where the tree\'s logarithmic pruning matters most.',
        'Collision detection in games and simulations projects 3D bounding boxes onto each axis and queries an interval tree per axis to find candidate overlapping pairs before running expensive geometry tests.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High-dimensional intervals -- rectangles, boxes, hyperrectangles -- need k-d trees, R-trees, or range trees. The interval tree handles one-dimensional ranges only. For 2D rectangles, you can use two interval trees (one per axis) and intersect results, but R-trees are usually more practical.',
        'If all intervals are known in advance and never change, a static structure or a sorted-endpoint sweep can be simpler. The centered interval tree (Edelsbrunner\'s original) is a static alternative that partitions intervals around midpoints. The augmented-BST version earns its complexity when intervals are inserted and deleted online.',
        'Aggregate range queries -- "what is the sum of values in positions 5 through 20?" -- belong to segment trees or Fenwick trees. The interval tree answers "which stored intervals overlap this range?" not "what is the aggregate over a coordinate range?" These are different questions with different structures.',
        'For small n (a few hundred intervals), a flat array with linear scan is faster in practice because it avoids pointer-chasing and fits in cache. The tree\'s logarithmic advantage only pays off when n is large enough that cache misses from the scan dominate.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Intervals: [5,12], [10,30], [15,20], [17,19], [25,35]. Insert them into a balanced BST ordered by low endpoint. One valid arrangement: [15,20] at the root, [10,30] as left child with [5,12] as its left child, and [25,35] as right child with [17,19] as its left child.',
        'Compute max endpoints bottom-up. Leaf [5,12]: max = 12. Node [10,30]: max = max(30, 12) = 30. Leaf [17,19]: max = 19. Node [25,35]: max = max(35, 19) = 35. Root [15,20]: max = max(20, 30, 35) = 35.',
        'Query: "what overlaps point 18?" This is equivalent to querying for overlap with [18,18]. Start at root [15,20]: 15 <= 18 and 18 <= 20 -- overlap. Report [15,20]. Left child [10,30] has max 30 >= 18, so search left. Node [10,30]: 10 <= 18 and 18 <= 30 -- overlap. Report [10,30]. Its left child [5,12] has max 12 < 18 -- prune the entire left-left subtree. Back at the root, check right. Node [25,35]: 25 <= 18 is false -- no overlap, and since 25 > 18, nothing to the right can overlap either.',
        'Final result: [15,20] and [10,30]. The search examined 4 nodes out of 5 and pruned 1 (the [5,12] subtree) using the max-endpoint certificate. With a larger tree, the savings compound: each pruned branch eliminates an exponentially growing number of unchecked intervals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms (CLRS), Chapter 14: Augmenting Data Structures. The interval tree is the chapter\'s primary example of BST augmentation. Edelsbrunner (1980) introduced the centered interval tree for computational geometry; the augmented-BST variant taught in CLRS is the version most commonly implemented.',
        'Prerequisites: Binary Search Tree for the base ordering structure; Red-Black Tree or AVL Tree for the balancing guarantees that keep all operations O(log n).',
        'Related structures: Segment Tree answers aggregate queries over coordinate ranges (sums, minimums) rather than overlap queries over stored intervals. Sweep Line is the algorithmic technique paired with interval trees in computational geometry. R-Tree Spatial Index extends overlap queries to multidimensional rectangles. Order-Statistics Tree is another BST augmentation -- it stores subtree sizes instead of max endpoints, answering rank and selection queries.',
      ],
    },
  ],
};
