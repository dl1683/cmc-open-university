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
        'The animation has two views. "Span tree" shows the structural skeleton of a single agent run: trace root, agent span, generation span, tool span, handoff, guardrail, approval, checkpoint, cost aggregation, output, and debug dashboard. "Debug loop" shows the incident workflow: alert, filter, span search, state retrieval, root cause, fix, replay, eval, and ship.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current focus: which span is being created, which filter is narrowing, or which gate is deciding.',
            'Compare nodes show the alternative path or the span that would have caught the bug earlier.',
            'Found nodes are confirmed outcomes: a shipped fix, a verified replay, or a root cause identified.',
          ],
        },
        'In the matrix views, rows are span types or failure classes, columns are properties (fields stored, reason for the field, fix category). Watch the "why" column in the span tree matrix: every field must justify its storage cost.',
        {
          type: 'note',
          text: 'The animation uses a small fixed graph for readability. Production span trees grow to hundreds of spans per run. The data structure is the same -- a rooted tree with typed nodes and shared ids -- but the branching factor, depth, and field count scale with agent complexity.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'An agent application is really just a loop of calling the LLM, executing tools, and getting more input. In production, you need to know what happened inside that loop.',
          attribution: 'OpenAI Agents SDK documentation, "Tracing" (2025)',
        },
        'An agent does not just call a model and return a string. A single customer-support run might invoke two sub-agents, generate four model calls, execute three tool calls (database lookup, policy check, refund API), pause for human approval, trip a guardrail, resume from a checkpoint, and spend $0.18 in tokens. When that run issues a wrong refund, a flat log line -- "refund processed" -- tells the on-call engineer nothing about which decision was wrong.',
        {
          type: 'table',
          headers: ['What happened', 'What a log line says', 'What a span tree says'],
          rows: [
            ['Model hallucinated a policy', '"generation completed"', 'Generation span: model=gpt-4o, prompt_version=v3.2, finish=stop, tokens=342, policy_label=stale_v2'],
            ['Tool called with bad args', '"tool executed"', 'Tool span: name=issue_refund, args={amount:450, currency:USD}, idempotency_key=abc-123, side_effect=true'],
            ['Guardrail passed incorrectly', '"check passed"', 'Guardrail span: rule=refund_threshold, input_label=stale_v2, result=pass, should_have_been=fail'],
            ['Human approval skipped', '(no log)', 'Missing approval child on refund tool span -- the gap is the bug'],
          ],
        },
        'The span tree turns an opaque agent run into a queryable execution record. Every decision has a parent, every side effect has fields, and every gap is visible as a missing child span.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to log everything. Dump the full prompt, the full model output, every tool argument, every tool result, and the final answer into a structured log store. This feels safe because nothing is hidden.',
        {
          type: 'diagram',
          text: 'Flat logging approach:\n\n  run_id: abc-123\n  [log] prompt: "You are a support agent..." (2,400 tokens)\n  [log] generation: "I will look up the account..." (890 tokens)\n  [log] tool_call: issue_refund({amount: 450, ...})\n  [log] tool_result: {status: "ok", ref: "TXN-789"}\n  [log] final_answer: "Your refund of $450 has been issued."\n\n  Total: 5 log entries, ~4KB of text, zero structure',
          label: 'Five log entries tell you what happened but not why or in what order of causation',
        },
        'This works for simple request-response APIs. One prompt, one generation, one answer. The log maps directly to the execution because there is only one causal path.',
        'Teams also reach for existing APM tools -- Datadog, New Relic, Jaeger -- and instrument model calls as HTTP spans. That gives latency, error rates, and throughput dashboards out of the box. For a single-model wrapper service, this is enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Flat logs break when agents loop, branch, and delegate. A support agent that hands off to a refund agent that calls a policy-check tool that trips a guardrail that requires approval creates a five-level causal chain. In a flat log, these appear as five unrelated entries. The investigator has to reconstruct the parent-child relationships by timestamp ordering, and timestamps do not capture causality -- they capture time.',
        {
          type: 'table',
          headers: ['Failure mode', 'Flat log symptom', 'Root cause hidden by'],
          rows: [
            ['Wrong refund amount', 'Tool args look plausible', 'Missing link to which generation produced the args'],
            ['Guardrail false pass', 'Check result = pass', 'No record of which policy version the guardrail read'],
            ['Approval skipped', 'No log entry at all', 'The absence of a log is invisible without a schema that expects it'],
            ['Stale checkpoint resume', 'Run completed normally', 'No link between checkpoint state and the prompt that read it'],
            ['Cost explosion', 'Total tokens = 12,000', 'No breakdown by sub-agent, retry loop, or tool-call fan-out'],
          ],
        },
        'The deeper wall is that agent failures are causal chains, not single events. A bad prompt produces a bad tool argument, which produces a guardrail escalation, which resumes from stale state, which produces a plausible but wrong answer. Debugging requires walking the chain. A flat log makes the chain invisible.',
        {
          type: 'note',
          text: 'Standard distributed tracing (OpenTelemetry) solves the parent-child problem for service calls. But agent spans carry semantics that HTTP spans do not: prompt version, token count, guardrail result, approval decision, checkpoint id, handoff reason. The span tree is distributed tracing plus an agent-specific schema.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model the run as a tree of obligations, not a sequence of events. Each node promises something specific, and its children fulfill or extend that promise.',
        {
          type: 'diagram',
          text: 'Obligation tree for a refund workflow:\n\n  trace (run_id=abc, workflow=customer_support)\n    |-- agent (name=triage, model_policy=fast)\n    |     |-- generation (model=gpt-4o-mini, tokens=120, prompt_v=2.1)\n    |     |-- handoff (to=refund_agent, reason="refund_detected")\n    |\n    |-- agent (name=refund, model_policy=careful)\n          |-- generation (model=gpt-4o, tokens=342, prompt_v=3.2)\n          |-- tool (name=check_policy, args={amount:450}, read_only=true)\n          |     |-- guardrail (rule=refund_threshold, result=pass)\n          |\n          |-- tool (name=issue_refund, args={amount:450}, side_effect=true)\n          |     |-- approval (status=pending, approver=human)\n          |     |-- checkpoint (state_id=ckpt-456, resumable=true)\n          |\n          |-- generation (model=gpt-4o, tokens=89, prompt_v=3.2)\n          |-- output (answer="Refund issued", cost=$0.18)',
          label: 'Every consequential action has a parent span that explains why it happened',
        },
        'The key property: if the agent can act, the trace must explain the action. A tool span without a parent generation cannot explain why those arguments were chosen. A generation without a parent agent cannot explain which role and instructions produced it. A guardrail without a parent tool cannot explain what it was protecting.',
        {
          type: 'quote',
          text: 'Traces are the backbone of observability in the Agents SDK. They capture the complete execution flow of your agentic application, including every LLM call, tool invocation, handoff, and guardrail check.',
          attribution: 'OpenAI Agents SDK documentation, "Tracing" (2025)',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The span tree has six node types, each with a specific field contract.',
        {
          type: 'table',
          headers: ['Span type', 'Required fields', 'Why these fields'],
          rows: [
            ['Trace root', 'run_id, workflow, entrypoint, release_version, correlation_ids', 'Groups all child spans; links to external request; enables filtering by workflow and release'],
            ['Agent', 'name, role, instructions_version, model_policy, tools_available, invocation_reason', 'Identifies which agent acted, under what instructions, with what capabilities'],
            ['Generation', 'model, prompt_template_version, input_schema, output_schema, tokens_in, tokens_out, latency_ms, finish_reason, refusal', 'Makes every model call auditable: what was asked, what was spent, how it ended'],
            ['Tool', 'tool_name, parsed_args, idempotency_key, result_summary, error_class, retry_count, read_only_or_side_effect', 'Distinguishes reads from writes; enables replay safety; catches argument drift'],
            ['Guardrail', 'rule_name, input_hash, result (pass/fail/escalate), threshold, actual_value', 'Makes safety decisions auditable; catches false passes and false trips'],
            ['Checkpoint', 'state_id, serialized_state_hash, resume_link, fork_link, created_at', 'Enables replay and fork; links trace to durable state'],
          ],
        },
        {
          type: 'code',
          language: 'python',
          text: '# Minimal span tree instrumentation (OpenAI Agents SDK style)\nfrom agents import Agent, Runner, trace, agent_span, generation_span, tool_span\n\nasync def run_support(request):\n    with trace("customer_support", metadata={"release": "v2.4.1"}):\n        triage = Agent(name="triage", model="gpt-4o-mini")\n        result = await Runner.run(triage, request)\n\n        # The SDK auto-creates spans for:\n        #   - Each agent invocation (agent_span)\n        #   - Each model call (generation_span)\n        #   - Each tool execution (function_span)\n        #   - Each handoff between agents\n        #   - Each guardrail check\n        # All spans are children of the trace root.\n        # Custom spans can wrap business logic:\n\n        with agent_span("refund_check"):\n            policy = await check_refund_policy(result.amount)\n            with tool_span("issue_refund", input=result.refund_args):\n                if policy.requires_approval:\n                    await request_human_approval(result.refund_args)\n                txn = await issue_refund(result.refund_args)\n        return txn',
        },
        'Three additional span types appear in production systems that flat logging never captures.',
        {
          type: 'bullets',
          items: [
            'Handoff spans record source agent, target agent, filtered conversation history, and the reason for transfer. Without these, multi-agent runs look like disconnected single-agent runs.',
            'Approval spans record the interruption id, the human decision (approve/reject/modify), wait duration, and the exact state presented to the approver. Without these, human-in-the-loop steps are invisible.',
            'Cost spans aggregate token counts, model pricing tiers, tool invocation costs, and external API charges per sub-tree. Without these, budget tracking requires post-hoc log aggregation.',
          ],
        },
        'The spans share ids with external systems. A checkpoint span references a durable state store entry. An approval span references a task queue item. A cost span references a billing event. These cross-references are what make the tree useful for replay, audit, and cost attribution -- not just visualization.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on one property: the tree preserves the causal chain. Every child span was created because its parent span made a decision. Walking the tree from output to root reconstructs the full decision path without timestamp guessing.',
        {
          type: 'diagram',
          text: 'Causal chain for a wrong refund:\n\n  output: "Refund of $450 issued"\n    <-- generation: produced refund_args with stale policy label\n      <-- agent: refund_agent used prompt_v=3.2\n        <-- handoff: triage detected "refund" intent\n          <-- generation: triage model classified request\n            <-- trace: customer_support workflow v2.4.1\n\n  Root cause: prompt_v=3.2 references policy_label=v2,\n  but policy store updated to v3 after deploy.\n  The guardrail read v2 and passed. The tree shows exactly\n  where the stale reference entered the chain.',
          label: 'Walking the tree from leaf to root reconstructs the causal chain',
        },
        {
          type: 'table',
          headers: ['Property', 'How the span tree preserves it'],
          rows: [
            ['Causality', 'Parent-child edges encode "this happened because that decided"'],
            ['Completeness', 'Missing child spans are visible gaps, not silent omissions'],
            ['Reproducibility', 'Checkpoint + trace = enough state to replay or fork the run'],
            ['Auditability', 'Every generation, tool call, and guardrail result has fields, not just a pass/fail bit'],
            ['Cost attribution', 'Token and dollar costs roll up per sub-tree, not just per run'],
          ],
        },
        'The shared-id invariant is what separates a span tree from a pretty log viewer. A trace without checkpoint links cannot replay. A checkpoint without trace links cannot explain why that state exists. A cost ledger without span ids cannot show which tool loop burned the budget. The tree works because these records point at the same execution, not because any single record is self-contained.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost dimension', 'Per-run overhead', 'Scale concern'],
          rows: [
            ['Instrumentation', '50-200 lines of SDK integration', 'One-time; auto-instrumented by agent frameworks'],
            ['Storage', '2-20 KB per run (structured spans)', '1M runs/day = 2-20 GB/day; 10x cheaper than full prompt logging'],
            ['Indexing', 'B-tree on run_id, workflow, timestamp', 'Standard; existing OLAP or trace backends handle this'],
            ['Latency overhead', '<1ms per span creation (async flush)', 'Negligible vs. model generation latency (~500ms-5s)'],
            ['Retention', '7-90 days for normal runs; indefinite for incidents', 'Sampling reduces volume; incident runs get full retention'],
            ['Sensitive data risk', 'Prompt text, tool args, user data in spans', 'Redaction policy required; store hashes and summaries, not raw text'],
          ],
        },
        'The key cost tradeoff is granularity versus noise. Full prompt and response text in every generation span provides maximum debuggability but creates storage cost, sensitive data risk, and signal-to-noise problems. The practical middle ground: store schema names, token counts, finish reasons, and redacted summaries in the span. Link to the full prompt/response in a secured, access-controlled artifact store for incident investigation.',
        {
          type: 'note',
          text: 'The trace coverage vs. debug time curve has a sweet spot around 70-85% coverage. Below that, too many failures land outside the traced path. Above that, the noise from low-value spans (logging every retrieved document chunk, every retry backoff) buries the signal. The animation plot shows this tradeoff.',
        },
        'Sampling is essential for high-volume workflows. Trace 100% of runs that fail, trigger guardrails, or exceed cost thresholds. Sample 1-10% of successful runs for baseline metrics. This reduces storage 10-100x while preserving incident coverage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A customer support agent issues a $450 refund that should have required human approval. The alert fires: refunds above $200 increased 3x after yesterday\'s deploy.',
        {
          type: 'diagram',
          text: 'Investigation without span tree:\n\n  1. Search logs for "refund" + account_id     --> 3,200 results\n  2. Grep for amount > 200                     --> 847 results\n  3. Find the prompt text in a separate log     --> wrong log level, missing\n  4. Check if approval was requested            --> no log entry either way\n  5. Guess: maybe the new prompt skipped approval?\n  6. Read the new prompt diff manually          --> 400 lines changed\n  7. Time to root cause: ~4 hours\n\nInvestigation with span tree:\n\n  1. Filter: workflow=customer_support, tool=issue_refund, amount>200\n  2. Sort by: approval child span missing       --> 12 runs, all after deploy\n  3. Open one trace, walk the tree:\n     trace --> triage_agent --> handoff --> refund_agent\n       --> generation (prompt_v=3.2, policy_label=stale_v2)\n       --> tool (check_policy, result=pass, read policy_v2)\n       --> tool (issue_refund, $450, NO approval child)\n  4. Root cause: prompt_v=3.2 hardcodes policy_label=v2;\n     policy store updated to v3; guardrail read stale label\n  5. Time to root cause: ~15 minutes',
          label: 'The span tree turns a 4-hour grep hunt into a 15-minute tree walk',
        },
        {
          type: 'code',
          language: 'python',
          text: '# Fix, replay, verify, ship\n\n# 1. Fix the policy reference\nprompt_v3_3 = update_policy_label(prompt_v3_2, "v3")\n\n# 2. Replay from checkpoint\nckpt = load_checkpoint("ckpt-456")  # exact pre-refund state\nresult = await replay_from(ckpt, prompt_version="3.3")\n\n# 3. Verify: approval span now exists\nassert result.trace.has_child("approval", parent="issue_refund")\nassert result.trace.span("approval").status == "pending"\n\n# 4. Add eval case to prevent regression\neval_suite.add_case(\n    workflow="customer_support",\n    trigger="refund > 200",\n    expected="approval_span_present",\n    source_incident="INC-2025-0142",\n)',
        },
        'The fix is not guessed. The team updates the policy mapping, replays the checkpoint, verifies that the approval span now interrupts the run, and adds an eval case. The entire path from alert to verified fix is traceable.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Span tree value', 'Key span types used'],
          rows: [
            ['Customer support agents', 'Track refund/escalation decisions, approval compliance, cost per resolution', 'Tool, approval, guardrail, cost'],
            ['Coding agents', 'Trace edit decisions, test results, file access patterns, retry loops', 'Tool (file ops), generation (edit proposals), checkpoint (workspace state)'],
            ['Research/RAG agents', 'Attribute answers to sources, track retrieval quality, measure citation accuracy', 'Tool (retrieval), generation (synthesis), guardrail (hallucination check)'],
            ['Multi-agent orchestration', 'Debug handoff failures, measure delegation overhead, find routing errors', 'Handoff, agent, cost (per sub-agent)'],
            ['Compliance-critical workflows', 'Provide audit trail for regulatory review, prove approval chain', 'Approval, guardrail, checkpoint (full retention)'],
          ],
        },
        'Span trees also serve as a product surface, not just a debug tool. A customer-facing run history can show why an agent paused ("waiting for your approval to process refund"), what tool it used ("looked up order #12345"), and where a human can safely resume. That is operational transparency, not a developer log.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Querying the span tree for operational metrics\nconst metrics = await traceStore.aggregate({\n  workflow: "customer_support",\n  timeRange: "last_7d",\n  groupBy: "agent_name",\n  measures: [\n    "avg(total_tokens)",       // cost per agent\n    "p95(latency_ms)",         // slowest runs\n    "count(guardrail.fail)",   // safety trigger rate\n    "count(approval.pending)", // human bottleneck\n    "avg(tool.retry_count)",   // tool reliability\n  ],\n});',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Lies by omission: if tool wrappers do not record parsed arguments, if prompts are unversioned, if checkpoints are unlinked, or if handoffs hide filtered context, the tree looks complete while the root cause sits outside it. Instrumentation must cover decisions and side effects, not only latency.',
            'Schema drift: span field contracts evolve as agents change. A generation span that recorded "model" but not "prompt_version" in v1 is useless for debugging prompt regressions in v2. Schema versioning for the trace itself is a maintenance cost teams underestimate.',
            'Sensitive data leakage: tool arguments, model outputs, and user inputs in spans can contain PII, credentials, financial data, or proprietary content. Redaction must be built into the instrumentation layer, not applied as a post-hoc filter.',
            'Tracing-as-evaluation fallacy: a span tree can show exactly how a bad answer happened. It cannot decide whether the answer is acceptable. Teams that treat trace coverage as a proxy for quality measurement still ship bad outputs -- they just ship them with excellent audit trails.',
            'Noise at scale: tracing every retry backoff, every embedding lookup, every token in a retrieval pipeline buries the decision-relevant spans. Sampling and span-level importance scoring are necessary, but they introduce their own failure mode: the sampled-out run is the one that fails.',
          ],
        },
        {
          type: 'note',
          text: 'The OpenTelemetry ecosystem provides the transport and storage layer (spans, exporters, collectors, backends). But OpenTelemetry span semantics were designed for service-to-service HTTP calls, not agent reasoning chains. The agent-specific schema -- prompt versions, guardrail results, approval decisions, checkpoint links -- must be layered on top as semantic conventions or custom attributes.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['OpenAI Agents SDK, "Tracing" (2025), openai.github.io/openai-agents-python/tracing/', 'Reference implementation: auto-instrumented spans for agents, generations, tools, handoffs, guardrails'],
            ['OpenAI Agents SDK overview, developers.openai.com/api/docs/guides/agents', 'Agent primitives: agent loop, tool use, handoffs, guardrails, tracing integration'],
            ['OpenTelemetry, "Traces" (2025), opentelemetry.io/docs/concepts/signals/traces/', 'Foundation: span model, context propagation, exporters, semantic conventions'],
            ['Temporal + OpenAI Agents SDK integration (2025), temporal.io/blog/', 'Durable execution: checkpoints, replay, and tracing for long-running agent workflows'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Distributed Tracing and OpenTelemetry Collector Case Study for the transport and storage layer that span trees build on.',
            'State and replay: study Agent Checkpoint Replay Ledger Case Study for how checkpoints enable the replay-from-trace workflow shown in the debug loop view.',
            'Human-in-the-loop: study Human Approval Interrupt Queue Case Study for the approval span semantics and how agents pause and resume around human decisions.',
            'Cost tracking: study GenAI Trace Token Cost Ledger Case Study for per-span cost attribution and budget enforcement across multi-agent runs.',
            'Audit: study AI Audit Evidence Packet Case Study for how span trees feed compliance and regulatory evidence requirements.',
            'Orchestration: study Agent Workflow DAG Compiler Case Study for how the workflow structure that the span tree observes gets defined and compiled.',
          ],
        },
      ],
    },
  ],
};
