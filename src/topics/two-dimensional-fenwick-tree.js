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
      heading: 'What it is',
      paragraphs: [
        'A 2D Fenwick tree is a Fenwick tree nested inside another Fenwick tree. The outer structure walks x indices by lowbit. Each outer cell contains an inner Fenwick tree over y. This supports point updates and rectangle prefix sums in O(log n * log m).',
        'This topic builds on Fenwick Tree, Fenwick Range Update & Range Query, Binary Search, and Hash Table. The one-dimensional idea remains the same: store prefix-aligned summaries. The two-dimensional version adds inclusion-exclusion to turn four prefix rectangles into any query rectangle.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To update point (x, y) by v, loop for xi = x; xi <= n; xi += lowbit(xi). Inside that loop, update yi = y; yi <= m; yi += lowbit(yi). Each visited tree[xi][yi] stores a rectangle summary that includes the point. To query prefix (1,1)..(x,y), walk xi downward and yi downward, summing stored rectangles.',
        'A rectangle [x1, x2] by [y1, y2] is prefix(x2, y2) - prefix(x1 - 1, y2) - prefix(x2, y1 - 1) + prefix(x1 - 1, y1 - 1). That is the same inclusion-exclusion used in 2D prefix-sum arrays, except every prefix is dynamic and costs logarithmic time.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A dense 2D BIT uses O(nm) memory, which is acceptable for modest grids and impossible for large coordinate ranges. Each point update and prefix query costs O(log n * log m). A rectangle query uses four prefix queries. The loops are compact, but indexing mistakes multiply because both dimensions usually use 1-based Fenwick coordinates.',
        'For sparse offline workloads, coordinate compression changes the memory story. Simulate which x buckets each update can touch, collect y values for those buckets, sort and deduplicate each list, and allocate one small inner BIT per x bucket. Updates and queries then binary-search the compressed y list inside each visited x bucket.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider offline rectangle counting over a huge map: add points at coordinates up to 1e9 and answer how many active points lie in query rectangles. A dense grid is impossible. A compressed 2D BIT stores only the y coordinates relevant to the x buckets touched by known updates. Each rectangle count becomes four compressed prefix queries.',
        'This technique also appears in sweep-line geometry. Sort events by x, update a 1D Fenwick tree over compressed y coordinates for active objects, and answer horizontal or rectangular queries with prefix differences. The full 2D BIT is the direct dynamic version when both dimensions participate symmetrically.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A 2D Fenwick tree is not a spatial index for nearest-neighbor search. It answers prefix-additive rectangle aggregates. For geometry candidates, study Spatial Hash Grid, R-Tree, Quadtree, or BVH. The second trap is treating coordinate compression as value hashing. Compression must preserve sorted order, because prefix queries depend on rank order.',
        'Compressed 2D BITs are easiest when updates are known ahead of time. If truly new y coordinates can arrive online for an existing x bucket, the precomputed inner arrays may be missing slots. Then you need maps, balanced trees, dynamic segment trees, or a different design.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CP-Algorithms Fenwick tree and multidimensional notes at https://cp-algorithms.com/data_structures/fenwick.html, USACO Guide 2D range queries at https://usaco.guide/plat/2DRQ, Topcoder Binary Indexed Trees tutorial at https://www.topcoder.com/community/competitive-programming/tutorials/binary-indexed-trees/, and USACO coordinate compression note at https://usaco.guide/gold/PURS. Study Fenwick Tree, Fenwick Range Update & Range Query, Spatial Hash Grid Broad Phase, Segment Tree, and Square-Root Decomposition next.',
      ],
    },
  ],
};
