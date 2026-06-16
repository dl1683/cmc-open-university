// Apache Calcite planner and adapter case study: SQL becomes relational
// algebra, planner rules transform it, and adapters push useful work down.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-calcite-planner-adapter-case-study',
  title: 'Apache Calcite Planner & Adapter Case Study',
  category: 'Systems',
  summary: 'Apache Calcite as a planner framework: parse SQL, validate schemas, build RelNode trees, fire planner rules, cost alternatives, and push work into adapters.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['planner rules', 'adapter pushdown'], defaultValue: 'planner rules' },
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

function calciteGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'sql', label: 'SQL', x: 0.6, y: 3.5, note: notes.sql ?? 'text' },
      { id: 'parse', label: 'parse', x: 2.0, y: 2.0, note: notes.parse ?? 'AST' },
      { id: 'valid', label: 'valid', x: 2.0, y: 5.0, note: notes.valid ?? 'schema' },
      { id: 'rel', label: 'RelNode', x: 3.7, y: 3.5, note: notes.rel ?? 'algebra' },
      { id: 'rules', label: 'rules', x: 5.3, y: 1.7, note: notes.rules ?? 'rewrite' },
      { id: 'cost', label: 'cost', x: 5.3, y: 5.3, note: notes.cost ?? 'choose' },
      { id: 'phys', label: 'phys', x: 7.1, y: 3.5, note: notes.phys ?? 'traits' },
      { id: 'adapt', label: 'adapter', x: 8.7, y: 2.1, note: notes.adapt ?? 'source' },
      { id: 'rows', label: 'rows', x: 8.7, y: 5.0, note: notes.rows ?? 'result' },
    ],
    edges: [
      { id: 'e-sql-parse', from: 'sql', to: 'parse', weight: 'tokens' },
      { id: 'e-parse-valid', from: 'parse', to: 'valid', weight: 'names' },
      { id: 'e-parse-rel', from: 'parse', to: 'rel', weight: 'convert' },
      { id: 'e-valid-rel', from: 'valid', to: 'rel', weight: 'types' },
      { id: 'e-rel-rules', from: 'rel', to: 'rules', weight: 'match' },
      { id: 'e-rules-cost', from: 'rules', to: 'cost', weight: 'alts' },
      { id: 'e-cost-phys', from: 'cost', to: 'phys', weight: 'best' },
      { id: 'e-phys-adapt', from: 'phys', to: 'adapt', weight: 'push' },
      { id: 'e-adapt-rows', from: 'adapt', to: 'rows', weight: 'scan' },
    ],
  }, { title });
}

function adapterGraph(title) {
  return graphState({
    nodes: [
      { id: 'model', label: 'model', x: 0.6, y: 3.5, note: 'JSON' },
      { id: 'schema', label: 'schema', x: 2.1, y: 2.0, note: 'tables' },
      { id: 'table', label: 'table', x: 2.1, y: 5.0, note: 'row type' },
      { id: 'rel', label: 'RelNode', x: 4.1, y: 3.5, note: 'query' },
      { id: 'rule', label: 'rule', x: 5.9, y: 2.0, note: 'pattern' },
      { id: 'conv', label: 'conv', x: 5.9, y: 5.0, note: 'trait' },
      { id: 'source', label: 'source', x: 7.8, y: 3.5, note: 'CSV/JDBC' },
      { id: 'engine', label: 'engine', x: 9.3, y: 3.5, note: 'run' },
    ],
    edges: [
      { id: 'e-model-schema', from: 'model', to: 'schema', weight: '' },
      { id: 'e-schema-table', from: 'schema', to: 'table', weight: '' },
      { id: 'e-table-rel', from: 'table', to: 'rel', weight: 'scan' },
      { id: 'e-rel-rule', from: 'rel', to: 'rule', weight: 'match' },
      { id: 'e-rule-conv', from: 'rule', to: 'conv', weight: 'make' },
      { id: 'e-conv-source', from: 'conv', to: 'source', weight: 'native' },
      { id: 'e-source-engine', from: 'source', to: 'engine', weight: 'rows' },
    ],
  }, { title });
}

