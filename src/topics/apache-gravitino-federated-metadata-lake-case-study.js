// Apache Gravitino federated metadata lake: unified metadata models, catalogs,
// policies, tags, engines, lineage, and lakehouse federation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-gravitino-federated-metadata-lake-case-study',
  title: 'Apache Gravitino Federated Metadata Lake Case Study',
  category: 'Systems',
  summary: 'Apache Gravitino as a federated metadata lake: unify catalogs, schemas, tables, files, engines, tags, policies, lineage, and lakehouse governance.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['metadata lake', 'governance plane'], defaultValue: 'metadata lake' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function metadataGraph(title) {
  return graphState({
    nodes: [
      { id: 'metalake', label: 'lake', x: 0.7, y: 3.5, note: 'meta' },
      { id: 'catalog', label: 'cat', x: 2.4, y: 2.0, note: 'federate' },
      { id: 'schema', label: 'schema', x: 4.2, y: 2.0, note: 'db' },
      { id: 'table', label: 'table', x: 6.0, y: 2.0, note: 'asset' },
      { id: 'file', label: 'file', x: 6.0, y: 5.0, note: 'object' },
      { id: 'engine', label: 'engine', x: 8.0, y: 2.0, note: 'Trino' },
      { id: 'region', label: 'region', x: 2.4, y: 5.0, note: 'geo' },
      { id: 'ai', label: 'AI', x: 8.0, y: 5.0, note: 'asset' },
    ],
    edges: [
      { id: 'e-metalake-catalog', from: 'metalake', to: 'catalog', weight: '' },
      { id: 'e-catalog-schema', from: 'catalog', to: 'schema', weight: '' },
      { id: 'e-schema-table', from: 'schema', to: 'table', weight: '' },
      { id: 'e-table-engine', from: 'table', to: 'engine', weight: 'use' },
      { id: 'e-table-file', from: 'table', to: 'file', weight: 'loc' },
      { id: 'e-metalake-region', from: 'metalake', to: 'region', weight: 'sync' },
      { id: 'e-region-file', from: 'region', to: 'file', weight: 'where' },
      { id: 'e-table-ai', from: 'table', to: 'ai', weight: 'feat' },
    ],
  }, { title });
}

function governanceGraph(title) {
  return graphState({
    nodes: [
      { id: 'asset', label: 'asset', x: 0.8, y: 3.5, note: 'table/file' },
      { id: 'tag', label: 'tag', x: 2.6, y: 1.6, note: 'PII' },
      { id: 'policy', label: 'policy', x: 2.6, y: 5.4, note: 'rule' },
      { id: 'acl', label: 'ACL', x: 4.7, y: 3.5, note: 'access' },
      { id: 'audit', label: 'audit', x: 6.5, y: 1.8, note: 'events' },
      { id: 'lineage', label: 'lineage', x: 6.5, y: 5.2, note: 'edges' },
      { id: 'engine', label: 'engine', x: 8.5, y: 3.5, note: 'query' },
    ],
    edges: [
      { id: 'e-asset-tag', from: 'asset', to: 'tag', weight: 'mark' },
      { id: 'e-tag-policy', from: 'tag', to: 'policy', weight: 'scope' },
      { id: 'e-policy-acl', from: 'policy', to: 'acl', weight: 'decide' },
      { id: 'e-acl-engine', from: 'acl', to: 'engine', weight: 'allow' },
      { id: 'e-engine-audit', from: 'engine', to: 'audit', weight: 'log' },
      { id: 'e-asset-lineage', from: 'asset', to: 'lineage', weight: 'flow' },
      { id: 'e-lineage-audit', from: 'lineage', to: 'audit', weight: 'proof' },
    ],
  }, { title });
}

