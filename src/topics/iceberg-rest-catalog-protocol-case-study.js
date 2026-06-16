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
      heading: 'What it is',
      paragraphs: [
        'Apache Iceberg REST Catalog is a standard protocol for managing Iceberg table metadata and catalog operations over a REST API. It gives engines a shared way to load tables, commit metadata changes, manage namespaces, and interact with catalog services.',
        'This topic links Iceberg Table Format Case Study, S3 Object Storage Case Study, Apache Gravitino Federated Metadata Lake Case Study, Project Nessie Transactional Catalog Case Study, and lakeFS Data Lake Version Graph Case Study. Those topics define table state and object storage; this topic explains the API boundary engines use to reach that state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An engine uses a REST client to bootstrap catalog configuration, authenticate, list namespaces, load table metadata, and send commit requests. The catalog service resolves names, checks permissions, returns table roots, and may vend credentials or sign storage requests.',
        'Commits are metadata-root changes. A writer proposes changes against a base table state. The catalog validates the base, applies the change atomically when safe, rejects conflicts when stale, and invalidates caches so readers see the correct table version.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The important structures are namespace identifiers, table identifiers, table metadata roots, snapshots, commit-change objects, OAuth or token context, credential-vending responses, error models, cache keys, and retry decisions.',
        'The protocol is not the table format itself. Iceberg metadata still defines snapshots, manifests, schemas, partitions, deletes, and files. The REST catalog is the control-plane interface that lets multiple engines discover and update those structures consistently.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Without a common protocol, every engine and language has to carry custom code for every catalog backend. The REST catalog reduces integration cost by making one client work across many catalog implementations.',
        'It also centralizes sensitive behavior. Authorization, credential vending, remote signing, metadata upgrade policy, caching, and multi-table features can live in the catalog service instead of being duplicated in every Spark, Trino, Flink, Python, or Rust client.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Catalog failures include stale metadata roots, lost updates, inconsistent authorization, credential leakage, cache invalidation bugs, retry storms, and unclear conflict errors. These failures are control-plane failures: the files may be fine while the table pointer is wrong.',
        'A good catalog implementation needs precise commit validation, idempotent request handling, bounded credentials, clear error codes, observability for commit latency and conflicts, and a recovery path for orphaned files created by failed writers.',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: Iceberg REST Catalog specification at https://iceberg.apache.org/rest-catalog-spec/ and Iceberg table specification at https://iceberg.apache.org/spec/.',
        'Study this with Apache Gravitino for a federated metadata service, Project Nessie for Git-like and cross-table catalog transactions, Iceberg Table Format for table metadata, and Substrait/DataFusion/Velox for how engines can consume lakehouse tables.',
      ],
    },
  ],
};
