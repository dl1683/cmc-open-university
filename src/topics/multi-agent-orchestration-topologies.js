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
  const hl1 = { active: ['task', 'selector', 'e-task-selector'], compare: ['single', 'supervisor', 'handoff'] };
  yield {
    state: topologyGraph('Start with the cheapest topology that can solve the task'),
    highlight: hl1,
    explanation: `The selector is the important node among ${hl1.active.length} active elements. It asks whether one loop is enough before spending on more agents, choosing among ${hl1.compare.length} alternative topologies: ${hl1.compare.join(', ')}. Extra agents only help when the task has independent branches, specialized handoffs, scarce workers, or critique that changes the answer.`,
  };

  const hl2 = { active: ['selector', 'single', 'e-selector-single'], compare: ['trace', 'eval'] };
  yield {
    state: topologyGraph('A single agent is the baseline'),
    highlight: hl2,
    explanation: `Use one agent when the work is mostly sequential and the agent can keep the important state in one context window. The path activates ${hl2.active.length} elements (${hl2.active.filter(a => !a.startsWith('e-')).join(', ')}) while ${hl2.compare.join(' and ')} remain as checkpoints. This is still an agent loop: plan, act, observe, evaluate, and stop.`,
    invariant: 'Do not add agents when a single loop plus good tools is enough.',
  };

  const hl3 = { active: ['selector', 'supervisor', 'blackboard', 'contract', 'e-selector-supervisor', 'e-supervisor-board', 'e-supervisor-contract'], found: ['synth'] };
  yield {
    state: topologyGraph('Supervisor fan-out buys parallel search'),
    highlight: hl3,
    explanation: `A supervisor decomposes the task and launches subagents, lighting up ${hl3.active.length} active elements across the fan-out path toward ${hl3.found[0]}. It is strongest when the subproblems are independent: web searches, codebase scans, candidate generation, red-team passes, or data extraction over separate shards.`,
  };

  const hl4 = { active: ['selector', 'handoff', 'debate', 'e-selector-handoff', 'e-handoff-debate'], compare: ['supervisor'] };
  yield {
    state: topologyGraph('Handoffs preserve specialized local context'),
    highlight: hl4,
    explanation: `A handoff topology activates ${hl4.active.filter(a => !a.startsWith('e-')).join(', ')} and passes control from one specialist to another, compared against the ${hl4.compare[0]} alternative. It works for workflows such as support triage to billing to retention, where each agent needs its own instructions and tools but the conversation should stay coherent.`,
  };

  const hl5 = { active: ['blackboard', 'contract', 'debate', 'synth', 'e-board-synth', 'e-contract-synth', 'e-debate-synth'], found: ['eval', 'trace'] };
  yield {
    state: topologyGraph('Shared coordination needs explicit state'),
    highlight: hl5,
    explanation: `${hl5.active.filter(a => !a.startsWith('e-')).join(', ')} form the coordination layer, with ${hl5.found.length} downstream nodes (${hl5.found.join(', ')}) consuming merged results. Blackboards, contract-net bidding, and debate/map-reduce are not just prompt patterns. They are data-structure patterns: shared working memory, bid queues, message envelopes, merge reducers, evaluators, and audit traces.`,
  };

  const matRows = [
    { id: 'single', label: 'single loop' },
    { id: 'supervisor', label: 'supervisor' },
    { id: 'handoff', label: 'handoff' },
    { id: 'blackboard', label: 'blackboard' },
    { id: 'contract', label: 'contract net' },
    { id: 'debate', label: 'debate/map' },
  ];
  const matCols = [
    { id: 'best', label: 'best fit' },
    { id: 'state', label: 'main state' },
    { id: 'risk', label: 'main risk' },
  ];
  const hl6 = { active: ['supervisor:best', 'blackboard:state', 'contract:state'], compare: ['single:risk', 'debate:risk'] };
  yield {
    state: labelMatrix(
      'Topology selection table',
      matRows,
      matCols,
      [
        ['sequential tool work', 'trace + memory', 'context drift'],
        ['parallel breadth', 'task DAG', 'merge loss'],
        ['specialized flow', 'handoff record', 'lost intent'],
        ['uncertain evidence', 'shared board', 'stale facts'],
        ['scarce workers', 'bid heap', 'gaming bids'],
        ['quality checks', 'candidate set', 'false consensus'],
      ],
    ),
    highlight: hl6,
    explanation: `The ${matRows.length}x${matCols.length} matrix compares topologies across ${matCols.map(c => c.label).join(', ')}. ${hl6.active.length} cells are active and ${hl6.compare.length} cells flag risks (${hl6.compare.join(', ')}). The topology is an engineering choice, not a maturity badge. Pick by data shape: independent branches want fan-out, evolving hypotheses want a board, scarce capacity wants bidding, and high-stakes synthesis wants independent critique.`,
  };
}

