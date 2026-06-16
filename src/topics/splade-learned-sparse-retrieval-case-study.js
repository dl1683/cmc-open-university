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
    explanation: 'SPLADE starts like a Transformer retriever, but it does not collapse text into one dense vector. The model predicts weights over the vocabulary, then keeps only a sparse set of important terms.',
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
    explanation: 'The model can assign weight to terms that were implied by the text, not only terms that appeared literally. That is the neural expansion move: sparse search gets semantic reach without leaving the vocabulary axis.',
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
    explanation: 'At serving time, the query becomes a sparse weighted term vector. The engine looks up only nonzero terms in the term dictionary and reads their postings lists, just like a search engine.',
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
      heading: 'What it is',
      paragraphs: [
        'SPLADE, the Sparse Lexical and Expansion Model, is a learned sparse retrieval method. It uses a Transformer and masked-language-model head to produce vocabulary-sized sparse vectors for queries and documents. The result behaves like weighted keywords, but the weights are learned and can include expansion terms that were implied by context.',
        'This makes SPLADE a bridge between Inverted Index and dense Embeddings & Similarity. BM25 is sparse and efficient but mostly lexical. Dense retrieval is semantic but opaque and usually served through ANN structures. SPLADE keeps the inverted-index serving model while letting the neural model choose and weight terms.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A document or query is tokenized and passed through a Transformer. The model produces scores over the vocabulary. Pooling and log-saturation turn token-level predictions into one sparse weighted vector. Training uses ranking losses plus sparsity regularization so the vector is useful for retrieval but not so dense that the inverted index becomes unusable.',
        'At index time, each nonzero document term becomes a posting with a learned weight. At query time, each nonzero query term reads postings, accumulates sparse dot-product scores, and returns a top-k list. Because the system still uses postings lists, search engines can reuse term dictionaries, compression, WAND-style pruning, segment merging, caching, and reranking cascades.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A support-search user asks, "Can I cancel after renewal invoice?" Plain BM25 may miss a policy section that talks about refunds and annual-plan exceptions without using the same wording. Dense vector search may retrieve broad billing articles. SPLADE can expand renewal and invoice toward terms such as refund, annual, cancellation, and policy, then score documents through the same inverted-index path that makes exact search fast and inspectable.',
        'In a production RAG system, SPLADE is usually one candidate generator. BM25 preserves exact identifiers. SPLADE closes vocabulary gaps while staying sparse. Dense ANN catches broader paraphrase. Reciprocal Rank Fusion merges the lists, and a Cross-Encoder Reranker or ColBERT layer chooses final evidence. The key data-structure point is that learned expansion becomes postings traffic, so term sparsity, postings length, and pruning bounds directly control latency.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is index bloat. If the model emits too many nonzero terms per document, postings lists become long, WAND bounds weaken, cache pressure rises, and query latency can approach a scan. If the model is pruned too hard, expansion disappears and recall falls. SPLADE therefore makes sparsity a first-class systems knob.',
        'The second cost is training and refresh. Learned sparse terms depend on the model, tokenizer, corpus, and domain. Reindexing can be required after model updates. Teams need shadow evaluation, latency dashboards, and query-slice metrics rather than only one average nDCG number.',
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
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SPLADE first-stage ranking at https://arxiv.org/abs/2107.05720 and ACM DOI https://dl.acm.org/doi/10.1145/3404835.3463098, SPLADE v2 at https://arxiv.org/abs/2109.10086, NAVER Labs overview at https://europe.naverlabs.com/blog/splade-a-sparse-bi-encoder-bert-based-model-achieves-effective-and-efficient-first-stage-ranking/, SPLADE code at https://github.com/naver/splade, and recent LSR sparsity work at https://arxiv.org/html/2505.15070v1.',
        'Study Inverted Index, Block-Max WAND Top-k Retrieval, Reciprocal Rank Fusion, Multi-Index RAG, Query Expansion: HyDE and RAG-Fusion, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, HNSW, Product Quantization for Vector Search, and RAG Evaluation next.',
      ],
    },
  ],
};
