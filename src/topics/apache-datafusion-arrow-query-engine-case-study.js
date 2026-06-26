// Apache DataFusion query-engine case study: logical plans, optimizer rules,
// physical plans, Arrow batches, and extension points for embedded analytics.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-datafusion-arrow-query-engine-case-study',
  title: 'Apache DataFusion Arrow Query Engine Case Study',
  category: 'Systems',
  summary: 'DataFusion as an embeddable Arrow-native query engine: SQL/DataFrame APIs build logical plans, optimizers rewrite them, physical plans execute Arrow RecordBatches.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['query pipeline', 'extension points'], defaultValue: 'query pipeline' },
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

function fusionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'api', label: 'SQL/DF', x: 0.7, y: 3.5, note: notes.api ?? 'front' },
      { id: 'logical', label: 'logical', x: 2.4, y: 3.5, note: notes.logical ?? 'plan' },
      { id: 'opt', label: 'opt', x: 4.0, y: 1.8, note: notes.opt ?? 'rules' },
      { id: 'catalog', label: 'catalog', x: 4.0, y: 5.2, note: notes.catalog ?? 'tables' },
      { id: 'physical', label: 'physical', x: 5.8, y: 3.5, note: notes.physical ?? 'exec' },
      { id: 'parts', label: 'parts', x: 7.5, y: 1.8, note: notes.parts ?? 'parallel' },
      { id: 'arrow', label: 'Arrow', x: 7.5, y: 5.2, note: notes.arrow ?? 'batches' },
      { id: 'result', label: 'result', x: 9.2, y: 3.5, note: notes.result ?? 'stream' },
    ],
    edges: [
      { id: 'e-api-logical', from: 'api', to: 'logical', weight: 'build' },
      { id: 'e-logical-opt', from: 'logical', to: 'opt', weight: 'rewrite' },
      { id: 'e-catalog-logical', from: 'catalog', to: 'logical', weight: 'schema' },
      { id: 'e-opt-physical', from: 'opt', to: 'physical', weight: 'plan' },
      { id: 'e-physical-parts', from: 'physical', to: 'parts', weight: 'split' },
      { id: 'e-physical-arrow', from: 'physical', to: 'arrow', weight: 'emit' },
      { id: 'e-parts-result', from: 'parts', to: 'result', weight: 'run' },
      { id: 'e-arrow-result', from: 'arrow', to: 'result', weight: 'rows' },
    ],
  }, { title });
}

function extensionGraph(title) {
  return graphState({
    nodes: [
      { id: 'table', label: 'TableProv', x: 0.7, y: 2.0, note: 'scan' },
      { id: 'func', label: 'func', x: 0.7, y: 5.0, note: 'UDF/UDAF' },
      { id: 'logical', label: 'logical', x: 2.7, y: 3.5, note: 'enum' },
      { id: 'rule', label: 'rule', x: 4.7, y: 2.0, note: 'optimizer' },
      { id: 'planner', label: 'planner', x: 4.7, y: 5.0, note: 'physical' },
      { id: 'exec', label: 'ExecPlan', x: 6.8, y: 3.5, note: 'operator' },
      { id: 'arrow', label: 'Arrow', x: 8.7, y: 3.5, note: 'RecordBatch' },
    ],
    edges: [
      { id: 'e-table-logical', from: 'table', to: 'logical', weight: 'scan' },
      { id: 'e-func-logical', from: 'func', to: 'logical', weight: 'expr' },
      { id: 'e-logical-rule', from: 'logical', to: 'rule', weight: 'rewrite' },
      { id: 'e-logical-planner', from: 'logical', to: 'planner', weight: 'lower' },
      { id: 'e-rule-exec', from: 'rule', to: 'exec', weight: 'shape' },
      { id: 'e-planner-exec', from: 'planner', to: 'exec', weight: 'make' },
      { id: 'e-exec-arrow', from: 'exec', to: 'arrow', weight: 'stream' },
    ],
  }, { title });
}

