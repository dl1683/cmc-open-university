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
    explanation: 'ClientHello is visible negotiation state: versions, cipher suites, SNI, ALPN, extensions, and usually an ECDHE key share. These bytes are not trusted yet, but the rest of the handshake will commit to them through the transcript hash.',
    invariant: 'Negotiation only becomes trustworthy after the transcript is authenticated.',
  };

  yield {
    state: handshakeGraph('ServerHello selects parameters and completes ECDHE'),
    highlight: { active: ['ch', 'sh', 'dhe', 'e-ch-sh', 'e-sh-dhe'], found: ['client'] },
    explanation: 'ServerHello selects one compatible path and contributes the server key share. Both sides now compute the same ECDHE secret, so later keys can be derived without sending the secret itself.',
  };

  yield {
    state: handshakeGraph('Certificate and CertificateVerify bind identity to the transcript'),
    highlight: { active: ['cert', 'cv', 'e-sh-cert', 'e-cert-cv'], compare: ['dhe'], found: ['sh'] },
    explanation: 'Certificate validation checks whether this name chains to a trusted certificate. CertificateVerify then signs the transcript hash, binding that certificate key to this exact negotiation instead of to a generic connection.',
  };

  yield {
    state: handshakeGraph('Finished authenticates the negotiated transcript'),
    highlight: { active: ['dhe', 'cv', 'fin', 'e-dhe-fin', 'e-cv-fin'], found: ['cert'], compare: ['app'] },
    explanation: 'Finished messages are MACs over the transcript using derived handshake secrets. If an attacker changed earlier negotiation bytes, the transcript hash changes and Finished verification fails.',
  };

  yield {
    state: handshakeGraph('Application data moves under traffic keys'),
    highlight: { active: ['fin', 'app', 'e-fin-app'], found: ['dhe', 'cert'], compare: ['ch'] },
    explanation: 'After Finished succeeds on both sides, application bytes move under traffic keys. Each record is encrypted and integrity-checked, but higher layers still decide cookies, tokens, and authorization.',
  };
}

