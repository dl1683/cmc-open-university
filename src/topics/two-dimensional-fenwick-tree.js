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
        'The animation shows a grid whose cells store numbers and a second structure that stores rectangle summaries. Active cells are the Fenwick buckets currently being updated or read, and found cells are summaries that contribute to the answer.',
        {
          type: 'callout',
          text: 'A 2D Fenwick tree is a prefix-sum table made dynamic: update only the rectangles that contain the changed point, then rebuild any query from disjoint stored rectangles.',
        },
        'During an update, the walk moves upward in x and upward in y because every larger bucket that contains the changed point must be repaired. During a query, the walk moves downward because the prefix rectangle is being decomposed into stored, non-overlapping rectangles.',
        {
          type: 'image',
          src: './assets/gifs/two-dimensional-fenwick-tree.gif',
          alt: 'Animated walkthrough of the two dimensional fenwick tree visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Fenwick tree, also called a binary indexed tree, stores prefix sums while allowing point updates. A prefix sum is the total from the beginning of an ordered range up to a chosen position.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/70/16-node_Fenwick_tree.svg',
          alt: 'Sixteen-node Fenwick tree showing stored prefix ranges',
          caption: 'The 2D structure nests this same lowbit decomposition: one Fenwick walk chooses x buckets, and each bucket owns a second Fenwick walk over y. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:16-node_Fenwick_tree.svg.',
        },
        'The two-dimensional version exists for changing grids and point sets. It answers questions such as total sales between two dates and two price bands, or how many points lie inside a rectangle, while still accepting new point updates.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious static solution is a 2D prefix-sum table. After O(nm) preprocessing on an n by m grid, any rectangle sum can be answered with four table lookups.',
        'The obvious dynamic solution is to scan the rectangle each time. That makes updates cheap, because changing one cell is O(1), but a query over a 1000 by 1000 rectangle touches one million cells.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the update-query tradeoff. A static prefix table gives O(1) queries, but changing one cell invalidates every prefix rectangle that includes that cell.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to store a small set of power-of-two-aligned rectangle summaries. The function lowbit(i), written i & -i, tells how large a bucket ending at index i is.',
        'A 2D Fenwick tree applies that idea twice. The x index chooses a vertical strip, and the y index inside that strip chooses a horizontal range, so each stored cell summarizes one rectangle.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To update point (x, y) by delta, loop i = x, x + lowbit(x), and so on; inside that loop, loop j = y, y + lowbit(y), and so on. Every visited tree[i][j] owns a rectangle that contains (x, y), so each one must add delta.',
        'To query prefix (1, 1) through (x, y), loop downward with i -= lowbit(i) and j -= lowbit(j). The visited rectangles are disjoint and exactly tile the prefix rectangle.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is coverage without overlap. In one dimension, the downward Fenwick query decomposes a prefix into disjoint stored ranges; in two dimensions, the x decomposition crossed with the y decomposition gives disjoint stored rectangles.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Integral_image_application_example.svg',
          alt: 'Summed-area table example using four colored corner values to compute a rectangle sum',
          caption: 'The four-corner rectangle identity is the same algebra the 2D Fenwick tree uses; Fenwick changes how prefix values are maintained under updates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Integral_image_application_example.svg.',
        },
        'Updates preserve the invariant because they add delta to every stored rectangle that contains the changed point and to no rectangle that excludes it. Inclusion-exclusion is correct because sums are additive, so adding and subtracting prefix rectangles leaves exactly the target rectangle.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A point update touches O(log n log m) stored cells, and a prefix query reads O(log n log m) stored cells. A rectangle query runs four prefix queries, so the constant is four times larger but the growth rate is the same.',
        'On a 1024 by 1024 grid, log2(1024) is 10, so one update touches at most about 100 buckets. Doubling both dimensions changes the rough bound from 10 by 10 to 11 by 11, which is a small increase rather than a fourfold scan.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'It fits dynamic rectangle sums where values are additive. Competitive programming uses it for point updates plus rectangle counts, and analytics systems can use the sparse version for ordered dimensions such as time and price.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for non-additive questions. A rectangle maximum, median, or nearest neighbor cannot be recovered by subtracting prefix summaries, because max and median do not obey the same cancellation law as sums.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a 4 by 4 grid and add 5 at cell (3, 2). The update visits x indices 3 and 4, and for each x it visits y indices 2 and 4, so it adds 5 to four stored buckets.',
        'For rectangle (3, 2) through (4, 4), compute prefix(4, 4) - prefix(2, 4) - prefix(4, 1) + prefix(2, 1). The added value appears in prefix(4, 4) and in none of the removed prefixes, so the rectangle answer includes exactly 5.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Peter Fenwick, A New Data Structure for Cumulative Frequency Tables (1994), then derive the two-dimensional version as a nested application of the same lowbit decomposition. Study summed-area tables, coordinate compression, segment trees, and sweep-line algorithms next.',
      ],
    },
  ],
};
