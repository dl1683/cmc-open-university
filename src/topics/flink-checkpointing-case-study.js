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
    { heading: 'How to read the animation', paragraphs: [
        'Read the barrier view as a moving stream cut. A barrier is a control marker that separates records before checkpoint N from records after it. Active operators are waiting for or processing that cut; found operators have snapshotted state for the same boundary.',
        'The sink view is the caution. A checkpoint is complete only when source offsets, operator state, timers, and compatible sink effects agree on the same cut.',
        {type:'callout', text:'A checkpoint is reliable only when operator state, timers, source offsets, and sink effects agree on the same stream cut.'},
      ] },
    { heading: 'Why this exists', paragraphs: [
        'Flink jobs can run for months while holding keyed state, timers, windows, and source positions. If a task manager dies, the job cannot restart from empty memory. It needs a recovery point where state and input progress describe the same logical history.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is periodic local backup. Each operator writes its state to disk every minute. Another is replaying from Kafka offsets. Both are incomplete because a streaming job also has records in flight, timers, multiple inputs, and external sink effects.',
      ] },
    { heading: 'The wall', paragraphs: [
        'The wall is distributed snapshot consistency. At one instant, some records have reached one operator but not another. A snapshot that mixes state from 10:05 with source offsets from 10:02 can duplicate or lose records after recovery.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Put checkpoint barriers inside the data stream. Sources inject a marker for checkpoint N. Operators snapshot the state produced by records before the barrier and exclude records after it. The stream carries the boundary the runtime needs for recovery.',
      ] },
    { heading: 'How it works', paragraphs: [
        'A source records its position and emits a barrier. A one-input operator processes earlier records, snapshots state, forwards the barrier, and continues. A multi-input operator aligns barriers so records after the cut on one input do not mix with records before the cut on another input.',
      ] },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is the barrier invariant. For checkpoint N, every operator snapshot reflects exactly the records before the barrier. Recovery restores those snapshots and seeks sources to matching positions, so replay starts after the same boundary. End-to-end exactly-once also requires a transactional or idempotent sink.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'Checkpointing adds IO, CPU, storage, and coordination. A 200 GB keyed-state job checkpointing every 1 minute writes far more recovery data than the same job checkpointing every 10 minutes. Short intervals reduce replay after failure; long intervals reduce checkpoint pressure. Under backpressure, aligned barriers wait, while unaligned checkpoints store buffered records.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'Flink checkpointing wins in fraud detection, alerting, session windows, streaming joins, CDC enrichment, online feature computation, and continuously updated aggregates. The common pattern is stateful streaming with replayable sources and recovery requirements while records keep arriving.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It fails as an end-to-end guarantee when the sink cannot coordinate with checkpoint completion or make repeated writes idempotent. It is unnecessary for stateless pipelines where replay is enough, and it does not replace database transactions when the main correctness boundary is inside an OLTP store.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'A Kafka fraud job maintains a 10-minute window per card and writes alerts to a database. Checkpoint 41 records Kafka offsets, snapshots keyed window state, and precommits sink output. The job fails after checkpoint 41 completes but before checkpoint 42. Flink restores state from 41 and seeks Kafka to the recorded offsets. Records after 41 replay, and the sink must avoid duplicate alerts through two-phase commit or idempotent keys.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: Apache Flink checkpointing docs at https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/checkpointing/, Flink exactly-once overview at https://flink.apache.org/2018/02/28/an-overview-of-end-to-end-exactly-once-processing-in-apache-flink-with-apache-kafka-too/, and the Flink paper at https://asterios.katsifodimos.com/assets/publications/flink-deb.pdf.',
        'Study Kafka Log Case Study, MillWheel Streaming Case Study, Two-Phase Commit, RocksDB LSM Case Study, Backpressure and Flow Control, and Google Dataflow Model Case Study next.',
      ] },
  ],
};
