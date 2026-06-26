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
        'The animation splits 32-bit integers into high bits and low bits. The high bits choose a chunk, and the low 16 bits are stored inside a container for that chunk.',
        {type: 'callout', text: 'Roaring bitmaps are fast because each 16-bit chunk chooses the cheapest exact container for its local density.'},
        'Active chunks are the pieces being inspected or combined. Found values are actual members of the set, because Roaring is an exact set representation, not a probabilistic filter.',
        'Watch the container change when local density changes. Sparse chunks use sorted arrays, dense chunks use bitmaps, and long runs can use run containers.',
        {type: 'image', src: './assets/gifs/roaring-bitmaps.gif', alt: 'Animated walkthrough of the roaring bitmaps visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems store large sets of integer IDs: user IDs matching a segment, document IDs containing a term, row IDs passing a filter, or timestamps inside a bucket. The common operations are union, intersection, difference, and membership.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png', alt: 'Bloom filter diagram with hashed keys and bit positions', caption: 'Bit-level membership structures save space by trading raw records for compact set representations; Roaring keeps exactness instead of using false positives. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.'},
        'A plain bitmap is fast but can waste space when IDs are spread out. Roaring exists to keep bitmap-style operations while compressing sparse regions without losing exactness.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'One obvious approach is a sorted array of integers. It is compact for sparse sets and supports intersection by walking two sorted lists.',
        'Another obvious approach is one bit per possible ID. It makes membership and bitwise operations fast, but a universe of 2^32 possible IDs would need 512 MB even for a tiny set.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that sparsity is local. A set can have one range with thousands of nearby IDs and another range with only five IDs, so one global representation wastes either time or memory.',
        'Sorted arrays are slow for dense bitwise operations because they compare element by element. Full bitmaps are wasteful for sparse chunks because they store zeros for values that never appear.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Roaring partitions the universe into chunks of 2^16 possible low values. Each chunk chooses the cheapest exact container for its own density, so representation follows local behavior.',
        'The high 16 bits route to the container, and the low 16 bits are represented inside it. This keeps lookup organized while allowing different regions of the same set to use different storage strategies.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Roaring bitmap is a sorted map from high-key to container. An array container stores sorted 16-bit values, a bitmap container stores 65,536 bits, and a run container stores consecutive intervals.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing regular numeric layout', caption: 'Set operations over chunks are regular numeric kernels: align local regions, apply the container-specific operation, and emit another compressed chunk. Source: https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'Membership finds the high-key container and then checks the low value inside that container. Union and intersection align containers with the same high key and apply the matching container operation.',
        'After an operation, the result can switch container type. For example, intersecting two dense bitmaps may become sparse enough to store as an array container.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The partition is lossless because every 32-bit value has exactly one high 16-bit prefix and one low 16-bit suffix. No value can belong to two chunks, and no value is omitted when its chunk is preserved.',
        'Set operations are correct chunk by chunk. Values with different high bits can never be equal, so intersection only needs matching high keys, while union keeps all containers from either side.',
        'Inside each chunk, each container is an exact representation of the same local set. Changing from array to bitmap changes layout, not membership.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Membership costs a search for the high-key container plus a container-local check. With a sorted high-key directory and small containers, the practical cost is often dominated by cache behavior rather than asymptotic notation.',
        'An array container holding k values uses about 2k bytes for 16-bit lows. A bitmap container always uses 65,536 bits, or 8 KB, so it becomes attractive when k is large enough that arrays lose their space advantage.',
        'Cost behaves locally. Doubling values in an already dense chunk may barely change memory, while adding the same number of values across many new chunks creates many new containers and directory entries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Column stores and analytics engines use Roaring-style bitmaps to represent row sets that pass filters. Intersecting bitmaps answers compound predicates before fetching full rows.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Analytics query plans combine many candidate sets before fetching records; the graph shape makes chained bitmap operations easier to see. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Search systems use integer sets for posting lists, feature flags, segments, and authorization filters. Roaring fits when IDs are sorted integers and repeated set algebra is more important than arbitrary object storage.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Roaring is not useful when values are not integer IDs or when the universe cannot be mapped to stable integers. A hash set is simpler for arbitrary strings or objects.',
        'It can also be worse for tiny sets. The directory and container metadata may cost more than a small sorted array when there are only a few values total.',
        'Updates can fragment behavior. Repeated single inserts across many chunks may allocate many containers, while batch construction can choose better layouts after seeing the whole distribution.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Store the values 1, 2, 3, 70,000, and 70,001. The first three have high bits 0 and lows 1, 2, 3; the last two have high bits 1 and lows 4,464 and 4,465 because 70,000 - 65,536 = 4,464.',
        'Roaring creates two containers. High key 0 stores lows [1, 2, 3], and high key 1 stores lows [4,464, 4,465], likely both as array containers because each is sparse.',
        'Now intersect with a set containing 2, 70,001, and 130,000. Only matching high keys are compared, so high key 0 yields [2], high key 1 yields [4,465], and the unmatched high key for 130,000 contributes nothing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chambi, Lemire, Kaser, and Godin, Better bitmap performance with Roaring bitmaps, 2016; RoaringBitmap project documentation and format notes.',
        'Study next by contrast. Read Bitset for the dense baseline, Sorted Array Intersection for sparse posting lists, Compression for run-length ideas, Bloom Filter for approximate membership, and Column Store Indexes for the analytics workload.',
      ],
    },
  ],
};
