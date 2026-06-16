// ColBERT late interaction: store a matrix of contextual token embeddings per
// passage, then score query tokens with MaxSim instead of one pooled vector.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'colbert-late-interaction-retrieval',
  title: 'ColBERT Late-Interaction Retrieval',
  category: 'AI & ML',
  summary: 'A retrieval architecture between bi-encoders and cross-encoders: token-level document vectors, query vectors, MaxSim scoring, and compressed late interaction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['MaxSim scoring', 'index and compression'], defaultValue: 'MaxSim scoring' },
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

function lateGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.8, y: 4.5, note: 'tokens' },
      { id: 'qmat', label: 'Q matrix', x: 2.9, y: 4.5, note: 'query vecs' },
      { id: 'doc', label: 'doc', x: 0.8, y: 1.4, note: 'tokens' },
      { id: 'dmat', label: 'D matrix', x: 2.9, y: 1.4, note: 'stored vecs' },
      { id: 'maxsim', label: 'MaxSim', x: 5.6, y: 3.0, note: 'token match' },
      { id: 'score', label: 'score', x: 7.7, y: 3.0, note: 'sum' },
      { id: 'topk', label: 'top-k', x: 9.2, y: 3.0, note: 'passages' },
    ],
    edges: [
      { id: 'e-query-qmat', from: 'query', to: 'qmat' },
      { id: 'e-doc-dmat', from: 'doc', to: 'dmat' },
      { id: 'e-qmat-maxsim', from: 'qmat', to: 'maxsim' },
      { id: 'e-dmat-maxsim', from: 'dmat', to: 'maxsim' },
      { id: 'e-maxsim-score', from: 'maxsim', to: 'score' },
      { id: 'e-score-topk', from: 'score', to: 'topk' },
    ],
  }, { title });
}

function indexGraph(title) {
  return graphState({
    nodes: [
      { id: 'passages', label: 'passages', x: 0.7, y: 3.6, note: 'chunks' },
      { id: 'encoder', label: 'encoder', x: 2.6, y: 3.6, note: 'BERT' },
      { id: 'tokens', label: 'token vecs', x: 4.5, y: 2.0, note: 'many per doc' },
      { id: 'compress', label: 'compress', x: 4.5, y: 5.4, note: 'residual' },
      { id: 'index', label: 'ANN index', x: 6.7, y: 3.6, note: 'vector lists' },
      { id: 'prune', label: 'prune', x: 8.4, y: 2.0, note: 'PLAID' },
      { id: 'rerank', label: 'rerank', x: 8.4, y: 5.4, note: 'exact MaxSim' },
    ],
    edges: [
      { id: 'e-passages-encoder', from: 'passages', to: 'encoder' },
      { id: 'e-encoder-tokens', from: 'encoder', to: 'tokens' },
      { id: 'e-tokens-compress', from: 'tokens', to: 'compress' },
      { id: 'e-tokens-index', from: 'tokens', to: 'index' },
      { id: 'e-compress-index', from: 'compress', to: 'index' },
      { id: 'e-index-prune', from: 'index', to: 'prune' },
      { id: 'e-index-rerank', from: 'index', to: 'rerank' },
      { id: 'e-prune-rerank', from: 'prune', to: 'rerank' },
    ],
  }, { title });
}

