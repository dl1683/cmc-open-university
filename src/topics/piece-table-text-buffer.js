// Piece table: original buffer + append-only add buffer + piece descriptors.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'piece-table-text-buffer',
  title: 'Piece Table Text Buffer',
  category: 'Data Structures',
  summary: 'A text-editor buffer: keep the original file immutable, append all inserted text to an add buffer, and render through ordered piece descriptors.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['insert pieces', 'undo and indexing'], defaultValue: 'insert pieces' },
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

function pieceGraph(title) {
  return graphState({
    nodes: [
      { id: 'orig', label: 'original buffer', x: 0.9, y: 2.0, note: 'read-only file text' },
      { id: 'add', label: 'add buffer', x: 0.9, y: 5.0, note: 'append-only inserts' },
      { id: 'p1', label: 'piece 1', x: 3.4, y: 1.6, note: 'orig 0..6' },
      { id: 'p2', label: 'piece 2', x: 3.4, y: 3.4, note: 'add 0..6' },
      { id: 'p3', label: 'piece 3', x: 3.4, y: 5.2, note: 'orig 6..end' },
      { id: 'tree', label: 'piece tree', x: 6.0, y: 3.4, note: 'ordered descriptors' },
      { id: 'render', label: 'rendered text', x: 8.5, y: 3.4, note: 'concatenate pieces' },
    ],
    edges: [
      { id: 'e-orig-p1', from: 'orig', to: 'p1', weight: 'slice' },
      { id: 'e-add-p2', from: 'add', to: 'p2', weight: 'slice' },
      { id: 'e-orig-p3', from: 'orig', to: 'p3', weight: 'slice' },
      { id: 'e-p1-tree', from: 'p1', to: 'tree', weight: 'order' },
      { id: 'e-p2-tree', from: 'p2', to: 'tree', weight: 'order' },
      { id: 'e-p3-tree', from: 'p3', to: 'tree', weight: 'order' },
      { id: 'e-tree-render', from: 'tree', to: 'render', weight: 'iterate' },
    ],
  }, { title });
}

function* insertPieces() {
  yield {
    state: pieceGraph('A piece table references immutable buffers'),
    highlight: { active: ['orig', 'add', 'p1', 'p2', 'p3'], compare: ['tree'] },
    explanation: 'A piece table keeps the original file unchanged and appends inserted text to a separate add buffer. The document is an ordered list of piece descriptors pointing into those buffers.',
    invariant: 'Pieces reference source buffers by start and length; editing changes descriptors, not old bytes.',
  };

  yield {
    state: labelMatrix(
      'Insert "brave " into "hello world"',
      [
        { id: 'before', label: 'before' },
        { id: 'split', label: 'split original piece' },
        { id: 'append', label: 'append add buffer' },
        { id: 'after', label: 'after' },
      ],
      [
        { id: 'pieces', label: 'pieces' },
        { id: 'visible' },
      ],
      [
        ['orig[0..11]', 'hello world'],
        ['orig[0..6] | orig[6..11]', 'hello | world'],
        ['add[0..6]', 'brave '],
        ['orig[0..6] | add[0..6] | orig[6..11]', 'hello brave world'],
      ],
    ),
    highlight: { active: ['split:pieces', 'append:pieces'], found: ['after:visible'] },
    explanation: 'Insertions split the piece that contains the edit point, append inserted bytes to the add buffer, and splice a new descriptor into the piece list.',
  };

  yield {
    state: pieceGraph('A piece tree indexes the descriptor list'),
    highlight: { active: ['p1', 'p2', 'p3', 'tree', 'e-p1-tree', 'e-p2-tree', 'e-p3-tree'], found: ['render'] },
    explanation: 'A plain piece table can become a long list. A piece tree stores descriptors in a balanced tree with line counts and lengths, enabling fast line and offset lookup.',
  };

  yield {
    state: labelMatrix(
      'Edit operations',
      [
        { id: 'insert', label: 'insert' },
        { id: 'delete', label: 'delete' },
        { id: 'replace', label: 'replace' },
        { id: 'save', label: 'save' },
      ],
      [
        { id: 'descriptorMove', label: 'descriptor move' },
        { id: 'bufferMove', label: 'buffer move' },
      ],
      [
        ['split + add piece', 'append only'],
        ['remove or shorten pieces', 'old bytes remain'],
        ['delete + insert', 'append new bytes'],
        ['stream pieces', 'write new file'],
      ],
    ),
    highlight: { found: ['insert:bufferMove', 'delete:descriptorMove', 'save:descriptorMove'], compare: ['replace:bufferMove'] },
    explanation: 'The old content and inserted content remain available. Edits are descriptor changes, which is why piece tables are friendly to undo and redo.',
  };
}

