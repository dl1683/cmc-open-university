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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows SQL becoming a typed relational plan. A RelNode is Calcite\'s object for one relational operator, such as scan, filter, project, join, or aggregate. Active nodes are the current translation or rewrite step; found nodes are the chosen physical plan or source pushdown.',
        'In the adapter view, read the source boundary carefully. A pushed filter is correct only if the source has the same semantics for types, nulls, collation, and functions. The visual is about contracts, not just speed.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'Calcite gives a system the front half of a database — SQL parsing, schema validation, relational algebra, planner rules, cost comparison, and adapter hooks — without requiring the system to build a full database from scratch. The central abstraction is RelNode: once a query is a typed relational tree instead of a string, planner rules can match algebraic shapes and replace them with equivalent, cheaper shapes.'},
        'Calcite exists because many systems need SQL or relational planning without owning a full database stack. A file lake, stream processor, metrics system, search index, or federated query layer may need parsing, validation, optimization, and pushdown. Building that machinery from scratch is a large project before any data is queried.',
        'Calcite supplies the planner core and leaves storage and execution to the embedding system. It turns SQL into relational algebra, applies rules, compares costs, and lets adapters expose external sources as tables. The result is a reusable query-planning layer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to parse a few SQL strings and hand-code the cases users need first. SELECT columns FROM file WHERE predicate becomes a scanner plus a filter. For a demo, this feels direct and understandable.',
        'The approach breaks when users expect real SQL. Names need resolution, aliases need scope, nulls use three-valued logic, joins need ordering choices, and source pushdown needs semantic checks. A small parser turns into an accidental planner.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is semantic equivalence. A rewrite is allowed only if it returns the same rows under SQL semantics. Pushing a filter through a join can be wrong if null behavior or outer-join preservation changes.',
        'The performance wall is search space. Ten joins can have many legal orders before physical implementations are counted. Planner rules create alternatives, and metadata plus cost estimates must prevent the search from becoming unbounded or choosing a worse plan.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to convert SQL text into a typed tree of relational operators. Once the query is a RelNode tree, rules can match shapes such as filter-over-scan or project-over-join. The tree is easier to reason about than raw SQL strings.',
        'Adapters extend that tree to external systems. A weak adapter can enumerate rows. A stronger adapter can accept filters, projections, limits, aggregates, or a source-specific convention. The planner can then compare local execution with source pushdown.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Calcite pipeline parses SQL, validates names and types against schemas, and converts the syntax to relational algebra. Rules rewrite the logical tree, create alternatives, and attach traits such as physical convention or ordering. A cost model chooses among alternatives.',
        'An adapter provides schemas, tables, row types, statistics, and sometimes custom RelNodes. A pushdown rule replaces a generic relational shape with an adapter-specific node. The execution engine then runs either the adapter node or a fallback plan.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because relational algebra is a compact common language. Many different SQL strings become the same operator shapes. Rules can improve those shapes without caring whether the query came from a dashboard, a user, or generated code.',
        'Correctness depends on rule invariants. Each replacement must preserve row values, row counts, types, null behavior, and required traits. Cost can be approximate, but a wrong pushdown is still wrong even if it is fast.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Calcite saves years of planner work but moves complexity into integration. The embedding system must define schemas, adapters, conventions, metadata, rules, and execution boundaries. Weak statistics can make the selected plan slower than a simple fallback.',
        'Cost behaves through reuse. One correct filter-pushdown rule can affect thousands of query shapes. One bad rule can corrupt many shapes only after other rules create the matching pattern, which makes planner testing harder than testing a single function.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Calcite fits federated SQL systems, embedded analytics, stream processors, custom warehouses, data virtualization, and query layers over files or services. It is useful when the product owns unusual data sources but wants a mature relational front end.',
        'It is less useful for a fixed tiny query language or a system with no appetite for semantic tests. A planner is shared infrastructure. It pays off when many query shapes and sources reuse the same contracts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails through unsafe rewrites, weak metadata, rule explosion, dialect mismatch, and source semantics drift. Timestamp behavior, null handling, collations, casts, and custom functions are common traps. Pushdown should be disabled when equivalence is not proven.',
        'It also fails operationally when users cannot inspect plans. Explain plans, rule traces, row-count estimates, and adapter fallback logs are necessary. Without them, a planner becomes a black box that is hard to debug when a query slows down or returns wrong rows.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a query reads SELECT city FROM trips WHERE fare > 50 from a CSV source with 10 million rows and 12 columns. A naive scan reads all columns and filters locally. If each row is 120 bytes, the engine touches about 1.2 GB before returning one column.',
        'With projection and filter pushdown, the adapter reads only city and fare and applies fare > 50 while scanning. If those two fields average 24 bytes per row and 10 percent pass, the engine touches about 240 MB and returns about 1 million city values. The rewrite is correct only if the CSV adapter implements numeric comparison and null handling the same way Calcite expects.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Calcite documentation, adapter documentation, tutorial material, and RelNode API docs. Study relational algebra, Cascades optimizers, Selinger join ordering, SQL null semantics, Apache DataFusion, and Substrait next.',
        'The exercise is to write one safe pushdown rule on paper. State the before tree, after tree, required type and null assumptions, and a counterexample where the rule would be invalid. That discipline is planner engineering.',
      ],
    },
  ],
};