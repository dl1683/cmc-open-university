// Claim graph and source ledger: the provenance data structure underneath
// deep research, policy analysis, technical reports, and citation-heavy agents.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'claim-graph-source-ledger',
  title: 'Claim Graph & Source Ledger',
  category: 'Data Structures',
  summary: 'Model research as a graph of claims, evidence, contradictions, dates, authority, and report sections so synthesis stays auditable.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['claim graph', 'evidence workflow'], defaultValue: 'claim graph' },
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

function claimGraph(title) {
  return graphState({
    nodes: [
      { id: 'q', label: 'question', x: 0.7, y: 3.6, note: 'scope' },
      { id: 'c1', label: 'claim A', x: 2.4, y: 2.3, note: 'assert' },
      { id: 'c2', label: 'claim B', x: 2.4, y: 5.2, note: 'assert' },
      { id: 's1', label: 'paper', x: 4.7, y: 1.1, note: 'primary' },
      { id: 's2', label: 'docs', x: 4.8, y: 2.9, note: 'official' },
      { id: 's3', label: 'blog', x: 4.8, y: 4.8, note: 'secondary' },
      { id: 's4', label: 'filing', x: 4.7, y: 6.4, note: 'dated' },
      { id: 'conflict', label: 'conflict', x: 6.6, y: 3.8, note: 'why?' },
      { id: 'section', label: 'section', x: 8.0, y: 2.5, note: 'uses' },
      { id: 'answer', label: 'answer', x: 9.1, y: 4.2, note: 'cited' },
    ],
    edges: [
      { id: 'e-q-c1', from: 'q', to: 'c1' },
      { id: 'e-q-c2', from: 'q', to: 'c2' },
      { id: 'e-s1-c1', from: 's1', to: 'c1' },
      { id: 'e-s2-c1', from: 's2', to: 'c1' },
      { id: 'e-s3-c2', from: 's3', to: 'c2' },
      { id: 'e-s4-c2', from: 's4', to: 'c2' },
      { id: 'e-c1-conflict', from: 'c1', to: 'conflict' },
      { id: 'e-c2-conflict', from: 'c2', to: 'conflict' },
      { id: 'e-c1-section', from: 'c1', to: 'section' },
      { id: 'e-c2-section', from: 'c2', to: 'section' },
      { id: 'e-section-answer', from: 'section', to: 'answer' },
    ],
  }, { title });
}

function workflowGraph(title) {
  return graphState({
    nodes: [
      { id: 'scope', label: 'scope', x: 0.7, y: 3.8, note: 'question' },
      { id: 'search', label: 'search', x: 2.1, y: 1.6, note: 'find' },
      { id: 'read', label: 'read', x: 3.5, y: 1.6, note: 'extract' },
      { id: 'ledger', label: 'ledger', x: 4.9, y: 3.8, note: 'claims' },
      { id: 'rank', label: 'rank', x: 3.5, y: 5.9, note: 'authority' },
      { id: 'audit', label: 'audit', x: 6.4, y: 2.0, note: 'gaps' },
      { id: 'outline', label: 'outline', x: 6.4, y: 5.6, note: 'sections' },
      { id: 'write', label: 'write', x: 8.1, y: 3.8, note: 'synthesis' },
      { id: 'refresh', label: 'refresh', x: 9.2, y: 2.0, note: 'stale?' },
      { id: 'publish', label: 'publish', x: 9.3, y: 5.7, note: 'cited' },
    ],
    edges: [
      { id: 'e-scope-search', from: 'scope', to: 'search' },
      { id: 'e-search-read', from: 'search', to: 'read' },
      { id: 'e-read-ledger', from: 'read', to: 'ledger' },
      { id: 'e-search-rank', from: 'search', to: 'rank' },
      { id: 'e-rank-ledger', from: 'rank', to: 'ledger' },
      { id: 'e-ledger-audit', from: 'ledger', to: 'audit' },
      { id: 'e-ledger-outline', from: 'ledger', to: 'outline' },
      { id: 'e-audit-refresh', from: 'audit', to: 'refresh' },
      { id: 'e-audit-write', from: 'audit', to: 'write' },
      { id: 'e-outline-write', from: 'outline', to: 'write' },
      { id: 'e-write-publish', from: 'write', to: 'publish' },
    ],
  }, { title });
}

