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
    explanation: 'Velox is not a SQL product by itself. It is a reusable C++ execution engine library that consumes optimized plans and executes vectorized data-processing operators.',
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
    explanation: 'Velox vectors are columnar batches with encodings such as flat, constant, and dictionary. Dictionary wrapping can represent filters or joins without copying every selected value.',
  };

  yield {
    state: veloxGraph('Operators share memory, vectors, and expression code'),
    highlight: { active: ['vectors', 'expr', 'ops', 'mem', 'e-vectors-expr', 'e-ops-mem'], compare: ['conn'] },
    explanation: 'Expression evaluation, joins, aggregations, sorting, connectors, and memory accounting use the same vector and memory-pool substrate. That is where reuse becomes real.',
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
    explanation: 'Meta built Velox to reduce duplicated execution-engine work across many data systems. A frontend can keep its own language and optimizer while sharing the data-plane components.',
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
    explanation: 'The adapter maps an outside plan into Velox operators and binds functions to the right semantics. That boundary is where correctness is won or lost.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'Velox is Meta\'s open source unified execution engine: a C++ library of reusable, vectorized data-processing components for analytical and data-management systems. It is not a full database frontend. It does not provide a SQL parser, dataframe layer, or query optimizer as its main user interface. It is the execution substrate behind other systems.',
        'This topic links DuckDB Vectorized Execution Case Study, Apache Arrow Columnar Memory Case Study, Volcano Iterator Query Execution, Exchange Operator Parallel Query, SQL Join Algorithms Primer, and Substrait Query Plan Interchange Case Study. Those topics explain the operator, vector, and plan pieces that Velox packages into a reusable data plane.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An embedding system gives Velox an optimized plan. Velox creates tasks, drivers, operators, and vector batches. Connectors read files or external sources into vectors. Expressions transform vectors. Operators perform scans, projections, joins, aggregations, sorting, repartitioning, and output.',
        'Velox vectors are columnar in-memory structures with encodings such as flat, constant, dictionary, and row vectors. They are similar in spirit to Arrow but tuned for query execution needs such as out-of-order writes, dictionary wrapping, shared buffers, and zero-copy transformations.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The important structures are plan nodes, drivers, operators, vectors, buffers, null bitmaps, dictionary indices, memory pools, connectors, function registries, and spill state. A dictionary vector can wrap a base vector with an index buffer, which is useful for filters, joins, and duplicate-heavy transformations because it avoids copying full values.',
        'Memory pools are part of the execution contract. Analytical operators allocate hash tables, buffers, join state, sort runs, and output batches. A reusable engine needs consistent accounting and spill behavior, or one embedding system will be fast while another fails under pressure.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A company has separate SQL analytics, stream processing, and feature-engineering systems. Each system has its own parser and optimizer, but all need fast scans, expression evaluation, hash joins, aggregations, and Parquet or ORC connectors. Instead of maintaining three separate execution engines, the systems adapt their optimized plans into Velox operators.',
        'The win is not merely code sharing. A vector optimization, memory-accounting fix, or connector improvement can benefit several systems. Observability also becomes more consistent because the same execution core reports comparable metrics across workloads.',
      ],
    },
    {
      heading: 'Cost and pitfalls',
      paragraphs: [
        'The danger is semantic mismatch. SQL dialects, timestamp rules, null behavior, aggregate semantics, and function implementations differ across systems. The adapter layer must bind those meanings explicitly before a plan enters the shared engine.',
        'Velox also does not remove the need for planning and scheduling. Join order, cardinality estimates, repartitioning strategy, cluster placement, workload isolation, and user-facing APIs remain the embedding system\'s responsibility. A shared execution engine is leverage, not a complete warehouse.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Meta engineering announcement at https://engineering.fb.com/2023/03/09/open-source/velox-open-source-execution-engine/, Velox repository at https://github.com/facebookincubator/velox, Velox in 10 minutes at https://facebookincubator.github.io/velox/velox-in-10-min.html, Velox vectors docs at https://facebookincubator.github.io/velox/develop/vectors.html, Velox operators docs at https://facebookincubator.github.io/velox/develop/operators.html, and the VLDB paper at https://vldb.org/pvldb/vol15/p3372-pedreira.pdf. Study DuckDB Vectorized Execution Case Study, Apache Arrow Columnar Memory Case Study, SQL Join Algorithms Primer, Exchange Operator Parallel Query, Cascades Memo Query Optimizer, Substrait Query Plan Interchange Case Study, and Parquet Columnar Format Case Study next.',
      ],
    },
  ],
};
