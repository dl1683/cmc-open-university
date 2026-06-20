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
      heading: 'Why this exists',
      paragraphs: [
        "DEFLATE exists because general-purpose compression needs a practical balance. It must find repeated byte sequences, represent them compactly, decode in a streaming way, and run on ordinary machines. It cannot depend on a giant model, random access to the whole file, or a decoder that guesses the encoder strategy.",
        "The format became durable because it composes two simple ideas well. LZ77 turns repeated text into length-distance references. Huffman coding gives short bit patterns to common symbols. Together they became the compression core behind ZIP, gzip, zlib streams, PNG image data, and many older protocols and containers.",
        "The most important distinction is between the format and the compressor. DEFLATE defines a bitstream grammar that every decoder must understand. Encoders are free to spend little or lots of CPU finding matches, splitting blocks, and choosing Huffman tables. Different encoders can produce different valid streams for the same input.",
        {type:'callout', text:'DEFLATE separates match modeling from entropy coding so encoders can innovate while every decoder follows the same block grammar.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/82/Huffman_tree_2.svg', alt:'Huffman coding tree with weighted internal nodes and character-frequency leaves.', caption:'Huffman tree from example text. Source: Wikimedia Commons, Meteficha, public domain.'}
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        "The naive approach is run-length encoding: if bytes repeat, store the byte and a count. That works for long runs like AAAAAA, but real text and binary data usually repeat phrases, headers, field names, words, and fragments that are separated by other bytes. You need references to earlier windows, not only repeated single characters.",
        "Another naive approach is plain LZ77 with fixed-size tokens. Replace a repeated span with length and distance, and emit literals otherwise. This captures repeated strings, but it still wastes bits when common literals, common lengths, and common distances are represented with the same width as rare ones.",
        "A third naive approach is to build a custom code tree and serialize the tree directly. That can work, but it bloats metadata and complicates decoding. DEFLATE instead uses carefully defined block types and canonical Huffman codes so the decoder can rebuild tables from compact code-length information."
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "DEFLATE separates modeling from coding. The LZ77 part models the data as a sequence of literals and back-references. A literal says append this byte. A back-reference says copy this many bytes from this distance behind the current output position. The Huffman part then codes the resulting symbols according to frequency.",
        "Literals and lengths share one alphabet. Distances use a second alphabet. That split matters because a back-reference needs both a length and a distance, while a literal needs no distance at all. Extra bits refine ranges that would otherwise require too many separate symbols.",
        "Dynamic blocks add another layer. Instead of using one fixed Huffman table for everything, a block can transmit code lengths for its own literal/length and distance alphabets. The decoder reconstructs canonical codes from those lengths. This keeps the format deterministic without shipping pointer-heavy trees."
      ],
    },
    {
      heading: 'The mechanism',
      paragraphs: [
        "A DEFLATE stream is made of blocks. A stored block carries raw bytes with little compression work. A fixed-Huffman block uses predefined tables. A dynamic-Huffman block sends enough metadata for the decoder to rebuild block-specific tables, then uses those tables for the compressed payload. A reserved block type is invalid.",
        "Inside a compressed block, inflate reads symbols from the literal/length Huffman alphabet. Values below 256 are literal bytes. The end-of-block symbol ends the block. Length symbols represent a copy length, sometimes with extra bits. After a length, the decoder reads a distance symbol from the distance alphabet, again sometimes with extra bits, and copies bytes from the already produced output window.",
        "The copy can overlap with the bytes being written. That is not a bug; it is how patterns like repeated characters expand efficiently. The decoder only needs a bounded sliding window of previous output, not the entire original file. Wrappers such as zlib and gzip add headers and checksums around the DEFLATE stream, but the inner block grammar is the same."
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "The block-pipeline visual proves that DEFLATE is a composition, not a single magic table. Raw bytes first become LZ77 tokens. Those tokens split into a literal/length alphabet and a distance alphabet. Huffman coding then turns those alphabets into bits inside a block.",
        "The HELLOHELLO matrix proves the LZ77 move. The first HELLO has no earlier copy, so it appears as literals. The second HELLO can be represented as length five, distance five. That pair means copy five bytes starting five bytes behind the current output position. The compressor has replaced a repeated span with a pointer into recent output.",
        "The inflate-decode visual proves the decoder contract. A literal appends a byte. A length symbol is incomplete until a distance is read. The output window is not optional state; it is the dictionary that makes length-distance copies meaningful."
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "DEFLATE works because many byte streams contain both repeated substrings and skewed symbol frequencies. Source code repeats keywords and identifiers. HTML repeats tags and attribute names. JSON repeats field names. PNG filtering makes neighboring pixel values more predictable before compression. LZ77 captures repeated spans; Huffman coding exploits the fact that some tokens appear much more often than others.",
        "The format also works operationally because decoding is simpler and more constrained than encoding. A decoder does not need to know how the encoder found matches. It only follows the block grammar, rebuilds canonical tables, reads symbols, and appends or copies bytes. This asymmetry is why implementations can interoperate even when compressors make different speed and ratio choices.",
        "Canonical Huffman coding is a key reason the metadata stays manageable. Code lengths are enough to reconstruct the exact codes in a deterministic order. The stream sends lengths, not tree pointers."
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        "Encoding is where most of the cost lives. A fast encoder may use a shallow hash chain, choose the first acceptable match, and avoid expensive block splitting. A slower encoder may search more candidates, use lazy matching, tune dynamic blocks, and spend CPU to save more bytes. Both can produce valid DEFLATE streams.",
        "Dynamic Huffman blocks often improve compression on larger or skewed inputs, but the code-length metadata costs bits. For tiny payloads, stored blocks or fixed-Huffman blocks can be better. For incompressible data, trying too hard wastes CPU and may even increase size after headers and metadata.",
        "DEFLATE is also limited by its window and age. The sliding window cannot reference arbitrarily old data. The Huffman coder is not as strong as modern entropy coders in many cases. Newer codecs can beat it on ratio, speed, dictionary training, or random-access features. DEFLATE stays relevant because compatibility and tooling are enormous."
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        "DEFLATE appears anywhere compatibility matters. gzip files, ZIP archives, zlib streams, HTTP content encodings in older stacks, PNG image data, package formats, and countless embedded tools depend on it. Even when newer codecs are available, DEFLATE is often the baseline that every environment can decode.",
        "A practical example is compressing a JSON response. Field names repeat across objects, punctuation repeats constantly, and common values appear many times. LZ77 can turn repeated field names into back-references. Huffman coding can give short codes to common punctuation, letters, lengths, and distances. A wrapper such as gzip then adds metadata and a checksum for transport or storage.",
        "PNG is another useful example because it shows preprocessing. Image filters transform rows so nearby pixels produce smaller residuals. DEFLATE then compresses those residual bytes. The compressor is not only looking for visible repeated strings; it is benefiting from earlier transforms that make the byte stream more regular."
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "The first misconception is confusing DEFLATE with gzip. gzip is a wrapper format that usually contains a DEFLATE stream plus headers and a CRC. zlib is another wrapper. Raw DEFLATE has no filename, no gzip header, and no wrapper checksum.",
        "The second failure mode is expecting good random access. A plain DEFLATE stream is decoded sequentially because later bytes may refer to earlier output. Containers can add independent blocks or indexes, but the base format is not a random-access database.",
        "The third failure mode is ignoring adversarial or malformed input. Decoders must enforce block grammar, distance validity, output limits, checksum expectations from wrappers, and resource bounds. Compression formats are parsers, and parsers need defensive implementation."
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study RFC 1951 for the DEFLATE bitstream, RFC 1950 for zlib, RFC 1952 for gzip, LZ77, Huffman coding, canonical prefix codes, sliding-window dictionaries, PNG filters, and compression bombs next. Nearby curriculum topics include Arithmetic and ANS Coding, Base-128 Varint and ZigZag Encoding, HPACK Dynamic Table, Delta Bit-Packing, and general prefix-tree data structures.",
        "The transfer lesson is that compression is usually a pipeline. First expose structure, then model repetition, then encode frequent symbols cheaply, then wrap the stream with the metadata needed by the container. DEFLATE is old, but that composition still teaches modern codecs."
      ],
    },
  ],
};
