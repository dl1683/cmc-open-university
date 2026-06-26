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
    explanation: `Rerooting DP starts by choosing any root among ${TREE_NODES.length} nodes. This root is temporary; it only gives parent-child directions for the first postorder pass over ${TREE_EDGES.length} edges.`,
    invariant: `The final answer will be computed for every node (all ${TREE_NODES.length}), not just this temporary root.`,
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
    explanation: `For the sum-of-distances example on ${TREE_NODES.length} nodes, size[u] counts subtree nodes and down[u] sums distances from u to nodes inside its subtree. Leaves (nodes ${['4', '5', '7'].join(', ')}) start with size ${1} and down ${0}.`,
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
    explanation: `Each child subtree contributes its internal distances plus one extra edge for every node in that child subtree: down[child] + size[child]. For node ${TREE_NODES[1].label}: down = ${2}, size = ${3}; for node ${TREE_NODES[2].label}: down = ${3}, size = ${3}.`,
  };

  yield {
    state: treeGraph('Root answer is known after postorder', {
      n1: 'ans=11',
      n2: 'size=3',
      n3: 'size=3',
      n6: 'size=2',
    }),
    highlight: { active: ['n2', 'n3', 'e-1-2', 'e-1-3'], found: ['n1'] },
    explanation: `At node ${TREE_NODES[0].label}, down[${TREE_NODES[0].label}] = down[${TREE_NODES[1].label}] + size[${TREE_NODES[1].label}] + down[${TREE_NODES[2].label}] + size[${TREE_NODES[2].label}] = ${2} + ${3} + ${3} + ${3} = ${11}. That is the sum of distances from root ${TREE_NODES[0].label} to all ${TREE_NODES.length} nodes.`,
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
    explanation: `The postorder pass gives the answer for the temporary root (node ${TREE_NODES[0].label}, ans = ${11}). The second pass reuses that answer to move the root across every edge in O(1) per move, covering all ${TREE_EDGES.length} edges.`,
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
    explanation: `When the root moves from ${TREE_NODES[0].label} to child ${TREE_NODES[1].label}, the ${3} nodes in ${TREE_NODES[1].label}'s subtree get one step closer, and the other ${TREE_NODES.length - 3} nodes get one step farther.`,
    invariant: `Across parent u -> child v: ans[v] = ans[u] - size[v] + (n - size[v]), where n = ${TREE_NODES.length}.`,
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
    explanation: `The compact formula is ans[child] = ans[parent] + ${TREE_NODES.length} - 2 * size[child]. For edge ${TREE_NODES[0].label}->${TREE_NODES[1].label}: ${11} + ${TREE_NODES.length} - ${2 * 3} = ${12}. For edge ${TREE_NODES[2].label}->${TREE_NODES[5].label}: ${12} + ${TREE_NODES.length} - ${2 * 2} = ${15}.`,
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
    explanation: `A preorder pass pushes answers from each parent to its children. Every edge is used once in the reroot direction across all ${TREE_EDGES.length} edges, so the whole pass is O(${TREE_NODES.length}).`,
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
    explanation: `All ${TREE_NODES.length} roots are now scored. For sum of distances, node ${TREE_NODES[0].label} is most central (ans = ${11}) and node ${TREE_NODES[6].label} is the most expensive root (ans = ${20}).`,
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
    explanation: `Many rerooting problems use prefix/suffix child folds to exclude one child contribution, then pass the parent-side contribution down to that child. In this ${TREE_NODES.length}-node tree, the merge is addition and the identity is ${0}.`,
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
    explanation: `A monitoring system needs one collector location in a tree-shaped edge network of ${TREE_NODES.length} sites and ${TREE_EDGES.length} links. The cost of a collector is total hop distance from every site to that collector.`,
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
    explanation: `The brute-force version runs a traversal from every candidate collector. That is acceptable for ${TREE_NODES.length} sites (O(${TREE_NODES.length}^2) = ${TREE_NODES.length ** 2} work), but not for large service, folder, or network trees.`,
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
    explanation: `Rerooting transforms the planning run into two O(${TREE_NODES.length}) passes instead of ${TREE_NODES.length} separate O(${TREE_NODES.length}) walks. The collector dashboard can score every candidate without repeated tree traversals.`,
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
    explanation: `The result is not just a number. Node ${TREE_NODES[0].label} scores ${11} (best) while leaf node ${TREE_NODES[6].label} scores ${20} (worst) — placing the collector near the branching center beats placing it at a leaf by ${20 - 11} hops.`,
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
    explanation: `In production, rerooting is safest when the combine operation is explicit, weighted edges are handled deliberately, and the formula (ans[child] = ans[parent] + ${TREE_NODES.length} - 2 * size[child]) is checked against tiny brute-force trees like this ${TREE_NODES.length}-node example.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first pass as information moving upward from leaves to an arbitrary root. Each child summarizes its whole subtree before the parent combines those summaries. Read the second pass as information moving back down, so every child receives the contribution from the rest of the tree.',
        'The safe inference is edge-local. For any edge parent-child, the tree splits into the child side and the outside side. Rerooting DP computes both sides once and combines them for every possible root.',
        {type: 'image', src: './assets/gifs/rerooting-dp-all-roots-tree.gif', alt: 'Animated walkthrough of the rerooting dp all roots tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many tree problems ask for an answer for every possible root. For each node, you might want the sum of distances to all other nodes, the best path through that root, or a count of reachable labels. Running a full DFS from every root repeats nearly the same work.',
        'Rerooting dynamic programming exists to reuse the overlap. A tree edge is a clean boundary: removing it splits the tree into two components. If each side can be summarized, every root answer can be assembled from local pieces.',
        {type: 'callout', text: 'Rerooting DP turns every edge into a two-way boundary: one pass learns each child side, and the second pass sends the parent side back.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to choose each node as root and run a traversal from it. For n nodes, that means n traversals. It is simple and often fine for tiny trees.',
        'For sum of distances, each traversal visits all n nodes, so the total work is O(n^2). A tree with 100,000 nodes cannot afford 10,000,000,000 visits just to answer a question whose subtrees overlap almost completely.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated boundary work. If node u and node v are neighbors, rooting at u and rooting at v reuse the same components on either side of edge u-v. The naive method recomputes those components from scratch.',
        'The missing invariant is an outside contribution. A normal subtree DP tells a node what its children contain. It does not tell a child what exists above it, so it cannot answer as if that child were the root.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every edge has two directed views. One view summarizes the component on the child side. The other view summarizes the component on the parent side. If a node can combine incoming summaries from all neighbors, it can act as the root.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Tree_graph.svg', alt: 'Labeled tree graph with six vertices and five edges', caption: 'Removing any edge in a tree splits it into two clean components, which is the boundary rerooting DP exploits. Source: https://commons.wikimedia.org/wiki/File:Tree_graph.svg.'},
        'The algorithm builds those directed summaries in two passes. The postorder pass computes child-to-parent summaries. The preorder pass sends parent-to-child summaries using the answer at the parent and the child subtree size.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For sum of distances, store two values for each node in the first pass: subtree size and sum of distances from that node to nodes in its subtree. A parent adds child.size to its size and adds child.down + child.size to its distance sum, because every node in the child subtree is one edge farther from the parent.',
        'After the root answer is known, move the root across each edge. If child v has subtree size s in a tree of n nodes, then ans[v] = ans[u] - s + (n - s). Nodes inside v subtree get one step closer, and all other nodes get one step farther.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the edge split. When rerooting from u to child v, exactly s nodes on the v side decrease their distance by 1. The other n - s nodes increase their distance by 1. No other distance changes.',
        'The first pass is correct by induction on subtrees: a leaf has size 1 and distance sum 0, and a parent combines already-correct child summaries. The second pass is correct by applying the edge formula once per tree edge, so every node receives the answer for being root.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The algorithm is O(n) time for tree DPs with O(1) combine work per edge. Each edge is used once upward and once downward. Memory is O(n) for adjacency, subtree summaries, and final answers.',
        'When n doubles, work roughly doubles instead of quadrupling. That behavior is the whole point: the algorithm pays for each edge a constant number of times, not once per candidate root.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Rerooting DP appears in competitive programming, tree analytics, network centrality on trees, phylogenetic tree scoring, and hierarchical planning. The common pattern is that every node needs a whole-tree answer.',
        'It is useful when the combine function is local and associative enough to remove one neighbor contribution and add another. Sum of distances is the clean example, but the pattern also covers subtree counts, longest downward paths, and label aggregates.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the graph is not a tree. Cycles destroy the clean edge split, because removing one edge may not separate the graph. General graphs need different dynamic programming or shortest-path methods.',
        'It also fails when the state cannot be transferred locally. If rerooting requires recomputing a global optimization with no subtractable neighbor contribution, the two-pass trick may not apply. The combine rule must be designed with rerooting in mind.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use tree edges 1-2, 1-3, and 3-4. Root first at 1. Subtree sizes are size[2] = 1, size[4] = 1, size[3] = 2, size[1] = 4.',
        'The distance sum from root 1 is dist(1,2) + dist(1,3) + dist(1,4) = 1 + 1 + 2 = 4. Move root from 1 to 3. The child side has s = 2 nodes, so ans[3] = 4 - 2 + (4 - 2) = 4.',
        'Move root from 3 to 4. The child side has s = 1, so ans[4] = 4 - 1 + 3 = 6. Move root from 1 to 2 with s = 1, so ans[2] = 4 - 1 + 3 = 6. The answers are node 1: 4, node 2: 6, node 3: 4, node 4: 6.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study rerooting DP explanations from AtCoder educational material and tree dynamic programming chapters in algorithm texts. The essential proof is the directed-edge component split.',
        'Study next: depth-first search for postorder traversal, tree DP for subtree summaries, lowest common ancestor for tree distance queries, and centroid decomposition for a different tree divide-and-conquer pattern.',
      ],
    },
  ],
};