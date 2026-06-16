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
    explanation: 'DuckDB is an embedded analytical database. Its execution engine processes batches of values called DataChunks, so operators work on vectors instead of one row at a time.',
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
    explanation: 'Vectorized execution amortizes interpretation overhead across many rows. Selection vectors let filters pass row positions forward without immediately copying every column.',
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
    explanation: 'Many operators stream chunks through immediately. Hash aggregation is a pipeline breaker: it must build group state before it can produce final output chunks.',
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
    explanation: 'A realistic flow is a Python notebook querying a folder of Parquet files. The engine scans only needed columns, filters with vectors, groups in memory, and returns result chunks to the client.',
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
      heading: 'What it is',
      paragraphs: [
        'DuckDB is an embedded analytical database designed for local OLAP workloads. Its execution engine is vectorized: operators exchange DataChunks containing vectors of values rather than pulling one tuple at a time.',
        'This belongs beside Dremel Query Engine Case Study, Parquet Columnar Format Case Study, ClickHouse MergeTree Case Study, and Database Indexing. It teaches how CPU execution strategy matters after storage has already put data in a column-friendly shape.',
        'The core lesson is that an analytical database is not only a file format and not only a SQL parser. The physical representation of intermediate work matters. A good operator interface lets scans, filters, projections, joins, and aggregates share data without constantly reinterpreting SQL or allocating per-row objects.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A physical plan is split into pipelines. Sources such as table or Parquet scans produce DataChunks. Operators such as filters and projections transform chunks. Sinks such as hash aggregates or joins consume chunks and may become pipeline breakers because they need accumulated state.',
        'Vectors carry values, validity information for NULLs, and sometimes selection vectors that identify which rows remain active. Constant vectors and dictionary-like representations avoid unnecessary materialization. The engine gets tight CPU loops while preserving SQL semantics.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Vectorized execution reduces interpreter overhead and improves cache locality, but it introduces batch-size and materialization tradeoffs. Pipeline breakers need memory management, spilling strategies, and parallel coordination. Local embedded analytics also has to behave well inside another process, not as a separate database server.',
        'The design sits between classic Volcano iterators and full query compilation. It avoids a function call per tuple while keeping the engine portable and interactive for notebooks, command-line tools, and applications.',
        'The hidden operational question is where data is copied. If a query reads Parquet, converts to vectors, filters, groups, then returns a data frame, every boundary can either preserve columnar structure or accidentally materialize too much. The execution engine is fast when those boundaries stay narrow.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DuckDB is widely used for local analytics over CSV, Parquet, Arrow, data frames, and application-embedded query workloads. A typical case is a data scientist querying a partitioned Parquet dataset from Python without provisioning a warehouse.',
        'A complete case study is a product analytics notebook. The query scans event_date and user_id columns, filters one week, groups by user, and writes a compact result. The vectorized engine makes that flow fast because each operator touches batches of contiguous column values.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'DuckDB is not a distributed warehouse. It is excellent at embedded single-node analytics, but cluster-scale scheduling, multi-tenant governance, and long-running shared-service operations are different systems problems. Vectorization also does not eliminate bad query plans or memory-heavy aggregations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DuckDB execution format documentation at https://duckdb.org/docs/current/internals/vector, DuckDB internals overview at https://duckdb.org/docs/current/internals/overview, the DuckDB paper at https://duckdb.org/pdf/SIGMOD2022-demo-duckdb.pdf, and the MonetDB/X100 vectorized execution paper at https://www.cidrdb.org/cidr2005/papers/P19.pdf. Study Volcano Iterator Query Execution to understand the tuple-at-a-time baseline DuckDB contrasts with, SQL Join Algorithms Primer for the hash join and pipeline-breaker behavior, Exchange Operator Parallel Query for parallel execution boundaries, and Parquet Columnar Format Case Study, Dremel Query Engine Case Study, Database Indexing, and ClickHouse MergeTree Case Study for storage-side context.',
      ],
    },
  ],
};
