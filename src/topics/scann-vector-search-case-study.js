// ScaNN: score-aware vector search with partitioning, anisotropic hashing,
// exact rescoring, and SOAR-style redundancy.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'scann-vector-search-case-study',
  title: 'ScaNN Vector Search Case Study',
  category: 'AI & ML',
  summary: 'Google Research ScaNN as a full ANN system: partition vectors, score compressed candidates with anisotropic hashing, rescore the shortlist, and use redundancy carefully.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['three-stage search', 'anisotropic quantization', 'SOAR redundancy'], defaultValue: 'three-stage search' },
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

function* threeStageSearch() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query', x: 0.7, y: 4.0, note: 'q' },
        { id: 'partition', label: 'part', x: 2.4, y: 4.0, note: 'leaves' },
        { id: 'probe', label: 'probe', x: 4.1, y: 4.0, note: 'few' },
        { id: 'score', label: 'score', x: 5.9, y: 4.0, note: 'codes' },
        { id: 'shortlist', label: 'top k', x: 7.6, y: 4.0, note: "k'" },
        { id: 'rerank', label: 'exact', x: 9.1, y: 4.0, note: 'rerank' },
      ],
      edges: [
        { id: 'e-query-partition', from: 'query', to: 'partition' },
        { id: 'e-partition-probe', from: 'partition', to: 'probe' },
        { id: 'e-probe-score', from: 'probe', to: 'score' },
        { id: 'e-score-shortlist', from: 'score', to: 'shortlist' },
        { id: 'e-shortlist-rerank', from: 'shortlist', to: 'rerank' },
      ],
    }, { title: 'ScaNN is a pipeline, not one trick' }),
    highlight: { active: ['partition', 'score'], found: ['rerank'] },
    explanation: 'ScaNN searches in stages. Partitioning chooses likely leaves, anisotropic hashing scores compressed candidates inside those leaves, and optional rescoring recomputes better distances for a shortlist before returning top-k.',
    invariant: 'The index spends training and compression work to avoid full scans while preserving the neighbors that matter most.',
  };

  yield {
    state: labelMatrix(
      'Partition pruning ledger',
      [
        { id: 'leafA', label: 'leaf A' },
        { id: 'leafB', label: 'leaf B' },
        { id: 'leafC', label: 'leaf C' },
        { id: 'leafD', label: 'leaf D' },
        { id: 'leafE', label: 'leaf E' },
      ],
      [
        { id: 'center', label: 'center score' },
        { id: 'action', label: 'query action' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['near', 'probe', 'good'],
        ['near', 'probe', 'good'],
        ['middle', 'maybe', 'tune'],
        ['far', 'skip', 'miss?'],
        ['far', 'skip', 'miss?'],
      ],
    ),
    highlight: { found: ['leafA:action', 'leafB:action'], active: ['leafC:action'], compare: ['leafD:risk', 'leafE:risk'] },
    explanation: 'The ScaNN docs describe partitioning as optional: train leaves, then search only selected leaves at query time. Large datasets typically partition first because scoring every vector, even compressed, still wastes work.',
  };

  yield {
    state: labelMatrix(
      'Scoring then rescoring',
      [
        { id: 'cand1', label: 'candidate 1' },
        { id: 'cand2', label: 'candidate 2' },
        { id: 'cand3', label: 'candidate 3' },
        { id: 'cand4', label: 'candidate 4' },
      ],
      [
        { id: 'cheap', label: 'AH score' },
        { id: 'keep', label: 'keep?' },
        { id: 'exact', label: 'exact score' },
      ],
      [
        ['0.91', 'yes', '0.94'],
        ['0.88', 'yes', '0.86'],
        ['0.75', 'yes', '0.81'],
        ['0.41', 'no', 'skip'],
      ],
    ),
    highlight: { active: ['cand1:cheap', 'cand2:cheap', 'cand3:cheap'], found: ['cand1:exact', 'cand2:exact', 'cand3:exact'], removed: ['cand4:keep'] },
    explanation: 'As with IVF-PQ and Product Quantization, a cheap compressed score is allowed to be imperfect if it preserves a high-quality candidate set. Rescoring spends exact work only where it can change the answer.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'queries per second', min: 0, max: 120 }, y: { label: 'recall@k', min: 70, max: 100 } },
      series: [
        { id: 'flat', label: 'flat exact', points: [{ x: 7, y: 99 }, { x: 10, y: 99 }] },
        { id: 'hnsw', label: 'HNSW tuned', points: [{ x: 28, y: 92 }, { x: 52, y: 95 }, { x: 74, y: 96 }] },
        { id: 'ivfpq', label: 'IVF-PQ', points: [{ x: 42, y: 84 }, { x: 70, y: 90 }, { x: 98, y: 93 }] },
        { id: 'scann', label: 'ScaNN', points: [{ x: 54, y: 91 }, { x: 82, y: 96 }, { x: 108, y: 97 }] },
      ],
    }),
    highlight: { found: ['scann'], compare: ['flat', 'hnsw', 'ivfpq'] },
    explanation: 'This plot is conceptual, not a benchmark claim. The shape is the lesson: ANN indexes trade recall for throughput, and ScaNN was designed to move that frontier by aligning compression loss with top-k retrieval quality.',
  };
}

