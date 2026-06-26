// Compressed Sparse Row (CSR): represent graph adjacency with row offsets plus
// one flat neighbor array, so scans are compact and cache-friendly.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'compressed-sparse-row-graph',
  title: 'Compressed Sparse Row Graph',
  category: 'Data Structures',
  summary: 'A graph-storage layout: rowPtr tells each vertex where its neighbors start and end inside one flat colIdx array.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build CSR', 'scan and tradeoffs'], defaultValue: 'build CSR' },
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

function buildFlow(title) {
  return graphState({
    nodes: [
      { id: 'edges', label: 'edges', x: 0.8, y: 3.2, note: 'u -> v' },
      { id: 'sort', label: 'sort', x: 2.7, y: 3.2, note: 'by source' },
      { id: 'rowptr', label: 'rowPtr', x: 4.6, y: 3.2, note: 'offsets' },
      { id: 'colidx', label: 'colIdx', x: 6.5, y: 3.2, note: 'neighbors' },
      { id: 'scan', label: 'scan', x: 8.4, y: 3.2, note: 'slice' },
    ],
    edges: [
      { id: 'e-edges-sort', from: 'edges', to: 'sort' },
      { id: 'e-sort-rowptr', from: 'sort', to: 'rowptr' },
      { id: 'e-rowptr-colidx', from: 'rowptr', to: 'colidx' },
      { id: 'e-colidx-scan', from: 'colidx', to: 'scan' },
    ],
  }, { title });
}

function scanFlow(title) {
  return graphState({
    nodes: [
      { id: 'vertex', label: 'vertex u', x: 0.8, y: 3.2, note: 'row' },
      { id: 'start', label: 'start', x: 2.7, y: 3.2, note: 'rowPtr[u]' },
      { id: 'end', label: 'end', x: 4.6, y: 3.2, note: 'rowPtr[u+1]' },
      { id: 'slice', label: 'slice', x: 6.5, y: 3.2, note: 'colIdx range' },
      { id: 'visit', label: 'visit', x: 8.4, y: 3.2, note: 'neighbors' },
    ],
    edges: [
      { id: 'e-vertex-start', from: 'vertex', to: 'start' },
      { id: 'e-start-end', from: 'start', to: 'end' },
      { id: 'e-end-slice', from: 'end', to: 'slice' },
      { id: 'e-slice-visit', from: 'slice', to: 'visit' },
    ],
  }, { title });
}

