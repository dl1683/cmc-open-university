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
    explanation: 'DataFusion is an extensible Rust query engine that uses Apache Arrow as its in-memory format. SQL and DataFrame APIs both lead into a structured logical plan.',
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
    explanation: 'The plan pipeline is explicit: parse, build a LogicalPlan, optimize it, lower it to an ExecutionPlan, then stream Arrow RecordBatches. Each stage has a different failure mode.',
  };

  yield {
    state: fusionGraph('The physical plan executes partitioned Arrow streams'),
    highlight: { active: ['physical', 'parts', 'arrow', 'result', 'e-physical-parts', 'e-physical-arrow', 'e-arrow-result'], compare: ['opt'] },
    explanation: 'Physical operators contain details that logical plans avoid: algorithm choices, partition counts, ordering, repartitioning, memory behavior, and the concrete streams that produce RecordBatches.',
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
    explanation: 'Every extension needs a contract. A table provider must report schema and statistics; a function must bind types; a rule must preserve semantics; a physical operator must emit valid Arrow batches.',
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
    explanation: 'A realistic product can embed DataFusion to query logs, expose SQL to users, register a domain UDF, and return Arrow batches without building a new optimizer and execution engine from scratch.',
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
      heading: 'What it is',
      paragraphs: [
        'Apache DataFusion is an extensible query engine written in Rust that uses Apache Arrow as its in-memory format. It is meant for developers building databases, analytics systems, dataframes, observability tools, and domain-specific query products.',
        'This topic links Apache Arrow Columnar Memory Case Study, DuckDB Vectorized Execution Case Study, Velox Unified Execution Engine Case Study, Apache Calcite Planner and Adapter Case Study, and Substrait Query Plan Interchange Case Study. DataFusion is where plan representation meets Arrow-native execution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SQL or DataFrame calls build a logical plan. The optimizer rewrites that plan with rules such as projection pushdown, filter pushdown, simplification, and join improvements. The physical planner lowers the optimized logical plan into execution operators.',
        'Execution operators produce Arrow RecordBatches, often across partitions. That makes the data-plane contract concrete: every operator consumes and emits columnar batches with known schemas rather than ad hoc row objects.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The central structures are LogicalPlan, expressions, schemas, table providers, statistics, optimizer rules, ExecutionPlan operators, partitions, streams, and Arrow arrays. LogicalPlan captures relational intent; ExecutionPlan captures executable mechanics.',
        'The extension structures are just as important. A project can add custom tables, file formats, scalar functions, aggregate functions, logical nodes, optimizer rules, and execution operators while still using the shared planner and Arrow batch contract.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'DataFusion is a strong teaching case because it is library-shaped. Instead of treating the query engine as a black-box server, it exposes the pieces needed to embed query processing inside another product.',
        'It also shows why Arrow matters as a data structure. If tables, operators, and output all agree on Arrow arrays and RecordBatches, the system can reduce conversion cost and compose with Arrow Flight, Parquet, Python, Rust, and other analytics tooling.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Correctness risks include invalid optimizer rewrites, extension functions with ambiguous type behavior, table providers with inaccurate schemas, and custom operators that emit malformed batches. Performance risks include missing statistics, poor partitioning, skewed joins, unbounded aggregation state, and expensive conversion at boundaries.',
        'A mature embedding needs explain plans, extension contracts, resource limits, spill paths, source statistics, and clear observability around partitions and operator timing. Without those, an extensible engine becomes hard to debug in production.',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: DataFusion documentation at https://datafusion.apache.org/, logical plan documentation at https://datafusion.apache.org/library-user-guide/building-logical-plans.html, and the DataFusion Rust crate documentation at https://docs.rs/datafusion/latest/datafusion/.',
        'Study this with Apache Arrow Columnar Memory Case Study for the batch format, DuckDB Vectorized Execution Case Study for vectorized operators, Velox Unified Execution Engine Case Study for reusable execution components, and Apache Calcite Planner and Adapter Case Study for planner framework design.',
      ],
    },
  ],
};
