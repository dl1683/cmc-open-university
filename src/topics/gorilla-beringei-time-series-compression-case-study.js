// Gorilla/Beringei time-series compression: regular timestamps compress by
// delta-of-delta, and slowly changing float values compress by XOR bit ranges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gorilla-beringei-time-series-compression-case-study',
  title: 'Gorilla/Beringei Time-Series Compression Case Study',
  category: 'Systems',
  summary: 'A monitoring-storage compression lesson: encode timestamp delta-of-delta, XOR nearby float values, and keep hot recent series compact enough for memory.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['timestamp compression', 'value XOR compression'], defaultValue: 'timestamp compression' },
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

function compressionFlow(title) {
  return graphState({
    nodes: [
      { id: 'sample', label: 'sample', x: 0.8, y: 3.2, note: 'ts,value' },
      { id: 'time', label: 'time', x: 2.7, y: 3.2, note: 'delta2' },
      { id: 'value', label: 'value', x: 4.6, y: 3.2, note: 'XOR' },
      { id: 'bits', label: 'bits', x: 6.5, y: 3.2, note: 'var len' },
      { id: 'chunk', label: 'chunk', x: 8.4, y: 3.2, note: 'hot series' },
    ],
    edges: [
      { id: 'e-sample-time', from: 'sample', to: 'time' },
      { id: 'e-time-value', from: 'time', to: 'value' },
      { id: 'e-value-bits', from: 'value', to: 'bits' },
      { id: 'e-bits-chunk', from: 'bits', to: 'chunk' },
    ],
  }, { title });
}

function* timestampCompression() {
  yield {
    state: compressionFlow('Gorilla compresses each series as a bit stream'),
    highlight: { active: ['time', 'value', 'bits'], found: ['chunk'] },
    explanation: 'A monitoring sample is usually a timestamp and a floating-point value. Gorilla-style chunks encode the timestamp stream and the value stream with separate tricks tuned to time-series regularity.',
    invariant: 'Store the first value plainly; encode later samples relative to previous samples.',
  };

  yield {
    state: labelMatrix(
      'Timestamp delta-of-delta',
      [
        { id: 't0', label: '1000' },
        { id: 't1', label: '1010' },
        { id: 't2', label: '1020' },
        { id: 't3', label: '1030' },
        { id: 't4', label: '1042' },
      ],
      [
        { id: 'delta', label: 'delta' },
        { id: 'delta2', label: 'delta2' },
        { id: 'code', label: 'code idea' },
      ],
      [
        ['raw', 'raw', 'store first'],
        ['10', 'raw', 'store delta'],
        ['10', '0', 'one bit'],
        ['10', '0', 'one bit'],
        ['12', '+2', 'small code'],
      ],
    ),
    highlight: { found: ['t2:delta2', 't3:delta2'], active: ['t4:delta2', 't4:code'] },
    explanation: 'If scrapes arrive every 10 seconds, the delta stays 10 and the delta-of-delta is zero. Gorilla uses a tiny code for that common case and longer codes only when timing shifts.',
  };

  yield {
    state: labelMatrix(
      'Why this fits monitoring',
      [
        { id: 'regular', label: 'regular scrape' },
        { id: 'late', label: 'late sample' },
        { id: 'gap', label: 'missing point' },
        { id: 'burst', label: 'burst writes' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'codec effect', label: 'codec effect' },
      ],
      [
        ['same interval', 'tiny timestamp code'],
        ['small jitter', 'small delta2'],
        ['larger jump', 'longer code'],
        ['append-only', 'streaming writer'],
      ],
    ),
    highlight: { found: ['regular:codec effect'], compare: ['gap:codec effect'] },
    explanation: 'Monitoring data is not arbitrary. It is append-heavy, per-series ordered, and often sampled on a schedule. The codec exploits that shape directly.',
  };

  yield {
    state: compressionFlow('Compression buys memory residency for recent data'),
    highlight: { active: ['chunk', 'bits'], found: ['sample'], compare: ['time'] },
    explanation: 'The systems lesson is bigger than the codec. If hot recent metrics stay compressed in memory, dashboards and alerts can read them without paging through a colder database path.',
  };
}