function* anisotropicQuantization() {
  yield {
    state: graphState({
      nodes: [
        { id: 'x', label: 'x', x: 3.1, y: 4.2, note: 'vector' },
        { id: 'xhat1', label: 'x1', x: 5.3, y: 4.2, note: 'parallel err' },
        { id: 'xhat2', label: 'x2', x: 3.3, y: 2.2, note: 'orth err' },
        { id: 'q', label: 'q', x: 8.0, y: 4.0, note: 'query' },
        { id: 'topk', label: 'top-k', x: 9.3, y: 4.0, note: 'MIPS' },
      ],
      edges: [
        { id: 'e-x-q', from: 'x', to: 'q' },
        { id: 'e-x-xhat1', from: 'x', to: 'xhat1' },
        { id: 'e-x-xhat2', from: 'x', to: 'xhat2' },
        { id: 'e-q-topk', from: 'q', to: 'topk' },
      ],
    }, { title: 'For MIPS, error direction matters' }),
    highlight: { active: ['x', 'q'], compare: ['xhat1'], found: ['xhat2'] },
    explanation: 'Traditional quantization tries to reconstruct each database vector. ScaNN asks a sharper question for maximum inner product search: will the compressed vector preserve high inner products with likely queries?',
    invariant: 'Error parallel to the vector can corrupt the inner product more than equal-sized orthogonal error.',
  };

  yield {
    state: labelMatrix(
      'Loss function intuition',
      [
        { id: 'recon', label: 'reconstruction loss' },
        { id: 'score', label: 'score-aware loss' },
        { id: 'anis', label: 'anisotropic loss' },
      ],
      [
        { id: 'optimizes', label: 'optimizes' },
        { id: 'misses', label: 'misses' },
      ],
      [
        ['small Euclidean error', 'top-k score priority'],
        ['high inner products', 'irrelevant pairs'],
        ['parallel error costly', 'uniform distortion'],
      ],
    ),
    highlight: { found: ['score:optimizes', 'anis:optimizes'], compare: ['recon:misses'] },
    explanation: 'The ICML paper develops score-aware loss functions and shows that, under statistical assumptions, they lead to an anisotropic penalty: residual error along the data vector direction is weighted more heavily.',
  };

  yield {
    state: labelMatrix(
      'Anisotropic hashing view',
      [
        { id: 'block0', label: 'block 0' },
        { id: 'block1', label: 'block 1' },
        { id: 'block2', label: 'block 2' },
        { id: 'block3', label: 'block 3' },
        { id: 'sum', label: 'sum' },
      ],
      [
        { id: 'query', label: 'query table' },
        { id: 'code', label: 'stored code' },
        { id: 'score', label: 'add' },
      ],
      [
        ['T0[*]', 'c21', 'T0[21]'],
        ['T1[*]', 'c08', 'T1[8]'],
        ['T2[*]', 'c73', 'T2[73]'],
        ['T3[*]', 'c14', 'T3[14]'],
        ['-', '-', 'approx IP'],
      ],
    ),
    highlight: { active: ['block0:score', 'block1:score', 'block2:score', 'block3:score'], found: ['sum:score'] },
    explanation: 'ScaNN implementation material describes asymmetric hashing as the compressed scoring stage. The query remains precise enough to build lookup tables; database vectors are compact codes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'bits per vector block', min: 2, max: 10 }, y: { label: 'top-pair score error', min: 0, max: 24 } },
      series: [
        { id: 'recon', label: 'reconstruction loss', points: [{ x: 2, y: 22 }, { x: 4, y: 16 }, { x: 6, y: 11 }, { x: 8, y: 8 }] },
        { id: 'scoreaware', label: 'score-aware loss', points: [{ x: 2, y: 16 }, { x: 4, y: 10 }, { x: 6, y: 7 }, { x: 8, y: 5 }] },
      ],
    }),
    highlight: { found: ['scoreaware'], compare: ['recon'] },
    explanation: 'The paper reports that score-aware quantization improves recall and inner-product estimation for top-ranking pairs. The exact numbers depend on dataset and tuning; the transferable idea is optimizing the metric users actually care about.',
  };
}

