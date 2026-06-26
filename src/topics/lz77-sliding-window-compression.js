// LZ77 compression: replace repeated bytes with pointers into a sliding
// history window, then let an entropy coder handle the token stream.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lz77-sliding-window-compression',
  title: 'LZ77 Compression',
  category: 'Concepts',
  summary: 'Dictionary compression without a stored dictionary: keep a sliding history window, emit literals for new bytes, and back-references for repeated spans.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sliding matches', 'tokens and decode'], defaultValue: 'sliding matches' },
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

function lzFlow(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.7, y: 3.8, note: notes.input ?? 'bytes' },
      { id: 'hist', label: 'history', x: 2.6, y: 2.5, note: notes.hist ?? 'seen bytes' },
      { id: 'look', label: 'lookahead', x: 2.6, y: 5.2, note: notes.look ?? 'next bytes' },
      { id: 'match', label: 'match', x: 4.8, y: 3.8, note: notes.match ?? 'best span' },
      { id: 'tokens', label: 'tokens', x: 6.8, y: 3.8, note: notes.tokens ?? 'lit/ref' },
      { id: 'coder', label: 'coder', x: 8.7, y: 3.8, note: notes.coder ?? 'entropy' },
    ],
    edges: [
      { id: 'e-input-hist', from: 'input', to: 'hist', weight: '' },
      { id: 'e-input-look', from: 'input', to: 'look', weight: '' },
      { id: 'e-hist-match', from: 'hist', to: 'match', weight: '' },
      { id: 'e-look-match', from: 'look', to: 'match', weight: '' },
      { id: 'e-match-tokens', from: 'match', to: 'tokens', weight: '' },
      { id: 'e-tokens-coder', from: 'tokens', to: 'coder', weight: '' },
    ],
  }, { title });
}

