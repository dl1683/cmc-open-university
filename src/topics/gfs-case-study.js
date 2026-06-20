// Google File System case study: one master for metadata, many chunkservers
// for large replicated chunks, leases for mutation order, and record append
// for data pipelines.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gfs-case-study',
  title: 'Google File System Case Study',
  category: 'Papers',
  summary: 'GFS as the storage substrate behind early Google-scale batch systems: master metadata, chunkservers, leases, and append-heavy files.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['read and write path', 'record append and recovery'], defaultValue: 'read and write path' },
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

function topology(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'library' },
      { id: 'master', label: 'GFS master', x: 2.8, y: 4.0, note: 'metadata only' },
      { id: 'c1', label: 'chunkserver A', x: 5.3, y: 2.0, note: 'replica' },
      { id: 'c2', label: 'chunkserver B', x: 5.3, y: 4.0, note: 'primary lease' },
      { id: 'c3', label: 'chunkserver C', x: 5.3, y: 6.0, note: 'replica' },
      { id: 'disk1', label: 'chunk 64MB', x: 8.1, y: 2.0, note: 'handle 81' },
      { id: 'disk2', label: 'chunk 64MB', x: 8.1, y: 4.0, note: 'handle 81' },
      { id: 'disk3', label: 'chunk 64MB', x: 8.1, y: 6.0, note: 'handle 81' },
    ],
    edges: [
      { id: 'e-client-master', from: 'client', to: 'master', weight: 'lookup metadata' },
      { id: 'e-client-c2', from: 'client', to: 'c2', weight: 'data RPC' },
      { id: 'e-master-c1', from: 'master', to: 'c1', weight: 'replica list' },
      { id: 'e-master-c2', from: 'master', to: 'c2', weight: 'lease' },
      { id: 'e-master-c3', from: 'master', to: 'c3', weight: 'replica list' },
      { id: 'e-c1-d1', from: 'c1', to: 'disk1', weight: 'local disk' },
      { id: 'e-c2-d2', from: 'c2', to: 'disk2', weight: 'local disk' },
      { id: 'e-c3-d3', from: 'c3', to: 'disk3', weight: 'local disk' },
      { id: 'e-c2-c1', from: 'c2', to: 'c1', weight: 'mutation order' },
      { id: 'e-c2-c3', from: 'c2', to: 'c3', weight: 'mutation order' },
    ],
  }, { title });
}

