// Macaroons: bearer credentials whose authority is attenuated by caveats
// chained into the token signature, including third-party discharge caveats.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'macaroon-caveat-chain-case-study',
  title: 'Macaroon Caveat Chain Case Study',
  category: 'Security',
  summary: 'A cryptographic authorization case study: root macaroons, chained HMAC signatures, first-party caveats, third-party caveats, discharge tokens, and verifier checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['caveat chain', 'third-party discharge'], defaultValue: 'caveat chain' },
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

function caveatGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root key', x: 0.8, y: 4.0, note: 'service secret' },
      { id: 'mac', label: 'mac', x: 2.8, y: 4.0, note: 'bearer' },
      { id: 'c1', label: 'caveat 1', x: 4.7, y: 2.3, note: 'time < 5pm' },
      { id: 'c2', label: 'caveat 2', x: 4.7, y: 5.7, note: 'path=/img' },
      { id: 'sig', label: 'sig', x: 6.6, y: 4.0, note: 'HMAC' },
      { id: 'req', label: 'req', x: 8.1, y: 4.0, note: 'present' },
      { id: 'verify', label: 'verify', x: 9.4, y: 4.0, note: 'checks' },
    ],
    edges: [
      { id: 'e-root-mac', from: 'root', to: 'mac' },
      { id: 'e-mac-c1', from: 'mac', to: 'c1' },
      { id: 'e-mac-c2', from: 'mac', to: 'c2' },
      { id: 'e-c1-sig', from: 'c1', to: 'sig' },
      { id: 'e-c2-sig', from: 'c2', to: 'sig' },
      { id: 'e-sig-req', from: 'sig', to: 'req' },
      { id: 'e-req-verify', from: 'req', to: 'verify' },
    ],
  }, { title });
}

function dischargeGraph(title) {
  return graphState({
    nodes: [
      { id: 'service', label: 'storage', x: 0.8, y: 4.0, note: 'root token' },
      { id: 'mac', label: 'mac', x: 2.6, y: 4.0, note: 'needs auth' },
      { id: 'cav', label: 'caveat', x: 4.4, y: 2.2, note: 'ask authz' },
      { id: 'authz', label: 'authz', x: 6.0, y: 2.2, note: 'identity' },
      { id: 'dis', label: 'disch', x: 6.0, y: 5.6, note: 'proof token' },
      { id: 'bind', label: 'bind', x: 7.8, y: 4.0, note: 'anti replay' },
      { id: 'verify', label: 'verify', x: 9.3, y: 4.0, note: 'both tokens' },
    ],
    edges: [
      { id: 'e-service-mac', from: 'service', to: 'mac' },
      { id: 'e-mac-cav', from: 'mac', to: 'cav' },
      { id: 'e-cav-authz', from: 'cav', to: 'authz' },
      { id: 'e-authz-dis', from: 'authz', to: 'dis' },
      { id: 'e-dis-bind', from: 'dis', to: 'bind' },
      { id: 'e-bind-verify', from: 'bind', to: 'verify' },
      { id: 'e-mac-verify', from: 'mac', to: 'verify' },
    ],
  }, { title });
}

function* caveatChain() {
  yield {
    state: caveatGraph('Start with a bearer credential issued by the service'),
    highlight: { active: ['root', 'mac', 'e-root-mac'], compare: ['c1', 'c2'] },
    explanation: 'The root service issues a bearer credential, but the useful twist is attenuation. Holders can append restrictions later, without asking the issuer for a new token, and the signature chain makes those restrictions tamper-evident.',
  };
  yield {
    state: caveatGraph('Each caveat attenuates the token'),
    highlight: { active: ['mac', 'c1', 'c2', 'e-mac-c1', 'e-mac-c2'], compare: ['req'] },
    explanation: 'A caveat is a condition the verifier must check. Common first-party caveats include expiry, path prefix, method, account id, request IP, nonce, or spending budget.',
    invariant: 'Anyone can add restrictions, but nobody can remove them without breaking the signature.',
  };
  yield {
    state: caveatGraph('The HMAC chain binds caveats into the signature'),
    highlight: { active: ['c1', 'c2', 'sig', 'e-c1-sig', 'e-c2-sig'], found: ['root'] },
    explanation: 'Macaroons use chained MACs. Adding a caveat updates the signature, so a holder cannot delete or edit caveats and still present a valid credential.',
  };
  yield {
    state: labelMatrix(
      'First-party caveat checks',
      [
        { id: 'time', label: 'time' },
        { id: 'path', label: 'path' },
        { id: 'method', label: 'method' },
        { id: 'tenant', label: 'tenant' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'data', label: 'request data' },
        { id: 'action', label: 'if false' },
      ],
      [
        ['clock', 'deny'],
        ['URL prefix', 'deny'],
        ['HTTP verb', 'deny'],
        ['account id', 'deny'],
        ['counter', 'deny/escalate'],
      ],
    ),
    highlight: { active: ['time:data', 'path:data', 'budget:action'] },
    explanation: 'Verification is not only cryptography. The service recomputes the signature and evaluates every caveat against request context.',
  };
}

