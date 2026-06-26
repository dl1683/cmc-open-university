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
  const capGraph = capabilityGraph('Authority is the reference you hold');
  const capNodes = capGraph.graph.nodes;
  yield {
    state: capGraph,
    highlight: { active: ['alice', 'cap', 'file', 'e-alice-cap', 'e-cap-file'], compare: ['deny'] },
    explanation: `A capability fuses two facts: Alice holds this unforgeable reference, and messages through it are allowed. The graph has ${capNodes.length} nodes — without an edge to the file, it is unreachable no matter what Alice can name.`,
    invariant: `No reference among the ${capNodes.length} nodes means no authority.`,
  };
  const delegateHighlight = { active: ['alice', 'bob', 'cap', 'e-alice-bob', 'e-bob-cap'], found: ['file'] };
  yield {
    state: capabilityGraph('Delegation is introduction, not global ACL editing'),
    highlight: delegateHighlight,
    explanation: `Delegation adds a graph edge by sending the reference to Bob — ${delegateHighlight.active.filter(a => !a.startsWith('e-')).length} actors are now connected. The file does not edit a global access list; authority moves only along references that existing holders choose to share.`,
  };
  const authModels = [
    { id: 'acl', label: 'ACL' },
    { id: 'cap', label: 'capability' },
    { id: 'zanzibar', label: 'Zanzibar' },
    { id: 'token', label: 'bearer token' },
  ];
  yield {
    state: labelMatrix(
      'ACL versus capability framing',
      authModels,
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
    explanation: `These ${authModels.length} models (${authModels.map(m => m.label).join(', ')}) store authority in different places. ACLs ask a table about subjects, bearer tokens ask whether a string is accepted, and capabilities ask whether this actor actually holds a connected reference.`,
  };
  const proxyHighlight = { active: ['file', 'proxy', 'log', 'deny', 'e-file-proxy', 'e-proxy-log', 'e-proxy-deny'], compare: ['cap'] };
  yield {
    state: capabilityGraph('A proxy can narrow the authority before sharing'),
    highlight: proxyHighlight,
    explanation: `Attenuation narrows authority before sharing. With ${proxyHighlight.active.filter(a => !a.startsWith('e-')).length} nodes active in the proxy path, the proxy keeps the stronger file capability behind it and hands out only the operations, path, budget, or policy gate the delegate should have.`,
  };
}

