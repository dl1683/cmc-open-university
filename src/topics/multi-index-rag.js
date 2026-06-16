// Multi-index RAG: combine lexical, vector, metadata, and graph retrieval
// before reranking and generation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-index-rag',
  title: 'Multi-Index RAG',
  category: 'AI & ML',
  summary: 'How production RAG systems fuse BM25, vector search, filters, graph edges, and rerankers instead of trusting one index.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hybrid retrieval', 'fusion and rerank'], defaultValue: 'hybrid retrieval' },
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

function pipeline(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.6, y: 3.6, note: 'user intent' },
      { id: 'bm25', label: 'BM25', x: 2.5, y: 1.1, note: 'terms' },
      { id: 'splade', label: 'SPLADE', x: 2.5, y: 2.5, note: 'sparse' },
      { id: 'vector', label: 'vector ANN', x: 2.5, y: 3.6, note: 'meaning' },
      { id: 'meta', label: 'metadata', x: 2.5, y: 5.8, note: 'filters' },
      { id: 'graph', label: 'graph hop', x: 4.6, y: 5.8, note: 'relations' },
      { id: 'fusion', label: 'fusion', x: 5.3, y: 2.5, note: 'rank merge' },
      { id: 'rerank', label: 'reranker', x: 7.1, y: 2.5, note: 'judge' },
      { id: 'prompt', label: 'prompt', x: 8.8, y: 3.6, note: 'context' },
    ],
    edges: [
      { id: 'e-q-bm25', from: 'query', to: 'bm25', weight: 'keywords' },
      { id: 'e-q-splade', from: 'query', to: 'splade', weight: 'learned terms' },
      { id: 'e-q-vector', from: 'query', to: 'vector', weight: 'embedding' },
      { id: 'e-q-meta', from: 'query', to: 'meta', weight: 'scope' },
      { id: 'e-meta-graph', from: 'meta', to: 'graph', weight: 'entities' },
      { id: 'e-bm25-fusion', from: 'bm25', to: 'fusion', weight: 'ranked list' },
      { id: 'e-splade-fusion', from: 'splade', to: 'fusion', weight: 'ranked list' },
      { id: 'e-vector-fusion', from: 'vector', to: 'fusion', weight: 'ranked list' },
      { id: 'e-graph-fusion', from: 'graph', to: 'fusion', weight: 'neighbors' },
      { id: 'e-fusion-rerank', from: 'fusion', to: 'rerank', weight: 'top candidates' },
      { id: 'e-rerank-prompt', from: 'rerank', to: 'prompt', weight: 'evidence' },
    ],
  }, { title });
}

function* hybridRetrieval() {
  yield {
    state: pipeline('Production RAG fans out to multiple indexes'),
    highlight: { active: ['query', 'bm25', 'splade', 'vector', 'meta', 'e-q-bm25', 'e-q-splade', 'e-q-vector', 'e-q-meta'], compare: ['fusion', 'rerank'] },
    explanation: 'A single retriever sees one kind of evidence. Lexical search catches exact names and rare terms. SPLADE adds learned sparse expansion on postings. Vector search catches paraphrase. Metadata filters enforce scope. Graph hops recover relationships. Production RAG fans out, then reconciles.',
  };

  yield {
    state: labelMatrix(
      'Each index wins on a different query shape',
      [
        { id: 'exact', label: 'policy id' },
        { id: 'sparse', label: 'vocab gap' },
        { id: 'semantic', label: 'paraphrase' },
        { id: 'fresh', label: 'fresh doc' },
        { id: 'entity', label: 'entity rel' },
      ],
      [
        { id: 'best', label: 'best first' },
        { id: 'failure', label: '1-index fail' },
      ],
      [
        ['inverted idx', 'blurs IDs'],
        ['SPLADE terms', 'postings grow'],
        ['HNSW ANN', 'keywords miss'],
        ['metadata', 'stale wins'],
        ['graph hop', 'misses links'],
      ],
    ),
    highlight: { active: ['exact:best', 'sparse:best', 'semantic:best', 'fresh:best', 'entity:best'] },
    explanation: 'The right index depends on the question. A support bot asking about "SOC2-CC7.2" needs exact terms. A user asking a paraphrase needs Embeddings & Similarity. A permissions question may need graph context.',
    invariant: 'Retrieval coverage is a union problem; ranking is a precision problem.',
  };

  yield {
    state: pipeline('Candidates are merged before the expensive judge'),
    highlight: { active: ['fusion', 'e-bm25-fusion', 'e-vector-fusion', 'e-graph-fusion'], found: ['rerank', 'prompt'] },
    explanation: 'Rank fusion builds a candidate pool that is broader than any single index. The reranker then spends a slower cross-encoder or LLM judgment only on a small top-k list.',
  };

  yield {
    state: labelMatrix(
      'Index composition changes the evaluation plan',
      [
        { id: 'recall', label: 'retr recall' },
        { id: 'precision', label: 'rerank nDCG' },
        { id: 'faith', label: 'faithful?' },
        { id: 'latency', label: 'latency' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'why', label: 'why' },
      ],
      [
        ['found support?', 'missing facts'],
        ['top fit?', 'noise buries'],
        ['used evidence?', 'decor cites'],
        ['time split', 'cost+p95'],
      ],
    ),
    highlight: { found: ['recall:measure', 'precision:measure', 'faith:measure', 'latency:measure'] },
    explanation: 'Multi-index RAG must be evaluated in layers. If recall fails, add or fix retrievers. If precision fails, tune fusion and reranking. If faithfulness fails, the generator or prompt contract is broken.',
  };
}

