// FINGER: speed up graph-based approximate nearest-neighbor search by
// approximating distance computations that are unlikely to change the top-k set.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'finger-graph-ann-case-study',
  title: 'FINGER Graph ANN Case Study',
  category: 'Papers',
  summary: 'Amazon-backed graph ANN acceleration: use residual-vector geometry to approximate low-value distance checks during greedy HNSW-style search.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['search bottleneck', 'residual shortcut'], defaultValue: 'search bottleneck' },
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

function annGraph(title) {
  return graphState({
    nodes: [
      { id: 'q', label: 'q', x: 1.0, y: 3.8, note: 'query' },
      { id: 'c', label: 'c', x: 3.2, y: 3.8, note: 'current' },
      { id: 'a', label: 'a', x: 5.4, y: 2.2, note: 'candidate' },
      { id: 'b', label: 'b', x: 5.5, y: 3.8, note: 'candidate' },
      { id: 'd', label: 'd', x: 5.4, y: 5.4, note: 'candidate' },
      { id: 'heap', label: 'top-k', x: 8.2, y: 3.8, note: 'upper bound' },
    ],
    edges: [
      { id: 'e-q-c', from: 'q', to: 'c', weight: '' },
      { id: 'e-c-a', from: 'c', to: 'a', weight: '' },
      { id: 'e-c-b', from: 'c', to: 'b', weight: '' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: '' },
      { id: 'e-a-heap', from: 'a', to: 'heap', weight: '' },
      { id: 'e-b-heap', from: 'b', to: 'heap', weight: '' },
      { id: 'e-d-heap', from: 'd', to: 'heap', weight: '' },
    ],
  }, { title });
}

function* searchBottleneck() {
  yield {
    state: annGraph('Graph ANN search spends most time scoring neighbors'),
    highlight: { active: ['q', 'c'], compare: ['a', 'b', 'd'], found: ['heap'] },
    explanation: 'In HNSW-style graph search, the algorithm reaches a current node c and evaluates its neighbors against query q. Only neighbors that beat the current top-k upper bound can change the search frontier.',
  };

  yield {
    state: labelMatrix(
      'Most candidate distances do not change the frontier',
      [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'd', label: 'd' },
        { id: 'e', label: 'e' },
      ],
      [
        { id: 'exact', label: 'exact d(q,x)' },
        { id: 'bound', label: 'top-k bound' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['0.39', '0.42', 'keep'],
        ['0.55', '0.42', 'ignore'],
        ['0.81', '0.42', 'ignore'],
        ['0.77', '0.42', 'ignore'],
      ],
    ),
    highlight: { active: ['b:effect', 'd:effect', 'e:effect'], found: ['a:effect'] },
    explanation: 'The FINGER observation is pragmatic: once the top-k bound is tight, many exact distance computations only prove that a neighbor is too far away. Those computations are expensive and often non-influential.',
    invariant: 'If a candidate cannot beat the upper bound, exact precision is wasted for frontier updates.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'greedy search step', min: 0, max: 10 }, y: { label: 'share of distances above bound', min: 0, max: 1 } },
      series: [
        { id: 'waste', label: 'above bound', points: [
          { x: 1, y: 0.25 }, { x: 2, y: 0.43 }, { x: 3, y: 0.58 }, { x: 4, y: 0.71 },
          { x: 5, y: 0.82 }, { x: 6, y: 0.86 }, { x: 7, y: 0.88 }, { x: 8, y: 0.89 },
        ] },
      ],
      markers: [
        { id: 'turn', x: 5, y: 0.82, label: 'over 80%' },
      ],
    }),
    highlight: { active: ['waste'], found: ['turn'] },
    explanation: 'The local writeup emphasizes the key empirical pattern from the paper: after several greedy steps, most candidate distances are larger than the current bound and do not affect the result.',
  };

  yield {
    state: labelMatrix(
      'FINGER changes the search side, not graph construction',
      [
        { id: 'hnsw', label: 'HNSW graph' },
        { id: 'finger', label: 'FINGER' },
        { id: 'rerank', label: 'final rerank' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['navigable graph', 'same recall knobs still matter'],
        ['approx far distances', 'bad pruning if approximation lies'],
        ['exact on survivors', 'extra pass costs time'],
      ],
    ),
    highlight: { active: ['finger:job'], compare: ['hnsw:risk', 'rerank:risk'] },
    explanation: 'The idea composes with a graph ANN system. Build the graph as usual, use approximate geometry to skip low-value exact checks, then preserve quality with exact scoring where it matters.',
  };
}

