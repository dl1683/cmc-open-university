// Graph representation: adjacency matrix, adjacency list, and edge list —
// three ways to store the same graph, each with different cost tradeoffs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'graph-representation',
  title: 'Graph Representation',
  category: 'Data Structures',
  summary: 'Three ways to store a graph — adjacency matrix, adjacency list, edge list — and when each one wins.',
  controls: [
    { id: 'view', label: 'Representation', type: 'select', options: ['adjacency matrix', 'adjacency list', 'edge list'], defaultValue: 'adjacency matrix' },
  ],
  run,
};

// A fixed 5-vertex undirected graph used across all three views so the
// reader can compare representations of the exact same structure.
//   A --- B
//   |   / |
//   |  /  |
//   C --- D
//    \   /
//     \ /
//      E
const NODES = [
  { id: 'A', label: 'A', x: 2.0, y: 1.5 },
  { id: 'B', label: 'B', x: 7.0, y: 1.5 },
  { id: 'C', label: 'C', x: 2.0, y: 5.5 },
  { id: 'D', label: 'D', x: 7.0, y: 5.5 },
  { id: 'E', label: 'E', x: 4.5, y: 8.5 },
];
const EDGES = [
  ['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'D'], ['C', 'E'], ['D', 'E'],
].map(([from, to]) => ({ id: `${from}${to}`, from, to }));

const VERTEX_IDS = ['A', 'B', 'C', 'D', 'E'];

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

// Build the adjacency matrix as a 2D array of 0/1 values.
function adjMatrixValues() {
  const n = VERTEX_IDS.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of EDGES) {
    const r = VERTEX_IDS.indexOf(e.from);
    const c = VERTEX_IDS.indexOf(e.to);
    matrix[r][c] = 1;
    matrix[c][r] = 1; // undirected
  }
  return matrix;
}

// Build adjacency list as a map from vertex to sorted neighbor array.
function adjListMap() {
  const adj = Object.fromEntries(VERTEX_IDS.map((v) => [v, []]));
  for (const e of EDGES) {
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
  }
  return adj;
}

function graphSnapshot(title) {
  return graphState({ nodes: NODES, edges: EDGES }, { title });
}

