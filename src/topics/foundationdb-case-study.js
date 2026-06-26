// FoundationDB case study: an unbundled transactional key-value store with
// proxies, resolvers, logs, storage servers, MVCC, and optimistic commits.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'foundationdb-case-study',
  title: 'FoundationDB Case Study',
  category: 'Papers',
  summary: 'FoundationDB as the unbundled transaction lesson: MVCC reads, optimistic conflict checks, logs, storage servers, and layers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['unbundled architecture', 'optimistic commit'], defaultValue: 'unbundled architecture' },
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
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'transaction' },
      { id: 'proxy', label: 'proxy', x: 2.6, y: 4.0, note: 'commit path' },
      { id: 'resolver', label: 'resolver', x: 4.7, y: 2.4, note: 'conflicts' },
      { id: 'log', label: 'transaction log', x: 4.7, y: 5.6, note: 'durability' },
      { id: 'storageA', label: 'storage A', x: 7.0, y: 2.0, note: 'key ranges' },
      { id: 'storageB', label: 'storage B', x: 7.0, y: 4.0, note: 'key ranges' },
      { id: 'storageC', label: 'storage C', x: 7.0, y: 6.0, note: 'key ranges' },
      { id: 'coordinator', label: 'coordinators', x: 9.0, y: 4.0, note: 'cluster state' },
    ],
    edges: [
      { id: 'e-client-proxy', from: 'client', to: 'proxy', weight: 'read/write' },
      { id: 'e-proxy-resolver', from: 'proxy', to: 'resolver', weight: 'read/write sets' },
      { id: 'e-proxy-log', from: 'proxy', to: 'log', weight: 'commit version' },
      { id: 'e-log-storageA', from: 'log', to: 'storageA', weight: 'mutations' },
      { id: 'e-log-storageB', from: 'log', to: 'storageB', weight: 'mutations' },
      { id: 'e-log-storageC', from: 'log', to: 'storageC', weight: 'mutations' },
      { id: 'e-coordinator-proxy', from: 'coordinator', to: 'proxy', weight: 'roles' },
      { id: 'e-coordinator-storage', from: 'coordinator', to: 'storageB', weight: 'ranges' },
    ],
  }, { title });
}

