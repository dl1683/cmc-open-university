// DiskANN: graph ANN designed around RAM plus SSD, with cached routing,
// bounded I/O, quantized vectors, and later fresh/filtered search variants.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'diskann-ssd-vector-search-case-study',
  title: 'DiskANN SSD Vector Search Case Study',
  category: 'AI & ML',
  summary: 'A graph ANN case study where the hard problem is not only nearest neighbors, but doing it with most vectors on SSD and a small RAM routing budget.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ssd graph search', 'fresh and filtered'], defaultValue: 'ssd graph search' },
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

function* ssdGraphSearch() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query', x: 0.7, y: 4.0, note: 'vector' },
        { id: 'ram', label: 'RAM', x: 2.4, y: 4.0, note: 'entry cache' },
        { id: 'ssd', label: 'SSD graph', x: 4.4, y: 4.0, note: 'neighbors' },
        { id: 'beam', label: 'beam', x: 6.4, y: 4.0, note: 'candidates' },
        { id: 'answer', label: 'top-k', x: 8.2, y: 4.0, note: 'rerank' },
      ],
      edges: [
        { id: 'e-query-ram', from: 'query', to: 'ram' },
        { id: 'e-ram-ssd', from: 'ram', to: 'ssd' },
        { id: 'e-ssd-beam', from: 'ssd', to: 'beam' },
        { id: 'e-beam-answer', from: 'beam', to: 'answer' },
      ],
    }, { title: 'DiskANN treats SSD reads as part of the data structure' }),
    highlight: { active: ['ram', 'ssd', 'beam'], found: ['answer'] },
    explanation: 'DiskANN keeps enough routing information in memory to start well, then performs graph search with bounded SSD reads. The graph is designed so each disk fetch brings useful neighbors, not random wasted pages.',
    invariant: 'The storage tier is not an implementation detail; it shapes the index.',
  };

  yield {
    state: labelMatrix(
      'Memory budget split',
      [
        { id: 'coords', label: 'full vectors' },
        { id: 'pq', label: 'compressed copy' },
        { id: 'graph', label: 'adjacency' },
        { id: 'cache', label: 'navigation cache' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['SSD', 'exact or rerank'],
        ['RAM/SSD', 'cheap scoring'],
        ['SSD', 'neighbors'],
        ['RAM', 'avoid cold starts'],
      ],
    ),
    highlight: { active: ['cache:where', 'pq:purpose'], found: ['coords:where', 'graph:where'] },
    explanation: 'A billion-vector system cannot casually keep every float and every edge hot. DiskANN splits duties across compressed vectors, neighbor lists, exact data, and a small memory-resident cache.',
  };

  yield {
    state: labelMatrix(
      'Beam search over disk pages',
      [
        { id: 'frontier', label: 'frontier' },
        { id: 'read', label: 'read page' },
        { id: 'score', label: 'score nbrs' },
        { id: 'prune', label: 'prune beam' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['best unseen nodes', 'too narrow'],
        ['fetch neighbors', 'I/O stall'],
        ['rank candidates', 'PQ error'],
        ['bound work', 'miss route'],
      ],
    ),
    highlight: { active: ['frontier:goal', 'read:goal', 'prune:goal'], compare: ['read:risk'] },
    explanation: 'The query maintains a candidate frontier. Each expansion reads neighbors for promising nodes, scores them, and keeps only the best beam. The data structure has to minimize the number of random disk reads needed for high recall.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'dataset size pressure', min: 0, max: 100 }, y: { label: 'RAM pressure', min: 0, max: 100 } },
      series: [
        { id: 'flat', label: 'flat exact', points: [{ x: 10, y: 20 }, { x: 50, y: 70 }, { x: 100, y: 98 }] },
        { id: 'hnsw', label: 'in-memory graph', points: [{ x: 10, y: 30 }, { x: 50, y: 82 }, { x: 100, y: 100 }] },
        { id: 'diskann', label: 'DiskANN tiered graph', points: [{ x: 10, y: 22 }, { x: 50, y: 38 }, { x: 100, y: 52 }] },
      ],
    }),
    highlight: { found: ['diskann'], compare: ['flat', 'hnsw'] },
    explanation: 'The chart is conceptual. DiskANN exists because the RAM curve matters: a graph ANN index can be fast and still financially or physically impossible if all vectors and edges must stay memory-resident.',
  };
}

