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
        "Read the animation as the execution trace for WebAuthn Passkeys. A public-key login case study: challenge records, RP ID scoping, credential IDs, public keys, authenticator data, signatures, and counters..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Passwords make the server store something attackers can target and make users type a secret into pages that may be fake. Even with hashing and MFA, phishing and credential reuse keep turning login into a shared-secret problem.',
        'WebAuthn changes the shape of login. A site stores a public key for that site. The user device keeps the private key. Each login is a fresh signature over a challenge bound to the real relying party.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The usual login design stores a password hash, checks a submitted password, and adds an OTP or push prompt for extra protection. That design is familiar, deployable, and better than storing plaintext passwords.',
        'It still leaves users entering reusable secrets into pages. It also leaves recovery, phishing resistance, MFA enrollment, and credential stuffing as separate problems bolted around the same shared-secret core.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If a phishing site collects a password and OTP, it can replay them quickly against the real site. If a password database leaks, attackers can attempt offline cracking and reuse. If recovery is weak, attackers bypass the stronger primary factor.',
        'OTP helps, but many OTP flows are still phishable because the secret or code is transferable. The missing invariant is site-scoped possession of a private key that cannot be replayed to a different origin.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The credential is scoped to a relying-party ID and used through the browser. The authenticator signs a fresh challenge together with authenticator data, and the server verifies the signature using the stored public key for that credential ID.',
        'That turns login into a lookup plus a proof of possession. The server can verify the proof, but a server breach does not reveal a secret that can produce future proofs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "The registration view shows the permanent record being created. The relying party sends a challenge and policy, the authenticator creates a key pair scoped to the RP ID, and the server stores the credential ID and public key. The server is not storing a secret it can later leak.",
        "The assertion view shows the repeatable login proof. A fresh challenge, origin, RP ID hash, authenticator flags, and signature all have to line up. The interesting part is not that the user unlocked a device; it is that the device signed the right challenge for the right relying party.",
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'Registration begins when the relying party sends public-key credential creation options: challenge, RP ID, user handle, algorithms, authenticator selection, and timeout. The authenticator creates a key pair and credential ID, then returns attestation data and the public key. The server stores the credential record.',
        'Authentication begins with a new challenge. The browser creates clientDataJSON containing the challenge and origin. The authenticator returns authenticatorData, a signature over authenticatorData plus the client-data hash, and the credential ID. The server finds the public key and validates challenge, origin, RP ID hash, flags, signature, and counter behavior.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Fresh challenges stop replay. Origin and RP ID binding stop a phishing site from asking a credential for bank.example to sign a login for attacker.example. The signature proves the authenticator holds the private key for this credential.',
        'The server-side record is safe to expose in a way a password verifier is not. A public key verifies signatures but cannot create them. That is why breach resistance and phishing resistance come from the same data-structure change.',
      ],
    },
    {
      heading: 'Registration details',
      paragraphs: [
        'Registration is a ceremony, not a form submit. The relying party chooses a random challenge, declares the RP ID, identifies the user, chooses allowed public-key algorithms, and describes authenticator requirements such as resident credential and user verification preferences. The browser binds this request to the page origin before the authenticator creates anything.',
        'The response gives the server an attested credential record. In many consumer deployments, attestation is reduced or ignored for privacy and deployability. In managed enterprise deployments, attestation can matter because the organization may want to know which authenticator class created the credential. Either way, the server must store enough metadata to verify later assertions and manage credential lifecycle.',
      ],
    },
    {
      heading: 'Assertion details',
      paragraphs: [
        'Authentication starts with a new challenge and a set of allowed credential IDs, unless discoverable credentials let the authenticator help with account selection. The browser creates client data containing the challenge and origin. The authenticator signs authenticator data plus the hash of that client data. The server verifies the challenge, origin, RP ID hash, signature, user presence, user verification requirement, and counter behavior.',
        'This is where passkeys differ from an OTP prompt. A code can be copied from one site to another. A WebAuthn signature is tied to the RP ID and challenge. A phishing page can ask the browser for its own origin, but it cannot make that origin become the bank origin unless the browser, DNS, TLS, and relying-party identity have all been compromised in a much deeper way.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'WebAuthn adds ceremony state, credential records, browser API complexity, recovery flows, device management, and user-experience edge cases. Synced passkeys improve usability but move some trust to the platform account and its recovery process.',
        'The sign counter is useful risk evidence, not a perfect clone oracle. Some authenticators may report zero or behave differently across synced credentials, so services need explicit risk handling instead of a single universal counter rule.',
        'The server data model also becomes more explicit. A user may have several credentials, some discoverable and some not, created on different platforms with different user-verification behavior. Good account security depends on showing, naming, revoking, and auditing those credentials clearly instead of treating passkeys as one invisible replacement password.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Passkeys are strong for consumer login, enterprise SSO, admin consoles, payment step-up, and any account where phishing and password reuse are real threats.',
        'They work especially well when the service can support multiple credentials per user, clear recovery, risk-based step-up, and audit logs that distinguish registration, authentication, recovery, and credential removal.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'WebAuthn does not solve authorization after login. The server still owns sessions, resource policy, account recovery, device enrollment, rate limits, abuse detection, and audit.',
        'It is also not frictionless for every environment. Legacy browsers, shared devices, platform-account recovery, lost devices, and account transfer all need product and security design.',
        'The sharpest failure mode is weak recovery. If account recovery falls back to email links, SMS, or support-desk override with little evidence, attackers will route around the phishing-resistant primary login. A passkey deployment should be reviewed together with enrollment, recovery, device removal, step-up, and session revocation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A bank enrolls a passkey for a customer account. The server sends a registration challenge for bank.example, the authenticator creates a scoped credential, and the bank stores the public key, credential ID, user handle, RP ID, and counter metadata.',
        'Later, a phishing site cannot get that credential to sign for bank.example because browser and authenticator scoping bind the credential to the real relying party. For a high-risk transfer, the bank requires user verification and a fresh assertion rather than trusting an old session alone.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: W3C WebAuthn Level 3 at https://www.w3.org/TR/webauthn-3/ and FIDO Alliance passkeys overview at https://fidoalliance.org/passkeys/.',
        'Study WebAuthn Passkey Credential Discovery for discoverable credentials and account selectors, JWT Verification and OAuth PKCE Token Lifecycle Case Study for adjacent web identity flows, Hash Table for credential-ID lookup, JSON Parser Stack Case Study for structured browser payloads, and OPA Rego Policy Decision Graph or Zanzibar Authorization Case Study for policy after authentication.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why WebAuthn Passkeys moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

