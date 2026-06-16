// RocksDB case study: production LSM storage where the bottleneck moved from
// write amplification to space amplification to CPU as SSDs and workloads evolved.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rocksdb-lsm-case-study',
  title: 'RocksDB LSM Case Study',
  category: 'Papers',
  summary: 'RocksDB as the embedded-storage lesson: WAL, memtables, SSTables, compaction, block cache, and shifting bottlenecks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['write path and reads', 'compaction tradeoffs'], defaultValue: 'write path and reads' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'application', x: 0.7, y: 3.8, note: 'get/put' },
      { id: 'wal', label: 'WAL', x: 2.6, y: 2.2, note: 'durability' },
      { id: 'mem', label: 'memtable', x: 2.6, y: 5.4, note: 'mutable sorted' },
      { id: 'l0', label: 'L0 files', x: 4.8, y: 2.0, note: 'overlap' },
      { id: 'l1', label: 'L1 files', x: 6.4, y: 3.8, note: 'mostly sorted' },
      { id: 'l2', label: 'L2+ files', x: 8.0, y: 5.4, note: 'larger levels' },
      { id: 'cache', label: 'block cache', x: 5.0, y: 6.8, note: 'hot reads' },
      { id: 'compact', label: 'compaction', x: 8.2, y: 2.0, note: 'rewrite' },
    ],
    edges: [
      { id: 'e-app-wal', from: 'app', to: 'wal', weight: 'append' },
      { id: 'e-app-mem', from: 'app', to: 'mem', weight: 'update' },
      { id: 'e-mem-l0', from: 'mem', to: 'l0', weight: 'flush' },
      { id: 'e-l0-l1', from: 'l0', to: 'l1', weight: 'compact' },
      { id: 'e-l1-l2', from: 'l1', to: 'l2', weight: 'compact' },
      { id: 'e-compact-l0', from: 'compact', to: 'l0', weight: 'choose' },
      { id: 'e-compact-l1', from: 'compact', to: 'l1', weight: 'rewrite' },
      { id: 'e-cache-l1', from: 'cache', to: 'l1', weight: 'blocks' },
    ],
  }, { title });
}

