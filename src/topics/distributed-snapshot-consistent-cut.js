// Distributed snapshots: Chandy-Lamport markers, channel state, and the
// consistent-cut idea behind modern streaming checkpoints.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'distributed-snapshot-consistent-cut',
  title: 'Distributed Snapshot & Consistent Cut',
  category: 'Papers',
  summary: 'Chandy-Lamport snapshots: record local state, send marker messages, capture in-flight channel state, and form a consistent global cut without stopping the system.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['marker algorithm', 'streaming checkpoints'], defaultValue: 'marker algorithm' },
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

function snapshotGraph(title) {
  return graphState({
    nodes: [
      { id: 'p1', label: 'P1', x: 0.8, y: 2.0, note: 'starts' },
      { id: 'p2', label: 'P2', x: 4.2, y: 1.2, note: 'records' },
      { id: 'p3', label: 'P3', x: 7.6, y: 2.0, note: 'records' },
      { id: 'marker', label: 'marker', x: 2.4, y: 4.8, note: 'control msg' },
      { id: 'channel', label: 'channel', x: 5.4, y: 4.8, note: 'in flight' },
      { id: 'cut', label: 'cut', x: 8.7, y: 4.8, note: 'global state' },
    ],
    edges: [
      { id: 'e-p1-p2', from: 'p1', to: 'p2', weight: 'data' },
      { id: 'e-p2-p3', from: 'p2', to: 'p3', weight: 'data' },
      { id: 'e-p1-marker', from: 'p1', to: 'marker', weight: 'send' },
      { id: 'e-marker-p2', from: 'marker', to: 'p2', weight: 'first' },
      { id: 'e-p2-channel', from: 'p2', to: 'channel', weight: 'log' },
      { id: 'e-channel-p3', from: 'channel', to: 'p3', weight: 'until marker' },
      { id: 'e-p3-cut', from: 'p3', to: 'cut', weight: 'join' },
      { id: 'e-channel-cut', from: 'channel', to: 'cut', weight: 'msgs' },
    ],
  }, { title });
}

function checkpointGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'src', x: 0.7, y: 3.6, note: 'offsets' },
      { id: 'barrier', label: 'barrier', x: 2.5, y: 3.6, note: 'marker' },
      { id: 'op', label: 'op', x: 4.4, y: 2.1, note: 'stateful' },
      { id: 'state', label: 'state', x: 4.4, y: 5.1, note: 'local' },
      { id: 'store', label: 'store', x: 6.6, y: 3.6, note: 'durable' },
      { id: 'sink', label: 'sink', x: 8.6, y: 2.1, note: 'effects' },
      { id: 'restore', label: 'restore', x: 8.6, y: 5.1, note: 'replay' },
    ],
    edges: [
      { id: 'e-source-barrier', from: 'source', to: 'barrier', weight: 'inject' },
      { id: 'e-barrier-op', from: 'barrier', to: 'op', weight: 'flow' },
      { id: 'e-op-state', from: 'op', to: 'state', weight: 'record' },
      { id: 'e-state-store', from: 'state', to: 'store', weight: 'copy' },
      { id: 'e-op-sink', from: 'op', to: 'sink', weight: 'emit' },
      { id: 'e-store-restore', from: 'store', to: 'restore', weight: 'load' },
      { id: 'e-source-restore', from: 'source', to: 'restore', weight: 'seek' },
    ],
  }, { title });
}

