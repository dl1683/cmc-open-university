// GraphRAG: build an entity graph from text, cluster it into communities,
// precompute community summaries, then query globally, locally, or with DRIFT.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'graphrag-community-summary-case-study',
  title: 'GraphRAG Community Summary Case Study',
  category: 'Papers',
  summary: 'Microsoft GraphRAG as a retrieval-systems lesson: extract entity graphs, detect communities, precompute summaries, and query global or local structure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['index graph', 'query modes'], defaultValue: 'index graph' },
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

function indexGraph(title) {
  return graphState({
    nodes: [
      { id: 'docs', label: 'docs', x: 0.6, y: 4.1, note: 'corpus' },
      { id: 'chunks', label: 'chunks', x: 2.4, y: 2.5, note: 'text' },
      { id: 'extract', label: 'extract', x: 4.1, y: 4.0, note: 'LLM pass' },
      { id: 'entities', label: 'nodes', x: 5.8, y: 1.2, note: 'entities' },
      { id: 'edges', label: 'edges', x: 5.8, y: 3.5, note: 'relations' },
      { id: 'claims', label: 'claims', x: 5.8, y: 5.8, note: 'facts' },
      { id: 'cluster', label: 'cluster', x: 7.7, y: 2.5, note: 'groups' },
      { id: 'summaries', label: 'reports', x: 9.2, y: 4.8, note: 'summaries' },
    ],
    edges: [
      { id: 'e-docs-chunks', from: 'docs', to: 'chunks', weight: 'split' },
      { id: 'e-chunks-extract', from: 'chunks', to: 'extract', weight: 'prompt' },
      { id: 'e-extract-entities', from: 'extract', to: 'entities', weight: 'names' },
      { id: 'e-extract-edges', from: 'extract', to: 'edges', weight: 'relations' },
      { id: 'e-extract-claims', from: 'extract', to: 'claims', weight: 'claims' },
      { id: 'e-entities-cluster', from: 'entities', to: 'cluster', weight: 'graph' },
      { id: 'e-edges-cluster', from: 'edges', to: 'cluster', weight: 'weights' },
      { id: 'e-cluster-summaries', from: 'cluster', to: 'summaries', weight: 'reports' },
      { id: 'e-claims-summaries', from: 'claims', to: 'summaries', weight: 'evidence' },
    ],
  }, { title });
}

function queryGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.6, note: 'user task' },
      { id: 'global', label: 'global', x: 2.5, y: 1.5, note: 'themes' },
      { id: 'local', label: 'local', x: 2.5, y: 3.6, note: 'entity' },
      { id: 'drift', label: 'DRIFT', x: 2.5, y: 5.8, note: 'hybrid' },
      { id: 'communities', label: 'reports', x: 5.0, y: 1.5, note: 'summaries' },
      { id: 'neighborhood', label: 'neighborhood', x: 5.0, y: 4.0, note: 'graph + text' },
      { id: 'followups', label: 'followups', x: 5.0, y: 6.1, note: 'subqueries' },
      { id: 'reduce', label: 'reduce', x: 7.4, y: 3.6, note: 'merge answers' },
      { id: 'answer', label: 'answer', x: 9.1, y: 3.6, note: 'cited' },
    ],
    edges: [
      { id: 'e-q-global', from: 'query', to: 'global' },
      { id: 'e-q-local', from: 'query', to: 'local' },
      { id: 'e-q-drift', from: 'query', to: 'drift' },
      { id: 'e-global-communities', from: 'global', to: 'communities', weight: 'map' },
      { id: 'e-local-neighborhood', from: 'local', to: 'neighborhood', weight: 'expand' },
      { id: 'e-drift-followups', from: 'drift', to: 'followups', weight: 'ask' },
      { id: 'e-followups-neighborhood', from: 'followups', to: 'neighborhood', weight: 'search' },
      { id: 'e-communities-reduce', from: 'communities', to: 'reduce', weight: 'partial answers' },
      { id: 'e-neighborhood-reduce', from: 'neighborhood', to: 'reduce', weight: 'facts' },
      { id: 'e-reduce-answer', from: 'reduce', to: 'answer', weight: 'synthesize' },
    ],
  }, { title });
}

