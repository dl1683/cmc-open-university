// Exchange operator parallel query execution: queues, repartitioning, and flow control.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'exchange-operator-parallel-query',
  title: 'Exchange Operator Parallel Query',
  category: 'Papers',
  summary: 'How parallel query engines insert exchange operators to move rows between workers, repartition by key, and keep producers from outrunning consumers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['vertical exchange', 'partitioned hash join', 'flow control'], defaultValue: 'partitioned hash join' },
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

function exchangeGraph(title, mode) {
  if (mode === 'partition') {
    return graphState({
      nodes: [
        { id: 'scan1', label: 'scan 1', x: 0.8, y: 1.3, note: 'orders' },
        { id: 'scan2', label: 'scan 2', x: 0.8, y: 3.5, note: 'orders' },
        { id: 'scan3', label: 'scan 3', x: 0.8, y: 5.7, note: 'orders' },
        { id: 'ex', label: 'exchange', x: 3.1, y: 3.5, note: 'hash key' },
        { id: 'p0', label: 'part 0', x: 5.5, y: 1.6, note: 'key % 3' },
        { id: 'p1', label: 'part 1', x: 5.5, y: 3.5, note: 'key % 3' },
        { id: 'p2', label: 'part 2', x: 5.5, y: 5.4, note: 'key % 3' },
        { id: 'join0', label: 'join 0', x: 8.0, y: 1.6, note: 'local hash' },
        { id: 'join1', label: 'join 1', x: 8.0, y: 3.5, note: 'local hash' },
        { id: 'join2', label: 'join 2', x: 8.0, y: 5.4, note: 'local hash' },
      ],
      edges: [
        { id: 'e-s1-ex', from: 'scan1', to: 'ex', weight: 'rows' },
        { id: 'e-s2-ex', from: 'scan2', to: 'ex', weight: 'rows' },
        { id: 'e-s3-ex', from: 'scan3', to: 'ex', weight: 'rows' },
        { id: 'e-ex-p0', from: 'ex', to: 'p0', weight: 'hash 0' },
        { id: 'e-ex-p1', from: 'ex', to: 'p1', weight: 'hash 1' },
        { id: 'e-ex-p2', from: 'ex', to: 'p2', weight: 'hash 2' },
        { id: 'e-p0-j0', from: 'p0', to: 'join0', weight: 'local' },
        { id: 'e-p1-j1', from: 'p1', to: 'join1', weight: 'local' },
        { id: 'e-p2-j2', from: 'p2', to: 'join2', weight: 'local' },
      ],
    }, { title });
  }

  return graphState({
    nodes: [
      { id: 'parent', label: 'parent', x: 0.8, y: 3.5, note: 'demands rows' },
      { id: 'ex', label: 'exchange', x: 2.8, y: 3.5, note: 'queue + flow' },
      { id: 'q1', label: 'q1', x: 4.7, y: 2.0, note: 'bounded' },
      { id: 'q2', label: 'q2', x: 4.7, y: 5.0, note: 'bounded' },
      { id: 'prod1', label: 'prod A', x: 7.0, y: 2.0, note: 'scan/filter' },
      { id: 'prod2', label: 'prod B', x: 7.0, y: 5.0, note: 'scan/filter' },
      { id: 'table', label: 'storage', x: 9.0, y: 3.5, note: 'shards' },
    ],
    edges: [
      { id: 'e-parent-ex', from: 'parent', to: 'ex', weight: 'next()' },
      { id: 'e-ex-q1', from: 'ex', to: 'q1', weight: 'dequeue' },
      { id: 'e-ex-q2', from: 'ex', to: 'q2', weight: 'dequeue' },
      { id: 'e-q1-prod1', from: 'q1', to: 'prod1', weight: 'credits' },
      { id: 'e-q2-prod2', from: 'q2', to: 'prod2', weight: 'credits' },
      { id: 'e-prod1-table', from: 'prod1', to: 'table', weight: 'scan' },
      { id: 'e-prod2-table', from: 'prod2', to: 'table', weight: 'scan' },
    ],
  }, { title });
}

