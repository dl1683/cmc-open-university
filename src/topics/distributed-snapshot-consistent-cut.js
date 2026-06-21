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
  const processes = ['p1', 'p2', 'p3'];
  yield {
    state: snapshotGraph('A snapshot begins by recording one local state'),
    highlight: { active: [processes[0]], found: ['marker'], compare: [processes[1], processes[2]] },
    explanation: `The initiating process "${processes[0]}" records its own local state first. Then it sends a marker on every outgoing channel before sending any more ordinary messages to the remaining ${processes.length - 1} processes.`,
    invariant: `A snapshot across ${processes.length} processes is not a pause-the-world copy; it is a protocol that lets processes keep running.`,
  };

  yield {
    state: snapshotGraph('The first marker at each process freezes its local side of the cut'),
    highlight: { active: ['marker', processes[1], 'e-p1-marker', 'e-marker-p2'], compare: ['channel'] },
    explanation: `When process "${processes[1]}" receives its first marker, it records its local state immediately. The incoming channel from "${processes[0]}" that carried the marker is empty in the snapshot, because the marker separates before-snapshot messages from after-snapshot messages.`,
  };

  yield {
    state: snapshotGraph('Other channels are recorded until their markers arrive'),
    highlight: { active: ['channel', 'e-p2-channel', 'e-channel-p3'], found: [processes[2]], compare: [processes[0]] },
    explanation: `For every other incoming channel, process "${processes[2]}" records ordinary messages that arrive after its local snapshot but before the marker for that channel. Those messages were in flight across the cut.`,
    invariant: `Channel state is the missing piece that turns ${processes.length} local snapshots into one global snapshot.`,
  };

  const cutRows = [
    { id: 'sent', label: 'send before cut' },
    { id: 'recv', label: 'receive before cut' },
    { id: 'flight', label: 'in flight' },
    { id: 'bad', label: 'bad cut' },
  ];
  yield {
    state: labelMatrix(
      'Consistent cut rule',
      cutRows,
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
    explanation: `A consistent cut across ${processes.length} processes has ${cutRows.length} rules (${cutRows.map(r => r.label).join(', ')}). If the snapshot contains a receive event, it must also contain the corresponding send event. Otherwise the snapshot describes an impossible history.`,
  };
}