function* attenuationAndRevocation() {
  const attenHighlight = { active: ['root', 'ro', 'time', 'e-root-ro', 'e-root-time'], compare: ['object'] };
  yield {
    state: revocationGraph('Attenuation produces weaker references'),
    highlight: attenHighlight,
    explanation: `The safe move is to mint the weakest useful reference first. The root splits into ${attenHighlight.active.filter(a => !a.startsWith('e-')).length} active nodes — a read-only, time-limited, path-limited, or rate-limited capability reduces the blast radius before untrusted code ever runs.`,
  };
  const membraneHighlight = { active: ['ro', 'time', 'mem', 'switch', 'e-ro-mem', 'e-time-mem', 'e-mem-switch'], found: ['object'] };
  yield {
    state: revocationGraph('Membranes wrap a whole reachable object graph'),
    highlight: membraneHighlight,
    explanation: `A membrane wraps not just one object but the objects reached through it — ${membraneHighlight.active.filter(a => !a.startsWith('e-')).length} nodes and ${membraneHighlight.active.filter(a => a.startsWith('e-')).length} edges form the wrapping path. That keeps the attenuation invariant alive when calls return more references.`,
  };
  const revokeHighlight = { active: ['revoke', 'switch', 'e-revoke-switch'], removed: ['e-switch-object'], compare: ['object'] };
  yield {
    state: revocationGraph('Revocation is a switch in the path'),
    highlight: revokeHighlight,
    explanation: `Capability revocation is often implemented by interposing a revocable forwarder. The ${revokeHighlight.removed.length} removed edge (${revokeHighlight.removed.join(', ')}) shows the cut — flip the switch, and future calls through that attenuated reference stop, while unrelated references keep working.`,
    invariant: `Revocation is a routing problem — ${revokeHighlight.active.filter(a => !a.startsWith('e-')).length} active nodes gate every call through the revoker.`,
  };
  const patternRows = [
    { id: 'read', label: 'read only' },
    { id: 'time', label: 'time box' },
    { id: 'path', label: 'path box' },
    { id: 'budget', label: 'budget' },
    { id: 'audit', label: 'audit' },
  ];
  yield {
    state: labelMatrix(
      'Attenuation patterns',
      patternRows,
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
    explanation: `The implementation offers ${patternRows.length} attenuation patterns (${patternRows.map(r => r.label).join(', ')}) — each is small state on a forwarding edge: target pointer, policy fields, counters, expiry, and audit records. The security effect comes from giving code a weaker edge instead of trusting it to self-limit.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The "object capability" view builds a directed graph of actors, references, and resources, then shows delegation and attenuation as graph operations. The "attenuation and revocation" view shows a root capability being split into weaker references, wrapped by a membrane, and cut by a revocation switch.',
        {type: "callout", text: "Authority is safe only when it travels through explicit unforgeable references rather than ambient reachability."},
        'Active (highlighted) nodes are the current focus of the operation. Found nodes are outcomes now established. Compare nodes show what is excluded or contrasted. At each frame, ask: what edge was added or removed, and why does that change what the actor can do?',
        {type: 'image', src: './assets/gifs/capability-security-attenuation.gif', alt: 'Animated walkthrough of the capability security attenuation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most security bugs are not caused by code that needs zero authority. They are caused by code that receives far more authority than the current task requires. A markdown previewer needs to read one document, but it inherits the entire filesystem, credential store, and network of the process that launched it. A single bug or malicious dependency in that previewer can exercise power that had nothing to do with rendering markdown.',
        'Capability security exists to make authority concrete and narrow. Instead of granting power through ambient process-level privileges, the system hands each component an unforgeable reference that exposes only the operations that component needs. If a component never receives a reference to a resource, it has no path to that resource, period. The security question becomes structural: which references did this code receive, and how narrow are the operations behind them?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The usual first design is an access-control list (ACL). Each protected resource has a table mapping users, groups, or roles to allowed operations. On every call, the system checks whether the caller\'s identity appears in the table. This works well for durable authorization: a document service genuinely needs to answer whether user 123 can comment on document 456 based on team membership, folder hierarchy, or sharing relation.',
        'But ACLs become awkward for local, temporary delegation. Suppose Alice has a file handle and wants Bob, an untrusted plugin, to format exactly that file. Editing a global permission table for this one interaction is overkill. Bob may run under the same user account as Alice. Bob may call ambient APIs that have nothing to do with the current file. The ACL answers the identity question correctly while the runtime still gives Bob too many paths to act.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is ambient authority. A component can do things simply because it runs in a process with broad privileges, not because the caller deliberately supplied authority for this specific call. Environment variables, the current working directory, inherited sockets, process-wide credentials, and global filesystem objects all create hidden edges in the authority graph. Those edges defeat least-authority because the component can reach resources that were never part of the local request.',
        'The second wall is delegation shape. In real systems, authority passes between actors constantly: a user gives a photo app access to one album, an editor gives a plugin access to one buffer, a job runner gives a task access to one secret. A global ACL can represent some of this, but it does not naturally express "this exact object reference, with these exact methods, for this exact path, until this revoker says stop." The shape of the delegation is richer than what a flat table can capture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A capability fuses two properties into one object. Designation: the reference names the resource. Authority: the holder may call the operations exposed through that reference. You do not first name an object by a global string and then consult a separate table about whether you may use it. You use the object through the reference you were given. If you were never given the reference and cannot forge one, you cannot act.',
        'This makes security a graph problem. Actors, resources, proxies, and revokers are nodes. Capability references are directed edges. If Alice sends Bob a reference, that adds an edge from Bob to the resource (or to a proxy in front of it). If Bob never receives the edge and cannot fabricate it, Bob has no path to the resource. Least authority becomes a construction rule: build the graph so every component receives only the edges it needs for the work it was asked to do.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with nodes connected by arrows`, caption: `Capability security is reachability in a directed graph: authority exists only along explicit edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.`},
        'Attenuation is the operation that makes a stronger capability weaker before sharing. A wrapper can remove write methods, limit a path prefix, enforce a time limit, decrement a budget counter, or log every call. Revocation is the operation that makes a previously shared path stop working, typically by interposing a switch on the forwarding path and later turning it off.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A capability system requires three properties. First, references must be unforgeable: code can receive, store, invoke, or pass a reference, but it cannot invent a working reference from an arbitrary string or integer. Second, the runtime must not provide ambient escape hatches. If every object can reach a global filesystem API, the capability graph is a lie. Third, delegation is ordinary message passing: a holder of a capability introduces another actor to it by sending the reference.',
        'Attenuation is implemented with a proxy. The proxy holds the stronger reference privately and exposes a smaller surface. A read-only file proxy forwards read calls and rejects write calls. A path-limited directory proxy checks that every child path stays under an allowed prefix. A budget proxy decrements a counter before forwarding. The delegate receives the proxy, not the original object, so every call passes through the narrowing policy.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png`, alt: `Decision tree model diagram with branches leading to leaves`, caption: `An attenuating proxy acts like a small decision gate on every call: allow, reject, log, meter, or narrow before forwarding. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Decision_tree_model.png.`},
        'Membranes extend attenuation across an object graph. If a proxy forwards a call and the target returns another object, the returned object can become an escape route. A membrane wraps not just the first object but every object reached through it. Read-only access does not become write access just because a method returned a child object.',
        'Revocation requires indirection. If Alice gives Bob the original file object directly, she cannot later cut only Bob\'s access without affecting everyone. If she gives Bob a revocable forwarder, future calls pass through a live-bit cell. Flipping that bit makes Bob\'s path stop while unrelated holders of other references keep working.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The central invariant is "no reference, no authority." This holds only under object-capability discipline: references are unforgeable, powerful globals are removed or wrapped, and authority is obtained exclusively by receiving references through existing graph paths. Under those conditions, the reference graph is not just a diagram -- it is the security boundary itself.',
        'Attenuation works because the delegate never receives the strong edge. The proxy keeps the strong reference private and exposes only safe behavior. The delegate can call what it holds, but what it holds is the weaker object. This is stronger than giving a component a broad API and trusting it to self-limit: the component literally cannot call methods that are not on the reference it received.',
        'Revocation works when every call that should be revocable crosses the revoker node. The revoker does not need to find all copies of a reference in memory. It only needs to make the forwarding path refuse future calls. The limitation follows directly: revocation is reliable for paths you interposed before sharing, not for direct references that were already leaked around the revoker.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is extra indirection. Every proxy adds a method-call hop. Membranes add wrapper allocation and identity bookkeeping (two proxied objects that wrap the same target must compare as equal). Revocation adds a branch on every forwarded call. Audit, budget, and time-limit checks add small state per proxy. In fine-grained object graphs these costs can matter, but in most security-sensitive systems they are acceptable because the alternative is broad authority with weak confinement.',
        'The engineering cost is discipline. A single unrestricted global can bypass the entire model. Reflection, dynamic module loading, native extensions, process-wide credentials, shared mutable singletons, and raw bearer URLs all need careful treatment. Capability security is easiest when the language or runtime enforces it: object references are unforgeable by construction, imports are controlled, and dangerous authority is not available in the global namespace.',
        'There is also a modeling boundary. Capabilities handle local authority transfer well, but they do not automatically answer organizational authorization questions. A storage service may still need relationship-based authorization to decide whether a user should receive a capability in the first place. The models compose: a durable policy system decides what can be minted, and the capability system controls what the running component can actually use at call time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Capabilities win in plugin systems, browser APIs, mobile permissions, sandboxed agents, distributed actors, object stores, build systems, and job runners. In every case, the caller hands a component narrow task authority instead of letting it inherit root context. A test runner receives a temporary-directory capability. A browser tab receives a handle to one selected file. An agent tool receives a budgeted, audited API reference.',
        'They also win when delegation is frequent and local. Passing a read-only, time-limited reference to one worker is easier to reason about than updating a shared role that may affect many future calls. The graph edge makes authority visible in program structure, which is valuable during code review: a reviewer can ask why this object received this reference and whether a weaker proxy would have been sufficient.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The model fails when references are forgeable. If a capability is a predictable URL, a guessable path, or a token copied from logs, then anyone who obtains the string obtains the authority. Bearer capabilities can still be useful, but they require secrecy, short lifetimes, channel security, and careful logging. The object-capability ideal is stronger: a normal program cannot fabricate a reference by guessing.',
        'It fails when ambient authority remains available. If a plugin can ignore the narrow file capability and call a global filesystem API, the narrow edge did not confine it. If a proxy returns the raw target instead of a wrapped object, the membrane leaks. If revocation is added after direct references were already distributed, old paths keep working. Every ambient escape hatch must be closed for the graph to be truthful.',
        'It also fails as a complete policy language. Capabilities describe possession and delegation, not necessarily why possession should be granted. Large organizations need auditability, group membership, inheritance, approval workflows, and policy search. Those concerns sit upstream of capability minting; they do not disappear just because the runtime uses capabilities downstream.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a text editor that supports third-party formatters. The editor holds broad authority: workspace reads, buffer writes, network for extension updates, user settings. A formatter needs almost none of that. For one formatting request, the editor creates a narrow capability: read the current buffer, write a replacement buffer, nothing else. The formatter receives that proxy, not the editor\'s root context.',
        'The formatter calls a helper library for parsing. In a capability system, the formatter passes only the capabilities the helper needs: a read reference for the text buffer, a diagnostic-sink reference for errors. The helper does not inherit the editor\'s root authority just because it runs inside the same process. Authority flows along explicit references, and each hop can narrow further.',
        'Now add attenuation and revocation. The editor gives the formatter a path-limited directory capability for a temporary scratch folder. Under the hood, the capability is a proxy with three layers: a prefix check (path must start with /tmp/fmt-session-42/), a byte budget (50 MB max writes), and an audit log. The editor also places a revocation switch in the forwarding chain. When the formatting task finishes, the editor flips the switch. The formatter may still hold the old reference object, but calls through it now stop at the dead forwarder. Total authority graph: editor -> [revocation switch] -> [prefix+budget+audit proxy] -> scratch directory. Remove the switch edge and the formatter\'s path is severed without touching any other reference in the system.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mark Miller\'s "Capability Myths Demolished" (2003), Dennis and Van Horn\'s "Programming Semantics for Multiprogrammed Computations" (1966), and the ERights.org capability material. For a modern systems view, compare object capabilities with browser File System Access API handles, Android scoped storage, and service-mesh credential minting.',
        'Study Zanzibar Authorization for durable relationship-based authorization, OAuth PKCE and JWT Verification for bearer-token systems, Macaroon Caveat Chains and UCAN Delegation Proofs for attenuated credentials, Agent Tool Permission Lattice for explicit tool authority, and Seccomp BPF Sandbox Policy for process-level confinement. The key follow-up question is how a system decides when to mint a capability, how narrow it should be, and how every ambient escape path is closed.',
      ],
    },
  ],
};
