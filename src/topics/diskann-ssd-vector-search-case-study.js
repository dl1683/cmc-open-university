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
      heading: 'What it is',
      paragraphs: [
        'DiskANN is a graph-based approximate nearest-neighbor system designed for vector collections that are too large to keep fully in RAM. The key idea is not merely "put HNSW on disk." DiskANN designs the graph, cache, compressed vectors, and search procedure around the cost of SSD reads.',
        'That makes it a useful case study in data-structure realism. The abstract graph problem is nearest-neighbor search. The production problem is nearest-neighbor search under memory budget, storage latency, update pressure, predicate filters, and recall guarantees that users can feel.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At a high level, DiskANN uses a graph whose nodes are vectors and whose edges point to useful neighbors. Search starts from memory-resident routing information, keeps a beam of promising candidates, reads neighbor lists for selected nodes from SSD, scores candidates with compressed or exact distances, and expands until the frontier stops improving.',
        'The design depends on locality. Each disk read should reveal neighbors likely to advance the search. If the graph forces too many random reads, latency collapses. If the beam is too narrow, recall drops. If compression is too lossy, scoring picks the wrong expansions. The data structure is therefore a three-way contract between graph quality, storage layout, and distance approximation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Compared with in-memory HNSW, DiskANN tries to reduce RAM footprint by moving much of the index or vector payload to SSD. The price is I/O-sensitive latency and a harder implementation. Parameters such as beam width, cache size, graph degree, vector compression, and rerank depth control the recall-latency-memory tradeoff.',
        'Updates are a separate cost center. Inserts need new neighbor links. Deletes can leave dead references and degrade navigability. Fresh and filtered DiskANN variants exist because real vector databases are not static benchmark files: documents arrive, tenants filter by metadata, and stale or unfiltered candidate sets can break user-visible quality.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The NeurIPS 2019 DiskANN paper reported a billion-point nearest-neighbor system on a workstation with 64GB RAM and SSD storage, targeting high recall and millisecond-scale latency. Microsoft Research later framed DiskANN as a project for web and enterprise search and recommendation systems, with directions including fast, fresh, filtered, and distributed vector search. The public DiskANN3 repository now describes a composable provider model for integrating vector indexing with databases and storage engines.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The mistake is thinking "SSD is cheap RAM." It is not. DiskANN works only because the graph and search policy are designed to limit expensive reads. Another mistake is comparing indexes only by headline recall. A disk-backed system must report p95 or p99 latency, I/O reads, update stability, filter behavior, memory footprint, and rebuild cost.',
        'DiskANN also does not erase the need for embedding quality. If vectors do not encode the relevant similarity, the best graph will return wrong-but-near points. RAG systems still need chunking, hybrid retrieval, reranking, and evaluation beyond ANN recall. Compare it with ScaNN when the bottleneck is score-aware compression and partitioning rather than SSD-resident graph traversal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NeurIPS DiskANN paper page at https://papers.nips.cc/paper/9527-rand-nsg-fast-accurate-billion-point-nearest-neighbor-search-on-a-single-node, Microsoft Research DiskANN project page at https://www.microsoft.com/en-us/research/project/project-akupara-approximate-nearest-neighbor-search-for-large-scale-semantic-search/, DiskANN repository at https://github.com/microsoft/DiskANN, and Data Engineering Bulletin overview at https://www.microsoft.com/en-us/research/publication/the-diskann-library-graph-based-indices-for-fast-fresh-and-filtered-vector-search/. Study HNSW Search, Filtered Vector Search and Bitset Gates, Faiss IVF-PQ Case Study, ScaNN Vector Search Case Study, Product Quantization, RAG Pipeline, Multi-Index RAG, ANN Recall-Latency Pareto Ledger, Roaring Bitmaps, and Database Indexing next.',
      ],
    },
  ],
};
