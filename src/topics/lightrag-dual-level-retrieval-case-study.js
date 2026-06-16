// LightRAG: graph-enhanced text indexing with vector retrieval over chunks,
// entities, and relationships, plus local/global/hybrid query modes.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'lightrag-dual-level-retrieval-case-study',
  title: 'LightRAG Dual-Level Retrieval Case Study',
  category: 'Papers',
  summary: 'A graph-plus-vector RAG architecture: extract entities and relationships, store chunks, vectors, and graph records, then retrieve local and global context efficiently.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['index and storage', 'query modes'], defaultValue: 'index and storage' },
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
      { id: 'docs', label: 'docs', x: 0.7, y: 3.6, note: 'corpus' },
      { id: 'chunks', label: 'chunks', x: 2.2, y: 2.0, note: 'text' },
      { id: 'extract', label: 'extract', x: 2.2, y: 5.2, note: 'LLM' },
      { id: 'entities', label: 'entities', x: 4.0, y: 4.3, note: 'nodes' },
      { id: 'relations', label: 'relations', x: 4.0, y: 6.0, note: 'edges' },
      { id: 'vectors', label: 'vectors', x: 5.8, y: 2.0, note: 'semantic' },
      { id: 'graph', label: 'graph DB', x: 5.8, y: 5.1, note: 'structure' },
      { id: 'kv', label: 'KV', x: 7.3, y: 3.0, note: 'artifacts' },
      { id: 'query', label: 'query', x: 9.2, y: 4.2, note: 'modes' },
    ],
    edges: [
      { id: 'e-docs-chunks', from: 'docs', to: 'chunks', weight: 'split' },
      { id: 'e-docs-extract', from: 'docs', to: 'extract', weight: 'parse' },
      { id: 'e-extract-entities', from: 'extract', to: 'entities', weight: 'names' },
      { id: 'e-extract-relations', from: 'extract', to: 'relations', weight: 'links' },
      { id: 'e-chunks-vectors', from: 'chunks', to: 'vectors', weight: 'embed' },
      { id: 'e-entities-vectors', from: 'entities', to: 'vectors', weight: 'embed' },
      { id: 'e-relations-vectors', from: 'relations', to: 'vectors', weight: 'embed' },
      { id: 'e-entities-graph', from: 'entities', to: 'graph', weight: 'upsert' },
      { id: 'e-relations-graph', from: 'relations', to: 'graph', weight: 'upsert' },
      { id: 'e-vectors-kv', from: 'vectors', to: 'kv', weight: 'ids' },
      { id: 'e-graph-kv', from: 'graph', to: 'kv', weight: 'records' },
      { id: 'e-kv-query', from: 'kv', to: 'query' },
    ],
  }, { title });
}

function queryGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'intent' },
      { id: 'local', label: 'local', x: 2.5, y: 1.7, note: 'entity' },
      { id: 'global', label: 'global', x: 2.5, y: 3.5, note: 'theme' },
      { id: 'naive', label: 'naive', x: 2.5, y: 5.3, note: 'chunks' },
      { id: 'graphctx', label: 'graph ctx', x: 4.8, y: 2.4, note: 'entities + rels' },
      { id: 'chunkctx', label: 'chunk ctx', x: 4.8, y: 5.0, note: 'text' },
      { id: 'merge', label: 'mix', x: 7.0, y: 3.6, note: 'dedupe' },
      { id: 'answer', label: 'answer', x: 9.0, y: 3.6, note: 'cited' },
    ],
    edges: [
      { id: 'e-query-local', from: 'query', to: 'local' },
      { id: 'e-query-global', from: 'query', to: 'global' },
      { id: 'e-query-naive', from: 'query', to: 'naive' },
      { id: 'e-local-graphctx', from: 'local', to: 'graphctx', weight: 'nearby facts' },
      { id: 'e-global-graphctx', from: 'global', to: 'graphctx', weight: 'themes' },
      { id: 'e-naive-chunkctx', from: 'naive', to: 'chunkctx', weight: 'vector chunks' },
      { id: 'e-graphctx-merge', from: 'graphctx', to: 'merge' },
      { id: 'e-chunkctx-merge', from: 'chunkctx', to: 'merge' },
      { id: 'e-merge-answer', from: 'merge', to: 'answer' },
    ],
  }, { title });
}

