// Volcano iterator query execution: open/next/close, blocking nodes, and vectorized contrast.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'volcano-iterator-query-execution',
  title: 'Volcano Iterator Query Execution',
  category: 'Papers',
  summary: 'The classic pull-based query executor: each operator opens, returns one next row on demand, and closes, with blocking operators shaping the pipeline.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['open next close', 'blocking sort', 'vectorized contrast'], defaultValue: 'open next close' },
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

function planGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.5, note: 'asks next' },
      { id: 'limit', label: 'limit', x: 2.3, y: 3.5, note: 'parent' },
      { id: 'join', label: 'join', x: 4.0, y: 3.5, note: 'operator' },
      { id: 'sort', label: 'sort', x: 5.9, y: 2.2, note: 'blocking' },
      { id: 'scanA', label: 'scan A', x: 7.8, y: 1.3, note: 'rows' },
      { id: 'scanB', label: 'scan B', x: 5.9, y: 5.3, note: 'rows' },
      { id: 'row', label: 'row', x: 8.7, y: 3.7, note: 'one tuple' },
    ],
    edges: [
      { id: 'e-client-limit', from: 'client', to: 'limit', weight: 'next()' },
      { id: 'e-limit-join', from: 'limit', to: 'join', weight: 'next()' },
      { id: 'e-join-sort', from: 'join', to: 'sort', weight: 'left next' },
      { id: 'e-sort-scanA', from: 'sort', to: 'scanA', weight: 'pull all' },
      { id: 'e-join-scanB', from: 'join', to: 'scanB', weight: 'right next' },
      { id: 'e-scanA-row', from: 'scanA', to: 'row', weight: 'tuple' },
      { id: 'e-row-client', from: 'row', to: 'client', weight: 'return' },
    ],
  }, { title });
}

function vectorGraph(title) {
  return graphState({
    nodes: [
      { id: 'scan', label: 'scan', x: 0.8, y: 3.5, note: 'source' },
      { id: 'chunk', label: 'chunk', x: 2.5, y: 3.5, note: '2048 rows' },
      { id: 'filter', label: 'filter', x: 4.2, y: 2.2, note: 'vector op' },
      { id: 'project', label: 'project', x: 4.2, y: 4.8, note: 'vector op' },
      { id: 'sink', label: 'sink', x: 6.3, y: 3.5, note: 'pipeline end' },
      { id: 'client', label: 'client', x: 8.4, y: 3.5, note: 'fetch chunk' },
    ],
    edges: [
      { id: 'e-scan-chunk', from: 'scan', to: 'chunk', weight: 'push' },
      { id: 'e-chunk-filter', from: 'chunk', to: 'filter', weight: 'vectors' },
      { id: 'e-filter-project', from: 'filter', to: 'project', weight: 'selected' },
      { id: 'e-project-sink', from: 'project', to: 'sink', weight: 'batch' },
      { id: 'e-sink-client', from: 'sink', to: 'client', weight: 'result' },
    ],
  }, { title });
}