function* graphView() {
  const nodeCount = 10;
  const edgeCount = 11;
  const sourceCount = 4;
  const claimCount = 2;
  const recordFields = 6;
  const contradictionTypes = 5;

  yield {
    state: claimGraph('Research synthesis should be a graph, not a pile of notes'),
    highlight: { active: ['q', 'c1', 'c2', 'e-q-c1', 'e-q-c2'], compare: ['answer'] },
    explanation: `A source ledger starts with scoped claims across ${nodeCount} graph nodes linked by ${edgeCount} edges. Each claim is atomic enough to check, cite, contradict, or remove. The final answer should be downstream of this graph, not a memory of what the agent once read.`,
  };

  yield {
    state: claimGraph('Sources support, date, weaken, or contradict claims'),
    highlight: { active: ['s1', 's2', 's3', 's4', 'c1', 'c2', 'e-s1-c1', 'e-s2-c1', 'e-s3-c2', 'e-s4-c2'], found: ['conflict'] },
    explanation: `The edge label matters. Each of the ${sourceCount} sources can support a claim, merely mention it, provide a date, define a term, or contradict another source. With ${claimCount} claims in play, citation quality collapses when all edges are treated as "source says".`,
    invariant: `A citation should support the exact sentence it is attached to — ${sourceCount} sources feed ${claimCount} claims here, and each edge type matters.`,
  };

  yield {
    state: labelMatrix(
      'Claim record schema',
      [
        { id: 'text', label: 'claim text' },
        { id: 'source', label: 'source pointer' },
        { id: 'span', label: 'span' },
        { id: 'time', label: 'time' },
        { id: 'authority', label: 'authority' },
        { id: 'use', label: 'report use' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'prevents', label: 'prevents' },
      ],
      [
        ['one assertion', 'vague summary'],
        ['URL/file/page', 'lost provenance'],
        ['quote/data row', 'citation bluff'],
        ['published/accessed', 'stale fact'],
        ['primary/secondary', 'false balance'],
        ['section target', 'orphan notes'],
      ],
    ),
    highlight: { active: ['source:stores', 'span:stores', 'time:stores', 'authority:stores'], removed: ['span:prevents'] },
    explanation: `The minimum record has ${recordFields} fields: claim, source pointer, exact support span, date, authority label, and intended report section. That is enough to audit an answer and to refresh only the stale or weak parts later.`,
  };

  yield {
    state: labelMatrix(
      'Contradiction handling',
      [
        { id: 'version', label: 'newer version' },
        { id: 'method', label: 'method gap' },
        { id: 'scope', label: 'scope gap' },
        { id: 'metric', label: 'metric mismatch' },
        { id: 'interest', label: 'conflict of interest' },
      ],
      [
        { id: 'signal', label: 'what it means' },
        { id: 'response', label: 'response' },
      ],
      [
        ['fact changed', 'prefer current'],
        ['different design', 'explain both'],
        ['not same population', 'narrow claim'],
        ['incomparable score', 'normalize'],
        ['incentive bias', 'downgrade weight'],
      ],
    ),
    highlight: { active: ['version:response', 'method:response', 'scope:response', 'metric:response'], compare: ['interest:response'] },
    explanation: `Contradictions are not bugs to hide. They are where research becomes useful. The ledger classifies ${contradictionTypes} contradiction types so the synthesis can explain disagreement instead of averaging incompatible claims.`,
  };
}

