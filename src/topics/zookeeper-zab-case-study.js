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
    explanation: 'The first view shows ZooKeeper as a small replicated namespace, not a full application database. Znodes hold small data plus version metadata, and clients compose them into leader election, membership, configuration, and lock recipes.',
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
    explanation: 'This table names the two znode features that make recipes practical. Ephemeral nodes turn session liveness into namespace state. Sequential nodes give clients a shared order without each client inventing its own counter.',
  };

  yield {
    state: ensemble('Watches are one-shot invalidation signals'),
    highlight: { active: ['clientB', 'watch', 'tree', 'e-tree-watch', 'e-watch-b'], found: ['leader'] },
    explanation: 'The highlighted watch is a one-shot invalidation. After the event fires, the client must re-read the znode tree and install a fresh watch. The state is durable; the notification is only a prompt to refresh.',
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
    explanation: 'ZooKeeper intentionally stays small. The service provides ordered, replicated primitives, and the recipe logic lives in clients. That keeps the server general, but it means recipe correctness is still application work.',
  };
}

function* zabBroadcast() {
  yield {
    state: ensemble('Writes are ordered by the leader and replicated to a quorum'),
    highlight: { active: ['leader', 'f1', 'f2', 'e-leader-f1', 'e-leader-f2'], compare: ['f3'] },
    explanation: 'The Zab view follows a write through the leader. The leader orders the update, followers acknowledge it, and a quorum makes it durable before the client can rely on completion. Reads are cheap because writes paid for order.',
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
    explanation: 'The phase table is about leadership safety. Zab has to choose a viable leader, align follower logs, broadcast proposals in order, and start a new epoch without letting two histories both look current.',
    invariant: 'All delivered writes appear in the same order at every correct replica.',
  };

  yield {
    state: ensemble('Reads are fast; writes pay ordering cost'),
    highlight: { active: ['clientB', 'f2'], compare: ['clientA', 'leader', 'f1'] },
    explanation: 'The animation contrasts the fast read path with the ordered write path. ZooKeeper works best when coordination reads dominate and writes are small. Clients that need a fresh read can use sync to catch up with the write order.',
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
    explanation: 'The comparison table is the study map. ZooKeeper sits between Chubby-style coordination, quorum replication, and practical watchable metadata. Understanding it helps make sense of etcd, Kafka-era coordination, and leader-election designs.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the znode view as a tiny replicated filesystem used for coordination. Active nodes are clients or servers handling the current operation, compare nodes are replicas not yet decisive, and found nodes are znodes or watches whose state is now established. A safe inference is this: if a write has a quorum of acknowledgments and the leader commits it, later correct leaders must preserve it.',
        'A znode is a named node in the ZooKeeper tree. An ephemeral znode disappears when its client session expires, and a sequential znode gets a server-assigned increasing suffix. Zab is ZooKeeper Atomic Broadcast, the protocol that orders writes across the ensemble.',
        {type: 'callout', text: 'ZooKeeper works by keeping the server primitive and ordered while pushing coordination recipes and their edge cases into clients.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Apache_ZooKeeper_logo.svg', alt: 'Apache ZooKeeper logo with a zookeeper figure and project name', caption: 'Apache ZooKeeper logo. Attribution: The Apache Software Foundation, vectorised by Vulphere, via Wikimedia Commons; Apache License 2.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems need a small set of shared facts: who is leader, which workers are alive, which config version is current, and who is waiting for a lock. Those facts are small in bytes but large in blast radius. A wrong leader can corrupt far more data than the coordination service stores.',
        'ZooKeeper exists to provide a simple ordered namespace that clients can compose into recipes. The server does not expose a special leader-election API. It exposes znodes, versions, sessions, watches, and ordered writes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a database table. Store a leader row, update it with SQL, and have services poll it. This works until liveness, ordering, notification, and conditional update semantics start leaking into every client.',
        'Another approach is heartbeat gossip. Nodes ping each other and declare a leader dead after a timeout. That can create split brain when the network is slow or a process pauses. Without a shared ordering point, two nodes can both believe they own the same role.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coordination under failure. A process can pause without dying, a network can delay without disconnecting, and a leader can crash after some followers saw a write. The system needs a rule for which writes survive and which session-owned facts disappear.',
        'Notification is another wall. Clients cache coordination state to avoid reading ZooKeeper on every request. A watch is a one-shot invalidation signal that tells the client to reread; it is not a durable event stream.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the server small and the namespace ordered. Persistent znodes hold configuration, ephemeral znodes encode session liveness, sequential znodes create ordered contenders, versions support compare-and-set, and watches invalidate cached reads. Client recipes combine these primitives into leader election, locks, queues, and membership.',
        'Zab supplies the write order under that namespace. The leader proposes a write, followers log it, a quorum acknowledges it, and then the leader commits it. Because any two majorities overlap, a later leader can recover the committed prefix.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A ZooKeeper ensemble keeps the full data tree in memory and records changes in a transaction log. Each write gets a zxid, a 64-bit transaction id whose high bits identify the leader epoch and whose low bits count writes in that epoch. Comparing zxids tells clients and servers which update is newer.',
        'Clients maintain sessions with timeouts. If a client stops heartbeating long enough for the session to expire, ZooKeeper deletes ephemeral znodes owned by that session. That deletion is itself an ordered write, so other clients can observe the liveness change through the same namespace.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument uses total order and quorum intersection. All committed writes are delivered in the same order to correct replicas. A new leader must synchronize with a quorum, and that quorum intersects the quorum that committed any earlier write, so committed history cannot vanish.',
        'The session invariant gives liveness meaning. An ephemeral znode exists only while its owner session is alive according to ZooKeeper. A client recipe can therefore treat disappearance of that znode as evidence that the session expired, not as an arbitrary application cleanup.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ZooKeeper is read-optimized. A local read is an in-memory tree lookup and can be fast, while a write needs leader ordering and quorum disk logging. Adding servers can improve read capacity, but it can slow writes because a larger ensemble still needs a majority to acknowledge.',
        'Memory is the hard space limit because the data tree lives in RAM. If each znode averages 1 KB and the ensemble holds 500,000 znodes, the data alone is about 500 MB before metadata and watches. A coordination service should hold small facts, not large application payloads.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ZooKeeper fits leader election, service membership, configuration pointers, distributed locks with fencing, and metadata coordination for distributed databases and queues. Kafka, HBase, SolrCloud, Hadoop, and Storm historically used it for small facts that many workers needed to agree on. The common pattern is high read volume, low write volume, and high correctness pressure.',
        'The leader-election recipe shows the fit. Each candidate creates an ephemeral sequential znode under an election path. The candidate with the lowest suffix leads, and each loser watches only its immediate predecessor to avoid waking every contender on one failure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when used as a database, message queue, or blob store. Large values bloat snapshots and memory, high write volume bottlenecks on quorum logging, and per-request state puts ZooKeeper on the hot path. The right use is coordination metadata measured in small records.',
        'Locks fail without fencing. A client can hold a lock, pause past its session timeout, lose the ephemeral znode, and later resume while another client holds the new lock. The external resource must reject old fencing tokens such as lower zxids or sequence numbers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three candidates create /election/candidate-00000001, /election/candidate-00000002, and /election/candidate-00000003. Candidate 1 has the lowest suffix and becomes leader. Candidate 2 watches candidate 1, and candidate 3 watches candidate 2.',
        'If candidate 1 crashes and its session expires, ZooKeeper deletes candidate-00000001 as an ordered write. Only the watch for candidate 2 fires, so candidate 2 rereads the child list and becomes leader. With 200 candidates, predecessor watching wakes 1 client instead of 199 clients.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with the Apache ZooKeeper Programmer Guide at https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html, the ZooKeeper paper by Hunt, Konar, Junqueira, and Reed, and the Zab paper by Junqueira, Reed, and Serafini. Use the guide for API semantics and the papers for the ordering argument.',
        'Study Quorums for majority intersection, Raft Log Replication for a contrasting replicated-log protocol, Chubby Lock Service Case Study for the predecessor system, Distributed Locks for client recipes, and Fencing Token Zombie Writer Case Study for the lock failure mode.',
      ],
    },
  ],
};
