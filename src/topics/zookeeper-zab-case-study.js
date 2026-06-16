// ZooKeeper and Zab: replicated coordination with znodes, watches, sessions,
// and primary-backup atomic broadcast.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'zookeeper-zab-case-study',
  title: 'ZooKeeper & Zab Case Study',
  category: 'Papers',
  summary: 'ZooKeeper as a coordination kernel: znodes, sessions, watches, Zab ordering, quorum replication, and client-built primitives.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['znodes and watches', 'zab broadcast'], defaultValue: 'znodes and watches' },
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

function ensemble(title) {
  return graphState({
    nodes: [
      { id: 'clientA', label: 'client A', x: 0.8, y: 2.2, note: 'creates znode' },
      { id: 'clientB', label: 'client B', x: 0.8, y: 5.8, note: 'sets watch' },
      { id: 'leader', label: 'leader', x: 3.0, y: 4.0, note: 'orders writes' },
      { id: 'f1', label: 'follower 1', x: 5.2, y: 2.0, note: 'replica' },
      { id: 'f2', label: 'follower 2', x: 5.2, y: 4.0, note: 'replica' },
      { id: 'f3', label: 'follower 3', x: 5.2, y: 6.0, note: 'replica' },
      { id: 'tree', label: '/app/leader', x: 8.0, y: 4.0, note: 'znode tree' },
      { id: 'watch', label: 'watch event', x: 8.0, y: 6.2, note: 'one-shot' },
    ],
    edges: [
      { id: 'e-a-leader', from: 'clientA', to: 'leader', weight: 'write' },
      { id: 'e-b-leader', from: 'clientB', to: 'leader', weight: 'read/watch' },
      { id: 'e-leader-f1', from: 'leader', to: 'f1', weight: 'proposal' },
      { id: 'e-leader-f2', from: 'leader', to: 'f2', weight: 'proposal' },
      { id: 'e-leader-f3', from: 'leader', to: 'f3', weight: 'proposal' },
      { id: 'e-leader-tree', from: 'leader', to: 'tree', weight: 'state change' },
      { id: 'e-tree-watch', from: 'tree', to: 'watch', weight: 'notify' },
      { id: 'e-watch-b', from: 'watch', to: 'clientB', weight: 'refresh' },
    ],
  }, { title });
}

function* znodesAndWatches() {
  yield {
    state: ensemble('ZooKeeper exposes a replicated znode namespace'),
    highlight: { active: ['clientA', 'leader', 'tree', 'e-a-leader', 'e-leader-tree'], compare: ['f1', 'f2', 'f3'] },
    explanation: 'ZooKeeper gives clients a hierarchical namespace of znodes. A znode can store small data, version metadata, and child znodes. Clients use this small API to build leader election, configuration, membership, and locks.',
  };

  yield {
    state: labelMatrix(
      'Znode modes',
      [
        { id: 'persistent', label: 'persistent' },
        { id: 'ephemeral', label: 'ephemeral' },
        { id: 'sequential', label: 'sequential' },
        { id: 'container', label: 'container/TTL variants' },
      ],
      [
        { id: 'lifetime', label: 'lifetime' },
        { id: 'use', label: 'typical use' },
      ],
      [
        ['until deleted', 'configuration'],
        ['session-bound', 'membership and locks'],
        ['monotonic suffix', 'queues and election order'],
        ['managed cleanup', 'namespace hygiene'],
      ],
    ),
    highlight: { found: ['ephemeral:use', 'sequential:use'], compare: ['persistent:use'] },
    explanation: 'Ephemeral and sequential znodes are the building blocks for coordination recipes. An ephemeral znode disappears when the session ends; a sequential znode gets an ordered suffix assigned by ZooKeeper.',
  };

  yield {
    state: ensemble('Watches are one-shot invalidation signals'),
    highlight: { active: ['clientB', 'watch', 'tree', 'e-tree-watch', 'e-watch-b'], found: ['leader'] },
    explanation: 'A client can set a watch when reading data or children. When the znode changes, ZooKeeper sends a notification and clears the watch. The client must re-read state and set another watch if it still cares.',
    invariant: 'A watch is a cache invalidation hint, not a durable event log.',
  };

  yield {
    state: labelMatrix(
      'Coordination recipes',
      [
        { id: 'election', label: 'leader election' },
        { id: 'lock', label: 'lock recipe' },
        { id: 'barrier', label: 'barrier' },
        { id: 'config', label: 'config publish' },
      ],
      [
        { id: 'znode', label: 'znode pattern' },
        { id: 'neighbor', label: 'study neighbor' },
      ],
      [
        ['ephemeral sequential children', 'Leader Replacement'],
        ['lowest sequence holds lock', 'Distributed Locks'],
        ['children count reaches N', 'Quorums'],
        ['persistent data + watches', 'Chubby Case Study'],
      ],
    ),
    highlight: { active: ['election:znode', 'lock:znode'], compare: ['config:neighbor'] },
    explanation: 'ZooKeeper intentionally stays small. The service provides ordered, replicated primitives; clients compose them into higher-level coordination recipes.',
  };
}

