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
  const seq = 'annbana';
  const sigma = 3;
  const queryChar = 'a';
  const queryPos = 6;
  const levels = Math.ceil(Math.log2(sigma));

  yield {
    state: wtGraph('Wavelet tree for sequence annbana'),
    highlight: { active: ['root', 'bits0'], found: ['a', 'b', 'n'] },
    explanation: `A wavelet tree recursively splits the alphabet. For the ${seq.length}-symbol sequence "${seq}" over ${sigma} distinct symbols, the tree has ${levels} internal levels. At each internal node, a bitvector says whether each symbol goes left or right. The child sequence is the stable subsequence for that side.`,
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
    explanation: `To count "${queryChar}" symbols in the first ${queryPos} positions of "${seq}", walk toward the ${queryChar} leaf. At each of the ${levels} levels, rank maps the prefix length into the corresponding child prefix length.`,
    invariant: `Stable partitioning preserves relative order inside every child sequence — the ${queryPos}-position prefix remaps cleanly through each of the ${levels} levels.`,
  };

  yield {
    state: wtGraph('Access follows the bit at each level'),
    highlight: { active: ['root', 'bits0', 'left', 'bits1', 'b'], compare: ['a', 'n'] },
    explanation: `access(i) also walks ${levels} levels for this ${sigma}-symbol alphabet. Read the bit at position i. Rank tells the child position for that symbol. Continue until a leaf reveals the stored character.`,
  };

  const opCount = 4;
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
    explanation: `All ${opCount} core operations cost O(log ${sigma}) = O(${levels}) per query on this alphabet. Rank, select, and access are the primitives that power compressed text indexes, range quantiles, document retrieval, and FM-index Occ queries.`,
  };
}

