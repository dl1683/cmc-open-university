// Priority search trees combine a binary-search tree on x with a heap on y,
// giving linear-space three-sided orthogonal range reporting.

import { graphState, matrixState, InputError } from '../core/state.js';

const r2 = (v) => Math.round(v * 100) / 100;

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
  const g1 = pstGraph('Priority search tree: BST by x, heap by y');
  const h1 = { active: ['p6', 'p3', 'p8'], found: ['p6'] };
  yield {
    state: g1,
    highlight: h1,
    explanation: `A priority search tree stores ${g1.nodes.length} points in one tree with ${h1.active.length} active nodes highlighted and ${h1.found.length} found root: x-order supports binary-search splitting, while y-heap order puts the smallest y in each subtree near the top.`,
    invariant: 'In-order traversal is sorted by x, and every subtree root has the minimum y point in that subtree.',
  };

  const matRows1 = [
    { id: 'xorder', label: 'x order' },
    { id: 'yheap', label: 'y heap' },
    { id: 'space', label: 'space' },
    { id: 'query', label: 'query' },
  ];
  const matCols1 = [
    { id: 'job', label: 'job' },
    { id: 'payoff', label: 'payoff' },
  ];
  const h2 = { active: ['xorder:payoff', 'yheap:payoff'], found: ['query:payoff'] };
  yield {
    state: labelMatrix(
      'Two invariants in one tree',
      matRows1,
      matCols1,
      [
        ['split by x interval', 'search-tree path'],
        ['prune by y bound', 'priority queue test'],
        ['one node per point', 'linear'],
        ['three-sided box', 'O(log n + k)'],
      ],
    ),
    highlight: h2,
    explanation: `The ${matRows1.length}×${matCols1.length} matrix shows the structure is a deliberate hybrid with ${h2.active.length} active payoff cells. A Range Tree stores associated catalogs; a priority search tree folds one priority dimension directly into the tree.`,
  };

  const g3 = pstGraph('The root is the best y candidate of the whole set');
  const h3 = { found: ['p6'], compare: ['p1', 'p4', 'p7', 'p9'], active: ['p3', 'p8'] };
  yield {
    state: g3,
    highlight: h3,
    explanation: `If a subtree root has y above the query bound, then every point below it has y above the bound too. With ${h3.compare.length} leaf nodes compared and ${h3.active.length} active children, the heap invariant is the pruning lever across all ${g3.edges.length} edges.`,
  };

  const matRows2 = [
    { id: 'range', label: 'Range Tree' },
    { id: 'pst', label: 'Priority ST' },
    { id: 'kdtree', label: 'k-d Tree' },
    { id: 'heap', label: 'Binary Heap' },
  ];
  const matCols2 = [
    { id: 'strength', label: 'strength' },
    { id: 'limit', label: 'limit' },
  ];
  const h4 = { found: ['pst:strength', 'pst:limit'], compare: ['range:limit', 'heap:limit'] };
  yield {
    state: labelMatrix(
      'Compared with neighbors',
      matRows2,
      matCols2,
      [
        ['full rectangles', 'more space'],
        ['3-sided queries', 'special shape'],
        ['spatial pruning', 'weaker bound'],
        ['global minimum', 'no x range'],
      ],
    ),
    highlight: h4,
    explanation: `Across ${matRows2.length} competing structures with ${h4.found.length} cells found for Priority ST, priority search trees are not general replacements for range trees. They are excellent when the query is three-sided, such as x in [a,b] and y at most c.`,
  };
}

