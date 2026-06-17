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
      heading: 'Why this exists',
      paragraphs: [
        'Base-128 varints exist because many serialized integers are small. Field numbers, length prefixes, enum values, status codes, counts, offsets, retry numbers, and delta-encoded ids often fit in one or two bytes. A fixed 32-bit or 64-bit slot is simple, but it wastes space when the common case is tiny.',
        'Variable-length integer encoding turns that skew into smaller messages. A one-byte value costs one byte. A larger value spends more bytes only when it needs more bits. This is why varints appear in Protocol Buffers, Avro, database logs, inverted indexes, binary RPC protocols, and file formats that store many small integers.',
        'ZigZag exists because signed integers need one extra step. Plain two-complement negative values look huge when interpreted as unsigned. ZigZag maps signed values near zero to unsigned values near zero, then the normal varint machinery can encode them compactly.',
      ],
    },
    {
      heading: 'The fixed-width baseline',
      paragraphs: [
        'Fixed-width integers have real strengths. They are easy to decode, easy to skip, and easy to index because the byte offset of item i is predictable. A column of uint32 values can be scanned with simple loads. A binary record with fixed offsets can jump directly to the field it needs.',
        'The cost is that fixed width pays for the maximum range every time. An int64 value of 3 takes eight bytes even though the information content is tiny. A message full of small tags and short lengths can become mostly padding.',
        'Varints trade fixed offsets for smaller average size. That trade is good when the distribution is skewed toward small values and bad when values are uniformly large, random, or scanned in a setting where branchy decode loops dominate.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'A base-128 varint is a self-delimiting sequence of seven-bit payload groups. Each byte contributes seven value bits. The high bit is not part of the integer; it is the continuation flag. If the high bit is set, another byte follows. If it is clear, this byte is the last group.',
        'The invariant is positional notation in base 128. Payload group i contributes payload * 128^i, or equivalently payload shifted left by 7 * i. Decoding reconstructs the unsigned value by accumulating those groups until the first byte with a clear continuation bit.',
        'The byte order is little-endian at the group level: low seven bits first, then the next seven bits, and so on. This lets encoders emit bytes as they repeatedly shift the value right by seven.',
      ],
    },
    {
      heading: 'Using the views',
      paragraphs: [
        'In the base-128 varint view, follow the value through seven-bit groups, continuation-bit decisions, emitted bytes, and decoding. The byte-count table is the cost model. Values 0 through 127 use one byte; values 128 through 16,383 use two; a uint64 worst case uses ten.',
        'In the ZigZag signed-integer view, focus on the mapping before the bytes. ZigZag -1 becomes 1, 1 becomes 2, -2 becomes 3, and 2 becomes 4. The signed path is always two stages: map signed to unsigned, then varint-encode the unsigned value.',
      ],
    },
    {
      heading: 'Unsigned encoding mechanics',
      paragraphs: [
        'To encode an unsigned integer, take the low seven bits as the payload. If any higher bits remain, set the high continuation bit and emit that byte. Shift the value right by seven and repeat. The final byte is emitted with the continuation bit clear.',
        'Encoding 300 shows the whole idea. 300 mod 128 is 44, or 0x2c. More bits remain, so the first byte is 0x2c | 0x80 = 0xac. After shifting right by seven, the remaining value is 2. That fits in the final byte 0x02. The byte sequence is ac 02.',
        'The algorithm is simple because it never needs to know the final byte count in advance. It streams low groups first until the value becomes zero. That is useful in encoders that write directly into a byte buffer.',
      ],
    },
    {
      heading: 'Unsigned decoding mechanics',
      paragraphs: [
        'To decode, read one byte at a time. Mask with 0x7f to remove the continuation bit. Shift the payload by 0, 7, 14, 21, and so on, then OR it into the accumulator. Stop when the high bit is clear.',
        'A decoder must be defensive. It should reject an unterminated byte run, reject values that overflow the target integer width, and usually reject non-canonical encodings such as using two bytes for a value that should fit in one. Otherwise attackers can create ambiguous encodings or force excessive work.',
        'The maximum length depends on the target type. A uint32 varint needs at most five bytes. A uint64 varint needs at most ten. If a stream keeps sending continuation bytes beyond that limit, the decoder should fail rather than keep shifting forever.',
      ],
    },
    {
      heading: 'ZigZag for signed values',
      paragraphs: [
        'Two-complement signed integers are efficient for CPU arithmetic, but they are awkward for unsigned varints. In a 64-bit representation, -1 has all bits set. If a format treats that bit pattern as an unsigned value, it looks like the largest possible uint64 and costs the maximum number of varint bytes.',
        'ZigZag changes the ordering. Nonnegative n maps to 2n. Negative n maps to -2n - 1. The sequence 0, -1, 1, -2, 2, -3, 3 maps to 0, 1, 2, 3, 4, 5, 6. Small magnitudes stay small regardless of sign.',
        'The inverse is equally simple. Even unsigned values decode to nonnegative numbers by shifting right one bit. Odd unsigned values decode to negative numbers by shifting right one bit and negating with the offset restored. Protocol Buffers sint32 and sint64 use this idea; Avro int and long do too.',
      ],
    },
    {
      heading: 'Signed worked examples',
      paragraphs: [
        'Encoding -2 with ZigZag maps it to unsigned 3. The value 3 fits in one seven-bit payload group, so the varint byte is 03. Decoding 03 gives unsigned 3. Because 3 is odd, the ZigZag inverse returns -2.',
        'Encoding 2 maps it to unsigned 4, which also fits in one byte. Encoding -64 maps to 127, still one byte. Encoding 64 maps to 128, which needs two bytes. That asymmetry is expected because ZigZag interleaves negative and positive magnitudes around zero.',
        'ZigZag is not compression by itself. If signed values are huge or uniformly distributed across the whole integer range, ZigZag does not make them small. It only makes the common near-zero signed values friendly to an unsigned varint.',
      ],
    },
    {
      heading: 'JavaScript implementation guidance',
      paragraphs: [
        'JavaScript has two integer worlds. Number is safe only for integers up to 2^53 - 1. Bitwise operators on Number operate on 32-bit signed values. That means a clean uint64 varint implementation should usually use BigInt for arithmetic, or deliberately restrict itself to uint32 and enforce that limit.',
        'For uint32, bitwise shifts can be fine if the code handles unsigned conversion carefully. For uint64, use BigInt shifts and masks: payload = value & 0x7fn, value >>= 7n, and set the continuation bit when value is nonzero. When writing to Uint8Array, convert only the final byte-sized value back to Number.',
        'For ZigZag with BigInt, encode nonnegative n as n << 1n and negative n as ((-n) << 1n) - 1n, or use the standard width-aware formula when the signed width is fixed. Decoding should return the expected numeric type and reject values outside the application range.',
      ],
    },
    {
      heading: 'Cost model',
      paragraphs: [
        'The storage win is distribution-dependent. Values 0 through 127 take one byte. Values under 16,384 take two. A uint64 value near the maximum takes ten. If most values are small, the average byte count drops sharply. If values are random 64-bit identifiers or hashes, the average byte count stays high.',
        'The CPU cost is a loop with data-dependent branches. Many decoders are fast because the common case exits after one byte, but branch misprediction and bounds checks can matter in high-throughput scans. Fixed-width arrays or block codecs can be faster when data is processed in bulk.',
        'Varints also make random access harder. To find the 1,000th integer, a decoder may need to scan the previous 999 unless there is an index. Formats often solve that with block boundaries, length prefixes, page indexes, or a higher-level table of offsets.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Varints win in wire formats, schema tags, length prefixes, binary logs, LSM-tree metadata, search index postings, small counters, and RPC payloads where values cluster near zero and bytes matter.',
        'They compose especially well with other transforms. Search indexes often delta-encode sorted document ids first, producing small gaps, then encode those gaps. Columnar formats may use varints for headers or lengths while using bit-packing inside data pages.',
        'They are also good for self-delimiting fields. A decoder can read a length prefix without knowing the fixed width chosen by the sender, then use that length to skip or parse the following bytes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Varints fail for uniformly random identifiers, cryptographic hashes, encrypted data, SIMD-heavy fixed-width scans, and values that are already inside compressed blocks. In those settings the branchy loop can cost more than the saved bytes.',
        'They also fail when canonical rules are missing. If the same value can be represented in multiple byte sequences, signatures, hashes, caches, and equality checks can disagree. Protocols should define whether overlong encodings are rejected and what the maximum byte length is for each integer type.',
        'Signed varints fail when a format forgets the ZigZag distinction. Protocol Buffers, for example, has different field types for plain int32 or int64 and ZigZag-backed sint32 or sint64. Choosing the wrong one can make negative values unexpectedly large on the wire.',
      ],
    },
    {
      heading: 'Security and parser hygiene',
      paragraphs: [
        'A varint decoder is a parser. It should have a byte limit, an overflow check, and a clear error for truncated input. It should not read past the buffer while searching for a terminating byte. It should not shift by unbounded amounts. It should not silently wrap a value into a smaller integer type.',
        'Canonical encoding matters for signed messages and content-addressed data. If a protocol signs bytes, the encoder must produce one representation and the decoder should reject alternatives. If a storage system hashes records, non-canonical integers can produce duplicate logical records with different byte hashes.',
        'Test vectors should cover zero, one-byte boundary 127, two-byte boundary 128, the worked value 300, maximum uint32, maximum uint64 if supported, -1, -2, positive and negative boundary values for ZigZag, overlong encodings, unterminated continuations, and overflow inputs.',
      ],
    },
    {
      heading: 'Choosing the right primitive',
      paragraphs: [
        'Use a base-128 varint when the reader consumes a stream, the value distribution is skewed small, and fixed offsets are not essential. Add ZigZag when the logical values are signed and near-zero negatives are common.',
        'Use fixed width when random access, SIMD scans, memory-mapped arrays, or constant-time offsets matter more than byte savings. Use block integer compression, such as delta bit-packing or frame-of-reference encoding, when you have many integers together and can amortize metadata across the block.',
        'The right design is often mixed. A file format may use varints for field tags and lengths, fixed-width values for timestamps, and block compression for postings lists. Varint is a primitive, not a universal compression strategy.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Protocol Buffers encoding guide at https://protobuf.dev/programming-guides/encoding/ and Apache Avro binary encoding specification at https://avro.apache.org/docs/1.11.1/specification/. Study Protobuf Wire Format, Avro Binary Encoding, HPACK Dynamic Table HTTP/2 Case Study, Delta Bit-Packing Integer Compression, Elias-Fano Encoding, Huffman Coding, Roaring Bitmaps, and Schema Registry Case Study next.',
      ],
    },
  ],
};
