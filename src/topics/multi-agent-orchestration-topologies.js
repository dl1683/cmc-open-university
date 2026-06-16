// Multi-agent orchestration topologies: supervisor fan-out, handoffs,
// blackboards, contract-net allocation, debate, and map-reduce synthesis.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-agent-orchestration-topologies',
  title: 'Multi-Agent Orchestration Topologies',
  category: 'AI & ML',
  summary: 'How to choose the coordination shape for agent systems: single loop, supervisor, handoff, blackboard, contract net, debate, or map-reduce.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['topology map', 'research case study'], defaultValue: 'topology map' },
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

function topologyGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.8, y: 4.0, note: 'goal + budget' },
      { id: 'selector', label: 'selector', x: 2.4, y: 4.0, note: 'choose shape' },
      { id: 'single', label: 'single', x: 4.2, y: 5.1, note: 'one loop' },
      { id: 'supervisor', label: 'supervisor', x: 4.2, y: 3.7, note: 'fan out' },
      { id: 'handoff', label: 'handoff', x: 4.2, y: 4.5, note: 'specialists' },
      { id: 'blackboard', label: 'board', x: 6.2, y: 3.5, note: 'shared state' },
      { id: 'contract', label: 'contract', x: 6.2, y: 4.1, note: 'bids' },
      { id: 'debate', label: 'debate', x: 6.2, y: 4.9, note: 'compare' },
      { id: 'synth', label: 'synth', x: 8.1, y: 4.1, note: 'merge' },
      { id: 'eval', label: 'eval', x: 9.3, y: 3.5, note: 'gate' },
      { id: 'trace', label: 'trace', x: 9.3, y: 4.8, note: 'audit' },
    ],
    edges: [
      { id: 'e-task-selector', from: 'task', to: 'selector' },
      { id: 'e-selector-single', from: 'selector', to: 'single' },
      { id: 'e-selector-supervisor', from: 'selector', to: 'supervisor' },
      { id: 'e-selector-handoff', from: 'selector', to: 'handoff' },
      { id: 'e-supervisor-board', from: 'supervisor', to: 'blackboard' },
      { id: 'e-supervisor-contract', from: 'supervisor', to: 'contract' },
      { id: 'e-handoff-debate', from: 'handoff', to: 'debate' },
      { id: 'e-board-synth', from: 'blackboard', to: 'synth' },
      { id: 'e-contract-synth', from: 'contract', to: 'synth' },
      { id: 'e-debate-synth', from: 'debate', to: 'synth' },
      { id: 'e-synth-eval', from: 'synth', to: 'eval' },
      { id: 'e-synth-trace', from: 'synth', to: 'trace' },
    ],
  }, { title });
}

function researchGraph(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.7, y: 3.7, note: 'question' },
      { id: 'lead', label: 'lead', x: 2.2, y: 3.7, note: 'plan' },
      { id: 'subA', label: 'sub A', x: 4.0, y: 5.1, note: 'web' },
      { id: 'subB', label: 'sub B', x: 4.0, y: 3.7, note: 'docs' },
      { id: 'subC', label: 'sub C', x: 4.0, y: 2.4, note: 'data' },
      { id: 'ledger', label: 'ledger', x: 6.0, y: 4.8, note: 'sources' },
      { id: 'board', label: 'board', x: 6.0, y: 2.8, note: 'claims' },
      { id: 'synth', label: 'synth', x: 7.9, y: 3.7, note: 'answer' },
      { id: 'gate', label: 'gate', x: 9.2, y: 4.8, note: 'quality' },
      { id: 'budget', label: 'budget', x: 9.2, y: 2.8, note: 'tokens' },
    ],
    edges: [
      { id: 'e-user-lead', from: 'user', to: 'lead' },
      { id: 'e-lead-a', from: 'lead', to: 'subA' },
      { id: 'e-lead-b', from: 'lead', to: 'subB' },
      { id: 'e-lead-c', from: 'lead', to: 'subC' },
      { id: 'e-a-ledger', from: 'subA', to: 'ledger' },
      { id: 'e-b-ledger', from: 'subB', to: 'ledger' },
      { id: 'e-c-board', from: 'subC', to: 'board' },
      { id: 'e-ledger-synth', from: 'ledger', to: 'synth' },
      { id: 'e-board-synth', from: 'board', to: 'synth' },
      { id: 'e-synth-gate', from: 'synth', to: 'gate' },
      { id: 'e-lead-budget', from: 'lead', to: 'budget' },
      { id: 'e-synth-budget', from: 'synth', to: 'budget' },
    ],
  }, { title });
}