function* readAndWritePath() {
  yield {
    state: topology('GFS separates metadata from bulk data'),
    highlight: { active: ['client', 'master'], compare: ['c1', 'c2', 'c3'] },
    explanation: 'The animation starts with the split that makes GFS work: the master answers control-plane questions, while chunkservers move bytes. A client asks the master for chunk locations, then reads or writes directly against replicas so the master does not sit on the large-data path.',
    invariant: 'Master owns names and chunk metadata; chunkservers move bytes.',
  };

  yield {
    state: labelMatrix(
      'Master metadata is small enough to keep in memory',
      [
        { id: 'names', label: 'namespace' },
        { id: 'chunks', label: 'file -> chunks' },
        { id: 'locs', label: 'chunk locations' },
        { id: 'log', label: 'operation log' },
      ],
      [
        { id: 'stored', label: 'stored by master' },
        { id: 'why', label: 'why it works' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['yes', 'small metadata', 'Database Indexing'],
        ['yes', 'chunk handles', 'Hash Table'],
        ['soft state', 'heartbeats rebuild it', 'Distributed Tracing'],
        ['durable', 'replay after crash', 'Write-Ahead Log (WAL)'],
      ],
    ),
    highlight: { active: ['log:stored', 'log:link'], found: ['locs:why'] },
    explanation: 'Read this table as the master budget. Names, chunk handles, leases, and the operation log are small enough to manage centrally. Replica locations are softer: heartbeats refresh them, so the system does not need to persist every placement fact as sacred state.',
  };

  yield {
    state: topology('A write lease chooses one primary replica'),
    highlight: { active: ['master', 'c2', 'e-master-c2'], found: ['e-c2-c1', 'e-c2-c3'] },
    explanation: 'The highlighted lease edge is the ordering trick. The master chooses a primary replica for the chunk, but the primary orders the actual mutations and tells secondaries to apply that same order. Metadata stays centralized; byte-level sequencing moves to the data replicas.',
  };

  yield {
    state: labelMatrix(
      'Why GFS chose large chunks',
      [
        { id: 'seek', label: 'client lookups' },
        { id: 'stream', label: 'streaming reads' },
        { id: 'metadata', label: 'metadata size' },
        { id: 'small', label: 'small-file pain' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['fewer master requests', 'good for huge files'],
        ['high throughput', 'not low-latency POSIX'],
        ['less metadata', 'fits in memory'],
        ['hot chunks possible', 'needs application care'],
      ],
    ),
    highlight: { found: ['stream:effect', 'metadata:effect'], compare: ['small:tradeoff'] },
    explanation: 'Large chunks reduce master traffic and favor streaming throughput, but the comparison row shows the cost: small files and hot chunks are awkward. GFS is a workload-specific design for batch pipelines, not a POSIX file system with every edge polished.',
  };
}

function* appendAndRecovery() {
  yield {
    state: labelMatrix(
      'Record append lets many workers write safely',
      [
        { id: 'w1', label: 'worker 1' },
        { id: 'w2', label: 'worker 2' },
        { id: 'w3', label: 'worker 3' },
        { id: 'file', label: 'shared output file' },
      ],
      [
        { id: 'request', label: 'request' },
        { id: 'gfs', label: 'GFS action' },
        { id: 'result', label: 'result' },
      ],
      [
        ['append record A', 'choose offset', 'A at offset 80'],
        ['append record B', 'choose offset', 'B at offset 88'],
        ['append record C', 'choose offset', 'C at offset 96'],
        ['records', 'may include padding', 'reader skips invalid'],
      ],
    ),
    highlight: { active: ['w1:gfs', 'w2:gfs', 'w3:gfs'], found: ['file:result'] },
    explanation: 'This table shows why record append exists. Many workers can safely add output without coordinating offsets themselves. The catch is explicit: GFS may leave padding or duplicate records after failures, so pipeline records need IDs, checksums, or other validation.',
    invariant: 'The file system provides append-at-least-once; the application handles record identity.',
  };

  yield {
    state: topology('Failure: one chunkserver disappears'),
    highlight: { removed: ['c3', 'disk3', 'e-c3-d3'], active: ['master', 'c1', 'c2'], compare: ['e-master-c3'] },
    explanation: 'The removed replica is not exceptional; it is the operating model. The master notices the missing heartbeat, avoids the failed copy, and schedules re-replication from healthy replicas. Reliability comes from detection and repair, not from assuming machines stay up.',
  };

  yield {
    state: labelMatrix(
      'GFS consistency model in plain terms',
      [
        { id: 'write', label: 'successful write' },
        { id: 'append', label: 'record append' },
        { id: 'fail', label: 'failed mutation' },
        { id: 'repair', label: 'replica repair' },
      ],
      [
        { id: 'guarantee', label: 'guarantee' },
        { id: 'app', label: 'application duty' },
      ],
      [
        ['defined region', 'read by chunk version'],
        ['atomic at least once', 'dedupe records'],
        ['inconsistent region possible', 'validate records'],
        ['eventual re-replication', 'monitor lag'],
      ],
    ),
    highlight: { active: ['append:guarantee', 'append:app'], compare: ['fail:app'] },
    explanation: 'The consistency table is the honest part of the design. GFS gives useful guarantees for huge append-heavy jobs, but applications must validate records, tolerate duplicates, and monitor repair. The file system and application share the correctness contract.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'read and write path') yield* readAndWritePath();
  else if (view === 'record append and recovery') yield* appendAndRecovery();
  else throw new InputError('Pick a GFS view.');
}

export const article = {
  sections: [
    {
      heading: 'The workload that forced GFS into existence',
      paragraphs: [
        'The Google File System is a lesson in designing from the real workload instead of from an inherited interface. Early Google storage was not dominated by people opening small files, editing them in place, and expecting workstation-style POSIX behavior. It was dominated by crawled web data, logs, index shards, batch jobs, and large derived files. Files were often huge. Reads were often long and sequential. Writes were often appends. Failures were not rare incidents; they were normal events in a fleet made from many commodity machines.',
        'A conventional file system tries to make storage look like a reliable local disk. GFS starts from the opposite assumption. Machines fail, disks fail, networks drop messages, and applications can participate in recovery if the storage system gives them the right contract. The design is therefore less elegant in the abstract and more honest in production. It chooses high throughput, large-scale recovery, and simple operational repair over complete file-system generality.',
        {type:'callout', text:'GFS works because compact metadata stays centralized while bulk data, mutation ordering, and repair move to the machines that own the bytes.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9d/Wikimedia_Servers-0051_19.jpg', alt:'Rows of black server racks in a bright data center corridor.', caption:'Wikimedia server racks, photo by Helpameout, Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The naive design and why it breaks',
      paragraphs: [
        'The obvious design is to hide a distributed system behind a familiar file API and make every operation strongly file-system-like. A central server could track all names, all blocks, and all reads and writes. That fails for two reasons. First, the server becomes the data bottleneck. If every scan of every large file moves through the master, the master is no longer metadata; it is the entire system. Second, the consistency model becomes expensive. If thousands of workers append to shared outputs and every failure must preserve a perfect single-writer illusion, the system spends its time coordinating rather than moving data.',
        'Another naive design is to remove the master entirely and make every chunkserver coordinate with every other chunkserver. That avoids one bottleneck but makes metadata and repair hard. File names, chunk handles, leases, version numbers, garbage collection, and replica placement need a source of truth. If every machine owns a fragment of that truth without a clean authority boundary, recovery turns into archaeology.',
      ],
    },
    {
      heading: 'The core idea: one master for metadata, many servers for bytes',
      paragraphs: [
        'GFS keeps a single master, but it gives the master the right job. The master stores compact metadata: the namespace, file-to-chunk mappings, chunk handles, lease information, version numbers, and the operation log. It does not sit in the middle of the bulk data path. A client asks the master where a chunk lives, caches the answer, and then reads or writes directly to chunkservers. The master is a control plane, not a pipe for bytes.',
        'Files are divided into large chunks, famously 64 MB in the original paper. That size is not arbitrary. Large chunks reduce the number of master lookups, reduce metadata size, and match long streaming reads. They also make replication and placement decisions chunky enough to manage. The cost is real: small files waste attention, hot chunks can form, and random tiny updates are not the target workload. GFS wins because it knows what it is optimizing for.',
        'Replication is built into the storage model. Each chunk has multiple replicas on different chunkservers. The master tracks where replicas should live and uses heartbeats to learn what is actually alive. When a chunkserver disappears, the system schedules re-replication from healthy copies. Reliability comes from continuous detection and repair, not from pretending individual machines are reliable.',
      ],
    },
    {
      heading: 'How writes work',
      paragraphs: [
        'The subtle part of GFS is mutation ordering. When a client wants to write a chunk, the master grants a lease to one replica, making it the primary. The client pushes the data to all replicas, often through a pipeline chosen for network efficiency. Then the client asks the primary to perform the mutation. The primary chooses the serial order for mutations on that chunk and tells the secondary replicas to apply the same order. This lets replicas agree on byte changes without sending every decision back through the master.',
        'The lease is the boundary between central authority and local sequencing. The master decides which replica is allowed to order mutations. The primary orders the actual mutations while its lease is valid. If the primary fails, the master can grant a new lease after the old one expires and after versioning rules prevent stale replicas from silently rejoining as if nothing happened.',
        'This pattern appears all over distributed systems: a control plane grants authority, then a data-plane actor uses that authority locally until it expires. Leases are useful because they are weaker than permanent ownership and cheaper than asking a central authority for every tiny decision. They are also dangerous if clocks, expiry, and stale state are not handled carefully.',
      ],
    },
    {
      heading: 'Record append and application-aware correctness',
      paragraphs: [
        'Record append is one of the most educational parts of GFS because it refuses to overpromise. Many workers can append records to the same file without agreeing on exact offsets in advance. GFS chooses the offset and guarantees that each successful append is written atomically at least once. That is enough for many data-processing pipelines where records have checksums, IDs, or other self-validating structure.',
        'The phrase "at least once" matters. Under failure, GFS may leave padding or duplicate records. Readers must tolerate invalid regions and deduplicate if exact record identity matters. This is not a defect hidden in the fine print; it is a contract. GFS moves complexity out of the storage layer only because the applications using it can handle that complexity more cheaply. A crawler or indexing pipeline can skip bad records, detect duplicates, and recompute derived data. A banking ledger cannot accept the same bargain.',
        'This is why GFS is such a strong curriculum topic. It teaches that correctness is not a single global setting. Correctness lives at the boundary between the system and the workload. If the application can cheaply validate records, the storage layer does not need to provide the same guarantee as a transactional database. If the application cannot tolerate duplicates or gaps, GFS-style record append is the wrong abstraction.',
      ],
    },
    {
      heading: 'Why the design works',
      paragraphs: [
        'GFS works because the master owns only the state that benefits from centralization. Names, chunk handles, leases, and the operation log are compact and need a consistent authority. Bulk data is large and benefits from parallel movement. That split lets the master be simple without being in the hottest path. Clients cache metadata, chunkservers handle bytes, and background repair handles normal failures.',
        'The design also works because it chooses a workload-specific consistency model. It does not try to make every mutation behave like a local file-system write. It gives enough structure for append-heavy distributed computation and expects applications to validate records. That combination made sense for Google indexing pipelines: jobs could be rerun, outputs could be checked, and duplicate records were cheaper than global coordination.',
        'Finally, GFS works because it treats repair as a first-class loop. Heartbeats, checksums, chunk versions, re-replication, garbage collection, and master log replay are not side details. They are the system. A distributed storage design is not defined only by the successful read path. It is defined by what happens after a disk silently corrupts data, a rack disappears, a master restarts, or a chunkserver returns with stale replicas.',
      ],
    },
    {
      heading: 'Where the idea travels',
      paragraphs: [
        'HDFS borrowed much of the same shape: a metadata authority, large blocks, data nodes, replication, and batch-friendly access. Modern object stores and data-lake systems do not copy GFS directly, but they often preserve the same separation between naming/control metadata and large immutable data objects. Log systems, warehouse file formats, and lakehouse tables also inherit the lesson that storage can be simpler when data is written in large chunks and higher layers own schema, indexing, and transactional meaning.',
        'The design is also a useful comparison point for systems that made different choices. A database storage engine cares about low-latency updates, page-level recovery, and transaction isolation. A content-addressed object store cares about immutable blobs and hashes. A distributed transactional file system cares more about namespace semantics. GFS is not a universal answer; it is a sharp answer to a particular cluster workload.',
      ],
    },
    {
      heading: 'Failure modes and design warnings',
      paragraphs: [
        'A single master can become a bottleneck if metadata grows too large, clients fail to cache, or workloads create too many tiny files. Large chunks help streaming throughput but make small-file-heavy workloads awkward. Primary leases simplify write ordering but require careful handling of expiry, stale replicas, and chunk versions. Record append helps many producers write to one file, but it pushes duplicate handling and validation into application logic.',
        'The operational warning is that background repair must keep up with failure. Replication is only useful if under-replicated chunks are detected and copied before the next failure removes the remaining copies. Checksums are only useful if clients and chunkservers actually verify them. A storage system that depends on repair needs metrics for missing replicas, corrupt chunks, re-replication lag, master log health, and hot chunk pressure.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'GFS is not important because every modern system should copy its exact architecture. It is important because it shows how much simpler a system can become when it is honest about the workload. Large files, streaming reads, append-heavy writes, and recoverable batch jobs lead to a different design than tiny files and transactional updates.',
        'The deep lesson is the split of responsibility: centralize compact metadata, distribute bulk data movement, use leases for local ordering, repair continuously, and make the application contract explicit. When a design tells you exactly what it will not guarantee, it is often more useful than a design that pretends to guarantee everything.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "The Google File System" at https://research.google.com/archive/gfs-sosp2003.pdf. Study MapReduce Case Study, Bigtable Case Study, Write-Ahead Log (WAL), Distributed Locks: What They Can Promise, Sharding & Partitioning, Idempotency & Exactly-Once Delivery, S3 Object Storage Case Study, and LSM Compaction Strategies next.',
      ],
    },
  ],
};
