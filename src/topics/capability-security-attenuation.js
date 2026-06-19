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
    explanation: 'A capability fuses two facts: Alice holds this unforgeable reference, and messages through it are allowed. Without that edge in the graph, the file object is unreachable no matter what Alice can name.',
    invariant: 'No reference, no authority.',
  };
  yield {
    state: capabilityGraph('Delegation is introduction, not global ACL editing'),
    highlight: { active: ['alice', 'bob', 'cap', 'e-alice-bob', 'e-bob-cap'], found: ['file'] },
    explanation: 'Delegation adds a graph edge by sending the reference to Bob. The file does not edit a global access list; authority moves only along references that existing holders choose to share.',
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
    explanation: 'These models store authority in different places. ACLs ask a table about subjects, bearer tokens ask whether a string is accepted, and capabilities ask whether this actor actually holds a connected reference.',
  };
  yield {
    state: capabilityGraph('A proxy can narrow the authority before sharing'),
    highlight: { active: ['file', 'proxy', 'log', 'deny', 'e-file-proxy', 'e-proxy-log', 'e-proxy-deny'], compare: ['cap'] },
    explanation: 'Attenuation narrows authority before sharing. The proxy keeps the stronger file capability behind it and hands out only the operations, path, budget, or policy gate the delegate should have.',
  };
}

