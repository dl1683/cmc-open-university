// Binary lifting LCA: jump pointers for ancestors at powers of two.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'binary-lifting-lca',
  title: 'Binary Lifting LCA',
  category: 'Data Structures',
  summary: 'Precompute 2^k ancestors for each tree node so kth-ancestor and lowest-common-ancestor queries run in O(log n).',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['jump table', 'lca query'], defaultValue: 'jump table' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function treeGraph(title) {
  return graphState({
    nodes: [
      { id: 'n1', label: '1 root', x: 4.7, y: 0.7, note: 'depth 0' },
      { id: 'n2', label: '2', x: 2.7, y: 2.4, note: 'depth 1' },
      { id: 'n3', label: '3', x: 6.7, y: 2.4, note: 'depth 1' },
      { id: 'n4', label: '4', x: 1.7, y: 4.1, note: 'depth 2' },
      { id: 'n5', label: '5', x: 3.7, y: 4.1, note: 'depth 2' },
      { id: 'n6', label: '6', x: 5.7, y: 4.1, note: 'depth 2' },
      { id: 'n7', label: '7', x: 7.7, y: 4.1, note: 'depth 2' },
      { id: 'jump', label: 'up[v][k]', x: 9.0, y: 2.4, note: 'jump table' },
    ],
    edges: [
      { id: 'e-1-2', from: 'n1', to: 'n2', weight: 'parent' },
      { id: 'e-1-3', from: 'n1', to: 'n3', weight: 'parent' },
      { id: 'e-2-4', from: 'n2', to: 'n4', weight: 'parent' },
      { id: 'e-2-5', from: 'n2', to: 'n5', weight: 'parent' },
      { id: 'e-3-6', from: 'n3', to: 'n6', weight: 'parent' },
      { id: 'e-3-7', from: 'n3', to: 'n7', weight: 'parent' },
      { id: 'e-table', from: 'n5', to: 'jump', weight: 'precompute' },
    ],
  }, { title });
}

function* jumpTable() {
  const rootId = 'n1';
  const baseLevel = 0;
  yield {
    state: treeGraph('Root the tree and record parent/depth'),
    highlight: { active: [rootId, 'n2', 'n3', 'e-1-2', 'e-1-3'], compare: ['jump'] },
    explanation: `Binary lifting starts with a rooted tree. DFS records depth and the immediate parent up[v][${baseLevel}] for every node.`,
    invariant: `up[v][k] means the 2^k-th ancestor of v, or null above the root at ${rootId}.`,
  };
  const jumpSizes = [1, 2, 4];
  yield {
    state: labelMatrix(
      'Jump table recurrence',
      [
        { id: 'base', label: 'up[v][0]' },
        { id: 'k1', label: 'up[v][1]' },
        { id: 'k2', label: 'up[v][2]' },
        { id: 'query', label: 'lift by d' },
      ],
      [{ id: 'formula', label: 'formula' }, { id: 'meaning' }],
      [
        ['parent[v]', `${jumpSizes[0]} step`],
        ['up[up[v][0]][0]', `${jumpSizes[1]} steps`],
        ['up[up[v][1]][1]', `${jumpSizes[2]} steps`],
        ['decompose d in binary', 'combine jumps'],
      ],
    ),
    highlight: { found: ['k1:formula', 'k2:formula'], active: ['query:meaning'] },
    explanation: `Each larger jump is two smaller jumps chained together — a jump of ${jumpSizes[2]} is two jumps of ${jumpSizes[1]}. That is the same doubling idea as sparse tables and binary exponentiation.`,
  };
  const node5Parent = 2;
  const node5Grandparent = 1;
  const maxColumns = 3;
  yield {
    state: labelMatrix(
      'Example table entries',
      [
        { id: 'n4', label: 'node 4' },
        { id: 'n5', label: 'node 5' },
        { id: 'n7', label: 'node 7' },
        { id: 'root', label: 'node 1' },
      ],
      [{ id: 'up0', label: '2^0' }, { id: 'up1', label: '2^1' }, { id: 'up2', label: '2^2' }],
      [
        [`${node5Parent}`, `${node5Grandparent}`, 'null'],
        [`${node5Parent}`, `${node5Grandparent}`, 'null'],
        ['3', `${node5Grandparent}`, 'null'],
        ['null', 'null', 'null'],
      ],
    ),
    highlight: { active: ['n5:up0', 'n5:up1'], compare: ['root:up0'] },
    explanation: `For node 5, the one-step ancestor is ${node5Parent} and the two-step ancestor is ${node5Grandparent}. Larger jumps past column ${maxColumns} are null because the root is reached.`,
  };
  const queryCost = 'O(log n)';
  const buildCost = 'O(n log n)';
  yield {
    state: labelMatrix(
      'Costs and uses',
      [
        { id: 'pre', label: 'preprocess' },
        { id: 'ancestor', label: 'kth ancestor' },
        { id: 'lca', label: 'LCA' },
        { id: 'path', label: 'path metadata' },
      ],
      [{ id: 'cost' }, { id: 'use' }],
      [
        [buildCost, 'build table'],
        [queryCost, 'jump by binary bits'],
        [queryCost, 'lift and converge'],
        [queryCost, 'max/min on jump edges'],
      ],
    ),
    highlight: { found: ['ancestor:cost', 'lca:cost'], compare: ['pre:cost'] },
    explanation: `Binary lifting preprocesses in ${buildCost} and answers each query in ${queryCost}, making it cheap memory for fast repeated tree ancestry queries on a fixed topology.`,
  };
}

