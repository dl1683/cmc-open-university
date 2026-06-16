// Dictionary vectors for copy avoidance: base vectors, index buffers, shared
// selections, join fanout, and nested dictionary peeling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dictionary-vector-copy-avoidance-case-study',
  title: 'Dictionary Vector Copy Avoidance',
  category: 'Systems',
  summary: 'How columnar engines represent filtered, sorted, or joined output as indices into a shared base vector instead of copying repeated values.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dictionary wrap', 'join fanout'], defaultValue: 'dictionary wrap' },
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

function dictGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'base', label: 'base', x: 0.8, y: 4.0, note: notes.base ?? 'values' },
      { id: 'idx', label: 'idx', x: 2.3, y: 4.0, note: notes.idx ?? '0,2,2,4' },
      { id: 'dict', label: 'dict', x: 3.8, y: 4.0, note: notes.dict ?? 'view' },
      { id: 'nulls', label: 'nulls', x: 3.8, y: 2.1, note: notes.nulls ?? 'bitmap' },
      { id: 'expr', label: 'expr', x: 5.3, y: 2.7, note: notes.expr ?? 'peel' },
      { id: 'join', label: 'join', x: 5.3, y: 5.3, note: notes.join ?? 'fanout' },
      { id: 'out', label: 'out', x: 7.1, y: 4.0, note: notes.out ?? 'logical rows' },
      { id: 'copy', label: 'copy?', x: 8.8, y: 4.0, note: notes.copy ?? 'late' },
    ],
    edges: [
      { id: 'e-base-idx', from: 'base', to: 'idx' },
      { id: 'e-idx-dict', from: 'idx', to: 'dict' },
      { id: 'e-base-dict', from: 'base', to: 'dict' },
      { id: 'e-nulls-dict', from: 'nulls', to: 'dict' },
      { id: 'e-dict-expr', from: 'dict', to: 'expr' },
      { id: 'e-dict-join', from: 'dict', to: 'join' },
      { id: 'e-expr-out', from: 'expr', to: 'out' },
      { id: 'e-join-out', from: 'join', to: 'out' },
      { id: 'e-out-copy', from: 'out', to: 'copy' },
    ],
  }, { title });
}

