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
      heading: 'The problem',
      paragraphs: [
        `A mature data platform rarely has one catalog. It has Hive metastore tables, Iceberg tables, JDBC databases, object-store paths, feature tables, model artifacts, streaming topics, regional copies, and engine-specific permissions. Each system knows part of the truth. Users search one place, schedule jobs from another place, request access in a third place, and learn about lineage only after an incident.`,
        `The naive answer is to build a dashboard that lists everything. That helps discovery for a while, but it does not solve execution. A dashboard can show that a table exists without giving Spark, Trino, Flink, or a notebook a reliable way to load it. It can display a PII tag without enforcing the tag at query time. It can show lineage without proving that the source metadata is fresh.`,
        `Apache Gravitino is aimed at the harder problem: a federated metadata lake. It provides a common metadata model and service boundary across many asset types and backends while preserving the fact that those backends are different. The goal is not to pretend every system is one database. The goal is to give engines, users, and governance tools one consistent control plane for finding, describing, securing, and operating assets.`,
      ],
    },
    {
      heading: 'The naive wall',
      paragraphs: [
        `A central inventory usually begins with crawlers and naming conventions. The platform team scans object stores, imports database schemas, copies table descriptions, and asks teams to annotate owners. That produces a searchable list, but the list starts decaying immediately. Schemas evolve, tables move, owners change, access rules drift, and new engines bypass the catalog because direct connection strings are faster.`,
        `The next attempt is point-to-point integration. The BI tool integrates with one catalog. Spark integrates with another. A lineage collector subscribes to job events. An access proxy checks a separate policy store. This reduces some manual work but creates a mesh of partial truth. When a table is renamed, every integration has to agree on identity. When a policy changes, every execution boundary has to enforce it the same way.`,
        `The wall is semantic mismatch. A relational catalog has databases and tables. A file store has paths and locations. A lakehouse table has snapshots, manifests, and commit rules. A model registry has versions and stages. A governance system has tags, roles, and audit records. Federation succeeds only if the shared model is strong enough to coordinate these systems without flattening away the details that make them safe.`,
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        `Gravitino's top-level organizing idea is the metalake: a logical metadata domain that can contain multiple catalogs. Catalogs connect to backends or asset families. Under them are schemas, tables, filesets, topics, models, or other supported objects depending on the connector and version. This gives the platform a namespace that can span engines and storage systems without forcing every asset into one physical store.`,
        `The important data structures are identifiers, catalog objects, schema objects, table and column definitions, fileset locations, model or topic metadata, user and role bindings, tags, policies, audit events, lineage edges, and connector configuration. The connective tissue is identity. If the same customer table appears through Iceberg, Trino, and a governance portal, the platform needs a stable way to say "these references describe the same governed asset."`,
        `Connectors are the translation layer. They map Gravitino operations to backend-specific operations and expose backend capabilities through the shared API. A connector for a lakehouse catalog has to respect table commit semantics. A connector for filesets has to respect object-store paths and permissions. A connector for relational metadata has to handle database dialects, names, and type systems. Federation lives or dies in those adapters.`,
      ],
    },
    {
      heading: 'Governance plane',
      paragraphs: [
        `Governance is the reason a metadata lake must be operational rather than decorative. A tag such as PII, restricted, finance, or export-controlled is useful only if it participates in access decisions, job planning, audits, and ownership workflows. A policy is useful only if engines and storage boundaries actually respect it. A lineage edge is useful only if it is fresh enough to answer "what downstream assets did this bad source affect?"`,
        `In a Gravitino-style design, a request should resolve the asset, identify the actor, check the relevant role or policy state, expose credentials with the smallest practical scope, and emit audit evidence. If the request produces a derived asset, lineage should connect input and output. The platform should be able to reconstruct why access was allowed, which connector was used, and what metadata version the engine saw.`,
        `This is where federation becomes harder than inventory. The policy engine cannot live only in a UI. A query through Trino, a Spark batch job, and a Python process should not silently apply three different interpretations of the same tag. Gravitino can provide the common metadata surface, but enforcement still depends on connector behavior, engine integration, storage credentials, and audit coverage.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The design works because it separates metadata authority from compute engines. Engines should not need custom code for every catalog, policy convention, and object-store layout in the company. They should be able to ask a metadata service what an asset is, where it lives, what constraints apply, and how to access it. That does not remove engine-specific optimization, but it moves shared control-plane facts into one service boundary.`,
        `It also works because the model is hierarchical without being single-backend. Metalake, catalog, schema, and asset identifiers create a stable path for discovery and ownership. Connectors keep backend-specific behavior close to the backend. Governance objects attach to the shared identity layer. That combination gives the platform a chance to answer both human questions and execution-time questions from the same source of truth.`,
        `The word "federated" matters. A federated catalog should not copy all data into itself or claim to own every backend transaction. It should coordinate metadata, policy, and discovery while respecting the source system's commit and access semantics. When the backend is Iceberg, the table format still defines snapshots and manifests. When the backend is a JDBC database, the database still owns query execution and transaction semantics.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Gravitino is strongest in heterogeneous lakehouse environments. If a company runs Spark for pipelines, Trino for interactive SQL, Flink for streaming, Iceberg or Hive for tables, object stores for raw files, and separate tools for models or features, catalog sprawl becomes a product problem. A shared metadata lake gives platform teams one place to expose asset discovery, ownership, tags, and access flows.`,
        `It also wins when governance needs to cross storage boundaries. A customer attribute might begin in a database, land in an Iceberg table, feed a feature pipeline, and become part of a model training set. Without a shared metadata plane, each stage can have a different name, owner, and policy state. Federation gives the organization a way to preserve context as data moves.`,
        `A third winning case is multi-engine onboarding. New engines and tools can integrate through a common catalog API rather than being handed a spreadsheet of Hive endpoints, object-store prefixes, JDBC URLs, and special-case permissions. The platform becomes easier to evolve because metadata access is no longer scattered across every job and notebook.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The main failure mode is a lossy abstraction. If the shared model hides backend commit rules, table types, identity rules, or regional constraints, users will make unsafe assumptions. A catalog entry that looks uniform but behaves differently under each connector is worse than no abstraction because it creates false confidence.`,
        `A second failure mode is stale metadata. Tags, owners, schemas, lineage, and location facts are not valuable just because they exist. They need freshness targets and reconciliation. If a source table changes but the metadata lake does not update, discovery and governance both degrade. If audit events arrive without asset identity, incident review becomes guesswork.`,
        `A third failure mode is unenforced governance. Many systems can display policy; fewer can make every execution path obey it. Direct storage access, bypass credentials, unintegrated engines, and ad hoc service accounts can all defeat a beautiful catalog. The practical test is whether a forbidden access attempt fails at the boundary where work is actually done, not whether a tag appears on a web page.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Measure connector freshness, failed syncs, asset lookup latency, policy-decision latency, audit completeness, lineage coverage, orphaned assets, duplicate identities, and direct-access bypasses. For user experience, measure search success, access request cycle time, and the number of jobs that still carry hard-coded catalog or storage endpoints.`,
        `Run reconciliation jobs that compare Gravitino metadata against source catalogs. Test policy changes with canary identities. Sample audit logs and ask whether each event can answer who, what asset, which engine, which credential scope, which policy, and which lineage context. A metadata lake is healthy when it can answer operational questions under pressure, not just populate a schema browser.`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `A data platform has an Iceberg lake for analytics, a relational warehouse for finance, object-store directories for training data, and a small model registry. Analysts use Trino. Engineers use Spark. ML teams use notebooks. Before federation, each team maintains its own asset list and access convention. A customer deletion request requires manual tracing across systems.`,
        `The platform introduces Gravitino as the metadata lake. The analytics catalog exposes Iceberg tables. A fileset catalog tracks raw training datasets. A relational catalog exposes selected finance schemas. Tags mark PII and regulated data. Access policies bind roles to tags and catalogs. Job integrations write lineage edges from source tables to derived tables and model inputs.`,
        `The result is not magic centralization. The Iceberg catalog still owns Iceberg table state. The warehouse still owns warehouse queries. Object storage still stores files. Gravitino owns the cross-system metadata view and gives engines and governance tools one place to resolve identity, policy, ownership, and discovery. The deployment is judged by whether access is consistently enforced and whether incidents can be traced quickly.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Apache Gravitino home page at https://gravitino.apache.org/ and Apache Gravitino documentation at https://gravitino.apache.org/docs/1.2.1/.`,
        `Study this with Iceberg REST Catalog Protocol Case Study for catalog APIs, OpenLineage Metadata Lineage Graph Case Study for lineage events, Zanzibar Authorization Case Study and OPA Rego Policy Decision Graph for access control, lakeFS Data Lake Version Graph Case Study for versioned data operations, and Feature Store for governed ML features.`,
      ],
    },
  ],
};