function* queryPipeline() {
  yield {
    state: fusionGraph('DataFusion compiles SQL or DataFrame calls into plans'),
    highlight: { active: ['api', 'logical', 'catalog', 'e-api-logical', 'e-catalog-logical'], found: ['physical'] },
    explanation: 'DataFusion turns front-end requests into plan objects. SQL and DataFrame APIs both become LogicalPlans, which gives the optimizer a real tree to rewrite instead of a string to interpret repeatedly.',
    invariant: 'Logical plans describe what should happen; physical plans describe how execution will produce Arrow batches.',
  };

  yield {
    state: labelMatrix(
      'Plan stage map',
      [
        { id: 'parse', label: 'parse' },
        { id: 'logical', label: 'logical' },
        { id: 'opt', label: 'opt' },
        { id: 'physical', label: 'physical' },
        { id: 'run', label: 'run' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['AST', 'dial'],
        ['tree', 'sem'],
        ['rules', 'stats'],
        ['ops', 'mem'],
        ['batch', 'spill'],
      ],
    ),
    highlight: { active: ['logical:object', 'opt:object', 'physical:object'], compare: ['opt:risk'], found: ['run:object'] },
    explanation: 'Read this table as a debugging map. Parse errors, semantic plan bugs, bad optimizer rules, physical memory pressure, and batch streaming failures happen at different stages.',
  };

  yield {
    state: fusionGraph('The physical plan executes partitioned Arrow streams'),
    highlight: { active: ['physical', 'parts', 'arrow', 'result', 'e-physical-parts', 'e-physical-arrow', 'e-arrow-result'], compare: ['opt'] },
    explanation: 'The physical plan is where "what should happen" becomes "how batches will appear." Partition counts, ordering, repartitioning, memory behavior, and concrete streams live here.',
  };

  yield {
    state: labelMatrix(
      'Hot',
      [
        { id: 'scan', label: 'scan' },
        { id: 'filter', label: 'filter' },
        { id: 'join', label: 'join' },
        { id: 'agg', label: 'agg' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['batch', 'prune'],
        ['expr', 'select'],
        ['hash', 'skew'],
        ['state', 'spill'],
      ],
    ),
    highlight: { active: ['scan:uses', 'filter:uses', 'join:uses'], compare: ['agg:watch'], found: ['scan:watch'] },
    explanation: 'DataFusion teaches the same execution concerns as DuckDB and Velox in a library-first package: columnar batches, predicate pruning, expression kernels, hash state, partitions, and spill-aware execution.',
  };
}

function* extensionPoints() {
  yield {
    state: extensionGraph('DataFusion is designed to be embedded and extended'),
    highlight: { active: ['table', 'func', 'logical', 'exec', 'e-table-logical', 'e-func-logical'], found: ['arrow'] },
    explanation: 'The point of DataFusion is not only running SQL. It gives projects extension points for catalogs, table providers, file formats, functions, logical plan nodes, optimizer rules, and execution operators.',
  };

  yield {
    state: labelMatrix(
      'Extension ledger',
      [
        { id: 'table', label: 'table' },
        { id: 'file', label: 'file' },
        { id: 'func', label: 'func' },
        { id: 'rule', label: 'rule' },
        { id: 'exec', label: 'exec' },
      ],
      [
        { id: 'adds', label: 'adds' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['scan', 'schema'],
        ['format', 'stats'],
        ['expr', 'types'],
        ['rewrite', 'equiv'],
        ['op', 'batch'],
      ],
    ),
    highlight: { active: ['table:adds', 'func:adds', 'rule:adds'], compare: ['rule:guard'], found: ['exec:guard'] },
    explanation: 'Each extension point is useful only because it is narrow. A table provider reports schema and stats; a function binds types; a rule preserves semantics; an execution operator emits valid Arrow batches.',
    invariant: 'Extensibility is useful only when each plugin has a narrow, testable contract.',
  };

  yield {
    state: extensionGraph('Custom logic still flows through the same plan pipeline'),
    highlight: { active: ['logical', 'rule', 'planner', 'exec', 'e-logical-rule', 'e-logical-planner', 'e-planner-exec'], compare: ['func'] },
    explanation: 'A custom source or operator should not bypass planning. It enters the same logical and physical path so projection pushdown, filter pushdown, repartitioning, and observability can still work.',
  };

  yield {
    state: labelMatrix(
      'Embed',
      [
        { id: 'logs', label: 'logs' },
        { id: 'sql', label: 'SQL' },
        { id: 'udf', label: 'UDF' },
        { id: 'ship', label: 'ship' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'why', label: 'why' },
      ],
      [
        ['scan', 'open'],
        ['plan', 'users'],
        ['score', 'domain'],
        ['lib', 'embed'],
      ],
    ),
    highlight: { active: ['logs:move', 'sql:move', 'udf:move'], found: ['ship:why'] },
    explanation: 'This is the product shape: embed the engine, register domain sources and functions, expose SQL or dataframe calls, and return Arrow batches without building a planner and executor from scratch.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'query pipeline') yield* queryPipeline();
  else if (view === 'extension points') yield* extensionPoints();
  else throw new InputError('Pick a DataFusion view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a query becoming executable Arrow batch streams. A LogicalPlan says what the query should do; a physical plan says how operators will produce results. Active nodes are the current plan stage, and found nodes are the Arrow RecordBatches that leave the engine.',
        'In the extension view, each plugin has a narrow contract. A table provider supplies schema and scan behavior. A function supplies type and null behavior. An execution operator must emit valid Arrow batches.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'DataFusion is library-shaped query execution. The hard part is not parsing SELECT — it is making queries correct, fast, extensible, explainable, and resource-aware. DataFusion packages those query-engine pieces as a Rust library around Apache Arrow, giving products scanning, filtering, joins, aggregates, optimization, and execution without building a planner and executor from scratch.'},
        'DataFusion exists because many products need query execution as a component, not as a hosted database. Observability tools, dataframe systems, lakehouse services, and custom storage engines need scans, filters, joins, aggregates, expressions, and explain plans. They should not each rebuild a query engine from zero.',
        'DataFusion packages the core as a Rust library around Apache Arrow. Arrow supplies the columnar batch format. DataFusion supplies logical planning, optimization, physical execution, and extension points.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to parse SQL and manually scan files or custom tables. That works until users ask why filters do not prune files, why only needed columns are not read, or why joins run out of memory. The product has crossed from parsing into query-engine behavior.',
        'Another shortcut is to return row objects everywhere. Rows are convenient for application code, but analytical operators want columns. Arrow RecordBatches let operators process many values at once and avoid converting through row-shaped containers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is shared execution complexity. A real engine needs optimizer rules, catalogs, statistics, partitioning, memory limits, spill paths, expression kernels, and explainability. Each feature affects the others.',
        'The second wall is extension safety. If a custom source bypasses planning, projection pushdown and filter pushdown disappear. If a custom function hides null behavior, correctness changes by entry point. Extensions need contracts or the engine fragments.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is embeddable, Arrow-native query execution. SQL and DataFrame APIs both build LogicalPlans. Optimizer rules rewrite those plans. Physical planning lowers them into ExecutionPlan operators that consume and emit Arrow RecordBatches.',
        'The same pipeline handles built-in and custom logic. A domain table, a user-defined function, or a custom operator should enter through a planned interface. That keeps pushdown, repartitioning, explain plans, and metrics available.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A query starts at the SQL or DataFrame API, resolves tables through a catalog, and becomes a LogicalPlan. Optimizer rules remove unused columns, push predicates toward scans, simplify expressions, prune partitions, and improve joins where metadata allows.',
        'The physical planner chooses concrete operators. Scans read batches, filters and projections transform batches, joins and aggregates maintain hash state, and repartitioning spreads work. The result is a stream of Arrow RecordBatches with a known schema.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because Arrow gives every operator the same data-plane contract. Operators do not have to agree on language objects or custom row structs. They agree on typed arrays, validity bitmaps, offsets, and RecordBatch schemas.',
        'Correctness depends on plan semantics and batch validity. Optimizer rules must preserve query meaning, and physical operators must preserve schema, null behavior, ordering assumptions where required, and cancellation behavior. A malformed batch can poison every downstream operator.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'DataFusion reduces build cost for an embedding product, but it is not a complete managed warehouse. The product still owns security, tenancy, durable catalogs, cluster scheduling, billing, resource policy, and user-facing errors. DataFusion is the query core, not the whole platform.',
        'Runtime cost behaves by operator. Scans are I/O and pruning problems, filters are expression-kernel problems, joins are hash-state and skew problems, and aggregates are state and spill problems. A good embedding exposes operator timing and memory so users can see which behavior dominates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DataFusion fits embedded analytics, log query systems, custom lakehouse engines, dataframe libraries, observability products, and domain-specific SQL layers. It is especially useful when the product wants Arrow as the interchange format.',
        'It can also be a component inside larger systems. A distributed platform may use DataFusion for local execution while owning scheduling and storage itself. That division works when the boundary is explicit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when extensions bypass contracts. A source that ignores projection pushdown, a function with unclear null behavior, or an operator that emits invalid batches makes the engine harder to optimize and trust. Extensibility without validation becomes fragmentation.',
        'It also fails when users expect a full database. Transactions, multi-tenant governance, durable catalog operations, and cluster orchestration are not solved just because a query can run. The embedding product must own those layers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a log product runs SELECT service, count(*) FROM logs WHERE status >= 500 GROUP BY service over 100 million rows. If the table has 20 columns but the query needs only service and status, projection pushdown can avoid reading 18 columns. If each column averages 8 bytes, the scan drops from about 16 GB to about 1.6 GB before compression and encoding effects.',
        'Filter pushdown then keeps only error rows. If 2 percent of rows have status >= 500, the aggregate sees about 2 million rows instead of 100 million. Correctness still requires status comparison, null handling, and service grouping to mean the same thing in the scan and aggregate operators.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DataFusion documentation, the library user guide, and the Rust crate docs. Study Apache Arrow columnar memory, query planning, vectorized execution, hash joins, Parquet scanning, and Apache Calcite next.',
        'The exercise is to implement a tiny table provider that reports schema, statistics, and projection pushdown. Run one query before and after pushdown and compare bytes read. That makes the planner contract concrete.',
      ],
    },
  ],
};