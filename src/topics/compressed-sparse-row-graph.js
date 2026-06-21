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
        "The build view shows CSR construction: edges are sorted by source vertex, rowPtr records where each vertex's neighbors begin in the flat colIdx array, and the final sentinel closes the last row.",
        {
          type: "callout",
          text: "CSR makes each neighbor list a slice of one flat array, so graph traversal becomes pointer arithmetic plus a sequential scan.",
        },
        "Active highlights mark the current row being built or scanned. Found highlights mark the colIdx slice that belongs to that row. Compare highlights show empty rows or tradeoff alternatives.",
        "In the scan view, follow the pointer arithmetic: vertex u reads rowPtr[u] and rowPtr[u+1] to find its contiguous neighbor slice. The key inference: if start equals end, the vertex has no outgoing edges -- same rule, no special case.",
      
        {type: 'image', src: './assets/gifs/compressed-sparse-row-graph.gif', alt: 'Animated walkthrough of the compressed sparse row graph visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Compressed Sparse Row, or CSR, exists because sparse graphs and sparse matrices often contain far more absence than presence. A dense adjacency matrix spends space on every possible edge, even when almost all entries are empty. CSR stores only the present edges, plus enough indexing information to recover each row quickly.`,
        `For graph algorithms, CSR is the physical version of an adjacency list. The graph idea says vertex A connects to B and C. CSR says exactly where B and C live in memory. That physical detail matters because large graph workloads often spend more time moving neighbor lists through memory than doing complicated arithmetic.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Store a graph or sparse matrix. Adjacency matrix: n*n array, 1 if edge exists. Space: O(n^2). For a social network with 1B users and average 500 friends: 10^18 entries, 99.99995% zeros. Adjacency list: array of linked lists. Space: O(n+m). But linked lists have poor cache locality (pointer chasing).`,
        `CSR (Compressed Sparse Row): three arrays. row_ptr[i] = index into col_idx where row i's non-zeros begin. col_idx = column indices of all non-zeros, row by row. values = corresponding values. Space: O(n + nnz) where nnz = number of non-zeros. Row i's neighbors: col_idx[row_ptr[i]..row_ptr[i+1]]. All contiguous in memory -- cache-friendly sequential scan.`,
        `SpMV (sparse matrix-vector multiply): for each row i, dot product with the dense vector. The fundamental operation of PageRank, graph neural networks, and iterative solvers. CSR makes SpMV cache-optimal. CSC (Compressed Sparse Column): transpose of CSR. Efficient for column access. SciPy, MATLAB, and most graph libraries use CSR/CSC internally.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `CSR removes the per-vertex container and keeps one flat neighbor array. The rowPtr array is the index into that flat storage. For vertex u, rowPtr[u] is the start position and rowPtr[u + 1] is the end position. The neighbors are the half-open slice colIdx[start..end).`,
        {
          type: `image`,
          src: `https://mermaid.ink/svg/pako:PY3LCsIwEEX3-YrZSwv-gNDUVtyIC3fDLNpmkgqlU_Kg-vdiJG7P4Z5rF9mnefARHlo12BnHAZyXtLGB8Q1Bkp-YoKpOoNHLfo8exNrAMZBqMm9xkuVqXmCXIcLKTzeP4gMpnfUZQ_we_MaYqIgOeTV_fDgSqTaLvgTzsK55NaT6rC54K30QC4k-`,
          alt: `CSR rowPtr offsets select a contiguous slice inside the flat colIdx neighbor array.`,
          caption: `CSR stores edge destinations once in colIdx and uses rowPtr offsets to recover each vertex slice. Source: https://mermaid.ink/svg/pako:PY3LCsIwEEX3-YrZSwv-gNDUVtyIC3fDLNpmkgqlU_Kg-vdiJG7P4Z5rF9mnefARHlo12BnHAZyXtLGB8Q1Bkp-YoKpOoNHLfo8exNrAMZBqMm9xkuVqXmCXIcLKTzeP4gMpnfUZQ_we_MaYqIgOeTV_fDgSqTaLvgTzsK55NaT6rC54K30QC4k-`,
        },
        `The final entry in rowPtr is a sentinel equal to the number of stored edges. That one extra value removes a special case for the last vertex. Every row, including an empty row, can be described by the same start and end rule. If start equals end, the vertex has no outgoing neighbors.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To build CSR from an edge list, group or sort edges by source vertex. Then append each source vertex\'s destinations to colIdx and record the running offset before each row in rowPtr. After the final row, append the total edge count as rowPtr[V].`,
        `Weighted graphs add a values array parallel to colIdx, so values[k] is the weight for edge colIdx[k] inside the current row slice. Undirected graphs usually store both directions, u -> v and v -> u, unless the algorithm is intentionally using a triangular or symmetric compressed form.`,
      ],
    },
    {
      heading: 'How scanning works',
      paragraphs: [
        `A neighbor scan is pointer arithmetic. Read start = rowPtr[u] and end = rowPtr[u + 1]. Loop k from start up to, but not including, end. Each colIdx[k] is one outgoing neighbor. A full traversal reads O(V) row offsets and O(E) neighbor entries.`,
        {
          type: `image`,
          src: `https://mermaid.ink/svg/pako:HclNCoMwEAbQfU7xXcArFPyFQgtFoZuQRZhMsRAZiTPa4xeyfe-T5aI1FsVjdq2f5YIFNM0NnZ85JhS5Xlpw5C9xcF2t3i9aOG4gyff0C66vPPiJlVacTCoFZ8zGR3BDzdG3RLZZjspIotiLJCMNbqw_-WV_viGmuyks_AE`,
          alt: `Sparse matrix-vector multiply scans one CSR row, fetches vector values, and accumulates the output.`,
          caption: `CSR makes SpMV a row-slice scan: stream neighbor columns, fetch vector entries, and accumulate one output row. Source: https://mermaid.ink/svg/pako:HclNCoMwEAbQfU7xXcArFPyFQgtFoZuQRZhMsRAZiTPa4xeyfe-T5aI1FsVjdq2f5YIFNM0NnZ85JhS5Xlpw5C9xcF2t3i9aOG4gyff0C66vPPiJlVacTCoFZ8zGR3BDzdG3RLZZjspIotiLJCMNbqw_-WV_viGmuyks_AE`,
        },
        `This is why CSR is so common in sparse linear algebra. Sparse matrix-vector multiplication is just row scanning with arithmetic attached. BFS, PageRank, connected components, triangle counting, and recommendation graph walks reuse the same shape: choose a row, stream a contiguous neighbor slice, and move on.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose A points to B and C, B points to C and D, C points to D, and D has no outgoing neighbors. If vertices are ordered A, B, C, D, the flat neighbor array is [B, C, C, D, D]. The row pointer array is [0, 2, 4, 5, 5].`,
        `Those five offsets are enough to recover every row. A owns colIdx[0..2), B owns colIdx[2..4), C owns colIdx[4..5), and D owns colIdx[5..5). The final empty slice is not a bug. It is the same rule handling a vertex with no outgoing edges, which is exactly why the sentinel is useful.`,
        `This example also shows why rowPtr is a prefix-sum structure. Each entry says how many neighbor entries appear before the row begins. Building CSR is therefore closely related to counting degrees, taking prefix sums, and scattering edges into the final flat positions.`,
      ],
    }
  ],
};