function* maxSimScoring() {
  yield {
    state: lateGraph('ColBERT keeps token-level document vectors'),
    highlight: { active: ['query', 'qmat', 'doc', 'dmat', 'e-query-qmat', 'e-doc-dmat'], compare: ['maxsim'] },
    explanation: 'A normal dense retriever pools a passage into one vector. ColBERT stores contextual embeddings for many passage tokens, then encodes the query into its own token-vector matrix at search time.',
  };

  yield {
    state: labelMatrix(
      'MaxSim token matching',
      [
        { id: 'refund', label: 'refund' },
        { id: 'policy', label: 'policy' },
        { id: 'cancel', label: 'cancel' },
      ],
      [
        { id: 'doc A', label: 'doc A' },
        { id: 'doc B', label: 'doc B' },
        { id: 'best', label: 'best' },
      ],
      [
        ['0.91', '0.42', 'A'],
        ['0.88', '0.61', 'A'],
        ['0.31', '0.83', 'B'],
      ],
    ),
    highlight: { active: ['refund:doc A', 'policy:doc A', 'cancel:doc B'], found: ['refund:best', 'policy:best', 'cancel:best'] },
    explanation: 'For each query token, MaxSim finds the most similar document token. The passage score is the sum of those per-token maxima, so different parts of a query can match different parts of a document.',
    invariant: 'Late interaction preserves fine-grained token matching without running a cross-encoder over every query-document pair.',
  };

  yield {
    state: labelMatrix(
      'Retriever spectrum',
      [
        { id: 'bi', label: 'single vector' },
        { id: 'colbert', label: 'late interaction' },
        { id: 'cross', label: 'cross-encoder' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'query cost', label: 'query cost' },
        { id: 'quality', label: 'quality' },
      ],
      [
        ['one vector/doc', 'cheap', 'coarse'],
        ['token vectors/doc', 'medium', 'fine-grained'],
        ['raw text', 'expensive', 'strong rerank'],
      ],
    ),
    highlight: { active: ['colbert:stores', 'colbert:query cost', 'colbert:quality'], compare: ['bi:quality', 'cross:query cost'] },
    explanation: 'ColBERT sits between fast pooled bi-encoders and slow cross-encoders. It precomputes document token embeddings offline, but still lets query tokens interact with document tokens at scoring time.',
  };

  yield {
    state: lateGraph('RAG uses ColBERT as a high-precision retrieval layer'),
    highlight: { active: ['maxsim', 'score', 'topk', 'e-maxsim-score', 'e-score-topk'], found: ['qmat', 'dmat'] },
    explanation: 'In a RAG stack, ColBERT can retrieve or rerank passages after BM25/vector fanout. The final context gets passages whose exact tokens match the query intent more precisely than a single pooled vector might show.',
  };
}

