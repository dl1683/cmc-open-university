// JWT verification: compact JWS envelope, JOSE header, JWKS key lookup,
// signature validation, claim checks, and substitution-attack defenses.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'jwt-jws-jwks-verification-case-study',
  title: 'JWT Verification',
  category: 'Security',
  summary: 'A signed-token verification case study: parse header.payload.signature, select an allowed algorithm, resolve kid through JWKS, verify the signature, and enforce issuer, audience, expiry, and type.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compact token', 'verification path'], defaultValue: 'compact token' },
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

function tokenGraph(title) {
  return graphState({
    nodes: [
      { id: 'issuer', label: 'issuer', x: 0.7, y: 3.8, note: 'trusted IdP' },
      { id: 'header', label: 'header', x: 2.5, y: 2.0, note: 'alg,kid,typ' },
      { id: 'payload', label: 'payload', x: 2.5, y: 3.8, note: 'claims' },
      { id: 'sig', label: 'sig', x: 2.5, y: 5.6, note: 'JWS proof' },
      { id: 'token', label: 'JWT', x: 4.3, y: 3.8, note: 'compact' },
      { id: 'jwks', label: 'JWKS', x: 6.0, y: 2.0, note: 'key set' },
      { id: 'verifier', label: 'verify', x: 6.0, y: 3.8, note: 'policy' },
      { id: 'api', label: 'API', x: 8.2, y: 2.8, note: 'allow' },
      { id: 'deny', label: 'deny', x: 8.2, y: 5.1, note: 'reject' },
    ],
    edges: [
      { id: 'e-issuer-header', from: 'issuer', to: 'header' },
      { id: 'e-issuer-payload', from: 'issuer', to: 'payload' },
      { id: 'e-issuer-sig', from: 'issuer', to: 'sig' },
      { id: 'e-header-token', from: 'header', to: 'token', weight: 'base64url' },
      { id: 'e-payload-token', from: 'payload', to: 'token', weight: 'base64url' },
      { id: 'e-sig-token', from: 'sig', to: 'token', weight: 'base64url' },
      { id: 'e-token-verifier', from: 'token', to: 'verifier' },
      { id: 'e-jwks-verifier', from: 'jwks', to: 'verifier' },
      { id: 'e-verifier-api', from: 'verifier', to: 'api' },
      { id: 'e-verifier-deny', from: 'verifier', to: 'deny' },
    ],
  }, { title });
}

function verifyGraph(title) {
  return graphState({
    nodes: [
      { id: 'split', label: 'split', x: 0.7, y: 3.8, note: '3 parts' },
      { id: 'parse', label: 'parse', x: 2.1, y: 3.8, note: 'JSON' },
      { id: 'alg', label: 'alg', x: 3.6, y: 2.3, note: 'allowlist' },
      { id: 'kid', label: 'kid', x: 3.6, y: 5.2, note: 'lookup key' },
      { id: 'cache', label: 'JWKS', x: 5.2, y: 5.2, note: 'cached' },
      { id: 'sig', label: 'sig', x: 5.2, y: 2.3, note: 'verify' },
      { id: 'claims', label: 'claims', x: 6.9, y: 3.8, note: 'iss aud exp' },
      { id: 'policy', label: 'policy', x: 8.4, y: 3.8, note: 'accept?' },
    ],
    edges: [
      { id: 'e-split-parse', from: 'split', to: 'parse' },
      { id: 'e-parse-alg', from: 'parse', to: 'alg' },
      { id: 'e-parse-kid', from: 'parse', to: 'kid' },
      { id: 'e-kid-cache', from: 'kid', to: 'cache' },
      { id: 'e-cache-sig', from: 'cache', to: 'sig' },
      { id: 'e-alg-sig', from: 'alg', to: 'sig' },
      { id: 'e-sig-claims', from: 'sig', to: 'claims' },
      { id: 'e-claims-policy', from: 'claims', to: 'policy' },
    ],
  }, { title });
}

