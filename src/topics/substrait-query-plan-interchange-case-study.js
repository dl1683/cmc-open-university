// Substrait query-plan interchange: relational algebra as a portable,
// serialized contract between frontends, optimizers, and execution engines.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'substrait-query-plan-interchange-case-study',
  title: 'Substrait Query Plan Interchange Case Study',
  category: 'Systems',
  summary: 'Substrait as a query-plan data structure: relation trees, types, functions, extensions, and binary/text serialization for engine interoperability.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['plan as contract', 'extensions and engines'], defaultValue: 'plan as contract' },
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

function planGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'sql', label: 'SQL/DF', x: 0.7, y: 3.5, note: notes.sql ?? 'frontend' },
      { id: 'logical', label: 'logical', x: 2.4, y: 2.1, note: notes.logical ?? 'relations' },
      { id: 'types', label: 'types', x: 2.4, y: 5.0, note: notes.types ?? 'schema' },
      { id: 'substrait', label: 'Substrait', x: 4.8, y: 3.5, note: notes.substrait ?? 'plan' },
      { id: 'text', label: 'text', x: 6.8, y: 1.5, note: notes.text ?? 'debug' },
      { id: 'binary', label: 'binary', x: 6.8, y: 3.5, note: notes.binary ?? 'protobuf' },
      { id: 'validator', label: 'validate', x: 6.8, y: 5.5, note: notes.validator ?? 'semantics' },
      { id: 'engine', label: 'engine', x: 9.0, y: 3.5, note: notes.engine ?? 'execute' },
    ],
    edges: [
      { id: 'e-sql-logical', from: 'sql', to: 'logical', weight: 'parse' },
      { id: 'e-logical-sub', from: 'logical', to: 'substrait', weight: 'emit' },
      { id: 'e-types-sub', from: 'types', to: 'substrait', weight: 'bind' },
      { id: 'e-sub-text', from: 'substrait', to: 'text', weight: '' },
      { id: 'e-sub-binary', from: 'substrait', to: 'binary', weight: '' },
      { id: 'e-sub-validator', from: 'substrait', to: 'validator', weight: '' },
      { id: 'e-binary-engine', from: 'binary', to: 'engine', weight: 'load' },
      { id: 'e-validator-engine', from: 'validator', to: 'engine', weight: 'safe' },
    ],
  }, { title });
}

function engineGraph(title) {
  return graphState({
    nodes: [
      { id: 'calcite', label: 'Calcite', x: 0.7, y: 2.2, note: 'producer' },
      { id: 'datafusion', label: 'DataFusion', x: 0.7, y: 4.9, note: 'producer' },
      { id: 'substrait', label: 'Substrait', x: 3.2, y: 3.5, note: 'shared IR' },
      { id: 'spark', label: 'Spark', x: 5.7, y: 1.5, note: 'consumer' },
      { id: 'velox', label: 'Velox', x: 5.7, y: 3.5, note: 'consumer' },
      { id: 'duckdb', label: 'DuckDB', x: 5.7, y: 5.5, note: 'consumer' },
      { id: 'ext', label: 'ext', x: 8.2, y: 3.5, note: 'func/type' },
    ],
    edges: [
      { id: 'e-calcite-sub', from: 'calcite', to: 'substrait', weight: 'plan' },
      { id: 'e-datafusion-sub', from: 'datafusion', to: 'substrait', weight: 'plan' },
      { id: 'e-sub-spark', from: 'substrait', to: 'spark', weight: 'read' },
      { id: 'e-sub-velox', from: 'substrait', to: 'velox', weight: 'read' },
      { id: 'e-sub-duckdb', from: 'substrait', to: 'duckdb', weight: 'read' },
      { id: 'e-sub-ext', from: 'substrait', to: 'ext', weight: 'anchors' },
      { id: 'e-ext-velox', from: 'ext', to: 'velox', weight: 'impl' },
    ],
  }, { title });
}

