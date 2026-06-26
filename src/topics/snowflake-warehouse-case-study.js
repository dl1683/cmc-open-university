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
        'Read the graph as Snowflake split into three jobs. SQL clients send work to cloud services, cloud services choose a plan, virtual warehouses run the plan, and shared storage holds durable table files. Active nodes are doing work in the current frame, compare nodes show independent warehouses using the same data, and found nodes are state that survives the operation.',
        'The safe inference is that warehouse compute is disposable because durable state is elsewhere. A warehouse cache can speed a scan, but losing it does not lose a table. The animation is teaching a resource boundary, not just a product diagram.',
        {type:'callout', text:'Snowflake turns cloud object storage into the durable source of truth while virtual warehouses become disposable compute boundaries.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A data warehouse is a database built for analytical queries, usually scans, joins, and aggregations over large tables. Older shared-nothing warehouses stored a shard of data on each compute node. That worked when hardware was bought as one fixed cluster, but it made cloud elasticity hard to use.',
        'Cloud object storage changed the cost shape. Storing 100 TB once is cheaper than copying it for every team, while compute can appear and disappear by the hour. Snowflake exists to let many compute pools query one governed data copy without making every scaling decision move table bytes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is to keep storage and compute together. Put a slice of every table on each worker, run the query where the bytes live, and rebalance when the cluster changes. This gives good locality and a simple mental model.',
        'A second obvious design is to copy the warehouse for each team. Finance gets one cluster, product gets another, and machine learning gets a third. The teams stop fighting for CPU, but now the same orders table has several freshness levels, access policies, and bills.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that isolation, elasticity, and one governed copy pull against each other. A fixed shared-nothing cluster gives one copy but weak isolation. Copying data gives isolation but breaks governance. Raw object storage gives one copy and elastic compute, but it is only a pile of files until metadata, transactions, and pruning make it behave like a database.',
        'The missing invariant is that every query must see one consistent table version no matter which warehouse runs it. Scaling a warehouse must not require rewriting table layout, and one team load must not starve another team dashboard. If any part fails, the warehouse either loses correctness or loses cloud economics.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Snowflake makes durable table data live in shared cloud storage and makes virtual warehouses pure compute. The cloud services layer owns catalog metadata, transaction state, optimization, security, and infrastructure coordination. A warehouse can be created, resized, suspended, or destroyed because it does not own the durable table.',
        'This is not just files on object storage. Micro-partition metadata lets the optimizer skip files, snapshot metadata gives consistent versions, and access policy is checked before compute sees data. The architecture works because the control plane turns cheap storage into a database contract.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Snowflake stores table data as immutable micro-partitions, which are small columnar file groups with metadata such as min value, max value, null count, and distinct value hints. A virtual warehouse is a set of workers that scans those files, shuffles intermediate rows, and returns results. The local cache on a warehouse is a performance layer, not the source of truth.',
        'A query first reaches cloud services. The optimizer checks table metadata, prunes micro-partitions that cannot match the predicate, chooses a plan, and assigns work to a warehouse. The warehouse reads remaining files from shared storage or its cache, computes the result, and leaves durable state unchanged except for writes committed through the metadata layer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from separating immutable data files from versioned metadata. A write creates new micro-partitions and then commits a catalog update that points the table to a new version. Readers use a snapshot chosen at query start, so they see either the old version or the new version, not half of each.',
        'Isolation comes from the warehouse boundary. Two warehouses can read the same table version while sharing no CPU, memory, or local cache. If warehouse A is overloaded, warehouse B still has its own workers and only competes for shared storage and services under explicit service limits.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Snowflake cost behaves like two meters. Storage grows with compressed bytes and retention, while compute grows with warehouse size multiplied by running time. A 1-credit-per-hour warehouse running 12 minutes costs 0.2 credits; a 16-credit-per-hour warehouse running 2 minutes costs 0.53 credits, even though it may feel faster.',
        'The dominant hidden cost is wasted scanning. If pruning removes 98 percent of micro-partitions, a 10 TB table may require only 200 GB of compressed reads. If clustering decays and pruning removes only 20 percent, the same query reads 8 TB and burns compute while returning the same answer.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The architecture fits shared analytics inside a company. Dashboards, ad hoc SQL, batch transforms, data science, and partner sharing can use separate warehouses over the same governed tables. The useful access pattern is many readers and writers needing different compute sizes over one logical data estate.',
        'The same pattern appears in other cloud analytics systems. BigQuery separates execution from distributed storage, and lakehouse engines separate table logs from object storage files. Snowflake is the clean closed-system case where the user operates warehouses while the service owns file format, metadata, and optimization.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Snowflake is the wrong tool for sub-millisecond point lookup, high-frequency writes, serving application state, and streaming decisions that need second-level freshness. Those workloads need operational databases, caches, or stream processors. A warehouse is optimized for analytical scans and governed SQL, not request-path mutation.',
        'It also fails quietly when cost controls are weak. Warehouses left running, cold caches after constant suspend and resume, high-churn clustering, and cross-region data movement can erase the benefit of elasticity. The system makes compute easy to buy, so governance must include budgets, monitors, and query-shape review.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an orders table has 30,000 micro-partitions and 6 TB compressed data. A query asks for June 2026 orders in the Northeast region. Metadata shows that 900 partitions overlap June, and region statistics remove 540 of those, leaving 360 partitions and about 72 GB to scan.',
        'An analyst runs this on a medium warehouse that costs 4 credits per hour and finishes in 45 seconds. The compute bill is 4 * 45 / 3600 = 0.05 credits. If poor clustering left 12,000 partitions eligible, the same warehouse might scan 2.4 TB, run for 15 minutes, and cost 1 credit while producing the same rows.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Dageville et al., The Snowflake Elastic Data Warehouse, SIGMOD 2016, and the Snowflake documentation on micro-partitions and clustering. Read them for the architecture boundary: shared data, independent warehouses, and cloud services metadata. Treat current pricing, retention limits, and feature names as live product facts that should be checked in official docs.',
        'Study columnar storage, predicate pushdown, transaction isolation, Delta Lake, Dremel, and cloud object storage next. The useful path is to compare how each system makes data layout, metadata, and compute scheduling cooperate.',
      ],
    },
  ],
};

