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
    { heading: 'How to read the animation', paragraphs: [
      'Read metadata-log as the cluster brain becoming an ordered log. The active controller writes metadata records, controller voters replicate them, brokers fetch them, and each broker builds a local metadata image. Snapshots are checkpoints that bound replay work.',
      {type:'callout', text:'KRaft turns Kafka metadata into an ordered replicated log so every controller and broker can rebuild the same cluster image from committed records.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Kafka originally stored user records in broker logs but stored cluster metadata in ZooKeeper. Metadata means broker registrations, topic ids, partition leaders, replica sets, in-sync replicas, and configs. KRaft exists to move that metadata into Kafka-native replicated-log machinery.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to let each broker keep local metadata and exchange updates. That fails because metadata needs one ordered history. If brokers apply topic creation and leadership changes in different orders, they build incompatible clusters.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is conflicting authority during failure. Two controllers must not both decide partition leadership. A new controller must continue from committed state, not private memory. That requires a quorum-backed metadata log.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Metadata is data. Topic creation, broker registration, partition reassignment, config updates, and fencing decisions can be records in one ordered log. Controllers commit those records through a quorum, and brokers replay them into the same cluster image.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A KRaft cluster has controller voters and one active controller. The active controller appends metadata records, voters replicate them, and committed records become authoritative. Brokers and standby controllers fetch the log, apply records locally, and load snapshots to avoid replaying from the beginning.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness comes from ordered replay and quorum commitment. If nodes apply the same committed metadata records in the same order, they derive the same metadata image. A controller without quorum authority cannot safely invent cluster state, so split-brain metadata decisions are blocked.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'KRaft removes ZooKeeper but makes controller quorum health part of Kafka operations. With 3 controller voters, the cluster can lose 1 voter and still commit with a majority of 2. With 5 voters, it can lose 2, but each metadata change has a larger coordination path.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Topic creation records topic id, partition assignment, configs, and initial leaders in the metadata log. Broker failure records leadership and in-sync replica changes in the same history. Clients route correctly because brokers eventually apply the committed metadata image.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'KRaft fails when the controller quorum is unavailable. Existing data traffic may continue in some cases, but metadata changes such as topic creation, reassignments, and leader elections cannot safely commit. Slow controller disks, lagging voters, bad snapshots, and weak migration planning still matter.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A 3-voter quorum has C1 active, with C2 and C3 following. C1 appends record 120 to create topic orders, and C2 replicates it, so a majority commits it. If C1 then crashes after writing private record 121 only to itself, C2 can win leadership and continue from committed record 120, not from C1 private state.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Kafka KRaft docs at https://kafka.apache.org/documentation/#kraft, KIP-500 at https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum, Kafka design docs at https://kafka.apache.org/43/design/design/, and Raft at https://raft.github.io/raft.pdf. Study Kafka Log, Raft, Quorums, Leader Election, Snapshots, WAL, ZooKeeper Zab, and Control Plane versus Data Plane next.',
    ] },
  ],
};
