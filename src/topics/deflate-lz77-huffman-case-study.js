// DEFLATE: a compressed data format that composes LZ77 length-distance
// sequences with Huffman-coded literal/length and distance alphabets.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'deflate-lz77-huffman-case-study',
  title: 'DEFLATE Case Study',
  category: 'Systems',
  summary: 'The ZIP/gzip/PNG compression core: parse bytes into LZ77 literals and back-references, then Huffman-code the literal/length and distance streams.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['block pipeline', 'inflate decode'], defaultValue: 'block pipeline' },
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

function deflateGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw bytes', x: 0.7, y: 3.8, note: notes.raw ?? 'input' },
      { id: 'lz', label: 'LZ77', x: 2.5, y: 3.8, note: notes.lz ?? 'match parse' },
      { id: 'litlen', label: 'lit/len', x: 4.4, y: 2.6, note: notes.litlen ?? 'alphabet' },
      { id: 'dist', label: 'dist', x: 4.4, y: 5.1, note: notes.dist ?? 'alphabet' },
      { id: 'huff', label: 'Huffman', x: 6.4, y: 3.8, note: notes.huff ?? 'codes' },
      { id: 'block', label: 'block', x: 8.4, y: 3.8, note: notes.block ?? 'bits' },
    ],
    edges: [
      { id: 'e-raw-lz', from: 'raw', to: 'lz', weight: '' },
      { id: 'e-lz-litlen', from: 'lz', to: 'litlen', weight: '' },
      { id: 'e-lz-dist', from: 'lz', to: 'dist', weight: '' },
      { id: 'e-litlen-huff', from: 'litlen', to: 'huff', weight: '' },
      { id: 'e-dist-huff', from: 'dist', to: 'huff', weight: '' },
      { id: 'e-huff-block', from: 'huff', to: 'block', weight: '' },
    ],
  }, { title });
}

function* blockPipeline() {
  yield {
    state: deflateGraph('DEFLATE is LZ77 plus Huffman-coded blocks'),
    highlight: { active: ['lz', 'litlen', 'dist', 'huff'], found: ['block'] },
    explanation: 'DEFLATE is a data format, not one fixed compressor strategy. Encoders choose matches and Huffman tables; compliant decoders only need to understand the resulting block grammar.',
    invariant: 'A DEFLATE block decodes to bytes by alternating literals and length-distance copies.',
  };

  yield {
    state: labelMatrix(
      'HELLOHELLO tokenization',
      [
        { id: 't0', label: 'tok 0' },
        { id: 't1', label: 'tok 1' },
        { id: 't2', label: 'tok 2' },
        { id: 't3', label: 'tok 3' },
        { id: 't4', label: 'tok 4' },
        { id: 't5', label: 'tok 5' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'litlen', label: 'lit/len' },
        { id: 'dist', label: 'dist' },
      ],
      [
        ['literal', 'H', ''],
        ['literal', 'E', ''],
        ['literal', 'L', ''],
        ['literal', 'L', ''],
        ['literal', 'O', ''],
        ['backref', 'len 5', 'dist 5'],
      ],
    ),
    highlight: { active: ['t5:kind', 't5:litlen', 't5:dist'], found: ['t0:litlen', 't4:litlen'] },
    explanation: 'The first HELLO has to appear as literals. The second HELLO can become a back-reference: length 5, distance 5. DEFLATE then encodes length and distance through separate alphabets.',
  };

  yield {
    state: labelMatrix(
      'Block choices',
      [
        { id: 'rawblk', label: 'type 0' },
        { id: 'fixed', label: 'type 1' },
        { id: 'dyn', label: 'type 2' },
        { id: 'bad', label: 'type 3' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'use', label: 'use' },
      ],
      [
        ['stored', 'incompressible'],
        ['fixed huff', 'small/simple'],
        ['dynamic', 'best ratio'],
        ['reserved', 'invalid'],
      ],
    ),
    highlight: { active: ['dyn:mode', 'dyn:use'], compare: ['rawblk:use'], removed: ['bad:mode'] },
    explanation: 'A block may be stored with no compression, encoded with fixed Huffman tables, or encoded with dynamic Huffman tables transmitted in the block header. The reserved type is invalid.',
  };

  yield {
    state: deflateGraph('Dynamic blocks compress the code tables too', { litlen: 'code lens', dist: 'code lens', huff: 'canonical', block: 'header+data' }),
    highlight: { active: ['litlen', 'dist', 'huff', 'block'], found: ['e-huff-block'] },
    explanation: 'Dynamic Huffman blocks send code lengths, not tree pointers. Canonical Huffman reconstruction lets the decoder rebuild identical tables from compact length metadata.',
  };
}

