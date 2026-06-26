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
    explanation: `Volcano makes every physical operator speak the same small protocol: ${'open'}, ${'next'}, ${'close'} — ${3} operations total. The interface is tiny, but each operator can hide a cursor, hash table, sort run, file handle, or join position.`,
  };

  yield {
    state: planGraph('A parent pulls one row from its child tree'),
    highlight: { active: ['client', 'limit', 'join', 'e-client-limit', 'e-limit-join'], compare: ['sort', 'scanA', 'scanB'] },
    explanation: `Read the ${7} arrows as demand, not data flood. The ${'client'} asks ${'limit'} for one row, ${'limit'} asks ${'join'}, ${'join'} asks its children, and the request keeps descending through ${7} nodes until a leaf can produce a tuple.`,
    invariant: `Pull execution gives natural backpressure across all ${7} plan nodes: no child produces the ${'next()'} row until a parent asks.`,
  };

  yield {
    state: planGraph('The row returns up the same tree'),
    highlight: { active: ['scanA', 'row', 'client', 'e-scanA-row', 'e-row-client'], found: ['limit'], compare: ['join'] },
    explanation: `A ${'scan A'} reads a ${'tuple'}, the ${'join'} applies its logic, the ${'limit'} counts it, and the ${'client'} receives a row via the ${'return'} edge. Complex plans are many nested calls to the same ${3}-operation protocol.`,
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
    explanation: `The design is durable because each of the ${7} operators can be developed and reasoned about locally. The main cost is repeated ${'next()'} function-call and interpretation overhead for every ${'tuple'}.`,
  };
}

function* blockingSort() {
  yield {
    state: planGraph('A Sort node is a blocking operator'),
    highlight: { active: ['sort', 'scanA', 'e-sort-scanA'], compare: ['client', 'limit'], found: ['row'] },
    explanation: `Some operators cannot return their first output immediately. ${'sort'} must ${'pull all'} every child row from ${'scan A'}, sort them, and only then deliver the first sorted row.`,
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
    explanation: `This table is the first-row latency map across ${5} operators. ${'scan'} and ${'filter'} are streaming — they can return now; ${'sort'} and ${'hash agg'} are blocking — they need the whole child input before returning anything.`,
  };

  yield {
    state: planGraph('Blocking state becomes the operational bottleneck'),
    highlight: { active: ['sort', 'scanA'], compare: ['row', 'client'], found: ['join'] },
    explanation: `A ${'sort'} can spill, a ${'hash agg'} can exceed memory, and a hash join can repartition. The ${3}-operation iterator interface (${'open'}, ${'next'}, ${'close'}) remains simple while the operator state becomes the hard engineering problem.`,
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
    explanation: `A real production fix may be an index that matches the ORDER BY, letting the executor stream already-ordered tuples instead of building a blocking ${'sort'} that must ${'pull all'} before it can return page one.`,
  };
}

