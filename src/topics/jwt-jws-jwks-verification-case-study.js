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
    {
      heading: 'Why this exists',
      paragraphs: [
        "APIs need a compact way to receive identity and authorization facts without making every request call the identity provider. A JSON Web Token carries claims such as issuer, subject, audience, expiry, token type, tenant, and scope in a string small enough for an HTTP Authorization header. That makes it attractive for API gateways, microservices, mobile clients, and federated identity systems.",
        "The common API form is a signed JWT, which is a JSON Web Signature. The signature protects the exact header and payload bytes from tampering. If verification succeeds under an accepted issuer key and algorithm, the API can trust that those bytes came from a signing authority it recognizes.",
        "That is only the beginning. A valid signature does not prove the token is meant for this API, still within its time window, the right kind of token, or sufficient for the requested resource. JWT verification exists to turn an untrusted string into a small verified context that local authorization policy can safely consume.",
      ],
    },
    {
      heading: 'JWT, JWS, and JWKS',
      paragraphs: [
        "JWT is the claims format. It says how to represent a set of claims as JSON and defines registered names such as `iss`, `sub`, `aud`, `exp`, `nbf`, and `iat`. JWS is the signing envelope. It defines the protected header, payload, signature, and compact serialization with three base64url segments separated by dots. JWE is the encryption envelope, which is separate. A signed JWT is integrity-protected, not automatically secret.",
        "JWKS means JSON Web Key Set. It is a JSON document containing public keys, usually published by an issuer so resource servers can verify tokens. The `kid` header is a key id that helps the verifier choose one key from that trusted set. It is not permission for the token to name an arbitrary key source.",
        "Those distinctions matter because many JWT bugs come from mixing layers. Decoding is not verification. Signature success is not authorization. JWKS lookup is not a trust decision by itself. The verifier has to combine the token with local issuer configuration, accepted algorithms, key material, time rules, token profile, and resource policy.",
      ],
    },
    {
      heading: 'The Naive Verification Plan and Wall',
      paragraphs: [
        "The tempting shortcut is to decode the payload, read the claims, and trust the fields because the token looks official. Another common shortcut is to verify the signature and then accept every claim as automatically relevant to the current request. Both shortcuts are dangerous because JWTs are self-contained enough to look finished before they have been checked against local policy.",
        "A token is attacker-controlled input until verification finishes. The header may say `alg`, `kid`, `typ`, `jku`, or `x5u`, but those values are proposals, not instructions from a trusted authority. The payload may say `admin: true`, but that claim means nothing unless it came from the expected issuer, was signed with an accepted key, is intended for this audience, and is allowed by this API.",
        "The correct mental model is a pipeline. Structure, algorithm, key, signature, claims, and resource policy are separate gates. Skipping any gate leaves room for substitution attacks, algorithm confusion, replay, or token-kind confusion.",
      ],
    },
    {
      heading: 'Core Insight: Local Policy Owns Trust',
      paragraphs: [
        "The token may propose values, but the verifier decides what is acceptable. Local configuration supplies trusted issuers, JWKS locations, allowed algorithms, accepted key types, expected audience, token type, clock tolerance, required claims, and authorization rules. The verifier should never let the token choose its own trust anchor.",
        "The real data structure is not just `header.payload.signature`. It is token bytes plus issuer metadata, algorithm allowlist, JWKS cache, key-rotation rules, claim validators, clock source, token-profile rules, and the authorization policy that consumes the verified result.",
        "This is why well-designed JWT verification code often looks more like a policy engine than a decoder. The parser extracts fields. The verifier binds them to trusted configuration. The application receives a verified context, not a raw token-shaped bag of claims.",
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "The compact-token view shows that a JWT is a signed envelope with three visible parts: protected header, payload, and signature. The payload is readable by anyone who holds the token unless the system uses JWE encryption. The signature protects integrity, not confidentiality.",
        "The verification-path view shows the actual gate sequence. Structure must be valid before crypto. Algorithm must be allowlisted before key use. `kid` must resolve inside a trusted issuer key set. Signature success must feed claim validation, and claim validation must feed local authorization policy. The API should allow the request only after all of those gates pass.",
      ],
    },
    {
      heading: 'Mechanism: Verification Pipeline',
      paragraphs: [
        "First split the compact token into exactly three parts. Reject missing parts, extra parts, invalid base64url, malformed JSON, unsupported critical headers, and token sizes outside policy. This is ordinary input validation, but it matters because malformed tokens should not reach confusing crypto or key lookup paths.",
        "Next parse the protected header and select an allowed algorithm from local configuration. The algorithm in the header must match what the issuer and key are allowed to use. A verifier should not accept `none` for bearer access tokens, should not allow RSA/HMAC confusion, and should not let one key be reused across incompatible algorithm families.",
        "Then bind the token to issuer configuration. Depending on the system, the issuer may be discovered from a trusted route, tenant mapping, or the untrusted `iss` claim followed by an allowlist lookup. The important rule is that `iss` can only select from preconfigured trusted issuers. It cannot introduce a new issuer on the fly.",
        "After that, choose a key. For JWKS-backed issuers, `kid` is a lookup hint inside the trusted issuer key set. If the key is missing, the verifier may refresh the issuer JWKS according to cache rules. It should not follow arbitrary `jku` or `x5u` URLs supplied by the token unless those URLs are pinned by issuer configuration.",
        "Now verify the JWS signature over the exact base64url signing input: protected-header segment, dot, payload segment. Only after signature success should the verifier treat the payload as authenticated. Claim validation then checks issuer, audience, expiry, not-before, issued-at, token type, subject, tenant, scope, and application-specific constraints.",
      ],
    },
    {
      heading: 'JWKS as a Rotation Cache',
      paragraphs: [
        "A JWKS cache is a key-rotation data structure. It needs issuer binding, cache lifetime, refresh-on-miss behavior, overlap during rotation, and protection against untrusted key sources. The same `kid` string from two issuers must not collide because the cache key is really issuer plus key id, not key id alone.",
        "Refresh behavior has to balance availability and security. If a key rotates and the verifier never refreshes, legitimate tokens fail. If the verifier fetches aggressively on every unknown `kid`, attackers can turn verification into a network amplification or denial-of-service path. Production systems usually cache by issuer, respect TTLs, refresh on misses with rate limits, and keep old keys long enough for token overlap.",
        "The JWKS document itself is not magic. It is trusted only because the issuer configuration says where to get it, how to validate transport, and which algorithms or key types are acceptable. A token-supplied key URL is attacker input unless local policy has pinned it.",
      ],
    },
    {
      heading: 'Worked Example: API Gateway',
      paragraphs: [
        "An API gateway receives `Authorization: Bearer <token>`. It does not pass the token directly to business logic. It splits the compact token, parses the header and payload, rejects unsupported algorithms, finds issuer configuration from an allowlist, resolves `kid` inside the issuer JWKS cache, and verifies the signature.",
        "After crypto succeeds, the gateway checks claims. `iss` must equal the configured issuer. `aud` must name this API, not some neighboring service. `exp` and `nbf` must fit the gateway clock with a small allowed skew. `typ` or a profile-specific field must say this is an access token, not an ID token or refresh token. Tenant and subject must be valid for the route. Scopes or permissions must include what the endpoint requires.",
        "The downstream service receives a verified context: subject, issuer, audience, tenant, scopes, token id, and authentication method. It does not need to re-parse arbitrary strings. A policy layer such as OPA Rego or a relationship-based authorization system can then decide whether the subject may access the concrete resource.",
      ],
    },
    {
      heading: 'Why It Works: The Pipeline',
      paragraphs: [
        "The signature check binds the protected header and payload bytes to a key accepted for the configured issuer and algorithm. If either segment changes, verification fails. That gives the API integrity over the authenticated claims.",
        "Claim validation prevents substitution. Audience says which API may consume the token. Issuer says who was allowed to sign it. Expiry and not-before limit replay time. Token type prevents an ID token, access token, or refresh token from standing in for another credential. Scope and tenant claims feed the local authorization layer.",
        "The order matters. If claim checks happen before signature verification, the application may act on attacker-edited JSON. If signature checks happen without audience and type checks, a valid token can be replayed in the wrong place. The pipeline works because each gate removes a different class of attack.",
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        "Parsing and claim checks are cheap. Signature verification is the dominant per-request CPU cost, especially for asymmetric algorithms. JWKS fetching is far more expensive than verification, so production systems cache key sets and avoid network lookup on the hot path whenever possible.",
        "JWTs reduce central session lookups, but they make revocation and claim freshness harder. A signed token can remain valid until expiry even after a user is disabled or permissions change. Common mitigations include short lifetimes, refresh tokens with server-side checks, token introspection for high-risk paths, revocation lists for exceptional cases, and sender-constrained tokens.",
        "JWTs also increase log and storage risk. A bearer access token is a credential. If it appears in logs, browser storage, URLs, referrers, crash reports, or analytics events, whoever obtains it may be able to use it until expiry unless additional proof-of-possession or policy controls apply.",
      ],
    },
    {
      heading: 'Where JWTs Win and Fail',
      paragraphs: [
        "JWTs win in stateless API gateways, service-to-service calls, federated identity flows, and distributed systems where many services need to verify the same issuer without storing a local session row. They work best when issuers are few, audiences are strict, token lifetimes are short, keys rotate cleanly, and services convert raw tokens into a small verified context.",
        "They fail when immediate revocation, hidden claims, or constantly changing permissions are core requirements. They also fail when every service invents its own verifier. JWT security depends on consistent local policy. A fleet with five subtly different validators is a substitution bug waiting to happen.",
        "A JWT is also not an authorization system by itself. It can carry claims into one, but resource decisions still require policy. A token that says a user has `documents:read` does not automatically answer which document, in which tenant, under which sharing rule.",
      ],
    },
    {
      heading: 'Common Failure Modes',
      paragraphs: [
        "Algorithm confusion is the classic mistake: trusting the token header to decide whether a signature is required or which key type to use. The fix is an allowlist bound to issuer and key, with incompatible algorithm families kept separate.",
        "`kid` injection is another common failure. Treating `kid` as a raw file path, SQL fragment, cache key without issuer binding, or reason to fetch attacker-controlled keys turns lookup metadata into an attack surface. The fix is sanitized lookup inside a trusted issuer key set.",
        "Audience and token-type confusion are quieter but common. A token issued for one API, one tenant, or one kind of use can be validly signed and still wrong for this request. The fix is strict `aud`, `iss`, token profile, tenant, and route-level policy checks.",
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        "Primary sources: RFC 7519 JWT at https://www.rfc-editor.org/rfc/rfc7519, RFC 7515 JWS at https://www.rfc-editor.org/rfc/rfc7515, RFC 7517 JWK at https://www.rfc-editor.org/rfc/rfc7517, and RFC 8725 JWT Best Current Practices at https://www.rfc-editor.org/rfc/rfc8725.",
        "RFC 8725 is the security checklist: it covers weak signature validation, none-alg acceptance, RSA/HMAC confusion, substitution attacks, unsafe `kid` lookup, arbitrary `jku` and `x5u` fetching, indirect server attacks, and cross-JWT confusion.",
        "Study OAuth PKCE Token Lifecycle Case Study for how access tokens are obtained, JSON Parser Stack Case Study for parse boundaries, Capability Security and Attenuation for explicit authority, Macaroon Caveat Chain Case Study and UCAN Delegation Proof Chain for attenuated credentials, Zanzibar Authorization Case Study for relationship checks, and OPA Rego Policy Decision Graph for policy after verification.",
      ],
    },
  ],
};
