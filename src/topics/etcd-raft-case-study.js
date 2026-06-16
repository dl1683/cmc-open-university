// etcd Raft case study: replicated KV state, WAL, snapshots, and watches.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'etcd-raft-case-study',
  title: 'etcd Raft Case Study',
  category: 'Systems',
  summary: 'etcd as a production consensus-backed KV store: clients talk to a leader, Raft orders writes, WAL and snapshots protect state, and watches stream revisions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['write path', 'snapshot recovery'], defaultValue: 'write path' },
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

function etcdGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client/API server', x: 0.8, y: 3.5, note: 'gRPC request' },
      { id: 'leader', label: 'etcd leader', x: 2.8, y: 3.5, note: 'Raft leader' },
      { id: 'raftlog', label: 'Raft log entry', x: 4.6, y: 2.0, note: 'ordered write' },
      { id: 'wal', label: 'WAL segment', x: 4.6, y: 5.0, note: 'durable entries' },
      { id: 'followers', label: 'followers', x: 6.6, y: 2.0, note: 'AppendEntries' },
      { id: 'apply', label: 'apply index', x: 6.6, y: 5.0, note: 'committed revision' },
      { id: 'backend', label: 'MVCC KV backend', x: 8.5, y: 3.5, note: 'key revisions' },
      { id: 'watch', label: 'watchers', x: 9.7, y: 5.6, note: 'revision stream' },
    ],
    edges: [
      { id: 'e-client-leader', from: 'client', to: 'leader', weight: 'Put/Delete' },
      { id: 'e-leader-log', from: 'leader', to: 'raftlog', weight: 'propose' },
      { id: 'e-log-wal', from: 'raftlog', to: 'wal', weight: 'persist' },
      { id: 'e-log-followers', from: 'raftlog', to: 'followers', weight: 'replicate' },
      { id: 'e-followers-apply', from: 'followers', to: 'apply', weight: 'majority ack' },
      { id: 'e-apply-backend', from: 'apply', to: 'backend', weight: 'apply revision' },
      { id: 'e-backend-watch', from: 'backend', to: 'watch', weight: 'notify' },
    ],
  }, { title });
}

