// Redpanda and Seastar: Kafka-compatible streaming built around shard-per-core
// ownership, per-partition Raft groups, and explicit backpressure boundaries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'redpanda-seastar-shard-per-core-case-study',
  title: 'Redpanda Seastar Shard-Per-Core Case Study',
  category: 'Systems',
  summary: 'Redpanda as a Kafka-compatible streaming lesson: thread-per-core reactors, shard-local partition ownership, Raft replication, and per-shard observability.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['thread per core', 'raft partitions'], defaultValue: 'thread per core' },
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

function shardGraph(title) {
  return graphState({
    nodes: [
      { id: 'producer', label: 'producer', x: 0.7, y: 3.6, note: 'Kafka API' },
      { id: 'router', label: 'request router', x: 2.3, y: 3.6, note: 'key -> partition' },
      { id: 'core0', label: 'core 0 reactor', x: 4.2, y: 1.5, note: 'shard local' },
      { id: 'core1', label: 'core 1 reactor', x: 4.2, y: 3.6, note: 'shard local' },
      { id: 'core2', label: 'core 2 reactor', x: 4.2, y: 5.7, note: 'shard local' },
      { id: 'partA', label: 'partition A', x: 6.4, y: 1.5, note: 'owned by shard' },
      { id: 'partB', label: 'partition B', x: 6.4, y: 3.6, note: 'owned by shard' },
      { id: 'partC', label: 'partition C', x: 6.4, y: 5.7, note: 'owned by shard' },
      { id: 'disk', label: 'NVMe log', x: 8.4, y: 3.6, note: 'append + cache' },
    ],
    edges: [
      { id: 'e-producer-router', from: 'producer', to: 'router', weight: 'produce' },
      { id: 'e-router-core0', from: 'router', to: 'core0', weight: 'pA' },
      { id: 'e-router-core1', from: 'router', to: 'core1', weight: 'pB' },
      { id: 'e-router-core2', from: 'router', to: 'core2', weight: 'pC' },
      { id: 'e-core0-partA', from: 'core0', to: 'partA', weight: 'local calls' },
      { id: 'e-core1-partB', from: 'core1', to: 'partB', weight: 'local calls' },
      { id: 'e-core2-partC', from: 'core2', to: 'partC', weight: 'local calls' },
      { id: 'e-partA-disk', from: 'partA', to: 'disk', weight: 'append' },
      { id: 'e-partB-disk', from: 'partB', to: 'disk', weight: 'append' },
      { id: 'e-partC-disk', from: 'partC', to: 'disk', weight: 'append' },
    ],
  }, { title });
}

function raftGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.6, note: 'produce/fetch' },
      { id: 'leader', label: 'partition leader', x: 2.8, y: 2.1, note: 'Raft leader' },
      { id: 'f1', label: 'follower 1', x: 5.0, y: 1.3, note: 'replica' },
      { id: 'f2', label: 'follower 2', x: 5.0, y: 3.3, note: 'replica' },
      { id: 'quorum', label: 'quorum ack', x: 6.8, y: 2.3, note: 'commit' },
      { id: 'consumer', label: 'consumer', x: 8.7, y: 2.3, note: 'read committed' },
      { id: 'shardMetrics', label: 'shard metrics', x: 4.0, y: 5.5, note: 'core labels' },
      { id: 'backpressure', label: 'backpressure', x: 7.1, y: 5.5, note: 'queue + IO' },
    ],
    edges: [
      { id: 'e-client-leader', from: 'client', to: 'leader', weight: 'append' },
      { id: 'e-leader-f1', from: 'leader', to: 'f1', weight: 'replicate' },
      { id: 'e-leader-f2', from: 'leader', to: 'f2', weight: 'replicate' },
      { id: 'e-f1-quorum', from: 'f1', to: 'quorum', weight: 'ack' },
      { id: 'e-f2-quorum', from: 'f2', to: 'quorum', weight: 'ack' },
      { id: 'e-quorum-consumer', from: 'quorum', to: 'consumer', weight: 'visible' },
      { id: 'e-leader-metrics', from: 'leader', to: 'shardMetrics', weight: 'observe' },
      { id: 'e-backpressure-leader', from: 'backpressure', to: 'leader', weight: 'throttle' },
    ],
  }, { title });
}