function* lcaQuery() {
  const nodeU = 5;
  const nodeV = 7;
  const sharedDepth = 2;
  yield {
    state: treeGraph(`Find LCA(${nodeU}, ${nodeV})`),
    highlight: { active: ['n5', 'n7'], compare: ['n2', 'n3'], found: ['n1'] },
    explanation: `To find an LCA, first lift the deeper node so both nodes have the same depth. Here ${nodeU} and ${nodeV} already match at depth ${sharedDepth}.`,
  };
  const parentOfU = 2;
  const parentOfV = 3;
  const lcaNode = 1;
  yield {
    state: labelMatrix(
      'Lift both nodes from high powers down',
      [
        { id: 'start', label: `start ${nodeU},${nodeV}` },
        { id: 'try2', label: 'try 2^1' },
        { id: 'try1', label: 'try 2^0' },
        { id: 'answer', label: 'parent after loop' },
      ],
      [{ id: 'action' }, { id: 'result' }],
      [
        ['same depth', 'continue'],
        [`both jump to ${lcaNode}`, 'too far together'],
        [`${nodeU}->${parentOfU} and ${nodeV}->${parentOfV}`, 'different, accept'],
        [`parent(${parentOfU})=${lcaNode}`, `LCA is ${lcaNode}`],
      ],
    ),
    highlight: { active: ['try1:result'], found: ['answer:result'], compare: ['try2:result'] },
    explanation: `The loop tries big jumps first. If the two candidates after jumping are different (${parentOfU} and ${parentOfV}), both jumps are safe because the LCA is still above them.`,
    invariant: `During convergence, u and v stay below the LCA (node ${lcaNode}) until the final parent step.`,
  };
  const associativeOps = ['max edge', 'min edge', 'xor'];
  yield {
    state: treeGraph('LCA splits a tree path into two ancestor climbs'),
    highlight: { active: ['n5', 'n2', 'n1', 'n3', 'n7'], found: ['n1'], compare: ['jump'] },
    explanation: `Once LCA is known, a path query can be split into ${nodeU}-to-lca and ${nodeV}-to-lca. Jump-table metadata can accumulate ${associativeOps.join(', ')}, or other associative facts.`,
  };
  const tools = ['Binary Lifting', 'Heavy-Light', 'Euler + Sparse Table', 'Link-Cut Tree'];
  const queryCost = 'O(log n)';
  yield {
    state: labelMatrix(
      'Choose with neighboring tools',
      [
        { id: 'binary', label: tools[0] },
        { id: 'hld', label: tools[1] },
        { id: 'sparse', label: tools[2] },
        { id: 'dynamic', label: tools[3] },
      ],
      [{ id: 'best' }, { id: 'limit' }],
      [
        ['static ancestry', 'O(n log n) memory'],
        ['static path aggregates', 'more machinery'],
        ['static O(1) LCA', 'less flexible metadata'],
        ['dynamic topology', 'harder implementation'],
      ],
    ),
    highlight: { found: ['binary:best', 'hld:best'], compare: ['dynamic:limit'] },
    explanation: `${tools[0]} is the simplest strong default for static trees when ${queryCost} queries are good enough — ${tools.length - 1} alternatives exist for specialized needs.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'jump table') yield* jumpTable();
  else if (view === 'lca query') yield* lcaQuery();
  else throw new InputError('Pick a binary-lifting view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "jump table" view builds the ancestor lookup table column by column, showing how each 2^k entry is computed from two 2^(k-1) entries. The "lca query" view walks through a concrete LCA query on the same tree, showing the depth-equalization step and the high-to-low convergence loop. Use the play button or drag the slider to advance one frame at a time.',
        'Highlighted nodes are the ones being processed in the current step. Found highlights mark a result or confirmed value. Compare highlights mark entries being read to compute a new one. Follow the explanation text below each frame to see which recurrence or decision rule is firing.',
        {type: 'image', src: './assets/gifs/binary-lifting-lca.gif', alt: 'Animated walkthrough of the binary lifting lca visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A rooted tree defines a parent relationship: every node except the root has exactly one parent, and following parent pointers from any node eventually reaches the root. Two nodes u and v each trace a path upward, and those paths must meet because both end at the root. The deepest node where the paths first overlap is called the lowest common ancestor (LCA) of u and v. This concept matters whenever you need the nearest shared scope: the common directory of two files, the common manager of two employees, the common dominator of two basic blocks in a compiler.',
        'LCA queries appear in bulk. A compiler computing dominance frontiers may issue one query per phi-function insertion. A competitive-programming problem may ask 200,000 LCA queries on a 200,000-node tree. Walking parent pointers one step at a time would cost O(depth) per query, and depth can be as large as n - 1 on a chain-shaped tree. Binary lifting exists to answer each query in O(log n) time by caching ancestors at power-of-two distances.',
        {type: `callout`, text: `Binary lifting turns long ancestry walks into a small set of cached power-of-two jumps over a fixed tree.`},
        {type: `image`, src: `https://nthu-cp.github.io/NTHU-CPP/graph/image/lca/def.png`, alt: `Tree with two nodes and their lowest common ancestor highlighted.`, caption: `The LCA is the deepest shared ancestor of two rooted paths. (Source: nthu-cp.github.io)`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store parent[v] and depth[v] for every node. To find the kth ancestor of v, repeat v = parent[v] exactly k times. To find LCA(u, v), first lift the deeper node until both have the same depth, then walk both nodes upward one parent at a time until they land on the same node. The code is five lines. The correctness argument is immediate: two paths that reach the root must meet somewhere, and the first meeting point is the LCA.',
        'The cost is the problem. On a balanced binary tree with n nodes, depth is about log n, and this approach is fine. On a chain of n nodes (a degenerate tree where every node has one child), depth is n - 1. A single query LCA(leaf, leaf) costs O(n). If you have q queries, worst-case total cost is O(nq). For n = q = 200,000, that is 40 billion operations. The approach is correct but does not scale.',
        'You could store the full path from every node to the root, then compute the LCA by scanning both paths for the first divergence. This costs O(n) memory per node, or O(n^2) total, which is even worse. The fundamental issue is that parent pointers only let you climb one edge at a time. Binary lifting solves this by letting you climb many edges in a single table lookup.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that tree depth is adversarial. You cannot assume the tree is balanced. A chain, a caterpillar, or even a mostly-balanced tree with one long dangling path can force the naive climber into O(n) work per query. Any solution that moves one parent edge at a time has this vulnerability.',
        'A secondary wall appears with kth-ancestor queries. "What is the ancestor of node v that is exactly k edges above it?" The naive answer is to walk k steps. But k can be as large as the depth, so the same O(n) trap applies. If you solve kth-ancestor efficiently, LCA follows naturally, because LCA is fundamentally about climbing to the right height and then finding where two climbs converge.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every positive integer has a unique binary representation: 13 = 8 + 4 + 1, or in binary, 1101. A climb of 13 edges can be decomposed into a climb of 8, then 4, then 1. If you precompute up[v][k] = the ancestor exactly 2^k edges above v, then climbing any distance d requires at most floor(log2(d)) + 1 lookups instead of d one-step walks.',
        'The precomputation uses a single recurrence: up[v][k] = up[up[v][k-1]][k-1]. In words, the ancestor 2^k edges above v is the ancestor 2^(k-1) edges above the node that is already 2^(k-1) edges above v. A jump of 8 is two jumps of 4 chained together. A jump of 4 is two jumps of 2. A jump of 2 is two jumps of 1. The base case up[v][0] is just parent[v]. This doubling pattern is the same idea behind binary exponentiation (computing a^n in O(log n) multiplications) and sparse tables (precomputing range queries at power-of-two lengths).',
        'For LCA specifically, once you can climb to any height in O(log n), the algorithm becomes: equalize depths, then binary-search for the split point. The binary search works top-down through jump powers, accepting jumps only when the two nodes land on different ancestors, which guarantees you have not crossed the LCA.',
        {type: `image`, src: `https://nthu-cp.github.io/NTHU-CPP/graph/image/lca/binary_lifting_1.png`, alt: `Binary lifting jump recurrence over a rooted tree.`, caption: `A 2^i jump is two chained 2^(i-1) jumps. (Source: nthu-cp.github.io)`},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction starts with a DFS or BFS from the root. For every node v, record depth[v] (number of edges from root to v) and up[v][0] = parent[v]. The root\'s parent is a sentinel value, typically -1 or null, meaning "no such ancestor." Then fill the table column by column: for k = 1, 2, ..., floor(log2(n)), set up[v][k] = up[up[v][k-1]][k-1] for every node v. If up[v][k-1] is the sentinel, then up[v][k] is also the sentinel. The column-by-column order ensures that every value you read has already been written.',
        'To answer a kth-ancestor query for node v and distance d: scan the bits of d from high to low (or low to high; both work). Whenever bit i is set, replace v with up[v][i]. If v becomes the sentinel at any point, the ancestor does not exist (d exceeds the depth of v). After processing all set bits, v holds the answer.',
        'To answer LCA(u, v): first, ensure depth[u] >= depth[v] (swap if not). Lift u by depth[u] - depth[v] using the kth-ancestor procedure. If u == v after lifting, return u (one was an ancestor of the other). Otherwise, scan k from floor(log2(n)) down to 0. If up[u][k] != up[v][k] and neither is the sentinel, set u = up[u][k] and v = up[v][k]. After the loop finishes, u and v are distinct nodes with the same parent, and that parent is the LCA. Return up[u][0].',
        'The convergence loop works because it only accepts jumps that keep u and v below the LCA. A jump where up[u][k] == up[v][k] might land on the LCA itself, but it might also land above the LCA; accepting it could skip the true answer. By rejecting all such jumps and only moving when the ancestors differ, the algorithm narrows the gap until u and v are one edge below the LCA.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The kth-ancestor correctness relies on the uniqueness of binary representation. Any distance d has exactly one way to be written as a sum of distinct powers of two. Each table lookup moves exactly 2^i edges upward along the real parent chain (this is the invariant maintained by the recurrence). Composing the selected jumps in any order reaches the same node as walking d one-step parents, because the tree is a fixed structure and the jumps are just cached shorthand for repeated parent calls.',
        'The LCA correctness relies on a loop invariant: at every iteration, both u and v remain strictly below the true LCA. Initially this holds after depth equalization (if they were at the LCA, the function would have already returned). The invariant is preserved because a jump is accepted only when up[u][k] != up[v][k], which means the landed nodes are still distinct, hence still below the LCA. When no more jumps are accepted, the loop has pushed u and v as high as possible while keeping them distinct. The only ancestor they share one edge above is the LCA.',
        'A subtle point: the convergence loop must scan from high powers to low, not low to high. Scanning low-to-high could accept a small jump that leaves a gap too small for any remaining power of two to close, requiring a second pass. High-to-low greedily uses the largest safe jump at each step, guaranteeing convergence in a single pass of at most floor(log2(n)) + 1 iterations.',
        {type: `image`, src: `https://nthu-cp.github.io/NTHU-CPP/graph/image/lca/binary_lifting_2.png`, alt: `Ancestor jumps used to approach the LCA without crossing it.`, caption: `High-to-low jumps keep the candidate below the LCA until the final parent step. (Source: nthu-cp.github.io)`},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Table construction visits every node once during DFS (O(n)) and fills floor(log2(n)) + 1 table entries per node, giving O(n log n) time and O(n log n) memory. For n = 200,000, that is about 200,000 * 18 = 3.6 million table entries. Each entry is one integer (a node index), so at 4 bytes each, the table is roughly 14 MB. This is comfortable for competitive programming and most production workloads.',
        'Each kth-ancestor query costs O(log n) because d has at most floor(log2(n)) + 1 bits. Each LCA query costs O(log n) for the depth equalization (one kth-ancestor call) plus O(log n) for the convergence loop, totaling O(log n). For n = 200,000 and q = 200,000 queries, total work is about 200,000 * 18 = 3.6 million operations, versus 40 billion for the naive approach.',
        'Compared to Euler-tour reduction plus sparse table, which achieves O(1) LCA queries after O(n log n) preprocessing, binary lifting is slightly slower per query but supports kth-ancestor queries and path metadata aggregation natively. It also avoids the conceptual overhead of reducing LCA to a range-minimum query on an Euler-tour array.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'In competitive programming, binary lifting is the standard LCA technique because it is short to code, easy to debug, and handles the most common query types (kth ancestor, LCA, path aggregate). Problems involving tree paths almost always reduce to "find the LCA, then split the path into two upward segments."',
        'In permission hierarchies (filesystems, org charts, RBAC trees), LCA finds the nearest shared scope of two resources. Each table cell can carry metadata along the jump: the most restrictive permission encountered, whether a deny rule exists on the path, the cumulative cost. A single O(log n) query replaces what would otherwise be a full walk to the root and back.',
        'In compilers, dominator trees capture the control-flow dominance relation. The immediate dominator of a basic block is its parent in the dominator tree. LCA on the dominator tree computes the nearest common dominator of two blocks, which is needed for SSA construction (placing phi-functions) and code motion optimizations. The tree is built once per function and queried many times during optimization passes.',
        'In virtual-tree (auxiliary-tree) construction, a set of marked nodes in a large tree is compressed into a smaller tree that preserves their pairwise LCA relationships. Binary lifting provides the LCA calls that drive this compression. The resulting virtual tree has at most 2k - 1 nodes for k marked nodes, regardless of the original tree size.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Binary lifting assumes a static tree. If the tree changes -- edges are added, removed, or rerooted -- the entire table must be rebuilt, costing O(n log n) per modification. For dynamic forests where links and cuts are interleaved with queries, Link-Cut Trees (amortized O(log n) per operation) or Euler Tour Trees are better choices, though they are significantly harder to implement.',
        'For workloads that need path updates (add a value to every edge on a path, then query the sum over a different path), binary lifting alone is insufficient. Heavy-Light Decomposition combined with a segment tree handles both path queries and path updates in O(log^2 n) per operation. Binary lifting can only aggregate read-only metadata along jumps.',
        'If the tree is small (under a few hundred nodes) and queries are infrequent, the naive parent-climbing approach is simpler, uses less memory, and is easier to debug. Binary lifting\'s constant factors -- the table allocation, the column-by-column fill, the bit scanning -- only pay off when n or q is large enough that O(n) per query is genuinely painful.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a tree with 8 nodes. Node 1 is the root. Edges: 1-2, 1-3, 2-4, 2-5, 3-6, 3-7, 5-8. Depths: node 1 is 0, nodes 2 and 3 are 1, nodes 4, 5, 6, 7 are 2, node 8 is 3. The maximum jump column is floor(log2(8)) = 3, so we build columns k = 0, 1, 2, 3.',
        'Column k=0 (parent): up[1][0] = null, up[2][0] = 1, up[3][0] = 1, up[4][0] = 2, up[5][0] = 2, up[6][0] = 3, up[7][0] = 3, up[8][0] = 5. Column k=1 (grandparent = parent of parent): up[1][1] = null, up[2][1] = up[up[2][0]][0] = up[1][0] = null, up[4][1] = up[up[4][0]][0] = up[2][0] = 1, up[5][1] = up[2][0] = 1, up[8][1] = up[up[8][0]][0] = up[5][0] = 2. Column k=2 (4-step ancestor): up[8][2] = up[up[8][1]][1] = up[2][1] = null. Most entries in columns 2 and 3 are null because the tree only has depth 3.',
        'Query: LCA(8, 6). Depths are depth[8] = 3, depth[6] = 2, so lift node 8 by 3 - 2 = 1. Kth-ancestor(8, 1): bit 0 of 1 is set, so node 8 becomes up[8][0] = 5. Now u = 5 (depth 2) and v = 6 (depth 2). They are not equal, so proceed to convergence. Try k = 3: up[5][3] and up[6][3] are both null, so skip. Try k = 2: both null, skip. Try k = 1: up[5][1] = 1 and up[6][1] = 1, both equal, so skip (accepting would risk crossing the LCA). Try k = 0: up[5][0] = 2 and up[6][0] = 3, which are different, so accept. Now u = 2, v = 3. Loop ends. LCA = up[2][0] = 1.',
        'Query: LCA(4, 8). Depths are depth[4] = 2, depth[8] = 3. Lift node 8 by 1: up[8][0] = 5. Now u = 4, v = 5, both at depth 2. Not equal, so converge. k = 1: up[4][1] = 1, up[5][1] = 1, equal, skip. k = 0: up[4][0] = 2, up[5][0] = 2, equal, skip. The loop accepts nothing, so u and v are already one edge below the LCA. Return up[4][0] = 2. This is correct: 4 and 8 (via 5) both have 2 as their nearest shared ancestor.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The classic reference is section 9.1 of "Competitive Programming 3" by Halim and Halim. The CP-Algorithms editorial at https://cp-algorithms.com/graph/lca_binary_lifting.html provides a clean implementation with analysis. The USACO Guide binary jumping module at https://usaco.guide/plat/binary-jump covers the competitive-programming angle with graded problems.',
        'For the theoretical foundation, see Bender and Farach-Colton, "The LCA Problem Revisited" (2000), which proves the O(n) preprocessing / O(1) query lower bound using Euler-tour reduction to RMQ. Binary lifting does not achieve that optimal bound but remains the practical choice when kth-ancestor or path metadata is also needed.',
        'Study next: Sparse Table (the same doubling idea applied to array ranges), Heavy-Light Decomposition (path queries with updates), Euler Tour Tree (dynamic forest LCA), Link-Cut Tree (amortized dynamic connectivity), Binary Exponentiation (the same doubling idea applied to multiplication), and Range Minimum Query (the reduction target for optimal LCA).',
      ],
    },
  ],
};
