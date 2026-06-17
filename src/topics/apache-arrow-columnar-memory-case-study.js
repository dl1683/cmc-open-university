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
    explanation: 'Read this as schema plus buffers. A RecordBatch says these arrays have the same row count; each array says which typed buffers give meaning to its logical slots.',
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
    explanation: 'The validity bit is the authority. Row 1 is null even though the value buffer still contains bytes. Arrow separates logical meaning from raw storage so kernels can scan compact buffers.',
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
    explanation: 'For strings, offsets are the index structure. offsets[i] and offsets[i + 1] cut a slice out of one contiguous byte buffer, avoiding one object allocation per string.',
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
    explanation: 'In this view Arrow is a treaty between systems. If producer and consumer agree on schema, buffer order, offsets, and lifetimes, the handoff can be a pointer-level handoff instead of a row-by-row conversion.',
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
    explanation: 'The caveat is that raw buffers are powerful and unforgiving. Bad lengths, offsets, alignment, or ownership can turn a fast interchange format into corrupted results or unsafe memory access.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Apache Arrow exists because analytics systems used to waste huge amounts of time translating data between incompatible in-memory representations. A database engine, dataframe library, machine-learning runtime, and RPC service might all understand columns, but each might store strings, nulls, timestamps, and nested values differently. Every boundary became a conversion tax.',
        'Arrow turns the memory layout itself into a shared contract. A logical column is represented by typed buffers, validity bitmaps, offsets, and schema metadata. A RecordBatch groups arrays of the same length so vectorized operators can process a table-shaped chunk without reconstructing row objects.',
        'The key idea is not just columnar storage. It is standardized columnar memory. If two systems agree on the Arrow specification, one can hand the other buffers plus schema instead of serializing every cell into JSON, Python objects, or engine-specific rows.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is row objects. Each row is a record, each field is a language object, and every engine converts those objects into its own internal representation. That is easy to program against, but bad for scans. A CPU looking for one column has to step over every other field and chase pointers through memory.',
        'Another common approach is file serialization. Put the data in CSV, JSON, or even Parquet, then let every system read it. That solves durability or interchange on disk, but it does not solve in-memory execution. A query engine still wants contiguous typed buffers for fast kernels, not a pile of decoded row objects.',
        'Arrow’s answer is to make the in-memory batch the interchange artifact. It is not a database and not a storage format like Parquet. It is a physical memory format designed for analytical execution and cross-system handoff.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that logical values can be described by a small number of buffer patterns. A nullable primitive array stores a validity bitmap and a fixed-width values buffer. The bitmap decides which slots are meaningful. Bytes may exist for a null slot, but the validity bit says they should be ignored.',
        'Variable-size binary and string arrays add an offsets buffer. offsets[i] and offsets[i + 1] identify the byte range for slot i inside one contiguous data buffer. That avoids one heap allocation per string and lets kernels scan offsets and bytes predictably.',
        'Nested arrays reuse the same vocabulary. Lists use offsets into a child array. Structs carry child arrays with their own validity. Parent validity can mask child values. The format stays regular enough for kernels to loop over typed buffers rather than chase arbitrary object graphs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer creates a schema and arrays. The schema names fields and logical types. Each array records length, null count, offset when sliced, and the buffers that define its physical layout. A RecordBatch says these arrays share a row count and can be treated together as a table chunk.',
        'A vectorized kernel then works over buffers. For an Int32 sum, it can walk a values buffer and a validity bitmap. For a string filter, it can walk offsets and byte slices. For a selection, it can produce a new array, bitmap, or indices without materializing full row objects.',
        'Interchange works because the consumer does not need to know the producer’s classes. It needs the Arrow schema, buffer addresses or IPC payload, and ownership rules. If the handoff preserves the buffers, the consumer can avoid row-by-row conversion.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The array-buffer view proves that one logical column is not one opaque object. The int column is validity plus values. The string column is validity plus offsets plus bytes. The schema and array metadata explain how to interpret those buffers. The kernel can process the buffers directly because the layout is regular.',
        'The zero-copy view proves why Arrow is an interchange format. Python, a query engine, and a client can agree on schema and buffers instead of converting through per-cell objects. The handoff is cheap only if lifetime, alignment, validity, and ownership are correct.',
        'The Arrow-versus-Parquet table proves an important boundary. Parquet is for durable compressed storage. Arrow is for in-memory arrays and interchange. DuckDB or DataFusion are execution engines that can consume or produce Arrow batches, but Arrow itself is not the query optimizer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because analytical workloads usually touch columns, not whole objects. Filtering by one column, summing one numeric field, projecting a subset of fields, and sending a batch to another process all benefit from contiguous typed buffers. The CPU gets predictable memory access, and the system avoids per-row allocation overhead.',
        'It also works because nulls and variable-size values have explicit side structures. A validity bitmap compresses null state to one bit per slot. Offsets make strings and lists indexable without pointer chasing. Those structures are small but powerful: they turn messy logical values into regular memory scans.',
        'Finally, it works because the format is shared. Standardization lets an ecosystem form: Arrow IPC, Flight, dataframe interchange, query engines, language bindings, and analytics services can all meet at the same memory contract.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Arrow reduces conversion and scan cost, but it is not free. Sliced arrays carry offsets that kernels must respect. Dictionary encoding, nested arrays, string data, device memory, and extension types can complicate zero-copy assumptions. Some boundaries still copy because ownership, alignment, or lifetime cannot be guaranteed.',
        'Mutation is another tradeoff. Arrow arrays are best treated as immutable batches. Appending or updating individual rows usually means building new arrays or using a separate mutable representation before finalizing an Arrow batch. Row-at-a-time transactional workloads usually want a different structure.',
        'Validation matters. Bad offsets, wrong lengths, inconsistent null counts, or invalid UTF-8 where UTF-8 is promised can corrupt results or create unsafe memory access in native code. A memory layout is a contract, and contracts need enforcement at trust boundaries.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Arrow wins at analytics boundaries: dataframe to query engine, query engine to client, Python to Rust, JVM to native engine, Flight RPC service to consumer, and Parquet reader to vectorized execution. It is especially useful when the data is already columnar and the next step can preserve that shape.',
        'A realistic pipeline reads Parquet into Arrow batches, filters or aggregates them in a vectorized engine, and returns Arrow batches to a Python, JavaScript, or Flight client. Each boundary can preserve columnar structure instead of rebuilding rows.',
        'It also wins as an educational data structure because the pieces are concrete. Validity bitmaps, offset buffers, value buffers, schemas, and record batches are visible. They explain why columnar execution is fast without hiding behind vague claims about big data.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not call Arrow a database. It does not provide transactions, indexes, query planning, durability, or storage management by itself. It is a memory format and interchange specification. IPC can serialize it, but the main idea remains typed column buffers with explicit metadata.',
        'Do not assume zero-copy automatically happens. Crossing a process, language, device, or trust boundary may require copies or validation. If a system has to materialize Python objects, decode strings, or rebuild rows, the Arrow advantage may disappear.',
        'Do not ignore workload shape. Arrow is strongest for batched analytical processing. If the workload is one tiny row mutation at a time, a row-store, object model, or database page layout may be more appropriate.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Official sources: Arrow Columnar Format specification at https://arrow.apache.org/docs/format/Columnar.html, Arrow format overview at https://arrow.apache.org/overview/, Arrow introduction to physical layouts at https://arrow.apache.org/docs/format/Intro.html, Arrow security considerations at https://arrow.apache.org/docs/format/Security.html, and Arrow R developer layout notes at https://arrow.apache.org/docs/r/articles/developers/data_object_layout.html. Study Rank/Select Bitvector, Roaring Bitmaps, Archetype ECS Column Store, Parquet Columnar Format Case Study, DuckDB Vectorized Execution Case Study, and Dremel Query Engine Case Study next.',
        'Then inspect one Arrow string array by hand: validity bits, offsets, and data bytes. That exercise makes the whole format less abstract and gives you the right mental model for debugging copies and kernel behavior.',
      ],
    },
  ],
};
