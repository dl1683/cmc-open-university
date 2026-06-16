// TLS 1.3 handshake and key schedule: ClientHello/ServerHello negotiation,
// ECDHE shared secret, certificate authentication, transcript hashes, HKDF keys,
// Finished messages, and encrypted application data.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tls-13-handshake-key-schedule-case-study',
  title: 'TLS 1.3 Handshake',
  category: 'Security',
  summary: 'A transport-security case study: negotiate parameters, derive ECDHE secrets, authenticate the transcript with certificates and Finished messages, then protect records with traffic keys.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['handshake', 'key schedule'], defaultValue: 'handshake' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function handshakeGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'browser/app' },
      { id: 'ch', label: 'CH', x: 2.2, y: 2.2, note: 'offers' },
      { id: 'sh', label: 'SH', x: 3.8, y: 2.2, note: 'selects' },
      { id: 'dhe', label: 'DHE', x: 3.8, y: 5.7, note: 'shared' },
      { id: 'cert', label: 'cert', x: 5.5, y: 2.2, note: 'identity' },
      { id: 'cv', label: 'certVfy', x: 5.5, y: 5.7, note: 'sign hash' },
      { id: 'fin', label: 'finish', x: 7.0, y: 4.0, note: 'MAC' },
      { id: 'app', label: 'app', x: 8.9, y: 4.0, note: 'AEAD' },
    ],
    edges: [
      { id: 'e-client-ch', from: 'client', to: 'ch' },
      { id: 'e-ch-sh', from: 'ch', to: 'sh' },
      { id: 'e-ch-dhe', from: 'ch', to: 'dhe' },
      { id: 'e-sh-dhe', from: 'sh', to: 'dhe' },
      { id: 'e-sh-cert', from: 'sh', to: 'cert' },
      { id: 'e-cert-cv', from: 'cert', to: 'cv' },
      { id: 'e-dhe-fin', from: 'dhe', to: 'fin' },
      { id: 'e-cv-fin', from: 'cv', to: 'fin' },
      { id: 'e-fin-app', from: 'fin', to: 'app' },
    ],
  }, { title });
}

function scheduleGraph(title) {
  return graphState({
    nodes: [
      { id: 'psk', label: 'PSK', x: 0.7, y: 2.3, note: 'optional' },
      { id: 'early', label: 'early', x: 2.3, y: 2.3, note: '0-RTT' },
      { id: 'ecdhe', label: 'ECDHE', x: 0.7, y: 5.5, note: 'fresh' },
      { id: 'hand', label: 'handshake', x: 2.3, y: 5.5, note: 'secret' },
      { id: 'hash', label: 'transcript', x: 4.2, y: 4.0, note: 'hash' },
      { id: 'client', label: 'c keys', x: 6.1, y: 2.5, note: 'traffic' },
      { id: 'server', label: 's keys', x: 6.1, y: 5.5, note: 'traffic' },
      { id: 'master', label: 'master', x: 7.8, y: 4.0, note: 'export' },
      { id: 'record', label: 'records', x: 9.1, y: 4.0, note: 'AEAD' },
    ],
    edges: [
      { id: 'e-psk-early', from: 'psk', to: 'early' },
      { id: 'e-ecdhe-hand', from: 'ecdhe', to: 'hand' },
      { id: 'e-early-hash', from: 'early', to: 'hash' },
      { id: 'e-hand-hash', from: 'hand', to: 'hash' },
      { id: 'e-hash-client', from: 'hash', to: 'client' },
      { id: 'e-hash-server', from: 'hash', to: 'server' },
      { id: 'e-client-master', from: 'client', to: 'master' },
      { id: 'e-server-master', from: 'server', to: 'master' },
      { id: 'e-master-record', from: 'master', to: 'record' },
    ],
  }, { title });
}