function* openNextClose() {
  yield {
    state: labelMatrix(
      'Iterator ops',
      [
        { id: 'open', label: 'open' },
        { id: 'next', label: 'next' },
        { id: 'close', label: 'close' },
        { id: 'state', label: 'state' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'executorMeaning', label: 'means' },
      ],
      [
        ['init', 'alloc'],
        ['row', 'done?'],
        ['free', 'finish'],
        ['cursor', 'held'],
      ],
    ),
    highlight: { active: ['open:job', 'next:job', 'close:job'], found: ['state:executorMeaning'] },
    explanation: 'Volcano-style execution gives every physical operator the same small interface: open it, ask for next rows until it is done, then close it. Each operator hides its own internal state.',
  };

  yield {
    state: planGraph('A parent pulls one row from its child tree'),
    highlight: { active: ['client', 'limit', 'join', 'e-client-limit', 'e-limit-join'], compare: ['sort', 'scanA', 'scanB'] },
    explanation: 'The top node does not receive a flood of rows. It asks for one row. That demand recursively travels down the plan tree until a leaf scan produces work.',
    invariant: 'Pull execution gives natural backpressure: no child produces the next row until a parent asks.',
  };

  yield {
    state: planGraph('The row returns up the same tree'),
    highlight: { active: ['scanA', 'row', 'client', 'e-scanA-row', 'e-row-client'], found: ['limit'], compare: ['join'] },
    explanation: 'A scan reads a tuple, the join applies its logic, the limit counts it, and the client receives a row. Complex plans are many nested calls to the same small protocol.',
  };

  yield {
    state: labelMatrix(
      'Why it lasted',
      [
        { id: 'simple', label: 'simple' },
        { id: 'composable', label: 'composable' },
        { id: 'lazy', label: 'lazy' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['one API', 'new ops'],
        ['tree', 'local'],
        ['on ask', 'low RAM'],
        ['row calls', 'CPU'],
      ],
    ),
    highlight: { active: ['simple:benefit', 'composable:benefit', 'lazy:benefit'], compare: ['cost:tradeoff'] },
    explanation: 'The design is durable because each operator can be developed and reasoned about locally. The main cost is repeated function-call and interpretation overhead for every tuple.',
  };
}

function* blockingSort() {
  yield {
    state: planGraph('A Sort node is a blocking operator'),
    highlight: { active: ['sort', 'scanA', 'e-sort-scanA'], compare: ['client', 'limit'], found: ['row'] },
    explanation: 'Some operators cannot return their first output immediately. Sort must pull every child row, sort them, and only then deliver the first sorted row.',
  };

  yield {
    state: labelMatrix(
      'Stream or block',
      [
        { id: 'scan', label: 'scan' },
        { id: 'filter', label: 'filter' },
        { id: 'join', label: 'nested loop' },
        { id: 'sort', label: 'sort' },
        { id: 'hashAgg', label: 'hash agg' },
      ],
      [
        { id: 'canReturn', label: 'first row?' },
        { id: 'state', label: 'state' },
      ],
      [
        ['now', 'cursor'],
        ['now', 'pred'],
        ['often', 'cursors'],
        ['after all', 'runs'],
        ['after all', 'hash'],
      ],
    ),
    highlight: { active: ['scan:canReturn', 'filter:canReturn', 'join:canReturn'], compare: ['sort:canReturn', 'hashAgg:canReturn'] },
    explanation: 'A plan is not one smooth pipe. Blocking nodes define materialization points, memory risk, and places where latency appears before the first result row.',
  };

  yield {
    state: planGraph('Blocking state becomes the operational bottleneck'),
    highlight: { active: ['sort', 'scanA'], compare: ['row', 'client'], found: ['join'] },
    explanation: 'A sort can spill, a hash aggregate can exceed memory, and a hash join can repartition. The iterator interface remains simple while the operator state becomes the hard engineering problem.',
  };

  yield {
    state: labelMatrix(
      'EXPLAIN case',
      [
        { id: 'query', label: 'query' },
        { id: 'node', label: 'node' },
        { id: 'cause', label: 'cause' },
        { id: 'repair', label: 'repair' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['ORDER BY', 'slow first'],
        ['Sort', 'pull all'],
        ['no order', 'sort cost'],
        ['key index', 'stream'],
      ],
    ),
    highlight: { active: ['node:evidence', 'cause:lesson'], found: ['repair:lesson'] },
    explanation: 'A real production fix may be an index that matches the ORDER BY, letting the executor stream already-ordered tuples instead of building a blocking sort before it can return page one.',
  };
}

function* vectorizedContrast() {
  yield {
    state: planGraph('Volcano pulls one tuple at a time'),
    highlight: { active: ['client', 'limit', 'join', 'row', 'e-client-limit', 'e-row-client'], compare: ['scanA'] },
    explanation: 'Tuple-at-a-time execution is simple and lazy. It can also pay overhead at every row boundary, especially in analytical scans where the same operation applies to millions of values.',
  };

  yield {
    state: vectorGraph('Vectorized engines exchange chunks instead'),
    highlight: { active: ['scan', 'chunk', 'filter', 'project', 'e-scan-chunk', 'e-chunk-filter', 'e-filter-project'], found: ['sink'] },
    explanation: 'DuckDB-style vectorized execution moves DataChunks through operators. One call carries many values, making tight loops and selection vectors possible.',
  };

  yield {
    state: labelMatrix(
      'Model compare',
      [
        { id: 'volcano', label: 'Volcano' },
        { id: 'vector', label: 'vectorized' },
        { id: 'compiled', label: 'compiled' },
        { id: 'exchange', label: 'exchange' },
      ],
      [
        { id: 'unit', label: 'unit' },
        { id: 'bestFor', label: 'best for' },
      ],
      [
        ['tuple', 'simple'],
        ['chunk', 'OLAP'],
        ['code', 'hot plan'],
        ['packet', 'parallel'],
      ],
    ),
    highlight: { active: ['volcano:unit', 'vector:unit'], found: ['exchange:unit'], compare: ['compiled:unit'] },
    explanation: 'Modern engines mix these ideas. Volcano gives the mental model. Vectorized execution changes the work unit. Exchange operators change where work happens.',
  };

  yield {
    state: vectorGraph('The cluster link: vectorization meets pipelines'),
    highlight: { active: ['chunk', 'sink', 'client'], compare: ['scan', 'filter', 'project'], found: ['e-sink-client'] },
    explanation: 'This is why DuckDB, Dremel, and parallel warehouses belong beside Volcano. They are all answers to the same question: how should operators pass intermediate data without wasting CPU, memory, or network?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'open next close') yield* openNextClose();
  else if (view === 'blocking sort') yield* blockingSort();
  else if (view === 'vectorized contrast') yield* vectorizedContrast();
  else throw new InputError('Pick a Volcano iterator view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Volcano iterator model is the classic query-execution interface: every physical operator implements open, next, and close. A parent operator asks a child for one more row. That request recursively descends through the plan tree and one tuple eventually returns upward.',
        'This is the execution counterpart to PostgreSQL Query Planner Case Study. The planner chooses the tree. The executor runs the tree. It also connects to Stack and Recursion because the plan is a recursive operator tree, to Backpressure because demand starts at the parent, and to DuckDB Vectorized Execution Case Study because modern engines often change the unit from one tuple to one chunk.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Open initializes an operator and its children. Next asks it to produce the next tuple or report completion. Close releases memory, files, buffers, and child state. The operator can hide complex internal state: a scan cursor, a sort run, a hash table, a nested-loop position, or an aggregate table.',
        'PostgreSQL describes its executor as a demand-pull pipeline mechanism: each plan node is called to deliver one more row or report that it is done. A MergeJoin node recursively asks its children for rows; a Sort node must first consume and sort all child rows before returning its first output row.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The iterator model is composable and memory-conscious. It lets LIMIT stop early, lets filters stream rows immediately, and lets operators be added without rewriting the whole engine. The tradeoff is per-tuple overhead: function calls, virtual dispatch, expression interpretation, and branch-heavy control at every row boundary.',
        'Blocking operators are the pressure points. Sort, hash aggregate, hash join build phases, and materialization nodes can consume full inputs before producing output. They are where memory limits, spilling, latency to first row, and plan shape become visible.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'Slow first page: a product listing query has ORDER BY created_at LIMIT 50. Without an index matching the order, the executor scans many rows and blocks in Sort before returning any page. A covering index on the filter and order key lets the executor stream rows in the needed order.',
        'CPU-heavy analytics: a tuple-at-a-time executor evaluates the same predicate over millions of column values. A vectorized engine batches values into chunks, carries selection vectors, and amortizes overhead. DuckDB uses this route for embedded analytical workloads.',
        'Parallel scan: one iterator tree is simple, but one core is not enough. Volcano adds exchange operators that bridge demand-driven local iterators with data-driven producer-consumer pipelines across processes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Volcano is not just "old and slow." It is a clean abstraction that still explains many production executors. The mistake is assuming the abstraction determines every performance property. Real engines specialize expressions, vectorize hot paths, compile fragments, push filters, add exchanges, and spill carefully.',
        'Another trap is ignoring blocking nodes. A plan can look like a pipeline but still hide a Sort or HashAggregate that must consume everything before it returns one row. Reading EXPLAIN means reading both the tree shape and the streaming/blocking behavior of each node.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL Executor documentation at https://www.postgresql.org/docs/current/executor.html and Graefe, Volcano: An Extensible and Parallel Query Evaluation System, at https://cs-people.bu.edu/mathan/reading-groups/papers-classics/volcano.pdf. DuckDB internals describe the vectorized contrast at https://duckdb.org/docs/current/internals/overview and https://duckdb.org/docs/current/internals/vector.',
        'Study SQL Join Algorithms Primer for the join operators this model runs, PostgreSQL Query Planner Case Study for the plan-selection side, Cascades Memo Query Optimizer for the optimizer framework descended from Volcano ideas, DuckDB Vectorized Execution Case Study for the batch-oriented successor, Backpressure for the demand-pull intuition, and Exchange Operator Parallel Query for the parallel bridge.',
      ],
    },
  ],
};
