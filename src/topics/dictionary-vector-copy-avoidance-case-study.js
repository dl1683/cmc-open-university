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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a columnar execution object. The base vector owns the real values, the index buffer maps logical rows to base positions, and the dictionary wrapper presents the result as a normal vector. The safe inference is that logical row i reads base[indices[i]] without copying the payload value.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Columnar engines process batches of values, and many operators only change row order or row multiplicity. A filter keeps some rows, a sort reorders rows, and a join can repeat one probe row several times. Copying large strings, arrays, or nested values after every such operator wastes memory bandwidth.',
        {type:'callout', text:'Dictionary vectors decouple logical row shape from physical value storage, so filters, sorts, and join fanout can move indices before the engine pays to copy payloads.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to materialize a new vector after every operator. If a filter keeps rows 3, 8, and 9, copy those three values into a fresh output vector. This is simple and makes every downstream operator read contiguous data.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is copy amplification. A join that turns one input row into 5 output rows would copy every probe-side column 5 times, even though the values did not change. Wide rows make this cost visible as cache misses, allocator pressure, and memory bandwidth rather than arithmetic.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent the output as an index mapping over a shared base vector. The logical vector has its own row count and null semantics, but its values are addressed through indices. Operators can compose filters, sorts, and fanout by rewriting small integer buffers while leaving large payload buffers alone.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A dictionary vector stores a pointer to a base vector and an indices array. Reading logical row i means reading index j = indices[i], then returning base[j]. Multiple columns can share the same indices array so row alignment is preserved across a projected batch.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is value preservation by indirection. For every non-null logical row i, the exposed value equals base[indices[i]] with the same type and null behavior as a direct base read. Because operators do not mutate the base through dictionary indices, repeated logical rows see one shared immutable value.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Dictionary vectors trade payload copies for index reads. Copying 1 million 80-byte strings would move about 80 MB; copying 1 million 32-bit indices moves about 4 MB. The tax is an extra memory lookup per value and possible loss of locality when indices jump around the base vector.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This is common in vectorized query engines such as Velox-style execution, Arrow-like columnar pipelines, and join-heavy analytical systems. It fits filters, projections, sort views, dictionary-encoded inputs, unnesting, and hash joins with probe-side fanout. It is strongest when payload values are large and index buffers are small.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when indirection costs more than copying. If the base values are tiny, indices are random, or a downstream kernel needs contiguous SIMD-friendly data, materialization can be faster. Deep stacks of dictionaries can also become hard to reason about, so engines often flatten or peel dictionaries at operator boundaries.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a base vector has four customer names: Ann, Bo, Cy, Dee. A join produces matches for probe rows 0, 0, 2, and 3, so the output dictionary indices are [0, 0, 2, 3]. The logical output has 4 rows, but Ann is still stored once in the base vector.',
        'With numbers, assume each full probe row has 12 columns averaging 16 bytes each, or 192 bytes. Repeating one row 6 times by copying costs 1,152 bytes for that row alone, while dictionary fanout stores 6 four-byte indices, or 24 bytes, plus one shared index buffer used by all probe columns. The behavior is the point: output cardinality grows, but probe payload storage does not grow with it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Velox vector encodings, Apache Arrow columnar memory, dictionary encoding, vectorized execution, hash join fanout, and selection vectors. Then compare dictionary vectors with materialized batches and with storage-level dictionary compression. The important distinction is execution-time indirection versus file-format compression.',
      ],
    },
  ],
};
