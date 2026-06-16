// Polars LazyFrame optimizer case study: lazy query DAGs, explainable plans,
// predicate pushdown, projection pushdown, slice pushdown, and materialization.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'polars-lazyframe-query-optimizer-case-study',
  title: 'Polars LazyFrame Query Optimizer Case Study',
  category: 'Systems',
  summary: 'Polars LazyFrame as a query-plan data structure: build a lazy DAG, optimize the whole plan, push filters and projections to scans, then collect results.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lazy plan', 'optimizer passes'], defaultValue: 'lazy plan' },
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

function lazyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'scan', label: 'scan', x: 0.7, y: 3.5, note: notes.scan ?? 'file' },
      { id: 'filter', label: 'filter', x: 2.4, y: 2.0, note: notes.filter ?? 'pred' },
      { id: 'withcol', label: 'with', x: 2.4, y: 5.0, note: notes.withcol ?? 'expr' },
      { id: 'select', label: 'select', x: 4.3, y: 3.5, note: notes.select ?? 'cols' },
      { id: 'join', label: 'join', x: 6.1, y: 2.0, note: notes.join ?? 'optional' },
      { id: 'agg', label: 'agg', x: 6.1, y: 5.0, note: notes.agg ?? 'group' },
      { id: 'opt', label: 'opt', x: 7.8, y: 3.5, note: notes.opt ?? 'rewrite' },
      { id: 'collect', label: 'collect', x: 9.3, y: 3.5, note: notes.collect ?? 'run' },
    ],
    edges: [
      { id: 'e-scan-filter', from: 'scan', to: 'filter', weight: 'lazy' },
      { id: 'e-filter-with', from: 'filter', to: 'withcol', weight: 'expr' },
      { id: 'e-with-select', from: 'withcol', to: 'select', weight: 'cols' },
      { id: 'e-select-join', from: 'select', to: 'join', weight: 'keys' },
      { id: 'e-select-agg', from: 'select', to: 'agg', weight: 'groups' },
      { id: 'e-join-opt', from: 'join', to: 'opt', weight: '' },
      { id: 'e-agg-opt', from: 'agg', to: 'opt', weight: '' },
      { id: 'e-opt-collect', from: 'opt', to: 'collect', weight: 'exec' },
    ],
  }, { title });
}

function optimizerGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'LazyFrame' },
      { id: 'pred', label: 'pred', x: 2.5, y: 1.5, note: 'push' },
      { id: 'proj', label: 'proj', x: 2.5, y: 3.5, note: 'push' },
      { id: 'slice', label: 'slice', x: 2.5, y: 5.5, note: 'push' },
      { id: 'cse', label: 'CSE', x: 4.6, y: 2.5, note: 'reuse' },
      { id: 'simpl', label: 'simpl', x: 4.6, y: 4.8, note: 'expr' },
      { id: 'scan', label: 'scan', x: 6.7, y: 3.5, note: 'less IO' },
      { id: 'collect', label: 'collect', x: 8.8, y: 3.5, note: 'execute' },
    ],
    edges: [
      { id: 'e-query-pred', from: 'query', to: 'pred', weight: 'filter' },
      { id: 'e-query-proj', from: 'query', to: 'proj', weight: 'cols' },
      { id: 'e-query-slice', from: 'query', to: 'slice', weight: 'limit' },
      { id: 'e-pred-scan', from: 'pred', to: 'scan', weight: 'early' },
      { id: 'e-proj-scan', from: 'proj', to: 'scan', weight: 'narrow' },
      { id: 'e-slice-scan', from: 'slice', to: 'scan', weight: 'small' },
      { id: 'e-cse-scan', from: 'cse', to: 'scan', weight: 'cache' },
      { id: 'e-simpl-collect', from: 'simpl', to: 'collect', weight: 'cheap' },
      { id: 'e-scan-collect', from: 'scan', to: 'collect', weight: 'batches' },
    ],
  }, { title });
}

