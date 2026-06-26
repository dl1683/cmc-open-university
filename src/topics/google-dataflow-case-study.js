// Google Dataflow model case study: event time, processing time, windows,
// watermarks, triggers, and accumulation modes for unbounded data.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'google-dataflow-case-study',
  title: 'Google Dataflow Model Case Study',
  category: 'Papers',
  summary: 'The Dataflow Model as the streaming-semantics lesson: event time, watermarks, windows, triggers, and late data.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['event time windows', 'watermarks and triggers'], defaultValue: 'event time windows' },
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

function pipeline(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'events', x: 0.7, y: 3.8, note: 'out of order' },
      { id: 'assign', label: 'assign event time', x: 2.5, y: 3.8, note: 'timestamps' },
      { id: 'window', label: 'window', x: 4.4, y: 3.8, note: 'fixed/session' },
      { id: 'trigger', label: 'trigger', x: 6.2, y: 2.2, note: 'when to emit' },
      { id: 'watermark', label: 'watermark', x: 6.2, y: 5.4, note: 'progress estimate' },
      { id: 'sink', label: 'sink', x: 8.5, y: 3.8, note: 'panes' },
    ],
    edges: [
      { id: 'e-source-assign', from: 'source', to: 'assign', weight: 'records' },
      { id: 'e-assign-window', from: 'assign', to: 'window', weight: 'event time' },
      { id: 'e-window-trigger', from: 'window', to: 'trigger', weight: 'pane state' },
      { id: 'e-watermark-trigger', from: 'watermark', to: 'trigger', weight: 'progress' },
      { id: 'e-trigger-sink', from: 'trigger', to: 'sink', weight: 'emit' },
    ],
  }, { title });
}

