// Avro binary encoding: bytes are schema-guided, field names are not repeated,
// and reader/writer schema resolution is the compatibility engine.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'avro-binary-encoding-schema-resolution',
  title: 'Avro Binary Encoding & Schema Resolution',
  category: 'Systems',
  summary: 'Avro writes compact schema-guided binary data without field names in the payload, then resolves writer and reader schemas during decode.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['schema-guided binary', 'reader writer resolution'], defaultValue: 'schema-guided binary' },
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

function avroGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'writerSchema', label: 'writer schema', x: 0.9, y: 2.2, note: notes.writerSchema ?? 'field order' },
      { id: 'record', label: 'record', x: 0.9, y: 5.8, note: notes.record ?? 'values' },
      { id: 'encoder', label: 'encoder', x: 3.1, y: 4.0, note: notes.encoder ?? 'schema walk' },
      { id: 'bytes', label: 'bytes', x: 5.2, y: 4.0, note: notes.bytes ?? 'no names' },
      { id: 'readerSchema', label: 'reader schema', x: 7.4, y: 2.2, note: notes.readerSchema ?? 'expected shape' },
      { id: 'resolver', label: 'resolver', x: 7.4, y: 5.8, note: notes.resolver ?? 'match fields' },
      { id: 'object', label: 'object', x: 9.4, y: 4.0, note: notes.object ?? 'decoded' },
    ],
    edges: [
      { id: 'e-ws-encoder', from: 'writerSchema', to: 'encoder', weight: '' },
      { id: 'e-record-encoder', from: 'record', to: 'encoder', weight: '' },
      { id: 'e-encoder-bytes', from: 'encoder', to: 'bytes', weight: '' },
      { id: 'e-bytes-resolver', from: 'bytes', to: 'resolver', weight: '' },
      { id: 'e-rs-resolver', from: 'readerSchema', to: 'resolver', weight: '' },
      { id: 'e-resolver-object', from: 'resolver', to: 'object', weight: '' },
    ],
  }, { title });
}

function* schemaGuidedBinary() {
  const activeNodes = ['writerSchema', 'record', 'encoder', 'bytes'];
  yield {
    state: avroGraph('Avro binary bytes depend on the writer schema'),
    highlight: { active: activeNodes, compare: ['readerSchema'] },
    explanation: `Avro binary encoding does not include field names or per-value type tags. The writer schema tells the encoder which ${activeNodes.length} active components to walk and in what order.`,
    invariant: 'Without the writer schema, raw Avro binary bytes are not self-describing records.',
  };

  const fieldRows = [
    { id: 'id', label: 'id: long' },
    { id: 'name', label: 'name: string' },
    { id: 'vip', label: 'vip: boolean' },
    { id: 'payload', label: 'payload' },
  ];
  yield {
    state: labelMatrix(
      'Record schema and bytes',
      fieldRows,
      [
        { id: 'binary piece', label: 'binary piece' },
        { id: 'why compact', label: 'why compact' },
      ],
      [
        ['zigzag varint', 'no field name'],
        ['length + UTF-8', 'no separator'],
        ['one byte', 'known type'],
        ['concatenated', 'schema gives order'],
      ],
    ),
    highlight: { active: ['id:binary piece', 'name:binary piece', 'payload:why compact'] },
    explanation: `The payload is compact because the ${fieldRows.length} field names and types live in the schema, not in every record. That is why a registry or container header matters.`,
  };

  const formats = ['Avro', 'Protobuf', 'JSON'];
  yield {
    state: labelMatrix(
      'Avro versus Protobuf shape',
      [
        { id: 'avro', label: formats[0] },
        { id: 'proto', label: formats[1] },
        { id: 'json', label: formats[2] },
      ],
      [
        { id: 'payload carries', label: 'payload carries' },
        { id: 'decode needs', label: 'decode needs' },
      ],
      [
        ['values in schema order', 'writer schema'],
        ['field numbers + wire types', 'schema for meaning'],
        ['names + values', 'parser only'],
      ],
    ),
    highlight: { active: ['avro:payload carries', 'proto:payload carries'], compare: ['json:payload carries'] },
    explanation: `${formats[0]} is more schema-dependent than ${formats[1]} at the raw byte level. ${formats[1]} carries field numbers and wire types; ${formats[0]} relies on the writer schema to know what each byte sequence means.`,
  };

  const registryNotes = { writerSchema: 'registered', bytes: 'magic+id+Avro', readerSchema: 'fetch by id', resolver: 'decode' };
  yield {
    state: avroGraph('Schema Registry puts a schema id before the Avro payload', registryNotes),
    highlight: { active: ['writerSchema', 'bytes', 'readerSchema', 'resolver'], found: ['object'] },
    explanation: `Confluent Avro serialization does not include the whole schema in each Kafka message. It writes a ${registryNotes.bytes} envelope — a magic byte and schema id — then the normal Avro binary payload. Consumers ${registryNotes.readerSchema} from the registry.`,
  };
}

