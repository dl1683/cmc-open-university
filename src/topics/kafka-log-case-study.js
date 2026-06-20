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
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Kafka Log Case Study. Kafka as a production log: partition ordering, offsets, consumer groups, retention, compaction, and backpressure..",
        {type:"callout", text:"Kafka separates the durable record from each reader position, which makes one partition log serve transport, storage, replay, and independent fanout."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large systems do not just need messages. They need a durable record of what happened, many independent readers, bounded ordering guarantees, recovery after crashes, and a way to replay history when a downstream service changes its mind. A payment service may emit an order event that is needed by fraud detection, analytics, search indexing, customer email, billing, and an offline feature pipeline. Those readers move at different speeds and fail in different ways.',
        'A plain in-memory queue solves only the handoff. Once one worker consumes a message, the broker can delete it. That is efficient for a single job queue, but it is the wrong shape when history itself is useful. Kafka is the case study for treating the log as the shared data structure. Producers append records. Brokers retain ordered segments. Consumers own their positions. The result is not just messaging; it is a replayable event backbone.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first baseline is a database table with a processed flag. Writers insert events, workers poll for unprocessed rows, and each worker marks a row done. This gives durability, but the database is now doing queue coordination, ordering, fanout, retention, and cleanup through ad hoc queries. Polling creates load, workers fight over locks, and replay is awkward because the table has been mutated to represent consumption.',
        'The second baseline is a conventional message queue. That is better for work distribution, but it usually treats successful consumption as deletion. If a new analytics service needs six months of events, it cannot ask the queue to replay what older consumers already removed. If a search indexer has a bug and needs to rebuild, the queue has no principled reason to still have the old records. The wall is that consumption and storage have been fused.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Kafka separates the record from the reader position. The broker stores an append-only partition log. Each record receives an offset that never changes inside that partition. Consumers do not remove records when they read; they remember offsets. Different consumer groups can therefore read the same topic independently, at different rates, with different retry policies, without stealing records from each other.',
        'The second insight is that ordering is scoped by partition. A topic can have many partitions so producers and consumers can scale, but only one partition gives a total order. If all events for user-7 must be processed in order, the producer should route that key to the same partition. If a topic has partition 0 and partition 1, offset 12 in partition 0 is not globally before offset 12 in partition 1. Kafka wins by making the ordering boundary explicit instead of pretending there is a free global order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer sends a record to a topic. A partitioner chooses the partition, often by hashing the key. The partition leader appends the record to the end of its log, assigns the next offset, and replicates the append to follower brokers according to the topic configuration. Acknowledgment settings decide whether the producer waits for only the leader or for a stronger replication condition. The log is stored in segments so old data can be deleted, compacted, or moved without rewriting the whole partition.',
        'A consumer group is a named set of readers that cooperatively process a topic. Kafka assigns each partition to at most one member of the group at a time. If a topic has four partitions and a group has two consumers, each consumer may own two partitions. If the group grows to four consumers, each can own one partition. If it grows to eight consumers, four consumers will be idle for that topic because partition ownership is the parallelism limit.',
        'Offset commits are the recovery boundary. A consumer polls records, processes them, and commits the highest safe offset for each partition. If it crashes after processing but before committing, it may process those records again. If it commits before the side effect is durable, it may skip work after a crash. This is why Kafka applications are usually designed with idempotent sinks, transactional writes, or explicit deduplication keys.',
      ],
    },
    {
      heading: 'Retention and compaction',
      paragraphs: [
        'Retention answers the question: how long should the full event history remain available? A topic can keep records by time, by size, or by other storage policy. Retention makes replay possible, but it is not infinite. A new consumer can replay only the data the cluster still retains. A disaster recovery plan that depends on replay must size retention and storage honestly.',
        'Compaction answers a different question: what is the latest known value for each key? In a compacted topic, Kafka may discard older records for the same key while keeping the newest value and tombstones for deletion. This turns the log into a changelog for materialized state. A service can rebuild a cache by replaying the compacted topic from the beginning and ending with the latest value for each key, even if intermediate changes have been removed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an ecommerce system publishes `OrderPlaced` events keyed by `orderId` and `UserProfileChanged` events keyed by `userId`. The order topic has six partitions. The fraud group reads every order and commits offsets after writing a fraud decision. The warehouse group reads the same order topic but batches records into a column store. The email group reads only enough fields to send receipts. These groups do not coordinate with each other because each group owns its own offsets.',
        'Now the warehouse team discovers a transformation bug. With a simple queue, the old events are gone. With Kafka, the warehouse group can reset its offsets to an earlier point and rebuild the affected table, while the fraud and email groups keep their current offsets. If a new recommendation service launches, it can start at offset 0 or at the latest offset depending on whether it needs history. That is the practical power of storing the stream and making consumption position a separate piece of state.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The partitioned-log view highlights producers, brokers, partition leaders, ordered partitions, and consumers. Follow the append path from producer to broker to partition, then follow the poll path from partition to consumer. The important observation is that the record stays in the log after the consumer reads it. The consumer position advances; the log does not become shorter because one group made progress.',
        'The consumer-group and compaction view shows the operational side. Rebalancing can move partition ownership when members join or leave, which is why lag and pauses matter. Compaction keeps latest values per key, which is why old records for user-7 can disappear while the final user-7 value remains. The frames are meant to teach the boundary: Kafka preserves partition order and replay within retention or compaction policy, not a perfect eternal history of every fact for every reader.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The reliability argument is based on small invariants. Appends are ordered within a partition. Offsets are stable positions in that partition. Consumer groups commit positions independently. Replication keeps partition data available after broker failures when enough replicas survive. Retention and compaction are explicit policies rather than accidental side effects of consumption.',
        'Those invariants compose into useful system behavior. A slow consumer creates lag instead of blocking every other consumer. A crashed consumer resumes from a committed offset. A new consumer group can replay retained data without asking producers to resend. A compacted changelog can rebuild materialized state after a cache loss. Kafka works because it makes time, ownership, and replay visible.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Partitions are the main design knob and the main trap. More partitions increase parallelism and throughput, but they also increase metadata, file handles, leader election work, rebalancing cost, and operational complexity. Too few partitions bottleneck consumers. Too many partitions make failures and reassignments heavier. Changing partition count can also change key-to-partition routing for new records unless the producer strategy handles it carefully.',
        'Key choice decides both order and load balance. A hot key can overload one partition while others sit idle. A random key improves balance but destroys per-entity ordering. Retention consumes disk. Compaction consumes I/O and can leave old values visible until the cleaner catches up. Stronger producer acknowledgments improve durability but add latency. Kafka gives direct controls, but those controls force the application to state its priorities.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Kafka wins when multiple systems need the same stream: change data capture, operational logs, metrics, analytics ingestion, fraud pipelines, search indexing, feature pipelines, stream processing, audit trails, and cache rebuilds. It is especially strong when readers need independent progress and when replay is a normal operational tool rather than an emergency exception.',
        'It also wins at service boundaries where producers should not know every downstream consumer. A checkout service can publish an order event once. New consumers can appear later without adding synchronous calls to checkout. The cost is that the event contract becomes a long-lived API, so schema evolution, compatibility, and dead-letter handling become part of the platform.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Kafka is a poor fit for tiny request-response workflows that need an immediate answer from one worker. It is also not a substitute for a database transaction across arbitrary services. If a consumer writes to an external system and then commits an offset, the end-to-end guarantee depends on that external write, not only on Kafka. Exactly-once behavior requires careful use of producer idempotence, transactions, offset commits, and idempotent sinks.',
        'It can also fail socially. Teams sometimes publish vague events with unstable schemas, set retention too low for promised replay, ignore lag until incidents, or choose partition keys without understanding skew. A Kafka cluster can centralize coupling as easily as it can decouple services. The log makes history available, but it does not make the history well-modeled.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Common failures include consumer lag growing until retention deletes unread records, poison messages blocking a partition, rebalances pausing work during deployments, transactional producers fencing old instances, compaction tombstones disappearing before all replicas of state have rebuilt, and a single hot partition limiting throughput for the whole topic.',
        'The defensive patterns are equally concrete: monitor lag by group and partition, make sinks idempotent, include event IDs, use retry and dead-letter topics deliberately, test replay from old offsets, define schema compatibility rules, and size retention against recovery objectives. Kafka is simple at the data-structure level, but production use is mostly about respecting the edge cases created by that simplicity.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: "Kafka: a Distributed Messaging System for Log Processing" at https://pages.cs.wisc.edu/~akella/CS744/F17/838-CloudPapers/Kafka.pdf. Study Message Queues for the deletion-on-consume contrast, Write-Ahead Log (WAL) for append durability, Sharding & Partitioning for key-to-partition tradeoffs, Backpressure & Flow Control for lag, Idempotency & Exactly-Once Delivery for sink correctness, and Feature Store: Offline/Online Consistency for replayed state.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Kafka Log Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

