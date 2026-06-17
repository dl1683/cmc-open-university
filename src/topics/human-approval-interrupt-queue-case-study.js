// Human approval interrupt queue: pause sensitive agent work, surface review
// items, capture approval decisions, and resume from serialized run state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'human-approval-interrupt-queue-case-study',
  title: 'Human Approval Interrupt Queue Case Study',
  category: 'AI & ML',
  summary: 'A human-in-the-loop control-plane case study: approval rules, interrupt records, review queues, stale-state checks, approve/reject commands, resume, and audit spans.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['approval queue', 'policy gates'], defaultValue: 'approval queue' },
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

function approvalGraph(title) {
  return graphState({
    nodes: [
      { id: 'call', label: 'call', x: 0.7, y: 3.5, note: 'tool' },
      { id: 'rule', label: 'rule', x: 2.1, y: 3.5, note: 'needs?' },
      { id: 'pause', label: 'pause', x: 3.6, y: 3.5, note: 'interrupt' },
      { id: 'queue', label: 'queue', x: 5.1, y: 2.0, note: 'review' },
      { id: 'state', label: 'state', x: 5.1, y: 5.0, note: 'serialize' },
      { id: 'human', label: 'human', x: 6.8, y: 2.0, note: 'decide' },
      { id: 'cmd', label: 'cmd', x: 6.8, y: 5.0, note: 'resume' },
      { id: 'run', label: 'run', x: 8.3, y: 3.5, note: 'continue' },
      { id: 'audit', label: 'audit', x: 9.6, y: 3.5, note: 'span' },
    ],
    edges: [
      { id: 'e-call-rule', from: 'call', to: 'rule' },
      { id: 'e-rule-pause', from: 'rule', to: 'pause' },
      { id: 'e-pause-queue', from: 'pause', to: 'queue' },
      { id: 'e-pause-state', from: 'pause', to: 'state' },
      { id: 'e-queue-human', from: 'queue', to: 'human' },
      { id: 'e-state-cmd', from: 'state', to: 'cmd' },
      { id: 'e-human-cmd', from: 'human', to: 'cmd' },
      { id: 'e-cmd-run', from: 'cmd', to: 'run' },
      { id: 'e-run-audit', from: 'run', to: 'audit' },
    ],
  }, { title });
}

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.8, y: 3.5, note: 'request' },
      { id: 'guard', label: 'guard', x: 2.3, y: 1.6, note: 'auto' },
      { id: 'risk', label: 'risk', x: 2.3, y: 5.4, note: 'score' },
      { id: 'low', label: 'auto', x: 4.1, y: 1.6, note: 'safe' },
      { id: 'review', label: 'review', x: 4.1, y: 3.5, note: 'human' },
      { id: 'deny', label: 'deny', x: 4.1, y: 5.4, note: 'stop' },
      { id: 'tool', label: 'tool', x: 6.2, y: 2.3, note: 'execute' },
      { id: 'reject', label: 'reject', x: 6.2, y: 4.8, note: 'msg' },
      { id: 'trace', label: 'trace', x: 8.2, y: 3.5, note: 'why' },
      { id: 'learn', label: 'learn', x: 9.5, y: 3.5, note: 'policy' },
    ],
    edges: [
      { id: 'e-input-guard', from: 'input', to: 'guard' },
      { id: 'e-input-risk', from: 'input', to: 'risk' },
      { id: 'e-guard-low', from: 'guard', to: 'low' },
      { id: 'e-risk-review', from: 'risk', to: 'review' },
      { id: 'e-risk-deny', from: 'risk', to: 'deny' },
      { id: 'e-low-tool', from: 'low', to: 'tool' },
      { id: 'e-review-tool', from: 'review', to: 'tool' },
      { id: 'e-review-reject', from: 'review', to: 'reject' },
      { id: 'e-tool-trace', from: 'tool', to: 'trace' },
      { id: 'e-reject-trace', from: 'reject', to: 'trace' },
      { id: 'e-trace-learn', from: 'trace', to: 'learn' },
    ],
  }, { title });
}

