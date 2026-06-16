// Agent workflow DAG compiler: turn an open-ended agent plan into explicit
// steps, dependencies, approvals, budgets, output contracts, and trace hooks.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-workflow-dag-compiler-case-study',
  title: 'Agent Workflow DAG Compiler Case Study',
  category: 'AI & ML',
  summary: 'A durable-agent workflow case study: compile goals into typed step DAGs, specialist boundaries, tool contracts, approvals, budgets, and traceable runtime plans.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compile path', 'runtime plan'], defaultValue: 'compile path' },
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

function compilerGraph(title) {
  return graphState({
    nodes: [
      { id: 'goal', label: 'goal', x: 0.6, y: 3.5, note: 'user' },
      { id: 'triage', label: 'triage', x: 2.0, y: 3.5, note: 'agent or flow' },
      { id: 'steps', label: 'steps', x: 3.6, y: 2.0, note: 'nodes' },
      { id: 'deps', label: 'deps', x: 3.6, y: 5.0, note: 'edges' },
      { id: 'policy', label: 'policy', x: 5.2, y: 2.0, note: 'gates' },
      { id: 'budget', label: 'budget', x: 5.2, y: 5.0, note: 'limits' },
      { id: 'dag', label: 'DAG', x: 6.8, y: 3.5, note: 'plan' },
      { id: 'runtime', label: 'run', x: 8.2, y: 3.5, note: 'execute' },
      { id: 'trace', label: 'trace', x: 9.5, y: 3.5, note: 'audit' },
    ],
    edges: [
      { id: 'e-goal-triage', from: 'goal', to: 'triage' },
      { id: 'e-triage-steps', from: 'triage', to: 'steps' },
      { id: 'e-triage-deps', from: 'triage', to: 'deps' },
      { id: 'e-steps-policy', from: 'steps', to: 'policy' },
      { id: 'e-deps-budget', from: 'deps', to: 'budget' },
      { id: 'e-policy-dag', from: 'policy', to: 'dag' },
      { id: 'e-budget-dag', from: 'budget', to: 'dag' },
      { id: 'e-dag-runtime', from: 'dag', to: 'runtime' },
      { id: 'e-runtime-trace', from: 'runtime', to: 'trace' },
    ],
  }, { title });
}

function runtimeGraph(title) {
  return graphState({
    nodes: [
      { id: 'start', label: 'start', x: 0.8, y: 3.5, note: 'input' },
      { id: 'fetch', label: 'fetch', x: 2.4, y: 1.6, note: 'tool' },
      { id: 'classify', label: 'class', x: 2.4, y: 3.5, note: 'LLM' },
      { id: 'draft', label: 'draft', x: 2.4, y: 5.4, note: 'agent' },
      { id: 'approve', label: 'gate', x: 4.4, y: 3.5, note: 'human' },
      { id: 'act', label: 'act', x: 6.0, y: 3.5, note: 'side fx' },
      { id: 'verify', label: 'verify', x: 7.6, y: 2.0, note: 'check' },
      { id: 'repair', label: 'repair', x: 7.6, y: 5.0, note: 'loop' },
      { id: 'ship', label: 'ship', x: 9.4, y: 3.5, note: 'final' },
    ],
    edges: [
      { id: 'e-start-fetch', from: 'start', to: 'fetch' },
      { id: 'e-start-classify', from: 'start', to: 'classify' },
      { id: 'e-start-draft', from: 'start', to: 'draft' },
      { id: 'e-fetch-approve', from: 'fetch', to: 'approve' },
      { id: 'e-classify-approve', from: 'classify', to: 'approve' },
      { id: 'e-draft-approve', from: 'draft', to: 'approve' },
      { id: 'e-approve-act', from: 'approve', to: 'act' },
      { id: 'e-act-verify', from: 'act', to: 'verify' },
      { id: 'e-verify-repair', from: 'verify', to: 'repair' },
      { id: 'e-repair-act', from: 'repair', to: 'act' },
      { id: 'e-verify-ship', from: 'verify', to: 'ship' },
    ],
  }, { title });
}

function compilePlot() {
  return plotState({
    axes: {
      x: { label: 'process explicitness', min: 0, max: 10 },
      y: { label: 'agent autonomy needed', min: 0, max: 10 },
    },
    series: [
      { id: 'flow', label: 'flow', points: [{ x: 1, y: 2 }, { x: 3, y: 3 }, { x: 6, y: 4 }, { x: 8.4, y: 5 }] },
      { id: 'agent', label: 'agent', points: [{ x: 1, y: 8 }, { x: 3, y: 8 }, { x: 6, y: 7 }, { x: 8.4, y: 5 }] },
    ],
    markers: [
      { id: 'function', x: 9, y: 2, label: 'code' },
      { id: 'open', x: 2, y: 8, label: 'agent' },
    ],
  });
}