function* indexGraphView() {
  yield {
    state: indexGraph('GraphRAG turns a corpus into graph-shaped memory'),
    highlight: { active: ['docs', 'chunks', 'extract', 'e-docs-chunks', 'e-chunks-extract'], compare: ['cluster', 'summaries'] },
    explanation: 'Naive RAG indexes chunks. GraphRAG starts there, then spends an offline LLM pass extracting entities, relationships, and claims from those chunks.',
  };

  yield {
    state: indexGraph('Entities and relationships become a weighted graph'),
    highlight: { active: ['extract', 'entities', 'edges', 'claims', 'e-extract-entities', 'e-extract-edges', 'e-extract-claims'], found: ['chunks'] },
    explanation: 'The extracted entity graph is the central data structure. Entity nodes carry descriptions. Relationship edges carry typed connections and weights. Claims preserve source-backed facts that summaries can cite later.',
    invariant: 'GraphRAG is only as trustworthy as its extraction and source-traceability pipeline.',
  };

  yield {
    state: labelMatrix(
      'Index artifacts',
      [
        { id: 'text', label: 'text units' },
        { id: 'entity', label: 'entities' },
        { id: 'rel', label: 'relations' },
        { id: 'comm', label: 'communities' },
        { id: 'report', label: 'reports' },
      ],
      [
        { id: 'stored as', label: 'stored as' },
        { id: 'query value', label: 'query value' },
      ],
      [
        ['chunks', 'source evidence'],
        ['nodes', 'local search anchors'],
        ['edges', 'neighborhood expansion'],
        ['clusters', 'global structure'],
        ['summaries', 'global context'],
      ],
    ),
    highlight: { active: ['entity:query value', 'rel:query value', 'comm:query value', 'report:query value'], found: ['text:query value'] },
    explanation: 'The index is not one vector table. It is a family of linked artifacts: chunks, entity nodes, relationship edges, community assignments, and community summaries.',
  };

  yield {
    state: indexGraph('Community detection compresses graph structure'),
    highlight: { active: ['entities', 'edges', 'cluster', 'summaries', 'e-entities-cluster', 'e-edges-cluster', 'e-cluster-summaries'], compare: ['chunks'] },
    explanation: 'Community detection groups densely related entities. GraphRAG then precomputes natural-language reports for those communities, creating a summary hierarchy that can answer corpus-level questions without stuffing all raw chunks into context.',
  };

  yield {
    state: labelMatrix(
      'Offline cost and quality gates',
      [
        { id: 'extract', label: 'extract' },
        { id: 'resolve', label: 'resolve' },
        { id: 'cluster', label: 'cluster' },
        { id: 'summarize', label: 'summarize' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'cost driver', label: 'cost driver' },
        { id: 'failure mode', label: 'failure mode' },
      ],
      [
        ['LLM calls per chunk', 'missed or invented entities'],
        ['entity merge rules', 'duplicate nodes'],
        ['graph algorithm', 'bad community boundaries'],
        ['LLM report generation', 'unsupported claims'],
        ['source links', 'no provenance path'],
      ],
    ),
    highlight: { active: ['extract:cost driver', 'summarize:cost driver'], removed: ['audit:failure mode'] },
    explanation: 'GraphRAG moves work from query time to indexing time. That can improve global questions, but it creates a serious offline pipeline: extraction quality, entity resolution, clustering, summarization, and provenance all need gates.',
  };
}

