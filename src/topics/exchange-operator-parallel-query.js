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
  yield {
    state: exchangeGraph('Exchange bridges pull parents and parallel producers', 'vertical'),
    highlight: { active: ['parent', 'ex', 'e-parent-ex'], compare: ['prod1', 'prod2'] },
    explanation: 'Exchange is the adapter between two execution styles. The parent still wants next() rows; producers below the exchange want to run in parallel and fill queues.',
  };

  yield {
    state: exchangeGraph('Producers fill bounded queues with result packets', 'vertical'),
    highlight: { active: ['prod1', 'prod2', 'q1', 'q2', 'e-q1-prod1', 'e-q2-prod2'], found: ['ex'] },
    explanation: 'The queues are deliberately bounded. Exchange lets producers get ahead enough to overlap work, but not enough to materialize an unbounded intermediate result.',
    invariant: 'Exchange preserves the operator interface while hiding parallel execution behind it.',
  };

  yield {
    state: exchangeGraph('The parent drains rows as if nothing changed', 'vertical'),
    highlight: { active: ['q1', 'q2', 'ex', 'parent', 'e-ex-q1', 'e-ex-q2', 'e-parent-ex'], compare: ['table'] },
    explanation: 'The parent continues to call next. Exchange drains whichever queue has work, translates packets back into rows, and can preserve order or merge streams when the plan requires it.',
  };

  yield {
    state: labelMatrix(
      'Parallel forms',
      [
        { id: 'vertical', label: 'vertical' },
        { id: 'bushy', label: 'bushy' },
        { id: 'intra', label: 'intra-op' },
        { id: 'merge', label: 'merge' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'use', label: 'use' },
      ],
      [
        ['child prod', 'overlap'],
        ['siblings', 'branches'],
        ['many cores', 'scan/join'],
        ['ordered', 'final'],
      ],
    ),
    highlight: { active: ['vertical:use', 'bushy:use', 'intra:use'], found: ['merge:use'] },
    explanation: 'The old Volcano insight is still modern: keep data manipulation operators local and put the parallelism machinery in an exchange operator.',
  };
}

function* partitionedHashJoin() {
  yield {
    state: exchangeGraph('Repartition rows by join key before local joins', 'partition'),
    highlight: { active: ['scan1', 'scan2', 'scan3', 'ex', 'e-s1-ex', 'e-s2-ex', 'e-s3-ex'], compare: ['p0', 'p1', 'p2'] },
    explanation: 'For a parallel hash join, equal keys must meet. Exchange hashes each row by join key and routes it to the partition that will build or probe the local hash table.',
  };

  yield {
    state: exchangeGraph('Each partition owns a disjoint key range', 'partition'),
    highlight: { active: ['ex', 'p0', 'p1', 'p2', 'e-ex-p0', 'e-ex-p1', 'e-ex-p2'], found: ['join0', 'join1', 'join2'] },
    explanation: 'After repartitioning, each worker can build and probe a local hash table. No worker needs every row; it needs the rows for its key partition.',
    invariant: 'Correct repartitioning is a hash-table invariant at cluster scale: equal keys must meet.',
  };

  yield {
    state: exchangeGraph('Local hash joins run in parallel', 'partition'),
    highlight: { active: ['join0', 'join1', 'join2', 'e-p0-j0', 'e-p1-j1', 'e-p2-j2'], compare: ['scan1', 'scan2', 'scan3'] },
    explanation: 'The speedup comes from independent partitions. The failure mode is skew: one hot key can send most rows to one partition, turning a parallel join into a long-tail task.',
  };

  yield {
    state: labelMatrix(
      'Join case',
      [
        { id: 'query', label: 'query' },
        { id: 'exchange', label: 'exchange' },
        { id: 'skew', label: 'skew' },
        { id: 'repair', label: 'repair' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'move', label: 'move' },
      ],
      [
        ['orders-users', 'hash key'],
        ['shuffle', 'co-locate'],
        ['hot tenant', 'straggle'],
        ['salt key', 'split'],
      ],
    ),
    highlight: { active: ['exchange:move', 'skew:evidence'], found: ['repair:move'] },
    explanation: 'A warehouse join may be perfectly parallel until one tenant, user, or product dominates the key. Skew handling is the difference between theoretical parallelism and a query that actually finishes fast.',
  };
}