function* compactToken() {
  yield {
    state: tokenGraph('A JWT is a signed envelope, not a magic session'),
    highlight: { active: ['issuer', 'header', 'payload', 'sig', 'token', 'e-header-token', 'e-payload-token', 'e-sig-token'], compare: ['verifier'] },
    explanation: 'The compact form has three base64url pieces: protected header, payload claims, and signature. The signature protects the exact header and payload bytes, but the payload is still readable unless the token is encrypted as JWE.',
    invariant: 'A signed JWT is integrity-protected; it is not automatically secret.',
  };

  yield {
    state: labelMatrix(
      'Compact token fields',
      [
        { id: 'alg', label: 'alg' },
        { id: 'kid', label: 'kid' },
        { id: 'typ', label: 'typ' },
        { id: 'iss', label: 'iss' },
        { id: 'aud', label: 'aud' },
        { id: 'exp', label: 'exp' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['crypto mode', 'alg swap'],
        ['key lookup', 'injection'],
        ['token kind', 'confusion'],
        ['who issued', 'wrong issuer'],
        ['who may use', 'substitute'],
        ['valid until', 'replay'],
      ],
    ),
    highlight: { active: ['alg:job', 'kid:job', 'iss:job', 'aud:job'], compare: ['alg:risk', 'typ:risk'] },
    explanation: 'The header and claims are verification inputs, not instructions from a trusted party. Local policy decides which algorithms, issuers, audiences, token types, and key sources are acceptable.',
  };

  yield {
    state: tokenGraph('kid selects a key from the issuer key set'),
    highlight: { active: ['token', 'header', 'jwks', 'verifier', 'e-jwks-verifier', 'e-token-verifier'], found: ['issuer'], compare: ['deny'] },
    explanation: 'Many deployments publish a JSON Web Key Set. The verifier uses trusted issuer configuration plus kid to select a public key; kid is only an index into that trusted set, not permission to fetch attacker-chosen keys.',
  };

  yield {
    state: tokenGraph('Signature success is only the first gate'),
    highlight: { active: ['verifier', 'api', 'e-verifier-api', 'payload'], compare: ['deny'], found: ['sig'] },
    explanation: 'Signature success only proves integrity under an accepted key. The resource server must still reject wrong issuer, wrong audience, expired time window, wrong token type, missing scopes, or a subject that policy does not allow.',
  };
}

function* verificationPath() {
  yield {
    state: verifyGraph('Verification is a pipeline with local policy at each edge'),
    highlight: { active: ['split', 'parse', 'alg', 'kid', 'cache', 'sig'], compare: ['claims'] },
    explanation: 'A strict verifier rejects bad structure before it reaches crypto. It splits exactly three parts, base64url-decodes header and payload, parses JSON, and enforces an algorithm allowlist before using any key material.',
    invariant: 'The token may propose values; the verifier chooses what is acceptable.',
  };

  yield {
    state: verifyGraph('JWKS caching is a key-rotation data structure'),
    highlight: { active: ['kid', 'cache', 'sig', 'e-kid-cache', 'e-cache-sig'], found: ['alg'], compare: ['claims'] },
    explanation: 'The key set cache needs issuer binding, cache lifetime, refresh-on-miss, and overlap during rotation. If kid is unknown, refresh the trusted issuer key set; do not follow attacker-controlled key URLs.',
  };

  yield {
    state: verifyGraph('Claims turn crypto success into authorization context'),
    highlight: { active: ['sig', 'claims', 'policy', 'e-sig-claims', 'e-claims-policy'], found: ['alg', 'cache'] },
    explanation: 'The verified payload becomes authorization context only after claim validation. Issuer binds signing authority, audience prevents cross-service replay, time claims bound reuse, and scope plus subject feed the policy gate.',
  };

  yield {
    state: labelMatrix(
      'JWT reject table',
      [
        { id: 'none', label: 'none alg' },
        { id: 'mix', label: 'alg mix' },
        { id: 'kid', label: 'kid path' },
        { id: 'jku', label: 'jku URL' },
        { id: 'aud', label: 'aud miss' },
        { id: 'typ', label: 'typ miss' },
      ],
      [
        { id: 'bug', label: 'bug' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['no proof', 'allowlist'],
        ['key misuse', 'one alg/key'],
        ['lookup inj', 'sanitize'],
        ['SSRF', 'trusted URL'],
        ['wrong API', 'require aud'],
        ['kind swap', 'require typ'],
      ],
    ),
    highlight: { removed: ['none:fix', 'mix:fix', 'jku:fix', 'aud:fix'], compare: ['kid:bug', 'typ:bug'] },
    explanation: 'The famous JWT failures are mostly data-structure failures: trusting a header to choose an algorithm, treating kid as a raw database key, accepting the wrong audience, or letting one token kind stand in for another.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compact token') yield* compactToken();
  else if (view === 'verification path') yield* verificationPath();
  else throw new InputError('Pick a JWT verification view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the compact-token view as a signed envelope moving from issuer to verifier. JWT is the claims format, JWS is the signature envelope, and JWKS is the issuer public-key set. Active nodes show the current gate, and the deny path shows where verification stops.',
      {type:"callout", text:"Verification is a policy pipeline: the token proposes structure, keys, and claims, but the verifier decides which facts become trusted authorization context."},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'APIs need identity facts on each request without calling the identity provider every time. A signed JWT can carry subject, issuer, audience, expiry, tenant, and scopes in an HTTP header. Verification turns that attacker-controlled string into a small trusted context.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to decode the payload and read the fields. That helps debugging because signed JWT payloads are usually readable. It is unsafe because decoding is not verification, and a readable claim is not a trusted claim.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is substitution. A valid token for one API can be replayed to another unless audience is checked. An ID token can be mistaken for an access token unless token type is checked. A token header can propose an algorithm or key id, but local policy must decide whether either is allowed.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The token proposes; the verifier decides. Trusted configuration supplies issuers, JWKS locations, allowed algorithms, audiences, clock tolerance, token profiles, and route policy. Verification binds untrusted header and payload bytes to that local configuration.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A verifier splits the compact token into exactly three parts, decodes header and payload, parses JSON, and rejects malformed structure. It selects trusted issuer configuration, checks the algorithm allowlist, resolves kid inside the issuer-bound JWKS cache, and verifies the JWS signature over the original encoded header and payload segments.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The signature gate gives integrity: changing the protected header or payload breaks verification under the accepted key. Claim gates prevent substitution: issuer binds signing authority, audience binds the consuming API, expiry bounds replay time, and token type prevents one credential kind from standing in for another.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Parsing and claim checks are cheap; asymmetric signature verification is usually the main CPU cost. At 5000 requests per second, 0.2 ms of verification CPU consumes one full CPU core before application logic. JWKS network fetch is far more expensive, so key sets must be cached and refreshed with rate limits.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'API gateways verify access tokens at the edge and forward only a verified context to services. OpenID Connect clients verify ID tokens before creating local sessions. Service-to-service systems use short-lived JWTs so workloads can prove identity without a central lookup on every request.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'JWT fails when immediate revocation or hidden claims are mandatory. A bearer token can remain usable until expiry after a user is disabled unless the system adds introspection, revocation lists, short lifetimes, or sender constraints. It also fails when different services implement subtly different validators.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'An API receives a token with algorithm RS256 and key id k17. The verifier has issuer id.example.com, expected audience payments-api, and cached public key k17. Signature verification passes, but the request is still rejected if audience is profile-api, expiry is in the past, or token type is ID token instead of access token.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: RFC 7519 JWT at https://www.rfc-editor.org/rfc/rfc7519, RFC 7515 JWS at https://www.rfc-editor.org/rfc/rfc7515, RFC 7517 JWK at https://www.rfc-editor.org/rfc/rfc7517, RFC 8725 JWT Best Current Practices at https://www.rfc-editor.org/rfc/rfc8725, and OpenID Connect Core at https://openid.net/specs/openid-connect-core-1_0.html. Study OAuth PKCE, JSON parsing, public-key signatures, HMAC, key rotation, OPA, Zanzibar, and Macaroons next.',
    ] },
  ],
};
