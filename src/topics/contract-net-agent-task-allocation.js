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
    explanation: 'The manager does not guess who should work. It publishes a task envelope with constraints, deadline, required capability, and scoring rules, then lets workers expose their private load, skill, and cost through bids.',
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
    explanation: 'Read the task DAG as the supply of ready work. The router publishes only tasks whose dependencies are satisfied, and specialists bid on the slices where their tools, context, and proof artifacts make them worth choosing.',
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
      heading: 'Why it exists',
      paragraphs: [
        'Contract Net exists because a central planner often cannot know enough to assign every task well. In a multi-agent system, workers have private state: current load, tool access, local context, skill fit, expected cost, and recent failures. A static route table throws away that information.',
        {type: 'callout', text: 'Contract Net turns assignment into an auditable negotiation where bids expose local knowledge before the manager commits.'},
        'The protocol turns allocation into a small market. A manager announces work, capable agents bid, the manager awards the task, and the winner reports success or failure. Reid G. Smith introduced the idea for distributed problem solving in 1980, where loosely coupled nodes needed a way to share tasks without shared memory or perfect global knowledge.',
      ],
    },
    {
      heading: 'The naive assignment rule',
      paragraphs: [
        'The obvious rule is to assign work by name: code tasks go to the coding agent, research tasks go to the research agent, deploy tasks go to the operations agent. That is simple, but it fails as soon as the labels are incomplete. A code task may require current web sources. A research task may require running a parser. An operations task may be blocked by missing credentials.',
        'Round-robin assignment is no better. It balances count, not difficulty or capability. A worker with the right tool and fresh context may be much cheaper than a free worker starting cold. Contract Net asks agents to expose these local facts through proposals instead of pretending the manager already knows them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that task allocation is a decision under uncertainty, so the system should collect offers before it commits. A bid is not just a yes. It is a compact promise about capability, cost, risk, schedule, and proof. The manager can rank offers by expected utility instead of relying on a brittle hand-coded route.',
        'This is useful even when every worker is software. An agent can bid high because it has the right repo loaded, a browser session open, a domain-specific skill, lower queue delay, or a better validation path. The protocol gives the orchestrator a structured way to choose and later audit that choice.',
      ],
    },
    {
      heading: 'Protocol steps',
      paragraphs: [
        'The manager begins with a task envelope. It includes the task id, inputs, required capabilities, deadline, budget, acceptance criteria, allowed tools, and scoring rule. The call for proposals is published to candidate agents or a topic where candidates can discover it.',
        'Each candidate evaluates the envelope against local state. It can refuse or submit a proposal with estimated cost, time, confidence, dependencies, and evidence plan. The manager ranks proposals, sends an award to the selected worker, sends rejections to the rest, and waits for an inform or failure report. A failed report can close, retry, split, or escalate the task.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/CNP.svg/500px-CNP.svg.png', alt: 'AUML sequence diagram of the Contract Net Protocol from call for proposals through award and inform', caption: 'The AUML sequence diagram shows the protocol as message order, not informal agent conversation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:CNP.svg.'},
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A concrete implementation needs a task record, a call-for-proposals envelope, a mailbox or message queue, a bid table, a priority queue, a contract state machine, and an audit log. The task record describes the work. The bid table stores proposals by agent and version. The priority queue ranks bids by utility. The state machine prevents ambiguous outcomes.',
        'The contract state usually moves through announced, bidding, awarded, running, reported, failed, cancelled, or reannounced. The audit log records why each bid won or lost. Without that log, the system becomes hard to debug because bad allocation can look like bad execution.',
      ],
    },
    {
      heading: 'Bid scoring',
      paragraphs: [
        'The priority queue is the teaching core. Contract Net sounds social because it uses words such as proposal and award, but the implementation often becomes a heap keyed by expected value. A useful score can combine skill fit, context freshness, queue delay, token or compute cost, side-effect risk, deadline risk, confidence calibration, and verification strength.',
        'The cheapest bid should not always win. A low-cost proposal with no proof plan may be worse than a slower proposal that returns tests, citations, replayable traces, or a checked artifact. Historical calibration matters too. If an agent repeatedly bids with high confidence and fails, the manager should discount future bids.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The negotiation view proves that the protocol is a state machine over messages. CFP opens the auction. Agents submit proposals or refuse. The heap ranks proposals. Award creates a commitment. Reject releases the losers. Report closes the contract or triggers failure handling.',
        'The allocation view proves the same pattern at the level of a task DAG. Only dependency-ready tasks enter the market. Specialists bid on work where their tools and context matter. The winning worker gets a bounded execution envelope, not unlimited autonomy. Retry is a separate path because failure should update routing information instead of looping blindly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Contract Net works when local knowledge is real and communication is cheaper than bad assignment. Workers can see their own load, cache, tools, permissions, and confidence better than the manager can. The manager can see the global task list, dependencies, budget, and acceptance criteria better than any one worker can. The protocol lets each side contribute the information it actually has.',
        'It also creates a natural audit boundary. The proposal explains why the worker should get the task. The award explains why the manager accepted. The report explains what happened. That sequence is much easier to test and replay than free-form agent chatter.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Negotiation is not free. It adds messages, latency, state, and failure cases. A tiny task may not deserve an auction. A task with one obvious safe owner may be better handled by a direct queue. The protocol is most useful when tasks are valuable enough, workers differ enough, and bad assignment is expensive enough.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Icnp.svg/500px-Icnp.svg.png', alt: 'AUML sequence diagram of the iterated Contract Net Protocol', caption: 'The iterated version makes the cost visible: better fit can require another proposal round. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Icnp.svg.'},
        'The manager also becomes a policy point. Bad scoring can starve long-term work, overvalue short tasks, underweight verification, or route risky work to cheap workers. If every bid is self-reported and never checked, the market rewards confident claims. Contract Net needs measurement, calibration, and guardrails.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The pattern fits distributed sensing, traffic control, search, logistics, cloud workers, and modern agent orchestration. A supervisor can publish tasks such as find current sources, repair a failing route, run browser validation, reduce a benchmark failure, or write a synthesis memo. Agents bid with capability, load, and expected proof.',
        'It also composes well with other structures. Message Queue carries the announcements and reports. Binary Heap ranks proposals. Distributed Tracing follows contracts across workers. Rate Limiter caps bidding and execution. Saga Pattern helps undo multi-step side effects. Blackboard Architecture can hold shared evidence while Contract Net decides who should act next.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is dishonest or poorly calibrated bidding. Agents can overestimate confidence, undercount cost, or hide uncertainty. The fix is to compare bids with outcomes and feed that history back into ranking. The second failure mode is retry storms. A failed contract should not be reannounced forever with the same envelope.',
        'The third failure mode is unclear ownership. If two agents both think they won, duplicate side effects can occur. If no one records rejections, agents may hold resources unnecessarily. If the manager cannot explain awards, users cannot tell whether the protocol is improving allocation or just adding ceremony.',
        'A fourth failure is strategic bidding. If workers are optimized for winning tasks instead of completing valuable work, they may shade estimates, avoid hard tasks, or overclaim expertise. Outcome-based calibration and random audits keep the market tied to delivery rather than salesmanship.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources include Smith, The Contract Net Protocol, at https://www.eecs.ucf.edu/~lboloni/Teaching/EEL6788_2008/papers/The_Contract_Net_Protocol_Dec-1980.pdf, and the Semantic Scholar record at https://www.semanticscholar.org/paper/The-Contract-Net-Protocol%3A-High-Level-Communication-Smith/d3cdca6dcd3fdf4a19b6553f81665095de28cc8d.',
        'Study Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Blackboard Architecture Agent Coordination, Message Queue, Binary Heap, Distributed Tracing, Rate Limiter, Circuit Breakers, Saga Pattern, Temporal Workflow Case Study, LLM Guardrail Policy Engine, and Queue Backpressure next.',
      ],
    },
  ],
};
