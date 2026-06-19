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
      heading: 'How to read the animation',
      paragraphs: [
        'The build-chains view shows heavy-light classification on a sample tree. Highlighted edges are heavy -- they connect each node to its largest-subtree child. Dimmer edges are light. Following heavy edges produces chains; the base-array node shows that each chain has been assigned contiguous positions so an ordinary segment tree can serve range queries over tree data.',
        'The path-query view shows how a query from node 8 to node 6 decomposes. The algorithm does not walk every edge. It repeatedly picks the deeper chain head, queries that chain interval in the base array, jumps to the parent of the chain head, and stops when both endpoints share a chain. The segment-tree node is not a competing structure -- it is the range engine that answers each interval HLD selects.',
        {
          type: 'diagram',
          label: 'Heavy/light edge classification',
          text: [
            '            1 (size 9)',
            '          /H        \\L',
            '        2 (size 5)    3 (size 3)',
            '      /H      \\L     /H     \\L',
            '    4 (size 3)  5   6 (size 2) 7',
            '   /H    \\L',
            '  8       9',
            '',
            'H = heavy edge (to largest-subtree child)',
            'L = light edge (all other children)',
            '',
            'Chains: [1-2-4-8], [3-6], [5], [7], [9]',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Path queries on trees are awkward. A path between two nodes can zigzag through ancestors and descendants, and the nodes along it do not sit in one contiguous array interval. Segment trees and Fenwick trees are fast at range queries, but they need contiguous intervals to work.',
        'Heavy-light decomposition exists to bridge these two worlds. It lays a static tree into a flat array so that any path decomposes into O(log n) contiguous intervals. Each interval becomes a segment-tree query, turning an arbitrary tree-path aggregate into a small number of array-range operations.',
        'The technique was introduced by Sleator and Tarjan in 1983 as part of their work on self-adjusting data structures. It appears whenever the tree shape is fixed but values on nodes or edges change and path aggregates (max, min, sum, xor) must stay current.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to climb one edge at a time from both endpoints toward their LCA, accumulating the aggregate along the way. On a balanced tree this costs O(log n) per query, which is fine. On a skewed tree -- a path graph, a caterpillar, a star with long arms -- the path length can reach O(n), making each query linear.',
        'Another natural idea is an Euler tour. Flatten the tree into an array by recording entry and exit times. This works well for subtree queries because every subtree maps to one contiguous interval. But an arbitrary u-to-v path is not a single Euler-tour interval; it can span disjoint segments of the flattened array.',
        'Precomputing answers for every pair is O(n^2) space and breaks on updates. HLD avoids all three walls by guaranteeing a small number of intervals per path without precomputing pair answers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is controlling how many pieces a path becomes. Any tree-to-array flattening will split some paths into multiple intervals. If a decomposition creates O(n) fragments in the worst case, path queries are no faster than climbing edge by edge.',
        'The second wall is indexing discipline. Values can live on vertices or edges. Edge values are typically stored at the deeper endpoint. Whether the LCA position is included or excluded in the final same-chain interval differs between vertex-mode and edge-mode queries. One wrong boundary turns correct logic into off-by-one bugs.',
        'The third wall is operation compatibility. HLD composes with associative operations that can merge subpath answers in a fixed order. Non-associative or order-sensitive aggregates cannot be reassembled from fragments, and the segment tree layer cannot rescue the decomposition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Root the tree and run one DFS to compute subtree sizes. At each node, mark the child with the largest subtree as the heavy child. All other children are light. Heavy edges form maximal chains; each node belongs to exactly one chain.',
        'Run a second DFS to assign each chain a contiguous range of positions in a base array. Record for each node its chain head (the topmost node in its chain) and its position in the base array. Build a segment tree or Fenwick tree over this array.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// HLD construction: two DFS passes',
            'function buildHLD(adj, root) {',
            '  const n = adj.length;',
            '  const par = new Int32Array(n).fill(-1);',
            '  const depth = new Int32Array(n);',
            '  const sz = new Int32Array(n).fill(1);',
            '  const heavy = new Int32Array(n).fill(-1);',
            '  const head = new Int32Array(n);   // chain head',
            '  const pos = new Int32Array(n);    // base-array position',
            '  let timer = 0;',
            '',
            '  // DFS 1: sizes and heavy children',
            '  const stack1 = [[root, -1, false]];',
            '  while (stack1.length) {',
            '    const [u, p, returning] = stack1.pop();',
            '    if (returning) {',
            '      let maxSz = 0;',
            '      for (const v of adj[u]) {',
            '        if (v === p) continue;',
            '        sz[u] += sz[v];',
            '        if (sz[v] > maxSz) { maxSz = sz[v]; heavy[u] = v; }',
            '      }',
            '      continue;',
            '    }',
            '    par[u] = p; depth[u] = p < 0 ? 0 : depth[p] + 1;',
            '    stack1.push([u, p, true]);',
            '    for (const v of adj[u]) if (v !== p) stack1.push([v, u, false]);',
            '  }',
            '',
            '  // DFS 2: assign chains and positions',
            '  const stack2 = [[root, root]];',
            '  while (stack2.length) {',
            '    const [u, h] = stack2.pop();',
            '    head[u] = h; pos[u] = timer++;',
            '    // push light children first so heavy child is processed next',
            '    for (const v of adj[u]) {',
            '      if (v === par[u] || v === heavy[u]) continue;',
            '      stack2.push([v, v]); // light child starts a new chain',
            '    }',
            '    if (heavy[u] >= 0) stack2.push([heavy[u], h]);',
            '  }',
            '  return { par, depth, sz, heavy, head, pos };',
            '}',
          ].join('\n'),
        },
        'To query a path from u to v, compare chain heads. While the heads differ, query the segment tree over the interval [pos[head[deeper]], pos[deeper]], then move the deeper node to par[head[deeper]]. When both nodes share a chain, query the final interval between them. For edge-mode queries, exclude the LCA position from this last interval.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A light edge connects a parent to a child whose subtree is not the largest. That child subtree is at most half the parent subtree. Every time a root-to-leaf path crosses a light edge, the remaining subtree size at least halves. Since you can halve n only O(log n) times before reaching 1, any root-to-leaf path crosses at most O(log n) light edges and therefore touches at most O(log n) chains.',
        'An arbitrary u-to-v path goes up from u to the LCA and down from the LCA to v. Each half crosses at most O(log n) light edges, so the total path touches at most O(log n) chains. Each chain contributes one contiguous segment-tree query costing O(log n), giving O(log^2 n) per path query.',
        'Correctness of the aggregate follows from exact path coverage. Each loop iteration queries an interval that lies entirely on the u-to-v path and removes it from consideration before jumping upward. When both endpoints land on the same chain, the remaining interval completes the path. No edge is counted twice, no edge is missed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preprocessing takes O(n) time and space: two DFS passes plus building the segment tree. Each path query or path update costs O(log^2 n) -- at most O(log n) chain intervals, each answered by an O(log n) segment-tree operation. Point updates on a single vertex or edge cost O(log n) because they touch one base-array position.',
        'When n doubles, the chain-crossing bound grows by 1, and each segment-tree query grows by 1 comparison. In practice, paths cross far fewer than log n chains because most real trees are not maximally adversarial. The log^2 n bound is tight in the worst case but loose on average.',
        'Memory is O(n) for the six HLD arrays plus O(n) for the segment tree. This is far smaller than O(n^2) pairwise precomputation. Some implementations reduce O(log^2 n) to O(log n) by using a global segment tree with carefully ordered chain positions, eliminating the per-chain overhead.',
        {
          type: 'note',
          text: 'The O(log^2 n) cost assumes a standard segment tree. Replacing it with a structure that supports O(1) range queries on static data (like a sparse table for idempotent operations) can drop the per-query cost to O(log n), but then updates are no longer O(log n).',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HLD dominates on static trees with changing vertex or edge values and frequent path aggregates. A backbone network where link capacities change and operators need the bottleneck (minimum capacity) between two routers is a textbook fit: HLD maps the path to a few segment-tree min queries, and capacity updates touch one array position.',
        'In competitive programming, HLD is a standard tool for ICPC and Codeforces problems involving path queries with updates. Problems like SPOJ QTREE (query the max edge weight on a path, then update an edge), POJ 2763 (path sum with point updates), and Codeforces 343D (subtree + path operations) are classic HLD exercises. The technique composes cleanly with lazy propagation for range updates on paths.',
        {
          type: 'table',
          headers: ['Technique', 'Topology', 'Path queries', 'Subtree queries', 'Updates', 'Typical cost per query'],
          rows: [
            ['HLD + segment tree', 'Static', 'Yes', 'Yes', 'Point and range', 'O(log^2 n)'],
            ['Euler tour + segment tree', 'Static', 'No (subtree only)', 'Yes', 'Point and range', 'O(log n)'],
            ['Centroid decomposition', 'Static', 'Distance aggregates', 'No', 'Point only', 'O(log^2 n)'],
            ['Link-Cut Trees', 'Dynamic', 'Yes', 'No', 'Amortized splay', 'O(log n) amortized'],
          ],
        },
        'HLD also wins when you need both path queries and subtree queries on the same tree. Because the DFS ordering assigns each subtree a contiguous range in the base array, the same segment tree handles both path intervals and subtree intervals.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HLD fails when tree topology changes online. Adding or removing edges invalidates subtree sizes, heavy-child choices, chain assignments, and base-array positions. Rebuilding is O(n). For dynamic forests, Link-Cut Trees give O(log n) amortized path queries with structural changes, and Euler Tour Trees handle connectivity and component aggregates.',
        'It is the wrong tool for queries over a small marked subset of nodes rather than arbitrary paths. Virtual Tree (auxiliary tree) construction keeps only the marked nodes and their pairwise LCAs, giving O(k log k) per query where k is the subset size. HLD would waste work querying full chains that contain no marked nodes.',
        'It is overbuilt for static idempotent queries without updates. If the only operation is path maximum on a fixed tree and values never change, sparse tables with binary lifting give O(n log n) preprocessing and O(log n) queries without the segment-tree layer. HLD earns its complexity when updates or non-idempotent aggregates (like sum or xor) demand a live range structure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'We use a technique of dividing the tree into heavy and light paths... any path from a node to the root crosses at most log n light edges.',
          attribution: 'Sleator and Tarjan, "A Data Structure for Dynamic Trees," Journal of Computer and System Sciences, 1983',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Sleator and Tarjan, "A Data Structure for Dynamic Trees," JCSS 26(3), 1983. The paper introduces heavy-light decomposition as infrastructure for Link-Cut Trees.',
            'Implementation reference: CP-Algorithms, "Heavy-Light Decomposition," https://cp-algorithms.com/graph/hld.html -- clean pseudocode with both vertex and edge variants.',
            'Tutorial: USACO Guide, Platinum HLD module, https://usaco.guide/plat/hld -- worked problems with increasing difficulty.',
          ],
        },
        'Study Segment Trees and Fenwick Trees first if the range-query machinery is unfamiliar. Study LCA by binary lifting as a prerequisite for understanding chain-head comparisons. After HLD, study Link-Cut Trees for the dynamic-forest extension, Euler Tour Trees for dynamic connectivity, and centroid decomposition for distance-based path aggregates that do not need the chain structure.',
      ],
    },
  ],
};
