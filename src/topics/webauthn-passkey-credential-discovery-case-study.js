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
      heading: 'Why this exists',
      paragraphs: [
        'Password login starts with a claim: the user types a username, then proves control of a secret. Passkeys can move part of that account selection into the browser and authenticator. If the device has a discoverable credential for the current relying party, the user can choose it and sign in without typing a password or sometimes even a username.',
        'Credential discovery exists to make that pleasant without making it leaky. The page should not receive a raw list of accounts stored on the device. The browser mediates the picker, the relying-party ID scopes which credentials can appear, and the server still verifies a fresh cryptographic assertion before creating a session.',
        {type:'callout', text:'Credential discovery moves account selection into browser-authenticator mediation while keeping the final proof as a scoped signature verified by the server.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/ff/FIDO2_USB_token.png', alt:'Black FIDO2 USB security key with a gold touch button.', caption:'FIDO2 security key, by Yubinerd123, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious WebAuthn login flow is username first. The user enters an identifier, the server looks up that account, and the server sends allowCredentials containing the credential IDs that may authenticate. That is secure and useful, but it keeps passkeys behind the old username-first ceremony.',
        'The tempting shortcut is worse: let JavaScript ask the device which accounts exist and build its own picker. That would turn login into an account enumeration and tracking surface. The wall is privacy and phishing resistance. Discovery has to happen inside browser-authenticator mediation, not inside arbitrary page code.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A discoverable credential stores enough account identity on the authenticator for the user to recognize it later. It is still bound to a relying-party ID such as example.com. When the site asks for an assertion, the browser and authenticator can find matching credentials without the server naming credential IDs first.',
        'The account picker is not the security proof. It is only a way for the user to select a credential. The proof is the assertion: a signature over a fresh challenge and authenticator data, verified by the server with the public key stored for that credential.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the discoverable login view, follow the chain from relying party to options, browser, RP ID, authenticator, credential set, user choice, and assertion. The key moment is that matching happens under RP ID scope before the server learns which account the user selected.',
        'In the conditional UI view, notice that the normal sign-in form remains present while the browser offers passkey suggestions. That is the product shape most migrations need: passkeys can be first-class without turning absence of a credential into a dead end.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During registration, the service can create a discoverable passkey by requesting a resident or discoverable credential and storing the returned credential ID, public key, user handle, RP ID, and metadata. The authenticator stores credential material and user-facing account information locally or in the platform account sync layer.',
        'During authentication, the server sends PublicKeyCredentialRequestOptions with a fresh challenge and the expected RP ID. For a discoverable login, allowCredentials can be omitted or left empty so the authenticator can search for matching credentials. With conditional mediation, the page starts the request while leaving the username field and fallback paths visible.',
        'After the user selects a credential and passes user presence or verification, the authenticator returns an assertion. The server uses the credential ID or user handle to find the stored public key, then verifies the challenge, origin, RP ID hash, flags, signature, and counter or equivalent risk signal before creating a session.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The security property comes from scoped public-key proof. The private key does not leave the authenticator. A phishing site on a different origin cannot get a valid assertion for the real relying party. The server also checks its own challenge, so an old assertion cannot be replayed into a new session.',
        'The privacy property comes from mediated discovery. The page asks for a credential, but the browser decides whether to show matching accounts and how much account information is exposed. The site receives an assertion only after user selection, not a query result listing every account on the device.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A retail site keeps its email and password form but adds passkey conditional UI. When the sign-in page loads, the server creates a short-lived challenge and the page starts a conditional WebAuthn get request. If the shopper has a passkey for shop.example, the browser can offer it in the account field.',
        'The shopper selects the passkey for alex@example.com, uses device unlock, and the authenticator signs the challenge. The server verifies the assertion, maps the credential to the account, updates the session, and records the sign-in. If the shopper has no passkey on this device, the email/password, email link, enterprise SSO, or recovery path remains available.',
      ],
    },
    {
      heading: 'Cost and tradeoff',
      paragraphs: [
        'Discoverable login adds credential lifecycle work. Services need multiple credentials per account, device removal, recovery, audit logs, risk checks, and clear handling for synced versus device-bound passkeys. The product also needs good labels because account selectors may appear on shared devices.',
        'Conditional UI improves adoption, but it depends on browser support and careful form design. It can also create confusing states if several accounts match, if a passkey exists only on another device, or if enterprise policy restricts platform authenticators.',
        'The main tradeoff is ceremony versus recovery surface. A smooth passkey picker reduces daily friction and phishing risk, but the account still needs safe enrollment, device replacement, revocation, and support workflows. Weak recovery can undo strong authentication.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'A production rollout should track passkey enrollment rate, passkey sign-in success, fallback use, recovery starts, shared-device complaints, account-selector confusion, and support contacts. Those metrics reveal whether discovery is making login simpler or merely moving friction to edge cases.',
        'The service should also keep a credential inventory for users: credential name, creation time, last use, authenticator class when safe to expose, and remove controls. Discovery works best when users can understand and manage the credentials that may appear in the browser picker.',
        'Treat the fallback path as part of the same security system. If password reset, email magic links, or support overrides are easier to attack than the passkey flow, attackers will use those paths. Strong primary authentication needs recovery policy that is at least deliberately risk-scored and monitored.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for consumer accounts, admin consoles, high-phishing-risk services, and password-to-passkey migration. It reduces typing, removes reusable secrets from the login ceremony, and lets the browser account picker become a native sign-in surface.',
        'It is strongest when the relying party keeps fallback paths explicit and treats passkeys as a credential family, not as a single device flag. Users should be able to add more than one passkey, review them, remove lost devices, and recover safely.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when recovery is weaker than login. If account recovery falls back to an easily hijacked email or support workflow, the passkey only protects the front door. Lost devices, platform-account compromise, shared devices, and family devices all need deliberate policy.',
        'It also fails when the relying-party boundary is misunderstood. RP ID choices affect subdomains and deployments. Embedded login, cross-origin iframes, native wrappers, and third-party identity flows need careful design so credential discovery still happens in the correct origin context.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Web Authentication API at https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API, MDN PublicKeyCredential at https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential, and W3C WebAuthn Level 3 at https://www.w3.org/TR/webauthn-3/.',
        'Study WebAuthn Passkeys for registration and assertion cryptography, OAuth PKCE Token Lifecycle Case Study for redirect login state, SameSite Cookies & CSRF for cookie-backed session safety, Storage Access API Third-Party Cookie Gate for embedded login widgets, and Capability Security & Attenuation for scoped authority.',
      ],
    },
  ],
};
