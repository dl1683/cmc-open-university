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
      heading: 'Why this exists',
      paragraphs: [
        'Analytics SQL starts as a few useful queries and then becomes a dependency problem. A revenue mart depends on cleaned orders, cleaned orders depend on raw source tables, tests depend on the mart shape, and dashboards depend on the final relation. If those relationships live only in filenames and team memory, every change becomes a small migration risk.',
        'dbt exists to make those relationships explicit. A model is not just a SQL file; it is a node in a build graph. Calls to source and ref declare edges, tests attach contracts, docs attach meaning, and manifest.json turns the project into data that other tools can inspect.',
        'The incremental side solves a different but related problem. Once a fact table has years of history, rebuilding all rows for every daily update wastes warehouse time. Incremental materialization asks for a narrower contract: can this model update only the changed slice while still matching the result of a full rebuild?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is a folder of SQL scripts run in a fixed order. This is not foolish. For a small project, a runbook or scheduler can say: load staging, then dimensions, then marts, then dashboard extracts.',
        'The same simple approach often appears for updates: run every script from scratch. Full rebuilds are easy to reason about because they avoid stored state. If the SQL is correct and the source data is available, the table should be correct after the run.',
        'Both approaches work longer than people expect. The failure comes when the project has many owners, many downstream consumers, and tables large enough that all-history recomputation becomes too expensive for normal development and daily production runs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The graph wall is hidden dependency. A model may depend on a source through a macro, a comment, a copied table name, or a downstream dashboard nobody remembered. Without a machine-readable edge, the build system cannot order work, select impacted nodes, or explain lineage with confidence.',
        'The cost wall is stored history. A daily active users table might need only the last few days on most runs, but a late event from yesterday can still change yesterday. If the incremental filter only processes rows with today as the date, the model will be fast and wrong.',
        'The deeper wall is that graph correctness and incremental correctness are separate. The DAG can select the right model and still produce bad data if the merge key is not unique. The incremental filter can be correct and still miss downstream rebuilds if the graph hides an edge.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to split the system into two contracts. The DAG contract says which resources depend on which other resources. The incremental contract says how one resource updates its own stored table without recomputing all history.',
        'For the DAG, explicit edges allow topological order. If mart_revenue depends on int_orders and dim_customers, those parents must exist before the mart is built. If dim_customers changes, downstream selection can find the marts and tests that should run.',
        'For incremental models, the target table is part of the algorithm. The model has a current stored result, a candidate set of new or changed rows, a grain or unique key, and a strategy for insert, merge, delete plus insert, or partition replacement. Correctness means the stored result after the incremental run matches the intended full-refresh result for the data window being maintained.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The model-DAG view shows source, staging, intermediate, dimension, mart, tests, docs, and consumers as one lineage graph. The edges are not decoration. A ref edge is a build-order promise and an impact-analysis path.',
        'The graph-artifact frame shows why manifest.json matters. The manifest stores nodes, sources, tests, docs, parent maps, and child maps. That turns the project from a pile of SQL text into an inspectable dependency graph.',
        'The incremental-run view changes the question from order to state. The source contains candidate changes, the target already contains older results, a temporary relation stages the new slice, and the merge step decides whether each row should insert, update, or leave existing state alone.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During parsing, dbt resolves project resources into a manifest. The ref function returns a database relation and creates a dependency edge to the referenced model, seed, or snapshot. The source function does the same for declared source tables. The manifest records first-order parents and children so selection and documentation can use the same graph.',
        'A normal dbt run builds selected resources in dependency order. Selectors can choose one node, its ancestors, its descendants, or intersections with tags, paths, resource types, and state comparisons. This is graph traversal with resource filters.',
        'An incremental model starts with full-build SQL that must be valid when no target exists. On later runs, is_incremental is true only when the target table exists, the model is configured as incremental, and full refresh has not been requested. Inside that branch, the model filters to rows likely to be new or changed.',
        'The strategy then applies the staged rows to the target. Append simply inserts. Merge uses a unique key or grain to update matching rows and insert missing rows. Insert overwrite replaces partitions. Schema-change configuration decides whether new, removed, or changed columns should fail the run, sync, or be ignored.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The DAG works because explicit edges create a partial order. A directed acyclic graph can be topologically sorted, so every model can be built after its declared parents. If a cycle appears, there is no valid build order; dbt should reject the shape instead of guessing.',
        'Selection works because descendants are computed from recorded child edges, not from string matching table names in SQL. That is why hidden dependencies are dangerous. If a model depends on another relation without source or ref, the graph cannot protect the relationship.',
        'Incremental correctness is a simulation argument. After each run, the target table should represent the same business grain a full rebuild would have produced for the data covered by the model. A lookback window handles late-arriving records. A unique key prevents duplicates. A full refresh handles logic changes that need to rewrite old rows.',
        'The manifest widens the benefit. Documentation, CI jobs, ownership reports, lineage tools, and impact analysis can all read the same artifact. The dependency knowledge becomes shared data instead of local knowledge trapped in one dbt command.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a daily revenue mart depends on raw order events, stg_orders, int_order_lines, dim_customers, and dim_products. A change to dim_products should rebuild the revenue mart and its tests, but it should not rebuild unrelated marketing attribution models. The DAG gives the selector enough structure to choose the affected subgraph.',
        'For the mart itself, an incremental model might reprocess the last three days of order events, stage the resulting rows, and merge by order_id or by a surrogate key at the chosen grain. The three-day lookback is a deliberate cost. It catches late events and corrections that a strict today-only filter would miss.',
        'If finance changes the definition of net revenue, the lookback is not enough. Historical rows were computed under old logic, so the safe operation is usually full refresh for the model and selected descendants. The graph decides the blast radius; the materialization decides how to rebuild each node in that radius.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Graph cost is mostly parse, compile, selection, scheduling, and artifact management. More nodes mean more relationships to inspect, more tests to plan, and more build-order decisions. The payoff is that a small change can run a small selected subgraph instead of the whole project.',
        'Incremental cost lives in the warehouse. Filtering early can reduce scans, joins, and writes. Merge can be more expensive than append because the warehouse must match staged rows against existing target rows. Partition replacement can be cheaper when the data is naturally partitioned by date or batch.',
        'When data doubles, a full rebuild usually grows with the whole table. A good incremental run grows with the changed slice plus the lookback window. That is the main economic reason to use it. The tax is that the team must now own state, keys, late data, schema drift, and refresh policy.',
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        'Use source and ref even when a hard-coded table name feels faster. The extra ceremony pays back through ordering, docs, tests, and impact analysis. If a dependency is conditional inside Jinja, make sure dbt can still discover it during parsing.',
        'Treat unique_key as the grain of the output, not a convenience setting. If the key can be null, duplicated, or built from unstable fields, merge behavior will be unreliable. Add tests for uniqueness and not-null on the grain that the incremental model claims to maintain.',
        'Choose lookback windows from data behavior, not hope. Measure late-arrival distribution, correction frequency, source clock quality, and warehouse cost. A model that reprocesses seven days may be better than one that reprocesses one day and requires emergency backfills every week.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The dbt DAG is strong when analytics code has many dependencies and many consumers. It helps teams reason about staging layers, intermediate joins, marts, tests, docs, exposures, and ownership as one graph.',
        'Incremental models fit large event streams, fact tables, slowly refreshed marts, feature tables, and daily aggregates where most runs touch a small fraction of history. They are especially useful when a full rebuild is possible but too expensive for every run.',
        'The combination is useful in CI. A pull request can build only modified models and their children in a development schema, run tests on the affected path, and produce documentation or lineage evidence for reviewers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The DAG fails when dependencies stay hidden. Direct table names, undeclared sources, runtime-only refs, macros that obscure relationships, and stale artifacts make the graph less reliable than it looks.',
        'Incremental models fail quietly. Missed late rows, bad unique keys, null keys, schema drift, changed business logic, timezone errors, and source truncation can produce plausible but wrong metrics. Cheap runs are not a victory if they preserve bad state.',
        'The wrong lesson is to make everything incremental. Small dimensions, volatile business logic, and low-cost tables are often better as full rebuilds. Incremental state is a tool for expensive stable transformations, not a default badge of maturity.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: dbt ref documentation at https://docs.getdbt.com/reference/dbt-jinja-functions/ref, dbt source documentation at https://docs.getdbt.com/reference/dbt-jinja-functions/source, dbt manifest artifact documentation at https://docs.getdbt.com/reference/artifacts/manifest-json, and dbt incremental model documentation at https://docs.getdbt.com/docs/build/incremental-models.',
        'Study Topological Sort for build ordering, OpenLineage for production lineage events, Delta Lake and Hudi for table-update storage mechanics, Slowly Changing Dimension for history modeling, and Feature Store for downstream ML consumption of transformed tables.',
      ],
    },
  

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for dbt-dag-incremental-model-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
