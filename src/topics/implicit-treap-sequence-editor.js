// Implicit treap: a randomized sequence tree keyed by subtree sizes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'implicit-treap-sequence-editor',
  title: 'Implicit Treap Sequence Editor',
  category: 'Data Structures',
  summary: 'Use treap split/merge with subtree sizes as implicit positions, giving arrays, playlists, and editor ranges O(log n) sequence surgery.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rank keys', 'split insert', 'playlist case study'], defaultValue: 'rank keys' },
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

const BASE_NODES = [
  { id: 'd', label: 'D', x: 5.0, y: 0.8, note: 'p96 sz7' },
  { id: 'b', label: 'B', x: 3.0, y: 2.6, note: 'p80 sz3' },
  { id: 'f', label: 'F', x: 7.0, y: 2.6, note: 'p70 sz3' },
  { id: 'a', label: 'A', x: 2.0, y: 4.5, note: 'p20 sz1' },
  { id: 'c', label: 'C', x: 4.0, y: 4.5, note: 'p40 sz1' },
  { id: 'e', label: 'E', x: 6.0, y: 4.5, note: 'p55 sz1' },
  { id: 'g', label: 'G', x: 8.0, y: 4.5, note: 'p30 sz1' },
];

const BASE_EDGES = [
  { id: 'e-d-b', from: 'd', to: 'b' },
  { id: 'e-d-f', from: 'd', to: 'f' },
  { id: 'e-b-a', from: 'b', to: 'a' },
  { id: 'e-b-c', from: 'b', to: 'c' },
  { id: 'e-f-e', from: 'f', to: 'e' },
  { id: 'e-f-g', from: 'f', to: 'g' },
];

const INSERT_NODES = [
  { id: 'd', label: 'D', x: 5.4, y: 0.8, note: 'p96 sz8' },
  { id: 'x', label: 'X', x: 3.2, y: 2.5, note: 'p88 sz4' },
  { id: 'f', label: 'F', x: 7.2, y: 2.5, note: 'p70 sz3' },
  { id: 'b', label: 'B', x: 2.2, y: 4.3, note: 'p80 sz3' },
  { id: 'a', label: 'A', x: 1.3, y: 6.0, note: 'p20 sz1' },
  { id: 'c', label: 'C', x: 3.1, y: 6.0, note: 'p40 sz1' },
  { id: 'e', label: 'E', x: 6.2, y: 4.3, note: 'p55 sz1' },
  { id: 'g', label: 'G', x: 8.0, y: 4.3, note: 'p30 sz1' },
];

const INSERT_EDGES = [
  { id: 'e-d-x', from: 'd', to: 'x' },
  { id: 'e-d-f', from: 'd', to: 'f' },
  { id: 'e-x-b', from: 'x', to: 'b' },
  { id: 'e-b-a', from: 'b', to: 'a' },
  { id: 'e-b-c', from: 'b', to: 'c' },
  { id: 'e-f-e', from: 'f', to: 'e' },
  { id: 'e-f-g', from: 'f', to: 'g' },
];

function treapGraph(title, inserted = false, extraNotes = {}) {
  const nodes = inserted ? INSERT_NODES : BASE_NODES;
  const edges = inserted ? INSERT_EDGES : BASE_EDGES;
  return graphState({
    nodes: nodes.map((node) => ({ ...node, note: extraNotes[node.id] ?? node.note })),
    edges,
  }, { title });
}

