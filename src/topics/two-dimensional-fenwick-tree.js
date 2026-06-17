// A 2D Fenwick tree nests the lowbit walk: each x-index owns a Fenwick tree over
// y, enabling point updates and rectangle prefix sums.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'two-dimensional-fenwick-tree',
  title: '2D Fenwick Tree & Coordinate Compression',
  category: 'Data Structures',
  summary: 'Nest Fenwick walks over x and y to update points and query rectangle sums, then compress sparse per-row y coordinates when the grid is huge.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rectangle sum', 'compressed sparse BIT'], defaultValue: 'rectangle sum' },
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

function bit2dGraph(title) {
  return graphState({
    nodes: [
      { id: 'point', label: 'point', x: 0.8, y: 3.4, note: '(x,y)+v' },
      { id: 'x1', label: 'x', x: 2.6, y: 1.8, note: 'i += lowbit' },
      { id: 'x2', label: 'x next', x: 2.6, y: 5.0, note: 'outer loop' },
      { id: 'ybit', label: 'y BIT', x: 4.8, y: 3.4, note: 'inner loop' },
      { id: 'prefix', label: 'prefix', x: 6.9, y: 3.4, note: '(1,1)..(x,y)' },
      { id: 'rect', label: 'rect', x: 8.9, y: 3.4, note: 'inclusion-excl' },
    ],
    edges: [
      { id: 'e-point-x1', from: 'point', to: 'x1' },
      { id: 'e-point-x2', from: 'point', to: 'x2' },
      { id: 'e-x1-ybit', from: 'x1', to: 'ybit' },
      { id: 'e-x2-ybit', from: 'x2', to: 'ybit' },
      { id: 'e-ybit-prefix', from: 'ybit', to: 'prefix' },
      { id: 'e-prefix-rect', from: 'prefix', to: 'rect' },
    ],
  }, { title });
}

function sparseGraph(title) {
  return graphState({
    nodes: [
      { id: 'events', label: 'events', x: 0.8, y: 3.4, note: 'offline' },
      { id: 'xwalk', label: 'x walk', x: 2.7, y: 1.8, note: 'affected rows' },
      { id: 'collect', label: 'collect y', x: 4.7, y: 1.8, note: 'per row' },
      { id: 'compress', label: 'compress', x: 4.7, y: 5.0, note: 'sort unique' },
      { id: 'small', label: 'small BITs', x: 6.8, y: 3.4, note: 'sparse rows' },
      { id: 'query', label: 'query', x: 8.8, y: 3.4, note: 'binary search y' },
    ],
    edges: [
      { id: 'e-events-xwalk', from: 'events', to: 'xwalk' },
      { id: 'e-xwalk-collect', from: 'xwalk', to: 'collect' },
      { id: 'e-collect-compress', from: 'collect', to: 'compress' },
      { id: 'e-compress-small', from: 'compress', to: 'small' },
      { id: 'e-small-query', from: 'small', to: 'query' },
      { id: 'e-xwalk-small', from: 'xwalk', to: 'small' },
    ],
  }, { title });
}

