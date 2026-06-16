// QUIC transport: protected UDP packets, independent streams, ACK ranges,
// packet-number spaces, and loss recovery.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'quic-transport-streams-loss-recovery-case-study',
  title: 'QUIC Transport Streams & Loss Recovery',
  category: 'Systems',
  summary: 'QUIC puts TLS 1.3, stream multiplexing, flow control, ACK ranges, packet-number spaces, and loss recovery into a UDP-based transport.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['streams and packets', 'loss recovery'], defaultValue: 'streams and packets' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function transportGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: notes.client ?? 'app' },
      { id: 'cid', label: 'CID', x: 2.0, y: 2.2, note: notes.cid ?? 'route' },
      { id: 'pn', label: 'PN', x: 2.0, y: 5.8, note: notes.pn ?? 'spaces' },
      { id: 'tls', label: 'TLS', x: 3.8, y: 2.2, note: notes.tls ?? 'keys' },
      { id: 'stream', label: 'streams', x: 3.8, y: 5.8, note: notes.stream ?? 'offsets' },
      { id: 'udp', label: 'UDP pkt', x: 5.8, y: 4.0, note: notes.udp ?? 'frames' },
      { id: 'ack', label: 'ACK', x: 7.4, y: 2.6, note: notes.ack ?? 'ranges' },
      { id: 'flow', label: 'flow', x: 7.4, y: 5.4, note: notes.flow ?? 'credit' },
      { id: 'server', label: 'server', x: 9.2, y: 4.0, note: notes.server ?? 'state' },
    ],
    edges: [
      { id: 'e-client-cid', from: 'client', to: 'cid', weight: '' },
      { id: 'e-client-pn', from: 'client', to: 'pn', weight: '' },
      { id: 'e-cid-tls', from: 'cid', to: 'tls', weight: '' },
      { id: 'e-pn-stream', from: 'pn', to: 'stream', weight: '' },
      { id: 'e-tls-udp', from: 'tls', to: 'udp', weight: 'seal' },
      { id: 'e-stream-udp', from: 'stream', to: 'udp', weight: 'frames' },
      { id: 'e-udp-ack', from: 'udp', to: 'ack', weight: 'seen' },
      { id: 'e-udp-flow', from: 'udp', to: 'flow', weight: 'limits' },
      { id: 'e-ack-server', from: 'ack', to: 'server', weight: '' },
      { id: 'e-flow-server', from: 'flow', to: 'server', weight: '' },
    ],
  }, { title });
}

function lossGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'sent', label: 'sent log', x: 0.8, y: 4.0, note: notes.sent ?? 'packets' },
      { id: 'p10', label: 'pn10', x: 2.4, y: 2.0, note: notes.p10 ?? 'acked' },
      { id: 'p11', label: 'pn11', x: 2.4, y: 4.0, note: notes.p11 ?? 'lost?' },
      { id: 'p12', label: 'pn12', x: 2.4, y: 6.0, note: notes.p12 ?? 'acked' },
      { id: 'ack', label: 'ACK', x: 4.3, y: 4.0, note: notes.ack ?? '10,12' },
      { id: 'timer', label: 'timer', x: 6.1, y: 2.7, note: notes.timer ?? 'PTO' },
      { id: 'cwnd', label: 'cwnd', x: 6.1, y: 5.3, note: notes.cwnd ?? 'pipe' },
      { id: 'repair', label: 'repair', x: 8.0, y: 4.0, note: notes.repair ?? 'frames' },
      { id: 'recv', label: 'recv', x: 9.4, y: 4.0, note: notes.recv ?? 'merge' },
    ],
    edges: [
      { id: 'e-sent-p10', from: 'sent', to: 'p10', weight: '' },
      { id: 'e-sent-p11', from: 'sent', to: 'p11', weight: '' },
      { id: 'e-sent-p12', from: 'sent', to: 'p12', weight: '' },
      { id: 'e-p10-ack', from: 'p10', to: 'ack', weight: 'ok' },
      { id: 'e-p12-ack', from: 'p12', to: 'ack', weight: 'ok' },
      { id: 'e-ack-timer', from: 'ack', to: 'timer', weight: 'gap' },
      { id: 'e-ack-cwnd', from: 'ack', to: 'cwnd', weight: 'bytes' },
      { id: 'e-timer-repair', from: 'timer', to: 'repair', weight: 'send' },
      { id: 'e-cwnd-repair', from: 'cwnd', to: 'repair', weight: 'allow' },
      { id: 'e-repair-recv', from: 'repair', to: 'recv', weight: 'new pn' },
    ],
  }, { title });
}

