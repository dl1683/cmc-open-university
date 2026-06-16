// Capability security: authority as an unforgeable reference, with
// attenuation, membranes, revocation, and confused-deputy resistance.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'capability-security-attenuation',
  title: 'Capability Security & Attenuation',
  category: 'Security',
  summary: 'A primer on capability security: unforgeable references, least authority, delegation, attenuation, revocation, membranes, and confused-deputy resistance.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['object capability', 'attenuation and revocation'], defaultValue: 'object capability' },
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

function capabilityGraph(title) {
  return graphState({
    nodes: [
      { id: 'alice', label: 'alice', x: 0.8, y: 4.0, note: 'caller' },
      { id: 'cap', label: 'cap', x: 2.5, y: 4.0, note: 'unforgeable ref' },
      { id: 'file', label: 'file', x: 4.4, y: 4.0, note: 'object' },
      { id: 'bob', label: 'bob', x: 2.5, y: 2.2, note: 'delegate' },
      { id: 'proxy', label: 'proxy', x: 6.2, y: 4.0, note: 'attenuate' },
      { id: 'log', label: 'audit', x: 8.0, y: 2.2, note: 'trace' },
      { id: 'deny', label: 'deny', x: 8.0, y: 5.7, note: 'no ref' },
    ],
    edges: [
      { id: 'e-alice-cap', from: 'alice', to: 'cap' },
      { id: 'e-cap-file', from: 'cap', to: 'file' },
      { id: 'e-alice-bob', from: 'alice', to: 'bob' },
      { id: 'e-bob-cap', from: 'bob', to: 'cap' },
      { id: 'e-file-proxy', from: 'file', to: 'proxy' },
      { id: 'e-proxy-log', from: 'proxy', to: 'log' },
      { id: 'e-proxy-deny', from: 'proxy', to: 'deny' },
    ],
  }, { title });
}

function revocationGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root cap', x: 0.8, y: 4.0, note: 'full power' },
      { id: 'ro', label: 'read cap', x: 2.7, y: 2.3, note: 'attenuated' },
      { id: 'time', label: 'ttl cap', x: 2.7, y: 5.6, note: 'expires' },
      { id: 'mem', label: 'membrane', x: 4.8, y: 4.0, note: 'wrap graph' },
      { id: 'switch', label: 'switch', x: 6.7, y: 4.0, note: 'live?' },
      { id: 'object', label: 'object', x: 8.5, y: 4.0, note: 'resource' },
      { id: 'revoke', label: 'revoke', x: 6.7, y: 2.2, note: 'flip bit' },
    ],
    edges: [
      { id: 'e-root-ro', from: 'root', to: 'ro' },
      { id: 'e-root-time', from: 'root', to: 'time' },
      { id: 'e-ro-mem', from: 'ro', to: 'mem' },
      { id: 'e-time-mem', from: 'time', to: 'mem' },
      { id: 'e-mem-switch', from: 'mem', to: 'switch' },
      { id: 'e-switch-object', from: 'switch', to: 'object' },
      { id: 'e-revoke-switch', from: 'revoke', to: 'switch' },
    ],
  }, { title });
}

function* objectCapability() {
  yield {
    state: capabilityGraph('Authority is the reference you hold'),
    highlight: { active: ['alice', 'cap', 'file', 'e-alice-cap', 'e-cap-file'], compare: ['deny'] },
    explanation: 'A capability is an unforgeable reference plus the right to send messages through it. If Alice has no reference to the file object, she cannot ask the file to do anything.',
    invariant: 'No reference, no authority.',
  };
  yield {
    state: capabilityGraph('Delegation is introduction, not global ACL editing'),
    highlight: { active: ['alice', 'bob', 'cap', 'e-alice-bob', 'e-bob-cap'], found: ['file'] },
    explanation: 'Delegation happens when a holder passes a reference to another actor. The resource does not need to maintain a global list of every possible subject; authority moves through reference connectivity.',
  };
  yield {
    state: labelMatrix(
      'ACL versus capability framing',
      [
        { id: 'acl', label: 'ACL' },
        { id: 'cap', label: 'capability' },
        { id: 'zanzibar', label: 'Zanzibar' },
        { id: 'token', label: 'bearer token' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'risk', label: 'common risk' },
      ],
      [
        ['who can access object?', 'ambient authority'],
        ['what ref do you hold?', 'leakable if bearer'],
        ['which relation path?', 'stale allow'],
        ['what string grants?', 'theft/replay'],
      ],
    ),
    highlight: { active: ['cap:question'], compare: ['acl:risk', 'token:risk'] },
    explanation: 'Relationship checks, bearer tokens, and object capabilities answer different questions. Capability systems emphasize least authority and explicit connectivity.',
  };
  yield {
    state: capabilityGraph('A proxy can narrow the authority before sharing'),
    highlight: { active: ['file', 'proxy', 'log', 'deny', 'e-file-proxy', 'e-proxy-log', 'e-proxy-deny'], compare: ['cap'] },
    explanation: 'An attenuating proxy can expose only read, only one path, only small writes, or only calls that pass a policy gate. The proxy holds the stronger capability; the delegate receives the weaker one.',
  };
}

