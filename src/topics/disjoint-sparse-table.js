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
    { heading: 'What it is', paragraphs: [
      'A disjoint sparse table is a static range-query structure for associative operations. It resembles a Sparse Table, but it stores prefix and suffix aggregates inside blocks so every query can be answered by combining two non-overlapping precomputed cells.',
      'That difference matters. Classic Sparse Table gets O(1) range minimum because min is idempotent: overlapping the same element twice is harmless. Disjoint Sparse Table does not overlap, so it can support sum, xor, gcd, min, max, string concatenation, and other associative operations.',
    ] },
    { heading: 'How it works', paragraphs: [
      'For each level, split the array into blocks. Around the midpoint of every block, compute suffix aggregates to the left and prefix aggregates to the right. For a query [l, r], find the highest bit where l and r differ. At that level, l and r lie on opposite sides of a midpoint, so table[level][l] and table[level][r] exactly cover the range.',
      'The result is table[level][l] op table[level][r]. If l equals r, return the single array element. If the operation is not commutative, preserve the order: left aggregate first, right aggregate second.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Preprocessing costs O(n log n) memory and time. Each query costs O(1). The structure is immutable: updates require rebuilding affected levels, which usually defeats the point. Use Segment Tree, Fenwick Tree, or a block decomposition if updates are frequent.',
      'The main bugs are selecting the wrong level, mishandling non-power-of-two sizes, and assuming commutativity. Associativity is enough only if the implementation preserves range order.',
      'The memory tradeoff is intentional. You keep multiple aggregate views of the same array so query code can avoid loops. That makes it a good fit when the array is queried many more times than it is built, and a poor fit for tiny arrays where a loop is simpler and faster.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Suppose an analytics system seals telemetry into immutable hourly segments. Dashboards repeatedly ask for sums, maximums, xor checksums, and custom associative aggregates over time ranges within each sealed segment. A disjoint sparse table can be built once per segment and then answer repeated queries with two memory reads and one combine operation.',
      'This is the same architectural pattern as many storage engines: immutable files make expensive preprocessing attractive. Once a chunk will not change, the data structure can spend more memory to make reads predictable.',
      'The case study also clarifies its boundary. If a dashboard query crosses multiple sealed segments, each segment can answer its local subrange in O(1), and a higher-level index or merge step combines those segment answers. The table solves the in-segment problem, not the whole query planner.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: CP-Algorithms Sparse Table overview, https://cp-algorithms.com/data_structures/sparse-table.html, and the Codeforces Disjoint Sparse Table tutorial, https://codeforces.com/blog/entry/79108. Study Sparse Table, Segment Tree, Prefix Sum, Binary Lifting, and Wavelet Tree next.',
    ] },
  ],
};
