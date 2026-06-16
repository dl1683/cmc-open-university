// B-epsilon tree / fractal-tree style index: keep the B-tree search skeleton,
// but buffer update messages in internal nodes and flush them downward in batches.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'b-epsilon-tree-write-optimized-index',
  title: 'B-Epsilon Tree Write-Optimized Index',
  category: 'Data Structures',
  summary: 'A write-optimized tree between B-trees and LSMs: internal nodes keep buffers of update messages, then flush batches down the search path.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['buffered writes', 'B-tree vs LSM'], defaultValue: 'buffered writes' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* bufferedWrites() {
  yield {
    state: graphState({
      nodes: [
        { id: 'write', label: 'write', x: 0.8, y: 4.0, note: 'message' },
        { id: 'rootBuf', label: 'root buf', x: 2.6, y: 4.0, note: 'batch' },
        { id: 'childBuf', label: 'child buf', x: 4.5, y: 4.0, note: 'flush' },
        { id: 'leaf', label: 'leaf', x: 6.4, y: 4.0, note: 'sorted' },
        { id: 'range', label: 'range scan', x: 8.4, y: 4.0, note: 'ordered' },
      ],
      edges: [
        { id: 'e-write-root', from: 'write', to: 'rootBuf' },
        { id: 'e-root-child', from: 'rootBuf', to: 'childBuf' },
        { id: 'e-child-leaf', from: 'childBuf', to: 'leaf' },
        { id: 'e-leaf-range', from: 'leaf', to: 'range' },
      ],
    }, { title: 'A B-Epsilon tree buffers updates inside the search tree' }),
    highlight: { active: ['rootBuf', 'childBuf'], found: ['leaf', 'range'] },
    explanation: 'A B-Epsilon tree keeps the ordered-tree skeleton of a B-tree, but inserts, deletes, and upserts enter as messages buffered in internal nodes. Full buffers flush many messages downward at once.',
    invariant: 'The tree remains ordered; writes are delayed and batched along the path to the leaf.',
  };

  yield {
    state: labelMatrix(
      'Messages in internal nodes',
      [
        { id: 'insert', label: 'insert k=52' },
        { id: 'delete', label: 'delete k=17' },
        { id: 'upsert', label: 'upsert k=31' },
        { id: 'flush', label: 'flush batch' },
      ],
      [
        { id: 'storedAs', label: 'stored as' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['message', 'delay leaf write'],
        ['message', 'tombstone-like'],
        ['message', 'combine later'],
        ['many messages', 'amortize I/O'],
      ],
    ),
    highlight: { active: ['insert:storedAs', 'delete:storedAs', 'upsert:storedAs'], found: ['flush:effect'] },
    explanation: 'The buffer does not have to store only final values. It can store operations. That is why upserts are natural: the tree can postpone read-modify-write work and apply messages when they reach lower levels.',
  };

  yield {
    state: labelMatrix(
      'Lookup path',
      [
        { id: 'root', label: 'root' },
        { id: 'mid', label: 'middle node' },
        { id: 'leaf', label: 'leaf' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'treeKeys', label: 'separator keys' },
        { id: 'messages', label: 'buffer messages' },
      ],
      [
        ['choose child', 'pending ops'],
        ['choose child', 'pending ops'],
        ['base value', 'none or applied'],
        ['visible value', 'merge path'],
      ],
    ),
    highlight: { active: ['root:messages', 'mid:messages', 'leaf:treeKeys'], found: ['answer:messages'] },
    explanation: 'A point lookup descends like a B-tree, but it must also account for buffered messages along the path. The visible value is the leaf value plus any newer operations that have not flushed all the way down.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'buffer size per node', min: 0, max: 100 }, y: { label: 'write cost per update', min: 0, max: 100 } },
      series: [
        { id: 'btree', label: 'B-tree page update', points: [{ x: 0, y: 76 }, { x: 100, y: 76 }] },
        { id: 'bepsilon', label: 'B-Epsilon batched flush', points: [{ x: 5, y: 70 }, { x: 35, y: 38 }, { x: 70, y: 24 }, { x: 100, y: 18 }] },
      ],
    }),
    highlight: { active: ['bepsilon'], compare: ['btree'] },
    explanation: 'The graph is conceptual: bigger buffers mean each disk write carries more useful messages. That lowers amortized write cost, at the price of more buffered state to consider during reads and recovery.',
  };
}