function* dictionaryWrap() {
  yield {
    state: dictGraph('A dictionary vector is a base vector plus an index buffer'),
    highlight: { active: ['base', 'idx', 'dict', 'e-base-idx', 'e-idx-dict', 'e-base-dict'], compare: ['copy'] },
    explanation: 'A dictionary vector does not own a fresh copy of every logical value. It wraps a base vector and uses an index buffer to say which base position appears at each logical row.',
    invariant: 'Logical rows can be reordered or repeated without copying the underlying values.',
  };

  yield {
    state: labelMatrix(
      'Dictionary lookup',
      [
        { id: 'r0', label: 'r0' },
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
      ],
      [
        { id: 'idx', label: 'idx' },
        { id: 'base', label: 'base' },
        { id: 'val', label: 'val' },
      ],
      [
        ['0', 'red', 'red'],
        ['2', 'blue', 'blue'],
        ['2', 'blue', 'blue'],
        ['4', 'gold', 'gold'],
      ],
    ),
    highlight: { active: ['r1:idx', 'r2:idx', 'r1:val', 'r2:val'], found: ['r0:val'] },
    explanation: 'Rows 1 and 2 both point to base index 2. The logical vector has duplicate blue values, but the large string or nested payload can still live once in the base vector.',
  };

  yield {
    state: dictGraph('Filters and sorts can share the same index wrapper', { idx: 'sel/sort', dict: 'wrap', expr: 'read idx' }),
    highlight: { active: ['idx', 'dict', 'expr', 'e-idx-dict', 'e-dict-expr'], compare: ['copy'] },
    explanation: 'Filtering, sorting, unnesting, and projection can all express a new logical row order with indices. Copying can be delayed until an output boundary or avoided entirely if the consumer understands dictionaries.',
  };

  yield {
    state: labelMatrix(
      'Encoding tradeoffs',
      [
        { id: 'flat', label: 'flat' },
        { id: 'const', label: 'const' },
        { id: 'dict', label: 'dict' },
        { id: 'nested', label: 'nested' },
      ],
      [
        { id: 'best', label: 'best' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['scan', 'copy'],
        ['repeat', 'branch'],
        ['filter', 'indir'],
        ['wide', 'peel'],
      ],
    ),
    highlight: { found: ['dict:best', 'nested:best'], compare: ['dict:risk'] },
    explanation: 'Dictionary vectors trade memory traffic for indirection. Good engines peel shared dictionaries when possible so expressions can run over base values and reuse the index map only at the edges.',
  };
}

function* joinFanout() {
  yield {
    state: dictGraph('Join fanout repeats probe rows without copying them', { base: 'probe', idx: '0,0,2', join: 'matches', out: '3 rows' }),
    highlight: { active: ['base', 'idx', 'dict', 'join', 'e-dict-join', 'e-join-out'], compare: ['copy'] },
    explanation: 'A hash join can produce multiple matches for one probe row. Wrapping probe columns in a dictionary lets the output repeat that row by index instead of copying every probe column for every match.',
    invariant: 'Join output cardinality can grow while probe-side storage stays shared.',
  };

  yield {
    state: labelMatrix(
      'Probe fanout',
      [
        { id: 'p0', label: 'p0' },
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
      ],
      [
        { id: 'hits', label: 'hits' },
        { id: 'idx', label: 'idx out' },
      ],
      [
        ['2', '0,0'],
        ['0', '-'],
        ['1', '2'],
        ['3', '3,3,3'],
      ],
    ),
    highlight: { active: ['p0:idx', 'p3:idx'], compare: ['p1:idx'] },
    explanation: 'The output index buffer records fanout: probe row 0 appears twice, row 2 once, row 3 three times. The base vector stays unchanged.',
  };

  yield {
    state: dictGraph('Multiple output columns can share the same index buffer', { base: 'all cols', idx: 'shared', dict: 'many dicts', out: 'aligned' }),
    highlight: { active: ['idx', 'dict', 'out', 'e-idx-dict'], found: ['base'], compare: ['nulls'] },
    explanation: 'If many probe-side columns participate in the join output, each column can be wrapped with the same index buffer. That saves memory and keeps row alignment obvious.',
  };

  yield {
    state: labelMatrix(
      'Complete join case',
      [
        { id: 'build', label: 'build' },
        { id: 'probe', label: 'probe' },
        { id: 'fan', label: 'fanout' },
        { id: 'emit', label: 'emit' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'move', label: 'move' },
      ],
      [
        ['hash', 'buckets'],
        ['batch', 'probe'],
        ['idx', 'repeat'],
        ['dict', 'late copy'],
      ],
    ),
    highlight: { found: ['fan:state', 'emit:move'], compare: ['build:move'] },
    explanation: 'The production pattern is a star-schema join where a fact row can match several dimension rows after expansion. Dictionary output keeps fanout from becoming immediate payload duplication.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dictionary wrap') yield* dictionaryWrap();
  else if (view === 'join fanout') yield* joinFanout();
  else throw new InputError('Pick a dictionary-vector view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A dictionary vector represents a logical column as indices into another vector. It is a copy-avoidance structure: filtering, sorting, unnesting, and join fanout can produce a new logical order without materializing all values into a new flat buffer.',
        'Velox documents dictionary vectors as a base vector plus an indices buffer, used for duplicate-heavy values, filters, sorting, joins, and unnesting: https://facebookincubator.github.io/velox/develop/vectors.html. Apache Arrow defines dictionary-encoded layout in its columnar format: https://arrow.apache.org/docs/format/Columnar.html#dictionary-encoded-layout. Parquet defines dictionary encoding for storage pages at https://parquet.apache.org/docs/file-format/data-pages/encodings/.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The structure has a base vector, an index buffer, logical length, null handling, and sometimes nested wrappers. Logical row i reads base[index[i]]. If two logical rows point to the same base index, the value is reused. If the index order is sorted or filtered, the base remains unchanged.',
        'Dictionary vectors are related to selection vectors but richer. A selection vector usually carries active row positions. A dictionary vector turns those positions into a logical vector object that can pass through expression evaluation, joins, and output operators.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A hash join probes a build table and finds multiple matches for some probe rows. Instead of copying every probe-side string, JSON object, and nested list for each emitted match, the engine builds an index buffer such as [0, 0, 2, 3, 3, 3] and wraps the probe columns. Output rows repeat logically while storage stays shared.',
        'If later operators can peel shared dictionaries, they can run expressions over the base vector once and remap results through the dictionary. That is why dictionary support is a real execution-engine feature rather than a compression afterthought.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Dictionary vectors can stack, and stacked indirection can become expensive. Engines often flatten or peel dictionaries when the indirect cost exceeds the copy savings. Correct null handling is also subtle: nulls can come from the dictionary wrapper, the base vector, or both.',
        'Storage dictionary encoding and execution dictionary vectors are related but not identical. Parquet dictionary pages reduce file size and scan work; execution dictionaries represent logical reshaping during a running query.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Selection Vector Filter Pipeline, Late Materialization Columnar Scan, DuckDB Vectorized Execution Case Study, Velox Unified Execution Engine Case Study, Apache Arrow Columnar Memory Case Study, Parquet Columnar Format Case Study, and SQL Join Algorithms Primer next.',
      ],
    },
  ],
};