function* flowControl() {
  yield {
    state: exchangeGraph('Bounded queues keep producers honest', 'vertical'),
    highlight: { active: ['q1', 'q2', 'prod1', 'prod2', 'e-q1-prod1', 'e-q2-prod2'], compare: ['parent'] },
    explanation: 'Exchange is also a flow-control device. If parent demand slows or a queue fills, producers cannot run arbitrarily far ahead.',
  };

  yield {
    state: labelMatrix(
      'Flow signals',
      [
        { id: 'credit', label: 'credit' },
        { id: 'queue', label: 'bounded queue' },
        { id: 'spill', label: 'spill' },
        { id: 'cancel', label: 'cancel' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['N packets', 'slack'],
        ['BP wire', 'HOL block'],
        ['save RAM', 'extra IO'],
        ['stop prod', 'cleanup'],
      ],
    ),
    highlight: { active: ['credit:meaning', 'queue:meaning'], compare: ['spill:risk'], found: ['cancel:meaning'] },
    explanation: 'Flow control allows overlap without unbounded memory growth. Credits and bounded queues let producers get slightly ahead but not infinitely ahead.',
  };

  yield {
    state: exchangeGraph('Backpressure crosses the exchange boundary', 'vertical'),
    highlight: { active: ['parent', 'ex', 'q1', 'q2'], found: ['prod1', 'prod2'], compare: ['table'] },
    explanation: 'This is Backpressure in query-executor clothing. The slow consumer signal moves through exchange to producers, preventing a parallel plan from becoming an unbounded buffer.',
    invariant: 'Parallelism without flow control is just a faster way to allocate too much memory.',
  };

  yield {
    state: labelMatrix(
      'Profile clues',
      [
        { id: 'bytes', label: 'shuffle bytes' },
        { id: 'queueDepth', label: 'queue depth' },
        { id: 'skew', label: 'partition skew' },
        { id: 'spill', label: 'spill rate' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'diagnosis', label: 'diagnosis' },
      ],
      [
        ['net hot', 'filter early'],
        ['full q', 'slow cons'],
        ['one slow', 'hot key'],
        ['disk', 'RAM press'],
      ],
    ),
    highlight: { active: ['bytes:diagnosis', 'queueDepth:diagnosis', 'skew:diagnosis'], found: ['spill:diagnosis'] },
    explanation: 'The profile clues are the real production view. Shuffle bytes, queue depth, partition skew, and spill rate tell you whether exchange created useful parallelism or just exposed the bottleneck.',
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
      heading: 'Why this exists',
      paragraphs: [
        `A query plan is a dataflow graph, but many classic executors expose it through a simple iterator contract: a parent asks its child for the next row. That contract is easy to compose, but it is not enough when a scan, join, or aggregation should run on many cores or many machines at once.`,
        {
          type: `callout`,
          text: `Exchange is the control boundary that lets local query operators stay simple while data movement, worker orchestration, and backpressure become explicit plan nodes.`,
        },
        `The exchange operator exists to hide that parallel machinery behind a normal plan node. It can start producers, move rows between workers, repartition by key, merge streams, buffer packets, and apply backpressure. The rest of the plan can still look like a tree of operators instead of a pile of thread, queue, and network code.`,
      ],
    },
    {
      heading: 'The obvious solution',
      paragraphs: [
        `The obvious way to parallelize a database engine is to teach every physical operator about threads, remote workers, queues, cancellation, and network transfer. A parallel scan would own one version of that logic. A parallel join would own another. Sort, aggregate, and distinct would each grow their own orchestration layer.`,
        `That fails because parallel control logic is hard and cross-cutting. Every operator would need to solve lifecycle, flow control, failures, memory bounds, and ordering. The code becomes duplicated, and worse, the query optimizer loses a clean way to reason about where data must move. Exchange localizes the movement and control boundary so ordinary operators can stay focused on local computation.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight from Volcano-style execution is encapsulation. Keep normal data-manipulation operators as local as possible, and insert exchange operators where the plan needs a change in execution mode. A parent can remain demand-driven while children run as parallel producers. A local join can remain local after exchange has arranged for all equal keys to meet on the same worker.`,
        `Exchange is therefore not just a queue and not just a shuffle. It is the operator that changes a plan's physical distribution. It can convert one stream into many, many streams into one, local partitions into hash partitions, or asynchronous producers into a synchronous parent interface.`,
      ],
    },
    {
      heading: 'Vertical exchange',
      paragraphs: [
        `A vertical exchange sits between a parent operator and one or more producer operators. The parent still asks for rows. Below the exchange, producers can scan partitions, apply filters, and fill bounded queues in parallel. Exchange drains those queues and returns rows through the expected interface.`,
        `This form is useful when the plan shape above the exchange should not care how many workers are below it. The parent sees one child. The exchange owns worker startup, row packetization, queue draining, cancellation, and end-of-stream detection. If the parent requires order, exchange also owns the merge policy instead of returning whichever packet happened to arrive first.`,
      ],
    },
    {
      heading: 'Repartition exchange',
      paragraphs: [
        `A repartition exchange sends each row to a worker chosen by a partitioning function. For a parallel hash join, the usual function hashes the join key. The invariant is simple and strict: equal keys must meet. If rows with the same key land on different workers, local joins miss matches and the query is wrong.`,
        {
          type: `image`,
          src: `https://cdnd.selectdb.com/assets/images/Figure_10_en-e99cc952e6ef7e1500565bffbd73da18.png`,
          alt: `Bucket shuffle join routing rows into hash-selected buckets`,
          caption: `Bucket shuffle join is the same invariant in a production SQL engine: route rows by a hash rule so matching keys meet. Source: Apache Doris blog, https://doris.apache.org/blog/principle-of-Doris-SQL-parsing/`,
        },
        `The same shape appears in group by, distinct, distributed aggregation, and windowed systems. The exchange does the global movement so the downstream operator can be local again. After repartitioning, each join worker builds or probes a hash table for its own partition instead of needing every row in the cluster.`,
      ],
    },
    {
      heading: 'Flow control',
      paragraphs: [
        `Exchange also controls how far producers may run ahead of consumers. Without bounded queues or credits, a fast scan can materialize a huge intermediate result while a slow parent is still processing earlier rows. That is not useful parallelism. It is memory pressure wearing a useful name.`,
        `Bounded queues, credit counts, spill policies, and cancellation signals make the plan self-limiting. If the parent slows down, queues fill. When queues fill, producers stop receiving credits or block at the boundary. This lets the query overlap work while still carrying backpressure toward the source.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The vertical-exchange view proves that the parent interface can stay stable while execution below it becomes parallel. Parent demand enters one exchange node. Producer work happens behind queues. The boundary is the point where asynchronous packets become rows again.`,
        `The partitioned-hash-join view proves the key distribution rule. Scans feed rows to exchange, exchange hashes them to partitions, and each local join owns a disjoint key subset. The flow-control view proves that useful exchange includes pressure signals, not just movement. Bounded queues are the difference between overlapped execution and unbounded materialization.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Exchange works because it makes distribution a first-class physical property. The optimizer can choose a plan that says this stream is hash partitioned by user_id, this one is gathered to a single coordinator, and this one remains locally partitioned. Operators then declare what distribution they require or preserve.`,
        `Correctness comes from matching those properties. A hash join is correct after repartitioning only if both sides use the same key expression, hash compatibility, null policy, and partition count or compatible routing. A merge exchange is correct only if each input stream is ordered and the merge respects the global order the parent requires.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Exchange buys wall-clock speed by spending CPU, memory, serialization, network, coordination, and sometimes disk. The best case is balanced partitions with heavy local work after the shuffle. The worst case is shuffling many bytes to perform little computation, or sending most rows to one hot partition while other workers wait.`,
        `Queue sizing is a real tradeoff. Large queues allow more overlap and absorb jitter, but they increase memory footprint and can hide downstream slowness. Tiny queues keep memory tight but may force producers and consumers into lockstep. Spill protects memory at the cost of extra IO and more complicated cleanup.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Exchange wins when data movement creates independent local work. Parallel hash join, large group by, distributed distinct, fanout scans, partial aggregation trees, and sorted stream merging all use the same idea. The plan pays movement cost once so several workers can make progress at the same time.`,
        `It also wins as an engineering boundary. Engines can improve queue implementations, packet formats, metrics, cancellation, spilling, and network transport inside exchange without rewriting every join or aggregate. That is why the old Volcano idea still appears inside modern vectorized, distributed, and cloud data systems.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Skew is the classic failure. If one tenant, product, or user owns a huge share of rows, hashing by that key creates one overloaded partition. Salting hot keys, splitting heavy partitions, broadcasting a small side, or using adaptive query execution can repair the plan, but only after the engine detects the imbalance.`,
        `Other failures are semantic. The plan may repartition on the wrong expression, lose required order, allow producers to outrun memory, fail to propagate cancellation, or leak child workers after an error. A query that is slow because of exchange should be diagnosed with shuffle bytes, partition sizes, queue depth, blocked time, spill rate, and final reducer time before blaming the local join algorithm.`,
      ],
    },
    {
      heading: 'Design checklist',
      paragraphs: [
        `Before adding exchange, ask what distribution the next operator requires. A hash join needs both sides partitioned by the same join key. A final order by needs a merge or gather that preserves order. A partial aggregate may need local aggregation before shuffle so fewer bytes cross the boundary. Placing exchange too early can move raw data that filters would have removed.`,
        `After adding exchange, ask how it stops. The operator needs bounded buffers, cancellation propagation, worker cleanup, error reporting, and metrics that name the blocked side. Without those controls, the plan may be logically parallel but operationally fragile.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study next: Volcano Iterator Query Execution for the local operator protocol, Volcano Exchange for encapsulated parallelism, SQL Join Algorithms Primer for the operators exchange enables, Backpressure for bounded producer-consumer control, Message Queues for buffering mechanics, Dremel Query Engine Case Study for fanout and merge trees, Spark Adaptive Query Execution for runtime skew repair, and Pipeline Parallelism for a related boundary in ML systems.`,
      ],
    },
  ],
};
