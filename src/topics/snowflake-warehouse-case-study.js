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
      heading: 'What it is',
      paragraphs: [
        'Snowflake is a cloud data warehouse built around a multi-cluster shared-data architecture. Durable data lives in shared cloud storage, compute runs in independent virtual warehouses, and a cloud services layer handles metadata, optimization, transactions, and security.',
        'The case study matters because it shows how cloud architecture changes database design. Elastic compute, cheap object storage, multi-tenancy, semi-structured data, and time travel are first-class design constraints.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Clients submit SQL to cloud services. The optimizer plans the query and assigns work to a warehouse. Warehouse workers scan shared storage, use local caches, exchange intermediate data, and return results. Multiple warehouses can access the same tables without sharing compute resources.',
        'The architecture separates storage and compute while keeping centralized metadata and transaction semantics. That gives workload isolation and elastic scaling without copying table data for every cluster.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Shared-data warehouses must manage metadata scale, file pruning, local cache effectiveness, query planning, warehouse sizing, cold starts, shuffle cost, and governance. Separating compute from storage improves elasticity but makes query planning and data layout more important.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Snowflake-style architecture supports analytics, ELT, dashboards, data sharing, semi-structured data exploration, and mixed workloads where teams need independent compute over shared governed data.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Separating compute and storage does not make queries free. Bad file layout, weak pruning, huge shuffles, and cold caches still hurt. Another misconception is that warehouses are only performance knobs; they are also isolation, concurrency, and cost-control boundaries.',
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
