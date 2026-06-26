// OpenLineage: jobs, runs, datasets, and facets emitted as events that build
// a queryable lineage graph for impact analysis and debugging.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'openlineage-metadata-lineage-graph-case-study',
  title: 'OpenLineage Metadata Lineage Graph Case Study',
  category: 'Systems',
  summary: 'Data lineage as a production graph: emit run events with jobs, datasets, facets, column dependencies, and quality metadata for impact analysis.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['event object model', 'impact graph'], defaultValue: 'event object model' },
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

function lineageGraph(title) {
  return graphState({
    nodes: [
      { id: 'inputA', label: 'orders table', x: 0.7, y: 2.0, note: 'input dataset' },
      { id: 'inputB', label: 'customers table', x: 0.7, y: 5.0, note: 'input dataset' },
      { id: 'job', label: 'dbt model job', x: 3.0, y: 3.5, note: 'job' },
      { id: 'run', label: 'run id', x: 4.8, y: 2.1, note: 'one execution' },
      { id: 'facets', label: 'facets', x: 4.8, y: 5.0, note: 'schema, SQL, quality' },
      { id: 'output', label: 'daily revenue', x: 7.0, y: 3.5, note: 'output dataset' },
      { id: 'backend', label: 'lineage backend', x: 8.8, y: 3.5, note: 'graph index' },
    ],
    edges: [
      { id: 'e-inputA-job', from: 'inputA', to: 'job', weight: 'input' },
      { id: 'e-inputB-job', from: 'inputB', to: 'job', weight: 'input' },
      { id: 'e-job-run', from: 'job', to: 'run', weight: 'started' },
      { id: 'e-run-facets', from: 'run', to: 'facets', weight: 'attach' },
      { id: 'e-run-output', from: 'run', to: 'output', weight: 'produces' },
      { id: 'e-output-backend', from: 'output', to: 'backend', weight: 'store' },
      { id: 'e-facets-backend', from: 'facets', to: 'backend', weight: 'index' },
    ],
  }, { title });
}

function impactGraph(title) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw.orders', x: 0.7, y: 3.5, note: 'source' },
      { id: 'clean', label: 'clean.orders', x: 2.6, y: 2.0, note: 'model' },
      { id: 'features', label: 'fraud features', x: 4.8, y: 2.0, note: 'ML table' },
      { id: 'dashboard', label: 'revenue dashboard', x: 4.8, y: 5.0, note: 'BI' },
      { id: 'alert', label: 'alert job', x: 7.0, y: 2.0, note: 'consumer' },
      { id: 'owner', label: 'owners + SLAs', x: 7.0, y: 5.0, note: 'facets' },
      { id: 'ticket', label: 'migration ticket', x: 8.9, y: 3.5, note: 'plan' },
    ],
    edges: [
      { id: 'e-raw-clean', from: 'raw', to: 'clean', weight: 'feeds' },
      { id: 'e-clean-features', from: 'clean', to: 'features', weight: 'feature build' },
      { id: 'e-clean-dashboard', from: 'clean', to: 'dashboard', weight: 'metric build' },
      { id: 'e-features-alert', from: 'features', to: 'alert', weight: 'serves' },
      { id: 'e-dashboard-owner', from: 'dashboard', to: 'owner', weight: 'owned by' },
      { id: 'e-alert-owner', from: 'alert', to: 'owner', weight: 'owned by' },
      { id: 'e-owner-ticket', from: 'owner', to: 'ticket', weight: 'notify' },
      { id: 'e-clean-ticket', from: 'clean', to: 'ticket', weight: 'impact' },
    ],
  }, { title });
}

