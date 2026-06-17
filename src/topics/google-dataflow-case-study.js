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
      heading: 'The problem',
      paragraphs: [
        `A streaming system receives facts before it knows the whole story. Mobile clients reconnect after being offline. Ad impressions arrive before clicks. Sensors buffer readings and upload them later. A payment event may be processed after a refund event even though the payment happened first. The business question is usually phrased in event time: how many checkouts happened between 10:00 and 10:05, which users were active in a session, what was the p99 latency during an incident window? The machine sees processing time: when bytes arrived at a worker.`,
        `The Google Dataflow Model matters because it treats this mismatch as the central design problem, not as an implementation detail. Streaming is not merely batch computation with an endless input. A useful stream processor must say what time a record belongs to, when a partial answer is worth emitting, how corrections are represented, and when the system is allowed to give up on very late data.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The simplest stream processor groups records by arrival time. Count whatever reached the worker during the last five minutes, write the result, and move on. This is easy to implement and often looks correct in a local demo where events arrive in order. It fails in the real world because arrival time is an artifact of queues, retries, network delay, batching, mobile connectivity, and worker scheduling.`,
        `Another naive approach waits until the system is certain that no more records can arrive for a window. That produces cleaner answers but destroys latency. For unbounded data there may never be a perfect completion signal. A pipeline that waits for certainty can hold state forever, while a pipeline that never waits can publish answers that users quietly treat as final even though late events will later contradict them.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is that correctness, latency, and cost are tied together. If the pipeline keeps every window open forever, it can correct almost anything but pays unbounded state cost. If it closes windows quickly, it lowers cost and latency but drops valid late data. If it emits early, users see fast results but downstream sinks must handle revisions. None of these policies is universally right.`,
        `The Dataflow paper's enduring contribution is the separation of questions that older systems often blended together. What result are you computing? Where in event time does each record belong? When should the system emit a result? How should later panes relate to earlier panes? How long should late data be accepted? Those choices form a contract between the pipeline and everyone who reads its output.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `Dataflow makes time explicit. Event time describes when the thing happened in the domain. Processing time describes when the system observes and acts on it. Windows group event-time records into bounded units of work. Watermarks estimate how far event-time input has progressed. Triggers decide when to emit panes. Accumulation mode decides whether a pane is a replacement, a delta, or an accumulating refinement.`,
        `Once those pieces are explicit, batch and streaming become two cases of the same model. Bounded data has a known end and can still be windowed by event time. Unbounded data has no natural end, so it needs watermarks, triggers, allowed lateness, and state management. The transform logic can stay close to the batch expression, while the temporal policy says how the answer becomes visible over time.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `A record enters the pipeline with a timestamp, either supplied by the source or assigned by the pipeline. A window function maps that timestamp to one or more windows. Fixed windows produce simple non-overlapping buckets such as five-minute counts. Sliding windows answer rolling questions but duplicate work because one event may belong to many windows. Session windows merge nearby activity separated by gaps, which is useful for user behavior but requires dynamic window merging.`,
        `A watermark is a progress estimate, often phrased as: the system believes it has probably seen all events up to event time T. It is not proof. Sources can produce bad estimates, partitions can stall, and late records can still arrive. A trigger consumes the watermark and other signals, such as processing-time timers or element counts, and decides when to emit. Early panes give fast approximate answers, on-time panes fire when the watermark passes a window boundary, and late panes revise the result when stragglers appear before allowed lateness expires.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a dashboard counts purchases in five-minute event-time windows. Event A happened at 10:01 and arrived at 10:05, so it belongs to the 10:00 to 10:05 window. Event B happened at 10:07 and arrived at 10:08, so it belongs to the next window. Event C happened at 10:03 but arrived at 10:09. A processing-time system would count C in the later arrival period. A Dataflow-style system assigns C to the earlier event-time window and treats it as late data.`,
        `Now choose a trigger policy. The dashboard may emit an early pane every minute so operators see movement quickly. It may emit an on-time pane when the watermark passes 10:05. If C arrives after that but inside the allowed lateness interval, the pipeline emits a correction pane. The sink might overwrite the previous value, add a delta, or keep all panes with version metadata. The model does not pretend this policy is free. It exposes the policy so users can decide whether the dashboard should favor freshness, finality, or auditability.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The first view shows why the timestamp column is more important than arrival order. Events A and C share an event-time window even though C arrives later. That is the essential move: the stream is not interpreted by the order in which a worker happens to see it. The pipeline assigns domain time first, then uses windows to make unbounded input finite enough to aggregate.`,
        `The second view shows why watermarks and triggers are separate. A watermark estimates completeness. A trigger is a policy decision about output. That separation is what lets one pipeline emit speculative early answers, corrected later answers, and final closed-window results without changing the meaning of the aggregation itself.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Long allowed lateness improves correctness for delayed records but keeps state alive. State means memory, checkpoint size, recovery time, hot-key pressure, and cleanup work. Early triggers reduce user-visible latency but increase the number of writes to sinks. If the sink is a database table, every correction can become an upsert. If the sink is an append-only log, every correction needs a downstream interpretation rule.`,
        `Watermarks are a source of operational risk. An optimistic watermark can close windows too early and force many late corrections or drops. A conservative watermark can hold back output and grow state. In a distributed source, one slow partition can pin the watermark for the whole computation unless the system has idleness detection or per-key progress handling. The right policy depends on the product: billing, fraud, alerting, and exploratory dashboards have different tolerance for revision.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Dataflow-style semantics win when the domain cares about when things happened, not just when the pipeline saw them. Advertising metrics, real-time finance controls, sessionization, observability windows, IoT telemetry, fraud features, machine-learning feature stores, and data-quality monitors all need event-time reasoning. The model is especially valuable when the same logic must run once over historical data and continuously over live data.`,
        `It also wins as a communication tool. A pipeline configured with windows, watermarks, triggers, accumulation, and allowed lateness can be reviewed. A data scientist can ask whether a training feature uses point-in-time safe windows. An SRE can ask why state is growing. A product owner can ask whether a number is final or provisional. Without these terms, the same questions become guesses about hidden system behavior.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The model does not remove the need for good timestamps. If producers stamp records with local clock time, bad device clocks, ingestion time, or mixed semantics, event-time correctness becomes fiction. It also does not make sinks magically idempotent. Late panes and retries can duplicate writes unless output records carry stable keys, pane metadata, and clear update semantics.`,
        `Dataflow can be overkill for simple operational streams where arrival order is the business fact. A worker queue that processes jobs by enqueue time may not need event-time windows. The model is also harder to operate when keys are highly skewed, sessions grow without bound, or external side effects cannot be replayed safely after checkpoint recovery.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Common failures are semantic, not syntactic. Teams confuse Kafka offset order with event-time order. They publish early panes without marking them provisional. They drop late events and call the metric real time without documenting the bias. They use processing-time joins for machine-learning features and accidentally leak future information into training. They aggregate in event time but write to a sink that cannot retract or update old values cleanly.`,
        `Another failure is treating the watermark as a guarantee. It is an estimate produced by source logic and runtime observation. When that estimate is wrong, the pipeline must still behave predictably: emit late panes, route records to dead-letter or audit streams, or drop them under a documented lateness policy. The absence of a late-data policy is itself a policy, usually a bad one.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Google Research page at https://research.google/pubs/the-dataflow-model-a-practical-approach-to-balancing-correctness-latency-and-cost-in-massive-scale-unbounded-out-of-order-data-processing/ and paper PDF at https://research.google.com/pubs/archive/43864.pdf. Apache Beam is the most direct practical descendant of the model, while systems such as Flink and Spark Structured Streaming expose related ideas with their own operational choices.`,
        `Good next topics are Streaming Watermarks for progress estimation, Backpressure for what happens when workers or sinks cannot keep up, Kafka-style logs for source ordering, Delta Lake for table sinks, Feature Store for point-in-time correctness, t-digest for streaming quantiles, and Distributed Snapshot for the checkpointing problem beneath reliable stream processing.`,
      ],
    },
  ],
};
