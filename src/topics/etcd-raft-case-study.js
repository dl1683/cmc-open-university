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
    { heading: 'How to read the animation', paragraphs: [
      'The write-path view follows one mutation from client request to durable cluster state. Raft is a consensus algorithm: it makes several machines agree on one ordered log even when some machines crash or messages are delayed. Active nodes are stages currently processing the write, found nodes are durable or observable state, and compare nodes are acknowledgments waiting for a quorum.',
      'The recovery view shows the write-ahead log, snapshots, and the MVCC backend. MVCC means multiversion concurrency control, where each committed change receives a revision number. The safe inference rule is: a client can observe only entries that have been committed by Raft and applied to the backend.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Distributed control planes need one ordered truth for small critical facts. Kubernetes stores desired cluster objects in etcd, and controllers use those objects to schedule pods, update services, and keep state converged. If two controllers see incompatible histories, they can both act correctly locally and still break the cluster globally.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Kubernetes.png',
          alt: 'Kubernetes architecture showing control plane components connected to worker nodes',
          caption: 'Kubernetes control plane architecture. The API server, scheduler, and controller-manager all depend on etcd as the single source of truth for cluster state. Every object -- pods, services, deployments -- lives as an etcd key-value pair.',
        },
      'etcd exists for coordination data, not bulk application data. It gives clients linearizable writes, revisioned reads, watches, leases, and compare-and-swap transactions. Those features let clients ask not only what value exists, but exactly where that value sits in the global order.',
        {
          type: 'callout',
          text: 'etcd is not a general database. It is a coordination primitive -- a strongly ordered, revision-stamped truth store for small, critical configuration that distributed components must agree on.',
        },
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a normal database or a broadcast configuration service. A database can store keys durably, and a broadcaster can push changes to subscribers. For one process or one data center with clean failures, that seems enough.',
      'The missing feature is an ordered recovery stream. After a controller crash, it must ask what changed after revision 1042 and know whether revision 1043 is the next event. A plain cache or best-effort broadcast cannot prove that no event was missed.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is ordering under partial failure. A network partition can let one side keep serving old data while the other side accepts new data. Without majority agreement, both sides may believe they are current.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Split-Brain_Beispiel.svg',
          alt: 'Split-brain scenario where a network partition divides a cluster into two independent subclusters producing conflicting results',
          caption: 'A split-brain partition divides the cluster into two independent halves, each accepting writes. Without majority-based consensus, both sides believe they hold the truth -- and neither does.',
        },
      'For a control plane, conflicting histories are worse than refusing writes. Duplicate leaders, missed deletes, and stale leases can make downstream systems act on facts that never belonged to one timeline. The system needs a single log before it needs a faster key-value API.',
    ] },
    { heading: 'The core insight', paragraphs: [
        {
          type: 'callout',
          text: 'Put every change through one replicated Raft log, then expose the applied result as MVCC revisions. Raft decides the order. The backend stores revisioned key-value state. Watches let clients follow the ordered stream from any known revision.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Raft_Consensus_Algorithm_Mascot_on_transparent_background.svg',
          alt: 'Raft consensus algorithm logo -- a log raft mascot representing the replicated log abstraction',
          caption: 'The Raft consensus algorithm, designed by Diego Ongaro and John Ousterhout (2014), is named for the metaphor of logs lashed together into a raft -- a replicated log that keeps the cluster afloat even when individual nodes fail.',
        },
      'etcd combines Raft for agreement with MVCC for observation. Raft decides entry order and commitment. MVCC turns each applied entry into a revision that clients can read, compare, and watch.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A client write reaches the Raft leader. The leader appends the entry to its log, writes it to the WAL, and sends AppendEntries messages to followers. Once a majority has persisted the entry, the leader marks it committed and the members apply it in log order.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Lamport-Clock-en.svg',
          alt: 'Lamport clock diagram showing three processes with message arrows and clock values demonstrating causal ordering',
          caption: 'Causal ordering in distributed systems. Raft solves a stronger problem -- total ordering via a single leader -- but the challenge is the same: multiple processes must agree on what happened before what. Lamport clocks capture happens-before; Raft enforces a single log.',
        },
      'The applied entry updates the backend and creates a new revision. Range reads can return values at a revision, and watches can stream later revisions. Snapshots bound replay time by recording applied state so a restarting member does not replay the entire log from the beginning.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Raft safety gives etcd its core correctness property: once an entry is committed, any later leader must contain that entry in its log. A minority partition cannot form a quorum, so it cannot commit conflicting writes. That is why etcd prefers temporary unavailability to split-brain mutation.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/CAP_Theorem.svg',
          alt: 'CAP theorem triangle showing the tradeoff between Consistency, Availability, and Partition tolerance',
          caption: 'The CAP theorem frames the tradeoff etcd makes explicit. etcd chooses CP: consistency and partition tolerance. During a network partition, the minority side becomes unavailable for writes rather than accepting conflicting updates. This is the correct trade for control-plane truth.',
        },
      'MVCC preserves the observation boundary. If a client lists at revision 1042 and starts a watch at 1043, every later event has a place in that sequence unless compaction has removed the history. A compaction error is explicit, so the client can relist rather than unknowingly skip state.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Write latency behaves like quorum network round trip plus disk fsync. In a five-member cluster, a write can commit after the leader and any two followers persist it. If follower fsync latency jumps from 1 ms to 20 ms, the whole control plane feels it because every write waits for durable majority storage.',
        {
          type: 'callout',
          text: 'The single most common etcd performance problem in production is slow disk fsync. A spinning disk or a shared SSD with noisy neighbors can turn etcd into a platform-wide bottleneck. Dedicated NVMe with sustained sub-millisecond P99 fsync is the minimum for serious deployments.',
        },
      'Space grows with retained revisions until compaction removes old history. Keeping one hour of revisions helps slow watchers recover, but a noisy key that changes 1,000 times per second creates 3.6 million revisions in that hour. Compaction saves disk, while aggressive compaction forces more clients to relist.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'etcd fits control-plane metadata: Kubernetes objects, service discovery records, leader election keys, leases, and feature flags that need ordered change streams. The data should be small, important, and coordination-heavy. The access pattern is many readers and watchers following one ordered keyspace.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Pod-networking.png',
          alt: 'Kubernetes pod networking diagram showing how pods communicate through services',
          caption: 'Kubernetes pod networking. Every network endpoint, service route, and pod scheduling decision is ultimately backed by etcd state. When a pod is created, its spec enters etcd through the API server, and the kubelet on the target node watches for assignments.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Logo_of_etcd.svg',
          alt: 'etcd logo',
          caption: 'etcd is a CNCF graduated project, battle-tested in production Kubernetes clusters worldwide. The name comes from the Unix /etc directory (where configuration lives) plus "d" for distributed.',
        },
    ] },
    { heading: 'Where it fails', paragraphs: [
      'etcd fails as a general database, event log, queue, or blob store. Large values and high-cardinality event streams force every member to replicate work that should live elsewhere. A pointer in etcd plus data in object storage is usually safer than placing the object in etcd.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Byzantine_Generals.png',
          alt: 'Byzantine Generals problem illustration showing coordinated attack versus failed coordination with deceptive commanders',
          caption: 'The Byzantine Generals problem: generals must agree on a plan despite potentially traitorous messengers. etcd solves a simpler variant -- crash faults, not Byzantine faults. Nodes may crash or become unreachable, but they do not lie. This is why etcd uses Raft (crash fault tolerant) rather than BFT protocols -- the threat model for data-center coordination is network partitions and process crashes, not malicious nodes.',
        },
        {
          type: 'callout',
          text: 'A restore that uses the wrong cluster identity or member IDs can create a worse outage than the one it was meant to fix. etcd snapshot restore deliberately requires the operator to specify new cluster metadata, forcing awareness that identity is part of the data.',
        },
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose a Kubernetes API server writes a Deployment update while etcd has five members. The leader appends the mutation at Raft index 8,837 and writes it to its WAL. Two followers persist the same entry, giving three durable copies out of five, which is a quorum.',
      'The commit index advances to 8,837 and the backend applies the mutation as revision 1,043. A Deployment controller that previously listed at revision 1,042 receives the revision 1,043 watch event. It does not need to guess whether something happened between those revisions because Raft and MVCC define the order.',
      'If the controller is offline until compaction removes revision 1,043, its old watch start fails. That failure is correct behavior. The controller must relist at the latest revision and restart the watch from that new boundary.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: the etcd documentation on persistent storage, recovery, and the etcd Raft library, plus the Raft paper by Ongaro and Ousterhout. For Kubernetes behavior, study the informer list-then-watch pattern and the API server storage contract.',
      'Study next: Raft leader election, write-ahead logs, MVCC, Kubernetes reconciliation, ZooKeeper ZAB, and range-sharded Raft systems such as TiKV. The key question is whether your coordination data fits in one ordered log.',
    ] },
  ],
};