function* markerAlgorithm() {
  yield {
    state: snapshotGraph('A snapshot begins by recording one local state'),
    highlight: { active: ['p1'], found: ['marker'], compare: ['p2', 'p3'] },
    explanation: 'The initiating process records its own local state first. Then it sends a marker on every outgoing channel before sending any more ordinary messages on those channels.',
    invariant: 'A snapshot is not a pause-the-world copy; it is a protocol that lets processes keep running.',
  };

  yield {
    state: snapshotGraph('The first marker at each process freezes its local side of the cut'),
    highlight: { active: ['marker', 'p2', 'e-p1-marker', 'e-marker-p2'], compare: ['channel'] },
    explanation: 'When a process receives its first marker, it records its local state immediately. The incoming channel that carried the marker is empty in the snapshot, because the marker separates before-snapshot messages from after-snapshot messages.',
  };

  yield {
    state: snapshotGraph('Other channels are recorded until their markers arrive'),
    highlight: { active: ['channel', 'e-p2-channel', 'e-channel-p3'], found: ['p3'], compare: ['p1'] },
    explanation: 'For every other incoming channel, the process records ordinary messages that arrive after its local snapshot but before the marker for that channel. Those messages were in flight across the cut.',
    invariant: 'Channel state is the missing piece that turns local snapshots into one global snapshot.',
  };

  yield {
    state: labelMatrix(
      'Consistent cut rule',
      [
        { id: 'sent', label: 'send before cut' },
        { id: 'recv', label: 'receive before cut' },
        { id: 'flight', label: 'in flight' },
        { id: 'bad', label: 'bad cut' },
      ],
      [
        { id: 'allowed', label: 'allowed?' },
        { id: 'meaning' },
      ],
      [
        ['yes', 'may be local or channel'],
        ['yes only if send included', 'causal closure'],
        ['yes', 'message in channel state'],
        ['no', 'receive without send'],
      ],
    ),
    highlight: { found: ['sent:meaning', 'flight:meaning'], removed: ['bad:allowed', 'bad:meaning'] },
    explanation: 'A consistent cut is closed under causality. If the snapshot contains a receive event, it must also contain the corresponding send event. Otherwise the snapshot describes an impossible history.',
  };
}

