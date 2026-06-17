// TCP reassembly and SACK scoreboards: interval state around a byte stream.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tcp-reassembly-sack-scoreboard',
  title: 'TCP Reassembly & SACK Scoreboard',
  category: 'Systems',
  summary: 'TCP receives a byte stream out of order, buffers intervals, advertises SACK blocks, and lets the sender retransmit holes instead of everything.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['receiver reassembly', 'sender scoreboard'], defaultValue: 'receiver reassembly' },
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

function packetGraph(title) {
  return graphState({
    nodes: [
      { id: 'sender', label: 'sender', x: 0.7, y: 4.0, note: 'bytes' },
      { id: 'seg0', label: '0-1k', x: 2.6, y: 1.4, note: 'ok' },
      { id: 'seg1', label: '1k-2k', x: 2.6, y: 3.1, note: 'lost' },
      { id: 'seg2', label: '2k-3k', x: 2.6, y: 4.9, note: 'ok' },
      { id: 'seg3', label: '3k-4k', x: 2.6, y: 6.6, note: 'ok' },
      { id: 'rx', label: 'receiver', x: 5.2, y: 4.0, note: 'buffer' },
      { id: 'ack', label: 'ACK 1k', x: 7.4, y: 2.7, note: 'cum' },
      { id: 'sack', label: 'SACK', x: 7.4, y: 5.3, note: '2k-4k' },
      { id: 'rxt', label: 'rxt', x: 9.1, y: 4.0, note: 'hole' },
    ],
    edges: [
      { id: 'e-s-0', from: 'sender', to: 'seg0', weight: '' },
      { id: 'e-s-1', from: 'sender', to: 'seg1', weight: '' },
      { id: 'e-s-2', from: 'sender', to: 'seg2', weight: '' },
      { id: 'e-s-3', from: 'sender', to: 'seg3', weight: '' },
      { id: 'e-0-rx', from: 'seg0', to: 'rx', weight: 'ok' },
      { id: 'e-2-rx', from: 'seg2', to: 'rx', weight: 'OOO' },
      { id: 'e-3-rx', from: 'seg3', to: 'rx', weight: 'merge' },
      { id: 'e-rx-ack', from: 'rx', to: 'ack', weight: 'dup' },
      { id: 'e-rx-sack', from: 'rx', to: 'sack', weight: 'blocks' },
      { id: 'e-sack-rxt', from: 'sack', to: 'rxt', weight: 'hole' },
    ],
  }, { title });
}

function filledGraph(title) {
  return graphState({
    nodes: [
      { id: 'sender', label: 'sender', x: 0.8, y: 4.0, note: 'rxt' },
      { id: 'hole', label: '1000-1999', x: 2.8, y: 4.0, note: 'fills gap' },
      { id: 'rx', label: 'receiver', x: 4.9, y: 4.0, note: 'merge' },
      { id: 'stream', label: '0-3999', x: 6.9, y: 4.0, note: 'contiguous' },
      { id: 'app', label: 'app', x: 8.8, y: 4.0, note: 'deliver' },
    ],
    edges: [
      { id: 'e-sender-hole', from: 'sender', to: 'hole', weight: 're-send' },
      { id: 'e-hole-rx', from: 'hole', to: 'rx', weight: 'arrive' },
      { id: 'e-rx-stream', from: 'rx', to: 'stream', weight: 'coalesce' },
      { id: 'e-stream-app', from: 'stream', to: 'app', weight: 'advance ACK' },
    ],
  }, { title });
}

