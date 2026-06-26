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
    { heading: 'How to read the animation', paragraphs: [
        'Read the ticket cache as bounded remembered proof from an earlier full TLS 1.3 handshake. Active nodes show the client offering a ticket, the server verifying the binder, or early data being accepted or rejected.',
        '0-RTT means application data sent before the new handshake finishes, so it can save one round trip. The safe inference rule is that encrypted early data is still replayable unless the application operation is safe to repeat or protected by its own replay ledger.',
        {type:'callout', text:'Resumption is fast because it reuses scoped proof from a prior handshake, and risky only when early data crosses a replay-sensitive boundary.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4c/Abbreviated_TLS_1.3_Handshake.svg', alt:'Timeline diagram of an abbreviated TLS 1.3 handshake between client and server.', caption:'Abbreviated TLS 1.3 handshake diagram, Fleshgrinder and The People from The Tango! Desktop Project, public domain, via Wikimedia Commons.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'A full TLS 1.3 handshake authenticates the server and creates fresh traffic keys, but it costs a round trip and public-key work. Repeat connections to the same service should not pay all of that cost every time when a previous authenticated connection already created resumable state.',
        'Resumption exists to reuse a pre-shared key, or PSK, derived from an earlier handshake. 0-RTT exists to let the client send selected application bytes immediately, which can remove one round trip on repeat connections.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to perform a full handshake for every connection. That is simple and conservative, but it repeats certificate validation and key exchange even when the client just connected to the same server minutes ago.',
        'Another obvious approach is to send early data whenever the client has a ticket. That improves latency for repeat connections, but it treats encryption as if it also solved replay safety, which it does not.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is that a captured 0-RTT flight can be replayed. An attacker may not read the encrypted bytes, but it can resend them, and a distributed server fleet may process the same early request twice if replay state is not coordinated.',
        'The second wall is ticket scope. A ticket is a credential-like handle with lifetime, server identity, application protocol, cipher context, and privacy implications, so a sloppy cache can resume the wrong policy or help track a client.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is that resumption is scoped reuse of a previous authenticated secret. The PSK binder proves the client still knows the resumption secret and binds that proof to the new ClientHello.',
        '0-RTT must be handled as replayable input by design. TLS can provide hooks such as ticket age checks, single-use tickets, and seen-ticket windows, but only the application knows whether repeating a request changes money, inventory, login state, or another durable fact.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'After a full handshake, the server sends NewSessionTicket messages. The client stores ticket identity, lifetime, age data, cipher information, ALPN, and resumption context in a bounded cache keyed by server and protocol scope.',
        'On the next connection, the client offers one or more ticket identities in ClientHello and includes a binder for each. The server decrypts or looks up the ticket, verifies the binder, checks age and policy, and decides whether to resume with PSK alone or PSK plus fresh Diffie-Hellman.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'Resumption works because the binder is a message authentication code over the ClientHello prefix, keyed by a secret derived from the earlier handshake. An attacker that does not know the PSK cannot forge a valid binder for an arbitrary ticket offer.',
        'PSK plus Diffie-Hellman restores forward secrecy for the resumed session because fresh ephemeral key exchange contributes to the new traffic secrets. PSK-only mode is cheaper but makes the resumed session depend more directly on the secrecy and lifetime of the ticket material.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'Resumption reduces latency and CPU by skipping certificate validation and sometimes skipping fresh public-key work. On a 120 ms mobile path, saving one round trip can remove about 120 ms from the first useful response on a repeat connection.',
        'The cost is ticket management. Servers need ticket-key rotation, cache eviction, age checks, scope enforcement, privacy controls, and replay tracking, while applications need a rule for which endpoints are safe to process as early data.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'Resumption is useful for browsers reconnecting to CDN edges, mobile apps on high-latency networks, service-to-service connections, IoT clients with limited CPU, and HTTP/3 connections where QUIC embeds TLS 1.3. The access pattern is repeated contact with the same authenticated service.',
        '0-RTT fits cacheable GET requests, static assets, DNS-over-HTTPS queries, and carefully designed idempotent API calls. Idempotent means repeating the same operation has the same durable effect as running it once.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'Do not put payments, login changes, inventory decrements, one-time token use, or email sends in 0-RTT without an application idempotency key and replay ledger. TLS cannot look inside the business operation and decide whether processing it twice is safe.',
        'Do not treat tickets as permanent credentials. Long ticket lifetimes, weak rotation, broad scope, or repeated ticket reuse increase both compromise exposure and client-tracking risk.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'A browser completes a full TLS 1.3 handshake to static.example.com and receives two tickets with 3600-second lifetimes. It stores them under static.example.com:443, ALPN h2, and the selected cipher suite.',
        'Three minutes later, the browser reconnects and offers one ticket with real age 180 seconds, obfuscated by the ticket_age_add value from the server. The server verifies the binder, accepts PSK plus Diffie-Hellman resumption, and skips certificate transmission and validation.',
        'The browser sends GET /logo.png as 0-RTT early data. If that early data is replayed to another edge, the image may be served twice, which is harmless; if the request were POST /transfer, the application would need an idempotency key to prevent a double transfer.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary source: RFC 8446 at https://www.rfc-editor.org/rfc/rfc8446, especially sections 2.2, 2.3, 4.2.10, 4.2.11, 4.6.1, and 8. These sections define resumption, early data, PSK binders, tickets, and anti-replay guidance.',
        'Study the TLS 1.3 handshake, HKDF, PSK binders, QUIC 0-RTT, HTTP idempotency, CDN request routing, replay caches, and idempotency-key design next. The useful engineering question is which layer owns replay safety for each endpoint.',
      ],
    },
  ],
};
