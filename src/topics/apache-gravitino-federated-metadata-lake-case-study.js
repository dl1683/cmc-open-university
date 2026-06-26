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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a federated metadata lake. Metadata means data about assets: names, schemas, locations, tags, owners, policies, lineage, and engine access. Active nodes are the current identity or governance step; found nodes are resolved engines, assets, or audit records.',
        'Read the metadata lake view as identity resolution across backends. Read the governance view as policy enforcement around those identities. The important question in each frame is which backend detail is preserved instead of hidden.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The word "federated" is load-bearing. A federated catalog does not copy data into itself or claim to own backend transactions. It coordinates metadata and policy while respecting each source system\'s commit and access semantics. When the backend is Iceberg, snapshots still define correctness. When the backend is PostgreSQL, the database still owns transaction isolation. Federation that hides those differences is not a simplification — it is a lie that causes data loss.'},
        'Gravitino exists because data platforms accumulate catalogs. Hive may hold warehouse metadata, Iceberg may own lakehouse snapshots, PostgreSQL may own finance tables, S3 may hold filesets, and a model registry may own ML artifacts. Each system has its own names, permissions, and commit rules.',
        'A federated metadata lake gives engines and governance tools one service boundary for discovering assets and applying policy. It does not copy all data into one place. It coordinates identities and metadata while leaving backend systems responsible for their physical truth.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a crawler. Scan Hive, Iceberg, S3, JDBC databases, and model registries; copy names and schemas into a central search index; ask teams to add owners and tags. This helps discovery at first.',
        'The crawler decays immediately. Schemas change between crawls, tables move, owners change teams, and direct engine credentials bypass the index. A stale search result does not enforce access or preserve backend semantics.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is semantic mismatch. An Iceberg table has snapshots and manifest-based commits. A PostgreSQL table has database transactions and grants. An S3 prefix has object keys and IAM rules but no table schema by itself. Flattening them into name, schema, owner, and location loses correctness information.',
        'The governance wall is enforcement. A PII tag in a UI is useful only if Spark, Trino, notebooks, and storage credentials respect it at access time. Otherwise the metadata lake becomes a dashboard over bypass paths.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is stable federated identity plus backend-specific connectors. Gravitino uses a hierarchy such as metalake, catalog, schema, and asset. The path gives engines a shared identifier even when the physical backend differs.',
        'Connectors translate shared API operations into backend operations. The Iceberg connector must preserve snapshot behavior. The JDBC connector must respect SQL dialects and transaction semantics. The fileset connector must represent object paths without pretending they are relational tables.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client asks Gravitino for an asset path. Gravitino resolves the metalake, catalog type, schema, and asset name, then dispatches to the connector for that backend. The response normalizes enough metadata for the engine while preserving backend-specific properties.',
        'Governance attaches tags, roles, policies, and lineage to the shared identity. At query time, an engine integration checks the user, operation, asset, and tags, then enforces allow, deny, mask, or audit behavior. Lineage edges record which assets fed later assets.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because identity is centralized while data authority is not. Engines can agree that production.analytics.events.clicks is one governed asset, but Iceberg still owns the table snapshots and S3 still owns object storage. Federation coordinates without pretending to be every backend.',
        'Correctness depends on connector fidelity and enforcement boundaries. A connector that drops commit semantics is wrong. A policy that is visible but not enforced at the engine or storage boundary is decorative. The metadata layer is only trustworthy when those contracts hold.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The latency cost is usually one extra service hop plus connector work. If a direct Hive metastore lookup takes 180 ms, a federated lookup might take 200 ms because identity resolution and REST add overhead. That cost can be worth it when many engines stop carrying custom catalog logic.',
        'The integration cost is larger than the runtime hop. Each connector needs configuration, tests against real backend behavior, high availability planning, caching, and failure policy. Doubling catalogs doubles connector configuration, but it does not require every engine to learn every backend separately.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Gravitino fits heterogeneous lakehouses with Spark, Trino, Flink, notebooks, Iceberg, Hive, JDBC systems, filesets, and ML assets. It is valuable when schema discovery, access policy, lineage, and engine onboarding are already spread across teams.',
        'It also fits compliance work. A deletion request, PII audit, or schema-change impact analysis needs one place to trace assets across catalogs. Without federation, the same work becomes a spreadsheet across storage teams.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the abstraction hides backend differences. If users cannot tell whether an asset is an Iceberg snapshot, PostgreSQL table, or S3 fileset, they may make unsafe assumptions about commits, isolation, or deletion. Uniform naming must not erase physical semantics.',
        'It also fails when bypass access remains open. If an analyst can read raw S3 Parquet with separate credentials while Gravitino says access is denied, governance is not real. Storage-layer IAM, engine plugins, and credential issuance must line up with the metadata policy.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A platform has 4 backends: Iceberg on S3, PostgreSQL finance tables, S3 training files, and an ML model registry. It has 3 engines: Trino, Spark, and notebooks. Without federation, that is up to 12 engine-backend integration paths before governance is counted.',
        'With Gravitino, the 3 engines integrate with one API, and Gravitino owns 4 connector configurations. A PII tag on production.finance.customers can drive masking in Trino and Spark. If a deletion request needs downstream lineage, one query can return the finance table, derived feature files, and model version that consumed them.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Gravitino documentation, Apache Gravitino GitHub, Apache Iceberg specifications, and Data Mesh writing on federated ownership. Study Iceberg REST catalogs, OpenLineage, Zanzibar-style authorization, OPA/Rego policy, lakeFS, and feature stores next.',
        'The exercise is to draw one asset path through two engines and two backends. Mark where identity is resolved, where policy is enforced, where data commits happen, and where audit is written. Missing marks expose the real platform risk.',
      ],
    },
  ],
};