function* writePathAndReads() {
  yield {
    state: architecture('RocksDB is an LSM engine embedded in larger systems'),
    highlight: { active: ['app', 'wal', 'mem', 'e-app-wal', 'e-app-mem'], compare: ['l0', 'l1'] },
    explanation: 'RocksDB is a persistent key-value storage engine. A write appends to the Write-Ahead Log and updates a memtable, then later flushes into sorted files.',
  };

  yield {
    state: architecture('Memtables flush to SSTables; compaction restores order'),
    highlight: { active: ['mem', 'l0', 'l1', 'l2', 'compact', 'e-mem-l0', 'e-l0-l1', 'e-l1-l2'], found: ['wal'] },
    explanation: 'Flush and compaction are the heart of LSM storage. RocksDB continuously rewrites files to reduce read amplification, reclaim old versions, and maintain sorted levels.',
    invariant: 'Writes are cheap now because compaction pays cleanup cost later.',
  };

  yield {
    state: labelMatrix(
      'Read path checks multiple places',
      [
        { id: 'mem', label: 'memtable' },
        { id: 'l0', label: 'L0 files' },
        { id: 'l1', label: 'L1/L2 files' },
        { id: 'cache', label: 'block cache' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'cost', label: 'cost pressure' },
      ],
      [
        ['newest writes', 'memory lookup'],
        ['recent flushed files', 'overlapping files'],
        ['sorted runs', 'disk/SSD reads'],
        ['hot blocks', 'memory budget'],
      ],
    ),
    highlight: { found: ['mem:role', 'cache:role'], compare: ['l0:cost', 'l1:cost'] },
    explanation: 'Reads merge multiple sources: memtable, L0 files, lower levels, filters, indexes, and cache. This is why Bloom Filter, Quotient Filter, and Database Indexing are practical substructures.',
  };

  yield {
    state: labelMatrix(
      'Where RocksDB appears',
      [
        { id: 'db', label: 'distributed DB' },
        { id: 'stream', label: 'stream processor state' },
        { id: 'queue', label: 'log service metadata' },
        { id: 'cache', label: 'SSD cache' },
      ],
      [
        { id: 'why', label: 'why embedded KV helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['local durable state', 'compaction interference'],
        ['fast keyed state', 'checkpoint pressure'],
        ['metadata/indexes', 'write amplification'],
        ['persistent hot data', 'CPU compression cost'],
      ],
    ),
    highlight: { active: ['db:why', 'stream:why'], compare: ['cache:risk'] },
    explanation: 'RocksDB is often the storage engine inside a bigger distributed system. That means its local compaction behavior can become a global systems bottleneck.',
  };
}

function* compactionTradeoffs() {
  yield {
    state: labelMatrix(
      'The RocksDB experience paper tracks shifting bottlenecks',
      [
        { id: 'write_amp', label: 'write amplification' },
        { id: 'space_amp', label: 'space amplification' },
        { id: 'cpu', label: 'CPU utilization' },
        { id: 'ops', label: 'operability' },
      ],
      [
        { id: 'old_priority', label: 'priority' },
        { id: 'why', label: 'why it mattered' },
      ],
      [
        ['early focus', 'SSD write endurance and throughput'],
        ['later focus', 'data scale and storage cost'],
        ['later focus', 'compression/filter/checksum overhead'],
        ['always', 'many instances share resources'],
      ],
    ),
    highlight: { active: ['write_amp:why', 'space_amp:why', 'cpu:why'], found: ['ops:why'] },
    explanation: 'The key case-study lesson is that storage-engine priorities changed as hardware and production workloads changed. The "best" LSM configuration is not static.',
  };

  yield {
    state: architecture('Compaction is resource scheduling'),
    highlight: { active: ['compact', 'l0', 'l1', 'l2', 'e-compact-l0', 'e-compact-l1'], compare: ['app'] },
    explanation: 'Compaction competes with foreground reads and writes for CPU, SSD bandwidth, cache, and memory. A storage engine is also a scheduler.',
  };

  yield {
    state: labelMatrix(
      'Tuning knobs',
      [
        { id: 'level', label: 'level size' },
        { id: 'compression', label: 'compression' },
        { id: 'filters', label: 'filters' },
        { id: 'cache', label: 'cache split' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'costs', label: 'costs' },
      ],
      [
        ['read and space amp', 'compaction IO'],
        ['space amp', 'CPU'],
        ['read misses', 'memory and CPU'],
        ['hot reads', 'less memtable/cache elsewhere'],
      ],
    ),
    highlight: { found: ['level:helps', 'compression:helps', 'filters:helps'], compare: ['compression:costs'] },
    explanation: 'Every knob moves pressure. Reducing space amplification may increase CPU. Improving reads may cost memory. Tuning is workload-specific.',
  };

  yield {
    state: labelMatrix(
      'Production lesson',
      [
        { id: 'measure', label: 'measure' },
        { id: 'isolate', label: 'isolate' },
        { id: 'adapt', label: 'adapt' },
        { id: 'link', label: 'link upward' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'neighbor', label: 'study link' },
      ],
      [
        ['amp metrics', 't-digest'],
        ['instances and resources', 'Bulkheads'],
        ['hardware changes', 'Backpressure'],
        ['storage engine affects system', 'Delta Lake'],
      ],
    ),
    highlight: { found: ['measure:lesson', 'isolate:lesson', 'adapt:lesson'], active: ['link:neighbor'] },
    explanation: 'RocksDB is a reminder that a local embedded library can shape the behavior of the distributed system above it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'write path and reads') yield* writePathAndReads();
  else if (view === 'compaction tradeoffs') yield* compactionTradeoffs();
  else throw new InputError('Pick a RocksDB view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RocksDB is an embedded persistent key-value store based on an LSM design. It is used inside larger distributed systems that need fast local durable state on SSDs.',
        'The case study matters because it shows storage engineering as a moving target. RocksDB development priorities shifted from write amplification, to space amplification, to CPU utilization as hardware and production workloads evolved.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Writes append to a WAL and update an in-memory memtable. Memtables flush to sorted SST files. Background compaction rewrites files across levels to reduce read amplification, reclaim deleted or overwritten data, and manage space. Reads consult memtables, files, filters, indexes, and block cache.',
        'The engine is highly configurable because it serves many workloads: databases, stream processors, queues, indexes, metadata stores, and SSD caches.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The core costs are write amplification, space amplification, read amplification, CPU, cache pressure, and operational interference between many RocksDB instances. Compaction can protect future reads while hurting current foreground latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RocksDB appears inside distributed databases, stream-processing state stores, metadata systems, log services, secondary indexes, caches, and edge storage. It connects the local LSM Tree lesson to distributed systems behavior.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'RocksDB is not a complete distributed database by itself. It is an embedded engine. Replication, consensus, sharding, and transactions usually live above it. Another misconception is that one tuning profile works everywhere; workload shape and hardware dominate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: FAST paper at https://www.usenix.org/system/files/fast21-dong.pdf, USENIX page at https://www.usenix.org/conference/fast21/presentation/dong, and Meta research page at https://research.facebook.com/publications/rocksdb-evolution-of-development-priorities-in-a-key-value-store-serving-large-scale-applications/. Study LSM Trees (How Cassandra Writes), LSM Compaction Strategies Primer, RocksDB Write Stalls & Compaction Debt, SSTable Block Index & Filter, RocksDB MANIFEST & VersionSet, LSM Tombstones & Range Deletes, Write-Ahead Log (WAL), Bloom Filter, Quotient Filter, Delta Lake Case Study, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
