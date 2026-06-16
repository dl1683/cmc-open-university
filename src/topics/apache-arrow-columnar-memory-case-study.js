// Apache Arrow standardizes columnar in-memory arrays: schema, record batches,
// per-column buffers, validity bitmaps, offsets, and values.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-arrow-columnar-memory-case-study',
  title: 'Apache Arrow Columnar Memory Case Study',
  category: 'Systems',
  summary: 'Arrow arrays as data structures: record batches, validity bitmaps, offsets buffers, values buffers, and zero-copy columnar interchange.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['array buffers', 'zero-copy interchange'], defaultValue: 'array buffers' },
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

function arrowGraph(title) {
  return graphState({
    nodes: [
      { id: 'schema', label: 'schema', x: 0.8, y: 3.4, note: 'types' },
      { id: 'batch', label: 'batch', x: 2.4, y: 3.4, note: 'rows' },
      { id: 'arrayA', label: 'int array', x: 4.2, y: 5.1, note: 'age' },
      { id: 'arrayB', label: 'str array', x: 4.2, y: 1.7, note: 'name' },
      { id: 'valid', label: 'validity', x: 6.2, y: 5.6, note: 'bitmap' },
      { id: 'values', label: 'values', x: 8.0, y: 5.6, note: 'fixed width' },
      { id: 'offsets', label: 'offsets', x: 6.2, y: 1.2, note: 'starts' },
      { id: 'bytes', label: 'bytes', x: 8.0, y: 1.2, note: 'utf8 data' },
      { id: 'kernel', label: 'kernel', x: 9.2, y: 3.4, note: 'vector op' },
    ],
    edges: [
      { id: 'e-schema-batch', from: 'schema', to: 'batch' },
      { id: 'e-batch-arrayA', from: 'batch', to: 'arrayA' },
      { id: 'e-batch-arrayB', from: 'batch', to: 'arrayB' },
      { id: 'e-arrayA-valid', from: 'arrayA', to: 'valid' },
      { id: 'e-arrayA-values', from: 'arrayA', to: 'values' },
      { id: 'e-arrayB-offsets', from: 'arrayB', to: 'offsets' },
      { id: 'e-arrayB-bytes', from: 'arrayB', to: 'bytes' },
      { id: 'e-values-kernel', from: 'values', to: 'kernel' },
      { id: 'e-valid-kernel', from: 'valid', to: 'kernel' },
    ],
  }, { title });
}

function* arrayBuffers() {
  yield {
    state: arrowGraph('Arrow arrays are typed views over buffers'),
    highlight: { active: ['schema', 'batch', 'arrayA', 'valid', 'values'], compare: ['arrayB', 'offsets', 'bytes'], found: ['kernel'] },
    explanation: 'Apache Arrow stores table-like data as record batches. Each column is an Arrow array, and each array is backed by typed buffers such as validity bitmaps, offsets, and values.',
    invariant: 'Array metadata names length, null count, type, and buffer meaning; buffers hold the bytes.',
  };

  yield {
    state: labelMatrix(
      'Primitive Int32 array',
      [
        { id: 'slot0', label: 'row 0' },
        { id: 'slot1', label: 'row 1' },
        { id: 'slot2', label: 'row 2' },
        { id: 'slot3', label: 'row 3' },
      ],
      [
        { id: 'validity', label: 'valid bit' },
        { id: 'value', label: 'value buffer' },
      ],
      [
        ['1', '42'],
        ['0', 'ignored'],
        ['1', '7'],
        ['1', '9'],
      ],
    ),
    highlight: { active: ['slot0:validity', 'slot1:validity', 'slot2:validity'], found: ['slot1:value'], compare: ['slot3:value'] },
    explanation: 'A primitive nullable array uses a validity bitmap plus a fixed-width value buffer. A null slot can leave arbitrary bytes in the values buffer because the validity bit controls semantics.',
  };

  yield {
    state: labelMatrix(
      'Variable-size string array',
      [
        { id: 'ann', label: 'ann' },
        { id: 'bo', label: 'bo' },
        { id: 'null', label: 'null' },
        { id: 'cy', label: 'cy' },
      ],
      [
        { id: 'validity', label: 'valid bit' },
        { id: 'offsets', label: 'offsets' },
        { id: 'bytes', label: 'data bytes' },
      ],
      [
        ['1', '0..3', 'ann'],
        ['1', '3..5', 'bo'],
        ['0', '5..5', 'ignored'],
        ['1', '5..7', 'cy'],
      ],
    ),
    highlight: { active: ['ann:offsets', 'bo:offsets', 'cy:offsets'], found: ['null:validity'], compare: ['null:bytes'] },
    explanation: 'Variable-size arrays add an offsets buffer. offsets[i] and offsets[i+1] slice the data buffer. The same pattern generalizes to binary values and list-like nested arrays.',
  };

  yield {
    state: labelMatrix(
      'Why this layout is fast',
      [
        { id: 'columnar', label: 'columnar values' },
        { id: 'bitmap', label: 'validity bitmap' },
        { id: 'offsets', label: 'offset buffers' },
        { id: 'batch', label: 'record batch' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'benefit' },
      ],
      [
        ['contiguous typed buffers', 'SIMD-friendly scans'],
        ['one bit per slot', 'compact null checks'],
        ['start/end index pairs', 'no object pointers'],
        ['same row count arrays', 'operator contract'],
      ],
    ),
    highlight: { found: ['columnar:benefit', 'bitmap:benefit', 'offsets:benefit'], compare: ['batch:structure'] },
    explanation: 'The data-structure value is regularity. Kernels can loop over typed buffers and validity words instead of chasing row objects and per-value allocations.',
  };
}

