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
      heading: 'Why this structure exists',
      paragraphs: [
        `Union-Find exists for problems where objects keep merging into larger groups and the main question is whether two objects now belong to the same group. Roads connect towns, friendship links connect accounts, pixels connect regions, edges connect graph vertices, and compiler constraints connect type variables. The details differ, but the shape is the same: each new fact can only merge groups; it never splits one group back apart.`,
        `That monotone setting is narrower than general graph reachability, and that is exactly why the data structure is so fast. It does not try to remember every road, every friendship edge, or every proof step. It remembers the partition induced by all accepted merge events. Once two elements are in the same component, most clients only need that fact, not the full route between them.`,
      ],
    },
    {
      heading: 'The baseline and the wall',
      paragraphs: [
        `A simple baseline is to store the graph and run BFS or DFS every time someone asks whether two vertices are connected. That is correct, but it throws away the fact that past queries and past edges already established components. If there are many connectivity queries, the same regions of the graph get rediscovered again and again.`,
        `Another baseline gives every element a component id and rewrites the id of every member when two components merge. Queries become cheap because ids can be compared directly, but a merge can be expensive. If a large component is rewritten many times, the total work becomes the bottleneck. Union-Find is the compromise: it keeps merges cheap, keeps queries cheap, and lets a small amount of pointer structure stand in for the component id.`,
      ],
    },
    {
      heading: 'The public contract',
      paragraphs: [
        `The interface is deliberately small. find(x) returns a representative for the set containing x. union(a, b) merges the two sets if their representatives differ. connected(a, b) is just find(a) === find(b). Many libraries expose only those operations plus optional helpers such as size(x) or count().`,
        `The representative is not a meaningful leader. It is a name chosen by the data structure, usually the root of a tree. Clients must not depend on a particular representative unless the implementation explicitly promises one. After more unions or path compression, the same component may be represented by a different root in some implementations, while the partition itself remains correct.`,
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        `Union-Find represents each component as a rooted tree of parent pointers. For a root r, parent[r] equals r. For a non-root node x, parent[x] points to another node in the same component. Following parent pointers must eventually reach the root. The root is the representative returned by find.`,
        `The key invariant is partition equivalence: two elements are in the same set if and only if following parent pointers from both elements reaches the same root. Every optimization must preserve that invariant. The tree shape is not the abstract answer; it is only the encoding of the answer. That distinction is why path compression can freely reshape trees without changing connectivity.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The parent array is the main storage. A second array, often called size or rank, is stored at roots and used to decide which tree should become the child during a merge. To run union(a, b), the implementation first finds rootA and rootB. If they are equal, the operation is a no-op because the elements are already connected. If they differ, one root becomes the parent of the other root.`,
        `find(x) is the other half. It walks parent[x], parent[parent[x]], and so on until it reaches a root. With path compression, find then rewires every touched node directly to that root. In an iterative implementation, this can be done with one pass to discover the root and a second pass to rewrite the path. In a recursive implementation, the rewiring happens on the return from recursion.`,
      ],
    },
    {
      heading: 'Union by size and rank',
      paragraphs: [
        `If union always attaches the second root under the first root, an unlucky sequence can build a long chain. find then becomes linear in the number of elements. Union by size avoids that by attaching the smaller component under the larger component. Union by rank uses a height-like upper bound instead. Both rules keep trees shallow before compression has a chance to help.`,
        `The doubling argument is the useful mental model. A node becomes one level deeper only when its current component is attached under a component at least as large. Each time that happens, the size of the node's component at least doubles. A component can double only logarithmically many times before it reaches n elements, so union by size alone prevents the worst chain behavior.`,
      ],
    },
    {
      heading: 'Path compression',
      paragraphs: [
        `Path compression is the repair step that makes repeated queries almost free. If find(1) walks 1 to 0 to 2 to 6, every node on that path is already known to be in the component rooted at 6. Repointing 1, 0, and 2 directly to 6 preserves the set and removes future intermediate hops.`,
        `This is a rare optimization because it happens during a read-like operation. A find query asks for a representative, but the implementation mutates the internal forest while answering. That is safe in single-threaded code because the abstract partition does not change. In shared concurrent code, this detail matters because even queries write parent pointers and need the same memory-safety discipline as updates.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Correctness comes from preserving the root equivalence invariant. A union only attaches one root under another root after both roots have been found. Every node in the losing tree already reached the losing root, and the losing root now reaches the winning root, so every node in both old components reaches the same new root. No outside component gets a pointer into this tree, so unrelated components stay unrelated.`,
        `Path compression is correct for the same reason. Every node on a find path already reaches the root. Replacing its parent with that root gives it a shorter path to the same representative. The set of elements reaching each root does not change, so connected(a, b) gives the same answer before and after compression. Only later cost changes.`,
      ],
    },
    {
      heading: 'Cost model',
      paragraphs: [
        `With union by size or rank plus path compression, m operations on n elements take O(m alpha(n)) total time, where alpha(n) is the inverse Ackermann function. For realistic input sizes, alpha(n) is so small that people usually describe the operations as effectively constant time. The important word is amortized: a particular find can still walk several pointers, but that walk flattens the path for later operations.`,
        `Space is O(n): one parent entry per element and one size or rank entry per root. If the client uses strings, object references, account ids, or coordinates, production code usually maps those labels to dense integer ids with a hash table and then uses arrays for the DSU itself. The dense arrays are compact, predictable, and fast in tight graph algorithms.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose the stream says union(0, 1), union(2, 3), union(0, 2), and then asks whether 1 and 3 are connected. The first two unions create two two-element components. The third union compares the roots of 0 and 2, sees different representatives, and attaches one root under the other. Now find(1) and find(3) reach the same representative, so the query returns true.`,
        `Kruskal's minimum spanning tree algorithm uses the same pattern as a cycle test. Sort edges by weight. For each edge (u, v), compare find(u) and find(v). If the roots differ, the edge connects two components and can be accepted. If the roots match, u and v are already connected by accepted edges, so adding this edge would create a cycle and must be skipped.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Union-Find wins in incremental connectivity and equivalence-class problems: Kruskal MST, image connected-component labeling, percolation simulation, account merging, social cluster merging, duplicate detection, type unification, offline connectivity, and equation satisfiability. In all of these, the important event is that two names now mean the same group.`,
        `It also works well as a helper inside larger algorithms. The DSU does not need to understand edge weights, user profiles, image colors, or type syntax. It only answers the group question quickly. That narrow contract is a strength because it lets the surrounding algorithm keep the domain logic while Union-Find handles the merge bookkeeping.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Union-Find does not support ordinary online edge deletion. Once two components merge, the structure does not remember which specific edge made the merge possible or whether another path still exists after that edge disappears. Rollback DSU can handle some offline problems where operations are processed in a controlled order, but fully dynamic connectivity needs heavier structures.`,
        `It also does not answer distance, shortest path, minimum cut, route reconstruction, neighbor listing, or "how are these connected?" Same root means connected and nothing more. If the application needs a path, cost, or explanation, it must keep another graph representation or use a different algorithm.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Attach roots, not arbitrary nodes. Update size or rank only at the winning root. Treat size stored at a non-root as stale unless your implementation deliberately maintains it. Make find total over the known element set, and decide how new labels are registered before union is called.`,
        `Use an iterative find when the language has a small call stack or when hostile input could build tall trees before compression. Be explicit about indexing, because off-by-one bugs are common when problem statements number vertices from 1 but arrays are zero-based. In concurrent settings, either guard the DSU with synchronization or use a design that makes parent rewrites safe under the memory model.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The visual model shows the parent-pointer forest, not the original graph. That is the right abstraction to watch. During each union, the important moment is when two roots are compared and one root becomes a child of the other. During find, the important moment is the walk up to the representative.`,
        `Run the same sequence with compression disabled and then enabled. Without compression, old paths remain visible. With compression, a find query flattens the path it just used. The component membership stays the same across both views, which makes the central idea concrete: the tree shape is an implementation detail, while the partition is the answer.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Kruskal's Minimum Spanning Tree next because it uses Union-Find as its cycle detector. Then compare Graph BFS and Dijkstra's Shortest Path for cases where reachability or route cost matters more than component membership. Review Tree Traversals for parent-pointer intuition, Hash Table for mapping arbitrary labels to ids, Binary Heap for the other classic graph-algorithm helper, and Unification Union-Find Type Constraints for compiler-style equivalence classes.`,
      ],
    },
  ],
};
