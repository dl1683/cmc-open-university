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
  yield {
    state: buildFlow('CSR turns adjacency into two flat arrays'),
    highlight: { active: ['sort', 'rowptr'], found: ['colidx', 'scan'] },
    explanation: 'Compressed Sparse Row stores every neighbor list inside one flat colIdx array. rowPtr stores the boundaries: neighbors of vertex u live in colIdx[rowPtr[u]..rowPtr[u+1]).',
    invariant: 'rowPtr has V + 1 entries; colIdx has E entries for a directed graph.',
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
    explanation: 'The row pointer array is an index over the flat neighbor array. Vertex B reads rowPtr[B] = 2 and rowPtr[B+1] = 4, so it scans colIdx positions 2 and 3.',
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
    explanation: 'A real rowPtr also has the final sentinel entry, here rowPtr[4] = 5. That sentinel lets the last vertex compute its end without a special case.',
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
    explanation: 'CSR is a family of layouts. Weighted graphs add a values array parallel to colIdx. Undirected graphs usually store both directions unless the algorithm is designed for a triangular form.',
  };
}

function* scanAndTradeoffs() {
  yield {
    state: scanFlow('Neighbor scan is pointer arithmetic'),
    highlight: { active: ['vertex', 'start', 'end'], found: ['slice', 'visit'] },
    explanation: 'To scan vertex u, read start = rowPtr[u] and end = rowPtr[u+1], then iterate k from start to end - 1. Each colIdx[k] is one neighbor.',
    invariant: 'A full graph traversal touches rowPtr O(V) times and colIdx O(E) times.',
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
    explanation: 'CSR is excellent when the graph is mostly static and algorithms repeatedly scan neighbors. It is poor when single edges are inserted and deleted constantly.',
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
    explanation: 'BFS, PageRank, connected components, triangle counting, and sparse matrix-vector multiply all reuse the same memory pattern: scan rows and stream the neighbor array.',
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
    explanation: 'CSR is not just a teaching representation. Sparse linear algebra libraries, graph frameworks, and GPU kernels all use row-offset layouts because contiguous neighbor scans match the memory hierarchy.',
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
      heading: 'Why this exists',
      paragraphs: [
        `Compressed Sparse Row, or CSR, exists because sparse graphs and sparse matrices often contain far more absence than presence. A dense adjacency matrix spends space on every possible edge, even when almost all entries are empty. CSR stores only the present edges, plus enough indexing information to recover each row quickly.`,
        `For graph algorithms, CSR is the physical version of an adjacency list. The graph idea says vertex A connects to B and C. CSR says exactly where B and C live in memory. That physical detail matters because large graph workloads often spend more time moving neighbor lists through memory than doing complicated arithmetic.`,
      ],
    },
    {
      heading: 'The obvious representation',
      paragraphs: [
        `The obvious graph representation is an adjacency list: one array or list per vertex. It is easy to explain and easy to update. Add edge u -> v by appending v to u's list. Delete it by finding v and removing it. For small programs and heavily mutable graphs, that representation is often the right answer.`,
        `The wall appears in large, mostly static graphs. Millions of tiny arrays, object headers, pointers, capacity gaps, and allocator decisions can cost more than the neighbor IDs themselves. Traversal becomes pointer chasing. The CPU asks for the next neighbor and instead gets sent to a different allocation, a different cache line, and sometimes a different page.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `CSR removes the per-vertex container and keeps one flat neighbor array. The rowPtr array is the index into that flat storage. For vertex u, rowPtr[u] is the start position and rowPtr[u + 1] is the end position. The neighbors are the half-open slice colIdx[start..end).`,
        `The final entry in rowPtr is a sentinel equal to the number of stored edges. That one extra value removes a special case for the last vertex. Every row, including an empty row, can be described by the same start and end rule. If start equals end, the vertex has no outgoing neighbors.`,
      ],
    },
    {
      heading: 'How to build it',
      paragraphs: [
        `To build CSR from an edge list, group or sort edges by source vertex. Then append each source vertex's destinations to colIdx and record the running offset before each row in rowPtr. After the final row, append the total edge count as rowPtr[V].`,
        `Weighted graphs add a values array parallel to colIdx, so values[k] is the weight for edge colIdx[k] inside the current row slice. Undirected graphs usually store both directions, u -> v and v -> u, unless the algorithm is intentionally using a triangular or symmetric compressed form.`,
      ],
    },
    {
      heading: 'How scanning works',
      paragraphs: [
        `A neighbor scan is pointer arithmetic. Read start = rowPtr[u] and end = rowPtr[u + 1]. Loop k from start up to, but not including, end. Each colIdx[k] is one outgoing neighbor. A full traversal reads O(V) row offsets and O(E) neighbor entries.`,
        `This is why CSR is so common in sparse linear algebra. Sparse matrix-vector multiplication is just row scanning with arithmetic attached. BFS, PageRank, connected components, triangle counting, and recommendation graph walks reuse the same shape: choose a row, stream a contiguous neighbor slice, and move on.`,
      ],
    },
    {
      heading: 'A small example',
      paragraphs: [
        `Suppose A points to B and C, B points to C and D, C points to D, and D has no outgoing neighbors. If vertices are ordered A, B, C, D, the flat neighbor array is [B, C, C, D, D]. The row pointer array is [0, 2, 4, 5, 5].`,
        `Those five offsets are enough to recover every row. A owns colIdx[0..2), B owns colIdx[2..4), C owns colIdx[4..5), and D owns colIdx[5..5). The final empty slice is not a bug. It is the same rule handling a vertex with no outgoing edges, which is exactly why the sentinel is useful.`,
        `This example also shows why rowPtr is a prefix-sum structure. Each entry says how many neighbor entries appear before the row begins. Building CSR is therefore closely related to counting degrees, taking prefix sums, and scattering edges into the final flat positions.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The build view proves that CSR is not a new graph; it is a new layout for the same adjacency relation. Edges are sorted or grouped by source, rowPtr records boundaries, and colIdx becomes the shared storage for every neighbor list. The important movement is from many little lists to one flat array plus offsets.`,
        `The scan view proves the performance promise and the tradeoff at the same time. Scanning a row is fast because the data is already packed. Updating one edge is awkward because inserting into the middle of the packed array may shift later entries and change many row boundaries.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness contract is small. rowPtr[0] must be 0. rowPtr must be monotonic. rowPtr[V] must equal colIdx.length. With those facts, each vertex owns exactly one half-open slice of the neighbor array, and every stored edge belongs to the row whose boundary contains its position.`,
        `The performance contract is equally direct. Graph traversal becomes sequential memory access. Sequential access is friendly to CPU caches, hardware prefetching, vectorized kernels, GPU memory coalescing, and compact serialization. CSR does not change asymptotic traversal complexity, but it improves the constant factors that dominate large sparse workloads.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Space is O(V + E) for an unweighted directed graph: V + 1 row pointers and E column indices. If both are 32-bit integers, the structural storage is roughly 4 * (V + 1 + E) bytes before metadata and alignment. Weighted graphs add one stored value per edge.`,
        `The tradeoff is mutability. CSR is excellent when the graph is built once and scanned many times. It is weak when edges are inserted and deleted constantly. Dynamic systems often keep a mutable delta structure beside CSR, rebuild in batches, or choose a different layout until the graph becomes stable.`,
        `Build time is usually O(E log E) if the edge list must be sorted by source, or O(V + E) if the input is already bucketed or degree counts are available. That preprocessing cost is worth paying only when later scans reuse the compact layout enough times.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `CSR wins in large sparse graphs where repeated neighbor scans dominate: PageRank on web links, BFS over road or social graphs, connected components, graph neural network message passing, sparse matrix-vector multiplication, and triangle counting with sorted rows.`,
        `It is also a good interchange shape. SciPy exposes CSR matrices through indptr, indices, and data arrays. Boost has compressed_sparse_row_graph for static graphs. GraphBLAS treats many graph algorithms as sparse matrix operations, which makes row-oriented sparse formats a shared systems language.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `CSR is not automatically faster. Tiny graphs do not need it. Dense graphs may be better served by adjacency matrices. Highly mutable graphs can spend more time rebuilding than scanning. Algorithms that need fast edge existence checks may require sorted rows, binary search, hash side tables, or a different representation.`,
        `There are also data-contract traps. Some CSR builders preserve duplicate edges; others collapse or sum them. Some rows are sorted; others are not. Index width can double memory if a graph crosses 32-bit limits. A production algorithm must state these assumptions instead of treating CSR as one universal object.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: SciPy CSR docs at https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csr_matrix.html, NVIDIA sparse format docs at https://docs.nvidia.com/nvpl/latest/sparse/storage_format/sparse_matrix.html, Intel oneMKL sparse formats at https://www.intel.com/content/www/us/en/docs/onemkl/developer-reference-dpcpp/2024-0/sparse-storage-formats.html, Boost compressed_sparse_row_graph at https://www.boost.org/doc/libs/latest/libs/graph/doc/compressed_sparse_row.html, and SuiteSparse GraphBLAS at https://github.com/DrTimothyAldenDavis/GraphBLAS.`,
        `Study Graph BFS for row scanning in traversal, PageRank for repeated sparse passes, Big-O Growth Rates for the V + E cost model, Elias-Fano Encoding and Roaring Bitmaps for compressed adjacency alternatives, and Pregel Graph Processing for distributed graph execution.`,
      ],
    },
  ],
};
