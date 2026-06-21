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
  const nodeCount = 6;
  const edgeCount = 6;
  const prefixQueriesPerRect = 4;
  const inclusionExclusionPieces = 4;
  const complexity = 'O(log n * log m)';

  yield {
    state: bit2dGraph('A 2D BIT nests the Fenwick walk'),
    highlight: { active: ['point', 'x1', 'x2', 'ybit', 'e-point-x1', 'e-point-x2', 'e-x1-ybit'], found: ['prefix'] },
    explanation: `A 2D Fenwick tree with ${nodeCount} nodes performs the usual lowbit walk over x. At each visited x bucket, it performs another Fenwick walk over y, connected by ${edgeCount} edges.`,
    invariant: `Each cell update contributes to ${complexity} stored rectangle summaries across ${nodeCount} pipeline stages.`,
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
    explanation: `The loops are just the 1D Fenwick update and query loops nested inside each other. Each costs ${complexity}, and that simplicity is why 2D BITs are common in rectangle counting tasks.`,
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
    explanation: `A 2D BIT returns prefix rectangles. Any query rectangle is ${prefixQueriesPerRect} prefix queries combined by inclusion-exclusion over ${inclusionExclusionPieces} pieces.`,
  };

  yield {
    state: bit2dGraph('Rectangle sum is four prefix queries'),
    highlight: { active: ['prefix', 'rect', 'e-prefix-rect'], compare: ['ybit'], found: ['point'] },
    explanation: `Point update and rectangle sum both cost ${complexity}. Each rectangle query invokes ${prefixQueriesPerRect} prefix queries, and for dense moderate grids the implementation is compact and predictable.`,
  };
}