function* eventTimeWindows() {
  yield {
    state: labelMatrix(
      'Processing time order differs from event time order',
      [
        { id: 'e1', label: 'event A' },
        { id: 'e2', label: 'event B' },
        { id: 'e3', label: 'event C' },
        { id: 'e4', label: 'event D' },
      ],
      [
        { id: 'event_time', label: 'event time' },
        { id: 'arrival', label: 'arrival time' },
        { id: 'window', label: 'event-time window' },
      ],
      [
        ['10:01', '10:05', '[10:00,10:05)'],
        ['10:07', '10:08', '[10:05,10:10)'],
        ['10:03', '10:09', '[10:00,10:05) late'],
        ['10:12', '10:12', '[10:10,10:15)'],
      ],
    ),
    highlight: { active: ['e1:event_time', 'e3:event_time'], compare: ['e3:arrival'], found: ['e1:window', 'e3:window'] },
    explanation: 'The Dataflow Model separates event time from processing time. Event C arrived late, but it belongs to the same event-time window as A. Without this distinction, streaming answers are fast but semantically wrong.',
  };

  yield {
    state: pipeline('A streaming pipeline assigns timestamps, windows, and panes'),
    highlight: { active: ['source', 'assign', 'window', 'e-source-assign', 'e-assign-window'], compare: ['trigger', 'watermark'] },
    explanation: 'A pipeline maps unbounded events into windows. The central question is not only "what result?" but "when should the system materialize a result, and how should late refinements update it?"',
    invariant: 'Window assignment is based on event time, not arrival time.',
  };

  yield {
    state: labelMatrix(
      'Window types answer different product questions',
      [
        { id: 'fixed', label: 'fixed window' },
        { id: 'sliding', label: 'sliding window' },
        { id: 'session', label: 'session window' },
        { id: 'global', label: 'global window' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['per five-minute count', 'simple but boundary artifacts'],
        ['rolling trend', 'more duplicate work'],
        ['user activity session', 'dynamic merging'],
        ['all-time state', 'needs triggers and state control'],
      ],
    ),
    highlight: { found: ['fixed:question', 'session:question'], compare: ['sliding:cost', 'global:cost'] },
    explanation: 'Windowing is a product decision encoded as a systems primitive. The right window depends on what users need to trust, not just what is cheap to compute.',
  };

  yield {
    state: labelMatrix(
      'Batch and stream become one model',
      [
        { id: 'bounded', label: 'bounded data' },
        { id: 'unbounded', label: 'unbounded data' },
        { id: 'dataflow', label: 'Dataflow model' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'semantic', label: 'semantic tool' },
      ],
      [
        ['finite files', 'batch windows'],
        ['endless events', 'windows + triggers + watermarks'],
        ['same transforms', 'explicit time semantics'],
      ],
    ),
    highlight: { found: ['dataflow:input', 'dataflow:semantic'], compare: ['bounded:semantic', 'unbounded:semantic'] },
    explanation: 'The model unifies batch and streaming by making time semantics explicit. The same transform can run on bounded or unbounded data if windowing and triggering are specified.',
  };
}

function* watermarksAndTriggers() {
  yield {
    state: pipeline('Watermarks estimate event-time completeness'),
    highlight: { active: ['watermark', 'trigger', 'e-watermark-trigger'], found: ['sink'] },
    explanation: 'A watermark is the system\'s estimate that it has probably seen all events up to some event time. It is not a guarantee; it is an operational estimate used to balance latency and correctness.',
  };

  yield {
    state: labelMatrix(
      'Triggers decide when panes are emitted',
      [
        { id: 'early', label: 'early pane' },
        { id: 'on_time', label: 'on-time pane' },
        { id: 'late', label: 'late pane' },
        { id: 'final', label: 'final state' },
      ],
      [
        { id: 'condition', label: 'condition' },
        { id: 'answer', label: 'answer' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['processing-time timer', 'fast estimate', 'may revise'],
        ['watermark passes window end', 'main result', 'still can be late'],
        ['late event arrives', 'correction pane', 'more sink updates'],
        ['allowed lateness expires', 'close window', 'drops later data'],
      ],
    ),
    highlight: { active: ['early:answer', 'on_time:answer', 'late:answer'], found: ['final:condition'] },
    explanation: 'Triggers let the pipeline emit early approximate answers, on-time answers, and late corrections. Accumulation mode decides whether later panes replace prior output or add to it.',
  };

  yield {
    state: labelMatrix(
      'Correctness, latency, and cost are linked',
      [
        { id: 'correct', label: 'correctness' },
        { id: 'latency', label: 'latency' },
        { id: 'cost', label: 'cost' },
        { id: 'product', label: 'product choice' },
      ],
      [
        { id: 'want', label: 'want' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['include late data', 'keep state longer'],
        ['emit quickly', 'more speculative panes'],
        ['store less state', 'drop or compact history'],
        ['choose explicitly', 'no free lunch'],
      ],
    ),
    highlight: { active: ['correct:pressure', 'latency:pressure', 'cost:pressure'], found: ['product:want'] },
    explanation: 'The paper\'s lasting lesson is that streaming is a three-way tradeoff. Users need an explicit contract for correctness, latency, and cost, otherwise the system hides policy in defaults.',
  };

  yield {
    state: labelMatrix(
      'Where it connects',
      [
        { id: 'kafka', label: 'Kafka' },
        { id: 'delta', label: 'Delta Lake' },
        { id: 'feature', label: 'Feature Store' },
        { id: 'tdigest', label: 't-digest' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'risk', label: 'risk if ignored' },
      ],
      [
        ['event streams', 'offset time mistaken for event time'],
        ['streaming table sink', 'duplicate or late commits'],
        ['point-in-time features', 'training-serving skew'],
        ['streaming quantiles', 'wrong p99 window'],
      ],
    ),
    highlight: { found: ['kafka:connection', 'feature:risk', 'tdigest:risk'], active: ['delta:connection'] },
    explanation: 'Dataflow semantics are the glue between event logs, table sinks, feature stores, and online metrics. The window contract determines what downstream systems can safely believe.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'event time windows') yield* eventTimeWindows();
  else if (view === 'watermarks and triggers') yield* watermarksAndTriggers();
  else throw new InputError('Pick a Google Dataflow view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a timeline split into two clocks. Event time is when the business event happened, while processing time is when a worker saw the record and had a chance to compute.',
        'The safe inference is that a record belongs to the window chosen by its event timestamp, not by its arrival order. A watermark is only a progress estimate, so a late pane can still revise a result after an on-time pane has already been emitted.',
        {type:'callout', text:'Dataflow makes time a first-class contract by separating event time, processing time, watermarks, triggers, and correction policy.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A stream processor handles data that has no natural end. Purchases, ad clicks, sensor readings, and logs keep arriving, and many of them arrive late because devices buffer, networks retry, and queues reorder work.',
        'Google Dataflow exists because the useful question is often about when something happened in the real world. A checkout at 10:03 should count in the 10:00 to 10:05 business window even if it reaches the pipeline at 10:09.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to group records by the time they arrive at the worker. Count the last five minutes of arrivals, publish the number, and clear the state.',
        'That approach is simple and cheap because every record is handled once in arrival order. It can be acceptable for queue monitoring or worker throughput, where arrival time is the fact being measured.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when arrival order stops matching domain order. A mobile purchase can happen at 10:03, arrive at 10:09, and still be part of the 10:00 to 10:05 revenue answer.',
        'Waiting forever for perfect completeness is also wrong. The system would keep every window open, state would grow without bound, and dashboards would never show a useful current answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Dataflow separates four decisions that simple stream processors blend together. It asks what event time a record belongs to, which window contains it, when to emit a pane, and how later panes correct earlier panes.',
        'That separation turns streaming into a contract. The aggregation can stay the same, while the window, watermark, trigger, accumulation mode, and allowed lateness state how the answer becomes visible over time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each record enters with a timestamp from the source or from pipeline logic. A window function maps that timestamp to a fixed, sliding, or session window, which makes an unbounded stream finite enough to aggregate.',
        'A watermark estimates that the input has probably advanced past some event time. A trigger uses the watermark, processing-time timers, or element counts to emit early, on-time, or late panes.',
        'Accumulation mode defines what each pane means. Discarding mode emits only the new contribution, accumulating mode emits the running total, and retracting designs give downstream systems enough information to replace an older answer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that every record is assigned by a stable event-time rule before aggregation. If two records have timestamps inside the same five-minute window, they affect the same logical result even when they arrive in different processing-time order.',
        'Triggers do not change the meaning of the aggregate; they change when partial knowledge is exposed. Late panes are correct when the sink can identify the same window and apply the documented correction policy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is state held per key and window. If one million user keys each keep a five-minute count, the pipeline stores one million counters plus timers and checkpoint metadata until the lateness horizon expires.',
        'When allowed lateness doubles, the amount of retained window state can nearly double for the same input rate. Early triggers reduce visible latency but increase sink writes, so a dashboard that emits every minute over a ten-minute window may write ten provisional versions before the final answer.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dataflow-style semantics fit advertising metrics, fraud features, billing windows, observability rollups, IoT telemetry, sessionization, and machine-learning feature stores. These systems care about event time because late data can change revenue, alerts, model inputs, or audit records.',
        'The model is also useful when the same logic must run over historical files and live streams. A batch backfill and a streaming job can share the transform while using different watermarks, triggers, and lateness policies.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The model fails when timestamps are untrustworthy. If producers mix device clock time, ingestion time, and server time, event-time correctness becomes a clean abstraction over dirty facts.',
        'It is also heavy for jobs where arrival order is the business truth. A work queue that measures how fast workers drain messages may not need windows, watermarks, or correction panes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the pipeline counts purchases in five-minute event-time windows. Records A, B, C, and D have event times 10:01, 10:04, 10:07, and 10:03, but they arrive at 10:02, 10:04, 10:08, and 10:09.',
        'A processing-time counter reports two purchases in the 10:00 to 10:05 arrival window and two in the 10:05 to 10:10 arrival window. A Dataflow counter reports three purchases for 10:00 to 10:05 and one for 10:05 to 10:10, with D emitted as a late correction if the watermark had already passed 10:05.',
        'If state for each open window costs 64 bytes and there are 500,000 active keys, one extra open window costs about 32 MB before checkpoint overhead. That number is why allowed lateness is an economic decision, not just a correctness setting.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Google Dataflow paper at https://research.google.com/pubs/archive/43864.pdf and the Google Research publication page at https://research.google/pubs/the-dataflow-model-a-practical-approach-to-balancing-correctness-latency-and-cost-in-massive-scale-unbounded-out-of-order-data-processing/. Apache Beam, Apache Flink, and Spark Structured Streaming show production versions of the same timing problems.',
        'Study streaming watermarks next for progress estimation, then backpressure for overloaded workers, distributed snapshots for checkpointing, Kafka logs for source ordering, and feature stores for point-in-time training correctness.',
      ],
    },
  ],
};