function* freshAndFiltered() {
  yield {
    state: graphState({
      nodes: [
        { id: 'insert', label: 'insert', x: 0.8, y: 4.0, note: 'new vector' },
        { id: 'links', label: 'links', x: 2.7, y: 4.0, note: 'neighbors' },
        { id: 'delete', label: 'delete', x: 4.6, y: 4.0, note: 'tombstone' },
        { id: 'repair', label: 'repair', x: 6.5, y: 4.0, note: 'recall' },
        { id: 'serve', label: 'serve', x: 8.4, y: 4.0, note: 'online' },
      ],
      edges: [
        { id: 'e-insert-links', from: 'insert', to: 'links' },
        { id: 'e-links-delete', from: 'links', to: 'delete' },
        { id: 'e-delete-repair', from: 'delete', to: 'repair' },
        { id: 'e-repair-serve', from: 'repair', to: 'serve' },
      ],
    }, { title: 'Fresh ANN means updates cannot silently rot the graph' }),
    highlight: { active: ['insert', 'delete', 'repair'], found: ['serve'] },
    explanation: 'A static graph is already hard. A live vector database also needs inserts, deletes, and stable recall while the graph changes under traffic. Fresh-DiskANN-style work treats update repair as part of the index contract.',
    invariant: 'Serving freshness without recall collapse requires graph maintenance, not only append-only storage.',
  };

  yield {
    state: labelMatrix(
      'Filtered vector query',
      [
        { id: 'pre', label: 'filter first' },
        { id: 'inline', label: 'inline filter' },
        { id: 'post', label: 'post filter' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['small candidate set', 'fragmented graph'],
        ['search stays aware', 'more logic'],
        ['simple pipeline', 'low recall'],
      ],
    ),
    highlight: { active: ['inline:benefit'], compare: ['pre:failure', 'post:failure'] },
    explanation: 'Filtered vector search combines relational predicates with nearest-neighbor ranking. If filtering is bolted on after ANN, the nearest eligible result may never enter the candidate set.',
  };

  yield {
    state: labelMatrix(
      'Provider-shaped DiskANN3',
      [
        { id: 'memory', label: 'memory provider' },
        { id: 'disk', label: 'disk provider' },
        { id: 'kv', label: 'key-value store' },
        { id: 'btree', label: 'B-tree provider' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['fast baseline', 'volatile'],
        ['larger than RAM', 'I/O tuning'],
        ['database mapping', 'system glue'],
        ['storage layout', 'page design'],
      ],
    ),
    highlight: { found: ['disk:role', 'kv:role', 'btree:role'], compare: ['disk:tradeoff'] },
    explanation: 'The newer DiskANN3 framing exposes providers for different storage backends. That makes the data structure look less like a standalone library and more like a database component.',
  };

  yield {
    state: labelMatrix(
      'What to measure',
      [
        { id: 'recall', label: 'recall@k' },
        { id: 'latency', label: 'p95 latency' },
        { id: 'io', label: 'I/O reads' },
        { id: 'fresh', label: 'freshness' },
      ],
      [
        { id: 'why', label: 'why it matters' },
        { id: 'hidden', label: 'hidden trap' },
      ],
      [
        ['answer quality', 'easy queries'],
        ['user cost', 'averages lie'],
        ['SSD budget', 'tail stalls'],
        ['live data', 'stale graph'],
      ],
    ),
    highlight: { active: ['recall:why', 'latency:why', 'io:why', 'fresh:why'], compare: ['latency:hidden'] },
    explanation: 'Disk-backed ANN should be judged as a system: recall, latency distribution, I/O count, update behavior, filtering accuracy, memory footprint, and rebuild cost all matter.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ssd graph search') yield* ssdGraphSearch();
  else if (view === 'fresh and filtered') yield* freshAndFiltered();
  else throw new InputError('Pick a DiskANN view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Vector search starts with a simple promise: given an embedding, return nearby embeddings that probably represent similar items. The difficult version appears when the collection is too large to keep every full vector and every graph edge in RAM. A billion vectors can make an otherwise elegant in-memory nearest-neighbor index financially or physically unrealistic.',
        'DiskANN exists for that pressure point. It treats SSD storage, RAM cache, graph layout, compressed scoring, and beam search as one data structure. The goal is not merely to store vectors on disk. The goal is to spend a small number of useful SSD reads per query while keeping recall high enough for search, recommendation, or retrieval-augmented generation.',
        {type: 'callout', text: 'DiskANN works because the graph, beam, cache, compression, and SSD layout are tuned as one bounded-I/O data structure.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/2023_Dysk_SSD_Patriot_P210_2TB.jpg', alt: 'A 2.5-inch solid-state drive photographed on a neutral background.', caption: '2.5-inch Patriot P210 SSD, Jacek Halicki, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The first approach is exact search: compute the distance from the query to every vector and sort or select the top k. Exact search is simple and gives a clean correctness story. It also scales poorly. Doubling the dataset doubles the distance computations and memory bandwidth. For high-dimensional embeddings, the scan becomes the system.',
        'The second approach is an in-memory approximate nearest-neighbor graph such as HNSW or another navigable small-world structure. Graph search is much faster than scanning because it follows edges through promising regions of vector space. That works well when the graph and vector data fit in memory. The wall appears when the graph is fast in theory but the RAM bill is the bottleneck.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'SSD is not slow RAM. A random SSD read is much cheaper than a network round trip but much more expensive than a cache hit or pointer chase in memory. If an ANN graph search performs many unpredictable disk reads, tail latency collapses. If the graph search avoids disk too aggressively, recall drops because the best neighbors never enter the candidate set.',
        'The wall is therefore not only nearest-neighbor math. It is a storage-aware search problem. The index must decide what stays in RAM, what lives on SSD, how many candidates to expand, how to score cheaply before exact rerank, and how to lay out neighbor lists so each read is likely to improve the search frontier.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'DiskANN makes the storage tier part of the data-structure invariant. A good node expansion should bring back useful neighbors, not just bytes. A small memory-resident cache should provide strong starting points and cheap approximate scores. A bounded beam should keep only candidates that are likely to improve recall enough to justify more I/O.',
        'The core trade is recall for bounded work under a memory budget. The query maintains a frontier of promising nodes. It reads neighbor lists for selected candidates from SSD, scores newly discovered candidates, prunes the frontier, and eventually reranks a small set with better distance information. The graph, cache, compression, and beam are tuned together because failure in any one part wastes the others.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A disk-backed graph ANN index stores nodes as vectors with adjacency lists. DiskANN keeps enough navigation and compressed information in memory to choose good entry points and rank candidates cheaply. Full vectors, exact rerank data, or large adjacency structures can live on SSD. The query starts from a memory-friendly routing layer instead of cold-reading arbitrary pages.',
        'Beam search is the control loop. The frontier holds candidate node IDs ordered by approximate distance to the query. The search expands promising unvisited nodes, fetches their neighbors, computes approximate or exact distances for those neighbors, and keeps the best bounded set. A wider beam improves recall because it explores more routes, but it also increases distance work and I/O. A narrow beam is faster but can miss the path around a local trap.',
        'The memory budget is split by duty. The cache avoids bad cold starts. Compressed vectors or product-quantized representations support cheap scoring. SSD-resident full vectors support final verification or reranking. Graph adjacency controls navigability. The index is good only when those pieces agree about the same latency target.',
      ],
    },
    {
      heading: 'Visual Proof',
      paragraphs: [
        'The first view proves that DiskANN is a tiered structure. The query does not jump directly to all full vectors. It uses RAM-resident routing, then SSD graph reads, then a bounded candidate beam, then a final top-k or rerank stage. Each edge in that path represents a budget decision.',
        'The memory table proves why the design is not an implementation detail. Full coordinate data, compressed scoring copies, adjacency lists, and navigation cache have different access patterns. Keeping the wrong one hot can waste RAM without improving recall. Pushing the wrong one to SSD can turn every query into a chain of random stalls.',
        'The fresh and filtered view proves the production extension. Static ANN benchmarks are cleaner than real vector databases. Real systems insert new items, delete stale items, and combine vector similarity with metadata filters. If a filter is applied only after ANN search, the nearest eligible item may never appear in the candidate set. If deletes leave dead graph routes, recall decays.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Approximate graph search works when nearby vectors are reachable through a small number of useful neighbor expansions. DiskANN adds the requirement that those expansions remain useful after some data moves to SSD. If each read exposes neighbors that are likely to include better candidates, the frontier improves quickly. If the graph is poorly constructed, each read returns noise and the beam spends I/O without moving closer to the answer.',
        'The correctness claim is probabilistic, not exact. DiskANN does not prove that it always returns the true nearest neighbors. It tries to make high recall affordable under a fixed memory and latency budget. The practical proof is empirical: recall at k, p95 or p99 latency, number of SSD reads, memory footprint, update behavior, and filtered-query quality must be measured together.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'Exact search costs O(n) distance evaluations per query. In-memory graph ANN reduces the average work by exploring a small part of the graph, but it pays RAM for vectors and edges. DiskANN trades RAM for SSD reads and a more complicated search policy. The dominant cost becomes the number and pattern of disk reads, plus distance scoring over candidates.',
        'The main knobs are graph degree, beam width, cache size, compression quality, prefetch behavior, and rerank depth. Increasing graph degree can improve routes but stores more edges. Increasing beam width can improve recall but reads more pages. More cache improves warm-start behavior but consumes RAM. More aggressive compression reduces memory and bandwidth but can rank candidates incorrectly.',
        'Updates are a separate tax. Inserts need useful links into the graph. Deletes need tombstones, cleanup, or repair so dead nodes do not become navigation traps. Freshness is not free: online updates compete with query latency and graph quality. Filtered search adds another tax because the graph must remain navigable inside a predicate-constrained subset, not only in the full vector space.',
      ],
    },
    {
      heading: 'Uses and Failure Modes',
      paragraphs: [
        'DiskANN fits semantic search, recommendation, memory retrieval, and RAG indexes where the vector collection is large, RAM is constrained, and approximate recall is acceptable if it is measured honestly. It is especially relevant when a service can budget a controlled number of SSD reads and still hit user-facing latency targets.',
        'It is the wrong tool for small datasets that fit comfortably in memory, for workloads that need exact nearest neighbors, or for applications where embedding quality is the real bottleneck. A faster index cannot repair a representation that places unrelated items together. Many retrieval systems still need chunking, lexical retrieval, hybrid ranking, reranking, access filters, and evaluation against task outcomes.',
        'The common failures are benchmark failures disguised as index wins. Average latency hides tail stalls. Recall on easy queries hides predicate-filter failures. Memory numbers exclude build-time or cache costs. Update demos ignore delete repair. RAG demos measure answer fluency instead of source recall. A disk-backed ANN system should be judged as a storage and retrieval system, not only as an algorithm line in a table.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: the NeurIPS DiskANN paper page at https://papers.nips.cc/paper/9527-rand-nsg-fast-accurate-billion-point-nearest-neighbor-search-on-a-single-node, Microsoft Research DiskANN project page at https://www.microsoft.com/en-us/research/project/project-akupara-approximate-nearest-neighbor-search-for-large-scale-semantic-search/, DiskANN repository at https://github.com/microsoft/DiskANN, and the Data Engineering Bulletin overview at https://www.microsoft.com/en-us/research/publication/the-diskann-library-graph-based-indices-for-fast-fresh-and-filtered-vector-search/.',
        'Study HNSW Search for in-memory graph navigation. Study Product Quantization and Faiss IVF-PQ for compressed scoring and partitioning. Study ScaNN Vector Search Case Study for a contrasting ANN design. Study Filtered Vector Search and Bitset Gates for predicate-aware retrieval. Study ANN Recall-Latency Pareto Ledger for evaluation discipline, then RAG Pipeline and Multi-Index RAG to connect vector search to user-visible retrieval quality.',
      ],
    },
  ],
};
