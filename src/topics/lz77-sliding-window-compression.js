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
    explanation: 'LZ77 keeps a window over bytes already emitted. If the next lookahead bytes occurred recently, the encoder emits a pointer back into history instead of repeating the bytes.',
    invariant: 'The decoder can copy from its own already-produced output, so no external dictionary is needed.',
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
    explanation: 'After the first abc is literal history, the next six bytes abcabc match bytes three positions back. The token can be length 6, distance 3. The final x is new, so it stays literal.',
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
    explanation: 'An LZ77 stream alternates literals with length-distance pairs. The window bounds memory and also bounds how far a reference may point.',
  };

  yield {
    state: lzFlow('Match finding is the data-structure hot path', { hist: 'hash chains', look: 'prefix', match: 'longest', tokens: 'sequence', coder: 'Huffman/ANS' }),
    highlight: { active: ['hist', 'match'], found: ['tokens'], compare: ['coder'] },
    explanation: 'The simple idea hides an engineering problem: finding good matches quickly. Real encoders use hash tables, rolling hashes, suffix-like structures, lazy matching, and level knobs to trade CPU for ratio.',
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
    explanation: 'Decoding is deterministic. A literal appends one byte. A back-reference copies length bytes from distance bytes behind the current output cursor.',
    invariant: 'A valid reference must point into bytes the decoder has already reconstructed.',
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
    explanation: 'LZ77 can copy from bytes it is currently writing. With distance 1 and length 5, one literal a expands to aaaaaa. This is why runs compress so well.',
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
    explanation: 'Many compressors share the LZ family idea and differ in match search, entropy coding, framing, dictionaries, and speed-vs-ratio policy.',
  };

  yield {
    state: lzFlow('LZ77 feeds an entropy coder rather than replacing one', { tokens: 'lit/len/dist', coder: 'short codes' }),
    highlight: { active: ['tokens', 'coder'], found: ['match'], compare: ['input'] },
    explanation: 'LZ77 removes repeated byte strings. Huffman, Arithmetic Coding, or ANS then compress the token values that remain. Model first, code second.',
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
      heading: 'What it is',
      paragraphs: [
        'LZ77 is a dictionary-compression algorithm that does not ship a dictionary. The encoder and decoder build the dictionary implicitly from the already-seen byte stream. New bytes are emitted as literals. Repeated spans are emitted as length-distance pairs pointing backward into a sliding history window.',
        'This makes LZ77 a natural companion to Sliding Window. The window is both the searchable history and the decoder contract: a back-reference can only copy from bytes that already exist in the reconstructed output.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each input position, the encoder searches the history window for the longest useful match against the lookahead buffer. If no match is worth coding, emit a literal. If a match is useful, emit a pair such as length 6, distance 3, meaning "copy six bytes from three bytes back." The decoder appends literals and performs the same copies from its own output buffer.',
        'The reference can overlap the region being written. That is not a bug; it is essential. A token like length 5, distance 1 turns one literal a into a run of six a characters. The decoder copies one byte at a time and the newly written bytes become available for the rest of the copy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Naive match finding can be expensive because every lookahead position might be compared with many earlier positions. Practical encoders use hash tables, hash chains, binary trees, suffix-array-like indexes, lazy matching, and compression levels to bound search. Decoding is usually much simpler and faster: read a token, append a literal or copy from a ring buffer.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'DEFLATE, used by gzip, ZIP, and PNG, combines LZ77 length-distance pairs with Huffman Coding. LZ4 optimizes for very fast decode and simple framing. Zstandard and Brotli use richer match modeling and stronger entropy coding. The shared lesson is that dictionary matching and entropy coding are separate layers: first replace repeated strings, then assign short bit patterns to common token values.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'LZ77 does not guarantee compression. Inputs with no repeated structure can grow after token overhead. Match length, window size, and match-search policy matter. Another misconception is that the decoder needs the original input dictionary. It only needs the previous decoded output and the same token stream. That is why LZ77 can stream with bounded memory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Ziv and Lempel, "A Universal Algorithm for Sequential Data Compression", at https://courses.cs.duke.edu/spring03/cps296.5/papers/ziv_lempel_1977_universal_algorithm.pdf, and RFC 1951 DEFLATE at https://datatracker.ietf.org/doc/html/rfc1951. Study Sliding Window, Hash Table, Suffix Array & LCP, Huffman Coding, Arithmetic & ANS Coding, DEFLATE Case Study, and Tokenization (BPE) next.',
      ],
    },
  ],
};
