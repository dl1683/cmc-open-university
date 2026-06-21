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
        'Product Quantization is a vector-compression method for approximate nearest-neighbor search. It takes a high-dimensional embedding, splits it into smaller subvectors, and replaces each subvector with the id of a learned centroid. The stored representation is no longer a list of floating-point coordinates. It is a short code made of several codebook ids. Search estimates distance by looking up the query-to-centroid distances for those ids and summing them.',
        {type: 'callout', text: 'PQ makes billion-scale vector search practical by replacing full coordinates with codebook addresses plus fast lookup-table distance sums.'},
        'The reason this matters is memory. A single 768-dimensional float32 embedding uses 3,072 bytes before metadata, ids, graph links, or index overhead. A billion such vectors require terabytes. Many retrieval systems are limited less by arithmetic than by memory bandwidth and resident set size. PQ trades exact coordinates for compact codes, making it possible to keep much larger vector indexes hot, scan more candidates per second, or fit a billion-scale search system onto realistic hardware.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is flat search over full vectors. Store every embedding as float32 or float16, compute exact distances or inner products, and sort the results. This is simple and high quality. It also becomes expensive as the corpus grows because every candidate comparison reads hundreds or thousands of dimensions. Approximate indexes such as HNSW reduce the number of candidates, but the vectors themselves still consume memory and the graph adds additional overhead.',
        'Another obvious approach is scalar quantization, where each coordinate is compressed independently. That helps, but it ignores correlations between dimensions. Embedding dimensions often work together. PQ attacks the problem at the subvector level. Instead of rounding each coordinate separately, it learns a small vocabulary of representative subvectors for each slice of the embedding. The wall it breaks is the memory wall: enough compression to make large-scale approximate search practical while preserving enough geometry for useful recall.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to approximate a large vector as the Cartesian product of several smaller codebooks. Split a vector into m subspaces. For each subspace, learn k centroids from training vectors, often with k-means. A database vector is encoded by choosing the nearest centroid in each subspace. If k is 256, each centroid id fits in one byte. A vector with 96 subspaces can be stored as 96 bytes plus shared codebooks, rather than thousands of bytes of coordinates.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt: 'Colored Voronoi cells around nearest seed points', caption: 'A codebook partitions a subspace into nearest-centroid regions, the same geometric idea visible in a Voronoi diagram. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euclidean_Voronoi_diagram.svg.'},
        'The word product comes from the combination of choices. Each subspace has its own codebook, and the final approximate vector is formed by the product of those independent choices. This creates an enormous implicit codebook without storing every full-dimensional centroid. With 96 subspaces and 256 choices per subspace, the number of possible reconstructed vectors is astronomically large, but storage for one database item is only 96 one-byte codes. That is the compression advantage.',
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        'Training builds the codebooks. Take a sample of embeddings, split each embedding into the same subspaces, and run k-means inside each subspace. The result is a table of centroids for subspace 1, another for subspace 2, and so on. Encoding a database vector means splitting it and storing the nearest centroid id for each subspace. The index stores item ids, compressed PQ codes, optional coarse-list assignments, and sometimes residual information if the system uses residual or optimized variants.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing rows and columns combining', caption: 'Vector retrieval systems are built from regular numeric layouts; PQ changes which numbers must be read for each candidate score. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'Search usually uses asymmetric distance computation. The query remains exact. For each query subvector, compute its distance to every centroid in the corresponding subspace. This creates a small lookup table per subspace. To score a compressed database vector, read its centroid id for each subspace, fetch the precomputed distance from the table, and sum the values. The database vector is never fully decompressed for the approximate scoring pass. A top-k heap tracks the best candidates, and exact reranking can read full vectors for the final shortlist if they are available.',
      ],
    },
    {
      heading: 'IVF plus PQ',
      paragraphs: [
        'PQ is often paired with an inverted file index. A coarse quantizer clusters the full vector space into large cells, also called lists. Each database vector is assigned to a coarse list and then stored inside that list as PQ codes, often for the residual between the vector and the coarse centroid. At query time, the system finds the nearest coarse centroids, probes only those lists, and uses PQ lookup tables to score compressed candidates inside them. This is the familiar IVF-PQ pattern in FAISS-style systems.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'IVF-PQ is a staged retrieval graph: coarse routing first, compressed scoring second, exact reranking last. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The two-stage structure exposes important knobs. More coarse lists can reduce list length but increase training and assignment sensitivity. More probes increase recall but scan more compressed vectors. More subquantizers or more bits per subquantizer reduce distortion but use more memory. Exact reranking improves final precision but requires access to full vectors or a better stored representation. A production IVF-PQ system is therefore not one algorithm setting; it is a tuned memory, latency, and recall frontier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when local subspace centroids approximate the embedding distribution well enough for nearest-neighbor ranking. Search rarely needs perfect distance for every item. It needs a good enough ordering of candidates so that likely neighbors survive into the final top-k or exact rerank. PQ preserves coarse geometry while dramatically reducing memory traffic. The lookup-table scoring path is especially attractive because it replaces many floating-point coordinate reads with compact code reads and table additions.',
        'The method also composes with the rest of a vector stack. HNSW can use compressed vectors for memory savings in some configurations. IVF can narrow the candidate region before PQ scoring. A cross-encoder or full-vector reranker can restore precision after approximate retrieval. In RAG systems, PQ may be the difference between keeping the whole corpus in a fast vector service and pushing older embeddings to slow storage. The quality loss is real, but the system can spend the savings on wider candidate generation or deeper reranking.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'PQ is useful in image retrieval, video search, semantic search, recommendation, duplicate detection, and large RAG corpora where vector count is the dominant cost. It is especially useful when the application can tolerate approximate recall at the first stage because a later stage reranks the shortlist. It also helps multi-tenant systems where each tenant wants a private or filtered search space but hardware budgets do not allow full-precision copies of every embedding.',
        'It is less about making one query mathematically elegant and more about making the system fit. A billion-vector index that does not fit in memory is not merely slower; it may be operationally impossible. PQ lets engineers choose a smaller resident index, more replicas, faster warmup, cheaper disaster recovery, or larger candidate pools. Those are product decisions as much as algorithm decisions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PQ fails when quantization error changes the neighbor ordering in important slices. Rare classes, minority languages, new content types, and dense clusters can be damaged even if average recall looks acceptable. If the embedding model changes but the codebooks are not retrained, the old centroids may no longer describe the new vector geometry. If one tenant or domain has a very different distribution, global codebooks can underfit that slice. Compression can hide these problems until users ask long-tail queries.',
        'It also fails when people confuse compressed search with exact search. PQ distance is an estimate. It should not be presented as the same score as full-vector distance. More aggressive compression can improve latency while silently hurting downstream answer quality. IVF probing can skip the correct coarse list. Small training samples can build poor codebooks. Bad chunking or poor embeddings cannot be repaired by PQ. The method compresses geometry; it does not create relevance.',
      ],
    },
    {
      heading: 'Evaluation and operational signals',
      paragraphs: [
        'Evaluate PQ against an exact or higher-quality baseline. Measure recall@k for compressed search versus flat full-vector search on representative queries. Slice the measurement by language, tenant, document source, topic, age, entity rarity, and query type. Track nDCG or MRR after reranking, not only raw recall, because the final user experience depends on the whole cascade. Compare several settings for m, bits per code, coarse-list count, probe count, and rerank depth.',
        'Operational dashboards should report index size, bytes per vector, codebook version, build time, training sample size, quantization distortion, list-size skew, probes per query, scanned codes per query, p95 latency, and exact-rerank hit rate. Canary jobs should run exact flat search on a small traffic sample and compare the production compressed result. Rebuild plans matter. A healthy system knows when embedding drift, corpus growth, or tenant skew requires retraining codebooks instead of just adding more hardware.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study the original Product Quantization for Nearest Neighbor Search paper, then FAISS and billion-scale similarity search with GPUs to see how PQ becomes an engine. In this curriculum, connect PQ to Embeddings and Similarity, K-Means Clustering, Quantization, HNSW, ScaNN, Faiss IVF-PQ, Multi-Index RAG, and Cross-Encoder Reranker. Those topics show how vectors are produced, compressed, searched, and corrected by later precision stages.',
        'The practical takeaway is that PQ is a memory design for retrieval systems. It replaces full vectors with short codes, replaces coordinate scans with lookup-table sums, and accepts controlled distortion so a much larger search problem can fit. Use it when the memory savings change what the system can serve. Tune it with recall curves, not intuition. Keep exact checks and rerankers in the loop so compression remains an engineering tradeoff rather than an invisible source of lost evidence.',
      ],
    },
  ],
};
