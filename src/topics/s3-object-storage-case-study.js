// Amazon S3 object storage: buckets, keys, prefixes, consistency, lifecycle.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 's3-object-storage-case-study',
  title: 'S3 Object Storage Case Study',
  category: 'Systems',
  summary: 'Object storage as a system design primitive: buckets hold immutable-ish objects by key, prefixes shape organization and throughput, and lifecycle rules manage data over time.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['object namespace', 'lakehouse storage'], defaultValue: 'object namespace' },
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

function s3Graph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.6, note: 'PUT/GET/LIST' },
      { id: 'bucket', label: 'bucket', x: 2.6, y: 3.6, note: 'namespace' },
      { id: 'key', label: 'object key', x: 4.4, y: 2.0, note: 'prefix/name.parquet' },
      { id: 'object', label: 'object bytes', x: 6.4, y: 2.0, note: 'data + metadata' },
      { id: 'meta', label: 'metadata index', x: 4.4, y: 5.2, note: 'strong consistency' },
      { id: 'prefix', label: 'prefix partitioning', x: 6.4, y: 5.2, note: 'parallel request paths' },
      { id: 'lifecycle', label: 'lifecycle/retention', x: 8.7, y: 3.6, note: 'tiers and deletes' },
    ],
    edges: [
      { id: 'e-client-bucket', from: 'client', to: 'bucket', weight: 'request' },
      { id: 'e-bucket-key', from: 'bucket', to: 'key', weight: 'lookup key' },
      { id: 'e-key-object', from: 'key', to: 'object', weight: 'read/write bytes' },
      { id: 'e-key-meta', from: 'key', to: 'meta', weight: 'object metadata' },
      { id: 'e-key-prefix', from: 'key', to: 'prefix', weight: 'prefix route' },
      { id: 'e-object-life', from: 'object', to: 'lifecycle', weight: 'age/storage class' },
      { id: 'e-meta-life', from: 'meta', to: 'lifecycle', weight: 'rules' },
    ],
  }, { title });
}

function* objectNamespace() {
  yield {
    state: s3Graph('S3 exposes buckets and object keys, not filesystem blocks'),
    highlight: { active: ['client', 'bucket', 'key', 'object', 'e-client-bucket', 'e-bucket-key', 'e-key-object'], compare: ['prefix'] },
    explanation: 'S3 is object storage. A client addresses an object by bucket and key, then stores or retrieves the object bytes and metadata through service APIs.',
  };

  yield {
    state: labelMatrix(
      'Object key anatomy',
      [
        { id: 'bucket', label: 'bucket' },
        { id: 'prefix', label: 'logs/2026/06/13/' },
        { id: 'name', label: 'part-0001.parquet' },
        { id: 'version', label: 'version id' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'designImpact', label: 'design impact' },
      ],
      [
        ['top-level namespace', 'policy and ownership'],
        ['key prefix', 'organization and request scaling'],
        ['object name', 'data unit'],
        ['optional history', 'rollback and retention'],
      ],
    ),
    highlight: { found: ['prefix:designImpact', 'version:designImpact'], active: ['name:role'] },
    explanation: 'Prefixes feel like directories in tools, but the object key is one string. Good key design helps listing, lifecycle rules, partitioned datasets, and parallel reads.',
    invariant: 'The key uniquely identifies the object within a bucket.',
  };

  yield {
    state: s3Graph('Strong consistency makes PUT, GET, LIST easier to reason about'),
    highlight: { active: ['key', 'meta', 'object', 'e-key-meta'], found: ['client'] },
    explanation: 'S3 now provides strong read-after-write consistency for object PUT, DELETE, GET, HEAD, and LIST behavior described in the documentation, removing many old client-side consistency workarounds.',
  };

  yield {
    state: labelMatrix(
      'Object storage versus neighbors',
      [
        { id: 'filesystem', label: 'filesystem' },
        { id: 'block', label: 'block storage' },
        { id: 'object', label: 'object storage' },
        { id: 'database', label: 'database' },
      ],
      [
        { id: 'unit', label: 'unit' },
        { id: 'best' },
      ],
      [
        ['files/directories', 'POSIX-like access'],
        ['raw volumes', 'low-level disks'],
        ['objects by key', 'durable blobs and data lakes'],
        ['rows/documents', 'query and transactions'],
      ],
    ),
    highlight: { found: ['object:unit', 'object:best'], compare: ['database:best'] },
    explanation: 'S3 is not a database and not a mounted filesystem. It is a durable object API that many databases, lakehouses, backups, and ML systems build on top of.',
  };
}

