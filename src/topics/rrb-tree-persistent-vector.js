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
      heading: 'Why this exists',
      paragraphs: [
        `RRB trees exist because immutable programs still want array-like sequences. Editors want undo history. Compilers want old intermediate representations to remain available while later passes create new ones. UI systems want previous state for comparison. Concurrent readers want a stable version while writers build the next version. A flat mutable array is fast, but it cannot give those old versions without copying itself.`,
        `A persistent vector gives a better shape: every edit returns a new vector while most old nodes are shared. The user gets a sequence that feels close to an array for indexing and appending, but old roots still name old versions. That is the same broad reason persistent maps, tries, and segment trees exist: preserve past values without cloning the whole structure on every change.`,
        `RRB trees refine persistent vectors for a harder set of operations. Ordinary persistent vectors are strong at lookup, append near the end, and point update. They are awkward at concatenating two large vectors, splitting a vector, and inserting near the middle. RRB means relaxed radix balanced. The relaxed part allows uneven child sizes, and the balancing part keeps those uneven nodes from turning into a slow mess.`,
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        `The obvious baseline is a flat array. It has excellent locality, tiny per-element overhead, and direct indexing. If the array is private and mutable, updating slot i is exactly what the machine wants: compute an address and write the value. For tight numeric loops and temporary buffers, that is hard to beat.`,
        `The wall appears when old versions must remain valid. If version A and version B both point at the same flat array, mutating the array changes both versions. Copying the whole array fixes correctness but makes each point update O(n). A program that wants many snapshots pays for full copies even when only one element changes.`,
        `A linked list shares structure cheaply. To add a new head, allocate one node and point it at the old list. Old versions are safe. But random access is now O(n), and sequence workloads often need indexing. A plain persistent vector trie solves point updates and indexing by copying a shallow path. The next wall is concat and split. Rigid vector tries assume child sizes are predictable from depth, so joining two uneven vectors can force too much restructuring.`,
        `RRB trees target that exact wall. They keep the shallow trie shape for indexing, then store enough size information to route through uneven nodes after concat, split, or middle edits.`,
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        `The first insight is path copying in a wide tree. Store elements in leaf arrays. Point to those leaves through internal nodes with a high branching factor, commonly 32. A lookup splits the index into chunks and uses one chunk per level. A point update copies the leaf and each internal node on the path to that leaf. Everything outside that path is shared with the old root.`,
        `The RRB insight is relaxation. In a regular vector trie, the number of elements under a child can be inferred from its depth and position, except near the far right edge. That rigid shape helps indexing but hurts concatenation. An RRB node may have children that cover uneven numbers of elements. To make lookup still work, the node stores cumulative size entries.`,
        `The invariant has two parts. First, every published node is immutable, so any root that existed before an edit still describes the same sequence. Second, every relaxed size table accurately reports the number of elements covered up through each child. If child sizes are [12, 19, 24], the table might store [12, 31, 55]. That table partitions the node's index range.`,
        `Balanced matters too. Relaxation cannot be unlimited. Implementations keep nodes within bounded occupancy rules and rebalance near operation boundaries. That keeps height logarithmic and prevents a series of concatenations from building a lopsided tree.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The wide-trie view teaches why indexing stays fast. The index becomes fixed-size chunks, such as 5-bit chunks when the branching factor is 32. Each chunk selects a child array slot. A million-element vector can still be only a few levels deep, so lookup is a handful of array reads rather than a long pointer walk.`,
        `The path-copy frame teaches persistence. The old root remains alive. The new root points to a newly copied path, and all untouched branches remain shared. The cost of one edit is proportional to tree height, not sequence length. The picture should make it clear that persistence is not magic copying; it is disciplined sharing under immutable nodes.`,
        `The relaxed-concat view teaches what RRB adds. In a perfectly regular trie, child size can be computed from the level. After concat or split, that assumption breaks. The size table becomes the routing guide. It tells lookup which child owns a given index even when children hold uneven amounts of data.`,
        `The rebalance node in the visual model is also important. RRB concat is not just gluing two roots under a parent forever. It reuses large subtrees, repairs a bounded boundary region, and records sizes so future lookups remain reliable.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `A regular persistent vector is usually a wide trie plus a tail buffer. The tail holds recent append values in a flat array. When the tail fills, it is promoted into the tree. This keeps appends fast in the common case while preserving the immutable root structure.`,
        `Lookup starts at the root. If the structure is regular, the implementation uses bit shifts and masks to choose the child at each level. With branching factor 32, five bits select one of 32 children. At the leaf, the low bits choose the element inside the leaf array. The height grows slowly because each level multiplies capacity by 32.`,
        `Point update follows the same route as lookup, but it copies nodes on the way back out. The old root still points to old nodes. The new root points to copied internal nodes and a copied leaf with the changed value. Untouched leaves and internal nodes are shared.`,
        `An RRB node adds a size table when children are not uniform. To find index 40 in a node with cumulative sizes [12, 31, 55, 64], choose the first entry greater than 40, which is 55. That selects child 2. The local index inside that child is 40 - 31 = 9. The lookup then descends with index 9.`,
        `Concat works by joining two vectors without copying all elements. The implementation descends near the right edge of the left vector and the left edge of the right vector, gathers a small boundary set of nodes, redistributes children enough to satisfy occupancy rules, computes fresh size tables, and builds a new root. Most of both input vectors are reused unchanged.`,
        `Split is the mirror image. It follows the split index down the tree, copies the boundary path, and shares whole subtrees on either side. The result is two persistent vectors that share untouched nodes with the original where safe.`,
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        `Structural sharing is correct because published nodes are immutable. If a reader has an old root, no operation mutates the nodes that root can reach. A writer allocates new nodes for the changed path and then publishes a new root. The two versions may share most of their structure, but neither version can observe a half-applied edit.`,
        `Regular lookup is correct because each index chunk selects the unique child range that contains the target element. The tree shape encodes a radix decomposition of the index. At each level, the chosen child narrows the range until the leaf slot is reached.`,
        `Relaxed lookup is correct when size tables match subtree sizes. A cumulative size table partitions a node's element range into consecutive child ranges. Choosing the first cumulative size greater than the target index selects exactly the range containing that index. Subtracting the previous cumulative size converts the global index at that node into the local index for the child.`,
        `Concat and split are correct only if they preserve element order, keep published inputs immutable, rebuild all changed parent nodes, and recompute every affected size table. The result does not need to have perfectly equal child sizes. It needs to satisfy the occupancy and balance rules that keep height bounded and lookup routing valid.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Use a tiny branching factor of 4 for intuition. A regular vector with 16 elements can have four children of size 4 under the root. Index 10 goes to child 2 with offset 2, because child 0 covers 0..3, child 1 covers 4..7, and child 2 covers 8..11. No size table is needed because each child has the same capacity.`,
        `Now update index 10. The implementation copies the root, copies child 2, changes slot 2 inside that copied child, and returns a new root. Children 0, 1, and 3 are shared. The old vector still sees the old child 2. The new vector sees the copied child 2. That is a persistent point update.`,
        `Now imagine concatenating two uneven vectors. The new relaxed root has four children covering [3, 4, 3, 4] elements. The cumulative table is [3, 7, 10, 14]. Index 8 belongs to the first cumulative size greater than 8, which is 10. That selects child 2. The local offset is 8 - 7 = 1. The table is what keeps indexing meaningful after concat stops producing perfectly even blocks.`,
        `Split at index 7 reverses the idea. The left result contains elements 0 through 6, and the right result contains elements 7 onward. Whole child subtrees that lie entirely on one side can be shared. Only the boundary path and size tables need to be rebuilt.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Lookup and point update are O(log_B n), where B is the branching factor. With B = 32, the tree is shallow. A vector with millions of elements may need only a handful of levels. A point update allocates one new node per level plus a copied leaf, so the allocation cost is also O(log_B n).`,
        `Append is often near O(1) amortized because the tail buffer absorbs many appends before a tree update is needed. When the tail fills, promoting it into the tree costs more, but the cost is spread across many prior appends.`,
        `RRB concat and split aim for logarithmic work by reusing whole subtrees and rebalancing a bounded boundary. That is the main advantage over plain persistent vectors for sequence editing. The structure does not copy all elements from either side.`,
        `The tradeoffs are real. Size tables add memory. Relaxed lookup may need a small search in the size table instead of pure bit arithmetic. Rebalance code is complex and easy to get wrong. Locality is worse than a flat array because internal nodes and leaves are separate allocations. Iteration can still be fast over leaf arrays, but it is not the same as streaming one contiguous buffer.`,
        `The structure pays rent when old versions and sequence operations are both important. If the data is private, mutable, and cache-sensitive, a normal array should win.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `RRB-style vectors win in immutable sequence workloads that still need indexing. Functional language collections are the natural home. Programs can pass values freely, keep old versions, and still use near-array operations for nth, update, append, concat, and split.`,
        `Editors can use persistent sequences to support undo and redo without copying the whole buffer after every edit. Compilers can preserve old versions of intermediate representation while transformations create new versions. UI state systems can keep previous states for comparison or time travel. Dataflow systems can concatenate and slice batches while retaining earlier views.`,
        `They also fit concurrent read-mostly state. Readers can hold old roots without locks while a writer builds a new root. Publication becomes a pointer swap at the root level, assuming the surrounding language runtime provides the right memory visibility rules.`,
        `The API appeal is strong: a vector-like sequence with immutable lifecycle. That is different from a rope, which is more text-oriented, and different from a persistent map, which is keyed by hash or order rather than by dense integer index.`,
      ],
    },
    {
      heading: 'Limits and failure cases',
      paragraphs: [
        `Persistent here does not mean stored on disk. It means old versions remain available as values. If the application needs durability across crashes, it needs a storage layer, serialization format, and recovery rules on top of the data structure.`,
        `RRB trees are a poor choice for tight numeric loops, tiny buffers, and code that lives or dies by contiguous memory. A JavaScript array, typed array, or language-native vector is simpler and usually faster when mutation is allowed and snapshots are not part of the contract.`,
        `They can also be too complex when the workload only needs append and random access. A plain persistent vector is easier to reason about and implement. The relaxed machinery is justified when concat, split, slicing, or middle insertion are common enough to dominate.`,
        `Bad size tables are dangerous. If a rebalance step preserves the child pointers but computes one cumulative size incorrectly, lookup can silently return the wrong element. That kind of bug may pass simple append tests and fail only after a particular concat and split sequence.`,
        `Memory retention is another limit. Structural sharing keeps old versions cheap, but keeping many roots alive also keeps shared old nodes alive. An application with unbounded undo history can still retain a lot of memory. Persistence lowers copying cost; it does not make history free.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Start with a plain persistent vector before implementing relaxation. Get lookup, append, tail promotion, point update, and path copying correct first. Then add relaxed nodes and size tables. This staged path reduces the number of moving parts when a lookup or update fails.`,
        `Use small branching factors in tests, such as 2 or 4, even if production uses 32. Small branching factors force deeper trees, more boundary cases, and more rebalancing. They make bugs appear in tiny examples instead of requiring millions of elements.`,
        `Test against a simple array model. Generate random operations: append, update, concat, split, slice, and lookup. After each operation, compare the persistent vector's sequence with the model array. Also keep old roots and check them after later edits, because version preservation is part of the contract.`,
        `Validate size tables aggressively in debug builds. Each relaxed node should be able to recompute child sizes and compare them with stored cumulative sizes. Also check occupancy rules and tree height. The fastest way to lose trust in an RRB implementation is to let a rare rebalance bug corrupt a later lookup.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources include Bagwell and Rompf, RRB-Trees: Efficient Immutable Vectors; Clojure's persistent vector and transients documentation; Clojure core.rrb-vector notes; and Persistence for the Masses: RRB-Vectors in a Systems Language. Study HAMT for persistent maps, Persistent Segment Tree for versioned range queries, Finger Tree Measured Sequence for measured concatenation, Text Rope Data Structure and Piece Table Text Buffer for editor sequences, and Git Internals for structural sharing in content history.`,
      ],
    },
  ],
};