function* receiverReassembly() {
  yield {
    state: packetGraph('Segments can arrive out of order'),
    highlight: { active: ['seg0', 'seg2', 'seg3', 'e-0-rx', 'e-2-rx', 'e-3-rx'], removed: ['seg1'], compare: ['ack'] },
    explanation: 'TCP presents a byte stream, but IP packets can be lost or reordered. Here bytes 0-999 arrive, 1000-1999 are missing, and later bytes arrive out of order. The receiver can buffer the later intervals but cannot deliver them to the application yet.',
    invariant: 'The application receives contiguous stream bytes, not arbitrary out-of-order segments.',
  };

  yield {
    state: labelMatrix(
      'Receiver interval buffer',
      [
        { id: 'r0', label: '0-999' },
        { id: 'r1', label: '1000-1999' },
        { id: 'r2', label: '2000-2999' },
        { id: 'r3', label: '3000-3999' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'deliver', label: 'deliver?' },
        { id: 'ack', label: 'ACK effect' },
      ],
      [
        ['present', 'yes', 'ACK 1000'],
        ['missing', 'no', 'hold line'],
        ['present', 'no', 'SACK block'],
        ['present', 'no', 'SACK block'],
      ],
    ),
    highlight: { active: ['r1:state', 'r2:ack', 'r3:ack'], found: ['r0:deliver'] },
    explanation: 'The cumulative ACK names the first missing byte, so it stays at 1000. Selective acknowledgments describe later received blocks, letting the sender learn that bytes 2000-3999 do not need retransmission.',
  };

  yield {
    state: packetGraph('SACK says what arrived beyond the gap'),
    highlight: { active: ['rx', 'ack', 'sack', 'e-rx-ack', 'e-rx-sack'], found: ['rxt'] },
    explanation: 'RFC 2018 SACK blocks report non-contiguous received data beyond the cumulative ACK. That turns the receiver buffer into useful sender feedback: the sender can focus on the hole instead of guessing from duplicate ACKs alone.',
  };

  yield {
    state: filledGraph('Retransmitting the hole makes the stream contiguous'),
    highlight: { active: ['sender', 'hole', 'rx', 'e-sender-hole', 'e-hole-rx'], found: ['stream', 'app', 'e-stream-app'] },
    explanation: 'When bytes 1000-1999 arrive, the receiver merges intervals into one contiguous range, advances the cumulative ACK to 4000, and releases all newly contiguous data to the application.',
  };

  yield {
    state: labelMatrix(
      'Data structures hiding inside TCP',
      [
        { id: 'ring', label: 'receive ring' },
        { id: 'intervals', label: 'interval set' },
        { id: 'gaps', label: 'gap list' },
        { id: 'sack', label: 'SACK blocks' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'job', label: 'job' },
      ],
      [
        ['bytes', 'bounded buffering'],
        ['received ranges', 'merge neighbors'],
        ['missing ranges', 'choose retransmit'],
        ['edges of ranges', 'tell sender'],
      ],
    ),
    highlight: { active: ['intervals:job', 'gaps:job'], found: ['sack:stores'] },
    explanation: 'The concept is simple only after the right structures are named. The receiver has a byte buffer plus interval state; the sender has a scoreboard of what is cumulatively ACKed, selectively ACKed, missing, or already retransmitted.',
  };
}

