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
      heading: 'What it is',
      paragraphs: [
        'Amazon S3 is an object storage service. It stores objects in buckets and addresses each object with a key. An object has bytes plus metadata, and applications use service APIs such as PUT, GET, HEAD, DELETE, and LIST.',
        'Object storage is a foundational system design primitive. Data lakes, backup systems, static sites, ML training corpora, event archives, log exports, and table formats such as Iceberg and Delta frequently use S3 as the durable byte layer.',
        'The key difference from a filesystem is that prefixes are part of object key names, not actual directories. Tools may show them as folders, but design decisions should treat keys as strings in a service namespace.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client writes an object to a bucket under a key. S3 stores the object and metadata, exposes strong read-after-write consistency, and lets clients list objects by prefix. Performance is achieved through parallel requests and scalable service-side partitioning.',
        'Lifecycle rules, versioning, storage classes, object tags, replication, and access policies define operational behavior around the object. Higher-level systems add their own metadata and transaction protocols on top of S3 objects.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'S3 is highly durable and scalable, but request patterns, object size distribution, prefix layout, lifecycle policy, and listing behavior still matter. Millions of tiny objects can be expensive to list and process. Huge objects may require ranged reads and S3 Multipart Upload Manifest-style state so one failed transfer part does not restart the whole upload.',
        'Strong object consistency does not turn object storage into a database. Multi-object transactions, secondary indexes, row-level updates, and query planning live in systems above S3, such as table formats, catalogs, and query engines.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'S3 is used for data lakes, warehouse external stages, backups, media storage, logs, ML datasets, website assets, table storage, disaster recovery, and cross-service interchange.',
        'A complete case study is a lakehouse table. Jobs upload Parquet files to partitioned prefixes. A table format commits metadata pointing at those files. Query engines list and read objects in parallel, while lifecycle rules transition old partitions to colder storage.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'S3 prefixes are not folders with POSIX rename semantics. Renaming a directory-shaped prefix means copying and deleting many objects. Also, object consistency does not remove the need for idempotent writes, manifest commits, versioning, or cleanup of orphan files.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: S3 strong consistency at https://aws.amazon.com/s3/consistency/, S3 user guide overview at https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html, performance guidance at https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html, and prefixes at https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html. Study S3 Multipart Upload Manifest, Reed-Solomon Erasure Coding, Ceph Erasure-Coded Pools, Parquet Columnar Format Case Study, Apache Iceberg Table Format Case Study, Delta Lake Case Study, Ceph CRUSH Placement Case Study, and Transactional Outbox next.',
      ],
    },
  ],
};
