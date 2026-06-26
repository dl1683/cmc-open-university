// Agent tool permission lattice: convert a model's requested tool call into
// scoped authority, sandbox profile, approval state, and audit evidence.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-tool-permission-lattice',
  title: 'Agent Tool Permission Lattice',
  category: 'Security',
  summary: 'A control-plane data structure for AI agents: order tool calls by effect, scope, resource, approval, expiry, sandbox profile, and audit requirement.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['permission lattice', 'execution gate'], defaultValue: 'permission lattice' },
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

function latticeGraph(title) {
  return graphState({
    nodes: [
      { id: 'none', label: 'none', x: 0.9, y: 5.3, note: 'no effect' },
      { id: 'read', label: 'read', x: 2.4, y: 4.4, note: 'observe' },
      { id: 'draft', label: 'draft', x: 3.9, y: 5.3, note: 'preview' },
      { id: 'write', label: 'write', x: 5.4, y: 4.4, note: 'mutate' },
      { id: 'send', label: 'send', x: 6.9, y: 3.4, note: 'external' },
      { id: 'delete', label: 'delete', x: 8.4, y: 2.3, note: 'destructive' },
      { id: 'approval', label: 'approve', x: 8.4, y: 5.3, note: 'human' },
    ],
    edges: [
      { id: 'e-none-read', from: 'none', to: 'read' },
      { id: 'e-none-draft', from: 'none', to: 'draft' },
      { id: 'e-read-write', from: 'read', to: 'write' },
      { id: 'e-draft-write', from: 'draft', to: 'write' },
      { id: 'e-write-send', from: 'write', to: 'send' },
      { id: 'e-send-delete', from: 'send', to: 'delete' },
      { id: 'e-write-approval', from: 'write', to: 'approval' },
      { id: 'e-delete-approval', from: 'delete', to: 'approval' },
    ],
  }, { title });
}

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'proposal', label: 'tool call', x: 0.7, y: 3.7, note: 'model' },
      { id: 'schema', label: 'schema', x: 2.1, y: 2.0, note: 'shape' },
      { id: 'identity', label: 'identity', x: 2.1, y: 5.4, note: 'user' },
      { id: 'scope', label: 'scope', x: 3.8, y: 3.7, note: 'token' },
      { id: 'policy', label: 'policy', x: 5.4, y: 2.0, note: 'OPA' },
      { id: 'sandbox', label: 'sandbox', x: 5.4, y: 5.4, note: 'runtime' },
      { id: 'approve', label: 'approval', x: 7.2, y: 2.0, note: 'risk' },
      { id: 'audit', label: 'audit', x: 7.2, y: 5.4, note: 'trace' },
      { id: 'effect', label: 'effect', x: 9.0, y: 3.7, note: 'allowed' },
    ],
    edges: [
      { id: 'e-proposal-schema', from: 'proposal', to: 'schema' },
      { id: 'e-proposal-identity', from: 'proposal', to: 'identity' },
      { id: 'e-schema-scope', from: 'schema', to: 'scope' },
      { id: 'e-identity-scope', from: 'identity', to: 'scope' },
      { id: 'e-scope-policy', from: 'scope', to: 'policy' },
      { id: 'e-scope-sandbox', from: 'scope', to: 'sandbox' },
      { id: 'e-policy-approve', from: 'policy', to: 'approve' },
      { id: 'e-sandbox-audit', from: 'sandbox', to: 'audit' },
      { id: 'e-approve-effect', from: 'approve', to: 'effect' },
      { id: 'e-audit-effect', from: 'audit', to: 'effect' },
    ],
  }, { title });
}

