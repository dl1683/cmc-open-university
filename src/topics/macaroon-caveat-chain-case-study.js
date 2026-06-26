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
      heading: 'How to read the animation',
      paragraphs: [
        'The caveat-chain view follows a macaroon from root secret to final verification. A macaroon is a bearer credential whose signature is updated every time a restriction is added. Active nodes are computing or checking the current link, found nodes have already verified, and compare nodes are restrictions that must match the request.',
        'The third-party-discharge view shows a delegated proof. A discharge macaroon is a separate credential from another service that satisfies one third-party caveat. The safe inference is that a valid final signature proves the caveat list was not weakened, but the request is allowed only if every caveat predicate is also true.',
        {type:'callout', text:'Macaroons make delegation safer by letting any holder add restrictions while making removal cryptographically infeasible.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems often pass credentials through intermediaries. A frontend may need to call storage, storage may need identity proof, and a worker may need only one path for ten minutes. Giving each hop the original broad token creates more authority than the hop needs.',
        'Macaroons exist for attenuation, which means reducing authority. A holder can add caveats such as path, method, time, or required third-party proof without asking the issuer for a new token. The issuer still verifies the whole chain later.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a signed claim token such as a fixed payload with subject, scope, issuer, and expiry. The issuer signs the payload, and the verifier checks the signature before trusting the claims. This is simple when all needed restrictions are known at issue time.',
        'The model is less helpful when a non-issuer needs to narrow a token. If a frontend receives read access for all albums but wants to give a worker access only to album 123, editing the claim breaks the signature. The frontend must call the issuer for a narrower token or pass the overpowered one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a normal signature seals the whole token. Any change to the payload, even a change that removes power, invalidates the signature. A non-issuer does not have the signing secret needed to produce a valid narrower token.',
        'This creates a bad behavior under delegation. Secure narrowing now depends on issuer availability, so teams skip narrowing when the issuer is slow, offline, or outside the local trust boundary. The token format has no monotonic rule that says authority may only decrease as it moves downstream.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A macaroon replaces one sealed signature with a chain of keyed hashes. The issuer starts with HMAC(root_key, identifier). Each caveat updates the running signature with HMAC(previous_signature, caveat), so the final signature commits to every caveat in order.',
        'Appending is easy because the holder has the current signature. Removing is hard because the remover would need to recompute the chain from an earlier point without the root key. That asymmetry makes attenuation local while keeping escalation infeasible under the HMAC assumption.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A macaroon carries an identifier, an ordered caveat list, and a final signature. First-party caveats are predicates the target service can check itself, such as method equals GET or time before 18:00. The verifier recomputes the signature chain and evaluates each predicate against trusted request data.',
        'Third-party caveats ask another service to prove a condition. The client obtains a discharge macaroon from that service and presents it with the root macaroon. The discharge is bound to the root macaroon so it cannot be replayed against a different token.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts. Signature recomputation proves the caveat list was not changed, removed, or reordered because any such edit changes the final HMAC. Predicate evaluation proves the current request satisfies the restrictions that the signature protected.',
        'Monotonic attenuation is the invariant. Each added caveat can only add a condition the verifier must check. A holder can make the token narrower, but it cannot make the verifier forget an earlier condition unless it can forge the HMAC chain.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Verification cost is linear in caveats. A macaroon with 6 first-party caveats needs 6 HMAC updates plus 6 predicate checks after the initial identifier step. Doubling the caveat count roughly doubles verification work and token size, but HMAC itself is usually cheap compared with network calls.',
        'The real cost is policy surface. Every verifier must parse caveats, reject unknown caveats safely, handle time and clock skew, bind discharges, and audit decisions. A token with cheap cryptography can still be unsafe if the caveat language is ambiguous or fail-open.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Macaroons fit systems that need decentralized narrowing of bearer credentials. The Lightning Network implementation lnd uses macaroons for RPC authentication, where operators can derive narrower credentials for read-only, invoice-only, or application-specific access. The access pattern is token delegation across trust boundaries.',
        'They also fit service-to-service cloud authorization when intermediaries should reduce power without sharing issuer secrets. A storage service can require a discharge from an identity service without giving that identity service the storage root key. The token becomes a chain of local restrictions plus external proof.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Macaroons are still bearer tokens. If an attacker steals a valid macaroon and satisfies its caveats, possession is enough. Short expiries, TLS, secure storage, and auditing remain necessary.',
        'They also fail when verifiers ignore caveats they do not understand. An unknown caveat must reject the token; otherwise a restriction becomes decorative text. Revocation is another weak point because the issuer may not know every attenuated token derived offline from a root token.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A storage service mints a root macaroon for account 7042 with identifier sess-a8f3. The frontend adds path = /albums/123, method = GET, and time < 18:10, producing 3 chained HMAC updates. It then gives the result to a resize worker that only needs image bytes for that album.',
        'On request, the storage service recomputes HMAC(root_key, sess-a8f3), then folds in the 3 caveats in order. If the final signature matches but the worker asks for POST or /albums/999, the predicate check rejects the request. If the worker deletes the path caveat, the predicate would pass less work, but the final signature no longer matches.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud" at https://theory.stanford.edu/~ataly/Papers/macaroons.pdf. Production references include lnd macaroon documentation and the libmacaroons and go-macaroon implementations.',
        'Study HMAC before the chaining proof, Capability Security for attenuation, JWT Verification for the sealed-token contrast, OAuth Token Lifecycle for issuer-mediated delegation, and Zanzibar Authorization for a centralized relationship-based alternative. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};