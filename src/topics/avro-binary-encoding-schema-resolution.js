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
  yield {
    state: avroGraph('Avro binary bytes depend on the writer schema'),
    highlight: { active: ['writerSchema', 'record', 'encoder', 'bytes'], compare: ['readerSchema'] },
    explanation: 'Avro binary encoding does not include field names or per-value type tags. The writer schema tells the encoder which fields to write and in what order.',
    invariant: 'Without the writer schema, raw Avro binary bytes are not self-describing records.',
  };

  yield {
    state: labelMatrix(
      'Record schema and bytes',
      [
        { id: 'id', label: 'id: long' },
        { id: 'name', label: 'name: string' },
        { id: 'vip', label: 'vip: boolean' },
        { id: 'payload', label: 'payload' },
      ],
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
    explanation: 'The payload is compact because the field names and types live in the schema, not in every record. That is why a registry or container header matters.',
  };

  yield {
    state: labelMatrix(
      'Avro versus Protobuf shape',
      [
        { id: 'avro', label: 'Avro' },
        { id: 'proto', label: 'Protobuf' },
        { id: 'json', label: 'JSON' },
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
    explanation: 'Avro is more schema-dependent than Protobuf at the raw byte level. Protobuf carries field numbers and wire types; Avro relies on the writer schema to know what each byte sequence means.',
  };

  yield {
    state: avroGraph('Schema Registry puts a schema id before the Avro payload', { writerSchema: 'registered', bytes: 'magic+id+Avro', readerSchema: 'fetch by id', resolver: 'decode' }),
    highlight: { active: ['writerSchema', 'bytes', 'readerSchema', 'resolver'], found: ['object'] },
    explanation: 'Confluent Avro serialization does not include the whole schema in each Kafka message. It writes a magic byte and schema id, then the normal Avro binary payload. Consumers fetch the schema by id.',
  };
}

function* readerWriterResolution() {
  yield {
    state: avroGraph('Reader and writer schemas can differ compatibly', { writerSchema: 'v1', readerSchema: 'v2', resolver: 'match by name' }),
    highlight: { active: ['writerSchema', 'readerSchema', 'resolver'], found: ['object'] },
    explanation: 'Avro decoding uses both schemas. The writer schema explains the bytes; the reader schema says what shape the consumer wants. Resolution matches fields by name and applies defaults where allowed.',
    invariant: 'Compatibility is a schema-resolution rule, not byte guessing.',
  };

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
        { id: 'has risk', label: 'risk_score?' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['no', 'bytes lack field'],
        ['yes default=0', 'compatible'],
        ['no bytes', 'resolver supplies default'],
        ['risk_score=0', 'new reader works'],
      ],
    ),
    highlight: { active: ['reader:outcome', 'result:has risk'], compare: ['writer:has risk'] },
    explanation: 'A new reader can read old data if the added field has a default. The default is not hidden in old bytes; it comes from the reader schema during resolution.',
  };

  yield {
    state: labelMatrix(
      'Resolution outcomes',
      [
        { id: 'same', label: 'same field' },
        { id: 'newDefault', label: 'new field + default' },
        { id: 'newNoDefault', label: 'new field no default' },
        { id: 'typeChange', label: 'bad type change' },
      ],
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
    explanation: 'Avro compatibility is not simply "field was added." It is whether the reader can construct its expected record from bytes written with the writer schema.',
  };

  yield {
    state: labelMatrix(
      'Container file versus Kafka message',
      [
        { id: 'container', label: 'Avro file' },
        { id: 'kafka', label: 'Kafka+registry' },
        { id: 'single', label: 'single-object' },
      ],
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
    explanation: 'Avro has several envelopes. The raw binary record is schema-guided; a file, registry header, or single-object marker tells readers which writer schema to use.',
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
      heading: 'Why This Exists',
      paragraphs: [
        `Avro exists for systems where records are written many times, stored for a long time, and read by programs that may not deploy at the same pace as the writer. A Kafka topic, a lake of event files, or a stream of CDC records cannot afford to repeat a full field name and type description beside every value. That would be easy to inspect, but it wastes space and bandwidth exactly where the same record shape appears millions or billions of times.`,
        `The format chooses a different contract. The bytes are compact because they are written by walking a schema. The payload contains values, not field labels. A record field named id is not stored as the characters i and d. A long is not preceded by a general-purpose "this is a long" tag. The writer schema supplies the order and type, and the decoder must have that writer schema to interpret the raw bytes correctly.`,
        `The second reason Avro exists is schema evolution. Data outlives applications. A producer may add a field, rename a field through an alias, widen an integer type, or stop sending something that old consumers still know about. Avro's reader/writer resolution rules make compatibility an explicit algorithm instead of an informal promise hidden in application code.`,
      ],
    },
    {
      heading: 'The Obvious Approach Fails',
      paragraphs: [
        `The obvious human-friendly encoding is JSON: write field names and values together, let each consumer pick out the fields it understands, and ignore the rest. That is robust for small messages and debugging, but expensive for high-volume pipelines. The same names repeat in every row, numbers become decimal text, and consumers still need separate conventions for dates, decimals, unions, binary blobs, and compatibility.`,
        `The obvious compact encoding is the opposite: write fields in a fixed order and require every reader to know that order. That works until a writer adds a field in the middle, changes a type, or ships before every reader has updated. A single schema mismatch can shift the meaning of every following byte. The data may still be valid bytes, but the old reader is now reading the wrong contract.`,
        `Avro keeps the compactness of ordered binary fields but refuses to make that order an undocumented convention. The writer schema is part of the data contract, and the reader schema is part of the read contract. Compatibility is decided by resolving those two schemas, not by hoping every service has the same source file at the same moment.`,
      ],
    },
    {
      heading: 'Core Mechanism',
      paragraphs: [
        `Avro binary encoding is a schema walk. For a record, the encoder visits fields in the order declared by the writer schema and emits each field value using that field's type. Longs and ints use variable-length ZigZag encoding. Strings are encoded as a length followed by UTF-8 bytes. Bytes are encoded as a length followed by raw bytes. Arrays and maps are encoded in blocks. A union value is encoded by writing the selected branch index and then the branch payload.`,
        `There are no field separators in an ordinary record payload because the schema tells the decoder when one value ends and the next begins. There are no field names because the schema already names the current field. There are no per-field tags in the Protobuf sense because Avro expects the decoder to walk the writer schema in the same order the encoder used.`,
        `That makes the envelope important. An Avro object container file stores schema metadata in the file header. Confluent-style Kafka serialization usually writes a magic byte and schema id before the Avro payload, then expects consumers to fetch the writer schema from Schema Registry. Avro single-object encoding uses a marker and fingerprint. The raw payload stays small because some surrounding mechanism tells the reader which writer schema produced it.`,
      ],
    },
    {
      heading: 'Reader/Writer Resolution',
      paragraphs: [
        `Decoding starts with the writer schema because the writer schema explains the bytes. If the reader wants the same schema, the decoder can materialize the record directly. If the reader uses a different schema, Avro resolves the writer schema against the reader schema while reading.`,
        `For records, fields are matched by name, not by position in the reader schema. If the writer produced a field that the reader does not mention, that field can be skipped. If the reader expects a field that the writer did not produce, the reader field must have a default value. The default is not stored in old data. It is inserted by the reader during resolution.`,
        `For primitive types, Avro allows only defined promotions such as int to long, int to float, long to double, and similar safe widening rules. For named types, names and aliases matter. For unions, the resolver must find a reader branch that can accept the writer branch. These rules are why schema compatibility is more precise than "we added a field" or "we changed a type." The question is whether the reader can construct its requested value from bytes written under the writer schema.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Avro works because it separates two jobs that are often blended together. Byte interpretation belongs to the writer schema. Consumer shape belongs to the reader schema. The resolver bridges them. That split lets old bytes remain meaningful after a reader changes, provided the new reader schema gives the resolver enough information to fill gaps or ignore surplus data.`,
        `The invariant is simple: never guess from bytes alone. The same sequence of bytes can mean different things under different schemas. A byte sequence could be part of a string length, an integer, a union branch index, or a block count depending on where the schema walk is. Correctness comes from carrying the writer schema identity with the data and applying a deterministic resolution rule at read time.`,
        `Defaults are the cleanest example. When a reader adds risk_score with default 0, old records do not become magically rewritten. The resolver reads the old writer fields, sees that risk_score is absent from the writer schema, and supplies the reader default. If that default is missing, the algorithm has no value to produce and the read must fail.`,
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `Suppose writer schema v1 is an OrderPlaced record with order_id as a long, customer_id as a string, and total_cents as a long. The writer emits those three values in that order. A Kafka message using a registry envelope carries only the registry header plus the compact Avro payload. The field names are not repeated in the message.`,
        `Now a fraud service wants schema v2 with an extra field, risk_score, defaulting to 0. The fraud service reads an old v1 message. The registry id gives it the v1 writer schema. The service's code supplies the v2 reader schema. Resolution matches order_id, customer_id, and total_cents by name, then notices that risk_score exists only in the reader schema. Because risk_score has a default, the decoded object becomes order_id, customer_id, total_cents, risk_score = 0.`,
        `If v2 added risk_score without a default, the same old bytes would fail for that reader. Nothing in the v1 payload can produce a risk score, and Avro does not invent one. If v2 changed total_cents from long to string, the read would also fail because that is not a safe promotion. The compatibility result follows from schema rules, not from the apparent shape of a JSON example in a design doc.`,
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        `Treat schema distribution as production infrastructure. If messages carry registry ids, consumers need reliable registry access, local schema caches, clear cache eviction behavior, and a defined response when a schema id is unknown. A service that can receive bytes but cannot fetch the writer schema is not a working Avro consumer.`,
        `Choose compatibility modes deliberately. Backward compatibility usually means new readers can read old data. Forward compatibility usually means old readers can read new data. Full compatibility asks for both. A topic that stores long-lived events often needs stricter compatibility than a short-lived internal stream. A dead-letter policy should preserve the schema id or full envelope so failures can be replayed with the exact writer schema.`,
        `Be careful with defaults, aliases, and unions. Defaults should be semantically real values, not placeholders that hide data-quality problems. Aliases can make renames compatible, but only when every relevant reader and registry rule uses them correctly. Union branch order and default branch selection can surprise teams, so schema reviews should include actual old-to-new and new-to-old decode tests.`,
      ],
    },
    {
      heading: 'Where It Matters',
      paragraphs: [
        `Avro is a natural fit for event streams, data lake files, CDC pipelines, Hadoop-era batch jobs, and schema-registry-centered Kafka platforms. Those systems value compact payloads, explicit schemas, fast sequential reads, and independent producer and consumer deploys. Avro object container files also fit file-oriented analytics because they carry schema metadata and sync markers for splitting.`,
        `It is less attractive when humans need to inspect raw payloads frequently, when messages must be self-describing without an external schema lookup, or when the organization cannot enforce schema governance. JSON, Protobuf, FlatBuffers, Parquet, and Arrow each make different tradeoffs. Avro's tradeoff is strongest when the writer schema can be reliably found and evolution is a first-class part of the platform.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `The most common failure is losing the writer schema. Raw Avro binary is not a self-describing record. If a registry is deleted, a schema id is reused incorrectly, a file header is stripped, or a replay tool stores only the payload bytes, future readers may be unable to decode data that was valid when written.`,
        `The second failure is treating optional-looking fields casually. In Avro, a field added to the reader needs a default to read old data. A union with null is not enough unless the schema and default are written correctly. The default must match the field type, and the application must be ready for the value it receives.`,
        `The third failure is silent semantic drift. A technically compatible schema can still break consumers if a field keeps the same Avro type but changes meaning, units, precision, timezone assumptions, or identity. Schema resolution can protect byte-level compatibility; it cannot prove that total_cents still means cents instead of micros.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Base-128 Varint & ZigZag Encoding for the integer encoding Avro uses under the hood. Study Protobuf Wire Format Case Study to compare a payload that carries field numbers and wire types. Study Schema Registry Case Study for the operational side of schema ids, compatibility checks, and rollout control. Study Kafka Log Case Study to see why compact records matter in append-only event streams. Study Parquet Columnar Format Case Study to contrast row-oriented event encoding with columnar analytics storage.`,
        `Primary references worth reading after the local topics are the Apache Avro specification and the Confluent Avro serializer documentation. Use them as rulebooks: the important lesson is not that Avro is "binary JSON", but that schema identity and schema resolution are part of the runtime data structure.`,
      ],
    },
  ],
};