function queuePlot() {
  return plotState({
    axes: {
      x: { label: 'queue age minutes', min: 0, max: 120 },
      y: { label: 'resume safety', min: 0, max: 10 },
    },
    series: [
      { id: 'stable', label: 'stable', points: [{ x: 0, y: 9 }, { x: 20, y: 8.5 }, { x: 60, y: 7.6 }, { x: 104, y: 6.8 }] },
      { id: 'drift', label: 'drift', points: [{ x: 0, y: 9 }, { x: 20, y: 6.5 }, { x: 60, y: 3.2 }, { x: 104, y: 1.2 }] },
    ],
    markers: [
      { id: 'ttl', x: 45, y: 4.8, label: 'reval' },
    ],
  });
}

function* approvalQueue() {
  yield {
    state: approvalGraph('Approval turns a tool call into an interrupt'),
    highlight: { active: ['call', 'rule', 'pause', 'queue', 'state', 'e-call-rule', 'e-rule-pause', 'e-pause-queue', 'e-pause-state'], found: ['cmd'] },
    explanation: 'A human-in-the-loop flow evaluates a tool-call approval rule, pauses the run, surfaces an interruption to a review queue, serializes run state, and waits for an approve or reject command.',
    invariant: 'Approval is a resumable state transition, not a side chat.',
  };

  yield {
    state: labelMatrix(
      'HITL',
      [
        { id: 'tool', label: 'tool' },
        { id: 'args', label: 'args' },
        { id: 'risk', label: 'risk' },
        { id: 'state', label: 'st' },
        { id: 'ttl', label: 'ttl' },
        { id: 'user', label: 'user' },
      ],
      [
        { id: 'show', label: 'show' },
        { id: 'why', label: 'why' },
      ],
      [
        ['name', 'intent'],
        ['parsed', 'scope'],
        ['score', 'triage'],
        ['hash', 'stale?'],
        ['expiry', 'recheck'],
        ['actor', 'audit'],
      ],
    ),
    highlight: { active: ['tool:show', 'args:show', 'state:show', 'ttl:show', 'user:show'], compare: ['risk:why'] },
    explanation: 'The reviewer needs a structured packet: tool name, parsed arguments, proposed effect, state hash, expiration, risk score, and what will happen if approved or rejected.',
  };

  yield {
    state: queuePlot(),
    highlight: { active: ['drift', 'ttl'], compare: ['stable'] },
    explanation: 'Approval queues create time. The longer a run waits, the more likely external facts, authorization, inventory, price, or user intent drift. A TTL should force revalidation before resume.',
  };

  yield {
    state: approvalGraph('Resume re-enters the original run'),
    highlight: { active: ['human', 'cmd', 'run', 'audit', 'e-human-cmd', 'e-cmd-run', 'e-run-audit'], compare: ['queue'] },
    explanation: 'OpenAI Agents SDK exposes approval interruptions and RunState serialization so an app can approve or reject later and resume the same top-level run. The audit span should include who decided, what state they saw, and what command resumed the workflow.',
  };
}

