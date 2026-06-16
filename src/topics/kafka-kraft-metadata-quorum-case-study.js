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
      heading: 'What it is',
      paragraphs: [
        'KRaft is Kafka Raft metadata mode: Kafka stores cluster metadata in a self-managed controller quorum instead of ZooKeeper. The old architecture kept Kafka data in broker logs but cluster metadata in ZooKeeper. KRaft brings metadata into Kafka-style log replication.',
        'The lesson is a control-plane data structure. Topics, partitions, broker registrations, configs, leader epochs, ISR changes, and fencing decisions become records in a metadata log. Controllers replicate that log, brokers consume it, and snapshots bound replay cost.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A set of Kafka servers acts as controllers. One controller is active; the others are hot standbys. Metadata mutations are appended to the cluster metadata log and replicated through the controller quorum. A committed record becomes part of the authoritative cluster image.',
        'Brokers fetch metadata log records and apply them to local state. That means a broker can answer routing and leadership questions from its local metadata image rather than from ZooKeeper watches. Metadata snapshots let a recovering node load a compact image and replay only later records.',
        'This is the same shape as Write-Ahead Log, Raft Log Replication, Quorums, and Kafka Log Case Study, but applied to Kafka itself. The data structure is simple; the system boundary is subtle because bad metadata affects every topic and broker.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'KRaft removes ZooKeeper as a separate dependency, but it concentrates responsibility in the controller quorum. Controller voter sizing, disk health, network partitions, follower lag, metadata snapshots, process roles, and migration state become first-class operational concerns.',
        'The metadata log is usually much smaller than user topic data, but its blast radius is larger. A slow or unavailable metadata quorum can block topic creation, partition leadership changes, broker fencing, and controller failover. Monitoring the metadata high watermark and controller lag matters because they describe whether the control plane can keep making progress.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An ecommerce company creates an orders.v2 topic. The active controller appends records for the topic id, partition assignments, replication factor, configs, and leader selection. The records replicate to the controller quorum. Brokers fetch them, update local metadata, and begin accepting produce/fetch requests for the new partitions.',
        'Later, one broker fails. The controller appends partition-leadership and ISR-change records. Brokers apply those records, clients refresh metadata, and producers route to the new leaders. The operational story is no longer ZooKeeper watches plus broker state; it is one authoritative metadata log feeding every broker.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common misconception is that KRaft is only "Kafka minus ZooKeeper." The deeper lesson is that metadata became a replicated log with snapshots, epochs, and quorum rules. You still need a reliable control plane. You just operate it inside Kafka rather than beside Kafka.',
        'Another mistake is ignoring controller placement. Co-locating controllers and brokers can be convenient, but it ties data-plane load to control-plane health. Dedicated controllers reduce some coupling but require their own sizing and monitoring discipline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Kafka KRaft documentation at https://kafka.apache.org/41/operations/kraft/, KIP-500 at https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum, and Kafka KRaft monitoring docs at https://kafka.apache.org/41/operations/monitoring/. Study Kafka Log Case Study, Raft Log Replication, ZooKeeper Zab Case Study, Write-Ahead Log, Quorums, and Kafka Transactions & Exactly-Once Case Study next.',
      ],
    },
  ],
};
