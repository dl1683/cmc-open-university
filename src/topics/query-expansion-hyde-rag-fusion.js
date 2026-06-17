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
      heading: `What it is`,
      paragraphs: [
        `Query expansion is the retrieval step that admits the user's first wording may not be the best wording for search. In a retrieval-augmented generation system, the user question is usually short, underspecified, and written in everyday language. The corpus may use policy names, product terms, abbreviations, legal clauses, table headings, or internal jargon. If the retriever searches only the raw question, the answer can fail before the language model ever sees evidence. Query expansion creates additional search views that preserve the original intent while giving the retrieval system more ways to find matching documents.`,
        `HyDE and RAG-Fusion are two important forms of this idea. HyDE, or Hypothetical Document Embeddings, asks a language model to draft an answer-shaped or document-shaped passage, embeds that generated passage, and retrieves real corpus documents near it in embedding space. RAG-Fusion generates several query variants, retrieves candidates for each variant, and combines the ranked lists with a method such as Reciprocal Rank Fusion. Both techniques widen recall before a reranker narrows the final context. The expanded text is a search instrument, not evidence.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious RAG pipeline embeds the user's query once, runs nearest-neighbor search, maybe mixes in BM25, and hands the top chunks to the generator. This works when the query and corpus share vocabulary. It also works when the question contains exact anchors such as error codes, policy identifiers, function names, ticket numbers, statutes, or part numbers. In those cases, changing the query can hurt because the exact token was the strongest clue. Raw-query retrieval must therefore remain part of the system.`,
        `The wall appears when the user and corpus describe the same thing with different language. A customer asks, "Can I cancel after renewal?" The policy page may say "annual subscription refund window after automatic renewal." A developer asks why "the worker froze," while the incident log says "consumer heartbeat expired after broker rebalance." Dense retrieval helps with meaning, but short questions can still land in a weak region of embedding space. Sparse retrieval preserves exact words, but it cannot match missing synonyms. Query expansion is the attempt to cross that vocabulary gap without throwing away exact search.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that a retrieval query can be treated as a probe, not as a statement of fact. A probe can be rewritten, decomposed, broadened, or made more document-like if that helps it collide with the right evidence. A human researcher does this naturally. If one search for "cancel after renewal" is poor, the next search might include "refund window," "automatic renewal," "annual plan," and "terms of service." Query expansion automates that search behavior and makes it available inside the RAG pipeline.`,
        `HyDE pushes the idea further by generating a hypothetical passage instead of a paraphrase. The passage may sound like an answer, but its job is geometric. An answer-shaped paragraph contains terms, structure, and semantic cues that can place the embedding near real documents that a terse question missed. RAG-Fusion adds a second insight: no single expansion needs to be trusted. Run several views, rank documents under each view, then reward documents that repeatedly appear near the top. Repetition across independent views is a useful signal.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `A production expansion pipeline usually starts by classifying the query shape. If the query contains exact identifiers, those tokens are protected. If the query is ambiguous, the system may ask a clarifying question instead of expanding. Otherwise, the pipeline creates several views: the raw query, one or more paraphrases, possibly subqueries for separate constraints, and sometimes a HyDE document. Each view is sent through one or more retrievers, such as BM25 for lexical matches, a dense vector index for semantic matches, SPLADE-style learned sparse retrieval for expansion terms, or a domain-specific index.`,
        `The result is a candidate pool with duplicates, conflicting ranks, and uneven quality. RAG-Fusion commonly uses Reciprocal Rank Fusion because it is simple and robust: a document gets credit for appearing high in any list, and repeated appearances accumulate. After fusion, a deduplication step collapses near-identical chunks. A cross-encoder, ColBERT reranker, or LLM reranker then scores the surviving candidates against the original user intent. Finally, a context packer chooses a small, source-grounded evidence set for generation. The original question, generated views, retrieved document IDs, ranks, fusion scores, and final citations should all be traceable.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Query expansion works when the main failure is recall. RAG systems are often bottlenecked by candidate generation. If the right chunk never reaches the reranker, no amount of careful generation can recover it. Expansion increases the chance that the right chunk appears somewhere in the candidate pool. The best expansions add alternate vocabulary, expose hidden constraints, and move the search closer to the corpus while preserving the raw query for exact matching.`,
        `HyDE works best when the embedding model represents answer-like passages more reliably than fragmentary questions. Many embedding models are trained on pairs of queries and documents, but real user questions can be messy. A generated passage can contain the kind of language that real documents contain, so its embedding becomes a bridge. Fusion works because independent weak signals can become strong when they agree. A document that ranks second for a paraphrase, fourth for HyDE, and third for the raw query deserves more attention than a document that appears once because one expansion drifted.`,
      ],
    },
    {
      heading: `Where it is useful`,
      paragraphs: [
        `The clearest use cases are support assistants, enterprise search, legal and policy retrieval, biomedical literature search, technical documentation, educational tutors, and incident knowledge bases. These domains contain many semantically equivalent phrasings. They also contain documents written for specialists while users ask in casual language. Expansion is useful when the system can tolerate a larger candidate pool and has a strong reranker or evidence filter downstream.`,
        `It is also useful for curriculum and research tools because learners often know the problem but not the official term. A student may ask about "searching several indexes and combining answers" before knowing the phrase Reciprocal Rank Fusion. A developer may ask about "saving previous attention values" before knowing KV Cache. Expansion can map from novice language to expert vocabulary. The same benefit applies in multilingual or cross-dialect corpora, though those settings require careful evaluation instead of assuming paraphrases transfer cleanly.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The largest failure is query drift. A rewrite can replace the user's actual intent with a nearby but wrong intent. HyDE can invent details that steer retrieval toward plausible but irrelevant documents. Expansion can also damage exact search by removing identifiers, dates, quoted phrases, citations, or code symbols. In security and compliance settings, it can accidentally broaden a query beyond the user's authorization boundary unless filters are applied before and after retrieval.`,
        `Expansion also costs latency and money. It may require extra language-model calls, extra index lookups, larger candidate sets, more deduplication, and heavier reranking. If the downstream context budget is fixed, improved candidate recall may not improve answers because good evidence still gets truncated. If the corpus is stale, HyDE can confidently route toward old documents. If the question should have been clarified, expansion can create a false sense of certainty. These are system failures, not just prompt failures.`,
      ],
    },
    {
      heading: `Evaluation signals and study next`,
      paragraphs: [
        `Evaluate expansion by slice. Track recall@k and nDCG for paraphrase questions, exact-identifier questions, ambiguous questions, time-sensitive policy questions, and authorization-filtered questions. Measure how often the correct document enters the candidate pool, how often fusion promotes it, how often the reranker keeps it, and whether the final answer cites it. Compare raw query, multi-query, HyDE, and fusion variants with ablations. Add latency, token cost, retrieval-call count, reranker load, duplicate rate, and context truncation to the same report. A retrieval gain that disappears after reranking is not a product gain.`,
        `Primary sources to read are HyDE at https://arxiv.org/abs/2212.10496, the ACL Anthology version at https://aclanthology.org/2023.acl-long.99/, the HyDE repository at https://github.com/texttron/hyde, RAG-Fusion at https://arxiv.org/abs/2402.03367, and production-style RAG-Fusion cautions at https://arxiv.org/abs/2603.02153. Study RAG Pipeline, Embeddings & Similarity, Inverted Index, SPLADE Learned Sparse Retrieval, Reciprocal Rank Fusion, Multi-Index RAG, Cross-Encoder Reranker, RAG Evaluation, Self-RAG, Claim Graph & Source Ledger, and Prompt Injection Threat Model next.`,
      ],
    },
  ],
};