function* indexAndStorage() {
  yield {
    state: indexGraph('LightRAG indexes text as graph plus vectors'),
    highlight: { active: ['docs', 'chunks', 'extract', 'e-docs-chunks', 'e-docs-extract'], compare: ['vectors', 'graph'] },
    explanation: 'LightRAG starts with ordinary documents, but it does not stop at chunk embeddings. It also extracts entities and relationships, then stores both vector-search artifacts and graph artifacts.',
  };

  yield {
    state: indexGraph('Entities and relationships become searchable objects'),
    highlight: { active: ['extract', 'entities', 'relations', 'graph', 'vectors', 'e-extract-entities', 'e-extract-relations', 'e-entities-graph', 'e-relations-graph', 'e-entities-vectors', 'e-relations-vectors'], found: ['chunks'] },
    explanation: 'The graph is not just metadata attached to chunks. Entity records and relationship records can be embedded and retrieved, which gives the query path both semantic search and structural expansion.',
    invariant: 'Graph records must trace back to source chunks; otherwise graph RAG becomes unsupported synthesis.',
  };

  yield {
    state: labelMatrix(
      'Storage roles in a LightRAG-style deployment',
      [
        { id: 'kv', label: 'KV storage' },
        { id: 'vector', label: 'vector storage' },
        { id: 'graph', label: 'graph storage' },
        { id: 'status', label: 'doc status' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'risk', label: 'risk if weak' },
      ],
      [
        ['chunks and LLM artifacts', 'lost provenance'],
        ['chunk/entity/relation vectors', 'semantic miss'],
        ['nodes and edges', 'broken context'],
        ['ingest progress', 'stale index'],
      ],
    ),
    highlight: { active: ['kv:keeps', 'vector:keeps', 'graph:keeps', 'status:keeps'], removed: ['status:risk'] },
    explanation: 'The official implementation separates storage concerns: key-value artifacts, vector indexes, graph storage, and document status. That split is a useful systems lesson even if a production team swaps backend technologies.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'corpus churn', min: 0, max: 1 }, y: { label: 'operational pressure', min: 0, max: 1 } },
      series: [
        { id: 'rebuild', label: 'full rebuild cost', points: [{ x: 0.1, y: 0.25 }, { x: 0.3, y: 0.45 }, { x: 0.6, y: 0.74 }, { x: 0.9, y: 0.95 }] },
        { id: 'incremental', label: 'incremental update pressure', points: [{ x: 0.1, y: 0.14 }, { x: 0.3, y: 0.27 }, { x: 0.6, y: 0.47 }, { x: 0.9, y: 0.68 }] },
      ],
    }),
    highlight: { active: ['incremental'], compare: ['rebuild'] },
    explanation: 'LightRAG emphasizes incremental updates because graph-enhanced indexes are expensive to rebuild from scratch. The faster the corpus changes, the more index freshness becomes a first-class system problem.',
  };
}

