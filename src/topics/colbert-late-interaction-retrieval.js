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
  const pipelineNodes = 7;
  const pipelineEdges = 6;
  const queryTokens = 3;
  const candidateDocs = 2;
  const retrieverTiers = 3;

  yield {
    state: lateGraph('ColBERT keeps token-level document vectors'),
    highlight: { active: ['query', 'qmat', 'doc', 'dmat', 'e-query-qmat', 'e-doc-dmat'], compare: ['maxsim'] },
    explanation: `Read the matrix as the index unit. Across ${pipelineNodes} pipeline stages, ColBERT does not store one passage vector; it stores many contextual token vectors so matching can stay fine-grained at query time.`,
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
    explanation: `MaxSim is the visual key: each of the ${queryTokens} query tokens finds its best partner across ${candidateDocs} candidate documents, and the passage score is the sum of those local wins.`,
    invariant: `Late interaction preserves fine-grained matching across ${queryTokens} query tokens without running a cross-encoder over every query-document pair.`,
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
    explanation: `ColBERT sits between ${retrieverTiers} retriever tiers: fast pooled bi-encoders and slow cross-encoders. It precomputes document token embeddings offline, but still lets query tokens interact with document tokens at scoring time.`,
  };

  yield {
    state: lateGraph('RAG uses ColBERT as a high-precision retrieval layer'),
    highlight: { active: ['maxsim', 'score', 'topk', 'e-maxsim-score', 'e-score-topk'], found: ['qmat', 'dmat'] },
    explanation: `In a RAG stack, ColBERT can retrieve or rerank passages after BM25/vector fanout. Through ${pipelineEdges} dataflow edges, the final context gets passages whose exact tokens match the query intent more precisely than a single pooled vector might show.`,
  };
}

