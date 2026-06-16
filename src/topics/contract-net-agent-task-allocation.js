// Contract Net Protocol for multi-agent task allocation: announce, bid,
// award, commit, report, retry, and audit.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'contract-net-agent-task-allocation',
  title: 'Contract Net Agent Task Allocation',
  category: 'AI & ML',
  summary: 'Allocate work among autonomous agents with task announcements, bids, awards, commitments, result reports, and retry policy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['negotiation protocol', 'agent allocation'], defaultValue: 'negotiation protocol' },
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

function contractGraph(title) {
  return graphState({
    nodes: [
      { id: 'manager', label: 'mgr', x: 0.7, y: 4.1, note: 'task owner' },
      { id: 'cfp', label: 'CFP', x: 2.2, y: 4.1, note: 'announce' },
      { id: 'a', label: 'A', x: 4.0, y: 3.5, note: 'capacity' },
      { id: 'b', label: 'B', x: 4.0, y: 4.1, note: 'skills' },
      { id: 'c', label: 'C', x: 4.0, y: 5.0, note: 'busy' },
      { id: 'heap', label: 'heap', x: 6.2, y: 4.1, note: 'rank bids' },
      { id: 'award', label: 'award', x: 7.7, y: 3.5, note: 'commit' },
      { id: 'reject', label: 'reject', x: 7.7, y: 4.8, note: 'release' },
      { id: 'report', label: 'report', x: 9.1, y: 4.1, note: 'result' },
      { id: 'audit', label: 'audit', x: 9.1, y: 5.0, note: 'trace' },
    ],
    edges: [
      { id: 'e-manager-cfp', from: 'manager', to: 'cfp' },
      { id: 'e-cfp-a', from: 'cfp', to: 'a' },
      { id: 'e-cfp-b', from: 'cfp', to: 'b' },
      { id: 'e-cfp-c', from: 'cfp', to: 'c' },
      { id: 'e-a-heap', from: 'a', to: 'heap' },
      { id: 'e-b-heap', from: 'b', to: 'heap' },
      { id: 'e-c-heap', from: 'c', to: 'heap' },
      { id: 'e-heap-award', from: 'heap', to: 'award' },
      { id: 'e-heap-reject', from: 'heap', to: 'reject' },
      { id: 'e-award-report', from: 'award', to: 'report' },
      { id: 'e-report-manager', from: 'report', to: 'manager' },
      { id: 'e-report-audit', from: 'report', to: 'audit' },
      { id: 'e-reject-audit', from: 'reject', to: 'audit' },
    ],
  }, { title });
}

function allocationGraph(title) {
  return graphState({
    nodes: [
      { id: 'plan', label: 'task DAG', x: 0.8, y: 3.7, note: 'work list' },
      { id: 'router', label: 'router', x: 2.4, y: 3.7, note: 'publish' },
      { id: 'code', label: 'code', x: 4.2, y: 5.1, note: 'tests' },
      { id: 'research', label: 'research', x: 4.2, y: 3.7, note: 'sources' },
      { id: 'ops', label: 'ops', x: 4.2, y: 2.4, note: 'deploy' },
      { id: 'score', label: 'score', x: 6.1, y: 3.7, note: 'utility' },
      { id: 'run', label: 'run', x: 7.6, y: 2.4, note: 'execute' },
      { id: 'retry', label: 'retry', x: 7.6, y: 5.2, note: 'reopen' },
      { id: 'result', label: 'result', x: 9.1, y: 3.7, note: 'merge' },
      { id: 'budget', label: 'budget', x: 9.1, y: 6.0, note: 'limit' },
    ],
    edges: [
      { id: 'e-plan-router', from: 'plan', to: 'router' },
      { id: 'e-router-code', from: 'router', to: 'code' },
      { id: 'e-router-research', from: 'router', to: 'research' },
      { id: 'e-router-ops', from: 'router', to: 'ops' },
      { id: 'e-code-score', from: 'code', to: 'score' },
      { id: 'e-research-score', from: 'research', to: 'score' },
      { id: 'e-ops-score', from: 'ops', to: 'score' },
      { id: 'e-score-run', from: 'score', to: 'run' },
      { id: 'e-score-retry', from: 'score', to: 'retry' },
      { id: 'e-run-result', from: 'run', to: 'result' },
      { id: 'e-retry-router', from: 'retry', to: 'router' },
      { id: 'e-run-budget', from: 'run', to: 'budget' },
      { id: 'e-result-budget', from: 'result', to: 'budget' },
    ],
  }, { title });
}

