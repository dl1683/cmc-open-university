// RRB trees: persistent vectors keep array-like indexing through a wide trie;
// relaxed size tables make concat and split efficient too.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rrb-tree-persistent-vector',
  title: 'RRB Tree Persistent Vector',
  category: 'Data Structures',
  summary: 'An immutable indexed sequence: wide trie nodes share most structure across versions, while relaxed size tables support fast concat and split.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['wide trie vector', 'relaxed concat'], defaultValue: 'wide trie vector' },
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

function vectorFlow(title) {
  return graphState({
    nodes: [
      { id: 'index', label: 'index', x: 0.8, y: 3.2, note: 'i' },
      { id: 'chunks', label: 'bit chunks', x: 2.7, y: 3.2, note: 'radix 32' },
      { id: 'root', label: 'root', x: 4.6, y: 3.2, note: 'wide node' },
      { id: 'leaf', label: 'leaf', x: 6.5, y: 3.2, note: 'array block' },
      { id: 'value', label: 'value', x: 8.4, y: 3.2, note: 'nth i' },
    ],
    edges: [
      { id: 'e-index-chunks', from: 'index', to: 'chunks' },
      { id: 'e-chunks-root', from: 'chunks', to: 'root' },
      { id: 'e-root-leaf', from: 'root', to: 'leaf' },
      { id: 'e-leaf-value', from: 'leaf', to: 'value' },
    ],
  }, { title });
}

function concatFlow(title) {
  return graphState({
    nodes: [
      { id: 'left', label: 'left vec', x: 0.8, y: 3.2, note: 'shared' },
      { id: 'right', label: 'right vec', x: 2.7, y: 3.2, note: 'shared' },
      { id: 'relaxed', label: 'relaxed node', x: 4.8, y: 3.2, note: 'sizes' },
      { id: 'rebalance', label: 'rebalance', x: 6.9, y: 3.2, note: 'bounded' },
      { id: 'result', label: 'new vec', x: 8.8, y: 3.2, note: 'old kept' },
    ],
    edges: [
      { id: 'e-left-relaxed', from: 'left', to: 'relaxed' },
      { id: 'e-right-relaxed', from: 'right', to: 'relaxed' },
      { id: 'e-relaxed-rebalance', from: 'relaxed', to: 'rebalance' },
      { id: 'e-rebalance-result', from: 'rebalance', to: 'result' },
    ],
  }, { title });
}

function* wideTrieVector() {
  const branchFactor = 32;
  const bitsPerLevel = 5;
  const vectorNodeCount = 5;
  const vectorEdgeCount = 4;

  yield {
    state: vectorFlow('Persistent vectors are shallow wide tries'),
    highlight: { active: ['index', 'chunks', 'root'], found: ['leaf', 'value'] },
    explanation: `A persistent vector stores elements in wide tree nodes, commonly branching by ${branchFactor}. An index is split into ${bitsPerLevel}-bit chunks that choose a child at each level until a leaf array holds the element.`,
    invariant: `Updates copy only the ${vectorNodeCount - 2} internal/leaf nodes on the path to the touched leaf; old roots keep the old version alive.`,
  };

  yield {
    state: labelMatrix(
      'Index path',
      [
        { id: 'root', label: 'root' },
        { id: 'node', label: 'internal' },
        { id: 'leaf', label: 'leaf' },
        { id: 'slot', label: 'slot' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'result', label: 'result' },
      ],
      [
        ['top bits', 'child 2'],
        ['next bits', 'child 7'],
        ['low bits', 'block'],
        ['offset', 'value'],
      ],
    ),
    highlight: { active: ['root:uses', 'node:uses', 'leaf:uses'], found: ['slot:result'] },
    explanation: `Lookup is not a linked-list walk. It is a handful of array reads through a very wide tree. With branching factor ${branchFactor}, millions of elements need only a few levels.`,
  };

  yield {
    state: labelMatrix(
      'Path-copy update',
      [
        { id: 'oldRoot', label: 'old root' },
        { id: 'newRoot', label: 'new root' },
        { id: 'shared', label: 'shared nodes' },
        { id: 'copied', label: 'copied path' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'why', label: 'why' },
      ],
      [
        ['unchanged', 'old version'],
        ['new pointer', 'new version'],
        ['reused', 'untouched'],
        ['O(log32 n)', 'edit path'],
      ],
    ),
    highlight: { found: ['shared:state'], active: ['newRoot:state', 'copied:state'], compare: ['oldRoot:state'] },
    explanation: `The persistent part is structural sharing. A single update returns a new vector root while reusing almost everything below it. That makes undo, snapshots, and concurrent readers cheap — only O(log${branchFactor} n) nodes are copied per edit.`,
  };

  yield {
    state: labelMatrix(
      'Persistent vector versus neighbors',
      [
        { id: 'array', label: 'flat array' },
        { id: 'pvec', label: 'pvector' },
        { id: 'hamt', label: 'HAMT' },
        { id: 'rope', label: 'rope' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'trade', label: 'tradeoff' },
      ],
      [
        ['cache locality', 'copy on edit'],
        ['immutable index', 'tree indirection'],
        ['keyed map', 'hash order'],
        ['big text concat', 'not array-like'],
      ],
    ),
    highlight: { found: ['pvec:best'], compare: ['array:trade', 'rope:trade'] },
    explanation: `Persistent vectors fill the gap between flat arrays and ropes: indexed sequence operations with immutable snapshots and much better random access than list-like structures, all with ${branchFactor}-way branching keeping the tree shallow.`,
  };
}

