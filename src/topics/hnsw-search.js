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
      heading: 'Why this exists',
      paragraphs: [
        'HNSW, short for Hierarchical Navigable Small World, is a graph index for approximate nearest-neighbor search. Given a query vector, it tries to find nearby stored vectors without comparing the query with every vector in the collection.',
        {type: 'callout', text: 'HNSW wins by making vector search navigable: sparse upper layers find a neighborhood, dense lower layers spend work locally.'},
        'The brute-force baseline is exact and simple: compute the distance from the query to every stored vector, then sort or select the closest k. That is fine for thousands of vectors. It is too expensive for interactive search over millions of high-dimensional embeddings unless you can spend large amounts of hardware on exact scan.',
        'HNSW trades exactness for speed. It builds a multi-layer proximity graph, uses sparse upper layers for long moves, descends into denser layers for local search, and returns a high-recall candidate set that can be reranked if the application needs more precision.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The reasonable first attempt is exact kNN. Keep the vectors in an array, compute cosine, dot product, or L2 distance for every row, and return the closest results. It has excellent correctness and terrible scaling: query time grows with corpus size times vector dimension.',
        'A second attempt is to cluster the space and search only the closest cluster. That can work, but it adds training, partition-boundary misses, and extra tuning. HNSW takes a different route: keep the data as a graph of local neighborhoods, then navigate the graph from far away to nearby.',
        'The wall is that nearest-neighbor search has no sorted one-dimensional order to exploit. You need a structure that makes large parts of the space unlikely without pretending high-dimensional geometry is a simple array.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core idea is a layered proximity graph. The bottom layer contains every vector and many short-range neighbor links. Higher layers contain exponentially fewer vectors and longer-range links. Search starts from an entry point in the top layer, greedily moves toward the query, then drops down and repeats with finer links.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Skip_list.svg', alt: 'Skip list diagram with multiple forward-pointer levels', caption: 'HNSW uses a layered search idea similar in spirit to skip lists. Source: Wikimedia Commons, Skip list.'},
        'This is why HNSW is often compared to a skip list. A skip list adds sparse express lanes over a sorted list. HNSW adds sparse express layers over a metric neighborhood graph. The analogy is useful, but not perfect: HNSW search is approximate and depends on vector geometry, graph quality, and candidate-set width.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The top row is the sparse highway layer. Only a few stored vectors have copies there, and the edges are long. When the active node moves across the highway, the search is using a cheap long-range comparison to get into the right neighborhood.',
        'The vertical edge is the descent. It does not move to a different vector; it moves to the same vector in a denser layer. That state change matters because the algorithm is trading stride length for precision.',
        'The bottom row is the base graph where every vector lives. The animation shows a single greedy route so the navigation idea is easy to see. Real HNSW uses a candidate set on the base layer, controlled by efSearch or ef, so it can explore more than one promising local path before returning top-k results.',
        'The visited nodes are the cost you paid. The found node is the best answer along this route, not a mathematical proof that every other vector is farther away. HNSW is fast because it avoids most comparisons; it is approximate because avoided comparisons can hide a better point.',
      
        {type: 'image', src: './assets/gifs/hnsw-search.gif', alt: 'Animated walkthrough of the hnsw search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction inserts vectors one at a time. Each new vector receives a random maximum layer, with high layers becoming rare. The index searches from the current entry point to find neighbors for the new vector, then links the vector into each layer up to its maximum. A neighbor-selection heuristic keeps links useful instead of simply connecting to the closest points that may all sit in one tiny cluster.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between labeled nodes', caption: 'At query time, HNSW follows graph edges toward vectors that are closer to the target. Source: Wikimedia Commons, Directed graph.'},
        'Querying starts from the entry point at the highest layer. Upper layers usually use greedy descent: move to a neighbor if it is closer to the query, stop when no neighbor improves the distance, then drop down. At the bottom layer, the algorithm keeps a dynamic candidate list and a result set. It expands candidates until the remaining frontier cannot improve the current top-k under the search budget.',
        'The key knobs have engine-specific names and defaults. In pgvector, m controls max connections per layer and defaults to 16, ef_construction controls the construction candidate list and defaults to 64, and hnsw.ef_search controls query candidate width and defaults to 40. In hnswlib, M and ef_construction are set at index initialization, while ef controls query-time accuracy versus speed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'HNSW works when the graph has navigable small-world structure. Long links get the search near the query quickly. Short links refine the result locally. Random layer assignment keeps upper layers sparse without needing training. The bottom-layer candidate set recovers from some greedy mistakes by exploring multiple nearby options.',
        'The correctness claim is deliberately weaker than exact search. HNSW does not prove that the returned neighbor is globally nearest in all cases. It gives a measured recall-latency tradeoff. Raising efSearch explores more candidates and usually improves recall at higher latency. Raising construction effort usually improves graph quality at higher build cost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the top-right query, the search enters the highway at a left-side vector, hops across the sparse layer toward a vector closer to the query, then drops to the base layer. The highway step avoids checking every base node on the way across the space.',
        'Once on the base layer, local edges take over. The search compares nearby graph neighbors, moves closer when a neighbor improves the distance, and stops when the candidate budget is exhausted or no candidate can beat the current result. On the tiny animation, touching a few of ten nodes is the visible win. At production scale, the same principle can turn millions of possible comparisons into hundreds or thousands of candidate checks, depending on recall target and data.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Exact scan costs O(n * d) distance work for n vectors of dimension d. HNSW adds an index so live query work is usually far below n, but there is no worst-case guarantee worth selling as exact logarithmic search. Bad geometry, poor parameters, adversarial data, or strict filters can force much more work.',
        'Memory is roughly vector storage plus graph links, often described as O(n * M) edges with upper-layer and metadata overhead. Larger M improves connectivity and recall but uses more memory. Larger ef_construction improves build quality but slows build and insert. Larger efSearch improves query recall but raises latency.',
        'Updates are not free. Inserts are supported by many engines, but they must link into an existing graph. Deletes may be tombstoned or handled lazily, and many deletes can degrade graph quality or waste memory until rebuild. Filtered search is a separate problem: if metadata filters remove most candidates after graph search, recall and result count can collapse unless the engine uses filter-aware strategies.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HNSW wins for low-latency semantic search, recommendation candidate retrieval, duplicate detection, image similarity, code search, and RAG retrieval when memory is available and high recall matters. It is popular because it needs no training phase, handles incremental insertion better than many partitioned indexes, and exposes understandable knobs.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes and edges', caption: 'Embedding systems often feed HNSW with vectors produced by neural models. Source: Wikimedia Commons, Colored neural network.'},
        'It is a strong default when the corpus fits in memory or mostly in memory, vectors are reasonably well behaved, and the product can tolerate approximate recall followed by reranking. It pairs well with exact rerank over the returned candidates and with a recall-latency ledger that chooses efSearch by route.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use HNSW when the contract requires exact nearest neighbors and you cannot rerank or fall back to exact search. Do not expect it to rescue bad embeddings, wrong distance metrics, or inconsistent vector normalization. The index can only navigate the geometry it is given.',
        'HNSW is also a poor fit when memory is tight, filters are highly selective, delete rates are high, data changes constantly, or cold-start build time is unacceptable. IVF, product quantization, disk-backed graph search, brute-force GPU scan, or hybrid filtered indexes may fit those constraints better.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Malkov and Yashunin, "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs," https://arxiv.org/abs/1603.09320; hnswlib docs and parameters at https://github.com/nmslib/hnswlib; pgvector HNSW docs at https://github.com/pgvector/pgvector; and Faiss HNSW implementation docs at https://faiss.ai/cpp_api/struct/structfaiss_1_1IndexBinaryHNSW.html.',
        'Study Embeddings and Similarity before tuning distance metrics, RAG Pipeline for the retrieval application loop, Skip List for the layered-navigation analogy, Graph BFS for graph traversal basics, Product Quantization and ScaNN for alternative ANN strategies, Filtered Vector Search Bitset Gates for metadata filters, and ANN Recall-Latency Pareto Ledger for measuring efSearch instead of guessing it.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why HNSW (Vector Search at Scale) moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
