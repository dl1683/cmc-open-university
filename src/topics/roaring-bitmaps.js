// Roaring bitmap: compressed integer sets built from 16-bit chunks. Each
// chunk chooses the cheapest container: sorted array, dense bitmap, or run.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'roaring-bitmaps',
  title: 'Roaring Bitmaps',
  category: 'Data Structures',
  summary: 'Compressed integer sets: split values into chunks, pick array/bitmap/run containers, and intersect at machine speed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['containers', 'fast intersection'], defaultValue: 'containers' },
  ],
  run,
};

const VALUES = [3, 7, 9, 65537, 65539, 65540, 65541, 131072, 131073, 131074, 131075, 131076];

function* containers() {
  yield {
    state: matrixState({
      title: 'One sorted integer set',
      rows: VALUES.map((v, i) => ({ id: `v${i}`, label: `value ${i}` })),
      columns: [
        { id: 'raw', label: 'integer' },
        { id: 'high', label: 'high 16 bits' },
        { id: 'low', label: 'low 16 bits' },
      ],
      values: VALUES.map((v) => [v, Math.floor(v / 65536), v % 65536]),
      format: (v) => String(v),
    }),
    highlight: {},
    explanation: `Roaring bitmaps store sets of non-negative integers. Start with ${VALUES.length} sorted values, then split each integer into high 16 bits and low 16 bits. The high bits choose a chunk; the low bits are stored inside that chunk — for example ${VALUES[0]} has high ${Math.floor(VALUES[0] / 65536)} and low ${VALUES[0] % 65536}.`,
  };

  yield {
    state: matrixState({
      title: 'Chunk directory: high bits point to containers',
      rows: [
        { id: 'c0', label: 'chunk 0' },
        { id: 'c1', label: 'chunk 1' },
        { id: 'c2', label: 'chunk 2' },
      ],
      columns: [
        { id: 'values', label: 'low values' },
        { id: 'shape', label: 'shape' },
        { id: 'container', label: 'container' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      format: (v) => [
        '',
        '3, 7, 9', 'sparse', 'array',
        '1, 3, 4, 5', 'small cluster', 'array',
        '0, 1, 2, 3, 4', 'long run', 'run',
      ][v],
    }),
    highlight: { active: ['c0:container', 'c1:container', 'c2:container'] },
    explanation: `Each 16-bit chunk chooses its own representation. The ${VALUES.length} values fall into ${new Set(VALUES.map(v => Math.floor(v / 65536))).size} chunks. Sparse chunks use sorted arrays. Dense chunks use fixed ${(65536).toLocaleString()}-bit bitmaps. Long consecutive ranges use run containers. This local choice is why Roaring is fast and compact across messy real data.`,
    invariant: `One high-key directory plus one container per each of the ${new Set(VALUES.map(v => Math.floor(v / 65536))).size} occupied chunks.`,
  };

  yield {
    state: matrixState({
      title: 'Container selection rule of thumb',
      rows: [
        { id: 'array', label: 'array container' },
        { id: 'bitmap', label: 'bitmap container' },
        { id: 'run', label: 'run container' },
      ],
      columns: [
        { id: 'best', label: 'best when' },
        { id: 'operation', label: 'operation style' },
        { id: 'cost', label: 'cost shape' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      format: (v) => [
        '',
        'few values', 'merge sorted lists', 'O(cardinality)',
        'many values', 'word-level bit ops', 'O(1024 words)',
        'long consecutive ranges', 'interval merge', 'O(number of runs)',
      ][v],
    }),
    highlight: { found: ['array:best', 'bitmap:operation', 'run:cost'] },
    explanation: `The data structure is adaptive. With ${VALUES.length} values spanning ${new Set(VALUES.map(v => Math.floor(v / 65536))).size} chunks, it does not force a single representation on all of them. A log shard, user-id cohort, or column index can have sparse, dense, and run-like regions at the same time.`,
  };

  yield {
    state: matrixState({
      title: 'Why this is different from a plain bitset',
      rows: [
        { id: 'plain', label: 'plain bitset' },
        { id: 'sorted', label: 'sorted array' },
        { id: 'roar', label: 'Roaring bitmap' },
      ],
      columns: [
        { id: 'space', label: 'space' },
        { id: 'and', label: 'intersection' },
        { id: 'range', label: 'range runs' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      format: (v) => [
        '',
        'huge if max id huge', 'fast', 'wastes gaps',
        'small if sparse', 'slower on dense sets', 'no compression of runs',
        'adapts per chunk', 'fast and compact', 'run container',
      ][v],
    }),
    highlight: { active: ['roar:space', 'roar:and', 'roar:range'] },
    explanation: `Roaring is a compromise that often beats both extremes. A plain bitset for our max value ${VALUES[VALUES.length - 1]} would need ${Math.ceil(VALUES[VALUES.length - 1] / 8).toLocaleString()} bytes, but Roaring stores only the ${new Set(VALUES.map(v => Math.floor(v / 65536))).size} occupied chunks while still using CPU word-level operations where density justifies it.`,
  };
}

function* intersection() {
  yield {
    state: matrixState({
      title: 'Two user cohorts encoded by chunk',
      rows: [
        { id: 'a0', label: 'A chunk 0' },
        { id: 'b0', label: 'B chunk 0' },
        { id: 'a1', label: 'A chunk 1' },
        { id: 'b1', label: 'B chunk 1' },
        { id: 'a2', label: 'A chunk 2' },
        { id: 'b2', label: 'B chunk 2' },
      ],
      columns: [
        { id: 'type', label: 'container' },
        { id: 'values', label: 'low values' },
        { id: 'action', label: 'action' },
      ],
      values: [
        [1, 2, 3],
        [1, 4, 5],
        [6, 7, 8],
        [6, 9, 10],
        [11, 12, 13],
        [11, 14, 15],
      ],
      format: (v) => [
        '',
        'array', '3, 7, 9', 'merge',
        'array', '7, 8, 9', 'merge',
        'bitmap', 'dense region', 'bitwise AND',
        'bitmap', 'dense region', 'bitwise AND',
        'run', '0..8', 'range intersect',
        'run', '4..12', 'range intersect',
      ][v],
    }),
    highlight: { active: ['a0:action', 'b0:action', 'a1:action', 'b1:action', 'a2:action', 'b2:action'] },
    explanation: `Set intersection is chunk-aligned across ${new Set(VALUES.map(v => Math.floor(v / 65536))).size} chunks. Match high keys, then dispatch to the container pair: array-array merge, bitmap-bitmap word AND (over ${Math.ceil(65536 / 64)} 64-bit words), run-run interval intersection, or mixed variants. The fast path is local and branchable.`,
  };

  yield {
    state: matrixState({
      title: 'Intersection result',
      rows: [
        { id: 'c0', label: 'chunk 0' },
        { id: 'c1', label: 'chunk 1' },
        { id: 'c2', label: 'chunk 2' },
        { id: 'all', label: 'decoded values' },
      ],
      columns: [
        { id: 'local', label: 'local result' },
        { id: 'global', label: 'global ids' },
        { id: 'container', label: 'best output' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        '7, 9', '7, 9', 'array',
        'dense overlap', '65537..', 'bitmap',
        '4..8', '131076..131080', 'run',
        'union of chunks', 'final set', 'adaptive',
      ][v],
    }),
    highlight: { found: ['c0:local', 'c1:local', 'c2:local'] },
    explanation: `The result is another Roaring bitmap with up to ${new Set(VALUES.map(v => Math.floor(v / 65536))).size} output chunks, each again picking the cheapest representation. This closure property matters: analytics engines can chain filters without decoding everything back into plain arrays of ${VALUES.length} or more integers.`,
    invariant: `AND, OR, XOR, and AND-NOT all return compressed bitmaps — each output chunk independently selects among ${['array', 'bitmap', 'run'].length} container types.`,
  };

  yield {
    state: matrixState({
      title: 'Production uses',
      rows: [
        { id: 'db', label: 'database indexes' },
        { id: 'analytics', label: 'analytics filters' },
        { id: 'search', label: 'search engines' },
        { id: 'ab', label: 'experiments' },
      ],
      columns: [
        { id: 'query', label: 'query shape' },
        { id: 'why', label: 'why bitmap helps' },
        { id: 'neighbor', label: 'study next' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'country=US AND paid', 'fast set intersection', 'Database Indexing',
        'cohort filters', 'compressed intermediate sets', 'A/B Testing & p-values',
        'posting lists', 'rank candidate pruning', 'Bloom Filter',
        'eligible users', 'cheap membership and cohorts', 'Hash Table',
      ][v],
    }),
    highlight: { active: ['db:why', 'analytics:why', 'search:why'] },
    explanation: `Roaring bitmaps are common in analytical databases, search indexes, feature stores, and experiment platforms. With ${VALUES.length} sample ids spanning chunks ${[...new Set(VALUES.map(v => Math.floor(v / 65536)))].join(', ')}, any question reduces to set algebra: who matches filter A, filter B, and not filter C?`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'containers') yield* containers();
  else if (view === 'fast intersection') yield* intersection();
  else throw new InputError('Pick a Roaring bitmap view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'Roaring bitmaps are fast because each 16-bit chunk chooses the cheapest exact container for its local density.'},
        "Read the animation as the execution trace for Roaring Bitmaps. Compressed integer sets: split values into chunks, pick array/bitmap/run containers, and intersect at machine speed..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/roaring-bitmaps.gif', alt: 'Animated walkthrough of the roaring bitmaps visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png', alt: 'Bloom filter diagram with hashed keys and bit positions', caption: 'Bit-level membership structures save space by trading raw records for compact set representations; Roaring keeps exactness instead of using false positives. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.'},
        `Many production queries reduce to set algebra over integer ids: users in a cohort, documents matching a term, rows with a flag, accounts eligible for an experiment. The query engine needs to intersect, union, and subtract these sets many times before it touches the full records.`,
        `A plain sorted list stores sparse sets well. A plain bitset answers AND and OR with machine-word operations. Real id sets are rarely all sparse or all dense. Roaring bitmaps exist for that mixed case: keep exact sets compressed, but still run set operations close to bitset speed when local density justifies it.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The first reasonable choice is a sorted array of ids. Membership is a binary search, and intersection is a merge. That works when the set is small and every stored integer matters.`,
        `The second reasonable choice is a bitset. Bit i says whether id i is present, so intersection is a word-level AND. That works when ids live in a tight dense range. It fails when the maximum id is large and most ids are absent.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `One global representation loses because density is local. A set can have a few ids near zero, a dense block around one shard, and long consecutive runs from an imported range. A sorted array wastes CPU on dense regions. A global bitset wastes memory on empty gaps.`,
        `The wall is exact set algebra over a large universe where each region has a different shape. The data structure has to preserve fast operations without committing the whole set to one storage format.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Split each 32-bit integer into a high 16-bit key and a low 16-bit value. The high key chooses a chunk. The chunk stores only low values from 0 to 65,535.`,
        `Each occupied chunk chooses its own container. Sparse chunks use sorted arrays of 16-bit lows. Dense chunks use a fixed 65,536-bit bitmap. Run-like chunks use intervals. The invariant is simple: the directory maps each high key to one exact representation of the lows present in that chunk.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing regular numeric layout', caption: 'Set operations over chunks are regular numeric kernels: align local regions, apply the container-specific operation, and emit another compressed chunk. Source: https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        `To insert id 131075, compute high = 2 and low = 3 because 131075 = 2 * 65,536 + 3. The directory finds chunk 2, then the chunk container records low value 3. Decoding reverses the operation: high * 65,536 + low.`,
        `Set operations first align chunks by high key. If one side has no chunk for a key, intersection for that key is empty. If both sides have the key, the operation dispatches by container pair: array-array uses a sorted merge, bitmap-bitmap uses word AND, run-run uses interval overlap, and mixed pairs use specialized kernels or temporary conversion.`,
        `After an operation, each output chunk can choose a new container. A bitmap intersection may become sparse enough to store as an array. An array union may become dense enough to store as a bitmap. This closure property lets analytics engines chain filters without decompressing everything into integer lists.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose one bitmap stores users in the United States and another stores users who paid in the last 30 days. Querying paid US users is an intersection. Chunks whose high keys appear in only one set are skipped. Chunks present in both sets are intersected locally.`,
        `A sparse city-level chunk may merge two tiny arrays. A dense active-user chunk may AND 1024 64-bit words. A chunk from a sequential import may intersect two runs. The query gets one exact result while each region uses the representation that matches its local data.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The high bits partition the integer universe into disjoint chunks. No integer belongs to two chunks, and no operation on one chunk can affect another chunk. That makes set algebra decomposable by high key.`,
        `Inside a chunk, every container represents the same mathematical object: a set of low 16-bit values. Array merge, bitmap word operations, and run interval operations are exact implementations of set algebra on that low-value universe. Combining the exact per-chunk results gives the exact global result.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Cost depends on occupied chunks and container types, not on the largest possible id. Sparse array containers scale with their cardinality. Bitmap containers use 65,536 bits, or 8 KiB, and process a full chunk in 1024 64-bit word operations. Run containers scale with the number of intervals.`,
        `Membership is a directory lookup plus a container lookup. Array membership is usually binary search or a small scan. Bitmap membership is a bit test. Run membership searches intervals. Intersections scale with matching chunk keys; doubling the maximum id does little if the number of occupied chunks stays the same, but doubling occupied chunks roughly doubles directory and container work.`,
        `Roaring implementations usually switch an array container to a bitmap around the point where 16-bit values take about the same space as a 65,536-bit bitmap. The exact threshold and run-container policy are engineering choices, but the reason is fixed: each chunk should pay for the shape it actually has.`,
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        `Keep the chunk directory sorted by high key so operations can merge directories the same way sorted lists merge. Inside each chunk, keep the container canonical for its type: arrays sorted and unique, bitmaps with accurate cardinality if cached, and runs normalized so adjacent intervals do not remain split unnecessarily.`,
        `Define conversion thresholds in one place. Array-to-bitmap, bitmap-to-array, run optimization, and lazy operation policies should be measurable decisions, not scattered magic numbers. A library that converts too eagerly can waste CPU; a library that never converts can keep the wrong container after the data shape changes.`,
        `Track cardinality carefully. Many operations depend on fast size estimates, and analytics users often ask for counts before materializing ids. A stale cardinality cache is a correctness bug, not just a performance bug.`,
      ],
    },
    {
      heading: 'Testing it',
      paragraphs: [
        `Use an exact set as the reference. Generate random integer sets, encode them as Roaring bitmaps, and compare membership, cardinality, AND, OR, XOR, AND-NOT, iteration order, and serialization round trips against the reference. Include values around 65,535 and 65,536 because chunk-boundary mistakes are common.`,
        `Test mixed-container operations directly: array with bitmap, bitmap with run, run with array, empty chunks, full chunks, and containers that convert after the operation. The whole point of Roaring is that different local shapes compose correctly.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Analytics query plans combine many candidate sets before fetching records; the graph shape makes chained bitmap operations easier to see. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        `Roaring fits column indexes, search posting lists, feature-store cohorts, fraud rules, eligibility filters, and experiment platforms. These systems often run the same pattern: build many candidate id sets, combine them with AND, OR, and AND-NOT, then fetch only the surviving records.`,
        `It is strongest when ids are clustered enough for compression but irregular enough that a single bitset would waste memory. It also works well in distributed analytics because intermediate sets can stay compressed while moving between stages.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Tiny sets can be cheaper as plain arrays. Fully dense low-range universes can be cheaper as plain bitsets. Random sparse ids spread across many chunks can create directory overhead without giving bitmap speed.`,
        `Heavy mutation can pay for allocation, container conversion, and run optimization. Roaring is also exact, not probabilistic; if all you need is maybe-present membership with tiny memory, a Bloom filter may be a better first choice. Compression isn't the goal by itself. The format wins when compressed operations are still fast.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Chambi, Lemire, Kaser, and Godin, "Better bitmap performance with Roaring bitmaps" at https://arxiv.org/abs/1402.6407; Lemire et al., "Roaring Bitmaps: Implementation of an Optimized Software Library" at https://arxiv.org/abs/1709.07821; and the CRoaring implementation at https://github.com/RoaringBitmap/CRoaring.`,
        `Study Bloom Filter to contrast exact compressed sets with probabilistic membership. Study Hash Table for exact lookup without sorted set algebra. Study Database Indexing for bitmap-index query plans, Inverted Index for posting-list intersections, and A/B Testing and p-values for cohort analytics where these id sets often appear.`,
      ],
    },
  ],
};