function* queryModes() {
  yield {
    state: queryGraph('LightRAG exposes several retrieval modes'),
    highlight: { active: ['query', 'local', 'global', 'naive', 'e-query-local', 'e-query-global', 'e-query-naive'], compare: ['merge'] },
    explanation: 'The query path can choose local graph retrieval, global graph retrieval, naive vector chunk retrieval, or a mixed mode that merges graph and chunk evidence.',
  };

  yield {
    state: labelMatrix(
      'Mode selection',
      [
        { id: 'local', label: 'local' },
        { id: 'global', label: 'global' },
        { id: 'hybrid', label: 'hybrid' },
        { id: 'naive', label: 'naive' },
        { id: 'mix', label: 'mix' },
      ],
      [
        { id: 'best for', label: 'best for' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['specific entities', 'entity extraction errors'],
        ['broad themes', 'summary drift'],
        ['both graph levels', 'more context'],
        ['plain chunk RAG', 'missed relations'],
        ['graph plus chunks', 'latency and dedupe'],
      ],
    ),
    highlight: { active: ['local:best for', 'global:best for', 'mix:best for'], compare: ['naive:watch'] },
    explanation: 'Mode names matter because they expose retrieval intent. Local is for precise entity neighborhoods; global is for broader relationship context; mix keeps ordinary chunks in the loop.',
  };

  yield {
    state: queryGraph('Mixed retrieval reconciles graph context and chunk text'),
    highlight: { active: ['graphctx', 'chunkctx', 'merge', 'answer', 'e-graphctx-merge', 'e-chunkctx-merge', 'e-merge-answer'], found: ['local', 'global', 'naive'] },
    explanation: 'The graph can explain relationships, while raw chunks preserve exact wording and source evidence. A robust answer path merges, dedupes, ranks, and cites both instead of trusting one representation.',
  };

  yield {
    state: labelMatrix(
      'LightRAG versus related RAG structures',
      [
        { id: 'flat', label: 'flat RAG' },
        { id: 'raptor', label: 'RAPTOR' },
        { id: 'graphrag', label: 'GraphRAG' },
        { id: 'lightrag', label: 'LightRAG' },
      ],
      [
        { id: 'index shape', label: 'index shape' },
        { id: 'main cost', label: 'main cost' },
      ],
      [
        ['chunks + vectors', 'context miss'],
        ['summary tree', 'summary rebuilds'],
        ['community graph summaries', 'offline extraction'],
        ['graph + vectors + updates', 'storage orchestration'],
      ],
    ),
    highlight: { active: ['lightrag:index shape'], compare: ['flat:index shape', 'raptor:index shape', 'graphrag:index shape'] },
    explanation: 'LightRAG is best understood as a bridge between ordinary vector RAG and heavier graph-summary systems. It keeps graph structure and vector retrieval active at the same time.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'index and storage') yield* indexAndStorage();
  else if (view === 'query modes') yield* queryModes();
  else throw new InputError('Pick a LightRAG view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'LightRAG is a graph-enhanced retrieval-augmented generation architecture. The central idea is to avoid the flat-chunk weakness of ordinary RAG without making every query depend on a heavyweight global summarization pipeline. It builds a knowledge graph from documents, keeps vector representations for chunks, entities, and relationships, and supports query modes that retrieve low-level and high-level knowledge.',
        'The LightRAG paper describes the motivation as contextual fragmentation in existing RAG systems and proposes graph structures inside text indexing and retrieval. Its dual-level retrieval system is designed to recover both low-level entity detail and high-level relationship context: https://arxiv.org/abs/2410.05779. The arXiv HTML version is useful for reading the method flow: https://arxiv.org/html/2410.05779v1.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Indexing starts with document parsing and chunking, then an LLM extracts entities and relationships. LightRAG stores text chunks, entity records, relationship records, vectors, graph structure, and document status. Query-time retrieval can use local graph neighborhoods, global relationship context, naive chunk retrieval, or a mixed mode that merges graph and chunk evidence. That makes the system a concrete Multi-Index RAG design, not just a vector database wrapper.',
        'The open-source implementation describes LightRAG as a dual-level architecture that manages knowledge graphs and vector embeddings simultaneously: https://github.com/HKUDS/LightRAG. Its README documents storage roles for key-value artifacts, vector storage, graph storage, and document status storage, and describes local, global, hybrid, naive, and mix query modes: https://raw.githubusercontent.com/HKUDS/LightRAG/main/README.md.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'LightRAG reduces some query-time fragmentation by adding structure at index time. The cost is extraction, entity resolution, relationship construction, vector indexing, graph storage, document-status tracking, and incremental maintenance. The paper emphasizes incremental updates because a graph/vector index that cannot absorb new documents becomes stale quickly in legal, finance, healthcare, and enterprise-document settings.',
        'The project page frames LightRAG as a simple and fast RAG framework that integrates graph structures with vector representations: https://lightrag.github.io/. The Findings/EMNLP-hosted PDF also states the open-source availability and summarizes the incremental update goal: https://aclanthology.org/2025.findings-emnlp.568.pdf.',
      ],
    },
    {
      heading: 'Complete case study: contract intelligence assistant',
      paragraphs: [
        'A contract assistant has to answer both exact and relational questions. "What is the termination notice period in the Acme MSA?" is a local query anchored on one agreement and one clause. "Which vendors have termination rights tied to data-processing violations?" is a global relationship query across vendors, clauses, obligations, and breach events. Flat chunk retrieval may find isolated snippets but miss the relationship pattern.',
        'A LightRAG-style design indexes contract chunks, extracts entities such as vendor, contract, obligation, clause, event, and jurisdiction, extracts relationships such as has_obligation, governed_by, terminates_on, and supersedes, embeds both text and graph artifacts, and uses mixed retrieval for final answers. Cross-Encoder Reranker can rerank the final evidence. Zanzibar Authorization Case Study is required because contract visibility is permissioned. RAG Evaluation should score local factuality, global relationship recall, citation support, and freshness separately.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat extracted graph records as ground truth. They are model-produced index artifacts and need source links, confidence, and audit trails. Do not let graph expansion bypass authorization filters. Do not assume graph retrieval always beats flat retrieval; exact identifiers, code symbols, and short factual lookups may still prefer lexical or chunk-vector search. Do not hide query mode choice from evaluation because local, global, naive, hybrid, and mix modes fail differently.',
        'LightRAG is also not the same as GraphRAG or RAPTOR. GraphRAG emphasizes community summaries for local-to-global query-focused summarization. RAPTOR builds a recursive summary tree. LightRAG emphasizes graph/vector dual-level retrieval and incremental update mechanics. In practice, a mature RAG platform may borrow ideas from all three, but it must preserve provenance and evaluate each layer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LightRAG paper at https://arxiv.org/abs/2410.05779, arXiv HTML at https://arxiv.org/html/2410.05779v1, official repository at https://github.com/HKUDS/LightRAG, raw README at https://raw.githubusercontent.com/HKUDS/LightRAG/main/README.md, project page at https://lightrag.github.io/, ACL-hosted PDF at https://aclanthology.org/2025.findings-emnlp.568.pdf, and OpenReview PDF at https://openreview.net/pdf?id=bbVH40jy7f. Study RAG Pipeline, Query Expansion: HyDE and RAG-Fusion, Multi-Index RAG, GraphRAG Community Summary Case Study, RAPTOR Hierarchical Retrieval Case Study, Embeddings & Similarity, HNSW, Reciprocal Rank Fusion, Cross-Encoder Reranker, RAG Evaluation, and Zanzibar Authorization Case Study next.',
      ],
    },
  ],
};
