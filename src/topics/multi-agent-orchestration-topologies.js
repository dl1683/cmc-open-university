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
    explanation: 'The selector is the important node. It asks whether one loop is enough before spending on more agents. Extra agents only help when the task has independent branches, specialized handoffs, scarce workers, or critique that changes the answer.',
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
    explanation: 'Read the worker outputs as records, not mini-answers. Subagents should return claims, citations, snippets, uncertainty, and open questions. If they return polished prose, the reducer loses provenance and repeats work.',
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
      heading: 'Why This Exists',
      paragraphs: [
        `Multi-agent orchestration exists because one agent loop is not always the right shape for the work. A single loop can plan, call tools, observe results, revise, and stop. That is enough for many tasks. It starts to strain when the task has many independent branches, when different parts need different tools or instructions, when evidence must be gathered from many places, or when independent critique is valuable enough to pay for.`,
        `The phrase "multi-agent" can make the design sound like adding more intelligence. The more useful view is coordination. The system is deciding who owns a subtask, what state moves between workers, how partial results are merged, what evidence is kept, how budget is spent, and who is allowed to stop the run. The hard part is not that several language models talk. The hard part is making their work add up to one reliable outcome.`,
        `A production research workflow is a good example. A lead agent can decompose a question into source discovery, document reading, data extraction, contradiction search, and synthesis. Parallel workers can explore these branches in separate context windows. The lead then has to reduce the outputs into claims with citations, unresolved uncertainty, and a final answer. Without that orchestration layer, parallelism becomes duplicated search and unverifiable prose.`,
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The obvious approach is to run one strong agent with a long context window and a good set of tools. This should be the baseline. It has one conversation state, one tool history, one plan, and one place where intent can be preserved. It is easier to debug because every decision appears in one run. It is cheaper because the system is not paying several models to rediscover the same background.`,
        `The wall appears when the work is wide rather than merely long. A single agent has to serialize all searches, carry all evidence in one context, and decide which branches to abandon before it knows what is inside them. It can also become overconfident because all critique is generated by the same context that wrote the first answer. More context helps, but it does not create independent exploration, role-specific tools, or parallel latency reduction by itself.`,
        `A bad multi-agent system makes this wall worse. It launches workers with vague prompts, accepts narrative summaries, and asks another agent to combine them. The output looks busy, but the reducer cannot tell which claims are supported, which sources were checked, which branch failed, or why one worker should be trusted over another. The right move is to add agents only after the required coordination records are clear.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is that an orchestration topology is a data-structure choice. A supervisor topology is a task DAG plus mailboxes. A handoff topology is a chain of role-owned state envelopes. A blackboard topology is a shared table of claims, hypotheses, evidence, and freshness. A contract-net topology is a broadcast queue and a bid ledger. A debate or map-reduce topology is a candidate set, critique set, reducer, and evaluation gate.`,
        `The invariant is simple: every worker output must be reducible. It must carry enough structure for the coordinator to merge it without guessing. A useful worker result says what task it handled, what it found, what evidence supports it, what assumptions it made, what remains uncertain, what budget it spent, and what it recommends next. The more expensive the run, the more important this invariant becomes.`,
        `This is why the topology should follow the shape of the problem. Independent branches want fan-out. Role transitions want handoffs. Evolving hypotheses want a blackboard. Scarce specialized workers want bidding. High-stakes synthesis wants independent candidates and critique. A topology chosen for style rather than problem shape usually adds cost before it adds quality.`,
      ],
    },
    {
      heading: 'Visualization Guide',
      paragraphs: [
        `The topology map is a selection chart. The task enters a selector, and the selector asks whether one loop is enough. If the answer is yes, the system should stay single-agent and invest in better tools, better context, and better evaluation. If the answer is no, the selector chooses the smallest coordination shape that covers the missing property: breadth, specialization, shared evidence, bidding, or independent critique.`,
        `The research case study shows the same idea as a concrete workflow. The lead agent creates branches, workers return evidence into ledgers and boards, synthesis reduces those records, and the gate checks quality and remaining budget. The important signal is that worker outputs are records, not mini final answers. Records preserve provenance; polished summaries often hide it.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `A supervisor topology begins with decomposition. The lead turns a user goal into subquestions or work packets, assigns each packet to a worker, waits for results, and reduces those results. This works when branches are mostly independent: scanning different repositories, searching different source families, generating candidate designs, extracting facts from separate documents, or running separate red-team passes.`,
        `A handoff topology passes control from one specialist to another. The state envelope matters more than the prompt. It should include user intent, completed steps, current constraints, open questions, permissions, tool outputs, and the reason for transfer. Handoff is a good fit for workflows like support triage to billing to retention, incident intake to diagnosis to remediation, or research planning to source collection to final editing.`,
        `A blackboard topology uses shared state instead of direct conversational dependency. Workers read the board, add claims or hypotheses, mark contradictions, and update confidence. The board should track provenance and freshness so old facts do not look equal to newly verified facts. A contract-net topology adds worker selection: tasks are announced, workers bid with capability, cost, latency, and confidence, and the coordinator awards work. Debate and map-reduce generate independent answers or critiques, then use a reducer to combine them.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `The design works when it creates useful independence. Separate context windows can search different parts of the space without crowding each other out. Separate roles can use different instructions and tools without mixing policies. Separate candidate generators can expose disagreement. Separate critics can catch unsupported claims that the original writer missed. The coordinator earns its cost only when those separations change the final answer.`,
        `The reducer is the safety point. It should not average opinions. It should join records by claim, source, entity, time, and uncertainty. If two workers disagree, the reducer should expose the disagreement or ask for targeted follow-up. If a worker gives an unsupported claim, the reducer should either drop it or mark it as unsupported. If the remaining budget is low, the reducer should stop expanding and produce a scoped answer rather than launching another broad wave.`,
        `Budgets make the system honest. Multi-agent runs can multiply token use and tool calls quickly. The orchestrator should know the expected value of another worker: what missing branch it covers, what uncertainty it may reduce, and what deadline or cost it consumes. A system that cannot answer that question is not coordinating; it is spending.`,
      ],
    },
    {
      heading: 'Records To Model',
      paragraphs: [
        `The task graph records subquestions, dependencies, priority, owner, status, and stop conditions. It prevents duplicate work and lets the coordinator know when enough evidence exists to synthesize. The mailbox records messages between agents, but messages should be typed: request, observation, bid, handoff, critique, merge proposal, or escalation. Free-form chat is easy to build and hard to audit.`,
        `The source ledger records sources, quotes or snippets, retrieval time, authority, claim links, and freshness. The claim board records normalized claims, contradictions, confidence, and support. The budget ledger records model calls, tool calls, tokens, wall time, and expected remaining work. The run trace records dispatch, observe, merge, gate, and stop decisions. These are ordinary software records; the language model is only one component mutating them.`,
      ],
    },
    {
      heading: 'Choosing A Topology',
      paragraphs: [
        `Use a single loop when the task is sequential, the context fits, and one agent can see the important state. Add a supervisor when breadth dominates latency or coverage. Use handoffs when the workflow naturally changes responsibility and each role has different tools or policy. Use a blackboard when facts accumulate over time and many workers must share evidence without overwriting each other.`,
        `Use a contract-net pattern when workers are expensive, heterogeneous, or capacity-limited. The bid should be concrete: capability, estimated cost, expected latency, required permissions, and confidence. Use debate or map-reduce when the main risk is premature consensus or unsupported synthesis. In that case, keep candidates independent long enough for disagreement to surface, then reduce with explicit criteria instead of a popularity vote.`,
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        `Start with one coordinator process and durable records. Resist the urge to make every agent fully autonomous at first. Define task schemas, worker result schemas, source ledger schemas, and stop rules. Give each worker a narrow contract and require structured output. Store raw evidence separately from summaries so the reducer can inspect support instead of trusting a worker statement.`,
        `Make idempotency part of the design. Workers may retry, time out, or return after the coordinator has moved on. Task ids, output hashes, source ids, and merge versions let the system ignore duplicates and stale responses. Add cancellation and budget limits early. A worker that continues searching after the answer is already gated can waste more than a single-agent run would have spent in total.`,
        `Evaluation should be local to the topology. For supervisor research, measure source coverage, contradiction handling, citation accuracy, and cost per useful claim. For handoffs, measure lost intent and rework. For blackboards, measure stale claims and merge conflicts. For contract nets, measure bid accuracy. For debate, measure whether critique changes wrong answers or merely adds style noise.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Multi-agent orchestration wins in breadth-first research, codebase audits, incident response, policy review, data extraction across many documents, candidate generation with later judging, and workflows where specialized tools or permissions should be isolated. It also helps when latency matters: five independent searches can run at once instead of in sequence.`,
        `It is also useful for governance. A source-gathering worker can be kept separate from a synthesis worker. A critic can be denied write access to production tools. A budget gate can be implemented outside the language model. These separations reduce the blast radius of mistakes and make the final answer easier to audit.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `It fails when the task is actually sequential, when workers need the same scarce context, or when the reducer cannot inspect evidence. It fails when agents are launched without a clear stop rule. It fails when every worker is asked to write final prose and the coordinator has to merge style instead of facts. It fails when the system confuses more tokens with more certainty.`,
        `The most common production failure is state drift. One worker assumes a constraint has changed, another uses the old constraint, and the reducer does not notice. The second common failure is lost provenance: a claim survives into the final answer after its source was dropped or contradicted. The third is false consensus: several workers repeat the same weak source and the reducer treats repetition as independent support.`,
      ],
    },
    {
      heading: 'Complete Case Study',
      paragraphs: [
        `Consider a deep research agent answering whether a vendor is suitable for a regulated deployment. A single agent could search the web, read docs, inspect security pages, compare competitors, and write a recommendation. A multi-agent design can split the work: one worker gathers official security documents, one reads pricing and service terms, one searches incident history, one maps integrations, and one extracts requirements from the buyer policy.`,
        `The lead stores sources in a ledger and claims on a board. The synthesis step joins claims by requirement: data residency, audit logs, retention, SSO, encryption, incident response, pricing, and integration risk. A quality gate checks that every recommendation has support, that old documents are not treated as current, and that contradictions are called out. This is not better because there are more agents. It is better because the topology preserves evidence while covering more ground.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Agentic AI Patterns for the single-agent loop before adding topology. Study Agent Model Router & Context Handoff Ledger for handoff state, Blackboard Architecture Agent Coordination for shared evidence, Contract Net Agent Task Allocation for bidding, Claim Graph & Source Ledger for provenance, Distributed Tracing for run records, Message Queue for asynchronous dispatch, Temporal Workflow Case Study for durable orchestration, and LLM Guardrail Policy Engine for policy gates.`,
        `Useful sources and reference points include Anthropic's multi-agent research system writeup, Anthropic's context engineering notes, AutoGen, CAMEL, and OpenAI Swarm. Read them with one question in mind: what structured record crosses the boundary between agents, and how does the system know that record is good enough to merge?`,
      ],
    },
  ],
};