function* verticalExchange() {
  const graph1 = exchangeGraph('Exchange bridges pull parents and parallel producers', 'vertical');
  const hl1 = { active: ['parent', 'ex', 'e-parent-ex'], compare: ['prod1', 'prod2'] };
  yield {
    state: graph1,
    highlight: hl1,
    explanation: `Exchange is the adapter between two execution styles. The ${graph1.nodes.length}-node graph shows ${hl1.active.length} active elements (parent, exchange, and their edge) while ${hl1.compare.length} producers (${hl1.compare.join(', ')}) wait below.`,
  };

  const hl2 = { active: ['prod1', 'prod2', 'q1', 'q2', 'e-q1-prod1', 'e-q2-prod2'], found: ['ex'] };
  yield {
    state: exchangeGraph('Producers fill bounded queues with result packets', 'vertical'),
    highlight: hl2,
    explanation: `The ${hl2.active.length} active elements show both producers (prod1, prod2) filling bounded queues (q1, q2). Exchange lets producers get ahead enough to overlap work, but not enough to materialize an unbounded intermediate result.`,
    invariant: `Exchange preserves the operator interface while hiding parallel execution behind it — ${hl2.found.length} found node (${hl2.found[0]}) mediates all traffic.`,
  };

  const hl3 = { active: ['q1', 'q2', 'ex', 'parent', 'e-ex-q1', 'e-ex-q2', 'e-parent-ex'], compare: ['table'] };
  yield {
    state: exchangeGraph('The parent drains rows as if nothing changed', 'vertical'),
    highlight: hl3,
    explanation: `The parent continues to call next across ${hl3.active.length} active elements — queues ${hl3.active[0]} and ${hl3.active[1]}, exchange, parent, and ${hl3.active.length - 4} edges. Exchange drains whichever queue has work, translates packets back into rows, and can preserve order or merge streams when the plan requires it.`,
  };

  const matRows = [
    { id: 'vertical', label: 'vertical' },
    { id: 'bushy', label: 'bushy' },
    { id: 'intra', label: 'intra-op' },
    { id: 'merge', label: 'merge' },
  ];
  const matCols = [
    { id: 'shape', label: 'shape' },
    { id: 'use', label: 'use' },
  ];
  const matValues = [
    ['child prod', 'overlap'],
    ['siblings', 'branches'],
    ['many cores', 'scan/join'],
    ['ordered', 'final'],
  ];
  const hl4 = { active: ['vertical:use', 'bushy:use', 'intra:use'], found: ['merge:use'] };
  yield {
    state: labelMatrix('Parallel forms', matRows, matCols, matValues),
    highlight: hl4,
    explanation: `The ${matRows.length}x${matCols.length} matrix covers ${matRows.map(r => r.label).join(', ')} forms. ${hl4.active.length} active cells (${hl4.active.map(c => c.split(':')[0]).join(', ')}) highlight common parallelism styles; ${hl4.found.length} found cell (${hl4.found[0].split(':')[0]}) shows the merge form used for final ordered output.`,
  };
}

