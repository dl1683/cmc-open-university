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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pipeline as a decoder contract. Active nodes show literals, length-distance pairs, Huffman tables, and the output window; the inflate view shows how one symbol either appends a byte or copies earlier bytes. The safe inference is that a length-distance pair is legal only if the referenced bytes already exist in the sliding window.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'General-purpose compression needs a format that decodes quickly, streams from left to right, and works without a giant model. DEFLATE solves this by combining LZ77 back-references with Huffman coding. LZ77 removes repeated byte sequences, while Huffman coding assigns shorter bit codes to more frequent symbols.',
        {type:'callout', text:'DEFLATE separates match modeling from entropy coding so encoders can innovate while every decoder follows the same block grammar.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/82/Huffman_tree_2.svg', alt:'Huffman coding tree with weighted internal nodes and character-frequency leaves.', caption:'Huffman tree from example text. Source: Wikimedia Commons, Meteficha, public domain.'}
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to replace repeated words with dictionary entries or run-length counts. That works for simple inputs, and it explains why repeated text compresses. It does not define a compact, byte-level stream that a decoder can process without seeing the whole file first.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that repetitions have two different costs. You need to find repeated byte spans, and then you need to encode the resulting literals, lengths, and distances efficiently. A fixed dictionary misses local repeats, while raw length-distance tokens can still waste bits if common tokens are not given short codes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split compression into modeling and coding. The encoder models the input as literals and LZ77 copies from a 32 KiB sliding window. Then it entropy-codes those tokens with fixed or dynamic Huffman tables, while the decoder only has to obey the block grammar.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DEFLATE stream is a sequence of blocks. A block can be stored without compression, compressed with fixed Huffman codes, or compressed with dynamic Huffman codes sent in the block header. During inflate, a literal symbol appends one byte, and a length symbol is followed by a distance symbol that copies bytes from the already decoded output.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation of bytes. Every decoded step either emits an explicit literal or copies a byte sequence already present in the output window. Because the encoder chose each length-distance pair from earlier bytes, replaying those pairs reconstructs the same byte stream.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Decode time is linear in the number of output bytes plus Huffman-table work per block. Memory is bounded by the 32 KiB sliding window, the bit reader, and the Huffman tables. Compression cost varies by encoder: a fast encoder may search a small match window, while a slow encoder spends more CPU to find longer matches and better block splits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DEFLATE is the core compression method behind ZIP, gzip, zlib streams, PNG image data, and many older network formats. It fits files where repeated byte patterns are common and where broad decoder compatibility matters. It is also useful when streaming decode and small memory are more important than state-of-the-art compression ratio.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on encrypted, already-compressed, or high-entropy data because there are few useful repeats and symbol frequencies are flat. It also has a limited history window, so repeats farther than 32 KiB cannot be referenced directly. Modern codecs such as Zstandard and Brotli often compress better by using larger windows, richer modeling, and stronger entropy coding.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Compress the ASCII string HELLOHELLO. The first five bytes, H E L L O, must be emitted as literals because the output window is empty. The second HELLO can be encoded as length 5, distance 5, meaning copy 5 bytes starting 5 bytes behind the current output cursor.',
        'The behavioral cost is clear. Literal encoding stores 10 byte symbols before Huffman coding, while the LZ77 parse stores 5 literal symbols plus one length and one distance. If those length and distance symbols have short Huffman codes, the second HELLO becomes much cheaper than writing 5 more literals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read RFC 1951 for DEFLATE, RFC 1950 for zlib, and RFC 1952 for gzip. Then study LZ77, canonical Huffman coding, PNG filtering, checksums, and modern successors such as Brotli and Zstandard. The main engineering lesson is the format split: encoders can compete on search strategy while decoders stay simple and stable.',
      ],
    },
  ],
};
