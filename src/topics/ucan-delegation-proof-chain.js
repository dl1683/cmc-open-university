// UCAN: public-key-verifiable capability delegation chains for distributed
// and local-first authorization.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ucan-delegation-proof-chain',
  title: 'UCAN Delegation Proof Chain',
  category: 'Security',
  summary: 'Model UCAN as a public-key capability chain: issuer DID, audience DID, capability, proofs, invocation, local verification, and revocation evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['delegation chain', 'offline verification'], defaultValue: 'delegation chain' },
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

function delegationGraph(title) {
  return graphState({
    nodes: [
      { id: 'owner', label: 'owner', x: 0.7, y: 4.0, note: 'root key' },
      { id: 'ucan1', label: 'U1', x: 2.5, y: 4.0, note: 'delegate' },
      { id: 'agent', label: 'agent', x: 4.2, y: 4.0, note: 'audience' },
      { id: 'ucan2', label: 'U2', x: 5.9, y: 2.4, note: 'attenuate' },
      { id: 'worker', label: 'worker', x: 7.4, y: 2.4, note: 'audience' },
      { id: 'invoke', label: 'invoke', x: 7.3, y: 5.6, note: 'use cap' },
      { id: 'resource', label: 'resource', x: 9.0, y: 4.0, note: 'allow?' },
    ],
    edges: [
      { id: 'e-owner-ucan1', from: 'owner', to: 'ucan1' },
      { id: 'e-ucan1-agent', from: 'ucan1', to: 'agent' },
      { id: 'e-agent-ucan2', from: 'agent', to: 'ucan2' },
      { id: 'e-ucan2-worker', from: 'ucan2', to: 'worker' },
      { id: 'e-worker-invoke', from: 'worker', to: 'invoke' },
      { id: 'e-ucan2-invoke', from: 'ucan2', to: 'invoke' },
      { id: 'e-invoke-resource', from: 'invoke', to: 'resource' },
    ],
  }, { title });
}

function verificationGraph(title) {
  return graphState({
    nodes: [
      { id: 'packet', label: 'packet', x: 0.8, y: 4.0, note: 'invocation' },
      { id: 'proofs', label: 'proofs', x: 2.5, y: 4.0, note: 'UCAN set' },
      { id: 'sig', label: 'sigs', x: 4.0, y: 2.4, note: 'public keys' },
      { id: 'cap', label: 'cap', x: 4.0, y: 5.6, note: 'resource/action' },
      { id: 'time', label: 'time', x: 5.8, y: 2.4, note: 'expiry' },
      { id: 'revoke', label: 'revoke', x: 5.8, y: 5.6, note: 'proof' },
      { id: 'decision', label: 'decision', x: 7.6, y: 4.0, note: 'allow/deny' },
      { id: 'log', label: 'audit', x: 9.1, y: 4.0, note: 'trace' },
    ],
    edges: [
      { id: 'e-packet-proofs', from: 'packet', to: 'proofs' },
      { id: 'e-proofs-sig', from: 'proofs', to: 'sig' },
      { id: 'e-proofs-cap', from: 'proofs', to: 'cap' },
      { id: 'e-sig-time', from: 'sig', to: 'time' },
      { id: 'e-cap-revoke', from: 'cap', to: 'revoke' },
      { id: 'e-time-decision', from: 'time', to: 'decision' },
      { id: 'e-revoke-decision', from: 'revoke', to: 'decision' },
      { id: 'e-decision-log', from: 'decision', to: 'log' },
    ],
  }, { title });
}

