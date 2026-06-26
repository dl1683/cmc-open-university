// Agentic AI patterns: a control-loop lesson for planning, tool use, memory,
// evaluation, and durable orchestration.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'agentic-ai-patterns-planning-tools-memory',
  title: 'Agentic AI Patterns: Planning, Tools, Memory',
  category: 'AI & ML',
  summary: 'How production agentic systems combine planners, tool calls, observations, memory, evaluators, and workflow boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['control loop', 'production patterns'], defaultValue: 'control loop' },
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

function loopState(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.7, y: 3.6, note: 'goal' },
      { id: 'context', label: 'context', x: 2.1, y: 1.7, note: 'state' },
      { id: 'planner', label: 'planner', x: 3.4, y: 3.6, note: 'next step' },
      { id: 'tool', label: 'tool', x: 5.1, y: 2.0, note: 'act' },
      { id: 'observe', label: 'observe', x: 6.7, y: 3.6, note: 'result' },
      { id: 'memory', label: 'memory', x: 5.0, y: 5.5, note: 'trace' },
      { id: 'eval', label: 'eval', x: 8.2, y: 1.9, note: 'check' },
      { id: 'answer', label: 'answer', x: 8.5, y: 4.9, note: 'done' },
    ],
    edges: [
      { id: 'e-task-context', from: 'task', to: 'context' },
      { id: 'e-context-planner', from: 'context', to: 'planner' },
      { id: 'e-task-planner', from: 'task', to: 'planner' },
      { id: 'e-planner-tool', from: 'planner', to: 'tool' },
      { id: 'e-tool-observe', from: 'tool', to: 'observe' },
      { id: 'e-observe-memory', from: 'observe', to: 'memory' },
      { id: 'e-memory-context', from: 'memory', to: 'context' },
      { id: 'e-observe-eval', from: 'observe', to: 'eval' },
      { id: 'e-eval-planner', from: 'eval', to: 'planner' },
      { id: 'e-eval-answer', from: 'eval', to: 'answer' },
    ],
  }, { title });
}

function workflowState(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.7, y: 3.7, note: 'request' },
      { id: 'router', label: 'router', x: 2.3, y: 3.7, note: 'classify' },
      { id: 'workflow', label: 'workflow', x: 4.0, y: 2.0, note: 'fixed path' },
      { id: 'agent', label: 'agent', x: 4.0, y: 5.2, note: 'open loop' },
      { id: 'tools', label: 'tools', x: 6.0, y: 5.2, note: 'APIs' },
      { id: 'guard', label: 'guard', x: 6.0, y: 2.0, note: 'policy' },
      { id: 'human', label: 'human', x: 7.8, y: 3.7, note: 'review' },
      { id: 'log', label: 'trace log', x: 8.8, y: 1.7, note: 'audit' },
    ],
    edges: [
      { id: 'e-user-router', from: 'user', to: 'router' },
      { id: 'e-router-workflow', from: 'router', to: 'workflow' },
      { id: 'e-router-agent', from: 'router', to: 'agent' },
      { id: 'e-workflow-guard', from: 'workflow', to: 'guard' },
      { id: 'e-agent-tools', from: 'agent', to: 'tools' },
      { id: 'e-tools-agent', from: 'tools', to: 'agent' },
      { id: 'e-agent-guard', from: 'agent', to: 'guard' },
      { id: 'e-guard-human', from: 'guard', to: 'human' },
      { id: 'e-guard-log', from: 'guard', to: 'log' },
    ],
  }, { title });
}