function* undoAndIndexing() {
  yield {
    state: labelMatrix(
      'Undo story',
      [
        { id: 'insert', label: 'insert text' },
        { id: 'record', label: 'record descriptor delta' },
        { id: 'undo', label: 'undo' },
        { id: 'redo', label: 'redo' },
      ],
      [
        { id: 'data', label: 'data retained' },
        { id: 'operation' },
      ],
      [
        ['add buffer keeps bytes', 'splice descriptor'],
        ['old pieces still known', 'store inverse edit'],
        ['restore descriptors', 'no byte recovery needed'],
        ['reapply descriptors', 'reuse add buffer slice'],
      ],
    ),
    highlight: { active: ['record:operation', 'undo:operation', 'redo:operation'], found: ['insert:data'] },
    explanation: 'Undo can restore old descriptors because neither the original buffer nor add buffer has to be overwritten. The history is mostly structural.',
  };

  yield {
    state: pieceGraph('Line metadata makes editor navigation fast'),
    highlight: { active: ['tree', 'render'], found: ['p1', 'p2', 'p3'], compare: ['orig', 'add'] },
    explanation: 'Editors need line lookup, cursor movement, decorations, and viewport rendering. A piece tree augments each node with character and line counts so offsets and lines map quickly.',
    invariant: 'Rendered order is descriptor order, independent of source-buffer order.',
  };

  yield {
    state: labelMatrix(
      'Piece table versus neighbors',
      [
        { id: 'gap', label: 'gap buffer' },
        { id: 'rope', label: 'rope' },
        { id: 'piece', label: 'piece table' },
        { id: 'flat', label: 'flat string' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'risk' },
      ],
      [
        ['near-cursor edits', 'moving gap is costly'],
        ['large split/concat', 'tree overhead'],
        ['file edits and undo', 'descriptor fragmentation'],
        ['simple scanning', 'large edits copy'],
      ],
    ),
    highlight: { found: ['piece:best', 'rope:best'], compare: ['flat:risk'] },
    explanation: 'The piece table is especially compelling for editors because it preserves the original file and all inserted text while making undo and incremental saves tractable.',
  };

  yield {
    state: labelMatrix(
      'Complete editor case study',
      [
        { id: 'open', label: 'open file' },
        { id: 'type', label: 'type text' },
        { id: 'delete', label: 'delete paragraph' },
        { id: 'render', label: 'render viewport' },
      ],
      [
        { id: 'structureMove', label: 'structure move' },
        { id: 'lesson' },
      ],
      [
        ['one original piece', 'fast startup'],
        ['append add buffer', 'no rewrite original'],
        ['hide descriptors', 'undo remains possible'],
        ['walk visible pieces', 'viewport only'],
      ],
    ),
    highlight: { found: ['open:lesson', 'type:lesson', 'render:lesson'], compare: ['delete:lesson'] },
    explanation: 'The production story is VS Code style: a piece table/tree keeps startup memory low, edits local, line lookup indexed, and undo cheap.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'insert pieces') yield* insertPieces();
  else if (view === 'undo and indexing') yield* undoAndIndexing();
  else throw new InputError('Pick a piece-table view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A piece table is a text-buffer data structure used by editors. It keeps the original file in one immutable buffer, appends every insertion to an add buffer, and represents the visible document as ordered descriptors called pieces.',
        'Each piece says which buffer to read from, the start offset, and the length. Editing changes the piece descriptors. The old bytes remain available, which makes undo, redo, and incremental editing natural.',
        'A production editor usually turns the table into a piece tree: a balanced tree of pieces augmented with character counts and line-break counts for fast offset and line lookup.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On open, the table has one piece covering the whole original buffer. On insert, append the new text to the add buffer, split the piece at the insertion point, and splice in a descriptor for the inserted text. On delete, shorten or remove descriptors without touching source buffers.',
        'Rendering walks pieces in order and reads slices from original or add buffer. Saving streams those visible slices into a new file. Undo can record inverse descriptor changes rather than reconstructing deleted bytes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is descriptor management. Many tiny edits can fragment the piece list, so balanced indexing and coalescing adjacent pieces matter. A piece tree adds implementation complexity but keeps lookup and viewport rendering efficient.',
        'The data structure is excellent for preserving edit history, but it does not make full-document operations free. Search, save, formatting, and tokenization still need to walk visible text, though they can often do so incrementally.',
        'Line ending normalization is another practical detail. Editors often need to preserve original line endings, map offsets to line and column positions, and handle edits that introduce new line breaks across piece boundaries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Piece tables and piece trees are used in text editors, IDEs, document systems, diff tools, and collaborative editing engines that need efficient insertion, deletion, undo, and file preservation. In collaborative editors, this local buffer layer can sit underneath Sequence CRDTs and Peritext-style rich-text merge logic.',
        'A complete case study is opening a large source file in an IDE. The original file becomes one buffer. Typing appends to the add buffer. Edits update pieces. The viewport renders only visible lines, and undo restores previous descriptors. In a collaborative editor, Operational Transformation Collaborative Editing Case Study or Sequence CRDTs for Collaborative Text can sit above this local buffer and decide how remote edits are rebased into the visible document.',
        'Implicit Treap Sequence Editor is the nearby structure when the editable sequence is made of generic items, spans, clips, cards, or chunks rather than original/add text buffers. Both use ordered descriptors; the piece table optimizes text preservation, while the implicit treap optimizes split/merge range surgery by position.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A piece table is not just a linked list if line lookup must be fast. Without an index, jumping to line 100000 can require scanning many pieces. A piece tree solves that by storing lengths and line counts in balanced-tree nodes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Visual Studio Code text buffer reimplementation at https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation and Charles Crowley, Data Structures for Text Sequences, linked from https://www.cs.unm.edu/~crowley/papers/sds.pdf. Study Implicit Treap Sequence Editor, Gap Buffer Text Editor, Text Rope Data Structure, Red-Black Tree, Splay Tree, Persistent Segment Tree, Sequence CRDTs, Operational Transformation Collaborative Editing Case Study, and Peritext Rich-Text CRDT Case Study next.',
      ],
    },
  ],
};