function* rectangleSum() {
  yield {
    state: bit2dGraph('A 2D BIT nests the Fenwick walk'),
    highlight: { active: ['point', 'x1', 'x2', 'ybit', 'e-point-x1', 'e-point-x2', 'e-x1-ybit'], found: ['prefix'] },
    explanation: 'A 2D Fenwick tree performs the usual lowbit walk over x. At each visited x bucket, it performs another Fenwick walk over y.',
    invariant: 'Each cell update contributes to O(log n * log m) stored rectangle summaries.',
  };

  yield {
    state: labelMatrix(
      'Nested update loops',
      [
        { id: 'outer', label: 'outer x' },
        { id: 'inner', label: 'inner y' },
        { id: 'point', label: 'update point' },
        { id: 'prefix', label: 'prefix query' },
      ],
      [
        { id: 'walk', label: 'walk' },
        { id: 'meaning' },
      ],
      [
        ['x += lowbit(x)', 'affected rows'],
        ['y += lowbit(y)', 'affected cols'],
        ['add to tree[x][y]', 'store summaries'],
        ['x -=, y -=', 'collect summaries'],
      ],
    ),
    highlight: { active: ['outer:walk', 'inner:walk'], found: ['point:meaning', 'prefix:walk'] },
    explanation: 'The loops are just the 1D Fenwick update and query loops nested inside each other. That simplicity is why 2D BITs are common in rectangle counting tasks.',
  };

  yield {
    state: labelMatrix(
      'Rectangle inclusion-exclusion',
      [
        { id: 'a', label: 'sum x2,y2' },
        { id: 'b', label: 'minus x1-1,y2' },
        { id: 'c', label: 'minus x2,y1-1' },
        { id: 'd', label: 'plus x1-1,y1-1' },
      ],
      [
        { id: 'piece', label: 'piece' },
        { id: 'why' },
      ],
      [
        ['big prefix', 'contains target'],
        ['left strip', 'remove'],
        ['bottom strip', 'remove'],
        ['corner overlap', 'add back'],
      ],
    ),
    highlight: { active: ['a:piece'], compare: ['b:why', 'c:why'], found: ['d:why'] },
    explanation: 'A 2D BIT returns prefix rectangles. Any query rectangle is four prefix queries combined by inclusion-exclusion.',
  };

  yield {
    state: bit2dGraph('Rectangle sum is four prefix queries'),
    highlight: { active: ['prefix', 'rect', 'e-prefix-rect'], compare: ['ybit'], found: ['point'] },
    explanation: 'Point update and rectangle sum both cost O(log n * log m). For dense moderate grids, the implementation is compact and predictable.',
  };
}

