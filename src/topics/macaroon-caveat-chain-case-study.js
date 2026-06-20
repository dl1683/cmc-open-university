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
        'The caveat-chain view traces the life of a macaroon from root secret to verified request. Active nodes are the current operation: key derivation, caveat attachment, or signature check. Found nodes are steps whose cryptographic contract is already satisfied. Compare nodes are constraints not yet evaluated.',
        {
          type: 'bullets',
          items: [
            'Root key to mac: the service mints a bearer credential by computing HMAC(root_key, identifier).',
            'Mac to caveats: each caveat rewrites the running signature. The arrow direction matters -- caveats chain forward, never backward.',
            'Caveats to sig: the final signature commits to every caveat in order. Deleting one changes the hash.',
            'Sig to verify: the verifier recomputes the entire chain from the root secret and compares.',
          ],
        },
        'The third-party-discharge view traces a cross-service proof. The storage service delegates an identity check to an authorization service. The client collects a discharge token, binds it to the root macaroon, and presents both. Watch the bind node: it prevents the discharge from being replayed against a different root token.',
        {type:'callout', text:'Macaroons make delegation safer by letting any holder add restrictions while making removal cryptographically infeasible.'},
        {
          type: 'note',
          text: 'If an edge is active, the cryptographic state is changing. If a node is found, the verifier has confirmed that link. If a node is in compare state, it is a constraint the request has not yet satisfied.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems hand credentials to intermediaries constantly. A web frontend passes a token to a CDN. A CDN passes it to a storage backend. A storage backend passes it to a billing service. At each hop, the intermediary holds more authority than it needs. The security question is: can the delegator narrow the token before handing it off, without calling the original issuer?',
        {
          type: 'quote',
          text: 'Macaroons are flexible authorization credentials for Cloud services that support decentralized delegation between principals. Macaroons are based on a construction that uses nested, chained MACs in a manner similar to the way cookies are used on the Web.',
          attribution: 'Birgisson, Politz, Erlingsson, Taly, Vrable, Lentczner -- "Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud" (NDSS 2014)',
        },
        'A JWT or OAuth token is sealed at issue time. Its claims are fixed. If a photo service issues a token granting read access to all albums, and the frontend only needs album 123 for the next ten minutes, the frontend must either use the overpowered token or ask the issuer for a narrower one. Macaroons solve this by letting any holder append restrictions -- caveats -- that the verifier must enforce, without any round trip to the issuer.',
        {
          type: 'note',
          text: 'The name "macaroon" is a play on "cookie." Both are bearer credentials. The difference is that a macaroon carries a chain of restrictions that any holder can extend but nobody can remove.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard approach to authorization tokens is a signed claim set. The issuer decides the full set of permissions at mint time, signs them, and the verifier checks the signature and reads the claims.',
        {
          type: 'code',
          language: 'json',
          text: [
            '{',
            '  "sub": "user-7042",',
            '  "scope": "read:albums",',
            '  "exp": 1718745600,',
            '  "iss": "photos.example.com"',
            '}',
          ].join('\n'),
          label: 'A typical JWT payload: claims fixed at issue time',
        },
        'This works when the issuer knows exactly what authority is needed. It breaks in three scenarios:',
        {
          type: 'bullets',
          items: [
            'Downstream narrowing: the frontend needs to pass a token to a thumbnail worker that should only access one album, one HTTP method, for five minutes. The JWT grants read:albums with no path restriction. The frontend cannot narrow it.',
            'Offline delegation: a mobile client collects a token while online but needs to hand a restricted version to an offline peer. Minting a new token requires the issuer to be reachable.',
            'Cross-service proof: the storage service needs the client to prove identity through a separate auth service, but the storage service does not want to share its root secret with the auth service.',
          ],
        },
        'The workaround is to call the issuer for a new, narrower token at every delegation point. That couples every hop to the issuer, adds latency, and fails when the issuer is unreachable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Signed tokens are sealed envelopes. The signature covers the entire claim set, so modifying any claim -- even to reduce authority -- invalidates the token. There is no cryptographic mechanism for a non-issuer to produce a valid token with fewer permissions.',
        {
          type: 'diagram',
          text: [
            '  Issuer mints:  {scope: "read:albums", exp: 1h}  sig=HMAC(secret, claims)',
            '       |',
            '       v',
            '  Frontend receives token. Needs to narrow:',
            '       scope: "read:albums/123"   method: GET   exp: 10m',
            '       |',
            '       X  Cannot re-sign: does not have the secret',
            '       X  Cannot edit claims: signature breaks',
            '       X  Cannot append: no chaining mechanism',
            '       |',
            '       v',
            '  Must call issuer for a new token  -->  latency + availability dependency',
          ].join('\n'),
          label: 'The wall: sealed signatures prevent non-issuer attenuation',
        },
        'The invariant that breaks is: authority can only decrease along a delegation chain, and it should be possible without the issuer. Sealed tokens cannot satisfy this because their signature scheme has no concept of additive restriction.',
        {
          type: 'note',
          text: 'This is not a flaw in JWTs. JWTs were designed for a different threat model where the issuer is always reachable and claims are known at mint time. The wall appears specifically when you need decentralized, offline-capable attenuation.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Macaroons replace a single signature with a chain of HMACs. Each caveat is folded into the running signature, so the signature after n caveats commits to every caveat before it. Anyone can extend the chain -- appending a caveat only requires the current signature, not the root secret -- but nobody can shorten it without recomputing from the root.',
        {
          type: 'code',
          language: 'text',
          text: [
            'sig_0 = HMAC(root_key, identifier)',
            'sig_1 = HMAC(sig_0, caveat_1)        // e.g. "path = /albums/123"',
            'sig_2 = HMAC(sig_1, caveat_2)        // e.g. "method = GET"',
            'sig_3 = HMAC(sig_2, caveat_3)        // e.g. "time < 2026-06-19T18:00Z"',
            '',
            'macaroon = { identifier, [caveat_1, caveat_2, caveat_3], sig_3 }',
          ].join('\n'),
          label: 'Chained HMAC: each caveat updates the running signature',
        },
        'This is monotonic attenuation. The holder can only make the credential weaker. Adding a caveat is easy: compute HMAC(current_sig, new_caveat) and append. Removing a caveat is hard: it requires the previous signature, which requires either the root secret or the ability to invert HMAC.',
        {
          type: 'table',
          headers: ['Operation', 'Who can do it', 'Why'],
          rows: [
            ['Mint root macaroon', 'Service (holds root key)', 'sig_0 = HMAC(root_key, id) requires the root secret'],
            ['Add a caveat', 'Any holder', 'Only needs current sig, not root key'],
            ['Remove a caveat', 'Nobody (without root key)', 'Recomputing the chain requires the root secret'],
            ['Verify the chain', 'Service (holds root key)', 'Recomputes from root_key through all caveats, compares final sig'],
          ],
        },
        {
          type: 'note',
          text: 'The asymmetry is the whole point. Extending authority is hard (needs root key). Restricting authority is easy (needs current signature). This is the opposite of most systems where granting is easy and restricting requires policy changes.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A macaroon has three parts: an identifier (opaque to the holder, meaningful to the issuer), an ordered list of caveats, and a signature. The identifier lets the verifier look up the root key. The caveats are predicates. The signature proves the chain is intact.',
        {
          type: 'diagram',
          text: [
            '  Macaroon structure:',
            '  +--------------------------------------------------+',
            '  | identifier: "session-a8f3e2"                     |',
            '  |                                                  |',
            '  | caveats:                                         |',
            '  |   [0] "account = acct-7042"        (first-party) |',
            '  |   [1] "path startsWith /albums/123" (first-party)|',
            '  |   [2] "method = GET"                (first-party)|',
            '  |   [3] "time < 2026-06-19T18:00Z"   (first-party) |',
            '  |   [4] third-party: authz.example    (third-party)|',
            '  |                                                  |',
            '  | signature: 7c9a...f2e1 (HMAC chain output)       |',
            '  +--------------------------------------------------+',
          ].join('\n'),
          label: 'Anatomy of a macaroon with four first-party and one third-party caveat',
        },
        'First-party caveats are predicates the target service evaluates against trusted request context: the clock, the URL, the HTTP method, the authenticated account. The verifier parses each caveat string, matches it against a known predicate type, and checks it against the request.',
        'Third-party caveats delegate one check to another service. The macaroon says "this token is valid only if authz.example supplies a discharge macaroon proving the user is logged in." The holder must collect that discharge, bind it to the root macaroon, and present both.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Verification pseudocode',
            'function verify(macaroon, rootKey, discharges, request) {',
            '  let sig = hmac(rootKey, macaroon.identifier);',
            '  for (const caveat of macaroon.caveats) {',
            '    if (caveat.isFirstParty) {',
            '      sig = hmac(sig, caveat.predicate);',
            '      if (!evaluatePredicate(caveat, request)) return DENY;',
            '    } else {',
            '      const discharge = findDischarge(discharges, caveat);',
            '      if (!discharge) return DENY;',
            '      sig = hmac(sig, caveat.verificationKeyId);',
            '      if (!verifyDischarge(discharge, caveat, macaroon.signature))',
            '        return DENY;',
            '    }',
            '  }',
            '  if (sig !== macaroon.signature) return DENY;',
            '  return ALLOW;',
            '}',
          ].join('\n'),
          label: 'The verifier recomputes the HMAC chain and evaluates every predicate',
        },
        {
          type: 'note',
          text: 'The signature check and the predicate checks are both required. The signature proves the caveat list was not tampered with. The predicate checks prove the current request satisfies the caveats. Passing one without the other is not verification.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties of HMAC chaining.',
        {
          type: 'bullets',
          items: [
            'Tamper evidence: HMAC is a pseudorandom function. Changing, removing, or reordering any caveat in the chain produces a different final signature. The verifier, who holds the root key, recomputes the chain independently and rejects mismatches.',
            'Monotonic attenuation: appending a caveat only requires the current signature, not the root key. But shortening the chain requires recomputing from the root. Since HMAC is not invertible without the key, a holder cannot remove caveats.',
          ],
        },
        'The authorization model adds a second layer: predicate truth. Even if the signature is valid, the verifier evaluates every caveat against trusted request data. A macaroon with "time < 5pm" and a valid signature is still rejected at 6pm.',
        {
          type: 'table',
          headers: ['Check', 'What it proves', 'Failure mode if skipped'],
          rows: [
            ['Signature recomputation', 'Caveat list was not weakened or altered', 'Attacker removes caveats, gains broader authority'],
            ['Predicate evaluation', 'Current request satisfies all restrictions', 'Expired or out-of-scope requests are accepted'],
            ['Discharge verification', 'Third-party conditions were met', 'Cross-service checks are bypassed entirely'],
            ['Discharge binding', 'Discharge is tied to this specific root token', 'Discharge is replayed across unrelated tokens'],
          ],
        },
        {
          type: 'quote',
          text: 'Because macaroons use chained HMAC, adding a caveat is a one-way operation: it can be performed by anyone holding the macaroon, but it cannot be undone without knowledge of the root key.',
          attribution: 'Birgisson et al., NDSS 2014',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A photo storage service issues a root macaroon to a web frontend. The frontend needs to delegate a narrow slice of authority to an image-resizing worker.',
        {
          type: 'table',
          headers: ['Step', 'Actor', 'Action', 'Macaroon state'],
          rows: [
            ['1', 'Storage service', 'Mint root macaroon for user acct-7042', 'id="sess-a8f3", caveats=[], sig=HMAC(root, id)'],
            ['2', 'Frontend', 'Add caveat: path startsWith /albums/123', 'caveats=[path], sig=HMAC(sig_0, path)'],
            ['3', 'Frontend', 'Add caveat: method = GET', 'caveats=[path, method], sig=HMAC(sig_1, method)'],
            ['4', 'Frontend', 'Add caveat: time < now+10min', 'caveats=[path, method, time], sig=HMAC(sig_2, time)'],
            ['5', 'Frontend', 'Hand attenuated macaroon to resize worker', 'Worker holds a token that can only GET /albums/123 for 10 minutes'],
            ['6', 'Worker', 'Present macaroon to storage service', 'Service recomputes chain, checks all 3 predicates'],
          ],
        },
        'The worker cannot escalate. It holds a macaroon with three caveats, and removing any one would change the signature. The storage service verifies by recomputing HMAC(root_key, id), then chaining through path, method, and time caveats, then comparing the final signature. If all match and the predicates pass against the request, the worker gets the bytes.',
        'Now add a third-party caveat. The storage service wants proof that the user is logged in, but it does not run an identity service.',
        {
          type: 'diagram',
          text: [
            '  Storage              Frontend            AuthZ Service',
            '    |                     |                      |',
            '    |-- root macaroon --->|                      |',
            '    |  (+ 3rd-party       |                      |',
            '    |   caveat: ask       |                      |',
            '    |   authz.example)    |                      |',
            '    |                     |--- prove identity -->|',
            '    |                     |                      |',
            '    |                     |<-- discharge token --|',
            '    |                     |                      |',
            '    |                     | bind(discharge,      |',
            '    |                     |      root_mac.sig)   |',
            '    |                     |                      |',
            '    |<-- root_mac +       |                      |',
            '    |    bound discharge  |                      |',
            '    |                     |                      |',
            '    | verify root chain   |                      |',
            '    | verify discharge    |                      |',
            '    | check binding       |                      |',
            '    | evaluate predicates |                      |',
            '    | --> ALLOW or DENY   |                      |',
          ].join('\n'),
          label: 'Third-party discharge flow: storage never shares its root secret with the auth service',
        },
        'The binding step is critical. Without it, a discharge collected for one macaroon could be replayed against a different root token. The bind operation typically hashes the discharge signature with the root macaroon signature, producing a value that is only valid for this specific pair.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Macaroon verification is cheap in CPU but expensive in design surface.',
        {
          type: 'table',
          headers: ['Cost', 'Magnitude', 'What drives it'],
          rows: [
            ['Signature check', 'O(n) HMAC calls, n = number of caveats', 'Each caveat requires one HMAC. 5 caveats = 5 HMAC calls, sub-microsecond total'],
            ['Predicate evaluation', 'O(n) predicate checks', 'Each predicate is a comparison against request context: clock, URL, method'],
            ['Discharge verification', 'O(d) per discharge', 'Each third-party caveat adds one discharge to verify, each with its own chain'],
            ['Token size', 'Grows linearly with caveats', 'Each caveat adds its string plus HMAC overhead. Tens of caveats are fine; thousands are a design smell'],
            ['Verifier complexity', 'High', 'Must implement a caveat parser, predicate registry, clock handling, discharge binding, and fail-closed logic'],
          ],
        },
        'The runtime cost is negligible. HMAC-SHA256 runs at millions of operations per second. The real cost is the verification code: every service that accepts macaroons must implement a correct caveat language, handle unknown caveats safely, manage clock skew, and audit decisions.',
        {
          type: 'note',
          text: 'Adding a caveat is free for the holder: one HMAC call, no network round trip. This is the economic insight. Attenuation is cheap, so it gets used. When attenuation is expensive (call the issuer, wait for a response), it gets skipped, and over-privileged tokens proliferate.',
        },
        'Third-party caveats add availability cost. The client must contact the third-party service to collect a discharge before presenting the macaroon. If the auth service is down, the token is unusable even if its signature and first-party caveats are valid.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'How macaroons are used', 'Why the fit is good'],
          rows: [
            ['Google (original paper)', 'Authorization across internal cloud services', 'Services delegate narrow credentials to intermediaries without sharing root secrets'],
            ['Lightning Network (lnd)', 'API authentication for Lightning node RPCs', 'Operators mint admin macaroons, then attenuate to read-only or invoice-only for apps'],
            ['Hyperdex/HyperDex', 'Distributed data store authorization', 'Caveats restrict operations per-key-range without centralized policy'],
            ['Charm (Go library)', 'General-purpose auth in Go microservices', 'First-party caveats for path/method/time, third-party for cross-service identity'],
            ['Loop (Lightning Labs)', 'Submarine swap authorization', 'Attenuated credentials for swap-specific operations with time bounds'],
          ],
        },
        'The Lightning Network is the most visible production deployment. Every lnd node uses macaroons as its authentication system. The admin macaroon grants full control. Operators derive narrower macaroons -- read-only, invoice-only, specific-IP-only -- by appending caveats, then hand those to wallet apps or monitoring tools.',
        {
          type: 'code',
          language: 'bash',
          text: [
            '# lnd: bake a read-only macaroon with IP restriction',
            'lncli bakemacaroon info:read offchain:read onchain:read \\',
            '  --save_to readonly.macaroon',
            '',
            '# Add a caveat restricting to a specific IP (using macaroon-bakery)',
            '# The resulting token can only be used from 10.0.0.5',
            '# and cannot read invoices or send payments',
          ].join('\n'),
          label: 'Lightning Network lnd: operators attenuate macaroons per-application',
        },
        'Macaroons fit when: (1) the token crosses trust boundaries, (2) intermediaries need less authority than the original grant, (3) calling the issuer for every narrowing is too slow or unavailable, and (4) the verifier can implement a caveat language.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Macaroons are bearer credentials. Stealing the token is stealing the authority. Every caveat is a policy input, not a comment.',
        {
          type: 'table',
          headers: ['Failure', 'Mechanism', 'Mitigation'],
          rows: [
            ['Token theft', 'Bearer credential: possession = authority', 'Short expiry, TLS everywhere, secure storage, audit logging'],
            ['Unknown caveat ignored', 'Verifier skips caveat types it does not recognize', 'Fail closed: reject any macaroon with an unknown caveat type'],
            ['Clock skew', 'Time-based caveats checked against divergent clocks', 'NTP sync, bounded skew tolerance, prefer short windows'],
            ['No revocation', 'Macaroons have no built-in revocation channel', 'Short TTL, server-side token denylist, discharge expiry'],
            ['Discharge replay', 'Discharge used against a different root token', 'Bind discharge to root signature before presenting'],
            ['Caveat parser bugs', 'String parsing errors accept overly broad predicates', 'Typed predicate registry, not string matching'],
          ],
        },
        {
          type: 'note',
          text: 'The most dangerous mistake is treating unknown caveats as "not my problem." If the verifier silently ignores a caveat it does not understand, the attenuation is decorative. The token passes verification with broader authority than intended. Fail-closed is the only safe default.',
        },
        'Revocation is the structural weakness. Because any holder can extend a macaroon offline, the issuer has no way to enumerate all derived tokens. Revoking the root key invalidates every macaroon derived from it, including valid ones. There is no surgical revocation of a single derived credential without a server-side denylist.',
        {
          type: 'bullets',
          items: [
            'Macaroons are the wrong tool when policy is fully centralized and the issuer is always reachable.',
            'They are the wrong tool when immediate, global revocation of individual credentials is required.',
            'They are the wrong tool when verifiers cannot implement a safe caveat parser -- a sloppy parser is worse than no attenuation.',
            'They add unnecessary complexity when tokens never need downstream narrowing.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Birgisson et al., "Macaroons: Cookies with Contextual Caveats" (NDSS 2014)', 'Original paper: construction, formal model, Google deployment experience'],
            ['Stanford copy: theory.stanford.edu/~ataly/Papers/macaroons.pdf', 'Same paper, stable academic link'],
            ['lnd documentation: docs.lightning.engineering', 'Production macaroon deployment in Lightning Network nodes'],
            ['libmacaroons (C library by Robert Escriva)', 'Reference implementation of the core HMAC chaining construction'],
            ['go-macaroon (Go library)', 'Idiomatic Go implementation with third-party caveat support'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Hash Table -- understand HMAC as a keyed hash before reasoning about chaining.',
            'Prerequisite: Capability Security and Attenuation -- the authorization model macaroons implement.',
            'Extension: UCAN Delegation Proof Chain -- public-key delegation chains, a different answer to the same problem.',
            'Contrast: JWT Verification -- sealed claim sets, the approach macaroons replace for attenuable credentials.',
            'Related: OAuth PKCE Token Lifecycle Case Study -- ecosystem-level authorization flow.',
            'Related: Zanzibar Authorization Case Study -- centralized relationship-based authorization, a different architecture.',
          ],
        },
      ],
    },
  ],
};

