// Dijkstra's algorithm: BFS grown up. When edges have costs, "fewest hops"
// stops being "cheapest" — so always expand the cheapest known node instead.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'dijkstra',
  title: "Dijkstra's Shortest Path",
  category: 'Data Structures',
  summary: 'Find the cheapest route in a weighted graph by always expanding the cheapest known node.',
  controls: [
    { id: 'target', label: 'Destination', type: 'select', options: ['F', 'E', 'D'], defaultValue: 'F' },
  ],
  run,
};

// A weighted map. Note the trap: A→B→F looks short (2 edges) but costs 12;
// the 4-edge route through C, D, E costs 9.
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 4.5 }, { id: 'B', label: 'B', x: 4.0, y: 7.6 },
  { id: 'C', label: 'C', x: 3.6, y: 1.6 }, { id: 'D', label: 'D', x: 6.4, y: 3.4 },
  { id: 'E', label: 'E', x: 8.0, y: 6.0 }, { id: 'F', label: 'F', x: 9.4, y: 2.6 },
];
const EDGES = [
  { id: 'AB', from: 'A', to: 'B', weight: 5 }, { id: 'AC', from: 'A', to: 'C', weight: 2 },
  { id: 'BD', from: 'B', to: 'D', weight: 4 }, { id: 'BE', from: 'B', to: 'E', weight: 6 },
  { id: 'BF', from: 'B', to: 'F', weight: 7 }, { id: 'CD', from: 'C', to: 'D', weight: 3 },
  { id: 'DE', from: 'D', to: 'E', weight: 2 }, { id: 'EF', from: 'E', to: 'F', weight: 2 },
];

const around = (id) => EDGES
  .filter((e) => e.from === id || e.to === id)
  .map((e) => ({ edge: e, other: e.from === id ? e.to : e.from }));

export function* run(input) {
  const target = String(input.target);
  const dist = new Map(NODES.map((n) => [n.id, Infinity]));
  const parent = new Map();
  dist.set('A', 0);
  const settled = new Set();

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: dist.get(n.id) === Infinity ? 'd=∞' : `d=${dist.get(n.id)}`,
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `Now the edges have COSTS — kilometers, milliseconds, dollars. BFS would find the fewest edges, but look: A→B→F is 2 edges costing 5+7=12, while the long way round can be cheaper. Dijkstra's fix: track the best-known cost to every node (d=…), and always expand the CHEAPEST unsettled node — greedy, and provably right (as long as no edge cost is negative).`,
  };

  while (true) {
    let current = null;
    for (const [id, d] of dist) {
      if (!settled.has(id) && d < (current === null ? Infinity : dist.get(current))) current = id;
    }
    if (current === null) break;
    settled.add(current);

    if (current === target) {
      const pathNodes = [];
      let walk = target;
      while (walk !== undefined) { pathNodes.unshift(walk); walk = parent.get(walk); }
      const pathEdges = pathNodes.slice(1).map((n, i) => {
        const a = pathNodes[i];
        return EDGES.find((e) => (e.from === a && e.to === n) || (e.from === n && e.to === a)).id;
      });
      yield {
        state: snapshot(),
        highlight: { found: [...pathNodes, ...pathEdges], visited: [...settled].filter((s) => !pathNodes.includes(s)) },
        explanation: `${target} is settled at cost ${dist.get(target)} — and the cheapest route is ${pathNodes.join(' → ')}${pathNodes.includes('B') ? '' : ', NOT the 2-edge shortcut through B'}. This algorithm (with a Binary Heap serving the "cheapest unsettled node" in O(log n)) runs your GPS, internet packet routing (OSPF), and game pathfinding. Greedy works here because settling cheap nodes first means no later discovery can undercut them.`,
        invariant: 'Once a node is settled, its distance is final — no cheaper route to it can ever appear.',
      };
      return;
    }

    yield {
      state: snapshot(),
      highlight: { active: [current], visited: [...settled].filter((s) => s !== current) },
      explanation: `The cheapest unsettled node is ${current} (d=${dist.get(current)}) — settle it. (A real implementation pops this from a Binary Heap instead of scanning.) Its distance can never improve again; now RELAX its edges: does going through ${current} make any neighbor cheaper?`,
    };

    for (const { edge, other } of around(current)) {
      if (settled.has(other)) continue;
      const candidate = dist.get(current) + edge.weight;
      const better = candidate < dist.get(other);
      yield {
        state: snapshot(),
        highlight: { active: [current], compare: [edge.id, other], visited: [...settled].filter((s) => s !== current) },
        explanation: `Via ${current}, reaching ${other} costs ${dist.get(current)} + ${edge.weight} = ${candidate}. Current best for ${other}: ${dist.get(other) === Infinity ? '∞ (never reached)' : dist.get(other)}. ${better ? `Better — update d(${other})=${candidate} and remember the route came through ${current}.` : 'Not better — keep the old route.'}`,
      };
      if (better) {
        dist.set(other, candidate);
        parent.set(other, current);
      }
    }
  }
}
