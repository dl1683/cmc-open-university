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
  references: [
    { title: 'dbt ref function', url: 'https://docs.getdbt.com/reference/dbt-jinja-functions/ref' },
    { title: 'dbt source function', url: 'https://docs.getdbt.com/reference/dbt-jinja-functions/source' },
    { title: 'dbt manifest.json artifact', url: 'https://docs.getdbt.com/reference/artifacts/manifest-json' },
    { title: 'dbt incremental models', url: 'https://docs.getdbt.com/docs/build/incremental-models' },
    { title: 'dbt incremental strategy', url: 'https://docs.getdbt.com/docs/build/incremental-strategy' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The model-DAG view is about ordering and blast radius. Source, staging, intermediate, dimension, mart, tests, docs, and BI/ML consumers are nodes. A source() or ref() edge means the child cannot be built correctly until the parent relation exists and has the expected shape.',
        {
          type: 'diagram',
          text: [
            'DAG view (build-order lineage):',
            '',
            '  source --[source]--> stg --[ref]--> int --[ref]--> mart --[check]--> tests',
            '                           --[ref]--> dim --[ref]-->      --[meta]---> docs',
            '                                                          --[serve]--> BI/ML',
            '',
            'Active nodes = current dependency path being built',
            'Found nodes  = artifacts produced (tests passed, docs generated)',
            'Compare nodes = shapes the graph must reject or repair',
            '',
            'Incremental view (state update):',
            '',
            '  source --[is_inc]--> filter --[build]--> temp --[new]--+',
            '                                         target --[old]--+--> merge --[upsert]--> done',
            '                                                              |',
            '                                                              +--[cols]--> schema --[if bad]--> refresh --[full]--> done',
          ].join('\n'),
          label: 'The DAG view asks "in what order and which nodes?" The incremental view asks "how many rows?"',
        },
        'The incremental-run view changes the question from order to state. The source node holds candidate changes, the target node holds the previous materialized result, the temp node stages the current slice, and the merge node decides whether each staged row updates, inserts, or leaves target state alone.',
        {
          type: 'note',
          text: 'One inference rule ties the two views together: if every dependency edge is explicit and the graph is acyclic, dbt can choose a valid parent-before-child build order. If the incremental model also has a stable grain, the materialization can update a selected node without rebuilding all history. Break either condition and the system loses either ordering or state correctness.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The most important function in dbt is ref(). Models are the atoms; refs are the bonds.',
          attribution: 'dbt Developer Hub, ref function documentation',
        },
        'Analytics projects begin as SQL files and become dependency systems. A revenue mart depends on cleaned orders, cleaned payments, customer dimensions, product dimensions, semantic tests, docs, exposures, and dashboard consumers. When those relationships live only in filenames, scheduler order, or team memory, every model change becomes an impact-analysis problem that nobody can answer with confidence.',
        'dbt makes the dependency structure explicit. A model is a node. A source() call declares an input table owned outside the project. A ref() call declares a dependency on another dbt resource and compiles to the database relation that should be queried. Tests and docs attach contracts. The manifest artifact serializes everything so tooling can inspect the same graph that dbt uses to build.',
        {
          type: 'table',
          headers: ['Problem', 'Without dbt', 'With dbt'],
          rows: [
            ['Build ordering', 'Filenames or runbook encode order', 'Topological sort on ref() edges'],
            ['Impact analysis', 'Grep for table names and hope', 'Descendant traversal from changed node'],
            ['Lineage docs', 'Manually maintained wiki pages', 'Auto-generated from manifest parent/child maps'],
            ['Update cost', 'Full rebuild of every table', 'Incremental: only the changed slice'],
            ['Contract enforcement', 'Manual review of column names', 'Tests for uniqueness, not-null, accepted values'],
          ],
        },
        'Incremental models solve the second half of the case study: warehouse cost. A fact table with four years of events does not need four years of recomputation every hour if only the last batch changed. The hard question is whether the cheap run preserves the same business result that a full rebuild would have produced.',
        {type:'callout', text:'dbt has two independent contracts: the DAG proves build order and blast radius, while incremental materialization proves the stored table still matches the promised rebuild window.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt:'Directed acyclic graph arranged in topological order with arrows flowing from earlier to later nodes.', caption:'Topological ordering of a DAG. Source: Wikimedia Commons, David Eppstein, CC0 1.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable system is a folder of SQL scripts plus a scheduler. The runbook says: build raw-cleaning queries first, dimensions second, intermediate joins third, marts fourth, dashboard extracts last. For a small team and a dozen stable models, this is understandable and often good enough.',
        'The corresponding update strategy is a full rebuild. Drop the target, rerun the SQL over all source data, replace the result. Full rebuilds are attractive because they carry almost no stored-state reasoning. If the SQL is correct and the source tables are complete, the output is correct after the run.',
        {
          type: 'code',
          language: 'bash',
          text: [
            '# The "obvious approach" pipeline',
            'psql -f sql/01_load_raw.sql',
            'psql -f sql/02_stg_orders.sql',
            'psql -f sql/03_dim_customers.sql',
            'psql -f sql/04_int_order_lines.sql',
            'psql -f sql/05_mart_revenue.sql',
            'psql -f sql/06_tests.sql',
            '',
            '# Works until:',
            '#   someone adds 03b_dim_products.sql without updating the order',
            '#   05_mart_revenue.sql takes 4 hours because events has 2B rows',
            '#   a dashboard nobody told you about reads dim_customers directly',
          ].join('\n'),
          label: 'Numbered scripts encode order in filenames instead of in a dependency graph',
        },
        {
          type: 'table',
          headers: ['Decision', 'Why it seems safe', 'What it stops proving'],
          rows: [
            ['Run scripts in a fixed order', 'A human can review the sequence', 'Whether a new dependency was added without updating the runbook'],
            ['Use hard-coded table names', 'The SQL is direct and portable', 'Whether build tooling can discover lineage or downstream impact'],
            ['Rebuild every model from scratch', 'No incremental state can go stale', 'Whether the daily job fits the warehouse budget'],
            ['Filter only today in an update', 'The run touches minimal data', 'Whether late events or corrections can change yesterday'],
          ],
        },
        'These choices are not naive. They delay complexity until the project has enough models, owners, and data volume to make dependency discovery and all-history recomputation genuinely expensive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The graph wall is hidden dependency. A model can depend on another relation through a macro branch, a copied database name, a dashboard query, or a runtime-only Jinja path. If dbt cannot parse the edge, it cannot put the parent before the child, select the affected descendants, or explain lineage in docs and CI.',
        {
          type: 'table',
          headers: ['Hidden dependency type', 'Why the graph misses it', 'Consequence'],
          rows: [
            ['Hard-coded table name in SQL', 'No ref() call, so no edge in the manifest', 'Model runs before its parent; query returns stale or missing data'],
            ['Macro that generates a FROM clause', 'dbt may not resolve the ref inside Jinja at parse time', 'Selector skips the model during impact analysis'],
            ['Dashboard reading a staging table', 'No exposure declared', 'Staging table is refactored; dashboard breaks silently'],
            ['Cross-project dependency via shared schema', 'No source() declaration in consuming project', 'Upstream drops a column; downstream produces nulls'],
          ],
        },
        'The cost wall is late-arriving data. A daily-active-users model can usually reprocess a small date window, but a mobile event timestamped 11:58 p.m. yesterday may land after midnight. A today-only filter is fast because it ignores the row that changes yesterday. That is a performance win that manufactures a data bug.',
        'The correctness wall is that DAG correctness and incremental correctness are independent. A perfect graph can select the right mart and still produce duplicate revenue if the unique key is wrong. A perfect merge key can preserve one table and still leave downstream consumers stale if a dependency edge is hidden.',
        {
          type: 'bullets',
          items: [
            'Graph failure: the build order is wrong, the selected subgraph is incomplete, or docs show a false lineage path.',
            'Incremental failure: the table runs cheaply but accumulates duplicates, stale aggregates, missing late rows, or old business logic applied to new data.',
            'Compound failure: a pull request passes because the changed model was tested, but its real downstream blast radius -- invisible because the edge was hidden -- never ran.',
          ],
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The case study has two contracts. The DAG contract says which resources depend on which other resources. The incremental contract says how one selected resource updates its stored target without recomputing all historical rows.',
        {
          type: 'diagram',
          text: [
            'Two contracts in one dbt project:',
            '',
            'DAG CONTRACT (ordering + selection):',
            '',
            '  source.orders --> stg_orders --> int_order_lines --> fct_revenue --> tests',
            '                         |                ^                |',
            '                         v                |                v',
            '                   dim_customers ---------+           docs/exposures',
            '',
            '  Invariant: parents build before children.',
            '  Selector:  descendants define blast radius.',
            '',
            'INCREMENTAL CONTRACT (state update inside fct_revenue):',
            '',
            '  source slice --> temp relation --> MERGE by (date_day, customer_id) --> target table',
            '                                         ^',
            '                                         |',
            '                                 existing target state',
            '',
            '  Invariant: target after run = full-refresh result for the maintained window.',
          ].join('\n'),
          label: 'The DAG decides WHICH models to run; the materialization decides HOW MUCH each one rebuilds',
        },
        'For the DAG, explicit edges create a partial order. If fct_revenue depends on int_order_lines and dim_customers, those parents must exist before the mart builds. If dim_customers changes, the graph traverses child edges to find marts, tests, docs, and exposures that should be rebuilt or revalidated.',
        'For the incremental model, the target table is part of the algorithm. The model has prior state, candidate rows, a grain, an incremental predicate, and a write strategy. Correctness means the stored target after the run is indistinguishable from the appropriate full-refresh result for the rows the model promises to maintain.',
        {
          type: 'note',
          text: 'The two contracts are orthogonal. You can have a correct DAG with broken incremental logic (right models selected, wrong rows produced). You can have correct incremental logic with a broken DAG (right rows produced, but a hidden downstream consumer was never rebuilt). Both must hold for the system to work.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During parsing, dbt resolves project resources into a manifest. The manifest contains nodes, sources, macros, docs, tests, parent maps, and child maps. That artifact is why the graph can feed commands, docs, state comparison, lineage inspection, and CI checks instead of staying trapped inside SQL text.',
        'A ref() call both returns a database relation and declares a dependency on the referenced model, seed, or snapshot. A source() call returns a relation for a declared source table and declares the source-to-model dependency. Those edges are what make topological build order and downstream selection possible.',
        {
          type: 'code',
          language: 'sql',
          text: [
            '-- fct_daily_customer_revenue.sql',
            '{{',
            '  config(',
            "    materialized='incremental',",
            "    unique_key=['date_day', 'customer_id'],",
            "    incremental_strategy='merge',",
            "    on_schema_change='fail'",
            '  )',
            '}}',
            '',
            'with source_orders as (',
            '  select *',
            "  from {{ source('shop', 'orders') }}",
            '  {% if is_incremental() %}',
            '    where updated_at >= (',
            "      select coalesce(max(updated_at), timestamp '1900-01-01')",
            '      from {{ this }}',
            "    ) - interval '3 day'",
            '  {% endif %}',
            '),',
            '',
            'revenue_by_customer_day as (',
            '  select',
            "    date_trunc('day', ordered_at) as date_day,",
            '    customer_id,',
            '    max(updated_at) as updated_at,',
            '    sum(net_amount) as net_revenue',
            '  from source_orders',
            '  group by 1, 2',
            ')',
            '',
            'select * from revenue_by_customer_day',
          ].join('\n'),
          label: 'Each ref() and source() creates a dependency edge; is_incremental() gates the filter',
        },
        'The incremental branch is active only when the target relation exists, the model is configured as incremental, and the run is not a full refresh. The SQL must still be valid when that branch is false, because the first build and every full-refresh path use the same model file.',
        {
          type: 'table',
          headers: ['Strategy', 'Mechanism', 'Best fit', 'Risk'],
          rows: [
            ['append', 'INSERT all staged rows', 'Immutable event streams where rows never repeat', 'Duplicates if source retries or replays'],
            ['merge', 'UPDATE matching rows, INSERT missing rows', 'Fact tables with corrections and late arrivals', 'Join cost grows with target size; null keys collapse rows'],
            ['delete+insert', 'DELETE matching keys, then INSERT', 'Keyed tables where full replacement per key is cheaper than merge', 'Deletes before insert; crash mid-write loses rows'],
            ['insert_overwrite', 'Replace entire partitions', 'Date-partitioned tables on Hive-style warehouses', 'Wrong partition boundary drops or preserves wrong data'],
            ['microbatch', 'Split by event-time into small batches', 'Large event-time workloads that exceed single-merge capacity', 'Adapter must support it; batch boundaries must align with grain'],
          ],
        },
        'Schema-change configuration decides whether new, removed, or changed columns should fail the run, sync, or be ignored. This is a separate contract from the row-update strategy -- both must be set deliberately.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The DAG works because a directed acyclic graph has at least one topological order. Every edge points from parent to child. If the graph has no cycle, dbt can build parents before children. If a cycle exists, no valid order satisfies all edges, so the project shape must be rejected rather than guessed.',
        'Selection works because parent_map and child_map encode first-order relationships. Ancestor traversal finds prerequisites. Descendant traversal finds impacted resources. State comparison narrows work to modified nodes, and graph operators expand from those nodes to the consumers that need validation.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Incremental correctness invariant:',
            '',
            '  Let T = target table after incremental run',
            '  Let F = result of a full refresh on the same source data',
            '  Let W = the data window the model claims to maintain',
            '',
            '  Correctness:  T restricted to W  =  F restricted to W',
            '',
            '  This holds when:',
            '    1. The filter catches all rows that changed within W',
            '       (lookback window handles late arrivals)',
            '    2. The unique_key identifies each business grain exactly once',
            '       (merge prevents duplicates)',
            '    3. Business logic has not changed since rows outside W were written',
            '       (full refresh handles logic changes)',
            '',
            '  If any of (1), (2), (3) fails, T diverges from F silently.',
          ].join('\n'),
          label: 'Incremental correctness is a simulation argument: the partial update must match the full rebuild',
        },
        {
          type: 'note',
          text: 'The lookback window is a correctness device before it is a cost device. It defines the part of history the model is willing to recompute to absorb late records, source corrections, clock skew, and upstream retry behavior. A wider window costs more warehouse time but catches more corrections. The right width comes from measuring the source late-arrival distribution, not from guessing.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A commerce team maintains fct_daily_customer_revenue. Raw orders land throughout the day. Payment corrections can arrive up to 72 hours late. The mart feeds finance dashboards, a customer-health ML model, and a weekly board report. The target grain is one row per (date_day, customer_id).',
        {
          type: 'diagram',
          text: [
            'DAG path for fct_daily_customer_revenue:',
            '',
            '  source.shop.orders --> stg_orders --> int_order_lines --+',
            '  source.shop.customers --> stg_customers --> dim_customers --+--> fct_daily_customer_revenue',
            '  source.shop.products --> stg_products --> dim_products -----+        |',
            '                                                                      +--> test_unique_grain',
            '                                                                      +--> test_not_null_revenue',
            '                                                                      +--> exposure_finance_dashboard',
            '',
            'If dim_products changes:',
            '  Selector "dim_products+" rebuilds: dim_products, fct_daily_customer_revenue, tests, exposure',
            '  Skips: stg_orders, dim_customers, marketing_attribution (not downstream)',
          ].join('\n'),
          label: 'The DAG selects only the affected subgraph, not the whole project',
        },
        'The incremental path reprocesses the last three days from source orders, groups by date_day and customer_id, stages the result, and merges into the target using the composite unique key. A same-day duplicate updates the existing row. A late correction from two days ago updates the older row. A correction from six months ago is outside the normal window and requires an explicit backfill or full refresh.',
        {
          type: 'table',
          headers: ['Event', 'DAG decision', 'Incremental decision', 'Correct outcome'],
          rows: [
            ['stg_orders SQL changes', 'Run stg_orders and all descendants', 'Materialization strategy unchanged', 'Affected marts and tests rebuild in dependency order'],
            ['Late order from yesterday lands', 'No graph shape change needed', 'Included by three-day lookback window', 'Yesterday revenue row updates via merge'],
            ['Finance changes net_revenue definition', 'Select mart and descendants', 'Normal lookback is insufficient', 'Full refresh rewrites all historical rows'],
            ['New source column appears', 'No graph shape change', 'on_schema_change: fail halts the run', 'Team reviews column, updates model, rebuilds'],
            ['dim_customers adds segment field', 'Run dim_customers and descendants', 'Each dependent model decides its own refresh', 'Blast radius follows edges, not folder names'],
          ],
        },
        {
          type: 'code',
          language: 'bash',
          text: [
            '# Normal daily run: incremental with 3-day lookback',
            'dbt run -s fct_daily_customer_revenue',
            'dbt test -s fct_daily_customer_revenue',
            '',
            '# After net_revenue definition change: full refresh + descendants',
            'dbt run --full-refresh -s fct_daily_customer_revenue+',
            'dbt test -s fct_daily_customer_revenue+',
            '',
            '# CI on a PR that modifies int_order_lines:',
            'dbt run -s state:modified+ --defer --state prod-manifest/',
            'dbt test -s state:modified+',
          ].join('\n'),
          label: 'Three scenarios, three selector strategies, same DAG',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Dominant cost', 'Correctness condition', 'Typical tax'],
          rows: [
            ['Parse graph', 'Project files and macros', 'Dependencies are visible during parse', 'Conditional refs need explicit depends_on'],
            ['Select descendants', 'Graph traversal plus filters', 'Edges represent real downstream impact', 'Hidden consumers are missed'],
            ['Full refresh', 'All source history, all joins', 'Source history is complete', 'Cost grows linearly with total table size'],
            ['Incremental merge', 'Changed slice plus target match', 'Unique key is non-null and unique at grain', 'Bad keys create duplicates or stale rows'],
            ['Insert overwrite', 'Affected partitions only', 'Partition boundary covers all changed rows', 'Wrong boundary drops or preserves wrong data'],
          ],
        },
        'Graph cost is mostly parsing, compiling, selector evaluation, scheduling, test planning, and artifact management. More nodes mean more edges and metadata, but the payoff is selective execution: a small change runs a small affected subgraph instead of the whole project.',
        'Incremental cost lives in scans, joins, target matching, and writes. Filtering early reduces source work. Merge is more expensive than append because the warehouse must compare staged rows with existing target rows. On Snowflake, a merge against a 500M-row target is dominated by the hash join on the unique key column. Partition replacement avoids the join entirely but requires naturally partitioned data.',
        {
          type: 'note',
          text: 'When total data doubles, a full rebuild roughly doubles its scan cost. A good incremental run grows only with the changed slice plus the lookback window. That is the economic reason to use incremental materialization. The tax is permanent ownership of state, keys, late-data behavior, schema drift, and refresh policy as production concerns.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Event streams and fact tables: clickstream, transactions, server logs -- high volume, append-heavy, late arrivals within a bounded window. Incremental merge with a lookback is the standard pattern.',
            'Daily and weekly aggregates: DAU, revenue rollups, cohort tables. Most runs touch a few days of source data. Full rebuild is possible but wasteful at scale.',
            'Feature stores for ML: feature tables refreshed from raw events. Incremental updates keep features fresh without recomputing the full history on every training snapshot.',
            'CI for analytics: a pull request builds only modified models and their children in a dev schema, runs tests on the affected path, and produces lineage evidence for reviewers. The DAG makes this selection possible.',
            'Multi-team ownership: staging, intermediate, and mart layers owned by different teams. The manifest acts as a contract boundary -- each team declares what it produces and what it depends on.',
          ],
        },
        {
          type: 'code',
          language: 'bash',
          text: [
            '# CI job: build only what changed and test the blast radius',
            'dbt run -s state:modified+ --defer --state prod-manifest/',
            'dbt test -s state:modified+',
            '',
            '# Production: incremental daily, full refresh on Sundays',
            'if [ "$(date +%u)" = "7" ]; then',
            '    dbt run --full-refresh -s tag:incremental',
            'else',
            '    dbt run -s tag:incremental',
            'fi',
          ].join('\n'),
          label: 'State selectors and deferred manifests let CI run only the affected subgraph',
        },
        'The combination of DAG selection and incremental materialization is strongest when the project has hundreds of models, multiple teams, and fact tables large enough that full rebuilds are reserved for weekly maintenance windows or logic changes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The DAG fails when dependencies stay hidden. Direct table names, undeclared sources, Jinja branches that hide refs during parsing, runtime-only relation construction, and stale artifacts make the graph less reliable than it looks. A graph that is 90% complete gives 90% confidence and 100% of the surprise when the missing 10% breaks.',
        'Incremental models fail quietly. A bad unique key, null key, missed late row, timezone boundary, schema drift, changed business definition, source truncation, or over-narrow predicate can produce numbers that look plausible and are wrong. Fast runs are not evidence of correct state.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Repair'],
          rows: [
            ['Hidden dependency', 'Downstream model does not run after parent logic changes', 'Replace hard-coded names with source()/ref() or explicit depends_on'],
            ['Today-only filter', 'Late events never update yesterday metrics', 'Use a measured lookback window or event-time microbatching'],
            ['Non-unique merge key', 'Row count grows on every run; duplicate revenue', 'Test uniqueness and not-null on the declared grain'],
            ['Null merge key', 'All null-key rows collapse into one; data disappears', 'Add not-null test; warehouse treats NULL = NULL as a match in MERGE'],
            ['Logic change without refresh', 'Old rows computed under old definition', 'Run full refresh for the model and selected descendants'],
            ['Schema drift ignored', 'New source column appears but target shape is stale', 'Set on_schema_change deliberately and test expected columns'],
          ],
        },
        {
          type: 'note',
          text: 'The wrong lesson is to make every model incremental. Small dimensions, cheap staging models, volatile business logic, and tables that need exact all-history recomputation are often better as full rebuilds. Incremental state is a tool for expensive, stable, keyed transformations bounded by measurable late-data behavior -- not a default badge of maturity.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['dbt ref() docs (docs.getdbt.com)', 'How ref() creates dependency edges and resolves to database relations'],
            ['dbt source() docs (docs.getdbt.com)', 'How source() declares external table dependencies and freshness checks'],
            ['dbt manifest.json artifact (docs.getdbt.com)', 'Schema of the manifest: nodes, sources, parent_map, child_map, tests, docs'],
            ['dbt incremental models (docs.getdbt.com)', 'is_incremental(), unique_key, full refresh, on_schema_change behavior'],
            ['dbt incremental strategy (docs.getdbt.com)', 'append, merge, delete+insert, insert_overwrite, microbatch strategy families'],
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Study next'],
          rows: [
            ['Prerequisite', 'Topological Sort -- the graph algorithm behind parent-before-child build order'],
            ['Prerequisite', 'Hash Map -- manifest maps and selector expansion rely on keyed resource lookup'],
            ['Storage layer', 'Delta Lake, Apache Hudi, or Apache Iceberg -- merge and partition replacement depend on table-format mechanics below dbt'],
            ['Lineage standard', 'OpenLineage -- production lineage events that generalize the manifest idea beyond one dbt run'],
            ['History modeling', 'Slowly Changing Dimension -- whether incremental correctness means overwrite or preserve'],
            ['Downstream ML', 'Feature Store -- ML features inherit both lineage requirements and incremental freshness risks'],
            ['Orchestration', 'DAG Scheduling (Airflow) -- how the dbt DAG fits inside a broader orchestration graph'],
          ],
        },
      ],
    },
  ],
};
