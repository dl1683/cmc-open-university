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
  yield {
    state: matrixState({
      title: 'Static array',
      rows: [{ id: 'a', label: 'A[i]' }],
      columns,
      values: [[5, 2, 7, 1, 4, 6, 3, 8]],
      format: String,
    }),
    highlight: { active: ['a:i0', 'a:i1', 'a:i2', 'a:i3', 'a:i4', 'a:i5', 'a:i6', 'a:i7'] },
    explanation: 'A disjoint sparse table is for immutable arrays and associative operations such as min, max, gcd, xor, sum, or string concatenation. It spends preprocessing to make every later query constant time.',
    invariant: 'The operation must be associative: (a op b) op c equals a op (b op c).',
  };

  yield {
    state: labelMatrix(
      'Level 2 splits blocks around their middle',
      [{ id: 'l2', label: 'block size 4' }],
      columns,
      [['suffix 0..1', 'suffix 1..1', 'prefix 2..2', 'prefix 2..3', 'suffix 4..5', 'suffix 5..5', 'prefix 6..6', 'prefix 6..7']],
    ),
    highlight: { active: ['l2:i0', 'l2:i1', 'l2:i2', 'l2:i3'], compare: ['l2:i4', 'l2:i5', 'l2:i6', 'l2:i7'] },
    explanation: 'Each level partitions the array into blocks. Inside a block, store suffix aggregates on the left side of the midpoint and prefix aggregates on the right side. Any range crossing the midpoint can be answered by one suffix and one prefix.',
  };

  yield {
    state: labelMatrix(
      'Levels choose larger crossing blocks',
      [
        { id: 'l1', label: 'level 1' },
        { id: 'l2', label: 'level 2' },
        { id: 'l3', label: 'level 3' },
      ],
      [{ id: 'block', label: 'block size' }, { id: 'covers', label: 'covers ranges that split at' }],
      [
        ['2', 'neighbor pairs'],
        ['4', 'middle bit differs at 2'],
        ['8', 'middle bit differs at 4'],
      ],
    ),
    highlight: { active: ['l2:block', 'l3:covers'], found: ['l1:covers'] },
    explanation: 'For query [l, r], pick the highest bit where l and r differ. That level has a block whose midpoint separates l and r, so the answer is table[level][l] op table[level][r].',
    invariant: 'The selected level makes the two precomputed aggregates disjoint and complete.',
  };

  yield {
    state: labelMatrix(
      'Compared with classic Sparse Table',
      [
        { id: 'classic', label: 'Sparse Table' },
        { id: 'disjoint', label: 'Disjoint Sparse Table' },
        { id: 'segment', label: 'Segment Tree' },
        { id: 'prefix', label: 'Prefix Sum' },
      ],
      [{ id: 'query', label: 'query' }, { id: 'operation', label: 'operation fit' }],
      [
        ['O(1) for idempotent ops', 'min/max/gcd overlap safely'],
        ['O(1) for associative ops', 'sum/xor/concat allowed'],
        ['O(log n)', 'updates allowed'],
        ['O(1)', 'invertible cumulative ops'],
      ],
    ),
    highlight: { found: ['disjoint:query', 'disjoint:operation'], compare: ['segment:query'] },
    explanation: 'Classic Sparse Table answers min/max in O(1) by overlapping ranges, which only works for idempotent operations. Disjoint Sparse Table avoids overlap, so associativity is enough.',
  };
}

