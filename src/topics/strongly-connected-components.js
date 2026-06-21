// Strongly connected components via Tarjan's algorithm: a single DFS pass
// with disc/low-link values identifies maximal groups of mutually reachable
// vertices in a directed graph.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'strongly-connected-components',
  title: 'Strongly Connected Components',
  category: 'Data Structures',
  summary: 'Find maximal groups of mutually reachable vertices in a directed graph with one DFS pass — disc and low-link values do all the work.',
  controls: [],
  run,
};

// An 8-node directed graph with 3 SCCs:
//   SCC1: {A, B, C}  (A->B->C->A)
//   SCC2: {D, E, F}  (D->E->F->D)
//   SCC3: {G, H}     (G->H->G)
// Cross-SCC edges: C->D, F->G  (making the condensation DAG: SCC1 -> SCC2 -> SCC3)
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 3.0 },
  { id: 'B', label: 'B', x: 2.6, y: 5.5 },
  { id: 'C', label: 'C', x: 2.6, y: 0.5 },
  { id: 'D', label: 'D', x: 4.6, y: 3.0 },
  { id: 'E', label: 'E', x: 6.2, y: 5.5 },
  { id: 'F', label: 'F', x: 6.2, y: 0.5 },
  { id: 'G', label: 'G', x: 8.2, y: 4.2 },
  { id: 'H', label: 'H', x: 8.2, y: 1.8 },
];

// Directed edges
const EDGES = [
  // SCC1 cycle: A -> B -> C -> A
  { id: 'AB', from: 'A', to: 'B' },
  { id: 'BC', from: 'B', to: 'C' },
  { id: 'CA', from: 'C', to: 'A' },
  // Cross-SCC: SCC1 -> SCC2
  { id: 'CD', from: 'C', to: 'D' },
  // SCC2 cycle: D -> E -> F -> D
  { id: 'DE', from: 'D', to: 'E' },
  { id: 'EF', from: 'E', to: 'F' },
  { id: 'FD', from: 'F', to: 'D' },
  // Cross-SCC: SCC2 -> SCC3
  { id: 'FG', from: 'F', to: 'G' },
  // SCC3 cycle: G -> H -> G
  { id: 'GH', from: 'G', to: 'H' },
  { id: 'HG', from: 'H', to: 'G' },
];

const adj = new Map(NODES.map((n) => [n.id, []]));
for (const e of EDGES) adj.get(e.from).push(e.to);

