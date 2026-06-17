// HTTP/3 over QUIC: request streams, control streams, QPACK streams, and
// transport-level multiplexing without TCP head-of-line blocking.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'http3-quic-stream-multiplexing-case-study',
  title: 'HTTP/3 over QUIC',
  category: 'Systems',
  summary: 'HTTP/3 maps requests, responses, settings, and QPACK state onto QUIC streams so packet loss does not block every multiplexed request behind one TCP byte.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['request streams', 'head-of-line'], defaultValue: 'request streams' },
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

function h3Graph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'browser', label: 'browser', x: 0.6, y: 4.0, note: notes.browser ?? 'fetch' },
      { id: 'alpn', label: 'ALPN', x: 2.0, y: 2.1, note: notes.alpn ?? 'h3' },
      { id: 'quic', label: 'QUIC', x: 2.0, y: 5.9, note: notes.quic ?? 'streams' },
      { id: 'control', label: 'control', x: 4.0, y: 1.5, note: notes.control ?? 'SETTINGS' },
      { id: 'qenc', label: 'qenc', x: 4.0, y: 3.3, note: notes.qenc ?? 'insert' },
      { id: 'qdec', label: 'qdec', x: 4.0, y: 5.1, note: notes.qdec ?? 'acks' },
      { id: 'req', label: 'request', x: 4.0, y: 6.9, note: notes.req ?? 'H/DATA' },
      { id: 'edge', label: 'edge', x: 6.5, y: 4.0, note: notes.edge ?? 'route' },
      { id: 'origin', label: 'origin', x: 8.8, y: 4.0, note: notes.origin ?? 'app' },
    ],
    edges: [
      { id: 'e-browser-alpn', from: 'browser', to: 'alpn', weight: '' },
      { id: 'e-browser-quic', from: 'browser', to: 'quic', weight: '' },
      { id: 'e-quic-control', from: 'quic', to: 'control', weight: '' },
      { id: 'e-quic-qenc', from: 'quic', to: 'qenc', weight: '' },
      { id: 'e-quic-qdec', from: 'quic', to: 'qdec', weight: '' },
      { id: 'e-quic-req', from: 'quic', to: 'req', weight: '' },
      { id: 'e-control-edge', from: 'control', to: 'edge', weight: '' },
      { id: 'e-qenc-edge', from: 'qenc', to: 'edge', weight: '' },
      { id: 'e-qdec-edge', from: 'qdec', to: 'edge', weight: '' },
      { id: 'e-req-edge', from: 'req', to: 'edge', weight: '' },
      { id: 'e-edge-origin', from: 'edge', to: 'origin', weight: 'miss' },
    ],
  }, { title });
}

function holGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pkt1', label: 'pkt1', x: 0.9, y: 2.1, note: notes.pkt1 ?? 'req A' },
      { id: 'pkt2', label: 'pkt2', x: 0.9, y: 4.0, note: notes.pkt2 ?? 'req B' },
      { id: 'pkt3', label: 'pkt3', x: 0.9, y: 5.9, note: notes.pkt3 ?? 'req C' },
      { id: 'loss', label: 'loss', x: 2.9, y: 4.0, note: notes.loss ?? 'B gap' },
      { id: 'streamA', label: 'A', x: 5.1, y: 2.1, note: notes.streamA ?? 'ok' },
      { id: 'streamB', label: 'B', x: 5.1, y: 4.0, note: notes.streamB ?? 'wait' },
      { id: 'streamC', label: 'C', x: 5.1, y: 5.9, note: notes.streamC ?? 'ok' },
      { id: 'app', label: 'app', x: 7.3, y: 4.0, note: notes.app ?? 'dispatch' },
      { id: 'resp', label: 'resp', x: 9.0, y: 4.0, note: notes.resp ?? 'parallel' },
    ],
    edges: [
      { id: 'e-pkt1-streamA', from: 'pkt1', to: 'streamA', weight: '' },
      { id: 'e-pkt2-loss', from: 'pkt2', to: 'loss', weight: 'lost' },
      { id: 'e-pkt3-streamC', from: 'pkt3', to: 'streamC', weight: '' },
      { id: 'e-loss-streamB', from: 'loss', to: 'streamB', weight: 'gap' },
      { id: 'e-streamA-app', from: 'streamA', to: 'app', weight: '' },
      { id: 'e-streamB-app', from: 'streamB', to: 'app', weight: 'later' },
      { id: 'e-streamC-app', from: 'streamC', to: 'app', weight: '' },
      { id: 'e-app-resp', from: 'app', to: 'resp', weight: '' },
    ],
  }, { title });
}

