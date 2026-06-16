// MillWheel case study: Google's low-latency stream processor before Dataflow,
// centered on per-key persistent state, logical time, watermarks, and exactly-once effects.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'millwheel-streaming-case-study',
  title: 'MillWheel Streaming Case Study',
  category: 'Papers',
  summary: 'MillWheel as the streaming-systems lesson: per-key state, logical time, watermarks, timers, and fault-tolerant delivery.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stream graph and state', 'watermarks and timers'], defaultValue: 'stream graph and state' },
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

function streamGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input stream', x: 0.8, y: 4.0, note: 'records' },
      { id: 'parse', label: 'parse', x: 2.6, y: 4.0, note: 'node' },
      { id: 'keyed', label: 'per-key state', x: 4.6, y: 2.2, note: 'persistent' },
      { id: 'window', label: 'window/timer', x: 4.6, y: 5.8, note: 'logical time' },
      { id: 'sink', label: 'output', x: 6.7, y: 4.0, note: 'ack after commit' },
      { id: 'store', label: 'state store', x: 8.5, y: 2.8, note: 'checkpoint' },
      { id: 'watermark', label: 'watermark', x: 8.5, y: 5.2, note: 'time bound' },
    ],
    edges: [
      { id: 'e-input-parse', from: 'input', to: 'parse', weight: 'deliver' },
      { id: 'e-parse-keyed', from: 'parse', to: 'keyed', weight: 'by key' },
      { id: 'e-keyed-window', from: 'keyed', to: 'window', weight: 'update' },
      { id: 'e-window-sink', from: 'window', to: 'sink', weight: 'emit' },
      { id: 'e-keyed-store', from: 'keyed', to: 'store', weight: 'persist' },
      { id: 'e-watermark-window', from: 'watermark', to: 'window', weight: 'fire' },
    ],
  }, { title });
}

