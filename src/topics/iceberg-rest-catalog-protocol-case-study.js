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
      heading: 'The problem',
      paragraphs: [
        `Apache Iceberg gives analytical tables a reliable metadata structure over files: snapshots, manifests, schemas, partition specs, delete files, and a current metadata pointer. That solves the table-format problem, but it does not by itself solve the catalog integration problem. Engines still need to find tables, authenticate, load the current metadata root, commit changes, handle conflicts, and access object storage safely.`,
        `Without a common catalog protocol, every engine carries custom integrations for every catalog backend. Spark knows one path. Trino knows another. A Python client knows a third. A cloud catalog, a self-hosted catalog, and a governance service each need their own client behavior. The table format is open, but the control plane becomes fragmented.`,
        `The Iceberg REST Catalog protocol standardizes that boundary. It defines a REST-based API for catalog operations so engines can talk to different catalog implementations through one client surface. The files still live in object storage or another filesystem. Iceberg metadata still defines table state. The REST catalog is the control-plane API that lets engines discover and update that state consistently.`,
      ],
    },
    {
      heading: 'The naive wall',
      paragraphs: [
        `The naive catalog is a pointer store. Put table names in a database, store the path to the latest metadata JSON, and let engines read and write that pointer. This works in a small controlled environment, but the moment there are concurrent writers, cached readers, multiple engines, and real access control, the pointer store becomes a transaction system whether or not anyone designed it as one.`,
        `Another naive answer is to let each engine implement catalog semantics directly against the backend. That spreads subtle logic everywhere: how to retry a commit, how to detect a stale base, how to invalidate cached metadata, how to vend storage credentials, and how to map authorization failures into useful errors. Any mismatch can become lost updates, leaked credentials, or tables that appear different depending on the engine.`,
        `The wall is not HTTP mechanics. The wall is consistency at the metadata root. Iceberg data files are usually immutable, but the table's current state advances through metadata commits. If two writers both read snapshot 10 and try to create snapshot 11, the catalog must decide which change is valid, which must retry, and what readers should see.`,
      ],
    },
    {
      heading: 'Protocol model',
      paragraphs: [
        `The protocol model includes catalog configuration, namespaces, table identifiers, table metadata locations, view metadata where supported, commit requests, error responses, authentication context, and optional credential vending. Engines use the API to list namespaces, create or load tables, register existing tables, update properties, drop or rename objects, and commit table changes.`,
        `The key object is the table metadata root. Loading a table gives the engine enough information to read Iceberg metadata and plan scans. Committing a table change asks the catalog to move the current root from one known state to a new state, subject to validation. This is conceptually a compare-and-swap operation over table metadata, enriched with Iceberg-specific update and requirement objects.`,
        `Credential vending is a control-plane feature, not a table-format feature. A catalog can return short-lived, scoped credentials or signed access information so an engine can read and write data files without receiving broad storage permissions. This lets the catalog service become the place where identity, table access, and storage access are tied together.`,
      ],
    },
    {
      heading: 'Commit safety',
      paragraphs: [
        `Iceberg commits are safe when the writer's assumptions are still true. A writer reads a base table state, plans changes, writes any new metadata and data files needed, and sends a commit request that says, in effect, "apply these updates if the table still satisfies these requirements." The catalog checks the requirements and either advances the table or rejects the commit.`,
        `This protects against lost updates. If writer A appends files and writer B changes the schema at the same time, both cannot blindly replace the metadata root. The catalog must validate whether each change is compatible with the current state. Some conflicts can be retried after reloading the table. Others must fail because the planned update is no longer valid.`,
        `Commit safety also includes cleanup discipline. Writers may create data files before the metadata commit succeeds. If the commit fails, those files can become orphaned unless a cleanup process removes them. The catalog protocol can make the commit decision precise, but storage hygiene still requires operational jobs and clear failure handling.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The design works because it preserves Iceberg's separation of data files, table metadata, and catalog state. Object storage serves bytes. Iceberg metadata describes the table. The catalog resolves names, authorization, and the current root pointer. Each layer has a narrower job, which makes multi-engine access possible without turning every engine into a bespoke catalog implementation.`,
        `It also works because HTTP is a practical compatibility boundary. Engines in different languages can share one OpenAPI-defined protocol. Catalog vendors can implement the service side without asking every engine to embed a private client. Platform teams can put authentication, rate limits, audit logging, and network controls around one service endpoint.`,
        `The protocol does not remove the need to understand Iceberg internals. A catalog can tell an engine where the current metadata lives, but the engine still plans scans from snapshots, manifests, partition specs, delete files, and schema evolution rules. The REST catalog standardizes access to table state; it is not a replacement for the table format.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `The REST catalog wins in multi-engine lakehouses. Spark, Trino, Flink, Python, and other clients can share a catalog integration instead of carrying one-off adapters for every backend. That lowers the cost of adding a new engine or moving between catalog implementations.`,
        `It also wins when the catalog service needs to centralize sensitive behavior. Credential vending, table-level authorization, metadata policy, audit logging, and backend-specific commit handling are easier to control in one service than in every client process. This is especially important when engines run in many clusters or under many user identities.`,
        `A third winning case is platform evolution. A company can start with simple namespace and table loading, then add stronger authentication, scoped credentials, view support, caching rules, or governance integration behind the same protocol boundary. The client contract remains stable while the service implementation improves.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The protocol fails when implementations treat it as a thin file pointer API and skip commit validation. If the catalog does not reliably reject stale or incompatible commits, concurrent writers can lose table state even though all data files still exist. A wrong metadata root is enough to make a table incorrect.`,
        `It also fails through cache incoherence. Engines cache table metadata for performance. Catalogs cache backend state. Object stores have their own consistency and listing behavior. If invalidation and retry rules are unclear, one engine can read old state while another believes a commit has completed. Clear error codes and metadata refresh behavior are not polish; they are part of correctness.`,
        `Credential vending introduces another risk. Short-lived scoped credentials reduce blast radius, but only if scopes are tight, expiration is enforced, and logs do not leak secrets. A catalog that vends broad storage credentials has moved the security problem rather than solved it.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Measure table load latency, commit latency, commit conflict rate, retry success rate, cache hit rate, stale metadata incidents, credential-vending failures, authorization denials, orphan-file growth, and per-engine error patterns. High conflict rate may indicate too many writers touching the same table state. High retry storms may indicate poor backoff or long metadata refresh windows.`,
        `Test with concurrent writers, schema changes during appends, dropped tables with cached clients, expired credentials, network timeouts after file creation, and catalog restarts during commit. A REST catalog is healthy when engines see consistent table state and receive actionable failures under these conditions.`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `A platform team runs Iceberg tables in object storage. Spark writes hourly batch data. Trino serves dashboards. A Python service performs data quality checks. Before the REST catalog, each client has a different catalog integration and a different way to obtain storage credentials. Incidents are hard to debug because one engine's idea of the current table can lag another's.`,
        `The team deploys an Iceberg REST catalog service. Engines authenticate to the service, list namespaces, load table metadata roots, and request scoped credentials. Spark writers send commit requests against a base table state. The catalog validates requirements, advances the metadata root atomically, and returns conflict errors when a writer must reload and retry. Readers refresh cached metadata after commits according to the protocol and engine settings.`,
        `The improvement is not that HTTP made the data faster. The improvement is that metadata authority moved to a consistent boundary. Engines still read Parquet files from object storage and still understand Iceberg snapshots and manifests. The catalog coordinates names, access, credentials, and commits so the lakehouse can operate as a multi-engine system.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Iceberg REST Catalog specification at https://iceberg.apache.org/rest-catalog-spec/, Iceberg REST OpenAPI YAML at https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml, and Iceberg table specification at https://iceberg.apache.org/spec/.`,
        `Study this with Iceberg Table Format Case Study for snapshots and manifests, S3 Object Storage Case Study for immutable file storage, Apache Gravitino Federated Metadata Lake Case Study for broader governance, Project Nessie Transactional Catalog Case Study for Git-like catalog semantics, and lakeFS Data Lake Version Graph Case Study for repository-style data versioning.`,
      ],
    },
  ],
};
