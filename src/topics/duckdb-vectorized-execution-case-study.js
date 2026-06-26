// DuckDB vectorized execution: DataChunks, tight operators, and embedded OLAP.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'duckdb-vectorized-execution-case-study',
  title: 'DuckDB Vectorized Execution Case Study',
  category: 'Systems',
  summary: 'A modern analytical execution engine: move DataChunks through vectorized operators, keep pipelines cache-friendly, and run OLAP inside the process.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['data chunks', 'pipeline breaker'], defaultValue: 'data chunks' },
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

function duckGraph(title) {
  return graphState({
    nodes: [
      { id: 'scan', label: 'column scan', x: 0.8, y: 3.5, note: 'Parquet/table' },
      { id: 'chunk', label: 'DataChunk', x: 2.5, y: 3.5, note: 'vector batch' },
      { id: 'filter', label: 'filter', x: 4.1, y: 2.2, note: 'selection vector' },
      { id: 'project', label: 'project', x: 4.1, y: 4.8, note: 'expressions' },
      { id: 'hash', label: 'hash aggregate', x: 6.2, y: 3.5, note: 'pipeline breaker' },
      { id: 'sink', label: 'result chunk', x: 8.4, y: 3.5, note: 'client fetch' },
      { id: 'planner', label: 'optimizer', x: 2.5, y: 1.0, note: 'plan shape' },
    ],
    edges: [
      { id: 'e-scan-chunk', from: 'scan', to: 'chunk', weight: 'vectors' },
      { id: 'e-chunk-filter', from: 'chunk', to: 'filter', weight: 'predicate' },
      { id: 'e-filter-project', from: 'filter', to: 'project', weight: 'selected rows' },
      { id: 'e-project-hash', from: 'project', to: 'hash', weight: 'group keys' },
      { id: 'e-hash-sink', from: 'hash', to: 'sink', weight: 'finalize' },
      { id: 'e-planner-scan', from: 'planner', to: 'scan', weight: 'operators' },
      { id: 'e-planner-hash', from: 'planner', to: 'hash', weight: 'pipeline' },
    ],
  }, { title });
}

