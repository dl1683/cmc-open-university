// Deep research question decomposition DAG: turn a vague research request into
// subquestions, dependencies, frontier work, evidence artifacts, and gap loops.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'deep-research-question-decomposition-dag-case-study',
  title: 'Deep Research Question Decomposition DAG',
  category: 'AI & ML',
  summary: 'Model deep research planning as a DAG of subquestions, dependencies, evidence artifacts, frontier priorities, and gap-driven replanning.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['decomposition DAG', 'frontier queue'], defaultValue: 'decomposition DAG' },
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

function planGraph(title) {
  return graphState({
    nodes: [
      { id: 'ask', label: 'ask', x: 0.7, y: 3.8, note: 'brief' },
      { id: 'scope', label: 'scope', x: 2.0, y: 3.8, note: 'bounds' },
      { id: 'q1', label: 'q1', x: 3.8, y: 1.5, note: 'defs' },
      { id: 'q2', label: 'q2', x: 3.8, y: 3.2, note: 'claims' },
      { id: 'q3', label: 'q3', x: 3.8, y: 4.9, note: 'numbers' },
      { id: 'q4', label: 'q4', x: 3.8, y: 6.4, note: 'risks' },
      { id: 'frontier', label: 'front', x: 5.6, y: 3.8, note: 'ready' },
      { id: 'search', label: 'search', x: 7.1, y: 1.8, note: 'web' },
      { id: 'files', label: 'files', x: 7.1, y: 3.8, note: 'local' },
      { id: 'calc', label: 'calc', x: 7.1, y: 5.8, note: 'code' },
      { id: 'ledger', label: 'ledger', x: 8.7, y: 3.8, note: 'claims' },
      { id: 'gap', label: 'gap', x: 9.9, y: 2.4, note: 'replan' },
      { id: 'report', label: 'report', x: 9.9, y: 5.2, note: 'outline' },
    ],
    edges: [
      { id: 'e-ask-scope', from: 'ask', to: 'scope' },
      { id: 'e-scope-q1', from: 'scope', to: 'q1' },
      { id: 'e-scope-q2', from: 'scope', to: 'q2' },
      { id: 'e-scope-q3', from: 'scope', to: 'q3' },
      { id: 'e-scope-q4', from: 'scope', to: 'q4' },
      { id: 'e-q1-frontier', from: 'q1', to: 'frontier' },
      { id: 'e-q2-frontier', from: 'q2', to: 'frontier' },
      { id: 'e-q3-frontier', from: 'q3', to: 'frontier' },
      { id: 'e-q4-frontier', from: 'q4', to: 'frontier' },
      { id: 'e-frontier-search', from: 'frontier', to: 'search' },
      { id: 'e-frontier-files', from: 'frontier', to: 'files' },
      { id: 'e-frontier-calc', from: 'frontier', to: 'calc' },
      { id: 'e-search-ledger', from: 'search', to: 'ledger' },
      { id: 'e-files-ledger', from: 'files', to: 'ledger' },
      { id: 'e-calc-ledger', from: 'calc', to: 'ledger' },
      { id: 'e-ledger-gap', from: 'ledger', to: 'gap' },
      { id: 'e-gap-scope', from: 'gap', to: 'scope', weight: 'loop' },
      { id: 'e-ledger-report', from: 'ledger', to: 'report' },
    ],
  }, { title });
}