function* compressedSparseBit() {
  const sparseNodeCount = 6;
  const sparseEdgeCount = 6;
  const offlineSteps = 4;
  const memoryCost = 'O(K log n)';
  const operationCost = 'O(log n * log K)';

  yield {
    state: sparseGraph('Sparse 2D BITs compress y coordinates per x bucket'),
    highlight: { active: ['events', 'xwalk', 'collect', 'e-events-xwalk', 'e-xwalk-collect'], found: ['compress', 'small'] },
    explanation: `A full n by m 2D array is impossible when coordinates are large and sparse. The ${sparseNodeCount}-node compression pipeline collects only y coordinates that will ever appear in each x bucket.`,
    invariant: `Compression preserves coordinate order for prefix queries, reducing memory to ${memoryCost} across ${sparseNodeCount} processing stages.`,
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
    explanation: `The ${offlineSteps}-step offline plan builds a compressed Fenwick tree of Fenwick trees. Each inner tree stores only the y positions it can actually need, cutting memory to ${memoryCost}.`,
  };

  yield {
    state: sparseGraph('Queries binary-search compressed y lists'),
    highlight: { active: ['small', 'query', 'e-small-query'], compare: ['compress'], found: ['events'] },
    explanation: `During query or update, the outer x walk is unchanged. Inside each x bucket, binary search maps the requested y to a compressed index, keeping each operation at ${operationCost}.`,
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
    explanation: `Compressed 2D BITs are strongest when updates are known offline and the coordinate space is huge but touched points are few — the ${sparseEdgeCount}-edge pipeline keeps total memory at ${memoryCost}.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The rectangle-sum view shows how the nested Fenwick walk updates and queries a dense 2D grid. The compressed sparse BIT view shows how offline coordinate compression shrinks a huge grid into per-bucket arrays. Switch between them using the dropdown.',
        {type: 'callout', text: 'A 2D Fenwick tree is a prefix-sum table made dynamic: update only the rectangles that contain the changed point, then rebuild any query from disjoint stored rectangles.'},
        'Active (highlighted) nodes are the current step in the walk. Found nodes are stored summaries the algorithm has accumulated. Compare nodes mark the inclusion-exclusion pieces being subtracted or added back.',
        'Watch the direction of the walk. During an update, both x and y move upward (adding lowbit) because every larger bucket that contains the point must be repaired. During a prefix query, both move downward (subtracting lowbit) because the query decomposes its rectangle into stored, disjoint buckets.',
      
        {type: 'image', src: './assets/gifs/two-dimensional-fenwick-tree.gif', alt: 'Animated walkthrough of the two dimensional fenwick tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A 1D Fenwick tree (Fenwick, 1994) gives O(log n) point updates and prefix sums on a line. Many counting problems live on a line: cumulative frequency, running totals, inversion counts. But real data often has two ordered axes. Count events by time and severity. Count points inside a bounding box. Sum order revenue between two price ranges and two date ranges.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/70/16-node_Fenwick_tree.svg', alt: 'Sixteen-node Fenwick tree showing stored prefix ranges', caption: 'The 2D structure nests this same lowbit decomposition: one Fenwick walk chooses x buckets, and each bucket owns a second Fenwick walk over y. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:16-node_Fenwick_tree.svg.'},
        'The query shape is a rectangle: how much total value lies between x1..x2 and y1..y2? A 1D Fenwick tree cannot answer this because it only partitions one axis. You need a structure that partitions both axes and still supports fast point updates.',
        'A 2D Fenwick tree extends the 1D idea by nesting one Fenwick walk inside another. The prefix becomes a rectangle from the origin to (x, y), and any arbitrary rectangle query reduces to four prefix queries via inclusion-exclusion.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For a fixed grid, build a 2D prefix-sum table. Precompute every prefix rectangle in O(nm), then answer any rectangle query in O(1) using the standard four-corner formula. This is clean, fast, and well-known.',
        'The problem is updates. Changing one cell invalidates every prefix-sum entry whose rectangle contains that cell. Recomputing the table costs O(nm). If updates are frequent, the prefix table is too expensive to maintain.',
        'The brute-force alternative is scanning. Loop over every cell in the queried rectangle and add them up. Updates are O(1), but a single query on a 10,000 x 10,000 grid can touch 100 million cells. Neither extreme -- cheap queries with expensive updates, or cheap updates with expensive queries -- works when both operations are common.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Static prefix tables and brute-force scanning sit at opposite ends of the update/query tradeoff. There is no middle ground without a smarter decomposition. The wall is that a single update must propagate to enough stored summaries to cover future queries, but not to all of them.',
        'A second wall appears with scale. A dense n x m array is fine for small grids but impossible when coordinates are timestamps (up to 10^9), user IDs, or GPS positions. The grid cannot be materialized.',
        'A third wall is order. Hash maps can store sparse points, but they destroy sorted order. Prefix sums require rank order -- "all y values up to Y" -- and hashing makes that meaningless. Any compression scheme must preserve sorted rank or the prefix algebra breaks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Nest the 1D Fenwick structure. The outer dimension walks the x axis using lowbit (the lowest set bit of the index). At each visited x bucket, an independent inner Fenwick tree walks the y axis the same way. Each (x-bucket, y-bucket) pair stores a partial rectangle sum.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Point update: add delta at (x, y)\nfunction update(tree, x, y, delta, N, M) {\n  for (let i = x; i <= N; i += i & (-i))\n    for (let j = y; j <= M; j += j & (-j))\n      tree[i][j] += delta;\n}\n\n// Prefix query: sum of rectangle (1,1)..(x,y)\nfunction query(tree, x, y) {\n  let sum = 0;\n  for (let i = x; i > 0; i -= i & (-i))\n    for (let j = y; j > 0; j -= j & (-j))\n      sum += tree[i][j];\n  return sum;\n}\n\n// Rectangle query via inclusion-exclusion\nfunction rectQuery(tree, x1, y1, x2, y2) {\n  return query(tree, x2, y2)\n       - query(tree, x1 - 1, y2)\n       - query(tree, x2, y1 - 1)\n       + query(tree, x1 - 1, y1 - 1);\n}',
        },
        'The update walks upward in both dimensions: i += i & (-i) advances to the next x bucket that must include this point, and the inner loop does the same for y. The query walks downward in both: i -= i & (-i) strips the lowest set bit, collecting stored partial sums.',
        'For a rectangle query (x1, y1) to (x2, y2), compute four prefix queries and combine them. prefix(x2, y2) covers the entire upper-left region including the target rectangle. Subtracting prefix(x1-1, y2) removes the strip left of the target. Subtracting prefix(x2, y1-1) removes the strip below. Adding back prefix(x1-1, y1-1) corrects the lower-left corner that was subtracted twice.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The 1D Fenwick invariant guarantees that any prefix [1..x] decomposes into O(log n) non-overlapping stored ranges. In 2D, apply this twice. The x walk splits [1..x] into O(log n) x-ranges. For each x-range, the y walk splits [1..y] into O(log m) y-ranges. The Cartesian products of these ranges form O(log n * log m) disjoint rectangles that tile the prefix rectangle exactly.',
        'Inclusion-exclusion works because sums are additive. The four-corner formula is the same identity used for 2D prefix-sum tables, just applied to the prefix function of the Fenwick tree instead of a flat array.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Integral_image_application_example.svg', alt: 'Summed-area table example using four colored corner values to compute a rectangle sum', caption: 'The four-corner rectangle identity is the same algebra the 2D Fenwick tree uses; Fenwick changes how prefix values are maintained under updates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Integral_image_application_example.svg.'},
        {
          type: 'diagram',
          label: '2D responsible cells for point (3, 5) in an 8x8 grid',
          text: 'y  8 |  .  .  .  .  .  .  .  .\n   7 |  .  .  .  .  .  .  .  .\n   6 |  .  .  [4,6] .  .  .  [8,6]\n   5 |  .  .  [4,5] .  .  .  [8,5]\n   4 |  .  .  [4,4] .  .  .  [8,4]\n   3 |  .  .  .  .  .  .  .  .\n   2 |  .  .  .  .  .  .  .  .\n   1 |  .  .  .  .  .  .  .  .\n      1  2  3  4  5  6  7  8  -> x\n\n   x walk from 3: 3 -> 4 (3+1) -> 8 (4+4)\n   y walk from 5: 5 -> 6 (5+1) -> 8 (6+2) [shown: 4-6 range]\n   Each [xi,yi] cell stores a partial sum updated by (3,5)',
        },
        'Coordinate compression preserves correctness because it maintains sorted rank. If a bucket stores y values {2, 7, 15}, the compressed indices are {1, 2, 3}. A prefix query for y <= 10 maps via binary search to compressed index 2, which includes exactly the original values <= 10. Order is preserved, so prefix semantics are preserved.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            '2D prefix sum: O(nm) build, O(1) rectangle query, O(nm) rebuild after one point update, O(nm) memory.',
            '2D Fenwick tree: O(nm log n log m) naive build, O(log n * log m) point update, O(log n * log m) rectangle query, O(nm) memory.',
            '2D segment tree: O(nm) build, O(log n * log m) point update and rectangle query, higher memory and implementation cost.',
            'Compressed 2D BIT: O(K log^2 n) offline build, O(log n * log K) operations, O(K log n) memory when K update points are sparse.',
          ],
        },
        'For an n x m dense grid, each point update and prefix query touches O(log n * log m) cells. A rectangle query calls prefix four times, so the constant is 4x but the asymptotic cost is the same. On a 1024 x 1024 grid, each operation touches at most 10 * 10 = 100 stored cells.',
        'Doubling one dimension adds one step to that dimension\'s walk. Doubling both dimensions adds one step to each, so operations go from roughly log^2(n) to (log(n)+1)^2 -- a small increase. The structure scales gracefully on moderate grids.',
        {
          type: 'note',
          text: 'The compressed variant trades O(nm) memory for O(K log n) where K is the number of update points. The cost is an offline preprocessing pass and a binary search per inner-tree access. This is worth it only when K is much smaller than nm.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Competitive programming problems that ask "count points in a rectangle" or "sum values in a sub-grid" with interleaved updates are the textbook use case. Problems like counting inversions in 2D, dominance queries (how many points have both x <= X and y <= Y), and sweep-line rectangle counting all reduce to 2D BIT operations.',
        'Offline analytics on sparse, high-cardinality dimensions benefit from the compressed variant. Imagine counting orders by (timestamp, price) where both axes span billions but only thousands of orders exist. A compressed 2D BIT uses memory proportional to the number of orders, not the coordinate range.',
        {
          type: 'bullets',
          items: [
            'Dynamic rectangle sums on moderate grids (up to ~4000 x 4000 in competitive programming)',
            'Offline 2D counting and frequency queries with coordinate compression',
            '2D inversion counting and dominance pair counting',
            'Sweep-line problems where one axis is event order and the other is a value range',
            'Additive aggregates: count, sum, frequency, weight -- anything where subtraction enables inclusion-exclusion',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It cannot answer non-additive queries. Rectangle maximum, rectangle minimum, and rectangle median do not support inclusion-exclusion. If you subtract prefix(x1-1, y2) from prefix(x2, y2), the max of the difference is not the max of the target rectangle. These queries need a 2D segment tree with merge-sort trees or persistent structures.',
        'It does not handle rectangle updates (adding delta to every cell in a sub-grid). The 1D BIT supports range updates via difference arrays, but the 2D extension is tricky and rarely cleaner than a 2D segment tree with lazy propagation.',
        'It is not a spatial index. Nearest-neighbor queries, range searches returning individual points, collision detection, and overlap queries belong to k-d trees, R-trees, quadtrees, or spatial hash grids. A 2D BIT aggregates; it does not enumerate.',
        'For purely static data with no updates, a 2D prefix-sum table is simpler, faster (O(1) per query), and uses the same memory. The Fenwick tree only earns its complexity when updates actually happen.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'A new method of updating cumulative frequency tables is presented that is based on a tree structure imposed on the sequence of cumulative frequencies.',
          attribution: 'Peter Fenwick, "A New Data Structure for Cumulative Frequency Tables," Software: Practice and Experience, 1994',
        },
        'The 2D extension appears in competitive programming literature and Topcoder/Codeforces editorials rather than a single foundational paper. The construction is a direct nesting of Fenwick\'s original 1D idea.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: 1D Fenwick Tree (BIT) -- understand lowbit, prefix decomposition, and the update/query duality before adding a second dimension',
            'Prerequisite: 2D prefix sums -- the static baseline that the Fenwick tree makes dynamic',
            'Extension: coordinate compression -- required for the sparse variant; study independently for sweep-line and offline problems',
            'Extension: 2D segment tree -- handles non-additive aggregates and lazy propagation at higher implementation cost',
            'Alternative: merge-sort tree -- answers rectangle rank/select queries that BITs cannot',
            'Practice: Codeforces 869E, SPOJ MATSUM, USACO Platinum rectangle-counting problems',
          ],
        },
      ],
    },
  ],
};
