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
  const graph1 = rangeTreeGraph('A 2D range tree nests y-structures under an x-tree');
  const rootNode = graph1.nodes.find(n => n.id === 'root');
  const leafNodes = graph1.nodes.filter(n => ['a', 'b', 'c', 'd'].includes(n.id));
  const ylistNode = graph1.nodes.find(n => n.id === 'ylist');
  yield {
    state: graph1,
    highlight: { active: ['root', 'left', 'right', 'ylist'], found: ['b', 'c', 'd'] },
    explanation: `A 2D range tree is a balanced BST over x, rooted at ${rootNode.label}. Each canonical x-subtree carries an associated structure sorted by y (here ${ylistNode.note}), so rectangle queries across ${leafNodes.length} points become x decomposition plus y filtering.`,
    invariant: `Every point appears in O(log n) associated y-structures — the root's y-list already holds all ${ylistNode.note.split(',').length} y-values: ${ylistNode.note}.`,
  };

  const queryTitle = 'Query rectangle x[2,8], y[3,7]';
  const matrixRows = [
    { id: 'split', label: 'split node' },
    { id: 'left_path', label: 'left path' },
    { id: 'right_path', label: 'right path' },
    { id: 'report', label: 'report' },
  ];
  const matrixCols = [
    { id: 'x_step', label: 'x step' },
    { id: 'y_step', label: 'y step' },
  ];
  const reported = 'B,C,D';
  yield {
    state: labelMatrix(
      queryTitle,
      matrixRows,
      matrixCols,
      [
        ['find where x bounds diverge', 'root x=5'],
        ['take right subtrees on path', 'search y lists'],
        ['take left subtrees on path', 'search y lists'],
        ['emit points in y range', reported],
      ],
    ),
    highlight: { active: ['left_path:y_step', 'right_path:y_step'], found: ['report:y_step'], compare: ['split:x_step'] },
    explanation: `The x-tree decomposes the query into ${matrixRows.length} phases (${matrixRows.map(r => r.label).join(', ')}). Associated y-lists inside canonical subtrees report only points whose y coordinate lies in range, yielding ${reported}.`,
  };

  const graph3 = rangeTreeGraph('Associated y-lists avoid scanning whole subtrees');
  const queryNode = graph3.nodes.find(n => n.id === 'query');
  const foundPoints = graph3.nodes.filter(n => ['b', 'c'].includes(n.id));
  const excludedPoints = graph3.nodes.filter(n => ['a', 'd'].includes(n.id));
  yield {
    state: graph3,
    highlight: { active: ['query', 'e-query-left', 'e-query-right', 'ylist'], found: ['b', 'c'], compare: ['a', 'd'] },
    explanation: `Once a canonical subtree is fully inside ${queryNode.note}, the query skips per-point x checks. The associated y-structure reports only ${foundPoints.map(n => n.label).join(', ')} while excluding ${excludedPoints.map(n => n.label).join(', ')}.`,
  };

  const comparisonRows = [
    { id: 'rangetree', label: 'range tree' },
    { id: 'kdtree', label: 'k-d Tree' },
    { id: 'rtree', label: 'R-Tree' },
    { id: 'bit2d', label: '2D Fenwick' },
  ];
  yield {
    state: labelMatrix(
      'Range tree versus nearby structures',
      comparisonRows,
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
    explanation: `Compared against ${comparisonRows.length - 1} alternatives (${comparisonRows.slice(1).map(r => r.label).join(', ')}), range trees are exact static search structures — not broad-phase collision indexes nor aggregate prefix structures.`,
  };
}

