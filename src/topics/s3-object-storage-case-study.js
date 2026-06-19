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
        "Read the animation as the execution trace for S3 Object Storage Case Study. Object storage as a system design primitive: buckets hold immutable-ish objects by key, prefixes shape organization and throughput, and lifecycle rules manage data over time..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A local filesystem is built around directories, files, permissions, seeks, renames, and updates through an operating-system interface. That model is powerful on one machine or one mounted volume, but it is not the simplest abstraction for storing enormous amounts of durable data across a service boundary. Backups, logs, images, video, warehouse exports, training corpora, lakehouse tables, and static assets mostly need a different promise: put this blob under a name, keep it durably, let many clients fetch it, and let policy manage it over time.`,
        `Amazon S3 is the canonical object-storage example. It stores objects in buckets. Each object is addressed by a key, has bytes and metadata, and is accessed through APIs such as PUT, GET, HEAD, DELETE, and LIST. The application does not ask for disk blocks or inode numbers. It asks the service for object names and object bytes. That shift is why S3 became a foundation for data lakes, backup systems, ML datasets, static sites, event archives, media pipelines, and table formats such as Iceberg and Delta.`,
        `The key mental move is to stop treating S3 as a remote POSIX filesystem. Tools may display prefixes as folders, but a prefix is part of a key string. Renaming a "directory" shaped prefix usually means copying and deleting many objects. Appending to a file is not the natural operation. Atomic multi-file transactions are not built into the object API. S3 gives you durable named objects; higher-level systems build filesystem-like, database-like, and table-like behavior above that layer.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `A common early mistake is to design S3 keys as if they were ordinary mutable files in directories. The application writes ` + "`/customers/42/profile.json`" + `, later renames a whole directory, appends small records to one daily log object, and expects cheap directory metadata operations. That design collides with the object model. A key is one object name inside a bucket; the slashes are naming convention. LIST by prefix is a service operation, not a directory inode scan. Rewriting or moving object-shaped data is usually a new PUT, copy, delete, or multipart workflow.`,
        `The second mistake is to put database responsibilities into object storage without a protocol. A table may consist of thousands of Parquet files plus metadata. If a job writes the data files and crashes before publishing the new snapshot pointer, readers need to know which files are committed and which are orphaned. Strong consistency for object operations helps, but it does not by itself define a table transaction. Iceberg, Delta, Hudi, catalogs, manifests, and commit protocols exist because object storage needs a metadata layer above it for table correctness.`,
        `The third mistake is ignoring request economics. Millions of tiny objects are often awkward even if each object is durable. They increase request count, listing work, metadata overhead, and downstream scheduler overhead. One enormous object can be awkward too if consumers need only small ranges or if upload failure restarts too much work. Good object-storage design chooses object sizes, prefixes, partitioning, manifests, and lifecycle rules deliberately.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The top-level namespace is the bucket. Buckets carry ownership, access policy, region, lifecycle configuration, replication configuration, encryption defaults, logging, and other operational settings. Inside a bucket, the key is the object\'s name. The key may contain slash characters, date partitions, tenant IDs, table paths, or content hashes, but S3 treats it as an object key, not as a chain of directory objects in the POSIX sense.`,
        `The object is the unit of storage. It has bytes, system metadata, optional user metadata, tags, storage class, integrity checks, and possibly a version ID if versioning is enabled. Applications can read the whole object or request byte ranges. Large writes can use multipart upload so parts are transferred independently and later completed into one object. Lifecycle policies can transition objects to other storage classes or expire them based on age, prefixes, tags, and other conditions.`,
        `Consistency is part of the data model because clients build protocols on top of what reads and lists can see. AWS documents strong read-after-write consistency for S3 object PUT and DELETE behavior and strong consistency for relevant read operations such as GET, HEAD, and LIST in the current model. That removed many old client-side workarounds, but it did not remove the need for application-level commit protocols when one logical change spans many objects.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The object-namespace view shows the basic request path. A client sends PUT, GET, HEAD, DELETE, or LIST against a bucket and key or prefix. The bucket defines the namespace and policy. The key identifies one object. Service-side metadata lets S3 resolve the object and expose consistent reads after successful writes. The client does not know which storage nodes hold the bytes, how redundancy is implemented, or how metadata partitions are managed internally.`,
        `The prefix node is not a directory node; it is a design lever. Prefixes organize names for humans, lifecycle rules, access patterns, and parallel work. AWS performance guidance describes high request rates per partitioned prefix and encourages parallelization for higher throughput. That does not mean the application should randomly scatter names with no semantic structure. A good prefix layout balances query pruning, lifecycle management, tenant isolation, and request parallelism.`,
        `The lakehouse view separates byte storage from table truth. S3 stores raw events, Parquet data files, metadata files, manifests, and old snapshots as objects. The table format defines which files belong to the current table version, which schema applies, which deletes are active, and how readers discover a consistent snapshot. Query engines then issue many parallel GET or ranged GET requests against the object layer.`,
      ],
    },
    {
      heading: 'Why the design works',
      paragraphs: [
        `Object storage works because it avoids pretending that distributed durable storage is a local disk. The service interface is coarse-grained. Objects are named blobs. Metadata operations are explicit. Reads and writes cross a network boundary. That allows the storage service to scale capacity, durability, and request handling behind a relatively small API surface. Applications that can work with immutable or replace-by-new objects get a durable substrate without managing volumes, filesystems, or storage servers.`,
        `It also works because many higher-level systems are naturally append-and-publish. A logging pipeline writes new objects for each time partition. A backup system writes snapshots. A data lake writes new Parquet files and publishes metadata. A static site deploy writes content-addressed assets and updates references. A model-training pipeline stores datasets as sharded files. These systems rarely need byte-level overwrites in place; they need durable objects, listings, range reads, and policy.`,
        `The separation of concerns is the source of both power and confusion. S3 stores bytes and object metadata. Parquet stores columns and row groups. Iceberg or Delta stores table snapshots and commit metadata. A catalog stores table names and locations. A query engine plans and parallelizes reads. When those layers are respected, object storage is simple and scalable. When they are collapsed, applications reinvent weak databases on top of blobs.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The first tradeoff is mutability. Object storage is strongest when objects are written, read many times, and eventually replaced or expired. Workloads that need frequent small in-place updates, row-level transactions, low-latency random writes, directory renames, or file locking should use a database, block store, filesystem, or table layer built for that behavior. S3 can be part of those systems, but it is not the whole abstraction.`,
        `The second tradeoff is listing and cardinality. A prefix with huge numbers of objects may be expensive for humans and slow for jobs that repeatedly enumerate it. A table with too many small files can spend more time planning, listing, and opening objects than scanning useful data. Compaction, manifests, partition pruning, and sensible object sizes are not optional housekeeping; they are the difference between a healthy lake and a pile of expensive fragments.`,
        `The third tradeoff is commit semantics. A pipeline that writes ten thousand objects and then updates one manifest needs idempotent retries and cleanup. If the job crashes after writing data files but before committing metadata, those files may be durable but not logically part of the table. Versioning can help recovery. Checksums can help integrity. Lifecycle rules can help remove abandoned objects. None of those replace a clear commit protocol.`,
        `Security and governance are also central. Buckets need carefully scoped policies, encryption choices, public-access controls, logging, retention, and deletion rules. Object storage is often the long-term landing zone for sensitive data. A bad prefix convention can leak tenant structure; a bad policy can expose a bucket; a bad lifecycle rule can delete evidence too early or keep regulated data too long.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider an orders table in a lakehouse. An ingest job writes raw event objects under ` + "`raw/orders/yyyy/mm/dd/`" + `. A transformation job writes Parquet files under ` + "`tables/orders/data/`" + `, using object sizes large enough for efficient scans. The table format writes metadata files and manifests that describe the snapshot. Only after the metadata commit succeeds do readers treat the new Parquet files as part of the table.`,
        `A query engine does not scan the whole bucket. It asks the catalog for the current table metadata, reads manifests, prunes partitions and files, and then issues parallel ranged GET requests for the needed Parquet row groups. Old data files may remain because a previous snapshot still references them. Later, retention and compaction jobs remove unreferenced files or transition old partitions to cheaper storage. S3 is the durable byte layer; the table format is the correctness layer; the engine is the execution layer.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Amazon S3 user guide overview at https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html, S3 consistency details at https://aws.amazon.com/s3/consistency/, performance guidance at https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html, performance design patterns at https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance-design-patterns.html, and prefix documentation at https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html. Check current AWS docs before relying on specific request-rate guidance or feature behavior.`,
        `Next, study S3 Multipart Upload Manifest for large-object write state, Reed-Solomon Erasure Coding and Ceph Erasure-Coded Pools for durability mechanisms, Ceph CRUSH Placement for placement thinking, Parquet Columnar Format for analytic object contents, Delta Lake and Apache Iceberg style table metadata for multi-object transactions, Content-Addressed Merkle DAG Object Store for immutable naming, and Transactional Outbox for publishing durable state changes without losing track of what has been committed.`,
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for s3-object-storage-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
