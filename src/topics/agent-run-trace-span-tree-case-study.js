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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt:'Distributed trace network', caption:'Agent traces form span trees — each tool call, LLM generation, and handoff becomes a child span under the root agent span. Source: Wikimedia Commons, The Opte Project, CC BY 2.5'},
        {type:'callout', text:'An agent trace is not a log — it is a tree. The root span is the agent run. Child spans are LLM calls, tool invocations, guardrail checks, and handoffs. This structure makes it possible to compute critical-path latency, cost attribution, and failure isolation.'},
        'Read the span-tree view as a rooted tree. A trace is the full record of one run, and a span is a timed child record inside that run. Active nodes show spans being created; found nodes show results that can be debugged or aggregated.',
        'Read the debug-loop view from alert to shipped fix. The safe inference is that a useful trace does not stop at showing what happened. It links the bad outcome to the smallest suspicious span, the checkpoint needed for replay, and the evaluation that proves the fix.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An agent run can include model generations, tool calls, handoffs, guardrails, approvals, checkpoints, retries, and final output. A flat log line such as refund processed does not explain which model chose the amount, which tool executed it, which approval was expected, or which policy version was read.',
        'A span tree exists to make the causal chain queryable. Each consequential action has a parent span that explains why it happened. Each child span records the fields needed to debug, replay, audit, and attribute cost.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to log everything. Store full prompts, full outputs, tool arguments, tool results, timestamps, and the final answer. This feels safe because no detail appears to be missing.',
        'Flat logging works for a one-prompt service. There is one request, one model call, and one response, so timestamp order is close to causality. Agent loops break that assumption because they branch, delegate, pause, and resume.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is causality. A support run may hand off from triage to refund agent, call a policy tool, pass a guardrail, skip approval, issue a refund, and produce a final message. In a flat log, those records can look like unrelated events sorted by time.',
        'The other wall is missing absence. If approval should be a child span of a high-value refund tool span, then a missing approval child is visible. In a flat log, the absence of an expected event often disappears unless someone already knows to search for it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model the run as a tree of obligations. The root span represents the whole run. Agent spans own model calls, tool spans, handoff spans, guardrail spans, approval spans, checkpoint spans, and output spans. A child span exists because its parent made a decision.',
        'The key invariant is simple: if the agent can act, the trace must explain the action. A tool span without a parent generation cannot explain why its arguments were chosen. A checkpoint without a trace link cannot explain why that state exists.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The trace root stores run id, workflow, user cohort, release version, and correlation ids. An agent span stores agent name, role, model policy, instruction version, tool list, and invocation reason. A generation span stores model, prompt version, token counts, latency, finish reason, and output schema.',
        'A tool span stores tool name, parsed arguments, result summary, retry count, idempotency key, and whether the tool has side effects. A guardrail span stores rule name, threshold, actual value, and pass or fail. Approval and checkpoint spans link the trace to human decisions and durable state.',
        'The spans share ids with other ledgers. A checkpoint span points to a state record. A cost span points to billing records. An approval span points to a human task. Those cross-links turn tracing from visualization into operational evidence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is causal preservation. Walking from any leaf span to the root reconstructs the decision path without guessing from timestamps. The output came from a generation, under an agent, after a handoff, inside a workflow, with known inputs and state links.',
        'Completeness is also checkable. If the schema says high-value refund tools require an approval child span, missing approval is a structural bug. The tree turns some omissions into detectable gaps instead of silent log absence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tracing costs storage, indexing, instrumentation, and privacy review. A small span might be 500 bytes after compression; a 100-span run is about 50 KB before large payload links. One million such runs would create about 50 GB of trace data before indexes and retention copies.',
        'Cost is behavior because granularity changes what teams can debug. Tracing only roots is cheap but cannot isolate bad tool arguments. Tracing every retrieval chunk is expensive and noisy. A practical system traces decisions and side effects fully, samples low-risk successes, and stores large prompts in access-controlled artifacts instead of every span.',
        'Latency overhead is usually smaller than model latency when spans flush asynchronously. The bigger operational cost is redaction. Tool arguments, model outputs, and user inputs may contain private data, so the instrumentation layer must redact or hash sensitive fields before export.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Customer-support agents use span trees to track refunds, escalations, approvals, and cost per resolution. Coding agents use them to trace file reads, patch decisions, test runs, retry loops, and workspace checkpoints. Research agents use them to attribute answers to retrieval and synthesis spans.',
        'Multi-agent systems use handoff spans to debug delegation. Compliance workflows use approval and guardrail spans to prove review happened. Product teams can expose a filtered version to users so a paused agent can explain what it is waiting for.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when instrumentation misses the decision fields. A generation span without prompt version cannot debug prompt regressions. A tool span without parsed arguments cannot explain a bad side effect. A checkpoint without state id cannot support replay.',
        'It also fails when teams confuse observability with quality. A perfect trace can explain exactly how a bad answer happened. It cannot decide whether the answer is correct unless an evaluator or verifier is attached to the run.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support agent issues a 450 USD refund that should have required approval above 200 USD. Without span tree, an engineer searches logs for refund, amount, account id, prompt text, and approval events. The search returns hundreds of entries and still cannot prove whether approval was expected.',
        'With span tree, the engineer filters workflow customer_support, tool issue_refund, amount greater than 200, and approval child missing. Twelve traces match, all after release v2.4.1. One tree shows refund_agent used prompt_v3.2, check_policy read policy_v2, guardrail passed, and issue_refund had no approval child.',
        'The fix updates the policy reference to v3 and replays from checkpoint ckpt-456. The replay trace now shows approval status pending before issue_refund. The incident adds an eval case: any refund above 200 USD must contain an approval child span before the side-effect tool span.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study OpenAI Agents SDK tracing at https://openai.github.io/openai-agents-python/tracing/, OpenAI Agents SDK overview at https://developers.openai.com/api/docs/guides/agents, OpenTelemetry traces at https://opentelemetry.io/docs/concepts/signals/traces/, and Temporal durable execution at https://docs.temporal.io/temporal. Next study Distributed Tracing, Agent Checkpoint Replay Ledger, Human Approval Interrupt Queue, GenAI Trace Token Cost Ledger, AI Audit Evidence Packet, and Agent Workflow DAG Compiler.',
      ],
    },
  ],
};
