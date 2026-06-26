// Velox unified execution engine: reusable vectorized execution components
// for analytical engines, feature pipelines, and engine consolidation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'velox-unified-execution-engine-case-study',
  title: 'Velox Unified Execution Engine Case Study',
  category: 'Systems',
  summary: 'Meta Velox as an execution-engine lesson: columnar vectors, expression evaluation, operators, connectors, memory pools, and reusable data-plane components.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['vector engine', 'reuse boundary'], defaultValue: 'vector engine' },
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

function veloxGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'plan', label: 'plan', x: 0.8, y: 3.5, note: notes.plan ?? 'optimized' },
      { id: 'driver', label: 'driver', x: 2.4, y: 3.5, note: notes.driver ?? 'pipeline' },
      { id: 'vectors', label: 'vectors', x: 4.2, y: 1.7, note: notes.vectors ?? 'columns' },
      { id: 'expr', label: 'expr', x: 4.2, y: 5.3, note: notes.expr ?? 'eval' },
      { id: 'ops', label: 'ops', x: 6.0, y: 3.5, note: notes.ops ?? 'join/agg' },
      { id: 'mem', label: 'mem pool', x: 7.6, y: 1.8, note: notes.mem ?? 'track' },
      { id: 'conn', label: 'connector', x: 7.6, y: 5.2, note: notes.conn ?? 'files/db' },
      { id: 'result', label: 'result', x: 9.2, y: 3.5, note: notes.result ?? 'batches' },
    ],
    edges: [
      { id: 'e-plan-driver', from: 'plan', to: 'driver', weight: 'tasks' },
      { id: 'e-driver-vectors', from: 'driver', to: 'vectors', weight: 'rows' },
      { id: 'e-vectors-expr', from: 'vectors', to: 'expr', weight: 'inputs' },
      { id: 'e-expr-ops', from: 'expr', to: 'ops', weight: 'project' },
      { id: 'e-vectors-ops', from: 'vectors', to: 'ops', weight: 'scan' },
      { id: 'e-ops-mem', from: 'ops', to: 'mem', weight: 'alloc' },
      { id: 'e-conn-vectors', from: 'conn', to: 'vectors', weight: 'read' },
      { id: 'e-ops-result', from: 'ops', to: 'result', weight: 'output' },
    ],
  }, { title });
}

function reuseGraph(title) {
  return graphState({
    nodes: [
      { id: 'presto', label: 'Presto', x: 0.8, y: 1.6, note: 'frontend' },
      { id: 'spark', label: 'Spark', x: 0.8, y: 3.5, note: 'frontend' },
      { id: 'ml', label: 'ML pipe', x: 0.8, y: 5.4, note: 'frontend' },
      { id: 'adapter', label: 'adapter', x: 2.8, y: 3.5, note: 'plan+types' },
      { id: 'velox', label: 'Velox', x: 5.0, y: 3.5, note: 'data plane' },
      { id: 'files', label: 'files', x: 7.4, y: 1.7, note: 'Parquet/ORC' },
      { id: 'udf', label: 'funcs', x: 7.4, y: 3.5, note: 'dialect' },
      { id: 'metrics', label: 'metrics', x: 7.4, y: 5.3, note: 'shared' },
      { id: 'user', label: 'users', x: 9.2, y: 3.5, note: 'systems' },
    ],
    edges: [
      { id: 'e-presto-adapter', from: 'presto', to: 'adapter', weight: '' },
      { id: 'e-spark-adapter', from: 'spark', to: 'adapter', weight: '' },
      { id: 'e-ml-adapter', from: 'ml', to: 'adapter', weight: '' },
      { id: 'e-adapter-velox', from: 'adapter', to: 'velox', weight: 'plan' },
      { id: 'e-files-velox', from: 'files', to: 'velox', weight: 'scan' },
      { id: 'e-udf-velox', from: 'udf', to: 'velox', weight: 'bind' },
      { id: 'e-velox-metrics', from: 'velox', to: 'metrics', weight: 'observe' },
      { id: 'e-velox-user', from: 'velox', to: 'user', weight: 'results' },
    ],
  }, { title });
}

