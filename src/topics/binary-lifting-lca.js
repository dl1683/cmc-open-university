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
  yield {
    state: treeGraph('Root the tree and record parent/depth'),
    highlight: { active: ['n1', 'n2', 'n3', 'e-1-2', 'e-1-3'], compare: ['jump'] },
    explanation: 'Binary lifting starts with a rooted tree. DFS records depth and the immediate parent up[v][0] for every node.',
    invariant: 'up[v][k] means the 2^k-th ancestor of v, or null above the root.',
  };
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
        ['parent[v]', '1 step'],
        ['up[up[v][0]][0]', '2 steps'],
        ['up[up[v][1]][1]', '4 steps'],
        ['decompose d in binary', 'combine jumps'],
      ],
    ),
    highlight: { found: ['k1:formula', 'k2:formula'], active: ['query:meaning'] },
    explanation: 'Each larger jump is two smaller jumps chained together. That is the same doubling idea as sparse tables and binary exponentiation.',
  };
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
        ['2', '1', 'null'],
        ['2', '1', 'null'],
        ['3', '1', 'null'],
        ['null', 'null', 'null'],
      ],
    ),
    highlight: { active: ['n5:up0', 'n5:up1'], compare: ['root:up0'] },
    explanation: 'For node 5, the one-step ancestor is 2 and the two-step ancestor is 1. Larger jumps are null because the root is reached.',
  };
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
        ['O(n log n)', 'build table'],
        ['O(log n)', 'jump by binary bits'],
        ['O(log n)', 'lift and converge'],
        ['O(log n)', 'max/min on jump edges'],
      ],
    ),
    highlight: { found: ['ancestor:cost', 'lca:cost'], compare: ['pre:cost'] },
    explanation: 'Binary lifting is cheap memory for fast repeated tree ancestry queries, especially when the tree topology is fixed.',
  };
}

function* lcaQuery() {
  yield {
    state: treeGraph('Find LCA(5, 7)'),
    highlight: { active: ['n5', 'n7'], compare: ['n2', 'n3'], found: ['n1'] },
    explanation: 'To find an LCA, first lift the deeper node so both nodes have the same depth. Here 5 and 7 already match at depth 2.',
  };
  yield {
    state: labelMatrix(
      'Lift both nodes from high powers down',
      [
        { id: 'start', label: 'start 5,7' },
        { id: 'try2', label: 'try 2^1' },
        { id: 'try1', label: 'try 2^0' },
        { id: 'answer', label: 'parent after loop' },
      ],
      [{ id: 'action' }, { id: 'result' }],
      [
        ['same depth', 'continue'],
        ['both jump to 1', 'too far together'],
        ['5->2 and 7->3', 'different, accept'],
        ['parent(2)=1', 'LCA is 1'],
      ],
    ),
    highlight: { active: ['try1:result'], found: ['answer:result'], compare: ['try2:result'] },
    explanation: 'The loop tries big jumps first. If the two candidates after jumping are different, both jumps are safe because the LCA is still above them.',
    invariant: 'During convergence, u and v stay below the LCA until the final parent step.',
  };
  yield {
    state: treeGraph('LCA splits a tree path into two ancestor climbs'),
    highlight: { active: ['n5', 'n2', 'n1', 'n3', 'n7'], found: ['n1'], compare: ['jump'] },
    explanation: 'Once LCA is known, a path query can be split into u-to-lca and v-to-lca. Jump-table metadata can accumulate max edge, min edge, xor, or other associative facts.',
  };
  yield {
    state: labelMatrix(
      'Choose with neighboring tools',
      [
        { id: 'binary', label: 'Binary Lifting' },
        { id: 'hld', label: 'Heavy-Light' },
        { id: 'sparse', label: 'Euler + Sparse Table' },
        { id: 'dynamic', label: 'Link-Cut Tree' },
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
    explanation: 'Binary lifting is the simplest strong default for static trees when O(log n) queries are good enough.',
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
    { heading: 'What it is', paragraphs: [
      'Binary lifting is a preprocessing technique for rooted trees. For each node v, it stores ancestors at distances 1, 2, 4, 8, and so on. Those jump pointers answer kth-ancestor and lowest-common-ancestor queries in logarithmic time.',
      'The idea is binary decomposition. Any climb of d edges can be written as a sum of powers of two, so the query performs only the jumps corresponding to set bits. This connects directly to Binary Exponentiation and Sparse Table.',
      'Binary lifting is most useful when the tree topology is fixed and there are many ancestry or path queries. It trades O(n log n) memory for predictable O(log n) query time.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Root the tree and run DFS to record depth and immediate parent. Then build up[v][k] = up[up[v][k-1]][k-1]. The kth column jumps twice as far as the previous column.',
      'For LCA(u, v), first lift the deeper node until depths match. Then scan jump powers from high to low. If up[u][k] and up[v][k] are different, lift both. Their parent after this loop is the LCA.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Preprocessing costs O(n log n). Each kth-ancestor or LCA query costs O(log n). Memory is also O(n log n), which is usually fine for static trees but can be high for massive trees or memory-constrained systems.',
      'The common implementation bugs are off-by-one log sizes, null ancestors above the root, and mixing vertex-path and edge-path metadata. If storing max edge on jumps, each table cell must carry both ancestor and aggregate.',
      'The technique is also cache-friendly compared with pointer-heavy dynamic-tree structures because the jump table is usually stored in arrays. That makes it a good default for static trees in ordinary application code, not only programming contests.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Binary lifting appears in tree databases, routing trees, compiler dominator queries, static organization hierarchies, game scene graphs, and graph algorithm preprocessing.',
      'A complete case study is permission inheritance in a static folder tree. LCA finds the shared ancestor of two folders, and jump metadata can answer whether a deny rule appears on either path.',
      'Another useful case is incident navigation in a service ownership tree. If every service points to an owning team and every team points to a broader organization, binary lifting can quickly find the nearest common escalation owner for two failing services.',
      'Binary lifting is also the usual preprocessing behind Virtual Tree LCA Compression. The virtual-tree build calls LCA on adjacent marked nodes in Euler order, then runs a query-specific DP on the compressed tree.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'Binary lifting does not support arbitrary link and cut updates efficiently. If topology changes, use Link-Cut Tree, Euler Tour Tree, or a rebuild strategy. It also does not replace Heavy-Light Decomposition when path updates and segment queries dominate.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: CP-Algorithms LCA binary lifting at https://cp-algorithms.com/graph/lca_binary_lifting.html and USACO Guide binary jumping at https://usaco.guide/plat/binary-jump. Study Virtual Tree LCA Compression, Heavy-Light Decomposition, Sparse Table, Tree Traversals, Link-Cut Tree, and Euler Tour Tree next.',
    ] },
  ],
};
