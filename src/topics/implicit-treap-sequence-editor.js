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
  const seqLabels = BASE_NODES.map(n => n.label).sort().join(' ');
  const rootNode = BASE_NODES[0];
  const rootLabel = rootNode.label;
  const rootPriority = rootNode.note.match(/p(\d+)/)[1];
  const nodeCount = BASE_NODES.length;
  const edgeCount = BASE_EDGES.length;
  const targetIdx = 4;
  const targetNode = BASE_NODES.find(n => n.label === 'E');
  const targetLabel = targetNode.label;
  const leftChildLabel = BASE_NODES[1].label;
  const leftSubSize = 3;

  yield {
    state: treapGraph('In-order order is the sequence'),
    highlight: { active: ['d'], found: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
    explanation: `An implicit treap does not store array indexes as keys. The in-order walk is the sequence ${seqLabels}, and subtree sizes tell each of the ${nodeCount} nodes its current position.`,
    invariant: `BST key order is replaced by sequence rank across ${nodeCount} nodes; heap priority (root ${rootLabel} has ${rootPriority}) still balances the tree.`,
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
    explanation: `To select position ${targetIdx}, compare the target index with left subtree size (${leftSubSize} under ${rootLabel}). Equal means current node; smaller goes left; larger subtracts left size plus one and goes right, landing on ${targetLabel}.`,
  };

  yield {
    state: treapGraph('The select path reaches E'),
    highlight: { active: ['d', 'f', 'e', 'e-d-f', 'e-f-e'], found: ['e'], compare: ['b'] },
    explanation: `The lookup path from ${rootLabel} through F to ${targetLabel} is logarithmic in expectation because random priorities keep the ${nodeCount}-node treap balanced. Positions stay correct after edits because every node maintains size = 1 + left size + right size.`,
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
    explanation: `Split and merge become sequence surgery on the ${nodeCount}-node treap connected by ${edgeCount} edges. Insert, delete, move, and reverse are short recipes over position-based splits.`,
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
    explanation: `Implicit treaps are a compact, randomized alternative for editable sequences of ${nodeCount} or more items. Ropes and piece tables are often better for raw text chunks; implicit treaps are excellent for generic items and range operations.`,
  };
}

function* splitInsert() {
  const splitPos = 3;
  const beforeLabels = BASE_NODES.map(n => n.label).sort().slice(0, splitPos).join(' ');
  const afterLabels = BASE_NODES.map(n => n.label).sort().slice(splitPos).join(' ');
  const insertNode = INSERT_NODES.find(n => n.id === 'x');
  const insertLabel = insertNode.label;
  const insertPriority = insertNode.note.match(/p(\d+)/)[1];
  const rootLabel = BASE_NODES[0].label;
  const leftChildLabel = BASE_NODES[1].label;
  const cLabel = BASE_NODES.find(n => n.id === 'c').label;
  const postInsertSeq = INSERT_NODES.map(n => n.label).sort().join(' ');
  const postInsertCount = INSERT_NODES.length;
  const fLabel = INSERT_NODES.find(n => n.id === 'f').label;

  yield {
    state: treapGraph('Split at position 3'),
    highlight: { active: ['d', 'b', 'c'], found: ['a', 'b', 'c'], compare: ['d', 'e', 'f', 'g'] },
    explanation: `To insert at position ${splitPos}, first split the ${BASE_NODES.length}-node sequence into left ${beforeLabels} and right ${afterLabels}. The split walks by left subtree sizes, not by explicit keys.`,
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
    explanation: `Every recursive step through ${rootLabel}, ${leftChildLabel}, ${cLabel} returns two valid treaps. After rewiring one child pointer, update subtree sizes on the way back out.`,
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
    explanation: `The inserted item ${insertLabel} is just a one-node treap with random priority ${insertPriority}. Merge preserves in-order sequence order and heap priority across all ${postInsertCount} nodes.`,
  };

  yield {
    state: treapGraph('After merge: A B C X D E F G', true),
    highlight: { found: ['x'], active: ['d', 'x', 'b', 'e-d-x', 'e-x-b'], compare: ['f'] },
    explanation: `${insertLabel} lands between ${cLabel} and ${rootLabel} in in-order order. Its priority ${insertPriority} makes it the root of the left side under ${rootLabel}, but the sequence order remains ${beforeLabels} ${insertLabel} ${afterLabels} (${postInsertCount} nodes, ${INSERT_EDGES.length} edges).`,
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
    explanation: `The same split/merge primitives used on the ${postInsertCount}-node treap can power an editor, playlist, timeline, or card board. Persistence is optional: path-copying can keep old versions when undo or snapshots matter.`,
  };
}

