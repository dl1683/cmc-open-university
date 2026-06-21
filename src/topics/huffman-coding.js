// Huffman coding: give frequent symbols short codes and rare symbols long
// ones — built greedily by always merging the two rarest trees. The
// compression idea inside ZIP, PNG, JPEG, and HTTP.

import { graphState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'huffman-coding',
  title: 'Huffman Coding',
  category: 'Concepts',
  summary: 'Build the optimal prefix code by always merging the two rarest symbols — compression from a greedy loop.',
  controls: [
    { id: 'text', label: 'Compress', type: 'select', options: ['beekeepers see bees', 'mississippi', 'abcd abcd (uniform)'], defaultValue: 'beekeepers see bees' },
  ],
  run,
};

export function* run(input) {
  const text = String(input.text).replace(' (uniform)', '');
  if (text.length < 4 || text.length > 24) throw new InputError('Pick one of the listed texts.');

  // 1. frequencies
  const freq = new Map();
  for (const ch of text) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const symbols = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const show = (ch) => (ch === ' ' ? '␣' : ch);

  yield {
    state: arrayState(symbols.map(([ch, n]) => `${show(ch)}:${n}`)),
    highlight: { active: ['i0'] },
    explanation: `"${text}" has ${text.length} characters over ${symbols.length} distinct symbols. Stored naively at 8 bits each: ${text.length * 8} bits. But the frequencies are lopsided — '${show(symbols[0][0])}' appears ${symbols[0][1]} times${symbols.length > 1 ? `, while '${show(symbols[symbols.length - 1][0])}' appears ${symbols[symbols.length - 1][1]}` : ''}. Huffman\'s 1952 insight: spend FEW bits on frequent symbols, many on rare ones — and there\'s a greedy recipe that does it optimally.`,
  };

  // 2. build the tree by merging the two lightest roots
  let counter = 0;
  let forest = symbols.map(([ch, n]) => ({
    id: `s${counter++}`, char: ch, freq: n, left: null, right: null,
  }));

  const snapshot = () => {
    const nodes = [];
    const edges = [];
    let cursor = 0;
    const heightOf = (node) => (node.left ? 1 + Math.max(heightOf(node.left), heightOf(node.right)) : 0);
    for (const root of forest) {
      (function place(node) {
        let x;
        if (!node.left) {
          x = cursor++;
        } else {
          const xs = [place(node.left), place(node.right)];
          x = (xs[0] + xs[1]) / 2;
        }
        nodes.push({
          id: node.id,
          label: node.char !== undefined && node.char !== null ? `${show(node.char)}:${node.freq}` : String(node.freq),
          x: x * 1.45 + 0.8,
          y: 8.6 - heightOf(node) * 2.0,
          note: node.code ?? '',
        });
        if (node.left) {
          edges.push({ id: `e${node.left.id}`, from: node.id, to: node.left.id });
          edges.push({ id: `e${node.right.id}`, from: node.id, to: node.right.id });
        }
        return x;
      })(root);
    }
    return graphState({ nodes, edges });
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Each symbol starts as its own tiny tree, weighted by its count. The loop (normally served by a Binary Heap (Priority Queue)): take the TWO LIGHTEST trees, merge them under a new parent whose weight is their sum, repeat until one tree remains. Rare symbols get merged early — so they sink DEEP, where codes are long. Frequent ones stay near the top.`,
  };

  while (forest.length > 1) {
    forest.sort((a, b) => a.freq - b.freq);
    const [a, b] = forest;
    yield {
      state: snapshot(),
      highlight: { compare: [a.id, b.id] },
      explanation: `The two lightest roots: ${a.char != null ? `'${show(a.char)}'` : 'subtree'} (${a.freq}) and ${b.char != null ? `'${show(b.char)}'` : 'subtree'} (${b.freq}). Merge them.`,
      invariant: 'Always merging the two minimum weights is provably optimal — no other prefix code beats the result.',
    };
    const parent = { id: `m${counter++}`, char: null, freq: a.freq + b.freq, left: a, right: b };
    forest = [parent, ...forest.slice(2)];
    yield {
      state: snapshot(),
      highlight: { active: [parent.id] },
      explanation: `New internal node of weight ${parent.freq}. ${forest.length} tree${forest.length === 1 ? '' : 's'} remain${forest.length === 1 ? 's — done.' : '.'}`,
    };
  }

  // 3. assign codes
  const root = forest[0];
  const codes = new Map();
  (function assign(node, code) {
    if (!node.left) {
      node.code = code || '0';
      codes.set(node.char, node.code);
      return;
    }
    assign(node.left, code + '0');
    assign(node.right, code + '1');
  })(root, '');

  const leafIds = [];
  (function leaves(n) { if (!n.left) leafIds.push(n.id); else { leaves(n.left); leaves(n.right); } })(root);
  yield {
    state: snapshot(),
    highlight: { found: leafIds },
    explanation: `Read the codes off the tree: left = 0, right = 1, each leaf\'s path is its code (shown under each symbol). Because every symbol is a LEAF, no code can be the beginning of another — a PREFIX-FREE code (the same property a Trie path has), so the compressed bitstream needs no separators to decode.`,
  };

  const totalBits = [...freq.entries()].reduce((sum, [ch, n]) => sum + n * codes.get(ch).length, 0);
  const fixedBits = text.length * Math.ceil(Math.log2(symbols.length));
  yield {
    state: snapshot(),
    highlight: { found: leafIds },
    explanation: `The bill: ${[...codes.entries()].sort((x, y) => x[1].length - y[1].length).slice(0, 3).map(([ch, c]) => `'${show(ch)}'â†’${c}`).join(', ')}… Total: ${totalBits} bits versus ${text.length * 8} for plain 8-bit bytes (or ${fixedBits} for the best fixed-width code)${totalBits < fixedBits ? ' — frequency-aware beats fixed-width whenever frequencies are lopsided' : ' — with UNIFORM frequencies the tree comes out balanced and Huffman ties fixed-width: no skew, no savings'}. This exact construction runs inside ZIP/gzip (DEFLATE), PNG, JPEG, and HTTP/2 header compression. Greedy, optimal, and built from a heap and a tree you already know.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows three phases: a frequency table, a tree construction, and the final code assignment.',
        {type: 'callout', text: 'Huffman coding turns frequency skew into tree depth: common symbols stay near the root, rare symbols pay longer paths.'},
        'In the frequency table, each symbol is labeled with its count. The animation then enters the merge loop. At each step, the two lightest nodes are highlighted as the compare pair. They merge under a new internal node whose weight is their sum. The new parent appears highlighted as active.',
        'After the last merge, the single remaining tree is the Huffman tree. Leaves are marked as found. Each leaf carries a binary code: the path from root to that leaf, where left = 0 and right = 1. Because every symbol sits at a leaf, no code is a prefix of another, so the decoder can walk the bitstream without separators.',
        'Watch which symbols sink deep (rare ones get long codes) and which stay near the root (frequent ones get short codes). The final step compares total Huffman bits against fixed-width bits to show the savings.',
      
        {type: 'image', src: './assets/gifs/huffman-coding.gif', alt: 'Animated walkthrough of the huffman coding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'David Huffman invented this algorithm in 1952 as an MIT term paper. Robert Fano, his professor, had offered students a choice: take the final exam, or find an optimal prefix-free binary code. Fano and Shannon had both tried top-down frequency splitting and failed to prove optimality. Huffman nearly gave up, then realized the problem inverts: start from the bottom, merge the two rarest symbols, and induct upward. His greedy algorithm was provably optimal, beating his professor\'s own method.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/HuffmanCodeAlg.png/500px-HuffmanCodeAlg.png', alt: 'Stepwise construction of a Huffman tree from weighted symbols', caption: 'The merge sequence shows the greedy invariant: the two lightest roots combine first, then re-enter the forest as one weighted subtree. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:HuffmanCodeAlg.png'},
        'The problem Huffman solved is the foundation of data compression. Real symbol streams are lopsided: in English, \'e\' appears roughly 100 times more often than \'z\', yet ASCII gives both 8 bits. Compression means spending fewer bits on common symbols and more on rare ones. The hard constraint is that the compressed stream must still be decodable left to right, with no separators between symbols. A code with that property is called prefix-free. Huffman coding produces the optimal prefix-free code for any given frequency distribution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Fixed-length coding is the natural starting point. ASCII uses 8 bits per character. If the alphabet has n symbols, each one gets ceil(log2(n)) bits. The encoder writes fixed-size chunks; the decoder reads them. No ambiguity, no metadata, no thought.',
        'For "ABRACADABRA" (11 characters, 5 distinct symbols), fixed-length needs ceil(log2(5)) = 3 bits per character: 11 x 3 = 33 bits.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed-length codes waste bits on common characters. In "ABRACADABRA," A appears 5 times and both C and D appear once, yet all three get 3 bits. A smarter code would give A a short code and C a longer one. The total shrinks because the cheap code gets multiplied by the large count.',
        'Variable-length coding is the obvious upgrade, but it creates a decoding trap. If A = 0 and B = 01, the bitstream "001" could be "AAB" (0, 0, 01) or "AB" (0, 01) with a stray bit. Without separators or a structural rule, the stream is ambiguous. The code must be designed so the decoder knows exactly when each symbol ends. That property is called prefix-free: no codeword is the beginning of another codeword.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: count the frequency of each symbol in the input.',
        'Step 2: create a leaf node for each symbol, weighted by its frequency. Insert all leaves into a min-heap (priority queue) keyed by weight.',
        'Step 3: the merge loop. Extract the two lightest nodes from the heap. Create a new internal node with those two as children, weighted by their sum. Insert the parent back into the heap. Repeat until one node remains. That node is the root of the Huffman tree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Huffman_coding_example.svg/500px-Huffman_coding_example.svg.png', alt: 'Small Huffman code tree with probabilities and binary labels', caption: 'A Huffman tree is a prefix-code trie: leaf depth becomes code length, and branch labels become bits. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Huffman_coding_example.svg'},
        'Step 4: assign codes. Walk the tree. At every internal node, going left appends 0, going right appends 1. Each leaf\'s accumulated path is its code.',
        'Step 5: encode. For each input symbol, emit its code bits. Decode: start at the root, consume bits to walk left or right, emit the leaf\'s symbol when reached, return to the root.',
        'The prefix-free property falls out of the tree structure. Every symbol is a leaf. No path to one leaf passes through another leaf. So no code can be the start of a longer code, and the decoder never faces ambiguity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The greedy choice is provably optimal by an exchange argument. In any optimal prefix tree, the two least frequent symbols can be placed as siblings at the greatest depth. If a more frequent symbol sat deeper than a less frequent one, swapping them would not increase total cost (and usually decreases it). So the two rarest symbols belong at maximum depth, sharing a parent.',
        'After merging those two into a single pseudo-symbol with combined frequency, the remaining problem is the same problem on a smaller alphabet. An optimal tree for the reduced alphabet, with the pseudo-symbol expanded back into its two children, is optimal for the original alphabet. This gives the induction: one safe merge reduces the problem by one symbol, and repeated safe merges build the optimal whole-bit prefix code.',
        'Shannon entropy is the theoretical lower bound. Shannon proved in 1948 that no lossless code can average fewer than H = -Sum(p_i * log2(p_i)) bits per symbol, where p_i is each symbol\'s probability. Huffman is guaranteed to come within 1 bit/symbol of this bound. The gap comes from rounding: each symbol must get a whole number of bits. A symbol whose ideal cost is 1.74 bits gets assigned 1 or 2.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building the tree costs O(n log n) for n distinct symbols. Each of the n-1 merges performs two heap extractions and one insertion, each O(log n). Assigning codes is a single O(n) tree walk.',
        'Encoding m input characters is O(m) table lookup. Decoding is O(total output bits) as tree traversal, or faster in practice with multi-bit lookup tables.',
        'The compressed output size is Sum(freq_i x codelen_i) bits. This approaches the Shannon entropy H = -Sum(p_i x log2(p_i)) bits per symbol. For 1,000 symbols with a skewed distribution, Huffman might average 2.3 bits/symbol where fixed-width needs 8. Double the input length and the savings double; the per-symbol cost stays the same because it depends only on the frequency distribution, not the message length.',
        'The hidden cost is metadata. The decoder needs the same codebook. For tiny messages, storing the tree can erase savings. Real formats use canonical Huffman codes: transmit only the code lengths (not the tree), then both sides reconstruct a deterministic assignment. Canonical codes are compact to describe and fast to decode with lookup tables.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'gzip/DEFLATE (RFC 1951) pairs LZ77 dictionary compression with Huffman coding. LZ77 replaces repeated strings with (length, distance) tokens. Huffman then assigns variable-length codes to those tokens. DEFLATE builds two Huffman trees per block: one for literals and lengths, one for distances. This combination powers gzip, zlib, ZIP, and PNG.',
        'JPEG transforms 8x8 pixel blocks with the DCT, quantizes the coefficients, then Huffman-codes the results. After quantization, most coefficients are zero or small, producing exactly the skewed distribution Huffman exploits.',
        'Fax machines (ITU T.4) use a fixed Huffman table tuned to the run-length statistics of black and white scanned pages. Long white runs are overwhelmingly common, so they get very short codes.',
        'HTTP/2 HPACK header compression uses a fixed Huffman table tuned to HTTP header byte frequencies. Header values like "text/html" and "gzip" compress to roughly 5 bits per byte instead of 8.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Two-pass requirement. Huffman needs the full frequency table before encoding starts. That means either scanning the input twice (count, then encode) or transmitting the tree alongside the data. Adaptive Huffman (Vitter\'s algorithm) updates the tree as symbols arrive, avoiding the two-pass problem, but adds bookkeeping at every symbol.',
        'Whole-bit rounding. Each symbol must receive a whole number of bits. A symbol with probability 0.3 ideally costs -log2(0.3) = 1.74 bits, but Huffman assigns 1 or 2. Arithmetic coding and ANS (Asymmetric Numeral Systems) remove this constraint by encoding the entire message as one number, reaching costs arbitrarily close to entropy. Modern compressors like zstd and LZMA use ANS instead of Huffman for exactly this reason.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Arithmetic_coding_visualisation.svg/500px-Arithmetic_coding_visualisation.svg.png', alt: 'Arithmetic coding interval narrowing for example messages', caption: 'Arithmetic coding removes the whole-bit-per-symbol constraint by narrowing one interval for the whole message. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Arithmetic_coding_visualisation.svg'},
        'No inter-symbol correlation. Huffman codes each symbol independently. It cannot exploit the fact that \'u\' almost always follows \'q\' in English, or that pixel values are correlated with their neighbors. Dictionary methods (LZ77, LZ78) and context-based models handle that. Real compressors combine both: LZ77 finds repeated patterns, then Huffman or ANS codes the residual symbols.',
        'Short messages. The codebook overhead can exceed the savings. If the message has fewer symbols than the alphabet, fixed-width wins.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: "ABRACADABRA" (11 characters).',
        'Frequency table: A:5, B:2, R:2, C:1, D:1.',
        'Step 1: the two lightest are C(1) and D(1). Merge into CD(2). Forest: B(2), R(2), CD(2), A(5).',
        'Step 2: the two lightest are B(2) and R(2). Merge into BR(4). Forest: CD(2), BR(4), A(5).',
        'Step 3: the two lightest are CD(2) and BR(4). Merge into CDBR(6). Forest: A(5), CDBR(6).',
        'Step 4: merge the last two. A(5) + CDBR(6) = root(11). One tree remains.',
        'Assign codes (left = 0, right = 1): A = 0 (1 bit). The right subtree splits: CD = 10, BR = 11. C = 100, D = 101, B = 110, R = 111.',
        'Verify prefix-free: A = 0 cannot start any other code (all others begin with 1). C = 100 and D = 101 differ at bit 3. B = 110 and R = 111 differ at bit 3. No code is a prefix of another.',
        'Encode "ABRACADABRA": 0 | 110 | 111 | 0 | 100 | 0 | 101 | 0 | 110 | 111 | 0 = 23 bits.',
        'Fixed-width comparison: 5 symbols need ceil(log2(5)) = 3 bits each. 11 x 3 = 33 bits. Huffman saves 30%.',
        'The dominant saving: A appears 5 times and gets a 1-bit code instead of 3 bits, saving 10 bits by itself.',
        'Shannon entropy: H = -(5/11)log2(5/11) - (2/11)log2(2/11) - (2/11)log2(2/11) - (1/11)log2(1/11) - (1/11)log2(1/11) = about 2.04 bits/symbol. Huffman average: 23/11 = 2.09 bits/symbol. That is within 0.05 bits of the entropy floor.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Huffman 1952, "A Method for the Construction of Minimum-Redundancy Codes," Proceedings of the IRE. The original paper, written as a term paper for Fano\'s MIT information theory class.',
        'Shannon 1948, "A Mathematical Theory of Communication," Bell System Technical Journal. Proves entropy as the lower bound for lossless compression.',
        'Prerequisites: Binary Heap -- the min-heap drives the merge loop, giving O(n log n) construction. Trie -- the Huffman tree is a binary trie; prefix lookup during decoding is the same mechanism. Greedy Algorithms -- Huffman is the textbook example of the greedy exchange argument.',
        'Extensions: Entropy -- understanding Shannon entropy explains why some inputs compress and others do not. Arithmetic Coding and ANS -- remove the whole-bit rounding constraint, getting closer to the entropy bound. LZ77 -- dictionary compression that handles inter-symbol correlations; real formats like DEFLATE combine LZ77 with Huffman.',
      ],
    },
  ],
};
