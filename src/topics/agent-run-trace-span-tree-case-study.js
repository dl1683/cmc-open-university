// Agent run trace span tree: observe model generations, tool calls, handoffs,
// guardrails, approvals, checkpoints, costs, and final outcomes.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-run-trace-span-tree-case-study',
  title: 'Agent Run Trace Span Tree Case Study',
  category: 'AI & ML',
  summary: 'An observability case study for agent workflows: trace roots, agent spans, generation spans, tool spans, handoffs, guardrails, approvals, checkpoints, cost, and replay links.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['span tree', 'debug loop'], defaultValue: 'span tree' },
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

function spanGraph(title) {
  return graphState({
    nodes: [
      { id: 'trace', label: 'trace', x: 0.8, y: 3.5, note: 'run' },
      { id: 'agent', label: 'agent', x: 2.2, y: 3.5, note: 'span' },
      { id: 'gen', label: 'gen', x: 3.8, y: 1.3, note: 'LLM' },
      { id: 'tool', label: 'tool', x: 3.8, y: 3.0, note: 'call' },
      { id: 'handoff', label: 'handoff', x: 3.8, y: 4.7, note: 'agent' },
      { id: 'guard', label: 'guard', x: 5.4, y: 1.3, note: 'check' },
      { id: 'approve', label: 'approve', x: 5.4, y: 3.0, note: 'HITL' },
      { id: 'ckpt', label: 'ck', x: 5.4, y: 4.7, note: 'st' },
      { id: 'cost', label: 'cost', x: 7.2, y: 2.0, note: 'tokens' },
      { id: 'out', label: 'out', x: 7.2, y: 4.3, note: 'result' },
      { id: 'dash', label: 'dash', x: 9.2, y: 3.5, note: 'debug' },
    ],
    edges: [
      { id: 'e-trace-agent', from: 'trace', to: 'agent' },
      { id: 'e-agent-gen', from: 'agent', to: 'gen' },
      { id: 'e-agent-tool', from: 'agent', to: 'tool' },
      { id: 'e-agent-handoff', from: 'agent', to: 'handoff' },
      { id: 'e-gen-guard', from: 'gen', to: 'guard' },
      { id: 'e-tool-approve', from: 'tool', to: 'approve' },
      { id: 'e-handoff-ckpt', from: 'handoff', to: 'ckpt' },
      { id: 'e-guard-cost', from: 'guard', to: 'cost' },
      { id: 'e-approve-cost', from: 'approve', to: 'cost' },
      { id: 'e-ckpt-out', from: 'ckpt', to: 'out' },
      { id: 'e-cost-dash', from: 'cost', to: 'dash' },
      { id: 'e-out-dash', from: 'out', to: 'dash' },
    ],
  }, { title });
}

function debugGraph(title) {
  return graphState({
    nodes: [
      { id: 'alert', label: 'alert', x: 0.8, y: 3.5, note: 'bad run' },
      { id: 'filter', label: 'filter', x: 2.2, y: 3.5, note: 'slice' },
      { id: 'span', label: 'span', x: 3.8, y: 2.0, note: 'find' },
      { id: 'state', label: 'st', x: 3.8, y: 5.0, note: 'ck' },
      { id: 'cause', label: 'cause', x: 5.4, y: 3.5, note: 'why' },
      { id: 'fix', label: 'fix', x: 7.0, y: 2.0, note: 'patch' },
      { id: 'replay', label: 'replay', x: 7.0, y: 5.0, note: 'fork' },
      { id: 'eval', label: 'eval', x: 8.5, y: 3.5, note: 'gate' },
      { id: 'ship', label: 'ship', x: 9.6, y: 3.5, note: 'rollout' },
    ],
    edges: [
      { id: 'e-alert-filter', from: 'alert', to: 'filter' },
      { id: 'e-filter-span', from: 'filter', to: 'span' },
      { id: 'e-filter-state', from: 'filter', to: 'state' },
      { id: 'e-span-cause', from: 'span', to: 'cause' },
      { id: 'e-state-cause', from: 'state', to: 'cause' },
      { id: 'e-cause-fix', from: 'cause', to: 'fix' },
      { id: 'e-cause-replay', from: 'cause', to: 'replay' },
      { id: 'e-fix-eval', from: 'fix', to: 'eval' },
      { id: 'e-replay-eval', from: 'replay', to: 'eval' },
      { id: 'e-eval-ship', from: 'eval', to: 'ship' },
    ],
  }, { title });
}

