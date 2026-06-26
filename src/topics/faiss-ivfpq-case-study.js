// Faiss IVF-PQ: a production vector-search composition of inverted lists,
// residual product-quantization codes, batched execution, and optional rerank.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'faiss-ivfpq-case-study',
  title: 'Faiss IVF-PQ Case Study',
  category: 'AI & ML',
  summary: 'A production vector-index recipe: train coarse centroids, store residual PQ codes in inverted lists, probe a few lists, and optionally rerank exact vectors.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['index recipe', 'query execution'], defaultValue: 'index recipe' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* indexRecipe() {
  yield {
    state: graphState({
      nodes: [
        { id: 'vectors', label: 'vectors', x: 0.7, y: 4.0, note: 'float' },
        { id: 'coarse', label: 'coarse', x: 2.7, y: 4.0, note: 'k-means' },
        { id: 'residual', label: 'residual', x: 4.7, y: 4.0, note: 'minus center' },
        { id: 'pq', label: 'PQ code', x: 6.7, y: 4.0, note: 'bytes' },
        { id: 'lists', label: 'IVF list', x: 8.6, y: 4.0, note: 'stored' },
      ],
      edges: [
        { id: 'e-vectors-coarse', from: 'vectors', to: 'coarse' },
        { id: 'e-coarse-residual', from: 'coarse', to: 'residual' },
        { id: 'e-residual-pq', from: 'residual', to: 'pq' },
        { id: 'e-pq-lists', from: 'pq', to: 'lists' },
      ],
    }, { title: 'IVF-PQ stores compact residual codes inside coarse lists' }),
    highlight: { active: ['coarse', 'residual', 'pq'], found: ['lists'] },
    explanation: 'Faiss IVF-PQ is a composition: an inverted file partitions vectors by coarse centroids, then product quantization stores compact codes for residuals inside each list.',
    invariant: 'The index spends training time to buy lower memory and fewer scanned candidates at query time.',
  };

  yield {
    state: labelMatrix(
      'IndexFactory-style knobs',
      [
        { id: 'nlist', label: 'nlist' },
        { id: 'm', label: 'M' },
        { id: 'nbits', label: 'nbits' },
        { id: 'rerank', label: 'rerank' },
      ],
      [
        { id: 'means', label: 'meaning' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['coarse lists', 'partition recall'],
        ['subquantizers', 'code size'],
        ['bits/code', 'table size'],
        ['exact top-k', 'extra reads'],
      ],
    ),
    highlight: { active: ['nlist:means', 'm:means', 'nbits:means'], compare: ['rerank:pressure'] },
    explanation: 'The typical recipe is written as something like IVF4096,PQ64x8. That means many coarse lists, 64 PQ subquantizers, and 8 bits per subquantizer. The string is short; the tradeoff surface is not.',
  };

  yield {
    state: labelMatrix(
      'What each list contains',
      [
        { id: 'list7', label: 'list 7' },
        { id: 'list42', label: 'list 42' },
        { id: 'list99', label: 'list 99' },
      ],
      [
        { id: 'center', label: 'centroid' },
        { id: 'ids', label: 'ids' },
        { id: 'codes', label: 'PQ codes' },
      ],
      [
        ['c7', 'doc ids', 'residual bytes'],
        ['c42', 'doc ids', 'residual bytes'],
        ['c99', 'doc ids', 'residual bytes'],
      ],
    ),
    highlight: { found: ['list42:codes'], active: ['list42:center', 'list42:ids'] },
    explanation: 'The inverted list is not a posting list of terms; it is a vector bucket. It stores ids and compressed vector payloads for points whose nearest coarse centroid is that list.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'memory per vector', min: 0, max: 3200 }, y: { label: 'recall pressure', min: 0, max: 100 } },
      series: [
        { id: 'flat', label: 'Flat float32', points: [{ x: 3072, y: 96 }, { x: 3072, y: 96 }] },
        { id: 'ivfpq', label: 'IVF-PQ code', points: [{ x: 64, y: 60 }, { x: 96, y: 72 }, { x: 128, y: 81 }] },
        { id: 'rerank', label: 'IVF-PQ + rerank', points: [{ x: 160, y: 76 }, { x: 224, y: 88 }, { x: 320, y: 93 }] },
      ],
    }),
    highlight: { active: ['ivfpq'], found: ['rerank'], compare: ['flat'] },
    explanation: 'The chart is illustrative: full vectors maximize exactness but are expensive. IVF-PQ buys a compressed candidate stage; reranking pays a controlled exact-read budget to recover quality.',
  };
}

