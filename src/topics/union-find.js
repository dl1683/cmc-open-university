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
        'Each circle is an element, and each arrow points from a child to its parent. A root is a node whose parent is itself, and the root acts as the name of the connected component.',
        {
          type: 'callout',
          text: 'Union-Find is fast because component identity is a root pointer, and tree shape can change without changing the partition.',
        },
        'Active paths show find operations walking upward to roots. Found edges show union operations linking one root under another, and path compression rewires visited nodes directly to the root.',
        {
          type: 'image',
          src: './assets/gifs/union-find.gif',
          alt: 'Animated walkthrough of the union find visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Union-Find, also called disjoint set union, maintains groups that only merge. It answers whether two elements are already in the same group while new connections arrive over time.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep the graph and run BFS or DFS for every connectivity query. BFS and DFS are graph searches that explore edges until they either reach the target or exhaust the component.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated exploration. After 100,000 edges, a query may walk most of the graph even if previous queries already proved the same region connected.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store each component as a tree of parent pointers. Two elements are connected exactly when find reaches the same root for both elements.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Dsu_disjoint_sets_final.svg',
          alt: 'Disjoint-set forest after several union operations',
          caption: 'The forest view shows that connectivity lives in parent-pointer trees, not in the original graph edges. Source: Wikimedia Commons, David Eppstein, CC BY-SA 3.0.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The parent array stores one pointer per element. Initially parent[i] = i for every i, so every element is its own singleton component.',
        'find(x) follows parent pointers until it reaches a root. During path compression, it rewrites every node on that path to point directly at the root.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every element reaches exactly one root, and that root names its component. Union preserves the invariant by linking only roots, so two old components become one and no outside component is changed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With path compression and union by rank, m operations on n elements cost O(m alpha(n)) total. The inverse Ackermann function alpha grows so slowly that it is at most a tiny constant for any realistic input.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Kruskal\'s minimum spanning tree algorithm sorts edges by weight and uses Union-Find to skip edges whose endpoints are already connected. Online connectivity, percolation, pixel grouping, account merge, and type-variable equality use the same merge-only component model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Union-Find cannot delete edges or split components. It also cannot list component members or return the path between two nodes without extra data.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with elements 0 through 5, so parent = [0, 1, 2, 3, 4, 5]. After union(0, 1), attach 1 under 0, giving parent = [0, 0, 2, 3, 4, 5].',
        'After union(2, 3), parent = [0, 0, 2, 2, 4, 5]. Then union(1, 3) finds root 0 for 1 and root 2 for 3, links root 2 under root 0, and makes 0, 1, 2, and 3 one component.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Galler and Fischer, An Improved Equivalence Algorithm (1964), and Tarjan, Efficiency of a Good but Not Linear Set Union Algorithm (1975). Then study BFS, DFS, Kruskal MST, link-cut trees, and rollback DSU.',
      ],
    },
  ],
};
