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
        "Read the animation as the execution trace for Agent Tool Permission Lattice. A control-plane data structure for AI agents: order tool calls by effect, scope, resource, approval, expiry, sandbox profile, and audit requirement..",
        {type: "callout", text: "A permission lattice keeps model intent separate from authority by ranking each proposed effect before execution."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/agent-tool-permission-lattice.gif', alt: 'Animated walkthrough of the agent tool permission lattice visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An agent tool permission lattice exists because model output is not authority. A model can propose a tool call, but the runtime must decide whether that call is allowed, under which identity, against which resource, for how long, with what sandbox, and with what evidence. Without that control plane, an agent system quietly turns language into action without a reliable boundary between suggestion and effect.',
        'The problem gets harder as agents gain useful tools. Reading a public document, reading a private CRM row, drafting an email, sending an email, editing a file, running a shell command, and deleting production data are not variations of the same permission. They have different blast radius. A lattice gives the platform a structured way to compare those effects and enforce least privilege without reducing everything to a single yes or no bit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive design has a list of tools and a single flag: this agent may use tools. A slightly better version validates that the JSON arguments match the schema. Both designs fail because schema validity is not authorization. A syntactically valid email_send call can still leak private data. A valid shell command can still mutate the wrong directory. A valid database query can still cross a tenant boundary.',
        'Another naive design asks the model to be careful. That is not enforcement. Tool descriptions, system prompts, and safety instructions are useful context, but they are not a security boundary. Prompt injection, stale context, ambiguous user intent, and model mistakes can all produce a dangerous proposal. The runtime needs to treat every tool call as untrusted until policy, identity, scope, approval, sandbox, and audit checks have made the effect explicit.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to represent tool authority as an ordered tuple, not as a flat allow list. The tuple binds actor, agent, tool name, declared effect, resource pattern, data sensitivity, scope, expiry, approval status, sandbox profile, and audit requirement. The lattice orders those tuples by authority. A read of public documentation is below a write to a private repository. A draft email is below sending that email. A production delete is above nearly everything and may be denied entirely for normal agents.',
        'The word lattice matters because not all permissions are on one simple ladder. Some effects are comparable, such as draft before send or read before write. Others are separate dimensions, such as filesystem write and external network send. A safe policy can compute joins when a tool combines effects. If a call reads private data and sends an external message, the effective permission is not the average of the two. It must be treated as the higher-risk combination.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Execution starts with a proposed tool call. The runtime validates the argument shape, but that is only the first gate. It then binds the proposal to a real identity: the user, workspace, service account, delegated OAuth token, or narrow capability that the platform recognizes. Next it resolves the target resource and requested effect. The same tool can require different authority depending on whether it reads a public issue, edits a private file, sends a message outside the organization, or touches production infrastructure.',
        'Policy evaluation computes the required lattice element and compares it with the current grant. The result can be allow, deny, downgrade, ask for approval, require a dry run, or change the sandbox profile. A file edit might be allowed only as a patch preview. A shell command might run with a read-only mount, no network, and a temporary filesystem. An email send might require confirmation after showing recipients and body. Every decision should produce an audit event that names the proposal, policy version, grant, result, and evidence.',
        {type: 'image', src: 'https://developer.gs.com/blog/blog-posts/scaling-opa-through-oces/oces_1_v2.png', alt: 'Open Policy Agent policy decision point in a service request path.', caption: 'OPA separates policy decisions from application code and gives the runtime a policy gate. (Source: developer.gs.com)'},
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The permission-lattice view proves that effect authority has shape. No effect, read, draft, write, send, and delete are ordered by blast radius, but the order is not a blanket claim that every read is safe or every write is equal. The table adds the missing dimensions: actor, tool, effect, resource, expiry, and runtime. Together they show why permission must be a record, not a string.',
        'The execution-gate view proves that tool execution is a pipeline. A model proposal flows through schema, identity, scope, policy, sandbox, approval, and audit before any external effect occurs. The final effect is allowed only when those gates agree. If one gate fails, the correct output is not improvisation by the model; it is denial, downgrade, or escalation with evidence. The visual is teaching that the safe boundary lives in the runtime, not in the model text.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates intent from authority. The user can ask for an outcome, the model can propose a plan, and the runtime can still enforce the actual permission boundary. That separation is central to agent systems because the model is exposed to untrusted instructions from web pages, documents, tickets, emails, logs, and tool outputs. The lattice prevents those instructions from silently upgrading the agent from observer to actor.',
        'It also works because it preserves context for review. A denied call is not just a failure; it is security evidence. An approved call is not just a success; it is an auditable event tied to identity, scope, policy, and runtime containment. When an incident happens, the team can ask whether the policy was too broad, the approval text was misleading, the sandbox was weak, or the model proposed something that should become a test case.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is friction and policy maintenance. A lattice that asks for approval on every small action will make the agent feel useless. A lattice with dozens of vague risk levels will be impossible to reason about. The useful version has a small effect taxonomy, clear resource scopes, short-lived grants, and predictable escalation paths. Users should learn the pattern: read can proceed, drafts can be previewed, external sends need confirmation, destructive actions are rare and heavily gated.',
        'There is also engineering cost. Tool manifests must declare effects honestly. Scopes must be enforced at the tool server, not only in the UI. Sandboxes must match the actual risk of code execution, filesystem access, and network egress. Audit logs must be durable enough for review without storing sensitive data carelessly. The lattice does not remove the need for OAuth, capability security, row-level ACLs, policy engines, or operating-system isolation. It coordinates them.',
        {type: 'image', src: 'https://www.docker.com/app/uploads/2026/04/image9.png', alt: 'Docker diagram comparing sandboxing approaches for AI agents.', caption: 'Agent sandboxes matter because shell, file, and network effects need runtime containment. (Source: docker.com)'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'An enterprise operations agent is a good example. It can read CRM rows, summarize account history, draft a customer email, edit a support note, run a diagnostic script, and open an admin ticket. CRM read gets row-level authorization and a query log. Draft email is allowed because it has no external effect. Sending the email requires confirmation and records the message id. File edits require a diff gate. Shell commands run in a constrained sandbox. Admin API calls require break-glass approval tied to a ticket.',
        'The same pattern applies to developer agents, help-desk bots, browser agents, data-analysis assistants, and personal automation. A coding agent may read the repository freely, propose patches, and run safe checks, but it should not publish secrets, delete unrelated files, or push to production without a stronger grant. A browser agent may fill a form, but payment submission or account deletion should sit higher in the lattice. The system is useful because each action gets the amount of agency it deserves.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure mode is treating the lattice as documentation instead of enforcement. If the tool server ignores scopes, a beautiful policy diagram does nothing. The second is issuing broad, long-lived tokens to an agent and trying to recover safety with prompts. The third is letting the model choose the sandbox profile or approval text. The runtime should choose containment and present approval based on policy, not on the model description of its own risk.',
        'The lattice also has limits. It cannot decide business intent by itself. A permitted email can still be a bad email. A permitted file edit can still be wrong. A human approval prompt can be clicked carelessly if it is noisy or vague. The lattice controls authority, not quality. It should be paired with validation, diff previews, dry runs, tests, rate limits, anomaly detection, and clear undo paths where the domain allows reversal.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study capability security and attenuation first. The strongest mental model is that authority should be an explicit, narrow object that can be passed, reduced, expired, and audited. Then study OAuth scopes, MCP authorization, protected resources, policy engines such as OPA, and operating-system sandboxing such as seccomp, containers, and egress allowlists. Those layers provide the mechanics that the lattice organizes.',
        {type: 'image', src: 'https://docs.oracle.com/en/cloud/paas/integration-cloud/rest-api-fs/images/oauth-flow.png', alt: 'OAuth authorization code flow with client, resource owner, authorization server, and resource server.', caption: 'OAuth flow shows how scoped authority should be issued before resource access. (Source: docs.oracle.com)'},
        'After that, study prompt injection threat models, guardrail policy engines, audit log design, approval UX, and incident review. The mature agent platform does not trust the model less because it is weak; it trusts the runtime more because the runtime has the right job. The model proposes. The permission lattice decides how much of that proposal may become an effect.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
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
        'Use this topic as a checkpoint: if you can explain why Agent Tool Permission Lattice moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

