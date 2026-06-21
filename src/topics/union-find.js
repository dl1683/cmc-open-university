// Union-Find (disjoint sets): answer "are these two connected?" in near
// constant amortized time using parent pointers, union by size, and path compression.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'union-find',
  title: 'Union-Find (Disjoint Sets)',
  category: 'Data Structures',
  summary: 'Merge groups and test connectivity in near-constant time with parent pointers and two balancing tricks.',
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
    explanation: `${N} elements start alone. Union-Find supports two operations: union(a, b) merges two groups, and find(x) returns the root that names x's group. Same root means same connected component.`,
  };

  for (const [a, b] of UNIONS) {
    const pathA = pathOf(a);
    const pathB = pathOf(b);
    const ra = pathA[pathA.length - 1];
    const rb = pathB[pathB.length - 1];
    yield {
      state: snapshot(),
      highlight: { active: [...new Set([...pathA, ...pathB])].map((i) => `v${i}`) },
      explanation: `union(${a}, ${b}) first finds roots. ${a} reaches ${ra}${pathA.length > 1 ? ` through ${pathA.join(' -> ')}` : ''}; ${b} reaches ${rb}${pathB.length > 1 ? ` through ${pathB.join(' -> ')}` : ''}. Only roots should be attached.`,
    };
    const [small, big] = size[ra] <= size[rb] ? [ra, rb] : [rb, ra];
    parent[small] = big;
    size[big] += size[small];
    yield {
      state: snapshot(),
      highlight: { active: [`pe${small}`], found: [`v${big}`] },
      explanation: `Attach the smaller root ${small} under the larger root ${big}. This is union by size: a tree only gets deeper when it joins a component at least as large as itself.`,
      invariant: 'Tree height grows only when the component size at least doubles.',
    };
  }

  const probe = 1;
  const path = pathOf(probe);
  yield {
    state: snapshot(),
    highlight: { active: path.map((i) => `v${i}`) },
    explanation: `find(${probe}) walks ${path.join(' -> ')} to the root. ${compress ? 'With path compression on, the return trip rewires every touched node directly to the root.' : 'With path compression off, repeated finds keep paying for the same path.'}`,
  };
  if (compress) {
    const root = path[path.length - 1];
    for (const i of path) parent[i] = root;
    yield {
      state: snapshot(),
      highlight: { found: [`v${root}`], active: path.slice(0, -1).map((i) => `pe${i}`) },
      explanation: `Compressed: every node touched by find(${probe}) now points straight at root ${root}. The data structure becomes flatter as a side effect of normal queries.`,
    };
  }

  const ta = 3;
  const tb = 6;
  yield {
    state: snapshot(),
    highlight: { compare: [`v${ta}`, `v${tb}`] },
    explanation: `Cycle check: before adding road (${ta}, ${tb}), compare roots. find(${ta}) = ${rootOf(ta)} and find(${tb}) = ${rootOf(tb)}. ${rootOf(ta) === rootOf(tb) ? 'Same root means the road would connect a component to itself, creating a cycle. Kruskal skips it.' : 'Different roots means the road connects two components, so it is safe to add.'}`,
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'With union by size plus path compression, a long sequence of operations is effectively constant time per operation in practice. The structure is only two arrays, but the amortized behavior is strong enough for massive connectivity workloads.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each circle is an element. Arrows point from child to parent. A node whose arrow points to itself is a root -- the name of its component. The number in parentheses at a root is the component size. What you see is a forest of parent-pointer trees, not the original graph.',
        {
          type: 'callout',
          text: 'Union-Find is fast because component identity is a root pointer, and tree shape can change without changing the partition.',
        },
        'During a union, highlighted nodes trace the find paths from both arguments up to their roots. If the two roots differ, the smaller-tree root gets attached under the larger-tree root -- that edge flashes as "found." If the roots match, the elements were already connected and nothing changes.',
        'When path compression fires after a find, every node on the walked path gets its arrow repointed straight to the root. Watch how the tree flattens: future finds on any of those nodes will cost a single hop instead of retracing the whole path.',
      
        {type: 'image', src: './assets/gifs/union-find.gif', alt: 'Animated walkthrough of the union find visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A surprising number of problems boil down to one question: are these two things in the same group? Roads connect towns. Wires connect terminals. Edges connect vertices. Type constraints connect variables. Each new connection merges two groups. No connection ever splits a group apart.',
        'Galler and Fischer formalized this in 1964: maintain a partition of n elements that supports two operations -- union (merge two groups) and find (return the group name). The structure they proposed uses parent-pointer trees and a size heuristic. The MST algorithm from Kruskal, published a decade earlier, needed exactly this: process edges in weight order and ask "would this edge create a cycle?" -- which is the same as "are the endpoints already in the same component?"',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store the graph as an adjacency list. To check whether A and B are connected, run BFS or DFS from A. If the search reaches B, they share a component. Correct and simple. Cost: O(V + E) per query, where V is the vertex count and E is the number of edges added so far.',
        'Alternative: assign every element a component ID in a flat array. Queries cost O(1) -- compare two array entries. But merging two components means rewriting every member of one component to the ID of the other. If the smaller component is always rewritten into the larger, total rewrite work across n merges is O(n log n). Better, but each individual merge can still touch a large fraction of the array.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'BFS/DFS re-explores the same connected regions on every query. After thousands of edges, the graph is large and each query walks most of it. The structure learns nothing from previous queries -- it forgets all the connectivity it already proved.',
        'The flat-ID approach has the mirror problem: queries are instant, merges are expensive. Neither scheme delivers cheap queries and cheap merges at the same time. Union-Find delivers both.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent each component as a rooted tree made of parent pointers. A root r has parent[r] = r. Every other node x has parent[x] pointing one step closer to the root. Two elements are in the same component exactly when following parent pointers from both leads to the same root. The root is the component name.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Dsu_disjoint_sets_final.svg', alt: 'Disjoint-set forest after several union operations', caption: 'The forest view shows that connectivity lives in parent-pointer trees, not in the original graph edges. Source: Wikimedia Commons, David Eppstein, CC BY-SA 3.0.'},
        'The key freedom: the tree shape does not matter -- only the partition does. Two trees with different shapes but the same root-to-element mapping encode identical connectivity. This means the structure can reshape its trees at will to speed up future operations, without changing any answer. Path compression exploits exactly this freedom.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The entire structure is two arrays. parent[0..n-1]: every element points to its parent; roots point to themselves. rank[0..n-1]: an upper bound on subtree height, stored at roots. Initially parent[i] = i and rank[i] = 0 for every element.',
        'find(x): chase parent pointers from x until you hit a root r (where parent[r] = r). That root is the component name. Path compression: on the way back, repoint every node you visited directly to r. The next find on any of those nodes costs one step.',
        'union(a, b): compute rootA = find(a) and rootB = find(b). If they match, a and b are already connected -- done. Otherwise, attach the root with smaller rank under the root with larger rank (union by rank). If ranks are equal, pick one as child and increment the winning root rank. This keeps trees shallow.',
        'The two heuristics -- path compression and union by rank -- reinforce each other. Path compression flattens trees as a side effect of ordinary queries. Union by rank prevents tall trees from forming in the first place. Together they achieve amortized O(alpha(n)) per operation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness: two elements share a component if and only if their find paths reach the same root. Union preserves this because it only links one root under another. Every node that reached the old root still reaches it, and that old root now reaches the new root, so all nodes in both components converge on the surviving root. No outside component gains a pointer into this tree.',
        'Path compression preserves the invariant. Every node on a find path already reaches the root. Repointing each node directly to the root shortens the path but does not change which root is reached. The partition is unchanged.',
        'Union by rank keeps trees shallow through a doubling argument. Node depth increases only when its tree merges under a tree of equal or greater rank. For that to happen, the merged tree must be at least as large, so the component at least doubles. A component of n elements can double at most log2(n) times, bounding tree height at log2(n) even without compression.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: m operations on n elements cost O(m * alpha(n)) total. alpha is the inverse Ackermann function. It grows so slowly that alpha(n) <= 4 for any n that could fit in the observable universe -- concretely, for any n below 2^(2^(2^(2^16))). In practice, every find and union is effectively O(1).',
        'Tarjan proved in 1975 that this bound is optimal: no pointer-based union-find structure can beat O(m * alpha(n)) in the worst case. You cannot do better with this interface.',
        'Without path compression, union by rank alone gives O(log n) per find. Without union by rank, path compression alone also gives O(log n) amortized. You need both heuristics together to reach the inverse Ackermann bound. Dropping either costs a logarithmic factor.',
        'Space: O(n) -- one parent entry and one rank entry per element. The two arrays are contiguous and cache-friendly. When n doubles, runtime per operation does not visibly change because alpha(n) stays at the same small constant.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Kruskal MST: sort edges by weight, then process each edge (u, v). If find(u) != find(v), accept the edge and union the endpoints. If roots match, the edge would close a cycle -- skip it. Union-Find makes this cycle check nearly free, so the total cost of Kruskal is dominated by the edge sort: O(E log E).',
        'Online connected components: as edges arrive one at a time, union their endpoints. At any moment, find(a) == find(b) answers "are a and b connected?" in O(alpha(n)). No graph traversal needed.',
        'Image segmentation: treat each pixel as an element. Merge adjacent pixels whose colors are similar enough. The resulting components are the segments. Union-Find handles millions of pixels without breaking a sweat because each merge is effectively constant time.',
        'Hindley-Milner type inference: unification merges type variables that must be equal. Each type constraint is a union. Checking whether two types are already unified is a find. Compilers for ML, Haskell, and Rust rely on this.',
        'Percolation: on an n-by-n grid, open cells randomly and union adjacent open cells. Check whether any top-row cell shares a root with any bottom-row cell. The critical threshold for site percolation on a square lattice is approximately p = 0.593.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No un-union. Once two components merge, there is no way to split them. The structure does not remember which edge caused the connection or whether alternative paths exist. If your problem needs edge deletion -- fully dynamic connectivity -- you need link-cut trees or Euler tour trees, both at O(log n) per operation.',
        'No member enumeration. Finding every element in a given component requires scanning the entire parent array: O(n). Applications that need member lists must maintain a separate linked list or set per component alongside the DSU.',
        'No path or distance information. Same root means connected, nothing more. If you need the actual path between two nodes, the shortest distance, or the minimum cut, you must keep a full graph representation alongside Union-Find.',
        'Rollback DSU handles some offline problems where the operation sequence is known in advance, but it must sacrifice path compression and falls back to O(log n) per operation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Six elements: {0, 1, 2, 3, 4, 5}. Start: parent = [0, 1, 2, 3, 4, 5], rank = [0, 0, 0, 0, 0, 0]. Every element is its own root. Six singleton trees.',
        'union(0, 1): find(0) = 0, find(1) = 1. Different roots, equal rank. Attach 1 under 0, increment rank[0]. Now parent = [0, 0, 2, 3, 4, 5], rank = [1, 0, 0, 0, 0, 0]. The forest has five trees.',
        'union(2, 3): find(2) = 2, find(3) = 3. Attach 3 under 2. parent = [0, 0, 2, 2, 4, 5], rank = [1, 0, 1, 0, 0, 0]. Four trees.',
        'union(1, 2): find(1) walks 1 -> 0, root is 0. find(3) walks 3 -> 2, root is 2. Roots differ. rank[0] = rank[2] = 1, so attach 2 under 0 and increment rank[0]. parent = [0, 0, 0, 2, 4, 5], rank = [2, 0, 1, 0, 0, 0]. Path compression on find(3) repoints node 3 directly to root 0: parent = [0, 0, 0, 0, 4, 5]. Three trees. Elements {0, 1, 2, 3} share a component.',
        'Find(3) with path compression: 3 used to point to 2, which pointed to 0. After compression, 3 points directly to 0. The tree flattened from depth 2 to depth 1 for node 3. The next find(3) costs one hop instead of two.',
        'After further unions {4,5} and {3,4}: all six elements share root 0. Query connected(1, 5)? find(1) = 0, find(5) walks 5 -> 4 -> 0. Same root. Answer: yes. Path compression repoints 5 and 4 directly to 0 -- the tree is now almost completely flat.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Galler and Fischer, "An Improved Equivalence Algorithm" (1964) -- the original union-find paper, introducing parent-pointer trees with weighted union. Tarjan, "Efficiency of a Good but Not Linear Set Union Algorithm" (1975) -- proved the inverse Ackermann amortized bound for path compression. Tarjan and van Leeuwen, "Worst-Case Analysis of Set Union Algorithms" (1984) -- tightened the bound and analyzed variants including path splitting and path halving.',
        'Study next: Kruskal MST algorithm (the primary Union-Find client -- provides the cycle check that makes sorted-edge processing work), graph BFS/DFS (the O(V+E)-per-query alternative that Union-Find replaces for connectivity), percolation (the probabilistic application that makes near-constant-time Union-Find merges essential at scale), and link-cut trees (the fully dynamic connectivity structure for problems that need edge deletion).',
      ],
    },
  ],
};
