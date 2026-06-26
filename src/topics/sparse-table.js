// Sparse table: precompute power-of-two windows so static idempotent range
// queries, such as range minimum, answer with two overlapping lookups.

import { arrayState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sparse-table',
  title: 'Sparse Table: O(1) Range Minimum',
  category: 'Data Structures',
  summary: 'Precompute power-of-two windows once, then answer static range minima with two overlapping lookups.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build: doubling windows', 'query: two windows, one answer'], defaultValue: 'build: doubling windows' },
  ],
  run,
};

const VALUES = [3, 2, -1, 6, 5, 4, -3, 3];
const N = VALUES.length;
const TABLE = [VALUES.slice()];
for (let k = 1; (1 << k) <= N; k++) {
  const prev = TABLE[k - 1];
  const half = 1 << (k - 1);
  const row = [];
  for (let i = 0; i + (1 << k) <= N; i++) row.push(Math.min(prev[i], prev[i + half]));
  TABLE.push(row);
}

const ids = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, j) => `i${lo + j}`);
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
    explanation: 'Sparse table chooses a narrow contract: the array never changes, but range-minimum queries should be as fast as possible. It precomputes answers for every power-of-two window.',
  };

  for (let k = 1; k < TABLE.length; k++) {
    const half = 1 << (k - 1);
    yield {
      state: arrayState(TABLE[k]),
      highlight: { active: ['i0'], compare: [`i${half < TABLE[k].length ? half : TABLE[k].length - 1}`] },
      explanation: `Level ${k} stores windows of length ${1 << k}. Each slot combines two half windows from level ${k - 1}: min(table[${k - 1}][i], table[${k - 1}][i + ${half}]). Slot 0 covers positions 0..${(1 << k) - 1} and has minimum ${TABLE[k][0]}.`,
      invariant: 'table[k][i] stores the minimum of the length 2^k window starting at i.',
    };
  }
}

function* query() {
  yield {
    state: arrayState(VALUES),
    highlight: { range: ids(QLO, QHI) },
    explanation: `Query positions ${QLO}..${QHI}, length ${QLEN}. Choose k = floor(log2(length)) = ${QK}, so the lookup window length is ${W}. One window is flush left and one is flush right.`,
    invariant: 'Two power-of-two windows of length 2^floor(log2(len)) cover the query range.',
  };

  yield {
    state: arrayState(VALUES),
    highlight: { range: ids(QLO, QLO + W - 1), active: [`i${QLO}`] },
    explanation: `Left lookup: positions ${QLO}..${QLO + W - 1}, precomputed at level ${QK}, minimum ${LEFT}.`,
  };

  yield {
    state: arrayState(VALUES),
    highlight: { range: ids(QHI - W + 1, QHI), active: [`i${QHI - W + 1}`], compare: ids(QHI - W + 1, QLO + W - 1) },
    explanation: `Right lookup: positions ${QHI - W + 1}..${QHI}, minimum ${RIGHT}. The two windows overlap, and that is fine because min(x, x) = x.`,
    invariant: 'Idempotent operations forgive overlap. Disjointness is not required for min.',
  };

  yield {
    state: matrixState({
      title: `min(${LEFT}, ${RIGHT}) = ${ANSWER}`,
      rows: [
        { id: 'prefix', label: 'prefix array' },
        { id: 'sparse', label: 'sparse table' },
        { id: 'fenwick', label: 'Fenwick tree' },
        { id: 'segment', label: 'segment tree' },
      ],
      columns: [{ id: 'query', label: 'query' }, { id: 'update', label: 'update' }, { id: 'needs', label: 'operation must be' }],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
      format: (v) => ['', 'O(1)', 'O(n)', 'invertible', 'O(1)', 'none', 'idempotent', 'O(log n)', 'O(log n) point', 'invertible', 'O(log n)', 'O(log n) range', 'associative'][v],
    }),
    highlight: { active: ['sparse:query', 'sparse:needs'] },
    explanation: `Answer: ${ANSWER}. The important distinction is algebra: sparse tables use idempotence, Fenwick uses invertible prefix algebra, and segment trees use associativity.`,
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
    { heading: 'How to read the animation', paragraphs: ['Active cells are cached power-of-two ranges. Compare cells are the two ranges whose answers cover the query.', {type: 'callout', text: 'Sparse table speed comes from algebra: idempotence makes overlapping cached windows safe.'}, 'A green answer is safe only because overlap cannot change minimum. If the operation counted duplicates, this animation would be wrong.', {type: 'image', src: './assets/gifs/sparse-table.gif', alt: 'Animated walkthrough of the sparse table visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['A range-minimum query asks for the smallest value between two indices. When the array is fixed and queries repeat, scanning throws away work that could be cached.'], },
    { heading: 'The obvious approach', paragraphs: ['The direct approach scans lo through hi and keeps the smallest value. It is correct and simple, but it costs the full range length every time.'], },
    { heading: 'The wall', paragraphs: ['A hundred thousand queries over ten thousand cells each means about one billion inspections. Prefix tricks do not save minimum because minimum has no subtraction step.'], },
    { heading: 'The core insight', paragraphs: ['Precompute every power-of-two window. Any query can be covered by one cached window from the left and one cached window from the right.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row-major and column-major array storage order', caption: 'A sparse table is a two-dimensional precompute layout: one dimension selects window size, the other selects start position. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Row_and_column_major_order.svg.'}], },
    { heading: 'How it works', paragraphs: ['Row 0 stores single values. Row k stores a length 2 to the k answer by combining two adjacent half-size answers from row k minus 1.'], },
    { heading: 'Why it works', paragraphs: ['The build is correct by induction because each larger window is exactly two smaller adjacent windows. The query is correct because the two chosen windows cover every index, and minimum ignores duplicate coverage.'], },
    { heading: 'Cost and complexity', paragraphs: ['Build time and space are O(n log n), while each query is O(1). For n = 1,000,000, about 20 levels means roughly 20,000,000 cached answers, so memory is the real tax.'], },
    { heading: 'Real-world uses', paragraphs: ['Sparse tables fit static minimum, maximum, gcd, suffix-array LCP support, and Euler-tour LCA reductions. The common condition is many queries over fixed data.'], },
    { heading: 'Where it fails', paragraphs: ['It fails when values update often because many cached windows become stale. It also fails for sums and averages because overlapping windows would double-count values.'], },
    { heading: 'Worked example', paragraphs: ['For [3, 2, -1, 6, 5, 4, -3, 3], query indices 2 through 7. Length 6 chooses window length 4; the left window 2..5 has -1 and the right window 4..7 has -3, so the answer is -3.'], },
    { heading: 'Sources and study next', paragraphs: ['Study Bender and Farach-Colton on LCA, Fischer and Heun on RMQ, and CP-Algorithms sparse table notes. Then compare Prefix Sums, Fenwick Tree, Segment Tree, Disjoint Sparse Table, and Binary Lifting.'], },
  ],
};