function* rangeQuantile() {
  const rangeStart = 1;
  const rangeEnd = 6;
  const k = 2;
  const rangeLen = rangeEnd - rangeStart;
  const leftCount = 2;
  const rightCount = 3;

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
    explanation: `Range quantile finds the ${k}nd smallest in positions [${rangeStart}, ${rangeEnd}) — a span of ${rangeLen} symbols. It descends by counting how many selected positions go left: here ${leftCount} go left and ${rightCount} go right. Since k=${k} fits in the left count of ${leftCount}, descend left.`,
  };

  yield {
    state: wtGraph('Intervals are remapped by rank at each level'),
    highlight: { active: ['bits0', 'left', 'bits1'], compare: ['right'] },
    explanation: `The range [${rangeStart}, ${rangeEnd}) in a parent becomes a child range using rank0 or rank1 at positions ${rangeStart} and ${rangeEnd}. The query never materializes the ${rangeLen}-element subsequence; it carries two interval boundaries through bitvectors.`,
  };

  const appCount = 4;
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
    explanation: `Wavelet trees support ${appCount} major application families because they turn a sequence into a hierarchy of bitvectors. That makes many sequence queries become short rank/select walks of O(log sigma) each.`,
  };

  const designChoices = 4;
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
    explanation: `The clean concept is recursive partitioning. These ${designChoices} design choices refine the shape and bitvector layout to fit alphabets, caches, and compressed-space targets.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the structure as a decision tree over symbols. Each node owns a bitvector: 0 means the symbol was routed to the left child, and 1 means it was routed to the right child. Active highlights show the query node, and found highlights show the final symbol or count.',
        {type: 'callout', text: 'A wavelet tree stores routing bits, not duplicate subsequences; rank turns each parent prefix into the exact child prefix needed by the query.'},
        {type: 'image', src: './assets/gifs/wavelet-tree.gif', alt: 'Animated walkthrough of the wavelet tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is rank remapping. If the first i positions at a node contain c zeros, then the left child prefix length for those same original positions is c. The tree does not guess; it counts recorded routing decisions.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many sequence queries need more than array access. rank(c, i) asks how many times symbol c appears before position i, select(c, k) asks where the kth c occurs, and range quantile asks for the kth smallest value in a subarray.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows connecting nodes', caption: 'A wavelet tree is a navigation graph over symbols: each edge represents one recorded routing decision through a bitvector. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'A wavelet tree exists to answer those questions while storing close to the information content of the sequence. It replaces many per-symbol prefix tables with a hierarchy of compact bitvectors.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a table of prefix counts for every symbol. rank(c, i) becomes one lookup, but the table costs O(n sigma) space for n positions and sigma symbols. That is fine for two symbols and terrible for large alphabets.',
        'Another approach is to store a sorted copy or tree per range. That can answer some range questions, but it duplicates data across many nodes and becomes bulky when the sequence is large.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that position and symbol are coupled. A query needs to keep track of a prefix or interval in the original sequence while descending through a different ordering of symbols. Plain arrays do not remember how positions map after symbols are partitioned.',
        'The data structure must preserve enough routing history to translate boundaries exactly. Without rank on each node bitvector, a descent would know which child to visit but not which child positions correspond to the original query prefix.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store the route taken by each symbol instead of storing full subsequences at every node. Each node splits its alphabet range into left and right halves and records one bit per current symbol. Children receive the symbols that their parent bitvector routed to them.',
        'rank is the bridge between levels. It converts a boundary in the parent sequence into the matching boundary in the child sequence by counting how many symbols before that boundary went to the child.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To build the tree, start with the whole sequence and the whole alphabet. At a node, choose a split of the alphabet, write a bitvector describing the route for each symbol, then recurse on the left and right subsequences. Leaves correspond to individual symbols.',
        'To compute rank(c, i), follow the path for c from root to leaf. At a left edge, replace i with rank0(bitvector, i). At a right edge, replace i with rank1(bitvector, i). The final i is the number of c symbols before the original boundary.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that each node sequence contains exactly the original symbols whose alphabet values fall in that node range, in their original relative order. The bitvector records which child each position enters. Rank on the bitvector therefore maps a prefix to the exact child prefix containing the same original positions.',
        'Induction over tree depth proves rank and range navigation. The root invariant is true because it contains the whole sequence. If it is true for a parent, stable routing plus rank makes it true for the chosen child. At a leaf, the remaining count is exactly the count of that symbol.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With a balanced alphabet split, rank, select, and access take O(log sigma) bitvector operations. Space is roughly n log sigma bits plus rank/select indexes. Doubling n doubles bit storage and build work, while doubling sigma adds one more level.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Cache hierarchy from CPU to memory', caption: 'Pointer-heavy rank walks can lose to simpler layouts because each level may miss in cache. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        'The hidden behavior cost is locality. A pointer-based tree can touch a different bitvector at each level. The wavelet matrix variant keeps levels flatter to reduce that memory penalty.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Wavelet trees are central in compressed full-text search, especially FM-indexes, because they implement occurrence counts over the Burrows-Wheeler Transform. They also support compact indexes for logs, genomes, inverted indexes, and static analytics arrays.',
        'They fit workloads with many reads over mostly static data. The more queries reuse the same sequence, the easier it is to repay the build cost and compact rank/select metadata.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Updates are the main failure. Inserting or deleting a symbol can change routing bits across every level and force dynamic rank support. Dynamic wavelet trees exist, but their constants and implementation complexity are high.',
        'Tiny alphabets can make the tree unnecessary. For sigma=2, one bitvector with rank/select already answers the natural queries. For small dynamic data, a simple array, Fenwick tree, or balanced tree may be easier and faster.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For the sequence [b, a, n, a, n, a] over alphabet {a,b,n}, split {a} left and {b,n} right. The root bitvector is [1,0,1,0,1,0] because a goes left and b or n goes right. rank(a, 5) asks how many a symbols appear before index 5.',
        'Follow the a edge left and compute rank0(root, 5). In the first five positions [b, a, n, a, n], there are two zeros, so the answer is 2. The query never scans the symbols directly; it counts the routing bits that prove exactly two positions reached the a leaf.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Grossi, Gupta, and Vitter on high-order entropy-compressed text indexes, and Navarro, Wavelet Trees for All, at https://users.dcc.uchile.cl/~gnavarro/ps/jda12.1.pdf. For compressed search context, study the FM-index and Burrows-Wheeler Transform.',
        'Study Rank/Select Bitvectors, Succinct Data Structures, FM-Index, Wavelet Matrix, Range Quantile, and Persistent Segment Tree next. The key prerequisite is comfort with rank as boundary translation.',
      ],
    },
  ],
};
