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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the discovery view as account selection under browser and authenticator mediation. Active nodes are the relying party, browser, RP ID, authenticator, matching credential set, user choice, and assertion. Found nodes are facts the server can verify after the user chooses a credential.',
        'The safe inference is that discovery is not proof. A picker can help the user choose an account, but the login is valid only after the authenticator signs a fresh challenge and the server verifies the scoped assertion.',
        {type:'callout', text:'Credential discovery moves account selection into browser-authenticator mediation while keeping the final proof as a scoped signature verified by the server.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/ff/FIDO2_USB_token.png', alt:'Black FIDO2 USB security key with a gold touch button.', caption:'FIDO2 security key, by Yubinerd123, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Password login starts with a user typing an account identifier and then proving control of a secret. Passkeys can remove the password, but a username-first form still keeps the old ceremony. Credential discovery lets the browser and authenticator help the user find a passkey for the current site.',
        'The privacy constraint is strict. The page should not receive a raw list of accounts stored on the device. The browser mediates the picker, the relying-party ID scopes which credentials can appear, and the server still verifies a cryptographic assertion before creating a session.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious WebAuthn login flow is username first. The user enters an email, the server looks up that account, and the server sends allowCredentials containing credential IDs for that account. That is secure and works well when the user remembers the identifier.',
        'A tempting shortcut is to let JavaScript ask the authenticator which accounts exist and build a custom picker. That would make account discovery simple for the page. It would also create an account enumeration and tracking surface.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is privacy. If a site could query all device credentials for a domain, it could learn who has accounts before any user intent. Embedded pages and malicious scripts could turn login into cross-context account probing.',
        'The wall is also phishing resistance. Discovery must be scoped by the relying-party ID, such as example.com, and mediated by the browser. Arbitrary page code cannot be trusted to decide which credentials should be visible or how they should be described.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A discoverable credential stores enough account information on the authenticator for the user to recognize it later. It remains bound to a relying-party ID. During authentication, allowCredentials can be empty or omitted, so the authenticator can search for matching credentials under that scope.',
        'The picker is a selection interface, not a security result. The security result is an assertion: a signature over a fresh challenge and authenticator data. The server verifies that signature with the public key stored for the credential.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During registration, the server requests a discoverable or resident credential and stores the returned credential ID, public key, user handle, RP ID, and metadata. The authenticator stores credential material and user-facing account labels locally or in a platform sync layer.',
        'During login, the server sends PublicKeyCredentialRequestOptions with a fresh challenge and expected RP ID. The browser and authenticator find matching credentials, show a mediated account choice, perform user presence or verification, and return an assertion. The server maps the credential ID or user handle to an account and verifies the response.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The security argument is scoped public-key proof. The private key does not leave the authenticator. A phishing origin cannot get a valid assertion for the real relying party because the RP ID hash and origin checks will not match.',
        'The privacy argument is mediated disclosure. The site asks for an assertion, but the browser decides whether to show matching accounts and when to reveal the selected credential. The page receives a result after user choice, not a free account list.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Discovery costs credential lifecycle work. A real account may have a phone passkey, laptop passkey, hardware key, synced platform passkey, and enterprise-managed credential. The service must name, show, revoke, audit, and recover those credentials.',
        'It also costs product clarity. On a shared device with 4 saved accounts, the picker must help the user choose without leaking more than needed. Conditional UI can reduce friction, but fallback paths must stay visible for users without a local passkey.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Credential discovery fits consumer login, admin consoles, high-phishing-risk services, and password-to-passkey migration. The access pattern is a sign-in page where a passkey may exist before the user types an identifier.',
        'It works best when the service supports several credentials per user and clear fallback. Users need enrollment, device replacement, recovery, credential removal, and audit history. Discovery improves the front door only if the side doors are deliberate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when recovery is weaker than login. If account recovery falls back to an easily hijacked email link or support override, attackers route around the passkey. Strong discovery must be paired with strong recovery and device-removal policy.',
        'It also fails when RP ID boundaries are misunderstood. Subdomains, embedded login, native wrappers, enterprise identity providers, and third-party widgets need careful origin design. The authenticator can only protect the boundary the relying party declares.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A retail site keeps its email field but adds conditional passkey UI. When the sign-in page loads, the server creates a 32 byte random challenge that expires in 2 minutes. The page starts a conditional WebAuthn get request for shop.example while the ordinary form remains usable.',
        'The browser finds 2 matching discoverable credentials on the device. The shopper selects alex@example.com, unlocks the device, and the authenticator signs the challenge. The server verifies challenge, origin, RP ID hash, flags, signature, and credential mapping before creating the session.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Web Authentication API at https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API, MDN PublicKeyCredential at https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential, and W3C WebAuthn Level 3 at https://www.w3.org/TR/webauthn-3/.',
        'Study next by role: WebAuthn Passkey Credential Flow for registration and assertion, OAuth PKCE Token Lifecycle for redirect login state, SameSite Cookies and CSRF for session safety, Storage Access API for embedded login, and Capability Security for scoped authority.',
      ],
    },
  ],
};
