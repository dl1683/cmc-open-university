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
      heading: 'How to read the animation',
      paragraphs: [
        'The zig-zig access view starts with a nine-node BST holding keys 1 through 14, rooted at 8. Highlighted (active) nodes trace the search path down to the target. Found markers land on nodes that have reached their final position after a rotation. Compare markers flag nodes whose depth changed as a side effect -- they were not the target, but the rotation moved them anyway.',
        'Each frame applies one of three rotation cases: zig (single rotation when the target\'s parent is the root), zig-zig (two same-direction rotations when target and parent sit on the same side), or zig-zag (two opposite rotations when the path bends). In every frame, check that in-order sorted order survives the rotation and notice how bystander nodes also drift toward the root. The working-set view replaces the tree with access-sequence tables showing how repeated or clustered lookups become cheaper over time.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Real workloads are skewed. An interpreter inside a tight loop hits the same variable names over and over. A text editor touches nearby buffer positions. A DNS cache serves the same popular domains. If 90 percent of lookups hit 10 percent of the keys, a tree that treats every key as equally important ignores free information.',
        'Sleator and Tarjan published the splay tree in 1985 to turn that information into structure. After every search, insert, or delete, the tree rotates the accessed node all the way to the root. There are no stored heights, no color bits, no random priorities -- zero per-node metadata beyond the key and two child pointers. The access pattern itself is the only balancing signal, and the result is O(log n) amortized time per operation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The textbook fix for unbalanced BSTs is to store explicit balance information. AVL trees record height differences at each node and rotate when the difference exceeds one. Red-black trees paint nodes red or black and enforce coloring rules that bound height to 2 log(n+1). Both guarantee O(log n) worst-case time for every individual operation.',
        'These are strong general-purpose ordered maps. The cost is that they are workload-blind. Look up the same key a million times and each lookup still walks the full O(log n) path, because the tree\'s shape is optimized for the worst possible access pattern, not the one actually happening.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Balanced trees maintain their shape invariants for every node, including nodes that are never accessed again. That is their strength for worst-case bounds, but it is wasted effort when the workload has locality. An AVL tree cannot move a hot key closer to the root just because it was accessed recently -- doing so would violate the height-balance invariant.',
        'Meanwhile, a plain BST with no rebalancing at all degenerates into a linked list under sorted insertion: insert 1, 2, 3, ..., n and every search costs O(n). The question is whether there is a middle path -- a tree that adapts to the workload without storing any balance metadata at all.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'After every access, rotate the touched node to the root using a specific discipline of paired rotations. Not naive single rotations -- those preserve BST order but fail to compress long paths. The splay discipline uses zig-zig and zig-zag double rotations that halve the depth of every node along the access path. The expensive deep traversal pays for itself by restructuring the tree so that future traversals of the same region are cheap.',
        'The only invariant is standard BST order: left subtree keys are smaller, right subtree keys are larger, and every rotation preserves in-order traversal. Splaying changes depths and parent-child links but never changes the sorted sequence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a normal BST search: compare the target against each node and walk left or right until you find the key (or reach a null pointer). Then splay the found node (or the last visited node) to the root by processing the access path in pairs of edges, bottom to top.',
        'Zig: the target\'s parent is the root. A single rotation lifts the target into the root position. This case fires at most once per splay, at the very end, when the remaining path has odd length.',
        'Zig-zig: the target and its parent are both left children (or both right children). Rotate the grandparent first, then the parent. The order matters -- rotating the grandparent first compresses the entire same-side chain, roughly halving every node\'s depth along it. Two independent single rotations applied bottom-up would not achieve the same compression and would break the amortized bound.',
        'Zig-zag: the path bends -- the target is a left child of a right child, or the reverse. Two rotations in opposite directions straighten the bend and lift the target by two levels.',
        'Repeat zig-zig or zig-zag until the target\'s parent is the root (then finish with zig) or the target is the root. For insertion, insert normally and then splay the new node. For deletion, splay the doomed node to the root, remove it, then join the left and right subtrees by splaying the predecessor (or successor) of the deleted key to the root of the left (or right) subtree and attaching the other side.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is inherited from rotations. A single rotation swaps a parent-child pair while keeping in-order order intact: if A < x < B < y < C held before, it holds after. Splaying is a sequence of rotations, so BST order is preserved throughout.',
        'The amortized bound uses a potential function. Assign each node x a rank equal to log2 of the number of nodes in x\'s subtree. The tree\'s potential is the sum of all ranks. Sleator and Tarjan showed that the amortized cost of splaying a node x is at most 3(rank(root) - rank(x)) + 1. Since rank(root) = log2(n) and rank(x) is at most log2(n), the amortized cost per splay is O(log n). When a splay reaches deep into a degenerate chain, it does a lot of rotations -- but those rotations compress the chain and drop the potential by a large amount, banking credit that makes future operations cheap.',
        'The zig-zig rotation order is the key to the proof. Rotating the grandparent before the parent creates enough potential drop in same-side chains. A naive move-to-root strategy using only single rotations preserves BST order but does not reduce potential fast enough -- it yields O(n) amortized, not O(log n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Any single splay can cost O(n) -- the target might sit at the bottom of a degenerate chain of n nodes. But any sequence of m operations on an n-node splay tree costs O(m log n) total. Amortized per-operation cost: O(log n) for search, insert, and delete.',
        'Space per node is two child pointers and the key. No height field, no color bit, no priority. A splay node is smaller than an AVL or red-black node by at least one word.',
        'The working-set theorem sharpens the bound: if only k distinct keys appear in the last t accesses, those t operations cost O(t log k). The tree automatically promotes hot keys, so the effective size is the active working set, not the total number of stored keys. Access 10 keys out of a million-node tree and you pay log(10) per access, not log(1,000,000).',
        'The static optimality conjecture, open since 1985, claims splay trees match the best possible fixed BST for any access sequence within a constant factor. Proven partial results include the scanning theorem (accessing all n keys in sorted order costs O(n), not O(n log n)) and the dynamic finger theorem (the cost of accessing key y after key x depends on log of the rank distance between them, not on n).',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Splay trees fit anywhere access patterns have temporal or spatial locality. Windows NT\'s virtual memory manager used splay trees for page table lookups because active memory regions cluster. GCC\'s older memory allocator used splay trees to track free blocks. Network routers have used them for route caches where a small set of destination prefixes dominates traffic.',
        'Split and join are unusually clean. To split a splay tree at key k, splay k to the root and detach the two subtrees -- O(log n) amortized. To join two trees where all keys in the left tree are smaller, splay the left tree\'s maximum to the root and attach the right tree as its right child. This cleanness makes splay trees the internal engine of Sleator and Tarjan\'s link-cut trees, which maintain dynamic forests with O(log n) amortized operations and underpin efficient max-flow and dynamic connectivity algorithms.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Worst-case latency is O(n) per operation. Real-time systems, latency-sensitive servers, and interrupt handlers cannot tolerate an occasional linear-time lookup. Use AVL trees, red-black trees, or B-trees when every individual operation must be bounded.',
        'Every read mutates the tree. A search triggers rotations, so a "read-only" lookup acquires a write lock in concurrent code. This rules out splay trees for lock-free concurrent maps, persistent (immutable) data structures, snapshot iterators, and any API contract that promises side-effect-free lookup.',
        'Sequential access of all n keys in a non-adaptive order (say, accessing 1, n, 2, n-1, 3, n-2, ...) can cause each individual access to cost O(n), even though the amortized bound over the full sequence is O(n log n). The sequence is legal; the individual operations are painful.',
        'Cache behavior is poor. Splay trees are pointer-chasing structures that rotate on every access, scattering nodes across memory. B-trees, sorted arrays, and van Emde Boas layouts often beat splay trees on wall-clock time for in-memory workloads because they respect cache lines, even when their abstract comparison count is higher.',
        'Uniform workloads gain nothing. If every key is equally likely, splaying just adds rotation overhead on top of a search that a balanced tree would handle with less work and no mutation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with a nine-node tree rooted at 8. Left subtree: 4 with children 2 and 6. Node 2 has children 1 and 3. Right subtree: 12 with children 10 and 14. We access key 1, sitting at depth 3 on the path 8 -> 4 -> 2 -> 1.',
        'First, identify the splay case at node 1. Its parent is 2 (left child of 4), and 1 is the left child of 2. Parent and child are both on the left side -- this is zig-zig. Rotate the grandparent (4) right: 2 moves up to where 4 was, 4 becomes 2\'s right child, and 4 adopts 2\'s former right child (3) as its new left child. Then rotate the new parent (2) right: 1 moves up to where 2 was, 2 becomes 1\'s right child. The subtree now has 1 at the top, 2 to its right, 4 to 2\'s right, with 3 and 6 below 4. Node 8 is still the overall root, with 1 as its left child.',
        'Now node 1\'s parent is the root (8). Parent is root, so this is a zig. One right rotation on 8: node 1 becomes the root, 8 becomes 1\'s right grandchild (hanging off 2 -> 4 -> 8 path), and 8 keeps its original right subtree (12, 10, 14). In-order traversal: 1, 2, 3, 4, 6, 8, 10, 12, 14 -- identical to the original, confirming BST order survived.',
        'Result: key 1 is now the root. The next access to key 1 costs one comparison. Keys 2, 3, and 4 also moved closer to the root -- they used to sit at depths 2, 3, and 1, and now sit at depths 1, 2, and 2 respectively. The deep path was compressed, not just for the target but for every node along it. If the workload keeps hitting small keys, future accesses pay less than they would in the original balanced shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'D.D. Sleator and R.E. Tarjan, "Self-Adjusting Binary Search Trees," Journal of the ACM, 32(3), 1985. Defines the three rotation cases, proves the O(log n) amortized bound via the potential method, and states the static optimality conjecture. R.E. Tarjan, "Amortized Computational Complexity," SIAM Journal on Algebraic and Discrete Methods, 6(2), 1985. Formalizes the potential method framework used in the splay tree proof and across amortized analysis generally.',
        'Prerequisite: Binary Search Tree -- the ordering invariant and single-rotation mechanics that splay trees build on.',
        'Contrasting alternatives: AVL Tree gives O(log n) worst case per operation at the cost of storing and maintaining per-node height differences. Red-Black Tree offers a looser balance invariant with O(log n) worst case and is the standard-library choice in C++ (std::map) and Java (TreeMap).',
        'Extensions: Treap randomizes balance via heap-ordered priorities and supports clean split/merge but does not adapt to access patterns. Skip List provides expected O(log n) search with a different structure entirely -- a layered linked list instead of a tree. Link-Cut Tree uses splay trees internally to maintain dynamic forests in O(log n) amortized time.',
      ],
    },
  ],
};