function* threeSidedQuery() {
  const g1 = pstGraph('Query x[2,8], y <= 4');
  const h1 = { active: ['query', 'p6', 'p3', 'p8'], found: ['p6', 'p3', 'p8', 'p7'], compare: ['p1', 'p4', 'p9'] };
  yield {
    state: g1,
    highlight: h1,
    explanation: `The example query asks for points whose x is between 2 and 8 and whose y is at most 4. The answer has ${h1.found.length} points: p3, p6, p7, and p8. The ${h1.compare.length} compared points (p1, p4, p9) fail either x or y.`,
    invariant: 'Reporting cost is output-sensitive: after the search path, every reported point contributes one unit of work.',
  };

  const procRows = [
    { id: 'split', label: 'split by x' },
    { id: 'left', label: 'left path' },
    { id: 'right', label: 'right path' },
    { id: 'heap', label: 'heap prune' },
    { id: 'emit', label: 'emit' },
  ];
  const procCols = [
    { id: 'test', label: 'test' },
    { id: 'effect', label: 'effect' },
  ];
  const h2 = { active: ['split:effect', 'heap:effect'], found: ['emit:effect'] };
  yield {
    state: labelMatrix(
      'Three-sided query procedure',
      procRows,
      procCols,
      [
        ['x interval', 'find boundary paths'],
        ['canonical right subtrees', 'inside x range'],
        ['canonical left subtrees', 'inside x range'],
        ['root y <= ymax?', 'descend or prune'],
        ['point in bounds', 'report k'],
      ],
    ),
    highlight: h2,
    explanation: `The ${procRows.length}-step procedure with ${h2.active.length} active phases works like a range tree on the x dimension to create canonical subtrees. Unlike a range tree, the y condition is handled by heap pruning instead of searching associated y-lists.`,
  };

  const g3 = pstGraph('A y-bound prunes entire subtrees');
  const h3 = { active: ['p4', 'p9'], removed: ['p4', 'p9'], found: ['p7', 'p8'] };
  yield {
    state: g3,
    highlight: h3,
    explanation: `Because ${h3.removed.length} nodes are pruned (p4 with y=5, p9 with y=7), subtrees rooted at those nodes cannot contain any point with y<=4 under min-y heap order. Meanwhile ${h3.found.length} points pass and are reported.`,
  };

  const perfRows = [
    { id: 'build', label: 'build' },
    { id: 'space', label: 'space' },
    { id: 'query', label: 'query' },
    { id: 'dynamic', label: 'dynamic' },
  ];
  const perfCols = [
    { id: 'bound', label: 'bound' },
    { id: 'note', label: 'note' },
  ];
  const h4 = { found: ['space:bound', 'query:bound'], compare: ['dynamic:note'] };
  yield {
    state: labelMatrix(
      'Performance shape',
      perfRows,
      perfCols,
      [
        ['O(n log n)', 'sort/select points'],
        ['O(n)', 'one node per point'],
        ['O(log n + k)', '3-sided report'],
        ['possible', 'more machinery'],
      ],
    ),
    highlight: h4,
    explanation: `The ${perfRows.length} performance metrics show ${h4.found.length} highlighted bounds: linear space is the selling point. Full 2D range trees give more general rectangles but spend more memory on associated structures.`,
  };
}

