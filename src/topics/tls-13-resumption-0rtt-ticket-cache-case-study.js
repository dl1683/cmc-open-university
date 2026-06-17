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
    explanation: 'After a normal authenticated TLS 1.3 handshake, the server can send NewSessionTicket messages. The ticket records resumable PSK state derived from that real handshake, so a later connection can avoid repeating all certificate-path work.',
    invariant: 'Resumption is anchored in a previous full handshake, not a random shortcut.',
  };

  yield {
    state: ticketGraph('The client stores a bounded ticket cache', { cache: 'host PSKs', ticket: 'age/adders' }),
    highlight: { active: ['ticket', 'cache', 'e-ticket-cache'], found: ['full'] },
    explanation: 'The client cache is scoped state, not a universal login token. Browsers track ticket age, ALPN, SNI, cipher constraints, expiration, and privacy rules so stale or wrong-host tickets are not offered.',
  };

  yield {
    state: ticketGraph('The next ClientHello offers PSK identity and binder', { cache: 'PSK', ch: 'id+binder', server: 'verify' }),
    highlight: { active: ['cache', 'ch', 'server', 'e-cache-ch', 'e-ch-server'], compare: ['full'] },
    explanation: 'On reconnect, the ClientHello carries a PSK identity and binder. The binder proves knowledge of the resumption secret and commits that proof to this exact ClientHello.',
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
    explanation: 'TLS 1.3 can resume with PSK alone or combine PSK with fresh Diffie-Hellman. 0-RTT early data is a separate optimization: it saves a round trip but moves replay risk to the application boundary.',
  };

  yield {
    state: ticketGraph('The complete case is a returning mobile API client', { client: 'phone', cache: 'api ticket', ch: 'resume', server: 'PSK ok', app: 'HTTP/3' }),
    highlight: { active: ['client', 'cache', 'ch', 'server', 'app', 'e-cache-ch', 'e-ch-server', 'e-server-app'], found: ['ticket'] },
    explanation: 'A phone reconnects to api.example.com after roaming networks. Resumption trims handshake latency, but the resumed channel still carries normal application credentials that must be validated separately.',
  };
}

