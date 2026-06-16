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
    explanation: 'A UCAN delegation is signed by an issuer and addressed to an audience. It grants a capability over a resource to that audience, often with time bounds and proof links.',
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
    explanation: 'UCAN is designed for local verification. The verifier walks proof tokens, checks signatures, checks audience continuity, and checks that the requested capability is covered.',
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
      heading: 'What it is',
      paragraphs: [
        'UCAN stands for User Controlled Authorization Network. It is a public-key-verifiable capability scheme for distributed and local-first systems. Instead of relying on a central authorization server for every decision, actors carry signed delegation proofs showing which capabilities they received and from whom.',
        'The UCAN working-group specification describes UCAN as a secure, local-first, user-originated distributed authorization scheme with public-key verifiable and delegable capabilities: https://github.com/ucan-wg/spec.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'A UCAN proof chain is a directed graph. Issuers and audiences are principals, often represented by DIDs. Tokens are signed edges. Each edge grants a capability over a resource to an audience, with optional facts such as expiry, nonce, and proofs. Verification walks backward through proof edges until it reaches trusted authority.',
        'This connects Capability Security & Attenuation to Content-Addressed Merkle DAG Object Store and local-first collaboration. The capability says what may be done. The proof chain says why the actor has that capability. Content addressing can identify resources and immutable proof objects.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A user owns a local-first document space. Their phone delegates read/write capability for one folder to their laptop until Friday. The laptop delegates read-only capability for one file to a rendering worker for ten minutes. The worker invokes the render operation with the short UCAN and its proof chain. The document service verifies signatures, audience chain, expiry, resource path, action subset, and revocation evidence before allowing the read.',
        'The important feature is that the worker never receives the user private key and never needs broad account authority. It carries a narrow proof of delegated authority, and the verifier can check it without asking the original phone to be online.',
      ],
    },
    {
      heading: 'Verifier checklist',
      paragraphs: [
        'A practical verifier should check signature validity, issuer and audience continuity, expiration, not-before times when used, capability subset rules, resource namespace rules, proof reachability, and revocation requirements. It should also reject proof chains that are too deep, cyclic, malformed, or based on unsupported capability vocabularies.',
        'The decision record should include the invocation id, accepted proof ids, final capability, verifier version, and revocation source. That makes offline authorization auditable after devices reconnect, which is the operational difference between a neat proof format and a dependable authorization system.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Public-key delegation does not remove policy design. Capabilities still need precise resource names, action vocabularies, attenuation rules, expiry, revocation, and audit logs. A verifier that checks signatures but ignores capability subset semantics is unsafe.',
        'UCAN also does not magically solve every OAuth or Zanzibar use case. Centralized SaaS authorization often needs list APIs, group expansion, administrative revocation, and product-specific policy. UCAN is strongest when offline verification, user-originated delegation, and local-first or peer-to-peer flows matter.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: UCAN working-group specification at https://github.com/ucan-wg/spec, UCAN guide at https://ucan.xyz/guides/getting-started/, and Storacha UCAN concepts at https://docs.storacha.network/concepts/ucan/. Study Capability Security & Attenuation, Macaroon Caveat Chain Case Study, JWT Verification, OAuth PKCE Token Lifecycle Case Study, Content-Addressed Merkle DAG Object Store, Local-First Sync Engine Case Study, and Distributed Tracing next.',
      ],
    },
  ],
};
