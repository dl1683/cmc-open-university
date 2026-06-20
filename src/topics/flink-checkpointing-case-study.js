// Apache Flink checkpointing: barriers, state snapshots, replay, and sinks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'flink-checkpointing-case-study',
  title: 'Flink Checkpointing Case Study',
  category: 'Systems',
  summary: 'Flink fault tolerance: inject checkpoint barriers, snapshot operator state, replay sources after failure, and coordinate sinks for end-to-end semantics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['barrier snapshot', 'exactly once sinks'], defaultValue: 'barrier snapshot' },
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

function flinkGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'source', x: 0.8, y: 3.6, note: 'Kafka/files' },
      { id: 'barrier', label: 'checkpoint barrier', x: 2.6, y: 3.6, note: 'logical boundary' },
      { id: 'map', label: 'operator', x: 4.4, y: 2.2, note: 'stateful map' },
      { id: 'keyed', label: 'keyed state', x: 4.4, y: 5.0, note: 'RocksDB/heap' },
      { id: 'storage', label: 'checkpoint storage', x: 6.6, y: 3.6, note: 'durable snapshot' },
      { id: 'sink', label: 'sink', x: 8.5, y: 2.2, note: 'external output' },
      { id: 'restore', label: 'restore + replay', x: 8.5, y: 5.0, note: 'after failure' },
    ],
    edges: [
      { id: 'e-source-barrier', from: 'source', to: 'barrier', weight: 'inject' },
      { id: 'e-barrier-map', from: 'barrier', to: 'map', weight: 'travels with records' },
      { id: 'e-map-keyed', from: 'map', to: 'keyed', weight: 'snapshot state' },
      { id: 'e-keyed-storage', from: 'keyed', to: 'storage', weight: 'upload' },
      { id: 'e-map-sink', from: 'map', to: 'sink', weight: 'outputs' },
      { id: 'e-storage-restore', from: 'storage', to: 'restore', weight: 'load state' },
      { id: 'e-source-restore', from: 'source', to: 'restore', weight: 'replay offsets' },
    ],
  }, { title });
}

function* barrierSnapshot() {
  yield {
    state: flinkGraph('Checkpoint barriers cut the stream into consistent slices'),
    highlight: { active: ['source', 'barrier', 'map', 'e-source-barrier', 'e-barrier-map'], compare: ['sink'] },
    explanation: 'Flink injects checkpoint barriers into streams. A barrier marks which records belong before a checkpoint and which records belong after it.',
  };

  yield {
    state: flinkGraph('Operators snapshot state when barriers arrive'),
    highlight: { active: ['barrier', 'map', 'keyed', 'storage', 'e-map-keyed', 'e-keyed-storage'], found: ['source'] },
    explanation: 'When an operator receives the checkpoint barrier for a checkpoint, it snapshots its local or keyed state to durable checkpoint storage and forwards the barrier downstream.',
    invariant: 'A completed checkpoint contains operator state plus source positions that agree on the same logical cut.',
  };

  yield {
    state: labelMatrix(
      'Aligned checkpoint flow',
      [
        { id: 'input1', label: 'fast input' },
        { id: 'input2', label: 'slow input' },
        { id: 'align', label: 'alignment' },
        { id: 'snapshot', label: 'snapshot' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'risk', label: 'risk/tradeoff' },
      ],
      [
        ['barrier arrives early', 'may buffer records'],
        ['barrier arrives later', 'backpressure matters'],
        ['wait for all barriers', 'consistent cut'],
        ['state copied durable', 'checkpoint duration'],
      ],
    ),
    highlight: { active: ['align:event', 'snapshot:event'], compare: ['input1:risk'] },
    explanation: 'For operators with multiple inputs, aligned checkpoints wait until barriers from all inputs arrive. That creates a consistent snapshot but can suffer under backpressure.',
  };

  yield {
    state: labelMatrix(
      'Recovery recipe',
      [
        { id: 'fail', label: 'task fails' },
        { id: 'load', label: 'load checkpoint' },
        { id: 'replay', label: 'replay source' },
        { id: 'continue', label: 'continue' },
      ],
      [
        { id: 'systemMove', label: 'system move' },
        { id: 'semanticGoal', label: 'semantic goal' },
      ],
      [
        ['job restarts tasks', 'bounded recovery'],
        ['restore operator state', 'same logical state'],
        ['seek source offsets', 'no missed records'],
        ['process after barrier', 'as if no failure'],
      ],
    ),
    highlight: { found: ['load:semanticGoal', 'replay:semanticGoal', 'continue:semanticGoal'], compare: ['fail:systemMove'] },
    explanation: 'Fault tolerance is state plus input positions. A checkpoint is useful only if the source can replay from the recorded position.',
  };
}