// ---------- Adjacency matrix view ----------
function* adjacencyMatrixView() {
  const r2 = (v) => Math.round(v * 100) / 100;
  yield {
    state: graphSnapshot('5-vertex undirected graph'),
    highlight: { active: ['A'] },
    explanation: `A graph is vertices and edges. This undirected graph has ${NODES.length} vertices (${VERTEX_IDS.join(', ')}) and ${EDGES.length} edges. The first question for any graph algorithm: how do we store this in memory so we can answer "are X and Y connected?" and "who are X's neighbors?" efficiently?`,
  };

  const rows = VERTEX_IDS.map((v) => ({ id: v, label: v }));
  const cols = VERTEX_IDS.map((v) => ({ id: v, label: v }));
  const vals = adjMatrixValues();

  yield {
    state: matrixState({
      title: 'Adjacency matrix',
      rows,
      columns: cols,
      values: vals,
      format: (v) => String(v),
    }),
    highlight: { active: ['A:B', 'B:A'] },
    explanation: `An adjacency matrix is a ${VERTEX_IDS.length} x ${VERTEX_IDS.length} grid (V = ${VERTEX_IDS.length}). Cell [i][j] is 1 if an edge connects vertex i to vertex j, 0 otherwise. For undirected graphs the matrix is symmetric: [A][B] = ${vals[0][1]} and [B][A] = ${vals[1][0]}. Edge lookup is O(1) — just index into the array.`,
    invariant: 'For undirected graphs, matrix[i][j] always equals matrix[j][i].',
  };

  yield {
    state: matrixState({
      title: 'Adjacency matrix',
      rows,
      columns: cols,
      values: vals,
      format: (v) => String(v),
    }),
    highlight: { active: ['A:A', 'B:B', 'C:C', 'D:D', 'E:E'] },
    explanation: `The diagonal is all zeros because no vertex has a self-loop. Every 0 in the matrix costs the same memory as every 1. With ${VERTEX_IDS.length} vertices we store ${VERTEX_IDS.length * VERTEX_IDS.length} cells for ${EDGES.length} edges — ${r2((1 - EDGES.length * 2 / (VERTEX_IDS.length * VERTEX_IDS.length)) * 100)}% of cells are wasted zeros. With 1,000 vertices and 3,000 edges, we store 1,000,000 cells for 3,000 edges — 99.4% wasted zeros.`,
  };

  const cIdx = VERTEX_IDS.indexOf('C');
  const cNeighbors = vals[cIdx].filter(v => v === 1).length;

  yield {
    state: matrixState({
      title: 'Finding neighbors of C',
      rows,
      columns: cols,
      values: vals,
      format: (v) => String(v),
    }),
    highlight: { active: ['C:A', 'C:B', 'C:C', 'C:D', 'C:E'], found: ['C:A', 'C:B', 'C:D', 'C:E'] },
    explanation: `To find all neighbors of C, scan the entire row: check C:A, C:B, C:C, C:D, C:E. That is O(V) work regardless of how many neighbors C has. C has ${cNeighbors} neighbors but we still checked all ${VERTEX_IDS.length} cells. On a sparse graph with 10,000 vertices where C has 3 neighbors, we check 10,000 cells to find 3.`,
  };

  yield {
    state: labelMatrix(
      'Adjacency matrix cost summary',
      [
        { id: 'space', label: 'Space' },
        { id: 'edge', label: 'Edge lookup' },
        { id: 'neighbors', label: 'All neighbors' },
        { id: 'add', label: 'Add edge' },
        { id: 'remove', label: 'Remove edge' },
      ],
      [
        { id: 'cost', label: 'Cost' },
        { id: 'why', label: 'Why' },
      ],
      [
        ['O(V^2)', '5x5 = 25 cells'],
        ['O(1)', 'matrix[A][B]'],
        ['O(V)', 'scan full row'],
        ['O(1)', 'set cell to 1'],
        ['O(1)', 'set cell to 0'],
      ],
    ),
    highlight: { found: ['edge:cost'], compare: ['space:cost', 'neighbors:cost'] },
    explanation: `The matrix excels at edge existence checks — O(1), just an array index. But it pays O(V^2) space: ${VERTEX_IDS.length}x${VERTEX_IDS.length} = ${VERTEX_IDS.length * VERTEX_IDS.length} cells even when edges are sparse, and scanning neighbors costs O(V) regardless of degree. Dense graphs (where E is close to V^2) pay a fair price; sparse graphs waste most of that memory.`,
  };
}

