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
    explanation: 'A public client creates a high-entropy code verifier and derives a code challenge, usually with SHA-256. The verifier stays local. The challenge goes into the authorization request.',
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
    explanation: 'When access expires, the client may use a refresh token to obtain a new access token. Safer systems rotate refresh tokens, replacing the old token with a new one and detecting replay of an old refresh token.',
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
      heading: 'What it is',
      paragraphs: [
        'OAuth 2.0 authorization code with PKCE is a state-machine and token-lifecycle case study. A public client cannot keep a client secret, so PKCE adds a one-time proof: create a code verifier, send a derived code challenge in the authorization request, then present the verifier when exchanging the authorization code for tokens.',
        'RFC 7636 defines PKCE terminology and the verifier/challenge binding: https://datatracker.ietf.org/doc/html/rfc7636. RFC 6749 defines the OAuth 2.0 framework, authorization grants, access tokens, refresh tokens, and client/resource/authorization-server roles: https://datatracker.ietf.org/doc/html/rfc6749.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The client tracks a small but critical record: state, redirect URI, code verifier, code challenge method, requested scopes, issuer, nonce if OpenID Connect is present, and expiry deadlines. On redirect return, state is the lookup key that proves this browser response belongs to an outstanding authorization attempt. At the token endpoint, code plus verifier proves the client finishing the flow is the same client that started it.',
        'The authorization server stores or can reconstruct the challenge associated with the authorization code. It must validate redirect URI and client identity rules, verify the code is valid and unused, recompute the challenge from the verifier, and only then issue tokens. This is a distributed correlation problem, not just a login button.',
      ],
    },
    {
      heading: 'Token lifecycle',
      paragraphs: [
        'The authorization code is temporary and single-use. The access token is presented to the resource server. The refresh token, when issued, can mint new access tokens and therefore has a larger blast radius. Scope narrows authority. Expiry limits time. Rotation limits replay. Revocation handles logout, compromise, and policy changes.',
        'Access tokens are often opaque strings or JWTs depending on the deployment. JWT Verification explains the signed-token path: JOSE header, JWKS key lookup, signature validation, issuer, audience, expiry, and type checks. TLS 1.3 Handshake explains the channel protection that OAuth assumes for browser redirects and token requests.',
        'RFC 9700, OAuth 2.0 Security Best Current Practice, updates the threat model and security advice for modern deployments: https://datatracker.ietf.org/doc/rfc9700/. The OAuth.net PKCE page summarizes the modern advice that PKCE is recommended even when other client authentication exists and is not itself a replacement for client authentication: https://oauth.net/2/pkce/.',
      ],
    },
    {
      heading: 'Complete case study: MCP over HTTP',
      paragraphs: [
        'A remote MCP server using HTTP authorization can rely on OAuth-style authorization before allowing tool calls. The agent host opens an authorization flow, receives scoped authority, then uses an access token when calling protected endpoints. The Model Context Protocol Case Study explains the JSON-RPC tool surface; this topic explains the authorization state that decides whether those calls should be accepted.',
        'A careful implementation stores only the minimum token state needed, ties token use to scopes and audience, refreshes before access expiry, rotates refresh tokens when supported, and revokes on logout or compromise. Distributed Tracing and audit records should connect token use to protocol requests without logging raw token values.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'PKCE is not a client secret. It protects the authorization code exchange against interception by requiring the verifier at token exchange time. It does not make a public client confidential, and it does not remove the need for exact redirect URI validation, state correlation, TLS, scope minimization, token expiry, and storage hardening.',
        'Do not put access tokens in URLs. Do not store long-lived tokens where unnecessary. Do not treat refresh tokens like harmless session IDs. Do not request broad scopes just because the API allows it. Do not log Authorization headers. And do not confuse authentication with authorization: a user may be signed in but still lack the scope or relationship needed for a particular resource. Zanzibar Authorization Case Study covers that resource-level decision model.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 7636 PKCE at https://datatracker.ietf.org/doc/html/rfc7636, RFC 6749 OAuth 2.0 at https://datatracker.ietf.org/doc/html/rfc6749, RFC 9700 OAuth 2.0 Security Best Current Practice at https://datatracker.ietf.org/doc/rfc9700/, OAuth.net PKCE at https://oauth.net/2/pkce/, OAuth.net OAuth 2.0 overview at https://oauth.net/2/, and OAuth.net refresh token grant overview at https://oauth.net/2/grant-types/refresh-token/.',
        'Study JWT Verification, WebAuthn Passkeys, TLS 1.3 Handshake, JSON-RPC Protocol Case Study, Model Context Protocol Case Study, Agent Payments Protocol Mandate Ledger Case Study, Zanzibar Authorization Case Study, Capability Security & Attenuation, Macaroon Caveat Chain Case Study, UCAN Delegation Proof Chain, OPA Rego Policy Decision Graph, IndexedDB Object Store Case Study, Service Workers & Offline-First, Distributed Tracing, and Hash Table next.',
        'For browser-auth deployment details, continue into SameSite Cookies & CSRF, Storage Access API Third-Party Cookie Gate, and WebAuthn Passkey Credential Discovery. Those pages cover the session cookie, embedded-login, and passkey-discovery edges that sit around OAuth redirect flows.',
      ],
    },
  ],
};
