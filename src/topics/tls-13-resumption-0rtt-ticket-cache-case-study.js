// TLS 1.3 resumption: session tickets turn a previous authenticated handshake
// into PSK state for faster reconnects, with 0-RTT replay risk at the boundary.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tls-13-resumption-0rtt-ticket-cache-case-study',
  title: 'TLS 1.3 Resumption & 0-RTT Tickets',
  category: 'Security',
  summary: 'How TLS 1.3 uses NewSessionTicket, PSK binders, ticket caches, early data, anti-replay windows, and idempotency boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['resumption', '0-RTT replay'], defaultValue: 'resumption' },
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

function ticketGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.6, note: notes.client ?? 'browser' },
      { id: 'full', label: 'full', x: 2.2, y: 2.6, note: notes.full ?? '1-RTT' },
      { id: 'ticket', label: 'ticket', x: 3.9, y: 2.6, note: notes.ticket ?? 'NST' },
      { id: 'cache', label: 'cache', x: 3.9, y: 5.8, note: notes.cache ?? 'PSK' },
      { id: 'ch', label: 'CH', x: 5.5, y: 4.6, note: notes.ch ?? 'binder' },
      { id: 'server', label: 'server', x: 7.2, y: 4.6, note: notes.server ?? 'accept' },
      { id: 'anti', label: 'replay', x: 7.2, y: 2.3, note: notes.anti ?? 'window' },
      { id: 'app', label: 'app', x: 8.9, y: 4.6, note: notes.app ?? 'keys' },
    ],
    edges: [
      { id: 'e-client-full', from: 'client', to: 'full', weight: '' },
      { id: 'e-full-ticket', from: 'full', to: 'ticket', weight: '' },
      { id: 'e-ticket-cache', from: 'ticket', to: 'cache', weight: '' },
      { id: 'e-cache-ch', from: 'cache', to: 'ch', weight: '' },
      { id: 'e-ch-server', from: 'ch', to: 'server', weight: '' },
      { id: 'e-server-anti', from: 'server', to: 'anti', weight: '' },
      { id: 'e-server-app', from: 'server', to: 'app', weight: '' },
      { id: 'e-anti-app', from: 'anti', to: 'app', weight: '' },
    ],
  }, { title });
}