function* negotiationProtocol() {
  yield {
    state: contractGraph('A manager announces a task'),
    highlight: { active: ['manager', 'cfp', 'a', 'b', 'c', 'e-manager-cfp', 'e-cfp-a', 'e-cfp-b', 'e-cfp-c'], compare: ['heap'] },
    explanation: 'Contract Net starts when a manager broadcasts a call for proposals. The announcement describes the task, constraints, deadline, reward, required capabilities, and evaluation function.',
  };

  yield {
    state: contractGraph('Agents bid from local knowledge'),
    highlight: { active: ['a', 'b', 'c', 'heap', 'e-a-heap', 'e-b-heap', 'e-c-heap'], compare: ['manager'] },
    explanation: 'Each agent decides whether to bid using private state: current load, tools, expertise, expected cost, confidence, and opportunity cost. The manager does not need to know every worker detail.',
    invariant: 'The bid is a compact promise about capability, cost, and risk.',
  };

  yield {
    state: contractGraph('A bid heap ranks offers'),
    highlight: { active: ['heap', 'award', 'reject', 'e-heap-award', 'e-heap-reject'], found: ['audit'] },
    explanation: 'The manager ranks bids with a utility function. In code this is often a priority queue keyed by expected value: quality score minus latency, cost, risk, and coordination overhead.',
  };

  yield {
    state: contractGraph('Award creates a commitment'),
    highlight: { active: ['award', 'report', 'manager', 'e-award-report', 'e-report-manager'], compare: ['reject'] },
    explanation: 'The winning agent receives the award and commits to execution. Losing agents are released. The result report closes the contract or triggers failure handling.',
  };

  yield {
    state: labelMatrix(
      'Contract Net message types',
      [
        { id: 'cfp', label: 'CFP' },
        { id: 'proposal', label: 'proposal' },
        { id: 'refuse', label: 'refuse' },
        { id: 'award', label: 'award' },
        { id: 'inform', label: 'inform/fail' },
      ],
      [
        { id: 'sender', label: 'sender' },
        { id: 'payload', label: 'payload' },
        { id: 'state', label: 'state change' },
      ],
      [
        ['manager', 'task + eval', 'open auction'],
        ['candidate', 'cost + ETA', 'rank bid'],
        ['candidate', 'reason', 'free worker'],
        ['manager', 'selected bid', 'commit'],
        ['winner', 'result/error', 'close/retry'],
      ],
    ),
    highlight: { active: ['cfp:payload', 'proposal:payload', 'award:state', 'inform:state'], compare: ['refuse:state'] },
    explanation: 'The protocol is a small state machine over messages. That makes it easier to test than free-form agent chatter and easier to audit than hidden routing heuristics.',
  };
}

