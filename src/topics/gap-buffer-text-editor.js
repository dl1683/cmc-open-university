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
      heading: 'How to read the animation',
      paragraphs: [
        'In the move-the-gap view, the graph shows the physical layout of one contiguous array. The left span and right span hold real text. The gap between them is allocated but ignored memory. The cursor node points at gap_start, the first unused slot.',
        'Watch the insert frame first: characters fill the gap without touching the suffix. Then watch the distant-edit frame: the gap must slide across the array before a new burst of typing can begin. The matrix shows exact before/after layouts so you can trace each byte.',
        'In the editor-tradeoffs view, the plot compares edit cost against cursor distance. The gap buffer curve rises steeply because moving the gap copies text proportional to the jump. Rope and piece-table curves stay flatter because their tree structures avoid moving contiguous memory.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The buffer gap is the simplest representation that makes insertion and deletion fast at the current point of editing.',
          attribution: 'GNU Emacs Internals documentation',
        },
        'A text editor spends almost all its time changing text near the cursor. If the document lives in a flat array, inserting one character shifts the entire suffix. A user typing at 80 words per minute triggers about 400 shift operations per minute, each copying everything after the cursor. That is wasted work on text the user is not touching.',
        'A gap buffer eliminates that waste for the common case. It keeps unused capacity at the cursor so local inserts write into empty slots and local deletes grow the empty region. The idea dates to the 1970s and powered GNU Emacs from its earliest versions. It is simple, cache-friendly, and proven across decades of production editing.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store the document as a single contiguous string or dynamic array. This is easy to reason about: index i maps to character i, saving writes the whole buffer, rendering is a single pass. Every beginning programmer reaches for this representation because it is the one they already know.',
        'It works well for small files and append-only logs. As long as edits happen at the end, the suffix is empty and nothing shifts. The trouble starts when the user places the cursor in the middle.',
        {
          type: 'diagram',
          text: 'Insert "X" at position 5 in a 1000-char array:\n\nBefore:  [a b c d e f g h ... (1000 chars)]\n                    ^ insert here\nAfter:   [a b c d e X f g h ... (1001 chars)]\n                      ^^^^^^^^^^^^^^^^^^^^^\n                      995 characters shifted right',
          label: 'Every mid-document insert shifts the suffix',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The flat-array approach breaks when edits happen in the middle. Inserting one character at position k shifts n - k characters. A burst of 50 keystrokes at the same spot triggers 50 separate shifts of the same suffix. For a 100,000-character file with the cursor at position 1,000, that is 50 copies of 99,000 characters each -- nearly 5 million character moves for one sentence of typing.',
        'A linked list avoids shifting, but it destroys cache locality, makes rendering expensive (one pointer chase per character), and eliminates the ability to do fast bulk operations like search, save, or line counting. The structure that solves the shifting problem must keep contiguous memory for the common case.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The buffer is one contiguous array split into three logical regions: the left span (before the cursor), the gap (unused capacity), and the right span (after the cursor). The rendered document is left span concatenated with right span. Bytes inside the gap are ignored.',
        {
          type: 'diagram',
          text: 'Array layout:  [H e l l o _ _ _ _ _ w o r l d]\n                |left span|   gap   |right span|\n                0        5  6     9  10       14\n                         ^gap_start  ^gap_end\n\nRendered text: "Hello world"\nGap is invisible to the user.',
          label: 'Three regions in one array',
        },
        {
          type: 'code',
          language: 'javascript',
          text: '// Core gap buffer operations\nfunction insert(buf, ch) {\n  if (buf.gapStart === buf.gapEnd) grow(buf);\n  buf.data[buf.gapStart] = ch;\n  buf.gapStart++;\n}\n\nfunction moveGapTo(buf, pos) {\n  if (pos < buf.gapStart) {\n    // Move gap left: copy chars from left span into gap end\n    const count = buf.gapStart - pos;\n    buf.data.copyWithin(buf.gapEnd - count, pos, buf.gapStart);\n    buf.gapEnd -= count;\n    buf.gapStart = pos;\n  } else if (pos > buf.gapStart) {\n    // Move gap right: copy chars from right span into gap start\n    const count = pos - buf.gapStart;\n    buf.data.copyWithin(buf.gapStart, buf.gapEnd, buf.gapEnd + count);\n    buf.gapStart += count;\n    buf.gapEnd += count;\n  }\n}',
        },
        'Insertion writes a character at gap_start and advances gap_start. Backspace decrements gap_start, making the deleted character part of the ignored gap. Forward delete increments gap_end. Rendering concatenates data[0..gapStart] and data[gapEnd..length], skipping the gap entirely.',
        {
          type: 'diagram',
          text: 'Typing "brave " into the gap:\n\nStep 0: [H e l l o _ _ _ _ _ _ w o r l d]   gap=6\n                    |   gap   |\nStep 1: [H e l l o b _ _ _ _ _ w o r l d]   gap=5\nStep 2: [H e l l o b r _ _ _ _ w o r l d]   gap=4\nStep 3: [H e l l o b r a _ _ _ w o r l d]   gap=3\nStep 4: [H e l l o b r a v _ _ w o r l d]   gap=2\nStep 5: [H e l l o b r a v e _ w o r l d]   gap=1\nStep 6: [H e l l o b r a v e _ w o r l d]   gap=1 (space)\n\nSuffix "world" never moved.',
          label: 'Typing consumes the gap without shifting',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The structure works because it matches the locality of human editing. People type bursts, backspace nearby, select a nearby word, or make a small local correction. For that workload, the buffer pays O(k) for k inserted or deleted characters and never shifts the far suffix.',
        'The invariant is simple: rendered text always equals data[0..gapStart] + data[gapEnd..length], and gapStart is always less than or equal to gapEnd. Every operation preserves this. Insertion shrinks the gap. Deletion grows it. Gap movement copies characters across the gap boundary but preserves the concatenation result.',
        'The idea is to move empty space rather than text. After the gap has been repositioned, an entire burst of local edits runs at the cost of the inserted text alone, not the document size. This amortizes the one-time movement cost across many cheap operations.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Gap Buffer', 'Rope', 'Piece Table', 'Flat Array'],
          rows: [
            ['Insert at cursor', 'O(1) amortized', 'O(log n)', 'O(log n)', 'O(n)'],
            ['Delete at cursor', 'O(1)', 'O(log n)', 'O(log n)', 'O(n)'],
            ['Cursor jump + edit', 'O(distance)', 'O(log n)', 'O(log n)', 'O(n)'],
            ['Memory overhead', 'Gap size only', 'Tree nodes', 'Piece descriptors', 'None'],
            ['Cache locality', 'Excellent', 'Poor (leaves)', 'Good (append buffer)', 'Excellent'],
          ],
        },
        'Local inserts cost O(1) amortized because they fill gap slots. When the gap is exhausted, the buffer grows like a dynamic array: allocate a new array at 1.5x or 2x the current size, copy everything, and place a fresh gap at the cursor. That growth is O(n) but happens rarely enough to amortize to O(1) per insert.',
        'The expensive operation is the cursor jump edit. Moving the gap from position a to position b copies |b - a| characters. In a 100,000-character file, jumping from the start to the end copies the entire document. This is the fundamental tradeoff: the gap buffer bets everything on edit locality.',
        {
          type: 'note',
          text: 'Gap growth strategy matters. Emacs historically doubled the gap size. A common modern choice is max(256, gapSize * 2) to avoid frequent reallocation during fast typing while not wasting memory on small files.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'GNU Emacs used a gap buffer from its first C implementation in 1984 through the present day. For single-cursor editing of source files (typically under 100 KB), the gap buffer is hard to beat: zero metadata overhead, excellent cache behavior, trivial implementation, and sub-microsecond insert latency.',
        {
          type: 'bullets',
          items: [
            'Terminal editors (Emacs, micro, early versions of nano) where one cursor dominates.',
            'Embedded text widgets where implementation simplicity and small memory footprint matter.',
            'Command-line input buffers where the document is one line and edits cluster at the cursor.',
            'Educational editors where students can understand the entire storage layer in an afternoon.',
            'Any editor where files are moderate-sized and the user edits in local bursts.',
          ],
        },
        'The gap buffer also composes well with auxiliary structures. Emacs layers line-number caches, syntax tables, overlay properties, and undo lists on top of the gap buffer without replacing it. The storage layer stays simple; complexity lives in the indexes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Multi-cursor editing defeats the single-gap design. Two cursors at opposite ends of a file thrash the gap back and forth, turning every keystroke into an O(n) copy. Some editors work around this with multiple gaps or by switching to a different buffer structure when multi-cursor mode activates.',
        'Large files (multi-megabyte logs, database dumps) suffer from O(n) gap movement on distant jumps and O(n) reallocation when the gap is exhausted. VS Code switched from a line array to a piece table in 2018 specifically because large files with many edits caused visible lag. Their piece table gives O(log n) edits regardless of cursor position.',
        'Collaborative editing requires concurrent modifications at arbitrary positions by multiple users. A gap buffer has no structure for merging remote edits efficiently. CRDTs and operational transformation operate on per-character or per-range identifiers that a flat gap buffer cannot provide.',
        {
          type: 'bullets',
          items: [
            'Multi-cursor: one gap thrashes. Need multiple gaps or a tree.',
            'Large files: gap movement and growth are both O(n).',
            'Persistent undo/snapshots: the gap buffer mutates in place. Piece tables preserve the original file.',
            'Collaboration: no structure for concurrent remote edits.',
            'Background refactoring tools: scattered machine edits pay full gap-movement cost each time.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'GNU Emacs Buffer Gap documentation: https://www.gnu.org/software/emacs/manual/html_node/elisp/Buffer-Gap.html -- the canonical reference for gap buffer semantics in a production editor.',
            'Charles Crowley, "Data Structures for Text Sequences" (1998): https://www.cs.unm.edu/~crowley/papers/sds/sds.html -- the most thorough comparison of gap buffers, piece tables, and other text representations.',
            'VS Code "Text Buffer Reimplementation" (2018): https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation -- why VS Code moved from a line array to a piece table, with benchmarks against gap buffers and ropes.',
          ],
        },
        'Prerequisites: dynamic arrays and amortized analysis (to understand gap growth), memmove semantics (to understand gap movement with overlapping regions).',
        'Extensions: Piece Table Text Buffer (the structure VS Code chose instead), Text Rope Data Structure (the tree-based alternative used in Xi editor and Zed), Ring Buffer (another structure that uses a gap-like wrap for cheap insertion at both ends).',
        'Related case studies: Sequence CRDTs and Operational Transformation for collaborative editing, where the single-cursor locality assumption breaks entirely.',
      ],
    },
  ],
};
