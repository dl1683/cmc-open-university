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
  yield {
    state: claimGraph('Research synthesis should be a graph, not a pile of notes'),
    highlight: { active: ['q', 'c1', 'c2', 'e-q-c1', 'e-q-c2'], compare: ['answer'] },
    explanation: 'A source ledger starts with scoped claims. Each claim is atomic enough to check, cite, contradict, or remove. The final answer should be downstream of this graph, not a memory of what the agent once read.',
  };

  yield {
    state: claimGraph('Sources support, date, weaken, or contradict claims'),
    highlight: { active: ['s1', 's2', 's3', 's4', 'c1', 'c2', 'e-s1-c1', 'e-s2-c1', 'e-s3-c2', 'e-s4-c2'], found: ['conflict'] },
    explanation: 'The edge label matters. A source can support a claim, merely mention it, provide a date, define a term, or contradict another source. Citation quality collapses when all edges are treated as "source says".',
    invariant: 'A citation should support the exact sentence it is attached to.',
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
    explanation: 'The minimum record is claim, source pointer, exact support span, date, authority label, and intended report section. That is enough to audit an answer and to refresh only the stale or weak parts later.',
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
    explanation: 'Contradictions are not bugs to hide. They are where research becomes useful. The ledger should make the reason for disagreement explicit so the synthesis can explain it instead of averaging incompatible claims.',
  };
}

