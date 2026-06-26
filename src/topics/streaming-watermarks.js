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
  const graphNodes = [
    { id: 'source', label: 'src', x: 0.4, y: 3.6, note: 'unordered' },
    { id: 'assign', label: 'time', x: 3.0, y: 3.6, note: 'event stamp' },
    { id: 'wm', label: 'wm', x: 5.2, y: 3.6, note: '<= t done' },
    { id: 'window', label: 'window', x: 7.0, y: 2.1, note: '[10:00, 10:05)' },
    { id: 'trigger', label: 'trigger', x: 7.0, y: 5.1, note: 'emit pane' },
    { id: 'sink', label: 'sink', x: 9.2, y: 3.6, note: 'results' },
  ];
  const nodeCount = graphNodes.length;
  const sourceNote = graphNodes[0].note;
  const windowNote = graphNodes[3].note;

  const arrivalRows = [
    { id: 'e0', label: 'event A' },
    { id: 'e1', label: 'event B' },
    { id: 'e2', label: 'event C' },
    { id: 'wm', label: 'watermark' },
  ];
  const arrivalCols = [
    { id: 'event', label: 'event time' },
    { id: 'arrival', label: 'arrival order' },
  ];
  const arrivalValues = [
    ['10:03', '1st'],
    ['10:01', '2nd'],
    ['10:04', '3rd'],
    ['10:02', 'progress signal'],
  ];
  const eventCount = arrivalRows.length - 1;
  const wmTime = arrivalValues[3][0];

  const conceptRows = [
    { id: 'event', label: 'event time' },
    { id: 'processing', label: 'processing time' },
    { id: 'watermark', label: 'watermark' },
    { id: 'trigger', label: 'trigger' },
  ];
  const conceptCols = [
    { id: 'meaning', label: 'meaning' },
    { id: 'use', label: 'use' },
  ];
  const conceptValues = [
    ['when fact happened', 'correct grouping'],
    ['when worker saw it', 'freshness timers'],
    ['event-time progress', 'close windows'],
    ['emit policy', 'early/on-time/late panes'],
  ];
  const conceptCount = conceptRows.length;

  yield {
    state: watermarkGraph('Events arrive in processing time but belong to event time'),
    highlight: { active: ['source', 'assign', 'e-source-assign'], compare: ['wm'] },
    explanation: `The ${nodeCount}-node pipeline separates event time from processing time. A click at ${arrivalValues[1][0]} can arrive after a click at ${arrivalValues[0][0]} because networks, devices, and queues reorder the ${sourceNote} source reality.`,
  };

  yield {
    state: labelMatrix('Arrival versus event time', arrivalRows, arrivalCols, arrivalValues),
    highlight: { active: ['e1:event', 'wm:event'], found: ['wm:arrival'] },
    explanation: `A watermark at time t (here ${wmTime}) declares that across all ${eventCount} events the stream believes no more records with timestamp <= t should arrive, within the system policy.`,
    invariant: `Watermarks are progress estimates across ${arrivalCols.length} dimensions (${arrivalCols.map(c => c.label).join(', ')}), not wall-clock timestamps.`,
  };

  yield {
    state: watermarkGraph('When the watermark passes a window end, the window can fire'),
    highlight: { active: ['wm', 'window', 'trigger', 'e-wm-window', 'e-window-trigger'], found: ['sink'] },
    explanation: `Window operators use watermarks to decide when event-time windows like ${windowNote} are complete enough to emit an on-time result to the ${graphNodes[5].note} sink.`,
  };

  yield {
    state: labelMatrix('Time concepts', conceptRows, conceptCols, conceptValues),
    highlight: { found: ['watermark:meaning', 'trigger:use'], compare: ['processing:meaning'] },
    explanation: `Watermarks do not replace triggers. Across all ${conceptCount} time concepts, the watermark says "${conceptValues[2][0]}"; triggers decide when and how often to emit results via "${conceptValues[3][1]}".`,
  };
}

