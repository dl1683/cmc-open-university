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
      heading: 'What it is',
      paragraphs: [
        'Avro is a schema-driven binary serialization format. The binary payload writes values according to the writer schema; it does not repeat field names, field separators, or self-contained per-value type metadata. Decoding therefore requires the writer schema.',
        'Avro also defines schema resolution: the writer schema explains the bytes, and the reader schema explains the shape the consumer wants. Compatible evolution is the ability to resolve between those two schemas.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a record, Avro writes fields in schema order. Integers and longs use variable-length ZigZag encoding, strings use a length followed by UTF-8 bytes, arrays and maps are encoded in blocks, and unions include a branch index. The schema supplies the field names and types.',
        'When a reader schema differs from the writer schema, Avro matches fields by name. If the reader expects a field that the writer did not provide, the reader needs a default. If types cannot be promoted or resolved, the read fails.',
      ],
    },
    {
      heading: 'Case study: adding risk_score',
      paragraphs: [
        'A producer writes OrderPlaced v1 with order_id and total_cents. A new consumer wants risk_score. If the reader schema adds risk_score with default 0, old bytes decode because the resolver supplies the default. If the field has no default, old bytes cannot construct the new reader record. The bytes did not change; the schema-resolution contract did.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Avro payloads are compact because the schema is out of band, but that creates an operational dependency on schema delivery. Object container files include the schema in the file header. Kafka deployments often use Schema Registry, where messages carry a magic byte and schema id before the normal Avro binary payload. Cold consumers need schema lookup and caching.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Avro specification at https://avro.apache.org/docs/1.11.1/specification/ and Confluent Avro serializer docs at https://docs.confluent.io/platform/current/schema-registry/fundamentals/serdes-develop/serdes-avro.html. Study Base-128 Varint & ZigZag Encoding, Protobuf Wire Format, Schema Registry Case Study, Kafka Log Case Study, and Parquet Columnar Format next.',
      ],
    },
  ],
};
