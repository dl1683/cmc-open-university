// GraphBLAS treats graph algorithms as sparse matrix and vector operations over
// semirings, so BFS, PageRank, and triangle counting share core primitives.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'graphblas-sparse-matrix-graph-case-study',
  title: 'GraphBLAS Sparse Matrix Graph Case Study',
  category: 'Data Structures',
  summary: 'Represent graphs as sparse adjacency matrices and express algorithms as masked matrix-vector operations over semirings.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bfs semiring', 'graph analytics'], defaultValue: 'bfs semiring' },
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

function graphblasGraph(title) {
  return graphState({
    nodes: [
      { id: 'graph', label: 'graph', x: 0.8, y: 3.4, note: 'edges' },
      { id: 'matrix', label: 'sparse A', x: 2.6, y: 3.4, note: 'CSR/CSC' },
      { id: 'frontier', label: 'frontier', x: 4.6, y: 5.0, note: 'vector q' },
      { id: 'semiring', label: 'semiring', x: 4.6, y: 1.8, note: 'or/and' },
      { id: 'spmv', label: 'SpMV', x: 6.6, y: 3.4, note: 'q * A' },
      { id: 'mask', label: 'mask', x: 8.0, y: 5.0, note: 'unvisited' },
      { id: 'next', label: 'next', x: 8.9, y: 3.4, note: 'new frontier' },
    ],
    edges: [
      { id: 'e-graph-matrix', from: 'graph', to: 'matrix' },
      { id: 'e-matrix-spmv', from: 'matrix', to: 'spmv' },
      { id: 'e-frontier-spmv', from: 'frontier', to: 'spmv' },
      { id: 'e-semiring-spmv', from: 'semiring', to: 'spmv' },
      { id: 'e-spmv-mask', from: 'spmv', to: 'mask' },
      { id: 'e-mask-next', from: 'mask', to: 'next' },
      { id: 'e-spmv-next', from: 'spmv', to: 'next' },
    ],
  }, { title });
}

function* bfsSemiring() {
  yield {
    state: graphblasGraph('A BFS step is sparse matrix-vector multiply'),
    highlight: { active: ['matrix', 'frontier', 'semiring', 'spmv', 'e-matrix-spmv', 'e-frontier-spmv'], found: ['next'] },
    explanation: 'GraphBLAS represents a graph as a sparse adjacency matrix. One BFS frontier step is a sparse vector-matrix multiply over a Boolean semiring, followed by a mask that removes already visited vertices.',
    invariant: 'The graph structure stays in a sparse matrix; algorithm state moves through sparse vectors.',
  };

  yield {
    state: labelMatrix(
      'Boolean BFS semiring',
      [
        { id: 'multiply', label: 'multiply' },
        { id: 'add', label: 'add' },
        { id: 'zero', label: 'zero' },
        { id: 'mask', label: 'mask' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'graph_effect', label: 'graph effect' },
      ],
      [
        ['AND', 'edge exists and source active'],
        ['OR', 'any active predecessor reaches node'],
        ['false', 'no edge/no frontier'],
        ['not visited', 'avoid revisiting'],
      ],
    ),
    highlight: { active: ['multiply:graph_effect', 'add:graph_effect'], found: ['mask:graph_effect'], compare: ['zero:meaning'] },
    explanation: 'Changing the scalar operations changes the graph algorithm. Boolean OR-AND is reachability; min-plus can express shortest-path relaxation; plus-times supports PageRank-style linear algebra.',
  };

  yield {
    state: graphblasGraph('Masking is part of the primitive, not an afterthought'),
    highlight: { active: ['mask', 'next', 'e-mask-next'], compare: ['frontier'], found: ['spmv'] },
    explanation: 'Masks let GraphBLAS update only selected positions. In BFS, the complement of visited is the mask, so the next frontier excludes nodes already assigned a level.',
  };

  yield {
    state: labelMatrix(
      'BFS levels as sparse vectors',
      [
        { id: 'level0', label: 'level 0' },
        { id: 'level1', label: 'level 1' },
        { id: 'level2', label: 'level 2' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'frontier', label: 'frontier' },
        { id: 'operation', label: 'operation' },
      ],
      [
        ['source', 'q * A with mask'],
        ['neighbors', 'q * A with mask'],
        ['next ring', 'q * A with mask'],
        ['empty q', 'stop'],
      ],
    ),
    highlight: { active: ['level0:operation', 'level1:operation', 'level2:operation'], found: ['done:frontier'] },
    explanation: 'The loop shape is compact: multiply frontier by adjacency matrix, mask out visited, record the new level, repeat until the frontier is empty.',
  };
}

