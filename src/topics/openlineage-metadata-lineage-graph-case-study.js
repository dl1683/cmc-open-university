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
      heading: 'What it is',
      paragraphs: [
        'OpenLineage is an open standard for collecting metadata about data jobs and their corresponding events. Its object model centers on Jobs, Runs, and Datasets. A lineage event records what ran, which datasets it read, which datasets it wrote, and which structured facets describe the execution.',
        'This case study links Schema Registry Case Study, Debezium CDC Case Study, Distributed Tracing, Google Dataflow Model Case Study, Flink Checkpointing Case Study, and Topological Sort. It treats lineage as a production graph with typed metadata, not as a static diagram drawn after the fact.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A data platform integration emits events when jobs start, complete, or fail. The event contains a job identity, a run identity, input datasets, output datasets, and facets. A backend stores those events and indexes the resulting graph so users can inspect upstream sources, downstream consumers, run history, schema changes, quality checks, and owners.',
        'Facets are the extension mechanism. A run facet might describe nominal time, parent run, processing engine, or source code. A dataset facet might describe schema, version, lifecycle state, or column-level lineage. Because facets are structured, the lineage backend can filter and reason about them instead of treating all context as comments.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The challenge is coverage and trust. If Spark jobs emit lineage but manual SQL scripts do not, the graph has gaps. If schema facets are stale, impact analysis is wrong. If every temporary table becomes a first-class node, the graph becomes noisy. A production lineage system needs emitter coverage metrics, freshness checks, dataset-type conventions, owner metadata, and failure handling for event delivery.',
        'Lineage can also create governance and privacy concerns. The graph may reveal sensitive dataset names, owners, query text, or column dependencies. Access control and redaction rules are part of the data structure, not an afterthought.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team wants to rename raw.orders.customer_id to buyer_id. Before changing the CDC stream and warehouse table, they ask the lineage backend for downstream paths from that column. The graph finds a dbt model, a fraud feature table, an alerting job, and a revenue dashboard. Column lineage shows that the dashboard uses total_cents but not customer_id, while fraud features depend directly on customer_id.',
        'The migration plan now has owners, tests, and rollout order. Schema Registry protects Kafka event shape, Debezium emits CDC changes, OpenLineage records which jobs transform those changes, and the graph tells the team who is actually affected.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is that lineage is just a graph visualization. The visual graph is the final interface; the hard work is event emission, identity normalization, facet quality, column extraction, and keeping the graph current. Another mistake is using only dataset-level edges for schema migration. Dataset-level lineage is useful for discovery, but column-level lineage is often needed for precise impact analysis.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenLineage object model at https://openlineage.io/docs/spec/object-model/, facets and extensibility at https://openlineage.io/docs/spec/facets/, dataset facets at https://openlineage.io/docs/spec/facets/dataset-facets/, column lineage facet at https://openlineage.io/docs/spec/facets/dataset-facets/column_lineage_facet/, and example lineage events at https://openlineage.io/docs/spec/examples/. Study Schema Registry Case Study, Debezium CDC Case Study, Distributed Tracing, Topological Sort, Google Dataflow Model Case Study, and Flink Checkpointing Case Study next.',
      ],
    },
  ],
};
