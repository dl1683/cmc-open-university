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
    explanation: 'A Volcano iterator parent wants one row at a time. Parallel producers want to run independently. The exchange operator is the adapter between those worlds.',
  };

  yield {
    state: exchangeGraph('Producers fill bounded queues with result packets', 'vertical'),
    highlight: { active: ['prod1', 'prod2', 'q1', 'q2', 'e-q1-prod1', 'e-q2-prod2'], found: ['ex'] },
    explanation: 'Exchange starts producer work below it and buffers packets in bounded queues. The parent still sees one logical child, but under the exchange several workers are scanning and filtering.',
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
    explanation: 'For a parallel hash join, rows must meet the worker that owns their key. Exchange hashes each row by join key and routes it to the matching partition.',
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
    explanation: 'The speedup comes from partition independence. The risk is skew: if one key owns half the rows, one partition becomes the long pole while other workers finish early.',
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
    explanation: 'The complete production view is a query profile: shuffle bytes, queue depth, skew, and spill tell you whether the exchange is helping or simply exposing the real bottleneck.',
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
      heading: 'What it is',
      paragraphs: [
        'An exchange operator is a physical query-plan operator that moves intermediate rows between workers. It can start producer processes, buffer packets, repartition rows by key, merge streams, preserve or relax ordering, and apply flow control.',
        'The concept comes from Volcano: keep normal data operators such as scan, filter, join, sort, and aggregate mostly unaware of parallelism, then encapsulate producer-consumer execution in exchange. This topic links Volcano Iterator Query Execution, SQL Join Algorithms Primer, Message Queues, Backpressure, Dremel Query Engine Case Study, DuckDB Vectorized Execution Case Study, and Pipeline Parallelism.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A vertical exchange can sit between a parent and child. The parent still calls next, but below the exchange several producers may scan, filter, and fill bounded queues. Exchange drains packets and returns rows upward through the normal iterator interface.',
        'A repartition exchange hashes rows by key so equal keys meet on the same worker. This is essential for parallel hash join, group by, distinct, and many distributed aggregations. A merge exchange combines already-sorted streams when the parent needs ordered output.',
        'The exchange operator is not only a network shuffle. It is a control boundary: queue sizes, credits, cancellation, spilling, ordering, and worker lifecycle all live there.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exchange buys parallelism by spending serialization, queueing, network, memory, and coordination. The best case is near-linear speedup because partitions are balanced and filters reduce data before shuffle. The worst case is a huge shuffle where one hot key sends most rows to one worker and everyone waits.',
        'Flow control is mandatory. Without bounded queues or credits, producers can outrun consumers and turn parallelism into memory pressure. With too little slack, producers and consumers do not overlap enough. A good exchange balances overlap with backpressure.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'Parallel hash join: an orders table joins users by user_id. Exchange repartitions both streams by user_id so each worker can build and probe a local hash table. If one enterprise tenant owns half the orders, one partition dominates runtime. Salting, skew-aware splitting, or a broadcast join for the small side may be better.',
        'Interactive aggregation: a Dremel-style serving tree fans a group-by to leaves, where each leaf computes partial counts. Mixers combine partial results before sending smaller data upward. This is an exchange-shaped idea even when the system does not use the Volcano name.',
        'Backpressure profile: a query scans quickly but the final aggregate is slow. Exchange queues fill, producer credits run out, and scan workers stop. That is a healthy plan: the slow consumer signal reached the source instead of letting the scan materialize unbounded intermediate data.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that more parallelism always helps. Exchange can dominate runtime when shuffle bytes exceed useful compute, when workers are skewed, or when every stage waits on a single final reducer.',
        'The second misconception is that exchange is just a queue. A production exchange must preserve semantics: partitioning by the correct key, maintaining order when required, propagating cancellation, handling failures, bounding memory, and cleaning up child workers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Graefe, Volcano: An Extensible and Parallel Query Evaluation System, at https://cs-people.bu.edu/mathan/reading-groups/papers-classics/volcano.pdf and Encapsulation of Parallelism in the Volcano Query Processing System at https://cs-people.bu.edu/mathan/reading-groups/papers-classics/encapsulation-volcano.pdf. PostgreSQL executor documentation describes the demand-pull side at https://www.postgresql.org/docs/current/executor.html. DuckDB internals describe modern vectorized execution at https://duckdb.org/docs/current/internals/overview.',
        'Study Spark Adaptive Query Execution for runtime shuffle adaptation, Volcano Iterator Query Execution for the local operator protocol, SQL Join Algorithms Primer for the join work that exchange parallelizes, Message Queues and Backpressure for bounded producer-consumer mechanics, Dremel Query Engine Case Study for serving-tree fanout, and Pipeline Parallelism for the same shape in ML systems.',
      ],
    },
  ],
};
