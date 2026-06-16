// Gap buffer: a flat text buffer with an empty gap at the cursor, optimized
// for bursts of local editing and simple editor implementations.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'gap-buffer-text-editor',
  title: 'Gap Buffer Text Editor',
  category: 'Data Structures',
  summary: 'A text-editor buffer that keeps unused space at the cursor so local inserts and deletes are cheap while distant cursor jumps copy text to move the gap.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['move the gap', 'editor tradeoffs'], defaultValue: 'move the gap' },
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

function gapGraph(title) {
  return graphState({
    nodes: [
      { id: 'left', label: 'left span', x: 1.2, y: 3.5, note: 'before cursor' },
      { id: 'gap', label: 'gap', x: 3.0, y: 3.5, note: 'free space' },
      { id: 'right', label: 'right span', x: 4.8, y: 3.5, note: 'after cursor' },
      { id: 'cursor', label: 'cursor', x: 3.0, y: 1.5, note: 'at gap start' },
      { id: 'insert', label: 'insert', x: 1.2, y: 1.5, note: 'type chars' },
      { id: 'move', label: 'move gap', x: 6.7, y: 1.5, note: 'memmove' },
      { id: 'grow', label: 'grow', x: 6.7, y: 5.4, note: 'realloc' },
      { id: 'render', label: 'render', x: 8.6, y: 3.5, note: 'left + right' },
    ],
    edges: [
      { id: 'e-left-gap', from: 'left', to: 'gap' },
      { id: 'e-gap-right', from: 'gap', to: 'right' },
      { id: 'e-cursor-gap', from: 'cursor', to: 'gap' },
      { id: 'e-insert-gap', from: 'insert', to: 'gap' },
      { id: 'e-right-move', from: 'right', to: 'move' },
      { id: 'e-move-gap', from: 'move', to: 'gap' },
      { id: 'e-gap-grow', from: 'gap', to: 'grow' },
      { id: 'e-left-render', from: 'left', to: 'render' },
      { id: 'e-right-render', from: 'right', to: 'render' },
    ],
  }, { title });
}

