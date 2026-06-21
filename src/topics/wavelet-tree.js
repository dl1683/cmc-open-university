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
        'The rank-walk view traces a single rank query from root to leaf. Active (highlighted) nodes are the ones the query is currently visiting. The bitvector at each node shows how symbols are routed: 0 sends a symbol left, 1 sends it right. Watch how the prefix length shrinks at each level -- rank on the bitvector remaps the boundary into the child sequence.',
        {type: 'callout', text: 'A wavelet tree stores routing bits, not duplicate subsequences; rank turns each parent prefix into the exact child prefix needed by the query.'},
        'The range-quantile view carries an interval instead of a single prefix. At each node, the interval splits by counting how many positions route left versus right. The decision to descend left or right depends on whether the target rank fits inside the left count.',
        'Found markers show the final answer once the walk reaches a leaf. Compare markers show sibling paths that the query skipped. At every frame, ask: what information did the bitvector just provide, and why does stable partitioning make that information correct?',
      
        {type: 'image', src: './assets/gifs/wavelet-tree.gif', alt: 'Animated walkthrough of the wavelet tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many queries over sequences care about symbols, not just positions. How many times does character c appear before index i? Where is the kth occurrence of c? What is the median value in positions 40 through 90? A plain array answers access(i) in constant time, but rank, select, and range-quantile queries force a scan.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows connecting nodes', caption: 'A wavelet tree is a navigation graph over symbols: each edge represents one recorded routing decision through a bitvector. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        {
          type: 'quote',
          text: 'The wavelet tree is one of the most versatile succinct data structures, supporting a wealth of operations in compact space.',
          attribution: 'Gonzalo Navarro, "Wavelet Trees for All", 2012',
        },
        'A wavelet tree answers all of these queries in O(log sigma) time for an alphabet of size sigma, while storing the sequence in roughly n log sigma bits -- close to the information-theoretic minimum. It exists because succinct data structures demand that you answer rich queries without paying rich space. The wavelet tree achieves this by encoding the sequence as a hierarchy of bitvectors, one per tree level, and reducing every query to a short chain of rank and select operations on those bitvectors.',
        'The structure is central to the FM-index, where it serves as the Occ function that counts symbol occurrences in a BWT column. Without wavelet trees, compressed full-text search indexes would need per-symbol prefix tables that blow up with alphabet size.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is a prefix-count table. For every symbol c in the alphabet and every position i, store count[c][i] = number of occurrences of c in positions 0..i-1. Then rank(c, i) is a single table lookup. This works, and it is fast.',
        'The cost is O(n * sigma) space. For a DNA sequence with sigma = 4, that is tolerable. For a document array with sigma = 100,000 distinct document IDs, or a BWT over a Unicode alphabet, the table is enormous. You are storing a dense counter for every symbol even if most symbols are rare.',
        'An alternative is one bitvector per symbol, where bit i is 1 if sequence[i] = c. With rank support on each bitvector, rank(c, i) is constant time. But you need sigma separate bitvectors, each of length n, totaling n * sigma bits. The space problem remains.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the product n * sigma. Every approach that builds a separate structure per symbol pays space proportional to the full alphabet. When the alphabet is large, the structures collectively exceed the sequence itself by a wide margin.',
        'The deeper constraint is that rank, select, and access must all work together. You cannot compress away the symbol identity without losing the ability to count specific symbols, and you cannot store only counts without losing the ability to recover the original sequence. The structure must encode both position and identity in a way that lets each query recover exactly the information it needs, without materializing the rest.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Split the alphabet in half. At the root, scan the sequence and write a bitvector: 0 if the symbol belongs to the lower half, 1 if it belongs to the upper half. Route the 0-symbols into the left child sequence and the 1-symbols into the right child sequence, preserving their relative order (stable partition). Recurse on each child with its half of the alphabet. Stop when a node covers a single symbol.',
        {
          type: 'diagram',
          text: 'sequence: a n n b a n a    alphabet: {a, b, n}\n\n             [a n n b a n a]         <-- root\n              0 1 1 0 0 1 0          <-- bitvector: 0={a,b}, 1={n}\n             /             \\\n      [a b a a]           [n n n]    <-- children (stable subsequences)\n       0 1 0 0             (leaf)\n      /       \\\n   [a a a]   [b]                     <-- leaves\n   (leaf)    (leaf)',
          label: 'Balanced wavelet tree for "annbana" with alphabet {a, b, n}',
        },
        'Each internal node stores only its bitvector (with rank/select support). The child sequences are implicit -- they exist conceptually but are never stored as explicit character arrays. The total storage across all levels is n bits per level, and a balanced tree has ceiling(log2 sigma) levels, giving n * ceiling(log2 sigma) bits total.',
        {
          type: 'code',
          language: 'javascript',
          text: '// rank(c, i): count occurrences of c in sequence[0..i-1]\nfunction waveletRank(root, c, i) {\n  let node = root;\n  let pos = i;\n  while (!node.isLeaf) {\n    if (c belongs to node.leftAlphabet) {\n      // c routes left: count 0-bits before pos\n      pos = rank0(node.bitvector, pos);\n      node = node.left;\n    } else {\n      // c routes right: count 1-bits before pos\n      pos = rank1(node.bitvector, pos);\n      node = node.right;\n    }\n  }\n  return pos; // pos is now the count of c in [0..i-1]\n}',
        },
        'access(i) walks downward by reading the bit at position i. If the bit is 0, the symbol is in the left half; remap i to rank0(bitvector, i) and descend left. If the bit is 1, remap to rank1(bitvector, i) and descend right. The leaf reveals the symbol. select(c, k) runs the reverse path: start at c\'s leaf with position k, and walk upward using select0 or select1 at each parent to recover the original position.',
        'Range quantile finds the k-th smallest value in a subrange [l, r). At each node, compute leftCount = rank0(bitvector, r) - rank0(bitvector, l). If k <= leftCount, the answer is in the left half: update l and r using rank0 and descend left. Otherwise subtract leftCount from k and descend right using rank1. The query never materializes the subarray -- it carries two boundary integers through log sigma levels.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness of every wavelet tree operation rests on one invariant: stable partitioning preserves relative order. When the root routes symbols to children, the j-th 0-routed symbol in the parent becomes the j-th symbol in the left child. This means rank0(bitvector, i) gives exactly the position in the left child that corresponds to parent position i.',
        'For rank(c, i), stable partitioning guarantees that after descending through all levels, the accumulated remapping counts exactly the occurrences of c. No symbol is lost, duplicated, or reordered. The bitvector at each level is a complete record of the routing decision for every position in that node\'s subsequence.',
        'For range quantile, the invariant ensures that the left-count is the exact number of values in [l, r) that belong to the lower alphabet half. The decision to go left or right is a binary search on the value domain, guided by exact counts rather than guesses. After log sigma steps, the search has narrowed to a single symbol -- the k-th smallest.',
        {
          type: 'note',
          text: 'The connection to the FM-index: the BWT of a text is a permutation of the text. The FM-index needs rank(c, i) on the BWT column to simulate backward search. A wavelet tree over the BWT provides exactly this operation in O(log sigma) time and n * log(sigma) + o(n * log(sigma)) bits, replacing the dense Occ table that would otherwise cost O(n * sigma) space.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Wavelet tree', 'Suffix array', 'FM-index (with WT)'],
          rows: [
            ['rank(c, i)', 'O(log sigma)', 'not direct', 'O(log sigma) via WT'],
            ['select(c, k)', 'O(log sigma)', 'not direct', 'O(log sigma) via WT'],
            ['access(i)', 'O(log sigma)', 'O(1) on original', 'O(log sigma) via WT'],
            ['range quantile', 'O(log sigma)', 'O(n) scan', 'not direct'],
            ['pattern search', 'not direct', 'O(m log n)', 'O(m) backward search'],
            ['space (bits)', 'n log sigma + o(n log sigma)', 'n log n', 'n log sigma + o(n log sigma)'],
          ],
        },
        'Every core operation costs O(log sigma) time, where sigma is the alphabet size. For a byte alphabet (sigma = 256), that is 8 bitvector rank or select calls per query. For DNA (sigma = 4), it is 2. The cost per level is O(1) because rank and select on bitvectors are constant-time with standard succinct structures (popcount plus sampling).',
        'Space is n * ceiling(log2 sigma) bits for the bitvectors, plus the rank/select support structures which add o(n * log sigma) bits. A Huffman-shaped tree reduces the average path length for skewed distributions: common symbols get shorter codes, so their queries are faster and their bits dominate less. The tradeoff is that the tree shape becomes data-dependent and slightly harder to navigate.',
        'Construction takes O(n * log sigma) time: one pass per level to compute the bitvector and partition the sequence. The wavelet matrix variant lays out all bitvectors in a single flat array, level by level, which is more cache-friendly and avoids pointer overhead for large alphabets.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'FM-index Occ queries: the wavelet tree replaces a dense per-symbol count table with a compact structure that scales gracefully with alphabet size. This is the single most important application.',
            'Range quantile and range median: given a static array of integers, answer "what is the k-th smallest in positions l..r?" in O(log sigma) time without sorting the subarray.',
            'Document retrieval: given a suffix array interval, determine which documents contain the pattern, how often each appears, or which are most frequent -- all through wavelet tree range operations.',
            'Compressed representations of sequences, permutations, and grids where the alphabet is large but queries are symbolic (rank, select, range counting).',
          ],
        },
        'The common thread is a static sequence with a non-trivial alphabet where the query workload mixes rank, select, access, and range operations. The wavelet tree unifies all of these behind a single structure, avoiding the need to build and maintain separate indexes for each query type.',
        'In bioinformatics, wavelet trees index BWT-transformed genomes for compressed read alignment. In information retrieval, they power compact inverted indexes. In competitive programming, they solve range-quantile problems that would otherwise require persistent segment trees or merge-sort trees.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Updates are expensive. Inserting or deleting a symbol can change routing bits across every level of the tree. Dynamic wavelet trees exist but add significant complexity and constant factors. If the sequence changes frequently, a balanced BST or a segmented structure is usually simpler.',
        'For tiny alphabets (sigma = 2 or 4), a wavelet tree is overkill. Two or four plain bitvectors with rank/select support answer rank queries directly in O(1) time. The tree overhead adds nothing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Cache hierarchy from CPU to memory', caption: 'Pointer-heavy rank walks can lose to simpler layouts because each level may miss in cache. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        'Cache behavior can be poor in pointer-based implementations because a single rank query touches log sigma different bitvectors stored in different memory locations. The wavelet matrix layout addresses this by packing bitvectors level by level, but even then, random-access queries over large sequences cause cache misses.',
        'The name itself is a failure of communication. A wavelet tree has nothing to do with signal-processing wavelets. The name comes from a loose analogy to multiresolution decomposition, but it confuses newcomers who expect frequency-domain operations. Judge the structure by what it does: recursive alphabet partitioning with bitvector navigation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Grossi, Gupta, and Vitter, "High-Order Entropy-Compressed Text Indexes" (SODA 2003, journal version 2006) -- the original wavelet tree construction for compressed text indexing.',
            'Gonzalo Navarro, "Wavelet Trees for All" (CPM 2012) -- the definitive survey covering rank, select, range quantile, document retrieval, grids, and the wavelet matrix.',
            'Navarro and Makinen, "Compressed Full-Text Indexes" (ACM Computing Surveys, 2007) -- places wavelet trees in the broader landscape of succinct and compressed text indexes.',
          ],
        },
        'Study Rank/Select Bitvector first if rank0 and rank1 feel like black boxes -- the wavelet tree is only as fast as its bitvector engine. Study FM-Index and Burrows-Wheeler Transform to see the wavelet tree in its most important application. Study Suffix Array for the text-indexing context that motivated the structure.',
        'For extensions, study the wavelet matrix (flat layout for large alphabets), Huffman-shaped wavelet trees (entropy-compressed paths), and range trees (the geometric dual of range quantile). For neighboring succinct structures, study compressed suffix arrays and succinct tries.',
      ],
    },
  ],
};