function* resumption() {
  yield {
    state: ticketGraph('A full TLS 1.3 handshake can mint resumption tickets'),
    highlight: { active: ['client', 'full', 'ticket', 'e-client-full', 'e-full-ticket'], compare: ['cache'] },
    explanation: 'After a normal authenticated TLS 1.3 handshake, the server can send NewSessionTicket messages. The ticket lets the client resume later using PSK state derived from the original connection.',
    invariant: 'Resumption is anchored in a previous full handshake, not a random shortcut.',
  };

  yield {
    state: ticketGraph('The client stores a bounded ticket cache', { cache: 'host PSKs', ticket: 'age/adders' }),
    highlight: { active: ['ticket', 'cache', 'e-ticket-cache'], found: ['full'] },
    explanation: 'Browsers keep resumption material with scope, age, ALPN, SNI, cipher-suite, and privacy constraints. A stale or wrong-scope ticket must not be offered to the wrong connection.',
  };

  yield {
    state: ticketGraph('The next ClientHello offers PSK identity and binder', { cache: 'PSK', ch: 'id+binder', server: 'verify' }),
    highlight: { active: ['cache', 'ch', 'server', 'e-cache-ch', 'e-ch-server'], compare: ['full'] },
    explanation: 'On reconnect, the client sends a ClientHello containing a PSK identity and binder. The binder proves the client knows the resumption secret and binds the offer to this ClientHello.',
  };

  yield {
    state: labelMatrix(
      'Resume choices',
      [
        { id: 'full', label: 'full' },
        { id: 'psk', label: 'PSK' },
        { id: 'pskdhe', label: 'PSK+DHE' },
        { id: 'early', label: '0-RTT' },
      ],
      [
        { id: 'latency', label: 'latency' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['1-RTT', 'fresh auth'],
        ['fast', 'ticket age'],
        ['fast', 'fresh DH'],
        ['0 round', 'replay'],
      ],
    ),
    highlight: { active: ['pskdhe:latency', 'early:risk'], compare: ['full:latency'] },
    explanation: 'TLS 1.3 can resume with PSK and can combine PSK with fresh Diffie-Hellman. Early data is a separate latency feature with a different replay boundary.',
  };

  yield {
    state: ticketGraph('The complete case is a returning mobile API client', { client: 'phone', cache: 'api ticket', ch: 'resume', server: 'PSK ok', app: 'HTTP/3' }),
    highlight: { active: ['client', 'cache', 'ch', 'server', 'app', 'e-cache-ch', 'e-ch-server', 'e-server-app'], found: ['ticket'] },
    explanation: 'A phone reconnects to api.example.com after roaming networks. Resumption avoids certificate-path work and can reduce handshake latency, while the application still validates cookies, JWTs, scopes, and authorization.',
  };
}

function* zeroRttReplay() {
  yield {
    state: ticketGraph('0-RTT lets the client send early application data', { cache: 'PSK', ch: 'early_data', server: 'maybe', app: 'early req' }),
    highlight: { active: ['cache', 'ch', 'server', 'app', 'e-cache-ch', 'e-ch-server', 'e-server-app'], compare: ['anti'] },
    explanation: 'With a suitable ticket, the client may send early data before the new handshake is fully confirmed. That hides a round trip for repeat connections.',
    invariant: '0-RTT data can be replayed; only replay-safe operations belong there.',
  };

  yield {
    state: ticketGraph('Servers gate early data with anti-replay state', { anti: 'seen set', server: 'check', app: 'hold' }),
    highlight: { active: ['server', 'anti', 'e-server-anti'], compare: ['app'] },
    explanation: 'Servers can reject early data or use anti-replay windows. In distributed deployments, this means coordinating ticket keys, time windows, and replay records across edge machines.',
  };

  yield {
    state: labelMatrix(
      'Early-data policy',
      [
        { id: 'get', label: 'GET' },
        { id: 'put', label: 'PUT' },
        { id: 'pay', label: 'pay' },
        { id: 'login', label: 'login' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['maybe', 'cacheable'],
        ['rare', 'idempotent'],
        ['no', 'money'],
        ['no', 'stateful'],
      ],
    ),
    highlight: { active: ['get:fit', 'pay:reason', 'login:reason'], compare: ['put:fit'] },
    explanation: 'The application chooses what is replay-safe. A cacheable GET may be fine. Payment, login, inventory mutation, and email-send operations do not belong in 0-RTT unless they are made idempotent above TLS.',
  };

  yield {
    state: ticketGraph('An attacker can replay captured early data to another edge', { client: 'capture', cache: 'same PSK', ch: 'replay', server: 'edge B', anti: 'miss', app: 'risk' }),
    highlight: { active: ['client', 'cache', 'ch', 'server', 'anti', 'app'], removed: ['full'] },
    explanation: 'The hard production case is a multi-edge CDN. If edge A sees early data and edge B does not share replay state, the same early request may be accepted twice.',
  };

  yield {
    state: ticketGraph('The complete policy routes unsafe requests after Finished', { ch: 'no early', anti: 'deny list', app: 'after fin', server: 'safe' }),
    highlight: { found: ['server', 'app', 'anti'], compare: ['ch'], removed: ['ticket'] },
    explanation: 'A practical policy allows 0-RTT only for safe, idempotent, cacheable requests and requires normal post-handshake traffic for mutations. Idempotency keys remain the application-level safety net.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'resumption') yield* resumption();
  else if (view === '0-RTT replay') yield* zeroRttReplay();
  else throw new InputError('Pick a TLS resumption view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'TLS 1.3 resumption lets a client and server use key material from a previous authenticated handshake to reconnect faster. The server sends NewSessionTicket, the client stores scoped PSK state, and a future ClientHello offers a PSK identity plus binder.',
        'RFC 8446 defines TLS 1.3, including NewSessionTicket, PSK resumption, binders, early data, and anti-replay concerns: https://www.rfc-editor.org/rfc/rfc8446.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The client ticket cache stores PSK identity, resumption secret, ticket age metadata, cipher constraints, ALPN, SNI, expiration, and privacy scope. The server side either decrypts self-contained tickets with a rotating key or maps ticket identity to stored session state.',
        'The binder is the integrity check that proves the client knows the PSK and commits the offer to the new ClientHello. 0-RTT early data adds replay tracking, because an attacker may replay captured early bytes before the server can prove global uniqueness.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A mobile app repeatedly connects to api.example.com over HTTP/3. The first visit performs a full TLS 1.3 handshake and receives session tickets. Later visits offer a scoped ticket and resume, reducing latency and certificate-path work during network changes.',
        'The API allows early data only for cacheable GETs. Login, payment, inventory, and message-send endpoints require normal post-handshake traffic or application idempotency keys. The CDN coordinates ticket-key rotation and anti-replay windows across edge locations.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        '0-RTT is encrypted but not fully replay-safe. Encryption does not stop a captured early-data flight from being replayed. That is why TLS exposes the risk to application policy instead of pretending every HTTP method is safe.',
        'Tickets are also privacy-sensitive. Long-lived, broadly scoped tickets can link repeat visits. Production systems rotate ticket keys, limit lifetime, scope by hostname and ALPN, and fall back to full handshakes when assumptions drift.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 8446 TLS 1.3 at https://www.rfc-editor.org/rfc/rfc8446. Study TLS 1.3 Handshake, QUIC Transport Streams & Loss Recovery, HTTP/3 over QUIC, CDN Request Flow, Idempotency, Rate Limiter, and Distributed Tracing next.',
      ],
    },
  ],
};