function* eventObjectModel() {
  yield {
    state: lineageGraph('OpenLineage emits events about jobs, runs, and datasets'),
    highlight: { active: ['job', 'run', 'inputA', 'inputB', 'output'], found: ['backend'] },
    explanation: 'OpenLineage models lineage with Jobs, Runs, and Datasets. A run event says this job execution read these input datasets and wrote those output datasets.',
    invariant: 'Lineage is most useful when it records the execution that created a dataset, not only that two tables are related.',
  };

  yield {
    state: labelMatrix(
      'Core event fields',
      [
        { id: 'eventType', label: 'T' },
        { id: 'job', label: 'J' },
        { id: 'run', label: 'R' },
        { id: 'dataset', label: 'D' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'use' },
      ],
      [
        ['start', 'life'],
        ['name', 'ident'],
        ['id', 'exec'],
        ['in/out', 'edge'],
      ],
    ),
    highlight: { active: ['job:stores', 'run:stores', 'dataset:why'], found: ['eventType:why'] },
    explanation: 'The event object model separates the stable job definition from one execution run. That distinction lets the graph answer both design questions and incident questions.',
  };

  yield {
    state: lineageGraph('Facets attach structured facts without changing the core model'),
    highlight: { active: ['facets', 'run', 'backend', 'e-run-facets', 'e-facets-backend'], compare: ['inputA', 'output'] },
    explanation: 'Facets are extensible metadata payloads attached to runs, jobs, and datasets. They can describe schema, SQL, source code, column lineage, data quality, processing engine, nominal time, or custom system facts.',
  };

  yield {
    state: labelMatrix(
      'Facet examples',
      [
        { id: 'schema', label: 'S' },
        { id: 'sql', label: 'SQL' },
        { id: 'column', label: 'C' },
        { id: 'quality', label: 'Q' },
      ],
      [
        { id: 'answers', label: 'asks' },
        { id: 'ownerUse', label: 'use' },
      ],
      [
        ['cols?', 'contract'],
        ['query?', 'debug'],
        ['src?', 'migrate'],
        ['passed?', 'gate'],
      ],
    ),
    highlight: { found: ['column:answers', 'quality:ownerUse'], active: ['sql:answers'] },
    explanation: 'A lineage graph becomes valuable when edges carry enough structured context. Dataset-to-dataset edges alone cannot explain which column, query, run, or data-quality check caused a downstream change.',
  };
}