function* plannerRules() {
  yield {
    state: calciteGraph('Calcite turns SQL into optimized relational algebra'),
    highlight: { active: ['sql', 'parse', 'valid', 'rel', 'e-sql-parse', 'e-valid-rel'], found: ['phys'] },
    explanation: 'Calcite is a framework for building databases and data systems. It parses and validates SQL, converts it into relational algebra, and gives a planner a structured search space.',
    invariant: 'The RelNode tree is the shared contract between SQL syntax, rules, costing, and adapters.',
  };

  yield {
    state: labelMatrix(
      'RelNode ledger',
      [
        { id: 'scan', label: 'scan' },
        { id: 'filter', label: 'filter' },
        { id: 'project', label: 'project' },
        { id: 'join', label: 'join' },
        { id: 'agg', label: 'agg' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['table', 'push', 'wide'],
        ['pred', 'push', '3VL'],
        ['expr', 'trim', 'alias'],
        ['keys', 'assoc', 'null'],
        ['group', 'split', 'state'],
      ],
    ),
    highlight: { active: ['filter:rule', 'project:rule', 'join:rule'], compare: ['filter:risk'], found: ['agg:shape'] },
    explanation: 'Planner rules match algebraic shapes: filter over scan, project over join, join trees, aggregates, sorts, and converter nodes. The rule output must be equivalent even when SQL nulls, aliases, or grouping state are involved.',
  };

  yield {
    state: calciteGraph('Rules create alternatives; cost and traits choose the plan'),
    highlight: { active: ['rel', 'rules', 'cost', 'phys', 'e-rel-rules', 'e-rules-cost', 'e-cost-phys'], compare: ['adapt'] },
    explanation: 'A rule can push a filter, reorder a join, remove unused columns, or implement a logical operator with a physical convention. The planner compares alternatives with cost and required physical traits.',
  };

  yield {
    state: labelMatrix(
      'Rules',
      [
        { id: 'equiv', label: 'equiv' },
        { id: 'types', label: 'types' },
        { id: 'traits', label: 'traits' },
        { id: 'bounds', label: 'bounds' },
      ],
      [
        { id: 'must', label: 'must' },
        { id: 'why', label: 'why' },
      ],
      [
        ['same', 'ok'],
        ['stable', 'bind'],
        ['record', 'route'],
        ['guard', 'finish'],
      ],
    ),
    highlight: { active: ['equiv:must', 'types:must', 'traits:must'], found: ['bounds:why'] },
    explanation: 'The deep lesson is planner engineering, not only SQL parsing. Rules need semantic equivalence, type stability, physical trait bookkeeping, and search guardrails so optimization does not become an unbounded rewrite loop.',
  };
}

function* adapterPushdown() {
  yield {
    state: adapterGraph('Adapters make external data look like relational tables'),
    highlight: { active: ['model', 'schema', 'table', 'rel', 'e-model-schema', 'e-table-rel'], found: ['source'] },
    explanation: 'Calcite has no single storage layer. A model and adapter provide schemas, tables, row types, and table implementations so files, services, indexes, or databases can be queried through one relational interface.',
  };

  yield {
    state: labelMatrix(
      'Adapter table choices',
      [
        { id: 'scan', label: 'scan' },
        { id: 'filter', label: 'filter' },
        { id: 'trans', label: 'trans' },
        { id: 'conv', label: 'conv' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'gain', label: 'gain' },
      ],
      [
        ['all', 'simple'],
        ['pred', 'lessIO'],
        ['rel', 'rules'],
        ['native', 'fast'],
      ],
    ),
    highlight: { active: ['filter:gain', 'trans:does', 'conv:does'], compare: ['scan:does'] },
    explanation: 'The adapter can start as a plain table scan and grow into a pushdown-aware table. More advanced adapters expose relational operators and conventions so Calcite can move filters, projections, and aggregates closer to the source.',
    invariant: 'Pushdown is only valid when the source semantics match the relational expression being pushed.',
  };

  yield {
    state: adapterGraph('Planner rules negotiate pushdown with the source'),
    highlight: { active: ['rel', 'rule', 'conv', 'source', 'e-rel-rule', 'e-rule-conv', 'e-conv-source'], found: ['engine'] },
    explanation: 'A pushdown rule looks for a pattern such as project-filter-scan, then replaces it with an adapter-specific node. That node can ask the source to do less work in Calcite and more work where the data already lives.',
  };

  yield {
    state: labelMatrix(
      'Adapt',
      [
        { id: 'csv', label: 'CSV' },
        { id: 'jdbc', label: 'JDBC' },
        { id: 'index', label: 'index' },
        { id: 'api', label: 'API' },
      ],
      [
        { id: 'push', label: 'push' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['proj', 'parse'],
        ['SQL', 'dial'],
        ['pred', 'stats'],
        ['limit', 'rate'],
      ],
    ),
    highlight: { active: ['csv:push', 'jdbc:push', 'index:push'], compare: ['api:watch'], found: ['jdbc:watch'] },
    explanation: 'The same planner abstraction can wrap a CSV directory, a JDBC database, a search index, or a service API. The case-study question is always the same: which algebraic work is safe and valuable to push down?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'planner rules') yield* plannerRules();
  else if (view === 'adapter pushdown') yield* adapterPushdown();
  else throw new InputError('Pick a Calcite view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Apache Calcite is a dynamic data-management framework used to build SQL layers, query optimizers, and adapters. It provides a SQL parser, validator, relational algebra representation, planner rules, costing hooks, and adapter interfaces without forcing one storage engine underneath.',
        'This topic links directly to Cascades Memo Query Optimizer, Selinger DP Join Order Optimizer, PostgreSQL Query Planner Case Study, SQL Join Algorithms Primer, and Substrait Query Plan Interchange Case Study. Calcite is the framework version of those ideas: a reusable planner substrate rather than one database product.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A query flows from SQL text to a parsed tree, through validation against schemas and types, into a RelNode tree. Planner rules transform that tree into equivalent alternatives. Implementation rules and converters introduce physical conventions. A planner then chooses a plan using costs, traits, and rule-produced alternatives.',
        'Adapters provide schemas, tables, row types, and source-specific implementations. A basic adapter can expose a table as a scan. A stronger adapter can participate in planning so filters, projections, aggregates, limits, or joins run in the source system when that is semantically correct.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The important data structures are parse trees, validated namespaces, RelNode trees, RexNode expression trees, trait sets, planner rules, cost objects, converter nodes, schemas, tables, and adapter-specific relational nodes. Together they form a graph of alternatives over the same logical query.',
        'RelNode is the backbone. A filter, projection, aggregate, join, sort, or table scan is an object with typed inputs and outputs. Rules match subtrees and replace them with equivalent subtrees, which is the same conceptual move as a Cascades memo rewrite even when the implementation is different.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Calcite makes query planning portable. A team can build a SQL layer over files, streams, indexes, search backends, or custom services without rebuilding parsing, validation, algebra, and every optimizer mechanism from scratch.',
        'The adapter boundary is the practical teaching point. Data systems often fail by pulling too much data into the wrong layer. Calcite gives the system a disciplined way to decide which work belongs in the source, which work belongs in the planner, and which work belongs in the execution engine.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main correctness risks are unsafe rewrites, dialect mismatches, null semantics, type coercion differences, stale statistics, missing trait propagation, and source pushdown that silently changes results. A pushdown rule that is fast but semantically wrong is worse than no pushdown.',
        'The main performance risks are rule explosion, poor cost estimates, adapters that cannot expose useful metadata, and partial pushdown that hides expensive residual work. Mature systems need explain plans, rule tracing, cost debugging, and clear fallback paths.',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: Apache Calcite home page at https://calcite.apache.org/, Calcite tutorial at https://calcite.apache.org/docs/tutorial.html, and Calcite adapter documentation at https://calcite.apache.org/docs/adapter.html.',
        'Study this with Cascades Memo Query Optimizer for rule search, PostgreSQL Query Planner Case Study for planner-visible statistics, Substrait Query Plan Interchange Case Study for portable plan serialization, and Apache DataFusion Arrow Query Engine Case Study for a modern embeddable execution stack.',
      ],
    },
  ],
};