function* lazyPlan() {
  yield {
    state: lazyGraph('LazyFrame stores a query plan instead of running now'),
    highlight: { active: ['scan', 'filter', 'withcol', 'select', 'e-scan-filter', 'e-filter-with'], found: ['collect'] },
    explanation: 'A Polars LazyFrame represents a deferred computation graph. Operations add nodes to a plan, and nothing materializes until collect or a similar execution boundary.',
    invariant: 'Lazy execution gives the optimizer the whole query, not one eager step at a time.',
  };

  yield {
    state: labelMatrix(
      'Eager versus lazy',
      [
        { id: 'eager', label: 'eager' },
        { id: 'lazy', label: 'lazy' },
        { id: 'explain', label: 'explain' },
        { id: 'collect', label: 'collect' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['now', 'early'],
        ['plan', 'defer'],
        ['show', 'debug'],
        ['run', 'pay'],
      ],
    ),
    highlight: { active: ['lazy:does', 'explain:does'], compare: ['eager:cost'], found: ['collect:does'] },
    explanation: 'The data structure changes the workflow. In eager mode, each operation commits immediately. In lazy mode, the plan can be inspected, optimized, reordered, and only then executed.',
  };

  yield {
    state: lazyGraph('The optimized plan can move work toward the scan'),
    highlight: { active: ['scan', 'filter', 'select', 'opt', 'e-scan-filter', 'e-with-select'], compare: ['withcol'], found: ['collect'] },
    explanation: 'When the optimizer sees the entire graph, it can push filters and projections down to the scan. That means fewer rows and columns flow through later expressions, joins, and aggregations.',
  };

  yield {
    state: labelMatrix(
      'Plan',
      [
        { id: 'bottom', label: 'bottom' },
        { id: 'middle', label: 'middle' },
        { id: 'top', label: 'top' },
        { id: 'diff', label: 'diff' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'asks', label: 'asks' },
      ],
      [
        ['scan', 'IO?'],
        ['expr', 'wide?'],
        ['out', 'need?'],
        ['opt', 'moved?'],
      ],
    ),
    highlight: { active: ['bottom:means', 'diff:asks'], found: ['middle:asks'] },
    explanation: 'The practical skill is reading non-optimized and optimized plans. Ask what moved down, what columns remain, which predicates became scan selections, and where materialization still happens.',
  };
}

function* optimizerPasses() {
  yield {
    state: optimizerGraph('Polars applies whole-query optimizer passes'),
    highlight: { active: ['query', 'pred', 'proj', 'slice', 'scan'], found: ['collect'] },
    explanation: 'Polars documents optimizer passes such as predicate pushdown, projection pushdown, slice pushdown, common subplan elimination, and expression simplification. These are query-graph rewrites.',
  };

  yield {
    state: labelMatrix(
      'Optimizer pass ledger',
      [
        { id: 'pred', label: 'pred' },
        { id: 'proj', label: 'proj' },
        { id: 'slice', label: 'slice' },
        { id: 'cse', label: 'CSE' },
        { id: 'simp', label: 'simp' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'win', label: 'win' },
      ],
      [
        ['early', 'rows'],
        ['scan', 'cols'],
        ['scan', 'limit'],
        ['cache', 'reuse'],
        ['fold', 'cpu'],
      ],
    ),
    highlight: { active: ['pred:move', 'proj:win', 'slice:win'], found: ['cse:win'], compare: ['simp:move'] },
    explanation: 'Each pass changes the data moved by the plan. Predicate pushdown reduces rows, projection pushdown reduces columns, slice pushdown reduces range, and common subplan elimination avoids repeating shared work.',
    invariant: 'An optimizer pass is valuable only if it preserves the result while lowering IO, memory, or CPU.',
  };

  yield {
    state: optimizerGraph('Pushdown makes file scans act like selective operators'),
    highlight: { active: ['pred', 'proj', 'slice', 'scan', 'e-pred-scan', 'e-proj-scan', 'e-slice-scan'], compare: ['collect'] },
    explanation: 'The most important LazyFrame mental model is that a scan is not always a dumb read. With pushdown, the scan can become narrower and more selective before later operators see any data.',
  };

  yield {
    state: labelMatrix(
      'Note',
      [
        { id: 'load', label: 'load' },
        { id: 'clean', label: 'clean' },
        { id: 'join', label: 'join' },
        { id: 'save', label: 'save' },
      ],
      [
        { id: 'lazy', label: 'lazy' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['scan', 'schema'],
        ['expr', 'nulls'],
        ['keys', 'skew'],
        ['sink', 'mem'],
      ],
    ),
    highlight: { active: ['load:lazy', 'clean:lazy', 'join:lazy'], compare: ['join:watch'], found: ['save:lazy'] },
    explanation: 'A realistic notebook loads Parquet or CSV lazily, cleans columns, joins reference data, groups results, and writes output. The optimized plan decides how much work reaches each stage.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lazy plan') yield* lazyPlan();
  else if (view === 'optimizer passes') yield* optimizerPasses();
  else throw new InputError('Pick a Polars LazyFrame view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Polars LazyFrame is a deferred query plan over dataframe operations. Instead of running each step immediately, Polars records the plan, optimizes it as a whole, and executes when the user calls collect or another materializing operation.',
        'This topic links to Apache Arrow Columnar Memory Case Study, DuckDB Vectorized Execution Case Study, Apache DataFusion Arrow Query Engine Case Study, and Parquet Columnar Format Case Study. The shared concept is columnar data plus a query plan that can reduce unnecessary work before execution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lazy query starts with a scan, then accumulates filters, projections, expressions, joins, group-bys, sorts, and sinks as plan nodes. The non-optimized plan mirrors the code. The optimized plan may move filters, column selection, slices, and shared subplans to cheaper positions.',
        'The explain and graph views matter because they make the plan visible. A good Polars user can read whether a filter reached the scan, whether unneeded columns were removed, and whether a repeated scan became a shared subplan.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The key data structures are LazyFrame plan nodes, expression trees, scan nodes, projection sets, predicate expressions, join keys, aggregation state, optimized plan trees, and materialized DataFrames. A LazyFrame is best understood as a query-plan object, not as a table already in memory.',
        'Pushdown uses dependency information. The optimizer has to know which columns an expression needs, whether a predicate can be evaluated at the scan, whether a slice is safe to move, and whether two subplans are identical enough to share.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'LazyFrame teaches why dataframes and databases have converged. Once a dataframe stores a plan, it can do database-style optimization: read fewer columns, filter earlier, reuse common subplans, and avoid materializing temporary results.',
        'The performance lesson is simple but deep: the best row is the one not read, and the best column is the one not decoded. Lazy planning gives Polars the information needed to avoid both.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common user mistakes include accidentally collecting too early, hiding predicates inside expressions that cannot be pushed down, selecting more columns than needed, using Python UDFs where native expressions would optimize better, and ignoring the optimized plan.',
        'System risks include schema drift at scan time, joins with skewed keys, memory blowups during aggregation or sort, and assumptions that every file format or source can push down every predicate. The explain plan is the first debugging tool.',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: Polars Lazy API documentation at https://docs.pola.rs/user-guide/concepts/lazy-api/, Polars optimizer documentation at https://docs.pola.rs/user-guide/lazy/optimizations/, and Polars query-plan documentation at https://docs.pola.rs/user-guide/lazy/query-plan/.',
        'Study this with DataFusion for an Arrow-native query engine, DuckDB for vectorized execution, Parquet for columnar scans, and Apache Calcite for a planner-framework view of rule-based optimization.',
      ],
    },
  ],
};
