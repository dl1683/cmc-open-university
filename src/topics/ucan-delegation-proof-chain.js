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
  const nodeCount = 7;
  const edgeCount = 7;
  const tokenFields = ['issuer', 'audience', 'capability', 'proofs', 'expiry'];
  const fieldCount = tokenFields.length;

  yield {
    state: delegationGraph('UCAN delegates capability from one DID to another'),
    highlight: { active: ['owner', 'ucan1', 'agent', 'e-owner-ucan1', 'e-ucan1-agent'], compare: ['ucan2'] },
    explanation: `A UCAN token is a signed edge in an authority graph of ${nodeCount} principals linked by ${edgeCount} edges. The issuer grants a capability over a resource to one audience, usually with time bounds and proof links that explain why the issuer had that authority.`,
  };
  yield {
    state: delegationGraph('Delegation can be attenuated down the chain'),
    highlight: { active: ['agent', 'ucan2', 'worker', 'e-agent-ucan2', 'e-ucan2-worker'], found: ['owner'] },
    explanation: `The delegate can issue a narrower UCAN to another actor. Across all ${edgeCount} edges, the new token should grant no more authority than the proof chain grants to the delegator.`,
    invariant: `Every child capability must be a subset of its proof authority — enforced at each of the ${edgeCount} delegation edges.`,
  };
  yield {
    state: delegationGraph('Invocation carries the capability proof chain'),
    highlight: { active: ['worker', 'invoke', 'resource', 'ucan2', 'e-worker-invoke', 'e-ucan2-invoke', 'e-invoke-resource'], compare: ['owner'] },
    explanation: `To use authority, the worker sends an invocation plus the relevant proof chain. The resource can verify locally across ${nodeCount} nodes instead of calling one central authorization server.`,
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
    explanation: `The data model is compact — ${fieldCount} fields (${tokenFields.join(', ')}) — but the verifier must enforce the meaning of every field. A signed token with a wrong audience or overbroad child capability should fail.`,
  };
}

function* offlineVerification() {
  const vNodeCount = 8;
  const vEdgeCount = 8;
  const comparisonSystems = ['OAuth', 'macaroon', 'UCAN', 'Zanzibar'];
  const systemCount = comparisonSystems.length;

  yield {
    state: verificationGraph('Verification can happen from the packet and proofs'),
    highlight: { active: ['packet', 'proofs', 'sig', 'cap', 'e-packet-proofs', 'e-proofs-sig', 'e-proofs-cap'], compare: ['decision'] },
    explanation: `Local verification means the packet carries enough proof material to decide across ${vNodeCount} verification nodes and ${vEdgeCount} check edges. The verifier walks tokens, checks signatures, checks audience continuity, and proves the requested capability is covered by the chain.`,
  };
  yield {
    state: verificationGraph('Expiry and revocation evidence bound risk'),
    highlight: { active: ['time', 'revoke', 'decision', 'e-time-decision', 'e-revoke-decision'], found: ['cap'] },
    explanation: `Distributed authorization still needs expiry and revocation strategy. Of the ${vEdgeCount} verification edges, the time and revocation paths converge on the decision node. Short expirations reduce stale authority. Revocation proofs can be checked when the application requires them.`,
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
    explanation: `Among ${systemCount} authorization approaches (${comparisonSystems.join(', ')}), UCAN is most natural when users, devices, and agents need to delegate authority without a single always-online authorization database.`,
  };
  yield {
    state: verificationGraph('The decision should still be logged'),
    highlight: { active: ['decision', 'log', 'e-decision-log'], found: ['packet', 'proofs'], compare: ['revoke'] },
    explanation: `Local verification does not mean no observability. Across all ${vNodeCount} nodes in the verification graph, store which proof chain was accepted, which capability was invoked, and which revocation checks were applied.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an authority path. Each node is a principal, meaning an actor with a public key identity, and each edge is a signed token that delegates a capability.',
        {
          type: 'image',
          src: './assets/gifs/ucan-delegation-proof-chain.gif',
          alt: 'Animated walkthrough of the ucan delegation proof chain visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
        'Active edges are the token currently being checked, and visited edges are proofs that have already passed signature, audience, time, and scope checks. The safe inference rule is that a child token is valid only if it is no broader than the parent token that justifies it.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'UCAN stands for User Controlled Authorization Network. It exists for systems where authority must move between users, devices, services, and agents without every decision calling one central authorization server.',
        {
          type: 'callout',
          text: 'A UCAN proof chain moves authority with evidence: each signed edge must be narrower than the authority that justified it.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a bearer token from a central service. Bearer means whoever holds the token can present it, so the resource server either trusts the token directly or checks it with the issuer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that central tokens do not explain a delegation chain. If a worker presents a broad token, the verifier may not know whether the user, a device, or an attacker gave it that authority.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A UCAN proof chain carries authorization evidence with the request. Each token says who issued it, who may use it, what resource and action it covers, when it expires, and which earlier proof gave the issuer that authority.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg',
          alt: 'Directed graph with nodes connected by arrows',
          caption: 'A UCAN delegation chain is an authority graph: principals are nodes, signed capabilities are directed edges, and verification walks the path. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The caller sends the request plus the proof chain. The verifier checks token encoding, cryptographic signatures, issuer-to-audience continuity, expiration, resource scope, action scope, and any required revocation evidence.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/PKI_certificate_hierarchy.svg',
          alt: 'Public key infrastructure certificate hierarchy from root to leaf certificates',
          caption: 'Certificate chains and UCAN proof chains share the same verification pressure: each edge must be signed by an authority accepted by the next verifier. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:PKI_certificate_hierarchy.svg.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because every edge is signed by the key that claims to delegate authority. A copied token is not enough if the request is not from the token\'s audience or if the requested action is outside the token\'s capability.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'UCAN shifts cost from a central lookup to request size and verifier work. A request may carry several tokens, and the verifier must parse them, verify signatures, compare scopes, check clocks, and consult revocation sources when required.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Local-first storage is a natural fit. A device can delegate a narrow file read to a worker while the original user device is offline, and the storage service can verify the proof chain locally.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Revocation is the hard failure mode. A copied proof can be presented until it expires unless the verifier requires fresh revocation evidence, and fresh evidence creates an online dependency.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Alice owns docs://alice/projects/* with read and write authority until Friday. Her laptop receives a UCAN for that folder, then delegates read-only access to docs://alice/projects/chapter-3.md to a rendering worker for 10 minutes.',
        'The worker invokes render at 10:02 with its token and the laptop token as proof. The verifier checks signatures, audiences, expiration, and that read on chapter-3.md is inside read-write on the projects folder.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the UCAN specification and implementation guides, then compare the model with Macaroons, JWT/JWS, OAuth, and capability-security literature. Then study DIDs, public-key signatures, Merkle DAGs, Zanzibar, and distributed tracing.',
      ],
    },
  ],
};