function* controlLoop() {
  const loop = loopState('An agent is a measured observe-act loop');
  const loopNodes = loop.graph.nodes;
  const loopEdges = loop.graph.edges;

  yield {
    state: loop,
    highlight: { active: ['task', 'context', 'planner', 'e-task-context', 'e-context-planner', 'e-task-planner'], compare: ['tool', 'observe', 'eval'] },
    explanation: `Read the ${loopNodes.length}-node loop left to right: ${loopNodes[0].label} and ${loopNodes[1].label} feed the ${loopNodes[2].label}, the planner chooses one bounded action, and the result comes back as ${loopNodes[4].label}. This exists because a single prompt cannot know what the environment will reveal after the first step.`,
  };

  yield {
    state: loopState('Tool calls turn intent into external action'),
    highlight: { active: ['planner', 'tool', 'observe', 'e-planner-tool', 'e-tool-observe'], found: ['eval'] },
    explanation: `ReAct-style systems interleave reasoning and action. A search call, code edit, database query, browser click, or calculator result changes the state that the next ${loopNodes[2].label} decision sees.`,
    invariant: `The ${loopNodes[3].label} action trace is part of the ${loopNodes[1].label}, not decoration.`,
  };

  yield {
    state: loopState('Memory feeds the next decision'),
    highlight: { active: ['observe', 'memory', 'context', 'e-observe-memory', 'e-memory-context'], compare: ['planner'] },
    explanation: `${loopNodes[5].label} can be a short transcript, an episodic scratchpad, a vector store, a ticket state, or a durable workflow history. What matters is retrieval discipline: the next ${loopNodes[2].label} step should read the facts that change the decision.`,
  };

  yield {
    state: loopState('Evaluation closes the loop'),
    highlight: { active: ['observe', 'eval', 'planner', 'answer', 'e-observe-eval', 'e-eval-planner', 'e-eval-answer'], removed: ['e-planner-tool'] },
    explanation: `The ${loopNodes[6].label} node is the stop/go switch. It turns raw ${loopNodes[4].label} into a decision: ${loopNodes[7].label} now, try another action, reject unsafe output, or ask a person. Without this node, the ${loopEdges.length}-edge loop can spend tokens while drifting away from the ${loopNodes[0].label}.`,
  };

  const agentDataRows = [
    { id: 'state', label: 'state object' },
    { id: 'trace', label: 'trace log' },
    { id: 'memory', label: 'memory index' },
    { id: 'budget', label: 'budget' },
  ];
  yield {
    state: labelMatrix(
      'Core agent data structures',
      agentDataRows,
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['goal, plan, observations', 'restart and inspect decisions'],
        ['tool calls and outputs', 'audit and reproduce failures'],
        ['retrievable facts', 'avoid repeating work'],
        ['tokens, time, side effects', 'bound the loop'],
      ],
    ),
    highlight: { active: ['state:stores', 'trace:stores', 'memory:stores', 'budget:why'] },
    explanation: `Agent engineering becomes ordinary systems engineering when the ${agentDataRows.length} loop structures are explicit. ${agentDataRows.map(r => r.label).join(', ')} are the data structures that keep the system controllable.`,
  };
}

