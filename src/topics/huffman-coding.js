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
      heading: 'Why this exists',
      paragraphs: [
        `Compression starts with a blunt observation: real symbol streams are usually uneven. In English text, spaces and common letters appear much more often than z or q. In image residuals, small values may dominate. In a token stream produced by another compressor, some length and distance codes may appear constantly while others are rare. Fixed-width coding ignores that skew.`,
        `Huffman coding exists to spend bits where they buy information. Frequent symbols get short codes. Rare symbols get longer codes. The result is still a normal binary stream that can be decoded from left to right without separators. That last condition is the constraint that makes the problem interesting: saving bits is easy if the decoder is allowed to guess where one code ends. Huffman saves bits while preserving a precise boundary rule.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first approach is a fixed-width code. If there are eight symbols, use three bits per symbol. If there are 256 byte values, use eight bits. It is simple, random-access friendly, and often good enough when frequencies are close to uniform. No code table is needed if the alphabet is already agreed on.`,
        `The next idea is to assign shorter codes to common symbols by hand. Give the most common symbol 0, the next one 10, another one 11, and so on. That works only if no complete code is the prefix of another complete code. If A is 0 and B is 01, the bitstream 01 is ambiguous. The decoder cannot know whether it has already seen A or should keep reading for B.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is decodability under variable-length codes. A compressed stream is just bits. It does not carry commas between symbols. The code must be designed so the decoder can walk through the stream and know exactly when a symbol has ended. Without that property, a clever frequency table becomes an unusable format.`,
        `A prefix-free code solves the boundary problem. No codeword is allowed to be the start of another codeword. A binary tree gives this property for free when symbols live only at leaves. Moving left can mean 0 and moving right can mean 1. The decoder starts at the root, consumes bits until it reaches a leaf, emits that symbol, then returns to the root for the next one.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Huffman coding turns the optimal prefix-code problem into a greedy tree-building loop. Start with one leaf per symbol, weighted by frequency. Repeatedly merge the two lightest trees under a new parent whose weight is their sum. When one tree remains, the path from root to each leaf is the code for that symbol.`,
        `The direction of the loop is the mental shift. Huffman does not start by placing the most common symbol at the root. It starts by deciding which rare symbols should be deepest. The two least frequent items can safely become siblings at the bottom of an optimal tree. After merging them, their parent behaves like a single symbol with combined weight. The same argument repeats until the whole tree is built.`,
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        `Count symbol frequencies first. Put each symbol into a priority queue keyed by frequency. Pop the two smallest entries, create an internal node with those entries as children, and push that parent back with weight equal to the two child weights. Continue until the queue has one root. Assign 0 to one child edge and 1 to the other edge on every internal node, then record each leaf path as a code.`,
        `Encoding is table lookup after the tree exists. For each input symbol, append its code bits. Decoding is tree traversal. Start at the root, follow the next bit left or right, and emit the symbol when a leaf is reached. The decoder does not need a length field for each symbol because reaching a leaf is the length field.`,
      ],
    },
    {
      heading: 'Why the greedy choice works',
      paragraphs: [
        `A short proof sketch is enough for the working idea. In any optimal prefix tree, the deepest leaves can be chosen to hold the two least frequent symbols. If a more frequent symbol were deeper than a less frequent one, swapping their labels would not increase cost and would usually reduce it. The rarest symbols therefore belong at the greatest depth, and as siblings they share the same parent cost.`,
        `After those two rarest symbols are made siblings, the rest of the problem is the same problem on a smaller alphabet. Replace them with one combined pseudo-symbol whose frequency is their sum. An optimal tree for the smaller problem expands that pseudo-symbol back into the two siblings. This gives the induction behind the greedy loop: one safe merge reduces the problem, and repeated safe merges build an optimal whole-bit prefix code for the measured frequencies.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The first frame proves that compression begins with a model, not with bit tricks. The frequency table is the model. If the counts are flat, there is little for Huffman to exploit. If the counts are skewed, the tree can move common symbols closer to the root and push rare ones deeper.`,
        `The merge frames prove the greedy invariant. Only the two lightest roots are compared and merged at each step. The final tree proves prefix-freedom: every symbol is a leaf, so no symbol path can pass through another symbol. The last bill proves the economic result by charging frequency times code length and comparing that total with fixed-width coding.`,
      ],
    },
    {
      heading: 'Cost and implementation',
      paragraphs: [
        `For n distinct symbols, building the tree with a binary heap costs O(n log n). Each of the n leaves enters the heap once, and each merge performs two removes and one insert. Assigning codes is O(n), because each leaf receives one path. Encoding m input symbols is O(m) table lookup after construction. Decoding is O(number of compressed bits) if it walks the tree, or faster in practice with lookup tables.`,
        `The hidden cost is metadata. The decoder needs the same codebook as the encoder. For a tiny message, storing the tree or code lengths can erase the savings. Real formats often use canonical Huffman codes: the format transmits code lengths, then both sides reconstruct a deterministic code assignment. Canonical codes are smaller to describe and easier to decode with tables.`,
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        `Huffman wins when frequencies are known or cheaply estimated, the distribution is skewed, and fast decoding matters. It is a good final stage after another transform has exposed repeated events. LZ77 turns repeated strings into common length-distance tokens. Image transforms create common residual patterns. Huffman then gives those common events cheaper names.`,
        `It fails when the stream has little skew, when the codebook overhead dominates, or when the distribution changes faster than the model can adapt. It is also optimal only among whole-bit prefix codes for a fixed frequency table. Arithmetic coding and ANS can get closer to the entropy limit because they can spend fractional average bits per symbol. Huffman is still worth learning because it is the cleanest meeting point of greedy algorithms, trees, heaps, and compression economics.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Heap for the priority queue, Trie for prefix decoding, and Entropy and Information for the lower bound on average code length. Then study Arithmetic and ANS Coding for fractional-bit coders, LZ77 Compression for dictionary modeling, and the DEFLATE Case Study for a real format that combines LZ77 with Huffman coding. The main lesson transfers beyond compression: a good representation spends cheap structure on common cases and expensive structure on rare ones.`,
      ],
    },
  ],
};
