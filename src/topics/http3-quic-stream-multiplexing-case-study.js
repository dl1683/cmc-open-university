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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a boundary between connection state and stream state. Active stream segments are the bytes currently being delivered, visited segments have arrived but may still be waiting for an earlier byte in the same stream, and found segments are safe to pass to HTTP. The safe inference is that packet loss can block a stream range without blocking unrelated streams whose ordered ranges are complete.',
        {type:'callout', text:'HTTP/3 fixes multiplexing by giving each request stream independent ordered delivery while sharing one encrypted transport connection.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A web page opens many logical requests, but opening many separate secure transport connections is expensive. HTTP/2 put many streams on one TCP connection, which saved handshakes and allowed concurrent requests. The remaining problem was TCP head-of-line blocking: TCP exposes one ordered byte stream, so a missing segment delays all later bytes even when those later bytes belong to a different HTTP response.',
        'HTTP/3 exists to move multiplexing below HTTP and above UDP through QUIC. QUIC is a reliable encrypted transport with independent streams, packet recovery, flow control, and congestion control. It keeps one connection while avoiding the false global byte order that TCP imposes on multiplexed HTTP/2.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The older HTTP/1.1 approach is to open several TCP connections so multiple objects can download at once. That works around some blocking, but it multiplies TLS handshakes, congestion controllers, kernel queues, sockets, and server memory. It also makes prioritization harder because each connection sees only part of the page.',
        'HTTP/2 is the more reasonable first attempt. It frames many HTTP streams over one TLS-over-TCP connection, so requests can be interleaved and share one congestion controller. The design is cleaner than connection sharding, but it inherits TCP delivery rules that HTTP cannot change.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a layer mismatch. HTTP/2 knows which bytes belong to which stream, but TCP only knows byte offset 1, byte offset 2, and so on for the whole connection. If byte offset 1,000 is missing, the operating system cannot deliver byte offset 2,000 to HTTP/2 even if byte offset 2,000 contains a complete response for another stream.',
        'Loss is not the only cause of delay, but it exposes the design bug. One image packet lost on a mobile path can hold back a small API response that already arrived. The application sees a stall that was created by the transport byte order, not by an HTTP dependency.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'HTTP requires ordered bytes inside each message, not one total order across all messages. QUIC keeps per-stream order and reliability while sharing encryption, congestion control, connection ids, and path state at the connection level. That is the essential split: global connection resources, independent stream delivery.',
        'The data structure is a connection table plus stream records. The connection tracks packet numbers, keys, acknowledgments, congestion window, and global flow credit. Each stream tracks offsets, receive buffers, send buffers, reset state, and stream-level flow credit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client negotiates HTTP/3 through QUIC, usually after discovery through Alt-Svc, HTTPS records, or direct configuration. During the QUIC handshake, TLS 1.3 is integrated into the transport and ALPN selects h3. HTTP/3 then opens a control stream for SETTINGS and bidirectional streams for requests and responses.',
        'Packets carry frames, and stream frames carry stream id, offset, and bytes. If a packet is lost, QUIC retransmits the missing stream data or repairs it with new frames, but the loss is mapped to the affected stream offsets. Other streams with complete contiguous ranges can continue delivering to HTTP.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument follows from the HTTP message contract. A response body must preserve order within that response, and QUIC does preserve per-stream order. HTTP does not require an image response and an API response to share one delivery order, so QUIC is free to expose the API bytes while the image stream waits for its missing range.',
        'The performance argument is blast radius. TCP loss blocks all later bytes on the connection because TCP has one receive sequence. QUIC loss blocks only streams with missing ranges from that loss, while congestion control still slows the whole connection when the path is unhealthy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'HTTP/3 does not make loss free. Lost bytes still consume congestion window, trigger acknowledgments and retransmission logic, and delay the streams that need those bytes. If the link capacity is 5 Mbps, independent streams still share that 5 Mbps.',
        'The operational cost is UDP reachability, user-space transport work, new metrics, and fallback behavior. QUIC implementations need flow-control tuning, QPACK blocked-stream limits, idle timeouts, connection migration handling, packet pacing, and observability that differs from mature TCP tooling. For a low-loss internal service with few concurrent responses, HTTP/2 may be simpler and fast enough.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HTTP/3 wins on paths with loss, jitter, and handoff, especially mobile networks and long public internet routes. Image-heavy pages, font-heavy pages, and API-heavy apps benefit because unrelated streams can continue making progress. The gain often appears as smoother tail behavior rather than a large median speedup.',
        'It also fits CDN edges. The edge terminates QUIC close to users, absorbs last-mile variability, and can talk to origins over HTTP/2 or another internal protocol if that is simpler. QUIC connection ids also help connections survive some address changes, such as a phone moving between Wi-Fi and cellular.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HTTP/3 cannot remove dependencies above transport. A response can still wait on server CPU, database locks, cache fills, rate limits, QPACK dynamic entries, application ordering, or bad priority. If the bottleneck is a database connection pool, independent QUIC streams do not fix it.',
        'It can also lose when UDP is blocked or degraded, when CPU overhead dominates, or when the object count is small. Some networks still treat UDP poorly, so production deployments need HTTP/2 fallback and measurements by network type. A good rollout compares the current bottleneck, not HTTP/3 against a weak imaginary baseline.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a page fetches HTML, CSS, an 80 KB image, and a 2 KB session API response over one HTTP/2 connection. A TCP segment carrying image bytes is lost at connection byte offset 60,000, while later bytes containing the complete API response arrive at the client. TCP cannot deliver those later bytes to HTTP/2 until the gap is repaired, so the small API response waits behind the image loss.',
        'With HTTP/3, the image is stream 12 and the API response is stream 16. If the lost packet contains stream 12 offsets 40,000 through 41,459, stream 12 waits for that range, but stream 16 can deliver its complete 2 KB if its offsets are contiguous. The network still lost a packet, but the application no longer treats every response as one byte queue.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 9114 for HTTP/3 and RFC 9000 for QUIC transport. Study RFC 9204 for QPACK, RFC 9218 for HTTP priority, and browser waterfall traces to connect stream delivery with visible page progress. Then compare this with TCP congestion control and HTTP/2 framing so the layer change is concrete rather than described as HTTP over UDP.',
      ],
    },
  ],
};