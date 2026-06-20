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
      heading: 'Why this exists',
      paragraphs: [
        'Protocol Buffers exists because distributed systems need payloads that are smaller and more explicit than JSON while still surviving schema evolution. A raw positional binary record is compact but brittle. A fully self-describing record is easy to inspect but repeats field names and types constantly.',
        'The Protocol Buffers wire format is a compact tag-value encoding. Each field writes a tag that combines field number and wire type, followed by the encoded value. The schema is not repeated as field names in every message; generated code uses field numbers to interpret bytes.',
        'This is why Protobuf is small and evolvable. Field numbers are the stable identity, wire types let parsers skip unknown fields, and varints make small integers and lengths cheap.',
        {type:'callout', text:'Protobuf stays compact and evolvable by making field numbers the stable identity and wire types the skip contract.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious self-describing format is to write field names and values together, as JSON does. That is readable but repetitive. The opposite extreme is to write raw values in order, which is compact but brittle when fields are added or removed.',
        'Protobuf splits the difference. It writes numeric field identities and wire types, not names. That keeps payloads small while preserving enough structure for old readers to skip fields they do not understand.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'In the tag-value view, split every byte sequence into three questions: what field number is this, what wire type says how to read it, and how many bytes does the value consume? That is the whole parser loop.',
        'In the unknown-field view, focus on what the old parser can know without the new schema. It cannot know the semantic field name, but the wire type tells it how to skip the bytes and continue decoding known fields.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A tag is encoded as a varint: field_number << 3 OR wire_type. Wire type 0 is varint, type 1 is 64-bit fixed, type 2 is length-delimited, and type 5 is 32-bit fixed. Length-delimited values cover strings, bytes, embedded messages, and packed repeated numeric fields.',
        'A parser reads tag, splits number and type, decodes or skips the value, and repeats. Unknown fields can be skipped because the wire type carries enough length information for the parser to move to the next field.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Field number is the durable identity. Names are source-code convenience. A rename can be compatible because the wire number stays the same; reusing a number can be dangerous because old bytes now point at a different meaning.',
        'Wire type is the skip contract. Even without schema meaning, a parser can consume the correct number of bytes and continue. That is the mechanism behind forward-compatible unknown fields.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Protobuf works because it separates durable wire identity from source-code names. The bytes carry field numbers and wire types. The schema maps those numbers back to generated fields. That means the payload can stay compact while the code remains typed.',
        'The skip rule is what makes evolution practical. An old parser can see field 7, learn enough from the wire type to consume it, and continue reading field 1 or field 2 afterward. It does not have to understand the new business meaning to avoid corrupting the rest of the message.',
      ],
    },
    {
      heading: 'Case study: adding a field',
      paragraphs: [
        'A new producer adds field 7 risk_score. Old consumers do not know field 7, but they can read its tag, use its wire type to skip the value, and continue decoding known fields. The dangerous move is not adding a field; it is reusing an old field number for a new meaning. Field numbers should be reserved when removed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The wire format optimizes size and evolution, but debugging requires schemas or byte-level tooling. Field order is not the data model. Missing fields, default values, unknown field retention, packed repeated fields, and language-specific runtime behavior can all matter in migrations.',
        'Schema discipline is part of the data structure. Reserve retired field numbers, avoid changing wire type under the same number, be careful with oneof migrations, and roll out producers and consumers in an order that old binaries can tolerate.',
      ],
    },
    {
      heading: 'Where it wins / Where it fails',
      paragraphs: [
        'Protobuf wins for service APIs, event streams, mobile clients, and storage formats where small binary payloads and schema evolution matter more than human-readable bytes.',
        'It fails when teams treat generated classes as the whole contract. Compatibility depends on reserved numbers, default semantics, unknown-field policy, oneof changes, and rollout discipline across producers and consumers.',
        'It is also a poor fit when humans need to inspect payloads without tools, when schemas are unavailable, or when ad hoc data exploration matters more than compact transport.',
      ],
    },
    {
      heading: 'Operational failure modes',
      paragraphs: [
        'The most common failure is field-number reuse. A field that once meant `account_id` cannot later mean `region_id` just because the source name was deleted. Old stored bytes, old producers, and old consumers may still exist. Reserve retired numbers and names so the mistake becomes impossible in code review.',
        'Another failure is assuming all languages preserve unknown fields identically. Some runtimes keep them, some drop them in common workflows, and JSON transcoding may erase details the binary format would have preserved. Schema evolution has to be tested across the actual languages and gateways in the system.',
        'Finally, packed repeated fields, oneof migrations, enum defaults, and signed integer encodings can surprise teams that only inspect generated classes. The wire format is the contract. Generated code is a convenience layer over that contract.',
      ],
    },
    {
      heading: 'Debugging checklist',
      paragraphs: [
        'When a protobuf payload looks wrong, start from bytes, not from the generated object. Walk the stream tag by tag: decode the tag varint, split field number and wire type, decode or skip the value, then repeat. This makes schema mismatches visible quickly because the byte stream will reveal which field number actually appeared.',
        'Then compare the producer schema, consumer schema, registry schema, and deployed binary versions. Many protobuf incidents are rollout incidents: one service writes a field the next service can skip, but a gateway, JSON bridge, old mobile client, or analytics job makes a different compatibility assumption.',
        'Keep golden payloads for migrations. A small set of known bytes decoded by old and new binaries is often more useful than a large generated-code test suite that never inspects wire compatibility directly.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Treat a protobuf schema like a public database migration, not like a private class definition. Field numbers, wire types, defaults, enum behavior, and oneof shape can all outlive the source file that introduced them.',
        'A safe change is one that old readers, new readers, old writers, new writers, gateways, and stored bytes can all survive. The wire format is designed to make that possible, but it does not make schema discipline optional.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For message { id: 150, name: "Ada" }, field 1 with wire type 0 writes tag 0x08 and varint value 0x96 0x01. Field 2 with wire type 2 writes tag 0x12, then length 0x03, then the UTF-8 bytes for Ada. The bytes are compact because id and name are not written as strings.',
        'If a future producer adds field 7, an old consumer reads the tag, sees a known wire type, skips that value, and continues. If the team reuses field 7 later for a different meaning, old stored bytes can become ambiguous. Field numbers are therefore durable public API, not implementation details.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Protocol Buffers encoding guide at https://protobuf.dev/programming-guides/encoding/ and Confluent Protobuf Schema Registry serializer docs at https://docs.confluent.io/platform/current/schema-registry/fundamentals/serdes-develop/serdes-protobuf.html. Study Base-128 Varint & ZigZag Encoding, Avro Binary Encoding, Schema Registry Case Study, Message Queue, and Kafka Log Case Study next.',
      ],
    },
  ],
};
