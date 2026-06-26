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
    explanation: 'A LazyFrame is not a dataframe already sitting in memory. It is a deferred plan: each operation adds a node, and materialization waits until collect or another execution boundary.',
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
    explanation: 'The workflow changes because the data structure changed. Eager mode pays for each step immediately; lazy mode keeps the whole plan visible long enough to explain, rewrite, and run it once.',
  };

  yield {
    state: lazyGraph('The optimized plan can move work toward the scan'),
    highlight: { active: ['scan', 'filter', 'select', 'opt', 'e-scan-filter', 'e-with-select'], compare: ['withcol'], found: ['collect'] },
    explanation: 'The highlighted move is downward pushdown. Filters and projections move toward the scan so later joins, expressions, and aggregations handle fewer rows and fewer columns.',
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
    explanation: 'Optimizer passes are graph rewrites with a cost purpose. Predicate pushdown reduces rows, projection pushdown reduces columns, slice pushdown reduces ranges, and CSE avoids repeated work.',
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
    explanation: 'This notebook flow is the practical mental model: scan lazily, clean with expressions, join reference data, aggregate, then write. The optimized plan decides how much data each step actually sees.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the lazy plan as a tree of work that has not run yet. A scan node names a source, a filter node names a predicate, and a projection node names the columns that later work needs.',
        'In the optimizer-passes view, a node moving downward means Polars has proven it can do the same query earlier and cheaper. A pushed filter is the same result with fewer rows entering later operators.',
        {type:'callout', text:'LazyFrame changes dataframe work from immediate mutation into an inspectable plan that can be rewritten before IO and memory are spent.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A dataframe is a table-like structure for column operations such as filtering, selecting, grouping, and joining. Polars LazyFrame exists so the engine can inspect the full query before reading and materializing data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is eager execution. Load a file, run a filter, create a dataframe, select columns, create another dataframe, and continue.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is lost visibility. Once an eager scan has read 80 columns from a Parquet file, a later select of 4 columns cannot recover the skipped IO.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Defer execution and represent the computation as a plan. The optimized plan preserves the result but moves filters, projections, limits, and shared subplans to cheaper places.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lazy query begins with a scan such as scan_parquet or scan_csv. When collect or a sink requests execution, Polars applies optimizer passes and builds physical work from the rewritten plan.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness rule is semantic preservation. A rewrite is legal only when the final dataframe is unchanged for every input that satisfies the same assumptions.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lazy planning adds overhead and delayed errors, but it can cut IO and memory sharply. If a 100 GB Parquet dataset has 50 columns and the query needs 5, projection pushdown can cut scan bytes by about 90 percent before later operators run.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LazyFrame wins in ETL pipelines, feature engineering, log analytics, batch jobs over Parquet, and notebooks that touch larger-than-memory files. It is strongest when queries are selective or tables are wide.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when users assume every line has already produced data. It also loses power when opaque user-defined functions, early collect calls, unsupported sources, or side effects hide semantics from the optimizer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a Parquet file has 100 million rows, 60 columns, and each column averages 8 bytes per row. Reading all columns touches about 48 GB, while a query needing 6 columns touches about 4.8 GB before compression effects.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Polars Lazy API documentation at https://docs.pola.rs/user-guide/concepts/lazy-api/, optimizer documentation at https://docs.pola.rs/user-guide/lazy/optimizations/, query-plan documentation at https://docs.pola.rs/user-guide/lazy/query-plan/, and LazyFrame API documentation at https://docs.pola.rs/api/python/dev/reference/lazyframe/index.html. Study Parquet Columnar Format, Parquet Page Index, Apache DataFusion, DuckDB Vectorized Execution, Apache Calcite Planner Adapter, Selection Vector Filter Pipeline, and SQL Join Algorithms next.',
      ],
    },
  ],
};