function* inflateDecode() {
  yield {
    state: labelMatrix(
      'Inflate decode loop',
      [
        { id: 'b0', label: 'step 0' },
        { id: 'b1', label: 'step 1' },
        { id: 'b2', label: 'step 2' },
        { id: 'b3', label: 'step 3' },
      ],
      [
        { id: 'read', label: 'read' },
        { id: 'action', label: 'action' },
      ],
      [
        ['H code', 'append H'],
        ['E code', 'append E'],
        ['len 5', 'need dist'],
        ['dist 5', 'copy HELLO'],
      ],
    ),
    highlight: { active: ['b2:read', 'b3:read', 'b3:action'], found: ['b0:action'] },
    explanation: 'Inflate reads one Huffman symbol from the literal/length alphabet. A literal appends one byte. A length symbol asks for extra bits and a following distance symbol, then copies from the output window.',
    invariant: 'The bitstream is read LSB-first for many fields, but Huffman codes are interpreted by the DEFLATE canonical-code rules.',
  };

  yield {
    state: labelMatrix(
      'What wrappers add',
      [
        { id: 'raw', label: 'raw deflate' },
        { id: 'zlib', label: 'zlib' },
        { id: 'gzip', label: 'gzip' },
        { id: 'png', label: 'PNG' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'extra', label: 'extra' },
      ],
      [
        ['blocks', 'no wrapper'],
        ['deflate', 'Adler-32'],
        ['deflate', 'CRC+name'],
        ['deflate', 'image filters'],
      ],
    ),
    highlight: { active: ['raw:contains', 'zlib:extra', 'gzip:extra'], compare: ['png:extra'] },
    explanation: 'Raw DEFLATE is just compressed blocks. zlib and gzip wrap it with headers and checksums. PNG adds image filtering before DEFLATE so nearby pixels become more compressible.',
  };

  yield {
    state: deflateGraph('Encoder policy is outside the format contract', { raw: 'bytes', lz: 'choose refs', huff: 'choose tables', block: 'valid stream' }),
    highlight: { active: ['raw', 'lz', 'huff'], found: ['block'], compare: ['dist'] },
    explanation: 'Two encoders can produce different valid DEFLATE streams for the same input. One may spend more CPU to find better matches or tables; another may prioritize speed.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'lz77', label: 'LZ77' },
        { id: 'huff', label: 'Huffman' },
        { id: 'arith', label: 'ANS/arith' },
        { id: 'delta', label: 'delta pack' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'nearby', label: 'nearby' },
      ],
      [
        ['find repeats', 'strings'],
        ['short codes', 'prefix tree'],
        ['near entropy', 'alt coder'],
        ['small ints', 'columns'],
      ],
    ),
    highlight: { active: ['lz77:job', 'huff:job'], compare: ['arith:nearby', 'delta:nearby'] },
    explanation: 'DEFLATE is the clean composition case study: string repeats become LZ77 tokens, token frequencies become Huffman codes, and the decoder reconstructs bytes with only bounded history state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'block pipeline') yield* blockPipeline();
  else if (view === 'inflate decode') yield* inflateDecode();
  else throw new InputError('Pick a DEFLATE view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'DEFLATE is the compressed data format behind gzip, ZIP, zlib streams, and PNG image data. It combines LZ77-style literals and length-distance pairs with Huffman Coding. The format defines how blocks, code tables, literals, lengths, distances, and end markers are represented; it does not require one exact compressor algorithm.',
        'That distinction matters. A fast encoder and a slow high-ratio encoder can both produce valid DEFLATE. The decoder contract is stable: rebuild the Huffman tables, read symbols, append literals, and copy length-distance spans from the output window.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder parses input bytes into a sequence of literals and LZ77 back-references. Literals and lengths share one Huffman alphabet. Distances use a second Huffman alphabet. Length and distance symbols may be followed by extra bits to represent exact values. A block ends with a special end-of-block code.',
        'Blocks come in three usable forms: stored blocks with no compression, fixed-Huffman blocks with predefined tables, and dynamic-Huffman blocks whose code lengths are transmitted in the block header. Dynamic blocks usually improve compression on larger or skewed inputs, while fixed blocks avoid table overhead.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Decoding is bounded-memory streaming: maintain a history window, read Huffman symbols, and copy from already produced output. Encoding is the harder side because match search and table selection are policy decisions. Compression level, lazy matching, hash-chain length, block splitting, and table construction affect CPU cost and ratio without changing the file format.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'gzip wraps DEFLATE with a file header and CRC. zlib wraps it with a smaller stream header and Adler-32. PNG filters image scanlines before DEFLATE so nearby pixel values have smaller residuals and repeated structure. ZIP stores files individually, often with DEFLATE as the per-file compression method.',
        'The common lesson is modular compression. A transform or parser exposes structure first. LZ77 captures repeated substrings. Huffman coding spends fewer bits on frequent token values. A wrapper then adds metadata, checksums, filenames, or container semantics.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'DEFLATE is not the same as gzip. gzip is a wrapper format that commonly contains a DEFLATE stream. zlib is another wrapper. Raw DEFLATE has no filename, timestamp, or checksum wrapper by itself. Another misconception is that dynamic Huffman always wins; on tiny inputs, sending the table can cost more than it saves. Finally, DEFLATE is not random-access friendly unless the container adds independent blocks or indexes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 1951 DEFLATE at https://datatracker.ietf.org/doc/html/rfc1951, RFC 1950 zlib format at https://datatracker.ietf.org/doc/html/rfc1950, RFC 1952 gzip format at https://datatracker.ietf.org/doc/html/rfc1952, and Ziv and Lempel 1977 at https://courses.cs.duke.edu/spring03/cps296.5/papers/ziv_lempel_1977_universal_algorithm.pdf. Study LZ77 Compression, Huffman Coding, Arithmetic & ANS Coding, Base-128 Varint & ZigZag Encoding, HPACK Dynamic Table HTTP/2 Case Study, and Delta Bit-Packing Integer Compression next.',
      ],
    },
  ],
};