function* buildCsr() {
  const buildSteps = 5;
  const buildEdges = 4;
  const vertexCount = 4;
  const edgeCount = 5;
  const buildChoices = 4;

  yield {
    state: buildFlow('CSR turns adjacency into two flat arrays'),
    highlight: { active: ['sort', 'rowptr'], found: ['colidx', 'scan'] },
    explanation: `Compressed Sparse Row stores every neighbor list inside one flat colIdx array across ${buildSteps} build stages. rowPtr stores the boundaries: neighbors of vertex u live in colIdx[rowPtr[u]..rowPtr[u+1]).`,
    invariant: `rowPtr has ${vertexCount + 1} entries (V + 1); colIdx has ${edgeCount} entries for this directed graph.`,
  };

  yield {
    state: labelMatrix(
      'CSR slices',
      [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' },
        { id: 'D', label: 'D' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'neighbors', label: 'neighbors' },
      ],
      [
        ['0..2', 'B,C'],
        ['2..4', 'C,D'],
        ['4..5', 'D'],
        ['5..5', 'empty'],
      ],
    ),
    highlight: { active: ['B:range'], found: ['B:neighbors'], compare: ['D:neighbors'] },
    explanation: `The row pointer array indexes ${vertexCount} vertices over the flat neighbor array of ${edgeCount} entries. Vertex B reads rowPtr[B] = 2 and rowPtr[B+1] = 4, so it scans colIdx positions 2 and 3.`,
  };

  yield {
    state: labelMatrix(
      'Array contents',
      [
        { id: 'rowptr', label: 'rowPtr' },
        { id: 'colidx', label: 'colIdx' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        { id: 'p0', label: '0' },
        { id: 'p1', label: '1' },
        { id: 'p2', label: '2' },
        { id: 'p3', label: '3' },
      ],
      [
        ['0', '2', '4', '5'],
        ['B', 'C', 'C', 'D'],
        ['A slice', 'A slice', 'B slice', 'B slice'],
      ],
    ),
    highlight: { active: ['rowptr:p1', 'rowptr:p2'], found: ['colidx:p2', 'colidx:p3'] },
    explanation: `A real rowPtr also has the final sentinel entry, here rowPtr[${vertexCount}] = ${edgeCount}. That sentinel lets the last vertex compute its end without a special case.`,
  };

  yield {
    state: labelMatrix(
      'Build choices',
      [
        { id: 'directed', label: 'directed' },
        { id: 'undirected', label: 'undirected' },
        { id: 'weighted', label: 'weighted' },
        { id: 'sorted', label: 'sorted cols' },
      ],
      [
        { id: 'layout', label: 'layout' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['one edge', 'store u->v'],
        ['two edges', 'store both ways'],
        ['values[] too', 'parallel weights'],
        ['optional', 'faster intersect'],
      ],
    ),
    highlight: { found: ['weighted:layout', 'sorted:reason'], compare: ['undirected:layout'] },
    explanation: `CSR is a family of ${buildChoices} layout variants. Weighted graphs add a values array parallel to colIdx. Undirected graphs usually store both directions unless the algorithm is designed for a triangular form.`,
  };
}

function* scanAndTradeoffs() {
  const scanSteps = 5;
  const scanEdges = 4;
  const layoutOptions = 4;
  const algorithmCount = 4;
  const systemCount = 4;

  yield {
    state: scanFlow('Neighbor scan is pointer arithmetic'),
    highlight: { active: ['vertex', 'start', 'end'], found: ['slice', 'visit'] },
    explanation: `To scan vertex u through ${scanSteps} stages, read start = rowPtr[u] and end = rowPtr[u+1], then iterate k from start to end - 1. Each colIdx[k] is one neighbor.`,
    invariant: `A full graph traversal touches rowPtr O(V) times and colIdx O(E) times across ${scanEdges} scan edges.`,
  };

  yield {
    state: labelMatrix(
      'Layout tradeoffs',
      [
        { id: 'list', label: 'adj list' },
        { id: 'csr', label: 'CSR' },
        { id: 'matrix', label: 'dense matrix' },
        { id: 'coo', label: 'edge list' },
      ],
      [
        { id: 'good', label: 'good at' },
        { id: 'weak', label: 'weak at' },
      ],
      [
        ['updates', 'pointer overhead'],
        ['scans', 'inserts/deletes'],
        ['edge tests', 'huge space'],
        ['building', 'neighbor scan'],
      ],
    ),
    highlight: { found: ['csr:good'], compare: ['csr:weak', 'matrix:weak'] },
    explanation: `Among ${layoutOptions} layout options, CSR is excellent when the graph is mostly static and algorithms repeatedly scan neighbors. It is poor when single edges are inserted and deleted constantly.`,
  };

  yield {
    state: labelMatrix(
      'Algorithm fit',
      [
        { id: 'bfs', label: 'BFS' },
        { id: 'pagerank', label: 'PageRank' },
        { id: 'triangles', label: 'triangles' },
        { id: 'mutable', label: 'mutable graph' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['strong', 'frontier scans'],
        ['strong', 'all edges'],
        ['strong', 'sorted rows'],
        ['weak', 'rebuild cost'],
      ],
    ),
    highlight: { found: ['bfs:fit', 'pagerank:fit', 'triangles:why'], compare: ['mutable:why'] },
    explanation: `Across ${algorithmCount} algorithm profiles, BFS, PageRank, connected components, triangle counting, and sparse matrix-vector multiply all reuse the same memory pattern: scan rows and stream the neighbor array.`,
  };

  yield {
    state: labelMatrix(
      'CSR in systems',
      [
        { id: 'scipy', label: 'SciPy' },
        { id: 'boost', label: 'Boost' },
        { id: 'graphblas', label: 'GraphBLAS' },
        { id: 'gpu', label: 'GPU libs' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['sparse matrix', 'indptr/indices'],
        ['graph class', 'static graph'],
        ['graph algebra', 'sparse matrices'],
        ['SpMV kernels', 'row offsets'],
      ],
    ),
    highlight: { active: ['graphblas:use', 'gpu:use'], found: ['scipy:shape', 'boost:shape'] },
    explanation: `CSR is not just a teaching representation. All ${systemCount} production systems — sparse linear algebra libraries, graph frameworks, and GPU kernels — use row-offset layouts because contiguous neighbor scans match the memory hierarchy.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build CSR') yield* buildCsr();
  else if (view === 'scan and tradeoffs') yield* scanAndTradeoffs();
  else throw new InputError('Pick a CSR view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "build CSR" view walks through construction: edges are sorted by source vertex, rowPtr records where each vertex\'s neighbor list begins in the flat colIdx array, and a sentinel entry closes the last row. Active highlights mark the row currently being built. Found highlights mark the colIdx slice belonging to that row. Compare highlights flag empty rows or layout alternatives.',
        {
          type: 'callout',
          text: 'CSR makes each neighbor list a slice of one flat array, so graph traversal becomes pointer arithmetic plus a sequential scan.',
        },
        'The "scan and tradeoffs" view shows what happens at read time. Vertex u reads rowPtr[u] and rowPtr[u+1] to locate its contiguous neighbor slice. If start equals end, the vertex has zero outgoing edges -- the same two-index rule handles every case with no branching.',
        'At each frame, track which array is being accessed and why. The key question is always: how does the algorithm find a vertex\'s neighbors without scanning the entire edge set?',
        {type: 'image', src: './assets/gifs/compressed-sparse-row-graph.gif', alt: 'Animated walkthrough of the compressed sparse row graph visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Graphs in the real world are sparse. A social network with a billion users and an average of 500 connections has about 250 billion edges -- large, but still only 0.00000005% of the billion-squared possible edges. Any representation that reserves space for missing edges wastes almost everything.',
        'Beyond space, there is a speed problem. Graph algorithms like BFS, PageRank, and connected components do the same thing on every vertex: read its neighbor list, process each neighbor, move on. If that neighbor list is scattered across heap-allocated linked-list nodes, each read is a cache miss. CSR -- Compressed Sparse Row -- packs all neighbor lists end-to-end in a single flat array and uses a small index to find where each vertex\'s slice begins. The result is that scanning neighbors becomes a sequential memory read, which modern CPUs execute at maximum throughput.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The textbook way to store a graph is an adjacency matrix: an n-by-n grid where entry (i, j) is 1 if edge i->j exists, 0 otherwise. Testing whether a specific edge exists is O(1). But space is O(n^2), which for the billion-user network means 10^18 entries. That will not fit in any memory system on Earth.',
        'The next idea is an adjacency list: an array of n linked lists, one per vertex, each containing only the actual neighbors. Space drops to O(n + m), where m is the number of edges. But linked lists scatter neighbor nodes across the heap. Walking a single neighbor list causes one pointer chase per neighbor, and pointer chases are the slowest operation on modern hardware -- each one stalls the CPU for 50-100 nanoseconds while the cache hierarchy resolves the random address.',
        'What we want is O(n + m) space like an adjacency list, but with neighbors stored contiguously like a dense array, so scanning them is a sequential read. That is exactly what CSR provides.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The adjacency list gives compact storage but slow traversal. The adjacency matrix gives fast edge lookup but explodes in space. Both representations force a choice between the two things graph algorithms actually need: compact storage and fast sequential scans of neighbor lists.',
        'The root problem is per-vertex containers. Each linked list (or each dynamic array) is allocated independently, so the memory allocator can place them anywhere. Even if you use vectors instead of linked lists, you still have n separate heap allocations with n separate pointers. The CPU\'s prefetcher cannot predict which memory block comes next. For a graph algorithm that touches every vertex, this means n unpredictable jumps through memory -- and on large graphs, those jumps dominate the total running time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Eliminate every per-vertex container. Concatenate all neighbor lists into one flat array called colIdx, ordered by source vertex. Then build a second small array called rowPtr that records where each vertex\'s slice begins. For vertex u, its neighbors are colIdx[rowPtr[u] .. rowPtr[u+1]). Two array lookups and one loop -- no pointers, no allocations, no cache misses beyond the unavoidable cold start.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:PY3LCsIwEEX3-YrZSwv-gNDUVtyIC3fDLNpmkgqlU_Kg-vdiJG7P4Z5rF9mnefARHlo12BnHAZyXtLGB8Q1Bkp-YoKpOoNHLfo8exNrAMZBqMm9xkuVqXmCXIcLKTzeP4gMpnfUZQ_we_MaYqIgOeTV_fDgSqTaLvgTzsK55NaT6rC54K30QC4k-',
          alt: 'CSR rowPtr offsets select a contiguous slice inside the flat colIdx neighbor array.',
          caption: 'CSR stores edge destinations once in colIdx and uses rowPtr offsets to recover each vertex slice. Source: https://mermaid.ink/svg/pako:PY3LCsIwEEX3-YrZSwv-gNDUVtyIC3fDLNpmkgqlU_Kg-vdiJG7P4Z5rF9mnefARHlo12BnHAZyXtLGB8Q1Bkp-YoKpOoNHLfo8exNrAMZBqMm9xkuVqXmCXIcLKTzeP4gMpnfUZQ_we_MaYqIgOeTV_fDgSqTaLvgTzsK55NaT6rC54K30QC4k-',
        },
        'The last entry, rowPtr[V], is a sentinel equal to the total number of edges. This removes a special case for the last vertex: every vertex, including one with zero neighbors, is described by the same two-index rule. If rowPtr[u] equals rowPtr[u+1], vertex u has no outgoing edges. No branching, no null checks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Building CSR from a raw edge list takes three passes. First, count the out-degree of each vertex by scanning all edges. Second, compute the prefix sum of the degree array -- this becomes rowPtr. Third, scatter each edge\'s destination into the correct position in colIdx, using a running write pointer per row. The sentinel rowPtr[V] = m is set at the end. Total cost: O(m) for the count, O(V) for the prefix sum, O(m) for the scatter -- so O(V + m) overall, with no sorting required.',
        'Weighted graphs add a third array, values[], parallel to colIdx. The weight of the k-th edge is values[k], and it corresponds to neighbor colIdx[k]. Undirected graphs store each edge twice (once in each direction), doubling colIdx and values, unless the algorithm intentionally uses a symmetric upper-triangular form.',
        'An alternative build path sorts the edge list by source vertex, then walks the sorted list to fill rowPtr and colIdx in one pass. This costs O(m log m) for the sort but produces sorted neighbor lists within each row, which some algorithms (like triangle counting via sorted-merge intersection) require.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is straightforward. rowPtr is a prefix-sum array over vertex degrees. By construction, rowPtr[u+1] - rowPtr[u] equals the out-degree of vertex u, and colIdx[rowPtr[u] .. rowPtr[u+1]) contains exactly the destinations of u\'s outgoing edges. Since every edge is placed exactly once during the scatter pass, no edge is duplicated or lost.',
        'The performance argument comes from memory hierarchy. CPUs read data in cache lines of 64 bytes. A sequential scan of colIdx fetches one cache line per 16 integers (assuming 4-byte indices), processing all 16 before moving to the next. A linked list fetches one cache line per node and uses only the 4-byte pointer payload, wasting 60 bytes per fetch. For a vertex with 100 neighbors, CSR does about 7 cache-line fetches while a linked list does 100. This 14x difference compounds across billions of edges.',
        'The representation is also SIMD-friendly. Because neighbors sit contiguously, vector instructions can process 4 or 8 neighbor indices per cycle during operations like sparse matrix-vector multiply. Pointer-based layouts cannot benefit from SIMD at all.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space: rowPtr uses V+1 integers. colIdx uses m integers (directed) or 2m (undirected). values[] uses m entries if weighted. Total: O(V + m), which is optimal for any representation that stores all edges. For a billion-vertex graph with 250 billion edges using 4-byte indices, rowPtr is 4 GB, colIdx is 1 TB. That is large but fits in a distributed cluster; the equivalent adjacency matrix would need 10^18 bytes.',
        'Build time: O(V + m) with the count-prefix-scatter method, or O(m log m) with the sort-based method. Both are one-shot costs. Once built, CSR is read-only: inserting or deleting a single edge requires rebuilding the entire structure, because colIdx is a packed array with no gaps. This makes CSR a poor choice for dynamic graphs where edges appear and disappear over time.',
        'Scan time: reading all neighbors of vertex u costs O(degree(u)), which is optimal. A full BFS or DFS touches each vertex once (O(V) rowPtr lookups) and each edge once (O(m) colIdx reads), for O(V + m) total. This matches the theoretical lower bound for graph traversal.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:HclNCoMwEAbQfU7xXcArFPyFQgtFoZuQRZhMsRAZiTPa4xeyfe-T5aI1FsVjdq2f5YIFNM0NnZ85JhS5Xlpw5C9xcF2t3i9aOG4gyff0C66vPPiJlVacTCoFZ8zGR3BDzdG3RLZZjspIotiLJCMNbqw_-WV_viGmuyks_AE',
          alt: 'Sparse matrix-vector multiply scans one CSR row, fetches vector values, and accumulates the output.',
          caption: 'CSR makes SpMV a row-slice scan: stream neighbor columns, fetch vector entries, and accumulate one output row. Source: https://mermaid.ink/svg/pako:HclNCoMwEAbQfU7xXcArFPyFQgtFoZuQRZhMsRAZiTPa4xeyfe-T5aI1FsVjdq2f5YIFNM0NnZ85JhS5Xlpw5C9xcF2t3i9aOG4gyff0C66vPPiJlVacTCoFZ8zGR3BDzdG3RLZZjspIotiLJCMNbqw_-WV_viGmuyks_AE',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SciPy\'s sparse matrix module stores CSR as indptr (rowPtr) and indices (colIdx). Every call to scipy.sparse.csr_matrix.dot() runs the row-scan SpMV loop. MATLAB\'s sparse() is CSC, which is CSR transposed. GraphBLAS defines graph algorithms as sparse linear algebra operations and uses CSR/CSC as the underlying storage. cuSPARSE on NVIDIA GPUs uses CSR for SpMV kernels, assigning one warp (32 threads) per row to scan neighbors in parallel.',
        'PageRank is a repeated SpMV: multiply the link matrix by a rank vector until convergence. BFS is a masked SpMV: the frontier vector is multiplied by the adjacency matrix to discover the next layer. Connected components, shortest paths (Bellman-Ford), and triangle counting all decompose into row scans over CSR. The representation is so dominant in graph analytics that frameworks like Apache Giraph and Ligra convert input edge lists to CSR at load time.',
        'In machine learning, graph neural networks (GCN, GAT, GraphSAGE) use CSR to implement the neighborhood aggregation step. PyTorch Geometric and DGL store adjacency as CSR internally, even when the user-facing API accepts edge lists.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CSR is a read-only structure. Inserting one edge into a graph with m edges requires shifting up to m entries in colIdx and updating up to V entries in rowPtr. There is no way to insert in-place because the array has no slack space. For dynamic graphs -- social networks where friendships form and break, routing tables that update every second -- CSR is the wrong choice. Adjacency lists (or adjacency hash maps) allow O(1) amortized insertion.',
        'CSR also struggles with column access. Finding all edges pointing to vertex v requires scanning the entire colIdx array, which is O(m). If the algorithm needs both row and column access (e.g., computing in-degrees or running algorithms on the transpose), you need a separate CSC copy, doubling memory. Some systems store both CSR and CSC side-by-side, which is memory-optimal for bidirectional access but doubles build time.',
        'Power-law graphs present a load-balancing problem. In a social network, most vertices have a few neighbors but a handful of hubs have millions. A parallel algorithm that assigns one thread per row will finish most rows instantly and stall on the hub rows. GPU implementations address this with hybrid approaches: use one thread per row for low-degree vertices and one warp or one thread-block per row for high-degree vertices.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a directed graph with 4 vertices: A->B, A->C, B->C, B->D, C->D. Number the vertices A=0, B=1, C=2, D=3. Vertex degrees: A has 2 outgoing, B has 2, C has 1, D has 0.',
        'Build rowPtr as the prefix sum of degrees: [0, 2, 4, 5, 5]. There are 5 entries (V+1 = 5) because the sentinel rowPtr[4] = 5 marks the total edge count. Build colIdx by writing each vertex\'s destinations in order: [1, 2, 2, 3, 3], which is [B, C, C, D, D] using letter names.',
        'Verify: A\'s neighbors are colIdx[0..2) = [B, C]. Correct. B\'s neighbors are colIdx[2..4) = [C, D]. Correct. C\'s neighbors are colIdx[4..5) = [D]. Correct. D\'s neighbors are colIdx[5..5) = [] (empty). Correct. Every vertex\'s slice is recovered by two lookups into rowPtr and a loop over colIdx.',
        'Now run SpMV with this graph as a matrix and vector x = [1, 0, 1, 0]. Row A: colIdx positions 0,1 give columns 1 and 2, so result[A] = x[1] + x[2] = 0 + 1 = 1. Row B: columns 2 and 3, so result[B] = x[2] + x[3] = 1 + 0 = 1. Row C: column 3, so result[C] = x[3] = 0. Row D: empty, so result[D] = 0. Output: [1, 1, 0, 0]. This is exactly how PageRank, BFS, and GNN aggregation work under the hood.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Saad, "Iterative Methods for Sparse Linear Systems" (2003), chapter 3 -- the standard reference for CSR and sparse matrix formats. Barrett et al., "Templates for the Solution of Linear Systems" (1994) -- accessible introduction to sparse storage schemes. Buluç and Gilbert, "The Combinatorial BLAS" (2011) -- CSR as the foundation of graph-as-linear-algebra frameworks. Kepner and Gilbert, "Graph Algorithms in the Language of Linear Algebra" (2011) -- the GraphBLAS vision built on CSR/CSC.',
        'Study adjacency lists to understand the dynamic-graph alternative that CSR sacrifices. Study sparse matrix-vector multiply (SpMV) to see CSR\'s most important operation in detail. Study prefix sums to understand the construction technique and its parallelization. Study graph traversal (BFS, DFS) to see CSR as the physical layer beneath algorithmic descriptions.',
      ],
    },
  ],
};