function* handshake() {
  yield {
    state: handshakeGraph('ClientHello offers versions, ciphers, and key share'),
    highlight: { active: ['client', 'ch', 'dhe', 'e-client-ch', 'e-ch-dhe'], compare: ['sh'] },
    explanation: 'A TLS 1.3 client begins with a ClientHello carrying supported versions, cipher suites, extensions such as SNI and ALPN, and usually an ECDHE key share. This is the negotiation record the rest of the transcript will authenticate.',
    invariant: 'Negotiation only becomes trustworthy after the transcript is authenticated.',
  };

  yield {
    state: handshakeGraph('ServerHello selects parameters and completes ECDHE'),
    highlight: { active: ['ch', 'sh', 'dhe', 'e-ch-sh', 'e-sh-dhe'], found: ['client'] },
    explanation: 'The server selects compatible parameters and sends its own key share. Client and server now compute the same ECDHE shared secret, which feeds the handshake key schedule.',
  };

  yield {
    state: handshakeGraph('Certificate and CertificateVerify bind identity to the transcript'),
    highlight: { active: ['cert', 'cv', 'e-sh-cert', 'e-cert-cv'], compare: ['dhe'], found: ['sh'] },
    explanation: 'Certificate validation checks the server identity and trust path. CertificateVerify signs the transcript hash, proving the server controls the certificate private key for this exact handshake.',
  };

  yield {
    state: handshakeGraph('Finished authenticates the negotiated transcript'),
    highlight: { active: ['dhe', 'cv', 'fin', 'e-dhe-fin', 'e-cv-fin'], found: ['cert'], compare: ['app'] },
    explanation: 'Finished messages are MACs over the transcript using derived handshake secrets. If an attacker changed earlier negotiation bytes, the transcript hash changes and Finished verification fails.',
  };

  yield {
    state: handshakeGraph('Application data moves under traffic keys'),
    highlight: { active: ['fin', 'app', 'e-fin-app'], found: ['dhe', 'cert'], compare: ['ch'] },
    explanation: 'After the handshake completes, both sides use derived traffic keys to protect records with authenticated encryption. The connection is now a stream of encrypted, integrity-checked records.',
  };
}

