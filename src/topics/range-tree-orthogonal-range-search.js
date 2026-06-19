// Range trees nest balanced search trees: one tree by x, with associated
// y-sorted structures at canonical nodes for exact orthogonal range reporting.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'range-tree-orthogonal-range-search',
  title: '2D Range Tree Orthogonal Search',
  category: 'Data Structures',
  summary: 'Answer exact axis-aligned rectangle queries by searching an x-tree, then using associated y-structures at canonical subtrees.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['2D reporting', 'fractional cascading'], defaultValue: '2D reporting' },
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

function rangeTreeGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'x=5', x: 4.8, y: 5.9, note: 'split node' },
      { id: 'left', label: 'x=2', x: 2.6, y: 4.1, note: 'left path' },
      { id: 'right', label: 'x=8', x: 7.0, y: 4.1, note: 'right path' },
      { id: 'a', label: 'A', x: 1.4, y: 2.2, note: '(1,4)' },
      { id: 'b', label: 'B', x: 3.5, y: 2.2, note: '(3,7)' },
      { id: 'c', label: 'C', x: 5.8, y: 2.2, note: '(6,3)' },
      { id: 'd', label: 'D', x: 8.4, y: 2.2, note: '(9,6)' },
      { id: 'ylist', label: 'y-list', x: 8.7, y: 6.0, note: '3,4,6,7' },
      { id: 'query', label: 'rect', x: 4.8, y: 0.8, note: 'x[2,8] y[3,7]' },
    ],
    edges: [
      { id: 'e-root-left', from: 'root', to: 'left' },
      { id: 'e-root-right', from: 'root', to: 'right' },
      { id: 'e-left-a', from: 'left', to: 'a' },
      { id: 'e-left-b', from: 'left', to: 'b' },
      { id: 'e-right-c', from: 'right', to: 'c' },
      { id: 'e-right-d', from: 'right', to: 'd' },
      { id: 'e-root-ylist', from: 'root', to: 'ylist' },
      { id: 'e-query-left', from: 'query', to: 'left' },
      { id: 'e-query-right', from: 'query', to: 'right' },
    ],
  }, { title });
}

function cascadeGraph(title) {
  return graphState({
    nodes: [
      { id: 'range', label: 'x range', x: 0.8, y: 3.4, note: 'canonical nodes' },
      { id: 'cat1', label: 'Y1', x: 2.8, y: 1.5, note: '3,7' },
      { id: 'cat2', label: 'Y2', x: 4.8, y: 3.4, note: '3,6' },
      { id: 'cat3', label: 'Y3', x: 6.8, y: 5.3, note: '4,6,7' },
      { id: 'bridges', label: 'bridges', x: 7.1, y: 2.0, note: 'rank links' },
      { id: 'output', label: 'points', x: 8.9, y: 3.4, note: 'report k' },
    ],
    edges: [
      { id: 'e-range-cat1', from: 'range', to: 'cat1' },
      { id: 'e-cat1-cat2', from: 'cat1', to: 'cat2' },
      { id: 'e-cat2-cat3', from: 'cat2', to: 'cat3' },
      { id: 'e-cat2-bridges', from: 'cat2', to: 'bridges' },
      { id: 'e-cat3-bridges', from: 'cat3', to: 'bridges' },
      { id: 'e-bridges-output', from: 'bridges', to: 'output' },
    ],
  }, { title });
}

