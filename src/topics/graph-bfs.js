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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Breadth-first search (BFS) is an algorithm for exploring a graph starting from a source node, visiting all nodes reachable from that source. It explores outward in expanding rings: first visit all neighbors, then all neighbors of neighbors, and so on. At each hop distance, all nodes are visited before moving to the next distance. The result is a "shortest path tree" where the path from the source to any node uses the fewest edges possible.`,
        `BFS differs from depth-first search in its order of exploration. DFS dives deep into one branch before backtracking; BFS fans out evenly in all directions, always exploring the closest unvisited nodes first. This makes BFS the natural choice for finding shortest paths in unweighted graphs, detecting connected components, and level-order exploration.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with the source node in a queue. Mark it as seen. Then repeatedly dequeue a node, examine all its unvisited neighbors, mark them as seen, record their distance (current distance + 1), and enqueue them. The queue ensures nodes are processed in the order they are discovered. Nodes at distance d are processed before any node at distance d+1, because nodes at distance d are enqueued before nodes at distance d+1.`,
        `To track the shortest path, maintain a parent pointer for each node, recording which node discovered it. When you reach the target, backtrack through parent pointers to reconstruct the path. The queue is essential: it enforces the layer-by-layer exploration that guarantees shortest paths. Unlike depth-first search (which uses a stack and explores deeply), BFS uses a queue to explore widely.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `BFS visits every node once and examines every edge twice (once from each direction, unless the graph is directed). With V nodes and E edges, the time complexity is O(V + E). Space complexity is O(V) for the queue and the seen set. The queue size is bounded by the maximum number of nodes at any distance, which is at most V. BFS is more efficient than trying all paths or random exploration because it visits each node exactly once and does not revisit nodes.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Social networks use BFS to compute degrees of separation — how many hops away is one person from another. GPS and routing systems use BFS (or Dijkstra for weighted roads) to find shortest routes. Web crawlers use BFS to explore the web, discovering new pages from known pages. Operating systems use BFS in garbage collection to mark reachable objects. Peer-to-peer networks use BFS to flood-fill messages (Gnutella, BitTorrent). Game pathfinding uses BFS to find shortest paths for characters. Network switches use BFS-like algorithms to forward packets efficiently.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common mistake is using BFS on weighted graphs without adjusting the algorithm. BFS finds the path with the fewest hops, not the lowest total weight — use Dijkstra's algorithm instead for weighted graphs. Forgetting to mark nodes as seen before enqueuing them leads to infinite loops and revisiting the same node many times. Confusing BFS with depth-first search is easy: remember BFS explores all neighbors before going deeper (breadth first), while DFS explores one branch all the way before backtracking (depth first). Assuming BFS always finds a path is wrong: in a disconnected graph, BFS only reaches nodes in the same component as the source. Finally, BFS requires tracking which nodes have been visited; without that, the algorithm degenerates into exploring every path.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Dijkstra's Shortest Path to see how BFS extends to weighted graphs using a priority queue instead of a regular queue. Learn Graph DFS (depth-first search) to contrast with BFS and understand when to use each. Explore Tree Traversals and level-order traversal, which use the same queue-based approach on trees. Understand Queue, which is the data structure powering BFS.`,
      ],
    },
  ],
};