function* decompositionDag() {
  yield {
    state: planGraph('A deep research request becomes a dependency DAG'),
    highlight: { active: ['ask', 'scope', 'q1', 'q2', 'q3', 'q4', 'e-ask-scope', 'e-scope-q1', 'e-scope-q2', 'e-scope-q3', 'e-scope-q4'], compare: ['report'] },
    explanation: 'The naive baseline is to browse immediately and hope coverage emerges. The DAG forces the agent to name subquestions, dependencies, expected artifacts, and stop conditions before it starts writing.',
  };

  yield {
    state: labelMatrix(
      'Subquestion record',
      [
        { id: 'q1', label: 'q1' },
        { id: 'q2', label: 'q2' },
        { id: 'q3', label: 'q3' },
        { id: 'q4', label: 'q4' },
        { id: 'q5', label: 'q5' },
      ],
      [
        { id: 'dep', label: 'dep' },
        { id: 'want', label: 'want' },
        { id: 'tool', label: 'tool' },
        { id: 'done', label: 'done' },
      ],
      [
        ['none', 'defs', 'web', 'no'],
        ['q1', 'claims', 'web', 'no'],
        ['q2', 'nums', 'calc', 'no'],
        ['q2', 'risk', 'docs', 'no'],
        ['q3', 'cost', 'calc', 'no'],
      ],
    ),
    highlight: { active: ['q1:dep', 'q2:dep', 'q3:tool', 'q4:want'], found: ['q5:done'] },
    explanation: 'Each subquestion is a small work item: what it depends on, what artifact it wants, which tool should answer it, and what completion means. That is the planning data structure hidden inside good deep research.',
    invariant: 'The DAG should make missing evidence visible before synthesis.',
  };

  yield {
    state: planGraph('Ready nodes feed the research frontier'),
    highlight: { active: ['q1', 'q2', 'frontier', 'e-q1-frontier', 'e-q2-frontier'], compare: ['q3', 'q4'], found: ['search', 'files'] },
    explanation: 'Only dependency-ready questions enter the frontier. A cost or benchmark node should wait until definitions, source scope, and units are known; otherwise the agent computes the wrong thing quickly and confidently.',
  };

  yield {
    state: planGraph('Ledger gaps reopen the plan instead of being buried'),
    highlight: { active: ['ledger', 'gap', 'scope', 'e-ledger-gap', 'e-gap-scope'], removed: ['report'], compare: ['search', 'files', 'calc'] },
    explanation: 'After evidence lands in the claim ledger, gaps become new nodes. A contradiction, missing primary source, stale number, or unread file page should update the DAG rather than become a quiet caveat in polished prose.',
  };
}

