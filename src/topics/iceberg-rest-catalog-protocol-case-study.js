// Iceberg REST catalog protocol: one client-facing API for namespaces, tables,
// views, credentials, commits, conflict handling, and catalog-side metadata.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'iceberg-rest-catalog-protocol-case-study',
  title: 'Iceberg REST Catalog Protocol Case Study',
  category: 'Systems',
  summary: 'Apache Iceberg REST Catalog as a lakehouse control-plane protocol: engines use one API for table metadata, commits, caching, credentials, and catalog services.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['catalog API', 'commit safety'], defaultValue: 'catalog API' },
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

function catalogGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'engine', label: 'engine', x: 0.7, y: 3.5, note: notes.engine ?? 'Spark/Trino' },
      { id: 'client', label: 'client', x: 2.2, y: 3.5, note: notes.client ?? 'REST' },
      { id: 'auth', label: 'auth', x: 4.0, y: 1.7, note: notes.auth ?? 'token' },
      { id: 'catalog', label: 'catalog', x: 4.0, y: 3.5, note: notes.catalog ?? 'service' },
      { id: 'cred', label: 'creds', x: 4.0, y: 5.3, note: notes.cred ?? 'vend' },
      { id: 'ns', label: 'ns', x: 6.0, y: 1.6, note: notes.ns ?? 'namespace' },
      { id: 'table', label: 'table', x: 6.0, y: 3.5, note: notes.table ?? 'pointer' },
      { id: 'meta', label: 'meta', x: 7.8, y: 3.5, note: notes.meta ?? 'JSON' },
      { id: 'files', label: 'files', x: 9.2, y: 3.5, note: notes.files ?? 'S3' },
    ],
    edges: [
      { id: 'e-engine-client', from: 'engine', to: 'client', weight: 'API' },
      { id: 'e-client-auth', from: 'client', to: 'auth', weight: '' },
      { id: 'e-client-catalog', from: 'client', to: 'catalog', weight: 'HTTP' },
      { id: 'e-catalog-cred', from: 'catalog', to: 'cred', weight: 'sign' },
      { id: 'e-catalog-ns', from: 'catalog', to: 'ns', weight: 'list' },
      { id: 'e-catalog-table', from: 'catalog', to: 'table', weight: 'load' },
      { id: 'e-table-meta', from: 'table', to: 'meta', weight: 'root' },
      { id: 'e-meta-files', from: 'meta', to: 'files', weight: 'scan' },
    ],
  }, { title });
}

function commitGraph(title) {
  return graphState({
    nodes: [
      { id: 'read', label: 'read', x: 0.7, y: 3.5, note: 'base' },
      { id: 'plan', label: 'plan', x: 2.4, y: 2.0, note: 'new meta' },
      { id: 'req', label: 'commit', x: 2.4, y: 5.0, note: 'change' },
      { id: 'check', label: 'check', x: 4.4, y: 3.5, note: 'conflict' },
      { id: 'retry', label: 'retry', x: 6.2, y: 1.7, note: 'reload' },
      { id: 'apply', label: 'apply', x: 6.2, y: 5.3, note: 'atomic' },
      { id: 'cache', label: 'cache', x: 8.0, y: 2.0, note: 'invalidate' },
      { id: 'newroot', label: 'root', x: 8.0, y: 5.0, note: 'current' },
    ],
    edges: [
      { id: 'e-read-plan', from: 'read', to: 'plan', weight: '' },
      { id: 'e-plan-req', from: 'plan', to: 'req', weight: '' },
      { id: 'e-req-check', from: 'req', to: 'check', weight: 'base' },
      { id: 'e-check-retry', from: 'check', to: 'retry', weight: 'fail' },
      { id: 'e-check-apply', from: 'check', to: 'apply', weight: 'ok' },
      { id: 'e-retry-read', from: 'retry', to: 'read', weight: 'again' },
      { id: 'e-apply-cache', from: 'apply', to: 'cache', weight: 'evict' },
      { id: 'e-apply-newroot', from: 'apply', to: 'newroot', weight: 'swap' },
    ],
  }, { title });
}

