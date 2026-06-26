// Disjoint sparse table: O(1) static range queries for any associative
// operation by storing prefix/suffix aggregates around block middles.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'disjoint-sparse-table',
  title: 'Disjoint Sparse Table',
  category: 'Data Structures',
  summary: 'Answer static range queries in O(1) for any associative operation by combining two precomputed disjoint halves.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build levels', 'range query'], defaultValue: 'build levels' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

const columns = Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, label: String(i) }));

function* buildLevels() {
  const arr = [5, 2, 7, 1, 4, 6, 3, 8];
  yield {
    state: matrixState({
      title: 'Static array',
      rows: [{ id: 'a', label: 'A[i]' }],
      columns,
      values: [arr],
      format: String,
    }),
    highlight: { active: columns.map(c => `a:${c.id}`) },
    explanation: `A disjoint sparse table is for immutable arrays of ${arr.length} elements (${arr.join(', ')}) and associative operations such as min, max, gcd, xor, sum, or string concatenation. It spends preprocessing to make every later query constant time.`,
    invariant: `The operation over ${arr.length} elements must be associative: (a op b) op c equals a op (b op c).`,
  };

  yield {
    state: labelMatrix(
      'Level 2 splits blocks around their middle',
      [{ id: 'l2', label: 'block size 4' }],
      columns,
      [['suffix 0..1', 'suffix 1..1', 'prefix 2..2', 'prefix 2..3', 'suffix 4..5', 'suffix 5..5', 'prefix 6..6', 'prefix 6..7']],
    ),
    highlight: { active: ['l2:i0', 'l2:i1', 'l2:i2', 'l2:i3'], compare: ['l2:i4', 'l2:i5', 'l2:i6', 'l2:i7'] },
    explanation: `Each level partitions the ${columns.length}-element array into blocks. Inside a block, store suffix aggregates on the left side of the midpoint and prefix aggregates on the right side. Any range crossing the midpoint can be answered by one suffix and one prefix.`,
  };

  const levels = [
    { id: 'l1', label: 'level 1' },
    { id: 'l2', label: 'level 2' },
    { id: 'l3', label: 'level 3' },
  ];
  const blockSizes = [2, 4, 8];
  yield {
    state: labelMatrix(
      'Levels choose larger crossing blocks',
      levels,
      [{ id: 'block', label: 'block size' }, { id: 'covers', label: 'covers ranges that split at' }],
      [
        [String(blockSizes[0]), 'neighbor pairs'],
        [String(blockSizes[1]), 'middle bit differs at 2'],
        [String(blockSizes[2]), 'middle bit differs at 4'],
      ],
    ),
    highlight: { active: ['l2:block', 'l3:covers'], found: ['l1:covers'] },
    explanation: `For query [l, r] over ${columns.length} elements, pick the highest bit where l and r differ across ${levels.length} levels (block sizes ${blockSizes.join(', ')}). That level has a block whose midpoint separates l and r, so the answer is table[level][l] op table[level][r].`,
    invariant: `The selected level from ${levels.length} options makes the two precomputed aggregates disjoint and complete.`,
  };

  const alternatives = [
    { id: 'classic', label: 'Sparse Table' },
    { id: 'disjoint', label: 'Disjoint Sparse Table' },
    { id: 'segment', label: 'Segment Tree' },
    { id: 'prefix', label: 'Prefix Sum' },
  ];
  yield {
    state: labelMatrix(
      'Compared with classic Sparse Table',
      alternatives,
      [{ id: 'query', label: 'query' }, { id: 'operation', label: 'operation fit' }],
      [
        ['O(1) for idempotent ops', 'min/max/gcd overlap safely'],
        ['O(1) for associative ops', 'sum/xor/concat allowed'],
        ['O(log n)', 'updates allowed'],
        ['O(1)', 'invertible cumulative ops'],
      ],
    ),
    highlight: { found: ['disjoint:query', 'disjoint:operation'], compare: ['segment:query'] },
    explanation: `Among ${alternatives.length} structures (${alternatives.map(a => a.label).join(', ')}), classic Sparse Table answers min/max in O(1) by overlapping ranges, which only works for idempotent operations. ${alternatives[1].label} avoids overlap, so associativity is enough.`,
  };
}

