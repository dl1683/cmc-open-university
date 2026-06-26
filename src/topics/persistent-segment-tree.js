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
  const arr = [1, 3, 2, 4];
  const updateIdx = 3;
  const oldVal = 4;
  const newVal = 11;
  const totalSum = arr.reduce((a, b) => a + b, 0);
  const pathLen = Math.ceil(Math.log2(arr.length));

  yield {
    state: versionGraph('Version 0 stores sums for [1, 3, 2, 4]', false),
    highlight: { active: ['v0', 'a'], found: ['b', 'c'] },
    explanation: `A normal Segment Tree stores aggregate values over ${arr.length} intervals built from [${arr.join(', ')}]. A persistent segment tree keeps old versions by never mutating nodes that old roots can reach.`,
  };

  yield {
    state: versionGraph('Update index 3 from 4 to 11: copy only the path', true),
    highlight: { active: ['v1', 'a1', 'c1', 'g1'], compare: ['b', 'f'], found: ['v0'] },
    explanation: `Updating index ${updateIdx} from ${oldVal} to ${newVal} copies the root-to-leaf path (${pathLen} levels) and reuses every untouched subtree. Version 0 still points to old nodes with sum ${totalSum}. Version 1 points to new nodes where sums changed and shared nodes where they did not.`,
    invariant: `Persistence is sharing plus immutability: only ${pathLen + 1} nodes are copied to update one of ${arr.length} leaves.`,
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
    explanation: `Copying the whole tree per version would be O(n) per update. Path copying makes point updates O(log n) new nodes — here ${pathLen + 1} nodes for an array of ${arr.length} — while preserving access to every old root.`,
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
    explanation: `Most persistent segment tree uses are partially persistent: query any old version, but create new versions only from the latest. Our example creates version 1 by updating index ${updateIdx} from ${oldVal} to ${newVal} while version 0 remains queryable.`,
  };
}