function* moveTheGap() {
  yield {
    state: gapGraph('One array is split into left span, gap, and right span'),
    highlight: { active: ['left', 'gap', 'right', 'cursor', 'e-left-gap', 'e-gap-right', 'e-cursor-gap'], compare: ['insert', 'move', 'grow'] },
    explanation: 'A gap buffer is one array split into two real spans with an unused gap between them. The cursor lives at the start of the gap, so typing can fill free slots without shifting the suffix.',
    invariant: 'Rendered text is left span plus right span; bytes inside the gap are ignored.',
  };

  yield {
    state: gapGraph('Typing consumes the gap'),
    highlight: { active: ['insert', 'gap', 'cursor', 'e-insert-gap', 'e-cursor-gap'], found: ['left'] },
    explanation: 'Insertion at the cursor is cheap while the gap has space: write the new characters into gap_start, advance gap_start, and leave the suffix untouched.',
  };

  yield {
    state: labelMatrix(
      'Insert "brave " at the cursor',
      [
        { id: 'before', label: 'before' },
        { id: 'write', label: 'write chars' },
        { id: 'after', label: 'after' },
      ],
      [
        { id: 'layout', label: 'layout' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['hello [_____]world', 'ready'],
        ['hello brave [_]world', 'O(k) chars'],
        ['hello brave world', 'render ignores gap'],
      ],
    ),
    highlight: { active: ['write:layout', 'write:cost'], found: ['after:layout'] },
    explanation: 'For a burst of local typing, the cost is proportional to the inserted text, not to the document length. That is the whole reason the structure exists.',
  };

  yield {
    state: gapGraph('A distant edit moves the gap first'),
    highlight: { active: ['move', 'right', 'gap', 'e-right-move', 'e-move-gap'], compare: ['insert'], found: ['render'] },
    explanation: 'When the user edits far away, the gap must move. Moving right copies characters from the right span to the left span; moving left copies characters from the left span to the right span. This is usually a memmove.',
  };

  yield {
    state: labelMatrix(
      'Operation costs',
      [
        { id: 'local_insert', label: 'local insert' },
        { id: 'delete', label: 'local delete' },
        { id: 'move', label: 'cursor jump edit' },
        { id: 'grow', label: 'gap exhausted' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'why' },
      ],
      [
        ['O(k)', 'fill gap'],
        ['O(k)', 'enlarge gap'],
        ['O(distance)', 'copy across gap'],
        ['O(n)', 'new larger array'],
      ],
    ),
    highlight: { active: ['local_insert:cost', 'delete:cost'], compare: ['move:cost', 'grow:cost'] },
    explanation: 'The performance profile is intentionally uneven. Gap buffers are fast for the common case of typing near the cursor and less attractive for edits scattered across a large file.',
  };
}

function* editorTradeoffs() {
  yield {
    state: plotState({
      axes: { x: { label: 'distance from current cursor', min: 0, max: 100 }, y: { label: 'relative edit cost', min: 0, max: 1 } },
      series: [
        { id: 'gap', label: 'gap', points: [{ x: 0, y: 0.06 }, { x: 5, y: 0.08 }, { x: 20, y: 0.2 }, { x: 50, y: 0.5 }, { x: 100, y: 0.96 }] },
        { id: 'rope', label: 'rope', points: [{ x: 0, y: 0.22 }, { x: 5, y: 0.23 }, { x: 20, y: 0.25 }, { x: 50, y: 0.28 }, { x: 100, y: 0.32 }] },
        { id: 'piece', label: 'piece', points: [{ x: 0, y: 0.18 }, { x: 5, y: 0.2 }, { x: 20, y: 0.23 }, { x: 50, y: 0.27 }, { x: 100, y: 0.31 }] },
      ],
      markers: [
        { id: 'locality', x: 12, y: 0.11, label: 'locality wins' },
      ],
    }),
    highlight: { active: ['gap', 'locality'], compare: ['rope', 'piece'] },
    explanation: 'A gap buffer is a locality bet. If edits cluster around one cursor, it is simple and fast. If edits jump around a huge file, tree-like buffers have steadier costs.',
  };

  yield {
    state: labelMatrix(
      'Text-buffer comparison',
      [
        { id: 'gap', label: 'gap buffer' },
        { id: 'piece', label: 'piece table' },
        { id: 'rope', label: 'rope' },
        { id: 'crdt', label: 'sequence CRDT' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['single-cursor typing', 'far edits copy'],
        ['file edits + undo', 'many pieces'],
        ['large split/concat', 'tree overhead'],
        ['collaboration', 'metadata growth'],
      ],
    ),
    highlight: { active: ['gap:best', 'piece:best', 'rope:best'], compare: ['crdt:weakness'] },
    explanation: 'The right editor buffer depends on workload. A terminal editor with one active cursor can love a gap buffer; an IDE with huge files, snapshots, and many scattered edits often prefers a piece tree or rope layer.',
  };

  yield {
    state: gapGraph('Complete editor case study'),
    highlight: { active: ['left', 'gap', 'right', 'cursor', 'insert', 'render'], compare: ['move', 'grow'] },
    explanation: 'A minimal editor opens a file into one gap buffer, places the gap at the cursor, edits locally, renders left plus right spans, and records undo as inverse edits. It can be a serious design, not just a teaching toy.',
  };

  yield {
    state: labelMatrix(
      'Production details',
      [
        { id: 'lines', label: 'line lookup' },
        { id: 'undo', label: 'undo' },
        { id: 'unicode', label: 'Unicode' },
        { id: 'multi', label: 'multi-cursor' },
        { id: 'large', label: 'large files' },
      ],
      [
        { id: 'need', label: 'needs' },
        { id: 'trap' },
      ],
      [
        ['line index', 'scan whole file'],
        ['inverse ops', 'gap forgets history'],
        ['grapheme map', 'byte split bugs'],
        ['many gaps or tree', 'one gap thrashes'],
        ['chunking', 'O(n) gap move'],
      ],
    ),
    highlight: { active: ['lines:need', 'unicode:need', 'multi:need'], compare: ['large:trap'] },
    explanation: 'The core array is only the storage layer. Real editors add line indexes, undo stacks, encoding rules, rendering caches, syntax trees, and sometimes multiple buffers or chunks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'move the gap') yield* moveTheGap();
  else if (view === 'editor tradeoffs') yield* editorTradeoffs();
  else throw new InputError('Pick a gap-buffer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A gap buffer is a text-editor data structure built from one contiguous array. The visible text is split into a left span and a right span, with unused capacity called the gap between them. The cursor sits at the gap, so insertion writes into empty slots instead of shifting the whole suffix on every keystroke.',
        'GNU Emacs documents this exact idea: insertion fills part of the gap, deletion adds to it, and the gap is moved only when an editing command needs it at a different place: https://www.gnu.org/software/emacs/manual/html_node/elisp/Buffer-Gap.html. Charles Crowley classifies it as the "gap method" in the broader design space of text sequence data structures: https://www.cs.unm.edu/~crowley/papers/sds/sds.html.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The implementation stores two indices, gap_start and gap_end. Characters before gap_start are the prefix. Characters after gap_end are the suffix. Text inside [gap_start, gap_end) is ignored. To insert k characters, copy them into the gap and advance gap_start. To delete before the cursor, move gap_start backward. To delete after the cursor, move gap_end forward.',
        'Moving the cursor for display does not have to move bytes immediately. The expensive step happens before a later insert or delete at a new location: characters are copied across the gap until the gap sits at the edit point. Moving the gap right copies suffix characters into the prefix; moving it left copies prefix characters into the suffix.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Local insertion and deletion cost O(k), where k is the number of changed characters, while the gap has capacity. Moving the gap costs O(distance), because characters between the old cursor and the new edit point are copied. Growing the buffer costs O(n) when the gap is exhausted, just like growing a dynamic array.',
        'That asymmetry is acceptable when edits cluster around the cursor. Humans often type bursts, backspace nearby, and make small local fixes. It becomes painful for workloads with many distant edits, many cursors, background transformations, or very large files where a single gap move can copy megabytes.',
      ],
    },
    {
      heading: 'Complete case study: terminal editor buffer',
      paragraphs: [
        'A small terminal editor opens a file into a gap buffer with extra capacity near the cursor. The user types a function name; each keystroke fills one slot. Backspace grows the gap. The viewport renders the prefix and suffix while ignoring unused bytes. Undo stores inverse operations such as "delete the inserted range" or "restore the deleted slice." For a single-cursor editor, this gives a compact and predictable core.',
        'The same editor still needs supporting indexes. Jumping to a line requires line metadata, not just the gap. Unicode-aware movement needs grapheme boundaries, not raw byte offsets. Syntax highlighting and search should avoid re-scanning the entire buffer after every local edit. The gap buffer solves local text mutation; it does not solve the whole editor.',
      ],
    },
    {
      heading: 'Pitfalls and neighboring structures',
      paragraphs: [
        'A gap buffer is not automatically worse than a rope or piece table. It has excellent cache locality, low metadata overhead, and simple code. It is weaker when edit locality is poor. Piece Table Text Buffer preserves original and added buffers, making undo and file edits elegant. Text Rope Data Structure handles large split and concatenation workloads with tree nodes. Sequence CRDTs and Operational Transformation Collaborative Editing Case Study handle replicated collaborative order, usually on top of a local buffer.',
        'VS Code moved toward a piece-tree design for large-file and line-lookup reasons, and its engineering post explains how piece tables gain line metadata and a red-black tree to avoid linear lookup: https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation. That is not a universal rejection of gap buffers; it is a workload-specific design choice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and high-quality sources: GNU Emacs buffer gap documentation at https://www.gnu.org/software/emacs/manual/html_node/elisp/Buffer-Gap.html, Crowley Data Structures for Text Sequences at https://www.cs.unm.edu/~crowley/papers/sds/sds.html, Crowley PDF at https://www.cs.unm.edu/~crowley/papers/sds.pdf, and VS Code Text Buffer Reimplementation at https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation. Study Piece Table Text Buffer, Text Rope Data Structure, Sequence CRDTs, Operational Transformation Collaborative Editing Case Study, Peritext Rich-Text CRDT Case Study, Ring Buffer, Dynamic Array concepts, and Web Workers next.',
      ],
    },
  ],
};
