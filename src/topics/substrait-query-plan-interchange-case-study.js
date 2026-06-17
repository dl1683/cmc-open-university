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
    explanation: 'Substrait is the plan as a contract. A frontend can emit relational intent, types, and functions; a separate engine can validate and execute it without sharing the frontend\'s private planner objects.',
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
    explanation: 'The table shows why "scan-filter-join" is not enough. Each relation also needs types, field references, function bindings, null behavior, ordering, and other semantics that affect the answer.',
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
    explanation: 'The checklist is the portability trap. A plan that drops function anchors or field ordering may still serialize cleanly, but the receiving engine can compute the wrong answer or choose an unusable physical plan.',
  };
}

function* extensionsAndEngines() {
  yield {
    state: engineGraph('Substrait separates producers from execution engines'),
    highlight: { active: ['calcite', 'datafusion', 'substrait', 'velox'], found: ['spark', 'duckdb'] },
    explanation: 'Read this graph as a decoupling boundary. Producers keep their own language and optimizer; consumers keep their execution engine. Substrait is the shared intermediate representation between them.',
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
    explanation: 'Heterogeneous engines are useful only when unsupported semantics fail loudly. Validation and capability checks are what keep a portable plan from becoming a silent compatibility bug.',
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
      heading: 'Why This Exists',
      paragraphs: [
        'Substrait exists because modern data systems rarely stay inside one query engine. A user may define a view in SQL, build a dataframe in Python, optimize a plan in Calcite or DataFusion, execute fragments in Velox or DuckDB, and move intermediate artifacts through services written in different languages. The hard part is not drawing boxes named scan, filter, and join. The hard part is preserving the exact meaning of those boxes when the producer and consumer do not share planner classes, parser settings, SQL dialect, function registry, or type system. Substrait treats a query plan as a portable data structure: relation nodes, expressions, field references, types, function anchors, extension declarations, and serialization rules. The artifact is meant to be inspected, validated, stored, transmitted, and either executed or rejected by a different system.',
      ],
    },
    {
      heading: 'The Naive Boundary',
      paragraphs: [
        'The reasonable first attempt is to exchange SQL strings. That works when one engine owns parsing, planning, optimization, and execution. It also works for simple portability demos because SQL is familiar and compact. The wall appears when two systems disagree about names, implicit casts, timestamp rules, decimal rounding, null behavior, collation, function overloads, identifier casing, or unsupported syntax. A string says what the author typed, not what the planner resolved. The second attempt is to pass private planner objects. That preserves more detail but only inside one codebase or language runtime. It also freezes interoperability to internal classes that were never designed as a public wire format. Substrait sits between those failures: lower level than SQL text, more portable than private objects.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is that a query plan is a contract, not a picture. A contract must say which relation produces which fields, how each expression is typed, which function definition is being called, what nulls mean in predicates, what names are references rather than display labels, and which extensions are outside the base specification. Substrait makes those facts data. The invariant is semantic preservation: if an engine accepts the plan, it should know enough to compute the same logical result the producer intended. If it does not know enough, it should fail before execution. That refusal path is part of interoperability. A silent best effort conversion is worse than an explicit incompatibility because it can produce a valid-looking answer with the wrong semantics.',
      ],
    },
    {
      heading: 'How the Plan Works',
      paragraphs: [
        'A Substrait plan starts with relation nodes. A read relation describes an input, a filter relation applies a boolean expression, a project relation chooses expressions for output fields, an aggregate relation groups and computes aggregate functions, and a join relation combines inputs under join type and key semantics. Those relation nodes form a tree or a plan graph with references. Expressions point at fields by ordinal or reference structure, not by whatever display name was convenient in the frontend. Type messages describe integers, decimals, strings, lists, structs, timestamps, nullability, and type variations. Function calls do not rely on a bare spelling such as round or substr; they bind through extension declarations and anchors. Serialization then gives the same contract two surfaces: text for debugging and review, and protobuf binary for IPC, storage, or network transport.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The correctness argument is a contract argument. If the producer emits every semantic dependency of the logical plan, and the consumer validates every dependency before execution, then execution is safe relative to that contract. The plan does not prove that the original SQL was wise or that the physical engine will be fast. It proves that the consumer is not guessing about the logical work it has been asked to perform. Extension anchors are central to that proof. When a plan references a scalar function, aggregate function, type variation, or custom relation through a declared extension, the consumer can map that anchor to an implementation with matching semantics. If the anchor is unknown, the safe answer is refusal or routing to a compatible engine.',
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        'The plan-contract view shows a boundary that many system diagrams hide. SQL or dataframe code enters on the left, but the engine on the right does not receive that source text. It receives a bound logical artifact plus types, serialization, and validation. The text and binary nodes are alternate representations of the same contract: one helps humans inspect the plan, the other helps programs move it efficiently. The component matrix shows why relation names alone are insufficient. Filters need predicate semantics, projections need field ordering, aggregates need function definitions, and joins need null and key behavior. The engines view adds the extension ledger. Different producers and consumers can meet at the shared intermediate representation only when non-core functions, types, and relations have explicit anchors.',
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        'Substrait does not make planning free. A frontend still has to parse source code, resolve names, infer types, bind functions, and choose which logical structure to emit. A consumer still has to parse or decode the plan, validate capabilities, map extension anchors to implementations, and often translate the logical plan into its own physical plan. The binary format keeps transport compact compared with ad hoc JSON, but plan size still grows with relation count, expression complexity, and extension metadata. The larger cost is operational: producers and consumers need versioning discipline. When a function signature changes or an engine adds partial support for a relation, the boundary must record what is supported instead of assuming every Substrait-shaped plan is executable everywhere.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Substrait is useful when planning and execution need a durable boundary between them. A lakehouse can store a view as a resolved plan instead of only as dialect-specific SQL. A Python dataframe frontend can hand work to a native engine without exposing private planner objects. A federated system can ask several execution engines which parts of a plan they can run. A testing tool can compare how two engines interpret the same logical artifact. A query service can validate tenant-submitted plans before dispatching them. The common access pattern is not human query writing; it is machine-to-machine handoff after semantic binding. That is why field ordinals, function anchors, types, and extension declarations matter more than making the plan look like familiar SQL.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'Substrait is the wrong tool when the real problem is user-facing dialect compatibility, query optimization quality, or physical execution speed. It does not erase semantic differences between engines. It only gives systems a place to state those differences. Timestamp behavior, decimal overflow, collation, user-defined functions, custom scans, and physical distribution assumptions can still break portability. A weak implementation can serialize a plan that is syntactically valid but semantically incomplete. Another failure mode is treating extensions as a dumping ground: if every important operator is custom, the shared contract shrinks and consumers need one-off adapters. The tax is precision. A useful plan must carry more detail than a diagram, and every detail needs compatibility checks.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Use the official Substrait home page, extension documentation, serialization basics, binary serialization page, and specification index as the primary references: https://substrait.io/, https://substrait.io/extensions/, https://substrait.io/serialization/basics/, https://substrait.io/serialization/binary_serialization/, and https://substrait.io/spec/specification/. Then study relational algebra, SQL join algorithms, Cascades-style memo optimizers, Selinger join order planning, protobuf wire format, schema registries, Apache Arrow columnar memory, DuckDB vectorized execution, and Velox-style execution engines. The next conceptual step is to separate three artifacts in your head: source query, logical plan contract, and physical execution plan. Most interoperability bugs come from confusing those layers.',
      ],
    },
  ],
};
