// A wavelet matrix stores a sequence by stable bit-level partitions, avoiding
// explicit wavelet-tree pointers while preserving rank/select/range queries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'wavelet-matrix-range-quantile',
  title: 'Wavelet Matrix Range Quantile',
  category: 'Data Structures',
  summary: 'Represent integer sequences with bit-level stable partitions and zero counts so range quantile, rank, and predecessor queries walk compact arrays.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bit levels', 'range quantile'], defaultValue: 'bit levels' },
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

function matrixGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 1.0, y: 3.5, note: 'sequence' },
      { id: 'b2', label: 'bit 2', x: 3.1, y: 5.6, note: 'msb level' },
      { id: 'z2', label: 'zeros', x: 5.0, y: 5.6, note: 'first bucket' },
      { id: 'o2', label: 'ones', x: 7.0, y: 5.6, note: 'second bucket' },
      { id: 'b1', label: 'bit 1', x: 3.1, y: 3.5, note: 'next level' },
      { id: 'b0', label: 'bit 0', x: 3.1, y: 1.4, note: 'low bit' },
      { id: 'rank', label: 'rank', x: 7.0, y: 2.4, note: 'map interval' },
      { id: 'answer', label: 'queries', x: 8.9, y: 3.5, note: 'rank/quantile' },
    ],
    edges: [
      { id: 'e-input-b2', from: 'input', to: 'b2' },
      { id: 'e-b2-z2', from: 'b2', to: 'z2' },
      { id: 'e-b2-o2', from: 'b2', to: 'o2' },
      { id: 'e-z2-b1', from: 'z2', to: 'b1' },
      { id: 'e-o2-b1', from: 'o2', to: 'b1' },
      { id: 'e-b1-b0', from: 'b1', to: 'b0' },
      { id: 'e-b1-rank', from: 'b1', to: 'rank' },
      { id: 'e-b0-rank', from: 'b0', to: 'rank' },
      { id: 'e-rank-answer', from: 'rank', to: 'answer' },
    ],
  }, { title });
}

function* bitLevels() {
  yield {
    state: matrixGraph('Stable partitions replace explicit tree nodes'),
    highlight: { active: ['input', 'b2', 'z2', 'o2', 'e-input-b2'], found: ['rank'] },
    explanation: 'A wavelet matrix processes integer values from the most significant bit downward. At each level, it records a bitvector and stably moves zero-bit values before one-bit values.',
    invariant: 'The zero count at each level tells where the one bucket begins.',
  };

  yield {
    state: labelMatrix(
      'Build levels for 3 1 4 1 5 0 2 6',
      [
        { id: 'level2', label: 'bit 2' },
        { id: 'level1', label: 'bit 1' },
        { id: 'level0', label: 'bit 0' },
        { id: 'meta', label: 'metadata' },
      ],
      [
        { id: 'bitvector', label: 'bitvector' },
        { id: 'next_order', label: 'next order' },
      ],
      [
        ['0 0 1 0 1 0 0 1', '3 1 1 0 2 | 4 5 6'],
        ['1 0 0 0 1 0 0 1', '1 1 0 4 5 | 3 2 6'],
        ['1 1 0 0 1 1 0 0', '0 4 2 6 | 1 1 5 3'],
        ['zero counts', '5, 5, 4'],
      ],
    ),
    highlight: { active: ['level2:bitvector', 'level1:bitvector', 'level0:bitvector'], found: ['meta:next_order'] },
    explanation: 'The matrix stores one bitvector per level plus zero counts. Rank on those bitvectors maps intervals into the zero or one bucket at the next level.',
  };

  yield {
    state: matrixGraph('Rank maps a position through each level'),
    highlight: { active: ['b2', 'b1', 'b0', 'rank', 'e-b1-rank', 'e-b0-rank'], compare: ['z2', 'o2'], found: ['answer'] },
    explanation: 'To access or rank a value, carry a position through the levels. Rank0 keeps the position in the zero bucket; zeroCount + rank1 moves it into the one bucket.',
  };

  yield {
    state: labelMatrix(
      'Why use a matrix layout',
      [
        { id: 'tree', label: 'Wavelet Tree' },
        { id: 'matrix', label: 'Wavelet Matrix' },
        { id: 'alphabet', label: 'large integers' },
        { id: 'cache', label: 'cache behavior' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'effect' },
      ],
      [
        ['explicit recursive nodes', 'simple concept'],
        ['flat bit levels', 'simple arrays'],
        ['fixed bit width', 'no pointer-heavy tree'],
        ['contiguous bitvectors', 'implementation-friendly'],
      ],
    ),
    highlight: { active: ['matrix:shape', 'alphabet:effect'], compare: ['tree:shape'], found: ['cache:effect'] },
    explanation: 'The matrix is not a different problem. It is a layout refinement that makes wavelet-style queries practical for integer alphabets and array-centric implementations.',
  };
}