function* partitionedHashJoin() {
  const pgraph = exchangeGraph('Repartition rows by join key before local joins', 'partition');
  const scanNodes = pgraph.nodes.filter(n => n.label.startsWith('scan'));
  const partNodes = pgraph.nodes.filter(n => n.label.startsWith('part'));
  const joinNodes = pgraph.nodes.filter(n => n.label.startsWith('join'));
  const hl1 = { active: ['scan1', 'scan2', 'scan3', 'ex', 'e-s1-ex', 'e-s2-ex', 'e-s3-ex'], compare: ['p0', 'p1', 'p2'] };
  yield {
    state: pgraph,
    highlight: hl1,
    explanation: `The ${pgraph.nodes.length}-node partition graph has ${scanNodes.length} scans feeding ${hl1.active.length} active elements into exchange. ${hl1.compare.length} partitions (${hl1.compare.join(', ')}) wait downstream to receive rows hashed by join key.`,
  };

  const hl2 = { active: ['ex', 'p0', 'p1', 'p2', 'e-ex-p0', 'e-ex-p1', 'e-ex-p2'], found: ['join0', 'join1', 'join2'] };
  yield {
    state: exchangeGraph('Each partition owns a disjoint key range', 'partition'),
    highlight: hl2,
    explanation: `After repartitioning, ${hl2.active.length} active elements route rows into ${partNodes.length} partitions. ${hl2.found.length} join nodes (${hl2.found.join(', ')}) each build and probe a local hash table for their key range.`,
    invariant: `Correct repartitioning is a hash-table invariant at cluster scale: ${hl2.found.length} joins each own a disjoint subset — equal keys must meet.`,
  };

  const hl3 = { active: ['join0', 'join1', 'join2', 'e-p0-j0', 'e-p1-j1', 'e-p2-j2'], compare: ['scan1', 'scan2', 'scan3'] };
  yield {
    state: exchangeGraph('Local hash joins run in parallel', 'partition'),
    highlight: hl3,
    explanation: `${joinNodes.length} joins and ${hl3.active.length - joinNodes.length} edges are active — the speedup comes from ${joinNodes.length} independent partitions. The failure mode is skew: one hot key can send most rows to one partition, turning ${hl3.compare.length} parallel scans into a long-tail task.`,
  };

  const matRows = [
    { id: 'query', label: 'query' },
    { id: 'exchange', label: 'exchange' },
    { id: 'skew', label: 'skew' },
    { id: 'repair', label: 'repair' },
  ];
  const matCols = [
    { id: 'evidence', label: 'evidence' },
    { id: 'move', label: 'move' },
  ];
  const matValues = [
    ['orders-users', 'hash key'],
    ['shuffle', 'co-locate'],
    ['hot tenant', 'straggle'],
    ['salt key', 'split'],
  ];
  const hl4 = { active: ['exchange:move', 'skew:evidence'], found: ['repair:move'] };
  yield {
    state: labelMatrix('Join case', matRows, matCols, matValues),
    highlight: hl4,
    explanation: `The ${matRows.length}x${matCols.length} matrix maps join scenarios. ${hl4.active.length} active cells highlight exchange movement and skew evidence (${matValues[2][0]}). The ${hl4.found[0].split(':')[0]} row shows the fix: ${matValues[3][0]} to ${matValues[3][1]} when one tenant dominates.`,
  };
}

