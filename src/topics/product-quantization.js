// Product quantization for vector search: split an embedding into subspaces,
// quantize each subspace, store short codes, and estimate distances through
// lookup tables instead of full vectors.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'product-quantization',
  title: 'Product Quantization for Vector Search',
  category: 'AI & ML',
  summary: 'Compress high-dimensional embeddings into short subvector codes so billion-scale vector search can fit in memory.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['encode vectors', 'IVF plus PQ search'], defaultValue: 'encode vectors' },
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

function* encodeVectors() {
  yield {
    state: labelMatrix(
      'Split one embedding into subspaces',
      [
        { id: 'x', label: 'vector x' },
        { id: 'q', label: 'query q' },
        { id: 'store', label: 'stored form' },
      ],
      [
        { id: 'sub1', label: 'dims 1-2' },
        { id: 'sub2', label: 'dims 3-4' },
        { id: 'sub3', label: 'dims 5-6' },
        { id: 'sub4', label: 'dims 7-8' },
      ],
      [
        ['0.2,0.7', '1.1,0.4', '0.3,0.9', '1.7,1.1'],
        ['0.1,0.8', '1.0,0.2', '0.8,0.7', '1.4,1.4'],
        ['code 3', 'code 1', 'code 7', 'code 2'],
      ],
    ),
    highlight: { active: ['x:sub1', 'x:sub2', 'x:sub3', 'x:sub4'], found: ['store:sub1', 'store:sub2'] },
    explanation: 'Product Quantization splits a high-dimensional embedding into smaller subvectors. Each subspace has its own learned codebook, usually from K-Means Clustering. Instead of storing all float coordinates, the database stores one codebook index per subspace.',
  };

  yield {
    state: labelMatrix(
      'Each subspace chooses a centroid code',
      [
        { id: 'sub1', label: 'subspace 1' },
        { id: 'sub2', label: 'subspace 2' },
        { id: 'sub3', label: 'subspace 3' },
        { id: 'sub4', label: 'subspace 4' },
      ],
      [
        { id: 'nearest', label: 'nearest centroid' },
        { id: 'bytes', label: 'stored bytes' },
        { id: 'loss', label: 'loss' },
      ],
      [
        ['c3', '1 byte', 'small error'],
        ['c1', '1 byte', 'small error'],
        ['c7', '1 byte', 'medium error'],
        ['c2', '1 byte', 'small error'],
      ],
    ),
    highlight: { found: ['sub1:bytes', 'sub2:bytes', 'sub3:bytes', 'sub4:bytes'], compare: ['sub3:loss'] },
    explanation: 'If each subspace uses 256 centroids, each subvector can be stored in one byte. A 768-dimensional float32 vector is 3,072 bytes. With 96 one-byte PQ codes, the compressed representation is 96 bytes plus shared codebooks. The cost is quantization error.',
    invariant: 'PQ trades exact coordinates for compact codes and approximate distances.',
  };

  yield {
    state: labelMatrix(
      'Asymmetric distance computation',
      [
        { id: 'sub1', label: 'subspace 1' },
        { id: 'sub2', label: 'subspace 2' },
        { id: 'sub3', label: 'subspace 3' },
        { id: 'sub4', label: 'subspace 4' },
        { id: 'sum', label: 'sum' },
      ],
      [
        { id: 'query_to_code', label: 'distance q to code' },
        { id: 'lookup', label: 'lookup table' },
      ],
      [
        ['0.04', 'D1[c3]'],
        ['0.10', 'D2[c1]'],
        ['0.31', 'D3[c7]'],
        ['0.08', 'D4[c2]'],
        ['0.53', 'approx distance'],
      ],
    ),
    highlight: { active: ['sub1:lookup', 'sub2:lookup', 'sub3:lookup', 'sub4:lookup'], found: ['sum:query_to_code'] },
    explanation: 'At search time, keep the query exact. Precompute its distance to every centroid in every subspace, then score a compressed database vector by summing a few table lookups. This is why PQ is so useful in vector databases and FAISS-style indexes.',
  };
}

