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
      heading: `What it is`,
      paragraphs: [
        `Breadth-first search explores a graph in expanding rings from a source. First it visits nodes one edge away, then nodes two edges away, then three, and so on. That ring order is what gives the algorithm its strongest guarantee: in an unweighted graph, the first time a node is discovered, the recorded path uses the fewest possible edges.`,
        `A graph can contain cycles, cross-links, and disconnected components, so this is not just Tree Traversals with different labels. The algorithm must remember which nodes have already been seen. Without that seen set, a cycle like A to B to A can loop forever or enqueue the same node exponentially many times.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Put the source node into a Queue and mark it seen. Repeatedly dequeue the oldest node, inspect each neighbor, and enqueue only the neighbors not seen before. When a neighbor is first discovered, store its parent pointer and distance as current distance + 1. Parent pointers reconstruct the path once the target is found.`,
        `The queue is the proof mechanism. Nodes discovered at distance d enter the queue before nodes at distance d + 1, so all closer work is processed first. This is why the path is shortest by hop count. A stack would create depth-first behavior instead, which can be useful for cycle detection or backtracking but does not guarantee fewest hops.`,
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
