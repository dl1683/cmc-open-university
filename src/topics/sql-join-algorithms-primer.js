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
    explanation: 'For each outer customer row, the executor asks the inner side for matching orders. With a B-tree on orders.customer_id, each outer row becomes a cheap index seek instead of a full scan.',
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
    explanation: 'If the planner thinks there are 10 outer rows but reality is 10 million, the inner probe cost is multiplied 10 million times. This is why PostgreSQL planner debugging starts by comparing estimated rows with actual rows in EXPLAIN ANALYZE.',
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
    explanation: 'The build side is usually the smaller side after filters. Every customer row is placed in a hash bucket keyed by customer_id. This is Hash Table, but inside a database executor.',
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
    explanation: 'The executor compares the current left key and right key. Equal keys emit a run of matches; the smaller key advances. This is the same invariant as Merge Sort: sorted order turns search into one pass.',
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
      heading: 'What it is',
      paragraphs: [
        'A SQL join algorithm is the physical method the executor uses after the planner has decided two relations need to be joined. The logical SQL says "combine rows where keys match"; the physical plan chooses nested loop, hash join, merge join, or a variant of those families.',
        'This topic links Database Indexing, Hash Table, Merge Sort, PostgreSQL Query Planner Case Study, DuckDB Vectorized Execution Case Study, and Big-O Growth. The important lesson is that join performance is not a property of SQL syntax alone. It is a property of input sizes, order, indexes, memory, key distribution, and cardinality estimates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Nested loop join reads one row from the outer side and probes the inner side. If the inner side has a selective index, each probe can be cheap. If the outer side is much larger than estimated, the repeated probe cost explodes. PostgreSQL EXPLAIN documentation shows this directly: the inner child of a nested loop is run once for each row from the outer child.',
        'Hash join builds a hash table on one side and probes it with the other side. It is strong for large equality joins because average-case lookup is constant time. It is weak when the build table spills, the hash key is skewed, or the join predicate is not equality-based.',
        'Merge join walks two sorted inputs with cursors. It is strong when indexes, clustered order, or prior sorts already provide the needed order. It is weak when sorting dominates the cost. Its invariant is the same as Merge Sort: once the inputs are ordered, joining becomes a single forward pass.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The practical cost model is shape-dependent. Nested loop is O(outer * inner) without an index, but can behave like O(outer * log(inner)) with an index. Hash join is roughly O(build + probe) when the table fits in memory. Merge join is O(left + right) after sorting, but sorting can add O(n log n) work.',
        'The planner does not choose from perfect knowledge. It estimates cardinalities, widths, costs, sort order, index selectivity, and memory behavior. A small row-estimate error near the leaves can make the optimizer choose the wrong join order and the wrong join algorithm. That is why this topic sits directly after the PostgreSQL planner page.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'Planner regression: a multi-tenant dashboard joins events to users. The planner estimates 100 events for one tenant but the actual tenant has 5 million rows. It chooses nested loop with indexed probes and the query stalls. The repair is extended statistics, a tenant/time partial index, or a query rewrite that makes the selective path visible.',
        'Memory spill: a revenue job joins orders to a product dimension. Hash join is perfect while the build side fits in memory. After a catalog expansion, the build table spills to disk and runtime jumps. The repair is memory tuning, filtering earlier, repartitioning, or changing the join shape.',
        'Streaming ETL: a sorted event feed joins a sorted user dimension. Merge join avoids a large hash table and preserves order for the next group-by. The engine pays almost no random-access cost because the data layout already matches the join key.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common mistake is ranking join algorithms globally. There is no universal best join. Nested loops can be excellent with tiny outer inputs and strong indexes. Hash joins can be terrible when memory spills. Merge joins can be ideal when order is free and wasteful when order must be purchased with a large sort.',
        'Another mistake is treating a slow join as only an algorithm problem. Often the algorithm was a symptom. The deeper problem was stale statistics, missing correlation, a low-selectivity index, a hot key, insufficient memory, or a plan shape that moved too many rows before filtering.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL EXPLAIN documentation at https://www.postgresql.org/docs/current/using-explain.html, PostgreSQL executor documentation at https://www.postgresql.org/docs/current/executor.html, and PostgreSQL planner statistics documentation at https://www.postgresql.org/docs/current/planner-stats.html. The classic execution-engine context is Graefe, Volcano: An Extensible and Parallel Query Evaluation System, at https://cs-people.bu.edu/mathan/reading-groups/papers-classics/volcano.pdf.',
        'Study Cardinality Estimation Error Propagation for why join algorithms get chosen incorrectly, PostgreSQL Query Planner Case Study for row estimates and EXPLAIN, PostgreSQL Statistics Histogram & MCV for selectivity inputs, Selinger DP Join Order Optimizer for how join orders are searched, Leapfrog Triejoin Worst-Case Optimal Join for the multiway alternative, Volcano Iterator Query Execution for executor control flow, Exchange Operator Parallel Query for parallel joins, and Spark Adaptive Query Execution for runtime join adaptation.',
      ],
    },
  ],
};
