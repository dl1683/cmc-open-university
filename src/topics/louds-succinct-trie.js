// LOUDS succinct trie: encode tree topology level-by-level as unary degrees,
// then navigate with rank/select and compact label arrays instead of pointers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'louds-succinct-trie',
  title: 'LOUDS Succinct Trie',
  category: 'Data Structures',
  summary: 'A compact trie layout: store level-order unary degree bits plus labels, then use rank/select to navigate children without pointer-heavy nodes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['encode topology', 'navigate labels'], defaultValue: 'encode topology' },
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

function* encodeTopology() {
  yield {
    state: graphState({
      nodes: [
        { id: 'trie', label: 'trie', x: 0.8, y: 4.0, note: 'nodes' },
        { id: 'level', label: 'level order', x: 2.7, y: 4.0, note: 'BFS' },
        { id: 'degree', label: 'degrees', x: 4.6, y: 4.0, note: 'unary' },
        { id: 'bits', label: 'bits', x: 6.5, y: 4.0, note: '11010...' },
        { id: 'rank', label: 'rank/select', x: 8.4, y: 4.0, note: 'navigate' },
      ],
      edges: [
        { id: 'e-trie-level', from: 'trie', to: 'level' },
        { id: 'e-level-degree', from: 'level', to: 'degree' },
        { id: 'e-degree-bits', from: 'degree', to: 'bits' },
        { id: 'e-bits-rank', from: 'bits', to: 'rank' },
      ],
    }, { title: 'LOUDS turns tree shape into a navigable bitvector' }),
    highlight: { active: ['level', 'degree', 'bits'], found: ['rank'] },
    explanation: 'LOUDS means level-order unary degree sequence. Visit nodes breadth-first; for each node, write one 1 bit per child, then a 0. Rank/select makes those bits behave like tree pointers.',
    invariant: 'The topology is static bits plus small navigation directories, not object pointers.',
  };

  yield {
    state: labelMatrix(
      'Unary degree encoding',
      [
        { id: 'root', label: 'root' },
        { id: 'a', label: 'node a' },
        { id: 'b', label: 'node b' },
        { id: 'c', label: 'node c' },
      ],
      [
        { id: 'children', label: 'children' },
        { id: 'code', label: 'LOUDS code' },
      ],
      [
        ['2', '110'],
        ['1', '10'],
        ['0', '0'],
        ['2', '110'],
      ],
    ),
    highlight: { active: ['root:code', 'a:code', 'c:code'], compare: ['b:code'] },
    explanation: 'A node with two children contributes 110. A leaf contributes 0. Concatenating these codes in level order gives a bitstring from which child ranges can be recovered.',
  };

  yield {
    state: labelMatrix(
      'Compact trie arrays',
      [
        { id: 'louds', label: 'LOUDS bits' },
        { id: 'labels', label: 'edge labels' },
        { id: 'terminal', label: 'terminal bits' },
        { id: 'values', label: 'values' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'queryUse', label: 'query use' },
      ],
      [
        ['tree topology', 'parent/child'],
        ['bytes or chars', 'match path'],
        ['word ends?', 'membership'],
        ['optional payload', 'map lookup'],
      ],
    ),
    highlight: { found: ['louds:queryUse', 'labels:queryUse'], active: ['terminal:stores'] },
    explanation: 'A LOUDS trie usually stores topology separately from labels. The bitvector says where children are; the label array says which edge byte each child represents.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'keys stored', min: 0, max: 100 }, y: { label: 'pointer overhead', min: 0, max: 100 } },
      series: [
        { id: 'pointer', label: 'pointer trie', points: [{ x: 5, y: 28 }, { x: 50, y: 72 }, { x: 100, y: 96 }] },
        { id: 'louds', label: 'LOUDS trie', points: [{ x: 5, y: 14 }, { x: 50, y: 22 }, { x: 100, y: 30 }] },
      ],
    }),
    highlight: { found: ['louds'], compare: ['pointer'] },
    explanation: 'The chart is conceptual. LOUDS matters when pointer overhead dominates: dictionaries, autocomplete tables, static key maps, and range filters with millions or billions of nodes.',
  };
}

