// Base-128 varints and ZigZag encoding: compact integers for wire formats,
// logs, indexes, and schema-driven serialization.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'base128-varint-zigzag-encoding',
  title: 'Base-128 Varint & ZigZag Encoding',
  category: 'Data Structures',
  summary: 'Encode small integers in fewer bytes by packing seven payload bits per byte, then use ZigZag so small negative numbers stay small too.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['base-128 varint', 'ZigZag signed integers'], defaultValue: 'base-128 varint' },
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

function varintGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'value', label: 'value', x: 0.8, y: 4.0, note: notes.value ?? '300' },
      { id: 'groups', label: '7-bit groups', x: 2.8, y: 4.0, note: notes.groups ?? '44, 2' },
      { id: 'cont', label: 'cont bit', x: 4.9, y: 4.0, note: notes.cont ?? 'more?' },
      { id: 'bytes', label: 'bytes', x: 7.0, y: 4.0, note: notes.bytes ?? 'ac 02' },
      { id: 'decode', label: 'decode', x: 9.0, y: 4.0, note: notes.decode ?? 'shift+or' },
    ],
    edges: [
      { id: 'e-value-groups', from: 'value', to: 'groups', weight: '' },
      { id: 'e-groups-cont', from: 'groups', to: 'cont', weight: '' },
      { id: 'e-cont-bytes', from: 'cont', to: 'bytes', weight: '' },
      { id: 'e-bytes-decode', from: 'bytes', to: 'decode', weight: '' },
    ],
  }, { title });
}

function* base128Varint() {
  yield {
    state: varintGraph('A varint spends one byte for small values and more only when needed'),
    highlight: { active: ['value', 'groups', 'bytes'], found: ['decode'] },
    explanation: 'A base-128 varint stores seven payload bits per byte. The high bit says whether another byte follows. Small numbers use one byte; larger numbers spill into more groups.',
    invariant: 'Each byte contributes seven value bits; bit 7 is the continuation flag.',
  };

  yield {
    state: labelMatrix(
      'Encoding 300',
      [
        { id: 'step1', label: '300 mod 128' },
        { id: 'step2', label: '300 >> 7' },
        { id: 'byte0', label: 'byte 0' },
        { id: 'byte1', label: 'byte 1' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'byte', label: 'byte' },
      ],
      [
        ['44', '0x2c payload'],
        ['2', '0x02 payload'],
        ['more follows', '0xac'],
        ['last byte', '0x02'],
      ],
    ),
    highlight: { active: ['byte0:byte', 'byte1:byte'], found: ['step1:value', 'step2:value'] },
    explanation: '300 becomes payload groups 44 and 2. The first byte gets the continuation bit set: 0x2c | 0x80 = 0xac. The last byte is 0x02.',
  };

  yield {
    state: labelMatrix(
      'Byte count by value range',
      [
        { id: 'b1', label: '0..127' },
        { id: 'b2', label: '128..16383' },
        { id: 'b3', label: '16384..2097151' },
        { id: 'b10', label: 'uint64 max' },
      ],
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'example', label: 'example fit' },
      ],
      [
        ['1', 'field ids, booleans'],
        ['2', 'small lengths'],
        ['3', 'row counts'],
        ['10', 'worst case'],
      ],
    ),
    highlight: { active: ['b1:bytes', 'b2:bytes'], compare: ['b10:bytes'] },
    explanation: 'Varints are a distribution bet. If most values are small, the average byte count drops. If values are uniform 64-bit hashes, the format gives little benefit and may cost decode work.',
  };

  yield {
    state: varintGraph('Decoding is a loop of payload bits and shifting', { value: 'bytes', groups: 'low 7', cont: 'if high bit', bytes: 'accumulate', decode: 'integer' }),
    highlight: { active: ['bytes', 'decode', 'e-bytes-decode'], compare: ['cont'] },
    explanation: 'The decoder masks off the high bit, shifts the payload by 0, 7, 14, and so on, then stops when it sees a byte without the continuation bit.',
  };
}