function* dataChunks() {
  yield {
    state: duckGraph('DuckDB pushes DataChunks through operators'),
    highlight: { active: ['scan', 'chunk', 'filter', 'project', 'e-scan-chunk', 'e-chunk-filter'], compare: ['hash'] },
    explanation: 'DuckDB runs analytical queries inside the host process, but the executor still thinks in batches. A DataChunk is the work unit: many column values move through one operator call instead of one tuple at a time.',
  };

  yield {
    state: labelMatrix(
      'Inside a vectorized batch',
      [
        { id: 'values', label: 'value vector' },
        { id: 'validity', label: 'validity mask' },
        { id: 'selection', label: 'selection vector' },
        { id: 'constants', label: 'constant vector' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'benefit', label: 'benefit' },
      ],
      [
        ['column values', 'tight loops'],
        ['NULL tracking', 'branch control'],
        ['active row ids', 'cheap filtering'],
        ['one value repeated', 'avoid materializing'],
      ],
    ),
    highlight: { active: ['selection:benefit', 'values:benefit'], found: ['constants:benefit'] },
    explanation: 'Selection vectors are the key detail here. A filter can carry active row positions forward, so later operators see the same column buffers plus a smaller set of row ids rather than freshly copied columns.',
    invariant: 'Operators exchange fixed-shape chunks, not arbitrary per-row callbacks.',
  };

  yield {
    state: duckGraph('Columnar scan feeds only the columns the query needs'),
    highlight: { active: ['scan', 'chunk', 'e-scan-chunk'], found: ['planner'], compare: ['project'] },
    explanation: 'Analytical queries usually touch a subset of columns. A columnar scan can produce vectors only for referenced columns, which pairs naturally with Parquet and in-process analytics over local files.',
  };

  yield {
    state: labelMatrix(
      'Row-at-a-time versus vectorized',
      [
        { id: 'iterator', label: 'Volcano iterator' },
        { id: 'vector', label: 'vectorized' },
        { id: 'compiled', label: 'compiled' },
        { id: 'duck', label: 'DuckDB style' },
      ],
      [
        { id: 'unit', label: 'work unit' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['one tuple', 'simple but overhead per row'],
        ['one batch', 'cache-friendly tight loops'],
        ['generated code', 'fast but compile complexity'],
        ['DataChunk pipeline', 'portable embedded OLAP'],
      ],
    ),
    highlight: { found: ['vector:tradeoff', 'duck:tradeoff'], compare: ['iterator:tradeoff'] },
    explanation: 'The case-study point is execution granularity. DuckDB chooses batches large enough for CPU efficiency but still general enough for many operators and platforms.',
  };
}

function* pipelineBreaker() {
  yield {
    state: duckGraph('Hash aggregation breaks a streaming pipeline'),
    highlight: { active: ['project', 'hash', 'e-project-hash'], compare: ['sink'], found: ['planner'] },
    explanation: 'The animation highlights the operator that cannot simply pass chunks along. Hash aggregation has to collect group state first, so it breaks the smooth scan-filter-project pipeline.',
  };

  yield {
    state: labelMatrix(
      'Pipeline roles',
      [
        { id: 'source', label: 'source' },
        { id: 'operator', label: 'operator' },
        { id: 'sink', label: 'sink' },
        { id: 'breaker', label: 'breaker' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'job', label: 'job' },
      ],
      [
        ['scan', 'produce chunks'],
        ['filter/project', 'transform chunks'],
        ['aggregate build', 'consume chunks'],
        ['hash join/order by', 'materialize state'],
      ],
    ),
    highlight: { active: ['source:job', 'operator:job', 'sink:job'], compare: ['breaker:job'] },
    explanation: 'The scheduler can split a plan into pipelines. Pipeline breakers define where materialized state, parallel partitioning, and finalization have to be coordinated.',
  };

  yield {
    state: duckGraph('Embedded analytics keeps data movement small'),
    highlight: { active: ['scan', 'planner', 'chunk'], found: ['sink'], compare: ['e-hash-sink'] },
    explanation: 'DuckDB runs inside the host process, so notebooks, scripts, and applications can query local files without shipping data to a separate server first.',
  };

  yield {
    state: labelMatrix(
      'Complete local analytics case study',
      [
        { id: 'read', label: 'read Parquet' },
        { id: 'filter', label: 'filter date' },
        { id: 'group', label: 'group by user' },
        { id: 'export', label: 'export result' },
      ],
      [
        { id: 'engineMove', label: 'engine move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['scan needed columns', 'schema drift'],
        ['selection vectors', 'predicate selectivity'],
        ['hash aggregate', 'memory pressure'],
        ['result chunks', 'client materialization'],
      ],
    ),
    highlight: { found: ['read:engineMove', 'filter:engineMove', 'group:engineMove'], compare: ['group:risk'] },
    explanation: 'Read this as the end-to-end local analytics path: scan only needed columns, filter by selection vector, aggregate into hash state, then return compact result chunks. The risks are schema drift, selectivity surprises, and memory pressure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'data chunks') yield* dataChunks();
  else if (view === 'pipeline breaker') yield* pipelineBreaker();
  else throw new InputError('Pick a DuckDB vectorized-execution view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a query plan moving batches instead of single rows. DuckDB is an embedded analytical database, OLAP means online analytical processing, and a DataChunk is a bounded batch of column vectors. Active state is the chunk or operator currently executing, visited state is input already consumed, and found state is the output chunk or aggregate state now guaranteed by the processed input.',
        'The safe inference is batch-local. If a filter marks positions 1, 4, and 7 as selected, later operators can process those positions without copying every surviving value immediately. That is why the animation should track vectors, selection vectors, and pipeline breakers separately.',
        {type: "callout", text: "Vectorized execution changes the executor contract from one tuple at a time to fixed-shape column batches, putting CPU time into tight loops instead of per-row dispatch."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Analytical queries often scan many rows, read a few columns, filter most rows, and aggregate the survivors. DuckDB targets the case where data is local to a notebook, script, application, or file directory. It needs database execution quality without requiring a separate database server.',
        'That shape only works if the executor uses CPU caches and memory bandwidth well. If every row becomes a separate object and crosses every operator boundary alone, the CPU spends too much time on dispatch and materialization. Vectorized execution changes the unit of work to column batches.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The classic executor is row-at-a-time iteration. A scan returns one tuple, a filter tests it, a projection computes expressions, and an aggregate consumes it. The interface is elegant because every operator can ask its child for the next row.',
        'A different simple approach is to load everything into an application dataframe and run analysis there. That can work for small data. It loses database behaviors such as predicate pushdown, projection pushdown, SQL planning, streaming through bounded memory, and structured NULL semantics.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The row iterator wall appears when next is called millions of times. A predicate such as event_date between two bounds should be a tight loop over dates, not repeated trips through many small virtual calls. The cost is overhead around the useful comparison.',
        'The all-in-memory dataframe wall appears when the input is larger than the convenient working set. Reading every column and materializing every intermediate result can dominate the query. Analytical engines need to push work down, stream bounded batches, and spill or break pipelines when an operator requires global state.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'DuckDB moves DataChunks through operators. A DataChunk holds vectors for several columns over a bounded number of rows. Operators process a batch at a time, which amortizes interface overhead and makes loops over contiguous data more likely.',
        'The selection vector is the key detail. A filter can store the positions that passed instead of copying all surviving values into a new dense vector immediately. Later operators can use the same buffers plus selected positions, reducing memory movement on common analytical filters.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A query plan starts as logical scan, filter, project, join, aggregate, and sort operations. The optimizer chooses a physical plan, and the executor runs it as pipelines. Sources produce chunks, regular operators transform chunks, and sinks consume chunks into state or final output.',
        'For select user_id, count star from events where event_date is in one week group by user_id, the scan reads event_date and user_id columns. The filter evaluates the date predicate over the date vector and creates a selection vector. The aggregate reads selected user_id positions and updates a hash table of group counts.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Vectorized execution works because analytical work matches array loops. CPUs handle repeated operations over contiguous memory better than many tiny object dispatches. Processing a chunk keeps memory bounded while still giving each operator enough values to amortize overhead.',
        'SQL semantics are preserved because vectors are not raw arrays alone. They carry type information, validity masks for NULLs, constant-vector representations, and selection state. Operators can stay general without falling back to per-row object handling for the common path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Chunk size controls behavior. Too small and function-call overhead appears too often. Too large and temporary memory, cache pressure, and latency to first output can rise. The point is not maximum batch size; it is a batch size that keeps loops efficient without blowing the working set.',
        'Pipeline breakers dominate some queries. A filter and projection can stream chunk by chunk, but a hash aggregate must keep group state and a sort must collect enough rows to order them. If distinct group count doubles, aggregate hash-table memory can roughly double even though the scan remains vectorized.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DuckDB is useful when analytical data is already local: Parquet directories, CSV exploration, Arrow data, dataframes, local logs, and embedded product analytics. The access pattern is often scan a few columns, filter many rows, aggregate or join, and return a result much smaller than the input.',
        'It also fits tests and tools that need real SQL inside the process. A command-line investigation can query files without provisioning a warehouse. An application can ship embedded analytics while still using database planning and vectorized execution.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DuckDB is not a replacement for a distributed warehouse when the workload needs many concurrent tenants, cluster-wide governance, strict workload isolation, or petabyte-scale shared storage. It can be part of that workflow, but the embedded process boundary is a real constraint. Locality is a feature until coordination becomes the problem.',
        'Vectorization also does not fix bad plans. A huge result materialized into a client dataframe can move the bottleneck outside the executor. Large strings, user-defined functions, nested data, low-selectivity filters, and poor join order can reduce the clean tight-loop path.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a Parquet file has 10,000,000 rows and 40 columns, but the query needs event_date and user_id. Projection pushdown reads 2 columns instead of 40. If chunks contain 2,048 rows, the scan emits about 4,883 chunks instead of 10,000,000 row calls.',
        'If the date filter keeps 5 percent of rows, each 2,048-row chunk keeps about 102 positions on average. The aggregate updates counts only for selected user_id positions. The query still reads many values, but the hot path is vector loops and hash-table updates instead of per-row operator dispatch.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include DuckDB internals at https://duckdb.org/docs/current/internals/overview, DuckDB vector documentation at https://duckdb.org/docs/current/internals/vector, the DuckDB SIGMOD demo paper at https://duckdb.org/pdf/SIGMOD2022-demo-duckdb.pdf, and the MonetDB/X100 paper at https://www.cidrdb.org/cidr2005/papers/P19.pdf. Study Volcano iterators, Apache Arrow, Parquet, hash aggregation, external sort, and join algorithms next.',
      ],
    },
  ],
};
