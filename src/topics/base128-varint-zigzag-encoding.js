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
  const bitsPerByte = 7;
  yield {
    state: varintGraph('A varint spends one byte for small values and more only when needed'),
    highlight: { active: ['value', 'groups', 'bytes'], found: ['decode'] },
    explanation: `A base-128 varint stores ${bitsPerByte} payload bits per byte. The high bit says whether another byte follows. Small numbers use one byte; larger numbers spill into more groups.`,
    invariant: `Each byte contributes ${bitsPerByte} value bits; bit ${bitsPerByte} is the continuation flag.`,
  };

  const exampleValue = 300;
  const lowGroup = exampleValue % 128;
  const highGroup = exampleValue >> 7;
  const firstByte = lowGroup | 0x80;
  yield {
    state: labelMatrix(
      `Encoding ${exampleValue}`,
      [
        { id: 'step1', label: `${exampleValue} mod 128` },
        { id: 'step2', label: `${exampleValue} >> 7` },
        { id: 'byte0', label: 'byte 0' },
        { id: 'byte1', label: 'byte 1' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'byte', label: 'byte' },
      ],
      [
        [`${lowGroup}`, '0x2c payload'],
        [`${highGroup}`, '0x02 payload'],
        ['more follows', `0x${firstByte.toString(16)}`],
        ['last byte', `0x0${highGroup}`],
      ],
    ),
    highlight: { active: ['byte0:byte', 'byte1:byte'], found: ['step1:value', 'step2:value'] },
    explanation: `${exampleValue} becomes payload groups ${lowGroup} and ${highGroup}. The first byte gets the continuation bit set: 0x${lowGroup.toString(16)} | 0x80 = 0x${firstByte.toString(16)}. The last byte is 0x0${highGroup}.`,
  };

  const ranges = [
    { id: 'b1', max: 127, bytes: 1 },
    { id: 'b2', max: 16383, bytes: 2 },
    { id: 'b3', max: 2097151, bytes: 3 },
    { id: 'b10', max: 'uint64 max', bytes: 10 },
  ];
  yield {
    state: labelMatrix(
      'Byte count by value range',
      [
        { id: 'b1', label: `0..${ranges[0].max}` },
        { id: 'b2', label: `128..${ranges[1].max}` },
        { id: 'b3', label: `16384..${ranges[2].max}` },
        { id: 'b10', label: `${ranges[3].max}` },
      ],
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'example', label: 'example fit' },
      ],
      [
        [`${ranges[0].bytes}`, 'field ids, booleans'],
        [`${ranges[1].bytes}`, 'small lengths'],
        [`${ranges[2].bytes}`, 'row counts'],
        [`${ranges[3].bytes}`, 'worst case'],
      ],
    ),
    highlight: { active: ['b1:bytes', 'b2:bytes'], compare: ['b10:bytes'] },
    explanation: `Varints are a distribution bet. Values up to ${ranges[0].max} cost just ${ranges[0].bytes} byte; worst-case uint64 costs ${ranges[3].bytes}. If most values are small, the average byte count drops. If values are uniform 64-bit hashes, the format gives little benefit.`,
  };

  const shiftSteps = [0, 7, 14];
  yield {
    state: varintGraph('Decoding is a loop of payload bits and shifting', { value: 'bytes', groups: 'low 7', cont: 'if high bit', bytes: 'accumulate', decode: 'integer' }),
    highlight: { active: ['bytes', 'decode', 'e-bytes-decode'], compare: ['cont'] },
    explanation: `The decoder masks off the high bit, shifts the payload by ${shiftSteps.join(', ')}, and so on, then stops when it sees a byte without the continuation bit.`,
  };
}