function* queryModesView() {
  yield {
    state: queryGraph('GraphRAG has separate query paths'),
    highlight: { active: ['query', 'global', 'local', 'drift', 'e-q-global', 'e-q-local', 'e-q-drift'], compare: ['answer'] },
    explanation: 'The query shape decides the path. Global search uses community reports for broad sensemaking. Local search starts from entities and graph neighborhoods. DRIFT blends global community context with local follow-up searches.',
  };

  yield {
    state: queryGraph('Global search maps over community summaries'),
    highlight: { active: ['global', 'communities', 'reduce', 'answer', 'e-global-communities', 'e-communities-reduce', 'e-reduce-answer'], compare: ['local'] },
    explanation: 'For questions like "What are the main themes?", there may be no single chunk to retrieve. Global search asks community summaries for partial answers, then reduces those partial answers into a final synthesis.',
    invariant: 'Global GraphRAG is query-focused summarization over a precomputed graph summary hierarchy.',
  };

  yield {
    state: queryGraph('Local search follows entities back to facts'),
    highlight: { active: ['local', 'neighborhood', 'reduce', 'answer', 'e-local-neighborhood', 'e-neighborhood-reduce'], found: ['query'] },
    explanation: 'For entity-specific questions, local search retrieves relevant entity records, linked relationships, source chunks, and related community information. This is closer to Multi-Index RAG with a graph-first candidate set.',
  };

  yield {
    state: queryGraph('DRIFT expands local search with community-guided follow-ups'),
    highlight: { active: ['drift', 'followups', 'neighborhood', 'reduce', 'e-drift-followups', 'e-followups-neighborhood', 'e-neighborhood-reduce'], compare: ['global'] },
    explanation: 'DRIFT starts with broader community context, generates focused follow-up questions, then runs local retrieval for those subquestions. It is designed to balance global coverage against local evidence and cost.',
  };

  yield {
    state: labelMatrix(
      'When to use each mode',
      [
        { id: 'themes', label: 'themes' },
        { id: 'actor', label: 'actor' },
        { id: 'why', label: 'why/how' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'best mode', label: 'best mode' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['global', 'summary drift'],
        ['local', 'entity resolution errors'],
        ['DRIFT', 'cost and subquery noise'],
        ['local + provenance', 'unsupported summaries'],
      ],
    ),
    highlight: { active: ['themes:best mode', 'actor:best mode', 'why:best mode'], removed: ['audit:risk'] },
    explanation: 'Mode choice is a retrieval design decision. The best answer path depends on whether the user needs corpus-level synthesis, entity-level facts, exploratory reasoning, or auditable provenance.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'index graph') yield* indexGraphView();
  else if (view === 'query modes') yield* queryModesView();
  else throw new InputError('Pick a GraphRAG view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'GraphRAG is a retrieval-augmented generation architecture from Microsoft Research that attacks a specific weakness of ordinary vector RAG: broad corpus-level questions. A question like "What are the main themes in these documents?" may not have one nearest chunk. GraphRAG builds a graph index first, then answers by combining graph community summaries and local evidence.',
        'It sits beside RAPTOR Hierarchical Retrieval Case Study and LightRAG Dual-Level Retrieval Case Study, not inside them. RAPTOR builds a summary tree from clustered chunks. GraphRAG extracts entities, relationships, claims, and communities, then summarizes graph communities. LightRAG keeps graph records and vector records active together for local, global, hybrid, naive, and mixed retrieval modes. All three move structure into the index, but they choose different data structures.',
        'The Microsoft paper "From Local to Global: A Graph RAG Approach to Query-Focused Summarization" describes the core approach: use an LLM to derive an entity knowledge graph from source documents, generate summaries for graph communities, and use those summaries during query-focused summarization: https://arxiv.org/abs/2404.16130. Microsoft\'s GraphRAG documentation describes it as a structured, hierarchical RAG approach over extracted knowledge graphs, community hierarchy, and generated community summaries: https://microsoft.github.io/graphrag/.',
      ],
    },
    {
      heading: 'Indexing pipeline',
      paragraphs: [
        'Indexing starts like RAG Pipeline: clean documents and split them into text units. The difference is the next stage. An LLM extracts entities, relationships, and claims. Those artifacts are assembled into a graph whose nodes are entities and whose edges express relationships. Leiden & Louvain Community Detection then partitions the graph into related groups, and another LLM pass writes summaries for those groups.',
        'The output is a linked index family: text units for evidence, entity records for local anchors, relationship records for graph traversal, community records for structure, and community reports for precomputed synthesis. That is why this belongs beside Multi-Index RAG and Compressed Sparse Row Graph: it is not one index, but a graph-plus-summary index pipeline.',
      ],
    },
    {
      heading: 'Query modes',
      paragraphs: [
        'Global search is the signature mode. It selects community reports, asks them for partial answers, then reduces partial answers into a final response. This map-reduce shape is useful for global sensemaking questions because the system has already compressed the corpus into summary layers. The GraphRAG local-search docs describe the alternate path: combine structured graph data with unstructured source text for questions about specific entities: https://microsoft.github.io/graphrag/query/local_search/.',
        'DRIFT Search extends the design by combining global and local search: start with community context, generate focused follow-up questions, run local retrieval, and synthesize the evidence. Microsoft Research introduced DRIFT as a way to blend global and local search for better quality and efficiency: https://www.microsoft.com/en-us/research/blog/introducing-drift-search-combining-global-and-local-search-methods-to-improve-quality-and-efficiency/. The current GraphRAG DRIFT documentation describes the method and configuration: https://microsoft.github.io/graphrag/query/drift_search/.',
      ],
    },
    {
      heading: 'Complete case study: enterprise incident archive',
      paragraphs: [
        'Suppose an engineering organization has years of incident reports, postmortems, Slack exports, deployment notes, and service docs. Naive RAG can answer "what happened in incident INC-742?" if the exact report is retrieved. GraphRAG is more useful for "what recurring coordination failures appear across payment incidents?" because it can surface communities such as service ownership, dependency failures, alert fatigue, rollout controls, and mitigation patterns.',
        'The production design should keep provenance first. Community summaries are useful only if claims can trace back to source text. Access control must filter text units, entities, and reports before they enter context; Zanzibar Authorization Case Study is the model for that. Prompt Injection Threat Model matters because retrieved documents may contain hostile instructions. LLM Evaluation Harness & Golden Sets should score global coverage, local factuality, citation support, and cost separately.',
      ],
    },
    {
      heading: 'Cost and pitfalls',
      paragraphs: [
        'GraphRAG pays substantial indexing cost: extraction, entity resolution, graph construction, community detection, and summary generation. That cost can be worth it for stable corpora and global questions, but it is a poor fit when documents change constantly, the corpus is tiny, or all queries are exact lookups. It also creates new failure modes: duplicate entities, hallucinated edges, unsupported summaries, stale community reports, and broken provenance.',
        'Do not treat the graph as objective truth. It is an LLM-derived index that needs validation. Do not retrieve private documents and trust the model to ignore unauthorized text. Do not answer audit questions from community summaries alone when exact source passages matter. LightRAG is a useful contrast because it keeps graph records and raw chunk retrieval closer together; GraphRAG users still need local search and provenance for audit-heavy questions. And do not benchmark only final answer pleasantness; evaluate extraction quality, retrieval coverage, summary support, and answer faithfulness separately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Microsoft GraphRAG paper at https://arxiv.org/abs/2404.16130, GraphRAG docs at https://microsoft.github.io/graphrag/, Microsoft GraphRAG GitHub repository at https://github.com/microsoft/graphrag, Microsoft Research project page at https://www.microsoft.com/en-us/research/project/graphrag/, global/local overview blog at https://www.microsoft.com/en-us/research/blog/graphrag-new-tool-for-complex-data-discovery-now-on-github/, DRIFT blog at https://www.microsoft.com/en-us/research/blog/introducing-drift-search-combining-global-and-local-search-methods-to-improve-quality-and-efficiency/, local search docs at https://microsoft.github.io/graphrag/query/local_search/, and DRIFT docs at https://microsoft.github.io/graphrag/query/drift_search/.',
        'Study RAG Pipeline, Multi-Index RAG, Leiden & Louvain Community Detection, GraphBLAS Sparse Matrix Graph Case Study, Compressed Sparse Row Graph, Embeddings & Similarity, HNSW, LightRAG Dual-Level Retrieval Case Study, Prompt Injection Threat Model, Zanzibar Authorization Case Study, and LLM Evaluation Harness & Golden Sets next.',
      ],
    },
  ],
};
