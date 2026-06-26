// Protocol Buffers wire format: a stream of tagged fields where tags combine
// field number and wire type, and unknown fields can be skipped.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'protobuf-wire-format-case-study',
  title: 'Protobuf Wire Format Case Study',
  category: 'Systems',
  summary: 'Protocol Buffers encode messages as tag-value fields: each tag packs field number plus wire type, then values use varint, fixed-width, or length-delimited encodings.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tag-value stream', 'unknown fields evolution'], defaultValue: 'tag-value stream' },
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

function protoGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'schema', label: 'schema', x: 0.7, y: 4.0, note: notes.schema ?? 'ids' },
      { id: 'record', label: 'record', x: 2.25, y: 4.0, note: notes.record ?? 'id,name' },
      { id: 'tag', label: 'tag', x: 3.9, y: 2.15, note: notes.tag ?? 'field+type' },
      { id: 'value', label: 'value', x: 3.9, y: 5.85, note: notes.value ?? 'varint/len' },
      { id: 'wire', label: 'bytes', x: 6.05, y: 4.0, note: notes.wire ?? '08 96 01' },
      { id: 'parser', label: 'parser', x: 8.05, y: 4.0, note: notes.parser ?? 'skip' },
      { id: 'object', label: 'object', x: 9.65, y: 4.0, note: notes.object ?? 'decoded' },
    ],
    edges: [
      { id: 'e-schema-record', from: 'schema', to: 'record', weight: '' },
      { id: 'e-record-tag', from: 'record', to: 'tag', weight: '' },
      { id: 'e-record-value', from: 'record', to: 'value', weight: '' },
      { id: 'e-tag-wire', from: 'tag', to: 'wire', weight: '' },
      { id: 'e-value-wire', from: 'value', to: 'wire', weight: '' },
      { id: 'e-wire-parser', from: 'wire', to: 'parser', weight: '' },
      { id: 'e-parser-object', from: 'parser', to: 'object', weight: '' },
    ],
  }, { title });
}

function* tagValueStream() {
  yield {
    state: protoGraph('A protobuf message is a stream of tagged values'),
    highlight: { active: ['tag', 'value', 'wire'], found: ['parser'] },
    explanation: 'Protocol Buffers do not write field names into every message. They write field tags and values. The schema tells generated code what field number means id, name, email, or anything else.',
    invariant: 'Tag = field_number shifted left by 3 bits, OR wire_type.',
  };

  yield {
    state: labelMatrix(
      'Encoding message { id: 150, name: "Ada" }',
      [
        { id: 'idtag', label: 'id tag' },
        { id: 'idval', label: 'id value' },
        { id: 'nametag', label: 'name tag' },
        { id: 'nameval', label: 'name value' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'bytes', label: 'bytes' },
      ],
      [
        ['field 1, varint', '08'],
        ['150', '96 01'],
        ['field 2, length', '12'],
        ['len=3 + Ada', '03 41 64 61'],
      ],
    ),
    highlight: { active: ['idtag:bytes', 'idval:bytes', 'nametag:bytes'], found: ['nameval:bytes'] },
    explanation: 'Field 1 with wire type 0 produces tag 0x08. The value 150 varint-encodes as 0x96 0x01. Field 2 with wire type 2 produces tag 0x12, followed by a length varint and UTF-8 bytes.',
  };

  yield {
    state: labelMatrix(
      'Core wire types',
      [
        { id: 'v0', label: '0 varint' },
        { id: 'v1', label: '1 64-bit' },
        { id: 'v2', label: '2 length' },
        { id: 'v5', label: '5 32-bit' },
      ],
      [
        { id: 'used by', label: 'used by' },
        { id: 'skip rule', label: 'skip rule' },
      ],
      [
        ['int/bool/enum', 'read varint'],
        ['fixed64/double', 'skip 8 bytes'],
        ['string/bytes/msg', 'read len then skip'],
        ['fixed32/float', 'skip 4 bytes'],
      ],
    ),
    highlight: { active: ['v0:skip rule', 'v2:skip rule'], compare: ['v1:skip rule', 'v5:skip rule'] },
    explanation: 'Wire type is what lets a parser skip a field it does not understand. It may not know the semantic field name, but it knows how many bytes to consume.',
  };

  yield {
    state: protoGraph('Packed repeated numeric fields are length-delimited payloads', { record: 'repeated ints', tag: 'field 3 type 2', value: 'len + varints', wire: 'packed block' }),
    highlight: { active: ['record', 'tag', 'value', 'wire'], found: ['parser'] },
    explanation: 'Repeated numeric fields can be packed: one tag, one byte length, then concatenated encoded values. That removes repeated tags and improves scan locality.',
  };
}

