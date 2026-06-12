// HNSW: how vector databases find your nearest neighbor without checking
// everyone. A sparse "highway" layer for long hops, a dense layer for the
// final approach — skip lists meet proximity graphs.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'hnsw-search',
  title: 'HNSW (Vector Search at Scale)',
  category: 'AI & ML',
  summary: 'Greedy-hop a sparse highway layer, drop down, finish in the dense layer — nearest neighbor without a full scan.',
  controls: [
    { id: 'query', label: 'Query lands', type: 'select', options: ['top right', 'bottom left'], defaultValue: 'top right' },
  ],
  run,
};

// The dense base layer: every vector lives here (y 4.5–9.5 of the canvas).
const BASE = [
  { id: 'p0', label: '0', x: 1.0, y: 8.8 }, { id: 'p1', label: '1', x: 2.2, y: 6.0 },
  { id: 'p2', label: '2', x: 3.0, y: 8.0 }, { id: 'p3', label: '3', x: 4.2, y: 5.2 },
  { id: 'p4', label: '4', x: 5.0, y: 7.2 }, { id: 'p5', label: '5', x: 6.0, y: 9.0 },
  { id: 'p6', label: '6', x: 6.8, y: 5.6 }, { id: 'p7', label: '7', x: 8.0, y: 8.5 },
  { id: 'p8', label: '8', x: 8.6, y: 6.2 }, { id: 'p9', label: '9', x: 9.4, y: 7.8 },
];
const BASE_EDGES = [
  ['p0', 'p1'], ['p0', 'p2'], ['p1', 'p3'], ['p2', 'p4'], ['p3', 'p4'], ['p3', 'p6'],
  ['p4', 'p5'], ['p4', 'p6'], ['p5', 'p7'], ['p6', 'p8'], ['p7', 'p8'], ['p7', 'p9'], ['p8', 'p9'],
];

// The sparse highway layer: a few "elevated" copies (drawn at y 0.5–2.5).
const TOP = [
  { id: 't1', base: 'p1', x: 2.2, y: 1.5 },
  { id: 't4', base: 'p4', x: 5.0, y: 1.0 },
  { id: 't8', base: 'p8', x: 8.6, y: 1.8 },
];
const TOP_EDGES = [['t1', 't4'], ['t4', 't8']];

const QUERIES = {
  'top right': { x: 8.3, y: 8.9, answer: 'p7' },
  'bottom left': { x: 2.8, y: 5.4, answer: 'p3' },
};

const at = new Map([...BASE.map((p) => [p.id, p]), ...TOP.map((t) => [t.id, { x: t.x, y: t.y }])]);
const baseOf = new Map(TOP.map((t) => [t.id, t.base]));
const dist = (id, q) => {
  const p = baseOf.has(id) ? at.get(baseOf.get(id)) : at.get(id);
  // distances are measured in the REAL vector space (the base layer):
  // highway nodes are copies, not different vectors.
  const base = baseOf.has(id) ? at.get(baseOf.get(id)) : p;
  return Math.hypot(base.x - q.x, base.y - q.y);
};
const neighborsIn = (edges, id) => edges
  .filter((e) => e[0] === id || e[1] === id)
  .map((e) => (e[0] === id ? e[1] : e[0]));

