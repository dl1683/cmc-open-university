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
  yield {
    state: graphSnapshot('5-vertex undirected graph'),
    highlight: { active: ['A'] },
    explanation: 'A graph is vertices and edges. This undirected graph has 5 vertices (A-E) and 7 edges. The first question for any graph algorithm: how do we store this in memory so we can answer "are X and Y connected?" and "who are X\'s neighbors?" efficiently?',
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
    explanation: 'An adjacency matrix is a V x V grid. Cell [i][j] is 1 if an edge connects vertex i to vertex j, 0 otherwise. For undirected graphs the matrix is symmetric: [A][B] = [B][A] = 1. Edge lookup is O(1) — just index into the array.',
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
    explanation: 'The diagonal is all zeros because no vertex has a self-loop. Every 0 in the matrix costs the same memory as every 1. With 5 vertices we store 25 cells for 7 edges. With 1,000 vertices and 3,000 edges, we store 1,000,000 cells for 3,000 edges — 99.7% wasted zeros.',
  };

  yield {
    state: matrixState({
      title: 'Finding neighbors of C',
      rows,
      columns: cols,
      values: vals,
      format: (v) => String(v),
    }),
    highlight: { active: ['C:A', 'C:B', 'C:C', 'C:D', 'C:E'], found: ['C:A', 'C:B', 'C:D', 'C:E'] },
    explanation: 'To find all neighbors of C, scan the entire row: check C:A, C:B, C:C, C:D, C:E. That is O(V) work regardless of how many neighbors C has. C has 4 neighbors but we still checked all 5 cells. On a sparse graph with 10,000 vertices where C has 3 neighbors, we check 10,000 cells to find 3.',
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
    explanation: 'The matrix excels at edge existence checks — O(1), just an array index. But it pays O(V^2) space even when edges are sparse, and scanning neighbors costs O(V) regardless of degree. Dense graphs (where E is close to V^2) pay a fair price; sparse graphs waste most of that memory.',
  };
}

// ---------- Adjacency list view ----------
function* adjacencyListView() {
  yield {
    state: graphSnapshot('Same 5-vertex graph'),
    highlight: { active: ['C'] },
    explanation: 'Same graph, different storage question. Instead of a big grid, what if each vertex just keeps a list of its own neighbors? That is the adjacency list: one collection per vertex, containing only the vertices it connects to.',
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
    explanation: 'Each row stores only actual neighbors. A has [B, C]. C has [A, B, D, E]. No wasted zeros. Total storage across all rows: each edge appears twice (once per endpoint in an undirected graph), so total entries = 2E = 14. Compare that to the matrix\'s 25 cells.',
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
    explanation: 'Neighbors of C? Just read its list: A, B, D, E. Time: O(degree of C) = O(4). No scanning empty cells. For a vertex with 3 neighbors in a 10,000-vertex graph, this reads 3 entries instead of 10,000.',
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
    explanation: 'Is there an edge between A and D? Scan A\'s list: [B, C]. D is not there. Time: O(degree of A) = O(2). For a vertex with many neighbors, this scan can be slow. The matrix answered the same question in O(1). This is the core tradeoff.',
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
    explanation: 'The adjacency list uses space proportional to the actual graph, not the possible graph. Neighbor iteration costs only O(degree). The price: edge existence checks require scanning a list instead of indexing an array. Most graph algorithms (BFS, DFS, Dijkstra, Kruskal) spend their time iterating neighbors, not checking individual edges, so the list usually wins.',
  };
}

