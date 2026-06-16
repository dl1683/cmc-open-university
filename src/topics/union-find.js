// Union-Find (disjoint sets): answer "are these two connected?" in nearly
// O(1), by keeping every group as a shallow tree of parent pointers.
// The engine inside Kruskal's MST and every connectivity check.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'union-find',
  title: 'Union-Find (Disjoint Sets)',
  category: 'Data Structures',
  summary: 'Merge groups and test connectivity in near-constant time — parent pointers plus two sly tricks.',
  controls: [
    { id: 'compression', label: 'Path compression', type: 'select', options: ['on', 'off'], defaultValue: 'on' },
  ],
  run,
};

const N = 8;
const POS = Array.from({ length: N }, (_, i) => ({
  x: (i % 4) * 2.6 + 1.2,
  y: i < 4 ? 2.2 : 7.0,
}));
const UNIONS = [[0, 1], [2, 3], [0, 2], [4, 5], [6, 7], [4, 6], [1, 5]];

export function* run(input) {
  const compress = String(input.compression) === 'on';
  if (!['on', 'off'].includes(String(input.compression))) throw new InputError('Pick a mode.');

  const parent = Array.from({ length: N }, (_, i) => i);
  const size = new Array(N).fill(1);

  const snapshot = () => graphState({
    nodes: POS.map((p, i) => ({
      id: `v${i}`, label: String(i), x: p.x, y: p.y,
      note: parent[i] === i ? `root (${size[i]})` : '',
    })),
    edges: parent
      .map((p, i) => (p === i ? null : { id: `pe${i}`, from: `v${i}`, to: `v${p}` }))
      .filter(Boolean),
  });

  const rootOf = (i) => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    return r;
  };
  const pathOf = (i) => {
    const path = [i];
    while (parent[path[path.length - 1]] !== path[path.length - 1]) path.push(parent[path[path.length - 1]]);
    return path;
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `${N} elements, each alone in its own set — its own root. Union-Find answers exactly two requests: union(a, b) merges two groups; find(x) names the group, by walking parent pointers up to the ROOT. Same root = same group. Watch how cheap both stay.`,
  };

  for (const [a, b] of UNIONS) {
    const pathA = pathOf(a);
    const pathB = pathOf(b);
    const ra = pathA[pathA.length - 1];
    const rb = pathB[pathB.length - 1];
    yield {
      state: snapshot(),
      highlight: { active: [...new Set([...pathA, ...pathB])].map((i) => `v${i}`) },
      explanation: `union(${a}, ${b}): find both roots — ${a} leads to root ${ra}${pathA.length > 1 ? ` (${pathA.join('→')})` : ''}, ${b} leads to root ${rb}${pathB.length > 1 ? ` (${pathB.join('→')})` : ''}.`,
    };
    const [small, big] = size[ra] <= size[rb] ? [ra, rb] : [rb, ra];
    parent[small] = big;
    size[big] += size[small];
    yield {
      state: snapshot(),
      highlight: { active: [`pe${small}`], found: [`v${big}`] },
      explanation: `Attach the SMALLER tree's root (${small}) under the larger's (${big}) — "union by size". This one rule keeps every tree's height logarithmic: a tree only gets deeper when it at least doubles in members.`,
      invariant: 'Tree height grows only when a tree merges into one at least as large.',
    };
  }

  // a deep find, with or without compression
  const probe = 1;
  const path = pathOf(probe);
  yield {
    state: snapshot(),
    highlight: { active: path.map((i) => `v${i}`) },
    explanation: `find(${probe}): walk ${path.join(' → ')} — ${path.length - 1} hops to the root. ${compress ? 'Now the second trick, PATH COMPRESSION: on the way back, re-point every node on this path DIRECTLY at the root.' : 'Path compression is OFF — the path stays as long as it is, and repeated finds keep paying for it.'}`,
  };
  if (compress) {
    const root = path[path.length - 1];
    for (const i of path) parent[i] = root;
    yield {
      state: snapshot(),
      highlight: { found: [`v${root}`], active: path.slice(0, -1).map((i) => `pe${i}`) },
      explanation: `Compressed: everything ${probe} touched now points straight at root ${root}. The NEXT find on any of these is one hop. Every find flattens the structure a little more — the data structure repairs itself as a side effect of being used.`,
    };
  }

  // the payoff: cycle detection
  const ta = 3;
  const tb = 6;
  yield {
    state: snapshot(),
    highlight: { compare: [`v${ta}`, `v${tb}`] },
    explanation: `The classic payoff. Suppose elements are cities and we're adding roads one by one: should we build road (${ta}, ${tb})? Ask Union-Find: find(${ta}) = ${rootOf(ta)}, find(${tb}) = ${rootOf(tb)} — ${rootOf(ta) === rootOf(tb) ? 'SAME root: these cities are already connected, so this road would create a CYCLE. Skip it. That single check, run over edges sorted by cost, is Kruskal\'s minimum spanning tree algorithm in its entirety.' : 'different roots, safe to add.'}`,
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `With both tricks (union by size + path compression), m operations cost O(m·α(n)) where α is the inverse Ackermann function — at most 4 for any n that fits in this universe. Effectively constant time. This is how compilers group equivalent variables, how image editors flood-fill regions, how networks test connectivity, and how Kruskal builds cheapest networks. Two arrays and two tricks.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Union-Find, also called disjoint-set union, maintains a changing collection of groups. It supports two operations: find(x), which returns the representative root of x's group, and union(a, b), which merges two groups. The representation is deliberately small: a parent array says where each node points, and a size array says how large each root's tree is. The visualization starts with eight elements, then performs unions such as (0,1), (2,3), and (1,5) so you can watch separate sets become one component.`,
        `This data structure is about connectivity, not distance. If two nodes have the same root, they are connected somehow. If roots differ, no known connection joins them yet. That is why Union-Find (Disjoint Sets) is the engine inside Kruskal's Minimum Spanning Tree: every candidate road asks one question, "would this edge connect two different groups, or close a cycle?"`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `find(x) follows parent pointers until it reaches a root, where parent[root] equals root. union(a, b) first finds both roots. If they already match, the merge would do nothing. If they differ, union by size attaches the smaller tree's root under the larger one. A tree's height only grows when its component at least doubles, so union by size alone gives logarithmic height.`,
        `Path compression is the second trick. During find, after walking from x up to the root, repoint every node on that path directly to the root. The demo's toggle shows the difference: with compression on, a later lookup over the same path becomes nearly flat. Together, union by size and path compression give amortized O(alpha(n)) operations, where alpha is the inverse Ackermann function. For any realistic n, alpha(n) is at most 4 or 5, which is effectively constant for Big-O Growth Rates at human scale.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `For m operations on n elements, union by size plus path compression costs O(m alpha(n)) total time and O(n) space. With union by size but no compression, each operation is O(log n). Without these rules, a careless implementation can build a chain and make find O(n). Union-Find is faster than Graph BFS when you repeatedly ask connectivity questions after edges are added, but it cannot answer shortest paths; Dijkstra's Shortest Path and Binary Heap (Priority Queue) solve a different problem.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Kruskal's Minimum Spanning Tree is the classic application, but the pattern appears anywhere equivalence classes grow over time. Compilers use related union structures for Unification Union-Find Type Constraints and alias analysis. Image processing can label connected components by unioning neighboring pixels. Percolation simulations union open grid cells to ask whether a path spans the system. Offline graph algorithms answer batches of connectivity queries quickly after sorting or grouping events. Hash Table often appears beside Union-Find when elements are names or objects rather than dense integer IDs.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest pitfall is unioning nodes instead of roots. Always find both roots first, then attach one root to the other. Another misconception is that path compression instantly makes the whole forest flat. It only compresses paths touched by find; untouched branches remain as they were until queried. Also remember the limitation: Union-Find handles incremental connectivity. It does not naturally support deleting edges, and it does not know weights, routes, or counts inside a component unless you store extra metadata at roots.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Kruskal's Minimum Spanning Tree next, because it uses this exact cycle check. Then compare Graph BFS and Dijkstra's Shortest Path: both explore graphs, but they answer reachability and shortest-path questions rather than dynamic grouping. Review Tree Traversals for parent-pointer intuition, Hash Table for mapping arbitrary labels to integer IDs, Binary Heap (Priority Queue) for the other graph-algorithm workhorse, and Unification Union-Find Type Constraints for the compiler use of equivalence classes.`,
      ],
    },
  ],
};