function* zeroRttReplay() {
  yield {
    state: ticketGraph('0-RTT lets the client send early application data', { cache: 'PSK', ch: 'early_data', server: 'maybe', app: 'early req' }),
    highlight: { active: ['cache', 'ch', 'server', 'app', 'e-cache-ch', 'e-ch-server', 'e-server-app'], compare: ['anti'] },
    explanation: 'With a suitable ticket, the client may send early data before the new handshake is fully confirmed. The latency win is real, but the server has not yet proved global uniqueness for those bytes.',
    invariant: '0-RTT data can be replayed; only replay-safe operations belong there.',
  };

  yield {
    state: ticketGraph('Servers gate early data with anti-replay state', { anti: 'seen set', server: 'check', app: 'hold' }),
    highlight: { active: ['server', 'anti', 'e-server-anti'], compare: ['app'] },
    explanation: 'Servers can reject early data or check anti-replay windows. In a distributed edge, that check becomes shared state: ticket keys, clocks, and seen records have to line up across machines.',
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
    explanation: 'The hard production case is a multi-edge CDN. If edge A accepts early data and edge B lacks the same replay record, the same captured request can be accepted twice.',
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
      heading: 'Why this exists',
      paragraphs: [
        'A full TLS 1.3 handshake is secure, but repeat connections should not always pay the full latency and certificate-validation cost. Phones roam networks, browsers open many short connections, and edge services reconnect often.',
        'Resumption lets a later connection reuse authenticated state from an earlier full handshake. 0-RTT goes further by letting selected application data ride on the first flight, but that trades latency for replay risk.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple answer is to run a full handshake every time. That is easy to reason about because every connection gets fresh negotiation, certificate authentication, ECDHE, and Finished checks.',
        'For many clients, that is wasteful. The server and client just authenticated each other seconds or minutes ago, yet the next connection repeats much of the same setup work.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Blind reuse of old state is unsafe. A ticket offered to the wrong hostname, protocol, cipher context, or privacy scope can link activity or resume the wrong security assumptions.',
        'Early data has a sharper wall: encryption is not replay prevention. Captured 0-RTT bytes may be replayed, especially when a distributed server fleet does not share anti-replay state perfectly.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A session ticket is scoped resumable state anchored in a previous authenticated handshake. The binder proves that the client still knows the resumption secret and binds the offer to the new ClientHello.',
        '0-RTT must be treated as replayable input. TLS can expose anti-replay hooks and let servers reject early data, but the application decides which requests are safe to process before the handshake finishes.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the resumption view, follow the ticket as scoped state from a previous full handshake. The client is not skipping authentication casually; it is proving knowledge of a resumption secret with a binder tied to the new ClientHello.",
        "In the 0-RTT replay view, separate confidentiality from replay safety. Early data can be encrypted and still be replayable. The highlighted anti-replay window and application gate show where TLS stops being enough and product semantics have to decide whether a repeated request is harmless.",
        "The important state change is not simply a faster handshake. It is a shift from fresh full authentication to resumed authenticated context, and optionally from post-handshake application data to replayable early data.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A browser connects to `static.example.com`, completes a full TLS 1.3 handshake, and receives a session ticket. Minutes later it reconnects and offers that ticket with a binder. The server verifies the binder, checks ticket age and scope, and resumes without repeating the entire certificate path and key negotiation from scratch.',
        'Now suppose the browser sends a cacheable asset request as 0-RTT early data. If an attacker replays that request, the server may serve the same image twice. That is usually acceptable. If the same mechanism is used for `POST /transfer-money`, replay can create a second transfer unless the application has its own idempotency key and replay ledger.',
        'This is why 0-RTT is an application design question, not just a cryptography checkbox. TLS can provide the mechanism and anti-replay hooks. The service owner must decide which operations can tolerate repeated delivery.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'After a full TLS 1.3 handshake, the server sends NewSessionTicket. The client stores ticket identity, resumption secret, ticket age metadata, cipher constraints, SNI, ALPN, expiration, and privacy scope.',
        'On a future connection, the client includes a PSK identity and binder in ClientHello. The server verifies the binder, checks ticket age and policy, and resumes with PSK or PSK plus fresh Diffie-Hellman.',
        'If early data is enabled, the client may send application bytes immediately. The server can accept, reject, or defer them. A production server also tracks replay windows and limits early data to operations the application marked safe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Resumption is safe only because the ticket is derived from an earlier authenticated connection and verified with a binder on the new ClientHello. The binder stops an attacker from offering arbitrary ticket identities without knowing the PSK.',
        'Replay-safe 0-RTT works by policy, not by magic. If early data is restricted to cacheable or idempotent operations, a replay should not create a second payment, second login, second inventory update, or second email send.',
        'PSK plus fresh Diffie-Hellman can also recover forward secrecy properties for the resumed connection, depending on the selected mode. That is different from saying old tickets should live forever. Ticket lifetime, key rotation, and scope still control how much trust is carried forward.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Resumption reduces latency and CPU, but it adds ticket-key rotation, cache eviction, scope checks, age checks, and privacy controls. Long-lived tickets can become tracking handles.',
        '0-RTT saves one round trip on repeat connections, but it adds application review, anti-replay storage, edge coordination, and idempotency design. In many APIs, the safer choice is to resume the channel but disable early data for mutations.',
        'Distributed edge fleets make the tradeoff sharper. A single server can remember which early-data tickets it has seen. A global CDN must coordinate enough state to reduce replay risk without turning every request into a cross-region dependency. Many systems therefore accept only low-risk early data and rely on application idempotency where mutation is unavoidable.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Review ticket scope by hostname, ALPN, cipher context, and privacy boundary. Review ticket lifetime and key rotation. Decide whether tickets are stateful, stateless, or encrypted self-contained handles. Decide what happens when a deployment changes application behavior behind the same endpoint.',
        'For 0-RTT, classify endpoints explicitly: reject, accept because idempotent, or accept only with an application idempotency key. Log early-data acceptance separately from ordinary request handling so replay investigations can see what was processed before the handshake completed.',
        'Also review observability. Resumed handshakes, rejected tickets, accepted early data, rejected early data, replay-window hits, and fallback full handshakes should be visible separately. Without that split, a latency improvement can hide a replay-risk increase or a ticket-rotation bug.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Resumption is valuable for mobile clients, browsers, CDNs, HTTP/3, short-lived service connections, and any path where handshake latency is visible.',
        '0-RTT can fit cacheable GETs, static asset fetches, and carefully designed idempotent requests. It is strongest when the edge fleet shares replay state or the request is harmless if repeated.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not put payments, login mutations, inventory changes, email sends, or one-time actions in 0-RTT unless the application has its own idempotency key and replay handling.',
        'Do not treat tickets as forever credentials. Servers should rotate ticket keys, limit ticket lifetime, scope tickets by hostname and ALPN, and fall back to full handshakes when policy or privacy assumptions change.',
        'It also fails when operators ignore privacy. A ticket can act as a correlatable handle across reconnects if scope and lifetime are too broad. Short lifetimes, careful partitioning, and conservative ticket issuance reduce that tracking surface.',
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
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 8446 TLS 1.3 at https://www.rfc-editor.org/rfc/rfc8446.',
        'Study TLS 1.3 Handshake for the full handshake that creates resumable state, QUIC Transport Streams & Loss Recovery and HTTP/3 over QUIC for transport context, CDN Request Flow for multi-edge replay boundaries, and Idempotency, Rate Limiter, and Distributed Tracing for application controls around early data.',
      ],
    },
  ],
};
