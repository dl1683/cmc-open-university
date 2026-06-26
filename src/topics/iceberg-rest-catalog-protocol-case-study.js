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
        'Read the animation as a control-plane boundary around Iceberg table metadata. Active nodes are the engine, catalog service, metadata root, or storage credential currently being used; visited nodes are earlier protocol steps; found nodes are the current table metadata and scoped file access. A safe inference is that engines do not advance table state directly; they ask the catalog to validate and commit metadata changes.',
        {type:'callout', text:'The REST catalog turns table metadata authority into one protocol boundary so engines ask for safe commits and scoped access instead of embedding catalog logic.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Apache Iceberg stores analytical table state in metadata files: snapshots, manifests, schemas, partition specs, and delete files. Engines still need a way to find a table by name, load the current metadata root, commit a new root safely, and obtain credentials for the underlying object storage. Without a common protocol, every engine has to learn every catalog backend.',
      'The REST catalog exists to collapse that integration matrix. Spark, Trino, Flink, and PyIceberg can implement one HTTP client, while catalog backends implement one service surface. The table data still lives in S3, GCS, ADLS, HDFS, or another store; the REST catalog standardizes the authority around metadata and access.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a pointer store. Put table names in Hive Metastore, DynamoDB, PostgreSQL, or a cloud catalog, and store the path to the latest metadata file. Engines read the pointer, load metadata, write new files, and update the pointer when they commit.',
      'That approach works inside one engine family and one operational environment. A Spark-only platform with Hive Metastore can run for years this way. The design is reasonable because Iceberg data files are immutable and table state advances by changing a metadata pointer.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that pointer updates must be conditional, not blind assignment. If two writers both read snapshot 41 and both try to create snapshot 42, one commit must lose or retry. A catalog that simply overwrites the metadata path can orphan data files or hide one writer work.',
      'The second wall is security delegation. Knowing where a Parquet file lives is not the same as having safe access to it. If every engine ships its own long-lived storage credentials, a compromised executor can gain broader access than the table operation required.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'A catalog is not only a name-to-pointer map. It is a metadata transaction coordinator, credential authority, and namespace service behind one protocol boundary. Engines ask it to load state, validate requirements, apply updates, and vend scoped credentials.',
      'The invariant is that the catalog is the authority for the current metadata root of each table. A commit request contains requirements, which are preconditions about current state, and updates, which are mutations to apply if the requirements hold. That split turns a commit into compare-and-swap rather than assignment.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A read path usually starts with catalog configuration and authentication, then a load-table request for namespace and table name. The response returns the current metadata location, table metadata, and optional scoped storage credentials. The engine uses Iceberg metadata to plan scans and then reads data files directly from object storage.',
      'A write path starts from a loaded table state. The engine writes new data or delete files, builds new Iceberg metadata, and sends a commit request with requirements such as expected current snapshot id or table uuid. If the catalog current state differs, it returns a conflict and the engine reloads, rebases, and retries.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is optimistic concurrency control at the metadata root. The catalog checks every requirement against current state before applying updates atomically. If any requirement fails, the commit does not become visible, so two writers cannot both advance from the same base as if the other did not exist.',
      'Credential vending works because the catalog sees the user, table, storage location, and operation. It can issue short-lived credentials scoped to one table prefix instead of exposing a broad storage role to every engine process. The engine gets enough authority to do the scan or write, not the catalog root authority.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The protocol adds network round trips for catalog operations. A table load might cost 5 to 100 ms, while a commit might cost 10 to 500 ms depending on backend latency and contention. Query scan cost is usually unchanged because engines still read Parquet, ORC, or Avro files from object storage.',
      'Contention is the expensive behavior. With 10 writers committing to the same table at the same time, conflicts can force reload and retry loops. Backoff with jitter matters because synchronized retries can keep all writers colliding even when each individual commit is small.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'REST catalogs fit multi-engine lakehouses. Spark can write ETL, Trino can serve dashboards, Flink can append streaming data, and Python can run quality checks through the same catalog endpoint. Adding a new engine no longer requires building a backend-specific plugin for every catalog.',
      'They also fit cloud-managed and security-sensitive platforms. A managed catalog can centralize auditing, commit validation, and credential vending while leaving table files in customer storage. A migration from Hive Metastore to REST catalog can be a control-plane migration rather than a data-file rewrite.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails if the service skips requirement validation. At that point REST is only a transport wrapper around unsafe pointer assignment, and lost updates can still occur. It also fails when engines cache table metadata too long and serve stale reads or try commits from stale bases.',
      'It can become a single point of failure. If the catalog service is down, engines cannot reliably load or commit tables even though data files still exist in object storage. Production deployments need monitoring, backups, rate limits, latency SLOs, and clear behavior for credential expiry.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A platform has 200 Iceberg tables on S3. Spark uses GlueCatalog, Trino uses a separate Glue connector, and a Python service uses custom DynamoDB code; each path has different credentials and retry behavior. Trino caches snapshot 41 for 5 minutes while Spark commits snapshot 42, so dashboards can read stale state until cache expiry.',
      'After migration, all three engines call a REST catalog. A commit from Spark asserts current snapshot 41 and proposes snapshot 42; if another writer already advanced the table, the catalog returns conflict. Storage credentials are vended as 15-minute tokens scoped to s3://warehouse/db/table, and Trino cache TTL drops to 10 seconds, so stale-read exposure and credential blast radius both shrink.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources are the Iceberg REST Catalog OpenAPI specification, the Iceberg table spec, and implementation references such as Apache Polaris. Study Iceberg snapshots and manifests first, then optimistic concurrency control, S3 object storage credentials, Project Nessie, Apache Gravitino, and Hive Metastore. The key comparison is whether metadata authority lives in client plugins or behind one checked protocol boundary.',
    ] },
  ],
};