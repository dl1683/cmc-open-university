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
      heading: 'What it is',
      paragraphs: [
        'HTTP/3 is the HTTP semantic mapping that runs over QUIC. Requests, responses, settings, and compression-control messages are carried on QUIC streams. The application still sees HTTP methods, status codes, header fields, and bodies; the transport underneath is different.',
        'The key data-structure shift is that independent HTTP messages map to independent QUIC streams. HTTP/2 multiplexing over TCP can still be blocked by one missing TCP segment. HTTP/3 multiplexing over QUIC narrows that loss impact to streams whose bytes are missing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ALPN selects h3 during the QUIC/TLS handshake. Each endpoint opens a control stream and sends SETTINGS. Normal requests use bidirectional streams with HEADERS frames and optional DATA. QPACK uses separate encoder and decoder streams so dynamic-table updates and acknowledgments do not depend on one strict TCP byte order.',
        'QUIC supplies transport flow control. HTTP/3 therefore removes HTTP/2 WINDOW_UPDATE and relies on stream and connection credit from QUIC. Resetting, stopping, and prioritizing streams are coordinated across the HTTP mapping and QUIC transport.',
      ],
    },
    {
      heading: 'Complete case study: image fetch from an edge',
      paragraphs: [
        'A browser discovers that cdn.example supports h3. It starts a QUIC connection, negotiates h3, sends SETTINGS on the control stream, and issues GET /cat.jpg on a request stream. The HEADERS use QPACK references, and the response DATA returns from the edge cache.',
        'If one packet containing bytes for another request is lost, the image stream can still finish as long as its bytes arrived. The edge keeps origin fallback, HTTP/2 fallback, and cache-fill logic underneath the same HTTP semantics.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'HTTP/3 does not make every request independent. If two requests contend for server CPU, database locks, cache keys, or application-level ordering, QUIC cannot remove that dependency. It removes a transport-level ordering problem inherited from TCP.',
        'It also does not remove the need for careful compression policy. QPACK can block header decoding when a request references dynamic-table entries the decoder has not received yet. That is why QPACK has explicit blocked-stream limits.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9114 HTTP/3 at https://datatracker.ietf.org/doc/html/rfc9114 and RFC 9000 QUIC Transport at https://datatracker.ietf.org/doc/html/rfc9000. Study QUIC Transport Streams & Loss Recovery, QPACK Dynamic Table HTTP/3, HTTP/3 Priority Urgency Scheduler, HPACK Dynamic Table HTTP/2 Case Study, CDN Request Flow, Backpressure & Flow Control, and TLS 1.3 Handshake next.',
      ],
    },
  ],
};
