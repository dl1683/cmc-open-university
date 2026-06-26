// Text rope data structure: large strings as balanced concatenation trees.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'text-rope-data-structure',
  title: 'Text Rope Data Structure',
  category: 'Data Structures',
  summary: 'Represent a large string as a balanced tree of chunks so concatenation, slicing, and localized edits avoid copying the whole text.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['concat tree', 'split insert'], defaultValue: 'concat tree' },
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

function ropeGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'concat len 11', x: 4.8, y: 0.8, note: 'whole string' },
      { id: 'left', label: 'left len 6', x: 2.6, y: 2.5, note: 'hello + space' },
      { id: 'right', label: 'right len 5', x: 7.0, y: 2.5, note: 'world' },
      { id: 'hello', label: '"hello"', x: 1.4, y: 4.6, note: 'leaf chunk len 5' },
      { id: 'space', label: '" "', x: 3.6, y: 4.6, note: 'leaf chunk len 1' },
      { id: 'world', label: '"world"', x: 6.4, y: 4.6, note: 'leaf chunk len 5' },
      { id: 'insert', label: '" brave"', x: 8.8, y: 4.6, note: 'new leaf' },
      { id: 'rebalance', label: 'rebalance', x: 8.8, y: 1.0, note: 'keep depth bounded' },
    ],
    edges: [
      { id: 'e-root-left', from: 'root', to: 'left', weight: 'first 6 chars' },
      { id: 'e-root-right', from: 'root', to: 'right', weight: 'remaining chars' },
      { id: 'e-left-hello', from: 'left', to: 'hello', weight: 'chunk' },
      { id: 'e-left-space', from: 'left', to: 'space', weight: 'chunk' },
      { id: 'e-right-world', from: 'right', to: 'world', weight: 'chunk' },
      { id: 'e-insert-root', from: 'insert', to: 'root', weight: 'concat after split' },
      { id: 'e-root-rebalance', from: 'root', to: 'rebalance', weight: 'balance policy' },
    ],
  }, { title });
}

function* concatTree() {
  const text = 'hello world';
  const totalLen = text.length;
  const leftLen = 6;
  const rightLen = totalLen - leftLen;
  const leafCount = 3;
  const lookupIndex = 8;
  const lookupChar = text[lookupIndex];
  const adjustedIndex = lookupIndex - leftLen;
  const ops = ['index', 'concat', 'split', 'flatten'];

  yield {
    state: ropeGraph('A rope stores text as a weighted concatenation tree'),
    highlight: { active: ['root', 'left', 'right'], found: ['hello', 'space', 'world'], compare: ['insert'] },
    explanation: `A rope represents "${text}" (length ${totalLen}) as a tree with ${leafCount} leaves. Internal nodes store weights or lengths; leaves store small flat string chunks. The full text is the left-to-right leaf concatenation.`,
    invariant: `In-order leaf order equals the string order — the ${leafCount} leaves read left to right produce "${text}".`,
  };

  yield {
    state: labelMatrix(
      'Index lookup for character 8 in "hello world"',
      [
        { id: 'root', label: 'root weight 6' },
        { id: 'right', label: 'go right' },
        { id: 'world', label: 'world leaf' },
        { id: 'answer', label: 'offset 2' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'result' },
      ],
      [
        ['8 >= left length 6', 'subtract 6'],
        ['new index 2', 'descend right subtree'],
        ['index inside chunk', 'read r'],
        ['character', 'r'],
      ],
    ),
    highlight: { found: ['answer:result'], active: ['root:result', 'right:result'] },
    explanation: `Weights guide indexing. To find index ${lookupIndex} in "${text}", compare with left weight ${leftLen}: ${lookupIndex} >= ${leftLen}, so go right with adjusted index ${adjustedIndex}. The character is '${lookupChar}'.`,
  };

  yield {
    state: ropeGraph('Concatenation creates a new parent instead of copying bytes'),
    highlight: { active: ['root', 'left', 'right', 'e-root-left', 'e-root-right'], found: ['insert'], compare: ['hello'] },
    explanation: `Concatenating two large strings creates one new internal node pointing at existing subtrees. Instead of copying all ${totalLen} characters, the rope reuses the left (${leftLen} chars) and right (${rightLen} chars) subtrees.`,
  };

  yield {
    state: labelMatrix(
      'Rope operations',
      [
        { id: 'index', label: 'index' },
        { id: 'concat', label: 'concat' },
        { id: 'split', label: 'split' },
        { id: 'flatten', label: 'flatten' },
      ],
      [
        { id: 'usualCost', label: 'usual cost' },
        { id: 'risk' },
      ],
      [
        ['O(log n + leaf)', 'needs balance'],
        ['O(1) then rebalance', 'tree depth growth'],
        ['O(log n)', 'leaf splitting'],
        ['O(n)', 'copy whole text'],
      ],
    ),
    highlight: { active: ['index:usualCost', 'concat:usualCost', 'split:usualCost'], compare: ['flatten:risk'] },
    explanation: `Ropes improve ${ops.length - 1} of ${ops.length} core operations. Index, concat, and split run in O(log n), but flattening still touches all ${totalLen} characters.`,
  };
}

