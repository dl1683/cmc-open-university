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
        'Each vertex receives a discovery number when depth-first search first reaches it. Low-link is the smallest discovery number reachable from that vertex by following tree edges downward and then at most one back edge to a vertex still on the stack. The active highlight is the current DFS call, and stacked vertices are discovered but not assigned to a component yet.',
        {type: 'callout', text: 'Tarjan works because low-link turns cycle discovery into one local test: if no child can reach above a node, that node closes a component.'},
        'The safe inference appears when discovery equals low-link. At that moment, no descendant has found a path back above the current vertex. The algorithm pops vertices until it reaches that root, and the popped set is one strongly connected component.',
        {type: 'image', src: './assets/gifs/strongly-connected-components.gif', alt: 'Animated walkthrough of the strongly connected components visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A directed graph is a set of vertices connected by one-way edges. A strongly connected component, or SCC, is a maximal group where every vertex can reach every other vertex through directed paths. SCC decomposition turns a cyclic graph into components connected by one-way edges.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Strong connectivity is a directed-graph property: edge direction decides which cycles form components and which edges become one-way links in the condensation DAG. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'This exists because cycles change how systems behave. Mutually recursive functions must be analyzed together, wait-for cycles indicate deadlocks, and implication cycles decide parts of 2-SAT. Once each SCC is collapsed to one node, the remaining condensation graph is acyclic and can be processed in dependency order.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to test reachability from every vertex. For each vertex u, run DFS or BFS and record every vertex u can reach. Then put u and v in the same component if u reaches v and v reaches u.',
        'That method is correct and easy to explain. On a graph with 100 vertices and 500 edges, 100 traversals may be acceptable. It becomes wasteful because every traversal rediscovers the same cycles from a different starting point.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The cost is O(V * (V + E)), where V is vertex count and E is edge count. A graph with 100,000 vertices and 500,000 edges would do about 60 billion vertex-or-edge visits. The graph itself only contains 600,000 items, so the repeated traversal is the problem.',
        'The wall is recognizing mutual reachability without proving every pair separately. If A reaches B, B reaches C, and C reaches A, those facts should close the whole group once. A single DFS already sees the back edge that proves the cycle; the algorithm needs to remember that evidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Tarjan algorithm records the earliest open ancestor reachable from each DFS subtree. If a vertex can reach an ancestor still on the stack, its low-link drops to that ancestor discovery number. If no child or back edge can reach above the vertex, that vertex is the root of a complete SCC.',
        'The stack matters because finished components must not pull later vertices into old cycles. An edge to a vertex still on the stack is evidence for the current open search. An edge to a finished component is only a cross-component edge and does not lower low-link.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start a counter at zero and run DFS from every unvisited vertex. On entry to vertex v, set disc[v] and low[v] to the next counter value, then push v onto the SCC stack. The boolean onStack[v] records whether v belongs to an unfinished component.',
        'For each outgoing edge v to w, the algorithm handles three cases. If w is unvisited, DFS visits w and then low[v] may become low[w]. If w is already on the stack, low[v] may become disc[w]. If w has finished, the edge is ignored for low-link.',
        'After all neighbors finish, disc[v] equals low[v] exactly when v is an SCC root. The algorithm pops vertices until v is popped. Every popped vertex belongs to that component because it was discovered below v and could not reach above v.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that low[v] is the earliest discovery time reachable from v through the explored DFS subtree plus one back edge to an open vertex. DFS tree edges propagate low-link upward, and back edges to stack vertices provide the only evidence of a cycle still being explored. Finished vertices are excluded because their components are already closed.',
        'When disc[v] equals low[v], no open descendant can reach an ancestor of v. Every stack vertex above v was discovered during the exploration below v, so it cannot belong to an earlier component. Popping through v is therefore maximal and safe: nothing inside can escape upward, and nothing outside should be merged.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tarjan algorithm runs in O(V + E) time. Every vertex is discovered once, pushed once, and popped once; every directed edge is inspected once. If the edge count doubles, neighbor scanning doubles, but the algorithm does not start new global searches for each vertex.',
        'Auxiliary space is O(V) for discovery numbers, low-link values, stack membership, and the stack. Dense graphs still cost more because E can approach V squared, but the algorithm remains linear in the actual input size. The recursion stack can be a practical limit on very deep graphs unless the DFS is implemented iteratively.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Compilers use SCCs in call graphs because mutually recursive functions need fixed-point analysis as a group. 2-SAT solvers use SCCs in an implication graph: if a variable and its negation are in the same SCC, the formula is unsatisfiable. Database systems use SCCs in wait-for graphs to detect deadlock cycles.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected network nodes', caption: 'Large link graphs make the SCC payoff concrete: cycles, one-way regions, and giant connected cores become visible only after decomposition. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Internet_map_1024.jpg.'},
        'Large web and dependency graphs use SCC decomposition to reveal one-way structure. After each component is collapsed, the condensation graph is a DAG, which supports topological scheduling, reachability summaries, and staged processing. The method is useful whenever cycles are real structure rather than noise.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SCC is a directed-graph concept. In an undirected graph, ordinary connected components already give mutual reachability because every edge works both ways. For undirected resilience questions, articulation points and biconnected components are the related but different tools.',
        'Tarjan is also awkward for highly dynamic or distributed graphs. Adding one edge can merge many components, and deleting one edge can split a component. Parallel SCC algorithms exist, but they usually abandon the single DFS order and trade simplicity for reachability searches that split work across machines.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use eight vertices with edges A->B, B->C, C->A, C->D, D->E, E->F, F->D, F->G, G->H, and H->G. The expected SCCs are {A,B,C}, {D,E,F}, and {G,H}. DFS starts at A with disc[A]=1 and low[A]=1, then visits B with 2 and C with 3.',
        'C sees edge C->A, and A is on the stack, so low[C] becomes 1. C then visits D, E, F, G, and H in order, assigning discovery numbers 4 through 8. H sees H->G, so low[H] becomes 7, and G closes first because disc[G]=low[G]=7.',
        'After popping H and G, F keeps low 4 through edge F->D. D then closes {F,E,D} because disc[D]=low[D]=4. Finally low values return through C and B to A, and A closes {C,B,A}; the algorithm used 8 discoveries and 10 edge inspections.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Robert Tarjan, "Depth-First Search and Linear Graph Algorithms," SIAM Journal on Computing, 1972, for the original low-link method. Compare Kosaraju-Sharir SCC decomposition to see the two-pass alternative based on reverse finish order.',
        'Study DFS timestamps and edge classification before this topic. Then study topological sort, 2-SAT implication graphs, articulation points, bridges, and condensation DAG processing so the same low-link and component ideas transfer cleanly.',
      ],
    },
  ],
};