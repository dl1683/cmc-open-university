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
    {
      heading: 'Problem',
      paragraphs: [
        'Distributed databases have to make a hard promise under hostile conditions: many clients can read and write concurrently, machines can fail, data must remain durable, and the final result should still look like a coherent transaction history. A single-node database can lean on one process, one buffer manager, and one write-ahead log. A large distributed service needs the same transactional idea spread across many machines, disks, network links, and key ranges.',
        'FoundationDB is a case study in reducing that problem to a small, strong core. It exposes an ordered key-value store with ACID transactions, then invites record stores, document models, SQL layers, metadata systems, and application-specific indexes to build above it. The educational point is not that key-value APIs are simple. It is that a small transactional substrate can support many data models if the concurrency, durability, versioning, and failure behavior are precise enough.',
        {type:'callout', text:'The FoundationDB architectural lesson is that a small transactional key-value core can stay coherent by splitting commit coordination, conflict detection, durability, and storage into separately scalable roles.'},
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The naive distributed design bundles everything into one server role. Each shard owns data, checks conflicts, chooses versions, writes logs, serves reads, and participates in replication. That can work at small scale, but it makes every shard a complicated mini-database. Scaling one part of the workload means scaling all parts together. A shard that is busy checking conflicts is also the shard trying to serve reads and flush data.',
        'Another naive approach is to weaken the contract. Many distributed key-value stores choose high availability and simple partitioned writes, then leave multi-key consistency to the application. That is acceptable for some caches and event logs, but it is not enough for indexes, metadata, financial ledgers, record stores, or catalog state where related keys must change together. FoundationDB takes the opposite path: keep the external interface small, but make transactions strong.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coordination. If two clients update related keys, the system must decide whether those writes can both commit. If a client reads at one time and commits later, the system must know whether another transaction invalidated that read. If a commit is accepted, the mutations must survive failures before clients are told that the transaction succeeded. If old versions are retained for snapshot reads, they must eventually be cleaned without breaking long-running transactions.',
        'A monolithic design can hide those decisions inside one storage engine. A distributed design cannot. Conflict checking, commit ordering, durable logging, storage, replication, recovery, and metadata movement all become separate sources of latency and failure. FoundationDB makes that separation explicit instead of pretending the database is one giant server.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is unbundling. FoundationDB divides the transaction system into specialized roles. Proxies coordinate commit work and assign versions. Resolvers check whether read and write conflict ranges are safe. Transaction logs durably record accepted mutations in commit order. Storage servers hold key ranges, serve MVCC reads, and apply the mutation stream. Coordinators and the cluster controller manage role assignment and cluster state.',
        'This decomposition turns a database into a pipeline of responsibilities. Each role can scale according to the pressure it actually sees. More commit coordination can use more proxies. More conflict checking can use partitioned resolvers. More durability bandwidth can use replicated logs. More stored data can use more storage servers and key-range movement. The important design move is that the external transaction contract remains unified even though the internal work is split.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A client begins by getting a read version. Reads at that version are snapshot reads over MVCC data. As the client reads and writes, the transaction accumulates conflict ranges. A read conflict range says, in effect, "if someone changed this range after my read version, my decision may no longer be valid." A write conflict range says which keys this transaction modifies for future conflict checks.',
        'At commit time, the client sends the transaction to a proxy. The proxy works with resolvers to validate the conflict ranges against writes that committed after the transaction read version. If no conflict exists, the proxy assigns a commit version and sends mutations to transaction logs. Once enough logs make the commit durable, the client can be told the transaction committed. Storage servers then pull or receive the logged mutations, apply them to their key ranges, and keep enough old versions for snapshot reads.',
        'The ordered key space is the shared substrate. A tuple layer can encode structured values into byte strings that sort correctly. A record layer can place records and indexes into key ranges. A SQL or document layer can map higher-level operations onto range reads and transactional updates. This is why the case study belongs near B-trees, database indexing, MVCC, and write-ahead logging: the low-level key order and version order are what make richer abstractions dependable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an online store transaction that reads user/7, checks whether a cart is still open, writes user/7/cart/item/4, and updates sku/4/count. The transaction reads at version 100. While it is running, another transaction commits at version 103 and changes user/7. When the first transaction tries to commit, its read conflict range includes user/7. The resolver sees that user/7 changed after version 100, so the transaction is rejected and the client retries on a newer snapshot.',
        'Now consider a transaction that reads sku/4 and writes sku/4/count while no conflicting write touched sku/4 after its read version. That transaction can commit at a new version. Its mutations enter the log, storage servers apply them, and later snapshot reads can observe the consistent result. The important point is that locks were not held for the entire user transaction. FoundationDB allowed optimistic work and paid for validation at commit time.',
      ],
    },
    {
      heading: 'Animation lesson',
      paragraphs: [
        'The architecture view shows a client feeding a proxy, then splitting toward resolvers and transaction logs. That split is the essence of the commit path. Conflict validation and durability are both required, but they are different jobs. Storage servers appear downstream because they do not decide whether the transaction is logically valid; they materialize durable committed mutations over key ranges and serve reads.',
        'The optimistic-commit view uses rows for transactions with read versions, read conflict ranges, write conflict ranges, and decisions. The rejected transaction is not a bug in the protocol. It is the expected price of optimistic concurrency under contention. The MVCC frame then shows the complementary cost: readers avoid blocking writers, but the system must retain and later clean old versions. Together the frames teach the main invariant: a committed transaction has a globally ordered version, durable logged mutations, and conflict checks that justify making it visible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'FoundationDB works because it narrows the core abstraction. Ordered byte keys, ranges, versions, and transactions are enough to build many systems, but small enough for the storage engine to reason about rigorously. The database does not need to understand every record schema, document shape, or SQL plan. Layers translate those richer ideas into ordered keys and transactional mutations.',
        'The unbundled architecture also gives the system clean failure boundaries. Logs focus on durability. Resolvers focus on recent conflict history. Storage servers focus on range data and MVCC versions. Proxies coordinate the commit path. When a role fails, recovery can reason about that role instead of untangling one overloaded server process. This separation is one reason FoundationDB is often discussed as much for its engineering discipline as for its API.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Optimistic concurrency is excellent when conflicts are uncommon, but it can waste work when many transactions fight over the same keys or ranges. Hot keys produce retries. Broad conflict ranges protect correctness but reduce concurrency. Narrow conflict ranges increase concurrency but require layer authors to encode invariants carefully. The application must be designed to retry safely because conflict errors are part of normal operation.',
        'MVCC improves read behavior, but old versions consume storage and complicate cleanup. Long-running reads can hold back version garbage collection. Transaction logs are critical durability infrastructure and must be replicated and recovered correctly. Key-range movement is necessary for balance, but it adds operational complexity. The layer model is powerful, but it pushes schema design, index maintenance, and query planning into the layer rather than making them disappear.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'FoundationDB is strong when many higher-level systems need the same transactional substrate. Metadata stores, record layers, secondary indexes, catalog services, coordination state, and multi-tenant application data can all benefit from ordered keys plus strict transactions. It is especially attractive when the organization wants one hardened correctness engine under several product-facing data models.',
        'It also wins when range operations matter. Ordered keys make prefix scans, index ranges, tuple encodings, and hierarchical namespaces natural. A weak hash-based key-value store can be fast, but it does not offer the same foundation for layered indexing and transactional range logic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FoundationDB is not a magic answer for every workload. Extremely high-contention counters, huge long-running analytical scans, and workloads that need rich query planning directly in the core may need a different design or a careful layer. If an application treats retries as exceptional instead of routine, optimistic concurrency will feel surprising under load.',
        'The small core also means users must understand data modeling. Bad key design can create hot ranges. Bad conflict-range design can either reject too much work or miss important invariants at the layer. Operationally, the cluster roles, logs, storage servers, coordinators, backups, and version cleanup all need attention. The payoff is strong, but it is not free.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failure modes include hot-key contention, oversized transactions, long reads that prevent cleanup, under-replicated logs, storage-server imbalance, and layers that encode secondary indexes incorrectly. Another subtle failure is using FoundationDB as if it were a weak key-value store and then rediscovering that transaction boundaries and conflict ranges are the actual programming model.',
        'A healthy design makes retries explicit, keeps transactions small, avoids unnecessary broad conflict ranges, watches storage version lag, and records enough metrics to separate resolver pressure, proxy pressure, log pressure, and storage pressure. The unbundled architecture is easiest to operate when observability follows the same role boundaries as the system.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: "FoundationDB: A Distributed Unbundled Transactional Key Value Store" at https://www.foundationdb.org/files/fdb-paper.pdf and the ACM entry at https://dl.acm.org/doi/10.1145/3448016.3457559.',
        'After this, study MVCC Internals & VACUUM for version retention, Isolation Levels for the user-visible contract, Write-Ahead Log (WAL) for durable ordering, Spanner Case Study for timestamp and TrueTime coordination, Calvin Deterministic Database Case Study for order-first transaction execution, Bigtable for a contrasting sorted-map substrate, and Database Indexing for the layer patterns that ordered keys make possible.',
      ],
    },
  ],
};
