// Deep research agents: plan, search, read, verify, synthesize, and cite
// across many sources without losing provenance or workflow state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'deep-research-agent-architecture-case-study',
  title: 'Deep Research Agent Architecture Case Study',
  category: 'AI & ML',
  summary: 'How serious research agents combine scoping, planning, web/file retrieval, source ledgers, contradiction handling, synthesis, citations, and evaluation gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['research loop', 'quality gates'], defaultValue: 'research loop' },
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

function researchGraph(title) {
  return graphState({
    nodes: [
      { id: 'ask', label: 'ask', x: 0.7, y: 3.5, note: 'goal' },
      { id: 'scope', label: 'scope', x: 2.1, y: 2.1, note: 'constraints' },
      { id: 'plan', label: 'plan', x: 3.6, y: 3.5, note: 'questions' },
      { id: 'search', label: 'search', x: 5.1, y: 1.6, note: 'web' },
      { id: 'files', label: 'files', x: 5.1, y: 3.5, note: 'PDFs' },
      { id: 'code', label: 'code', x: 5.1, y: 5.4, note: 'analysis' },
      { id: 'ledger', label: 'ledger', x: 6.9, y: 3.5, note: 'claims' },
      { id: 'synth', label: 'synth', x: 8.2, y: 2.2, note: 'argument' },
      { id: 'audit', label: 'audit', x: 8.2, y: 4.8, note: 'checks' },
      { id: 'report', label: 'report', x: 9.4, y: 3.5, note: 'cited' },
    ],
    edges: [
      { id: 'e-ask-scope', from: 'ask', to: 'scope' },
      { id: 'e-scope-plan', from: 'scope', to: 'plan' },
      { id: 'e-plan-search', from: 'plan', to: 'search' },
      { id: 'e-plan-files', from: 'plan', to: 'files' },
      { id: 'e-plan-code', from: 'plan', to: 'code' },
      { id: 'e-search-ledger', from: 'search', to: 'ledger' },
      { id: 'e-files-ledger', from: 'files', to: 'ledger' },
      { id: 'e-code-ledger', from: 'code', to: 'ledger' },
      { id: 'e-ledger-synth', from: 'ledger', to: 'synth' },
      { id: 'e-ledger-audit', from: 'ledger', to: 'audit' },
      { id: 'e-synth-report', from: 'synth', to: 'report' },
      { id: 'e-audit-report', from: 'audit', to: 'report' },
      { id: 'e-audit-plan', from: 'audit', to: 'plan', weight: 'gap' },
    ],
  }, { title });
}

