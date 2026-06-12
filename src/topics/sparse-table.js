// Sparse table: precompute the min of every power-of-two window, and any
// range-minimum query collapses to TWO overlapping lookups — O(1), forever,
// because min doesn't care that the middle got counted twice.

import { arrayState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sparse-table',
  title: 'Sparse Table: O(1) Range Minimum',
  category: 'Data Structures',
  summary: 'Precompute power-of-two windows once, answer every range-min in exactly two overlapping lookups — idempotence makes the double-count free.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build: doubling windows', 'query: two windows, one answer'], defaultValue: 'build: doubling windows' },
  ],
  run,
};

// Same numbers as the Fenwick and Segment Tree pages: [3, 2, -1, 6, 5, 4, -3, 3].
const VALUES = [3, 2, -1, 6, 5, 4, -3, 3];
const N = VALUES.length;
// table[k][i] = min of the window of length 2^k starting at index i (0-based).
const TABLE = [VALUES.slice()];
for (let k = 1; (1 << k) <= N; k++) {
  const prev = TABLE[k - 1];
  const half = 1 << (k - 1);
  const row = [];
  for (let i = 0; i + (1 << k) <= N; i++) row.push(Math.min(prev[i], prev[i + half]));
  TABLE.push(row);
}
const ids = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, j) => `i${lo + j}`);

// The demo query: positions 2…7 (0-based), length 6 → k = 2 (window 4).
const QLO = 2;
const QHI = 7;
const QLEN = QHI - QLO + 1;
const QK = Math.floor(Math.log2(QLEN));
const W = 1 << QK;
const LEFT = TABLE[QK][QLO];
const RIGHT = TABLE[QK][QHI - W + 1];
const ANSWER = Math.min(LEFT, RIGHT);

function* build() {
  yield {
    state: arrayState(VALUES),
    highlight: {},
    explanation: `Third tool on the same eight numbers, third trade. Fenwick Tree (Binary Indexed Tree) and Segment Tree & Lazy Propagation both answer in O(log n) and accept updates. The sparse table makes a harder promise on a narrower contract: if the array NEVER CHANGES, every range-minimum query costs O(1) — not log, constant, two array lookups — after one O(n log n) preprocessing pass. Static data is everywhere (yesterday's logs, a genome, a published dataset), and for it, this is the endgame.`,
  };

  for (let k = 1; k < TABLE.length; k++) {
    const half = 1 << (k - 1);
    yield {
      state: arrayState(TABLE[k]),
      highlight: { active: ['i0'], compare: [`i${half < TABLE[k].length ? half : TABLE[k].length - 1}`] },
      explanation: `Level ${k}: the min of every window of length ${1 << k}. Slot i is computed in O(1) from the level below — min(level${k - 1}[i], level${k - 1}[i + ${half}]): two half-windows that tile the full one exactly. Slot 0 here covers positions 0…${(1 << k) - 1} = ${TABLE[k][0]}. ${k === TABLE.length - 1 ? `That's the whole structure: ${TABLE.length} rows of shrinking length, ~n·log₂(n) = ${TABLE.flat().length} stored values total. The doubling construction is Binary Exponentiation's trick applied to ranges: to know a power-of-two window, combine two windows of half the size.` : `Each level is built from the previous in one sweep — no recursion, no pointers.`}`,
      invariant: 'table[k][i] = min(table[k−1][i], table[k−1][i + 2^(k−1)]): every level is two lookups per slot into the one below.',
    };
  }
}

