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
      heading: 'What It Is',
      paragraphs: [
        'A piece table is a text-buffer representation for editors. It stores the file as two immutable byte sources: the original buffer loaded from disk and an append-only add buffer containing inserted text.',
        'The visible document is not stored as one mutable string. It is stored as an ordered list of piece descriptors. Each descriptor names a source buffer, a start offset, and a length. Rendering the document means reading those slices in descriptor order.',
        'Production editors often use a piece tree rather than a plain list. The tree keeps pieces ordered while storing subtree lengths and line-break counts, so the editor can jump from offset to line and from line to viewport without scanning the whole file.',
      ],
    },
    {
      heading: 'The Baseline and the Wall',
      paragraphs: [
        'The simplest editor buffer is one mutable character array or string. Insert in the middle, shift the suffix. Delete a range, shift again. This is easy to explain but expensive for large files, and it makes undo fight the same storage that holds the current text.',
        'A gap buffer improves local typing by keeping free space near the cursor. It is good when edits cluster near one point, but moving the gap across a large file can be costly. A rope improves split and concatenate, but it does not automatically preserve the original file and every inserted span as stable sources.',
        'The wall is that an editor needs more than a current string. It needs startup to be cheap, undo to be reliable, line lookup to be fast, deleted text to remain recoverable, and saving to write the current view without rewriting source buffers after every keystroke.',
      ],
    },
    {
      heading: 'Core Insight and Invariant',
      paragraphs: [
        'Never move old bytes. Keep the original file immutable, append every insertion to the add buffer, and describe the current document with pieces. Editing becomes descriptor surgery instead of bulk text movement.',
        'The main invariant is that rendered text equals the concatenation of all pieces in order. A piece is valid only if its source buffer, start offset, and length name a real slice. The source-buffer order is irrelevant; descriptor order is the document order.',
        'Undo is natural because old bytes are still present. Deleting text can remove or shorten descriptors without erasing the referenced bytes. Inserting text appends new bytes once and adds a descriptor that can later be removed, restored, or reused by redo.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the "insert pieces" view, focus on the split. Inserting "brave " into "hello world" does not rewrite "hello world". The original piece is split into "hello " and "world", the inserted text is appended to the add buffer, and a new piece points at that add-buffer slice.',
        'The piece tree frame shows why a real editor does not stop at a linked list. A long editing session can create many pieces. A balanced tree with lengths and line counts keeps random access, line navigation, and viewport rendering from degrading into full-list scans.',
        'In the "undo and indexing" view, notice that undo restores descriptor state, not erased bytes. The bytes are retained in the original and add buffers, so undo and redo mostly change which slices are visible.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Opening a file creates one original buffer and one initial piece covering that buffer. The add buffer starts empty. The document may already be usable before the editor has copied or normalized the whole file into a separate mutable string.',
        'Insertion finds the piece containing the edit offset. If the edit is in the middle of a piece, that piece is split into left and right pieces. The inserted text is appended to the add buffer, and a new add-buffer piece is spliced between the left and right pieces.',
        'Deletion finds the covered range and removes, shortens, or splits the affected descriptors. Replacement is deletion plus insertion. Rendering, saving, tokenization, and search read the visible slices in descriptor order.',
      ],
    },
    {
      heading: 'Why It Is Correct',
      paragraphs: [
        'Correctness follows from slice preservation. Source buffers are append-only or read-only, so a descriptor that was valid remains valid until the editor deliberately removes it from the visible order. Splitting a descriptor into two adjacent descriptors preserves the same rendered text.',
        'Insertion is correct because it preserves the left slice, inserts a descriptor for exactly the new bytes, and preserves the right slice. Deletion is correct because it removes the descriptors or descriptor subranges that correspond to the deleted visible interval.',
        'Indexing is correct when subtree metadata is maintained after every tree edit. The stored character counts and line counts must equal the rendered content under each subtree; then offset and line lookup can descend by comparing the target with left-subtree totals.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'A plain piece list makes local descriptor edits cheap but can make random offset lookup O(number of pieces). A piece tree adds balancing overhead, but it gives logarithmic search by offset or line when metadata is maintained correctly.',
        'The main practical cost is fragmentation. Many small edits can create many tiny pieces, especially around repeated insert/delete activity. Editors often coalesce adjacent compatible pieces and tune tree nodes to reduce pointer overhead and improve cache behavior.',
        'A piece table does not make whole-document operations free. Full save, full search, formatting, and full re-tokenization still walk visible text. The win is that many common edits, undo operations, and viewport reads can avoid copying or scanning the entire document.',
        'Line endings, Unicode indexing, and CRLF boundaries are real engineering details. The buffer may count bytes, UTF-16 code units, Unicode scalar values, grapheme clusters, and lines differently depending on editor APIs.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Start with original buffer "hello world" and one piece orig[0..11]. To insert "brave " after "hello ", append "brave " to the add buffer at add[0..6].',
        'Split the original piece at offset 6. The visible descriptor order becomes orig[0..6], add[0..6], orig[6..11]. Rendering those slices gives "hello brave world". The original buffer still contains exactly "hello world".',
        'If the user undoes the insertion, the editor can restore the old descriptor list with one original piece. The add buffer still contains "brave ", so redo can reinsert the same descriptor without recovering text from a deleted region.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Piece tables win in text editors and IDEs that open large files, preserve original bytes, support undo and redo, and render small viewports repeatedly. They also fit diff tools and document systems where stable references to original and inserted text are useful.',
        'They fail when a simpler representation is enough. A tiny text field may not need descriptor trees. A gap buffer can be simpler and faster for strongly cursor-local editing. A rope may be a better fit when the main operation is split and concatenate of large independently owned chunks.',
        'They are also not a full collaborative editing algorithm. A Sequence CRDT or Operational Transformation layer can decide how remote operations merge; the piece table is the local storage layer that makes the resulting visible sequence efficient to edit and render.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Sources: Visual Studio Code text buffer reimplementation at https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation and Charles Crowley, Data Structures for Text Sequences, linked from https://www.cs.unm.edu/~crowley/papers/sds.pdf.',
        'Study Gap Buffer Text Editor for the cursor-local baseline, Text Rope Data Structure for tree-based string chunks, Implicit Treap Sequence Editor for positional split/merge on generic sequences, Red-Black Tree or Splay Tree for balanced indexing, and Sequence CRDTs or Operational Transformation Collaborative Editing Case Study for remote edit ordering above the buffer.',
      ],
    },
  ],
};