function* valueXorCompression() {
  yield {
    state: labelMatrix(
      'Float value XOR path',
      [
        { id: 'first', label: '12.00' },
        { id: 'same', label: '12.00' },
        { id: 'near', label: '12.05' },
        { id: 'jump', label: '18.75' },
      ],
      [
        { id: 'xor', label: 'xor with prev' },
        { id: 'stored', label: 'stored bits' },
      ],
      [
        ['raw value', '64 bits'],
        ['zero', 'one bit'],
        ['small range', 'changed bits'],
        ['larger range', 'more bits'],
      ],
    ),
    highlight: { found: ['same:stored', 'near:stored'], compare: ['jump:stored'] },
    explanation: 'Adjacent floating-point values in monitoring series often share many leading and trailing bits. XOR with the previous value exposes the changed bit range.',
    invariant: 'The value codec is lossless; it stores enough changed bits to reconstruct the exact float.',
  };

  yield {
    state: labelMatrix(
      'Chunk anatomy',
      [
        { id: 'header', label: 'header' },
        { id: 'first', label: 'first sample' },
        { id: 'time', label: 'time stream' },
        { id: 'value', label: 'value stream' },
      ],
      [
        { id: 'contents', label: 'contents' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['series metadata', 'route lookup'],
        ['raw ts/value', 'anchor decode'],
        ['delta2 codes', 'regular timing'],
        ['XOR codes', 'stable values'],
      ],
    ),
    highlight: { active: ['time:contents', 'value:contents'], found: ['first:reason'] },
    explanation: 'A chunk is a self-contained compressed run for one series. Decoders start from the first sample, then replay timestamp and value codes in order.',
  };

  yield {
    state: labelMatrix(
      'Case-study map',
      [
        { id: 'gorilla', label: 'Gorilla' },
        { id: 'beringei', label: 'Beringei' },
        { id: 'prom', label: 'Prometheus' },
        { id: 'monarch', label: 'Monarch' },
      ],
      [
        { id: 'focus', label: 'focus' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['in-memory TSDB', 'hot data fast'],
        ['open-source engine', 'streaming ingest'],
        ['XOR chunks', 'local TSDB'],
        ['global monitoring', 'schema and scale'],
      ],
    ),
    highlight: { found: ['gorilla:lesson', 'beringei:focus'], active: ['prom:focus'], compare: ['monarch:lesson'] },
    explanation: 'Prometheus adopted Gorilla-style XOR chunks for local time-series storage. Monarch solves a broader global monitoring problem, but the same pressure appears: compact hot series are cheaper to query.',
  };

  yield {
    state: compressionFlow('Codec, retention, and availability are one design'),
    highlight: { active: ['sample', 'chunk'], found: ['bits'], compare: ['value'] },
    explanation: 'Gorilla optimized for operational monitoring: recent reads, high ingest, and availability. Compression was not decorative; it made the hot-memory design economically plausible.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'timestamp compression') yield* timestampCompression();
  else if (view === 'value XOR compression') yield* valueXorCompression();
  else throw new InputError('Pick a Gorilla/Beringei view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Gorilla was Facebook Meta\'s in-memory time-series database design for recent monitoring data. Its compression lesson is simple and powerful: monitoring samples are ordered, regular, and often slowly changing, so encode them as a stream rather than as independent rows. Timestamps use delta-of-delta encoding. Floating-point values use XOR against the previous value and store only the changed bit range.',
        'Beringei is the open-source storage engine that carried the same idea into a reusable implementation. Prometheus local storage later used Gorilla-inspired XOR chunks. The shared data-structure idea is a compact per-series chunk that can be appended and scanned quickly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Timestamp encoding stores the first timestamp and first delta, then stores the difference between the current delta and the previous delta. For a stable scrape interval, that delta-of-delta is zero, so it can be represented by a very small code. Jitter, gaps, and delayed samples take longer codes only when they occur.',
        'Value encoding stores the first float exactly. For each next value, XOR its IEEE-754 bit pattern with the previous value. If the XOR is zero, the value repeated. If not, many neighboring monitoring values still share leading and trailing zeros, so the encoder records the meaningful changed bit window. The scheme is lossless: decoding replays the same bit operations to recover exact timestamps and values.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The write path is streaming and append-friendly. The decoder is sequential: start from the first sample and replay codes. That is a good fit for range queries over recent time windows, but not for arbitrary point mutation inside a chunk. Compression ratio depends on regular scrape intervals, stable values, cardinality, and chunk length. More series means more chunk metadata and index pressure even if each individual series compresses well.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'The Gorilla paper reported that compression reduced storage footprint enough to keep recent operational data in memory, improving query latency and throughput for monitoring workloads. Meta\'s Beringei engineering writeup describes a streaming compressor able to handle high ingest and reduce real-world time-series data by over 90 percent. Prometheus chunks expose a similar design pressure: local alerting and dashboards need recent samples compact, mmap-friendly, and cheap to scan.',
        'This is why compression belongs in the data-structure map. It is not only a file-size trick. It changes which tier can hold the working set, which queries stay interactive, and how much cardinality a monitoring system can afford before indexes and memory dominate.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Gorilla-style compression does not solve high cardinality by itself. One million tiny compressed streams still require labels, indexes, chunks, retention policy, and query planning. It also does not make old data free; long retention usually needs compaction, downsampling, object storage, or remote systems. Finally, the codec is workload-shaped. Random timestamps and noisy values compress worse than regular scrapes and stable counters.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Gorilla VLDB paper at https://www.vldb.org/pvldb/vol8/p1816-teller.pdf, Meta Beringei engineering writeup at https://engineering.fb.com/2017/02/03/core-infra/beringei-a-high-performance-time-series-storage-engine/, Prometheus chunk encoding package docs at https://pkg.go.dev/github.com/prometheus/prometheus/tsdb/chunkenc, and Prometheus storage docs at https://prometheus.io/docs/prometheus/latest/storage/. Study Delta Bit-Packing Integer Compression, Prometheus TSDB Case Study, Monarch Time Series Case Study, T-Digest, Write-Ahead Log, and LSM Tree next.',
      ],
    },
  ],
};
