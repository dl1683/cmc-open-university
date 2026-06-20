// SPLADE learned sparse retrieval: a Transformer predicts sparse vocabulary
// weights so neural expansion can still run on an inverted index.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'splade-learned-sparse-retrieval-case-study',
  title: 'SPLADE Learned Sparse Retrieval',
  category: 'AI & ML',
  summary: 'How SPLADE turns text into sparse learned term weights, writes them to postings lists, and bridges BM25-style search with neural retrieval.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['learn sparse weights', 'serve on postings'], defaultValue: 'learn sparse weights' },
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

function sparseGraph(title) {
  return graphState({
    nodes: [
      { id: 'text', label: 'text', x: 0.7, y: 3.7, note: 'tokens' },
      { id: 'bert', label: 'BERT', x: 2.4, y: 3.7, note: 'context' },
      { id: 'mlm', label: 'MLM head', x: 4.1, y: 3.7, note: 'vocab' },
      { id: 'pool', label: 'pool', x: 5.8, y: 3.7, note: 'max/log' },
      { id: 'sparse', label: 'sparse', x: 7.4, y: 3.7, note: 'term wts' },
      { id: 'post', label: 'postings', x: 9.0, y: 3.7, note: 'index' },
    ],
    edges: [
      { id: 'e-text-bert', from: 'text', to: 'bert' },
      { id: 'e-bert-mlm', from: 'bert', to: 'mlm' },
      { id: 'e-mlm-pool', from: 'mlm', to: 'pool' },
      { id: 'e-pool-sparse', from: 'pool', to: 'sparse' },
      { id: 'e-sparse-post', from: 'sparse', to: 'post' },
    ],
  }, { title });
}

function servingGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.6, y: 3.7, note: 'sparse' },
      { id: 'terms', label: 'terms', x: 2.1, y: 3.7, note: 'top wts' },
      { id: 'dict', label: 'dict', x: 3.6, y: 2.1, note: 'term ids' },
      { id: 'post', label: 'postings', x: 3.6, y: 5.3, note: 'docs' },
      { id: 'wand', label: 'WAND', x: 5.4, y: 3.7, note: 'bounds' },
      { id: 'heap', label: 'top-k', x: 7.1, y: 3.7, note: 'heap' },
      { id: 'rerank', label: 'rerank', x: 8.8, y: 3.7, note: 'precise' },
    ],
    edges: [
      { id: 'e-query-terms', from: 'query', to: 'terms' },
      { id: 'e-terms-dict', from: 'terms', to: 'dict' },
      { id: 'e-dict-post', from: 'dict', to: 'post' },
      { id: 'e-post-wand', from: 'post', to: 'wand' },
      { id: 'e-wand-heap', from: 'wand', to: 'heap' },
      { id: 'e-heap-rerank', from: 'heap', to: 'rerank' },
    ],
  }, { title });
}

