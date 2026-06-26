// Heavy-light decomposition: convert tree paths into O(log n) array ranges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'heavy-light-decomposition',
  title: 'Heavy-Light Decomposition',
  category: 'Data Structures',
  summary: 'Split a rooted tree into heavy paths so any root-to-node path crosses only O(log n) light edges, reducing path queries to array ranges.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build chains', 'path query'], defaultValue: 'build chains' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function hldGraph(title) {
  return graphState({
    nodes: [
      { id: 'r', label: '1 root', x: 4.6, y: 0.8, note: 'size 9' },
      { id: 'a', label: '2', x: 2.6, y: 2.4, note: 'heavy child' },
      { id: 'b', label: '3', x: 6.6, y: 2.4, note: 'light child' },
      { id: 'c', label: '4', x: 1.6, y: 4.2, note: 'heavy child' },
      { id: 'd', label: '5', x: 3.6, y: 4.2, note: 'light child' },
      { id: 'e', label: '6', x: 5.8, y: 4.2, note: 'heavy child' },
      { id: 'f', label: '7', x: 7.4, y: 4.2, note: 'light child' },
      { id: 'g', label: '8', x: 1.0, y: 6.0, note: 'heavy child' },
      { id: 'h', label: '9', x: 2.4, y: 6.0, note: 'light child' },
      { id: 'array', label: 'base array', x: 8.7, y: 1.2, note: 'chain positions' },
      { id: 'seg', label: 'segment tree', x: 8.7, y: 3.8, note: 'range max/sum' },
    ],
    edges: [
      { id: 'e-r-a', from: 'r', to: 'a', weight: 'heavy' },
      { id: 'e-r-b', from: 'r', to: 'b', weight: 'light' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: 'heavy' },
      { id: 'e-a-d', from: 'a', to: 'd', weight: 'light' },
      { id: 'e-b-e', from: 'b', to: 'e', weight: 'heavy' },
      { id: 'e-b-f', from: 'b', to: 'f', weight: 'light' },
      { id: 'e-c-g', from: 'c', to: 'g', weight: 'heavy' },
      { id: 'e-c-h', from: 'c', to: 'h', weight: 'light' },
      { id: 'e-chain-array', from: 'a', to: 'array', weight: 'linearize chains' },
      { id: 'e-array-seg', from: 'array', to: 'seg', weight: 'range structure' },
    ],
  }, { title });
}

