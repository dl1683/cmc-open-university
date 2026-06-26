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
  const original = 'hello world';
  const insertion = 'brave ';
  const splitPos = 6;

  yield {
    state: pieceGraph('A piece table references immutable buffers'),
    highlight: { active: ['orig', 'add', 'p1', 'p2', 'p3'], compare: ['tree'] },
    explanation: `A piece table keeps the original file ("${original}", ${original.length} chars) unchanged and appends inserted text to a separate add buffer. The document is an ordered list of piece descriptors pointing into those buffers.`,
    invariant: `Pieces reference source buffers by start and length; editing changes descriptors, not the ${original.length} original bytes.`,
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
    explanation: `Inserting "${insertion}" at position ${splitPos} splits the original piece at that offset. The ${insertion.length}-char insertion is appended to the add buffer, producing "${original.slice(0, splitPos)}${insertion}${original.slice(splitPos)}".`,
  };

  yield {
    state: pieceGraph('A piece tree indexes the descriptor list'),
    highlight: { active: ['p1', 'p2', 'p3', 'tree', 'e-p1-tree', 'e-p2-tree', 'e-p3-tree'], found: ['render'] },
    explanation: `A plain piece table can become a long list. After this single insertion the table already has 3 pieces; a piece tree stores descriptors in a balanced tree with line counts and lengths, enabling fast line and offset lookup.`,
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
    explanation: `The old content ("${original}") and inserted content ("${insertion}") remain available. Edits are descriptor changes, which is why piece tables are friendly to undo and redo.`,
  };
}

function* undoAndIndexing() {
  const bufferTypes = ['gap buffer', 'rope', 'piece table', 'flat string'];
  const bufferCount = bufferTypes.length;

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
    explanation: `Undo can restore old descriptors because neither the original buffer nor the add buffer has to be overwritten. Both buffers are immutable once written, so the history is purely structural.`,
  };

  yield {
    state: pieceGraph('Line metadata makes editor navigation fast'),
    highlight: { active: ['tree', 'render'], found: ['p1', 'p2', 'p3'], compare: ['orig', 'add'] },
    explanation: `Editors need line lookup, cursor movement, decorations, and viewport rendering. A piece tree augments each node with character and line counts so offsets and lines map quickly across all ${bufferCount} buffer types.`,
    invariant: `Rendered order is descriptor order, independent of source-buffer order — the same ${bufferCount} buffer strategies (${bufferTypes.join(', ')}) each solve this differently.`,
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
    explanation: `Among ${bufferCount} common buffer strategies (${bufferTypes.join(', ')}), the piece table is especially compelling for editors because it preserves the original file and all inserted text while making undo and incremental saves tractable.`,
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
    explanation: `The production story is VS Code style: a piece table/tree keeps startup memory low, edits local, line lookup indexed, and undo cheap — outperforming the other ${bufferCount - 1} buffer strategies for this workload.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'Read the graph as three things: immutable source buffers, ordered piece descriptors, and rendered text. Active pieces are descriptors being split, inserted, removed, or walked for rendering.',
        {type: 'callout', text: 'A piece table makes editing structural: old bytes stay fixed while descriptors decide which slices are visible.'},
        {type: 'image', src: './assets/gifs/piece-table-text-buffer.gif', alt: 'Animated walkthrough of the piece table text buffer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'A piece table is a text-buffer structure for editors. It exists because an editor needs cheap inserts, reliable undo, stable references to old text, and fast rendering without rewriting the whole file after each keystroke.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is one mutable string or character array. Insert in the middle by shifting the suffix, delete by shifting again, and store undo data separately.',
      ], },
    { heading: 'The wall', paragraphs: [
        'Large middle edits make bulk shifting expensive. Undo also fights the current buffer because deleted or overwritten bytes must be copied somewhere else before they disappear.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Never move old bytes. Keep the original buffer read-only, append inserted text to an add buffer, and make the visible document an ordered list of pieces that name source, start, and length.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Opening a file creates one original buffer and one initial piece covering it. Inserting text appends the new bytes to the add buffer, splits the piece at the edit point, and splices in a descriptor for the new slice.',
        {type: 'image', src: 'https://code.visualstudio.com/assets/blogs/2018/03/23/piece-tree.gif', alt: 'Animation of a piece tree walking original and added text buffers through piece descriptors', caption: 'VS Code uses a piece tree to index piece descriptors and line metadata for editor workloads. Source: Visual Studio Code blog, https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation.'},
        'Deleting text removes, shortens, or splits descriptors but does not erase source bytes. A production piece tree stores descriptors in a balanced tree with character counts and line counts for offset and viewport lookup.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The invariant is that rendered text equals the concatenation of all pieces in descriptor order. Splitting a piece into adjacent left and right pieces preserves the same text, while insertion adds exactly one new visible slice between them.',
        'Undo works because source buffers are immutable. Restoring an old descriptor list restores the old document view without recovering bytes from a destroyed buffer.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'A plain piece list can make offset lookup O(number of pieces). A balanced piece tree adds update overhead but makes offset, line, and viewport navigation logarithmic when subtree metadata is maintained.',
        'The main behavioral cost is fragmentation. Many small edits create many small pieces, so editors coalesce adjacent compatible descriptors and tune tree nodes for cache behavior.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Piece tables fit text editors and IDEs that open large files, keep undo history, preserve original bytes, and render small visible windows repeatedly. VS Code uses a piece-tree design for this workload shape.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'A tiny text field may not need a descriptor tree. A gap buffer can be simpler for strongly cursor-local editing, and a rope can be better when the main operation is split and concatenate of large independent chunks.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Start with original buffer "hello world" and one descriptor orig[0..11]. Insert "brave " after position 6 by appending those six characters to add[0..6].',
        'The visible descriptor order becomes orig[0..6], add[0..6], orig[6..11]. Rendering those slices gives "hello brave world", while undo can restore the single original descriptor and redo can reuse the add-buffer slice.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources include the Visual Studio Code text buffer reimplementation at https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation and Charles Crowley, Data Structures for Text Sequences, https://www.cs.unm.edu/~crowley/papers/sds.pdf.',
        'Study Gap Buffer Text Editor, Text Rope Data Structure, Implicit Treap Sequence Editor, Red-Black Tree, Splay Tree, Sequence CRDTs, and Operational Transformation next.',
      ], },
  ],
};