function* permissionLattice() {
  const lattice = latticeGraph('Effect authority is ordered by blast radius');
  const latticeNodes = lattice.graph.nodes;
  const latticeEdges = lattice.graph.edges;

  yield {
    state: lattice,
    highlight: { active: ['none', 'read', 'draft', 'write', 'e-none-read', 'e-none-draft', 'e-read-write', 'e-draft-write'], compare: ['send', 'delete'] },
    explanation: `An agent permission lattice orders ${latticeNodes.length} tool effects across ${latticeEdges.length} edges. ${latticeNodes[1].label} and ${latticeNodes[2].label} can be low-risk. ${latticeNodes[3].label}, ${latticeNodes[4].label}, and ${latticeNodes[5].label} have larger blast radius and need stronger proof.`,
    invariant: `A model request can move down from ${latticeNodes[5].label} toward ${latticeNodes[0].label} in authority, never up without policy.`,
  };

  yield {
    state: latticeGraph('External and destructive effects need explicit gates'),
    highlight: { active: ['write', 'send', 'delete', 'approval', 'e-write-send', 'e-send-delete', 'e-delete-approval'], compare: ['read'] },
    explanation: `Sending email, posting to a ticketing system, changing permissions, or deleting data crosses from private reasoning into external effect. The lattice routes ${latticeNodes[4].label} and ${latticeNodes[5].label} calls through the ${latticeNodes[6].label} node.`,
  };

  const tupleRows = [
    { id: 'actor', label: 'actor' },
    { id: 'tool', label: 'tool' },
    { id: 'effect', label: 'effect' },
    { id: 'resource', label: 'resource' },
    { id: 'expiry', label: 'expiry' },
    { id: 'runtime', label: 'runtime' },
  ];
  yield {
    state: labelMatrix(
      'Permission tuple',
      tupleRows,
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['user+agent', 'bind identity'],
        ['name+schema', 'limit action'],
        ['read/write', 'rank risk'],
        ['URI/scope', 'least priv'],
        ['TTL', 'short life'],
        ['profile', 'contain code'],
      ],
    ),
    highlight: { active: ['actor:field', 'tool:field', 'effect:field', 'resource:field', 'runtime:field'], found: ['expiry:why'] },
    explanation: `The ${tupleRows.length}-field tuple makes tool authority concrete. ${tupleRows[0].label}, ${tupleRows[1].label}, ${tupleRows[2].label}, ${tupleRows[3].label}, ${tupleRows[4].label}, and ${tupleRows[5].label} are all separate dimensions.`,
  };

  const joinRows = [
    { id: 'public', label: 'public read' },
    { id: 'private', label: 'private read' },
    { id: 'draft', label: 'draft reply' },
    { id: 'send', label: 'send private' },
    { id: 'delete', label: 'delete prod' },
  ];
  yield {
    state: labelMatrix(
      'Join examples',
      joinRows,
      [
        { id: 'lattice', label: 'lattice result' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['low', 'log'],
        ['scoped', 'ACL'],
        ['preview', 'allow'],
        ['high', 'confirm'],
        ['critical', 'deny'],
      ],
    ),
    highlight: { active: ['public:gate', 'private:gate', 'draft:gate'], compare: ['send:gate'], removed: ['delete:gate'] },
    explanation: `The lattice combines effect class and resource sensitivity across ${joinRows.length} join examples. A ${joinRows[2].label} to public scratch space is not the same as a ${joinRows[4].label} in production, even if both are valid tool calls.`,
  };
}

