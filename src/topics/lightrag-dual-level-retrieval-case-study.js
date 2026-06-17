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
    explanation: 'LightRAG keeps two retrieval levels alive. It indexes ordinary chunks for semantic lookup, then extracts graph records so entity neighborhoods and relationship context can be retrieved too.',
  };

  yield {
    state: indexGraph('Entities and relationships become searchable objects'),
    highlight: { active: ['extract', 'entities', 'relations', 'graph', 'vectors', 'e-extract-entities', 'e-extract-relations', 'e-entities-graph', 'e-relations-graph', 'e-entities-vectors', 'e-relations-vectors'], found: ['chunks'] },
    explanation: 'The graph records are searchable evidence objects, not decorative metadata. Entity and relationship records can be embedded, ranked, expanded, and traced back to source chunks.',
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
    explanation: 'The reference design separates storage concerns: key-value artifacts, vector indexes, graph storage, and document status. That split keeps provenance, retrieval, graph expansion, and freshness from becoming one hidden blob.',
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
    explanation: 'The query path chooses a retrieval contract before ranking context. Local mode starts near named entities, global mode searches for broader relation patterns, naive mode keeps flat chunk retrieval, and mixed mode reconciles graph and text evidence.',
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
    explanation: 'The mode labels describe what can fail. Local mode depends on entity extraction, global mode depends on relationship summaries, naive mode can miss structure, and mixed mode pays extra ranking and dedupe cost.',
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
      heading: 'Why this exists',
      paragraphs: [
        'LightRAG exists because flat chunk-vector RAG is often too weak for relationship questions. A corpus is not only a pile of similar paragraphs. It contains people, products, clauses, drugs, bugs, events, claims, and links between them. A nearest-neighbor chunk search may find relevant words while missing the relation that makes those chunks belong together.',
        'The problem is not that vector search is useless. It is useful and should stay in the system. The problem is that one representation has to answer too many questions: exact wording, entity lookup, relationship discovery, global themes, and source grounding. LightRAG adds a graph layer so retrieval can ask for local entity context, wider relationship context, flat chunks, or a mixed evidence set.',
      ],
    },
    {
      heading: 'Obvious approach and wall',
      paragraphs: [
        'The obvious approach is standard RAG: split documents into chunks, embed each chunk, retrieve the nearest vectors, and pass those chunks to the model. That baseline is simple, cheap to explain, and strong for many direct questions. It is also easy to debug because every retrieved item is a source passage.',
        'The wall appears when the answer is distributed. A question may refer to an entity by alias, ask for a cross-document pattern, or depend on a relationship that no single chunk states cleanly. The retriever can return five good snippets while still failing to show how the snippets connect. More chunks can make the prompt longer without making the relation clearer.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is that graph records and vector records should be peers. The graph records capture extracted entities and relationships. The vector records preserve semantic lookup over chunks, entities, and relationships. A query can begin in one layer, expand through the other, and merge the results into a grounded context pack.',
        'The invariant is provenance. Every entity, relationship, embedding, and graph edge must trace back to source chunks. The graph layer is derived evidence, not truth by itself. If that trace is missing, graph retrieval can turn an extraction mistake into a confident answer.',
      ],
    },
    {
      heading: 'Indexing mechanism',
      paragraphs: [
        'Indexing starts with documents and keeps exact chunks available. The system then extracts entities and relationships from those chunks. Entities become graph nodes. Relationships become graph edges. Chunks, entities, and relationships can all receive vector representations so they can be ranked by semantic similarity as well as reached by graph traversal.',
        'The storage layout usually separates concerns. Key-value storage keeps chunks and extracted artifacts. Vector storage indexes embeddings. Graph storage keeps nodes and edges. Document-status storage records ingest progress, failures, and freshness. That separation matters because retrieval, provenance, graph expansion, and incremental update state have different access patterns.',
        'Incremental update is part of the mechanism, not a side feature. A changing corpus needs to know which chunks are new, which extracted records changed, which vectors are stale, which graph edges should be retired, and which document version a query is allowed to cite.',
      ],
    },
    {
      heading: 'Query mechanism',
      paragraphs: [
        'Query time begins by choosing a retrieval mode. Local mode is for questions anchored on specific entities. Global mode is for broader questions about themes or relationships across the corpus. Naive mode keeps direct chunk-vector search. Hybrid or mixed modes combine graph context with raw text chunks.',
        'The merge step is where the design becomes a system. Graph retrieval can surface a relationship path, but raw chunks still carry exact wording and citations. Vector search can find a semantically close passage, but graph expansion can reveal the neighboring entity that the passage implies. The answer path has to deduplicate, rank, trim, and cite context from both layers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'LightRAG works when the graph supplies a better search surface than chunks alone. Entity extraction can join scattered mentions under one node. Relationship extraction can expose a link that was spread across several passages. Vector retrieval still catches semantic matches when extraction is incomplete or when the query is really about wording.',
        'The correctness argument is a grounding argument. The system is not proving that the extracted graph is correct. It is making retrieval safer by keeping derived records tied to source chunks, then using the original text as answer evidence. A graph edge can suggest where to look; the cited source has to support the final claim.',
        'Mixed retrieval also reduces single-index blind spots. If vector search misses the right paragraph, graph expansion may reach it through an entity. If graph extraction misses a relationship, chunk search can still retrieve exact text. The system is stronger when failure in one layer does not silently decide the whole answer.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost starts at indexing. Entity extraction, relationship extraction, alias resolution, graph writes, vector writes, freshness tracking, and provenance storage all add work before the first query improves. The system is slower to build than flat RAG and has more ways to drift out of sync.',
        'Query latency can rise too. Graph expansion may pull too much context. Mixed retrieval needs deduplication and reranking. Authorization filters must apply before expansion and again before answer assembly, because a hidden document should not leak through an entity neighborhood.',
        'Evaluation is also harder. Local entity recall, global relationship recall, citation precision, answer faithfulness, freshness, and latency can move in different directions. A single average answer score can hide the fact that one retrieval mode improved while another got worse.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LightRAG-style retrieval wins in corpora where relationships matter: legal contracts, policy manuals, biomedical papers, security reports, research archives, enterprise wikis, and product documentation. It helps when users ask both local factual questions and broad pattern questions over the same material.',
        'A contract assistant is a concrete case study. What is the termination notice period in one agreement is a local question. Which vendors have termination rights tied to data-processing violations is a relationship question. A graph-plus-vector design can index clauses as chunks, vendors and obligations as entities, rights and dependencies as relationships, and cited text as final evidence.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The biggest failure mode is treating extracted graph records as facts. They are model-produced index artifacts and can be wrong. They need source links, confidence, versioning, and audit trails. A graph without provenance is a hallucination amplifier.',
        'A second limit is corpus shape. Exact identifiers, code symbols, short facts, and direct quotes may prefer lexical search or ordinary chunk retrieval. A small stable corpus may not justify graph extraction at all. A noisy corpus with weak entity resolution can create duplicate nodes and misleading edges.',
        'A third failure mode is hidden staleness. If updated documents do not retire old chunks, vectors, and graph edges together, retrieval can mix incompatible versions. That is worse than a simple miss because the answer can look well supported while citing stale context.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Start with a strong flat RAG baseline and add graph retrieval only for questions that the baseline cannot answer well. Write separate eval sets for entity-local questions, relationship questions, direct quote questions, and freshness-sensitive questions. Do not let a graph demo replace mode-specific measurement.',
        'Keep the source chain visible in the data model. Store document id, chunk id, extraction prompt or parser version, extracted record id, edge id, embedding version, and ingest status. When a cited answer is wrong, operators need to find whether the failure came from extraction, retrieval, merging, ranking, or generation.',
        'Treat permissions as part of retrieval. Filter candidate chunks, entities, and relationships by the caller before graph expansion can cross into protected material. Post-filtering only the final chunks is too late if the graph path already revealed a hidden fact.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        'The indexing view shows the artifact pipeline. Documents split into chunks. Extraction creates entity and relationship records. Those records and chunks become searchable through both graph and vector stores. The document-status record is the guard against querying partial or stale artifacts.',
        'The query-mode view shows why mode choice matters. Local graph retrieval helps entity questions. Global graph retrieval helps relationship questions. Naive chunk retrieval preserves exact source wording. Mixed retrieval is often the practical route because useful answers need both structure and text evidence.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: LightRAG paper at https://arxiv.org/abs/2410.05779, arXiv HTML at https://arxiv.org/html/2410.05779v1, official repository at https://github.com/HKUDS/LightRAG, project page at https://lightrag.github.io/, ACL PDF at https://aclanthology.org/2025.findings-emnlp.568.pdf, and OpenReview PDF at https://openreview.net/pdf?id=bbVH40jy7f.',
        'Study RAG Pipeline for the flat baseline, Query Expansion with HyDE and RAG-Fusion for retrieval repair, GraphRAG Community Summary Case Study and RAPTOR Hierarchical Retrieval Case Study for neighboring graph and hierarchy designs, Embeddings and Similarity plus HNSW for vector search, Reciprocal Rank Fusion and Cross-Encoder Reranker for merging, RAG Evaluation for measurement, and Zanzibar Authorization Case Study for permission-aware retrieval.',
      ],
    },
  ],
};
