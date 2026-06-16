// Streaming watermarks: event-time progress signals that let unbounded,
// out-of-order streams close windows without pretending arrival is sorted.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'streaming-watermarks',
  title: 'Streaming Watermarks',
  category: 'Systems',
  summary: 'Event-time progress for stream processors: watermarks estimate completeness, trigger windows, and define how late data is handled.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['event time progress', 'late data policy'], defaultValue: 'event time progress' },
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

function watermarkGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'src', x: 0.4, y: 3.6, note: 'unordered' },
      { id: 'assign', label: 'time', x: 3.0, y: 3.6, note: 'event stamp' },
      { id: 'wm', label: 'wm', x: 5.2, y: 3.6, note: '<= t done' },
      { id: 'window', label: 'window', x: 7.0, y: 2.1, note: '[10:00, 10:05)' },
      { id: 'trigger', label: 'trigger', x: 7.0, y: 5.1, note: 'emit pane' },
      { id: 'sink', label: 'sink', x: 9.2, y: 3.6, note: 'results' },
    ],
    edges: [
      { id: 'e-source-assign', from: 'source', to: 'assign', weight: '' },
      { id: 'e-assign-wm', from: 'assign', to: 'wm', weight: '' },
      { id: 'e-wm-window', from: 'wm', to: 'window', weight: '' },
      { id: 'e-window-trigger', from: 'window', to: 'trigger', weight: '' },
      { id: 'e-trigger-sink', from: 'trigger', to: 'sink', weight: '' },
      { id: 'e-assign-window', from: 'assign', to: 'window', weight: '' },
    ],
  }, { title });
}

function* eventTimeProgress() {
  yield {
    state: watermarkGraph('Events arrive in processing time but belong to event time'),
    highlight: { active: ['source', 'assign', 'e-source-assign'], compare: ['wm'] },
    explanation: 'Streaming systems separate event time from processing time. A click at 10:01 can arrive after a click at 10:03 because networks, devices, and queues reorder reality.',
  };

  yield {
    state: labelMatrix(
      'Arrival versus event time',
      [
        { id: 'e0', label: 'event A' },
        { id: 'e1', label: 'event B' },
        { id: 'e2', label: 'event C' },
        { id: 'wm', label: 'watermark' },
      ],
      [
        { id: 'event', label: 'event time' },
        { id: 'arrival', label: 'arrival order' },
      ],
      [
        ['10:03', '1st'],
        ['10:01', '2nd'],
        ['10:04', '3rd'],
        ['10:02', 'progress signal'],
      ],
    ),
    highlight: { active: ['e1:event', 'wm:event'], found: ['wm:arrival'] },
    explanation: 'A watermark at time t declares that the stream believes no more events with timestamp <= t should arrive, within the system policy.',
    invariant: 'Watermarks are progress estimates, not wall-clock timestamps.',
  };

  yield {
    state: watermarkGraph('When the watermark passes a window end, the window can fire'),
    highlight: { active: ['wm', 'window', 'trigger', 'e-wm-window', 'e-window-trigger'], found: ['sink'] },
    explanation: 'Window operators use watermarks to decide when event-time windows are complete enough to emit an on-time result.',
  };

  yield {
    state: labelMatrix(
      'Time concepts',
      [
        { id: 'event', label: 'event time' },
        { id: 'processing', label: 'processing time' },
        { id: 'watermark', label: 'watermark' },
        { id: 'trigger', label: 'trigger' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'use', label: 'use' },
      ],
      [
        ['when fact happened', 'correct grouping'],
        ['when worker saw it', 'freshness timers'],
        ['event-time progress', 'close windows'],
        ['emit policy', 'early/on-time/late panes'],
      ],
    ),
    highlight: { found: ['watermark:meaning', 'trigger:use'], compare: ['processing:meaning'] },
    explanation: 'Watermarks do not replace triggers. The watermark says how complete event time looks; triggers decide when and how often to emit results.',
  };
}

