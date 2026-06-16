// Priority search trees combine a binary-search tree on x with a heap on y,
// giving linear-space three-sided orthogonal range reporting.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'priority-search-tree-range-reporting',
  title: 'Priority Search Tree Range Reporting',
  category: 'Data Structures',
  summary: 'A hybrid of search tree and priority queue: keep x-order for splitting, y-heap order for pruning, and report three-sided ranges in O(log n + k).',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['x-order y-heap', 'three-sided query', 'interval case study'], defaultValue: 'x-order y-heap' },
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

function pstGraph(title) {
  return graphState({
    nodes: [
      { id: 'p6', label: 'p6', x: 4.9, y: 6.8, note: '(6,1)' },
      { id: 'p3', label: 'p3', x: 2.7, y: 4.8, note: '(3,2)' },
      { id: 'p8', label: 'p8', x: 7.1, y: 4.8, note: '(8,3)' },
      { id: 'p1', label: 'p1', x: 1.4, y: 2.5, note: '(1,6)' },
      { id: 'p4', label: 'p4', x: 3.8, y: 2.5, note: '(4,5)' },
      { id: 'p7', label: 'p7', x: 6.1, y: 2.5, note: '(7,4)' },
      { id: 'p9', label: 'p9', x: 8.4, y: 2.5, note: '(9,7)' },
      { id: 'query', label: 'Q', x: 4.9, y: 0.8, note: 'x[2,8], y<=4' },
    ],
    edges: [
      { id: 'e-6-3', from: 'p6', to: 'p3', weight: '' },
      { id: 'e-6-8', from: 'p6', to: 'p8', weight: '' },
      { id: 'e-3-1', from: 'p3', to: 'p1', weight: '' },
      { id: 'e-3-4', from: 'p3', to: 'p4', weight: '' },
      { id: 'e-8-7', from: 'p8', to: 'p7', weight: '' },
      { id: 'e-8-9', from: 'p8', to: 'p9', weight: '' },
      { id: 'e-query-3', from: 'query', to: 'p3', weight: '' },
      { id: 'e-query-8', from: 'query', to: 'p8', weight: '' },
    ],
  }, { title });
}

