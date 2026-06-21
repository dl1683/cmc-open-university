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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/priority-search-tree-range-reporting.gif', alt: 'Animated walkthrough of the priority search tree range reporting visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A three-sided range query asks for points whose x value lies inside an interval and whose y value passes one threshold, such as x in [2, 8] and y <= 4. This shape appears in computational geometry, interval stabbing transformations, viewport queries, and scheduling problems where one dimension is an ordered range and the other is a priority cutoff.',
        {type: 'callout', text: 'A priority search tree is useful because one subtree certificate answers the y question for many x-ordered points at once.'},
        'A priority search tree exists because neither a plain search tree nor a plain heap sees both constraints. The query needs x-order to avoid scanning unrelated columns, and it needs y-priority to stop descending into subtrees that cannot contain answers.',
      ],
    },
    {
      heading: 'The obvious approaches hit opposite walls',
      paragraphs: [
        'Sorting by x lets the query jump to the interval, but the interval can still contain thousands of points whose y values fail. A heap by y finds low-y points quickly, but it has no way to restrict the answer to x between a and b.',
        'A full two-dimensional range tree can answer more general rectangle queries, but it pays extra space for associated structures. The priority search tree targets the narrower three-sided shape and gets linear space with output-sensitive reporting.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'Every subtree carries two meanings. Its x structure describes an interval of x values, and its priority point gives the minimum y value inside that subtree. The x side tells the query where to look. The y side tells the query when looking is pointless.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree with internal separator keys and child nodes', caption: 'The search-tree half of the structure uses separator logic like other ordered trees, but each region also carries a priority witness. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
        'The invariant is the whole data structure: x-order supports splitting into canonical subtrees, and y-heap order puts the best y witness for each subtree at the top. If the best witness fails y <= Y, every point below it fails too.',
        'Textbook implementations often separate split keys from stored priority points. The visualization uses a compact node-per-point picture because it is easier to read, but the lesson is the same: each explored region needs an x interval and a minimum-y certificate.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the x-order y-heap view, read each node label as a point and each subtree as a region. The top point is highlighted because it is the minimum-y witness for the region below it. That witness is what makes pruning safe.',
        'In the three-sided query view, the query node names the box: x between 2 and 8, y at most 4. Highlighted search paths find the x boundaries. Removed nodes are not random misses; their subtree witness has y above the threshold, so the entire subtree can be ignored.',
        'In the interval case study view, the important move is the transformation. An interval [l, r] becomes a point. Intersecting a query interval becomes a three-sided condition after one coordinate is flipped.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'For a query [x1, x2] by y <= Y, first use the search-tree side to find the split region for the two x boundaries. This produces search paths and canonical subtrees whose x ranges lie fully inside the query interval.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt: 'Colored Voronoi cells partitioning a plane around points', caption: 'Orthogonal range structures and nearest-cell diagrams solve different problems, but both make spatial pruning visible. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euclidean_Voronoi_diagram.svg.'},
        'Then use the heap side inside those canonical subtrees. If the subtree minimum y is greater than Y, stop. If it passes, report the stored point when its x is in range, then continue into children that might contain more passing points.',
        'This is output-sensitive reporting. The query pays for the boundary search and for the points it reports, not for every point in the original set.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The visualization query is x in [2, 8] and y <= 4. Points p3 = (3, 2), p6 = (6, 1), p7 = (7, 4), and p8 = (8, 3) pass. Point p4 = (4, 5) has acceptable x but fails y. Point p1 is too far left, and p9 is too far right.',
        'The useful moment is the y prune. Once a subtree witness has y = 5 or y = 7, the query does not need to inspect its descendants. Heap order says every descendant has y at least that large, so none can satisfy y <= 4.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The x search is safe because the tree decomposes the query interval into disjoint canonical subtrees. Any point outside those subtrees has x outside the interval or lies on a boundary path already checked.',
        'The y pruning is safe because the root or stored priority point for a subtree is the minimum y in that subtree. If even that point is above the threshold, no hidden descendant can be below it. If it passes, the subtree may contain answers, so the query descends and reports the passing points.',
        'The two arguments multiply. X-order prevents searching unrelated x regions. Y-heap order prevents scanning every point inside a related x region.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The classic static structure uses O(n) space and answers three-sided reporting queries in O(log n + k), where k is the number of reported points. Construction is often O(n log n), with faster builds possible when the needed orderings are already available.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram with input and output ends', caption: 'The priority side is not an ordinary FIFO queue, but the image helps separate container policy from the x-search skeleton. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'The tradeoff is specialization. A priority search tree is strong because the rectangle is missing one side. Add both lower and upper y bounds, and the direct structure no longer answers the full query by one heap threshold. Range trees, layered range trees, or other spatial indexes may be a better fit.',
        'Dynamic updates are possible but more complex than the static teaching version. If the point set changes constantly, a simpler interval tree, balanced range tree, R-tree, or rebuild-in-batches strategy may be easier to operate.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Priority search trees fit mostly static point sets with many three-sided queries. Examples include geometric filtering, dominance-style reporting, scheduling queries after a coordinate transform, and interval intersection batches where all matching intervals must be reported.',
        'The interval transformation is a good case study. Store interval [l, r] as point (l, r). A query [a, b] intersects it when l <= b and r >= a. Flip the r coordinate and the second condition becomes a single threshold, giving the priority search tree its three-sided shape.',
      ],
    },
    {
      heading: 'Where it is not the right tool',
      paragraphs: [
        'Use an interval tree for ordinary dynamic calendar-style overlap queries. Use a range tree for full rectangle reporting. Use an R-tree or spatial database index for disk-backed, high-dimensional, approximate, or geographic workloads with messy update patterns.',
        'Do not choose a priority search tree because it sounds like a general spatial index. Choose it when the query shape is exactly the one it exploits and output-sensitive exact reporting matters.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'If the x decomposition is wrong, the query misses valid points or scans unrelated regions. If the y witness is stale, pruning becomes unsound and can silently drop answers. These bugs are worse than slow scans because they return plausible incomplete results.',
        'Another failure mode is weak coordinate modeling. In interval applications, open versus closed endpoints, coordinate flips, timestamp precision, and tie handling must match the API. The tree cannot repair an incorrect geometric reduction.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Binary Search Tree and Binary Heap for the two invariants, Range Tree Orthogonal Search for the more general rectangle problem, Interval Tree for one-dimensional dynamic overlap, k-d Tree and R-Tree for broader spatial indexing, and Fractional Cascading for speeding repeated catalog searches.',
        'Primary source: Edward M. McCreight, "Priority Search Trees", https://epubs.siam.org/doi/10.1137/0214021. Useful lecture notes include the Iowa State notes at https://faculty.sites.iastate.edu/jia/files/inline-files/27.%20priority%20search%20trees.pdf and Brown computational geometry notes at https://cs.brown.edu/courses/cs252/misc/resources/lectures/pdf/notes07.pdf.',
      ],
    },
  ],
};
