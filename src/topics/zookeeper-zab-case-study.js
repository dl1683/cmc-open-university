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
      heading: 'Why this exists',
      paragraphs: [
        'ZooKeeper exists because distributed applications need a small, reliable coordination kernel. Before systems such as ZooKeeper, many teams built their own leader election, membership, configuration, barriers, and locks inside application code. Those homegrown protocols often failed under session loss, partial failures, duplicate leaders, and unclear ordering.',
        'ZooKeeper gives clients a replicated hierarchical namespace of znodes, plus sessions, watches, versions, ephemeral nodes, sequential nodes, and ordered writes. Those primitives are deliberately small. The server does not try to become every application\'s database. It provides enough reliable structure for clients to build coordination recipes.',
        'Zab matters because the namespace is useful only if all correct replicas apply writes in the same order and leader changes preserve history. ZooKeeper is therefore a case study in the meeting point between API design and atomic broadcast.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store coordination state in a normal database table. That works until the application needs ephemeral membership, ordered election candidates, one-shot invalidation, conditional updates, and fast reads from a replicated control plane. A general database can do some of that, but the coordination contract remains scattered across application code.',
        'Another obvious approach is for every service to elect leaders through heartbeats and ad hoc timeouts. That often creates split-brain behavior: two nodes believe they are leader because the network is slow, a process paused, or a failure detector guessed wrong. ZooKeeper moves the hard part into a replicated service with a clear session and ordering model.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that coordination failures are small in data volume and large in consequence. A wrong leader, stale configuration, or broken lock can corrupt a much larger system. You do not need a petabyte database to solve that problem. You need a strongly ordered, highly available coordination substrate with simple semantics.',
        'The second wall is notification. Clients want to cache coordination state because polling a central service constantly is expensive. But cached state becomes dangerous unless clients know when to refresh. ZooKeeper watches provide one-shot invalidation signals, not durable event streams.',
        'The third wall is leadership. Replicas must agree on write order, and a new leader must not forget committed history. Zab solves that by combining leader epochs, discovery, synchronization, and ordered broadcast.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Expose a small replicated namespace and let clients compose recipes. Znodes are the records. Sessions give liveness meaning. Ephemeral znodes disappear when a session expires. Sequential znodes give a shared order. Versions give compare-and-set style protection. Watches tell clients to reread.',
        'The server stays general because it does not know every application-level coordination pattern. Leader election, locks, barriers, membership, and configuration all emerge from the same primitives. That makes ZooKeeper powerful, but it also means recipe correctness remains client work.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The znodes-and-watches view shows a small namespace carrying large coordination meaning. A path such as /app/leader is not just a string. It can encode leadership, membership, configuration, or a lock contender depending on the recipe around it.',
        'The watch view teaches a common misconception. A watch event is not the data. It is a prompt to reread the data. Watches are one-shot, so a correct client receives an event, reads the current znode state, and installs a fresh watch if it still needs future changes.',
        'The Zab view shifts attention from client API to replication. Writes go through a leader, followers acknowledge proposals, and a quorum makes the ordered update durable. The performance lesson is also visible: reads can be cheap because writes paid for ordering.',
      ],
    },
    {
      heading: 'How znodes work',
      paragraphs: [
        'A znode is a node in ZooKeeper\'s hierarchical namespace. It can hold small data and metadata such as version numbers. Persistent znodes remain until deleted. Ephemeral znodes are tied to a client session and disappear when that session expires. Sequential znodes receive a monotonically increasing suffix assigned by ZooKeeper.',
        'Those modes are enough to build useful patterns. Ephemeral nodes represent membership because they vanish when the member\'s session dies. Sequential nodes represent order because clients can compare suffixes. Versions protect updates because a client can say "set this only if the version I read is still current."',
        'ZooKeeper is intentionally not designed for large values or high write volume. Znodes should hold compact coordination state: names, addresses, versions, flags, small configuration records, and recipe metadata. Large payloads belong somewhere else.',
      ],
    },
    {
      heading: 'How watches work',
      paragraphs: [
        'A watch is a one-shot notification attached to a read. If the watched znode or child list changes, the client receives an event. The event does not replace a read; it invalidates the client\'s cached view. The client must read again and, if necessary, set another watch.',
        'This design avoids turning ZooKeeper into a durable event log. It gives clients a cheap way to keep mostly-current cached state without polling constantly. The price is that clients must handle missed-looking races by always rereading authoritative state after an event.',
        'The right mental model is cache invalidation. A watch says, "the thing you looked at may have changed." It does not say, "here is every change that happened." If the application needs a full event history, it should use a log or stream, not watches.',
      ],
    },
    {
      heading: 'How Zab works',
      paragraphs: [
        'ZooKeeper writes are ordered through Zab, a primary-backup atomic broadcast protocol. The leader proposes updates. Followers acknowledge them. Once a quorum has accepted an update, the leader can commit and replicas deliver updates in the same order.',
        'Leader changes are the dangerous part. Zab has to discover a viable leader, synchronize follower logs, establish a new epoch, and ensure that committed updates from the previous history are not lost. The protocol is not just "send writes to a leader"; it is a disciplined way to carry ordered history across leader replacement.',
        'This is why ZooKeeper can support simple client semantics. A client sees a service where writes have a total order. Reads may be served efficiently, but clients needing freshness can use sync to ensure a server has caught up with the ordered write stream.',
      ],
    },
    {
      heading: 'Worked example: leader election',
      paragraphs: [
        'A standard leader election recipe uses ephemeral sequential znodes under an election path. Each candidate creates a child such as /election/candidate-00000017. The candidate with the lowest sequence number is leader. If that client\'s session expires, its ephemeral znode disappears.',
        'The scalable detail is watch placement. Every non-leader watches the predecessor just before it, not the whole election directory. If the leader disappears, only the next candidate wakes up and checks whether it is now lowest. That avoids a herd effect where every contender stampedes the ensemble on every leadership change.',
        'This example shows ZooKeeper\'s philosophy. The server provides ephemeral lifetime, sequential order, watches, and consistent namespace state. The election rule itself lives in the client recipe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'ZooKeeper works because it narrows the problem. It does not try to store application data, run arbitrary queries, or process high-volume streams. It stores small coordination facts with strong ordering and exposes primitives that map directly to common distributed-system needs.',
        'It also works because session lifetime becomes data. An ephemeral znode converts "this client is still connected under the session model" into visible namespace state. That is more useful than each application inventing a separate heartbeat table.',
        'Zab supplies the replication backbone. Quorum-ordered writes and disciplined leader recovery mean every correct replica applies the same committed updates in the same order. The API would be dangerous without that ordering guarantee.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'ZooKeeper is optimized for read-heavy coordination workloads with small writes. Writes pay ordering and quorum cost. Hot znodes, large payloads, frequent writes, and per-request locking can overload the ensemble or create fragile system-wide dependencies.',
        'Sessions are not perfect failure detectors. A slow network or paused process can lose its session even if the process later resumes. Correct external systems need fencing tokens, version checks, or conditional writes so an old leader cannot continue mutating resources after it has lost leadership in ZooKeeper.',
        'Operationally, ZooKeeper requires care around ensemble sizing, disk latency, snapshots, transaction logs, garbage collection pauses, client retry behavior, and watch storms. The data may be small, but the blast radius is large because many services may depend on it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'ZooKeeper wins for leader election, membership, small configuration, distributed locks, barriers, and service coordination. It has been used by Hadoop, HBase, Kafka-era broker coordination, Solr, Storm, and many internal platforms.',
        'It is especially useful when clients need a shared ordered namespace rather than a high-throughput data log. The combination of ephemeral nodes, sequential nodes, versions, and watches is small but expressive.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ZooKeeper fails when teams use it as a database, message queue, or large-object store. It is not built for high write throughput, large payloads, unbounded event history, or per-request application state.',
        'It also fails when recipes ignore fencing. A distributed lock in ZooKeeper does not automatically protect an external database, file, or actuator. The external system must reject stale leaders, usually through monotonically increasing fencing tokens or versioned conditional updates.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Remember the primitives: znode, session, ephemeral, sequential, version, watch. Each one solves a specific coordination need. The power comes from composing them carefully, not from treating ZooKeeper as magic.',
        'Remember the watch rule: reread after notification. Remember the lock rule: fence external side effects. Remember the scale rule: small coordination state only.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: ZooKeeper paper at https://www.usenix.org/legacy/event/atc10/tech/full_papers/Hunt.pdf, Apache Programmer Guide at https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html, and Zab paper at https://classpages.cselabs.umn.edu/Fall-2017/csci8211/Papers/Distributed%20Systems%20Zab-%20High-performance%20broadcast%20for%20primary-backup%20systems.pdf. Study Chubby Lock Service Case Study, Distributed Locks, Leader Replacement, Paxos, Raft Log Replication, Read/Write Quorums, etcd Raft Lease Case Study, and Kafka Log Case Study next.',
      ],
    },
  ],
};
