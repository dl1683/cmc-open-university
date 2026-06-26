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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a split between metadata control and byte movement. GFS means Google File System, a distributed file system built for large files on many commodity machines, and a chunk is a fixed-size piece of a file stored on chunkservers. Active nodes show the current master, client, or chunkserver action, visited nodes show known metadata or replicas, and found nodes show a chosen primary or healthy replica.',
        'The safe inference rule is that the master owns names and leases, while chunkservers move data. If the data path goes through the master, the design has lost the main scalability boundary.',
        {type:'callout', text:'GFS works because compact metadata stays centralized while bulk data, mutation ordering, and repair move to the machines that own the bytes.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9d/Wikimedia_Servers-0051_19.jpg', alt:'Rows of black server racks in a bright data center corridor.', caption:'Wikimedia server racks, photo by Helpameout, Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'GFS exists because early Google workloads were dominated by crawled web data, logs, index shards, batch computation, and large append-heavy files. Failures were normal because the system ran across many commodity machines.',
        'A conventional local-file illusion was the wrong target. The workload needed high throughput, automatic re-replication, and a consistency contract applications could handle during large distributed jobs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious distributed design is one central file server that handles names and bytes. Clients ask the server for data, and every read and write flows through that server.',
        'Another obvious design is to remove the master and let storage machines coordinate everything among themselves. That avoids one central authority but makes naming, repair, leases, versioning, and garbage collection hard to reason about.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is separating control from throughput. A central server can keep metadata consistent, but it becomes a bottleneck if it also carries every file scan and append.',
        'Fully decentralized metadata hits a different wall. When machines fail and rejoin, the system needs a clear source of truth for chunk handles, replica locations, and stale-copy detection, or recovery becomes guesswork.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'GFS keeps one master for compact metadata and keeps bulk bytes on chunkservers. Clients ask the master where chunks live, cache that answer, and then read or write directly against chunkservers.',
        'The chunk size is large, famously 64 MB in the original paper. Large chunks reduce metadata volume and master lookups, which fits long streaming reads and append-heavy batch jobs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A file is split into chunks, and each chunk has replicas on multiple chunkservers. The master stores namespace metadata, file-to-chunk mappings, chunk versions, lease state, and an operation log.',
        'For a write, the master grants a lease to one replica, making it the primary for that chunk. The client pushes data to replicas, then asks the primary to choose the mutation order, and secondaries apply that same order.',
        'For record append, clients can append concurrently without choosing offsets themselves. GFS chooses an offset and provides atomic append at least once, while applications handle padding or duplicate records when failures occur.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because metadata is small and benefits from a single authority, while file data is large and benefits from parallel movement. The master can make placement and lease decisions without sitting in the hot data path.',
        'The write protocol works because one primary orders mutations during a lease interval. Replicas that apply the same ordered mutations converge, and stale replicas can be detected through versioning and repaired by the master.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Client data throughput scales with chunkservers and network paths, not with master bandwidth. If a job reads 1,000 chunks from 100 chunkservers, the work can spread across the fleet after the metadata lookups are cached.',
        'The master still pays for metadata, heartbeats, lease management, garbage collection, and re-replication scheduling. Doubling the number of files hurts master metadata more than doubling the size of a few large files, which is why the design favors large files.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GFS fit Google batch processing pipelines that read large inputs, append outputs, tolerate recomputation, and validate records at the application layer. MapReduce-style jobs are the natural companion workload.',
        'The design influenced later distributed storage systems. The general pattern of a metadata control plane plus many data-plane storage workers appears in HDFS and many object or blob storage architectures.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'GFS is a poor fit for many tiny files, low-latency random writes, POSIX-style overwrites, and workloads that need strict transactional file semantics. The large chunk and relaxed append contract are taxes, not accidents.',
        'It also depends on applications tolerating the record-append contract. A crawler output file can skip duplicate or invalid records, but a financial ledger cannot accept duplicate committed transactions as a normal recovery case.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 1 GB file uses 16 chunks when chunks are 64 MB. With three replicas per chunk, the cluster stores 48 chunk replicas, and the master stores compact metadata that maps 16 chunk handles to replica locations.',
        'If a client reads the whole file, it asks the master for locations and then streams chunks directly from chunkservers. If one chunkserver dies, the master sees missed heartbeats and schedules a new replica from one of the remaining copies until the replication target is restored.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the original Google File System paper by Ghemawat, Gobioff, and Leung, then compare it with the HDFS architecture guide. Study leases, replication, checksums, write-ahead logs, chunk placement, and MapReduce next.',
        'Then compare GFS with object storage, distributed databases, and consensus-backed metadata systems. The key question is which correctness promises belong in storage and which can safely move to the application.',
      ],
    },
  ],
};
