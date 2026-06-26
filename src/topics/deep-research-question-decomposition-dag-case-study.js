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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a research plan. A node is a subquestion, an edge means one question depends on another, and the frontier is the set of questions ready to work on now. If q3 depends on q2, the safe inference is simple: q3 must not feed the final report until q2 has produced evidence.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Deep research is hard because the prompt is usually not the real work plan. A request such as compare two inference systems hides definitions, benchmarks, cost units, source quality, contradictions, and missing files. A decomposition DAG, or directed acyclic graph, makes that hidden work explicit before synthesis begins.',
        {type:'callout', text:'A decomposition DAG turns an open research request into dependency-ordered evidence work, so synthesis waits for supported branches instead of racing to prose.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg', alt:'Directed acyclic graph with arrows flowing from earlier nodes to later dependent nodes.', caption:'Directed acyclic graph. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to search first and organize later. That is reasonable for a small question because a few sources may answer it directly. It fails on research tasks where the hard part is deciding what would count as a complete answer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coverage drift. The agent collects sources for the branches it happened to see first, while unasked subquestions remain invisible. A fluent final report can then hide a missing benchmark, a stale number, or a contradiction that would have changed the answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the investigation as a dependency graph, not as a document outline. Definitions, claims, numbers, risks, and calculations are work items with prerequisites and stop rules. The graph is acyclic because a node should only depend on earlier evidence, while gap discovery creates a new node rather than rewriting history in place.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start by naming the decision the user needs to make, then split it into subquestions. Each node stores its expected artifact: a definition, a cited claim, a table, a calculation, a contradiction note, or a risk judgment. A priority queue chooses frontier nodes by risk, cheapness, section coverage, and how many downstream nodes they unlock.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a dependency invariant. A downstream claim can enter the synthesis only after every prerequisite node has either produced its artifact or been marked as an explicit gap. Because edges encode those prerequisites, the final report can be audited from each claim back to the evidence that made it legal to write.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The planning cost is O(V + E) to scan V question nodes and E dependency edges, plus priority-queue work when choosing the next node. If 40 nodes and 55 edges define a report, a full readiness pass is 95 simple checks, while each frontier pop costs about log2(40), or 6 comparisons. The memory cost is the graph, node artifacts, and evidence ledger; it buys fewer duplicate searches and fewer unsupported conclusions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This structure fits agentic research, technical due diligence, incident reviews, and benchmark audits. It is useful when the answer depends on multiple source families and when missing evidence should change the shape of the work. It also gives subagents a clean contract because each worker receives one node, one artifact target, and one completion rule.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph fails when it becomes ceremony. If every sentence becomes a node, planning replaces research and the frontier never clears. It also fails when priorities are fake, when a source is treated as an artifact by itself, or when the graph optimizes for easy branches instead of the user decision.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a user asks whether a serving framework cuts GPU cost by 30 percent. The DAG creates 12 nodes: 2 definition nodes, 3 source nodes, 2 benchmark nodes, 2 cost-model nodes, 2 risk nodes, and 1 synthesis node. If the benchmark node depends on 3 source nodes and 1 workload-definition node, it cannot close until all 4 are present.',
        'Use concrete numbers. If the old system costs 8 GPUs at 70 percent utilization and the new system claims 6 GPUs at 75 percent utilization, the cost node computes served-work capacity before accepting the 25 percent GPU-count reduction. If a source later shows the benchmark used 1,024-token prompts while the user serves 16,000-token prompts, the graph opens a gap node instead of letting the report reuse the claim.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study directed acyclic graphs, topological ordering, priority queues, and claim ledgers next. For research-agent context, read STORM at https://arxiv.org/abs/2402.14207, WebGPT at https://arxiv.org/abs/2112.09332, ReAct at https://arxiv.org/abs/2210.03629, and Anthropic Building Effective Agents at https://www.anthropic.com/research/building-effective-agents. Then compare this topic with Source Authority Triage Priority Queue and Research Contradiction Resolution Graph.',
      ],
    },
  ],
};
