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
    { heading: 'How to read the animation', paragraphs: [
        'Read the handshake as a sequence of transcript-bound secrets. Active nodes are the messages currently being sent or the key derivation step currently producing a new traffic secret.',
        'A transcript is the ordered bytes of handshake messages seen so far, and HKDF is the hash-based key derivation function TLS 1.3 uses to turn shared secrets into separate keys. The safe inference rule is that each later key is bound to both fresh key exchange material and the exact transcript that negotiated it.',
        {type:'callout', text:'TLS 1.3 builds trust by deriving keys from fresh secrets and then authenticating the exact transcript that selected them.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/73/Full_TLS_1.3_Handshake.svg', alt:'Timeline diagram of a full TLS 1.3 handshake between client and server.', caption:'Full TLS 1.3 handshake diagram, Fleshgrinder and The People from The Tango! Desktop Project, public domain, via Wikimedia Commons.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'TLS 1.3 exists to let a client and server create encrypted, authenticated traffic keys over an untrusted network. The network can read, delay, replay, and modify packets, so the protocol must turn unauthenticated bytes into shared keys only when the parties agree on what happened.',
        'The handshake key schedule is the part that separates secrets by purpose. Handshake traffic, application traffic, exporter keys, and resumption secrets must not collapse into one reusable key, because one leak or misuse would then endanger every phase.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to run Diffie-Hellman once, get a shared secret, and use it directly as the encryption key. Diffie-Hellman is a method where two parties create a shared secret over a public channel without sending the secret itself.',
        'A second obvious approach is to authenticate only the server certificate and then trust the rest of the negotiation. That misses downgrade and transcript-substitution attacks, where an attacker tries to make the parties believe they agreed to different parameters.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is key separation and agreement. One raw shared secret does not say which cipher suite, protocol version, server identity, extensions, or handshake messages created it.',
        'If the transcript is not authenticated, an attacker can tamper with negotiation even if it cannot compute the final secret. If secrets are not separated by phase, a key used for one purpose can become dangerous when reused for another purpose.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is to derive a tree of secrets from inputs that include the Diffie-Hellman shared secret and hashes of the transcript. HKDF extracts entropy and expands it with labels, so each key is tied to a purpose and phase.',
        'The Finished message authenticates the transcript using a key derived from the handshake secret. If either side saw different handshake bytes, its Finished verification fails, so the protocol catches tampering before application data is trusted.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'The client sends ClientHello with supported versions, cipher suites, extensions, and key shares. The server replies with ServerHello choosing parameters and providing its key share, which lets both sides compute the same Diffie-Hellman shared secret.',
        'TLS 1.3 then uses HKDF-Extract and HKDF-Expand-Label to derive handshake traffic secrets, handshake encryption keys, application traffic secrets, and later exporter or resumption secrets. Certificate and CertificateVerify authenticate the server identity, while Finished authenticates the transcript.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is that both honest parties derive the same secrets only if they used the same cryptographic inputs. The Diffie-Hellman exchange gives a shared secret, and transcript hashes bind the derived keys to the messages that selected protocol parameters.',
        'Authentication closes the loop. The certificate chain tells the client which public key belongs to the server name, CertificateVerify proves the server controls the private key, and Finished proves the transcript was not silently changed.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'A full TLS 1.3 handshake costs one round trip before application data under ordinary 1-RTT mode. On a 100 ms network path, that round trip adds about 100 ms before the first protected request can complete, before counting certificate validation and server processing.',
        'CPU cost comes from key exchange, certificate signature verification, HKDF operations, and AEAD setup, where AEAD means authenticated encryption with associated data. HKDF hashes are cheap compared with public-key operations, but every connection still pays parsing, validation, and state-machine complexity.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'TLS 1.3 protects HTTPS, HTTP/2, HTTP/3 through QUIC, database connections, service mesh traffic, APIs, package registries, and many mobile app backends. The access pattern is repeated client-server connections where confidentiality and server authentication are required.',
        'The key schedule also supports exporters and resumption. Exporters let protocols derive extra keys from the TLS connection, while resumption lets later connections use a pre-shared key created by a previous handshake.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'TLS does not prove the application is safe. It can encrypt a request to the right server while the application still accepts replayed actions, broken authorization, bad certificate deployment, or secrets leaked above the TLS layer.',
        'It also depends on correct implementation and policy. Weak random number generation, bad certificate validation, unsupported legacy fallback, side-channel bugs, or mishandled session tickets can break the security story even when the RFC design is sound.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Suppose a browser connects to example.com with TLS_AES_128_GCM_SHA256 and x25519. The network round trip is 80 ms, certificate verification takes 4 ms, and HKDF plus symmetric setup takes 1 ms, so the visible full-handshake setup cost is about 85 ms before server application processing.',
        'Both sides compute the same x25519 shared secret and derive handshake traffic keys. The server sends Certificate, CertificateVerify, and Finished under handshake encryption, and the client checks that Finished matches the transcript hash it computed locally.',
        'If an attacker changed the cipher suite in ClientHello, the client and server transcript hashes differ. Finished verification fails, so application traffic keys are not accepted even though packets still arrived over the network.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary source: RFC 8446 at https://www.rfc-editor.org/rfc/rfc8446, especially sections 2, 4, 7, 8, and Appendix E. The RFC defines the TLS 1.3 handshake, transcript hashes, key schedule, resumption, and 0-RTT limits.',
        'Study Diffie-Hellman key exchange, HKDF, AEAD ciphers, certificate chains, Certificate Transparency, TLS resumption, QUIC, and 0-RTT replay next. The useful next question is which secret protects which bytes and which transcript each secret commits to.',
      ],
    },
  ],
};
