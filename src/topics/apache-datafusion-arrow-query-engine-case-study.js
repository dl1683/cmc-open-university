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
      heading: 'Why this exists',
      paragraphs: [
        'Apache DataFusion exists because many products need query-engine behavior without wanting to build a full database from scratch. Observability tools, lakehouse systems, dataframe libraries, embedded analytics products, and domain-specific storage engines all need scanning, filtering, joins, aggregates, expressions, optimization, and execution.',
        'The hard part is not parsing SELECT. The hard part is making queries correct, fast, extensible, explainable, and resource-aware. Users quickly want projection pushdown, filter pushdown, statistics, custom functions, partitions, joins, aggregations, explain plans, and predictable execution.',
        'DataFusion packages those query-engine pieces as a Rust library built around Apache Arrow. Arrow gives a concrete columnar batch format, and DataFusion supplies the logical planning, optimization, physical execution, and extension contracts around it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to bolt SQL onto a product by parsing queries and scanning files manually. That may work for a demo, but it breaks once users ask why a query reads all columns, why filters do not prune files, why joins explode, or why custom functions behave inconsistently.',
        'Another shortcut is to return row objects everywhere. Rows are simple to understand but poor for analytical execution. Columnar batches let operators process many values at once, skip unused columns, reuse Arrow kernels, and interoperate with other analytics tools.',
        'A third mistake is to let extensions bypass planning. A custom source or operator that skips the optimizer may be fast for one query and invisible to projection pushdown, filter pushdown, repartitioning, explain plans, and resource control.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is library-shaped query execution. DataFusion is not only a SQL engine; it is an embeddable planner and execution engine with extension points for catalogs, table providers, file formats, user-defined functions, optimizer rules, logical nodes, and physical operators.',
        'SQL or DataFrame calls build a LogicalPlan. The optimizer rewrites that plan with rules such as projection pushdown, filter pushdown, simplification, and join improvements. The physical planner lowers the optimized logical plan into ExecutionPlan operators.',
        'Execution operators produce Arrow RecordBatches, often across partitions. That makes the data-plane contract concrete: operators consume and emit columnar batches with known schemas rather than ad hoc row objects.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A query starts as SQL or a DataFrame expression. DataFusion turns it into a logical plan: scan this table, project these columns, filter these predicates, join these inputs, aggregate these groups. The optimizer rewrites that logical plan while preserving semantics.',
        'The physical planner chooses execution operators. A scan operator reads Arrow batches from a source. Filter and projection operators transform batches. Join and aggregate operators maintain hash state. Partitioning and repartitioning decide how work spreads across execution tasks.',
        'Extensions enter through narrow contracts. A table provider reports schema and statistics. A user-defined function binds types and null behavior. An optimizer rule must preserve semantics. A custom execution operator must emit valid Arrow batches.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The query-pipeline view proves that SQL is only the surface. The important chain is SQL or DataFrame call, catalog lookup, logical plan, optimizer, physical plan, partitions, Arrow batches, and output.',
        'The highlighted catalog edge matters because schema and statistics shape both correctness and optimization. Without types and statistics, pushdown and planning become guesswork.',
        'The extension view proves that extensibility is useful only when each plugin has a narrow, testable contract. Custom logic should flow through the same plan pipeline so pushdown, repartitioning, explainability, and Arrow batch validation still work.',
        'The partition and batch nodes prove why query engines are execution systems, not just parsers. Once data is split across partitions, every operator must preserve schema, ordering assumptions, memory limits, and cancellation behavior while still emitting valid Arrow batches.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because Arrow gives the engine a stable in-memory representation. Sources, operators, and outputs can agree on arrays and RecordBatches, reducing conversion cost and making the engine interoperable with Parquet, Arrow Flight, Python, Rust, and other analytics tooling.',
        'Rule-based optimization works because many query improvements are semantic rewrites: read fewer columns, push filters closer to scans, simplify expressions, prune partitions, and avoid unnecessary work. Those rewrites are difficult to recover if every extension is a one-off code path.',
        'Embedding works because products can keep their domain model while reusing the query core. An observability product can register log tables and custom functions. A storage engine can provide its own table provider. A dataframe library can expose familiar APIs while using DataFusion underneath.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'DataFusion gives a query-engine library, not a complete hosted database. Distributed scheduling, multi-tenant governance, billing, user management, durable catalog service, and operational control planes may still belong to the embedding product.',
        'Extensions carry correctness risk. A table provider with inaccurate schema or statistics can mislead planning. A user-defined function with unclear null behavior can produce wrong answers. A custom operator that emits malformed batches can poison downstream execution.',
        'Performance risk often appears at boundaries: missing statistics, poor partitioning, skewed joins, unbounded aggregation state, expensive conversion into or out of Arrow, and no visibility into operator timing or spill behavior.',
        'The tradeoff for embedders is reuse versus ownership. DataFusion can remove years of query-engine work, but the product still owns its data model, security policy, resource limits, extension review, and user-facing failure messages.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'DataFusion is useful when query processing is a component inside another product rather than a standalone database service. Observability systems, lakehouse tools, custom storage engines, dataframe systems, and embedded analytics products can reuse its planner and Arrow-native executor.',
        'It is also useful for domain-specific query layers. A product can expose SQL over logs, metrics, traces, geospatial data, or custom files without inventing a planner, expression engine, and batch executor from scratch.',
        'It is especially strong when the embedding wants Arrow as the interchange format. Returning RecordBatches lets downstream code stay in the same columnar representation instead of paying row conversion costs at every boundary between libraries.',
        'It is less useful when the main problem is cluster orchestration, transactional storage, or a complete managed SQL service. In those cases DataFusion may still be a data-plane component, but not the whole architecture.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is treating extensibility as permission to bypass contracts. If a source ignores projection pushdown, a function hides type behavior, or a custom operator bypasses batch validation, the engine becomes harder to optimize and debug.',
        'The second failure is hiding explain plans. Users need to see how a query was planned, which filters pushed down, how partitions were used, and which operators dominated runtime. Without explainability, an embedded engine feels like a black box.',
        'The third failure is underestimating resources. Joins and aggregations can grow hash state quickly. Mature embeddings need memory limits, spill paths, cancellation, metrics, and operator-level timing.',
        'A fourth failure is semantic drift between SQL, DataFrame, and extension APIs. If the same expression has different null, cast, or timestamp behavior depending on entry point, users cannot reason about correctness.',
        'A fifth failure is treating Arrow as automatic performance. Arrow helps only when operators preserve columnar flow and avoid repeated conversion into row objects or language-specific containers.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: DataFusion documentation at https://datafusion.apache.org/, logical plan documentation at https://datafusion.apache.org/library-user-guide/building-logical-plans.html, and the DataFusion Rust crate documentation at https://docs.rs/datafusion/latest/datafusion/. Study Apache Arrow Columnar Memory Case Study for the batch format, DuckDB Vectorized Execution Case Study for vectorized operators, Velox Unified Execution Engine Case Study for reusable execution components, Apache Calcite Planner and Adapter Case Study for planner framework design, Parquet Columnar Format Case Study, and SQL Join Algorithms Primer next.',
      ],
    },
  ],
};