// ---------- Adjacency list view ----------
function* adjacencyListView() {
  yield {
    state: graphSnapshot('Same 5-vertex graph'),
    highlight: { active: ['C'] },
    explanation: `Same graph — ${NODES.length} vertices, ${EDGES.length} edges — different storage question. Instead of a big grid, what if each vertex just keeps a list of its own neighbors? That is the adjacency list: one collection per vertex, containing only the vertices it connects to.`,
  };

  const adj = adjListMap();
  const rows = VERTEX_IDS.map((v) => ({ id: v, label: v }));
  const maxDeg = Math.max(...VERTEX_IDS.map((v) => adj[v].length));
  const cols = Array.from({ length: maxDeg }, (_, i) => ({ id: `n${i}`, label: `neighbor ${i + 1}` }));

  yield {
    state: labelMatrix(
      'Adjacency list',
      rows,
      cols,
      VERTEX_IDS.map((v) => {
        const neighbors = adj[v];
        const padded = [...neighbors];
        while (padded.length < maxDeg) padded.push('');
        return padded;
      }),
    ),
    highlight: { active: ['C:n0', 'C:n1', 'C:n2', 'C:n3'] },
    explanation: `Each row stores only actual neighbors. A has [${adj['A'].join(', ')}]. C has [${adj['C'].join(', ')}]. No wasted zeros. Total storage across all rows: each edge appears twice (once per endpoint in an undirected graph), so total entries = 2E = ${EDGES.length * 2}. Compare that to the matrix's ${VERTEX_IDS.length * VERTEX_IDS.length} cells.`,
    invariant: 'In an undirected graph, every edge (u, v) appears in both u\'s list and v\'s list.',
  };

  yield {
    state: labelMatrix(
      'Finding neighbors of C',
      rows,
      cols,
      VERTEX_IDS.map((v) => {
        const neighbors = adj[v];
        const padded = [...neighbors];
        while (padded.length < maxDeg) padded.push('');
        return padded;
      }),
    ),
    highlight: { found: ['C:n0', 'C:n1', 'C:n2', 'C:n3'] },
    explanation: `Neighbors of C? Just read its list: ${adj['C'].join(', ')}. Time: O(degree of C) = O(${adj['C'].length}). No scanning empty cells. For a vertex with 3 neighbors in a 10,000-vertex graph, this reads 3 entries instead of 10,000.`,
  };

  yield {
    state: labelMatrix(
      'Edge lookup: is A-D an edge?',
      rows,
      cols,
      VERTEX_IDS.map((v) => {
        const neighbors = adj[v];
        const padded = [...neighbors];
        while (padded.length < maxDeg) padded.push('');
        return padded;
      }),
    ),
    highlight: { compare: ['A:n0', 'A:n1'] },
    explanation: `Is there an edge between A and D? Scan A's list: [${adj['A'].join(', ')}]. D is not there. Time: O(degree of A) = O(${adj['A'].length}). For a vertex with many neighbors, this scan can be slow. The matrix answered the same question in O(1). This is the core tradeoff.`,
  };

  yield {
    state: labelMatrix(
      'Adjacency list cost summary',
      [
        { id: 'space', label: 'Space' },
        { id: 'edge', label: 'Edge lookup' },
        { id: 'neighbors', label: 'All neighbors' },
        { id: 'add', label: 'Add edge' },
        { id: 'remove', label: 'Remove edge' },
      ],
      [
        { id: 'cost', label: 'Cost' },
        { id: 'why', label: 'Why' },
      ],
      [
        ['O(V + E)', '5 lists, 14 entries'],
        ['O(degree)', 'scan neighbor list'],
        ['O(degree)', 'iterate the list'],
        ['O(1)', 'append to list'],
        ['O(degree)', 'find and remove'],
      ],
    ),
    highlight: { found: ['space:cost', 'neighbors:cost'], compare: ['edge:cost'] },
    explanation: `The adjacency list uses space proportional to the actual graph: ${VERTEX_IDS.length} lists and ${EDGES.length * 2} entries, not the possible graph. Neighbor iteration costs only O(degree). The price: edge existence checks require scanning a list instead of indexing an array. Most graph algorithms (BFS, DFS, Dijkstra, Kruskal) spend their time iterating neighbors, not checking individual edges, so the list usually wins.`,
  };
}