function* rankKeys() {
  yield {
    state: treapGraph('In-order order is the sequence'),
    highlight: { active: ['d'], found: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
    explanation: 'An implicit treap does not store array indexes as keys. The in-order walk is the sequence A B C D E F G, and subtree sizes tell each node its current position.',
    invariant: 'BST key order is replaced by sequence rank; heap priority still balances the tree.',
  };

  yield {
    state: labelMatrix(
      'Select position 4, zero based',
      [
        { id: 'atD', label: 'at D' },
        { id: 'goR', label: 'go right' },
        { id: 'atF', label: 'at F' },
        { id: 'goL', label: 'go left' },
      ],
      [{ id: 'test', label: 'test' }, { id: 'next', label: 'next' }],
      [
        ['left size 3', 'idx > 3'],
        ['idx = 0', 'right tree'],
        ['left size 1', 'idx < 1'],
        ['land on E', 'answer'],
      ],
    ),
    highlight: { active: ['atD:test', 'atF:test'], found: ['goL:next'], compare: ['goR:next'] },
    explanation: 'To select by position, compare the target index with left subtree size. Equal means current node; smaller goes left; larger subtracts left size plus one and goes right.',
  };

  yield {
    state: treapGraph('The select path reaches E'),
    highlight: { active: ['d', 'f', 'e', 'e-d-f', 'e-f-e'], found: ['e'], compare: ['b'] },
    explanation: 'The lookup path is logarithmic in expectation because random priorities keep the treap balanced. Positions stay correct after edits because every node maintains size = 1 + left size + right size.',
  };

  yield {
    state: labelMatrix(
      'Sequence operations',
      [
        { id: 'insert', label: 'insert i' },
        { id: 'delete', label: 'delete range' },
        { id: 'move', label: 'move range' },
        { id: 'reverse', label: 'reverse' },
      ],
      [{ id: 'recipe', label: 'recipe' }, { id: 'cost' }],
      [
        ['split + node', 'O(log n)'],
        ['split 2x', 'O(log n)'],
        ['cut + merge', 'O(log n)'],
        ['lazy flip', 'O(log n)'],
      ],
    ),
    highlight: { active: ['insert:recipe', 'move:recipe', 'reverse:recipe'], found: ['delete:cost'] },
    explanation: 'Split and merge become sequence surgery. Insert, delete, move, and reverse are short recipes over position-based splits.',
  };

  yield {
    state: labelMatrix(
      'Neighbor structures',
      [
        { id: 'rope', label: 'rope' },
        { id: 'piece', label: 'piece' },
        { id: 'finger', label: 'finger' },
        { id: 'itreap', label: 'treap' },
      ],
      [{ id: 'best', label: 'best at' }, { id: 'trade' }],
      [
        ['text', 'chunks'],
        ['undo', 'pieces'],
        ['persist', 'measure'],
        ['ranges', 'random'],
      ],
    ),
    highlight: { found: ['itreap:best'], compare: ['rope:best', 'piece:best'], active: ['finger:trade'] },
    explanation: 'Implicit treaps are a compact, randomized alternative for editable sequences. Ropes and piece tables are often better for raw text chunks; implicit treaps are excellent for generic items and range operations.',
  };
}

function* splitInsert() {
  yield {
    state: treapGraph('Split at position 3'),
    highlight: { active: ['d', 'b', 'c'], found: ['a', 'b', 'c'], compare: ['d', 'e', 'f', 'g'] },
    explanation: 'To insert at position 3, first split the sequence into left A B C and right D E F G. The split walks by left subtree sizes, not by explicit keys.',
  };

  yield {
    state: labelMatrix(
      'Split recursion',
      [
        { id: 'd', label: 'node D' },
        { id: 'b', label: 'node B' },
        { id: 'c', label: 'node C' },
        { id: 'done', label: 'return' },
      ],
      [{ id: 'choice', label: 'choice' }, { id: 'effect' }],
      [
        ['k < rank D', 'split left'],
        ['k > rank B', 'split right'],
        ['cut after C', 'left done'],
        ['fix sizes', 'two treaps'],
      ],
    ),
    highlight: { active: ['d:choice', 'b:choice', 'c:effect'], found: ['done:effect'] },
    explanation: 'Every recursive step returns two valid treaps. After rewiring one child pointer, update subtree sizes on the way back out.',
  };

  yield {
    state: labelMatrix(
      'Insert new item X',
      [
        { id: 'left', label: 'left' },
        { id: 'new', label: 'new node' },
        { id: 'right', label: 'right' },
        { id: 'merge', label: 'merge' },
      ],
      [{ id: 'holds', label: 'holds' }, { id: 'next' }],
      [
        ['A B C', 'ready'],
        ['X p88', 'single'],
        ['D E F G', 'ready'],
        ['L + X + R', 'sequence'],
      ],
    ),
    highlight: { active: ['left:holds', 'new:holds', 'right:holds'], found: ['merge:next'] },
    explanation: 'The inserted item is just a one-node treap with a random priority. Merge preserves in-order sequence order and heap priority.',
  };

  yield {
    state: treapGraph('After merge: A B C X D E F G', true),
    highlight: { found: ['x'], active: ['d', 'x', 'b', 'e-d-x', 'e-x-b'], compare: ['f'] },
    explanation: 'X lands between C and D in in-order order. Its high priority makes it the root of the left side under D, but the sequence order remains A B C X D E F G.',
  };

  yield {
    state: labelMatrix(
      'Edit recipes as split/merge',
      [
        { id: 'paste', label: 'paste' },
        { id: 'cut', label: 'cut' },
        { id: 'move', label: 'move' },
        { id: 'undo', label: 'undo' },
      ],
      [{ id: 'steps', label: 'steps' }, { id: 'note' }],
      [
        ['split', 'insert'],
        ['2 splits', 'drop'],
        ['cut+glue', 'move'],
        ['copy', 'undo'],
      ],
    ),
    highlight: { active: ['paste:steps', 'move:steps'], found: ['undo:note'], compare: ['cut:note'] },
    explanation: 'The same primitive operations can power an editor, playlist, timeline, or card board. Persistence is optional: path-copying can keep old versions when undo or snapshots matter.',
  };
}

function* playlistCaseStudy() {
  yield {
    state: labelMatrix(
      'Playlist positions',
      [
        { id: 'a', label: '0' },
        { id: 'b', label: '1' },
        { id: 'c', label: '2' },
        { id: 'd', label: '3' },
        { id: 'e', label: '4' },
        { id: 'f', label: '5' },
      ],
      [{ id: 'track', label: 'track' }, { id: 'op' }],
      [
        ['intro', 'keep'],
        ['verse', 'move'],
        ['hook', 'move'],
        ['solo', 'keep'],
        ['outro', 'keep'],
        ['ad', 'delete'],
      ],
    ),
    highlight: { active: ['b:op', 'c:op'], removed: ['f:op'], found: ['a:track'] },
    explanation: 'A playlist or video timeline is an editable sequence. Users insert, delete, and move ranges by position while the UI needs fast access by index.',
  };

  yield {
    state: labelMatrix(
      'Move range [1,3) after index 4',
      [
        { id: 's1', label: 'split 1' },
        { id: 's2', label: 'split 3' },
        { id: 's3', label: 'split dest' },
        { id: 'join', label: 'join' },
      ],
      [{ id: 'piece', label: 'piece' }, { id: 'result' }],
      [
        ['A | BCDEF', 'left'],
        ['BC | DEF', 'cut'],
        ['DE | F', 'target'],
        ['A DE BC F', 'done'],
      ],
    ),
    highlight: { active: ['s1:piece', 's2:piece', 's3:piece'], found: ['join:result'] },
    explanation: 'Range move is split, split, split, then merge in the new order. The treap never shifts a whole array tail one slot at a time.',
  };

  yield {
    state: treapGraph('Lazy reverse marks a subtree instead of swapping every item'),
    highlight: { active: ['b', 'a', 'c'], found: ['d'], compare: ['f', 'g'] },
    explanation: 'A reverse flag can sit on a subtree. When traversal or another split descends into it, the flag swaps children and propagates downward. That makes range reverse logarithmic plus touched boundaries.',
  };

  yield {
    state: labelMatrix(
      'Operational costs',
      [
        { id: 'access', label: 'access i' },
        { id: 'insert', label: 'insert' },
        { id: 'move', label: 'move' },
        { id: 'render', label: 'render' },
      ],
      [{ id: 'cost' }, { id: 'reason' }],
      [
        ['O(log n)', 'rank path'],
        ['O(log n)', 'split/merge'],
        ['O(log n)', '3 splits'],
        ['O(k log n)', 'visible k'],
      ],
    ),
    highlight: { found: ['insert:cost', 'move:cost'], active: ['access:reason'], compare: ['render:reason'] },
    explanation: 'The data structure helps edits, but rendering k visible rows still has to visit those k rows. Pair the treap with virtualization for large UI lists.',
  };

  yield {
    state: labelMatrix(
      'Production cautions',
      [
        { id: 'rng', label: 'rng' },
        { id: 'size', label: 'size' },
        { id: 'lazy', label: 'lazy' },
        { id: 'text', label: 'text' },
      ],
      [{ id: 'rule' }, { id: 'risk' }],
      [
        ['pri', 'shape'],
        ['sz', 'rank'],
        ['push', 'order'],
        ['chunks', 'chars'],
      ],
    ),
    highlight: { active: ['rng:rule', 'size:rule', 'lazy:rule'], found: ['text:risk'] },
    explanation: 'The implementation is small but sharp-edged: priorities must balance, sizes must update after every pointer change, and lazy tags must be pushed before decisions that depend on child order.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rank keys') yield* rankKeys();
  else if (view === 'split insert') yield* splitInsert();
  else if (view === 'playlist case study') yield* playlistCaseStudy();
  else throw new InputError('Pick an implicit-treap view.');
}

export const article = {
  sections: [
    {
      heading: 'Problem',
      paragraphs: [
        'Many applications store an ordered sequence and then edit the middle of it. A text editor inserts and deletes spans. A playlist lets the user drag songs. A timeline editor moves clips. A browser tab strip reorders tabs. A flat array gives fast indexing, but inserting or removing in the middle shifts many elements. A linked list edits locally, but finding position i requires scanning.',
        {type: 'callout', text: 'An implicit treap stores sequence position as subtree size accounting, so edits repair local ranks instead of rewriting global indexes.'},
        'An implicit treap solves the middle ground: keep sequence order, support rank-based access, and make cut, paste, insert, delete, move, and reverse run in expected logarithmic time. It is "implicit" because the tree does not store explicit keys. The key of a node is its position in the in-order traversal, derived from subtree sizes.',
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The obvious structure is an array. select(i) is O(1), rendering a contiguous window is cache-friendly, and appending is cheap. But insertion at the front or middle shifts O(n) items. Moving a block can require two shifts. Reversing a long selected range can touch every item even when the UI only needs to record the operation.',
        'A linked list fixes local insertion and deletion, but now select(i), split at i, or render rows 100000 through 100050 require walking from a known pointer. Skip lists, ropes, piece tables, and finger trees each solve parts of the problem. An implicit treap is the compact randomized-tree version built around two primitives: split by rank and merge adjacent sequences.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Vector_Rope_example.svg/500px-Vector_Rope_example.svg.png', alt: 'Rope data structure example with string chunks stored in a tree', caption: 'Ropes solve a related editor problem by storing sequence chunks in a tree; implicit treaps use a randomized tree with rank-derived positions. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Vector_Rope_example.svg'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that position changes after every edit. If every element stores its numeric index, inserting one item at the front invalidates all later indices. If the structure stores only next pointers, position queries become slow. The sequence needs ranks that update locally, not labels that must be rewritten globally.',
        'The second wall is range surgery. Insert one item is not enough. Real editors need delete [l, r), move [l, r) to position j, reverse [l, r), apply a style to a range, or extract a segment for undo. A good structure should express these as a small number of balanced-tree operations instead of loops over every item.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Use a treap where the binary-search order is not stored as a field. The in-order traversal is the sequence. Each node stores a random priority for balance and a subtree size for rank. The priority gives expected logarithmic height. The size tells how many items appear before the current node inside its subtree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/TreapAlphaKey.svg/500px-TreapAlphaKey.svg.png', alt: 'Treap diagram showing key order and heap priorities', caption: 'A treap combines binary-search order with heap priority. In an implicit treap, the visible keys are replaced by in-order rank derived from subtree sizes. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:TreapAlphaKey.svg'},
        'The structure has two invariants. First, in-order order is sequence order: everything in the left subtree comes before the node, and everything in the right subtree comes after it. Second, heap priority gives balance: a parent has higher priority than its children. Because positions are implied by sizes, an insertion changes sizes only on the paths touched by split and merge.',
        'This is why the data structure is useful for editors. Instead of updating every later index after an insert, update O(log n) size fields. Instead of moving a range item by item, split the sequence into pieces, then merge the pieces in the new order.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Each node stores value, priority, left child, right child, subtree size, and optional lazy tags. The size is 1 + size(left) + size(right). select(i) compares i with size(left). If i is smaller, descend left. If i equals size(left), return the current node. If i is larger, subtract size(left) + 1 and descend right.',
        'split(root, k) returns two treaps: the first k items and the rest. If the left subtree size is at least k, split the left child and attach the right result back under the current node. Otherwise split the right child with k - size(left) - 1 and attach the left result back under the current node. Every return updates size.',
        'merge(a, b) combines two adjacent sequences where every item in a must appear before every item in b. If one side is empty, return the other. Otherwise choose the root with the higher priority. If a has the higher priority, set a.right = merge(a.right, b). If b has the higher priority, set b.left = merge(a, b.left). Update size on the way out.',
        'Lazy reverse is a common extension. A reverse flag on a subtree means its logical order is flipped, but the children may not have been physically swapped yet. Before descending, push the flag: swap children and toggle the reverse flag on each child. This keeps range reverse O(log n) without visiting every node in the range.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from preserving two invariants through split and merge. split never changes relative order; it only separates the first k in-order nodes from the rest. merge assumes the two inputs are already adjacent in sequence order, then chooses roots by priority while preserving the in-order concatenation. That is enough to build insert, delete, and move.',
        'Balance comes from independent random priorities. The shape is the same as inserting nodes into a binary search tree in random priority order. With high probability the height is logarithmic, so split and merge touch logarithmic paths. This is expected time, not a deterministic worst-case guarantee.',
        'Ranks are always derived, never trusted as stale labels. If size fields are correct, select(i) and split(k) know how many elements are skipped when they move right. That local rank accounting is what avoids rewriting all positions after a middle edit.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with sequence A B C D E F G. The tree shape is balanced by priorities, but the in-order traversal is the sequence. To insert X at index 3, call split(root, 3). The left result contains A B C. The right result contains D E F G. Create a one-node treap X. The final result is merge(merge(left, X), right), whose in-order traversal is A B C X D E F G.',
        'To move range [2, 5), meaning C D E, to the front, split(root, 2) to get A B and C D E F G. Then split the second part at 3 to get C D E and F G. Remove the middle by merging A B with F G. Then merge C D E before that remainder. The result is C D E A B F G.',
        'To reverse [1, 6), split at 1 and 6 to isolate B C D E F. Toggle the reverse flag on that middle treap. Merge the pieces back. The logical sequence becomes A F E D C B G, and the implementation only touched logarithmic paths plus one lazy flag.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The "rank keys" view shows how position is recovered from subtree sizes. A node does not need a stored index. When the search moves right, it skips the left subtree and the current node by subtracting size(left) + 1. When the search moves left, the target rank is still inside the left subtree.',
        'The "split insert" view shows the main recipe: isolate a boundary by rank, insert a one-node treap, and merge pieces while preserving in-order sequence order. The animation also shows why priorities matter: the new node may become a high node in the tree even though its sequence position is fixed.',
        'The "playlist case study" view shows range editing as composition. Paste, cut, move, and undo are not separate low-level algorithms. They are short recipes built from split, merge, optional lazy tags, and a log of operations or versions.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'With independent random priorities, select, split, merge, insert, delete, move, and lazy range reverse are O(log n) expected time. Rendering k consecutive items is O(log n + k) if the renderer first finds the starting rank and then walks in order. Space is O(n), plus per-node pointer, priority, size, and lazy-tag overhead.',
        'The constants are not as friendly as an array. Nodes are pointer-heavy, less cache-local, and more expensive to allocate. If the workload is mostly append and random access, an array or gap buffer may be faster. If the workload is character-level text, one node per character is usually wasteful; chunked ropes or piece tables often fit better.',
        'The worst case is possible if priorities are adversarial, duplicated badly, or generated from a weak source. Production implementations usually use enough random bits, stable per-node priorities, iterative forms when recursion depth is a concern, and explicit testing for size updates after every pointer mutation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Implicit treaps win when the sequence elements are meaningful units and range edits are common: playlist tracks, timeline clips, cards on a board, syntax nodes, tokens, subtitle segments, image layers, ordered tasks, or chunks in a larger text structure. The structure gives a small API that can express many edits.',
        'They are also useful in competitive programming and algorithm prototyping because split and merge make range operations concise. Add lazy tags for reverse, add aggregate fields for range sums or minimums, add path copying for persistence, and the same skeleton becomes a flexible measured sequence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An implicit treap is not a good fit when deterministic worst-case bounds are required. Randomized balance is usually excellent, but a real-time system may prefer a deterministic balanced tree or a structure with stricter latency guarantees. It is also a poor fit when cache locality dominates and edits are rare.',
        'It fails as a text editor core if it ignores Unicode and storage granularity. Users edit grapheme clusters, not bytes, and serious editors need efficient piece storage, file snapshots, style spans, and collaboration metadata. An implicit treap can manage chunks or spans, but using one node per character is often the wrong abstraction.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common bug is treating the node value as a search key. In an implicit treap, values do not determine tree order. Only in-order position matters. split compares k with size(left), not with the stored value. Mixing explicit-key treap logic into an implicit treap corrupts the sequence.',
        'Other bugs are stale size fields, forgetting to push lazy reverse before descending, merging sequences that are not logically adjacent, applying a destination index after removing a range without adjusting it, recursion stack overflow on a bad tree, and reusing mutable nodes across persistent versions.',
        'Testing should include random operation sequences compared against a plain array oracle. Generate insert, delete, move, reverse, and select operations, then compare traversal after every step. Also test repeated boundaries: split at 0, split at n, move a range before itself, delete the full sequence, and reverse twice.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references are CP-Algorithms on treaps and implicit treaps, OI Wiki treap notes, and the Aragon-Seidel randomized search tree paper. Read those after understanding this article, because the compact code relies on the invariants described here: in-order sequence order, heap priority balance, subtree sizes, and lazy propagation.',
        'Inside this curriculum, study Treap for the randomized tree foundation, Order-Statistics Tree for rank queries, Text Rope Data Structure and Piece Table Text Buffer for editor storage, Finger Tree Measured Sequence for a functional measured-sequence alternative, RRB Tree Persistent Vector for persistent sequence tradeoffs, Sequence CRDTs for Collaborative Text for multi-user ordering, and Segment Tree with Lazy Propagation for range-tag reasoning.',
      ],
    },
  ],
};