function* requestStreams() {
  yield {
    state: h3Graph('HTTP/3 uses QUIC streams instead of a TCP stream'),
    highlight: { active: ['browser', 'alpn', 'quic', 'control', 'req'], found: ['edge'] },
    explanation: 'HTTP/3 is the HTTP mapping for QUIC. ALPN selects h3 during the QUIC/TLS handshake, then HTTP messages ride on QUIC streams rather than on one ordered TCP byte stream.',
    invariant: 'Each request stream has its own ordered bytes, while the connection has shared settings and compression state.',
  };

  yield {
    state: labelMatrix(
      'HTTP/3 stream roles',
      [
        { id: 'ctrl', label: 'control' },
        { id: 'req0', label: 'req str' },
        { id: 'qenc', label: 'qenc' },
        { id: 'qdec', label: 'qdec' },
        { id: 'push', label: 'push' },
      ],
      [
        { id: 'dir', label: 'direction' },
        { id: 'job', label: 'job' },
      ],
      [
        ['uni', 'SETTINGS'],
        ['bidi', 'HEADERS/DATA'],
        ['uni', 'table inserts'],
        ['uni', 'table acks'],
        ['uni', 'server push'],
      ],
    ),
    highlight: { active: ['ctrl:job', 'req0:job'], found: ['qenc:job', 'qdec:job'] },
    explanation: 'HTTP/3 reserves unidirectional streams for connection control and QPACK. A normal request uses a bidirectional stream: client HEADERS and optional DATA go one way, response HEADERS and DATA come back on the same stream.',
  };

  yield {
    state: h3Graph('A GET request is HEADERS, then response DATA', { req: 'GET /img', edge: 'cache hit', origin: 'skip', qenc: 'refs', qdec: 'acks' }),
    highlight: { active: ['req', 'edge', 'e-req-edge'], found: ['qenc', 'qdec'], removed: ['origin'] },
    explanation: 'A cacheable GET can terminate at the edge. The request stream carries compressed HEADERS, and the response stream bytes can return without opening a new TCP connection to the origin on a hit.',
  };

  yield {
    state: labelMatrix(
      'Request stream frame order',
      [
        { id: 'h1', label: 'HEADERS' },
        { id: 'd1', label: 'DATA' },
        { id: 'h2', label: 'trailers' },
        { id: 'reset', label: 'RESET' },
      ],
      [
        { id: 'what', label: 'what' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['pseudo+fields', 'start msg'],
        ['body bytes', 'optional'],
        ['fields', 'after body'],
        ['error code', 'stop stream'],
      ],
    ),
    highlight: { active: ['h1:rule', 'd1:what'], compare: ['reset:what'] },
    explanation: 'HTTP semantics are still ordered within one request stream. QUIC changes the transport substrate, not the fact that an HTTP message has header fields, optional body bytes, and optional trailers.',
  };

  yield {
    state: h3Graph('Flow control comes from QUIC stream credit', { quic: 'credit', req: 'body', edge: 'read', origin: 'backpressure', control: 'SETTINGS' }),
    highlight: { active: ['quic', 'req', 'edge', 'origin'], compare: ['control'] },
    explanation: 'HTTP/3 does not reuse HTTP/2 WINDOW_UPDATE frames. QUIC provides connection-level and stream-level flow control, so an endpoint can bound memory while still allowing independent request streams to progress.',
  };
}

function* headOfLine() {
  yield {
    state: labelMatrix(
      'Multiplexing comparison',
      [
        { id: 'http11', label: 'HTTP/1.1' },
        { id: 'http2', label: 'HTTP/2' },
        { id: 'http3', label: 'HTTP/3' },
        { id: 'cache', label: 'CDN edge' },
      ],
      [
        { id: 'mux', label: 'mux model' },
        { id: 'loss', label: 'loss effect' },
      ],
      [
        ['many conns', 'per TCP conn'],
        ['one TCP conn', 'all wait'],
        ['QUIC streams', 'gap only'],
        ['near user', 'less RTT pain'],
      ],
    ),
    highlight: { active: ['http2:loss', 'http3:loss'], found: ['cache:loss'] },
    explanation: 'HTTP/2 multiplexes streams, but it usually runs over one TCP connection. A missing TCP segment blocks later bytes for every HTTP/2 stream. HTTP/3 moves multiplexing into QUIC so unrelated streams can keep making progress.',
    invariant: 'QUIC removes TCP-level head-of-line blocking, not application dependencies.',
  };

  yield {
    state: holGraph('Loss pauses one stream instead of the whole connection'),
    highlight: { active: ['pkt2', 'loss', 'streamB', 'e-pkt2-loss', 'e-loss-streamB'], found: ['streamA', 'streamC', 'app'] },
    explanation: 'Packet loss still hurts. The difference is scope: stream B waits for its missing bytes, while streams A and C can deliver ordered data to the HTTP layer if their bytes arrived.',
  };

  yield {
    state: labelMatrix(
      'HTTP/2 frames that changed',
      [
        { id: 'headers', label: 'HEADERS' },
        { id: 'data', label: 'DATA' },
        { id: 'settings', label: 'SETTINGS' },
        { id: 'window', label: 'WINDOW' },
        { id: 'ping', label: 'PING' },
      ],
      [
        { id: 'h2', label: 'HTTP/2' },
        { id: 'h3', label: 'HTTP/3' },
      ],
      [
        ['HPACK', 'QPACK'],
        ['same role', 'same role'],
        ['conn stream', 'control stream'],
        ['HTTP frame', 'QUIC flow'],
        ['HTTP frame', 'QUIC path'],
      ],
    ),
    highlight: { active: ['headers:h2', 'headers:h3', 'window:h3'], compare: ['ping:h3'] },
    explanation: 'HTTP/3 keeps HTTP semantics but removes or remaps pieces that QUIC already provides. Header compression becomes QPACK because HPACK depended on strict TCP ordering.',
  };

  yield {
    state: h3Graph('Negotiation keeps fallback paths available', { browser: 'fetch', alpn: 'h3 or h2', quic: 'UDP ok?', control: 'SETTINGS', edge: 'edge', origin: 'fallback' }),
    highlight: { active: ['browser', 'alpn', 'quic'], compare: ['origin'], found: ['edge'] },
    explanation: 'Clients and servers negotiate HTTP/3 support. If UDP is blocked or QUIC fails, deployments often keep HTTP/2 or HTTP/1.1 fallback paths, so the application can keep serving while transport capability varies by network.',
  };

  yield {
    state: labelMatrix(
      'Production checklist',
      [
        { id: 'altsvc', label: 'Alt-Svc' },
        { id: 'udp', label: 'UDP path' },
        { id: 'qpack', label: 'QPACK' },
        { id: 'flow', label: 'flow ctl' },
        { id: 'obs', label: 'metrics' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['advertise h3', 'stale endpoint'],
        ['allow QUIC', 'fallback to h2'],
        ['bound blocks', 'header stalls'],
        ['credit policy', 'mem pressure'],
        ['new metrics', 'blind spots'],
      ],
    ),
    highlight: { active: ['qpack:failure', 'flow:need'], found: ['udp:failure'] },
    explanation: 'HTTP/3 is a deployment change, not just an API change. Edges need UDP reachability, QPACK limits, transport metrics, fallback logic, and application backpressure that still behaves when many request streams run concurrently.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'request streams') yield* requestStreams();
  else if (view === 'head-of-line') yield* headOfLine();
  else throw new InputError('Pick an HTTP/3 view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `A modern page is not one request. It is a burst of HTML, CSS, JavaScript, images, fonts, API calls, analytics beacons, and later refreshes from the same origin. The browser wants those requests to share one secure connection, but it does not want one missing packet for a large image to freeze an unrelated API response.`,
        `HTTP/3 exists because HTTP/2 solved the wrong layer of the problem. HTTP/2 multiplexed many HTTP streams over one TCP connection, which removed most of the old HTTP/1.1 connection pileup. But TCP still exposes one ordered byte stream. If one TCP segment is lost, the operating system cannot deliver later bytes to HTTP/2, even when those later bytes belong to other streams. HTTP/3 moves multiplexing into QUIC so each request stream has its own ordered delivery state.`,
      ],
    },
    {
      heading: 'The older approaches',
      paragraphs: [
        `HTTP/1.1 handled concurrency by opening several TCP connections. That let a browser fetch more than one object at a time, but it also multiplied handshakes, TLS sessions, congestion controllers, server sockets, and queues. It made prioritization weak because each connection saw only part of the page.`,
        `HTTP/2 was a better design. It put many logical streams on one encrypted TCP connection and gave HTTP a framing layer. The browser could send request A, request B, and request C without waiting for A to finish. The wall was below HTTP. TCP's single byte order meant a packet gap blocked all later bytes on the connection, not just the HTTP/2 stream that needed the missing bytes.`,
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        `HTTP does not need one total byte order for the whole connection. It needs ordered bytes inside one request and response. It also needs shared connection state for settings, compression, flow control, and cancellation. QUIC gives HTTP that layout: many independent ordered streams inside one encrypted transport connection.`,
        `The data structure is a connection-level table of stream state. Each stream has an identifier, byte offsets, receive buffers, send buffers, reset state, and flow-control credit. The connection has congestion control, packet numbers, keys, connection IDs, and global credit. A missing packet can block one stream's missing range without making already-arrived ranges from unrelated streams unavailable to the HTTP layer.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The request-streams view shows the mapping. ALPN selects h3, a QUIC connection carries HTTP/3 streams, the control stream carries SETTINGS, request streams carry HEADERS and DATA, and QPACK uses encoder and decoder streams for compression state. The important point is that HTTP semantics are still there. The transport under them changed.`,
        `The head-of-line view shows the reason for the redesign. Loss still hurts, but the harm is scoped. If bytes for stream B are missing, stream B waits. If streams A and C have complete ordered ranges, they can move upward to HTTP. The animation is about the boundary between connection-level packet recovery and stream-level delivery.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A client first discovers or negotiates that the server supports HTTP/3, usually through Alt-Svc from an earlier response, HTTPS records, or direct configuration. During the QUIC handshake, TLS is integrated into the transport and ALPN selects h3. After that, HTTP/3 runs as an application mapping over QUIC streams.`,
        `Each endpoint opens a unidirectional control stream and sends SETTINGS. A normal request uses a bidirectional stream. The client sends request HEADERS, then optional DATA. The server sends response HEADERS, then response DATA, then optional trailers. Stream order still matters inside that request. A body byte cannot be delivered before earlier bytes in the same body.`,
        `QUIC handles jobs that HTTP/2 had to handle or inherit from TCP: loss recovery, stream reset, connection and stream flow control, path validation, connection migration, packet encryption, and packet acknowledgment. HTTP/3 therefore removes some HTTP/2 frames or remaps them. WINDOW_UPDATE disappears because credit belongs to QUIC. PING belongs to the transport path. SETTINGS moves to the control stream.`,
        `Header compression also changes. HTTP/2 used HPACK, which relied on strict TCP ordering. HTTP/3 uses QPACK, which lets header blocks reference dynamic-table entries without forcing every stream to wait on one connection-wide byte order. A header block can still block if it references an entry the decoder has not received, but that is an explicit QPACK dependency with limits, not accidental TCP head-of-line blocking.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a browser asks a CDN for index.html, app.js, hero.jpg, style.css, and /api/session. Over HTTP/2, those logical streams can share one TCP connection. If a TCP segment carrying part of hero.jpg is lost, later TCP bytes cannot be delivered to HTTP/2 until the gap is recovered. The API response may be sitting in the kernel buffer, but the application cannot receive it yet because it appears after the gap in TCP's byte stream.`,
        `Over HTTP/3, the same page uses one QUIC connection. index.html is one stream, app.js is another, hero.jpg is another, and /api/session is another. QUIC packet loss recovery still retransmits or repairs missing data, but stream delivery is independent. If the lost data belongs to hero.jpg, the browser can still receive completed bytes for /api/session and style.css.`,
        `This is why the change matters most on lossy or variable paths. It is not because HTTP/3 makes packets immortal. It is because the system stops treating all application streams as if they were one byte queue.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is simple. HTTP requires ordered interpretation of one message, not a global order across all messages. QUIC preserves per-stream order. Therefore a request body, response body, header section, trailers section, and stream reset still mean what HTTP says they mean. The connection no longer invents a false dependency between unrelated request streams.`,
        `The performance argument is about blast radius. In TCP, one missing segment blocks delivery of later bytes for the entire connection. In QUIC, packet loss blocks only the streams that are missing ranges from that packet. Congestion control is still connection-wide, so all streams share path capacity, but delivery into the application is no longer held behind one byte gap.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `HTTP/3 reduces transport head-of-line blocking, but it does not make loss free. Lost packets still consume congestion window, trigger recovery, and delay any stream whose bytes are missing. If a large response and a small response share the same congested link, they still compete for bandwidth.`,
        `The deployment cost is real. QUIC runs over UDP. Operators need UDP reachability through firewalls, load balancers, NATs, and middleboxes. They need transport metrics that are different from TCP metrics. They need h2 or h1 fallback because some networks still block or degrade UDP. They need tuning for stream counts, flow-control windows, QPACK blocked streams, idle timeouts, retry behavior, and connection migration.`,
        `There is also CPU and implementation cost. QUIC encrypts most transport metadata and is often implemented in user space rather than in the operating system's mature TCP stack. That can improve rollout speed and feature control, but it can also make packet processing, observability, and kernel bypass decisions more important for high-volume edges.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `HTTP/3 wins when a client makes many independent requests over a path with loss, jitter, handoff, or variable radio quality. Mobile browsers, CDN edges, image-heavy pages, font-heavy pages, and API-heavy web apps all fit that shape. The user-visible gain is often smoother progress, not a magic drop in every median latency number.`,
        `It also wins when connection continuity matters. QUIC connection IDs let a connection survive some path changes, such as a phone moving from Wi-Fi to cellular, without rebuilding every request from scratch. That does not guarantee no interruption, but it gives the transport a tool TCP does not have in the same form.`,
        `HTTP/3 is especially natural at CDN and reverse-proxy edges. The edge can terminate QUIC near the user, absorb network variability, and talk to origins over a different protocol when that is operationally simpler. The public internet path gets the QUIC benefits while the internal path can remain tuned for the data center.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `HTTP/3 cannot remove dependencies above the transport. A request can still wait on server CPU, database locks, cache fills, origin shielding, rate limits, application-level ordering, or poor prioritization. If the bottleneck is the origin database, QUIC streams will not fix it.`,
        `It can also lose to a mature HTTP/2 deployment when the path is clean, the object count is low, UDP is unreliable, or CPU overhead dominates. A small internal service on a stable network may see little benefit and more operational work. The right comparison is not HTTP/3 against an imaginary bad HTTP/2 stack. It is HTTP/3 against the current bottleneck.`,
        `QPACK has its own failure modes. If an encoder references dynamic-table entries too aggressively, header blocks can wait for decoder state. Good implementations bound blocked streams and choose conservative compression behavior when latency matters more than marginal header savings.`,
      ],
    },
    {
      heading: 'Common misconceptions',
      paragraphs: [
        `One misconception is that HTTP/3 is simply HTTP over UDP. It is HTTP over QUIC, and QUIC is a full transport with reliability, congestion control, encryption, streams, flow control, loss recovery, and connection IDs. UDP is the substrate that lets QUIC be deployed without changing operating-system TCP stacks.`,
        `Another misconception is that HTTP/3 removes all head-of-line blocking. It removes TCP-level head-of-line blocking between independent streams. It does not remove per-stream ordering, QPACK dependencies, congestion, server queues, application dependencies, or bad prioritization.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: RFC 9114 HTTP/3 at https://datatracker.ietf.org/doc/html/rfc9114 and RFC 9000 QUIC Transport at https://datatracker.ietf.org/doc/html/rfc9000. Those two documents define the HTTP mapping and the transport invariant this topic depends on.`,
        `Study next: QUIC Transport Streams & Loss Recovery for packet recovery and stream delivery, QPACK Dynamic Table HTTP/3 for header compression state, HTTP/3 Priority Urgency Scheduler for request scheduling, HPACK Dynamic Table HTTP/2 Case Study for the older compression model, CDN Request Flow for edge deployment, Backpressure & Flow Control for memory bounds, and TLS 1.3 Handshake for the integrated security layer.`,
      ],
    },
  ],
};
