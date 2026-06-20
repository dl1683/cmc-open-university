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
        "Read the animation as the execution trace for OAuth PKCE Token Lifecycle Case Study. A security-state case study: code verifier, code challenge, state, authorization code, access token, refresh token, scopes, and rotation..",
        {type:"callout", text:"PKCE works by separating the browser-carried code from the client-held verifier, then binding the token exchange to both."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'OAuth exists because users should not hand their passwords to every application that wants API access. A photo-printing app should be able to read selected photos without learning the user\'s account password. A CLI tool should receive limited repository access without becoming the identity provider.',
        'PKCE exists because many clients are public. A mobile app, desktop app, browser app, or local agent host cannot keep a client secret in the same way a server can. If an attacker intercepts an authorization code on the redirect path, the code alone should not be enough to mint tokens.',
        'The authorization-code-with-PKCE flow is therefore a state-machine lesson. It separates browser redirects, one-time codes, verifier binding, token exchange, scope, expiry, refresh, revocation, and audit. Each value has a different lifetime and blast radius.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious bad approach is password sharing: ask the user for their password and call the API directly. That gives the client too much power, makes revocation awkward, and trains users to type credentials into untrusted surfaces.',
        'A second shortcut is to put powerful access tokens directly in the browser redirect or URL fragment. That avoids a backend exchange but exposes credentials to browser history, logs, extensions, referrers, and interception paths. Modern OAuth guidance has moved away from that pattern for good reason.',
        'A third mistake is treating login as the end of the story. The hard part is the token lifecycle after login: where tokens are stored, which scopes they carry, how long they last, when they rotate, how they are revoked, and what the resource server checks on every request.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is proof by separation. The authorization code travels through the browser redirect. The code verifier stays with the client until token exchange. The authorization server stores or reconstructs a challenge derived from that verifier. A stolen code is not enough unless the attacker also has the verifier.',
        'The flow also separates identity, authorization, and resource access. The authorization server issues tokens. The resource server validates the access token, audience, issuer, expiry, and scope before serving an API request. The client should not decide its own authority.',
        'The client is maintaining a small security-critical cache: state, verifier, redirect URI, code challenge method, requested scopes, issuer, token expiry, optional refresh token, and audit correlation. Losing track of one field can turn a login flow into a confused-deputy bug.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The client starts by generating a high-entropy code verifier. It derives a code challenge, usually with S256, and sends that challenge with the authorization request. It also sends state, redirect URI, client id, requested scope, and other protocol fields.',
        'After the user authorizes, the authorization server redirects back with an authorization code and state. The client checks state against the pending request. Then it sends the code and original verifier to the token endpoint. The server recomputes the challenge and compares it to the stored challenge before issuing tokens.',
        'After token issuance, the access token is presented to the resource server. A refresh token, if issued, is kept more carefully because it can mint new access tokens. Rotation turns refresh into a chain: each use replaces the old token, and reuse of an old refresh token can signal compromise.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The PKCE-flow view proves which values are allowed to travel. The challenge can go through the browser redirect because it is derived from the verifier. The verifier stays with the client until the back-channel token exchange. The authorization code is short-lived and single-use.',
        'The token-lifecycle view proves that tokens are not interchangeable. A code, access token, refresh token, scope string, and state value all have different purposes. Losing an expired code is different from losing a refresh token that can mint new access.',
        'The storage-choice matrix proves that token handling is threat-model dependent. Memory-only storage reduces persistence but loses sessions on reload. httpOnly cookies protect against JavaScript reads but require CSRF and SameSite design. Browser storage that JavaScript can read is exposed to XSS.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'PKCE works because an intercepted authorization code is only half the proof. The attacker also needs the verifier, which was not sent in the authorization request. The server binds the code to the challenge and accepts only the matching verifier at exchange time.',
        'State works because it correlates the redirect to an outstanding authorization attempt. Without state, a client can accept a response that belongs to a different request or attacker-controlled login flow. Exact redirect URI validation narrows where a code can land.',
        'Short lifetimes and scopes work by reducing blast radius. A leaked access token should expire soon and carry only the authority needed for the resource. Refresh rotation and revocation make persistent compromise easier to detect and stop.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'PKCE adds state management. The client must generate and store verifiers, handle redirects, validate state, exchange codes once, track token expiry, and recover cleanly from failed flows. That complexity is the price of avoiding password sharing and front-channel tokens.',
        'Storage choices are tradeoffs, not universal answers. In-memory tokens reduce persistence but hurt user experience after reload. Cookies can be httpOnly but need careful CSRF design. LocalStorage is simple but easy to steal after XSS. Native apps have platform credential stores, but still cannot hide embedded secrets perfectly.',
        'Refresh tokens improve user experience but increase blast radius. Long-lived authority must be rotated, constrained, stored carefully, and revoked on logout or compromise. Some deployments avoid refresh tokens in browser clients and use server-side sessions instead.',
      ],
    },
    {
      heading: 'Where it appears',
      paragraphs: [
        'PKCE is used in mobile apps, desktop apps, browser-based clients, command-line tools, device flows around user authorization, and agent hosts that need delegated access to protected APIs. The common shape is a public client that needs limited authority without holding a durable secret.',
        'In a remote MCP-style tool system, the host can open an authorization flow, receive scoped authority, and present access tokens when calling protected endpoints. The model protocol defines tool calls; OAuth decides whether those calls are authorized.',
        'The pattern also appears around enterprise SSO, SaaS integrations, developer tools, and API platforms. The details differ, but the same token lifecycle questions remain: scope, audience, expiry, storage, refresh, revocation, and audit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PKCE is not a client secret. It protects the code exchange against interception, but it does not make a public client confidential. It does not remove the need for exact redirect URI validation, TLS, state correlation, scope minimization, token expiry, and storage hardening.',
        'Do not put access tokens in URLs. Do not log Authorization headers. Do not request broad scopes because they are convenient. Do not store long-lived tokens where a short-lived session would work. Do not treat refresh tokens like harmless session IDs.',
        'Do not confuse authentication with authorization. A signed-in user may still lack the scope, tenant relationship, group membership, or object-level permission needed for a resource. Zanzibar Authorization Case Study covers that resource-level decision model.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RFC 7636 PKCE at https://datatracker.ietf.org/doc/html/rfc7636, RFC 6749 OAuth 2.0 at https://datatracker.ietf.org/doc/html/rfc6749, RFC 9700 OAuth 2.0 Security Best Current Practice at https://datatracker.ietf.org/doc/rfc9700/, OAuth.net PKCE at https://oauth.net/2/pkce/, OAuth.net OAuth 2.0 overview at https://oauth.net/2/, and OAuth.net refresh token grant overview at https://oauth.net/2/grant-types/refresh-token/. Study JWT Verification, WebAuthn Passkeys, TLS 1.3 Handshake, JSON-RPC Protocol Case Study, Model Context Protocol Case Study, Zanzibar Authorization Case Study, Macaroon Caveat Chain Case Study, UCAN Delegation Proof Chain, OPA Rego Policy Decision Graph, SameSite Cookies & CSRF, IndexedDB Object Store Case Study, and Distributed Tracing next.',
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
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
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
        'Use this topic as a checkpoint: if you can explain why OAuth PKCE Token Lifecycle Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