function* agentAllocation() {
  yield {
    state: allocationGraph('A task DAG feeds the market'),
    highlight: { active: ['plan', 'router', 'e-plan-router'], compare: ['code', 'research', 'ops'] },
    explanation: 'In an agent platform, the manager can be a router over a task DAG. Every ready task becomes a contract opportunity. Specialist agents bid only on work they can do well.',
  };

  yield {
    state: allocationGraph('Bids expose tradeoffs'),
    highlight: { active: ['code', 'research', 'ops', 'score', 'e-code-score', 'e-research-score', 'e-ops-score'], found: ['budget'] },
    explanation: 'The score function can combine domain fit, tool access, context freshness, estimated tokens, queue delay, expected verification cost, and risk. The best bid is rarely just the cheapest bid.',
  };

  yield {
    state: allocationGraph('Execution is bounded by budget'),
    highlight: { active: ['score', 'run', 'budget', 'e-score-run', 'e-run-budget'], compare: ['retry'] },
    explanation: 'After award, the worker executes inside an explicit envelope: tool permissions, token limit, deadline, retry count, required artifacts, and stop condition. Contract Net allocates work; it does not remove safety gates.',
  };

  yield {
    state: allocationGraph('Failures reopen or escalate the contract'),
    highlight: { active: ['run', 'retry', 'router', 'e-score-retry', 'e-retry-router'], found: ['result'] },
    explanation: 'If the winner fails, times out, or returns unverifiable work, the manager can reannounce the task with new context, blacklist a bad route, split the task, or escalate to a human.',
    invariant: 'A failed contract should create better routing information, not just another blind retry.',
  };

  yield {
    state: labelMatrix(
      'Bid scoring features',
      [
        { id: 'skill', label: 'skill fit' },
        { id: 'context', label: 'context' },
        { id: 'cost', label: 'cost' },
        { id: 'risk', label: 'risk' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['tool + domain', 'raises quality'],
        ['fresh memory', 'cuts setup'],
        ['tokens + time', 'lowers utility'],
        ['permissions', 'needs guardrail'],
        ['tests/citations', 'raises trust'],
      ],
    ),
    highlight: { active: ['skill:effect', 'context:effect', 'proof:effect'], compare: ['cost:effect', 'risk:effect'] },
    explanation: 'A useful bid is not just "I can do it." It should expose why this worker is a good match and what verification artifact it will return.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'negotiation protocol') yield* negotiationProtocol();
  else if (view === 'agent allocation') yield* agentAllocation();
  else throw new InputError('Pick a contract-net view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Contract Net Protocol is a coordination pattern for allocating tasks among autonomous agents. One agent acts as a manager, announces a task, receives proposals from potential contractors, awards the contract to one or more winners, and receives a result or failure report. It is useful when workers have different skills, load, cost, tools, or private local knowledge.',
        'Reid G. Smith introduced the protocol for distributed problem solving in 1980. The paper frames the problem as task-sharing among loosely coupled asynchronous nodes with no shared memory, and describes negotiation as the basis for matching tasks to appropriate nodes: https://www.eecs.ucf.edu/~lboloni/Teaching/EEL6788_2008/papers/The_Contract_Net_Protocol_Dec-1980.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The manager sends a call for proposals that describes the task, constraints, deadline, required capability, and scoring function. Each participant evaluates the task locally. A participant can refuse or return a proposal containing cost, estimated time, confidence, required resources, and the evidence it expects to produce. The manager ranks proposals and sends an award to the selected participant. The participant executes and returns an inform or failure message.',
        'In modern agent systems, the same pattern appears as dynamic task routing. A coding agent may bid high on test repair, a research agent may bid high on source discovery, an operations agent may bid high on deployment checks, and each bid can include expected token cost and verification artifact. The orchestration layer can choose the worker rather than hardcoding the route.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The minimum data structures are a task record, a call-for-proposals envelope, a mailbox or message queue, a bid table, a Binary Heap for ranking, a contract state machine, and an audit log. The task record includes id, parent task, inputs, required capabilities, deadline, budget, and acceptance criteria. The bid includes agent id, utility features, estimated cost, confidence, and proof plan. The contract state moves through announced, bidding, awarded, running, reported, failed, cancelled, or reannounced.',
        'The priority queue is the teaching core. Contract Net is often described socially as negotiation, but implementation usually reduces to ranking offers by expected utility. Good utility functions include quality, capability fit, context freshness, latency, token cost, side-effect risk, and verification strength. A low-cost bid with no proof plan should lose to a costlier bid that can return tests, citations, or replayable traces.',
      ],
    },
    {
      heading: 'Case studies',
      paragraphs: [
        'The original paper discusses distributed AI problem solving over asynchronous nodes and notes natural applications such as traffic-light control, distributed sensing, and heuristic search. Its central contribution is high-level communication semantics for deciding what nodes should say to each other, not just how bytes move across a network: https://www.eecs.ucf.edu/~lboloni/Teaching/EEL6788_2008/papers/The_Contract_Net_Protocol_Dec-1980.pdf.',
        'Agent orchestration is a modern fit. A supervisor can publish tasks such as "find current sources," "repair failing route," "summarize contradictions," or "run browser validation." Agents bid with capability, load, and expected proof. The result integrates naturally with Multi-Agent Orchestration Topologies, Blackboard Architecture Agent Coordination, Distributed Tracing, Message Queue, Binary Heap, Rate Limiter, and LLM Guardrail Policy Engine.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first pitfall is trusting self-reported bids. Agents can overestimate confidence, undercount cost, or hide uncertainty. Bids should be calibrated against historical outcomes, and awards should be followed by verification. The second pitfall is starving long-term work: if the utility function rewards only short latency, every worker will prefer easy tasks. Add fairness, aging, and strategic value when needed.',
        'The third pitfall is retry storms. A failed contract should not simply be reannounced forever. Failure should update route state: bad capability match, missing context, blocked dependency, unsafe permission, or unrealistic acceptance criteria. Sometimes the right action is to split the task, change the scoring function, or escalate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Smith, The Contract Net Protocol, https://www.eecs.ucf.edu/~lboloni/Teaching/EEL6788_2008/papers/The_Contract_Net_Protocol_Dec-1980.pdf, and the Semantic Scholar record at https://www.semanticscholar.org/paper/The-Contract-Net-Protocol%3A-High-Level-Communication-Smith/d3cdca6dcd3fdf4a19b6553f81665095de28cc8d. Study Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Blackboard Architecture Agent Coordination, Message Queue, Binary Heap, Distributed Tracing, Rate Limiter, Circuit Breakers, Saga Pattern, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};