function* keySchedule() {
  yield {
    state: scheduleGraph('TLS 1.3 derives secrets through HKDF stages'),
    highlight: { active: ['psk', 'ecdhe', 'early', 'hand', 'e-psk-early', 'e-ecdhe-hand'], compare: ['hash'] },
    explanation: 'The key schedule mixes optional pre-shared key material and fresh ECDHE output into staged secrets. Each stage derives only the keys needed for that phase of the connection.',
    invariant: 'Keys are derived from secrets plus transcript context, not reused raw.',
  };

  yield {
    state: scheduleGraph('The transcript hash contextualizes every derived key'),
    highlight: { active: ['hand', 'hash', 'client', 'server', 'e-hand-hash', 'e-hash-client', 'e-hash-server'], found: ['ecdhe'] },
    explanation: 'Handshake traffic secrets depend on the transcript hash. That is what ties the keys to the specific ClientHello, ServerHello, extensions, certificates, and verification messages.',
  };

  yield {
    state: labelMatrix(
      'TLS records by phase',
      [
        { id: 'hello', label: 'hello' },
        { id: 'hshake', label: 'handshake' },
        { id: 'app', label: 'app data' },
        { id: 'resume', label: 'resumption' },
      ],
      [
        { id: 'secret', label: 'secret' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['none yet', 'tamper risk'],
        ['handshake', 'bad transcript'],
        ['traffic', 'key update'],
        ['PSK', 'replay rules'],
      ],
    ),
    highlight: { active: ['hshake:secret', 'app:secret'], compare: ['hello:risk', 'resume:risk'] },
    explanation: 'TLS is easier to understand as phase-specific state. The connection moves from visible negotiation to handshake encryption to application traffic keys and optional resumption material.',
  };

  yield {
    state: scheduleGraph('Record protection uses client and server traffic keys'),
    highlight: { active: ['client', 'server', 'master', 'record', 'e-client-master', 'e-server-master', 'e-master-record'], found: ['hash'] },
    explanation: 'Client-to-server and server-to-client traffic keys are separate. AEAD record protection gives confidentiality and integrity for each record, while sequence numbers and nonces prevent simple replay inside the connection.',
  };

  yield {
    state: labelMatrix(
      'What TLS does not decide',
      [
        { id: 'authz', label: 'authz' },
        { id: 'cookies', label: 'cookies' },
        { id: 'jwt', label: 'JWT' },
        { id: 'webauthn', label: 'WebAuthn' },
      ],
      [
        { id: 'handled', label: 'handled by' },
        { id: 'tlsrole', label: 'TLS role' },
      ],
      [
        ['app policy', 'secure pipe'],
        ['browser/app', 'protect bytes'],
        ['API layer', 'carry token'],
        ['login layer', 'protect call'],
      ],
    ),
    highlight: { active: ['jwt:tlsrole', 'webauthn:tlsrole'], compare: ['authz:handled', 'cookies:handled'] },
    explanation: 'TLS authenticates the channel and protects bytes in flight. It does not decide whether a user is allowed to call an API, whether a cookie is safe, or whether a JWT claim should be accepted.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'handshake') yield* handshake();
  else if (view === 'key schedule') yield* keySchedule();
  else throw new InputError('Pick a TLS 1.3 view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'TLS 1.3 is the protocol behind HTTPS and many other secure transports. The handshake negotiates parameters, derives fresh secrets, authenticates the server, validates the transcript, and creates traffic keys for encrypted records. It is a state machine plus a key schedule.',
        'RFC 8446 defines TLS 1.3, including ClientHello, ServerHello, certificate authentication, Finished messages, HKDF-based key schedule, and record protection: https://www.rfc-editor.org/rfc/rfc8446.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The handshake state contains offered versions, cipher suites, extensions, key shares, selected parameters, transcript hash, certificate chain, verification signatures, handshake secrets, and traffic secrets. The transcript hash is the spine: later proofs and derived keys commit to the bytes that came before.',
        'The certificate side is its own graph: end-entity certificate, intermediate certificates, root trust anchors, validity times, name constraints, subject alternative names, key usage, revocation evidence when checked, and hostname policy. RFC 5280 defines the X.509 certificate and path-validation profile used by public-key infrastructure: https://www.rfc-editor.org/rfc/rfc5280.',
      ],
    },
    {
      heading: 'Complete case study: HTTPS request',
      paragraphs: [
        'A browser connects to api.example.com. It sends a ClientHello with SNI api.example.com, ALPN options such as h2 or http/1.1, supported groups, and a key share. The server replies with selected parameters, a certificate chain for api.example.com, CertificateVerify, and Finished. The browser validates the certificate path and name, verifies transcript proofs, sends its Finished message, and then sends the HTTP request under application traffic keys.',
        'Everything above the pipe still needs its own checks. Cookies, JWTs, CSRF tokens, WebAuthn assertions, OAuth scopes, and application authorization are protected in transit by TLS but not made correct by TLS.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'TLS is not just encryption. It is negotiation, authentication, key derivation, transcript binding, record protection, and alert handling. Removing any one of those pieces creates downgrade, impersonation, replay, or tampering risk.',
        'TLS also does not make application credentials harmless. A bearer token sent through TLS can still be stolen by XSS, logged by the server, replayed by a compromised client, or accepted by the wrong audience if JWT validation is weak. Study TLS and token verification as adjacent layers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 8446 TLS 1.3 at https://www.rfc-editor.org/rfc/rfc8446 and RFC 5280 X.509 path validation at https://www.rfc-editor.org/rfc/rfc5280. Study TLS 1.3 Resumption & 0-RTT Tickets for NewSessionTicket, PSK binders, early data, and replay boundaries. Then study JWT Verification, WebAuthn Passkeys, OAuth PKCE Token Lifecycle Case Study, Hash Table, Finite State Machine, Binary Exponentiation, Transparency Log Witnessing Case Study, Sigstore Keyless Signing Transparency, QUIC Transport Streams & Loss Recovery, HTTP/3 over QUIC, and Distributed Tracing next.',
      ],
    },
  ],
};