function* zabBroadcast() {
  yield {
    state: ensemble('Writes are ordered by the leader and replicated to a quorum'),
    highlight: { active: ['leader', 'f1', 'f2', 'e-leader-f1', 'e-leader-f2'], compare: ['f3'] },
    explanation: 'ZooKeeper uses Zab, a primary-backup atomic broadcast protocol. The leader proposes state changes, followers acknowledge, and a quorum makes the update durable before clients observe completion.',
  };

  yield {
    state: labelMatrix(
      'Zab phases',
      [
        { id: 'discovery', label: 'discovery' },
        { id: 'sync', label: 'synchronization' },
        { id: 'broadcast', label: 'broadcast' },
        { id: 'recovery', label: 'leader recovery' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'risk', label: 'risk controlled' },
      ],
      [
        ['choose viable leader', 'old primary ambiguity'],
        ['align follower logs', 'missing committed updates'],
        ['pipeline proposals', 'out-of-order delivery'],
        ['new epoch', 'split brain'],
      ],
    ),
    highlight: { found: ['sync:goal', 'broadcast:risk'], compare: ['recovery:risk'] },
    explanation: 'The protocol is optimized for the ZooKeeper shape: one leader orders a stream of state changes for backup replicas and must recover safely after leader changes.',
    invariant: 'All delivered writes appear in the same order at every correct replica.',
  };

  yield {
    state: ensemble('Reads are fast; writes pay ordering cost'),
    highlight: { active: ['clientB', 'f2'], compare: ['clientA', 'leader', 'f1'] },
    explanation: 'ZooKeeper is designed for read-heavy coordination. Reads can be served quickly, while writes go through total ordering. Clients can call sync when they need to force a read to observe a recent write order.',
  };

  yield {
    state: labelMatrix(
      'ZooKeeper versus adjacent systems',
      [
        { id: 'chubby', label: 'Chubby' },
        { id: 'raft', label: 'Raft' },
        { id: 'paxos', label: 'Paxos' },
        { id: 'etcd', label: 'etcd-style control plane' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['coordination kernel', 'Google lock-service framing'],
        ['leader replication', 'Zab protocol details differ'],
        ['quorum safety', 'primary-backup broadcast form'],
        ['watchable key space', 'API and lease model differ'],
      ],
    ),
    highlight: { active: ['chubby:shared', 'raft:shared'], compare: ['paxos:difference'] },
    explanation: 'The case-study value is comparative. ZooKeeper is where lock services, watchable metadata, sessions, and atomic broadcast meet in one operationally important system.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'znodes and watches') yield* znodesAndWatches();
  else if (view === 'zab broadcast') yield* zabBroadcast();
  else throw new InputError('Pick a ZooKeeper/Zab view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'ZooKeeper is a replicated coordination service for distributed systems. It exposes a small hierarchical namespace of znodes, sessions, watches, and versioned updates. Instead of shipping every coordination primitive as a server feature, ZooKeeper gives clients a kernel from which they can build leader election, locks, configuration, membership, and barriers.',
        'The companion protocol is Zab, the atomic broadcast protocol used to replicate ZooKeeper state changes. The leader orders writes, followers replicate them, and quorum rules keep the ensemble safe across crashes and leader changes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client connects to a ZooKeeper ensemble and receives a session. It can create persistent znodes, ephemeral znodes tied to the session, and sequential znodes with ordered suffixes. Reads can set watches. When watched data changes, the client receives a one-shot notification and must re-read state to refresh its local cache.',
        'Writes are routed through the leader and broadcast through Zab. The system separates read-heavy coordination from ordered state changes: reads are fast, while writes pay the cost of replication and ordering. Version numbers on znodes allow conditional updates and help clients detect races.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ZooKeeper is powerful because it is small, but that also means users must understand its contracts. Watches are one-shot hints, not queues. Sessions can expire. Ephemeral nodes disappear on session loss. Sequential nodes create ordering, but clients must still avoid herd effects by watching the right predecessor.',
        'The service should stay off hot data paths. It is a coordination plane, not a general database. Write-heavy workloads, large znode payloads, and per-request locking can overload the ensemble or create fragile designs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ZooKeeper has been used by Hadoop, HBase, Kafka, Solr, Storm, and many internal platforms for leader election, broker membership, configuration distribution, service discovery, and distributed locks. It is one of the clearest production examples of a small replicated control plane.',
        'A complete case study is leader election with ephemeral sequential znodes. Each candidate creates a child under an election path. The smallest sequence number is leader. Every other candidate watches only its predecessor, so one leader failure wakes one successor instead of stampeding the whole cluster.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'ZooKeeper does not make arbitrary external side effects exactly once. If a client loses its session but continues writing elsewhere, the ensemble cannot protect that external resource without fencing tokens or version checks. Another trap is treating watches as durable events. They are invalidations; the durable state is the znode tree.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: ZooKeeper paper at https://www.usenix.org/legacy/event/atc10/tech/full_papers/Hunt.pdf, Apache Programmer Guide at https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html, and Zab paper at https://classpages.cselabs.umn.edu/Fall-2017/csci8211/Papers/Distributed%20Systems%20Zab-%20High-performance%20broadcast%20for%20primary-backup%20systems.pdf. Study Chubby Lock Service Case Study, Distributed Locks, Leader Replacement, Paxos, Raft Log Replication, and Quorums next.',
      ],
    },
  ],
};
