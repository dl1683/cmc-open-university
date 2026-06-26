// Articulation points and bridges via Tarjan's DFS: a single pass finds
// every vertex and edge whose removal disconnects an undirected graph.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'articulation-points-bridges',
  title: 'Articulation Points & Bridges',
  category: 'Data Structures',
  summary: 'Find every vertex and edge whose removal breaks an undirected graph — one DFS pass with disc/low values does all the work.',
  controls: [],
  run,
};

// A 7-node undirected graph that contains:
//   - Articulation points: B (removing B disconnects {A} from the rest),
//     D (removing D disconnects {E,F,G} from {A,B,C})
//   - Bridge: edge B-D (removing it disconnects the two biconnected components)
//   - Non-bridge back edges forming cycles: A-B-C-A, D-E-F-D, D-G-F
//
// Layout:
//   A --- B --- D --- E
//    \   /       \   /
//     C           F
//                 |
//                 G --- D  (back edge)
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 3.0 },
  { id: 'B', label: 'B', x: 2.8, y: 3.0 },
  { id: 'C', label: 'C', x: 1.9, y: 5.2 },
  { id: 'D', label: 'D', x: 5.0, y: 3.0 },
  { id: 'E', label: 'E', x: 7.0, y: 1.5 },
  { id: 'F', label: 'F', x: 7.0, y: 4.5 },
  { id: 'G', label: 'G', x: 5.0, y: 5.5 },
];

// Undirected edges — each stored once; adjacency list adds both directions.
const EDGES = [
  { id: 'AB', from: 'A', to: 'B' },
  { id: 'AC', from: 'A', to: 'C' },
  { id: 'BC', from: 'B', to: 'C' },
  { id: 'BD', from: 'B', to: 'D' },
  { id: 'DE', from: 'D', to: 'E' },
  { id: 'EF', from: 'E', to: 'F' },
  { id: 'DF', from: 'D', to: 'F' },
  { id: 'DG', from: 'D', to: 'G' },
  { id: 'FG', from: 'F', to: 'G' },
];

// Build undirected adjacency list (both directions).
const adj = new Map(NODES.map((n) => [n.id, []]));
for (const e of EDGES) {
  adj.get(e.from).push({ to: e.to, edgeId: e.id });
  adj.get(e.to).push({ to: e.from, edgeId: e.id });
}

function findEdgeId(u, v) {
  const e = EDGES.find(
    (e) => (e.from === u && e.to === v) || (e.from === v && e.to === u),
  );
  return e ? e.id : null;
}

