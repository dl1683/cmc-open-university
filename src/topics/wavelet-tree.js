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
      heading: 'What it is',
      paragraphs: [
        'A wavelet tree is a succinct index over a sequence of symbols. It recursively splits the alphabet and stores a bitvector at each internal node, recording whether each symbol goes left or right. The child sequences preserve the original relative order of symbols routed to that child.',
        'The structure supports access, rank, select, range quantiles, range counting, top-k style queries, and compressed-index operations. It is the natural companion to FM-index because FM-index Occ queries are rank queries over the BWT.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To build a balanced wavelet tree, split the alphabet into lower and upper halves. Emit 0 for symbols sent left and 1 for symbols sent right. Recurse on the left subsequence and right subsequence. Leaves correspond to symbols. The original sequence is no longer stored as plain values; it is represented by bitvectors across levels.',
        'rank(c, i) walks from root to the leaf for c. At each node, rank0 or rank1 maps the prefix length i into the child prefix length. access(i) follows the bit at position i downward. select(c, k) walks upward from the c leaf, using select on bitvectors.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With a balanced tree, operations usually cost O(log sigma), where sigma is alphabet size, assuming efficient rank/select on bitvectors. Space is close to n log sigma bits plus rank/select support, and compressed variants can approach entropy bounds by changing shape or encoding bitvectors.',
        'The bitvector primitive is crucial. Without fast rank and select, a wavelet tree is just a clever layout. With succinct bitvectors, it becomes a practical sequence index.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Wavelet trees appear in compressed full-text indexes, FM-index implementations, document retrieval, range quantile queries, inverted-index compression, graph representations, XML indexes, and analytics over compact categorical sequences.',
        'A complete case study is a compressed BWT index. The BWT is a string over an alphabet. The FM-index repeatedly asks Occ(c, i), a rank query over that string. A wavelet tree answers those rank queries without storing a dense count table for every character and every position.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A wavelet tree is not related to signal-processing wavelets in the everyday implementation sense. The name reflects a recursive decomposition, but the data-structure contract is rank/select over symbols. Another trap is ignoring alphabet size; large alphabets often need wavelet matrices or compressed shapes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and survey sources: Grossi, Gupta, and Vitter journal copy at https://www.ittc.ku.edu/~jsv/Papers/FGGV06.TextindexingExperimentsJournal.pdf and Navarro, Wavelet Trees for All, at https://users.dcc.uchile.cl/~gnavarro/ps/cpm12.pdf. Study FM-Index & Burrows-Wheeler Transform, Suffix Array & LCP, Huffman Coding, Inverted Index, and Product Quantization next.',
      ],
    },
  ],
};
