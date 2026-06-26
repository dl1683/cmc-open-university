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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a three-stage nearest-neighbor search. A vector is a list of numbers representing an item, and nearest-neighbor search asks which stored vectors are closest to the query vector under a chosen score.',
        'The active stage first prunes partitions, then scores compressed candidates, then rescores a shortlist more accurately. The visual point is that exact work is saved for candidates that already survived cheaper tests.',
        {type:'callout', text:`ScaNN wins by spending build-time structure so query-time search can prune, approximate, and rescore instead of scanning everything.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt:'Colored Voronoi cells partitioning a plane around nearest seed points.', caption:'Euclidean Voronoi diagram by Balu Ertl, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Embedding systems turn text, images, audio, products, or users into vectors. Search then asks for the closest vectors, which can mean highest dot product, lowest Euclidean distance, or highest cosine similarity depending on the model.',
        'Exact search compares the query to every stored vector. At 50 million vectors with 768 numbers each, one query touches 38.4 billion floating-point values before ranking even begins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is brute force. Compute the score between the query and every stored vector, keep the top k, and return those results.',
        'Brute force is exact and often best for small datasets. It becomes expensive when memory bandwidth and arithmetic scale linearly with corpus size for every query.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that semantic search wants both high recall and low latency. Recall is the fraction of true nearest neighbors found, and latency is how long the query takes.',
        'High-dimensional vectors weaken simple geometric shortcuts. The index needs to skip most vectors while keeping the true neighbors likely enough to reach the final rescoring stage.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'ScaNN, short for Scalable Nearest Neighbors, spends build-time work to reduce query-time work. It partitions vectors into leaves, scores candidates with asymmetric hashing, and rescores a shortlist with more accurate distances.',
        'The distinctive idea is score-aware compression. Instead of only reconstructing vectors well, ScaNN tries to preserve the scores that determine top-k ranking.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training builds a partition tree and compressed representations for stored vectors. At query time, ScaNN selects a limited number of leaves, so most vectors are never scored.',
        'Inside selected leaves, asymmetric hashing scores candidates cheaply because stored vectors are compact codes. A larger candidate set is then rescored with more accurate math, and the final top-k results are selected.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness goal is approximate, not exact. Partitioning is allowed to miss some candidates as long as measured recall remains high enough for the product or downstream reranker.',
        'Rescoring protects the final ranking from some compression error. The cheaper stages only need to keep plausible winners alive until exact or higher-quality scoring can choose among them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build cost includes training partitions, encoding vectors, and storing the index. Query cost depends on leaves searched, candidates scored, code size, and rescore shortlist length.',
        'Cost behaves as a recall-latency-memory trade. Searching twice as many leaves usually improves recall but also scores more candidates; increasing the rescore shortlist may fix ranking mistakes but gives back some latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ScaNN fits semantic search, recommendation candidate generation, image retrieval, audio retrieval, RAG evidence retrieval, and similar systems where approximate candidates are acceptable. It is strongest when a later stage can rerank or verify the candidates.',
        'It also teaches a general systems pattern. Use a cheap approximate stage to reduce the universe, then spend expensive exact work only where it can still change the answer.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ScaNN is the wrong tool when exactness is mandatory, the dataset is small enough for brute force, or updates must be visible immediately without rebuild or maintenance. It can also misbehave when metadata filters remove most candidates after vector search.',
        'Tail behavior matters. Rare languages, fresh documents, new embedding models, tenant skew, and categories missing from training data can lose recall while average benchmarks look good.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A RAG system stores 50 million passage vectors with 768 float32 values each. Raw vectors alone use about 50,000,000 * 768 * 4 bytes, or 153.6 GB, and exact search must stream through that memory for every query.',
        'A ScaNN-style index might search 200 of 10,000 leaves, score 1,000,000 compressed candidates, and rescore 1,000 candidates exactly before returning top 20. The query touches about 2% of the partitioned corpus at the approximate stage and only 0.002% at the final exact stage.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ScaNN README at https://github.com/google-research/google-research/blob/master/scann/README.md, ScaNN algorithm guide at https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md, anisotropic vector quantization paper at https://proceedings.mlr.press/v119/guo20h/guo20h.pdf, and SOAR paper at https://arxiv.org/abs/2404.00774. Study embeddings, cosine similarity, product quantization, HNSW, DiskANN, and recall-latency evaluation next.',
      ],
    },
  ],
};