function* intervalCaseStudy() {
  const intRows = [
    { id: 'i1', label: '[1,6]' },
    { id: 'i2', label: '[3,5]' },
    { id: 'i3', label: '[7,9]' },
    { id: 'q', label: 'query [4,8]' },
  ];
  const intCols = [
    { id: 'point', label: '(start,end)' },
    { id: 'condition', label: 'intersects?' },
  ];
  const h1 = { active: ['q:condition'], found: ['i1:condition', 'i2:condition', 'i3:condition'] };
  yield {
    state: labelMatrix(
      'Interval intersection as points',
      intRows,
      intCols,
      [
        ['(1,6)', 'start<=8 and end>=4'],
        ['(3,5)', 'start<=8 and end>=4'],
        ['(7,9)', 'start<=8 and end>=4'],
        ['-', 'three-sided after transform'],
      ],
    ),
    highlight: h1,
    explanation: `Each of the ${intRows.length - 1} intervals maps to a point (l,r). With ${h1.found.length} intersections found, the query condition l <= b and r >= a becomes a three-sided range query after a coordinate flip.`,
  };

  const g2 = pstGraph('Priority search tree as an interval-intersection engine');
  const h2 = { active: ['query', 'p6', 'p8'], found: ['p3', 'p6', 'p7', 'p8'] };
  yield {
    state: g2,
    highlight: h2,
    explanation: `With ${h2.active.length} active traversal nodes and ${h2.found.length} results reported from ${g2.nodes.length} total nodes, this is why priority search trees appear in computational geometry. They turn an interval query into x filtering plus one heap-style priority threshold.`,
  };

  const decRows = [
    { id: 'calendar', label: 'calendar' },
    { id: 'geometry', label: 'geometry' },
    { id: 'database', label: 'database' },
    { id: 'visual', label: 'viewport' },
  ];
  const decCols = [
    { id: 'need', label: 'need' },
    { id: 'fit', label: 'fit' },
  ];
  const h3 = { found: ['geometry:fit', 'visual:fit'], compare: ['calendar:fit', 'database:fit'] };
  yield {
    state: labelMatrix(
      'Case-study decision',
      decRows,
      decCols,
      [
        ['overlap one axis', 'Interval Tree'],
        ['3-sided report', 'Priority ST'],
        ['many predicates', 'B/R-tree'],
        ['static points', 'Range Tree/PST'],
      ],
    ),
    highlight: h3,
    explanation: `Across ${decRows.length} use cases with ${h3.found.length} strong fits and ${h3.compare.length} alternatives compared, priority search trees are best read as a specialized exact tool complementing Interval Tree, Range Tree, R-Tree, and k-d Tree.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the tree as two structures sharing one set of points. The x direction behaves like a search tree over coordinate intervals, and the y value behaves like a priority witness for each subtree. A highlighted subtree is a region that the query can either report from or prune.',
        {type: 'image', src: './assets/gifs/priority-search-tree-range-reporting.gif', alt: 'Animated walkthrough of the priority search tree range reporting visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The query is three-sided: x lies in an interval and y passes one threshold. Removed nodes are not guesses; their minimum-y witness already fails the threshold. The safe inference is that if the best y in a subtree fails, every descendant fails too.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A three-sided range query asks for points with x between two bounds and y below or above one threshold. This appears in computational geometry, scheduling, interval transformations, and viewport filters. The query needs ordered search in one dimension and priority pruning in the other.',
        {type: 'callout', text: 'A priority search tree is useful because one subtree certificate answers the y question for many x-ordered points at once.'},
        'A plain binary search tree can find the x interval but may scan many points whose y values fail. A plain heap can find low-y points but cannot restrict x. A priority search tree combines both invariants for the narrower three-sided query shape.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to sort points by x and scan the slice inside [x1, x2]. This is simple and often fine when the slice is small. It becomes expensive when the x interval is wide and most points fail the y threshold.',
        'Another approach is to keep a heap by y. That finds promising y values quickly, but it has no idea whether the x coordinate lies in range. A full two-dimensional range tree handles more general rectangles, but it uses extra associated structures.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that neither one-dimensional order carries both facts. X-order alone cannot certify that a whole subtree fails y. Y-order alone cannot skip points outside the x interval.',
        'A general rectangle query has four sides and needs heavier machinery. The priority search tree wins by exploiting the missing side. It specializes in x-range plus one y-threshold, and that specialization is why it can use linear space.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every subtree stores two meanings. Its search-tree position describes an x interval, and its priority point witnesses the best y value inside that interval. The x side tells the query where to search, while the y side tells it when searching is pointless.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree with internal separator keys and child nodes', caption: 'The search-tree half of the structure uses separator logic like other ordered trees, but each region also carries a priority witness. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
        'The invariant is x-order plus y-heap order. If a subtree minimum y is greater than the query threshold Y, no point in that subtree can satisfy y <= Y. If the witness passes, the query may descend and report actual points in x range.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a query x in [x1, x2] and y <= Y, first use the search-tree side to find boundary paths and canonical subtrees whose x ranges lie inside the interval. Points outside those ranges are ignored by x-order. Boundary nodes are checked individually.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt: 'Colored Voronoi cells partitioning a plane around points', caption: 'Orthogonal range structures and nearest-cell diagrams solve different problems, but both make spatial pruning visible. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euclidean_Voronoi_diagram.svg.'},
        'Inside each canonical subtree, inspect the priority witness. If its y is above Y, stop at that subtree. If it passes, report it when its x is in range and recursively inspect children because more passing points may exist.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The x part is correct because a search tree decomposes an interval into disjoint canonical regions plus boundary checks. Any point not in those regions has x outside the query interval or was tested on a boundary path. No valid x point is skipped by the decomposition.',
        'The y pruning is correct because the priority witness is the minimum y in its subtree. If that minimum is greater than Y, every descendant has y greater than Y as well. The two proofs combine: x-order limits the regions, and y-order prevents scanning every point inside them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The classic static priority search tree uses O(n) space. A three-sided reporting query costs O(log n + k), where k is the number of reported points. The log n term finds the relevant x regions, and the k term is unavoidable because the output itself has size k.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram with input and output ends', caption: 'The priority side is not an ordinary FIFO queue, but the image helps separate container policy from the x-search skeleton. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'Construction is commonly O(n log n), with faster builds possible when sorted orders are available. Dynamic updates are possible but more complex because both x placement and y witnesses must remain correct. The behavioral cost is specialization: the structure is excellent for one missing side, not for every rectangle query.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Priority search trees fit mostly static point sets with many three-sided reports. They appear in computational geometry, dominance reporting, spatial filters, and interval intersection after coordinate transformation. They are useful when exact output-sensitive reporting matters.',
        'For interval intersection, store interval [l, r] as a point and transform the overlap condition into one x bound and one y threshold. The exact coordinate flip depends on the chosen convention. The important point is that an interval question can become a three-sided point query.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a general spatial index. Full rectangle reporting with both lower and upper y bounds needs a range tree, layered range tree, or another structure. Disk-backed geographic workloads with messy updates usually fit R-trees or database indexes better.',
        'It also fails if witnesses go stale. An incorrect minimum-y value can prune a subtree that contains valid answers, which returns plausible but incomplete results. Coordinate modeling errors around open endpoints, ties, and timestamp precision can break the reduction before the tree starts.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the query x in [2, 8] and y <= 4. Points (3, 2), (6, 1), (7, 4), and (8, 3) pass. Point (4, 5) has acceptable x but fails y, while points with x = 1 or x = 9 fail the x interval.',
        'Suppose a canonical subtree covers x values from 4 through 7 and its minimum-y witness is (6, 1). Because 1 <= 4, the subtree may contain answers, so the query descends and reports passing points. If another subtree has witness y = 7, the query stops immediately.',
        'That prune is the payoff. The query does not inspect every descendant below the y = 7 witness, because heap order proves all descendants have y at least 7. The result is O(log n + k) behavior rather than scanning every point in the x slice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Edward M. McCreight, Priority Search Trees, SIAM Journal on Computing, 1985. Useful lecture references include computational geometry notes that derive three-sided reporting and interval reductions from the same invariants.',
        'Study next: Binary Search Tree and Binary Heap for the two combined invariants, Range Tree for full rectangle search, Interval Tree for dynamic one-dimensional overlap, k-d Tree and R-Tree for broader spatial indexing, and Fractional Cascading for repeated catalog searches.',
      ],
    },
  ],
};
