// SQL join algorithms: nested loops, hash joins, and merge joins as data-structure choices.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sql-join-algorithms-primer',
  title: 'SQL Join Algorithms Primer',
  category: 'Systems',
  summary: 'The three physical join families: nested loops for tiny or indexed probes, hash joins for equality joins, and merge joins for sorted streams.',
  controls: [
    { id: 'view', label: 'Join', type: 'select', options: ['nested loop', 'hash join', 'merge join'], defaultValue: 'hash join' },
  ],
  run,
};

const joinRows = [
  { id: 'nested', label: 'loop' },
  { id: 'hash', label: 'hash' },
  { id: 'merge', label: 'merge' },
  { id: 'bad', label: 'bad est' },
];

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

function choiceMatrix(title) {
  return labelMatrix(
    title,
    joinRows,
    [
      { id: 'shape', label: 'shape' },
      { id: 'structure', label: 'tool' },
      { id: 'risk', label: 'risk' },
    ],
    [
      ['few rows', 'index', 'est?'],
      ['equi', 'table', 'spill'],
      ['sorted', 'cursor', 'sort'],
      ['stale', 'wrong', 'x cost'],
    ],
  );
}

function joinGraph(title, mode) {
  if (mode === 'nested') {
    return graphState({
      nodes: [
        { id: 'c1', label: 'cust 7', x: 0.7, y: 1.4, note: 'outer' },
        { id: 'c2', label: 'cust 9', x: 0.7, y: 3.5, note: 'outer' },
        { id: 'c3', label: 'cust 12', x: 0.7, y: 5.6, note: 'outer' },
        { id: 'idx', label: 'orders idx', x: 3.1, y: 3.5, note: 'B-tree' },
        { id: 'o1', label: 'o11 c7', x: 5.5, y: 1.1, note: 'inner' },
        { id: 'o2', label: 'o12 c7', x: 5.5, y: 2.6, note: 'inner' },
        { id: 'o3', label: 'o13 c9', x: 5.5, y: 4.1, note: 'inner' },
        { id: 'o4', label: 'o14 c15', x: 5.5, y: 5.6, note: 'inner' },
        { id: 'out', label: 'joined rows', x: 8.3, y: 3.5, note: 'emit matches' },
      ],
      edges: [
        { id: 'e-c1-idx', from: 'c1', to: 'idx', weight: 'key 7' },
        { id: 'e-c2-idx', from: 'c2', to: 'idx', weight: 'key 9' },
        { id: 'e-c3-idx', from: 'c3', to: 'idx', weight: 'key 12' },
        { id: 'e-idx-o1', from: 'idx', to: 'o1', weight: 'seek' },
        { id: 'e-idx-o2', from: 'idx', to: 'o2', weight: 'seek' },
        { id: 'e-idx-o3', from: 'idx', to: 'o3', weight: 'seek' },
        { id: 'e-o1-out', from: 'o1', to: 'out', weight: 'match' },
        { id: 'e-o2-out', from: 'o2', to: 'out', weight: 'match' },
        { id: 'e-o3-out', from: 'o3', to: 'out', weight: 'match' },
      ],
    }, { title });
  }

  if (mode === 'hash') {
    return graphState({
      nodes: [
        { id: 'build', label: 'customers', x: 0.8, y: 3.5, note: 'build side' },
        { id: 'b7', label: 'bucket 7', x: 3.0, y: 1.5, note: 'cust 7' },
        { id: 'b9', label: 'bucket 9', x: 3.0, y: 3.5, note: 'cust 9' },
        { id: 'b12', label: 'bucket 12', x: 3.0, y: 5.5, note: 'cust 12' },
        { id: 'probe', label: 'orders', x: 5.4, y: 3.5, note: 'probe side' },
        { id: 'hit7', label: 'o11,o12', x: 7.2, y: 1.8, note: 'key 7' },
        { id: 'hit9', label: 'o13', x: 7.2, y: 3.5, note: 'key 9' },
        { id: 'miss', label: 'o14', x: 7.2, y: 5.2, note: 'key 15' },
        { id: 'out', label: 'join out', x: 9.1, y: 3.5, note: 'matches' },
      ],
      edges: [
        { id: 'e-build-b7', from: 'build', to: 'b7', weight: 'hash key' },
        { id: 'e-build-b9', from: 'build', to: 'b9', weight: 'hash key' },
        { id: 'e-build-b12', from: 'build', to: 'b12', weight: 'hash key' },
        { id: 'e-probe-hit7', from: 'probe', to: 'hit7', weight: 'lookup 7' },
        { id: 'e-probe-hit9', from: 'probe', to: 'hit9', weight: 'lookup 9' },
        { id: 'e-probe-miss', from: 'probe', to: 'miss', weight: 'lookup 15' },
        { id: 'e-hit7-out', from: 'hit7', to: 'out', weight: 'emit 2' },
        { id: 'e-hit9-out', from: 'hit9', to: 'out', weight: 'emit 1' },
      ],
    }, { title });
  }

  return graphState({
    nodes: [
      { id: 'left1', label: 'c7', x: 0.8, y: 1.4, note: 'left sorted' },
      { id: 'left2', label: 'c9', x: 0.8, y: 3.5, note: 'left sorted' },
      { id: 'left3', label: 'c12', x: 0.8, y: 5.6, note: 'left sorted' },
      { id: 'right1', label: 'o11 c7', x: 3.2, y: 1.0, note: 'right sorted' },
      { id: 'right2', label: 'o12 c7', x: 3.2, y: 2.4, note: 'right sorted' },
      { id: 'right3', label: 'o13 c9', x: 3.2, y: 4.0, note: 'right sorted' },
      { id: 'right4', label: 'o14 c15', x: 3.2, y: 5.8, note: 'right sorted' },
      { id: 'cmp', label: 'compare', x: 5.6, y: 3.5, note: 'two cursors' },
      { id: 'out', label: 'join out', x: 8.2, y: 3.5, note: 'ordered' },
    ],
    edges: [
      { id: 'e-left-cmp', from: 'left1', to: 'cmp', weight: 'cursor L' },
      { id: 'e-left2-cmp', from: 'left2', to: 'cmp', weight: 'advance' },
      { id: 'e-right-cmp', from: 'right1', to: 'cmp', weight: 'cursor R' },
      { id: 'e-right2-cmp', from: 'right2', to: 'cmp', weight: 'same key' },
      { id: 'e-right3-cmp', from: 'right3', to: 'cmp', weight: 'advance' },
      { id: 'e-cmp-out', from: 'cmp', to: 'out', weight: 'emit run' },
    ],
  }, { title });
}

