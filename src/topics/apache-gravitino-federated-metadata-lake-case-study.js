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
        'The animation has two views. "Metadata lake" walks the hierarchy from metalake through catalogs, schemas, tables, filesets, and engines. "Governance plane" traces how tags, policies, ACLs, audit events, and lineage edges attach to assets and flow through engines.',
        {type: 'bullets', items: [
          'Active (highlighted) node: the metadata object or governance step currently being resolved.',
          'Compare (orange) node: a parallel concern -- a region constraint, a lineage edge, or an alternative backend that the current step must respect.',
          'Found (green) node: a resolved outcome -- an engine that can now query through the federation layer, or an audit record that proves a decision.',
        ]},
        {type: 'note', text: 'The matrix frames show metadata normalization across asset types and connector modes. Each cell is a translation decision. Empty or vague cells are places where the federation layer is doing real work to bridge semantic gaps between backends.'},
        'At each frame, ask: what identity was resolved, what backend detail was preserved or hidden, and what governance fact is now enforceable or missing.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The word "federated" is load-bearing. A federated catalog does not copy data into itself or claim to own backend transactions. It coordinates metadata and policy while respecting each source system\'s commit and access semantics. When the backend is Iceberg, snapshots still define correctness. When the backend is PostgreSQL, the database still owns transaction isolation. Federation that hides those differences is not a simplification — it is a lie that causes data loss.'},
        'A mature data platform accumulates catalogs the way a city accumulates plumbing. A Hive metastore holds warehouse tables. Iceberg manages lakehouse snapshots. A JDBC catalog exposes relational databases. Object stores hold raw files. A model registry tracks ML artifacts. A streaming platform owns topics. Each system stores metadata in its own format, with its own naming, its own access rules, and its own idea of what an "asset" is.',
        {type: 'quote', text: 'The data catalog is the system of record for metadata. Without it, every team builds its own incomplete map of what data exists, who owns it, and whether it is safe to use.', attribution: 'Zhamak Dehghani, Data Mesh (2022)'},
        'The cost of catalog sprawl is not just inconvenience. When a GDPR deletion request arrives, the compliance team has to manually trace a customer ID across Hive, Iceberg, S3 prefixes, feature tables, and model training sets. When a schema changes, downstream Spark jobs, Trino dashboards, and Flink pipelines break at different times with different error messages. When an access policy changes in one system, the other five do not know.',
        'Apache Gravitino addresses this by providing a federated metadata lake: a single service boundary that exposes catalogs, schemas, tables, filesets, topics, models, tags, policies, and lineage across heterogeneous backends through one API. The key word is "federated." Gravitino does not replace backends. It coordinates metadata across them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing every platform team tries is a metadata crawler. Scan object stores on a schedule, import Hive metastore entries, copy table descriptions into a search index, and ask teams to annotate owners in a spreadsheet or wiki.',
        {type: 'code', text: '# Typical crawler pattern\nfor source in [hive_metastore, iceberg_catalog, s3_inventory, jdbc_pg]:\n    assets = source.list_tables()\n    for asset in assets:\n        central_index.upsert(\n            name=asset.name,\n            schema=asset.schema,\n            owner=guess_owner(asset),   # often wrong\n            location=asset.location,\n            last_crawled=now()\n        )', language: 'python'},
        'This produces a searchable list. For a while, it solves discovery. But the list decays immediately. Schemas evolve between crawls. Tables move. Owners change teams. New engines bypass the catalog because direct connection strings are faster than looking things up. The crawler does not enforce anything -- it only reports what it found last time it ran.',
        'The second attempt is point-to-point integration. The BI tool connects to Hive. Spark connects to Iceberg. A lineage collector subscribes to Airflow events. An access proxy checks a separate policy store. Each integration reduces some manual work but creates a mesh of partial truth. When a table is renamed, every integration has to independently agree on identity. When a policy changes, every execution boundary has to enforce it in its own way.',
        {type: 'note', text: 'The crawler approach is not stupid. It works well when the platform has few backends, low schema churn, and no cross-system governance requirements. It fails when any of those assumptions stop holding.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is semantic mismatch across backend types.',
        {type: 'table', headers: ['Backend', 'Asset model', 'Identity', 'Commit semantics', 'Access model'], rows: [
          ['Hive Metastore', 'database.table with partitions', 'String name in namespace', 'Mutable; schema is advisory', 'Ranger or Sentry policies'],
          ['Iceberg', 'table with snapshots, manifests, data files', 'Table UUID + metadata pointer', 'ACID commits via metadata swap', 'Storage-layer IAM or catalog ACLs'],
          ['JDBC / PostgreSQL', 'schema.table with columns, constraints, views', 'OID in pg_class', 'Full ACID transactions', 'GRANT/REVOKE on database roles'],
          ['S3 / object store', 'Bucket/prefix/object -- no schema', 'Object key (string path)', 'Eventual consistency (put-after-put)', 'IAM policies on ARN prefixes'],
          ['Model registry', 'model with versions, stages, metrics', 'Model name + version integer', 'Immutable versions, mutable stage labels', 'Application-level RBAC'],
        ]},
        'A crawler that flattens these into rows of (name, schema, owner, location) loses the commit semantics that make Iceberg safe, the partition structure that makes Hive queryable, the version stages that make model promotion work, and the IAM boundaries that make S3 access controllable.',
        'Federation succeeds only if the shared model is expressive enough to coordinate these systems without erasing the details that make each one correct. A unified API that hides the difference between "mutable Hive partition" and "ACID Iceberg snapshot" is not a simplification -- it is a lie that will cause data loss.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Gravitino introduces a three-level namespace -- metalake, catalog, schema -- that sits above backend-specific asset models without replacing them.',
        {type: 'diagram', text: '  metalake ("production")\n      |\n      +-- catalog ("analytics-iceberg")\n      |       |\n      |       +-- schema ("events")\n      |               |\n      |               +-- table ("clicks")    [Iceberg connector]\n      |               +-- table ("sessions")  [Iceberg connector]\n      |\n      +-- catalog ("warehouse-pg")\n      |       |\n      |       +-- schema ("finance")\n      |               |\n      |               +-- table ("invoices")  [JDBC connector]\n      |\n      +-- catalog ("training-data")\n              |\n              +-- schema ("raw")\n                      |\n                      +-- fileset ("images")  [S3 fileset connector]', label: 'Gravitino namespace hierarchy spanning three different backends'},
        'The metalake is a logical metadata domain. Catalogs connect to backends. Schemas group assets within a catalog. The identity path -- metalake.catalog.schema.asset -- is stable across engines. When Trino, Spark, and a governance portal all reference "production.analytics-iceberg.events.clicks," they resolve to the same governed asset even though the underlying storage is an Iceberg table on S3.',
        {type: 'note', text: 'The connective tissue is identity, not data copy. Gravitino does not replicate table data. It provides a stable identifier that multiple engines and governance tools can agree on. If the same customer table appears through Iceberg, Trino, and a compliance portal, those references resolve to one governed object.'},
        'Connectors are the translation layer. Each connector maps Gravitino REST operations to backend-specific operations and exposes backend capabilities through the shared API.',
        {type: 'code', text: '// Gravitino REST API: create a table through the Iceberg connector\nPOST /api/metalakes/production/catalogs/analytics-iceberg/schemas/events/tables\n{\n  "name": "clicks",\n  "columns": [\n    {"name": "user_id", "type": "string", "nullable": false},\n    {"name": "event_type", "type": "string"},\n    {"name": "timestamp", "type": "timestamp"}\n  ],\n  "properties": {\n    "format": "parquet",\n    "location": "s3://lake/events/clicks"\n  }\n}\n// The Iceberg connector translates this into Iceberg table creation\n// with proper snapshot initialization and manifest management.', language: 'javascript'},
        'A connector for Iceberg must respect snapshot isolation and manifest-based commit. A connector for JDBC must handle SQL dialects, column types, and database-level transactions. A connector for filesets must track object-store paths without inventing schema where none exists. Federation lives or dies in these adapters.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A metadata request flows through four layers: API, identity resolution, connector dispatch, and backend operation.',
        {type: 'diagram', text: '  Client (Trino / Spark / governance UI)\n      |\n      v\n  [ Gravitino REST API ]     -- parse metalake.catalog.schema.asset\n      |\n      v\n  [ Identity resolution ]    -- resolve to catalog type + connector config\n      |\n      v\n  [ Connector dispatch ]     -- call backend-specific adapter\n      |         |         |\n      v         v         v\n  [Iceberg]  [JDBC]   [S3 fileset]\n  REST cat   pg_meta   list_objects\n  snapshot   txn       prefix scan', label: 'Request flow from client through Gravitino to heterogeneous backends'},
        'For table discovery, a Trino connector plugin calls Gravitino instead of hard-coding Hive Metastore URIs. Gravitino resolves the catalog type, dispatches to the appropriate connector, and returns table metadata in a normalized format that Trino can consume. The engine never needs to know whether the underlying catalog is Hive, Iceberg REST, or JDBC.',
        {type: 'table', headers: ['Operation', 'Gravitino layer', 'Iceberg connector', 'JDBC connector'], rows: [
          ['List tables', 'GET /schemas/{s}/tables', 'Iceberg REST: GET /namespaces/{n}/tables', 'SELECT table_name FROM information_schema.tables'],
          ['Get schema', 'GET /tables/{t}', 'Iceberg REST: GET /tables/{t} -> schema from metadata', 'SELECT column_name, data_type FROM columns'],
          ['Create table', 'POST /tables', 'Iceberg REST: POST /tables with partition spec', 'CREATE TABLE with SQL DDL generation'],
          ['Drop table', 'DELETE /tables/{t}', 'Iceberg REST: DELETE (purge or soft-delete)', 'DROP TABLE (cascade or restrict)'],
        ]},
        'Tags, roles, and policies attach to identifiers in the Gravitino namespace. A tag like "PII" applied to production.analytics-iceberg.events.clicks is stored in Gravitino, not in the Iceberg catalog. This means governance metadata is portable across backends -- the same tag can apply to an Iceberg table, a JDBC view, and a fileset.',
      ],
    },
    {
      heading: 'Governance plane',
      paragraphs: [
        'Tags, policies, and lineage are the reason a metadata lake must be operational, not decorative.',
        {type: 'diagram', text: '  asset (table/fileset/model)\n      |\n      +-- tag: "PII"          -- classification\n      +-- tag: "finance"      -- domain ownership\n      +-- owner: "data-eng"   -- responsible team\n      |\n      v\n  [ policy engine ]\n      |\n      +-- rule: PII + analyst role -> mask columns\n      +-- rule: PII + export -> block\n      +-- rule: finance + external -> deny\n      |\n      v\n  [ engine integration ]      -- Trino plugin, Spark authorizer\n      |\n      v\n  [ audit log ]               -- who, what, when, which policy, outcome', label: 'Governance flow from tag classification to audit trail'},
        'A PII tag is useful only if it participates in access decisions at query time. In Gravitino, the governance flow works like this: an asset receives tags, policies bind rules to tag-role combinations, engine integrations enforce those rules when a query arrives, and audit logs record the decision.',
        {type: 'code', text: '// Tag a table as PII\nPOST /api/metalakes/production/catalogs/analytics-iceberg\n     /schemas/events/tables/clicks/tags\n{ "name": "PII", "properties": {"classification": "sensitive"} }\n\n// Policy check at query time (conceptual)\nfunction checkAccess(user, asset, operation) {\n  const tags = gravitino.getTags(asset);\n  const roles = gravitino.getRoles(user);\n  for (const policy of gravitino.getPolicies(tags, roles)) {\n    if (policy.denies(operation)) {\n      auditLog.write({user, asset, operation, decision: "DENY", policy});\n      throw new AccessDenied(policy.reason);\n    }\n  }\n  auditLog.write({user, asset, operation, decision: "ALLOW"});\n}', language: 'javascript'},
        'Lineage connects inputs to outputs. When a Spark job reads from production.analytics-iceberg.events.clicks and writes to production.analytics-iceberg.reports.daily_summary, that edge should be recorded. When someone asks "what downstream assets are affected by a schema change in clicks?", lineage answers the question.',
        {type: 'note', text: 'Governance metadata that only appears in a UI is theater. The practical test is: does a forbidden access attempt fail at the engine boundary where work actually happens, or does it succeed while a dashboard shows a red warning that nobody reads?'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates metadata authority from compute.',
        {type: 'bullets', items: [
          'Engines ask one service for asset identity, location, schema, and access rules instead of hard-coding per-backend connection logic.',
          'The namespace hierarchy (metalake/catalog/schema/asset) provides stable cross-engine identity without requiring backends to adopt a shared naming scheme.',
          'Connectors preserve backend-specific semantics (Iceberg snapshots, JDBC transactions, S3 eventual consistency) instead of flattening them into a false uniform model.',
          'Governance objects (tags, policies, roles) attach to the shared identity layer, making them portable across backends.',
          'Federation is additive: adding a new backend means writing one connector, not updating every engine.',
        ]},
        'The word "federated" is load-bearing. A federated catalog does not copy data into itself or claim to own backend transactions. It coordinates metadata and policy while respecting each source system\'s commit and access semantics. When the backend is Iceberg, snapshots and manifests still define correctness. When the backend is PostgreSQL, the database still owns transaction isolation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        {type: 'table', headers: ['Operation', 'Latency cost', 'What grows', 'What stays flat'], rows: [
          ['Asset lookup', 'One REST call + one connector call to backend', 'Grows with connector latency, not with total asset count', 'Gravitino lookup is O(1) by identifier path'],
          ['List tables in schema', 'One REST call + one backend list', 'Proportional to tables in that schema', 'Unrelated catalogs are not touched'],
          ['Tag assignment', 'One REST write to Gravitino store', 'Flat -- stored in Gravitino, not in backend', 'Backend is not contacted'],
          ['Policy check', 'Tag fetch + role fetch + rule evaluation', 'Grows with number of applicable policies', 'Flat if policies are pre-cached per tag set'],
          ['Connector sync', 'Backend-dependent (Hive: list partitions; Iceberg: read metadata.json)', 'Grows with backend catalog size', 'Gravitino overhead is minimal vs. backend I/O'],
        ]},
        'The dominant cost is connector latency, not Gravitino overhead. A Hive Metastore call that takes 200ms through Gravitino also takes ~180ms directly. The federation tax is the extra REST hop (typically 5-20ms) plus identity resolution.',
        {type: 'note', text: 'The setup cost is significant. Each connector requires configuration, testing against the real backend, and validation that it preserves backend semantics faithfully. A Gravitino deployment with five connectors is a multi-week integration project, not a one-day install. The payoff comes only after multiple engines and governance tools share the federation layer.'},
        'Doubling the number of catalogs doubles the connector configurations but does not slow down individual asset lookups. Doubling the number of engines using Gravitino adds load to the Gravitino service but simplifies each engine\'s catalog logic. The scaling curve favors organizations that are already paying the N-engines times M-backends integration tax.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'table', headers: ['Scenario', 'Why Gravitino fits', 'Without federation'], rows: [
          ['Heterogeneous lakehouse', 'Spark, Trino, Flink all resolve tables through one API', 'Each engine maintains its own catalog config; schema changes require N updates'],
          ['Cross-system GDPR deletion', 'Trace a customer ID across Iceberg, JDBC, S3, and model inputs through one lineage graph', 'Manual spreadsheet audit across systems; weeks instead of hours'],
          ['Multi-engine onboarding', 'New engine integrates once with Gravitino instead of learning every backend', 'New engine gets a spreadsheet of Hive URIs, JDBC strings, S3 prefixes, and special-case ACLs'],
          ['Consistent PII enforcement', 'One PII tag triggers masking rules in Trino, Spark, and the BI tool', 'Each tool has its own PII definition; drift is invisible until an audit finds it'],
          ['ML feature governance', 'Feature tables, training datasets, and model inputs share the same tag and lineage namespace', 'ML team maintains a separate registry disconnected from data platform governance'],
        ]},
        'The pattern is strongest when catalog sprawl has already become a product problem. If a company has one Hive Metastore and one engine, federation adds complexity without benefit. If it has five catalogs across three storage systems and four engines, the integration mesh is already O(n*m) and growing.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type: 'bullets', items: [
          'Lossy abstraction: if the shared model hides backend commit rules, table types, or regional constraints, users make unsafe assumptions. A catalog entry that looks uniform but behaves differently under each connector is worse than no abstraction -- it creates false confidence that leads to data loss.',
          'Stale metadata: tags, schemas, lineage, and owners need freshness targets. If a source table adds a column but the metadata lake still shows the old schema, downstream jobs break with confusing errors. Staleness in governance metadata is worse -- a stale "no PII" tag means regulated data flows without controls.',
          'Unenforced governance: direct S3 access, bypass credentials, unintegrated engines, and ad hoc service accounts can all defeat the catalog. If an analyst can read the raw Parquet files on S3 without going through Gravitino, every tag and policy is advisory.',
          'Connector fidelity: a connector that simplifies Iceberg commit semantics or drops JDBC transaction isolation to fit a generic API is a regression, not a federation. Every connector must be validated against the backend it wraps.',
          'Single point of failure: if Gravitino is down, engines that depend on it for table resolution cannot run queries. High availability and graceful degradation (cached metadata, fallback to direct backend access) are operational requirements, not nice-to-haves.',
        ]},
        {type: 'note', text: 'The sharpest failure test: can a forbidden access attempt succeed by bypassing Gravitino and going directly to the storage layer? If yes, governance is decorative. The metadata lake must either control credential issuance or verify that storage-layer IAM enforces the same rules independently.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A data platform has four backends: an Iceberg catalog on S3 for analytics, a PostgreSQL warehouse for finance, S3 directories for ML training data, and a small MLflow model registry. Three engines consume data: Trino (interactive SQL), Spark (batch pipelines), and Jupyter notebooks (ML experimentation).',
        {type: 'diagram', text: '  Before federation:\n\n  Trino -----> Hive Metastore -----> S3 (analytics)\n  Trino -----> JDBC config --------> PostgreSQL (finance)\n  Spark -----> Iceberg catalog -----> S3 (analytics)\n  Spark -----> JDBC config --------> PostgreSQL (finance)\n  Jupyter ---> boto3 direct --------> S3 (training data)\n  Jupyter ---> MLflow client -------> MLflow (models)\n\n  6 integration paths. Each carries its own auth, naming, and schema logic.\n  PII tags exist in a wiki page. Lineage is tribal knowledge.\n\n  After federation:\n\n  Trino ----+\n  Spark ----+--> Gravitino REST API --> Iceberg connector --> S3\n  Jupyter --+                       --> JDBC connector ----> PostgreSQL\n                                    --> Fileset connector --> S3 (training)\n                                    --> Model connector ---> MLflow\n\n  3 integration paths to one API.\n  Tags, policies, and lineage live in Gravitino.', label: 'Before and after: integration path reduction through federation'},
        'The platform team configures four Gravitino catalogs under one metalake called "production." Tags mark PII columns in the finance schema and in the analytics events table. A policy rule binds PII + analyst-role to column masking in Trino and Spark. Job integrations emit lineage edges from source tables to derived tables.',
        {type: 'code', text: '// Customer deletion: trace all assets containing user_id\nGET /api/metalakes/production/lineage?asset=analytics-iceberg.events.clicks\n    &direction=downstream&depth=5\n\nResponse:\n{\n  "edges": [\n    {"from": "analytics-iceberg.events.clicks",\n     "to": "analytics-iceberg.reports.daily_summary", "type": "transform"},\n    {"from": "analytics-iceberg.reports.daily_summary",\n     "to": "training-data.raw.click_features", "type": "export"},\n    {"from": "training-data.raw.click_features",\n     "to": "models.prod.click_predictor_v3", "type": "training_input"}\n  ]\n}\n// Deletion scope: 4 assets across 3 catalogs, found in one API call\n// vs. manual spreadsheet audit across 4 systems', language: 'javascript'},
        'The deployment is judged by three metrics: (1) access decisions are consistent across engines -- a Trino query and a Spark job that touch the same PII column both apply masking; (2) a deletion request can be fully traced in under one hour instead of two weeks; (3) new engines integrate in days by pointing at the Gravitino API instead of collecting backend credentials from five teams.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'Apache Gravitino documentation: https://gravitino.apache.org/docs/ -- architecture guide, connector reference, REST API specification.',
          'Apache Gravitino GitHub: https://github.com/apache/gravitino -- source code, connector implementations, integration tests.',
          'Zhamak Dehghani, Data Mesh (O\'Reilly, 2022) -- the organizational argument for federated data ownership that metadata lakes operationalize.',
          'Apache Iceberg specification: https://iceberg.apache.org/spec/ -- the table format whose commit semantics a Gravitino Iceberg connector must preserve.',
        ]},
        {type: 'table', headers: ['Role', 'Topic', 'Why'], rows: [
          ['Prerequisite', 'Iceberg REST Catalog Protocol Case Study', 'Understand the catalog API that Gravitino federates over for lakehouse tables'],
          ['Prerequisite', 'Zanzibar Authorization Case Study', 'Relationship-based access control is the theory behind federated policy enforcement'],
          ['Extension', 'OpenLineage Metadata Lineage Graph Case Study', 'Lineage event collection that feeds the lineage edges Gravitino stores'],
          ['Extension', 'OPA Rego Policy Decision Graph', 'Policy-as-code evaluation that can power Gravitino policy decisions'],
          ['Contrast', 'lakeFS Data Lake Version Graph Case Study', 'Versioned data operations at the storage layer vs. metadata federation above it'],
          ['Related', 'Feature Store', 'Governed ML features as a specialized metadata domain within the federation'],
        ]},
      ],
    },
  ],
};
