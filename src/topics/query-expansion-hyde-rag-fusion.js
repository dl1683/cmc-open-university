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
    explanation: 'A raw user query can be too short, ambiguous, or unlike the corpus language. Query expansion makes several search views: direct rewrites for lexical and semantic retrieval, plus HyDE-style hypothetical documents for dense retrieval.',
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
    explanation: 'HyDE is the distinctive move: the LLM writes a plausible answer-like document, then the retriever embeds that document and searches for real documents nearby. The generated text is not evidence; it is a bridge into corpus space.',
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
    explanation: 'More query views usually increase candidate recall first. After reranking and context truncation, the extra candidates can become mostly noise and latency. Query expansion is a budgeted design choice, not a free upgrade.',
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
      heading: 'What it is',
      paragraphs: [
        'Query expansion for RAG changes the search query before retrieval. Instead of embedding the raw user message once, the system can generate paraphrases, split the question into subqueries, produce a HyDE hypothetical document, or run several views and fuse the resulting ranked lists. The goal is to reduce vocabulary mismatch and improve candidate recall before a reranker narrows the evidence.',
        'HyDE, short for Hypothetical Document Embeddings, was introduced for zero-shot dense retrieval without relevance labels. The method asks an instruction-following model to generate a hypothetical document, embeds that generated document, and retrieves real documents near it in embedding space: https://arxiv.org/abs/2212.10496. The ACL Anthology version is at https://aclanthology.org/2023.acl-long.99/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The raw query is still useful, especially for exact identifiers. Multi-query expansion adds paraphrases that expose synonyms and alternate phrasings. HyDE adds a generated answer-shaped or document-shaped text that can land closer to relevant corpus chunks than the short user question. RAG-Fusion then retrieves for several query views and merges their ranked lists with Reciprocal Rank Fusion before a reranker or context packer decides what the model sees.',
        'The official HyDE repository describes the pipeline as generating a fictional document, encoding it with Contriever, and searching in embedding space: https://github.com/texttron/hyde. RAG-Fusion applies multiple generated queries plus reciprocal rank fusion in a RAG setting: https://arxiv.org/abs/2402.03367. Diverse Multi-Query Rewriting studies structured rewriting strategies for retrieval diversity: https://arxiv.org/html/2411.13154v1.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expansion costs extra model calls, extra retrieval calls, larger candidate pools, deduplication, fusion, and often more reranking. That is worth it when the raw query underspecifies intent or uses different words than the corpus. It can be wasteful when the query already contains exact policy IDs, dates, code symbols, ticket numbers, or legal citations. In those cases, a rewrite can accidentally delete the most valuable token.',
        'A 2026 production-style RAG-Fusion study argues that retrieval-fusion gains can be neutralized by fixed reranking budgets and context truncation, with extra latency and no downstream win in its setting: https://arxiv.org/abs/2603.02153. That does not mean fusion is bad. It means the evaluation must include the whole system, not just raw candidate recall.',
      ],
    },
    {
      heading: 'Complete case study: support policy assistant',
      paragraphs: [
        'A user asks, "Can I cancel after renewal?" The raw query is underspecified. BM25 may find generic cancellation pages. A dense retriever may find broad billing articles. Query expansion can produce variants such as "annual plan renewal cancellation refund window" and "post-renewal cancellation policy." HyDE can generate a short hypothetical policy paragraph that mentions renewal invoice, refund window, and annual plan.',
        'The system retrieves with the raw query, the variants, and the HyDE document embedding. Reciprocal Rank Fusion promotes documents that appear across several result lists. Cross-Encoder Reranker then chooses the current policy section. The answer cites only the real policy section, never the HyDE text. RAG Evaluation: RAGAS, ARES, and the RAG Triad should score context recall, precision, faithfulness, and whether expansion helped the specific slice.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat generated expansions as evidence. They are routing hints. A HyDE document can contain false details, and a query rewrite can drift from the user intent. The system must trace which query views were generated, which real documents each view retrieved, how fusion scored them, and which evidence was finally used. Without traces, expansion makes failures harder to debug.',
        'Do not blindly expand every query. Exact IDs, code symbols, citations, and compliance clauses often need lexical preservation more than paraphrase. User questions that are genuinely ambiguous may need clarification rather than a confident expanded search. Self-RAG attacks a related problem from another angle by learning when retrieval is needed, but it still needs external evals and trace inspection.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: HyDE arXiv at https://arxiv.org/abs/2212.10496, HyDE ACL Anthology at https://aclanthology.org/2023.acl-long.99/, HyDE code at https://github.com/texttron/hyde, RAG-Fusion at https://arxiv.org/abs/2402.03367, production RAG-Fusion lessons at https://arxiv.org/abs/2603.02153, and DMQR-RAG at https://arxiv.org/html/2411.13154v1. Study RAG Pipeline, Embeddings & Similarity, SPLADE Learned Sparse Retrieval, Reciprocal Rank Fusion, Multi-Index RAG, Cross-Encoder Reranker, Self-RAG, and RAG Evaluation next.',
      ],
    },
  ],
};
