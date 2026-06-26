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
  const nodes = [
    { id: 'write', label: 'write', x: 0.8, y: 4.0, note: 'message' },
    { id: 'rootBuf', label: 'root buf', x: 2.6, y: 4.0, note: 'batch' },
    { id: 'childBuf', label: 'child buf', x: 4.5, y: 4.0, note: 'flush' },
    { id: 'leaf', label: 'leaf', x: 6.4, y: 4.0, note: 'sorted' },
    { id: 'range', label: 'range scan', x: 8.4, y: 4.0, note: 'ordered' },
  ];
  yield {
    state: graphState({
      nodes,
      edges: [
        { id: 'e-write-root', from: 'write', to: 'rootBuf' },
        { id: 'e-root-child', from: 'rootBuf', to: 'childBuf' },
        { id: 'e-child-leaf', from: 'childBuf', to: 'leaf' },
        { id: 'e-leaf-range', from: 'leaf', to: 'range' },
      ],
    }, { title: 'A B-Epsilon tree buffers updates inside the search tree' }),
    highlight: { active: ['rootBuf', 'childBuf'], found: ['leaf', 'range'] },
    explanation: `The first graph shows the whole idea across ${nodes.length} stages: keep the ordered search-tree skeleton, but let writes stop in internal buffers as messages. When a buffer fills, many messages flush downward together instead of forcing one leaf write per update.`,
    invariant: 'The tree remains ordered; writes are delayed and batched along the path to the leaf.',
  };

  const opKeys = [52, 17, 31];
  yield {
    state: labelMatrix(
      'Messages in internal nodes',
      [
        { id: 'insert', label: `insert k=${opKeys[0]}` },
        { id: 'delete', label: `delete k=${opKeys[1]}` },
        { id: 'upsert', label: `upsert k=${opKeys[2]}` },
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
    explanation: `The message table is the key mental shift. Buffers can hold operations on keys like ${opKeys[0]}, ${opKeys[1]}, and ${opKeys[2]} — not just final values. Inserts, deletes, and upserts can be delayed, combined, and applied when they reach lower levels.`,
  };

  const lookupLevels = ['root', 'middle node', 'leaf', 'answer'];
  yield {
    state: labelMatrix(
      'Lookup path',
      [
        { id: 'root', label: lookupLevels[0] },
        { id: 'mid', label: lookupLevels[1] },
        { id: 'leaf', label: lookupLevels[2] },
        { id: 'answer', label: lookupLevels[3] },
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
    explanation: `The lookup table shows the cost of delayed writes across ${lookupLevels.length} levels. A search still follows separator keys like a B-tree, but the visible value must include newer messages sitting in buffers along the path from ${lookupLevels[0]} to ${lookupLevels[2]}.`,
  };

  const btreeBaseline = 76;
  const bepsilonMin = 18;
  yield {
    state: plotState({
      axes: { x: { label: 'buffer size per node', min: 0, max: 100 }, y: { label: 'write cost per update', min: 0, max: 100 } },
      series: [
        { id: 'btree', label: 'B-tree page update', points: [{ x: 0, y: btreeBaseline }, { x: 100, y: btreeBaseline }] },
        { id: 'bepsilon', label: 'B-Epsilon batched flush', points: [{ x: 5, y: 70 }, { x: 35, y: 38 }, { x: 70, y: 24 }, { x: 100, y: bepsilonMin }] },
      ],
    }),
    highlight: { active: ['bepsilon'], compare: ['btree'] },
    explanation: `The plot is conceptual but useful. Bigger buffers make each flush carry more updates, lowering amortized write cost from ${btreeBaseline} (B-tree baseline) toward ${bepsilonMin}. The price is more buffered state for lookups, range scans, memory management, and recovery.`,
  };
}

function* btreeVsLsm() {
  const storageShapes = ['B-tree', 'B-Epsilon tree', 'LSM tree'];
  yield {
    state: labelMatrix(
      'Three storage shapes',
      [
        { id: 'btree', label: storageShapes[0] },
        { id: 'beps', label: storageShapes[1] },
        { id: 'lsm', label: storageShapes[2] },
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
    explanation: `The comparison table places ${storageShapes[1]}s between ${storageShapes[0]}s and ${storageShapes[2]}s. They preserve an ordered tree for range access while batching small writes through internal buffers.`,
    invariant: 'The design is not "faster B-tree"; it is a different point in the external-memory tradeoff space.',
  };

  const complexityAreas = ['insert', 'lookup', 'crash recovery', 'space use'];
  yield {
    state: labelMatrix(
      'Where the complexity moves',
      [
        { id: 'insert', label: complexityAreas[0] },
        { id: 'lookup', label: complexityAreas[1] },
        { id: 'crash', label: complexityAreas[2] },
        { id: 'space', label: complexityAreas[3] },
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
    explanation: `The complexity table is the warning across ${complexityAreas.length} areas. The simple story is "buffer writes"; the real system must define message order, delete visibility, upsert application, splits, compression, and ${complexityAreas[2]}.`,
  };

  const caseStudies = [
    { id: 'db', label: 'TokuDB', note: 'engine' },
    { id: 'betrfs', label: 'BetrFS', note: 'file system' },
  ];
  yield {
    state: graphState({
      nodes: [
        { id: 'db', label: caseStudies[0].label, x: 0.8, y: 4.0, note: caseStudies[0].note },
        { id: 'fractal', label: 'fractal tree', x: 2.8, y: 4.0, note: 'buffers' },
        { id: 'betrfs', label: caseStudies[1].label, x: 4.9, y: 4.0, note: caseStudies[1].note },
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
    explanation: `The case-study graph links theory to systems. ${caseStudies[0].label} used fractal-tree indexing in a ${caseStudies[0].note}, and ${caseStudies[1].label} explored the same write-optimized idea inside a ${caseStudies[1].note}: convert small random changes into larger useful I/O.`,
  };

  const fitRows = [
    { id: 'randomWrites', label: 'random writes', fit: 'strong' },
    { id: 'rangeQueries', label: 'range queries', fit: 'strong' },
    { id: 'simpleEngine', label: 'simple engine', fit: 'weak' },
    { id: 'hotPointReads', label: 'hot point reads', fit: 'mixed' },
  ];
  const strongCount = fitRows.filter(r => r.fit === 'strong').length;
  yield {
    state: labelMatrix(
      'When to consider it',
      fitRows.map(r => ({ id: r.id, label: r.label })),
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
    explanation: `The final table is the fit test with ${fitRows.length} workload types. B-Epsilon trees are attractive for the ${strongCount} strong-fit cases (${fitRows[0].label} and ${fitRows[1].label}) and less attractive when simple implementation or the leanest possible point lookups matter more.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The "buffered writes" view shows a five-stage pipeline graph: a user write enters the root buffer, waits with other messages, then flushes to a child buffer and eventually reaches a leaf. Active highlights mark the internal buffers where messages accumulate. Found highlights mark the leaf and range-scan output where final values live.',
        'The message table shows three operations (insert k=52, delete k=17, upsert k=31) stored as deferred messages inside internal nodes. The key idea: these are not final values but pending operations that will be applied later. The flush row shows how many messages move together in one I/O.',
        'The lookup-path table traces a read from root to leaf, showing that each level may hold pending messages that affect the answer. The plot compares amortized write cost as buffer size grows: the B-tree baseline stays flat while the B-Epsilon curve drops, illustrating the core tradeoff.',
        {type: 'image', src: './assets/gifs/b-epsilon-tree-write-optimized-index.gif', alt: 'Animated walkthrough of the b epsilon tree write optimized index visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A B-tree is the standard on-disk index for databases and file systems. It keeps keys sorted across wide, page-sized nodes so that a search touches only a few disk pages. For read-heavy workloads, the design is close to optimal: a billion keys fit in three or four levels, and each level costs one page read.',
        'The weakness is small random writes. Every insert, update, or delete must travel to a specific leaf page and modify it in place. If a million inserts target a million different leaves, the engine performs a million scattered page writes, each rewriting an entire 4 KB or 16 KB page for a tiny change. On hard drives this is devastating because each seek takes about 10 ms. On SSDs it still hurts because random writes cause write amplification in the flash translation layer.',
        'The B-Epsilon tree exists to answer a direct question: can an index keep the ordered search structure of a B-tree while batching random updates the way a log-structured system does? The answer is yes, by adding buffers inside internal tree nodes. A user operation becomes a message that stops in an upper node, waits with other messages, and later flushes downward in a batch.',
        {type: 'callout', text: 'A B-Epsilon tree keeps the search path ordered while turning small random writes into durable messages that move downward in batches.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a plain B-tree with eager updates. Find the correct leaf by following separator keys from root to leaf, insert or modify the key in the leaf page, split if the page overflows, and propagate separator changes upward. This gives clean reads because every value lives at its final location. A point lookup descends the tree and returns the leaf entry directly.',
        'A second obvious approach is to keep a separate write-ahead log or update buffer and periodically merge it into the tree. This improves write throughput by making updates sequential, but reads must now check both the tree and the buffer. This is essentially the beginning of an LSM tree design, which is a valid alternative but occupies a different point in the design space.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The eager B-tree update path has poor write amortization. Consider inserting one million keys with uniformly random values into a B-tree with order 500 (each node holds up to 499 keys). The tree has about 2,000 leaf pages. Each insert touches one leaf, but the inserts are spread across all 2,000 leaves in random order. Each leaf page gets rewritten roughly 500 times, but the rewrites are interleaved with rewrites of other pages. The total I/O is about one million page writes, most of them to different pages.',
        'On a hard drive at 10 ms per random write, that is about 2.8 hours for one million inserts. On an SSD at 0.1 ms per random write, it is about 100 seconds, but SSD write amplification means the physical flash writes are 4-10x more. The problem is not the total amount of data written but the fact that each logical operation forces its own page I/O.',
        'The log-based alternative fixes write throughput but creates a different wall: read amplification. An LSM tree may need to check multiple sorted runs to answer a point query, and compaction consumes background I/O. The B-Epsilon tree tries to avoid both walls: it keeps a searchable tree online while batching writes through internal buffers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to give internal tree nodes a second job. In a standard B-tree, an internal node stores only separator keys that route searches to children. In a B-Epsilon tree, each internal node also stores a buffer of pending update messages. A message might say "insert key 52 with value X," "delete key 17," or "increment the counter at key 31." The message has not reached its target leaf yet, but it is logically part of the database.',
        'The key invariant is that every message is stored at a node whose subtree contains the message\'s target key. The tree\'s key-space partitioning is still valid, and messages flow downward along the same routing paths that searches follow. When a buffer fills, the node flushes a batch of messages to the appropriate child. One disk I/O moves many logical operations, amortizing the page-write cost across the entire batch.',
        {type: 'image', src: 'https://image.blocksandfiles.com/116366.webp?format=jpg&height=466&imageId=116366&width=960', alt: 'B-Epsilon tree nodes divided between buffers and pivots.', caption: 'Internal nodes split space between routing pivots and message buffers, making delayed updates part of the tree shape. (Source: blocksandfiles.com)'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each internal node divides its page space between separator keys (pivots) and a message buffer. The parameter epsilon (between 0 and 1) controls the split in the theoretical model. A node with B bytes of space uses B^epsilon bytes for pivots and the remaining B^(1-epsilon) bytes for the message buffer. More buffer space means larger batches and lower amortized write cost. More pivot space means higher fanout and shorter search paths.',
        'A write operation starts at the root. Instead of descending to the leaf, the tree appends the operation as a message to the root\'s buffer. If the buffer has room, the write is done -- one page write to the root. When the root buffer fills, the tree picks the child range with the most pending messages, reads that child\'s page, applies or appends the flushed messages to the child\'s buffer, and writes the child page back. If the child is a leaf, the messages are applied directly to the sorted key-value entries.',
        'A point lookup follows separator keys from root to leaf, exactly like a B-tree. At each internal node along the path, the lookup also scans the node\'s message buffer for any pending operations that target the query key. The final answer is the leaf value modified by any pending messages on the path, applied in timestamp order. If the leaf says key 31 has value A but a newer delete message sits in an ancestor buffer, the answer is "absent."',
        {type: 'image', src: 'https://gywn.net/img/2014/05/fractal_tree_message.png', alt: 'Fractal-tree style index with buffered update and delete messages.', caption: 'Buffered messages are logical state, so reads must reconcile leaf contents with pending operations on the path. (Source: gywn.net)'},
        'Range scans are more complex than in a plain B+ tree. The scan must walk the leaf chain and simultaneously account for buffered messages above the leaves that affect keys in the scan range. Systems handle this by flushing relevant buffers before scanning, by merging buffer contents with leaf entries during the scan, or by maintaining message ordering guarantees that make the merge straightforward.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that the tree\'s key-space partitioning is preserved by the message invariant. Every message is stored at a node whose subtree contains the message\'s target key. A lookup that descends from root to leaf and scans each node\'s buffer along the path will encounter every pending message for the target key. No message is lost or misrouted because messages only move downward along the same separator-key routing that searches follow.',
        'The performance argument is amortization through batching. Suppose each internal node has a buffer that holds C messages. When the buffer fills, the node flushes a batch of at least C/B^epsilon messages to one child (the child whose key range holds the most messages). That flush costs two page I/Os (read the child, write it back). The amortized I/O cost per message is 2/(C/B^epsilon) = 2 * B^epsilon / C. As C grows (larger pages, more buffer space), the per-message cost shrinks.',
        'The ordered tree skeleton provides something an LSM tree does not: every message is already attached to the correct search path. An LSM must merge sorted runs during compaction to restore locality. A B-Epsilon tree never loses locality because messages are routed by the same separators that route searches.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The theoretical optimal write cost for a B-Epsilon tree is O((log N) / (B^epsilon * log(B^epsilon))) I/Os per insert, where N is the number of keys and B is the page size in keys. For comparison, a B-tree insert costs O(log_B N) I/Os. With B = 500 and N = 10^9, a B-tree insert costs about 3 I/Os. A B-Epsilon tree with epsilon = 0.5 achieves roughly 0.13 I/Os per insert (amortized), about a 23x improvement.',
        'Point lookups cost O(log_B N) I/Os plus a buffer scan at each level. With epsilon = 0.5, the fanout is B^0.5 instead of B, so the tree is taller: about 6 levels instead of 3 for a billion keys. Each level requires scanning the node\'s buffer, adding CPU cost. The tradeoff is clear: writes get cheaper by a large factor, reads get somewhat more expensive.',
        'Range scans touch the same number of leaf pages as a B+ tree (the leaves are still sorted and linked), but each scan must also reconcile messages from internal buffers. The reconciliation cost depends on how many messages are pending in the scan range. A freshly flushed tree has no pending messages and scans like a B+ tree. A tree with large buffers may have substantial pending state to merge.',
        'Space overhead comes from the message buffers. Each internal node dedicates a fraction of its page to buffering, which reduces the number of separator keys per node and increases tree height. The total space is proportional to the number of pending messages plus the base tree size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TokuDB, acquired by Percona, used fractal-tree indexes (a B-Epsilon tree variant) as its storage engine for MySQL. Percona\'s documentation describes insertions, deletions, and updates as messages stored in node buffers that propagate down the tree. TokuDB demonstrated 10-50x faster bulk inserts than InnoDB\'s B+ tree on benchmarks with random key order, while maintaining competitive read performance.',
        'BetrFS (the Better File System) applied B-Epsilon trees to file-system metadata. File-system workloads often involve many small random changes -- creating files, renaming directories, updating timestamps -- mixed with directory scans. BetrFS showed 2-100x improvement on metadata-heavy workloads compared to ext4 and XFS, as measured in the FAST 2015 paper.',
        'The design family fits workloads where random writes and ordered range access both matter: secondary indexes in databases with high update rates, metadata stores for file systems, event logs that need both fast ingestion and ordered retrieval, and any system where a B-tree\'s read performance is needed but its write amplification is unacceptable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most dangerous failure is treating buffered messages as an in-memory convenience instead of durable state. A write accepted into an internal buffer is a committed operation. If the system crashes before that message reaches a leaf, the message must be recoverable from the write-ahead log. The WAL must record message order, the recovery process must replay partially flushed batches correctly, and the system must never apply the same message twice.',
        'Read semantics are harder than in a B-tree. Deletes, upserts, and repeated updates to the same key must compose in the correct order. A range scan cannot ignore messages because they are inconvenient to merge. If the system flushes buffers aggressively before every read to simplify correctness, it loses the write-batching benefit that justified the design.',
        'Uncontrolled buffer growth creates the B-Epsilon equivalent of LSM compaction debt. If background flush capacity cannot keep up with incoming writes, buffers fill to their limits and the tree must either block writes or flush under pressure with poor batch sizes. The system needs policies for choosing which child to flush, when to split nodes, how to compress or coalesce messages, and how to protect foreground read latency during heavy flushes.',
        'Implementation complexity is high. A B-tree is well-understood, widely implemented, and easy to debug. A B-Epsilon tree adds message semantics, flush scheduling, buffer management, split handling with pending messages, and modified range-scan logic. The engineering cost is substantial, and bugs in message ordering or visibility can produce silent data corruption.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a B-Epsilon tree with node size 4 KB, epsilon = 0.5, and 3 levels (root, internal, leaves). Each node uses about 64 bytes for pivots (B^0.5 ~ 22 separator keys) and the remaining ~3,900 bytes for the message buffer. Each message (key + operation + value) is about 40 bytes, so the buffer holds about 97 messages.',
        'Insert operations for keys 52, 17, 31, 88, 45, 73, 9, 66 arrive at the root. Each insert becomes a message appended to the root buffer. After 8 inserts, the root buffer holds 8 messages out of its 97-message capacity. No flush is needed. Total I/O: one page write to the root.',
        'After 97 inserts, the root buffer is full. The tree picks the child range with the most messages -- say 40 messages target the range [1, 50] and 57 messages target [51, 100]. The tree flushes the 57 messages to the child node covering [51, 100]. That flush costs two I/Os: read the child page, write it back with the 57 new messages in its buffer. The root\'s buffer now has 40 remaining messages and room for 57 more. Amortized cost: 2 I/Os for 57 inserts = 0.035 I/Os per insert.',
        'Compare with a B-tree: each of those 57 inserts would have required descending to a leaf and writing it, costing about 2 I/Os each (read the leaf, write it back). That is 114 I/Os for 57 inserts = 2.0 I/Os per insert. The B-Epsilon tree achieved a 57x improvement by batching.',
        'A point lookup for key 66 descends from root to the child covering [51, 100] to the leaf. At each node, the lookup scans the message buffer for key 66. If a newer "update key 66 to value Y" message sits in the root buffer, the lookup applies it on top of whatever the leaf holds. Total I/O: 3 page reads (one per level), same as a B-tree, plus the CPU cost of scanning each buffer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Brodal and Fagerberg, "Lower Bounds for External Memory Dictionaries" (2003) established the theoretical framework for write-optimized external-memory data structures. Bender, Farach-Colton, et al. developed the B-Epsilon tree theory and connected it to practical fractal-tree indexing. The FAST 2015 paper "BetrFS: A Right-Optimized Write-Optimized File System" by Jannen et al. demonstrated the design in a real file system.',
        'Prerequisite: B-Trees -- understand the standard ordered index before studying the write-optimized variant. Study B+ Tree Leaf Sibling Scan Case Study to see why linked leaves matter for range scans. Study LSM Tree and LSM Compaction Strategies Primer for the alternative write-optimized design that places deferred work in sorted runs instead of tree buffers.',
        'Related topics: Write-Ahead Log (the durability mechanism that makes buffered messages recoverable), Database Indexing (the broader context where B-Epsilon trees compete), RocksDB LSM Case Study (the dominant LSM implementation), and Bw-Tree Delta Chain & Mapping Table (another write-optimized tree design using delta records and a mapping table instead of in-place updates).',
      ],
    },
  ],
};