function* streamingCheckpoints() {
  const streamNodes = ['source', 'barrier', 'op'];
  yield {
    state: checkpointGraph('Streaming checkpoints reuse the marker idea'),
    highlight: { active: [...streamNodes, 'e-source-barrier', 'e-barrier-op'], compare: ['sink'] },
    explanation: `Flink-style checkpoint barriers are the streaming descendant of Chandy-Lamport markers. A "${streamNodes[1]}" flows with records from "${streamNodes[0]}" through "${streamNodes[2]}" and divides the stream into before-checkpoint and after-checkpoint regions.`,
  };

  const checkpointNodes = ['op', 'state', 'store', 'source'];
  yield {
    state: checkpointGraph('A completed checkpoint is state plus replay position'),
    highlight: { active: [...checkpointNodes, 'e-op-state', 'e-state-store'], found: ['restore'] },
    explanation: `A useful streaming checkpoint records ${checkpointNodes.length} components ("${checkpointNodes.join('", "')}") that agree on the same logical cut. Recovery restores state, seeks sources, and replays from the recorded boundary.`,
    invariant: `Fault tolerance across ${checkpointNodes.length} components is a snapshot of memory plus a replay contract for input.`,
  };

  const lineageRows = [
    { id: 'cl', label: 'Chandy-Lamport' },
    { id: 'flink', label: 'Flink' },
    { id: 'mill', label: 'MillWheel' },
    { id: 'db', label: 'database' },
  ];
  yield {
    state: labelMatrix(
      'Snapshot lineage',
      lineageRows,
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
    explanation: `The same shape appears across ${lineageRows.length} systems (${lineageRows.map(r => r.label).join(', ')}): choose a boundary, make every participant agree which side of the boundary it is on, and record enough state to resume or reason from that boundary.`,
  };

  const fraudRows = [
    { id: 'cards', label: 'card events' },
    { id: 'barrier', label: 'barrier N' },
    { id: 'state', label: 'window state' },
    { id: 'recover', label: 'worker crash' },
  ];
  yield {
    state: labelMatrix(
      'Case study: rolling fraud windows',
      fraudRows,
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
    explanation: `A fraud detector with ${fraudRows.length} checkpoint components (${fraudRows.map(r => r.label).join(', ')}) needs the same principle. The checkpoint must agree about the Kafka offsets, window counters, timers, and any externally visible alerts.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/distributed-snapshot-consistent-cut.gif', alt: 'Animated walkthrough of the distributed snapshot consistent cut visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A distributed system is always in motion. Messages are in flight, machines are at different points in time, clocks disagree, and stopping every participant at the same wall-clock instant is usually impossible. Yet operators still need a coherent picture of the system: for checkpointing, deadlock detection, debugging, recovery, and stream processing.',
        {
          type: 'callout',
          text: 'A snapshot is valid when it preserves causality, not when every machine stops at the same physical instant.',
        },
        'A distributed snapshot gives that picture without freezing the whole system. It records local process state plus the messages that were in transit across channels at the snapshot boundary. The result is not the state at one physical instant. It is a consistent cut: a causally possible boundary through the execution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to ask every machine to dump memory at the same time. That fails because there is no shared instant that all machines can observe precisely. A coordinator can send a snapshot command, but that command itself takes time to arrive. One process may dump before a message arrives while another dumps after sending it.',
        'A second tempting approach is to record only local state and ignore channels. That loses in-flight work. If process A sends money, work, or a stream record before its snapshot, and process B records before receiving it, the local snapshots alone make the message disappear. The snapshot must include channel state to preserve causality.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight from Chandy and Lamport is to turn a control message into a boundary marker. When a process records its local state, it sends a marker on every outgoing channel before sending more ordinary messages on those channels. The marker tells downstream processes where the snapshot boundary lies for that channel.',
        'A consistent cut is closed under causality. If the cut contains a receive event, it must also contain the matching send event. The marker protocol constructs such a cut by separating ordinary messages into before-boundary, in-flight, and after-boundary regions. In-flight messages are not bugs in the snapshot; they are part of the snapshot state.',
        {
          type: 'image',
          src: 'https://decomposition.al/assets/images/chandy-lamport-8-final-snapshot.png',
          alt: 'Chandy-Lamport snapshot space-time diagram showing past future and recorded process states',
          caption: 'A completed Chandy-Lamport snapshot as a consistent cut across three process timelines. Source: Lindsey Kuper, https://decomposition.al/blog/2019/04/26/an-example-run-of-the-chandy-lamport-snapshot-algorithm/.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The initiator records its local state and immediately sends markers on all outgoing channels. When another process receives its first marker for this snapshot, it records its local state, records the marker channel as empty for the snapshot, and sends markers on its own outgoing channels before sending more ordinary messages.',
        'For every other incoming channel, the process records ordinary messages that arrive after its local snapshot but before that channel delivers its marker. Those messages are the recorded channel state. They were sent before the sender crossed the cut and received after the receiver crossed the cut.',
        'When every process has recorded local state and every incoming channel has either been marked empty or had its in-flight messages recorded, the snapshot is complete. Normal computation can continue during the protocol. The snapshot rides through the system as a causal boundary rather than as a stop-the-world command.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The timeline view proves why wall-clock simultaneity is the wrong goal. The cut can slope across process timelines and still be valid, as long as it never includes an effect without its cause. The important question is not whether all machines stopped together; it is whether the recorded boundary describes a possible execution.',
        'The marker view proves why channel state matters. Messages that cross from the pre-snapshot side of one process into the post-snapshot side of another process are recorded as in-flight. Without that channel log, the snapshot would invent a world where the send happened but the message was nowhere.',
        'The best way to inspect the animation is to ask, for every receive event inside the cut, where the matching send event sits. If the send is also inside, the cut is plausible. If the send is outside, the cut is impossible and no checkpoint system should recover to it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof depends on FIFO channels. If process A sends ordinary message m before marker M on a channel, process B must receive m before M. So when B sees M, it knows that no earlier ordinary messages remain hidden behind the marker on that channel. The marker is a trustworthy divider.',
        'The first marker received by a process defines when that process crosses the cut. Messages received before that moment belong in local state. Messages received afterward belong either to channel state or to the post-snapshot future, depending on whether the marker for their channel has arrived. This rule is local, but together the local rules form a global consistent cut.',
      ],
    },
    {
      heading: 'Production translation',
      paragraphs: [
        'Modern stream processors use the same idea under different names. Flink checkpoint barriers are marker messages that flow with records. Operators snapshot keyed state when barriers arrive. Source offsets, operator state, timers, and sink commit state are coordinated so recovery can restart from a consistent boundary.',
        'Production systems add hard details that the paper abstracts away: backpressure, slow checkpoint storage, large keyed state, dynamic rescaling, non-FIFO transports, external databases, two-phase sink commits, and exactly-once claims. The conceptual question remains the same: what evidence proves this recovery point contains every before-boundary effect and no after-boundary effect?',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The protocol sends marker traffic across channels, but the heavy cost is usually snapshot materialization. Copying process state, uploading checkpoint files, aligning barriers, and holding channel buffers can dominate the marker overhead. A system with huge keyed state may be limited by storage bandwidth rather than by the snapshot algorithm itself.',
        'Aligned checkpoints wait for barriers on all inputs, which gives a clean cut but can amplify backpressure when one input is slow. Unaligned checkpoints capture in-flight buffers to reduce alignment delay, but then recovery must restore more channel state. That is the same tradeoff as the original algorithm, made operational.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Distributed snapshots are useful when the system needs a coherent recovery or observation point while work continues. Stream processing checkpoints, distributed debugging, deadlock detection, termination detection, and global predicate detection all rely on the ability to reason about global state without a global clock.',
        'The idea also teaches how to read many systems designs. If a paper claims fault tolerance, ask where the consistent cut is. If a database claims exactly-once streaming output, ask what source offsets, operator state, and sink effects are inside the same boundary. The snapshot concept is a diagnostic tool, not only an algorithm.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The original algorithm assumes reliable FIFO channels and a fixed process graph. If channels can reorder messages, markers no longer separate earlier ordinary messages from later ordinary messages. If processes join, leave, or move state during the snapshot, the system needs extra coordination to define ownership at the boundary.',
        'External side effects are another common failure. A consistent internal snapshot does not automatically make an email, database write, payment, or alert exactly once. Those sinks need idempotency, transactions, two-phase commit, or a recovery protocol that ties external effects to the checkpoint boundary.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Clocks and Ordering to understand causality, Message Queue for channel behavior, Write-Ahead Log for durable recovery, Flink Checkpointing Case Study for barrier snapshots, MillWheel Streaming Case Study for low-latency stateful streaming, Streaming Watermarks for event-time progress, and Two-Phase Commit for the sink side of exactly-once output.',
        'A useful exercise is to draw three processes, send two messages across them, then draw one valid cut and one invalid cut. Label the in-flight messages explicitly. That small drawing will make checkpoint barriers, source offsets, and sink commits much easier to understand later.',
      ],
    },
  ],
};