function* delegationChain() {
  yield {
    state: delegationGraph('UCAN delegates capability from one DID to another'),
    highlight: { active: ['owner', 'ucan1', 'agent', 'e-owner-ucan1', 'e-ucan1-agent'], compare: ['ucan2'] },
    explanation: 'A UCAN token is a signed edge in an authority graph. The issuer grants a capability over a resource to one audience, usually with time bounds and proof links that explain why the issuer had that authority.',
  };
  yield {
    state: delegationGraph('Delegation can be attenuated down the chain'),
    highlight: { active: ['agent', 'ucan2', 'worker', 'e-agent-ucan2', 'e-ucan2-worker'], found: ['owner'] },
    explanation: 'The delegate can issue a narrower UCAN to another actor. The new token should grant no more authority than the proof chain grants to the delegator.',
    invariant: 'Every child capability must be a subset of its proof authority.',
  };
  yield {
    state: delegationGraph('Invocation carries the capability proof chain'),
    highlight: { active: ['worker', 'invoke', 'resource', 'ucan2', 'e-worker-invoke', 'e-ucan2-invoke', 'e-invoke-resource'], compare: ['owner'] },
    explanation: 'To use authority, the worker sends an invocation plus the relevant proof chain. The resource can verify locally instead of calling one central authorization server.',
  };
  yield {
    state: labelMatrix(
      'UCAN token fields',
      [
        { id: 'iss', label: 'issuer' },
        { id: 'aud', label: 'audience' },
        { id: 'cap', label: 'capability' },
        { id: 'prf', label: 'proofs' },
        { id: 'exp', label: 'expiry' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'verify', label: 'verify' },
      ],
      [
        ['who signs', 'signature key'],
        ['who receives', 'matches invoker'],
        ['can do what', 'subset check'],
        ['why allowed', 'chain walk'],
        ['how long', 'clock check'],
      ],
    ),
    highlight: { active: ['cap:verify', 'prf:verify', 'aud:verify'] },
    explanation: 'The data model is compact, but the verifier must enforce the meaning of every field. A signed token with a wrong audience or overbroad child capability should fail.',
  };
}

