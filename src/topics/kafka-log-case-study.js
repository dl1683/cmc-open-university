// Kafka case study: a distributed commit log for event streams. Partitions
// provide ordering, offsets provide replay, consumer groups provide scale-out,
// and compaction turns keyed streams into materialized latest-value logs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kafka-log-case-study',
  title: 'Kafka Log Case Study',
  category: 'Papers',
  summary: 'Kafka as a production log: partition ordering, offsets, consumer groups, retention, compaction, and backpressure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['partitioned log', 'consumer groups and compaction'], defaultValue: 'partitioned log' },
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
      { id: 'p1', label: 'producer A', x: 0.7, y: 2.8, note: 'events' },
      { id: 'p2', label: 'producer B', x: 0.7, y: 5.2, note: 'events' },
      { id: 'broker1', label: 'broker 1', x: 3.0, y: 2.4, note: 'partition 0 leader' },
      { id: 'broker2', label: 'broker 2', x: 3.0, y: 5.6, note: 'partition 1 leader' },
      { id: 'part0', label: 'partition 0', x: 5.4, y: 2.4, note: 'ordered log' },
      { id: 'part1', label: 'partition 1', x: 5.4, y: 5.6, note: 'ordered log' },
      { id: 'c1', label: 'consumer 1', x: 8.0, y: 2.4, note: 'group member' },
      { id: 'c2', label: 'consumer 2', x: 8.0, y: 5.6, note: 'group member' },
    ],
    edges: [
      { id: 'e-p1-b1', from: 'p1', to: 'broker1', weight: 'append' },
      { id: 'e-p2-b2', from: 'p2', to: 'broker2', weight: 'append' },
      { id: 'e-b1-part0', from: 'broker1', to: 'part0', weight: 'offsets' },
      { id: 'e-b2-part1', from: 'broker2', to: 'part1', weight: 'offsets' },
      { id: 'e-part0-c1', from: 'part0', to: 'c1', weight: 'poll' },
      { id: 'e-part1-c2', from: 'part1', to: 'c2', weight: 'poll' },
      { id: 'e-b1-b2', from: 'broker1', to: 'broker2', weight: 'replicate' },
    ],
  }, { title });
}

function* partitionedLog() {
  yield {
    state: topology('Kafka is a distributed append-only log'),
    highlight: { active: ['p1', 'p2', 'broker1', 'broker2'], found: ['part0', 'part1'] },
    explanation: 'Kafka stores events in topic partitions. A producer appends records to a partition leader, and each record receives an offset. Within one partition, offsets define a total order. Across partitions, there is no single global order.',
    invariant: 'Ordering is per partition, not per topic.',
  };

  yield {
    state: labelMatrix(
      'A partition is an ordered, replayable sequence',
      [
        { id: 'o0', label: 'offset 0' },
        { id: 'o1', label: 'offset 1' },
        { id: 'o2', label: 'offset 2' },
        { id: 'o3', label: 'offset 3' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'value', label: 'value' },
        { id: 'consumer', label: 'consumer position' },
      ],
      [
        ['user-7', 'view', 'processed'],
        ['user-9', 'click', 'processed'],
        ['user-7', 'cart', 'next'],
        ['user-2', 'view', 'waiting'],
      ],
    ),
    highlight: { active: ['o2:consumer'], found: ['o0:consumer', 'o1:consumer'] },
    explanation: 'Consumers track offsets instead of deleting messages as they read them. That gives replay: a new consumer can start at offset 0, a failed consumer can resume from its committed offset, and a batch job can reprocess history. The log is both transport and storage.',
  };

  yield {
    state: topology('Partitions scale producers and consumers'),
    highlight: { active: ['part0', 'part1', 'c1', 'c2'], compare: ['e-part0-c1', 'e-part1-c2'] },
    explanation: 'A consumer group assigns each partition to one consumer in that group. Add partitions for more parallelism; add consumers up to the partition count. This is Sharding & Partitioning applied to an event log.',
  };

  yield {
    state: labelMatrix(
      'Kafka versus a simple queue',
      [
        { id: 'queue', label: 'simple queue' },
        { id: 'kafka', label: 'Kafka log' },
        { id: 'db', label: 'database table' },
      ],
      [
        { id: 'read', label: 'read model' },
        { id: 'replay', label: 'replay?' },
        { id: 'state', label: 'state owner' },
      ],
      [
        ['remove on consume', 'usually no', 'broker'],
        ['offset advances', 'yes', 'consumer group'],
        ['query rows', 'yes by query', 'database'],
      ],
    ),
    highlight: { found: ['kafka:replay', 'kafka:state'], compare: ['queue:read'] },
    explanation: 'Kafka is not just Message Queues with extra scale. The durable log and consumer-owned offsets make it a coordination surface for many downstream systems: search indexing, Feature Store: Offline/Online Consistency, analytics, fraud detection, and stream processing.',
  };
}