function* metadataLake() {
  yield {
    state: metadataGraph('Gravitino creates a federated metadata lake'),
    highlight: { active: ['metalake', 'catalog', 'schema', 'table', 'e-metalake-catalog', 'e-catalog-schema'], found: ['engine'] },
    explanation: 'Apache Gravitino is a federated metadata lake. It manages metadata across sources, formats, regions, and engines through unified models and APIs.',
    invariant: 'A metadata lake should represent assets consistently without pretending every backend has the same physical implementation.',
  };

  yield {
    state: labelMatrix(
      'Meta',
      [
        { id: 'rel', label: 'rel' },
        { id: 'file', label: 'file' },
        { id: 'lake', label: 'lake' },
        { id: 'ai', label: 'AI' },
      ],
      [
        { id: 'asset', label: 'asset' },
        { id: 'need', label: 'need' },
      ],
      [
        ['table', 'schema'],
        ['path', 'loc'],
        ['snap', 'cat'],
        ['model', 'line'],
      ],
    ),
    highlight: { active: ['rel:asset', 'file:asset', 'lake:need'], found: ['ai:asset'] },
    explanation: 'The unifying move is metadata normalization. A relational table, a file asset, a lakehouse table, and an AI artifact need different connectors but a shared governance vocabulary.',
  };

  yield {
    state: metadataGraph('Engines use metadata without owning every backend'),
    highlight: { active: ['table', 'engine', 'file', 'e-table-engine', 'e-table-file'], compare: ['region'], found: ['ai'] },
    explanation: 'A query engine can discover tables and files through Gravitino instead of hard-coding every storage catalog. The metadata layer becomes a federation point for Spark, Trino, Flink, and future tools.',
  };

  yield {
    state: labelMatrix(
      'Fed',
      [
        { id: 'hive', label: 'hive' },
        { id: 'jdbc', label: 'jdbc' },
        { id: 's3', label: 's3' },
        { id: 'ice', label: 'ice' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cat', 'sync'],
        ['db', 'dial'],
        ['file', 'ACL'],
        ['REST', 'commit'],
      ],
    ),
    highlight: { active: ['hive:mode', 'jdbc:mode', 'ice:mode'], compare: ['ice:risk'], found: ['s3:risk'] },
    explanation: 'Federation means Gravitino must respect backend-specific naming, authorization, region, and commit behavior while exposing one operational view to users.',
  };
}

function* governancePlane() {
  yield {
    state: governanceGraph('Governance attaches policy and lineage to assets'),
    highlight: { active: ['asset', 'tag', 'policy', 'acl', 'e-asset-tag', 'e-policy-acl'], found: ['audit'] },
    explanation: 'Gravitino aims to provide end-to-end governance across metadata: tags, policies, access control, audits, discovery, and lineage over many data sources.',
  };

  yield {
    state: labelMatrix(
      'Gov',
      [
        { id: 'tag', label: 'tag' },
        { id: 'pol', label: 'pol' },
        { id: 'audit', label: 'audit' },
        { id: 'line', label: 'line' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['mark', 'miss'],
        ['rule', 'drift'],
        ['log', 'gap'],
        ['edge', 'stale'],
      ],
    ),
    highlight: { active: ['tag:does', 'pol:does', 'audit:does'], compare: ['line:risk'] },
    explanation: 'Governance is only useful when metadata is live enough to enforce. A stale tag or missing lineage edge creates a false sense of control.',
    invariant: 'Catalog governance must be enforced at engine and storage boundaries, not only displayed in a UI.',
  };

  yield {
    state: governanceGraph('Policy decisions need asset context'),
    highlight: { active: ['asset', 'tag', 'policy', 'acl', 'engine'], compare: ['lineage'], found: ['audit'] },
    explanation: 'A policy decision depends on who is asking, which engine they use, which asset is touched, what tags apply, and what audit trail must be written.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'find', label: 'find' },
        { id: 'allow', label: 'allow' },
        { id: 'run', label: 'run' },
        { id: 'prove', label: 'prove' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['asset', 'fresh'],
        ['policy', 'role'],
        ['engine', 'scope'],
        ['audit', 'line'],
      ],
    ),
    highlight: { active: ['find:step', 'allow:step', 'prove:guard'], found: ['run:guard'] },
    explanation: 'A production data request should resolve the asset, check policy, run through an engine with bounded credentials, then write audit and lineage evidence.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'metadata lake') yield* metadataLake();
  else if (view === 'governance plane') yield* governancePlane();
  else throw new InputError('Pick a Gravitino view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Apache Gravitino is a federated metadata lake for data and AI assets. It manages metadata directly across sources, types, regions, and engines while providing unified access, governance, discovery, and policy surfaces.',
        'This topic links Iceberg REST Catalog Protocol Case Study, OpenLineage Metadata Lineage Graph Case Study, Zanzibar Authorization Case Study, OPA Rego Policy Decision Graph, lakeFS Data Lake Version Graph Case Study, and Feature Store. It is the metadata/governance layer those systems need when a platform becomes heterogeneous.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Gravitino models metadata through metalakes, catalogs, schemas, tables, files, and other asset types. Connectors bridge those models to real systems such as lakehouse catalogs, relational databases, file stores, and engines.',
        'The governance plane attaches tags, policies, access controls, lineage, and audit facts to assets. A query engine can use those metadata APIs to discover assets and enforce decisions without every team inventing a separate catalog.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are metalake identifiers, catalog objects, schemas, tables, columns, file assets, regions, connectors, tags, policies, lineage edges, audit records, and engine bindings.',
        'The subtle structure is federation. Gravitino must map one user-facing metadata model to many backend semantics while preserving enough detail for commit safety, access control, and discovery.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Modern data platforms rarely use one engine or one storage format. Spark, Trino, Flink, object stores, relational systems, Iceberg, Lance, features, models, and event streams all need a shared operational metadata layer.',
        'A federated metadata lake reduces catalog sprawl. Users get one place to discover assets, engines get one path to metadata, and governance teams get one control plane for policy, tags, audits, and lineage.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Metadata lakes fail when the abstraction is too lossy, tags go stale, policies are not enforced at execution time, regions drift, connectors disagree with source truth, or governance metadata becomes a passive inventory instead of an operational boundary.',
        'A reliable deployment needs connector health checks, reconciliation, freshness SLOs, audit coverage, policy testing, engine integration, and explicit ownership of each asset and metadata source.',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: Apache Gravitino home page at https://gravitino.apache.org/ and Gravitino 1.2.1 documentation at https://gravitino.apache.org/docs/1.2.1/.',
        'Study this with Iceberg REST Catalog for catalog protocol design, OpenLineage for lineage event structure, Zanzibar and OPA for policy and authorization, and dbt for transformation DAG metadata.',
      ],
    },
  ],
};