function* versionedQueries() {
  const updateIdx = 3;
  const oldVal = 4;
  const newVal = 11;
  const oldSum = 6;
  const newSum = 13;

  yield {
    state: versionGraph('Two roots expose two histories', true),
    highlight: { active: ['v0', 'v1'], compare: ['g', 'g1'] },
    explanation: `A version is just a root pointer. Query version 0 through root v0 and index ${updateIdx} is still ${oldVal}. Query version 1 through root v1 and index ${updateIdx} is ${newVal}.`,
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
    explanation: `Persistent trees make time part of the query. Sum [2,3] at v0 returns ${oldSum}, at v1 returns ${newSum} — same range, different version root, different answer. This is the same conceptual move as Git commits and MVCC snapshots.`,
    invariant: `Version roots are immutable snapshots: leaf [${updateIdx}] is ${oldVal} through v0 and ${newVal} through v1.`,
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
    explanation: `Persistence turns a data structure into a timeline. The update at index ${updateIdx} (${oldVal} to ${newVal}) created a new version without destroying the old one. Range queries, undo stacks, historical indexes, and snapshot isolation all use this sharing idea.`,
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
    explanation: `The implementation bug to fear is accidental mutation of a shared node. Once a node is reachable from an old root — like the leaf [${updateIdx}] = ${oldVal} in v0 — treat it as immutable. Modifying it would silently corrupt version 0.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each root pointer as a version name. Active nodes are the copied nodes on the update path, while unhighlighted shared nodes are still reachable from older roots and must not be mutated.',
        {type: 'image', src: './assets/gifs/persistent-segment-tree.gif', alt: 'Animated walkthrough of the persistent segment tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the query view, the same interval can produce different answers because the traversal starts from a different root. The safe inference is that version identity is carried by the root pointer, not by timestamps stored inside every node.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A segment tree answers range queries over an array by storing aggregate values on intervals. A persistent segment tree keeps older versions queryable after updates, so time becomes part of the query.',
        { type: 'callout', text: 'Persistence turns a segment tree update into a new root plus a copied path, while untouched subtrees stay shared.' },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Segment_tree.svg',
          alt: 'Segment tree diagram with interval nodes above leaf segments',
          caption: 'A segment tree is already a hierarchy of intervals; persistence reuses the unchanged intervals across versions. Source: Wikimedia Commons.',
        },
        'This exists for undo, audit history, snapshot reads, and historical indexes. The goal is to preserve old answers without copying the whole array or replaying a long edit log for every old query.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full snapshotting. After every update, copy the whole array or rebuild the whole segment tree, then store that copy as the next version.',
        'A second approach is an update log. Store every mutation and reconstruct an old version by replaying or undoing operations until the target time is reached.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Full snapshotting spends O(n) space per version even when one point changed. With a million elements and ten thousand edits, the copies dominate the data the user actually changed.',
        'An update log makes historical queries depend on distance through time. A query for an old snapshot may need many replay steps, which turns a range query into a history-reconstruction problem.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A point update changes only intervals that contain the updated index. In a balanced segment tree, those intervals form one root-to-leaf path.',
        'Copy that path, recompute aggregates on the copied nodes, and reuse every untouched subtree. The invariant is reachability immutability: once a node is reachable from an old root, future updates never mutate it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To update an index, allocate a new root. Recurse into the child interval that contains the index, copying that child, while the sibling pointer is reused unchanged.',
        'At the leaf, store the new value in a fresh leaf node. On the way back up, recompute each copied aggregate from its children and return the new root as the next version.',
        'A range query is the ordinary segment-tree query with one extra argument: the version root. Querying v0 walks the old graph, and querying v1 walks the copied path where the update changed the relevant intervals.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The update is correct because the only changed aggregates are intervals containing the updated index. Every interval outside that path has the same contents as before, so reusing its node preserves the right value.',
        'Old versions remain correct because their reachable nodes are not modified. New versions are correct by the same induction as an ordinary segment-tree update: copied leaves are correct, and copied parents recompute from correct children.',
        'Sharing is safe only under immutability. If a shared child is changed in place, every older root that reaches it is silently corrupted, so copy-before-write is the proof obligation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The initial tree uses O(n) nodes. Each point update copies O(log n) nodes, and each range query still takes O(log n) time in a balanced segment tree.',
        'After m point updates, total node count is O(n + m log n). When n doubles, tree height grows by one, so each update copies one more node level rather than doubling update cost.',
        'The hidden cost is retention. Old roots keep shared nodes live, so memory use depends on how many versions the application keeps and how quickly unused roots can be released.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Competitive-programming order-statistic queries use persistent segment trees over value counts. Prefix roots let a query over subarray [l, r] subtract root l - 1 from root r while descending to the k-th value.',
        'Undo systems and historical analytics use the same idea. A root pointer gives a cheap name to a whole past state, so users can query old data without replaying every edit.',
        'Snapshot isolation in databases is a systems-level cousin. The exact structures differ, but the contract is similar: readers see an immutable historical view while writers create newer versions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when old versions are not needed. A mutable segment tree has smaller constants, fewer allocations, simpler cache behavior, and less garbage-collection pressure.',
        'It becomes tricky with lazy range updates. Tags on shared nodes cannot be pushed into children in place, so the implementation must copy every node whose tag or child pointer would change.',
        'It is not a complete storage system. Version authorization, retention, compaction, serialization, and transaction semantics must be designed around the data structure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with array [1, 3, 2, 4]. Version 0 has total sum 10, and the interval [2,3] has sum 2 + 4 = 6.',
        'Update index 3 from 4 to 11. The changed intervals are [3], [2,3], and [0,3], so version 1 copies exactly those nodes and reuses the [0,1] subtree and the [2] leaf.',
        'Now sum [2,3] at v0 still follows the old root to the old [2,3] node and returns 6. The same query at v1 follows the new root to the copied [2,3] node and returns 2 + 11 = 13.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The theory source is Driscoll, Sarnak, Sleator, and Tarjan, Making Data Structures Persistent. It explains partial and full persistence and the copy-on-update discipline behind structures like this one.',
        'Study Segment Tree first, then Fenwick Tree and Sparse Table for neighboring range-query tradeoffs. For systems analogies, study Git Internals, MVCC snapshot isolation, and Write-Ahead Log.',
      ],
    },
  ],
};
