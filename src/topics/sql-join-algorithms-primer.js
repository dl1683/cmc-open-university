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
  const custCount = 3;
  const orderCount = 4;
  const custIds = [7, 9, 12];
  const method = joinRows[0].label;
  const badRow = joinRows[3].label;
  const lowEst = 10;
  const highActual = '10 million';
  const matchCount = 3;

  yield {
    state: joinGraph('Nested loop with an indexed inner side', 'nested'),
    highlight: { active: ['c1', 'idx', 'e-c1-idx', 'e-idx-o1', 'e-idx-o2'], found: ['o1', 'o2', 'out'], compare: ['c2', 'c3'] },
    explanation: `Nested ${method} join is repeated lookup. For each of the ${custCount} outer customers, the executor asks the inner side for matching orders among ${orderCount} rows. With a B-tree on orders.customer_id, each of the ${custCount} questions is a targeted seek instead of a full scan.`,
    invariant: `Nested ${method} is not always bad. Nested ${method} plus selective indexed probes is a powerful shape for ${custCount} outer rows.`,
  };

  yield {
    state: choiceMatrix('Join choice'),
    highlight: { active: ['nested:shape', 'nested:structure'], compare: ['bad:risk'] },
    explanation: `The optimizer starts with a logical join, then chooses among ${joinRows.length} physical methods. Nested ${method} join is attractive when the outer input is tiny (like ${custCount} customers) or each outer row can probe an index on the inner side.`,
  };

  yield {
    state: joinGraph('The same loop becomes dangerous when the estimate lies', 'nested'),
    highlight: { active: ['c1', 'c2', 'c3', 'idx'], compare: ['o1', 'o2', 'o3', 'o4'], found: ['out'] },
    explanation: `The same shape becomes dangerous when the estimate lies. If the planner expects ${lowEst} outer rows but sees ${highActual}, the inner probe cost is multiplied ${highActual} times. Compare estimated rows with actual rows first — a ${badRow} estimate is the root cause.`,
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
    explanation: `A realistic fix is not "disable nested ${method}s." It is: find the bad cardinality estimate, teach the planner the data shape (${custCount} customers, ${orderCount} orders), and make the indexed path visible for the selective tenant or time window. Keys ${custIds.join(', ')} should each resolve via a single seek.`,
  };
}

function* hashJoin() {
  const custIds = [7, 9, 12];
  const bucketCount = custIds.length;
  const orderCount = 4;
  const method = joinRows[1].label;
  const hitKeys = [7, 9];
  const missKey = 15;
  const hitOrders = ['o11', 'o12', 'o13'];
  const missOrder = 'o14';

  yield {
    state: joinGraph('Build phase: hash the smaller input by join key', 'hash'),
    highlight: { active: ['build', 'b7', 'b9', 'b12', 'e-build-b7', 'e-build-b9', 'e-build-b12'], compare: ['probe'] },
    explanation: `The build side is usually the smaller side after filters. Each of the ${bucketCount} customer rows is placed in a bucket keyed by customer_id (keys ${custIds.join(', ')}). This is a ${method} table, but now memory limits, spilling, and key skew are part of the algorithm.`,
    invariant: `${method[0].toUpperCase() + method.slice(1)} joins need equality keys because the ${method} table answers exact-key lookup, not ranges.`,
  };

  yield {
    state: choiceMatrix('Hash join choice'),
    highlight: { active: ['hash:shape', 'hash:structure'], compare: ['hash:risk'] },
    explanation: `${method[0].toUpperCase() + method.slice(1)} join is the workhorse for large equality joins. Build a ${method} table on one input (${bucketCount} buckets here), then stream the other ${orderCount} rows and look up matching keys.`,
  };

  yield {
    state: joinGraph('Probe phase: stream orders and look up each key', 'hash'),
    highlight: { active: ['probe', 'hit7', 'hit9', 'e-probe-hit7', 'e-probe-hit9'], found: ['out'], removed: ['miss'] },
    explanation: `The probe side can stream ${orderCount} orders. Orders ${hitOrders.join(', ')} with customer_ids ${hitKeys.join(' and ')} find buckets and emit ${hitOrders.length} joined rows; ${missOrder} with customer_id ${missKey} misses. Average-case work is build O(n) plus probe O(m).`,
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
    explanation: `The case study is a nightly revenue join over ${bucketCount} dimension keys. It is fast until a dimension table grows past memory or one customer (like key ${custIds[0]}) dominates the key distribution. Then the same ${method} algorithm becomes an IO and skew problem.`,
  };
}

