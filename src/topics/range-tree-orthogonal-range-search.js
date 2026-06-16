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
      heading: 'What it is',
      paragraphs: [
        'A 2D range tree is an exact data structure for orthogonal range searching: queries whose boundaries are axis-aligned rectangles. It stores points in a balanced x-ordered tree. Each node also stores an associated structure over the y-coordinates of points in that node subtree.',
        'This topic connects Binary Search Tree, k-d Tree, R-Tree Spatial Index, Priority Search Tree Range Reporting, Fractional Cascading, Merge-Sort Tree Range Counting, and 2D Fenwick Tree & Coordinate Compression. The important distinction is output: a range tree can report the actual points in a rectangle, not only count or aggregate them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The x-tree search finds where the lower and upper x bounds diverge. Along the two search paths, some side subtrees lie completely inside the x-range. Those subtrees are canonical pieces of the query. Instead of scanning all their points, the query searches each associated y-structure for the requested y interval.',
        'Without extra acceleration, a 2D range tree answers reporting queries in O(log^2 n + k), where k is the number of points reported. The first logarithm finds canonical x subtrees; the second comes from y searches inside associated structures.',
      ],
    },
    {
      heading: 'Fractional cascading',
      paragraphs: [
        'Fractional Cascading improves the repeated y searches. The lower and upper y bounds are the same across all associated y-lists, so bridge pointers can carry the search positions from one catalog to the next. With the classic static structure, query time improves to O(log n + k) while keeping O(n log n) space.',
        'The same idea explains why Merge-Sort Tree Range Counting and range trees belong together. Both decompose one dimension into canonical nodes and then search sorted catalogs for a second condition.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a static layer of map labels represented as points. A viewport request asks which labels fall inside x1..x2 and y1..y2. A k-d Tree can prune spatial regions but has weaker worst-case reporting bounds. An R-Tree Spatial Index handles rectangles and real geometry well, but query quality depends on bounding-box overlap. A 2D range tree gives a crisp exact structure for point reporting.',
        'For high-update map data, this may be the wrong engineering choice because associated structures are expensive to update. For mostly static point catalogs, batched rebuilds or immutable snapshots make the range tree much more attractive.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A range tree is not the same as a 2D Fenwick Tree & Coordinate Compression. The Fenwick structure is excellent for rectangle sums or counts with point updates, but it does not naturally list the actual points in the rectangle. A range tree is also not a general polygon index; it is designed around orthogonal boxes.',
        'The other trap is ignoring space. Every point appears in associated structures along a root-to-leaf path, so the classic 2D range tree uses O(n log n) memory. That is often fine for static computational-geometry problems and less fine for large mutable systems.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: MIT 6.851 orthogonal range searching notes at https://courses.csail.mit.edu/6.851/spring10/scribe/lec03.pdf, DTU range reporting notes at https://www2.compute.dtu.dk/courses/02282/2016/rangereporting/rangereporting1x1.pdf, and computational geometry range tree lecture notes at https://ima.udg.edu/~sellares/ComGeo/RangeTrees4Ms.pdf. Study k-d Tree, R-Tree Spatial Index, Priority Search Tree Range Reporting, Fractional Cascading, Merge-Sort Tree Range Counting, and 2D Fenwick Tree & Coordinate Compression next.',
      ],
    },
  ],
};
