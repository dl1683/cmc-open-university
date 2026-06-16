// WebAuthn/passkey credential flow: relying-party challenge, origin and RP ID
// binding, authenticator data, public-key credential storage, assertions, and counters.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webauthn-passkey-credential-flow-case-study',
  title: 'WebAuthn Passkeys',
  category: 'Security',
  summary: 'A public-key login case study: challenge records, RP ID scoping, credential IDs, public keys, authenticator data, signatures, and counters.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['registration', 'assertion'], defaultValue: 'registration' },
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

function passkeyGraph(title) {
  return graphState({
    nodes: [
      { id: 'rp', label: 'RP', x: 0.7, y: 3.8, note: 'server' },
      { id: 'challenge', label: 'challenge', x: 2.3, y: 2.2, note: 'nonce' },
      { id: 'browser', label: 'browser', x: 2.3, y: 5.3, note: 'origin' },
      { id: 'authn', label: 'authn', x: 4.3, y: 5.3, note: 'device' },
      { id: 'cred', label: 'cred id', x: 4.3, y: 2.2, note: 'lookup' },
      { id: 'pubkey', label: 'pubkey', x: 6.2, y: 2.2, note: 'stored' },
      { id: 'counter', label: 'counter', x: 6.2, y: 5.3, note: 'clone hint' },
      { id: 'session', label: 'session', x: 8.2, y: 3.8, note: 'login' },
    ],
    edges: [
      { id: 'e-rp-challenge', from: 'rp', to: 'challenge' },
      { id: 'e-rp-browser', from: 'rp', to: 'browser' },
      { id: 'e-browser-authn', from: 'browser', to: 'authn' },
      { id: 'e-authn-cred', from: 'authn', to: 'cred' },
      { id: 'e-cred-pubkey', from: 'cred', to: 'pubkey' },
      { id: 'e-authn-counter', from: 'authn', to: 'counter' },
      { id: 'e-pubkey-session', from: 'pubkey', to: 'session' },
      { id: 'e-counter-session', from: 'counter', to: 'session' },
    ],
  }, { title });
}

function assertionGraph(title) {
  return graphState({
    nodes: [
      { id: 'rp', label: 'RP', x: 0.7, y: 3.8, note: 'challenge' },
      { id: 'client', label: 'client', x: 2.4, y: 3.8, note: 'JSON' },
      { id: 'authdata', label: 'authData', x: 4.1, y: 2.2, note: 'rp hash' },
      { id: 'sig', label: 'sig', x: 4.1, y: 5.3, note: 'private key' },
      { id: 'store', label: 'store', x: 5.9, y: 3.8, note: 'cred map' },
      { id: 'origin', label: 'origin', x: 7.4, y: 2.2, note: 'same site' },
      { id: 'counter', label: 'counter', x: 7.4, y: 5.3, note: 'increase?' },
      { id: 'allow', label: 'allow', x: 9.0, y: 3.8, note: 'session' },
    ],
    edges: [
      { id: 'e-rp-client', from: 'rp', to: 'client' },
      { id: 'e-client-authdata', from: 'client', to: 'authdata' },
      { id: 'e-authdata-sig', from: 'authdata', to: 'sig' },
      { id: 'e-sig-store', from: 'sig', to: 'store' },
      { id: 'e-store-origin', from: 'store', to: 'origin' },
      { id: 'e-store-counter', from: 'store', to: 'counter' },
      { id: 'e-origin-allow', from: 'origin', to: 'allow' },
      { id: 'e-counter-allow', from: 'counter', to: 'allow' },
    ],
  }, { title });
}

function* registration() {
  yield {
    state: passkeyGraph('Registration starts with a fresh server challenge'),
    highlight: { active: ['rp', 'challenge', 'browser', 'e-rp-challenge', 'e-rp-browser'], compare: ['authn'] },
    explanation: 'The relying party creates public-key credential options: challenge, RP ID, user handle, allowed algorithms, authenticator preferences, and timeout. The browser delivers those options to an authenticator after user consent.',
    invariant: 'The challenge turns enrollment into a fresh, replay-resistant ceremony.',
  };

  yield {
    state: passkeyGraph('The authenticator creates a credential scoped to the RP'),
    highlight: { active: ['browser', 'authn', 'cred', 'pubkey', 'e-browser-authn', 'e-authn-cred', 'e-cred-pubkey'], found: ['challenge'] },
    explanation: 'The authenticator creates a key pair and credential ID. The private key stays with the authenticator or synced passkey provider. The server stores the public key, credential ID, user handle, RP ID, and initial counter.',
  };

  yield {
    state: labelMatrix(
      'Registration records',
      [
        { id: 'challenge', label: 'challenge' },
        { id: 'rp', label: 'RP ID' },
        { id: 'cred', label: 'cred id' },
        { id: 'pub', label: 'pubkey' },
        { id: 'count', label: 'counter' },
      ],
      [
        { id: 'stored', label: 'stored by' },
        { id: 'guards', label: 'guards' },
      ],
      [
        ['server', 'replay'],
        ['browser/authn', 'phishing'],
        ['server', 'lookup'],
        ['server', 'password theft'],
        ['server', 'clones'],
      ],
    ),
    highlight: { active: ['rp:guards', 'pub:guards', 'count:guards'], found: ['cred:stored'] },
    explanation: 'WebAuthn is a bundle of small records. The server does not store a password verifier. It stores a public key and enough binding data to check future assertions.',
  };

  yield {
    state: passkeyGraph('The credential becomes a reusable login handle'),
    highlight: { active: ['cred', 'pubkey', 'counter', 'session', 'e-cred-pubkey', 'e-counter-session'], compare: ['challenge'] },
    explanation: 'After registration, the credential ID indexes the account credential record. Later assertions prove possession of the matching private key under a new challenge and the same relying-party scope.',
  };
}

