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
    explanation: 'The Google File System uses a single master for metadata and many chunkservers for bulk data. The client asks the master where a file chunk lives, then talks directly to chunkservers. The master is not in the data path for large reads and writes.',
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
    explanation: 'The single-master design is viable because the master stores metadata, not file contents. Chunk locations are treated as soft state and refreshed by heartbeat. The durable operation log protects namespace changes and chunk metadata.',
  };

  yield {
    state: topology('A write lease chooses one primary replica'),
    highlight: { active: ['master', 'c2', 'e-master-c2'], found: ['e-c2-c1', 'e-c2-c3'] },
    explanation: 'For mutations, the master grants a lease to one chunk replica. That primary chooses the serial order of writes, then tells secondaries to apply the same order. This avoids the master ordering every byte-level mutation while still giving a defined chunk mutation order.',
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
    explanation: 'GFS was tuned for Google workloads: large files, streaming reads, append-heavy writes, and machine failures as normal. It is not a generic desktop file system. Its choices line up with MapReduce Case Study and Bigtable Case Study.',
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
    explanation: 'Record append is the GFS operation that matches data pipelines. Multiple clients append concurrently, and GFS chooses the offset. The operation can create padding or duplicates in failure cases, so applications make records self-validating and tolerate duplicate records.',
    invariant: 'The file system provides append-at-least-once; the application handles record identity.',
  };

  yield {
    state: topology('Failure: one chunkserver disappears'),
    highlight: { removed: ['c3', 'disk3', 'e-c3-d3'], active: ['master', 'c1', 'c2'], compare: ['e-master-c3'] },
    explanation: 'Chunkservers fail regularly. The master notices missing heartbeats, stops using that replica, and schedules re-replication from healthy copies. GFS is built around cheap commodity machines and background repair, not around pretending disks and servers are reliable.',
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
    explanation: 'The paper is refreshingly honest: the file system gives semantics tuned for large distributed jobs, and applications participate. That design philosophy repeats in Kafka Log Case Study, MapReduce Case Study, and Idempotency & Exactly-Once Delivery.',
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
      heading: 'What it is',
      paragraphs: [
        'The Google File System is a distributed file system built for large, data-intensive workloads on unreliable commodity hardware. It assumes files are huge, reads are often streaming, writes are commonly appends, and machine failure is normal.',
        'GFS is a key substrate for the early Google systems stack. MapReduce Case Study needs a file system that can feed massive parallel jobs. Bigtable Case Study needs a distributed file system underneath SSTables and logs. GFS supplies that layer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Files are split into large chunks, each identified by a chunk handle and replicated across chunkservers. A single master stores namespace metadata, file-to-chunk mappings, leases, and operation-log state. Clients ask the master for metadata, then transfer data directly to chunkservers.',
        'Mutations use leases. The master grants one replica primary status for a chunk; that primary chooses the order of mutations and forwards the order to secondary replicas. Record append lets many clients append concurrently while GFS chooses the final offset.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The single master simplifies metadata management but creates a control-plane bottleneck that must be carefully contained. Large chunks reduce metadata and master traffic but can make small files and hot chunks awkward. The consistency model is practical rather than POSIX-pure: applications may need checksums, self-identifying records, and duplicate handling.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GFS influenced HDFS and a generation of distributed storage systems. Its patterns still matter: metadata/control-plane separation, large immutable or append-heavy files, background replication, master operation logs, and application-aware consistency.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'GFS is not a general-purpose file system for small interactive files. It is a workload-specific system. The right lesson is not "single master is always fine"; it is that a single metadata owner can work when metadata is small, cached, log-protected, and kept out of the byte path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "The Google File System" at https://research.google.com/archive/gfs-sosp2003.pdf. Study MapReduce Case Study, Bigtable Case Study, Write-Ahead Log (WAL), Distributed Locks: What They Can Promise, Sharding & Partitioning, and Idempotency & Exactly-Once Delivery next.',
      ],
    },
  ],
};