function* impactGraphView() {
  yield {
    state: impactGraph('A lineage graph supports downstream impact analysis'),
    highlight: { active: ['raw', 'clean', 'features', 'dashboard', 'alert'], found: ['owner'] },
    explanation: 'If raw.orders changes, the graph can traverse downstream datasets, jobs, dashboards, features, and alerting jobs. This turns a schema migration into a dependency query rather than a Slack archaeology project.',
  };

  yield {
    state: labelMatrix(
      'Impact query plan',
      [
        { id: 'start', label: 'S' },
        { id: 'traverse', label: 'W' },
        { id: 'filter', label: 'F' },
        { id: 'notify', label: 'N' },
      ],
      [
        { id: 'operation', label: 'op' },
        { id: 'dataStructure', label: 'struct' },
      ],
      [
        ['cust_id', 'column'],
        ['edges', 'digraph'],
        ['prod only', 'facet'],
        ['owners', 'index'],
      ],
    ),
    highlight: { active: ['traverse:dataStructure', 'filter:operation'], found: ['notify:dataStructure'] },
    explanation: 'Impact analysis is graph traversal plus metadata filtering. The hard part is not BFS; it is maintaining trustworthy edges and enough facets to avoid false positives and false negatives.',
  };

  yield {
    state: impactGraph('Column lineage makes broad graph edges precise'),
    highlight: { active: ['clean', 'features', 'dashboard', 'e-clean-features', 'e-clean-dashboard'], compare: ['ticket'] },
    explanation: 'Dataset-level lineage may say clean.orders feeds both fraud features and the dashboard. Column-level lineage can say customer_id affects features, while total_cents affects revenue. That precision changes who must review a migration.',
    invariant: 'Coarse lineage finds possible impact; column lineage narrows likely impact.',
  };

  yield {
    state: labelMatrix(
      'Production lineage failure modes',
      [
        { id: 'missing', label: 'M' },
        { id: 'stale', label: 'S' },
        { id: 'temp', label: 'T' },
        { id: 'manual', label: 'X' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'mitigation', label: 'fix' },
      ],
      [
        ['gaps', 'cover'],
        ['wrong', 'refresh'],
        ['noise', 'type'],
        ['hidden', 'emit'],
      ],
    ),
    highlight: { active: ['missing:mitigation', 'stale:symptom'], found: ['temp:mitigation'], compare: ['manual:symptom'] },
    explanation: 'Lineage is only as strong as event coverage and metadata freshness. Mature systems measure emitter coverage, stale facets, unknown owners, temporary datasets, and failed event delivery.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'event object model') yield* eventObjectModel();
  else if (view === 'impact graph') yield* impactGraphView();
  else throw new InputError('Pick an OpenLineage view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation reads data movement as a directed graph. A directed graph has nodes and arrows. In lineage, dataset nodes are tables, files, streams, dashboards, or features, and job nodes are transformations that read inputs and write outputs.',
        'Active nodes show the run or dataset currently being explained. Found nodes are downstream assets proven reachable from a changed source. Compare nodes show facets being used to narrow impact. Removed nodes are broad dependencies filtered out because the changed column does not feed them.',
        'The key inference is reachability with evidence. If a completed run read dataset A and wrote dataset B, then A is upstream of B for that run. Facets such as schema, SQL, column lineage, ownership, and quality results explain how strong that dependency is.',
        {type:'callout', text:'OpenLineage turns data movement into evidence by recording each run as graph edges plus facets, not as a hand-maintained diagram.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/fe/Tred-G.svg', alt:'Directed graph with five labeled nodes and arrows between them.', caption:'Example directed acyclic graph; original by Lyonsam, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Data teams need to know what breaks before they rename a column, change a schema, backfill a table, alter a quality rule, or migrate a pipeline. Without lineage, that answer lives in memory, stale diagrams, warehouse naming guesses, and emergency chat after the incident.',
        'OpenLineage exists to make data movement observable as events. A job emits events for a run, its input datasets, its output datasets, and extra metadata called facets. A backend indexes those events into a graph that can answer upstream and downstream questions.',
        'The freshness constraint is severe. A hand-drawn diagram may be right on Monday and wrong on Friday. Production data platforms change through schedulers, dbt models, notebooks, CDC streams, dashboards, warehouse jobs, and one-off backfills.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a wiki diagram or a manually maintained DAG. That helps a small stable team because people can see the main tables and jobs in one place. It fails as soon as the diagram is not updated with every real execution path.',
        'The next approach is to rely on one system of record. Airflow knows tasks, a warehouse knows queries, dbt knows model dependencies, and a BI tool knows dashboards. Each view is useful, but none automatically describes the whole platform.',
        'A third approach is raw query history. Query logs are fresh, but they lack ownership, intent, stable identity, and often column-level meaning. A raw SQL log is evidence, but it is not yet an impact graph.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coverage and identity. Coverage means every important reader, writer, transform, validator, and publisher emits usable events. Identity means the same dataset, job, run, and column resolve to the same logical node across tools.',
        'Missing emitters create invisible edges. Bad identity creates duplicate nodes or merges unrelated assets. Both errors make impact analysis untrustworthy because the graph either misses real dependencies or warns about fake ones.',
        'Precision is the third wall. Dataset-level lineage can say clean.orders feeds a dashboard and a fraud feature table. A column rename needs more: which downstream columns, owners, checks, and models depend on customer_id specifically.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent lineage as structured events about jobs, runs, datasets, and facets. A job is the stable transformation identity. A run is one execution attempt of that job. Datasets are named inputs and outputs.',
        'Facets attach structured facts without changing the core model. A schema facet can list fields. A SQL facet can store the query. A column-lineage facet can say which input columns contributed to which output columns. A quality facet can record checks.',
        'That split gives the graph evidence and time. The backend can ask what depends on this table, which run produced this bad output, which schema was active then, and which owners must review a planned change.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An integration emits an event when a job starts, completes, aborts, or fails. The event includes producer identity, event time, run id, job id, input datasets, output datasets, and available facets. The backend stores the event and updates indexes for traversal and search.',
        'The graph usually alternates between datasets and jobs. A dataset feeds a job when it appears in the input list. A job produces a dataset when it appears in the output list. A run connects that logical relationship to one execution with status and timestamps.',
        'Column lineage narrows broad reachability. If raw.orders.customer_id feeds fraud features and alerting but not revenue totals, the graph can target the feature and alert owners instead of warning every downstream team.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is operational evidence. If emitters cover real execution paths, dataset identity is normalized, events are delivered reliably, and facets are fresh enough, then graph traversal gives a defensible impact set.',
        'Stable identity is the invariant. The same table, stream, or column must map to the same logical node across schedulers, warehouses, catalogs, dashboards, and environments. If identity fragments, impact is underestimated. If identity overmerges, impact is overstated.',
        'Facets turn reachability into explanation. An edge says data flowed. A facet says what schema, SQL, quality check, owner, source code, or column mapping made that edge meaningful for the decision.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The graph query is usually not the hard part. The cost is integrations, event delivery, retries, validation, deduplication, namespace rules, owner metadata, access control, column extraction, and freshness monitoring.',
        'Noise can cost more than volume. If every scratch table, temporary notebook output, and failed exploratory query becomes a first-class dependency, impact reports become useless. The platform needs rules for which ephemeral lineage is kept and how long.',
        'Column lineage is expensive because SQL parsing, query planning, UDFs, dynamic SQL, notebooks, and warehouse-specific behavior complicate mapping. Dataset-level lineage is cheaper and broader. Column-level lineage is harder and better for schema migration.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'OpenLineage fits schema migration, incident blast-radius analysis, data-quality debugging, ownership discovery, compliance evidence, platform migration, and pipeline observability. It is strongest when many engines must contribute to one lineage view.',
        'In an incident, a bad upstream load can be traced to downstream features, dashboards, alerts, and owners. Run facets can identify the first failing run and the last known good output. Quality facets can show whether checks failed before users saw bad data.',
        'For governance, lineage is evidence rather than policy. A reviewer can ask which datasets fed a report, which jobs transformed them, which run produced the current table, which quality checks passed, and who owns the downstream asset.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when treated as a visualization project. The picture is the interface. The real system is event emission, identity normalization, facet quality, delivery reliability, and freshness measurement.',
        'It fails when important work happens outside instrumented paths. Manual warehouse queries, vendor exports, spreadsheet uploads, emergency backfills, and legacy scripts can create real dependencies that never appear in the graph.',
        'It fails when broad reachability is sold as exact impact. A field rename, deletion, semantic change, or privacy classification change may affect only part of a downstream dataset. Without column evidence, the graph should expose uncertainty.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team plans to rename raw.orders.customer_id. Dataset-level lineage finds 18 downstream datasets, 5 dashboards, 2 feature tables, and 3 alert jobs. If every owner is blocked, 28 review tasks are created.',
        'Column-level lineage narrows the set. customer_id feeds fraud features, identity joins, and alerting, but not a revenue dashboard based only on total_cents and created_at. Ownership facets identify 6 required reviewers instead of 28.',
        'The migration ticket now requires tests for the 2 feature tables and 3 alert jobs, plus one identity model. It does not block unrelated dashboard owners. The graph moved from possible impact to likely impact because facets carried column and owner evidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the OpenLineage object model, event specification, facet documentation, column lineage facet, symlinks facet, and example events. Use them to separate jobs, runs, datasets, and extensible metadata correctly.',
        'Study Schema Registry for event-shape governance, Debezium CDC for source change events, Topological Sort for dependency ordering, Distributed Tracing for execution context, Data Catalog Indexes for discovery, and Data Quality Assertion Facets for test evidence.',
      ],
    },
  ],
};
