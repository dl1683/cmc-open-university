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
      heading: `Why This Exists`,
      paragraphs: [
        `A wavelet matrix is for static sequences where queries care about both position and value order. Given an array of numbers, the system may need the kth smallest value in a subrange, the count of a value before an index, the predecessor inside a window, or an exact percentile over a time slice.`,
        `The structure exists because these are not simple prefix-sum questions. The query range is positional, but the answer is ordered by value. A wavelet matrix keeps enough information about both dimensions to answer exact range-order queries without sorting the requested window.`,
      ],
    },
    {
      heading: `Naive Baseline`,
      paragraphs: [
        `The baseline for a range quantile query is to copy A[l..r), sort it, and read the kth item. That is easy and exact, but it costs O(m log m) for a window of length m. Repeated percentile-style queries over large static arrays become too expensive.`,
        `A Fenwick tree or segment tree solves different problems, such as sums or counts over positions. A merge-sort tree can answer some range-order questions by storing sorted lists at nodes, but it uses heavier nested arrays and usually has worse locality than a flat bit-level representation.`,
      ],
    },
    {
      heading: `The Wall`,
      paragraphs: [
        `The wall is that the query has two coordinates. The interval [l, r) is about original positions. The kth smallest decision is about value order. A sorted copy of the whole array loses the original range. The original array keeps the range but gives no fast way to count how many values in that range fall below a candidate value.`,
        `A good structure needs to narrow the position interval and the value interval together, one decision at a time, while keeping the data compact enough for large static arrays.`,
      ],
    },
    {
      heading: `Core Insight`,
      paragraphs: [
        `Represent values by bits from most significant to least significant. At each level, write a bitvector for the current bit of every value in the current order, then stably partition the values so all 0-bit values come before all 1-bit values. Store zeroCount, the boundary where the 1 bucket begins.`,
        `The invariant is stable interval remapping. rank0 and rank1 on the level bitvector tell how many items from [l, r) go to the zero bucket and one bucket. Because the partition is stable, the mapped interval at the next level represents exactly the same original elements, filtered by the bit choices made so far.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the "bit levels" view, the graph shows the build rule: input values go through bit 2, zeros are placed before ones, then the next bit level repeats the process. The table for 3 1 4 1 5 0 2 6 is the concrete artifact: three bitvectors plus zero counts 5, 5, and 4.`,
        `In the "range quantile" view, watch the interval rather than individual values. The frame for "3rd smallest in range [1,7)" chooses one answer bit per level. At each level, the zero-count inside the current interval decides whether k stays in the zero bucket or moves into the one bucket with k reduced by the number of zeros skipped.`,
      ],
    },
    {
      heading: `Mechanics`,
      paragraphs: [
        `Construction starts with the original array order. For each bit level, write the bit for every value in the current order. Then produce the next order by appending all values with bit 0, followed by all values with bit 1, preserving relative order inside each group. Store the count of zero-bit values for that level.`,
        `To remap [l, r) through a level, the zero side becomes [rank0(l), rank0(r)). The one side becomes [zeroCount + rank1(l), zeroCount + rank1(r)). These formulas are the matrix replacement for following left and right child pointers in a wavelet tree.`,
        `For quantile, compute zeros = rank0(r) - rank0(l). If k is at most zeros, the next answer bit is 0 and the interval remaps to the zero side. Otherwise the next answer bit is 1, k decreases by zeros, and the interval remaps to the one side.`,
      ],
    },
    {
      heading: `Correctness`,
      paragraphs: [
        `At the most significant bit, every value with bit 0 is smaller than every value with bit 1 among values that share the same higher prefix. Therefore the kth smallest value must be in the zero bucket if the current interval contains at least k zero-bit values; otherwise it must be in the one bucket.`,
        `After choosing a bucket, stable partitioning keeps exactly the candidate elements in a contiguous interval at the next level. The same argument repeats for the next bit. After all levels, the chosen bits form the unique value whose order position was requested.`,
      ],
    },
    {
      heading: `Cost and Tradeoffs`,
      paragraphs: [
        `For a value universe of size sigma, operations take O(log sigma) rank steps. For fixed-width integers, this is O(w), where w is the number of bits used after coordinate compression or normalization. Space is one bitvector per level plus rank support and zero counts.`,
        `The matrix layout avoids explicit recursive nodes and is often cache-friendly because each level is a flat bitvector. The tradeoff is static construction, rank/select dependency, and a cost proportional to bit width. If values are huge but few distinct values appear, coordinate compression can reduce levels, but it must preserve order.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Use the animation's sequence 3 1 4 1 5 0 2 6 and ask for the 3rd smallest value in range [1,7). The raw window is 1, 4, 1, 5, 0, 2. Sorted, it is 0, 1, 1, 2, 4, 5, so the answer is 1 when k is 3 using one-based k.`,
        `The wavelet matrix reaches that answer without extracting and sorting the window. At bit 2, the current interval has enough zero-bit values, so the answer's high bit is 0. At bit 1, the interval again has enough zero-bit values, so the next bit is 0. At bit 0, the kth item falls in the one bucket, so the low bit is 1. The chosen bits 001 give value 1.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Wavelet matrices win for static numeric arrays with many range-order queries: latency percentiles, event severity windows, document metadata, product prices, compressed ids, spatial grids, and text-index internals. They are exact, compact, and especially useful when rank/select machinery is already available.`,
        `They also support more than quantile. Access, rank of a value, range count, predecessor, successor, and top-k style routines can be built from the same level walks, although each operation has its own edge cases.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `A wavelet matrix is not a streaming sketch and not a cheap mutable array. Updates can affect every lower level's order, so frequent edits usually call for batching, rebuilding, or a dynamic variant.`,
        `It is also not always the simplest choice. Small alphabets may be easier to teach or implement with a wavelet tree. Approximate percentile systems may prefer sketches. If coordinate compression does not preserve value order, quantile and predecessor queries become wrong. Hashing values before indexing destroys the ordering the bit walk depends on.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Rank/Select Bitvector first, because every level walk relies on rank. Study Wavelet Tree to understand the recursive version of the same idea. Then compare Merge-Sort Tree Range Counting, Elias-Fano Encoding, and FM-Index with Burrows-Wheeler Transform to see where range-order and rank/select ideas reappear.`,
        `Useful references include Claude and Navarro, The Wavelet Matrix, at https://users.dcc.uchile.cl/~gnavarro/ps/spire12.4.pdf, Navarro, Wavelet Trees for All, at https://users.dcc.uchile.cl/~gnavarro/ps/cpm12.pdf, and Grossi, Gupta, and Vitter text indexing experiments at https://www.ittc.ku.edu/~jsv/Papers/FGGV06.TextindexingExperimentsJournal.pdf.`,
      ],
    },
  ],
};
