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
      heading: 'What it is',
      paragraphs: [
        'A wavelet matrix is a compact index over an integer sequence. Like a Wavelet Tree, it represents values by walking bit decisions and supports access, rank, select, range quantile, range counting, predecessor, and successor-style queries. Unlike the tree layout, it stores flat bitvectors level by level and records where the zero bucket ends at each level.',
        'The structure is especially useful when the alphabet is a large integer universe. A pointer-heavy tree is awkward there. The matrix layout uses stable partitions by bit, so the query logic remains rank arithmetic over arrays.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build from the most significant bit to the least significant bit. At a level, write one bit per value. Then stably partition the current order so all values with bit 0 come first and values with bit 1 come after them. Store the number of zeroes for that level. Continue on the new order at the next bit.',
        'To remap an interval [l, r) into the next level, use rank on the level bitvector. The zero child interval is [rank0(l), rank0(r)). The one child interval is [zeroCount + rank1(l), zeroCount + rank1(r)). A query chooses which interval to keep based on the operation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For sigma possible values, most operations take O(log sigma) rank steps, or O(w) for w-bit integers. Space is n times the number of levels, plus rank/select support over each bitvector. In practice, the flat layout often has better locality than recursive node structures.',
        'Compared with Merge-Sort Tree Range Counting, a wavelet matrix is more specialized but can answer range quantile and rank-like questions directly. The merge-sort tree is often easier to explain; the wavelet matrix is usually the cleaner static sequence index once rank/select machinery is available.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a static time-ordered array of request latencies. A dashboard asks for p50, p95, and p99 over arbitrary windows. Sorting each window is too slow, and a Fenwick Tree only aggregates sums. A wavelet matrix treats the latency array as an indexed sequence and answers kth-value queries by deciding one answer bit per level.',
        'The same pattern works for event severities, product prices, compressed IDs, and any numeric sequence where the data is mostly static and queries are value-rank questions inside index ranges. For high-update workloads, use a dynamic structure or batch rebuilds instead.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A wavelet matrix is not a sketch. It gives exact answers for the indexed sequence. It also does not remove the need for rank/select bitvectors; those are the engine. Another trap is assuming it is always better than a Wavelet Tree. For small alphabets or teaching recursive decomposition, the tree can be clearer.',
        'Coordinate compression is often used before building the matrix, but compression must preserve value order if range quantile, predecessor, and successor queries matter. Hashing values destroys the ordering that the bit-level walk is trying to exploit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Claude and Navarro, The Wavelet Matrix, at https://users.dcc.uchile.cl/~gnavarro/ps/spire12.4.pdf, Navarro, Wavelet Trees for All, at https://users.dcc.uchile.cl/~gnavarro/ps/cpm12.pdf, and Grossi, Gupta, and Vitter text indexing experiments at https://www.ittc.ku.edu/~jsv/Papers/FGGV06.TextindexingExperimentsJournal.pdf. Study Wavelet Tree, Rank/Select Bitvector, Merge-Sort Tree Range Counting, Elias-Fano Encoding, and FM-Index & Burrows-Wheeler Transform next.',
      ],
    },
  ],
};
