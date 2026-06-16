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
      heading: 'What it is',
      paragraphs: [
        'GraphBLAS is a standard way to express graph algorithms in the language of sparse linear algebra. Represent the graph as a sparse adjacency matrix. Represent frontier, score, and visited sets as sparse vectors or masks. Then run matrix-vector or matrix-matrix operations over the semiring that matches the algorithm.',
        'This topic connects Compressed Sparse Row Graph, Graph BFS, PageRank, Pregel Graph Processing Case Study, and Apache Arrow Columnar Memory Case Study. The data-structure lesson is that CSR is not only compact storage; it is also an input layout for optimized sparse algebra kernels.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A BFS step can be written as q * A over the Boolean OR-AND semiring, where q is the current frontier vector and A is the adjacency matrix. Multiplication tests whether an active vertex has an edge; addition combines many possible predecessors. A mask removes already visited vertices. Repeat until the frontier is empty.',
        'Other algorithms use different algebra. PageRank iterates numerical matrix-vector operations. Single-source shortest paths can use min-plus relaxation. Triangle counting uses sparse matrix products and structural masks. The same API exposes matrices, vectors, masks, reductions, element-wise operations, and semiring multiplication.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The performance story is sparse-kernel reuse. A highly tuned implementation can optimize storage formats, parallel scheduling, masks, and matrix operations once, then many graph algorithms benefit. The cost is that algorithms must fit the sparse algebra model, and dynamic edge updates can be awkward if the matrix format is built for scans.',
        'GraphBLAS also makes absence explicit. A sparse matrix stores only present edges, and the algebra defines what missing entries mean. That is why the identity and annihilator behavior of the chosen semiring matters. A wrong semiring changes the graph algorithm, not just an implementation detail.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a social graph with hundreds of millions of edges. A custom BFS implementation might hand-code frontier queues, visited bitsets, neighbor scans, and parallel partitioning. In GraphBLAS, the frontier is a sparse vector, visited is a mask, the graph is a sparse matrix, and each BFS level is a masked vector-matrix multiply. The implementation can focus on optimized sparse kernels.',
        'Pregel exposes a vertex-centric message-passing model. GraphBLAS exposes a matrix-centric algebra model. Both are valid ways to raise the abstraction above individual edges. GraphBLAS is especially attractive when many algorithms can reuse the same matrix representation and linear algebra backend.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'GraphBLAS is not a magic replacement for every graph system. If the graph is tiny, setup overhead can dominate. If edges mutate constantly, a dynamic adjacency structure may be more natural. If an algorithm has control flow that does not map cleanly to masks and sparse products, forcing it into GraphBLAS can obscure the implementation.',
        'Another trap is thinking the matrix is dense. The whole point is sparse matrices. A graph with n vertices does not allocate n squared edge slots. It stores present edges in compressed structures and lets kernels stream those structures.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: GraphBLAS Forum overview at https://graphblas.org/, SuiteSparse:GraphBLAS repository at https://github.com/DrTimothyAldenDavis/GraphBLAS, Davis GraphBLAS paper copy at https://people.engr.tamu.edu/davis/GraphBLAS_files/toms_graphblas.pdf, GraphBLAS pointers and tutorials at https://graphblas.org/GraphBLAS-Pointers/, and Python GraphBLAS primer at https://python-graphblas.readthedocs.io/en/stable/getting_started/primer.html. Study Compressed Sparse Row Graph, Graph BFS, PageRank, Pregel Graph Processing Case Study, and Apache Arrow Columnar Memory Case Study next.',
      ],
    },
  ],
};