function* compilePath() {
  yield {
    state: compilerGraph('Compile the goal before adding agents'),
    highlight: { active: ['goal', 'triage', 'steps', 'deps', 'e-goal-triage', 'e-triage-steps', 'e-triage-deps'], found: ['dag'] },
    explanation: 'A durable agent system starts by asking whether the work is a workflow, an agent loop, or a hybrid. If the steps are knowable, compile them into a DAG before giving the model extra freedom.',
    invariant: 'Use agents for uncertainty; use workflows for known control flow.',
  };

  yield {
    state: labelMatrix(
      'DAG',
      [
        { id: 'step', label: 'step' },
        { id: 'agent', label: 'agent' },
        { id: 'tool', label: 'tool' },
        { id: 'deps', label: 'dep' },
        { id: 'gate', label: 'gate' },
        { id: 'out', label: 'out' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['id/type', 'resume'],
        ['owner', 'scope'],
        ['schema', 'safe call'],
        ['parents', 'order'],
        ['policy', 'pause'],
        ['contract', 'merge'],
      ],
    ),
    highlight: { active: ['step:field', 'deps:field', 'gate:field', 'out:field'], compare: ['agent:why', 'tool:why'] },
    explanation: 'The compiler output is a typed table, not a prompt paragraph. Each step needs an id, owner, tool schema, dependency list, approval policy, output contract, budget, and retry envelope.',
  };

  yield {
    state: compilePlot(),
    highlight: { active: ['flow', 'function'], compare: ['agent', 'open'] },
    explanation: 'Microsoft Agent Framework states the blunt rule: use an agent for open-ended or conversational work, and use a workflow when the process has well-defined steps or needs explicit control over execution order.',
  };

  yield {
    state: compilerGraph('The compiled DAG feeds runtime state'),
    highlight: { active: ['policy', 'budget', 'dag', 'runtime', 'trace', 'e-policy-dag', 'e-budget-dag', 'e-dag-runtime', 'e-runtime-trace'], compare: ['triage'] },
    explanation: 'Once compiled, the DAG becomes the durable runtime plan. Checkpoints, human approvals, trace spans, and output validators all attach to the step ids rather than to free-form chat turns.',
  };
}

function* runtimePlan() {
  yield {
    state: runtimeGraph('A hybrid plan isolates uncertainty'),
    highlight: { active: ['start', 'fetch', 'classify', 'draft', 'e-start-fetch', 'e-start-classify', 'e-start-draft'], found: ['approve'] },
    explanation: 'A good runtime plan keeps deterministic work deterministic and lets agents handle only the uncertain parts. Fetching, classifying, drafting, approval, side effects, and verification become separate nodes.',
  };

  yield {
    state: labelMatrix(
      'Plan',
      [
        { id: 'fetch', label: 'get' },
        { id: 'class', label: 'cls' },
        { id: 'draft', label: 'drft' },
        { id: 'gate', label: 'gate' },
        { id: 'act', label: 'act' },
        { id: 'verify', label: 'ver' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['tool', 'timeout'],
        ['LLM', 'bad label'],
        ['agent', 'drift'],
        ['human', 'stale'],
        ['side fx', 'dup'],
        ['check', 'miss'],
      ],
    ),
    highlight: { active: ['fetch:mode', 'class:mode', 'draft:mode', 'gate:mode', 'act:mode', 'verify:mode'], compare: ['act:fail'] },
    explanation: 'The plan should state which nodes are pure model calls, which invoke tools, which pause for people, which perform side effects, and which verify or repair.',
  };

  yield {
    state: runtimeGraph('Approval and verification are first-class nodes'),
    highlight: { active: ['approve', 'act', 'verify', 'repair', 'e-approve-act', 'e-act-verify', 'e-verify-repair', 'e-repair-act'], compare: ['draft'] },
    explanation: 'Side effects should be downstream of gates and upstream of verification. That structure is what lets a production workflow pause, resume, retry, or repair without losing the reason for the action.',
  };

  yield {
    state: labelMatrix(
      'Bad signs',
      [
        { id: 'chat', label: 'chat' },
        { id: 'state', label: 'state' },
        { id: 'side', label: 'side fx' },
        { id: 'merge', label: 'merge' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'smell', label: 'smell' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['all prose', 'typed DAG'],
        ['hidden', 'checkpoint'],
        ['unguarded', 'approval'],
        ['free text', 'schema'],
        ['missing', 'span tree'],
      ],
    ),
    highlight: { active: ['chat:fix', 'state:fix', 'side:fix', 'merge:fix', 'trace:fix'], compare: ['side:smell'] },
    explanation: 'The compiler is paying for clarity. If the state is hidden in a chat transcript, side effects are unguarded, and merges are free text, the system is not durable enough for real operations.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compile path') yield* compilePath();
  else if (view === 'runtime plan') yield* runtimePlan();
  else throw new InputError('Pick an agent workflow compiler view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An agent workflow DAG compiler turns a user goal or product flow into an explicit execution plan: step nodes, dependencies, specialist ownership, tool schemas, approval gates, budget limits, retries, and output contracts. Multi-Agent Orchestration Topologies tells you which coordination shape to use. This module adds the production step: compile that choice into a durable graph.',
        'The core distinction comes up across current agent guidance. Microsoft Agent Framework says to use an agent for open-ended or conversational tasks and a workflow when the process has well-defined steps or requires explicit execution order. Anthropic and the local agentic AI corpus make the same practical point: start simple, add autonomy only where simpler components fail, and keep the plan visible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler first classifies the task: deterministic function, explicit workflow, agent loop, or hybrid. It then builds a typed step table. Each row stores a step id, owner agent or function, input schema, output schema, dependencies, approval policy, timeout, retry rule, budget, and trace name. The result is a DAG that can be executed by a workflow runtime or agent runner.',
        'The design keeps uncertainty localized. A model can choose among tools or draft a response inside one node, but the surrounding control flow stays inspectable. That is what lets Agent Checkpoint Replay Ledger, Human Approval Interrupt Queue, and Agent Run Trace Span Tree attach state to step ids rather than to a vague transcript.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The compiler adds upfront design work, but it reduces operational ambiguity. Without a plan graph, every pause, retry, handoff, and verification step becomes a custom convention inside prompts. With a plan graph, each node has a budget, a failure mode, and a restart boundary.',
        'The tradeoff is rigidity. If a task is genuinely exploratory, overcompiling can choke the agent. The pragmatic approach is a hybrid: deterministic shell around uncertain agent nodes, explicit approvals around side effects, and trace spans around every important action.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Microsoft Agent Framework overview distinguishes agents from workflows and notes graph-based workflows for explicit multi-agent orchestration: https://learn.microsoft.com/en-us/agent-framework/overview/. OpenAI Agents SDK orchestration docs distinguish handoffs from agents-as-tools and advise splitting specialists only when the contract changes: https://developers.openai.com/api/docs/guides/agents/orchestration.',
        'Anthropic Building Effective Agents emphasizes simple, composable patterns before complex agents: https://www.anthropic.com/research/building-effective-agents. The local agentic AI corpus reinforces the same implementation lesson: minimal agents with retrieval, tools, memory, transparency, and carefully designed interfaces are easier to debug and trust than overbuilt multi-agent systems.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A support product can compile triage, refund review, policy lookup, approval, action, and follow-up into a graph. A coding agent can compile issue analysis, reproduction, patch proposal, execution, verification, and PR notes. A research agent can compile question decomposition, source search, contradiction handling, synthesis, and citation audit.',
        'The compiled graph also gives finance and security something to inspect. Token budgets, tool costs, approval pauses, and policy gates are visible records instead of hidden behavior.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not compile a DAG just to decorate an agent. The plan must control execution, checkpoints, approvals, retries, and traces. Do not let every node be a general-purpose agent. That recreates free-form chaos behind a graph UI.',
        'Do not erase the manager/specialist ownership boundary. If the manager owns the final answer, specialists should be tools with bounded outputs. If the specialist owns the next user-facing branch, use a handoff with a clear state envelope.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Microsoft Agent Framework at https://learn.microsoft.com/en-us/agent-framework/overview/, OpenAI Agents SDK overview at https://developers.openai.com/api/docs/guides/agents, OpenAI orchestration and handoffs at https://developers.openai.com/api/docs/guides/agents/orchestration, OpenAI Agents SDK handoffs at https://openai.github.io/openai-agents-python/handoffs/, and Anthropic Building Effective Agents at https://www.anthropic.com/research/building-effective-agents. Study Temporal Workflow Case Study, Multi-Agent Orchestration Topologies, Agent Model Router & Context Handoff Ledger, Agent Checkpoint Replay Ledger Case Study, Human Approval Interrupt Queue Case Study, Agent Run Trace Span Tree Case Study, and Distributed Tracing next.',
      ],
    },
  ],
};
