// Kafka KRaft: the metadata plane moves from ZooKeeper into a replicated
// controller log that brokers consume and apply locally.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kafka-kraft-metadata-quorum-case-study',
  title: 'Kafka KRaft Metadata Quorum Case Study',
  category: 'Systems',
  summary: 'Kafka without ZooKeeper: controllers replicate cluster metadata through a Raft quorum, brokers apply a metadata log, and snapshots bound recovery cost.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['metadata log', 'controller failover'], defaultValue: 'metadata log' },
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

function kraftGraph(title) {
  return graphState({
    nodes: [
      { id: 'admin', label: 'admin/client', x: 0.7, y: 3.8, note: 'create topic' },
      { id: 'active', label: 'active controller', x: 2.6, y: 2.2, note: 'leader' },
      { id: 'standbyA', label: 'standby ctrl A', x: 2.6, y: 5.2, note: 'voter' },
      { id: 'standbyB', label: 'standby ctrl B', x: 4.6, y: 5.2, note: 'voter' },
      { id: 'log', label: 'metadata log', x: 4.6, y: 2.2, note: '__cluster_metadata' },
      { id: 'snapshot', label: 'snapshot', x: 6.3, y: 1.1, note: 'bounded replay' },
      { id: 'broker1', label: 'broker 1', x: 7.1, y: 3.2, note: 'applies records' },
      { id: 'broker2', label: 'broker 2', x: 7.1, y: 5.0, note: 'applies records' },
      { id: 'local', label: 'local metadata', x: 8.9, y: 4.1, note: 'topics, ISR, configs' },
    ],
    edges: [
      { id: 'e-admin-active', from: 'admin', to: 'active', weight: 'request' },
      { id: 'e-active-log', from: 'active', to: 'log', weight: 'append records' },
      { id: 'e-log-standbyA', from: 'log', to: 'standbyA', weight: 'replicate' },
      { id: 'e-log-standbyB', from: 'log', to: 'standbyB', weight: 'replicate' },
      { id: 'e-log-snapshot', from: 'log', to: 'snapshot', weight: 'checkpoint' },
      { id: 'e-log-broker1', from: 'log', to: 'broker1', weight: 'fetch' },
      { id: 'e-log-broker2', from: 'log', to: 'broker2', weight: 'fetch' },
      { id: 'e-broker1-local', from: 'broker1', to: 'local', weight: 'apply' },
      { id: 'e-broker2-local', from: 'broker2', to: 'local', weight: 'apply' },
    ],
  }, { title });
}

function* metadataLog() {
  yield {
    state: kraftGraph('KRaft makes cluster metadata a replicated log'),
    highlight: { active: ['active', 'log', 'e-active-log'], found: ['standbyA', 'standbyB'] },
    explanation: 'In KRaft mode, Kafka controllers store cluster metadata in a replicated quorum rather than in ZooKeeper. The active controller writes metadata records, and other controllers replicate the same ordered log.',
    invariant: 'Cluster metadata changes are serialized through the metadata log.',
  };

  yield {
    state: labelMatrix(
      'Metadata records are ordinary log entries with cluster meaning',
      [
        { id: 'r0', label: 'r120' },
        { id: 'r1', label: 'r121' },
        { id: 'r2', label: 'r122' },
        { id: 'r3', label: 'r123' },
      ],
      [
        { id: 'type', label: 'type' },
        { id: 'meaning', label: 'means' },
        { id: 'consumer', label: 'applies' },
      ],
      [
        ['Topic', 'id', 'all'],
        ['Part', 'ISR', 'lead'],
        ['Config', 'key', 'brok'],
        ['Fence', 'off', 'quor'],
      ],
    ),
    highlight: { active: ['r0:type', 'r1:meaning', 'r3:meaning'], found: ['r2:consumer'] },
    explanation: 'KRaft metadata is not an opaque blob. It is an ordered stream of records: topic creation, partition assignments, ISR changes, configs, broker registrations, and fencing decisions. Brokers consume the log and build local metadata images.',
  };

  yield {
    state: kraftGraph('Brokers replay metadata into a local image'),
    highlight: { active: ['log', 'broker1', 'broker2', 'local', 'e-log-broker1', 'e-log-broker2'], compare: ['snapshot'] },
    explanation: 'Brokers no longer ask ZooKeeper for every coordination fact. They fetch metadata records and apply them locally. That local image drives routing, partition leadership, configs, and cluster membership behavior.',
  };

  yield {
    state: labelMatrix(
      'Metadata log versus data log',
      [
        { id: 'data', label: 'D' },
        { id: 'metadata', label: 'M' },
        { id: 'snapshot', label: 'S' },
        { id: 'zk', label: 'ZK' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'replay', label: 'replay' },
      ],
      [
        ['events', 'ofs'],
        ['rules', 'brok'],
        ['image', 'catch'],
        ['znodes', 'old'],
      ],
    ),
    highlight: { found: ['metadata:stores', 'metadata:replay', 'snapshot:replay'], compare: ['zk:stores'] },
    explanation: 'The key design move is making the control plane look like the data plane: an append-only log plus snapshots. That lets Kafka use ordering, replication, and replay for metadata itself.',
  };
}