function* evidenceWorkflow() {
  const workflowSteps = 10;
  const workflowEdges = 11;
  const maxEvidence = 80;
  const stopPoint = 45;
  const coverageAtStop = 0.84;
  const confusionAtStop = 0.44;

  yield {
    state: workflowGraph('Evidence workflow: search, read, rank, ledger, audit, write'),
    highlight: { active: ['scope', 'search', 'read', 'ledger', 'e-scope-search', 'e-search-read', 'e-read-ledger'], compare: ['write'] },
    explanation: `A research agent should not write from raw search results. Across ${workflowSteps} pipeline steps linked by ${workflowEdges} edges, it should extract evidence into a ledger, rank source authority, and audit gaps before drafting. That is the data-structure version of critical thinking.`,
  };

  yield {
    state: workflowGraph('Authority ranking happens before synthesis'),
    highlight: { active: ['search', 'rank', 'ledger', 'e-search-rank', 'e-rank-ledger'], found: ['audit'], compare: ['write'] },
    explanation: `Official docs, primary papers, benchmark repos, filings, vendor blogs, news stories, and social posts should not have equal weight. With ${workflowSteps} stages in the pipeline, ranking early prevents the final report from laundering weak sources into strong prose.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'evidence items', min: 0, max: maxEvidence }, y: { label: 'research value', min: 0, max: 1 } },
      series: [
        { id: 'coverage', label: 'coverage', points: [{ x: 5, y: 0.25 }, { x: 12, y: 0.48 }, { x: 24, y: 0.7 }, { x: stopPoint, y: coverageAtStop }, { x: maxEvidence, y: 0.9 }] },
        { id: 'confusion', label: 'confusion', points: [{ x: 5, y: 0.03 }, { x: 12, y: 0.08 }, { x: 24, y: 0.19 }, { x: stopPoint, y: confusionAtStop }, { x: maxEvidence, y: 0.8 }] },
      ],
      markers: [
        { id: 'stop', x: stopPoint, y: coverageAtStop, label: 'audit before more crawl' },
      ],
    }),
    highlight: { active: ['coverage', 'stop'], compare: ['confusion'] },
    explanation: `More evidence helps until it becomes redundant or noisy. At ${stopPoint} items, coverage reaches ${coverageAtStop} but confusion hits ${confusionAtStop}. A ledger enables stop rules: if the remaining gaps are specific, search for those gaps instead of crawling up to ${maxEvidence} weak sources.`,
  };

  yield {
    state: workflowGraph('Audit sends stale or unsupported claims back to research'),
    highlight: { active: ['ledger', 'audit', 'refresh', 'e-ledger-audit', 'e-audit-refresh'], found: ['publish'], compare: ['write'] },
    explanation: `A good ledger supports refresh across all ${workflowSteps} workflow stages. Date-sensitive claims can be rechecked, unsupported claims can be removed, and contradictions can be reopened without rewriting the whole report.`,
    invariant: `The answer is only as strong as the weakest important claim it depends on — audit the full ${workflowEdges}-edge pipeline before publishing.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'claim graph') yield* graphView();
  else if (view === 'evidence workflow') yield* evidenceWorkflow();
  else throw new InputError('Pick a claim-ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/claim-graph-source-ledger.gif', alt: 'Animated walkthrough of the claim graph source ledger visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'What it is',
      paragraphs: [
        'A claim graph is a data structure for research synthesis. Nodes represent questions, atomic claims, sources, contradictions, report sections, and final conclusions. Edges say what kind of relationship exists: a source supports a claim, a source merely mentions a topic, a newer source supersedes an older one, a claim contradicts another claim, or a report section depends on a claim. The source ledger is the durable table behind the graph: source pointer, exact support span, date, authority label, extraction note, and intended use.',
        {type: 'callout', text: 'A claim graph makes evidence a first-class dependency, so fluent prose cannot outrun exact support.'},
        'The structure exists because prose can sound cited while being weakly supported. A footnote may point to a real document but not to the exact sentence being written. A benchmark may support one workload but not another. A vendor blog may be useful for product facts but weak for independent performance claims. The claim graph keeps those distinctions available until the final answer is written.',
      ],
    },
    {
      heading: 'The real problem',
      paragraphs: [
        'The naive workflow is link collection followed by summary. Search returns pages, the researcher skims them, notes become paragraphs, and citations get attached near the end. This feels fast because it avoids the bookkeeping, but it collapses four separate questions: what exactly was claimed, what exact evidence supports it, how authoritative that source is, and whether a conflicting or newer source changes the answer.',
        'The second failure is citation density. A paragraph with six citations can still be unsupported if none of those sources proves the specific sentence. This matters most in market reports, policy analysis, scientific literature reviews, benchmark comparisons, legal research, and technical architecture reports, where a single overbroad claim can mislead the whole conclusion.',
      ],
    },
    {
      heading: 'Core insight and data model',
      paragraphs: [
        'A useful claim record is small and strict. It should store the claim text, source pointer, exact support span or data row, source date, access date, authority label, scope note, contradiction status, confidence or review state, and target report section. The source pointer can be a URL, PDF page, file path, database row, command output artifact, or repository commit. The span is what prevents citation bluffing: the final sentence should be traceable to the exact evidence, not just to the general document.',
        {type: 'image', src: 'https://www.w3.org/TR/prov-overview/prov-family.png', alt: 'W3C PROV family diagram with data model serializations and constraints', caption: 'The PROV family shows why provenance is a data model, not just a citation style: entities, constraints, serializations, and access rules stay separate. Source: W3C PROV-Overview, https://www.w3.org/TR/prov-overview/.'},
        'The graph adds relationships that a flat bibliography cannot express. A source can support, contradict, define, date, scope, weaken, or supersede a claim. A claim can depend on another claim. A report section can consume a set of claims. A contradiction node can explain whether the conflict is a version change, method difference, population mismatch, metric mismatch, or incentive bias. This lets the synthesis explain disagreement instead of smoothing it into false balance.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the claim-graph view, start at the scoped question and follow the edges into individual claims. The source nodes are not decorative citations. The edge type is the lesson: a paper, official doc, blog, or filing can support different claims with different strength. The conflict node shows where the research becomes valuable, because contradictions force the graph to name scope, method, date, and authority instead of burying the problem in confident prose.',
        'In the evidence-workflow view, read the pipeline as a control loop. Search finds candidates. Reading extracts evidence into the ledger. Authority ranking decides how much weight a source deserves before synthesis begins. Audit finds stale facts, unsupported claims, and missing sections. The refresh edge is the maintenance feature: a good report can be updated claim by claim instead of rewritten from memory.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The practical workflow is search, read, extract, rank, ledger, audit, outline, write. Search and retrieval are only candidate generation. Reading turns passages, tables, and artifacts into atomic claims. Ranking labels source authority before drafting: official docs, primary papers, benchmark repositories, filings, standards, vendor blogs, news stories, and social posts should not enter the synthesis with the same weight. Audit then asks whether every important claim has exact support, whether a newer source exists, and whether contradictions have been classified.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'Directed edges are the useful mental model: support, contradiction, supersession, and section-dependency relationships all have direction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Writing should be downstream of the surviving graph. A section outline can be generated from claims whose support is strong enough for publication. Unsupported claims are removed or sent back to research. Stale claims are refreshed. Contradictions become explicit explanation. In an agent system, this ledger is the boundary between retrieval and answer generation: embeddings can find nearby text, but the claim ledger decides what evidence the answer is allowed to rely on.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because it separates evidence from fluency. A model, analyst, or writer can produce confident prose from memory, but the graph forces every important sentence to pass through a support check. This changes the failure mode from "the answer sounded right" to "claim C17 lacks a primary source" or "claim C21 is true only for the 2024 benchmark, not the current release."',
        'It also makes research state reusable. If one source changes, the graph identifies which claims and sections depend on it. If a contradiction appears, the graph identifies the affected conclusion. If a reviewer challenges a sentence, the ledger can show the exact support span or remove the claim. This is the same engineering principle as provenance graphs and distributed tracing: important outputs should have a path back to the inputs that produced them.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is friction. Extracting exact spans, dates, authority labels, and contradiction notes takes longer than writing from a search result page. The ledger also creates storage and privacy obligations because it may contain excerpts from licensed documents, private files, customer evidence, or internal notes. A serious implementation needs access control, source permissions, redaction rules, and a clear difference between evidence and instructions from untrusted text.',
        'The payoff is controlled complexity. More sources do not always improve a report. Past a point, crawling adds duplication and confusion. A ledger supports stop rules: if coverage is good but one section lacks primary evidence, search for that gap; if sources conflict on a metric, normalize the metric or narrow the claim; if all new sources repeat the same weak vendor statement, stop counting them as independent support.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A user asks whether long-context models remove the need for RAG. A shallow answer picks a side and cites a few model announcements. A claim graph starts with narrower claims: long context can reduce retrieval plumbing for documents that fit in the window; evidence in the middle of long contexts can still be missed; retrieval can reduce cost and isolate exact support; retrieval can introduce its own ranking errors; source-ledger discipline remains useful even when the full document fits in context.',
        'Each claim receives sources, dates, scope notes, and authority labels. A benchmark paper may support claims about lost-in-the-middle behavior for a specific setup. Official model documentation may support context-window size but not broad task performance. A vendor blog may support product capabilities while being downgraded for comparative claims. The final answer becomes conditional: for a small stable corpus, long context may simplify the system; for large, changing, permissioned, or citation-critical corpora, retrieval plus a claim ledger remains important.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The graph fails when claims are too large. "Product X is better than product Y" is not atomic enough to support or contradict. Break it into workload, metric, version, cost, and evidence conditions. It also fails when all edges mean "source says." A source may define a term, report a number, repeat a rumor, cite another source, or contradict a claim. Those relationships need different labels.',
        'Security failures are just as important. A retrieved web page or PDF can contain instructions that should never control the agent. Private source ledgers can leak across users if authorization is not attached to the evidence. A ledger can also launder low-quality evidence into confident prose if authority labels are ignored during synthesis. The structure is only useful when the writer or agent obeys it.',
      ],
    },
    {
      heading: 'Useful contexts',
      paragraphs: [
        'Claim graphs are valuable for deep research agents, market maps, technical due diligence, policy memos, legal research support, literature reviews, model-evaluation reports, incident postmortems, and any writing that will be challenged or refreshed later. They are especially useful when source age, authority, and scope affect the conclusion.',
        'They also connect several data-structure ideas. The graph gives provenance. The ledger gives an appendable audit log. A citation-span index gives exact support retrieval. A priority queue can triage source authority. A contradiction-resolution graph can turn conflicts into new subquestions. RAG can find candidates, but the claim graph decides which candidates become durable knowledge.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: STORM research page at https://storm-project.stanford.edu/research/storm/, STORM paper at https://arxiv.org/abs/2402.14207, and WebGPT at https://arxiv.org/abs/2112.09332.',
        'Study Deep Research Agent Architecture, Deep Research Evaluation System Case Study, Multi-Index RAG, RAG Citation Span Index Case Study, GraphRAG Community Summary Case Study, LightRAG Dual-Level Retrieval, RAG Evaluation, Lost in the Middle, Distributed Tracing, Prompt Injection Threat Model, Zanzibar Authorization Case Study, Content-Addressed Merkle DAG Object Store, Transparency Log Witnessing Case Study, and Software Supply Chain Provenance Graph next.',
      ],
    },
  ],
};
