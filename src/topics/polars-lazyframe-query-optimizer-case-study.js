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
      heading: 'Why this exists',
      paragraphs: [
        'A dataframe library is easiest to understand when every line runs immediately. Load a file, filter rows, add a column, select fields, group, and print the result. That eager model is convenient, but it hides the same problem query engines have faced for decades: the written order of operations is often not the cheapest order of execution.',
        'Polars LazyFrame exists so Polars can see the whole computation before it pays for it. Lazy operations build a query plan. The optimizer rewrites that plan. Execution happens when the user calls collect or another materializing boundary. The data structure is not only a table; it is a plan that can still be changed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is eager dataframe code. Each method returns a concrete dataframe, and the next method consumes that dataframe. This is easy to debug because every intermediate value exists. It also matches how many learners think about data cleaning in notebooks.',
        'The approach breaks when inputs are large or when the code contains avoidable intermediate work. If you read all columns from a Parquet file and later select three, you paid for columns you did not need. If you filter after an expensive join even though the filter could have been applied to a scan, you made later operators process rows that should never have reached them.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is visibility. An eager step sees only the dataframe it was handed. It cannot easily move a future filter into a past scan because the past scan already happened. It cannot skip columns that a later select will discard because those columns have already been read and decoded.',
        'The second wall is memory. Eager chains may allocate temporary dataframes at each step. Some intermediates are logically useful for writing code but useless for execution. A query engine wants to combine, move, or remove those boundaries before data flows.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Defer execution and make the computation explicit. A LazyFrame records scans, filters, projections, expressions, joins, group-bys, sorts, slices, and sinks as plan nodes. The non-optimized plan mirrors the code. The optimized plan preserves the result but moves work to cheaper places.',
        'The main optimizer move is pushdown. Predicate pushdown moves filters as close to scans as correctness allows. Projection pushdown keeps only needed columns at the scan. Slice pushdown avoids loading more rows than a limit requires. Common subplan elimination avoids repeating shared work. Expression simplification removes avoidable computation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lazy query usually starts with a scan such as scan_parquet, scan_csv, or a lazy conversion from an existing dataframe. Each method call adds a node or expression to the logical plan. No file has to be fully read just because the scan node exists.',
        'When execution is requested, Polars applies optimizer passes. The optimized plan may ask a Parquet scan for only three columns, attach a predicate to the scan, move a limit downward, or reuse a repeated subtree. Then Polars executes the physical work in columnar batches and returns a concrete DataFrame or writes to a sink.',
        'The explain and query-plan views are part of normal use. They show both the original shape and the rewritten shape. A learner should ask which filters reached the scan, which columns remain at each scan, whether a slice moved down, and where materialization still happens.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The visible structure is a plan graph or tree. Scan nodes are leaves. Expressions describe column computations. Filter, select, join, aggregate, sort, and limit nodes transform the stream. Edges carry schemas and column requirements upward and downward.',
        'The optimizer needs metadata as much as operators. It uses schemas to know which columns exist, expressions to know which inputs are required, source capabilities to know what can be pushed into a scan, and equality of subplans to know what can be shared.',
        'This is why opaque operations are costly. A native expression such as pl.col("amount") > 100 has structure the optimizer can inspect. A user-defined function may be correct, but if it hides column dependencies or semantics, Polars has fewer safe rewrites available.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness rule is semantic preservation. An optimizer pass may move or remove work only when the final result is unchanged. A projection can move to a scan because unused columns do not affect later results. A filter can move below a projection when the projected columns still contain everything the predicate needs.',
        'A filter cannot always move freely. It may depend on a column created by a later expression, on join output, on aggregation results, or on semantics that the source cannot evaluate. The optimizer wins by moving work when the dependencies allow it and stopping when they do not.',
        'Lazy planning also works because cost often follows data volume. Fewer scanned columns means fewer bytes read and decoded. Earlier filters mean fewer rows entering joins and aggregations. Avoided intermediates mean lower memory pressure. The same logical query can therefore have a much cheaper physical path.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'LazyFrame adds planning overhead and delayed errors. Schema issues, unsupported operations, and source problems may appear at collect time rather than at the line where the lazy node was created. For small data, eager execution may feel simpler and the optimizer may not matter.',
        'For large data, the behavior changes. A query that projects three columns from a wide Parquet table can avoid reading the rest. A query that filters before a join can avoid building hash tables for rows that will be discarded. A query that accidentally calls collect halfway loses those opportunities for the second half of the pipeline.',
        'The dominant costs are usually IO, decoding, joins, sorts, aggregations, and memory for intermediate state. Lazy optimization attacks the first two with pushdown and the rest by reducing rows, columns, and duplicated work before expensive operators run.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LazyFrame wins in ETL pipelines, feature engineering, log analytics, notebook workflows that touch larger-than-memory files, and batch jobs over Parquet, IPC, CSV, and other scan sources. The more selective the query and the wider the data, the more projection and predicate pushdown can matter.',
        'It is also useful for teaching database ideas through dataframe code. A Polars user can write familiar chained expressions, then inspect the non-optimized and optimized plans. That makes projection pushdown, predicate pushdown, and materialization boundaries concrete rather than abstract query-planner vocabulary.',
        'The pattern fits reproducible data pipelines because the plan can be inspected, profiled, and often written to a sink without manually staging every intermediate table.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Lazy execution fails as a mental model when users assume every line has already produced data. Printing a LazyFrame is not the same as materializing it. Timing one method call may measure plan construction, not execution. Bugs can move to collect time.',
        'It also fails when optimization visibility is blocked. Opaque UDFs, early collect calls, unsupported scan sources, complex expressions that cannot be pushed down, and functions with side effects reduce the optimizer to a narrower set of safe moves.',
        'Some workloads are limited by operations that pushdown cannot remove. Skewed joins, large global sorts, high-cardinality group-bys, and memory-heavy aggregations may still dominate. Lazy planning can feed them less data, but it cannot make their structural cost disappear.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Inspect the optimized plan before tuning by hand. Look for pushed predicates, projected column lists at scans, slice placement, repeated scans, join order, and accidental materialization. The plan should explain why the engine reads the data it reads.',
        'Measure scanned bytes, number of columns read, rows after filters, peak memory, join build size, spill behavior where available, and total collect time. A slow LazyFrame is usually slow for a concrete reason visible in the plan or profile.',
        'For code review, watch for collect inside helper functions, conversion to Python objects, map or apply patterns that hide expressions, selecting all columns by habit, and scans that lack schema or statistics information. These choices shape what the optimizer can prove.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Parquet Columnar Format and Parquet Page Index to understand what scan pushdown can exploit. Study Apache DataFusion, DuckDB Vectorized Execution, Apache Calcite Planner Adapter, Volcano Iterator Query Execution, Selection Vector Filter Pipeline, and SQL Join Algorithms for the broader query-engine lineage.',
        'Official sources: Polars Lazy API documentation at https://docs.pola.rs/user-guide/concepts/lazy-api/, optimizer documentation at https://docs.pola.rs/user-guide/lazy/optimizations/, query-plan documentation at https://docs.pola.rs/user-guide/lazy/query-plan/, and LazyFrame API documentation at https://docs.pola.rs/api/python/dev/reference/lazyframe/index.html.',
      ],
    },
  ],
};
