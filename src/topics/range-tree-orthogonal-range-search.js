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
      heading: 'Why This Exists',
      paragraphs: [
        `A 2D range tree exists for exact orthogonal range reporting: given a set of points, return every point inside an axis-aligned query rectangle. This is the clean computational-geometry version of viewport queries, static map layers, database point indexes, and offline spatial analytics.`,
        `The important distinction is that the structure reports points, not just counts them. A 2D Fenwick tree can maintain rectangle sums. A range tree can list B, C, and D inside the rectangle, which is a different promise and a different cost model.`,
        `The topic matters because many indexing problems are not nearest-neighbor problems. A user may ask for every store in this bounding box, every alert in a time-value window, or every point feature in the current map tile. Missing a point is a correctness bug, and reporting extra points shifts work to a later filter.`,
      ],
    },
    {
      heading: 'Naive Baseline and Wall',
      paragraphs: [
        `The baseline is to scan every point and test x1 <= x <= x2 and y1 <= y <= y2. That is simple and optimal when there are only a few points or only one query, but it costs O(n) per query even if the rectangle contains one point.`,
        `A single sorted array or balanced tree on x narrows the x interval, but it still may leave many candidates whose y values must be checked one by one. The wall is needing both dimensions at once with predictable output-sensitive reporting time.`,
        `Sorting independently by x and y is not enough either. The intersection of an x-sorted slice and a y-sorted slice can be expensive to compute unless the index stores structure that connects the two orders. A range tree pays extra space so that an x-range can immediately expose y-sorted catalogs for the same points.`,
      ],
    },
    {
      heading: 'Core Insight and Invariant',
      paragraphs: [
        `Layer the dimensions. The outer balanced tree is ordered by x. Every node also stores an associated y-sorted catalog for all points in that node's subtree. A query decomposes the x interval into O(log n) canonical subtrees, then searches the y-catalogs attached to those subtrees.`,
        `The invariant is that the canonical x-subtrees are disjoint and exactly cover the queried x-range. Since each associated y-structure contains exactly the points from its x-subtree, filtering those catalogs by y reports exactly the rectangle contents.`,
        `This is a decomposition trick, not a geometric guessing trick. Once a subtree is wholly inside the x interval, the query no longer needs to reason about individual x coordinates in that subtree. It switches dimensions and uses y order to remove the remaining nonmatches.`,
      ],
    },
    {
      heading: 'Animation Meaning',
      paragraphs: [
        `In the 2D reporting view, the root is the split node where the lower and upper x searches diverge. The left and right search paths identify side subtrees that are fully inside the x-range. The y-list node is the second dimension: once a subtree is canonical, the query should stop walking x and use sorted y order.`,
        `In the fractional cascading view, the repeated Y1, Y2, and Y3 catalogs are the cost source. The same y lower and upper bounds are being searched in many related lists. Bridge ranks let one binary search feed the rest, which is why the animation routes through the bridges node before reporting points.`,
        `The highlighted points are not the whole algorithm. They are the output after two filters: first the exact x cover, then the y slice inside each covered subtree. That order explains why range trees have more space overhead than a single search tree.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `Build a balanced binary search tree over x-coordinates. At each node, store all points in that subtree in a secondary structure ordered by y. In the static textbook version, this secondary structure can be an array plus binary searches for the y lower and upper bounds.`,
        `To query [x1, x2] by [y1, y2], find the split node in the x-tree. Walk toward x1 on the left side; whenever the search goes left, the right sibling subtree is fully inside the x-range and becomes canonical. Walk toward x2 on the right side symmetrically. Search each canonical subtree's y-list and emit the slice whose y values are in range.`,
        `Duplicates need a deterministic tie rule. A point can be ordered by (x, y, id) in the outer tree and by (y, x, id) in associated catalogs. The id prevents equal coordinates from collapsing into one entry when the task is reporting, not set membership.`,
        `The associated structure can store point ids rather than full point records. That keeps catalogs compact and lets the caller fetch payloads from a separate array or table after the geometric query has found the ids.`,
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        `The x decomposition is correct because a balanced search path partitions the interval into canonical subtrees: no chosen subtree contains an x value outside the query, and every point whose x lies inside the query appears in exactly one chosen subtree.`,
        `The y step is correct because the associated structure for a canonical subtree contains all and only points from that subtree. Binary searching for y1 and y2 finds exactly the y-range slice. Taking the union of all slices reports each rectangle point once and excludes points outside either coordinate bound.`,
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        `A plain static 2D range tree uses O(n log n) space because each point is stored in the associated y-structures along one root-to-leaf path. Build time is usually O(n log n). Reporting queries cost O(log^2 n + k), where k is the number of reported points.`,
        `Fractional cascading reduces the repeated y-search cost. Because the same y bounds are searched across related catalogs, bridge pointers carry rank positions from one catalog to the next. The classic result is O(log n + k) query time with O(n log n) space, at the price of more complicated catalogs and static-friendly construction.`,
        `The +k term cannot be removed for reporting because the algorithm must actually output k points. A query rectangle covering the whole dataset costs at least O(n) no matter how good the index is. The index improves the search overhead before output, not the cost of writing the answers.`,
        `Cache behavior can be mixed. Binary searches over many catalogs may jump through memory, while reporting slices can be sequential inside each y-list. A production implementation often cares about compact arrays, id compression, and batching payload fetches after the geometric stage.`,
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        `Use coordinate compression when points come from large numeric domains but only relative order matters. The range tree needs comparisons and catalog ranks; it does not need raw longitude, timestamp, or score values in every internal record.`,
        `Separate static and dynamic requirements early. If updates are rare, rebuilding a static range tree snapshot can be simpler and faster than maintaining fully dynamic associated catalogs. If updates are frequent, a different structure may be easier to keep correct.`,
        `Test with adversarial rectangles: empty ranges, single-point ranges, full-domain ranges, duplicate coordinates, boundary-inclusive points, and rectangles whose x cover contains many points but whose y filter returns almost none. Those cases expose off-by-one errors in catalog slicing.`,
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `For the animation's points A=(1,4), B=(3,7), C=(6,3), and D=(9,6), query x[2,8] and y[3,7]. The x-tree split is around x=5. The canonical x pieces cover points with x values from 2 through 8, so B and C are candidates while A is too far left and D is too far right.`,
        `Inside those canonical pieces, the associated y-lists filter by y[3,7]. B has y=7 and C has y=3, so both are reported. If a canonical subtree also contained a point with y=9, it would stay inside the x cover but be excluded by the y-list slice.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Range trees win when the data is mostly static, the query rectangles are axis-aligned, and exact reporting bounds matter. Static map-label layers, offline analytics, computational geometry exercises, spatial joins over point data, and immutable search snapshots are natural fits.`,
        `They also make several neighboring structures easier to understand. A merge-sort tree is the one-dimensional array analogue with sorted catalogs. Fractional cascading explains how to avoid repeated searches across catalogs. A priority search tree handles a different three-sided range-reporting shape.`,
        `They are especially helpful when worst-case guarantees matter more than heuristic pruning. R-trees can be excellent for real geometry workloads, but their overlap and packing quality affect query cost. A range tree gives the clean static guarantee for axis-aligned point reporting.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `A range tree is not a general spatial index. It does not handle arbitrary polygons, nearest-neighbor search, broad-phase collision detection, or rectangle objects as naturally as R-trees, BVHs, spatial hashes, or k-d trees.`,
        `The classic structure is also awkward for heavy updates. Insertions and deletions touch associated structures on a search path, and keeping all those y-catalogs balanced or rebuilt can dominate the problem. For mutable aggregate queries, a 2D Fenwick tree or segment tree variant may be a better engineering fit.`,
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        `Sources: MIT 6.851 orthogonal range searching notes at https://courses.csail.mit.edu/6.851/spring10/scribe/lec03.pdf, DTU range reporting notes at https://www2.compute.dtu.dk/courses/02282/2016/rangereporting/rangereporting1x1.pdf, and computational geometry range tree lecture notes at https://ima.udg.edu/~sellares/ComGeo/RangeTrees4Ms.pdf.`,
        `Study Binary Search Tree first for the outer tree, then k-d Tree and R-Tree Spatial Index for alternative spatial search philosophies, Priority Search Tree Range Reporting for another orthogonal structure, Fractional Cascading for catalog links, Merge-Sort Tree Range Counting for the array analogue, and 2D Fenwick Tree & Coordinate Compression for mutable aggregate queries.`,
      ],
    },
  ],
};