function* flowControl() {
  const fgraph = exchangeGraph('Bounded queues keep producers honest', 'vertical');
  const queueNodes = fgraph.nodes.filter(n => n.id === 'q1' || n.id === 'q2');
  const prodNodes = fgraph.nodes.filter(n => n.id === 'prod1' || n.id === 'prod2');
  const hl1 = { active: ['q1', 'q2', 'prod1', 'prod2', 'e-q1-prod1', 'e-q2-prod2'], compare: ['parent'] };
  yield {
    state: fgraph,
    highlight: hl1,
    explanation: `Exchange is also a flow-control device across ${fgraph.nodes.length} nodes. ${hl1.active.length} active elements show ${queueNodes.length} bounded queues (${queueNodes.map(n => n.id).join(', ')}) fed by ${prodNodes.length} producers (${prodNodes.map(n => n.label).join(', ')}). If ${hl1.compare[0]} demand slows, producers cannot run arbitrarily far ahead.`,
  };

  const sigRows = [
    { id: 'credit', label: 'credit' },
    { id: 'queue', label: 'bounded queue' },
    { id: 'spill', label: 'spill' },
    { id: 'cancel', label: 'cancel' },
  ];
  const sigCols = [
    { id: 'meaning', label: 'meaning' },
    { id: 'risk', label: 'risk' },
  ];
  const sigValues = [
    ['N packets', 'slack'],
    ['BP wire', 'HOL block'],
    ['save RAM', 'extra IO'],
    ['stop prod', 'cleanup'],
  ];
  const hl2 = { active: ['credit:meaning', 'queue:meaning'], compare: ['spill:risk'], found: ['cancel:meaning'] };
  yield {
    state: labelMatrix('Flow signals', sigRows, sigCols, sigValues),
    highlight: hl2,
    explanation: `The ${sigRows.length}x${sigCols.length} matrix maps ${sigRows.length} flow signals. ${hl2.active.length} active cells highlight ${hl2.active.map(c => c.split(':')[0]).join(' and ')} meanings (${sigValues[0][0]}, ${sigValues[1][0]}). The ${hl2.compare[0].split(':')[0]} risk (${sigValues[2][1]}) warns of the tradeoff, while ${hl2.found[0].split(':')[0]} (${sigValues[3][0]}) is the last resort.`,
  };

  const hl3 = { active: ['parent', 'ex', 'q1', 'q2'], found: ['prod1', 'prod2'], compare: ['table'] };
  yield {
    state: exchangeGraph('Backpressure crosses the exchange boundary', 'vertical'),
    highlight: hl3,
    explanation: `Backpressure in query-executor clothing: ${hl3.active.length} active nodes (${hl3.active.join(', ')}) carry the slow-consumer signal to ${hl3.found.length} found producers (${hl3.found.join(', ')}), preventing a parallel plan from becoming an unbounded buffer backed by ${hl3.compare[0]}.`,
    invariant: `Parallelism without flow control is just a faster way to allocate too much memory — ${hl3.found.length} producers must respect ${hl3.active.length - 2} queue bounds.`,
  };

  const profRows = [
    { id: 'bytes', label: 'shuffle bytes' },
    { id: 'queueDepth', label: 'queue depth' },
    { id: 'skew', label: 'partition skew' },
    { id: 'spill', label: 'spill rate' },
  ];
  const profCols = [
    { id: 'symptom', label: 'symptom' },
    { id: 'diagnosis', label: 'diagnosis' },
  ];
  const profValues = [
    ['net hot', 'filter early'],
    ['full q', 'slow cons'],
    ['one slow', 'hot key'],
    ['disk', 'RAM press'],
  ];
  const hl4 = { active: ['bytes:diagnosis', 'queueDepth:diagnosis', 'skew:diagnosis'], found: ['spill:diagnosis'] };
  yield {
    state: labelMatrix('Profile clues', profRows, profCols, profValues),
    highlight: hl4,
    explanation: `The ${profRows.length}x${profCols.length} profile matrix covers ${profRows.map(r => r.label).join(', ')}. ${hl4.active.length} active diagnosis cells point to fixes (${profValues[0][1]}, ${profValues[1][1]}, ${profValues[2][1]}); the ${hl4.found[0].split(':')[0]} diagnosis (${profValues[3][1]}) reveals whether exchange created useful parallelism or just exposed the bottleneck.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'vertical exchange') yield* verticalExchange();
  else if (view === 'partitioned hash join') yield* partitionedHashJoin();
  else if (view === 'flow control') yield* flowControl();
  else throw new InputError('Pick an exchange-operator view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has three views, selectable from the dropdown. "Vertical exchange" shows a parent operator pulling rows through an exchange node backed by two parallel producers with bounded queues. "Partitioned hash join" shows three scanners feeding rows through an exchange that hashes them into three partitions, each feeding a local join. "Flow control" shows the same vertical layout but highlights backpressure signals: credits, queue bounds, and cancellation.',
        'Each step highlights active nodes and edges in the graph or matrix. Play through slowly the first time to follow which components are doing work at each moment.',
        {type: 'image', src: './assets/gifs/exchange-operator-parallel-query.gif', alt: 'Animated walkthrough of the exchange operator parallel query visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A query plan is a tree of operators. In the Volcano execution model (Goetz Graefe, 1994), each operator exposes an iterator interface: open, next, close. A parent calls next() on its child to pull one row at a time. This is clean and composable, but it is inherently single-threaded. One call chain, one core.',
        'Modern databases sit on machines with dozens of cores and clusters with hundreds of nodes. A single-threaded scan of a billion-row table wastes almost all available hardware. The exchange operator exists to insert parallelism into this iterator tree without rewriting every operator. It is the boundary where one thread becomes many, where local data becomes distributed, and where unbounded producer speed becomes controlled.',
        {
          type: `callout`,
          text: `Exchange is the control boundary that lets local query operators stay simple while data movement, worker orchestration, and backpressure become explicit plan nodes.`,
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to parallelize query execution is to make every operator parallel internally. A parallel scan would manage its own thread pool, a parallel join would coordinate its own hash table access, and a parallel sort would partition and merge inside its own code. Each operator would contain its own concurrency, synchronization, and failure handling.',
        'This duplicates the hardest parts of systems programming across every operator. Each one must handle thread lifecycle, memory bounding, partial failure, cancellation, and ordering guarantees. Worse, the query optimizer cannot reason about data distribution because movement is hidden inside operator internals. If the optimizer inserts a join after a scan, it has no way to express that the join needs data repartitioned by key before it can start.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The per-operator approach hits a wall on two fronts. First, correctness: a hash join produces wrong results if matching keys are split across workers but the join does not know it. A sort produces wrong output if partial results are not merged with the right ordering discipline. Every operator must solve distribution-dependent correctness individually, and getting any of them wrong is a silent data bug.',
        'Second, performance isolation: without explicit boundaries, a fast producer can allocate gigabytes of intermediate results while a slow consumer lags behind. The system has no single point where it can measure queue depth, apply backpressure, or spill to disk. Parallelism without flow control is just a faster way to run out of memory.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Graefe\'s insight in the Volcano parallel query model (1990) was to separate data movement from data manipulation. Keep every scan, join, sort, and aggregate as a purely local, single-threaded operator that processes whatever rows arrive through its iterator interface. Then insert a special operator, the exchange, at the points in the plan where the physical distribution must change.',
        'Exchange is not a queue. It is not a shuffle. It is a plan operator that changes the physical distribution property of a data stream. It can convert one stream into many (scatter), many streams into one (gather), unpartitioned data into hash-partitioned data (repartition), or asynchronous producers into a synchronous pull interface (vertical exchange). Every other operator stays local and sequential.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Exchange has three forms, each visible in the animation. A vertical exchange sits between a parent operator and parallel producers. The parent calls next() on the exchange, which owns a set of bounded queues. Each producer runs on its own thread, scanning its data partition and filling its queue with packets of rows. Exchange drains whichever queue has data ready, unpacks the packet, and returns rows one at a time to the parent. The parent never knows how many producers exist.',
        'A repartition exchange redistributes rows by a partitioning function. For a hash join on column user_id, exchange computes hash(user_id) mod N for each incoming row and sends it to the corresponding downstream partition. The invariant is strict: rows with equal join keys must land on the same partition. After repartitioning, each downstream join builds and probes a local hash table over its own partition only. No global coordination is needed during the join phase.',
        {
          type: `image`,
          src: `https://cdnd.selectdb.com/assets/images/Figure_10_en-e99cc952e6ef7e1500565bffbd73da18.png`,
          alt: `Bucket shuffle join routing rows into hash-selected buckets`,
          caption: `Bucket shuffle join is the same invariant in a production SQL engine: route rows by a hash rule so matching keys meet. Source: Apache Doris blog, https://doris.apache.org/blog/principle-of-Doris-SQL-parsing/`,
        },
        'A flow-control exchange adds backpressure. Each producer starts with a credit count, say 4 packets. When it exhausts its credits, it blocks until the consumer drains a packet and returns a credit. This bounds memory to (number of producers * credit count * packet size). If the consumer is slow, producers stop. If a producer is cancelled, exchange propagates the stop signal and cleans up its thread and queue.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Exchange works because it turns data distribution into a declarative plan property. The query optimizer annotates each edge in the plan with a distribution requirement: hash-partitioned by user_id, replicated, gathered to coordinator, or any-distribution. When adjacent operators disagree, the optimizer inserts an exchange to reconcile them. This is the same idea as type checking: if the types do not match, insert a cast.',
        'Correctness of a repartition exchange reduces to one invariant: rows with equal keys land on the same partition. If the hash function, partition count, and null handling are consistent between both sides of a join, every matching pair meets on exactly one worker. No pair is missed, no pair is duplicated. The local join on each worker is correct because its input is complete for its key range.',
        'Correctness of a merge exchange requires that each input stream is already sorted and that the merge respects the global ordering. Exchange performs an N-way merge, comparing the head of each queue and returning the smallest. This is correct if and only if each producer\'s output is individually sorted by the same key and direction.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exchange trades wall-clock time for resource overhead. The direct costs are serialization (packing rows into packets), memory (bounded queues per producer), network transfer (for distributed exchange), and synchronization (mutex or lock-free queue operations per packet). For a local exchange with 8 producers and 1024-row packets, the per-row overhead is roughly one mutex acquire per 1024 rows plus one memcpy per row into the packet buffer.',
        'The speedup from N-way parallelism is bounded by Amdahl\'s law applied to the serial fraction. If the exchange itself (draining, merging, routing) takes 10% of wall time, the maximum speedup from adding more producers approaches 10x regardless of core count. In practice, 4-16 way parallelism is common; beyond that, coordination costs and skew usually dominate.',
        'Queue sizing is a real tradeoff. Large queues (say 8 packets of 1024 rows) absorb producer jitter and allow overlap, but consume more memory and can hide downstream bottlenecks. Small queues (2 packets) keep memory tight but risk forcing producers and consumers into lockstep, where neither can make progress while the other works. Most engines default to 2-4 packets and let the operator spill to disk if memory pressure rises.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every major analytical database uses exchange or its equivalent. PostgreSQL\'s Gather and Gather Merge nodes are vertical exchanges. Spark\'s ShuffleExchange repartitions RDDs by key before joins and aggregations. SQL Server\'s Parallelism operator (Distribute Streams, Repartition Streams, Gather Streams) is Graefe\'s exchange directly. Snowflake, BigQuery, Redshift, and DuckDB all use the same decomposition internally.',
        'The pattern extends beyond SQL. MapReduce\'s shuffle phase is a batch-mode repartition exchange. Stream processing engines like Flink use network shuffles with credit-based flow control between task slots. Even ML pipeline parallelism (splitting model layers across devices) uses the same producer-queue-consumer structure with bounded buffers at the device boundary.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Skew is the primary failure mode. If one key value (a popular product, a default tenant ID, a null) accounts for 80% of rows, hashing by that key sends 80% of work to one partition. The other partitions finish quickly and sit idle. Wall-clock time equals the slowest partition, so the effective parallelism drops to nearly 1x. Fixes include salting the hot key (appending a random suffix, then aggregating the salt groups), broadcasting the small side of a join, or using adaptive query execution to detect skew at runtime and split overloaded partitions.',
        'Semantic failures are subtler. If the two sides of a join use different hash functions, different null-handling rules, or different partition counts without compatible routing, rows with equal keys land on different workers and the join silently misses matches. If a merge exchange does not verify input ordering, it produces a stream that looks sorted but contains out-of-order runs. These bugs produce wrong results, not crashes, and are hard to detect without end-to-end result validation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose we join an Orders table (12 million rows, columns order_id and user_id) with a Users table (1 million rows, column user_id) on user_id, using 4 workers. Without exchange, a single-threaded hash join builds a hash table on Users (1M rows, roughly 64 bytes per entry = 64 MB) and probes it with all 12M Orders rows. At 50 ns per probe, the probe phase alone takes 12M * 50 ns = 600 ms.',
        'With a repartition exchange using hash(user_id) mod 4, each worker receives roughly 3M Orders rows and 250K Users rows (assuming uniform distribution). Each worker builds a 16 MB hash table and probes it with 3M rows. Probe time per worker: 3M * 50 ns = 150 ms. The four workers run in parallel, so wall-clock probe time drops from 600 ms to 150 ms, a 4x speedup on the compute-bound phase.',
        'The exchange itself must ship all 12M Orders rows and 1M Users rows across the partition boundary. At 100 bytes per row and 10 Gbps network bandwidth, transferring 13M * 100 bytes = 1.3 GB takes about 1.04 seconds. With 4 producers each sending 325 MB, the transfer parallelizes to roughly 260 ms if the network bisection bandwidth is sufficient. Total wall time: 260 ms shuffle + 150 ms probe = 410 ms, versus 600 ms single-threaded. The shuffle cost is real but the probe speedup pays for it.',
        'Now introduce skew: user_id 0 appears in 6M of the 12M orders. Partition 0 receives 6M orders while partitions 1-3 split the remaining 6M evenly (2M each). Partition 0 takes 6M * 50 ns = 300 ms to probe. The other three finish in 100 ms each and wait. Wall-clock time is now 260 ms shuffle + 300 ms probe = 560 ms, only 7% faster than single-threaded. Salting user_id 0 into four sub-keys (0_a, 0_b, 0_c, 0_d) spreads its 6M rows across all partitions, restoring balanced probe times of roughly 150 ms each.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Goetz Graefe, "Encapsulation of Parallelism in the Volcano Query Processing System" (SIGMOD 1990). It introduced exchange as the single operator that encapsulates all parallel execution. Graefe\'s later survey "Query Evaluation Techniques for Large Databases" (ACM Computing Surveys, 1993) covers the full Volcano model including iterator protocol, exchange variants, and flow control.',
        'For related topics on this site: Volcano Iterator Query Execution covers the pull-based operator protocol that exchange extends. SQL Join Algorithms covers the hash join and sort-merge join operators that exchange enables to run in parallel. Backpressure covers the general theory of bounded-buffer flow control. Message Queues covers the producer-consumer buffering mechanics that exchange queues implement. Spark Adaptive Query Execution covers runtime skew detection and partition splitting.',
      ],
    },
  ],
};
