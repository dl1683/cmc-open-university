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
        'The graph is drawn with labeled nodes and undirected edges. DFS explores from a start node, and each visited node displays two numbers: d (discovery time, when DFS first reached it) and l (low-link, the earliest discovery time reachable from that node\'s subtree through back edges). These two numbers are the entire algorithm.',
        'Highlighted nodes are under active processing. Visited nodes are discovered but not currently expanding. When the algorithm finds a back edge, its target flashes to show that the current node has a shortcut to an ancestor. Articulation points glow as "found" once confirmed. Bridge edges are marked separately.',
        'The key inference: when DFS returns from child u to parent v, compare low[u] against disc[v]. If low[u] >= disc[v], no back edge from u\'s subtree escapes past v, so v is an articulation point. If the inequality is strict (low[u] > disc[v]), the tree edge v-u is a bridge. Watch the low values ripple upward as DFS unwinds.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every network has failure modes. A router dies, a cable is cut, a server crashes. Some failures are survivable: traffic reroutes and nobody notices. Others split the network in two. An articulation point (cut vertex) is a node whose removal disconnects the graph. A bridge (cut edge) is an edge whose removal does the same. Together, they map every single point of failure in the network.',
        'This matters anywhere connectivity matters. Internet backbone operators need to know which routers, if lost, partition the network. Power grid engineers need to know which substation failures island customers. Social scientists study which individuals hold communities together. Circuit designers need to verify that no signal path depends on a single irreplaceable trace. The question is always the same: where is redundancy missing?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Test each vertex by deleting it. Remove vertex v from the graph, run BFS or DFS on what remains, and count connected components. If the count increased, v is an articulation point. Do the same for every edge to find bridges.',
        'Each connectivity check costs O(V + E). There are V vertices and E edges to test. Total: O(V(V + E)) for articulation points, O(E(V + E)) for bridges. On a 100-node, 300-edge graph, that is about 4 million operations. Perfectly fine for homework.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Real networks are not homework-sized. An internet backbone graph has millions of routers and tens of millions of links. The brute-force approach runs millions of separate connectivity checks, each touching tens of millions of edges. The operation count hits 10^14 and the computation takes days for a result that is stale before it finishes.',
        'The waste is structural. When the brute-force method checks vertex A and finds the graph stays connected, it learns something about the alternate paths around A. Then it throws all of that away and starts fresh for vertex B. Every check rediscovers information the previous check already had. A single traversal that accumulates reachability information as it goes should be enough.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'DFS on an undirected graph classifies every edge as either a tree edge (to an unvisited vertex) or a back edge (to an already-visited ancestor). No other type exists: an edge to an already-visited non-ancestor would have been traversed when that non-ancestor was on the stack. This classification is the foundation.',
        'Back edges are bypass routes. A back edge from descendant d up to ancestor a proves there is a path from a to d that avoids the tree edges between them. So the question "can u\'s subtree survive without parent v?" reduces to "does any back edge from u\'s subtree reach above v?" If yes, the subtree has an escape route and v is safe to remove. If no, removing v strands the subtree.',
        'The low value captures this in one number. low[v] is the minimum discovery time reachable from v\'s subtree via back edges. If low[child] >= disc[parent], every back edge from the child\'s subtree lands on or below the parent. None escapes above, so the parent is an articulation point. If low[child] > disc[parent], the subtree cannot even reach the parent through a back edge, so the tree edge between them is the only connection: a bridge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Keep a global timer starting at 0. For each unvisited vertex v, run DFS. On entry: increment the timer, set disc[v] = low[v] = timer, record parent[v].',
        'For each neighbor w of v: (1) if w is unvisited, descend (tree edge). After returning, set low[v] = min(low[v], low[w]) because whatever w\'s subtree can reach, v can reach through w. (2) If w is visited and w is not v\'s parent, it is a back edge. Set low[v] = min(low[v], disc[w]). The edge to w gives v a shortcut to an ancestor. (3) If w is v\'s parent, skip. That is the tree edge we arrived on.',
        'On return from child u to parent v, run two checks. Bridge: if low[u] > disc[v], no back edge from u\'s subtree reaches v or above, so the edge v-u is a bridge. Articulation point (non-root): if low[u] >= disc[v], u\'s subtree has no escape past v, so v is an articulation point. The >= versus > distinction matters: when low[u] equals disc[v], a back edge reaches v itself, but removing v still kills that connection, so v is a cut vertex. But the edge v-u is not a bridge because the subtree can reach v through the back edge and then through other edges from v.',
        'Root case: the root has no parent, so the low test does not apply. A root is an articulation point if and only if it has two or more children in the DFS tree. One child means removal just promotes the child to root. Two children means they were connected only through the root, so removing it splits them.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every alternate path in an undirected graph, when viewed through the DFS tree, consists of tree edges plus back edges. There are no cross edges. So the only way for u\'s subtree to reach a vertex above v without going through v is a back edge from somewhere in u\'s subtree to some ancestor above v, meaning a vertex with discovery time less than disc[v].',
        'low[u] records the minimum such discovery time across all back edges in u\'s subtree. If low[u] >= disc[v], every back edge lands on v or below. No path from u\'s subtree to the rest of the graph avoids v. Remove v and u\'s subtree is disconnected. That is the articulation point condition.',
        'For bridges: if low[u] > disc[v], the subtree cannot reach even v through a back edge. The tree edge v-u is the sole connection. Remove it and u\'s subtree is isolated.',
        'For the root: each DFS-tree child of the root represents a separate connected component among the root\'s neighbors (if they were connected without the root, DFS would have found the second child through the first). Two or more children means removal of the root splits them apart.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(V + E). One DFS pass visits each vertex once and examines each edge twice (once from each endpoint in the adjacency list). The low-value updates and articulation/bridge checks are constant-time per edge.',
        'Space: O(V) for the disc, low, and parent arrays, plus the DFS stack (O(V) in the worst case for a path graph).',
        'Doubling the vertices doubles the discovery work. Doubling the edges doubles the neighbor-scanning work. On a graph with 10,000 nodes and 50,000 edges, Tarjan\'s algorithm does roughly 60,000 operations. The brute-force approach does about 600 million. That is a 10,000x gap, and it widens linearly with graph size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network reliability: backbone operators flag articulation-point routers and bridge links. An articulation-point router gets a redundant path added. OSPF and IS-IS routing protocols use topology analysis to detect single points of failure before they cause outages.',
        'Power grids: substations and transmission lines form a graph. An articulation-point substation needs backup connections or load-shedding plans because its failure islands part of the grid.',
        'Social networks: articulation points are people who bridge otherwise disconnected communities. Removing them fragments the network. Community detection algorithms use bridge-finding to split graphs along their natural seams.',
        'Circuit design: a bridge in a circuit graph is a trace with no backup path. In reliability-critical domains (aerospace, medical devices), every bridge must be eliminated or backed up with a redundant connection.',
        'Biconnected component decomposition: the algorithm naturally partitions the graph into maximal subgraphs where no single vertex removal disconnects them. Each articulation point sits at the boundary between components. The block-cut tree built from this decomposition compresses the entire connectivity structure of the graph into a tree.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Single-failure only: this algorithm finds vertices and edges whose individual removal disconnects the graph. It says nothing about pairs of failures. For k-vertex-connectivity (surviving any k-1 simultaneous vertex removals), you need more sophisticated algorithms: k-connectivity certification requires O(kV(V + E)) time via max-flow, and the theory is substantially harder.',
        'Static graphs only: if edges are added or deleted over time, each change potentially invalidates the disc/low labeling. Rerunning from scratch costs O(V + E) per update. Incremental algorithms exist (Westbrook and Tarjan, 1992) but are complex. Most practical systems batch changes and recompute periodically.',
        'Undirected only: directed graphs have cross edges and forward edges that break the "every non-tree edge is a back edge" property. For directed graphs, finding strong bridges and strong articulation points requires different algorithms. Dominator trees handle reachability questions in directed graphs.',
        'Unweighted only: the algorithm treats all edges as equal. If edges have capacities, finding the minimum set of edges to remove (minimum cut) requires max-flow/min-cut. Bridges are the special case where the min-cut has size 1.',
        'Multigraphs need care: if two vertices share parallel edges, removing one does not disconnect them. The algorithm must track edge identity, not just neighbor identity, to avoid reporting false bridges.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: 7 nodes {A, B, C, D, E, F, G}, 9 edges. Two triangles (A-B-C and D-E-F) plus edges D-G and F-G, connected by a single edge B-D. Expected: articulation points B and D, bridge B-D.',
        'Start DFS at A. disc[A]=1, low[A]=1. Tree edge to B: disc[B]=2, low[B]=2. From B, skip parent A. Tree edge to C: disc[C]=3, low[C]=3.',
        'From C, find back edge C-A (A is visited, not C\'s parent). low[C] = min(3, disc[A]) = 1. The back edge C-A proves C can reach A without going through B. Skip parent B. Return to B: low[B] = min(2, low[C]) = min(2, 1) = 1. Since low[C]=1 < disc[B]=2, edge B-C is not a bridge and B is not an articulation point due to child C.',
        'Tree edge B-D: disc[D]=4, low[D]=4. From D, skip parent B. Tree edge D-E: disc[E]=5, low[E]=5. Tree edge E-F: disc[F]=6, low[F]=6. From F, skip parent E. Back edge F-D: low[F] = min(6, disc[D]) = 4. Tree edge F-G: disc[G]=7, low[G]=7. Back edge G-D: low[G] = min(7, disc[D]) = 4. Return G to F: low[F] = min(4, 4) = 4. low[G]=4 < disc[F]=6, so F is not a cut vertex and F-G is not a bridge.',
        'Return F to E: low[E] = min(5, 4) = 4. low[F]=4 < disc[E]=5, so E is not a cut vertex and E-F is not a bridge. Return E to D: low[D] = min(4, 4) = 4. low[E]=4 = disc[D]=4. Since low[E] >= disc[D] and D is not the root, D is an articulation point. Since low[E] = disc[D] (not strictly greater), edge D-E is not a bridge: E\'s subtree can reach D through back edges, just not above D.',
        'Return D to B: low[B] = min(1, 4) = 1. low[D]=4 > disc[B]=2, so edge B-D is a bridge: D\'s subtree has no back edge reaching B or above. Also low[D]=4 >= disc[B]=2 and B is not the root, so B is an articulation point.',
        'Return B to A: low[A] = min(1, 1) = 1. A is the root with one DFS-tree child (B), so A is not an articulation point. Final result: articulation points {B, D}, bridge {B-D}. One pass, O(V+E).',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Tarjan, R.E. (1972), "Depth-First Search and Linear Graph Algorithms," SIAM Journal on Computing. This paper introduced articulation points, bridges, and strongly connected components, all via disc/low values in a single DFS framework. Hopcroft and Tarjan (1973), "Algorithm 447: Efficient Algorithms for Graph Manipulation," refined the implementation. CLRS Chapter 22 covers DFS edge classification and has exercises on articulation points.',
        'Prerequisites: DFS (discovery times and edge classification are the foundation) and BFS (for basic connectivity intuition).',
        'Natural extensions: biconnected components (partition the graph into maximal 2-vertex-connected subgraphs, with articulation points as separators), 2-edge-connected components (partition by bridges), block-cut tree (compresses the connectivity structure into a tree of biconnected components and cut vertices).',
        'Contrasting alternatives: strongly connected components (Tarjan\'s SCC uses the same disc/low machinery on directed graphs), max-flow/min-cut (for minimum cuts of size > 1), Euler tour trees and link-cut trees (for maintaining connectivity under dynamic edge insertions and deletions).',
      ],
    },
  ],
};
