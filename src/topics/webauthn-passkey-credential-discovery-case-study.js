// WebAuthn credential discovery: discoverable credentials, conditional mediation,
// allowCredentials, account selectors, RP ID scoping, and fallback login paths.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webauthn-passkey-credential-discovery-case-study',
  title: 'WebAuthn Passkey Credential Discovery',
  category: 'Security',
  summary: 'How passkey login discovers credentials with RP ID scoping, discoverable credentials, allowCredentials, conditional mediation, account selectors, and fallback paths.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['discoverable login', 'conditional ui'], defaultValue: 'discoverable login' },
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

function discoverGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'rp', label: 'RP', x: 0.5, y: 4.1, note: notes.rp ?? 'server' },
      { id: 'options', label: 'options', x: 2.8, y: 4.1, note: notes.options ?? 'challenge' },
      { id: 'browser', label: 'browser', x: 4.9, y: 4.1, note: notes.browser ?? 'origin' },
      { id: 'rpId', label: 'RP ID', x: 6.4, y: 2.8, note: notes.rpId ?? 'scope' },
      { id: 'authn', label: 'authn', x: 6.4, y: 5.5, note: notes.authn ?? 'platform' },
      { id: 'creds', label: 'creds', x: 7.8, y: 4.1, note: notes.creds ?? 'matches' },
      { id: 'user', label: 'user', x: 9.4, y: 2.8, note: notes.user ?? 'select' },
      { id: 'assert', label: 'assert', x: 9.4, y: 5.5, note: notes.assert ?? 'signature' },
    ],
    edges: [
      { id: 'e-rp-options', from: 'rp', to: 'options', weight: '' },
      { id: 'e-options-browser', from: 'options', to: 'browser', weight: '' },
      { id: 'e-browser-rpId', from: 'browser', to: 'rpId', weight: '' },
      { id: 'e-browser-authn', from: 'browser', to: 'authn', weight: '' },
      { id: 'e-rpId-creds', from: 'rpId', to: 'creds', weight: '' },
      { id: 'e-authn-creds', from: 'authn', to: 'creds', weight: '' },
      { id: 'e-creds-user', from: 'creds', to: 'user', weight: '' },
      { id: 'e-user-assert', from: 'user', to: 'assert', weight: '' },
      { id: 'e-assert-rp', from: 'assert', to: 'rp', weight: '' },
    ],
  }, { title });
}

