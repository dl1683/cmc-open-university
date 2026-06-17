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
    explanation: 'Read the loop left to right: task and context feed the planner, the planner chooses one bounded action, and the result comes back as observation. This exists because a single prompt cannot know what the environment will reveal after the first step.',
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
    explanation: 'The evaluator is the stop/go switch. It turns raw observation into a decision: answer now, try another action, reject unsafe output, or ask a person. Without this node, the loop can spend tokens while drifting away from the task.',
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
      heading: 'What agentic means',
      paragraphs: [
        `Agentic AI is not a magic product category. It is a system pattern where a model is allowed to choose actions, observe the results, update state, and continue toward a goal. The useful definition is operational: an agent is a controlled loop over planning, tool use, observation, memory, evaluation, and stopping. The loop may last two turns or many hours, but the engineering problem is the same.`,
        `This distinction matters because many useful AI systems are not agents. A deterministic workflow can classify a request, retrieve documents, summarize them, validate the result, and respond along a mostly fixed path. An agent is needed when the path cannot be fully known ahead of time because the next step depends on what tools reveal. The goal is not more autonomy by default. The goal is the right amount of autonomy for uncertain work.`,
      ],
    },
    {
      heading: 'Why one prompt fails',
      paragraphs: [
        `The obvious approach is to write a larger prompt with all instructions, examples, and context included. That works when the task is self-contained. It breaks when the answer depends on live files, search results, database state, user permissions, API responses, intermediate errors, or side effects that do not exist until the system acts. A single prompt cannot know what a compiler error will say before code is run, what a website will return before it is opened, or which customer record needs review before retrieval happens.`,
        `Long prompts also hide state. The model may forget the original objective, confuse old observations with current ones, over-trust hostile text retrieved from a page, or continue spending after the task is already solved. Agentic design makes the hidden loop explicit. Each step has a state, an action, an observation, and a decision about whether to stop. That is ordinary systems engineering applied to model behavior.`,
      ],
    },
    {
      heading: 'Core loop',
      paragraphs: [
        `A production loop starts with a task and a context object. The context contains user intent, known facts, retrieved material, permissions, budgets, previous observations, and any constraints on allowed actions. The planner chooses the next bounded action. The tool layer executes that action: search, code execution, database lookup, browser navigation, calculator call, file edit, ticket update, or another function call with a typed schema.`,
        `The observation returns to the loop as data, not as vague intuition. The memory layer records what should survive the step. The evaluator turns the observation into a decision: answer now, plan another action, reject unsafe output, ask a person, retry with a different tool, or stop because the budget is exhausted. The control-loop view in the topic is a cycle, not a one-pass pipeline. The important edge is from evaluation back to planning, because that is where feedback changes the next action.`,
      ],
    },
    {
      heading: 'State structures',
      paragraphs: [
        `The hidden data structures matter more than the label "agent." The state object should include the goal, current plan, tool inventory, tool outputs, memory pointers, authorization scope, budget, outstanding uncertainties, and stop condition. If the state exists only inside a transcript, the system is hard to restart, inspect, or test. If the state is explicit, an evaluator or human reviewer can ask why the next action is allowed.`,
        `The run trace is the decision ledger. It records actions, tool inputs, tool outputs, timestamps, errors, retries, approvals, and redactions. It plays the same role that a write-ahead log or distributed trace plays in other systems: it lets the team reproduce failures and measure behavior. The memory index is separate. It may be a vector store, a relational table, a graph of tasks, a ticket state, a durable workflow history, or a compacted set of lessons. Memory is not "everything the model has seen." Memory is retrieved state that changes a future decision.`,
      ],
    },
    {
      heading: 'Tool contracts',
      paragraphs: [
        `Tools are the action surface of the agent. A tool contract should say what the tool does, what arguments it accepts, what permissions it needs, what side effects it may create, what it returns, how errors are represented, and whether it is idempotent. Typed schemas and constrained decoding help because malformed tool calls are a basic reliability failure. A model that can write arbitrary text is not automatically safe to call arbitrary APIs.`,
        `The highest-risk boundary is usually action, not prose. Sending email, deleting a file, changing access control, moving money, publishing a page, creating a support ticket, or exposing private context should not be protected only by a line in the prompt. Put guards around the tool channel: allowlists, permission checks, dry-run modes, human approval interrupts, rate limits, idempotency keys, and output validation. The production-patterns view places guards and human review near actions because that is where damage happens.`,
      ],
    },
    {
      heading: 'Planning patterns',
      paragraphs: [
        `Not every uncertain task needs a fully autonomous agent. A prompt chain is enough when each transformation is known. A router is enough when the hard part is choosing the right specialist path. An evaluator-optimizer loop is useful when drafts can be scored and improved. An orchestrator-workers pattern helps when a central planner can divide work among specialized workers. A true open-ended agent is reserved for tasks where the system must choose actions based on changing observations.`,
        `This is why mature products mix workflows and agents. Fixed workflows give predictable cost, testability, and compliance. Agents add flexibility when external state is unknown. The router should choose the cheapest reliable pattern for the request. If the branch structure is known, do not pay for autonomy. If the branch structure is not known, do not pretend a static chain can inspect evidence it has not gathered.`,
      ],
    },
    {
      heading: 'Memory discipline',
      paragraphs: [
        `Memory should be scoped by decision. Short-term working memory keeps the current task coherent. Episodic memory stores prior attempts, outcomes, and mistakes. Semantic memory stores reusable facts and preferences. A durable workflow history stores approvals and side effects. Retrieval should answer a concrete question: what past information should change the next action? If the answer is "nothing," the memory should stay out of the prompt.`,
        `Transcript dumping is the common failure. It inflates context, repeats stale facts, and lets unrelated text steer the model. A better memory system stores source, timestamp, ownership, confidence, privacy scope, and invalidation rules. It also separates user-provided instructions from retrieved documents, because tool outputs and web pages can contain hostile text. Agent Memory & Context Engineering Case Study is the natural next topic for that layer.`,
      ],
    },
    {
      heading: 'Evaluation and stopping',
      paragraphs: [
        `An agent without a stop rule is just an expensive loop. Evaluation starts with simple checks: did the tool call parse, did the requested file exist, did the command succeed, did retrieval return enough evidence, did the answer cite the sources it used, did the patch pass the relevant check? Higher-level evaluators compare the result with the original objective, policy constraints, and quality bar.`,
        `Good systems use layered evaluators instead of one all-purpose judge. Parseability tests catch malformed calls. Permission checks catch forbidden actions. Unit or integration checks catch behavioral regressions. Retrieval tests catch missing evidence. Cost monitors catch runaway loops. Human review handles high-impact ambiguity. The evaluator is the stop/go switch: continue only when another action is likely to improve the result enough to justify its cost.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a coding agent asked to fix a failing parser. A workflow-only assistant might answer with advice from memory. An agent can inspect the repository, locate the failing test, open the parser, form a plan, edit the smallest relevant function, run the targeted test, observe a new error, adjust the patch, and stop when the requested validation passes. Each tool result changes the next decision.`,
        `The same shape applies outside code. A research agent scopes a question, retrieves sources, checks contradictions, builds a source ledger, drafts, validates claims, and cites evidence. A support triage agent reads the ticket, checks account status, searches known incidents, proposes a resolution, and escalates if the action requires authority. In each case, quality comes from the control plane: tool contracts, state updates, memory retrieval, evaluation, and human escalation, not from calling the system an agent.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Goal drift happens when the loop starts solving a nearby task because the latest observation is more salient than the original objective. Context poisoning happens when retrieved text or tool output contains instructions the model should not follow. Runaway loops happen when there is no budget or stop condition. Tool misuse happens when action schemas are vague or permission checks are missing. False confidence happens when an evaluator checks formatting but not correctness.`,
        `Multi-agent systems add coordination failures. Specialized agents can duplicate work, disagree without resolution, hide assumptions, or pass summaries that lose critical evidence. More agents do not automatically mean more intelligence; they often mean more state synchronization. Use multi-agent patterns when roles are genuinely different and outputs can be independently checked. Otherwise, one well-instrumented loop is easier to reason about.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Start with the smallest controllable loop. Define the task schema, allowed tools, state object, trace format, budget, stop condition, and evaluator before adding autonomy. Keep deterministic code in charge of routing, permissions, retries, and irreversible side effects. Let the model choose among bounded actions, not among arbitrary powers. Store enough run data to replay what happened without exposing private content unnecessarily.`,
        `Measure cost and reliability per task type. Every extra turn adds model latency, tool latency, context growth, and more surface for error. Use cheaper workflows for routine paths, route difficult cases to stronger models or human reviewers, and preserve state when ownership changes. Agent Model Router & Context Handoff Ledger explains that handoff problem: route easy work cheaply, escalate risky slices, and carry the context capsule across the boundary.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Anthropic Building Effective Agents at https://www.anthropic.com/research/building-effective-agents, ReAct at https://arxiv.org/abs/2210.03629, Toolformer at https://arxiv.org/abs/2302.04761, Reflexion at https://arxiv.org/abs/2303.11366, and Anthropic Writing Tools for Agents at https://www.anthropic.com/engineering/writing-tools-for-agents.`,
        `Study Agent Model Router & Context Handoff Ledger, Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Blackboard Architecture Agent Coordination, Contract Net Agent Task Allocation, RAG Pipeline, Multi-Index RAG, Constrained Decoding, Deep Research Agent Architecture Case Study, Agent Memory & Context Engineering Case Study, Temporal Workflow Case Study, Code World Models Case Study, Abstract Agent Operation Graph, the agent-portability audit module, Execution-as-a-Service Verifier Economy Case Study, AlphaEvolve Case Study, Distributed Tracing, Saga Pattern, Idempotency & Exactly-Once Delivery, and Prompt Injection Threat Model next.`,
      ],
    },
  ],
};
