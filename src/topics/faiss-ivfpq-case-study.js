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
      heading: 'What it is',
      paragraphs: [
        'Faiss IVF-PQ is a production pattern for approximate nearest-neighbor search over dense vectors. IVF, the inverted file, clusters vectors into coarse lists. PQ, product quantization, compresses the vector or residual inside each list into short codes. Search probes a small number of lists, scores compressed candidates, and optionally reranks a smaller result set with exact vectors.',
        'The lesson is composition. A flat index is conceptually simple but memory-heavy. HNSW is graph-heavy and very strong for many workloads. IVF-PQ is a trained, compressed, hardware-aware index that is attractive when memory is the bottleneck and recall can be recovered with enough probes or reranking.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training first learns coarse centroids, usually through k-means. Every database vector is assigned to a centroid and stored in that centroid\'s inverted list. In the common residual setup, the vector minus its coarse centroid is encoded by a product quantizer. This makes codes focus on the leftover local shape rather than the full global vector.',
        'At query time, the query searches the coarse centroids and selects nprobe lists. For each probed list, Faiss computes asymmetric distances: keep the query exact, use lookup tables for subquantizer distances, and add table entries for each candidate code. The output is an approximate top-k candidate set, often followed by exact reranking if full vectors are available.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The core dials are nlist, nprobe, M, nbits, and rerank depth. More lists can reduce scanned candidates but makes training and centroid search more delicate. More probes improve recall but increase latency. Larger PQ codes reduce distortion but increase memory. Reranking reads more exact data but often improves final quality. This is why a vector index is an empirical system, not a one-time formula.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Faiss documents itself as a library for efficient similarity search and clustering of dense vectors, including indexes for data sets that may not fit in RAM. Its research foundation includes inverted files, product quantization, optimized PQ variants, HNSW, GPU implementation, and fast k-selection. The billion-scale GPU paper highlights that nearest-neighbor search is not just math; selection, memory hierarchy, batching, and compressed-domain scoring determine whether the data structure works at scale.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat IVF-PQ as a universal replacement for HNSW, ScaNN, DiskANN, or flat search. If recall must be exact, flat or exhaustive reranking is still needed. If updates dominate, training-based partitioning can become stale. If metadata filters are strict, probing vector clusters before filtering may waste work or miss eligible neighbors unless the engine integrates filters carefully.',
        'Another mistake is benchmarking only average queries. Bad clusters, rare languages, cold tenants, long-tail embeddings, and fresh model versions can all expose recall gaps. Good evaluations separate candidate recall, reranked answer quality, latency percentiles, memory, rebuild cost, and cost per query.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Faiss documentation at https://faiss.ai/index.html, Faiss indexes wiki at https://github.com/facebookresearch/faiss/wiki/Faiss-indexes, the 2024 Faiss library paper at https://arxiv.org/html/2401.08281v4, and "Billion-scale similarity search with GPUs" at https://arxiv.org/abs/1702.08734. Study Product Quantization, HNSW Search, ScaNN Vector Search Case Study, K-Means Clustering, Quantization, RAG Pipeline, Multi-Index RAG, FINGER Graph ANN Case Study, and ANN Recall-Latency Pareto Ledger next.',
      ],
    },
  ],
};
