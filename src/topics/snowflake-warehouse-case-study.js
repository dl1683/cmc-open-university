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
      heading: 'The cloud warehouse problem',
      paragraphs: [
        'Snowflake is a cloud data warehouse built around a multi-cluster shared-data architecture. Durable data lives in shared cloud storage. Compute runs in independent virtual warehouses. A cloud services layer handles metadata, optimization, transactions, security, and coordination. The design takes cloud object storage and elastic compute seriously instead of treating the cloud as rented hardware for a traditional database.',
        'The case study matters because it shows how cloud architecture changes database design. Cheap durable object storage, elastic compute, multi-tenancy, semi-structured data, time travel, and workload isolation become first-class constraints. The core question is: how do you let many compute clusters query the same governed data without copying the data into every cluster?',
      ],
    },
    {
      heading: 'The naive approaches and why they hurt',
      paragraphs: [
        'The first naive approach is a shared-nothing warehouse where storage and compute are tightly coupled. That can be fast, but scaling compute often means moving or rebalancing data. Workload isolation is hard because different teams contend for the same cluster. If one reporting workload consumes resources, another may suffer.',
        'The second naive approach is to copy data into separate clusters for isolation. That gives each team compute independence, but it creates duplication, governance problems, stale copies, and high storage cost. Every copy becomes another version to secure, catalog, and reconcile.',
        'The third naive approach is to keep data in object storage and let every query scan raw files naively. That gives cheap storage but poor performance. A warehouse still needs metadata, pruning, caching, transactions, optimization, and execution planning. Separating storage and compute is only useful if the metadata and execution layers make shared storage queryable.',
      ],
    },
    {
      heading: 'The core architecture',
      paragraphs: [
        'Clients submit SQL to cloud services. The optimizer plans the query and assigns work to a virtual warehouse. Warehouse workers scan shared storage, use local caches, exchange intermediate data, and return results. Multiple warehouses can access the same tables without sharing compute resources.',
        'Data is organized into immutable micro-partitions with metadata that helps pruning. If a query filters by date, region, or another column with useful clustering, the engine can skip micro-partitions that cannot match. This is the warehouse version of an index-like idea: metadata narrows the amount of data that compute must touch.',
        'The architecture separates storage and compute while keeping centralized metadata and transaction semantics. Shared storage provides one durable copy of data. Virtual warehouses provide elastic, isolated compute. Cloud services coordinate the catalog, security, query planning, and transactional visibility that make the shared data safe to use.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Snowflake works because object storage is durable and cheap enough to be the shared data layer, while compute can be provisioned separately for different workloads. One team can run a large batch warehouse. Another can run small interactive queries. The data does not need to be copied for every compute cluster.',
        'It also works because the metadata layer carries much of the intelligence. Micro-partition metadata, catalog state, statistics, transaction history, and access control let the optimizer turn shared files into a database. Without that layer, separated storage is just a pile of objects.',
        'The design gives workload isolation. Warehouses are not only performance knobs; they are concurrency and cost-control boundaries. A heavy ETL job can run on one warehouse while a dashboard runs on another. Both see the same governed data, but they do not have to fight for the same compute slots.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'Snowflake-style architecture supports analytics, ELT, dashboards, data sharing, semi-structured data exploration, ad hoc analysis, and mixed workloads where teams need independent compute over shared governed data. The pattern appears throughout modern cloud warehouses and lakehouse systems, even when the exact implementation differs.',
        'The design is especially valuable in organizations with many teams using the same data. Finance, product analytics, machine learning, security, and operations may all query overlapping tables. A shared-data architecture lets them share governance and storage while scaling compute independently.',
        'It also changes how users think about cost. In a coupled system, a cluster is always present. In an elastic warehouse, users can resize, suspend, resume, and isolate compute. That flexibility is powerful, but it requires discipline. Poorly sized warehouses, cold starts, weak pruning, and runaway queries still cost money.',
      ],
    },
    {
      heading: 'Costs and failure modes',
      paragraphs: [
        'Separating compute and storage does not make queries free. Bad micro-partition layout, weak pruning, huge shuffles, cold caches, and poor warehouse sizing still hurt. A query that scans too much data will be expensive no matter how elegant the architecture is.',
        'Metadata scale is another pressure. The optimizer depends on metadata to prune, plan, and enforce visibility. If metadata becomes stale, too coarse, or too expensive to consult, shared storage loses its performance advantage. A cloud warehouse is only as good as its metadata and execution layer.',
        'Governance can also become complex. Shared data means access control, lineage, masking, retention, and auditing matter. Compute isolation does not automatically imply policy isolation. The cloud services layer must make shared data safe, not merely fast.',
      ],
    },
    {
      heading: 'A worked query example',
      paragraphs: [
        'Suppose a dashboard queries one year of orders but filters to one region and one product family. A naive object-store scan reads every file for the year. A Snowflake-style warehouse uses micro-partition metadata to skip partitions whose min and max values cannot match. The warehouse scans fewer bytes, uses local cache where possible, and exchanges intermediate results across workers.',
        'Now suppose a data-engineering job is loading new data at the same time. The dashboard should see a consistent table version, not half of the load. This is where the cloud services layer matters: metadata and transaction semantics decide which files are visible to which query. The storage files alone do not provide that contract.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'A shared-data warehouse should be evaluated through bytes scanned, partition pruning rate, cache hit rate, warehouse utilization, queue time, spill volume, shuffle cost, query compilation time, and credit or compute spend by workload. These signals reveal whether decoupled compute is being used intelligently or merely hiding waste.',
        'Data layout deserves the same attention as compute size. Poor clustering can make pruning ineffective. Too many tiny files or partitions can make metadata heavy. Over-large partitions can reduce skipping precision. The warehouse works best when file layout, metadata, optimizer behavior, and warehouse sizing are tuned together.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Snowflake is a shared-data cloud warehouse: one governed storage layer, many independent compute warehouses, and a services layer that makes metadata, optimization, transactions, and security coherent. The architecture works because it treats object storage, metadata, and elastic compute as separate but coordinated parts.',
        'The deep lesson is that decoupling is not absence of design. Separating compute and storage makes the metadata layer more important, not less. Pruning, caching, transactions, and workload isolation are what turn cheap storage into a usable warehouse.',
        'The useful comparison is a traditional shared-nothing warehouse. Shared-nothing systems colocate data and compute for performance. Snowflake separates them for cloud elasticity and isolation, then relies on metadata, pruning, and caching to recover performance.',
        'In a course sequence, teach Snowflake after columnar storage and query planning, then compare it with Delta Lake and Iceberg. The shared theme is that modern analytics systems are metadata engines as much as execution engines.',
        'The practical test is whether teams need independent compute over the same governed data. If they do, shared-data architecture is compelling. If one tightly managed workload dominates, a simpler coupled system may be easier to tune.',
        'Snowflake is the wrong abstraction for low-latency per-row application state. It is built for analytic scans, aggregations, governed sharing, and elastic SQL workloads. Teaching that boundary prevents students from treating every storage system as a database-shaped answer to every problem.',
        'The best mental shortcut is "shared truth, separate engines." The shared storage and metadata define the truth; virtual warehouses give different teams independently scalable, separately billable engines for reading it without owning separate copies.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Snowflake SIGMOD PDF at https://info.snowflake.net/rs/252-RFO-227/images/Snowflake_SIGMOD.pdf, CMU mirror at https://www.cs.cmu.edu/~15721-f24/papers/Snowflake.pdf, and ACM DOI at https://dl.acm.org/doi/10.1145/2882903.2903741. Study Dremel Query Engine Case Study, Delta Lake Case Study, Database Indexing, Feature Store: Offline/Online Consistency, and FoundationDB Case Study next.',
      ],
    },
  ],
};
