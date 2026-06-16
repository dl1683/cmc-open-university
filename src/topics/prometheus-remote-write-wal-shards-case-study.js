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
    explanation: 'Prometheus still scrapes and stores locally. Remote write is an export path that reads from the local WAL and forwards samples to another metrics system.',
    invariant: 'Remote write extends the local TSDB path; it does not replace local scrape ingestion.',
  };

  yield {
    state: rwGraph('A WAL reader fans samples into shard queues', { reader: 'cursor', shard0: 'series A', shard1: 'series B', shard2: 'series C' }),
    highlight: { active: ['wal', 'reader', 'shard0', 'shard1', 'shard2', 'e-wal-reader', 'e-reader-shard0', 'e-reader-shard1', 'e-reader-shard2'] },
    explanation: 'The remote-write loop tails WAL records and assigns outgoing samples to shard queues. Sharding lets several HTTP send loops work in parallel when the remote endpoint can keep up.',
  };

  yield {
    state: rwGraph('Shards batch samples and send remote-write requests', { batch: 'N samples', remote: 'accept' }),
    highlight: { active: ['shard0', 'shard1', 'shard2', 'batch', 'remote', 'e-shard0-batch', 'e-shard1-batch', 'e-shard2-batch', 'e-batch-remote'], compare: ['retry'] },
    explanation: 'Each shard batches samples up to configured limits, encodes the remote-write request, and posts it to the configured endpoint. Batching trades latency for throughput and amortizes request overhead.',
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
    explanation: 'The control knobs are mostly queue knobs: number of shards, per-shard queue capacity, max samples per send, and retry backoff. They determine memory, lag, and endpoint pressure.',
  };
}

function* backpressureCase() {
  yield {
    state: rwGraph('One stuck shard can block WAL reading for all shards', { shard1: 'full', reader: 'blocked', remote: 'slow' }),
    highlight: { active: ['reader', 'shard1', 'remote', 'retry', 'e-reader-shard1', 'e-remote-retry'], compare: ['shard0', 'shard2'] },
    explanation: 'Prometheus documentation calls out a sharp behavior: if one shard backs up and fills its queue, reading from the WAL into any shard can stop. The exporter protects ordering and memory by applying backpressure.',
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
    explanation: 'A remote endpoint can return 200 but still be too slow for the incoming sample rate. Operators need queue length, highest sent timestamp, retries, dropped samples, and endpoint latency.',
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
    explanation: 'The complete fix is rarely one setting. You may need to scale the remote backend, reduce cardinality, split tenants or endpoints, and tune queue capacity without turning Prometheus into a memory buffer.',
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
      heading: 'What it is',
      paragraphs: [
        'Prometheus remote write forwards locally scraped metrics to another system for long-term retention, multi-tenant storage, global querying, or vendor ingestion. The local TSDB still exists. Remote write tails the WAL, queues samples by shard, batches them, retries failures, and posts compressed protobuf requests to configured endpoints.',
        'The data-structure lesson is a durability-to-network conveyor. The WAL is the durable source, shard queues are bounded buffers, batches are network units, and lag is the distance between local ingestion and remote acceptance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A scrape appends samples to the local TSDB head and WAL. The remote-write loop reads WAL records, maps samples into shard queues, and lets each shard send batches independently. Prometheus adjusts shard count based on sample rate, pending samples, and send latency so the sender can track the incoming workload without always using the maximum shard count.',
        'When the endpoint fails, shards retry with backoff. When a shard fills, Prometheus can stop reading more WAL data into all shards. That is an intentional backpressure boundary: it limits memory growth, but it means remote-write lag can grow while local scraping continues.',
      ],
    },
    {
      heading: 'Complete case study: slow remote backend',
      paragraphs: [
        'A Prometheus server scrapes 500,000 samples per second and remote-writes to a shared backend. The backend stays up but responses slow down. Shard queues fill, the WAL reader blocks, highest-sent timestamp falls behind wall-clock time, and dashboards that query remote storage look stale even though the local Prometheus is still healthy.',
        'The fix is not just more shards. More shards add memory and endpoint pressure. A serious response looks at remote capacity, dropped or relabeled high-cardinality metrics, tenant separation, max_samples_per_send, queue capacity, and whether the backend can ingest native histograms or high-cardinality series efficiently.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Remote write is not an infinite reliable message bus. If the remote endpoint remains unavailable longer than the local WAL retention window, unsent data can be lost when WAL segments are compacted. Remote write also does not make bad cardinality cheap; it simply moves that cost to another system.',
        'Another trap is watching only request success. A sender can succeed while lag grows. The important signals are queue occupancy, retries, send duration, samples dropped, samples pending, highest sent timestamp, and backend ingestion errors.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus remote write tuning at https://prometheus.io/docs/practices/remote_write/ and Prometheus remote write specification at https://prometheus.io/docs/specs/prw/remote_write_spec/. Study Prometheus TSDB Case Study, Metric Label Cardinality Control, Backpressure & Flow Control, Write-Ahead Log, Mimir Distributor/Ingester Hash Ring, and OpenTelemetry Collector Case Study next.',
      ],
    },
  ],
};
