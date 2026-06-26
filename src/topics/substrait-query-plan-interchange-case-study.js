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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the left side as the authoring world and the right side as the execution world. SQL, dataframes, or another frontend produce a logical plan, and Substrait is the serialized intermediate representation that carries typed relational meaning across that boundary.',
        'A highlighted relation node is not just an operator name. It is safe to move the plan only when field order, types, function bindings, null behavior, and extension declarations are preserved well enough for the receiving engine to reject unknown meaning instead of guessing.',
        {type:'callout', text:'Substrait treats a query plan as a portable semantic contract that another engine must either understand exactly or reject before execution.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern analytics stacks rarely use one engine from source query to execution. A Python dataframe library, SQL parser, query optimizer, vectorized engine, lakehouse service, and embedded database may all touch the same logical query.',
        'Substrait exists because source text is too vague and private planner objects are too local. It defines a portable query-plan format, which means a structured representation of reads, filters, projections, joins, aggregates, types, functions, and extensions that another engine can validate before it runs anything.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious handoff is a SQL string. That works when one engine parses, plans, optimizes, and executes the query, and it is still the right interface for many humans.',
        'A second obvious handoff is to share an internal planner object. That preserves more detail, but it binds every consumer to one language runtime, one versioned class layout, and one optimizer implementation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'SQL strings do not carry all resolved meaning. Two engines can disagree on decimal rounding, timestamp rules, null comparison, identifier casing, function overloads, collation, implicit casts, or unsupported syntax while accepting similar text.',
        'Private planner objects fail at the organization boundary. They are hard to store, hard to review, hard to move across processes, and brittle when either side upgrades its optimizer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A query plan should be treated as a semantic contract, not as a diagram of boxes. The producer must state enough meaning for the consumer to either execute the same logical query or refuse the plan before damage is done.',
        'The invariant is semantic preservation. If a plan says a filter uses a particular boolean function over nullable fields, the receiving engine must know that function and those types, not merely see the word filter.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Substrait plan is built from relation nodes. Read nodes describe inputs, filter nodes describe predicates, project nodes define output expressions, aggregate nodes define grouping and aggregate calls, and join nodes define how two inputs combine.',
        'Expressions refer to fields and functions through structured bindings. Types record integer, string, decimal, timestamp, list, struct, nullability, and variation information, while extension declarations anchor functions or types outside the base specification.',
        'The same contract can be shown as text for review or encoded as protobuf binary for machine transport. Validation checks whether the consumer knows the relation shapes, type rules, function anchors, and extensions needed to execute safely.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conditional and useful. If the producer emits every semantic dependency of the logical plan, and the consumer validates every dependency before execution, then the consumer is not guessing about the query it runs.',
        'Unknown semantics must fail closed. Refusing an unsupported extension is correct behavior because a silent fallback can return a valid-looking table with the wrong answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Substrait shifts cost from parser reuse to contract maintenance. Producers still parse, bind names, infer types, and emit plans; consumers still decode, validate, map functions, and translate the logical plan into their own physical execution plan.',
        'Plan size grows with relation count, expression count, and extension metadata. A 20-node plan with 80 expressions is still small compared with most data, but every node is another compatibility surface that must be versioned and tested.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Substrait fits machine-to-machine query handoff. A dataframe frontend can emit a plan for a native execution engine, a lakehouse can store a view as a resolved artifact, and a federated service can ask which engine supports which fragment.',
        'It is also useful for tests and audits. Two engines can be given the same logical artifact, and differences can be traced to function support, type semantics, optimization choices, or execution behavior rather than parser dialect.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Substrait does not erase real semantic differences between engines. Timestamp behavior, decimal overflow, custom functions, collation, physical distribution, and user-defined relations can still make a plan nonportable.',
        'It also fails when teams use extensions as a private escape hatch for everything. If most important operators are custom, the shared contract shrinks and every consumer needs one-off adapters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a query reads 10,000,000 orders, filters to status = paid, groups by customer_id, and computes sum(total). If the producer estimates that 30 percent of rows pass the filter, the consumer still needs exact semantics for status comparison, decimal sum, null total handling, and customer_id type before it can run the plan.',
        'A SQL string might say SELECT customer_id, SUM(total), but the Substrait plan says which input field is customer_id, which function anchor implements sum, what decimal precision is expected, and which relation produces each output field. If the receiving engine lacks that decimal sum anchor, the correct result is rejection, not approximate execution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Substrait specification, extension documentation, serialization basics, and binary serialization notes at https://substrait.io/, https://substrait.io/extensions/, https://substrait.io/serialization/basics/, and https://substrait.io/serialization/binary_serialization/. Study relational algebra, SQL planning, protobuf, Apache Arrow, DuckDB, Velox, DataFusion, and Calcite next.',
      ],
    },
  ],
};