function* buildChains() {
  const n = 9;
  const heavyEdges = ['e-r-a', 'e-a-c', 'e-c-g', 'e-b-e'];
  const lightEdges = ['e-r-b', 'e-a-d', 'e-b-f', 'e-c-h'];
  const chainCount = 5; // [1-2-4-8], [3-6], [5], [7], [9]
  const maxLightCrossings = Math.ceil(Math.log2(n));

  yield {
    state: hldGraph('Pick one heavy child per node by largest subtree'),
    highlight: { active: ['r', 'a', 'c', 'g', 'e-r-a', 'e-a-c', 'e-c-g'], compare: ['b', 'd', 'h'] },
    explanation: `Heavy-light decomposition roots a ${n}-node tree, computes subtree sizes, and marks ${heavyEdges.length} heavy child edges. The remaining ${lightEdges.length} child edges are light.`,
    invariant: `A light edge always goes to a subtree at most half the size of its parent — so at most ${maxLightCrossings} light crossings on any root-to-leaf path.`,
  };

  yield {
    state: hldGraph('Heavy edges form disjoint chains'),
    highlight: { active: ['r', 'a', 'c', 'g', 'b', 'e', 'e-r-a', 'e-a-c', 'e-c-g', 'e-b-e'], found: ['array'] },
    explanation: `Following ${heavyEdges.length} heavy edges creates ${chainCount} chains across ${n} vertices. Each vertex belongs to exactly one chain, and every chain can be laid out contiguously in a base array.`,
  };

  yield {
    state: labelMatrix(
      'Base-array layout',
      [
        { id: 'chain1', label: 'chain 1' },
        { id: 'chain2', label: 'chain 2' },
        { id: 'chain3', label: 'chain 3' },
        { id: 'singletons', label: 'singletons' },
      ],
      [
        { id: 'nodes', label: 'nodes' },
        { id: 'arrayRange', label: 'array range' },
      ],
      [
        ['1-2-4-8', '[0,3]'],
        ['3-6', '[4,5]'],
        ['5', '[6,6]'],
        ['7,9', '[7,8]'],
      ],
    ),
    highlight: { found: ['chain1:arrayRange', 'chain2:arrayRange'], compare: ['singletons:nodes'] },
    explanation: `Once ${chainCount} chains are contiguous in the ${n}-position base array, a Segment Tree or Fenwick Tree can answer range queries over each chain segment. Tree path queries become at most ${maxLightCrossings} array range queries.`,
  };

  yield {
    state: labelMatrix(
      'Why light edges are few',
      [
        { id: 'start', label: 'start size n' },
        { id: 'light1', label: 'after 1 light edge' },
        { id: 'light2', label: 'after 2 light edges' },
        { id: 'bound', label: 'after k light edges' },
      ],
      [
        { id: 'subtree', label: 'subtree size' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['n', 'whole tree'],
        ['at most n/2', 'light child is not largest enough'],
        ['at most n/4', 'halves again'],
        ['at most n/2^k', 'only O(log n) possible'],
      ],
    ),
    highlight: { active: ['light1:subtree', 'light2:subtree'], found: ['bound:meaning'] },
    explanation: `The proof is the data structure. With ${n} nodes, every time a path crosses one of the ${lightEdges.length} light edges, the remaining subtree size at least halves — so a path crosses at most O(log ${n}) = ${maxLightCrossings} chains.`,
  };
}

function* pathQuery() {
  const pathFrom = 8;
  const pathTo = 6;
  const pathEdges = ['e-c-g', 'e-a-c', 'e-r-a', 'e-r-b', 'e-b-e'];
  const pathChainIntervals = 2; // chain1 [0,3] and chain2 [4,5]

  yield {
    state: hldGraph(`Query path from node ${pathFrom} to node ${pathTo}`),
    highlight: { active: ['g', 'c', 'a', 'r', 'b', 'e', 'e-c-g', 'e-a-c', 'e-r-a', 'e-r-b', 'e-b-e'], found: ['seg'] },
    explanation: `To query the ${pathEdges.length}-edge path from node ${pathFrom} to node ${pathTo}, repeatedly compare chain heads. Move the deeper chain head upward, querying that chain interval in the base array, until both nodes share a chain.`,
  };

  yield {
    state: labelMatrix(
      'Path 8 to 6 decomposes into ranges',
      [
        { id: 'part1', label: '8 up to 1' },
        { id: 'part2', label: '3 up to 6' },
        { id: 'join', label: 'edge 1-3' },
        { id: 'combine', label: 'combine' },
      ],
      [
        { id: 'range', label: 'range query' },
        { id: 'result' },
      ],
      [
        ['chain 1 [0,3]', 'max/sum segment'],
        ['chain 2 [4,5]', 'max/sum segment'],
        ['light edge jump', 'move head parent'],
        ['merge answers', 'path aggregate'],
      ],
    ),
    highlight: { active: ['part1:range', 'part2:range'], found: ['combine:result'] },
    explanation: `The path from ${pathFrom} to ${pathTo} is not one contiguous array interval. HLD decomposes it into ${pathChainIntervals} contiguous intervals, each handled by the same range data structure.`,
    invariant: `Each loop iteration crosses one light edge or finishes inside one of the ${pathChainIntervals} chain intervals.`,
  };

  yield {
    state: hldGraph('Point updates become array updates'),
    highlight: { active: ['array', 'seg', 'e-array-seg'], compare: ['d', 'f'] },
    explanation: `Updating a vertex or edge weight updates one base-array position out of ${pathEdges.length + 1} path nodes. The segment tree recomputes aggregates, and all future path queries see the new value.`,
  };

  yield {
    state: labelMatrix(
      'Choose a tree-query tool',
      [
        { id: 'hld', label: 'HLD' },
        { id: 'lct', label: 'Link-Cut Tree' },
        { id: 'ett', label: 'Euler Tour Tree' },
        { id: 'sparse', label: 'Sparse Table LCA' },
      ],
      [
        { id: 'topology', label: 'topology' },
        { id: 'best', label: 'best use' },
      ],
      [
        ['static', 'path updates and queries'],
        ['dynamic forest', 'online path aggregates'],
        ['dynamic forest', 'connectivity and components'],
        ['static', 'idempotent LCA/RMQ'],
      ],
    ),
    highlight: { found: ['hld:best', 'lct:best'], compare: ['sparse:best'] },
    explanation: `The complete case-study rule: use HLD when the tree topology is fixed but vertex or edge values change. With ${pathChainIntervals} chain intervals covering the ${pathFrom}-to-${pathTo} path, path queries stay efficient.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build chains') yield* buildChains();
  else if (view === 'path query') yield* pathQuery();
  else throw new InputError('Pick a heavy-light-decomposition view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the rooted tree from top to bottom. A heavy edge goes to the child with the largest subtree, and light edges go to the other children. Heavy edges form chains that become contiguous ranges in a base array.',
        {type: 'callout', text: 'Heavy-light decomposition turns a tree path into a few array ranges because every light edge at least halves the remaining subtree.'},
        {type: 'image', src: './assets/gifs/heavy-light-decomposition.gif', alt: 'Animated walkthrough of the heavy light decomposition visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Path queries on trees are awkward because a path is not usually contiguous in memory. Segment trees and Fenwick trees answer array ranges quickly, but a tree path can zigzag through ancestors. HLD exists to split any path into a small number of array intervals.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree diagram with a root and child nodes', caption: 'Heavy-light decomposition starts with rooted-tree structure before selecting preferred child edges. Source: Wikimedia Commons, Binary tree.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious query climbs edge by edge from both endpoints to their lowest common ancestor. That is fine for short paths. On a chain of 1,000,000 nodes, one path query can touch 1,000,000 edges.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is controlling fragmentation. A flattening that splits a path into O(n) pieces is no better than walking the path. Edge values and vertex values also have different lowest-common-ancestor inclusion rules, so boundaries matter.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Choose the largest child as heavy. Any light child has at most half the parent subtree; otherwise it would have been the largest child. A root-to-leaf path can cross only O(log n) light edges because the remaining subtree halves each time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Run one DFS to compute subtree sizes, parents, depths, and heavy children. Run a second DFS that follows heavy edges first and assigns base-array positions. Store each node chain head and position.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/16-node_Fenwick_tree.svg/500px-16-node_Fenwick_tree.svg.png', alt: 'Fenwick tree diagram showing indexed range-aggregation responsibility', caption: 'After decomposition, chain intervals can be served by an array range structure such as a Fenwick tree. Source: Wikimedia Commons, Fenwick tree.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each query loop removes one chain interval that lies exactly on the remaining path. When chain heads differ, the deeper chain head must be below the lowest common ancestor, so that whole interval is safe to aggregate and remove. When both endpoints share a chain, one final interval completes the path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preprocessing costs O(n) time and space for the DFS arrays, plus the range structure. A path query touches O(log n) chains, and each segment-tree query costs O(log n), so the common bound is O(log^2 n). Point updates cost O(log n) because one tree value maps to one array position.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HLD fits static trees with changing values and frequent path aggregates: network-tree bottlenecks, permission or ownership paths, game scene graphs, and competitive-programming path queries. The access pattern is many path sums, maximums, minimums, or xor queries over a fixed topology.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of server racks in a data center', caption: 'Tree paths appear in infrastructure hierarchies where capacity, ownership, or failure information must be aggregated quickly. Source: Wikimedia Commons, Wikimedia Foundation servers.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HLD fails when tree topology changes online, because subtree sizes, heavy choices, chain heads, and positions become stale. It is also too much machinery for simple static idempotent queries where binary lifting or sparse tables are enough.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a 9-node tree: 1 has children 2 and 3; 2 has children 4 and 5; 3 has children 6 and 7; 4 has children 8 and 9. Heavy edges are 1-2, 2-4, 4-8, and 3-6, giving chains [1,2,4,8], [3,6], [5], [7], and [9].',
        'Query path 8 to 6. First take chain [3,6] and jump from 6 to parent(3)=1. Now 8 and 1 share chain [1,2,4,8], so take that interval. Six tree nodes became two array ranges.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Sleator and Tarjan on heavy and light paths, then compare cp-algorithms implementation notes. Study lowest common ancestor, segment trees, Fenwick trees, Euler tours, and link-cut trees next.',
      ],
    },
  ],
};