function* planAsContract() {
  yield {
    state: planGraph('Substrait is a serialized relational plan contract'),
    highlight: { active: ['logical', 'types', 'substrait', 'e-logical-sub', 'e-types-sub'], found: ['engine'] },
    explanation: 'Substrait describes compute operations on structured data so one component can produce a plan and another component can interpret it without inventing a one-off API.',
    invariant: 'The plan must preserve semantics, not just look like a familiar SQL tree.',
  };

  yield {
    state: labelMatrix(
      'Relation tree components',
      [
        { id: 'read', label: 'read' },
        { id: 'filter', label: 'filter' },
        { id: 'project', label: 'project' },
        { id: 'agg', label: 'agg' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'declares', label: 'declares' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['schema', 'drift'],
        ['pred', '3VL'],
        ['emit', 'field'],
        ['func', 'sem'],
        ['keys', 'null'],
      ],
    ),
    highlight: { active: ['filter:declares', 'project:declares', 'agg:declares'], compare: ['join:risk'] },
    explanation: 'A query plan is a tree or DAG of relations. Each node needs more than an operator name: it needs field references, output ordering, functions, types, and semantic properties.',
  };

  yield {
    state: planGraph('Text helps humans; binary helps systems'),
    highlight: { active: ['substrait', 'text', 'binary', 'e-sub-text', 'e-sub-binary'], found: ['validator'] },
    explanation: 'The text form is useful for reading, debugging, and examples. The compact binary form is the machine path for moving plans between services or libraries.',
  };

  yield {
    state: labelMatrix(
      'Portable plan checklist',
      [
        { id: 'types', label: 'types' },
        { id: 'funcs', label: 'funcs' },
        { id: 'rels', label: 'rels' },
        { id: 'props', label: 'props' },
        { id: 'ser', label: 'ser' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'miss', label: 'if absent' },
      ],
      [
        ['schema', 'decode'],
        ['anchor', 'math'],
        ['ops', 'noexec'],
        ['props', 'slow'],
        ['ser', 'none'],
      ],
    ),
    highlight: { active: ['types:need', 'funcs:need', 'ser:need'], found: ['props:miss'] },
    explanation: 'The hard part is not drawing scan-filter-join boxes. The hard part is making every consuming engine agree on types, function meanings, field references, ordering, distribution, and extension behavior.',
  };
}

function* extensionsAndEngines() {
  yield {
    state: engineGraph('Substrait separates producers from execution engines'),
    highlight: { active: ['calcite', 'datafusion', 'substrait', 'velox'], found: ['spark', 'duckdb'] },
    explanation: 'A SQL parser, dataframe API, or optimizer can emit a Substrait plan; a separate engine can consume it. That split lets frontends and execution engines evolve independently.',
  };

  yield {
    state: labelMatrix(
      'Extension ledger',
      [
        { id: 'scalar', label: 'scalar' },
        { id: 'agg', label: 'agg' },
        { id: 'type', label: 'type' },
        { id: 'rel', label: 'rel' },
      ],
      [
        { id: 'binds', label: 'binds' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['name', 'ver'],
        ['state', 'sem'],
        ['var', 'fallback'],
        ['op', 'cap'],
      ],
    ),
    highlight: { active: ['scalar:binds', 'agg:guard'], found: ['rel:guard'] },
    explanation: 'Interoperability needs extension anchors. If one engine says "round" or "decimal" or "custom scan," the receiving engine needs a precise binding or a safe refusal path.',
    invariant: 'Unknown semantics should fail explicitly, not silently execute a different query.',
  };

  yield {
    state: engineGraph('Heterogeneous execution is useful only with validation'),
    highlight: { active: ['substrait', 'ext', 'e-sub-ext'], compare: ['spark', 'velox', 'duckdb'] },
    explanation: 'Different engines can implement different subsets and optimizations. Validation and capability checks prevent a portable plan from becoming a portability illusion.',
  };

  yield {
    state: labelMatrix(
      'Complete lakehouse handoff',
      [
        { id: 'view', label: 'view' },
        { id: 'plan', label: 'plan' },
        { id: 'check', label: 'check' },
        { id: 'run', label: 'run' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['SQL', 'dial'],
        ['plan', 'sem'],
        ['check', 'cap'],
        ['exec', 'perf'],
      ],
    ),
    highlight: { active: ['plan:artifact', 'check:artifact'], compare: ['view:risk'], found: ['run:risk'] },
    explanation: 'A view definition can be stored as a Substrait plan and consumed by multiple engines, but only if dialect differences, functions, and capabilities are made explicit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'plan as contract') yield* planAsContract();
  else if (view === 'extensions and engines') yield* extensionsAndEngines();
  else throw new InputError('Pick a Substrait view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Substrait is a specification for describing structured-data compute operations as portable relational plans. It is a data-structure contract between producers such as SQL parsers, dataframe APIs, and optimizers, and consumers such as query engines, validation tools, and execution services.',
        'This topic sits between Cascades Memo Query Optimizer, Selinger DP Join Order Optimizer, SQL Join Algorithms Primer, Apache Arrow Columnar Memory Case Study, DuckDB Vectorized Execution Case Study, and Schema Registry Case Study. Optimizers decide what should run; Substrait describes that decision in a form another system can read.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Substrait plan is built from relational operations such as read, filter, project, aggregate, join, sort, and fetch. The plan also carries types, field references, expressions, functions, output ordering, and optional physical properties such as hints or distribution. Plans can form trees or DAGs through references.',
        'Substrait supports both human-readable text serialization and compact binary serialization. The text form is helpful for debugging and examples. The binary path is the exchange format for systems that need to pass plans across process, language, or service boundaries.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core data structures are relation nodes, expression trees, type descriptors, function anchors, field references, extension declarations, and serialized plan roots. Each relation transforms input records into output records, and each expression must resolve against the ordinal field structure of its input.',
        'Extensions are not optional decoration. Production systems need a way to name scalar functions, aggregate functions, user-defined types, and custom relations. If the receiving engine cannot bind an extension, it should reject the plan or route it to a capable engine.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A lakehouse stores a SQL view that joins customers to orders, filters by active status, and aggregates revenue by region. Instead of storing only a dialect-specific SQL string, the catalog stores a Substrait plan. Spark, DataFusion, and a Velox-backed service can inspect the same relation tree, validate supported functions, and choose whether to execute or refuse.',
        'The payoff is not that every engine becomes identical. The payoff is an explicit boundary. Type resolution, null behavior, function semantics, and relation ordering are represented in the plan rather than buried inside one frontend or one execution engine.',
      ],
    },
    {
      heading: 'Cost and pitfalls',
      paragraphs: [
        'A portable plan can still be misused. SQL dialects disagree, functions have subtle semantics, decimal and timestamp behavior can differ, and physical properties such as ordering or distribution may be advisory rather than guaranteed. Substrait reduces ambiguity only when producers and consumers validate the same contract.',
        'The practical pitfall is treating interoperability as syntax conversion. If a plan drops function bindings, field ordering, null behavior, or capability checks, the receiving engine may produce a different answer or a much worse physical plan.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Substrait home at https://substrait.io/, relation basics at https://substrait.io/relations/basics/, logical relations at https://substrait.io/relations/logical_relations/, specification index at https://substrait.io/spec/specification/, and binary serialization at https://substrait.io/serialization/binary_serialization/. Study Cascades Memo Query Optimizer, Selinger DP Join Order Optimizer, SQL Join Algorithms Primer, Apache Arrow Columnar Memory Case Study, DuckDB Vectorized Execution Case Study, Velox Unified Execution Engine Case Study, Schema Registry Case Study, and Protobuf Wire Format next.',
      ],
    },
  ],
};
