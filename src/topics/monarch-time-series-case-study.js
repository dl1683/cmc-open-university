// Monarch case study: regional in-memory time-series ingestion and querying
// with global query/configuration planes for planet-scale monitoring.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'monarch-time-series-case-study',
  title: 'Monarch Time Series Case Study',
  category: 'Papers',
  summary: 'Google Monarch as the monitoring-data lesson: regional ingestion, in-memory time series, global querying, and schematized metrics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['regional ingestion', 'global query and schema'], defaultValue: 'regional ingestion' },
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
      { id: 'tasks', label: 'tasks', x: 0.7, y: 3.8, note: 'export metrics' },
      { id: 'collector', label: 'collectors', x: 2.5, y: 3.8, note: 'scrape/push' },
      { id: 'regionA', label: 'region A', x: 4.6, y: 2.2, note: 'in-memory TS' },
      { id: 'regionB', label: 'region B', x: 4.6, y: 5.4, note: 'in-memory TS' },
      { id: 'globalQuery', label: 'global query', x: 7.0, y: 3.0, note: 'federates' },
      { id: 'config', label: 'config plane', x: 7.0, y: 5.4, note: 'schemas/rules' },
      { id: 'user', label: 'SRE/dashboard', x: 9.0, y: 3.8, note: 'alerts + queries' },
    ],
    edges: [
      { id: 'e-tasks-collector', from: 'tasks', to: 'collector', weight: 'metrics' },
      { id: 'e-collector-a', from: 'collector', to: 'regionA', weight: 'write' },
      { id: 'e-collector-b', from: 'collector', to: 'regionB', weight: 'write' },
      { id: 'e-a-query', from: 'regionA', to: 'globalQuery', weight: 'partial query' },
      { id: 'e-b-query', from: 'regionB', to: 'globalQuery', weight: 'partial query' },
      { id: 'e-config-a', from: 'config', to: 'regionA', weight: 'rules' },
      { id: 'e-config-b', from: 'config', to: 'regionB', weight: 'rules' },
      { id: 'e-query-user', from: 'globalQuery', to: 'user', weight: 'result' },
    ],
  }, { title });
}

function* regionalIngestion() {
  yield {
    state: architecture('Monarch regionalizes metric ingestion'),
    highlight: { active: ['tasks', 'collector', 'regionA', 'regionB', 'e-tasks-collector', 'e-collector-a', 'e-collector-b'], compare: ['globalQuery'] },
    explanation: 'Monarch is Google\'s planet-scale in-memory time-series database. Metrics are collected regionally so ingestion and storage scale with locality and failures do not require one global hot path.',
  };

  yield {
    state: labelMatrix(
      'A metric is more than a name and number',
      [
        { id: 'latency', label: 'rpc_latency' },
        { id: 'errors', label: 'rpc_errors' },
        { id: 'cpu', label: 'cpu_usage' },
        { id: 'quota', label: 'quota_used' },
      ],
      [
        { id: 'value', label: 'value type' },
        { id: 'labels', label: 'fields/labels' },
        { id: 'aggregation', label: 'aggregation' },
      ],
      [
        ['histogram', 'service, method, zone', 'percentiles'],
        ['counter', 'service, code', 'rate'],
        ['gauge', 'task, machine', 'latest/avg'],
        ['counter', 'tenant, product', 'sum/rate'],
      ],
    ),
    highlight: { found: ['latency:value', 'latency:aggregation'], active: ['errors:labels', 'quota:labels'] },
    explanation: 'Monarch uses a schematized data model. Labels and value types matter because monitoring queries need aggregation semantics, not just raw points.',
    invariant: 'A time series is identified by metric schema plus field values.',
  };

  yield {
    state: architecture('Regional storage keeps hot monitoring paths local'),
    highlight: { active: ['regionA', 'regionB', 'config', 'e-config-a', 'e-config-b'], found: ['collector'] },
    explanation: 'Configuration tells regions what to collect, retain, and aggregate. The system has to be reliable because SREs use it during incidents, when the monitored systems may already be unhealthy.',
  };

  yield {
    state: labelMatrix(
      'Monitoring database requirements',
      [
        { id: 'ingest', label: 'high ingest' },
        { id: 'query', label: 'interactive query' },
        { id: 'alerts', label: 'alerting' },
        { id: 'reliability', label: 'reliability' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'design', label: 'design response' },
      ],
      [
        ['many time series', 'regional ingestion'],
        ['dashboards during incidents', 'global query plane'],
        ['low-latency decisions', 'precompute and rule config'],
        ['must outlive failures', 'regional isolation'],
      ],
    ),
    highlight: { found: ['ingest:design', 'query:design', 'reliability:design'], active: ['alerts:pressure'] },
    explanation: 'Monarch is a strong case study because monitoring storage has a different failure standard: when everything else is failing, the monitoring database still has to answer.',
  };
}

