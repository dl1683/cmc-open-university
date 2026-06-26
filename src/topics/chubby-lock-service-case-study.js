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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the lock-cell view as a control-plane service. A control plane stores facts that guide other systems, such as the current leader, shard owner, service address, or configuration version. The active node is the Chubby master or the client session currently proving that a lock is still valid.',
        'Read the sessions-and-watches view before reading the lock name. A session is the client relationship that must stay alive for a lock to mean anything, and a watch is an invalidation hint that tells a client to re-read state. The safe inference is that ownership is current only while the session and fencing rules say it is current.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large distributed systems need a few facts to be more reliable than the machines using them. Examples include who is leader, which server owns a shard, where a service endpoint lives, what configuration is current, and whether a participant is still alive. If every service invents those rules independently, rare failures become repeated bugs.',
        'Chubby exists as a small replicated lock and metadata service for those facts. It provides coarse locks, small files, directories, watches, sessions, and a replicated master. Its main lesson is restraint: make coordination reliable, then keep hot data-path work out of the lock service.',
        {type:'callout', text:'Chubby works by making rare control-plane facts reliable while keeping hot data-path work out of the lock service.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is for each service to build its own leader election, heartbeat table, config distribution, and lock protocol. That feels local because the service team knows its own state. It fails because each team then has to solve split brain, stale owners, retries, partitions, and crash recovery.',
        'Another obvious approach is to use a database row or shared file as a lock. That works only if the storage system already gives lease semantics, monotonic versions, and fencing. Without those properties, a paused process can wake up and keep writing after another process has taken ownership.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is stale authority. In a distributed system, a process can pause, lose network access, miss renewals, and later resume with old memory. If it still believes it owns a lock, it may write to an external resource after a new owner has been chosen.',
        'The second wall is load shape. Coordination facts are rare and important, but data-path operations are frequent. A lock service can protect leader choice and config version; it cannot become the per-request mutex for every read and write without becoming the bottleneck it was meant to avoid.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that a lock is meaningful only with a session, a lease, and a way to make stale owners harmless. A lease is time-bounded ownership that must be renewed. A fencing token is a monotonic value that external systems can use to reject old owners.',
        'Watches follow the same discipline. A watch notification is not the durable event stream; it is a signal that cached state may be stale. The client must re-read the Chubby file or metadata and use that authoritative value.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Chubby deployment is organized into cells. Each cell has a small replicated service with one master at a time, and consensus keeps replicas in agreement so a new master can take over after failure. Clients usually talk through a library that handles caching, reconnects, master failover, session renewal, and watch invalidation.',
        'The namespace looks like a file system because directories and files are a convenient interface for small metadata. A service can publish \'/service/leader\' with the current leader address and generation number. Other services watch that path, invalidate their cache when it changes, and re-read the file before trusting the new state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on making old owners harmless. If client A holds a lock, pauses past its lease, and client B acquires the lock, client A may still resume. Chubby can release the lock, but the protected storage system must reject A with a stale fencing token.',
        'The invariant is monotonic ownership evidence. Each successful acquisition or protected update carries a version, generation, or token that only moves forward. External resources accept only current tokens, so stale clients become rejected writers instead of corrupt writers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Chubby pays consensus latency, operational complexity, and dependency concentration. A consensus-backed write is slower than local memory, and master failover can pause clients. If too many systems depend on one small cell, the control plane becomes a shared failure surface.',
        'The cost is acceptable when the coordinated fact changes rarely and protects large downstream work. For example, a shard leader might change once per day while serving millions of data requests. Paying tens of milliseconds for the leader decision is cheap; paying that cost on every data operation would be reckless.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Chubby-style systems fit leader election, service discovery, master location, small configuration, membership, coarse barriers, and bootstrapping larger storage systems. ZooKeeper, etcd, Consul, and Kubernetes control-plane storage belong to the same family even though their APIs differ. The common pattern is reliable small metadata, not high-throughput data storage.',
        'They are useful when many clients need to agree on one current fact. A storage system can use the service to publish shard ownership, while the storage layer enforces fencing on actual writes. That split keeps coordination centralized and data movement local.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when used as a high-throughput database, work queue, per-request mutex, large-file store, or substitute for idempotent application logic. The service is reliable enough that teams are tempted to add more dependencies. That social pattern can turn a small control plane into a large bottleneck.',
        'It also fails when designs forget the stale-owner case. A lock alone does not stop a delayed process from writing to a separate system. If the protected system does not check fencing tokens, the design is incomplete even if the lock service is correct.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider shard 17 with one active master. Candidate A acquires \'/shards/17/master\', receives generation 41, writes its address, and renews its session. Clients watch the file and send writes to A with generation 41 attached.',
        'A then pauses for 90 seconds and misses renewals, so the session expires. Candidate B acquires the lock, receives generation 42, and writes its address. If A resumes and sends an old write with generation 41, the shard storage layer rejects it because 41 is less than 42. Chubby chose ownership, and fencing made stale ownership harmless.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: \'The Chubby lock service for loosely-coupled distributed systems\' at https://research.google.com/archive/chubby-osdi06.pdf. Read it for the design boundaries as much as for the API. The paper is careful about what belongs in the lock service and what must stay outside it.',
        'Study distributed locks, leases, fencing tokens, Paxos, Raft, ZooKeeper, etcd, and Kubernetes control-plane storage next. Then study Google File System and Bigtable to see why reliable metadata matters for larger storage systems.',
      ],
    },
  ],
};