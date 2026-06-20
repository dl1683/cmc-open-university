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
      heading: 'Why this exists',
      paragraphs: [
        `Embedding search turns meaning into geometry. A query and millions of documents, products, images, or users become vectors, and retrieval asks for the nearest vectors under dot product, cosine distance, or Euclidean distance. The problem is that exact search compares the query with every stored vector. At millions or billions of vectors, memory bandwidth and arithmetic dominate the request.`,
        `ScaNN, short for Scalable Nearest Neighbors, is Google's approximate nearest-neighbor system for this problem. It is best taught as a pipeline: prune the search space with partitions, score compressed candidates with asymmetric hashing, and optionally rescore a shortlist with more accurate distances before returning top-k results.`,
        {type:'callout', text:`ScaNN wins by spending build-time structure so query-time search can prune, approximate, and rescore instead of scanning everything.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt:'Colored Voronoi cells partitioning a plane around nearest seed points.', caption:'Euclidean Voronoi diagram by Balu Ertl, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is brute-force search. Embed the query, compute its score against every stored vector, sort or select the best k, and return the winners. This is simple, exact, and often the right answer for small datasets. The current ScaNN configuration guide still recommends brute force for small collections.`,
        `The wall is scale. If every query must touch every vector, doubling the corpus roughly doubles the scoring work and memory traffic. High dimensionality also weakens many simple pruning tricks. You need an index that can skip most vectors while keeping the true neighbors likely enough to survive.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `ScaNN spends build-time structure to save query-time work. Partitioning decides which regions of the vector space deserve attention. Asymmetric hashing makes candidate scoring cheap by storing compact database-vector codes. Rescoring spends exact or higher-quality work only on candidates that already look promising.`,
        `The distinctive ScaNN idea is score-aware compression. Ordinary vector quantization tries to reconstruct each vector well. ScaNN asks a retrieval-specific question: will this compressed representation preserve the scores that decide top-k? For maximum inner product search, the anisotropic quantization paper shows why residual error parallel to a data vector can matter more than equal-sized orthogonal error.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the three-stage search view, follow the query as it narrows the candidate set. Partitioning is a coarse decision: which leaves are worth searching? Compressed scoring is a cheaper decision: which vectors inside those leaves might belong in the answer? Exact rescoring is the expensive decision saved for the shortlist.`,
        `In the anisotropic-quantization view, focus on the direction of the error. A compressed vector can be close in Euclidean distance and still damage the inner product that ranks results. The highlighted parallel-error case matters because it changes the score the user actually depends on.`,
        `In the SOAR redundancy view, the second partition path is not a bug or a duplicate for its own sake. It is a backup route for a vector that partition pruning might otherwise miss. The visualization is about budgeted redundancy: buy recall with a small number of extra placements, not with uncontrolled copying.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Training builds the index. Partitioning assigns database vectors to leaves. Query serving chooses a subset of leaves, so most vectors are never scored. The official ScaNN guide frames the partition ratio as the pruning lever: searching more leaves improves accuracy and costs more scoring work.`,
        `Scoring then computes approximate distances or inner products for candidates in the selected leaves. ScaNN can score with brute force or asymmetric hashing. With asymmetric hashing, the query can stay in a richer form while each database vector is stored as compact codes, so scoring is mostly table lookups and additions rather than full floating-point vector math.`,
        `Rescoring repairs the last mile. The approximate stage produces more candidates than the final k. ScaNN then recomputes better distances for that shortlist and selects the final k. This is why the shortlist size is a real tuning knob: too small loses recall, too large gives back the latency that approximation was meant to save.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `ScaNN works when the index preserves enough of the true neighbor set before the final exact work. Partitioning is allowed to be approximate because it only has to pass likely leaves to later stages. Compressed scoring is allowed to be approximate because rescoring can correct the best candidates. Rescoring works because it spends accuracy only where a ranking change can still affect the answer.`,
        `The anisotropic loss improves the middle stage by optimizing the error that matters to ranking. If the application uses maximum inner product search, preserving high inner products is more important than minimizing average reconstruction error over all coordinates. That is the algorithmic reason ScaNN is more than "PQ with different defaults."`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine a RAG system with 50 million passage embeddings and a 768-dimensional query vector. Exact search would score 50 million vectors for every question. A ScaNN-style serving path embeds the query, selects a small number of trained leaves, scores compressed candidates inside those leaves, rescoring a few hundred or a few thousand candidates before passing results to a reranker or generator.`,
        `The correctness check is empirical but precise. Build a flat exact index for traffic samples or held-out queries. Compare ScaNN's candidate set against exact nearest neighbors. Track recall separately for common queries, rare categories, long-tail languages, fresh documents, and filtered searches. If the embedding model changes, shadow-build the new index and compare neighbor overlap before cutover.`,
      ],
    },
    {
      heading: 'Costs and tuning behavior',
      paragraphs: [
        `The main cost is a recall-latency-memory trade. More leaves can improve partition quality but cost more build work. Searching more leaves improves recall and increases candidate scoring. More code bits reduce quantization error and increase memory or scoring cost. Larger rescore shortlists improve final ranking and cost more exact work.`,
        `The current ScaNN guide gives practical rules of thumb: brute force for small datasets, asymmetric hashing plus rescoring for medium datasets, and partitioning plus asymmetric hashing plus rescoring for larger datasets. It also suggests a partition count on the order of the square root of the dataset size, then tuning the number of searched leaves to the recall target. Treat those as starting points, not laws.`,
        `SOAR adds another line to the ledger. Redundancy can reduce misses by giving selected vectors more than one partition route, but each spill spends index bytes, build work, and sometimes query work. Useful redundancy is placed by geometry and measured against recall and latency; naive duplication is just a bigger index.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `ScaNN is a good fit when a large embedding corpus makes exact search too slow and the product can tolerate approximate retrieval with measured recall. It belongs in semantic search, recommendation candidate generation, image or audio retrieval, RAG evidence retrieval, and other systems where a later reranker or generator can consume a high-quality candidate set.`,
        `It is especially attractive when maximum inner product search is the bottleneck and compressed scoring can preserve the candidates that matter. It also teaches a general systems pattern: use cheap approximate stages to reduce the search space, then spend exact work only on the part of the problem that can still change the answer.`,
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        `Do not reach for ScaNN when exactness is mandatory, the dataset is small enough for brute force, or updates must be visible immediately with no rebuild or maintenance path. A relational predicate, inverted index, or ordinary key-value lookup is better when the query is exact rather than semantic.`,
        `It can also be the wrong fit when strict metadata filters remove most of the corpus after vector search. If the index cannot account for the filter, it may return a high-recall candidate set for the wrong universe. Filter-aware indexing, hybrid retrieval, or per-tenant indexes may be needed.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `ANN systems fail in the tails. Rare queries, fresh items, underrepresented languages, embedding-model migrations, skewed tenants, and category clusters missing from training can all lose recall while average benchmark numbers look healthy. The index can also go stale if the corpus changes faster than the rebuild plan.`,
        `Another failure is metric confusion. Dot product, cosine similarity, and Euclidean distance are not interchangeable once normalization, training objective, and application semantics are fixed. A team that tunes ScaNN against the wrong metric can improve benchmark recall while making product ranking worse.`,
      ],
    },
    {
      heading: 'Study next and sources',
      paragraphs: [
        `Study Embeddings & Similarity first, then Product Quantization and Faiss IVF-PQ Case Study to understand compressed scoring. Compare ScaNN with HNSW and DiskANN SSD Vector Search Case Study to see graph-based and storage-aware ANN alternatives. For production retrieval, study Multi-Index RAG, Cross-Encoder Reranker, RAG Evaluation, and ANN Recall-Latency Pareto Ledger.`,
        `Primary sources: ScaNN README at https://github.com/google-research/google-research/blob/master/scann/README.md, ScaNN algorithm guide at https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md, Google Research's ScaNN launch post at https://research.google/blog/announcing-scann-efficient-vector-similarity-search/, the ICML 2020 anisotropic vector quantization paper at https://proceedings.mlr.press/v119/guo20h/guo20h.pdf, the Google Research SOAR post at https://research.google/blog/soar-new-algorithms-for-even-faster-vector-search-with-scann/, and the SOAR paper at https://arxiv.org/abs/2404.00774.`,
      ],
    },
  ],
};
