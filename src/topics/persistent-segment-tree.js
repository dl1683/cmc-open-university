// Persistent segment tree: update by copying the root-to-leaf path while old
// versions keep pointing at the untouched nodes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'persistent-segment-tree',
  title: 'Persistent Segment Tree',
  category: 'Data Structures',
  summary: 'Path copying turns range-query trees into versioned data structures: old roots stay queryable after updates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['path copying', 'versioned queries'], defaultValue: 'path copying' },
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

function versionGraph(title, updated) {
  const nodes = [
    { id: 'v0', label: 'root v0', x: 0.7, y: 2.0, note: 'sum 10' },
    { id: 'v1', label: 'root v1', x: 0.7, y: 5.4, note: updated ? 'sum 17' : 'new root' },
    { id: 'a', label: '[0,3]', x: 2.7, y: 2.0, note: 'sum 10' },
    { id: 'b', label: '[0,1]', x: 4.6, y: 1.1, note: 'sum 4' },
    { id: 'c', label: '[2,3]', x: 4.6, y: 2.9, note: 'sum 6' },
    { id: 'd', label: '[0]', x: 6.5, y: 0.5, note: '1' },
    { id: 'e', label: '[1]', x: 6.5, y: 1.7, note: '3' },
    { id: 'f', label: '[2]', x: 6.5, y: 2.7, note: '2' },
    { id: 'g', label: '[3]', x: 6.5, y: 3.9, note: '4' },
  ];
  if (updated) {
    nodes.push(
      { id: 'a1', label: '[0,3]', x: 2.7, y: 5.4, note: 'sum 17' },
      { id: 'c1', label: '[2,3]', x: 4.6, y: 5.4, note: 'sum 13' },
      { id: 'g1', label: '[3]', x: 6.5, y: 5.4, note: '11' },
    );
  }
  return graphState({
    nodes,
    edges: updated ? [
      { id: 'e-v0-a', from: 'v0', to: 'a', weight: 'old' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'left' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: 'right' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: 'left' },
      { id: 'e-b-e', from: 'b', to: 'e', weight: 'right' },
      { id: 'e-c-f', from: 'c', to: 'f', weight: 'left' },
      { id: 'e-c-g', from: 'c', to: 'g', weight: 'right' },
      { id: 'e-v1-a1', from: 'v1', to: 'a1', weight: 'new' },
      { id: 'e-a1-b', from: 'a1', to: 'b', weight: 'share left' },
      { id: 'e-a1-c1', from: 'a1', to: 'c1', weight: 'copy right' },
      { id: 'e-c1-f', from: 'c1', to: 'f', weight: 'share left' },
      { id: 'e-c1-g1', from: 'c1', to: 'g1', weight: 'copy leaf' },
    ] : [
      { id: 'e-v0-a', from: 'v0', to: 'a', weight: 'root' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'left' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: 'right' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: 'left' },
      { id: 'e-b-e', from: 'b', to: 'e', weight: 'right' },
      { id: 'e-c-f', from: 'c', to: 'f', weight: 'left' },
      { id: 'e-c-g', from: 'c', to: 'g', weight: 'right' },
    ],
  }, { title });
}