function* writePath() {
  yield {
    state: etcdGraph('etcd writes are ordered through a Raft leader'),
    highlight: { active: ['client', 'leader', 'raftlog', 'e-client-leader', 'e-leader-log'], compare: ['followers'] },
    explanation: 'etcd is a replicated key-value store. A write is proposed to the current leader, assigned a Raft log position, and replicated before it becomes visible as a committed revision.',
  };

  yield {
    state: etcdGraph('The WAL protects log entries before apply'),
    highlight: { active: ['raftlog', 'wal', 'e-log-wal'], found: ['followers'] },
    explanation: 'Each member persists Raft metadata and entries in WAL segments. If the process crashes, replay starts from stable storage instead of trusting memory.',
    invariant: 'A committed write must survive a member restart.',
  };

  yield {
    state: labelMatrix(
      'From Raft commit to MVCC revision',
      [
        { id: 'term', label: 'term/index' },
        { id: 'commit', label: 'commit index' },
        { id: 'apply', label: 'apply index' },
        { id: 'revision', label: 'KV revision' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'clientEffect', label: 'client effect' },
      ],
      [
        ['consensus position', 'orders writes'],
        ['majority replicated', 'safe to apply'],
        ['state machine progressed', 'backend updated'],
        ['MVCC version', 'watch/read boundary'],
      ],
    ),
    highlight: { found: ['commit:clientEffect', 'revision:clientEffect'], active: ['apply:meaning'] },
    explanation: 'Raft decides the order. The MVCC backend turns that order into key revisions. Watch clients and read APIs reason about those revisions.',
  };

  yield {
    state: labelMatrix(
      'etcd guarantees in practice',
      [
        { id: 'linear', label: 'linearizable read' },
        { id: 'serial', label: 'serializable read' },
        { id: 'watch', label: 'watch stream' },
        { id: 'txn', label: 'transaction' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['leader/quorum path', 'fresh but higher latency'],
        ['local member path', 'faster, may lag'],
        ['revision ordered events', 'client must handle compaction'],
        ['compare-and-swap', 'coordination primitive'],
      ],
    ),
    highlight: { active: ['linear:tradeoff', 'txn:route'], compare: ['serial:tradeoff'] },
    explanation: 'etcd exposes consensus choices as API semantics. Clients choose freshness, latency, watches, and compare-and-swap transactions depending on the control-plane job.',
  };
}

function* snapshotRecovery() {
  yield {
    state: labelMatrix(
      'Persistence surfaces',
      [
        { id: 'wal', label: 'WAL files' },
        { id: 'snap', label: 'snapshot' },
        { id: 'backend', label: 'backend db' },
        { id: 'member', label: 'member metadata' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['Raft hard state and entries', 'replay after crash'],
        ['compacted state point', 'avoid replaying forever'],
        ['MVCC key-value data', 'serve reads after apply'],
        ['cluster identity', 'avoid unsafe restore'],
      ],
    ),
    highlight: { found: ['wal:why', 'snap:why'], active: ['backend:stores'] },
    explanation: 'etcd durability is layered. WAL handles recent Raft entries, snapshots bound log growth, and the backend stores applied MVCC state.',
  };

  yield {
    state: etcdGraph('Snapshot and compaction keep old history bounded'),
    highlight: { active: ['wal', 'apply', 'backend'], compare: ['watch'] },
    explanation: 'After entries are safely applied and snapshotted, old Raft log prefixes can be compacted. Separately, MVCC history can be compacted, which affects old watch revisions.',
    invariant: 'Compaction must not discard state needed for recovery or active clients.',
  };

  yield {
    state: labelMatrix(
      'Disaster recovery flow',
      [
        { id: 'save', label: 'snapshot save' },
        { id: 'restore', label: 'snapshot restore' },
        { id: 'newcluster', label: 'new cluster metadata' },
        { id: 'verify', label: 'verify health' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['copy consistent backend snapshot', 'stale if not scheduled'],
        ['create new data dir', 'wrong identity can corrupt'],
        ['fresh member IDs', 'must not join old broken cluster'],
        ['check quorum and revision', 'control plane depends on it'],
      ],
    ),
    highlight: { active: ['save:action', 'restore:action'], compare: ['newcluster:risk'], found: ['verify:action'] },
    explanation: 'A backup is not just a file; it is a recovery procedure. Restoring etcd safely means treating cluster identity and quorum membership as part of the data.',
  };

  yield {
    state: labelMatrix(
      'Complete Kubernetes control-plane case study',
      [
        { id: 'api', label: 'API write' },
        { id: 'etcd', label: 'etcd commit' },
        { id: 'controller', label: 'controller watch' },
        { id: 'restore', label: 'restore drill' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'lesson' },
      ],
      [
        ['Deployment spec', 'state enters consensus'],
        ['Raft plus MVCC revision', 'one ordered truth'],
        ['watch from revision', 'reconcile from durable changes'],
        ['snapshot restore', 'backup procedure must be practiced'],
      ],
    ),
    highlight: { found: ['etcd:lesson', 'controller:lesson'], compare: ['restore:lesson'] },
    explanation: 'Kubernetes uses etcd as its source of durable control-plane truth. Losing etcd or restoring it incorrectly can be worse than losing a worker node.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'write path') yield* writePath();
  else if (view === 'snapshot recovery') yield* snapshotRecovery();
  else throw new InputError('Pick an etcd-Raft view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'etcd is a replicated, strongly consistent key-value store used as a control-plane database, most famously by Kubernetes. It uses Raft to order changes across members and exposes MVCC revisions, watches, transactions, leases, and range reads to clients.',
        'This case study connects Raft Leader Election, Raft Log Replication, Raft Snapshots, Write-Ahead Log, MVCC Internals & VACUUM, and Kubernetes Reconciliation Case Study. It is where consensus becomes an operational database.',
        'The key point is that etcd is small by design. Its value is not raw data volume; its value is giving distributed control planes one durable, ordered, watchable source of truth that all components can coordinate around.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A write goes to the leader, becomes a proposed Raft log entry, is persisted, replicated to a quorum, committed, and then applied to the MVCC key-value backend. The resulting revision becomes the boundary that reads and watches can observe.',
        'Each member maintains WAL files for Raft state and entries. Snapshots and compaction keep log growth bounded. The backend stores applied key revisions, while watch streams let clients subscribe to ordered changes from a revision.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of etcd is the cost of synchronous coordination. Linearizable writes and reads involve the leader and quorum path. Large values, too many watchers, slow disks, bad compaction settings, or network latency can harm the entire control plane.',
        'The operational challenge is that etcd is both small and critical. It is not a general analytics store. It wants small keys and values, predictable disk latency, regular snapshots, monitored compaction, and disciplined restore procedures.',
        'Revision history is another practical boundary. Watches and historical reads depend on retained MVCC revisions. Compaction keeps storage bounded, but clients that fall behind must handle compacted revisions by relisting and restarting from a fresh revision.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'etcd stores Kubernetes objects, service-discovery data, configuration, leader-election records, distributed coordination keys, and lease-backed metadata for systems that need a single ordered truth.',
        'A complete case study is a Kubernetes Deployment update. The API server writes the new desired state to etcd. Controllers watch the revision stream, enqueue the changed object, and reconcile Pods until observed state matches the stored spec.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'etcd is not a message queue, data warehouse, or high-cardinality event store. Watches are powerful, but old revisions can be compacted. Snapshots are necessary, but restore drills are what prove that the backup is actually usable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: etcd persistent storage files at https://etcd.io/docs/v3.6/learning/persistent-storage-files/, etcd disaster recovery at https://etcd.io/docs/v3.5/op-guide/recovery/, and the etcd Raft library at https://github.com/etcd-io/raft. Study Raft Log Replication, Raft Snapshots, Write-Ahead Log, MVCC Internals & VACUUM, and Kubernetes Reconciliation Case Study next.',
      ],
    },
  ],
};