function* indexAndCompression() {
  const indexNodes = 7;
  const indexEdges = 8;
  const designChoices = 4;

  yield {
    state: indexGraph('Offline indexing stores many vectors per passage'),
    highlight: { active: ['passages', 'encoder', 'tokens', 'e-passages-encoder', 'e-encoder-tokens'], compare: ['compress'] },
    explanation: `The storage frame shows the tradeoff plainly. Across ${indexNodes} index stages linked by ${indexEdges} edges, late interaction buys token-level matching by storing many vectors per passage, so compression and pruning are not optional at scale.`,
  };

  yield {
    state: indexGraph('ColBERTv2 compresses token vectors aggressively'),
    highlight: { active: ['tokens', 'compress', 'index', 'e-tokens-compress', 'e-compress-index'], found: ['encoder'] },
    explanation: `ColBERTv2 reduces late-interaction storage with residual compression and better supervision. The ${indexEdges}-edge pipeline keeps token-level matching quality while making the index practical at production scale.`,
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
    explanation: `Late interaction makes retrieval quality a storage-layout problem. All ${designChoices} design knobs — dimensions, token retention, compression, and pruning — decide whether the model is fast enough to serve.`,
  };

  yield {
    state: indexGraph('PLAID prunes candidates before exact MaxSim'),
    highlight: { active: ['index', 'prune', 'rerank', 'e-index-prune', 'e-prune-rerank'], compare: ['tokens'] },
    explanation: `PLAID accelerates late interaction by using centroid-style approximations across ${indexNodes} pipeline stages to remove low-scoring passages before exact MaxSim reranking. The data-structure idea is familiar: spend cheap bounds before expensive scoring.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation walks through ColBERT\'s retrieval pipeline one operation at a time. Watch a query get split into token embeddings, see each query token scan across precomputed document token embeddings, and observe how the best per-token similarities are collected and summed into a final passage score. The highlighted elements at each step show which vectors are being compared.',
        'Use the play button for automatic playback or drag the slider to move at your own pace. Pay special attention to the MaxSim step: that is where each query token independently picks its strongest match from the document, which is the operation that separates ColBERT from simpler retrievers.',
        {type: 'image', src: './assets/gifs/colbert-late-interaction-retrieval.gif', alt: 'Animated walkthrough of the colbert late interaction retrieval visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Search systems need to find the right passage out of millions in milliseconds. The standard trick is to compress each document into a single vector (an "embedding"), then find the nearest vectors to the query. That is fast, but a single vector can only capture the general topic of a passage. It cannot represent the fact that paragraph three mentions "annual renewal" while paragraph five mentions "invoice dispute." When a user asks a question that requires several specific concepts to all appear in the same passage, a single-vector retriever often returns passages that are topically close but do not actually answer the question.',
        {type: 'callout', text: 'Late interaction keeps document computation reusable while letting each query token demand its own strongest evidence.'},
        'ColBERT (Contextualized Late Interaction over BERT) solves this by storing a separate embedding for every token in every document. At query time, each query token finds its single best-matching document token, and the passage score is the sum of those best matches. This "late interaction" design keeps document encoding offline and reusable while letting scoring be fine-grained. It sits between the two extremes of search: bi-encoders (fast, one vector per document, coarse) and cross-encoders (accurate, re-read every document per query, too slow for large corpora).',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to do semantic search is a bi-encoder. Run each document through a language model, average or pool the token representations into a single 768-dimensional vector, store all vectors in an index, and at query time encode the query the same way and find the nearest neighbors. This is the architecture behind most production dense retrievers. It is fast because the document vectors are precomputed, and nearest-neighbor search over single vectors is a solved problem (HNSW, IVF, product quantization).',
        'A bi-encoder over a million documents produces a million vectors. You can search them in under 10 milliseconds with standard libraries. The encoding step is also parallelizable: documents are independent, so you can encode them in large batches on a GPU cluster and never re-encode unless the model changes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is information loss from pooling. When you compress a 200-token passage into one vector, you lose the ability to distinguish which tokens contribute which meaning. Consider the query "cancel subscription after renewal invoice." A pooled vector for a passage about billing policies might be semantically close, but if the passage discusses renewals without ever mentioning cancellation, a single-vector cosine similarity cannot detect that gap. The passage scores high because it overlaps on most of the query\'s topic, but it fails on a critical sub-concept.',
        'The brute-force fix is a cross-encoder: concatenate the query and document, feed both into a Transformer, and let full self-attention decide relevance. This is accurate because every query token can attend to every document token. But it destroys the main advantage of retrieval. You cannot precompute document representations because the model needs to see the query and document together. For a corpus of one million documents, you would run a full Transformer forward pass one million times per query. That is not search; that is exhaustive reading.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Relevance is often a collection of local token-level matches, not a single global similarity. A passage answers "cancel subscription after renewal invoice" well if it has strong evidence for "cancel," strong evidence for "renewal," and strong evidence for "invoice" somewhere in its text. Those pieces of evidence do not need to be adjacent. They just all need to exist.',
        {type: 'image', src: 'https://github.com/stanford-futuredata/ColBERT/raw/main/docs/images/ColBERT-Framework-MaxSim-W370px.png', alt: 'ColBERT late interaction MaxSim architecture diagram', caption: 'The MaxSim diagram shows query token vectors matching against precomputed document token vectors before scores are summed. Source: Stanford Future Data ColBERT repository, https://github.com/stanford-futuredata/ColBERT.'},
        'ColBERT\'s insight is to keep every document token as a separate vector and define a scoring function called MaxSim that aggregates per-token evidence. For each query token q_i, compute cosine similarity against every document token d_j and keep only the maximum. Then sum those maxima across all query tokens. The formula is: score(Q, D) = sum over i of max over j of sim(q_i, d_j). This lets a passage earn credit for covering each query concept independently, while still using precomputed document vectors.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Offline, each document is tokenized and run through a BERT-based encoder. Instead of pooling the output into one vector, ColBERT retains every token\'s contextualized embedding, typically projected down to 128 dimensions. A document with 160 tokens produces a matrix of shape 160 x 128. These matrices are stored in an index alongside passage IDs and token metadata.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph showing nodes connected by arrows', caption: 'A retrieval pipeline is a directed dataflow: encoded query tokens, indexed document tokens, MaxSim matches, and final top-k aggregation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'At query time, the query is tokenized and encoded the same way, producing a small matrix (say 32 x 128 for a 32-token query). Scoring computes a 32 x 160 similarity matrix between query tokens and document tokens, takes the column-wise maximum for each query row, and sums those 32 maxima. The result is a single scalar score for the document. In production, you do not compute this against every document. Approximate nearest-neighbor search over the token vectors retrieves candidate passages, and exact MaxSim runs only on the top few hundred or thousand candidates.',
        'ColBERTv2 reduces storage with residual compression: each token vector is quantized against its nearest centroid, and only the small residual difference is stored. PLAID goes further by pruning candidates using centroid-level upper bounds on MaxSim before computing exact token interactions. These optimizations bring the storage from roughly 100x a pooled index down to 10-20x while preserving most of the retrieval quality.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because BERT\'s contextualized embeddings give each token a meaning that depends on surrounding context, not just the word itself. The token "bank" in a document about rivers has a different vector from "bank" in a document about finance. MaxSim matches query tokens to these context-aware document tokens, so the scoring captures fine-grained semantic alignment rather than just surface word overlap.',
        'The design also works because it respects the asymmetry of search. Documents are long and numerous; queries are short and arrive one at a time. ColBERT encodes documents once and stores the results. The only per-query computation is encoding the query tokens (fast, because queries are short) and running MaxSim against candidate documents. This makes the query path orders of magnitude cheaper than a cross-encoder while retaining most of the benefit of token-level interaction.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Storage is the primary cost. A pooled bi-encoder stores one vector per document. ColBERT stores one vector per token. A corpus of 10 million documents averaging 160 tokens each produces 1.6 billion token vectors. At 128 dimensions and 2 bytes per dimension (float16), that is about 410 GB before compression. ColBERTv2\'s residual compression brings this down to roughly 25-50 GB, which fits in RAM on a single machine but is still 10-20x larger than a pooled index for the same corpus.',
        'Query latency has two phases. Encoding a 32-token query through BERT takes about 5-10 ms on a GPU. The MaxSim scoring phase depends on how many candidates survive pruning. Scoring 1,000 candidate passages with 160 tokens each means 1,000 x 32 x 160 = 5.12 million similarity computations, which a GPU handles in under a millisecond. The bottleneck is usually the approximate nearest-neighbor lookup over the token-level index, which PLAID optimizes to a few tens of milliseconds. End-to-end latency is typically 30-80 ms.',
        'The indexing cost is also significant. Encoding 10 million documents through BERT at 160 tokens each takes hundreds of GPU-hours. Re-indexing after a model update means re-encoding the entire corpus. This makes ColBERT more practical for corpora that change slowly (legal databases, documentation, research papers) than for rapidly changing content.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Retrieval-augmented generation (RAG) is ColBERT\'s strongest production use case. When an LLM needs to ground its answer in specific passages, the quality of retrieval directly determines answer quality. ColBERT\'s token-level matching finds passages that contain all required pieces of evidence, not just topically similar ones. This reduces hallucination because the generator receives passages that actually address the question.',
        'Enterprise and legal search benefit because queries in these domains are often multi-concept ("employee termination clause after probationary period for remote workers"). A pooled vector blurs these concepts together. ColBERT can separately match "termination," "probationary period," and "remote workers," then reward documents that cover all three. Medical guideline retrieval, patent search, and scientific literature search share the same structure: precision on multiple specific concepts matters more than broad topical recall.',
        'ColPali extends the late-interaction idea to visual documents. Instead of extracting text from PDFs and then indexing it, ColPali encodes page images directly into patch-level embeddings and uses MaxSim between query tokens and page patches. This handles tables, figures, and complex layouts that text extraction would mangle.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MaxSim rewards token-level matches independently, which means it can be fooled by negation and temporal structure. A passage saying "this policy does NOT apply to cancellations after renewal" contains strong token matches for "cancellation" and "renewal," but the passage actually denies the user\'s intent. MaxSim cannot represent "not" modifying a later token\'s relevance because each query token picks its best match without considering the matches of other query tokens.',
        'Short, ambiguous queries hurt ColBERT too. If the query is just "renewal," there is no multi-concept advantage over a pooled retriever, and the larger index is pure overhead. ColBERT\'s advantage is proportional to the number of distinct concepts in the query. For single-concept or navigational queries, a pooled bi-encoder is cheaper and equally effective.',
        'Chunking creates edge cases. If a long document is split into 200-token chunks and the answer spans two chunks, MaxSim scores each chunk independently and may rank both lower than a single chunk that partially matches. Overlapping chunks or hierarchical retrieval can mitigate this, but they add complexity and index size.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the query is "annual renewal invoice cancellation" and we have two candidate passages. Passage A discusses billing cycles and mentions renewal dates. Passage B discusses cancellation policies and references renewal invoices specifically. The query encodes into 4 token vectors: q_annual, q_renewal, q_invoice, q_cancellation.',
        'For Passage A (about billing cycles), MaxSim finds: q_annual matches a token about "annual billing" with similarity 0.82; q_renewal matches "renewal date" with 0.88; q_invoice matches "payment" (closest available) with 0.45; q_cancellation matches "billing cycle" with 0.31. The sum is 0.82 + 0.88 + 0.45 + 0.31 = 2.46.',
        'For Passage B (about cancellation policy), MaxSim finds: q_annual matches "yearly" with 0.75; q_renewal matches "renewal invoice" with 0.91; q_invoice matches "invoice" with 0.95; q_cancellation matches "cancellation" with 0.93. The sum is 0.75 + 0.91 + 0.95 + 0.93 = 3.54.',
        'Passage B wins by a wide margin (3.54 vs 2.46) because it has strong matches for every query concept. A pooled bi-encoder might have scored both passages similarly because they are both about billing. The per-token scoring correctly identifies that Passage B covers the full query intent while Passage A misses two critical concepts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original ColBERT paper is Khattab and Zaharia, "ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT" (SIGIR 2020). ColBERTv2 (Santhanam et al., NAACL 2022) introduces residual compression and denoised supervision. PLAID (Santhanam et al., 2022) adds centroid-based pruning for production-speed serving.',
        'To build understanding from here, study embeddings and vector similarity to understand what the token vectors represent. Study HNSW and product quantization to understand how the token-level index is searched and compressed. Study cross-encoder reranking to understand the more expensive alternative that ColBERT approximates. Study RAG pipelines to see where ColBERT fits in the full retrieval-generation stack. Each of these topics addresses a different constraint in the same system: how to find the right passage, fast enough, at scale.',
      ],
    },
  ],
};