function* globalQueryAndSchema() {
  yield {
    state: architecture('Global query fans out to regional stores'),
    highlight: { active: ['user', 'globalQuery', 'regionA', 'regionB', 'e-a-query', 'e-b-query', 'e-query-user'], compare: ['collector'] },
    explanation: 'A global query federates to regional stores, merges partial results, and returns one view. That lets users ask fleet-wide questions while keeping ingestion regional.',
  };

  yield {
    state: labelMatrix(
      'Example query plan',
      [
        { id: 'filter', label: 'filter' },
        { id: 'group', label: 'group' },
        { id: 'reduce', label: 'reduce' },
        { id: 'alert', label: 'alert' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'result', label: 'result' },
      ],
      [
        ['service=search, region=*', 'matching series'],
        ['by method and zone', 'labeled groups'],
        ['p99 latency over 5m', 'time series result'],
        ['p99 > threshold', 'page or ticket'],
      ],
    ),
    highlight: { active: ['filter:operation', 'group:operation', 'reduce:operation'], found: ['alert:result'] },
    explanation: 'The data model matters because queries group by fields, aggregate histograms, and feed alerting rules. A metric schema is a query contract.',
  };

  yield {
    state: labelMatrix(
      'Cardinality is the hidden systems cost',
      [
        { id: 'good', label: 'bounded labels' },
        { id: 'bad', label: 'request id label' },
        { id: 'tenant', label: 'tenant label' },
        { id: 'method', label: 'method label' },
      ],
      [
        { id: 'series_count', label: 'series count' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['service, method, zone', 'manageable'],
        ['unique per request', 'explodes storage'],
        ['many but meaningful', 'quota and isolation'],
        ['bounded enum', 'good aggregation'],
      ],
    ),
    highlight: { found: ['good:risk', 'method:risk'], removed: ['bad:risk'], compare: ['tenant:risk'] },
    explanation: 'Time-series databases live or die by cardinality. High-cardinality labels can overwhelm ingestion, memory, query fanout, and alerting.',
  };

  yield {
    state: labelMatrix(
      'How Monarch connects to the platform',
      [
        { id: 'trace', label: 'Dapper' },
        { id: 'tdigest', label: 't-digest' },
        { id: 'backpressure', label: 'Backpressure' },
        { id: 'dataflow', label: 'Dataflow' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'question', label: 'question answered' },
      ],
      [
        ['request paths', 'where did time go?'],
        ['quantile sketches', 'how bad is p99?'],
        ['ingest overload', 'are clients flooding us?'],
        ['streaming windows', 'what period does this metric mean?'],
      ],
    ),
    highlight: { found: ['trace:question', 'tdigest:question', 'dataflow:question'], active: ['backpressure:connection'] },
    explanation: 'Metrics, traces, and streams are complementary observability structures. Monarch shows the storage side of operational truth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'regional ingestion') yield* regionalIngestion();
  else if (view === 'global query and schema') yield* globalQueryAndSchema();
  else throw new InputError('Pick a Monarch view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Regional ingestion" shows the write path: tasks export metrics to collectors, collectors route data to regional storage, and a configuration plane pushes schemas and rules to each region. "Global query and schema" shows the read path: a global query plane federates across regions, merges partial results, and returns a unified answer to the SRE or dashboard.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current focus: a task exporting, a collector routing, or a region storing time series.',
            'Found marks identify durable design artifacts: schema fields, aggregation semantics, design responses to system pressures.',
            'Compare marks show the global query plane standing behind regional storage -- the read path that unifies what the write path separates.',
          ],
        },
        {
          type: 'note',
          text: 'Safe inference rule: if a metric schema defines a value type and aggregation semantics, then any query over that metric can be pushed down, merged across regions, and aggregated correctly without the query author knowing which zone holds the data.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'Monarch cannot use Spanner or Bigtable on the alerting path to avoid potentially dangerous circular dependency.',
          attribution: 'Adams et al., "Monarch: Google\'s Planet-Scale In-Memory Time Series Database," VLDB 2020, Section 1',
        },
        'Google runs roughly 400,000 Borg cluster tasks across 38 zones on five continents. Every task emits metrics -- CPU usage, RPC latency distributions, error counters, queue depths, quota consumption. The monitoring system that watches all of this cannot depend on the infrastructure it monitors. If Spanner goes down, the system that alerts on Spanner must still be running. That circular-dependency constraint forces monitoring into its own in-memory storage layer.',
        'The predecessor system, Borgmon, required each team to operate its own monitoring instance, manually shard large metric sets, and build ad-hoc query hierarchies. There was no unified schema, no first-class distribution type, and no automatic federation. As Google grew past billions of users and hundreds of thousands of tasks, Borgmon could not scale without proportional human effort.',
        {
          type: 'table',
          headers: ['Pressure', 'Scale (July 2019 production)'],
          rows: [
            ['Time series stored', '950 billion'],
            ['Ingestion rate', '~2.2 TB/s sustained, 4.4 TB/s peak'],
            ['Query throughput', '6 million queries/second'],
            ['Compressed memory footprint', '~750 TB across all zones'],
            ['Geographic zones', '38 zones, five continents'],
            ['Monitored tasks', '~400,000 Borg cluster tasks'],
          ],
        },
        'At this scale, monitoring is not a logging sidecar. It is infrastructure that must be as reliable as DNS and more available than the systems it watches.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is a single global metrics database. Every task sends every sample to one logical cluster, and every query reads from that cluster. This is how a small Prometheus installation works: one server ingests everything and answers every query. The appeal is simplicity -- one write path, one read path, one schema store.',
        {
          type: 'diagram',
          text: [
            'Approach 1 -- Single global store:',
            '',
            '  task-A ----\\                    /---- dashboard',
            '  task-B ------> [Global Store] <----- alerting',
            '  task-C ----/                    \\---- SRE query',
            '',
            'Problem: ingestion bottleneck, global failure boundary.',
            'If the store is down, ALL monitoring is down.',
          ].join('\n'),
          label: 'A single global store creates a single point of failure for the system that must never fail',
        },
        'The second attempt is fully regional monitoring with no global query. Each zone runs its own independent metrics system. Ingestion stays local, failures are isolated, and latency is low. But when an SRE investigating a cross-region incident needs the error rate for a service across all 38 zones, they must query 38 separate systems and manually stitch the results. During an active incident, that manual federation is unacceptable.',
        'The third attempt is schemaless metrics. Let any team attach any label to any metric, and sort out semantics later. This feels maximally flexible until a developer adds user_id as a label on an RPC latency metric. With 100 million users, that one label creates 100 million distinct time series from a single metric name. Ingestion, memory, query fanout, and alerting all scale with time-series count, not sample count.',
        {
          type: 'table',
          headers: ['Approach', 'Keeps working until', 'Breaks when'],
          rows: [
            ['Single global store', 'Ingestion fits one cluster', 'Write volume exceeds cluster capacity or cluster fails'],
            ['Fully regional, no federation', 'Incidents are single-region', 'SRE needs fleet-wide view during cross-region outage'],
            ['Schemaless labels', 'All labels are low-cardinality', 'One high-cardinality label explodes series count'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the circular dependency between monitoring and infrastructure. A monitoring database that stores data in Bigtable cannot alert on Bigtable failures. A monitoring database that queries via Spanner cannot detect Spanner outages. The monitoring system must be more available than every system it watches, which means it cannot depend on any of them for its critical path.',
        'This forces in-memory storage. Disk-backed databases introduce dependencies on distributed file systems, which themselves need monitoring. In-memory storage eliminates that chain but creates a new constraint: 950 billion time series must fit in memory, which at naive encoding would require petabytes of RAM.',
        {
          type: 'diagram',
          text: [
            'Dependency chain that Monarch must break:',
            '',
            '  Monarch alerts on Spanner failure',
            '       |',
            '  But if Monarch STORES data in Spanner...',
            '       |',
            '  Spanner fails --> Monarch cannot read its own data',
            '       |',
            '  --> Monarch cannot fire the alert about Spanner',
            '       |',
            '  --> Nobody knows Spanner is down',
            '',
            'Solution: Monarch stores data in its own in-memory leaves.',
            'Recovery logs use local disk, not Spanner/Bigtable.',
          ].join('\n'),
          label: 'The circular dependency that forces in-memory storage',
        },
        'The second wall is cardinality. A schemaless system allows any label, but time-series databases index by label set. Every unique combination of label values creates a separate time series. A single metric with five labels, each having 100 values, produces 10 billion potential series. Without schema enforcement, one team can accidentally consume more memory than an entire zone.',
        {
          type: 'note',
          text: 'Borgmon hit both walls. Teams ran their own instances to avoid the single-cluster bottleneck, but that created operational overhead proportional to fleet size. There was no schema to prevent cardinality explosions, and no automatic query federation. Monarch exists because Borgmon could not scale without scaling the human effort to run it.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the write path by geography and the read path by federation. Ingestion stays regional so writes never cross the planet. Queries fan out globally so reads can merge any subset of zones. A schematized data model makes federation safe: the schema defines value types, label dimensions, and aggregation semantics, so a root mixer can merge partial results from zone mixers without guessing how to combine them.',
        {
          type: 'diagram',
          text: [
            'Write path (regional, never crosses zone boundary):',
            '',
            '  task --> ingestion router --> leaf router --> leaf (in-memory)',
            '                                          --> recovery log (local disk)',
            '',
            'Read path (global, fans out and merges):',
            '',
            '  SRE query --> root mixer --> zone mixer A --> leaves A',
            '                          --> zone mixer B --> leaves B',
            '                          --> zone mixer C --> leaves C',
            '           <-- merged result <-- partial results',
            '',
            'Schema makes merge safe:',
            '  counter --> rate aggregation',
            '  gauge   --> latest/average',
            '  distribution --> histogram merge + percentile extraction',
          ].join('\n'),
          label: 'Regional writes, global reads, schema-safe merging',
        },
        'The invariant: after ingestion, every time series lives in exactly one zone determined by its location field, but every query can address any combination of zones, and the schema guarantees that partial results from different zones can be merged into a correct global answer.',
        {
          type: 'quote',
          text: 'Up to 95% of standing queries fully evaluate at zone level by zone evaluators.',
          attribution: 'Adams et al., VLDB 2020, Section 4',
        },
        'This means most queries never leave the zone. Only the 5% that need cross-zone aggregation pay the cost of global fanout. The architecture optimizes for the common case -- within-zone monitoring -- while still supporting fleet-wide queries when an SRE needs them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Monarch has three functional layers: ingestion, storage, and query execution. Each layer is built from specific components with clearly separated responsibilities.',
        {
          type: 'table',
          headers: ['Component', 'Layer', 'Responsibility'],
          rows: [
            ['Ingestion router', 'Ingestion', 'Routes incoming data to the correct zone based on location fields in the target schema'],
            ['Leaf router', 'Ingestion', 'Distributes data across leaves within a zone using lexicographic sharding on target key columns'],
            ['Leaf', 'Storage', 'In-memory time-series storage with delta encoding, timestamp sharing, and run-length compression'],
            ['Recovery log', 'Storage', 'Local-disk durability; source of truth for rebuilding after leaf crashes, never on the query path'],
            ['Range assigner', 'Storage', 'Balances target ranges across leaves; moves ranges to equalize load without data loss'],
            ['Configuration server', 'Control', 'Spanner-backed global store with zonal mirrors; holds target schemas, metric schemas, retention policies, standing queries'],
            ['Root mixer', 'Query', 'Receives user queries, fans out to zone mixers, merges partial results into a global answer'],
            ['Zone mixer', 'Query', 'Fans out within a zone to leaves, applies hedged reads for tail latency'],
            ['Zone evaluator', 'Query', 'Executes standing queries periodically at zone level; handles 95% of standing query volume'],
            ['Root evaluator', 'Query', 'Executes standing queries that require cross-zone aggregation'],
            ['Index server (FHI)', 'Query', 'Maintains Field Hints Index using trigrams to reduce query fanout'],
          ],
        },
        'The data model is schematized into targets and metrics. A target represents a monitored entity -- a VM, container, or Borg task -- identified by location fields that determine zone placement and key fields that determine leaf placement. A metric defines the measurement: value type (gauge, cumulative, distribution), key columns for queryable dimensions, and value columns for the actual time-series data.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Target schema example',
            'target_schema: ComputeTask',
            '  location_fields: [cluster, zone]     # determines zone placement',
            '  key_fields:      [user, job, task_num] # determines leaf sharding',
            '',
            '# Metric schema example',
            'metric_schema: rpc_latency',
            '  target: ComputeTask',
            '  key_columns:  [service, method, status_code]  # query dimensions',
            '  value_type:   distribution                     # bucketed histogram',
            '  aggregation:  percentiles(p50, p95, p99)       # safe merge semantics',
            '',
            '# A single time series is identified by:',
            '#   target_key + metric_key + value_column',
            '# Example:',
            '#   ComputeTask::sql-dba::db.server::aa::0876',
            '#   + rpc_latency::search::GetResults::200',
            '#   = one unique time series with timestamped distribution samples',
          ].join('\n'),
          label: 'Target and metric schemas define the contract between producers and the monitoring database',
        },
        'The write path has four steps. A client sends metric data to the nearest ingestion router. The router examines the location field from the target schema and forwards to the correct zone. Within the zone, a leaf router applies lexicographic sharding on target key columns to select the responsible leaf. The leaf writes to in-memory storage and simultaneously to a recovery log on local disk.',
        'The query path uses a three-level tree: root mixer, zone mixer, leaf. A root mixer receives a query and determines which zones might hold relevant data using the root-level Field Hints Index. The FHI is a compact trigram-based index that maps field-value fingerprints to sets of zones and leaves. Despite occupying only a few gigabytes, it reduces query fanout by about 80% at the root level and 99.5% at the zone level.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Query execution pipeline (relational algebra)',
            'fetch   ComputeTask::rpc_latency',
            '  | filter  service = "search" AND zone = *',
            '  | align   interval = 1m',
            '  | group_by [method, zone]',
            '  | reduce  percentile(value, 99) over 5m',
            '  | alert   p99 > 200ms --> page',
            '',
            '# Execution levels:',
            '#   Leaf:   fetch + filter (local data only)',
            '#   Zone:   align + group_by within zone',
            '#   Root:   merge zone results + final group_by across zones',
            '#   Alert:  root evaluator compares merged result to threshold',
          ].join('\n'),
          label: 'Query pushdown determines where each operation executes in the mixer tree',
        },
        'Standing queries run on a schedule, typically every 30 to 60 seconds. Zone evaluators handle about 95% of them because those queries only need data within a single zone. Results are written back into Monarch as output time series, which is how alerting works: an alert is a standing query whose output triggers a notification when a threshold is crossed. On-demand queries from dashboards or SREs use the same mixer tree but are subject to hedged reads and zone pruning under load.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on three invariants that hold across all operations.',
        {
          type: 'bullets',
          items: [
            'Zone placement invariant: every time series lives in exactly one zone, determined by the location field in its target schema. No series is duplicated across zones, and no query needs to reconcile conflicting copies from different zones.',
            'Schema merge invariant: because metric schemas declare value types and aggregation semantics, a root mixer can merge partial results from zone mixers using the declared aggregation function. A counter merges by summing rates. A distribution merges by combining histograms. A gauge merges by taking the latest or averaging. The merge is always well-defined.',
            'Circular independence invariant: Monarch stores data in its own in-memory leaves and writes recovery logs to local disk. It never depends on Spanner, Bigtable, or any other Google storage system on the alerting path. If those systems fail, Monarch continues to ingest, store, and alert.',
          ],
        },
        'The architecture works because regional writes eliminate the global ingestion bottleneck, global reads via federation eliminate the manual stitching burden, and schemas eliminate semantic ambiguity during merging.',
        'Collection-side aggregation provides additional correctness at scale. Clients send deltas between adjacent cumulative points rather than raw cumulative values. These deltas are bucketed into time intervals and aggregated by dimension before transmission to leaves. The typical aggregation ratio is 36 input series per 1 output series. In extreme cases, the reduction exceeds one million to one. This pre-aggregation uses roughly 25% of the CPU that would be required to store raw data and aggregate via standing queries.',
        {
          type: 'note',
          text: 'Zone pruning is the reliability mechanism for queries. If a zone does not begin streaming results within half the query deadline, the root mixer prunes it from the result and annotates the response so the user knows data from that zone is missing. The system prefers a partial answer over a timeout, because during an incident, some data is far more useful than no data.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Resource', 'Cost driver', 'Typical magnitude'],
          rows: [
            ['Memory per series', 'Encoding efficiency: delta, timestamp sharing, run-length', '~0.79 KB per series (750 TB / 950B series)'],
            ['Replication', '1-3 in-memory replicas per series', '3x memory for production-critical metrics'],
            ['Query fanout (root)', 'Number of zones holding relevant data', 'FHI reduces by ~80%, pruning 4 of 5 irrelevant zones'],
            ['Query fanout (zone)', 'Number of leaves per zone', 'FHI reduces by ~99.5%; large zones have 10,000+ leaves'],
            ['Standing query CPU', '95% of 6M queries/sec evaluated at zone level', 'Zone evaluators bear the bulk; root sees only 5%'],
            ['Collection aggregation', 'Pre-aggregation at source before ingestion', '~25% CPU vs. raw-ingest-then-query alternative'],
            ['Recovery log I/O', 'Every write duplicated to local disk', 'Write amplification 2x but not on query path'],
          ],
        },
        'Memory is the primary operational constraint. 950 billion time series in 750 TB of compressed memory means each series averages about 0.79 KB. That compression comes from three techniques: timestamp sharing across series in the same bucket, delta encoding of values, and run-length compression of repeated deltas. Once a time bucket exits the admission window, it becomes immutable, enabling aggressive encoding.',
        'The Field Hints Index is the key to query affordability. Without it, every ad-hoc query would fan out to every leaf in every zone. With trigram-based fingerprinting, a few gigabytes of index data can prune 99.5% of irrelevant leaves at the zone level. The cost of maintaining the FHI is continuous index updates streamed via long-lived RPCs, but this is far cheaper than full fanout.',
        {
          type: 'note',
          text: 'Zone sizes vary by two orders of magnitude: 5 small zones have fewer than 100 leaves, while 6 huge zones have more than 10,000. Query cost scales with zone leaf count, which is why FHI pruning matters most in the largest zones.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace how a single metric flows from a task through ingestion, storage, and query.',
        {
          type: 'table',
          headers: ['Step', 'What happens', 'Component'],
          rows: [
            ['1. Export', 'Task db.server in zone us-east exports rpc_latency as a distribution with labels service=search, method=GetResults, status=200', 'Client library'],
            ['2. Route to zone', 'Ingestion router reads location field zone=us-east, forwards to us-east zone', 'Ingestion router'],
            ['3. Route to leaf', 'Leaf router lexicographically shards by target key sql-dba::db.server::us-east::0876, assigns to leaf L42', 'Leaf router'],
            ['4. Store + log', 'Leaf L42 writes distribution sample to in-memory storage and appends to recovery log on local disk', 'Leaf + recovery log'],
            ['5. Standing query', 'Zone evaluator runs "p99 latency by method, 5m window" every 60s; result written back as output series', 'Zone evaluator'],
            ['6. Alert check', 'Standing query output: p99 = 240ms. Threshold is 200ms. Alert fires.', 'Zone evaluator'],
          ],
        },
        'Now suppose an SRE investigating a global latency spike runs an ad-hoc query: "p99 of rpc_latency for service=search across all zones, last 10 minutes."',
        {
          type: 'diagram',
          text: [
            'Ad-hoc query fanout:',
            '',
            '  SRE dashboard',
            '       |',
            '  root mixer',
            '       | (root FHI prunes 30 of 38 zones -- service=search only in 8)',
            '       |',
            '  +----+----+----+----+----+----+----+----+',
            '  |    |    |    |    |    |    |    |    |',
            '  zm1  zm2  zm3  zm4  zm5  zm6  zm7  zm8',
            '  |    |    |    |    |    |    |    |    |',
            ' (zone FHI prunes 99.5% of leaves in each zone)',
            '  |    |',
            '  L3   L7,L42  ...  (only leaves with search service data)',
            '',
            '  Each leaf returns partial distribution for its target ranges.',
            '  Zone mixers merge within-zone distributions.',
            '  Root mixer merges cross-zone distributions.',
            '  Final output: global p99 = 240ms.',
            '',
            '  If zone us-west-2 is slow:',
            '    root mixer hits soft deadline (half of total)',
            '    prunes us-west-2 from result',
            '    annotates response: "7 of 8 zones reporting"',
          ].join('\n'),
          label: 'FHI pruning and zone pruning during an ad-hoc cross-zone query',
        },
        'Now consider cardinality. The same service adds user_id as a label on rpc_latency. With 100 million users, the metric name times label combinations explodes from a few thousand series to 100 million. Each series needs in-memory storage, FHI entries, and query-time evaluation. The leaf runs out of memory, the FHI grows by orders of magnitude, and queries that group by user_id fan out to every leaf.',
        {
          type: 'table',
          headers: ['Label set', 'Unique combinations', 'Series count', 'Effect'],
          rows: [
            ['service, method, status', '10 x 50 x 5 = 2,500', '2,500', 'Manageable. Good aggregation targets.'],
            ['+ zone', '2,500 x 38 = 95,000', '95,000', 'Still fine. Zone is a location field.'],
            ['+ user_id', '95,000 x 100M', '~10 trillion', 'Memory explosion. FHI useless. Queries timeout.'],
          ],
        },
        {
          type: 'note',
          text: 'The fix is schema review, not code. user_id belongs in a trace span (Dapper) where it identifies one request path, not in a metric label where it multiplies every time series by the user population. Labels are the index. The index must be bounded.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Use case', 'Why Monarch fits', 'What it stores'],
          rows: [
            ['SLO monitoring', 'Standing queries compute burn rates and error budgets on schedule', 'Cumulative request counts and latency distributions per service'],
            ['Incident alerting', 'Zone evaluators fire alerts within seconds of threshold breach', 'Derived metrics from standing queries compared against configured thresholds'],
            ['Capacity planning', 'Historical trends in resource utilization across zones', 'CPU, memory, disk, and network gauges per task and cluster'],
            ['Release canary', 'Compare error rates between canary and baseline builds', 'Counters grouped by build label, aligned over matching time windows'],
            ['Fleet dashboards', 'Ad-hoc queries with global federation for cross-zone views', 'Aggregated metrics merged at root mixer from zone partial results'],
          ],
        },
        'The Monarch pattern -- regional writes, global reads, schema-safe merging -- appears in every production monitoring system at scale. Prometheus uses a pull model and local storage with optional federation via Thanos or Cortex. M3 from Uber uses a distributed time-series store with query fanout. OpenTelemetry metrics standardize the schema contract across vendors. Cloud monitoring products (Google Cloud Monitoring, Amazon CloudWatch, Azure Monitor) all implement some variant of regionalized ingestion with cross-region query.',
        'The design connects directly to tracing (Dapper) and logging. Metrics give rates, levels, and distributions -- the aggregate signal. Traces follow individual request paths with causal context. Logs preserve local events with full detail. During an incident, metrics provide the first signal (error rate spike, p99 shift, queue growth). Traces explain why (which service, which dependency, which code path). Logs give the exact evidence (stack trace, payload, error message). Monarch covers the aggregate layer.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Observability data type selection:',
            '',
            '  "What is the error rate for search?"     --> metric (counter, rate aggregation)',
            '  "Why is this request slow?"               --> trace (spans, causal chain)',
            '  "What was the exact error message?"       --> log (full event record)',
            '  "Is p99 latency within SLO budget?"       --> metric (distribution, percentile)',
            '  "Which user hit the bug?"                 --> trace or log (high-cardinality ID)',
            '  "How much CPU are we using fleet-wide?"   --> metric (gauge, sum across zones)',
          ].join('\n'),
          label: 'Choosing the right observability data type before the incident',
        },
        {
          type: 'note',
          text: 'Monarch monitors the systems that monitor users. Gmail, Search, YouTube, and Maps all depend on Monarch for alerting, SLO tracking, and capacity planning. The monitoring database is not optional infrastructure -- it is as critical as DNS.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Cardinality explosions: a single high-cardinality label (user ID, request ID, URL path) can create billions of series from one metric name. Schema review catches this at definition time, but Monarch has no runtime circuit breaker that retroactively drops a label -- the damage is done at ingestion.',
            'Stale standing queries: a standing query that evaluates every 60 seconds can miss a spike that lasts 30 seconds. The alert fires late or not at all. Shorter evaluation intervals increase CPU cost on zone evaluators.',
            'Zone pruning hides data: when a zone is slow, the root mixer prunes it and returns a partial result. If the SRE does not notice the pruning annotation, they may conclude the fleet is healthy when one zone is actually on fire.',
            'Schema rigidity: adding a new label to an existing metric requires a schema change propagated through the configuration server. Fast iteration on new dimensions is slower than in a schemaless system like early Prometheus.',
            'Memory ceiling: in-memory storage means total retention is bounded by RAM budget. Long-term historical analysis (months or years) requires downsampling or offloading to a disk-backed store, which reintroduces the infrastructure dependencies Monarch was designed to avoid.',
            'Circular dependency leaks: recovery logs use local disk, but if the local disk subsystem has a bug that Monarch should be monitoring, the recovery path and the monitoring path share a failure mode.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Mitigation'],
          rows: [
            ['Cardinality explosion', 'Leaf OOM, FHI bloat, query timeout', 'Schema review at metric definition; collection-side aggregation'],
            ['Late alert', 'Spike falls between standing query evaluations', 'Shorter eval interval or streaming evaluation (higher CPU cost)'],
            ['Silent zone prune', 'Dashboard shows healthy but one zone is missing', 'Annotate query results with zone coverage; train SREs to check'],
            ['Schema migration friction', 'New label needed during incident, cannot add fast enough', 'Pre-define broad schemas; use trace labels for ad-hoc dimensions'],
            ['Memory exhaustion', 'Zone rejects new series or drops retention', 'Downsampling rules, tiered retention, capacity planning'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Adams et al., "Monarch: Google\'s Planet-Scale In-Memory Time Series Database," VLDB 2020', 'Full architecture: zones, leaves, mixers, FHI, standing queries, collection aggregation, recovery'],
            ['https://www.vldb.org/pvldb/vol13/p3181-adams.pdf', 'Full text of the VLDB 2020 paper'],
            ['https://research.google/pubs/monarch-googles-planet-scale-in-memory-time-series-database/', 'Google Research summary page'],
            ['Borgmon (predecessor)', 'Described in Google SRE book; per-team instances, no schema, manual sharding -- the system Monarch replaced'],
            ['Prometheus', 'Open-source monitoring influenced by Borgmon; local pull model with optional federation via Thanos/Cortex'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: t-digest Quantile Sketch -- the streaming data structure behind distribution-type metrics and percentile aggregation.',
            'Extension: Dapper Tracing Case Study -- the complementary observability layer for per-request causal analysis.',
            'Production pattern: Google Dataflow Model Case Study -- streaming windows and triggers that overlap with Monarch standing query semantics.',
            'Adjacent system: Backpressure and Flow Control -- how ingestion routers and leaves handle overload without dropping critical metrics.',
            'Contrasting alternative: Load Shedding and Graceful Degradation -- the reliability pattern behind zone pruning and partial query results.',
          ],
        },
      ],
    },
  ],
};

