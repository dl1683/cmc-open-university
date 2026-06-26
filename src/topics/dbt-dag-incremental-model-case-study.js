// dbt DAG and incremental model case study: refs build a dependency graph,
// manifest artifacts preserve it, and incremental materializations update less.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dbt-dag-incremental-model-case-study',
  title: 'dbt DAG & Incremental Model Case Study',
  category: 'Systems',
  summary: 'dbt as a data-transformation graph: ref and source build a DAG, manifests encode parents and children, tests guard contracts, and incremental models update changed rows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['model DAG', 'incremental run'], defaultValue: 'model DAG' },
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

function dagGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'src', label: 'source', x: 0.7, y: 3.5, note: notes.src ?? 'raw' },
      { id: 'stg', label: 'stg', x: 2.3, y: 2.0, note: notes.stg ?? 'clean' },
      { id: 'int', label: 'int', x: 4.0, y: 2.0, note: notes.int ?? 'join' },
      { id: 'dim', label: 'dim', x: 4.0, y: 5.0, note: notes.dim ?? 'entity' },
      { id: 'mart', label: 'mart', x: 5.9, y: 3.5, note: notes.mart ?? 'metric' },
      { id: 'test', label: 'tests', x: 7.6, y: 2.0, note: notes.test ?? 'guard' },
      { id: 'doc', label: 'docs', x: 7.6, y: 5.0, note: notes.doc ?? 'lineage' },
      { id: 'user', label: 'BI/ML', x: 9.2, y: 3.5, note: notes.user ?? 'consume' },
    ],
    edges: [
      { id: 'e-src-stg', from: 'src', to: 'stg', weight: 'source' },
      { id: 'e-stg-int', from: 'stg', to: 'int', weight: 'ref' },
      { id: 'e-stg-dim', from: 'stg', to: 'dim', weight: 'ref' },
      { id: 'e-int-mart', from: 'int', to: 'mart', weight: 'ref' },
      { id: 'e-dim-mart', from: 'dim', to: 'mart', weight: 'ref' },
      { id: 'e-mart-test', from: 'mart', to: 'test', weight: 'check' },
      { id: 'e-mart-doc', from: 'mart', to: 'doc', weight: 'meta' },
      { id: 'e-mart-user', from: 'mart', to: 'user', weight: 'serve' },
    ],
  }, { title });
}

function incrementalGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'source', x: 0.7, y: 3.5, note: 'events' },
      { id: 'filter', label: 'filter', x: 2.5, y: 3.5, note: 'new rows' },
      { id: 'temp', label: 'temp', x: 4.2, y: 2.0, note: 'stage' },
      { id: 'target', label: 'target', x: 4.2, y: 5.0, note: 'existing' },
      { id: 'merge', label: 'merge', x: 6.2, y: 3.5, note: 'key' },
      { id: 'schema', label: 'schema', x: 7.9, y: 2.0, note: 'change' },
      { id: 'refresh', label: 'refresh', x: 7.9, y: 5.0, note: 'rebuild' },
      { id: 'done', label: 'done', x: 9.3, y: 3.5, note: 'table' },
    ],
    edges: [
      { id: 'e-source-filter', from: 'source', to: 'filter', weight: 'is_inc' },
      { id: 'e-filter-temp', from: 'filter', to: 'temp', weight: 'build' },
      { id: 'e-temp-merge', from: 'temp', to: 'merge', weight: 'new' },
      { id: 'e-target-merge', from: 'target', to: 'merge', weight: 'old' },
      { id: 'e-merge-schema', from: 'merge', to: 'schema', weight: 'cols' },
      { id: 'e-schema-refresh', from: 'schema', to: 'refresh', weight: 'if bad' },
      { id: 'e-merge-done', from: 'merge', to: 'done', weight: 'upsert' },
      { id: 'e-refresh-done', from: 'refresh', to: 'done', weight: 'full' },
    ],
  }, { title });
}

