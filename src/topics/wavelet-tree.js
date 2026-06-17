// Wavelet tree: recursively split an alphabet and store bitvectors for rank,
// select, access, and range queries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'wavelet-tree',
  title: 'Wavelet Tree',
  category: 'Data Structures',
  summary: 'A succinct sequence index: split symbols by alphabet ranges, store bitvectors, and answer rank/select/access by walking levels.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rank walk', 'range quantile'], defaultValue: 'rank walk' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function wtGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'a n n b a n a', x: 4.8, y: 1.0, note: 'alphabet {a,b,n}' },
      { id: 'bits0', label: '0 1 1 0 0 1 0', x: 4.8, y: 2.2, note: '0={a,b}, 1={n}' },
      { id: 'left', label: 'a b a a', x: 2.4, y: 4.0, note: '{a,b}' },
      { id: 'right', label: 'n n n', x: 7.2, y: 4.0, note: '{n}' },
      { id: 'bits1', label: '0 1 0 0', x: 2.4, y: 5.2, note: '0=a, 1=b' },
      { id: 'a', label: 'a a a', x: 1.2, y: 7.0, note: 'leaf a' },
      { id: 'b', label: 'b', x: 3.6, y: 7.0, note: 'leaf b' },
      { id: 'n', label: 'n n n', x: 7.2, y: 7.0, note: 'leaf n' },
    ],
    edges: [
      { id: 'e-root-bits', from: 'root', to: 'bits0', weight: 'store bits' },
      { id: 'e-bits-left', from: 'bits0', to: 'left', weight: '0s' },
      { id: 'e-bits-right', from: 'bits0', to: 'right', weight: '1s' },
      { id: 'e-left-bits', from: 'left', to: 'bits1', weight: 'store bits' },
      { id: 'e-bits-a', from: 'bits1', to: 'a', weight: '0s' },
      { id: 'e-bits-b', from: 'bits1', to: 'b', weight: '1s' },
      { id: 'e-right-n', from: 'right', to: 'n', weight: 'only n' },
    ],
  }, { title });
}

function* rankWalk() {
  yield {
    state: wtGraph('Wavelet tree for sequence annbana'),
    highlight: { active: ['root', 'bits0'], found: ['a', 'b', 'n'] },
    explanation: 'A wavelet tree recursively splits the alphabet. At each internal node, a bitvector says whether each symbol goes left or right. The child sequence is the stable subsequence for that side.',
  };

  yield {
    state: labelMatrix(
      'rank(a, 6) over annbana',
      [
        { id: 'root', label: 'root prefix 0..6' },
        { id: 'zeros', label: 'count left bits' },
        { id: 'left', label: 'left prefix length' },
        { id: 'leaf', label: 'leaf a count' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'result', label: 'result' },
      ],
      [
        ['read first 6 bits: 0 1 1 0 0 1', 'three 0s'],
        ['rank0(rootBits, 6)', '3'],
        ['move to left node with length 3', 'a b a'],
        ['rank0(leftBits, 3)', '2'],
      ],
    ),
    highlight: { active: ['root:result', 'leaf:result'], compare: ['left:result'] },
    explanation: 'To count a symbols in the first six positions, walk toward the a leaf. At each level, rank maps the prefix length into the corresponding child prefix length.',
    invariant: 'Stable partitioning preserves relative order inside every child sequence.',
  };

  yield {
    state: wtGraph('Access follows the bit at each level'),
    highlight: { active: ['root', 'bits0', 'left', 'bits1', 'b'], compare: ['a', 'n'] },
    explanation: 'access(i) also walks levels. Read the bit at position i. Rank tells the child position for that symbol. Continue until a leaf reveals the stored character.',
  };

  yield {
    state: labelMatrix(
      'Wavelet-tree operations',
      [
        { id: 'access', label: 'access(i)' },
        { id: 'rank', label: 'rank(c,i)' },
        { id: 'select', label: 'select(c,k)' },
        { id: 'range', label: 'range queries' },
      ],
      [
        { id: 'walk', label: 'walk shape' },
        { id: 'cost', label: 'typical cost' },
      ],
      [
        ['root to leaf', 'O(log sigma)'],
        ['root to c leaf', 'O(log sigma)'],
        ['leaf to root', 'O(log sigma)'],
        ['split interval by bits', 'O(log sigma) plus output'],
      ],
    ),
    highlight: { found: ['rank:cost', 'select:cost'], active: ['range:walk'] },
    explanation: 'The operation vocabulary is small: rank, select, and access. But those primitives power compressed text indexes, range quantiles, document retrieval, and FM-index Occ queries.',
  };
}

