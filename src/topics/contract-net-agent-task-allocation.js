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
  const candidates = ['a', 'b', 'c'];
  const protocolNodes = ['manager', 'cfp', 'a', 'b', 'c', 'heap', 'award', 'reject', 'report', 'audit'];
  yield {
    state: contractGraph('A manager announces a task'),
    highlight: { active: ['manager', 'cfp', 'a', 'b', 'c', 'e-manager-cfp', 'e-cfp-a', 'e-cfp-b', 'e-cfp-c'], compare: ['heap'] },
    explanation: `The manager does not guess who should work. It publishes a task envelope to ${candidates.length} candidate agents, then lets workers expose their private load, skill, and cost through bids.`,
  };

  yield {
    state: contractGraph('Agents bid from local knowledge'),
    highlight: { active: ['a', 'b', 'c', 'heap', 'e-a-heap', 'e-b-heap', 'e-c-heap'], compare: ['manager'] },
    explanation: `Each of the ${candidates.length} agents decides whether to bid using private state: current load, tools, expertise, expected cost, confidence, and opportunity cost. The manager does not need to know every worker detail.`,
    invariant: `Each bid from the ${candidates.length} candidates is a compact promise about capability, cost, and risk.`,
  };

  yield {
    state: contractGraph('A bid heap ranks offers'),
    highlight: { active: ['heap', 'award', 'reject', 'e-heap-award', 'e-heap-reject'], found: ['audit'] },
    explanation: `The manager ranks up to ${candidates.length} bids with a utility function. In code this is often a priority queue keyed by expected value: quality score minus latency, cost, risk, and coordination overhead.`,
  };

  yield {
    state: contractGraph('Award creates a commitment'),
    highlight: { active: ['award', 'report', 'manager', 'e-award-report', 'e-report-manager'], compare: ['reject'] },
    explanation: `The winning agent receives the award and commits to execution. The remaining ${candidates.length - 1} losing agents are released. The result report closes the contract across ${protocolNodes.length} protocol nodes.`,
  };

  const messageTypes = [
    { id: 'cfp', label: 'CFP' },
    { id: 'proposal', label: 'proposal' },
    { id: 'refuse', label: 'refuse' },
    { id: 'award', label: 'award' },
    { id: 'inform', label: 'inform/fail' },
  ];
  const messageCols = [
    { id: 'sender', label: 'sender' },
    { id: 'payload', label: 'payload' },
    { id: 'state', label: 'state change' },
  ];
  yield {
    state: labelMatrix(
      'Contract Net message types',
      messageTypes,
      messageCols,
      [
        ['manager', 'task + eval', 'open auction'],
        ['candidate', 'cost + ETA', 'rank bid'],
        ['candidate', 'reason', 'free worker'],
        ['manager', 'selected bid', 'commit'],
        ['winner', 'result/error', 'close/retry'],
      ],
    ),
    highlight: { active: ['cfp:payload', 'proposal:payload', 'award:state', 'inform:state'], compare: ['refuse:state'] },
    explanation: `The protocol defines ${messageTypes.length} message types (${messageTypes.map(m => m.label).join(', ')}), each with ${messageCols.length} fields. That makes it easier to test than free-form agent chatter and easier to audit than hidden routing heuristics.`,
  };
}

