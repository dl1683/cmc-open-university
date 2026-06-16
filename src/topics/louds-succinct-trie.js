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
      heading: 'What it is',
      paragraphs: [
        'LOUDS, the level-order unary degree sequence, is a succinct way to store tree topology. Instead of giving every trie node pointers to children, LOUDS visits nodes in breadth-first order and writes one 1 bit per child followed by a 0. With rank/select support, those bits become a navigable tree.',
        'A LOUDS succinct trie adds labels beside the topology bits. The topology tells the index which child slots exist; the label array tells which byte or character each child edge represents. This is why LOUDS is useful for compact dictionaries, autocomplete, static string maps, and range-filter structures such as SuRF.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For every node, encode its degree in unary. A node with three children contributes 1110; a leaf contributes 0. Concatenate the codes in level order. The resulting bitvector is close to two bits per node plus auxiliary rank/select samples. A separate label array stores edge labels in the same order as child entries.',
        'Lookup still behaves like a trie. At a node, compute the contiguous child range from the LOUDS bitvector, search the labels in that range, and move to the matching child. Terminal bits or value arrays mark completed keys. Prefix queries use the same walk and then enumerate descendants.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The practical win is eliminating pointer-heavy node objects. The cost is that navigation becomes arithmetic over bitvectors, rank/select directories, and compact arrays. It is often excellent for static or immutable indexes because the structure can be built once and queried many times. Frequent updates are harder because inserting a node can shift later topology bits and labels.',
        'Performance is dominated by cache layout. A theoretically constant-time rank/select operation can still touch several cache lines. Fast Succinct Trie designs split hot upper levels from dense lower levels because almost every lookup traverses the top but only one path reaches the bottom.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'SuRF uses Fast Succinct Tries built from LOUDS-style encodings to support point and range filters over sorted keys. The Tx-trie project uses LOUDS for compact exact and common-prefix matching and reports large memory reductions against prior trie implementations. These examples show the central trade: spend static preprocessing to turn pointer-rich tree navigation into compact sequential arrays.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'LOUDS is not compression by itself; it is a navigable representation. The structure becomes useful because rank/select makes the compressed topology queryable. Also do not use it blindly for mutable workloads. If keys change constantly, the rebuilding or dynamic-bitvector complexity may erase the memory win.',
        'It is also not a hash table replacement. Hash tables are excellent for exact membership. LOUDS tries preserve prefix and lexicographic structure, which matters for autocomplete, range filters, ordered scans, and static dictionaries.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Memoria LOUDS tree overview at https://memoria-framework.dev/docs/data-zoo/louds-tree/, SuRF paper PDF at https://db.cs.cmu.edu/papers/2018/mod601-zhangA-hm.pdf, CACM Succinct Range Filters article at https://cacm.acm.org/research/succinct-range-filters/, Tx-trie repository at https://github.com/logogin/tx-trie, and fast_succinct_trie implementation notes at https://github.com/kampersanda/fast_succinct_trie. Study Rank/Select Bitvector, Trie, SuRF Range Filter, Wavelet Tree, FM-Index, and Elias-Fano Encoding next.',
      ],
    },
  ],
};
