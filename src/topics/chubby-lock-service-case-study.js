// Chubby case study: a coarse-grained lock service and reliable metadata store
// built on replicated consensus, sessions, leases, watches, and small files.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'chubby-lock-service-case-study',
  title: 'Chubby Lock Service Case Study',
  category: 'Papers',
  summary: 'Google Chubby as a control-plane lesson: coarse locks, sessions, watches, reliable metadata, and consensus-backed master election.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lock cell architecture', 'sessions and watches'], defaultValue: 'lock cell architecture' },
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
      { id: 'clientA', label: 'client A', x: 0.8, y: 2.6, note: 'lock user' },
      { id: 'clientB', label: 'client B', x: 0.8, y: 5.4, note: 'watcher' },
      { id: 'lib', label: 'Chubby lib', x: 2.6, y: 4.0, note: 'caches handles' },
      { id: 'master', label: 'cell master', x: 4.8, y: 4.0, note: 'serves writes' },
      { id: 'rep1', label: 'replica 1', x: 7.0, y: 2.0, note: 'consensus' },
      { id: 'rep2', label: 'replica 2', x: 7.0, y: 4.0, note: 'consensus' },
      { id: 'rep3', label: 'replica 3', x: 7.0, y: 6.0, note: 'consensus' },
      { id: 'file', label: '/service/leader', x: 9.0, y: 4.0, note: 'small file + lock' },
    ],
    edges: [
      { id: 'e-a-lib', from: 'clientA', to: 'lib', weight: 'open/lock' },
      { id: 'e-b-lib', from: 'clientB', to: 'lib', weight: 'watch' },
      { id: 'e-lib-master', from: 'lib', to: 'master', weight: 'RPC' },
      { id: 'e-master-rep1', from: 'master', to: 'rep1', weight: 'replicate' },
      { id: 'e-master-rep2', from: 'master', to: 'rep2', weight: 'replicate' },
      { id: 'e-master-rep3', from: 'master', to: 'rep3', weight: 'replicate' },
      { id: 'e-master-file', from: 'master', to: 'file', weight: 'metadata' },
    ],
  }, { title });
}

