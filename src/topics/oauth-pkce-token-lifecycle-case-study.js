// OAuth 2.0 authorization code with PKCE: verifier/challenge binding,
// state correlation, access tokens, refresh tokens, scopes, and rotation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'oauth-pkce-token-lifecycle-case-study',
  title: 'OAuth PKCE Token Lifecycle Case Study',
  category: 'Systems',
  summary: 'A security-state case study: code verifier, code challenge, state, authorization code, access token, refresh token, scopes, and rotation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pkce flow', 'token lifecycle'], defaultValue: 'pkce flow' },
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

function pkceGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.6, note: 'public app' },
      { id: 'verifier', label: 'secret', x: 2.3, y: 5.8, note: 'verifier' },
      { id: 'challenge', label: 'S256', x: 4.4, y: 5.8, note: 'challenge' },
      { id: 'authz', label: 'authz', x: 4.2, y: 1.7, note: 'authorize' },
      { id: 'code', label: 'code', x: 6.2, y: 3.8, note: 'short TTL' },
      { id: 'token', label: 'tokens', x: 8.0, y: 1.7, note: 'exchange' },
      { id: 'api', label: 'API', x: 9.2, y: 4.9, note: 'resource' },
    ],
    edges: [
      { id: 'e-client-verifier', from: 'client', to: 'verifier', weight: 'random' },
      { id: 'e-verifier-challenge', from: 'verifier', to: 'challenge', weight: 'hash' },
      { id: 'e-client-authz', from: 'client', to: 'authz', weight: 'redirect' },
      { id: 'e-challenge-authz', from: 'challenge', to: 'authz', weight: 'sent' },
      { id: 'e-authz-code', from: 'authz', to: 'code', weight: 'redirect back' },
      { id: 'e-code-token', from: 'code', to: 'token', weight: 'proof' },
      { id: 'e-token-api', from: 'token', to: 'api', weight: 'bearer' },
    ],
  }, { title });
}

function tokenGraph(title) {
  return graphState({
    nodes: [
      { id: 'cache', label: 'cache', x: 0.8, y: 3.6, note: 'token state' },
      { id: 'access', label: 'access', x: 2.9, y: 2.0, note: 'short TTL' },
      { id: 'refresh', label: 'refresh', x: 2.9, y: 5.3, note: 'longer TTL' },
      { id: 'api', label: 'API', x: 5.1, y: 2.0, note: 'bearer' },
      { id: 'rotate', label: 'rotate', x: 5.1, y: 5.3, note: 'new pair' },
      { id: 'revoke', label: 'revoke', x: 7.3, y: 5.3, note: 'logout/risk' },
      { id: 'scope', label: 'scope', x: 7.3, y: 2.0, note: 'least power' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.6, note: 'trace' },
    ],
    edges: [
      { id: 'e-cache-access', from: 'cache', to: 'access' },
      { id: 'e-cache-refresh', from: 'cache', to: 'refresh' },
      { id: 'e-access-api', from: 'access', to: 'api' },
      { id: 'e-refresh-rotate', from: 'refresh', to: 'rotate' },
      { id: 'e-rotate-cache', from: 'rotate', to: 'cache' },
      { id: 'e-refresh-revoke', from: 'refresh', to: 'revoke' },
      { id: 'e-scope-api', from: 'scope', to: 'api' },
      { id: 'e-api-audit', from: 'api', to: 'audit' },
    ],
  }, { title });
}

function* pkceFlow() {
  yield {
    state: pkceGraph('PKCE begins with a one-time verifier'),
    highlight: { active: ['client', 'verifier', 'challenge', 'e-client-verifier', 'e-verifier-challenge'], compare: ['authz'] },
    explanation: 'PKCE starts by creating proof before the browser redirect. The public client keeps a high-entropy verifier local, sends only the derived challenge, and later uses the verifier to prove it is the same client finishing the flow.',
    invariant: 'The authorization code later only works for the client that still has the verifier.',
  };

  yield {
    state: labelMatrix(
      'Authorization request state',
      [
        { id: 'state', label: 'state' },
        { id: 'redirect', label: 'redirect URI' },
        { id: 'scope', label: 'scope' },
        { id: 'challenge', label: 'challenge' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'failure', label: 'failure if weak' },
      ],
      [
        ['correlate redirect', 'CSRF / mix-up risk'],
        ['return location', 'code leaks to wrong app'],
        ['requested power', 'overbroad API access'],
        ['bind code to verifier', 'intercepted code usable'],
      ],
    ),
    highlight: { active: ['state:purpose', 'challenge:purpose'], removed: ['redirect:failure'] },
    explanation: 'The authorize redirect is full of security state. State correlates the browser return. Redirect URI pins where the code may go. Scope limits requested power. Code challenge binds the future token request to the verifier.',
  };

  yield {
    state: pkceGraph('Token endpoint verifies code plus verifier'),
    highlight: { active: ['code', 'token', 'verifier', 'challenge', 'e-code-token', 'e-verifier-challenge'], found: ['authz'] },
    explanation: 'After redirect, the client exchanges the authorization code and code verifier at the token endpoint. The authorization server recomputes the challenge from the verifier and compares it to the stored challenge before issuing tokens.',
  };

  yield {
    state: pkceGraph('Access token carries limited authority to the API'),
    highlight: { active: ['token', 'api', 'e-token-api'], compare: ['code', 'verifier'], found: ['client'] },
    explanation: 'The authorization code is a short-lived intermediate. The access token is the credential presented to the resource server. Good designs keep it short-lived, scoped, and auditable.',
  };
}

