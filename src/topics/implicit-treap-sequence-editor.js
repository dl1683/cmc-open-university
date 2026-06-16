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
      heading: 'What it is',
      paragraphs: [
        'An implicit treap is a treap used as an indexed sequence. It keeps random heap priorities for balance, but it does not store explicit search keys. Instead, each node stores subtree size, and the node position is implied by how many items are in its left subtree and ancestors.',
        'That makes array-like positions compatible with treap split and merge. Insert at index i, delete a range, move a block, reverse a range, or cut a playlist segment by splitting around positions and merging the pieces back in a new order.',
        'The structure sits between Treap, Order-Statistics Tree, Text Rope Data Structure, Piece Table Text Buffer, and Finger Tree Measured Sequence. It is not always the best text-editor structure, but it is a clean general-purpose sequence surgery tool.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores value, random priority, left child, right child, subtree size, and optional lazy tags such as reverse. The in-order traversal is the sequence. select(i) compares i with size(left). If i is smaller, go left. If i equals size(left), the current node is the answer. If i is larger, subtract size(left) + 1 and go right.',
        'split(root, k) returns two treaps: the first k items and the remaining items. merge(left, right) combines two adjacent sequences by choosing the higher-priority root and recursively merging one child. Both operations update subtree sizes on the way out.',
        'Operations become recipes. Insert is split at i, merge with the new one-node treap, then merge the right side. Delete is split at l and r, discard the middle, then merge the sides. Move is cut the middle range, split the destination, then merge in the desired order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With independent random priorities, access by index, split, merge, insert, delete, move, and lazy range reverse are O(log n) expected time, plus the number of produced or rendered items. Space is O(n).',
        'The worst case is still possible if priorities are poor or adversarial. Production implementations should generate stable priorities with enough bits, update sizes after every pointer mutation, and push lazy tags before comparing child order or descending.',
        'For character-level text, one node per character is usually too much overhead. Use chunks, ropes, or piece tables for raw text, and use an implicit treap when the sequence elements are already meaningful units such as cards, tracks, spans, tokens, clips, or chunks.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A collaborative media editor stores a timeline as a sequence of clips. Users drag a range, paste a new clip at a position, reverse a selected run, or delete an advertisement slot. A flat array makes middle edits shift many entries. A linked list makes indexing slow. An implicit treap splits by position and merges ranges back together in expected logarithmic time.',
        'For a move operation, split before the selected range, split after it, split at the destination in the remaining sequence, and merge the pieces in the new order. The UI can keep a visible-window renderer on top, asking select(i) for visible rows while edits update the underlying sequence.',
        'Undo can be implemented as an operation log or with path-copying persistence. Since split and merge only change nodes along logarithmic paths, persistent versions can share most of the old treap, similar in spirit to Persistent Segment Tree and RRB Tree Persistent Vector.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An implicit treap is not a binary search tree over values. If you compare item values while splitting by position, the structure is wrong. Rank comes only from subtree sizes.',
        'Lazy reversal is another common bug source. Before descending, push the reverse flag so left and right children reflect the logical order. Otherwise select, split, or traversal can silently return the wrong sequence.',
        'Do not use one node per Unicode character for a serious editor without thinking about grapheme clusters and chunking. Text Rope Data Structure and Piece Table Text Buffer handle large text buffers more directly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: CP-Algorithms Treap, including implicit treaps, at https://cp-algorithms.com/data_structures/treap.html, OI Wiki treap notes at https://oi-wiki.org/ds/treap/, and Aragon and Seidel randomized search trees at https://faculty.washington.edu/aragon/pubs/rst89.pdf.',
        'Study Treap, Order-Statistics Tree, Text Rope Data Structure, Piece Table Text Buffer, Finger Tree Measured Sequence, RRB Tree Persistent Vector, and Sequence CRDTs for Collaborative Text next.',
      ],
    },
  ],
};