function* policyGates() {
  yield {
    state: gateGraph('Guardrails, risk rules, and human review compose'),
    highlight: { active: ['input', 'guard', 'risk', 'low', 'review', 'deny', 'e-input-guard', 'e-input-risk'], found: ['trace'] },
    explanation: 'A serious approval system has more than one gate. Guardrails can block or redact automatically, risk scoring can route to review, and human approval can pause before side effects.',
  };

  yield {
    state: labelMatrix(
      'Gate',
      [
        { id: 'read', label: 'read' },
        { id: 'write', label: 'write' },
        { id: 'money', label: 'money' },
        { id: 'shell', label: 'shell' },
        { id: 'data', label: 'data' },
      ],
      [
        { id: 'default', label: 'default' },
        { id: 'need', label: 'need' },
      ],
      [
        ['allow', 'log'],
        ['review', 'diff'],
        ['review', 'limit'],
        ['review', 'sandbox'],
        ['deny/rev', 'policy'],
      ],
    ),
    highlight: { active: ['write:default', 'money:default', 'shell:need', 'data:need'], compare: ['read:default'] },
    explanation: 'The approval lattice should follow effect. Read-only tools can often run automatically. Writes, payments, shell commands, data export, and sensitive MCP actions usually need stronger rules or human review.',
  };

  yield {
    state: gateGraph('Reject is also a workflow path'),
    highlight: { active: ['review', 'reject', 'trace', 'learn', 'e-review-reject', 'e-reject-trace', 'e-trace-learn'], compare: ['tool'] },
    explanation: 'A rejection should not vanish. The system should return a safe message, update the trace, preserve the reviewer reason, and use the pattern to improve future approval rules.',
  };

  yield {
    state: labelMatrix(
      'Review debt',
      [
        { id: 'spam', label: 'spam' },
        { id: 'rubber', label: 'rubber' },
        { id: 'stale', label: 'stale' },
        { id: 'weak', label: 'weak UI' },
        { id: 'noaudit', label: 'no audit' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['too many', 'risk tune'],
        ['approve all', 'batch+policy'],
        ['old state', 'TTL'],
        ['hidden args', 'packet'],
        ['no reason', 'span'],
      ],
    ),
    highlight: { active: ['spam:fix', 'stale:fix', 'weak:fix', 'noaudit:fix'], compare: ['rubber:symptom'] },
    explanation: 'Human review fails when it becomes noise. The goal is not to ask people about everything; it is to reserve attention for actions where human judgment changes risk.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'approval queue') yield* approvalQueue();
  else if (view === 'policy gates') yield* policyGates();
  else throw new InputError('Pick a human approval interrupt view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'An autonomous workflow eventually reaches actions where a wrong step is not just a bad answer. It can send money, delete data, change an account, run a shell command, email a customer, or expose private information. A human approval interrupt queue exists for that boundary: the system is allowed to plan the action, but it must pause before the side effect.',
        'The queue turns approval into a real control-plane state, not a message in a chat transcript. It records the proposed tool call, the exact arguments, the reason review is required, the serialized run state, the reviewer decision, and the command used to resume or reject the run.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to ask the user a question whenever the model is about to do something risky: "Can I run this?" That is simple to build, but it breaks down as soon as the workflow is asynchronous, multi-step, or operated by a reviewer who is not sitting in the same chat.',
        'The wall is state. The system has to know exactly which run is paused, which tool call is waiting, which state snapshot the reviewer saw, whether that state is still fresh, and what should happen after either approval or rejection. Without that, approval becomes theater: people click a button, but the system cannot prove what they approved.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Approval should be modeled as an interrupt in a state machine. The agent emits a tool call, policy decides that it cannot execute yet, the runtime records an interrupt, and the run becomes resumable only through a typed approve or reject command.',
        'That insight separates safety from conversation design. The reviewer is not being asked to trust a summary. They are shown a structured packet: tool name, parsed arguments, target resource, predicted effect, risk reason, state hash, expiration time, and the consequences of reject.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the approval queue view, follow the proposed tool call as it moves from rule evaluation to pause, queue, serialized state, human decision, resume command, and audit span. The important step is not the button; it is the preservation of enough state to resume the original run safely.',
        'In the policy gates view, read the graph as a routing lattice. Low-risk actions can execute automatically, high-risk or ambiguous actions go to review, and forbidden actions stop. The useful question at each frame is: what evidence would a reviewer need to make this decision without guessing?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A production implementation starts with a permission lattice. Read-only tools may be allowed by default. Writes, external messages, payments, code execution, private-data export, and production changes usually require stronger policy. The policy can be static, risk-scored, or context-dependent.',
        'When the model requests a gated tool, the runtime does not execute it. It creates an interrupt record, serializes the run, stores the proposed call, and publishes a review item. The reviewer can approve, reject, request changes, or let the item expire. Approval resumes the same run from the stored checkpoint. Rejection resumes through a safe branch that explains what was blocked.',
        'The record should also carry freshness rules. If a price, document version, account permission, inventory count, or user instruction changes while the item waits, the system should force revalidation before executing the tool.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the approval is bound to three things at once: the proposed effect, the run state, and the reviewer identity. That gives the system a durable answer to "who approved what, based on which facts, and what happened next?"',
        'It also works because it makes rejection a first-class path. A rejected action should not leave the run confused. It should produce a safe response, update the trace, preserve the reviewer reason, and give policy owners feedback for future rules.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Approval adds latency, queue management, state storage, reviewer load, and product design work. A queue that asks about everything trains people to approve without reading. A queue that asks too rarely leaves dangerous actions on the automatic path.',
        'The hard part is not the modal. It is the packet. Reviewers need exact arguments, resource identifiers, diffs, policy reason, user-visible effect, expiration, and reject behavior. If those are missing, human review becomes a liability because it creates confidence without comprehension.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Define the approval object as a durable record. It should include run id, tool call id, tool name, normalized arguments, state hash, requester, reviewer, approval status, expiry, policy rule, decision reason, and final execution result. If any of those are missing, later audit will have to infer what happened.',
        'Treat time as a risk factor. A queued approval should expire when the facts it relied on may have changed. Resume should recheck permissions, resource version, user intent, and any external value such as price, inventory, or account state before executing the approved side effect.',
        'Measure reviewer load. Track queue size, age, approval rate, rejection reasons, stale expirations, and repeated approvals for the same policy. Those metrics tell you which gates need automation, clearer packets, or stricter denial.',
      ],
    },
    {
      heading: 'Testing it',
      paragraphs: [
        'Test approval as a state machine. A gated tool call should pause without side effects, serialize state, create one review item, resume exactly once after approval, and follow a safe path after rejection. Duplicate approvals, expired approvals, and approvals for stale state should not execute the tool.',
        'Also test audit replay. Given the audit record, an investigator should be able to reconstruct what the reviewer saw, why the action was gated, who approved it, what command resumed the run, and what side effect occurred. If replay needs chat memory or guesswork, the control plane is under-specified.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern is strongest for rare but consequential actions: refunds, cancellations, payroll changes, data exports, production deploys, shell commands, code edits, account merges, external messages, and agent calls into sensitive MCP tools.',
        'It is also useful for policy learning. Repeated approvals can become candidates for safe automation. Repeated rejections can become better guardrails, narrower tool schemas, clearer user prompts, or lower autonomy on that path.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when approvals are too broad. "Approve this workflow" is weaker than "approve this exact transfer of $412.18 from account A to vendor B before 3:00 PM." Scope matters because later steps may drift away from what the reviewer understood.',
        'It also fails when state is stale, when reviewers see paraphrases instead of exact arguments, when approval is requested after the side effect, or when a forked replay reuses an old approval outside its original scope.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An operations agent is asked to refund a customer and close a support ticket. Reading the ticket history is automatic. Drafting the refund is automatic. Issuing the refund is gated because it moves money. The interrupt packet shows customer id, order id, amount, payment rail, reason, policy match, ticket link, current account status, and the message that will be sent after approval.',
        'A reviewer approves after checking the order. Before resume, the system revalidates that the order is still refundable and the amount is unchanged. The refund tool runs, the ticket is updated, and the audit span records the reviewer, state hash, approval time, tool arguments, and final result. If the order had changed, the queued item would expire and return to review instead of executing stale work.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references: OpenAI Agents SDK human-in-the-loop docs, OpenAI guardrails and approvals docs, Microsoft Agent Framework tool approval docs, and LangGraph interrupt or replay documentation. Study Agent Tool Permission Lattice, Agent Checkpoint Replay Ledger, Agent Run Trace Span Tree, OPA Rego Policy Decision Graph, and Prompt Injection Threat Model next.',
      ],
    },
  ],
};
