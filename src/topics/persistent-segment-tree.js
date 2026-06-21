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
      heading: 'Why this exists',
      paragraphs: [
        'A normal segment tree answers range queries over the current array. Many systems also need a previous array, the state before an edit, or the prefix version at a specific time.',
        { type: 'callout', text: 'Persistence turns a segment tree update into a new root plus a copied path, while untouched subtrees stay shared.' },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Segment_tree.svg',
          alt: 'Segment tree diagram with interval nodes above leaf segments',
          caption: 'A segment tree is already a hierarchy of intervals; persistence reuses the unchanged intervals across versions. Source: Wikimedia Commons.',
        },
        'A persistent segment tree exists to make old versions queryable without copying the whole tree after every update. It turns a range-query structure into a timeline of immutable roots.',
      ],
    },
    {
      heading: 'Naive baseline and wall',
      paragraphs: [
        'The baseline is full snapshotting: after each update, copy the whole array or the whole segment tree. It is easy to reason about, but it costs O(n) space per version.',
        'A second baseline is a log of updates. To answer an old query, replay or undo changes until the right time. That saves space in some workloads, but it makes historical queries depend on the distance through the log.',
        'The wall is that a point update only changes one root-to-leaf path, while ordinary mutation destroys the old path. We want to preserve old answers without paying for unchanged subtrees again.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'Copy only the path that changes. A point update creates a new root, copies one node per level down to the leaf, recomputes copied aggregates on the way back up, and reuses every untouched subtree.',
        'The invariant is reachability immutability: once a node is reachable from an existing version root, future updates must not mutate that node. New versions may point to shared old nodes, but changed nodes are fresh copies.',
        'A version is just a root pointer. Query root v0 and you see the old reachable graph. Query root v1 and you see the copied path plus all unchanged shared subtrees.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the path-copying view, compare the old root v0 with the new root v1. The highlighted new nodes are exactly the copied root-to-leaf path for the updated index. The unhighlighted reused subtrees are the reason the update is O(log n) space instead of O(n).',
        'In the versioned-query view, treat each root as a snapshot handle. The same range query can return different sums because it starts from a different root. The old leaf and new leaf both exist; which one you reach depends on the version root.',
        'The persistence-level table distinguishes partial persistence from full persistence. Most uses query old versions freely but create new versions through controlled update paths, because unconstrained branching and merging add complexity.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'For a point update, copy the current root. Recurse into the child whose interval contains the updated index, copying that child as well. The sibling child is reused. Continue until the leaf, replace the leaf value, then recompute sums or other aggregates on copied ancestors.',
        'Store the returned root pointer as the next version. Nothing about the old root changes. A range query is the ordinary segment-tree query algorithm, except its first argument is the root for the version being queried.',
        'For order-statistic variants, the tree is often built over compressed values instead of array positions. Each prefix version adds one value. A query over subarray [l, r] subtracts counts in root r and root l - 1 while descending the value tree.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The update is correct because a point update changes exactly the intervals that contain the updated index. In a balanced segment tree, those intervals form one root-to-leaf path. Every interval outside that path has the same aggregate as before, so reusing its node preserves the right value.',
        'The old version remains correct because none of its reachable nodes are modified. The new version is correct because every changed interval was copied and recomputed from its children. This is the same induction used for ordinary segment-tree updates, with immutability added to protect old roots.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with [1, 3, 2, 4]. Version 0 has total sum 10. Update index 3 from 4 to 11. Only intervals [0,3], [2,3], and [3] change, so version 1 copies those three nodes and reuses [0,1] and [2].',
        'Now sum [2,3] at v0 follows the old root to the old [2,3] node and returns 2 + 4 = 6. The same query at v1 follows the new root to the copied [2,3] node and returns 2 + 11 = 13. Both answers are available because both roots remain live.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The initial tree costs O(n) space. Each point update creates O(log n) new nodes. A range query remains O(log n). After m point updates, total space is O(n + m log n).',
        'The memory growth is real. Old roots keep shared nodes alive, so retention policy matters. If users can keep every version forever, garbage collection and storage pressure become part of the data-structure design.',
        'Range updates with lazy propagation are possible, but the mutation rules become stricter. Lazy tags and child pointers on shared nodes must be copied before modification. The most common bug is accidentally mutating a node that an old root can still reach.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Represent nodes so sharing is visible. A node should contain its aggregate and child references; an update should allocate new nodes on the changed path and reuse child references for untouched intervals. Avoid helper functions that quietly mutate a child aggregate in place, because that breaks every old root that reaches the child.',
        'Store version roots in a separate array or map with clear retention rules. If the product needs undo for the last 100 edits, old roots beyond that window can be released. If it needs audit history, roots may be durable records and memory compaction becomes a storage design problem.',
        'For lazy range updates, copy before pushing tags. A shared node with a pending tag cannot be pushed into shared children in place. The safe rule is simple: if an operation would change a node or its children, allocate the new version of that part of the graph first.',
      ],
    },
    {
      heading: 'Testing persistence',
      paragraphs: [
        'The best tests compare against plain arrays. Keep an array snapshot for each version, run random point updates and range queries, and assert that every persistent-tree query matches the corresponding array snapshot. Then query older versions after many later updates to prove they did not drift.',
        'Add identity checks when possible. An update to index 3 should reuse the entire left subtree in the example, while copying only the intervals that contain index 3. That confirms the implementation is actually persistent and not secretly rebuilding or mutating too much.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins in undoable editors, historical analytics, immutable indexes, competitive-programming order statistics, audit trails, snapshot reads, and functional-programming settings where old values should remain addressable.',
        'It is especially strong when versions are cheap to create and old queries are common. A root pointer is a compact name for a whole historical state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when versions are not needed. A normal mutable segment tree is simpler, faster in constant factors, and uses less memory.',
        'It also fails if the implementation treats shared nodes casually. One accidental in-place update can silently corrupt older versions. Persistence is a discipline, not just an extra array of roots.',
        'It is not a complete database snapshot system by itself. Authorization, transaction boundaries, compaction, retention, and consistency semantics still need separate design.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Segment Tree first, then compare Persistent Segment Tree with Sparse Table for static queries and Fenwick Tree for mutable prefix aggregates. For systems analogies, study Git Internals, MVCC Internals & VACUUM, and Write-Ahead Log.',
        'For the theory foundation, read Driscoll, Sarnak, Sleator, and Tarjan on making data structures persistent.',
      ],
    },
  ],
};