function* unbundledArchitecture() {
  yield {
    state: architecture('FoundationDB unbundles transaction roles'),
    highlight: { active: ['client', 'proxy', 'resolver', 'log', 'storageA', 'storageB'], compare: ['coordinator'] },
    explanation: 'FoundationDB is a transactional key-value store built from specialized roles. Proxies coordinate commits, resolvers detect conflicts, logs make commits durable, storage servers hold key ranges, and coordinators manage cluster metadata.',
  };

  yield {
    state: architecture('The write path separates conflict checking from durability'),
    highlight: { active: ['proxy', 'resolver', 'log', 'e-proxy-resolver', 'e-proxy-log'], found: ['storageA', 'storageB', 'storageC'] },
    explanation: 'A commit goes through optimistic conflict checking and durable logging before storage servers apply mutations. That separation is the unbundled design lesson: each role can scale and fail independently.',
    invariant: 'A committed transaction has a version and durable mutations in the log.',
  };

  yield {
    state: labelMatrix(
      'Layers build richer databases on a key-value core',
      [
        { id: 'tuple', label: 'tuple layer' },
        { id: 'record', label: 'record layer' },
        { id: 'document', label: 'document model' },
        { id: 'sql', label: 'SQL layer' },
      ],
      [
        { id: 'abstraction', label: 'abstraction' },
        { id: 'core', label: 'core primitive' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['ordered tuples', 'byte keys', 'schema discipline'],
        ['records + indexes', 'transactions', 'index maintenance'],
        ['documents', 'key ranges', 'query planning'],
        ['tables', 'transactions + ranges', 'SQL optimizer'],
      ],
    ),
    highlight: { found: ['tuple:core', 'record:core', 'sql:core'], active: ['record:abstraction'] },
    explanation: 'FoundationDB deliberately exposes a simple transactional ordered key-value substrate. Higher-level data models are layers. That connects to B-Trees, Database Indexing, and Bigtable, but with strict transactional semantics.',
  };

  yield {
    state: labelMatrix(
      'Design pattern: specialize the control plane',
      [
        { id: 'proxy', label: 'proxies' },
        { id: 'resolver', label: 'resolvers' },
        { id: 'logs', label: 'logs' },
        { id: 'storage', label: 'storage servers' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'scales_by', label: 'scales by' },
      ],
      [
        ['assign versions and coordinate commits', 'more proxies'],
        ['check read/write conflicts', 'partitioned ranges'],
        ['durable ordered mutation stream', 'replication and disks'],
        ['serve reads and apply mutations', 'key-range movement'],
      ],
    ),
    highlight: { active: ['proxy:job', 'resolver:job', 'logs:job'], found: ['storage:scales_by'] },
    explanation: 'The case study is valuable because it shows a database as a pipeline of roles, not one monolithic server. That is the same decomposition instinct behind Borg, Spanner, and Kafka.',
  };
}

function* optimisticCommit() {
  yield {
    state: labelMatrix(
      'A transaction carries read and write conflict ranges',
      [
        { id: 't1', label: 'T1' },
        { id: 't2', label: 'T2' },
        { id: 't3', label: 'T3' },
      ],
      [
        { id: 'read_version', label: 'read version' },
        { id: 'read_conflict', label: 'read conflict range' },
        { id: 'write_conflict', label: 'write conflict range' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['100', 'user/7', 'user/7', 'commit v105'],
        ['101', 'user/7', 'user/7/cart', 'conflict retry'],
        ['103', 'sku/4', 'sku/4/count', 'commit v106'],
      ],
    ),
    highlight: { active: ['t1:read_conflict', 't1:write_conflict', 't2:read_conflict'], found: ['t1:decision', 't3:decision'], removed: ['t2:decision'] },
    explanation: 'FoundationDB uses optimistic concurrency control. A transaction reads at a snapshot version, accumulates read and write conflict ranges, and commits only if no conflicting write happened since its read version.',
  };

  yield {
    state: architecture('Resolvers check conflicts before logs accept the commit'),
    highlight: { active: ['proxy', 'resolver', 'e-proxy-resolver'], found: ['log'], compare: ['storageA', 'storageB'] },
    explanation: 'Resolvers are the conflict-checking gate. If the transaction is clean, the proxy assigns a commit version and sends mutations to transaction logs. If not, the client retries on a newer snapshot.',
  };

  yield {
    state: labelMatrix(
      'MVCC makes reads fast but creates cleanup work',
      [
        { id: 'read', label: 'snapshot read' },
        { id: 'commit', label: 'commit' },
        { id: 'storage', label: 'storage server' },
        { id: 'cleanup', label: 'cleanup' },
      ],
      [
        { id: 'version', label: 'version behavior' },
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['read at v100', 'nonblocking reads', 'stale if too old'],
        ['assign v105', 'strict order', 'conflict retry'],
        ['keep versions', 'snapshot isolation', 'disk pressure'],
        ['discard old versions', 'bounded storage', 'vacuum policy'],
      ],
    ),
    highlight: { found: ['read:benefit', 'commit:benefit'], compare: ['storage:cost', 'cleanup:cost'] },
    explanation: 'MVCC lets reads avoid blocking writes, but old versions must eventually be cleaned. That links FoundationDB directly to MVCC Internals & VACUUM and Isolation Levels.',
  };

  yield {
    state: labelMatrix(
      'FoundationDB compared with adjacent systems',
      [
        { id: 'calvin', label: 'Calvin' },
        { id: 'spanner', label: 'Spanner' },
        { id: 'bigtable', label: 'Bigtable' },
        { id: 'fdb', label: 'FoundationDB' },
      ],
      [
        { id: 'core', label: 'core move' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['deterministic order first', 'known transaction sets'],
        ['timestamp + TrueTime', 'clock uncertainty'],
        ['distributed sorted map', 'weaker transaction model'],
        ['optimistic key-value transactions', 'retry conflicts'],
      ],
    ),
    highlight: { found: ['fdb:core'], compare: ['calvin:core', 'spanner:core', 'bigtable:tradeoff'] },
    explanation: 'FoundationDB is a clean contrast case: strong transactions over ordered keys, implemented through specialized roles and optimistic validation rather than deterministic sequencing or TrueTime.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'unbundled architecture') yield* unbundledArchitecture();
  else if (view === 'optimistic commit') yield* optimisticCommit();
  else throw new InputError('Pick a FoundationDB view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'The architecture view shows a client commit moving through specialized roles. Active nodes are doing commit work: proxy coordination, resolver conflict checks, transaction-log durability, and storage-server application. Found nodes are roles that have accepted their part of the commit path.',
        'The optimistic-commit view shows read versions, conflict ranges, and commit decisions. The safe rule is: a transaction becomes visible only after conflicts are checked against later writes and mutations are durable in the transaction logs.',
        {type:'callout', text:'The FoundationDB architectural lesson is that a small transactional key-value core can stay coherent by splitting commit coordination, conflict detection, durability, and storage into separately scalable roles.'},
      ] },
    { heading: 'Why this exists', paragraphs: [
        'Distributed databases need many clients to read and write concurrently while machines fail and data remains durable. FoundationDB narrows that problem to an ordered key-value store with ACID transactions. Higher-level record stores, indexes, SQL layers, and metadata systems can build above that small core.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a shard that owns everything: data, conflict checks, version assignment, logs, reads, writes, and replication. That works at small scale, but scaling one pressure scales every responsibility together. Another approach weakens transactions and pushes consistency to applications.',
      ] },
    { heading: 'The wall', paragraphs: [
        'The wall is coordination. The system must decide whether concurrent writes conflict, assign a commit order, durably log accepted mutations, serve snapshot reads, retain old versions, and recover after failures. A distributed system cannot hide all of that inside one local storage engine.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Unbundle the transaction system into specialized roles. Proxies coordinate commits and assign versions. Resolvers check conflict ranges. Transaction logs make accepted mutations durable. Storage servers hold key ranges and serve MVCC reads. The external contract stays unified while internal work scales separately.',
      ] },
    { heading: 'How it works', paragraphs: [
        'A client gets a read version and performs snapshot reads over ordered keys. The transaction records read conflict ranges and write conflict ranges. At commit, a proxy asks resolvers whether any conflicting write committed after the read version. If the transaction is safe, mutations receive a commit version and are written to replicated logs before storage servers apply them.',
      ] },
    { heading: 'Why it works', paragraphs: [
        'Correctness comes from versioned optimistic concurrency. A read conflict range says that if this range changed after my read version, my decision may be invalid. Resolvers enforce that rule before commit. Durable logs then preserve the accepted commit order, and MVCC lets readers see a consistent version without blocking writers.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'Optimistic concurrency is cheap when conflicts are rare and expensive when hot keys force retries. A counter key touched by 1,000 clients per second can reject much more work than 1,000 writes spread across independent ranges. MVCC also stores old versions, and long reads can delay cleanup.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'FoundationDB fits metadata stores, record layers, secondary indexes, catalog services, coordination state, and multi-tenant application data that need ordered keys plus strict transactions. It is strongest when several higher-level data models can share one hardened transactional substrate.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It is not a magic answer for high-contention counters, huge analytical scans, or teams unwilling to model keys and retries carefully. Bad key design creates hot ranges. Bad conflict ranges either reject too much work or miss invariants that the layer needed to protect.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'A store transaction reads user/7 and sku/4 at version 100, then writes user/7/cart/item/4 and sku/4/count. Another transaction changes user/7 at version 103. When the first transaction commits, its read conflict range includes user/7, so the resolver rejects it and the client retries. If only sku/4/count changed in a nonconflicting way, the proxy could assign version 104, write mutations to logs, and make storage servers apply them in order.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: FoundationDB: A Distributed Unbundled Transactional Key Value Store at https://www.foundationdb.org/files/fdb-paper.pdf and the ACM entry at https://dl.acm.org/doi/10.1145/3448016.3457559.',
        'Study MVCC Internals and VACUUM, Isolation Levels, Write-Ahead Log, Spanner Case Study, Calvin Deterministic Database Case Study, Bigtable, and Database Indexing next.',
      ] },
  ],
};
