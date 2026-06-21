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
      heading: 'How to read the animation',
      paragraphs: [
        'The resumption view traces ticket lifecycle left to right: a full handshake mints a ticket, the client caches it with scope metadata, a later ClientHello offers the ticket with a PSK binder, and the server verifies and resumes. Active nodes are the current step in that lifecycle. Found nodes are commitments locked in from the previous full handshake.',
        'The 0-RTT replay view highlights the gap between encryption and replay safety. Follow the early-data path from the client through the server to the application, and watch the anti-replay node. When that node shows "miss," the system has no proof this early data is fresh. The matrix frame maps request types to replay fitness so you can see which operations belong in 0-RTT and which must wait.',
        'The key state change across both views is not "faster handshake." It is a shift from fresh full authentication to resumed authenticated context, and optionally from post-handshake application data to replayable early data. Each transition trades a guarantee for latency.',
        {type:'callout', text:'Resumption is fast because it reuses scoped proof from a prior handshake, and risky only when early data crosses a replay-sensitive boundary.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4c/Abbreviated_TLS_1.3_Handshake.svg', alt:'Timeline diagram of an abbreviated TLS 1.3 handshake between client and server.', caption:'Abbreviated TLS 1.3 handshake diagram, Fleshgrinder and The People from The Tango! Desktop Project, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A full TLS 1.3 handshake is secure, but repeat connections should not always pay the full cost. Phones roam between cell towers and Wi-Fi networks, browsers open many short-lived connections, edge services reconnect frequently after load-balancer resets. Each full handshake costs a round trip, elliptic-curve math, certificate-chain validation, and transcript verification. For a mobile user on a 150ms cellular link, that round trip is felt directly as page-load delay.',
        'Resumption lets a later connection reuse authenticated state from a recent full handshake, skipping certificate work and reducing CPU on both sides. 0-RTT goes further: selected application data rides on the very first flight, eliminating even the resumed round trip. That trades latency for replay risk, which is why 0-RTT is an application-design question, not just a TLS configuration toggle.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple answer is to run a full handshake every time. Fresh negotiation, fresh ECDHE, fresh certificate verification, fresh Finished checks. It is easy to reason about because nothing carries over from a previous connection. Every session starts from zero trust.',
        'For many clients, that is wasteful. A browser that just authenticated api.example.com three seconds ago should not repeat all of that work for the next request. A phone that reconnects after a network switch already proved its server\'s identity on the previous connection. Repeating the full ceremony every time burns latency and CPU proportional to the number of short connections, which in mobile and edge-heavy architectures is most connections.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Naive session reuse is unsafe. Carrying forward an old secret without binding it to the new connection lets an attacker replay old ClientHello messages or offer stolen ticket identities. If the ticket has no scope, it could be offered to the wrong hostname, protocol version, or cipher context. If the ticket lives forever, it becomes a long-lived credential that defeats the forward-secrecy properties of the original handshake.',
        'Early data has a sharper wall. Encryption does not prevent replay. An attacker who captures 0-RTT bytes can re-send them, and if the server has no anti-replay mechanism, or if a distributed edge fleet does not share replay state, the same request can be processed twice. A replayed GET for a static image is harmless. A replayed POST that transfers money, sends an email, or decrements inventory is a bug with real consequences.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A session ticket is scoped, time-limited resumable state anchored in a previous authenticated handshake. The PSK binder proves the client still knows the resumption secret and binds that proof to the new ClientHello. The binder is a MAC computed over part of the ClientHello using a key derived from the resumption secret, so an attacker who does not know the secret cannot forge a valid binder.',
        '0-RTT must be treated as replayable input by design. TLS provides anti-replay hooks (the server can track a window of seen tickets or use single-use tickets), but TLS alone cannot decide which application operations are safe to repeat. The insight is that replay safety is an application-layer property, not a transport-layer property. TLS can offer the mechanism and let servers reject early data. The application must classify which endpoints tolerate replay and which must wait for the full handshake to complete.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'After a full TLS 1.3 handshake completes, the server sends one or more NewSessionTicket messages. Each ticket carries a ticket identity, a ticket age add value (an obfuscator so observers cannot correlate ticket age across connections), the cipher suite, the ALPN, and an encrypted blob of resumption state. The client stores this in a bounded cache indexed by hostname, port, ALPN, and cipher context.',
        'On the next connection to the same server, the client includes a pre_shared_key extension in ClientHello listing one or more ticket identities with obfuscated ages, plus a binder for each. The server looks up the ticket, verifies the binder, checks ticket age against its policy, and decides whether to resume with PSK alone or PSK plus a fresh ECDHE key exchange. PSK-only resumption skips the ephemeral key exchange, which is faster but loses forward secrecy for the resumed session. PSK+DHE adds a fresh key share, restoring forward secrecy while still skipping certificate verification.',
        'If early_data is enabled and the ticket supports it, the client sends application bytes immediately after ClientHello, encrypted under early traffic keys derived from the PSK. The server can accept, reject (returning a normal handshake), or silently ignore early data. A production server also maintains anti-replay state: a time window of recently seen ticket identities, or single-use ticket tracking, so replayed 0-RTT data can be detected and rejected.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Resumption is safe because the ticket is derived from an earlier authenticated connection and verified with a binder on the new ClientHello. The binder is a transcript-dependent MAC: it covers the ClientHello up to (but not including) the binder itself, keyed with a binder key derived from the resumption secret. An attacker cannot offer arbitrary ticket identities because forging the binder requires knowledge of the PSK, which was never sent over the wire.',
        'PSK+DHE restores forward secrecy for the resumed session. Even if the PSK is later compromised, an attacker still needs the ephemeral DH private key to derive the session\'s traffic keys. PSK-only mode trades that property for lower CPU: the resumed session\'s traffic keys depend entirely on the PSK, so compromising the PSK compromises the resumed session. This is why ticket lifetime and key rotation matter: shorter lifetimes bound the exposure window.',
        '0-RTT replay safety works by policy, not by cryptographic magic. Restricting early data to cacheable or idempotent operations means a replayed request cannot create a second payment, second login, or second inventory mutation. The anti-replay window on the server is a defense-in-depth layer, not the sole guarantee. Systems that rely only on the server-side window without classifying endpoint replay safety are fragile against edge-coordination failures.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Resumption reduces handshake latency and CPU by skipping certificate-chain validation and (in PSK-only mode) elliptic-curve operations. The cost is ticket management: ticket-key rotation, cache eviction, scope enforcement, age validation, and privacy controls. Long-lived tickets can become tracking handles that link a user\'s connections across time, so browsers limit ticket reuse and lifetime.',
        '0-RTT saves one full round trip on repeat connections. On a 100ms link, that is 100ms of user-visible latency eliminated. The cost is application review (which endpoints are replay-safe?), anti-replay storage (ticket-seen sets or single-use tracking), edge coordination (all servers in a CDN must share enough replay state to avoid accepting the same early data twice), and idempotency design for any mutation endpoint that might receive early data.',
        'Distributed edge fleets make the tradeoff sharpest. A single server can remember which early-data tickets it has seen in a local hash table. A global CDN must coordinate that state across continents, which either adds cross-region latency to every request (defeating the purpose) or accepts a replay window proportional to synchronization delay. Many production systems resolve this by allowing 0-RTT only for low-risk operations and relying on application-level idempotency keys for mutations.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Resumption is valuable anywhere handshake latency is visible: mobile clients on high-latency cellular links, browsers opening parallel connections to CDN edges, HTTP/3 (QUIC) connections that embed TLS 1.3, microservices reconnecting after load-balancer health checks, and IoT devices with constrained CPU that benefit from skipping asymmetric cryptography on repeat connections.',
        '0-RTT fits cacheable GETs, static asset fetches, DNS-over-HTTPS queries, and carefully designed idempotent API calls. Cloudflare, Fastly, and other CDN providers support 0-RTT for static content and offer configuration to disable it for mutation endpoints. HTTP/3 inherits 0-RTT from TLS 1.3 and adds its own transport-level replay considerations on top.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not put payments, login state changes, inventory decrements, email sends, or one-time-use token redemptions in 0-RTT unless the application has its own idempotency key and replay ledger. The replayed request will arrive as a valid, authenticated, encrypted TLS record. TLS cannot tell the server it is a replay. Only the application layer knows whether processing it twice is safe.',
        'Do not treat tickets as permanent credentials. Servers should rotate ticket-encryption keys on a schedule (hours, not weeks), limit ticket lifetime, scope tickets to hostname and ALPN, and fall back to full handshakes when security policy or cipher requirements change. A ticket encrypted under a key that was rotated out cannot be decrypted, forcing a clean full handshake.',
        'Privacy is a real concern. A ticket is a correlatable handle: if the same ticket identity appears on two connections from different IP addresses, an observer learns those connections belong to the same client. Short lifetimes, single-use tickets, and careful partitioning reduce the tracking surface. Some browsers limit each ticket to one resumption attempt for this reason.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A browser connects to static.example.com, completes a full TLS 1.3 handshake (ECDHE with x25519, TLS_AES_128_GCM_SHA256), and receives two NewSessionTicket messages with 3600-second lifetimes. The browser stores both tickets in its cache, indexed by static.example.com:443 with ALPN h2 and the selected cipher suite.',
        'Three minutes later, the browser reconnects. Its ClientHello includes a pre_shared_key extension offering one ticket identity with an obfuscated age (real age 180 seconds plus the ticket_age_add value from the server). The binder MAC covers the entire ClientHello except the binder field itself. The server decrypts the ticket, verifies the binder, checks that the age is within policy, and resumes with PSK+DHE to preserve forward secrecy. No certificate is sent or verified.',
        'The browser also sends a cacheable GET /logo.png as 0-RTT early data. The server checks its anti-replay window, finds no previous use of this ticket for 0-RTT, accepts the early data, and serves the image. If an attacker had captured and replayed that 0-RTT flight to a different edge server that also had the ticket key, the second server would serve the same image again. Since the response is a static asset, the replay is harmless. If the request had been POST /transfer, the application would need its own idempotency key to prevent a double transfer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 8446 (TLS 1.3), Sections 2.2 (resumption and PSK), 4.2.11 (pre_shared_key extension), 4.6.1 (NewSessionTicket), and 8 (0-RTT and anti-replay) at https://www.rfc-editor.org/rfc/rfc8446.',
        'Prerequisite: TLS 1.3 Handshake for the full handshake that creates resumable state. Extensions: QUIC Transport Streams & Loss Recovery and HTTP/3 over QUIC for transport-level 0-RTT interactions, CDN Request Flow for multi-edge replay coordination, ACME Order Challenge Certificate Issuance for automating the certificates that full handshakes rely on. Contrasting alternative: mutual TLS (mTLS), where the client also presents a certificate, which changes resumption semantics because the server must decide whether a resumed PSK still represents the same client identity.',
      ],
    },
  ],
};