function* residualShortcut() {
  yield {
    state: plotState({
      axes: { x: { label: 'basis direction c', min: -1.5, max: 1.5 }, y: { label: 'residual plane', min: -1.5, max: 1.5 } },
      series: [
        { id: 'neighbors', label: 'neighbors of c', points: [
          { x: 0.7, y: 0.4 }, { x: 0.9, y: -0.2 }, { x: 1.1, y: 0.1 }, { x: 0.6, y: -0.5 },
        ] },
      ],
      markers: [
        { id: 'q', x: 0.8, y: 0.25, label: 'q' },
        { id: 'd', x: 1.1, y: -0.45, label: 'd' },
        { id: 'c', x: 1.0, y: 0.0, label: 'c' },
      ],
      vectors: [
        { id: 'qres', from: { x: 0.8, y: 0 }, to: { x: 0.8, y: 0.25 }, label: 'q residual' },
        { id: 'dres', from: { x: 1.1, y: 0 }, to: { x: 1.1, y: -0.45 }, label: 'd residual' },
      ],
    }),
    highlight: { active: ['qres', 'dres'], found: ['q', 'd'], compare: ['c'] },
    explanation: 'FINGER decomposes q and a candidate d relative to a previously visited node c: projection along c plus a residual vector orthogonal to c. The distance estimate depends on the residual angle.',
  };

  yield {
    state: labelMatrix(
      'Approximate distance from reusable geometry',
      [
        { id: 'known', label: 'known' },
        { id: 'pre', label: 'precompute' },
        { id: 'estimate', label: 'estimate' },
        { id: 'decide', label: 'decide' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['d(q,c)', 'current node already scored'],
        ['neighbor residuals', 'cheap angle clues'],
        ['d(q,d)', 'avoid full vector scan'],
        ['below bound?', 'exact or skip'],
      ],
    ),
    highlight: { active: ['known:object', 'pre:object', 'estimate:object'], found: ['decide:purpose'] },
    explanation: 'The distance shortcut is not random guessing. It uses vector algebra around the local neighborhood of c, plus precomputed neighbor structure, to estimate whether d is promising.',
  };

  yield {
    state: labelMatrix(
      'Quality guardrail',
      [
        { id: 'near', label: 'near bound' },
        { id: 'far', label: 'far away' },
        { id: 'topk', label: 'top-k list' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['compute exact', 'could change result'],
        ['approx ok', 'unlikely to matter'],
        ['rerank exact', 'protect recall'],
        ['measure recall@k', 'catch pruning errors'],
      ],
    ),
    highlight: { found: ['near:action', 'topk:action', 'audit:action'], compare: ['far:action'] },
    explanation: 'Approximation belongs behind a guardrail. If a neighbor might beat the current bound, compute exact distance. Use shortcuts mainly for candidates that look safely outside the frontier.',
  };

  yield {
    state: labelMatrix(
      'Where to study next',
      [
        { id: 'hnsw', label: 'HNSW' },
        { id: 'pq', label: 'PQ' },
        { id: 'svd', label: 'SVD' },
        { id: 'rag', label: 'RAG' },
      ],
      [
        { id: 'link', label: 'link' },
        { id: 'question', label: 'question' },
      ],
      [
        ['graph search', 'which distances get evaluated?'],
        ['compressed vectors', 'which distances are approximate?'],
        ['low-rank basis', 'what geometry gets reused?'],
        ['retrieval quality', 'does faster search improve answers?'],
      ],
    ),
    highlight: { found: ['hnsw:question', 'pq:question', 'svd:question', 'rag:question'] },
    explanation: 'FINGER is valuable because it links data structures, vector geometry, and retrieval systems: the algorithmic trick only matters if recall and downstream answer quality survive.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'search bottleneck') yield* searchBottleneck();
  else if (view === 'residual shortcut') yield* residualShortcut();
  else throw new InputError('Pick a FINGER case-study view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'FINGER is a fast inference method for graph-based approximate nearest-neighbor search. It targets the query-time bottleneck in HNSW-style systems: greedy graph search repeatedly evaluates distances from the query to candidate neighbor vectors. Many of those exact distance computations do not change the candidate list, especially after the top-k upper bound becomes tight.',
        'The paper, from Amazon-associated authors and collaborators, proposes using residual-vector geometry to approximate distances that are unlikely to matter. The local corpus summary captures the core insight well: if a point is farther away than the current top-k bound, the exact value of that distance is often irrelevant. You only need enough evidence to skip it safely.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to speed up graph ANN is to build a better graph or reduce vector dimension. Those can help, but they do not remove the hot-loop cost inside search: each visited node exposes neighbors, and each neighbor may require an exact distance computation against a high-dimensional query vector.',
        'Another obvious move is to approximate every distance aggressively. That is dangerous because graph search is path dependent. A bad early estimate can prune a neighbor that would have led the search into the right region. FINGER is more careful: approximate mainly where the candidate is unlikely to beat the current bound, and keep exact scoring for candidates that can change the result.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that not all distance computations have equal decision value. Near the frontier, exact distances matter because they determine which neighbors enter the heap or final top-k. Far outside the frontier, exact distances often only confirm rejection. If a cheaper geometric estimate can show that a candidate is safely outside the useful region, the algorithm saves work without changing the answer.',
        'FINGER gets that estimate from local residual geometry around the current node. It reuses information about the query-to-current distance and neighbor structure, then estimates whether a neighbor can plausibly beat the bound. This makes the shortcut tied to the graph search state rather than a generic quantization pass.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During graph search, suppose the current node is c, the query is q, and a neighbor candidate is d. FINGER decomposes q and d relative to c: projection along c plus residual components orthogonal to c. Because the algorithm has already scored c and has access to local neighbor relationships, it can estimate the angle between residual vectors and approximate d(q,d) without doing the full exact distance computation every time.',
        'The shortcut is useful only with a quality policy. Candidates near the current bound should still be scored exactly, because they can change the frontier or final top-k set. Candidates that are clearly too far can be approximated or bypassed. Final reranking and recall@k measurement protect the system from approximation errors that would silently harm retrieval.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The search-bottleneck view is proving that the expensive step is repeated candidate scoring. Once the current top-k bound is tight, most neighbors do not improve the frontier. The visual asks the useful systems question: which exact computations are buying recall, and which are only proving an obvious rejection?',
        'The residual-shortcut view shows the geometric trick. The current node is used as a local reference point. Query and candidate vectors are decomposed relative to that reference, and the residual relationship helps estimate whether the candidate deserves exact scoring. This is not random skipping; it is bounded approximation inside the search loop.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because graph ANN search has a tightening bound. Early in search, many candidates may matter. Later, the heap contains better neighbors, so the threshold for entering the result set becomes harder to beat. More distance checks become low-value as search progresses.',
        'It also works because local graph neighborhoods contain reusable geometry. Neighbor vectors around the current node are not arbitrary; the graph construction already connected points that are geometrically related. FINGER exploits that structure to avoid paying full vector distance cost for candidates that the local geometry suggests are safely too far.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Graph ANN search is often memory and distance-computation heavy. FINGER adds precomputed local geometry and estimation work, but saves repeated full-vector distance calculations during search. The reported results show FINGER accelerating graph-based methods such as HNSW across benchmark datasets, with the paper reporting 20% to 60% performance gains in many settings. The exact gain depends on dimension, graph quality, recall target, hardware, and how expensive the original distance metric is.',
        'This is a classic systems tradeoff: move some work into precomputation and approximate screening so the hot query path does fewer exact operations. The risk is incorrect pruning. The right metric is not raw speed alone; it is throughput at a specified recall@k and downstream task quality.',
        'The method is most attractive when exact distance is expensive and the graph search evaluates many candidates that never enter the result. It is less compelling when vectors are small, the distance kernel is already cheap, metadata filters dominate, or the deployment is bottlenecked on network and storage rather than arithmetic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FINGER belongs in the same mental folder as HNSW, Product Quantization, and RAG Pipeline engineering. Vector databases, recommender systems, two-tower retrieval, image search, deduplication, and semantic search all spend money on nearest-neighbor queries. A faster graph search path can reduce latency or allow higher recall settings under the same budget. For LLM systems, this can improve retrieval quality or reduce inference cost if fewer bad contexts are passed downstream.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The technique does not make approximate nearest-neighbor search exact. It accelerates a graph search process by approximating low-value distance checks. If the approximation is applied too aggressively, recall can fall. It also does not solve bad embeddings, poor chunking, stale indexes, or metadata-filter problems. Treat it as a query-time acceleration layer, not a full retrieval architecture.',
        'Another misconception is that a faster ANN kernel automatically improves a RAG product. If retrieval quality is capped by chunking, embedding mismatch, missing metadata filters, stale documents, or poor reranking, FINGER can only make the wrong retrieval faster. The right rollout measures recall@k, latency, and final answer quality together.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a semantic search service over 200 million product vectors. HNSW gives good recall, but p99 latency rises when the search visits many candidates under a high recall setting. Product managers want better recall for long-tail queries, but the serving budget cannot absorb more exact distance computations.',
        'FINGER fits as a search-side optimization. Keep the HNSW graph and recall target. Add residual-distance screening for candidates that look safely outside the current bound. Exact-score the candidates near the bound and rerank final survivors. The deployment test is simple: at the same recall@k, did p95 and p99 latency fall? Or, at the same latency, can the system run a higher recall setting without hurting downstream conversion or answer quality?',
        'The safe rollout would shadow the shortcut first. Run ordinary exact-distance HNSW and FINGER side by side on sampled traffic, compare top-k overlap, recall against a brute-force sample, latency, and downstream ranking changes. Only then should the shortcut enter the serving path, and even then behind a recall guardrail and per-index configuration.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: FINGER at https://arxiv.org/abs/2206.11408, the ACM page at https://dl.acm.org/doi/10.1145/3543507.3583318, and Amazon Science at https://www.amazon.science/publications/finger-fast-inference-for-graph-based-approximate-nearest-neighbor-search. Study HNSW (Vector Search at Scale), Product Quantization for Vector Search, SVD & Low-Rank Approximation, Embeddings & Similarity, Multi-Index RAG, ANN Recall-Latency Pareto Ledger, and RAG Pipeline next.',
      ],
    },
  ],
};