function* soarRedundancy() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query', x: 0.7, y: 4.1, note: 'q' },
        { id: 'leafA', label: 'A', x: 3.0, y: 2.2, note: 'best' },
        { id: 'leafB', label: 'B', x: 3.0, y: 5.9, note: 'backup' },
        { id: 'doc1', label: 'doc 1', x: 5.6, y: 2.4, note: 'only A' },
        { id: 'doc2', label: 'doc 2', x: 5.6, y: 4.1, note: 'spilled' },
        { id: 'doc3', label: 'doc 3', x: 5.6, y: 6.0, note: 'only B' },
        { id: 'score', label: 'score', x: 8.0, y: 4.1, note: 'merge' },
      ],
      edges: [
        { id: 'e-query-A', from: 'query', to: 'leafA' },
        { id: 'e-query-B', from: 'query', to: 'leafB' },
        { id: 'e-A-doc1', from: 'leafA', to: 'doc1' },
        { id: 'e-A-doc2', from: 'leafA', to: 'doc2' },
        { id: 'e-B-doc2', from: 'leafB', to: 'doc2' },
        { id: 'e-B-doc3', from: 'leafB', to: 'doc3' },
        { id: 'e-doc2-score', from: 'doc2', to: 'score' },
      ],
    }, { title: 'SOAR adds carefully chosen redundancy' }),
    highlight: { active: ['leafA', 'leafB'], found: ['doc2'], compare: ['doc1', 'doc3'] },
    explanation: 'SOAR builds on ScaNN by spilling some vectors into more than one partition. The point is not naive duplication; it is a targeted backup route for candidates that would otherwise be lost by pruning the wrong leaf.',
    invariant: 'A little redundancy can buy recall if the extra copies are chosen by the geometry of residual error.',
  };

  yield {
    state: labelMatrix(
      'Spill policy comparison',
      [
        { id: 'none', label: 'no spill' },
        { id: 'naive', label: 'naive spill' },
        { id: 'soar', label: 'SOAR spill' },
      ],
      [
        { id: 'recall', label: 'recall' },
        { id: 'index', label: 'index size' },
        { id: 'latency', label: 'latency' },
      ],
      [
        ['baseline', 'small', 'low'],
        ['higher', 'large', 'higher'],
        ['higher', 'small+', 'controlled'],
      ],
    ),
    highlight: { found: ['soar:recall', 'soar:index', 'soar:latency'], compare: ['naive:index'] },
    explanation: 'The 2024 Google Research SOAR post frames the improvement as low-overhead redundancy. The case-study lesson is familiar from distributed systems: replicas help only when placement is deliberate and budgeted.',
  };

  yield {
    state: labelMatrix(
      'Production retrieval checklist',
      [
        { id: 'metric', label: 'metric' },
        { id: 'partitions', label: 'partition count' },
        { id: 'leaves', label: 'leaves searched' },
        { id: 'rescore', label: 'rescore depth' },
        { id: 'refresh', label: 'refresh plan' },
      ],
      [
        { id: 'question', label: 'ask' },
        { id: 'failure', label: 'failure if ignored' },
      ],
      [
        ['dot, cosine, L2?', 'wrong ranking'],
        ['sqrt(N) start?', 'bad balance'],
        ['recall target?', 'missed docs'],
        ['exact enough?', 'bad top-k'],
        ['model/corpus shift?', 'stale index'],
      ],
    ),
    highlight: { active: ['metric:question', 'leaves:question', 'rescore:question'], compare: ['refresh:failure'] },
    explanation: 'ScaNN is best taught as an engineered index with knobs. The same application can need different settings for offline recommendation, interactive semantic search, RAG evidence retrieval, or long-tail multilingual traffic.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'redundancy budget', min: 0, max: 5 }, y: { label: 'miss rate', min: 0, max: 18 } },
      series: [
        { id: 'naive', label: 'naive copies', points: [{ x: 0, y: 17 }, { x: 1, y: 12 }, { x: 2, y: 10 }, { x: 4, y: 9 }] },
        { id: 'soar', label: 'SOAR copies', points: [{ x: 0, y: 17 }, { x: 1, y: 9 }, { x: 2, y: 6 }, { x: 4, y: 5 }] },
      ],
    }),
    highlight: { found: ['soar'], compare: ['naive'] },
    explanation: 'Conceptually, SOAR tries to get more recall per extra index byte than ordinary spilling. The chart is illustrative; production teams still need workload-specific recall, p95 latency, memory, and rebuild measurements.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'three-stage search') yield* threeStageSearch();
  else if (view === 'anisotropic quantization') yield* anisotropicQuantization();
  else if (view === 'SOAR redundancy') yield* soarRedundancy();
  else throw new InputError('Pick a ScaNN view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'ScaNN, short for Scalable Nearest Neighbors, is a Google Research vector-similarity search system for approximate nearest-neighbor retrieval at scale. It belongs beside HNSW, Product Quantization, Faiss IVF-PQ, and DiskANN because it is not just a library call. It is a data-structure composition: partition the vector space, score compressed candidates quickly, then optionally rescore a smaller shortlist more accurately.',
        'The distinctive ScaNN lesson is score-aware compression. Traditional vector quantization tries to minimize reconstruction error: make the compressed vector look as much like the original as possible. The ScaNN paper argues that this is the wrong objective for maximum inner product search. In retrieval, the costly mistake is not every coordinate error; it is an error that changes which items belong in the top-k.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The official ScaNN algorithm notes describe three phases. Partitioning is optional but important for large datasets: during training, assign database vectors to leaves; during query serving, search only selected leaves. Scoring computes approximate distances or inner products for the candidates in those leaves. Rescoring, also optional, recomputes more accurate distances for the best k-prime candidates before selecting the final k results.',
        'The scoring stage uses asymmetric hashing. The query is handled in a richer form while database vectors are represented by compact codes. This is close in spirit to Product Quantization and Faiss IVF-PQ, but ScaNN changes the quantization objective. Its anisotropic vector quantization penalizes residual error parallel to the original vector more heavily than orthogonal error, because parallel error is more likely to damage large inner products.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The practical knobs are familiar but sharp. More partitions can reduce candidate scans but creates balance and recall risk. Searching more leaves improves recall and increases latency. More code bits reduce quantization error and increase memory or scoring cost. Deeper rescoring improves final ranking and reads more exact data. SOAR-style redundancy can improve recall by placing selected vectors into more than one partition, but every extra copy spends memory and index-build work.',
        'A useful mental model is a retrieval budget ledger. Partitioning spends recall risk to buy pruning. Anisotropic hashing spends approximation to buy compressed scoring. Rescoring spends exact distance work on a shortlist. Redundancy spends index size to reduce miss probability. The correct configuration is not universal; it is measured against recall@k, p95 latency, memory, update behavior, and downstream answer quality.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a product-search or RAG system with 50 million text and image embeddings. Exact search is too slow and too memory-bandwidth heavy. A ScaNN-style deployment trains partitions over a representative sample, stores compact candidate codes, and keeps enough full-vector or higher-precision information to rescore the final shortlist. The serving path embeds the user query, picks the closest leaves, scores compressed candidates with lookup-table-heavy arithmetic, rescoring the top few hundred before handing results to a reranker or generator.',
        'The operating contract should be explicit. Compare ScaNN candidate recall against a flat exact index on traffic samples. Track recall separately for common queries, rare categories, new products, multilingual content, and tenants with unusual vector distributions. When the embedding model changes, rebuild or shadow-build the index and compare exact-neighbor overlap before cutover. If RAG answers depend on this retrieval layer, evaluate final answer groundedness as well as ANN recall.',
      ],
    },
    {
      heading: 'Where SOAR fits',
      paragraphs: [
        'SOAR, Spilling with Orthogonality-Amplified Residuals, is a later Google Research improvement to ScaNN. It adds carefully selected redundancy so vectors can be found through more than one partition route. This is not the same as blindly duplicating everything. The SOAR framing is that a small, geometry-aware spill budget can reduce misses while minimally affecting index size and other operating metrics.',
        'That makes SOAR a useful bridge between algorithms and systems design. Redundancy is a normal reliability idea in distributed systems, but ScaNN uses it inside an ANN index: backup placement for candidate discovery rather than backup replicas for machines. The shared lesson is budgeted redundancy, not free safety.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not summarize ScaNN as "faster PQ." The better explanation is "top-k-aware compressed retrieval." Its anisotropic loss is motivated by maximum inner product search, where preserving the score of likely top results matters more than uniform reconstruction. That means metric choice, vector normalization, and application objective must be clear before tuning.',
        'Do not benchmark only a happy-path dataset. ANN systems fail in the tails: rare queries, fresh items, strict metadata filters, language shifts, embedding-model migrations, and category clusters that were underrepresented in training. A serious evaluation reports recall@k, latency percentiles, memory footprint, index build time, update path, filter interaction, and downstream RAG or recommendation quality.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research ScaNN README at https://github.com/google-research/google-research/blob/master/scann/README.md, ScaNN algorithm configuration docs at https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md, the ICML paper "Accelerating Large-Scale Inference with Anisotropic Vector Quantization" at https://proceedings.mlr.press/v119/guo20h/guo20h.pdf, the Google Research launch post at https://research.google/blog/announcing-scann-efficient-vector-similarity-search/, the SOAR Google Research post at https://research.google/blog/soar-new-algorithms-for-even-faster-vector-search-with-scann/, the SOAR paper link at https://arxiv.org/abs/2404.00774, and the TensorFlow retrieval scaling article at https://blog.tensorflow.org/2023/05/scaling-deep-retrieval-with-tensorflow-recommenders-and-vertex-ai-matching-engine.html. Study Embeddings & Similarity, Product Quantization, Faiss IVF-PQ Case Study, HNSW, DiskANN SSD Vector Search Case Study, Multi-Index RAG, Cross-Encoder Reranker, RAG Evaluation, and ANN Recall-Latency Pareto Ledger next.',
      ],
    },
  ],
};
