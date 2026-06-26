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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a state machine around a risky tool call. Active nodes are the proposed action, policy rule, or queued approval currently being evaluated; visited nodes are checks already recorded; found nodes are durable decisions that allow a safe branch to continue. A safe inference is that approval is valid only for the exact tool arguments and run state the reviewer saw.',
        {type:'callout', text:'Approval becomes enforceable only when the pause, packet, decision, and resume command are durable state transitions.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'An autonomous workflow eventually reaches actions that have real side effects. It can transfer money, delete data, send an external message, change a production setting, or run a command on a developer machine. A human approval interrupt queue exists so the system can plan the action but must pause before executing it.',
      'The queue turns review into control-plane state. It stores the proposed tool call, normalized arguments, policy reason, serialized run checkpoint, reviewer decision, and final execution result. Without those fields, approval is only a chat interaction and cannot answer who approved what.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to ask the user, Can I run this, whenever the model is about to do something risky. That works in a synchronous demo where the same person sees the whole conversation and answers immediately. It breaks when the run is long, the reviewer is different from the requester, or the system resumes hours later.',
      'Another simple approach is to ask for approval once at the start of a workflow. That grants too much authority because later tool arguments can drift away from what the reviewer imagined. Approval has to bind to a concrete side effect, not to a vague plan.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is state. A safe system must know which run paused, which tool call is waiting, which facts were visible, whether those facts are still fresh, and what branch to take after approval or rejection. If those are missing, the reviewer can click a button without the runtime being able to prove what was approved.',
      'Time makes the wall worse. A refund amount, document version, account permission, ticket status, or user instruction can change while the approval waits. Executing the old tool call after the world changed is a stale approval bug, even if the reviewer made a reasonable decision at the time.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The core insight is to model approval as an interrupt in a resumable state machine. The model emits a tool call, policy marks it gated, the runtime stores an interrupt record, and the run can continue only through a typed approve or reject command. The pause is not a UI event; it is a durable transition.',
      'That design separates safety from conversation style. The reviewer receives a packet with tool name, exact arguments, target resource, predicted effect, policy reason, state hash, expiration time, and reject behavior. The runtime resumes only if the approval matches that packet and passes freshness checks.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The system starts with a permission lattice. Read-only tools may run automatically, while writes, code execution, data export, payments, external communication, and production changes require approval or denial. Policy can depend on amount, resource, tenant, user role, environment, and whether the action is reversible.',
      'When a gated call appears, the runtime serializes the run state and creates one review item. The item includes a unique run id, tool call id, normalized arguments, state hash, requester, policy rule, expiry, and audit span. Approval resumes from the checkpoint; rejection resumes through a safe branch that explains what was blocked and records the reason.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness invariant is that a side effect may execute only if the stored approval matches the stored proposed action and the stored run state is still valid. Duplicate approvals should not run the tool twice, expired approvals should not run, and approvals for stale resource versions should force revalidation. This gives the system replayable evidence instead of relying on memory of a chat.',
      'Rejection also has to be first-class. A rejected action is not an exception that leaves the workflow confused; it is a branch with a known result. That branch updates the trace, preserves the reviewer reason, and gives policy owners feedback about which gates are useful or noisy.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The direct costs are latency, queue storage, reviewer time, notification logic, and checkpoint storage. If 1,000 workflows per day each create 0.3 approvals on average, the team receives 300 review items per day; double-review policies double the human load. A gate that asks about everything trains reviewers to approve without reading.',
      'The deeper cost is packet quality. Reviewers need exact arguments, diffs, resource identifiers, policy reason, user-visible effect, expiry, and reject behavior. A summary like this looks safe is not enough because the approval must survive audit and replay.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This pattern fits rare consequential actions: refunds, cancellations, payroll changes, data exports, production deploys, shell commands, code edits, account merges, and external emails. It also fits agent calls into sensitive MCP tools because tool schemas can name the exact resource and side effect. The queue is strongest when most work is automatic but a few boundaries require human judgment.',
      'It is also useful for policy learning. Repeated approvals for the same low-risk pattern can become candidates for automation, while repeated rejections can become stricter policy or clearer tool schemas. The queue is both a safety control and an evidence source for improving autonomy.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when approval scope is too broad. Approve this workflow is weaker than approve refund 412.18 USD to order O-17 through payment rail card ending 4412 before 3:00 PM. The narrower statement can be checked against the tool call; the broad statement invites drift.',
      'It also fails when the system shows paraphrases instead of exact arguments, requests approval after the side effect, or allows a forked replay to reuse an old approval. Stale state is the common production bug. Every resume path should recheck permissions, resource version, and external values that may have changed.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'An operations agent is asked to refund a customer and close a ticket. Reading the ticket is automatic, drafting the message is automatic, but issuing the refund is gated because it moves money. The interrupt packet shows customer C-104, order O-733, amount 412.18 USD, payment rail, policy reason, current refund eligibility, state hash h91, and expiry in 15 minutes.',
      'The reviewer approves at 10:05. Before execution, the runtime rechecks that order O-733 is still refundable and the amount is still 412.18 USD. If the order changed at 10:04, the approval expires into re-review; if not, the refund executes once and the audit record links reviewer, packet, resume command, tool result, and ticket update.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study OpenAI Agents SDK human-in-the-loop guidance, Microsoft Agent Framework approval patterns, LangGraph interrupts and replay, and policy engines such as OPA Rego. Then study Agent Tool Permission Lattice, Agent Checkpoint Replay Ledger, Agent Run Trace Span Tree, Prompt Injection Threat Model, and Runbook Automation Approval Ledger. The next skill is recognizing which side effects need a durable interrupt instead of a conversational yes.',
    ] },
  ],
};