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
      heading: 'Why this exists',
      paragraphs: [
        `Streaming systems exist because useful facts arrive continuously: clicks, payments, sensor readings, logs, fraud signals, location updates, and device events. The hard part is that arrival order is not the same as event order. A phone can go offline and upload an hour of events later. A broker partition can lag. A retry can deliver an older message after a newer one. If a pipeline uses processing time as truth, it will count records in the hour they arrived, not the hour they happened.`,
        `A watermark is the system's event-time progress signal. It says that, for a stream or partition, the processor believes event time has advanced to a particular timestamp. That signal lets windowed computations decide when to emit an answer, when to accept a correction, and when to clean up state. Apache Flink describes watermarks as measuring progress in event time, and Apache Beam frames them as estimates of input completeness. The key word is estimate: a watermark is operational evidence, not a law of nature.`,
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The first attempt is to process each event as soon as it arrives and group it by the current clock time. That is simple and often good enough for operational counters such as "requests processed in the last minute." It fails for questions whose meaning belongs to event time: revenue for 2:00-3:00, rides that started before midnight, sensor readings during a storm cell, or ad conversions within seven days of an impression. Those answers should not change just because a device uploaded late.`,
        `A second attempt is to wait until the system is sure no late data can appear. For an unbounded stream, certainty may never arrive. Waiting forever gives perfect completeness and no product. Emitting immediately gives freshness and wrong finality. The wall is the missing progress contract: the system needs a disciplined way to say "this window is complete enough to publish now, and here is what we will do if older data still arrives."`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to separate three clocks that beginners often collapse: event time, processing time, and output time. Event time is when the fact happened. Processing time is when the machine sees it. Output time is when the system chooses to publish a pane. Watermarks connect these clocks without pretending they are identical. A Watermark(t) means the system is prepared to treat event times up to t as mostly observed, subject to its lateness policy.`,
        `This turns streaming from a vague "handle data as it comes" loop into a contract. Windows define where records belong in event time. Watermarks define when ordinary completion has advanced far enough. Triggers define when panes emit, including early estimates and late corrections. Allowed lateness defines how long state remains open for older records. The Dataflow model made these dimensions explicit: what is computed, where in event time it belongs, when it emits, and how refinements are handled.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A typical pipeline assigns an event timestamp to each record, either from the payload or from source metadata. A watermark generator watches source progress and disorder, then emits increasing watermark values. Operators group records into windows by event time. When the watermark passes a window end, the operator can produce an on-time pane. If the system allows lateness, a later record for that already-emitted window can produce a correction pane or be routed to a side output.`,
        `In a partitioned stream, the global watermark is often limited by the slowest active input because a lagging partition may still contain old event-time data. That is why idle-source detection matters: a quiet partition should not hold the entire job hostage forever. State cleanup also follows the contract. The operator cannot drop a window's state at the first on-time firing if late corrections are allowed. It can drop that state only after the lateness horizon has passed, or after a domain-specific reconciliation path takes over.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The event-time progress view proves why arrival order is not enough. Records arrive in one sequence but land in earlier or later event-time windows. The watermark line advances more carefully than the processing clock. A window does not become eligible because the wall clock moved past its end; it becomes eligible because the watermark crossed its event-time boundary. That distinction is the whole idea.`,
        `The late-data policy view proves that watermarking is not just a timestamp calculation. It is a product and storage decision. Early panes give dashboards freshness but may be revised. On-time panes give the ordinary answer when the watermark passes the window. Late panes preserve correctness within a declared horizon. Final cleanup releases memory and checkpoint load. The visual makes the trade explicit: a faster watermark lowers latency, while a slower watermark buys completeness at the cost of waiting.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Watermarks work because they give every event-time window a monotonic progress test. As long as watermarks move forward, a fixed window will eventually be behind the watermark or remain open because the system has not yet claimed enough progress. Operators can make local decisions from that shared signal: fire this window, hold that one, accept this late update, or clean up state. The output policy becomes reproducible instead of depending on accidental arrival timing.`,
        `The correctness is conditional on the chosen semantics. If the pipeline promises "final after two hours of allowed lateness," then a record five hours late is not part of the final result unless it flows through a separate correction channel. That is not a bug in the watermark; it is the published contract. Exactly-once checkpointing protects recovery of state and outputs, but it does not decide event-time completeness. Watermarks, triggers, accumulation mode, and lateness do that job.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The main cost is state. Every open window needs stored aggregates, timers, metadata, and checkpointed recovery data. Allowed lateness extends that lifetime. More keys, longer windows, and longer lateness horizons multiply memory and checkpoint pressure. If a pipeline keeps two hours of late correction state for millions of accounts, the cost is not abstract; it appears as heap, RocksDB state, checkpoint duration, restore time, and downstream correction traffic.`,
        `The main tradeoff is freshness against completeness. Conservative watermarks reduce late corrections but increase latency. Aggressive watermarks improve time-to-answer but produce more late records, more corrections, or more dropped data. Skewed partitions and idle sources can delay global progress. Backpressure can blur processing-time expectations even when event-time semantics are sound. Downstream systems must also be designed for panes: replacing, accumulating, retracting, or merging corrections is part of the architecture.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `Watermarks are central in stream analytics, billing, fraud detection, feature pipelines, monitoring, IoT aggregation, ad attribution, mobile telemetry, and CDC-derived materialized views. They are useful whenever the business question belongs to when the event happened rather than when it arrived. In an hourly billing pipeline, early panes can power dashboards, on-time panes can issue ordinary bills, and late panes can adjust accounts within a declared reconciliation window.`,
        `They fail when teams mistake estimates for guarantees. Bad timestamp extraction can put records in the wrong window. A source watermark that ignores offline clients can close windows too early. A global watermark can stall behind one idle partition if idleness is not configured. Late-data policies can be legally or financially wrong if they silently drop records that should trigger correction. The biggest conceptual failure is hiding the contract from users: if numbers can revise, dashboards, alerts, and invoices need to say so through their behavior.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources to read are Flink's event-time and watermark documentation, Flink watermark generation APIs, Beam basics and trigger documentation, and the Google Dataflow paper at https://research.google.com/pubs/archive/43864.pdf. In this curriculum, study Backpressure to understand why processing speed and event-time completeness are different, Flink Checkpointing Case Study for recovery semantics, Google Dataflow Case Study for the model behind panes and triggers, Feature Freshness SLO Monitor for operational freshness, Point-in-Time Feature Join Index for historical correctness, and Delayed Feedback Attribution Window Case Study for late outcomes in machine-learning systems.`,
      ],
    },
  ],
};
