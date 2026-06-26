// Breadth-first search on a graph: explore in rings, powered by a queue.
// Finds the fewest-hops path to everything it touches.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'graph-bfs',
  title: 'Graph BFS',
  category: 'Data Structures',
  summary: 'Explore a graph in expanding rings with a queue — the fewest-hops path falls out for free.',
  controls: [
    { id: 'target', label: 'Search for node', type: 'select', options: ['G', 'F', 'H'], defaultValue: 'G' },
  ],
  run,
};

// A fixed little network. BFS itself is the lesson; positions are layout only.
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 5.0 }, { id: 'B', label: 'B', x: 3.2, y: 7.5 },
  { id: 'C', label: 'C', x: 3.2, y: 2.5 }, { id: 'D', label: 'D', x: 5.6, y: 8.4 },
  { id: 'E', label: 'E', x: 5.6, y: 5.0 }, { id: 'F', label: 'F', x: 5.6, y: 1.4 },
  { id: 'G', label: 'G', x: 8.2, y: 6.6 }, { id: 'H', label: 'H', x: 8.2, y: 2.8 },
];
const EDGES = [
  ['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['C', 'F'],
  ['D', 'G'], ['E', 'G'], ['F', 'H'], ['G', 'H'],
].map(([from, to]) => ({ id: `${from}${to}`, from, to }));

const neighbors = (id) => EDGES
  .filter((e) => e.from === id || e.to === id)
  .map((e) => (e.from === id ? e.to : e.from));
const edgeBetween = (a, b) => EDGES.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));

export function* run(input) {
  const target = String(input.target);
  if (!NODES.some((n) => n.id === target)) throw new InputError('Pick a node from the list.');

  const hops = new Map([['A', 0]]);
  const parent = new Map();
  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({ ...n, note: hops.has(n.id) ? `${hops.get(n.id)} hop${hops.get(n.id) === 1 ? '' : 's'}` : '' })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `This is a GRAPH — nodes and connections, no parent/child hierarchy, cycles allowed. Trees couldn't model friendships or road maps; graphs can. Mission: find ${target} starting from A, using breadth-first search. The engine of BFS is a QUEUE (see Queue and the level-order Tree Traversal — same trick, wilder territory).`,
  };

  const queue = ['A'];
  const seen = new Set(['A']);
  const done = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === target) {
      // reconstruct the path A -> target via parent links
      const pathNodes = [];
      let walk = target;
      while (walk !== undefined) { pathNodes.unshift(walk); walk = parent.get(walk); }
      const pathEdges = pathNodes.slice(1).map((n, i) => edgeBetween(pathNodes[i], n).id);
      yield {
        state: snapshot(),
        highlight: { found: [target], visited: done },
        explanation: `Dequeued ${target} — found it, ${hops.get(target)} hops from A.`,
      };
      yield {
        state: snapshot(),
        highlight: { found: [...pathNodes, ...pathEdges], visited: done },
        explanation: `And because BFS explores ring by ring (all 1-hop nodes, then all 2-hop nodes…), the path it found — ${pathNodes.join(' → ')} — is GUARANTEED to use the fewest possible hops. This is how social networks compute degrees of separation, how routers flood-fill networks, and how web crawlers fan out. For weighted roads where some hops cost more, you need Dijkstra — next up.`,
        invariant: 'BFS visits nodes in non-decreasing hop distance — nearer rings always finish first.',
      };
      return;
    }

    const fresh = neighbors(current).filter((n) => !seen.has(n));
    for (const n of fresh) {
      seen.add(n);
      hops.set(n, hops.get(current) + 1);
      parent.set(n, current);
      queue.push(n);
    }
    done.push(current);
    yield {
      state: snapshot(),
      highlight: {
        active: [current],
        compare: fresh.flatMap((n) => [n, edgeBetween(current, n).id]),
        visited: done.slice(0, -1),
      },
      explanation: `Dequeue ${current} (${hops.get(current)} hop${hops.get(current) === 1 ? '' : 's'} from A). ${fresh.length ? `Discover ${fresh.join(', ')} — mark seen, record ${fresh.length === 1 ? 'its' : 'their'} hop count, enqueue.` : 'All its neighbors are already seen — nothing new here.'} Queue now: [${queue.join(', ')}].`,
      invariant: 'The queue never holds nodes more than one ring apart.',
    };
  }
}