function* lakehouseStorage() {
  yield {
    state: labelMatrix(
      'Lakehouse layout on S3',
      [
        { id: 'raw', label: 'raw/events/' },
        { id: 'table', label: 'tables/orders/' },
        { id: 'metadata', label: 'metadata/' },
        { id: 'manifest', label: 'manifest/list' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'consumer' },
      ],
      [
        ['landing files', 'ingest jobs'],
        ['Parquet data files', 'query engines'],
        ['Iceberg/Delta metadata', 'table format'],
        ['file lists', 'planner pruning'],
      ],
    ),
    highlight: { active: ['table:contains', 'metadata:contains', 'manifest:consumer'], found: ['raw:consumer'] },
    explanation: 'Modern lakehouses use S3 as the durable object layer while table formats such as Iceberg and Delta provide snapshots, manifests, schemas, and transaction metadata above it.',
  };

  yield {
    state: s3Graph('Prefixes support parallel reads and organized lifecycle rules'),
    highlight: { active: ['prefix', 'lifecycle', 'object', 'e-key-prefix', 'e-object-life'], compare: ['bucket'] },
    explanation: 'S3 performance guidance emphasizes parallel requests and prefixes. Lifecycle policies can transition or expire objects based on key patterns, tags, age, and storage class.',
    invariant: 'S3 stores objects; table correctness is usually enforced by metadata protocols above S3.',
  };

  yield {
    state: labelMatrix(
      'Failure and consistency boundaries',
      [
        { id: 'put', label: 'PUT object' },
        { id: 'list', label: 'LIST prefix' },
        { id: 'overwrite', label: 'overwrite/delete' },
        { id: 'commit', label: 'table commit' },
      ],
      [
        { id: 's3Guarantee', label: 'S3 guarantee' },
        { id: 'appConcern' },
      ],
      [
        ['strong read-after-write', 'retry idempotently'],
        ['strong list consistency', 'planner sees files'],
        ['strong consistency', 'versioning may matter'],
        ['external protocol', 'atomic metadata update'],
      ],
    ),
    highlight: { found: ['put:s3Guarantee', 'list:s3Guarantee'], compare: ['commit:appConcern'] },
    explanation: 'Strong object consistency does not by itself make a multi-file table transaction. The table format still needs an atomic commit protocol for metadata.',
  };

  yield {
    state: labelMatrix(
      'Complete analytics case study',
      [
        { id: 'ingest', label: 'upload data files' },
        { id: 'catalog', label: 'commit table metadata' },
        { id: 'query', label: 'query engine' },
        { id: 'lifecycle', label: 'lifecycle rule' },
      ],
      [
        { id: 's3Move', label: 'S3 move' },
        { id: 'lesson' },
      ],
      [
        ['PUT partitioned Parquet', 'durable object layer'],
        ['write snapshot pointer', 'table layer owns atomicity'],
        ['parallel GET ranges', 'throughput from concurrency'],
        ['transition old objects', 'cost managed by policy'],
      ],
    ),
    highlight: { found: ['ingest:lesson', 'query:lesson', 'lifecycle:lesson'], compare: ['catalog:lesson'] },
    explanation: 'The complete pattern is separation of concerns: S3 stores bytes durably; Parquet stores columns; Iceberg or Delta stores table truth; engines read in parallel.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'object namespace') yield* objectNamespace();
  else if (view === 'lakehouse storage') yield* lakehouseStorage();
  else throw new InputError('Pick an S3 object-storage view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a request moving through the S3 data model. A bucket is a namespace with policy and region settings, a key is the object name, and the object is bytes plus metadata.',
        'The slash in a key is only a character in a string. The console may render prefixes like folders, but the storage API works on named objects, not directories and inodes.',
        {type:'callout', text:'S3 owns durable named blobs; table, transaction, and filesystem semantics belong to layers above it.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A local filesystem is built around disks, directories, file handles, seeks, appends, renames, and in-place updates. That model is useful on one machine but awkward when thousands of clients need durable storage over a network.',
        'Object storage exists to simplify the remote storage contract. S3 lets clients put bytes under a key, get bytes by key, list keys by prefix, and attach metadata and policy without pretending the remote service is a mounted disk.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to treat S3 as a remote filesystem. Teams create folder-shaped prefixes, append to log objects, rename directories by moving keys, and expect listings to behave like directory reads.',
        'That approach feels natural because keys can contain slash characters. It works for small scripts but leaks when an operation that is O(1) on a filesystem becomes many object API calls.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is missing filesystem semantics. S3 has no atomic directory rename, no in-place append API for ordinary objects, no inode, and no multi-object transaction that makes 500 object writes appear as one commit.',
        'A second wall is request behavior. LIST is paginated, so listing 2,000,000 keys requires at least 2,000 list responses when each response returns 1,000 keys.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'S3 is a durable object key-value store, not a filesystem and not a database. The object layer owns named bytes and metadata, while table formats, catalogs, locks, and transaction protocols own higher-level meaning.',
        'This split is the reason data lakes use Parquet, Iceberg, Delta Lake, or Hudi above S3. S3 stores the files; the table layer decides which files are part of the current snapshot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A PUT writes an object body and metadata under a key in a bucket. A GET reads the body, a HEAD reads metadata, DELETE removes a key or creates a delete marker when versioning is enabled, and LIST scans key names by prefix.',
        'Large objects use multipart upload, where parts are uploaded under an upload ID and then committed as one object. Access control, lifecycle, versioning, replication, and storage class policy live around the object contract.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is scoped. After a successful PUT, S3 can serve the named object and its metadata according to its consistency model, but that does not imply a transaction over related objects.',
        'Systems stay correct when each layer owns only its own guarantee. If a table commit needs atomic snapshot visibility, the table metadata protocol must provide it instead of assuming S3 directory operations will do it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Object storage cost is not only dollars per GB-month. Request count, object size distribution, listing patterns, lifecycle transitions, replication, retrieval class, and multipart cleanup all affect behavior.',
        'A million 1 KB objects store about 1 GB of data but require a million PUT requests and many list pages. One 1 GB object has far fewer requests but cannot be partially updated without writing a replacement object.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'S3 fits data lakes, backups, static websites, media pipelines, model artifacts, logs, archives, and exchange files. These workloads mostly write whole objects and read them later by key or prefix.',
        'It is also useful as a durability layer below compute systems. Query engines, warehouse loaders, and training jobs can scale compute independently from storage because objects are reached through an API.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'S3 is the wrong abstraction for low-latency mutable records, random byte updates, POSIX file locking, high-frequency appends to one object, or transactions across many keys. A database, stream log, or filesystem may own those semantics better.',
        'It also fails when teams create too many tiny objects without understanding request and listing cost. The storage bill may look small while the request bill and job startup latency become the real problem.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A lakehouse job writes 500 Parquet files of 128 MB each, for about 64 GB of data. The files can be uploaded to S3 safely, but readers should not treat them as table data until the table metadata publishes a new snapshot.',
        'If the job crashes after writing 430 files, S3 did its job by storing those 430 objects. The table layer must prevent readers from seeing a half-written partition, and cleanup must later remove the orphan files.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Amazon S3 user guide at https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html, S3 consistency model at https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel, and multipart upload overview at https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html. Study multipart upload, object versioning, Parquet, Iceberg, Delta Lake, and distributed commit protocols next.',
      ],
    },
  ],
};
