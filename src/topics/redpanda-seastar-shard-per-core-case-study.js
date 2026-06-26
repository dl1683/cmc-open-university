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
        'The animation follows a Kafka-compatible produce request through Redpanda. Active means the current component is handling the request, visited means routing or replication state has already constrained the path, and found means the owning shard, partition replica, or committed offset has been identified.',
        'The matrix views are ownership maps. The safe inference is that a partition replica belongs to one reactor at a time, so hot-path mutation is local to that core unless routing crosses a shard boundary.',
        {type:'callout', text:'Shard-per-core makes each partition replica owned by one reactor, trading hidden locks for explicit routing, placement, and backpressure boundaries.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A streaming broker must accept ordered records, replicate them durably, and serve consumers while machines fail. Producers care about latency, consumers care about replay, and operators care about understanding which partition is slow.',
        'Redpanda keeps the Kafka protocol but changes the internal execution model. It uses Seastar reactors, direct I/O, per-partition Raft, and shard-local ownership instead of a JVM thread-pool design.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious broker design is a worker pool. Network threads parse requests, request handlers pull work from queues, and any worker can lock a partition object to append records.',
        'This design is reasonable because it is simple and initially scales with threads. The operating system can schedule many workers, and shared structures make placement changes easy.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when shared mutable state becomes hotter than the useful append work. Workers contend for partition locks, cache lines bounce between cores, and allocator state becomes another shared bottleneck.',
        'Adding threads can then make tail latency worse. The broker spends more time coordinating access to partition state than checksumming, appending, replicating, or serving records.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Shard-per-core aligns the scheduling unit with the data ownership unit. Each CPU core runs one reactor, and each reactor owns a fixed set of partition replicas and their local state.',
        'Cross-core work becomes explicit message passing. The fast path is local mutation on the owning shard, while the slow path pays a visible submit-to hop to reach the correct core.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A produce request is decoded by the Kafka API layer and mapped to a topic partition. The router checks the partition-to-shard map and either calls the local partition handler or forwards the request to the owning reactor.',
        'The owning shard appends records to the partition log, advances local offsets, drives the per-partition Raft replication, and submits storage I/O through shard-owned queues. The request returns when the configured acknowledgment rule is satisfied.',
        'Backpressure also becomes local. A saturated shard can expose queue depth, scheduler runtime, memory pressure, and follower lag for exactly the partitions it owns.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A partition already requires serial order by offset. In a thread-pool design, a lock enforces that order; in shard-per-core, ownership enforces it because only one reactor mutates the partition state.',
        'The performance argument is locality. The same core repeatedly touches the same partition metadata, log buffers, allocator, and I/O queue, so fewer cache lines move between cores.',
        'The correctness claim is narrow. Redpanda still synchronizes metadata, routes cross-core requests, and replicates across nodes, but the single-partition append fast path avoids shared partition mutation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The asymptotic cost of a produce request is still an amortized append plus replication to the configured followers. The gain is in constants, cache behavior, and p99 latency.',
        'The tax is that hot-path code must be asynchronous and nonblocking. One synchronous disk read, DNS lookup, compression call, or logging path can stall every partition on that reactor.',
        'Doubling cores can nearly double capacity only when partitions are evenly placed. If one hot partition owns 40 percent of traffic, the owning shard is the bottleneck no matter how many idle cores sit nearby.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Shard-per-core works well for event streams, time-series ingestion, per-tenant logs, queues, and databases where each request maps to a known shard. It appears in Redpanda, ScyllaDB, Seastar-based services, packet-processing systems, and thread-local proxy designs.',
        'The pattern is strongest on core-dense machines where lock contention and cache-line movement dominate. It is also useful when observability can expose per-shard and per-partition metrics.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Shard-per-core fails under key skew. If one partition receives most traffic, it is pinned to one reactor and can saturate while other reactors stay idle.',
        'It also fails when code paths block or when cross-core traffic becomes the common case. The design removes hidden locks from the hot path, but it cannot make frequent remote ownership free.',
        'Operationally, it fails if dashboards average away the point of the design. Node-level CPU can look healthy while one shard is at 97 percent and one partition has 200 ms p99 produce latency.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payments topic has 64 partitions on a three-node Redpanda cluster with 16 cores per node and replication factor 3. Normal traffic is 2,000 records per second per partition, and produce p99 is 4 ms.',
        'A flash sale sends one merchant to 20,000 records per second, all hashing to partition 23 on node A shard 7. Cluster CPU moves from 35 percent to 38 percent, but shard 7 reaches 97 percent and partition 23 p99 rises to 210 ms.',
        'The diagnosis follows ownership. Client latency points to partition 23, the partition map points to shard 7, shard metrics show saturation, and the fix is re-keying, increasing partitions, moving replicas, or redistributing traffic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Redpanda architecture docs at https://docs.redpanda.com/current/get-started/architecture/, Seastar docs at https://seastar.io/, Redpanda monitoring docs at https://docs.redpanda.com/current/manage/monitoring/, and Redpanda hardware sizing docs. These define shard-per-core ownership, reactors, Raft placement, and observability.',
        'Study Event Loop, Sharding and Partitioning, Raft Log Replication, Backpressure, epoll and io_uring, Kafka Log Case Study, Consistent Hashing, and ScyllaDB shard-per-core design. The transfer lesson is that ownership boundaries are performance boundaries.',
      ],
    },
  ],
};