function* discoverableLogin() {
  yield {
    state: discoverGraph('The server can omit allowCredentials for discoverable login'),
    highlight: { active: ['rp', 'options', 'browser', 'e-rp-options', 'e-options-browser'], compare: ['creds'] },
    explanation: 'A discoverable passkey lets the authenticator find account credentials for the relying party without the server first naming specific credential IDs.',
    invariant: 'Credential discovery is scoped by RP ID and user consent, not by a global username database.',
  };

  yield {
    state: discoverGraph('RP ID and origin scope the credential search', { rpId: 'example.com', creds: 'site creds' }),
    highlight: { active: ['browser', 'rpId', 'authn', 'creds', 'e-browser-rpId', 'e-rpId-creds'], found: ['authn'] },
    explanation: 'The browser and authenticator only surface credentials whose relying-party scope matches the requesting site. This is the phishing-resistance boundary from the base WebAuthn flow.',
  };

  yield {
    state: labelMatrix(
      'Discovery modes',
      [
        { id: 'allow', label: 'allow list' },
        { id: 'discover', label: 'discover' },
        { id: 'hybrid', label: 'hybrid' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        { id: 'server', label: 'server knows' },
        { id: 'ux' },
      ],
      [
        ['cred IDs', 'account first'],
        ['challenge', 'passkey first'],
        ['some hints', 'flexible'],
        ['password/OTP', 'recovery'],
      ],
    ),
    highlight: { active: ['discover:server', 'allow:server'], compare: ['fallback:ux'] },
    explanation: 'Traditional WebAuthn often starts after username entry and sends allowCredentials. Discoverable passkeys can start before username entry, letting the credential picker identify the account.',
  };

  yield {
    state: discoverGraph('The user chooses an account and returns an assertion', { user: 'account', assert: 'signed', rp: 'verify' }),
    highlight: { active: ['creds', 'user', 'assert', 'rp', 'e-creds-user', 'e-user-assert', 'e-assert-rp'], found: ['options'] },
    explanation: 'The browser UI mediates account selection. After user verification or presence, the authenticator signs the challenge and the server verifies the assertion just like the base passkey login.',
  };

  yield {
    state: labelMatrix(
      'Server records',
      [
        { id: 'cred', label: 'cred id' },
        { id: 'user', label: 'user id' },
        { id: 'name', label: 'display' },
        { id: 'rp', label: 'RP ID' },
        { id: 'aaguid', label: 'aaguid' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'privacy' },
      ],
      [
        ['lookup', 'opaque'],
        ['account', 'stable'],
        ['selector', 'minimal'],
        ['scope', 'site bound'],
        ['metadata', 'careful'],
      ],
    ),
    highlight: { found: ['cred:role', 'user:role', 'rp:role'], compare: ['aaguid:privacy'] },
    explanation: 'Discovery still ends in a server lookup. The credential ID maps to a user and public key. Account display names should be minimal because login UI can expose them in shared-device contexts.',
  };
}

function* conditionalUi() {
  yield {
    state: discoverGraph('Conditional mediation integrates passkeys into the sign-in form', { browser: 'conditional', user: 'autofill', creds: 'suggestions' }),
    highlight: { active: ['options', 'browser', 'creds', 'user', 'e-options-browser', 'e-creds-user'], compare: ['assert'] },
    explanation: 'Conditional mediation lets the page ask for credentials while keeping normal sign-in UI visible. Passkeys can appear in the browser autofill/account selector instead of a modal-first flow.',
    invariant: 'Conditional UI should improve login discovery without trapping the user.',
  };

  yield {
    state: labelMatrix(
      'Conditional flow',
      [
        { id: 'detect', label: 'detect' },
        { id: 'start', label: 'start get' },
        { id: 'autofill', label: 'autofill' },
        { id: 'submit', label: 'submit' },
      ],
      [
        { id: 'API', label: 'API' },
        { id: 'job' },
      ],
      [
        ['isConditional', 'feature gate'],
        ['mediation', 'listen'],
        ['account UI', 'choose'],
        ['assertion', 'verify'],
      ],
    ),
    highlight: { active: ['detect:API', 'start:API', 'autofill:job'], found: ['submit:job'] },
    explanation: 'The app checks support, starts a credentials.get request with conditional mediation, and lets the browser surface passkey suggestions beside username/password fallback.',
  };

  yield {
    state: discoverGraph('Fallback remains visible when no credential is available', { creds: 'none', user: 'manual login', assert: 'password/OTP' }),
    highlight: { active: ['creds', 'user', 'assert'], removed: ['e-user-assert'], compare: ['browser'] },
    explanation: 'A good passkey login is not a dead end. If the device has no matching credential, the page still supports password, email link, recovery, enterprise SSO, or account creation paths.',
  };

  yield {
    state: labelMatrix(
      'UX risks',
      [
        { id: 'shared', label: 'shared dev' },
        { id: 'multi', label: 'multi acct' },
        { id: 'recover', label: 'recovery' },
        { id: 'phish', label: 'phish' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'control' },
      ],
      [
        ['name leak', 'minimal labels'],
        ['wrong acct', 'clear picker'],
        ['lockout', 'backup path'],
        ['fake page', 'RP binding'],
      ],
    ),
    highlight: { found: ['phish:control', 'recover:control'], compare: ['shared:risk'] },
    explanation: 'Passkeys improve phishing resistance, but account discovery still needs privacy and recovery design: shared devices, multiple accounts, enterprise policies, and lost devices all matter.',
  };

  yield {
    state: discoverGraph('The complete case study is a password-to-passkey migration', { rp: 'shop', options: 'challenge', creds: 'passkey?', user: 'picker', assert: 'session' }),
    highlight: { active: ['rp', 'options', 'browser', 'creds', 'user', 'assert'], found: ['e-assert-rp'] },
    explanation: 'A store keeps its password form, adds conditional passkey suggestions, enrolls passkeys after successful password login, and gradually shifts returning users to discoverable credential login.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'discoverable login') yield* discoverableLogin();
  else if (view === 'conditional ui') yield* conditionalUi();
  else throw new InputError('Pick a WebAuthn discovery view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'WebAuthn credential discovery is the login UX layer around passkeys. Instead of always asking the user for a username first and then sending allowCredentials, a site can support discoverable credentials and conditional mediation so the browser/authenticator can surface matching passkeys scoped to the relying party.',
        'MDN describes the Web Authentication API as enabling strong authentication with public key cryptography and passkeys: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API. MDN PublicKeyCredential documents the credential interface: https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential. W3C WebAuthn Level 3 defines scoped public-key credentials: https://www.w3.org/TR/webauthn-3/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A retail site adds passkeys without removing its password form. On page load it checks conditional-mediation support and starts a passkey request with a fresh challenge. If the browser has a matching discoverable credential for the RP ID, it shows a passkey suggestion in the account selector. If the user chooses it, the authenticator returns an assertion and the server verifies it against the stored public key. If not, the normal password/SSO/recovery paths remain visible.',
        'This builds directly on WebAuthn Passkeys: that page explains registration and assertion records; this one explains how credentials are discovered and selected in the login UX.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study WebAuthn Passkeys for the base registration/assertion cryptography, OAuth PKCE Token Lifecycle Case Study for redirect login state, SameSite Cookies & CSRF for cookie-backed session safety, Storage Access API Third-Party Cookie Gate for embedded login widgets, and Capability Security & Attenuation for scoped authority.',
      ],
    },
  ],
};
