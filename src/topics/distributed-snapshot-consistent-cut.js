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
        'The first view walks through the Chandy-Lamport marker algorithm on three processes. Watch the initiating process record its local state and send marker messages on every outgoing channel. When each downstream process receives its first marker, it records its own state and begins logging ordinary messages on other incoming channels. Those logged messages become the channel state in the snapshot. The animation completes when every process has recorded and every channel has been marked.',
        'The second view translates the same marker idea into streaming checkpoints. Barriers flow with data records from sources through operators to sinks. Each operator snapshots its keyed state when a barrier arrives. The completed checkpoint is source offsets plus operator state plus sink commit positions, all agreeing on the same logical boundary. The animation shows how a single barrier injection at the source propagates through an operator graph and produces a durable, recoverable cut.',
        {type: 'image', src: './assets/gifs/distributed-snapshot-consistent-cut.gif', alt: 'Animated walkthrough of the distributed snapshot consistent cut visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'For both views, the key question to hold in mind at every step is: for every receive event inside the snapshot boundary, is the corresponding send event also inside? If yes, the cut is consistent. If any receive appears without its send, the snapshot describes an impossible history that no real execution could have produced.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A distributed system is always in motion. Messages travel between machines at different speeds, each machine processes events at its own pace, and physical clocks across machines disagree by milliseconds to seconds. There is no global "now" that every participant can observe at the same instant. Yet operators need a coherent picture of the system for checkpointing (crash recovery), deadlock detection, debugging, garbage collection of obsolete state, and stream processing exactly-once guarantees.',
        {
          type: 'callout',
          text: 'A snapshot is valid when it preserves causality, not when every machine stops at the same physical instant.',
        },
        'A distributed snapshot provides that coherent picture without halting the system. It records each process\'s local state plus the messages that were in transit across communication channels at the snapshot boundary. The result is not the state at one physical instant. It is a consistent cut: a boundary through the distributed execution that could have been a real global state at some point in a causally equivalent execution. The snapshot preserves causality, the ordering of sends and receives, which is the only ordering that matters in a system without a shared clock.',
        'K. Mani Chandy and Leslie Lamport published the algorithm in 1985. It remains the intellectual ancestor of every modern streaming checkpoint, database snapshot isolation mechanism, and distributed debugger that captures global state without a stop-the-world pause.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first idea is to have a coordinator broadcast "snapshot now" and have every machine dump its state upon receipt. This fails because the broadcast itself takes time. Suppose processes P1 and P2 are connected. The coordinator sends "snapshot now" to both. P1 receives the command at wall-clock time t=100 and dumps its state. P1 then sends an ordinary message M to P2 at t=101. P2 receives M at t=102, processes it, and then receives the coordinator\'s "snapshot now" at t=103. P2\'s dump includes the effect of M, but P1\'s dump was taken before M was sent. The combined snapshot contains a receive without the corresponding send, describing an impossible execution.',
        'A second tempting approach is to record only local state and ignore channels entirely. This loses in-flight messages. If P1 sends a bank transfer of $500 to P2 before P1\'s snapshot, and P2 records before receiving the transfer, the combined local snapshots make $500 vanish. The money left P1\'s account (recorded in P1\'s pre-send state) but never arrived at P2 (recorded in P2\'s pre-receive state). The snapshot violates conservation.',
        'Both failures share a root cause: without a mechanism to partition messages into "before the boundary" and "after the boundary" on each channel, any attempt at a global snapshot will either include effects without causes or lose messages in transit. The algorithm needs something that travels with the messages to mark where the boundary sits on each communication channel.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fundamental obstacle is the absence of a global clock. In a single-machine system, the OS can freeze all threads at one instruction pointer and dump memory. That works because there is one clock, one memory, and one scheduler with total visibility. In a distributed system, each machine has its own clock, its own memory, and no visibility into what messages are currently traveling through the network. Freezing all machines simultaneously is both impractical (coordination takes time) and insufficient (it still misses messages in transit inside network buffers, TCP stacks, and message brokers).',
        'Even if you could freeze every machine at exactly the same wall-clock time via GPS-synchronized clocks, you would still miss messages that were sent before the freeze but not yet received. A message in a network buffer is not part of any process\'s local state. It has left the sender but not arrived at the receiver. If you ignore it, the snapshot loses work. If you count it as part of the sender\'s state, you double-count (the sender already processed the send). If you count it as part of the receiver\'s state, you attribute an effect the receiver has not yet observed.',
        'The wall, then, is not about clock synchronization. It is about channel state: the messages that exist between processes. Any valid snapshot algorithm must account for in-flight messages as a first-class component of the global state, separate from any process\'s local memory.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Chandy and Lamport\'s insight is to use the communication channels themselves to carry the snapshot boundary. Instead of trying to synchronize clocks or freeze processes, the initiator sends a special control message, a marker, on every outgoing channel. The marker travels through the same channels as ordinary messages, at the same speed, subject to the same ordering guarantees. Because channels are FIFO (first-in, first-out), the marker divides each channel into exactly two regions: messages sent before the marker (which belong to the snapshot) and messages sent after (which do not).',
        'This converts the global coordination problem into a local decision at each process. When a process receives a marker on a channel, it knows that all ordinary messages preceding the marker on that channel are pre-snapshot, and all messages following it are post-snapshot. The process does not need a global clock, a coordinator\'s permission, or any knowledge of what other processes are doing. It just needs to observe markers arriving on its incoming channels.',
        {
          type: 'image',
          src: 'https://decomposition.al/assets/images/chandy-lamport-8-final-snapshot.png',
          alt: 'Chandy-Lamport snapshot space-time diagram showing past future and recorded process states',
          caption: 'A completed Chandy-Lamport snapshot as a consistent cut across three process timelines. Source: Lindsey Kuper, https://decomposition.al/blog/2019/04/26/an-example-run-of-the-chandy-lamport-snapshot-algorithm/.',
        },
        'A consistent cut is a boundary through the space-time diagram of the execution that is closed under causality: if the snapshot includes a receive event, it must also include the matching send event. The marker protocol constructs exactly such a boundary. In-flight messages (sent before the sender\'s marker, received after the receiver\'s snapshot) are not anomalies. They are recorded as channel state, a first-class component of the snapshot. The complete snapshot is the union of all local process states and all channel states.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Any process can initiate. The initiator records its own local state (memory, registers, application-level data structures) and then immediately sends a marker message on every outgoing channel. After sending the markers, it resumes normal computation. The markers are special control messages distinct from ordinary application messages, but they travel through the same FIFO channels.',
        'When a process receives the first marker for this snapshot on any incoming channel, three things happen atomically. First, it records its own local state. Second, it records the state of the channel that delivered the marker as empty (because the marker proves all pre-snapshot messages on that channel have already been received and are reflected in the local state). Third, it sends markers on all of its own outgoing channels before sending any more ordinary messages. This ordering guarantee is critical: it ensures that the process\'s marker arrives at downstream processes before any post-snapshot ordinary messages from this process.',
        'For every other incoming channel (channels that have not yet delivered a marker for this snapshot), the process begins recording ordinary messages that arrive. These are messages that were sent by the remote process before it crossed the snapshot boundary but received by this process after it crossed. They are in-flight messages, and they constitute the channel state for that channel. Recording continues until the marker for that channel arrives, at which point the channel state is finalized.',
        'The snapshot is complete when every process has recorded its local state and every channel has been resolved (either marked empty because its marker arrived first, or filled with the recorded in-flight messages). No process needs to stop computing during the protocol. The snapshot propagates through the system as a causal wavefront, not as a stop-the-world command.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness proof rests on the FIFO property of channels. If process P1 sends ordinary message m and then sends marker M on the same channel, FIFO guarantees that P2 receives m before M. When P2 sees M, it knows with certainty that no pre-snapshot ordinary messages from P1 remain hidden behind the marker. The marker is a trustworthy end-of-epoch signal for that channel.',
        'The first marker a process receives on any channel defines when that process crosses the snapshot boundary. Messages received before that moment are part of the process\'s local state (they have already been processed). Messages received after the process crosses the boundary but before the marker for their specific channel arrives are in-flight messages belonging to channel state. Messages received after the marker for their channel arrives are post-snapshot and excluded.',
        'Each process makes only local decisions, yet the aggregate of all local decisions forms a globally consistent cut. To see why, consider any send-receive pair in the execution. If the receive is inside the cut (the receiver recorded it as part of its local state or channel state), was the send also inside? Yes: the sender must have sent the message before its marker on that channel (otherwise the message would arrive after the marker, contradicting FIFO). And if the sender sent the message before its marker, the message was sent before the sender crossed the boundary, so the send is inside the cut. Causal closure holds for every message pair, which is the definition of a consistent cut.',
        'The algorithm does not require synchronized clocks, a central coordinator that remains alive throughout, or any process to pause. It requires only reliable FIFO channels and a way to distinguish marker messages from ordinary messages. These are weak assumptions that most practical systems satisfy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The marker traffic itself is lightweight. In a system with P processes and C channels, one snapshot generates at most C marker messages, each a small control packet. For a system with 10 processes and 30 channels, that is 30 extra messages, negligible compared to the millions of ordinary messages flowing per second.',
        'The real cost is snapshot materialization: serializing and persisting process state. A stream-processing operator with 50 GB of keyed state must copy or checkpoint that state to durable storage (HDFS, S3, a local RocksDB snapshot). If checkpoints run every 60 seconds and state serialization takes 8 seconds, the system spends 13% of its time writing checkpoints. Storage bandwidth, not marker traffic, is the bottleneck.',
        'Aligned checkpoints (the default in Flink before 1.11) require an operator to wait for barriers from all input channels before snapshotting. If one input channel is slow (backpressured, or a slow upstream partition), the operator buffers records from faster channels while waiting. This amplifies backpressure and increases end-to-end latency. Flink measured checkpoint durations blowing up from 2 seconds to 30+ seconds under skewed input rates.',
        'Unaligned checkpoints (Flink 1.11+) solve the alignment delay by allowing the operator to snapshot immediately when the first barrier arrives and recording the buffered in-flight records from other channels as part of the checkpoint state. This reduces checkpoint latency but increases checkpoint size (because the in-flight buffers must be persisted) and makes recovery more expensive (because those buffers must be replayed). The tradeoff is the same one Chandy-Lamport identified: channel state is the price of not waiting for synchronization.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Apache Flink uses checkpoint barriers (markers) that flow with data records. When all barriers for a checkpoint epoch arrive at an operator, it snapshots its keyed state, timers, and operator metadata to a state backend (RocksDB + S3). The completed checkpoint includes source offsets (Kafka consumer positions), operator state, and sink pre-commit handles. Recovery restores state, seeks sources to the checkpointed offsets, and replays. This provides exactly-once processing semantics within the Flink pipeline, assuming sinks support two-phase commit.',
        'Google\'s MillWheel (2013) and its successor Dataflow use a similar per-key checkpointing model where each key\'s state is persisted after processing, with exactly-once delivery enforced by deduplication tables. The checkpoint granularity is per-record rather than per-epoch, which trades higher per-record overhead for lower recovery latency (only the single failed key\'s state needs replay, not the entire operator).',
        'Database snapshot isolation (PostgreSQL\'s MVCC, for example) uses a related idea: each transaction sees a consistent snapshot of the database as of a logical timestamp. The snapshot boundary is the transaction\'s start timestamp rather than a marker message, but the principle is identical. Reads within the transaction never see writes from transactions that committed after the snapshot, which is causal closure applied to database rows instead of process states.',
        'Distributed debuggers and deadlock detectors also rely on consistent snapshots. A deadlock detector takes a snapshot, builds a wait-for graph from the recorded states, and checks for cycles. Because the snapshot is a consistent cut, any deadlock detected in the snapshot either existed at some point during execution or will exist in the future (by the "stable property detection" theorem from Chandy and Lamport\'s original paper).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The algorithm assumes reliable FIFO channels. If a channel can reorder messages, a marker no longer cleanly separates pre-snapshot from post-snapshot messages. An ordinary message sent before the marker could arrive after it, escaping the channel-state recording window. TCP provides FIFO ordering within a connection, but systems that multiplex messages across connections, use UDP, or pass through message brokers with partitioned delivery may violate this assumption. The fix is either to enforce FIFO per logical channel or to add sequence numbers and buffer until ordering is restored before processing markers.',
        'The algorithm assumes a fixed, known process graph. If processes can join, leave, crash, or migrate state during the snapshot, the algorithm has no built-in mechanism to handle the change. A process that crashes mid-snapshot leaves its local state unrecorded and its incoming channels unresolved. Production systems handle this by restarting the snapshot, relying on the underlying consensus layer to maintain group membership, or checkpointing incrementally so a failed snapshot discards only a small delta.',
        'External side effects are the hardest failure mode. A consistent internal snapshot does not automatically make an email, a payment API call, a database write to an external system, or an alert exactly-once. If the system recovers from the snapshot and replays records, it will re-execute those side effects unless the sink is idempotent or participates in a two-phase commit protocol tied to the checkpoint boundary. Flink\'s exactly-once sink guarantee requires sinks to implement the TwoPhaseCommitSinkFunction interface, pre-committing during the checkpoint and finalizing only after the checkpoint is confirmed durable.',
        'Large state is a practical limit. Checkpointing 200 GB of keyed state to S3 every 60 seconds requires sustained write throughput of over 3 GB/s. If the state backend cannot serialize and upload that fast, checkpoints fall behind, checkpoint intervals grow, and recovery after failure replays more work. Incremental checkpointing (writing only the delta since the last checkpoint, as Flink does with RocksDB\'s SST file tracking) mitigates this, but adds complexity in managing file references and garbage collection of old snapshots.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three processes P1, P2, P3 are connected: P1 sends to P2, P2 sends to P3, and P3 sends to P1 (a ring). P1 initiates a snapshot at logical time t=5. P1 records its local state S1 (say, bank balance $300) and sends markers on its outgoing channel to P2. P1 then continues sending ordinary messages.',
        'At t=6, P1 sends ordinary message M1 ($50 transfer) to P2. At t=7, P2 receives the marker from P1. P2 records its local state S2 ($200), marks the P1-to-P2 channel as empty (because the marker arrived first on this channel, so all pre-snapshot messages were already received), and sends markers on its outgoing channel to P3. At t=8, P2 receives M1 ($50 transfer). M1 was sent after P1\'s marker, so it is post-snapshot and not recorded as channel state.',
        'Meanwhile, at t=4 (before the snapshot began), P3 had sent ordinary message M0 ($100 transfer) to P1. At t=6, P1 receives M0. P1 already recorded its local state at t=5, so M0 arrived after P1\'s snapshot. P1 has not yet received a marker from P3, so M0 is recorded as channel state on the P3-to-P1 channel. Later, P3 receives its marker from P2, records S3 ($500), and sends a marker to P1. When P1 receives P3\'s marker, it finalizes the P3-to-P1 channel state as {M0}.',
        'The completed snapshot is: local states {S1=$300, S2=$200, S3=$500}, channel states {P1-to-P2: empty, P2-to-P3: empty, P3-to-P1: {M0=$100}}. Total money in the system: $300 + $200 + $500 + $100 = $1100. This matches the true total at any consistent point. The $100 in the channel represents money that left P3 but had not yet arrived at P1 at the snapshot boundary. If recovery restores this snapshot, M0 is replayed from the channel state, and no money is lost or duplicated.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original paper is K. Mani Chandy and Leslie Lamport, "Distributed Snapshots: Determining Global States of Distributed Systems" (ACM Transactions on Computer Systems, 1985). Lindsey Kuper\'s blog post "An example run of the Chandy-Lamport snapshot algorithm" (2019) provides an excellent step-by-step walkthrough with space-time diagrams. For the streaming translation, the Apache Flink documentation on checkpointing covers barrier alignment, incremental checkpoints, and exactly-once sink semantics. The MillWheel paper (Akidau et al., 2013) describes per-key checkpointing with deduplication.',
        'Prerequisites: study Clocks and Ordering (Lamport clocks, vector clocks, causality) to understand why "consistent cut" is defined in terms of causal order rather than wall-clock time. Study Message Queues for the channel abstraction and FIFO delivery guarantees that the algorithm depends on. Study Write-Ahead Logging for the durable-recovery mechanism that complements snapshot state.',
        'Study next: Flink Checkpointing Case Study for the production implementation of barrier snapshots with aligned and unaligned modes. MillWheel Streaming Case Study for per-key checkpointing at low latency. Streaming Watermarks for event-time progress tracking, which solves a related but distinct problem (knowing when all events before a timestamp have arrived). Two-Phase Commit for the sink-side protocol that extends the consistent cut to external systems. A useful exercise: draw three processes, send two messages that cross process boundaries, then draw one valid consistent cut and one invalid cut. Label the in-flight messages explicitly. That small drawing will make checkpoint barriers, source offsets, and exactly-once claims concrete.',
      ],
    },
  ],
};