function* learnSparseWeights() {
  yield {
    state: sparseGraph('SPLADE keeps neural retrieval inside sparse vectors'),
    highlight: { active: ['text', 'bert', 'mlm'], compare: ['post'] },
    explanation: 'Read this as a neural model writing a weighted inverted-index query. The Transformer proposes vocabulary terms, but only a small nonzero set survives into the sparse retrieval structure.',
  };

  yield {
    state: labelMatrix(
      'Expansion from context',
      [
        { id: 'renewal', label: 'renewal' },
        { id: 'invoice', label: 'invoice' },
        { id: 'cancel', label: 'cancel' },
        { id: 'refund', label: 'refund' },
      ],
      [
        { id: 'seen', label: 'literal?' },
        { id: 'weight', label: 'learned wt' },
        { id: 'role', label: 'role' },
      ],
      [
        ['yes', '2.6', 'anchor'],
        ['yes', '2.2', 'anchor'],
        ['yes', '1.8', 'intent'],
        ['no', '1.4', 'expand'],
      ],
    ),
    highlight: { active: ['refund:weight', 'refund:role'], found: ['renewal:weight', 'invoice:weight'] },
    explanation: 'The highlighted expansion terms are the point: the document can match through words implied by context, while the serving engine still looks up vocabulary terms in postings lists.',
    invariant: 'The vector is vocabulary-sized, but most coordinates are zero.',
  };

  yield {
    state: labelMatrix(
      'Why sparsity is enforced',
      [
        { id: 'densev', label: 'dense vocab' },
        { id: 'topk', label: 'top terms' },
        { id: 'flops', label: 'FLOPS reg' },
        { id: 'prune', label: 'term prune' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['many terms', 'huge index'],
        ['few terms', 'miss nuance'],
        ['cheap query', 'bad balance'],
        ['trim tail', 'drop signal'],
      ],
    ),
    highlight: { active: ['flops:effect', 'prune:effect'], compare: ['densev:risk', 'topk:risk'] },
    explanation: 'Learned sparse retrieval only works operationally if the vectors stay sparse. Regularization and pruning are data-structure controls, not cosmetic training tricks: they determine postings length and query latency.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'nonzero terms', min: 0, max: 220 }, y: { label: 'recall proxy', min: 60, max: 100 } },
      series: [
        { id: 'bm25', label: 'BM25', points: [{ x: 18, y: 72 }, { x: 25, y: 73 }] },
        { id: 'splade', label: 'SPLADE', points: [{ x: 25, y: 76 }, { x: 65, y: 88 }, { x: 120, y: 92 }, { x: 200, y: 93 }] },
        { id: 'dense', label: 'dense ANN', points: [{ x: 0, y: 84 }, { x: 0, y: 89 }] },
      ],
    }),
    highlight: { found: ['splade'], compare: ['bm25', 'dense'] },
    explanation: 'This is an intuition plot, not a benchmark claim. SPLADE tunes a frontier: more nonzero terms can improve recall but lengthen postings and serving cost. Dense ANN has a different cost axis.',
  };

  yield {
    state: sparseGraph('The output can be inspected like weighted keywords'),
    highlight: { active: ['pool', 'sparse'], found: ['post'], compare: ['bert'] },
    explanation: 'The final sparse vector is interpretable enough to debug: top weighted vocabulary terms explain why a document matched. That is a major contrast with opaque dense coordinates, even when both are learned.',
  };
}