function* streamsAndPackets() {
  yield {
    state: transportGraph('QUIC is a transport above UDP packets'),
    highlight: { active: ['client', 'cid', 'pn', 'tls', 'stream', 'udp'], found: ['server'] },
    explanation: 'QUIC uses UDP as the outer packet carrier, but the endpoint state is much richer: connection IDs for routing, packet numbers for loss detection, TLS 1.3 for keys, stream offsets for ordered byte delivery, and flow-control credit for backpressure.',
    invariant: 'QUIC packet order and application stream order are separate concepts.',
  };

  yield {
    state: labelMatrix(
      'Connection state map',
      [
        { id: 'cid', label: 'CID map' },
        { id: 'pn', label: 'PN spaces' },
        { id: 'str', label: 'streams' },
        { id: 'flow', label: 'flow ctl' },
        { id: 'path', label: 'path' },
      ],
      [
        { id: 'struct', label: 'structure' },
        { id: 'job', label: 'job' },
      ],
      [
        ['hash map', 'route packet'],
        ['3 counters', 'separate loss'],
        ['offset maps', 'ordered bytes'],
        ['windows', 'bound memory'],
        ['validated addr', 'allow migrate'],
      ],
    ),
    highlight: { active: ['pn:job', 'str:struct'], found: ['cid:job', 'flow:job'] },
    explanation: 'A QUIC implementation is mostly state tables. Packet-number spaces protect handshake phases from confusing each other, stream maps track offsets, and connection IDs let a server keep routing state even when a client changes network paths.',
  };

  yield {
    state: transportGraph('TLS 1.3 handshake data travels in CRYPTO frames', { tls: 'handshake', stream: 'CRYPTO', udp: 'Initial', ack: 'handshake', server: '1-RTT' }),
    highlight: { active: ['tls', 'stream', 'udp', 'e-tls-udp', 'e-stream-udp'], found: ['server'] },
    explanation: 'QUIC does not run TLS as a separate byte stream below the transport. TLS handshake messages are carried in QUIC CRYPTO frames, and the resulting secrets protect later QUIC packets.',
  };

  yield {
    state: labelMatrix(
      'Common QUIC frame roles',
      [
        { id: 'stream', label: 'STREAM' },
        { id: 'ack', label: 'ACK' },
        { id: 'crypto', label: 'CRYPTO' },
        { id: 'maxdata', label: 'MAX_DATA' },
        { id: 'path', label: 'PATH_CH' },
      ],
      [
        { id: 'carries', label: 'carries' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['bytes+off', 'app data'],
        ['ranges', 'loss signal'],
        ['TLS bytes', 'key setup'],
        ['credit', 'flow update'],
        ['nonce', 'path check'],
      ],
    ),
    highlight: { active: ['stream:carries', 'ack:meaning', 'maxdata:meaning'], compare: ['crypto:carries'] },
    explanation: 'Packets are containers for frames. The sender retransmits lost frame information in fresh packets with new packet numbers; it does not resend the exact same packet number.',
  };

  yield {
    state: transportGraph('Independent streams limit head-of-line blocking', { stream: 'A,B,C', udp: 'pkt lost', ack: 'gap', flow: 'per stream', server: 'A ok' }),
    highlight: { active: ['stream', 'udp', 'ack', 'flow'], found: ['server'], compare: ['pn'] },
    explanation: 'If a packet carrying bytes for stream B is lost, stream B waits for the missing offset. Stream A can continue if its ordered bytes arrived. QUIC cannot remove packet loss, but it avoids making every multiplexed request wait behind one missing TCP byte.',
  };
}

function* lossRecovery() {
  yield {
    state: lossGraph('ACK ranges expose packet-number gaps'),
    highlight: { active: ['p10', 'p12', 'ack', 'e-p10-ack', 'e-p12-ack'], removed: ['p11'], compare: ['timer'] },
    explanation: 'A QUIC ACK frame can report ranges of packet numbers received. If packets 10 and 12 are acknowledged but packet 11 is not, the sender has a concrete gap to evaluate with loss thresholds and timers.',
    invariant: 'Loss recovery is driven by packet numbers, but repair retransmits frames using new packet numbers.',
  };

  yield {
    state: labelMatrix(
      'Packet number spaces',
      [
        { id: 'initial', label: 'Initial' },
        { id: 'handshake', label: 'Handshake' },
        { id: 'app', label: '1-RTT' },
        { id: 'pto', label: 'PTO' },
      ],
      [
        { id: 'keys', label: 'keys' },
        { id: 'loss', label: 'loss state' },
      ],
      [
        ['initial keys', 'own timers'],
        ['hs keys', 'own timers'],
        ['app keys', 'own timers'],
        ['probe send', 'per space'],
      ],
    ),
    highlight: { active: ['initial:loss', 'handshake:loss', 'app:loss'], found: ['pto:loss'] },
    explanation: 'QUIC keeps separate packet-number spaces for Initial, Handshake, and application data. That keeps handshake loss, application loss, and key transitions from collapsing into one ambiguous counter.',
  };

  yield {
    state: labelMatrix(
      'Sent packet ledger',
      [
        { id: 'p10', label: 'pn10' },
        { id: 'p11', label: 'pn11' },
        { id: 'p12', label: 'pn12' },
        { id: 'p13', label: 'pn13' },
      ],
      [
        { id: 'frames', label: 'frames' },
        { id: 'ack', label: 'ACK state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['A@0', 'acked', 'retire'],
        ['B@0', 'missing', 'mark loss'],
        ['A@1k', 'acked', 'retire'],
        ['C@0', 'in flight', 'count pipe'],
      ],
    ),
    highlight: { active: ['p11:ack', 'p11:action'], found: ['p10:action', 'p12:action'], compare: ['p13:action'] },
    explanation: 'The sender ledger remembers which frames were in each packet, whether the packet is ack-eliciting, and how many bytes are still in flight. Loss recovery updates this ledger before deciding what can be sent next.',
  };

  yield {
    state: lossGraph('Repair sends lost frame data in a fresh packet', { p11: 'lost', timer: 'loss', repair: 'B@0', recv: 'stream B' }),
    highlight: { active: ['p11', 'timer', 'repair', 'e-timer-repair'], found: ['recv'], compare: ['cwnd'] },
    explanation: 'When packet 11 is declared lost, its STREAM frame data can be sent again in a new packet with a new packet number. The receiver merges by stream offset, so duplicate frame data can be ignored safely.',
  };

  yield {
    state: labelMatrix(
      'What QUIC recovery balances',
      [
        { id: 'lat', label: 'latency' },
        { id: 'spurious', label: 'spurious' },
        { id: 'cwnd', label: 'cwnd' },
        { id: 'flow', label: 'flow ctl' },
        { id: 'migrate', label: 'migrate' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['slow repair', 'loss timer'],
        ['false loss', 'time thresh'],
        ['over-send', 'pipe bytes'],
        ['buffer blow', 'MAX_DATA'],
        ['fake path', 'validate addr'],
      ],
    ),
    highlight: { active: ['lat:guard', 'cwnd:guard', 'flow:guard'], compare: ['spurious:risk'] },
    explanation: 'QUIC recovery is not simply "resend fast." It trades repair latency against false loss, congestion-window safety, memory bounds, and path validation when an endpoint moves networks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'streams and packets') yield* streamsAndPackets();
  else if (view === 'loss recovery') yield* lossRecovery();
  else throw new InputError('Pick a QUIC transport view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'QUIC is a UDP-based transport protocol that integrates TLS 1.3, reliable streams, connection migration, flow control, ACK ranges, and loss recovery. Applications see ordered streams, while the wire carries protected UDP datagrams that can contain many frame types.',
        'The useful mental model is a collection of data structures: connection-ID routing maps, packet-number spaces, sent-packet ledgers, ACK range sets, stream offset maps, flow-control windows, and path-validation state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A QUIC packet has a packet number and carries frames. STREAM frames name a stream ID and byte offset. ACK frames report packet-number ranges received. CRYPTO frames carry TLS handshake bytes. MAX_DATA and MAX_STREAM_DATA frames extend flow-control credit. PATH_CHALLENGE and PATH_RESPONSE validate a network path.',
        'When loss is detected, QUIC retransmits the lost information in new packets with new packet numbers. The receiver deduplicates by stream offset and protocol state. That split is why QUIC can recover individual streams without inheriting TCP head-of-line blocking across every multiplexed request.',
      ],
    },
    {
      heading: 'Complete case study: mobile handoff',
      paragraphs: [
        'A phone starts an HTTP/3 request on Wi-Fi. QUIC packets carry TLS handshake CRYPTO frames, then 1-RTT STREAM frames for requests and responses. The connection ID lets the server route packets to the same connection state even when the phone later moves to cellular and its IP address changes.',
        'During the handoff, packet 41 is lost. ACK ranges report packets 40 and 42 but not 41. The sender marks the lost packet, retransmits the stream frame bytes in a new packet, respects congestion and flow-control limits, and validates the new cellular path before trusting it fully.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'QUIC buys faster setup, stream-level multiplexing, encrypted transport metadata, and connection migration. The cost is more endpoint state in user space: timers, packet logs, ACK range parsing, TLS integration, anti-amplification limits, flow-control windows, and path validation.',
        'It is still a network transport. Congestion, loss, path MTU, server CPU, memory pressure, and application backpressure all remain real. QUIC changes where the state lives and how much of it is visible to the network.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9000 QUIC Transport at https://datatracker.ietf.org/doc/html/rfc9000, RFC 9001 QUIC TLS at https://datatracker.ietf.org/doc/html/rfc9001, and RFC 9002 QUIC Loss Detection and Congestion Control at https://datatracker.ietf.org/doc/html/rfc9002. Study TLS 1.3 Handshake, TCP Reassembly & SACK Scoreboard, TCP: Handshake & Congestion Control, Ring Buffer, Sliding Window, Backpressure & Flow Control, HTTP/3 over QUIC, and QPACK Dynamic Table HTTP/3 next.',
      ],
    },
  ],
};
