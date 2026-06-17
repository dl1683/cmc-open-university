// Prometheus remote write: read samples from the local WAL, shard outgoing
// queues, retry remote batches, and surface backpressure before data ages out.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'prometheus-remote-write-wal-shards-case-study',
  title: 'Prometheus Remote Write WAL Shards Case Study',
  category: 'Systems',
  summary: 'How Prometheus remote write tails local WAL segments, queues samples into adaptive shards, batches requests, retries failures, and exposes backpressure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['wal to remote', 'backpressure case'], defaultValue: 'wal to remote' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function rwGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'scrape', label: 'scrape', x: 0.7, y: 3.8, note: notes.scrape ?? 'samples' },
      { id: 'head', label: 'head', x: 2.2, y: 2.1, note: notes.head ?? 'local TSDB' },
      { id: 'wal', label: 'WAL', x: 2.2, y: 5.5, note: notes.wal ?? 'segments' },
      { id: 'reader', label: 'reader', x: 4.0, y: 5.5, note: notes.reader ?? 'tail WAL' },
      { id: 'shard0', label: 'sh0', x: 5.7, y: 2.2, note: notes.shard0 ?? 'queue' },
      { id: 'shard1', label: 'sh1', x: 5.7, y: 3.8, note: notes.shard1 ?? 'queue' },
      { id: 'shard2', label: 'sh2', x: 5.7, y: 5.4, note: notes.shard2 ?? 'queue' },
      { id: 'batch', label: 'batch', x: 7.4, y: 3.8, note: notes.batch ?? 'snappy/proto' },
      { id: 'remote', label: 'remote', x: 9.1, y: 3.8, note: notes.remote ?? 'Mimir/Thanos' },
      { id: 'retry', label: 'retry', x: 7.4, y: 6.1, note: notes.retry ?? 'backoff' },
    ],
    edges: [
      { id: 'e-scrape-head', from: 'scrape', to: 'head', weight: 'append' },
      { id: 'e-scrape-wal', from: 'scrape', to: 'wal', weight: 'log' },
      { id: 'e-wal-reader', from: 'wal', to: 'reader', weight: 'read' },
      { id: 'e-reader-shard0', from: 'reader', to: 'shard0', weight: 'hash' },
      { id: 'e-reader-shard1', from: 'reader', to: 'shard1', weight: 'hash' },
      { id: 'e-reader-shard2', from: 'reader', to: 'shard2', weight: 'hash' },
      { id: 'e-shard0-batch', from: 'shard0', to: 'batch', weight: '' },
      { id: 'e-shard1-batch', from: 'shard1', to: 'batch', weight: '' },
      { id: 'e-shard2-batch', from: 'shard2', to: 'batch', weight: '' },
      { id: 'e-batch-remote', from: 'batch', to: 'remote', weight: 'POST' },
      { id: 'e-remote-retry', from: 'remote', to: 'retry', weight: 'fail' },
      { id: 'e-retry-batch', from: 'retry', to: 'batch', weight: 'again' },
    ],
  }, { title });
}