export function* run() {
  const disc = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];        // list of SCC arrays
  const sccOf = new Map(); // node -> SCC index
  let timer = 0;

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: disc.has(n.id)
        ? `d=${disc.get(n.id)} l=${low.get(n.id)}`
        : '',
    })),
    edges: EDGES,
  });

  const sccColors = (found) => {
    const result = [];
    for (const scc of found) result.push(...scc);
    return result;
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'An 8-node directed graph. Three groups of nodes can reach each other through directed paths: {A, B, C}, {D, E, F}, and {G, H}. These are the strongly connected components. Tarjan algorithm finds all of them in a single DFS pass using two values per node: disc (discovery time) and low (the lowest disc reachable via back edges and subtree links).',
  };

  // Tarjan's SCC algorithm — iterative DFS to avoid stack overflow on large graphs.
  // We simulate recursion with an explicit frame stack.
  for (const startNode of NODES) {
    if (disc.has(startNode.id)) continue;

    // Iterative DFS frame: { node, neighborIndex }
    const dfsStack = [{ node: startNode.id, ni: 0 }];
    timer++;
    disc.set(startNode.id, timer);
    low.set(startNode.id, timer);
    stack.push(startNode.id);
    onStack.add(startNode.id);

    yield {
      state: snapshot(),
      highlight: { active: [startNode.id] },
      explanation: `Start DFS from ${startNode.id}. Set disc[${startNode.id}] = ${timer}, low[${startNode.id}] = ${timer}. Push ${startNode.id} onto the SCC stack. The stack holds all vertices in the current DFS path that might belong to the same SCC. Stack: [${stack.join(', ')}].`,
    };

    while (dfsStack.length > 0) {
      const frame = dfsStack[dfsStack.length - 1];
      const u = frame.node;
      const neighbors = adj.get(u);

      if (frame.ni < neighbors.length) {
        const v = neighbors[frame.ni];
        frame.ni++;

        if (!disc.has(v)) {
          // Tree edge — discover v
          timer++;
          disc.set(v, timer);
          low.set(v, timer);
          stack.push(v);
          onStack.add(v);
          dfsStack.push({ node: v, ni: 0 });

          const edge = EDGES.find((e) => e.from === u && e.to === v);
          yield {
            state: snapshot(),
            highlight: {
              active: [v],
              compare: edge ? [edge.id] : [],
              found: sccColors(sccs),
              visited: stack.filter((s) => s !== v),
            },
            explanation: `Tree edge ${u} -> ${v}. Discover ${v}: disc[${v}] = ${timer}, low[${v}] = ${timer}. Push ${v} onto the SCC stack. Stack: [${stack.join(', ')}].`,
          };
        } else if (onStack.has(v)) {
          // Back edge — v is an ancestor in the current DFS path
          const oldLow = low.get(u);
          low.set(u, Math.min(low.get(u), disc.get(v)));
          const edge = EDGES.find((e) => e.from === u && e.to === v);
          yield {
            state: snapshot(),
            highlight: {
              active: [u],
              compare: edge ? [edge.id] : [],
              swap: [v],
              found: sccColors(sccs),
              visited: stack.filter((s) => s !== u),
            },
            explanation: `Back edge ${u} -> ${v}. Node ${v} is on the SCC stack (disc[${v}] = ${disc.get(v)}), so ${u} can reach an ancestor. Update low[${u}] = min(${oldLow}, disc[${v}]) = ${low.get(u)}. This back edge proves ${u} and ${v} are in the same SCC.`,
          };
        } else {
          // Cross edge to an already-finished SCC — ignore
          const edge = EDGES.find((e) => e.from === u && e.to === v);
          yield {
            state: snapshot(),
            highlight: {
              active: [u],
              compare: edge ? [edge.id] : [],
              found: sccColors(sccs),
              visited: stack,
            },
            explanation: `Cross edge ${u} -> ${v}. Node ${v} is already assigned to a finished SCC, so this edge does not connect ${u} to anything still open. Ignore it.`,
          };
        }
      } else {
        // All neighbors of u processed — check if u is an SCC root
        dfsStack.pop();

        // Propagate low value to parent
        if (dfsStack.length > 0) {
          const parent = dfsStack[dfsStack.length - 1].node;
          const oldLow = low.get(parent);
          low.set(parent, Math.min(low.get(parent), low.get(u)));
          if (low.get(parent) < oldLow) {
            yield {
              state: snapshot(),
              highlight: {
                active: [parent],
                compare: [u],
                found: sccColors(sccs),
                visited: stack.filter((s) => s !== parent),
              },
              explanation: `Return from ${u} to ${parent}. Propagate: low[${parent}] = min(${oldLow}, low[${u}]) = min(${oldLow}, ${low.get(u)}) = ${low.get(parent)}. The reachability discovered by ${u} now flows up to its parent.`,
            };
          }
        }

        // If disc[u] === low[u], u is the root of its SCC
        if (disc.get(u) === low.get(u)) {
          const scc = [];
          let w;
          do {
            w = stack.pop();
            onStack.delete(w);
            scc.push(w);
            sccOf.set(w, sccs.length);
          } while (w !== u);
          sccs.push(scc);

          yield {
            state: snapshot(),
            highlight: {
              found: sccColors(sccs),
              active: scc,
              visited: stack,
            },
            explanation: `disc[${u}] = low[${u}] = ${disc.get(u)}, so ${u} is the root of an SCC. Pop the SCC stack until ${u} is removed: {${scc.join(', ')}}. This is SCC #${sccs.length}. Every node in this group can reach every other node through directed paths within the group.`,
          };
        }
      }
    }
  }

  // Final summary
  yield {
    state: snapshot(),
    highlight: { found: sccColors(sccs) },
    explanation: `Tarjan's algorithm found ${sccs.length} strongly connected components in one DFS pass: ${sccs.map((scc, i) => `SCC${i + 1} = {${scc.join(', ')}}`).join(', ')}. The condensation DAG (collapsing each SCC to a single node) has edges SCC1 -> SCC2 -> SCC3 and is guaranteed to be acyclic. Total work: O(V + E) — each vertex and edge examined exactly once.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each node shows two numbers once DFS reaches it: d (discovery time) and l (low-link). Discovery time is when the node was first visited. Low-link is the smallest discovery time the node can reach by following edges downward through the DFS tree and then taking one back edge upward to an ancestor.',
        {type: 'callout', text: 'Tarjan works because low-link turns cycle discovery into one local test: if no child can reach above a node, that node closes a component.'},
        'The active node (highlighted) is where DFS is currently working. Visited nodes sitting on the SCC stack are candidates for the current component. When a back edge lands on a node still on the stack, that target gets a swap highlight — the edge proves those nodes share a cycle.',
        'The critical moment: when a node finishes processing all its neighbors and its low-link still equals its own discovery time, no descendant found a path back above it. That node is the root of its SCC. The algorithm pops every node above it off the stack, and they all light up as found — one complete strongly connected component. Watch the low-link values ripple upward as DFS returns from subtrees: that propagation is the algorithm learning which nodes share cycles.',
      
        {type: 'image', src: './assets/gifs/strongly-connected-components.gif', alt: 'Animated walkthrough of the strongly connected components visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A directed graph may contain groups of vertices where every vertex can reach every other vertex through directed paths. These maximal mutually-reachable groups are strongly connected components. Decomposing a graph into its SCCs reveals its deep structure: which parts form cycles, which parts are one-way pipelines, and how everything connects in a hierarchy.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Strong connectivity is a directed-graph property: edge direction decides which cycles form components and which edges become one-way links in the condensation DAG. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Robert Tarjan published a single-pass linear-time algorithm for this decomposition in 1972. The problem matters everywhere directed dependencies appear. Compilers decompose call graphs into SCCs to optimize mutually recursive functions together. 2-SAT solvers build an implication graph and check whether any variable and its negation land in the same SCC — if so, the formula is unsatisfiable. Database lock managers detect deadlocks by finding SCCs of size two or more in wait-for graphs. Collapsing each SCC to a single super-node yields a DAG, which unlocks topological sorting and shortest-path algorithms on graphs that originally had cycles.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For each vertex u, run a full DFS or BFS to find every vertex u can reach. Then for each pair (u, v), check both directions: does u reach v and does v reach u? If yes, they belong to the same SCC.',
        'This works. For small graphs it is practical. The cost is O(V * (V + E)) — one traversal per vertex, each scanning all vertices and edges. A graph with 1,000 vertices and 5,000 edges costs about 6 million operations. Not elegant, but tolerable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Scale kills it. A web graph with a billion pages and ten billion links requires a billion traversals of a ten-billion-edge graph: roughly 10^19 operations. At a billion operations per second, that takes 300 years.',
        'The waste is redundancy. If A reaches B reaches C reaches A, three separate traversals each rediscover the same cycle independently. The algorithm keeps re-learning facts it already knows. What is needed is a way to discover every SCC in one pass, recognizing cycles as the DFS encounters them rather than verifying them pair by pair after the fact.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Tarjan observed that a single DFS already contains all the information needed to identify SCCs. The key is tracking, for each node, the earliest ancestor it can reach through back edges. If the earliest reachable ancestor of a node is itself, then nothing in its subtree connects back above it — that subtree is a self-contained cycle, an SCC.',
        'Two values per node make this work. disc[v] is the DFS discovery timestamp — when v was first visited. low[v] is the minimum discovery time reachable from the subtree rooted at v via back edges. A separate stack holds all nodes that have been discovered but not yet assigned to a finished SCC. When DFS finishes v and finds disc[v] = low[v], every node on the stack above v was discovered inside the subtree rooted at v and cannot escape above v. Pop them all: that group is the SCC.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start a global timer at 0. For each unvisited vertex v, begin DFS. On entry: increment the timer, set disc[v] = low[v] = timer, push v onto the SCC stack.',
        'For each neighbor w of v: if w is unvisited, recurse into w, then set low[v] = min(low[v], low[w]) — whatever ancestor w can reach, v can reach through w. If w is on the SCC stack (visited but not yet assigned to a finished SCC), set low[v] = min(low[v], disc[w]) — the edge from v to w is a back edge to an open ancestor. If w belongs to an already-finished SCC, ignore the edge entirely — it leads to a closed component.',
        'When all neighbors of v are processed: if disc[v] = low[v], then v is an SCC root. Pop the SCC stack until v is removed. Every popped node belongs to this SCC. Mark them as finished.',
        'Kosaraju algorithm (1978) takes a different path. First pass: run DFS on the original graph, recording vertices by finish time. Second pass: reverse every edge, then run DFS in reverse finish order. Each DFS tree in the second pass is exactly one SCC. The two-pass version is easier to reason about — it reduces the problem to two textbook DFS passes — but it traverses the graph twice and needs the transposed graph in memory.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Consider the moment disc[v] = low[v]. No node in the subtree rooted at v found a back edge to any ancestor above v. Every node on the SCC stack above v was pushed during exploration below v, so they were all discovered after v. Since none of them can escape above v, the only cycles they participate in are cycles that pass through v or stay below v. Popping them gives a maximal mutually-reachable group.',
        'If v could reach an ancestor discovered earlier, then low[v] < disc[v], and the algorithm would not trigger — it would wait for the real root higher up. This is how maximality is guaranteed: the algorithm never emits an SCC prematurely, and it never merges two separate SCCs.',
        'Kosaraju correctness relies on finish-order structure. In the first DFS, the SCC whose vertices finish last has no incoming cross-SCC edges — it is a source in the condensation DAG. In the transposed graph, that source becomes a sink with no outgoing cross-SCC edges. Processing in reverse finish order means each second-pass DFS is trapped inside exactly one SCC, unable to leak into adjacent components because the escape edges now point inward.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Both algorithms run in O(V + E) time. Every vertex is discovered once, pushed onto the SCC stack once, and popped once. Every edge is examined once during neighbor scanning. Auxiliary space is O(V) for the disc array, low array, SCC stack, and on-stack membership set.',
        'Doubling the vertices doubles the per-vertex bookkeeping. Doubling the edges doubles the neighbor-scanning work. On sparse graphs (E proportional to V), total cost tracks graph size linearly. On dense graphs (E near V^2), edge scanning dominates but stays linear in E.',
        'Concrete comparison: a graph with 100,000 vertices and 500,000 edges. Tarjan algorithm examines about 600,000 items total. The naive per-vertex-reachability approach performs roughly 60 billion operations — a 100,000x difference.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Compiler optimization: mutually recursive functions form an SCC in the call graph. The compiler must analyze them as a unit because inlining one may unlock constant folding in another. Both GCC and LLVM compute call-graph SCCs before interprocedural optimization.',
        '2-SAT: each boolean variable x produces two nodes (x and not-x) in an implication graph. Directed edges encode "if x then y." The formula is satisfiable exactly when no variable shares an SCC with its own negation. Tarjan algorithm solves 2-SAT in O(V + E).',
        'Deadlock detection: in a wait-for graph, processes are vertices and "process A waits for process B" is a directed edge. Any SCC of size two or more is a deadlock — a set of processes in mutual wait. Database lock managers run SCC detection to identify and break these cycles.',
        'Web structure: Broder et al. (2000) decomposed a billion-page web crawl into SCCs and found the "bow-tie" structure — a giant SCC containing about 28% of pages, an IN set that reaches the giant SCC but not vice versa, and an OUT set reachable from the giant SCC but unable to reach back.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected network nodes', caption: 'Large link graphs make the SCC payoff concrete: cycles, one-way regions, and giant connected cores become visible only after decomposition. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Internet_map_1024.jpg.'},
        'Condensation: collapsing each SCC to a single node yields a DAG. This condensation graph can be topologically sorted, enabling shortest-path, scheduling, and dependency-resolution algorithms to work on graphs that originally contained cycles.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Undirected graphs: the concept does not apply. In an undirected graph, every connected component is trivially strongly connected because each edge works in both directions. The analogous question for undirected graphs is biconnected components — subgraphs that stay connected after removing any single vertex — found by Tarjan bridge-finding algorithm, a related but distinct technique.',
        'Dynamic graphs: adding or removing an edge can change the SCC structure. Rerunning Tarjan algorithm from scratch costs O(V + E) per update. Incremental SCC algorithms exist (Bender, Fineman, and Gilbert, 2015) but are complex and carry high constant factors. Most systems recompute periodically instead.',
        'Parallelism: Tarjan algorithm depends on a global DFS order, which is inherently sequential. Parallel SCC decomposition (Fleischer et al., 2000) uses forward-backward reachability queries instead of DFS, trading the single-pass elegance for the ability to split work across processors. On distributed graphs with billions of nodes, these parallel algorithms are necessary.',
        'Memory at extreme scale: the disc, low, and stack arrays require O(V) space. For a billion-node graph, that is several gigabytes of auxiliary storage on top of the graph itself.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: 8 nodes, 10 directed edges. Three cycles — A->B->C->A, D->E->F->D, G->H->G — connected by cross-SCC edges C->D and F->G. Expected SCCs: {A,B,C}, {D,E,F}, {G,H}.',
        'DFS starts at A. disc[A]=1, low[A]=1, push A. Stack: [A]. Recurse to B: disc[B]=2, low[B]=2, push B. Stack: [A,B]. Recurse to C: disc[C]=3, low[C]=3, push C. Stack: [A,B,C].',
        'C examines neighbor A. A is on the stack, so this is a back edge: low[C] = min(3, disc[A]) = 1. C can reach all the way back to A — proof of a cycle. C examines neighbor D. D is unvisited: disc[D]=4, low[D]=4, push D. Stack: [A,B,C,D].',
        'DFS continues: D->E (disc[E]=5), E->F (disc[F]=6). Stack grows to [A,B,C,D,E,F]. F examines neighbor D: D is on the stack, so low[F] = min(6, 4) = 4. F examines neighbor G: unvisited, disc[G]=7. Stack: [A,B,C,D,E,F,G].',
        'G->H: disc[H]=8. H examines neighbor G: on the stack, so low[H] = min(8, 7) = 7. H is done. Return to G: low[G] = min(7, low[H]) = min(7, 7) = 7. Now disc[G] = low[G] = 7 — G is an SCC root. Pop H and G off the stack. SCC #1 = {H, G}.',
        'Return to F. low[F] stays 4 (low[G] was 7, higher than 4). Return to E: low[E] = min(5, 4) = 4. Return to D: low[D] = min(4, 4) = 4. disc[D] = low[D] = 4 — D is an SCC root. Pop F, E, D. SCC #2 = {F, E, D}.',
        'Return to C. low[C] stays 1. Return to B: low[B] = min(2, 1) = 1. Return to A: low[A] = min(1, 1) = 1. disc[A] = low[A] = 1 — A is an SCC root. Pop C, B, A. SCC #3 = {C, B, A}.',
        'Three SCCs found in one DFS pass. Total work: 8 vertex discoveries, 10 edge examinations, 8 stack pushes, 8 stack pops. The condensation DAG is SCC1 -> SCC2 -> SCC3 — acyclic, as guaranteed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Tarjan, R.E. (1972), "Depth-First Search and Linear Graph Algorithms," SIAM Journal on Computing — the original disc/low-link algorithm. Kosaraju algorithm (S. Rao Kosaraju, 1978; published by Sharir, 1981) — the two-pass DFS alternative. Cormen, Leiserson, Rivest, and Stein (CLRS), Chapter 22 — textbook proofs of both algorithms. Broder et al. (2000), "Graph structure in the web" — SCC decomposition applied to a billion-page crawl.',
        'Prerequisites: graph DFS (discovery/finish timestamps and back-edge classification are the foundation Tarjan algorithm builds on), topological sort (the condensation DAG produced by SCC decomposition is the input to topological sorting).',
        'Natural extensions: articulation points and bridges (the same disc/low machinery applied to undirected graphs finds vertices and edges whose removal disconnects the graph), 2-SAT (SCC on an implication graph yields a linear-time satisfiability algorithm).',
        'Contrasting alternatives: for undirected connectivity, Union-Find or simple BFS/DFS connected components suffice — SCC is strictly a directed-graph concept. For biconnected components in undirected graphs, use Tarjan bridge-finding variant.',
      ],
    },
  ],
};
