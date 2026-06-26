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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a sparse adjacency matrix. A sparse matrix stores only present edges, while a frontier vector stores the vertices currently active in a traversal.',
        'The safe inference is that a BFS level can be represented without an explicit queue. Multiplying the frontier by the adjacency matrix proposes one-hop neighbors, and a visited mask removes vertices that were already discovered.',
        {type:'callout', text:'GraphBLAS turns graph traversal into sparse linear algebra: storage stays in matrices while algorithm state moves through vectors, masks, and semirings.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b5/AdjacencyMatrixGraphBLASBFS.png', alt:'Graph and adjacency matrix showing one BFS step computed by matrix-vector multiplication.', caption:'GraphBLAS BFS over an adjacency matrix. Jeremy Kepner, Wikimedia Commons, CC BY 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many graph algorithms repeat the same structural actions: expand neighbors, combine edge information, mask visited vertices, reduce scores, and assign new state. Hand-written graph code often hides those actions inside pointer loops.',
        'GraphBLAS exists to express graph algorithms as sparse linear algebra. The graph becomes a matrix, algorithm state becomes vectors and masks, and the chosen algebra defines what each multiplication or reduction means.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store adjacency lists and write a custom loop for each algorithm. For BFS, keep a queue; for PageRank, loop over incoming edges; for triangle counting, intersect neighbor lists.',
        'That is often clear and fast for one algorithm. The cost is that every algorithm has to rediscover storage format, parallel scheduling, masking, and sparse traversal behavior.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the system needs many analytics over the same large sparse graph. BFS, reachability, PageRank, shortest-path relaxation, and triangle counting may look different in code while sharing the same sparse structure.',
        'Another wall is hardware efficiency. Sparse graph traversal is memory-bound and irregular, so naive pointer chasing can waste cache locality and parallelism that sparse matrix kernels have spent decades improving.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A graph algorithm can be defined by the algebra used over sparse structure. A semiring chooses the combine and accumulate operations, such as Boolean AND-OR for reachability or min-plus for shortest paths.',
        'Masks make graph logic practical. A BFS mask plays the role of a visited set by blocking already discovered vertices inside the sparse operation rather than after a separate queue step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Represent the graph as a sparse adjacency matrix A. Entry A[i, j] exists when an edge connects i and j, with orientation chosen to match the traversal direction.',
        'A frontier vector q marks the current BFS level. One step computes q times A over the Boolean semiring, then applies the complement of the visited mask to keep only newly discovered vertices.',
        'Other algorithms keep the storage but change the algebra. PageRank uses numeric sparse matrix-vector multiplication, shortest-path relaxation can use min-plus, and triangle counting uses sparse products with structural masks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For BFS, the invariant is that the frontier vector contains exactly the vertices at the current distance. Multiplying by A proposes every one-edge neighbor of that frontier, and the mask removes all earlier distances.',
        'That means each newly unmasked vertex is first discovered at the next distance. The algebraic version is correct for the same reason queue BFS is correct: it expands one edge layer at a time and never reassigns a shorter known distance.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sparse cost depends on the number of stored edges touched, not on n squared possible pairs. A graph with one million vertices and ten million edges should store and traverse roughly the ten million present edges plus index metadata.',
        'The upfront cost is building and choosing the matrix format, such as CSR, CSC, hypersparse, or bitmap. If many analytics reuse the matrix, that cost is amortized; if the graph changes every millisecond, conversion may dominate.',
        'When the graph doubles in edges, sparse matrix-vector work usually grows with the touched edges for the active frontier. The constant factors depend on orientation, sparsity format, mask density, and memory bandwidth.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GraphBLAS fits large sparse graph analytics: BFS, reachability, connected components, PageRank-like propagation, triangle counting, centrality approximations, filtering, and batch traversals. It is strongest when several algorithms reuse one graph representation.',
        'It also fits teams that already use vector and matrix thinking. Graph analytics becomes another sparse computation pipeline rather than a separate engine built around custom pointer algorithms.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the graph is tiny, highly dynamic, or dominated by irregular control flow that does not map cleanly to sparse kernels. A direct adjacency list can be simpler and faster in those cases.',
        'It also fails when the semiring or identity element is wrong. Boolean reachability, plus-times scoring, and min-plus distance compute different properties, so a fast kernel can still produce the wrong graph answer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take vertices A, B, C, D, and E with edges A-B, A-C, B-D, C-D, and D-E. Start BFS at A, so the frontier vector is A=1 and all other entries are 0.',
        'After one Boolean multiplication by the adjacency matrix, B and C become active. The visited mask marks A, B, and C; the next multiplication proposes D from both B and C, but the Boolean OR accumulator stores D once.',
        'After the third step, E becomes active from D. The distances are A=0, B=1, C=1, D=2, and E=3, which matches queue BFS because every step advances exactly one edge layer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are the GraphBLAS specification at https://graphblas.org/ and SuiteSparse:GraphBLAS material at https://github.com/DrTimothyAldenDavis/GraphBLAS. The image source by Jeremy Kepner also illustrates the BFS matrix-vector view.',
        'Study compressed sparse row graphs, ordinary BFS, sparse matrix multiplication, semirings, PageRank, Pregel-style graph processing, and columnar memory next. The key comparison is whether algorithm state should live in control flow or in algebraic objects.',
      ],
    },
  ],
};