function tracePlot() {
  return plotState({
    axes: {
      x: { label: 'trace coverage', min: 0, max: 100 },
      y: { label: 'mean debug time', min: 0, max: 10 },
    },
    series: [
      { id: 'debug', label: 'debug', points: [{ x: 10, y: 9 }, { x: 30, y: 7 }, { x: 55, y: 4.3 }, { x: 80, y: 2.2 }, { x: 88, y: 1.6 }] },
      { id: 'noise', label: 'noise', points: [{ x: 10, y: 1 }, { x: 30, y: 2 }, { x: 55, y: 3.6 }, { x: 80, y: 5.8 }, { x: 88, y: 8.5 }] },
    ],
    markers: [
      { id: 'sweet', x: 78, y: 2.3, label: 'useful' },
    ],
  });
}

function* spanTree() {
  yield {
    state: spanGraph('An agent run is a span tree'),
    highlight: { active: ['trace', 'agent', 'gen', 'tool', 'handoff', 'e-trace-agent', 'e-agent-gen', 'e-agent-tool', 'e-agent-handoff'], found: ['dash'] },
    explanation: 'A production agent run should emit a trace root and nested spans for agent invocations, model generations, tool calls, handoffs, guardrails, approvals, checkpoints, and final output.',
    invariant: 'If the agent can act, the trace must explain the action.',
  };

  yield {
    state: labelMatrix(
      'Trace',
      [
        { id: 'root', label: 'rt' },
        { id: 'agent', label: 'agt' },
        { id: 'gen', label: 'gen' },
        { id: 'tool', label: 'tool' },
        { id: 'gate', label: 'gate' },
        { id: 'ckpt', label: 'ck' },
      ],
      [
        { id: 'fields', label: 'fields' },
        { id: 'why', label: 'why' },
      ],
      [
        ['workflow', 'group'],
        ['name/model', 'owner'],
        ['tokens', 'cost'],
        ['args/out', 'effect'],
        ['pass/fail', 'safety'],
        ['state id', 'resume'],
      ],
    ),
    highlight: { active: ['root:fields', 'agent:fields', 'tool:fields', 'gate:fields', 'ckpt:fields'], compare: ['gen:why'] },
    explanation: 'Trace fields need more than latency. They should include workflow name, agent name, model, token counts, tool args, output contracts, guardrail results, approval ids, checkpoint ids, and costs.',
  };

  yield {
    state: spanGraph('Approvals and checkpoints link traces to state'),
    highlight: { active: ['tool', 'approve', 'handoff', 'ckpt', 'cost', 'out', 'e-tool-approve', 'e-handoff-ckpt', 'e-approve-cost', 'e-ckpt-out'], compare: ['gen'] },
    explanation: 'A trace without state cannot resume a run. A checkpoint without trace cannot explain why the run paused. The two ledgers should share ids.',
  };

  yield {
    state: tracePlot(),
    highlight: { active: ['debug', 'sweet'], compare: ['noise'] },
    explanation: 'More tracing helps until it becomes noise or sensitive-data risk. The useful span tree captures decisions, costs, and side effects while redacting unnecessary payloads.',
  };
}

