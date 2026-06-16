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
      heading: 'What it is',
      paragraphs: [
        'The Google Dataflow Model is a programming and semantics model for massive-scale unbounded, out-of-order data processing. It makes event time, processing time, windows, watermarks, triggers, and accumulation modes explicit.',
        'The case study matters because streaming systems are not just batch systems that never stop. They must answer when a result is materialized, how late data changes it, and what tradeoff the user is making between correctness, latency, and cost.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Events carry event timestamps. The pipeline assigns events to windows such as fixed, sliding, session, or global windows. Watermarks estimate event-time progress. Triggers decide when panes are emitted. Accumulation modes define whether later panes replace or accumulate prior output.',
        'This lets batch and streaming use one model. Bounded data is just data with a known end; unbounded data needs explicit time semantics so that answers can be updated as reality arrives out of order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Holding state longer improves late-data correctness but costs memory and storage. Early triggers lower latency but may produce speculative answers and more sink updates. Dropping late data saves cost but can bias metrics. Watermarks are estimates, not proof that all data has arrived.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dataflow-style semantics appear in Apache Beam, Google Cloud Dataflow, streaming ETL, fraud detection, ad metrics, IoT processing, feature pipelines, sessionization, and real-time analytics. The model is especially important when downstream systems rely on point-in-time correctness.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Processing time is not event time. Kafka offset order is not business-time order. A low-latency answer is not automatically a correct answer. The model forces these decisions into explicit pipeline configuration instead of burying them in system behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research page at https://research.google/pubs/the-dataflow-model-a-practical-approach-to-balancing-correctness-latency-and-cost-in-massive-scale-unbounded-out-of-order-data-processing/ and paper PDF at https://research.google.com/pubs/archive/43864.pdf. Study Kafka Log Case Study, Delta Lake Case Study, Feature Store: Offline/Online Consistency, t-digest Quantile Sketch, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
