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
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'Topology is a data-structure choice: it decides where state lives, how work is partitioned, and how evidence is reduced.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/IntelligentAgent-SimpleReflex.png/250px-IntelligentAgent-SimpleReflex.png', alt: 'Simple reflex agent diagram with sensors and actuators', caption: 'A single agent loop is the baseline coordination shape before any multi-agent topology is justified. Source: Wikimedia Commons, Raul654, public domain.'},
        'The topology map view is a selection chart. A task enters the selector node, which decides whether one agent loop is sufficient or whether the work needs a coordination shape. Active nodes (highlighted) show the path being evaluated. Compare nodes show the alternatives the selector is weighing. Found nodes mark where merged results land.',
        'The research case study view shows a concrete supervisor fan-out. The lead agent decomposes a question into parallel subagents (sub A, B, C), each exploring a different slice. Workers write into a ledger (sources with citations) and a board (normalized claims). The synth node reduces those records. The gate node checks quality; the budget node tracks token and tool-call spend.',
        {
          type: 'diagram',
          text: [
            'Topology map path:',
            '',
            '  task --> selector --+--> single       (one loop, no coordination)',
            '                      |',
            '                      +--> supervisor --+--> blackboard --> synth --> eval',
            '                      |                 +--> contract   -->  |    --> trace',
            '                      |',
            '                      +--> handoff -----+--> debate ------> synth',
            '',
            'Research case study path:',
            '',
            '  user --> lead --+--> sub A --> ledger --+',
            '                  +--> sub B --> ledger --+--> synth --> gate',
            '                  +--> sub C --> board  --+         --> budget',
          ].join('\n'),
          label: 'Node flow in both animation views',
        },
        'The matrix steps show topology selection tables and record schemas. Active cells highlight the best fit for a given data shape. Compare cells flag the main risk of each topology. Use the matrix to answer: given my task shape, which coordination pattern has the smallest overhead that still covers the missing property?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/IntelligentAgent-Learning.svg/250px-IntelligentAgent-Learning.svg.png', alt: 'Learning agent diagram with performance element, critic, and problem generator', caption: 'Learning-agent diagrams show why coordination needs explicit feedback, state, and quality checks instead of loose message passing. Source: Wikimedia Commons, Raul654, public domain.'},
        {
          type: 'quote',
          text: 'The hard part of building a multi-agent system is not getting multiple models to talk. It is making their work add up to one reliable outcome.',
          attribution: 'Anthropic, Building Effective Agents (2025)',
        },
        'A single agent loop -- plan, act, observe, revise, stop -- handles most tasks well. It strains when the work is wide: many independent branches to search, different parts needing different tools or permissions, evidence scattered across sources, or high-stakes synthesis where independent critique changes the answer.',
        'Multi-agent orchestration exists to match the coordination shape to the problem shape. A supervisor fan-out covers breadth. A handoff chain covers role transitions. A blackboard covers evolving shared evidence. A contract net covers scarce or heterogeneous workers. A debate topology covers independent critique. Each shape is a data-structure choice: task DAGs, mailboxes, claim boards, bid heaps, and merge reducers.',
        {
          type: 'note',
          text: 'Adding agents is not adding intelligence. It is adding coordination overhead. The system earns that overhead only when the separations -- context isolation, role-specific tools, parallel latency, independent critique -- change the final answer.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Run one strong agent with a long context window and good tools. This is the correct baseline. It has one conversation state, one tool history, one plan, and one place where intent is preserved. Every decision appears in one trace. Debugging is straightforward because the full causal chain lives in one run.',
        'A single loop is cheaper because no coordination records exist, no reducer needs to merge partial results, and no budget tracker needs to gate further exploration. For sequential work that fits in one context, a single agent with better tools will outperform a multi-agent system with worse tools.',
        {
          type: 'bullets',
          items: [
            'State location: a single agent has one context window; a multi-agent system distributes state across workers and must merge it.',
            'Debugging: a single loop gives one trace; multi-agent work needs cross-agent trace stitching.',
            'Latency: a single loop serializes tool calls; fan-out only helps when branches are independent.',
            'Cost: a single loop pays one model context; multi-agent work pays worker contexts, coordination overhead, and reducer context.',
            'Critique: self-critique shares the same context; independent critique can expose different evidence if the reducer preserves provenance.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The single loop hits a wall when work is wide rather than merely long. The agent must serialize all searches, carry all evidence in one context, and decide which branches to abandon before knowing what is inside them. Critique generated by the same context that wrote the first answer shares all the same blind spots.',
        'Consider a deep research task: evaluate whether a vendor meets 8 compliance requirements across security docs, pricing pages, incident history, and integration specs. A single agent must visit each source sequentially, holding all prior findings in context while searching for the next. By the time it reaches requirement 7, early findings may have scrolled out of effective attention, and wall-clock latency is the sum of all searches.',
        {
          type: 'diagram',
          text: [
            'Single agent, serial execution:',
            '',
            '  search_1 --> search_2 --> search_3 --> ... --> search_8 --> synthesize',
            '  |                                                          |',
            '  +--- context carries ALL prior results --->                |',
            '  Wall: context pressure grows linearly, latency = sum(all searches)',
            '',
            'Supervisor fan-out:',
            '',
            '  lead decomposes --> [worker_1, worker_2, ..., worker_8] in parallel',
            '                       |          |                |',
            '                       v          v                v',
            '                    ledger entries (structured records)',
            '                       |          |                |',
            '                       +------> reduce <-----------+',
            '  Each worker: isolated context, narrow scope',
            '  Latency = max(worker) + reduce',
          ].join('\n'),
          label: 'Serial context pressure vs. parallel context isolation',
        },
        {
          type: 'note',
          text: 'The wall is not "the task is too hard for one model." The wall is that the task has independent branches, and serializing them wastes latency while pressuring context. Adding agents without structured records for merging makes the wall worse, not better.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Most useful topologies reduce to directed task graphs with explicit worker outputs and reducer edges. Source: Wikimedia Commons, David W., public domain.'},
        'Each topology is defined by its coordination records and merge contract.',
        {
          type: 'bullets',
          items: [
            'Single loop: trace plus memory, one context, best for sequential tool work.',
            'Supervisor: task DAG plus mailboxes, reducer joins structured worker results, best for independent parallel branches.',
            'Handoff: state envelope carrying intent, steps, constraints, and open questions, best for role transitions with different tools.',
            'Blackboard: shared claim table with provenance and freshness, best for evolving hypotheses from multiple sources.',
            'Contract net: broadcast queue plus bid ledger, best when workers are scarce or heterogeneous.',
            'Debate and map-reduce: candidate set plus critique set, best when high-stakes synthesis needs independent comparison.',
          ],
        },
        'A supervisor decomposes a goal into subquestions or work packets and launches workers. Each worker gets a narrow scope, its own context window, and a result schema. The worker returns structured evidence -- not polished prose. The reducer joins results by claim, source, entity, and uncertainty. If two workers disagree, the reducer exposes the conflict or requests targeted follow-up.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Minimal supervisor fan-out contract',
            'const workerResult = {',
            '  taskId:       "search-security-docs",',
            '  status:       "complete",           // complete | partial | failed',
            '  claims:       [                     // structured, not prose',
            '    { text: "SOC 2 Type II certified", source: "trust.vendor.com/soc2",',
            '      confidence: "high", retrieved: "2026-06-18" }',
            '  ],',
            '  openQuestions: ["No mention of data residency region"],',
            '  tokensUsed:   4200,',
            '  toolCalls:    3,',
            '};',
            '',
            '// Reducer joins by requirement, not by worker',
            'function reduce(workerResults, requirements) {',
            '  const joined = new Map();',
            '  for (const req of requirements) {',
            '    const supporting = workerResults.flatMap(r =>',
            '      r.claims.filter(c => matchesRequirement(c, req))',
            '    );',
            '    const conflicts = findContradictions(supporting);',
            '    joined.set(req, { supporting, conflicts,',
            '      coverage: supporting.length > 0 ? "covered" : "gap" });',
            '  }',
            '  return joined;',
            '}',
          ].join('\n'),
          label: 'Worker result schema and requirement-keyed reduce',
        },
        'A handoff topology passes control between specialists. The state envelope -- not just the conversation -- must transfer: user intent, completed steps, current constraints, open questions, permissions, tool outputs, and the reason for transfer. Support triage to billing to retention is a natural handoff chain; each agent uses different tools and policies but the customer context must survive intact.',
        'A blackboard lets multiple workers read and write a shared claim table. Each entry carries provenance (who asserted it, from which source, when) and freshness. The coordinator watches the board and decides when enough evidence exists to synthesize or when a contradiction needs resolution. Contract-net adds worker selection: the coordinator broadcasts a task, workers bid with capability and cost, and the best bid wins.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works when it creates useful independence. Separate context windows search different parts of the space without crowding each other. Separate roles use different instructions and tools without mixing policies. Separate candidate generators expose disagreement that a single context would suppress. The coordinator earns its overhead only when those separations change the final answer.',
        'The correctness invariant: every worker output must be reducible. It must carry enough structure for the coordinator to merge it without guessing. A useful worker result says what task it handled, what it found, what evidence supports it, what assumptions it made, what remains uncertain, what budget it spent, and what it recommends next.',
        {
          type: 'diagram',
          text: [
            'Reducibility invariant:',
            '',
            '  worker_output = {',
            '    task_id,           // which subproblem',
            '    claims[],          // what was found, with sources',
            '    assumptions[],     // what was taken as given',
            '    open_questions[],  // what remains uncertain',
            '    budget_spent,      // tokens, tool calls, wall time',
            '    recommendation     // what to do next',
            '  }',
            '',
            '  If any field is missing, the reducer must guess.',
            '  Guessing is where multi-agent systems fail.',
          ].join('\n'),
          label: 'The reducibility contract every worker must satisfy',
        },
        'Budgets enforce honesty. The orchestrator should know the expected value of another worker: what missing branch it covers, what uncertainty it may reduce, and what cost it consumes. A system that launches workers without answering that question is spending, not coordinating.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Single loop: baseline token cost, latency is the sum of tool calls, and debugging stays in one trace.',
            'Supervisor with k workers: token cost is k worker contexts plus reducer context; latency is roughly the slowest worker plus reduce time.',
            'Handoff with n stages: token cost grows by stage context, latency remains serial, and correctness depends on the handoff envelope.',
            'Blackboard: workers spend tokens reading and writing shared records, and debugging requires board history plus worker traces.',
            'Contract net: bid rounds add latency and logs, but they can prevent scarce or specialized workers from being wasted.',
            'Debate or map-reduce: candidate isolation improves critique, but the reducer must compare evidence rather than merge fluent prose.',
          ],
        },
        'Token cost scales with the number of workers times their average context size, plus the reducer context. A supervisor fan-out with 5 workers each using 4,000 tokens costs roughly 20,000 worker tokens plus 5,000-10,000 reducer tokens -- compared to perhaps 15,000 for a single agent doing the same work serially. The multi-agent version pays 50-100% more tokens but finishes in wall-clock time equal to the slowest worker, not the sum.',
        'The coordination overhead is not free. Task DAGs, mailboxes, result schemas, budget trackers, and traces are all code that must be built, tested, and maintained. For a one-off task, this overhead exceeds the benefit. For a recurring workflow run thousands of times, the overhead amortizes and the consistency gains compound.',
        {
          type: 'note',
          text: 'Doubling the number of workers does not double coverage. Each additional worker has diminishing marginal value unless it covers a genuinely independent branch. Five workers searching the same source family will produce redundant claims and waste reducer context on deduplication.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Multi-agent orchestration earns its cost in workloads with three properties: the task has independent branches, the branches benefit from context isolation, and the final answer needs structured evidence that can be merged.',
        {
          type: 'bullets',
          items: [
            'Breadth-first research: a lead agent decomposes a question, parallel workers search different source families (web, docs, databases, code), and a reducer joins claims by topic with citations.',
            'Codebase audits: separate workers scan different modules or apply different review lenses (security, performance, correctness), reporting findings in a shared schema.',
            'Incident response: one agent gathers logs, one queries metrics, one checks recent deployments, one searches past incidents. The coordinator correlates timelines.',
            'Data extraction across many documents: each worker processes a different document or shard, returning structured records. The reducer deduplicates and normalizes.',
            'Candidate generation with judging: multiple agents draft independent solutions. A separate critic evaluates each draft against explicit criteria. The reducer selects or synthesizes.',
            'Permission isolation: a source-gathering worker has web access but no production writes. A deployment worker has production access but no external network. Blast radius shrinks.',
          ],
        },
        'Latency is the clearest win. Five independent web searches running in parallel finish in the time of the slowest one, not the sum. For time-sensitive workflows -- incident response, competitive analysis, real-time research -- this alone can justify the coordination cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the task is actually sequential, when workers need the same scarce context, or when the reducer cannot inspect evidence. Specific failure modes:',
        {
          type: 'bullets',
          items: [
            'State drift: worker A assumes a constraint changed; worker B uses the old constraint. The reducer does not notice the inconsistency. The final answer contradicts itself.',
            'Lost provenance: a claim survives into the final answer after its source was dropped or contradicted by another worker. No one traces back to check.',
            'False consensus: several workers repeat the same weak source. The reducer treats repetition as independent support. Three agents citing the same blog post is one data point, not three.',
            'Prose merging instead of record merging: workers return polished paragraphs. The reducer must merge style and structure simultaneously. Evidence is buried inside sentences, making conflict detection impossible.',
            'No stop rule: agents keep launching subagents or requesting follow-up without a budget gate. The system spends more tokens than a single agent would have, with no improvement in answer quality.',
            'Coordination theater: a system uses multi-agent architecture for a task that one agent with better tools could handle. The overhead adds latency, cost, and debugging complexity with no coverage gain.',
          ],
        },
        {
          type: 'note',
          text: 'The most dangerous failure is invisible: the system produces a confident, well-formatted answer assembled from worker outputs that were never cross-checked. The answer reads well but its claims lack independent support. Multi-agent systems must make evidence auditable, not just fluent.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Anthropic, "Building Effective Agents" (2025). Defines single-loop, handoff, and supervisor patterns with implementation guidance.',
            'Anthropic, "Context Engineering for AI Agents" (2025). Covers context window management, tool design, and multi-agent coordination records.',
            'Reid Smith, "The Contract Net Protocol: High-Level Communication and Control in a Distributed Problem Solver," IEEE Transactions on Computers, 1980. The original contract-net allocation paper.',
            'H. Penny Nii, "Blackboard Systems," AI Magazine 7(2), 1986. Survey of blackboard architectures for cooperative problem solving.',
            'Chi-Min Chan et al., "ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate," arXiv 2308.07201, 2023. Debate topology for LLM evaluation.',
            'Qingyun Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation," arXiv 2308.08155, 2023. Open-source multi-agent conversation framework.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Agentic AI Patterns, to understand the single-agent loop before adding topology.',
            'Handoff state: Agent Model Router and Context Handoff Ledger, for state envelopes between specialists.',
            'Shared evidence: Blackboard Architecture Agent Coordination, for claim boards with provenance.',
            'Task allocation: Contract Net Agent Task Allocation, for worker bids with capability and cost.',
            'Provenance: Claim Graph and Source Ledger, for linking claims to sources with confidence and freshness.',
            'Observability: Distributed Tracing, for stitching cross-agent traces into one audit record.',
            'Async dispatch: Message Queue, for worker acknowledgement without blocking the coordinator.',
            'Policy gates: LLM Guardrail Policy Engine, for enforcing constraints across multiple agents.',
          ],
        },
      ],
    },
  ],
};
