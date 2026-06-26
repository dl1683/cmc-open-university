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
    explanation: 'The relying party starts with a fresh challenge and scoped credential options: RP ID, user handle, algorithms, authenticator preferences, and timeout. The browser carries that request to an authenticator only after user consent.',
    invariant: 'The challenge turns enrollment into a fresh, replay-resistant ceremony.',
  };

  yield {
    state: passkeyGraph('The authenticator creates a credential scoped to the RP'),
    highlight: { active: ['browser', 'authn', 'cred', 'pubkey', 'e-browser-authn', 'e-authn-cred', 'e-cred-pubkey'], found: ['challenge'] },
    explanation: 'The authenticator creates a per-site key pair and credential ID. The private key stays with the authenticator or synced passkey provider; the server stores only the public key and binding metadata needed for later checks.',
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
    explanation: 'Registration changes the server record from a reusable secret verifier to a public-key lookup row. The stored data can verify future signatures, but it cannot be used to sign in by itself.',
  };

  yield {
    state: passkeyGraph('The credential becomes a reusable login handle'),
    highlight: { active: ['cred', 'pubkey', 'counter', 'session', 'e-cred-pubkey', 'e-counter-session'], compare: ['challenge'] },
    explanation: 'After registration, the credential ID is the handle for this account credential. Later logins must prove possession of the matching private key under a new challenge and the same relying-party scope.',
  };
}

function* assertion() {
  yield {
    state: assertionGraph('Login repeats the challenge-response ceremony'),
    highlight: { active: ['rp', 'client', 'authdata', 'sig', 'e-rp-client', 'e-client-authdata', 'e-authdata-sig'], compare: ['store'] },
    explanation: 'Login repeats the fresh challenge boundary. The browser records challenge and origin in clientDataJSON, and the authenticator signs authenticatorData plus the client-data hash with the scoped private key.',
    invariant: 'The private key signs a challenge bound to this site and this ceremony.',
  };

  yield {
    state: assertionGraph('The credential ID selects the stored public key'),
    highlight: { active: ['sig', 'store', 'origin', 'counter', 'e-sig-store', 'e-store-origin', 'e-store-counter'], found: ['rp'] },
    explanation: 'The credential ID selects the stored public key, but lookup is not enough. The server verifies the signature, challenge, origin, RP ID hash, and user-presence or user-verification flags before making a session.',
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
    explanation: 'The main data-structure change is replacing reusable shared secrets with per-site public keys. A database leak exposes verification keys, not the private keys needed to answer a fresh challenge.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the registration view as the server creating a verifier, not a password replacement string. Active nodes are challenge, RP ID, user handle, authenticator, credential ID, public key, and server record. Found nodes are values that will be reused during later authentication.',
        'Read the assertion view as a fresh proof. The authenticator signs a new challenge for the relying party, and the server verifies the signature with the stored public key. The safe inference is that login succeeds only if challenge, origin, RP ID, flags, and signature line up.',
        {type:"callout", text:"WebAuthn replaces reusable secrets with a credential lookup plus a fresh site-scoped signature that the server can verify without holding the private key."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Passwords make users type reusable secrets into web pages and make servers store password verifiers that attackers can target. Hashing helps, but phishing and credential reuse remain core weaknesses. A fake site can collect a password and often a one-time code before the user notices.',
        'WebAuthn changes login into public-key authentication. The site stores a public key. The authenticator keeps the private key. Each login signs a fresh challenge bound to the real relying party.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design stores a password hash, checks submitted passwords, and adds an OTP or push prompt for extra assurance. This is familiar and deployable. It is much better than plaintext passwords.',
        'The design still has a shared-secret core. Users can enter the secret into a phishing page, attackers can reuse captured credentials, and recovery workflows often become the weakest path. MFA reduces risk, but many code-based MFA flows are still transferable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is replay. A password or OTP proves that the user knows something that can be copied. If an attacker captures it quickly, the attacker can present the same evidence to the real site.',
        'The missing invariant is site-scoped possession. The login proof must depend on a private key that does not leave the authenticator and on the relying-party identity that the browser sees. A copied string should not be enough.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Registration creates a credential record: credential ID, public key, RP ID, user handle, algorithms, and metadata. Authentication later looks up that credential and asks the authenticator to sign a fresh challenge. The server verifies the signature but never needs the private key.',
        'The credential is scoped to a relying-party ID, usually a registrable domain such as bank.example. A phishing site on another origin cannot ask the authenticator for a bank.example assertion. That scope is the main data-structure change behind passkeys.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During registration, the server sends creation options containing a random challenge, relying-party information, user handle, allowed public-key algorithms, and authenticator policy. The browser passes those options to the authenticator through navigator.credentials.create. After user consent, the authenticator creates a key pair and returns attestation data, credential ID, and public key.',
        'During authentication, the server sends a new challenge and either a list of allowed credential IDs or a discoverable-credential request. The browser calls navigator.credentials.get. The authenticator signs authenticatorData plus the hash of clientDataJSON, and the server verifies challenge, origin, RP ID hash, flags, signature, and counter or equivalent risk signal.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Fresh challenges stop replay because an old signature is tied to an old random value. Origin and RP ID checks stop ordinary phishing because the browser reports the origin that made the request and the authenticator signs for the scoped relying party. The private key never leaves the authenticator.',
        'A leaked server record is not enough to log in. The public key can verify signatures but cannot create them. That is why WebAuthn reduces both phishing risk and password-database breach impact through the same mechanism.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'WebAuthn costs ceremony and account-management work. A user may have 5 credentials across devices and platform accounts. The service must store each credential, name it, show last use, revoke it, and handle device loss without weakening the whole system.',
        'It also costs implementation precision. The server must compare challenges, validate origin and RP ID hash, parse authenticator data, check user presence or verification requirements, and handle sign-counter differences. A single universal counter rule is too brittle for synced passkeys.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Passkeys fit consumer login, enterprise SSO, admin consoles, payment step-up, developer tools, and any account where phishing and password reuse are real threats. The access pattern is repeated authentication where the user has a local or synced authenticator.',
        'They work best with multiple credentials per account, clear recovery, risk-based step-up, and audit logs that distinguish registration, authentication, recovery, and credential removal. Passkeys are an authentication primitive, not a complete account-security program.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'WebAuthn does not solve authorization after login. The server still owns sessions, resource policy, account recovery, rate limits, abuse detection, and device enrollment. A valid assertion only proves control of a credential for that account.',
        'The sharpest failure is weak recovery. If email reset, SMS fallback, or support override is easier to attack than the passkey flow, attackers use that path. Review passkeys together with enrollment, recovery, device removal, and session revocation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A bank enrolls a passkey. The server sends a 32 byte challenge for bank.example, user handle 8127, and algorithm ES256. The authenticator creates credential c9f1, stores the private key, and returns the public key. The bank stores credential c9f1 with the account record.',
        'On login, the server sends a new 32 byte challenge. The authenticator signs for bank.example after device unlock. The server finds c9f1, verifies the signature and challenge, then creates a session. A phishing site at bank-login.example cannot get a valid bank.example assertion because the RP ID and origin checks fail.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C WebAuthn Level 3 at https://www.w3.org/TR/webauthn-3/, MDN Web Authentication API at https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API, and the FIDO Alliance passkeys overview at https://fidoalliance.org/passkeys/.',
        'Study next by role: WebAuthn Passkey Credential Discovery for account pickers, Hash Table for credential-ID lookup, JSON Parser Stack for browser payload parsing, OAuth PKCE Token Lifecycle for adjacent identity flows, and Zanzibar Authorization for policy after authentication.',
      ],
    },
  ],
};

