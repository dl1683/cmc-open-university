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
      heading: 'Why this exists',
      paragraphs: [
        'Path queries on trees are awkward because a path between two nodes can zig through ancestors and descendants. Array range structures are powerful, but a tree path is not usually one array interval.',
        'Heavy-light decomposition exists to turn any static-tree path into a small number of contiguous array ranges, so segment trees or Fenwick trees can do the heavy lifting.',
        'It is a bridge between two worlds. Trees express hierarchy, ancestry, ownership, and network topology. Arrays are where fast range data structures live. HLD gives the tree a layout that preserves enough path structure for array tools to work.',
        'The topic appears whenever the tree topology is fixed but values on nodes or edges change. A plain LCA structure can find the meeting point, but it cannot answer changing max, min, sum, xor, or custom path aggregates by itself.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to climb one edge at a time along the path and aggregate values. That can be O(length of path), which is too slow on deep trees.',
        'Another approach is to flatten the tree by Euler tour. That works well for subtree queries, but an arbitrary path is not generally one contiguous Euler interval.',
        'Precomputing every pair path answer is also a dead end for large trees. There are O(n^2) pairs, and updates would invalidate too much cached information. HLD avoids that by storing local range aggregates and decomposing each path at query time.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is controlling how many pieces a path becomes. If the decomposition creates too many chain fragments, each query is still expensive.',
        'The second wall is indexing. Values may live on vertices or edges, intervals may be inclusive or exclusive, and edge values are usually mapped to the deeper endpoint.',
        'The third wall is operation choice. HLD composes with associative range operations. If the desired query cannot be combined from subpath answers in a stable order, the segment tree layer will not save the decomposition.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'At each node, mark the child with largest subtree as heavy. All other child edges are light. Crossing a light edge at least halves the remaining subtree size, so any root-to-node path crosses only O(log n) light edges.',
        'Heavy edges form disjoint chains. Lay each chain contiguously in a base array. A tree path becomes a logarithmic number of array ranges.',
        'The decomposition is not trying to make every possible path one interval. That would be impossible for a branching tree. It is trying to guarantee a small number of intervals, which is enough because each interval can be answered by a segment tree or Fenwick tree.',
        'The heavy child choice is local but the guarantee is global. A node does not need to know future queries. It only needs subtree sizes so that every non-heavy descent loses at least half the remaining subtree.',
      ],
    },
    {
      heading: 'Animation Meaning',
      paragraphs: [
        'In the build-chains view, the heavy edges are the child choices with largest subtrees. Following those edges creates chains. The base-array node means the chain has been assigned contiguous positions, so an ordinary range data structure can work over tree data.',
        'In the path-query view, the chain heads drive the loop. The algorithm does not walk every edge from one endpoint to the other. It repeatedly takes the deeper chain, queries one contiguous interval, jumps to the parent of that chain head, and stops when both endpoints land on the same chain.',
        'The segment-tree node is not a separate tree algorithm competing with HLD. It is the range engine attached to the linearized chain positions. HLD decides which intervals to ask for; the segment tree answers those interval queries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Run one DFS to compute subtree sizes. Choose heavy children. Run a second DFS to assign chain heads and base-array positions. Build a segment tree or Fenwick tree over the base array.',
        'For path query u to v, compare chain heads. While they differ, query the deeper chain-head-to-node interval and move that node to the parent of its chain head. Once both nodes share a chain, query the final interval.',
        'Vertex values and edge values need slightly different layouts. Vertex values can live at the vertex position. Edge values are often stored at the deeper endpoint position, because each non-root vertex has exactly one parent edge. That convention keeps path intervals simple but makes LCA inclusivity important.',
        'For edge queries, the final same-chain interval usually excludes the LCA position because that position stores the edge from the LCA to its parent, not an edge on the path between u and v. For vertex queries, the LCA is usually included. This one distinction prevents many off-by-one errors.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because light edges are rare on any root path. If an edge is light, the child subtree is at most half the parent subtree, so the size can halve only O(log n) times.',
        'It also works because chain layout gives each heavy path array locality. The hard tree path is decomposed into easy array intervals.',
        'During a query, each loop iteration either finishes inside one chain or crosses a light edge by jumping above the current chain head. Since there are only O(log n) light edges on a root path, the number of chain intervals is logarithmic. Each interval query then pays the cost of the range structure.',
        'Correctness of the aggregate comes from covering the path exactly once. Every queried interval lies on the u-to-v path, and the jumps remove that interval from consideration before moving upward. When both endpoints share a chain, the remaining interval completes the path without overlap.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Store parent, depth, subtree size, heavy child, chain head, and position arrays explicitly. Keeping these arrays separate makes the query loop easier to audit and avoids hiding index rules inside recursive helper calls.',
        'Pick one convention for the base array and document it next to the query function. If edge weights live at the deeper endpoint, updateEdge(parent, child, value) should update pos[child]. If vertex weights live at vertices, updateVertex(v, value) should update pos[v].',
        'Test path queries where one node is ancestor of the other, both nodes are the same, the path crosses the root, the path stays inside one heavy chain, and the path crosses many light edges. Those cases expose chain-head comparison and LCA inclusivity mistakes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the sample tree, the chain 1-2-4-8 can occupy base-array positions [0, 3], and chain 3-6 can occupy [4, 5]. To query the path from 8 to 6, HLD first sees that the endpoints are on different chains. It queries the interval from 8 up to the head of its chain, then moves to the parent above that head.',
        'The query eventually handles the chain containing 6 and the light edge crossing near the root. The original tree path is split into a few array intervals. If the aggregate is max edge weight, each interval calls the segment tree for a range max and then combines the answers with max.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Preprocessing is O(n). With a segment tree on chain positions, many path queries and point updates cost O(log^2 n). Some operations can be optimized to O(log n) with prefix data per chain.',
        'The decomposition is stable only while topology is stable. Changing an edge can alter subtree sizes and heavy-child choices across a region. If topology changes often, rebuilding HLD may cost more than using a dynamic-tree structure.',
        'Implementation bugs usually come from indexing, not from the idea. Common mistakes include querying the LCA edge when edge values should exclude it, mixing zero-based and one-based positions, or using a non-associative operation in the segment tree.',
        'The memory cost is linear for HLD metadata plus the range structure. That is small compared with precomputing path answers, but it is still more state than a pure LCA table when the only query is ancestor lookup.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HLD wins on static trees with changing vertex or edge values and frequent path max, min, sum, xor, or custom associative queries.',
        'A complete case study is a backbone network tree. Link capacities change, and operators ask for the bottleneck between two routers. HLD maps the path to a few segment-tree min queries.',
        'It also wins in competitive programming and infrastructure-style hierarchy queries because it composes cleanly with LCA, segment trees, and Fenwick trees. You can update one node or edge and have future path queries reflect the new value without recomputing the whole tree.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when tree topology changes online. Link-Cut Trees or Euler Tour Trees are the dynamic-forest tools.',
        'It can also be the wrong tool when each query touches a small marked subset rather than arbitrary paths. Virtual Tree LCA Compression keeps only marked nodes and LCAs for that per-query shape.',
        'It is overbuilt for static idempotent path queries that can be answered with sparse tables or binary lifting. Use HLD when updates or non-idempotent aggregates make a live range structure valuable.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'References: CP-Algorithms heavy-light decomposition at https://cp-algorithms.com/graph/hld.html and USACO Guide HLD notes at https://usaco.guide/plat/hld. Study Virtual Tree LCA Compression, Segment Tree, Fenwick Tree, Sparse Table, Link-Cut Tree, and Euler Tour Tree next.',
      ],
    },
  ],
};