function* zeroCopyInterchange() {
  yield {
    state: arrowGraph('Many engines can share the same column buffers'),
    highlight: { active: ['schema', 'batch', 'values', 'bytes', 'kernel'], found: ['arrayA', 'arrayB'] },
    explanation: 'Arrow is also an interoperability contract. If two systems agree on schema and buffer layout, they can exchange columns without converting every value into a private row representation.',
    invariant: 'Zero-copy sharing still requires lifetime, alignment, and validity guarantees.',
  };

  yield {
    state: labelMatrix(
      'Interchange pipeline',
      [
        { id: 'python', label: 'Python dataframe' },
        { id: 'arrow', label: 'Arrow batch' },
        { id: 'engine', label: 'query engine' },
        { id: 'client', label: 'result consumer' },
      ],
      [
        { id: 'handoff', label: 'handoff' },
        { id: 'cost' },
      ],
      [
        ['export arrays', 'no per-cell JSON'],
        ['schema + buffers', 'shared contract'],
        ['vector kernels', 'scan typed buffers'],
        ['import arrays', 'avoid row decoding'],
      ],
    ),
    highlight: { active: ['arrow:handoff', 'engine:cost'], found: ['client:cost'], compare: ['python:cost'] },
    explanation: 'The win is removing serialization boundaries. A dataframe library, an embedded SQL engine, and an analytics service can agree on buffers rather than copying values through text or row objects.',
  };

  yield {
    state: labelMatrix(
      'Arrow versus Parquet',
      [
        { id: 'arrow', label: 'Arrow' },
        { id: 'parquet', label: 'Parquet' },
        { id: 'duckdb', label: 'DuckDB' },
        { id: 'dremel', label: 'Dremel' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'difference' },
      ],
      [
        ['in-memory arrays', 'fast interchange'],
        ['storage file', 'encoded and compressed'],
        ['execution engine', 'processes vectors/chunks'],
        ['query architecture', 'columnar nested analytics'],
      ],
    ),
    highlight: { active: ['arrow:role', 'parquet:role'], found: ['duckdb:difference'], compare: ['dremel:difference'] },
    explanation: 'Arrow is not Parquet in RAM. Parquet is optimized for durable compressed storage; Arrow is optimized for in-memory processing and interchange.',
  };

  yield {
    state: labelMatrix(
      'Operational caveats',
      [
        { id: 'mutation', label: 'mutation' },
        { id: 'lifetime', label: 'lifetime' },
        { id: 'invalid', label: 'invalid data' },
        { id: 'nested', label: 'nested types' },
      ],
      [
        { id: 'issue', label: 'issue' },
        { id: 'discipline' },
      ],
      [
        ['expensive', 'build new arrays'],
        ['shared buffers', 'ownership rules'],
        ['bad offsets/lengths', 'validate boundaries'],
        ['many buffers', 'respect layout spec'],
      ],
    ),
    highlight: { active: ['lifetime:discipline', 'invalid:discipline'], compare: ['mutation:issue'], found: ['nested:discipline'] },
    explanation: 'A binary memory format moves trust boundaries closer to raw bytes. Correct lengths, offsets, alignment, and lifetime management are part of the data-structure contract.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'array buffers') yield* arrayBuffers();
  else if (view === 'zero-copy interchange') yield* zeroCopyInterchange();
  else throw new InputError('Pick an Arrow memory-layout view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Apache Arrow is a standardized in-memory columnar format. Its basic unit is an Array: a typed logical column backed by one or more buffers. A RecordBatch groups arrays of equal length under a schema. The format is designed so analytical kernels can scan typed buffers directly and systems can exchange data without per-cell serialization.',
        'This case study connects Rank/Select Bitvector, Roaring Bitmaps, Delta Bit-Packing Integer Compression, Dremel Query Engine Case Study, Parquet Columnar Format Case Study, and DuckDB Vectorized Execution Case Study. It turns abstract bitmap and buffer ideas into a concrete memory contract used by real analytics tools.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a nullable primitive array, Arrow stores a validity bitmap and a values buffer. The bitmap says which logical slots are valid. The value buffer stores fixed-width values in a contiguous typed region. For variable-size binary or string arrays, Arrow adds an offsets buffer: offsets[i] and offsets[i + 1] locate the byte slice for slot i.',
        'Nested arrays reuse the same idea recursively. Lists use offsets into a child array. Structs carry child arrays with their own validity, and the parent validity can mask child values. The result is a small vocabulary of buffers that can represent flat and nested tabular data without row objects.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Arrow improves scan locality and vectorized execution because values of the same type sit together. Validity bitmaps make null handling compact. Offsets make variable-size data addressable without object pointers. The tradeoff is mutation: appending or changing individual values is usually more expensive than in row-oriented mutable structures.',
        'The format also shifts correctness responsibility to buffer metadata. Lengths, offsets, null counts, alignment, and child-array boundaries must be valid. When a consumer maps Arrow buffers into process memory, malformed data can become a safety problem, so validation matters at trust boundaries.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A realistic pipeline reads Parquet files into Arrow record batches, filters or aggregates them in a vectorized engine, and returns Arrow batches to a Python or JavaScript client. Without Arrow, each handoff might serialize rows into a private representation. With Arrow, the handoff can preserve schema and buffer layout, so the next engine can scan the same column buffers.',
        'This is why Arrow sits between Parquet and DuckDB conceptually. Parquet is a durable compressed file format. DuckDB is an execution engine that moves chunks through operators. Arrow is the in-memory interchange structure that lets systems meet on a common representation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Arrow is not a database and not a compression format by itself. It is a memory layout and interchange specification. It can be serialized through IPC, but its main idea is still typed column buffers. Another trap is assuming zero-copy always means zero cost. Ownership, lifetime, device memory, dictionary encoding, and alignment can force copies or validation work.',
        'Arrow also does not make every workload faster. Row-at-a-time transactional updates usually prefer row-oriented mutable structures. Arrow is strongest for analytical scans, vectorized kernels, inter-process transfer, and language boundaries where repeated conversion costs dominate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Arrow Columnar Format specification at https://arrow.apache.org/docs/format/Columnar.html, Arrow format overview at https://arrow.apache.org/overview/, Arrow introduction to physical layouts at https://arrow.apache.org/docs/format/Intro.html, Arrow security considerations at https://arrow.apache.org/docs/format/Security.html, and Arrow R developer layout notes at https://arrow.apache.org/docs/r/articles/developers/data_object_layout.html. Study Rank/Select Bitvector, Roaring Bitmaps, Archetype ECS Column Store, Parquet Columnar Format Case Study, DuckDB Vectorized Execution Case Study, and Dremel Query Engine Case Study next.',
      ],
    },
  ],
};