function* offlineVerification() {
  yield {
    state: verificationGraph('Verification can happen from the packet and proofs'),
    highlight: { active: ['packet', 'proofs', 'sig', 'cap', 'e-packet-proofs', 'e-proofs-sig', 'e-proofs-cap'], compare: ['decision'] },
    explanation: 'Local verification means the packet carries enough proof material to decide. The verifier walks tokens, checks signatures, checks audience continuity, and proves the requested capability is covered by the chain.',
  };
  yield {
    state: verificationGraph('Expiry and revocation evidence bound risk'),
    highlight: { active: ['time', 'revoke', 'decision', 'e-time-decision', 'e-revoke-decision'], found: ['cap'] },
    explanation: 'Distributed authorization still needs expiry and revocation strategy. Short expirations reduce stale authority. Revocation proofs can be checked when the application requires them.',
  };
  yield {
    state: labelMatrix(
      'Where UCAN differs',
      [
        { id: 'oauth', label: 'OAuth' },
        { id: 'mac', label: 'macaroon' },
        { id: 'ucan', label: 'UCAN' },
        { id: 'zanzibar', label: 'Zanzibar' },
      ],
      [
        { id: 'center', label: 'center' },
        { id: 'best', label: 'best fit' },
      ],
      [
        ['auth server', 'web/API login'],
        ['issuing service', 'caveat bearer'],
        ['public proofs', 'local-first/P2P'],
        ['relation store', 'fine-grained SaaS'],
      ],
    ),
    highlight: { active: ['ucan:center', 'ucan:best'], compare: ['oauth:center', 'zanzibar:center'] },
    explanation: 'UCAN is most natural when users, devices, and agents need to delegate authority without a single always-online authorization database.',
  };
  yield {
    state: verificationGraph('The decision should still be logged'),
    highlight: { active: ['decision', 'log', 'e-decision-log'], found: ['packet', 'proofs'], compare: ['revoke'] },
    explanation: 'Local verification does not mean no observability. Store which proof chain was accepted, which capability was invoked, and which revocation checks were applied.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'delegation chain') yield* delegationChain();
  else if (view === 'offline verification') yield* offlineVerification();
  else throw new InputError('Pick a UCAN view.');
}

export const article = {
  sections: [
    {
      heading: 'Why Capability Delegation Exists',
      paragraphs: [
        "UCAN stands for User Controlled Authorization Network. It is a way to represent authority as signed, delegable capabilities that can be verified with public keys. The core idea is simple: instead of asking one central authorization service whether an actor may do something, the actor presents a proof chain showing who delegated which capability, to whom, under what limits.",
        "The mechanism exists for systems where authority needs to move across users, devices, agents, and services without every decision depending on an always-online account database. Local-first software is the obvious case. A user may create data on a phone, sync later from a laptop, delegate one file to a collaborator, or let a background worker process an object while the original device is offline. Peer-to-peer systems, content-addressed storage, edge workers, and user-owned data networks have the same pressure.",
        "The naive approach is bearer tokens from a central server. A service issues a token after login, and every resource server checks with the issuer or validates a token minted by that issuer. That works well for many web APIs, but it has a wall. Delegation becomes awkward. Offline verification is weak. Tokens often carry account-level authority instead of narrow task-level authority. A worker may need a user's private key or a broad API credential just to perform one small operation. Revocation and audit are centralized, but so is availability."
      ],
    },
    {
      heading: 'The Core Model',
      paragraphs: [
        "A UCAN proof chain is best understood as a directed graph. Principals are nodes. They are usually identified by DIDs or other public-key identities. Tokens are signed edges. Each edge says that an issuer grants an audience a capability over a resource, possibly with time bounds, facts, nonces, and links to proofs that explain why the issuer had authority to grant it.",
        "The capability is the what: read this object, write this path, upload to this bucket, invoke this service method, or administer this namespace. The proof chain is the why: the owner delegated write access to a laptop, the laptop delegated read-only access to a worker, and the worker is now invoking the read operation. Verification checks that every edge is signed by the previous holder of authority and that every child capability is no broader than the parent capability.",
        "This is capability security with attenuation. Attenuation means authority can become narrower as it moves. A token for store://alice/photos/* with read and write may delegate store://alice/photos/2026/report.jpg with read only for ten minutes. It must not delegate write access to a different path or extend the expiration beyond its parent. If attenuation rules are vague, the chain becomes unsafe even if every signature is valid."
      ],
    },
    {
      heading: 'What A Token Must Mean',
      paragraphs: [
        "The important token fields are issuer, audience, capabilities, proofs, expiration, and sometimes not-before time, nonce, facts, or attached resources. The issuer is the key that signs. The audience is the principal allowed to use or further delegate the token. The capability names the resource and action. Proofs point to earlier UCANs or authority roots. Expiration limits how long the edge remains usable.",
        "A verifier has to enforce the meaning of all of these fields. Signature verification alone is not authorization. A signed token with the wrong audience should fail because it was not issued to the invoker. A signed token with a child capability outside its parent should fail because it expands authority. A signed token past expiration should fail even if the chain was valid yesterday. A token using an unsupported capability vocabulary should fail because the verifier cannot safely interpret it.",
        "Resource naming is a major design decision. If resources are content-addressed, the capability may point to immutable data by CID. If resources are paths, the system needs clear path containment rules. If resources are logical objects, the verifier needs a namespace model. Many authorization bugs come from strings that look hierarchical but are not compared with a precise grammar."
      ],
    },
    {
      heading: 'Local Verification',
      paragraphs: [
        "To invoke a capability, the caller sends a request plus the relevant proof chain. The resource server or peer verifier walks the chain. It checks token encoding, cryptographic signatures, issuer-to-audience continuity, time bounds, resource scope, action scope, and any revocation or caveat requirements required by the application. If the chain reaches a trusted root and covers the requested action, the verifier can allow the operation without asking the original issuer to be online.",
        "That offline property is the main distinction. A service can accept a narrow proof from a worker because the proof carries its own authority story. The worker does not need the user's private key. The user does not need to be online. The central service does not need to evaluate every delegation in real time. The verifier still needs trust roots and policy, but the proof material travels with the invocation.",
        "Local verification should be bounded. Proof chains need maximum depth. Token sizes need limits. The verifier should detect cycles and repeated proofs. Capability parsing should be deterministic. Revocation checks must have a defined freshness rule. Without those bounds, an attacker can turn authorization into a CPU, memory, or network exhaustion path."
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "The delegation-chain view teaches that UCAN is an authority graph, not a session flag. The owner, agent, worker, and resource are nodes. The UCANs are signed edges. The important movement is attenuation: the second token must be narrower than the first, and the invocation must carry enough proof for the resource to verify that path.",
        "The offline-verification view teaches the verifier's checklist. Proofs feed signature checks and capability checks. Time and revocation evidence feed the decision. The audit node is part of the model because local authorization still needs an explanation after the fact. A resource that only checks signatures but ignores capability scope, audience continuity, or expiry is accepting a picture of authority, not authority itself."
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        "The approach works because each delegation is bound to a public key and a specific audience. A copied token is not enough if the invoker cannot prove control of the audience key or if the request does not match the delegated capability. The proof chain explains provenance: the verifier can see that the authority came from an owner or trusted root through a sequence of narrower grants.",
        "It also works because attenuation makes least authority practical. A user can grant a device broad access, the device can grant a worker narrow access, and the worker can complete one task without ever seeing broader credentials. The invariant is simple: each child token must fit inside the parent authority that justifies it. If that invariant holds, delegation can move without turning every delegate into the owner."
      ],
    },
    {
      heading: 'Revocation And Time',
      paragraphs: [
        "Distributed delegation makes revocation harder. A central authorization server can remove a permission from its database and every future online check sees the change. UCAN-style proofs can be copied and presented elsewhere. If a verifier accepts old proofs without fresh revocation evidence, authority may survive longer than the user expects.",
        "Short expiration is the simplest mitigation. A ten-minute worker token limits damage even if copied. Parent capabilities can also be short-lived, forcing periodic refresh from the authority holder. For higher-risk operations, the application can require revocation evidence: a status proof, a signed revocation list, a transparency log checkpoint, or a service lookup. The right design depends on the cost of stale authority and the availability requirements of the system.",
        "There is no free revocation. Stronger freshness usually means more online dependency. Offline operation usually means accepting some window of stale authority. The security model should state that window plainly. For example: read-only render worker tokens last ten minutes and require no online revocation check; admin tokens last one minute and require a fresh status proof; storage delete operations require live verification."
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        "UCAN trades a central lookup for larger request packets and more verifier logic. The invocation may need to carry several proof tokens. The verifier must parse them, resolve keys, check signatures, enforce resource grammar, evaluate attenuation, and decide whether revocation evidence is fresh enough. That is more work than checking one opaque server-side session id.",
        "The tradeoff is offline delegation and narrower authority. If every request already reaches one trusted service and immediate revocation is mandatory, a central policy engine may be simpler. If users, devices, edge workers, and peer services need to operate while disconnected, portable proof chains can be worth the extra protocol surface."
      ],
    },
    {
      heading: 'Concrete Case Study',
      paragraphs: [
        "A user owns a local-first document workspace. Their phone is the initial authority for did:alice and controls the root document space. The phone delegates read and write access for docs://alice/projects/thesis/* to the user's laptop until Friday. The laptop delegates read-only access for docs://alice/projects/thesis/chapter-3.md to a rendering worker for ten minutes. The worker invokes render with its short token and includes the laptop token as proof.",
        "The document service verifies the worker signature, checks that the worker is the audience of the short token, checks that the laptop signed that token, checks that the laptop was the audience of the parent token, and checks that both tokens are still valid. Then it verifies attenuation: read on chapter-3.md is within read/write on the thesis folder. It checks revocation freshness according to the operation's risk tier. If all checks pass, it allows the read needed for rendering and records the accepted proof ids.",
        "The security win is not that UCAN is cryptographically fancy. The win is that the worker never received account-level credentials, never received the user's private key, and could not write or read other files if compromised. The proof is narrow, inspectable, and portable. The user can delegate through devices without turning every device into a central authority server."
      ],
    },
    {
      heading: 'Where It Fits And Where It Fails',
      paragraphs: [
        "UCAN is a natural fit for local-first applications, user-owned storage, content-addressed networks, device-to-device delegation, edge execution, and agent workflows where a user wants to grant a bounded task to another process. It is also useful when audit needs to show the exact authority path behind an operation.",
        "It is not a drop-in replacement for every centralized authorization system. Large SaaS products often need group expansion, search over all resources a user can access, administrative override, immediate revocation, billing-aware policy, and relationship queries. Zanzibar-style systems are designed for that relation-store problem. OAuth remains a strong fit for web login and third-party API consent. Macaroons are useful for caveat-bearing bearer tokens. UCAN's strength is public-key, user-originated, delegable proof chains.",
        "Operational signals should focus on verifier behavior. Track denial reasons, unsupported capability types, expired token rate, proof-chain depth, revocation-check latency, revocation freshness, token size, and audit coverage. Sample accepted chains for overbroad delegation. Test malicious chains with cycles, wrong audience, wrong issuer, path confusion, parent-child scope expansion, expired parents, and missing revocation evidence. The verifier is the product; the token format only gives it material to reason about."
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        "Define the capability grammar before building token plumbing. Write down the resource URI rules, action vocabulary, subset relation, expiry policy, accepted issuers, supported DID methods, revocation sources, maximum chain depth, maximum token size, and clock-skew tolerance. Then build tests that try to escape each boundary.",
        "The verifier should produce structured denial reasons: bad signature, wrong audience, unsupported capability, expired parent, child broader than parent, missing proof, stale revocation evidence, and malformed resource. Those reasons make audits useful and help operators distinguish an attacker from a broken client. Store accepted proof ids and verifier version with the decision so future incident review can replay the same chain."
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        "Primary sources are the UCAN working-group specification, UCAN guides, and implementations used by distributed storage projects. The next topics to study are capability security and attenuation, macaroon caveat chains, JWT/JWS verification, OAuth PKCE, Zanzibar authorization, content-addressed Merkle DAGs, local-first sync engines, and distributed tracing. Those topics clarify the design space: bearer tokens versus proof chains, centralized relation checks versus portable capabilities, and online revocation versus offline delegation."
      ],
    },
  ],
};