function* consumerGroupsAndCompaction() {
  yield {
    state: labelMatrix(
      'Consumer group assignment',
      [
        { id: 'p0', label: 'partition 0' },
        { id: 'p1', label: 'partition 1' },
        { id: 'p2', label: 'partition 2' },
        { id: 'p3', label: 'partition 3' },
      ],
      [
        { id: 'before', label: '2 consumers' },
        { id: 'after', label: '3 consumers' },
        { id: 'risk', label: 'rebalance cost' },
      ],
      [
        ['C1', 'C1', 'stable'],
        ['C1', 'C2', 'moved'],
        ['C2', 'C3', 'moved'],
        ['C2', 'C3', 'stable'],
      ],
    ),
    highlight: { active: ['p1:risk', 'p2:risk'], found: ['p0:risk', 'p3:risk'] },
    explanation: 'A consumer group rebalances partitions when members join or leave. Rebalancing improves parallelism, but it can pause processing and move ownership. Production Kafka work is often about controlling this operational edge: backpressure, lag, retry topics, dead-letter queues, and idempotent writes.',
  };

  yield {
    state: labelMatrix(
      'Log compaction keeps the latest value per key',
      [
        { id: 'o0', label: 'offset 0' },
        { id: 'o1', label: 'offset 1' },
        { id: 'o2', label: 'offset 2' },
        { id: 'o3', label: 'offset 3' },
        { id: 'o4', label: 'offset 4' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'after', label: 'after compaction' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['user7 = free', 'drop', 'old value'],
        ['user9 = paid', 'keep', 'latest user9'],
        ['user7 = pro', 'drop', 'old value'],
        ['user7 = team', 'keep', 'latest user7'],
        ['user2 = null', 'keep tombstone', 'delete marker'],
      ],
    ),
    highlight: { found: ['o1:after', 'o3:after', 'o4:after'], removed: ['o0:after', 'o2:after'] },
    explanation: 'Kafka can retain a compacted topic where the latest record for each key survives. This turns a log into a replayable changelog for materialized state. The trick is useful for cache rebuilds, stream tables, and services that need to reconstruct current state after failure.',
    invariant: 'Compaction preserves the latest known value per key, not every historical event.',
  };

  yield {
    state: labelMatrix(
      'Kafka design lessons',
      [
        { id: 'order', label: 'ordering' },
        { id: 'replay', label: 'replay' },
        { id: 'lag', label: 'lag' },
        { id: 'exactly', label: 'exactly-once claims' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'study', label: 'study link' },
      ],
      [
        ['per partition', 'Sharding & Partitioning'],
        ['offsets are durable cursors', 'Write-Ahead Log (WAL)'],
        ['lag is backpressure signal', 'Backpressure & Flow Control'],
        ['requires idempotent sinks', 'Idempotency & Exactly-Once Delivery'],
      ],
    ),
    highlight: { active: ['lag:lesson', 'exactly:lesson'], found: ['replay:study'] },
    explanation: 'Kafka is a case study in using one data structure, the log, as a system boundary. It works because producers, brokers, consumers, and downstream stores agree on offsets, partitions, retention, and replay semantics.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'partitioned log') yield* partitionedLog();
  else if (view === 'consumer groups and compaction') yield* consumerGroupsAndCompaction();
  else throw new InputError('Pick a Kafka view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the partitioned-log view from producer to broker to partition to consumer. A partition is one ordered append-only sequence, and an offset is the record position inside that sequence. The animation proves per-partition order plus independent reader progress, not a free global order.',
      {type:"callout", text:"Kafka separates the durable record from each reader position, which makes one partition log serve transport, storage, replay, and independent fanout."},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Large systems need a durable history of events, many readers, recovery after crashes, and replay when downstream code changes. A queue that deletes a message after one worker reads it cannot serve search indexing, fraud, analytics, and feature pipelines at the same time.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a database table with a processed flag or a normal message queue. The table turns the database into a polling and locking coordinator. The queue handles work distribution but usually fuses consumption with deletion, so later readers cannot replay old events.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that storage and consumption have different jobs. Storage should preserve the event for a retention policy, while consumption should track one reader group position. Global order is also expensive, so Kafka scopes order to one partition and makes the partition key a design decision.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Separate the durable record from reader progress. Brokers store records in partition logs, and consumer groups store offsets. A slow group creates lag for itself, not deletion or blockage for every other group.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A producer sends a record to a topic, and a partitioner chooses a partition, often from the key. The partition leader appends the record, assigns the next offset, and replicates it. Consumers poll partitions and commit offsets for their group.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The invariants are local and strong. Offsets are stable positions inside one partition, records are not removed by one consumer read, and group offsets are independent. Those facts make replay, resume after crash, and independent fanout possible within retention or compaction policy.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Partitions are the main cost knob. With 12 partitions and 3 consumers, each consumer can own about 4 partitions; a thirteenth consumer adds no parallelism for that topic. More partitions add throughput potential, but also metadata, file handles, rebalances, replication work, and recovery cost.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Kafka wins for change data capture, operational logs, metrics ingestion, fraud pipelines, search indexing, analytics, feature pipelines, audit trails, and cache rebuilds. It is strongest when many systems need the same stream and replay is a normal operation.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Kafka is a poor fit for tiny request-response work that needs one immediate answer. It is not a database transaction across arbitrary services. It also fails when teams choose hot partition keys, promise replay beyond retention, ignore lag, or treat compaction as full history.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'An orders topic has 6 partitions and records keyed by orderId. Fraud, warehouse, and email are three consumer groups with separate offsets. If warehouse resets from offset 900000 to 750000 to rebuild a table, fraud and email keep their own positions and do not coordinate with it.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Kafka design docs at https://kafka.apache.org/43/design/design/, Kafka original paper at https://pages.cs.wisc.edu/~akella/CS744/F17/838-CloudPapers/Kafka.pdf, Kafka compaction docs at https://kafka.apache.org/documentation/#compaction, and Kafka consumer position docs at https://kafka.apache.org/documentation/#design_consumerposition. Study Message Queues, WAL, Sharding, Backpressure, Idempotency, Schema Registry, CDC, and Kafka Transactions next.',
    ] },
  ],
};