function* btreeVsLsm() {
  yield {
    state: labelMatrix(
      'Three storage shapes',
      [
        { id: 'btree', label: 'B-tree' },
        { id: 'beps', label: 'B-Epsilon tree' },
        { id: 'lsm', label: 'LSM tree' },
      ],
      [
        { id: 'writes', label: 'writes' },
        { id: 'reads', label: 'reads' },
        { id: 'range', label: 'range scans' },
      ],
      [
        ['page updates', 'direct path', 'ordered leaves'],
        ['buffered messages', 'path + buffers', 'ordered leaves'],
        ['append runs', 'many levels', 'merge runs'],
      ],
    ),
    highlight: { found: ['beps:writes', 'beps:range'], compare: ['btree:writes', 'lsm:reads'] },
    explanation: 'B-Epsilon trees deliberately sit between the familiar shapes. They keep an ordered tree with range scans, but they batch small writes by delaying messages through internal buffers.',
    invariant: 'The design is not "faster B-tree"; it is a different point in the external-memory tradeoff space.',
  };

  yield {
    state: labelMatrix(
      'Where the complexity moves',
      [
        { id: 'insert', label: 'insert' },
        { id: 'lookup', label: 'lookup' },
        { id: 'crash', label: 'crash recovery' },
        { id: 'space', label: 'space use' },
      ],
      [
        { id: 'simpleStory', label: 'simple story' },
        { id: 'realIssue', label: 'real issue' },
      ],
      [
        ['append to buffer', 'flush scheduling'],
        ['follow tree', 'apply messages'],
        ['log writes', 'replay buffers'],
        ['compress nodes', 'buffer overhead'],
      ],
    ),
    highlight: { active: ['insert:realIssue', 'lookup:realIssue', 'crash:realIssue'], found: ['space:simpleStory'] },
    explanation: 'The idea is simple; the implementation is not. Correctness has to cover buffered deletes, upserts, searches that see unflushed messages, node splits, compression, and crash recovery.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'db', label: 'TokuDB', x: 0.8, y: 4.0, note: 'engine' },
        { id: 'fractal', label: 'fractal tree', x: 2.8, y: 4.0, note: 'buffers' },
        { id: 'betrfs', label: 'BetrFS', x: 4.9, y: 4.0, note: 'file system' },
        { id: 'woi', label: 'write opt', x: 6.9, y: 4.0, note: 'theory' },
        { id: 'lesson', label: 'lesson', x: 8.7, y: 4.0, note: 'batch I/O' },
      ],
      edges: [
        { id: 'e-db-fractal', from: 'db', to: 'fractal' },
        { id: 'e-fractal-betrfs', from: 'fractal', to: 'betrfs' },
        { id: 'e-betrfs-woi', from: 'betrfs', to: 'woi' },
        { id: 'e-woi-lesson', from: 'woi', to: 'lesson' },
      ],
    }, { title: 'Case studies: database engine and file-system storage' }),
    highlight: { active: ['fractal', 'betrfs'], found: ['lesson'] },
    explanation: 'Tokutek commercialized fractal-tree indexing in TokuDB; BetrFS explored B-Epsilon trees inside a file system. Both show the same principle: schedule small random changes into larger useful I/O.',
  };

  yield {
    state: labelMatrix(
      'When to consider it',
      [
        { id: 'randomWrites', label: 'random writes' },
        { id: 'rangeQueries', label: 'range queries' },
        { id: 'simpleEngine', label: 'simple engine' },
        { id: 'hotPointReads', label: 'hot point reads' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'batched flush'],
        ['strong', 'ordered leaves'],
        ['weak', 'complex code'],
        ['mixed', 'buffer checks'],
      ],
    ),
    highlight: { found: ['randomWrites:fit', 'rangeQueries:fit'], compare: ['simpleEngine:reason', 'hotPointReads:reason'] },
    explanation: 'The structure is most compelling when small random writes and range locality both matter. It is less compelling when implementation simplicity or ultra-lean point lookups dominate.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'buffered writes') yield* bufferedWrites();
  else if (view === 'B-tree vs LSM') yield* btreeVsLsm();
  else throw new InputError('Pick a B-Epsilon tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A B-Epsilon tree is a write-optimized external-memory dictionary. It keeps the ordered, high-fanout search-tree shape of a B-tree, but each internal node has a buffer. Inserts, deletes, and upserts enter as messages. When a buffer fills, the tree flushes a batch of messages down to children.',
        'This makes the structure a bridge between B-trees and LSM trees. A B-tree updates the target leaf path immediately. An LSM accepts writes into memory and later compacts immutable runs. A B-Epsilon tree keeps a navigable tree but delays work inside the tree itself, turning many small writes into fewer larger flushes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The tree stores separator keys in internal nodes so searches can choose child ranges. The difference is that internal nodes also hold operation messages destined for lower nodes. A write can stop at an upper buffer. Later, when enough messages accumulate, a flush pushes all messages for one or more child ranges downward in a batch.',
        'A lookup descends through the tree and must account for buffered messages along the path. If the leaf says one value but an ancestor buffer contains a newer delete or upsert for the same key, the visible answer must include that pending operation. Range scans benefit from sorted leaves, but they also need the system to reconcile or flush relevant buffered messages correctly.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The win is amortization. A B-tree page write may update only one record. A B-Epsilon flush can move many messages with one I/O. That improves random-write throughput while preserving ordered access. The cost is implementation complexity: message ordering, node splitting, buffer eviction, compression, crash recovery, and read visibility all need careful engineering.',
        'The epsilon parameter describes how node space is divided between fanout and buffers in the theoretical model. More fanout helps searches; more buffer space helps writes. The practical lesson is simpler: pick a buffer and fanout design that matches the storage device and workload.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Percona documents TokuDB fractal-tree indexes as tree structures with node buffers where insertions, deletions, and updates are stored as messages. BetrFS is an in-kernel file system that used B-Epsilon trees to organize on-disk storage and reported the value of write-optimized indexing for small random writes and large scans. The USENIX ;login: introduction by Bender and collaborators explains the structure as a practical write-optimized data structure between B-trees and buffered repository trees.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat a B-Epsilon tree as a drop-in B-tree with one extra array. The read path, recovery protocol, split logic, and range scan semantics all change because pending messages are part of the logical state. A crash-safe implementation still needs a Write-Ahead Log or equivalent persistence discipline.',
        'It is also not simply an LSM tree. LSM compaction merges sorted runs outside the tree. B-Epsilon trees keep messages inside a tree and flush them downward. Both batch writes, but their read paths, range locality, and cleanup mechanisms are different.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: USENIX B-Epsilon tree introduction at https://www.usenix.org/publications/login/oct15/bender, PDF at https://www3.cs.stonybrook.edu/~bender/newpub/2015-BenderFaJa-login-wods.pdf, Percona TokuDB fractal-tree indexing docs at https://docs.percona.com/percona-server/8.0/tokudb-fractal-tree-indexing.html, BetrFS project page at https://www.betrfs.org/, and FAST 2015 BetrFS paper page at https://www.usenix.org/conference/fast15/technical-sessions/presentation/jannen. Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, LSM Tree, LSM Compaction Strategies Primer, SSTable Block Index & Filter, Write-Ahead Log, Database Indexing, and RocksDB LSM Case Study next.',
      ],
    },
  ],
};