function* playlistCaseStudy() {
  const playlistTracks = ['intro', 'verse', 'hook', 'solo', 'outro', 'ad'];
  const trackCount = playlistTracks.length;
  const moveStart = 1;
  const moveEnd = 3;
  const moveDest = 4;
  const movedItems = playlistTracks.slice(moveStart, moveEnd).join(', ');
  const reverseSubtreeRoot = BASE_NODES[0].label;
  const reverseLeftChild = BASE_NODES[1].label;
  const baseNodeCount = BASE_NODES.length;

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
    explanation: `A playlist of ${trackCount} tracks (${playlistTracks.join(', ')}) is an editable sequence. Users insert, delete, and move ranges by position while the UI needs fast access by index.`,
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
    explanation: `Range move of ${movedItems} (positions [${moveStart},${moveEnd})) after index ${moveDest} is split, split, split, then merge in the new order. The treap never shifts a whole array tail one slot at a time.`,
  };

  yield {
    state: treapGraph('Lazy reverse marks a subtree instead of swapping every item'),
    highlight: { active: ['b', 'a', 'c'], found: ['d'], compare: ['f', 'g'] },
    explanation: `A reverse flag can sit on a subtree rooted at ${reverseSubtreeRoot} (with ${reverseLeftChild}'s ${BASE_NODES[1].note.match(/sz(\d+)/)[1]}-node subtree below). When traversal or another split descends into it, the flag swaps children and propagates downward. That makes range reverse logarithmic plus touched boundaries.`,
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
    explanation: `For a ${baseNodeCount}-node treap, access, insert, and move are O(log ${baseNodeCount}). Rendering k visible rows still visits those k rows. Pair the treap with virtualization for large UI lists.`,
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
    explanation: `The implementation across ${baseNodeCount} nodes and ${BASE_EDGES.length} edges is small but sharp-edged: priorities must balance, sizes must update after every pointer change, and lazy tags must be pushed before decisions that depend on child order.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The animation shows a sequence stored inside a binary tree. In-order traversal means read left subtree, then node, then right subtree; that traversal is the visible sequence order. Active nodes are on the split, merge, or select path, and size labels tell how many items live under a node.',
        {type: 'image', src: './assets/gifs/implicit-treap-sequence-editor.gif', alt: 'Animated walkthrough of the implicit treap sequence editor visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that a node position is not stored as a permanent index. Its rank is derived from the size of its left subtree plus the ranks of ancestors. When the animation updates only a few size fields, it is repairing positions locally.',
      ], },
    { heading: 'Why this exists', paragraphs: [
        'Editors and timelines store ordered sequences that change in the middle. A text editor inserts spans, a playlist moves songs, and a video editor cuts clips. Arrays give fast indexing but middle edits shift many elements.',
        {type: 'callout', text: 'An implicit treap stores sequence position as subtree size accounting, so edits repair local ranks instead of rewriting global indexes.'},
        'An implicit treap supports rank-based select, insert, delete, move, and reverse in expected logarithmic time. It is implicit because the key is not stored as a field. Position comes from subtree sizes during traversal.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is an array. select(i) is O(1), iteration is cache-friendly, and appending is cheap. It is excellent when edits are mostly at the end.',
        'A linked list is the obvious fix for local insertion and deletion. It edits a known node cheaply, but finding index 100,000 requires walking. Range operations need both fast position lookup and local surgery.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Vector_Rope_example.svg/500px-Vector_Rope_example.svg.png', alt: 'Rope data structure example with string chunks stored in a tree', caption: 'Ropes solve a related editor problem by storing sequence chunks in a tree; implicit treaps use a randomized tree with rank-derived positions. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Vector_Rope_example.svg'},
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is that numeric positions change after every middle edit. If every element stores index, inserting one item at the front invalidates every later index. If the structure stores only next pointers, index lookup becomes linear.',
        'Real editors also need range surgery, not just single-item insert. Delete [l, r), move [l, r) to j, reverse a range, or tag a span for styling should not loop over every item. The data structure needs local boundary operations.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Use a treap whose in-order order is the sequence. A treap is a binary tree with search-tree order plus random heap priorities for balance. In an implicit treap, search keys are replaced by subtree sizes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/TreapAlphaKey.svg/500px-TreapAlphaKey.svg.png', alt: 'Treap diagram showing key order and heap priorities', caption: 'A treap combines binary-search order with heap priority. In an implicit treap, the visible keys are replaced by in-order rank derived from subtree sizes. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:TreapAlphaKey.svg'},
        'Two invariants drive the structure. In-order traversal equals sequence order. Heap priority keeps the tree balanced in expectation. Subtree size lets rank operations skip whole subtrees without storing global indexes.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Each node stores value, random priority, left child, right child, subtree size, and optional lazy tags. size(node) = 1 + size(left) + size(right). select(i) compares i with size(left) to decide whether to go left, return the node, or skip left plus current and go right.',
        'split(root, k) returns two treaps: the first k items and the rest. merge(a, b) combines two adjacent sequences by choosing the root with higher priority and recursing into one child. Insert, delete, and move are short recipes made from split and merge.',
        'Lazy reverse stores a flag on a subtree instead of visiting every node immediately. Before descending, push the flag by swapping children and toggling child flags. That makes range reverse logarithmic plus delayed local work.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'split preserves order because it only separates the first k in-order nodes from the rest. merge preserves order because it assumes every item in a comes before every item in b, then chooses roots by priority without interleaving the two sequences. Those two operations are enough to build sequence edits.',
        'Ranks stay correct because every pointer change recomputes size on the return path. A select or split call can skip an entire left subtree because size(left) is exact. Random priorities make the expected height O(log n), so the edited paths are short on average.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'select, split, merge, insert, delete, move, and lazy reverse are O(log n) expected time with independent priorities. Rendering k consecutive items is O(log n + k): find the start, then traverse k items. Space is O(n) nodes plus pointer, priority, size, and tag fields.',
        'The cost is behavior, not just notation. Inserting at the front of a 1,000,000-item array shifts 1,000,000 items; an implicit treap updates about log2(1,000,000), roughly 20, nodes in expectation. The tax is pointer chasing, allocation, weaker cache locality, and randomized rather than deterministic worst-case balance.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Implicit treaps fit ordered objects where middle edits and range moves are common: playlists, timeline clips, card boards, subtitles, image layers, and token streams. The elements should be meaningful chunks, not necessarily single bytes or characters.',
        'They are also common in competitive programming and prototypes because split and merge make range recipes compact. Add aggregate fields for sums or minimums, lazy tags for reversals, or path copying for persistence, and the same skeleton becomes a measured sequence.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It is a poor fit when deterministic worst-case latency is required. Random priorities are usually good, but real-time systems may prefer deterministic balanced trees. Arrays or gap buffers can beat it when cache locality matters and edits are rare.',
        'A text editor should not blindly use one node per character. Unicode grapheme clusters, piece storage, file snapshots, style spans, and collaborative metadata matter. An implicit treap can manage chunks or spans, but it is not a complete editor architecture by itself.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Start with sequence A B C D E F G. To insert X at index 3, split(root, 3) into A B C and D E F G. Create node X, then merge(merge(left, X), right). The traversal becomes A B C X D E F G.',
        'To move range [2, 5), meaning C D E, to the front, split at 2 into A B and C D E F G. Split the second treap at 3 into C D E and F G. Merge A B with F G, then merge C D E before that result. The final sequence is C D E A B F G.',
        'To reverse [1, 6), isolate B C D E F with two splits and toggle its reverse flag. Merging the pieces back gives logical sequence A F E D C B G. The implementation touches logarithmic boundary paths plus one lazy flag, not every item immediately.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Study CP-Algorithms on treaps and implicit treaps, OI Wiki treap notes, and Aragon-Seidel randomized search trees for the balancing argument. These sources cover the split/merge implementation details behind the article.',
        'Study treaps, order-statistics trees, ropes, piece tables, finger trees, RRB trees, lazy segment trees, and sequence CRDTs next. Each solves a different version of ordered sequence editing, persistence, or collaboration.',
      ], },
  ],
};
