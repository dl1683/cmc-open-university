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
      heading: 'Why It Exists',
      paragraphs: [
        `Distributed control planes need one durable source of truth. If API servers, schedulers, controllers, and operators disagree about desired state, the platform can create duplicate work, lose locks, or reconcile against stale configuration.`,
        `etcd exists for that control-plane job. It is a replicated, strongly consistent key-value store that orders updates with Raft and exposes MVCC revisions, watches, transactions, leases, and range reads to clients.`,
        `The design is intentionally narrow. etcd is not trying to be a warehouse, queue, cache, or blob store. It is trying to make small, important facts durable, ordered, and watchable.`,
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        `The obvious approach is to put configuration in an ordinary database, or to push changes directly to every component. That works while the system is small and failures are clean.`,
        `The wall appears when components need shared ordering. A controller does not only need the current value of a key. It needs to know which revision it observed, which changes happened before it, which lease is still valid, and whether its watch stream missed anything.`,
        `An eventually consistent store can make different controllers act on incompatible histories. For a control plane, that is not just stale data. It can become duplicate leadership, lost ownership, or reconciliation loops built on facts that were never globally ordered.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Put every change through one replicated Raft log, then expose the applied result as MVCC revisions. Raft decides the order. The backend stores revisioned key-value state. Watches let clients follow the ordered stream from a known revision.`,
        `That combination turns a key-value store into a coordination database. Clients can write desired state, read a consistent snapshot, attach a lease, start a watch at revision r, and recover if r has been compacted.`,
        `The important product is not a value by itself. The product is a value with a revision, an order, and a recovery story.`,
      ],
    },
    {
      heading: 'Reading the etcd Trace',
      paragraphs: [
        `Use the "write path" view to follow a client request as it moves from the leader into the Raft log, through quorum replication, into commit, and finally into the MVCC backend. The important boundary is the applied revision: that is what reads and watches can observe.`,
        `Use the "snapshot recovery" view to follow the operational side. WAL records preserve recent Raft entries, snapshots give a compact recovery base, compaction bounds old MVCC history, and restore drills prove that the backup is usable.`,
        `The trace is not showing a generic database write. It is showing the chain that makes Kubernetes-style control-plane coordination possible: client request, consensus order, durable storage, applied revision, watch delivery, and recovery path.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `A write normally reaches the Raft leader. The leader proposes it as a log entry, persists it, replicates it to followers, and marks it committed after a quorum stores it. Only then is the command applied to the key-value backend.`,
        `Applying the command creates a new MVCC revision. A range read can observe a consistent revision. A watch can stream changes after a revision. A transaction can compare versions or revisions before writing.`,
        `Each member maintains write-ahead log files for Raft state and entries. Snapshots let a member compact old Raft log history. Backend compaction removes old MVCC revisions after clients no longer need them. These are separate mechanisms that together keep the store recoverable and bounded.`,
        `Leases add time-bounded ownership. A key attached to a lease disappears when the lease expires, which makes etcd useful for leader election records, service discovery, and ephemeral coordination metadata.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Raft gives etcd one committed order for writes. MVCC turns that order into observable revisions. A watcher can ask to resume from revision r because the system has a total order of applied changes.`,
        `Quorum protects that order during failures. A minority partition cannot keep accepting writes as if it were the cluster. That is the right trade for control-plane truth: it is better to reject or stall a write than to let two schedulers believe different desired states are both current.`,
        `The watch API works because the storage layer and the consensus layer agree on revision boundaries. A controller can list at a revision, start a watch after that revision, and avoid missing the gap between initial state and future updates.`,
      ],
    },
    {
      heading: 'Worked Case Study',
      paragraphs: [
        `A Kubernetes Deployment update begins when the API server writes a new desired spec into etcd. That write is ordered through Raft and applied as a new MVCC revision.`,
        `Controllers do not poll blindly for "whatever looks newest." They watch from known revisions. The Deployment controller sees the changed object, calculates the needed ReplicaSet changes, writes more desired state, and other controllers continue the chain.`,
        `If a controller falls too far behind and its requested revision has been compacted, it cannot pretend the watch stream is complete. It must relist, obtain a fresh revision, and restart the watch. That relist behavior is part of correctness, not an inconvenience around it.`,
        `Disaster recovery has the same shape. A snapshot is useful only if restoring it creates a coherent cluster with the right identity and membership assumptions. A backup that has never been restored is only a guess.`,
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        `The main cost is synchronous coordination. Linearizable writes, and linearizable reads when requested, involve the leader and quorum path. Disk latency, network latency, and leader health matter directly to the whole control plane.`,
        `The second cost is retention management. Watches and historical reads depend on retained MVCC revisions. Compaction keeps storage bounded, but it forces slow clients to handle compacted revisions by relisting.`,
        `The third cost is operational discipline. Large values, too many watchers, poor compaction settings, slow disks, overloaded members, or careless restore procedures can turn a small coordination database into a platform-wide bottleneck.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `etcd wins for small, important, coordination-heavy data: Kubernetes objects, service-discovery records, configuration, leader-election keys, distributed locks, and lease-backed metadata.`,
        `It is strongest when clients need more than storage. They need conditional writes, ordered watches, revisioned reads, and a failure model that prefers consistency over accepting conflicting updates.`,
        `It is also strong as a teaching case because it connects several ideas that are often studied separately: Raft leader election, log replication, write-ahead logging, snapshots, MVCC, leases, watches, and reconciliation loops.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `etcd fails when used as a general data platform. It is not a message queue, analytics store, blob store, cache, or high-cardinality event log. Pushing large values or noisy events through it harms the systems that depend on it for coordination.`,
        `It also fails when clients ignore revision boundaries. A watch that silently skips compacted history is a correctness bug. A restore that ignores member identity or cluster membership can create a different kind of outage than the one it was meant to fix.`,
        `The most common misconception is that "strongly consistent" means "operationally forgiving." etcd is strict, but it is not magic. It rewards small data, fast disks, healthy quorum, regular snapshots, and practiced recovery.`,
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: etcd persistent storage files at https://etcd.io/docs/v3.6/learning/persistent-storage-files/, etcd disaster recovery at https://etcd.io/docs/v3.5/op-guide/recovery/, and the etcd Raft library at https://github.com/etcd-io/raft. Study Raft Log Replication, Raft Snapshots, Write-Ahead Log, MVCC Internals & VACUUM, and Kubernetes Reconciliation Case Study next.',
      ],
    },
  ],
};
