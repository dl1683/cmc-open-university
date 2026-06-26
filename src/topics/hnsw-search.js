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
      heading: 'How to read the animation',
      paragraphs: [
        'Each dot is a stored vector, and each edge is a neighbor link in the index graph. The query vector moves through the graph by comparing distances. Upper layers make long jumps; the bottom layer spends work locally.',
        {type: 'image', src: './assets/gifs/hnsw-search.gif', alt: 'Animated walkthrough of the hnsw search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Nearest-neighbor search asks for stored vectors closest to a query under cosine, dot-product, or L2 distance. Exact scan is simple but expensive over millions of high-dimensional embeddings. HNSW exists to get high recall without comparing against every vector.',
        {type: 'callout', text: 'HNSW wins by making vector search navigable: sparse upper layers find a neighborhood, dense lower layers spend work locally.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exact k-nearest-neighbor scan. Store vectors in an array, compute distance from the query to every row, and keep the closest k. It is correct and easy to test.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Exact scan costs O(n*d), where n is vector count and d is dimension. With 10,000,000 vectors of dimension 768, one query needs 7.68 billion coordinate operations. High-dimensional vectors also lack a sorted order that binary search can exploit.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Build a layered proximity graph. The bottom layer contains all vectors and local links, while upper layers contain fewer vectors and longer links. Search starts high, moves toward the query, descends, and refines locally.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Skip_list.svg', alt: 'Skip list diagram with multiple forward-pointer levels', caption: 'HNSW uses a layered search idea similar in spirit to skip lists. Source: Wikimedia Commons, Skip list.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction inserts vectors one by one with random maximum layers. Insertion searches from the entry point, finds neighbors, and links the new vector into each allowed layer. Querying greedily descends upper layers, then uses a candidate queue on the bottom layer controlled by efSearch.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between labeled nodes', caption: 'At query time, HNSW follows graph edges toward vectors that are closer to the target. Source: Wikimedia Commons, Directed graph.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when the graph has navigable small-world structure. Long links quickly reach a promising neighborhood, and dense local links refine the answer. The guarantee is recall at a chosen budget, not exact nearest-neighbor proof.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Query cost is visited candidates times dimension, plus graph bookkeeping. Memory is vector storage plus about O(n*M) graph links. Larger M, efConstruction, and efSearch usually improve recall but raise memory, build time, or latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HNSW fits semantic search, recommendations, duplicate detection, image similarity, code search, and RAG retrieval when memory is available and high recall matters. It often returns candidates for an exact or learned reranker.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes and edges', caption: 'Embedding systems often feed HNSW with vectors produced by neural models. Source: Wikimedia Commons, Colored neural network.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use HNSW when exact nearest neighbors are required without fallback. It is also weak when memory is tight, deletes are frequent, filters are highly selective, embeddings are poor, or distance metrics are inconsistent. The graph can only navigate the geometry it receives.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose n=1,000,000 vectors and d=768. Exact scan performs 768,000,000 coordinate operations per query before selection. At 100 queries per second, that is 76.8 billion coordinate operations per second.',
        'If HNSW visits 400 candidates, distance work is 400 * 768 = 307,200 coordinate operations. Raising efSearch to 1,000 raises work to 768,000 operations and usually improves recall. The cost knob is visible: more visited nodes buys better recall and higher latency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Malkov and Yashunin on HNSW, then compare hnswlib, pgvector, and Faiss parameter docs. Study embeddings, cosine similarity, skip lists, graph search, product quantization, IVF, filtered vector search, ANN recall measurement, and reranking next.',
      ],
    },
  ],
};
