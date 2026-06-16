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
      heading: 'What it is',
      paragraphs: [
        'TCP gives applications a reliable ordered byte stream, but the network delivers packets that can be lost, duplicated, or reordered. Reassembly is the receiver-side work of buffering out-of-order byte ranges until missing earlier bytes arrive. The SACK scoreboard is the sender-side view of which byte ranges are cumulatively acknowledged, selectively acknowledged, missing, or still in flight.',
        'Selective acknowledgment matters because cumulative ACKs alone only say "I am still waiting for byte N." SACK blocks add "I already received these later ranges." That lets a sender retransmit holes without resending data the receiver already has.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Suppose the receiver gets bytes 0-999, misses 1000-1999, and then receives 2000-3999. It can deliver only 0-999 to the application, so the cumulative ACK remains 1000. With SACK enabled, it can also report the block 2000-4000, telling the sender the later bytes arrived out of order.',
        'The receiver maintains byte storage plus interval metadata for out-of-order ranges. When the missing interval arrives, neighboring ranges merge into one contiguous prefix, the cumulative ACK advances, and buffered bytes can be delivered. The sender maintains a scoreboard so loss recovery can prioritize gaps while respecting the congestion window.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The data structures are modest, but the edge cases are not. Implementations need bounded receive buffers, duplicate detection, interval merge logic, SACK block selection, retransmission state, timers, and congestion-control accounting. A bad scoreboard can waste bandwidth by resending SACKed data or can stall by believing a missing range was already repaired.',
        'RFC 6675 describes a conservative SACK-based loss recovery algorithm. It uses variables such as HighACK, HighData, HighRxt, and Pipe to repair losses while estimating outstanding data. The important lesson for this site is that protocol correctness is often interval bookkeeping under pressure.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A sender transmits five 1000-byte segments. Segment 1000-1999 is lost, while 2000-3999 arrives. The receiver sends duplicate ACK 1000 with SACK information for 2000-4000. The sender scoreboard marks 0-999 as cumulatively acknowledged, 2000-3999 as SACKed, 1000-1999 as missing, and 4000-4999 as still in flight. It retransmits only 1000-1999.',
        'When the repair segment arrives, the receiver merges 0-999, 1000-1999, 2000-2999, and 3000-3999 into one contiguous range and advances ACK to 4000. The application finally sees the ordered byte stream, even though the network delivered pieces out of order.',
      ],
    },
    {
      heading: 'Links to the rest of the site',
      paragraphs: [
        'NIC RX Ring & NAPI Poll Case Study explains how packets reach the TCP stack in bounded batches. Sliding Window explains why ACKs move the send window. TCP: Handshake & Congestion Control explains cwnd and loss response. TCP Listen Backlog & Accept Queue Case Study explains server-side admission before the byte stream exists. Interval Tree gives a useful mental model for merging byte ranges. Ring Buffer explains bounded receive storage. Backpressure & Flow Control explains why buffers and send rates must be controlled together. QUIC Transport Streams & Loss Recovery shows how modern HTTP transports keep a similar sent-packet ledger while moving multiplexing above UDP instead of one TCP byte stream.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 2018, "TCP Selective Acknowledgment Options": https://datatracker.ietf.org/doc/html/rfc2018. RFC 6675, "A Conservative Loss Recovery Algorithm Based on SACK": https://datatracker.ietf.org/doc/html/rfc6675. RFC 5681, "TCP Congestion Control", describes duplicate ACK behavior and fast retransmit context: https://datatracker.ietf.org/doc/html/rfc5681. Study NIC RX Ring & NAPI Poll Case Study, TCP Listen Backlog & Accept Queue Case Study, Sliding Window, TCP: Handshake & Congestion Control, Interval Tree, Ring Buffer, Backpressure & Flow Control, QUIC Transport Streams & Loss Recovery, and Message Queue next.',
      ],
    },
  ],
};
