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
      heading: 'Why this exists',
      paragraphs: [
        'MillWheel exists because many useful computations do not arrive as neat daily files. Ads are clicked now, fraud signals arrive now, monitoring events arrive now, and users expect dashboards or alerts before the next batch job. A streaming system has to process an unbounded input while machines fail, messages repeat, and events arrive out of order.',
        'A stateless stream processor is simple. Read a message, run a callback, emit a result, acknowledge the message. That model works for filtering, parsing, and routing. It fails for the workloads that made MillWheel important: per-user counters, session windows, anomaly detectors, joins against recent history, and alerts that depend on what happened earlier for the same key.',
        'The real problem is state plus time plus failure. If a worker increments a per-key count and crashes before the update is durable, the next worker may miss the event. If it emits an alert and then crashes before acknowledging input, replay may emit the alert again. If event time differs from processing time, a window can close before a late record arrives. MillWheel treats those problems as the streaming contract rather than as application footnotes.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The first reasonable attempt is to put a message queue in front of a fleet of workers. Each worker reads a record, updates memory, writes output, and acknowledges the record. If a worker fails, the queue redelivers unacknowledged records. This gives at-least-once processing with a small amount of infrastructure, and for stateless tasks it is often enough.',
        'The wall appears as soon as memory becomes part of correctness. Suppose a campaign counter is kept in worker RAM. Rebalancing moves the campaign to another worker and the count disappears. Persist the count after every record and another problem appears: the record may be retried after the state update but before the output is acknowledged. The count is now too high unless the system can identify and suppress duplicate effects.',
        'Time creates a second wall. Processing order is not event order. A click from 10:01 can arrive after the system has already processed 10:03 records. If a five-minute window emits when processing time reaches 10:05, it may miss delayed events. If it waits forever, output never becomes final. A streaming system needs a principled estimate of event-time progress and a policy for late data.',
        'MillWheel is the point where streaming becomes a distributed systems problem. It is not just faster batch. It is a runtime for computations that remember keyed history, schedule event-time work, and recover from crashes without letting retries corrupt state or outputs.',
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        'MillWheel programs are graphs of computations over streams. Records enter the graph, computations transform or route them, and state is partitioned by key. The key is the unit that lets the system scale and recover: all records for the same logical entity can update the same persistent state, while different keys can be distributed across workers.',
        'The core insight is that state, timers, and acknowledgments must be part of one processing discipline. A record is not safely handled just because user code ran. It is safely handled when the state changes and output commitments that depend on it are durable enough for the system to survive replay.',
        'MillWheel also makes logical time explicit. Event time is a property of the data. Processing time is when the system happens to see the data. Low watermarks estimate how far event time has advanced. Timers let user code ask the system to call back when a logical time boundary is reached. This is the model later generalized by the Dataflow and Beam programming model.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A MillWheel computation receives records from input streams and emits records to output streams. Each record has a key. User code can read and write persistent state for that key. State is not an optional cache; it is the durable memory of the computation. If a worker fails, another worker can recover the key state and continue processing future records.',
        'The runtime tracks delivery and duplicate suppression. In a retrying system, a downstream computation may see a record more than once unless the system records enough identity and progress information to recognize repeats. MillWheel was designed so user code can be written against strong processing semantics rather than manually building deduplication into every operator.',
        'Timers are stored durably as well. A window close timer is part of the computation state. If a worker crashes after setting the timer, the recovered worker must still fire it. This matters for windows, stale-session cleanup, delayed alerts, and joins where old state must eventually expire.',
        'Low watermarks carry event-time progress through the graph. They are not proofs that no earlier event can ever appear. They are system estimates that let computations make progress. When a low watermark passes a window end, the system can fire timers for that window. Late data then follows the application policy: update a correction, drop the event, emit a late result, or keep extra state until a longer allowed-lateness horizon expires.',
        'Outputs are coordinated with state updates. If a computation updates per-key state and emits a derived record, recovery must not lose one effect while keeping the other. MillWheel makes this a runtime responsibility. Modern systems express the same idea through checkpointed state, transactional sinks, idempotent writes, or exactly-once protocols over replayable logs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an advertising metric pipeline. Each click record has a campaign id, an event timestamp, and a unique record id. The computation groups by campaign id, updates a rolling count, and emits an aggregate for each minute. A worker sees two clicks for campaign 9, updates the count in persistent state, and sets a timer for the minute boundary.',
        'Now the worker crashes after processing the second click. If the input system redelivers that click, the recovered computation must not count it twice. The runtime needs a record identity or equivalent progress marker tied to the state update. If the timer had already been registered, it must survive as well. If the output aggregate was emitted before the crash, downstream handling must avoid making the output effect twice.',
        'Add event time. A click with event time 10:01 arrives at processing time 10:04. The 10:01 window may still be open if the low watermark has not passed the end of that window. Later, the watermark moves past 10:02 and the timer fires. The computation emits the aggregate for the window. A still-later 10:01 click is late data. The page should teach that lateness is not a bug in the queue. It is a normal property of distributed event streams, and the system needs a declared policy for it.',
        'The same structure appears in fraud detection. The key is a card or account. State holds recent transaction counts and amounts. Timers expire old events from the rolling window. Alerts are output records. A failure between state update and alert emission cannot be allowed to produce a missed alert or an uncontrolled duplicate. The whole pipeline rests on the contract between keyed state, replay, timers, and output effects.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument starts with per-key serialization. If all updates for a key are applied through a single logical state record, then user code can reason about that key as a sequence. The system may distribute millions of keys across workers, but each key still has a durable history.',
        'The second invariant is replay safety. A retried record must not create a new logical effect if the previous attempt already committed that effect. Systems implement this with record identifiers, persisted progress, transactional writes, or idempotent output protocols. The exact mechanism differs, but the required property is the same: recovery may repeat physical work, but it should not repeat the logical state transition.',
        'The third invariant is event-time monotonicity through watermarks. A watermark only moves forward. Computations can use that monotone signal to decide when a class of timers is eligible to fire. The signal is an estimate, so late data policy remains part of the application contract. The system is correct when it applies that policy consistently, not when it pretends late data cannot exist.',
        'MillWheel works because it refuses to hide these invariants inside user callbacks. It gives the runtime ownership of persistent state, timers, and delivery coordination. That is the difference between a library that processes messages and a stream processor that can run stateful applications at scale.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The price of MillWheel-style streaming is coordination. Durable state writes add latency and storage load. Deduplication metadata consumes space. Timers must be stored, sharded, scanned, and recovered. Watermarks can be too conservative, delaying output, or too aggressive, increasing late data. Output guarantees depend on sinks that can participate in the contract.',
        'Key skew is a practical limit. Partitioning by key scales only if the hot keys are not too hot. A single campaign, account, customer, or device can receive enough traffic to dominate one worker. The system can move keys across workers, but it cannot split one key without changing the user-visible semantics. Heavy-key mitigation often needs application-level aggregation, salting, or a different data model.',
        'State growth is another tax. Windowed computations need retention rules. Joins need expiration. Fraud and feature pipelines need enough history to be useful but not so much that every key becomes a long-lived storage leak. A stream processor that can keep state forever will eventually be asked to keep too much state unless the application names its cleanup policy.',
        'Exactly-once language also hides sink complexity. A runtime can make its internal state replay-safe, but an external email API, payment API, or database may not support atomic commit with the stream processor. In those cases the system must use idempotency keys, transactional sinks, or accept weaker semantics. The honest question is always end-to-end: what happens if the process crashes after the side effect but before progress is recorded?',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'MillWheel-like systems win when the application needs low-latency stateful decisions over unbounded streams. Ad metrics, fraud scoring, monitoring, abuse detection, online feature computation, sessionization, streaming joins, and near-real-time personalization all fit the pattern. The common access pattern is many keyed histories updated incrementally by incoming events.',
        'They are a poor fit for computations that only need occasional full-table recomputation, heavy global optimization, or simple stateless event routing. Batch systems are often cheaper and easier for large historical backfills. A message queue plus stateless workers is often enough for enrichment or notification dispatch. A database trigger or materialized view may be better when the source of truth is already a transactional database and the scale is modest.',
        'A common misconception is that streaming is only about lower latency. MillWheel shows that the deeper issue is correctness under continuous change. Once a program uses event time, per-key state, and external effects, the runtime has to specify how time advances, how state survives, and how replay is made safe. Without those contracts, low latency just produces wrong answers sooner.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The stream graph view shows the real unit of work: a record arrives, is routed by key, updates durable state, may set a timer, and emits output only under a replay-safe discipline. The point is not the arrows themselves. The point is that state and output are coupled through failure recovery.',
        'The watermarks and timers view shows why a stream processor needs two clocks. Processing time is when the system sees records. Event time is when the records say the events happened. Watermarks let the runtime make bounded progress in event time, and late data policy handles the cases where the estimate was not enough.',
        'The recovery rows are the important part to keep in mind. Input retry, state persistence, durable timers, and output contracts must agree. If any one of those layers is weaker than the rest, the pipeline inherits the weaker guarantee.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Google paper PDF at https://research.google.com/pubs/archive/41378.pdf, Google Research page at https://research.google/pubs/millwheel-fault-tolerant-stream-processing-at-internet-scale/, and ACM DOI at https://dl.acm.org/doi/10.14778/2536222.2536229.',
        'Study Google Dataflow Model Case Study next for the programming model that grew out of these ideas: event time, windows, triggers, and allowed lateness. Study Kafka Log Case Study to separate durable event storage from stateful stream computation. Study Flink Checkpointing Case Study to see barrier snapshots as a different execution mechanism for similar goals. Study Backpressure & Flow Control because watermarks and checkpoints both suffer when downstream work slows. Study RocksDB LSM Case Study because many stream processors store keyed state in LSM-backed state stores. Study Two-Phase Commit when external sinks need stronger end-to-end effects.',
      ],
    },
  ],
};
