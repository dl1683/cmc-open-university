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
      heading: 'The problem',
      paragraphs: [
        `Most application protocols begin with an unsafe assumption: two programs can exchange bytes over a network and the bytes will arrive privately and unchanged. Real networks do not give that guarantee. Attackers can read packets, replay old packets, inject new packets, tamper with negotiation, impersonate servers, and record traffic for later analysis. HTTPS exists because HTTP by itself does not defend against any of that.`,
        `TLS 1.3 turns an untrusted transport connection into an authenticated encrypted record stream. It has to answer several questions at once. Which cryptographic algorithms did the peers agree to use? How do they create a fresh shared secret without sending it over the network? How does the client know the server is really the owner of the requested name? How do both sides prove that no attacker changed the handshake transcript? How are application keys separated from handshake keys?`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The obvious idea is to encrypt with a shared password or server secret. If both sides already know a symmetric key, they can use authenticated encryption to protect messages. That is fast and useful after setup, but it pushes the hardest problem backward: how did the client and server safely get the same key? Sending the key over the connection exposes it to the attacker watching the connection.`,
        `A second idea is to use the server's long-term private key to protect the session. Older protocols sometimes leaned more heavily on RSA key transport or long-lived credentials. The danger is archival compromise. If an attacker records traffic today and obtains the server key next year, old sessions may become readable. Modern TLS avoids that shape by using ephemeral Diffie-Hellman key exchange for fresh session secrets and certificates mainly for authentication.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Encryption alone is not enough. A man-in-the-middle can try to change the ClientHello, remove stronger algorithms, substitute an unsupported extension set, present a different certificate, or make the peers disagree about what was negotiated. A protocol that encrypts later data but does not authenticate the negotiation is still vulnerable at the exact moment where the security parameters are chosen.`,
        `The wall is binding. TLS must bind the version, cipher suite, key shares, extensions, certificate identity, signature, and traffic secrets to the same transcript. If any earlier byte changes, a later verification step has to fail. The design also needs key separation: a secret used to protect handshake records should not be reused raw as an application-data key, exporter key, resumption key, or Finished MAC key.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `TLS 1.3 uses the transcript hash as the spine of the handshake. Both peers hash the handshake messages they have seen. CertificateVerify signs that context with the server's certificate key. Finished messages authenticate the transcript with keys derived from the ephemeral shared secret. If an attacker changes the negotiation, the transcript hash changes and the proofs no longer verify.`,
        `The key schedule is the second half of the insight. TLS 1.3 does not derive one giant connection key and reuse it everywhere. It uses HKDF to move through stages: optional pre-shared key material, early secrets for 0-RTT, ephemeral ECDHE contribution for handshake secrets, application traffic secrets, exporter secrets, and resumption material. Each phase and direction gets its own derived traffic key, which limits accidental cross-use and makes the protocol easier to analyze.`,
      ],
    },
    {
      heading: 'Handshake mechanics',
      paragraphs: [
        `The client starts with ClientHello. It offers protocol versions, cipher suites, supported groups, signature algorithms, extensions such as SNI and ALPN, and usually an ECDHE key share. These bytes are visible on the wire in a normal TLS 1.3 handshake, but visibility is not the same as trust. The rest of the protocol will commit to exactly these bytes through the transcript hash.`,
        `The server replies with ServerHello, choosing compatible parameters and contributing its own key share. Both sides compute the same ECDHE shared secret without sending that secret. The server then sends certificate-related messages under handshake protection: a certificate chain for the requested name, CertificateVerify to prove possession of the private key bound to the transcript, and Finished to MAC the transcript with derived handshake keys. The client validates the certificate path and hostname, verifies the transcript proofs, sends its own Finished message, and only then treats application traffic keys as ready.`,
      ],
    },
    {
      heading: 'Key schedule mechanics',
      paragraphs: [
        `The key schedule is a directed derivation tree built from HKDF Extract and HKDF Expand Label operations. Optional PSK input can produce early secrets for 0-RTT data, but early data has replay limits and weaker freshness properties. The ECDHE shared secret feeds the handshake secret. The transcript hash contextualizes derived secrets so the keys are tied to the exact messages exchanged.`,
        `TLS separates client and server traffic secrets. Client handshake traffic keys protect client-to-server handshake records, and server handshake traffic keys protect server-to-client handshake records. Later, application traffic secrets protect application records in each direction. Record protection uses AEAD, sequence numbers, and derived nonces so tampering is detected and simple replay within a connection fails. Key updates can refresh application traffic secrets during a long-lived connection.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `A browser connects to api.example.com. Its ClientHello includes SNI api.example.com, ALPN options such as h2 and http/1.1, supported cipher suites, supported groups, signature algorithms, and a key share. The server chooses TLS 1.3 parameters, returns its key share, and sends a certificate chain whose leaf certificate covers api.example.com. The browser builds and verifies the certificate path to a trusted root, checks the hostname, validity period, key usage, and relevant policy.`,
        `Now imagine an attacker changes the ALPN value, removes a strong group, or substitutes a different certificate message. The raw network may deliver those altered bytes, but the peers will not authenticate the same transcript. CertificateVerify and Finished are computed over transcript-derived context. A changed byte changes the transcript hash, which changes the expected verification result. The handshake fails before application data is trusted.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The handshake view shows the order of trust construction. ClientHello and ServerHello negotiate and create fresh shared entropy. Certificate and CertificateVerify bind server identity to the negotiation. Finished authenticates the transcript. Application data comes last because traffic protection is only meaningful after the peers agree on keys and verify that the agreement was not tampered with.`,
        `The key-schedule view shows why TLS is better understood as phase-specific state. PSK material, ECDHE output, transcript hashes, traffic secrets, client keys, server keys, master secrets, and record protection have different roles. Keeping those roles separate prevents a common misconception: TLS is not simply "use the certificate to encrypt the session." The certificate authenticates identity; ephemeral key exchange and HKDF produce the record-protection keys.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `A full handshake costs at least a network round trip, asymmetric cryptography, certificate-path validation, transcript hashing, and key derivation. In many deployments the latency dominates the CPU cost. Session resumption and 0-RTT reduce latency, but they introduce replay considerations and depend on correct ticket handling. TLS 1.3 simplified and shortened the handshake compared with older versions, yet the operational complexity did not vanish.`,
        `Certificate operations are part of the cost. Services need issuance, renewal, private-key custody, hostname coverage, revocation strategy, clock correctness, and observability for handshake failures. Choosing cipher suites and groups is usually less flexible in TLS 1.3 than in older versions, which is good for safety, but systems still need to manage client compatibility, ALPN, middlebox behavior, and policy decisions such as mutual TLS.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `TLS is the right default for web traffic, APIs, service-to-service calls, database connections, message brokers, package registries, remote administration, and any protocol that needs confidentiality and integrity over an untrusted network. It is strongest when the endpoint identity is clear, certificates are managed well, clients validate names, and the application protocol understands what TLS authenticated.`,
        `TLS 1.3 also wins by removing dangerous legacy options. It requires forward-secret key exchange for normal handshakes, removes many obsolete algorithms, encrypts more of the handshake after ServerHello, and has a cleaner key schedule than prior versions. The protocol is still complex, but the complexity is more disciplined: negotiation, authentication, derivation, and record protection have sharper boundaries.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `TLS protects bytes in transit. It does not decide whether a user is allowed to call an API, whether a JWT audience is correct, whether a cookie is safe from cross-site scripting, whether an OAuth scope grants access, or whether a WebAuthn assertion should be accepted. Those are application-layer checks. TLS gives them a protected channel; it does not replace them.`,
        `TLS also cannot protect plaintext before encryption or after decryption. Malware on the client, compromised server code, unsafe logging, memory disclosure, browser extension abuse, and misconfigured reverse proxies can expose data outside the transport layer. A green lock icon does not mean the endpoint is trustworthy in every sense. It means the channel to the authenticated endpoint satisfied the TLS checks.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Common failures include accepting a certificate without verifying the hostname, disabling validation in development and accidentally shipping it, trusting a private certificate authority too broadly, letting certificates expire, losing private keys, or terminating TLS at a proxy and forwarding plaintext across a network that was assumed to be safe. Protocol security depends on deployment discipline.`,
        `0-RTT early data deserves special care because it can be replayed under some conditions. It is suitable only for operations that tolerate replay, such as idempotent requests designed for that risk. Another failure is ignoring the transcript boundary in custom protocol designs. TLS already solves channel authentication; bolting extra unauthenticated negotiation above it can reintroduce downgrade or confusion bugs at the application layer.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: RFC 8446 TLS 1.3 at https://www.rfc-editor.org/rfc/rfc8446 and RFC 5280 X.509 path validation at https://www.rfc-editor.org/rfc/rfc5280. The RFC key schedule diagrams are worth studying slowly because they explain why secrets are staged instead of reused.`,
        `Good next topics are TLS 1.3 Resumption & 0-RTT Ticket Cache for PSK binders and replay boundaries, ACME Order Challenge Certificate Issuance for certificate automation, OCSP Stapling Revocation Cache for revocation delivery, WebAuthn Passkey Credential Flow for application authentication, OAuth PKCE Token Lifecycle for delegated authorization, QUIC Transport Streams & Loss Recovery for TLS 1.3 inside QUIC, and Finite State Machine for the handshake as ordered protocol state.`,
      ],
    },
  ],
};
