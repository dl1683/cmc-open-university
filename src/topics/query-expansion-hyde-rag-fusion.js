// Query expansion for RAG: rewrite the query, generate hypothetical documents,
// retrieve from several views, then fuse ranks before reranking.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'query-expansion-hyde-rag-fusion',
  title: 'Query Expansion: HyDE and RAG-Fusion',
  category: 'AI & ML',
  summary: 'How HyDE, multi-query rewriting, and RAG-Fusion widen retrieval recall before rank fusion and reranking narrow the evidence again.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['HyDE pivot', 'fusion tradeoffs'], defaultValue: 'HyDE pivot' },
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

function expansionGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'user intent' },
      { id: 'rewrite', label: 'rewrite', x: 2.4, y: 5.1, note: 'variants' },
      { id: 'hyde', label: 'HyDE doc', x: 2.4, y: 1.9, note: 'pseudo text' },
      { id: 'bm25', label: 'BM25', x: 4.1, y: 5.1, note: 'terms' },
      { id: 'vector', label: 'vector', x: 4.1, y: 1.9, note: 'meaning' },
      { id: 'rrf', label: 'RRF', x: 5.8, y: 3.5, note: 'fuse ranks' },
      { id: 'rerank', label: 'rerank', x: 7.4, y: 3.5, note: 'precision' },
      { id: 'context', label: 'context', x: 9.0, y: 3.5, note: 'evidence' },
    ],
    edges: [
      { id: 'e-query-rewrite', from: 'query', to: 'rewrite' },
      { id: 'e-query-hyde', from: 'query', to: 'hyde' },
      { id: 'e-rewrite-bm25', from: 'rewrite', to: 'bm25' },
      { id: 'e-rewrite-vector', from: 'rewrite', to: 'vector' },
      { id: 'e-hyde-vector', from: 'hyde', to: 'vector' },
      { id: 'e-bm25-rrf', from: 'bm25', to: 'rrf' },
      { id: 'e-vector-rrf', from: 'vector', to: 'rrf' },
      { id: 'e-rrf-rerank', from: 'rrf', to: 'rerank' },
      { id: 'e-rerank-context', from: 'rerank', to: 'context' },
    ],
  }, { title });
}

