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
      heading: 'What it is',
      paragraphs: [
        'Redpanda is a Kafka-compatible streaming platform implemented with a thread-per-core architecture using Seastar. From the outside, producers and consumers can use Kafka APIs. Inside, partition work is assigned to shards that run on pinned cores, and partition replication uses Raft.',
        'This is a strong data-structures lesson because it makes locality explicit. A partition is not just a name in a topic. It has an owning shard, local queues, logs, cache state, replication state, and per-shard metrics. The architecture tries to avoid shared mutable state on the hot path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Producers write to topics, and records are routed to partitions. Redpanda assigns partition replicas to shards on nodes. The shard that owns a partition handles its append, fetch, replication, and storage work through asynchronous Seastar reactors.',
        'Replication is partition-scoped. A partition leader appends records, sends them to follower replicas, and advances the committed position when quorum rules are satisfied. The visible Kafka-like behavior sits above a storage and consensus layer that is tuned around local ownership.',
        'The contrast with ordinary thread-pool designs is the key idea. A thread pool can accidentally share locks, queues, caches, and allocator state across many workers. A shard-per-core design makes the ownership boundary explicit and pays cross-core communication only when the system actually crosses that boundary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Thread-per-core reduces lock contention but increases the importance of placement, full-core sizing, nonblocking code, and per-shard monitoring. A single hot partition can make one core look bad while node-level averages appear healthy. That is why shard labels and partition-level metrics matter.',
        'The architecture also changes operational failure modes. Raft lag, disk queues, request queues, cache pressure, and key skew can all surface as produce or fetch latency. Debugging requires moving between Kafka API semantics, partition placement, Raft replication, and reactor-level resource use.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A payments topic has 64 partitions across a three-node Redpanda cluster. Most keys hash evenly, but one merchant id becomes extremely hot. The partition for that merchant is owned by shard 2 on node A. Produce latency rises only for that partition, and node averages are misleading because other shards are idle.',
        'The team inspects per-shard CPU, partition throughput, Raft follower lag, and disk queue metrics. The fix may be a better key, an application-level split for the hot merchant, more partitions for future growth, or moving replicas. The important lesson is that the data structure boundary, the partition, maps onto a concrete CPU ownership boundary.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Kafka-compatible does not mean Kafka-identical. Clients can speak a familiar protocol, but the internal scheduling, memory, consensus, and storage design can be very different. Another misconception is that thread-per-core removes backpressure. It actually makes backpressure easier to localize, but overloaded shards still need throttling, queueing, and operational response.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Redpanda architecture documentation at https://docs.redpanda.com/streaming/current/get-started/architecture/, Redpanda monitoring documentation at https://docs.redpanda.com/streaming/current/manage/monitoring/, Redpanda sizing guidance at https://docs.redpanda.com/streaming/current/deploy/redpanda/manual/sizing/, and Seastar at https://seastar.io/. Study Kafka Log Case Study, Raft Log Replication, Event Loop, Epoll Interest & Ready List Case Study, Sharding & Partitioning, and Backpressure next.',
      ],
    },
  ],
};
