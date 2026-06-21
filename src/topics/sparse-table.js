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
    {
      heading: `Why this exists`,
      paragraphs: [
        `A sparse table exists for a narrow but common situation: the data is fixed, and the program must answer many range queries quickly. The array might be an Euler tour depth list for lowest common ancestor, a suffix-array support table, an immutable metric series, or an offline dataset used by many queries.`,
        {type: `callout`, text: `Sparse table speed comes from algebra: idempotence makes overlapping cached windows safe.`},
        `If the array never changes, every repeated scan is wasted work. The sparse table spends time once to precompute answers for carefully chosen windows. After that, each range-minimum query can be answered with two lookups and one comparison.`,
        `The structure is a good example of choosing a data structure from the shape of the problem. It is not trying to be general. It is trying to be extremely fast for static idempotent range queries, especially range minimum and range maximum.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The obvious approach is to scan the range from left to right and keep the smallest value. That is correct, simple, and often fine for a few queries. Its cost is O(length) per query. If queries overlap heavily, the same elements are inspected again and again.`,
        `A segment tree is the next obvious improvement. It answers range queries in O(log n) and supports updates. That is a powerful trade when the array changes. But if the array is static and the query operation is minimum, the update machinery is unused overhead.`,
        `A prefix array gives O(1) range sums because subtraction removes the part before the range. That trick depends on invertibility. Minimum does not have an inverse: knowing min(0..r) and min(0..l-1) does not reveal min(l..r). The sparse table is the answer when prefix subtraction is impossible but overlap is harmless.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Precompute answers for every power-of-two window. Level 0 stores windows of length 1. Level 1 stores length 2. Level 2 stores length 4. Level k stores length 2^k. The key invariant is table[k][i] equals the minimum of the subarray starting at i with length 2^k.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg`, alt: `Row-major and column-major array storage order`, caption: `A sparse table is a two-dimensional precompute layout: one dimension selects window size, the other selects start position. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Row_and_column_major_order.svg.`},
        `Any query length has a largest power of two inside it. For range [lo, hi], choose k = floor(log2(hi - lo + 1)) and w = 2^k. One length-w window starts at lo. Another length-w window ends at hi. Those two windows cover the whole query range, usually with overlap.`,
        `Overlap is the trick. Minimum is idempotent: min(x, x) = x. If the same index appears in both windows, counting it twice does not change the answer. This is why sparse tables give O(1) range minimum but not ordinary range sum.`,
      ],
    },
    {
      heading: `Build Mechanics`,
      paragraphs: [
        `The build starts with table[0][i] = array[i]. That row is already correct for every length-1 range. Each higher row combines two adjacent half windows from the row below.`,
        `For k > 0, table[k][i] = min(table[k - 1][i], table[k - 1][i + 2^(k - 1)]). The first term is the left half of the window. The second term is the right half. Together they exactly cover the length-2^k window starting at i.`,
        `The build has O(n log n) time because there are log n levels and O(n) starting positions per level. It has O(n log n) space for the same reason. The table is called sparse because it stores only power-of-two window sizes, not every possible interval.`,
      ],
    },
    {
      heading: `Query Mechanics`,
      paragraphs: [
        `To answer [lo, hi], compute len = hi - lo + 1. Then compute k = floor(log2(len)) and w = 2^k. The left answer is table[k][lo]. The right answer is table[k][hi - w + 1]. The result is min(left, right).`,
        `A production implementation usually precomputes floor logs for every length from 1 to n. Then k is a table lookup instead of a floating-point calculation. The query path becomes integer arithmetic, two memory reads, and one operation.`,
        `The two lookup windows need not be disjoint. For length 6, the largest power of two is 4. The left window covers positions lo through lo+3. The right window covers hi-3 through hi. They overlap in the middle, but every index in the query is covered by at least one window.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `The build view shows the doubling rule. Each level is not a new array problem; it is a reuse of the row below. A length-4 minimum is made from two length-2 minima. A length-8 minimum is made from two length-4 minima.`,
        `The query view shows the two-window answer. The selected range is larger than one precomputed block, but two blocks of the largest fitting size cover it. The comparison table at the end separates sparse tables from prefix arrays, Fenwick trees, and segment trees by the algebra each one needs.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The build invariant follows by induction. Level 0 is correct because each entry is a one-element minimum. Assume level k - 1 is correct. A length-2^k window is exactly the union of two adjacent length-2^(k-1) windows, so taking the minimum of their stored answers gives the correct answer for the larger window.`,
        `The query proof uses coverage plus idempotence. Let w be the largest power of two no larger than the query length. The left window covers the beginning of the range. The right window covers the end. Because 2w is at least the query length, the two windows together cover every position from lo to hi.`,
        `If the windows overlap, the overlapped values are considered twice. For minimum, maximum, and gcd, duplicate consideration is harmless. That algebraic fact is the reason the query can use two overlapping blocks instead of a logarithmic decomposition into disjoint blocks.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Take the array [3, 2, -1, 6, 5, 4, -3, 3]. Level 0 is the array itself. Level 1 stores minima of adjacent pairs: min(3, 2), min(2, -1), min(-1, 6), and so on. Level 2 stores minima of length-4 windows by combining two level-1 answers.`,
        `Now ask for the minimum from positions 2 through 7. The range length is 6. floor(log2(6)) is 2, so the lookup window length is 4. The left window is positions 2..5, whose minimum is -1. The right window is positions 4..7, whose minimum is -3. The answer is min(-1, -3) = -3.`,
        `Notice what did not happen. The query did not scan six values. It did not walk a tree. It did not subtract a prefix. It used precomputed windows and the fact that minimum tolerates overlap.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Preprocessing costs O(n log n) time and O(n log n) memory. Query time is O(1). Updates are not supported efficiently. Changing one array element may affect one entry on level 0, two nearby entries on level 1, several entries on higher levels, and many query answers. Rebuilding is usually the honest response to mutation.`,
        `The memory layout matters. Many implementations store table[k][i] by level because build and query naturally address one level at a time. Others store per-index vectors for cache locality in specific workloads. For simple JavaScript, an array of rows is easiest to explain and plenty fast for educational input sizes.`,
        `The log table is small but important. Precomputing logs avoids repeated Math.log calls and avoids subtle floating-point boundary issues. logs[1] = 0, logs[2] = 1, logs[3] = 1, logs[4] = 2, and so on.`,
      ],
    },
    {
      heading: `Algebraic Boundary`,
      paragraphs: [
        `Sparse tables need an operation that is associative and idempotent for the two-overlapping-window O(1) query. Minimum works. Maximum works. GCD works because gcd(x, x) = x. Bitwise AND and OR can also work under the same duplicate-safe rule.`,
        `Sums do not work with this query trick because an overlapped value would be counted twice. XOR does not work with overlapping windows in the same way because duplicate values cancel, changing the answer. For those operations, use prefix arrays, Fenwick trees, segment trees, or a disjoint sparse table depending on whether updates matter and whether the operation is invertible.`,
        `This distinction is the main lesson. Sparse table is not just a table of cached answers. It is a table that exploits a specific algebraic permission: overlapping coverage is allowed because duplicate participation does not change the result.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Define the operation and identity clearly before building. For minimum over numbers, JavaScript Infinity is a natural identity for defensive helper code, but normal sparse-table queries do not need an identity because they always read two valid windows.`,
        `Validate indices at the boundary. Reject empty ranges, negative indices, and hi values beyond the array. Decide whether your public API accepts inclusive [lo, hi] or half-open [lo, hi). Internally, inclusive ranges match the usual sparse table formula, while half-open ranges may match JavaScript slice conventions better.`,
        `Be careful with bit shifts for very large arrays. JavaScript bitwise shifts operate on 32-bit signed integers. For educational arrays this is fine. For huge arrays, compute powers with multiplication or exponentiation and store lengths explicitly.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Sparse tables win for static range minimum, static range maximum, static gcd, lowest common ancestor through Euler tour plus range minimum, suffix-array longest-common-prefix support, immutable telemetry windows, offline analytics, and contest problems with many queries and no updates.`,
        `They also win pedagogically. The structure shows how preprocessing, powers of two, and algebra can collapse query time. It is a clean companion to binary lifting, where powers of two are used for jumps instead of range windows.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `It fails when the array changes frequently. A segment tree or Fenwick tree is usually better if updates are part of the problem. Sparse-table rebuilds are simple but expensive.`,
        `It fails when memory is tight and query count is low. O(n log n) space is a real cost. If there are only a few queries, scanning may be simpler and faster in practice.`,
        `It fails when the operation does not tolerate overlap. If you want sum, average, product, or other non-idempotent results, the classic sparse table query is the wrong tool. The right structure follows from the algebra of the operation, not from the desire for O(1) at any cost.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Segment Tree for dynamic associative queries, Fenwick Tree for invertible prefix algebra, Prefix Sums for static sums, Binary Lifting LCA for another power-of-two table, Disjoint Sparse Table for static associative queries without idempotence, and Sqrt Decomposition for a simpler preprocessing tradeoff.`,
        `A good exercise is to implement range maximum by changing only the operation, then try to implement range sum with the same overlapping query. The failure will make the idempotence requirement concrete.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Answer range minimum queries: given array A, what is min(A[l..r])? Brute force scans l to r, costing O(n) per query. For q queries that is O(nq). Prefix minimum precomputes prefix mins, but min(A[l..r]) cannot be recovered from prefix_min[r] minus prefix_min[l-1] because min is not invertible like sum.`,
        `A segment tree gives O(n) build and O(log n) per query. Good, but can we reach O(1) per query? Sparse table (Bender & Farach-Colton 2000, building on Fischer & Heun 2006) precomputes min for all power-of-two length ranges. Table[i][j] = min of 2^j elements starting at index i. Build: Table[i][0] = A[i]. Table[i][j] = min(Table[i][j-1], Table[i + 2^(j-1)][j-1]).`,
        `Two overlapping ranges of length 2^k cover any range [l,r]: k = floor(log2(r-l+1)). Answer = min(Table[l][k], Table[r - 2^k + 1][k]). Overlapping is fine because min(a, a) = a — idempotent. O(n log n) build, O(1) per query. Works for any idempotent operation: min, max, gcd, bitwise AND/OR. Does not work for sum because overlapping counts elements twice.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Build phase: row 0 copies the input array (each element is its own length-1 window). For each subsequent row k, every entry table[k][i] is computed as min(table[k-1][i], table[k-1][i + 2^(k-1)]). The left half-window and right half-window from the previous row combine into a window twice as long. This continues until 2^k exceeds the array length. Total: O(log n) rows, each with at most n entries, so O(n log n) work.`,
        `Query phase: given range [lo, hi], compute len = hi - lo + 1 and k = floor(log2(len)). Read two precomputed answers: table[k][lo] (the left window, starting at lo with length 2^k) and table[k][hi - 2^k + 1] (the right window, ending at hi with length 2^k). Return min(left, right). The two windows overlap in the middle, but minimum is idempotent, so double-counting changes nothing.`,
        `A production implementation precomputes a log table so floor(log2(len)) is a single array lookup instead of a floating-point call. The entire query path becomes: one subtraction, one table read for k, two table reads for the window answers, and one min. No loops, no recursion, no branching.`,
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        `Array: [3, 1, 4, 1, 5, 9, 2, 6]. Build: Table[i][0] = [3,1,4,1,5,9,2,6]. Table[i][1] (pairs): [min(3,1)=1, min(1,4)=1, min(4,1)=1, min(1,5)=1, min(5,9)=5, min(9,2)=2, min(2,6)=2]. Table[i][2] (quads): [min(1,1)=1, min(1,1)=1, min(1,5)=1, min(1,2)=1, min(5,2)=2]. Table[i][3] (octets): [min(1,2)=1].`,
        `Query min(A[2..6]) (indices 2-6, length 5): k = floor(log2(5)) = 2. Answer = min(Table[2][2], Table[6-4+1][2]) = min(Table[2][2], Table[3][2]) = min(1, 1) = 1. Verify: A[2..6] = [4, 1, 5, 9, 2]. Min = 1. Correct.`,
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        `Space: O(n log n) — n entries times log n power-of-two levels. For n = 10^6: roughly 20 million entries times 4 bytes equals roughly 80 MB. Significant.`,
        `The plus-minus-1 RMQ trick (Bender & Farach-Colton): if adjacent elements differ by exactly plus or minus 1 (true for Euler tour depths in LCA), block the array into chunks of (log n)/2. Within each chunk only 2^((log n)/2) possible patterns exist. Precompute answers for all patterns. Between chunks use a sparse table on chunk minimums. Space: O(n), query: still O(1). This is how O(n)/O(1) LCA works.`,
        `Practical note: sparse table is excellent when the array is static (no updates). If you need updates, use a segment tree instead — it supports point updates in O(log n) while maintaining O(log n) queries. Sparse table has no efficient update mechanism.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Bender & Farach-Colton 2000 (The LCA Problem Revisited) formalized sparse table for RMQ. Fischer & Heun 2006 (Theoretical and Practical Improvements for the RMQ Problem) pushed toward optimal bounds. Gabow et al. 1984 gave an earlier O(n)/O(1) RMQ via Cartesian trees.`,
        `Study next: Segment Tree handles non-idempotent operations like sum and supports updates. Binary Search uses the same log2 that appears in the query formula. LCA reduces to RMQ via Euler tour. Suffix Array uses RMQ for LCP queries. Big-O Growth builds intuition for the O(n log n) / O(1) tradeoff.`,
      ],
    },
],
};
