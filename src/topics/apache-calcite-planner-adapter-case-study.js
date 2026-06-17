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
      heading: 'Why this exists',
      paragraphs: [
        `Many systems need SQL without wanting to become a full database. A file lake, stream processor, search index, federated query layer, metrics backend, or internal service may all need parsing, validation, relational algebra, rule rewriting, cost comparison, and pushdown into source systems. Rebuilding that stack from scratch is a long way to go just to answer queries over data the project already owns.`,
        `Apache Calcite exists as reusable query-planning machinery. It gives a system the front half of a database: SQL parsing, schema validation, relational expression trees, planner rules, metadata, cost, and adapter hooks. The project using Calcite still decides what storage engines exist, what execution engine runs the final plan, and what source-specific operations are safe to push down.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The tempting way to add SQL is to parse strings and hand-code a few query shapes. For a demo, this can work. SELECT a,b FROM file WHERE c > 10 becomes a scanner with a predicate. A dashboard query becomes a bespoke handler. The code feels direct because every case is visible.`,
        `The approach collapses when users expect real SQL. Aliases need name resolution. Nulls use three-valued logic. Types need coercion. Joins need ordering choices. Aggregates need grouping state. Views need expansion. Pushdown into different sources needs semantic checks. The project starts with a parser and ends up accidentally building a fragile planner.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Calcite turns SQL text into a typed relational expression tree. The central abstraction is RelNode: scans, filters, projects, joins, aggregates, sorts, windows, and adapter-specific operators become objects with row types, inputs, traits, and metadata. Once a query is a tree instead of a string, planner rules can match algebraic shapes and replace them with equivalent shapes.`,
        `Adapters are the other half. An adapter makes an external source look like relational tables and, if it is strong enough, exposes source-native operators. A weak adapter can only scan rows. A better adapter can accept filters or projections. A strong adapter can translate larger pieces of relational algebra into a source convention so work happens where the data already lives.`,
      ],
    },
    {
      heading: 'How the planner works',
      paragraphs: [
        `A Calcite pipeline starts by parsing SQL into syntax, then validating names and types against schemas. The SQL is converted into relational algebra. Planner rules then create alternatives: push a filter below a project, remove unused columns, commute or associate joins, split aggregates, or convert a logical operator into a physical convention. Cost and required traits decide which alternative is preferred.`,
        `Rules are correctness tools before they are performance tools. A rule that pushes a filter through a join must preserve SQL null behavior. A projection trim must preserve aliases and expressions that later operators need. A converter must record the calling convention of the engine that will run the node. The planner can explore many alternatives only because each transformation promises semantic equivalence.`,
      ],
    },
    {
      heading: 'How adapters and pushdown work',
      paragraphs: [
        `An adapter starts with schemas, tables, and row types. Calcite's CSV tutorial shows the ladder: a simple table can enumerate all rows, a filterable table can accept simple predicates, and a translatable table can produce relational operators handled by planner rules. The same pattern extends to JDBC databases, search indexes, APIs, file formats, and custom engines.`,
        `Pushdown is valuable because it can reduce data movement. A project can read fewer columns. A filter can fetch fewer rows. A limit can avoid scanning the whole source. An aggregate can shrink many rows into one result per group before data crosses a boundary. But pushdown is valid only when the source implements the same semantics as the relational expression being pushed.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The planner-rules view proves that SQL planning is a sequence of contracts. Text becomes parsed syntax. Syntax plus schema becomes typed meaning. Typed meaning becomes RelNode algebra. Rules create equivalent alternatives. Cost and traits choose an implementation. The important object is not a string of SQL; it is the relational tree the rest of the system can reason about.`,
        `The adapter-pushdown view proves that a source boundary is a performance and correctness boundary at the same time. The project-filter-scan pattern is not just tree decoration. It is a chance to move work into the source, avoid unnecessary rows, and still leave a fallback path when the source cannot safely run the operator. The visual also shows why adapters need metadata and rules, not only a row iterator.`,
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        `Calcite works because relational algebra gives the planner a smaller and more stable language than raw SQL text. Many different SQL strings can become similar relational shapes. Rules can then operate on those shapes without caring whether the query came from a user, a generated dashboard, a view expansion, or another planner layer.`,
        `The invariant is equivalence under declared traits and types. A rule may improve a plan only if the replacement returns the same rows under the same SQL semantics. A converter may change the calling convention only if downstream operators understand that convention or another converter bridges it. Costing can be imperfect, but correctness cannot be optional. A slow correct fallback is better than a fast wrong pushdown.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The main correctness failure is an unsafe rewrite. Null semantics, type coercions, collations, timestamp behavior, aliases, grouping state, dialect differences, and source-specific functions can all make a pushed expression subtly wrong. A planner rule is dangerous when it treats a performance opportunity as proof of equivalence.`,
        `The main performance failures are rule explosion, weak metadata, bad row-count estimates, missing trait propagation, and adapters that hide expensive residual work. A few rules can generate a large search space. Poor metadata can make the chosen plan worse than the original. Mature Calcite systems need explain plans, rule tracing, cost debugging, and clear fallback behavior when a source cannot safely execute part of the algebra.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Using Calcite saves years of planner infrastructure, but it moves complexity into integration. Teams must define schemas, row types, adapters, conventions, metadata, rules, and execution boundaries. They must also decide how much of Calcite's enumerable fallback to use and how much to hand off to a separate execution engine.`,
        `The payoff is shared reuse. One correct filter-pushdown rule can improve many query shapes. One adapter convention can let the planner compare native execution with fallback execution. One metadata improvement can change join order, pushdown choice, and scan cost across the whole system. The tax is that planner bugs are often second-order: the wrong rule fires only after another rule creates the shape that made it possible.`,
      ],
    },
    {
      heading: 'Real use and study next',
      paragraphs: [
        `Calcite is useful for systems that need a query layer over data they do not own in one storage engine: federated SQL, embedded analytics, stream processors, custom warehouses, file-backed tools, data virtualization, and source adapters for existing engines. It is less attractive when the system only needs a tiny fixed query language or when the team cannot invest in semantic tests for rules and pushdown.`,
        `Primary sources: Apache Calcite home page at https://calcite.apache.org/, the Calcite tutorial at https://calcite.apache.org/docs/tutorial.html, the adapter documentation at https://calcite.apache.org/docs/adapter.html, and the RelNode API documentation at https://calcite.apache.org/javadocAggregate/org/apache/calcite/rel/RelNode.html. Study Cascades Memo Query Optimizer for rule search, Selinger DP Join Order Optimizer for join planning, PostgreSQL Query Planner Case Study for statistics, Substrait Query Plan Interchange Case Study for portable plans, and Apache DataFusion Arrow Query Engine Case Study for an embeddable execution stack.`,
      ],
    },
  ],
};