function* rangeQuantile() {
  yield {
    state: labelMatrix(
      '3rd smallest in range [1,7)',
      [
        { id: 'start', label: 'start range' },
        { id: 'bit2', label: 'bit 2' },
        { id: 'bit1', label: 'bit 1' },
        { id: 'bit0', label: 'bit 0' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'answer_bits', label: 'answer bits' },
      ],
      [
        ['values 1,4,1,5,0,2', 'k=3'],
        ['zeros before ones; zero count is 4', 'choose 0'],
        ['inside zero bucket, enough zeroes', 'choose 0'],
        ['inside zero bucket, kth falls in one bucket', 'choose 1'],
      ],
    ),
    highlight: { active: ['bit2:decision', 'bit1:decision', 'bit0:decision'], found: ['bit0:answer_bits'] },
    explanation: 'Range quantile carries [l, r) through each bit level. Count how many elements in the range have bit 0. If k fits there, choose 0; otherwise choose 1 and subtract the zero count.',
    invariant: 'Every chosen bit narrows the value interval without sorting the query range.',
  };

  yield {
    state: matrixGraph('Interval remapping is rank arithmetic'),
    highlight: { active: ['b2', 'b1', 'b0', 'rank'], found: ['answer'], compare: ['input'] },
    explanation: 'The query does not extract values. It remaps l and r through bitvectors using rank, exactly as Wavelet Tree queries remap intervals through child nodes.',
  };

  yield {
    state: labelMatrix(
      'Operations supported',
      [
        { id: 'access', label: 'access(i)' },
        { id: 'rank', label: 'rank(x,i)' },
        { id: 'quantile', label: 'kth in [l,r)' },
        { id: 'predecessor', label: 'pred/succ' },
      ],
      [
        { id: 'walk', label: 'walk' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['read bits down levels', 'O(log sigma)'],
        ['follow value bits', 'O(log sigma)'],
        ['branch by zero counts', 'O(log sigma)'],
        ['branch with bounds', 'O(log sigma)'],
      ],
    ),
    highlight: { active: ['quantile:walk', 'predecessor:walk'], found: ['access:cost', 'rank:cost'] },
    explanation: 'The same rank/select support underlies many query types. Range quantile is the easiest to visualize because each level chooses one answer bit.',
  };

  yield {
    state: labelMatrix(
      'Case study: static percentile windows',
      [
        { id: 'snapshot', label: 'snapshot' },
        { id: 'query', label: 'window query' },
        { id: 'matrix', label: 'wavelet matrix' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'reason' },
      ],
      [
        ['latency samples', 'static batch'],
        ['[l,r), p95', 'kth by rank'],
        ['bit-level index', 'no per-window sort'],
        ['quantile value', 'log sigma walk'],
      ],
    ),
    highlight: { active: ['query:role', 'matrix:reason'], found: ['result:role'], compare: ['snapshot:reason'] },
    explanation: 'For static arrays of measurements, a wavelet matrix can answer percentile-style window queries without building a separate sorted catalog for every possible window.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bit levels') yield* bitLevels();
  else if (view === 'range quantile') yield* rangeQuantile();
  else throw new InputError('Pick a wavelet-matrix view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "bit levels" view builds the wavelet matrix for the sequence 3 1 4 1 5 0 2 6. Each frame shows one bit level: the bitvector recording which values have a 1-bit at that position, then the stable partition that moves all 0-bit values before all 1-bit values. Active highlights mark the bitvector being written. Found highlights mark the zero counts that anchor every future query.',
        {type: 'callout', text: 'A wavelet matrix turns range order into rank arithmetic: each bit level chooses one answer bit while keeping the query interval contiguous.'},
        'The "range quantile" view answers "3rd smallest in [1,7)." Each frame picks one answer bit by counting zeros inside the current interval. Active highlights are the decision at each level. Found highlights are the accumulated answer bits. Watch the interval [l, r) shrink through the levels -- the structure never extracts or sorts the window.',
        'At every frame, ask: what information does the bitvector carry, and why does stable partitioning keep the interval contiguous at the next level?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Databases, monitoring systems, and text indexes routinely face a two-dimensional query: given an array of values, find the kth smallest inside a positional range [l, r). Latency percentiles over a time window, price quantiles over a product catalog slice, and suffix-array range counts in full-text search all reduce to this pattern.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Range-query indexes can be read as directed navigation structures: each edge preserves enough order information to avoid sorting the query window. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The query is hard because position and value order are independent axes. A prefix sum handles one axis. A sorted copy handles the other. Neither handles both at once. The wavelet matrix is a static index that encodes both axes into a compact, cache-friendly layout so that rank, quantile, predecessor, and range-frequency queries all run in O(log sigma) time, where sigma is the alphabet size.',
        {
          type: 'quote',
          text: 'The wavelet matrix is a simplified, cache-friendlier alternative to the wavelet tree that supports the same operations with the same complexities.',
          attribution: 'Claude and Navarro, "The Wavelet Matrix" (SPIRE 2012)',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest range quantile: copy A[l..r), sort the copy, read position k. This costs O(m log m) per query for a window of length m. For a single query it is fine. For thousands of quantile queries over different windows of a million-element array, the repeated sorting dominates.',
        'A merge-sort tree stores sorted sublists at segment-tree nodes and answers range quantile in O(log^2 n) or O(log n) with fractional cascading, but each node holds a full sorted copy of its range, so space is O(n log n) and cache behavior is poor -- every query chases pointers into separately allocated sorted arrays.',
        'A wavelet tree improves on merge-sort trees by storing one bitvector per tree node and recursing on alphabet halves instead of position halves. It answers the same queries in O(log sigma) with O(n log sigma) bits of space. But the tree is pointer-heavy: each node is a separate allocation, and traversal jumps between heap-scattered bitvectors.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wavelet tree is correct but slow in practice. At each level the query follows a left or right child pointer to a different bitvector allocation. On a 64-bit machine with 64-byte cache lines, these pointer chases cause one cache miss per level per query. For a 20-bit alphabet that is 20 cache misses, and modern CPUs stall for ~100 ns per L3 miss. The algorithm is O(log sigma) but the constant is dominated by memory latency.',
        'The deeper problem is structural: the wavelet tree has 2^d nodes at depth d, each with its own bitvector. The tree shape forces scattered memory even if you try to lay nodes out contiguously, because child sizes vary and the allocator cannot predict access order.',
        'What is needed is a layout that preserves the bit-level decomposition and the rank-based interval remapping but stores all data for each level in a single contiguous array. That is exactly what the wavelet matrix provides.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction processes the sequence from the most significant bit to the least. At each level, write a single bitvector B[level] recording the current bit of every value in the current order. Then stably partition the values: all values with bit 0 come first, preserving their relative order, followed by all values with bit 1 in their relative order. Record zeroCount[level], the number of 0-bit values. The next level reads from this new order.',
        {
          type: 'diagram',
          label: 'Bit-plane layout with stable partition (3-bit values)',
          text: 'Input:    3  1  4  1  5  0  2  6\n\nLevel 2 (MSB):\n  bits:   0  0  1  0  1  0  0  1    zeroCount = 5\n  reorder: [3 1 1 0 2 | 4 5 6]     (0-bit values | 1-bit values)\n\nLevel 1:\n  bits:   1  0  0  0  1  0  0  1    zeroCount = 5\n  reorder: [1 1 0 4 5 | 3 2 6]\n\nLevel 0 (LSB):\n  bits:   1  1  0  0  1  1  0  0    zeroCount = 4\n  reorder: [0 4 2 6 | 1 1 5 3]\n\nStored: 3 bitvectors + 3 zero counts. No pointers.',
        },
        'To answer a range quantile query "kth smallest in [l, r)", walk the levels top-down. At each level, count zeros = rank0(B[level], r) - rank0(B[level], l), the number of values in the current interval whose current bit is 0. If k <= zeros, the answer bit is 0 and the interval remaps to the zero side. Otherwise the answer bit is 1, k decreases by zeros, and the interval remaps to the one side. After all levels, the accumulated bits are the answer value.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Range quantile: kth smallest in A[l..r), 1-indexed k\nfunction quantile(matrix, l, r, k) {\n  let value = 0;\n  for (let level = matrix.levels - 1; level >= 0; level--) {\n    const bv = matrix.bitvectors[level];\n    const z  = matrix.zeroCounts[level];\n    const zeros = rank0(bv, r) - rank0(bv, l);\n    if (k <= zeros) {\n      // answer bit is 0, remap to zero bucket\n      l = rank0(bv, l);\n      r = rank0(bv, r);\n    } else {\n      // answer bit is 1, remap to one bucket\n      value |= (1 << level);\n      k -= zeros;\n      l = z + rank1(bv, l);\n      r = z + rank1(bv, r);\n    }\n  }\n  return value;\n}',
        },
        'The interval remapping formulas are the key. The zero side becomes [rank0(l), rank0(r)) because rank0 counts how many 0-bit positions precede l and r in the bitvector. The one side becomes [zeroCount + rank1(l), zeroCount + rank1(r)) because 1-bit values start after all 0-bit values, and rank1 counts how many 1-bit positions precede each endpoint. These two formulas replace the left-child and right-child pointer chases of the wavelet tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, at each bit level, every value with bit 0 is smaller (within the current prefix class) than every value with bit 1. This is true because higher bits dominate: values sharing the same prefix above the current level are split by the current bit into a group that is strictly smaller and a group that is strictly larger. So the kth smallest must be among the zeros if k is at most the zero count, and among the ones otherwise.',
        'Second, stable partitioning preserves the contiguity of intervals. If positions l through r-1 hold the candidates at the current level, then after stable partitioning, all candidates with bit 0 occupy a contiguous block among the zeros, and all candidates with bit 1 occupy a contiguous block among the ones. This is because stability means relative order is preserved within each group, so elements that were contiguous stay contiguous. The rank formulas compute exactly where these contiguous blocks land.',
        'By induction over levels, after choosing all bits, the accumulated value is the unique element at the kth position in the sorted order of A[l..r). No sorting was performed -- the structure pre-encoded the information that sorting would have revealed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Property', 'Wavelet Tree', 'Wavelet Matrix', 'Merge-Sort Tree'],
          rows: [
            ['Space', 'O(n log sigma) bits', 'O(n log sigma) bits', 'O(n log n) words'],
            ['Quantile query', 'O(log sigma)', 'O(log sigma)', 'O(log^2 n)'],
            ['Rank query', 'O(log sigma)', 'O(log sigma)', 'O(log^2 n)'],
            ['Build time', 'O(n log sigma)', 'O(n log sigma)', 'O(n log^2 n)'],
            ['Cache behavior', 'Poor (pointer chasing)', 'Good (flat arrays)', 'Poor (sorted sublists)'],
            ['Node count', '2 * sigma - 1', '0 (no nodes)', 'O(n) segment nodes'],
            ['Update support', 'Static', 'Static', 'Static'],
          ],
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'CPU cache hierarchy diagram', caption: 'The matrix layout matters because rank walks pay for memory movement; contiguous bitvectors make cache behavior part of the data-structure design. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        'Each query touches log(sigma) bitvectors, but in the wavelet matrix every bitvector is a single contiguous array. On a machine with 64-byte cache lines and 4-byte rank blocks, a rank query on one level typically hits 1-2 cache lines instead of chasing a pointer to an unpredictable address. For a 20-bit alphabet, this can mean 20-40 cache-line fetches instead of 20+ cache misses -- a 3-5x practical speedup on large arrays.',
        'Space is dominated by the bitvectors: n bits per level times log(sigma) levels, plus O(n / block_size) words for rank support. With coordinate compression to sigma = number of distinct values, the bit width shrinks. For 100,000 distinct values in a million-element array, 17 bits suffice, so the matrix is 17 million bits (~2 MB) plus rank overhead.',
        'Construction is O(n log sigma): one pass per level to write the bitvector and stably partition. The stable partition is a single-pass counting sort by one bit, which is a radix step. Building rank support for each bitvector adds O(n) per level.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The wavelet matrix excels in three settings. First, static analytic workloads where the array is built once and queried many times: latency percentiles over time windows, price quantiles in product catalogs, severity distributions in event logs. The O(log sigma) query with good cache behavior beats merge-sort trees and is simpler to implement than fractional cascading.',
        'Second, text indexing. The FM-index stores the Burrows-Wheeler transform and answers pattern-matching queries using rank on the BWT. A wavelet matrix over the BWT alphabet provides the rank operation and simultaneously supports document listing, range frequency, and top-k queries. This is the original motivation from Navarro and collaborators.',
        'Third, competitive programming and offline problem solving. The wavelet matrix is one of the few structures that answers kth-smallest-in-range, range-frequency, range-predecessor, and range-successor all from the same build, with straightforward code. Libraries like the Succinct library (succinct.rs) and various competitive programming templates implement it in under 100 lines.',
        {
          type: 'note',
          text: 'Beyond quantile, the same structure supports access(i), rank(x, i), select(x, k), range count of values in [a, b] within positions [l, r), predecessor, successor, and top-k by frequency -- all in O(log sigma) per query using variations of the same level walk.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The wavelet matrix is fully static. An update to one position can change the bitvector and the stable-partition order at every level. Dynamic wavelet trees exist (using balanced BSTs as bitvectors) but they lose the cache-friendliness that motivated the matrix in the first place. If the array changes frequently, a different structure -- or periodic rebuilds -- is needed.',
        'For approximate answers, the wavelet matrix is overkill. A t-digest, KLL sketch, or DDSketch answers approximate quantile queries in O(1) with O(1/epsilon) space, no rank support, and trivial mergeability. If 1% relative error is acceptable, a sketch is smaller, faster, and supports streaming.',
        'Small alphabets (sigma < 64) can use simpler methods. A plain wavelet tree with sigma nodes fits in cache anyway, and the code is easier to teach. For sigma = 2 (binary sequences), a single bitvector with rank/select is all that is needed -- the matrix machinery adds nothing.',
        'Coordinate compression is required when raw values are large but the distinct count is small. This is a preprocessing step that must preserve value order; hashing the values before building the matrix destroys the ordering that the bit walk depends on, silently producing wrong quantile answers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Prerequisite: Rank/Select Bitvector -- every level walk calls rank, so understand rank in O(1) with o(n) extra bits before studying this structure.',
            'Direct predecessor: Wavelet Tree -- the recursive pointer-based version of the same idea. Study it first to see why the matrix layout is an improvement, not a different algorithm.',
            'Extension: FM-Index and Burrows-Wheeler Transform -- wavelet matrices provide the rank backbone for compressed full-text indexes.',
            'Alternative: Merge-Sort Tree -- solves similar range-order queries with worse cache behavior but conceptual simplicity.',
            'Alternative: Persistent Segment Tree -- answers kth-smallest-in-range via a different decomposition (value-indexed, position-persistent).',
          ],
        },
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Claude and Navarro, "The Wavelet Matrix" (SPIRE 2012)', 'Original paper defining the matrix layout, proving equivalence to wavelet trees, and benchmarking cache performance.'],
            ['Navarro, "Wavelet Trees for All" (CPM 2012)', 'Comprehensive survey of wavelet tree operations, including the matrix variant and applications to document retrieval.'],
            ['Grossi, Gupta, and Vitter, "High-Order Entropy-Compressed Text Indexes" (SODA 2003 / J.ACM 2005)', 'Foundational work on rank/select-based text indexing that motivates the wavelet approach.'],
          ],
        },
        'After this topic, study the FM-Index to see the wavelet matrix in its most impactful application, or study persistent segment trees to compare a different decomposition strategy for the same range-order problem.',
      ],
    },
  ],
};
