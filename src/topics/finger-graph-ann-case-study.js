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
    { heading: 'How to read the animation', paragraphs: [
        'The search-bottleneck view shows graph-based approximate nearest-neighbor search, or ANN. Active nodes are candidates being expanded, found nodes are current top-k results, and compare marks a distance computation between the query vector and a candidate vector.',
        'The residual-shortcut view uses the current node as a local reference point. A residual vector is the leftover direction after subtracting the part explained by that reference. The safe rule is: exact distance is needed near the frontier, while candidates safely outside the current bound can be screened with cheaper geometry.',
        {type:'callout', text:'FINGER saves query time by spending exact distance only on candidates that can still change the frontier.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/28/Hierarchical_Navigable_Small_World_%28HNSW%29.png', alt:'Multi-layer HNSW graph search diagram with entry point, query vector, and nearest neighbor.', caption:'Hierarchical Navigable Small World graph illustration by Rose electric, CC BY 4.0, via Wikimedia Commons.'},
      ] },
    { heading: 'Why this exists', paragraphs: [
        'HNSW-style graph ANN avoids brute force, but the hot loop still scores many candidate neighbors. One exact distance over a 768-dimensional vector is cheap; hundreds or thousands per query become expensive. FINGER exists because many exact distances only confirm that a candidate is too far to matter.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to build a better graph, reduce dimension, or write a faster distance kernel. Those help, but every expanded node still exposes neighbors that may need exact scoring. Approximating every distance is unsafe because graph search is path dependent.',
      ] },
    { heading: 'The wall', paragraphs: [
        'The wall is decision value. Near the current top-k bound, a small distance error can change the heap and the path. Far outside the bound, exact scoring is often wasted because the candidate will be rejected either way.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Use local residual geometry to decide when exact distance is worth paying. If current node c has already been scored against query q, and neighbor d is locally related to c, the method estimates whether d can beat the bound. Approximation is used mainly for low-value rejection.',
      ] },
    { heading: 'How it works', paragraphs: [
        'The search maintains a candidate frontier and a result heap. The heap has a current worst accepted distance. For each neighbor, FINGER uses local geometric information to screen candidates that are clearly outside that bound and exact-scores candidates that could change the frontier.',
      ] },
    { heading: 'Why it works', paragraphs: [
        'The correctness claim is about preserving recall behavior, not making ANN exact. The top-k bound tightens as search proceeds, so more later candidates are low-value rejections. If the screening policy avoids removing candidates that would change the final top k, latency falls without changing the returned set after exact rerank.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'A brute-force search over 10,000,000 vectors of dimension 768 costs 7.68 billion coordinate comparisons. HNSW reduces the visit count; FINGER reduces exact distance calls inside that visit set. The cost is extra precomputed local geometry and a more complicated query loop.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'FINGER fits vector databases, semantic search, image search, recommender retrieval, deduplication, and RAG systems when graph search spends meaningful time on distance computations. It can reduce latency at fixed recall or allow a wider search under the same latency budget.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It fails when the approximation removes a bridge candidate that would lead to the correct neighborhood. It also does not fix bad embeddings, poor chunking, stale indexes, missing metadata filters, or weak reranking. The required rollout metric is recall at k and downstream quality at the same latency budget.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'Suppose graph search visits 900 candidates, and each exact 768-dimensional L2 distance reads 768 coordinates. That is 691,200 coordinate differences. If FINGER screens 40 percent safely, exact work falls to 540 candidates, or 414,720 coordinate differences. The saved 276,480 operations matter only if the final top 10 after exact rerank matches the baseline.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: FINGER at https://arxiv.org/abs/2206.11408, the ACM page at https://dl.acm.org/doi/10.1145/3543507.3583318, and Amazon Science at https://www.amazon.science/publications/finger-fast-inference-for-graph-based-approximate-nearest-neighbor-search.',
        'Study HNSW, Product Quantization, Embeddings and Similarity, Multi-Index RAG, ANN Recall-Latency Pareto Ledger, and RAG Pipeline next.',
      ] },
  ],
};