export function* run() {
  const disc = new Map();
  const low = new Map();
  const parent = new Map();
  const articulationPts = new Set();
  const bridges = [];
  let timer = 0;

  const snapshot = () =>
    graphState({
      nodes: NODES.map((n) => ({
        ...n,
        note: disc.has(n.id)
          ? `d=${disc.get(n.id)} l=${low.get(n.id)}`
          : '',
      })),
      edges: EDGES,
    });

  yield {
    state: snapshot(),
    highlight: {},
    explanation:
      'A 7-node undirected graph. Some vertices and edges are structurally critical: removing them would split the graph into disconnected pieces. Vertices with this property are articulation points (cut vertices). Edges with this property are bridges. One DFS pass with two values per node — disc (discovery time) and low (lowest disc reachable via back edges) — finds all of them.',
  };

  // Iterative DFS to find articulation points and bridges.
  for (const startNode of NODES) {
    if (disc.has(startNode.id)) continue;

    const dfsStack = [{ node: startNode.id, ni: 0 }];
    timer++;
    disc.set(startNode.id, timer);
    low.set(startNode.id, timer);
    parent.set(startNode.id, null);

    yield {
      state: snapshot(),
      highlight: { active: [startNode.id] },
      explanation: `Start DFS from ${startNode.id}. Set disc[${startNode.id}] = ${timer}, low[${startNode.id}] = ${timer}. The root needs special handling: it is an articulation point only if it has two or more children in the DFS tree.`,
    };

    while (dfsStack.length > 0) {
      const frame = dfsStack[dfsStack.length - 1];
      const u = frame.node;
      const neighbors = adj.get(u);

      if (frame.ni < neighbors.length) {
        const { to: v, edgeId } = neighbors[frame.ni];
        frame.ni++;

        if (!disc.has(v)) {
          // Tree edge — discover v
          timer++;
          disc.set(v, timer);
          low.set(v, timer);
          parent.set(v, u);
          dfsStack.push({ node: v, ni: 0 });

          yield {
            state: snapshot(),
            highlight: {
              active: [v],
              compare: [edgeId],
              found: [...articulationPts],
              swap: [...bridges],
              visited: [...disc.keys()].filter(
                (k) => k !== v && !articulationPts.has(k),
              ),
            },
            explanation: `Tree edge ${u}-${v}. Discover ${v}: disc[${v}] = ${timer}, low[${v}] = ${timer}. Parent[${v}] = ${u}.`,
          };
        } else if (v !== parent.get(u)) {
          // Back edge — v is already visited and is not the parent
          const oldLow = low.get(u);
          low.set(u, Math.min(low.get(u), disc.get(v)));

          yield {
            state: snapshot(),
            highlight: {
              active: [u],
              compare: [edgeId],
              swap: [v, ...bridges],
              found: [...articulationPts],
              visited: [...disc.keys()].filter(
                (k) => k !== u && !articulationPts.has(k),
              ),
            },
            explanation: `Back edge ${u}-${v}. Node ${v} was already visited (disc[${v}] = ${disc.get(v)}), so ${u} can reach an ancestor without going through its parent. Update low[${u}] = min(${oldLow}, disc[${v}]) = ${low.get(u)}. This back edge protects everything between ${v} and ${u} from being disconnected.`,
          };
        }
        // If v === parent.get(u), skip — that is the edge we came from.
      } else {
        // All neighbors processed — propagate low and check conditions
        dfsStack.pop();

        if (dfsStack.length > 0) {
          const par = dfsStack[dfsStack.length - 1].node;
          const oldLowPar = low.get(par);
          low.set(par, Math.min(low.get(par), low.get(u)));

          if (low.get(par) < oldLowPar) {
            yield {
              state: snapshot(),
              highlight: {
                active: [par],
                compare: [u],
                found: [...articulationPts],
                swap: [...bridges],
                visited: [...disc.keys()].filter(
                  (k) => k !== par && !articulationPts.has(k),
                ),
              },
              explanation: `Return from ${u} to ${par}. Propagate: low[${par}] = min(${oldLowPar}, low[${u}]) = min(${oldLowPar}, ${low.get(u)}) = ${low.get(par)}. Whatever ${u}'s subtree can reach, ${par} can reach too.`,
            };
          }

          // Bridge check: low[u] > disc[par] means u's subtree has NO back
          // edge reaching par or above — the edge par-u is a bridge.
          if (low.get(u) > disc.get(par)) {
            const bEdge = findEdgeId(par, u);
            if (bEdge) bridges.push(bEdge);

            yield {
              state: snapshot(),
              highlight: {
                active: [par, u],
                swap: [...bridges],
                found: [...articulationPts],
                visited: [...disc.keys()].filter(
                  (k) =>
                    k !== par && k !== u && !articulationPts.has(k),
                ),
              },
              explanation: `Bridge found: low[${u}] = ${low.get(u)} > disc[${par}] = ${disc.get(par)}. No back edge from ${u}'s subtree reaches ${par} or above. Removing edge ${par}-${u} disconnects the graph.`,
            };
          }

          // Articulation point check for non-root:
          // par is an articulation point if low[u] >= disc[par] — u's
          // subtree cannot reach above par.
          if (low.get(u) >= disc.get(par) && parent.get(par) !== null) {
            if (!articulationPts.has(par)) {
              articulationPts.add(par);
              yield {
                state: snapshot(),
                highlight: {
                  active: [par],
                  found: [...articulationPts],
                  swap: [...bridges],
                  visited: [...disc.keys()].filter(
                    (k) => k !== par && !articulationPts.has(k),
                  ),
                },
                explanation: `Articulation point found: low[${u}] = ${low.get(u)} >= disc[${par}] = ${disc.get(par)}, and ${par} is not the root. ${u}'s subtree has no back edge reaching above ${par}. Removing ${par} disconnects ${u}'s subtree from the rest of the graph.`,
              };
            }
          }
        }

        // Root articulation-point check: count DFS-tree children.
        if (parent.get(u) === null && dfsStack.length === 0) {
          let rootChildren = 0;
          for (const n of NODES) {
            if (parent.get(n.id) === u) rootChildren++;
          }
          if (rootChildren >= 2) {
            articulationPts.add(u);
            yield {
              state: snapshot(),
              highlight: {
                active: [u],
                found: [...articulationPts],
                swap: [...bridges],
                visited: [...disc.keys()].filter(
                  (k) => k !== u && !articulationPts.has(k),
                ),
              },
              explanation: `Root ${u} has ${rootChildren} DFS-tree children. A root with 2+ children is an articulation point because its children were only reachable through the root during DFS — removing it disconnects them.`,
            };
          }
        }
      }
    }
  }

  // Final summary
  const apList =
    articulationPts.size > 0 ? [...articulationPts].join(', ') : 'none';
  const brList =
    bridges.length > 0
      ? bridges
          .map((eid) => {
            const e = EDGES.find((e) => e.id === eid);
            return e ? `${e.from}-${e.to}` : eid;
          })
          .join(', ')
      : 'none';

  yield {
    state: snapshot(),
    highlight: {
      found: [...articulationPts],
      swap: [...bridges],
      visited: [...disc.keys()].filter((k) => !articulationPts.has(k)),
    },
    explanation: `Done. Articulation points: {${apList}}. Bridges: {${brList}}. Found in a single DFS pass — O(V + E) time, O(V) space. Each articulation point is a single point of failure: removing it splits the graph. Each bridge is a critical link: removing it creates a disconnect.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization shows an undirected graph with seven labeled nodes and nine edges. A depth-first search (DFS) walks through the graph one node at a time. As each node is first visited, it gets two numbers displayed next to it: d (its discovery time, a counter that ticks up each time DFS reaches a new node) and l (its low-link value, the smallest discovery time reachable from that node or any of its descendants through a back edge). These two numbers encode everything the algorithm needs.',
        'A node highlighted as "active" is the one DFS is currently processing. Nodes marked "visited" have been discovered but DFS has moved past them. When a back edge is found (an edge to an already-visited ancestor), the target node flashes to signal that the current node has an escape route upward in the DFS tree. Once the algorithm confirms a node is an articulation point, it glows in the "found" color. Bridge edges get their own distinct marking.',
        'The critical moment is the return phase. When DFS finishes a child u and returns to parent v, it compares low[u] against disc[v]. If low[u] >= disc[v], then u\'s entire subtree has no back edge reaching above v, so v is an articulation point. If low[u] > disc[v] (strictly greater), the tree edge v-u is a bridge. Watch how the low values propagate upward as the DFS unwinds: each parent absorbs the best escape route its children found.',
        {type: 'callout', text: 'Disc and low values turn single-failure connectivity into a one-pass escape-route test.'},

        {type: 'image', src: './assets/gifs/articulation-points-bridges.gif', alt: 'Animated walkthrough of the articulation points bridges visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A graph is a set of nodes connected by edges. An undirected graph means every edge works in both directions: if A connects to B, B connects to A. A connected graph is one where you can walk from any node to any other by following edges. The question this algorithm answers is: which nodes or edges, if removed one at a time, would break that connectivity?',
        'An articulation point (also called a cut vertex) is a node whose removal splits the graph into two or more disconnected pieces. A bridge (also called a cut edge) is an edge whose removal does the same. These are the single points of failure in any network. Every system that depends on connectivity needs to know where they are.',
        {type: 'image', src: 'https://he-s3.s3.amazonaws.com/media/uploads/64bb796.png', alt: 'Undirected graph with vertices 0 through 5 before removing cut vertices.', caption: 'This base graph shows the connectivity that articulation points and bridges threaten. (Source: he-s3.s3.amazonaws.com)'},
        'Internet backbone operators need to know which routers, if lost, partition the network into unreachable halves. Power grid engineers need to know which substation failures island customers from generators. Circuit designers need to verify that no signal path depends on a single irreplaceable trace. In each case, the structural question is identical: where is there exactly one path, with no redundancy?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The brute-force method is conceptually simple. To find articulation points: for each vertex v, temporarily delete v and all its edges from the graph, then run BFS or DFS on whatever remains. If the remaining graph has more connected components than the original, v is an articulation point. Repeat for every vertex. To find bridges: do the same thing for each edge.',
        {type: 'image', src: 'https://he-s3.s3.amazonaws.com/media/uploads/f0f779f.png', alt: 'Graph split into components after removing an articulation vertex.', caption: 'Removing a cut vertex makes the failure mode concrete: one graph becomes disconnected components. (Source: he-s3.s3.amazonaws.com)'},
        'Each connectivity check (BFS or DFS on the remaining graph) costs O(V + E), where V is the number of vertices and E is the number of edges. You run V checks for articulation points and E checks for bridges. The total cost is O(V(V + E)) for vertices and O(E(V + E)) for edges. On a graph with 100 nodes and 300 edges, that is roughly 40,000 operations for articulation points alone. Completely fine for small graphs and homework problems.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Real networks are not small. An internet backbone has millions of routers and tens of millions of links. The brute-force approach runs millions of separate BFS/DFS traversals, each touching tens of millions of edges. On a graph with V = 10^6 and E = 10^7, the articulation-point check alone costs roughly V * (V + E) = 10^6 * 1.1 * 10^7 = 10^13 operations. Even at a billion operations per second, that takes hours for a result that is stale by the time it finishes.',
        'The waste is structural, not just quantitative. When the brute-force method removes vertex A and finds the graph stays connected, it discovers alternate paths around A. Then it throws all of that information away, removes vertex B, and rediscovers the same structure. Each check is independent and learns nothing from the previous one. The algorithm is doing the same work over and over. A single traversal that accumulates reachability information as it goes should be able to answer all V questions at once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'When DFS runs on an undirected graph, every edge falls into exactly one of two categories. A tree edge leads to an unvisited node, extending the DFS tree. A back edge leads to a node that was already visited and is an ancestor in the DFS tree. There are no other possibilities in undirected graphs: an edge to an already-visited non-ancestor would mean DFS already processed it from the other side, making it a tree edge from that direction. This two-way classification is the foundation of the algorithm.',
        'Back edges are escape routes. A back edge from descendant d up to ancestor a proves there is a cycle connecting a and d, so even if you remove any single node between them on the tree path, the graph stays connected through the back edge. The question "can u\'s subtree survive without parent v?" reduces to "does any back edge from u\'s subtree reach above v?" If yes, there is a bypass and v is safe to remove. If no, removing v strands u\'s subtree with no way back.',
        {type: 'image', src: 'https://he-s3.s3.amazonaws.com/media/uploads/f448894.png', alt: 'DFS tree for the same graph with tree edges and back edges.', caption: 'The DFS tree separates tree edges from back edges, which is the structure low-link values summarize. (Source: he-s3.s3.amazonaws.com)'},
        'The low value compresses this check into a single number. For each node v, low[v] is the minimum discovery time reachable from v\'s entire subtree through back edges. If low[child] >= disc[parent], every back edge from the child\'s subtree lands on or below the parent in the tree. Nothing escapes above the parent, so removing the parent disconnects the subtree. That makes the parent an articulation point. If the inequality is strict (low[child] > disc[parent]), the child\'s subtree cannot even reach the parent through any back edge, meaning the tree edge from parent to child is the only link. That edge is a bridge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize a global timer at 0 and three arrays: disc (discovery time), low (low-link value), and parent (who discovered this node). For each node that has not been visited yet, start a DFS from it. On first visiting node v: increment the timer, set disc[v] = low[v] = timer, and record v\'s parent.',
        'For each neighbor w of the current node v, there are three cases. Case 1: w has not been visited. This is a tree edge. Recurse into w (or push it onto the DFS stack). After DFS returns from w, set low[v] = min(low[v], low[w]), because whatever escape route w\'s subtree found, v inherits through the tree edge to w. Case 2: w has been visited and w is not v\'s parent. This is a back edge. Set low[v] = min(low[v], disc[w]). The edge to w gives v a shortcut to an ancestor discovered at time disc[w]. Case 3: w is v\'s parent. Skip it. That is just the tree edge DFS arrived on, not a useful back edge.',
        'After processing all neighbors of v, when DFS returns from child u to parent v, perform two checks. Bridge check: if low[u] > disc[v], then no back edge from u\'s entire subtree reaches v or above. The tree edge v-u is the sole connection, so it is a bridge. Articulation point check (non-root): if low[u] >= disc[v], then u\'s subtree has no escape route past v. Removing v disconnects the subtree, so v is an articulation point. The >= vs > distinction is important: when low[u] equals disc[v], a back edge reaches v itself, but removing v also removes that back edge endpoint, so v is still a cut vertex. However the edge v-u is not a bridge because the subtree can reach v through the back edge.',
        'Root special case: the DFS root has no parent, so the low comparison does not apply. A root is an articulation point if and only if it has two or more children in the DFS tree. If it has one child, removing the root just promotes the child. If it has two or more, those children were only reachable from each other through the root (otherwise DFS would have found the second child from the first), so removing the root splits them.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one structural fact about undirected DFS: every non-tree edge is a back edge. In directed graphs you also get cross edges and forward edges, but in undirected graphs those cannot exist. When DFS at node u sees an already-visited node w, either w is an ancestor (back edge) or w would have been discovered from u before u finished (which means u-w was already processed as a tree edge from w\'s side). This means the only alternate paths in the graph, when projected onto the DFS tree, are tree-edge paths augmented by back edges.',
        'For u\'s subtree to reach a node above parent v without going through v, some node in the subtree must have a back edge to an ancestor with discovery time less than disc[v]. low[u] is defined as the minimum over all such back-edge targets in u\'s subtree. So low[u] >= disc[v] exactly captures "no escape above v." The condition is both necessary and sufficient.',
        'For bridges: low[u] > disc[v] means u\'s subtree cannot reach even v itself through a back edge. The tree edge v-u is the only link. Removing it isolates u\'s subtree completely.',
        'For the root: if the root has children c1 and c2 in the DFS tree, there is no edge between c1\'s subtree and c2\'s subtree. If there were, DFS would have found c2 as a descendant of c1 (or vice versa) rather than as a separate child of the root. So removing the root disconnects c1\'s component from c2\'s.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(V + E). DFS visits each vertex exactly once and examines each edge exactly twice (once from each endpoint in the adjacency list). At each edge, the low-value update is a constant-time min operation. The articulation-point and bridge checks on return from a child are also constant time per edge. No edge is processed more than twice, so the total work is proportional to the graph size.',
        'Space: O(V). The algorithm stores disc, low, and parent arrays, each of size V. The DFS stack (whether implemented with recursion or an explicit stack) is at most V deep in the worst case (a path graph where every node is visited in sequence). No edge-level storage is needed beyond the original adjacency list.',
        'To calibrate: on a graph with 10,000 nodes and 50,000 edges, Tarjan\'s algorithm performs roughly 110,000 operations (visiting 10,000 nodes plus scanning 100,000 adjacency-list entries). The brute-force approach performs roughly 10,000 * 60,000 = 600,000,000 operations. That is a 5,000x gap, and it grows linearly: double the graph, double the gap.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network reliability analysis is the most direct application. Backbone operators compute articulation points and bridges across their router topology. Any articulation-point router is flagged for a redundant link installation. OSPF and IS-IS routing protocols use topology databases that make this computation straightforward to piggyback on existing data.',
        'Power grid planning uses the same structure. Substations and transmission lines form a graph. A substation that is an articulation point needs either a backup connection or a load-shedding contingency plan, because its failure islands a portion of customers from the generation source.',
        'Social network analysis identifies individuals who bridge otherwise disconnected communities. Removing an articulation-point person fragments the social graph. Community detection algorithms use bridge-finding to split graphs along their natural fault lines, since bridges mark the weakest connections between dense clusters.',
        'Biconnected component decomposition is a direct extension. The algorithm partitions the graph into maximal subgraphs where no single vertex removal causes a disconnect. Each articulation point sits at the boundary between two or more biconnected components. The block-cut tree built from this decomposition compresses the entire connectivity structure into a tree where each internal node is an articulation point and each leaf is a biconnected component.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The algorithm handles only single failures. It finds nodes and edges whose individual removal disconnects the graph, but says nothing about what happens when two things fail simultaneously. For k-vertex-connectivity (surviving any k-1 simultaneous vertex removals), you need max-flow-based algorithms that cost O(kV(V + E)) time. The theory and implementation are substantially harder.',
        'It works only on static graphs. If edges are inserted or deleted over time, each change can invalidate the entire disc/low labeling. Recomputing from scratch costs O(V + E) per update. Incremental algorithms exist (Westbrook and Tarjan, 1992, for edge insertions) but they are complex and rarely implemented in practice. Most real systems batch changes and rerun the full algorithm periodically.',
        'Directed graphs break the key invariant. In a directed graph, DFS produces cross edges and forward edges in addition to tree and back edges, so "every non-tree edge is a back edge" no longer holds. Finding strong bridges and strong articulation points in directed graphs requires different algorithms. Dominator trees handle the directed reachability questions.',
        'The algorithm is unweighted. It treats every edge as equally important. If edges have capacities or costs, identifying the cheapest set of edges to remove (the minimum cut) requires max-flow/min-cut. Bridges are the special case where the minimum cut has exactly one edge.',
        'Multigraphs (graphs with parallel edges between the same pair of nodes) need special handling. If nodes u and v share two parallel edges, removing one does not disconnect them. The algorithm must track edge identity, not just neighbor identity, when determining whether an edge to the parent is "the" tree edge or a second edge that counts as a back edge.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a graph with 7 nodes {A, B, C, D, E, F, G} and 9 edges. Nodes A-B-C form a triangle. Nodes D-E-F form a triangle, with additional edges D-G and F-G. The two triangles connect through a single edge B-D. Intuitively, B and D should be articulation points (they are the only path between the two halves), and B-D should be a bridge (it is the lone edge between the two halves).',
        'DFS starts at A. Timer = 1: disc[A] = 1, low[A] = 1. Tree edge A-B: timer = 2, disc[B] = 2, low[B] = 2, parent[B] = A. From B, neighbor A is the parent, so skip it. Tree edge B-C: timer = 3, disc[C] = 3, low[C] = 3, parent[C] = B.',
        'From C, neighbor A is visited and is not C\'s parent (C\'s parent is B). Back edge C-A: low[C] = min(3, disc[A]) = min(3, 1) = 1. This back edge proves C can reach A without going through B. Neighbor B is the parent, so skip. DFS returns from C to B: low[B] = min(2, low[C]) = min(2, 1) = 1. Check: low[C] = 1 < disc[B] = 2, so edge B-C is not a bridge. Also low[C] = 1 < disc[B] = 2, so B is not an articulation point because of this child (C\'s subtree escapes above B).',
        'Tree edge B-D: timer = 4, disc[D] = 4, low[D] = 4, parent[D] = B. From D, neighbor B is the parent, skip. Tree edge D-E: timer = 5, disc[E] = 5, low[E] = 5. Tree edge E-F: timer = 6, disc[F] = 6, low[F] = 6. From F, neighbor E is the parent, skip. Back edge F-D: low[F] = min(6, disc[D]) = min(6, 4) = 4. Tree edge F-G: timer = 7, disc[G] = 7, low[G] = 7. Back edge G-D: low[G] = min(7, disc[D]) = min(7, 4) = 4.',
        'Return G to F: low[F] = min(4, low[G]) = min(4, 4) = 4. Check: low[G] = 4 < disc[F] = 6, so F is not a cut vertex and F-G is not a bridge. Return F to E: low[E] = min(5, low[F]) = min(5, 4) = 4. Check: low[F] = 4 < disc[E] = 5, so E is not a cut vertex and E-F is not a bridge.',
        'Return E to D: low[D] = min(4, low[E]) = min(4, 4) = 4. Check: low[E] = 4 >= disc[D] = 4, and D is not the root, so D is an articulation point. The subtree rooted at E has back edges reaching D (discovery time 4) but nothing above D. Removing D strands {E, F, G}. Since low[E] = disc[D] (equal, not strictly greater), edge D-E is not a bridge: E\'s subtree can reach D through the back edge F-D.',
        'Return D to B: low[B] = min(1, low[D]) = min(1, 4) = 1. Check: low[D] = 4 > disc[B] = 2, so edge B-D is a bridge. D\'s entire subtree has no back edge reaching B or anything above B. Also low[D] = 4 >= disc[B] = 2 and B is not the root, so B is an articulation point. Return B to A: low[A] = min(1, low[B]) = min(1, 1) = 1. A is the root and has exactly one DFS-tree child (B), so A is not an articulation point. Final result: articulation points {B, D}, bridge {B-D}. Found in one DFS pass, O(V + E).',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original source is Tarjan, R.E. (1972), "Depth-First Search and Linear Graph Algorithms," SIAM Journal on Computing, 1(2):146-160. This paper introduced disc/low values and used them to find articulation points, bridges, and strongly connected components in a unified DFS framework. Hopcroft and Tarjan (1973), "Algorithm 447: Efficient Algorithms for Graph Manipulation," Communications of the ACM, refined the implementation. CLRS Chapter 22 covers DFS edge classification and includes exercises on articulation points.',
        'Before studying this topic, make sure you are comfortable with depth-first search (the disc values and stack behavior are the foundation) and basic graph connectivity (BFS to check whether a graph is connected). The DFS tree structure and the distinction between tree edges and back edges is essential prerequisite knowledge.',
        'After mastering articulation points and bridges, study biconnected components (maximal subgraphs where no single vertex removal disconnects them, with articulation points as the separators), 2-edge-connected components (the same idea but partitioned by bridges), and the block-cut tree (which compresses the entire biconnected component structure into a tree). These all build directly on the disc/low framework.',
        'For contrast, look at strongly connected components in directed graphs (Tarjan\'s SCC algorithm uses the same disc/low machinery but accounts for edge direction), max-flow/min-cut (for finding minimum cuts of size greater than 1, where bridges are the special case of min-cut = 1), and dynamic connectivity data structures like Euler tour trees and link-cut trees (for maintaining connectivity under real-time edge insertions and deletions).',
      ],
    },
  ],
};