function* rangeQuery() {
  const queryL = 1;
  const queryR = 6;
  const queryLen = queryR - queryL + 1;
  yield {
    state: labelMatrix(
      `Query sum over [${queryL}, ${queryR}]`,
      [{ id: 'q', label: 'query' }],
      columns,
      [['outside', `l=${queryL}`, 'inside', 'inside', 'inside', 'inside', `r=${queryR}`, 'outside']],
    ),
    highlight: { active: ['q:i1', 'q:i2', 'q:i3', 'q:i4', 'q:i5', 'q:i6'], compare: ['q:i0', 'q:i7'] },
    explanation: `The query endpoints ${queryL} and ${queryR} (${queryLen} elements) differ first at a high bit that selects the block covering 0..${columns.length - 1}. The midpoint separates the range into [${queryL}..3] and [4..${queryR}].`,
  };

  const leftSum = 10;
  const rightSum = 13;
  const totalSum = leftSum + rightSum;
  yield {
    state: labelMatrix(
      'Combine two disjoint precomputed cells',
      [
        { id: 'left', label: 'left suffix' },
        { id: 'right', label: 'right prefix' },
        { id: 'combine', label: 'combine' },
        { id: 'answer', label: 'answer' },
      ],
      [{ id: 'range', label: 'range' }, { id: 'value', label: 'value' }],
      [
        [`A[${queryL}..3]`, `2 + 7 + 1 = ${leftSum}`],
        [`A[4..${queryR}]`, `4 + 6 + 3 = ${rightSum}`],
        ['left + right', String(totalSum)],
        [`sum[${queryL}..${queryR}]`, String(totalSum)],
      ],
    ),
    highlight: { active: ['left:value', 'right:value'], found: ['answer:value'] },
    explanation: `The two table cells do not overlap. That is the whole trick. Left suffix = ${leftSum}, right prefix = ${rightSum}, total = ${totalSum}. Because the operation is associative, leftAggregate op rightAggregate is exactly the range answer.`,
    invariant: `No element in the ${queryLen}-element range is counted twice and no element is skipped.`,
  };

  const caseRows = [
    { id: 'load', label: 'load segment' },
    { id: 'build', label: 'build table' },
    { id: 'query', label: 'serve dashboards' },
    { id: 'rotate', label: 'new segment' },
  ];
  yield {
    state: labelMatrix(
      'Case study: immutable analytics segment',
      caseRows,
      [{ id: 'work', label: 'work' }, { id: 'reason', label: 'reason' }],
      [
        ['append closes file', 'data no longer changes'],
        ['O(n log n)', 'paid once'],
        ['O(1) ranges', 'many repeated reads'],
        ['build next table', 'avoid update complexity'],
      ],
    ),
    highlight: { found: ['query:work'], active: ['build:reason'], compare: ['rotate:work'] },
    explanation: `Disjoint sparse tables follow a ${caseRows.length}-phase lifecycle (${caseRows.map(r => r.label).join(', ')}), natural for immutable chunks: log segments, OLAP fragments, precomputed telemetry windows, and competitive-programming static arrays of ${columns.length} or more elements. If data changes, use a Segment Tree instead.`,
  };

  const checkRows = [
    { id: 'size', label: 'power of two' },
    { id: 'bit', label: 'highest differing bit' },
    { id: 'identity', label: 'single element' },
    { id: 'order', label: 'operation order' },
  ];
  yield {
    state: labelMatrix(
      'Implementation checklist',
      checkRows,
      [{ id: 'detail', label: 'detail' }, { id: 'bug', label: 'bug to avoid' }],
      [
        ['pad or handle ragged end', 'reading past array'],
        ['floor(log2(l xor r))', 'wrong level'],
        ['return A[l]', 'combining empty range'],
        ['left op right', 'breaking non-commutative ops'],
      ],
    ),
    highlight: { active: ['bit:detail', 'order:detail'], found: ['identity:bug'] },
    explanation: `The ${checkRows.length} implementation checks (${checkRows.map(r => r.label).join(', ')}) ensure the table works for associative operations, not necessarily commutative ones. For string concatenation, matrix multiplication, or function composition, left-to-right order must be preserved.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build levels') yield* buildLevels();
  else if (view === 'range query') yield* rangeQuery();
  else throw new InputError('Pick a disjoint-sparse-table view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The build-levels view shows how each level partitions the array into blocks and fills in suffix and prefix aggregates around each block\'s midpoint. Active cells mark the aggregates currently being computed. Found cells mark aggregates that are complete and ready for future queries.',
        {
          type: 'callout',
          text: 'The disjoint sparse table buys O(1) queries by precomputing the exact two halves every crossing range will need.',
        },
        'The range-query view shows a concrete query. It highlights the two endpoints, identifies which level\'s midpoint separates them, and pulls the two precomputed cells that combine into the answer. Compare cells show elements outside the query range. Watch how the answer comes from exactly two table lookups and one combine operation -- no loop, no overlap.',
        'At each frame, track three things: which block is being processed, which direction the aggregate runs (suffix toward midpoint vs. prefix away from midpoint), and which elements contribute. The invariant line under each frame states the structural guarantee that makes the step correct.',
        {type: 'image', src: './assets/gifs/disjoint-sparse-table.gif', alt: 'Animated walkthrough of the disjoint sparse table visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A disjoint sparse table solves this problem: given an array that never changes and an associative binary operation, answer arbitrary range queries in O(1) time after O(n log n) preprocessing. The operation can be sum, product, min, max, gcd, xor, string concatenation, matrix multiplication, or function composition -- anything where (a op b) op c equals a op (b op c).',
        'The classic sparse table already achieves O(1) range queries, but only for idempotent operations like min, max, and gcd. It works by overlapping two power-of-two blocks that together cover the query range. For min, applying the operation to an element twice is harmless -- min(x, x) = x. For sum, overlapping double-counts elements and gives wrong answers.',
        'The disjoint sparse table was invented to extend O(1) static range queries beyond idempotent operations. It eliminates overlap entirely, so the only algebraic requirement is associativity. This makes it the go-to structure when you need constant-time queries over non-idempotent, non-invertible operations on static data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest idea is prefix sums. Build a prefix array where prefix[i] = A[0] op A[1] op ... op A[i-1]. Then range [l, r] equals prefix[r+1] "minus" prefix[l]. For addition, subtraction undoes the prefix. For xor, xor undoes itself. But for min, max, gcd, string concatenation, and matrix multiplication, there is no inverse operation. Prefix sums only work when the operation is invertible.',
        'The next idea is a classic sparse table. Precompute table[k][i] = the result of combining 2^k consecutive elements starting at index i. To query [l, r], find the largest k such that 2^k fits inside the range, then combine table[k][l] and table[k][r - 2^k + 1]. These two blocks overlap in the middle, but for idempotent operations the overlap is harmless.',
        'For non-idempotent operations, neither approach gives O(1). Prefix sums fail without inverses. Classic sparse tables fail without idempotency. A segment tree handles any associative operation but costs O(log n) per query. The gap -- O(1) queries for arbitrary associative operations on static data -- is exactly what the disjoint sparse table fills.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is overlap. A classic sparse table covers [l, r] with two blocks that share elements in the middle. For range sum on A = [5, 2, 7, 1], querying [0, 3] with blocks [0..1] and [2..3] works because they do not overlap. But querying [0, 2] forces blocks [0..1] and [1..2], which both include index 1. The sum becomes (5+2) + (2+7) = 16 instead of the correct 14. The element A[1] = 2 was counted twice.',
        'You might try to subtract the overlap, but that requires an inverse operation. You might try to pick non-overlapping blocks, but there is no guarantee two power-of-two blocks can tile an arbitrary range without gaps or overlaps. The fundamental issue is that power-of-two blocks starting at arbitrary indices are not disjoint partitions of every possible query range.',
        'This is not a minor inconvenience. It means the entire class of non-idempotent, non-invertible associative operations -- including string concatenation, matrix multiplication, function composition, and arbitrary monoid products -- cannot use the classic sparse table at all. Without a new structural idea, O(log n) from a segment tree is the best you can do.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of precomputing aggregates for power-of-two windows starting at each index, precompute aggregates anchored at block midpoints. At each level k, partition the array into aligned blocks of size 2^k. Inside each block, store suffix aggregates running leftward from the midpoint and prefix aggregates running rightward from the midpoint. Any range [l, r] that crosses a block midpoint can be answered by combining the suffix ending at l with the prefix ending at r.',
        {
          type: 'image',
          src: 'https://codeforces.com/predownloaded/a0/06/a0062d5909d856f50fe9e7d3cdc1acb4ffb45173.png',
          alt: 'Disjoint sparse table visualization showing original array levels and precomputed blocks',
          caption: 'Disjoint sparse table visualization with precomputed blocks for constant-time range queries. Source: Codeforces blog by peltorator, https://codeforces.com/blog/entry/87940.',
        },
        'The key guarantee: the suffix covers elements from l to the midpoint, and the prefix covers elements from the midpoint+1 to r. These two pieces share no elements and leave no gaps. The coverage is disjoint and complete, so the combined result is exactly the aggregate over [l, r] regardless of whether the operation is idempotent or commutative.',
        'Finding which level to use takes O(1) via a bit trick. Compute l XOR r -- the result has a 1-bit at every position where l and r differ. The highest set bit of that XOR identifies the smallest aligned block whose midpoint separates l and r. That bit position directly indexes into the table.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Preprocessing: for each level k from 1 to floor(log2(n)), the block size is 2^k. Walk through blocks of that size. For each block, find its midpoint m. Starting at m, accumulate the operation leftward: table[k][m] = A[m], table[k][m-1] = A[m-1] op A[m], table[k][m-2] = A[m-2] op A[m-1] op A[m], and so on to the left edge. These are suffix aggregates. Then starting at m+1, accumulate rightward: table[k][m+1] = A[m+1], table[k][m+2] = A[m+1] op A[m+2], and so on to the right edge. These are prefix aggregates.',
        'For a concrete 8-element array, there are 3 levels. Level 1 has block size 2 (four blocks: [0,1], [2,3], [4,5], [6,7]). Level 2 has block size 4 (two blocks: [0..3], [4..7]). Level 3 has block size 8 (one block: [0..7]). Each block stores suffix aggregates in its left half and prefix aggregates in its right half.',
        'Query: given [l, r], if l equals r, return A[l]. Otherwise compute l XOR r. The highest set bit of that value tells you which level to use. The answer is table[level][l] op table[level][r]. Two table lookups, one combine, done.',
        'The order of the combine matters. table[level][l] is the suffix aggregate covering elements from l through the midpoint. table[level][r] is the prefix aggregate covering elements from midpoint+1 through r. Left must come before right. For commutative operations like sum this does not matter, but for string concatenation or matrix multiplication, reversing the order gives the wrong answer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has three parts. First, for any l < r, the XOR l ^ r has at least one set bit. The highest set bit corresponds to a level where l and r fall in the same block but on opposite sides of the midpoint. Specifically, if the highest set bit is bit position p, then l and r agree on all bits above p and differ at bit p. This means they lie in the same block of size 2^(p+1), with the midpoint exactly at the boundary where bit p flips.',
        'Second, the suffix aggregate stored at table[level][l] covers exactly the elements A[l], A[l+1], ..., A[mid], and the prefix aggregate at table[level][r] covers exactly A[mid+1], A[mid+2], ..., A[r]. These two index ranges partition [l, r] with no overlap and no gap. Every element is counted exactly once.',
        'Third, because the operation is associative, the aggregate over [l, r] equals (A[l] op ... op A[mid]) op (A[mid+1] op ... op A[r]). The parenthesization does not matter -- associativity guarantees the same result regardless of how we group the sub-expressions. So the precomputed suffix combined with the precomputed prefix gives the exact answer.',
        'This argument does not require idempotency (no element is duplicated, so overlap tolerance is irrelevant), commutativity (left always comes before right), or invertibility (no "undo" step is needed). Pure associativity suffices.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preprocessing time is O(n log n). There are O(log n) levels, and each level processes every element exactly once. Space is also O(n log n): the table has O(log n) rows, each of length n. For an array of 1 million elements, that is roughly 20 million stored values -- substantial but manageable.',
        'Query time is O(1). Computing l XOR r, finding the highest set bit (a single CPU instruction on modern hardware via __builtin_clz or equivalent), and two table lookups plus one combine. No loops, no recursion, no branching beyond the l == r base case.',
        'The structure is strictly static. There is no update operation. Changing a single element A[i] invalidates the suffix and prefix aggregates of every block that contains i, across all O(log n) levels. Rebuilding costs O(n log n), the same as building from scratch. If updates are needed, a segment tree (O(log n) per update and query) or a Fenwick tree (O(log n) for invertible operations) is the right choice.',
        'Compared to alternatives: prefix sums give O(n) space and O(1) queries but require invertibility. Classic sparse tables give O(n log n) space and O(1) queries but require idempotency. Segment trees give O(n) space and O(log n) queries but support updates. The disjoint sparse table occupies the unique niche of O(1) queries for any associative operation on static data.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Competitive programming is the primary domain. Problems that give a static array and demand many range queries under a non-idempotent operation (range sum, range product, range xor) benefit directly. The O(1) query time can make the difference between passing and exceeding a time limit when query counts reach 10^6 or more.',
        'In systems engineering, sealed log segments and immutable OLAP fragments fit the pattern. An analytics engine writes an hourly telemetry chunk, seals it, and never mutates it again. Building a disjoint sparse table over the sealed chunk lets dashboards answer arbitrary in-chunk range queries with two lookups. The O(n log n) build cost is paid once; the O(1) query cost is paid millions of times.',
        'The structure is also useful for non-commutative aggregates that most data structures handle awkwardly. Matrix chain products over a fixed sequence, function composition lookups over a static pipeline, and monoid-valued range queries all work correctly because the disjoint sparse table preserves left-to-right order without requiring commutativity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Any mutation kills it. A single element change can invalidate aggregates across every level, and there is no efficient partial rebuild. If data changes even occasionally, use a segment tree. If the operation is invertible (like addition), a Fenwick tree gives O(log n) updates and queries with less code and less memory.',
        'Non-associative operations cannot use this structure. Median, mode, and percentile are not associative -- combining the median of [l, mid] with the median of [mid+1, r] does not yield the median of [l, r]. For these, you need merge-sort trees, wavelet trees, or offline algorithms.',
        'The O(n log n) memory cost can be prohibitive on constrained devices or for very large arrays. For a 10-million-element array, the table holds roughly 230 million values. If queries are infrequent, the preprocessing cost is wasted -- a simple O(r - l) scan may be faster in practice.',
        'The subtlest failure is combine order. For non-commutative operations, the left suffix must be combined before the right prefix. A test suite that only checks sum or min will not catch a reversed combine, because those operations are commutative. Always include a non-commutative test case (e.g., string concatenation) to verify correctness.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array A = [5, 2, 7, 1, 4, 6, 3, 8], operation is sum, 8 elements. Build level 2 (block size 4). Block [0..3] has midpoint between index 1 and 2. Suffix aggregates: table[2][1] = A[1] = 2, table[2][0] = A[0] + A[1] = 7. Prefix aggregates: table[2][2] = A[2] = 7, table[2][3] = A[2] + A[3] = 8. Block [4..7]: suffix table[2][5] = 6, table[2][4] = 10. Prefix table[2][6] = 3, table[2][7] = 11.',
        'Build level 3 (block size 8). One block [0..7], midpoint between index 3 and 4. Suffix aggregates: table[3][3] = 1, table[3][2] = 7+1 = 8, table[3][1] = 2+7+1 = 10, table[3][0] = 5+2+7+1 = 15. Prefix aggregates: table[3][4] = 4, table[3][5] = 4+6 = 10, table[3][6] = 4+6+3 = 13, table[3][7] = 4+6+3+8 = 21.',
        'Query sum([1, 6]). Compute 1 XOR 6 = 7 (binary 111). Highest set bit is bit 2, so use level 3. Answer = table[3][1] op table[3][6] = 10 + 13 = 23. Verify: 2 + 7 + 1 + 4 + 6 + 3 = 23. Two lookups, one addition, correct answer.',
        'Query sum([2, 3]). Compute 2 XOR 3 = 1 (binary 001). Highest set bit is bit 0, so use level 1. table[1][2] = A[2] = 7, table[1][3] = A[3] = 1. Answer = 7 + 1 = 8. For a non-commutative operation like string concatenation, the same structure would give concat(table[1][2], table[1][3]) preserving left-to-right order.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The disjoint sparse table was popularized in competitive programming. Key references: the Codeforces blog by peltorator (https://codeforces.com/blog/entry/87940) with clear diagrams, the tutorial by Elegia (https://codeforces.com/blog/entry/79108) with build and query code, and the CP-Algorithms sparse table overview (https://cp-algorithms.com/data_structures/sparse-table.html) for the classic idempotent version that motivates the disjoint variant.',
        'Study Sparse Table next to understand the idempotent-only predecessor and see how overlap works for min/max. Study Segment Tree for the dynamic alternative that supports updates. Study Fenwick Tree for O(log n) prefix-based queries on invertible operations. Study Binary Lifting, which uses the same highest-differing-bit idea to answer tree ancestor queries.',
        'Prerequisites for this topic: prefix sums (the invertible-operation baseline), bitwise operations (the XOR and highest-set-bit trick that selects the query level), and a basic understanding of associativity versus commutativity versus idempotency -- three independent algebraic properties that determine which range-query structure applies.',
      ],
    },
  ],
};
