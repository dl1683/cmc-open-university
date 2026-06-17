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
    {
      heading: 'Why IVF-PQ exists',
      paragraphs: [
        `Dense vector search asks a simple question at punishing scale: given a query embedding, which stored embeddings are closest? A flat index answers exactly by comparing the query with every vector. That is the clean baseline, and it is often the first thing to build. It also becomes expensive fast. One billion 768-dimensional float32 vectors require roughly three terabytes just for raw vector payloads, before ids, metadata, replicas, and serving overhead. Exact scanning then spends distance-computation time on every candidate, even though only a tiny fraction can enter the top-k.`,
        `Faiss IVF-PQ is a production recipe for making that search cheaper. IVF means inverted file: train coarse centroids, assign each vector to its nearest centroid, and store vectors in centroid-owned lists. PQ means product quantization: split a vector or residual into subspaces and replace each subvector with a small codebook id. The index searches only a few coarse lists and scores compressed codes before optional exact reranking. The result is approximate nearest-neighbor search with explicit knobs for memory, latency, and recall.`,
        `The important lesson is composition. IVF alone reduces the number of candidates scanned but still stores full vectors. PQ alone compresses vectors but still leaves the system with too many possible candidates. Together, they create a two-stage index: route broadly with coarse quantization, score cheaply with compact codes, and spend exact distance only where it is likely to matter.`,
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        `The naive vector index is Flat. Store every embedding as float32, compute the distance from the query to every stored vector, and keep the nearest k. Flat is exact, easy to test, and hard to beat for small collections or offline evaluation. It also gives the reference recall number for every approximate system. If an approximate index cannot be compared against flat search on a representative sample, the team does not know what it is losing.`,
        `The wall is memory bandwidth and candidate count. For high-dimensional embeddings, exact distance computation reads a large amount of memory per vector. The CPU or GPU may do simple arithmetic, but it must stream huge arrays and maintain top-k selection. At web or retrieval-augmented-generation scale, the index may need to serve many tenants, many replicas, and frequent refreshes. Exact search becomes too costly, or it pushes teams toward fewer vectors, smaller histories, weaker recall, or expensive hardware.`,
        `Graph indexes such as HNSW solve many workloads by navigating neighbor links, but they bring their own memory overhead and update behavior. IVF-PQ occupies a different point in the design space. It is especially attractive when the vectors are large, the collection is huge, memory is the hard limit, and the service can trade some recall for compression plus reranking.`,
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        `IVF-PQ separates vector search into routing and compressed scoring. Routing asks which coarse regions of the space the query should inspect. Scoring asks which compressed candidates inside those regions are closest enough to survive. This is the same broad pattern as many retrieval systems: use a cheap stage to create a candidate set, then use a more accurate stage to refine it.`,
        `The coarse stage is trained with k-means. If the index has nlist lists, training learns nlist centroids. Each database vector is assigned to its nearest centroid. The list stores the vector id and its compressed representation. At query time, the query compares itself with the centroids and probes the nearest nprobe lists. More probes usually mean better recall and higher latency. Fewer probes mean cheaper search and more missed neighbors.`,
        `The PQ stage compresses the remaining local information. In residual IVF-PQ, the index stores x - c, where c is the vector's coarse centroid. That residual is split into M subspaces. Each subspace is quantized by a small codebook, often with 8 bits per subquantizer. A code such as PQ64x8 stores 64 byte-sized ids rather than the original float vector. The code is lossy, but it is small enough to scan quickly.`,
      ],
    },
    {
      heading: 'How query execution works',
      paragraphs: [
        `A query starts as a full-precision vector. The index first searches the coarse centroids and picks nprobe lists. If nprobe is 8, the system scans only the candidates assigned to the 8 nearest coarse regions. This is approximate because the true nearest neighbor might be assigned to the 9th list, or to a list whose centroid is not especially close even though one member is.`,
        `Inside a probed list, Faiss can score PQ codes using asymmetric distance computation. The query remains full precision, while the database vector is represented by codebook ids. For each subspace, the system precomputes a lookup table: distance from the query subvector to every centroid in that subquantizer's codebook. A candidate code is then scored by reading one table entry per subspace and summing the results. This replaces many floating-point operations and vector reads with compact table lookups.`,
        `The top-k stage maintains the best candidate ids seen so far. If exact vectors are stored separately, the service can rerank a larger approximate candidate set using true distances. Reranking is often the difference between an index that is merely small and one that is useful. IVF-PQ can cheaply propose candidates; exact rerank can repair some quantization error at a controlled memory-read budget.`,
      ],
    },
    {
      heading: 'Knobs and tradeoffs',
      paragraphs: [
        `The main IVF knobs are nlist and nprobe. More lists create smaller buckets, which can reduce scanned candidates when the clustering is good. Too many lists can produce empty or tiny buckets and make training brittle. nprobe is the runtime recall-latency dial. Raising it scans more lists and usually recovers more neighbors, but tail latency rises because more codes must be scored.`,
        `The main PQ knobs are M and nbits. M is the number of subquantizers. Larger M gives more pieces and usually lower distortion, but the code grows. nbits controls the number of centroids per subquantizer. Eight bits means 256 possible values per subspace and one byte per subquantizer. A 64-subquantizer, 8-bit code is 64 bytes, far smaller than a 768-dimensional float32 vector. The tradeoff is quantization error: two vectors that are different in float space may collapse to similar code distances.`,
        `Rerank depth is the quality-recovery knob. The service can ask IVF-PQ for the top 100 or 1000 approximate candidates, fetch exact vectors for those candidates, and compute true distances. This improves final recall but adds memory reads and storage overhead. Many real systems tune these knobs against recall at k, latency percentiles, memory per vector, build time, update cost, and dollars per query rather than against a single average number.`,
      ],
    },
    {
      heading: 'Why it works on hardware',
      paragraphs: [
        `IVF-PQ works because it attacks the two expensive resources directly. IVF reduces how many candidates are scanned. PQ reduces how much memory is needed per candidate and how expensive each approximate distance is. In modern systems, memory movement often matters as much as arithmetic. Scanning compact codes can be faster than reading full vectors even if the scoring logic is more complicated.`,
        `Faiss matters because implementation details are part of the algorithm at scale. Batching queries improves throughput. GPU kernels must manage lookup tables, memory coalescing, and fast k-selection. CPU paths must care about cache layout and SIMD. A poor implementation of the same mathematical idea can lose the entire benefit to memory stalls or selection overhead.`,
        `This is also why the index is trained infrastructure, not just a data structure. The training set must represent the embedding distribution that the service will search. If the embedding model changes, the vector distribution may shift. Coarse centroids and PQ codebooks learned on old data can become a bad fit, causing list imbalance, higher distortion, and recall loss.`,
      ],
    },
    {
      heading: 'Where it is used and where it fails',
      paragraphs: [
        `IVF-PQ is useful in billion-scale semantic search, image retrieval, recommendation candidate generation, duplicate detection, and retrieval-augmented generation where a compressed first-stage index feeds a stronger reranker. It is a strong candidate when the service needs many vectors in memory, can tolerate approximate candidates, and can tune recall with nprobe and reranking.`,
        `It fails when exact recall is mandatory, when the training distribution is not representative, or when filters dominate the query. Metadata filters are especially important. If a query must search only one tenant, one jurisdiction, or one document type, probing global vector clusters first may scan many ineligible candidates. Some systems solve this with per-filter indexes, hybrid filtering, prefilter-aware search, or reranking that understands the metadata constraints. Without that, the measured ANN recall can look good while product recall is poor.`,
        `It can also struggle with frequent updates. New vectors can be assigned to existing lists, but the centroids and codebooks may age. Deletions can leave fragmented lists. A service with rapid embedding-model changes may need rebuild pipelines, shadow indexes, and live recall monitoring. IVF-PQ is powerful, but it is not a universal replacement for HNSW, ScaNN, DiskANN, flat search, or learned sparse retrieval.`,
      ],
    },
    {
      heading: 'Case study: compressed RAG retrieval',
      paragraphs: [
        `Suppose a RAG system stores hundreds of millions of passage embeddings. Flat search gives the cleanest baseline, but memory cost limits replicas and increases serving expense. The team trains an IVF-PQ index on a representative sample of passage embeddings. Each passage is assigned to a coarse centroid, encoded as a residual PQ code, and stored with its document id. The service keeps exact vectors or original embeddings for a bounded rerank stage.`,
        `At query time, the retriever embeds the question, probes the nearest coarse lists, scores PQ codes, and returns a candidate pool. The reranker fetches exact vectors for the top candidates and recomputes true distances before passing passages to a cross-encoder or generator. The evaluation does not stop at ANN recall. It checks whether the gold passage appears in the candidate pool, whether reranking restores it, whether final answer quality changes, and whether p95 latency and memory per vector meet the serving budget.`,
        `The most revealing failures come from slices: rare languages, short questions, long documents, tenants with unusual vocabulary, and fresh embeddings after a model upgrade. Averages can hide a damaged slice. A serious IVF-PQ deployment tracks recall by slice, list balance, query probes, exact-rerank depth, rebuild age, and cost per successful retrieval.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study k-means first, because IVF is a clustering layer. Then study vector quantization and product quantization, because PQ is a lossy coding scheme with geometric consequences. HNSW gives the graph-index contrast: high recall and strong latency, but with different memory and update tradeoffs. ScaNN and DiskANN show other points in the ANN design space. RAG pipeline topics show how approximate search quality propagates into answer quality.`,
        `Primary sources include the Faiss documentation, the Faiss indexes wiki, the Faiss library paper, and Billion-scale similarity search with GPUs. When reading them, pay attention to the systems details: code layout, lookup tables, batching, GPU selection, and evaluation methodology. The production question is not whether IVF-PQ is clever. It is whether a particular trained index, on a particular embedding distribution, meets recall, latency, memory, rebuild, and operational-cost targets.`,
      ],
    },
  ],
};