const legacyArticle = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Breadth-first search explores a graph in expanding rings from a source. First it visits nodes one edge away, then nodes two edges away, then three, and so on. That ring order is what gives the algorithm its strongest guarantee: in an unweighted graph, the first time a node is discovered, the recorded path uses the fewest possible edges.`,
        `A graph can contain cycles, cross-links, and disconnected components, so this is not just Tree Traversals with different labels. The algorithm must remember which nodes have already been seen. Without that seen set, a cycle like A to B to A can loop forever or enqueue the same node exponentially many times.`,
        `The reasonable first attempt is depth-first search or path enumeration: keep walking until the target appears. That can find a route, but it does not prove the route is shortest by hop count. BFS exists because the queue enforces a stronger promise: finish every closer ring before touching a farther ring.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Put the source node into a Queue and mark it seen. Repeatedly dequeue the oldest node, inspect each neighbor, and enqueue only the neighbors not seen before. When a neighbor is first discovered, store its parent pointer and distance as current distance + 1. Parent pointers reconstruct the path once the target is found.`,
        `The queue is the proof mechanism. Nodes discovered at distance d enter the queue before nodes at distance d + 1, so all closer work is processed first. This is why the path is shortest by hop count. A stack would create depth-first behavior instead, which can be useful for cycle detection or backtracking but does not guarantee fewest hops.`,
        `Correctness rests on first discovery. When BFS first marks a node at distance d, any alternate path with fewer than d edges would have come from an earlier ring and would already have discovered it. Later visits can only tie or lose, so the first parent pointer is safe.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `Watch the queue, not just the highlighted node. The queue is the frontier of the current ring and the next ring. When a node is enqueued, it receives its distance and parent immediately; that is the moment BFS proves the shortest hop count to that node.`,
        `The tempting wrong reading is "BFS is just wandering broadly." It is stricter than that. Every dequeue finishes the oldest known frontier item, and the seen set prevents cycles from re-entering the frontier. The animation's queue order is the proof of shortest unweighted paths.`,
      
        {type: 'image', src: './assets/gifs/graph-bfs.gif', alt: 'Animated walkthrough of the graph bfs visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `With V vertices and E edges in an adjacency-list graph, time is O(V + E): each vertex enters the queue once, and each edge is examined once in a directed graph or twice in an undirected graph. Space is O(V) for the queue, seen set, distance map, and parent map. On a dense adjacency matrix, scanning neighbors can cost O(V^2) because every row has to be checked.`,
        `The Big-O Growth Rates are linear in the explicit graph size, not in the number of possible paths. That distinction is the whole win: a graph with cycles can have exponentially many walks, but breadth-first search refuses to revisit already seen nodes.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Social networks use this pattern for degrees of separation. Web crawlers use it or priority-adjusted variants to fan out from seed pages. Garbage collectors mark all objects reachable from roots. Peer-to-peer systems flood messages with a hop limit. In games, it finds shortest movement paths on unweighted grids. Weighted road networks need Dijkstra's Shortest Path or A* Search instead because one hop may be far more expensive than another.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The biggest mistake is applying it to weighted edges and expecting cheapest paths. It finds fewest edges, not lowest cost. Another bug is marking a node seen only when dequeued; in graphs with many incoming edges, that can enqueue duplicates. Mark when enqueuing so each vertex enters once. Also remember disconnected graphs: starting from A cannot reach nodes in another component.`,
        `It is not inherently recursive. The normal implementation is iterative and queue-driven. Recursive code can express depth-first traversal naturally, but breadth-first order needs an explicit frontier. Topological Sort uses a queue too, yet its priority is in-degree zero rather than graph distance.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Queue first, because it is the engine. Tree Traversals shows the same level-order idea on trees. Dijkstra's Shortest Path adds edge weights with Binary Heap (Priority Queue). A* Search adds a goal-directed heuristic. Topological Sort shows another queue-based graph algorithm, and Big-O Growth Rates explains why O(V + E) is so powerful.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        'The wall is assuming BFS logic works unchanged once the graph has weighted edges or revisit states.',
        'The only reliable invariant is: when a node is dequeued in BFS order for unweighted graphs, its distance is final and minimal.',
        'A tiny graph exposes the failure when this is ignored: A->B (1), A->C (2), B->C (1). If C is finalized from A->C first, BFS can never fix that distance through the cheaper A->B->C route.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Use A as the source and target F. The search starts with queue = [A], seen = {A}.',
        'Step one: dequeue A, visit unseen neighbors B and C, set both distance = 1, then enqueue [B, C].',
        'Step two: dequeue B, visit unseen neighbors and assign distance = 2, then enqueue unseen nodes. Step three: dequeue C, visit unseen neighbors and do not revisit A, then discover F via the B/C region. The first discovery fixes the best parent chain.',
        'Step four: if F is the goal, parent reconstruction gives F <- E <- C <- A, a three-edge shortest path. No shorter path can appear later because all queued states with smaller distance already processed.',
      ],
    },
],
};

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Four node states tell the story. Unvisited nodes are gray — BFS has not reached them yet. Queued nodes glow orange — they sit in the frontier, waiting their turn in strict first-in, first-out order. The single bright node is the one being processed right now: BFS is scanning its neighbors. Dark nodes are finished — dequeued and fully expanded, never touched again.',
        'Highlighted edges show discovery. When BFS enqueues a neighbor for the first time, the connecting edge lights up to mark the parent link that will later reconstruct the shortest path. Each step displays the current queue contents. Watch the queue shrink at the front and grow at the back — that FIFO discipline is the structural reason BFS finds shortest paths.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Animated_BFS.gif', alt: 'Animated breadth-first search expanding from a source node in rings', caption: 'The canonical BFS animation shows the ring expansion directly: gray nodes wait, queued nodes form the frontier, and black nodes are finished. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Animated_BFS.gif'},
        {type: 'callout', text: 'BFS gets shortest unweighted paths because the queue finishes every closer ring before any farther ring can run.'},
        'The hop count beside each node is set at the moment of enqueue, not dequeue. That is the moment BFS proves the shortest distance to that node. Once a distance is assigned, no later discovery through a longer path can improve it — every alternate route uses at least as many edges. If you focus on just one thing, watch the queue order and confirm that no node at distance d + 1 ever leaves the queue while a node at distance d is still waiting.',
        {type: 'image', src: './assets/gifs/graph-bfs.gif', alt: 'Animated walkthrough of the graph bfs visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Edward Moore described breadth-first search in 1959 to solve maze routing: given a grid with walls, find a path from entrance to exit using the fewest steps. The key constraint was that every step costs the same — one cell in any direction. C. Y. Lee adapted the idea in 1961 for printed-circuit-board routing, where wires must reach pins through the shortest Manhattan-distance path. Both problems need the same guarantee: explore every position at distance d before touching any position at distance d + 1.',
        'Graphs are messier than trees. In a tree, there is exactly one path from root to any node. In a graph, a node can be reachable by many paths, cycles can send you in circles forever, and two routes to the same destination can differ in length. A social network, a road map, and the hyperlink structure of the web are all graphs. None of them are trees.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/GermanyBFS.svg/250px-GermanyBFS.svg.png', alt: 'Breadth-first tree from a German city graph starting at Frankfurt', caption: 'A BFS tree records first-discovery parent links, so the tree itself is evidence of shortest hop paths from the source. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:GermanyBFS.svg'},
        'BFS tames this mess with one structural rule: use a queue so that closer nodes always leave before farther nodes. The result is the shortest path by edge count in any unweighted graph. That guarantee is what separates BFS from casual wandering — the queue is not a convenience, it is the proof mechanism.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Depth-first search is the natural first attempt. Pick a direction, keep going until you hit a dead end or the target, then backtrack and try another branch. DFS is simple to implement — just a recursive function or an explicit stack — uses little memory, and will find a path if one exists. For many problems, that is enough.',
        'DFS works well for reachability: "can I get from A to G at all?" It also works for cycle detection, topological ordering, and connected-component labeling. In a tree, DFS and BFS both find the unique path, so the choice does not matter much.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Cycles and cross-links are what make the seen set mandatory; without it, traversal can revisit the same directed structure forever. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg'},
        'The path DFS finds depends on the order it tries neighbors. In the animation\'s graph, DFS starting at A might go A-B-D-G and report a 3-hop path, or it might wander A-B-E-G, also 3 hops. But it could just as easily stumble into A-C-E-G or A-C-F-H-G (4 hops) and stop there, satisfied. DFS has no mechanism to prefer shorter routes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'DFS finds a path but cannot promise it is shortest. Consider a graph where A connects to B and C, B connects to G directly, and C connects to D which connects to E which connects to G. DFS might explore the C-D-E-G branch first and report a 4-hop path, missing the 2-hop path through B entirely. It has no way to know a shorter route exists because it commits to one direction before exploring alternatives at the same depth.',
        'The brute-force fix is to enumerate all paths and pick the shortest. In a graph with V nodes and E edges, the number of simple paths can be exponential — a complete graph on 20 nodes has over 10^18 simple paths. Even storing them is impossible, let alone comparing them.',
        'A subtler fix is to run DFS, record the path length, then run it again through every possible neighbor ordering, keeping the best result. This is still exponential. The problem is structural: DFS uses a stack, which means last-in, first-out ordering. The most recently discovered node gets processed next regardless of how far it is from the source. A stack has no concept of "closer first."',
        'What is needed is a data structure that processes nodes in order of their distance from the source — specifically, one that guarantees every node at distance d is fully processed before any node at distance d + 1 begins. That structure is a queue.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace the stack with a queue. That single substitution — last-in-first-out becomes first-in-first-out — transforms a depth-first traversal into a breadth-first traversal. Nodes discovered at distance 1 enter the queue first. While processing them, nodes at distance 2 are discovered and enter the queue behind all the distance-1 nodes. By the time the queue reaches those distance-2 nodes, every distance-1 node is already finished.',
        'This creates ring-by-ring expansion. Ring 0 is the source. Ring 1 is every node one edge from the source. Ring 2 is every node two edges from the source that was not already discovered in ring 1. The queue enforces a strict ordering: all of ring k leaves the queue before any of ring k + 1. Because of that ordering, the first time any node is discovered, the path used to reach it is the shortest possible.',
        'The queue is not an implementation detail — it is the proof. FIFO order is what makes the shortest-path guarantee work. If you replaced it with a stack, you would get DFS. If you replaced it with a priority queue keyed on edge weights, you would get Dijkstra\'s algorithm. The data structure driving the frontier determines the guarantee.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize three structures: a queue holding just the source node, a seen set containing just the source, and a parent map that is empty. The seen set records which nodes have already been discovered. The parent map records how each node was first reached, so the path can be reconstructed later. Set the source\'s distance to 0.',
        'The main loop dequeues the oldest node, call it current. For each neighbor of current, check if that neighbor is in the seen set. If it is not, mark it seen immediately, set its distance to current\'s distance plus 1, record current as its parent, and enqueue it. If the neighbor is already seen, skip it — a shorter or equal path already claimed it.',
        'When the target is dequeued, the search is done. Reconstruct the path by following parent pointers from target back to source, then reverse. If the queue empties before the target is dequeued, the target is unreachable from the source — they are in different connected components.',
        'One critical detail: mark a node seen when it is enqueued, not when it is dequeued. If you wait until dequeue, multiple predecessors can each enqueue the same neighbor before any of those copies is processed. The result is wasted work and, in the worst case, exponential queue growth on dense graphs. Marking at enqueue ensures each node enters the queue exactly once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an induction on distance rings. Claim: when BFS assigns distance d to a node v, the true shortest path from the source to v uses exactly d edges. Base case: the source gets distance 0, which is trivially correct.',
        'Inductive step: assume every node assigned distance d or less has the correct shortest-path distance. When BFS processes a node u at distance d, it discovers an unseen neighbor v and assigns distance d + 1. Could v have a shorter path, say with fewer than d + 1 edges? That path would end with some edge (w, v) where w is at distance at most d. But by the inductive hypothesis, w was already assigned its correct distance and was already processed, which means BFS already scanned w\'s neighbors. Since v is one of w\'s neighbors, BFS would have discovered v then and assigned it distance at most d. That contradicts v being unseen when u processes it. So d + 1 is correct.',
        'The seen set is what makes the induction hold. Without it, a node could be re-discovered through a longer path and have its distance overwritten. The seen set locks in the first discovery, which the induction proves is the shortest. First discovery is safe because every shorter path was explored in an earlier ring.',
        'This argument also explains why BFS does not work for weighted graphs. In a weighted graph, a 2-edge path can cost less than a 1-edge path, so "closer ring" by edge count does not mean "closer" by total weight. Dijkstra\'s algorithm fixes this by replacing the FIFO queue with a priority queue keyed on cumulative edge weight.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time is O(V + E) where V is the number of vertices and E is the number of edges. Each vertex enters the queue exactly once (the seen set enforces this), so there are exactly V dequeue operations. Each edge is examined when its endpoint is dequeued — once per direction in a directed graph, twice in an undirected graph. The total work over all dequeue operations is proportional to the sum of all adjacency lists, which is E for directed graphs and 2E for undirected.',
        'Space is O(V). The queue can hold at most V nodes (if they are all discovered before any is processed). The seen set, distance map, and parent map each store one entry per vertex. On an adjacency-list representation, the graph itself takes O(V + E) space, so the BFS overhead is never the dominant cost.',
        'Doubling the graph size roughly doubles the runtime. A graph with 10,000 nodes and 30,000 edges takes about 40,000 steps. A graph with 20,000 nodes and 60,000 edges takes about 80,000 steps. This is as good as any algorithm can do on a general graph, because reading the input alone takes O(V + E).',
        'On an adjacency matrix instead of an adjacency list, scanning neighbors costs O(V) per node instead of O(degree), making total time O(V^2). For sparse graphs (E much less than V^2), adjacency lists are strictly better. For dense graphs where E is close to V^2, the matrix penalty is a constant factor and may be offset by better cache behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Social networks compute degrees of separation with BFS. LinkedIn\'s "2nd connection" and "3rd connection" labels are literally BFS ring numbers from your profile node. Facebook\'s original social graph search used BFS to find shortest relationship chains. The cost is linear in the subgraph explored, which is manageable when the search is bounded by a maximum ring (say, 3 hops).',
        'Web crawlers use BFS or BFS-like strategies to discover pages. Starting from a set of seed URLs, the crawler enqueues every link on each page and processes them in breadth-first order. This ensures pages close to popular seeds are crawled first. Google\'s original crawler used a priority-modified BFS where page importance influenced queue ordering.',
        'Network routing protocols like OSPF (Open Shortest Path First) build a link-state database and then run a shortest-path algorithm from each router. For unweighted or equal-cost links, this reduces to BFS. Peer-to-peer protocols use BFS-like flooding with a TTL (time-to-live) hop limit to discover nearby peers without exploring the entire network.',
        'Garbage collectors in languages like Java and Go use BFS-style mark phases. Starting from root references (stack variables, global variables), the collector enqueues every reachable object and marks it live. Anything not marked is garbage. The BFS order does not matter for correctness here, but the queue-based approach avoids the deep recursion stack that DFS would need on large object graphs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common mistake is applying BFS to a weighted graph and expecting cheapest paths. BFS finds fewest edges, not lowest total weight. If edge A-B costs 1 and edge A-C costs 100, BFS treats both as one hop. For weighted shortest paths, use Dijkstra\'s algorithm (nonneg weights) or Bellman-Ford (any weights).',
        'BFS explores the entire reachable graph until it finds the target. It has no sense of direction. On a large grid, searching for a node in the far corner means expanding every ring concentrically, visiting many irrelevant nodes. A* search adds a heuristic estimate of remaining distance to prune the search space and focus expansion toward the goal.',
        'Memory is the practical bottleneck on very large graphs. BFS must store the entire frontier ring in the queue, and in a graph with high branching factor, that ring can be enormous. A graph where each node has 100 neighbors will have up to 100^d nodes in ring d. On implicitly defined state-space graphs (like puzzle solvers), the frontier can exhaust memory before the target is found. Iterative deepening DFS trades time for memory in these cases.',
        'BFS cannot reach nodes in a different connected component. If the graph has multiple disconnected pieces, BFS from one piece will never find nodes in another. The fix is to check if the target was found after the queue empties and, if not, report it as unreachable. For full-graph analysis, run BFS from each unvisited node to find all components.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the animation\'s graph with source A and target G. Nodes: A, B, C, D, E, F, G, H. Edges: A-B, A-C, B-D, B-E, C-E, C-F, D-G, E-G, F-H, G-H. Initialize: queue = [A], seen = {A}, dist(A) = 0, parent map empty.',
        'Step 1: dequeue A. Neighbors are B and C. Neither is seen. Enqueue both, mark seen, set dist(B) = 1, dist(C) = 1, parent(B) = A, parent(C) = A. Queue = [B, C]. The entire ring-1 frontier is now loaded.',
        'Step 2: dequeue B (entered the queue before C, so FIFO picks B). Neighbors of B: A, D, E. A is already seen — skip. D and E are unseen. Enqueue both, set dist(D) = 2, dist(E) = 2, parent(D) = B, parent(E) = B. Queue = [C, D, E].',
        'Step 3: dequeue C. Neighbors of C: A, E, F. A is seen, E is seen (discovered via B in step 2). Only F is new. Enqueue F, set dist(F) = 2, parent(F) = C. Queue = [D, E, F]. Notice that E was discovered through B, not C. BFS committed to the B path first because B entered the queue before C. Both give the same distance (2), but the parent pointer goes to B.',
        'Step 4: dequeue D. Neighbors: B (seen), G (unseen). Enqueue G, set dist(G) = 3, parent(G) = D. Queue = [E, F, G]. Step 5: dequeue E. Neighbors: B (seen), C (seen), G (seen — already discovered via D). Nothing new. Queue = [F, G]. Step 6: dequeue F. Neighbors: C (seen), H (unseen). Enqueue H, set dist(H) = 3, parent(H) = F. Queue = [G, H].',
        'Step 7: dequeue G. This is the target. Reconstruct the path by following parent pointers: G\'s parent is D, D\'s parent is B, B\'s parent is A. Reverse: A - B - D - G. That is 3 hops. BFS guarantees no shorter path exists because every node at distance 0 (A), 1 (B, C), and 2 (D, E, F) was fully processed before any distance-3 node was dequeued.',
        'Verify the guarantee: the other paths from A to G are A-B-E-G (3 hops), A-C-E-G (3 hops), and A-C-F-H-G (4 hops). All tie or lose. The BFS path of 3 hops is indeed shortest, and BFS found it without enumerating the alternatives — the queue order made the proof automatic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Moore\'s 1959 paper "The shortest path through a maze" (Bell System Technical Journal) introduced the algorithm. Lee\'s 1961 paper "An algorithm for path connections and its applications" adapted it for circuit routing. Cormen, Leiserson, Rivest, and Stein cover BFS in chapter 22 of Introduction to Algorithms (CLRS), including the correctness proof by induction on distance rings.',
        'Study Queue first — it is the engine that makes BFS work. The distinction between FIFO and LIFO is the entire difference between breadth-first and depth-first traversal. If you understand why a queue processes ring by ring, you understand BFS.',
        'Tree Traversals shows the same level-order idea on trees, where BFS is simpler because there are no cycles and no seen set is needed. Dijkstra\'s Shortest Path generalizes BFS to weighted graphs by replacing the queue with a Binary Heap (priority queue) keyed on cumulative edge weight. A* Search adds a heuristic estimate to Dijkstra\'s priority to focus the search toward a specific goal.',
        'Topological Sort uses a queue too, but the ordering criterion is in-degree rather than distance — nodes with zero incoming edges are processed first. Big-O Growth Rates explains why O(V + E) is linear in the graph size and why that is optimal for any algorithm that must read the entire input.',
      ],
    },
  ],
};
