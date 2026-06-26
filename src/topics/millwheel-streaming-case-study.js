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
      heading: 'How to read the animation',
      paragraphs: [
        'The stream-graph view follows one keyed record through input, computation, persistent state, timer, output, and acknowledgment. A key is the partitioning value, such as campaign id or account id, that decides which state the record may update. Active nodes are doing the current effect, found nodes are durable, and compare nodes show where replay could repeat work.',
        'The watermark-and-timer view separates event time from processing time. Event time is when the data says the event happened; processing time is when the system sees it. The safe inference is that a timer may fire when the watermark passes its time, but late data still follows the declared policy.',
        {type:'callout', text:'MillWheel makes streaming correct by coupling per-key state, timers, input acknowledgments, and output effects into one replay-safe contract.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many useful computations cannot wait for a daily batch. Ads, fraud signals, monitoring events, and user actions arrive continuously, and the business wants current counters, alerts, and decisions. A stream processor must handle unbounded input while machines fail and records arrive out of order.',
        'MillWheel exists because stateful streaming is not just a queue plus callbacks. Per-key counters, session windows, joins, and alerts all remember history. Once state and outputs matter, replay after failure can corrupt answers unless the runtime owns the processing contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is a message queue feeding workers. A worker reads a record, updates memory, emits output, and acknowledges the message. If the worker crashes, the queue redelivers records that were not acknowledged.',
        'That works for stateless parsing or routing. It is also easy to operate at first because the queue owns retry and workers own code. The design becomes fragile when the worker memory is part of the answer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is failure between effects. A worker can update a per-key count and crash before acknowledging input, so replay may count the record twice. It can emit an alert and crash before recording progress, so replay may emit the alert twice.',
        'Time adds a separate wall. A click with event time 10:01 can arrive after records from 10:04. If the system closes the 10:01 window too early, it misses the click; if it waits forever, users never see results. Streaming needs a time-progress signal and a late-data policy.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'MillWheel makes per-key state, timers, acknowledgments, and output effects one runtime contract. A record is safely processed only when the dependent state and output commitments are durable enough for recovery. User code is not expected to rebuild those guarantees from raw queue behavior.',
        'The key is the unit of order and recovery. Millions of keys can be distributed across machines, but each key has a durable logical history. Timers become part of that history, so a crash cannot erase the future callback that closes a window or expires old state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A computation receives records from input streams and emits records to output streams. Each record carries a key, and user code reads or writes persistent state for that key. If a worker fails, another worker can recover the key state and continue.',
        'The runtime tracks progress and duplicate suppression around input records. Timers are stored durably and fire when processing policy says they are eligible. Low watermarks move event-time progress through the graph so computations can emit window results without waiting forever.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts with per-key serialization. If updates for one key are applied through one logical state record, user code can reason about that key as a sequence even while other keys run elsewhere. Distribution changes placement, not the meaning of the key history.',
        'The replay invariant is that repeated physical work must not repeat the logical effect. A retried record should not create a second count increment or a second external output if the first attempt already committed. Systems implement this with record ids, persisted progress, transactional sinks, or idempotency keys, but the required property is the same.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is coordination on every stateful effect. Durable state writes add latency, timers consume storage and scan work, and duplicate-suppression metadata grows with the replay horizon. Doubling the number of active keys can double state entries even if total event rate stays flat.',
        'Watermarks trade latency against completeness. A conservative watermark delays output because the system waits longer for late data. An aggressive watermark emits sooner but increases late corrections or drops. The behavior is a policy choice, not a constant hidden behind O notation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MillWheel-style systems fit ad counters, fraud scoring, monitoring, abuse detection, online features, sessionization, streaming joins, and near-real-time personalization. The access pattern is many keyed histories updated incrementally by an unbounded event stream. Each key needs memory, time, and recovery semantics.',
        'The same ideas appear in later systems such as Google Dataflow, Apache Beam, and Apache Flink. The vocabulary differs, but the work stays familiar: keyed state, event time, timers, windows, watermarks, checkpoints, and output guarantees. MillWheel is useful because it exposes the contract early and plainly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Key skew can break the scaling model. If one campaign or account receives 40 percent of all events, one key becomes hot even if the cluster has many workers. Splitting that key requires changing the application semantics or adding a pre-aggregation layer.',
        'External side effects are another weak point. A runtime can make internal state replay-safe, but an email API or payment API may not support atomic commit with stream progress. The system then needs idempotency keys, transactional sinks, or an honest weaker guarantee.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A click pipeline groups by campaign id and emits one-minute counts. Campaign 9 receives records r1 at 10:00:12 and r2 at 10:00:40, so state count becomes 2 and a timer is set for 10:01:00. If the worker crashes after r2, recovery must not let replay count r2 again.',
        'At processing time 10:01:08, the watermark passes 10:01:00 and the timer fires with count 2. A late click r3 with event time 10:00:50 arrives at 10:01:20. The application policy decides whether to emit a correction count of 3, drop r3, or keep the window open longer next time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Google MillWheel paper at https://research.google.com/pubs/archive/41378.pdf, the Google Research page at https://research.google/pubs/millwheel-fault-tolerant-stream-processing-at-internet-scale/, and the ACM DOI at https://dl.acm.org/doi/10.14778/2536222.2536229. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Google Dataflow Model for event-time windows, Kafka Log for durable input, Flink Checkpointing for barrier snapshots, RocksDB LSM for keyed state stores, Two-Phase Commit for external sinks, and Backpressure and Flow Control for slow downstream behavior. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};