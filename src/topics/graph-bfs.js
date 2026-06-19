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
      ],
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
        'Four node states tell the story. Unvisited nodes are gray — BFS has not reached them. Queued nodes glow orange — they are in the frontier, waiting their turn. The single bright node is the current node being processed: BFS is scanning its neighbors right now. Dark nodes are finished — dequeued and fully expanded.',
        'Highlighted edges show discovery. When BFS enqueues a neighbor, the connecting edge lights up to mark the parent link that will later reconstruct the shortest path. The queue contents appear in each step. Watch the queue shrink at the front and grow at the back — that first-in, first-out discipline is the entire reason BFS finds shortest paths.',
        'The hop count beside each node is set at the moment of enqueue, not dequeue. That is the moment BFS proves the shortest distance to that node. Once set, no later discovery can improve it.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Edward Moore described breadth-first search in 1959 to solve maze routing: given a grid, find a path from entrance to exit using the fewest steps. C. Y. Lee adapted it in 1961 for printed-circuit-board routing, where wires must reach pins through the shortest Manhattan-distance path. Both problems need the same guarantee: explore every position at distance d before touching any position at distance d + 1.',
        'Graphs are messier than trees. A node can be reachable by many paths, cycles can loop forever, and two routes to the same place can differ in length. BFS tames that mess with one structural rule: use a queue so closer nodes always leave before farther nodes. The result is the shortest path by edge count in any unweighted graph.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Depth-first search is the natural first attempt. Pick a direction, keep going until you hit a dead end or the target, then backtrack. DFS is simple, uses little memory (just the recursion stack), and will find a path if one exists.',
      ],
    }
  ],
};