function* keySchedule() {
  yield {
    state: scheduleGraph('TLS 1.3 derives secrets through HKDF stages'),
    highlight: { active: ['psk', 'ecdhe', 'early', 'hand', 'e-psk-early', 'e-ecdhe-hand'], compare: ['hash'] },
    explanation: 'The key schedule mixes optional pre-shared key material and fresh ECDHE output through HKDF stages. Each stage derives only the traffic secrets needed for that phase, so one key is not reused for every job.',
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
    explanation: 'TLS is easier to reason about as phase-specific state. The connection moves from visible negotiation, to handshake encryption, to application traffic keys, and finally to optional resumption material.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The handshake view traces trust construction left to right: ClientHello negotiates, ServerHello selects, Certificate and CertificateVerify bind identity, Finished authenticates the transcript, and application data flows only after all checks pass. Active nodes are the current trust-building step. Found nodes are commitments already locked in.',
        'The key-schedule view shows derivation flow. Secrets enter on the left (optional PSK, fresh ECDHE), pass through HKDF stages, get contextualized by the transcript hash, and split into per-direction traffic keys on the right. Each edge is a derivation dependency, not a message on the wire.',
        'Watch for the separation between authentication (certificate, signature, MAC) and key derivation (HKDF, transcript hash). TLS 1.3 keeps these roles distinct so that compromising one mechanism does not automatically break the other.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Application protocols begin with an unsafe assumption: bytes sent over a network arrive privately and unchanged. Real networks give no such guarantee. Attackers can read packets, replay them, inject new ones, tamper with negotiation, impersonate servers, and record traffic for later decryption. HTTP by itself defends against none of that.',
        'TLS 1.3 (RFC 8446) turns an untrusted transport into an authenticated, encrypted record stream. It answers several questions simultaneously: which cryptographic algorithms do the peers agree on? How do they create a fresh shared secret without transmitting it? How does the client know the server owns the requested hostname? How do both sides prove that no attacker altered the handshake? How are application keys separated from handshake keys?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious idea is to encrypt with a pre-shared password or server secret. If both sides already hold a symmetric key, they can protect messages with authenticated encryption. That works after setup, but pushes the hardest problem backward: how did the client and server safely get the same key? Sending the key over the connection exposes it to anyone watching.',
        'A second idea is to use the server\'s long-term RSA private key to encrypt a session secret chosen by the client. TLS 1.2 in RSA key-transport mode worked this way: the client generated a random pre-master secret, encrypted it under the server\'s RSA public key, and sent the ciphertext. Both sides derived session keys from that shared value. This is simple and requires only one key-exchange message.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'RSA key transport has a fatal long-term weakness: forward secrecy is absent. If an attacker records every ciphertext today and steals the server\'s RSA private key next year, every recorded session becomes readable. The session secret was encrypted directly under that key, so a single key compromise unlocks the entire archive. TLS 1.2 allowed this mode, and many deployments used it.',
        'Encryption alone is also not enough. A man-in-the-middle can alter the ClientHello, strip stronger cipher suites, substitute a different certificate, or make the peers disagree about negotiated parameters. A protocol that encrypts data but does not authenticate the negotiation is vulnerable at the exact moment security parameters are chosen. TLS must bind version, cipher suite, key shares, extensions, certificate identity, signature, and traffic secrets to one transcript. If any earlier byte changes, a later verification step must fail.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'TLS 1.3 solves both problems with two interlocking mechanisms: mandatory ephemeral Diffie-Hellman for forward secrecy, and the transcript hash as the binding spine of the handshake.',
        'Forward secrecy comes from ECDHE (Elliptic Curve Diffie-Hellman Ephemeral). Each side generates a throwaway key pair for every connection. They exchange public shares in ClientHello and ServerHello, then independently compute the same shared secret using elliptic-curve scalar multiplication. The ephemeral private keys are discarded after derivation. Even if the server\'s long-term certificate key is later compromised, past session secrets remain safe because they depended on ephemeral keys that no longer exist.',
        'Transcript binding comes from hashing every handshake message into a running digest. CertificateVerify signs that digest with the server\'s certificate key, proving the certificate owner participated in this exact negotiation. Finished messages MAC the transcript with keys derived from the ephemeral secret. If an attacker changed any negotiation byte, the hash changes, and verification fails. The certificate now authenticates identity rather than transporting secrets, which is why TLS 1.3 removed RSA key exchange entirely.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The TLS 1.3 full handshake completes in one round trip (1-RTT), down from two in TLS 1.2. The client sends ClientHello containing supported versions, cipher suites, signature algorithms, named groups, SNI, ALPN, and one or more ECDHE key shares. Sending the key share speculatively in the first message is what eliminates the extra round trip: the client guesses which curve the server will pick.',
        'The server replies with ServerHello, selecting compatible parameters and contributing its own key share. Both sides now independently compute the same ECDHE shared secret. From this point, everything after ServerHello is encrypted under handshake traffic keys derived from the shared secret plus the transcript hash so far. The server sends its certificate chain, a CertificateVerify signature over the transcript hash, and a Finished MAC. These three messages travel in one flight, all encrypted.',
        'The client validates the certificate chain to a trusted root, checks hostname coverage, verifies the CertificateVerify signature against the transcript, and checks the server\'s Finished MAC. If everything passes, the client sends its own Finished and both sides derive application traffic keys. Application data can flow immediately after the client\'s Finished.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The handshake\'s security rests on three invariants maintained across every step. First, the ECDHE shared secret is fresh per connection because both key pairs are ephemeral. An attacker who does not know either private key cannot compute the shared secret, even with full network visibility. This is the discrete-logarithm hardness assumption on the chosen elliptic curve (typically x25519 or P-256).',
        'Second, the transcript hash accumulates every handshake byte into a single digest. CertificateVerify signs this digest, so the signature is valid only if the signer saw the same ClientHello, ServerHello, and extensions the client saw. If an attacker altered any field, the client\'s local transcript hash diverges from what was signed, and verification fails. This prevents downgrade attacks: stripping a strong cipher from the offer changes the hash.',
        'Third, Finished messages MAC the full transcript with keys derived from the ECDHE secret. Both sides must produce the correct MAC, which proves they computed the same shared secret and saw the same transcript. A man-in-the-middle running two separate handshakes (one with each peer) would need to produce Finished MACs consistent with both transcripts, which requires knowing the ephemeral secrets of both sessions.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A full TLS 1.3 handshake costs one network round trip, two elliptic-curve scalar multiplications (one per side for ECDHE), one signature verification (CertificateVerify), certificate-chain validation, transcript hashing, and HKDF key derivation. In most deployments, network latency dominates CPU cost. The 1-RTT design saves 50-100ms compared to TLS 1.2\'s 2-RTT handshake on typical internet links.',
        'Certificate operations add operational cost beyond the handshake itself: issuance, renewal, private-key custody, hostname coverage, revocation strategy (OCSP stapling or CRL), and clock correctness across the fleet. TLS 1.3 simplified cipher-suite negotiation by removing insecure options (RC4, CBC-mode, RSA key exchange, static DH), which reduces the configuration surface but means older clients that only support removed modes cannot connect.',
        'Session resumption with PSK (pre-shared key from a previous handshake) can skip certificate verification and reduce the handshake to a single round trip with lower CPU. 0-RTT resumption eliminates even that round trip for the first application data, but introduces replay risk: captured 0-RTT bytes can be resent by an attacker, so only idempotent, replay-safe operations belong in early data. The key schedule section of the animation shows how PSK and ECDHE secrets feed separate derivation paths.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TLS 1.3 is the correct default for HTTPS, APIs, service-to-service calls, database connections, message brokers, package registries, and any protocol needing confidentiality and integrity over an untrusted network. Every major browser, web server, and cloud load balancer supports it. HTTP/2 requires TLS in practice, and HTTP/3 (QUIC) embeds TLS 1.3 directly into the transport.',
        'The mandatory forward secrecy and simplified negotiation also matter for compliance and auditing. TLS 1.3 removed the ability to passively decrypt traffic with the server\'s RSA key, which broke some enterprise middlebox inspection setups but closed the archival-compromise vulnerability for everyone else. Organizations that need traffic inspection must now use explicit proxies with their own certificate authority, making the interception visible rather than silent.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'TLS protects bytes in transit. It does not decide whether a user may call an API, whether a JWT audience is correct, whether a cookie resists cross-site scripting, whether an OAuth scope grants access, or whether a WebAuthn assertion should be accepted. Those are application-layer checks. TLS gives them a protected channel; it does not replace them.',
        'TLS also cannot protect data before encryption or after decryption. Malware on the client, compromised server code, unsafe logging, memory disclosure, and misconfigured reverse proxies that forward plaintext across networks assumed to be safe all expose data outside the transport layer. A padlock icon means the channel to the authenticated endpoint passed TLS checks, not that the endpoint itself is trustworthy in every sense.',
        'Common deployment failures include disabling certificate validation in development and shipping that code, trusting a private CA too broadly, letting certificates expire, losing private keys, and terminating TLS at a proxy then forwarding plaintext internally. 0-RTT early data deserves special care: it can be replayed, so payments, login mutations, and inventory changes must not ride in 0-RTT unless the application layer has its own idempotency and replay handling.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A browser connects to api.example.com. Its ClientHello includes SNI api.example.com, ALPN h2, cipher suites (TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256), supported groups (x25519, P-256), signature algorithms (ECDSA-SHA256, RSA-PSS-SHA256), and an x25519 key share. This single message is 200-300 bytes.',
        'The server picks TLS 1.3, selects TLS_AES_256_GCM_SHA384 with x25519, and returns its own x25519 public key share in ServerHello. Both sides compute the 32-byte ECDHE shared secret by multiplying their private scalar against the other\'s public point. From here, every subsequent message is encrypted under handshake traffic keys derived via HKDF from the shared secret and transcript hash.',
        'The server sends its certificate chain (leaf covering *.example.com, intermediate, root omitted because the client already trusts it), then CertificateVerify: a signature over the transcript hash using the leaf certificate\'s private key. Then Finished: a MAC over the full transcript. The client verifies the chain, hostname, signature, and MAC. If any check fails, the connection aborts before any application data is sent. On success, both sides derive application traffic keys and begin exchanging HTTP/2 frames under AEAD encryption.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 8446 (TLS 1.3) at https://www.rfc-editor.org/rfc/rfc8446. The key-schedule diagrams in Section 7.1 repay slow reading. RFC 5280 defines X.509 certificate path validation. RFC 7748 specifies x25519 and x448 key exchange.',
        'Prerequisite: Diffie-Hellman key exchange and elliptic-curve basics. If the phrase "both sides compute the same shared secret without sending it" feels like magic, study DH first. Extension: TLS 1.3 Resumption & 0-RTT Ticket Cache for PSK binders, ticket lifecycle, and replay boundaries. Related: ACME Order Challenge Certificate Issuance for automated certificate management, QUIC Transport for TLS 1.3 embedded in a UDP transport, and Finite State Machine for modeling the handshake as ordered protocol state.',
      ],
    },
  ],
};
