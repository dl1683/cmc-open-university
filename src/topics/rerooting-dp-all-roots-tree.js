// Rerooting DP: compute every possible tree-root answer in two passes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rerooting-dp-all-roots-tree',
  title: 'Rerooting DP: All Roots Tree DP',
  category: 'Data Structures',
  summary: 'Compute a tree DP answer for every possible root by doing one postorder pass and one reroot pass instead of n separate DFS runs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['postorder pass', 'reroot pass', 'collector case study'], defaultValue: 'postorder pass' },
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

const TREE_NODES = [
  { id: 'n1', label: '1', x: 5.0, y: 0.7 },
  { id: 'n2', label: '2', x: 3.0, y: 2.5 },
  { id: 'n3', label: '3', x: 7.0, y: 2.5 },
  { id: 'n4', label: '4', x: 2.0, y: 4.4 },
  { id: 'n5', label: '5', x: 4.0, y: 4.4 },
  { id: 'n6', label: '6', x: 7.0, y: 4.4 },
  { id: 'n7', label: '7', x: 7.0, y: 6.3 },
];

const TREE_EDGES = [
  { id: 'e-1-2', from: 'n1', to: 'n2' },
  { id: 'e-1-3', from: 'n1', to: 'n3' },
  { id: 'e-2-4', from: 'n2', to: 'n4' },
  { id: 'e-2-5', from: 'n2', to: 'n5' },
  { id: 'e-3-6', from: 'n3', to: 'n6' },
  { id: 'e-6-7', from: 'n6', to: 'n7' },
];

function treeGraph(title, notes = {}) {
  return graphState({
    nodes: TREE_NODES.map((node) => ({ ...node, note: notes[node.id] ?? '' })),
    edges: TREE_EDGES,
  }, { title });
}

function* postorderPass() {
  yield {
    state: treeGraph('Pick any temporary root and run DFS', {
      n1: 'root now',
      n4: 'leaf',
      n5: 'leaf',
      n7: 'leaf',
    }),
    highlight: { active: ['n1'], compare: ['n4', 'n5', 'n7'], found: ['e-1-2', 'e-1-3'] },
    explanation: 'Rerooting DP starts by choosing any root. This root is temporary; it only gives parent-child directions for the first postorder pass.',
    invariant: 'The final answer will be computed for every node, not just this temporary root.',
  };

  yield {
    state: labelMatrix(
      'Leaf base cases',
      [
        { id: 'n4', label: 'node 4' },
        { id: 'n5', label: 'node 5' },
        { id: 'n7', label: 'node 7' },
        { id: 'rule', label: 'rule' },
      ],
      [{ id: 'size', label: 'size' }, { id: 'down', label: 'down' }],
      [
        ['1', '0'],
        ['1', '0'],
        ['1', '0'],
        ['self only', 'no child'],
      ],
    ),
    highlight: { active: ['n4:size', 'n5:size', 'n7:size'], found: ['rule:down'] },
    explanation: 'For the sum-of-distances example, size[u] counts subtree nodes and down[u] sums distances from u to nodes inside its subtree. Leaves start with size 1 and down 0.',
  };

  yield {
    state: labelMatrix(
      'Combine child subtrees',
      [
        { id: 'n2', label: 'node 2' },
        { id: 'n6', label: 'node 6' },
        { id: 'n3', label: 'node 3' },
        { id: 'rule', label: 'rule' },
      ],
      [{ id: 'size', label: 'size' }, { id: 'down', label: 'down' }],
      [
        ['3', '2'],
        ['2', '1'],
        ['3', '3'],
        ['sum child', 'down+c size'],
      ],
    ),
    highlight: { active: ['n2:size', 'n2:down', 'n3:size', 'n3:down'], found: ['rule:down'] },
    explanation: 'Each child subtree contributes its internal distances plus one extra edge for every node in that child subtree: down[child] + size[child].',
  };

  yield {
    state: treeGraph('Root answer is known after postorder', {
      n1: 'ans=11',
      n2: 'size=3',
      n3: 'size=3',
      n6: 'size=2',
    }),
    highlight: { active: ['n2', 'n3', 'e-1-2', 'e-1-3'], found: ['n1'] },
    explanation: 'At node 1, down[1] = down[2] + size[2] + down[3] + size[3] = 2 + 3 + 3 + 3 = 11. That is the sum of distances from root 1 to all nodes.',
  };

  yield {
    state: labelMatrix(
      'Why one pass is not enough',
      [
        { id: 'root1', label: 'root 1' },
        { id: 'root2', label: 'root 2' },
        { id: 'root7', label: 'root 7' },
        { id: 'naive', label: 'naive' },
      ],
      [{ id: 'known', label: 'known?' }, { id: 'cost', label: 'cost' }],
      [
        ['yes', 'O(n)'],
        ['no', 'move'],
        ['no', 'move'],
        ['n DFS', 'O(n^2)'],
      ],
    ),
    highlight: { found: ['root1:known'], compare: ['naive:cost'], active: ['root2:known', 'root7:known'] },
    explanation: 'The postorder pass gives the answer for the temporary root. The second pass reuses that answer to move the root across every edge in O(1) per move.',
  };
}

