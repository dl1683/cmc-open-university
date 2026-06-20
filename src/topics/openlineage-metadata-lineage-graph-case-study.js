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
      heading: 'Why This Exists',
      paragraphs: [
        'Data teams need to answer impact questions before they change a table, schema, job, column, dashboard, feature set, or quality rule. Without lineage, the answer lives in tribal knowledge, stale diagrams, warehouse naming conventions, and emergency chat threads after something breaks.',
        'OpenLineage exists to make data movement observable as a typed event stream. Jobs emit events with runs, input datasets, output datasets, and facets. A lineage backend turns those events into a graph that can answer upstream source questions, downstream blast-radius questions, run-history questions, ownership questions, and data-quality questions.',
        'The practical constraint is freshness. A lineage diagram drawn by hand is useful the day it is drawn and suspect the day after. Data platforms change through scheduler edits, dbt models, notebooks, CDC streams, warehouse jobs, dashboards, manual backfills, and one-off scripts. A production lineage graph has to be built from systems that actually move data.',
        {type:'callout', text:'OpenLineage turns data movement into evidence by recording each run as graph edges plus facets, not as a hand-maintained diagram.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/fe/Tred-G.svg', alt:'Directed graph with five labeled nodes and arrows between them.', caption:'Example directed acyclic graph; original by Lyonsam, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is a hand-maintained DAG diagram or wiki page. It helps onboarding because people can see the main jobs and tables in one place. For a small team with a stable pipeline, that may be enough.',
        'The next approach is scheduler metadata. Airflow, Dagster, dbt, Spark, warehouse query history, and BI tools each know part of the story. A scheduler knows task order. A warehouse knows queries. A dashboard knows consumers. A catalog knows owners. Each view is useful, but none is automatically the whole graph.',
        'The wall appears when a specific change needs a specific answer. If raw.orders.customer_id changes, which production models, dashboard tiles, fraud features, alert jobs, owners, and quality gates are affected? A high-level DAG edge from raw.orders to clean.orders is too broad. A query log without owner metadata is too raw. A wiki page without freshness is too easy to trust after it has drifted.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coverage and identity. Coverage means every important system that reads, writes, transforms, validates, or publishes data emits usable events. Identity means the same dataset, job, run, and column resolve to the same node across tools. Missing emitters create invisible edges. Bad identity creates duplicate nodes and broken paths.',
        'Freshness is the next wall. A graph can be complete for last month and wrong today. Owners move, schemas change, tables are renamed, temporary datasets appear, backfills rewrite outputs, and dashboards are rebuilt. Impact analysis needs time-aware evidence, not only a historical dependency list.',
        'Precision is the third wall. Dataset-level lineage can over-warn. If clean.orders feeds a dashboard and an ML feature table, not every column change affects both. Column-level lineage, SQL facets, schema facets, and quality facets let the graph move from possible impact to likely impact.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to represent lineage as structured events about jobs, runs, datasets, and facets. The job is the stable transformation identity. The run is one attempt or execution of that job. Datasets are named inputs and outputs. Facets attach structured metadata without changing the core object model.',
        'That split turns lineage into a graph with evidence. A completed run can say this job read these input datasets and produced those output datasets at this time, with this schema, SQL, source code, engine, quality result, or column mapping attached. The backend can index those events into nodes, edges, and searchable metadata.',
        'Facets are the extensibility mechanism. Instead of forcing every system fact into a fixed table, OpenLineage lets run, job, and dataset records carry structured facet payloads. That is why lineage can start with read/write edges and then grow into column dependencies, data-quality checks, ownership, processing engine details, nominal time, source code, and custom platform facts.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'A platform integration emits events when jobs start, complete, abort, or fail. Each event includes a producer identity, event type, event time, run identity, job identity, input datasets, output datasets, and any facets the integration can supply. The backend stores the event and updates indexes for graph traversal, run history, schema history, and search.',
        'The graph usually has two main node families: jobs and datasets. A run connects a job to a particular attempt. Input and output lists create edges between datasets and jobs. Facets then enrich those edges and nodes. A SQL facet may preserve the query. A schema facet may preserve fields. A column-lineage facet may say which input columns contributed to which output columns. Quality facets may record assertions or test results.',
        'Column lineage is where broad graph reachability becomes useful migration evidence. A dataset-level edge can say clean.orders feeds both fraud features and revenue dashboards. A column mapping can say customer_id affects fraud features and alerting, while total_cents affects revenue. That precision changes who must review a change.',
        'Identity normalization is continuous work. The same table may appear as a warehouse table name, a file path, a catalog URN, a dbt model, or a dashboard source. Symlink or alias metadata can help, but the platform still needs conventions for namespaces, names, case sensitivity, environments, and temporary objects.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Lineage works when graph edges come from systems that actually executed work. A completed run with input and output datasets is stronger evidence than a manually drawn dependency because it records what happened, not what someone believed the architecture to be.',
        'The main invariant is stable identity over time. The same dataset, job, or column must resolve to the same logical node across schedulers, warehouses, CDC tools, dbt, dashboards, and catalogs. If identity fragments, the graph underestimates impact. If identity merges unrelated objects, the graph overestimates impact and erodes trust.',
        'Facets make the graph useful beyond reachability. A raw edge can say A feeds B. Schema, column, SQL, quality, ownership, lifecycle, and source-code facets explain how A feeds B, which part of B depends on A, whether the last run passed checks, and who owns the downstream decision.',
        'The correctness argument is operational. If emitters cover the real execution paths, identities are normalized, event delivery is reliable, and facets are fresh enough for the decision, then graph traversal gives a defensible impact set. If any of those conditions fail, the graph should expose uncertainty rather than pretending to be complete.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The event-object-model view shows why job and run are separate. A job is the named transformation. A run is one attempt with timestamps, inputs, outputs, status, and facets. Keeping both lets the graph answer design questions such as "what depends on this table?" and incident questions such as "which run produced the bad dataset?"',
        'The facets node shows why metadata belongs beside the edge. Dataset-to-dataset relationships are the skeleton. Facets add the muscles and nerves: schema, SQL, processing engine, source code, quality checks, ownership, and column dependencies. Without facets, the graph can tell that something downstream may be affected but not why.',
        'The impact graph shows blast-radius analysis as traversal plus filtering. Starting at raw.orders, the graph walks downstream to cleaned tables, features, dashboards, alerts, owners, and tickets. Facets narrow the traversal so an owner receives a targeted migration notice instead of every downstream team getting the same vague warning.',
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        'A production lineage system costs more than graph storage. It needs emitter integrations, event delivery, retries, schema validation, deduplication, namespace conventions, dataset-type rules, owner metadata, freshness checks, column extraction, access control, and UI workflows. The graph query is often the easy part.',
        'Volume is not the only cost. Noise can be worse than size. If every temporary table, scratch notebook, transient staging object, and failed exploratory query becomes a first-class business dependency, users stop trusting impact reports. The platform needs rules that preserve important ephemeral lineage without burying stable assets in noise.',
        'Column lineage has extraction cost. SQL parsing, query planning, transformations, UDFs, notebooks, dynamic SQL, and warehouse-specific behavior can all complicate column mapping. Dataset-level lineage is easier and broader. Column-level lineage is harder and more useful for schema changes.',
        'Lineage can expose sensitive information. Dataset names, query text, owners, columns, business logic, and data-quality failures may reveal more than a user is allowed to know. Access control and redaction rules belong in the graph design, not as a UI patch after ingestion.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'A team plans to rename raw.orders.customer_id. Dataset-level lineage says raw.orders feeds clean.orders, fraud features, a revenue dashboard, and an alert job. That is a useful first pass, but it is too broad for review. Blocking every downstream owner wastes time and encourages people to ignore future notices.',
        'Column-level lineage shows customer_id affects fraud features and alerting, but not total_cents on the revenue dashboard. A schema facet shows the field type. A SQL facet shows the transform. Ownership facets identify the feature owner and alert owner. A quality facet shows which checks must pass after the migration.',
        'The migration ticket can now notify the feature and alert owners, require tests on those paths, and avoid blocking unrelated dashboard owners. That is the difference between graph reachability and useful impact analysis.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'OpenLineage fits schema migrations, incident blast-radius analysis, data-quality debugging, ownership discovery, compliance evidence, pipeline observability, and platform migration. It is strongest when many engines and tools need to contribute to one lineage view.',
        'It also helps incident response. If a bad upstream load writes null customer ids, the graph can find downstream datasets, feature builds, dashboards, alerts, and owners. Run facets and quality facets can identify the first failing run and the last known good output.',
        'It is useful for governance when evidence must be sampled. A reviewer can ask which datasets fed a report, which jobs transformed them, which run produced the current table, which quality checks passed, and who owns the downstream asset. The graph is not the policy; it is the evidence substrate that policy can query.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'Lineage fails when it is treated as a visualization project. The visual graph is the final interface. The hard work is event emission, identity normalization, facet quality, column extraction, delivery reliability, and freshness monitoring.',
        'It fails when important work happens outside instrumented paths. Manual warehouse queries, notebooks, vendor exports, spreadsheet uploads, emergency backfills, and legacy scripts can create real dependencies that never emit events. The graph should measure coverage and expose unknowns.',
        'It fails when dataset-level reachability is oversold as exact impact. Broad lineage is valuable for discovery, but schema migration often needs column-level evidence. A field rename, deletion, semantic change, or privacy classification change may affect only part of a downstream dataset.',
        'It also fails when users cannot act on the output. A graph that returns 800 downstream nodes without owners, environments, criticality, freshness, or suggested review paths is technically correct and operationally weak.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: OpenLineage object model at https://openlineage.io/docs/spec/object-model/, facets and extensibility at https://openlineage.io/docs/spec/facets/, dataset facets at https://openlineage.io/docs/spec/facets/dataset-facets/, column lineage facet at https://openlineage.io/docs/spec/facets/dataset-facets/column_lineage_facet/, symlinks facet at https://openlineage.io/docs/spec/facets/dataset-facets/symlinks/, and example lineage events at https://openlineage.io/docs/spec/examples/.',
        'Study Schema Registry Case Study for event shape governance, Debezium CDC Case Study for source change events, Distributed Tracing for cross-service execution context, Topological Sort for dependency ordering, Data Catalog Indexes for discovery, Google Dataflow Model Case Study for event-time processing, Flink Checkpointing Case Study for stream recovery, and Data Quality Assertion Facets for test evidence.',
      ],
    },
  ],
};