function* rangeQuery() {
  yield {
    state: labelMatrix(
      'Query sum over [1, 6]',
      [{ id: 'q', label: 'query' }],
      columns,
      [['outside', 'l=1', 'inside', 'inside', 'inside', 'inside', 'r=6', 'outside']],
    ),
    highlight: { active: ['q:i1', 'q:i2', 'q:i3', 'q:i4', 'q:i5', 'q:i6'], compare: ['q:i0', 'q:i7'] },
    explanation: 'The query endpoints 1 and 6 differ first at a high bit that selects the block covering 0..7. The midpoint separates the range into [1..3] and [4..6].',
  };

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
        ['A[1..3]', '2 + 7 + 1 = 10'],
        ['A[4..6]', '4 + 6 + 3 = 13'],
        ['left + right', '23'],
        ['sum[1..6]', '23'],
      ],
    ),
    highlight: { active: ['left:value', 'right:value'], found: ['answer:value'] },
    explanation: 'The two table cells do not overlap. That is the whole trick. Because the operation is associative, leftAggregate op rightAggregate is exactly the range answer.',
    invariant: 'No element is counted twice and no element is skipped.',
  };

  yield {
    state: labelMatrix(
      'Case study: immutable analytics segment',
      [
        { id: 'load', label: 'load segment' },
        { id: 'build', label: 'build table' },
        { id: 'query', label: 'serve dashboards' },
        { id: 'rotate', label: 'new segment' },
      ],
      [{ id: 'work', label: 'work' }, { id: 'reason', label: 'reason' }],
      [
        ['append closes file', 'data no longer changes'],
        ['O(n log n)', 'paid once'],
        ['O(1) ranges', 'many repeated reads'],
        ['build next table', 'avoid update complexity'],
      ],
    ),
    highlight: { found: ['query:work'], active: ['build:reason'], compare: ['rotate:work'] },
    explanation: 'Disjoint sparse tables are natural for immutable chunks: log segments, OLAP fragments, precomputed telemetry windows, and competitive-programming static arrays. If data changes, use a Segment Tree instead.',
  };

  yield {
    state: labelMatrix(
      'Implementation checklist',
      [
        { id: 'size', label: 'power of two' },
        { id: 'bit', label: 'highest differing bit' },
        { id: 'identity', label: 'single element' },
        { id: 'order', label: 'operation order' },
      ],
      [{ id: 'detail', label: 'detail' }, { id: 'bug', label: 'bug to avoid' }],
      [
        ['pad or handle ragged end', 'reading past array'],
        ['floor(log2(l xor r))', 'wrong level'],
        ['return A[l]', 'combining empty range'],
        ['left op right', 'breaking non-commutative ops'],
      ],
    ),
    highlight: { active: ['bit:detail', 'order:detail'], found: ['identity:bug'] },
    explanation: 'The table works for associative operations, not necessarily commutative ones. For string concatenation, matrix multiplication, or function composition, left-to-right order must be preserved.',
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
      heading: 'Why this exists',
      paragraphs: [
        'A disjoint sparse table is for static range queries. You have an array that will not change, an associative operation, and many queries like "combine A[l] through A[r]." You are willing to spend preprocessing time and memory so each later query is constant time.',
        'It exists because the classic sparse table has a narrow trick. A normal sparse table answers range minimum or maximum in O(1) by combining two overlapping blocks. Overlap is harmless for idempotent operations such as min, max, and gcd. It is not harmless for sum, product, string concatenation, matrix multiplication, or function composition.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is to precompute answers for powers of two, then answer a query with two blocks. For range minimum over [l, r], choose the largest power-of-two block length that fits, take one block starting at l and one block ending at r, and combine them. If they overlap, the minimum is still correct.',
        'The wall appears the moment overlap changes the answer. For sum, overlapping an element counts it twice. For string concatenation, overlap duplicates characters. For matrix multiplication or function composition, overlap and order both matter. A normal sparse table is O(1) only because idempotent operations tolerate the duplicate coverage.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The disjoint sparse table removes overlap by choosing the level where the query endpoints split around a midpoint. At that level, the table has already stored a suffix aggregate from l up to the midpoint side and a prefix aggregate from the other side to r.',
        'Those two stored cells are disjoint, ordered, and complete. Because the operation is associative, the table does not need to know how the range was parenthesized. It only needs to preserve left-to-right order and avoid counting any element twice.',
      ],
    },
    {
      heading: 'Reading the two views',
      paragraphs: [
        'In the build-levels view, watch each level divide the array into larger blocks. Inside each block, the left half stores suffix aggregates that run toward the middle, and the right half stores prefix aggregates that run away from the middle. The highlighted cells are not arbitrary labels; they are the future answers for ranges that cross that block midpoint.',
        'In the range-query view, follow the endpoints. For [1, 6], the chosen level is the one whose midpoint separates index 1 from index 6. The answer is the left suffix A[1..3] combined with the right prefix A[4..6]. Two cells, one combine operation, no overlap.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Preprocessing builds levels by block size. For a block, compute aggregates from the midpoint down to the left edge and from the midpoint plus one up to the right edge. Store each aggregate at the index where a future query endpoint might land.',
        'To answer [l, r], first handle the one-element case by returning A[l]. Otherwise compute the highest bit where l and r differ. That bit identifies the level whose block midpoint lies between l and r. Return table[level][l] op table[level][r].',
        'The order matters. The left aggregate must be combined before the right aggregate. The operation may be associative without being commutative, so string concatenation, matrix multiplication, and function composition are valid only if the implementation keeps this order.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For any two different indices l and r, the highest differing bit tells you the largest aligned block in which the endpoints fall on opposite sides of the block midpoint. The preprocessing for that level was designed exactly for ranges that cross that midpoint.',
        'The left table cell covers every element from l to the left side of the midpoint. The right table cell covers every element from the right side of the midpoint to r. The pieces are adjacent. They do not overlap. They do not leave a gap. Associativity lets the two precomputed pieces stand in for the full left-to-right reduction.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use A = [5, 2, 7, 1, 4, 6, 3, 8] and query the sum over [1, 6]. The endpoints 1 and 6 are separated by the midpoint of the whole 0..7 block. The table already stores the suffix A[1..3] = 2 + 7 + 1 = 10 and the prefix A[4..6] = 4 + 6 + 3 = 13.',
        'The answer is 10 + 13 = 23. The table did not loop across six elements. It did not combine overlapping blocks. It used two precomputed cells chosen by the endpoint split.',
        'The same example works for non-commutative operations. If the operation were string concatenation, the left suffix would contain the text from index 1 through 3 in order, the right prefix would contain index 4 through 6 in order, and the query would concatenate left then right.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Preprocessing costs O(n log n) time and memory. Each query costs O(1). That tradeoff makes sense only when the array is static and query volume is high enough to repay the build.',
        'Updates are the main weakness. A single changed element can invalidate aggregates across multiple levels, so a segment tree, Fenwick tree, sqrt decomposition, or rebuilt immutable segment is usually better when data changes often.',
        'The main implementation bugs are selecting the wrong level, mishandling ragged non-power-of-two endings, forgetting the one-element case, and accidentally assuming commutativity. Associativity is the required algebraic property; commutativity is not.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Precompute logs or highest-bit lookup carefully. Query speed depends on finding the level from l xor r without branching through many cases. Handle l == r before that calculation so the single-element range does not read a meaningless level.',
        'For non-power-of-two arrays, either pad with a true identity element or build levels that respect the actual end of the array. Padding is simple only when the operation has an identity value and the implementation never lets that value leak into real answers incorrectly.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'It wins on immutable arrays, sealed log segments, static telemetry windows, offline competitive-programming inputs, and custom aggregate records where queries greatly outnumber builds. It is especially useful when the operation is associative but not idempotent, so a classic sparse table cannot safely overlap blocks.',
        'It fails for frequently updated data, tiny arrays, low query volume, memory-constrained settings, and operations that are not associative. It also does not solve cross-segment planning by itself; if a query spans several immutable chunks, another layer must combine the per-chunk answers.',
        'The most subtle failure is order. Developers often remember that associativity is enough and forget that commutativity is not guaranteed. If the operation is matrix multiplication or string concatenation, the left precomputed cell must be combined before the right one.',
        'A practical implementation should include tests with non-commutative operations. They catch reversed combine order immediately, while sums and minimums can hide the bug.',
      ],
    },
    {
      heading: 'Case study: sealed analytics segments',
      paragraphs: [
        'Suppose an analytics engine writes hourly telemetry segments and never mutates them after sealing. Dashboards repeatedly ask for sums, maximums, xor checksums, and custom associative counters inside each segment. A disjoint sparse table can be built once when the segment seals, then serve each in-segment range with two reads and one combine.',
        'This is the same reason storage engines like immutable files: once a chunk stops changing, expensive preprocessing can buy predictable reads. The disjoint sparse table is not the whole storage engine. It is the range-query accelerator inside one sealed chunk.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: CP-Algorithms Sparse Table overview, https://cp-algorithms.com/data_structures/sparse-table.html, and the Codeforces Disjoint Sparse Table tutorial, https://codeforces.com/blog/entry/79108. Study Sparse Table, Segment Tree, Prefix Sum, Binary Lifting, Fenwick Tree, Sqrt Decomposition, and Wavelet Tree next.',
      ],
    },
  ],
};