function* rerootPass() {
  yield {
    state: treeGraph('Move the root across edge 1-2', {
      n1: 'ans=11',
      n2: 'size=3',
      n4: 'closer',
      n5: 'closer',
      n3: 'farther',
    }),
    highlight: { active: ['n1', 'n2', 'e-1-2'], found: ['n4', 'n5'], compare: ['n3', 'n6', 'n7'] },
    explanation: 'When the root moves from 1 to child 2, the three nodes in 2-subtree get one step closer, and the other four nodes get one step farther.',
    invariant: 'Across parent u -> child v: ans[v] = ans[u] - size[v] + (n - size[v]).',
  };

  yield {
    state: labelMatrix(
      'Apply the edge formula',
      [
        { id: 'to2', label: '1 -> 2' },
        { id: 'to3', label: '1 -> 3' },
        { id: 'to6', label: '3 -> 6' },
        { id: 'rule', label: 'rule' },
      ],
      [{ id: 'calc', label: 'calc' }, { id: 'ans', label: 'ans' }],
      [
        ['11 + 7 - 6', '12'],
        ['11 + 7 - 6', '12'],
        ['12 + 7 - 4', '15'],
        ['parent+n-2s', 'child'],
      ],
    ),
    highlight: { active: ['to2:ans', 'to3:ans', 'to6:ans'], found: ['rule:calc'] },
    explanation: 'The compact formula is ans[child] = ans[parent] + n - 2 * size[child]. It is just closer-subtree minus farther-outside counted in one expression.',
  };

  yield {
    state: treeGraph('Continue the preorder reroot walk', {
      n1: '11',
      n2: '12',
      n3: '12',
      n4: '17',
      n5: '17',
      n6: '15',
      n7: '20',
    }),
    highlight: { active: ['n2', 'n4', 'n5', 'n6', 'n7'], found: ['e-2-4', 'e-2-5', 'e-6-7'], compare: ['n1'] },
    explanation: 'A preorder pass pushes answers from each parent to its children. Every edge is used once in the reroot direction, so the whole pass is linear.',
  };

  yield {
    state: labelMatrix(
      'All roots are now scored',
      [
        { id: 'n1', label: 'root 1' },
        { id: 'n2', label: 'root 2' },
        { id: 'n3', label: 'root 3' },
        { id: 'n6', label: 'root 6' },
        { id: 'n7', label: 'root 7' },
      ],
      [{ id: 'sum', label: 'sum dist' }, { id: 'rank', label: 'rank' }],
      [
        ['11', 'best'],
        ['12', 'next'],
        ['12', 'next'],
        ['15', 'ok'],
        ['20', 'worst'],
      ],
    ),
    highlight: { found: ['n1:rank'], active: ['n2:sum', 'n3:sum'], compare: ['n7:rank'] },
    explanation: 'The same tree can now be evaluated from every root. For sum of distances, node 1 is most central in this example and node 7 is the most expensive root.',
  };

  yield {
    state: labelMatrix(
      'Generic rerooting checklist',
      [
        { id: 'merge', label: 'merge' },
        { id: 'remove', label: 'skip' },
        { id: 'add', label: 'add' },
        { id: 'order', label: 'order' },
      ],
      [{ id: 'need', label: 'need' }, { id: 'why', label: 'why' }],
      [
        ['assoc', 'fold'],
        ['child', 'move'],
        ['outside', 'send'],
        ['2 DFS', 'linear'],
      ],
    ),
    highlight: { active: ['merge:need', 'remove:need', 'add:need'], found: ['order:why'] },
    explanation: 'Many rerooting problems use prefix/suffix child folds to exclude one child contribution, then pass the parent-side contribution down to that child.',
  };
}

