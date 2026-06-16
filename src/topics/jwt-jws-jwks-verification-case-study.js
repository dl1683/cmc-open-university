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
    explanation: 'The compact form has three base64url pieces: protected header, payload claims, and signature. The signature protects the exact header and payload bytes. The payload is readable unless the token is also encrypted.',
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
    explanation: 'The header and claims are a data structure for verification. Every field that drives lookup or policy must be interpreted under local rules, not trusted just because the token says it.',
  };

  yield {
    state: tokenGraph('kid selects a key from the issuer key set'),
    highlight: { active: ['token', 'header', 'jwks', 'verifier', 'e-jwks-verifier', 'e-token-verifier'], found: ['issuer'], compare: ['deny'] },
    explanation: 'Many deployments publish a JSON Web Key Set. The verifier uses issuer configuration and kid to select a public key, then checks the JWS signature. A kid is a lookup hint, not authority to fetch arbitrary keys.',
  };

  yield {
    state: tokenGraph('Signature success is only the first gate'),
    highlight: { active: ['verifier', 'api', 'e-verifier-api', 'payload'], compare: ['deny'], found: ['sig'] },
    explanation: 'After the signature validates, the resource server still checks issuer, audience, expiry, not-before, token type, scopes, subject rules, and application policy. A valid token for another API is still invalid here.',
  };
}

function* verificationPath() {
  yield {
    state: verifyGraph('Verification is a pipeline with local policy at each edge'),
    highlight: { active: ['split', 'parse', 'alg', 'kid', 'cache', 'sig'], compare: ['claims'] },
    explanation: 'A robust verifier splits the compact token, base64url-decodes header and payload, parses JSON, rejects malformed structure, and then enforces an algorithm allowlist before using any key.',
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
    explanation: 'The verified payload becomes authorization context only after claim validation. Issuer binds the signing authority. Audience prevents cross-service replay. Expiry and not-before bound time. Scope and subject feed the policy gate.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'A JSON Web Token is a compact way to carry claims between parties. In the common signed form, a JWT is a JWS: protected header, claims payload, and signature joined with dots. The compact JWS serialization is useful because it is small enough for HTTP headers, but it also compresses many security decisions into a tiny string.',
        'RFC 7519 defines JWT as a compact claims representation that can be signed or MACed as a JWS or encrypted as a JWE: https://www.rfc-editor.org/rfc/rfc7519. RFC 7515 defines JWS compact serialization as protected-header payload signature segments using base64url: https://www.rfc-editor.org/rfc/rfc7515. RFC 7517 defines JSON Web Keys and JSON Web Key Sets: https://www.rfc-editor.org/rfc/rfc7517.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The verifier sees several linked records: issuer configuration, accepted algorithms, JWKS cache, JOSE header, signature bytes, payload claims, clock tolerance, and application policy. The kid header is a lookup key into a trusted issuer key set. It is not permission to fetch keys from wherever the token says.',
        'Verification should be modeled as a pipeline: parse structure, reject disallowed algorithms, bind keys to the issuer, verify the signature over the exact signing input, validate issuer, audience, time, token type, and required claims, then pass only the resulting claims into authorization logic.',
      ],
    },
    {
      heading: 'Complete case study: API gateway',
      paragraphs: [
        'An API gateway accepts bearer tokens from an OAuth authorization server. For each request, it reads the Authorization header, splits the JWT, parses header and payload, finds issuer configuration from a local allowlist, refreshes JWKS on kid miss, validates the JWS signature, and then checks iss, aud, exp, nbf, typ, scope, and tenant before forwarding claims to the service.',
        'The service does not re-parse random token strings. It receives a small verified context: subject, issuer, audience, scopes, tenant, and original token ID for audit. Zanzibar Authorization Case Study or OPA Rego Policy Decision Graph can then decide whether that subject may touch the concrete resource.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not let the token choose its own trust rules. The verifier must provide the accepted algorithms, trusted issuers, trusted JWKS locations, clock tolerance, and token profiles. RFC 8725 warns about weak signature validation, none-alg acceptance, RSA/HMAC algorithm confusion, substitution attacks, unsafe kid lookup, arbitrary jku/x5u fetching, and cross-JWT confusion: https://www.rfc-editor.org/rfc/rfc8725.',
        'A valid signature does not prove the caller is allowed to perform an action. It proves the token bytes came from a key accepted for that issuer and algorithm. Authorization still needs audience, scope, resource relationship, tenant, and policy checks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 7519 JWT at https://www.rfc-editor.org/rfc/rfc7519, RFC 7515 JWS at https://www.rfc-editor.org/rfc/rfc7515, RFC 7517 JWK at https://www.rfc-editor.org/rfc/rfc7517, and RFC 8725 JWT Best Current Practices at https://www.rfc-editor.org/rfc/rfc8725.',
        'Study OAuth PKCE Token Lifecycle Case Study, JSON Parser Stack Case Study, Agent Payments Protocol Mandate Ledger Case Study, Capability Security & Attenuation, Macaroon Caveat Chain Case Study, UCAN Delegation Proof Chain, Zanzibar Authorization Case Study, OPA Rego Policy Decision Graph, Hash Table, and Distributed Tracing next.',
      ],
    },
  ],
};