function* thirdPartyDischarge() {
  yield {
    state: dischargeGraph('Third-party caveats delegate one check to another service'),
    highlight: { active: ['mac', 'cav', 'authz', 'e-mac-cav', 'e-cav-authz'], compare: ['dis'] },
    explanation: 'A third-party caveat says: this token is usable only if another service supplies a discharge macaroon proving some fact, such as user identity or group membership.',
  };
  yield {
    state: dischargeGraph('The holder collects a discharge token'),
    highlight: { active: ['authz', 'dis', 'e-authz-dis'], found: ['service'] },
    explanation: 'The authorization service can issue a discharge token after its own checks. The storage service later verifies both the original macaroon and the discharge macaroon.',
  };
  yield {
    state: dischargeGraph('Binding prevents discharge replay across root tokens'),
    highlight: { active: ['dis', 'bind', 'verify', 'e-dis-bind', 'e-bind-verify'], compare: ['mac'] },
    explanation: 'The binding step keeps a discharge from becoming a portable proof. A holder may prove identity for this root macaroon, but should not be able to replay that discharge against a different root token.',
    invariant: 'The verifier must check cryptographic validity and caveat truth.',
  };
  yield {
    state: labelMatrix(
      'Macaroon versus related models',
      [
        { id: 'jwt', label: 'JWT' },
        { id: 'oauth', label: 'OAuth token' },
        { id: 'mac', label: 'macaroon' },
        { id: 'ucan', label: 'UCAN' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'watch', label: 'watch out' },
      ],
      [
        ['signed claims', 'fixed at issue'],
        ['ecosystem flow', 'bearer leakage'],
        ['append caveats', 'verification logic'],
        ['public delegation', 'revocation proof'],
      ],
    ),
    highlight: { active: ['mac:strength'], compare: ['jwt:watch', 'oauth:watch'], found: ['ucan:strength'] },
    explanation: 'Macaroons are strongest when a service wants bearer credentials that downstream holders can narrow without contacting the issuer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'caveat chain') yield* caveatChain();
  else if (view === 'third-party discharge') yield* thirdPartyDischarge();
  else throw new InputError('Pick a macaroon view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A macaroon is a bearer authorization credential with embedded caveats. It starts from a service secret and an identifier, then chains caveats into the credential signature. Holders can attenuate authority by adding more caveats, but they cannot remove caveats without invalidating the token.',
        'The Google research paper introduces macaroons as flexible authorization credentials for decentralized delegation in cloud systems: https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The core structure is an ordered list of caveats plus a chained MAC signature. A first-party caveat is checked by the target service against request context. A third-party caveat requires a discharge macaroon from another service. Verification walks the caveat list, recomputes the signature, checks discharge bindings, and evaluates all predicates.',
        'This makes macaroons a concrete version of Capability Security & Attenuation for bearer credentials. They are not pure object references, but they support a similar idea: authority should be easy to narrow before it is delegated.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious authorization token is a signed blob of claims issued by a central service. That works when all authority is known at issue time. It becomes awkward when a holder needs to delegate a narrower token later, such as only this path, only this method, only before 5pm, only after another service approves identity.',
        'Another obvious approach is to ask the issuer for a new token every time authority must narrow. That keeps policy central, but it couples every delegation to the issuer and can make offline or cross-service workflows brittle. Macaroons let holders add restrictions locally while preserving tamper evidence.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is monotonic attenuation. A macaroon holder can only make the credential weaker by adding caveats. Because each caveat changes the chained MAC, removing or editing a caveat breaks verification. That gives delegation without allowing privilege expansion.',
        'Third-party caveats add decentralized checks. The original service can say this token also requires proof from an identity service. The client collects a discharge macaroon from that service, binds it to the root token, and presents both. The verifier gets narrow authorization without every service sharing the same secret.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'In the caveat-chain view, follow root key to macaroon to caveats to signature. The caveats are not comments; they are predicates that must be checked against trusted request data. The signature node shows why a holder can add restrictions but cannot remove or edit them without detection.',
        'In the third-party-discharge view, the root service delegates one check to another service. The client collects a discharge proof, then the verifier checks both tokens and their binding. The failure mode to watch is replay: a discharge collected for one root token should not unlock another.',
        'The comparison table is the design map. JWTs are signed claims fixed at issue time. OAuth tokens are usually ecosystem flow credentials. Macaroons are valuable when authority must be narrowed after issue. UCANs push delegation into public-key proof chains. The right choice depends on who must attenuate authority and who can verify it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Macaroons work because HMAC chaining turns caveat order into cryptographic state. The verifier starts from the root secret and recomputes the chain over the identifier and caveats. If any caveat has been removed, changed, or reordered in a way the construction rejects, the final signature will not match.',
        'The authorization model works because the verifier checks two things: cryptographic validity and predicate truth. The MAC proves the caveat list was not weakened. The request-context checks prove the current request satisfies the list. Both are required.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A photo storage service issues a macaroon that grants read access to a user album. A web frontend adds caveats: path starts with /albums/123, method is GET, expiry is in ten minutes, and size is below a threshold. The client can pass this credential to an image resizing worker without giving the worker full account access.',
        'For a private album, the service adds a third-party caveat requiring an identity provider discharge. The client obtains a discharge macaroon proving the current user is signed in. The storage service verifies the root macaroon, verifies the discharge, checks binding, and then evaluates path, method, expiry, and identity caveats before serving bytes.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'In code, treat caveat verification as a registry of typed predicates rather than a pile of string checks. A caveat such as time < 2026-06-13T18:00Z, path starts /albums/123, or method = GET should parse into a known predicate with trusted request fields. Unknown caveats should fail closed unless the protocol explicitly says otherwise.',
        'The audit record should include token identifier, caveat names, discharge identities, verifier version, decision, and trace id, but not raw secrets. This connects macaroons to Distributed Tracing and LLM Guardrail Policy Engine: a narrow credential is only useful operationally if failures can be explained and replayed safely.',
        'A production verifier should separate parsing, signature verification, discharge verification, predicate evaluation, and decision logging. That separation makes it harder for a new caveat type or identity integration to bypass the rest of the chain accidentally.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Macaroons buy delegation flexibility with verifier complexity. Every service that accepts them needs a precise caveat language, trusted request context, clock handling, discharge binding, and safe failure behavior. A simple signed token can be easier to operate when authority never needs downstream attenuation.',
        'Third-party caveats add availability dependencies. If the identity service or discharge issuer is down, clients may be unable to satisfy otherwise valid tokens. Short expirations and narrow caveats reduce blast radius, but they also increase the number of credentials and discharges clients must refresh.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Macaroons are useful for delegated storage access, object download URLs, service-to-service attenuated credentials, temporary upload permissions, and workflows where one holder must narrow a credential before passing it to another component. They shine when least privilege must be applied after the original issuer is out of the path.',
        'They are less useful when policy is fully centralized, when verifiers cannot parse caveats safely, or when revocation needs to be immediate and global. In those cases, short-lived OAuth-style tokens, centralized authorization checks, or capability systems with explicit revocation may be easier to reason about.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Macaroons are bearer credentials. If an attacker steals a valid macaroon and all required discharge tokens, the attacker may use them until caveats stop them. Use short expiry, narrow scope, TLS, careful storage, and audit logging. Do not treat caveat strings as harmless comments; they are policy inputs and need precise parsers.',
        'Another mistake is believing caveats remove the need for server-side verification. The service must recompute signatures, bind discharges, and evaluate caveats against trusted request context. A token with a caveat is only as safe as the verifier that enforces it. Unknown caveats, string parsing quirks, and clock skew should be treated as security issues, not edge-case cleanup.',
        'A final mistake is adding caveats nobody observes. If the verifier does not know a caveat type, the safe behavior is denial. Silent ignore turns attenuation into decoration and can accidentally expand authority.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research macaroon overview at https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/, NDSS paper PDF at https://www.ndss-symposium.org/wp-content/uploads/2017/09/04_3_1.pdf, and the Stanford-hosted paper copy at https://theory.stanford.edu/~ataly/Papers/macaroons.pdf. Study Capability Security & Attenuation, OAuth PKCE Token Lifecycle Case Study, JWT Verification, UCAN Delegation Proof Chain, Zanzibar Authorization Case Study, Hash Table, and Distributed Tracing next.',
        'Then implement one caveat parser and test that unknown caveats fail closed.',
        'That small test captures the whole security posture.',
      ],
    },
  ],
};