function* collectorCaseStudy() {
  yield {
    state: treeGraph('Choose a telemetry collector in a tree-shaped network', {
      n1: 'hub A',
      n2: 'rack B',
      n3: 'rack C',
      n7: 'edge',
    }),
    highlight: { active: ['n1', 'n2', 'n3', 'n6', 'n7'], compare: ['e-1-2', 'e-1-3'] },
    explanation: 'A monitoring system needs one collector location in a tree-shaped edge network. The cost of a collector is total hop distance from every site to that collector.',
  };

  yield {
    state: labelMatrix(
      'Naive planning loop',
      [
        { id: 'pick', label: 'pick root' },
        { id: 'dfs', label: 'DFS all' },
        { id: 'repeat', label: 'repeat n' },
        { id: 'limit', label: 'limit' },
      ],
      [{ id: 'work', label: 'work' }, { id: 'result', label: 'result' }],
      [
        ['try one', 'one score'],
        ['O(n)', 'dist sum'],
        ['O(n^2)', 'all scores'],
        ['too slow', 'large tree'],
      ],
    ),
    highlight: { compare: ['repeat:work', 'limit:work'], active: ['dfs:work'], found: ['pick:result'] },
    explanation: 'The brute-force version runs a traversal from every candidate collector. That is acceptable for seven sites, but not for large service, folder, or network trees.',
  };

  yield {
    state: labelMatrix(
      'Rerooting plan',
      [
        { id: 'post', label: 'postorder' },
        { id: 'root', label: 'root ans' },
        { id: 'reroot', label: 'reroot' },
        { id: 'choose', label: 'choose' },
      ],
      [{ id: 'does', label: 'does' }, { id: 'cost' }],
      [
        ['sizes/down', 'O(n)'],
        ['score 1', 'ready'],
        ['push scores', 'O(n)'],
        ['min score', 'O(n)'],
      ],
    ),
    highlight: { active: ['post:does', 'reroot:does'], found: ['choose:does'], compare: ['root:cost'] },
    explanation: 'Rerooting transforms the planning run into two linear passes. The collector dashboard can score every candidate without repeated tree walks.',
  };

  yield {
    state: treeGraph('Decision: node 1 minimizes total hop distance', {
      n1: 'best 11',
      n2: '12',
      n3: '12',
      n4: '17',
      n5: '17',
      n6: '15',
      n7: '20',
    }),
    highlight: { found: ['n1'], active: ['n2', 'n3'], compare: ['n7'] },
    explanation: 'The result is not just a number. The score table explains why placing the collector near the branching center beats placing it at a leaf.',
  };

  yield {
    state: labelMatrix(
      'Production cautions',
      [
        { id: 'weights', label: 'weight' },
        { id: 'metric', label: 'metric' },
        { id: 'updates', label: 'update' },
        { id: 'debug', label: 'debug' },
      ],
      [{ id: 'rule' }, { id: 'failure' }],
      [
        ['edge w', 'bad cost'],
        ['assoc', 'bad move'],
        ['recalc', 'stale'],
        ['brute', 'bug'],
      ],
    ),
    highlight: { active: ['weights:rule', 'metric:rule'], found: ['debug:failure'], compare: ['updates:failure'] },
    explanation: 'In production, rerooting is safest when the combine operation is explicit, weighted edges are handled deliberately, and the formula is checked against tiny brute-force trees.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'postorder pass') yield* postorderPass();
  else if (view === 'reroot pass') yield* rerootPass();
  else if (view === 'collector case study') yield* collectorCaseStudy();
  else throw new InputError('Pick a rerooting-DP view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Rerooting DP is a tree dynamic-programming technique for problems that ask for an answer at every possible root. Instead of running a full DFS from every node, it computes one rooted DP and then moves the root across each edge in constant or near-constant time.',
        'The common shape is two passes. A postorder pass computes subtree information. A preorder pass sends parent-side information into each child, allowing the answer for the child-rooted tree to be derived from the parent-rooted answer.',
        'This topic uses the sum of distances from each node to all other nodes because the reroot formula is visible: moving the root into a child subtree makes nodes inside that subtree one step closer and all other nodes one step farther.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose any root and run a DFS. For sum of distances, store size[u], the number of nodes in u\'s subtree, and down[u], the sum of distances from u to nodes in that subtree. A child c contributes down[c] + size[c], because every node in c\'s subtree is one edge farther from u than from c.',
        'After the first pass, ans[root] is known. For an edge u to child v, rerooting from u to v changes distances in two groups. The size[v] nodes in v\'s subtree become one closer, and the n - size[v] nodes outside become one farther. Therefore ans[v] = ans[u] - size[v] + (n - size[v]), often written ans[v] = ans[u] + n - 2 * size[v].',
        'More general rerooting DPs use a merge operation over child contributions. To send information to one child, the parent must combine every contribution except that child plus the parent-side contribution. Prefix and suffix folds are the standard way to make that exclusion O(1) per child after linear preprocessing.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For the distance-sum example, the runtime is O(n): one postorder pass, one preorder reroot pass, and constant work per edge. Memory is O(n) for sizes, down values, answers, and the adjacency list.',
        'The naive alternative is O(n^2): run a traversal from each root candidate. Rerooting is the difference between asking every root from scratch and treating neighboring roots as closely related states.',
        'For generic rerooting, the cost depends on the combine operation. If child contributions can be merged associatively and excluded efficiently with prefix/suffix folds, the usual result is still linear or O(n log n) if the child data structure has logarithmic update costs.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A telemetry platform has a tree-shaped edge network and needs to choose one collector location. The cost of a collector is total hop distance from every site to that collector. Recomputing distances from every candidate site repeats almost the same work n times.',
        'Rerooting scores every candidate in one sweep. The first pass computes subtree sizes and the score for an arbitrary hub. The second pass moves that score across every edge. In the example animation, node 1 scores 11, nodes 2 and 3 score 12, node 6 scores 15, and leaf node 7 scores 20. The central hub wins for this cost function.',
        'The same pattern appears in organization trees, file trees, phylogenetic trees, dependency trees, and UI or scene graphs whenever the question is "what would the answer be if this node were the root?"',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Rerooting does not mean physically reversing the whole tree for each node. It means deriving the neighboring root state from the current root state.',
        'The formula must match the metric. The simple ans[v] = ans[u] + n - 2 * size[v] formula is for unweighted sum of distances. Weighted edges, max-distance objectives, independent sets, and matching-style DPs need their own transfer equations.',
        'Another common bug is forgetting the parent-side contribution when moving down. Subtree DP alone only sees descendants under the temporary root. Rerooting becomes correct when every child also receives the information from outside its subtree.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: USACO Guide DP on Trees - Solving For All Roots at https://usaco.guide/gold/all-roots, USACO Guide DP on Trees introduction at https://usaco.guide/gold/dp-trees, and AtCoder ABC222 editorial section on rerooting DP at https://atcoder.jp/contests/abc222/editorial/2763.',
        'Study Tree Traversals, Memoization, Virtual Tree LCA Compression, Centroid Decomposition, Heavy-Light Decomposition, and Small-to-Large Merging & DSU on Tree next. They are all ways of reusing tree work instead of repeating traversal blindly.',
      ],
    },
  ],
};
