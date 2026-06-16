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
    explanation: 'Roaring bitmaps store sets of non-negative integers. Start with sorted values, then split each integer into high 16 bits and low 16 bits. The high bits choose a chunk; the low bits are stored inside that chunk.',
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
    explanation: 'Each 16-bit chunk chooses its own representation. Sparse chunks use sorted arrays. Dense chunks use fixed 65,536-bit bitmaps. Long consecutive ranges use run containers. This local choice is why Roaring is fast and compact across messy real data.',
    invariant: 'One high-key directory plus one container per occupied chunk.',
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
    explanation: 'The data structure is adaptive. It does not force a single representation on all chunks. A log shard, user-id cohort, or column index can have sparse, dense, and run-like regions at the same time.',
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
    explanation: 'Roaring is a compromise that often beats both extremes. It avoids allocating a giant bit for every possible user id, but it still uses CPU word-level operations where density justifies it.',
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
    explanation: 'Set intersection is chunk-aligned. Match high keys, then dispatch to the container pair: array-array merge, bitmap-bitmap word AND, run-run interval intersection, or mixed variants. The fast path is local and branchable.',
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
    explanation: 'The result is another Roaring bitmap. Each output chunk again picks the cheapest representation. This closure property matters: analytics engines can chain filters without decoding everything back into plain arrays.',
    invariant: 'AND, OR, XOR, and AND-NOT return compressed bitmaps again.',
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
    explanation: 'Roaring bitmaps are common in analytical databases, search indexes, feature stores, and experiment platforms because many questions are set algebra: who matches filter A, filter B, and not filter C?',
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
      heading: 'What it is',
      paragraphs: [
        'A Roaring bitmap is a compressed set of integers optimized for fast set operations. Instead of storing every integer in a list or every possible integer in one giant bitset, it splits integers into 16-bit chunks. Each chunk stores low bits in the most efficient local container: sorted array, dense bitmap, or run-length container.',
        'The result is a structure that often stays compact like a sorted list and fast like a bitset. It is especially useful when IDs are large, sparse in some regions, dense in others, and queried repeatedly with AND, OR, and difference operations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a 32-bit integer, the high 16 bits choose a chunk key and the low 16 bits become the value inside that chunk. A directory maps chunk keys to containers. If a chunk contains only a few values, an array container stores the sorted low values. If it contains many values, a bitmap container stores 65,536 bits and uses word-level CPU operations. If it contains long consecutive spans, a run container stores intervals.',
        'Set operations align chunks by high key. If both sets have chunk 17, intersect the two containers for chunk 17. If one side lacks the chunk, the intersection is empty. Different container pairs use different kernels: array merge, bitmap AND, interval overlap, or mixed conversions. The output is compressed again.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Membership is close to O(1): find the chunk, then search or test inside its container. Intersections scale with the number and type of matched containers, not the maximum possible ID. Bitmap containers use a fixed 1024 machine words for a 16-bit chunk, so dense intersections can be extremely fast. Sparse chunks stay proportional to cardinality through arrays. Run containers are proportional to number of intervals.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Roaring bitmaps appear in analytics engines, search systems, column indexes, feature stores, and experimentation platforms. Apache Pinot, Druid-style analytics systems, Lucene-adjacent indexing patterns, and many JVM/Go/Rust libraries use Roaring or Roaring-like formats for compressed posting lists and cohort filters. The reason is simple: many production questions are set algebra over user IDs, document IDs, event IDs, or row IDs.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Roaring is not always smaller than every alternative. Tiny sets may be cheaper as plain arrays. Perfectly dense low-range sets may be cheapest as a plain bitset. Highly dynamic workloads pay update overhead because containers may need to switch representation. The win comes from mixed real-world distributions and repeated set operations.',
        'Another trap is confusing compression with slowness. The compression is chosen to preserve fast operations. Bitmap containers run word-level SIMD-friendly operations; array containers merge sorted integers; run containers intersect intervals. The format is compressed because the operations know how to stay compressed.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Bloom Filter to compare probabilistic membership with exact compressed sets. Read Database Indexing for bitmap index use cases, Hash Table for lookup intuition, and A/B Testing & p-values for cohort-style product analytics. Then connect Roaring to Cache Invalidation & Versioning: many caches store and combine sets of IDs before touching full records.',
      ],
    },
  ],
};
