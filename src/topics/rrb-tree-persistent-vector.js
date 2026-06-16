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
  yield {
    state: vectorFlow('Persistent vectors are shallow wide tries'),
    highlight: { active: ['index', 'chunks', 'root'], found: ['leaf', 'value'] },
    explanation: 'A persistent vector stores elements in wide tree nodes, commonly branching by 32. An index is split into fixed-size bit chunks that choose a child at each level until a leaf array holds the element.',
    invariant: 'Updates copy only the nodes on the path to the touched leaf; old roots keep the old version alive.',
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
    explanation: 'Lookup is not a linked-list walk. It is a handful of array reads through a very wide tree. With branching factor 32, millions of elements need only a few levels.',
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
    explanation: 'The persistent part is structural sharing. A single update returns a new vector root while reusing almost everything below it. That makes undo, snapshots, and concurrent readers cheap.',
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
    explanation: 'Persistent vectors fill the gap between flat arrays and ropes: indexed sequence operations with immutable snapshots and much better random access than list-like structures.',
  };
}

function* relaxedConcat() {
  yield {
    state: concatFlow('RRB adds relaxed size tables for concat and split'),
    highlight: { active: ['left', 'right', 'relaxed'], found: ['result'] },
    explanation: 'A plain persistent vector is excellent at lookup, append, and update, but concatenating two vectors can be expensive. RRB trees add relaxed nodes with size tables so concat and split can stay logarithmic.',
    invariant: 'Relaxed nodes record cumulative sizes so index lookup can still route correctly.',
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
    explanation: 'In a perfectly regular vector trie, child size can be inferred from depth. In a relaxed node, child sizes vary, so the size table tells lookup which child owns an index.',
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
    explanation: 'RRB trees preserve the everyday strengths of persistent vectors while repairing the awkward operations: concatenation, split, and insert-at in the middle.',
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
    explanation: 'The case-study pattern is immutable state at scale: keep old versions for readers, undo, or snapshots while edits allocate only a narrow path of new nodes.',
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
      heading: 'What it is',
      paragraphs: [
        'A persistent vector is an immutable indexed sequence implemented as a shallow wide trie. Instead of copying a whole array when one element changes, it path-copies the root-to-leaf route and shares every untouched node with the old version. The result feels array-like for lookup and update while supporting cheap snapshots.',
        'An RRB tree, short for Relaxed Radix Balanced tree, extends that idea. Ordinary persistent vectors are good at lookup, append, and update, but concatenating or splitting large vectors is awkward. RRB nodes carry size tables that allow uneven child sizes while still routing indexes correctly. That relaxation makes concat, split, and insert-at practical.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The base vector trie uses a high branching factor, often 32. An index is split into fixed-size bit chunks. The top chunk chooses a child from the root, the next chunk chooses a child below that, and the low chunk chooses a slot in a leaf array. Because the branching factor is wide, the tree has very small height for ordinary collection sizes.',
        'Updates copy only the nodes along the chosen path. The old root still points to the old path. The new root points to copied nodes where values changed and shared nodes everywhere else. RRB trees add relaxed internal nodes whose children may contain different numbers of elements. A cumulative size table maps an index to the correct child.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup and update cost O(log32 n), which is logarithmic but shallow enough to behave close to constant for many practical sizes. A point update allocates O(log32 n) new nodes. Iteration is linear and can be cache-friendlier than linked lists because leaves are arrays. RRB concat and split aim for O(log n), avoiding the linear suffix copying that plain persistent vectors can suffer.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Clojure popularized persistent vectors as everyday sequence values. The structure gives functional programs immutable state without full copies on each change. Clojure transients add a controlled mutable phase for efficient batch construction, then return to persistent values. RRB vectors were studied as an extension for general-purpose immutable sequences where concatenation and slicing matter. Finger Tree Measured Sequence solves a neighboring problem with fast ends and measured split/search.',
        'A systems-language case study is Immer, which explored RRB-vector ideas for efficient immutable vectors in C++. The broader lesson is not language-specific: editors, compilers, UI state stores, and concurrent readers benefit when old versions remain available while new versions share almost all memory.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Persistent does not mean written to disk. It means previous versions remain accessible after updates. Another misconception is that immutable vectors are free arrays. They have extra indirection, node headers, and path-copy allocation. Flat arrays still win for tight numeric loops and small local buffers. Persistent vectors win when versioning, undo, sharing, and safe concurrent reads are worth that overhead.',
        'RRB trees are also more complex than plain persistent vectors. Size tables, relaxed balancing, transient construction, and concat rebalancing are implementation-heavy. Use them when split and concat are central operations, not merely because immutability sounds attractive.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bagwell and Rompf, RRB-Trees: Efficient Immutable Vectors at https://infoscience.epfl.ch/bitstreams/e5d662ea-1e8d-4dda-b917-8cbb8bb40bf9/download, Clojure data structure reference at https://clojure.org/reference/data_structures, Clojure transients reference at https://clojure.org/reference/transients, Clojure core.rrb-vector notes at https://github.com/clojure/core.rrb-vector/blob/master/doc/rrb-tree-notes.md, and Persistence for the Masses: RRB-Vectors in a Systems Language at https://public.sinusoid.es/misc/immer/immer-icfp17.pdf. Study HAMT, Persistent Segment Tree, Finger Tree Measured Sequence, Text Rope Data Structure, Piece Table Text Buffer, and Git Internals next.',
      ],
    },
  ],
};