function* evidenceWorkflow() {
  yield {
    state: workflowGraph('Evidence workflow: search, read, rank, ledger, audit, write'),
    highlight: { active: ['scope', 'search', 'read', 'ledger', 'e-scope-search', 'e-search-read', 'e-read-ledger'], compare: ['write'] },
    explanation: 'A research agent should not write from raw search results. It should extract evidence into a ledger, rank source authority, and audit gaps before drafting. That is the data-structure version of critical thinking.',
  };

  yield {
    state: workflowGraph('Authority ranking happens before synthesis'),
    highlight: { active: ['search', 'rank', 'ledger', 'e-search-rank', 'e-rank-ledger'], found: ['audit'], compare: ['write'] },
    explanation: 'Official docs, primary papers, benchmark repos, filings, vendor blogs, news stories, and social posts should not have equal weight. Ranking early prevents the final report from laundering weak sources into strong prose.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'evidence items', min: 0, max: 80 }, y: { label: 'research value', min: 0, max: 1 } },
      series: [
        { id: 'coverage', label: 'coverage', points: [{ x: 5, y: 0.25 }, { x: 12, y: 0.48 }, { x: 24, y: 0.7 }, { x: 45, y: 0.84 }, { x: 80, y: 0.9 }] },
        { id: 'confusion', label: 'confusion', points: [{ x: 5, y: 0.03 }, { x: 12, y: 0.08 }, { x: 24, y: 0.19 }, { x: 45, y: 0.44 }, { x: 80, y: 0.8 }] },
      ],
      markers: [
        { id: 'stop', x: 45, y: 0.84, label: 'audit before more crawl' },
      ],
    }),
    highlight: { active: ['coverage', 'stop'], compare: ['confusion'] },
    explanation: 'More evidence helps until it becomes redundant or noisy. A ledger enables stop rules: if the remaining gaps are specific, search for those gaps instead of crawling another pile of weak sources.',
  };

  yield {
    state: workflowGraph('Audit sends stale or unsupported claims back to research'),
    highlight: { active: ['ledger', 'audit', 'refresh', 'e-ledger-audit', 'e-audit-refresh'], found: ['publish'], compare: ['write'] },
    explanation: 'A good ledger supports refresh. Date-sensitive claims can be rechecked, unsupported claims can be removed, and contradictions can be reopened without rewriting the whole report.',
    invariant: 'The answer is only as strong as the weakest important claim it depends on.',
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
      heading: 'What it is',
      paragraphs: [
        'A claim graph is a provenance data structure for research. Nodes represent questions, claims, sources, exact support spans, contradictions, report sections, and final conclusions. Edges explain the relationship: supports, contradicts, dates, defines, weakens, or uses. A source ledger is the appendable table behind that graph. Together they let a research agent produce a report that can be audited instead of merely admired.',
        'Deep Research Agent Architecture Case Study names the source ledger as the core data structure for serious research agents. This module drills into that object. It matters because modern research systems combine web search, PDFs, local files, code execution, and long context. Without a ledger, the final answer becomes source-flavored memory. With a ledger, every important sentence can trace back to an exact piece of evidence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The basic record has a claim id, source pointer, exact span, source date, access date, authority label, contradiction notes, and report-section target. The source pointer might be a URL, a file path, a PDF page, a table row, or a code output artifact. The exact span is critical: a source can be real while the citation is still wrong. A model that cites a paper for a sentence the paper does not support has converted evidence into decoration.',
        'STORM shows why the pre-writing stage matters. The Stanford project describes Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking, where the system researches perspectives before writing: https://storm-project.stanford.edu/research/storm/ and https://arxiv.org/abs/2402.14207. WebGPT showed an earlier browsing-and-reference pattern for long-form answers: https://arxiv.org/abs/2112.09332. Both point toward the same structure: collect grounded evidence before prose.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a user asks for a report on whether long-context models remove the need for RAG. The claim graph starts with several candidate claims: long context improves recall for some workflows; middle-position evidence can still be missed; retrieval can reduce cost and isolate evidence; RAG can introduce retrieval noise; source ledgers remain useful even when the entire document fits. Each claim gets sources, dates, and scope notes. A benchmark paper might support the lost-in-the-middle claim. A vendor blog might support a product capability but receive lower authority for broad empirical claims. A local PDF might add practical observations but should be labeled as local source material.',
        'The contradiction graph then does the real work. One source may say long context solves document QA; another may show failures under distractors or reversed chunk ordering. The answer should not average those claims. It should explain task conditions, model size, evidence position, retrieval quality, and cost. The final report section links only to claims that survived audit. If the user later asks for an update, the agent refreshes the date-sensitive claims and leaves stable definitions alone.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'A claim graph pairs naturally with RAG and GraphRAG. RAG retrieves evidence chunks; the ledger decides which chunks became claims. GraphRAG Community Summary Case Study uses graph structure to summarize entities and communities. Claim graphs use graph structure to audit argument support. They also pair with Distributed Tracing: a research report should have a trace from question to source to claim to section to final conclusion.',
        'Use structured storage when possible. A relational table works for claim records. A property graph works for contradictions, source relationships, and report dependencies. A vector index helps retrieve semantically related claims, but it should not be the source of truth. Search similarity does not know authority, freshness, permission, or exact support.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not count sources as proof. Do not cite a source unless it supports the exact claim. Do not collapse primary and secondary sources into the same weight. Do not erase contradictions; classify them. Do not let stale claims survive because they were once true. Do not expose private source ledgers across users without authorization. Prompt Injection Threat Model also matters because retrieved sources can contain hostile instructions; the ledger should store content as evidence, not as commands.',
        'Study Deep Research Agent Architecture, Deep Research Evaluation Harness Case Study, Blackboard Architecture Agent Coordination, Multi-Agent Orchestration Topologies, Agent Memory & Context Engineering, Multi-Index RAG, RAG Citation Span Index Case Study, GraphRAG Community Summary Case Study, LightRAG Dual-Level Retrieval, RAG Evaluation, LLM Evaluation Harnesses, Lost in the Middle, Distributed Tracing, Prompt Injection Threat Model, Zanzibar Authorization Case Study, Content-Addressed Merkle DAG Object Store, Transparency Log Witnessing Case Study, and Software Supply Chain Provenance Graph next. Local source: deep research.txt in the provided document corpus.',
      ],
    },
  ],
};