function* compressedSparseBit() {
  yield {
    state: sparseGraph('Sparse 2D BITs compress y coordinates per x bucket'),
    highlight: { active: ['events', 'xwalk', 'collect', 'e-events-xwalk', 'e-xwalk-collect'], found: ['compress', 'small'] },
    explanation: 'A full n by m 2D array is impossible when coordinates are large and sparse. Offline compression collects only y coordinates that will ever appear in each x bucket.',
    invariant: 'Compression preserves coordinate order for prefix queries.',
  };

  yield {
    state: labelMatrix(
      'Offline compression plan',
      [
        { id: 'updates', label: 'updates' },
        { id: 'xwalk', label: 'x buckets' },
        { id: 'ys', label: 'y lists' },
        { id: 'build', label: 'build BITs' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'result' },
      ],
      [
        ['read all points', 'known ahead'],
        ['simulate x += lowbit', 'rows touched'],
        ['append y per row', 'sort unique'],
        ['small arrays', 'less memory'],
      ],
    ),
    highlight: { active: ['xwalk:work', 'ys:work'], found: ['build:result'], compare: ['updates:result'] },
    explanation: 'The compressed structure is still a Fenwick tree of Fenwick trees. The difference is that each inner tree stores only the y positions it can actually need.',
  };

  yield {
    state: sparseGraph('Queries binary-search compressed y lists'),
    highlight: { active: ['small', 'query', 'e-small-query'], compare: ['compress'], found: ['events'] },
    explanation: 'During query or update, the outer x walk is unchanged. Inside each x bucket, binary search maps the requested y to an index in that bucket\'s compressed Fenwick array.',
  };

  yield {
    state: labelMatrix(
      'When to choose it',
      [
        { id: 'dense', label: 'dense grid' },
        { id: 'sparse', label: 'sparse points' },
        { id: 'online', label: 'unknown online' },
        { id: 'range', label: 'rect counts' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason' },
      ],
      [
        ['plain 2D BIT', 'simple arrays'],
        ['compressed 2D BIT', 'memory saved'],
        ['harder', 'need dynamic maps'],
        ['strong', 'prefix algebra'],
      ],
    ),
    highlight: { active: ['sparse:fit', 'sparse:reason'], compare: ['online:reason'], found: ['range:fit'] },
    explanation: 'Compressed 2D BITs are strongest when updates are known offline and the coordinate space is huge but touched points are few.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rectangle sum') yield* rectangleSum();
  else if (view === 'compressed sparse BIT') yield* compressedSparseBit();
  else throw new InputError('Pick a 2D Fenwick view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A one-dimensional Fenwick tree is built for a simple bargain: point updates and prefix sums on an ordered line, both in logarithmic time. Many real counting problems are still prefix-sum problems, but the order has two coordinates instead of one.',
        'Examples show up everywhere: count events by time and severity, points by x and y coordinate, orders by price and timestamp, or players by rating and rank. The query is often rectangular: how much mass lies between x1 and x2 and between y1 and y2?',
        'A 2D Fenwick tree exists for dynamic rectangular aggregates. It keeps the prefix-sum idea, but the prefix is now a rectangle from the origin to (x, y). Rectangle queries then come from inclusion-exclusion over four such prefixes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For a fixed grid, a 2D prefix-sum table is beautiful. Build it once, and any rectangle sum is O(1). The problem is updates. Changing one cell affects every prefix table entry southeast of that cell, so a single update can cost O(nm).',
        'For a dynamic grid, the simplest alternative is to scan the requested rectangle and add the cells. That handles updates easily, but a large rectangle is expensive. If the grid is 10000 by 10000, a single query can touch millions of cells.',
        'A map from coordinate pair to value helps memory for sparse points, but it does not solve range queries. Hash maps destroy order. Prefix sums need rank order: all x values up to X and all y values up to Y.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is update/query tension. Static prefix tables make queries cheap and updates expensive. Scanning makes updates cheap and queries expensive. A 2D Fenwick tree splits the difference by updating and querying only logarithmically many rectangular summaries.',
        'The second wall is memory. A dense 2D Fenwick tree uses O(nm) storage. That is fine for a board game and impossible when coordinates are timestamps, IDs, map tiles, or values up to billions.',
        'The third wall is compression. You can compress coordinates only if you preserve sorted order. Replacing y coordinates with arbitrary hash buckets breaks the meaning of "all points with y <= Y." A compressed Fenwick tree must still behave like an ordered prefix structure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Nest the Fenwick invariant. The outer Fenwick walk partitions the x axis into power-of-two-aligned ranges. Inside each visited x bucket, an inner Fenwick tree partitions the y axis. A point update adds its value to every stored rectangle summary that contains that point.',
        'A prefix query prefix(x, y) walks downward through the x buckets that partition [1..x]. For each such x bucket, it walks downward through the y buckets that partition [1..y]. The sum of those disjoint stored rectangles is the desired prefix rectangle.',
        'A general rectangle is just four prefixes: sum(x1..x2, y1..y2) = prefix(x2,y2) - prefix(x1-1,y2) - prefix(x2,y1-1) + prefix(x1-1,y1-1).',
      ],
    },
    {
      heading: 'Reading the rectangle-sum view',
      paragraphs: [
        'In the rectangle-sum view, do not read highlighted cells as individual data points. Read them as summaries. Each highlighted Fenwick bucket owns a small axis-aligned rectangle whose size is determined by lowbit on x and lowbit on y.',
        'During an update, the walk moves upward in x and upward in y because every larger bucket that contains the point must be repaired. During a prefix query, the walk moves downward because it is decomposing the requested rectangle into stored disjoint buckets.',
        'For a non-origin rectangle, watch the four prefix calls. The large prefix includes too much area. The two subtractions remove the left and bottom strips. The final addition restores the lower-left corner that was subtracted twice.',
      ],
    },
    {
      heading: 'Reading the compressed sparse BIT view',
      paragraphs: [
        'In the compressed view, the outer x buckets still exist, but each x bucket stores only the y coordinates that can ever be updated inside that bucket. That is why compressed 2D BITs are usually built from an offline list of updates.',
        'For each planned update (x, y), simulate the outer update walk xi = x; xi <= n; xi += lowbit(xi). Append y to the coordinate list for every visited xi. After all planned updates are known, sort and deduplicate each list, then allocate a small inner Fenwick tree for that bucket.',
        'At runtime, an update uses binary search inside each bucket to find the compressed y index. A query uses upper_bound to include all stored y coordinates <= y. The structure is sparse, but every local list remains sorted, so prefix semantics are preserved.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a dense tree, update(x, y, delta) runs two Fenwick loops. The outer loop visits xi = x, x + lowbit(x), and so on. The inner loop visits yi = y, y + lowbit(y), and so on. Each tree[xi][yi] receives delta because its covered rectangle contains (x, y).',
        'prefix(x, y) reverses both loops. It visits xi = x, x - lowbit(x), and so on. For each xi, it visits yi = y, y - lowbit(y), and so on. These buckets tile the prefix rectangle without overlap.',
        'For compressed trees, the same loop structure stays in place. Only the physical y index changes from a dense coordinate to a rank inside that x bucket. The algorithm is still a Fenwick tree inside a Fenwick tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The 1D Fenwick invariant says every prefix can be decomposed into O(log n) stored ranges. In two dimensions, apply that invariant twice. The x walk decomposes [1..x] into x ranges. Each inner y walk decomposes [1..y] into y ranges. Their Cartesian products form the stored rectangles.',
        'Inclusion-exclusion works because rectangle sums are additive. prefix(x2,y2) includes the target rectangle plus two unwanted strips and the lower-left outside corner. Subtracting the strips removes the extra area, but the corner is removed twice, so it must be added back once.',
        'Compression works only because sorted rank preserves prefix order. The compressed index of y is not its value; it is the number of known y coordinates in that bucket that are <= y. That is exactly what a prefix query needs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose updates add 5 at (2, 3), add 7 at (4, 1), and add 2 at (5, 4). Query the rectangle x = 2..4 and y = 1..3. The answer should include the first two updates and exclude the third, so the result is 12.',
        'The 2D BIT computes that as prefix(4,3) - prefix(1,3) - prefix(4,0) + prefix(1,0). The last two terms are zero in this example. prefix(4,3) includes both (2,3) and (4,1), while prefix(1,3) removes anything with x <= 1. The answer is 12.',
        'Now imagine the real coordinates are timestamps and prices: (1700000002, 30500), (1700000100, 30100), and (1700000200, 40400). A dense grid is impossible. Offline compression keeps only the y values that updates can contribute to each visited x bucket, while range queries still use sorted rank and inclusion-exclusion.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'A dense 2D Fenwick tree uses O(nm) memory. Each point update and prefix query costs O(log n * log m). A rectangle query uses four prefix queries, so it is still O(log n * log m) with a larger constant.',
        'A compressed sparse 2D BIT usually uses O(K log n) stored y entries for K planned update points, before deduplication. It adds preprocessing, binary searches inside buckets, and more complicated code, but it can turn an impossible dense grid into a practical structure.',
        'The main tradeoff is online flexibility. If a new update arrives at a y coordinate that was not included in a bucket during preprocessing, that bucket has no slot for it. You then need dynamic inner trees, maps of Fenwick nodes, rebuilding, or a different data structure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for dynamic rectangle sums, offline rectangle counting, dominance queries, inversion-like counting in two dimensions, sparse point sets on huge coordinate ranges, and sweep-line pipelines where one dimension is time or event order.',
        'It is especially strong when the aggregate is additive: count, sum, frequency, weight, or any group-like value where subtraction makes inclusion-exclusion possible.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It does not answer nearest-neighbor, overlap candidate generation, or geometric collision queries. It aggregates rectangles; it does not discover nearby objects. Spatial hash grids, R-trees, quadtrees, k-d trees, and BVHs solve different geometric problems.',
        'It also struggles with non-additive aggregates. Rectangle maximum with point updates needs a different structure because inclusion-exclusion does not work for max. Range assignment or rectangle updates require extensions or a 2D segment tree/lazy structure.',
        'Finally, it can be the wrong engineering choice when dimensions are small enough for a prefix table, or when query volume is low enough that a sorted list plus batching is simpler.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study the 1D Fenwick Tree first, then coordinate compression, prefix sums, Segment Tree, Range Tree, and sweep-line algorithms. The useful mental model is simple: every point update repairs all stored rectangles that contain the point; every prefix query decomposes its rectangle into stored rectangles.',
      ],
    },
  ],
};
