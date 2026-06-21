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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/rerooting-dp-all-roots-tree.gif', alt: 'Animated walkthrough of the rerooting dp all roots tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Rerooting dynamic programming exists for tree problems where every node asks the same question: what would the answer be if I were the root? A naive solution reruns a DFS from every node. That is easy to understand and usually too slow.',
        'The technique turns an all-roots problem into two passes. The first pass computes information flowing up from children. The second pass sends the missing outside information back down. Every node ends with a view of the whole tree from its own position.',
        {type: 'callout', text: 'Rerooting DP turns every edge into a two-way boundary: one pass learns each child side, and the second pass sends the parent side back.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to choose one root, run a DFS, compute the answer for that root, then repeat for every possible root. On a tree with n nodes, that can cost O(n^2) because each root walks the whole tree again.',
        'Another tempting approach is to cache subtrees and hope reuse falls out naturally. It usually does not, because when the root moves across an edge, the old parent side becomes a child side. The missing part is not more memoization; it is a way to pass information across the cut edge.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'For each edge u-v, the tree splits into two components if the edge is removed. A rerooting algorithm computes the contribution from each side of that edge. Once a node knows contributions from all neighbor directions, it can combine them to answer the rooted-at-this-node question.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Tree_graph.svg', alt: 'Labeled tree graph with six vertices and five edges', caption: 'Removing any edge in a tree splits it into two clean components, which is the boundary rerooting DP exploits. Source: https://commons.wikimedia.org/wiki/File:Tree_graph.svg.'},
        'This is why the method often uses prefix and suffix aggregates over children. To send a value from parent u to child v, u must combine every contribution except the one that came from v. Prefix/suffix scans make that exclusion O(1) per edge after one local pass.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First choose any root. Run a postorder DFS. For each node, compute down[node] from its children. The meaning depends on the problem: subtree size, height, sum of distances inside the subtree, best path, count of valid colorings, or another associative summary.',
        'Second run a preorder DFS. Each node receives an up contribution representing everything outside its own subtree. It combines up with child contributions to compute the answer for itself. For each child, it builds that child outside contribution by combining up plus all sibling contributions except the child.',
        'The combination function must be explicit. Many rerooting templates require an identity value, a merge operation, and a way to add the current node or edge. If those pieces are associative and the exclusion step is correct, the second pass touches each directed edge once.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first-pass view proves that each subtree can summarize itself without knowing the rest of the tree. Children push compact facts upward. The root is arbitrary; it is only a staging point for collecting one-directional information.',
        'The reroot view proves that moving the root across an edge does not require recomputing the world. The child already knows its own side. The parent sends the other side. Together those two summaries cover the whole tree exactly once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A tree has exactly one simple path between any two nodes. That makes each neighbor direction from a node represent a disjoint component. Combining all neighbor-direction contributions is therefore enough to describe the whole tree from that node.',
        'The two-pass proof is edge-local. In the downward pass, every directed edge parent-to-child carries the aggregate for the component on the parent side of the cut. Since the child already has aggregates from its own children, it can see every component around it.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Rerooting usually runs in O(n) time for a tree with n nodes, assuming the merge operation is O(1). Space is O(n) for arrays such as down, up, answer, parent, and traversal order. Recursive implementations also spend call-stack space unless rewritten iteratively.',
        'The tradeoff is abstraction complexity. A one-root DP is often easier to write. Rerooting adds careful direction handling, identity values, prefix/suffix exclusion, and edge cases for leaves. It is worth it only when many roots or many node-centered answers are required.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Rerooting wins for sum of distances from every node, eccentricity-like height values, subtree contribution problems, all-roots color counts, tree matching variants, and many competitive-programming tree DP tasks. It is also useful whenever a service needs a score for every possible root of a hierarchy.',
        'A classic example is sum of distances in a tree. Postorder computes subtree sizes and distance sums for one root. Preorder moves the root to each child using the formula answer[child] = answer[parent] - size[child] + (n - size[child]). The formula is just rerooting expressed for that specific summary.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The method assumes a tree. On a general graph, removing an edge may not split the structure cleanly because alternate paths exist. You need graph DP over a tree decomposition, shortest-path algorithms, or another technique, not ordinary rerooting.',
        'Another failure is using a merge that is not associative or forgetting directed edge state. If the order of children changes the answer, prefix/suffix scans may be invalid. If edge weights or directions matter, the transfer function must include them explicitly.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For sum of distances, the postorder pass computes two facts for each subtree: how many nodes it contains and the sum of distances from the current node to nodes inside that subtree. A child contributes its distance sum plus its size because every node in the child subtree is one edge farther from the parent.',
        'The preorder pass moves the answer across an edge. If child v has size s and the whole tree has n nodes, moving the root from parent u to v makes the s nodes in v subtree one step closer and the other n - s nodes one step farther. That gives answer[v] = answer[u] - s + (n - s).',
        'This formula is the concrete version of rerooting. The child already owns its side of the cut. The parent answer contains the whole tree. The edge move adjusts the two sides without walking every node again.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Name the meaning of every DP value before writing code. Is it measured from the node to its subtree, from the subtree to the node, or from one side of an edge to the other? Most rerooting bugs are meaning drift, not syntax mistakes.',
        'Build an explicit parent array or traversal order if recursion depth may be large. JavaScript recursion can overflow on deep trees. An iterative postorder plus preorder often makes the data flow easier to debug and safer for adversarial inputs.',
        'Test on a chain, a star, a single node, and a balanced tree. Chains expose direction mistakes. Stars expose sibling exclusion mistakes. Single nodes expose identity values. Balanced trees expose whether both passes combine correctly.',
      ],
    },
    {
      heading: 'How to choose it',
      paragraphs: [
        'Use rerooting when the graph is a tree, every node needs a related answer, and moving the root changes the answer predictably across an edge. If only one root matters, ordinary tree DP is simpler. If many path queries matter, LCA or heavy-light decomposition may be a better fit.',
        'The strongest signal is an O(n^2) brute force where each run repeats almost the same tree traversal from a different root. Rerooting asks what summary can cross an edge so the repeated work becomes one upward pass and one downward pass.',
        'Do not force rerooting onto problems where the state changes globally in a nonlocal way. The method works because each edge cut has two clean sides. If the answer depends on arbitrary interactions between distant branches, the merge contract may not exist.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Tree Traversals, DFS, Dynamic Programming, Prefix Sums, Segment Tree merge intuition, Lowest Common Ancestor, Centroid Decomposition, and Compressed Sparse Row Graph. A good exercise is to solve sum of distances first, then rewrite the same idea as a generic rerooting template with merge, lift, and identity functions.',
      ],
    },
  ],
};
