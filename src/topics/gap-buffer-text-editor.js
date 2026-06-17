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
      heading: 'Why this exists',
      paragraphs: [
        'A text editor spends most of its life changing text near the cursor. If the document is stored as one flat string or array, inserting one character in the middle shifts the entire suffix. Ordinary typing becomes repeated copying of text the user is not touching.',
        'A gap buffer fixes that specific pain. It keeps unused capacity at the cursor so local insertion writes into empty slots and local deletion grows the empty region. The structure is simple, cache-friendly, and old enough to be boring in the best sense: it is a practical editor buffer, not just a classroom trick.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is a single contiguous string. It is easy to save, render, and reason about. The wall appears when edits happen in the middle: insertion shifts the suffix, deletion shifts it back, and a burst of typing repeats that work over and over.',
        'A linked list avoids shifting, but it destroys locality and makes rendering, line lookup, and cache behavior worse. The gap buffer keeps the contiguous-array advantages while making the current edit point cheap.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The buffer is one contiguous array split into three logical regions: the left span, the gap, and the right span. The visible document is left span plus right span. Bytes or characters inside the gap are ignored because they represent capacity, not text.',
        'Implementations usually store two indices: gap_start and gap_end. Text before gap_start is before the cursor. Text after gap_end is after the cursor. The cursor sits at gap_start, so the next insertion can write directly into the gap.',
        'The core insight is to move empty space, not text, to the place where the user is editing. After the gap has moved, a whole burst of local edits avoids touching the far suffix.',
      ],
    },
    {
      heading: 'Core operations',
      paragraphs: [
        'Insertion copies the new characters into the gap and advances gap_start. Backspace moves gap_start left, which makes the deleted character part of the ignored gap. Delete moves gap_end right. Rendering concatenates the left and right spans while skipping the gap.',
        'Moving the cursor for display can be just an index change, but editing at a different location requires moving the gap. To move the gap right, copy characters from the right span into the left side of the gap. To move it left, copy characters from the left span into the right side. If the gap runs out, allocate a larger array and create a new gap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with the rendered text "hello world" and place a five-character gap after "hello ". Internally it can look like "hello [_____]world". Typing "brave " fills most of the gap: "hello brave [_]world". Rendering ignores the remaining empty slot and shows "hello brave world". The suffix "world" did not move for each keystroke.',
        'Now jump to the beginning and type "say ". The buffer first moves the gap from after "brave " to the start by copying the intervening characters across the gap. That cursor jump edit costs distance. Once the gap is at the new edit point, typing is cheap again.',
        'This example captures the economics of the structure. The first local burst is nearly ideal. The jump pays a copying bill once. A second local burst is cheap again. Gap buffers are good when editing naturally arrives in bursts around the current cursor.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the move-the-gap view, read the graph as the physical layout of one array. The left span and right span are real text. The gap is ignored capacity. The cursor points at the start of the gap. The insert frame shows why typing is cheap; the distant-edit frame shows the hidden cost of moving the gap before a new local burst.',
        'In the editor-tradeoffs view, compare cost against cursor distance. The gap buffer wins near the current edit point because it has almost no metadata and excellent locality. Rope and piece-table designs have steadier costs for scattered edits because they avoid moving one large contiguous gap across the document.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The data structure works because it matches the locality of human editing. People usually type bursts, backspace nearby, select a nearby word, or make a small local correction. For that workload, the buffer pays O(k) for k inserted or deleted characters and avoids shifting the whole suffix after every keystroke.',
        'It also works because it keeps representation overhead low. There are no tree nodes, piece descriptors, tombstones, or per-character identifiers in the core buffer. The CPU sees contiguous memory, rendering can scan two spans, and many operations are simple index movement plus copying.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The central tradeoff is locality versus worst-case movement. Local edits are cheap. Distant edits copy the distance between the old gap and the new edit point. Growing the underlying array is O(n), like growing a dynamic array. In a small or medium single-cursor editor, this is often acceptable. In a huge file with scattered machine edits, it can become visible.',
        'A gap buffer is not automatically worse than a rope or piece table. It has better cache locality and much less metadata. It is weaker for many cursors, collaborative editing, large split and concatenate operations, persistent snapshots, and workloads where background tools rewrite distant ranges while the user is editing elsewhere.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'A real editor needs more than the storage layer. Jumping to a line needs line metadata. Unicode-aware movement needs grapheme and normalization rules, not raw byte offsets. Undo needs inverse operations or a separate history. Syntax highlighting, search, and parsing need incremental indexes or caches. The gap buffer mutates text; it does not solve navigation, semantics, rendering, or collaboration.',
        'Common bugs come from treating bytes as characters, exposing the gap during save or render, forgetting to update line indexes after edits, moving the gap with overlapping copies incorrectly, and letting one global gap thrash under multi-cursor edits. When edits are distributed, consider multiple gaps, chunked buffers, a piece table, or a rope.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use a gap buffer when the editor is mostly single-cursor, files are moderate, implementation simplicity matters, and local typing latency is the priority. It is a strong fit for terminal editors, embedded editors, educational editors, command lines, and text widgets with one active edit point.',
        'Prefer a piece table or piece tree when preserving original file buffers, undo history, fast line lookup, and large-file behavior dominate. Prefer a rope when split, concatenate, and large range operations dominate. Prefer CRDT or operational transformation layers when independent replicas must merge concurrent edits.',
        'Hybrid designs are common. An editor can use a gap buffer inside chunks, a tree over chunks for large-file navigation, and separate indexes for lines and syntax. The storage layer should match the edit workload, while surrounding indexes match search, rendering, and navigation.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep gap movement and gap growth in small, well-tested helpers. Use memmove-like semantics when source and destination ranges overlap. After every edit, assert that rendered text equals left span plus right span and that gap_start <= gap_end.',
        'Do not let UI cursor units leak into storage units. A cursor may move by grapheme cluster, code point, UTF-16 code unit, or byte depending on the platform. The gap buffer can store any of those, but the editor must translate deliberately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and high-quality sources: GNU Emacs buffer gap documentation at https://www.gnu.org/software/emacs/manual/html_node/elisp/Buffer-Gap.html, Crowley Data Structures for Text Sequences at https://www.cs.unm.edu/~crowley/papers/sds/sds.html, Crowley PDF at https://www.cs.unm.edu/~crowley/papers/sds.pdf, and VS Code Text Buffer Reimplementation at https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation.',
        'Study Piece Table Text Buffer, Text Rope Data Structure, Sequence CRDTs, Operational Transformation Collaborative Editing Case Study, Peritext Rich-Text CRDT Case Study, Ring Buffer, dynamic array growth, and Web Workers next.',
      ],
    },
  ],
};
