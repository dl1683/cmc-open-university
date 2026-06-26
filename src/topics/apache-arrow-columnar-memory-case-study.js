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

export const article = { sections: [
{ heading: 'How to read the animation', paragraphs: ['Read the array-buffer view as a table broken into typed columns. A RecordBatch is a group of arrays with the same row count, and each array is metadata plus buffers.',{type:'callout', text:'Arrow makes interoperability a memory layout problem: once schema, buffers, validity bits, and offsets agree, systems can share column data without rebuilding rows.'},{type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4d/Row_and_column_major_order.svg', alt:'Diagram comparing row-major and column-major order', caption:'Row-major versus column-major memory order shows the layout shift Arrow standardizes for analytical scans. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0.'},'Active nodes show the buffer currently interpreted, compare nodes show a different array shape, and found nodes show the compute kernel. Schema and buffer order, not object fields, define logical values.'] },
{ heading: 'Why this exists', paragraphs: ['Apache Arrow exists because analytical systems wasted time translating the same table between incompatible in-memory layouts. A dataframe, query engine, machine-learning runtime, and RPC service can all understand columns while disagreeing on strings, nulls, timestamps, and nested data.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Diagram showing row-major versus column-major memory layout for a two-dimensional array', caption: 'Row-major versus column-major memory layout. In row-major order, elements of each row are contiguous. In column-major order, elements of each column are contiguous. Arrow uses column-major layout because analytical queries typically scan one column across many rows, not one row across many columns. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0.' },{ type: 'callout', text: 'Arrow is not a storage format and not a database. It is a specification for how typed column data sits in RAM, designed so that any two systems that implement the spec can share buffers without copying or converting a single byte.' },'Arrow makes the memory layout the shared contract. A logical column becomes typed buffers, validity bits, offsets, and schema metadata that another system can interpret without rebuilding row objects.'] },
{ heading: 'The obvious approach', paragraphs: ['The obvious representation is an array of row objects. Each row carries fields, and each field is a language value such as a number, string, null, or object reference.','That shape is pleasant for row-at-a-time application code. It is poor for analytical scans because a query that needs one column still loads unrelated fields, object headers, and pointers into cache.'] },
{ heading: 'The wall', paragraphs: ['The wall is memory bandwidth. CPUs fetch cache lines, commonly 64 bytes, so a row layout wastes bandwidth when the query needs only one or two fields from a wide row.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'CPU cache hierarchy diagram showing L1, L2, L3 caches and main memory with increasing size and latency at each level', caption: 'The CPU cache hierarchy. L1 is fastest but smallest (32-64 KB); L2 is mid-range (256 KB - 1 MB); L3 is large and shared (8-32 MB); DRAM is enormous but slow. Arrow\'s layout is designed to exploit this hierarchy: keep sequential column data flowing through the fast levels. Source: Wikimedia Commons, CC BY-SA 3.0.' },{ type: 'callout', text: 'The first-principles rule: the CPU fetches cache lines, not logical values. A 64-byte cache line holding 16 useful int32 values beats a 64-byte line holding 1 useful int32 and 9 irrelevant columns by a factor of 16 in effective bandwidth.' },'For 1 million rows with ten int32 columns, a one-column scan needs 4 MB of useful values. A row layout can pull about 40 MB through memory because each row carries the other nine columns along with the target value.'] },
{ heading: 'The core insight', paragraphs: ['Arrow stores each logical array as metadata plus buffers. A nullable int32 array uses a validity bitmap and contiguous values buffer; a string array uses a validity bitmap, offsets buffer, and one byte buffer.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel Core i7 CPU die photograph showing physical layout of cores, caches, and memory controller', caption: 'Intel Core i7 die shot. The large blocks are cores, each with private L1/L2 caches. The shared L3 cache ring occupies substantial die area. Arrow\'s contiguous buffers exploit the sequential prefetch patterns built into these cache controllers. Source: Wikimedia Commons, Intel, public domain.' },{ type: 'callout', text: 'Arrow arrays are regular enough for SIMD because type, nullability, offsets, and values live in separate predictable buffers. A kernel summing an int32 column can load 8 values per AVX2 instruction from a contiguous buffer -- impossible with scattered row objects.' },'The invariant is layout validity. Length, type, buffer order, null bitmap, offsets, alignment, and ownership must agree before a consumer can interpret bytes as values.'] },
{ heading: 'How it works', paragraphs: ['A primitive array reads slot i by checking validity bit i and then reading values[i] if the bit is valid. Nulls do not need sentinel values, because the bitmap is the authority.','A string array reads offsets[i] and offsets[i + 1] to slice bytes from one data buffer. The offsets are an index structure that avoids one heap allocation per string.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rack of data center servers with network cables, representing high-throughput environments where Arrow Flight operates', caption: 'Data center server racks. Arrow Flight is designed for environments like these, where analytics queries move gigabytes of columnar data between services. Traditional row-by-row serialization (JSON, Thrift) becomes the bottleneck at this scale; Flight eliminates it. Source: Wikimedia Commons, Victor Grigas, CC BY-SA 3.0.' }] },
{ heading: 'Why it works', paragraphs: ['The correctness argument is byte-level interpretation. If the schema says int32 and the length is N, then the values buffer must contain at least 4N bytes, and the validity bitmap must define logical presence.',{ type: 'callout', text: 'Zero-copy is not magic. It is a consequence of stable layout: if the consumer trusts the schema, buffer order, lengths, offsets, alignment, and lifetime, it can interpret existing bytes without allocating or converting anything.' },'For variable-size data, offsets must be monotonic and inside the data buffer. For nullable data, the bitmap decides logical presence even if bytes exist at a null slot.'] },{ heading: 'Cost and complexity', paragraphs: ['Arrow changes cost from objects to bytes. A nullable int32 column with 100 million rows uses about 400 MB for values plus 12.5 MB for validity bits, before padding and metadata.',{ type: 'callout', text: 'Immutability is the sharpest tradeoff. Arrow arrays are designed for build-once, scan-many workloads. Updating a single cell in a column of one million values means rebuilding the entire values buffer. For OLTP point updates, row-oriented storage (B-trees, LSM trees, page-based layouts) is the right choice.' },'Cost behaves like access pattern. Scanning one column across many rows is cheap, while appending single rows, mutating cells, or materializing Python objects can give back much of the gain.'] },
{ heading: 'Real-world uses', paragraphs: ['Arrow fits boundaries between analytical systems: dataframe libraries, SQL engines, Parquet readers, RPC services, and machine-learning feature pipelines. The common access pattern is batched scan, filter, projection, aggregation, or transfer.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Column_vs_row.svg', alt: 'Comparison diagram showing column-oriented versus row-oriented data storage layouts', caption: 'Column-oriented versus row-oriented storage. The left side stores all values of each column together; the right side stores all columns of each row together. Arrow standardizes the left layout as an in-memory interchange contract. Source: Wikimedia Commons, CC BY-SA 4.0.' },'It is useful when the next stage wants the same typed columns the previous stage produced. It is less useful when the program immediately turns every value into a language object.'] },
{ heading: 'Where it fails', paragraphs: ['Arrow is not a database. It does not provide transactions, indexes, query planning, replication, durability, or storage management.','Zero-copy also has strict limits. Different endianness, device memory, alignment, validation, chunk consolidation, dictionary decoding, or object materialization can require copies or conversions.'] },{ heading: 'Worked example', paragraphs: ['For SELECT AVG(price) WHERE region = US on 1 million rows, suppose region is dictionary encoded as int16 and price is float64. The engine scans about 2 MB of region codes, builds a 125 KB selection bitmap, then scans 8 MB of price values.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ssd-cache-benchmark.png', alt: 'Storage and cache benchmark chart showing performance differences between sequential and random access patterns', caption: 'Benchmark showing the dramatic performance gap between sequential and random access. Arrow\'s contiguous column buffers produce sequential access patterns that hardware is optimized for -- the same principle that makes this SSD benchmark show orders-of-magnitude difference between sequential and random reads. Source: Wikimedia Commons, public domain.' },'The query touches about 10 MB of useful column data, not the entire table. A row layout with four 8-byte fields would move about 32 MB for the same 1 million rows even though two columns are irrelevant.'] },
{ heading: 'Sources and study next', paragraphs: ['Study the Apache Arrow columnar format, format introduction, IPC format, C Data Interface, Flight RPC, and security considerations. Wes McKinney writing gives useful historical context for the serialization problem.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Cpu-cache-prefetching.svg', alt: 'Diagram showing CPU cache prefetching mechanism with sequential access pattern prediction', caption: 'CPU cache prefetching. The hardware prefetcher detects sequential access patterns and loads the next cache lines before the CPU requests them. Arrow\'s contiguous column buffers produce exactly the access pattern prefetchers are designed to accelerate. Source: Wikimedia Commons, CC BY-SA 4.0.' },'Next study CPU cache hierarchy, SIMD vectorization, rank-select bitvectors, dictionary encoding, Parquet, DuckDB vectorized execution, and Dremel. Build one Arrow string array by hand from validity bits, offsets, and bytes.'] },
] };