function* vectorizedContrast() {
  yield {
    state: planGraph('Volcano pulls one tuple at a time'),
    highlight: { active: ['client', 'limit', 'join', 'row', 'e-client-limit', 'e-row-client'], compare: ['scanA'] },
    explanation: `Tuple-at-a-time execution across ${7} plan nodes is simple and lazy. It can also pay ${'next()'} overhead at every row boundary, especially in analytical scans where the same operation applies to millions of values.`,
  };

  yield {
    state: vectorGraph('Vectorized engines exchange chunks instead'),
    highlight: { active: ['scan', 'chunk', 'filter', 'project', 'e-scan-chunk', 'e-chunk-filter', 'e-filter-project'], found: ['sink'] },
    explanation: `Vectorized execution changes the work unit across ${6} vector-pipeline nodes. Instead of one ${'next()'} call per ${'tuple'}, one ${'chunk'} call carries ${'2048 rows'}, so predicates can run in tight loops with selection vectors.`,
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
    explanation: `Modern engines mix these ${4} models. Volcano processes one ${'tuple'} at a time. Vectorized execution processes one ${'chunk'} at a time. Compiled engines generate ${'code'} per plan. Exchange operators split work into ${'packet'}s for parallel execution.`,
  };

  yield {
    state: vectorGraph('The cluster link: vectorization meets pipelines'),
    highlight: { active: ['chunk', 'sink', 'client'], compare: ['scan', 'filter', 'project'], found: ['e-sink-client'] },
    explanation: `This is why DuckDB, Dremel, and parallel warehouses belong beside Volcano. The vector pipeline pushes ${'2048 rows'} per ${'chunk'} through ${6} nodes from ${'scan'} to ${'client'} via ${5} edges — all answering the same question: how should operators pass intermediate data without wasting CPU, memory, or network?`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the plan from the root downward. A SQL plan is a tree of operators, where an operator is a small state machine such as a scan, filter, join, sort, or limit. Active highlights show the operator currently receiving a request for the next row, and found highlights show rows that have safely passed upward.',
        {type: 'image', src: './assets/gifs/volcano-iterator-query-execution.gif', alt: 'Animated walkthrough of the volcano iterator query execution visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is demand pull: a child produces a tuple, meaning one row-like record, only because a parent asked for it. When a Sort or HashAggregate stops the flow, mark it as blocking, because it must consume many child rows before it can return one parent row.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A database does not execute SQL text directly. It first builds a physical query plan, which is a chosen arrangement of scans, filters, joins, grouping, ordering, and limits. The executor needs one way to run many possible plan shapes without writing a custom loop for every combination.',
        {type: 'callout', text: 'Volcano turns a whole query plan into nested streams, so every operator can be composed through the same open, next, close contract.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of server racks in a datacenter', caption: 'Database execution is a physical systems problem: storage, memory, CPU, and request latency all meet inside the executor. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg.'},
        'The Volcano iterator model gives every operator the same contract: open prepares it, next returns one tuple or says it is done, and close releases its resources. That contract lets a planner assemble a new tree while the executor still runs the tree by repeated calls to the same small interface.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious executor is a set of special-purpose loops. A scan-filter-project query gets one hand-written loop, a join-aggregate query gets another, and an order-by-limit query gets another. This is direct and fast while the operator set is small.',
        'The approach breaks down because query planners can combine many physical operators in many orders. Every new operator multiplies the paths that must handle cancellation, cleanup, early stopping, and errors.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is composability. Adding one physical operator should not require rewriting the control flow for every parent and child that might surround it. A hard-coded executor also makes resource ownership inconsistent across plan shapes.',
        'The second wall is latency shape. A plan edge can mean streaming one tuple at a time, or it can hide a blocking operator that reads all input before producing anything. The executor needs to express both cases inside one tree.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat every physical operator as a lazy stream with private state. Lazy means it does work only when asked. Private state means a scan remembers its cursor, a join remembers its current outer tuple, and a sort remembers its materialized run.',
        'This makes the whole plan a recursive composition of local state machines. The parent does not need to know whether its child is scanning a table, probing a hash table, merging sorted inputs, or draining a sorted buffer. It only knows how to call next.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Execution starts with open at the root, then opens children as needed. The client asks the root for one row. That request travels downward until a leaf can read from storage or an operator can return a row from saved state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'A physical query plan is a directed operator graph; Volcano defines how demand and tuples move along those edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'A Filter may call its child repeatedly until one tuple passes its predicate. A Limit may stop asking after k rows. A Sort may pull every child row, sort the run, and only then answer its first next call.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local composition. If each child enumerates exactly the tuples defined by its physical operation, then a Filter returns exactly the subset satisfying its predicate, a Limit returns exactly the first k child tuples, and a Join returns exactly the matching pairs its join algorithm defines.',
        'The invariant is that every operator owns enough state to resume without duplicating or skipping tuples. close preserves the same discipline for cleanup: buffers, temporary files, memory contexts, and child operators have one structured release path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For a streaming plan, memory can stay small because only the active operator states and a few tuples are live. Doubling a table does not double response time if an index plus a Limit lets the executor stop after the same number of qualifying rows. Cost follows the number of tuples pulled through each edge.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die with compute and cache regions', caption: 'The tuple-at-a-time tax is paid on real silicon: branches, calls, cache misses, and materialization boundaries can dominate simple predicates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
        'The tax is per-tuple overhead. A row can cross many next calls, branches, virtual dispatch sites, expression interpreters, and materialization boundaries. Blocking nodes add memory pressure, possible spill to disk, and high first-row latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PostgreSQL exposes this model in its executor documentation, and many database courses teach plans this way because it matches how EXPLAIN trees are read. OLTP queries benefit when indexes, filters, and limits let a lazy plan stop early.',
        'Modern engines may vectorize or compile hot fragments, but they still inherit Volcano vocabulary: physical operators, child edges, blocking points, pipeline breaks, and cleanup boundaries. Understanding next calls makes it easier to understand why a vectorized engine replaces one-row calls with chunk calls.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tuple-at-a-time execution can lose badly on analytic scans. If a predicate touches 100 million column values, a vectorized engine can run tight loops over contiguous arrays while a naive iterator pays call and branch overhead for every row.',
        'The model also misleads readers who treat every plan edge as streaming. ORDER BY without a matching index, hash aggregation over many groups, and hash join build phases may consume large inputs before returning the first row.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a plan is Limit 3 over Filter price > 100 over TableScan orders. If the scan sees prices 80, 140, 70, 200, 105, and 90, the Limit calls the Filter until three passing tuples arrive. The Filter asks the scan for five rows, rejects 80 and 70, returns 140, 200, and 105, and then the Limit stops.',
        'The scan never reads the sixth row because no parent asks for it. If a Sort sits between Filter and Limit, the behavior changes: Sort must read every filtered row before it can return the cheapest or first ordered three. Same interface, different cost shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL Executor documentation at https://www.postgresql.org/docs/current/executor.html and Goetz Graefe, Volcano: An Extensible and Parallel Query Evaluation System, at https://cs-people.bu.edu/mathan/reading-groups/papers-classics/volcano.pdf. For the vectorized contrast, read DuckDB internals at https://duckdb.org/docs/current/internals/overview and https://duckdb.org/docs/current/internals/vector.',
        'Study SQL join algorithms next for the child operators, Cascades or Volcano optimizer papers for plan generation, DuckDB vectorized execution for chunk-at-a-time execution, and exchange operators for the point where local iterator trees become parallel plans.',
      ],
    },
  ],
};
