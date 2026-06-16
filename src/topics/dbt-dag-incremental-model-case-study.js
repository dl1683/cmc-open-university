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
      heading: 'What it is',
      paragraphs: [
        'dbt turns SQL model files into a directed acyclic graph of transformations. source and ref calls declare dependencies, tests express contracts, documentation describes nodes, and generated artifacts such as manifest.json make the graph available to tools.',
        'This topic links Topological Sort, OpenLineage Metadata Lineage Graph Case Study, Feature Store, Delta Lake Case Study, Apache Hudi Timeline Filegroups Case Study, and database indexing. dbt is a graph and incremental-update lesson wrapped in analytics engineering workflows.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When dbt parses a project, it resolves sources, refs, models, tests, exposures, docs, macros, and metadata into a manifest. parent_map and child_map encode first-order graph relationships. dbt can then build models in topological order and select subgraphs for targeted runs.',
        'An incremental model is a materialization that transforms only new or changed rows after the first build. The model usually includes an is_incremental block, a timestamp or partition filter, and often a unique_key so new rows update existing target rows instead of duplicating them.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main data structures are DAG nodes, dependency edges, selectors, manifests, parent maps, child maps, compiled SQL, relation names, test nodes, source freshness results, and target tables. Incremental materialization adds a target table, staged new rows, merge keys, partitions, and schema-change policy.',
        'The graph view and the table-update view reinforce each other. The DAG tells dbt what order to run and what downstream models are affected. The incremental strategy tells one model how much data to process once it is selected.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'dbt makes analytics code more like a build system. The important abstraction is not a SQL file; it is a node with parents, children, contracts, documentation, materialization, and a compiled relation in the warehouse.',
        'Incremental models matter because warehouse costs scale with scanned and transformed data. A correct incremental filter can turn an all-history rebuild into a small daily update, but only if late data, unique keys, and logic changes are handled honestly.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'DAG failures include hidden dependencies, circular references, stale manifests, overly broad selectors, and tests that do not guard the actual business contract. Incremental failures include missed late-arriving rows, non-unique keys, null keys, schema drift, logic changes applied only to new rows, and full-refresh blast radius.',
        'The right debugging questions are graph-shaped and state-shaped: which upstream nodes changed, which downstream nodes are selected, what does the manifest say, which rows enter the incremental filter, and what target rows will be updated or inserted?',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: dbt ref documentation at https://docs.getdbt.com/reference/dbt-jinja-functions/ref, dbt source documentation at https://docs.getdbt.com/reference/dbt-jinja-functions/source, dbt manifest artifact documentation at https://docs.getdbt.com/reference/artifacts/manifest-json, and dbt incremental model documentation at https://docs.getdbt.com/docs/build/incremental-models.',
        'Study this with Topological Sort for build ordering, OpenLineage for production lineage events, Delta Lake and Hudi for table-update storage mechanics, and Feature Store for downstream ML consumption of transformed tables.',
      ],
    },
  ],
};