function* walToRemote() {
  yield {
    state: rwGraph('Remote write starts from local scrape and WAL state'),
    highlight: { active: ['scrape', 'head', 'wal', 'e-scrape-head', 'e-scrape-wal'], compare: ['remote'] },
    explanation: 'Prometheus still scrapes and stores locally. Remote write is an export path layered onto that durable local path, which matters because the WAL is the source it can replay when the network is slow.',
    invariant: 'Remote write extends the local TSDB path; it does not replace local scrape ingestion.',
  };

  yield {
    state: rwGraph('A WAL reader fans samples into shard queues', { reader: 'cursor', shard0: 'series A', shard1: 'series B', shard2: 'series C' }),
    highlight: { active: ['wal', 'reader', 'shard0', 'shard1', 'shard2', 'e-wal-reader', 'e-reader-shard0', 'e-reader-shard1', 'e-reader-shard2'] },
    explanation: 'The remote-write loop tails WAL records and assigns outgoing samples to shard queues. Sharding lets several HTTP send loops work in parallel, but only while the remote endpoint can keep up with the incoming sample rate.',
  };

  yield {
    state: rwGraph('Shards batch samples and send remote-write requests', { batch: 'N samples', remote: 'accept' }),
    highlight: { active: ['shard0', 'shard1', 'shard2', 'batch', 'remote', 'e-shard0-batch', 'e-shard1-batch', 'e-shard2-batch', 'e-batch-remote'], compare: ['retry'] },
    explanation: 'Each shard batches samples up to configured limits, encodes the remote-write request, and posts it to the endpoint. Batching trades a little latency for throughput and keeps request overhead from dominating ingestion.',
  };

  yield {
    state: labelMatrix(
      'Remote-write controls',
      [
        { id: 'shards', label: 'shards' },
        { id: 'cap', label: 'capacity' },
        { id: 'send', label: 'send max' },
        { id: 'backoff', label: 'backoff' },
      ],
      [
        { id: 'tunes', label: 'tunes' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['parallelism', 'memory'],
        ['buffer', 'RAM'],
        ['batch', 'lat'],
        ['retry pace', 'lag'],
      ],
    ),
    highlight: { active: ['shards:tunes', 'cap:tunes', 'send:tunes'], compare: ['backoff:risk'] },
    explanation: 'The control knobs are mostly queue knobs: shard count, per-shard capacity, max samples per send, and retry backoff. They determine memory use, lag, retry pressure, and how hard Prometheus pushes the remote backend.',
  };
}

function* backpressureCase() {
  yield {
    state: rwGraph('One stuck shard can block WAL reading for all shards', { shard1: 'full', reader: 'blocked', remote: 'slow' }),
    highlight: { active: ['reader', 'shard1', 'remote', 'retry', 'e-reader-shard1', 'e-remote-retry'], compare: ['shard0', 'shard2'] },
    explanation: 'Prometheus documentation calls out a sharp behavior: if one shard backs up and fills its queue, reading from the WAL into any shard can stop. This protects ordering and memory, but it also turns one slow path into global remote-write lag.',
    invariant: 'Backpressure is better than unbounded memory, but it creates remote-write lag.',
  };

  yield {
    state: labelMatrix(
      'Failure timeline',
      [
        { id: 'min0', label: '0m' },
        { id: 'min5', label: '5m' },
        { id: 'min30', label: '30m' },
        { id: 'old', label: 'old' },
      ],
      [
        { id: 'queue', label: 'queue' },
        { id: 'result', label: 'result' },
      ],
      [
        ['growing', 'retry'],
        ['full', 'lag'],
        ['blocked', 'risk'],
        ['compacted', 'lost'],
      ],
    ),
    highlight: { active: ['min5:queue', 'min30:result'], removed: ['old:result'], compare: ['min0:result'] },
    explanation: 'Transient remote failures are retried. Long outages can outlive the WAL retention window. Once unsent WAL data is compacted away, remote storage cannot receive those samples later.',
  };

  yield {
    state: rwGraph('The useful dashboard measures lag, not only success rate', { reader: 'behind', shard0: 'queued', shard1: 'queued', shard2: 'queued', remote: '200 slow' }),
    highlight: { active: ['wal', 'reader', 'shard0', 'shard1', 'shard2', 'remote'], found: ['retry'] },
    explanation: 'A remote endpoint can return 200 and still be too slow for the incoming sample rate. Operators need lag signals such as queue length, highest sent timestamp, retries, dropped samples, and endpoint latency.',
  };

  yield {
    state: labelMatrix(
      'Case study controls',
      [
        { id: 'scale', label: 'scale remote' },
        { id: 'drop', label: 'drop labels' },
        { id: 'split', label: 'split stream' },
        { id: 'tune', label: 'tune q' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'trade', label: 'trade' },
      ],
      [
        ['throughput', 'cost'],
        ['volume', 'signal'],
        ['isolate', 'ops'],
        ['burst', 'RAM'],
      ],
    ),
    highlight: { active: ['scale:helps', 'drop:helps', 'split:helps'], compare: ['tune:trade'] },
    explanation: 'The complete fix is rarely one setting. You may need to scale the remote backend, reduce cardinality, split tenants or endpoints, and tune queues without turning Prometheus into an unbounded memory buffer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'wal to remote') yield* walToRemote();
  else if (view === 'backpressure case') yield* backpressureCase();
  else throw new InputError('Pick a remote-write view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Prometheus is excellent at local scraping and short-term querying, but many organizations need long-term retention, global querying, multi-tenant storage, or vendor ingestion. Remote write is the bridge from local scrape truth to a remote metrics backend.',
        'The local TSDB still exists. Remote write tails the WAL, queues samples by shard, batches them, retries failures, and posts compressed protobuf requests to configured endpoints. The data-structure lesson is a durable log feeding bounded network buffers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive design is to send every scraped sample directly to the remote backend as it arrives. That couples scraping to the network and makes a slow remote endpoint threaten local collection.',
        'Another naive design is to buffer forever in memory. That protects scraping for a while, but it turns an outage into unbounded memory growth and eventually a worse failure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Metrics traffic is bursty, high-cardinality, and unforgiving. A remote endpoint can be alive but slower than the incoming sample rate. If the sender keeps accepting work without bounds, memory grows. If it drops too early, long-term data becomes untrustworthy.',
        'The system needs durability, parallelism, batching, retries, and a hard backpressure boundary. It also needs operators to notice lag before the remote store silently falls behind reality.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Remote write treats the WAL as the durable source and shard queues as bounded export buffers. Scraping appends locally first. The remote-write path then reads from the WAL, fans samples into shard queues, sends batches, and retries failures.',
        'That means remote write is not a replacement for local ingestion. It is a conveyor from a durable local log to an unreliable network sink. Lag is the distance between local ingestion and remote acceptance.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The WAL-to-remote view shows a durable local append path feeding a best-effort network export path. The sample is safe locally before the remote endpoint accepts it. Remote write is downstream of scrape ingestion, not in front of it.',
        'The backpressure view shows the real control loop. Shards, batch size, retry backoff, and queue capacity decide whether lag shrinks, grows, or turns into dropped data. The important question is not whether a request is in flight; it is how far remote storage has fallen behind local time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A scrape appends samples to the local TSDB head and WAL. The remote-write loop reads WAL records, maps samples into shard queues, and lets each shard send batches independently. Prometheus can adjust shard count based on sample rate, pending samples, and send latency.',
        'When the endpoint fails, shards retry with backoff. When a shard fills, Prometheus can stop reading more WAL data into all shards. That boundary limits memory growth, but it also means remote-write lag can grow while local scraping continues.',
        'Relabeling and write configuration decide which samples enter this path. A team can drop noisy metrics, route to different backends, or tune `max_samples_per_send`, queue capacity, and shard limits. Those settings are not cosmetic; they define the sender\'s memory, throughput, and failure behavior.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Prometheus server scrapes 200,000 samples per second and remote-writes to a long-term backend. During normal operation, shard workers send compressed batches quickly enough that the highest sent timestamp stays close to wall-clock time. Dashboards backed by the remote store look current.',
        'Now the backend slows down. HTTP requests still succeed, but each one takes longer. Queues fill, retries increase, and lag grows from seconds to minutes. Local Prometheus can still answer recent queries because scraping continues, while the remote backend presents stale data. That split is the core operational lesson.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The WAL gives the exporter something durable to read after a transient failure. Shards give the sender parallelism. Batches amortize network overhead. Backoff prevents tight retry loops. Bounded queues prevent remote write from becoming an infinite memory buffer.',
        'The design is deliberately imperfect in favor of survival. It accepts lag as the price of protecting local scraping and process memory during remote slowness.',
        'This works only because the local and remote responsibilities are separate. The local TSDB can keep scraping and alerting on recent data while the export path catches up. The remote backend can scale ingestion and retention independently, but it has to expose enough feedback for the sender to distinguish healthy throughput from slow acceptance.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'More shards can improve throughput, but they also increase memory use and pressure on the remote backend. Larger per-shard capacity can absorb bursts, but it can hide lag and consume RAM. Bigger batches improve throughput, but they increase latency and retry cost.',
        'Remote write also does not make high cardinality cheap. It moves those samples into another system that still has to ingest, store, index, compact, and query them.',
        'Compression and batching make the network path efficient, but they also make failures chunkier. Retrying a larger batch resends more data and keeps more pending work tied to one request. The best setting depends on sample rate, endpoint latency, backend limits, and how much lag the organization can tolerate.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Remote write is useful when Prometheus should remain a local scraper while another system handles long-term retention, cross-cluster querying, tenant isolation, or centralized storage. Mimir, Thanos Receive, Cortex-style systems, and vendor backends all fit this pattern.',
        'It is also a strong teaching example because the important structure is not exotic. It is a WAL, bounded queues, shard workers, batches, retries, and backpressure arranged so local ingestion is not held hostage by the network.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Remote write is not an infinite reliable message bus. If the remote endpoint remains unavailable longer than the local WAL retention window, unsent data can be lost when WAL segments are compacted.',
        'Another trap is watching only request success. A sender can receive 200 responses while lag grows. The important signals are queue occupancy, retries, send duration, samples dropped, samples pending, highest sent timestamp, and backend ingestion errors.',
        'It also fails as a substitute for telemetry design. If every request id, user id, pod UID, or raw path becomes a label, remote write only exports the cardinality problem faster. The sender and receiver both need metric hygiene, limits, and clear ownership of dropped or rejected samples.',
        'Loss boundaries should be explicit. Teams need to know whether data was never scraped, scraped locally but not yet sent, sent but rejected, accepted remotely but not queryable, or compacted away before export. Those states lead to different fixes and different trust in historical dashboards.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Prometheus server scrapes 500,000 samples per second and remote-writes to a shared backend. The backend stays up but responses slow down. Shard queues fill, the WAL reader blocks, highest-sent timestamp falls behind wall-clock time, and dashboards that query remote storage look stale even though local Prometheus is still scraping.',
        'The fix is not just more shards. More shards add memory and endpoint pressure. A serious response looks at remote capacity, relabeling or dropping high-cardinality metrics, tenant separation, max_samples_per_send, queue capacity, retry behavior, and whether the backend can ingest native histograms or high-cardinality series efficiently.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Prometheus remote write tuning at https://prometheus.io/docs/practices/remote_write/ and Prometheus remote write specification at https://prometheus.io/docs/specs/prw/remote_write_spec/.',
        'Study Prometheus TSDB Case Study for the local storage path, Metric Label Cardinality Control for volume reduction, Backpressure & Flow Control for bounded buffering, Write-Ahead Log for durable replay, Mimir Distributor/Ingester Hash Ring for remote backend ingestion, and OpenTelemetry Collector Case Study for an alternative telemetry pipeline.',
      ],
    },
  ],
};
