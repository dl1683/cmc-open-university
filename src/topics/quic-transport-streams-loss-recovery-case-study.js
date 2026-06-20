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
      heading: 'Why this exists',
      paragraphs: [
        'Modern application traffic needs more than "deliver bytes in order." It needs encryption by default, multiplexed requests, loss recovery, flow control, congestion control, fast setup, and a way for mobile clients to survive network changes.',
        'TCP plus TLS plus HTTP/2 solves many of those problems, but the transport still exposes one ordered byte stream. If one TCP segment is missing, later bytes cannot be delivered to the application even when those bytes belong to a different HTTP/2 stream.',
        'QUIC is a UDP-based transport that moves the transport state into the endpoints. It integrates TLS 1.3, stream multiplexing, packet-number-based loss recovery, connection IDs, flow control, and migration into one protocol.',
        {type:'callout', text:'QUIC separates packet recovery from stream ordering so loss repair does not turn the whole connection into one blocked byte stream.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The conservative design is to keep TCP, put TLS above it, and multiplex requests above that. This is operationally familiar, works through most networks, and lets the operating system own congestion control and retransmission.',
        'The other tempting design is to send application messages over UDP and retry lost messages yourself. That avoids kernel TCP limits, but it also means rebuilding security, congestion control, flow control, loss detection, anti-amplification defense, and path validation.',
        'QUIC takes the harder middle path: use UDP as the carrier, but specify a complete reliable encrypted transport above it.',
      ],
    },
    {
      heading: 'Where that fails',
      paragraphs: [
        'TCP cannot deliver byte 9000 until byte 8000 arrives. HTTP/2 can multiplex many logical streams, but it cannot make TCP deliver later bytes from stream A while an earlier TCP byte from stream B is missing.',
        'TCP connection identity is also tied to the address tuple. When a phone moves from Wi-Fi to cellular, the tuple changes. Old TCP connections usually die or need help from higher layers.',
        'A casual UDP design fails in the other direction. Without monotonically increasing packet numbers, ACK ranges, timers, congestion accounting, and flow-control credit, it can retransmit too aggressively, confuse old and new transmissions, or become a bad network citizen.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Separate packet recovery from stream ordering. QUIC packets have packet numbers and carry frames. STREAM frames have stream IDs and byte offsets. ACK frames report packet-number ranges. The receiver delivers each stream according to stream offsets, not according to packet arrival order.',
        'That split removes retransmission ambiguity. If packet 11 is lost, the sender does not reuse packet number 11. It sends the lost frame data in a new packet with a new packet number. The receiver deduplicates by stream offset and protocol state.',
        'Once that separation exists, QUIC can multiplex streams, recover lost information, and migrate paths without pretending that the whole connection is one ordered byte stream.',
      ],
    },
    {
      heading: 'The state QUIC keeps',
      paragraphs: [
        'A QUIC endpoint is mostly state tables. Connection IDs route packets to connection state even when addresses change. Packet-number spaces separate Initial, Handshake, and 1-RTT recovery state. Stream maps track offsets and delivery state. Flow-control windows bound how much data can be buffered.',
        'The sent-packet ledger is the recovery backbone. For each ack-eliciting packet, the sender remembers the packet number, frames carried, bytes in flight, send time, and encryption level. ACK ranges update that ledger; timers and packet thresholds decide when missing packets are declared lost.',
        'TLS is integrated rather than hidden below the transport. QUIC CRYPTO frames carry TLS handshake bytes, and the resulting keys protect QUIC packets at the relevant encryption level.',
      ],
    },
    {
      heading: 'How streams and packets work',
      paragraphs: [
        'A QUIC packet is a protected UDP datagram containing one or more frames. STREAM frames carry application bytes for a stream at a specific offset. ACK frames report received packet-number ranges. MAX_DATA and MAX_STREAM_DATA extend flow-control credit. PATH_CHALLENGE and PATH_RESPONSE validate a path.',
        'Packet order and stream order are different. A packet number says when a packet was transmitted. A stream offset says where bytes belong inside one application stream. The receiver can keep stream A moving even if stream B is waiting for a missing offset.',
        'This is not free parallelism. If one packet contains data from streams A and B and that packet is lost, both streams wait for the data in that packet. QUIC reduces cross-stream blocking; it does not make loss disappear.',
      ],
    },
    {
      heading: 'How loss recovery works',
      paragraphs: [
        'The receiver sends ACK ranges that describe packet numbers it has received. A range such as 10 and 12 but not 11 gives the sender a gap to evaluate. The sender combines ACK information with time thresholds, packet thresholds, and the probe timeout timer.',
        'When a packet is declared lost, QUIC retransmits the information that still needs reliable delivery, not the packet identity. The repair packet gets a new packet number. That new number tells future ACKs exactly which transmission arrived.',
        'Congestion control and recovery share accounting. Bytes in flight, congestion window, pacing, and flow-control credit decide whether repair data can be sent immediately or must wait.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client sends packet 10 with stream A bytes at offset 0, packet 11 with stream B bytes at offset 0, and packet 12 with stream A bytes at offset 1024. The server receives 10 and 12 and sends an ACK range that leaves a gap at 11.',
        'The client marks packet 10 and 12 acknowledged. Packet 11 remains in the sent ledger until the loss rule fires. When it is declared lost, the client takes the STREAM frame data for stream B offset 0 and sends it in packet 15.',
        'The server does not care that stream B data now arrived in packet 15. It merges by stream ID and offset. If the original packet 11 later arrives, the duplicate stream bytes are ignored because offset 0 for stream B has already been received.',
      ],
    },
    {
      heading: 'How to read the visualization',
      paragraphs: [
        'In the streams-and-packets view, follow the split between PN and streams. PN is the packet-number machinery used for ACKs and loss; streams is the application-byte machinery used for ordered delivery.',
        'The TLS and CRYPTO frame state matters because QUIC does not run TLS as an opaque byte stream under the transport. Handshake bytes are part of QUIC packetization, and packet-number spaces keep handshake recovery separate from application-data recovery.',
        'In the loss-recovery view, the missing pn11 node is not a command to resend packet 11. It is a pointer into the sent-packet ledger. The repair node sends the lost frame data in a fresh packet, while the receiver merges by stream offset.',
        'The cwnd and flow nodes are guardrails. A correct QUIC implementation repairs loss only while respecting congestion control and receiver credit.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The main invariant is that packet numbers never repeat within a packet-number space. That makes every ACK unambiguous: it acknowledges a specific transmission, not a reused number that might refer to old or new bytes.',
        'The second invariant is stream-offset idempotence. A STREAM frame says exactly which byte range it carries. Receiving the same range twice does not create new application data; it only confirms data already known.',
        'Together, those invariants let QUIC repair lost information without corrupting ordered streams. Packet recovery decides which frame data must be sent again. Stream assembly decides when each stream has contiguous bytes ready for the application.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'QUIC moves transport work into user space. Implementations pay for timers, ACK range parsing, sent-packet logs, TLS integration, pacing, congestion control, anti-amplification limits, path validation, stream scheduling, and flow-control bookkeeping.',
        'The memory cost scales with active streams, buffered out-of-order data, ACK ranges, connection IDs, paths, and sent packets still in flight. Doubling concurrent streams can double stream-state pressure even when the network path is unchanged.',
        'The CPU cost can move from kernel TCP to application endpoints and load balancers. That is a good trade when deployment agility and multiplexing matter. It is a bad trade when CPU is already the bottleneck or UDP treatment on the path is poor.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'QUIC is a strong fit for HTTP/3, mobile apps, long-lived connections that move between networks, request multiplexing, and systems that need transport evolution without waiting for every operating-system TCP stack to change.',
        'It helps most when independent streams matter. If stream A has all its bytes, it should not wait for a lost packet that only carried stream B. QUIC gives the transport enough structure to make that distinction.',
        'Connection IDs also help large deployments route packets to the right connection state across NAT rebinding and migration, as long as the implementation manages connection-ID privacy and lifecycle correctly.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'QUIC is not automatically faster. A single large ordered response on a stable low-loss path may not benefit much from stream independence. If UDP is blocked, shaped, or poorly load-balanced, TCP can be more reliable operationally.',
        'QUIC does not remove application-level head-of-line blocking inside one stream. If the application serializes all work into one stream or waits on one database call before producing any response, the transport cannot create independence that the application did not expose.',
        'It is also a poor choice for simple local protocols where TCP already works and the extra security, migration, and multiplexing machinery is not needed.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Loss recovery bugs are easy to hide in happy-path tests. Reusing packet numbers, dropping sent-packet ledger state too early, mishandling ACK ranges, or retransmitting old packet identities can produce spurious loss, stuck streams, or duplicate delivery.',
        'Flow-control bugs become memory bugs. If the sender ignores credit, the receiver can be forced to buffer too much data. If the receiver fails to grant credit when the application drains buffers, streams stall.',
        'Migration and connection-ID bugs become routing and privacy bugs. A connection ID that is reused across paths can make clients linkable. A server that accepts path changes without validation can be abused for amplification.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RFC 9000, QUIC Transport, at https://www.rfc-editor.org/rfc/rfc9000; RFC 9001, Using TLS to Secure QUIC, at https://www.rfc-editor.org/rfc/rfc9001; and RFC 9002, QUIC Loss Detection and Congestion Control, at https://www.rfc-editor.org/rfc/rfc9002.',
        'Study TLS 1.3 Handshake for key setup, TCP Reassembly & SACK Scoreboard for the contrast with TCP recovery, TCP: Handshake & Congestion Control for the older transport model, Sliding Window for flow and congestion basics, Backpressure & Flow Control for receiver credit, HTTP/3 over QUIC for the application layer, and QPACK Dynamic Table HTTP/3 for header compression under QUIC streams.',
      ],
    },
  ],
};