function* researchLoop() {
  yield {
    state: researchGraph('Deep research is an agentic evidence loop'),
    highlight: { active: ['ask', 'scope', 'plan', 'e-ask-scope', 'e-scope-plan'], compare: ['report'] },
    explanation: 'The naive baseline is search first, summarize later. A usable research agent scopes before it browses: what decision is being made, what is time-sensitive, what files matter, and which evidence channels are needed.',
  };

  yield {
    state: researchGraph('The plan fans out across web, files, and computation'),
    highlight: { active: ['plan', 'search', 'files', 'code', 'e-plan-search', 'e-plan-files', 'e-plan-code'], found: ['ledger'] },
    explanation: 'The fanout is deliberate. Web search, file reading, and code are separate evidence channels, but their outputs must converge into one claim ledger or the final report becomes impossible to audit.',
    invariant: 'Every important claim needs provenance before it enters the final report.',
  };

  yield {
    state: labelMatrix(
      'Claim ledger schema',
      [
        { id: 'source', label: 'source' },
        { id: 'claim', label: 'claim' },
        { id: 'support', label: 'support' },
        { id: 'conflict', label: 'conflict' },
        { id: 'use', label: 'use' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['URL/file/page', 'citation target'],
        ['atomic assertion', 'avoid vague notes'],
        ['quote or data pointer', 'auditability'],
        ['contradicting source', 'critical reasoning'],
        ['section mapping', 'trace to report'],
      ],
    ),
    highlight: { active: ['source:stores', 'claim:stores', 'support:stores', 'conflict:stores'], found: ['use:why'] },
    explanation: 'The source ledger is the core data structure. It turns "I read this" into checkable rows: claim, source, support span, conflict, and intended use. That separation lets synthesis be repaired without redoing all discovery.',
  };

  yield {
    state: researchGraph('Audit can send the agent back to planning'),
    highlight: { active: ['ledger', 'audit', 'plan', 'e-ledger-audit', 'e-audit-plan'], compare: ['synth'], found: ['report'] },
    explanation: 'Good deep research loops do not only summarize what they found. They turn weak sources, stale facts, unsupported claims, contradictions, and unfinished sections into new work instead of burying them in confident prose.',
  };
}

function* qualityGates() {
  yield {
    state: labelMatrix(
      'Research quality rubric',
      [
        { id: 'depth', label: 'depth' },
        { id: 'critique', label: 'critique' },
        { id: 'endurance', label: 'endurance' },
        { id: 'files', label: 'file handling' },
        { id: 'workflow', label: 'workflow' },
      ],
      [
        { id: 'good signal', label: 'good signal' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['synthesis across sources', 'source collage'],
        ['challenges premise', 'confirms bias'],
        ['keeps context', 'drifts late'],
        ['page-level accuracy', 'skims then invents'],
        ['iterative handoff', 'one-shot report trap'],
      ],
    ),
    highlight: { active: ['depth:good signal', 'critique:good signal', 'files:good signal'], removed: ['critique:failure', 'files:failure'] },
    explanation: 'The local deep-research notes in the PDF corpus define a useful product rubric: synthesis depth, critical reasoning, endurance, file handling, and workflow reliability. These become architecture requirements, not just UX opinions.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sources reviewed', min: 0, max: 100 }, y: { label: 'marginal value', min: 0, max: 1 } },
      series: [
        { id: 'coverage', label: 'coverage', points: [{ x: 5, y: 0.25 }, { x: 15, y: 0.55 }, { x: 30, y: 0.76 }, { x: 60, y: 0.87 }, { x: 100, y: 0.91 }] },
        { id: 'noise', label: 'noise', points: [{ x: 5, y: 0.08 }, { x: 15, y: 0.16 }, { x: 30, y: 0.28 }, { x: 60, y: 0.55 }, { x: 100, y: 0.86 }] },
      ],
    }),
    highlight: { active: ['coverage'], compare: ['noise'] },
    explanation: 'More sources help until they become redundant or low quality. Deep research needs source selection, dedupe, authority ranking, and stop rules, not just a bigger crawl.',
  };

  yield {
    state: labelMatrix(
      'Failure gates',
      [
        { id: 'authority', label: 'authority' },
        { id: 'freshness', label: 'freshness' },
        { id: 'contradiction', label: 'contradiction' },
        { id: 'citation', label: 'citation' },
        { id: 'action', label: 'action' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'response', label: 'response' },
      ],
      [
        ['primary source?', 'downgrade weak claims'],
        ['date-sensitive?', 'refresh search'],
        ['sources disagree?', 'explain why'],
        ['supports sentence?', 'remove or cite'],
        ['tool side effect?', 'human approval'],
      ],
    ),
    highlight: { active: ['authority:check', 'freshness:check', 'contradiction:check', 'citation:check'], removed: ['action:response'] },
    explanation: 'A research agent is dangerous when it turns weak evidence into polished confidence. Quality gates should fire before report generation, not after the user catches an error.',
  };

  yield {
    state: researchGraph('Production systems need traces, budgets, and permissions'),
    highlight: { active: ['search', 'files', 'code', 'ledger', 'audit', 'e-search-ledger', 'e-files-ledger', 'e-code-ledger'], compare: ['report'] },
    explanation: 'In production, the research loop is also an operations problem: trace every tool call, bound cost, isolate untrusted content, enforce permissions, and preserve the evidence path that produced the final answer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'research loop') yield* researchLoop();
  else if (view === 'quality gates') yield* qualityGates();
  else throw new InputError('Pick a deep-research-agent view.');
}