function* reporting() {
  yield {
    state: rangeTreeGraph('A 2D range tree nests y-structures under an x-tree'),
    highlight: { active: ['root', 'left', 'right', 'ylist'], found: ['b', 'c', 'd'] },
    explanation: 'A 2D range tree is a balanced Binary Search Tree over x. Each canonical x-subtree carries an associated structure sorted by y, so rectangle queries become x decomposition plus y filtering.',
    invariant: 'Every point appears in O(log n) associated y-structures.',
  };

  yield {
    state: labelMatrix(
      'Query rectangle x[2,8], y[3,7]',
      [
        { id: 'split', label: 'split node' },
        { id: 'left_path', label: 'left path' },
        { id: 'right_path', label: 'right path' },
        { id: 'report', label: 'report' },
      ],
      [
        { id: 'x_step', label: 'x step' },
        { id: 'y_step', label: 'y step' },
      ],
      [
        ['find where x bounds diverge', 'root x=5'],
        ['take right subtrees on path', 'search y lists'],
        ['take left subtrees on path', 'search y lists'],
        ['emit points in y range', 'B,C,D'],
      ],
    ),
    highlight: { active: ['left_path:y_step', 'right_path:y_step'], found: ['report:y_step'], compare: ['split:x_step'] },
    explanation: 'The x-tree identifies O(log n) canonical subtrees that exactly cover the x-range. Associated y-lists inside those subtrees report only points whose y coordinate lies in range.',
  };

  yield {
    state: rangeTreeGraph('Associated y-lists avoid scanning whole subtrees'),
    highlight: { active: ['query', 'e-query-left', 'e-query-right', 'ylist'], found: ['b', 'c'], compare: ['a', 'd'] },
    explanation: 'Once a canonical subtree is fully inside the x-range, the query should not inspect every point by x. It uses the associated y-structure to report only y-range matches.',
  };

  yield {
    state: labelMatrix(
      'Range tree versus nearby structures',
      [
        { id: 'rangetree', label: 'range tree' },
        { id: 'kdtree', label: 'k-d Tree' },
        { id: 'rtree', label: 'R-Tree' },
        { id: 'bit2d', label: '2D Fenwick' },
      ],
      [
        { id: 'query', label: 'query type' },
        { id: 'tradeoff' },
      ],
      [
        ['exact orthogonal reporting', 'more space'],
        ['spatial pruning', 'weaker worst case'],
        ['geometry rectangles', 'heuristic overlap'],
        ['rectangle sums/counts', 'aggregate not report'],
      ],
    ),
    highlight: { active: ['rangetree:query'], compare: ['kdtree:tradeoff', 'rtree:tradeoff'], found: ['bit2d:query'] },
    explanation: 'Range trees are exact static search structures. They are not broad-phase collision indexes, and they are not just aggregate prefix structures.',
  };
}