function* readerWriterResolution() {
  const resolutionNotes = { writerSchema: 'v1', readerSchema: 'v2', resolver: 'match by name' };
  yield {
    state: avroGraph('Reader and writer schemas can differ compatibly', resolutionNotes),
    highlight: { active: ['writerSchema', 'readerSchema', 'resolver'], found: ['object'] },
    explanation: `Avro decoding uses both schemas. The writer schema (${resolutionNotes.writerSchema}) explains the bytes; the reader schema (${resolutionNotes.readerSchema}) says what shape the consumer wants. Resolution uses a ${resolutionNotes.resolver} strategy and applies defaults where allowed.`,
    invariant: 'Compatibility is a schema-resolution rule, not byte guessing.',
  };

  const defaultValue = 0;
  const addedField = 'risk_score';
  yield {
    state: labelMatrix(
      'Adding a field with a default',
      [
        { id: 'writer', label: 'writer v1' },
        { id: 'reader', label: 'reader v2' },
        { id: 'bytes', label: 'old bytes' },
        { id: 'result', label: 'decoded result' },
      ],
      [
        { id: 'has risk', label: `${addedField}?` },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['no', 'bytes lack field'],
        [`yes default=${defaultValue}`, 'compatible'],
        ['no bytes', 'resolver supplies default'],
        [`${addedField}=${defaultValue}`, 'new reader works'],
      ],
    ),
    highlight: { active: ['reader:outcome', 'result:has risk'], compare: ['writer:has risk'] },
    explanation: `A new reader can read old data if the added field ${addedField} has a default. The default ${defaultValue} is not hidden in old bytes; it comes from the reader schema during resolution.`,
  };

  const outcomeRows = [
    { id: 'same', label: 'same field' },
    { id: 'newDefault', label: 'new field + default' },
    { id: 'newNoDefault', label: 'new field no default' },
    { id: 'typeChange', label: 'bad type change' },
  ];
  const safeCount = 2;
  const breakingCount = outcomeRows.length - safeCount;
  yield {
    state: labelMatrix(
      'Resolution outcomes',
      outcomeRows,
      [
        { id: 'reader action', label: 'reader action' },
        { id: 'compatibility', label: 'compatibility' },
      ],
      [
        ['read value', 'safe'],
        ['use default', 'safe'],
        ['cannot fill', 'breaking'],
        ['cannot promote', 'breaking'],
      ],
    ),
    highlight: { active: ['newDefault:reader action'], compare: ['newNoDefault:compatibility', 'typeChange:compatibility'] },
    explanation: `Avro compatibility is not simply "field was added." Of ${outcomeRows.length} resolution cases, ${safeCount} are safe and ${breakingCount} are breaking — it depends on whether the reader can construct its expected record from bytes written with the writer schema.`,
  };

  const envelopeRows = [
    { id: 'container', label: 'Avro file' },
    { id: 'kafka', label: 'Kafka+registry' },
    { id: 'single', label: 'single-object' },
  ];
  yield {
    state: labelMatrix(
      'Container file versus Kafka message',
      envelopeRows,
      [
        { id: 'schema location', label: 'schema location' },
        { id: 'use case', label: 'use case' },
      ],
      [
        ['file header', 'splittable files'],
        ['registry id', 'event streams'],
        ['fingerprint marker', 'standalone object'],
      ],
    ),
    highlight: { active: ['container:schema location', 'kafka:schema location'], found: ['single:schema location'] },
    explanation: `Avro has ${envelopeRows.length} envelope types. The raw binary record is schema-guided; a ${envelopeRows[0].label}, ${envelopeRows[1].label}, or ${envelopeRows[2].label} marker tells readers which writer schema to use.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'schema-guided binary') yield* schemaGuidedBinary();
  else if (view === 'reader writer resolution') yield* readerWriterResolution();
  else throw new InputError('Pick an Avro encoding view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Schema-guided binary" shows encoding: a writer schema, a record, an encoder, and the resulting bytes. Highlighted nodes are the active participants at each step. "Reader writer resolution" shows decoding: the writer schema, the reader schema, and the resolver that bridges them. When a node turns green ("found"), the decode succeeded. When the matrix view appears, active cells are the mechanism being explained and compare cells show the contrast.',
        'Watch for the matrix rows labeled "binary piece" and "why compact" in the encoding view. They show exactly which encoding each field type uses and why no field name appears in the payload. In the resolution view, watch for the "outcome" column: it tells you whether each field scenario is safe or breaking.',
        {type: 'image', src: './assets/gifs/avro-binary-encoding-schema-resolution.gif', alt: 'Animated walkthrough of the avro binary encoding schema resolution visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Kafka topic receiving 500,000 events per second carries the same record shape in every message. If each message includes field names like "customer_id", "order_id", and "total_cents" as literal text, those repeated strings can double the payload size. Over a day, that is terabytes of redundant metadata. Avro exists to eliminate that repetition by making the schema external to the payload.',
        'The second problem is evolution. Data written today will be read by services deployed next month. A producer might add a field, widen an integer, or drop something no longer needed. If the reader and writer must always agree on the exact same schema at the exact same moment, every deployment becomes a coordinated lockstep. Avro solves this by defining explicit resolution rules between a writer schema and a reader schema, so producers and consumers can evolve independently within defined compatibility bounds.',
        {type: 'callout', text: 'Avro makes schema identity part of the runtime data structure so compact bytes can evolve without guessing their meaning.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest encoding is JSON: write each field as a name-value pair, separate records with newlines or array brackets, and let any consumer parse the text. JSON is self-describing because the field names travel with the data. A human can read it. A new consumer can decode it without any external metadata. For prototyping and low-volume APIs, this works fine.',
        'The simplest compact encoding is a fixed-position binary format: agree on a field order, write raw bytes in that order, and require every reader to know the layout. C structs work this way. The payload is tiny because nothing besides the values is stored.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'JSON fails at scale. A record with five string field names averaging 12 characters each adds 60 bytes of metadata per record. At 500,000 records per second, that is 30 MB/s of pure field names. Numbers are stored as decimal text, so the integer 1000000 takes 7 bytes instead of 3 (ZigZag varint). Over a retention window of seven days, the wasted space is measured in terabytes.',
        'Fixed-position binary fails at evolution. If a writer adds a field between customer_id and total_cents, every existing reader now interprets total_cents bytes as the new field. The bytes are still valid binary, but their meaning has shifted. There is no mechanism to detect the mismatch, no way to skip unknown fields, and no way to supply defaults for missing fields. A single schema change requires redeploying every reader simultaneously.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the schema from the payload, but make the schema identity travel with the data. The writer schema defines the byte order and types at write time. The reader schema defines the shape the consumer wants at read time. A deterministic resolution algorithm bridges the two. This gives you the compactness of fixed-position binary with the evolvability of a self-describing format.',
        'The key contract: raw Avro bytes are never self-describing. They are only meaningful when paired with the specific writer schema that produced them. The same byte sequence can mean entirely different things under different schemas. A byte might be part of a string length, a ZigZag-encoded integer, a union branch index, or a block count, depending on where the schema walk is. Correctness requires carrying the writer schema identity alongside the data, always.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Encoding is a schema walk. The encoder visits each field in the writer schema in declaration order and emits the field value using that field\'s Avro type. An int or long is encoded as a ZigZag varint: the value is mapped through (n << 1) ^ (n >> 31) for int (or >> 63 for long) to move the sign bit to the least significant position, then encoded as a base-128 varint. A string is encoded as a varint length followed by UTF-8 bytes. A boolean is a single byte: 0x00 for false, 0x01 for true. Arrays and maps are encoded in blocks, where each block starts with a count (and optional byte size) followed by that many items. A union is encoded as the zero-based branch index (varint) followed by the branch value.',
        'No field names, no field separators, no type tags appear in the record payload. The decoder walks the same writer schema in the same order and knows exactly how many bytes each value consumes. A string\'s varint length tells the decoder where the UTF-8 ends. A varint\'s continuation bits tell the decoder when the integer is complete. The schema provides the field sequence; the encoding rules provide the value boundaries.',
        'The envelope carries the schema identity. In an Avro object container file (.avro), the file header contains the full writer schema as JSON plus a 16-byte sync marker for block splitting. In Confluent-style Kafka serialization, a 5-byte prefix (magic byte 0x00 plus a 4-byte big-endian schema id) precedes the Avro payload. Consumers use the schema id to fetch the writer schema from Schema Registry. In Avro single-object encoding, a 2-byte marker plus an 8-byte Rabin fingerprint of the schema precedes the payload.',
        {type: 'image', src: 'https://croz.net/app/uploads/2022/12/1_Rh-wj85RrhOqSpWAf6U1jQ.png', alt: 'Avro payload with magic byte and schema id prepended before Kafka send.', caption: 'The envelope explains how compact Avro bytes still carry a path back to the writer schema. (Source: croz.net)'},
        'Decoding with resolution uses both schemas. The decoder reads bytes according to the writer schema (because the writer schema dictates what was written), but it constructs the output according to the reader schema. For each field in the reader schema, the resolver looks for a matching field in the writer schema by name (or alias). If found, the value is read and possibly promoted (e.g., int to long). If not found, the reader field must have a default, and the resolver inserts that default. Writer fields that the reader does not mention are skipped: the decoder reads past them using the writer schema\'s type information but discards the values.',
        {type: 'image', src: 'https://docs.spring.io/spring-cloud-stream/docs/Fishtown.M2/reference/html/images/schema_reading.png', alt: 'Schema reading flow that chooses writer schema, optional reader schema, and deserializer.', caption: 'Deserialization becomes explicit when the reader receives both the writer schema and the reader schema. (Source: docs.spring.io)'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on a clean separation of concerns. The writer schema is the authority on what the bytes mean. The reader schema is the authority on what the consumer needs. The resolution algorithm is a deterministic function from (writer schema, reader schema, raw bytes) to (decoded record or error). No guessing, no heuristics, no version negotiation at runtime.',
        'The invariant that makes evolution safe: every field in the reader schema is either (a) present in the writer schema and type-compatible, so the value comes from the bytes, or (b) absent from the writer schema but has a default, so the value comes from the reader schema. If neither condition holds, resolution fails immediately rather than producing corrupt data. This is why adding a field without a default is a breaking change for backward compatibility: old bytes cannot supply the value, and no default exists to fill the gap.',
        'Type promotions are safe because they are defined as lossless widenings: int to long (32-bit to 64-bit, no precision loss), int to float (exact for values up to 2^24), float to double (exact), and bytes to string (when the bytes are valid UTF-8). Avro does not allow narrowing promotions like long to int because they can silently truncate values. The resolution algorithm rejects any type pair not on the explicit promotion list.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Encoding cost is O(n) in the number of fields and the total size of their values. Each field requires one schema lookup (constant time in a precompiled schema) and one type-specific encoding step. ZigZag varint encoding for a 64-bit long takes at most 10 bytes and requires a few shifts and byte writes. There is no sorting, no hashing, and no compression step in the base encoding.',
        'Decoding cost is also O(n). With matching schemas, decoding is a straight walk: read each field in order, no name lookups needed. With schema resolution, the decoder must match reader fields to writer fields. A naive implementation does this per-record with O(r * w) name comparisons, but in practice the resolver is compiled once into a read plan (a function or lookup table that maps writer field positions to reader field positions), and each record decode is then O(n) with small constants.',
        'Space cost is where Avro wins. A JSON record with fields "order_id": 42, "customer_id": "abc", "total_cents": 9999 takes about 55 bytes. The same Avro record takes about 8 bytes: varint(42) = 1 byte, varint(3) + "abc" = 4 bytes, varint(9999) = 3 bytes. The schema overhead is amortized: one schema in a file header or one registry lookup per consumer startup, versus field names repeated in every record.',
        'The cost you pay is the schema dependency. Every decode requires the writer schema, which means a registry lookup, a file header read, or a fingerprint match. In Kafka with Schema Registry, the first decode of a new schema id triggers a network call. Subsequent decodes hit a local cache. If the registry is down, new schema ids cannot be resolved, and consumers stall on unfamiliar data.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Kafka event pipelines are the dominant use case. Confluent Schema Registry provides the schema id lookup, compatibility enforcement, and schema evolution governance. Producers register schemas before sending, and consumers fetch schemas on first encounter. The compact payload reduces broker storage, network bandwidth, and consumer memory pressure.',
        'Data lake ingestion uses Avro object container files (.avro). The file header carries the writer schema, and sync markers allow MapReduce-style splitting. Apache Hive, Spark, and Flink all read Avro natively. The schema-in-header design means a single file is self-contained: you do not need an external registry to decode it years later.',
        {type: 'image', src: 'https://docs.confluent.io/platform/current/_images/schema-registry-design-kafka.png', alt: 'Confluent Schema Registry primary-secondary architecture backed by the Kafka schemas log.', caption: 'Schema lookup is infrastructure, not decoration: registry caches, primary election, and the schemas log keep ids meaningful. (Source: docs.confluent.io)'},
        'Change Data Capture (CDC) systems like Debezium emit Avro-encoded database change events. Each event carries the before and after row state. Avro\'s schema evolution lets downstream consumers handle column additions and type changes without synchronized redeployment. The schema registry acts as the contract layer between the database and the stream consumers.',
        'RPC frameworks like Apache Avro RPC (less common today than gRPC) use Avro for request and response serialization. The handshake exchanges schemas so that client and server can evolve independently. In practice, most new RPC systems choose Protobuf, but Avro RPC still appears in legacy Hadoop ecosystems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Loss of the writer schema is catastrophic. Raw Avro bytes without the writer schema are unrecoverable. If a registry is deleted, a schema id is reassigned, a file header is corrupted, or a replay tool strips the envelope, the data is gone. There is no way to reverse-engineer the schema from the bytes because the same byte patterns are valid under many different schemas. This makes schema storage a durability requirement, not a convenience.',
        'Avro cannot detect semantic drift. A field named total_cents can change its meaning from cents to microdollars, and schema resolution will succeed because the Avro type (long) did not change. The bytes are compatible, but the business logic is broken. Schema resolution protects structural compatibility, not semantic compatibility. Teams need documentation, naming conventions, or higher-level contracts to prevent silent meaning changes.',
        'Union handling is a common source of bugs. A union ["null", "string"] with default null behaves differently from ["string", "null"] with default "". The default must match the first branch of the union. Getting this wrong causes resolution failures that are hard to diagnose because the error messages reference branch indices rather than human-readable types. Adding branches to a union is also a compatibility hazard: forward compatibility requires old readers to handle new branches they have never seen.',
        'Human inspection is difficult. Unlike JSON or even Protobuf (which has a text format and field numbers in the wire format), Avro binary is completely opaque without the schema. Debugging a production issue requires finding the exact writer schema, which may involve tracing a schema id through a registry, finding the right version, and running a deserializer manually. For teams accustomed to reading JSON payloads in log files, this is a significant workflow change.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Writer schema v1 defines an OrderPlaced record: { "type": "record", "name": "OrderPlaced", "fields": [ {"name": "order_id", "type": "long"}, {"name": "customer_id", "type": "string"}, {"name": "total_cents", "type": "long"} ] }. The producer writes a record with order_id=42, customer_id="alice", total_cents=9999.',
        'Encoding step by step. order_id=42: ZigZag maps 42 to 84 (42 << 1 ^ 42 >> 63 = 84), varint(84) = 0x54 (one byte, since 84 < 128). customer_id="alice": varint(5) = 0x05 for the length, then 5 UTF-8 bytes "alice" = 0x61 0x6C 0x69 0x63 0x65. total_cents=9999: ZigZag maps 9999 to 19998, varint(19998) = 0x9E 0x9C 0x01 (19998 in base-128: 19998 & 0x7F = 0x1E with continuation, 19998 >> 7 = 156, 156 & 0x7F = 0x1C with continuation, 156 >> 7 = 1, final byte 0x01). Total payload: 9 bytes. In Kafka with a 5-byte Confluent header (magic byte + 4-byte schema id), the message is 14 bytes.',
        'Now a fraud service deploys reader schema v2, which adds a fourth field: {"name": "risk_score", "type": "long", "default": 0}. The fraud service reads the old v1 message. Resolution: order_id matches by name, read from bytes. customer_id matches by name, read from bytes. total_cents matches by name, read from bytes. risk_score is absent from the writer schema, but has default 0, so the resolver inserts 0. Decoded result: {order_id: 42, customer_id: "alice", total_cents: 9999, risk_score: 0}.',
        'If v2 had defined risk_score without a default, resolution would fail: the resolver has no value to produce and no default to fall back on. If v2 had changed total_cents from long to string, resolution would also fail: long-to-string is not on the safe promotion list. The old bytes are valid, but the reader schema is incompatible. These failures are detected at schema resolution time, not at some later point when the application tries to use the value.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The authoritative reference is the Apache Avro specification (avro.apache.org/docs/current/specification/), which defines the binary encoding rules, schema resolution algorithm, and container file format. The Confluent Schema Registry documentation (docs.confluent.io) covers the Kafka integration, compatibility modes (backward, forward, full, transitive variants), and the wire format for schema ids. Martin Kleppmann\'s "Designing Data-Intensive Applications" (Chapter 4) provides an excellent comparison of Avro, Protobuf, and Thrift encoding tradeoffs.',
        'Study Base-128 Varint & ZigZag Encoding next to understand the integer encoding that Avro uses for all numeric fields and length prefixes. Study Protobuf Wire Format to compare a format that embeds field numbers and wire types in the payload, trading some compactness for self-describing field identity. Study Schema Registry to understand the operational infrastructure that makes Avro practical in distributed systems: compatibility enforcement, id assignment, caching, and failover. Study Kafka Log to see why compact records matter in append-only event streams where broker storage and replication bandwidth are first-order costs.',
      ],
    },
  ],
};
