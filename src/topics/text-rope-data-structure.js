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
  yield {
    state: ropeGraph('A rope stores text as a weighted concatenation tree'),
    highlight: { active: ['root', 'left', 'right'], found: ['hello', 'space', 'world'], compare: ['insert'] },
    explanation: 'A rope represents a string as a tree. Internal nodes store weights or lengths; leaves store small flat string chunks. The full text is the left-to-right leaf concatenation.',
    invariant: 'In-order leaf order equals the string order.',
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
    explanation: 'Weights guide indexing. Instead of scanning the whole string, descend by comparing the target index to left-subtree lengths.',
  };

  yield {
    state: ropeGraph('Concatenation creates a new parent instead of copying bytes'),
    highlight: { active: ['root', 'left', 'right', 'e-root-left', 'e-root-right'], found: ['insert'], compare: ['hello'] },
    explanation: 'Concatenating two large strings can create one new internal node pointing at existing subtrees. Balanced ropes can share structure and avoid copying the full content.',
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
    explanation: 'Ropes improve edits and composition, not every operation. Flattening or scanning still touches the full text.',
  };
}

function* splitInsert() {
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
    explanation: 'Insertion is split plus concat. Split the rope at the insertion point, create a leaf for inserted text, and concatenate left + inserted + right.',
  };

  yield {
    state: ropeGraph('Balance keeps repeated edits from forming a chain'),
    highlight: { active: ['root', 'rebalance', 'e-root-rebalance'], compare: ['hello', 'insert'] },
    explanation: 'If every append simply creates a new parent, the rope can degenerate into a tall chain. Production ropes rebalance or use chunk-size rules to preserve logarithmic depth.',
    invariant: 'Rope performance depends on maintaining bounded depth and reasonable leaf sizes.',
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
    explanation: 'Ropes are one answer to the text editor problem, but not the only one. Piece tables are often better when preserving original and inserted buffers matters.',
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
    explanation: 'The rope case study is editing or assembling very large text where copying the whole string on every operation is unacceptable.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'A text rope is a tree representation of a string. Leaves hold small flat strings, and internal nodes represent concatenation while storing enough length metadata to navigate by index.',
        'The goal is to avoid copying huge strings for concat, slice, and localized edits. Instead of moving bytes, the rope creates or rearranges tree nodes that point at existing chunks.',
        'This topic is named Text Rope Data Structure to avoid confusion with RoPE, Rotary Positional Embeddings, which is a separate AI topic in this repo.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Index lookup descends the tree using left-subtree lengths. Concatenation can create a new parent node. Split descends to the split position, divides a leaf if needed, and returns two ropes. Insert is split, concatenate inserted leaf, then concatenate the right side.',
        'Balanced ropes maintain reasonable depth and leaf size. Some implementations share immutable subtrees, which can make undo, snapshots, and substring operations cheaper than copying flat buffers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Balanced ropes give logarithmic navigation and editing costs plus the size of touched leaves. Full traversal and flattening are still O(n). Ropes also pay pointer overhead and can have worse cache locality than a flat array for small strings.',
        'Implementation quality matters. Without rebalancing, repeated appends or edits can create a tall tree. Without chunk-size management, leaves become too tiny or too large, hurting either metadata overhead or edit cost.',
        'Ropes also need clear rules for character encoding. Splitting by byte offset is unsafe for variable-width text if the user-facing operation is by character, grapheme, or line. Serious editors layer text-indexing rules above the raw chunk tree.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ropes are used in text editors, compilers, language runtimes, large-string builders, diff tools, and systems that need persistent or shared string snapshots.',
        'A complete case study is assembling a generated source file from many fragments. A flat string repeatedly copies the growing output. A rope links fragments as leaves, then streams the final tree only when output is needed.',
        'Another case is background analysis in an editor. A snapshot can share most rope nodes with the live document while the user keeps editing, letting parsers or indexers work against a stable version without copying the whole file. In a collaborative editor, Operational Transformation Collaborative Editing Case Study or Sequence CRDTs for Collaborative Text decides how remote operations map into that local rope-backed view.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
      'Ropes are not always better than strings. Small strings, tight scans, and simple append buffers may be faster as arrays. For interactive editors, Gap Buffer Text Editor or Piece Table Text Buffer may better match the edit pattern. For generic indexed items such as clips, cards, or chunks, Implicit Treap Sequence Editor is another split/merge option.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Boehm, Atkinson, and Plass, Ropes: An Alternative to Strings, at https://www.cs.tufts.edu/comp/150FP/archive/hans-boehm/ropes.pdf and Google Research listing at https://research.google/pubs/ropes-an-alternative-to-strings/. Study Implicit Treap Sequence Editor, Gap Buffer Text Editor, Tree Traversals, Splay Tree, Red-Black Tree, Piece Table Text Buffer, Sequence CRDTs, Operational Transformation Collaborative Editing Case Study, and Peritext Rich-Text CRDT Case Study next.',
      ],
    },
  ],
};
