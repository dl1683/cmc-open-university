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
    explanation: 'QUIC uses UDP as the outer packet carrier, but the endpoint state is richer than UDP: connection IDs route packets, packet numbers drive loss detection, TLS 1.3 creates keys, stream offsets order bytes, and flow-control credit bounds memory.',
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
    explanation: 'A QUIC implementation is mostly state tables. Packet-number spaces keep handshake and application loss state separate, stream maps track byte offsets, and connection IDs keep routing stable when the client changes network paths.',
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
    explanation: 'The sender ledger remembers which frames were in each packet, whether the packet is ack-eliciting, and how many bytes are still in flight. Recovery is a ledger update before it is a retransmission.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read PN as packet number, the transport identity used for acknowledgements and loss detection. Read stream offset as the application position inside one logical byte stream, so packet order and stream order are separate facts.',
        'A missing packet number is not a command to resend that same packet. It is a pointer into the sent-packet ledger, and the repair packet carries the still-needed frame data with a new packet number.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'QUIC is a transport protocol, which means it decides how endpoints move application bytes across a network path. It exists because web traffic needs encryption, multiplexed requests, loss recovery, flow control, congestion control, and connection migration in one deployable protocol.',
        'TCP gives one ordered byte stream. If byte 8000 is missing, byte 9000 cannot be delivered even when the later bytes belong to a different HTTP request, so HTTP/2 over TCP can still suffer connection-level head-of-line blocking.',
        {type:'callout', text:'QUIC separates packet recovery from stream ordering so loss repair does not turn the whole connection into one blocked byte stream.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep TCP, put TLS above it, and multiplex application streams above that. This works through most networks and lets the operating system handle retransmission and congestion control.',
        'Another tempting approach is to send messages over UDP and retry missing messages in the application. That avoids some TCP limits, but it forces the application to rebuild security, congestion behavior, flow control, and replay protection.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the transport sees the wrong unit of ordering. TCP orders bytes for the whole connection, while the application may have many independent streams whose missing ranges should not block one another.',
        'A casual UDP protocol fails on the opposite side. Without packet numbers, acknowledgement ranges, timers, congestion accounting, and receiver credit, it can retransmit too much, confuse old and new sends, or overload the path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'QUIC separates packet recovery from stream assembly. Packets have packet numbers for transport recovery, while STREAM frames carry a stream id and byte offset for application ordering.',
        'That split removes retransmission ambiguity. Lost information can be sent again in a new packet number, and duplicate stream bytes can be ignored because the stream id and offset already identify the data range.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A QUIC packet is an encrypted UDP datagram containing frames. ACK frames report received packet-number ranges, STREAM frames carry application bytes, and flow-control frames advertise how much more data the receiver will accept.',
        'The sender keeps a sent-packet ledger with packet number, send time, frames, bytes in flight, and encryption level. When acknowledgements leave a gap or a time threshold expires, the sender marks the packet lost and schedules the frame data that still needs reliable delivery.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The first invariant is that packet numbers are never reused within a packet-number space. An ACK therefore names one transmission, not an ambiguous packet id that might have been recycled.',
        'The second invariant is stream-offset idempotence. If stream B offset 0 through 999 arrives twice, the receiver stores it once, so repair can be aggressive without duplicating application bytes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'QUIC moves transport work into endpoint code. The implementation pays for encrypted packet handling, ACK range parsing, timers, sent-packet logs, congestion control, flow-control windows, stream scheduling, path validation, and connection-id management.',
        'If active streams double from 500 to 1000, stream state and out-of-order buffers can roughly double even when the network path is unchanged. If packets in flight double, the recovery ledger and ACK processing also grow, and the dominant cost may shift from network RTT to CPU and memory bookkeeping.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'QUIC is the transport under HTTP/3. It fits browsers, mobile apps, APIs, media delivery, and long-lived client connections that benefit from encrypted setup, stream multiplexing, and migration across changing network addresses.',
        'It is especially useful when independent streams matter. A lost packet carrying stream B should not stop stream A if stream A already has the contiguous bytes it needs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'QUIC is not automatically faster than TCP. A single large ordered response on a clean stable path may not benefit from stream independence, and poor UDP treatment by middleboxes can make operations worse.',
        'It also cannot remove blocking inside one application stream. If the application serializes all work into one stream or waits on one database call before producing output, the transport cannot create independence that the application did not expose.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client sends packet 10 with stream A bytes 0 through 999, packet 11 with stream B bytes 0 through 999, and packet 12 with stream A bytes 1000 through 1999. The server receives 10 and 12, so its ACK range proves 11 is missing while stream A can still assemble bytes 0 through 1999.',
        'After a packet-threshold loss rule fires, the client sends stream B bytes 0 through 999 again in packet 15. If packet 11 later arrives, the server ignores the duplicate stream range because packet recovery is separate from stream assembly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9000 for QUIC transport, RFC 9001 for TLS in QUIC, and RFC 9002 for QUIC loss detection and congestion control. These define packet numbers, frames, connection ids, loss timers, acknowledgements, and congestion accounting.',
        'Study TCP reassembly and SACK scoreboard for the older recovery model, sliding window for credit control, HTTP/3 over QUIC for the application layer, and QPACK for header compression under QUIC streams.',
      ],
    },
  ],
};