function* queryExecution() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query', x: 0.8, y: 4.0, note: 'float' },
        { id: 'centroids', label: 'centroids', x: 2.6, y: 4.0, note: 'search' },
        { id: 'probe', label: 'probe', x: 4.4, y: 4.0, note: 'nprobe' },
        { id: 'adc', label: 'ADC', x: 6.2, y: 4.0, note: 'tables' },
        { id: 'topk', label: 'top-k', x: 8.1, y: 4.0, note: 'heap' },
      ],
      edges: [
        { id: 'e-query-centroids', from: 'query', to: 'centroids' },
        { id: 'e-centroids-probe', from: 'centroids', to: 'probe' },
        { id: 'e-probe-adc', from: 'probe', to: 'adc' },
        { id: 'e-adc-topk', from: 'adc', to: 'topk' },
      ],
    }, { title: 'Search probes lists, scores PQ codes, then keeps top-k' }),
    highlight: { active: ['centroids', 'probe', 'adc'], found: ['topk'] },
    explanation: 'At query time, the exact query first finds nearby coarse centroids. Faiss scans only those lists, computes asymmetric distances against PQ codes, and maintains the nearest candidate ids.',
    invariant: 'nprobe is the recall-latency dial: more lists, more candidates, higher recall.',
  };

  yield {
    state: labelMatrix(
      'Asymmetric distance computation',
      [
        { id: 'sub0', label: 'subspace 0' },
        { id: 'sub1', label: 'subspace 1' },
        { id: 'sub2', label: 'subspace 2' },
        { id: 'sub3', label: 'subspace 3' },
      ],
      [
        { id: 'precompute', label: 'query table' },
        { id: 'candidate', label: 'candidate code' },
        { id: 'score', label: 'score lookup' },
      ],
      [
        ['D0[*]', '17', 'D0[17]'],
        ['D1[*]', '4', 'D1[4]'],
        ['D2[*]', '88', 'D2[88]'],
        ['D3[*]', '31', 'D3[31]'],
      ],
    ),
    highlight: { active: ['sub0:score', 'sub1:score', 'sub2:score', 'sub3:score'] },
    explanation: 'The query stays full precision. For each subspace, precompute distance from the query residual to every centroid code. Candidate scoring becomes a sequence of small table lookups and additions.',
  };

  yield {
    state: labelMatrix(
      'CPU and GPU shape',
      [
        { id: 'batch', label: 'batch queries' },
        { id: 'tables', label: 'lookup tables' },
        { id: 'select', label: 'k-selection' },
        { id: 'transfer', label: 'host/device' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['parallelism', 'tail latency'],
        ['shared/register', 'fit limits'],
        ['fast top-k', 'hot path'],
        ['throughput', 'copy cost'],
      ],
    ),
    highlight: { found: ['batch:helps', 'tables:helps', 'select:helps'], compare: ['transfer:risk'] },
    explanation: 'Faiss is not only an algorithm catalog. The GPU work mattered because vector search has harsh hardware bottlenecks: distance math, compressed-code lookup, and top-k selection all need careful kernels.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'badTrain', label: 'bad training set' },
        { id: 'lowProbe', label: 'low nprobe' },
        { id: 'badM', label: 'bad M/nbits' },
        { id: 'shift', label: 'model shift' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['empty or huge lists', 'retrain'],
        ['misses neighbors', 'probe more'],
        ['distortion', 'larger code'],
        ['recall drops', 'rebuild'],
      ],
    ),
    highlight: { active: ['badTrain:symptom', 'lowProbe:symptom', 'shift:symptom'], found: ['badTrain:fix', 'lowProbe:fix'] },
    explanation: 'IVF-PQ is learned infrastructure. Its quality depends on training data, embedding distribution, list balance, code size, reranking budget, and whether the embedding model has changed since the index was built.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'index recipe') yield* indexRecipe();
  else if (view === 'query execution') yield* queryExecution();
  else throw new InputError('Pick a Faiss IVF-PQ view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The build view shows IVF-PQ creating a compressed nearest-neighbor index. IVF means inverted file: vectors are assigned to coarse centroid lists. PQ means product quantization: each vector residual is split into subspaces and stored as short codebook ids.',
      'The query view shows candidate generation. Active nodes are centroids, lists, or codes currently being scored; found nodes are candidates in the top-k heap; compare nodes are distances that may replace the current worst candidate. The safe inference rule is limited: unprobed lists are skipped for speed, not proven empty of true nearest neighbors.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg',
          alt: 'Voronoi diagram partitioning a 2D plane into nearest-point cells',
          caption: 'IVF partitions the vector space into Voronoi cells, each owned by a coarse centroid. At query time, only the nearest cells are searched. The animation mirrors this: the "coarse" node decides which list a vector belongs to. Source: Wikimedia Commons (CC BY-SA 4.0).',
        },
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Vector search starts with embeddings: arrays of numbers that place similar items near each other. Exact search compares the query vector with every stored vector and returns the nearest k. That is the right baseline, but it becomes expensive when the corpus reaches millions or billions of vectors.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Euclidean_distance_2d.svg',
          alt: 'Euclidean distance between two points on a coordinate plane',
          caption: 'At the heart of vector search is a distance computation -- typically L2 (Euclidean) or inner product. Flat search computes this distance against every stored vector, which is exact but O(n). Source: Wikimedia Commons (CC BY 4.0).',
        },
      'IVF-PQ exists to cut both candidate count and bytes per candidate. IVF searches only selected coarse lists. PQ stores compact codes instead of full float vectors.',
        {
          type: 'callout',
          text: 'IVF-PQ trades exactness for speed at two levels: coarse routing skips most vectors entirely, and product quantization compresses the survivors from thousands of bytes to tens of bytes.',
        },
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is flat search. Store each vector as float32 values, compute a distance to every vector, and keep the nearest k in a heap. It is exact, simple, and essential as the recall oracle for evaluating approximate indexes.',
      'Flat search is not naive at small scale. With 100,000 vectors of dimension 128, a well-batched CPU or GPU scan may be fast enough. The trouble begins when memory bandwidth, replica count, and query rate grow faster than the product can afford.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is linear scanning over large dense arrays. A 768-dimensional float32 vector costs 3,072 bytes. One hundred million vectors cost about 307 GB before ids, metadata, replicas, and exact rerank copies.',
        {
          type: 'callout',
          text: 'The wall is linear in two dimensions simultaneously: memory grows with vector count, and latency grows with vector count. IVF-PQ attacks both.',
        },
      'Latency has the same shape. Exact search over 100 million vectors must evaluate 100 million distances for one query. Hardware parallelism helps, but it does not change the fact that every request streams a large fraction of the corpus.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Separate search into routing and compressed scoring. K-means learns coarse centroids that partition the vector space into lists. A query probes only the nearest lists, then scores compressed candidate codes inside them.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/K_Means_Example_Step_4.svg',
          alt: 'K-means clustering converged result showing data points assigned to cluster centroids',
          caption: 'IVF training runs k-means on representative embeddings to learn coarse centroids. Each centroid defines one inverted list. At query time, only the lists nearest the query are scanned. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
      'Residual PQ is the compression step. After a vector is assigned to centroid c, the index stores an encoding of x - c rather than x itself. That residual is split into subspaces, and each subspace stores one learned codebook id.',
        {
          type: 'callout',
          text: 'The residual trick is critical: subtracting the coarse centroid removes the "where in the space" component, leaving only the "how far from the centroid" component. This smaller residual compresses far better under product quantization.',
        },
    ] },
    { heading: 'How it works', paragraphs: [
      'Training comes first. The index learns nlist coarse centroids and M product-quantizer codebooks from representative vectors. Every database vector is assigned to one coarse list, converted to a residual, encoded as M small ids, and stored with its external id.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/K_Means_Example_Step_1.svg',
          alt: 'K-means step 1: initial random centroid placement among data points',
          caption: 'K-means begins with random centroids and iteratively refines assignments. Faiss trains centroids on a representative sample of embeddings. Poor training data leads to imbalanced or empty lists. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
      'At query time, the full query is compared with coarse centroids, and nprobe selects how many lists to scan. Inside each list, asymmetric distance computation keeps the query full precision while using lookup tables for compressed database codes. A bounded heap keeps the best approximate candidates.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'IVF-PQ works when nearby vectors are likely to share coarse cells and when PQ distortion is small enough for ranking. Neither condition is guaranteed. The index is correct only relative to the probed candidate set and the approximate distance rule.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Coloured_Voronoi_2D.svg',
          alt: 'Colored Voronoi tessellation showing space partitioned into distinct cells',
          caption: 'Each colored region is a Voronoi cell: all points closer to that cell\'s centroid than any other. IVF exploits this partition -- a query\'s true nearest neighbors usually fall in the same cell or adjacent cells. Probing multiple cells (nprobe > 1) recovers neighbors near cell boundaries. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
      'Reranking can repair ordering error inside the candidate pool. If exact vectors are available for the best 1,000 approximate candidates, the final top 10 can be exact among those 1,000. Reranking cannot recover a true neighbor that lived in an unprobed list.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Flat search costs O(n * d) distance work per query. IVF-PQ costs centroid search plus scans over selected lists, roughly O(nlist * d + scanned_codes * M) before rerank. The behavior is fewer candidates and cheaper candidate scoring.',
      'Use real numbers. With 100 million 768-dimensional vectors, flat storage is about 307 GB. An IVF4096,PQ64x8 index stores about 64 bytes of PQ code plus 8 bytes of id per vector, or about 7.2 GB before list and centroid overhead.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'IVF-PQ fits semantic search, image similarity, recommendation candidate generation, duplicate detection, and retrieval-augmented generation. The access pattern is many high-dimensional vectors, approximate first-stage retrieval, and a separate recall measurement against flat search.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/KnnClassification.svg',
          alt: 'K-nearest neighbor classification with decision boundaries around a query point',
          caption: 'kNN classification relies on finding the nearest neighbors of a query. At billion scale, exact kNN is too expensive for real-time serving. IVF-PQ provides the approximate candidate set that makes large-scale kNN practical. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
      'It is useful when memory is the binding constraint. Compression can make room for replicas, hot standby indexes, tenant shards, or GPU-resident serving. The system usually keeps exact vectors somewhere else when final reranking matters.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'IVF-PQ fails when missing a neighbor is unacceptable. Legal matching, security blocklists, and medical lookup may need exhaustive candidate completeness. An approximate index can still be used as a prefilter only if the system has a conservative verification layer.',
      'It also fails when training data stops representing serving data. A new embedding model, new language mix, or tenant-specific distribution can make centroids imbalanced and PQ codes inaccurate. Filters can make this worse by discarding most ANN candidates after search.',
        {
          type: 'callout',
          text: 'IVF-PQ is learned infrastructure. Its quality depends on training data, embedding distribution, list balance, code size, and whether the embedding model has changed since the index was built. Treat index builds like model deployments: version them, evaluate them, and monitor them.',
        },
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose a RAG service stores 100 million passage embeddings with dimension 768. The exact baseline needs 100 million distance comparisons per query and about 307 GB for raw vectors. The team trains IVF4096,PQ64x8 and sets nprobe to 16.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Kdtree_2d.svg',
          alt: 'Kd-tree space partitioning showing recursive axis-aligned splits',
          caption: 'Space-partitioning structures like kd-trees are a foundational approach to nearest-neighbor search. IVF-PQ uses a different partitioning strategy -- Voronoi cells from k-means -- but the principle is the same: organize vectors so queries only visit a small region. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
      'If vectors are evenly distributed, each of 4,096 lists holds about 24,414 vectors. Probing 16 lists scans about 390,624 compressed codes, or 0.39 percent of the corpus. Each code has 64 subquantizer ids, so ADC scoring is about 25 million table lookups instead of 76.8 billion float component comparisons.',
      'The result is a candidate set, not a proof. If recall@10 against flat search is 0.93, then 7 out of 100 true top-10 neighbors are missing on average. Raising nprobe to 32 may improve recall but roughly doubles list-scan work.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: the Faiss documentation and wiki on indexes, the Faiss paper, and the original product quantization paper by Jegou, Douze, and Schmid. Study IndexFlat, IndexIVF, IndexIVFPQ, nlist, nprobe, M, and nbits.',
      'Study next: k-means, heaps, quantization, HNSW, residual quantization, reranking, and recall evaluation. The main lesson is that approximate search is a budgeted candidate generator, not a replacement for measuring against exact search.',
    ] },
  ],
};