function* nestedLoop() {
  yield {
    state: joinGraph('Nested loop with an indexed inner side', 'nested'),
    highlight: { active: ['c1', 'idx', 'e-c1-idx', 'e-idx-o1', 'e-idx-o2'], found: ['o1', 'o2', 'out'], compare: ['c2', 'c3'] },
    explanation: 'Nested loop join is repeated lookup. For each outer customer, the executor asks the inner side for matching orders. With a B-tree on orders.customer_id, each question is a targeted seek instead of a full scan.',
    invariant: 'Nested loop is not always bad. Nested loop plus selective indexed probes is a powerful shape.',
  };

  yield {
    state: choiceMatrix('Join choice'),
    highlight: { active: ['nested:shape', 'nested:structure'], compare: ['bad:risk'] },
    explanation: 'The optimizer starts with a logical join, then chooses a physical method. Nested loop join is attractive when the outer input is tiny or each outer row can probe an index on the inner side.',
  };

  yield {
    state: joinGraph('The same loop becomes dangerous when the estimate lies', 'nested'),
    highlight: { active: ['c1', 'c2', 'c3', 'idx'], compare: ['o1', 'o2', 'o3', 'o4'], found: ['out'] },
    explanation: 'The same shape becomes dangerous when the estimate lies. If the planner expects 10 outer rows but sees 10 million, the inner probe cost is multiplied 10 million times. Compare estimated rows with actual rows first.',
  };

  yield {
    state: labelMatrix(
      'Nested loop production case study',
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'plan', label: 'plan' },
        { id: 'cause', label: 'cause' },
        { id: 'repair', label: 'repair' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'move', label: 'move' },
      ],
      [
        ['stall', 'actuals'],
        ['loop', 'outer big'],
        ['skew', 'stats'],
        ['index', 'probe'],
      ],
    ),
    highlight: { active: ['plan:evidence', 'cause:evidence'], found: ['repair:move'] },
    explanation: 'A realistic fix is not "disable nested loops." It is: find the bad cardinality estimate, teach the planner the data shape, and make the indexed path visible for the selective tenant or time window.',
  };
}

