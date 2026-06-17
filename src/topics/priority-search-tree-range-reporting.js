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
      heading: 'Why this exists',
      paragraphs: [
        'A three-sided range query asks for points whose x value lies inside an interval and whose y value passes one threshold, such as x in [2, 8] and y <= 4. This shape appears in computational geometry, interval stabbing transformations, viewport queries, and scheduling problems where one dimension is an ordered range and the other is a priority cutoff.',
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