function* executionGate() {
  const gate = gateGraph('Tool proposals are untrusted until bound to policy');
  const gateNodes = gate.graph.nodes;
  const gateEdges = gate.graph.edges;

  yield {
    state: gate,
    highlight: { active: ['proposal', 'schema', 'identity', 'scope', 'e-proposal-schema', 'e-proposal-identity', 'e-schema-scope', 'e-identity-scope'], compare: ['effect'] },
    explanation: `The model proposes a ${gateNodes[0].label}. The runtime validates ${gateNodes[1].label}, binds it to a real ${gateNodes[2].label}, and checks ${gateNodes[3].label} before any ${gateNodes[8].label} happens across the ${gateNodes.length}-node pipeline.`,
  };

  yield {
    state: gateGraph('Policy and sandbox profiles decide how execution happens'),
    highlight: { active: ['scope', 'policy', 'sandbox', 'audit', 'e-scope-policy', 'e-scope-sandbox', 'e-sandbox-audit'], compare: ['approve'] },
    explanation: `OPA-style ${gateNodes[4].label} can decide whether a call is allowed. The ${gateNodes[5].label} profile decides how it runs: no network, read-only mount, egress allowlist, temp filesystem, or stronger isolation.`,
  };

  yield {
    state: gateGraph('High-risk effects require approval and evidence'),
    highlight: { active: ['policy', 'approve', 'audit', 'effect', 'e-policy-approve', 'e-approve-effect', 'e-audit-effect'], compare: ['schema'] },
    explanation: `For high-risk actions, the system should show a dry-run or diff, collect human ${gateNodes[6].label}, and write an ${gateNodes[7].label} event that can be replayed during incident review.`,
    invariant: `The ${gateNodes[8].label} is allowed only after ${gateNodes.length - 1} gate checks (${gateNodes.slice(1, -1).map(n => n.label).join(', ')}) agree.`,
  };

  const caseStudyTools = [
    { id: 'crm', label: 'CRM read' },
    { id: 'email', label: 'email send' },
    { id: 'file', label: 'file edit' },
    { id: 'shell', label: 'shell run' },
    { id: 'admin', label: 'admin API' },
  ];
  yield {
    state: labelMatrix(
      'Agent tool case study',
      caseStudyTools,
      [
        { id: 'control', label: 'control' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['row ACL', 'query log'],
        ['confirm', 'message id'],
        ['diff gate', 'patch log'],
        ['sandbox', 'transcript'],
        ['breakglass', 'ticket'],
      ],
    ),
    highlight: { active: ['crm:control', 'file:control', 'shell:control'], compare: ['email:control'], removed: ['admin:control'] },
    explanation: `Each of the ${caseStudyTools.length} tools (${caseStudyTools.map(t => t.label).join(', ')}) needs a different control. A universal "agent is allowed" bit is too coarse for real systems.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'permission lattice') yield* permissionLattice();
  else if (view === 'execution gate') yield* executionGate();
  else throw new InputError(`Pick an agent-tool permission view, not "${view}".`);
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views you can switch between. The permission lattice view shows seven effect levels -- none, read, draft, write, send, delete, approve -- connected by edges that represent authority ordering. Active (highlighted) nodes are the effects under discussion in that frame; compared nodes are the high-risk effects being contrasted against them.',
        {type: "callout", text: "A permission lattice keeps model intent separate from authority by ranking each proposed effect before execution."},
        'The execution gate view shows a nine-node pipeline: tool call, schema, identity, scope, policy, sandbox, approval, audit, effect. Each frame lights up the gates being checked and dims the ones not yet reached. The pipeline reads left to right -- a proposal enters on the left, passes through gates, and only becomes an allowed effect on the right if every gate agrees.',
        'In both views, matrix frames appear with labeled rows and columns. These show concrete tuples (actor, tool, effect, resource, expiry, runtime) or case-study tools with their controls and evidence requirements. Red or removed markers mean denied; found markers mean the gate passed.',
        {type: 'image', src: './assets/gifs/agent-tool-permission-lattice.gif', alt: 'Animated walkthrough of the agent tool permission lattice visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model can generate a syntactically perfect tool call that would delete your production database. The model does not know -- and cannot know -- whether it has authority to do that. Model output is a proposal, not a command. The gap between "the model said to do X" and "X is authorized" is where every agent security incident lives.',
        'As agents gain more tools, the permission surface grows combinatorially. Reading a public doc, reading a private CRM row, drafting an email, sending that email, editing a file, running a shell command, and deleting production data are not the same permission. They differ in blast radius, reversibility, data sensitivity, and who needs to approve. A flat allow/deny flag cannot express these differences. A lattice can, because it gives each effect a position in a partial order and lets the runtime compare them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing most teams try is a boolean: the agent may use tools, or it may not. The slightly improved version validates that the JSON arguments match the tool schema. Both fail because schema validity is not authorization. A syntactically valid email_send call can leak private data to an external address. A valid shell command can rm -rf the wrong directory.',
        'The next attempt is to ask the model to be careful -- add instructions to the system prompt saying "do not delete files" or "ask before sending email." This is context, not enforcement. Prompt injection, stale instructions, ambiguous user intent, and plain model mistakes can all produce a dangerous proposal. If your security boundary is a paragraph of text that the model interprets probabilistically, you do not have a security boundary.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The invariant is: no tool effect may execute at a higher authority level than the current grant allows. The wall appears the moment you have a tool that combines two effects. Suppose the agent calls a tool that reads private customer data and then sends an external email containing that data. Schema validation passes -- both arguments are well-formed. The model was told to help the user. But the combined effect (exfiltrate private data to an external recipient) is higher-risk than either individual effect.',
        'A flat permission system sees two valid calls and allows both. The lattice computes the join of "private read" and "external send," which lands at or above the "send" node -- triggering confirmation, audit, or denial. Without the join operation, you cannot express "this combination is more dangerous than its parts." That is the wall: single-effect reasoning breaks when tools compose, and tools always compose in real agent systems.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent tool authority as an ordered tuple, not a flat allow list. Each permission record binds actor, tool name, declared effect, resource pattern, data sensitivity, scope, expiry, approval status, sandbox profile, and audit requirement. The lattice orders these tuples by authority level. A read of public documentation sits below a write to a private repository. A draft email sits below sending it. A production delete sits near the top and may be denied entirely for routine agents.',
        'The word "lattice" is precise, not decorative. Some effects are comparable: draft is below send, read is below write. Others are on separate dimensions: filesystem write and external network send are not ordered relative to each other. When a tool call combines effects from different dimensions, the lattice computes their join -- the least upper bound that is at least as risky as both. This join is what prevents the composition attack described above.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Execution starts when the model emits a proposed tool call. The runtime validates argument shape against the tool schema -- this is the first gate, and it only checks syntax. Next, the runtime binds the proposal to a real identity: the user, the workspace, a service account, a delegated OAuth token, or a narrow capability token. The proposal now has a "who."',
        'The runtime resolves the target resource and requested effect. The same tool can require different authority depending on whether it reads a public issue or edits a private file. Policy evaluation computes the required lattice element and compares it against the current grant. The result is not just allow or deny -- it can be downgrade (run as preview instead of write), escalate (require human approval), sandbox (run with no network and a temporary filesystem), or deny with evidence.',
        {type: 'image', src: 'https://developer.gs.com/blog/blog-posts/scaling-opa-through-oces/oces_1_v2.png', alt: 'Open Policy Agent policy decision point in a service request path.', caption: 'OPA separates policy decisions from application code and gives the runtime a policy gate. (Source: developer.gs.com)'},
        'Every decision produces an audit event naming the proposal, the policy version that evaluated it, the grant that was checked, the result, and the evidence. This audit trail is not optional -- it is what makes incident review possible. Without it, you cannot answer "why was this call allowed?" after something goes wrong.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates intent from authority at a structural level. The user states a goal, the model proposes a plan, and the runtime independently decides what that plan is allowed to do. This separation matters because the model is exposed to untrusted input -- web pages, documents, ticket contents, email bodies, tool outputs -- any of which could contain prompt injection. The lattice prevents injected instructions from silently upgrading the agent from reader to writer to deleter.',
        'It also works because denied calls are not just failures -- they are security evidence. Approved calls are not just successes -- they are auditable events tied to identity, scope, policy version, and runtime containment. When an incident occurs, the team can trace exactly which policy allowed the action, whether the scope was too broad, whether the approval prompt was misleading, or whether the sandbox profile was too permissive. The lattice turns every tool invocation into a reviewable record.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The primary cost is friction. A lattice that requires approval for every small action makes the agent useless. A lattice with thirty vague risk levels is impossible to reason about. The useful version has a small effect taxonomy (the seven levels in the animation are a good starting point), clear resource scopes, short-lived grants, and predictable escalation. Users should learn the pattern quickly: reads proceed, drafts can be previewed, external sends need confirmation, destructive actions are rare and heavily gated.',
        'The engineering cost is real. Tool manifests must declare effects honestly -- if a tool claims "read" but actually writes, the lattice is defeated. Scopes must be enforced at the tool server, not just in the UI. Sandboxes must actually contain code execution, filesystem access, and network egress. Audit logs must be durable enough for review but not store sensitive data carelessly. The lattice coordinates OAuth, capability tokens, row-level ACLs, policy engines, and OS-level isolation. It replaces none of them.',
        {type: 'image', src: 'https://www.docker.com/app/uploads/2026/04/image9.png', alt: 'Docker diagram comparing sandboxing approaches for AI agents.', caption: 'Agent sandboxes matter because shell, file, and network effects need runtime containment. (Source: docker.com)'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Consider an enterprise operations agent with five tools: CRM read, email send, file edit, shell run, admin API. CRM read gets row-level ACLs and a query log. Draft email is allowed freely because it has no external effect. Sending the email requires the user to confirm recipients and body, then records the message ID. File edits go through a diff gate -- the user sees the patch before it applies. Shell commands run in a sandbox with no network, a read-only mount of the project directory, and a temporary filesystem. Admin API calls require break-glass approval tied to an incident ticket.',
        'The same pattern applies to coding agents, browser automation, data analysis assistants, and personal productivity bots. A coding agent reads the repo freely, proposes patches, and runs tests, but cannot push to production or publish secrets without a stronger grant. A browser agent can fill a form, but payment submission or account deletion sits higher in the lattice. Each action gets the amount of agency it actually deserves, not a blanket "the agent can do things."',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure mode is treating the lattice as documentation instead of enforcement. If the tool server ignores scopes and executes whatever the model asks, the lattice diagram on your wiki does nothing. The second failure is issuing broad, long-lived tokens to the agent and hoping the system prompt will keep it safe. The third is letting the model choose its own sandbox profile or write its own approval text -- the runtime must choose containment based on policy, not on the model\'s self-assessment of its own risk.',
        'The lattice also cannot solve business-level quality problems. A permitted email can still be a bad email. A permitted file edit can still introduce a bug. A human approval prompt can be clicked through carelessly if it fires too often or its text is vague. The lattice controls authority, not correctness. Pair it with validation logic, diff previews, dry runs, tests, rate limits, anomaly detection, and undo paths where the domain supports reversal.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user asks the agent: "Email the Q3 revenue summary to the board." The model proposes: tool=email_send, to=[board-list@company.com], body=[contains revenue figures]. Step 1 -- schema gate: arguments are well-formed JSON matching the email_send schema. Pass. Step 2 -- identity gate: the request is bound to user Alice, workspace=finance, delegated OAuth token with scope=email.send. Step 3 -- scope gate: the token permits email.send but the resource (board-list) is an external distribution list. Scope check flags "external recipient."',
        'Step 4 -- policy gate: the lattice element for "send + private financial data + external recipient" computes to a join at or above the "send" node. Policy says: require confirmation, attach audit evidence. Step 5 -- sandbox: not applicable for email (no code execution). Step 6 -- approval gate: the runtime shows Alice the recipients, the body with revenue figures highlighted, and asks for confirmation. Alice confirms. Step 7 -- audit: an event is written with proposal hash, policy version, grant, approval timestamp, and message ID. Step 8 -- effect: email is sent. If Alice had denied, the audit log would still record the attempt with result=denied, and the model would receive a structured denial it can explain to the user.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with capability-based security (Mark Miller\'s work on object-capability discipline) -- the core idea is that authority should be an explicit, narrow, attenuable object, not an ambient property of the caller. Then study OAuth 2.0 scopes and the MCP authorization specification, which apply the same principle to agent tool servers. For policy engines, read the Open Policy Agent documentation and its Rego language for expressing authorization rules as data.',
        {type: 'image', src: 'https://docs.oracle.com/en/cloud/paas/integration-cloud/rest-api-fs/images/oauth-flow.png', alt: 'OAuth authorization code flow with client, resource owner, authorization server, and resource server.', caption: 'OAuth flow shows how scoped authority should be issued before resource access. (Source: docs.oracle.com)'},
        'For sandboxing, study seccomp-bpf, Linux namespaces, gVisor, and container egress policies -- these are the runtime mechanisms that enforce what the lattice decides. For the agent-specific angle, read the Anthropic and OpenAI tool-use documentation, the MCP specification for tool permissions, and Docker\'s 2026 work on agent sandboxing. After that, study prompt injection threat models, audit log design patterns, and approval UX -- the lattice organizes all of these, but each one is its own discipline worth learning deeply.',
      ],
    },
  ],
};

