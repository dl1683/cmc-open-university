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
    explanation: `${topic.title.replace(' for Vector Search', '')} splits a high-dimensional embedding into smaller subvectors. Each subspace has its own learned codebook, usually from K-Means Clustering. Instead of storing all float coordinates, the database stores one codebook index per subspace.`,
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
    explanation: `If each subspace uses ${256} centroids, each subvector can be stored in one byte. A 768-dimensional float32 vector is ${768 * 4} bytes. With 96 one-byte PQ codes, the compressed representation is 96 bytes plus shared codebooks — a ${Math.round(768 * 4 / 96)}x compression. The cost is quantization error.`,
    invariant: `${topic.title.split(' ')[0]} ${topic.title.split(' ')[1]} trades exact coordinates for compact codes and approximate distances.`,
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
    explanation: `At search time, keep the query exact. Precompute its distance to every centroid in every subspace, then score a compressed database vector by summing a few table lookups. This is why ${topic.title} is so useful in vector databases and FAISS-style indexes.`,
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
    explanation: `An inverted file index, or IVF, clusters vectors into coarse lists. Search probes the nearest coarse lists and ignores the rest. ${topic.title.split(' ').slice(0, 2).join(' ')} then scores compressed vectors inside those lists. The system is two-stage: coarse recall first, compact scoring second.`,
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
    explanation: `${topic.title} is not one magic setting. It exposes a recall, memory, and latency frontier. That is the same mindset as HNSW (Vector Search at Scale), Quantization, and Threshold Optimization: choose knobs by measured workload, not by vibes.`,
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
    explanation: `A production vector stack often combines methods: IVF or HNSW for candidates, ${topic.title.split(' ').slice(0, 2).join(' ')} for memory compression, and exact reranking on the top results. The useful lesson is composition, not allegiance to one index.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as the same vector seen through a different storage contract. The full vector has floating-point coordinates, while the compressed row stores one code per subspace.',
        'Active cells show which slice is being encoded or scored. Found cells show the compact representation that will be kept in the index.',
        {type: 'image', src: './assets/gifs/product-quantization.gif', alt: 'Animated walkthrough of the product quantization visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Vector databases store embeddings, which are arrays of numbers representing meaning for text, images, users, or products. A 768-dimensional float32 embedding uses 3,072 bytes before ids, metadata, and index overhead.',
        {type: 'callout', text: 'PQ makes billion-scale vector search practical by replacing full coordinates with codebook addresses plus fast lookup-table distance sums.'},
        'At one billion vectors, raw embeddings require about 3.1 TB just for coordinates. Product quantization, or PQ, exists because retrieval systems often hit memory bandwidth and memory capacity before arithmetic becomes the bottleneck.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is flat search over full vectors. Store every coordinate, compute exact distances from the query to every candidate, and sort the results.',
        'This is simple and gives the best distance estimate. It also reads thousands of bytes per candidate, so a large corpus becomes a memory traffic problem.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is resident memory. If the index cannot fit in fast memory, queries spill to slower storage or need fewer replicas.',
        'Graph indexes such as HNSW reduce how many vectors are visited, but each visited vector may still require full coordinates. The remaining problem is the byte cost of every candidate score.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to split one high-dimensional vector into smaller subvectors and quantize each subvector separately. A codebook is a learned table of representative subvectors called centroids.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt: 'Colored Voronoi cells around nearest seed points', caption: 'A codebook partitions a subspace into nearest-centroid regions, the same geometric idea visible in a Voronoi diagram. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euclidean_Voronoi_diagram.svg.'},
        'If each subspace has 256 centroids, one byte can name the nearest centroid. A vector with 96 subspaces becomes 96 bytes of codes instead of 3,072 bytes of float32 coordinates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training takes sample embeddings, splits every vector into the same subspaces, and runs k-means inside each subspace. The result is one codebook per slice of the vector.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing rows and columns combining', caption: 'Vector retrieval systems are built from regular numeric layouts; PQ changes which numbers must be read for each candidate score. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'Encoding stores the nearest centroid id for each subspace. Search keeps the query exact, precomputes query-to-centroid distances, then scores each compressed vector by table lookup and summation.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'IVF-PQ is a staged retrieval graph: coarse routing first, compressed scoring second, exact reranking last. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'PQ works when nearest centroid choices preserve enough of the original geometry. Retrieval does not need every approximate distance to be perfect; it needs the true neighbors to survive into the candidate set.',
        'The correctness claim is therefore a ranking claim, not an exact-distance claim. Exact reranking on the final candidates can recover precision after PQ has made the wide scan cheap.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For a d-dimensional vector split into m subspaces, encoding computes nearest centroids in each subspace. Storage is m code bytes when each subspace uses 256 centroids, plus shared codebooks.',
        'Search precomputes m by k distances for the query, then scores each candidate with m table reads and additions. If m is 96 and k is 256, the query table has 24,576 distances, while each candidate score reads only 96 small codes.',
        'The behavior is a memory trade. More subspaces or more bits reduce distortion, but they increase bytes per vector and lookup-table size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PQ is used in image retrieval, semantic search, recommendation, duplicate detection, and large RAG corpora. It is strongest when an approximate first stage feeds a better reranker.',
        'It often appears with inverted file indexes. IVF narrows the search to a few coarse lists, PQ scores compressed vectors inside those lists, and exact reranking checks the final shortlist.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PQ fails when quantization error changes the neighbor ordering that the product cares about. Rare topics, minority languages, fresh embedding distributions, and dense clusters can be harmed even when average recall looks fine.',
        'It also fails when teams treat approximate distances as exact scores. PQ compresses geometry; it does not repair bad chunking, weak embeddings, stale codebooks, or missing authorization filters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take an 8-dimensional vector and split it into 4 subvectors of 2 dimensions each. With 256 centroids per subspace, each subvector stores one byte, so the vector uses 4 bytes instead of 8 * 4 = 32 bytes.',
        'For a query, suppose the lookup distances for a stored vector\'s codes are 0.04, 0.10, 0.31, and 0.08. The approximate squared distance is 0.53, computed without reading any original coordinates.',
        'For one billion such 768-dimensional vectors split into 96 subspaces, raw float32 storage is about 3.1 TB. PQ codes are about 96 GB, before metadata and codebooks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Jegou, Douze, and Schmid, "Product Quantization for Nearest Neighbor Search", and the FAISS documentation. Then study k-means, embeddings and similarity, HNSW, IVF-PQ, ScaNN, reciprocal rank fusion, and cross-encoder reranking.',
      ],
    },
  ],
};