function* fractionalCascading() {
  yield {
    state: cascadeGraph('Many associated y-lists search the same y bounds'),
    highlight: { active: ['range', 'cat1', 'cat2', 'cat3'], found: ['bridges'] },
    explanation: 'A plain 2D range tree performs a y-range search in every canonical x-subtree. Fractional Cascading links those catalogs so repeated y-bound searches share work.',
    invariant: 'The query y bounds are identical across the associated structures.',
  };

  yield {
    state: labelMatrix(
      'Query-time improvement',
      [
        { id: 'plain', label: 'plain 2D tree' },
        { id: 'cascaded', label: 'with cascading' },
        { id: 'space', label: 'space' },
        { id: 'output', label: 'reporting' },
      ],
      [
        { id: 'bound', label: 'bound' },
        { id: 'why' },
      ],
      [
        ['O(log^2 n + k)', 'search y at each level'],
        ['O(log n + k)', 'one search plus bridges'],
        ['O(n log n)', 'associated structures'],
        ['+k', 'must output answers'],
      ],
    ),
    highlight: { active: ['plain:bound', 'cascaded:bound'], found: ['cascaded:why'], compare: ['space:bound'] },
    explanation: 'The classic improvement is exactly the same lesson as Fractional Cascading: one binary search, then bridge positions through related catalogs.',
  };

  yield {
    state: cascadeGraph('Bridge ranks into each catalog'),
    highlight: { active: ['bridges', 'e-cat2-bridges', 'e-cat3-bridges'], found: ['output'], compare: ['cat1', 'cat2', 'cat3'] },
    explanation: 'The bridges map the lower and upper y-bound positions into each associated y-list. Reporting then scans only the matching slice in each list.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: map label windows',
      [
        { id: 'data', label: 'static labels' },
        { id: 'query', label: 'viewport' },
        { id: 'x', label: 'x tree' },
        { id: 'y', label: 'associated y' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'reason' },
      ],
      [
        ['points with priority', 'mostly static'],
        ['axis-aligned box', 'orthogonal query'],
        ['cover x interval', 'canonical subtrees'],
        ['report y interval', 'avoid full scan'],
      ],
    ),
    highlight: { active: ['query:role', 'x:reason', 'y:reason'], found: ['data:reason'] },
    explanation: 'For static point layers, a range tree can report all labels in the viewport exactly. Dynamic map engines often choose R-trees or tiled indexes instead because updates and geometry predicates dominate.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === '2D reporting') yield* reporting();
  else if (view === 'fractional cascading') yield* fractionalCascading();
  else throw new InputError('Pick a range-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The 2D reporting view shows the structure that makes range trees work: a balanced BST keyed by x, with an associated y-list hanging off the root. The root node (x=5) is the split node where the two boundary searches diverge. Left and right children represent the search paths toward the lower and upper x bounds. When a path turns away from a boundary, the sibling subtree is entirely inside the query range and becomes canonical. The y-list node represents the second-dimension catalog attached to each canonical subtree.',
        'Highlighted nodes in green are the reported points -- they survived both the x decomposition and the y filter. Nodes in orange are active search nodes. Compare-colored nodes are points that exist in the tree but fall outside the query rectangle on at least one coordinate. The query node at the bottom shows the rectangle bounds: x in [2,8], y in [3,7].',
        'The fractional cascading view shifts focus to the repeated y-search problem. Y1, Y2, and Y3 are associated y-catalogs from different canonical subtrees. The bridges node represents the rank pointers that let a single binary search propagate through all catalogs without repeating work. The animation routes through bridges before reaching the output node to show that cascading replaces O(log n) independent searches with O(1) lookups per catalog.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A range tree answers the orthogonal range reporting problem: given n points in d-dimensional space, preprocess them so that any axis-aligned query rectangle returns exactly the points it contains. Jon Bentley introduced the structure in 1980 as a clean static solution with provable query-time guarantees.',
        'The distinction between reporting and counting matters. A 2D Fenwick tree can maintain rectangle sums. A range tree lists the actual points inside the rectangle -- B, C, and D, not "3 points." Reporting is the harder promise because the algorithm must produce each answer, and the output size k enters the cost bound directly.',
        'Many real problems are reporting problems dressed in application clothing. Every store inside this bounding box. Every alert in a time-severity window. Every label in the current map viewport. Every sensor reading in a date-value rectangle. Missing a point is a correctness bug, not a quality tradeoff. The range tree exists because these queries need exact, predictable answers from static point sets.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Sort the points by x and binary-search for the x interval endpoints. This narrows the candidates from n to the O(log n + m) points whose x coordinates fall in range, where m is the size of that x-slice. Then scan those m candidates and check each one against the y bounds. This is simple, uses O(n) space, and works well when the x-slice is small.',
        'A second natural attempt is a k-d tree. Alternate splitting by x and y, prune subtrees that miss the rectangle, and recurse into the rest. k-d trees are easy to build and handle nearest-neighbor queries too. For moderate n and friendly distributions, they perform well in practice.',
        {
          type: 'note',
          text: 'Neither approach is wrong. The sorted-array method is optimal for one-dimensional queries. The k-d tree is a solid general-purpose spatial index. The range tree exists because both approaches hit a specific wall when the problem demands worst-case guarantees on exact 2D reporting.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The sorted-array approach breaks when the x-slice is large but the y-filter is selective. Query x in [0, 1000000] and y in [50, 51] on a million points: the x binary search returns nearly every point, and the linear y-scan dominates. The cost becomes O(n) per query even though the output might be two points. Sorting by one coordinate does not help filter the other.',
        'The k-d tree hits a different wall. Its worst-case query time on n points in 2D is O(sqrt(n) + k). For n = 1,000,000 and k = 0, that is 1,000 nodes visited to confirm the rectangle is empty. The sqrt(n) term comes from subtrees that straddle the query boundary and cannot be pruned. No rearrangement of the splitting planes eliminates this bound for arbitrary rectangles.',
        'The core tension: one dimension of sorted order is not enough, and alternating dimensions (as k-d trees do) trades worst-case guarantees for average-case flexibility. The range tree resolves this by nesting complete sorted structures -- one per dimension -- so that neither coordinate axis is ever partially indexed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build a balanced BST over the x-coordinates of all n points. At every internal node v, store an associated structure: a sorted array of the y-coordinates of all points in v\'s subtree. This associated array is the key to the second dimension. Construction takes O(n log n) time and O(n log n) space because each point appears in associated structures along one root-to-leaf path of depth O(log n).',
        {
          type: 'diagram',
          label: '2D range tree with associated y-structures',
          text: [
            '              [x=5]  <-- root, split node',
            '             /     \\',
            '          [x=2]   [x=8]',
            '          / \\      / \\',
            '        (1,4) (3,7) (6,3) (9,6)',
            '',
            '  Associated y-arrays at each internal node:',
            '    root  -> [3, 4, 6, 7]   (all points)',
            '    x=2   -> [4, 7]         (A, B)',
            '    x=8   -> [3, 6]         (C, D)',
          ].join('\n'),
        },
        'To query rectangle [x1, x2] x [y1, y2]: find the split node where the search paths for x1 and x2 diverge. Walk left toward x1; whenever the path goes left at a node v, the right child of v is entirely inside the x-range, so its associated y-array is canonical. Walk right toward x2 symmetrically. For each canonical subtree, binary-search its y-array for y1 and y2 and report the slice between them.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// 1D range query on a sorted array (the y-search inside each canonical subtree)',
            'function rangeQuery1D(sortedArr, lo, hi) {',
            '  // Find first index >= lo',
            '  let left = 0, right = sortedArr.length;',
            '  while (left < right) {',
            '    const mid = (left + right) >>> 1;',
            '    if (sortedArr[mid] < lo) left = mid + 1;',
            '    else right = mid;',
            '  }',
            '  const start = left;',
            '',
            '  // Find first index > hi',
            '  right = sortedArr.length;',
            '  while (left < right) {',
            '    const mid = (left + right) >>> 1;',
            '    if (sortedArr[mid] <= hi) left = mid + 1;',
            '    else right = mid;',
            '  }',
            '  return sortedArr.slice(start, left);',
            '}',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, the canonical subtree decomposition is exact: the O(log n) subtrees selected by the split-and-walk procedure are disjoint, and their union contains every point with x in [x1, x2] and no point outside that range. This follows from the BST ordering invariant -- every point in a right child has x greater than its parent, and every point in a left child has x less than or equal.',
        'Second, the associated y-array at each canonical node contains all and only the points in that subtree. Binary searching for y1 and y2 in a sorted array finds the exact slice of points with y in [y1, y2]. The union of slices across all canonical subtrees therefore reports every point inside the query rectangle exactly once, with no false positives and no misses.',
        'The decomposition generalizes to d dimensions by recursion: the associated structure at each level is itself a (d-1)-dimensional range tree. In 2D the associated structure is a sorted array (a 1D "range tree"). In 3D each node of the x-tree holds a 2D range tree over (y, z). The correctness argument applies inductively at each layer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Metric', 'Plain 2D range tree', 'With fractional cascading', 'd-dimensional'],
          rows: [
            ['Build time', 'O(n log n)', 'O(n log n)', 'O(n log^(d-1) n)'],
            ['Space', 'O(n log n)', 'O(n log n)', 'O(n log^(d-1) n)'],
            ['Query time', 'O(log^2 n + k)', 'O(log n + k)', 'O(log^d n + k)'],
            ['Doubling n', '+1 level, x2 catalogs', '+1 level, x2 catalogs', '+1 level per dimension'],
          ],
        },
        'The O(n log n) space comes from each point appearing in O(log n) associated y-arrays -- once per ancestor on its root-to-leaf path. The O(log^2 n + k) query cost is O(log n) canonical subtrees times O(log n) for a binary search in each y-array, plus O(k) to output the results.',
        'Fractional cascading eliminates the repeated binary searches. The idea: merge adjacent y-arrays and store rank pointers (bridges) so that once you binary-search the first catalog, subsequent catalogs can be entered in O(1) via the bridge. This drops the query to O(log n + k) without increasing space order. The tradeoff is implementation complexity and the requirement that catalogs are static.',
        'The +k term is inherent. Any algorithm that reports k points must spend at least O(k) time writing them out. A query rectangle covering the whole dataset costs O(n) regardless of index quality. The range tree optimizes the search overhead -- the cost of figuring out which points to report -- not the cost of reporting them.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'table',
          headers: ['Structure', 'Query type', 'Query time (2D)', 'Space', 'Best for'],
          rows: [
            ['Range tree', 'Orthogonal reporting', 'O(log n + k)', 'O(n log n)', 'Exact static rectangle queries'],
            ['k-d tree', 'Spatial pruning', 'O(sqrt(n) + k)', 'O(n)', 'Low-d nearest neighbor, moderate n'],
            ['R-tree', 'Rectangle overlap', 'O(n) worst case', 'O(n)', 'Dynamic geometry, disk-backed'],
            ['Segment tree', 'Interval stabbing/aggregate', 'O(log n + k)', 'O(n log n)', 'Interval queries, range updates'],
          ],
        },
        'Range trees dominate when data is static, queries are axis-aligned rectangles, and every matching point must be reported with worst-case guarantees. Static map-label layers are a textbook fit: the label positions do not change, the viewport is an axis-aligned box, and missing a label is a visible bug. Offline spatial analytics -- "all events in this time-value window" -- is another natural case.',
        'They also serve as the cleanest gateway to the layered-dimension family of structures. Understanding the range tree makes merge-sort trees (the array analogue with sorted catalogs), priority search trees (three-sided reporting), and fractional cascading (shared-search optimization) immediate extensions rather than unrelated topics.',
        'In computational geometry contests, range trees are a standard tool because they convert a multi-dimensional reporting problem into a sequence of one-dimensional searches with clean, memorizable cost bounds.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Range trees are not general spatial indexes. They do not handle nearest-neighbor queries, arbitrary polygon containment, circle range searches, or rectangle-to-rectangle intersection. For those problems, k-d trees, R-trees, ball trees, or spatial hashes are better fits because their pruning strategies match the query geometry.',
        'The O(n log n) space is a real cost. For a billion points, the associated y-arrays consume roughly 30 billion entries (log2(10^9) ~ 30). A k-d tree stores the same points in O(n) space. When memory is the binding constraint, the range tree loses.',
        'Dynamic updates are painful. Inserting a point requires updating associated y-arrays along the insertion path. Deletions are worse -- removing a point from O(log n) sorted arrays while maintaining sortedness is expensive. Semi-dynamic variants exist (logarithmic rebuilding), but they are complex and rarely match the simplicity of inserting into an R-tree or k-d tree. If the point set changes frequently, the range tree is the wrong tool.',
        {
          type: 'note',
          text: 'Layered range trees (using arrays instead of trees for the associated structures) improve cache behavior but make the static-only constraint even harder to escape. Choose a range tree when you can afford to build once and query many times.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Bentley, "Multidimensional Divide-and-Conquer" (1980) -- the original range tree paper.',
            'Chazelle, "Filtering Search: A New Approach to Query-Answering" (1986) -- introduces fractional cascading to reduce the log factor.',
            'de Berg et al., "Computational Geometry: Algorithms and Applications," Chapter 5 -- the standard textbook treatment with proofs and pseudocode.',
            'MIT 6.851 Advanced Data Structures, Lecture 3 -- orthogonal range searching notes: https://courses.csail.mit.edu/6.851/spring10/scribe/lec03.pdf',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'Binary Search Tree -- the outer tree structure and search-path decomposition'],
            ['Prerequisite', 'Binary Search -- the 1D range query inside each associated array'],
            ['Alternative', 'k-d Tree -- spatial pruning with O(n) space but weaker worst-case bounds'],
            ['Alternative', 'R-Tree Spatial Index -- dynamic geometry with heuristic packing'],
            ['Extension', 'Fractional Cascading -- the optimization that drops log^2 to log'],
            ['Extension', 'Priority Search Tree Range Reporting -- three-sided queries without the second log'],
            ['Analogue', 'Merge-Sort Tree Range Counting -- the array version with sorted catalogs'],
            ['Complement', '2D Fenwick Tree & Coordinate Compression -- mutable aggregate queries instead of reporting'],
          ],
        },
      ],
    },
  ],
};
