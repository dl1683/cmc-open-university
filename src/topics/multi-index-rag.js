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
  const indexCount = 4;
  yield {
    state: pipeline('Production RAG fans out to multiple indexes'),
    highlight: { active: ['query', 'bm25', 'splade', 'vector', 'meta', 'e-q-bm25', 'e-q-splade', 'e-q-vector', 'e-q-meta'], compare: ['fusion', 'rerank'] },
    explanation: `Read the fanout to ${indexCount} indexes as a refusal to bet the whole answer on one geometry. Terms, embeddings, metadata, and graph links each catch a different kind of evidence, then the system reconciles them.`,
  };

  const queryShapes = 5;
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
    explanation: `Across ${queryShapes} query shapes, the right index depends on the question. A support bot asking about "SOC2-CC7.2" needs exact terms. A user asking a paraphrase needs Embeddings & Similarity. A permissions question may need graph context.`,
    invariant: `Retrieval coverage is a union problem across ${queryShapes} failure modes; ranking is a precision problem.`,
  };

  const fusionInputs = 3;
  yield {
    state: pipeline('Candidates are merged before the expensive judge'),
    highlight: { active: ['fusion', 'e-bm25-fusion', 'e-vector-fusion', 'e-graph-fusion'], found: ['rerank', 'prompt'] },
    explanation: `Fusion merges ${fusionInputs} ranked lists and is the handoff between recall and precision. It keeps candidates from several indexes alive long enough for the slower reranker to make a better judgment.`,
  };

  const evalMetrics = 4;
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
    explanation: `Multi-index RAG must be evaluated across ${evalMetrics} layers. If recall fails, add or fix retrievers. If precision fails, tune fusion and reranking. If faithfulness fails, the generator or prompt contract is broken.`,
  };
}