function* catalogApi() {
  yield {
    state: catalogGraph('REST catalog gives engines one catalog API'),
    highlight: { active: ['engine', 'client', 'catalog', 'table', 'meta', 'e-client-catalog'], found: ['files'] },
    explanation: 'The Iceberg REST Catalog protocol lets different engines talk to a catalog through one OpenAPI-defined client surface instead of bundling a custom catalog integration for every backend.',
    invariant: 'The table format still lives in Iceberg metadata; the REST catalog standardizes how engines find and commit that metadata.',
  };

  yield {
    state: labelMatrix(
      'API',
      [
        { id: 'cfg', label: 'cfg' },
        { id: 'ns', label: 'ns' },
        { id: 'tbl', label: 'tbl' },
        { id: 'view', label: 'view' },
        { id: 'cred', label: 'cred' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['boot', 'drift'],
        ['list', 'ACL'],
        ['load', 'stale'],
        ['sql', 'dial'],
        ['vend', 'leak'],
      ],
    ),
    highlight: { active: ['cfg:does', 'tbl:does', 'cred:does'], compare: ['cred:risk'], found: ['ns:risk'] },
    explanation: 'A catalog protocol is a control-plane data structure. It has configuration, namespaces, tables, views, commits, credentials, errors, and retry contracts that engines must interpret consistently.',
  };

  yield {
    state: catalogGraph('Catalog services can own credentials and metadata upgrades'),
    highlight: { active: ['auth', 'cred', 'catalog', 'meta', 'e-catalog-cred', 'e-table-meta'], compare: ['engine'] },
    explanation: 'The catalog service can centralize security-sensitive work such as credential vending or remote signing. It can also write root metadata so clients do not all need backend-specific dependencies.',
  };

  yield {
    state: labelMatrix(
      'Links',
      [
        { id: 'ice', label: 'ice' },
        { id: 'eng', label: 'eng' },
        { id: 'cat', label: 'cat' },
        { id: 'obj', label: 'obj' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'asks', label: 'asks' },
      ],
      [
        ['spec', 'scan'],
        ['SQL', 'load'],
        ['root', 'commit'],
        ['files', 'read'],
      ],
    ),
    highlight: { active: ['cat:owns', 'cat:asks'], found: ['ice:owns'], compare: ['obj:asks'] },
    explanation: 'The clean boundary is engine asks, catalog authorizes and returns metadata, object storage serves files, and Iceberg metadata defines the table state.',
  };
}

function* commitSafety() {
  yield {
    state: commitGraph('REST commits are change-based and conflict-aware'),
    highlight: { active: ['read', 'plan', 'req', 'check', 'e-req-check'], found: ['apply'] },
    explanation: 'A writer reads a base table state, plans a metadata update, then asks the catalog to commit a change against that base. The catalog can reject stale or conflicting commits.',
  };

  yield {
    state: labelMatrix(
      'Commit',
      [
        { id: 'base', label: 'base' },
        { id: 'chg', label: 'chg' },
        { id: 'chk', label: 'chk' },
        { id: 'swap', label: 'swap' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['root', 'stale'],
        ['diff', 'bad'],
        ['rules', 'race'],
        ['atomic', 'lost'],
      ],
    ),
    highlight: { active: ['base:need', 'chg:need', 'swap:need'], compare: ['chk:fail'] },
    explanation: 'Commit safety is compare-and-swap at the metadata layer. The request must identify the expected base, the intended changes, and the validation rules that make the commit safe.',
    invariant: 'Object files can be immutable while table state remains transactional through a metadata root pointer.',
  };

  yield {
    state: commitGraph('Catalog-side retries simplify engine behavior'),
    highlight: { active: ['check', 'retry', 'read', 'e-check-retry', 'e-retry-read'], compare: ['apply'] },
    explanation: 'The protocol can support server-side deconfliction and retries, reducing the amount of catalog-specific retry machinery every engine has to carry.',
  };

  yield {
    state: labelMatrix(
      'Ops',
      [
        { id: 'create', label: 'create' },
        { id: 'alter', label: 'alter' },
        { id: 'append', label: 'append' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['root', 'name'],
        ['meta', 'schema'],
        ['snap', 'base'],
        ['gone', 'ACL'],
      ],
    ),
    highlight: { active: ['append:state', 'append:guard', 'alter:guard'], found: ['create:state'] },
    explanation: 'Real catalog operations are table-state transitions. Each one needs authorization, current-state checks, metadata updates, cache invalidation, and a precise error path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'catalog API') yield* catalogApi();
  else if (view === 'commit safety') yield* commitSafety();
  else throw new InputError('Pick an Iceberg REST catalog view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The catalog API view traces a request from engine to object storage. Active nodes are the components handling the current operation. Found nodes hold the final data the engine needs. Compare nodes highlight where authority shifts -- from engine to catalog, or from catalog to storage.',
        'The commit safety view traces a write through conflict detection. Active nodes are the path the commit takes. The retry branch (compare) shows what happens when the base has moved. The apply branch (found) shows a successful atomic swap of the metadata root pointer.',
        'In both views, edge labels name the contract between components. Read them as verbs: the engine calls, the catalog loads, the table roots, the metadata scans. Each edge is a network boundary with its own latency and failure mode.',
        {type:'callout', text:'The REST catalog turns table metadata authority into one protocol boundary so engines ask for safe commits and scoped access instead of embedding catalog logic.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The table format is the easy part. The hard part is getting five engines to agree on which metadata file is current, who is allowed to advance it, and how to hand out storage credentials without shipping IAM keys to every Spark executor.',
          attribution: 'Ryan Blue, Iceberg creator, on the motivation for a catalog protocol',
        },
        'Apache Iceberg solves the table-format problem: snapshots, manifests, schema evolution, partition specs, and delete files give analytical tables ACID semantics over immutable files in object storage. But the format alone does not solve the catalog integration problem. Every engine still needs to find a table by name, authenticate, load the current metadata root, commit changes atomically, handle conflicts, and obtain credentials to read the underlying files.',
        'Without a standard protocol, every engine carries bespoke catalog integrations. Spark implements HadoopCatalog, HiveCatalog, GlueCatalog, NessieCatalog, and more. Trino implements a parallel set. PyIceberg implements another. Each integration embeds its own assumptions about authentication, commit retries, caching, and credential scoping. The table format is open, but the control plane fragments into N engines times M backends -- an integration matrix that grows quadratically.',
        {
          type: 'table',
          headers: ['Without REST protocol', 'With REST protocol'],
          rows: [
            ['Each engine implements each catalog backend', 'Each engine implements one REST client'],
            ['N engines x M backends = N*M integrations', 'N engines + M backends = N+M integrations'],
            ['Credential logic duplicated in every client', 'Credential vending centralized in the catalog service'],
            ['Commit conflict rules vary by engine', 'Commit validation defined once in the protocol spec'],
            ['Adding a new engine requires M catalog plugins', 'Adding a new engine requires one HTTP client'],
          ],
        },
        'The Iceberg REST Catalog protocol collapses that matrix. It defines an OpenAPI specification for catalog operations so any engine talks to any catalog through one HTTP surface. Files stay in object storage. Iceberg metadata still defines table state. The REST catalog is the control-plane API that standardizes how engines discover, read, commit, and secure that state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a pointer store. Put table names in a database (Hive Metastore, PostgreSQL, DynamoDB), store the path to the latest metadata.json, and let engines read and write that pointer directly.',
        {
          type: 'diagram',
          label: 'Pointer-store catalog: engines talk directly to the backend',
          text: [
            '  Spark -----> Hive Metastore -----> metadata.json -----> data files',
            '  Trino -----> Hive Metastore -----> metadata.json -----> data files',
            '  PyIceberg -> Hive Metastore -----> metadata.json -----> data files',
            '',
            '  Each engine has a HiveCatalog plugin that knows:',
            '    - how to connect to the Metastore Thrift API',
            '    - how to parse the location field',
            '    - how to do compare-and-swap on the pointer',
            '    - how to get AWS/GCS/Azure credentials (engine-specific)',
          ].join('\n'),
        },
        'This works for a single engine in a controlled environment. Hive Metastore has served this role for over a decade. Teams reach for it because the infrastructure already exists, the Thrift API is documented, and Spark has a mature HiveCatalog implementation.',
        'The approach is not stupid. It correctly separates table names from table data. It gives engines a stable lookup path. For a Spark-only shop with one storage backend and one credential model, a pointer store is sufficient and has been for years.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The pointer store breaks on three axes simultaneously: concurrency, integration breadth, and security delegation.',
        {
          type: 'note',
          text: 'The wall is not HTTP mechanics. HTTP is plumbing. The wall is consistency at the metadata root. Iceberg data files are immutable, but the current table state advances through metadata commits. Two writers reading snapshot 10 and both trying to create snapshot 11 is a lost-update race unless the catalog enforces compare-and-swap semantics.',
        },
        'Concurrency: Hive Metastore stores the metadata location as a string property on a table object. Updating that string is a Thrift call, not a conditional write. To get compare-and-swap, engines must implement locking or conditional-update logic on top of the Metastore API. Different engines implement this differently, and any mismatch means silent data loss -- the pointer advances, the old snapshot is orphaned, and one writer overwrites the other.',
        'Integration breadth: switching from Hive Metastore to DynamoDB, from DynamoDB to a cloud-managed catalog, or from AWS to GCS requires every engine to carry a new plugin. Each plugin re-implements commit logic, retry behavior, listing semantics, and error mapping. The cost of adding the Kth backend is linear in the number of engines, and the cost of adding the Jth engine is linear in the number of backends.',
        {
          type: 'table',
          headers: ['Failure', 'Root cause', 'Symptom'],
          rows: [
            ['Lost update', 'Two engines race on the metadata pointer without CAS', 'One snapshot disappears; its data files become orphans'],
            ['Stale read', 'Engine caches metadata.json path but another writer advanced it', 'Query returns outdated results; time-travel to wrong snapshot'],
            ['Credential leak', 'Engine embeds long-lived IAM keys in its catalog config', 'Compromised Spark executor exposes all-bucket access'],
            ['Integration gap', 'New engine lacks plugin for the backend', 'Team cannot use the engine without building a custom catalog adapter'],
          ],
        },
        'Security delegation: the pointer store tells the engine where the files are, but not how to access them. Each engine obtains storage credentials through its own mechanism -- environment variables, instance profiles, service-account impersonation, or hardcoded keys. The catalog has no control over credential scope, lifetime, or audit. A compromised Spark executor with a broad IAM role can read every table in the bucket, not just the one it was querying.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'quote',
          text: 'A catalog is not a pointer store. A catalog is a transaction coordinator for metadata, a credential authority for storage, and a name-resolution service for tables -- behind one protocol boundary.',
          attribution: 'The invariant the REST catalog protocol enforces',
        },
        'The core insight is that the catalog should be a service with a protocol, not a shared database with client-side logic. By defining the catalog boundary as an HTTP API with precise semantics for loading, committing, authenticating, and credential vending, the protocol moves consistency enforcement and security delegation out of every engine and into one place.',
        'The invariant: at any point in time, the catalog is the single authority for which metadata root pointer is current for a given table. Engines do not write the pointer. They ask the catalog to advance it, and the catalog validates the request against the current state. This is compare-and-swap over table metadata, not pointer assignment.',
        {
          type: 'diagram',
          label: 'REST catalog: one protocol boundary replaces the integration matrix',
          text: [
            '  Spark -----+                              +-----> namespace ops',
            '  Trino -----+--> REST Client --> Catalog ---+-----> table load/commit',
            '  Flink -----+       (HTTP)       Service    +-----> credential vending',
            '  PyIceberg -+                              +-----> auth / audit',
            '',
            '  Engine count: N     Backend count: M     Integrations: N + M',
            '  Catalog owns: CAS commits, credential scope, cache invalidation',
            '  Engine owns:  scan planning, file I/O, query execution',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The protocol defines six resource groups, each with RESTful endpoints. The OpenAPI spec (rest-catalog-open-api.yaml in the Iceberg repo) is the canonical reference.',
        {
          type: 'table',
          headers: ['Resource group', 'Key endpoints', 'Purpose'],
          rows: [
            ['Configuration', 'GET /v1/config', 'Returns catalog defaults and overrides; engines merge these with local config at startup'],
            ['OAuth tokens', 'POST /v1/oauth/tokens', 'Exchanges client credentials or tokens for a scoped access token the client uses on subsequent requests'],
            ['Namespaces', 'GET/POST/DELETE /v1/namespaces', 'Hierarchical namespace CRUD; properties on namespaces carry metadata like location defaults'],
            ['Tables', 'GET/POST/DELETE /v1/namespaces/{ns}/tables', 'Table CRUD plus POST /v1/namespaces/{ns}/tables/{table} for metadata commits'],
            ['Views', 'GET/POST/DELETE /v1/namespaces/{ns}/views', 'SQL view definitions stored as Iceberg view metadata (format version 1)'],
            ['Credential vending', 'Returned in load-table response', 'Short-lived, scoped storage credentials (S3 STS tokens, GCS signed URLs, ADLS SAS tokens)'],
          ],
        },
        'A typical read path: the engine calls GET /v1/config at startup, then POST /v1/oauth/tokens to authenticate, then GET /v1/namespaces/{ns}/tables/{table} to load the table. The response includes the current metadata location, the full table metadata (or enough to start scanning), and optionally scoped credentials to access the data files. The engine uses the metadata to plan a scan, then reads Parquet/ORC/Avro files from object storage using the vended credentials.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Simplified REST catalog load-table flow\nasync function loadTable(catalog, namespace, table) {\n  // 1. Authenticate\n  const token = await fetch(`${catalog}/v1/oauth/tokens`, {\n    method: \'POST\',\n    body: new URLSearchParams({ grant_type: \'client_credentials\',\n      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: \'catalog\' }),\n  }).then(r => r.json());\n\n  // 2. Load table metadata + credentials\n  const resp = await fetch(\n    `${catalog}/v1/namespaces/${namespace}/tables/${table}`,\n    { headers: { Authorization: `Bearer ${token.access_token}` } }\n  ).then(r => r.json());\n\n  // resp.metadata = full Iceberg TableMetadata (snapshots, schema, specs)\n  // resp.metadata-location = S3/GCS/ADLS path to metadata.json\n  // resp.config[\'s3.access-key-id\'] = scoped, short-lived credential\n  return resp;\n}',
        },
        'A typical write path: the engine reads the current table state, writes new data files to object storage, constructs new metadata (a new snapshot referencing the new manifest list), then sends a commit request to the catalog.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Simplified REST catalog commit flow\nasync function commitTable(catalog, ns, table, token, updates, requirements) {\n  // updates: array of TableUpdate objects\n  //   e.g. { action: \'add-snapshot\', snapshot: { ... } },\n  //        { action: \'set-current-snapshot-id\', snapshot-id: 42 }\n  //\n  // requirements: array of TableRequirement objects\n  //   e.g. { type: \'assert-current-snapshot-id\', snapshot-id: 41 }\n  //   The catalog rejects the commit if any requirement is not met.\n\n  const resp = await fetch(\n    `${catalog}/v1/namespaces/${ns}/tables/${table}`,\n    { method: \'POST\',\n      headers: { Authorization: `Bearer ${token}`,\n                 \'Content-Type\': \'application/json\' },\n      body: JSON.stringify({ requirements, updates }) }\n  );\n\n  if (resp.status === 409) {\n    // CommitFailedException: base snapshot moved.\n    // Reload table, rebase changes, retry.\n    throw new Error(\'Conflict: table state advanced since last read\');\n  }\n  return resp.json(); // updated TableMetadata on success\n}',
        },
        {
          type: 'note',
          text: 'The commit request body separates requirements from updates. Requirements are preconditions the catalog checks against current state (assert-current-snapshot-id, assert-table-uuid, assert-ref-snapshot-id, assert-last-assigned-field-id, assert-default-spec-id, assert-default-sort-order-id). Updates are the mutations to apply (add-snapshot, set-current-snapshot-id, add-schema, set-default-spec, add-sort-order, set-properties, remove-properties, add-partition-spec, and more). This separation makes the protocol expressive: a schema change requires different assertions than an append, and the catalog can validate each independently.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The protocol works because it preserves Iceberg\'s layered separation of concerns while standardizing the one boundary that was previously ad hoc.',
        {
          type: 'diagram',
          label: 'Three-layer separation: catalog, metadata, storage',
          text: [
            '  Layer 1: Catalog (REST protocol)',
            '    Owns: name resolution, auth, credential vending, commit CAS',
            '    Does NOT own: scan planning, file format, query execution',
            '',
            '  Layer 2: Iceberg metadata (JSON + Avro)',
            '    Owns: snapshots, manifests, schemas, partition specs, delete files',
            '    Does NOT own: where metadata is stored, how it is found',
            '',
            '  Layer 3: Object storage (S3, GCS, ADLS, HDFS)',
            '    Owns: bytes, durability, throughput',
            '    Does NOT own: table semantics, access control decisions',
          ].join('\n'),
        },
        'Correctness argument: the catalog is a linearizable compare-and-swap register for each table\'s metadata pointer. The requirements array in a commit request is the "compare" half: if the current state matches all assertions, the updates are applied atomically and the pointer advances. If any assertion fails, the commit is rejected with a 409 and the engine must reload and retry. This is the same pattern as optimistic concurrency control in databases, applied at the metadata layer.',
        'HTTP is a practical compatibility boundary. OpenAPI defines the contract. Any language with an HTTP client can implement the engine side. Any backend that can store a pointer and enforce CAS can implement the service side. Network infrastructure -- load balancers, TLS termination, rate limiters, audit proxies -- slots in without protocol changes.',
        'Credential vending makes security compositional. The catalog knows the table, the user, and the storage location. It can vend S3 STS tokens scoped to the exact S3 prefix for that table, with a 15-minute expiry. The engine never sees the catalog\'s root IAM credentials. A compromised executor gets a token that expires before the incident response starts.',
        {
          type: 'bullets',
          items: [
            'Single metadata authority eliminates split-brain between engines. The catalog decides the current root; engines ask rather than assume.',
            'Engines decouple from catalog backends. Switching from Hive Metastore to a cloud-native catalog is a service-side change, invisible to Spark and Trino.',
            'The OpenAPI spec is versioned and testable. Implementations can be validated against the spec with automated conformance tests.',
            'Caching is protocol-aware. The catalog can set cache-control headers; the load-table response includes the metadata version; engines know when to refresh.',
          ],
        },
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The protocol adds one network round-trip per catalog operation compared to a direct-backend catalog. In practice, the dominant costs are:',
        {
          type: 'table',
          headers: ['Operation', 'Latency', 'Scaling behavior'],
          rows: [
            ['GET /v1/config', '1-5 ms', 'Once per session; cached until restart or TTL expiry'],
            ['POST /v1/oauth/tokens', '5-50 ms', 'Once per token lifetime (typically 30-60 min)'],
            ['GET .../tables/{table} (load)', '5-100 ms', 'Per table per session; cacheable with metadata version ETag'],
            ['POST .../tables/{table} (commit)', '10-500 ms', 'Per write transaction; contention adds retry latency'],
            ['Credential vending', '0 ms (piggybacks on load)', 'Credentials returned inline; refresh when expired'],
            ['Namespace listing', '5-50 ms', 'O(n) in namespace count; pagination supported'],
          ],
        },
        'Commit contention is the growth axis. With K concurrent writers on the same table, each commit has a (K-1)/K probability of conflict if the writers overlap in time. Each failed commit requires a reload (one GET), a rebase of the planned changes, and a retry (one POST). In the worst case, K writers serializing produces O(K^2) total commit attempts. In practice, append-only workloads rarely conflict because each writer adds new data files to a new snapshot without touching the same manifests.',
        {
          type: 'note',
          text: 'The protocol does not define retry backoff. Implementations typically use exponential backoff with jitter (50ms base, 2x multiplier, 5s cap). Without jitter, K writers can synchronize their retries and create a thundering-herd effect where conflict rate stays at 100% across retries.',
        },
        'Table load is the throughput axis. A large lakehouse with 10,000 tables and 50 engines starting simultaneously generates 500,000 load-table requests at startup. The catalog must handle this burst without degrading commit latency for writers. Caching (in the catalog service and in engines) is essential: load-table responses carry a metadata-location that changes only on commit, so a 304 Not Modified response with ETag validation can reduce catalog-side work to a hash comparison.',
        'Storage cost is unchanged. The REST catalog does not add data files, metadata files, or object storage operations beyond what Iceberg already requires. The catalog service itself needs a small backing store for the pointer (DynamoDB item, PostgreSQL row, or in-memory map for testing), not a copy of the table data.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Multi-engine lakehouses: Spark writes batch ETL, Trino serves interactive dashboards, Flink processes streaming appends, PyIceberg runs data-quality checks. All share one catalog endpoint. Adding a new engine (Dremio, StarRocks, DuckDB with Iceberg support) requires zero catalog-side changes.',
            'Cloud-managed catalogs: AWS Glue, Google BigLake, Snowflake Open Catalog (Polaris), Tabular, and Dremio Arctic expose REST catalog endpoints. Customers point engines at the endpoint and get managed metadata, commit coordination, and credential vending without operating catalog infrastructure.',
            'Platform migration: a company can move from Hive Metastore to a REST catalog by deploying a REST service that wraps or replaces the Metastore backend. Engines switch from HiveCatalog to RESTCatalog in config. Table data does not move. The migration is a control-plane swap, not a data migration.',
            'Security-sensitive environments: credential vending lets the catalog issue S3 STS tokens scoped to s3://bucket/warehouse/db/table/* with 15-minute expiry. Audit logs capture which user, which table, which credential, and which time window. Engines never hold long-lived storage keys.',
            'Catalog federation: a proxy REST catalog can route requests to different backend catalogs based on namespace. Production tables go to one service, staging tables to another, and the engine sees a unified namespace tree.',
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: '# Spark configuration to use a REST catalog\nspark.sql.catalog.my_catalog = org.apache.iceberg.spark.SparkCatalog\nspark.sql.catalog.my_catalog.type = rest\nspark.sql.catalog.my_catalog.uri = https://catalog.example.com\nspark.sql.catalog.my_catalog.credential = client_id:client_secret\nspark.sql.catalog.my_catalog.scope = catalog\nspark.sql.catalog.my_catalog.warehouse = s3://my-warehouse/',
        },
        'This is the entire engine-side configuration. The same four lines (type, uri, credential, warehouse) work for any REST catalog implementation. Compare this to HiveCatalog, which requires Hive Metastore Thrift URI, Hadoop configuration, AWS credential provider chain, and S3A filesystem settings -- each of which varies by deployment.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The protocol fails in predictable ways when implementations cut corners or when the operating model does not match the protocol assumptions.',
        {
          type: 'table',
          headers: ['Failure mode', 'Cause', 'Impact'],
          rows: [
            ['Silent lost updates', 'Catalog skips requirement validation on commit', 'Two writers both succeed; one snapshot overwrites the other; orphaned data files accumulate'],
            ['Cache incoherence', 'Engine caches metadata past its validity window', 'Queries return stale data; time-travel references wrong snapshot'],
            ['Credential over-scoping', 'Catalog vends bucket-wide credentials instead of prefix-scoped', 'Compromised executor can read/write all tables in the bucket'],
            ['Retry storms', 'No backoff or jitter on commit conflict retry', 'K writers synchronize retries; conflict rate stays 100%; catalog CPU spikes'],
            ['Orphan file growth', 'Writer creates data files, commit fails, no cleanup', 'Storage cost grows without bound; garbage collection jobs required'],
            ['Spec divergence', 'Catalog implements a subset of the OpenAPI spec', 'Engine feature X (views, register-table, multi-table commit) fails silently or with unhelpful errors'],
          ],
        },
        'Cache incoherence is the subtlest failure. The protocol returns metadata with a version identifier, but cache TTL is engine-configured. If Spark caches a table for 5 minutes and Trino caches for 30 seconds, they see different table states during the gap. The protocol does not mandate push-based invalidation; it relies on engines to reload before committing. A read-only engine with aggressive caching can serve stale results indefinitely without any error signal.',
        {
          type: 'note',
          text: 'Orphan files are the REST catalog\'s garbage collection problem. An engine writes data files to S3, then sends a commit. If the commit fails (conflict, timeout, crash), those files exist in storage but no metadata references them. The REST protocol does not define a cleanup contract. Production deployments need a separate orphan-file removal job (Iceberg\'s removeOrphanFiles action or a custom S3 lifecycle policy) to prevent unbounded storage growth.',
        },
        'The protocol also fails at the organizational boundary. A REST catalog is a service that must be operated: monitored, scaled, patched, backed up, and secured. Teams accustomed to a stateless Hive Metastore pointer sometimes underinvest in catalog service reliability. A catalog outage blocks all table loads and commits across all engines, making it a harder single point of failure than a metadata file in S3.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A data platform team runs 200 Iceberg tables on S3. Spark writes hourly batch ETL. Trino serves BI dashboards. A Python service runs data-quality checks. Before the REST catalog, each client uses a different integration: Spark uses GlueCatalog, Trino uses its own Glue connector, and PyIceberg uses a custom DynamoDB-backed catalog. Credential handling is inconsistent -- Spark uses instance profiles, Trino uses static IAM keys, and Python uses environment variables.',
        {
          type: 'diagram',
          label: 'Before: three engines, three catalog integrations, three credential paths',
          text: [
            '  Spark ----[GlueCatalog]-----> AWS Glue -----> metadata.json',
            '            [InstanceProfile]-> S3',
            '',
            '  Trino ----[GlueConnector]---> AWS Glue -----> metadata.json',
            '            [Static IAM key]-> S3',
            '',
            '  Python ---[DynamoDBCatalog]-> DynamoDB -----> metadata.json',
            '            [Env var keys]----> S3',
            '',
            '  Problem: 3 catalog plugins, 3 credential models, 3 retry strategies.',
            '  Incident: Trino reads snapshot 41, Spark commits snapshot 42,',
            '            Trino serves stale data for 5 minutes (cache TTL).',
          ].join('\n'),
        },
        'The team deploys a REST catalog service (Polaris or a custom implementation backed by DynamoDB for the pointer store and STS for credential vending). Migration steps:',
        {
          type: 'bullets',
          items: [
            'Deploy the REST catalog service behind an internal load balancer with TLS.',
            'Register existing tables by calling POST /v1/namespaces/{ns}/tables/register for each table, supplying the current metadata-location from Glue.',
            'Reconfigure Spark: change catalog type from glue to rest, set uri, credential, and warehouse. Remove GlueCatalog JAR and AWS credential provider config.',
            'Reconfigure Trino: same four config lines. Remove Glue connector config and static IAM key.',
            'Reconfigure Python: same four config lines. Remove DynamoDB catalog code and environment-variable credentials.',
            'Enable credential vending: catalog issues STS tokens scoped to s3://warehouse/{namespace}/{table}/* with 15-minute TTL.',
            'Set up orphan-file cleanup: daily Spark job running removeOrphanFiles on each table.',
          ],
        },
        {
          type: 'diagram',
          label: 'After: three engines, one REST client, one credential path',
          text: [
            '  Spark -----+',
            '  Trino -----+--> REST Client --> Catalog Service --> DynamoDB (pointer)',
            '  Python ----+      (HTTP)          |                     |',
            '                                    +--> STS (scoped creds)',
            '                                    +--> S3 (data files)',
            '',
            '  Result: 1 catalog integration, 1 credential model, 1 retry contract.',
            '  Trino cache TTL set to 10s; stale-read window drops from 5 min to 10s.',
            '  Static IAM keys eliminated; all storage access via 15-min STS tokens.',
          ].join('\n'),
        },
        'The improvement is not that HTTP made queries faster. Scan performance is unchanged -- engines still read Parquet from S3. The improvement is that metadata authority moved to one consistent boundary. Commits are validated by one service with one set of CAS rules. Credentials are vended by one service with one scoping policy. Adding a new engine (DuckDB, StarRocks) requires zero catalog-side changes.',
      ],
    },
    {
      heading: 'Commit safety deep dive',
      paragraphs: [
        'The commit protocol is the heart of the REST catalog. It is where correctness lives or dies.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Commit request body (simplified from the OpenAPI spec)\n{\n  "requirements": [\n    // Preconditions: catalog rejects commit if ANY fails\n    { "type": "assert-current-snapshot-id", "snapshot-id": 41 },\n    { "type": "assert-table-uuid", "uuid": "a1b2c3d4-..." },\n    { "type": "assert-ref-snapshot-id",\n      "ref": "main", "snapshot-id": 41 }\n  ],\n  "updates": [\n    // Mutations: applied atomically if all requirements pass\n    { "action": "add-snapshot",\n      "snapshot": { "snapshot-id": 42,\n        "manifest-list": "s3://wh/db/t/metadata/snap-42-manifests.avro",\n        "summary": { "operation": "append", "added-data-files": "3" } } },\n    { "action": "set-snapshot-ref",\n      "ref-name": "main", "type": "branch", "snapshot-id": 42 }\n  ]\n}',
        },
        'The catalog processes this request in three steps. First, it loads the current table state. Second, it evaluates each requirement against that state -- if the current snapshot is not 41, or the UUID does not match, the commit is rejected with 409 Conflict. Third, if all requirements pass, it applies the updates atomically and advances the metadata pointer.',
        {
          type: 'table',
          headers: ['Requirement type', 'What it asserts', 'Prevents'],
          rows: [
            ['assert-current-snapshot-id', 'Current snapshot matches expected', 'Lost updates from concurrent appends'],
            ['assert-table-uuid', 'Table identity matches', 'Commits to a dropped-and-recreated table with the same name'],
            ['assert-ref-snapshot-id', 'A named ref (branch/tag) points to expected snapshot', 'Branch-level conflicts in multi-branch tables'],
            ['assert-last-assigned-field-id', 'Schema field counter matches', 'Schema evolution races where two writers add columns'],
            ['assert-default-spec-id', 'Default partition spec matches', 'Partition spec changes racing with appends'],
            ['assert-default-sort-order-id', 'Default sort order matches', 'Sort order changes racing with writes'],
          ],
        },
        'Conflict resolution follows a reload-rebase-retry loop. On 409, the engine reloads the table to get the new base state, checks whether its planned changes are still valid against the new base (rebasing), and retries the commit with updated requirements. Append-only writes are easy to rebase: the new data files are still valid; only the snapshot parent changes. Schema changes are harder: if two writers both add a column, the second must check for name collisions and field-ID conflicts.',
        {
          type: 'note',
          text: 'The protocol supports server-side retry for non-conflicting operations. A catalog implementation can detect that two concurrent appends do not touch the same manifests, merge them server-side, and return success to both writers without forcing a client-side retry. This optimization is not required by the spec but dramatically reduces contention in high-throughput append workloads.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Iceberg REST Catalog OpenAPI specification -- https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml. This YAML file is the canonical protocol definition. Read the request/response schemas for UpdateTableRequest, TableRequirement, and TableUpdate.',
            'Table format reference: Iceberg Table Spec -- https://iceberg.apache.org/spec/. Defines snapshots, manifests, schemas, partition specs, and delete files that the catalog protocol coordinates.',
            'Implementation reference: Apache Polaris (incubating) -- an open-source REST catalog implementation backed by a relational database. Source at https://github.com/apache/polaris.',
            'Production case: Snowflake Open Catalog (built on Polaris) provides managed REST catalog endpoints for Snowflake customers using Iceberg tables with external engines.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Iceberg Table Format', 'Understand snapshots, manifests, and metadata.json before studying how the catalog manages the pointer to them'],
            ['Prerequisite', 'S3 Object Storage', 'The REST catalog vends credentials to object storage; understanding S3 consistency and IAM scoping is essential'],
            ['Extension', 'Apache Gravitino Federated Metadata Lake', 'Gravitino federates multiple catalogs (REST, Hive, JDBC) behind a unified metadata layer'],
            ['Extension', 'Project Nessie Transactional Catalog', 'Nessie adds Git-like branching and merging to catalog semantics -- a different take on multi-writer coordination'],
            ['Contrast', 'Hive Metastore', 'The predecessor catalog model; comparing Thrift pointer-store to REST protocol clarifies what the protocol adds'],
            ['Contrast', 'lakeFS Data Lake Version Graph', 'Repository-style versioning at the storage layer rather than the catalog layer'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you explain why a REST catalog is not just "Hive Metastore over HTTP"? (Hint: CAS commits, credential vending, and the requirements/updates split are the differences.)',
            'Can you trace a commit from engine to catalog and back, naming each requirement assertion and what it prevents?',
            'Can you describe what happens when two Spark jobs append to the same table at the same time -- which one retries, and why the retry is safe for appends but not for schema changes?',
            'Can you explain why orphan files accumulate and why the REST protocol cannot solve this by itself?',
            'Can you describe the security improvement of 15-minute STS tokens scoped to a table prefix versus long-lived IAM keys with bucket-wide access?',
          ],
        },
      ],
    },
  ],
};
