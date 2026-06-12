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
        `Huffman coding is a greedy algorithm that builds the optimal prefix-free code — a set of variable-length binary codes where no code is the start of another, so you can decode a bitstream without separators. It assigns short codes to frequent symbols and long codes to rare ones, squeezing redundancy out of data. David Huffman invented it in 1952 while a graduate student; it became the backbone of modern compression, living inside ZIP archives, PNG images, JPEG encoders, and HTTP/2 header compression (HPACK). Frequency-aware encoding beats fixed-width codes whenever symbols appear with uneven probability.`,
        `The core insight: if symbol 'e' appears in 40% of English text and 'z' in 0.1%, why use 8 bits for both? Huffman fixes this by building a tree where the path from root to leaf defines each symbol's code. Frequent symbols end up shallow (short codes), rare ones deep (long codes). The algorithm is optimal among all prefix-free codes — no other method can produce a shorter average code length for the same input, a fact provable through exchange arguments.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with frequency counts. "beekeepers" gives 'e' a count of 4, 'k' a count of 2, 'b' a count of 1, and so on. Each symbol becomes a leaf node in a forest, weighted by its frequency. The algorithm then enters a loop: extract the two lightest trees (normally via a Binary Heap (Priority Queue)), merge them under a new parent whose weight is their sum, and repeat until a single tree remains. Rare symbols get merged early — they sink deep. Frequent ones stay high. The greedy choice to always merge minimums guarantees optimality.`,
        `Once the tree is built, assign codes by traversing from root to leaf: left branches are 0, right branches are 1. A symbol's code is the sequence of bits along its path. Because every symbol is a leaf, no code can be a prefix of another — the prefix-free property means the decoder never has to ask 'is my reading done yet?' In a string like "beekeepers", 'e' might get code "01", 'b' might get "1010", and every bit in the compressed stream belongs unambiguously to exactly one symbol, just like following a path down a Trie (Prefix Tree).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Building the tree costs O(n log n) time, where n is the number of distinct symbols. Assigning codes costs O(n) traversals. Encoding the text costs O(m) per symbol, where m is the text length — one table lookup per character. Decoding costs O(m × h), where h is the tree height, since you descend the tree one bit at a time. In the worst case (a skewed tree), h can reach O(n), but typical cases give h ≈ log n. Storage cost for the tree itself is O(n) nodes. The compressed bitstring is O(total bits), which is always smaller than O(m × 8) when frequencies are lopsided; with uniform frequencies, Huffman matches fixed-width codes and saves nothing.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `DEFLATE (ZIP, gzip, gzip compression over HTTP) is the workhorse. PNG images use Huffman coding on filtered pixel data. JPEG applies it to quantized DCT coefficients. HTTP/2 header compression (HPACK) uses a static Huffman table for common header values. When you download a .zip file or a .png, Huffman's greedy loop is running in the decompressor right now. Modern uses favor arithmetic coding (which can pack tighter) or range coding, but Huffman remains standard because it is fast, simple, and good enough — and the tree structure ties naturally to hardware decoders.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Huffman only works on static frequency distributions. If symbols change distribution mid-stream (like switching from English to JSON), you must send a new tree header or use adaptive methods. Many people assume "greedy = fast but suboptimal," but Huffman is a rare exception — greedy IS optimal for prefix codes. Another trap: confusing Huffman with arithmetic or range coding; the latter can save 1–5% more bits because they bypass the discrete bit boundary, but Huffman's simplicity makes it preferred in real systems. Finally, uniform frequencies are the worst case — if every symbol appears the same number of times, Huffman produces a balanced tree identical to fixed-width coding, yielding zero compression. The algorithm is a perfect match to skewed, real-world data.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To deepen your understanding, learn how a Binary Heap (Priority Queue) accelerates the merge loop from O(n²) to O(n log n). Study Trie (Prefix Tree) to see the relationship between tree structure and prefix-free codes — Huffman builds codes that follow the same branching discipline. Walk through Tree Traversals to understand how to extract codes from leaves. Explore Tokenization (BPE) to see a modern relative: Byte-Pair Encoding builds codes greedily by merging, just like Huffman, but for variable-length symbols instead of fixed characters. And study Big-O Growth Rates to understand why log n trees beat linear ones — that difference is why Huffman with a heap beats naive repeated sorting.`,
      ],
    },
  ],
};