function* ivfPlusPqSearch() {
  yield {
    state: labelMatrix(
      'IVF narrows the search before PQ scoring',
      [
        { id: 'list0', label: 'coarse list 0' },
        { id: 'list1', label: 'coarse list 1' },
        { id: 'list2', label: 'coarse list 2' },
        { id: 'list3', label: 'coarse list 3' },
      ],
      [
        { id: 'centroid', label: 'coarse centroid' },
        { id: 'probe', label: 'probe?' },
        { id: 'contents', label: 'compressed vectors' },
      ],
      [
        ['near q', 'yes', 'PQ codes'],
        ['far', 'no', 'skip'],
        ['near q', 'yes', 'PQ codes'],
        ['far', 'no', 'skip'],
      ],
    ),
    highlight: { found: ['list0:probe', 'list2:probe'], removed: ['list1:probe', 'list3:probe'] },
    explanation: 'An inverted file index, or IVF, clusters vectors into coarse lists. Search probes the nearest coarse lists and ignores the rest. PQ then scores compressed vectors inside those lists. The system is two-stage: coarse recall first, compact scoring second.',
  };

  yield {
    state: labelMatrix(
      'Vector search knobs',
      [
        { id: 'nlist', label: 'more coarse lists' },
        { id: 'nprobe', label: 'more probes' },
        { id: 'm', label: 'more subquantizers' },
        { id: 'bits', label: 'more bits/code' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'costs', label: 'costs' },
      ],
      [
        ['faster pruning', 'training and recall risk'],
        ['higher recall', 'more scanned vectors'],
        ['lower distortion', 'more bytes per vector'],
        ['finer centroids', 'larger lookup tables'],
      ],
    ),
    highlight: { active: ['nprobe:helps', 'm:helps'], compare: ['nprobe:costs', 'm:costs'] },
    explanation: 'PQ is not one magic setting. It exposes a recall, memory, and latency frontier. That is the same mindset as HNSW (Vector Search at Scale), Quantization, and Threshold Optimization: choose knobs by measured workload, not by vibes.',
  };

  yield {
    state: labelMatrix(
      'Where PQ sits among vector-search tools',
      [
        { id: 'flat', label: 'flat search' },
        { id: 'hnsw', label: 'HNSW' },
        { id: 'ivfpq', label: 'IVF-PQ' },
        { id: 'rerank', label: 'rerank exact' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'latency', label: 'latency' },
        { id: 'quality', label: 'quality' },
      ],
      [
        ['huge', 'slow at scale', 'exact'],
        ['large graph', 'fast', 'approx'],
        ['small codes', 'fast', 'approx with distortion'],
        ['top candidates only', 'moderate', 'recovers precision'],
      ],
    ),
    highlight: { found: ['ivfpq:memory', 'ivfpq:latency'], compare: ['flat:quality', 'rerank:quality'] },
    explanation: 'A production vector stack often combines methods: IVF or HNSW for candidates, PQ for memory compression, and exact reranking on the top results. The useful lesson is composition, not allegiance to one index.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'encode vectors') yield* encodeVectors();
  else if (view === 'IVF plus PQ search') yield* ivfPlusPqSearch();
  else throw new InputError('Pick a Product Quantization view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Product Quantization is a compression method for approximate nearest-neighbor search. It splits a high-dimensional vector into subspaces, quantizes each subspace with a small codebook, and stores the codebook indices instead of the full vector.',
        'The case study matters because vector databases are memory-bound systems. A billion 768-dimensional float32 vectors would require terabytes of memory before metadata. PQ makes compressed-domain search possible by trading exact coordinates for short codes and approximate distances.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Train a codebook for each subspace, commonly with K-Means Clustering. To encode a database vector, split it into subvectors and replace each subvector with the id of its nearest centroid. To search, keep the query exact, precompute distances from each query subvector to each centroid, and score a compressed vector by summing table lookups.',
        'In an IVF-PQ index, a coarse quantizer first assigns vectors to inverted lists. Search probes only the nearest lists, then uses PQ codes to score compressed candidates. Exact reranking can recover quality by reading full vectors for a small top-k candidate set.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'PQ reduces memory dramatically, but it introduces quantization error. More subquantizers or more bits per code reduce error but increase memory and lookup cost. More IVF probes improve recall but scan more vectors. The right configuration depends on the embedding distribution, latency target, recall target, hardware, and reranking budget.',
        'The most useful mental model is a budget ledger. Full vectors buy exact distances but spend memory bandwidth on every candidate. PQ spends training time and accuracy margin to buy much smaller resident indexes. IVF spends recall by skipping whole coarse lists, then buys it back with more probes. Exact reranking spends a little full-vector work on the final shortlist. A good system records these costs separately instead of reporting one vague "vector database speedup."',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PQ appears in FAISS, image retrieval, video search, recommender retrieval, semantic search, RAG Pipeline systems, and vector databases that need to hold large corpora cheaply. It is especially useful when full-precision vectors are too expensive to keep hot in memory.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'PQ is not the same as scalar Quantization. It learns codebooks over vector subspaces. It is also not a replacement for evaluation: compressed search can silently drop recall for minority clusters, rare queries, or distribution shifts. Production systems should measure recall@k and reranking quality on representative traffic.',
        'A second pitfall is assuming the codebooks stay healthy forever. If the embedding model changes, if the corpus shifts, or if one tenant contributes vectors with a very different geometry, old centroids can become poor summaries. Production pipelines usually need rebuild plans, canary recall checks, and enough metadata to compare compressed candidates against exact Flat search samples.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: "Product Quantization for Nearest Neighbor Search" at https://inria.hal.science/inria-00514462v2/document, "Billion-scale similarity search with GPUs" at https://arxiv.org/abs/1702.08734, and Meta FAISS overview at https://engineering.fb.com/2017/03/29/data-infrastructure/faiss-a-library-for-efficient-similarity-search/. Study Embeddings & Similarity, HNSW (Vector Search at Scale), Quantization, K-Means Clustering, MinHash & Locality-Sensitive Hashing, ScaNN Vector Search Case Study, Faiss IVF-PQ Case Study, and RAG Pipeline next.',
      ],
    },
  ],
};
