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
      heading: 'What it is',
      paragraphs: [
        'Compressed Sparse Row, or CSR, is a compact layout for sparse matrices and graph adjacency. Instead of storing a list object for every vertex, CSR stores two main arrays. rowPtr has one entry per vertex plus a final sentinel. colIdx stores all destination vertices in one flat array. The neighbors of vertex u are exactly colIdx[rowPtr[u]..rowPtr[u+1]).',
        'For graph algorithms, this is the physical version of an adjacency list. The mathematical graph says A connects to B and C. CSR says where those neighbors live in memory. That difference matters at scale because many graph workloads spend more time moving adjacency through memory than doing arithmetic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To build CSR from an edge list, group or sort edges by source vertex. Append each source vertexs destinations to colIdx. Record the running offset before each row in rowPtr, then append the final edge count as the sentinel. Weighted graphs add a values array parallel to colIdx. Undirected graphs commonly store both u->v and v->u.',
        'Scanning is pointer arithmetic. For vertex u, start = rowPtr[u] and end = rowPtr[u + 1]. Loop k from start to end - 1 and visit colIdx[k]. A full traversal reads O(V) row offsets and O(E) neighbor entries. Empty rows cost almost nothing because their start and end offsets are equal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space is O(V + E) for an unweighted directed graph: V + 1 row pointers and E column indices. If column indices and row pointers are 32-bit, the structural storage is roughly 4(V + 1 + E) bytes before alignment and metadata. Weighted graphs add one value per edge. Dense adjacency matrices cost O(V^2), so CSR is decisive when E is much smaller than V^2.',
        'The tradeoff is mutability. CSR is fast for repeated scans over a mostly static graph. Inserting one edge in the middle of colIdx can require shifting later entries and updating row offsets. Dynamic graph stores often accumulate updates elsewhere, rebuild CSR in batches, or use hybrid layouts.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'SciPy exposes CSR matrices through indptr, indices, and data arrays. Boost Graph Library provides a compressed_sparse_row_graph for large graphs that do not need mutation. NVIDIA and Intel sparse libraries describe CSR as a standard sparse matrix format for row-oriented kernels. GraphBLAS treats graph algorithms as sparse matrix operations over semirings, so graph storage and sparse matrix storage become the same engineering problem.',
        'PageRank is the classic example. Each iteration streams outgoing links, sends rank mass to neighbors, and repeats. BFS frontiers, connected components, triangle counting, recommendation graph walks, and sparse matrix-vector multiplication all benefit from the same contiguous row scans.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'CSR is not always faster. For tiny graphs, pointer-heavy adjacency lists are simpler and fine. For dense graphs, an adjacency matrix can make edge tests and dense algebra cheaper. For highly mutable graphs, CSR rebuild costs can dominate. The layout is best when the graph is sparse, large, and scanned many times after construction.',
        'Another trap is assuming every CSR has sorted neighbor lists. Many libraries permit unsorted column indices. Sorting rows can speed intersection, binary search, compression, and reproducibility, but it costs build time. Duplicate edges are another contract issue: some sparse libraries sum duplicates, while graph algorithms may need to preserve or remove them explicitly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SciPy CSR docs at https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csr_matrix.html, NVIDIA sparse format docs at https://docs.nvidia.com/nvpl/latest/sparse/storage_format/sparse_matrix.html, Intel oneMKL sparse formats at https://www.intel.com/content/www/us/en/docs/onemkl/developer-reference-dpcpp/2024-0/sparse-storage-formats.html, Boost compressed_sparse_row_graph at https://www.boost.org/doc/libs/latest/libs/graph/doc/compressed_sparse_row.html, and SuiteSparse GraphBLAS at https://github.com/DrTimothyAldenDavis/GraphBLAS. Study Graph BFS, PageRank, Pregel Graph Processing, Feature Hashing Signed Projection Primer, Elias-Fano Encoding, Roaring Bitmaps, and Big-O Growth Rates next.',
      ],
    },
  ],
};
