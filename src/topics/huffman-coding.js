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
    explanation: `"${text}" has ${text.length} characters over ${symbols.length} distinct symbols. Stored naively at 8 bits each: ${text.length * 8} bits. But the frequencies are lopsided — '${show(symbols[0][0])}' appears ${symbols[0][1]} times${symbols.length > 1 ? `, while '${show(symbols[symbols.length - 1][0])}' appears ${symbols[symbols.length - 1][1]}` : ''}. Huffman's 1952 insight: spend FEW bits on frequent symbols, many on rare ones — and there's a greedy recipe that does it optimally.`,
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
    explanation: `Read the codes off the tree: left = 0, right = 1, each leaf's path is its code (shown under each symbol). Because every symbol is a LEAF, no code can be the beginning of another — a PREFIX-FREE code (the same property a Trie path has), so the compressed bitstream needs no separators to decode.`,
  };

  const totalBits = [...freq.entries()].reduce((sum, [ch, n]) => sum + n * codes.get(ch).length, 0);
  const fixedBits = text.length * Math.ceil(Math.log2(symbols.length));
  yield {
    state: snapshot(),
    highlight: { found: leafIds },
    explanation: `The bill: ${[...codes.entries()].sort((x, y) => x[1].length - y[1].length).slice(0, 3).map(([ch, c]) => `'${show(ch)}'→${c}`).join(', ')}… Total: ${totalBits} bits versus ${text.length * 8} for plain 8-bit bytes (or ${fixedBits} for the best fixed-width code)${totalBits < fixedBits ? ' — frequency-aware beats fixed-width whenever frequencies are lopsided' : ' — with UNIFORM frequencies the tree comes out balanced and Huffman ties fixed-width: no skew, no savings'}. This exact construction runs inside ZIP/gzip (DEFLATE), PNG, JPEG, and HTTP/2 header compression. Greedy, optimal, and built from a heap and a tree you already know.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Huffman Coding is a greedy compression algorithm for building an optimal prefix-free binary code for known symbol frequencies. Prefix-free means no symbol's code is the beginning of another symbol's code, so a decoder can read the bitstream without separators. David Huffman invented the method in 1952. The visualization counts characters in inputs such as "beekeepers see bees" and shows why frequent symbols deserve short codes while rare symbols can afford longer ones.`,
        `The goal is not magic compression; it is better average code length. Fixed-width coding spends the same number of bits on every symbol. Huffman spends bits according to frequency, approaching the lower bound explained by Entropy & Information when probabilities are skewed. With uniform frequencies, the tree becomes balanced and Huffman mostly ties fixed-width coding, aside from file-format overhead.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Count symbol frequencies, then put every symbol into a forest as a one-node tree. Repeatedly extract the two lightest roots, merge them under a new parent whose weight is their sum, and put that parent back. A Binary Heap (Priority Queue) is the usual way to perform those repeated minimum extractions efficiently. The demo highlights the two lightest trees at each merge, then shows the parent weight that returns to the forest.`,
        `Once one tree remains, assign 0 to left edges and 1 to right edges. Each leaf's path becomes that symbol's code. Because symbols live only at leaves, the code is prefix-free. This resembles a Trie (Prefix Tree) used in reverse: a trie stores existing strings by shared prefixes; Huffman builds the prefix tree that minimizes weighted path length. Tree Traversals then extract the final code table.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `For n distinct symbols, heap-based construction costs O(n log n). Assigning codes is O(n). Encoding m input symbols is O(m) after the table is built. Decoding is O(number of compressed bits) by walking the tree, or faster with lookup tables used in production decoders. The tree itself needs O(n) space. Big-O Growth Rates explains why the heap matters: repeated sorting can drift toward O(n^2 log n), while priority-queue extraction keeps the merge loop clean.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `DEFLATE, used by ZIP, gzip, and PNG, combines LZ77 back-references with Huffman codes. Baseline JPEG commonly uses Huffman tables for quantized frequency coefficients, though arithmetic coding variants exist. HTTP/2 HPACK includes a static Huffman code for headers. Compression systems often pair Huffman with earlier modeling steps: Tokenization (BPE) changes the symbols, while Huffman changes the bit lengths assigned to those symbols.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Huffman is optimal only within the class of prefix-free codes with whole-bit codewords for the given frequencies. Arithmetic and range coding can beat it by using fractional-bit averages, especially on very skewed distributions. Another trap is ignoring the cost of storing or agreeing on the code table; small inputs can grow after headers are included. Finally, deterministic tie-breaking matters for reproducible files. If two symbols have equal counts, different valid trees can produce different bit patterns with the same compressed length.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Heap (Priority Queue) for the merge loop, Trie (Prefix Tree) for prefix-free decoding, and Tree Traversals for extracting the code table. Entropy & Information gives the theoretical compression floor. Tokenization (BPE) shows another greedy merge idea used before neural models see text. Hash Table is useful for frequency counting, and Big-O Growth Rates explains why the data structure choice inside the loop changes performance.`,
      ],
    },
  ],
};
