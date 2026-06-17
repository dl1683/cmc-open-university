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
      heading: `What it is`,
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
      heading: `Legacy visual note`,
      paragraphs: [
        `Watch the queue, not just the highlighted node. The queue is the frontier of the current ring and the next ring. When a node is enqueued, it receives its distance and parent immediately; that is the moment BFS proves the shortest hop count to that node.`,
        `The tempting wrong reading is "BFS is just wandering broadly." It is stricter than that. Every dequeue finishes the oldest known frontier item, and the seen set prevents cycles from re-entering the frontier. The animation's queue order is the proof of shortest unweighted paths.`,
      ],
    },
    {
      heading: `Cost and complexity`,
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
      heading: `Pitfalls and misconceptions`,
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
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Breadth-first search exists for one plain reason: in an unweighted graph, we often need the nearest things first. Nearest means fewest edges from a source, not cheapest road distance or smallest numerical weight. Social distance, unweighted maze steps, object reachability, crawling depth, and peer hop count all use this idea.',
        'Graphs are not trees. A node can have many parents, cycles can lead back to already seen nodes, and two different routes can reach the same place. BFS gives a disciplined way to explore that mess without getting trapped and without mistaking the first route found by accident for the shortest route by edge count.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to start walking from the source until the target appears. That is depth-first behavior. It may find a path quickly, but the path can be much longer than necessary because the search can dive down one branch before checking a nearby neighbor.',
        'Another tempting approach is to enumerate all paths and pick the shortest. That is usually disastrous. Graphs with cycles have infinitely many walks unless you restrict them, and even simple acyclic graphs can have exponentially many paths. BFS avoids path enumeration by recording the first time each node is reached.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is ring order. BFS finishes every node at distance 0, then every node at distance 1, then every node at distance 2, and so on. The queue enforces that order. Newly discovered neighbors go to the back, so older, closer frontier nodes leave the queue first.',
        'The seen set is part of the algorithm, not an optimization. Marking a node seen when it is enqueued prevents cycles and duplicate work. It also protects the distance label: the first enqueue is the moment BFS proves the node has been reached by the fewest possible edges.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize a queue with the source. Set its distance to zero, mark it seen, and store no parent. Repeatedly dequeue the oldest node, scan its neighbors, and for every unseen neighbor set distance = current distance + 1, store the current node as its parent, mark it seen, and enqueue it.',
        'If the goal is reachability, continue until the queue empties. If the goal is shortest path to one target, you can stop when the target is first discovered or dequeued, depending on how you want to structure the implementation. Parent pointers reconstruct the path by walking backward from target to source.',
        'On an adjacency-list graph, the work is proportional to vertices plus edges because each vertex enters the queue once and each adjacency entry is inspected once. On an adjacency matrix, finding neighbors may require scanning a whole row, so the representation changes the real cost.',
        'For disconnected graphs, repeat BFS from every unseen vertex if the goal is to label all components. The single-source version only proves distances from one source. It says nothing about vertices in another component except that they are unreachable from that source.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The queue in the visual is the proof object. It contains the active frontier in first-in, first-out order. When all distance-2 nodes were enqueued after all distance-1 nodes, a distance-2 node cannot jump ahead and cause a longer route to win.',
        'The parent arrows prove path reconstruction. They are not arbitrary breadcrumbs. Each arrow is set at first discovery, and first discovery is shortest by the ring invariant. The seen highlights prove why cycles do not re-enter the queue and why cross edges do not produce duplicate vertices.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows by induction on distance. The source is correct at distance 0. If all nodes at distance d are processed before any node at distance d + 1 is processed, then every unseen neighbor discovered from a distance d node has a path of length d + 1. No shorter path can appear later because it would have come from an earlier ring.',
        'This is why a simple queue is enough. BFS does not need a priority queue when every edge has equal cost. The priority is already implicit in insertion order: all paths with fewer edges are generated before paths with more edges.',
        'Marking on enqueue is the implementation detail that keeps the proof honest. If a node is not marked until dequeue, several parents from the same or later frontier can enqueue it repeatedly. The shortest-distance label may still be repairable, but the algorithm wastes memory and can become painfully slow on dense graphs.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'With V vertices and E edges in adjacency-list form, BFS is O(V + E) time and O(V) space for the queue, seen set, distance map, and parent map. In an undirected graph, each edge appears in two adjacency lists, but that still counts as linear in the stored graph size.',
        'The cost can still be large. On high-degree graphs, one frontier can explode into millions of neighbors. On web-scale graphs, memory bandwidth and queue representation matter more than the textbook loop. On a grid, BFS may touch a large disk-shaped region before it reaches a far target.',
        'The practical data structure choices matter. A JavaScript array with shift can turn queue operations into repeated linear-time movement. A head index, deque, ring buffer, or dedicated queue keeps the traversal cost aligned with the graph cost instead of adding hidden overhead.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'BFS is the right tool for shortest paths in unweighted graphs, minimum moves in a grid, level-order exploration, degrees of separation, bipartite checks, connected-component discovery, garbage-collector marking, and reachability from roots. It is also a useful baseline before using more specialized graph algorithms.',
        'Many systems hide BFS inside other names. A crawler expanding seed URLs by depth, a dependency tool finding reachable packages, a graph database traversing one hop at a time, and a memory manager marking reachable objects are all using the same frontier idea.',
        'It is also a good teaching algorithm because every moving part has a reason. The queue preserves distance order, the seen set prevents cycles, the distance map stores the proof result, and the parent map turns reachability into an actual path. Remove any one of those and the behavior changes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BFS does not solve weighted shortest paths. If one edge costs 1 and another costs 100, fewest edges can be the wrong answer. Use Dijkstra for nonnegative weights and A* when a good heuristic can guide the search toward a target.',
        'It also performs poorly when the branching factor is huge and the target is deep. Bidirectional BFS can help when both start and target are known. Heuristic search can help when the graph has geometry. Pruning can help when the problem has constraints. Plain BFS is honest, but not always small.',
        'A subtle failure is mutating the graph during traversal without a rule. If neighbors can appear or disappear while BFS runs, the meaning of shortest path depends on whether the graph is a snapshot or a live structure. Production systems usually define that boundary explicitly.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Queue first because it is the engine of the traversal. Then study Tree Traversals for level order on trees, Dijkstra Shortest Path for weighted graphs, A* Search for heuristic shortest paths, Topological Sort for another queue-driven graph algorithm, Compressed Sparse Row Graph for storage, and GraphBLAS Sparse Matrix Graph Case Study to see BFS expressed as sparse linear algebra.',
      ],
    },
  ],
};