function* query() {
  yield {
    state: arrayState(VALUES),
    highlight: { range: ids(QLO, QHI) },
    explanation: `Query: minimum of positions ${QLO}…${QHI} — length ${QLEN}, which is NOT a power of two, so no precomputed window fits exactly. The trick that makes the whole structure work: pick k = ⌊log₂(${QLEN})⌋ = ${QK}, the largest power-of-two window (length ${W}) that fits inside the range. TWO such windows — one flush against each end — are guaranteed to COVER the range completely, because each is more than half its length. They will overlap in the middle. Let them.`,
    invariant: 'Two windows of length 2^⌊log₂(len)⌋, one per end, always cover the range: each spans more than half of it.',
  };

  yield {
    state: arrayState(VALUES),
    highlight: { range: ids(QLO, QLO + W - 1), active: [`i${QLO}`] },
    explanation: `Lookup one: the window flush LEFT — positions ${QLO}…${QLO + W - 1}, precomputed at level ${QK}: min = ${LEFT}. One array access, nothing computed.`,
    invariant: 'Lookup 1 = table[k][lo]: the left-anchored power-of-two window, already on the shelf.',
  };

  yield {
    state: arrayState(VALUES),
    highlight: { range: ids(QHI - W + 1, QHI), active: [`i${QHI - W + 1}`], compare: ids(QHI - W + 1, QLO + W - 1) },
    explanation: `Lookup two: the window flush RIGHT — positions ${QHI - W + 1}…${QHI}: min = ${RIGHT}. Notice the highlighted overlap with lookup one: positions ${QHI - W + 1}…${QLO + W - 1} sit in BOTH windows and get examined twice. For a SUM that would be a bug — the overlap would double-count, which is exactly why Fenwick Tree (Binary Indexed Tree) needs disjoint pieces. For MIN it is nothing at all: min(x, x) = x, seeing an element twice changes no answer. The property is IDEMPOTENCE — the same law that lets CRDTs: Conflict-Free Replicated Data Types absorb duplicated merges lets this query ignore its own double-counting.`,
    invariant: 'Idempotent operations forgive overlap: min(x, x) = x, so coverage is all that matters — disjointness is not required.',
  };

  yield {
    state: matrixState({
      title: `min(${LEFT}, ${RIGHT}) = ${ANSWER} — and the complete ladder`,
      rows: [
        { id: 'prefix', label: 'prefix array' },
        { id: 'sparse', label: 'sparse table' },
        { id: 'fenwick', label: 'Fenwick tree' },
        { id: 'segment', label: 'segment tree + lazy' },
      ],
      columns: [{ id: 'query', label: 'query' }, { id: 'update', label: 'update' }, { id: 'needs', label: 'operation must be' }],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
      format: (v) => ['',
        'O(1)', 'O(n) — static only', 'invertible (sums: range = prefix − prefix)',
        'O(1)', 'none — static only', 'idempotent (min/max/gcd — overlap is free)',
        'O(log n)', 'O(log n) point', 'invertible',
        'O(log n)', 'O(log n) RANGE', 'merely associative — the most general',
      ][v],
    }),
    highlight: { active: ['sparse:query', 'sparse:needs'] },
    explanation: `Answer: min(${LEFT}, ${RIGHT}) = ${ANSWER}, in exactly two lookups — the same cost for a range of 6 or 6 million. The ladder is now complete, and it is really a map of algebra to data structures: what your operation CAN do determines what structure you need. Invertible (subtraction exists) → prefix arrays and Fenwick. Idempotent (double-counting is free) → sparse table, O(1) on static data. Merely associative → segment tree, the general worker. The deepest pattern on these four pages: you never chose a data structure at all — you identified which algebraic law your problem satisfies, and the structure followed.`,
    invariant: 'RMQ = min(table[k][lo], table[k][hi−2^k+1]): two lookups, any range — the algebra of the operation picked the structure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build: doubling windows') yield* build();
  else if (view === 'query: two windows, one answer') yield* query();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A sparse table is a 2D array of precomputed answers to every range-minimum query on static data. The name comes from its structure: table[k][i] holds the minimum of a power-of-two window of length 2^k starting at position i. Sparse means it does not store the answer for every possible length — only powers of two. For any range, two overlapping power-of-two windows (one per end) cover it completely, and because min ignores duplicate counts (idempotence), the overlap is free. The payoff: O(1) query time forever, after O(n log n) preprocessing, with no updates allowed. This is the endgame for static data.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Build the table bottom-up by doubling. Start with level 0: table[0][i] = VALUES[i], the minimum of each single element (windows of length 2^0 = 1). For level k, compute table[k][i] = min(table[k−1][i], table[k−1][i + 2^(k−1)]). Each slot combines two windows from the level below whose lengths sum to 2^k. This is Binary Exponentiation's trick applied to ranges: to learn a power-of-two window, build it from two half-size windows. With eight values, the table has ⌊log₂(8)⌋ + 1 = 4 levels, storing 8 + 4 + 2 + 1 = 15 values total, plus the original array: roughly n·log n storage.`,
        `To query a range [lo, hi], let len = hi − lo + 1, and k = ⌊log₂(len)⌋. The window 2^k fits inside [lo, hi]. Place one window at lo (flush left) and another at hi − 2^k + 1 (flush right). These two windows always overlap because each is longer than half the range. Return min(table[k][lo], table[k][hi − 2^k + 1]). Two array lookups, always O(1), no computation.`,
        `Why overlap does not break the answer: min(x, x) = x. Seeing an element in both windows changes its contribution to the final min not at all. The operation is idempotent — the same algebraic property that lets CRDTs: Conflict-Free Replicated Data Types merge duplicate updates safely.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Preprocessing: O(n log n) time, O(n log n) space. Build one level (n cells) at a time, one level per iteration, ⌊log₂(n)⌋ + 1 iterations total. Query: O(1) time, two table lookups and one min. No updates allowed — the moment data changes, the table is stale. This is the hard contract: static data, or the structure fails. Compare to Fenwick Tree (Binary Indexed Tree) and Segment Tree & Lazy Propagation, which accept O(log n) updates. The choice between them rests entirely on algebra: invertible operations (sums) use Fenwick; idempotent operations (min/max/gcd) use sparse table on static data; merely associative operations use Segment Tree.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Sparse tables compute the lowest common ancestor (LCA) of two nodes in a tree via Euler tour: flatten the tree into an array, convert LCA to a range-minimum query on a derived array, answer in O(1) per query. Used in bioinformatics and compiler optimization. Range-minimum queries appear in suffix-array construction (computing LCP — Longest Common Prefix — arrays, which guide BWT and full-text indices). Sliding-window analytics on immutable logs: compute the min value in any historical window without recomputing, essential for monitoring systems analyzing unchanging production data.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Sparse table is NOT a data structure for dynamic ranges — the moment you insert, delete, or update an element, every precomputed window becomes wrong. Do not attempt to patch single cells; rebuild the entire table or switch to Fenwick or Segment Tree. Another trap: the name "sparse" does not mean the table is small. For n = 10^6, you store roughly 20 million values. Memory grows linearly with n, not sublinearly. Finally, sparse tables only work for idempotent queries (min, max, gcd). Sums, products, XOR, or any invertible operation will double-count the overlap and give wrong answers; those operations need prefix arrays or Fenwick.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Segment Tree & Lazy Propagation to see how to handle range updates and queries together. Study Fenwick Tree (Binary Indexed Tree) to learn point updates with O(log n) cost on invertible operations. Revisit Binary Exponentiation to deepen your intuition for the doubling trick — it appears in sparse tables, binary lifting for LCA, and everywhere exponents matter. Strengthen your foundations with Binary Search, which underpins lower_bound queries in many range structures. Together: sparse table is the O(1) query winner on static idempotent data; Fenwick is the O(log n) winner on dynamic invertible data; Segment Tree is the general-purpose associate structure. Algebra picks the data structure.`,
      ],
    },
  ],
};