function* fractionalCascading() {
  const cascGraph1 = cascadeGraph('Many associated y-lists search the same y bounds');
  const catalogs = cascGraph1.nodes.filter(n => n.id.startsWith('cat'));
  const bridgeNode = cascGraph1.nodes.find(n => n.id === 'bridges');
  yield {
    state: cascGraph1,
    highlight: { active: ['range', 'cat1', 'cat2', 'cat3'], found: ['bridges'] },
    explanation: `A plain 2D range tree performs a y-range search in every canonical x-subtree. Fractional Cascading links ${catalogs.length} catalogs (${catalogs.map(c => c.label).join(', ')}) via ${bridgeNode.note} so repeated y-bound searches share work.`,
    invariant: `The query y bounds are identical across all ${catalogs.length} associated structures: ${catalogs.map(c => c.label).join(', ')}.`,
  };

  const plainBound = 'O(log^2 n + k)';
  const cascadedBound = 'O(log n + k)';
  const spaceBound = 'O(n log n)';
  const complexityRows = [
    { id: 'plain', label: 'plain 2D tree' },
    { id: 'cascaded', label: 'with cascading' },
    { id: 'space', label: 'space' },
    { id: 'output', label: 'reporting' },
  ];
  yield {
    state: labelMatrix(
      'Query-time improvement',
      complexityRows,
      [
        { id: 'bound', label: 'bound' },
        { id: 'why' },
      ],
      [
        [plainBound, 'search y at each level'],
        [cascadedBound, 'one search plus bridges'],
        [spaceBound, 'associated structures'],
        ['+k', 'must output answers'],
      ],
    ),
    highlight: { active: ['plain:bound', 'cascaded:bound'], found: ['cascaded:why'], compare: ['space:bound'] },
    explanation: `The classic improvement drops query time from ${plainBound} to ${cascadedBound}: one binary search, then bridge positions through related catalogs, all within ${spaceBound} space.`,
  };

  const cascGraph3 = cascadeGraph('Bridge ranks into each catalog');
  const bridgeEdges = cascGraph3.edges.filter(e => e.to === 'bridges');
  const outputNode = cascGraph3.nodes.find(n => n.id === 'output');
  yield {
    state: cascGraph3,
    highlight: { active: ['bridges', 'e-cat2-bridges', 'e-cat3-bridges'], found: ['output'], compare: ['cat1', 'cat2', 'cat3'] },
    explanation: `The ${bridgeEdges.length} bridge edges map lower and upper y-bound positions into each associated y-list. Reporting then scans only the matching slice in each list to ${outputNode.note} points.`,
  };

  const caseStudyRows = [
    { id: 'data', label: 'static labels' },
    { id: 'query', label: 'viewport' },
    { id: 'x', label: 'x tree' },
    { id: 'y', label: 'associated y' },
  ];
  const caseStudyCols = [
    { id: 'role', label: 'role' },
    { id: 'reason' },
  ];
  yield {
    state: labelMatrix(
      'Complete case study: map label windows',
      caseStudyRows,
      caseStudyCols,
      [
        ['points with priority', 'mostly static'],
        ['axis-aligned box', 'orthogonal query'],
        ['cover x interval', 'canonical subtrees'],
        ['report y interval', 'avoid full scan'],
      ],
    ),
    highlight: { active: ['query:role', 'x:reason', 'y:reason'], found: ['data:reason'] },
    explanation: `For ${caseStudyRows[0].label}, a range tree decomposes the problem into ${caseStudyRows.length} layers (${caseStudyRows.map(r => r.label).join(', ')}) to report all labels in the viewport exactly. Dynamic map engines often choose R-trees instead because updates and geometry predicates dominate.`,
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
        'Read the animation as an exact two-dimensional reporting query. Orthogonal means the query rectangle is aligned with the axes, and reporting means the structure must list the matching points, not only count them.',
        {type: 'callout', text: 'A range tree wins by decomposing one coordinate into canonical subtrees, then using stored order in the other coordinate instead of scanning candidates.'},
        {type: 'image', src: './assets/gifs/range-tree-orthogonal-range-search.gif', alt: 'Animated walkthrough of the range tree orthogonal range search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that a canonical subtree is either wholly inside the x-range or not used. Once that is true, the associated y-list can filter by y without scanning unrelated x-values.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A range tree exists for static point sets that need exact rectangle queries with predictable worst-case time. Static means the points are mostly built once and queried many times.',
        'The problem appears whenever a system asks for every object inside a viewport, time-value window, or coordinate box. Missing one point is a correctness bug, and scanning everything is too slow once n is large.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to sort points by x, binary-search the x bounds, and scan the candidates for y. That is simple, uses linear space, and works when the x-slice is small.',
        'Another reasonable approach is a k-d tree, which alternates splitting dimensions and prunes subtrees outside the rectangle. It is easy to use and often fast on friendly spatial data.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall for x-sorting is a wide x-range with a narrow y-range. A query with x in [0, 1000000] and y in [50, 51] may scan nearly all one million points to report two results.',
        'The wall for k-d trees is the worst case. In two dimensions the query bound includes a sqrt(n) term, so n=1,000,000 can still visit about 1,000 nodes before output even when k is small.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to decompose one dimension into disjoint canonical subtrees and store sorted order for the other dimension inside each one. The outer tree organizes x, and each selected subtree carries a y-catalog.',
        'This avoids partial indexing. The query never says, "I found the right x range, now I must linearly inspect y"; it says, "these whole x-subtrees qualify, so binary-search their y-lists."',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in nodes', caption: 'Range trees rely on ordered search-tree decomposition; this B-tree visual shows the same idea of routing by separator keys before searching a stored catalog. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
        'Build a balanced search tree over x-coordinates. At each node, store the points in that node subtree sorted by y, so each point appears in the y-list of every ancestor on its x-search path.',
        'To answer [x1, x2] by [y1, y2], find the split node where x1 and x2 paths diverge. Walking toward each boundary selects sibling subtrees fully inside the x-range, and each selected subtree is searched by y bounds.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from a disjoint cover. The selected canonical subtrees contain every point whose x lies in the query interval and contain no point outside it.',
        'Within each selected subtree, the associated y-list contains exactly that subtree sorted by y. Binary search returns exactly the y slice, and disjoint subtrees ensure no point is reported twice.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A two-dimensional range tree uses O(n log n) space because each point is stored in one y-list per tree level. A query visits O(log n) canonical subtrees and binary-searches each y-list, giving O(log squared n + k) time without fractional cascading.',
        'Fractional cascading stores bridge pointers between catalogs so one binary search can be reused. It changes query behavior to O(log n + k), but it makes the static catalog machinery harder to implement and update.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Range trees fit static map labels, offline spatial analytics, event windows, and computational geometry tasks where exact axis-aligned reporting matters. The point set should be stable enough that build cost and extra memory are amortized over many queries.',
        'They are also a teaching bridge to merge-sort trees and fractional cascading. Once the associated-catalog idea is clear, those structures feel like variants rather than separate tricks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/R-tree.svg/500px-R-tree.svg.png', alt: 'R-tree diagram with red object rectangles and blue parent bounding rectangles', caption: 'R-trees summarize object rectangles rather than exact point catalogs, which makes them a better fit for dynamic geometry but weaker for clean worst-case reporting. Source: Wikimedia Commons, R-tree.svg, CC BY-SA 3.0.'},
        'A range tree fails as a general spatial index. It is not built for nearest-neighbor search, moving rectangles, arbitrary polygons, or frequent insertions and deletions.',
        'The space cost can dominate. For one billion points, log2(n) is about 30, so the associated catalogs can store on the order of 30 billion point references before compression or engineering tricks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use points A=(1,4), B=(3,7), C=(6,3), and D=(9,6), with query x in [2,8] and y in [3,7]. The x decomposition selects the subtree containing B and C, while A is too far left and D is too far right.',
        'The selected y-list is [3,7]. Binary-searching y>=3 gives index 0, and y<=7 ends after index 1, so both C and B are reported. The answer is exactly two points, and no scan of A or D is needed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Bentley, Multidimensional Divide-and-Conquer, and de Berg et al., Computational Geometry: Algorithms and Applications, on orthogonal range searching. Chazelle, Filtering Search, is the classic source for fractional cascading.',
        'Study binary search trees, binary search, k-d trees, R-trees, merge-sort trees, fractional cascading, and Fenwick trees next. The contrast is exact static reporting versus dynamic or approximate spatial indexing.',
      ],
    },
  ],
};
