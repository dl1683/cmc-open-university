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
        `LZ77 is a lossless compression idea for byte streams that repeat themselves. It does not try to understand words, objects, records, images, or source code. It sees only a sequence of symbols. When the next symbols have already appeared nearby, the encoder emits a reference to that earlier span instead of writing the same bytes again. A reference usually says two things: how far back to look and how many bytes to copy.`,
        `The method is called sliding-window compression because the encoder keeps a bounded history of recent output and a lookahead region of upcoming input. The history acts like a dictionary, but it is not a dictionary file sent separately. It is just the bytes that both encoder and decoder already agree have been produced. That makes LZ77 simple to decode, useful in streaming formats, and flexible across many kinds of data.`,
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        `A reasonable first compressor is a static dictionary. Count common phrases, assign short codes, and replace every occurrence with an identifier. That can work when the data domain is stable: known words in a language, known protocol fields, or known templates in logs. The wall is coordination. The decoder must have the same dictionary, the dictionary has to be transmitted or standardized, and the dictionary may be bad for the next file.`,
        `Another obvious approach is run-length encoding: if a byte repeats many times, write the byte and the count. That catches runs like aaaaaa, but misses abcabcabc, repeated JSON keys, repeated HTML tags, repeated stack-trace prefixes, and repeated blocks in binaries. Real data often repeats as phrases, not single characters. LZ77 solves the broader problem by letting any recent substring become reusable vocabulary for later bytes.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that the decompressor is building the same output stream the compressor has already seen. If the compressor says distance 3, length 6 after emitting abc, the decompressor can look three bytes back in its own output and copy abcabc. No external memory is needed because the output buffer is the dictionary. The reference is valid only because it points into already reconstructed bytes.`,
        `This also explains the surprising power of overlapping copies. Suppose the output contains a single a and the next token says distance 1, length 5. The decoder copies from one byte behind the cursor. After it writes the second a, that new byte is also behind the cursor, so the copy can continue. One literal plus one back-reference can describe a long run. LZ77 compression is therefore not just phrase reuse; it is a controlled program for copying from history.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `An encoder repeatedly chooses between a literal and a length-distance pair. At the current input position it searches the history window for prefixes that match the lookahead. If no useful match exists, it emits the next byte as a literal and advances one byte. If a match is worth its token cost, it emits the match length and distance, then advances by that length. The decoder follows the same stream deterministically: append literals, copy references, repeat.`,
        `The simple description hides the main data-structure problem: match finding. A naive encoder could compare the lookahead against every position in the window. That is correct but too slow for large windows. Practical encoders use hash tables from short prefixes to recent positions, hash chains for older candidates with the same prefix, binary trees, rolling hashes, suffix-array-like indexes, or limited search budgets. The chosen structure controls the tradeoff between compression ratio and CPU time.`,
        `Token design is part of the mechanism too. A format must say how literals, lengths, distances, blocks, end markers, and optional dictionaries are encoded. Short matches may be rejected because the length-distance token costs more than the literal bytes it replaces. Very long matches may be split because the format has a maximum length field. The compressor is constantly comparing savings against token overhead, not merely asking whether a repeated string exists.`,
      ],
    },
    {
      heading: 'Why it works and what it costs',
      paragraphs: [
        `Correctness rests on one invariant: every back-reference names bytes that the decoder has already produced or is producing through a legal overlapping copy. If the stream obeys that rule, decoding is unambiguous. A literal appends one byte. A reference copies exactly length bytes from exactly distance bytes behind the current cursor. Since the decoder performs the same appends the encoder assumed, both sides keep the same history after every token.`,
        `Decoding is usually linear in the size of the output, with bounded memory for the sliding window plus output buffers chosen by the implementation. Encoding cost depends on match search. A fast LZ4-style encoder may inspect only a few candidates and favor speed. A slower high-ratio encoder may spend more time searching, try lazy matching, or choose a shorter current match because it unlocks a longer next match. Window size is also a cost knob: larger windows find older repeats but require larger distance codes and more memory.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `LZ77 is useful when repetition is local. Text, source code, logs, markup, serialized objects, executable files, and many prefiltered media streams contain repeated substrings close enough to fit in a practical window. The method is also streaming-friendly. An encoder can process bytes from left to right, and a decoder can start reconstructing output before seeing the whole file, as long as references never point into the future.`,
        `Many familiar compressors use this idea as one layer. DEFLATE combines LZ77-style length-distance tokens with Huffman coding. Zstandard, Brotli, and LZ4 use related match-token designs with different search strategies, entropy coders, dictionaries, and speed policies. The division of labor matters: LZ77 removes repeated strings, then an entropy coder gives shorter bit patterns to common literal, length, and distance values. Compression improves because structure is handled before probability coding.`,
        `A practical compression pipeline often prepares data before LZ77 sees it. Image filters may turn neighboring pixels into small residuals. Columnar encoders may group similar values. Log systems may normalize timestamps or common prefixes. These steps do not replace LZ77; they make repetition easier for it to see inside the window. Good compression is usually a stack of transformations whose output is friendlier to the next stage.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `LZ77 cannot create repetition where none exists. Encrypted data, already-compressed data, cryptographic hashes, and random-looking bytes often expand because the stream pays token overhead without finding useful matches. The method is also limited by locality. If a phrase appears again after it has fallen out of the window, a plain LZ77 encoder cannot reference it. External dictionaries and larger windows help only when the format and memory budget allow them.`,
        `There are engineering failure modes too. Aggressive search can burn CPU for tiny ratio gains. Weak search can miss obvious matches. Bad block boundaries can prevent references across useful spans. Decompression must defend against malformed references, output-size bombs, and distance-length combinations that are legal but expensive to copy. In production, useful signals include compression ratio, encode throughput, decode throughput, window memory, candidate probes per byte, and the share of bytes covered by back-references.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study sliding windows first, because the window is the memory model that makes the dictionary implicit. Then study hash tables and rolling hashes, because they explain how encoders find candidate matches without scanning the whole history. Suffix arrays and suffix automata show the high-ratio end of substring search, even when production compressors use cheaper approximations. Huffman coding, arithmetic coding, and ANS explain the second stage that turns LZ77 tokens into compact bits.`,
        `Good primary references are Ziv and Lempel's 1977 paper "A Universal Algorithm for Sequential Data Compression" and RFC 1951 for DEFLATE. After that, compare LZ4, DEFLATE, Brotli, and Zstandard as design points. Ask which part each format optimizes: search depth, token layout, entropy model, dictionary support, decompression speed, or operating profile. That comparison turns LZ77 from a single algorithm into a family of compression systems.`,
      ],
    },
  ],
};