export function* run(input) {
  const query = QUERIES[String(input.query)];
  if (!query) throw new InputError('Pick a query position.');

  const nodes = [
    ...TOP.map((t) => ({ id: t.id, label: BASE.find((b) => b.id === t.base).label, x: t.x, y: t.y, note: 'highway' })),
    ...BASE,
    { id: 'q', label: '?', x: query.x, y: query.y, note: 'query' },
  ];
  const edges = [
    ...TOP_EDGES.map(([a, b]) => ({ id: `${a}${b}`, from: a, to: b })),
    ...TOP.map((t) => ({ id: `down-${t.id}`, from: t.id, to: t.base })),
    ...BASE_EDGES.map(([a, b]) => ({ id: `${a}${b}`, from: a, to: b })),
  ];
  const snapshot = () => graphState({ nodes, edges });
  let touched = 0;

  yield {
    state: snapshot(),
    highlight: { active: ['q'] },
    explanation: 'A vector database holding 10 vectors could just compare the query (?) against all 10 — but at 100 MILLION vectors, brute force is hopeless (see Embeddings & Similarity and RAG Pipeline for why we need this constantly). HNSW\'s answer: connect nearby vectors into a graph (bottom), then add a sparse HIGHWAY layer (top) containing a few long-range copies. Search = hop the highway first, then finish locally. Skip lists meet proximity graphs.',
  };

  // greedy on the highway
  let current = 't1';
  touched += 1;
  const visited = [];
  yield {
    state: snapshot(),
    highlight: { active: ['t1', 'q'] },
    explanation: `Enter at the highway's fixed entry point (vector ${baseOf.get('t1').slice(1)}). The rule everywhere is pure GREED: measure each neighbor's distance to the query, hop to whichever is closest, stop when no neighbor beats where you stand.`,
  };
  for (;;) {
    const better = neighborsIn(TOP_EDGES, current)
      .map((n) => ({ n, d: dist(n, query) }))
      .filter(({ d }) => d < dist(current, query))
      .sort((a, b) => a.d - b.d)[0];
    if (!better) break;
    visited.push(current);
    touched += 1;
    current = better.n;
    yield {
      state: snapshot(),
      highlight: { active: [current, 'q'], visited: [...visited] },
      explanation: `Highway hop to vector ${baseOf.get(current).slice(1)} — one hop covered a huge stretch of the space. That's the entire point of the sparse layer: few nodes, long edges, big strides.`,
    };
  }

  // descend
  visited.push(current);
  current = baseOf.get(current);
  yield {
    state: snapshot(),
    highlight: { active: [current, 'q'], visited: [...visited], compare: [`down-t${current.slice(1)}`] },
    explanation: `No highway neighbor is closer — descend to the SAME vector in the dense base layer, where every vector lives and edges are short and local. The highway got us to the right neighborhood; the base layer will get us to the right house.`,
    invariant: 'Each layer down trades stride length for precision.',
  };

  // greedy on the base layer
  for (;;) {
    const better = neighborsIn(BASE_EDGES, current)
      .map((n) => ({ n, d: dist(n, query) }))
      .filter(({ d }) => d < dist(current, query))
      .sort((a, b) => a.d - b.d)[0];
    if (!better) break;
    visited.push(current);
    touched += 1;
    current = better.n;
    yield {
      state: snapshot(),
      highlight: { active: [current, 'q'], visited: [...visited] },
      explanation: `Local hop to vector ${current.slice(1)} (${dist(current, query).toFixed(2)} from the query) — short, precise steps now.`,
    };
  }

  yield {
    state: snapshot(),
    highlight: { found: [current, 'q'], visited: [...visited] },
    explanation: `Converged: vector ${current.slice(1)} is the nearest neighbor${current === query.answer ? '' : ' found by this greedy route'} — after touching ${touched} of 10 vectors instead of all 10. At scale the win explodes: HNSW finds neighbors among 100 million vectors in a few hundred hops (roughly logarithmic), which is why it powers Pinecone, pgvector, Weaviate, and FAISS — the retrieval engines under every RAG Pipeline. The fine print: it's APPROXIMATE — greedy can occasionally settle on a near-but-not-nearest vector, the price paid for never scanning everything.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `HNSW (Hierarchical Navigable Small World) is a graph-based nearest-neighbor search algorithm that trades off perfect accuracy for blazing-fast lookup over massive vector collections. Instead of comparing a query vector against millions of candidates (the brute-force horror at scale), HNSW builds a multi-layered proximity graph: a dense base where every vector lives and is wired to its neighbors, plus sparse "highway" layers above it that contain only a few vectors with long-range edges. When you search, you hop the highway first to reach the right neighborhood in a handful of steps, then descend to the base layer and walk locally to the best match.`,
        `The genius is layering: the highway covers distance fast (few nodes, long edges), the base offers precision locally (many nodes, short edges). Think of it as a skip list, but for vector space instead of sorted numbers. The M parameter (typically 16–64) controls how many neighbors each vector connects to, balancing search speed against insertion cost. Real-world recall rates are 95–99% — close enough for RAG, embeddings, semantic search — and the speedup is enormous: finding a neighbor among 100 million vectors takes milliseconds instead of weeks.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Construction begins by inserting vectors one at a time. Each new vector is placed at the base layer and assigned a random level (how far up the hierarchy it climbs, usually exponentially decaying: most vectors stay at the base, a few reach layer 1, even fewer reach layer 2). At each layer, the algorithm greedily connects the new vector to its M nearest neighbors already present. This greedy choice during insertion is the secret: local decisions yield a graph where proximity is locally coherent, allowing greedy search to work later.`,
        `Search works in reverse: start at the highest nonempty layer (usually a single entry node, often the most recently inserted vector), then greedily hop to the closest neighbor you can reach from your current position. If no neighbor is closer than where you stand, descend one layer. Once at the base, continue greedy hopping until reaching a local minimum — a vector whose neighbors are all farther away. Because the graph respects proximity and the hops are greedy, you converge to a good (usually best) match without exploring the entire graph. The algorithm never backtracks: it's a one-way descent, making it cache-friendly and GPU-ready.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Search cost is roughly O(log n) hops for n vectors, where each hop measures distance to a neighbor (typically M = 16–64 neighbors to check). Insertion is O(M · log n) — you must climb the hierarchy and link to M neighbors at each layer. Memory overhead is O(n · M · log n) in the worst case, but in practice closer to O(n · M) because most vectors sit at the base. Compared to brute-force (O(n) distance computations per query), HNSW is exponentially faster and uses modest overhead. On 100 million vectors with M=32, search touches roughly 200–400 nodes instead of 100 million, and fits in memory because each edge is just a neighbor ID, not the full vector.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `HNSW is the search backbone of every major vector database: Pinecone (serverless vector search), Weaviate (open-source), pgvector (Postgres extension), FAISS (Facebook AI Similarity Search — used in research and production at massive scale). When you ask a language model a question using Retrieval-Augmented Generation (RAG), your question is embedded into a vector, then HNSW finds the top-k relevant documents from millions in a millisecond. Recommendation systems, semantic search engines, duplicate detection, and image-similarity lookup all use HNSW under the hood. It's become the standard because it's both practical (implemented in Rust, Python, C++, JavaScript) and proven at scale (indexing billions of embeddings in production systems).`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Greedy search does not guarantee the true nearest neighbor — it can settle in a local valley far from the global best. This is acceptable because recall is high (95–99% typically) and the alternatives are either brute-force (too slow) or provably hard (nearest-neighbor search in high dimensions is NP-hard without approximation). Tuning M is critical: too high wastes memory and insertion time; too low kills search quality. Building the index is single-threaded in most implementations, so inserting millions of vectors takes time (though it's logarithmic per vector, not linear). Finally, HNSW assumes Euclidean distance (or another metric); cosine similarity requires normalization first, and other spaces (edit distance, Hamming) need careful handling or alternative structures like LSH (locality-sensitive hashing).`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Understand why HNSW matters by reading Embeddings & Similarity (what vectors mean and how to compare them) and RAG Pipeline (how retrieval fits into AI workflows). Then explore Graph BFS to see how simple breadth-first search works and why HNSW is a sophistication on top of it. For high-dimensional intuition, study K-Means Clustering to see how you might partition vectors at scale. Finally, Binary Search shows how one-dimensional greedy navigation works; HNSW generalizes that discipline to graph space.`,
      ],
    },
  ],
};

