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
  yield {
    state: loopState('An agent is a measured observe-act loop'),
    highlight: { active: ['task', 'context', 'planner', 'e-task-context', 'e-context-planner', 'e-task-planner'], compare: ['tool', 'observe', 'eval'] },
    explanation: 'The useful mental model is not a magic chatbot. It is a control loop. The system receives a task, builds context, chooses a next action, observes the environment, and decides whether to continue or stop.',
  };

  yield {
    state: loopState('Tool calls turn intent into external action'),
    highlight: { active: ['planner', 'tool', 'observe', 'e-planner-tool', 'e-tool-observe'], found: ['eval'] },
    explanation: 'ReAct-style systems interleave reasoning and action. A search call, code edit, database query, browser click, or calculator result changes the state that the next decision sees.',
    invariant: 'The action trace is part of the state, not decoration.',
  };

  yield {
    state: loopState('Memory feeds the next decision'),
    highlight: { active: ['observe', 'memory', 'context', 'e-observe-memory', 'e-memory-context'], compare: ['planner'] },
    explanation: 'Memory can be a short transcript, an episodic scratchpad, a vector store, a ticket state, or a durable workflow history. What matters is retrieval discipline: the next step should read the facts that change the decision.',
  };

  yield {
    state: loopState('Evaluation closes the loop'),
    highlight: { active: ['observe', 'eval', 'planner', 'answer', 'e-observe-eval', 'e-eval-planner', 'e-eval-answer'], removed: ['e-planner-tool'] },
    explanation: 'Evaluation is the difference between autonomous progress and aimless iteration. The evaluator can be a parser, test suite, permission check, rubric, retrieval citation check, or human approval gate.',
  };

  yield {
    state: labelMatrix(
      'Core agent data structures',
      [
        { id: 'state', label: 'state object' },
        { id: 'trace', label: 'trace log' },
        { id: 'memory', label: 'memory index' },
        { id: 'budget', label: 'budget' },
      ],
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
    explanation: 'Agent engineering becomes ordinary systems engineering when the loop state is explicit. State, trace, memory, and budgets are the data structures that keep the system controllable.',
  };
}