function* attenuationAndRevocation() {
  yield {
    state: revocationGraph('Attenuation produces weaker references'),
    highlight: { active: ['root', 'ro', 'time', 'e-root-ro', 'e-root-time'], compare: ['object'] },
    explanation: 'Authority should be shaped before it is handed out. A read-only capability, time-limited capability, path-limited capability, or rate-limited capability is less dangerous than a root capability.',
  };
  yield {
    state: revocationGraph('Membranes wrap a whole reachable object graph'),
    highlight: { active: ['ro', 'time', 'mem', 'switch', 'e-ro-mem', 'e-time-mem', 'e-mem-switch'], found: ['object'] },
    explanation: 'A membrane is a proxy layer around objects reachable through a reference. It can attenuate access deeply, log calls, and enforce revocation across a connected graph.',
  };
  yield {
    state: revocationGraph('Revocation is a switch in the path'),
    highlight: { active: ['revoke', 'switch', 'e-revoke-switch'], removed: ['e-switch-object'], compare: ['object'] },
    explanation: 'Capability revocation is often implemented by interposing a revocable forwarder. Flip the switch, and future calls through that attenuated reference stop, while unrelated references keep working.',
    invariant: 'Revocation is a routing problem when every call passes through the revoker.',
  };
  yield {
    state: labelMatrix(
      'Attenuation patterns',
      [
        { id: 'read', label: 'read only' },
        { id: 'time', label: 'time box' },
        { id: 'path', label: 'path box' },
        { id: 'budget', label: 'budget' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['proxy', 'remove writes'],
        ['expiry field', 'stop later'],
        ['prefix check', 'confine scope'],
        ['counter', 'cap spend'],
        ['trace log', 'explain use'],
      ],
    ),
    highlight: { active: ['read:effect', 'time:effect', 'budget:structure'], found: ['audit:effect'] },
    explanation: 'The data structure is small: proxy pointer, policy fields, counters, expiry, and audit records. The security effect is large because authority is minimized before code receives it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'object capability') yield* objectCapability();
  else if (view === 'attenuation and revocation') yield* attenuationAndRevocation();
  else throw new InputError('Pick a capability-security view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Capability security treats authority as possession of an unforgeable reference. Instead of asking a global table whether subject S may access object O, the system asks whether the actor has a reference that can send the requested message to the object. That reference is the data structure carrying authority.',
        'The object-capability model is especially useful for explaining least authority and confused-deputy resistance. A component should receive only the references it needs for the task. If it never receives a network-sending capability, it cannot exfiltrate through that path no matter what its code says.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The primitive is a directed graph of references. Nodes are actors, objects, proxies, revokers, and resources. Edges are capabilities. Delegation is adding an edge by sending a reference in a message. Attenuation is replacing a powerful edge with a weaker proxy edge. Revocation is routing calls through a switch that can stop forwarding.',
        'This is different from Zanzibar Authorization Case Study, which stores relation tuples and answers graph queries at decision time. It is also different from OAuth PKCE Token Lifecycle Case Study, where bearer access tokens are strings presented to a resource server. Capability security is about explicit connectivity and authority propagation.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a plugin system for a code editor. The editor can hand a formatter plugin a read capability to the current file and a write capability only to a temporary output buffer. The plugin does not receive the workspace root, network, terminal, or credential store. If the plugin is compromised, the attacker gets only the references the plugin was intentionally handed.',
        'Now add a membrane. The editor wraps all returned file objects with a proxy that preserves read-only behavior, logs every path read, and checks a revocation switch. When the plugin is disabled, the switch flips and later calls through that membrane fail. The plugin may still have a stale reference, but it is a reference to a stopped forwarder.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A capability is not automatically safe just because it is called a capability. If it is a bearer URL or token, leakage can transfer authority. If code can reach ambient globals such as unrestricted filesystem or network APIs, the object-capability discipline is broken. If revocation is required, route the delegated reference through a revoker before sharing it.',
        'Another misconception is that capabilities cannot be revoked or confined. The classic Capability Myths Demolished paper argues that many objections come from mixing different capability models rather than reasoning about pure object capabilities.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: Capability Myths Demolished at https://papers.agoric.com/assets/pdf/papers/capability-myths-demolished.pdf, the ERights capability collection at https://www.erights.org/elib/capability/, and Dennis and Van Horn, Programming Semantics for Multiprogrammed Computations, at https://dl.acm.org/doi/10.1145/365230.365252. Study Zanzibar Authorization Case Study, OAuth PKCE Token Lifecycle Case Study, JWT Verification, WebAuthn Passkeys, Macaroon Caveat Chain Case Study, UCAN Delegation Proof Chain, Permissions Policy Feature Gate, LLM Guardrail Policy Engine, Agent Tool Permission Lattice, Seccomp BPF Sandbox Policy, and Prompt Injection Threat Model next.',
      ],
    },
  ],
};