function* serveOnPostings() {
  yield {
    state: servingGraph('Learned sparse vectors still query postings lists'),
    highlight: { active: ['query', 'terms', 'dict', 'post'], compare: ['rerank'] },
    explanation: 'Follow the nonzero query terms into postings. SPLADE changes the weights and expansion terms, but query-time work is still term lookup, postings traversal, accumulation, and pruning.',
  };

  yield {
    state: labelMatrix(
      'Posting score accumulation',
      [
        { id: 'doc17', label: 'doc 17' },
        { id: 'doc42', label: 'doc 42' },
        { id: 'doc88', label: 'doc 88' },
        { id: 'doc91', label: 'doc 91' },
      ],
      [
        { id: 'renew', label: 'renewal' },
        { id: 'refund', label: 'refund' },
        { id: 'cancel', label: 'cancel' },
        { id: 'sum', label: 'sum' },
      ],
      [
        ['2.1', '1.3', '0.0', '3.4'],
        ['0.0', '1.7', '1.2', '2.9'],
        ['1.9', '0.0', '0.8', '2.7'],
        ['0.4', '0.0', '0.0', '0.4'],
      ],
    ),
    highlight: { found: ['doc17:sum', 'doc42:sum', 'doc88:sum'], compare: ['doc91:sum'] },
    explanation: 'The score is a sparse dot product over shared vocabulary terms. Documents can match through literal terms and expansion terms, but only terms with nonzero query weight touch postings.',
  };

  yield {
    state: servingGraph('WAND and block bounds prune hopeless documents'),
    highlight: { active: ['post', 'wand', 'heap', 'e-post-wand', 'e-wand-heap'], found: ['terms'] },
    explanation: 'Because SPLADE uses postings, it can reuse dynamic-pruning machinery such as WAND or Block-Max WAND. Upper bounds skip documents or blocks that cannot enter the current top-k heap.',
    invariant: 'The sparse neural model changes weights; the serving engine still lives on postings and bounds.',
  };

  yield {
    state: labelMatrix(
      'Hybrid retrieval placement',
      [
        { id: 'bm25', label: 'BM25' },
        { id: 'splade', label: 'SPLADE' },
        { id: 'dense', label: 'dense ANN' },
        { id: 'colbert', label: 'ColBERT' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['exact terms', 'vocab gap'],
        ['learned terms', 'long lists'],
        ['paraphrase', 'opaque'],
        ['token match', 'storage'],
      ],
    ),
    highlight: { active: ['splade:strength'], compare: ['bm25:weakness', 'dense:weakness'], found: ['colbert:strength'] },
    explanation: 'SPLADE is not a universal replacement. It is one first-stage retriever in a cascade: stronger than plain BM25 on vocabulary mismatch, cheaper and more explainable than some dense or late-interaction paths.',
  };

  yield {
    state: servingGraph('RAG uses SPLADE as a recall leg before fusion'),
    highlight: { active: ['heap', 'rerank'], found: ['query', 'terms'], compare: ['wand'] },
    explanation: 'A RAG stack can fan out to BM25, SPLADE, dense ANN, and graph retrieval, then fuse the ranked lists. SPLADE often contributes evidence that exact lexical search missed but dense search blurred.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'learn sparse weights') yield* learnSparseWeights();
  else if (view === 'serve on postings') yield* serveOnPostings();
  else throw new InputError('Pick a SPLADE view.');
}

export const article = {
  sections: [
    {
      heading: 'The retrieval problem SPLADE attacks',
      paragraphs: [
        'SPLADE, the Sparse Lexical and Expansion Model, attacks a central retrieval problem: exact words are efficient but brittle, while dense vectors are semantic but harder to inspect and serve with classic search infrastructure. BM25 can retrieve documents quickly through an inverted index, but it struggles when a query and a relevant document use different vocabulary. Dense retrieval can close vocabulary gaps, but it usually depends on approximate nearest-neighbor indexes and opaque embedding dimensions.',
        'SPLADE sits between those worlds. It uses a Transformer to produce vocabulary-sized sparse vectors for queries and documents. The active coordinates are terms. The weights are learned. Some active terms may be literal words from the text; others may be expansion terms implied by context. The result behaves like weighted keyword retrieval, but the keywords and weights come from a neural model.',
        {type:'callout', text:'SPLADE works by letting a neural model choose sparse vocabulary coordinates while the serving path remains an inverted-index query.'},
      ],
    },
    {
      heading: 'The naive approaches and why they are incomplete',
      paragraphs: [
        'The first naive approach is plain lexical retrieval. It is fast, explainable, and operationally mature. It also misses many relevant documents when the wording differs. A query for "cancel after renewal invoice" may need a document about refunds, annual plans, or billing policy even if those exact words do not line up neatly.',
        'The second naive approach is to replace lexical search with dense embeddings. That improves semantic matching, but dense dimensions are not human-readable terms. Serving uses vector indexes, approximate search, and different failure modes. Dense retrieval can retrieve broad paraphrases while missing exact identifiers, product codes, legal clauses, or rare terms that lexical search handles well.',
        'The third naive approach is manual query expansion. Synonym lists and rule-based expansions help in narrow domains, but they are brittle and hard to maintain. SPLADE learns expansion from data while preserving the sparse inverted-index shape that search systems already know how to optimize.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'A query or document is tokenized and passed through a Transformer with a masked-language-model style head. The model emits scores over the vocabulary. Pooling and transformations such as log saturation turn token-level scores into one sparse weighted vector. Most vocabulary entries are zero. The nonzero entries become learned lexical and expansion terms.',
        'Training balances ranking quality with sparsity. If the vector is too sparse, it behaves like weak lexical search and misses semantic matches. If it is too dense, the inverted index becomes expensive because too many terms produce too many postings. SPLADE is therefore not only a modeling method; it is a retrieval-systems method where sparsity is a first-class constraint.',
        'At index time, each nonzero document term becomes a posting with a learned weight. At query time, each nonzero query term opens a postings list. Scores are sparse dot products over shared vocabulary coordinates. Because the serving path still uses postings, a search engine can reuse term dictionaries, compression, segment merging, cache behavior, WAND-style pruning, and reranking cascades.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'SPLADE works because it turns semantic expansion into something an inverted index can serve. The neural model can infer that a document about refunds may be relevant to a query about cancellation, but the final representation is still a sparse set of vocabulary terms. That gives the retrieval system both learned matching and term-level structure.',
        'The method also preserves a useful form of explainability. A dense embedding dimension does not tell an engineer much. A learned sparse term does. If a query activates cancellation, refund, annual, and policy, those terms can be inspected, debugged, and measured. The weights are learned, but the coordinates remain words or subwords.',
        'The serving advantage depends on sparsity. Inverted indexes are fast because a query touches a small number of postings lists and pruning can skip documents that cannot reach the top-k. If SPLADE emits too many active terms, the system loses that advantage. The model must learn not only what to expand but how little to expand.',
      ],
    },
    {
      heading: 'A production RAG example',
      paragraphs: [
        'Suppose a support-search user asks, "Can I cancel after renewal invoice?" Plain BM25 may miss a policy section that uses refund, annual plan, billing cycle, and exception language instead of the user\'s exact wording. Dense retrieval may return broad billing articles but miss the precise cancellation policy. SPLADE can expand the query toward relevant terms while still scoring through an inverted index.',
        'In a RAG system, SPLADE is often one candidate generator rather than the whole retrieval stack. BM25 preserves exact identifiers and rare terms. SPLADE closes vocabulary gaps while staying sparse. Dense ANN catches broad paraphrases. Reciprocal Rank Fusion merges candidate lists. A cross-encoder or late-interaction reranker chooses final evidence. The important systems point is that every expansion term becomes postings traffic, so retrieval quality and latency are tied together.',
        'This makes SPLADE especially useful in domains where exact words and semantic variants both matter: support search, legal search, biomedical search, enterprise documentation, source-code documentation, and product knowledge bases. It is less useful when evidence is visual, multimodal, highly cross-lingual, or better represented by dense similarity alone.',
      ],
    },
    {
      heading: 'Costs and failure modes',
      paragraphs: [
        'The main cost is index bloat. If the model emits too many nonzero terms per document, postings lists become long, WAND bounds weaken, cache pressure rises, and query latency can approach a scan. If the model is pruned too hard, expansion disappears and recall falls. SPLADE makes sparsity an operational knob, not a cosmetic regularizer.',
        'Training and refresh are also expensive. Learned sparse terms depend on the model, tokenizer, corpus, and domain. A model update can require reindexing. Domain drift can make expansions stale. Teams need offline retrieval metrics, shadow indexes, latency dashboards, query-slice analysis, and human inspection of surprising expansion terms.',
        'The method can also overexpand. A query may pick up plausible but wrong terms, pulling in documents that are topically nearby but not actually relevant. This is dangerous in source-cited or high-stakes systems because a fluent downstream answer can hide weak retrieval. Reranking and citation verification remain necessary.',
      ],
    },
    {
      heading: 'How to evaluate it',
      paragraphs: [
        'Offline retrieval metrics should include recall at k, nDCG, MRR, and query-slice performance for exact identifiers, synonyms, rare terms, head queries, and tail queries. But those are not enough. A SPLADE deployment also needs index-size measurements, nonzero terms per document, postings length distributions, cache hit rates, WAND pruning effectiveness, and p95 query latency.',
        'A good ablation compares BM25, SPLADE, dense retrieval, and fused retrieval under the same reranker. If SPLADE improves recall but the reranker discards most of its unique candidates, the index cost may not be worth it. If SPLADE improves source grounding in a RAG answer set, the systems cost may be justified.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not call SPLADE simply "BM25 with synonyms." The expansion weights come from a trained neural model, not a fixed thesaurus. Also do not assume sparse means cheap by default. A vocabulary-sized vector with too many active terms can be worse than a well-tuned lexical index. The production question is how many terms survive, how long their postings are, and whether pruning still works.',
        'SPLADE also does not remove the need for dense retrieval, ColBERT, or reranking. It is strongest when exact terms matter but vocabulary mismatch hurts recall. Very visual, cross-lingual, multimodal, or highly paraphrased evidence may still need other retrievers.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'SPLADE is learned sparse retrieval. It uses a neural model to choose vocabulary terms and weights, then serves retrieval through inverted-index machinery. That is the core bridge: semantic expansion with sparse operational structure.',
        'The deep tradeoff is recall versus postings cost. Expansion helps only while the representation stays sparse enough for efficient pruning. A good SPLADE system is measured by nDCG or recall, but also by postings length, index size, query latency, and reranker quality.',
        'For learners, the important connection is that model output becomes an index data structure. The Transformer does not replace the inverted index; it writes a smarter sparse representation into it. That makes SPLADE a strong example of machine learning and classic search engineering meeting in one system.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SPLADE first-stage ranking at https://arxiv.org/abs/2107.05720 and ACM DOI https://dl.acm.org/doi/10.1145/3404835.3463098, SPLADE v2 at https://arxiv.org/abs/2109.10086, NAVER Labs overview at https://europe.naverlabs.com/blog/splade-a-sparse-bi-encoder-bert-based-model-achieves-effective-and-efficient-first-stage-ranking/, SPLADE code at https://github.com/naver/splade, and recent LSR sparsity work at https://arxiv.org/html/2505.15070v1.',
        'Study Inverted Index, Block-Max WAND Top-k Retrieval, Reciprocal Rank Fusion, Multi-Index RAG, Query Expansion: HyDE and RAG-Fusion, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, HNSW, Product Quantization for Vector Search, and RAG Evaluation next.',
      ],
    },
  ],
};