function* hydePivot() {
  yield {
    state: expansionGraph('Query expansion rewrites the problem before search'),
    highlight: { active: ['query', 'rewrite', 'hyde', 'e-query-rewrite', 'e-query-hyde'], compare: ['bm25', 'vector'] },
    explanation: 'Read the split as several guesses about the same intent. The raw query is preserved, rewrites expose alternate wording, and HyDE creates answer-shaped text only to steer dense retrieval.',
  };

  yield {
    state: labelMatrix(
      'Expansion types',
      [
        { id: 'raw', label: 'raw query' },
        { id: 'multi', label: 'multi-query' },
        { id: 'hyde', label: 'HyDE' },
        { id: 'fusion', label: 'RAG-Fusion' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['search as written', 'vocabulary mismatch'],
        ['paraphrase intent', 'query drift'],
        ['generate pseudo-doc', 'false details'],
        ['fuse result lists', 'latency and noise'],
      ],
    ),
    highlight: { active: ['multi:move', 'hyde:move', 'fusion:move'], compare: ['hyde:risk', 'fusion:risk'] },
    explanation: 'The HyDE row is a routing artifact, not a source. Its job is to land the embedding near real corpus documents that the short user query might not reach by itself.',
    invariant: 'Expanded queries are retrieval hints, not facts.',
  };

  yield {
    state: expansionGraph('HyDE pivots through a hypothetical document embedding'),
    highlight: { active: ['hyde', 'vector', 'e-hyde-vector'], found: ['context'], compare: ['query'] },
    explanation: 'The dense encoder acts as a bottleneck. False details in the generated pseudo-document should be filtered by nearest real corpus documents, but this only works when the corpus actually contains matching evidence and the encoder is robust.',
  };

  yield {
    state: labelMatrix(
      'Case: enterprise policy query',
      [
        { id: 'ask', label: 'user asks' },
        { id: 'rewrite', label: 'rewrite' },
        { id: 'hyde', label: 'HyDE doc' },
        { id: 'evidence', label: 'retrieved evidence' },
      ],
      [
        { id: 'content', label: 'content' },
        { id: 'role', label: 'role' },
      ],
      [
        ['can I cancel after renewal?', 'ambiguous intent'],
        ['annual renewal refund window', 'terms and synonyms'],
        ['policy paragraph about renewal cancellation', 'semantic bridge'],
        ['current policy section', 'only actual source'],
      ],
    ),
    highlight: { active: ['rewrite:role', 'hyde:role'], found: ['evidence:content'], removed: ['hyde:content'] },
    explanation: 'The assistant should never cite the HyDE document. It should cite the real policy section retrieved because the HyDE document made the vector search look in the right neighborhood.',
  };
}

function* fusionTradeoffs() {
  yield {
    state: labelMatrix(
      'RAG-Fusion candidate lists',
      [
        { id: 'q1', label: 'rewrite 1' },
        { id: 'q2', label: 'rewrite 2' },
        { id: 'q3', label: 'HyDE' },
        { id: 'q4', label: 'raw query' },
      ],
      [
        { id: 'rank1', label: 'rank 1' },
        { id: 'rank2', label: 'rank 2' },
        { id: 'rank3', label: 'rank 3' },
      ],
      [
        ['policy A', 'refund FAQ', 'billing guide'],
        ['refund FAQ', 'policy A', 'plan terms'],
        ['policy A', 'annual terms', 'billing guide'],
        ['billing guide', 'support article', 'policy A'],
      ],
    ),
    highlight: { found: ['q1:rank1', 'q2:rank2', 'q3:rank1', 'q4:rank3'], compare: ['q4:rank2'] },
    explanation: 'RAG-Fusion runs several query views, retrieves for each, then applies Reciprocal Rank Fusion or a similar rank aggregator. Documents that repeatedly appear near the top become strong candidates for reranking.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'number of query views', min: 1, max: 8 }, y: { label: 'relative value', min: 0, max: 1 } },
      series: [
        { id: 'recall', label: 'candidate recall', points: [{ x: 1, y: 0.45 }, { x: 2, y: 0.62 }, { x: 3, y: 0.73 }, { x: 5, y: 0.80 }, { x: 8, y: 0.84 }] },
        { id: 'noise', label: 'noise and latency', points: [{ x: 1, y: 0.15 }, { x: 2, y: 0.24 }, { x: 3, y: 0.36 }, { x: 5, y: 0.58 }, { x: 8, y: 0.86 }] },
      ],
    }),
    highlight: { active: ['recall'], compare: ['noise'] },
    explanation: 'The curve is the tradeoff to watch in production: early query views often add recall, but later views can add mostly cost, duplicate candidates, and reranker pressure.',
  };

  yield {
    state: expansionGraph('Fusion must still hand a small set to the expensive layer'),
    highlight: { active: ['rrf', 'rerank', 'context', 'e-rrf-rerank', 'e-rerank-context'], compare: ['rewrite', 'hyde'] },
    explanation: 'The precision layer still matters. RRF can put good candidates into the pool, but the cross-encoder, ColBERT reranker, or LLM reranker decides what fits the final context budget.',
  };

  yield {
    state: labelMatrix(
      'Evaluation slices',
      [
        { id: 'exact', label: 'exact terms' },
        { id: 'paraphrase', label: 'paraphrase' },
        { id: 'underspecified', label: 'underspecified' },
        { id: 'fresh', label: 'fresh policy' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['BM25 preserved?', 'rewrites drop IDs'],
        ['semantic recall?', 'single query misses'],
        ['clarifying need?', 'HyDE invents intent'],
        ['current chunk?', 'old source wins'],
      ],
    ),
    highlight: { active: ['exact:watch', 'paraphrase:watch', 'fresh:watch'], removed: ['underspecified:failure'] },
    explanation: 'Evaluate query expansion by slice. It should help paraphrases without damaging exact identifiers, current-policy retrieval, authorization filters, or user questions that should ask for clarification instead of searching.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'HyDE pivot') yield* hydePivot();
  else if (view === 'fusion tradeoffs') yield* fusionTradeoffs();
  else throw new InputError('Pick a query-expansion view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The HyDE pivot view shows the full expansion pipeline as a directed graph. Active nodes mark the current processing stage. The split from the query node into rewrite and HyDE doc branches shows two independent strategies running in parallel: lexical rewriting for BM25 and hypothetical document generation for dense retrieval. Found markers on the context node mean evidence has reached the generator.',
        'The fusion tradeoffs view shows ranked candidate lists from multiple query views, then a plot of recall versus noise as the number of views increases. The crossing point of those two curves is the practical limit: beyond it, adding more views costs more than it helps.',
        'In the matrix steps, active cells mark the strategic move each expansion type makes. Compare cells mark the corresponding risk. The pairing is deliberate: every recall gain has a failure mode. Read horizontally to evaluate one method, vertically to compare methods on the same axis.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retrieval-augmented generation fails silently when the right document never enters the candidate pool. The generator produces a confident answer from whatever evidence it receives, so a recall failure at retrieval time becomes an invisible correctness failure at generation time. The user sees a fluent response, not a search miss.',
        {
          type: 'quote',
          text: 'While hypothetical documents may contain false details, the embedding function is expected to be robust enough to map documents with similar semantics nearby, effectively filtering out the noise.',
          attribution: 'Gao et al., "Precise Zero-Shot Dense Retrieval without Relevance Labels" (HyDE), ACL 2023',
        },
        'Query expansion exists because users and corpora speak different languages about the same facts. A customer writes "can I cancel after renewal?" while the policy document says "annual subscription refund window after automatic renewal." A developer writes "the worker froze" while the incident log says "consumer heartbeat expired after broker rebalance." The vocabulary gap is not a bug in the retriever. It is a structural mismatch between how people ask questions and how institutions write answers.',
        'The idea is old. Rocchio (1971) expanded queries using pseudo-relevance feedback: retrieve an initial set, assume the top results are relevant, and shift the query vector toward their centroid. HyDE and RAG-Fusion are modern variants that use language models instead of term frequency to generate the expansion signal, but the core motivation is identical: the first query is rarely the best query.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is single-shot retrieval. Embed the user query, run approximate nearest-neighbor search against the vector index, optionally mix in BM25 scores, take the top-k chunks, and pass them to the generator. This works surprisingly well when the query and corpus share vocabulary: error codes, function names, policy identifiers, ticket numbers, statute references. In those cases, the raw query is the strongest retrieval signal, and rewriting it can only hurt.',
        'Many production RAG systems ship with exactly this pipeline and never add expansion. The approach is fast (one embedding call, one index lookup), cheap (no extra LLM calls), and predictable (same query always yields same results). For internal tooling where users know the corpus terminology, single-shot retrieval is often sufficient.',
        'The limit is vocabulary mismatch at scale. As the corpus grows across domains, authors, and time periods, the chance that a short user question lands near the right embedding neighborhood drops. Dense retrieval handles synonyms better than BM25, but a five-word question still produces a thin embedding that can miss documents phrased differently. The system works until someone asks a question in their own words instead of the corpus author\'s words, and then it fails without warning.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not slow retrieval or low precision. It is invisible recall failure. The right document exists in the corpus, the retriever returns results, the generator produces an answer, and the answer is wrong because the retriever never found the right chunk. There is no error message. The system looks healthy.',
        'This happens in three patterns. First, vocabulary mismatch: the user and the document use different words for the same concept. Second, query underspecification: a short question like "how do refunds work?" maps to a vague region in embedding space that is equidistant from many irrelevant documents. Third, asymmetric training: many embedding models are trained on query-document pairs where queries are well-formed, but real user questions are fragmentary, misspelled, or colloquial.',
        'BM25 cannot fix this because it matches exact terms, and the terms are different. Dense retrieval cannot fix this alone because the query embedding is too far from the target document embedding. The problem is geometric: the query lands in the wrong neighborhood, and no amount of reranking can recover a document that was never retrieved.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Query expansion creates multiple retrieval views from a single user question, retrieves candidates under each view, and fuses the results before reranking. The three main expansion strategies are multi-query rewriting, hypothetical document embedding (HyDE), and RAG-Fusion.',
        {
          type: 'diagram',
          text: 'User query: "can I cancel after renewal?"\n        |\n        +---> [raw query]  -------> embed -----> vector search ---+\n        |                                                         |\n        +---> [LLM rewrite] ------> "annual renewal refund       |\n        |      x3 variants           window cancellation policy"  |\n        |                     +----> embed -----> vector search ---+\n        |                     +----> BM25 ------> term search ----+\n        |                                                         |\n        +---> [LLM HyDE doc] -----> "Customers who wish to       |\n               hypothetical          cancel their subscription    |\n               answer passage        after automatic renewal      |\n                                     may request a refund..."     |\n                              +----> embed -----> vector search ---+\n                                                                  |\n                                          Reciprocal Rank Fusion <+\n                                                  |\n                                          Cross-encoder rerank\n                                                  |\n                                          Top-k context chunks',
          label: 'HyDE + multi-query + RAG-Fusion pipeline',
        },
        'Multi-query rewriting asks a language model to generate paraphrases or decompositions of the original question. Each variant uses different vocabulary, exposing alternate routes into the corpus. HyDE takes a different approach: instead of rewriting the question, it asks the LLM to draft a hypothetical answer passage. The passage may contain invented details, but its embedding lands in a region of vector space where real answer-like documents cluster. The generated text is a routing signal, not a source of truth.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Generate multiple query views for RAG-Fusion\nasync function generateQueryViews(userQuery, llm, numVariants = 3) {\n  const prompt = [\n    "Given this search query, generate " + numVariants,\n    "alternative phrasings that preserve the original intent",\n    "but use different vocabulary. Return one per line.",\n    "",\n    "Original: " + userQuery,\n  ].join("\\n");\n\n  const response = await llm.complete(prompt);\n  const rewrites = response.trim().split("\\n").filter(Boolean);\n\n  // Always include the raw query as one view\n  return [userQuery, ...rewrites.slice(0, numVariants)];\n}\n\n// Reciprocal Rank Fusion across multiple ranked lists\nfunction reciprocalRankFusion(rankedLists, k = 60) {\n  const scores = new Map();\n  for (const list of rankedLists) {\n    for (let rank = 0; rank < list.length; rank++) {\n      const docId = list[rank].id;\n      const prev = scores.get(docId) || 0;\n      scores.set(docId, prev + 1 / (k + rank + 1));\n    }\n  }\n  return [...scores.entries()]\n    .sort((a, b) => b[1] - a[1])\n    .map(([id, score]) => ({ id, score }));\n}',
        },
        'RAG-Fusion ties the pieces together. It runs retrieval for each query view independently, producing several ranked lists. Reciprocal Rank Fusion (RRF) merges the lists by giving each document a score of 1/(k + rank) for each list it appears in, then summing across lists. The constant k (typically 60) dampens the advantage of rank-1 results so that consistent appearance across multiple lists outweighs a single top ranking. After fusion, a cross-encoder or LLM reranker scores the top candidates against the original query, and the final context set goes to the generator.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Expansion works because it converts one thin probe into several independent probes that cover more of the embedding space. Each probe has a different vocabulary footprint, so the union of their retrievals is more likely to contain the target document than any single retrieval. The mechanism is coverage, not precision: expansion is a recall strategy, and the reranker downstream handles precision.',
        'HyDE works because of an asymmetry in how embedding models behave. A short question like "can I cancel?" produces a sparse, ambiguous embedding. A paragraph-length passage about cancellation policy produces a denser embedding in a better-defined neighborhood. The hypothetical document acts as a semantic bridge: it translates a fragmentary question into the kind of text the embedding model was trained to handle well. False details in the generated passage are filtered by the bottleneck of nearest-neighbor search, which returns real corpus documents, not the generated text itself.',
        {
          type: 'note',
          text: 'HyDE assumes the embedding model is more robust to factual errors than to brevity. This is true for many contrastive models trained on long document pairs, but it can fail with models trained primarily on short query-passage pairs. Always validate HyDE against your specific embedding model.',
        },
        'Fusion works because agreement across independent views is a strong relevance signal. If a document ranks high for the raw query, a paraphrase, and a HyDE embedding, it is probably relevant. A document that appears only in one expansion\'s results may be an artifact of query drift. RRF rewards consistency without requiring calibrated scores across different retrievers, which is why it works even when mixing BM25 scores with cosine similarities.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'LLM calls', 'Retrieval calls', 'Latency multiplier', 'Recall gain', 'Main risk'],
          rows: [
            ['Naive single query', '0', '1', '1x', 'baseline', 'Vocabulary mismatch'],
            ['Query expansion (rewrite)', '1', '2-4', '2-3x', 'Moderate', 'Query drift'],
            ['HyDE', '1', '1-2', '2-3x', 'High for paraphrases', 'Hallucinated routing'],
            ['RAG-Fusion', '1', '3-5', '3-5x', 'High', 'Latency + noise ceiling'],
            ['Multi-query + HyDE + Fusion', '2', '4-8', '4-8x', 'Highest', 'Diminishing returns past 4-5 views'],
          ],
        },
        'The dominant cost is LLM calls for expansion, not retrieval. Generating three paraphrases and one HyDE document requires one to two LLM calls, each adding 200-500ms of latency. Retrieval calls against a vector index are fast (10-50ms each), so running four retrievals in parallel barely changes wall-clock time. The real cost multiplier is sequential: LLM generation, then retrieval, then reranking. Each layer waits for the previous one.',
        'Doubling the number of query views does not double recall. The first two or three views typically capture most of the recall gain. Beyond five views, the curve flattens: new views mostly retrieve documents already in the pool, and the reranker budget stays fixed. The practical ceiling is 3-5 views for most production systems.',
        'Memory cost is proportional to the candidate pool size before deduplication. If each of 5 views retrieves 20 chunks, the pool holds up to 100 entries (fewer after dedup). The reranker must score all surviving candidates, so a larger pool means a more expensive reranking step. Cross-encoder rerankers scale quadratically with input length, making this the hidden cost bottleneck.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Enterprise support and policy search: users ask in casual language, documents use legal or institutional phrasing. Expansion bridges the register gap.',
            'Biomedical and legal literature: the same concept has multiple names across journals, jurisdictions, and time periods. Multi-query rewriting exposes synonyms that a single query misses.',
            'Educational tools and tutors: learners describe problems before they know the official term. A student searching for "saving previous attention values" needs expansion to find documents about KV caching.',
            'Incident knowledge bases: developers describe symptoms ("the worker froze") while runbooks describe causes ("consumer heartbeat expired after broker rebalance"). HyDE can generate a cause-shaped document from a symptom-shaped query.',
            'Cross-lingual and multi-dialect corpora: expansion in the source language, combined with multilingual embeddings, can reach documents in other languages without explicit translation.',
          ],
        },
        'The common thread is a corpus written by specialists and queried by non-specialists, or a corpus with many valid phrasings for the same concept. Expansion is most valuable when the system has a strong reranker downstream that can filter the wider candidate pool back to high-precision evidence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Query drift is the primary failure. A rewrite can shift the user\'s intent to a nearby but wrong meaning. "Can I cancel after renewal?" rewritten as "subscription cancellation policy" might retrieve general cancellation docs instead of the specific post-renewal refund clause. HyDE amplifies this risk: the generated passage may contain plausible but invented details that steer retrieval toward irrelevant neighborhoods.',
        'Expansion damages exact-match queries. If the user searches for error code "ERR_SSL_PROTOCOL_ERROR" or ticket number "JIRA-4521," rewriting those tokens into natural language destroys the strongest retrieval signal. A production system must detect exact identifiers and protect them from expansion.',
        {
          type: 'bullets',
          items: [
            'Authorization boundary leaks: expansion can broaden a query beyond the user\'s access scope unless filters are applied both before and after retrieval.',
            'Stale corpus routing: HyDE generates text reflecting current knowledge, which may confidently route toward outdated documents if the corpus has not been refreshed.',
            'False confidence on ambiguous queries: instead of asking for clarification, expansion papers over ambiguity by generating multiple guesses, producing a fluent answer to the wrong question.',
            'Context budget waste: if the generator has a fixed context window, a wider candidate pool may push good evidence out of the window, turning a recall gain into a generation loss.',
            'Latency in interactive settings: two extra LLM calls plus parallel retrievals plus reranking can push response time past user tolerance for conversational interfaces.',
          ],
        },
        'The meta-failure is treating expansion as free recall. Every added view increases the chance of including the right document, but also increases noise, latency, cost, and the burden on the reranker. A retrieval gain that disappears after reranking or context packing is not a product gain.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Role', 'Reference'],
          rows: [
            ['Gao et al., 2023', 'HyDE: hypothetical document embeddings for zero-shot dense retrieval', 'ACL 2023, arxiv.org/abs/2212.10496'],
            ['Rackauckas, 2023', 'RAG-Fusion: multi-query retrieval with reciprocal rank fusion', 'arxiv.org/abs/2402.03367'],
            ['Rocchio, 1971', 'Pseudo-relevance feedback: the original query expansion idea', 'The SMART Retrieval System, ch. 14'],
            ['Cormack et al., 2009', 'Reciprocal Rank Fusion formula and analysis', 'SIGIR 2009'],
          ],
        },
        'Study Embeddings and Similarity to understand why short queries produce weak embeddings. Study Reciprocal Rank Fusion for the mechanics of rank aggregation across lists. Study Cross-Encoder Reranker to see how the precision layer after fusion works. Study RAG Pipeline for the full retrieval-augmented generation architecture that expansion fits into. Study Inverted Index and BM25 for the sparse retrieval side that expansion must not break.',
        'For extensions, study Self-RAG for systems that decide when to retrieve at all, SPLADE Learned Sparse Retrieval for expansion via learned term weights instead of LLM rewriting, and Prompt Injection Threat Model for security risks when generated expansion text flows through the retrieval pipeline.',
      ],
    },
  ],
};