function* modelDag() {
  yield {
    state: dagGraph('dbt turns model references into a directed acyclic graph'),
    highlight: { active: ['src', 'stg', 'int', 'dim', 'mart', 'e-stg-int', 'e-int-mart'], found: ['doc'] },
    explanation: 'dbt models use source and ref calls to declare dependencies. Those references compile to database relations and also create the DAG used for ordering, selection, lineage, and documentation.',
    invariant: 'A dbt project is not a bag of SQL files; it is a graph of transformation contracts.',
  };

  yield {
    state: labelMatrix(
      'Graph artifacts',
      [
        { id: 'node', label: 'node' },
        { id: 'edge', label: 'edge' },
        { id: 'test', label: 'test' },
        { id: 'docs', label: 'docs' },
        { id: 'manifest', label: 'manifest' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'use', label: 'use' },
      ],
      [
        ['model', 'select'],
        ['ref', 'order'],
        ['assert', 'gate'],
        ['meta', 'read'],
        ['maps', 'tool'],
      ],
    ),
    highlight: { active: ['edge:stores', 'manifest:stores', 'test:use'], found: ['node:use'] },
    explanation: 'The manifest artifact makes the graph machine-readable. Nodes, sources, parent maps, child maps, tests, docs, and metadata can feed documentation, CI checks, selectors, and lineage tools.',
  };

  yield {
    state: dagGraph('Selection is graph traversal with resource filters'),
    highlight: { active: ['stg', 'int', 'dim', 'mart', 'e-stg-int', 'e-stg-dim', 'e-dim-mart'], compare: ['src'], found: ['test'] },
    explanation: 'Commands such as selecting a model and its downstream dependents are graph traversals over the dbt DAG. The graph lets teams run just the impacted slice instead of rebuilding everything.',
  };

  yield {
    state: labelMatrix(
      'DAG',
      [
        { id: 'cycle', label: 'cycle' },
        { id: 'hidden', label: 'hidden' },
        { id: 'wide', label: 'wide' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['nosrt', 'split'],
        ['miss', 'ref'],
        ['slow', 'select'],
        ['stale', 'regen'],
      ],
    ),
    highlight: { active: ['cycle:fix', 'hidden:fix'], compare: ['wide:sym'], found: ['stale:fix'] },
    explanation: 'The DAG only works if dependencies are explicit. Hidden dependencies, circular models, stale manifests, and overly broad selectors turn a useful graph into an unreliable build script.',
  };
}

function* incrementalRun() {
  yield {
    state: incrementalGraph('Incremental models update only the relevant slice'),
    highlight: { active: ['source', 'filter', 'temp', 'target', 'merge'], found: ['done'] },
    explanation: 'A dbt incremental model limits how much data is transformed on each run. The model filters new or changed rows, stages them, and inserts or updates the target table according to the configured strategy.',
  };

  yield {
    state: labelMatrix(
      'Incremental contract',
      [
        { id: 'exists', label: 'exists' },
        { id: 'flag', label: 'flag' },
        { id: 'mat', label: 'mat' },
        { id: 'key', label: 'key' },
        { id: 'filter', label: 'filter' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['table?', 'first'],
        ['refresh?', 'full'],
        ['incr?', 'config'],
        ['unique?', 'dupes'],
        ['new?', 'miss'],
      ],
    ),
    highlight: { active: ['mat:asks', 'key:asks', 'filter:asks'], compare: ['key:risk'], found: ['exists:risk'] },
    explanation: 'The is_incremental condition is true only when the target exists, the model is incremental, and full refresh is not requested. The SQL must still be valid for both incremental and full-build paths.',
    invariant: 'Incremental logic is a correctness contract, not only a performance switch.',
  };

  yield {
    state: incrementalGraph('Unique keys decide whether changed rows update or duplicate'),
    highlight: { active: ['temp', 'target', 'merge', 'e-temp-merge', 'e-target-merge'], compare: ['filter'], found: ['done'] },
    explanation: 'With a unique key, dbt can update or replace matching rows for strategies such as merge. Without the right key, late-arriving or corrected source rows can create duplicates or stale metrics.',
  };

  yield {
    state: labelMatrix(
      'Late',
      [
        { id: 'arrive', label: 'arrive' },
        { id: 'window', label: 'window' },
        { id: 'merge', label: 'merge' },
        { id: 'refresh', label: 'refresh' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['new', 'clock'],
        ['win', 'cost'],
        ['upsert', 'dupes'],
        ['full', 'blast'],
      ],
    ),
    highlight: { active: ['window:move', 'merge:move'], compare: ['window:watch'], found: ['refresh:watch'] },
    explanation: 'A robust daily-active-users model often reprocesses a lookback window, merges by date or surrogate key, and reserves full refresh for logic changes or serious schema drift.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'model DAG') yield* modelDag();
  else if (view === 'incremental run') yield* incrementalRun();
  else throw new InputError('Pick a dbt view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the DAG view as build order and blast radius. A directed acyclic graph, or DAG, is a graph with arrows and no cycles. Active nodes are being built or selected, found nodes have produced artifacts, and compare nodes show dependencies that determine which downstream models must run.',
        'Read the incremental view as state update. The source slice holds candidate rows, the target table holds old materialized state, the temp relation stages new results, and the merge node decides insert or update. The safe inference rule is that parent edges prove order, while the incremental key proves which stored row may change.',
        {type:'callout', text:'dbt has two independent contracts: the DAG proves build order and blast radius, while incremental materialization proves the stored table still matches the promised rebuild window.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt:'Directed acyclic graph arranged in topological order with arrows flowing from earlier to later nodes.', caption:'Topological ordering of a DAG. Source: Wikimedia Commons, David Eppstein, CC0 1.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'dbt is a tool for building analytics transformations, mostly SQL models, inside a data warehouse. A model is a query that produces a table or view, and ref() declares that one model depends on another. The project starts as SQL files and becomes a dependency system.',
        'The second problem is warehouse cost. A fact table with four years of events should not be fully recomputed every hour if only the last batch changed. Incremental models exist to update a stored target table while touching only the changed slice that the model promises to maintain.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a folder of numbered SQL scripts. Run 01_load_raw.sql, then 02_stg_orders.sql, then 03_dim_customers.sql, and keep the order in a runbook. This is understandable when the project has a dozen stable models and one owner.',
        'The obvious update strategy is a full rebuild. Drop the target, rerun the query over all source history, and replace the result. Full rebuilds are appealing because they avoid stored-state reasoning when the data is small enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The graph wall is hidden dependency. A model may query a hard-coded table name, a macro may generate a relation at runtime, or a dashboard may read a staging table without a declared exposure. If dbt cannot parse the edge, it cannot build parents first or select the right descendants after a change.',
        'The cost wall is late-arriving data. A today-only incremental filter is fast, but a payment correction for yesterday will be missed. DAG correctness and incremental correctness are independent, so a perfect graph can still produce stale rows if the update window is wrong.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'There are two contracts. The DAG contract says which resources depend on which other resources. The incremental contract says how one selected resource updates its stored target without recomputing all history.',
        'For the DAG, explicit ref() and source() calls create edges that support topological ordering and descendant selection. For the incremental model, the target table is part of the algorithm: prior state, candidate rows, unique key, predicate, and write strategy. Correctness means the maintained window matches the result of a full refresh over the same source data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During parsing, dbt builds a manifest with nodes, sources, tests, docs, parent maps, and child maps. A ref() call returns a database relation and declares a dependency on another dbt resource. A source() call returns a declared external table and adds an edge from that source into the model.',
        'A DAG with no cycles has at least one topological order, meaning every parent can be built before its child. Selectors then walk the graph: ancestors for prerequisites and descendants for blast radius. That same metadata powers docs, CI, state comparison, and lineage inspection.',
        'An incremental model uses is_incremental() to switch SQL paths after the target exists. It filters a source slice, stages the current result, and writes into the target using append, merge, delete-insert, insert-overwrite, or microbatch strategy. The unique key defines the grain that should update rather than duplicate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The DAG part works because every visible edge constrains build order. If model B depends on model A, A must exist before B compiles or runs correctly. If the graph has a cycle, no ordering satisfies all edges, so rejection is safer than guessing.',
        'The incremental part works by simulation. Let T be the target after an incremental run, F be the full-refresh result, and W be the window the model claims to maintain. The run is correct when T restricted to W equals F restricted to W, which requires a complete change filter, a valid key, and a refresh when business logic changes outside W.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Graph cost grows with project files, macros, parse work, selector evaluation, scheduling, and artifact management. The payoff is selective execution. A one-model change can run that model and descendants instead of rebuilding the whole project.',
        'Incremental cost grows with the changed slice, lookback window, target matching, and writes. A full rebuild over 2 billion rows roughly doubles in scan cost when the table doubles. A good incremental run over 20 million recent rows stays near the window size, but it now owns late data, schema drift, key tests, and refresh policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'dbt DAGs are useful for analytics projects with staging, intermediate, dimension, mart, test, docs, and exposure layers. CI can build state:modified+ in a development schema and test only the affected subgraph. Reviewers get lineage evidence instead of searching filenames by hand.',
        'Incremental materialization is useful for event streams, fact tables, daily aggregates, feature-store tables, server logs, and high-volume transaction models. The fit is strongest when the business grain is stable and late-arrival behavior can be measured. Small dimensions and volatile logic often belong in full rebuilds.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The DAG fails when dependencies stay hidden. Hard-coded table names, undeclared sources, runtime-only relation construction, stale manifests, and undeclared dashboard consumers make the graph less complete than it looks. A graph that misses one important edge can produce a false CI pass.',
        'Incremental models fail quietly. A null unique key, duplicate key, narrow lookback, timezone boundary, ignored schema change, source truncation, or logic change without full refresh can produce plausible numbers that are wrong. Fast runs are not evidence of correct state.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A commerce team maintains fct_daily_customer_revenue with one row per date_day and customer_id. The target table has 500 million rows over four years, and new or corrected orders usually arrive within 72 hours. The model uses a three-day lookback and a merge key of date_day plus customer_id.',
        'On Monday, 10 million source rows arrive and the lookback scans 30 million rows instead of 500 million. A late correction for customer 17 from yesterday updates the existing target row because the key matches. A correction from six months ago is outside the maintained window, so it needs a backfill or full refresh.',
        'If finance changes net_revenue from gross minus refunds to gross minus refunds minus fees, the normal incremental run is unsafe. Old rows outside the three-day window still use the old definition. The correct operation is a full refresh of the mart and its selected descendants.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read dbt ref() at https://docs.getdbt.com/reference/dbt-jinja-functions/ref, source() at https://docs.getdbt.com/reference/dbt-jinja-functions/source, manifest artifacts at https://docs.getdbt.com/reference/artifacts/manifest-json, incremental models at https://docs.getdbt.com/docs/build/incremental-models, and incremental strategies at https://docs.getdbt.com/docs/build/incremental-strategy. Then study topological sort, hash maps, Airflow DAG scheduling, Delta Lake or Iceberg table formats, OpenLineage, slowly changing dimensions, and feature stores.',
      ],
    },
  ],
};