function* productionPatterns() {
  const wf = workflowState('Most production systems mix workflows and agents');
  const wfNodes = wf.graph.nodes;
  const wfEdges = wf.graph.edges;

  yield {
    state: wf,
    highlight: { active: ['user', 'router', 'workflow', 'agent', 'e-user-router', 'e-router-workflow', 'e-router-agent'], compare: ['guard', 'human'] },
    explanation: `A deterministic ${wfNodes[2].label} is better when the path is known. An ${wfNodes[3].label} helps when the system must choose its own path through uncertain ${wfNodes[4].label} or changing evidence. The ${wfNodes.length}-node graph shows mature products routing between both.`,
  };

  const patternRows = [
    { id: 'chain', label: 'prompt chain' },
    { id: 'router', label: 'router' },
    { id: 'tool', label: 'tool loop' },
    { id: 'planner', label: 'planner' },
    { id: 'multi', label: 'multi-agent' },
  ];
  yield {
    state: labelMatrix(
      'Common agentic patterns',
      patternRows,
      [
        { id: 'best', label: 'best use' },
        { id: 'risk', label: 'main risk' },
      ],
      [
        ['linear transformations', 'error compounds'],
        ['many task types', 'wrong branch'],
        ['environment feedback', 'unsafe side effect'],
        ['long horizon work', 'bad plan anchors loop'],
        ['specialized roles', 'coordination overhead'],
      ],
    ),
    highlight: { found: ['chain:best', 'router:best', 'tool:best', 'planner:best'], compare: ['multi:risk'] },
    explanation: `The ${patternRows.length} patterns (${patternRows.map(p => p.label).join(', ')}) should match the uncertainty. Do not pay for an ${patternRows[4].label} when a ${patternRows[0].label} or ${patternRows[1].label} is enough.`,
  };

  yield {
    state: workflowState('Guardrails live around actions'),
    highlight: { active: ['agent', 'tools', 'guard', 'human', 'e-agent-tools', 'e-tools-agent', 'e-agent-guard', 'e-guard-human'], found: ['log'] },
    explanation: `The highest-risk boundary is not text generation. It is action at the ${wfNodes[4].label} node: sending email, editing code, moving money, deleting data. The ${wfNodes[5].label} and ${wfNodes[6].label} nodes enforce guardrails around ${wfEdges.length} edges of control flow.`,
    invariant: `Constrain the ${wfNodes[4].label} action channel, not only the prompt.`,
  };

  const failureRows = [
    { id: 'drift', label: 'goal drift' },
    { id: 'poison', label: 'bad context' },
    { id: 'loop', label: 'runaway loop' },
    { id: 'eval', label: 'weak eval' },
  ];
  yield {
    state: labelMatrix(
      'Failure modes and controls',
      failureRows,
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['solves nearby task', 'explicit objective and stop test'],
        ['follows hostile text', 'source trust and isolation'],
        ['keeps spending', 'budgets and max turns'],
        ['looks busy, not correct', 'holdout tasks and traces'],
      ],
    ),
    highlight: { active: ['drift:control', 'poison:control', 'loop:control', 'eval:control'] },
    explanation: `Agentic systems exhibit ${failureRows.length} failure modes (${failureRows.map(f => f.label).join(', ')}). The cure is explicit state plus small evaluators at each boundary.`,
  };

  yield {
    state: workflowState('Durable orchestration preserves long work'),
    highlight: { active: ['workflow', 'agent', 'guard', 'log', 'e-workflow-guard', 'e-agent-guard', 'e-guard-log'], compare: ['tools'] },
    explanation: `Long-running ${wfNodes[3].label} instances need a place to store progress, retries, approvals, and side-effect history. Durable ${wfNodes[2].label} engines write to the ${wfNodes[7].label} node, making the loop restartable instead of trusting one process.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'control loop') yield* controlLoop();
  else if (view === 'production patterns') yield* productionPatterns();
  else throw new InputError(`Pick an agentic AI patterns view, not "${view}".`);
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The control-loop view traces a single agent turn: task and context feed the planner, the planner picks a tool, the tool produces an observation, memory records what matters, and the evaluator decides whether to answer or loop back. The production-patterns view zooms out to show how a router dispatches requests to fixed workflows or open-ended agents, with guards and human review around actions.',
        {type: 'callout', text: 'An agentic system is a bounded observe-act loop, not a larger prompt with more autonomy.'},
        'Active nodes mark the current decision point. Found markers show state that has been confirmed. Compare markers highlight nodes whose role becomes clear by contrast with the active ones. Follow each frame by asking: what changed, what data moved, and what decision gate did the system just pass through.',
        {type: 'image', src: './assets/gifs/agentic-ai-patterns-planning-tools-memory.gif', alt: 'Animated walkthrough of the agentic ai patterns planning tools memory visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A language model behind a single prompt can only reason over information present when the prompt is assembled. It cannot inspect a file that has not been opened, check a database record that has not been retrieved, or recover from a tool error it has not observed. Every task whose solution depends on information revealed during execution is invisible to a one-shot prompt.',
        'Agentic patterns exist to close that gap. They give the model a controlled loop: act, observe the result, update state, decide what to do next. The engineering problem is not making the model "more autonomous." It is building the control plane, the state structures, the tool contracts, and the stop conditions that keep the loop productive and bounded.',
        {type: 'image', src: 'https://www.anthropic.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fanthropic-website%2F4zrzovbb%2Fwebsite%2F190af9f3e10181e47f55c6e5f6c4b9d12c7b72ca-2401x1000.png&w=3840&q=75', alt: 'Augmented LLM diagram with retrieval, tools, and memory.', caption: 'Agentic behavior starts when the model can use external capabilities through a controlled system wrapper. (Source: anthropic.com)'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing every team tries is a bigger prompt. Paste the instructions, the examples, the retrieved documents, the schema, the user message, and the safety rules into one request. For self-contained tasks this works well and is the right choice. It is cheap, fast, deterministic, and easy to test.',
        'The approach stops working the moment the answer depends on something that does not exist yet. A code-repair task needs the compiler error, which requires running the code, which requires a tool call. A research task needs search results, which depend on the query, which depends on what earlier results revealed. You cannot pre-fill a prompt with data the system has not gathered, and you cannot gather it without acting.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hard boundary is this: a single forward pass cannot condition on information produced by its own side effects. The model generates text; it does not execute code, open URLs, or query databases. If the task requires observing the world and then changing the plan based on what was observed, one pass is structurally insufficient no matter how large the context window is.',
        'The failure mode is subtle. A long prompt can look like it covers everything, but the model is guessing about live state instead of checking. It hallucinates file contents instead of reading them. It predicts API responses instead of calling the API. It assumes a fix works instead of running the test. Every such guess is an unverified claim dressed up as a fact, and the user has no way to tell the difference.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An agent is not a smarter prompt. It is a loop where each iteration has an explicit state, a bounded action, a concrete observation, and a decision gate. The insight is structural: make the hidden feedback cycle visible as data, and you can inspect it, test it, budget it, and stop it. Every production-quality agent is ordinary systems engineering applied to model behavior.',
        'The invariant that holds across the loop is: the planner never chooses the next action without the evaluator having approved the previous observation. This prevents the system from drifting silently. If the evaluator is missing or permissive, you get an expensive random walk. If the evaluator is present and sharp, you get a convergent search.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The control loop has eight nodes. A task and its context feed the planner. The planner selects one bounded action from the tool inventory. The tool executes that action against the environment: search, code execution, database query, file edit, browser navigation, API call, or any function with a typed schema. The result returns as an observation, which is structured data, not prose.',
        'Memory records what should survive the current step. It may be a transcript, a scratchpad, a vector store entry, a ticket state update, or a durable workflow checkpoint. The observation and memory update flow into the evaluator. The evaluator is the stop/go gate: answer now, plan another action, reject unsafe output, ask a human, retry with a different tool, or halt because the budget is exhausted. On "continue," control returns to the planner with updated context. On "stop," the system emits the answer.',
        {type: 'image', src: 'https://www.anthropic.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fanthropic-website%2F4zrzovbb%2Fwebsite%2F5b9c0a01e12394af32de92f2e36011ac8c0d4f94-2401x1000.png&w=3840&q=75', alt: 'Autonomous agent loop with environment feedback.', caption: 'The agent loop depends on repeated action, observation, and replanning rather than one-pass generation. (Source: anthropic.com)'},
        'The production-patterns view adds routing. Not every request needs an open-ended agent. A router classifies the request and sends it to a fixed workflow when the path is known, or to an agent when the path depends on observations. Guards enforce policy around actions, human review handles high-stakes ambiguity, and a trace log records every decision for audit and replay.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The loop works because it reduces an open-ended problem to a sequence of bounded, checkable steps. Each step has a pre-condition (the current state and plan), an action (the tool call), a post-condition (the observation), and a gate (the evaluator). If the evaluator rejects, the system replans without committing to a bad path. If the evaluator accepts, the system advances with verified state.',
        'This is the same structure as a transaction log in a database or a supervisor tree in a distributed system. Progress is durable because state is explicit. Failures are recoverable because the trace records what happened. Runaway behavior is bounded because the evaluator enforces budgets and stop conditions. The alternative, letting the model auto-regressively generate an arbitrarily long action sequence without checkpoints, has no mechanism to catch errors until the entire sequence is complete.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every loop iteration costs model inference, tool latency, and context growth. A five-turn agent run may cost five times the tokens of a single prompt, plus tool-call overhead. The trade-off is accuracy: if the task genuinely requires observing the environment, the one-shot prompt produces a guess while the agent produces a verified result. If the task does not require observation, the agent is pure waste.',
        'The four core data structures are: the state object (goal, plan, observations, permissions, budget), the trace log (tool calls, inputs, outputs, timestamps, errors), the memory index (retrievable facts scoped by relevance and trust), and the budget counter (tokens consumed, turns elapsed, side effects created). If any of these lives only inside the transcript instead of as explicit data, the system becomes hard to restart, test, or audit.',
        'Memory design matters more than memory volume. Transcript dumping inflates the context, repeats stale facts, and lets unrelated text steer the model. A disciplined memory system stores source, timestamp, confidence, privacy scope, and invalidation rules. It separates user instructions from retrieved documents, because tool outputs and web pages can contain adversarial text.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Coding agents fix bugs by reading the repo, locating the failing test, editing code, running the test, observing the error, and iterating until the test passes. Each tool result changes the next plan. The loop shape is identical for research agents that retrieve sources, check contradictions, draft, validate claims, and cite evidence.',
        'Customer-support triage agents read tickets, check account status, search known incidents, propose resolutions, and escalate when the action requires human authority. DevOps agents monitor alerts, pull logs, correlate incidents, apply runbooks, and stop when the metric recovers or the escalation threshold is hit. In every case, the value comes from the control plane, not from the label "agent."',
        'Production systems almost always mix patterns. A router sends routine requests to deterministic workflows (cheap, testable, compliant) and uncertain requests to agents (flexible, but more expensive and harder to predict). The engineering discipline is choosing the cheapest reliable pattern for each request type.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Goal drift is the most common failure. The latest observation is more salient than the original objective, so the loop starts solving a nearby problem instead. Context poisoning happens when retrieved text or tool output contains instructions the model should not follow. Runaway loops happen when there is no budget, no max-turn limit, and no stop condition. Tool misuse happens when action schemas are vague or permission checks are missing.',
        'Multi-agent systems add coordination failures on top of single-agent failures. Specialized agents can duplicate work, disagree without resolution, hide assumptions in summaries, or pass lossy context that drops critical evidence. More agents do not automatically mean more intelligence; they often mean more state synchronization bugs. Use multi-agent patterns only when roles are genuinely different and outputs can be independently verified.',
        {type: 'image', src: 'https://www.anthropic.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fanthropic-website%2F4zrzovbb%2Fwebsite%2F8985fc683fae4780fb34eab1365ab78c7e51bc8e-2401x1000.png&w=3840&q=75', alt: 'Evaluator-optimizer workflow diagram.', caption: 'Evaluator loops make stopping and revision explicit instead of letting the agent drift. (Source: anthropic.com)'},
        'False confidence is the quiet killer. An evaluator that checks formatting but not correctness lets the agent produce polished wrong answers. Layered evaluation helps: parseability tests catch malformed calls, permission checks catch forbidden actions, integration tests catch regressions, retrieval tests catch missing evidence, cost monitors catch runaway loops, and human review handles high-impact ambiguity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A coding agent receives the task "fix the failing CSV parser test." Step 1: the planner reads the test file and observes the assertion error. Step 2: the planner opens the parser module and identifies the delimiter-handling function. Step 3: the planner edits the function to handle escaped delimiters. Step 4: the tool runs the test suite. The observation reports a new failure on a different edge case. Step 5: the planner adjusts the patch. Step 6: the test passes. The evaluator checks that no other tests regressed and emits the answer.',
        'Notice the structure. Each step has a concrete tool call, a concrete observation, and a concrete evaluator check. The agent did not guess what the error would say; it read it. It did not assume the fix worked; it ran the test. If step 4 had passed on the first try, the loop would have been shorter. If step 6 had failed, the loop would have continued. The agent\'s quality comes from the loop discipline, not from the model\'s ability to predict compiler output.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Anthropic Building Effective Agents (https://www.anthropic.com/research/building-effective-agents), ReAct: Synergizing Reasoning and Acting (https://arxiv.org/abs/2210.03629), Toolformer (https://arxiv.org/abs/2302.04761), Reflexion (https://arxiv.org/abs/2303.11366), and Anthropic Writing Tools for Agents (https://www.anthropic.com/engineering/writing-tools-for-agents).',
        'Study Agent Model Router & Context Handoff Ledger for the routing and context-transfer problem. Study Agent Memory & Context Engineering Case Study for memory design. Study Multi-Agent Orchestration Topologies for coordination patterns. Study Prompt Injection Threat Model for the context-poisoning attack surface. Study Distributed Tracing, Saga Pattern, and Idempotency & Exactly-Once Delivery for the systems-engineering foundations that agent control planes borrow from.',
      ],
    },
  ],
};

