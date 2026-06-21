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
    explanation: 'Volcano makes every physical operator speak the same small protocol: open, next, close. The interface is tiny, but each operator can hide a cursor, hash table, sort run, file handle, or join position.',
  };

  yield {
    state: planGraph('A parent pulls one row from its child tree'),
    highlight: { active: ['client', 'limit', 'join', 'e-client-limit', 'e-limit-join'], compare: ['sort', 'scanA', 'scanB'] },
    explanation: 'Read the arrows as demand, not data flood. The client asks Limit for one row, Limit asks Join, Join asks its children, and the request keeps descending until a leaf can produce a tuple.',
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
    explanation: 'This table is the first-row latency map. Scan and filter can return quickly; Sort and HashAggregate often need the whole child input before returning anything.',
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
    explanation: 'Vectorized execution changes the work unit. Instead of one next call per tuple, one chunk call carries many values, so predicates can run in tight loops with selection vectors.',
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
      heading: 'Why this exists',
      paragraphs: [
        'A SQL query is compiled into a physical plan: scans read tables, filters reject rows, joins combine relations, sorts impose order, aggregates summarize groups, and limits stop early. The executor needs a way to run that tree without writing a custom program for every possible combination of operators.',
        {type: 'callout', text: 'Volcano turns a whole query plan into nested streams, so every operator can be composed through the same open, next, close contract.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of server racks in a datacenter', caption: 'Database execution is a physical systems problem: storage, memory, CPU, and request latency all meet inside the executor. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg.'},
        'The Volcano iterator model gives every physical operator the same small interface: open, next, and close. A parent asks a child for one more tuple. That request recursively travels down the plan tree until a leaf can produce a row, and the row returns upward through the same operators. PostgreSQL still documents its executor in this demand-pull style.',
      ],
    },
    {
      heading: 'The obvious executor and wall',
      paragraphs: [
        'The obvious executor is a set of special cases. If the plan is scan-filter-project, run one loop. If it is scan-sort-limit, run another. If it is join-aggregate-sort, write another path. This seems reasonable while the operator set is small, but query planners produce many shapes, and database systems keep adding operators.',
        'The wall is composability. A query engine needs scans, index scans, nested-loop joins, hash joins, merge joins, sorts, aggregates, materialization, limits, exchanges, subquery nodes, and write nodes to fit together. Hard-coded control flow turns every new operator into a rewrite of the executor. It also makes resource cleanup, cancellation, errors, and early LIMIT termination harder to keep consistent.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that every physical operator can be treated as a lazy stream with local state. open initializes the stream. next returns the next tuple or reports completion. close releases resources. The parent does not know whether a child is scanning a file, probing a hash table, merging sorted inputs, or draining a sorted run.',
        'This hides complexity behind a uniform contract. A Sort node can consume its whole child before producing the first row, while a Filter node can return as soon as it sees a passing tuple. Both still answer the same next call. The executor tree becomes a recursive composition of small state machines.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Execution starts at the root. The client asks the top node for a row. A Limit node may ask its child until it has returned enough rows. A Join node may ask both children. A scan reads from storage. A filter evaluates a predicate before passing a tuple upward. Each operator stores only the state it needs to resume on the next call.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'A physical query plan is a directed operator graph; Volcano defines how demand and tuples move along those edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Blocking operators are still legal, but they change latency and memory behavior. PostgreSQL gives the classic example: a Sort node repeatedly calls its child until the input is exhausted, performs the sort, and only then returns its first output row. Hash aggregate and hash join build phases have the same shape: the iterator interface stays uniform while the internal state becomes large. This is why the same tree notation can represent a streaming plan or a plan with a full materialization point in the middle.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The open-next-close view shows demand flowing downward, not data flooding upward. The client asks Limit, Limit asks Join, Join asks its children, and the request continues until a leaf can produce a tuple. This proves the backpressure property: a child does not need to produce the next row until a parent asks.',
        'The blocking-sort view proves that a tree edge does not always mean immediate streaming. Sort looks like another child node, but it must pull all input before it can answer its parent. The vectorized contrast proves that modern engines often keep operator boundaries while changing the work unit from one tuple to one chunk.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local composition. Each operator promises that repeated next calls enumerate exactly the rows defined by its physical operation, then report completion. If each child enumerates its output correctly, a Filter can correctly return the subset that satisfies its predicate, a Limit can correctly stop after k rows, and a Join can correctly combine rows according to its join algorithm.',
        'The model also works because state ownership is explicit. A scan owns its cursor. A nested-loop join owns the current outer tuple and inner position. A sort owns its materialized run. close gives the engine a structured cleanup path for buffers, files, memory contexts, and child operators. That discipline matters for cancellation and errors as much as for normal query completion.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Volcano is memory-conscious for streaming plans. A scan-filter-limit query can stop early and hold little state. Doubling the table does not matter if an index and LIMIT let the executor find enough qualifying rows quickly. The model also handles pipelining naturally because rows move only when requested. Its best case is therefore not tied to table size alone; it is tied to where selective access and early termination appear in the plan.',
        'The tax is per-tuple overhead. Every row can cross many next calls, branches, function pointers, virtual dispatch sites, expression interpreters, and tuple materialization boundaries. For analytical scans over millions of values, that overhead can dominate simple arithmetic. Blocking nodes add a second cost: memory pressure, spilling, and slow first-row latency when a Sort or HashAggregate must consume the whole child input.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die with compute and cache regions', caption: 'The tuple-at-a-time tax is paid on real silicon: branches, calls, cache misses, and materialization boundaries can dominate simple predicates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
        'This is why execution plans should be read as latency shapes, not only cost totals. Ask which operators can produce the first row immediately, which ones must consume a child first, which ones can spill, and which ones break a pipeline boundary.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The model wins when composability, early stopping, and clear operator ownership matter. OLTP-style queries often return few rows and benefit from lazy pulls through indexes, filters, joins, and limits. It is also an excellent teaching model for reading EXPLAIN plans because each node can be understood as a state machine that asks children for rows.',
        'It also wins as a baseline inside more advanced engines. Vectorized and compiled systems still need physical operators, state ownership, blocking-node analysis, and exchange boundaries. Volcano gives the vocabulary for those questions even when the engine changes the work unit or generates specialized code for hot fragments. If a learner can explain where next calls happen, they can usually explain where a modern engine replaced those calls with batches, generated loops, or parallel exchanges.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tuple-at-a-time execution can be a poor fit for CPU-heavy analytics. If a predicate is applied to 100 million column values, a vectorized engine can run tight loops over contiguous arrays and selection vectors, while a naive iterator may bounce through layers of calls and branches per row. DuckDB documents DataChunks and Vectors as the execution format for this reason.',
        'The model can also hide first-row latency if the reader treats every edge as a pipeline. A plan with ORDER BY and no matching index may scan and sort a large input before returning page one. A hash aggregate may hold all groups. A hash join may build a table before probing. Reading a plan means marking which nodes stream, which block, and where memory can spill.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: PostgreSQL Executor documentation at https://www.postgresql.org/docs/current/executor.html and Graefe, Volcano: An Extensible and Parallel Query Evaluation System, at https://cs-people.bu.edu/mathan/reading-groups/papers-classics/volcano.pdf. DuckDB internals describe the vectorized contrast at https://duckdb.org/docs/current/internals/overview and https://duckdb.org/docs/current/internals/vector.',
        'Study SQL Join Algorithms Primer for the operators the executor runs, PostgreSQL Query Planner Case Study for plan selection, Cascades Memo Query Optimizer for optimizer lineage, DuckDB Vectorized Execution Case Study for the chunk-oriented successor, Backpressure for the demand-pull intuition, and Exchange Operator Parallel Query for the bridge from local iterators to parallel execution.',
      ],
    },
  ],
};
