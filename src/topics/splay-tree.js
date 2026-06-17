// Splay tree: every access rotates the touched node to the root.

import { treeState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'splay-tree',
  title: 'Splay Tree',
  category: 'Data Structures',
  summary: 'A self-adjusting binary search tree: every access splays the key to the root, buying amortized logarithmic performance and locality wins.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['zig-zig access', 'working-set behavior'], defaultValue: 'zig-zig access' },
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

function t(nodes, rootId, title) {
  return treeState(nodes, rootId, { title });
}

const startTree = [
  { id: 'n8', value: 8, left: 'n4', right: 'n12' },
  { id: 'n4', value: 4, left: 'n2', right: 'n6' },
  { id: 'n2', value: 2, left: 'n1', right: 'n3' },
  { id: 'n1', value: 1 },
  { id: 'n3', value: 3 },
  { id: 'n6', value: 6 },
  { id: 'n12', value: 12, left: 'n10', right: 'n14' },
  { id: 'n10', value: 10 },
  { id: 'n14', value: 14 },
];

const afterZigZig = [
  { id: 'n2', value: 2, left: 'n1', right: 'n4' },
  { id: 'n1', value: 1 },
  { id: 'n4', value: 4, left: 'n3', right: 'n8' },
  { id: 'n3', value: 3 },
  { id: 'n8', value: 8, left: 'n6', right: 'n12' },
  { id: 'n6', value: 6 },
  { id: 'n12', value: 12, left: 'n10', right: 'n14' },
  { id: 'n10', value: 10 },
  { id: 'n14', value: 14 },
];

const afterZig = [
  { id: 'n1', value: 1, right: 'n2' },
  { id: 'n2', value: 2, right: 'n4' },
  { id: 'n4', value: 4, left: 'n3', right: 'n8' },
  { id: 'n3', value: 3 },
  { id: 'n8', value: 8, left: 'n6', right: 'n12' },
  { id: 'n6', value: 6 },
  { id: 'n12', value: 12, left: 'n10', right: 'n14' },
  { id: 'n10', value: 10 },
  { id: 'n14', value: 14 },
];

function* zigZigAccess() {
  yield {
    state: t(startTree, 'n8', 'Access key 1 in a deep left-left path'),
    highlight: { active: ['n1'], compare: ['n8', 'n4', 'n2'] },
    explanation: 'A splay tree starts as an ordinary binary search tree. Search finds key 1, then the tree pays extra work immediately: it rotates the accessed key toward the root instead of leaving the shape unchanged.',
    invariant: 'The in-order key order must remain sorted after every rotation.',
  };

  yield {
    state: t(afterZigZig, 'n2', 'Zig-zig: rotate grandparent, then parent'),
    highlight: { active: ['n1', 'n2'], found: ['n2'], compare: ['n4', 'n8'] },
    explanation: 'Because 1 is a left child of 2 and 2 is a left child of 4, the splay step uses zig-zig. The double rotation lifts the whole accessed side, reducing the long path more aggressively than one rotation would.',
  };

  yield {
    state: t(afterZig, 'n1', 'Final zig puts the accessed key at the root'),
    highlight: { found: ['n1'], compare: ['n2', 'n4', 'n8'] },
    explanation: 'The last single rotation moves key 1 to the root. Recently touched keys become cheap to touch again, and nearby keys tend to move closer too. This is why splay trees reward temporal and sequential locality.',
  };

  yield {
    state: labelMatrix(
      'Splay steps',
      [
        { id: 'zig', label: 'zig' },
        { id: 'zigzig', label: 'zig-zig' },
        { id: 'zigzag', label: 'zig-zag' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['parent is root', 'one rotation'],
        ['same-side chain', 'two same-direction rotations'],
        ['opposite-side bend', 'two opposite rotations'],
        ['after every access', 'key becomes root'],
      ],
    ),
    highlight: { active: ['zigzig:effect'], found: ['result:effect'] },
    explanation: 'The algorithm has no stored heights, colors, or priorities. Its balancing information is the access sequence itself.',
  };
}

function* workingSetBehavior() {
  yield {
    state: labelMatrix(
      'Access sequence with locality',
      [
        { id: 'a1', label: 'access 8' },
        { id: 'a2', label: 'access 6' },
        { id: 'a3', label: 'access 8' },
        { id: 'a4', label: 'access 10' },
      ],
      [
        { id: 'tree', label: 'tree reaction' },
        { id: 'payoff', label: 'payoff' },
      ],
      [
        ['splay 8 to root', 'hot key cheap'],
        ['splay neighbor 6', 'local cluster rises'],
        ['8 near root already', 'short search'],
        ['10 near root side', 'sequential scan helps'],
      ],
    ),
    highlight: { found: ['a1:payoff', 'a3:payoff'], compare: ['a4:payoff'] },
    explanation: 'Splay trees are adaptive. They do not promise every single access is cheap, but they make repeated and clustered access patterns cheap over time.',
  };

  yield {
    state: t(afterZig, 'n1', 'A hot item is deliberately kept at the root'),
    highlight: { found: ['n1'], compare: ['n2', 'n4', 'n8'] },
    explanation: 'A balanced tree minimizes worst-case height for all keys. A splay tree asks a different question: what if the next query is likely related to the last query? The last accessed key is made the root.',
  };

  yield {
    state: labelMatrix(
      'Amortized promises',
      [
        { id: 'single', label: 'one unlucky access' },
        { id: 'sequence', label: 'long sequence' },
        { id: 'working', label: 'working-set effect' },
        { id: 'static', label: 'static optimality intuition' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['can be O(n)', 'path may be long'],
        ['O(log n) amortized', 'rotations repay future searches'],
        ['recent keys cheaper', 'locality becomes structure'],
        ['frequent keys rise', 'tree adapts without counters'],
      ],
    ),
    highlight: { active: ['sequence:cost', 'working:meaning'], compare: ['single:cost'] },
    explanation: 'The hard idea is amortization. A dramatic restructure on one access is not wasted work; it stores credit in the shape of the tree for later accesses.',
  };

  yield {
    state: labelMatrix(
      'Choose the right tree',
      [
        { id: 'rb', label: 'Red-Black Tree' },
        { id: 'avl', label: 'AVL Tree' },
        { id: 'splay', label: 'Splay Tree' },
        { id: 'treap', label: 'Treap' },
      ],
      [
        { id: 'best', label: 'best when' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['general ordered map', 'predictable height'],
        ['lookup-heavy map', 'stricter balance'],
        ['locality-heavy access', 'amortized, mutates on read'],
        ['split and merge', 'randomized height'],
      ],
    ),
    highlight: { found: ['splay:best'], compare: ['rb:tradeoff', 'treap:best'] },
    explanation: 'Splay trees are a conceptually important counterpoint to AVL and Red-Black trees: not all balance has to be stored in node metadata.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'zig-zig access') yield* zigZigAccess();
  else if (view === 'working-set behavior') yield* workingSetBehavior();
  else throw new InputError('Pick a splay-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'Why splay trees exist',
      paragraphs: [
        'A splay tree exists for workloads where the next lookup is likely to be related to the last one. Many ordered maps are not touched uniformly. Interpreters revisit the same names inside a loop. Editors revisit nearby positions. Caches and symbol tables often have a small working set. A tree that treats every key as equally likely can miss that pattern.',
        'A splay tree is a self-adjusting binary search tree. It stores keys in normal sorted order, but after every search, insertion, or delete helper step, it rotates the touched node to the root. The tree keeps no heights, colors, priorities, or explicit frequency counters. Its only balancing signal is the access sequence itself.',
        'This makes it a useful counterpoint to AVL Tree and Red-Black Tree. Those structures enforce a shape rule after every update. A splay tree allows temporary bad shapes, then proves that the total cost over a long sequence is still good.',
      ],
    },
    {
      heading: 'The obvious BST approach and its wall',
      paragraphs: [
        'The obvious baseline is an ordinary binary search tree. It is simple and supports ordered search, predecessor, successor, insertion, and deletion. But a bad insertion order can create a chain. Then a search can cost O(n), which is no better than scanning a list.',
        'Metadata-balanced trees fix that wall by storing balance information. AVL trees store height balance. Red-black trees store color rules. Treaps store random priorities. These designs aim for predictable height independent of the access pattern.',
        'Splay trees solve a different problem: adapt without storing balance metadata or long-term counters. They use the search path just traversed as the evidence. If a key was worth touching, move it to the root. If nearby keys were on that path, their depths change too. The data structure learns from behavior while staying an ordinary BST.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is to move the accessed node to the root after every access. This is more than move-to-front for a tree. The zig-zig and zig-zag cases compress the path below the accessed node, so the work spent now can shorten later searches.',
        'The invariant is ordinary BST order. Every rotation preserves in-order traversal, so all keys in the left subtree remain smaller than the root and all keys in the right subtree remain larger. Splaying changes depths and parent links. It does not change sorted order.',
        'The performance claim is amortized. One operation can be expensive. A long sequence of operations costs O(log n) amortized per operation. The analysis treats tree shape as stored potential: costly rotations reduce enough potential to help pay for later work.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The zig-zig access view starts with key 1 deep on a left-left path under 8, 4, and 2. The search finds 1 first. Then the tree performs rotations that preserve sorted order while moving the touched node upward.',
        'The middle frame shows why splaying is not just repeated single rotation. In the same-side case, the algorithm rotates the grandparent and then the parent. That lifts a whole side of the path and reduces the long chain more aggressively than moving the node one edge at a time.',
        'The working-set view tells the workload story. Reaccessing 8 is cheap because an earlier operation moved it near the root. Accessing 6 or 10 can also improve because keys near recent accesses often move upward as part of the same restructuring.',
      ],
    },
    {
      heading: 'Rotation mechanics',
      paragraphs: [
        'Search first follows normal BST comparisons. If the key is found, splay that node. If the key is absent, many implementations splay the last node reached. That failed search still carries useful information: the missing key belongs near the final leaf position.',
        'A zig step is used when the node parent is the root. It performs one rotation. A zig-zig step is used when the node and parent are both left children or both right children. It rotates the grandparent, then the parent. A zig-zag step is used when the path bends; it performs two opposite rotations.',
        'Insertion can add the key as in a normal BST and then splay the inserted node. Deletion often splays the target to the root, removes it, and joins the left and right subtrees by splaying the maximum of the left subtree or the minimum of the right subtree into position.',
      ],
    },
    {
      heading: 'Why it is correct',
      paragraphs: [
        'Correctness as a search tree comes from rotations. A rotation is a local rewrite that preserves in-order order. If A < x < B < y < C before a rotation, those ranges remain in the same sorted order after the parent-child relationship changes. Since splaying is only a sequence of rotations, it cannot break the BST invariant.',
        'Correctness as an adaptive structure comes from the final position. Every successful access ends with the touched node at the root. That root placement gives the strongest immediate locality benefit for the last accessed key. Failed searches can splay the last visited node, adapting the boundary where the missing key would have been.',
        'The algorithm does not need stored metadata because it never asks whether a subtree is balanced by height. It only promises that the sequence will be efficient when analyzed over time. The tree may look strange after one operation and still be doing useful accounting work.',
      ],
    },
    {
      heading: 'Why the amortized bound works',
      paragraphs: [
        'A single access can still cost O(n). The standard promise is O(log n) amortized for search, insert, and delete over a sequence. Amortized analysis does not say each operation is cheap. It says expensive operations are paid for by the structural improvement they leave behind.',
        'The proof uses a potential function based on subtree sizes and ranks. When a node is deep in a large path, bringing it up can reduce the potential stored in the tree. The zig-zig and zig-zag rules are designed so the rotations do enough path compression to support that accounting.',
        'This is why the double-rotation cases matter. A naive move-to-root strategy using only single rotations can preserve sorted order, but it does not give the same clean amortized guarantee. Splaying is a specific rotation discipline, not merely a vague preference for hot keys near the top.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'In the visual example, key 1 lies under 8, 4, and 2 on a left-left path. Searching finds 1 at the bottom. Because 1 is a left child of 2 and 2 is a left child of 4, the first splay move is zig-zig.',
        'After zig-zig, 2 rises above 4 and 8, and the path becomes shorter. The final zig rotates 1 above 2, putting 1 at the root. The sorted order is still 1, 2, 3, 4, 6, 8, 10, 12, 14 because rotations only rearrange parent-child links locally.',
        'If the next query is for 1, it is found immediately. If the next query is for 2, 3, or 4, those nodes are also near the top compared with the original shape. This is the locality payoff: one expensive access can prepare several related accesses.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Splay trees win when access has temporal or spatial locality. Repeated keys, nearby keys, and small active working sets are the patterns they are built to exploit. A hot key naturally stays near the root because every touch moves it there again.',
        'They also support split and join cleanly. To split by key, splay the boundary and separate the subtrees. To join two ordered trees where all keys in the left tree are smaller, splay the maximum of the left tree and attach the right tree. This is one reason splaying appears inside dynamic-tree structures such as Link-Cut Tree.',
        'They are valuable as a learning bridge even when another tree is better in production. They teach amortized analysis, locality-aware design, and the idea that balance can come from behavior rather than stored node metadata.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The biggest limit is worst-case latency for a single operation. A lookup can take O(n) before the amortized guarantee has a chance to matter. If a system needs a tight per-request latency bound, AVL Tree, Red-Black Tree, B-tree variants, or skip lists may be easier to reason about.',
        'Reads mutate the structure. That can be awkward for concurrent maps, persistent data structures, snapshot iterators, read-only memory, and APIs that promise lookup has no side effects. A shared splay tree often needs write-style synchronization even for search, which can erase the locality win.',
        'Splay trees can also be less cache-friendly than array-based or page-based structures. They are pointer-heavy, rotate frequently, and can move nodes around in ways that make stable iteration difficult. The abstract operation bound does not guarantee a wall-clock win in a memory-bound program.',
        'They are not a substitute for every balanced tree. If access is uniform, if updates are rare and reads are massive, or if the workload needs predictable shape for debugging and monitoring, a metadata-balanced tree may be the simpler and faster choice.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Implement rotations first and test them as isolated local rewrites. For each rotation, assert that in-order traversal before and after is identical. Most splay-tree bugs are not in the high-level idea; they are parent pointers, subtree transfers, and root updates.',
        'Write the splay loop from the three cases: zig, zig-zig, and zig-zag. Keep the case tests explicit. If the node parent is the root, do zig. If node and parent are on the same side, do zig-zig. If they are on opposite sides, do zig-zag. After each operation, the target should be closer to the root.',
        'For delete, choose one standard strategy and make it visible in tests. A common approach is to splay the target to the root, detach left and right subtrees, then splay the maximum node of the left subtree so it becomes the new root and can take the right subtree as its right child.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Sleator and Tarjan, Self-Adjusting Binary Search Trees, at https://www.cs.cmu.edu/~sleator/papers/self-adjusting.pdf.',
        'Study Binary Search Tree for the ordering invariant, AVL Tree and Red-Black Tree for metadata-based balancing, Treap for randomized balancing and split/merge, Link-Cut Tree for a major use of splaying in dynamic forests, Skip List for randomized ordered maps, and Amortized Big-O Growth Rates for the proof style behind the guarantee.',
      ],
    },
  ],
};