// ---------- Edge list view ----------
function* edgeListView() {
  yield {
    state: graphSnapshot('Same 5-vertex graph'),
    highlight: { active: ['AB', 'CD'] },
    explanation: `The simplest representation: just list every ${EDGES.length} edges as pairs of vertices. No indexing, no per-vertex structure. An edge list is what you get when you read a file of connections.`,
  };

  const edgeRows = EDGES.map((e) => ({ id: e.id, label: `${e.from}-${e.to}` }));
  yield {
    state: labelMatrix(
      'Edge list',
      edgeRows,
      [{ id: 'from', label: 'from' }, { id: 'to', label: 'to' }],
      EDGES.map((e) => [e.from, e.to]),
    ),
    highlight: { active: ['AB:from', 'AB:to'], found: ['CD:from', 'CD:to'] },
    explanation: `${EDGES.length} edges, ${EDGES.length} rows. Each row is a (from, to) pair. Space: O(E). This is compact and easy to build — just append edges as you discover them. Sorting by weight makes this the input format for Kruskal's MST algorithm.`,
    invariant: 'Each undirected edge appears exactly once, not twice.',
  };

  const cEdges = EDGES.filter(e => e.from === 'C' || e.to === 'C');

  yield {
    state: labelMatrix(
      'Edge list: finding neighbors of C',
      edgeRows,
      [{ id: 'from', label: 'from' }, { id: 'to', label: 'to' }],
      EDGES.map((e) => [e.from, e.to]),
    ),
    highlight: { found: ['AC:from', 'AC:to', 'BC:from', 'BC:to', 'CD:from', 'CD:to', 'CE:from', 'CE:to'] },
    explanation: `To find neighbors of C, scan every edge and check if either endpoint is C. We check all ${EDGES.length} edges and find ${cEdges.length} that touch C. Time: O(E) — the entire list. For a graph with millions of edges, this is expensive for a single neighbor query. Edge lists are for building and sorting, not for repeated neighbor lookups.`,
  };

  yield {
    state: labelMatrix(
      'Edge list cost summary',
      [
        { id: 'space', label: 'Space' },
        { id: 'edge', label: 'Edge lookup' },
        { id: 'neighbors', label: 'All neighbors' },
        { id: 'add', label: 'Add edge' },
        { id: 'sort', label: 'Sort by weight' },
      ],
      [
        { id: 'cost', label: 'Cost' },
        { id: 'why', label: 'Why' },
      ],
      [
        ['O(E)', '7 pairs'],
        ['O(E)', 'scan all edges'],
        ['O(E)', 'scan all edges'],
        ['O(1)', 'append'],
        ['O(E log E)', 'standard sort'],
      ],
    ),
    highlight: { found: ['space:cost', 'add:cost', 'sort:cost'], compare: ['edge:cost', 'neighbors:cost'] },
    explanation: `The edge list is the most compact — just ${EDGES.length} pairs — and the easiest to build, but the worst for queries. Its strength is input and construction: read edges from a file, sort them by weight for Kruskal, or stream them into a better structure. Think of it as the raw material, not the finished index.`,
  };

  yield {
    state: labelMatrix(
      'Three representations compared',
      [
        { id: 'matrix', label: 'adj. matrix' },
        { id: 'list', label: 'adj. list' },
        { id: 'elist', label: 'edge list' },
      ],
      [
        { id: 'space', label: 'space' },
        { id: 'edgeq', label: 'edge?' },
        { id: 'neighb', label: 'neighbors' },
        { id: 'best', label: 'best for' },
      ],
      [
        ['O(V^2)', 'O(1)', 'O(V)', 'dense graphs'],
        ['O(V+E)', 'O(deg)', 'O(deg)', 'most algorithms'],
        ['O(E)', 'O(E)', 'O(E)', 'building/sorting'],
      ],
    ),
    highlight: { found: ['list:space', 'list:neighb'], compare: ['matrix:space'], active: ['list:best'] },
    explanation: `For sparse graphs (most real-world graphs), the adjacency list wins on both space and neighbor iteration: O(V+E) = O(${VERTEX_IDS.length} + ${EDGES.length}) = ${VERTEX_IDS.length + EDGES.length} vs the matrix's O(V^2) = ${VERTEX_IDS.length * VERTEX_IDS.length}. The matrix wins only when edge lookups dominate or the graph is dense. The edge list is a construction format, not a query format. Choose the representation that matches your algorithm's access pattern.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'adjacency matrix') yield* adjacencyMatrixView();
  else if (view === 'adjacency list') yield* adjacencyListView();
  else if (view === 'edge list') yield* edgeListView();
  else throw new InputError('Pick a representation view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Use the selector at the top to switch between three views of the same 5-vertex, 7-edge undirected graph. A graph is a set of vertices (also called nodes) connected by edges (also called links). This animation shows the exact same graph stored three different ways so you can compare the cost of each storage choice on identical data.',
        {type: 'callout', text: 'A graph representation is a query contract: the same edges can be stored to favor neighbor scans, edge-existence checks, or streaming all edges.'},
        'Active highlights (bright color) mark cells or entries currently being inspected. Found highlights mark entries that answer a query. Compare highlights expose wasted work -- cells the algorithm had to check even though they contributed nothing. Watch the neighbor query in each view: the matrix scans an entire row including zeros, the adjacency list reads only actual neighbors, and the edge list scans every edge in the graph.',
        'The final step of the edge list view shows a side-by-side comparison table of all three representations. That table is the punchline: if your algorithm spends its time iterating neighbors (BFS, DFS, Dijkstra), the adjacency list wins. If it checks individual edge existence in a tight loop (Floyd-Warshall, matrix exponentiation), the matrix wins. If it processes all edges in bulk (Kruskal, Bellman-Ford), the edge list is the natural input.',
        {type: 'image', src: './assets/gifs/graph-representation.gif', alt: 'Animated walkthrough of the graph representation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A graph is a pair (V, E) where V is a set of vertices and E is a set of edges connecting them. Graphs model anything with pairwise relationships: friendships in a social network, roads between cities, links between web pages, dependencies between software packages, wires between circuit components. The abstract definition is simple. The engineering problem is storage: how do you lay out V and E in memory so that the algorithms you run can answer their questions without wasting time or space?',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'The abstract graph is small; the representation choice decides whether an algorithm sees rows, neighbor lists, or edge records. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Graph algorithms ask two kinds of questions repeatedly. A point query asks: "Does an edge exist between vertex u and vertex v?" An iteration query asks: "Give me every neighbor of vertex u." BFS, DFS, and Dijkstra are dominated by iteration queries. Floyd-Warshall and adjacency-matrix exponentiation are dominated by point queries. The representation you choose determines the cost of each question, and choosing wrong can inflate an O(V + E) algorithm to O(V^2) or worse.',
        'Three standard representations cover the useful tradeoff space: the edge list (a flat sequence of pairs), the adjacency list (a per-vertex collection of neighbors), and the adjacency matrix (a V-by-V grid of booleans or weights). Each one stores exactly the same information. The difference is how fast you can extract different slices of it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest way to store a graph is a list of edges. Each edge is a pair (u, v), and you append pairs as you discover connections. Reading edges from a CSV file, a database join, or a network packet stream naturally produces this format. An edge list for a graph with E edges stores exactly E pairs. Space is O(E), construction is O(1) per edge (just append), and the structure fits in a single flat array.',
        'This format works well for batch processing. Kruskal\'s minimum spanning tree algorithm sorts all edges by weight and processes them in ascending order -- an edge list is the perfect input. Bellman-Ford relaxes every edge V-1 times; iterating a flat edge array is the natural loop body. If all you need is to touch every edge once in bulk, an edge list is compact, cache-friendly, and trivially correct.',
        'For construction and bulk processing, there is nothing wrong with an edge list. It is the right tool for those jobs. The trouble starts when you need to ask questions about individual vertices.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The edge list breaks as soon as you need to answer a question about one vertex. "Who are the neighbors of vertex C?" requires scanning every edge in the list and checking whether either endpoint is C. If the graph has 300,000 edges, you do 300,000 comparisons to find the 4 neighbors of one vertex. That is O(E) per neighbor query.',
        '"Is there an edge from A to D?" also requires scanning the entire list: O(E). There is no index, no shortcut, no way to skip irrelevant edges. Every question about one vertex pays the cost of reading the whole graph.',
        'Run BFS on an edge list and the total cost becomes O(V * E). Each of the V vertex expansions scans all E edges to find neighbors. A graph with 100,000 vertices and 300,000 edges turns BFS into 30 billion comparisons instead of 400,000. The edge list is a construction format, not a query format, and the gap grows linearly with graph size.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The fix is to pre-index the edges by vertex so that each vertex\'s connections can be found without scanning the whole graph. There are two ways to build this index, and each one optimizes a different query pattern.',
        'The adjacency list indexes by vertex identity: each vertex u keeps its own collection of neighbors. Asking "who are u\'s neighbors?" reads that one collection and stops. The cost is proportional to the number of neighbors (the degree of u), not the total number of edges in the graph. A vertex with 4 neighbors in a 300,000-edge graph reads 4 entries, not 300,000.',
        'The adjacency matrix indexes by vertex pair: a V-by-V grid where cell [i][j] tells you whether edge (i, j) exists. Asking "does edge (u, v) exist?" is a single array lookup -- O(1). No scanning, no searching. But this speed comes from reserving a cell for every possible pair, including pairs that have no edge.',
        'The tradeoff is between indexing by vertex (fast neighbor iteration, proportional space) and indexing by pair (instant edge lookup, quadratic space). Neither representation changes what the graph contains. They change how fast you can ask different questions about it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An adjacency list is an array of V collections, one per vertex. The collection for vertex u holds the identifiers of every vertex adjacent to u. In an undirected graph, edge (u, v) appears in both u\'s list and v\'s list, so the total number of entries across all lists is 2E. In a directed graph, edge u->v appears only in u\'s outgoing list. Weights are stored as (neighbor, weight) pairs instead of bare neighbor IDs. Space: O(V + E). Neighbor iteration: O(degree(u)) -- read u\'s list and stop. Edge existence check: O(degree(u)) -- scan u\'s list looking for v.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/28/6n-graph2.svg', alt: 'Six-node undirected graph used to illustrate adjacency matrix entries', caption: 'A labeled graph gives each vertex a stable coordinate, which is exactly what matrix rows and list headers name. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:6n-graph2.svg.'},
        'An adjacency matrix is a V x V two-dimensional array. Cell [i][j] is 1 if edge (i, j) exists, 0 if it does not. For weighted graphs, the cell holds the edge weight and a sentinel value (commonly infinity or -1) marks absent edges. Undirected graphs produce a symmetric matrix: [i][j] always equals [j][i]. Space: O(V^2) regardless of how many edges exist. Edge existence check: O(1) -- compute the array offset and read one cell. Neighbor iteration: O(V) -- scan the entire row, testing every cell and skipping zeros.',
        'An edge list is a flat sequence of (from, to) pairs, optionally augmented with weights. It can be sorted by source vertex, destination vertex, or weight depending on the algorithm. Space: O(E). Every query -- edge existence, neighbor enumeration, vertex degree -- costs O(E) because nothing is indexed.',
        'The three representations are interconvertible. Building an adjacency list from an edge list costs O(E): scan each edge and append to the appropriate list. Building a matrix from an edge list costs O(V^2 + E): allocate the grid (V^2) and fill in the edges (E). Extracting an edge list from either structure costs O(V + E) or O(V^2) respectively.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The adjacency list works because it exploits sparsity. In a sparse graph, each vertex connects to a small fraction of all vertices. A social network with a billion users has an average of a few hundred friends per person, not a billion. Storing only existing connections means space grows with the actual edge count, not the theoretical maximum of V^2. The list mirrors the graph\'s real density.',
        'The adjacency matrix works because it exploits arithmetic. The position of a cell encodes the identity of both endpoints: cell [3][7] always means "edge from vertex 3 to vertex 7." No hashing, no searching, no pointer chasing -- just an index computation. For dense graphs where most cells contain real edges, the O(V^2) space is not waste. It reflects the graph\'s actual structure.',
        'The edge list works because it preserves every edge with no redundancy. Each undirected edge appears once, not twice. No per-vertex indexing structure adds overhead. Algorithms that process all edges in bulk -- sorting, filtering, streaming, aggregating -- need nothing more than a flat scan.',
        'All three store identical information. You can reconstruct any one from any other. Correctness of a graph algorithm never depends on the representation choice. Only performance does. The representation is an engineering decision, not a mathematical one.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Adjacency list: O(V + E) space, O(degree) neighbor iteration, O(degree) edge existence check, O(1) edge insertion (append to list), O(degree) edge deletion (find and remove from list). Doubling both V and E roughly doubles total storage. A graph with 1,000 vertices and average degree 10 has 5,000 edges and stores about 1,000 list headers plus 10,000 neighbor entries = 11,000 units. At 10,000 vertices with the same average degree, storage grows to 110,000 units -- linear scaling.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Symmetric_group_4%3B_Cayley_graph_1%2C5%2C21_%28adjacency_matrix%29.svg/250px-Symmetric_group_4%3B_Cayley_graph_1%2C5%2C21_%28adjacency_matrix%29.svg.png', alt: 'Colored adjacency matrix for a Cayley graph', caption: 'A matrix makes O(1) edge tests visible, but every absent edge still occupies a cell. Sparse graphs turn most cells into paid-for zeros. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Symmetric_group_4;_Cayley_graph_1,5,21_(adjacency_matrix).svg.'},
        'Adjacency matrix: O(V^2) space, O(V) neighbor iteration, O(1) edge existence check, O(1) edge insertion, O(1) edge deletion. Doubling V quadruples storage. At 1,000 vertices: 1,000,000 cells. At 10,000 vertices: 100,000,000 cells. At 1,000,000 vertices: 10^12 cells, roughly a terabyte for a boolean grid. The same 1,000-vertex, degree-10 graph that needs 11,000 adjacency-list entries wastes 989,000 matrix cells on zeros -- a 90x space overhead.',
        'Edge list: O(E) space, O(E) edge existence check, O(E) neighbor iteration, O(1) insertion (append), O(E) deletion (scan and remove). The most compact format, but every per-vertex query pays the full-scan price. At 5,000 edges, every neighbor query reads 5,000 pairs. At 5,000,000 edges, it reads 5,000,000 pairs.',
        'The crossover point where a matrix becomes space-competitive with an adjacency list is when E approaches V^2 / 2 -- roughly when the graph is half-dense. Below that density, the list wins on space. Above it, the matrix wins on both space efficiency (fewer pointer overheads) and edge-lookup speed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Adjacency lists dominate in practice because most real graphs are sparse. Social networks (Facebook: ~3 billion vertices, average degree ~300) use adjacency lists or their compressed variants. Road networks (OpenStreetMap: ~1 billion vertices, average degree ~3) are extremely sparse -- a matrix would allocate 10^18 cells for a graph that has 3 billion edges. Web crawl graphs, citation networks, package dependency graphs, and biological interaction networks are all sparse and all use list-based representations.',
        'Adjacency matrices appear in algorithms where the access pattern is pair-indexed. Floyd-Warshall all-pairs shortest paths reads matrix[i][k] + matrix[k][j] in three nested loops -- each iteration is a single O(1) lookup. Matrix exponentiation counts paths of length k by repeated matrix multiplication. Small dense graphs like game state spaces, finite automata transition tables, and network flow formulations also favor matrices because the density justifies the space.',
        'Edge lists serve as the input and interchange format. CSV files of connections, database join results, and streaming graph feeds all produce edge lists. Kruskal\'s MST sorts the edge list by weight and processes edges in ascending order. Bellman-Ford relaxes every edge V-1 times by iterating the edge array. In large-scale graph analytics (MapReduce, Spark GraphX), the edge list is the canonical serialization format that gets converted to Compressed Sparse Row (CSR) for computation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The adjacency list\'s weakness is edge existence queries. Checking whether edge (u, v) exists requires scanning u\'s neighbor list, costing O(degree(u)). For algorithms that repeatedly test individual edges, this cost accumulates. Two mitigations exist: replacing each neighbor array with a hash set gives O(1) amortized edge checks but roughly doubles memory per entry and adds implementation complexity; sorting neighbor lists and using binary search gives O(log degree) as a middle ground.',
        'The adjacency matrix\'s weakness is space. A million-vertex social graph with average degree 50 has 25 million edges but the matrix allocates 10^12 cells -- a 40,000x overhead. Even if each cell is a single bit, the matrix consumes 125 gigabytes. Neighbor iteration is also expensive: finding the neighbors of one vertex scans V cells regardless of degree, inflating BFS from O(V + E) to O(V^2).',
        'The edge list\'s weakness is everything except construction and bulk streaming. O(E) for every per-vertex query makes it unusable as the primary data structure for interactive algorithms. BFS on an edge list costs O(V * E). Dijkstra on an edge list would cost O(V * E * log V). It is raw material, not a finished index.',
        'None of the three basic representations handles frequent edge insertions and deletions gracefully in all cases. Adjacency lists handle insertion well (O(1) append) but deletion is O(degree). Matrices handle both in O(1) but waste space. Dynamic graphs with high churn -- real-time social feeds, evolving road networks, streaming interaction graphs -- may need specialized structures like adjacency hash maps, link-cut trees, or dynamic graph databases.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: 5 vertices (A, B, C, D, E) and 7 undirected edges: A-B, A-C, B-C, B-D, C-D, C-E, D-E. We will store this graph in all three representations and compare the cost of two operations: finding all neighbors of C, and checking whether edge A-D exists.',
        'Edge list: 7 rows, each a (from, to) pair. (A,B), (A,C), (B,C), (B,D), (C,D), (C,E), (D,E). Space: 7 pairs = 14 values. Neighbors of C: scan all 7 edges, check each endpoint against C. Edges (A,C), (B,C), (C,D), (C,E) match, yielding neighbors {A, B, D, E}. Cost: 7 comparisons (one per edge) for 4 results. Edge A-D: scan all 7 edges looking for (A,D) or (D,A). None match. Cost: 7 comparisons for a negative answer.',
        'Adjacency list: 5 lists. A:[B,C], B:[A,C,D], C:[A,B,D,E], D:[B,C,E], E:[C,D]. Total entries: 2 + 3 + 4 + 3 + 2 = 14 (each edge counted twice, as expected: 2 * 7 = 14). Space: 5 list headers + 14 entries = 19 units. Neighbors of C: read C\'s list directly -- {A, B, D, E}. Cost: 4 reads, zero waste. Edge A-D: scan A\'s list [B, C]. D is not found. Cost: 2 comparisons.',
        'Adjacency matrix: 5x5 grid = 25 cells. Row A = [0,1,1,0,0]. Row B = [1,0,1,1,0]. Row C = [1,1,0,1,1]. Row D = [0,1,1,0,1]. Row E = [0,0,1,1,0]. Seven cells contain 1, eighteen contain 0. Space: 25 cells. Neighbors of C: scan row C -- cells [C][A]=1, [C][B]=1, [C][C]=0, [C][D]=1, [C][E]=1. Cost: 5 checks (the full row) for 4 neighbors. Edge A-D: read cell [A][D] = 0. Cost: 1 lookup.',
        'Scaling comparison: at this small scale (V=5, E=7), all three are close -- 14 values, 19 units, and 25 cells. At V=1,000 with E=5,000 (average degree 10), the edge list stores 10,000 values, the adjacency list stores about 15,000 entries, and the matrix stores 1,000,000 cells. At V=100,000 with E=500,000, the edge list stores 1,000,000 values, the adjacency list stores about 1,100,000 entries, and the matrix stores 10,000,000,000 cells -- ten billion, roughly 10 GB at one byte per cell. The adjacency list is 10,000x more compact than the matrix at that scale.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cormen, Leiserson, Rivest, and Stein (CLRS), Introduction to Algorithms, Chapter 22: the standard formal treatment of graph representations, BFS, and DFS with proofs of correctness and running time. Sedgewick and Wayne, Algorithms 4th edition: practical adjacency list implementations in Java with working code. Tarjan, Data Structures and Network Algorithms (1983): foundational treatment of graph data structures and their role in efficient network algorithms.',
        'Prerequisites: arrays (the backbone of matrix storage), linked lists or dynamic arrays (the building blocks of adjacency lists), and hash tables (for O(1) edge lookups in adjacency-list variants). Understanding pointer-based vs. array-based storage clarifies why adjacency lists use O(V + E) space.',
        'Algorithms to study next, organized by which representation they naturally use. Adjacency list algorithms: BFS (level-by-level neighbor iteration), DFS (recursive or stack-based neighbor iteration), Dijkstra (weighted neighbor iteration with a priority queue), topological sort (DFS-based ordering of directed acyclic graphs). Adjacency matrix algorithms: Floyd-Warshall (all-pairs shortest paths via triple-nested loops), matrix exponentiation (counting paths of length k). Edge list algorithms: Kruskal\'s MST (sort by weight, union-find), Bellman-Ford (relax all edges V-1 times).',
        'Production-grade formats: Compressed Sparse Row (CSR) is the flat-array encoding of adjacency lists, eliminating per-list pointer overhead for cache-friendly traversal. The standard pipeline in large-scale graph analytics is: read edge list from storage, convert to CSR in memory, run the algorithm. GraphBLAS and similar libraries operate on sparse matrix representations that bridge the adjacency-list and adjacency-matrix worlds.',
      ],
    },
  ],
};