function* navigateLabels() {
  yield {
    state: labelMatrix(
      'Lookup cat',
      [
        { id: 'root', label: 'root' },
        { id: 'c', label: 'edge c' },
        { id: 'a', label: 'edge a' },
        { id: 't', label: 'edge t' },
        { id: 'done', label: 'terminal' },
      ],
      [
        { id: 'childRange', label: 'child range' },
        { id: 'labelSearch', label: 'label search' },
      ],
      [
        ['rank/select range', 'find c'],
        ['rank/select range', 'find a'],
        ['rank/select range', 'find t'],
        ['no children', 'stop'],
        ['terminal bit', 'key exists'],
      ],
    ),
    highlight: { active: ['root:childRange', 'c:labelSearch', 'a:labelSearch', 't:labelSearch'], found: ['done:labelSearch'] },
    explanation: 'To follow a key, compute the current node child range from LOUDS bits, search labels inside that range, then move to the selected child node.',
    invariant: 'Trie lookup is still prefix navigation; only the representation changed.',
  };

  yield {
    state: labelMatrix(
      'Navigation operations',
      [
        { id: 'firstChild', label: 'first child' },
        { id: 'nextSibling', label: 'next sibling' },
        { id: 'parent', label: 'parent' },
        { id: 'degree', label: 'degree' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'cost', label: 'typical cost' },
      ],
      [
        ['select/rank', 'constant-ish'],
        ['next 1 in range', 'local'],
        ['rank/select inverse', 'constant-ish'],
        ['child run length', 'local'],
      ],
    ),
    highlight: { found: ['firstChild:uses', 'parent:uses'], compare: ['degree:cost'] },
    explanation: 'Different LOUDS variants expose different formulas, but the pattern is stable: rank counts earlier structure, select jumps to the k-th structural marker.',
  };

  yield {
    state: labelMatrix(
      'Dense top, sparse bottom',
      [
        { id: 'upper', label: 'upper trie' },
        { id: 'lower', label: 'lower trie' },
        { id: 'suffix', label: 'suffix bits' },
        { id: 'payload', label: 'payloads' },
      ],
      [
        { id: 'layout', label: 'layout' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['fast bitmap', 'hot levels'],
        ['LOUDS sparse', 'many nodes'],
        ['optional', 'false positives'],
        ['separate array', 'values'],
      ],
    ),
    highlight: { active: ['upper:reason', 'lower:reason'], found: ['suffix:layout'] },
    explanation: 'Fast Succinct Trie designs often split the trie: upper levels get a faster layout because every lookup touches them; lower levels get a denser layout because they contain most nodes.',
  };

  yield {
    state: labelMatrix(
      'When LOUDS is a fit',
      [
        { id: 'staticDict', label: 'static dictionary' },
        { id: 'autocomplete', label: 'autocomplete' },
        { id: 'rangeFilter', label: 'range filter' },
        { id: 'hotWrites', label: 'frequent writes' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'compact keys'],
        ['strong', 'prefix path'],
        ['strong', 'ordered trie'],
        ['weak', 'static bits'],
      ],
    ),
    highlight: { found: ['staticDict:fit', 'autocomplete:fit', 'rangeFilter:fit'], compare: ['hotWrites:reason'] },
    explanation: 'LOUDS is best for static or snapshot-built structures. If nodes are inserted and deleted constantly, pointer tries or dynamic trees are often simpler.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'encode topology') yield* encodeTopology();
  else if (view === 'navigate labels') yield* navigateLabels();
  else throw new InputError('Pick a LOUDS view.');
}

export const article = {
  sections: [
    {
      heading: `Why This Exists`,
      paragraphs: [
        `A trie is a natural structure for strings because every lookup follows the key one symbol at a time. The problem is representation cost. At large scale, a normal pointer trie can spend more memory on node objects, child maps, empty child slots, and pointers than on the characters being indexed.`,
        `LOUDS, the level-order unary degree sequence, exists for static or snapshot-built tries where memory locality matters. It keeps the trie idea but replaces pointer topology with a bitvector that rank/select can navigate.`,
      ],
    },
    {
      heading: `Naive Baseline`,
      paragraphs: [
        `The baseline is an ordinary Trie. Each node stores a map from outgoing character to child node, plus a terminal marker and maybe a payload. This is easy to implement, easy to mutate, and easy to explain.`,
        `The cost appears when the dictionary is large. Many nodes have only one or two children, but each still carries object overhead. If children are stored in arrays, sparse alphabets waste slots. If children are stored in maps, each lookup pays hash or tree overhead inside every trie level.`,
      ],
    },
    {
      heading: `The Wall`,
      paragraphs: [
        `The wall is navigation. Compressing the tree shape into bits is not enough; lookup still needs to find a node's first child, scan or search that node's labels, move to the selected child, and know whether the path is terminal.`,
        `A compact trie must therefore answer pointer-like questions without pointers. The representation has to recover child ranges, parents, siblings, degrees, and terminal status from arrays, and it must do that fast enough that the memory savings are not lost to arithmetic overhead.`,
      ],
    },
    {
      heading: `Core Insight`,
      paragraphs: [
        `Visit nodes in breadth-first order. For each node, write one 1 bit for each child and then write a 0 to end that node's run. A node with two children contributes 110. A leaf contributes 0. Concatenating those runs gives the LOUDS bitvector.`,
        `The invariant is alignment. The 1 bits correspond to child entries in level order, and the label array is stored in the same child-entry order. Rank counts how many structural entries came before a position; select jumps to the boundary for a node. Together they recover the child range that a pointer trie would store explicitly.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the "encode topology" view, follow the pipeline from trie nodes to level order, degrees, LOUDS bits, and rank/select support. The unary degree table is the key frame: root with two children becomes 110, a one-child node becomes 10, and a leaf becomes 0.`,
        `In the "navigate labels" view, read lookup as two synchronized operations. The LOUDS bits produce the current child range; the label array decides which child edge matches the next key symbol. The "Lookup cat" frame is the concrete path: root finds c, c finds a, a finds t, and the terminal bit confirms the key.`,
      ],
    },
    {
      heading: `Mechanics`,
      paragraphs: [
        `A LOUDS trie usually stores several parallel arrays. The LOUDS bitvector stores topology. The label array stores the byte or character for each child edge. A terminal bitvector marks nodes that complete keys. A value array stores payloads for map-like uses.`,
        `Lookup begins at the root. For the current node, rank/select formulas compute the contiguous range of child entries. The code searches labels in that range for the next input symbol. If no label matches, the key is absent. If a label matches, the child entry maps to the next node number, and lookup consumes the symbol.`,
        `Implementations vary in their exact formulas and indexing conventions. The stable idea is that node numbers, child entries, LOUDS runs, labels, and terminal bits are all ordered consistently, so simple arithmetic replaces object references.`,
      ],
    },
    {
      heading: `Correctness`,
      paragraphs: [
        `The encoding is lossless for ordered rooted trees. Each node contributes exactly one terminating 0, so the 0 bits identify node boundaries in breadth-first order. Each child contributes exactly one 1 before its parent's terminating 0, so the run length before that 0 is the node's degree.`,
        `Because breadth-first order lists all children in the same order they become later nodes, the child entries form the next layer of the traversal. Rank/select does not guess the topology; it counts and jumps among the markers created by the encoding. If the label array is aligned with the child entries, following matching labels reconstructs the same path a pointer trie would follow.`,
      ],
    },
    {
      heading: `Cost and Tradeoffs`,
      paragraphs: [
        `The topology costs one 0 per node and one 1 per edge, which is about 2n bits for a tree with n nodes, plus rank/select support. Labels, terminal bits, and values are separate. Compared with a pointer trie, this removes most per-node object overhead and improves locality by keeping data in arrays.`,
        `The tradeoff is that every traversal step performs rank/select arithmetic and searches a child label range. Small child ranges can be scanned. Larger ranges may need sorted labels, binary search, bitmaps, or split layouts. Updates are expensive because inserting a node can shift later LOUDS bits and labels.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Suppose the breadth-first node order starts with a root that has children c and d, then node c has child a, node d is a leaf, and node a has child t. The degree sequence is 2, 1, 0, 1, 0. The LOUDS code is 110 10 0 10 0.`,
        `To look up cat, start at the root's child range. The labels aligned with the two 1 bits might be c and d, so c selects the first child. That child has one outgoing label a, so the path continues. The a node has one outgoing label t. After consuming t, the terminal bit for the reached node decides whether cat is a stored key rather than only a prefix.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `LOUDS wins for static dictionaries, autocomplete tables, lexicons, compact key maps, and trie-based range filters. It is valuable when order, prefix traversal, or common-prefix lookup matter, and when many keys share enough structure that a trie is conceptually right but pointer overhead is too high.`,
        `The animation's "Dense top, sparse bottom" frame points at a common production refinement. Upper levels are hot because every lookup touches them, so they may use faster bitmap-style layouts. Lower levels contain most nodes, so they may use denser LOUDS-style arrays.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `LOUDS is a poor fit for heavy online mutation. Insertions and deletions can shift broad regions of the topology and label arrays, so a mutable pointer trie, log-structured rebuild, or dynamic succinct tree may be simpler.`,
        `It is also not automatically better than a hash table. If the workload only needs exact membership or key-to-value lookup and does not need order or prefixes, a hash table, minimal perfect hash, Bloom filter, or binary fuse filter may be smaller or faster.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Rank/Select Bitvector first, because LOUDS depends on those operations. Then study Trie for the uncompressed baseline, SuRF Range Filter for a production-style LOUDS use, Finite-State Transducer Static Map for another compact ordered dictionary, and Wavelet Matrix or FM-Index to see the same rank/select primitive in numeric and text indexes.`,
        `Useful references include Memoria's LOUDS tree overview at https://memoria-framework.dev/docs/data-zoo/louds-tree/, the SuRF paper at https://db.cs.cmu.edu/papers/2018/mod601-zhangA-hm.pdf, the CACM Succinct Range Filters article at https://cacm.acm.org/research/succinct-range-filters/, Tx-trie at https://github.com/logogin/tx-trie, and fast_succinct_trie notes at https://github.com/kampersanda/fast_succinct_trie.`,
      ],
    },
  ],
};
