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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/binary-lifting-lca.gif', alt: 'Animated walkthrough of the binary lifting lca visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Tree ancestry questions look small until they appear inside a hot path. A filesystem may need the nearest shared directory. A permission system may need the common owner of two resources. A compiler may need dominance relations. A graph algorithm may compress marked nodes into a virtual tree. In every case, the question is not "is this node connected?" The question is "where do these two rooted paths first meet?"`,
        `Lowest common ancestor, or LCA, names that meeting point. Given two nodes in a rooted tree, their LCA is the deepest node that is an ancestor of both. Binary lifting exists because a fixed tree often receives many ancestry queries, and walking parent pointers one edge at a time wastes the fact that the topology is already known.`,
        {type: `callout`, text: `Binary lifting turns long ancestry walks into a small set of cached power-of-two jumps over a fixed tree.`},
        {type: `image`, src: `https://nthu-cp.github.io/NTHU-CPP/graph/image/lca/def.png`, alt: `Tree with two nodes and their lowest common ancestor highlighted.`, caption: `The LCA is the deepest shared ancestor of two rooted paths. (Source: nthu-cp.github.io)`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The first attempt is direct climbing. Store parent[v] and depth[v]. To find the kth ancestor of v, repeat v = parent[v] exactly k times. To find LCA(u, v), lift the deeper node until both depths match, then move both upward one parent at a time until they meet. This is easy to write and easy to check.`,
        `The approach fails on tall trees. A tree can be a chain, so height can be n - 1. One LCA query may cost O(n), and a large batch of queries can become O(nq). Even if the tree is balanced most of the time, one adversarial hierarchy or one generated chain can break the performance promise.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The insight is to store ancestors at power-of-two distances. For each node v, keep up[v][0] for the 1-step ancestor, up[v][1] for the 2-step ancestor, up[v][2] for the 4-step ancestor, then 8, 16, and so on. Any climb distance can be written as a sum of powers of two, so a long climb becomes a short sequence of jumps.`,
        `The recurrence is the whole data structure: up[v][k] = up[up[v][k - 1]][k - 1]. A jump of length 2^k is two jumps of length 2^(k - 1). This is the same doubling pattern used by binary exponentiation and sparse tables, applied to parent pointers instead of numbers or array ranges.`,
        {type: `image`, src: `https://nthu-cp.github.io/NTHU-CPP/graph/image/lca/binary_lifting_1.png`, alt: `Binary lifting jump recurrence over a rooted tree.`, caption: `A 2^i jump is two chained 2^(i-1) jumps. (Source: nthu-cp.github.io)`},
      ],
    },
    {
      heading: 'The invariant',
      paragraphs: [
        `The invariant is precise: up[v][k] is the ancestor reached by moving exactly 2^k parent edges above v, or null if that ancestor does not exist. Depth is measured in edges from the root. Parent pointers always move toward smaller depth. The table never invents a new relationship; it only caches relationships already implied by parent links.`,
        `For LCA convergence, the second invariant is that after depth equalization, u and v remain at the same depth. When the algorithm accepts a jump for both nodes, the jumped ancestors must be different. That means the true LCA is still above both jumped nodes, so the algorithm has not crossed it.`,
      ],
    },
    {
      heading: 'Table construction',
      paragraphs: [
        `Root the tree first. A DFS or BFS records depth[v] and up[v][0]. Then build table columns from small jumps to large jumps. If mid = up[v][k - 1] is null, then up[v][k] is null. Otherwise up[v][k] = up[mid][k - 1]. The maximum column is floor(log2(n)) for n nodes, or a fixed constant if the maximum input size is known.`,
        `The construction is O(n log n) time and memory because every node receives about log n ancestor entries. In JavaScript, a practical implementation often uses arrays of arrays for clarity, or typed arrays when n is large and null can be represented by -1. The important part is not the container; it is the column-by-column order that makes every smaller jump available before it is needed.`,
      ],
    },
    {
      heading: 'Answering kth ancestor',
      paragraphs: [
        `The kth-ancestor query is the simplest use of the table. Scan the bits of k. If bit i is set, replace v with up[v][i]. Stop early if v becomes null. To climb 13 edges, use 13 = 8 + 4 + 1, so the query applies the 2^3 jump, then the 2^2 jump, then the 2^0 jump.`,
        `This query is a useful test for the table. If kth ancestor works for random nodes and distances, the base parent column, null handling, and power-of-two recurrence are probably correct. LCA adds a convergence rule on top of the same primitive.`,
      ],
    },
    {
      heading: 'Answering LCA',
      paragraphs: [
        `To compute LCA(u, v), first make the depths equal. If u is deeper, lift u by depth[u] - depth[v]. If v is deeper, lift v by the opposite difference. If the two nodes are equal after this step, that node is the LCA because one original node was an ancestor of the other.`,
        `If they are still different, scan jump powers from high to low. For each k, compare up[u][k] and up[v][k]. If both exist and are different, move both nodes to those ancestors. After the loop, u and v are distinct children below the same ancestor, so parent[u] is the LCA. The algorithm uses large safe moves first, then narrows to the edge just below the split.`,
        {type: `image`, src: `https://nthu-cp.github.io/NTHU-CPP/graph/image/lca/binary_lifting_2.png`, alt: `Ancestor jumps used to approach the LCA without crossing it.`, caption: `High-to-low jumps keep the candidate below the LCA until the final parent step. (Source: nthu-cp.github.io)`},
      ],
    },
    {
      heading: 'Visual cues',
      paragraphs: [
        `In the jump-table view, each column is a larger stride through the rooted tree. The 2^0 column stores the immediate parent, the 2^1 column stores the grandparent, and the 2^2 column stores the ancestor four edges above. The highlighted recurrence shows that a four-step climb is two two-step climbs chained together.`,
        `In the LCA view, the useful event is the rejected jump. For nodes 5 and 7, both 2^1 ancestors are 1. Taking that jump would land both nodes on the same ancestor, which is too high for the convergence loop. The 2^0 jump sends 5 to 2 and 7 to 3, keeping them below the answer. Their shared parent is then 1.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The kth-ancestor part works by binary decomposition. Every nonnegative distance has a unique binary representation, and each selected table column moves exactly that many edges upward. Because every move follows real parent links, the composition of selected jumps reaches the same node as k one-step climbs.`,
        `The LCA part works because the algorithm preserves order around the answer. Depth equalization puts both candidates on the same level. During convergence, a jump is accepted only when the two jumped ancestors differ, which proves neither candidate has moved to or above the LCA. Once no such jump remains, the candidates are as high as they can be while still separate. Their parent is therefore the deepest shared ancestor.`,
      ],
    },
    {
      heading: 'Path metadata',
      paragraphs: [
        `Binary lifting often carries more than ancestor ids. Each table cell can also store an aggregate over the climbed segment: maximum edge weight, minimum permission level, xor label, sum, bitwise-or flags, or whether some condition appears on the path. The recurrence combines metadata from the first half jump and the second half jump.`,
        `This works cleanly for associative operations with a clear identity value. For example, max edge on a path can combine max(leftHalf, rightHalf). Direction-sensitive metadata needs more care because a climb from u to an ancestor and a climb from v to an ancestor may need opposite orders. Vertex metadata and edge metadata also need separate definitions, or off-by-one bugs will appear at the LCA.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Preprocessing costs O(n log n). Each kth-ancestor or LCA query costs O(log n). Memory is O(n log n). Those bounds are attractive for static trees with many queries, but the memory table can be heavy for very large n, especially in languages where nested arrays have object overhead.`,
        `Euler tour plus sparse table can answer LCA in O(1) after O(n log n) preprocessing, and Euler tour plus RMQ can be optimized further. Binary lifting remains a strong default because it also answers kth ancestor, supports path metadata naturally, has simple code, and does not require reducing the tree to an RMQ array before doing useful work.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Choose a root and be consistent. For a forest, either add a synthetic root or build one table per component and reject cross-component LCA queries. Store tin/tout timestamps if you want a fast isAncestor(u, v) helper, but the depth-equalization version works without timestamps.`,
        `Common bugs are small but persistent: using Math.log2(n) without rounding up, reading up[-1][k], forgetting that the root has no parent, scanning jump powers in the wrong direction during LCA, and mixing 0-based node ids with 1-based input. A good test suite includes a chain, a star, a balanced tree, ancestor-descendant pairs, same-node queries, root queries, and random comparisons against a slow parent-climb implementation.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Binary lifting wins when the tree is static and query volume is high. It is common in competitive programming, taxonomy search, organization charts, compiler trees, static routing hierarchies, virtual-tree construction, and permission inheritance. The table turns a global hierarchy into local array lookups.`,
        `A concrete permission example: two folders inherit rules from ancestors. LCA finds their nearest shared scope. Jump metadata can tell whether a deny rule appears on either path to that scope. The same pattern appears in network trees, scene graphs, and dependency trees whenever the path to a shared ancestor carries information.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Binary lifting is the wrong tool when the topology changes often. If edges are linked and cut dynamically, rebuilding the whole table can dominate the workload. Link-Cut Trees, Euler Tour Trees, or batched rebuild strategies fit dynamic forests better, although they cost more implementation complexity.`,
        `It can also be the wrong tool for rich path updates. If queries ask for range updates and aggregates over arbitrary tree paths, Heavy-Light Decomposition with a segment tree may be more natural. If the workload only asks one or two ancestry questions on a small tree, a parent-set climb is simpler and easier to inspect.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: CP-Algorithms LCA binary lifting at https://cp-algorithms.com/graph/lca_binary_lifting.html and USACO Guide binary jumping at https://usaco.guide/plat/binary-jump. After this, study Virtual Tree LCA Compression, Heavy-Light Decomposition, Sparse Table, Tree Traversals, Euler Tour Tree, Link-Cut Tree, Binary Exponentiation, and Range Minimum Query.`,
      ],
    },
  ],
};
