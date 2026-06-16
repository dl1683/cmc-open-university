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
      heading: 'What it is',
      paragraphs: [
        'A human approval interrupt queue is the control-plane record that lets an agent pause before sensitive actions, show a reviewer the exact proposed tool call, and resume from serialized run state after approval or rejection. It connects Agent Tool Permission Lattice, Agent Checkpoint Replay Ledger, and Agent Run Trace Span Tree.',
        'This is not a chat convention. It is a queue of typed interruptions: tool name, parsed args, proposed effect, requester, risk, current state hash, expiration, reviewer, decision, and resume command.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A tool declares whether it needs approval. When the model emits that tool call, the runtime evaluates the rule. If review is required, the run pauses and returns an interruption. The app serializes run state, surfaces the approval packet, collects a decision, and resumes the same run with an approve or reject command.',
        'The approval record should be bound to state. If a price, account, document version, permission, or user intent changes while the item waits in the queue, the system should revalidate before running the action.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Approval improves safety but adds latency and reviewer load. A naive queue that asks people about every minor action turns into rubber stamping. A useful queue applies automatic guardrails first, risk scoring second, and human review only where judgment materially changes the decision.',
        'The hardest design work is the review packet. If reviewers cannot see the exact args, effect, state, policy reason, and reject consequences, they cannot make a meaningful decision.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'OpenAI Agents SDK human-in-the-loop docs describe pausing agent execution until a person approves or rejects sensitive tool calls, with pending approvals surfaced as interruptions and RunState used to serialize and resume: https://openai.github.io/openai-agents-python/human_in_the_loop/. OpenAI guardrails and human review docs explain that guardrails and human review define when a run should continue, pause, or stop: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals.',
        'Microsoft Agent Framework tool approval docs show the same pattern: functions can require human approval, responses surface function approval requests, and the caller passes the approval or rejection back in a later run: https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval. LangGraph time travel docs show that interrupt nodes re-trigger during replay and forks: https://docs.langchain.com/oss/python/langgraph/use-time-travel.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Approval queues fit refunds, cancellations, payments, data exports, shell commands, code edits, external messages, account changes, and any MCP action that touches sensitive resources. They also fit internal operations where a manager wants batch review before an agent changes production state.',
        'A good queue also creates training data for policy. Repeated approvals can become automatic rules. Repeated rejections become better guardrails, clearer tool descriptions, or lower autonomy for that path.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not ask for approval after the side effect. Do not show reviewers a paraphrase when exact arguments matter. Do not resume from stale state. Do not reuse approval across a fork unless the approval scope explicitly allows it.',
        'Do not hide rejection paths. A rejection is not failure; it is a valid workflow outcome that should produce a safe response, trace span, and policy-learning signal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenAI Agents SDK HITL at https://openai.github.io/openai-agents-python/human_in_the_loop/, OpenAI guardrails and human review at https://developers.openai.com/api/docs/guides/agents/guardrails-approvals, Microsoft Agent Framework approvals at https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval, and LangGraph time travel at https://docs.langchain.com/oss/python/langgraph/use-time-travel. Study Agent Workflow DAG Compiler Case Study, Agent Checkpoint Replay Ledger Case Study, Agent Run Trace Span Tree Case Study, Agent Tool Permission Lattice, OPA Rego Policy Decision Graph, and Prompt Injection Threat Model next.',
      ],
    },
  ],
};