function* xOrderYHeap() {
  yield {
    state: pstGraph('Priority search tree: BST by x, heap by y'),
    highlight: { active: ['p6', 'p3', 'p8'], found: ['p6'] },
    explanation: 'A priority search tree stores 2D points in one tree with two invariants: x-order supports binary-search splitting, while y-heap order puts the smallest y in each subtree near the top.',
    invariant: 'In-order traversal is sorted by x, and every subtree root has the minimum y point in that subtree.',
  };

  yield {
    state: labelMatrix(
      'Two invariants in one tree',
      [
        { id: 'xorder', label: 'x order' },
        { id: 'yheap', label: 'y heap' },
        { id: 'space', label: 'space' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'payoff', label: 'payoff' },
      ],
      [
        ['split by x interval', 'search-tree path'],
        ['prune by y bound', 'priority queue test'],
        ['one node per point', 'linear'],
        ['three-sided box', 'O(log n + k)'],
      ],
    ),
    highlight: { active: ['xorder:payoff', 'yheap:payoff'], found: ['query:payoff'] },
    explanation: 'The structure is a deliberate hybrid. A Range Tree stores associated catalogs; a priority search tree folds one priority dimension directly into the tree.',
  };

  yield {
    state: pstGraph('The root is the best y candidate of the whole set'),
    highlight: { found: ['p6'], compare: ['p1', 'p4', 'p7', 'p9'], active: ['p3', 'p8'] },
    explanation: 'If a subtree root has y above the query bound, then every point below it has y above the bound too. That heap invariant is the pruning lever.',
  };

  yield {
    state: labelMatrix(
      'Compared with neighbors',
      [
        { id: 'range', label: 'Range Tree' },
        { id: 'pst', label: 'Priority ST' },
        { id: 'kdtree', label: 'k-d Tree' },
        { id: 'heap', label: 'Binary Heap' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['full rectangles', 'more space'],
        ['3-sided queries', 'special shape'],
        ['spatial pruning', 'weaker bound'],
        ['global minimum', 'no x range'],
      ],
    ),
    highlight: { found: ['pst:strength', 'pst:limit'], compare: ['range:limit', 'heap:limit'] },
    explanation: 'Priority search trees are not general replacements for range trees. They are excellent when the query is three-sided, such as x in [a,b] and y at most c.',
  };
}

function* threeSidedQuery() {
  yield {
    state: pstGraph('Query x[2,8], y <= 4'),
    highlight: { active: ['query', 'p6', 'p3', 'p8'], found: ['p6', 'p3', 'p8', 'p7'], compare: ['p1', 'p4', 'p9'] },
    explanation: 'The example query asks for points whose x is between 2 and 8 and whose y is at most 4. The answer is p3, p6, p7, and p8. Points p1, p4, and p9 fail either x or y.',
    invariant: 'Reporting cost is output-sensitive: after the search path, every reported point contributes one unit of work.',
  };

  yield {
    state: labelMatrix(
      'Three-sided query procedure',
      [
        { id: 'split', label: 'split by x' },
        { id: 'left', label: 'left path' },
        { id: 'right', label: 'right path' },
        { id: 'heap', label: 'heap prune' },
        { id: 'emit', label: 'emit' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['x interval', 'find boundary paths'],
        ['canonical right subtrees', 'inside x range'],
        ['canonical left subtrees', 'inside x range'],
        ['root y <= ymax?', 'descend or prune'],
        ['point in bounds', 'report k'],
      ],
    ),
    highlight: { active: ['split:effect', 'heap:effect'], found: ['emit:effect'] },
    explanation: 'Like a range tree, the x dimension creates canonical subtrees. Unlike a range tree, the y condition is handled by heap pruning instead of searching associated y-lists.',
  };

  yield {
    state: pstGraph('A y-bound prunes entire subtrees'),
    highlight: { active: ['p4', 'p9'], removed: ['p4', 'p9'], found: ['p7', 'p8'] },
    explanation: 'Because p4 has y=5 and p9 has y=7, subtrees rooted at those nodes cannot contain any point with y<=4 under min-y heap order. They are cut off immediately.',
  };

  yield {
    state: labelMatrix(
      'Performance shape',
      [
        { id: 'build', label: 'build' },
        { id: 'space', label: 'space' },
        { id: 'query', label: 'query' },
        { id: 'dynamic', label: 'dynamic' },
      ],
      [
        { id: 'bound', label: 'bound' },
        { id: 'note', label: 'note' },
      ],
      [
        ['O(n log n)', 'sort/select points'],
        ['O(n)', 'one node per point'],
        ['O(log n + k)', '3-sided report'],
        ['possible', 'more machinery'],
      ],
    ),
    highlight: { found: ['space:bound', 'query:bound'], compare: ['dynamic:note'] },
    explanation: 'The linear-space bound is the selling point. Full 2D range trees give more general rectangles but spend more memory on associated structures.',
  };
}

function* intervalCaseStudy() {
  yield {
    state: labelMatrix(
      'Interval intersection as points',
      [
        { id: 'i1', label: '[1,6]' },
        { id: 'i2', label: '[3,5]' },
        { id: 'i3', label: '[7,9]' },
        { id: 'q', label: 'query [4,8]' },
      ],
      [
        { id: 'point', label: '(start,end)' },
        { id: 'condition', label: 'intersects?' },
      ],
      [
        ['(1,6)', 'start<=8 and end>=4'],
        ['(3,5)', 'start<=8 and end>=4'],
        ['(7,9)', 'start<=8 and end>=4'],
        ['-', 'three-sided after transform'],
      ],
    ),
    highlight: { active: ['q:condition'], found: ['i1:condition', 'i2:condition', 'i3:condition'] },
    explanation: 'An interval [l,r] can be represented as a point (l,r). Intersecting a query interval [a,b] means l <= b and r >= a. With a coordinate flip, that becomes a three-sided range query.',
  };

  yield {
    state: pstGraph('Priority search tree as an interval-intersection engine'),
    highlight: { active: ['query', 'p6', 'p8'], found: ['p3', 'p6', 'p7', 'p8'] },
    explanation: 'This is why priority search trees appear in computational geometry and interval-query literature. They turn an interval query into x filtering plus one heap-style priority threshold.',
  };

  yield {
    state: labelMatrix(
      'Case-study decision',
      [
        { id: 'calendar', label: 'calendar' },
        { id: 'geometry', label: 'geometry' },
        { id: 'database', label: 'database' },
        { id: 'visual', label: 'viewport' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['overlap one axis', 'Interval Tree'],
        ['3-sided report', 'Priority ST'],
        ['many predicates', 'B/R-tree'],
        ['static points', 'Range Tree/PST'],
      ],
    ),
    highlight: { found: ['geometry:fit', 'visual:fit'], compare: ['calendar:fit', 'database:fit'] },
    explanation: 'Priority search trees are best read as a specialized exact tool. They complement Interval Tree, Range Tree, R-Tree, and k-d Tree rather than replacing them.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'x-order y-heap') yield* xOrderYHeap();
  else if (view === 'three-sided query') yield* threeSidedQuery();
  else if (view === 'interval case study') yield* intervalCaseStudy();
  else throw new InputError('Pick a priority-search-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A priority search tree is a computational-geometry data structure for two-dimensional points. It combines two familiar invariants in one tree: binary-search-tree order on x and heap order on y. The result is a linear-space structure for reporting points in three-sided ranges such as x in [a,b] and y at most c.',
        'McCreight described the structure as a symbiosis between a search tree and a priority queue. The search-tree side finds canonical x subtrees. The priority-queue side prunes any subtree whose best y value already fails the query threshold.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A node stores one point. In-order traversal is sorted by x, so the tree can split an x interval the way a Binary Search Tree does. At the same time, each subtree root stores the point with minimum y in that subtree. If the root y is larger than the query limit, the whole subtree can be rejected for y.',
        'For a query [x1,x2] by y<=Y, find the split paths for x1 and x2, identify canonical subtrees whose x ranges lie fully inside the interval, then recursively report from those subtrees while the heap y value passes. The query is output-sensitive: O(log n + k), where k is the number of reported points.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The classic static priority search tree uses O(n) space and answers three-sided orthogonal range reporting in O(log n + k). Construction is commonly O(n log n), or linear if the right sorted inputs are already available. Dynamic variants exist, but the cleanest teaching version is static or rebuilt in batches.',
        'The structure is narrower than a full 2D Range Tree Orthogonal Search. Range trees handle arbitrary rectangles at higher space cost. Priority search trees exploit the missing fourth side of the rectangle to fold the second dimension into a heap invariant.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A complete case study is interval intersection. Represent every stored interval [l,r] as a point (l,r). A query interval [a,b] intersects [l,r] when l <= b and r >= a. After flipping the r axis, this becomes a three-sided query. A priority search tree can report all intersecting intervals in output-sensitive time.',
        'This does not mean priority search trees always replace Interval Tree. If the workload is one-dimensional dynamic calendar booking, an augmented interval tree is simpler. If the workload is a mostly static computational-geometry batch with three-sided reporting, priority search tree is the sharper fit.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is treating the y-heap invariant like a Binary Heap that ignores x. A priority search tree must satisfy both invariants simultaneously. If x-order is broken, interval splitting fails. If y-heap order is broken, pruning can silently miss valid points.',
        'Another trap is applying it to full rectangles without thinking. A four-sided rectangle query needs both lower and upper y constraints. Priority search trees directly handle one y threshold; full range trees, range-tree variants, or layered structures may be required for general orthogonal range reporting.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Edward M. McCreight, "Priority Search Trees", SIAM Journal on Computing page at https://epubs.siam.org/doi/10.1137/0214021 and PDF mirror at https://courses.cs.duke.edu/cps234/fall08/handouts/SMJ000257.pdf. Lecture references: Iowa State priority-search-tree notes at https://faculty.sites.iastate.edu/jia/files/inline-files/27.%20priority%20search%20trees.pdf and Brown computational-geometry notes at https://cs.brown.edu/courses/cs252/misc/resources/lectures/pdf/notes07.pdf. Study 2D Range Tree Orthogonal Search, Interval Tree, Binary Heap, Binary Search Tree, k-d Tree, R-Tree Spatial Index, and Fractional Cascading next.',
      ],
    },
  ],
};