// ---------- Edge list view ----------
function* edgeListView() {
  yield {
    state: graphSnapshot('Same 5-vertex graph'),
    highlight: { active: ['AB', 'CD'] },
    explanation: 'The simplest representation: just list every edge as a pair of vertices. No indexing, no per-vertex structure. An edge list is what you get when you read a file of connections.',
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
    explanation: 'Seven edges, seven rows. Each row is a (from, to) pair. Space: O(E). This is compact and easy to build — just append edges as you discover them. Sorting by weight makes this the input format for Kruskal\'s MST algorithm.',
    invariant: 'Each undirected edge appears exactly once, not twice.',
  };

  yield {
    state: labelMatrix(
      'Edge list: finding neighbors of C',
      edgeRows,
      [{ id: 'from', label: 'from' }, { id: 'to', label: 'to' }],
      EDGES.map((e) => [e.from, e.to]),
    ),
    highlight: { found: ['AC:from', 'AC:to', 'BC:from', 'BC:to', 'CD:from', 'CD:to', 'CE:from', 'CE:to'] },
    explanation: 'To find neighbors of C, scan every edge and check if either endpoint is C. Time: O(E) — the entire list. For a graph with millions of edges, this is expensive for a single neighbor query. Edge lists are for building and sorting, not for repeated neighbor lookups.',
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
    explanation: 'The edge list is the most compact and the easiest to build, but the worst for queries. Its strength is input and construction: read edges from a file, sort them by weight for Kruskal, or stream them into a better structure. Think of it as the raw material, not the finished index.',
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
    explanation: 'For sparse graphs (most real-world graphs), the adjacency list wins on both space and neighbor iteration. The matrix wins only when edge lookups dominate or the graph is dense. The edge list is a construction format, not a query format. Choose the representation that matches your algorithm\'s access pattern.',
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
        'Use the selector to switch between three views of the same 5-vertex, 7-edge undirected graph. Active highlights mark cells or entries under inspection. Found highlights mark query results. Compare highlights expose wasted work or space.',
        {type: 'callout', text: 'A graph representation is a query contract: the same edges can be stored to favor neighbor scans, edge-existence checks, or streaming all edges.'},
        'In the matrix view, watch the neighbor query: it scans every cell in a row, including zeros. In the list view, the scan touches only actual neighbors and stops. In the edge list view, every query scans every edge. The cost difference is visible in the number of highlighted cells.',
        'The comparison table at the end of the edge list view summarizes all three representations side by side. One safe inference: if your algorithm iterates neighbors (BFS, DFS, Dijkstra), the adjacency list wins. If it checks individual edge existence (Floyd-Warshall, matrix exponentiation), the matrix wins.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Graphs model anything with connections: social networks, road maps, web links, dependency chains, circuit boards. The abstract definition is simple -- vertices and edges. The engineering question is how to store those edges so algorithms can query them without wasting time or memory.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'The abstract graph is small; the representation choice decides whether an algorithm sees rows, neighbor lists, or edge records. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Graph algorithms ask two kinds of questions. "Is there an edge from u to v?" is a point query. "Give me all neighbors of u" is an iteration query. Different storage layouts optimize for different questions, and choosing wrong can turn an O(V + E) traversal into an O(V^2) one. The three standard representations -- edge list, adjacency list, adjacency matrix -- cover the useful tradeoff space.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest representation is a list of edges: store each edge as a (u, v) pair, one per connection. Reading edges from a file, a sensor, or a database join naturally produces this format. Space is O(E), construction is append-only, and the whole structure fits in a flat array.',
        'This works for batch operations. Kruskal\'s minimum spanning tree algorithm sorts edges by weight and processes them in order -- an edge list is the perfect input. Building a graph from scratch is just appending pairs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The edge list breaks down as soon as you need to answer a question about one vertex. "Who are C\'s neighbors?" requires scanning every edge in the list and checking whether either endpoint is C. That costs O(E). "Is there an edge from A to D?" also costs O(E). Run BFS on an edge list and the total cost becomes O(V * E) instead of O(V + E), because each vertex expansion scans the entire edge set.',
        'A 100,000-vertex graph with 300,000 edges makes BFS do 30 billion checks instead of 400,000. The edge list is a construction format, not a query format.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Adjacency list: an array of V lists. Entry u holds the IDs of all vertices adjacent to u. In an undirected graph, edge (u, v) appears in both u\'s list and v\'s list, so total entries across all lists equal 2E. In a directed graph, edge u -> v appears only in u\'s outgoing list. Weights attach as (neighbor, weight) pairs. Space: O(V + E). Neighbor iteration: O(degree(u)) -- read u\'s list and stop. Edge existence check: O(degree(u)) -- scan u\'s list for v.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/28/6n-graph2.svg', alt: 'Six-node undirected graph used to illustrate adjacency matrix entries', caption: 'A labeled graph gives each vertex a stable coordinate, which is exactly what matrix rows and list headers name. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:6n-graph2.svg.'},
        'Adjacency matrix: a V x V 2D array. Cell [i][j] is 1 if edge (i, j) exists, 0 otherwise. For weighted graphs, the cell holds the weight and a sentinel (infinity or -1) marks absent edges. Undirected graphs produce a symmetric matrix. Space: O(V^2). Edge existence check: O(1) -- index directly. Neighbor iteration: O(V) -- scan the entire row, skipping zeros.',
        'Edge list: a flat sequence of (from, to) pairs, optionally with weights. Can be sorted by source, destination, or weight. Space: O(E). Everything else: O(E) per query.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The adjacency list exploits sparsity. Real-world graphs are almost always sparse: each vertex connects to a small fraction of all other vertices. Storing only existing edges means the structure grows with the graph\'s actual density, not its theoretical maximum.',
        'The adjacency matrix exploits structure. Position encodes identity: cell [3][7] always means "edge from vertex 3 to vertex 7." No scanning, no hashing, just arithmetic. For dense graphs where most cells are filled, the O(V^2) space is not wasted -- it reflects reality.',
        'The edge list exploits simplicity. It preserves every edge with no redundancy and no per-vertex indexing overhead. Algorithms that process all edges in bulk (sort, filter, aggregate) need nothing more.',
        'All three represent the same information. Correctness does not depend on the choice. Performance does.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Adjacency list: O(V + E) space, O(degree) neighbor scan, O(degree) edge check, O(1) edge add (append), O(degree) edge remove. Doubling V and E roughly doubles storage. A graph with 1,000 vertices and average degree 10 stores about 11,000 entries.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Symmetric_group_4%3B_Cayley_graph_1%2C5%2C21_%28adjacency_matrix%29.svg/250px-Symmetric_group_4%3B_Cayley_graph_1%2C5%2C21_%28adjacency_matrix%29.svg.png', alt: 'Colored adjacency matrix for a Cayley graph', caption: 'A matrix makes O(1) edge tests visible, but every absent edge still occupies a cell. Sparse graphs turn most cells into paid-for zeros. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Symmetric_group_4;_Cayley_graph_1,5,21_(adjacency_matrix).svg.'},
        'Adjacency matrix: O(V^2) space, O(V) neighbor scan, O(1) edge check, O(1) edge add/remove. Doubling V quadruples storage. 1,000 vertices: 1,000,000 cells. 10,000 vertices: 100,000,000 cells. 1,000,000 vertices: 10^12 cells -- roughly a terabyte just for a boolean grid. The same 1,000-vertex graph with degree 10 that needs 11,000 list entries wastes 989,000 matrix cells on zeros.',
        'Edge list: O(E) space, O(E) edge check, O(E) neighbor scan, O(1) append, O(E) removal. Compact and trivial to build, but every query pays the price of a full scan.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Adjacency list: BFS, DFS, Dijkstra, topological sort, and nearly every traversal algorithm. Social networks with billions of users and hundreds of connections per user. Road networks where each intersection meets a few streets. Web crawl graphs where each page has a handful of outgoing links. Dependency graphs in package managers (npm, pip, Make). These are all sparse -- average degree is tiny compared to V.',
        'Adjacency matrix: Floyd-Warshall all-pairs shortest paths (accesses matrix[i][k] + matrix[k][j] in three nested loops). Matrix exponentiation to count paths of length k. Small dense graphs like game boards, finite state machines, or network flow formulations where nearly every pair of nodes shares an edge. Any algorithm that checks edge existence more often than it iterates neighbors.',
        'Edge list: Kruskal\'s MST (sort edges by weight, process in order). Streaming graph construction from files, sensors, or database results. Bellman-Ford (relaxes every edge V-1 times -- an edge list is the natural iteration target).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Adjacency list: checking whether a specific edge exists costs O(degree). For algorithms that repeatedly ask "does edge (u, v) exist?" this adds up. Replacing each neighbor array with a hash set gives O(1) amortized edge checks but adds memory overhead and implementation complexity. Sorted neighbor lists with binary search give O(log degree) as a middle ground.',
        'Adjacency matrix: O(V^2) space is prohibitive for large sparse graphs. A million-vertex social graph with average degree 50 would store 10^12 cells for 50 million edges -- a 20,000x overhead. Neighbor iteration always costs O(V) per vertex, inflating BFS from O(V + E) to O(V^2).',
        'Edge list: O(E) for every query makes it unusable as a primary data structure for interactive algorithms. BFS on an edge list costs O(V * E). It is raw material, not a finished index.',
        'None of the three handles frequent edge insertions and deletions well in all cases. Dynamic graphs with high churn may need specialized structures like adjacency skip lists or link-cut trees.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: 5 vertices (A-E), 7 undirected edges: A-B, A-C, B-C, B-D, C-D, C-E, D-E.',
        'Edge list: 7 pairs, 14 values stored. (A,B), (A,C), (B,C), (B,D), (C,D), (C,E), (D,E). Finding neighbors of C: scan all 7 edges, check each endpoint. Seven comparisons yield four neighbors.',
        'Adjacency list: 5 lists, 14 neighbor entries total (each edge counted twice). A:[B,C], B:[A,C,D], C:[A,B,D,E], D:[B,C,E], E:[C,D]. Finding neighbors of C: read its list directly. Four entries, four neighbors, zero waste.',
        'Adjacency matrix: 5x5 grid, 25 cells. Row A=[0,1,1,0,0], Row B=[1,0,1,1,0], Row C=[1,1,0,1,1], Row D=[0,1,1,0,1], Row E=[0,0,1,1,0]. Finding neighbors of C: scan row C, all 5 cells. Five checks yield four neighbors plus one zero.',
        'Space comparison for this graph: edge list stores 14 values, adjacency list stores 14 entries + 5 list headers = 19 units, matrix stores 25 cells. The list and edge list are close at this scale. At 1,000 vertices with 5,000 edges, the edge list stores 10,000 values, the adjacency list stores about 15,000 entries, and the matrix stores 1,000,000 cells. The gap widens fast.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cormen, Leiserson, Rivest, Stein (CLRS), Chapter 22: formal treatment of graph representations and their role in BFS/DFS. Sedgewick & Wayne, Algorithms 4th ed.: practical adjacency list implementations in Java. Euler 1736, "Solutio problematis ad geometriam situs pertinentis": the Konigsberg bridges paper that started graph theory.',
        'Prerequisites: arrays and linked lists (the building blocks of adjacency lists).',
        'Algorithms that exercise these structures: BFS (neighbor iteration on adjacency lists), DFS (same), Dijkstra (weighted neighbor iteration with a priority queue), Floyd-Warshall (triple-nested loop over an adjacency matrix).',
        'Production formats: Compressed Sparse Row (CSR) -- the flat-array version of adjacency lists for cache-friendly traversal. Edge list with CSR conversion is the standard pipeline for large-scale graph analytics.',
      ],
    },
  ],
};
