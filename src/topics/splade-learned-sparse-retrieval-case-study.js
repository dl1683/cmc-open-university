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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the learning view as text becoming a sparse weighted vocabulary vector. The Transformer adds context, the masked-language-model head scores vocabulary terms, pooling combines token scores, and the sparse vector keeps only nonzero terms. Active nodes are current transformations, compare nodes show the classic postings path, and found nodes are terms that enter the index.',
        'Read the serving view as an inverted-index query. Nonzero query terms open postings lists, scores accumulate as a sparse dot product, WAND-style bounds skip hopeless documents, and top-k candidates go to reranking. The safe inference is that SPLADE changes term weights, not the basic postings machinery.',
        {type:'callout', text:'SPLADE works by letting a neural model choose sparse vocabulary coordinates while the serving path remains an inverted-index query.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'BM25-style lexical search is fast and explainable because it uses an inverted index. An inverted index maps terms to postings lists of documents containing those terms. The weakness is vocabulary mismatch: a relevant document can use refund while the query says cancel.',
        'Dense retrieval handles paraphrase better, but dense vector dimensions are opaque and usually served through approximate nearest-neighbor indexes. SPLADE exists to keep neural expansion inside a sparse vocabulary vector. The model learns terms and weights while the serving system still uses postings.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is plain lexical search. It is fast, robust for exact identifiers, and easy to inspect. It struggles when users and documents describe the same idea with different words.',
        'The other obvious approach is dense embedding retrieval. It can bridge semantic gaps, but it may blur rare exact terms, product codes, legal clauses, and names. It also moves the system away from mature inverted-index pruning and term-level debugging.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is serving semantic expansion cheaply. Manual synonym lists are brittle and domain-specific. Dense vectors lose term-level structure. Expanding every possible related term makes postings lists too long and turns search into a scan.',
        'SPLADE must satisfy two constraints at once. It must add useful learned terms for recall, and it must stay sparse enough that WAND, caches, compression, and top-k heaps still work. Retrieval quality and index cost are the same design problem.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use a Transformer to choose sparse vocabulary coordinates. A query or document passes through a contextual encoder, and a vocabulary head assigns weights to terms. Pooling and regularization keep only a small active set.',
        'The output is a learned sparse vector. Literal terms and expansion terms live in the same coordinate system. A document about annual plan refunds can match a cancellation query because both activate overlapping vocabulary terms.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At index time, each document is encoded into nonzero vocabulary terms with weights. Each nonzero term becomes a posting that stores the document ID and weight. The index can use familiar compression, segment merging, cache layout, and pruning data.',
        'At query time, the query is encoded the same way. The engine opens postings lists for nonzero query terms and accumulates weighted products for documents that share terms. WAND or Block-Max WAND uses score upper bounds to skip documents or blocks that cannot reach the current top-k.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'SPLADE works because semantic expansion is constrained to a searchable data structure. The model can infer that refund is related to cancellation, but the retrieval engine still sees term IDs and weights. That preserves a path for explanation and debugging.',
        'Correctness for retrieval means the score is the intended sparse dot product over shared vocabulary coordinates. The index does not need to understand language; it needs to return documents with high accumulated learned term weights. The model owns the expansion, and the postings engine owns efficient scoring.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is postings growth. If a document emits 40 nonzero terms on average across 10 million documents, the index stores about 400 million learned postings. If tuning raises that to 180 terms, the index stores 1.8 billion postings and query latency can rise even if recall improves.',
        'Training and refresh add more cost. A tokenizer change, domain shift, or model update may require re-encoding documents. Sparsity regularization is an operational knob: too little expansion misses vocabulary gaps, while too much expansion weakens pruning and increases memory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SPLADE fits support search, legal search, biomedical retrieval, enterprise documentation, product knowledge bases, and RAG candidate generation. These domains need both exact terms and semantic variants.',
        'It works well as one leg in a hybrid retriever. BM25 protects exact identifiers, SPLADE closes vocabulary gaps while staying sparse, dense retrieval adds broad semantic recall, and a reranker chooses final evidence. Fusion is often stronger than pretending one retriever owns every query.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SPLADE fails when expansion is wrong or too broad. A query can activate plausible but irrelevant terms and pull in documents that look semantically nearby but do not answer the question. Reranking and citation checks remain necessary.',
        'It also fails when the sparse vectors stop being sparse. Long postings lists reduce WAND effectiveness, raise cache pressure, and can make the system slower than a simpler lexical baseline. For visual, multimodal, or strongly cross-lingual retrieval, dense or specialized models may fit better.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user asks: cancel after renewal invoice. BM25 opens postings for cancel, renewal, and invoice. SPLADE may assign weights cancel 2.1, renewal 2.6, invoice 2.2, refund 1.4, annual 1.1, and billing 0.9, even though refund and annual were not literal query words.',
        'Document 17 has renewal 2.0, refund 1.5, and billing 0.7, so its partial score is 2.6*2.0 + 1.4*1.5 + 0.9*0.7 = 7.93. Document 91 has only renewal 0.4, so its score is 1.04 and WAND may skip later blocks once the top-k heap threshold rises. The expansion helps only because it remains a short postings query.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with SPLADE first-stage ranking, SPLADE v2, NAVER Labs SPLADE materials, the SPLADE codebase, and current learned sparse retrieval work. Read them for the training objective, sparsity regularization, and index behavior.',
        'Study inverted indexes, BM25, WAND and Block-Max WAND, reciprocal rank fusion, dense ANN, ColBERT, cross-encoder reranking, RAG evaluation, and query expansion next. SPLADE is easiest to understand as neural expansion written into classic search infrastructure.',
      ],
    },
  ],
};