function* tokenLifecycle() {
  yield {
    state: tokenGraph('Runtime token state is a small security cache'),
    highlight: { active: ['cache', 'access', 'refresh', 'e-cache-access', 'e-cache-refresh'], compare: ['api'] },
    explanation: 'After login, the client has token state: access token, optional refresh token, expiry times, scopes, issuer, audience, and correlation metadata. Treat that cache as a security-critical data structure.',
  };

  yield {
    state: labelMatrix(
      'Credential lifecycle',
      [
        { id: 'code', label: 'auth code' },
        { id: 'access', label: 'access token' },
        { id: 'refresh', label: 'refresh token' },
        { id: 'scope', label: 'scope' },
        { id: 'state', label: 'state' },
      ],
      [
        { id: 'lifetime', label: 'lifetime' },
        { id: 'risk', label: 'risk if leaked' },
      ],
      [
        ['seconds/minutes', 'exchange once'],
        ['short', 'API calls until expiry'],
        ['longer', 'mint more access'],
        ['policy string', 'overbroad authority'],
        ['one redirect', 'login CSRF/mix-up'],
      ],
    ),
    highlight: { active: ['access:lifetime', 'refresh:risk', 'scope:risk'], compare: ['state:risk'] },
    explanation: 'These values have different blast radii. Losing an expired code is different from losing a refresh token. Scope and lifetime are data-structure fields with security consequences.',
  };

  yield {
    state: tokenGraph('Refresh rotation replaces long-lived credentials'),
    highlight: { active: ['refresh', 'rotate', 'cache', 'e-refresh-rotate', 'e-rotate-cache'], found: ['access'], compare: ['revoke'] },
    explanation: 'Refresh tokens have the bigger blast radius because they can mint new access tokens. Rotation turns refresh into a chain: each use replaces the old token, and reuse of an old token becomes a compromise signal.',
  };

  yield {
    state: labelMatrix(
      'Storage choices',
      [
        { id: 'memory', label: 'memory only' },
        { id: 'cookie', label: 'secure cookie' },
        { id: 'idb', label: 'IndexedDB' },
        { id: 'local', label: 'localStorage' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['less persistence', 'reload loses session'],
        ['httpOnly option', 'CSRF design needed'],
        ['structured storage', 'XSS can read if app can'],
        ['simple API', 'easy XSS theft'],
      ],
    ),
    highlight: { active: ['memory:strength', 'cookie:strength'], compare: ['local:weakness', 'idb:weakness'] },
    explanation: 'Token storage is threat-model dependent. Browser storage that JavaScript can read is exposed to XSS. Cookies can be httpOnly but need CSRF and same-site design. Public clients cannot hide a client secret.',
  };

  yield {
    state: tokenGraph('Every API call is authorization plus observability'),
    highlight: { active: ['access', 'api', 'scope', 'audit', 'e-access-api', 'e-scope-api', 'e-api-audit'], compare: ['refresh'] },
    explanation: 'The resource server checks the access token, scope, audience, expiry, and issuer before serving the request. Trace IDs and audit logs connect token use back to user and client activity.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pkce flow') yield* pkceFlow();
  else if (view === 'token lifecycle') yield* tokenLifecycle();
  else throw new InputError('Pick an OAuth PKCE view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the PKCE flow as two linked proofs. The authorization code travels through the browser redirect, while the verifier stays with the client until the token exchange. Active marks the value currently being created or checked. Visited marks a value that has already been bound into the protocol.',
        {type:"callout", text:"PKCE works by separating the browser-carried code from the client-held verifier, then binding the token exchange to both."},
        'PKCE means Proof Key for Code Exchange. A code verifier is a high-entropy secret created by the client. A code challenge is a derived value sent earlier to the authorization server. A safe inference rule is this: a stolen authorization code is useless unless the attacker also has the matching verifier.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'OAuth lets an application obtain delegated access without collecting the user password. The authorization code flow sends the user to an authorization server, receives a short-lived code, and exchanges that code for tokens. A token is a bearer credential, which means whoever holds it can use it until it expires or is revoked.',
        'Public clients such as native apps and browser apps cannot keep a permanent client secret. The redirect step can also pass through operating-system or browser surfaces where another app may intercept the authorization code. PKCE adds a per-login secret so the code alone is not enough.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send the user through login, receive an authorization code, and immediately trade that code for an access token. That is reasonable for a confidential server-side client because the server can authenticate itself with a stored client secret. The code is short-lived and travels over TLS.',
        'For a public client, the stored secret assumption fails. Anyone can inspect the app package or browser code. If an attacker catches the redirect code, the token endpoint may not be able to distinguish the real app from the attacker.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is code interception. The authorization code is not the final token, but it can be exchanged for one. On a device with custom URI schemes, app links, browser extensions, logs, or misconfigured redirects, another component may see the code before the real client uses it.',
        'The other wall is token lifetime. Access tokens should be short-lived, refresh tokens should be protected more carefully, and revocation must have a way to stop future use. Without a lifecycle model, a login flow that looks correct can still leak long-lived authority.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to bind the authorization code to a secret that never travels through the redirect. The client creates a random verifier, hashes it into a challenge, and sends the challenge with the authorization request. Later, the client sends the original verifier to the token endpoint.',
        'The server stores or derives the challenge relationship. If hash(verifier) matches the earlier challenge, the exchanger is likely the same client that started the flow. The authorization code becomes a locked receipt rather than a bearer credential by itself.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The client creates a verifier with enough entropy that guessing is impractical. It computes a challenge, usually with SHA-256 and base64url encoding, then redirects the user to the authorization endpoint with the challenge and method. The authorization server authenticates the user and returns an authorization code to the registered redirect URI.',
        'The client sends the code, verifier, redirect URI, and client identity to the token endpoint. The server checks that the code is valid, unexpired, unused, and issued for that client and redirect URI. It then derives the challenge from the verifier and compares it with the stored challenge.',
        'If the check passes, the server returns tokens according to policy. The access token is used at resource servers. The refresh token, when issued, is stored more carefully and exchanged later for new access tokens without sending the user through login again.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a binding invariant. The authorization server must accept a token exchange only when the code, client, redirect URI, and verifier all match the same authorization transaction. An attacker who sees only the code cannot satisfy the verifier check.',
        'Single-use codes close the replay path. Expiration closes the delayed-use path. Redirect URI matching closes a route-swapping path. PKCE handles code interception, while token storage, rotation, expiration, and revocation handle the later credential lifecycle.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'PKCE adds constant work to each login: generate one random verifier, hash it once, store one challenge, and compare once at the token endpoint. That is O(1) per authorization transaction. The practical cost is implementation discipline, not CPU.',
        'Token lifecycle cost grows with sessions. One million active refresh tokens means one million records to store, rotate, revoke, audit, and expire. Shorter access-token lifetimes reduce damage from theft but increase refresh traffic and make clock skew or token-store outages more visible.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PKCE is used by native mobile apps, desktop apps, single-page applications, command-line login flows, and any client that cannot keep a traditional secret. It is also useful for confidential clients because it adds defense in depth around authorization codes.',
        'The lifecycle model matters in enterprise apps, developer tools, cloud CLIs, and financial integrations. These systems often separate user login, short-lived access tokens, long-lived refresh tokens, device binding, consent, and revocation into explicit states.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PKCE does not protect a stolen access token. Once a bearer access token leaks, the resource server may accept it until expiration or revocation. It also does not fix an open redirect, a malicious authorization server, weak TLS, bad token storage, or a compromised device.',
        'PKCE can be weakened by poor randomness, accepting the plain challenge method when S256 is available, reusing verifiers, failing to bind redirect URI, or allowing authorization codes to be reused. These bugs break the binding invariant that makes the flow useful.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a mobile app creates a 64-character random verifier and sends challenge = base64url(SHA-256(verifier)) with challenge method S256. The authorization server stores that challenge under transaction T with a 5 minute code lifetime. After login, it returns code C to the app redirect URI.',
        'An attacker intercepts C after 30 seconds. The attacker calls the token endpoint with C but has no verifier. The server computes the challenge from the submitted verifier, sees that it does not match transaction T, and rejects the exchange.',
        'The real app submits C with the original verifier at 45 seconds. The server verifies the match, marks C as used, and returns a 10 minute access token plus a refresh token. A replay of C at 60 seconds fails because the code is already consumed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 7636 for PKCE at https://www.rfc-editor.org/rfc/rfc7636, RFC 6749 for OAuth 2.0 at https://www.rfc-editor.org/rfc/rfc6749, and the OAuth 2.0 Security Best Current Practice at https://www.rfc-editor.org/rfc/rfc9700. Use these for normative behavior rather than blog summaries.',
        'Next, study authorization code flow, redirect URI validation, bearer tokens, refresh-token rotation, token introspection, token revocation, OpenID Connect nonce handling, and WebAuthn. The reusable lesson is that a protocol value should be accepted only when all bindings prove the same transaction.',
      ],
    },
  ],
};