function* hashJoin() {
  yield {
    state: joinGraph('Build phase: hash the smaller input by join key', 'hash'),
    highlight: { active: ['build', 'b7', 'b9', 'b12', 'e-build-b7', 'e-build-b9', 'e-build-b12'], compare: ['probe'] },
    explanation: 'The build side is usually the smaller side after filters. Every customer row is placed in a bucket keyed by customer_id. This is a hash table, but now memory limits, spilling, and key skew are part of the algorithm.',
    invariant: 'Hash joins need equality keys because the hash table answers exact-key lookup, not ranges.',
  };

  yield {
    state: choiceMatrix('Hash join choice'),
    highlight: { active: ['hash:shape', 'hash:structure'], compare: ['hash:risk'] },
    explanation: 'Hash join is the workhorse for large equality joins. Build a hash table on one input, then stream the other input and look up matching keys.',
  };

  yield {
    state: joinGraph('Probe phase: stream orders and look up each key', 'hash'),
    highlight: { active: ['probe', 'hit7', 'hit9', 'e-probe-hit7', 'e-probe-hit9'], found: ['out'], removed: ['miss'] },
    explanation: 'The probe side can stream. Order rows with customer_id 7 and 9 find buckets and emit joined rows; customer_id 15 misses. Average-case work is build O(n) plus probe O(m).',
  };

  yield {
    state: labelMatrix(
      'Hash join memory case study',
      [
        { id: 'fit', label: 'fits in RAM' },
        { id: 'spill', label: 'spills' },
        { id: 'skew', label: 'key skew' },
        { id: 'guard', label: 'guardrail' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['one table', 'linear'],
        ['to disk', 'more IO'],
        ['hot key', 'skew'],
        ['profile', 'memory'],
      ],
    ),
    highlight: { active: ['fit:lesson'], compare: ['spill:lesson', 'skew:lesson'], found: ['guard:lesson'] },
    explanation: 'The case study is a nightly revenue join. It is fast until a dimension table grows past memory or one customer dominates the key distribution. Then the same algorithm becomes an IO and skew problem.',
  };
}

function* mergeJoin() {
  yield {
    state: joinGraph('Two sorted streams advance with cursors', 'merge'),
    highlight: { active: ['left1', 'right1', 'right2', 'cmp', 'e-left-cmp', 'e-right-cmp', 'e-right2-cmp'], found: ['out'] },
    explanation: 'Merge join is two cursors walking sorted streams. Equal keys emit a run of matches; the smaller key advances. The invariant is the same as Merge Sort: sorted order turns search into one forward pass.',
    invariant: 'Merge join is linear after sorting: advance cursors, never rewind the full inputs.',
  };

  yield {
    state: choiceMatrix('Merge join choice'),
    highlight: { active: ['merge:shape', 'merge:structure'], compare: ['merge:risk'] },
    explanation: 'Merge join is ideal when both inputs already arrive sorted by the join key, often because indexes or earlier sort nodes provide that order.',
  };

  yield {
    state: joinGraph('Sorted indexes can remove the sorting bill', 'merge'),
    highlight: { active: ['left1', 'left2', 'left3', 'right1', 'right2', 'right3', 'right4'], compare: ['cmp'], found: ['out'] },
    explanation: 'If both sides are already ordered by the join key, merge join avoids building a hash table and avoids a separate sort. If the inputs are not sorted, the sort cost has to be justified.',
  };

  yield {
    state: labelMatrix(
      'Merge join case study',
      [
        { id: 'feed', label: 'event feed' },
        { id: 'dim', label: 'dimension' },
        { id: 'join', label: 'merge join' },
        { id: 'benefit', label: 'benefit' },
      ],
      [
        { id: 'property', label: 'property' },
        { id: 'result', label: 'result' },
      ],
      [
        ['sorted key', 'stream'],
        ['clustered', 'stream'],
        ['cursors', 'low RAM'],
        ['ordered', 'group by'],
      ],
    ),
    highlight: { active: ['join:property', 'join:result'], found: ['benefit:result'] },
    explanation: 'In an ETL pipeline, both the fact feed and dimension table may already be sorted by user_id. Merge join then becomes a low-memory streaming join whose output is still ordered for downstream grouping.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'nested loop') yield* nestedLoop();
  else if (view === 'hash join') yield* hashJoin();
  else if (view === 'merge join') yield* mergeJoin();
  else throw new InputError('Pick a SQL join algorithm.');
}

export const article = {
  sections: [
    {
      heading: 'Why physical joins exist',
      paragraphs: [
        `A SQL query describes a logical result. When you join customers to orders on matching customer ids, you are not telling the database how to find the matching rows. You are saying what rows should appear. The planner still has to choose a physical method: nested loop, hash join, merge join, or a variant built from those families.`,
        {type: 'callout', text: 'A join plan is a runtime data-structure choice: probe an index, build a hash table, or consume sorted streams.'},
        `This separation is the reason SQL can feel both declarative and surprising. Two queries with the same answer can have very different execution costs because their physical plans touch data in different orders, use different indexes, allocate different memory, and recover differently when estimates are wrong.`,
        `A join algorithm is therefore a data-structure choice made at runtime planning time. Nested loop leans on repeated probes, often through a B-tree. Hash join builds an in-memory lookup table for equality keys. Merge join turns sorted order into a two-cursor stream. The best choice is not a moral ranking of algorithms; it is a match between the query shape and the evidence the planner has about the data.`,
      ],
    },
    {
      heading: 'Why the obvious approach hits a wall',
      paragraphs: [
        `The most obvious join is the double loop: for every row on the left, scan every row on the right and emit pairs that satisfy the predicate. That is correct, simple, and often disastrous. If both tables have one million rows, the direct product has one trillion comparisons before filters and projection even matter.`,
        `Databases avoid that n-by-m wall by using structure. If the inner side has an index on the join key, the executor can ask a targeted question instead of scanning every row. If the join is an equality join, it can hash one side and turn matching into lookup. If both sides are sorted, it can walk them once with cursors. Each method is a way to stop treating the join as an unstructured comparison problem.`,
        `The catch is that structure has a price. Index probes are cheap only when the outer side is small or selective. Hash tables are fast only when the build side fits well enough in memory and the key distribution is not hostile. Merge joins are linear only after the needed order already exists or has been purchased with a sort. The planner is choosing among prices before it has run the query, so estimates matter.`,
      ],
    },
    {
      heading: 'Core insight: joins buy structure',
      paragraphs: [
        `The optimizer starts from a logical join graph. It estimates how many rows each scan and filter will produce, what indexes are useful, whether useful order already exists, how wide the rows are, and how much memory a plan node may need. It then searches possible join orders and physical join methods. A large query may contain several joins, and a wrong early estimate can push the whole plan toward the wrong shape.`,
        `The executor receives the chosen plan and runs it as a tree of operators. In PostgreSQL-style iterator execution, each node repeatedly asks its children for the next tuple. A nested loop node may call its inner child once per outer row. A hash join node consumes the build side before probing. A merge join node asks both sorted children for their current front rows and advances one or both cursors.`,
        `This distinction is important when debugging. A slow query is rarely fixed by saying "hash join good" or "nested loop bad." The right question is why the planner believed this physical method was cheaper than the alternatives, and whether the executor's actual row counts, memory behavior, and ordering assumptions matched that belief.`,
      ],
    },
    {
      heading: 'Mechanism: nested loop join',
      paragraphs: [
        `Nested loop join chooses one input as the outer side and one input as the inner side. For each outer row, it looks for matching inner rows. With no supporting structure, that means scanning the inner relation repeatedly. With a selective index on the inner join key, it can become a series of targeted lookups.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in nodes', caption: 'Nested loop joins become practical when each outer row can probe an inner B-tree index instead of scanning the whole relation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
        `This is why nested loop is not automatically the beginner algorithm to avoid. If the outer side has ten rows and the inner side has a B-tree on the join key, ten index probes can beat building a hash table or sorting both inputs. Nested loop is also useful for non-equality predicates because hash join needs exact-key lookup and merge join needs compatible order.`,
        `The failure mode is multiplication by surprise. If the planner thinks the outer side has ten rows and it actually has ten million, the inner probe cost is multiplied ten million times. The plan can look reasonable on paper while producing a production stall. In an EXPLAIN ANALYZE plan, this often appears as a nested loop whose inner node has many loops and whose actual outer row count dwarfs the estimate.`,
      ],
    },
    {
      heading: 'Hash join',
      paragraphs: [
        `Hash join is the workhorse for large equality joins. The executor chooses a build side, reads it, and stores rows in buckets keyed by the join key. Then it streams the probe side. For each probe row, it hashes the join key, checks the matching bucket, and emits rows whose full join predicate succeeds.`,
        `The reason it works is the same reason a hash table is useful in ordinary programming: once the build table exists, exact-key lookup is expected constant time. Instead of comparing every order to every customer, the executor turns customer id 7 into a bucket lookup. The total happy-path work is roughly build plus probe, not build times probe.`,
        `The hard parts are memory and skew. A hash table that fits in memory can be fast and simple. A hash table that spills to disk becomes a partitioned IO problem. A key distribution with one very hot key can put too much work into one bucket or one parallel worker. A hash join is also not the right primitive for general range predicates because the hash table answers equality questions.`,
      ],
    },
    {
      heading: 'Merge join',
      paragraphs: [
        `Merge join uses sorted inputs. It keeps a cursor into each relation, compares the current join keys, advances the smaller key, and emits the cross-product of matching runs when the keys are equal. If the left stream is at customer 7 and the right stream is at order customer 7, all matching rows for key 7 can be emitted before both streams advance.`,
        `The key invariant is the same one that makes Merge Sort work. Once the inputs are sorted, any key smaller than the current front has already been fully handled. The executor never needs to rewind the whole input. It only needs to manage the current equal-key runs. After sorting, the join is linear in the input sizes.`,
        `Merge join is especially attractive when the required order is already available: clustered tables, index scans, earlier sort nodes, or pipelines that preserve order. It can also produce ordered output for downstream grouping or another merge join. Its main risk is paying a large sort bill just to earn the linear merge. If sorting dominates, hash join may be cheaper.`,
      ],
    },
    {
      heading: 'Worked customer-orders example',
      paragraphs: [
        `Suppose customers has rows for ids 7, 9, and 12. Orders has rows (11, customer 7), (12, customer 7), (13, customer 9), and (14, customer 15). The desired inner join emits three rows: customer 7 with orders 11 and 12, and customer 9 with order 13. Customer 12 has no order, and order 14 has no customer row in this input.`,
        `A nested loop with customers as the outer side asks the orders index three questions: key 7, key 9, and key 12. The first probe returns two orders, the second returns one, and the third returns none. This is excellent if the customers input is tiny and the orders index is selective.`,
        `A hash join builds buckets for customers 7, 9, and 12, then streams orders. Orders 11 and 12 probe bucket 7, order 13 probes bucket 9, and order 14 probes bucket 15 and misses. This is excellent when both inputs are large enough that repeated index probes are worse than one build pass.`,
        `A merge join requires both inputs sorted by customer id. The cursor sees 7 on both sides and emits the run for key 7, then sees 9 on both sides and emits that match, then advances through 12 and 15 without emitting. This is excellent when sorted order was already present or useful for the next operator.`,
      ],
    },
    {
      heading: 'Why it works: correctness invariants',
      paragraphs: [
        `Nested loop is correct because it considers every outer row and returns every inner row that the chosen access path says can match. If the access path is a full scan, that is obvious. If the access path is an index lookup, the correctness obligation moves to the index predicate: the index must return all inner rows whose key equals the outer key.`,
        `Hash join is correct because equal join keys hash to the same bucket under the same hash function, and the executor still checks the actual predicate before emitting. Collisions can add comparisons, but they do not change the result. A collision means "same bucket," not "same key."`,
        `Merge join is correct because sorted order proves that skipped rows cannot match future rows. When the left key is smaller than the right key, advancing the left cursor is safe because every future right key is at least as large as the current right key. Equal-key runs are handled together so duplicates are not lost.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Cardinality error is the most common root cause. Stale statistics, correlated columns, tenant skew, time-window skew, and missing most-common-value information can make the planner believe a huge input is small or a selective predicate is broad. The chosen join method then amplifies the bad estimate.`,
        `Memory failure is most visible in hash joins. A build side that was expected to fit may spill to disk. Parallel workers may receive uneven partitions because one key dominates the data. The query is still logically correct, but the performance model has changed from memory lookup to partitioned IO and skew management.`,
        `Order failure belongs to merge joins. A plan may look attractive because a merge join is linear, but the cost of sorting one or both inputs can dominate. Order can also be lost across operators that repartition, materialize, or otherwise break the stream shape.`,
        `Index failure belongs to nested loops. The planner may choose repeated probes through an index that is technically available but not selective enough, or an index that does not cover the columns needed later. Each probe then becomes more expensive than the estimate suggested.`,
      ],
    },
    {
      heading: 'Operational debugging guide',
      paragraphs: [
        `Read a slow join plan from the leaves upward. First compare estimated rows to actual rows at scans and filters. Then inspect the join order, the physical join method, and the number of loops on inner nodes. After that, check whether the plan uses indexes, sort order, materialization, parallelism, and memory the way you expected.`,
        `Do not start by disabling a join type globally. That may hide one bad plan and create worse plans elsewhere. Better repairs usually change the evidence or the shape: refresh statistics, add extended statistics for correlated columns, add a partial or covering index, filter earlier, rewrite an expression so an index is usable, increase memory for a specific reporting job, or materialize a selective intermediate result deliberately.`,
        `When a query regresses after data growth, ask what crossed a threshold. Did the build side stop fitting in memory? Did one tenant become huge? Did a time window become less selective? Did an index become low-selectivity because a status column collapsed to one common value? Physical join choice often changes abruptly when one of these facts changes.`,
      ],
    },
    {
      heading: 'Implementation notes',
      paragraphs: [
        `A real executor has more details than the three textbook families. Hash joins may batch and repartition when memory is tight. Merge joins must manage duplicate-key runs, null semantics, outer joins, and mark/restore behavior. Nested loops may cache inner results, materialize subplans, or use parameterized index scans.`,
        `Join predicates also matter. Equality predicates make hash joins possible. Ordered comparison predicates can sometimes use merge-like strategies. Non-equality predicates often leave nested loops or specialized indexes as the practical choices. Outer joins add preservation rules: unmatched rows from the preserved side must still appear with nulls on the other side.`,
        `For application engineers, the implementation lesson is simple: schema and query shape teach the planner what physical plans are possible. A good index, accurate statistics, and a predicate written in an index-friendly form can matter more than the SQL keyword used to express the join.`,
      ],
    },
    {
      heading: 'Uses and limits',
      paragraphs: [
        `OLTP systems often depend on nested loops with indexed probes. A request path may fetch a small set of accounts and then join to recent events, permissions, or feature flags. The join is fast because the outer side is small and every probe is targeted.`,
        `Analytics systems often lean on hash joins because they combine large filtered relations through equality keys. Fact tables join to dimensions, events join to sessions, and revenue rows join to products. The operational question is usually whether the build side is small enough, filtered early enough, and evenly distributed enough.`,
        `ETL and storage pipelines often benefit from merge joins. Sorted files, clustered indexes, and append-only feeds can make order nearly free. If the output remains sorted, the next grouping, deduplication, or range operation also becomes cheaper.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources to keep nearby: PostgreSQL EXPLAIN documentation at https://www.postgresql.org/docs/current/using-explain.html, PostgreSQL executor documentation at https://www.postgresql.org/docs/current/executor.html, PostgreSQL planner statistics documentation at https://www.postgresql.org/docs/current/planner-stats.html, and Graefe's Volcano execution paper at https://cs-people.bu.edu/mathan/reading-groups/papers-classics/volcano.pdf.`,
        `Study Cardinality Estimation Error Propagation to understand why the wrong join is often an estimate problem. Study PostgreSQL Query Planner Case Study and PostgreSQL Statistics Histogram & MCV for plan reading. Study Selinger DP Join Order Optimizer for join-order search, Volcano Iterator Query Execution for executor control flow, Exchange Operator Parallel Query for parallel joins, Spark Adaptive Query Execution for runtime join adaptation, and Leapfrog Triejoin Worst-Case Optimal Join for a different approach to multiway joins.`,
      ],
    },
  ],
};