function* indexAndCompression() {
  yield {
    state: indexGraph('Offline indexing stores many vectors per passage'),
    highlight: { active: ['passages', 'encoder', 'tokens', 'e-passages-encoder', 'e-encoder-tokens'], compare: ['compress'] },
    explanation: 'The price of late interaction is storage. A passage is not one vector; it is a matrix of token vectors. That improves matching but can multiply index size unless compression and pruning are used.',
  };

  yield {
    state: indexGraph('ColBERTv2 compresses token vectors aggressively'),
    highlight: { active: ['tokens', 'compress', 'index', 'e-tokens-compress', 'e-compress-index'], found: ['encoder'] },
    explanation: 'ColBERTv2 reduces late-interaction storage with residual compression and better supervision. The goal is to keep token-level matching quality while making the index practical at production scale.',
  };

  yield {
    state: labelMatrix(
      'Index design choices',
      [
        { id: 'dim', label: 'vector dim' },
        { id: 'tokens', label: 'tokens/doc' },
        { id: 'codec', label: 'codec' },
        { id: 'prune', label: 'pruning' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost if wrong', label: 'cost if wrong' },
      ],
      [
        ['lower memory', 'lost nuance'],
        ['higher recall', 'large index'],
        ['smaller footprint', 'decode overhead'],
        ['lower latency', 'missed evidence'],
      ],
    ),
    highlight: { active: ['dim:helps', 'codec:helps', 'prune:helps'], compare: ['tokens:cost if wrong'] },
    explanation: 'Late interaction makes retrieval quality a storage-layout problem. Dimensions, token retention, compression, and pruning decide whether the model is fast enough to serve.',
  };

  yield {
    state: indexGraph('PLAID prunes candidates before exact MaxSim'),
    highlight: { active: ['index', 'prune', 'rerank', 'e-index-prune', 'e-prune-rerank'], compare: ['tokens'] },
    explanation: 'PLAID accelerates late interaction by using centroid-style approximations to remove low-scoring passages before exact MaxSim reranking. The data-structure idea is familiar: spend cheap bounds before expensive scoring.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'MaxSim scoring') yield* maxSimScoring();
  else if (view === 'index and compression') yield* indexAndCompression();
  else throw new InputError('Pick a ColBERT view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'ColBERT is a neural retrieval architecture for passage search that uses contextual late interaction. Instead of representing each document with one pooled embedding, it represents a passage as a matrix of contextual token embeddings. At query time, each query token finds its best matching document token, and the passage score sums those MaxSim matches.',
        'The original ColBERT paper frames the trade-off clearly: Cross-Encoder Reranker models are strong but expensive because every query-document pair must pass through a large model; bi-encoders are cheap but coarse because each side collapses into one vector. ColBERT independently encodes query and document, then delays fine-grained interaction until scoring: https://arxiv.org/abs/2004.12832.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The document index is a collection of token-vector matrices. A passage with 180 tokens and 128-dimensional vectors is 180 small vectors, not one vector. Query processing encodes the query into a much smaller token-vector matrix, then compares each query token against document token vectors. MaxSim is the operator: for each query token, take the maximum similarity over all document tokens, then sum across query tokens.',
        'This is why ColBERT belongs beside Multi-Index RAG, HNSW, and Product Quantization. It is not just a model choice; it is an index-layout choice. The retrieval engine must store many vectors per passage, search or prune them efficiently, and produce top-k passages fast enough for an interactive RAG system.',
      ],
    },
    {
      heading: 'Compression and engines',
      paragraphs: [
        'ColBERTv2 keeps late interaction but attacks the storage footprint. The paper describes a retriever that combines residual compression with denoised supervision, improving retrieval quality while reducing the space footprint of late-interaction models: https://arxiv.org/abs/2112.01488. The ACL Anthology entry is the publication reference: https://aclanthology.org/2022.naacl-main.272/.',
        'The Stanford FutureData ColBERT repository is the canonical implementation reference and describes passage matrices, query matrices, and scalable vector-similarity MaxSim operators: https://github.com/stanford-futuredata/ColBERT. PLAID then optimizes the serving engine for late interaction using centroid interaction and pruning before exact scoring: https://arxiv.org/abs/2205.09707.',
      ],
    },
    {
      heading: 'Complete case study: enterprise policy search',
      paragraphs: [
        'A support assistant asks, "Can I cancel an annual plan after a renewal invoice?" A pooled vector retriever may return general refund pages because the whole query embedding points near billing semantics. ColBERT can reward passages where separate token-level evidence matches annual, renewal, invoice, cancel, and plan in the same passage. That fine-grained token match is exactly what policy search often needs.',
        'In production, ColBERT is often one layer in a larger pipeline. BM25 catches exact policy IDs. HNSW catches broad semantic candidates. ColBERT reranks or retrieves with token-level matching. A cross-encoder or LLM judge may still rerank a small final set. Zanzibar Authorization Case Study remains necessary because strong retrieval must not retrieve unauthorized policy text.',
        'The same late-interaction idea reappears in visual document retrieval. Multimodal RAG & ColPali Case Study uses page-image embeddings and query-token interaction to recover evidence from tables, charts, forms, and layout-heavy PDFs that plain text extraction may damage.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Late interaction is not free. Storing token vectors can be much larger than storing one vector per passage. Compression, quantization, pruning, batching, and GPU/CPU trade-offs become part of retrieval design. Another mistake is assuming MaxSim proves factual relevance. It proves a strong token-level match under the model; source support, freshness, and permissions still need independent checks.',
        'Do not treat ColBERT as a replacement for all search. Exact identifiers still favor inverted indexes. Very broad corpus questions may favor GraphRAG community summaries. Tiny corpora may not justify the index complexity. The right question is where late interaction earns its cost: usually high-value passages where token-level matching improves final answer quality.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ColBERT at https://arxiv.org/abs/2004.12832, ColBERT SIGIR PDF at https://people.eecs.berkeley.edu/~matei/papers/2020/sigir_colbert.pdf, ColBERTv2 at https://arxiv.org/abs/2112.01488, ColBERTv2 ACL entry at https://aclanthology.org/2022.naacl-main.272/, Stanford FutureData ColBERT at https://github.com/stanford-futuredata/ColBERT, and PLAID at https://arxiv.org/abs/2205.09707.',
        'Study Embeddings & Similarity, Attention Mechanism, Multi-Index RAG, Cross-Encoder Reranker, HNSW, Product Quantization for Vector Search, GraphRAG Community Summary Case Study, and LLM Evaluation Harness & Golden Sets next.',
      ],
    },
  ],
};
