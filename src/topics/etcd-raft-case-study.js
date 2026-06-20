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
      heading: 'How to read the animation',
      paragraphs: [
        'The "write path" view traces a client request from gRPC entry through Raft proposal, WAL persistence, quorum replication, commit, MVCC apply, and watch delivery. Active nodes are the current stage of the write. Found nodes are durable state that survives a crash. Compare nodes are participants whose acknowledgment is pending.',
        'The "snapshot recovery" view traces the operational lifecycle: WAL segments, snapshots, backend compaction, and disaster-recovery restore. Active nodes are the persistence surfaces in play. Found nodes are recovery artifacts. Compare nodes are watchers affected by compaction.',
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and the edge leading to it is highlighted, that stage has received or produced data. If a downstream node is not yet active, the data has not reached it and no client can observe it there.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'etcd design premise',
          text: 'A control plane that disagrees with itself about desired state is worse than a control plane that briefly refuses to answer.',
        },
        'Distributed platforms -- Kubernetes, service meshes, feature-flag systems, distributed schedulers -- need a single ordered source of truth for small, critical configuration. If two controllers read different versions of a Deployment spec and both act, the result is duplicate pods, lost ownership, or reconciliation loops built on facts that were never globally ordered.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Kubernetes.png',
          alt: 'Kubernetes architecture showing control plane components connected to worker nodes',
          caption: 'Kubernetes control plane architecture. The API server, scheduler, and controller-manager all depend on etcd as the single source of truth for cluster state. Every object -- pods, services, deployments -- lives as an etcd key-value pair.',
        },
        'etcd exists for that narrow job. It is a replicated, strongly consistent key-value store that orders every mutation through Raft consensus and exposes the result as MVCC revisions. Clients get watches, leases, transactions, and range reads -- all anchored to a global revision number.',
        'The design is intentionally small. etcd stores coordination metadata, not application data. A typical healthy etcd database is under 8 GB. That constraint is a feature: it keeps consensus fast, replication cheap, and snapshots quick.',
        {
          type: 'callout',
          text: 'etcd is not a general database. It is a coordination primitive -- a strongly ordered, revision-stamped truth store for small, critical configuration that distributed components must agree on.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to store configuration in an ordinary database -- PostgreSQL, MySQL, Redis -- and let each component read what it needs. This works while the cluster is small, failures are clean, and no two components need to agree on ordering.',
        'Teams also try direct push: a central config service broadcasts changes to every subscriber. This avoids polling but assumes the broadcaster never crashes mid-broadcast and every subscriber processes messages in the same order.',
        {
          type: 'code',
          language: 'javascript',
          body: `// Naive config broadcast: simple, fragile under partial failure.
function broadcastUpdate(key, value, subscribers) {
  for (const sub of subscribers) {
    try { sub.onUpdate(key, value); }
    catch (err) { log.warn('subscriber missed update', sub.id, err); }
  }
  // No ordering guarantee. No delivery proof. No recovery story.
}`,
        },
        'Both approaches share the same gap: they give you a value, but not a revision, not a total order, and not a way for a recovering component to ask "what did I miss since revision r?"',
        {
          type: 'table',
          headers: ['Approach', 'What it provides', 'What it lacks'],
          rows: [
            ['Single DB (Postgres/MySQL)', 'Durable storage, SQL queries', 'No watch stream, no revision anchoring, no built-in leader election'],
            ['Redis pub/sub', 'Fast push notification', 'No persistence guarantee, no total ordering, fire-and-forget semantics'],
            ['Config file on disk', 'Simple to read', 'No coordination, no atomicity, no cross-node agreement'],
            ['Manual broadcast', 'Direct push to subscribers', 'No delivery proof, no ordering, no crash recovery'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not storage. The wall is ordering under failure.',
        'A controller does not just need the current value of a key. It needs to know which revision it last observed, whether any changes happened between that revision and now, whether its lease is still valid, and whether its watch stream has gaps. An eventually consistent store cannot answer those questions reliably.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Split-Brain_Beispiel.svg',
          alt: 'Split-brain scenario where a network partition divides a cluster into two independent subclusters producing conflicting results',
          caption: 'A split-brain partition divides the cluster into two independent halves, each accepting writes. Without majority-based consensus, both sides believe they hold the truth -- and neither does.',
        },
        {
          type: 'table',
          headers: ['Failure mode', 'What goes wrong', 'Why ordering fixes it'],
          rows: [
            ['Split-brain writes', 'Two partitions accept conflicting updates', 'Raft majority rejects the minority partition'],
            ['Missed watch events', 'Controller acts on stale state', 'MVCC revisions let watchers detect and recover gaps'],
            ['Stale leader election', 'Two nodes believe they are leader', 'Lease expiry plus linearizable reads prevent stale reads'],
            ['Unordered recovery', 'Restored node replays events in wrong order', 'WAL replay follows the Raft log, which is totally ordered'],
            ['Silent data divergence', 'Nodes drift apart without detection', 'Every applied mutation has a unique revision; any divergence is visible'],
          ],
        },
        'An eventually consistent store can make different controllers act on incompatible histories. For a control plane, that is not stale data -- it is duplicate leadership, lost ownership, or a reconciliation loop that never converges.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
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
        'Raft decomposes consensus into three independent subproblems: leader election (who coordinates), log replication (how entries spread), and safety (why committed entries are never lost). etcd builds directly on this decomposition, mapping each Raft concept to a concrete system component.',
        {
          type: 'diagram',
          alt: 'etcd write path from client to watcher',
          label: 'The chain from mutation to observation',
          body: `Client gRPC request
       |
       v
  Raft leader (propose log entry)
       |
       +---> WAL persist (local durability)
       |
       +---> Replicate to followers (AppendEntries)
       |
       v
  Quorum acknowledges (majority)
       |
       v
  Commit index advances
       |
       v
  Apply to MVCC backend (new revision r)
       |
       +---> Range reads observe revision r
       |
       +---> Watchers receive revision r events`,
          text: `Client gRPC request
       |
       v
  Raft leader (propose log entry)
       |
       +---> WAL persist (local durability)
       |
       +---> Replicate to followers (AppendEntries)
       |
       v
  Quorum acknowledges (majority)
       |
       v
  Commit index advances
       |
       v
  Apply to MVCC backend (new revision r)
       |
       +---> Range reads observe revision r
       |
       +---> Watchers receive revision r events`,
        },
        'The product is not a value. The product is a value with a revision, a total order, and a recovery story. Clients can write desired state, read a consistent snapshot at revision r, attach a lease, start a watch after r, and relist if r has been compacted.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A write reaches the Raft leader via gRPC. The leader assigns a log index, persists the entry to its WAL, and sends AppendEntries RPCs to followers. Once a quorum (majority) has persisted the entry, the leader advances the commit index. Each member then applies committed entries to its local MVCC backend in log order.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Lamport-Clock-en.svg',
          alt: 'Lamport clock diagram showing three processes with message arrows and clock values demonstrating causal ordering',
          caption: 'Causal ordering in distributed systems. Raft solves a stronger problem -- total ordering via a single leader -- but the challenge is the same: multiple processes must agree on what happened before what. Lamport clocks capture happens-before; Raft enforces a single log.',
        },
        {
          type: 'bullets',
          items: [
            'WAL (write-ahead log): stores Raft hard state (term, vote, commit index) and log entries. Survives process crashes. Replay starts from the last snapshot plus WAL entries.',
            'Snapshot: a point-in-time capture of applied state. Bounds WAL replay length. Without snapshots, a restarting member would replay the entire Raft log from genesis.',
            'MVCC backend (bbolt): stores key-value pairs indexed by revision. Each put or delete creates a new revision. Old revisions are retained until compacted.',
            'Leases: time-bounded ownership tokens. A key attached to a lease is deleted when the lease expires or is revoked. Leader election keys and service-discovery records use leases.',
            'Watches: clients subscribe to changes after a given revision. The server streams events in revision order. If the requested revision has been compacted, the watch fails and the client must relist.',
          ],
        },
        {
          type: 'code',
          language: 'javascript',
          body: `// Simplified etcd read/watch contract in pseudocode.
// Linearizable read: routes through leader, confirms commit index.
async function linearizableGet(key) {
  await leader.readIndex();          // confirm this node is still leader
  return backend.getAtRevision(key, appliedRevision);
}

// Watch: stream events from a known revision.
function watchFrom(key, startRevision) {
  if (startRevision < compactedRevision) {
    throw new CompactedError(compactedRevision);
    // Client must relist and restart the watch.
  }
  return backend.streamEventsAfter(key, startRevision);
}`,
        },
        'Transactions provide compare-and-swap semantics. A client can say "if key A has version v, then put key B" atomically. This is the primitive behind distributed locks, leader elections, and conditional configuration updates.',
        {
          type: 'code',
          language: 'javascript',
          body: `// etcd transaction: atomic compare-and-swap.
// "If /leaders/scheduler has create_revision == 42, renew its lease.
//  Otherwise, someone else took leadership -- do nothing."
const txn = client.txn()
  .if({ key: '/leaders/scheduler', createRevision: 42 })
  .then({ put: { key: '/leaders/scheduler', value: myID, lease: myLease } })
  .else({ /* no-op: lost the race */ });
await txn.commit();`,
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Raft guarantees a single committed order for all mutations. No two members can apply entries in different sequences. MVCC turns that order into observable revisions. A watcher can resume from revision r because the system has a total order of applied changes -- there is no ambiguity about what "after r" means.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/CAP_Theorem.svg',
          alt: 'CAP theorem triangle showing the tradeoff between Consistency, Availability, and Partition tolerance',
          caption: 'The CAP theorem frames the tradeoff etcd makes explicit. etcd chooses CP: consistency and partition tolerance. During a network partition, the minority side becomes unavailable for writes rather than accepting conflicting updates. This is the correct trade for control-plane truth.',
        },
        'Quorum protects that order during partitions. A minority partition cannot accept writes because it cannot form a majority. That is the right trade for control-plane truth: rejecting or stalling a write is safer than letting two schedulers act on conflicting desired states.',
        {
          type: 'note',
          text: 'The watch contract works because the storage layer and the consensus layer agree on revision boundaries. A controller can list-at-revision, start a watch after that revision, and know there is no gap. That list-then-watch pattern is the foundation of Kubernetes informers.',
        },
        'Linearizable reads confirm the leader is current before responding. Serializable reads skip that confirmation and may return slightly stale data -- faster, but the client must tolerate lag. The choice is explicit in the API, not hidden.',
        {
          type: 'table',
          headers: ['Read mode', 'Route', 'Guarantee', 'Latency cost'],
          rows: [
            ['Linearizable', 'Leader confirms quorum', 'Reads reflect all committed writes', '1 extra RTT for ReadIndex confirmation'],
            ['Serializable', 'Any member, local read', 'May lag behind committed state', 'No quorum check -- lowest latency'],
          ],
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'Why it matters'],
          rows: [
            ['Write latency', '1 RTT to quorum + WAL fsync on each member', 'Disk latency and network latency directly gate every write'],
            ['Read latency (linearizable)', 'Leader round-trip to confirm commit index', 'Slower than local read, but guarantees freshness'],
            ['Read latency (serializable)', 'Local member read, no quorum check', 'Fast but may lag behind committed state'],
            ['Storage', 'MVCC revisions accumulate until compacted', 'Unbounded retention grows the database; compaction is mandatory'],
            ['Watch cost', 'One goroutine per watcher, events streamed in order', 'Thousands of watchers on hot keys stress the leader'],
            ['Recovery time', 'Snapshot load + WAL replay + catch-up replication', 'Large databases or long WAL tails slow restart'],
          ],
        },
        'The dominant operational cost is not CPU. It is disk fsync latency, because every committed write requires durable WAL persistence on a majority of members before the client gets a response. Slow disks turn etcd into a platform-wide bottleneck. The etcd documentation recommends dedicated SSDs with sustained low-latency fsync.',
        {
          type: 'callout',
          text: 'The single most common etcd performance problem in production is slow disk fsync. A spinning disk or a shared SSD with noisy neighbors can turn etcd into a platform-wide bottleneck. Dedicated NVMe with sustained sub-millisecond P99 fsync is the minimum for serious deployments.',
        },
        'The second cost is compaction discipline. Without regular compaction, the MVCC backend grows monotonically. With aggressive compaction, slow watchers lose their revision anchor and must relist. The operator chooses a retention window that balances storage growth against watch reliability.',
        {
          type: 'diagram',
          alt: 'Compaction tradeoff between storage growth and watch reliability',
          label: 'The compaction tension',
          body: `  Aggressive compaction           Lazy compaction
  (short retention)               (long retention)
         |                               |
         v                               v
  Small database on disk          Large database on disk
  Fast snapshots                  Slow snapshots
  Watchers lose anchors           Watchers stay connected
  More relists needed             Fewer relists needed
         |                               |
         +--- The operator picks a ------+
              retention window that
              balances both`,
          text: `  Aggressive compaction           Lazy compaction
  (short retention)               (long retention)
         |                               |
         v                               v
  Small database on disk          Large database on disk
  Fast snapshots                  Slow snapshots
  Watchers lose anchors           Watchers stay connected
  More relists needed             Fewer relists needed
         |                               |
         +--- The operator picks a ------+
              retention window that
              balances both`,
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Kubernetes Deployment update enters etcd when the API server writes a new desired spec. The write path unfolds step by step:',
        {
          type: 'table',
          headers: ['Step', 'State before', 'Action', 'State after'],
          rows: [
            ['1. API server PUT', 'Deployment v1 at revision 1042', 'gRPC Put to etcd leader', 'Raft log entry proposed at index 8837'],
            ['2. WAL persist', 'Entry in memory only', 'Leader fsyncs WAL segment', 'Entry durable on leader disk'],
            ['3. Replicate', 'Entry on leader only', 'AppendEntries to 2 followers', 'Entry on 3 of 5 members (quorum)'],
            ['4. Commit', 'Commit index at 8836', 'Leader advances commit to 8837', 'Entry safe to apply'],
            ['5. Apply', 'Backend at revision 1042', 'Apply entry to MVCC store', 'Deployment v2 at revision 1043'],
            ['6. Watch delivery', 'Watchers waiting after rev 1042', 'Stream PUT event for rev 1043', 'Deployment controller receives update'],
          ],
        },
        'The Deployment controller does not poll for "whatever looks newest." It holds a watch from revision 1042. When revision 1043 arrives, it computes the needed ReplicaSet changes, writes more desired state back to etcd, and other controllers continue the chain.',
        {
          type: 'code',
          language: 'javascript',
          body: `// Kubernetes informer pattern: list-then-watch.
// This is how every controller stays synchronized with etcd.
async function startInformer(resource) {
  // Step 1: List all objects at the current revision.
  const { items, revision } = await etcd.list(resource);
  cache.replace(items);

  // Step 2: Watch for changes starting after that revision.
  const watcher = etcd.watch(resource, { startRevision: revision + 1 });
  watcher.on('put', (event) => cache.update(event.key, event.value));
  watcher.on('delete', (event) => cache.remove(event.key));

  // Step 3: If the watch breaks (compaction), relist and restart.
  watcher.on('error', (err) => {
    if (err.code === 'COMPACTED') startInformer(resource); // full relist
  });
}`,
        },
        'If the controller crashes and restarts, it relists all Deployments at the current revision, starts a fresh watch after that revision, and resumes reconciliation. If the relist revision has been compacted, the client library detects the error and relists from the latest available revision. That recovery path is part of correctness, not an edge case.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Pod-networking.png',
          alt: 'Kubernetes pod networking diagram showing how pods communicate through services',
          caption: 'Kubernetes pod networking. Every network endpoint, service route, and pod scheduling decision is ultimately backed by etcd state. When a pod is created, its spec enters etcd through the API server, and the kubelet on the target node watches for assignments.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'etcd wins for small, critical, coordination-heavy data where clients need more than storage -- they need ordering, watches, conditional writes, and a failure model that prefers rejecting writes over accepting conflicts.',
        {
          type: 'bullets',
          items: [
            'Kubernetes control plane: all cluster objects (pods, services, deployments, config maps, secrets, CRDs) are etcd key-value pairs. Every controller, scheduler, and API server reads and watches etcd revisions.',
            'Service discovery: endpoints register with a lease-backed key. When the service crashes and the lease expires, the key vanishes and watchers see the removal.',
            'Distributed locks and leader election: a compare-and-swap transaction claims a key; the holder refreshes a lease; competitors watch for deletion.',
            'Configuration management: feature flags, rate limits, and routing rules stored as versioned keys. Watchers propagate changes without polling.',
            'Certificate and secret rotation: a new certificate is written at a new revision; watchers on the key trigger reloads in downstream services.',
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Logo_of_etcd.svg',
          alt: 'etcd logo',
          caption: 'etcd is a CNCF graduated project, battle-tested in production Kubernetes clusters worldwide. The name comes from the Unix /etc directory (where configuration lives) plus "d" for distributed.',
        },
        {
          type: 'note',
          text: 'etcd is deliberately not designed for high-throughput data pipelines. A healthy etcd cluster handles around 10,000-30,000 writes per second. Kubernetes clusters with heavy CRD churn or frequent ConfigMap updates can approach this limit -- monitoring etcd write QPS and fsync latency is essential.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'etcd fails when used as a general data platform. It is not a message queue, analytics store, blob store, cache, or high-cardinality event log. The default database size limit is 2 GB (configurable to 8 GB). Pushing large values or noisy events through etcd harms every system that depends on it for coordination.',
        {
          type: 'table',
          headers: ['Anti-pattern', 'Why it breaks', 'Better alternative'],
          rows: [
            ['Storing large blobs (>1 MB values)', 'Raft replicates the full value to every member on every write', 'Object storage with a pointer in etcd'],
            ['High-frequency event logging', 'Each event is a Raft proposal; overwhelms consensus', 'Kafka, NATS, or a dedicated event store'],
            ['Using etcd as a cache', 'Consensus latency is too high for cache-speed reads', 'Redis, Memcached, or local caches'],
            ['Ignoring compaction', 'MVCC backend grows until disk is full', 'Periodic auto-compaction with defrag'],
            ['Thousands of watchers on one key', 'Leader CPU and memory spike per event fan-out', 'A fan-out proxy or fewer watch granularities'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Byzantine_Generals.png',
          alt: 'Byzantine Generals problem illustration showing coordinated attack versus failed coordination with deceptive commanders',
          caption: 'The Byzantine Generals problem: generals must agree on a plan despite potentially traitorous messengers. etcd solves a simpler variant -- crash faults, not Byzantine faults. Nodes may crash or become unreachable, but they do not lie. This is why etcd uses Raft (crash fault tolerant) rather than BFT protocols -- the threat model for data-center coordination is network partitions and process crashes, not malicious nodes.',
        },
        'The most dangerous misconception is that "strongly consistent" means "operationally forgiving." etcd is strict, but it rewards -- and requires -- small data, fast disks, healthy quorum, regular snapshots, and practiced recovery drills. A backup that has never been restored is a guess, not a plan.',
        {
          type: 'callout',
          text: 'A restore that uses the wrong cluster identity or member IDs can create a worse outage than the one it was meant to fix. etcd snapshot restore deliberately requires the operator to specify new cluster metadata, forcing awareness that identity is part of the data.',
        },
        {
          type: 'code',
          language: 'bash',
          body: `# etcd disaster recovery: the procedure is part of the safety contract.
# Step 1: Take a snapshot from a healthy member.
etcdctl snapshot save /backup/etcd-snapshot.db

# Step 2: Restore into a new data directory with fresh cluster identity.
# Note: --name, --initial-cluster, and --initial-advertise-peer-urls
# MUST be specified. Reusing old identity risks joining a broken cluster.
etcdctl snapshot restore /backup/etcd-snapshot.db \\
  --name node1 \\
  --data-dir /var/lib/etcd-restored \\
  --initial-cluster node1=https://10.0.0.1:2380 \\
  --initial-advertise-peer-urls https://10.0.0.1:2380

# Step 3: Start etcd with the restored data directory.
# Step 4: Verify quorum and revision before routing traffic.
etcdctl endpoint health --cluster
etcdctl endpoint status --cluster`,
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the etcd persistent storage documentation at https://etcd.io/docs/v3.6/learning/persistent-storage-files/, the disaster recovery guide at https://etcd.io/docs/v3.5/op-guide/recovery/, the etcd Raft library at https://github.com/etcd-io/raft, and the original Raft paper by Ongaro and Ousterhout (2014).',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Raft consensus -- leader election, log replication, and safety proofs. The Raft paper (https://raft.github.io/raft.pdf) is unusually readable for a distributed systems paper.',
            'Prerequisite: write-ahead logging -- why WAL exists and how replay works. Every database and consensus system uses this pattern.',
            'Extension: MVCC internals -- how revisioned storage enables snapshot reads and watches. PostgreSQL and CockroachDB use the same principle at different scales.',
            'Extension: Kubernetes reconciliation -- how informers use list-then-watch to drive controllers. The informer pattern is the primary consumer of etcd watch semantics.',
            'Contrast: ZooKeeper -- an older coordination service with ZAB consensus, ephemeral znodes, and a different watch model. etcd was designed as a simpler, more operable replacement.',
            'Contrast: CockroachDB / TiKV -- systems that use Raft per range for horizontal scaling, unlike etcd which uses a single Raft group for the entire keyspace.',
          ],
        },
        'The engineering question for etcd is not "is consensus good?" The useful question is whether the coordination data fits in a single Raft group, whether the disk and network can sustain the write rate, and whether the operations team practices restore drills.',
        {
          type: 'quote',
          attribution: 'Diego Ongaro, Raft author',
          text: 'The primary goal of Raft is understandability.',
        },
      ],
    },
  ],
};
