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
    explanation: 'Chubby is a coarse-grained lock service and small reliable metadata store. A cell has a handful of replicas; one is the master, elected and kept safe through consensus. Clients usually talk to the master through a client library.',
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
    explanation: 'The paper emphasizes coarse-grained coordination. Chubby is not meant for hot per-request locking. It is for control-plane facts: who is master, where is the service, what config is current, and which clients are alive.',
  };

  yield {
    state: topology('The master can fail, but the cell survives'),
    highlight: { removed: ['master'], active: ['rep1', 'rep2', 'rep3'], found: ['file'] },
    explanation: 'If the master fails, the replicas elect a new one. Clients may pause while leases expire and a new master takes over, but the metadata survives. This is the practical lock-service shape behind Bigtable Case Study, Google File System Case Study, and many control planes.',
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
    explanation: 'A Chubby lock is tied to a session lease. If the client cannot renew the session, the lock eventually disappears. Correct users must treat lease loss as a hard boundary and pair locks with fencing or version checks for external resources.',
  };

  yield {
    state: topology('Watches notify clients that metadata changed'),
    highlight: { active: ['clientB', 'file', 'e-b-lib', 'e-master-file'], found: ['lib'] },
    explanation: 'Clients can watch files and directories. When a leader file changes, watchers invalidate cached metadata and reconnect to the new owner. Watches are a control-plane acceleration, not the source of truth; clients still need to handle missed events and re-read state.',
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
    explanation: 'The key lesson is restraint. A reliable lock service is so useful that engineers will overuse it. The right design keeps Chubby off the hot path and uses it to coordinate systems that do the bulk work elsewhere.',
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
      heading: 'What it is',
      paragraphs: [
        'Chubby is Google\'s lock service for loosely coupled distributed systems. It provides coarse-grained advisory locks and reliable small-file storage through a replicated service. Its design emphasizes availability and correctness over high throughput.',
        'The case study matters because many distributed systems need a small, trusted control plane before they can safely run a large data plane. Bigtable Case Study uses Chubby-style coordination for master election and tablet-server liveness; other systems use it for leader election, service discovery, and configuration.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Chubby cell consists of several replicas. One replica is the master and serves client requests. Consensus keeps the replicas in agreement about metadata and locks. Clients interact through a library that caches handles, renews sessions, and handles master changes.',
        'Locks are connected to sessions. If a client stops renewing its session, its locks eventually expire. Chubby also provides watches so clients can learn when files or directories change, such as when a service leader changes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Chubby is deliberately not a high-throughput lock server. The hard parts are lease semantics, client pauses, master failover, stale caches, missed watches, and making users understand what a lock can and cannot protect. External side effects still need fencing tokens or version checks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Chubby-style services appear as ZooKeeper, etcd, Consul, and cloud control-plane metadata systems. They are used for leader election, configuration, membership, barriers, and service discovery. They are dangerous when used as per-request locks or as a substitute for a real database.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A distributed lock is not magic mutual exclusion over the outside world. If a client holds a lock, pauses for longer than its lease, and then writes to a database after losing the lock, the lock service cannot undo that write. That is why Distributed Locks: What They Can Promise and Leader Replacement are required follow-ups.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "The Chubby lock service for loosely-coupled distributed systems" at https://research.google.com/archive/chubby-osdi06.pdf. Study Distributed Locks: What They Can Promise, Paxos: Consensus Without a Leader, Leader Replacement, Google File System Case Study, Bigtable Case Study, and Clocks & Ordering: Lamport to TrueTime next.',
      ],
    },
  ],
};