function* rangeQuantile() {
  yield {
    state: labelMatrix(
      'Find 2nd smallest in range [1,6) of annbana',
      [
        { id: 'range', label: 'range symbols' },
        { id: 'root', label: 'root split' },
        { id: 'left', label: 'left side' },
        { id: 'right', label: 'right side' },
      ],
      [
        { id: 'content', label: 'content' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['n n b a n', 'sorted: a b n n n'],
        ['left count 2, right count 3', 'k=2 stays left'],
        ['a b', '2nd is b'],
        ['n n n', 'skipped'],
      ],
    ),
    highlight: { active: ['root:decision', 'left:decision'], found: ['left:content'] },
    explanation: 'Range quantile descends by counting how many selected positions go left. If k fits in the left count, descend left; otherwise subtract left count and descend right.',
  };

  yield {
    state: wtGraph('Intervals are remapped by rank at each level'),
    highlight: { active: ['bits0', 'left', 'bits1'], compare: ['right'] },
    explanation: 'A range [l, r) in a parent becomes a child range using rank0 or rank1 at l and r. The query never materializes the subsequence; it carries interval boundaries through bitvectors.',
  };

  yield {
    state: labelMatrix(
      'Applications',
      [
        { id: 'fm', label: 'FM-index Occ' },
        { id: 'quantile', label: 'range quantile' },
        { id: 'topk', label: 'range top-k' },
        { id: 'docs', label: 'document retrieval' },
      ],
      [
        { id: 'query', label: 'query' },
        { id: 'whyWavelet', label: 'why wavelet tree fits' },
      ],
      [
        ['rank(c,i)', 'compact multi-symbol rank'],
        ['k-th smallest in range', 'branch by counts'],
        ['frequent symbols in range', 'recursive pruning'],
        ['which docs contain pattern', 'compressed posting structure'],
      ],
    ),
    highlight: { found: ['fm:whyWavelet', 'quantile:whyWavelet'], compare: ['docs:query'] },
    explanation: 'Wavelet trees are valuable because they turn a sequence into a hierarchy of bitvectors. That makes many sequence queries become short rank/select walks.',
  };

  yield {
    state: labelMatrix(
      'Design choices',
      [
        { id: 'balanced', label: 'balanced alphabet split' },
        { id: 'huffman', label: 'Huffman-shaped tree' },
        { id: 'matrix', label: 'wavelet matrix' },
        { id: 'bitvector', label: 'rank/select bitvectors' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['predictable height', 'ignores frequencies'],
        ['short codes for common symbols', 'shape complexity'],
        ['large alphabet practical', 'layout differs'],
        ['constant-time rank/select support', 'extra samples'],
      ],
    ),
    highlight: { active: ['bitvector:benefit', 'matrix:benefit'], compare: ['huffman:tradeoff'] },
    explanation: 'The clean concept is recursive partitioning. Practical implementations refine the shape and bitvector layout to fit alphabets, caches, and compressed-space targets.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rank walk') yield* rankWalk();
  else if (view === 'range quantile') yield* rangeQuantile();
  else throw new InputError('Pick a Wavelet Tree view.');
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Many sequence queries ask about symbols, not just positions. How many a values occur before index i? Where is the kth n? What is the second-smallest value in this range? Which documents appear in the interval produced by a text index?`,
        `A plain array can answer access(i), but rank, select, range counts, and range quantiles require scans or extra indexes. A wavelet tree exists to answer these symbol-aware queries exactly while storing the sequence close to its information content.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The first reasonable choice is the sequence itself. access(i) is constant time, and everything else can be found by scanning. That is fine for small strings and rare queries.`,
        `The second choice is a prefix-count table for every symbol. rank(c, i) becomes a table lookup. The cost is O(n sigma) space for length n and alphabet size sigma. That is too large for long texts, document arrays, or integer sequences with many distinct values.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is answering symbol-specific questions without materializing a separate structure for every symbol. The index has to narrow a position range and a value range at the same time.`,
        `It also has to preserve order. rank and select aren't just set-membership questions. They depend on how many matching symbols appear before a position, so the structure must keep enough ordering information while it compresses the sequence.`,
      ],
    },
    {
      heading: `Core layout`,
      paragraphs: [
        `Recursively split the alphabet. At each internal node, write one bit per symbol in that node's sequence: 0 if the symbol goes to the left alphabet half, 1 if it goes to the right half. The left child stores the stable subsequence of 0-routed symbols. The right child stores the stable subsequence of 1-routed symbols.`,
        `The invariant is stable partitioning. A child sequence keeps the relative order its symbols had in the parent. rank0 and rank1 on the node bitvector map a parent prefix or range into the corresponding child prefix or range.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `To build a balanced wavelet tree, split the alphabet into lower and upper halves, emit the routing bitvector for the current sequence, then recurse on the two stable subsequences. Leaves correspond to individual symbols.`,
        `rank(c, i) walks from the root to c's leaf. At each node, it chooses the side containing c and remaps i using rank0 or rank1 on the node bitvector. When the walk reaches the leaf, the current prefix length is the number of c symbols before i.`,
        `access(i) follows the bit at position i downward. The bit reveals which child contains the symbol, and rank maps i into the child position. select(c, k) runs the reverse path: start at c's leaf and use select operations while walking back to the root.`,
      ],
    },
    {
      heading: `Concrete examples`,
      paragraphs: [
        `For sequence annbana, count rank(a, 6). The root bitvector separates n from the other symbols. The first six positions contain three symbols that route left. The left child sequence for those three routed positions is a b a. Counting a there gives 2.`,
        `For a range quantile, carry an interval [l, r) instead of a single prefix. Count how many positions in the interval route left. If k fits inside that count, descend left. Otherwise subtract the left count and descend right. The query never materializes the range; it only remaps boundaries through bitvectors.`,
        `For document retrieval, a suffix-array interval can be treated as a range over document ids. A wavelet tree can report which document ids occur in that interval, count how often each appears, or find heavy documents without scanning every suffix. This is where the structure stops being a classroom index and becomes a compact analytics tool over search results.`,
      ],
    },
    {
      heading: `Why it is correct`,
      paragraphs: [
        `The bitvector at a node records the exact routing decision for every symbol in that node's sequence. Because the child subsequences are stable, the kth routed symbol in the parent is the kth symbol in the child.`,
        `rank on the bitvector computes exactly how many routed symbols appear before a boundary. That is why prefix lengths and interval boundaries can be moved to children without losing order. Following the path for one symbol filters away all other symbols while preserving the occurrence order of that symbol.`,
        `Range quantile uses the same invariant. The left-count tells how many values in the query range belong to the lower alphabet half. If k is within that count, the answer must be in the left half. If not, exactly that many smaller values are skipped and the search continues on the right.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `With a balanced tree, access, rank, and select take O(log sigma) rank or select steps for alphabet size sigma. Range quantile also takes O(log sigma). Range reporting and top-k queries add output-dependent work.`,
        `Space is roughly one bit per sequence element per tree level, plus rank/select support. A balanced tree stores about n log sigma routing bits. Huffman-shaped trees can shorten paths for common symbols. Compressed bitvectors can reduce space when routing bits are biased. Wavelet matrices use a level-by-level layout that is often simpler and faster for large integer alphabets.`,
        `The hidden dependency is the bitvector engine. Without fast rank and select, a wavelet tree turns into a slow recursive scan. With good rank/select support, the structure becomes a compact sequence index rather than just a clever layout.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Wavelet trees win in compressed full-text indexes, especially as the Occ structure inside an FM-index. They also fit document retrieval, range quantile queries, range counting, inverted-index compression, graph representations, XML indexes, and analytics over compact categorical sequences.`,
        `The common access pattern is exact navigation over a static or mostly static sequence. The structure avoids dense per-symbol prefix tables while still answering symbol-aware queries without scanning the original range.`,
        `They are especially useful when the alphabet is not tiny and the query mix is richer than lookup. If all you need is access(i), an array is better. If all you need is membership, a set is better. The wavelet tree earns its complexity when rank, select, quantile, and range counting are all part of the workload.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `A wavelet tree isn't signal-processing wavelets in ordinary use. It is a rank/select sequence index. The name is historical enough to confuse readers, so judge it by the operations it supports.`,
        `Updates are hard because one sequence change can affect routing bits across levels. Pointer-heavy implementations can hurt cache behavior. Very small alphabets may be served well by a few plain bitvectors. Workloads that mostly append, mutate, or scan short ranges may not earn back the implementation cost.`,
        `Another failure is ignoring construction choices. A balanced tree is simple, but a skewed alphabet may want a Huffman shape. Large integer alphabets may want a wavelet matrix. Compressed bitvectors save space only when their access cost still fits the workload. The idea is stable partitioning; the engineering choice is which layout makes that idea fast on the actual data.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Rank/Select Bitvector first if the bitvector mapping feels mysterious. Study FM-Index & Burrows-Wheeler Transform to see wavelet trees used for Occ queries. Study Suffix Array & LCP, Huffman Coding, Inverted Index, and Range Minimum Query for neighboring sequence-index ideas.`,
        `Primary and survey sources: Grossi, Gupta, and Vitter, High-Order Entropy-Compressed Text Indexes, at https://www.ittc.ku.edu/~jsv/Papers/FGGV06.TextindexingExperimentsJournal.pdf, and Navarro, Wavelet Trees for All, at https://users.dcc.uchile.cl/~gnavarro/ps/cpm12.pdf.`,
      ],
    },
  ],
};
