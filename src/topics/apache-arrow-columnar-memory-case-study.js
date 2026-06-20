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
      heading: 'How to read the animation',
      paragraphs: [
        'The "array buffers" view breaks one logical table into schema, RecordBatch, arrays, validity bitmaps, value buffers, offsets, and byte data. Active nodes are the current structural layer. Found nodes are the final kernel destination. Compare nodes are alternate array types that use a different buffer pattern.',
        'The "zero-copy interchange" view traces the handoff between systems -- a Python dataframe, an Arrow batch, a query engine, and a result consumer. Active nodes are the stages that avoid serialization. Found nodes are the endpoints that benefit from the shared contract.',
        {type:'callout', text:'Arrow makes interoperability a memory layout problem: once schema, buffers, validity bits, and offsets agree, systems can share column data without rebuilding rows.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4d/Row_and_column_major_order.svg', alt:'Diagram comparing row-major and column-major order', caption:'Row-major versus column-major memory order shows the layout shift Arrow standardizes for analytical scans. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0.'},
        {
          type: 'note',
          text: 'At each frame, identify which buffers are contiguous in memory and which require pointer indirection. The difference between "scan this buffer" and "chase this pointer" is the entire performance story of columnar versus row-oriented layout.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Wes McKinney, Arrow co-creator, 2017',
          text: 'The biggest cost in many analytics pipelines is not computation. It is serialization -- converting data from one in-memory representation to another at every system boundary.',
        },
        'Apache Arrow exists because analytics systems used to waste enormous time translating data between incompatible in-memory representations. A database engine, dataframe library, machine-learning runtime, and RPC service might all understand columns, but each stored strings, nulls, timestamps, and nested values differently. Every boundary became a conversion tax -- in Apache Spark before Arrow integration, serialization between the JVM and Python consumed up to 90% of total query time for PySpark UDF workloads.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg',
          alt: 'Diagram showing row-major versus column-major memory layout for a two-dimensional array',
          caption: 'Row-major versus column-major memory layout. In row-major order, elements of each row are contiguous. In column-major order, elements of each column are contiguous. Arrow uses column-major layout because analytical queries typically scan one column across many rows, not one row across many columns. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0.',
        },
        'Arrow turns the memory layout itself into a shared contract. A logical column is represented by typed buffers, validity bitmaps, offsets, and schema metadata. A RecordBatch groups arrays of the same length so vectorized operators can process a table-shaped chunk without reconstructing row objects.',
        'The key idea is not just columnar storage. It is standardized columnar memory. If two systems agree on the Arrow specification, one can hand the other raw buffers plus schema instead of serializing every cell into JSON, Python objects, or engine-specific rows. The design goal is radical: no serialization at all between cooperating systems.',
        {
          type: 'callout',
          text: 'Arrow is not a storage format and not a database. It is a specification for how typed column data sits in RAM, designed so that any two systems that implement the spec can share buffers without copying or converting a single byte.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious in-memory representation is an array of row objects. A row has fields. Each field is a language value. A string field is a string object. A missing value might be null, None, undefined, NaN, or a separate flag. This is pleasant for application code because one row carries all its fields together.',
        'It is poor for scans. Suppose each logical row has 10 fields but a query needs only age and revenue. A row layout still pulls unrelated fields into cache. If each row occupies 80 bytes after object headers, pointers, padding, and values, scanning 100 million rows touches roughly 8 GB of row data before the query even asks for the second column.',
        {
          type: 'table',
          headers: ['Representation', 'What is contiguous', 'Good at', 'Bad at'],
          rows: [
            ['Row objects', 'all fields for one row', 'point updates, row-at-a-time logic', 'column scans and vector kernels'],
            ['CSV or JSON', 'text bytes', 'human inspection and loose interchange', 'typed execution, nulls, strings, nested values'],
            ['Parquet', 'compressed column chunks on storage', 'durable lakehouse storage', 'direct in-memory execution without decoding'],
            ['Arrow', 'typed in-memory column buffers', 'batched analytics and interchange', 'small random row mutation'],
          ],
        },
        'The second obvious approach is to serialize at every boundary. A producer emits JSON, CSV, protobuf records, or engine-specific binary rows. A consumer parses them into its own objects. This is useful when the goal is durable interchange or human-readable logs. It is wasteful when both sides are analytical engines that want typed contiguous arrays.',
        'Arrow makes the in-memory batch itself the artifact. The design goal people summarize as "no serialization" means no row-by-row logical re-encoding just to cross a system boundary. IPC still serializes metadata and frames buffers for transport, but the value buffers remain the same layout the compute kernels want to scan.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the CPU memory hierarchy. Modern CPUs can retire many arithmetic operations per cycle, but they cannot compute on data that has not arrived from memory. Understanding the concrete numbers explains why Arrow\'s layout is not optional but necessary.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg',
          alt: 'CPU cache hierarchy diagram showing L1, L2, L3 caches and main memory with increasing size and latency at each level',
          caption: 'The CPU cache hierarchy. L1 is fastest but smallest (32-64 KB); L2 is mid-range (256 KB - 1 MB); L3 is large and shared (8-32 MB); DRAM is enormous but slow. Arrow\'s layout is designed to exploit this hierarchy: keep sequential column data flowing through the fast levels. Source: Wikimedia Commons, CC BY-SA 3.0.',
        },
        {
          type: 'table',
          headers: ['Cache level', 'Typical size', 'Access latency (cycles)', 'Access latency (approx ns)'],
          rows: [
            ['L1 data cache', '32-64 KB per core', '~4 cycles', '~1 ns'],
            ['L2 cache', '256 KB - 1 MB per core', '~12 cycles', '~3-4 ns'],
            ['L3 cache (shared)', '8-32 MB per socket', '~40 cycles', '~10-15 ns'],
            ['DRAM (main memory)', '16-256+ GB', '~200+ cycles', '~60-100 ns'],
          ],
        },
        'Data moves between DRAM and CPU in cache lines, typically 64 bytes at a time. The CPU does not fetch individual bytes -- it fetches the entire 64-byte block containing the requested address. Every cache miss at L1 costs roughly 50x more than a hit. The hardware prefetcher tries to detect sequential access patterns and speculatively load the next cache lines, but it cannot help with scattered pointer chasing.',
        'Consider a table with 10 columns, each an int32 (4 bytes per value). In row-oriented layout, each row is 40 bytes. A 64-byte cache line holds one row plus 24 wasted bytes from the next row\'s partial load. If a query only needs column 3 (say, "price"), every cache line loads 36 bytes of irrelevant data from the other 9 columns. That is a 90% cache waste rate. With one million rows, the CPU pulls ~40 MB from DRAM but only uses ~4 MB.',
        'In columnar layout, all values of column 3 sit contiguously. A 64-byte cache line holds 16 consecutive int32 prices. Every byte the CPU fetches is relevant. The hardware prefetcher detects the sequential stride and speculatively loads ahead. Cache utilization approaches 100%.',
        {
          type: 'callout',
          text: 'The first-principles rule: the CPU fetches cache lines, not logical values. A 64-byte cache line holding 16 useful int32 values beats a 64-byte line holding 1 useful int32 and 9 irrelevant columns by a factor of 16 in effective bandwidth.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Arrow takes the columnar idea all the way down to bytes. A logical array is described by a data type, a length, a null count, optional offset state for slices, optional dictionary state, child arrays for nested types, and a fixed order of buffers. The buffers are the data structure.',
        'For a nullable primitive array, the physical layout is two buffers. Buffer 0 is the validity bitmap: one bit per slot, packed eight per byte, least-significant-bit first. If bit i is 0, slot i is null. Buffer 1 is the values buffer: a contiguous array of fixed-width elements (4 bytes each for int32, 8 bytes each for float64). The values buffer may contain arbitrary bytes at null positions -- the validity bit is the sole authority on logical meaning.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Arrow string array layout: 3 buffers for [\'ann\', \'bo\', null, \'cy\']\n// Buffer 0 (validity bitmap): 0b00001011 = bits [1,1,0,1]\n//   slot 0 valid, slot 1 valid, slot 2 null, slot 3 valid\n// Buffer 1 (offsets):   [0, 3, 5, 5, 7]  (5 entries for 4 slots)\n// Buffer 2 (data bytes): [a,n,n,b,o,c,y]  (7 bytes total)\n//\n// To read slot i:\n//   if validity_bit(i) == 0: null\n//   else: data_bytes[offsets[i] .. offsets[i+1]]\n//\n// Slot 0: offsets[0..1] = [0,3] -> bytes[0..3] = \'ann\'\n// Slot 1: offsets[1..2] = [3,5] -> bytes[3..5] = \'bo\'\n// Slot 2: validity bit 0 -> null (offsets [5,5] = empty range)\n// Slot 3: offsets[3..4] = [5,7] -> bytes[5..7] = \'cy\'',
        },
        'For variable-size binary and strings, Arrow adds an offsets buffer. offsets[i] and offsets[i + 1] cut the byte range for slot i out of one contiguous data buffer. The offsets are length + 1 integers, usually 32-bit for regular Utf8, or 64-bit for LargeUtf8. The string bytes sit together instead of becoming one heap allocation per string.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg',
          alt: 'Intel Core i7 CPU die photograph showing physical layout of cores, caches, and memory controller',
          caption: 'Intel Core i7 die shot. The large blocks are cores, each with private L1/L2 caches. The shared L3 cache ring occupies substantial die area. Arrow\'s contiguous buffers exploit the sequential prefetch patterns built into these cache controllers. Source: Wikimedia Commons, Intel, public domain.',
        },
        'SIMD is where the design becomes concrete. A 256-bit AVX2 register holds eight Int32 values or four Float64 values. A 512-bit AVX-512 register holds sixteen Int32 values or eight Float64 values. Arrow requires buffer alignment to 8-byte boundaries and recommends 64-byte alignment -- matching cache line size -- so that SIMD loads never cross cache line boundaries and the prefetcher sees clean sequential access.',
        {
          type: 'table',
          headers: ['SIMD width', 'int32 values per instruction', 'float64 values per instruction', 'Throughput vs scalar loop'],
          rows: [
            ['SSE (128-bit)', '4', '2', '2-4x'],
            ['AVX2 (256-bit)', '8', '4', '4-8x'],
            ['AVX-512 (512-bit)', '16', '8', '8-16x'],
          ],
        },
        {
          type: 'callout',
          text: 'Arrow arrays are regular enough for SIMD because type, nullability, offsets, and values live in separate predictable buffers. A kernel summing an int32 column can load 8 values per AVX2 instruction from a contiguous buffer -- impossible with scattered row objects.',
        },
        'Dictionary encoding adds one more layer: an array of integer codes points into a dictionary array of distinct values. A column of one million country names with 200 distinct values stores int16 codes (2 MB) plus a dictionary of 200 short strings (~2 KB). The codes are dense integers that SIMD can compare at full width. Dictionary encoding transforms string comparison into integer comparison.',
        'Validity bitmaps deserve special attention because they handle null without sentinel values. No NaN-as-null, no -1-as-missing, no empty-string-as-absent. The value domain stays clean. A bitmap for one million rows is only 125 KB -- small enough to fit in L2 cache. A CPU can popcount a 64-bit word from the bitmap to count non-null values in 64 rows with a single instruction, or AND two bitmaps together to compute the intersection of non-null positions across two columns.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Schema names fields and their types. A RecordBatch groups arrays that share the same row count. Each Array defines how to interpret its buffers. A kernel does not need a row object because row position is implicit: slot 17 of every array belongs to logical row 17.',
        {
          type: 'table',
          headers: ['Arrow piece', 'What it stores', 'Why it matters'],
          rows: [
            ['Schema', 'ordered fields, names, types, nullable flags, child fields', 'preserves logical meaning across languages'],
            ['RecordBatch', 'equal-length arrays for one table chunk', 'gives operators a batch-sized unit of work'],
            ['Primitive array', 'validity bitmap + fixed-width values buffer', 'enables tight SIMD numeric loops'],
            ['String array', 'validity bitmap + offsets buffer + UTF-8 byte buffer', 'avoids one heap allocation per string'],
            ['Dictionary array', 'integer index array + dictionary of distinct values', 'compresses repeated values and converts string ops to integer ops'],
            ['Struct array', 'top-level validity + child arrays', 'represents nested rows without abandoning columns'],
            ['List array', 'validity + offsets into a child array', 'represents variable-length nested values with the same buffer vocabulary'],
          ],
        },
        'The array-buffer animation shows this contract in miniature. The Int32 column is validity plus values. The string column is validity plus offsets plus bytes. The schema gives those buffers names and types. The kernel can then scan values and validity words directly.',
        'Chunked arrays solve size and streaming boundaries. A table column may be a sequence of same-typed Arrow arrays rather than one enormous allocation. This matters for files, network streams, and systems that cap array lengths near 2^31 - 1 elements. Kernels must respect chunk boundaries, but every chunk keeps the same physical layout.',
        {
          type: 'diagram',
          text: [
            'Logical table',
            '  field age: Int32 nullable',
            '  field name: Utf8 nullable',
            '',
            'RecordBatch length = 4',
            '  age array',
            '    validity bitmap: 1 0 1 1',
            '    values buffer:   42 ? 7 9',
            '  name array',
            '    validity bitmap: 1 1 0 1',
            '    offsets buffer:  0 3 5 5 7',
            '    data buffer:     annbocy',
          ].join('\n'),
          label: 'The row number is shared by the arrays; the bytes remain columnar',
        },
      ],
    },
    {
      heading: 'IPC, Flight, and the zero-copy handoff',
      paragraphs: [
        'The Arrow IPC (Inter-Process Communication) format defines how to serialize an Arrow RecordBatch into a byte stream that another process can consume without deserializing individual values. The wire format is simple: a schema message (Flatbuffers-encoded metadata describing field names, types, and buffer layout), followed by one or more record batch messages.',
        {
          type: 'diagram',
          text: [
            'Arrow IPC Record Batch on the wire:',
            '',
            '  Schema Message (Flatbuffers metadata)',
            '    |',
            '    v',
            '  Record Batch Message:',
            '    +-- Metadata: field lengths, null counts, buffer offsets',
            '    +-- Body (concatenated, aligned buffers):',
            '        +-- [validity bitmap col 0] [pad to 64B]',
            '        +-- [values buffer  col 0] [pad to 64B]',
            '        +-- [validity bitmap col 1] [pad to 64B]',
            '        +-- [offsets buffer  col 1] [pad to 64B]',
            '        +-- [data buffer    col 1] [pad to 64B]',
            '        +-- ...',
          ].join('\n'),
          label: 'Each buffer is padded to alignment boundaries so the consumer can wrap pointers directly',
        },
        'The consumer reads the metadata, computes buffer pointers as offsets into the message body, and wraps those pointers as Arrow arrays. If the message was received via shared memory or a memory-mapped file, no bytes are copied at all -- the consumer\'s Arrow arrays point directly into the producer\'s memory. This is genuine zero-copy: the same physical bytes serve both systems.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Zero-copy read of an Arrow IPC file via memory mapping.\n// The OS maps the file into virtual memory; the Arrow reader\n// computes buffer pointers as offsets into the mapped region.\n// No data is copied -- the CPU fetches directly from the file\'s\n// page cache on first access.\n//\n// Pseudocode:\n// const mapped = mmap(\'data.arrow\', READ_ONLY);\n// const reader = ArrowFileReader(mapped);\n// const batch = reader.getRecordBatch(0);\n// // batch.column(0).values is a view into mapped memory\n// // No allocation, no copy, no deserialization of values',
        },
        'Arrow Flight extends this to the network. Flight is a gRPC-based protocol optimized for bulk Arrow data transfer. Instead of row-by-row encoding, Flight streams IPC-formatted record batches over the wire. The receiver decodes metadata and wraps buffer pointers. On high-bandwidth networks, Flight approaches memory-copy throughput because the format requires no per-value parsing.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg',
          alt: 'Rack of data center servers with network cables, representing high-throughput environments where Arrow Flight operates',
          caption: 'Data center server racks. Arrow Flight is designed for environments like these, where analytics queries move gigabytes of columnar data between services. Traditional row-by-row serialization (JSON, Thrift) becomes the bottleneck at this scale; Flight eliminates it. Source: Wikimedia Commons, Victor Grigas, CC BY-SA 3.0.',
        },
        'The Arrow C Data Interface is equally important for same-process boundaries. It defines two tiny C structs (ArrowSchema and ArrowArray) that let any two libraries in the same process exchange Arrow data by passing pointers plus a release callback. No IPC, no copies, no serialization -- just a struct with buffer pointers. This is how PyArrow, DuckDB, Polars, and DataFusion exchange data at zero cost within a single Python process.',
        {
          type: 'note',
          text: 'Zero-copy requires four conditions: (1) the producer\'s buffers are naturally aligned per the Arrow spec, (2) the consumer trusts the producer and can skip offset/length validation, (3) lifetime management ensures the producer does not free buffers while the consumer references them, and (4) the transfer mechanism supports shared memory -- mmap, shared memory segments, or same-process handoff via the C Data Interface.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the common analytical loop is embarrassingly regular. Load a run of values. Load the matching validity bits. Apply a predicate, projection, aggregation, cast, hash, or comparison. Write a result bitmap, indices array, or output values buffer. The same few buffer shapes cover a large fraction of real query execution.',
        {
          type: 'code',
          language: 'javascript',
          body: '// SIMD-friendly sum over an Arrow int32 column.\n// The contiguous values[] buffer lets the compiler or runtime\n// auto-vectorize this into AVX2 instructions.\nfunction sumInt32Column(values, validityBitmap, length) {\n  let total = 0;\n  for (let i = 0; i < length; i++) {\n    // Validity check: extract bit i from the bitmap\n    const byteIdx = i >> 3;       // i / 8\n    const bitIdx  = i & 7;        // i % 8\n    const isValid = (validityBitmap[byteIdx] >> bitIdx) & 1;\n    // Branchless: multiply by validity bit avoids branch misprediction.\n    // In native code, AVX-512 mask registers handle this natively.\n    total += values[i] * isValid;\n  }\n  return total;\n}',
        },
        'The correctness argument is a layout invariant. For every array, the metadata says the length and type. The type determines the required buffers. The buffers contain enough bytes for that length. For variable-size layouts, offsets must stay within the data buffer and must be monotonically non-decreasing. For nullable values, logical validity is determined by the bitmap, not by whatever bytes happen to sit in the value area.',
        {
          type: 'callout',
          text: 'Zero-copy is not magic. It is a consequence of stable layout: if the consumer trusts the schema, buffer order, lengths, offsets, alignment, and lifetime, it can interpret existing bytes without allocating or converting anything.',
        },
        'The ecosystem effect is the second reason it works. Before Arrow, M analytics systems needed up to M x (M-1) pairwise conversion paths. Arrow collapses that to M: each system implements the Arrow spec once, and every pair can exchange data through the shared format. Pandas, Polars, DuckDB, DataFusion, Spark, R, Julia, and dozens of other systems now speak Arrow natively.',
      ],
    },
    {
      heading: 'Worked example: SELECT AVG(price) WHERE region = \'US\'',
      paragraphs: [
        'Walk through how a query engine processes SELECT AVG(price) FROM orders WHERE region = \'US\' on an Arrow-backed table with four columns: order_id (int64), region (dictionary-encoded Utf8, ~50 distinct values), price (float64), and timestamp (int64). The table has one million rows in a single RecordBatch.',
        {
          type: 'table',
          headers: ['Step', 'What happens', 'Data touched', 'Cache behavior'],
          rows: [
            ['1. Column pruning', 'Query planner identifies only region and price are needed', 'Schema metadata only (bytes)', 'No data buffers loaded yet'],
            ['2. Scan region indices', 'Dictionary-encoded: load indices array (1M x int16 = 2 MB) and dictionary (~50 short strings)', '2 MB indices + ~500 bytes dictionary', 'Dictionary fits in L1 cache; indices stream through L2/L3'],
            ['3. Filter: region = \'US\'', 'Look up \'US\' in dictionary -> code 7. SIMD compare all indices == 7. Produce selection bitmap.', '2 MB read, ~125 KB bitmap produced', 'AVX2 compares 16 int16s per instruction'],
            ['4. Scan price column', 'Load only the price values buffer (1M x float64 = 8 MB)', '8 MB contiguous float64 buffer', 'Sequential scan; hardware prefetcher fully engaged'],
            ['5. Masked sum + count', 'SIMD sum of price values where selection bitmap bit is 1. Count matching rows.', '8 MB values + 125 KB bitmap', 'AVX2 processes 4 doubles per instruction with mask'],
            ['6. Compute average', 'Divide accumulated sum by count of matching rows', 'Two scalar register values', 'Register-only operation'],
          ],
        },
        'Total data scanned: ~10 MB (2 MB region indices + 8 MB price values + bitmaps). The full table in row-oriented layout would be ~32 MB (4 columns x 8 bytes x 1M rows). The query never loads order_id or timestamp. In row-oriented layout, every cache line would carry all four columns, wasting roughly 50% of memory bandwidth on irrelevant fields.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Step 3 in detail: SIMD filter on dictionary-encoded region.\n// indices: Int16Array of 1M dictionary codes\n// targetCode: the integer code for \'US\' in the dictionary\n// Returns a selection bitmap: 1 bit per row.\nfunction filterDictColumn(indices, targetCode, length) {\n  const bitmapBytes = Math.ceil(length / 8);\n  const bitmap = new Uint8Array(bitmapBytes);\n  // In native code this auto-vectorizes to AVX2 VPCMPEQW:\n  // compare 16 int16 values per instruction cycle.\n  for (let i = 0; i < length; i++) {\n    if (indices[i] === targetCode) {\n      bitmap[i >> 3] |= (1 << (i & 7));\n    }\n  }\n  return bitmap;\n}\n\n// Step 5: masked average using the selection bitmap.\nfunction maskedAverage(prices, selectionBitmap, length) {\n  let sum = 0, count = 0;\n  for (let i = 0; i < length; i++) {\n    const selected = (selectionBitmap[i >> 3] >> (i & 7)) & 1;\n    sum += prices[i] * selected;   // branchless\n    count += selected;\n  }\n  return count > 0 ? sum / count : null;\n}',
        },
        'The dictionary encoding deserves attention. Without it, the region column would store full strings: one million copies of \'US\', \'EU\', \'APAC\', and so on. With dictionary encoding, it stores one million int16 codes (2 MB) plus one copy of each distinct string. The codes are dense integers that SIMD can compare at full register width. This is why dictionary encoding is not just compression -- it is a performance structure that converts string operations into integer operations.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ssd-cache-benchmark.png',
          alt: 'Storage and cache benchmark chart showing performance differences between sequential and random access patterns',
          caption: 'Benchmark showing the dramatic performance gap between sequential and random access. Arrow\'s contiguous column buffers produce sequential access patterns that hardware is optimized for -- the same principle that makes this SSD benchmark show orders-of-magnitude difference between sequential and random reads. Source: Wikimedia Commons, public domain.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Arrow changes the cost model from objects to bytes. A nullable Int32 column uses 4 bytes per value plus 1 bit per validity slot, padded and aligned. 100 million rows cost about 400 MB of values plus 12.5 MB of validity bits. The same values as boxed language objects can use several times more memory before the data itself is even counted.',
        {
          type: 'table',
          headers: ['Operation', 'Row-object cost', 'Arrow-style cost'],
          rows: [
            ['Filter Int32 column', 'pointer chase each row, load unrelated fields into cache', 'stream values buffer + validity bitmap; SIMD compares 8-16 values per instruction'],
            ['Sum Float64 column', 'branch over object/null representation per row', 'SIMD sum over contiguous buffer; branchless validity via mask registers'],
            ['Project 3 of 50 columns', 'row representation still carries all 50 fields in cache', 'touch only 3 selected arrays; other 47 columns never loaded'],
            ['Send batch to another engine', 'serialize every value; allocate consumer objects', 'send schema + raw buffers through IPC or Flight; zero-copy if shared memory'],
            ['Append one row', 'cheap if row object is mutable', 'build a new batch or append through a builder; finalize into immutable array'],
          ],
        },
        'Columnar layout is not automatically faster. If a query needs every field of one row, row layout has good locality. If the workload mutates one record at a time, immutable Arrow arrays are the wrong primary store. If a kernel must cross many small chunks, decode dictionaries constantly, or branch heavily on nested validity, the neat buffer loop becomes less neat.',
        {
          type: 'callout',
          text: 'Immutability is the sharpest tradeoff. Arrow arrays are designed for build-once, scan-many workloads. Updating a single cell in a column of one million values means rebuilding the entire values buffer. For OLTP point updates, row-oriented storage (B-trees, LSM trees, page-based layouts) is the right choice.',
        },
        'The hidden cost is discipline. Offsets, lengths, null counts, dictionaries, child arrays, alignment, and ownership must agree. At trusted in-process boundaries, libraries can pass buffers directly via the C Data Interface. At untrusted or cross-process boundaries, systems should validate offsets, lengths, and UTF-8 encoding before exposing native code to potentially malformed data. A memory layout is a contract; contracts need enforcement at trust boundaries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Arrow wins at boundaries where data is already table-shaped and the next system wants batched analytical work.',
        {
          type: 'bullets',
          items: [
            'Apache Spark: Arrow-based PySpark UDFs replaced row-by-row Python pickling. Spark 2.3+ uses Arrow for pandas UDF interchange, reducing serialization overhead from up to 90% to near zero for vectorized UDFs.',
            'DuckDB: reads and writes Arrow natively via the C Data Interface. A Python script can query a Pandas DataFrame through DuckDB with zero copies -- DuckDB scans the Arrow buffers backing the DataFrame directly.',
            'Polars: built on Arrow from the ground up. Every Polars Series is an Arrow chunked array. Interop with PyArrow, DuckDB, and other Arrow consumers is free.',
            'Parquet readers: Apache Parquet decoders materialize directly into Arrow buffers. The reader produces Arrow RecordBatches; no intermediate row objects exist.',
            'Flight RPC: Dremio, InfluxDB IOx, and other analytics services use Flight to stream query results as Arrow batches. Clients receive typed buffers, not JSON rows.',
            'ADBC (Arrow Database Connectivity): a database API standard where query results are Arrow batches by default, replacing JDBC/ODBC row-at-a-time fetching with bulk columnar transfer.',
            'Machine learning: frameworks consume Arrow buffers for feature ingestion. The Arrow-to-tensor path avoids redundant copies between the dataframe and the training pipeline.',
          ],
        },
        {
          type: 'table',
          headers: ['Boundary', 'Why Arrow fits', 'What can still copy'],
          rows: [
            ['pandas/Polars to DuckDB', 'shared column buffers via C Data Interface', 'object dtype columns or unsupported extension types'],
            ['Parquet reader to DataFusion', 'decoded column pages become Arrow batch input', 'compressed pages must still be decoded from storage'],
            ['Rust service to Python client', 'schema + buffers avoid per-cell JSON', 'Python object materialization if user converts to Python scalars'],
            ['Flight RPC to analytics client', 'streams RecordBatches over gRPC using IPC format', 'network transport copies; validation at trust boundaries'],
            ['GPU-aware pipelines', 'Arrow has a device data interface specification', 'host-to-device transfer if GPU memory is not directly mapped'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Column_vs_row.svg',
          alt: 'Comparison diagram showing column-oriented versus row-oriented data storage layouts',
          caption: 'Column-oriented versus row-oriented storage. The left side stores all values of each column together; the right side stores all columns of each row together. Arrow standardizes the left layout as an in-memory interchange contract. Source: Wikimedia Commons, CC BY-SA 4.0.',
        },
        'Arrow also gives educators a rare systems teaching object. It connects data structures to hardware directly: a bitmap is not an abstract set; it is 1 bit per logical slot, processable by POPCNT. An offsets buffer is not an index metaphor; it is the integer array that slices a byte buffer. A RecordBatch is not a dataframe; it is the unit that lets kernels assume equal length across columns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Arrow is not a database. It does not provide transactions, indexes, query planning, replication, durability, or storage management. It is a memory format, IPC format, and set of libraries. A database can use Arrow at its edges or inside execution, but Arrow does not replace the database.',
        'Arrow is not Parquet in RAM. Parquet is a durable compressed columnar file format optimized for storage, statistics, encodings, and row group skipping. Arrow is optimized for in-memory processing and interchange. A common pipeline decodes Parquet into Arrow, computes on Arrow, and may later write Parquet again.',
        {
          type: 'table',
          headers: ['Anti-pattern', 'Why it breaks', 'Better alternative'],
          rows: [
            ['One row per RecordBatch', 'Per-batch metadata overhead dominates; no SIMD benefit', 'Batch thousands to millions of rows per RecordBatch'],
            ['OLTP point updates', 'Arrow is immutable and scan-oriented; updating one cell rebuilds the column', 'B-tree or LSM-tree row stores'],
            ['High-cardinality dictionary columns', 'Dictionary as large as the column; index overhead without compression benefit', 'Plain encoding or run-length encoding'],
            ['Ignoring buffer alignment', 'Unaligned buffers cause SIMD faults or performance degradation', 'Pad all buffers to 64-byte boundaries per spec'],
            ['Skipping validation on untrusted input', 'Malformed offsets or lengths produce out-of-bounds memory reads', 'Validate at trust boundaries; trust only internal producers'],
            ['Treating Arrow as universal format', 'Not suited for messages, blobs, graph data, or transactional workloads', 'Use Parquet for storage, protobuf for messages, databases for ACID'],
          ],
        },
        'Zero-copy can fail for honest reasons. The consumer may need different endianness, different device memory, different alignment, consolidated chunks, decoded dictionaries, validated UTF-8, or native language objects. A zero-copy claim is only true for the specific boundary and access pattern being measured.',
        'Nested data can also become branchy. Lists, structs, maps, unions, and multiple validity levels are still more regular than arbitrary object graphs, but kernels must combine parent and child validity, walk offsets, and handle empty or null ranges. Arrow makes this tractable; it does not make it free.',
        {
          type: 'note',
          text: 'The most common mistake is treating Arrow as a universal data format. It is not. It is an analytical in-memory format. For storage, use Parquet. For transactions, use a database. For messages, use a message queue. Arrow occupies a specific and important niche: fast columnar processing and zero-cost interchange between analytics systems.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Arrow Columnar Format specification at https://arrow.apache.org/docs/format/Columnar.html, Arrow format introduction at https://arrow.apache.org/docs/format/Intro.html, Arrow IPC format at https://arrow.apache.org/docs/format/IPC.html, Arrow C Data Interface at https://arrow.apache.org/docs/format/CDataInterface.html, Arrow Flight RPC at https://arrow.apache.org/docs/format/Flight.html, and Arrow security considerations at https://arrow.apache.org/docs/format/Security.html. Wes McKinney\'s 2017 blog post "Apache Arrow and the 10 Things I Hate About pandas" gives the original motivation.',
        {
          type: 'table',
          headers: ['Study role', 'Topic', 'Why it follows'],
          rows: [
            ['Prerequisite', 'CPU Cache and Memory Hierarchy', 'explains why data layout controls execution speed'],
            ['Prerequisite', 'SIMD and Vectorization', 'explains why typed contiguous buffers enable 8-16x throughput gains'],
            ['Mechanism', 'Rank/Select Bitvector', 'turns validity bitmaps into indexed data structures with O(1) rank queries'],
            ['Mechanism', 'Dictionary Encoding', 'compresses repeated values and converts string equality to integer comparison'],
            ['Contrast', 'Parquet Columnar Format Case Study', 'contrasts durable compressed storage with in-memory analytical layout'],
            ['Extension', 'DuckDB Vectorized Execution Case Study', 'shows Arrow-style batches powering a full SQL engine'],
            ['Extension', 'Dremel Query Engine Case Study', 'adds nested columnar analytics at distributed scale'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Cpu-cache-prefetching.svg',
          alt: 'Diagram showing CPU cache prefetching mechanism with sequential access pattern prediction',
          caption: 'CPU cache prefetching. The hardware prefetcher detects sequential access patterns and loads the next cache lines before the CPU requests them. Arrow\'s contiguous column buffers produce exactly the access pattern prefetchers are designed to accelerate. Source: Wikimedia Commons, CC BY-SA 4.0.',
        },
        'The best follow-up exercise is to build one Arrow string array by hand: write its validity bits, offsets, and byte buffer. Then slice it at a sub-range without copying any data bytes. That one exercise makes zero-copy less mystical because the slice is just new metadata (offset + length) pointing at old buffers.',
      ],
    },
  ],
};

