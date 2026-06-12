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
        `Union-Find, also called Disjoint-Set Union (DSU), maintains a dynamic partition of elements into groups. It answers two core questions: (1) Are two elements in the same group? (2) Merge two groups into one. The data structure uses a forest of parent-pointer trees, where each tree represents one group, and the root of each tree is the canonical representative—the "name" of that group. Every element remembers its parent until it reaches a root.`,
        `The genius of Union-Find lies in two techniques that keep trees shallow. Union by size attaches smaller trees under larger ones, ensuring height grows only when a tree doubles in size—this alone guarantees O(log n) per operation. Path compression flattens trees as a side effect: whenever you walk up to a root, you repoint every node on that path directly to the root. Trees self-repair as you use them.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The structure is minimal: one array for parent pointers, one for the size of each tree. find(x) follows parent pointers until it hits a root (parent[r] === r). With compression, the walk back rewires all intermediate nodes to point at the root, flattening the tree. union(a, b) finds both roots, then attaches the smaller tree's root under the larger—this rule is the secret to logarithmic depth.`,
        `Why union by size works: When you attach a small tree to a large tree, the height of the large tree can only increase if the trees are equal size, which means the merged tree at least doubled. Since you start at size 1, a tree of size n has maximum height log₂(n). Path compression makes this even tighter in practice. After m operations mixing unions and finds with both optimizations active, the amortized cost approaches O(1)—the inverse Ackermann function α(n) factors in, and it is at most 4 for any n that fits in your computer.`,
        `Cycle detection, Union-Find's killer application: If elements represent cities and edges represent roads, you can build a minimum spanning tree by sorting roads by cost and asking Union-Find for each road, "Do these cities already have a path between them?" If find(a) === find(b), adding the road creates a cycle—skip it. This greedy algorithm is Kruskal's Minimum Spanning Tree, and it runs in O(m log m) time where m is the number of roads, dominated by sorting, not connectivity checks.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `find(x) without compression: O(h) where h is tree height; with compression: amortized O(α(n)) across all finds. union(a, b): O(find(a) + find(b)). For m mixed operations on n elements, total time is O(m α(n)), where α(n) ≤ 4 in practice—effectively constant. With union by size alone but no compression: still O(log n) per operation. With compression alone but no union by size: worst case O(log n), but worst case is rare. Together they are nearly optimal.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Kruskal's Minimum Spanning Tree: sort edges by cost, iterate through them, and ask Union-Find "Does adding this edge close a cycle?" If not, add it; if yes, skip it. When you have added n-1 edges, you have a tree connecting all n cities with minimum total cost. Compilers use Union-Find to track variable equivalence: "Are variables x and y aliased?"—if yes, propagate type information and constraints to the whole group. Image editors use it for flood fill: every pixel in a connected region is in the same group; painting one repaints the whole component instantly. Network routing tables group nodes by connectivity. Graph connectivity and dynamic connectivity queries rely on Union-Find to test whether two nodes are in the same connected component.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Forgetting that union by size is essential: without it, a linear chain of 2→1→3→4→5 can form if you always attach the second root under the first, making find(5) walk the whole chain. Union by size prevents this. Path compression alone is not enough to guarantee fast amortized time; both techniques are needed for the O(m α(n)) bound. Misconception: "Path compression makes trees a single level." It does not—you still walk from x to root, then repoint. On the second find you still walk to root, but it is one hop instead of many. The benefit accumulates across repeated operations. Another pitfall: ignoring that Union-Find only knows about connectivity, not edge weights or distances; for shortest path, you need Dijkstra's or another algorithm.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Union-Find shines in graph algorithms. Learn Graph BFS to explore all reachable nodes in unweighted graphs, then Dijkstra's Shortest Path to find shortest paths in weighted graphs—both use connectivity heavily. Priority queues (Binary Heap (Priority Queue)) are the engine inside Dijkstra. Study Tree Traversals to understand how to walk any hierarchical structure, then move to Tree data structures themselves. Finally, Hash Table covers the other workhorse of dynamic grouping and membership testing, complementing Union-Find's connectivity angle.`,
      ],
    },
  ],
};