function* vectorEngine() {
  yield {
    state: veloxGraph('Velox takes an optimized plan and runs the data plane'),
    highlight: { active: ['plan', 'driver', 'vectors', 'ops', 'e-plan-driver', 'e-driver-vectors'], found: ['result'] },
    explanation: 'Velox starts after the frontend has done its language work. The plan enters as an optimized execution request; Velox supplies the reusable vector, operator, memory, connector, and spill machinery.',
    invariant: 'The frontend owns parsing and optimization; Velox owns reusable execution components.',
  };

  yield {
    state: labelMatrix(
      'Vector encodings',
      [
        { id: 'flat', label: 'flat' },
        { id: 'const', label: 'const' },
        { id: 'dict', label: 'dict' },
        { id: 'row', label: 'row' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'win', label: 'wins' },
      ],
      [
        ['values', 'scan'],
        ['one', 'nofill'],
        ['idx', 'nocopy'],
        ['kids', 'batch'],
      ],
    ),
    highlight: { active: ['flat:win', 'dict:win'], found: ['const:win', 'row:shape'] },
    explanation: 'The vector encodings are the local data structures that make reuse practical. Flat scans raw values, constant avoids filling repeated values, and dictionary wraps a base vector with indices instead of copying.',
  };

  yield {
    state: veloxGraph('Operators share memory, vectors, and expression code'),
    highlight: { active: ['vectors', 'expr', 'ops', 'mem', 'e-vectors-expr', 'e-ops-mem'], compare: ['conn'] },
    explanation: 'This graph shows the shared hot path. Expressions, joins, aggregations, connectors, and memory pools all meet on the same vector substrate, so one execution improvement can help several embedding systems.',
  };

  yield {
    state: labelMatrix(
      'Execution hot path',
      [
        { id: 'scan', label: 'scan' },
        { id: 'filter', label: 'filter' },
        { id: 'join', label: 'join' },
        { id: 'agg', label: 'agg' },
        { id: 'spill', label: 'spill' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['conn', 'push'],
        ['expr', 'select'],
        ['dict', 'fanout'],
        ['hash', 'mem'],
        ['disk', 'lat'],
      ],
    ),
    highlight: { active: ['scan:uses', 'filter:uses', 'join:uses'], compare: ['agg:risk'], found: ['spill:risk'] },
    explanation: 'The same physical concerns from database execution still apply: pushdown, selectivity, join fanout, hash-table growth, memory tracking, and spill latency.',
  };
}

function* reuseBoundary() {
  yield {
    state: reuseGraph('Velox creates one shared execution core for many systems'),
    highlight: { active: ['presto', 'spark', 'ml', 'adapter', 'velox'], found: ['metrics'] },
    explanation: 'Read this as consolidation without pretending every system is the same. Presto, Spark-like systems, and ML pipelines can keep their frontends while adapting plans into one shared data plane.',
  };

  yield {
    state: labelMatrix(
      'What stays outside Velox',
      [
        { id: 'parse', label: 'parse' },
        { id: 'opt', label: 'opt' },
        { id: 'dialect', label: 'dialect' },
        { id: 'sched', label: 'sched' },
      ],
      [
        { id: 'owner', label: 'owner' },
        { id: 'why', label: 'why' },
      ],
      [
        ['front', 'SQL'],
        ['front', 'cost'],
        ['adapt', 'sem'],
        ['sys', 'cluster'],
      ],
    ),
    highlight: { active: ['parse:owner', 'opt:owner'], compare: ['dialect:why'], found: ['sched:owner'] },
    explanation: 'Reusable execution does not erase system boundaries. SQL parsing, optimization, dialect decisions, and cluster scheduling still belong to the embedding system.',
  };

  yield {
    state: reuseGraph('Adapters are the semantic firewall'),
    highlight: { active: ['adapter', 'velox', 'udf', 'e-adapter-velox', 'e-udf-velox'], compare: ['presto', 'spark'] },
    explanation: 'The adapter is the semantic firewall. It maps an outside plan into Velox operators and binds functions, types, nulls, and timestamp behavior before shared execution begins.',
    invariant: 'Shared execution is safe only when dialect semantics are bound explicitly.',
  };

  yield {
    state: labelMatrix(
      'Complete consolidation case',
      [
        { id: 'eng', label: 'engine' },
        { id: 'plan', label: 'plan' },
        { id: 'exec', label: 'exec' },
        { id: 'obs', label: 'obs' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['many', 'one'],
        ['privIR', 'adapt'],
        ['dup', 'shared'],
        ['local', 'common'],
      ],
    ),
    highlight: { active: ['exec:after', 'obs:after'], compare: ['eng:before'], found: ['plan:after'] },
    explanation: 'The consolidation win is engineering leverage: fewer duplicated operators, more consistent observability, and one place to optimize vectors, memory, joins, aggregations, and connectors.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'vector engine') yield* vectorEngine();
  else if (view === 'reuse boundary') yield* reuseBoundary();
  else throw new InputError('Pick a Velox view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the graph as a boundary between a frontend and a data plane. Active nodes show a physical plan moving through drivers, vectors, operators, memory pools, and connectors.',
      'A frontend parses a language and owns user semantics. Velox is an execution engine: it runs already-planned work over columnar vectors, which are batches stored by column.',
      {type:'callout', text:'Velox creates leverage by sharing the physical data plane while leaving each embedding system in charge of language, planning, and semantics.'},
    ] },
    { heading: 'Why this exists', paragraphs: ['Analytical systems repeat the same execution work. SQL engines, dataframe runtimes, feature pipelines, and ML loaders all need scans, filters, joins, aggregations, memory tracking, and connectors.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is for every engine to own a full stack. That gives control, but it creates several implementations of the same physical operators.'] },
    { heading: 'The wall', paragraphs: ['The wall is duplicated complexity plus semantic mismatch. Sharing execution helps only if adapters bind timestamps, nulls, types, functions, and connector rules exactly.'] },
    { heading: 'The core insight', paragraphs: ['The core insight is to separate semantic planning from physical execution. Host systems own language and scheduling, while Velox owns reusable data-plane machinery.'] },
    { heading: 'How it works', paragraphs: ['A host gives Velox an optimized physical plan. Velox breaks it into tasks, drivers, pipelines, operators, and vector batches, then tracks memory and connector behavior through execution.'] },
    { heading: 'Why it works', paragraphs: ['Vectorized execution works because CPUs handle predictable batches better than scattered row objects. Shared execution works because the adapter makes the semantic boundary explicit before Velox runs the plan.'] },
    { heading: 'Cost and complexity', paragraphs: ['The main cost is integration risk. If one null rule or timestamp rule is mapped wrongly, Velox can compute the wrong answer quickly.'] },
    { heading: 'Real-world uses', paragraphs: ['Velox fits organizations with several large analytics or ML data systems. A single vector, connector, spill, or memory-accounting improvement can then help multiple hosts.'] },
    { heading: 'Where it fails', paragraphs: ['Velox is not a warehouse, optimizer, scheduler, SQL dialect, or product API. Bad plans, skewed joins, and weak adapters can still dominate runtime and correctness.'] },
    { heading: 'Worked example', paragraphs: ['A query scans 10 million rows, filters to 1 million, joins a 50,000-row dimension, and groups by day. Velox can carry selected positions through dictionary vectors, but if one group owns 600,000 rows, memory pools and spill policy decide whether the query finishes.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Meta Velox announcement at https://engineering.fb.com/2023/03/09/open-source/velox-open-source-execution-engine/, Velox docs at https://facebookincubator.github.io/velox/velox-in-10-min.html, Velox vectors at https://facebookincubator.github.io/velox/develop/vectors.html, and the VLDB paper at https://vldb.org/pvldb/vol15/p3372-pedreira.pdf. Study Apache Arrow, DuckDB vectorized execution, SQL joins, and Substrait next.'] },
  ],
};
