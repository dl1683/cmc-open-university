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
        "Read the animation as the execution trace for Agent Run Trace Span Tree Case Study. An observability case study for agent workflows: trace roots, agent spans, generation spans, tool spans, handoffs, guardrails, approvals, checkpoints, cost, and replay links..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A useful agent does not just call a model. It plans, delegates, calls tools, pauses for approval, trips guardrails, resumes from checkpoints, retries, spends tokens, and finally produces an outcome. When that outcome is wrong or expensive, a flat log line is not enough. The team needs to know which decision led to which action.',
        'An agent run trace span tree gives that workflow a shape. The trace root names the run. Child spans show agent invocations, model generations, tool calls, handoffs, guardrail checks, human approvals, checkpoints, replay links, costs, and final output. It turns an agent run from a story people reconstruct by memory into a structured execution record.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is to log every prompt, every tool result, and every final answer. That feels safe at first because nothing is hidden. In practice it creates a pile of sensitive, unindexed text. It can leak secrets, bury the important decision, and still fail to answer why the run paused, retried, or handed off to another agent.',
        'The wall is causality. Agent failures are usually not single events. A bad prompt can produce a bad tool argument, which can create a guardrail escalation, which can resume from stale state, which can lead to a plausible but wrong final answer. Observability has to preserve the parent-child path, not just the individual messages.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the run as a tree of obligations. The root promises to complete a workflow. An agent span promises to make progress on a role. A generation span promises a model call happened under a prompt version and schema. A tool span promises a side effect or read occurred. A checkpoint promises the run can resume from a named state.',
        'That tree is the natural unit of debugging. A span should explain what happened, what input shape was used, what decision was made, what cost was incurred, what state changed, and which child work followed from it. If the agent can act, the trace must explain the action.',
      ],
    },
    {
      heading: 'Reading the Views',
      paragraphs: [
        'In the span tree view, follow the run from the trace root into agent, generation, tool, handoff, guardrail, approval, checkpoint, cost, and output spans. The important detail is not that every box exists. It is that every consequential step has a parent and enough fields to explain its role in the run.',
        'In the debug loop view, start with the alert and narrow the failure by workflow, model, tool, handoff, approval, checkpoint, or state id. The view shows the ideal incident path: find the suspicious span, connect it to saved state, replay or fork the run, evaluate the fix, then ship only after the traced failure is covered.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every run starts with a trace root. The root carries workflow id, user or tenant grouping when allowed, release version, entrypoint, and correlation ids. Each agent invocation becomes a child span with agent name, role, instructions version, available tools, selected model policy, and the reason it was invoked.',
        'Model generation spans record model, prompt template version, input and output schema names, token counts, latency, finish status, refusal or truncation flags, and compact redacted summaries. Tool spans record tool name, parsed arguments, idempotency key, result summary, error class, retry count, and whether the call read data or caused a side effect.',
        'Agent-specific spans carry the details ordinary service tracing misses. Handoff spans record source agent, target agent, filtered history, and transfer reason. Guardrail spans record pass, fail, or escalate. Approval spans record interruption id and human decision. Checkpoint spans record state id and resume or fork links. Cost fields let the trace answer whether the path was not only correct, but also worth what it spent.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The tree preserves causality. A bad final answer can be traced back through the output span, the generation that produced it, the prompt and retrieved context it saw, the tool result it relied on, and the checkpoint state it resumed from. The trace does not prove the agent was right, but it gives investigators a concrete path to test.',
        'The shared ids matter. A trace without checkpoint links cannot replay the run. A checkpoint without trace links cannot explain why that state exists. A cost ledger without span ids cannot show which tool loop burned the budget. The span tree works because these records point at the same execution, not because any one record is complete by itself.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A customer support agent issues a refund that should have required approval. The alert says refunds above a threshold rose after a deploy. Without a span tree, the team searches logs for account ids, prompt text, and refund calls. With a span tree, they filter to the refund workflow, the new prompt version, and tool spans whose approval child is missing.',
        'One trace shows the path: the agent generated a tool call with a stale policy label, the guardrail span passed because it read the old label, the refund tool span executed with an idempotency key, and the checkpoint span points to the exact state before the call. The fix is not guessed. The team updates the policy mapping, replays the checkpoint, verifies that the approval span now interrupts the run, and adds an eval case before rollout.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Tracing has real cost. It adds instrumentation work, storage, indexing, retention policy, UI design, and latency overhead if implemented badly. More detail is not automatically better. Full prompts, raw documents, secrets, customer data, and large tool payloads should not be sprayed into a trace store.',
        'Production traces should prefer ids, schema names, hashes, redacted arguments, compact summaries, and links to secured artifacts. High-value runs, incidents, approvals, and dangerous tools may need full retention. Low-risk high-volume workflows may need sampling. The target is enough evidence to debug and audit the run without turning observability into a data leak.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Span trees win when agents perform multi-step work: support refunds, coding changes, document review, research synthesis, data cleanup, workflow automation, and any process with tools, approvals, handoffs, or checkpoints. They let teams measure latency, token cost, retry count, approval burden, tool error rate, guardrail false positives, and handoff confusion by workflow slice.',
        'They are also useful as a product surface. A customer-facing or internal run history can show why an agent paused, what it is waiting for, which tool it used, and where a human can safely resume. That is different from a developer-only debug log; it is operational state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A trace can still lie by omission. If tool wrappers do not record parsed arguments, if prompts are unversioned, if checkpoints are not linked, or if handoffs hide filtered context, the tree will look complete while the cause remains outside it. Instrumentation has to cover decisions and side effects, not only latency.',
        'It also fails when teams treat tracing as a substitute for evaluation. A span tree can show exactly how a bad answer happened. It cannot decide that the answer is acceptable. The improvement loop needs replay, tests, evals, and rollout gates connected back to the trace.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: OpenAI Agents SDK tracing at https://openai.github.io/openai-agents-python/tracing/, OpenAI Agents SDK overview at https://developers.openai.com/api/docs/guides/agents, Temporal OpenAI Agents integration at https://temporal.io/blog/announcing-openai-agents-sdk-integration, and OpenTelemetry traces at https://opentelemetry.io/docs/concepts/signals/traces/. Study Agent Workflow DAG Compiler Case Study, Agent Checkpoint Replay Ledger Case Study, Human Approval Interrupt Queue Case Study, GenAI Trace Token Cost Ledger Case Study, Distributed Tracing, OpenTelemetry Collector Case Study, and AI Audit Evidence Packet Case Study next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
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

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for agent-run-trace-span-tree-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