function* zigzagSignedIntegers() {
  const zigzagNeg1 = 1;
  const zigzagNeg2 = 3;
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
        [`${zigzagNeg1}`, 'one byte'],
        [`${zigzagNeg2}`, 'one byte'],
      ],
    ),
    highlight: { active: ['zig1:unsigned value', 'zig2:unsigned value'], compare: ['plain1:varint cost'] },
    explanation: `A raw two-complement negative integer looks huge when treated as unsigned, so it varint-encodes badly. ZigZag maps -1 to ${zigzagNeg1} and -2 to ${zigzagNeg2}, keeping small signed magnitudes as small unsigned values.`,
    invariant: 'ZigZag interleaves signs: 0, -1, 1, -2, 2, ... become 0, 1, 2, 3, 4, ...',
  };

  const zigzagPairs = [[-2, 3], [-1, 1], [0, 0], [1, 2], [2, 4]];
  yield {
    state: labelMatrix(
      'ZigZag mapping',
      [
        { id: 'n2', label: `${zigzagPairs[0][0]}` },
        { id: 'n1', label: `${zigzagPairs[1][0]}` },
        { id: 'z0', label: `${zigzagPairs[2][0]}` },
        { id: 'p1', label: `${zigzagPairs[3][0]}` },
        { id: 'p2', label: `${zigzagPairs[4][0]}` },
      ],
      [
        { id: 'encoded', label: 'encoded unsigned' },
        { id: 'varint bytes', label: 'varint bytes' },
      ],
      [
        [`${zigzagPairs[0][1]}`, '03'],
        [`${zigzagPairs[1][1]}`, '01'],
        [`${zigzagPairs[2][1]}`, '00'],
        [`${zigzagPairs[3][1]}`, '02'],
        [`${zigzagPairs[4][1]}`, '04'],
      ],
    ),
    highlight: { active: ['n1:encoded', 'p1:encoded'], found: ['z0:varint bytes'] },
    explanation: `The mapping keeps small negative and positive numbers near zero — ${zigzagPairs.length} pairs are shown. Protocol Buffers sint32/sint64 and Avro int/long use this idea because many counters, deltas, and measurements cluster near zero.`,
  };

  const usedIn = ['Protobuf', 'Avro', 'indexes', 'binary logs'];
  yield {
    state: labelMatrix(
      'Where the primitive appears',
      [
        { id: 'protobuf', label: usedIn[0] },
        { id: 'avro', label: usedIn[1] },
        { id: 'indexes', label: usedIn[2] },
        { id: 'logs', label: usedIn[3] },
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
    explanation: `Varints are not a compression format by themselves. They are a byte-level primitive used across ${usedIn.length} domains — ${usedIn[0]}, ${usedIn[1]}, ${usedIn[2]}, and ${usedIn[3]} — combined with schemas, length prefixes, tags, and block codecs.`,
  };

  const signedExample = -2;
  const zigzagEncoded = (signedExample << 1) ^ (signedExample >> 31);
  yield {
    state: varintGraph('ZigZag feeds varint; varint writes bytes', { value: `${signedExample}`, groups: `ZigZag=${zigzagEncoded}`, cont: 'fits', bytes: `0${zigzagEncoded}`, decode: `${signedExample}` }),
    highlight: { active: ['value', 'groups', 'bytes', 'decode'], found: ['cont'] },
    explanation: `The signed path is two-stage: map ${signedExample} to unsigned ${zigzagEncoded} with ZigZag, then varint-encode the unsigned integer. Decoding reverses those steps.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The base-128 varint view traces an unsigned integer through four stages: splitting into 7-bit payload groups, attaching the continuation bit to each group, emitting the final byte sequence, and reversing the process to decode. Active highlights mark the stage currently executing. Found highlights mark values that have been fully resolved. Compare highlights contrast byte counts across value ranges.',
        'The ZigZag signed-integer view adds a preliminary stage: mapping a signed integer to an unsigned integer before the varint pipeline runs. Active highlights mark the ZigZag mapping or the varint encoding. Found highlights mark the final wire bytes. The matrix frames show the signed-to-unsigned correspondence and the byte cost for each mapping.',
        {type: 'callout', text: 'Varints make byte count follow value magnitude, and ZigZag makes signed magnitude visible before the varint stage.'},
        {
          type: 'diagram',
          text: 'Unsigned path:\n  value --> split into 7-bit groups --> attach continuation bits --> emit bytes\n    300 -->        [44, 2]          -->      [0xac, 0x02]      --> ac 02\n\nSigned path (ZigZag first):\n  signed --> ZigZag map --> unsigned --> varint encode --> emit bytes\n    -2   -->     3      -->    3     -->     [0x03]    --> 03',
          label: 'Two encoding paths: unsigned values go straight to varint; signed values pass through ZigZag first',
        },
        'At each frame, ask: how many bytes does this value actually cost, and would a fixed-width encoding waste or save space here?',
        {type: 'image', src: './assets/gifs/base128-varint-zigzag-encoding.gif', alt: 'Animated walkthrough of the base128 varint zigzag encoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Huffman_coding_visualisation.svg', alt: 'Huffman coding tree showing how frequently used symbols get shorter codes', caption: 'Variable-length encoding in general: frequent values get shorter representations. Varints apply the same principle at the byte level -- small integers cost fewer bytes. (Source: Wikimedia Commons)'},
        {type: 'quote', text: 'Each key in the streamed message is a varint with the value (field_number << 3) | wire_type -- in other words, the last three bits of the number store the wire type.', attribution: 'Protocol Buffers Encoding Guide, protobuf.dev'},
        'Most serialized integers are small. Field numbers in Protocol Buffers are typically under 16. Length prefixes for strings and embedded messages are usually under a few hundred bytes. Enum values, boolean flags, retry counts, status codes, and delta-encoded document ids all cluster near zero. A fixed 32-bit or 64-bit slot encodes these values correctly, but it wastes space when the information content fits in one or two bytes.',
        'Variable-length integer encoding -- "varint" for short -- exploits that skew. A varint is a way of writing an integer using a variable number of bytes, where the byte count depends on the magnitude of the value. A value that fits in 7 bits costs one byte; a value that needs 14 bits costs two. The format only spends more bytes when the value demands more bits.',
        'This is why varints appear in Protocol Buffers, Apache Avro, SQLite record headers, Git packfile offsets, LevelDB block metadata, Lucene postings lists, and WebAssembly LEB128 immediates. Every one of these formats stores many small integers and pays a bandwidth cost proportional to wire size.',
        'ZigZag encoding solves a secondary problem that arises with signed integers. In two\'s complement representation -- the standard way computers store signed integers -- the value -1 is stored as all bits set (0xFFFFFFFF for 32-bit, 0xFFFFFFFFFFFFFFFF for 64-bit). If a varint encoder treats that bit pattern as an unsigned number, the value looks maximal and costs the maximum number of bytes. ZigZag remaps signed values so that small magnitudes, positive or negative, produce small unsigned values, keeping the varint cost low.',
        {type: 'note', text: 'Varints are not compression. They are a byte-level primitive that reduces average size when the value distribution is skewed small. Real compression (Snappy, zstd, LZ4) operates on top of or instead of varints, depending on the format.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The straightforward choice is fixed-width encoding: store every integer in exactly 4 bytes (uint32) or 8 bytes (uint64), regardless of the value. This means the number 1 and the number 4 billion both occupy the same space. Fixed-width buys three properties that varints cannot match.',
        {type: 'bullets', items: [
          'Random access: the byte offset of element i is i * width, so you can jump to any element without scanning.',
          'SIMD friendliness: fixed-width columns can be loaded, compared, and filtered with vector instructions that process 4, 8, or 16 values per cycle.',
          'Trivial parsing: no branch, no loop, no continuation-bit check. Read N bytes, done.',
        ]},
        'Fixed width is the right default for in-memory arrays, memory-mapped columns, and any context where decode throughput matters more than wire size. Database analytics engines (DuckDB, ClickHouse, Arrow) use fixed-width columnar layouts precisely because SIMD scans dominate their cost model. When every element is the same width, the CPU can process a batch of values without branching on each one.',
        'The trade is space. A Protobuf message with 20 fields, each tagged with a field number under 16 and a value under 128, would use 160 bytes in fixed uint64 encoding. The same message uses roughly 40 bytes with varints -- a 4x difference. Over millions of RPC calls per second, that difference determines whether the network or the CPU is the bottleneck.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed-width encoding hits a wall when the value distribution is heavily skewed toward small numbers and the bottleneck is bandwidth, not decode speed. A stream of Protobuf field tags, most under 16, stored as uint64 wastes 7 bytes per tag. A log of delta-encoded timestamps, most under 1000, wastes 6 bytes per delta. A Lucene postings list of document-id gaps, most under 128, wastes 7 bytes per gap.',
        'The waste is not theoretical. A Protobuf-serialized RPC payload where 80% of integer fields hold values under 128 is roughly 4x larger with fixed uint32 than with varints. At 100,000 messages per second, that is the difference between saturating a 1 Gbps link and fitting comfortably. The bytes you waste on padding are bytes you cannot use for payload.',
        {type: 'note', text: 'The wall is distribution-dependent. If most values are large (random 64-bit ids, cryptographic hashes, uniformly distributed timestamps), fixed-width encoding wastes nothing and varints may cost more due to the continuation-bit overhead. The wall only exists when small values dominate.'},
        'There is a second wall specific to signed integers. Two\'s complement representation makes -1 look like 0xFFFFFFFFFFFFFFFF when treated as unsigned -- that is 18,446,744,073,709,551,615 in decimal. A naive varint encoder would spend 10 bytes encoding that number. Without ZigZag, signed varints are worse than fixed width for any negative value, because every negative number has its high bits set.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The insight behind varints is that you can use one bit per byte as a structural signal -- a "continuation bit" -- and still have 7 bits left for payload. That single bit tells the decoder whether more bytes follow (bit set to 1) or whether this byte is the last one (bit set to 0). The format is self-delimiting: the decoder never needs an external length field or separator to know where one integer ends and the next begins.',
        'This is base-128 in disguise. Each byte carries a "digit" in base 128 (7 bits can represent 0 through 127), and the continuation bit acts as a digit separator. Just like base-10 positional notation uniquely represents every nonnegative integer, base-128 does the same -- with the bonus that the encoding tells you its own length as you read it.',
        'The ZigZag insight is separate but complementary. The problem with signed integers is that two\'s complement places negative numbers at the top of the unsigned range, far from zero. ZigZag interleaves positive and negative values around zero: 0 maps to 0, -1 maps to 1, 1 maps to 2, -2 maps to 3, 2 maps to 4, and so on. This means the varint cost tracks the magnitude of the signed value, not its bit pattern. Small negatives cost just as few bytes as small positives.',
        'Together, the two ideas give you a wire format where the byte cost of any integer -- signed or unsigned -- is proportional to its magnitude. Fixed-width formats pay for the worst case on every value. Varints pay only for what each value actually needs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/05/VLQ-en.svg', alt: 'Diagram showing variable-length quantity encoding with continuation bits', caption: 'Variable-length quantity (VLQ) encoding: each byte carries 7 payload bits and one continuation bit. Base-128 varints use the same structure. (Source: Wikimedia Commons)'},
        'Base-128 varint encoding is a loop with three operations per iteration. First, extract the low 7 bits of the value as the payload for this byte. Second, check whether any higher bits remain by testing if the value is greater than 127. Third, emit one byte: the 7-bit payload OR-ed with 0x80 (continuation bit set) if more bytes follow, or the payload alone if this is the last byte. Then shift the value right by 7 and repeat.',
        {type: 'code', language: 'javascript', text: '// Encode unsigned integer to varint bytes\nfunction encodeVarint(value) {\n  const bytes = [];\n  while (value > 0x7f) {\n    bytes.push((value & 0x7f) | 0x80);  // low 7 bits + continuation\n    value >>>= 7;                        // unsigned shift right\n  }\n  bytes.push(value & 0x7f);              // final byte, no continuation\n  return bytes;\n}\n// encodeVarint(300) => [0xac, 0x02]'},
        'Decoding reverses the process. Read one byte at a time. Mask with 0x7f to isolate the 7-bit payload. Shift the payload left by (7 * position) where position starts at 0 and increments per byte, then OR it into an accumulator. If bit 7 of the byte is set, read the next byte. If bit 7 is clear, the integer is complete and the accumulator holds the decoded value.',
        {type: 'diagram', text: 'Encoding 300:\n\n  300 = 0b100101100\n              |---------|  7 low bits = 0101100 = 44 = 0x2c\n        |--|               remaining   = 10      = 2  = 0x02\n\n  Byte 0: 0x2c | 0x80 = 0xac  (continuation bit set)\n  Byte 1: 0x02                (continuation bit clear = last)\n\n  Wire bytes: [ac] [02]\n\nDecoding:\n  Byte 0: 0xac & 0x7f = 0x2c = 44,  shift by 0  => 44\n  Byte 1: 0x02 & 0x7f = 0x02 = 2,   shift by 7  => 256\n  Result: 44 + 256 = 300', label: 'Bit-level trace of encoding and decoding 300'},
        'ZigZag is a preprocessing step applied before the varint loop when encoding signed values. The formula for 32-bit values is: zigzag = (n << 1) ^ (n >> 31). For 64-bit: zigzag = (n << 1) ^ (n >> 63). The arithmetic right shift (>> not >>>) propagates the sign bit across all 32 or 64 positions, creating a mask of all zeros for nonnegative inputs or all ones for negative inputs. XOR with the left-shifted value flips all bits for negative inputs, which interleaves positive and negative magnitudes into the sequence 0, 1, 2, 3, 4, 5, ... corresponding to signed values 0, -1, 1, -2, 2, -3, ...',
        'The inverse is: n = (zigzag >>> 1) ^ -(zigzag & 1). The low bit of the ZigZag value tells you the sign (0 = nonnegative, 1 = negative). The remaining bits tell you the magnitude. This is a pure bitwise operation with no branches, so it costs the same as an addition on any modern CPU.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The varint invariant is positional notation in base 128. Each payload group contributes payload * 128^i to the final value, where i is the group index starting from zero. This is identical to how base-10 digits work: the rightmost digit contributes units, the next contributes tens (10^1), the next hundreds (10^2). In varints, the radix is 128 and the "digit separator" is a single bit inside each byte. Because positional notation uniquely represents every nonnegative integer, the encoding is unambiguous as long as leading zero groups are not emitted (this is the canonical-form requirement).',
        'The continuation bit provides self-delimitation. A decoder never needs to know the byte length in advance -- it reads until it finds a byte with bit 7 clear. This property makes varints composable: you can concatenate a stream of varints back-to-back with no separators, and a decoder can split them apart correctly, because each varint announces its own end.',
        'ZigZag correctness follows from the bijection it creates between signed and unsigned integers. Every signed 32-bit integer maps to exactly one unsigned 32-bit integer, and every unsigned integer maps back to exactly one signed integer. The mapping preserves magnitude ordering: signed values close to zero (like -3, -2, -1, 0, 1, 2, 3) map to unsigned values close to zero (5, 3, 1, 0, 2, 4, 6). This guarantee means the varint byte count for a ZigZag-encoded value depends on the magnitude of the original signed value, not on its two\'s complement bit pattern.',
        {type: 'note', text: 'Corner case: zero encodes as a single byte 0x00. This is the only varint where the payload is zero and the continuation bit is clear. A decoder that initializes its accumulator to zero and encounters 0x00 correctly produces zero, because 0 OR-shifted by any amount is still zero.'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'table', headers: ['Value range', 'Varint bytes', 'Fixed uint32', 'Fixed uint64', 'Savings vs uint64'], rows: [
          ['0 to 127', '1', '4', '8', '87.5%'],
          ['128 to 16,383', '2', '4', '8', '75%'],
          ['16,384 to 2,097,151', '3', '4', '8', '62.5%'],
          ['2,097,152 to 268,435,455', '4', '4', '8', '50%'],
          ['268,435,456 to 2^32 - 1', '5', '4', '8', '37.5%'],
          ['2^32 to 2^63 - 1', '5 to 9', 'N/A', '8', '0 to 37.5%'],
          ['2^63 to 2^64 - 1', '10', 'N/A', '8', '-25% (worse)'],
        ]},
        'Encoding and decoding are both O(b) where b is the number of bytes in the varint, which equals ceiling(bits_needed / 7). For practical 64-bit values, b is at most 10, so the cost is effectively constant -- you will never loop more than 10 times. The real cost is the branch per byte: the continuation-bit check is a data-dependent branch that the CPU cannot predict until the byte is read.',
        'For small values (the common case in most formats), the loop exits after one iteration. Modern branch predictors learn this pattern quickly, so single-byte varints decode almost as fast as fixed-width reads. Two-byte varints add one misprediction on the first encounter, then settle into a predictable pattern. The pain comes from mixed-length streams where the byte count varies unpredictably -- branch misprediction rates climb, and decode throughput drops to roughly half of fixed-width performance.',
        'Space overhead for maximum-range values is real. A uint64 near 2^64 costs 10 varint bytes versus 8 fixed bytes -- a 25% increase. The continuation bits steal one bit per byte, so 64 bits of payload require ceiling(64 / 7) = 10 bytes of wire space. Varints are a bet that this worst case is rare enough to be worth the overhead.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Varints win wherever small integers dominate and wire size matters more than random-access speed.',
        {type: 'bullets', items: [
          'Protocol Buffers: field tags (field_number << 3 | wire_type) are almost always under 128, costing one byte. Length prefixes for strings and submessages are usually under 16,384, costing two bytes.',
          'Apache Avro: all integers use ZigZag varints. Schema-defined int and long fields encode deltas, counts, and enum ordinals that cluster near zero.',
          'Search indexes (Lucene, Tantivy): postings lists store delta-encoded document ids. After delta encoding, most gaps are small, so varints compress them efficiently.',
          'Git packfile format: object sizes and offsets use a varint variant (OFS_DELTA) to keep packfile headers compact.',
          'SQLite: record headers use varints for column types and payload lengths, keeping the per-row overhead small for narrow tables.',
          'WebAssembly: LEB128 varints encode instruction immediates, function indices, and section sizes in the binary format.',
          'LevelDB / RocksDB: block metadata, key lengths, and value lengths use varints in the SSTable format.',
        ]},
        'The pattern generalizes: any format that stores many small integers and is read sequentially (not randomly) benefits from varints. The savings compound when combined with delta encoding (storing differences between consecutive values instead of absolute values), run-length encoding, or dictionary encoding applied before the varint stage. These preprocessing steps push the value distribution closer to zero, which is exactly where varints are most efficient.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Varints are the wrong choice in several well-defined situations.',
        {type: 'table', headers: ['Scenario', 'Why varints lose', 'Better alternative'], rows: [
          ['Random 64-bit ids / UUIDs', 'Values are uniformly large; average varint cost is 9-10 bytes vs 8 fixed', 'Fixed uint64 or uint128'],
          ['Cryptographic hashes', 'Every bit is pseudorandom; no small-value skew to exploit', 'Fixed-width byte array'],
          ['SIMD columnar scans', 'Variable width breaks alignment; branch per value kills vectorization', 'Fixed-width Arrow/Parquet columns'],
          ['Random access by index', 'Cannot compute byte offset of element i without scanning all preceding elements', 'Fixed-width array or block index'],
          ['Already-compressed data', 'Data inside zstd/LZ4/Snappy frames gains nothing from varint; adds decode cost', 'Let the compressor handle it'],
          ['Negative values without ZigZag', 'Two-complement -1 costs 10 bytes as a varint; worse than fixed uint64', 'Use sint32/sint64 (ZigZag) or fixed'],
        ]},
        'A subtle failure mode is non-canonical encoding. If a protocol allows overlong varints -- encoding the value 1 as the two-byte sequence [0x81, 0x00] instead of the one-byte [0x01] -- then the same logical value has multiple byte representations. This breaks content-addressed storage, signature verification, cache deduplication, and equality checks that compare raw bytes. Protocols must define whether overlong encodings are valid, and decoders must enforce the rule.',
        'Protobuf itself has a canonical-encoding trap that catches many teams. The field types int32 and int64 encode negative values as 10-byte varints (sign-extended to 64 bits), while sint32 and sint64 use ZigZag. Choosing int32 for a field that regularly holds -1 silently wastes 9 bytes per value compared to sint32. This is a schema design error, not a varint limitation, but the cost is real and easy to miss.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Walk through encoding the signed value -150 using ZigZag + varint, byte by byte.',
        'Step 1: ZigZag mapping. Apply the formula zigzag = (n << 1) ^ (n >> 31). For n = -150: n << 1 = -300 (binary: ...10110101_00). n >> 31 = -1 (all ones, because the sign bit propagated). XOR: -300 ^ -1 = 299. So -150 maps to the unsigned value 299. You can verify the interleaving: positive 150 would map to 300, and -150 sits one slot before it at 299.',
        'Step 2: Varint encoding of 299. The value 299 in binary is 100101011 (9 bits). Split into 7-bit groups from the low end: low 7 bits = 0101011 = 43 = 0x2b, remaining bits = 10 = 2 = 0x02. Since the value exceeds 127, the first byte gets the continuation bit: 0x2b | 0x80 = 0xab. The second byte is the final group: 0x02 (no continuation bit). Wire bytes: [0xab, 0x02].',
        'Step 3: Decode verification. Read byte 0xab: bit 7 is set, so more bytes follow. Payload = 0xab & 0x7f = 0x2b = 43. Shift by 0 positions: contributes 43. Read byte 0x02: bit 7 is clear, so this is the last byte. Payload = 0x02 = 2. Shift by 7 positions: contributes 2 * 128 = 256. Total: 43 + 256 = 299. Apply inverse ZigZag: n = (299 >>> 1) ^ -(299 & 1) = 149 ^ -1 = -150. Recovered the original value.',
        'Step 4: Cost comparison. The value -150 cost 2 bytes with ZigZag + varint. Without ZigZag, -150 in two\'s complement 32-bit is 0xFFFFFF6A, which would need 5 varint bytes. Without ZigZag in 64-bit, it is 0xFFFFFFFFFFFFFF6A, costing 10 varint bytes. Fixed uint32 would cost 4 bytes; fixed uint64 would cost 8 bytes. ZigZag + varint saved 2 bytes over fixed uint32 and 6 bytes over fixed uint64.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'Protocol Buffers Encoding Guide -- https://protobuf.dev/programming-guides/encoding/ -- the canonical reference for base-128 varint encoding, wire types, ZigZag mapping, and field tag layout.',
          'Apache Avro Specification, Binary Encoding -- https://avro.apache.org/docs/1.12.0/specification/#binary-encoding -- defines how Avro uses ZigZag varints for all integer types.',
          'SQLite File Format -- https://www.sqlite.org/fileformat2.html -- Section 2.1 defines the varint format used in record headers and B-tree page metadata.',
          'WebAssembly Binary Format -- https://webassembly.github.io/spec/core/binary/values.html#integers -- specifies LEB128 (unsigned and signed) for all integer immediates in the Wasm binary.',
          'Ian Lance Taylor, "LEB128" -- https://en.wikipedia.org/wiki/LEB128 -- concise overview of the Little Endian Base 128 family, including ULEB128, SLEB128, and DWARF debug info usage.',
        ]},
        {type: 'note', text: 'Study Protobuf Wire Format, Avro Binary Encoding, Delta Bit-Packing Integer Compression, Elias-Fano Encoding, Huffman Coding, Roaring Bitmaps, and HPACK Dynamic Table (HTTP/2) next. Each builds on the idea that encoding cost should reflect value distribution, not worst-case range.'},
      ],
    },
  ],
};

