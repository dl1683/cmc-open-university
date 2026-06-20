// Snowflake case study: multi-cluster shared-data warehouse architecture that
// separates cloud storage, virtual warehouses, and cloud services.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'snowflake-warehouse-case-study',
  title: 'Snowflake Warehouse Case Study',
  category: 'Papers',
  summary: 'Snowflake as the cloud-warehouse lesson: shared data, separate compute warehouses, cloud services, semi-structured data, and time travel.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shared-data architecture', 'elastic query execution'], defaultValue: 'shared-data architecture' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'SQL clients', x: 0.7, y: 3.8, note: 'queries' },
      { id: 'services', label: 'cloud services', x: 2.8, y: 3.8, note: 'metadata/optimizer' },
      { id: 'wh1', label: 'warehouse A', x: 5.0, y: 2.2, note: 'compute cluster' },
      { id: 'wh2', label: 'warehouse B', x: 5.0, y: 5.4, note: 'compute cluster' },
      { id: 'storage', label: 'shared storage', x: 7.5, y: 3.8, note: 'immutable files' },
      { id: 'cache1', label: 'local cache A', x: 7.2, y: 1.6, note: 'hot data' },
      { id: 'cache2', label: 'local cache B', x: 7.2, y: 6.0, note: 'hot data' },
    ],
    edges: [
      { id: 'e-client-services', from: 'client', to: 'services', weight: 'SQL' },
      { id: 'e-services-wh1', from: 'services', to: 'wh1', weight: 'plan' },
      { id: 'e-services-wh2', from: 'services', to: 'wh2', weight: 'plan' },
      { id: 'e-wh1-storage', from: 'wh1', to: 'storage', weight: 'read/write files' },
      { id: 'e-wh2-storage', from: 'wh2', to: 'storage', weight: 'read/write files' },
      { id: 'e-wh1-cache', from: 'wh1', to: 'cache1', weight: 'cache' },
      { id: 'e-wh2-cache', from: 'wh2', to: 'cache2', weight: 'cache' },
    ],
  }, { title });
}