function* attenuationAndRevocation() {
  yield {
    state: revocationGraph('Attenuation produces weaker references'),
    highlight: { active: ['root', 'ro', 'time', 'e-root-ro', 'e-root-time'], compare: ['object'] },
    explanation: 'The safe move is to mint the weakest useful reference first. A read-only, time-limited, path-limited, or rate-limited capability reduces the blast radius before untrusted code ever runs.',
  };
  yield {
    state: revocationGraph('Membranes wrap a whole reachable object graph'),
    highlight: { active: ['ro', 'time', 'mem', 'switch', 'e-ro-mem', 'e-time-mem', 'e-mem-switch'], found: ['object'] },
    explanation: 'A membrane wraps not just one object but the objects reached through it. That keeps the attenuation invariant alive when calls return more references.',
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
    explanation: 'The implementation is small state on a forwarding edge: target pointer, policy fields, counters, expiry, and audit records. The security effect comes from giving code a weaker edge instead of trusting it to self-limit.',
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
        "Read the animation as the execution trace for Capability Security & Attenuation. A primer on capability security: unforgeable references, least authority, delegation, attenuation, revocation, membranes, and confused-deputy resistance..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Problem',
      paragraphs: [
        `Most software security bugs are not caused by a program needing no authority at all. They are caused by a program receiving more authority than the current job requires. A markdown previewer needs to read one document. A formatter needs to read a source file and write a replacement buffer. A package installer may need network access, a cache directory, and a narrow write path. If all of those components inherit the whole filesystem, process environment, credential store, and network by default, then a small bug or malicious dependency can exercise power that had nothing to do with the task.`,
        `Capability security turns authority into something concrete. The right to act is not a global mood attached to a process or a user name. It is carried by an unforgeable reference. If code has a reference to an object, and that reference exposes a method, then code can send that message. If code never receives such a reference, it has no path to the resource through that object-capability graph. The central design question becomes: which references did this component receive, and how narrow are the operations behind those references?`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The usual first design is an access-control list. Each protected object has a table that says which users, groups, roles, or service accounts may perform which operations. On every operation, the resource asks whether the caller is on the list. This is a useful model for many durable authorization problems. A document service really does need to answer questions like whether user 123 can comment on document 456 because of a team, folder, organization, or sharing relation.`,
        `But ACL thinking becomes awkward for local delegation. Suppose Alice has a file handle and wants Bob, an untrusted plugin, to format exactly that file. Editing a global permission table to represent this one temporary interaction is too broad. Bob may run under the same user account as Alice. Bob may be able to call ambient APIs that never mention the current file. The table may answer the identity question correctly while the runtime still gives Bob too many paths to act.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is ambient authority. A component can often do things merely because it is running in a process with broad privileges, not because the caller deliberately supplied the needed authority for this call. Environment variables, current working directory, global filesystem objects, inherited sockets, process-wide credentials, and singleton clients all create hidden edges. Those edges defeat least authority because the component can reach resources that were never part of the local request.`,
        `Delegation is the second wall. In real systems, authority is passed from one actor to another all the time: a user gives a photo app access to one album, an editor gives a plugin access to one buffer, an orchestration service gives a job access to one secret, or a parent object gives a child object access to a helper. A global table can represent some of this, but it does not naturally express the shape "this exact object reference, with these exact methods, for this exact path, until this revoker says stop."`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A capability is both designation and authority. Designation means the reference names the object. Authority means the holder may use the operations exposed through that reference. Those two facts are intentionally fused. You do not first name an object by a global string and then ask a separate access-control table whether you may use it. You use the object through the reference you were given.`,
        `This makes security look like a graph problem. Actors, services, resources, proxies, and revokers are nodes. Capability references are directed edges. If Alice sends Bob a reference, delegation adds an edge from Bob to the object or to a proxy in front of the object. If Bob never receives the edge and cannot forge it, Bob cannot use that path. Least authority becomes a construction rule: build the graph so every component receives only the edges needed for the work it was asked to perform.`,
        `Attenuation is the operation that makes a stronger capability weaker before sharing it. A wrapper can remove write methods, limit a path prefix, enforce a time limit, decrement a budget counter, record an audit trail, or translate a large API into a narrow one. Revocation is the operation that makes a previously shared path stop working, usually by placing a forwarder or switch on the path and later turning it off.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The smallest capability system needs only a few pieces. First, references must be unforgeable. Code may receive a reference, store it, call it, or pass it on, but it may not invent a working reference from an arbitrary string. Second, objects must avoid ambient escape hatches. If every object can reach global filesystem and network APIs, then the visible graph is a lie. Third, delegation must be ordinary message passing: a holder of a capability can introduce another actor to that capability by sending the reference.`,
        `Attenuation is usually implemented with a proxy. The proxy holds the stronger target reference privately and exposes a smaller surface. A read-only file proxy forwards read calls and rejects write calls. A path-limited directory proxy checks that every requested child path stays under an allowed prefix. A budget proxy decrements a counter before forwarding. A logging proxy records method, caller, and resource before allowing the call. The delegate receives the proxy, not the original object, so all of its calls pass through the narrowing policy.`,
        `Membranes extend that idea across an object graph. If a proxy forwards one call and the target returns another object, the returned object can accidentally become an escape route. A membrane wraps not only the first object but also the objects reached through it. The wrapper preserves the same policy across returned references, so read-only access does not become write access just because the delegate called a method that returned a child object.`,
        `Revocation usually needs indirection. If Alice gives Bob the original file object directly, Alice cannot later make only Bob's copy stop without changing the file object for everyone. If Alice gives Bob a revocable forwarder, future calls pass through a live bit or revocation cell. Flipping that cell makes Bob's path stop, while unrelated holders of other references continue to work.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The key invariant is "no reference, no authority." That statement is only true under object-capability discipline: references are unforgeable, powerful globals are removed or wrapped, and authority is obtained only by receiving references through existing paths. Under those conditions, the reference graph is not just a diagram. It is the security boundary.`,
        `Attenuation works because the delegate does not receive the strong edge. The proxy keeps the strong reference inside a smaller object and exposes only the safe behavior. The delegate can call what it holds, but what it holds is the weaker object. This is why the design is stronger than giving a component a broad API and asking it to behave. The component cannot call methods that are not on the reference it received.`,
        `Revocation works when every call that should be revocable crosses the revoker. The revoker does not need to find all copies of a reference in the heap. It only needs to make the forwarding path refuse future calls. That also explains the limitation: revocation is reliable for paths you interposed before sharing. It does not magically cancel direct references that were already leaked around the revoker.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine an editor that supports third-party formatters. The editor itself has broad authority: it can read the workspace, write buffers, open network connections for extension updates, and read user settings. A formatter does not need all of that. For one formatting request, the editor can create a narrow capability that reads only the current buffer, writes only a replacement buffer, and exposes no direct filesystem or network operation.`,
        `Now suppose the formatter calls a helper library. In a capability system, the formatter can pass only the capabilities the helper needs. If the helper needs to parse the current text, it receives a read capability. If it needs to report diagnostics, it receives a diagnostic sink. It does not inherit the editor's root authority just because it runs inside the same process. Authority flows along explicit references.`,
        `Add attenuation and revocation. The editor gives the formatter a path-limited directory capability for a temporary scratch directory. The capability is actually a proxy with a prefix check, a byte budget, and an audit log. The editor also places a revocation switch in front of it. When the formatting task finishes or the extension is disabled, the switch flips. The formatter may still hold an old object reference, but calls through that reference now stop at the forwarder.`,
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The object-capability view starts with Alice, a capability, and a file. The important fact is not the names of the nodes. It is reachability. Alice can use the file because Alice has an edge to a reference that reaches the file. The denied node is outside that path. It may know that a file exists, but it has no usable edge to it.`,
        `The delegation frame shows Alice introducing Bob to the capability. Nothing about the file's global identity has to change. The local graph changes because Bob now holds a usable reference. The matrix frame contrasts this with ACLs, Zanzibar-style relation graphs, and bearer tokens. The point is not that one model replaces all others. The point is that each model stores authority in a different place, so each model has different leak, staleness, and ambient-authority risks.`,
        `The attenuation and revocation view shows root authority being split into weaker references, then wrapped by a membrane and a switch. Follow the forwarding path. The read-only or time-limited capability reaches the membrane, then the revocation switch, then the object. When the switch is turned off, the object still exists and other references may still work, but this delegated path no longer forwards.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The runtime cost is extra indirection. Proxies add method calls. Membranes add wrapper allocation and identity bookkeeping. Revocation adds a branch on the forwarding path. Audit, budget, and time checks add state. In a fine-grained object graph, those costs can matter. In many security-sensitive systems, the cost is acceptable because the alternative is broad authority with weak confinement.`,
        `The engineering cost is discipline. A single unrestricted global can bypass the whole model. Reflection, dynamic module loading, native extensions, process-wide credentials, shared mutable singletons, and raw bearer URLs all need careful treatment. Capability security is easiest when the language or runtime helps: object references are unforgeable, imports are controlled, and dangerous authority is not placed in the global namespace by default.`,
        `There is also a modeling tradeoff. Capabilities are excellent for local authority transfer, but they do not automatically answer every historical or organizational authorization question. A storage service may still need relationship-based authorization to decide whether a user should receive a capability in the first place. The models often compose: a durable policy system decides what can be minted, and the capability system controls what the running component can actually use.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Capabilities win in plugin systems, browser APIs, mobile permissions, sandboxed agents, distributed actors, object stores, build systems, and job runners. In all of these settings, the caller can hand a component narrow task authority instead of letting it inherit a root context. A test runner can receive a temporary directory capability. A browser tab can receive a handle to one selected file. An agent tool can receive a budgeted, audited API reference.`,
        `They also win when delegation is frequent and local. Passing a read-only, time-limited reference to one worker is easier to reason about than updating a shared role that may affect many future calls. The graph edge makes the authority visible in the program structure. That visibility is valuable for reviews because the reviewer can ask why this object received this reference and whether a weaker proxy would have been enough.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The model fails when references are forgeable. If a capability is just a predictable URL, a guessed path, or a token that can be copied from logs, then anyone who obtains the string obtains the authority. Bearer capabilities can still be useful, but they require secrecy, short lifetimes, channel security, and careful logging. The object-capability ideal is stronger: a normal program cannot fabricate a reference by guessing its name.`,
        `It fails when ambient authority remains available. If a plugin can ignore the narrow file capability and call a global filesystem API, the narrow edge did not confine it. If a proxy returns raw target objects instead of wrapped objects, the membrane leaks. If revocation is inserted after direct references were already handed out, old paths keep working. If equality, serialization, or debugging hooks expose hidden target references, the wrapper can be bypassed.`,
        `It also fails as a complete policy language. Capabilities describe possession and delegation, not necessarily why possession should be granted. Large organizations often need auditability, group membership, inheritance, approval workflows, and policy search. Those concerns can sit upstream of capability minting, but they do not disappear.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary references include Capability Myths Demolished, the ERights capability material, and Dennis and Van Horn's work on programming semantics for multiprogrammed computations. For a modern systems view, compare object capabilities with sandbox APIs, browser file handles, mobile permission grants, and service-to-service credential minting.`,
        `Study Zanzibar Authorization Case Study for durable relationship authorization, OAuth PKCE Token Lifecycle Case Study and JWT Verification for bearer-token systems, Macaroon Caveat Chain Case Study and UCAN Delegation Proof Chain for attenuated credentials, Agent Tool Permission Lattice for explicit tool authority, and Seccomp BPF Sandbox Policy for process-level confinement. The useful next question is how a system decides when to mint a capability, how narrow it can be, and how every escape path is closed.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Capability Security & Attenuation moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