function* productionPatterns() {
  yield {
    state: workflowState('Most production systems mix workflows and agents'),
    highlight: { active: ['user', 'router', 'workflow', 'agent', 'e-user-router', 'e-router-workflow', 'e-router-agent'], compare: ['guard', 'human'] },
    explanation: 'A deterministic workflow is better when the path is known. An agent helps when the system must choose its own path through uncertain tools or changing evidence. Mature products usually route between both.',
  };

  yield {
    state: labelMatrix(
      'Common agentic patterns',
      [
        { id: 'chain', label: 'prompt chain' },
        { id: 'router', label: 'router' },
        { id: 'tool', label: 'tool loop' },
        { id: 'planner', label: 'planner' },
        { id: 'multi', label: 'multi-agent' },
      ],
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
    explanation: 'The pattern should match the uncertainty. Do not pay for an agent when a prompt chain or router is enough. Do not pretend a fixed workflow is enough when the task needs environment feedback.',
  };

  yield {
    state: workflowState('Guardrails live around actions'),
    highlight: { active: ['agent', 'tools', 'guard', 'human', 'e-agent-tools', 'e-tools-agent', 'e-agent-guard', 'e-guard-human'], found: ['log'] },
    explanation: 'The highest-risk boundary is not text generation. It is action: sending email, editing code, moving money, deleting data, filing a ticket, or exposing private context. Guardrails belong around tools and outputs.',
    invariant: 'Constrain the action channel, not only the prompt.',
  };

  yield {
    state: labelMatrix(
      'Failure modes and controls',
      [
        { id: 'drift', label: 'goal drift' },
        { id: 'poison', label: 'bad context' },
        { id: 'loop', label: 'runaway loop' },
        { id: 'eval', label: 'weak eval' },
      ],
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
    explanation: 'Agentic systems fail like distributed systems: state is stale, inputs are hostile, retries hide bugs, and observability arrives late. The cure is explicit state plus small evaluators at each boundary.',
  };

  yield {
    state: workflowState('Durable orchestration preserves long work'),
    highlight: { active: ['workflow', 'agent', 'guard', 'log', 'e-workflow-guard', 'e-agent-guard', 'e-guard-log'], compare: ['tools'] },
    explanation: 'Long-running agents need a place to store progress, retries, approvals, and side-effect history. Durable workflow engines make the loop restartable instead of trusting one process and one transcript.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'control loop') yield* controlLoop();
  else if (view === 'production patterns') yield* productionPatterns();
  else throw new InputError('Pick an agentic AI patterns view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Agentic AI is a family of system patterns where a model is allowed to choose actions, observe results, update state, and continue toward a goal. The useful definition is operational: an agent is not just a long prompt; it is a loop over planning, tool use, observation, memory, evaluation, and stopping. That loop may run for two turns or for hours, but the engineering problem is the same.',
        'The most practical sources distinguish workflows from agents. A workflow follows a mostly known path: classify, retrieve, summarize, validate, respond. An agent directs its own path through tools and environment feedback. Anthropic explicitly frames production systems around an augmented LLM first, then progressively more complex workflows and autonomous agents: https://www.anthropic.com/research/building-effective-agents.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A production agent has explicit state: the task, current plan, tool inventory, retrieved context, observations, memory, budgets, and pending decisions. The planner chooses the next action. The tool layer executes a bounded operation such as search, code execution, database lookup, browser navigation, ticket update, or function call. The observation returns data to the loop. The evaluator decides whether the result is sufficient, invalid, unsafe, or worth another step.',
        'ReAct made the interleaving clear: reasoning traces help the model track and update action plans, while actions let it gather external information. Toolformer studied how models can learn when to call external APIs and how to incorporate results. Reflexion added a memory-centered variant: feedback is converted into verbal reflections stored for later trials. These are different surface forms of the same control-loop idea.',
      ],
    },
    {
      heading: 'Data structures and cost',
      paragraphs: [
        'The hidden data structures matter more than the branding. The trace log is a Write-Ahead Log for decisions: without it, you cannot reproduce a failure. The memory index can be a RAG Pipeline, Multi-Index RAG, a key-value store, a ticket state, or a workflow history; Agent Memory & Context Engineering Case Study breaks that layer into working context, notes, episodic traces, semantic memory, temporal graph memory, compaction, and prompt packing. The tool registry is a typed API surface, often strengthened by Constrained Decoding so calls are parseable. Budgets are counters over tokens, wall time, retries, and side effects.',
        'Cost grows with loop length. Every extra turn adds inference latency, tool latency, context growth, and failure surface. A deterministic workflow should be preferred when the branch structure is known. An agent becomes worth it when uncertainty is high enough that pre-programming every path is more expensive than letting the model inspect state and choose the next action. Agent Model Router & Context Handoff Ledger shows the next production layer: route easy work to cheaper owners, escalate risky slices, and preserve state when ownership changes.',
      ],
    },
    {
      heading: 'Case studies and uses',
      paragraphs: [
        'Coding agents are the clearest case study. Code World Models Case Study shows that execution traces and tool feedback can improve coding behavior, but verification and portability become the real moat. Abstract Agent Operation Graph separates intent from tool grammar, while Agent Harness Portability Audit checks whether the loop survives interface changes. AlphaEvolve Case Study shows a stricter loop: LLM proposals enter an evolutionary population only after automatic evaluators score executable candidates. Temporal Workflow Case Study explains the orchestration side: long-running work needs durable history, replay, retries, and side-effect boundaries.',
        'The same pattern appears in customer-support triage, legal research, incident response, data-cleaning assistants, browser automation, design-to-code tools, spreadsheet repair, procurement workflows, and research agents. Deep Research Agent Architecture Case Study specializes the generic loop into scoping, web/file retrieval, source ledgers, contradiction handling, synthesis, citations, and quality gates. In each case, the product quality depends less on the word "agent" and more on tool contracts, context isolation, human escalation, trace inspection, and eval coverage.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common mistake is using an agent where a workflow would be cheaper and safer. If the task has a known path, use a router, prompt chain, finite-state workflow, or normal service code. Another mistake is leaving memory as a transcript dump. Memory should be indexed, scoped, and evaluated like retrieval. The third mistake is guarding only the prompt. The dangerous boundary is action: sending, deleting, purchasing, publishing, changing permissions, or exposing private context.',
        'Evaluation must be layered. Parseability tests catch malformed tool calls. Permission checks catch forbidden actions. Retrieval checks catch missing evidence. Task holdouts catch goal failures. Human review catches high-impact ambiguity. Without those evaluators, the loop can look productive while drifting, spending, or exploiting weak metrics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: Anthropic Building Effective Agents at https://www.anthropic.com/research/building-effective-agents, ReAct at https://arxiv.org/abs/2210.03629, Toolformer at https://arxiv.org/abs/2302.04761, Reflexion at https://arxiv.org/abs/2303.11366, and Anthropic Writing Tools for Agents at https://www.anthropic.com/engineering/writing-tools-for-agents. Study Agent Model Router & Context Handoff Ledger, Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Blackboard Architecture Agent Coordination, Contract Net Agent Task Allocation, RAG Pipeline, Multi-Index RAG, Constrained Decoding, Deep Research Agent Architecture Case Study, Agent Memory & Context Engineering Case Study, Temporal Workflow Case Study, Code World Models Case Study, Abstract Agent Operation Graph, Agent Harness Portability Audit, Execution-as-a-Service Verifier Economy Case Study, AlphaEvolve Case Study, Distributed Tracing, and Saga Pattern next.',
      ],
    },
  ],
};