function* lockCellArchitecture() {
  yield {
    state: topology('A Chubby cell is a small replicated service'),
    highlight: { active: ['master', 'rep1', 'rep2', 'rep3'], compare: ['clientA', 'clientB'] },
    explanation: 'The graph shows Chubby as a small trusted control plane, not as a data store for everything. One replica acts as master, consensus keeps replicas aligned, and clients normally reach it through a library that hides reconnects and caching details.',
  };

  yield {
    state: labelMatrix(
      'What Chubby is actually used for',
      [
        { id: 'leader', label: 'leader election' },
        { id: 'config', label: 'configuration' },
        { id: 'name', label: 'name service' },
        { id: 'barrier', label: 'coarse barrier' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'why', label: 'why Chubby fits' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['lock file', 'one owner', 'Distributed Locks: What They Can Promise'],
        ['small file', 'reliable metadata', 'Google File System Case Study'],
        ['directory tree', 'discover master', 'Load Balancer'],
        ['lock directory', 'rare coordination', 'Paxos: Consensus Without a Leader'],
      ],
    ),
    highlight: { active: ['leader:object', 'leader:link'], found: ['config:why', 'name:why'] },
    explanation: 'The table is a fit check. Chubby works best for rare, high-value facts: leader identity, current config, service location, and coarse barriers. It is deliberately the wrong tool for locks on every user request.',
  };

  yield {
    state: topology('The master can fail, but the cell survives'),
    highlight: { removed: ['master'], active: ['rep1', 'rep2', 'rep3'], found: ['file'] },
    explanation: 'Removing the master in the animation shows the promise and the cost. Replicas elect a replacement and preserve metadata, but clients can pause while sessions and leases settle. Coordination survives; it does not become free.',
    invariant: 'Locks are useful only when their lease and failure semantics are explicit.',
  };
}

function* sessionsAndWatches() {
  yield {
    state: labelMatrix(
      'Session lease states',
      [
        { id: 'healthy', label: 'healthy client' },
        { id: 'pause', label: 'GC pause' },
        { id: 'partition', label: 'network partition' },
        { id: 'expired', label: 'expired session' },
      ],
      [
        { id: 'lease', label: 'session lease' },
        { id: 'lock', label: 'lock state' },
        { id: 'client', label: 'client duty' },
      ],
      [
        ['renewed', 'held', 'continue'],
        ['at risk', 'maybe stale', 'stop before expiry'],
        ['cannot renew', 'will expire', 'fence writes'],
        ['gone', 'released', 're-discover'],
      ],
    ),
    highlight: { active: ['pause:lease', 'partition:client'], removed: ['expired:lock'] },
    explanation: 'The session rows are the real lock semantics. Holding a lock means renewing a lease. If a client pauses or gets partitioned, it must stop acting before the lease boundary or use fencing/version checks so an old owner cannot corrupt an external resource.',
  };

  yield {
    state: topology('Watches notify clients that metadata changed'),
    highlight: { active: ['clientB', 'file', 'e-b-lib', 'e-master-file'], found: ['lib'] },
    explanation: 'The watch edge is an invalidation path. It tells clients that cached metadata may be stale, then clients re-read the file or directory. Treating the watch itself as the durable event is the common mistake.',
    invariant: 'A watch is a hint to refresh, not a durable event stream.',
  };

  yield {
    state: labelMatrix(
      'Chubby versus fast data paths',
      [
        { id: 'good1', label: 'leader election' },
        { id: 'good2', label: 'service discovery' },
        { id: 'bad1', label: 'every request lock' },
        { id: 'bad2', label: 'large file storage' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['yes', 'coarse control-plane fact'],
        ['yes', 'small metadata and watches'],
        ['no', 'too hot and fragile'],
        ['no', 'use GFS or Bigtable'],
      ],
    ),
    highlight: { found: ['good1:fit', 'good2:fit'], removed: ['bad1:fit', 'bad2:fit'] },
    explanation: 'The final table is the restraint rule. Chubby should coordinate systems that do the heavy work elsewhere. If the lock service becomes part of every data operation, the control plane has leaked into the hot path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lock cell architecture') yield* lockCellArchitecture();
  else if (view === 'sessions and watches') yield* sessionsAndWatches();
  else throw new InputError('Pick a Chubby view.');
}

export const article = {
  sections: [
    {
      heading: 'Why it matters',
      paragraphs: [
        'Large distributed systems need a small number of facts to be more reliable than the machines using them: who is leader, which server owns a shard, where a service endpoint lives, what configuration is current, and whether a participant is still considered alive.',
        'Chubby matters because it turns those facts into a deliberately small control-plane service. It gives clients coarse locks, small files, directories, watches, sessions, and a replicated master. The paper is a lesson in restraint: make coordination reliable, then keep the heavy data path out of the lock service.',
      ],
    },
    {
      heading: 'The naive baseline and its wall',
      paragraphs: [
        'The naive baseline is to let every service invent its own leader election, config file distribution, heartbeat table, and lock protocol. That looks local and simple, but every team then has to solve split brain, stale owners, retries, crashes, and reconfiguration under partitions.',
        'The other naive baseline is to use a database row or shared file as a lock. That can work only if the storage system already gives the right lease, failure, and fencing semantics. Without those semantics, a paused process can wake up believing it still owns a resource after another process has taken over.',
        'The wall is that coordination bugs are rare, expensive, and cross-system. Chubby centralizes the hard part for coarse-grained decisions while still warning engineers not to use it for every data operation.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The invariant is that a lock is meaningful only together with its session and lease semantics. A client owns a Chubby lock while its session is valid, not forever. If the client cannot renew, it must stop acting or prove freshness with a fencing token, sequence number, or conditional write on the external resource.',
        'The second invariant is that watches are invalidation hints, not durable event streams. When a watched file changes, the client re-reads authoritative state from Chubby. It does not treat the notification itself as the state change record.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the lock-cell architecture view, start at the cell master and replica group. The file `/service/leader` is small, but the important property is that its lock and contents are backed by replicated consensus. The client library is part of the design because it hides reconnects, caching, handle reuse, session renewal, and master failover from application code.',
        'The usage table is a fit test. Leader election, service discovery, small configuration, and coarse barriers are rare, high-value facts. They belong in a coordination service. Per-request locking and large file storage do not.',
        'In the sessions-and-watches view, follow the lease state before the lock state. A healthy client renews and continues. A paused or partitioned client is at risk and should stop before expiry or fence its writes. When the watch fires, the correct next move is re-read, not replay a notification as if it were a durable queue message.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A Chubby deployment is organized into cells. A cell is a small replicated service with one master at a time. The master serves client operations, while consensus keeps replicas in agreement so a new master can take over after failure. The paper describes this design for reliable coarse-grained locking and small-file metadata: https://research.google.com/archive/chubby-osdi06.pdf.',
        'The namespace looks like a file system because that is a convenient API for humans and programs: directories, files, handles, permissions, contents, locks, and metadata. A service can publish its current leader or configuration by writing a small file and letting clients watch that path.',
        'Clients normally talk through a Chubby library. The library caches file data and handles, renews sessions, observes invalidations, retries through master changes, and exposes a simpler API. That library layer is what keeps application code from treating every transient network event as a fresh distributed-systems problem.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Correctness depends on making old owners harmless. If client A holds a lock, pauses beyond its lease, and client B then acquires the lock, client A may still resume and try to write to a database, file system, or shard. Chubby can release the lock, but it cannot undo a stale external write.',
        'The usual fix is fencing. Each successful lock acquisition or protected update carries a monotonically increasing token, version, or generation number. The external resource accepts only the newest valid token. That converts stale ownership into a rejected write instead of corruption.',
        'Watches have a similar correctness rule. Because notifications can be coalesced or lost across reconnects, a watch should trigger cache invalidation and a fresh read. The file contents and metadata are the durable truth.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost of Chubby is latency, operational complexity, and dependency concentration. Consensus-backed writes are slower than local memory, master failover can pause clients, and a bad usage pattern can put many systems behind one small control plane.',
        'The tradeoff is worth it when the coordinated fact is rare and valuable. It is not worth it when the fact changes on every user request, carries large payloads, or belongs in a storage system designed for throughput. Chubby improves availability of coordination; it does not make coordination cheap enough to put in the hot path.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a storage shard with one active master. Candidates race to acquire `/shards/17/master`. The winner writes its address and generation number into the file, holds the lock through a renewed session, and begins serving traffic. Other processes watch the file so they can discover the current owner.',
        'If the owner crashes, its session expires and the lock is released. A new process acquires the lock, writes a higher generation, and starts serving. Clients that receive the watch invalidation re-read the file and switch to the new owner. Any write to the shard includes the generation number, so a delayed request from the old owner is rejected by the shard storage layer.',
        'The example shows the division of labor. Chubby decides current ownership and publishes metadata. The data store enforces fencing on actual writes. Clients use watches to refresh their cached view.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Chubby-style systems win for leader election, service discovery, master location, small configuration, coarse barriers, membership, and bootstrapping larger systems. ZooKeeper, etcd, Consul, and Kubernetes control-plane storage follow the same broad family of ideas even though their APIs and internals differ.',
        'They fail when used as high-throughput data stores, work queues, per-request mutexes, large-file stores, or substitutes for application-level idempotency. The social failure mode is common: because the service is reliable, teams keep adding new dependencies until the control plane becomes the bottleneck.',
        'A practical design review question is: what happens if the lock holder pauses, the lease expires, a new holder starts, and the old holder resumes? If the answer lacks fencing, conditional writes, or idempotent recovery, the design is incomplete.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: "The Chubby lock service for loosely-coupled distributed systems" at https://research.google.com/archive/chubby-osdi06.pdf.',
        'Study Distributed Locks: What They Can Promise for lock semantics, Paxos: Consensus Without a Leader for replicated agreement, Leader Replacement for failover behavior, Google File System Case Study and Bigtable Case Study for systems that need reliable metadata, Load Balancer for service discovery pressure, and Clocks & Ordering: Lamport to TrueTime for the time assumptions behind leases and freshness.',
      ],
    },
  ],
};
