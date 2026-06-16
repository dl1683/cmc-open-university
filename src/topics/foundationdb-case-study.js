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
      heading: 'What it is',
      paragraphs: [
        'FoundationDB is a distributed transactional key-value store. It exposes ordered keys and ACID transactions, then encourages richer data models to be built as layers on top of that core.',
        'The case study matters because the architecture is deliberately unbundled. Proxies, resolvers, transaction logs, storage servers, and coordinators each have specific jobs. That decomposition makes the database easier to scale, reason about, and test under failure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Clients read at a snapshot version and build a transaction. The commit path sends read and write conflict ranges through proxies to resolvers. If validation succeeds, a commit version is assigned and mutations are written to transaction logs. Storage servers later apply mutations and serve versioned reads over assigned key ranges.',
        'Higher-level data models are implemented as layers. A record layer, document layer, or SQL layer maps its abstractions onto ordered keys and transactions. This keeps the storage core small while enabling richer systems above it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Optimistic commits can retry under contention. MVCC needs version cleanup. Logs and resolvers are critical infrastructure. Key-range movement, data distribution, and long-running reads create operational complexity. The payoff is a strongly transactional ordered key-value substrate that can support many higher-level models.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FoundationDB is used as a substrate for record stores, metadata systems, indexes, document models, and transactional services. Its layer pattern is useful anywhere a small, reliable core can support multiple application-facing abstractions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'FoundationDB is not "just a key-value store" in the weak NoSQL sense. The key-value interface is small, but the transaction semantics are strong. Another misconception is that optimistic concurrency removes contention. It detects contention and pushes some cost into retries.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: "FoundationDB: A Distributed Unbundled Transactional Key Value Store" at https://www.foundationdb.org/files/fdb-paper.pdf and ACM DOI at https://dl.acm.org/doi/10.1145/3448016.3457559. Study MVCC Internals & VACUUM, Isolation Levels, Write-Ahead Log (WAL), Spanner Case Study, Calvin Deterministic Database Case Study, and Database Indexing next.',
      ],
    },
  ],
};