function* slidingMatches() {
  yield {
    state: lzFlow('LZ77 turns repeated text into back-references'),
    highlight: { active: ['hist', 'look', 'match'], found: ['tokens'] },
    explanation: `${topic.title} keeps a window over bytes already emitted. If the next lookahead bytes occurred recently, the encoder emits a pointer back into history instead of repeating the bytes.`,
    invariant: `The decoder can copy from its own already-produced output, so no external dictionary is needed — the ${topic.category.toLowerCase()} behind ${topic.title} rely on this invariant.`,
  };

  yield {
    state: labelMatrix(
      'Input abcabcabcx',
      [
        { id: 'p0', label: 'pos 0' },
        { id: 'p1', label: 'pos 1' },
        { id: 'p2', label: 'pos 2' },
        { id: 'p3', label: 'pos 3' },
        { id: 'p6', label: 'pos 6' },
        { id: 'p9', label: 'pos 9' },
      ],
      [
        { id: 'char', label: 'char' },
        { id: 'role', label: 'role' },
        { id: 'best', label: 'best' },
      ],
      [
        ['a', 'literal', 'lit a'],
        ['b', 'literal', 'lit b'],
        ['c', 'literal', 'lit c'],
        ['a', 'look', 'match len6'],
        ['a', 'inside ref', 'dist 3'],
        ['x', 'new', 'lit x'],
      ],
    ),
    highlight: { active: ['p3:best', 'p6:best'], found: ['p0:best', 'p1:best', 'p2:best'] },
    explanation: `After the first abc is literal history, the next six bytes abcabc match bytes three positions back. The ${topic.title} token can be length 6, distance 3. The final x is new, so it stays literal.`,
  };

  yield {
    state: labelMatrix(
      'Window vocabulary',
      [
        { id: 'lit', label: 'literal' },
        { id: 'len', label: 'length' },
        { id: 'dist', label: 'distance' },
        { id: 'win', label: 'window' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['raw byte', 'one symbol'],
        ['bytes copy', 'coded value'],
        ['how far back', 'coded value'],
        ['history cap', 'bounded mem'],
      ],
    ),
    highlight: { active: ['len:means', 'dist:means'], compare: ['lit:cost'], found: ['win:cost'] },
    explanation: `An ${topic.title} stream alternates literals with length-distance pairs. The window bounds memory and also bounds how far a reference may point.`,
  };

  yield {
    state: lzFlow('Match finding is the data-structure hot path', { hist: 'hash chains', look: 'prefix', match: 'longest', tokens: 'sequence', coder: 'Huffman/ANS' }),
    highlight: { active: ['hist', 'match'], found: ['tokens'], compare: ['coder'] },
    explanation: `The simple ${topic.title} idea hides an engineering problem: finding good matches quickly. Real encoders use hash tables, rolling hashes, suffix-like structures, lazy matching, and level knobs to trade CPU for ratio.`,
  };
}

function* tokensAndDecode() {
  yield {
    state: labelMatrix(
      'Token stream for abcabcabcx',
      [
        { id: 't0', label: 'tok 0' },
        { id: 't1', label: 'tok 1' },
        { id: 't2', label: 'tok 2' },
        { id: 't3', label: 'tok 3' },
        { id: 't4', label: 'tok 4' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'payload', label: 'payload' },
        { id: 'out', label: 'output' },
      ],
      [
        ['literal', 'a', 'a'],
        ['literal', 'b', 'ab'],
        ['literal', 'c', 'abc'],
        ['backref', 'len6 d3', 'abcabcabc'],
        ['literal', 'x', 'abcabcabcx'],
      ],
    ),
    highlight: { active: ['t3:kind', 't3:payload'], found: ['t3:out'], compare: ['t0:payload'] },
    explanation: `Decoding in ${topic.title} is deterministic. A literal appends one byte. A back-reference copies length bytes from distance bytes behind the current output cursor.`,
    invariant: `A valid ${topic.title} reference must point into bytes the decoder has already reconstructed.`,
  };

  yield {
    state: labelMatrix(
      'Overlapping copy makes runs cheap',
      [
        { id: 'c0', label: 'step 0' },
        { id: 'c1', label: 'step 1' },
        { id: 'c2', label: 'step 2' },
        { id: 'c3', label: 'step 3' },
      ],
      [
        { id: 'token', label: 'token' },
        { id: 'out', label: 'output' },
      ],
      [
        ['lit a', 'a'],
        ['len5 d1', 'aa'],
        ['copy again', 'aaaa'],
        ['copy again', 'aaaaaa'],
      ],
    ),
    highlight: { active: ['c1:token', 'c2:token', 'c3:token'], found: ['c3:out'] },
    explanation: `${topic.title} can copy from bytes it is currently writing. With distance 1 and length 5, one literal a expands to ${'a'.repeat(6)}. This is why runs compress so well.`,
  };

  yield {
    state: labelMatrix(
      'Where LZ77 appears',
      [
        { id: 'deflate', label: 'DEFLATE' },
        { id: 'zstd', label: 'Zstd' },
        { id: 'brotli', label: 'Brotli' },
        { id: 'lz4', label: 'LZ4' },
      ],
      [
        { id: 'match', label: 'match step' },
        { id: 'coder', label: 'coder' },
      ],
      [
        ['LZ77 seq', 'Huffman'],
        ['LZ match', 'FSE/Huff'],
        ['LZ match', 'context code'],
        ['fast match', 'simple bytes'],
      ],
    ),
    highlight: { active: ['deflate:match', 'zstd:coder'], compare: ['lz4:coder'] },
    explanation: `Many compressors share the ${topic.title.split(' ')[0]} family idea and differ in match search, entropy coding, framing, dictionaries, and speed-vs-ratio policy.`,
  };

  yield {
    state: lzFlow('LZ77 feeds an entropy coder rather than replacing one', { tokens: 'lit/len/dist', coder: 'short codes' }),
    highlight: { active: ['tokens', 'coder'], found: ['match'], compare: ['input'] },
    explanation: `${topic.title} removes repeated byte strings. Huffman, Arithmetic Coding, or ANS then compress the token values that remain. Model first, code second.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sliding matches') yield* slidingMatches();
  else if (view === 'tokens and decode') yield* tokensAndDecode();
  else throw new InputError('Pick an LZ77 view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The sliding-matches view shows an encoder moving left to right through bytes. Active cells mark the current lookahead, which means the bytes the encoder is trying to replace with a pointer. Found cells mark committed tokens, either literals or back-references.',
        'The tokens-and-decode view shows the decoder rebuilding output from the token stream. A literal appends one byte. A back-reference copies length bytes from distance bytes behind the current output cursor, so the output buffer is also the dictionary.',
        {type: 'callout', text: 'LZ77 works because the decoder output is also the dictionary: every back-reference points backward into bytes already reconstructed.'},
        {type: 'image', src: './assets/gifs/lz77-sliding-window-compression.gif', alt: 'Animated walkthrough of the lz77 sliding window compression visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Compression exists because real data repeats. Source files repeat names, markup repeats tags, logs repeat prefixes, and binaries repeat instruction patterns. Sending every repeated byte literally wastes storage and bandwidth.',
        'LZ77 is a dictionary compressor without a transmitted dictionary. The encoder uses recent output history as the dictionary, and the decoder rebuilds the same history as it goes. That shared history lets the stream say, in effect, copy the next bytes from over there.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first compressor uses a fixed dictionary. Give common words or byte strings short codes, then replace occurrences in the input. This can work when the domain is narrow and both sides already know the dictionary.',
        'Run-length encoding is another reasonable first attempt. It stores a repeated byte once with a count, so six a bytes can become one a plus the number six. It is simple and fast, but it only sees consecutive copies of the same symbol.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed dictionaries have a coordination problem. The decoder must know the same dictionary as the encoder, and a dictionary built for English text does not fit JSON, machine code, or image filters. A universal compressor needs to adapt to the actual stream.',
        'Run-length encoding has a pattern problem. The string abcabcabc has no single-byte run, but it is highly repetitive. A compressor needs to recognize repeated substrings, not only repeated characters.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat already emitted bytes as a sliding dictionary. If the next lookahead bytes occurred recently, the encoder emits a distance-length pair instead of the bytes themselves. Distance says how far back to start copying, and length says how many bytes to copy.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Image1_lz77.svg', alt: 'LZ77 sliding-window diagram showing search buffer and lookahead buffer over a byte stream', caption: 'The sliding window is the implicit dictionary: recent history is searched for a prefix of the lookahead. Source: Wikimedia Commons, cisseR, CC BY-SA 4.0.'},
        'The dictionary does not have to be sent because both sides maintain it. Every literal the decoder writes becomes available for later references. Every reference the decoder expands also becomes available for later references.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder keeps a search buffer, which is recent history, and a lookahead buffer, which is the next input. At each position it searches history for the longest prefix of lookahead. If the match is useful, it emits a back-reference; otherwise it emits the next byte as a literal.',
        'Real encoders spend most of their effort finding matches. A naive search compares the lookahead against every history position, which is too expensive for large windows. Practical encoders use hash tables, hash chains, rolling hashes, lazy matching, and compression-level knobs to trade CPU time for better ratio.',
        'The decoder is simpler than the encoder. It reads one token at a time, appends literals directly, and expands references by copying from the output it has already produced. Many deployed formats pair LZ77-style tokens with an entropy coder such as Huffman coding or ANS so frequent token values get shorter bit codes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: every reference points backward into bytes the decoder has already reconstructed. The encoder only emits such references because it found the match in prior history. The decoder has the same prior history at the same token boundary, so the pointer resolves to the same bytes.',
        'Overlapping copies are safe under byte-at-a-time decoding. If the output is a and the token says distance 1, length 5, the decoder copies from the byte it just wrote, then from the new byte, and so on. One literal a becomes aaaaaa without a special run-length mode.',
        'Optimal compression is not guaranteed. A greedy longest match can choose a token that blocks a better later token. That affects ratio, not correctness, because any valid token stream with backward references decodes deterministically.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Decoding is linear in output size, O(N), with O(W) memory for a window of W bytes. If output doubles, decode work doubles because each byte is written once. The dominant operation is memory copy, not search.',
        'Encoding cost depends on match finding. A naive encoder can spend O(W * L) per position for window size W and lookahead length L. Hash-chain encoders cap the number of candidates, so behavior is closer to O(N * chain_depth) in practice, with better ratios at higher compression levels.',
        'Window size is the main memory knob. A larger window can find older matches, but it also costs memory, wider distance codes, and more search work. DEFLATE uses a 32 KB window; newer formats can use much larger windows when the workload benefits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LZ77-family compression appears in DEFLATE, gzip, ZIP, PNG, Brotli, Zstandard, LZ4, and Snappy. The exact formats differ in match search, token encoding, block framing, dictionaries, and entropy coding. The shared idea is still recent history plus length-distance references.',
        'It is strong for text, source code, logs, markup, serialized data, and binaries because repeated substrings are common and often local. Web compression works well because servers can spend CPU once while clients decode cheaply many times.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LZ77 cannot compress data with no useful repetition. Encrypted data, random bytes, hashes, and already-compressed media often become larger because token overhead remains while matches disappear. Good formats detect this and store such blocks uncompressed.',
        'Locality is also a hard limit. If the repeated phrase lies outside the window, a reference cannot reach it. Larger windows help some archives but cost memory and may slow encoding.',
        'The security failure mode is decompression expansion. A small stream can describe a huge output through repeated references, so decoders need output limits when handling untrusted data. The algorithm is simple; the resource policy around it is not optional.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Encode abcabcabcx. The first a, b, and c are new, so the encoder emits three literals. At position 3, the lookahead begins abcabc, which matches bytes starting three positions back.',
        'The encoder can emit a back-reference with distance 3 and length 6. The token stream is literal a, literal b, literal c, reference d=3 len=6, literal x. The decoder writes abc, copies six bytes from three bytes back to get abcabcabc, then appends x.',
        'The saving is concrete. Ten input bytes become three literal bytes, one length-distance token, and one final literal before entropy coding. If the reference token costs fewer bits than six literals, the stream shrinks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977. Then read Storer and Szymanski on textual substitution, RFC 1951 for DEFLATE, RFC 8878 for Zstandard, and LZ4 design notes for the fast-decoder design point.',
        'Study hash tables for match finding, Huffman coding for DEFLATE token coding, arithmetic coding and ANS for newer entropy coders, and suffix arrays if you want the deeper string-search view. Compare gzip, Zstandard, Brotli, LZ4, and Snappy by speed, ratio, window policy, and decoder complexity.',
      ],
    },
  ],
};
