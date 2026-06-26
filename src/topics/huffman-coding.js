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
    { heading: 'How to read the animation', paragraphs: [
        'The animation starts with symbol counts, then repeatedly merges the two lightest nodes, then assigns binary codes from the final tree. A symbol is one distinct input value, and its frequency is how often it appears. Active nodes are the pair being merged; found leaves are symbols with finished codes.',
        {type: 'callout', text: 'Huffman coding turns frequency skew into tree depth: common symbols stay near the root, rare symbols pay longer paths.'},
        'The safe rule is that every symbol is a leaf, so no complete code can be the prefix of another complete code. Read the final bit count as frequency multiplied by code length, not as a visual afterthought.',
      
        {type: 'image', src: './assets/gifs/huffman-coding.gif', alt: 'Animated walkthrough of the huffman coding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    { heading: 'Why this exists', paragraphs: [
        'Lossless compression stores a message in fewer bits while recovering the exact original. Real messages are skewed: some symbols occur many times and others rarely occur. A fixed-width code wastes bits by charging every symbol the same price.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/HuffmanCodeAlg.png/500px-HuffmanCodeAlg.png', alt: 'Stepwise construction of a Huffman tree from weighted symbols', caption: 'The merge sequence shows the greedy invariant: the two lightest roots combine first, then re-enter the forest as one weighted subtree. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:HuffmanCodeAlg.png'},
        'Huffman coding, published in 1952, finds the optimal prefix-free binary code for known frequencies. Prefix-free means no codeword starts another codeword, so a decoder can read the stream from left to right without separators.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is fixed-length coding. If a message has n distinct symbols, give each symbol ceil(log2(n)) bits. Decoding is simple because the reader consumes equal-size chunks.',
        'For ABRACADABRA, the alphabet is A, B, R, C, D, so n = 5 and each symbol needs 3 bits. Eleven characters cost 11 * 3 = 33 bits before metadata.',
      ], },
    { heading: 'The wall', paragraphs: [
        'Fixed-width coding ignores frequency. A appears 5 times in ABRACADABRA, while C and D appear once each, but all three pay 3 bits. The count that should save space is unused.',
        'Naive variable-length codes can be ambiguous. If A = 0 and B = 01, the bits 001 do not tell the decoder where the first symbol ends. A compression code needs short common words without creating boundary ambiguity.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Put symbols at leaves of a binary tree. The path to a leaf is the code, with left as 0 and right as 1. Since leaves never sit inside other leaf paths, the code is automatically prefix-free.',
        'The optimal tree puts rare symbols deeper and common symbols shallower. Huffman gets there bottom-up: merge the two rarest available roots, then treat that parent as one combined symbol. Repeating this safe local move builds the optimal whole-bit prefix code.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Count symbol frequencies and create one leaf per symbol. Insert the leaves into a min-heap, a priority queue that removes the smallest weight first. The heap stores the current forest of partial trees.',
        'Remove the two lightest roots, create a parent with weight equal to their sum, and insert that parent back into the heap. Continue until one root remains. Walking left and right from that root assigns every code.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Huffman_coding_example.svg/500px-Huffman_coding_example.svg.png', alt: 'Small Huffman code tree with probabilities and binary labels', caption: 'A Huffman tree is a prefix-code trie: leaf depth becomes code length, and branch labels become bits. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Huffman_coding_example.svg'},
      ], },
    { heading: 'Why it works', paragraphs: [
        'The proof is an exchange argument. In an optimal prefix tree, the two least frequent symbols can be placed as deepest siblings; if a more frequent symbol were deeper, swapping it upward would not increase total cost. That makes the first merge safe.',
        'After merging the two rarest symbols, their parent is a pseudo-symbol with combined frequency. An optimal tree for the smaller problem expands back into an optimal tree for the original problem. Induction turns the repeated local merge into a global optimum.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'For n distinct symbols, building the tree costs O(n log n) because n - 1 merges each perform heap operations. Encoding m symbols is O(m) after the table exists. Space is O(n) for the tree and code table.',
        'The output cost is sum(freq_i * codeLength_i). If a symbol appears 1,000,000 times, saving one bit on that symbol saves 1,000,000 output bits. Doubling the message length with the same distribution doubles total bits, but the average bits per symbol stays stable.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'DEFLATE, used by gzip, zlib, ZIP, and PNG, combines LZ77 dictionary tokens with Huffman coding. LZ77 creates skewed token frequencies, and Huffman prices the common tokens cheaply.',
        'JPEG uses Huffman coding after transform and quantization because many coefficients become zero or small. Fax coding and HTTP/2 HPACK use tuned Huffman tables for the same reason: the symbol distribution is not uniform.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Huffman needs the frequency table before encoding, or it must transmit a codebook. For tiny inputs, that metadata can erase the savings. Adaptive variants avoid a separate count pass but add update work at every symbol.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Arithmetic_coding_visualisation.svg/500px-Arithmetic_coding_visualisation.svg.png', alt: 'Arithmetic coding interval narrowing for example messages', caption: 'Arithmetic coding removes the whole-bit-per-symbol constraint by narrowing one interval for the whole message. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Arithmetic_coding_visualisation.svg'},
        'Whole-bit code lengths limit compression. A symbol with ideal cost 1.74 bits must receive either 1 or 2 bits. Arithmetic coding and ANS reduce this rounding loss, while dictionary methods handle repeated patterns that single-symbol Huffman cannot see.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'For ABRACADABRA, frequencies are A:5, B:2, R:2, C:1, D:1. Merge C(1) and D(1) into CD(2), then B(2) and R(2) into BR(4), then CD(2) with BR(4), then A(5) with the combined subtree.',
        'One valid code is A = 0, C = 100, D = 101, B = 110, R = 111. The encoded message uses 5*1 + 1*3 + 1*3 + 2*3 + 2*3 = 23 bits. Fixed-width coding used 33 bits, so Huffman saves 10 bits, about 30%.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources are Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952, and Shannon, A Mathematical Theory of Communication, 1948. Huffman gives the construction; Shannon gives entropy as the lower bound.',
        'Study binary heaps for the merge loop, tries for prefix decoding, and greedy algorithms for the proof pattern. Study entropy, arithmetic coding, ANS, and LZ77 next to place Huffman inside modern compression systems.',
      ], },
  ],
};
