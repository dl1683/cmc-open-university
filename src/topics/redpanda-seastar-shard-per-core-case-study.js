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
        'The animation traces a produce request through Redpanda\'s shard-per-core architecture. Two views show different layers of the same system.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the component handling work right now -- the producer, the request router, or the shard reactor currently processing.',
            'Found nodes are the partition replicas and storage targets that own the data after routing completes.',
            'Compare nodes highlight cross-core paths -- the explicit cost that shard-per-core makes visible instead of hiding behind locks.',
          ],
        },
        'The "thread per core" view shows how a Kafka API request reaches the correct shard reactor and stays local. The "raft partitions" view shows how that shard replicates data through a per-partition Raft group and where backpressure surfaces.',
        {
          type: 'note',
          text: 'The matrix views are ownership tables. Each row is a partition or a lifecycle stage. Read them as the mapping that determines which core handles which work -- and where skew, lag, or I/O pressure appears.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A streaming broker sits between producers that cannot pause and consumers that cannot lose data. Payment authorizations, click streams, sensor telemetry, fraud signals, audit logs -- all arrive as ordered append-only records that must be durable, replicated, and retrievable at high throughput while machines fail and traffic shifts.',
        {
          type: 'quote',
          text: 'Redpanda is a Kafka-compatible streaming data platform that is less complex, faster, and more affordable than Apache Kafka.',
          attribution: 'Redpanda documentation, "Introduction to Redpanda"',
        },
        'Redpanda keeps the Kafka wire protocol so existing clients, connectors, and tooling work unchanged. The internal design is different. Where Apache Kafka uses the JVM, page cache, ZooKeeper (or KRaft), and a thread-pool model, Redpanda is a single C++ binary built on the Seastar framework: one reactor per CPU core, shard-local data structures, per-partition Raft consensus, and direct I/O to NVMe.',
        {
          type: 'table',
          headers: ['Dimension', 'Apache Kafka', 'Redpanda'],
          rows: [
            ['Runtime', 'JVM (GC pauses, heap tuning)', 'C++ (no GC, manual memory management)'],
            ['Threading', 'Thread pool with shared partition state', 'One reactor per core, shard-local ownership'],
            ['Consensus', 'KRaft (cluster-level controller quorum)', 'Per-partition Raft groups'],
            ['Storage I/O', 'Page cache (OS-managed), buffered I/O', 'Direct I/O (io_uring/AIO), write-ahead log'],
            ['Coordination', 'ZooKeeper or KRaft controller', 'Internal Raft for metadata and data'],
            ['Dependencies', 'JVM + ZooKeeper/KRaft + OS page cache', 'Single self-contained binary'],
          ],
        },
        'The case study value is the architectural decision: aligning the unit of computation (a CPU core) with the unit of data ownership (a partition replica). That alignment changes how the broker handles concurrency, how it exposes failure, and how operators diagnose it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural broker design is a thread pool. Worker threads pull requests from a shared queue. Each request names a topic-partition. The worker acquires a lock on the partition object, appends the record, releases the lock, and returns to the queue for the next request.',
        {
          type: 'diagram',
          text: [
            '  producers ---> [ shared request queue ]',
            '                      |   |   |',
            '                    w0   w1   w2   (worker threads)',
            '                      \\   |   /',
            '                  [ partition A ]  <-- mutex',
            '                  [ partition B ]  <-- mutex',
            '                  [ partition C ]  <-- mutex',
            '',
            '  Any worker can touch any partition.',
            '  Every partition needs a lock.',
          ].join('\n'),
          label: 'Thread-pool broker: workers are interchangeable, partitions are shared',
        },
        'This design is reasonable. It is simple to implement, easy to reason about at low scale, and lets the OS scheduler distribute work across cores. Most message brokers and databases start here. Adding workers initially adds throughput because the bottleneck is I/O wait, and idle threads can absorb it.',
        {
          type: 'note',
          text: 'Apache Kafka uses a network-thread pool to read requests and a request-handler pool to process them, with I/O threads for replication. The partition state (log segments, offsets, leader epoch) is shared mutable state protected by locks. This is a well-tested design that works at very large scale, but it accepts lock contention and cache-line sharing as the cost of simplicity.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The thread-pool model hides three costs that grow with core count and partition density.',
        {
          type: 'table',
          headers: ['Hidden cost', 'Mechanism', 'When it bites'],
          rows: [
            ['Lock contention', 'Multiple workers racing to append to the same partition hold and release a mutex; losers spin or sleep', 'Hot partitions under high produce rate; the lock serializes work that could be pipelined'],
            ['Cache-line bouncing', 'When core 3 writes partition metadata that core 7 just read, the cache line is invalidated across sockets via the coherence protocol', 'Any shared mutable structure touched by multiple cores; invisible in profiles, visible in IPC counters'],
            ['Allocator contention', 'A global malloc lock or arena becomes a bottleneck when many threads allocate and free request buffers concurrently', 'High request rates on many-core machines (32+ cores); glibc malloc historically serializes arenas'],
          ],
        },
        'Adding threads past the I/O saturation point does not help. The broker spends more cycles coordinating access to shared state than doing useful work -- appending, checksumming, compressing, replicating. On a 64-core machine with thousands of partitions, a thread-pool broker can reach a state where aggregate CPU utilization looks moderate but produce latency climbs because individual workers are blocked on locks or stalled by cache misses.',
        {
          type: 'diagram',
          text: [
            '  Throughput vs. thread count (hot partition):',
            '',
            '  throughput',
            '    |       .----*----.',
            '    |      /           \\',
            '    |     /             \\  <-- contention overhead',
            '    |    /               \\     exceeds parallelism gain',
            '    |   /                 \\',
            '    |  /                   \\___',
            '    | /                        \\___',
            '    |/                              ',
            '    +--------------------------------> threads',
            '         sweet spot    degradation',
          ].join('\n'),
          label: 'Past the inflection point, more threads increase coordination cost faster than throughput',
        },
        'A partitioned log already provides a natural ownership boundary. Each partition has its own ordering, its own offset sequence, its own replication group. Redpanda asks: if the data is already partitioned, why not partition the compute to match?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Shard-per-core means each CPU core runs one reactor, and each reactor owns a fixed set of partition replicas. There is no shared partition state between cores. The data structure boundary (partition) aligns with the scheduling boundary (core).',
        {
          type: 'diagram',
          text: [
            '  Seastar shard-per-core layout:',
            '',
            '  core 0 reactor          core 1 reactor          core 2 reactor',
            '  +-----------------+     +-----------------+     +-----------------+',
            '  | event loop      |     | event loop      |     | event loop      |',
            '  | partition A     |     | partition B     |     | partition C     |',
            '  | partition D     |     | partition E     |     | partition F     |',
            '  | local allocator |     | local allocator |     | local allocator |',
            '  | local cache     |     | local cache     |     | local cache     |',
            '  | I/O scheduler   |     | I/O scheduler   |     | I/O scheduler   |',
            '  +-----------------+     +-----------------+     +-----------------+',
            '          |                       |                       |',
            '          v                       v                       v',
            '       NVMe queue 0           NVMe queue 1           NVMe queue 2',
            '',
            '  Cross-core: explicit message passing (Seastar submit_to())',
            '  Within core: direct function calls, no locks',
          ].join('\n'),
          label: 'Each core is a self-contained unit: its own partitions, allocator, cache, and I/O queue',
        },
        'The reactor runs a tight event loop: poll for network I/O, run ready tasks (produce handlers, fetch handlers, Raft replication steps, compaction work), submit disk I/O, repeat. Blocking is forbidden. Every wait is expressed as a Seastar future/promise that yields back to the event loop.',
        {
          type: 'code',
          language: 'cpp',
          text: [
            '// Simplified Seastar reactor loop (pseudocode)',
            'void reactor::run() {',
            '  while (!stopped) {',
            '    poll_network_queues();      // epoll/io_uring completions',
            '    run_ready_tasks();          // produce, fetch, raft, compact',
            '    submit_pending_io();        // NVMe write/read via io_uring',
            '    check_timers();             // heartbeats, request timeouts',
            '    // NEVER block, NEVER acquire a cross-core lock',
            '  }',
            '}',
          ].join('\n'),
          label: 'The reactor never blocks; every I/O wait becomes a future that resumes later',
        },
        'When a produce request arrives for a partition owned by a different core, the request router uses Seastar\'s submit_to() to forward it. This cross-core hop is an explicit, measurable message -- not a hidden lock acquisition. The fast path (request arrives at the core that owns the target partition) avoids the hop entirely.',
        {
          type: 'note',
          text: 'Seastar was originally built for ScyllaDB (a shard-per-core Cassandra replacement). Redpanda adopted the same framework and the same architectural principle: if you can make data ownership match core ownership, you can eliminate most synchronization from the hot path.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Follow a single produce request through the stack.',
        {
          type: 'table',
          headers: ['Stage', 'Component', 'What happens', 'Ownership rule'],
          rows: [
            ['1. Parse', 'Kafka API layer', 'Decode the produce request; extract topic, partition, records', 'The connection is pinned to one core\'s reactor'],
            ['2. Route', 'Request router', 'Map partition to owning shard; if local, call directly; if remote, submit_to()', 'Partition-to-shard map is replicated on all cores'],
            ['3. Append', 'Partition leader (shard-local)', 'Append records to the in-memory batch; update offset index', 'Only the owning shard mutates this state -- no lock needed'],
            ['4. Replicate', 'Raft group', 'Send AppendEntries to follower replicas on other nodes', 'Each partition has its own Raft group; leader is on the owning shard'],
            ['5. Commit', 'Raft quorum', 'Followers acknowledge; leader advances commit index', 'Produce response waits for acks=all or acks=1 per client config'],
            ['6. Flush', 'Storage layer', 'Batch is written to an NVMe log segment via direct I/O (io_uring)', 'Each shard has its own I/O submission queue'],
            ['7. Respond', 'Kafka API layer', 'Return offset to the client', 'Same core that parsed the request sends the response'],
          ],
        },
        'The critical property is that stages 3, 4, and 6 -- the expensive work -- happen on the shard that owns the partition. No lock is acquired on the append path. No cache line is shared with another core for the in-memory log state. The allocator is shard-local. The I/O submission queue is shard-local.',
        {
          type: 'code',
          language: 'cpp',
          text: [
            '// Simplified cross-core routing in Redpanda (pseudocode)',
            'future<produce_response> handle_produce(produce_request req) {',
            '  auto shard = partition_shard_map.shard_for(req.topic, req.partition);',
            '  if (shard == this_shard_id()) {',
            '    // Fast path: partition is local, no cross-core hop',
            '    return do_local_append(req);',
            '  }',
            '  // Slow path: forward to owning shard via message passing',
            '  return smp::submit_to(shard, [req = std::move(req)] {',
            '    return do_local_append(req);',
            '  });',
            '}',
          ].join('\n'),
          label: 'The fast path is a direct function call. The slow path is an explicit cross-core message.',
        },
        'Replication uses per-partition Raft groups. Unlike Apache Kafka, which uses a leader-follower model with ISR (in-sync replicas) tracked at the controller level, Redpanda gives each partition its own Raft state machine. The leader shard drives AppendEntries, tracks follower progress, and advances the commit index. This means each partition\'s durability guarantee is self-contained.',
        {
          type: 'diagram',
          text: [
            '  Per-partition Raft group (partition 7, replication factor 3):',
            '',
            '  Node A, shard 2 (leader)     Node B, shard 5 (follower)     Node C, shard 1 (follower)',
            '  +--------------------+       +--------------------+         +--------------------+',
            '  | log: [0..1847]     |  ---> | log: [0..1845]     |         | log: [0..1847]     |',
            '  | commit: 1847      |       | commit: 1845       |         | commit: 1847       |',
            '  | term: 4           |       | term: 4            |         | term: 4            |',
            '  +--------------------+       +--------------------+         +--------------------+',
            '                                     ^',
            '                                     |',
            '                                  2 entries behind (follower lag)',
          ].join('\n'),
          label: 'Each partition has independent Raft state; follower lag is per-partition, not cluster-wide',
        },
        'Backpressure is shard-local before it is cluster-wide. Each reactor tracks its own request queue depth, I/O submission queue depth, and memory usage. When a shard is overloaded, it can reject or delay new requests for its partitions without affecting other shards. This is possible because the shard boundary is the ownership boundary -- the overloaded shard knows exactly which partitions are contributing to pressure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three arguments support the design: performance through locality, correctness through ownership, and operability through visibility.',
        {
          type: 'table',
          headers: ['Argument', 'Mechanism', 'What it eliminates'],
          rows: [
            ['Cache locality', 'One core repeatedly touches the same partition metadata, log buffers, and index entries', 'Cache-line bouncing between cores; L1/L2 misses on hot structures'],
            ['Lock elimination', 'Only one core mutates a partition\'s state; no concurrent writers', 'Mutex contention, spinlock waste, priority inversion on partition locks'],
            ['Allocator locality', 'Each shard has its own memory pool; allocation and deallocation stay on one core', 'Global malloc lock contention; false sharing on arena headers'],
            ['I/O isolation', 'Each shard submits I/O to its own NVMe queue; I/O scheduling is per-core', 'I/O priority inversion between partitions on different shards; head-of-line blocking'],
            ['Diagnosis precision', 'Metrics are labeled by shard and partition; a hot shard is a hot set of partitions', 'Cluster-wide averages that mask localized overload'],
          ],
        },
        'The correctness argument is subtle. A partition already requires strict ordering: records within a partition are totally ordered by offset. In a thread-pool broker, that ordering is enforced by a lock on the partition log. In a shard-per-core broker, the ordering is structural -- only one core appends to the partition, so the append sequence is inherently serial. The lock is replaced by architecture.',
        {
          type: 'note',
          text: 'This does not mean Redpanda has zero synchronization. Cross-core operations (request routing, metadata updates, partition rebalancing) use Seastar\'s message-passing primitives. Raft replication involves network I/O to other nodes. The claim is narrower: the single-partition append fast path -- the most frequent and latency-sensitive operation -- avoids cross-core synchronization.',
        },
        'The performance result is predictable latency. Because the reactor never blocks and the hot path avoids locks, tail latency is determined by I/O device speed and Raft quorum delay, not by thread scheduling jitter or lock wait times. Redpanda benchmarks typically show tighter p99 latency distributions than Kafka on equivalent hardware, especially under partition-dense workloads.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Shard-per-core does not change the asymptotic cost of streaming operations. Producing a record is still O(1) amortized append plus O(replication_factor) network hops. Consuming is still O(1) per record with an offset lookup. The gains are in constants and tail behavior.',
        {
          type: 'table',
          headers: ['Cost dimension', 'Thread-pool broker', 'Shard-per-core broker'],
          rows: [
            ['Produce latency (p50)', 'Low (fast path hits cache)', 'Low (same fast path, fewer cache misses)'],
            ['Produce latency (p99)', 'Higher (lock contention, GC pauses, thread scheduling)', 'Lower (no locks, no GC, deterministic reactor loop)'],
            ['Memory overhead', 'Shared structures + lock metadata + GC heap', 'Per-shard pools + no GC; slightly more total RSS due to per-core duplication'],
            ['Cross-core produce', 'Lock acquisition (hidden, varies)', 'Explicit message hop (~1-5 us via submit_to)'],
            ['Partition rebalance', 'Update lock-protected metadata', 'Move shard ownership + transfer state (heavier, but infrequent)'],
            ['Maximum partitions', 'Limited by lock contention and ZK/KRaft metadata', 'Limited by per-core memory and Raft group overhead'],
          ],
        },
        'The practical cost is implementation complexity. All code on the hot path must be fully asynchronous. A single blocking call -- a synchronous disk read, a DNS lookup, a slow compression call -- stalls every partition on that core. This rules out many off-the-shelf libraries and requires careful auditing of every code path in the reactor.',
        {
          type: 'note',
          text: 'Redpanda uses io_uring for asynchronous disk I/O on Linux. This avoids the older libaio path and gives the reactor direct submission and completion queue access per core. The storage layer writes log segments with direct I/O (O_DIRECT), bypassing the OS page cache entirely. This means Redpanda manages its own read cache in userspace, trading OS cache simplicity for predictable memory behavior.',
        },
        'Doubling the core count on a node roughly doubles the throughput capacity if partitions are evenly distributed across shards. But if partition distribution is skewed -- a common case when a few topics dominate traffic -- adding cores helps only if partitions are rebalanced to use them. The bottleneck shifts from CPU to partition placement.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payments company runs a "transactions" topic with 64 partitions across a three-node Redpanda cluster (16 cores per node, replication factor 3). Each merchant\'s events are keyed by merchant ID. Traffic is normally even: each partition handles about 2,000 records/second.',
        {
          type: 'table',
          headers: ['Metric', 'Normal state', 'During incident'],
          rows: [
            ['Cluster CPU (avg)', '35%', '38%'],
            ['Node A CPU (avg)', '36%', '42%'],
            ['Node A shard 7 CPU', '34%', '97%'],
            ['Partition 23 produce p99', '4 ms', '210 ms'],
            ['Partition 23 Raft commit p99', '3 ms', '45 ms'],
            ['Partition 23 follower lag', '0 entries', '1,200 entries'],
            ['Other partitions produce p99', '4 ms', '5 ms'],
          ],
        },
        'A large merchant launches a flash sale. Their traffic spikes 10x. All their events hash to partition 23, which is led by shard 7 on node A. Cluster-wide CPU barely moves. Node-level CPU looks slightly elevated. But shard 7 is saturated, and partition 23\'s produce latency spikes 50x.',
        {
          type: 'diagram',
          text: [
            '  Incident diagnosis chain:',
            '',
            '  Client sees: produce latency spike (merchant X)',
            '       |',
            '       v',
            '  Which partition? --> partition 23 (merchant ID hash)',
            '       |',
            '       v',
            '  Which node + shard? --> Node A, shard 7 (partition-shard map)',
            '       |',
            '       v',
            '  Shard 7 CPU? --> 97% (per-shard metric)',
            '       |',
            '       v',
            '  Root cause? --> Key skew: one merchant produces 10x normal',
            '       |',
            '       v',
            '  Fix options:',
            '    1. Re-key: add sub-key (merchant_id + timestamp_bucket)',
            '    2. Split: increase partition count (requires rebalance)',
            '    3. Move: reassign partition 23 to a less loaded shard',
            '    4. Scale: add a node and redistribute partitions',
          ].join('\n'),
          label: 'The ownership chain connects client symptoms to a specific core and a specific cause',
        },
        'The educational point: in a thread-pool broker, this incident would appear as a diffuse rise in lock contention and worker queue depth. Identifying partition 23 as the cause would require correlating application-level metrics with broker internals. In a shard-per-core broker, the diagnosis chain is structural: client latency leads to partition, partition leads to shard, shard metrics reveal saturation, and the cause (key skew) is visible in the partition throughput breakdown.',
        {
          type: 'note',
          text: 'The fix is not automatic. Shard-per-core makes the problem visible, but the solution still requires human judgment: re-keying changes application semantics, increasing partitions requires consumer group coordination, moving replicas has a data transfer cost. The architecture converts mystery latency into a specific, actionable diagnosis.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Shard-per-core is not unique to Redpanda. The same principle appears across high-performance systems where data ownership can be partitioned to match CPU cores.',
        {
          type: 'table',
          headers: ['System', 'Domain', 'How shard-per-core is applied'],
          rows: [
            ['ScyllaDB', 'Wide-column database (Cassandra compatible)', 'Each core owns a token range; requests are routed to the owning shard; local memory allocator and cache per core'],
            ['Redpanda', 'Streaming broker (Kafka compatible)', 'Each core owns partition replicas; Raft groups are shard-local; I/O queues are per-core'],
            ['DPDK (Data Plane Development Kit)', 'Network packet processing', 'Each core runs a poll-mode driver on dedicated NIC queues; packets are steered to cores by RSS hash'],
            ['Envoy (thread-local storage)', 'L7 proxy', 'Each worker thread owns its connection pool, route table snapshot, and stats counters; shared-nothing within the data plane'],
            ['Seastar (framework)', 'General-purpose async C++ framework', 'Provides the reactor loop, shard-local memory, cross-core messaging, and I/O scheduler that Redpanda and ScyllaDB build on'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Choose shard-per-core when the workload is partitionable (each request maps to a data shard), latency-sensitive (p99 matters more than average throughput), and core-dense (16+ cores per node where lock contention dominates).',
            'Avoid shard-per-core when the workload is dominated by large cross-partition scans, when data ownership changes frequently (high churn rebalancing), or when the team cannot commit to fully asynchronous code on every hot path.',
            'The pattern is strongest for append-heavy workloads with natural partitioning keys: event streams, time-series ingestion, per-user or per-device state, and message queuing.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Shard-per-core is not free performance. It trades one set of problems for another.',
        {
          type: 'table',
          headers: ['Failure mode', 'Why it happens', 'Mitigation'],
          rows: [
            ['Hot shard from key skew', 'One partition gets disproportionate traffic; since it is pinned to one core, that core saturates while others idle', 'Re-key at the application layer; increase partition count; or use a sub-partitioning scheme'],
            ['Blocking call in reactor', 'A synchronous library call, a slow DNS lookup, or an unguarded disk read stalls every partition on the shard', 'Audit all dependencies for async compatibility; wrap unavoidable blocking calls in a dedicated thread pool'],
            ['Cross-core amplification', 'A request pattern that frequently hits partitions on other cores turns every produce into a message hop', 'Improve partition placement; use connection affinity to route clients to the right core'],
            ['Partition rebalance cost', 'Moving a partition to a different shard requires transferring log segments and Raft state; this creates I/O load', 'Rebalance during low-traffic windows; use incremental transfer with rate limiting'],
            ['Per-core memory waste', 'Each shard pre-allocates its own memory pool; if partitions are unevenly distributed, some shards hold unused memory', 'Right-size per-shard memory based on partition count; monitor shard-level memory utilization'],
            ['Debugging complexity', 'Stack traces, profiling, and logging must be shard-aware; generic thread dumps are less useful', 'Use Seastar\'s per-shard task tracking; label all logs and metrics with shard ID'],
          ],
        },
        'The most dangerous failure is invisible: a healthy cluster average masking a saturated shard. If monitoring dashboards show only node-level CPU and latency, shard-per-core loses its main operational advantage. The architecture demands shard-level observability to be useful.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Prometheus query: find the hottest shard on each node',
            'topk(5,',
            '  rate(redpanda_scheduler_runtime_seconds_total[1m])',
            ') by (instance, shard)',
            '',
            '# Alert: any single shard above 85% utilization',
            'redpanda_scheduler_runtime_seconds_total',
            '  / redpanda_scheduler_time_total_seconds > 0.85',
          ].join('\n'),
          label: 'Shard-level monitoring queries that expose the hotspot thread-pool averages would hide',
        },
        'Workload limits remain. If one key must be strictly ordered (all events for one user in one partition), no amount of core-level optimization helps when that key is the hottest in the system. The partition is the serialization point, and the core is the execution point. Shard-per-core makes the bottleneck visible and local, but it cannot parallelize what the application requires to be serial.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary: Redpanda architecture documentation (https://docs.redpanda.com/streaming/current/get-started/architecture/) -- covers the shard-per-core model, partition ownership, Raft replication, and tiered storage.',
            'Framework: Seastar project (https://seastar.io/) -- the async C++ framework providing reactors, futures/promises, cross-core messaging, and per-core memory allocation.',
            'Monitoring: Redpanda monitoring guide (https://docs.redpanda.com/streaming/current/manage/monitoring/) -- per-shard and per-partition metrics, Prometheus integration, and alert thresholds.',
            'Sizing: Redpanda hardware sizing guide (https://docs.redpanda.com/streaming/current/deploy/redpanda/manual/sizing/) -- core count, memory, disk, and partition count recommendations.',
            'Comparison: "Kafka vs Redpanda Performance" benchmarks from Redpanda and independent sources -- latency distributions, throughput at partition density, tail latency under load.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Event Loop', 'Understand the reactor pattern that Seastar builds on: poll, dispatch, yield, repeat'],
            ['Prerequisite', 'Sharding & Partitioning', 'Understand hash-based and range-based partitioning before studying shard-per-core ownership'],
            ['Prerequisite', 'Raft Log Replication', 'Understand leader election, AppendEntries, and commit semantics before studying per-partition Raft'],
            ['Extension', 'Backpressure', 'Understand how shard-local queue depth and admission control prevent cascade failure'],
            ['Extension', 'Epoll Interest & Ready List Case Study', 'Understand the I/O multiplexing layer beneath the Seastar reactor (epoll, io_uring)'],
            ['Sibling case study', 'Kafka Log Case Study', 'Compare Kafka\'s JVM/page-cache/thread-pool design with Redpanda\'s C++/direct-I/O/shard-per-core design'],
            ['Contrast', 'Consistent Hashing', 'Understand how partition-to-node mapping works and how rebalancing minimizes data movement'],
          ],
        },
      ],
    },
  ],
};
