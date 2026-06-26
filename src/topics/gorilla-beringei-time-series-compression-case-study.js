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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as one ordered time series, not as unrelated database rows. The timestamp track shows delta-of-delta encoding, which stores how the sampling interval changes instead of storing every timestamp from scratch.',
        'The value track shows XOR encoding for floating-point values. If the next value has the same bit pattern, the changed bits are zero; if it moves slightly, the meaningful changed window is usually much smaller than 64 bits.',
        {type:'callout', text:'Gorilla-style compression wins because the codec is shaped around ordered per-series chunks that match the hot query path.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Monitoring systems store time-series data: repeated measurements indexed by time, such as CPU usage every 15 seconds. Operators query recent windows constantly during incidents, so hot data must stay cheap to hold and fast to scan.',
        'Gorilla and Beringei exist because raw timestamps and 64-bit floats make recent telemetry too large for memory at large scale. Compression changes behavior when it keeps the working set in RAM instead of forcing recent queries into slower storage.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design stores one row per sample with a series identifier, timestamp, and value. It is easy to ingest, easy to inspect, and works well when the number of series is small.',
        'A second obvious design runs general-purpose compression over blocks of rows. That helps storage size, but it may compress across the wrong boundary if queries usually scan one series over one recent time range.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the hot working set. If one million series each produce one sample every 15 seconds, the system receives four million samples per minute before labels, indexes, and replicas are counted.',
        'Raw storage wastes the regularity of the data. Timestamps often advance by the same interval, counters and gauges often move slowly, and dashboards usually need sequential range scans rather than random updates inside old chunks.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compress each series as an ordered chunk that matches the query path. Store the first timestamp and first value exactly, then encode later timestamps and values as changes from the previous sample.',
        'The data structure is not just a smaller file. It is a per-series chunk with anchors, compact codes, and sequential decode behavior, so the storage layout matches dashboard and alert queries over recent windows.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For time, the encoder stores the first timestamp and the first delta. Each later timestamp is represented by delta-of-delta, meaning the new interval minus the previous interval.',
        'For values, the encoder stores the first 64-bit floating-point value exactly. Each later value is XORed with the previous value, and the codec records only the meaningful changed bit window when the XOR is not zero.',
        'Decoding is sequential. Start from the anchor timestamp and value, replay each timestamp code and XOR code, and recover the exact original samples without rounding.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The timestamp codec works because scheduled telemetry has predictable spacing. If a scrape runs every 15 seconds, most delta-of-delta values are zero, and zero can be represented with a tiny code.',
        'The value codec works because many measurements change slowly or repeat. XOR turns bit-level similarity into long runs of unchanged leading and trailing bits, and the stored changed window is enough to reconstruct the exact next value.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Write cost is constant per sample because the encoder compares only with the previous timestamp and value. Read cost for a time range is linear in the number of samples decoded from the chunk.',
        'The memory saving depends on behavior. A stable 15-second scrape with smooth values may need only a few bits for many samples, while jittery timestamps and noisy values move closer to raw size.',
        'The tradeoff is random access. To read the 500th sample, the decoder usually starts from an anchor and replays earlier codes unless the system stores extra checkpoints, which add memory and complexity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits observability systems that ingest counters, gauges, histograms, and service metrics. Recent chunks stay hot for dashboards, alert rules, and incident queries, while older data can be compacted, downsampled, or moved to colder storage.',
        'The broader lesson is to design compression around the access path. Logs, column stores, images, and time-series databases use different codecs because their repeated structure and query patterns are different.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The codec does not solve high cardinality. One million well-compressed series still require labels, indexes, retention policy, routing, and query planning.',
        'It also weakens when timestamps are irregular and values change unpredictably. If the data behaves like arbitrary events rather than scheduled measurements, a Gorilla-style chunk loses much of its advantage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose samples arrive at timestamps 1000, 1015, 1030, 1045, and 1061 seconds. The first timestamp is 1000, the first delta is 15, and the next delta-of-delta values are 0, 0, and 1.',
        'A raw 64-bit timestamp for five samples costs 320 bits. This encoding stores the first timestamp and first delta exactly, then stores two zeros and one small one-bit interval change, so the steady part nearly disappears.',
        'For values, suppose a gauge reads 71.20, 71.20, 71.25, and 71.26. The repeated 71.20 can be stored as an XOR-zero case, while the small moves store only changed bit windows; the savings come from similarity, not from accepting approximate values.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Gorilla VLDB paper at https://www.vldb.org/pvldb/vol8/p1816-teller.pdf, the Beringei engineering writeup at https://engineering.fb.com/2017/02/03/core-infra/beringei-a-high-performance-time-series-storage-engine/, and Prometheus TSDB chunk encoding docs at https://pkg.go.dev/github.com/prometheus/prometheus/tsdb/chunkenc. These sources connect the codec to real monitoring workloads.',
        'Study delta encoding, XOR compression, Prometheus TSDB chunks, write-ahead logs, LSM trees, and t-digest next. The important habit is to ask which regularity the codec expects and which query path it serves.',
      ],
    },
  ],
};