function* researchCaseStudy() {
  const rhl1 = { active: ['user', 'lead', 'subA', 'subB', 'subC', 'e-user-lead', 'e-lead-a', 'e-lead-b', 'e-lead-c'], compare: ['budget'] };
  yield {
    state: researchGraph('Breadth-first research uses context isolation'),
    highlight: rhl1,
    explanation: `Anthropic describes a lead research agent that plans the work and creates ${rhl1.active.filter(a => a.startsWith('sub')).length} parallel subagents (${rhl1.active.filter(a => a.startsWith('sub')).join(', ')}). Each subagent gets its own context window, explores a slice of the problem, and returns compressed findings while ${rhl1.compare[0]} tracks spend.`,
  };

  const rhl2 = { active: ['subA', 'subB', 'subC', 'ledger', 'board', 'e-a-ledger', 'e-b-ledger', 'e-c-board'], compare: ['synth'] };
  yield {
    state: researchGraph('Subagents write evidence, not final prose'),
    highlight: rhl2,
    explanation: `Read the worker outputs as records, not mini-answers. ${rhl2.active.filter(a => !a.startsWith('e-')).length} active nodes channel evidence into storage before reaching ${rhl2.compare[0]}. Subagents should return claims, citations, snippets, uncertainty, and open questions. If they return polished prose, the reducer loses provenance and repeats work.`,
  };

  const rhl3 = { active: ['ledger', 'board', 'synth', 'gate', 'e-ledger-synth', 'e-board-synth', 'e-synth-gate'], found: ['budget'] };
  yield {
    state: researchGraph('Synthesis is a reduce step with quality gates'),
    highlight: rhl3,
    explanation: `The lead agent reduces the partial results into a coherent answer by activating ${rhl3.active.length} elements across the merge path (${rhl3.active.filter(a => !a.startsWith('e-')).join(', ')}). The quality gate checks citation coverage, contradiction handling, freshness, scope fit, and whether more exploration is worth the remaining ${rhl3.found[0]}.`,
    invariant: 'Parallelism increases coverage only if the reducer preserves evidence.',
  };

  const rMatRows = [
    { id: 'task', label: 'task DAG' },
    { id: 'mailbox', label: 'mailbox' },
    { id: 'ledger', label: 'ledger' },
    { id: 'board', label: 'board' },
    { id: 'budget', label: 'budget' },
    { id: 'trace', label: 'trace' },
  ];
  const rMatCols = [
    { id: 'contains', label: 'contains' },
    { id: 'why', label: 'why it exists' },
  ];
  const rhl4 = { active: ['task:contains', 'ledger:contains', 'board:contains', 'budget:why'], found: ['trace:why'] };
  yield {
    state: labelMatrix(
      'Research-system records',
      rMatRows,
      rMatCols,
      [
        ['subquestions + deps', 'avoid duplicate search'],
        ['agent messages', 'coordinate async work'],
        ['sources + claims', 'audit citations'],
        ['hypotheses', 'merge partial facts'],
        ['tokens + calls', 'stop expensive loops'],
        ['events + decisions', 'debug failures'],
      ],
    ),
    highlight: rhl4,
    explanation: `A useful multi-agent system is a set of ${rMatRows.length} record types across ${rMatCols.length} columns (${rMatCols.map(c => c.label).join(', ')}). ${rhl4.active.length} cells are active and ${rhl4.found.length} cell (${rhl4.found[0]}) marks the audit trail. The LLMs choose actions, but the system reliability comes from ${rMatRows.map(r => r.label).join(', ')}.`,
  };

  const rhl5 = { active: ['lead', 'budget', 'synth', 'gate', 'e-lead-budget', 'e-synth-budget', 'e-synth-gate'], compare: ['subA', 'subB', 'subC'] };
  yield {
    state: researchGraph('Cost is a first-class coordination signal'),
    highlight: rhl5,
    explanation: `Multi-agent systems can spend far more tokens than a single chat, with ${rhl5.compare.length} workers (${rhl5.compare.join(', ')}) each consuming their own context. The orchestration layer activates ${rhl5.active.filter(a => !a.startsWith('e-')).length} coordination nodes (${rhl5.active.filter(a => !a.startsWith('e-')).join(', ')}) and must decide when another subagent is likely to change the answer.`,
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
        'Read each node as a worker, reducer, ledger, or gate. Active marks the part of the topology currently doing work, compare marks alternatives, and found marks a merged result or accepted route.',
        'The safe inference rule is reducibility. A worker output is usable only if the reducer can merge it without guessing the task, source, uncertainty, and budget behind it.',
        {type: 'image', src: './assets/gifs/multi-agent-orchestration-topologies.gif', alt: 'Animated walkthrough of the multi agent orchestration topologies visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/IntelligentAgent-Learning.svg/250px-IntelligentAgent-Learning.svg.png', alt: 'Learning agent diagram with performance element, critic, and problem generator', caption: 'Learning-agent diagrams show why coordination needs explicit feedback, state, and quality checks instead of loose message passing. Source: Wikimedia Commons, Raul654, public domain.'},
        'A single agent loop can plan, call tools, observe results, and revise. It is the right baseline when the task is sequential and fits in one working context.',
        'Multi-agent orchestration exists when the task has independent branches, role-specific tools, or evidence that must be checked from separate contexts. The topology defines where state lives and how partial work becomes one answer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one strong agent with a long context window. It has one plan, one trace, and one place where user intent is preserved.',
        'That simplicity is valuable. There is no reducer, no cross-agent state drift, and no need to reconcile worker outputs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when work is wide rather than long. A compliance review may require security docs, pricing pages, incident history, and integration details, each found through different tools or sources.',
        'A single agent must serialize those searches and keep all evidence in one context. Latency becomes the sum of branches, and early evidence can become hard to inspect when synthesis begins.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A topology is a contract for partitioning and reducing work. Supervisor fan-out uses independent workers and a reducer; handoff uses a state envelope between specialists; blackboard uses shared claims with provenance.',
        'More agents are not automatically better. A topology earns its cost only when separation improves coverage, latency, permission boundaries, or independent critique.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Most useful topologies reduce to directed task graphs with explicit worker outputs and reducer edges. Source: Wikimedia Commons, David W., public domain.'},
        'A supervisor turns one goal into work packets with narrow scopes and schemas. Workers return records, not polished prose, so the reducer can join claims by requirement, source, entity, and confidence.',
        'A handoff topology passes a state envelope: user intent, completed steps, constraints, open questions, permissions, and tool outputs. A blackboard topology lets workers write claims into a shared table where provenance and conflicts remain visible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a record invariant. Every worker result must say what subproblem it handled, what it found, what evidence supports it, what remains uncertain, and what budget it spent.',
        'If that invariant holds, the reducer can audit and merge outputs without inventing missing context. If it fails, the system may still produce fluent text, but the answer is not reliably traceable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with worker count, worker context size, reducer context, and orchestration code. Five workers using 4,000 tokens each plus an 8,000-token reducer cost about 28,000 tokens before follow-up.',
        'Latency behaves differently. If five independent searches each take 20 seconds, a single agent may spend about 100 seconds before synthesis, while fan-out can finish search in about 20 seconds plus reduce time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits breadth-first research, incident response, document extraction, codebase audits, and candidate generation with independent judging. In each case, branches can run separately and return structured evidence.',
        'It also fits permission isolation. One worker can read external sources, another can inspect internal logs, and a deployment worker can hold write permissions without exposing those permissions to every branch.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the task is sequential, when workers all need the same context, or when the reducer cannot inspect evidence. In those cases, the topology adds cost and hides causal detail.',
        'Common failures are state drift, duplicate weak sources mistaken for independent support, and prose merging instead of record merging. A system that cannot trace claims back to worker evidence should not use multiple agents for high-stakes answers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A vendor review has 8 requirements and each source search takes about 30 seconds. A single agent doing them serially spends about 240 seconds before synthesis and carries all evidence in one context.',
        'A supervisor launches 8 workers, each with one requirement and a required schema. If the slowest worker takes 45 seconds and reduction takes 60 seconds, wall time is about 105 seconds. The token cost may be higher, but latency falls and evidence is separated by requirement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the contract net protocol, blackboard systems, map-reduce, workflow DAGs, and current agent-engineering guidance from primary framework docs. The stable idea is that coordination needs explicit records, not just messages.',
        'Next study Agentic AI Patterns, Blackboard Architecture, Contract Net Task Allocation, Claim Graph and Source Ledger, Message Queue, and Distributed Tracing.',
      ],
    },
  ],
};