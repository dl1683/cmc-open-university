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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the WAL-to-remote view as a local durable path feeding a network export path. Active nodes show samples moving through the pipeline, compare nodes show work not yet accepted remotely, and found nodes show durable or successfully sent state. WAL means write-ahead log: a local append-only record that remote write can reread after transient failures.',
        'The backpressure view shows the key inference. If one shard queue fills, reading from the WAL can stop for all shards, which protects memory but grows lag. Lag is the distance between local scrape time and the newest sample accepted by the remote backend.',
        {type:'callout', text:'Remote write is a bounded export pipeline from a durable local WAL to an unreliable network sink, so lag is the signal that matters.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/38/Prometheus_software_logo.svg', alt:'Prometheus flame logo in an orange circle.', caption:'Prometheus software logo by Alexander Schwartz (ahus1), via Wikimedia Commons, Apache License 2.0.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Prometheus is strong as a local scraper and short-term query engine. Many organizations also need long-term retention, centralized query, multi-tenant storage, or a vendor backend. Remote write exports locally scraped samples to that external system.',
      'The design must preserve local scraping when the network or remote endpoint is slow. Remote write therefore tails the local WAL, queues samples, batches requests, retries failures, and surfaces lag. It is an export pipeline, not the ingestion source of truth.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to send each scraped sample directly to the remote backend. That couples scraping to remote availability. A slow endpoint can then threaten local collection and alerting.',
      'Another obvious approach is to buffer everything in memory until the remote backend recovers. That protects data briefly but turns a long outage into unbounded RAM growth. A monitoring system should not crash because its remote storage is slow.',
    ] },
    { heading: 'The wall', paragraphs: [
      'Metrics traffic is bursty and often high-cardinality. A remote endpoint can return HTTP 200 while still accepting samples slower than Prometheus creates them. Success rate alone can look healthy while the remote store falls minutes behind.',
      'The system needs bounded memory, durable replay, parallel sending, and visible lag. If the outage lasts longer than local WAL retention, unsent samples can be compacted away. At that point the remote store cannot recover the missing history from Prometheus.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Use the WAL as the durable source and shard queues as bounded network buffers. Local scrape ingestion appends samples first. The remote-write loop reads WAL records, assigns samples to shard queues, sends compressed batches, and retries with backoff.',
      'The invariant is separation of responsibilities. Local Prometheus must keep scraping and alerting on recent data even when export is delayed. Remote write may lag, but it must not become an infinite memory buffer.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A scrape appends samples to the TSDB head and WAL. The remote-write reader tails WAL records and distributes samples across shard queues, usually by series identity. Each shard builds a batch, encodes the remote-write request, compresses it, and posts it to the endpoint.',
      'Queue settings define behavior. More shards increase parallelism, capacity absorbs bursts, max samples per send controls batch size, and backoff controls retry pace. Relabeling decides which samples enter the path at all.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The WAL lets the exporter recover from short remote failures without asking scrape targets to resend old samples. Shards give parallelism, batches reduce request overhead, and retries handle transient network or backend errors. Bounded queues stop memory from growing without limit.',
      'The design is correct as an at-least-export attempt over a finite local history, not as permanent guaranteed delivery. If data remains in the WAL and the remote backend eventually accepts it, the sender can catch up. If the WAL segment ages out before sending, the export loss is final.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'More shards can shrink lag when the endpoint has capacity, but they also increase memory and request pressure. Larger capacity can absorb bursts, but it hides problems and uses RAM. Bigger batches improve throughput, but a failed request ties up more samples for retry.',
      'Cardinality still dominates cost. Remote write moves every retained series into another system that must ingest, store, compact, index, and query it. Dropping noisy labels often beats tuning queues because it reduces work at every stage.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Remote write is used to send Prometheus samples to long-term systems such as Mimir, Cortex-style backends, Thanos Receive, and managed observability platforms. It lets Prometheus stay close to scrape targets while another system owns retention and global query.',
      'It is also a useful general systems pattern. A durable local log feeds bounded shard queues, which feed an unreliable service. The same shape appears in telemetry collectors, CDC exporters, and many replication pipelines.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Remote write is not an infinite message bus. If the remote endpoint is unavailable longer than the local WAL retention window, unsent samples can be lost. Operators need to know where that boundary is before treating remote storage as complete history.',
      'It also fails when teams watch only request success. A backend can accept batches slowly while lag grows. The important signals are pending samples, queue occupancy, retries, send duration, dropped samples, highest sent timestamp, and remote ingestion errors.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A Prometheus server scrapes 200,000 samples per second. The remote backend normally accepts 220,000 samples per second, so shard queues stay shallow and highest sent timestamp stays near wall-clock time. During an incident, the backend accepts only 120,000 samples per second.',
      'Lag now grows by about 80,000 samples per second, or 4.8 million samples per minute. More shards help only if the backend has unused capacity. If the bottleneck is backend ingestion, the real fixes are scaling the receiver, dropping high-cardinality metrics, splitting traffic, or accepting a known loss window.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Prometheus remote write tuning at https://prometheus.io/docs/practices/remote_write/ and the Prometheus remote write specification at https://prometheus.io/docs/specs/prw/remote_write_spec/. Check current docs before changing production settings because queue behavior and protocol support can change across releases.',
      'Study Prometheus TSDB, write-ahead logs, backpressure and flow control, metric label cardinality, Mimir distributor and ingester design, OpenTelemetry Collector pipelines, and native histogram support in remote write before operating this path at scale.',
    ] },
  ],
};