function* assertion() {
  yield {
    state: assertionGraph('Login repeats the challenge-response ceremony'),
    highlight: { active: ['rp', 'client', 'authdata', 'sig', 'e-rp-client', 'e-client-authdata', 'e-authdata-sig'], compare: ['store'] },
    explanation: 'For authentication, the server sends a fresh challenge. The browser creates clientDataJSON with challenge and origin. The authenticator returns authenticatorData and a signature over authenticatorData plus the client-data hash.',
    invariant: 'The private key signs a challenge bound to this site and this ceremony.',
  };

  yield {
    state: assertionGraph('The credential ID selects the stored public key'),
    highlight: { active: ['sig', 'store', 'origin', 'counter', 'e-sig-store', 'e-store-origin', 'e-store-counter'], found: ['rp'] },
    explanation: 'The server finds the credential record, verifies the signature using the stored public key, checks the challenge, validates the origin and RP ID hash, and evaluates user-presence or user-verification flags.',
  };

  yield {
    state: assertionGraph('The counter is a clone-detection signal, not the login proof'),
    highlight: { active: ['counter', 'allow', 'e-counter-allow'], found: ['sig', 'origin'], compare: ['store'] },
    explanation: 'If counters are present, a non-increasing counter can indicate a cloned authenticator, device fault, or race. The signature is still the proof of possession; the counter is risk evidence the service must handle deliberately.',
  };

  yield {
    state: labelMatrix(
      'Login method comparison',
      [
        { id: 'pass', label: 'password' },
        { id: 'otp', label: 'OTP' },
        { id: 'webauthn', label: 'WebAuthn' },
        { id: 'passkey', label: 'passkey' },
      ],
      [
        { id: 'secret', label: 'server risk' },
        { id: 'phish', label: 'phish risk' },
      ],
      [
        ['hash leak', 'high'],
        ['shared secret', 'medium'],
        ['public key', 'low'],
        ['public key', 'low'],
      ],
    ),
    highlight: { active: ['webauthn:secret', 'passkey:secret', 'webauthn:phish', 'passkey:phish'], compare: ['pass:secret', 'otp:phish'] },
    explanation: 'The main data-structure change is moving from server-side shared secrets to per-site public keys. That is why phishing resistance and breach resistance improve together.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'registration') yield* registration();
  else if (view === 'assertion') yield* assertion();
  else throw new InputError('Pick a WebAuthn view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'WebAuthn lets a site authenticate a user with a public-key credential scoped to that relying party. Registration creates the credential. Authentication later produces an assertion proving user presence or verification and possession of the corresponding private key. Passkeys are the user-facing deployment of this model, often with credentials synced across devices by the platform provider.',
        'The W3C WebAuthn Level 3 specification defines an API for creating and using strong, attested, scoped, public-key credentials by web applications: https://www.w3.org/TR/webauthn-3/. The FIDO Alliance passkeys page describes passkeys as a passwordless sign-in approach built on FIDO/WebAuthn technology: https://fidoalliance.org/passkeys/.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'A relying party stores a credential record: credential ID, user handle, public key, RP ID, sign counter, credential properties, transports, attestation metadata if used, and timestamps. During login, the credential ID indexes that record and the public key verifies the assertion signature.',
        'The assertion contains clientDataJSON, authenticatorData, signature, and credential metadata. The server validates the challenge, origin, RP ID hash, user-presence or user-verification flags, signature, and counter behavior before creating a session.',
      ],
    },
    {
      heading: 'Complete case study: banking login',
      paragraphs: [
        'A bank enrolls a passkey for a customer account. The server sends a registration challenge for bank.example, the authenticator creates a new credential, and the bank stores the public key and credential ID. On later login, a phishing site cannot ask that credential to sign for bank.example because browser and authenticator scoping binds the credential to the real relying party.',
        'For a high-risk transfer, the bank can require user verification and a fresh assertion rather than trusting a long-lived session alone. The assertion is not a password equivalent copied from the client. It is a new signature over a fresh challenge under the scoped credential.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'WebAuthn does not remove server-side policy. The server still owns account recovery, device management, risk scoring, session lifetime, audit logs, and step-up rules. Weak recovery can undo the strength of the primary login.',
        'A counter mismatch is not automatically a mathematical proof of compromise. The WebAuthn specification treats counters as clone-detection aids and notes that zero or non-increasing counters require relying-party risk handling. The service should log, step up, notify, or revoke according to risk, not blindly accept or panic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C WebAuthn Level 3 at https://www.w3.org/TR/webauthn-3/ and FIDO Alliance passkeys overview at https://fidoalliance.org/passkeys/. Study JWT Verification, OAuth PKCE Token Lifecycle Case Study, Capability Security & Attenuation, Hash Table, JSON Parser Stack Case Study, Zanzibar Authorization Case Study, OPA Rego Policy Decision Graph, and Distributed Tracing next.',
        'WebAuthn Passkey Credential Discovery continues from this foundation into discoverable credentials, allowCredentials filtering, conditional mediation, account selectors, fallback identity hints, and how passkey UX interacts with SameSite cookies and Storage Access in real browser login flows.',
      ],
    },
  ],
};