function* agentAllocation() {
  const specialists = ['code', 'research', 'ops'];
  const allocNodes = ['plan', 'router', 'code', 'research', 'ops', 'score', 'run', 'retry', 'result', 'budget'];
  yield {
    state: allocationGraph('A task DAG feeds the market'),
    highlight: { active: ['plan', 'router', 'e-plan-router'], compare: ['code', 'research', 'ops'] },
    explanation: `Read the task DAG as the supply of ready work. The router publishes to ${specialists.length} specialist pools (${specialists.join(', ')}), and each bids on the slices where its tools, context, and proof artifacts make it worth choosing.`,
  };

  yield {
    state: allocationGraph('Bids expose tradeoffs'),
    highlight: { active: ['code', 'research', 'ops', 'score', 'e-code-score', 'e-research-score', 'e-ops-score'], found: ['budget'] },
    explanation: `The score function combines bids from ${specialists.length} specialist types. It weighs domain fit, tool access, context freshness, estimated tokens, queue delay, expected verification cost, and risk. The best bid is rarely just the cheapest.`,
  };

  yield {
    state: allocationGraph('Execution is bounded by budget'),
    highlight: { active: ['score', 'run', 'budget', 'e-score-run', 'e-run-budget'], compare: ['retry'] },
    explanation: `After award, the worker executes inside an explicit envelope across ${allocNodes.length} allocation nodes: tool permissions, token limit, deadline, retry count, required artifacts, and stop condition. Contract Net allocates work; it does not remove safety gates.`,
  };

  yield {
    state: allocationGraph('Failures reopen or escalate the contract'),
    highlight: { active: ['run', 'retry', 'router', 'e-score-retry', 'e-retry-router'], found: ['result'] },
    explanation: `If the winner fails, times out, or returns unverifiable work, the manager can reannounce the task to the ${specialists.length} specialist pools with new context, blacklist a bad route, split the task, or escalate to a human.`,
    invariant: `A failed contract should create better routing information for the next round of ${specialists.length} bidders, not just another blind retry.`,
  };

  const scoringFeatures = [
    { id: 'skill', label: 'skill fit' },
    { id: 'context', label: 'context' },
    { id: 'cost', label: 'cost' },
    { id: 'risk', label: 'risk' },
    { id: 'proof', label: 'proof' },
  ];
  const scoringCols = [
    { id: 'signal', label: 'signal' },
    { id: 'effect', label: 'effect' },
  ];
  yield {
    state: labelMatrix(
      'Bid scoring features',
      scoringFeatures,
      scoringCols,
      [
        ['tool + domain', 'raises quality'],
        ['fresh memory', 'cuts setup'],
        ['tokens + time', 'lowers utility'],
        ['permissions', 'needs guardrail'],
        ['tests/citations', 'raises trust'],
      ],
    ),
    highlight: { active: ['skill:effect', 'context:effect', 'proof:effect'], compare: ['cost:effect', 'risk:effect'] },
    explanation: `A useful bid is not just "I can do it." It should expose ${scoringFeatures.length} scoring dimensions (${scoringFeatures.map(f => f.label).join(', ')}) explaining why this worker is a good match and what verification artifact it will return.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selectable from the dropdown. The "negotiation protocol" view traces a single task through the full Contract Net lifecycle: a manager node publishes a call for proposals (CFP) to three candidate agents (A, B, C), each agent submits a bid from its private knowledge, a heap ranks the bids by utility, the top bidder receives an award, and the losers receive rejections. The final matrix frame lists the five message types in the protocol with their sender, payload, and state-change effect.',
        {type: 'image', src: './assets/gifs/contract-net-agent-task-allocation.gif', alt: 'Animated walkthrough of the contract net agent task allocation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The "agent allocation" view lifts the same protocol to a task DAG with three specialist pools (code, research, ops). Watch the router publish dependency-ready tasks, specialists bid on slices where their tools matter, the score function pick a winner, and a failed execution reopen the contract through the retry path instead of blindly looping. Found nodes mark outputs that are guaranteed correct at that point in the pipeline.',
        'Active highlights (bright) mark the nodes and edges involved in the current step. Compare highlights (dim) mark nodes that exist but are not yet participating. At each frame, ask: which phase of the protocol am I in -- announce, bid, rank, award, execute, or report? The protocol is a state machine over messages, and each frame advances exactly one transition.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A multi-agent system is a group of independent programs, called agents, that each perceive their own state and act on tasks. The allocation problem is: given a new task, which agent should do it? A central planner seems natural, but it has a fatal information deficit. Each agent holds private state the planner cannot see: its current queue depth, which tools it has loaded, how much relevant context it has cached, its recent failure rate, and its estimated cost for the work.',
        {type: 'callout', text: 'Contract Net turns assignment into an auditable negotiation where bids expose local knowledge before the manager commits.'},
        'Reid G. Smith introduced the Contract Net Protocol in 1980 for distributed problem solving among loosely coupled nodes that had no shared memory. The idea mirrors real-world contracting: a manager announces available work, interested contractors submit bids, the manager evaluates bids and awards the contract, and the winner delivers a result. The protocol replaces static routing tables with a small market that surfaces private information through structured proposals.',
        'The need is sharper today than in 1980. Modern LLM agent systems routinely have five or more specialist agents, each with different tools, context windows, cost profiles, and verification capabilities. Routing a web-search task to a coding agent because the routing table says "agent-2 is next in the round-robin" wastes tokens, time, and user trust. Contract Net gives the orchestrator a principled way to ask agents what they can actually deliver before committing.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest assignment rule is label-based routing: code tasks go to the coding agent, research tasks go to the research agent, deploy tasks go to the operations agent. This works when tasks map cleanly to a single skill and every agent in a category is interchangeable. A team of three specialists with non-overlapping skills and equal load would be served fine by a static dispatch table.',
        'Round-robin is the next step up. It distributes tasks evenly by count, cycling through workers. In a pool of four identical workers, round-robin guarantees no worker receives more than one extra task compared to any other. The implementation is a single counter modulo the pool size, and it requires zero knowledge about the task or the worker.',
        'Least-loaded routing improves on round-robin by tracking in-flight task counts. New work goes to the worker with the fewest active tasks. This handles heterogeneous task duration better because fast workers naturally drain their queues and receive more work. Load balancers in web serving use this approach successfully across thousands of stateless HTTP servers.',
        'All three approaches share a simplicity advantage: no negotiation overhead, no bid latency, no scoring function to tune. For homogeneous workers doing interchangeable work, they are the right answer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Label-based routing breaks when labels are incomplete descriptions of tasks. A task labeled "code" might require fetching current documentation from the web. A task labeled "research" might require executing a parser to extract structured data. The label tells the router a category; it does not encode the actual requirements. Adding more labels creates a combinatorial explosion of routing rules, and every new tool or capability requires updating the router.',
        'Round-robin and least-loaded routing break when workers are not interchangeable. An agent with the target repository already loaded in its context window might finish a modification task in 30 seconds. An identical agent starting cold on the same task might take 10 minutes and produce lower-quality output. Least-loaded routing sees both agents as equally suited because it only counts queue depth, not fit.',
        'The structural flaw shared by all three approaches is that the assigner decides alone using incomplete information, then discovers the mismatch only after the work fails or takes too long. The cost of a bad assignment is not just the failed attempt. It is the wasted compute, the added latency, and the lost opportunity to route the task to a better worker from the start. In a system processing 1,000 tasks per hour where 15% are misrouted and each misroute costs an extra 30 seconds, static routing wastes 75 minutes of agent-time per hour.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Task allocation is a decision under uncertainty, and the agents themselves hold the missing information. Instead of guessing, the manager should ask. A bid is not a simple "yes, I can do it." It is a structured promise: I have these tools, my queue depth is 2, my estimated cost is 500 tokens, my confidence is 0.85, I will return a test suite as proof, and I can start in 3 seconds. The manager collects bids, ranks them by a utility function that combines the bid dimensions into a single score, and awards the task to the highest-scoring bidder.',
        'The market metaphor is precise, not decorative. In a market, prices aggregate distributed private information into a single signal that guides allocation. In Contract Net, bids aggregate distributed private capability. The manager does not need to understand every worker\'s internal state; it only needs to rank the summaries that workers choose to reveal. This is the same principle that makes auction mechanisms efficient in economics: the participants who value the resource most are the ones who bid highest.',
        'The audit trail is as important as the allocation itself. Every contract produces a chain of evidence: the CFP describes what was needed, each proposal describes what the worker offered, the award describes why the manager chose, and the report describes what actually happened. When allocation goes wrong, this chain pinpoints whether the problem was a bad bid, a bad scoring function, or a bad execution. Static routing tables produce no such evidence.',
        'The protocol is useful even when every worker is software. An LLM agent can bid higher because it has the relevant file already in context, a cheaper model available for the subtask, lower queue delay, or a stronger verification path. The bid makes these advantages visible to the manager for the first time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The protocol defines five message types that form a strict sequence. A call for proposals (CFP) is a broadcast from the manager containing the task description, required capabilities, deadline, token or compute budget, acceptance criteria, allowed tools, and scoring rule. The CFP is published to a set of candidate agents, either by direct message or by posting to a topic channel.',
        'Each candidate evaluates the CFP against its own private state and either refuses (with a reason) or submits a proposal. A proposal contains estimated cost, estimated time, confidence score, dependency list, risk factors, and an evidence plan describing what proof artifact the worker will return -- test results, citations, a diff, a trace, or a checked artifact. The proposal is a structured message, not free-form text, so the manager can parse and rank it mechanically.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/CNP.svg/500px-CNP.svg.png', alt: 'AUML sequence diagram of the Contract Net Protocol from call for proposals through award and inform', caption: 'The AUML sequence diagram shows the protocol as message order, not informal agent conversation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:CNP.svg.'},
        'The manager collects proposals until a deadline or quorum, inserts them into a priority queue keyed by the utility function, and pops the top bid. The winner receives an award message and transitions to committed status. All losers receive reject messages and are freed to bid on other work. The winner executes the task within the envelope constraints and sends either an inform-done message (success with result) or an inform-failure message (error with reason). A failure can trigger reannouncement with new context, task splitting, blacklisting the failed agent, or escalation to a human.',
        'The contract state machine moves through these phases: announced (CFP sent), bidding (proposals arriving), awarded (winner selected), running (execution in progress), and completed or failed. Each transition is a message. Each message is logged with a timestamp. This makes the entire allocation history replayable and auditable, unlike ad-hoc routing where the assignment decision is buried in application code.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The protocol works because it lets each party contribute the information it actually has. Workers know their own load, cache state, tool access, permissions, and confidence calibration better than any central planner. The manager knows the global task list, inter-task dependencies, total budget, and acceptance criteria better than any individual worker. The bid is the interface where these two information sets meet. Neither side needs complete knowledge; each contributes its local view, and the ranking mechanism synthesizes them.',
        'Correctness of the allocation depends on two properties. First, bids must be honest: the proposal should reflect the agent\'s actual expected cost and capability, not a strategically shaded estimate. Second, the utility function must be aligned with system goals: it should reward the combination of quality, speed, cost, and verification that the organization actually values. When both properties hold, the highest-utility bid is the best available assignment given current information.',
        'The audit trail provides a falsifiability property that static routing lacks. After every completed or failed task, the system can compare the winning bid\'s promises against actual outcomes. If agent A bid 500 tokens and 90% confidence but consumed 2,000 tokens and failed, the system has concrete evidence to discount A\'s future bids. This feedback loop is what makes the market self-correcting over time, rather than requiring a human to hand-tune routing tables when allocation quality degrades.',
        'The protocol also limits blast radius. Because each contract is an explicit commitment with a deadline and a failure path, a stuck or failed agent does not silently block the pipeline. The manager\'s timeout triggers the retry or escalation path, and the rejection messages freed the other candidates to bid on different work. No single agent failure can deadlock the system if the failure path is correctly implemented.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each contract round costs O(k) messages for k candidates: 1 CFP broadcast, up to k proposals, 1 award, k-1 rejections, and 1 result report. The priority queue that ranks bids costs O(k log k) to sort. For a system with n tasks and k candidates per task, total message cost is O(n * k) and total sorting cost is O(n * k log k). With 5 candidates, a single round is about 13 messages -- negligible compared to the cost of executing the task itself.',
        'Latency increases by the bid window duration. If the manager waits 2 seconds for proposals before ranking, every task takes at least 2 seconds longer than a direct assignment. For a task that takes 60 seconds to execute, 2 seconds of bidding overhead is 3%. For a task that takes 100 milliseconds to execute, the bidding overhead dominates. The breakeven rule: use Contract Net when the expected cost of a bad assignment exceeds the cost of the negotiation. A task misrouted to the wrong agent that takes 30 seconds instead of 5 wastes 25 seconds; spending 50 milliseconds to avoid that waste is a 500x return.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Icnp.svg/500px-Icnp.svg.png', alt: 'AUML sequence diagram of the iterated Contract Net Protocol', caption: 'The iterated version makes the cost visible: better fit can require another proposal round. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Icnp.svg.'},
        'State storage grows linearly with active contracts. Each contract requires a state machine entry, a bid table, and an audit log entry. In a system processing 10,000 tasks per hour with an average contract lifetime of 30 seconds, roughly 80 contracts are active at any moment. The memory cost is modest. The operational cost to watch is the scoring function: if scoring requires calling an external model or running a simulation, that per-bid cost can exceed the savings from better allocation.',
        'The iterated variant (ICNP) adds another cost layer. If the first round of bids is unsatisfactory, the manager reannounces with tighter constraints or requests revised proposals. Each iteration roughly doubles the message count. Two rounds cost about 26 messages instead of 13. In practice, most contracts settle in one round; the iterated path is a safety valve for high-stakes tasks where fit matters more than speed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Distributed manufacturing is the original application. A factory floor with 20 CNC machines receives job orders. Each machine has different tooling installed, different queue depth, and different maintenance status. The scheduler broadcasts the job, machines bid based on their current state (tooling match, queue depth, estimated setup time), and the scheduler awards the job to the best-fit machine. Smith designed Contract Net for exactly this pattern.',
        'Cloud task scheduling uses variants of the protocol. A job dispatcher receives heterogeneous compute tasks (CPU-bound, GPU-bound, memory-intensive). Worker nodes bid with their current utilization, available hardware, and estimated completion time. The dispatcher awards each task to the node that minimizes total cost or wall-clock latency. Kubernetes does not use Contract Net directly, but its scheduler scoring plugins implement the same principle: nodes evaluate a workload against local state and return a score.',
        'Modern LLM agent orchestration is the most active application area. A supervisor agent decomposes a complex request into subtasks -- search the web, analyze a document, write code, run tests -- and specialist agents bid based on their loaded context, available tools, model cost, and confidence. The supervisor awards each subtask and tracks completion. This pattern appears in frameworks like AutoGen, CrewAI, and custom multi-agent pipelines where task routing is the central design decision.',
        'Distributed sensor networks use the protocol for surveillance and environmental monitoring. A command center announces "track target in sector 7," and sensors bid based on current orientation, battery level, and signal quality. The sensor with the best viewing angle and sufficient battery wins the contract. If it loses track, the contract fails and nearby sensors rebid with updated context.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Dishonest or miscalibrated bidding is the first failure mode. If agents self-report confidence and cost without verification, the market rewards overconfidence. An agent that always bids 0.95 confidence and 100 tokens will win most auctions even if it fails 40% of the time. The fix is outcome tracking: after each contract, compare the bid\'s promises against actual results and adjust the agent\'s credibility multiplier. Without this feedback loop, the protocol degenerates into a confidence contest where the loudest bidder always wins.',
        'Retry storms are the second failure mode. A task fails and is reannounced with the same CFP. The same agents bid, the same winner is selected, and the same failure occurs. Each retry burns messages, latency, and compute without progress. The fix is to mutate the envelope on retry: attach failure context (which agent failed, why, what was tried), blacklist the failed route, tighten constraints, split the task, or escalate to a different agent class. A naive retry policy that reannounces blindly can loop indefinitely.',
        'Ownership ambiguity is the third failure mode. If the award message is lost or duplicated due to a network partition, two agents may both believe they won, causing duplicate side effects: two database writes, two API calls, two deployed containers. The state machine must enforce exactly-once award semantics, which requires acknowledgment messages or idempotency guarantees at the execution layer. This is the same problem that distributed consensus protocols solve, and it is not trivial.',
        'Overhead on trivial tasks is the fourth failure mode. A task that takes 50 milliseconds to execute does not benefit from a 2-second bidding round with 10 candidates. Systems need a fast path for tasks with one obvious owner (direct dispatch) and a negotiation path for tasks where the best assignee is genuinely uncertain. Routing every task through the full protocol wastes latency on easy cases and makes the system slower than static routing for the majority of tasks that are straightforward.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A supervisor agent receives the task: "Find the three most-cited papers on retrieval-augmented generation published after 2023 and summarize each paper\'s key contribution in one sentence." Three agents are candidates: Agent R (research specialist with a Semantic Scholar API key and 1,200 tokens of cached context from a related search done 10 minutes ago, queue depth 1), Agent C (coding specialist with no search API and no cached context, queue depth 0), and Agent O (operations specialist with system access but no research tools).',
        'The supervisor publishes a CFP: task_id="rag-survey", type="literature-search", required_capabilities=["web-search", "citation-ranking"], deadline=30s, budget=2,000 tokens, acceptance_criteria="3 papers with title, year, citation count, and one-sentence summary each", scoring_rule="utility = confidence * 0.4 + context_freshness * 0.3 + (1 - normalized_cost) * 0.2 + (1 - risk) * 0.1".',
        'Agent O refuses immediately: it lacks the required web-search capability. Agent R bids: confidence=0.92, context_freshness=0.80, estimated_cost=800 tokens (normalized: 0.40), risk=0.08, evidence_plan="return Semantic Scholar result IDs for verification." Agent C bids: confidence=0.35, context_freshness=0.0, estimated_cost=1,800 tokens (normalized: 0.90), risk=0.55, evidence_plan="best effort, no citation verification."',
        'The manager computes utility. Agent R: 0.92*0.4 + 0.80*0.3 + (1-0.40)*0.2 + (1-0.08)*0.1 = 0.368 + 0.240 + 0.120 + 0.092 = 0.820. Agent C: 0.35*0.4 + 0.0*0.3 + (1-0.90)*0.2 + (1-0.55)*0.1 = 0.140 + 0.000 + 0.020 + 0.045 = 0.205. Agent R wins with utility 0.820 vs. 0.205. The manager awards to R, rejects C, and logs both scores with the formula used.',
        'Agent R executes in 14 seconds using 780 tokens, returns three papers with Semantic Scholar IDs and citation counts (2,341; 1,587; 1,104), and the contract closes with status "inform-done." The audit log records: CFP issued at t=0, two bids received by t=2.8, award sent at t=3.0, result received at t=17.0. Actual cost (780 tokens) was close to the bid estimate (800 tokens), so R\'s calibration score improves slightly. If R had failed, the manager would reannounce with failure context so that scoring penalizes agents without warm search sessions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original protocol is defined in Reid G. Smith, "The Contract Net Protocol: High-Level Communication and Control in a Distributed Problem Solver," IEEE Transactions on Computers, 1980. Full text: https://www.eecs.ucf.edu/~lboloni/Teaching/EEL6788_2008/papers/The_Contract_Net_Protocol_Dec-1980.pdf. Semantic Scholar record: https://www.semanticscholar.org/paper/The-Contract-Net-Protocol%3A-High-Level-Communication-Smith/d3cdca6dcd3fdf4a19b6553f81665095de28cc8d.',
        'The FIPA Contract Net Interaction Protocol Specification (Foundation for Intelligent Physical Agents, 2002) standardized the message types, sequence constraints, and failure-handling semantics used in most modern multi-agent frameworks. It formalizes the state machine that the original paper described informally.',
        'For prerequisites, study Message Queue (the transport layer that carries CFPs, proposals, awards, and reports between agents) and Binary Heap (the priority queue that ranks bids by utility -- O(log k) insert and extract-max for k bids). The scoring function is the design decision; the heap just enforces the ordering it produces.',
        'For extensions, study Multi-Agent Orchestration Topologies (the broader design space that Contract Net inhabits), Agent2Agent Protocol Task State Case Study (a modern protocol building on similar ideas), and Blackboard Architecture Agent Coordination (a complementary pattern where agents share evidence on a common workspace instead of bidding on isolated tasks).',
        'For production hardening, study Distributed Tracing (follow a contract across agents), Circuit Breakers (stop retrying a persistently failing agent), Rate Limiter (cap bidding and execution volume), Saga Pattern (undo multi-step side effects when a contract fails partway through), and LLM Guardrail Policy Engine (constrain what awarded agents are allowed to do during execution).',
      ],
    },
  ],
};