function* streamingCheckpoints() {
  yield {
    state: checkpointGraph('Streaming checkpoints reuse the marker idea'),
    highlight: { active: ['source', 'barrier', 'op', 'e-source-barrier', 'e-barrier-op'], compare: ['sink'] },
    explanation: 'Flink-style checkpoint barriers are the streaming descendant of Chandy-Lamport markers. Barriers flow with records and divide the stream into before-checkpoint and after-checkpoint regions.',
  };

  yield {
    state: checkpointGraph('A completed checkpoint is state plus replay position'),
    highlight: { active: ['op', 'state', 'store', 'source', 'e-op-state', 'e-state-store'], found: ['restore'] },
    explanation: 'A useful streaming checkpoint records operator state and source positions that agree on the same logical cut. Recovery restores state, seeks sources, and replays from the recorded boundary.',
    invariant: 'Fault tolerance is a snapshot of memory plus a replay contract for input.',
  };

  yield {
    state: labelMatrix(
      'Snapshot lineage',
      [
        { id: 'cl', label: 'Chandy-Lamport' },
        { id: 'flink', label: 'Flink' },
        { id: 'mill', label: 'MillWheel' },
        { id: 'db', label: 'database' },
      ],
      [
        { id: 'marker', label: 'marker' },
        { id: 'state', label: 'state captured' },
      ],
      [
        ['control message', 'local + channels'],
        ['stream barrier', 'operators + offsets'],
        ['checkpoint', 'keyed state + timers'],
        ['version timestamp', 'rows/pages'],
      ],
    ),
    highlight: { found: ['cl:marker', 'flink:marker', 'mill:state'], compare: ['db:marker'] },
    explanation: 'The same shape appears across systems: choose a boundary, make every participant agree which side of the boundary it is on, and record enough state to resume or reason from that boundary.',
  };

  yield {
    state: labelMatrix(
      'Case study: rolling fraud windows',
      [
        { id: 'cards', label: 'card events' },
        { id: 'barrier', label: 'barrier N' },
        { id: 'state', label: 'window state' },
        { id: 'recover', label: 'worker crash' },
      ],
      [
        { id: 'snapshotRole', label: 'snapshot role' },
        { id: 'lesson' },
      ],
      [
        ['Kafka offsets', 'replay boundary'],
        ['stream marker', 'consistent cut'],
        ['per-card totals', 'crash-safe memory'],
        ['restore + replay', 'no missing updates'],
      ],
    ),
    highlight: { active: ['barrier:snapshotRole', 'state:snapshotRole'], found: ['recover:lesson'], compare: ['cards:lesson'] },
    explanation: 'A fraud detector that keeps per-card rolling windows needs the same principle. The checkpoint must agree about the Kafka offsets, window counters, timers, and any externally visible alerts.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'marker algorithm') yield* markerAlgorithm();
  else if (view === 'streaming checkpoints') yield* streamingCheckpoints();
  else throw new InputError('Pick a distributed-snapshot view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A distributed snapshot records one coherent global state of a running distributed system without stopping all processes at the same instant. The classic Chandy-Lamport algorithm solves this for processes connected by reliable FIFO channels. It gives each process a way to record local state and channel state so the final snapshot describes a possible execution of the system.',
        'The key concept is the consistent cut. Imagine drawing a line across the timelines of many machines. A cut is consistent when it is closed under causality: if it includes a receive event, it must also include the send event that caused it. A cut that contains a receive without its send is impossible, like a database row appearing before the transaction that wrote it.',
        'This topic builds on Clocks & Ordering, Message Queue, Write-Ahead Log, and Streaming Watermarks. It is the missing paper-level bridge between causal ordering and modern systems such as Flink Checkpointing Case Study and MillWheel Streaming Case Study.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The initiator records its local state and sends a marker on every outgoing channel before it sends any more ordinary messages on those channels. When a process receives its first marker, it records its local state, treats the marker channel as empty for the snapshot, and sends markers on its outgoing channels. For every other incoming channel, it records ordinary messages until that channel also delivers a marker.',
        'Those recorded ordinary messages are channel state. They represent messages that were sent before the sender crossed the cut but received after the receiver crossed the cut. Without channel state, a collection of local process snapshots can lose work that was in transit. With channel state, the snapshot can include both memory and in-flight communication.',
        'The algorithm works because the marker is a boundary message. FIFO channels ensure that any ordinary message sent before the marker arrives before the marker, and any message sent after the marker arrives after it. The marker therefore divides each channel into before-snapshot and after-snapshot regions. The protocol assembles those regions into one consistent global state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Chandy-Lamport pays one marker per channel per snapshot plus memory for local snapshots and channel logs. The hard cost is often not the marker itself but the state copied while normal work continues. A large process heap, large keyed state, or slow checkpoint storage can make snapshots expensive even if the coordination protocol is elegant.',
        'The assumptions matter. The original algorithm assumes reliable FIFO channels and a stable set of processes. Real production systems add retries, backpressure, non-FIFO transports, partitions, dynamic operators, transactions, and external side effects. That is why streaming engines talk about barriers, alignment, unaligned checkpoints, source offsets, sink commits, and durable checkpoint storage rather than only markers.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a streaming fraud detector that reads card events from Kafka, keeps rolling per-card counters, fires timers when windows close, and writes alerts to a database. If a worker crashes after updating memory but before committing an alert, recovery must not skip the event. If it commits the alert and then replays the event, recovery must not duplicate the alert. A checkpoint boundary has to include source offsets, per-card state, timer state, and the sink protocol boundary.',
        'The Chandy-Lamport lesson is the same: the runtime needs a consistent cut, not a pile of local dumps. A Flink barrier marks which Kafka records are before checkpoint N. Operators snapshot state when the barrier reaches them. The sink can commit only after the checkpoint is complete if it wants end-to-end exactly-once behavior. The production version is messier, but the conceptual backbone is the marker algorithm.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The most common misconception is that a snapshot means every machine stops at the same wall-clock instant. Distributed snapshots avoid that impossible requirement. They record a causally consistent boundary instead. Another misconception is that local state is enough. In-flight messages are state too, and they are exactly where distributed bugs hide.',
        'A second trap is applying the paper without checking assumptions. If channels are not FIFO, markers no longer cleanly separate earlier messages from later messages. If external sinks are not transactional or idempotent, a consistent internal snapshot does not guarantee consistent external effects. If snapshots happen too often, the system can spend more time copying and uploading state than doing useful work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chandy and Lamport, "Distributed Snapshots: Determining Global States of Distributed Systems," at https://lamport.azurewebsites.net/pubs/chandy.pdf; Apache Flink fault-tolerance docs explaining asynchronous barrier snapshotting at https://nightlies.apache.org/flink/flink-docs-stable/docs/learn-flink/fault_tolerance/; Flink checkpointing docs at https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/checkpointing/; and the Google Dataflow paper at https://research.google.com/pubs/archive/43864.pdf. Study Flink Checkpointing Case Study, MillWheel Streaming Case Study, Streaming Watermarks, Two-Phase Commit, and Write-Ahead Log next.',
      ],
    },
  ],
};