function* lateDataPolicy() {
  const policyRows = [
    { id: 'drop', label: 'drop' },
    { id: 'update', label: 'update result' },
    { id: 'side', label: 'side output' },
    { id: 'retract', label: 'retraction' },
  ];
  const policyCols = [
    { id: 'behavior', label: 'behavior' },
    { id: 'cost', label: 'cost' },
  ];
  const policyValues = [
    ['discard too-late events', 'simple but lossy'],
    ['emit correction pane', 'downstream must merge'],
    ['route late facts', 'manual repair path'],
    ['withdraw old result', 'sink must support changes'],
  ];
  const policyCount = policyRows.length;

  const failureRows = [
    { id: 'slow', label: 'slow watermark' },
    { id: 'fast', label: 'fast watermark' },
    { id: 'idle', label: 'idle partition' },
    { id: 'skew', label: 'source skew' },
  ];
  const failureCols = [
    { id: 'symptom', label: 'symptom' },
    { id: 'response', label: 'response' },
  ];
  const failureValues = [
    ['windows wait too long', 'higher latency'],
    ['late data spikes', 'corrections or drops'],
    ['global progress stalls', 'idle-source detection'],
    ['one shard holds back all', 'per-partition watermarks'],
  ];
  const failureCount = failureRows.length;

  const paneRows = [
    { id: 'early', label: 'early pane' },
    { id: 'ontime', label: 'on-time pane' },
    { id: 'late', label: 'late pane' },
    { id: 'final', label: 'final close' },
  ];
  const paneCols = [
    { id: 'when', label: 'when' },
    { id: 'why', label: 'why' },
  ];
  const paneValues = [
    ['processing-time timer', 'fresh estimate'],
    ['watermark passes hour', 'normal bill'],
    ['late event arrives', 'correction'],
    ['lateness horizon expires', 'state cleanup'],
  ];
  const paneCount = paneRows.length;

  yield {
    state: labelMatrix('Late data choices', policyRows, policyCols, policyValues),
    highlight: { active: ['update:behavior', 'retract:cost'], compare: ['drop:cost'] },
    explanation: `Late data is a product decision as much as a systems decision. All ${policyCount} policies (${policyRows.map(r => r.label).join(', ')}) trade off accuracy, latency, and downstream complexity.`,
  };

  yield {
    state: watermarkGraph('Allowed lateness keeps windows around after on-time firing'),
    highlight: { active: ['window', 'trigger', 'sink', 'e-trigger-sink'], found: ['wm'] },
    explanation: `A system can emit an on-time pane when the watermark passes the window end, then keep state for a lateness horizon to handle ${policyValues[1][0]}s and ${policyValues[3][0]}s.`,
  };

  yield {
    state: labelMatrix('Watermark failure modes', failureRows, failureCols, failureValues),
    highlight: { active: ['slow:symptom', 'fast:symptom'], found: ['idle:response'] },
    explanation: `A watermark strategy can fail in ${failureCount} ways. A ${failureRows[0].label} causes "${failureValues[0][0]}"; a ${failureRows[1].label} causes "${failureValues[1][0]}". Either way, users experience the mistake as latency, missing data, or noisy corrections.`,
  };

  yield {
    state: labelMatrix('Case study: hourly billing', paneRows, paneCols, paneValues),
    highlight: { found: ['ontime:when', 'late:why'], active: ['final:why'] },
    explanation: `A complete streaming design covers all ${paneCount} pane stages. The ${paneRows[1].label} fires when "${paneValues[1][0]}", while ${paneRows[3].label} triggers "${paneValues[3][1]}" after the lateness horizon expires.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each event as having two times. Event time is when the fact happened, and processing time is when the machine sees it. The watermark line is the system estimate of event-time progress, so a window becomes eligible when the watermark passes the window end.',
        'Active records are being assigned to windows, found windows are ready to emit, and late records arrive after the ordinary on-time result. The safe inference is contractual: if the watermark passes 10:05, the system is willing to publish the 10:00 to 10:05 window under its lateness policy. It is not claiming that late data is physically impossible.',
        {type: 'image', src: './assets/gifs/streaming-watermarks.gif', alt: 'Animated walkthrough of the streaming watermarks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Streaming systems process facts that keep arriving, such as clicks, payments, sensor readings, logs, and mobile events. Arrival order is not event order because devices go offline, brokers lag, and retries can deliver old records after new records. If a pipeline groups by machine clock, it answers when records arrived rather than when they happened.',
        {type: 'callout', text: `A watermark is a promise about event-time progress, not a promise that the physical world has stopped producing late facts.`},
        'Watermarks exist to let event-time windows finish without waiting forever. A window is a bounded interval of event time, such as 10:00 to 10:05. The watermark gives operators a shared progress signal for emitting ordinary results, accepting late corrections, and eventually deleting state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to process each record when it arrives and group it by current wall-clock time. That works for operational counters such as requests processed in the last minute. It fails for revenue, attribution, fraud, and sensor questions whose meaning belongs to when the event happened.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation showing packets moving through a network path', caption: 'Packet networks make arrival order unstable; stream processors need event-time semantics because transport and retry paths can reorder facts. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.'},
        'A second approach is to wait until no late data can appear. On an unbounded stream, that moment may never arrive. Perfect completeness with no output is not a usable product, while immediate output with no correction policy is not a reliable result.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the freshness-completeness tradeoff. Emitting early gives users a fast answer but increases corrections. Waiting longer reduces corrections but increases latency and keeps more state alive.',
        'The system also has to explain what late means. A record with event time 10:03 arriving at processing time 10:09 may be acceptable in one billing system and too late in another. Without an explicit policy, the same data can produce different answers after retries, restarts, or partition lag.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate event time, processing time, and output time. Event time places the record in the correct window, processing time describes when the machine observes it, and output time is when the system publishes a pane. A pane is one emitted version of a window result.',
        'A watermark connects those clocks without pretending they are the same. Watermark(t) means the system is prepared to treat event times up to t as complete enough for ordinary progress. Triggers and allowed lateness then say when to emit early, on-time, and late panes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each record receives an event timestamp from the payload or source metadata. A watermark generator observes source progress and disorder, then emits nondecreasing event-time estimates. Window operators assign records by event time and keep per-key state until the watermark and lateness rules allow cleanup.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'State transition diagram with process states and arrows', caption: 'A window has lifecycle states too: open, eligible to fire, accepting late corrections, and finally cleaned up. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Process_states.svg.'},
        'In a partitioned input, the global watermark is often limited by the slowest active partition. Idle-source detection prevents a quiet partition from holding the whole job behind forever. After the watermark passes a window end, the trigger can emit an on-time pane, while allowed lateness keeps state for correction panes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conditional on the published semantics. If the job promises to include all events up to two minutes late, then records inside that horizon must update the result and records beyond it need a separate correction path or a declared drop policy. The watermark supplies the progress test; it does not decide the business rule alone.',
        'The invariant is monotonic progress. A watermark never moves backward, so a fixed window eventually moves from open to eligible to cleaned up. Because every operator sees the same event-time signal, restart and scheduling differences do not decide which window a record belongs to.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is state lifetime. If a five-minute window allows two hours of lateness, the operator must keep aggregate state, timers, and checkpoint data long after the first result emits. Doubling the allowed lateness roughly doubles the time state remains live for the same key rate.',
        'The behavior cost is visible in corrections. Aggressive watermarks reduce latency but increase late panes or dropped records, while conservative watermarks wait longer and grow state. Slow partitions, backpressure, and idle sources can make output latency look bad even when event-time assignment is correct.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Watermarks are used in stream analytics, billing, fraud detection, ad attribution, feature pipelines, IoT aggregation, and CDC-derived materialized views. The common access pattern is an event-time question over data that arrives out of order. A dashboard may accept early panes, while an invoice may wait for the on-time pane plus a correction horizon.',
        'Machine-learning feature pipelines use the same idea for historical correctness. A feature for 10:05 should not include facts that happened later, even if those facts arrived earlier in processing time. Watermarks make that boundary explicit in the streaming path.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Watermarks fail when teams treat estimates as guarantees. Bad timestamp extraction can put records in the wrong window, a source can advance too aggressively, and one idle partition can stall global progress if idleness is not configured. Exactly-once checkpointing can recover state, but it does not prove event-time completeness.',
        'They also fail as product semantics when corrections are hidden. If numbers can revise, downstream dashboards, alerts, invoices, and audits must handle replacement or accumulation. A late-data policy that silently drops legally important events is a business bug, not only a streaming bug.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a five-minute window covers 10:00 through 10:05, and events have amounts 7 at 10:01, 4 at 10:04, and 9 at 10:02. They arrive at processing times 10:01, 10:04, and 10:07. If the watermark reaches 10:05 at processing time 10:06, the on-time pane is 11 because the 10:02 event has not arrived yet.',
        'If allowed lateness is three minutes, the 10:02 event arriving at 10:07 is accepted and emits a late correction from 11 to 20. If another event for 10:03 arrives at processing time 10:12, it is beyond the lateness horizon and must be dropped or routed to reconciliation. The numbers show the contract: lower latency produced an answer at 10:06, and the late policy decided how much correctness debt remained.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the Google Dataflow paper for the model of event time, watermarks, triggers, and panes. Then read Apache Beam trigger documentation and Apache Flink event-time watermark documentation to see how the contract appears in production APIs.',
        'Study backpressure next to separate event-time completeness from processing speed. Then study checkpointing, point-in-time feature joins, and delayed-feedback attribution so the lateness policy connects to recovery, ML features, and business outcomes.',
      ],
    },
  ],
};