function* topologyMap() {
  yield {
    state: topologyGraph('Start with the cheapest topology that can solve the task'),
    highlight: { active: ['task', 'selector', 'e-task-selector'], compare: ['single', 'supervisor', 'handoff'] },
    explanation: 'Multi-agent design starts with a routing decision. The selector reads the task shape, uncertainty, tool needs, risk, and budget, then chooses the smallest coordination topology that gives the system enough coverage.',
  };

  yield {
    state: topologyGraph('A single agent is the baseline'),
    highlight: { active: ['selector', 'single', 'e-selector-single'], compare: ['trace', 'eval'] },
    explanation: 'Use one agent when the work is mostly sequential and the agent can keep the important state in one context window. This is still an agent loop: plan, act, observe, evaluate, and stop.',
    invariant: 'Do not add agents when a single loop plus good tools is enough.',
  };

  yield {
    state: topologyGraph('Supervisor fan-out buys parallel search'),
    highlight: { active: ['selector', 'supervisor', 'blackboard', 'contract', 'e-selector-supervisor', 'e-supervisor-board', 'e-supervisor-contract'], found: ['synth'] },
    explanation: 'A supervisor decomposes the task and launches subagents. It is strongest when the subproblems are independent: web searches, codebase scans, candidate generation, red-team passes, or data extraction over separate shards.',
  };

  yield {
    state: topologyGraph('Handoffs preserve specialized local context'),
    highlight: { active: ['selector', 'handoff', 'debate', 'e-selector-handoff', 'e-handoff-debate'], compare: ['supervisor'] },
    explanation: 'A handoff topology passes control from one specialist to another. It works for workflows such as support triage to billing to retention, where each agent needs its own instructions and tools but the conversation should stay coherent.',
  };

  yield {
    state: topologyGraph('Shared coordination needs explicit state'),
    highlight: { active: ['blackboard', 'contract', 'debate', 'synth', 'e-board-synth', 'e-contract-synth', 'e-debate-synth'], found: ['eval', 'trace'] },
    explanation: 'Blackboards, contract-net bidding, and debate/map-reduce are not just prompt patterns. They are data-structure patterns: shared working memory, bid queues, message envelopes, merge reducers, evaluators, and audit traces.',
  };

  yield {
    state: labelMatrix(
      'Topology selection table',
      [
        { id: 'single', label: 'single loop' },
        { id: 'supervisor', label: 'supervisor' },
        { id: 'handoff', label: 'handoff' },
        { id: 'blackboard', label: 'blackboard' },
        { id: 'contract', label: 'contract net' },
        { id: 'debate', label: 'debate/map' },
      ],
      [
        { id: 'best', label: 'best fit' },
        { id: 'state', label: 'main state' },
        { id: 'risk', label: 'main risk' },
      ],
      [
        ['sequential tool work', 'trace + memory', 'context drift'],
        ['parallel breadth', 'task DAG', 'merge loss'],
        ['specialized flow', 'handoff record', 'lost intent'],
        ['uncertain evidence', 'shared board', 'stale facts'],
        ['scarce workers', 'bid heap', 'gaming bids'],
        ['quality checks', 'candidate set', 'false consensus'],
      ],
    ),
    highlight: { active: ['supervisor:best', 'blackboard:state', 'contract:state'], compare: ['single:risk', 'debate:risk'] },
    explanation: 'The topology is an engineering choice, not a maturity badge. Pick by data shape: independent branches want fan-out, evolving hypotheses want a board, scarce capacity wants bidding, and high-stakes synthesis wants independent critique.',
  };
}

