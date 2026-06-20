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
        'The animation has two jobs. The array-buffer view breaks one logical table into schema, RecordBatch, arrays, validity bitmaps, value buffers, offsets, and bytes. The zero-copy view shows why those buffers can move between systems without rebuilding rows.',
        {
          type: 'bullets',
          items: [
            'Active nodes mark the current contract boundary: schema to batch, batch to array, array to buffer, or buffer to kernel.',
            'Compare markers show the representation Arrow avoids: per-row objects, per-string allocations, per-cell serialization, and engine-specific in-memory layouts.',
            'Found markers show the payoff: a kernel can scan typed buffers, and another system can receive those buffers with the same logical meaning.',
          ],
        },
        'At each frame, ask which bytes are being interpreted, which metadata makes that interpretation legal, and whether any copy was actually necessary. Arrow is a case study in making physical layout part of the API.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Apache Arrow exists because analytical systems were losing time at the boundary between tools. A database, a dataframe library, a query engine, and a machine-learning runtime may all process the same table, but each historically used its own row objects, string objects, null markers, and timestamp rules. Moving data across that boundary meant deserializing, allocating new objects, and serializing again.',
        'That conversion tax is worst in analytics because the useful work is often simple. Filter one column. Sum one numeric field. Group by a low-cardinality string. If the real computation is a tight loop over values, spending most of the time rebuilding objects is the wrong bottleneck.',
        {
          type: 'callout',
          text: 'Arrow is not only a columnar layout. It is a standard physical memory contract: schema plus arrays plus buffers, with enough metadata for another engine to interpret the same bytes.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Row_and_column_major_order.svg',
          alt: 'Diagram comparing row-major and column-major ordering in a matrix',
          caption: 'Row-major and column-major order are the basic memory-layout choice: which neighboring values become contiguous bytes. Arrow makes the column direction a cross-system contract, not a local implementation detail. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0.',
        },
        'The official Arrow format is explicit about this trade: it gives data adjacency for sequential scans, constant-time random access for most layouts, SIMD-friendly execution, and relocatable buffers that do not need pointer swizzling. In exchange, mutation is more expensive. That is the right bargain for batched analytical work.',
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
        'Arrow makes the in-memory batch itself the artifact. The design goal people summarize as no serialization means no row-by-row logical re-encoding just to cross a system boundary. IPC still serializes metadata and frames buffers for transport, but the value buffers remain the same layout the compute kernels want to scan.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the memory hierarchy. Modern CPUs can retire many arithmetic operations per cycle, but they cannot compute on data that has not arrived. A typical 2020s core has an L1 data cache around 32-64 KiB, an L2 cache around 512 KiB-2 MiB, and a shared L3 cache ranging from tens to hundreds of MiB. Data moves in cache lines, commonly 64 bytes at a time.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Cache_Hierarchy_Updated.png',
          alt: 'Cache hierarchy diagram showing CPU registers, L1 cache, L2 cache, L3 cache, and main memory',
          caption: 'A simplified cache hierarchy. Smaller levels are faster and closer to the core; larger levels are slower and farther away. Columnar layout is a way to make each 64-byte trip carry useful values. Source: Wikimedia Commons, Kbbuch, CC BY-SA 4.0.',
        },
        'The numbers explain the shape of Arrow. An L1 hit may cost roughly 1 ns. L2 can cost several ns. L3 can cost roughly 10-20 ns. DRAM often costs 60-100 ns, hundreds of CPU cycles. Bandwidth can look large on paper, from tens of GB/s on a desktop memory channel to hundreds of GB/s on a server socket, but latency still punishes scattered pointer chasing.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Separate_unified.png',
          alt: 'Cache organization diagram showing split L1 data and instruction caches above unified L2 memory',
          caption: 'L1 cache is often split into instruction and data caches, while lower levels are larger and usually unified. A data layout that keeps hot data together helps the data side feed the pipeline. Source: Wikimedia Commons, Avadlam3, CC BY-SA 4.0.',
        },
        'A row object wastes cache lines during a column scan. If a 64-byte cache line contains a row header, pointers, a string pointer, a timestamp, and fields the query does not need, only a fraction of the fetched bytes contribute to the result. A columnar Int32 buffer puts 16 useful values in one 64-byte line. A Float64 buffer puts 8 useful values in one line. The hardware prefetcher can recognize the stream and fetch the next lines before the core asks.',
        {
          type: 'callout',
          text: 'The first-principles rule: the CPU fetches cache lines, not logical values. Columnar layout wins when each fetched line contains many values the next operator will actually use.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Arrow takes the columnar idea all the way down to bytes. A logical array is described by a data type, a length, a null count, optional offset state for slices, optional dictionary state, child arrays for nested types, and a fixed order of buffers. The buffers are the data structure.',
        'For a nullable primitive array, the physical layout is a validity bitmap plus a values buffer. The validity bitmap uses one bit per slot: 1 means valid, 0 means null. The values buffer may still contain bytes for a null slot; the bitmap decides whether those bytes have logical meaning. If null count is zero, an implementation may omit the bitmap.',
        'For variable-size binary and strings, Arrow adds an offsets buffer. offsets[i] and offsets[i + 1] cut the byte range for slot i out of one contiguous data buffer. The offsets are length + 1 integers, usually 32-bit for regular Binary and Utf8, or 64-bit for LargeBinary and LargeUtf8. The string bytes sit together instead of becoming one heap allocation per string.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/SIMD2.svg/700px-SIMD2.svg.png',
          alt: 'SIMD diagram showing one instruction applied to multiple processing units and data lanes',
          caption: 'SIMD applies one instruction to multiple data lanes. Arrow favors layouts where a kernel can load a vector of same-typed values rather than branch through row objects. Source: Wikimedia Commons, Vadikus, CC BY-SA 4.0.',
        },
        'SIMD is where the design becomes concrete. A 256-bit AVX2 register holds eight Int32 values or four Float64 values. A 512-bit AVX-512 register holds sixteen Int32 values or eight Float64 values. Arrow recommends 64-byte alignment and padding so a 512-bit load can consume a whole cache-line-sized block without special tail checks in the hot loop.',
        {
          type: 'callout',
          text: 'Arrow arrays are regular enough for vector code because type, nullability, offsets, and values live in separate predictable buffers.',
        },
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
            ['Primitive array', 'validity bitmap plus fixed-width values', 'enables tight numeric loops'],
            ['String array', 'validity bitmap, offsets, UTF-8 byte buffer', 'avoids one object per string'],
            ['Struct array', 'top-level validity plus child arrays', 'represents nested rows without abandoning columns'],
            ['List array', 'validity plus offsets into a child array', 'represents variable-length nested values with the same buffer vocabulary'],
          ],
        },
        'The array-buffer animation shows this contract in miniature. The Int32 column is validity plus values. The string column is validity plus offsets plus bytes. The schema gives those buffers names and types. The kernel can then scan values and validity words directly.',
        'Dictionary encoding adds one more layer: an array of integer indices points into a dictionary array of distinct values. A repeated country column might store 100 million 32-bit indices plus a small dictionary of 200 strings instead of repeating the same strings 100 million times. IPC carries dictionary batches so producer and consumer agree on the dictionary behind the indices.',
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
      heading: 'Why it works',
      paragraphs: [
        'It works because the common analytical loop is embarrassingly regular. Load a run of values. Load the matching validity bits. Apply a predicate, projection, aggregation, cast, hash, or comparison. Write a result bitmap, indices array, or output values buffer. The same few buffer shapes cover a large fraction of real query execution.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Pipeline%2C_4_stage.svg/500px-Pipeline%2C_4_stage.svg.png',
          alt: 'Four-stage CPU pipeline diagram with fetch, decode, execute, and write-back stages',
          caption: 'A CPU pipeline is happiest when work arrives predictably. Columnar buffers reduce stalls by giving fetch, decode, and execute a steady stream of same-shaped operations. Source: Wikimedia Commons, en:User:Cburnett, CC BY-SA 3.0.',
        },
        'The correctness argument is a layout invariant. For every array, the metadata says the length and type. The type determines the required buffers. The buffers contain enough bytes for that length. For variable-size layouts, offsets must stay within the data buffer and must be monotonically increasing in the standard variable-size layout. For nullable values, logical validity is determined by the bitmap, not by whatever bytes happen to sit in the value area.',
        {
          type: 'callout',
          text: 'Zero-copy is not magic. It is a consequence of stable layout: if the consumer trusts the schema, buffer order, lengths, offsets, alignment, and lifetime, it can interpret existing bytes.',
        },
        'Arrow IPC makes that invariant transportable. The stream and file formats send schema messages, RecordBatch messages, optional dictionary messages, FlatBuffers metadata, and aligned buffer bodies. The file format adds a footer for random access. The stream format supports a sequence of batches. In both cases, the consumer can map or receive buffers in the same physical form used by compute kernels.',
        'Flight RPC moves the same idea onto a service boundary. Flight is built on gRPC and the Arrow IPC format. A client asks for metadata, receives endpoints and tickets, then uses DoGet or DoPut to stream Arrow RecordBatches. Flight can move large analytical results without forcing every row through JSON or per-language object graphs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Arrow changes the cost model from objects to bytes. A nullable Int32 column uses 4 bytes per value plus 1 bit per validity slot, padded and aligned. 100 million rows are about 400 MB of values plus 12.5 MB of validity bits. The same values as boxed language objects can use several times more memory before the data itself is considered.',
        {
          type: 'table',
          headers: ['Operation', 'Row-object cost', 'Arrow-style cost'],
          rows: [
            ['Filter Int32 column', 'pointer chase each row, load unrelated fields', 'stream values buffer plus validity bitmap'],
            ['Sum Float64 column', 'branch over object/null representation', 'SIMD over 8 values per 512-bit load when valid path is simple'],
            ['Project 3 of 50 columns', 'row representation still carries all fields', 'touch only selected arrays'],
            ['Send batch to another engine', 'serialize and allocate consumer objects', 'send schema and buffers through IPC or Flight'],
            ['Append one row', 'cheap if row object is mutable', 'usually build a new batch or append through a builder'],
          ],
        },
        'Columnar layout is not automatically faster. If a query needs every field of one row, row layout has good locality. If the workload mutates one record at a time, immutable Arrow arrays are the wrong primary store. If a kernel must cross many small chunks, decode dictionaries constantly, or branch heavily on nested validity, the neat buffer loop becomes less neat.',
        'The hidden cost is discipline. Offsets, lengths, null counts, dictionaries, child arrays, alignment, and ownership must agree. At trusted in-process boundaries, libraries can often pass buffers directly. At untrusted or cross-process boundaries, systems should validate before exposing native code to malformed metadata or malicious offsets.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Cache_Organization.png',
          alt: 'General cache organization diagram with processors connected through cache systems to main memory and I/O',
          caption: 'Caches sit between processors and memory across the whole machine, not only inside one loop. Arrow helps when several engines can share or stream the same cache-friendly buffers. Source: Wikimedia Commons, Kunal Buch, CC BY-SA 4.0.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Arrow wins at boundaries where data is already table-shaped and the next system wants batched analytical work. A Parquet reader can decode pages into Arrow batches. A query engine can filter and aggregate those batches. A Python, JavaScript, Rust, Java, or R client can receive results without forcing every value through a text or row-object format.',
        {
          type: 'table',
          headers: ['Boundary', 'Why Arrow fits', 'What can still copy'],
          rows: [
            ['pandas or Polars to query engine', 'shared column buffers match vector execution', 'object dtype columns or unsupported extension types'],
            ['Parquet reader to DataFusion or DuckDB-style execution', 'decoded columns become batch input', 'compressed pages must still be decoded from storage'],
            ['Rust or C++ service to Python client', 'schema and buffers avoid per-cell JSON', 'Python object materialization if user asks for Python scalars'],
            ['Flight RPC service to analytics client', 'streams RecordBatches over gRPC using IPC', 'network transport copies and validation at trust boundaries'],
            ['GPU or device-aware pipelines', 'Arrow has device data interface ideas', 'host-device transfer if memory is not actually shared'],
          ],
        },
        'Arrow also gives educators a rare systems teaching object. It connects data structures to hardware directly: a bitmap is not an abstract set; it is 1 bit per logical slot. An offsets buffer is not an index metaphor; it is the integer array that slices a byte buffer. A RecordBatch is not a dataframe; it is the unit that lets kernels assume equal length across columns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Arrow is not a database. It does not provide transactions, indexes, query planning, replication, durability, or storage management. It is a memory format, IPC format, libraries, and related interoperability tools. A database can use Arrow at its edges or inside execution, but Arrow does not replace the database.',
        'Arrow is not Parquet in RAM. Parquet is a durable compressed columnar file format. It is optimized for storage, statistics, encodings, and skipping row groups. Arrow is optimized for in-memory processing and interchange. A common pipeline decodes Parquet into Arrow, computes on Arrow, and may later write Parquet again.',
        'Zero-copy can fail for honest reasons. The consumer may need different endianness, different device memory, different alignment, a consolidated chunk, decoded dictionaries, validated UTF-8, or native language objects. A zero-copy claim is only true for the specific boundary and access pattern being measured.',
        'Nested data can also become branchy. Lists, structs, maps, unions, and multiple validity levels are still more regular than arbitrary object graphs, but kernels must combine parent and child validity, walk offsets, and handle empty or null ranges. Arrow makes this tractable; it does not make it free.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a 100 million row events table with columns user_id: Int64, country: Utf8, latency_ms: Int32, revenue: Float64, and error: Boolean. The query is: count errors and compute average latency for country = IN.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Row-object scan:',
            '  for each event object:',
            '    load object header and field pointers',
            '    load country string object',
            '    compare string bytes',
            '    load latency_ms and error if country matches',
            '',
            'Arrow scan:',
            '  dictionary decode or compare country indices',
            '  combine country match bitmap with validity bitmap',
            '  scan latency_ms values for matching rows',
            '  count error bitmap bits for matching rows',
          ].join('\n'),
          label: 'The Arrow loop makes the useful bytes explicit',
        },
        'If country has 200 distinct values, dictionary encoding can represent the country column as integer indices plus a tiny dictionary of strings. The query can compare the integer code for IN rather than comparing the bytes I and N 100 million times. The latency column is a contiguous Int32 buffer, so one 64-byte cache line contains 16 latency values.',
        'The validity bitmap for 100 million rows is 12.5 MB. That is small enough to stream cheaply and combine with predicate bitmaps using word-sized operations. A row-object layout might store missingness as pointers, object tags, sentinel objects, or language-level null checks mixed into the main loop.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Separate_unified.png',
          alt: 'Diagram of split L1 cache and unified L2 cache used to reason about data locality',
          caption: 'The same cache hierarchy that punishes pointer-heavy row scans rewards contiguous Arrow buffers. The example query wins because each cache line mostly contains values the query asked for. Source: Wikimedia Commons, Avadlam3, CC BY-SA 4.0.',
        },
        'Now move the result to another process. Without Arrow, the engine might serialize rows to JSON or protobuf records, and the client would allocate new objects. With Arrow IPC or Flight, the engine can send a schema and RecordBatches. The client can inspect the same logical columns as arrays, materializing language objects only if the user asks for them.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Arrow Columnar Format specification at https://arrow.apache.org/docs/format/Columnar.html, Arrow format introduction at https://arrow.apache.org/docs/format/Intro.html, IPC relocation note at https://arrow.apache.org/docs/format/IPC.html, Arrow Flight RPC specification at https://arrow.apache.org/docs/format/Flight.html, and Arrow security considerations at https://arrow.apache.org/docs/format/Security.html.',
        {
          type: 'table',
          headers: ['Study role', 'Topic', 'Why it follows'],
          rows: [
            ['Prerequisite', 'CPU Cache and Memory Hierarchy', 'explains why layout controls speed'],
            ['Prerequisite', 'SIMD and Vectorization', 'explains why typed contiguous buffers matter'],
            ['Mechanism', 'Rank/Select Bitvector', 'turns bitmaps into indexed data structures'],
            ['Mechanism', 'Dictionary Encoding', 'compresses repeated values and speeds equality filters'],
            ['System', 'Parquet Columnar Format Case Study', 'contrasts storage columnar with in-memory columnar'],
            ['System', 'DuckDB Vectorized Execution Case Study', 'shows Arrow-like batches inside a query engine'],
            ['System', 'Dremel Query Engine Case Study', 'adds nested columnar analytics at distributed scale'],
          ],
        },
        'The best follow-up exercise is to build one Arrow string array by hand: write its validity bits, offsets, and byte buffer. Then slice it without copying bytes. That one exercise makes zero-copy less mystical because the slice is just new metadata pointing at old buffers.',
      ],
    },
  ],
};