function* pathCopying() {
  yield {
    state: versionGraph('Version 0 stores sums for [1, 3, 2, 4]', false),
    highlight: { active: ['v0', 'a'], found: ['b', 'c'] },
    explanation: 'A normal Segment Tree stores aggregate values over intervals. A persistent segment tree keeps old versions by never mutating nodes that old roots can reach.',
  };

  yield {
    state: versionGraph('Update index 3 from 4 to 11: copy only the path', true),
    highlight: { active: ['v1', 'a1', 'c1', 'g1'], compare: ['b', 'f'], found: ['v0'] },
    explanation: 'Updating one leaf copies the root-to-leaf path and reuses every untouched subtree. Version 0 still points to old nodes. Version 1 points to new nodes where sums changed and shared nodes where they did not.',
    invariant: 'Persistence is sharing plus immutability of old reachable nodes.',
  };

  yield {
    state: labelMatrix(
      'Space cost of path copying',
      [
        { id: 'array', label: 'array length 8' },
        { id: 'height', label: 'tree height' },
        { id: 'update', label: 'one point update' },
        { id: 'versions', label: 'm versions' },
      ],
      [
        { id: 'cost', label: 'new nodes' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['15 initial nodes', 'ordinary tree'],
        ['log2 n', 'path length'],
        ['O(log n)', 'copy path only'],
        ['O(n + m log n)', 'share the rest'],
      ],
    ),
    highlight: { found: ['update:cost', 'versions:cost'], compare: ['array:cost'] },
    explanation: 'Copying the whole tree per version would be O(n) per update. Path copying makes point updates O(log n) new nodes while preserving access to every old root.',
  };

  yield {
    state: labelMatrix(
      'Persistence levels',
      [
        { id: 'ephemeral', label: 'ephemeral' },
        { id: 'partial', label: 'partial persistent' },
        { id: 'full', label: 'fully persistent' },
        { id: 'confluent', label: 'confluent' },
      ],
      [
        { id: 'query', label: 'query old?' },
        { id: 'update', label: 'update old?' },
      ],
      [
        ['no', 'latest only'],
        ['yes', 'latest only'],
        ['yes', 'any version'],
        ['yes', 'merge versions'],
      ],
    ),
    highlight: { active: ['partial:query', 'partial:update'], compare: ['full:update', 'confluent:update'] },
    explanation: 'Most persistent segment tree uses are partially persistent: query any old version, but create new versions from the latest or from a chosen root with controlled rules.',
  };
}

function* versionedQueries() {
  yield {
    state: versionGraph('Two roots expose two histories', true),
    highlight: { active: ['v0', 'v1'], compare: ['g', 'g1'] },
    explanation: 'A version is just a root pointer. Query version 0 through root v0 and index 3 is still 4. Query version 1 through root v1 and index 3 is 11.',
  };

  yield {
    state: labelMatrix(
      'Same query, different versions',
      [
        { id: 'q0', label: 'sum [2,3] at v0' },
        { id: 'q1', label: 'sum [2,3] at v1' },
        { id: 'old', label: 'old leaf [3]' },
        { id: 'new', label: 'new leaf [3]' },
      ],
      [
        { id: 'path', label: 'path' },
        { id: 'answer', label: 'answer' },
      ],
      [
        ['v0 -> [2,3]', '6'],
        ['v1 -> copied [2,3]', '13'],
        ['shared by v0', '4'],
        ['reachable from v1', '11'],
      ],
    ),
    highlight: { found: ['q0:answer', 'q1:answer'], compare: ['old:answer', 'new:answer'] },
    explanation: 'Persistent trees make time part of the query. This is the same conceptual move as Git commits and MVCC snapshots: old states remain addressable.',
    invariant: 'Version roots are immutable snapshots.',
  };

  yield {
    state: labelMatrix(
      'Applications',
      [
        { id: 'kth', label: 'k-th order statistic' },
        { id: 'undo', label: 'undo history' },
        { id: 'mvcc', label: 'MVCC snapshot' },
        { id: 'audit', label: 'audit trail' },
      ],
      [
        { id: 'how', label: 'how persistence helps' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['compare prefix versions', 'Segment Tree'],
        ['keep old root', 'Git Internals'],
        ['read old version', 'MVCC Internals'],
        ['prove what was known', 'Write-Ahead Log'],
      ],
    ),
    highlight: { found: ['kth:how', 'undo:how', 'mvcc:how', 'audit:how'] },
    explanation: 'Persistence turns a data structure into a timeline. Range queries, undo stacks, historical indexes, and snapshot isolation all use the same sharing idea at different scales.',
  };

  yield {
    state: labelMatrix(
      'Tradeoffs',
      [
        { id: 'memory', label: 'memory' },
        { id: 'gc', label: 'garbage collection' },
        { id: 'updates', label: 'range updates' },
        { id: 'debug', label: 'debugging' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'response', label: 'response' },
      ],
      [
        ['grows with versions', 'retention policy'],
        ['old roots keep nodes live', 'reference tracking'],
        ['lazy tags get tricky', 'copy tag paths carefully'],
        ['aliasing bugs', 'never mutate shared nodes'],
      ],
    ),
    highlight: { active: ['memory:response', 'gc:response', 'updates:response', 'debug:response'] },
    explanation: 'The implementation bug to fear is accidental mutation of a shared node. Once a node is reachable from an old root, treat it as immutable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'path copying') yield* pathCopying();
  else if (view === 'versioned queries') yield* versionedQueries();
  else throw new InputError('Pick a persistent segment tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A persistent segment tree is a segment tree that keeps old versions queryable after updates. Instead of mutating nodes in place, an update copies the nodes on the path from root to leaf and reuses every untouched subtree.',
        'The result is a versioned range-query data structure. Each version is represented by a root pointer. Old roots keep seeing old values; new roots see the updated path.',
        'This is partial persistence in the common competitive-programming sense: historical versions are readable, and new roots are created by controlled updates. It is not the same as snapshotting the whole array. The important object is the root pointer; the root chooses a historical world.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a point update, copy the root, recurse into the child containing the updated index, copy that child, and continue until the leaf. Recompute aggregates on copied nodes. Pointers to untouched children are shared with the previous version.',
        'Queries are ordinary segment-tree queries, except they start from a chosen version root. That means the same range query can return different answers for different versions, without duplicating the whole tree.',
        'The animation shows one updated leaf, but the invariant generalizes. Every copied node owns its children pointers. Every uncopied node is treated as immutable shared history. Once that rule is followed, a version is just a graph reachability boundary: if the root can reach a node, that node belongs to that version.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A point update creates O(log n) new nodes. A range query still takes O(log n) for standard sum/min/max variants. Space after m updates is O(n + m log n). Range updates with lazy propagation are possible but require careful copying of lazy tags.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Persistent segment trees are used in order-statistic queries over prefixes, undoable editors, historical analytics, immutable indexes, functional programming, and competitive-programming range queries. The same path-copying idea appears in Git object graphs, MVCC snapshots, and copy-on-write filesystems.',
        'A classic case study is k-th smallest in a subarray. Build one version per prefix over compressed values. To answer [l, r], subtract counts in root r and root l-1 while descending the value tree. The data structure turns a two-dimensional historical query into a logarithmic walk over shared versions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Persistence does not mean copying everything. The win is structural sharing. It also does not mean old versions are free forever: roots keep nodes alive, so retention and garbage collection matter. The main implementation rule is simple and strict: never mutate a shared node.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Making Data Structures Persistent by Driscoll, Sarnak, Sleator, and Tarjan at https://www.cs.cmu.edu/~sleator/papers/another-persistence.pdf. Study Segment Tree, Sparse Table, Git Internals, MVCC Internals & VACUUM, and Write-Ahead Log next.',
      ],
    },
  ],
};
