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
    explanation: 'Read the matrix as the index unit. ColBERT does not store one passage vector; it stores many contextual token vectors so matching can stay fine-grained at query time.',
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
    explanation: 'MaxSim is the visual key: each query token gets to find its best document-token partner, and the passage score is the sum of those local wins.',
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
    explanation: 'The storage frame shows the tradeoff plainly. Late interaction buys token-level matching by storing many vectors per passage, so compression and pruning are not optional at scale.',
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
        'ColBERT is a retrieval architecture that keeps more structure than a normal dense vector retriever without paying the full cost of a cross-encoder over every document. It encodes each passage into a matrix of contextual token embeddings. A query is encoded into its own token-embedding matrix. At scoring time, each query token looks for its best matching token inside the passage, and the passage score is the sum of those best matches. That scoring rule is usually called MaxSim.',
        {type: 'callout', text: 'Late interaction keeps document computation reusable while letting each query token demand its own strongest evidence.'},
        'The important phrase is late interaction. Documents can be encoded offline and stored in an index before the user asks a question. Queries can be encoded independently at request time. The expensive query-document interaction is delayed until scoring, where token vectors meet through similarity operations rather than full Transformer attention. ColBERT therefore sits between two familiar extremes: a pooled bi-encoder that is fast but coarse, and a cross-encoder reranker that is precise but too expensive to run against the whole corpus.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious dense-retrieval approach is to pool a passage into one embedding and search by nearest-neighbor distance. This works well for broad semantic similarity. It is also easy to index with HNSW, IVF, or product quantization because each passage contributes one vector. The wall appears when the query depends on several exact concepts that must all be supported by the same passage. A single vector can blur "cancel after renewal invoice" into generic billing meaning and rank a page that is related but not actually responsive.',
        'The opposite approach is to run a cross-encoder on the query and every candidate passage. That lets every query token attend to every document token, but it destroys the main advantage of retrieval: reusable document computation. A large corpus cannot be scanned with a Transformer pair model for every request. ColBERT is the compromise. It stores enough token-level detail to recover fine matches, but it keeps documents precomputed so the query path remains a retrieval engine rather than an exhaustive reading loop.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that relevance often depends on local token evidence, not only global passage similarity. A good answer passage for a policy question may need to match "annual", "renewal", "invoice", "cancel", and "refund" in different parts of the passage. A pooled vector asks whether the passage as a whole is near the query. ColBERT asks whether every important query token can find strong support somewhere in the passage, then aggregates those local wins.',
        {type: 'image', src: 'https://github.com/stanford-futuredata/ColBERT/raw/main/docs/images/ColBERT-Framework-MaxSim-W370px.png', alt: 'ColBERT late interaction MaxSim architecture diagram', caption: 'The MaxSim diagram shows query token vectors matching against precomputed document token vectors before scores are summed. Source: Stanford Future Data ColBERT repository, https://github.com/stanford-futuredata/ColBERT.'},
        'MaxSim is simple but powerful. For each query token vector, compute similarity against the document token vectors and keep the maximum. Sum the maxima over the query tokens. This allows a passage to get credit for matching separate pieces of the question even if those pieces are not adjacent. It also preserves the asymmetry of search: the query is short and active; the document is longer and stored. The scoring rule favors passages that cover the query concepts instead of passages that merely share a general topic.',
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        'The main data structure is a passage-token matrix. A chunk with 160 retained tokens and 128-dimensional token vectors stores 160 vectors, not one. The index therefore contains many more vectors than a pooled retriever. It also needs passage identifiers, token offsets or masks, compressed vector codes, and a way to aggregate token matches back to passage scores. Query execution builds a small query-token matrix, performs vector lookups or approximate matches, accumulates MaxSim evidence, and returns top-k passages.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph showing nodes connected by arrows', caption: 'A retrieval pipeline is a directed dataflow: encoded query tokens, indexed document tokens, MaxSim matches, and final top-k aggregation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Real ColBERT systems add compression and pruning because raw token matrices are large. ColBERTv2 uses residual compression to reduce the footprint of token embeddings while trying to preserve late-interaction quality. PLAID-style serving engines use centroid interaction, upper bounds, and pruning to avoid exact MaxSim on weak candidates. Conceptually, the engine keeps two layers: a cheap approximate layer that proves many passages are not worth scoring, and a precise late-interaction layer that reranks the survivors.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because contextual token embeddings carry local meaning after the encoder has seen the passage. The token "renewal" inside a subscription policy has a different representation from the same token in a general marketing page. A query token can therefore match a contextually meaningful document token rather than a raw word. At the same time, the scoring operation is much cheaper than a cross-encoder because it uses precomputed document vectors and similarity tables rather than recomputing joint attention for every pair.',
        'The design also maps well to multi-stage retrieval. BM25 can catch exact identifiers and rare terms. A pooled vector retriever can catch broad semantic paraphrases. ColBERT can then score candidates with token-level evidence before a final cross-encoder or LLM judge sees only a small set. Each stage has a different data structure and a different cost profile. ColBERT earns its place when token-level matching improves precision enough to justify the larger index.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'ColBERT is useful for corpora where evidence is passage-level and queries contain multiple specific concepts. Enterprise policy search is a common example. Legal search, technical documentation, medical guidelines, code search, and scientific literature search have similar shapes: the right passage may be one that covers several tokens precisely, while broad semantic similarity returns near misses. Retrieval-augmented generation benefits because the generator receives passages that are more likely to contain all required pieces of support.',
        'The same late-interaction pattern extends beyond plain text. Visual document systems such as ColPali-style retrieval use query tokens and page or patch embeddings to retrieve evidence from PDFs, tables, forms, and slides where text extraction can lose layout. The broader lesson is not limited to ColBERT as a named model. When pooled representations hide too much structure and cross-encoders are too slow, late interaction gives the system a middle layer with reusable document computation and finer-grained scoring.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure is storage. Token matrices can be tens or hundreds of times larger than one vector per passage before compression. A production deployment must budget memory, disk, cache locality, rebuild time, and query-time aggregation cost. A second failure is overmatching. MaxSim can reward isolated token matches even when the passage does not answer the full question, especially for negation, temporal constraints, or procedural dependencies. Token evidence is stronger than pooled similarity, but it is not a proof of answer correctness.',
        'ColBERT is also not the right default for every corpus. Tiny corpora may be served well by BM25, flat vectors, or direct cross-encoder reranking. Identifier-heavy search still needs inverted indexes. Very broad analytical questions may require graph or summary retrieval rather than passage matching. Long documents must be chunked carefully because a passage-token matrix only scores the retained chunk. If chunk boundaries split the evidence, MaxSim can look weaker than the underlying document deserves.',
      ],
    },
    {
      heading: 'Evaluation and operational signals',
      paragraphs: [
        'Evaluate ColBERT at the retrieval stage and at the final task stage. Retrieval metrics include recall@k, MRR, nDCG, and success by query slice. Final RAG metrics include whether the generated answer cites the right passage and stays faithful to it. Compare against BM25, pooled dense retrieval, hybrid retrieval, and cross-encoder reranking at the same candidate depth. The question is not whether ColBERT is elegant; the question is whether late interaction changes enough outcomes to pay for its index.',
        'Operational signals should include bytes per passage, retained tokens per passage, compressed bytes per token vector, p50 and p95 query latency, GPU or CPU utilization, pruning rate, exact MaxSim rerank depth, and cache hit rate. Quality alerts should watch queries where exact evaluation finds relevant passages that pruning removed. Engineers should inspect MaxSim token matches for representative failures. If the matched tokens are plausible but the answer is wrong, the system may need a later reranker. If the matched tokens are irrelevant, the index or model needs attention.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study the original ColBERT paper to understand contextual late interaction, then ColBERTv2 for residual compression and denoised supervision, and PLAID for production acceleration. In this curriculum, connect the topic to Embeddings and Similarity, Attention Mechanism, HNSW, Product Quantization, Multi-Index RAG, Cross-Encoder Reranker, and LLM Evaluation Golden Sets. Those topics explain the surrounding pipeline: how candidates are found, compressed, reranked, and judged.',
        'The practical takeaway is to see ColBERT as an index design, not only a model. It changes the unit of retrieval from one vector per passage to a compressed matrix of token vectors. That gives the retrieval engine a better way to recognize specific evidence, but it also creates storage and serving obligations. Use it when pooled vectors miss too many precise passages, keep a cheaper retriever for broad recall, and measure whether token-level evidence improves the final user-facing answer.',
      ],
    },
  ],
};
