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
    explanation: 'The first graph shows the whole idea: keep the ordered search-tree skeleton, but let writes stop in internal buffers as messages. When a buffer fills, many messages flush downward together instead of forcing one leaf write per update.',
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
    explanation: 'The message table is the key mental shift. Buffers can hold operations, not just final values. Inserts, deletes, and upserts can be delayed, combined, and applied when they reach lower levels.',
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
    explanation: 'The lookup table shows the cost of delayed writes. A search still follows separator keys like a B-tree, but the visible value must include newer messages sitting in buffers along the path.',
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
    explanation: 'The plot is conceptual but useful. Bigger buffers make each flush carry more updates, lowering amortized write cost. The price is more buffered state for lookups, range scans, memory management, and recovery.',
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
    explanation: 'The comparison table places B-Epsilon trees between B-trees and LSMs. They preserve an ordered tree for range access while batching small writes through internal buffers.',
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
    explanation: 'The complexity table is the warning. The simple story is "buffer writes"; the real system must define message order, delete visibility, upsert application, splits, compression, and crash recovery.',
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
    explanation: 'The case-study graph links theory to systems. TokuDB used fractal-tree indexing in a database engine, and BetrFS explored the same write-optimized idea inside a file system: convert small random changes into larger useful I/O.',
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
    explanation: 'The final table is the fit test. B-Epsilon trees are attractive when random writes and ordered range locality both matter. They are less attractive when simple implementation or the leanest possible point lookups matter more.',
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
      heading: 'Why this exists',
      paragraphs: [
        'A B-Epsilon tree exists because ordinary B-trees have a painful weakness: many small random updates. A B-tree is excellent when searches and range scans dominate. Its high fanout makes the tree shallow, and sorted leaves give clean ordered traversal. But an insert, delete, or update usually has to travel to the target leaf and modify a page near the bottom of the tree. On disk or flash, many independent leaf changes can become many small writes.',
        'The write-optimized question is direct: can an index keep the ordered search shape of a B-tree while batching random updates like a log-structured system? A B-Epsilon tree answers by putting buffers inside internal tree nodes. A user update becomes a message. The message may stop in an upper node, wait with other messages, and later flush downward in a batch.',
        'This is not just a faster implementation trick. It changes the contract of the tree. The logical state is no longer only the values stored at leaves. It includes pending messages stored along the search path. The tree remains ordered, but update application is delayed.',
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        'The naive B-tree update path is eager. Find the leaf, insert or modify the key, split if needed, and propagate separator changes upward. This is simple and gives clean reads, but it has weak amortization. If one million inserts hit one million scattered leaves, the engine touches and writes many pages even if the writes are tiny.',
        'A second naive fix is to keep a separate log of updates and periodically rebuild the tree. That improves ingest but gives up the clean point-lookup and range-scan behavior of the tree until the log is reconciled. It starts to look like an LSM tree with sorted runs and compaction, which is a valid design, but not the same point in the design space.',
        'The B-Epsilon tree tries to avoid both walls. It keeps a real search tree online, but it refuses to pay leaf-update cost for every individual operation. The cost is moved into buffered flushes, lookup reconciliation, and more complex recovery.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The visual model separates the search skeleton from the buffered write path. The graph starts with a user write, stops it in an internal buffer, then flushes a batch toward the leaf. That is the whole design pressure: the tree still has separator keys and ordered leaves, but update messages are allowed to wait above their final location.',
        'The lookup table is the part many short explanations skip. A search cannot just descend to a leaf and return what it sees there. It must merge the leaf state with newer messages found on the path. The visual model therefore teaches both halves of the data structure: batched movement for writes and path reconciliation for reads.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'The core insight is to make internal nodes carry deferred operations, not only routing keys. The invariant is that the key space remains partitioned by the tree, while each buffered message is stored at a node whose subtree contains that message key. The message has not reached the leaf yet, but it is still part of the visible logical database.',
        'Each internal node has two jobs. The first job is the familiar B-tree job: separator keys route a search to the correct child range. The second job is buffering: the node can store messages whose keys belong somewhere below that node. A message might mean insert key 52, delete key 17, increment a counter, replace a value, or apply an upsert function.',
        'A write begins at the root. Instead of immediately descending to the leaf, the tree can append the operation to the root buffer. When that buffer becomes large enough, the implementation chooses a child range and flushes all relevant messages for that child downward together. The child may store them in its own buffer or, if the child is a leaf, apply them to leaf entries. One I/O can move many logical updates.',
        'The parameter epsilon describes how node space is divided between pivots and buffers in the theoretical model. More buffer space gives larger batches and lower amortized write cost. More pivot space gives higher fanout and shorter search paths. The name B-Epsilon tree points at that tunable balance, not at one fixed layout.',
      ],
    },
    {
      heading: 'Lookup and scan semantics',
      paragraphs: [
        'A lookup still follows separator keys from root to leaf, but it cannot trust the leaf alone. A newer message may be sitting in an ancestor buffer. The lookup must combine the base leaf value with messages encountered along the path in the correct order. If the leaf says k=31 has value A and an ancestor buffer contains delete k=31, the visible answer is absent. If a newer upsert is buffered, the answer must apply it.',
        'Range scans are also more subtle than in a plain B+ tree. The leaves can still be sorted and linked, which is valuable. But a scan over key range 20 through 80 must account for buffered messages above the leaves that affect keys in that range. Real systems use buffering rules, message ordering, and sometimes flush-before-scan choices to keep range results correct without destroying the write benefit.',
        'This is the central tradeoff: writes get cheaper because work is delayed and batched, but reads now include pending work. A B-Epsilon tree is powerful only if the workload and implementation can afford that reconciliation cost.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The performance idea is amortization. Suppose a disk page write is expensive and a node buffer can hold thousands of update messages. Flushing one message to a child would be wasteful. Flushing a large batch spreads the page I/O cost across many logical operations. If many messages target nearby key ranges, the structure turns scattered user writes into larger organized movement through the tree.',
        'The ordered tree skeleton matters because it keeps locality. An LSM tree also batches writes, but it places data into immutable runs and later compacts those runs. A B-Epsilon tree keeps update messages attached to the tree path that already partitions the key space. That can preserve range locality better for some workloads, especially when scans over ordered keys remain important.',
        'The design does not remove work. It changes when and where work happens. Leaf pages still eventually change. Deleted keys still need cleanup. Splits still happen. The difference is that the system can schedule many updates together instead of letting each user operation force immediate bottom-level work.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        'Imagine a file system metadata index keyed by path or inode. A build job creates, renames, edits, and deletes thousands of small files spread across many directories. A traditional B-tree can spend much of its time rewriting metadata pages for tiny changes. A B-Epsilon tree can accept those operations as messages in upper buffers, then flush groups of updates toward the affected directory ranges.',
        'Now consider the read side. A command listing one directory needs a correct ordered range scan. The scan must include files that already reached leaves, hide files deleted by buffered messages, and include newly created entries that are still waiting in an internal buffer. If the implementation gets message visibility wrong, users see missing files, resurrected names, or duplicate entries.',
        'This example explains both the promise and the difficulty. The structure can make metadata-heavy workloads much faster, but only if the system treats messages as durable, ordered, query-visible state.',
      ],
    },
    {
      heading: 'How it compares',
      paragraphs: [
        'Compared with a B-tree, a B-Epsilon tree sacrifices immediate leaf cleanliness for better write batching. Point reads may be more expensive because they must check buffers on the path. Range scans may need reconciliation. The implementation is harder. In exchange, random write workloads can become dramatically more sequential and batched.',
        'Compared with an LSM tree, a B-Epsilon tree keeps a tree-shaped routing structure with buffered messages inside it. LSMs usually buffer in memory, flush sorted files, and compact runs across levels. Both are write optimized, but they put deferred work in different places. LSM read cost comes from searching multiple components. B-Epsilon read cost comes from applying pending path messages and maintaining tree invariants.',
        'Compared with a log-only design, the B-Epsilon tree gives more organized search and range access. Compared with a pure append-only rebuild system, it keeps the index continuously navigable. That is why it is best understood as its own external-memory data structure rather than as a small variant of another tree.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Implementation starts with message semantics. Define whether messages commute, how repeated updates to the same key coalesce, how deletes interact with older inserts, and how sequence numbers determine visibility. An insert-only benchmark can hide this hard part. Real indexes need replacement, deletion, range scans, snapshots, and recovery to agree on the same order.',
        'Flush scheduling is the control loop. A simple policy flushes the fullest buffer child, but production systems must also consider hot ranges, background bandwidth, node splits, memory pressure, compression, and foreground read latency. Large buffers lower amortized write cost, yet they can make point reads and scans pay more reconciliation cost.',
        'Crash recovery must treat buffered messages as first-class data. A write accepted into an internal buffer is durable logical state even if it has not reached a leaf. The WAL or equivalent recovery log has to restore message order, replay partially flushed batches safely, and avoid applying the same message twice.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The first failure mode is treating buffered messages as an in-memory convenience. In a storage engine, buffers must be durable or reconstructable. A crash between accepting a message and applying it to a leaf cannot lose the operation. The WAL, message sequence numbers, flush ordering, and recovery process are part of the data structure contract.',
        'The second failure mode is weak read semantics. Deletes, upserts, and repeated updates to the same key must compose in the right order. A range scan cannot ignore messages because they are inconvenient. If the system flushes aggressively before reads to simplify correctness, it may give back the write benefit that justified the structure.',
        'The third failure mode is uncontrolled buffer growth or poor flush scheduling. If the tree keeps delaying work without enough background capacity, it can build its own version of compaction debt. The system needs policies for choosing which child to flush, splitting nodes, compressing or coalescing messages, and protecting foreground latency.',
      ],
    },
    {
      heading: 'Where it wins and where it is used',
      paragraphs: [
        'TokuDB popularized fractal-tree indexes in a database engine. Percona documentation describes insertions, deletions, and updates as messages stored in node buffers, then propagated down the tree. BetrFS explored B-Epsilon trees in a file system, where write-optimized indexing is valuable because file-system metadata workloads often contain many small random changes mixed with directory scans.',
        'The design family is relevant when random writes and ordered access both matter: metadata-heavy file systems, update-heavy secondary indexes, storage engines with large range scans, and systems that need better write batching than a B-tree but do not want the exact read path of an LSM.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources include the USENIX ;login: article introducing B-Epsilon trees, the Bender et al. write-optimized data structure papers, Percona TokuDB fractal-tree indexing documentation, the BetrFS project material, and the FAST 2015 BetrFS paper. The important ideas to track are node buffers, operation messages, flush scheduling, amortized I/O, and query visibility.',
        'Next topics in this curriculum: B-Trees, B+ Tree Leaf Sibling Scan Case Study, Database Indexing, LSM Tree, LSM Compaction Strategies Primer, RocksDB LSM Case Study, SSTable Block Index & Filter, Write-Ahead Log, Bw-Tree Delta Chain & Mapping Table, and Filesystem Extent Tree & Delayed Allocation.',
      ],
    },
  ],
};