function* fusionAndRerank() {
  yield {
    state: labelMatrix(
      'Three retrievers return different ranked lists',
      [
        { id: 'rank1', label: 'rank 1' },
        { id: 'rank2', label: 'rank 2' },
        { id: 'rank3', label: 'rank 3' },
        { id: 'rank4', label: 'rank 4' },
      ],
      [
        { id: 'bm25', label: 'BM25' },
        { id: 'vector', label: 'vector' },
        { id: 'graph', label: 'graph' },
      ],
      [
        ['policy-17', 'refund guide', 'account owner'],
        ['refund guide', 'policy-17', 'billing team'],
        ['plan table', 'upgrade FAQ', 'refund guide'],
        ['billing FAQ', 'plan table', 'policy-17'],
      ],
    ),
    highlight: { active: ['rank1:bm25', 'rank2:vector', 'rank3:graph'], compare: ['rank4:bm25', 'rank4:vector'] },
    explanation: 'Raw scores from different indexes are not comparable. BM25 scores, cosine similarities, and graph distances live on different scales. Fusion methods work with ranks so the lists can be combined without fragile normalization.',
  };

  yield {
    state: labelMatrix(
      'Reciprocal Rank Fusion rewards broad agreement',
      [
        { id: 'policy', label: 'policy-17' },
        { id: 'refund', label: 'refund guide' },
        { id: 'plan', label: 'plan table' },
        { id: 'owner', label: 'account owner' },
      ],
      [
        { id: 'bm25', label: 'BM25 rank' },
        { id: 'vector', label: 'vector rank' },
        { id: 'graph', label: 'graph rank' },
        { id: 'rrf', label: 'fused' },
      ],
      [
        ['1', '2', '4', 'very high'],
        ['2', '1', '3', 'very high'],
        ['3', '4', 'not found', 'medium'],
        ['not found', 'not found', '1', 'medium'],
      ],
    ),
    highlight: { found: ['policy:rrf', 'refund:rrf'], compare: ['owner:rrf'] },
    explanation: 'RRF adds a small score for each list position, commonly 1 / (k + rank). Documents that appear near the top of several lists rise above documents that are only one retriever\'s favorite.',
    invariant: 'Fusion creates candidates; reranking decides final context.',
  };

  yield {
    state: labelMatrix(
      'A reranker spends more compute on fewer candidates',
      [
        { id: 'top50', label: 'top 50 fused' },
        { id: 'cross', label: 'cross-encoder' },
        { id: 'final', label: 'top 5 context' },
        { id: 'prompt', label: 'answer prompt' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['candidate pool', 'high recall'],
        ['joint score', 'precision'],
        ['fit budget', 'avoid stuffing'],
        ['cite answer', 'grounded'],
      ],
    ),
    highlight: { active: ['top50:action', 'cross:action', 'final:action'], found: ['prompt:reason'] },
    explanation: 'The reranker can compare the query and chunk with richer interaction than a vector dot product. That is expensive, so it runs after cheap indexes have narrowed the pool.',
  };

  yield {
    state: labelMatrix(
      'Operational failure modes',
      [
        { id: 'stale', label: 'stale chunks' },
        { id: 'dup', label: 'duplicates' },
        { id: 'acl', label: 'ACL leak' },
        { id: 'budget', label: 'context budget' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['old wins', 'fresh+tomb'],
        ['dup source', 'dedupe doc'],
        ['unauth ev', 'filter first'],
        ['buried', 'diversify'],
      ],
    ),
    highlight: { active: ['stale:fix', 'dup:fix', 'acl:fix', 'budget:fix'] },
    explanation: 'Multi-index systems fail quietly if ingestion, authorization, dedupe, and context packing are weak. Retrieval quality is a data pipeline property, not just a vector database setting.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hybrid retrieval') yield* hybridRetrieval();
  else if (view === 'fusion and rerank') yield* fusionAndRerank();
  else throw new InputError('Pick a multi-index RAG view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Multi-Index RAG is the production version of RAG Pipeline. Instead of embedding the question once and trusting a single vector index, the system can first use Query Expansion: HyDE and RAG-Fusion to create several query views, then query several retrieval surfaces: an Inverted Index for exact terms, SPLADE Learned Sparse Retrieval for neural term expansion on postings, HNSW (Vector Search at Scale) or ScaNN-style compressed ANN for semantic similarity, metadata filters for scope and freshness, graph expansion for linked entities, and sometimes a late-interaction or cross-encoder reranker. The goal is to combine high recall with precise final context.',
        'This pattern exists because real user questions are mixed. Some hinge on exact identifiers, product names, dates, or error codes. Others are paraphrases. Some require access-control filters before search. Others require a hop from a person to a team, repository, ticket, policy, or account. One index rarely handles all of those well.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The query is normalized into several forms: raw text for lexical search, generated variants for query expansion, a HyDE-style pseudo-document when useful, an embedding for vector search, metadata constraints for filtering, and entity mentions for graph expansion. Each index returns a ranked list. Because their scores are not on the same scale, systems often fuse by rank rather than score. Reciprocal Rank Fusion is the simple baseline: a document gets credit for appearing high in any list and extra credit for appearing in several lists.',
        'After fusion, a reranker spends more compute on the smaller candidate pool. ColBERT-style late interaction, Cross-Encoder Reranker models, or LLM rerankers compare the query and candidate chunks more directly than a single vector dot product. Maximal Marginal Relevance can then diversify near-duplicate chunks, and RAG Context Packing Token Budget decides what fits into the final prompt.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The extra indexes improve coverage but add ingest cost, storage cost, latency, and evaluation complexity. Lexical segments need tokenization and postings. Vector indexes need embedding refresh, Product Quantization for Vector Search or other compression at scale, and deletion handling. Metadata filters must be applied before unauthorized text reaches the model. Graph expansion needs entity resolution and limits to avoid exploding the candidate set.',
        'Evaluation must split retrieval recall from rerank precision and answer faithfulness. A generator can only answer from evidence that retrieval found. A reranker can only choose among candidates it receives. A citation can still be decorative if the model did not actually use the cited passage. Cross-Validation & Honest Evaluation is the right discipline: maintain held-out questions with known supporting documents.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Enterprise assistants over Slack, Google Drive, GitHub, Zendesk, Confluence, databases, and document stores usually become multi-index systems. Legal search combines exact citations, semantic passages, date filters, and authority graphs. Customer-support search combines keyword product names with semantic issue descriptions. Code RAG combines lexical symbol search, embeddings, call graphs, and repository metadata.',
        'Visually rich documents add another retrieval surface. PDFs, slides, forms, charts, and tables can encode answers in layout rather than text order. Multimodal RAG & ColPali Case Study extends this same fanout-and-fusion pattern to page images, OCR, table cells, visual patches, and region-level grounding.',
        'Long and relational documents add a different pressure. RAPTOR Hierarchical Retrieval Case Study builds a tree of cluster summaries above raw chunks. GraphRAG Community Summary Case Study builds entity and community structure. LightRAG Dual-Level Retrieval Case Study keeps graph records and vector records active together so local entity questions and global relationship questions can share the same retrieval fabric.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'More retrievers do not automatically improve answers. They can add duplicate chunks, stale documents, unauthorized evidence, and longer prompts that bury the useful passage. Another mistake is normalizing raw scores from different systems as if they meant the same thing. Rank fusion is often more robust because it avoids comparing BM25 scores to cosine similarities directly. The largest pitfall is skipping layer-by-layer evaluation and only scoring final answers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks at https://arxiv.org/abs/2005.11401, Reciprocal Rank Fusion at https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/, the RRF PDF at https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf, and ColBERTv2 at https://arxiv.org/abs/2112.01488. Study RAG Pipeline, Query Expansion: HyDE and RAG-Fusion, Reciprocal Rank Fusion, SPLADE Learned Sparse Retrieval, Maximal Marginal Relevance, RAG Context Packing Token Budget, Inverted Index, RAG Index Lifecycle and Alias Swap, RAG Dedup, MinHash, and Chunk Canonicalization, RAG Citation Span Index Case Study, Filtered Vector Search and Bitset Gates, HNSW (Vector Search at Scale), Product Quantization for Vector Search, ScaNN Vector Search Case Study, ANN Recall-Latency Pareto Ledger, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, LightRAG Dual-Level Retrieval Case Study, Embeddings & Similarity, and Tokenization (BPE) next.',
      ],
    },
  ],
};