function* exactlyOnceSinks() {
  yield {
    state: flinkGraph('End-to-end exactly-once also depends on the sink'),
    highlight: { active: ['map', 'sink', 'storage', 'e-map-sink', 'e-keyed-storage'], compare: ['restore'] },
    explanation: 'Flink can restore operator state exactly once relative to replayable sources, but external side effects need compatible sink protocols such as transactions or idempotent writes.',
  };

  yield {
    state: labelMatrix(
      'Sink semantics',
      [
        { id: 'atleast', label: 'at-least-once sink' },
        { id: 'idempotent', label: 'idempotent sink' },
        { id: 'twopc', label: 'two-phase commit sink' },
        { id: 'external', label: 'external DB' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'failureCase', label: 'failure case' },
      ],
      [
        ['write immediately', 'duplicates after replay'],
        ['same key overwrites', 'dedupe absorbs replay'],
        ['precommit then commit on checkpoint', 'abort on failure'],
        ['depends on transaction API', 'semantic boundary moves'],
      ],
    ),
    highlight: { active: ['twopc:behavior', 'idempotent:behavior'], compare: ['atleast:failureCase'] },
    explanation: 'The common misconception is that checkpointing alone controls the outside world. It controls Flink state; sinks need their own replay-safe protocol.',
    invariant: 'Exactly-once processing is end-to-end only when source replay, state restore, and sink commit agree.',
  };

  yield {
    state: labelMatrix(
      'Backpressure and unaligned checkpoints',
      [
        { id: 'normal', label: 'aligned checkpoint' },
        { id: 'backpressure', label: 'heavy backpressure' },
        { id: 'unaligned', label: 'unaligned checkpoint' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'tradeoff' },
      ],
      [
        ['wait at barriers', 'smaller state snapshot'],
        ['barriers delayed', 'checkpoint timeout risk'],
        ['snapshot in-flight buffers', 'faster barrier progress'],
        ['more bytes in checkpoint', 'recovery impact'],
      ],
    ),
    highlight: { found: ['unaligned:move', 'unaligned:tradeoff'], compare: ['backpressure:tradeoff'] },
    explanation: 'Unaligned checkpoints trade larger snapshots for progress under backpressure by including in-flight data rather than waiting for all channels to align cleanly.',
  };

  yield {
    state: labelMatrix(
      'Complete streaming case study',
      [
        { id: 'source', label: 'Kafka source' },
        { id: 'state', label: 'keyed window state' },
        { id: 'sink', label: 'transactional sink' },
        { id: 'failure', label: 'task failure' },
      ],
      [
        { id: 'checkpointRole', label: 'checkpoint role' },
        { id: 'lesson' },
      ],
      [
        ['store offsets', 'replay boundary'],
        ['snapshot counts/timers', 'state continuity'],
        ['commit on checkpoint complete', 'external consistency'],
        ['restore and replay', 'duplicate-safe recovery'],
      ],
    ),
    highlight: { found: ['source:lesson', 'state:lesson', 'sink:lesson'], compare: ['failure:checkpointRole'] },
    explanation: 'A fraud-detection pipeline can maintain per-card windows, checkpoint state and Kafka offsets, and commit alerts transactionally so failures do not double-count or skip events.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'barrier snapshot') yield* barrierSnapshot();
  else if (view === 'exactly once sinks') yield* exactlyOnceSinks();
  else throw new InputError('Pick a Flink-checkpointing view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Flink checkpointing exists because stateful streaming jobs are long-running programs, not one-shot scripts. A fraud job may keep per-card windows for months. A CDC enrichment job may remember join state. A feature pipeline may update keyed aggregates continuously. If a task manager dies, the job cannot restart from empty memory and pretend nothing happened.',
        'The first requirement is simple to state: after failure, the job should resume from a consistent point. The operator state, timers, and source positions must describe the same logical stream cut. If state is from 10:05 but Kafka offsets are from 10:02, replay will double count. If offsets are from 10:05 but state is from 10:02, records are lost. Fault tolerance is the agreement between state and input progress.',
        'The second requirement is harder: the pipeline should keep running while snapshots are taken. Stopping the whole job for every backup would destroy the low-latency reason to use streaming in the first place. Flink uses checkpoint barriers to mark consistent cuts inside the stream, so state can be snapshotted while records continue to flow.',
        {type:'callout', text:'A checkpoint is reliable only when operator state, timers, source offsets, and sink effects agree on the same stream cut.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is periodic local backup. Each operator writes its local state to disk every minute. If a task fails, reload the newest backup and keep going. This works only if local state is the whole story. A streaming job also has records in flight, source offsets, timers, and downstream effects. Local backup alone cannot say which records were already included in the state.',
        'Another reasonable approach is to rely on the source log. If the source is Kafka, just replay from an earlier offset after failure. Replay solves missing input, but it does not solve state consistency. Replaying too far without restoring matching state duplicates effects. Restoring state without replaying enough misses records. The source and state need one shared boundary.',
        'The wall is distributed snapshot consistency. A Flink job graph has many operators running in parallel, often with multiple input channels. At any moment, some records have reached one operator but not another. Some state updates are complete, while related downstream outputs are still in buffers. A checkpoint must cut through this moving graph so every included state update agrees with the included source positions.',
        'Flink solves that wall by putting markers in the data stream itself. A barrier says: records before this marker belong to checkpoint N; records after it belong to the next checkpoint. Operators use the marker to know exactly which state belongs in the snapshot.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is a consistent cut through a live dataflow graph. A checkpoint is not just a copy of memory. It is a snapshot of operator state, timers, connector state, and source positions that all correspond to the same logical boundary in the stream.',
        'Checkpoint barriers make that boundary visible without stopping the job. Sources inject barriers. Barriers travel with records. When an operator receives the barrier for a checkpoint, it snapshots the state that reflects records before that barrier. After all required operators finish their snapshots, the checkpoint becomes complete and can be used for recovery.',
        'This is the same broad idea as distributed snapshot algorithms, adapted to streaming execution. The stream itself carries the control message. The data plane and recovery protocol share the same channels, so the runtime can reason about which records happened before the checkpoint and which happened after it.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A checkpoint starts when the coordinator tells sources to inject a barrier for checkpoint N. A source records its position, such as a Kafka offset, and sends the barrier downstream. Records before the barrier are part of the pre-checkpoint stream. Records after the barrier are not.',
        'A one-input operator has a direct job. It processes records until it sees the barrier, snapshots its keyed state or operator state, forwards the barrier, and continues. State may live on the heap or in a state backend such as RocksDB. The snapshot is written to checkpoint storage, which should be a durable and highly available store for production jobs.',
        'A multi-input operator has to align barriers in the common aligned mode. If the barrier arrives on one input but not another, the operator must prevent post-barrier records on the early input from mixing with pre-barrier records on the late input. Alignment preserves the consistent cut. Under backpressure, this waiting can make checkpoint duration grow.',
        'Unaligned checkpoints change the tradeoff. Instead of waiting for all channels to align cleanly, Flink can include in-flight buffered data in the checkpoint. Barriers make progress even when channels are backed up, but the checkpoint contains more bytes and recovery has more channel state to restore. This is a latency and storage trade, not a free improvement.',
        'After failure, Flink restores the latest completed checkpoint. Operators load their state, sources seek back to the recorded positions, and the job reprocesses records after the checkpoint boundary. The completed checkpoint is the rewind point. Any work after it may be repeated, so sinks must be compatible with replay.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a Kafka-to-database fraud pipeline. The source reads card transactions from Kafka. A keyed operator maintains a rolling ten-minute window per card. A sink writes alerts to an external database. The job cannot lose state after a machine failure, and it cannot write duplicate final alerts if Kafka records are replayed.',
        'Checkpoint 41 begins. The Kafka source records offsets and emits a barrier. The keyed window operator processes all records before the barrier, updates per-card state, snapshots that state, and forwards the barrier. The sink receives the barrier and precommits its transaction for records before checkpoint 41. When every participating task reports success, the coordinator marks checkpoint 41 complete and notifies the sink that it can commit.',
        'Now a task fails after checkpoint 41 completes but before checkpoint 42 completes. Flink restores state from checkpoint 41 and seeks Kafka back to the offsets in checkpoint 41. Records processed after checkpoint 41 are replayed. The window state before checkpoint 41 is not recomputed from empty memory; it is restored. The sink must ensure records after checkpoint 41 do not become duplicate committed alerts. Transactional or idempotent sink design is what extends the guarantee outside Flink.',
        'If the same job is under heavy backpressure, aligned checkpoint barriers may take too long to reach all operators. Enabling unaligned checkpoints can keep checkpointing from timing out by snapshotting in-flight buffers. The recovery point is still consistent, but the checkpoint may be larger and restore may need to replay buffered channel data as part of recovery.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the barrier invariant. For checkpoint N, each operator snapshots the state produced by records before the checkpoint barrier and excludes records after it. With aligned checkpoints, multi-input operators wait until the boundary is known on all inputs, so the snapshot does not mix pre-checkpoint state from one channel with post-checkpoint state from another.',
        'Source replay completes the invariant. A snapshot without source positions is only a backup. A source position without state is only a log offset. Together they say: this is the state after processing all records up to this position and before processing later records. Recovery restores that pair and replays from the boundary.',
        'End-to-end exactly-once needs one more invariant at the sink. Flink can make internal state consistent with replay, but external systems need their own commit protocol. A two-phase commit sink precommits output during the checkpoint and commits only after the checkpoint succeeds. An idempotent sink uses deterministic keys so repeated writes collapse to one effect. An at-least-once sink writes immediately and may duplicate after recovery.',
        'This is why checkpointing is a composition claim. Source replay, operator state restore, timers, and sink effects must agree. If any one part cannot honor the boundary, the pipeline guarantee weakens at that part.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Checkpointing adds IO, CPU, storage, coordination, and sometimes latency. The job writes state snapshots to durable storage. Large keyed state can dominate checkpoint duration. Slow object storage or file systems can turn checkpointing into the bottleneck. If checkpoints time out, the job may run without fresh recovery points and then recover from an older boundary after failure.',
        'The interval is a real design choice. Short intervals reduce recovery work because less post-checkpoint data must be replayed, but they increase snapshot frequency and sink transaction churn. Long intervals reduce checkpoint overhead, but they increase recovery time and potential replay volume. There is no universally correct value. It depends on state size, input rate, sink behavior, and recovery objectives.',
        'Incremental checkpoints reduce repeated upload for large state backends by storing changes since prior checkpoints. They can make large RocksDB state practical, but they add lifecycle complexity. Shared checkpoint files need careful cleanup. Operators must distinguish checkpoints used for automatic recovery from savepoints used for planned upgrades or migration.',
        'Backpressure changes the cost model. With aligned checkpoints, barriers can be delayed behind full buffers, so checkpoint duration reflects runtime congestion. Unaligned checkpoints reduce that delay by including buffered records in checkpoint state, but they increase checkpoint size and can make recovery heavier. Choosing between aligned and unaligned modes is choosing where to pay.',
        'Sinks often set the real limit. A two-phase commit sink may hold external transactions open until checkpoints complete. If checkpoints are slow, transactions live longer. Some external systems do not support the needed commit or abort behavior. In those cases, teams must use idempotent keys, accept at-least-once output, or change the sink.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Flink checkpointing wins in stateful streaming jobs with replayable sources and meaningful recovery requirements. Fraud detection, alerting, session windows, streaming joins, CDC enrichment, continuously updated aggregates, and online feature computation all fit. The common pattern is keyed state that must survive worker and machine failure while records continue arriving.',
        'It is less useful for stateless pipelines where replay from the source is enough, for one-off batch jobs where failure can be handled by rerunning the job, or for external side effects that cannot be made replay-safe. It also does not replace database transactions. If the main correctness boundary is inside an OLTP database, a stream checkpoint cannot make the database commit protocol disappear.',
        'The common misconception is that enabling checkpoints automatically gives exactly-once everything. It gives Flink a consistent recovery boundary for its own managed state and compatible connectors. End-to-end semantics depend on source replay and sink behavior. Another misconception is that more frequent checkpoints are always safer. They may overload storage, lengthen backpressure, or keep sink transactions open too often.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The barrier-snapshot view shows the checkpoint boundary traveling through the graph. The barrier is not data for the user program. It is a control marker that lets each operator decide which state belongs to the same snapshot as the source positions.',
        'The aligned-flow matrix shows why multiple inputs are hard. A fast input can deliver a barrier before a slow input. Waiting preserves the cut, but it may buffer records and expose backpressure. The recovery matrix shows why both halves are required: load state and replay sources from the matching boundary.',
        'The sink view is the important caution. A checkpoint can restore Flink state, but an external output has already affected another system. Exactly-once output requires a transaction, an idempotent write, or another protocol that coordinates with checkpoint completion.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Apache Flink checkpointing documentation at https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/checkpointing/, Flink exactly-once overview at https://flink.apache.org/2018/02/28/an-overview-of-end-to-end-exactly-once-processing-in-apache-flink-with-apache-kafka-too/, and the Flink paper at https://asterios.katsifodimos.com/assets/publications/flink-deb.pdf.',
        'Study Kafka Log Case Study next to understand replayable source offsets. Study MillWheel Streaming Case Study to compare another approach to stateful streaming, timers, and delivery semantics. Study Two-Phase Commit for sink protocols that coordinate external commits with checkpoint success. Study RocksDB LSM Case Study because Flink keyed state often lives in an LSM-backed state backend. Study Backpressure & Flow Control to understand why checkpoint barriers slow down when channels are congested. Study Google Dataflow Model Case Study for event time, windows, and triggers above the checkpointing layer.',
      ],
    },
  ],
};