function* lateDataPolicy() {
  yield {
    state: labelMatrix(
      'Late data choices',
      [
        { id: 'drop', label: 'drop' },
        { id: 'update', label: 'update result' },
        { id: 'side', label: 'side output' },
        { id: 'retract', label: 'retraction' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['discard too-late events', 'simple but lossy'],
        ['emit correction pane', 'downstream must merge'],
        ['route late facts', 'manual repair path'],
        ['withdraw old result', 'sink must support changes'],
      ],
    ),
    highlight: { active: ['update:behavior', 'retract:cost'], compare: ['drop:cost'] },
    explanation: 'Late data is a product decision as much as a systems decision. Accuracy, latency, and downstream complexity trade off.',
  };

  yield {
    state: watermarkGraph('Allowed lateness keeps windows around after on-time firing'),
    highlight: { active: ['window', 'trigger', 'sink', 'e-trigger-sink'], found: ['wm'] },
    explanation: 'A system can emit an on-time pane when the watermark passes the window end, then keep state for a lateness horizon to handle corrections.',
  };

  yield {
    state: labelMatrix(
      'Watermark failure modes',
      [
        { id: 'slow', label: 'slow watermark' },
        { id: 'fast', label: 'fast watermark' },
        { id: 'idle', label: 'idle partition' },
        { id: 'skew', label: 'source skew' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['windows wait too long', 'higher latency'],
        ['late data spikes', 'corrections or drops'],
        ['global progress stalls', 'idle-source detection'],
        ['one shard holds back all', 'per-partition watermarks'],
      ],
    ),
    highlight: { active: ['slow:symptom', 'fast:symptom'], found: ['idle:response'] },
    explanation: 'A watermark strategy can be too conservative or too optimistic. Either way, users experience the mistake as latency, missing data, or noisy corrections.',
  };

  yield {
    state: labelMatrix(
      'Case study: hourly billing',
      [
        { id: 'early', label: 'early pane' },
        { id: 'ontime', label: 'on-time pane' },
        { id: 'late', label: 'late pane' },
        { id: 'final', label: 'final close' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'why', label: 'why' },
      ],
      [
        ['processing-time timer', 'fresh estimate'],
        ['watermark passes hour', 'normal bill'],
        ['late event arrives', 'correction'],
        ['lateness horizon expires', 'state cleanup'],
      ],
    ),
    highlight: { found: ['ontime:when', 'late:why'], active: ['final:why'] },
    explanation: 'A complete streaming design states the pane policy, allowed lateness, state cleanup time, and downstream merge behavior.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'event time progress') yield* eventTimeProgress();
  else if (view === 'late data policy') yield* lateDataPolicy();
  else throw new InputError('Pick a streaming watermark view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A streaming watermark is an event-time progress signal. It tells a stream processor how far through event time the input appears to have advanced, even though records arrive out of order. Watermarks let systems close windows, fire results, and decide how to handle late data without pretending that processing time equals event time.',
        'Apache Flink documentation says watermarks measure progress in event time and that a Watermark(t) declares event time has reached t in that stream: https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/. Apache Beam describes watermarks as estimates of input completeness and triggers as the mechanism that governs when results emit: https://beam.apache.org/documentation/basics/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each event carries or receives an event timestamp. The source or timestamp assigner emits watermarks based on observed progress and expected disorder. A window operator groups events by event time. When the watermark passes the end of a window, the operator can emit an on-time pane. Triggers may also emit early panes for freshness and late panes for corrections.',
        'The Dataflow model made this separation explicit: what results are computed, where in event time they belong, when they are emitted, and how refinements are handled. The Google Dataflow paper frames the tradeoff as correctness, latency, and cost for unbounded out-of-order data: https://research.google.com/pubs/archive/43864.pdf.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A slow watermark delays output because windows wait. A fast watermark emits sooner but creates more late data. Idle partitions can hold back global progress. Skewed sources can make one shard define latency for everyone. Allowed lateness keeps state around so late corrections can be processed, but that state costs memory and checkpoint storage.',
        'Flink has APIs for generating watermarks and assigning timestamps: https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/event-time/generating_watermarks/. Beam triggers can fire after the watermark, early by processing time, or late when delayed data arrives: https://beam.apache.org/documentation/programming-guide/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider hourly billing from mobile events. Users go offline, devices batch uploads, and records arrive late. The pipeline groups by account and hour using event time. It emits early estimates every minute for dashboards, an on-time bill when the watermark passes the hour, and correction panes for events arriving within a two-hour lateness horizon. After that horizon, late events go to a side output for manual reconciliation or next-cycle adjustment.',
        'That design is explicit about user-visible behavior. It does not hide late data. It chooses how much state to retain, how quickly to emit, and how downstream sinks merge corrections.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A watermark is not a guarantee from the universe. It is a progress estimate produced by the system. If it is wrong, late data happens. Another misconception is that exactly-once checkpointing solves event-time correctness. Checkpointing protects state recovery; watermarks and triggers define when event-time results are considered complete enough to emit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Flink timely stream processing at https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/, Flink watermark generation at https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/event-time/generating_watermarks/, Beam basics at https://beam.apache.org/documentation/basics/, Beam programming guide triggers at https://beam.apache.org/documentation/programming-guide/, and the Dataflow paper at https://research.google.com/pubs/archive/43864.pdf. Study Feature Freshness SLO Monitor, Delayed Feedback Attribution Window Case Study, Point-in-Time Feature Join Index, Flink Checkpointing Case Study, Google Dataflow Model Case Study, MillWheel Streaming Case Study, Kafka Log Case Study, and Backpressure next.',
      ],
    },
  ],
};