function* mergeJoin() {
  const leftCount = 3;
  const rightCount = 4;
  const method = joinRows[2].label;
  const firstKey = 7;
  const custIds = [7, 9, 12];
  const matchCount = 3;
  const cursorCount = 2;

  yield {
    state: joinGraph('Two sorted streams advance with cursors', 'merge'),
    highlight: { active: ['left1', 'right1', 'right2', 'cmp', 'e-left-cmp', 'e-right-cmp', 'e-right2-cmp'], found: ['out'] },
    explanation: `${method[0].toUpperCase() + method.slice(1)} join is ${cursorCount} cursors walking sorted streams of ${leftCount} left and ${rightCount} right rows. Equal keys emit a run of matches; the smaller key advances. The invariant is the same as ${method[0].toUpperCase() + method.slice(1)} Sort: sorted order turns search into one forward pass.`,
    invariant: `${method[0].toUpperCase() + method.slice(1)} join is linear after sorting: advance ${cursorCount} cursors, never rewind the full ${leftCount + rightCount} input rows.`,
  };

  yield {
    state: choiceMatrix('Merge join choice'),
    highlight: { active: ['merge:shape', 'merge:structure'], compare: ['merge:risk'] },
    explanation: `${method[0].toUpperCase() + method.slice(1)} join is ideal when both inputs (${leftCount} left, ${rightCount} right) already arrive sorted by the join key, often because indexes or earlier sort nodes provide that order.`,
  };

  yield {
    state: joinGraph('Sorted indexes can remove the sorting bill', 'merge'),
    highlight: { active: ['left1', 'left2', 'left3', 'right1', 'right2', 'right3', 'right4'], compare: ['cmp'], found: ['out'] },
    explanation: `If both sides (${leftCount} + ${rightCount} rows) are already ordered by the join key, ${method} join avoids building a hash table and avoids a separate sort. If the inputs are not sorted, the sort cost for ${leftCount + rightCount} rows has to be justified.`,
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
    explanation: `In an ETL pipeline, both the fact feed and dimension table may already be sorted by user_id. ${method[0].toUpperCase() + method.slice(1)} join then becomes a low-memory streaming join using ${cursorCount} cursors, producing ${matchCount} matches whose output is still ordered for downstream grouping.`,
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
    { heading: 'How to read the animation', paragraphs: ['Read each frame as one physical way to compute the same logical join. Active rows or keys are being processed, and found rows are matches that satisfied the predicate.', {type: 'image', src: './assets/gifs/sql-join-algorithms-primer.gif', alt: 'Animated walkthrough of the sql join algorithms primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}], },
    { heading: 'Why this exists', paragraphs: ['SQL describes the rows that should match, not the access path used to find them. The planner must choose a physical join method before the executor touches data.', {type: 'callout', text: 'A join plan is a runtime data-structure choice: probe an index, build a hash table, or consume sorted streams.'}], },
    { heading: 'The obvious approach', paragraphs: ['The obvious join scans every right row for every left row. It is correct because it checks every possible pair.'], },
    { heading: 'The wall', paragraphs: ['The double scan costs O(nm). A million rows joined to a million rows means one trillion comparisons before projection or filtering helps.'], },
    { heading: 'The core insight', paragraphs: ['A join buys structure before comparing all pairs. An index supports targeted nested-loop probes, a hash table supports equality lookup, and sorted order supports merge cursors.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in nodes', caption: 'Nested loop joins become practical when each outer row can probe an inner B-tree index instead of scanning the whole relation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'}], },
    { heading: 'How it works', paragraphs: ['Nested loop repeats inner access for each outer row. Hash join builds buckets for one side and probes with the other; merge join advances two sorted streams and emits equal-key runs.'], },
    { heading: 'Why it works', paragraphs: ['Nested loop is correct because the inner access path returns all matches for each outer row. Hash join still checks real keys after bucket lookup, and merge join uses sorted order to prove skipped keys cannot match later.'], },
    { heading: 'Cost and complexity', paragraphs: ['Raw nested loop is O(nm), but indexed nested loop is outer rows times probe cost. Hash join is near build plus probe when memory holds, while merge join is linear after sorted order exists.'], },
    { heading: 'Real-world uses', paragraphs: ['OLTP queries often use indexed nested loops for small selective outer inputs. Analytical equality joins often use hash joins, and sorted pipelines often use merge joins.'], },
    { heading: 'Where it fails', paragraphs: ['Bad row estimates choose bad joins. Nested loops multiply surprise rows, hash joins spill or skew, and merge joins lose when sorting costs more than expected.'], },
    { heading: 'Worked example', paragraphs: ['Customers are 7, 9, and 12; orders are 11 for 7, 12 for 7, 13 for 9, and 14 for 15. Nested loop probes keys 7, 9, 12; hash join buckets customers then probes orders; merge join walks sorted runs and emits three rows.'], },
    { heading: 'Sources and study next', paragraphs: ['Study PostgreSQL EXPLAIN, PostgreSQL planner statistics, executor documentation, and Graefe Volcano execution. Then study B-Tree, Hash Table, Merge Sort, Cardinality Estimation, Selinger Join Order, and Volcano Iterator Query Execution.'], },
  ],
};