function* streamGraphAndState() {
  yield {
    state: streamGraph('MillWheel programs are streaming computation graphs'),
    highlight: { active: ['input', 'parse', 'keyed', 'window'], found: ['e-input-parse', 'e-parse-keyed'] },
    explanation: 'MillWheel lets users define a graph of computations over unbounded streams. The system manages persistent per-key state, delivery, timers, and failure recovery.',
  };

  yield {
    state: labelMatrix(
      'The central abstraction is keyed persistent state',
      [
        { id: 'key', label: 'key' },
        { id: 'state', label: 'state' },
        { id: 'timer', label: 'timer' },
        { id: 'output', label: 'output' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['campaign_id', 'partition work'],
        ['rolling count', 'survives crash'],
        ['window close', 'time-based emit'],
        ['anomaly alert', 'commit after state'],
      ],
    ),
    highlight: { found: ['state:why', 'timer:why'], active: ['key:example'] },
    explanation: 'Batch systems can recompute from files. Low-latency streaming needs per-key state that survives worker failure while records keep arriving.',
    invariant: 'A record should not be acknowledged until the state and output effects that depend on it are durable enough.',
  };

  yield {
    state: streamGraph('State and output must commit together enough to avoid duplicates'),
    highlight: { active: ['keyed', 'store', 'sink', 'e-keyed-store', 'e-window-sink'], compare: ['input'] },
    explanation: 'MillWheel focuses on exactly-once processing semantics for user code despite retries. That requires careful coordination between input acknowledgments, persistent state, and output production.',
  };

  yield {
    state: labelMatrix(
      'MillWheel in the streaming lineage',
      [
        { id: 'kafka', label: 'Kafka' },
        { id: 'millwheel', label: 'MillWheel' },
        { id: 'dataflow', label: 'Dataflow' },
        { id: 'spark', label: 'Spark RDD' },
      ],
      [
        { id: 'core', label: 'core lesson' },
        { id: 'unit', label: 'unit' },
      ],
      [
        ['durable log', 'partition offset'],
        ['stateful streaming', 'key + logical time'],
        ['event-time model', 'window + trigger'],
        ['lineage batch compute', 'partition'],
      ],
    ),
    highlight: { found: ['millwheel:core'], compare: ['kafka:core', 'dataflow:core'] },
    explanation: 'Kafka stores the stream, MillWheel computes with persistent keyed state, and Dataflow generalizes the event-time model. They are adjacent layers, not substitutes.',
  };
}

function* watermarksAndTimers() {
  yield {
    state: streamGraph('Watermarks estimate event-time completeness'),
    highlight: { active: ['watermark', 'window', 'e-watermark-window'], compare: ['input'] },
    explanation: 'A watermark is a system estimate: records with event times before this point are unlikely to arrive. It lets windows and timers fire without waiting forever.',
  };

  yield {
    state: labelMatrix(
      'Event-time record flow',
      [
        { id: 'r1', label: 'record A' },
        { id: 'r2', label: 'record B' },
        { id: 'wm', label: 'watermark' },
        { id: 'late', label: 'late record' },
      ],
      [
        { id: 'event_time', label: 'event time' },
        { id: 'processing_time', label: 'processing time' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['10:01', '10:02', 'update window'],
        ['10:02', '10:02', 'update window'],
        ['through 10:02', '10:03', 'fire timer'],
        ['10:01', '10:04', 'late policy'],
      ],
    ),
    highlight: { active: ['wm:effect'], compare: ['late:effect'] },
    explanation: 'Streaming correctness is not just record order. Event time can differ from processing time, so the system needs a policy for when to emit and what to do with late data.',
  };

  yield {
    state: labelMatrix(
      'Fault tolerance responsibilities',
      [
        { id: 'input', label: 'input delivery' },
        { id: 'state', label: 'state update' },
        { id: 'timer', label: 'timer' },
        { id: 'output', label: 'output record' },
      ],
      [
        { id: 'failure', label: 'failure risk' },
        { id: 'discipline', label: 'discipline' },
      ],
      [
        ['retry after crash', 'dedupe/ack rules'],
        ['lost update', 'persistent state'],
        ['forgotten window close', 'durable timers'],
        ['duplicate emit', 'idempotent/transactional output'],
      ],
    ),
    highlight: { found: ['state:discipline', 'timer:discipline'], active: ['output:discipline'] },
    explanation: 'Exactly-once streaming is a composition claim. Input, state, timers, and output must agree on what happened around crashes and retries.',
  };

  yield {
    state: labelMatrix(
      'What MillWheel teaches',
      [
        { id: 'time', label: 'time is data' },
        { id: 'state', label: 'state is durable' },
        { id: 'late', label: 'lateness is policy' },
        { id: 'output', label: 'effects need contracts' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'neighbor', label: 'study link' },
      ],
      [
        ['event time matters', 'Dataflow'],
        ['per-key persistence', 'RocksDB'],
        ['watermarks are estimates', 'Backpressure'],
        ['idempotency required', 'Exactly-once'],
      ],
    ),
    highlight: { found: ['time:lesson', 'state:lesson', 'output:lesson'], compare: ['late:neighbor'] },
    explanation: 'MillWheel is the bridge from message processing to stream processing. It makes time, state, and failure part of the programming model.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stream graph and state') yield* streamGraphAndState();
  else if (view === 'watermarks and timers') yield* watermarksAndTimers();
  else throw new InputError('Pick a MillWheel view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'MillWheel is Google\'s fault-tolerant stream-processing system for low-latency, stateful computation over unbounded streams. It predates and informs the Dataflow model.',
        'The case study matters because it treats event time, persistent per-key state, timers, and failure recovery as first-class streaming concepts.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Users define a computation graph. Records flow through nodes, are grouped by key, update persistent state, and may set timers. Watermarks estimate event-time completeness so windows and timers can fire.',
        'The system coordinates input acknowledgments, state persistence, timers, and outputs to provide strong processing semantics under retry and failure.',
        'A useful way to read MillWheel is as the point where a streaming framework stops pretending that callbacks are enough. Once the application remembers per-key history, emits derived records, and waits for event-time boundaries, the runtime must own a durable protocol around state and effects.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MillWheel pays for durable state, timer management, deduplication, watermark estimation, output coordination, and operational complexity. The payoff is low-latency stream processing where stateful applications can survive worker crashes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MillWheel-like ideas appear in Apache Beam/Dataflow, Flink, streaming anomaly detection, ad metrics, fraud detection, monitoring, online feature computation, and any system that combines message streams with durable keyed state.',
        'The same pattern appears in online machine-learning features: a stream updates a per-user or per-entity aggregate, timers close windows, and downstream serving systems need a value that survives worker crashes without double-counting records after retry.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A stream processor is not just a message queue with callbacks. Once state and time enter the problem, the system needs explicit contracts for lateness, retry, deduplication, checkpoints, and side effects.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google paper PDF at https://research.google.com/pubs/archive/41378.pdf, Google Research page at https://research.google/pubs/millwheel-fault-tolerant-stream-processing-at-internet-scale/, and ACM DOI at https://dl.acm.org/doi/10.14778/2536222.2536229. Study Google Dataflow Model Case Study, Kafka Log Case Study, Backpressure & Flow Control, Write-Ahead Log, t-digest Quantile Sketch, and RocksDB LSM Case Study next.',
      ],
    },
  ],
};
