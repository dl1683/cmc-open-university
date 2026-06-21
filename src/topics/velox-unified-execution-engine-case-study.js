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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Velox exists because many data systems repeat the same hard execution work. A SQL engine, dataframe runtime, feature pipeline, and ML data loader may all need fast scans, expression evaluation, joins, aggregations, memory tracking, spilling, and Parquet or ORC connectors.',
        'Duplicating that data plane is expensive. Each system has to tune vector layouts, null handling, dictionary encodings, hash tables, memory pools, spill behavior, connector pushdown, and metrics. Fixing the same bug or performance issue in several engines wastes engineering effort.',
        'Velox is Meta\'s open source unified execution engine: a C++ library of reusable vectorized data-processing components. It is not a full database frontend. It does not mainly give you a SQL parser, dataframe API, cost optimizer, or cluster scheduler. It is the execution substrate other systems embed.',
        {type:'callout', text:'Velox creates leverage by sharing the physical data plane while leaving each embedding system in charge of language, planning, and semantics.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is for every engine to own its full stack: parser, optimizer, planner, executor, connectors, memory manager, and observability. That gives each system full control, but it also creates many slightly different implementations of the same physical operators.',
        'Another shortcut is to share only a file format or columnar memory standard. That helps interchange, but it does not give a complete execution engine. Operators still need selection vectors, encodings, memory pools, spill, expression evaluation, and connector integration.',
        'A third mistake is to imagine a shared executor can erase semantic differences. SQL dialects, timestamp behavior, null rules, user-defined functions, and aggregate semantics differ across systems. Reuse is safe only when adapters bind those meanings explicitly.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to separate frontends from the physical data plane. The embedding system keeps parsing, optimization, dialect rules, scheduling, and user-facing APIs. Velox provides the shared execution core that runs the physical plan over vectors.',
        'This creates a shared optimization point at the lowest expensive layer. A better vector encoding, memory-accounting fix, hash-join improvement, spill path, or connector optimization can benefit multiple systems. Observability also becomes more consistent because the same execution core reports comparable metrics.',
        'The adapter is the semantic firewall. It maps an outside plan into Velox operators and binds functions, types, null behavior, timestamp rules, and connector semantics before shared execution begins.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An embedding system gives Velox an optimized plan. Velox creates tasks, drivers, pipelines, operators, and vector batches. Connectors read files or external sources into vectors. Expressions transform vectors. Operators perform scans, filters, projections, joins, aggregations, sorting, repartitioning, and output.',
        'Velox vectors are columnar in-memory structures with encodings such as flat, constant, dictionary, and row vectors. They are similar in spirit to Arrow, but tuned for execution needs such as dictionary wrapping, shared buffers, lazy loading, out-of-order writes, and zero-copy transformations.',
        'Memory is a first-class part of execution. Hash joins, aggregations, sorts, and spills can grow quickly. A shared execution engine needs memory pools, allocation tracking, spill paths, and metrics so the host system can manage resource pressure rather than discover it after failure.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The vector-engine view proves that execution is a pipeline of physical operators over batches, not a row-at-a-time loop. Vectors let one operator process many values at once, exploit cache locality, skip repeated decoding, and carry dictionary or constant encodings through later work.',
        'The reuse-boundary view proves what Velox does not own. SQL parsing, dataframe APIs, cost-based optimization, cluster scheduling, and dialect policy remain outside. The adapter is where the host system translates its plan and semantics into reusable execution.',
        'The consolidation view proves the engineering payoff. Before Velox, several engines may duplicate execution code. After Velox, they can share the same optimized core while keeping different frontends and schedulers.',
        'The memory-pool node is deliberately visible because execution engines fail under pressure before they fail in the average case. A plan that is fast when all hash tables fit in memory needs a spill strategy, accounting model, and host-level backpressure when the same query meets skew or larger-than-estimated data.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Vectorized execution works because modern CPUs are much faster when data is laid out predictably and processed in batches. Operators can reduce branches, improve cache behavior, use SIMD-friendly loops, and avoid per-row virtual dispatch.',
        'Dictionary and constant encodings work because many query operations filter, project, and join without needing to materialize every value immediately. Carrying encoded structure through the pipeline can avoid copies and preserve sharing.',
        'Shared execution works organizationally because execution bugs and optimizations are concentrated in one place. The host systems still compete on planning, semantics, scheduling, and product experience, but the physical data plane benefits from shared investment.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The main tradeoff is integration complexity. A host system must adapt plans, functions, types, null rules, connector behavior, and metrics into Velox. If that adapter is weak, the shared engine can compute the wrong answer very quickly.',
        'Velox also does not remove planning or scheduling. Join order, cardinality estimates, repartitioning strategy, cluster placement, workload isolation, and user-facing APIs remain the embedding system\'s responsibility. A shared execution engine is a foundation, not a complete warehouse.',
        'There is a governance cost too. Several systems depending on one execution core need compatibility discipline, performance regression testing, and a way to evolve operators without surprising every host at once.',
        'A practical integration review should trace one query end to end: which frontend planned it, which adapter mapped it, which Velox operators ran it, which connector read the data, which memory pool owned each allocation, what spilled, and which metrics return to the host. That trace is what keeps reuse from becoming a black box.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Velox wins when several systems need the same high-performance data plane. Presto-like query engines, Spark-like execution paths, feature engineering, data loading for ML, and analytics services can keep different frontends while sharing scan, expression, join, aggregate, memory, spill, and connector logic.',
        'It is especially attractive for organizations with deep execution expertise but too many engines. A single vector optimization or connector improvement can lift many workloads. A single memory-accounting fix can prevent several classes of outage.',
        'It is less attractive when a system has unusual semantics, a tiny workload, or no need for high-performance columnar execution. The adapter cost has to be paid back by enough reuse and enough performance pressure.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The danger is semantic mismatch. SQL dialects, timestamp rules, null behavior, aggregate semantics, decimal precision, collation, and function implementations differ across systems. If the adapter binds a function loosely, the shared engine can faithfully compute the wrong meaning.',
        'Another failure is treating vectorization as a universal cure. Bad plans still hurt. A poor join order, missing predicate pushdown, skewed partitioning, or underestimated cardinality can overwhelm even a strong execution engine.',
        'A third failure is losing accountability. When a query is slow or wrong, the boundary between optimizer, adapter, connector, and Velox operator must be observable. Shared infrastructure needs better provenance, not less.',
        'Connector behavior is another sharp edge. Predicate pushdown, lazy loading, file statistics, and partition pruning must match the host planner\'s assumptions exactly.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Meta engineering announcement at https://engineering.fb.com/2023/03/09/open-source/velox-open-source-execution-engine/, Velox repository at https://github.com/facebookincubator/velox, Velox in 10 minutes at https://facebookincubator.github.io/velox/velox-in-10-min.html, Velox vectors docs at https://facebookincubator.github.io/velox/develop/vectors.html, Velox operators docs at https://facebookincubator.github.io/velox/develop/operators.html, and the VLDB paper at https://vldb.org/pvldb/vol15/p3372-pedreira.pdf. Study DuckDB Vectorized Execution Case Study, Apache Arrow Columnar Memory Case Study, SQL Join Algorithms Primer, Exchange Operator Parallel Query, Cascades Memo Query Optimizer, Substrait Query Plan Interchange Case Study, Apache DataFusion Arrow Query Engine Case Study, and Parquet Columnar Format Case Study next.',
      ],
    },
  ],
};