function* threadPerCore() {
  yield {
    state: shardGraph('Redpanda routes Kafka API work to shard-local reactors'),
    highlight: { active: ['producer', 'router', 'core0', 'core1', 'core2'], found: ['partA', 'partB', 'partC'] },
    explanation: 'Redpanda exposes Kafka-compatible produce and fetch APIs, but internally it is organized around a thread-per-core model. Requests are routed to the shard that owns the target partition.',
    invariant: 'The fast path tries to keep partition state owned by one core instead of shared by many threads.',
  };

  yield {
    state: labelMatrix(
      'Shard ownership table',
      [
        { id: 'p0', label: 'o0' },
        { id: 'p1', label: 'o1' },
        { id: 'p2', label: 'p0' },
        { id: 'p3', label: 'c7' },
      ],
      [
        { id: 'core', label: 'core' },
        { id: 'hotPath', label: 'path' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['c0', 'append', 'skew'],
        ['c1', 'fetch', 'lag'],
        ['c2', 'compact', 'IO'],
        ['c0', 'hot', 'uneven'],
      ],
    ),
    highlight: { active: ['p0:core', 'p3:risk'], found: ['p2:hotPath'], compare: ['p1:risk'] },
    explanation: 'Shard-per-core turns ownership into a table: each partition maps to a core, and that core owns most of the partition hot path. This reduces lock contention but makes partition placement and key skew visible.',
  };

  yield {
    state: shardGraph('Locality is the data structure design constraint'),
    highlight: { active: ['core0', 'partA', 'e-core0-partA', 'partA', 'disk'], compare: ['e-router-core2', 'core2'] },
    explanation: 'A thread-per-core architecture rewards local data structures: per-core queues, per-shard caches, local allocators, and asynchronous IO. Cross-core messages are still possible, but they become an explicit cost rather than accidental sharing.',
  };

  yield {
    state: labelMatrix(
      'Thread-per-core tradeoffs',
      [
        { id: 'locks', label: 'L' },
        { id: 'cache', label: 'C' },
        { id: 'metrics', label: 'M' },
        { id: 'ops', label: 'O' },
      ],
      [
        { id: 'benefit', label: 'gain' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['low cont', 'plan'],
        ['local', 'xcore'],
        ['shard', 'dims'],
        ['cores', 'size'],
      ],
    ),
    highlight: { found: ['locks:benefit', 'cache:benefit'], active: ['metrics:cost', 'ops:cost'] },
    explanation: 'This architecture is not magic performance dust. It shifts the hard problems to shard placement, core sizing, async backpressure, observability labels, and avoiding blocking work inside reactors.',
  };
}

function* raftPartitions() {
  yield {
    state: raftGraph('Each partition is replicated through a Raft group'),
    highlight: { active: ['client', 'leader', 'f1', 'f2', 'e-leader-f1', 'e-leader-f2'], found: ['quorum'] },
    explanation: 'Redpanda replicates partitions with Raft. For one partition, the leader appends a record, replicates it to followers, and exposes committed data after quorum progress.',
  };

  yield {
    state: labelMatrix(
      'One write through the stack',
      [
        { id: 'api', label: 'API' },
        { id: 'shard', label: 'S' },
        { id: 'raft', label: 'R' },
        { id: 'disk', label: 'D' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'semantic', label: 'point' },
      ],
      [
        ['parse', 'contract'],
        ['enqueue', 'owner'],
        ['replicate', 'commit'],
        ['append', 'durable'],
      ],
    ),
    highlight: { active: ['raft:move', 'raft:semantic'], found: ['disk:semantic'], compare: ['api:semantic'] },
    explanation: 'The Kafka API surface and the internal Raft/storage machinery are separate layers. The produce request is successful only after the configured durability and quorum behavior agree.',
    invariant: 'Compatibility at the API does not imply identical internals.',
  };

  yield {
    state: raftGraph('Backpressure needs shard-level visibility'),
    highlight: { active: ['shardMetrics', 'backpressure', 'e-backpressure-leader'], compare: ['consumer'], found: ['leader'] },
    explanation: 'A partition can be slow because its core is hot, its Raft followers lag, its disk queue grows, or consumers fall behind. Thread-per-core designs make per-shard metrics important because averages hide the hot shard.',
  };

  yield {
    state: labelMatrix(
      'Incident triage checklist',
      [
        { id: 'skew', label: 'skew' },
        { id: 'raftLag', label: 'raft' },
        { id: 'diskQueue', label: 'disk' },
        { id: 'consumerLag', label: 'fetch' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'firstCheck', label: 'check' },
      ],
      [
        ['hot shard', 'map'],
        ['slow commit', 'foll'],
        ['slow app', 'IO'],
        ['lag', 'group'],
      ],
    ),
    highlight: { active: ['skew:symptom', 'raftLag:firstCheck'], found: ['diskQueue:firstCheck'], compare: ['consumerLag:symptom'] },
    explanation: 'A complete case study is diagnosing one overloaded partition. You need Kafka-level concepts, Raft-level replication, and reactor-level shard metrics at the same time.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'thread per core') yield* threadPerCore();
  else if (view === 'raft partitions') yield* raftPartitions();
  else throw new InputError('Pick a Redpanda view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Redpanda Seastar Shard-Per-Core Case Study. Redpanda as a Kafka-compatible streaming lesson: thread-per-core reactors, shard-local partition ownership, Raft replication, and per-shard observability..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A streaming broker sits in the middle of systems that cannot stop: payment events, click streams, metrics, audit logs, fraud signals, inventory updates, and machine telemetry. Producers append records, consumers fetch them later, and the broker has to preserve ordering rules, durability, and throughput while machines fail and traffic shifts. The broker is a storage engine, a replication system, a network server, and a scheduler at the same time.`,
        `Redpanda is useful as a case study because it keeps the Kafka-facing contract familiar while changing much of the internal machinery. Clients can use Kafka-compatible produce and fetch APIs. Internally, Redpanda is built on Seastar\'s shard-per-core model: cores run independent reactors, data structures are kept shard-local when possible, and cross-core communication is treated as a visible cost. Each topic partition becomes more than a logical label. It is a unit of placement, ownership, replication, storage, cache locality, and operational diagnosis.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The simple broker design is a pool of worker threads reading requests from shared queues and updating shared partition objects. That design is easy to explain and works at moderate scale, but the hidden data structures become expensive under load. Workers contend on locks. Cache lines bounce between cores. Allocators and request queues become shared choke points. One hot partition can poison the whole worker pool because every worker is allowed to touch everything.`,
        `Adding more threads does not automatically fix this. Past a point, the broker spends more time coordinating access to shared state than doing useful append, fetch, checksum, compression, and replication work. This is the wall that thread-per-core systems are trying to avoid. The question is not whether concurrency exists. The question is whether ownership is crisp enough that the hot path can run mostly without locks, remote cache misses, and surprise handoffs.`,
        `A partitioned log already gives the broker a natural ownership boundary. Kafka-style systems route records to partitions, and each partition has ordering and replication state. Redpanda leans into that boundary: if a shard owns a partition replica, the append path, fetch path, cache state, and Raft state should usually stay with that shard. Cross-core operations still happen, but they are deliberate messages rather than accidental shared-memory traffic.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Shard-per-core means the system is designed around per-core reactors instead of a general-purpose pool of interchangeable workers. A reactor owns an event loop on one core. It runs asynchronous tasks, issues nonblocking I/O, manages local queues, and touches local state. The design goal is not merely to use all cores. It is to make the unit of computation match the unit of data ownership.`,
        `For Redpanda, the important unit is the partition replica. A producer request is parsed at the Kafka API layer, routed to the partition, and then handled by the shard that owns that partition replica. That shard appends to the log, participates in Raft replication for that partition, serves fetches, and accounts for local resource use. The broker\'s data structures therefore form a map from topic partition to node, shard, log segments, cache state, and consensus state.`,
        `The same idea appears in the operational model. If a partition is hot, the owning shard is hot. If a follower is slow, the Raft group for that partition exposes lag. If disk queues grow, the affected shards and partitions need to be visible. Averages across the whole node can look healthy while one shard is overloaded. This is why per-shard and per-partition metrics are not decorative; they are how the architecture explains itself under pressure.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with a produce request. A client writes records to a topic. The key or partitioning rule chooses a partition. The broker routes the request to the shard that owns the leader replica for that partition. Once the request is on the owning shard, the fast path can operate on shard-local structures: append state, segment metadata, request queues, memory accounting, and cache entries.`,
        `Replication is partition-scoped. A partition leader appends records and replicates them to follower replicas. The record becomes visible according to the configured durability semantics when the replication and commit rules are satisfied. The important lesson is the layering: Kafka compatibility describes the client contract, while Raft and the storage engine implement the internal durability path. Compatibility at the protocol surface does not mean the internals have to mirror Apache Kafka\'s implementation choices.`,
        `Backpressure is also local before it is global. A shard can become busy because its partitions receive too many writes, because consumers fetch aggressively, because compaction or storage work competes for I/O, because followers lag, or because a key distribution concentrates traffic on one partition. The broker needs queues and admission control that can slow producers or reshape work before overloaded shards accumulate unbounded latency.`,
        `Seastar\'s asynchronous model matters here. Blocking inside a reactor is dangerous because it stalls all work owned by that core. The code has to express waits as asynchronous continuations and keep I/O, timers, and network work integrated with the reactor loop. That requirement changes how data structures are written. A simple mutex around shared state is often the wrong tool; local ownership plus message passing is the preferred shape.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The performance argument is locality. If one core repeatedly touches the same partition state, the CPU cache has a better chance of keeping useful data nearby. If only one shard mutates a partition\'s hot structures, the design avoids many locks and atomic updates. If cross-core calls are explicit, engineers can measure and reduce them instead of discovering them indirectly through latency spikes.`,
        `The correctness argument is scoped ownership. A partition already has strict ordering requirements, so it is a natural serialization point. The system does not need every core to concurrently mutate the same partition log. It needs the right core to process that partition quickly, replicate it safely, and expose committed data consistently. Shard ownership aligns the concurrency boundary with the ordering boundary.`,
        `The operating argument is diagnosability. In a thread-pool broker, an overloaded topic may appear as a vague rise in worker utilization, lock contention, and queue length. In a shard-per-core broker, the operator can ask sharper questions: which partition is hot, which shard owns it, whether the leader or follower is slow, whether disk queues or Raft lag are growing, and whether the traffic pattern is skewed. The data model points directly to the failure model.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a payments topic with 64 partitions spread across a three-node cluster. Most merchants produce a steady stream of authorization events, but one merchant starts a promotion and sends ten times its normal traffic. The partition for that merchant is led by shard 2 on node A. Cluster-wide CPU looks moderate because many shards are idle. The client, however, sees produce latency spike for that merchant\'s records.`,
        `A useful incident review follows the ownership chain. First, identify the hot topic partition from produce latency and throughput. Second, map that partition to its leader node and shard. Third, compare per-shard CPU, request queue depth, storage queue depth, Raft follower lag, and consumer lag. Fourth, decide whether the cause is key skew, insufficient partition count, slow followers, storage pressure, or a consumer pattern that is driving fetch pressure. The fix may be changing the key, splitting one merchant at the application layer, increasing partitions for future headroom, moving replicas, or scaling the cluster.`,
        `The educational point is that the logical partition and the physical core are connected. A bad key does not merely create an abstract imbalance in a hash table. It can overload a specific reactor, delay a specific Raft group, and make node-level averages misleading. This is why partition design is not an application-only concern in streaming systems. It reaches down into CPU scheduling and storage behavior.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Shard-per-core is not free performance. It demands careful placement, full-core sizing, nonblocking code, shard-aware metrics, and load balancing that respects ownership. A blocking call inside a reactor can hurt unrelated partitions on the same shard. A cross-core call in the hot path can erase the locality benefit. A single hot partition can make the cluster look underused while one core is saturated.`,
        `The model also moves complexity into operations. Teams need to know how partitions map to shards, how leaders and followers are distributed, how to read per-shard saturation, and how to separate client-facing latency from Raft lag or disk pressure. Autoscaling is harder than adding generic workers because the unit of work is stateful. Rebalancing partitions can help, but moving state has cost and can create its own load.`,
        `There are also workload limits. If an application needs strict ordering for a single very hot key, adding partitions does not automatically help because that key still maps to one ordered stream unless the application changes its model. If the workload is dominated by large scans or storage bandwidth, CPU-local ownership may not be the main bottleneck. If clients produce many small records with poor batching, network and per-request overhead can dominate. The architecture gives strong tools, but it does not remove the need for workload design.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Good evaluation combines client metrics, partition metrics, shard metrics, and replication metrics. Watch p50, p95, and p99 produce latency by topic and partition; per-shard CPU and queue depth; disk append latency and queueing; Raft commit latency and follower lag; consumer lag; batch size; compaction pressure; and key distribution. The dangerous pattern is a healthy node average hiding an unhealthy shard.`,
        `Primary sources: Redpanda architecture documentation at https://docs.redpanda.com/streaming/current/get-started/architecture/, Redpanda monitoring documentation at https://docs.redpanda.com/streaming/current/manage/monitoring/, Redpanda sizing guidance at https://docs.redpanda.com/streaming/current/deploy/redpanda/manual/sizing/, and Seastar at https://seastar.io/. Study Kafka Log Case Study, Raft Log Replication, Event Loop, Epoll Interest & Ready List Case Study, Sharding & Partitioning, Backpressure, and Consistent Hashing next.`,
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
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

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for redpanda-seastar-shard-per-core-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