function* graphAnalytics() {
  yield {
    state: graphblasGraph('One sparse-matrix API supports many graph algorithms'),
    highlight: { active: ['graph', 'matrix', 'spmv'], found: ['semiring'], compare: ['frontier', 'mask'] },
    explanation: 'GraphBLAS standardizes building blocks such as sparse matrices, sparse vectors, masks, element-wise operations, reductions, and matrix multiply over user-selected semirings.',
    invariant: 'The same sparse layout can run different algorithms by changing algebra and masks.',
  };

  yield {
    state: labelMatrix(
      'Algorithm as algebra choice',
      [
        { id: 'bfs', label: 'Graph BFS' },
        { id: 'pagerank', label: 'PageRank' },
        { id: 'sssp', label: 'shortest paths' },
        { id: 'triangles', label: 'triangle count' },
      ],
      [
        { id: 'primitive', label: 'primitive' },
        { id: 'key_choice' },
      ],
      [
        ['masked SpMV', 'Boolean semiring'],
        ['matrix-vector iteration', 'weighted arithmetic'],
        ['relaxation', 'min-plus semiring'],
        ['matrix multiply/intersect', 'structural masks'],
      ],
    ),
    highlight: { active: ['bfs:primitive', 'pagerank:primitive'], found: ['sssp:key_choice'], compare: ['triangles:key_choice'] },
    explanation: 'The point is not that every graph algorithm becomes one line. The point is that many graph algorithms reuse optimized sparse linear algebra kernels once the graph is a matrix.',
  };

  yield {
    state: labelMatrix(
      'Case study: GraphBLAS execution stack',
      [
        { id: 'storage', label: 'storage' },
        { id: 'api', label: 'API' },
        { id: 'kernel', label: 'kernel' },
        { id: 'algorithm', label: 'algorithm' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'benefit' },
      ],
      [
        ['CSR/CSC/hypersparse', 'skip absent edges'],
        ['matrices, vectors, masks', 'portable contract'],
        ['SpMV/SpGEMM/reduce', 'optimized once'],
        ['BFS/PageRank/SSSP', 'composed operations'],
      ],
    ),
    highlight: { active: ['api:benefit', 'kernel:benefit'], found: ['algorithm:benefit'], compare: ['storage:role'] },
    explanation: 'SuiteSparse:GraphBLAS is the reference implementation example: graph algorithms are built from sparse matrices and vector kernels rather than custom pointer-walking loops per algorithm.',
  };

  yield {
    state: labelMatrix(
      'When not to force it',
      [
        { id: 'tiny', label: 'tiny graph' },
        { id: 'mutable', label: 'high churn' },
        { id: 'irregular', label: 'custom traversal' },
        { id: 'bulk', label: 'bulk analytics' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason' },
      ],
      [
        ['weak', 'setup overhead dominates'],
        ['depends', 'matrix rebuilds hurt'],
        ['depends', 'primitive mismatch'],
        ['strong', 'parallel sparse kernels'],
      ],
    ),
    highlight: { found: ['bulk:fit'], compare: ['tiny:reason', 'mutable:reason'], active: ['irregular:fit'] },
    explanation: 'GraphBLAS is strongest for mostly static graphs and bulk analytics. A transactional graph store with constant edge updates may need a different primary representation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bfs semiring') yield* bfsSemiring();
  else if (view === 'graph analytics') yield* graphAnalytics();
  else throw new InputError('Pick a GraphBLAS view.');
}
export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many graph algorithms look different in pointer form but similar in algebra form. A traversal scans neighbors. PageRank repeatedly combines scores over edges. Triangle counting intersects neighborhoods. Shortest-path relaxations combine candidate distances. GraphBLAS exists to express those patterns as sparse matrix and vector operations.',
        'The point is not to make graphs look mathematical for style. It is to reuse decades of sparse linear algebra engineering: compressed storage, parallel kernels, masks, reductions, and hardware-conscious traversal. A graph becomes an adjacency matrix. Frontiers, visited sets, labels, and scores become vectors or masks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to hand-write every graph algorithm as loops over adjacency lists. That is clear and often good. But every algorithm then has to rediscover storage layout, parallel scheduling, masking, cache behavior, and sparse traversal details.',
        'A second problem is that graph libraries can become collections of unrelated special cases. BFS, PageRank, reachability, triangle counting, and shortest paths seem like separate engines. GraphBLAS asks whether the real difference is the algebra used to combine edge information.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is the semiring. Ordinary matrix multiplication uses multiply to combine a row element with a column element and plus to accumulate results. GraphBLAS lets the algorithm choose those operations. Boolean OR-AND gives reachability. Min-plus gives shortest-path relaxation. Plus-times gives numerical score propagation.',
        'Masks make sparse graph algorithms practical. A BFS frontier multiplication can propose neighbors, while a visited mask removes vertices already discovered. The mask plays the same role as a seen set in queue BFS, but it lives inside the matrix operation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Represent the graph as a sparse adjacency matrix A. Entry A[i, j] exists when there is an edge from i to j, depending on orientation. A frontier is a sparse vector q. One BFS step computes q times A over the Boolean semiring, then masks out already visited vertices. The result is the next frontier.',
        'The algorithm repeats levels until the frontier is empty. A level counter labels newly discovered vertices. The visited mask accumulates all previous frontiers. This is still BFS: the vector contains exactly one distance ring, and masking preserves first discovery.',
        'Other algorithms change the semiring or operation shape. PageRank uses numeric sparse matrix-vector multiplication. Triangle counting can use sparse matrix products with structural masks. Connected components can use repeated propagation. The API stays small while the algebra changes the meaning.',
        'GraphBLAS operations also distinguish structure from values. Sometimes the existence of an edge is enough, as in unweighted reachability. Sometimes the stored value matters, as in weighted shortest paths or probabilistic scores. That distinction is why masks, descriptors, and semirings are part of the programming model.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The frontier-vector view proves that BFS does not require an explicit queue to preserve level order. The current frontier vector is the queue level compressed into algebraic form. Multiplication by the adjacency matrix expands one edge. The mask prevents revisits.',
        'The semiring view proves that the operators are correctness choices. OR-AND asks whether any active predecessor reaches a vertex. Min-plus asks for the minimum distance through an edge. Changing the semiring is not a micro-optimization; it changes the algorithm being computed.',
        'The mask highlight is just as important as the multiplication highlight. Without the mask, a cycle can keep proposing already discovered vertices. With the mask, the sparse operation has the same first-discovery discipline as ordinary BFS.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sparse matrix-vector multiplication visits exactly the stored edges adjacent to active frontier vertices when implemented well. For BFS, each multiplication proposes all one-hop neighbors of the current ring. Because the visited mask removes earlier rings, the remaining vertices are first discovered at the next distance.',
        'The abstraction works because graph adjacency and sparse matrices share the same structure: mostly absent relationships with a small set of present edges. Linear algebra gives a disciplined vocabulary for combine, accumulate, mask, reduce, and assign, which are the same actions many graph algorithms perform by hand.',
        'The benefit compounds when several algorithms run over the same graph. Loading and arranging the sparse matrix is expensive, but after that BFS, filtering, centrality, and propagation can share the representation. The storage decision becomes an execution platform rather than a one-off data structure.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The performance win comes from optimized sparse kernels. A GraphBLAS implementation can tune CSR, CSC, hypersparse formats, bitmap masks, thread scheduling, and vector sparsity once. Many algorithms benefit from those kernels instead of each algorithm carrying its own low-level loops.',
        'The tradeoff is fit. Algorithms with irregular control flow, frequent edge mutation, or tiny graphs may be clearer and faster as direct adjacency-list code. Building or converting the matrix has a cost. Choosing the wrong orientation, sparsity format, or semiring can erase the benefit.',
        'Direction matters too. A row-oriented layout may make outgoing-neighbor expansion cheap, while some algorithms need incoming edges or transposed views. GraphBLAS descriptors can request transposes, but the physical storage still affects locality and performance.',
        'Debugging can also be harder. A wrong queue BFS usually fails near the line that enqueues a neighbor. A wrong GraphBLAS program may hide the bug in a mask, accumulator, descriptor, or identity value. The abstraction is powerful, but it demands precise algebraic thinking.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'GraphBLAS is strongest for large sparse graphs where many analytics reuse the same representation. BFS, reachability, PageRank-like propagation, triangle counting, centrality approximations, graph filtering, and batch traversals can share kernels and masks.',
        'It also helps teams reason across systems. Pregel describes vertex programs and messages. GraphBLAS describes algebra over adjacency matrices. Both lift the programmer above raw edge loops. The better choice depends on the workload, update pattern, and execution engine.',
        'It is especially attractive when graph processing is part of a numerical analytics stack. If data scientists already think in vectors, matrices, reductions, and masks, GraphBLAS can make graph analytics feel like an extension of sparse linear algebra rather than a separate graph framework.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A common mistake is imagining a dense n by n matrix. GraphBLAS is about sparse matrices. A graph with a billion possible pairs but a few billion actual edges stores present edges and metadata, not every absent edge. Dense thinking leads to wrong memory estimates.',
        'Another failure is treating the semiring as decorative. OR-AND, plus-times, min-plus, and max-min answer different questions. If the identity element or accumulator is wrong, the code can be fast and still compute the wrong graph property.',
        'Dynamic graphs are also hard. If edges change constantly, a mutable adjacency-list or log-structured graph store may be a better primary representation, with GraphBLAS snapshots used for analytics. The matrix abstraction is powerful, but it is not the only graph storage model.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Compressed Sparse Row Graph for the storage layout, Graph BFS for the queue version of the same traversal, PageRank for iterative score propagation, Sparse Matrix Multiplication for kernel intuition, Pregel Graph Processing Case Study for the message-passing alternative, and Apache Arrow Columnar Memory Case Study for the broader theme of layout shaping computation.',
        'A practical learning path is to implement BFS twice: once with a queue and once with a Boolean frontier vector. Keep the same graph and compare the invariants. The queue version teaches control flow; the GraphBLAS version teaches how the same invariant can live inside matrix operations, masks, and semirings.',
        'Then change only the algebra. Replace OR-AND reachability with min-plus relaxation on a weighted graph. If the result changes from discovered vertices to shortest distances, the semiring idea has landed: the storage can stay sparse while the mathematical meaning of the operation changes.',
      ],
    },
  ],
};