const legacyArticle = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A deep research agent is an agentic system for complex information work: it scopes a question, plans subquestions, searches the web, reads files, runs analysis when needed, builds a claim ledger, resolves contradictions, and writes a cited synthesis. It is not just RAG Pipeline with more documents. RAG retrieves context for one answer; deep research manages a multi-step evidence workflow.',
        'OpenAI describes deep research as an agentic capability for multi-step internet research that can search, interpret, and synthesize large amounts of text, images, and PDFs while pivoting as it encounters new information: https://openai.com/index/introducing-deep-research/. The Deep Research system card describes the model as optimized for web browsing and able to read user files and analyze data with Python: https://openai.com/index/deep-research-system-card/.',
      ],
    },
    {
      heading: 'Legacy visual note',
      paragraphs: [
        'In research loop view, follow the graph left to right: ask, scope, plan, gather evidence, write claims into the ledger, synthesize, audit, and only then produce the report. The back edge from audit to plan is the point of the architecture. A contradiction or missing source is not a footnote; it reopens work.',
        'In quality gates view, read the matrices as release checks. The animation is not saying every research job needs maximum process. It is showing which artifacts make a report trustworthy: source support, freshness, contradiction handling, file spans, trace logs, and permissions around private or unsafe inputs.',
      ],
    },
    {
      heading: 'Architecture',
      paragraphs: [
        'The minimum architecture has a planner, search tools, document readers, optional code execution, a source ledger, a synthesis step, and evaluation gates. The source ledger is the important data structure: every atomic claim should carry source URL or file/page location, support snippet or data pointer, source date, authority level, contradiction notes, and the section where the claim will be used. Agent Memory & Context Engineering Case Study explains the adjacent runtime problem: preserving that evidence across long work without stuffing every old turn into the current prompt. Without the ledger, the system has no clean way to distinguish supported findings from fluent recollection.',
        'WebGPT is an early foundation for this shape. It used a text-based browser, collected references while browsing, and trained long-form answers with human feedback: https://arxiv.org/abs/2112.09332. ReAct supplies the control-loop pattern: interleave reasoning with actions so the model can update plans after observations: https://arxiv.org/abs/2210.03629. Anthropic frames production systems as augmented LLMs, workflows, and agents, and warns that agent complexity should be earned by the task: https://www.anthropic.com/research/building-effective-agents. Agent Model Router & Context Handoff Ledger covers the missing runtime decision: when research should move from search, to file reading, to code execution, to synthesis, to judging without losing the source ledger.',
      ],
    },
    {
      heading: 'Research-specific patterns',
      paragraphs: [
        'STORM is the cleanest academic pattern for long-form research and writing. It discovers multiple perspectives, asks perspective-guided questions, grounds answers in trusted internet sources, and builds an outline before writing: https://arxiv.org/abs/2402.14207. The Stanford project page is at https://storm-project.stanford.edu/research/storm/, and the implementation is at https://github.com/stanford-oval/storm.',
        'A production deep research agent should combine that pre-writing discipline with LLM Evaluation Harnesses and the Deep Research Evaluation Harness Case Study. It should test coverage, citation support, source authority, temporal freshness, contradiction handling, endurance, file reading, and whether conclusions follow from evidence. The local deep-research notes in the provided PDF corpus use the same practical rubric: depth of synthesis, critical reasoning, speed and endurance, file handling, and workflow reliability.',
      ],
    },
    {
      heading: 'Complete case study: technical market report',
      paragraphs: [
        'A user asks for a technical market report on GPU-adjacent storage for AI inference. A shallow tool searches five vendor pages and writes a generic comparison. A deep research agent first scopes the question: workloads, latency budget, HBM pressure, storage tier, vendor claims, benchmarks, and buyer risks. It searches official docs, architecture PDFs, benchmark reports, engineering blogs, filings, and user complaints. It reads uploaded internal notes, runs small calculations for cost and throughput, and stores every claim in the ledger.',
        'The synthesis step then separates facts from interpretation: which systems use GPUDirect Storage, which claims are vendor marketing, which bottlenecks are workload-dependent, which numbers are stale, and which conclusions are unsupported. Distributed Tracing is the runtime analogy: every final paragraph should have a trace back to evidence. Zanzibar Authorization Case Study matters when sources are private. Prompt Injection Threat Model matters because web pages and PDFs can contain hostile instructions. Temporal Workflow Case Study matters because long research jobs need durable progress and resumable state.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not evaluate deep research by source count alone. Hundred-source reports can be worse than ten-source reports if they repeat low-quality material, miss primary sources, or bury contradictions. Do not treat citations as proof unless the cited source supports the exact sentence. Do not let the agent browse untrusted pages and then follow instructions from those pages. Do not let code execution mutate external systems. Do not accept a polished report if the claim ledger is weak.',
        'The deepest failure is confirmation bias at scale. If the user asks a leading question, the agent can gather evidence that flatters the premise. A good system should ask clarifying questions, surface counterevidence, name assumptions, and reopen search when an apparent conclusion rests on weak or stale sources. This is where agentic systems need evaluation beyond answer helpfulness.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenAI introducing deep research at https://openai.com/index/introducing-deep-research/, OpenAI Deep Research system card at https://openai.com/index/deep-research-system-card/, system-card PDF at https://cdn.openai.com/deep-research-system-card.pdf, WebGPT at https://arxiv.org/abs/2112.09332, ReAct at https://arxiv.org/abs/2210.03629, STORM at https://arxiv.org/abs/2402.14207, Stanford STORM page at https://storm-project.stanford.edu/research/storm/, STORM repository at https://github.com/stanford-oval/storm, Anthropic Building Effective Agents at https://www.anthropic.com/research/building-effective-agents, Anthropic multi-agent research system at https://www.anthropic.com/engineering/multi-agent-research-system, and Anthropic context engineering for agents at https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents.',
        'Study Agent Model Router & Context Handoff Ledger, Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Blackboard Architecture Agent Coordination, Claim Graph & Source Ledger, Deep Research Evaluation Harness Case Study, Agentic AI Patterns, Agent Memory & Context Engineering Case Study, RAG Pipeline, Query Expansion, Multi-Index RAG, LightRAG Dual-Level Retrieval, LLM Evaluation Harnesses, RAG Evaluation, Prompt Injection Threat Model, Model Context Protocol Case Study, Distributed Tracing, Zanzibar Authorization Case Study, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Deep research agents exist because serious research tasks are not one prompt and one answer. They involve source discovery, query reformulation, reading, extraction, contradiction tracking, synthesis, citation support, freshness checks, and final writing.',
        'The architecture matters because a fluent answer can be wrong in many ways: weak sources, stale facts, unsupported claims, hidden contradictions, shallow search, or no audit trail. A research agent needs a workflow that makes evidence and uncertainty visible.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a single long prompt: ask the model to search, reason, and write. That can produce a good-looking report, but it collapses planning, retrieval, evidence review, and synthesis into one opaque step.',
        'Another tempting approach is a fixed search checklist. Search five queries, read five pages, write a summary. That is more disciplined, but it still fails when the question changes during reading. Research needs adaptive branching based on what has been found.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A deep research agent should be structured as a state machine over evidence. The unit of progress is not tokens written; it is claims supported, sources evaluated, contradictions resolved, and gaps identified.',
        'The system should separate roles: planner, searcher, reader, extractor, verifier, synthesizer, and editor. These can be separate agents or separate phases, but the artifacts should be distinct so quality can be audited.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The planner turns the user question into subquestions, expected evidence types, freshness requirements, and acceptance criteria. Search workers gather candidate sources. Readers extract claims, numbers, dates, definitions, methods, and caveats into structured notes.',
        'A verifier checks whether important claims have support, whether sources disagree, whether dates are current, and whether the answer overstates evidence. The synthesizer then builds a narrative from supported claims rather than from raw search results.',
        'The final editor removes scaffolding, repetition, and unsupported hedging. The best output reads like a clear article or report, but underneath it there should be a trace from each claim to evidence.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The pipeline view proves that research is not retrieval alone. Search finds candidates. Reading extracts evidence. Verification tests support. Synthesis organizes meaning. Each step has its own failure modes.',
        'The evidence-board view proves why structured notes matter. A raw pile of links is not knowledge. The agent needs claim records, source records, contradiction records, freshness labels, and open questions to avoid losing important context.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The architecture works because it makes intermediate uncertainty explicit. A weak source can be downgraded. A contradiction can be carried forward instead of smoothed over. A missing source can block a claim before it becomes polished prose.',
        'It also works because research is iterative. Early sources reveal new terminology, important actors, better queries, and hidden assumptions. A stateful architecture can revise its plan as the evidence changes.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Deep research is slower and more expensive than direct answering. It spends calls on search, reading, extraction, verification, and revision. That cost is justified only when accuracy, provenance, freshness, or depth matter.',
        'The tradeoff is complexity. More agents can improve coverage but also create coordination overhead, duplicate reading, inconsistent notes, and synthesis drift. The architecture needs schemas and ownership boundaries, not just more parallelism.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins for market reports, technical landscape reviews, policy analysis, literature surveys, due diligence, benchmark audits, legal research support, and any topic where the answer depends on current sources and careful synthesis.',
        'It is also useful inside product teams. A research agent can map competitor features, summarize incident histories, compare architecture options, or build a curriculum if it preserves evidence and turns findings into teachable structure.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is source laundering. The final answer sounds confident, but the underlying sources are weak, circular, promotional, or stale. The fix is source grading and claim-level citation discipline.',
        'The second failure is shallow breadth. An agent can visit many pages while learning little. Reading quality matters more than link count. Extracted notes should capture why a source matters, not only that it was opened.',
        'A third failure is synthesis without contradiction handling. If two good sources disagree, the answer should explain the disagreement or scope the claim. Hiding conflicts makes the report easier to read and less trustworthy.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Store sources, claims, quotes, dates, and confidence separately. Require every important claim to point to source evidence. Track open questions explicitly so the agent can decide whether to search more or state a limitation.',
        'Use freshness rules by domain. A math definition may be stable. A company pricing page, model leaderboard, legal rule, or API version may not be. The research plan should say which facts require current verification.',
        'Evaluate the final output against the user question, source support, missed counterarguments, unnecessary length, and readability. A research agent is not done when it has gathered enough text; it is done when the answer teaches the issue clearly and defensibly.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For a technical market report, the agent might begin with subquestions: market size, buyer pain, technical architecture, incumbent products, adoption barriers, pricing, regulation, and open questions. Each subquestion gets its own source needs and freshness threshold.',
        'Search then produces candidate sources: company docs, standards, benchmark papers, customer case studies, financial filings, and independent analysis. The reader extracts claims into cards: who said it, when, what evidence supports it, and what it implies.',
        'The final article should not simply summarize sources in order. It should teach the market structure: why the problem exists, why now, what changed technically, who benefits, what can fail, and which claims remain uncertain.',
      ],
    },
    {
      heading: 'How to judge quality',
      paragraphs: [
        'A good research agent is measured by supported insight, not by volume. More citations do not help if they all support obvious claims. The agent should find the few sources that change the answer and explain why they matter.',
        'The writing should also compress rather than sprawl. If the evidence is complex, the structure should make it easier for the reader: definitions before disputes, mechanisms before implications, and caveats near the claims they limit.',
        'The strongest agents leave an audit trail that another person can inspect. They do not require blind trust in the final prose. Claims, source quality, and unresolved uncertainty remain visible behind the article.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'The main production risk is silent degradation. A search API changes, a source disappears, a model becomes more verbose, or a scraper starts returning boilerplate. The final report may still look polished while the evidence pipeline has weakened.',
        'Track source diversity, rejected-source reasons, claim coverage, unresolved contradictions, freshness debt, and how often a human reviewer changes the conclusion. These are better health signals than token volume or number of pages visited.',
        'The writing system should be part of the architecture. If the agent collects evidence well but writes in stiff generic summaries, the user still loses. The final article should teach mechanisms, name uncertainty, and remove work for the reader without hiding the trail that produced the claim.',
      ],
    },
    {
      heading: 'Common misconception',
      paragraphs: [
        'The misconception is that deep research means longer answers. Length is only a side effect. The real product is a better map of the question: which terms matter, which mechanisms drive the answer, which sources are reliable, which claims are weak, and what a reader should do with the information.',
        'This is why the architecture needs both retrieval discipline and editorial discipline. Without retrieval discipline, the article is unsupported. Without editorial discipline, the supported material still wastes the reader time.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Blackboard Architecture, Multi-Agent Orchestration Topologies, Claim Graph Source Ledger, RAG Evaluation, Cross-Encoder Reranker, Web Search Query Expansion, and Writing Simplicity. A useful exercise is to turn one research question into claim cards before writing any prose.',
      ],
    },
  ],
};