function* fusionAndRerank() {
  const retrieverCount = 3;
  const rankDepth = 4;
  yield {
    state: labelMatrix(
      `${retrieverCount} retrievers return different ranked lists`,
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
    explanation: `Raw scores from ${retrieverCount} indexes are not comparable. BM25 scores, cosine similarities, and graph distances live on different scales. Fusion methods work with ranks so the ${rankDepth}-deep lists can be combined without fragile normalization.`,
  };

  const docCount = 4;
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
    explanation: `RRF scores ${docCount} candidate documents by adding 1 / (k + rank) for each list position. Documents that appear near the top of several lists rise above documents that are only one retriever's favorite.`,
    invariant: `Fusion creates candidates from ${retrieverCount} sources; reranking decides final context.`,
  };

  const poolSize = 50;
  const contextSize = 5;
  const stages = 4;
  yield {
    state: labelMatrix(
      'A reranker spends more compute on fewer candidates',
      [
        { id: 'top50', label: `top ${poolSize} fused` },
        { id: 'cross', label: 'cross-encoder' },
        { id: 'final', label: `top ${contextSize} context` },
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
    explanation: `The reranker narrows ${poolSize} fused candidates to ${contextSize} across ${stages} stages. It can compare the query and chunk with richer interaction than a vector dot product. That is expensive, so it runs after cheap indexes have narrowed the pool.`,
  };

  const failureModes = 4;
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
    explanation: `The ${failureModes} failure modes are the production lesson: a multi-index stack inherits every upstream data problem. Bad ACLs, stale chunks, duplicate copies, and weak packing can erase the benefit of better retrieval.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The "hybrid retrieval" view shows a query fanning out to four parallel indexes: BM25 (lexical), SPLADE (learned sparse), vector ANN (dense), and metadata filters with optional graph hops. Active nodes are the retrievers currently executing. The edges carry what each retriever receives from the query and what it sends to fusion. Follow the fanout to see that no single path carries the full answer.',
        'The "fusion and rerank" view zooms into what happens after retrieval. Three ranked lists arrive with different orderings. Reciprocal Rank Fusion merges them by rank position, not raw score. The reranker then spends heavier compute on the fused pool. Found markers indicate documents that survived into the final prompt context.',
        'At each frame, read the matrix labels. The rows are query types or pipeline stages; the columns show which index wins and where each index fails. The invariant at the bottom of key frames states the contract that frame is proving.',
        {type: 'callout', text: 'Multi-index RAG is a recall contract: each index exists only when it rescues a failure mode the others miss.'},
      
        {type: 'image', src: './assets/gifs/multi-index-rag.gif', alt: 'Animated walkthrough of the multi index rag visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Real retrieval questions do not come in one shape. A support ticket asks about "SOC2-CC7.2" -- an exact identifier that embeddings blur into nearby policy language. A confused user asks "how do I get my money back?" -- a paraphrase that keyword search misses because the word "refund" never appears. A permissions question needs a graph hop from a person to their team to their entitlements. A compliance query must filter by tenant and date before any text is eligible.',
        {
          type: 'quote',
          text: 'Dense retrieval models can fail silently on entity-heavy queries, rare tokens, and negation, while sparse models fail on paraphrase and semantic similarity. The failures are complementary, not redundant.',
          attribution: 'Karpukhin et al., "Dense Passage Retrieval for Open-Domain Question Answering" (2020)',
        },
        'A single vector index is a useful component, not a complete evidence system. Production RAG needs high recall before generation, precise context before prompting, and strict filtering before unauthorized evidence enters the model. Multi-index retrieval fans a query out across complementary search surfaces, fuses and reranks the candidates, then packs the survivors into a prompt.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is pure dense retrieval: embed every chunk with a sentence transformer, embed the user query, retrieve the top-k nearest neighbors by cosine similarity, and stuff them into the prompt. It is simple, impressive in demos, and wrong often enough to matter.',
        'Dense-only retrieval works when every query is a semantic paraphrase of the answer passage. That covers a surprising range of questions, which is why the approach survives so long. Teams ship it, see good results on common questions, and assume retrieval is solved.',
        'The approach also scales cleanly. One embedding model, one vector index, one query path. No index synchronization, no fusion logic, no rank merging. The operational simplicity is real, not imaginary, and that is precisely why teams stay on it too long.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Dense retrieval starts with learned embeddings, so the retrieval stack inherits both the strength and the blind spots of neural representation. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the query depends on something embeddings compress away. Ask for "policy POL-2024-0371" and the embedding maps it near other policy documents, not to the one with that exact identifier. Ask "which team owns the billing-service repo?" and the embedding finds passages about billing, not the ownership record. Ask about a document updated yesterday and the embedding retrieves the stale version because cosine similarity has no timestamp axis.',
        {
          type: 'table',
          headers: ['Retrieval strategy', 'Exact tokens', 'Paraphrase', 'Freshness', 'Relationships', 'Permissions'],
          rows: [
            ['Dense only (vector)', 'Weak -- IDs blur', 'Strong', 'Blind', 'Misses hops', 'Not built in'],
            ['Sparse only (BM25)', 'Strong', 'Weak -- vocabulary gap', 'Blind', 'Misses hops', 'Not built in'],
            ['Hybrid (dense + sparse)', 'Better', 'Strong', 'Blind', 'Misses hops', 'Not built in'],
            ['Multi-index (full stack)', 'Strong', 'Strong', 'Metadata filter', 'Graph hops', 'Pre-retrieval filter'],
          ],
        },
        'The invariant is: retrieval coverage is a union problem across failure modes, not a single-geometry optimization. One embedding space cannot simultaneously preserve exact token identity, semantic similarity, temporal recency, graph relationships, and access-control boundaries. The wall is not performance -- it is representational. No amount of training data fixes the fact that cosine similarity has no axis for "this document was revoked yesterday."',
        'Once you see a retrieval failure that no amount of embedding tuning can fix -- an exact ID missed, a permission boundary violated, a stale document ranked first -- the single-index model is broken and adding indexes becomes necessary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A multi-index RAG pipeline has four stages: query planning, parallel retrieval, fusion, and reranking. Each stage has a narrow contract.',
        {
          type: 'diagram',
          label: 'Multi-index retrieval pipeline with reciprocal rank fusion',
          text: [
            '                         +--------+',
            '                    +--->| BM25   |---+',
            '                    |    +--------+   |',
            '     +-------+     |    +--------+   |    +--------+    +---------+    +--------+',
            '     | Query |-----+--->| SPLADE |---+--->| Fusion |--->| Reranker|--->| Prompt |',
            '     +-------+     |    +--------+   |    | (RRF)  |    | (cross- |    | packing|',
            '                   |    +--------+   |    +--------+    | encoder)|    +--------+',
            '                   +--->| Vector |---+        ^         +---------+',
            '                   |    | ANN    |            |',
            '                   |    +--------+            |',
            '                   |    +--------+    +-------+---+',
            '                   +--->| Meta   |--->| Graph hop |',
            '                        | filter |    +-----------+',
            '                        +--------+',
          ].join('\n'),
        },
        'Query planning turns one user query into several retrieval requests. The raw text goes to BM25. Expanded or learned sparse representations go to SPLADE. An embedding goes to HNSW or another ANN index. Extracted entities trigger graph expansion. Metadata becomes a pre-filter for tenant, timestamp, document type, or access policy. The plan also decides what to skip: a simple exact-match question may not need graph expansion; a private HR question must apply permissions before any semantic search runs.',
        'Parallel retrieval executes the planned requests. Each retriever returns a ranked list scored on its own scale -- BM25 term-frequency scores, cosine similarities, graph distances, sparse activation scores. These scales are incompatible, which is why fusion works on ranks, not raw scores.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Graph hops protect relationships that no flat chunk embedding can express, such as person-to-team-to-permission paths. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each layer has a narrower contract than "find the answer." BM25 protects exact terms. Dense search protects paraphrase. SPLADE bridges the vocabulary gap with learned term expansion. Metadata protects scope, freshness, and compliance. Graph hops protect relationships that no single chunk contains. Fusion protects candidates that multiple weak signals agree on. Reranking protects precision after recall has done its work.',
        'The correctness argument is not that more indexes are automatically better. It is that different retrieval failures have different causes, and those causes are structurally independent. An embedding compresses token identity; a keyword index lacks semantic generalization; a flat index lacks relational structure. A layered system is safer when every added surface covers a real, demonstrated failure class -- not a hypothetical one.',
        {
          type: 'note',
          text: 'The key design discipline is additive coverage, not additive complexity. Every index you add must cover a failure class you can demonstrate with a real query that the existing stack misses. If you cannot produce that query, the index is overhead.',
        },
        'Reciprocal Rank Fusion provides a simple, effective way to combine results without the fragile step of normalizing incompatible scores onto a common scale. A document ranked highly by three independent retrievers is more likely relevant than a document ranked first by only one. RRF captures this agreement signal with a formula that requires no learned weights and no score calibration.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each index adds ingestion work, storage, synchronization overhead, and a new failure surface. The costs are concrete.',
        {
          type: 'table',
          headers: ['Index type', 'Ingestion cost', 'Storage', 'Query latency', 'Maintenance burden'],
          rows: [
            ['BM25 (inverted index)', 'Tokenization + postings', 'Moderate', '~1-5 ms', 'Low -- mature tooling'],
            ['SPLADE (learned sparse)', 'Model inference per chunk', 'Moderate (sparse vectors)', '~5-15 ms', 'Model versioning, reindexing'],
            ['Dense vector (HNSW)', 'Embedding generation', 'High (float vectors + graph)', '~5-20 ms', 'Recall tuning, deletion handling'],
            ['Metadata filter', 'Schema extraction', 'Low', '~1 ms (pre-filter)', 'ACL sync, schema evolution'],
            ['Graph index', 'Entity resolution + linking', 'Variable', '~10-50 ms (with hops)', 'Entity drift, expansion limits'],
            ['Cross-encoder reranker', 'None (query-time only)', 'Model weights', '~50-200 ms for top-50', 'Model updates, latency budget'],
          ],
        },
        'The runtime path gets harder to reason about with each added index. A slow retriever dominates p95 latency unless you set per-index timeouts. A stale index can beat a fresh one if fusion weights are wrong. Duplicate chunks from different indexes can crowd out diverse evidence in the prompt.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Reciprocal Rank Fusion (RRF) -- Cormack et al., 2009',
            '// k is a smoothing constant (typically 60); it prevents',
            '// top-ranked documents from dominating the fused score.',
            'function reciprocalRankFusion(rankedLists, k = 60) {',
            '  const scores = new Map();',
            '  for (const list of rankedLists) {',
            '    for (let rank = 0; rank < list.length; rank++) {',
            '      const docId = list[rank];',
            '      const prev = scores.get(docId) || 0;',
            '      scores.set(docId, prev + 1 / (k + rank + 1));',
            '    }',
            '  }',
            '  return [...scores.entries()]',
            '    .sort((a, b) => b[1] - a[1])',
            '    .map(([docId, score]) => ({ docId, score }));',
            '}',
            '',
            '// Example: three retrievers return different top-4 lists',
            'const bm25   = ["policy-17", "refund-guide", "plan-table", "billing-faq"];',
            'const vector = ["refund-guide", "policy-17", "upgrade-faq", "plan-table"];',
            'const graph  = ["account-owner", "billing-team", "refund-guide", "policy-17"];',
            '',
            'const fused = reciprocalRankFusion([bm25, vector, graph]);',
            '// refund-guide:  1/61 + 1/61 + 1/63 = 0.0485  (top -- agreed by all three)',
            '// policy-17:     1/61 + 1/62 + 1/64 = 0.0480  (close second)',
            '// plan-table:    1/63 + 1/64         = 0.0315  (two lists only)',
            '// account-owner: 1/61                 = 0.0164  (graph favorite, others miss)',
          ].join('\n'),
        },
        'The RRF formula reveals the core tradeoff: broad agreement across retrievers outweighs strong conviction from a single retriever. A document that is rank 1 in one list but absent from the others scores 1/(k+1). A document that is rank 3 in all three lists scores 3/(k+3), which is higher for any k > 0. This is the mechanism that makes multi-index retrieval more than the sum of its parts.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Enterprise assistants that span Slack, Google Drive, GitHub, Zendesk, Confluence, and internal databases become multi-index systems because the query mix demands it. A user might mention a ticket number (exact match), describe a bug in natural language (semantic), ask about team ownership (graph), or request documents from the last quarter (metadata filter). No single index handles that mix.',
        'Legal search combines exact statute citations, semantic passage retrieval, date filters, and authority-level graphs. Customer support combines product identifiers with natural-language issue descriptions and entitlement filters. Code RAG combines lexical symbol search, embeddings over documentation, call-graph traversal, and repository metadata. Multimodal document RAG adds layout parsing, table extraction, OCR, and page-region grounding.',
        {
          type: 'bullets',
          items: [
            'ColBERT late interaction: keeps per-token embeddings so the reranker can match "refund" in the query to "reimbursement" in the passage at token level, catching matches that a single-vector dot product compresses away. Useful as either a first-stage retriever or a reranker.',
            'SPLADE learned sparse retrieval: a neural model that expands terms into a sparse vector, bridging the vocabulary gap while keeping inverted-index execution speed. Fills the space between BM25 (exact terms only) and dense vectors (no term-level transparency).',
            'Chunking strategy matters: overlapping fixed-size chunks lose document structure; semantic chunking by paragraph or section preserves it but creates uneven sizes. Hierarchical chunking (document summary + section + paragraph) lets different retrievers operate at different granularities.',
          ],
        },
        'The common pattern across all these domains: the query distribution is heterogeneous, and each failure class maps to a different index type. Multi-index RAG wins when you can demonstrate specific queries that each index uniquely rescues.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'More retrievers do not automatically improve answers. They can introduce stale documents, duplicate chunks, unauthorized evidence, and bloated prompts that bury the one passage the model needs. Rank fusion can mask problems: a mediocre document that appears at rank 5 in every list outscores the one correct document that appears at rank 1 in only one list.',
        'The most dangerous failure is applying permissions too late. If unauthorized evidence enters the retrieval pool and reaches the generator, the model may quote it in its answer even if a post-generation filter tries to redact it. Access control must be a pre-filter on retrieval, not a post-filter on output.',
        {
          type: 'bullets',
          items: [
            'Stale indexes: a document is updated but the old embedding and old BM25 postings remain. The stale version wins on fusion because it matches the old wording. Fix: tombstone-and-reindex on every update, not batch reindex on a schedule.',
            'Duplicate chunks: the same paragraph appears in three source documents. All three copies enter the fused pool, crowding out diverse evidence. Fix: content-hash deduplication before fusion.',
            'Reranker latency: a cross-encoder over 200 candidates at 1 ms per pair adds 200 ms to every query. Fix: cap the fusion pool (top-50 is common) and monitor p95.',
            'Index drift: retrievers are updated on different schedules. The vector index reflects last week; BM25 reflects today. Fusion treats their outputs as equally fresh. Fix: attach freshness metadata and penalize stale sources in fusion.',
          ],
        },
        'The operational lesson: a multi-index stack inherits every upstream data-quality problem. Bad ACLs, stale chunks, duplicate copies, inconsistent schemas, and weak deletion handling can erase the benefit of better retrieval architecture. The retrieval stack must be evaluated layer by layer, not just by final answer quality.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Cormack, Clarke, and Butt, "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods" (2009) -- the original RRF paper establishing rank-based fusion as a strong baseline.',
            'Karpukhin et al., "Dense Passage Retrieval for Open-Domain Question Answering" (2020) -- demonstrates dense retrieval strengths and documents where it fails against sparse methods.',
            'Formal et al., "SPLADE: Sparse Lexical and Expansion Model for First Stage Ranking" (2021) -- learned sparse retrieval bridging the gap between BM25 and dense vectors.',
            'Khattab and Zaharia, "ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT" (2020) -- late interaction that preserves token-level matching signals.',
          ],
        },
        'Prerequisites: study Inverted Index, Embeddings and Similarity, and HNSW Search to understand the retrieval surfaces before combining them. Extensions: Reciprocal Rank Fusion, SPLADE Learned Sparse Retrieval, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, Filtered Vector Search and Bitset Gates, and RAG Context Packing Token Budget.',
        'For production depth: RAG Index Lifecycle and Alias Swap (index refresh without downtime), RAG Dedup MinHash Chunk Canonicalization (duplicate elimination), GraphRAG Community Summary (graph-augmented retrieval), and RAG Evaluation with RAGAS and ARES (layered evaluation). The main habit is to score the retrieval stack layer by layer before blaming the generator.',
      ],
    },
  ],
};