function* splitInsert() {
  const insertPos = 6;
  const insertText = ' brave';
  const original = 'hello world';
  const result = original.slice(0, insertPos) + insertText + original.slice(insertPos);
  const bufferTypes = ['flat string/array', 'gap buffer', 'piece table', 'rope'];
  const docSize = '200 MB';
  const docSteps = ['load', 'slice', 'insert', 'save'];

  yield {
    state: labelMatrix(
      'Insert " brave" at position 6',
      [
        { id: 'before', label: 'before' },
        { id: 'split', label: 'split at 6' },
        { id: 'insert', label: 'new leaf' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'piece', label: 'piece' },
        { id: 'text' },
      ],
      [
        ['one rope', 'hello world'],
        ['left/right ropes', 'hello | world'],
        ['leaf chunk', ' brave'],
        ['concat three ropes', 'hello brave world'],
      ],
    ),
    highlight: { active: ['split:text', 'insert:text'], found: ['join:text'] },
    explanation: `Insertion is split plus concat. Split "${original}" at position ${insertPos}, create a leaf for "${insertText}", and concatenate left + inserted + right to get "${result}".`,
  };

  yield {
    state: ropeGraph('Balance keeps repeated edits from forming a chain'),
    highlight: { active: ['root', 'rebalance', 'e-root-rebalance'], compare: ['hello', 'insert'] },
    explanation: `If every append simply creates a new parent, the rope can degenerate into a tall chain. After inserting "${insertText}" at position ${insertPos}, the tree must rebalance to preserve logarithmic depth.`,
    invariant: `Rope performance depends on maintaining bounded depth — inserting ${insertText.length}-char chunks must not degrade index time from O(log n) to O(n).`,
  };

  yield {
    state: labelMatrix(
      'Text-buffer comparison',
      [
        { id: 'array', label: 'flat string/array' },
        { id: 'gap', label: 'gap buffer' },
        { id: 'piece', label: 'piece table' },
        { id: 'rope', label: 'rope' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'weakness' },
      ],
      [
        ['simple scanning', 'large inserts copy'],
        ['local cursor edits', 'far cursor moves'],
        ['undo and file edits', 'many pieces need indexing'],
        ['large concat/split', 'tree and chunk complexity'],
      ],
    ),
    highlight: { found: ['rope:best', 'piece:best'], compare: ['array:weakness'] },
    explanation: `Ropes are one of ${bufferTypes.length} common text-buffer strategies. Piece tables are often better when preserving original and inserted buffers matters; gap buffers excel at local cursor edits.`,
  };

  yield {
    state: labelMatrix(
      'Complete document case study',
      [
        { id: 'load', label: 'load 200 MB log' },
        { id: 'slice', label: 'slice region' },
        { id: 'insert', label: 'insert annotation' },
        { id: 'save', label: 'save/flatten' },
      ],
      [
        { id: 'ropeMove', label: 'rope move' },
        { id: 'lesson' },
      ],
      [
        ['chunk leaves', 'avoid one huge copy'],
        ['split by index', 'share subtrees'],
        ['concat new leaf', 'localized edit'],
        ['stream leaves', 'copy only at boundary'],
      ],
    ),
    highlight: { found: ['load:lesson', 'insert:lesson'], compare: ['save:lesson'] },
    explanation: `The rope case study is editing a ${docSize} document through ${docSteps.length} stages — copying the whole string on every operation is unacceptable at that scale.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'concat tree') yield* concatTree();
  else if (view === 'split insert') yield* splitInsert();
  else throw new InputError('Pick a text-rope view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the animation as a tree over text chunks. A rope is a binary tree whose leaves store short strings and whose internal nodes store length facts. If an index is smaller than the left length, go left; otherwise subtract that length and go right.',
      {type: 'image', src: './assets/gifs/text-rope-data-structure.gif', alt: 'Animated walkthrough of the text rope data structure visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
      'Large editable text is expensive as one flat array. Inserting 10 bytes near the front of a 50 MB document can move almost 50 MB of later bytes. A rope exists so unchanged chunks stay in place while only the edited path and its metadata change.',
      {type: 'callout', text: 'A rope makes text editing cheap by preserving untouched chunks and paying only for the path where position metadata changes.'},
    ], },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious representation is a flat string. It is compact, cache-friendly, and excellent for small text or full scans. A chunk list avoids large moves, but finding character 700000 becomes a chunk-by-chunk walk because the list has no search tree.',
    ], },
    { heading: 'The wall', paragraphs: [
      'The wall is nonlocal editing plus position lookup. Flat arrays make middle insert and delete cost O(n), while plain chunk lists make indexing and line navigation slow. Editors also need byte counts, line counts, and user-visible character measures without rescanning unchanged text.',
    ], },
    { heading: 'The core insight', paragraphs: [
      'Store text only at leaves and store skip facts in internal nodes. The core invariant is that in-order leaf traversal equals the document. Rebalancing may change shape, but it must preserve leaf order and recompute the cached measures.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Vector_Rope_example.svg', alt: 'Example rope tree built from string chunks', caption: 'A rope is a binary tree over string leaves; weights route index lookup without flattening text. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Vector_Rope_example.svg.'},
    ], },
    { heading: 'How it works', paragraphs: [
      'Lookup descends by comparing the target index with the left-subtree length. Insert splits the rope at the edit position, concatenates the inserted chunk, and joins the old right side. Delete splits before and after the removed range, discards the middle, and joins the survivors.',
    ], },
    { heading: 'Why it works', paragraphs: [
      'Correctness follows from concatenation. A leaf represents its chunk, and an internal node represents left text followed by right text. If every cached length equals the true left-subtree length, each lookup step preserves the requested character position.',
    ], },
    { heading: 'Cost and complexity', paragraphs: [
      'A balanced rope gives O(log n) lookup, split, insert, and delete plus edited-leaf work. Full traversal, save, and search are still O(n). Doubling the document adds about one tree level, but pointer chasing and rebalancing make small strings slower than flat arrays.',
    ], },
    { heading: 'Real-world uses', paragraphs: [
      'Ropes fit editors, diff tools, compilers, log viewers, and persistent snapshots where most text survives each edit. A parser can hold an old root while the user edits a new root that shares unchanged subtrees. String builders can keep fragments as leaves and stream the final text once.',
    ], },
    { heading: 'Where it fails', paragraphs: [
      'Ropes fail on small strings, tight scans, and workloads that flatten after every edit. Encoding rules can also break naive splits: bytes can split UTF-8, and UTF-16 code units can split surrogate pairs. Collaborative editing still needs OT or a sequence CRDT above the rope.',
    ], },
    { heading: 'Worked example', paragraphs: [
      'Represent abcdefghij with leaves abc, defg, and hij. The root left subtree has length 7. To find index 8, go right and search index 1 inside hij, which gives i.',
      'To insert XYZ at position 7, split into abcdefg and hij, then join abcdefg + XYZ + hij. Only the split path, new leaf, and join path need new metadata. The untouched chunks are reconnected rather than copied character by character.',
    ], },
    { heading: 'Sources and study next', paragraphs: [
      'Primary source: Boehm, Atkinson, and Plass, "Ropes: An Alternative to Strings." Study tree traversal, balanced binary trees, gap buffers, piece tables, persistent data structures, and sequence CRDTs next.',
    ], },
  ],
};