function* zigzagSignedIntegers() {
  yield {
    state: labelMatrix(
      'Why signed varints need ZigZag',
      [
        { id: 'plain1', label: '-1 as two-complement' },
        { id: 'plain2', label: '-2 as two-complement' },
        { id: 'zig1', label: 'ZigZag -1' },
        { id: 'zig2', label: 'ZigZag -2' },
      ],
      [
        { id: 'unsigned value', label: 'unsigned value' },
        { id: 'varint cost', label: 'varint cost' },
      ],
      [
        ['huge uint', 'many bytes'],
        ['huge uint', 'many bytes'],
        ['1', 'one byte'],
        ['3', 'one byte'],
      ],
    ),
    highlight: { active: ['zig1:unsigned value', 'zig2:unsigned value'], compare: ['plain1:varint cost'] },
    explanation: 'A raw two-complement negative integer looks huge when treated as unsigned, so it varint-encodes badly. ZigZag maps small signed magnitudes to small unsigned values.',
    invariant: 'ZigZag interleaves signs: 0, -1, 1, -2, 2, ... become 0, 1, 2, 3, 4, ...',
  };

  yield {
    state: labelMatrix(
      'ZigZag mapping',
      [
        { id: 'n2', label: '-2' },
        { id: 'n1', label: '-1' },
        { id: 'z0', label: '0' },
        { id: 'p1', label: '1' },
        { id: 'p2', label: '2' },
      ],
      [
        { id: 'encoded', label: 'encoded unsigned' },
        { id: 'varint bytes', label: 'varint bytes' },
      ],
      [
        ['3', '03'],
        ['1', '01'],
        ['0', '00'],
        ['2', '02'],
        ['4', '04'],
      ],
    ),
    highlight: { active: ['n1:encoded', 'p1:encoded'], found: ['z0:varint bytes'] },
    explanation: 'The mapping keeps small negative and positive numbers near zero. Protocol Buffers sint32/sint64 and Avro int/long use this idea because many counters, deltas, and measurements cluster near zero.',
  };

  yield {
    state: labelMatrix(
      'Where the primitive appears',
      [
        { id: 'protobuf', label: 'Protobuf' },
        { id: 'avro', label: 'Avro' },
        { id: 'indexes', label: 'indexes' },
        { id: 'logs', label: 'binary logs' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['varint fields', 'small ids and lengths'],
        ['zigzag int/long', 'compact signed values'],
        ['doc ids/gaps', 'small deltas'],
        ['length prefixes', 'self-delimiting'],
      ],
    ),
    highlight: { active: ['protobuf:use', 'avro:use'], found: ['indexes:reason'] },
    explanation: 'Varints are not a compression format by themselves. They are a byte-level primitive that many higher-level formats combine with schemas, length prefixes, tags, and block codecs.',
  };

  yield {
    state: varintGraph('ZigZag feeds varint; varint writes bytes', { value: '-2', groups: 'ZigZag=3', cont: 'fits', bytes: '03', decode: '-2' }),
    highlight: { active: ['value', 'groups', 'bytes', 'decode'], found: ['cont'] },
    explanation: 'The signed path is two-stage: map signed to unsigned with ZigZag, then varint-encode the unsigned integer. Decoding reverses those steps.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'base-128 varint') yield* base128Varint();
  else if (view === 'ZigZag signed integers') yield* zigzagSignedIntegers();
  else throw new InputError('Pick a varint view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A base-128 varint is a variable-length integer encoding. Each byte stores seven payload bits and one continuation bit. Small values use one byte; large values use more. ZigZag is the companion mapping for signed integers so small negative numbers also become small unsigned values before varint encoding.',
        'This is the byte-level primitive underneath Protocol Buffers, Avro integer encoding, many binary log formats, and index-compression schemes. It is simple, but it changes the cost model from fixed width to value distribution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To encode an unsigned integer, repeatedly take the low seven bits. If more bits remain, set the high continuation bit on the byte. Decoding masks out the high bit, shifts each seven-bit group into position, and stops at the first byte whose continuation bit is clear.',
        'ZigZag maps signed integers to unsigned integers by alternating sign around zero: 0 maps to 0, -1 to 1, 1 to 2, -2 to 3, and 2 to 4. That way values with small absolute magnitude usually stay one-byte varints.',
      ],
    },
    {
      heading: 'Case study: field lengths and deltas',
      paragraphs: [
        'A schema-driven message format often needs to encode field numbers, byte lengths, enum values, counts, and integer fields. Those values are usually small, so a fixed 32-bit slot wastes bytes. A varint lets field number 1, string length 3, and enum value 2 each cost one byte. A sorted postings list can do the same trick after delta encoding document ids.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The win is smaller average payloads when values are skewed small. The cost is a branchy decode loop and worst-case ten bytes for a uint64. For scan-heavy analytics, block codecs such as Delta Bit-Packing may decode faster. For message formats with many small fields, varints are usually a good fit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Protocol Buffers encoding guide at https://protobuf.dev/programming-guides/encoding/ and Apache Avro binary encoding specification at https://avro.apache.org/docs/1.11.1/specification/. Study Protobuf Wire Format, Avro Binary Encoding, HPACK Dynamic Table HTTP/2 Case Study, Delta Bit-Packing Integer Compression, Huffman Coding, and Schema Registry Case Study next.',
      ],
    },
  ],
};
