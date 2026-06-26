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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a storage-aware nearest-neighbor search. A vector is a list of numbers that represents an item, and nearest-neighbor search asks which stored vectors are closest to a query vector. Active nodes are candidates in the search frontier, visited nodes have already spent their read budget, and found nodes are the best candidates known so far.',
        'The safe inference is local: if expanding one node discovers neighbors with smaller distance to the query, the beam can prefer those neighbors and drop worse candidates. That does not prove exact nearest neighbors. It shows how DiskANN buys high recall by spending a bounded number of SSD reads on graph neighborhoods that are likely to improve the frontier.',
        {type: 'callout', text: 'DiskANN works because the graph, beam, cache, compression, and SSD layout are tuned as one bounded-I/O data structure.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/2023_Dysk_SSD_Patriot_P210_2TB.jpg', alt: 'A 2.5-inch solid-state drive photographed on a neutral background.', caption: '2.5-inch Patriot P210 SSD, Jacek Halicki, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Vector search is used when exact keywords are too narrow. A product image, a paragraph, or a user query can be converted into an embedding, which is a numeric vector where distance roughly means semantic similarity. The hard case starts when there are hundreds of millions or billions of vectors and the full index no longer fits in random-access memory.',
        'DiskANN exists because RAM is fast but expensive, while solid-state drives are cheaper but punish random reads. The system tries to keep the navigational parts of the index hot in memory and move bulk vector data or graph pages to SSD. The target is not perfect search; it is useful recall at latency and memory levels a production service can afford.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach is exact scan. For each query, compute the distance from the query vector to every stored vector, keep the best k results, and return them. This is easy to trust because it compares against every item.',
        'The next approach is an in-memory approximate-nearest-neighbor graph. The index connects each vector to nearby vectors, then search walks through promising neighbors instead of scanning everything. That works well while vectors, edges, and routing data fit in memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Exact scan makes cost grow with the whole collection. With 1,000,000,000 vectors of 768 floats, even reading the raw coordinates dominates the query. A single query cannot afford a billion distance computations when the user expects an interactive answer.',
        'Putting the graph on SSD creates a different wall. A graph search that performs hundreds of unpredictable reads can lose its latency budget to I/O stalls. The index must make each read count, or the system becomes slower than its approximate-search promise.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'DiskANN treats memory, SSD pages, graph degree, compressed vectors, cache entries, and beam width as one design. The graph should expose useful neighbors per SSD read. The memory layer should provide good starting points and cheap approximate scoring before expensive reranking.',
        'The invariant is a bounded frontier. The search keeps a small set of promising candidates, expands only selected unvisited nodes, and prunes the frontier after new distances are computed. Quality comes from making that bounded frontier likely to contain routes toward true neighbors.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The index stores vectors as graph nodes. Each node has edges to selected nearby nodes, and the graph is built so greedy movement through neighbors tends to approach the query. DiskANN keeps some routing information and compressed vector data in RAM, while larger adjacency or full-vector data can live on SSD.',
        'A query starts from one or more cached entry nodes. The search scores candidates, expands the closest unvisited candidates in the beam, reads their neighbor lists from SSD when needed, inserts newly discovered nodes into the candidate set, and keeps only the best bounded set. At the end, it reranks a small result pool with more accurate distances.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim is approximate, so the proof is about preserved opportunity rather than guaranteed exactness. If the graph has short routes from entry points to near neighbors, and if the beam keeps enough alternatives, then each expansion has a chance to move the frontier closer to the query. The algorithm does not discard a candidate because it is impossible; it discards it because the budget says better candidates deserve the next reads.',
        'That is why recall must be measured. Recall at k asks how many of the true top k results appear in the returned top k. DiskANN is working when bounded reads, cache hits, and reranking produce high recall under the target latency, not when every mathematical nearest neighbor is guaranteed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exact search costs O(n) distance computations per query, so doubling n doubles the scan work. DiskANN replaces that with graph expansions, approximate distance computations, SSD reads, and a final rerank over a small candidate pool. The dominant behavior is usually the number of random SSD pages read and the number of candidate distances scored.',
        'Increasing graph degree stores more edges and can improve routes, but each node expansion becomes heavier. Increasing beam width explores more alternatives and often raises recall, but it reads more pages and raises tail latency. Compression saves RAM and bandwidth, but a bad compressed score can rank the wrong candidate early.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Disk-backed vector search fits semantic search services where the collection is too large for a pure RAM index but queries still need low latency. A retrieval-augmented generation system can use it to find candidate passages before a reranker or language model reads them. The index is useful when approximate recall is acceptable and measured against the application task.',
        'It also fits recommendation and memory retrieval systems with large, mostly read-heavy embeddings. The access pattern is a small query vector entering a much larger stored collection, not a transaction that updates many records. That read-heavy shape makes cache planning and SSD layout worth the engineering cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DiskANN is the wrong tool when the data fits comfortably in memory and an HNSW-style index already meets latency and recall needs. It is also wrong when exact nearest neighbors are required by contract. Approximate search can miss an item even when the implementation is healthy.',
        'Filters and updates are hard. If metadata filtering is applied only after vector search, the nearest eligible item may never enter the candidate pool. Inserts, deletes, and stale graph edges can also lower recall because the graph structure is part of the search quality, not a passive storage format.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a query searches 10,000,000 image vectors with k = 10. Exact scan computes 10,000,000 distances. If each vector has 768 four-byte floats, the raw coordinate read is about 30.7 GB before any sorting or reranking work.',
        'Now suppose DiskANN uses two cached entry nodes, beam width 32, and expands 80 SSD-resident nodes. If each page read returns one node and 64 neighbors, the search inspects about 5,120 neighbor references and reranks 200 candidate vectors. The result is not exact by proof, but the cost moved from reading tens of gigabytes to spending about 80 targeted SSD reads plus bounded scoring.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the DiskANN project at https://github.com/microsoft/DiskANN, the Microsoft Research project page at https://www.microsoft.com/en-us/research/project/project-akupara-approximate-nearest-neighbor-search-for-large-scale-semantic-search/, and the DiskANN paper page at https://papers.nips.cc/paper/9527-rand-nsg-fast-accurate-billion-point-nearest-neighbor-search-on-a-single-node. Study HNSW for in-memory graph search, product quantization for compressed scoring, and filtered vector search for predicate-aware retrieval.',
      ],
    },
  ],
};