function* sharedDataArchitecture() {
  yield {
    state: architecture('Snowflake separates storage, compute, and services'),
    highlight: { active: ['client', 'services', 'wh1', 'wh2', 'storage'], compare: ['cache1', 'cache2'] },
    explanation: 'Snowflake uses a multi-cluster shared-data architecture. Storage is centralized in cloud object storage, while independent virtual warehouses provide compute.',
  };

  yield {
    state: architecture('Warehouses share data without sharing compute'),
    highlight: { active: ['wh1', 'wh2', 'storage', 'e-wh1-storage', 'e-wh2-storage'], found: ['services'] },
    explanation: 'Two workloads can query the same tables from different warehouses. That isolates compute contention while keeping one shared data copy and one metadata/control plane.',
    invariant: 'Compute can scale independently from durable storage.',
  };

  yield {
    state: labelMatrix(
      'Cloud services layer',
      [
        { id: 'metadata', label: 'metadata' },
        { id: 'optimizer', label: 'optimizer' },
        { id: 'transactions', label: 'transactions' },
        { id: 'security', label: 'security' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'why', label: 'why centralized services help' },
      ],
      [
        ['table/file stats', 'all warehouses see same catalog'],
        ['query plans', 'shared planning logic'],
        ['snapshot state', 'consistent table versions'],
        ['auth and policy', 'single governance layer'],
      ],
    ),
    highlight: { found: ['metadata:why', 'transactions:why'], active: ['optimizer:job'] },
    explanation: 'The cloud services layer is the control plane: catalog, transactions, optimizer, security, and coordination. This connects directly to Delta Lake, Dremel, and FoundationDB.',
  };

  yield {
    state: labelMatrix(
      'Snowflake compared with adjacent systems',
      [
        { id: 'dremel', label: 'Dremel' },
        { id: 'delta', label: 'Delta Lake' },
        { id: 'snowflake', label: 'Snowflake' },
        { id: 'bigtable', label: 'Bigtable' },
      ],
      [
        { id: 'core', label: 'core move' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['serving tree over columns', 'interactive analytics'],
        ['table log over object storage', 'lakehouse tables'],
        ['shared storage plus elastic warehouses', 'cloud data warehouse'],
        ['sorted sparse map', 'operational storage'],
      ],
    ),
    highlight: { found: ['snowflake:core', 'snowflake:fit'], compare: ['dremel:core', 'delta:core'] },
    explanation: 'Snowflake is a clean cloud architecture case: decouple resources that cloud providers make elastic, then rebuild SQL warehouse semantics around that separation.',
  };
}

function* elasticQueryExecution() {
  yield {
    state: architecture('Scale a warehouse without moving table data'),
    highlight: { active: ['services', 'wh1', 'storage', 'e-services-wh1', 'e-wh1-storage'], compare: ['wh2'] },
    explanation: 'A warehouse can scale up, suspend, resume, or run beside another warehouse because durable data is not tied to the compute cluster. Local caches improve hot reads but are not the source of truth.',
  };

  yield {
    state: labelMatrix(
      'Query execution path',
      [
        { id: 'parse', label: 'parse' },
        { id: 'plan', label: 'plan' },
        { id: 'scan', label: 'scan files' },
        { id: 'exchange', label: 'exchange' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'owner', label: 'owner' },
        { id: 'cost', label: 'cost pressure' },
      ],
      [
        ['cloud services', 'metadata/catalog'],
        ['optimizer', 'stats quality'],
        ['warehouse workers', 'IO and pruning'],
        ['warehouse workers', 'shuffle/network'],
        ['client/services', 'latency'],
      ],
    ),
    highlight: { active: ['plan:owner', 'scan:owner', 'exchange:owner'], found: ['result:cost'] },
    explanation: 'The architecture separates planning from execution. Query cost still depends on pruning, file layout, local cache, network exchange, and warehouse size.',
  };

  yield {
    state: labelMatrix(
      'Cloud-native features come from architecture',
      [
        { id: 'elastic', label: 'elastic compute' },
        { id: 'availability', label: 'availability' },
        { id: 'semi', label: 'semi-structured data' },
        { id: 'travel', label: 'time travel' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['virtual warehouses', 'cold-start and cost control'],
        ['cloud storage durability', 'service dependency'],
        ['schema-on-read support', 'optimizer complexity'],
        ['snapshot metadata', 'retention cost'],
      ],
    ),
    highlight: { found: ['elastic:mechanism', 'travel:mechanism'], compare: ['semi:tradeoff'] },
    explanation: 'Elasticity, semi-structured support, and time travel are not bolt-ons. They are consequences of shared durable storage plus a transactional metadata plane.',
  };

  yield {
    state: architecture('The warehouse is a resource boundary'),
    highlight: { found: ['wh1', 'wh2'], active: ['services', 'storage'], compare: ['cache1', 'cache2'] },
    explanation: 'Virtual warehouses are not just clusters. They are isolation and billing boundaries. That is why the architecture supports heterogeneous workloads without copying all data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shared-data architecture') yield* sharedDataArchitecture();
  else if (view === 'elastic query execution') yield* elasticQueryExecution();
  else throw new InputError('Pick a Snowflake view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows Snowflake\'s three-layer architecture: SQL clients on the left, a cloud services node in the center, virtual warehouses branching right, and shared storage at the far right with per-warehouse local caches.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the components handling the current operation -- a query flowing from client through services to a warehouse.',
            'Compare marks show the relationship between two warehouses reading the same shared storage independently.',
            'Found marks are durable artifacts: metadata entries, cached micro-partitions, committed query plans.',
          ],
        },
        {
          type: 'note',
          text: 'Safe inference rule: if two warehouses both read shared storage but neither shares compute with the other, then scaling or suspending one warehouse cannot affect the latency or correctness of queries on the other.',
        },
        'The matrix views show the cloud services layer decomposed into its four responsibilities (metadata, optimizer, transactions, security) and the query execution pipeline decomposed into its five stages (parse, plan, scan, exchange, result). The "shared-data architecture" view focuses on structural separation; the "elastic query execution" view focuses on how a query flows through that structure.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Traditional data warehouses -- Teradata, Netezza, early Redshift -- couple storage and compute in a fixed cluster. Every node owns a slice of the data and runs queries against that slice. This works well at steady load. It breaks when the organization needs three things simultaneously: workload isolation between teams, elastic scaling of compute independent of data size, and a single governed copy of every table.',
        'By 2012, cloud object storage (S3, GCS, Azure Blob) had become durable, cheap ($0.023/GB/month), and effectively infinite. Compute instances could be provisioned in seconds. The economics had shifted: storing data was trivially cheap, but locking it inside a fixed cluster wasted the cloud\'s core advantage. The constraint was no longer "where do we put the bytes" but "how do we let many independent compute pools query the same bytes safely."',
        {
          type: 'quote',
          text: 'Existing "Big Data" platforms such as Hadoop or Spark are not mature enough for the needs of a large enterprise, and the traditional on-premise solutions are too inflexible and too expensive. We decided to build a completely new data warehousing system purpose-built for the cloud.',
          attribution: 'Dageville et al., "The Snowflake Elastic Data Warehouse," SIGMOD 2016, Section 1',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A shared-nothing warehouse partitions data across nodes. Each node stores its shard on local disk, indexes it, and executes queries against it. Teradata, Greenplum, and early Redshift all use this pattern. It gives excellent locality: the data and the CPU that needs it are on the same machine, so scans avoid network round trips.',
        'Shared-nothing works until you need to change the cluster. Adding nodes requires redistributing data across the new topology -- a process that can take hours on a multi-terabyte warehouse and degrades query performance during the rebalance. Removing nodes requires the same redistribution in reverse. Scaling compute to handle a spike means moving terabytes of data to new machines, then moving it back when the spike ends.',
        {
          type: 'diagram',
          text: 'Shared-nothing warehouse (Teradata/Redshift style):\n\n  Node 1: [shard A data] + [CPU] + [local disk]\n  Node 2: [shard B data] + [CPU] + [local disk]\n  Node 3: [shard C data] + [CPU] + [local disk]\n\n  To add Node 4:\n    1. Pick a new hash/range partitioning\n    2. Redistribute shards A, B, C across 4 nodes\n    3. Queries blocked or degraded during redistribution\n\nShared-data warehouse (Snowflake style):\n\n  Shared storage: [all data as immutable files]\n  Warehouse X: [CPU pool] --reads--> shared storage\n  Warehouse Y: [CPU pool] --reads--> shared storage\n\n  To add Warehouse Z:\n    1. Provision new compute nodes\n    2. Z reads shared storage immediately\n    3. No data movement required',
          label: 'Why shared-nothing clusters resist elastic scaling',
        },
        'The second obvious attempt is to copy the data. Give each team its own cluster with its own copy of the tables it needs. This solves isolation but creates a governance nightmare: five copies of the orders table, each at a different freshness, each with its own access controls, each costing full storage. When the schema changes, every copy must be updated. When a compliance audit asks "who accessed this data," the answer spans five separate systems.',
        'The third attempt is raw object storage with a query engine bolted on top -- early Hive on HDFS, or Presto over S3. Storage is shared and cheap, but every query does a full scan because there is no metadata layer to tell the engine which files are relevant. A query that needs 50 MB of data from a 500 GB table reads all 500 GB. Without statistics, pruning, caching, and transaction semantics, separated storage is just a slow file system.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a trilemma. Traditional architectures can achieve any two of these three properties but not all three:',
        {
          type: 'table',
          headers: ['Property', 'Shared-nothing', 'Copy-per-team', 'Raw object store'],
          rows: [
            ['Workload isolation', 'No -- teams share the cluster', 'Yes -- separate clusters', 'Partial -- separate queries but shared IO bandwidth'],
            ['Elastic compute', 'No -- scaling requires data redistribution', 'No -- each copy is its own fixed cluster', 'Yes -- compute is stateless'],
            ['Single governed copy', 'Yes -- one cluster owns all data', 'No -- N copies, N governance boundaries', 'Yes -- one storage layer'],
          ],
        },
        'Shared-nothing gives governance and locality but locks compute to data. Copy-per-team gives isolation but explodes storage and governance costs. Raw object storage gives cheap shared data but has no intelligence layer to make queries fast.',
        {
          type: 'note',
          text: 'The invariant that must hold: every query sees exactly one consistent version of every table, regardless of which compute cluster runs it, and no compute cluster\'s scaling decision forces data movement or affects another cluster\'s performance.',
        },
        'Break this invariant and you get one of three failures: inconsistent reads (two warehouses see different table versions), scaling friction (adding compute requires moving data), or interference (one team\'s heavy job slows another team\'s dashboard).',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Snowflake\'s core move: if cloud object storage is durable, cheap, and elastic, make it the single source of truth for all table data, then build a stateless metadata-and-transaction layer that turns those raw files into a governed database. Compute becomes a pure resource pool that can be provisioned, scaled, suspended, and destroyed without touching a single byte of durable data.',
        {
          type: 'note',
          text: 'Core invariant: durable state lives exclusively in shared storage and the cloud services metadata layer. Virtual warehouses hold only ephemeral caches. Destroying a warehouse loses nothing. Creating a warehouse requires no data copy.',
        },
        'This is not just "put files in S3." The insight is that the metadata layer -- micro-partition statistics, table versioning, transaction state, access control -- is what makes separated storage behave like a database. Without that layer, you have Hive-on-S3: cheap, shared, and slow. With it, you have a warehouse that prunes, caches, transacts, and governs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Snowflake\'s architecture has three layers, each independently scalable and each serving a distinct role:',
        {
          type: 'table',
          headers: ['Layer', 'What it owns', 'Scaling unit', 'State lifetime'],
          rows: [
            ['Shared storage', 'Immutable columnar micro-partition files (PAX hybrid format), 50-500 MB each', 'Cloud object store (S3/GCS/Azure Blob) -- effectively infinite', 'Permanent until explicitly deleted'],
            ['Virtual warehouses', 'Ephemeral compute nodes that scan, filter, join, aggregate, and sort', 'T-shirt sizes (XS to 6XL), each doubling the node count', 'Ephemeral -- can be suspended and resumed in seconds'],
            ['Cloud services', 'Metadata catalog, query optimizer, transaction manager, access control, infrastructure manager', 'Shared multi-tenant service (Snowflake-operated)', 'Permanent -- the global brain of the system'],
          ],
        },
        'A query flows through the system in five stages:',
        {
          type: 'diagram',
          text: 'SQL client\n  |  (1) SQL text\n  v\nCloud Services\n  |  (2) Parse, authenticate, resolve metadata\n  |  (3) Optimize: use micro-partition min/max stats to prune\n  |      Generate execution plan with partition assignments\n  v\nVirtual Warehouse (assigned cluster)\n  |  (4) Workers scan micro-partitions from shared storage\n  |      Local SSD cache intercepts hot reads\n  |      Workers exchange intermediate results (shuffle)\n  |  (5) Final aggregation, return result to client\n  v\nResult',
          label: 'Query execution path through the three layers',
        },
        'Micro-partitions are the fundamental storage unit. Each micro-partition is an immutable, compressed, columnar file containing 50-500 MB of uncompressed data (typically 10-20 MB compressed). When data is loaded, Snowflake automatically partitions it into micro-partitions and records per-partition metadata: min/max values for every column, distinct value counts, null counts, and bloom filter membership. This metadata lives in the cloud services layer.',
        {
          type: 'code',
          language: 'text',
          text: 'Micro-partition metadata example:\n\n  Partition #4271:\n    rows: 12,847\n    columns:\n      order_date:  min=2024-03-01, max=2024-03-15\n      region:      min="APAC", max="EMEA" (3 distinct)\n      amount:      min=4.50, max=98712.00\n      product_id:  null_count=0, bloom_filter=<128 bytes>\n    size_compressed: 14.2 MB\n    size_raw: 187.4 MB',
        },
        'When the optimizer processes WHERE order_date = \'2024-07-01\' AND region = \'NA\', it checks each partition\'s metadata. Partition #4271 has order_date max of 2024-03-15 and region max of "EMEA" -- both predicates rule it out. The partition is pruned without reading a single byte from storage. On a well-clustered table, pruning can eliminate 95-99% of partitions, reducing a multi-terabyte scan to megabytes.',
        'Virtual warehouses are clusters of EC2/GCE/Azure VM instances. Each warehouse has a local SSD cache (the "local cache" nodes in the animation). When a worker reads a micro-partition for the first time, it fetches from object storage and caches the result on local SSD. Subsequent queries hitting the same partition read from cache at NVMe speed instead of network speed. The cache is LRU-evicted and purely opportunistic -- it is never the source of truth.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The architecture resolves the trilemma because each property maps to a different layer:',
        {
          type: 'bullets',
          items: [
            'Workload isolation: each team gets its own virtual warehouse. Warehouse A\'s heavy ETL batch cannot starve Warehouse B\'s interactive dashboards because they share no compute resources.',
            'Elastic compute: provisioning a new warehouse or resizing an existing one is a pure compute operation. No data moves. A warehouse can scale from 1 node to 128 nodes in under a minute.',
            'Single governed copy: all warehouses read from the same shared storage through the same metadata catalog and transaction manager. There is one schema, one access control policy, one audit trail.',
          ],
        },
        'Correctness comes from the transaction model. Snowflake uses snapshot isolation implemented through the cloud services layer. Every write creates new micro-partitions and atomically updates the metadata catalog to point to the new set. Reads see a consistent snapshot defined at query start time. Old micro-partitions are retained for time travel (default 1 day, configurable up to 90 days) and then garbage-collected.',
        {
          type: 'diagram',
          text: 'Table version progression (snapshot isolation via micro-partitions):\n\n  Version 1: [P1] [P2] [P3]\n  INSERT new rows:\n  Version 2: [P1] [P2] [P3] [P4]   <-- P4 is new, P1-P3 unchanged\n  UPDATE rows in P2:\n  Version 3: [P1] [P2\'] [P3] [P4]  <-- P2\' replaces P2 (new file)\n                                        P2 retained for time travel\n\n  Query at T=version 2 sees: P1, P2, P3, P4\n  Query at T=version 1 sees: P1, P2, P3\n  Both queries run concurrently without blocking.',
          label: 'Immutable micro-partitions enable lock-free snapshot isolation',
        },
        'This is the same copy-on-write pattern used by Delta Lake and Apache Iceberg, but Snowflake embeds it in a closed, managed service rather than exposing it as an open table format. The tradeoff: Snowflake handles all the complexity of compaction, garbage collection, and metadata consistency internally, but users cannot run non-Snowflake engines against the same storage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Snowflake charges separately for storage and compute, which makes costs transparent but requires active management:',
        {
          type: 'table',
          headers: ['Cost dimension', 'What drives it', 'Typical range'],
          rows: [
            ['Storage', 'Compressed data volume + time travel retention', '$23-40/TB/month (varies by cloud region)'],
            ['Compute (credits)', 'Warehouse size x active seconds', '1 credit/hour (XS) to 128 credits/hour (6XL)'],
            ['Cloud services', 'Metadata ops, query compilation, access control', 'Free up to 10% of daily compute; billed beyond that'],
            ['Data transfer', 'Cross-region or cross-cloud reads', '$0.02-0.09/GB depending on provider and region'],
          ],
        },
        'A query\'s cost is dominated by warehouse runtime, not data scanned. An XS warehouse (1 node) running for 60 seconds costs 1 credit x (60/3600) = 0.0167 credits. The same query on a 4XL warehouse (128 nodes) running for 2 seconds costs 128 x (2/3600) = 0.071 credits -- faster but 4x more expensive. The optimizer cannot make this tradeoff for you; warehouse sizing is an operational decision.',
        {
          type: 'note',
          text: 'The silent cost trap: auto-suspend and auto-resume make warehouses feel free, but every resume incurs a cold-start penalty (cache is cold, first queries scan from object storage at network speed). Frequent suspend/resume cycles can cost more in degraded query performance than keeping a small warehouse warm.',
        },
        'Pruning efficiency is the most important cost lever after warehouse sizing. A well-clustered table where queries filter on the clustering key can prune 99% of micro-partitions. The same table with random insertion order may prune nothing, forcing full scans. Snowflake offers automatic clustering (a background service that re-organizes micro-partitions by clustering key), but it consumes credits and is itself a cost to manage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An e-commerce company has 2 TB of order data spanning 3 years, stored in approximately 15,000 micro-partitions clustered by order_date. Three teams share this data:',
        {
          type: 'table',
          headers: ['Team', 'Warehouse', 'Workload', 'Schedule'],
          rows: [
            ['Data engineering', 'WH_ETL (Large, 8 nodes)', 'Nightly batch load of 50M new rows', '02:00-04:00 UTC, auto-suspend after'],
            ['Product analytics', 'WH_ANALYTICS (Medium, 4 nodes)', 'Ad hoc queries filtering by date + region', 'Business hours, auto-suspend after 10 min idle'],
            ['Executive dashboards', 'WH_DASH (X-Small, 1 node)', 'Cached summary queries refreshed every 15 min', '24/7, never suspended'],
          ],
        },
        'At 02:00, WH_ETL wakes and loads yesterday\'s 50M rows. The load creates approximately 400 new micro-partitions. The cloud services layer atomically updates the table metadata to include these partitions at a new version number. WH_DASH, which has been running summary queries all night, continues to see the pre-load snapshot until its next query starts. No lock, no contention, no visibility into the half-loaded state.',
        'At 09:15, an analyst on WH_ANALYTICS runs:',
        {
          type: 'code',
          language: 'text',
          text: 'SELECT region, SUM(amount)\nFROM orders\nWHERE order_date BETWEEN \'2024-06-01\' AND \'2024-06-30\'\n  AND product_family = \'electronics\'\nGROUP BY region;',
        },
        'The optimizer checks micro-partition metadata. Of 15,400 partitions (15,000 original + 400 new), only 420 have order_date ranges overlapping June 2024. Of those, bloom filter checks on product_family eliminate another 180. The query scans 240 partitions (~3.4 GB compressed) instead of the full 2 TB. WH_ANALYTICS\'s local SSD cache holds 60% of these partitions from yesterday\'s similar queries, so only 96 partitions (~1.4 GB) are fetched from S3.',
        'The query completes in 4 seconds on 4 nodes. The same query on WH_DASH (1 node, cold cache) would take roughly 14 seconds. On a shared-nothing warehouse, both teams would contend for the same cluster, and the nightly load would degrade morning query latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The shared-data architecture fits anywhere multiple teams need independent compute over governed data:',
        {
          type: 'bullets',
          items: [
            'Multi-team analytics: finance, product, marketing, and ML teams query overlapping tables without copying data or contending for compute.',
            'Data sharing and clean rooms: Snowflake\'s Secure Data Sharing lets an organization expose a read-only view of live tables to a partner, who queries it from their own warehouse. No ETL pipeline, no data copy, no staleness.',
            'Semi-structured data: Snowflake stores JSON, Avro, Parquet, and XML natively in the VARIANT column type. The optimizer extracts and prunes on nested fields, so event logs and API responses can be queried without pre-flattening into a rigid schema.',
            'Time travel and disaster recovery: because every write creates new immutable micro-partitions, Snowflake can reconstruct any table state within the retention window using SELECT ... AT(TIMESTAMP => ...). This is not a backup -- it is a metadata pointer to the old partition set.',
            'ELT over ETL: cheap storage and elastic compute make it practical to load raw data first and transform it inside the warehouse using SQL, rather than building a separate transformation pipeline before loading.',
          ],
        },
        'The pattern appears beyond Snowflake. Google BigQuery separates Dremel-style execution from Colossus storage. Databricks SQL Warehouses run Spark-on-Delta-Lake with a similar decoupled model. AWS Redshift Serverless added storage-compute separation in 2022. The shared-data idea is converging toward an industry default for cloud analytics.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Snowflake\'s architecture has specific failure modes, most of them silent:',
        {
          type: 'table',
          headers: ['Failure mode', 'Trigger', 'Symptom'],
          rows: [
            ['Scan amplification', 'Data not clustered on query filter columns', 'Query scans 100x more bytes than needed; high credit burn with slow results'],
            ['Cold cache penalty', 'Frequent warehouse suspend/resume or new warehouse', 'First queries after resume run 3-10x slower as cache refills from object storage'],
            ['Small-file problem', 'Many tiny loads (< 100 MB each) creating undersized micro-partitions', 'Metadata bloat, pruning overhead, poor compression ratios'],
            ['Warehouse queue starvation', 'Too many concurrent queries on an undersized warehouse', 'Queries queue instead of executing; latency spikes with no scan activity'],
            ['Runaway cost', 'Large warehouse left running without auto-suspend, or auto-clustering on a high-churn table', 'Credit burn continues with no active queries; clustering credits exceed query credits'],
            ['Cross-region latency', 'Warehouse in us-east-1 reading storage replicated to eu-west-1', 'Network latency dominates; 100 ms per micro-partition fetch vs. 5 ms same-region'],
          ],
        },
        {
          type: 'note',
          text: 'The most dangerous failure is invisible pruning regression. A table starts well-clustered, but months of incremental loads scatter new data across the key range. Pruning efficiency degrades from 98% to 40% gradually. Queries get slower and more expensive, but no alert fires because no single query fails. Monitoring partition_scanned / partition_total over time is the only defense.',
        },
        'Snowflake is the wrong tool for sub-millisecond point lookups (use a key-value store like DynamoDB or Redis), for streaming with sub-second latency (use Kafka plus Flink or a streaming database), for graph traversal (use a graph database or recursive SQL with caution), or for serving application state to a web backend (use PostgreSQL or a purpose-built OLTP system). It is built for analytic scans, aggregations, and governed batch/interactive SQL workloads.',
      ],
    },
    {
      heading: 'Snowflake vs. adjacent systems',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'Core architectural move', 'Storage model', 'Compute model', 'Best fit'],
          rows: [
            ['Snowflake', 'Shared storage + elastic virtual warehouses + cloud services metadata', 'Proprietary micro-partitions in cloud object store', 'Provisioned T-shirt-sized clusters, suspend/resume', 'Multi-team governed analytics with workload isolation'],
            ['BigQuery', 'Dremel serving tree + Colossus distributed storage', 'Capacitor columnar format in Colossus', 'Serverless (slots auto-allocated per query)', 'Serverless analytics with no cluster management'],
            ['Delta Lake + Databricks', 'Open table format (Parquet + transaction log) + Spark/Photon engine', 'Parquet files + Delta log in customer object store', 'Spark clusters or Databricks SQL Warehouses', 'Lakehouse: unify ML and SQL over open formats'],
            ['Redshift Serverless', 'Shared-nothing heritage + managed scaling + RA3 storage-compute split', 'Proprietary columnar in managed storage (S3-backed)', 'Serverless RPU pools, auto-scaling', 'AWS-native analytics for existing Redshift users'],
          ],
        },
        'The key differentiator is the control boundary. Snowflake is a fully managed closed system: users control warehouses and SQL, Snowflake controls storage format, metadata, optimization, and infrastructure. Delta Lake inverts this: the table format is open (Parquet + JSON log), users control their own object store, and multiple engines (Spark, Flink, Trino, Daft) can read the same tables. BigQuery eliminates cluster management entirely with serverless slot allocation. Each design resolves the storage-compute separation differently, with different tradeoffs in openness, cost predictability, and operational burden.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Dageville et al., "The Snowflake Elastic Data Warehouse," SIGMOD 2016 (ACM DOI: 10.1145/2882903.2903741)', 'The original system paper describing the three-layer architecture, micro-partitions, and virtual warehouses'],
            ['Snowflake SIGMOD PDF: info.snowflake.net/rs/252-RFO-227/images/Snowflake_SIGMOD.pdf', 'Direct PDF link to the same paper'],
            ['CMU 15-721 reading: cs.cmu.edu/~15721-f24/papers/Snowflake.pdf', 'Course mirror used in Andy Pavlo\'s advanced database systems class'],
            ['Snowflake documentation: docs.snowflake.com/en/user-guide/tables-clustering-micropartitions', 'Official documentation on micro-partitions, clustering, and pruning mechanics'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Database Indexing and columnar storage to understand why micro-partition metadata enables pruning without traditional indexes.',
            'Extension: study Delta Lake Case Study to compare Snowflake\'s closed micro-partition format with Delta\'s open Parquet + transaction log approach.',
            'Parallel: study Dremel Query Engine Case Study to see how BigQuery solves the same problem with a serving tree instead of provisioned warehouses.',
            'Deeper: study FoundationDB Case Study to understand the distributed metadata layer that underpins transactional consistency in systems like these.',
            'Application: study Feature Store: Offline/Online Consistency to see how warehouse-computed features must synchronize with low-latency serving stores.',
          ],
        },
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, make sure you understand columnar storage (why reading only needed columns matters for analytics), basic query optimization (predicate pushdown, partition pruning), and the difference between OLTP and OLAP workloads. These are the building blocks that make Snowflake\'s micro-partition design intelligible.',
        'After this topic, the natural path leads to Delta Lake (open table format alternative), Dremel/BigQuery (serverless alternative), or the broader lakehouse pattern where ML training and SQL analytics share the same governed storage layer.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you name the three layers and state what each one owns?',
            'Can you explain why destroying a virtual warehouse loses no data?',
            'Can you describe how micro-partition metadata enables pruning without a traditional index?',
            'Can you identify which cost dimension dominates a Snowflake bill and why?',
            'Can you explain why two warehouses reading the same table never interfere with each other?',
            'Can you name one workload where Snowflake is the wrong tool and explain what property it lacks?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Trace a query through the animation manually: start at the SQL client, follow the edge to cloud services (metadata lookup, pruning decision, plan generation), then to a virtual warehouse (scan from shared storage or local cache, exchange, aggregation), and back to the client. For each step, write down what state the step reads, what state it produces, and which layer owns that state.',
        'Then switch to the "elastic query execution" view and predict what happens when you add a second warehouse. Which nodes change? Which edges are added? What stays the same? If your prediction matches the animation, you understand the core invariant: shared storage, independent compute, centralized metadata.',
      ],
    },
  ],
};