function* senderScoreboard() {
  yield {
    state: packetGraph('The sender receives duplicate ACK plus SACK blocks'),
    highlight: { active: ['ack', 'sack', 'e-rx-ack', 'e-rx-sack'], found: ['rxt'], removed: ['seg1'] },
    explanation: 'A duplicate cumulative ACK says the stream is still missing byte 1000. The SACK block says later bytes arrived. Together they tell the sender that the likely repair target is 1000-1999, not the whole flight.',
  };

  yield {
    state: labelMatrix(
      'Sender scoreboard after SACK feedback',
      [
        { id: 'r0', label: '0-999' },
        { id: 'r1', label: '1000-1999' },
        { id: 'r2', label: '2000-2999' },
        { id: 'r3', label: '3000-3999' },
        { id: 'r4', label: '4000-4999' },
      ],
      [
        { id: 'mark', label: 'mark' },
        { id: 'action', label: 'sender action' },
      ],
      [
        ['cum ACKed', 'forget'],
        ['missing', 'retransmit'],
        ['SACKed', 'do not resend'],
        ['SACKed', 'do not resend'],
        ['in flight', 'count pipe'],
      ],
    ),
    highlight: { active: ['r1:mark', 'r1:action'], found: ['r2:action', 'r3:action'], compare: ['r4:mark'] },
    explanation: 'The scoreboard classifies ranges. That classification is what prevents waste: SACKed bytes are known to be at the receiver, while the missing range becomes the retransmission candidate.',
  };

  yield {
    state: labelMatrix(
      'RFC 6675 style recovery variables',
      [
        { id: 'highAck', label: 'HighACK' },
        { id: 'highData', label: 'HighData' },
        { id: 'highRxt', label: 'HighRxt' },
        { id: 'pipe', label: 'Pipe' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['highest cum ACK', 'left edge of repair'],
        ['highest sent seq', 'right edge of flight'],
        ['highest retransmit', 'avoid repeats'],
        ['estimated in flight', 'respect cwnd'],
      ],
    ),
    highlight: { active: ['highAck:meaning', 'pipe:why'], found: ['highRxt:why'] },
    explanation: 'Loss recovery is still congestion control. The sender repairs holes while estimating how much data remains in flight, so SACK does not become permission to blast unlimited retransmissions.',
  };

  yield {
    state: filledGraph('Scoreboard repair retransmits the hole'),
    highlight: { active: ['sender', 'hole', 'e-sender-hole'], found: ['stream', 'app'], compare: ['rx'] },
    explanation: 'Once the sender chooses 1000-1999 for retransmission, the receiver can coalesce the buffered intervals. A small amount of interval bookkeeping saves a full round trip of blind recovery on multiple losses.',
  };

  yield {
    state: labelMatrix(
      'Why cumulative ACK alone is weaker',
      [
        { id: 'single', label: 'one loss' },
        { id: 'multi', label: 'multiple losses' },
        { id: 'reorder', label: 'reordering' },
        { id: 'tail', label: 'tail loss' },
      ],
      [
        { id: 'cum_only', label: 'cum ACK only' },
        { id: 'with_sack', label: 'with SACK' },
      ],
      [
        ['duplicate ACK hints', 'hole is explicit'],
        ['one per RTT risk', 'several holes visible'],
        ['ambiguous signal', 'ranges clarify state'],
        ['may need timeout', 'still hard, but more info'],
      ],
    ),
    highlight: { active: ['multi:cum_only', 'multi:with_sack'], found: ['reorder:with_sack'] },
    explanation: 'SACK is not magic and does not remove timeouts, congestion windows, or retransmission policy. It improves the sender information model: the receiver can name non-contiguous bytes it already has.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'receiver reassembly') yield* receiverReassembly();
  else if (view === 'sender scoreboard') yield* senderScoreboard();
  else throw new InputError('Pick a TCP reassembly view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `TCP gives applications a simple abstraction: an ordered, reliable byte stream. The application writes bytes on one side and reads the same bytes in the same order on the other side. The network underneath does not provide that abstraction directly. IP packets can be lost, duplicated, delayed, or reordered. A receiver may get bytes 0-999, miss 1000-1999, and then receive 2000-3999. The application still cannot read 2000-3999 until the missing hole is repaired.`,
        `TCP reassembly is the receiver-side interval problem behind that stream abstraction. The receiver buffers out-of-order byte ranges, tracks the first missing byte, merges adjacent ranges, and releases only the contiguous prefix to the application. Selective acknowledgment adds a sender-side information structure. A cumulative ACK says, "I have everything before byte N." SACK blocks add, "I also have these later ranges." Together, they let the sender repair holes instead of guessing or resending the whole flight.`,
        `This topic is a good data-structures lesson because the core objects are not packets; they are byte intervals. Once you see ranges, holes, cumulative edges, and selective blocks, TCP loss recovery becomes much easier to reason about.`,
      ],
    },
    {
      heading: 'The naive design and the wall',
      paragraphs: [
        `The naive receiver delivers data in packet arrival order. That breaks TCP's contract. If bytes 2000-2999 arrive before bytes 1000-1999, the application must not see 2000 yet. Ordered delivery is the point of the abstraction. A receiver that exposes out-of-order data would push network disorder into every application protocol built on TCP.`,
        `Another naive receiver discards out-of-order data. That preserves ordered delivery, but wastes useful work. If the network delivered 2000-3999 successfully, throwing those bytes away forces the sender to retransmit data the receiver already had. On paths with large windows, long round trips, or multiple losses, this can destroy throughput.`,
        `The naive sender has a matching problem. With only cumulative ACKs, repeated ACK 1000 tells the sender that byte 1000 is still missing, but it says little about what happened after that. The sender may infer loss from duplicate ACKs, yet multiple losses in one window remain ambiguous. Resending everything after 1000 is safe but wasteful. Waiting for timeouts is safe but slow. The wall is missing information: the sender needs to know which later ranges arrived.`,
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        `The receiver keeps two things: byte storage and interval metadata. The byte storage holds payload data. The interval metadata records which byte ranges are present. The cumulative ACK is the left edge of the first hole: all bytes before it are contiguous and can be delivered. Any received ranges beyond that hole are out-of-order intervals. SACK blocks report those later intervals back to the sender.`,
        `When the missing range arrives, the receiver coalesces intervals. If it had 0-999 and 2000-3999, then receives 1000-1999, the separate ranges merge into 0-3999. The cumulative ACK can advance to 4000, and the application can read all newly contiguous bytes. The operation is the same interval merge idea used in memory allocators, calendars, and range indexes, but here it is tied to stream correctness and congestion control.`,
        `The sender keeps a scoreboard, which is the mirror image of the receiver's interval knowledge. Ranges can be cumulatively ACKed, selectively ACKed, missing, retransmitted, or still in flight. RFC 6675 describes a conservative SACK-based loss recovery approach using variables such as HighACK, HighData, HighRxt, and Pipe. Those names encode a central constraint: SACK improves information, but the sender still has to respect congestion control and estimate how much data remains in the network.`,
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `Assume the sender transmits four 1000-byte segments: 0-999, 1000-1999, 2000-2999, and 3000-3999. The second segment is lost, while the first, third, and fourth arrive. The receiver can deliver 0-999 to the application. It cannot deliver 2000-3999 because the byte stream has a hole. Its cumulative ACK remains 1000 because 1000 is the first missing byte.`,
        `At the same time, the receiver should not pretend the later bytes are absent. It stores 2000-3999 in the out-of-order buffer and reports that fact using SACK blocks. A SACK option contains one or more block edges describing received non-contiguous data. The sender now knows that 2000-3999 arrived and that 1000-1999 is the likely repair target.`,
        `On the sender side, the scoreboard marks 0-999 as cumulatively acknowledged, 2000-3999 as SACKed, 1000-1999 as missing or lost according to the recovery algorithm, and later transmitted data as outstanding. The sender can retransmit the hole while avoiding unnecessary retransmission of SACKed data. It also updates Pipe or an equivalent in-flight estimate so repair does not exceed the congestion window.`,
        `When the retransmitted 1000-1999 segment arrives, the receiver merges 0-999, 1000-1999, and 2000-3999 into one contiguous interval. The cumulative ACK advances to 4000. The application receives a continuous byte stream, even though the network delivered packets out of order and one range required repair.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Reassembly works because TCP's public abstraction and internal bookkeeping are allowed to differ. The application sees only contiguous bytes. The receiver internally keeps non-contiguous ranges so useful data is not wasted. The cumulative ACK preserves the simple stream edge, while SACK blocks reveal extra state without changing what the application observes.`,
        `SACK works because it increases the sender's information without granting unlimited sending rights. Duplicate ACKs and cumulative ACKs give hints. SACK blocks give concrete ranges. The sender can repair several holes in a window instead of discovering one loss per round trip. But congestion control still governs how much data can be in flight, and recovery algorithms must avoid injecting too much retransmitted data after a loss event.`,
        `The interval representation is compact. The receiver does not need one record per byte. It can store ranges and merge neighbors. The sender does not need to remember every packet as an isolated object once ranges are classified. This is why interval sets, gap lists, and scoreboards show up repeatedly in transport implementations. They summarize stream state at the right granularity.`,
      ],
    },
    {
      heading: 'Where it is used',
      paragraphs: [
        `Receiver reassembly is used by every TCP endpoint. The details vary by operating system, but the job is universal: accept segments, validate sequence numbers, trim overlaps, buffer out-of-order data, merge ranges, advance the receive window, and deliver contiguous bytes to sockets. Firewalls, proxies, intrusion detection systems, packet capture tools, and load balancers often need related reassembly logic to interpret streams correctly.`,
        `SACK scoreboards are used in TCP senders that support selective acknowledgment. They matter most on paths with large bandwidth-delay products, wireless loss, multiple losses in one window, or reordering. Without SACK, a sender can waste round trips rediscovering holes. With SACK, it can focus repair on missing intervals while preserving the congestion-control response to loss.`,
        `The same pattern appears in other transports and systems. QUIC has stream offsets and ACK ranges. RTP jitter buffers use sequence windows, though their deadlines differ because real-time media may drop late packets. Storage replication systems track log ranges. Download managers track completed byte ranges. The shared idea is simple: when data arrives out of order, maintain intervals rather than pretending order was preserved.`,
      ],
    },
    {
      heading: 'Tradeoffs and failure modes',
      paragraphs: [
        `The receiver has to bound memory. Out-of-order data consumes buffer space, and a malicious or unlucky peer can create many holes. Implementations need policies for trimming overlaps, limiting queued ranges, handling duplicate segments, selecting which SACK blocks to report when option space is limited, and deciding what to do under receive-buffer pressure. Keeping later bytes is valuable only if the receiver can afford the memory.`,
        `The sender can also get the scoreboard wrong. If it retransmits SACKed ranges, it wastes bandwidth. If it assumes a retransmission succeeded before evidence arrives, it may stall. If it ignores reordering, it may mark data lost too early. If it treats SACK as permission to send without regard to Pipe or the congestion window, it can worsen congestion. SACK is information, not immunity from loss recovery discipline.`,
        `Tail loss and ACK loss remain hard. If the last segment in a flight is lost, there may not be enough later data to trigger duplicate ACKs or useful SACK feedback. If ACKs carrying SACK blocks are lost, the sender's view lags the receiver's actual state. Severe reordering can look like loss. Middleboxes and offload features can complicate packet captures. These are reasons transport stacks combine SACK with timers, fast retransmit, recovery algorithms, and careful validation.`,
      ],
    },
    {
      heading: 'Signals and study next',
      paragraphs: [
        `Operationally, watch out-of-order queue size, number of ranges, receive-buffer pressure, duplicate segments, SACK blocks emitted, retransmitted bytes, spurious retransmissions, recovery episodes, round-trip time, retransmission timeout events, congestion-window changes, and application stalls. A good diagnosis separates receiver memory pressure, path reordering, true loss, ACK loss, and sender recovery policy.`,
        `Primary sources: RFC 2018, "TCP Selective Acknowledgment Options": https://datatracker.ietf.org/doc/html/rfc2018. RFC 6675, "A Conservative Loss Recovery Algorithm Based on SACK": https://datatracker.ietf.org/doc/html/rfc6675. RFC 5681, "TCP Congestion Control", describes duplicate ACK behavior and fast retransmit context: https://datatracker.ietf.org/doc/html/rfc5681. Study NIC RX Ring & NAPI Poll Case Study, TCP Listen Backlog & Accept Queue Case Study, Sliding Window, TCP: Handshake & Congestion Control, Interval Tree, Ring Buffer, Backpressure & Flow Control, QUIC Transport Streams & Loss Recovery, and Message Queue next.`,
      ],
    },
  ],
};