function* controllerFailover() {
  yield {
    state: kraftGraph('Only one controller is active at a time'),
    highlight: { active: ['active'], found: ['standbyA', 'standbyB'], compare: ['broker1', 'broker2'] },
    explanation: 'The controller quorum elects one active controller. Standby controllers follow the metadata log, so a failover can promote a controller that already has the recent metadata history.',
  };

  yield {
    state: labelMatrix(
      'Failover timeline',
      [
        { id: 't0', label: 't0' },
        { id: 't1', label: 't1' },
        { id: 't2', label: 't2' },
        { id: 't3', label: 't3' },
      ],
      [
        { id: 'controller', label: 'ctrl' },
        { id: 'brokerView', label: 'brokers' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['A live', 'synced', 'lag'],
        ['A lost', 'HW', 'gap'],
        ['B wins', 'epoch', 'split'],
        ['B log', 'fetch', 'stale'],
      ],
    ),
    highlight: { active: ['t2:controller', 't3:brokerView'], compare: ['t1:risk'] },
    explanation: 'Failover is a quorum problem. A new active controller must be elected by the controller voters and continue from committed metadata state, not from a private local guess.',
    invariant: 'A controller that cannot prove quorum authority must not invent cluster metadata.',
  };

  yield {
    state: kraftGraph('Snapshots bound controller and broker catch-up work'),
    highlight: { active: ['snapshot', 'log', 'e-log-snapshot'], found: ['broker1', 'broker2'], compare: ['standbyA'] },
    explanation: 'Metadata snapshots keep replay from growing forever. A broker or controller can load a recent metadata image and then replay only newer records, just like a database checkpoint plus WAL.',
  };

  yield {
    state: labelMatrix(
      'Operational checks',
      [
        { id: 'quorum', label: 'Q' },
        { id: 'lag', label: 'L' },
        { id: 'snapshot', label: 'S' },
        { id: 'role', label: 'R' },
      ],
      [
        { id: 'question', label: 'ask' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['vote?', 'stall'],
        ['sync?', 'slow'],
        ['bound?', 'start'],
        ['split?', 'blast'],
      ],
    ),
    highlight: { active: ['quorum:question', 'lag:failure'], found: ['snapshot:question'], compare: ['role:failure'] },
    explanation: 'KRaft moves Kafka metadata into Kafka-style machinery, but it does not remove operations. Teams still need to monitor quorum, high watermark, controller lag, snapshots, process roles, and migration state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'metadata log') yield* metadataLog();
  else if (view === 'controller failover') yield* controllerFailover();
  else throw new InputError('Pick a KRaft view.');
}

export const article = {
  sections: [
    {
      heading: 'Why KRaft exists',
      paragraphs: [
        'Kafka began with a split control plane. User records lived in Kafka logs on brokers, but cluster metadata lived in ZooKeeper. ZooKeeper tracked brokers, topics, partition leadership, configs, and coordination state. This worked for many years, but it meant operators had to run two distributed systems with different data models, tooling, scaling limits, and failure modes. Kafka could be healthy while ZooKeeper was unhealthy, and ZooKeeper problems could still stop Kafka control-plane progress.',
        'KRaft exists to bring Kafka metadata into Kafka itself. In KRaft mode, a self-managed controller quorum stores cluster metadata in a replicated log. That shift removes the external ZooKeeper dependency and makes metadata follow Kafka-style principles: append records, replicate them, commit them through a quorum, replay them into an image, and use snapshots to bound recovery. The important lesson is not only that one dependency disappears. The deeper lesson is that the control plane becomes a log-structured distributed system.',
        {type:'callout', text:'KRaft turns Kafka metadata into an ordered replicated log so every controller and broker can rebuild the same cluster image from committed records.'},
      ],
    },
    {
      heading: 'The naive approach and why it fails',
      paragraphs: [
        'The naive approach is to let each broker maintain cluster metadata locally and exchange updates directly. That fails because metadata needs a single ordered history. Topic creation, partition reassignment, ISR changes, broker fencing, and config updates cannot be applied in different orders by different brokers. If two controllers or brokers make conflicting decisions, clients may route to stale leaders, partitions may appear with different assignments, and failure recovery becomes guesswork.',
        'Another naive approach is to keep using an external coordination store forever. That solves ordering, but it leaves Kafka dependent on a second system for its own identity and routing. Operators must scale, secure, back up, monitor, and upgrade ZooKeeper separately. Kafka features also have to bridge two models: Kafka logs for data and ZooKeeper znodes and watches for metadata. KRaft replaces that split with one internal metadata log and a controller quorum responsible for ordering.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that metadata is data. A topic creation request, broker registration, config change, partition leadership update, ISR change, or fencing decision can be represented as a record. Those records can be placed in one ordered metadata log. The active controller appends records. Controller voters replicate them. Once a record is committed, it becomes part of the authoritative cluster image. Brokers then consume the metadata log and apply the records locally.',
        'This makes the metadata plane resemble the data plane. Kafka already depends on ordered logs, replication, offsets, high watermarks, and replay. KRaft applies the same shape to the cluster brain. The metadata log is not a user topic in the normal sense, but it has the same conceptual discipline: append-only history, quorum durability, local replay, and snapshots for compaction. That gives Kafka a native way to reason about controller failover and broker metadata consistency.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'A KRaft cluster has controller voters. One controller is active at a time, and the others follow the metadata log. When an admin client creates a topic, changes a config, or when the cluster needs a partition leadership change, the active controller writes metadata records. Those records replicate to the controller quorum. The committed portion of the log is the source of truth. A standby controller that becomes leader must continue from committed metadata state, not from private local state.',
        'Brokers fetch metadata records and apply them to a local metadata image. That image tells a broker which topics exist, which partitions it hosts, who the leaders are, which brokers are registered, which configs apply, and which epochs are current. Snapshots keep recovery bounded. Instead of replaying the entire metadata log from the beginning, a broker or controller can load a recent snapshot and replay only later records. This is the familiar checkpoint plus write-ahead-log pattern applied to Kafka metadata.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The metadata-log visual is proving that cluster state changes are serialized. The admin request goes to the active controller, but the durable object is the metadata log. Standby controllers do not invent their own state; they replicate the same log. Brokers do not depend on scattered watches; they fetch and apply records. The snapshot node proves that replay cost is managed by checkpoints rather than by trusting an unbounded log to stay cheap forever.',
        'The controller-failover visual is proving the safety rule. Only one controller should act as the active controller for a given epoch, and it must have quorum authority. The failover timeline shows why this matters: after a leader disappears, the cluster must elect a new controller that can continue from committed state. If a controller cannot prove quorum authority, it must not create metadata. That is how KRaft avoids split-brain control-plane decisions.',
      ],
    },
    {
      heading: 'Why the design works',
      paragraphs: [
        'The design works because an ordered log is a good fit for metadata evolution. Most cluster metadata changes are small, discrete events. They need ordering more than raw throughput. If every broker applies the same committed records in the same order, brokers can build compatible local views. That does not mean every broker is caught up at every instant, but it gives the system a clear source of truth and a clear way to catch up.',
        'Quorum replication gives the active controller durability and failover safety. A metadata update is not authoritative merely because one process wrote it to disk. It becomes authoritative when the quorum commits it. That matters during controller crashes and network partitions. The new controller can use the committed log and epochs to decide what state is valid. Snapshots make the design practical by reducing startup and catch-up time.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'KRaft removes ZooKeeper operations, but it does not remove control-plane operations. Controller voter count, disk latency, network health, log replication lag, high watermark progress, snapshot generation, and process roles now matter inside Kafka. A slow metadata quorum can block topic creation, partition reassignment, broker registration, leader election, and failover. The metadata log is smaller than user data logs, but its blast radius is larger because every broker depends on it.',
        'There is also a placement tradeoff. Combined broker-controller nodes are simpler for small clusters, but data-plane load and control-plane health can affect the same machines. Dedicated controllers reduce that coupling, but they add nodes and require their own monitoring. Migration from ZooKeeper mode is another cost: operators need a careful plan for metadata migration, rollback rules, client compatibility, and observability during the transition.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'Consider topic creation. An admin creates orders.v2 with a replication factor and partition count. The active controller appends records for the topic id, partition assignments, configs, and initial leaders. The controller quorum replicates and commits those records. Brokers fetch the new metadata, update local images, and begin serving the partitions they own. Clients refresh metadata and route produce or fetch requests to the correct leaders. The cluster changed because the metadata log changed.',
        'Now consider broker failure. The controller observes that a broker is gone or fenced. It appends records that update partition leadership and in-sync replica state. Brokers apply those records, and clients eventually refresh their routing. The same pattern handles config changes, partition reassignments, broker registrations, and fencing. The practical benefit is one authoritative control-plane history instead of a mix of ZooKeeper watches, broker-local state, and controller memory.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The main failure mode is quorum unavailability. If too many controller voters are down or partitioned, the cluster may keep serving some existing data paths, but metadata changes cannot safely commit. That can block new topics, reassignments, leadership changes, and recovery actions. Another failure mode is controller lag. A standby that is far behind may take longer to become useful after failover, and brokers that lag in applying metadata may have stale local images.',
        'KRaft also does not eliminate bad operations. Misconfigured roles, underprovisioned controller disks, slow snapshots, unstable networks, and careless migration planning can still break the cluster. The phrase Kafka without ZooKeeper is accurate but incomplete. The real operating question is whether the metadata quorum is healthy, whether committed state is progressing, whether snapshots bound replay, and whether brokers are applying metadata promptly.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read the Apache Kafka KRaft documentation, KIP-500, and Kafka monitoring guidance for KRaft controller metrics. Then study Kafka Log Case Study, Raft Log Replication, Quorums, Write-Ahead Log, ZooKeeper Zab Case Study, Leader Election, Snapshot Compaction, Kafka Transactions and Exactly-Once Case Study, and Control Plane versus Data Plane. The durable lesson is that a distributed system usually has two data problems: user data and the metadata that tells every node what that user data means.',
      ],
    },
  ],
};
