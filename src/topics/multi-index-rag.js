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
    explanation: 'Read the fanout as a refusal to bet the whole answer on one geometry. Terms, embeddings, metadata, and graph links each catch a different kind of evidence, then the system reconciles them.',
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
    explanation: 'Fusion is the handoff between recall and precision. It keeps candidates from several indexes alive long enough for the slower reranker to make a better judgment.',
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
    explanation: 'The warning frame is the production lesson: a multi-index stack inherits every upstream data problem. Bad ACLs, stale chunks, duplicate copies, and weak packing can erase the benefit of better retrieval.',
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
      heading: 'Why This Exists',
      paragraphs: [
        'Multi-Index RAG exists because real retrieval questions do not come in one shape. Some questions hinge on exact identifiers, policy names, dates, error codes, or quoted phrases. Some are paraphrases that share meaning but not vocabulary. Some require access-control filters before any text is eligible. Others require a relationship hop from a person to a team, repository, account, ticket, product, or legal authority.',
        'A single vector index is a useful component, not a complete evidence system. Production RAG needs high recall before generation, precise context before prompting, and strict filtering before unauthorized evidence can enter the model. Multi-index retrieval fans a query out across complementary search surfaces, then fuses and reranks the candidates into a smaller evidence set.',
      ],
    },
    {
      heading: 'The Single-Index Trap',
      paragraphs: [
        'The obvious approach is to embed every chunk, embed the user question, retrieve nearest neighbors, and stuff the top results into the prompt. It is simple and often impressive in demos. It fails when the answer depends on an exact ID, a rare token, a recent document, a permission boundary, a table cell, or an entity relationship that the embedding space blurs.',
        'A pure keyword index has the opposite problem. It can find exact tokens and identifiers, but it misses paraphrases and conceptual matches. A graph can capture relationships, but it may miss the passage that actually states the answer. Metadata filters protect scope and freshness, but they do not rank meaning. The core mistake is asking one geometry to solve every retrieval failure mode.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is to separate coverage from judgment. First-stage retrievers are cheap, broad, and specialized. They should bring back plausible evidence from different angles. Fusion keeps enough of that evidence alive without pretending that BM25 scores, cosine similarities, learned sparse scores, and graph distances are directly comparable.',
        'Only after this recall phase should the system spend expensive computation on precision. A cross-encoder, late-interaction model, or LLM reranker can compare the query and candidate text more deeply than a vector dot product. Context packing then decides which selected chunks fit the prompt budget without burying the strongest evidence.',
      ],
    },
    {
      heading: 'Query Planning',
      paragraphs: [
        'A mature pipeline turns one user query into several retrieval requests. The raw text goes to lexical search. Expanded terms or learned sparse representations go to SPLADE-style search. An embedding goes to HNSW, ScaNN, DiskANN, FAISS, or another approximate nearest-neighbor index. Extracted entities can trigger graph expansion. Metadata becomes a filter for tenant, source, timestamp, document type, language, region, or access policy.',
        'Query planning also decides what not to do. A simple exact citation question may not need graph expansion. A private HR question must apply permissions before semantic search returns text. A fresh incident question may weight recent documents higher. The plan should be explainable enough that a failed answer can be traced to the retriever that missed the supporting evidence.',
      ],
    },
    {
      heading: 'Retrieval Surfaces',
      paragraphs: [
        'Lexical search protects rare words, quoted phrases, symbols, identifiers, and exact policy labels. Learned sparse retrieval protects vocabulary mismatch while keeping an inverted-index style execution model. Dense vector search protects semantic paraphrase. Metadata filters protect scope, freshness, tenancy, and compliance. Graph retrieval protects relationships that are not local to one chunk.',
        'Some systems add more surfaces. Code assistants use symbol tables, call graphs, file paths, imports, and commit metadata. Legal systems use citation graphs and authority levels. Document systems use OCR, tables, page regions, captions, and layout. The point is not to add every index. The point is to use each index for a failure class it can actually cover.',
      ],
    },
    {
      heading: 'Fusion',
      paragraphs: [
        'Fusion combines the ranked lists returned by first-stage retrievers. Raw score normalization is fragile because the scales mean different things. BM25 score, embedding cosine, graph distance, and sparse neural score are not measurements from one ruler. Rank-based fusion avoids much of that problem by rewarding high positions in each list.',
        'Reciprocal Rank Fusion is a strong baseline. Each candidate receives credit based on its rank in each list, often with a constant that softens the top positions. A document that appears near the top of several retrievers can beat a document that is first in only one retriever. That is a practical way to preserve broad agreement without hand-tuning score scales.',
      ],
    },
    {
      heading: 'Reranking',
      paragraphs: [
        'Reranking is where the pipeline trades speed for precision. The fused pool might contain 50, 100, or 200 candidates. A cross-encoder can jointly read the query and candidate and assign a more reliable relevance score. ColBERT-style late interaction keeps token-level matching signals that a single embedding would compress away. An LLM reranker can help when relevance depends on instructions, but it is slower and must be evaluated carefully.',
        'Reranking should feed context packing, not replace it. The final prompt needs enough diversity to answer multi-part questions, enough locality to preserve citations, and enough budget left for the generator. Maximal Marginal Relevance, source grouping, citation-span selection, and token-budget packing all matter after the top candidates have been chosen.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Multi-index RAG works because each layer has a narrower contract than "find the answer." Lexical search protects exact terms. Dense search protects paraphrase. Metadata protects scope. Graph expansion protects relationships. Fusion protects candidates that several weak signals agree on. Reranking protects precision after recall has done its job.',
        'The correctness intuition is not that more indexes are automatically better. It is that different retrieval failures have different causes. A single embedding can miss an invoice number; a keyword index can miss a paraphrase; a graph can miss the paragraph that states the answer. A layered system is safer when every added surface covers a real failure class and the logs can show which surface found the supporting evidence.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The visual fanout shows that the branches are complementary, not decorative. Terms catch exact labels. Learned sparse search catches related wording. Dense vectors catch paraphrase. Metadata keeps the search inside the allowed scope. Graph expansion follows relationships that chunk-local search may not see.',
        'The fusion-and-rerank view shows the contract between layers. First-stage indexes optimize recall under constraints. Fusion builds a candidate pool without comparing incompatible raw scores. Reranking spends heavier compute on a smaller set. Prompt packing turns final candidates into usable evidence. When an answer fails, this layering tells you where to debug.',
      ],
    },
    {
      heading: 'Evaluation',
      paragraphs: [
        'Multi-index RAG must be evaluated in layers. Retrieval recall asks whether the system found the supporting document at all. Fusion and reranking precision ask whether the right evidence rose near the top. Context packing asks whether the evidence survived into the prompt. Generation faithfulness asks whether the answer actually used the evidence instead of inventing support.',
        'A final-answer score alone is not enough. If the answer is wrong, you need to know whether the missing fact was absent from the index, filtered out, ranked too low, dropped by packing, or ignored by the model. Build held-out questions with known supporting passages and log which retriever found each passage.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'Extra indexes add ingestion work, storage, refresh complexity, observability burden, and tail latency. Lexical indexes need tokenization and postings. Vector indexes need embedding generation, compression, deletion handling, and recall tuning. Metadata filters need strict authorization semantics. Graph indexes need entity resolution and expansion limits so a query does not explode into the whole knowledge graph.',
        'The runtime path also gets harder to reason about. A slow index can dominate p95 latency. A stale index can beat the fresh one if fusion weights are wrong. Duplicate chunks can crowd out diverse evidence. The tradeoff is worthwhile only when the measured recall and answer quality gains justify the operational complexity.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Enterprise assistants over Slack, Google Drive, GitHub, Zendesk, Confluence, databases, and document stores usually become multi-index systems. The user may mention a ticket number, describe an issue in natural language, ask about a policy, or refer to a team relationship. No single index handles that mix well.',
        'Legal search combines exact citations, semantic passages, date filters, and authority graphs. Customer support combines product names with issue descriptions and entitlement filters. Code RAG combines lexical symbol search, embeddings, call graphs, and repository metadata. Multimodal document RAG adds layout, tables, OCR, and page-region grounding.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'More retrievers do not automatically improve answers. They can add stale documents, duplicate chunks, unauthorized evidence, and long prompts that bury the useful passage. Rank fusion can also hide problems: a document that appears moderately high everywhere may outrank the one precise source if the index plan is poorly tuned.',
        'The most dangerous failure is applying permissions too late. Unauthorized evidence should not be retrieved and merely hidden after generation. Another common failure is skipping deletion and freshness handling. RAG systems are often trusted because they feel grounded, but old or forbidden grounding can be worse than no grounding at all.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study RAG Pipeline first, then Query Expansion: HyDE and RAG-Fusion, Reciprocal Rank Fusion, SPLADE Learned Sparse Retrieval, Inverted Index, Embeddings and Similarity, HNSW Search, Product Quantization, ScaNN Vector Search, Filtered Vector Search and Bitset Gates, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, Maximal Marginal Relevance, and RAG Context Packing Token Budget.',
        'For production depth, continue with RAG Index Lifecycle and Alias Swap, RAG Dedup MinHash Chunk Canonicalization, RAG Citation Span Index, GraphRAG Community Summary, RAPTOR Hierarchical Retrieval, LightRAG Dual-Level Retrieval, ANN Recall-Latency Pareto Ledger, and RAG Evaluation with RAGAS and ARES. The main habit is to score the retrieval stack before blaming the generator.',
      ],
    },
  ],
};
