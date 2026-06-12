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
        `HNSW, short for Hierarchical Navigable Small World, is a graph index for approximate nearest-neighbor search. Instead of comparing a query vector with every stored vector, it builds a proximity graph and searches by greedy hops. Malkov and Yashunin's 2018 paper made the method famous because it delivered high recall with practical memory and latency on million-scale vector collections.`,
        `The idea feels like a Skip List for geometry. The bottom layer contains all vectors and many short neighbor edges. Higher layers contain fewer vectors and longer edges, so search can cross the space quickly before descending into local detail. It is approximate: the answer is usually the true nearest neighbor or a very close one, but the algorithm trades a small amount of recall for a huge speedup over brute force.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insertion assigns each new vector a random maximum layer, with high layers becoming exponentially rarer. Starting from an entry point, the algorithm greedily searches upper layers to find a nearby region, descends layer by layer, and connects the new vector to selected neighbors. The parameter M controls graph degree, often around 16 to 64. efConstruction controls how wide the candidate search is while building; larger values improve recall and index quality but slow construction.`,
        `Querying uses the same hierarchy. The search starts at the top, greedily moves to closer neighbors, and descends. At the bottom layer it keeps a candidate set rather than just one path; efSearch controls that set size. Higher efSearch gives better recall and higher latency. Distance can be cosine, inner product, or Euclidean depending on vector normalization and the engine. Embeddings & Similarity explains why those choices matter.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `There is no simple worst-case O(log n) guarantee worth promising to users, because adversarial data and high dimensions can break greedy intuition. In practice, HNSW is sublinear and often log-like on well-behaved embeddings. A query may inspect hundreds or thousands of candidates instead of millions. Memory is roughly O(n * M) edges plus the vector storage itself, with extra overhead for upper layers and metadata. Building the index is more expensive than querying, and deletion or heavy updates can be awkward because graph neighborhoods become stale.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `HNSW appears in FAISS, hnswlib, Qdrant, Weaviate, Milvus, Elasticsearch, Redis vector search, and pgvector. It is the default mental model for low-latency semantic search, duplicate detection, image retrieval, recommendation candidates, and RAG Pipeline retrieval. A product with ten million 1,536-dimensional document vectors cannot afford a full scan per question; it needs a graph, partition, compression, or hardware-heavy brute-force strategy. HNSW is popular because it is strong without requiring training data.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The main misconception is treating approximate search as exact search. Recall depends on M, efConstruction, efSearch, vector quality, and the distance metric. If the embedding model is bad, no index rescues it. If recall must be 100%, use exact search or rerank a sufficiently large candidate set. Another trap is ignoring filters. Metadata filters can shrink or fragment the candidate set, making a beautiful vector graph less useful unless the database handles filtered ANN carefully.`,
        `HNSW is also not the only scale strategy. K-Means Clustering underlies IVF-style partitioning; product quantization compresses vectors; Binary Search solves a much simpler one-dimensional ordered case; Graph BFS gives the unweighted traversal baseline that HNSW bends into greedy metric navigation.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Embeddings & Similarity first, then RAG Pipeline for the application loop. Skip List explains the layered-navigation analogy, Graph BFS gives the graph-search baseline, K-Means Clustering shows partition-based ANN intuition, and Markov Chains & Steady States builds comfort with graph walks even though HNSW search itself is greedy, not a Markov process.`,
      ],
    },
  ],
};