function* unknownFieldsEvolution() {
  yield {
    state: protoGraph('New producer adds field 7; old consumer can skip it', { schema: 'old schema', record: 'has field 7', tag: '7 + type', value: 'bytes', parser: 'unknown', object: 'known fields' }),
    highlight: { active: ['tag', 'value', 'parser'], compare: ['object'] },
    explanation: 'Forward-compatible evolution depends on skipping. If an old consumer sees a field number it does not know, the wire type tells it how to skip that value and keep parsing the fields it does know.',
    invariant: 'Unknown field skipping requires field numbers and wire types, not field names.',
  };

  yield {
    state: labelMatrix(
      'Evolution rules in practice',
      [
        { id: 'add', label: 'add field' },
        { id: 'reuse', label: 'reuse number' },
        { id: 'rename', label: 'rename field' },
        { id: 'packed', label: 'change packing' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['usually safe', 'new field number'],
        ['dangerous', 'reserve old numbers'],
        ['wire unchanged', 'number matters'],
        ['compat concern', 'check language/runtime'],
      ],
    ),
    highlight: { active: ['add:rule', 'reuse:rule'], compare: ['rename:effect'] },
    explanation: 'In Protobuf, field number is the durable identity. Renaming a field can be wire-compatible, but reusing a retired field number can make old bytes mean the wrong thing.',
  };

  yield {
    state: labelMatrix(
      'Schema Registry with Protobuf',
      [
        { id: 'schema', label: 'schema id' },
        { id: 'imports', label: 'imports' },
        { id: 'indexes', label: 'message indexes' },
        { id: 'payload', label: 'payload' },
      ],
      [
        { id: 'wire role', label: 'wire role' },
        { id: 'why', label: 'why' },
      ],
      [
        ['registry header', 'find schema'],
        ['references', 'shared definitions'],
        ['select message', 'nested files'],
        ['normal protobuf', 'field stream'],
      ],
    ),
    highlight: { active: ['schema:wire role', 'payload:wire role'], found: ['indexes:why'] },
    explanation: 'Confluent Protobuf payloads add registry metadata before the normal protobuf bytes. The core protobuf message remains the tag-value stream described here.',
  };

  yield {
    state: protoGraph('Debugging wire bytes means walking tag, type, value, repeat', { schema: 'maybe missing', record: 'bytes only', tag: 'field+type', value: 'skip/decode', wire: 'hex dump', parser: 'protoscope' }),
    highlight: { active: ['wire', 'tag', 'value', 'parser'], compare: ['schema'] },
    explanation: 'The practical debugging loop is mechanical: read a tag varint, split field number and wire type, decode or skip the value, then repeat until the message ends.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tag-value stream') yield* tagValueStream();
  else if (view === 'unknown fields evolution') yield* unknownFieldsEvolution();
  else throw new InputError('Pick a Protobuf wire-format view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the tag-value stream one field at a time. A tag is a varint that packs the field number and wire type; a varint is a variable-length integer encoding. Active bytes show the parser reading a tag, then consuming or skipping the value according to the wire type.',
        'In the unknown-fields view, focus on what an old parser knows without the new schema. It may not know the field name or meaning, but the wire type tells it how many bytes to consume. That skip rule is the compatibility mechanism.',
        {type:'callout', text:'Protobuf stays compact and evolvable by making field numbers the stable identity and wire types the skip contract.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems need messages that are compact, typed, and able to survive schema changes. JSON repeats field names and is easy to inspect, but it spends bytes on names and leaves type interpretation to the reader. A raw positional binary record is smaller but breaks when fields are added or removed.',
        'Protocol Buffers uses a compact wire format with numbered fields. The schema maps field numbers to names and types in generated code, while the bytes carry field numbers, wire types, and values. This keeps messages small without making evolution impossible.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious human-readable approach is to send field names with every value, as JSON does. That is clear on the wire, but every message repeats keys such as customer_id or created_at. At high volume, repeated names become bandwidth and storage cost.',
        'The obvious compact approach is to send values in a fixed order. That saves bytes, but adding a field in the middle shifts positions and makes old readers misinterpret later values. A compact format needs durable identity without repeating full names.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is schema evolution. Producers and consumers are rarely upgraded at the same instant. Old consumers must survive new fields, and new consumers must read old messages that lack fields.',
        'A parser also needs to recover its place in the byte stream. If it sees an unknown field but cannot tell how long the value is, the rest of the message becomes unreadable. Compatibility requires both identity and a way to skip.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Field number is the durable identity. Source names help developers, but the wire format cares about numbers. Renaming a field can be compatible when the number stays the same; reusing a retired number can corrupt old stored data.',
        'Wire type is the skip contract. Type 0 is varint, type 1 is 64-bit fixed, type 2 is length-delimited, and type 5 is 32-bit fixed. Those types give old parsers enough structure to skip unknown fields and continue.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each present field, the encoder writes a tag followed by the encoded value. The tag is field_number << 3 OR wire_type, encoded as a varint. A string, bytes field, embedded message, or packed repeated field uses wire type 2, so the value starts with a length.',
        'The parser reads a tag, splits out field number and wire type, then either decodes a known field or skips an unknown one. Default values and missing fields are interpreted by generated code using the schema. The byte stream does not repeat the source-level field names.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from separating wire identity from source names. As long as both sides agree that field 1 is the same durable concept, the source name can change without changing old bytes. The generated class is a view over the wire contract, not the contract itself.',
        'Forward compatibility comes from the skip rule. An old parser that sees field 7 with wire type 2 can read the length and move past the bytes even if it does not know what field 7 means. It preserves the alignment needed to decode the next known field.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Protobuf saves bytes by not repeating names. For id=150, field 1 with wire type 0 writes tag 0x08 and value bytes 0x96 0x01, three bytes total. A text format would spend bytes on the name id before it even writes the value.',
        'The cost is schema discipline. Retired numbers must be reserved, wire types should not change under the same number, and migrations must consider old writers, new writers, old readers, new readers, gateways, and stored bytes. Debugging also needs schema-aware tools because raw bytes are not self-explanatory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Protobuf is used in service APIs, event streams, mobile clients, storage records, RPC systems, and schema registries. It fits systems where compact binary transport and generated typed code matter more than hand-editable payloads.',
        'It is especially useful when producers and consumers deploy independently. An old mobile app can skip a new server field, and a new service can read older stored records that do not contain a recently added field.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat the .proto file like a private class definition. Field numbers outlive source code. Reusing a number that once meant account_id for a new region_id field can make old bytes decode as a plausible but wrong value.',
        'It is also a poor fit when humans must inspect data without tools, when schemas are unavailable, or when ad hoc exploration matters more than compact transport. JSON transcoding, unknown-field retention, enum defaults, oneof migrations, and language runtime differences can all create surprises.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider message Person with field 1 id as int32 and field 2 name as string. For id = 150, the tag is (1 << 3) | 0 = 8, written as 0x08, and 150 is varint bytes 0x96 0x01. For name = Ada, the tag is (2 << 3) | 2 = 18, written as 0x12, then length 0x03, then ASCII bytes 0x41 0x64 0x61.',
        'The full payload is 08 96 01 12 03 41 64 61. If a future producer adds field 7 risk_score as a varint with value 42, an old parser can read tag 0x38, skip value 0x2a, and still decode id and name. If field 7 is later reused for region_id, old stored bytes become ambiguous, so retired numbers must be reserved.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Protocol Buffers encoding guide and Protocol Buffers language guide. For production schema evolution, study schema registry documentation and compatibility rules used by your messaging platform.',
        'Study base-128 varints, ZigZag signed integer encoding, Avro binary encoding, schema registries, Kafka logs, RPC framing, and backward-compatible database migrations next. The transferable lesson is that compact formats need durable identity.',
      ],
    },
  ],
};