function* frontierQueue() {
  yield {
    state: labelMatrix(
      'Frontier priority queue',
      [
        { id: 'n1', label: 'n1' },
        { id: 'n2', label: 'n2' },
        { id: 'n3', label: 'n3' },
        { id: 'n4', label: 'n4' },
        { id: 'n5', label: 'n5' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'cover', label: 'cover' },
        { id: 'cost', label: 'cost' },
        { id: 'next', label: 'next' },
      ],
      [
        ['hi', 'low', 'med', 'read'],
        ['hi', 'med', 'low', 'web'],
        ['med', 'low', 'low', 'ask'],
        ['low', 'hi', 'hi', 'park'],
        ['med', 'med', 'med', 'calc'],
      ],
    ),
    highlight: { active: ['n1:risk', 'n2:cost', 'n3:next'], compare: ['n4:next'], found: ['n5:next'] },
    explanation: 'The frontier is not FIFO. It should prefer high-risk unknowns, low-coverage report sections, cheap decisive searches, and blockers that unlock many descendants.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'work items opened', min: 0, max: 20 }, y: { label: 'coverage', min: 0, max: 1 } },
      series: [
        { id: 'direct', label: 'direct search', points: [{ x: 2, y: 0.22 }, { x: 6, y: 0.42 }, { x: 10, y: 0.54 }, { x: 16, y: 0.6 }, { x: 20, y: 0.63 }] },
        { id: 'dag', label: 'DAG frontier', points: [{ x: 2, y: 0.2 }, { x: 6, y: 0.52 }, { x: 10, y: 0.73 }, { x: 16, y: 0.86 }, { x: 20, y: 0.89 }] },
      ],
      markers: [
        { id: 'audit', x: 10, y: 0.73, label: 'gap audit' },
      ],
    }),
    highlight: { active: ['dag', 'audit'], compare: ['direct'] },
    explanation: 'Question decomposition improves coverage because search is targeted. The agent spends less time collecting duplicate sources and more time attacking the uncovered branches of the argument.',
  };

  yield {
    state: planGraph('Tool choice follows the subquestion artifact'),
    highlight: { active: ['frontier', 'search', 'files', 'calc', 'e-frontier-search', 'e-frontier-files', 'e-frontier-calc'], found: ['ledger'] },
    explanation: 'The expected artifact chooses the tool: a current fact needs web search, a local specification needs file reading, a cost claim may need code or a spreadsheet calculation. Tool choice belongs in the work item, not in ad hoc prompting.',
  };

  yield {
    state: labelMatrix(
      'Done',
      [
        { id: 'defs', label: 'defs' },
        { id: 'claims', label: 'claims' },
        { id: 'nums', label: 'nums' },
        { id: 'risks', label: 'risks' },
        { id: 'gaps', label: 'gaps' },
      ],
      [
        { id: 'min', label: 'min' },
        { id: 'have', label: 'have' },
        { id: 'status', label: 'state' },
      ],
      [
        ['2 src', '3 src', 'done'],
        ['5 ids', '4 ids', 'more'],
        ['calc', 'calc', 'done'],
        ['2 ctr', '3 ctr', 'done'],
        ['none', '2', 'loop'],
      ],
    ),
    highlight: { active: ['defs:status', 'nums:status', 'risks:status'], compare: ['claims:status'], removed: ['gaps:status'] },
    explanation: 'Stop rules keep the frontier finite. A node is done when its artifact exists in the ledger, not when the agent feels it searched enough. That distinction keeps planning from becoming decorative.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'decomposition DAG') yield* decompositionDag();
  else if (view === 'frontier queue') yield* frontierQueue();
  else throw new InputError('Pick a question-decomposition view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A deep research question decomposition DAG is the planning layer between a user request and the evidence workflow. Nodes are subquestions. Edges are dependencies. Each node stores scope, expected artifact, candidate tool, risk, cost, and stop rule. The frontier is the set of dependency-ready nodes the agent should work on next.',
        'This sits between Deep Research Agent Architecture and Claim Graph & Source Ledger. The architecture module explains the full research loop. The claim ledger stores evidence after discovery. The decomposition DAG decides what evidence should be sought in the first place.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the DAG as a research control plane. The root is the user decision or artifact. Children are definitions, claims, numbers, source families, contradictions, calculations, and risks. Edges say which questions must be answered before another question can be trusted. The frontier is the active work queue.',
        'This is not breadth-first web search. A high-risk contradiction can outrank three easy background nodes. A cheap calculation can outrank another source if it decides whether a claim is material. A node that unlocks several downstream questions should move earlier than a node that only makes the report feel fuller.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The planner starts with scope: what decision is the user trying to make, which terms need definitions, which facts are current, which claims require primary sources, and which calculations would change the answer. It then creates subquestions with dependencies. A cost calculation should depend on source discovery. A contradiction audit should depend on at least two source families. A final synthesis should depend on enough supported claims in the ledger. The DAG exists to keep the agent from substituting activity for coverage.',
        'STORM is the main research pattern behind this shape. The Stanford project describes Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking, with a pre-writing phase that discovers perspectives and asks grounded follow-up questions: https://storm-project.stanford.edu/research/storm/. Its arXiv paper is at https://arxiv.org/abs/2402.14207, and the implementation notes are at https://github.com/stanford-oval/storm.',
      ],
    },
    {
      heading: 'The data structure',
      paragraphs: [
        'The DAG record is small but powerful: node id, parent ids, prompt fragment, artifact type, tool class, priority score, evidence target, owner agent, status, and stop rule. The priority score can include risk, section coverage, expected information gain, cost, and how many downstream questions become unblocked if this node is answered.',
        'A priority queue sits on top of the DAG frontier. It prevents the agent from doing breadth-first wandering across the web. It can read a primary source before a blog, run a cheap calculation before another search, or reopen a high-risk contradiction before polishing the report. That links directly to Source Authority Triage Priority Queue and Evidence Freshness Refresh Scheduler.',
      ],
    },
    {
      heading: 'Complete case study: AI infrastructure report',
      paragraphs: [
        'Suppose the user asks whether a GPU memory fabric vendor has a durable advantage. The DAG splits the request into terms, product facts, architecture claims, benchmark evidence, customer adoption, cost model, risks, and counterarguments. Product facts depend on official docs and filings. Benchmark claims depend on source triage and possibly calculations. Risk claims depend on contradictions between vendor claims, customer reports, and competing architectures.',
        'The first frontier contains definitions and primary-source discovery. Once those complete, benchmark and cost nodes unlock. If the ledger finds a contradiction between a vendor latency claim and an independent benchmark, a new contradiction-resolution node is added. The final report is no longer a direct response to the first prompt; it is the downstream artifact of the DAG.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'The local deep-research corpus emphasizes that the value of these tools is not source count. It is synthesis depth, critical reasoning, endurance, file handling, and workflow reliability. A decomposition DAG turns those product criteria into runtime behavior: preserve context, challenge assumptions, target gaps, and reopen weak branches instead of completing a generic report.',
        'OpenAI describes deep research as learning to plan and execute multi-step trajectories, backtrack, and react to real-time information: https://openai.com/index/introducing-deep-research/. The Deep Research system card describes browsing, file interpretation, and Python analysis as part of the capability: https://openai.com/index/deep-research-system-card/. Those abilities need a work-queue structure if the result should be repeatable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The DAG works because it separates question management from answer writing. A model can write a fluent report before it has earned the report. The DAG makes missing prerequisites visible: definitions not pinned down, numbers without sources, claims without primary evidence, contradictions not resolved, and calculations not checked.',
        'It also gives subagents and tools a clean contract. One node may need web search. Another needs a PDF table extraction. Another needs a calculation. Another needs a contradiction audit. The planner can assign work without losing why the work exists.',
        'The important algorithmic move is dependency control. A good planner does not merely list subquestions; it prevents downstream prose from starting before upstream evidence exists. That is what makes the structure useful for teaching. Students can see that research quality comes from ordering, evidence state, and explicit uncertainty, not from writing more confident paragraphs.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track open high-risk nodes, stale nodes, unsupported claims, source-family coverage, contradiction count, calculation count, reopened nodes, and final claims without ledger support. These are research-quality metrics. They tell you whether the agent is converging on evidence or merely accumulating text.',
        'A useful report handoff should include the DAG state, not only the prose. Future reviewers should be able to see which branches were answered, which were deferred, and which claim in the final article depends on which evidence node.',
      ],
    },
    {
      heading: 'A worked decomposition',
      paragraphs: [
        'Suppose the user asks whether a new inference framework will reduce serving cost. A weak agent searches the framework name and summarizes the first few sources. A DAG planner splits the question into workloads, cost phases, compatibility, deployment constraints, benchmark evidence, migration cost, and failure modes. The cost node depends on phase-level inference facts. The compatibility node depends on supported models, hardware, and runtime APIs. The benchmark node depends on source authority and workload match.',
        'As evidence arrives, the DAG changes. If official docs show strong KV-cache routing but benchmarks omit long prompts, a new evaluation-gap node appears. If user workloads are mostly short chat, the cost model changes. If migration requires new Kubernetes operators, an operational-risk node unlocks. The answer becomes a synthesis of answered branches, not a loose pile of citations.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The DAG can become bureaucracy if every tiny fact becomes a node. The right level is a question whose answer can change the final artifact. It can also become theater if priorities are invented after the fact or if unsupported nodes are marked done because a source was found.',
        'The planner must preserve user intent. A beautiful internal DAG is useless if it optimizes for what is easy to research rather than what the user needs to decide. The final report should show the strongest supported answer, the material uncertainties, and the evidence gaps that still matter.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A research decomposition DAG is the difference between a search transcript and a research plan. It organizes uncertainty before writing, chooses the next best evidence action, and keeps the final synthesis tied to supported claims.',
        'The deep lesson is that good research agents need project-management data structures. Questions, dependencies, evidence, risk, and stop rules deserve first-class state.',
        'In a curriculum, this belongs after graph traversal and priority queues. The student should already understand dependencies and frontier selection. This topic then shows why those old structures matter inside modern research agents: they turn "go find information" into a controlled investigation with checkable intermediate artifacts.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not make the DAG so large that planning replaces research. Do not let the model invent dependencies that only make the work look rigorous. Do not route every node to web search. Do not mark a node done because a source was found; mark it done only when the expected artifact exists in the ledger. Do not let the DAG hide user intent behind internal task names.',
        'Study Deep Research Agent Architecture, Deep Research Evaluation System, Claim Graph & Source Ledger, Source Authority Triage Priority Queue, Research Contradiction Resolution Graph, Evidence Freshness Refresh Scheduler, RAG Context Packing, RAG Claim Verification Support Ledger, STORM, WebGPT at https://arxiv.org/abs/2112.09332, ReAct at https://arxiv.org/abs/2210.03629, Anthropic Building Effective Agents at https://www.anthropic.com/research/building-effective-agents, and Anthropic multi-agent research system at https://www.anthropic.com/engineering/multi-agent-research-system.',
      ],
    },
  ],
};
