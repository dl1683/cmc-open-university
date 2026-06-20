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
        'The object-namespace view traces one request through the S3 data model: client to bucket to key to object bytes, with metadata and prefix partitioning branching off the key. Active nodes are the current request path. Found nodes mark guarantees now in effect (strong consistency on metadata). The compare marker on the prefix node highlights the design lever most teams overlook.',
        'The lakehouse-storage view adds a second layer. Active nodes show where S3 stores bytes; compare nodes show where correctness actually lives (the table format, not the object API). At each frame, ask: which layer owns this guarantee, and what happens if that layer crashes mid-operation?',
        {type:'callout', text:'S3 owns durable named blobs; table, transaction, and filesystem semantics belong to layers above it.'},
        {
          type: 'note',
          text: 'The slash characters in S3 keys look like directory separators, but the animation treats the key as one flat string. Every "folder" you see in the AWS console is a rendering convention, not a stored directory object.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A POSIX filesystem gives you directories, inodes, permissions, seeks, renames, and in-place updates through an operating-system kernel. That model is powerful on one machine, but it ties storage to a volume, a mount point, and a host. When the requirement is to store petabytes of durable data accessible to thousands of concurrent clients across a network boundary, the filesystem abstraction becomes a liability. Renames are inode operations, not atomic over the network. Append is a byte-offset write, not an API call. Directory listings walk inode chains, not indexed metadata.',
        'Object storage replaces all of that with a simpler contract: put a blob under a name, get it back by name, list names by prefix, and let policy manage the rest. Amazon S3, launched in 2006, is the canonical implementation. It stores objects in buckets. Each object is addressed by a key (a UTF-8 string up to 1,024 bytes), has a body (up to 5 TiB), system metadata, optional user metadata, tags, and a storage class. The API surface is small: PUT, GET, HEAD, DELETE, LIST, plus multipart upload for large objects.',
        {
          type: 'quote',
          attribution: 'Werner Vogels, AWS re:Invent 2023',
          text: 'S3 stores over 350 trillion objects and handles an average of 100 million requests per second. It was designed to be the universal substrate -- not a filesystem, not a database, but the durable layer underneath both.',
        },
        'That shift -- from "storage is a mounted disk" to "storage is an API" -- is why S3 became the foundation for data lakes, backup systems, ML training corpora, static websites, event archives, media pipelines, and table formats like Iceberg and Delta Lake.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to treat S3 like a remote filesystem. Teams map their local directory layout onto key prefixes, write small JSON documents as mutable config files, rename "folders" by moving objects, append log lines to a single daily object, and expect cheap directory metadata operations.',
        {
          type: 'code',
          language: 'python',
          body: `# The filesystem-shaped approach: natural but wrong for object storage.
# "Rename a directory" requires copying every object and deleting the originals.
import boto3
s3 = boto3.client('s3')

def rename_prefix(bucket, old_prefix, new_prefix):
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket, Prefix=old_prefix):
        for obj in page.get('Contents', []):
            old_key = obj['Key']
            new_key = old_key.replace(old_prefix, new_prefix, 1)
            s3.copy_object(Bucket=bucket, CopySource={'Bucket': bucket, 'Key': old_key}, Key=new_key)
            s3.delete_object(Bucket=bucket, Key=old_key)
            # If crash happens here: some objects copied, some not. No rollback.`,
        },
        'This works for a handful of files. It breaks at scale for three reasons. First, there is no atomic rename -- the operation is a loop of copies and deletes, each a separate API call, with no transaction boundary. A crash mid-loop leaves the "directory" half-moved. Second, listing is not free: LIST returns up to 1,000 keys per call, so enumerating a million objects takes a thousand sequential API calls. Third, appending to an object is not a supported operation. Each "append" is a full re-upload of the object body, which is O(n) in object size.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Three failure modes expose the gap between the filesystem mental model and the object-storage data model.',
        {
          type: 'table',
          headers: ['Filesystem assumption', 'S3 reality', 'What breaks'],
          rows: [
            ['Rename is O(1) inode update', 'Rename is copy + delete per object', 'Moving a partition with 100K files costs 200K API calls and has no atomicity'],
            ['Append is a seek + write', 'No append API; must re-PUT the whole object', 'A 1 GiB daily log re-uploaded 1,000 times costs 1 PiB of transfer'],
            ['Directory listing reads inodes', 'LIST is a paginated prefix scan', 'Listing 10M objects under one prefix takes 10K sequential requests'],
            ['File locking prevents conflicts', 'No locking primitive', 'Concurrent writers overwrite each other; last PUT wins'],
          ],
        },
        'The deeper wall appears when teams try to build database-like behavior on top of raw object operations. A table may consist of 50,000 Parquet files plus metadata. An ETL job writes 500 new data files and then must atomically publish a new snapshot pointer. If the job crashes after writing the data files but before committing the metadata, readers must know which files are committed and which are orphans. S3 offers no multi-object transaction. The data files are durable but logically invisible until something above S3 says they exist.',
        'The third wall is request economics. A prefix containing 10 million 1 KiB objects stores only 10 GiB of data but requires 10 million PUT calls to write, 10 million GET calls to read, and thousands of LIST calls to enumerate. At $0.005 per 1,000 PUT requests and $0.0004 per 1,000 GET requests, the request cost dwarfs the storage cost. Meanwhile, one 10 GiB object is a single PUT and GET but cannot be partially updated and takes minutes to upload over a typical network.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'S3 is not a filesystem and not a database. It is a durable, flat key-value store for blobs, with three design levers: the bucket (namespace, policy, region), the key (one flat string, not a path), and the object (immutable bytes plus metadata). Everything else -- directories, tables, transactions, schemas, locking -- is built above this layer by other systems.',
        {
          type: 'diagram',
          alt: 'S3 layered architecture showing separation of concerns',
          label: 'The layer cake: each layer owns one guarantee',
          body: `Layer 4:  Query engine        (parallel reads, predicate pushdown)
Layer 3:  Table format        (Iceberg/Delta: snapshots, schema, transactions)
Layer 2:  File format          (Parquet/ORC: columns, row groups, compression)
Layer 1:  Object storage      (S3: durable named blobs, strong consistency)
Layer 0:  Physical storage    (erasure coding, replication, placement)`,
        },
        'The key insight is that S3 only owns Layer 1. It guarantees that a PUT object is durable (designed for 99.999999999% -- eleven nines -- of annual durability), that a GET after a successful PUT returns the new data (strong read-after-write consistency, announced December 2020), and that LIST reflects all completed writes. It does not guarantee multi-object atomicity, schema enforcement, or query planning. Those belong to layers above.',
        {
          type: 'note',
          text: 'Before December 2020, S3 offered only eventual consistency for overwrite PUTs and DELETEs. Applications needed client-side retries, version checks, and consistency wrappers. The strong-consistency upgrade eliminated an entire class of bugs, but it did not add transactions.',
        },
        'The object itself has a rich data model. System metadata includes Content-Type, Content-Length, ETag (MD5 for non-multipart uploads, opaque for multipart), Last-Modified, and storage class. User metadata is a set of key-value string pairs (up to 2 KiB total). Tags are separate key-value pairs (up to 10 per object) used for lifecycle rules, access policies, and cost allocation. Versioning, when enabled on the bucket, assigns each PUT a unique version ID so overwrites and deletes become recoverable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The animation traces two views of the same system.',
        'In the object-namespace view, a client sends a request (PUT, GET, HEAD, DELETE, or LIST) to a bucket. The bucket resolves the request against the key namespace. For PUT, S3 writes the object bytes to distributed storage, replicates for durability, updates the metadata index, and returns success only after the object is durable and consistent. For GET, S3 looks up the key in the metadata index, locates the object bytes, and streams them back. The client never knows which storage nodes hold the data, how many replicas exist, or how the metadata index is partitioned.',
        {
          type: 'code',
          language: 'python',
          body: `# The correct S3 mental model: objects are immutable blobs addressed by key.
# Write once, read many, eventually expire or replace.
import boto3, hashlib

s3 = boto3.client('s3')

# Write a Parquet file as an immutable object with a content-addressed key
data = open('orders-2026-06-15.parquet', 'rb').read()
content_hash = hashlib.sha256(data).hexdigest()[:16]
key = f'tables/orders/data/2026/06/15/part-0001-{content_hash}.parquet'

s3.put_object(
    Bucket='analytics-lake',
    Key=key,
    Body=data,
    ContentType='application/octet-stream',
    Metadata={'writer-job-id': 'etl-7842', 'schema-version': '3'},
    Tagging='tier=hot&dataset=orders'
)
# After this returns, any GET or LIST will see the new object.`,
        },
        'The prefix partitioning node in the animation highlights a performance lever. S3 automatically partitions keys by prefix to handle high request rates. AWS documentation states that S3 supports at least 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per partitioned prefix, with automatic scaling beyond that. A good prefix layout spreads requests across partitions. A bad layout (all keys sharing one prefix) can create a hot partition.',
        {
          type: 'table',
          headers: ['Key layout', 'Request distribution', 'Throughput behavior'],
          rows: [
            ['logs/2026/06/15/event-{uuid}.json', 'All writes to one date prefix', 'May throttle during high-ingest hours; S3 auto-scales but with lag'],
            ['logs/{hash-prefix}/2026/06/15/event-{uuid}.json', 'Writes spread across hash buckets', 'Immediate high throughput; harder to list by date'],
            ['tables/orders/data/part-{number}.parquet', 'Reads concentrated on one table prefix', 'Fine for analytics; query engines parallelize GETs anyway'],
          ],
        },
        'In the lakehouse view, the animation separates concerns. Raw event files land under raw/events/. A transformation job reads them, writes columnar Parquet files under tables/orders/data/, and then commits a metadata file (an Iceberg snapshot or Delta log entry) that lists exactly which data files belong to the current table version. Query engines read the metadata first, prune partitions and files, then issue parallel byte-range GETs against only the needed Parquet row groups.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness of object storage rests on three guarantees that compose cleanly.',
        {
          type: 'bullets',
          items: [
            'Durability guarantee: once PUT returns success, the object survives disk failures, rack failures, and availability-zone failures. S3 achieves this through erasure coding across multiple AZs (the exact scheme is internal, but the design target is 11 nines of annual durability -- losing one object per 10 billion stored per year).',
            'Consistency guarantee: after a successful PUT, any subsequent GET, HEAD, or LIST from any client sees the new object. After a successful DELETE, any subsequent GET returns 404. No stale reads, no missing list entries, no phantom objects. This is strong read-after-write consistency, not eventual.',
            'Isolation guarantee: each object operation (PUT, GET, DELETE) is atomic at the single-object level. A GET never returns a partial PUT. An overwrite PUT replaces the entire object, not a byte range. But there is no multi-object transaction -- two PUTs are two independent atomic operations.',
          ],
        },
        'These three guarantees are enough to build correct higher-level systems. A table format like Iceberg uses single-object atomicity to write data files, then uses a single atomic metadata commit (one PUT of a new metadata file, or an atomic pointer swap in a catalog) to make all those data files visible at once. The invariant is: readers only see files referenced by committed metadata. Orphan data files exist but are invisible to queries and cleaned up by garbage collection.',
        {
          type: 'note',
          text: 'The correctness argument for lakehouse transactions is: (1) data files are written but not yet visible, (2) one atomic metadata commit makes them visible, (3) readers always start from the latest committed metadata. If step 2 fails, step 1 is wasted work but not a correctness violation -- the table is still in its previous valid state.',
        },
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'S3 pricing has four dimensions, and teams that ignore any one of them get surprised.',
        {
          type: 'table',
          headers: ['Cost dimension', 'S3 Standard rate (us-east-1)', 'What drives it up'],
          rows: [
            ['Storage', '$0.023/GiB/month (first 50 TiB)', 'Keeping old snapshots, uncompacted small files, forgotten test data'],
            ['PUT/POST/COPY requests', '$0.005 per 1,000', 'Millions of tiny objects, frequent overwrites, un-batched writes'],
            ['GET/HEAD requests', '$0.0004 per 1,000', 'Full-table scans without partition pruning, repeated LIST calls'],
            ['Data transfer out', '$0.09/GiB (first 10 TiB)', 'Cross-region reads, large downloads, no CloudFront caching'],
          ],
        },
        'The practical cost behavior: storage is cheap, requests are expensive at high cardinality, and transfer is expensive at high volume. A data lake with 100 million 1 KiB objects (100 GiB total) pays $2.30/month in storage but paid $500 in PUT requests to create those objects. The same 100 GiB stored as 1,000 100 MiB Parquet files costs the same $2.30/month in storage but only $0.005 in PUT requests.',
        {
          type: 'note',
          text: 'Storage classes change the storage-vs-retrieval tradeoff. S3 Glacier Deep Archive cuts storage cost to $0.00099/GiB/month (23x cheaper than Standard) but charges $0.02 per 1,000 retrieval requests with 12-hour restore latency. Lifecycle rules automate transitions: keep objects in Standard for 30 days, move to Infrequent Access at 60, Glacier at 180, delete at 730.',
        },
        'Doubling the number of objects in a prefix roughly doubles the listing cost and request cost but does not change per-GiB storage cost. Doubling the size of each object doubles storage cost but does not change request cost. The sweet spot for analytics workloads is objects between 64 MiB and 1 GiB: large enough to amortize request overhead, small enough for parallel reads and reasonable retry cost on failure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Object storage appears wherever the workload is write-once-read-many with large blobs and policy-driven lifecycle.',
        {
          type: 'bullets',
          items: [
            'Data lakes and lakehouses: Databricks, Snowflake, Trino, Athena, and Spark all read Parquet/ORC files from S3. The table format (Iceberg, Delta, Hudi) adds transactions, schema evolution, and time travel above the object layer. S3 is the durable substrate; the table format is the brain.',
            'ML training pipelines: datasets are stored as sharded files (TFRecord, WebDataset, Parquet) on S3. Training jobs stream data with parallel GET requests. The same dataset can be read by hundreds of GPU nodes simultaneously without coordination because objects are immutable.',
            'Backup and disaster recovery: database snapshots, filesystem archives, and application backups land on S3 with versioning enabled. Cross-region replication copies objects to a second region automatically. Lifecycle rules expire old backups after a retention period.',
            'Static website and CDN origin: HTML, CSS, JavaScript, images, and fonts are stored as objects. CloudFront or another CDN caches them at edge locations. Deploys write new content-addressed objects and update a manifest -- the same pattern as lakehouse metadata commits.',
            'Log and event archives: application logs, audit trails, and clickstream events are written as time-partitioned objects. They are rarely read individually but must be durable for compliance. Lifecycle rules transition them to Glacier after 90 days.',
          ],
        },
        'The common thread: all these workloads produce immutable blobs, need high durability, tolerate API-level access (no POSIX), and benefit from policy-driven lifecycle management.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Object storage is the wrong tool when the workload needs what S3 explicitly does not provide.',
        {
          type: 'table',
          headers: ['Requirement', 'Why S3 fails', 'Use instead'],
          rows: [
            ['Low-latency random reads (<5 ms)', 'S3 GET latency is 50-200 ms for first byte', 'DynamoDB, Redis, EBS-backed database'],
            ['In-place byte-range updates', 'No partial write; must re-PUT the entire object', 'Block storage (EBS), database with row-level updates'],
            ['Atomic multi-object transactions', 'No multi-key transaction primitive', 'Database with ACID, or table format (Iceberg/Delta) above S3'],
            ['POSIX semantics (rename, append, lock)', 'No rename API, no append, no locking', 'EFS, FSx for Lustre, or local filesystem'],
            ['Real-time event streaming', 'PUT latency too high for per-event writes', 'Kafka, Kinesis, then batch to S3'],
          ],
        },
        'The "small files problem" deserves special attention. When an ingestion pipeline writes one object per event, it can accumulate millions of tiny objects. Each object is durable, but the aggregate is expensive to list, slow to scan, and wasteful in request cost. The fix is to batch events into larger objects upstream (write every 60 seconds or every 64 MiB, whichever comes first) and compact small files into larger ones periodically.',
        'Security failures are also common. A misconfigured bucket policy can expose sensitive data to the public internet. AWS added S3 Block Public Access in 2018 after a string of high-profile breaches (Capital One, Dow Jones, US Army intelligence files). The rule: enable Block Public Access at the account level, scope bucket policies to specific IAM principals, enable server-side encryption (SSE-S3 or SSE-KMS), enable access logging, and use S3 Object Lock for compliance holds.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A ride-sharing company stores trip data in a lakehouse on S3. Here is the concrete object layout and the operations at each stage.',
        {
          type: 'code',
          language: 'text',
          body: `Bucket: rideshare-analytics-prod

Key layout:
  raw/trips/2026/06/15/batch-001.json.gz       (landing zone, 50 MiB batches)
  raw/trips/2026/06/15/batch-002.json.gz
  tables/trips/data/city=seattle/2026-06-15/part-00001-abc123.parquet   (128 MiB)
  tables/trips/data/city=seattle/2026-06-15/part-00002-def456.parquet   (128 MiB)
  tables/trips/data/city=portland/2026-06-15/part-00001-789abc.parquet  (96 MiB)
  tables/trips/metadata/snap-00042-20260615T180000.avro   (Iceberg snapshot)
  tables/trips/metadata/snap-00041-20260614T180000.avro   (previous snapshot)

Lifecycle rules:
  raw/*           -> Glacier after 30 days, delete after 365 days
  tables/*/data/* -> Infrequent Access after 90 days
  tables/*/metadata/snap-* -> Keep all (small, needed for time travel)`,
        },
        'The ETL pipeline runs every hour. It lists new raw/ objects, reads them with parallel GETs, transforms trip records, writes Parquet files under tables/trips/data/ partitioned by city and date, and then writes a new Iceberg snapshot that references the new Parquet files plus all existing ones. The snapshot write is one PUT -- a single atomic object -- and that is the commit. Before the snapshot is written, the new Parquet files are invisible to query engines.',
        'An analyst runs a query: "average trip duration in Seattle last week." The query engine reads the latest Iceberg snapshot (one GET), parses the manifest list, prunes to city=seattle and dates 2026-06-08 through 2026-06-14, reads only those manifests (a few GETs), then issues parallel byte-range GETs for the duration column in each matching Parquet file. Out of 50,000 total Parquet files in the table, the engine touches maybe 200. Partition pruning and column pruning reduce I/O by orders of magnitude.',
        {
          type: 'note',
          text: 'The cost of this query: ~200 GET requests ($0.00008), ~2 GiB data scanned (no transfer cost if the engine runs in the same region). The cost of a full-table scan without pruning: ~50,000 GET requests ($0.02), ~500 GiB scanned. Good key design and table metadata pay for themselves on the first query.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Amazon S3 User Guide -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html. Covers the object model, consistency guarantees, performance guidance, storage classes, and security.',
            'Consistency announcement: "Amazon S3 Update: Strong Read-After-Write Consistency" (December 2020) -- https://aws.amazon.com/blogs/aws/amazon-s3-update-strong-read-after-write-consistency/. Explains the consistency model change and its implications.',
            'Performance guidance: S3 performance design patterns -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance-design-patterns.html. Documents request-rate scaling, prefix partitioning, and parallelization strategies.',
            'Durability deep dive: "Diving Deep on S3 Consistency" by Andy Warfield at re:Invent 2021, which describes the internal architecture enabling strong consistency without sacrificing throughput.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Reed-Solomon Erasure Coding', 'How S3 achieves eleven nines of durability without storing three full replicas'],
            ['Prerequisite', 'Consistent Hashing', 'How distributed storage systems place objects across nodes without central coordination'],
            ['Extension', 'Apache Iceberg Table Format', 'How snapshot metadata above S3 provides multi-object transactions, schema evolution, and time travel'],
            ['Extension', 'Parquet Columnar Format', 'How columnar file layout enables predicate pushdown and column pruning on object storage'],
            ['Contrast', 'Ceph RADOS Object Store', 'An open-source object store with different consistency and placement tradeoffs (CRUSH map vs S3 internal partitioning)'],
            ['Case study', 'Delta Lake Transaction Log', 'How a different table format solves the same multi-object commit problem with a JSON-based transaction log'],
          ],
        },
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        {
          type: 'note',
          text: 'This section is placed at both the beginning and end of the article. If you jumped here from the animation, start from the top for the full teaching arc.',
        },
        'Switch between the two views using the View control. The object-namespace view teaches the S3 data model: bucket, key, object, metadata, prefix partitioning, and lifecycle. The lakehouse-storage view teaches how real analytics systems layer table formats on top of S3. In both views, trace which layer owns which guarantee. S3 owns durability and single-object consistency. The table format owns multi-object transactions. The query engine owns parallel execution. Confusing these layers is the most common source of S3 design bugs.',
      ],
    },
  ],
};
