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
      heading: 'How to read the animation',
      paragraphs: [
        'The "sliding matches" view shows the encoder scanning input left to right. Active cells mark the current lookahead position being matched against history. Found cells mark back-references the encoder has committed to. Compare cells contrast the entropy coder stage against the match stage so you can see where each layer does its work.',
        'The "tokens and decode" view shows the output token stream and how the decoder reconstructs the original bytes. Active cells mark the current token being processed. Found cells mark the growing output buffer. Watch the output column grow: each literal appends one byte, each back-reference copies a span.',
        {
          type: 'note',
          text: 'When a back-reference has distance smaller than length, the copy overlaps with bytes being written. The decoder handles this by copying one byte at a time, so newly written bytes become available for the rest of the copy. This is not a bug -- it is how LZ77 compresses long runs from a single seed.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Data repeats itself. Source code reuses variable names. HTML repeats tags. Log files echo the same timestamp prefix thousands of times. Sending every byte verbatim wastes space proportional to the repetition. LZ77 replaces repeated spans with short pointers back to where those bytes already appeared, compressing the stream without knowing anything about its meaning.',
        {
          type: 'quote',
          text: 'We consider the problem of coding a sequence of symbols from a finite alphabet, using a universal algorithm that does not require knowledge of the statistics of the source.',
          attribution: 'Jacob Ziv and Abraham Lempel, "A Universal Algorithm for Sequential Data Compression," IEEE Transactions on Information Theory, 1977',
        },
        'The word "universal" is the key. Earlier compressors like Huffman coding need a frequency table built from the data or assumed in advance. LZ77 needs nothing. It builds its dictionary implicitly from the bytes it has already processed. The encoder and decoder share the same view of history at every point, so the dictionary never needs to be transmitted, agreed upon, or stored.',
        'Ziv and Lempel published the algorithm in 1977, and its descendants now run inside gzip, PNG, ZIP, HTTP content encoding, PDF streams, and every browser on earth. Whenever you see DEFLATE, you are looking at LZ77 tokens fed into a Huffman coder.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest compression idea is a static dictionary. Survey the data domain, pick common phrases ("the", "<div>", "ERROR"), assign each a short code, and replace every occurrence. This works for narrow domains: Morse code assigns short patterns to frequent letters, HTTP/2 uses HPACK with a preset header table, and old modem protocols used fixed dictionaries for English text.',
        'A slightly more general idea is run-length encoding (RLE). If a byte repeats N times, emit the byte once and the count. RLE handles runs like "aaaaaa" well and costs almost nothing to implement. Image formats like BMP and PCX used it for large single-color regions.',
        'Both approaches feel reasonable. Static dictionaries exploit known structure. RLE exploits simple repetition. Teams reach for them because they are easy to build, easy to debug, and fast to decode.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Static dictionaries break on coordination and coverage. The decoder must have the same dictionary. The dictionary must be transmitted or standardized. A dictionary built for English is useless for JSON. One built for JSON is useless for x86 binaries. Every new data type needs a new dictionary, and a dictionary that tries to cover everything compresses nothing well.',
        'RLE breaks on structure. Real data rarely repeats one byte at a time. The string "abcabcabc" has no single-byte runs, but it is highly compressible -- the six-byte substring "abcabc" is an exact copy of the three bytes starting at position 0. RLE cannot see multi-byte repetition. It also cannot handle repetition at a distance: if "error" appears on line 1 and again on line 400, RLE has no mechanism to reference it.',
        'The wall is the same in both cases: the compressor cannot learn from its own output. A static dictionary is frozen before compression starts. RLE has no memory at all. What is needed is a method that builds a dictionary on the fly, from the bytes it has already seen, and uses it immediately for the bytes coming next.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder maintains two regions over the input: a search buffer (history) of W bytes already encoded, and a lookahead buffer of L bytes not yet encoded. Together they form the sliding window.',
        {
          type: 'diagram',
          text: '  already encoded          next to encode\n  <-- search buffer -->    <-- lookahead -->\n  |  a  b  c  a  b  c  |  a  b  c  x  |  ...\n  |_____ W bytes _______|___ L bytes ___|',
          label: 'Sliding window: the search buffer is the implicit dictionary, the lookahead is the next input to compress',
        },
        'At each step the encoder searches the history buffer for the longest prefix of the lookahead. If it finds a match of length >= minimum match length (usually 3), it emits a back-reference token: (distance, length). Distance says how far back the match starts. Length says how many bytes to copy. If no useful match exists, it emits the next byte as a literal. Then the window slides forward by the number of bytes consumed.',
        'Match finding is the expensive part. A naive encoder compares the lookahead against every position in the history -- O(W * L) per step. Real encoders use hash tables keyed on 3-byte or 4-byte prefixes, with hash chains linking older positions that share the same prefix. DEFLATE uses this approach with a 32 KB window. Faster encoders like LZ4 use a single-probe hash table and accept shorter matches for speed.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Simplified match finder: hash 3-byte prefixes\nfunction findMatch(input, pos, hashTable, windowSize) {\n  if (pos + 2 >= input.length) return null;\n  const key = (input[pos] << 16) | (input[pos+1] << 8) | input[pos+2];\n  const candidate = hashTable.get(key);\n  hashTable.set(key, pos);\n  if (candidate === undefined || pos - candidate > windowSize) return null;\n  // extend match as far as possible\n  let len = 0;\n  while (pos + len < input.length &&\n         input[candidate + len] === input[pos + len]) len++;\n  return len >= 3 ? { distance: pos - candidate, length: len } : null;\n}',
        },
        'The Storer-Szymanski modification (1982) simplified the original LZ77 triple format. Ziv and Lempel emitted (offset, length, next-character) triples, always including the character after the match. Storer and Szymanski showed that separating literals from length-distance pairs and dropping the trailing character produces shorter output. DEFLATE and most modern formats use this separated design.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: every back-reference points into bytes the decoder has already reconstructed. The encoder knows this is true because it built those bytes. The decoder knows it is true because it has been writing the same output. Both sides maintain identical history at every token boundary, so references are always resolvable.',
        'Overlapping copies are legal and useful. When distance < length, the decoder copies byte-by-byte from the reference start, and each newly written byte extends the available source. A literal "a" followed by (distance=1, length=99) produces 100 copies of "a". This is not a special case -- it falls out of the copy-one-byte-at-a-time rule. It is why LZ77 handles long runs without any run-length encoding machinery.',
        {
          type: 'note',
          text: 'The decoder never needs random access to the entire file. It needs only the most recent W bytes of output (the window size). This makes LZ77 streaming-friendly: decompression can begin before the file is fully received, and memory usage is bounded by the window size regardless of file length.',
        },
        'Optimality is a separate question. LZ77 does not guarantee the shortest possible encoding. Greedy longest-match can miss cases where a shorter match now enables a longer match next. Lazy matching (checking whether skipping the current match yields a better one at the next position) and optimal parsing (dynamic programming over all possible tokenizations) improve ratio at the cost of encoder complexity. The decoder is identical regardless of how the encoder chose its tokens.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Space', 'What dominates'],
          rows: [
            ['Decode one token', 'O(length) for copy, O(1) for literal', 'O(W) for window buffer', 'Memory copy speed; W is typically 32 KB to 8 MB'],
            ['Decode full stream', 'O(N) where N = output size', 'O(W)', 'Linear scan, no random access needed'],
            ['Encode (hash chain)', 'O(N * chain_depth) amortized', 'O(W) + hash table', 'Chain depth is capped (e.g., 4096 in zlib level 9)'],
            ['Encode (optimal parse)', 'O(N * W) worst case', 'O(W) + DP table', 'Rarely used; ratio gain is 1-3% over lazy matching'],
          ],
        },
        'Decoding is always fast. It is a single left-to-right pass that copies bytes. No hash tables, no search, no decisions. This asymmetry -- expensive encoding, cheap decoding -- is why LZ77 formats dominate web content delivery. A server compresses once; millions of clients decompress.',
        'Window size controls both memory and reach. DEFLATE uses 32 KB. Zstandard supports up to 8 MB (or 2 GB with long-range mode). Doubling the window doubles the memory and lets the encoder find matches twice as far back, but each additional doubling has diminishing returns because most repetition is local. In practice, 32 KB catches the majority of matches in text and source code; larger windows help most with binary files and structured data where identical blocks repeat at larger intervals.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LZ77 wins wherever byte-level repetition is common and local. Text, source code, logs, markup, serialized data, and executable binaries all contain repeated substrings within practical window distances. The combination of LZ77 with an entropy coder is the backbone of the most widely deployed compression formats on earth.',
        {
          type: 'table',
          headers: ['Method', 'Family', 'Dictionary', 'Entropy coder', 'Typical use'],
          rows: [
            ['LZ77 (1977)', 'Sliding window', 'Implicit (output history)', 'None (raw tokens)', 'Foundation; not used alone'],
            ['LZ78 (1978)', 'Phrase table', 'Explicit table built during parse', 'None (index codes)', 'Historic (compress, GIF via LZW)'],
            ['Huffman (1952)', 'Statistical', 'N/A', 'Prefix-free bit codes', 'Used as LZ77 backend in DEFLATE'],
            ['Arithmetic (1976)', 'Statistical', 'N/A', 'Fractional-bit encoding', 'JPEG, CABAC in H.264/H.265'],
            ['DEFLATE (1996)', 'LZ77 + Huffman', 'Implicit, 32 KB window', 'Dynamic Huffman trees', 'gzip, ZIP, PNG, HTTP, TLS'],
            ['Zstandard (2016)', 'LZ77 + FSE/Huffman', 'Implicit + optional preset dict', 'FSE (tANS) + Huffman', 'Linux kernel, databases, CDNs'],
            ['LZ4 (2011)', 'LZ77 variant', 'Implicit, 64 KB window', 'Minimal (byte-aligned)', 'Real-time: databases, filesystems'],
            ['Snappy (2011)', 'LZ77 variant', 'Implicit, 32 KB blocks', 'None (length-prefixed)', 'RPC, log storage, low-latency paths'],
          ],
        },
        'DEFLATE is LZ77 plus Huffman, and it is everywhere: gzip compresses HTTP responses, ZIP archives use it, PNG images use it on filtered pixel rows. Zstandard uses LZ77-style matching with FSE (finite state entropy) and achieves better ratios and faster decompression than DEFLATE. LZ4 and Snappy trade ratio for speed, targeting real-time applications like database page compression and RPC payloads where decompression latency matters more than size.',
        'Preprocessing makes LZ77 stronger. PNG applies per-row pixel filters (delta, sub, average, Paeth) that turn smooth gradients into runs of small residuals. Columnar database encoders group similar values before compression. Burrows-Wheeler transforms rearrange bytes so that repeated contexts cluster together. These transformations do not replace LZ77; they reshape the data so that repetition falls within the window.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LZ77 cannot compress what does not repeat. Encrypted data, compressed data, cryptographic hashes, and high-entropy random bytes have no usable matches. The token overhead for failed match attempts can make the output larger than the input. Most formats include a "stored block" mode that passes data through uncompressed when matching yields no savings.',
        'Locality is a hard limit. If a repeated phrase falls outside the window, the encoder cannot reference it. A 32 KB window cannot catch a function signature that appeared 100 KB ago. Larger windows help but cost memory and wider distance codes. Zstandard addresses this with optional preset dictionaries for small files (where the window never fills) and long-range matching modes for large archives.',
        {
          type: 'bullets',
          items: [
            'Already-compressed input (JPEG inside ZIP): no matches found, output grows by token overhead.',
            'Small files with large alphabets: not enough history to build useful references.',
            'Adversarial inputs: crafted data can maximize encoder search time with minimal matches (hash chain worst case).',
            'Block boundaries: if the format splits input into independent blocks, references cannot cross block edges.',
            'Decompression bombs: a small compressed stream can decode to gigabytes if distance-length pairs create massive overlapping copies.',
          ],
        },
        'Engineering traps exist too. Greedy matching is fast but leaves ratio on the table. Lazy matching helps but doubles comparison work. Optimal parsing finds the best tokenization but costs O(N * W) and gains only 1-3% over lazy matching. In production, the right compression level is the one that balances CPU cost against the value of smaller output for the specific workload.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Ziv, J. and Lempel, A. "A Universal Algorithm for Sequential Data Compression." IEEE Transactions on Information Theory, vol. 23, no. 3, 1977. The original paper defining the sliding-window method.',
            'Storer, J. and Szymanski, T. "Data Compression via Textual Substitution." Journal of the ACM, vol. 29, no. 4, 1982. The modification that separated literals from length-distance pairs, used by DEFLATE and descendants.',
            'RFC 1951: DEFLATE Compressed Data Format Specification. The format used by gzip, ZIP, and PNG -- the most widely deployed LZ77 derivative.',
            'Collet, Y. "Zstandard Compression." RFC 8878, 2021. Modern LZ77 + FSE design that supersedes DEFLATE in many applications.',
            'Collet, Y. "LZ4 -- Extremely Fast Compression." 2011. Design point optimizing decompression speed over ratio.',
          ],
        },
        'Study hash tables first -- they are the data structure that makes match finding fast enough for large windows. Then study Huffman coding, because it is the entropy coder that DEFLATE pairs with LZ77 tokens. Arithmetic coding and ANS (asymmetric numeral systems) explain the newer entropy backends used by Zstandard and other modern formats. After that, compare DEFLATE, Zstandard, LZ4, and Brotli as design points: each makes different tradeoffs in search depth, token format, entropy model, dictionary support, and speed.',
      ],
    },
  ],
};

