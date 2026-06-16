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
  yield {
    state: hldGraph('Pick one heavy child per node by largest subtree'),
    highlight: { active: ['r', 'a', 'c', 'g', 'e-r-a', 'e-a-c', 'e-c-g'], compare: ['b', 'd', 'h'] },
    explanation: 'Heavy-light decomposition roots a tree, computes subtree sizes, and marks the largest child edge from each node as heavy. All other child edges are light.',
    invariant: 'A light edge always goes to a subtree at most half the size of its parent subtree.',
  };

  yield {
    state: hldGraph('Heavy edges form disjoint chains'),
    highlight: { active: ['r', 'a', 'c', 'g', 'b', 'e', 'e-r-a', 'e-a-c', 'e-c-g', 'e-b-e'], found: ['array'] },
    explanation: 'Following heavy edges creates chains. Each vertex belongs to exactly one chain, and every chain can be laid out contiguously in a base array.',
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
    explanation: 'Once chains are contiguous, a Segment Tree or Fenwick Tree can answer range queries over each chain segment. Tree path queries become a small number of array range queries.',
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
    explanation: 'The proof is the data structure. Every time a path crosses a light edge, the remaining subtree size at least halves, so a path crosses only logarithmically many chains.',
  };
}

function* pathQuery() {
  yield {
    state: hldGraph('Query path from node 8 to node 6'),
    highlight: { active: ['g', 'c', 'a', 'r', 'b', 'e', 'e-c-g', 'e-a-c', 'e-r-a', 'e-r-b', 'e-b-e'], found: ['seg'] },
    explanation: 'To query a path, repeatedly compare chain heads. Move the deeper chain head upward, querying that chain interval in the base array, until both nodes are on the same chain.',
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
    explanation: 'The query path is not stored as one contiguous array interval. HLD makes it a small list of contiguous intervals, each handled by the same range data structure.',
    invariant: 'Each loop iteration crosses one light edge or finishes inside one chain.',
  };

  yield {
    state: hldGraph('Point updates become array updates'),
    highlight: { active: ['array', 'seg', 'e-array-seg'], compare: ['d', 'f'] },
    explanation: 'Updating a vertex or edge weight updates one base-array position. The segment tree recomputes aggregates, and all future path queries see the new value.',
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
    explanation: 'The complete case-study rule: use HLD when the tree topology is fixed but vertex or edge values change and path queries are frequent.',
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
      heading: 'What it is',
      paragraphs: [
        'Heavy-light decomposition is a technique for answering path queries on a static rooted tree. It partitions the tree into heavy paths and light edges so any path can be expressed as O(log n) contiguous ranges in a base array.',
        'The structure is a bridge between tree algorithms and array data structures. Once nodes or edges are laid out by chains, Segment Tree and Fenwick Tree machinery can handle updates and range queries.',
        'This is a common pattern in serious data-structure design: preserve the original object for correctness, then build a second coordinate system where the hot operation is easy. HLD keeps the tree, but it makes tree paths look like a handful of array intervals.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First run a DFS to compute subtree sizes. For each node, mark the child with largest subtree as the heavy child. All other child edges are light. A second DFS assigns chain heads and positions in a base array, keeping each heavy path contiguous.',
        'For a path query u to v, compare chain heads. While the heads differ, query the deeper head-to-node segment and move that node to the parent of its chain head. When both nodes share a chain, query the remaining contiguous interval.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preprocessing is O(n). Each path crosses O(log n) light edges because crossing a light edge at least halves the remaining subtree size. With a segment tree on chain positions, many path queries cost O(log^2 n), or O(log n) with extra prefix tricks for some operations.',
        'The implementation details are mostly indexing. You must decide whether values live on vertices or edges, how to map an edge to its deeper endpoint, and whether intervals are inclusive or exclusive.',
        'The decomposition is stable only as long as the tree topology is stable. Changing one edge can alter subtree sizes and heavy-child choices throughout a region. That is why dynamic-forest structures exist even though HLD is often simpler and faster for static trees.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
      'HLD appears in network path analytics, game trees, compiler dominator-tree annotations, organizational hierarchies, file-system trees, and contest problems with changing weights on a fixed topology.',
      'A complete case study is a backbone network represented as a tree of failover links. Link capacities change, and operators ask for the bottleneck capacity between two routers. HLD maps the router path to a few segment-tree max or min queries.',
      'If each query touches only a small marked subset rather than arbitrary paths, Virtual Tree LCA Compression can be a better fit. It keeps only marked nodes and LCAs, while HLD keeps a reusable path-query coordinate system for the whole tree.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'HLD does not handle link and cut topology changes by itself. If the tree changes structurally, use Link-Cut Tree or Euler Tour Tree. HLD also does not replace LCA; most implementations use depth and chain heads, and many include an LCA-style final step.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
      'References: CP-Algorithms heavy-light decomposition at https://cp-algorithms.com/graph/hld.html and USACO Guide HLD notes at https://usaco.guide/plat/hld. Study Virtual Tree LCA Compression, Segment Tree, Fenwick Tree, Sparse Table, Link-Cut Tree, and Euler Tour Tree next.',
      ],
    },
  ],
};