function* relaxedConcat() {
  const concatNodeCount = 5;
  const concatEdgeCount = 4;
  const exampleChildSizes = [12, 19, 24, 9];
  const exampleCumSizes = [12, 31, 55, 64];
  const totalElements = exampleCumSizes[exampleCumSizes.length - 1];

  yield {
    state: concatFlow('RRB adds relaxed size tables for concat and split'),
    highlight: { active: ['left', 'right', 'relaxed'], found: ['result'] },
    explanation: `A plain persistent vector is excellent at lookup, append, and update, but concatenating two vectors can be expensive. RRB trees add relaxed nodes (${concatNodeCount} stages shown) with size tables so concat and split can stay logarithmic.`,
    invariant: `Relaxed nodes record cumulative sizes (e.g. [${exampleCumSizes.join(', ')}] for ${totalElements} elements) so index lookup can still route correctly.`,
  };

  yield {
    state: labelMatrix(
      'Relaxed node size table',
      [
        { id: 'c0', label: 'child 0' },
        { id: 'c1', label: 'child 1' },
        { id: 'c2', label: 'child 2' },
        { id: 'c3', label: 'child 3' },
      ],
      [
        { id: 'size', label: 'cum size' },
        { id: 'route', label: 'index route' },
      ],
      [
        ['12', '0..11'],
        ['31', '12..30'],
        ['55', '31..54'],
        ['64', '55..63'],
      ],
    ),
    highlight: { active: ['c2:size', 'c2:route'], found: ['c2:route'] },
    explanation: `In a perfectly regular vector trie, child size can be inferred from depth. In a relaxed node, child sizes vary (e.g. ${exampleChildSizes.join(', ')}), so the cumulative size table [${exampleCumSizes.join(', ')}] tells lookup which child owns a given index.`,
  };

  yield {
    state: labelMatrix(
      'Operation shape',
      [
        { id: 'lookup', label: 'lookup' },
        { id: 'update', label: 'update' },
        { id: 'append', label: 'append' },
        { id: 'concat', label: 'concat/split' },
      ],
      [
        { id: 'plain', label: 'plain pvector' },
        { id: 'rrb', label: 'RRB vector' },
      ],
      [
        ['fast', 'fast'],
        ['path copy', 'path copy'],
        ['tail optimized', 'tail optimized'],
        ['costly', 'logarithmic'],
      ],
    ),
    highlight: { found: ['concat:rrb'], compare: ['concat:plain'] },
    explanation: `RRB trees preserve the everyday strengths of persistent vectors while repairing the awkward operations: concatenation, split, and insert-at in the middle — all in O(log n) instead of O(n).`,
  };

  yield {
    state: labelMatrix(
      'Where it shows up',
      [
        { id: 'clojure', label: 'Clojure' },
        { id: 'scala', label: 'Scala/RRB' },
        { id: 'immer', label: 'Immer' },
        { id: 'editor', label: 'undo stacks' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['persistent vec', 'wide trie'],
        ['RRB work', 'fast concat'],
        ['systems C++', 'persistent seq'],
        ['snapshots', 'share history'],
      ],
    ),
    highlight: { found: ['clojure:role', 'scala:lesson'], active: ['immer:role', 'editor:role'] },
    explanation: `The case-study pattern is immutable state at scale: keep old versions for readers, undo, or snapshots while edits allocate only a narrow path of new nodes — ${concatEdgeCount} edges in the concat flow show the pipeline from input vectors to rebalanced result.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'wide trie vector') yield* wideTrieVector();
  else if (view === 'relaxed concat') yield* relaxedConcat();
  else throw new InputError('Pick an RRB vector view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The wide-trie view shows a persistent vector, which is an immutable indexed sequence. Active nodes are the path chosen by one index, and found marks the leaf slot holding the value. The safe inference rule is that only the nodes on the selected path are needed for lookup or point update.',
        {type: 'image', src: './assets/gifs/rrb-tree-persistent-vector.gif', alt: 'Animated walkthrough of the rrb tree persistent vector visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The relaxed-concat view shows what RRB adds. A size table tells lookup which uneven child owns an index after concat or split. When the table says cumulative sizes are [12, 31, 55, 64], index 40 belongs to the child ending at 55 because 31 <= 40 < 55.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Immutable programs need sequences that behave like arrays without destroying old versions. Editors need undo, compilers need old intermediate states, and UI systems need previous state for comparison. Copying a whole array after one edit preserves history but turns one changed slot into O(n) copying.',
        {type: 'callout', text: 'RRB trees keep immutable indexed vectors fast by sharing wide trie nodes and storing size tables only where relaxation makes routing ambiguous.'},
        'RRB means relaxed radix balanced. The radix part is a wide tree where each level consumes a chunk of index bits. The relaxed part lets children have uneven sizes, which makes concat and split practical without giving up indexed lookup.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a flat array. It gives direct indexing, good cache locality, and simple iteration. If mutation is allowed and old versions do not matter, it is usually the right structure.',
        'A second approach is a linked list, because lists share tails cheaply. Adding a new head is O(1) and old versions remain valid. The problem is that indexing becomes O(n), so a sequence that needs nth, update, split, and concat cannot live comfortably as a plain list.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A persistent vector trie solves point update by path copying, but concat and split expose the wall. A rigid trie assumes child sizes from depth, so joining two uneven vectors can force copying or rebuilding too much boundary structure. The data remains correct, but the operation stops being cheap.',
        'The wall is routing after relaxation. Once child sizes vary, bit chunks alone no longer identify the right child. The structure needs extra information at exactly the nodes where regular shape was broken.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use a shallow wide tree for array-like indexing, and copy only the edited path when a new version is created. With branching factor 32, each level covers five index bits, so millions of elements need only a few levels. Untouched subtrees are shared by old and new roots.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys and wide internal nodes', caption: 'Wide nodes are the shared idea: a high branching factor keeps tree height small even when the sequence is large. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
        'RRB adds size tables to relaxed nodes. A size table stores cumulative element counts for each child, so lookup can route through uneven children. The invariant is that each published node is immutable and every size table accurately partitions the index range.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lookup starts at the root and descends to a leaf. In regular nodes, bit shifts and masks select child slots. In relaxed nodes, the implementation searches the cumulative size table for the first entry greater than the local index, then subtracts the previous cumulative size before descending.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Vector_Rope_example.svg/500px-Vector_Rope_example.svg.png', alt: 'Rope-like tree with weighted internal nodes and string chunks at leaves', caption: 'The tree-of-chunks picture is useful for RRB vectors too: internal nodes route to leaf blocks while weights or size tables preserve indexing. Source: Wikipedia/Wikimedia, https://en.wikipedia.org/wiki/Rope_(data_structure).'},
        'Point update follows the same path, copies each node on that path, changes the copied leaf, and returns a new root. Concat reuses most subtrees from both inputs, repairs a bounded boundary region, recomputes size tables, and returns a root that names the joined sequence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Persistence is correct because old nodes are never mutated. An old root can only reach the old path, while a new root reaches copied nodes on the edit path and shared nodes everywhere else. Sharing is safe because immutable nodes cannot observe a later write.',
        'Relaxed lookup is correct because cumulative sizes form consecutive ranges. If a node has table [3, 7, 10, 14], then child 0 owns 0..2, child 1 owns 3..6, child 2 owns 7..9, and child 3 owns 10..13. Choosing the first entry greater than the target index selects the unique child range that contains the value.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup and point update cost O(log_B n), where B is the branching factor. With B = 32, doubling n only adds a level after capacity crosses another power of 32, so the curve grows slowly. A point update allocates one copied node per level plus a leaf.',
        'Concat and split are designed to be logarithmic by sharing whole subtrees and rebuilding only bounded boundary regions. Size tables add memory and a small routing cost. The structure pays that cost to avoid copying all elements when two immutable sequences are joined.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RRB-style vectors fit functional language collections, editor buffers with undo, UI state histories, compiler intermediate representations, and dataflow systems that slice or join batches. The shared need is indexed access plus many versions. Old roots remain valid while new roots describe edited sequences.',
        'They also fit concurrent read-mostly state. Readers can keep a root without locks while a writer builds a new root. Publishing the new version becomes a pointer update around an immutable structure, assuming the runtime gives the needed memory visibility.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RRB trees are poor for tight numeric loops and tiny mutable buffers. A flat array or typed array has better locality and lower constant overhead. If snapshots are not part of the contract, the tree indirection is usually wasted.',
        'They are also hard to implement correctly. One wrong cumulative size after a concat can silently route lookup to the wrong leaf. Test suites need random operation sequences against a simple array model, including old-root checks after later edits.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use branching factor 4 for small numbers. A regular vector with 16 elements has four leaf children of size 4, so index 10 goes to child 2 because children cover 0..3, 4..7, 8..11, and 12..15. The offset inside child 2 is 10 - 8 = 2.',
        'After concat, suppose a relaxed node has child sizes [3, 4, 3, 4] and cumulative table [3, 7, 10, 14]. Index 8 selects the first cumulative entry greater than 8, which is 10, so it enters child 2. The local offset is 8 - 7 = 1, and the old input vectors can still share untouched children with the result.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Bagwell and Rompf, RRB-Trees: Efficient Immutable Vectors, and implementation notes from Clojure and Scala persistent-vector work. Study HAMT for persistent maps and finger trees for another measured sequence structure.',
        'Study persistent segment trees, ropes, piece tables, and structural sharing in Git next. The common question is how a structure preserves old versions while keeping lookup and update costs tied to changed paths rather than total size.',
      ],
    },
  ],
};