function* researchCaseStudy() {
  yield {
    state: researchGraph('Breadth-first research uses context isolation'),
    highlight: { active: ['user', 'lead', 'subA', 'subB', 'subC', 'e-user-lead', 'e-lead-a', 'e-lead-b', 'e-lead-c'], compare: ['budget'] },
    explanation: 'Anthropic describes a lead research agent that plans the work and creates parallel subagents. Each subagent gets its own context window, explores a slice of the problem, and returns compressed findings.',
  };

  yield {
    state: researchGraph('Subagents write evidence, not final prose'),
    highlight: { active: ['subA', 'subB', 'subC', 'ledger', 'board', 'e-a-ledger', 'e-b-ledger', 'e-c-board'], compare: ['synth'] },
    explanation: 'The data contract matters. Subagents should return claims, citations, snippets, uncertainty, and open questions. If they return polished mini-essays, the lead agent loses provenance and duplicates work.',
  };

  yield {
    state: researchGraph('Synthesis is a reduce step with quality gates'),
    highlight: { active: ['ledger', 'board', 'synth', 'gate', 'e-ledger-synth', 'e-board-synth', 'e-synth-gate'], found: ['budget'] },
    explanation: 'The lead agent reduces the partial results into a coherent answer. The quality gate checks citation coverage, contradiction handling, freshness, scope fit, and whether more exploration is worth the remaining budget.',
    invariant: 'Parallelism increases coverage only if the reducer preserves evidence.',
  };

  yield {
    state: labelMatrix(
      'Research-system records',
      [
        { id: 'task', label: 'task DAG' },
        { id: 'mailbox', label: 'mailbox' },
        { id: 'ledger', label: 'ledger' },
        { id: 'board', label: 'board' },
        { id: 'budget', label: 'budget' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why it exists' },
      ],
      [
        ['subquestions + deps', 'avoid duplicate search'],
        ['agent messages', 'coordinate async work'],
        ['sources + claims', 'audit citations'],
        ['hypotheses', 'merge partial facts'],
        ['tokens + calls', 'stop expensive loops'],
        ['events + decisions', 'debug failures'],
      ],
    ),
    highlight: { active: ['task:contains', 'ledger:contains', 'board:contains', 'budget:why'], found: ['trace:why'] },
    explanation: 'A useful multi-agent system is a set of records with clear ownership. The LLMs choose actions, but the system reliability comes from task graphs, mailboxes, ledgers, boards, budgets, and traces.',
  };

  yield {
    state: researchGraph('Cost is a first-class coordination signal'),
    highlight: { active: ['lead', 'budget', 'synth', 'gate', 'e-lead-budget', 'e-synth-budget', 'e-synth-gate'], compare: ['subA', 'subB', 'subC'] },
    explanation: 'Multi-agent systems can spend far more tokens than a single chat. That can be rational for high-value breadth-heavy tasks, but the orchestration layer must decide when another subagent is likely to change the answer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'topology map') yield* topologyMap();
  else if (view === 'research case study') yield* researchCaseStudy();
  else throw new InputError('Pick a multi-agent orchestration view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Multi-agent orchestration is the design layer that decides how several agent loops communicate, divide work, merge results, and stop. A single agent loop already has a planner, tools, observations, memory, and evaluation. A multi-agent system adds coordination records: task graphs, mailboxes, handoff state, shared boards, bid queues, source ledgers, merge reducers, budgets, and traces.',
        'Anthropic defines a multi-agent system as multiple agents autonomously using tools in a loop and working together, and describes a production research feature where a lead agent plans research and launches parallel search agents: https://www.anthropic.com/engineering/multi-agent-research-system. The reason is not aesthetic; breadth-heavy work benefits from isolated context windows and parallel exploration.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The first decision is whether the task needs multiple agents at all. If the work is sequential, use one agent with strong tools, a trace log, and evaluation. If the task has independent branches, use a supervisor topology: a lead agent decomposes the work, dispatches workers, and reduces their outputs. If the workflow moves through roles, use handoffs: each specialist receives the relevant state and becomes responsible for the next step. OpenAI Swarm documented this lightweight idea with two primitives, agents and handoffs: https://github.com/openai/swarm.',
        'When the task is evidence-driven, a blackboard topology is often better than chat between agents. Every agent reads and writes a shared working memory of claims, hypotheses, confidence, and evidence. When capacity is scarce or specialized workers have private costs, a contract-net topology broadcasts a task and awards it to the best bidder. When correctness depends on independent critique, debate or map-reduce topologies generate multiple candidate answers and run a reducer or evaluator over them.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A topology is a data-structure choice. Supervisor systems use a task DAG so the lead can avoid duplicate work and know when a dependency is ready. Handoff systems use a handoff envelope: user intent, completed work, unresolved questions, permissions, and next-role constraints. Blackboard systems use shared hypothesis tables with provenance and freshness. Contract-net systems use message queues and priority heaps over bids. Debate systems use candidate sets, critique records, and merge rules.',
        'The trace is the universal record. Without a trace, there is no way to explain why the system launched an extra worker, why it trusted one source over another, why a bidder won, or why a final answer ignored a contradiction. The orchestration layer should emit structured events just like Distributed Tracing emits spans: dispatch, observe, bid, award, handoff, merge, gate, escalate, and stop.',
      ],
    },
    {
      heading: 'Case studies',
      paragraphs: [
        'Research agents are the cleanest modern case study. Anthropic reports that multi-agent research performs especially well for breadth-first queries where many independent directions can be explored at once, and it frames token usage, tool calls, and model choice as major drivers of performance: https://www.anthropic.com/engineering/multi-agent-research-system. Effective Context Engineering for AI Agents also says multi-agent architectures fit complex research and analysis where parallel exploration pays dividends: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents.',
        'AutoGen is a framework-level case study: Microsoft Research presents it as a way to compose customizable, conversable agents that can use LLMs, tools, and human input, with flexible conversation patterns programmed in natural language and code: https://www.microsoft.com/en-us/research/publication/autogen-enabling-next-gen-llm-applications-via-multi-agent-conversation-framework/. CAMEL is a research case study in role-playing communicative agents and autonomous cooperation: https://arxiv.org/abs/2303.17760. These systems differ in implementation, but they all force the same core question: what record moves between agents, and who is allowed to mutate it?',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The largest mistake is paying multi-agent cost for a problem that needed better context engineering. More agents means more tokens, more latency, more coordination failure, more prompt surface, and more opportunities for inconsistent state. A multi-agent system is justified when independent exploration, specialization, scarce capacity, or independent critique changes the result enough to pay for the overhead.',
        'The second mistake is letting agents talk in unconstrained prose. Messages should have contracts: task id, assumptions, evidence, confidence, permissions, budget used, unresolved items, and requested next action. The third mistake is confusing parallel search with verified synthesis. A final answer can still be wrong if the reducer drops citations, ignores contradictions, or merges incompatible partial results.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: Anthropic Multi-Agent Research System at https://www.anthropic.com/engineering/multi-agent-research-system, Anthropic Effective Context Engineering for AI Agents at https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents, AutoGen at https://arxiv.org/abs/2308.08155 and Microsoft Research at https://www.microsoft.com/en-us/research/publication/autogen-enabling-next-gen-llm-applications-via-multi-agent-conversation-framework/, CAMEL at https://arxiv.org/abs/2303.17760, and OpenAI Swarm at https://github.com/openai/swarm. Study Agentic AI Patterns, Agent Model Router & Context Handoff Ledger, Agent2Agent Protocol Task State Case Study, Blackboard Architecture Agent Coordination, Contract Net Agent Task Allocation, Deep Research Agent Architecture Case Study, Claim Graph & Source Ledger, Distributed Tracing, Message Queue, Temporal Workflow Case Study, and LLM Guardrail Policy Engine next.',
      ],
    },
  ],
};