function* debugLoop() {
  yield {
    state: debugGraph('A trace turns an incident into a path'),
    highlight: { active: ['alert', 'filter', 'span', 'state', 'e-alert-filter', 'e-filter-span', 'e-filter-state'], found: ['cause'] },
    explanation: 'When an agent run fails, the first move is to filter by workflow, user cohort, model, tool, handoff, approval, or checkpoint. The trace should point to the smallest suspicious span.',
  };

  yield {
    state: labelMatrix(
      'Bugs',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'tool', label: 'tool' },
        { id: 'handoff', label: 'handoff' },
        { id: 'gate', label: 'gate' },
        { id: 'state', label: 'st' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['bad gen', 'instr'],
        ['bad args', 'schema'],
        ['wrong owner', 'desc'],
        ['false trip', 'rule'],
        ['stale', 'replay'],
      ],
    ),
    highlight: { active: ['prompt:fix', 'tool:fix', 'handoff:fix', 'state:fix'], compare: ['gate:signal'] },
    explanation: 'Different failures need different fixes. Prompt drift, tool schema mismatch, wrong handoff ownership, false guardrail trips, and stale checkpoint state should be visible as distinct span patterns.',
  };

  yield {
    state: debugGraph('Replay closes the observability loop'),
    highlight: { active: ['cause', 'fix', 'replay', 'eval', 'e-cause-fix', 'e-cause-replay', 'e-fix-eval', 'e-replay-eval'], compare: ['ship'] },
    explanation: 'A good trace points to a checkpoint. A good checkpoint allows replay or fork. A good replay feeds evaluation before a fix ships. That loop is how agent systems improve without guessing.',
  };

  yield {
    state: debugGraph('Ship only after the traced fix passes eval'),
    highlight: { active: ['eval', 'ship', 'e-eval-ship'], compare: ['fix', 'replay'] },
    explanation: 'The trace is not complete until it links the incident, root cause, fix candidate, replay result, eval result, and rollout. Otherwise the same agent failure returns under a new name.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'span tree') yield* spanTree();
  else if (view === 'debug loop') yield* debugLoop();
  else throw new InputError('Pick an agent run trace view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An agent run trace span tree is the observability structure for agent workflows. It records the root workflow, agent spans, model generation spans, tool spans, handoff spans, guardrail spans, approval spans, checkpoint links, costs, and final outcomes.',
        'Distributed Tracing explains span trees for ordinary services. GenAI Trace Token Cost Ledger Case Study adds model and token economics. This module adds agent-specific events: handoffs, guardrails, human review, replay ids, and output-contract decisions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every run creates a trace root. Each agent invocation creates a child span. Model generations record model, prompt version, output schema, token counts, and finish status. Tool spans record tool name, parsed args, result summary, idempotency key, and effect. Handoff spans record source, target, filtered history, and reason.',
        'Guardrail spans record pass, fail, or escalate. Human approval spans record interruption id and decision. Checkpoint spans record state id and resume/fork links. Cost fields allow the trace to answer whether an agent path was merely correct or also economically acceptable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tracing can leak sensitive data if payloads are dumped blindly. A production span tree should prefer ids, schema names, hashes, redacted args, compact result summaries, and links to secured artifacts. It should also sample low-risk high-volume runs and retain full traces for incidents, approvals, and high-value workflows.',
        'The trace tree is only useful if developers can filter it by workflow, user cohort, model version, tool, guardrail, approval reason, checkpoint id, and error type. Otherwise observability becomes another pile of logs.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'OpenAI Agents SDK tracing docs describe built-in tracing with events for LLM generations, tool calls, handoffs, guardrails, and custom events: https://openai.github.io/openai-agents-python/tracing/. OpenAI Agents SDK overview says the SDK path fits when the application owns orchestration, tool execution, approvals, and state: https://developers.openai.com/api/docs/guides/agents.',
        'Temporal OpenAI Agents integration notes that agent invocations can run through Temporal Activities and integrate with OpenAI tracing: https://temporal.io/blog/announcing-openai-agents-sdk-integration. OpenTelemetry is the broader tracing vocabulary used across distributed systems: https://opentelemetry.io/docs/concepts/signals/traces/.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A support agent trace can show that a refund tool paused for approval and resumed from a state id. A coding agent trace can show which patch candidate, command, verifier, and repair loop led to the final change. A research agent trace can show which subagent found which source and how the synthesis gate handled contradictions.',
        'The span tree is also a product-quality surface. It lets teams measure agent latency, token cost, retry count, approval burden, guardrail false positives, tool error rates, and handoff confusion by workflow slice.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not log raw secrets, personal data, or full proprietary documents just because they passed through an agent. Do not trace only the final answer; most agent bugs happen in intermediate tool calls, handoffs, approvals, and stale state.',
        'Do not keep traces disconnected from checkpoints. Debugging requires the ability to jump from a bad span to the exact state that produced it, then replay or fork safely.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenAI Agents SDK tracing at https://openai.github.io/openai-agents-python/tracing/, OpenAI Agents SDK overview at https://developers.openai.com/api/docs/guides/agents, Temporal OpenAI Agents integration at https://temporal.io/blog/announcing-openai-agents-sdk-integration, and OpenTelemetry traces at https://opentelemetry.io/docs/concepts/signals/traces/. Study Agent Workflow DAG Compiler Case Study, Agent Checkpoint Replay Ledger Case Study, Human Approval Interrupt Queue Case Study, GenAI Trace Token Cost Ledger Case Study, Distributed Tracing, OpenTelemetry Collector Case Study, and AI Audit Evidence Packet Case Study next.',
      ],
    },
  ],
};
