// AVL trees: the BST that refuses to degenerate. Every node watches its
// balance factor; the moment one hits ±2, a rotation snaps the tree back
// into shape — O(log n) guaranteed, even against sorted input.

import { treeState, InputError } from '../core/state.js';

export const topic = {
  id: 'avl-tree',
  title: 'AVL Tree Rotations',
  category: 'Data Structures',
  summary: 'Self-balancing in action: balance factors hit ±2 and rotations repair the tree on the spot.',
  controls: [
    { id: 'order', label: 'Insert', type: 'select', options: ['30, 20, 10, 40, 50, 25 (all cases)', '10, 20, 30, 40, 50 (sorted!)'], defaultValue: '30, 20, 10, 40, 50, 25 (all cases)' },
  ],
  run,
};

export function* run(input) {
  const choice = String(input.order);
  const values = choice.startsWith('30') ? [30, 20, 10, 40, 50, 25]
    : choice.startsWith('10') ? [10, 20, 30, 40, 50] : null;
  if (!values) throw new InputError('Pick an insert order.');

  const nodes = new Map();
  let rootId = null;
  let counter = 0;

  const height = (id) => (id === null ? 0 : 1 + Math.max(height(nodes.get(id).left), height(nodes.get(id).right)));
  const bf = (id) => height(nodes.get(id).left) - height(nodes.get(id).right);
  const view = () => treeState([...nodes.values()], rootId);

  yield {
    state: view(),
    highlight: {},
    explanation: `The Binary Search Tree has a fatal flaw: feed it sorted input and it degenerates into a linked list — O(n) lookups. The AVL tree (1962, the first self-balancing BST) adds one number per node: the BALANCE FACTOR, bf = height(left) âˆ’ height(right). Rule: bf must stay in {âˆ’1, 0, +1}. The instant an insert pushes any node to ±2, a ROTATION repairs it. Inserting: ${values.join(', ')}.`,
  };

  const parentOf = (id) => {
    for (const n of nodes.values()) {
      if (n.left === id || n.right === id) return n.id;
    }
    return null;
  };
  const replaceChild = (parentId, oldId, newId) => {
    if (parentId === null) { rootId = newId; return; }
    const p = nodes.get(parentId);
    if (p.left === oldId) p.left = newId; else p.right = newId;
  };
  const rotateLeft = (yId) => {
    const y = nodes.get(yId);
    const x = nodes.get(y.right);
    const parent = parentOf(yId);
    y.right = x.left;
    x.left = yId;
    replaceChild(parent, yId, x.id);
    return x.id;
  };
  const rotateRight = (yId) => {
    const y = nodes.get(yId);
    const x = nodes.get(y.left);
    const parent = parentOf(yId);
    y.left = x.right;
    x.right = yId;
    replaceChild(parent, yId, x.id);
    return x.id;
  };
  const findUnbalanced = () => {
    // deepest node with |bf| >= 2
    let worst = null;
    let worstDepth = -1;
    const walk = (id, depth) => {
      if (id === null) return;
      const n = nodes.get(id);
      if (Math.abs(bf(id)) >= 2 && depth > worstDepth) { worst = id; worstDepth = depth; }
      walk(n.left, depth + 1);
      walk(n.right, depth + 1);
    };
    walk(rootId, 0);
    return worst;
  };

  for (const value of values) {
    const id = `a${counter++}`;
    nodes.set(id, { id, value, left: null, right: null });
    if (rootId === null) {
      rootId = id;
    } else {
      let cur = rootId;
      for (;;) {
        const n = nodes.get(cur);
        const side = value < n.value ? 'left' : 'right';
        if (n[side] === null) { n[side] = id; break; }
        cur = n[side];
      }
    }

    const culprit = findUnbalanced();
    yield {
      state: view(),
      highlight: culprit ? { active: [id], swap: [culprit] } : { active: [id] },
      explanation: `insert(${value}) — plain BST insert first (compare downward, hook in at a leaf). Now audit the balance factors on the path back up: ${culprit
        ? `node ${nodes.get(culprit).value} hits bf = ${bf(culprit)} — VIOLATION. Its ${bf(culprit) > 0 ? 'left' : 'right'} side is two levels deeper than the other.`
        : 'every node stays within {âˆ’1, 0, +1} — no repair needed. Most inserts end here.'}`,
      invariant: 'AVL promise: every node\'s subtree heights differ by at most 1.',
    };

    if (culprit) {
      const c = nodes.get(culprit);
      const heavyChild = bf(culprit) > 0 ? c.left : c.right;
      const childBf = bf(heavyChild);
      const sameDirection = (bf(culprit) > 0 && childBf >= 0) || (bf(culprit) < 0 && childBf <= 0);
      let caseName;
      if (sameDirection) {
        caseName = bf(culprit) > 0 ? 'Left-Left â†’ one RIGHT rotation' : 'Right-Right â†’ one LEFT rotation';
        if (bf(culprit) > 0) rotateRight(culprit); else rotateLeft(culprit);
      } else if (bf(culprit) > 0) {
        caseName = 'Left-Right â†’ rotate the child LEFT, then the culprit RIGHT (double rotation)';
        rotateLeft(c.left);
        rotateRight(culprit);
      } else {
        caseName = 'Right-Left â†’ rotate the child RIGHT, then the culprit LEFT (double rotation)';
        rotateRight(c.right);
        rotateLeft(culprit);
      }
      yield {
        state: view(),
        highlight: { found: [parentOf(culprit) === null ? rootId : culprit, culprit].filter((v, i, a) => a.indexOf(v) === i) },
        explanation: `${caseName}. A rotation is three pointer swaps that lift the middle value up and tuck the old parent down — the in-order sequence (sorted order) is PRESERVED, only the shape changes. Balance restored: every bf back inside {âˆ’1, 0, +1}.`,
      };
    }
  }

  const finalHeight = height(rootId);
  yield {
    state: view(),
    highlight: { found: [rootId] },
    explanation: `Done: ${values.length} inserts, final height ${finalHeight}${choice.startsWith('10') ? ' — the SORTED input that collapses a plain BST into a height-5 chain built a perfectly balanced tree instead. That is the entire point' : ''}. AVL guarantees height â‰¤ 1.44Â·logâ‚‚(n), so search/insert/delete are O(log n) FOREVER, worst case included. The trade: rotations on the way up cost a little per write. Red-black trees (inside C++ std::map and Java\'s TreeMap) relax the balance rule to rotate less; the Skip List gets the same O(log n) with coin flips instead of rotations; the B-Tree applies balance-by-splitting for disks. Same war, four armies.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each node carries a balance factor: bf = height(left subtree) - height(right subtree). A node highlighted as active is the freshly inserted value descending the tree by BST comparison. A node highlighted as swap has bf = +2 or -2 — the imbalanced ancestor that triggered a rotation.',
        'After the rotation fires, the repaired nodes appear as found. The height labels on each node let you verify the balance factor yourself: subtract the right child\'s height from the left child\'s height. If the result is outside {-1, 0, +1}, a rotation is due.',
        'Switch to the sorted-input option to watch the worst case for a plain BST. Every other insert triggers a rotation, yet the tree stays short. That is the entire point of AVL.',
        {type: 'callout', text: 'AVL keeps lookup latency bounded by making every mutation repair shape before height debt can spread.'},
      
        {type: 'image', src: './assets/gifs/avl-tree.gif', alt: 'Animated walkthrough of the avl tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree routes lookups by one rule: smaller keys go left, larger keys go right. The rule preserves order but says nothing about shape. Feed a BST sorted input and it degenerates into a linked list — height equals n, every operation is O(n).',
        'Georgy Adelson-Velsky and Evgenii Landis fixed this in 1962 with the first self-balancing BST. Their paper ("An Algorithm for the Organization of Information," four pages, originally in Russian) added one constraint: every node\'s left and right subtree heights may differ by at most 1. When an insert or delete violates this, a local rotation repairs the shape before the damage propagates. The result is O(log n) height after every operation, guaranteed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A plain BST is the natural ordered container. Insert compares the key downward from the root and attaches it at a leaf. When the tree happens to be balanced, the height is about log n and every operation is fast. For random input, BSTs stay reasonably short — expected height is roughly 4.3 ln n.',
        'This works so well on average that many learners never see the failure. The BST ordering invariant (left < parent < right) is always satisfied, and logarithmic height feels like a free guarantee.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Insert [1, 2, 3, 4, 5] into a plain BST. Each key is larger than the last, so each becomes the right child of the previous one. The tree is a right-leaning chain: height = n, lookup = O(n). It is a linked list wearing a BST label.',
        'This is not a rare edge case. Auto-incrementing primary keys, timestamps, alphabetical names, and sequential IDs all produce nearly-sorted streams. Database bulk loads, log replay, and sorted file imports all hit the worst case. The BST ordering invariant holds, but there is no shape invariant to keep the height short. One sorted batch destroys performance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every node stores a balance factor: bf = height(left) - height(right). The AVL rule requires bf to stay in {-1, 0, +1}. After each insert or delete, walk back up from the modified leaf toward the root, recalculating balance factors. The first ancestor that hits +2 or -2 is the culprit. Its heavy child and grandchild determine which of four rotation cases applies.',
        'Left-Left (LL) case: the culprit has bf = +2 and its left child has bf >= 0. The heavy path runs left-left — a straight line. One right rotation at the culprit fixes it. The left child rises to replace the culprit, and the culprit drops to become the right child. Three pointer swaps, O(1).',
        'Right-Right (RR) case: the mirror of LL. The culprit has bf = -2 and its right child has bf <= 0. One left rotation lifts the right child and drops the culprit to the left.',
        'Left-Right (LR) case: the culprit has bf = +2, but its left child leans right (bf < 0). The heavy path bends: left then right. A single rotation cannot straighten a zigzag. First rotate the left child leftward to convert the bend into a straight LL path, then rotate the culprit rightward. Two rotations, still O(1).',
        'Right-Left (RL) case: the mirror of LR. The culprit has bf = -2 and its right child leans left. Rotate the right child rightward to straighten into RR, then rotate the culprit leftward.',
        {type: 'image', src: 'https://visualgo.net/img/tree_rotation.png', alt: 'Right and left tree rotations used to rebalance AVL trees.', caption: 'A rotation preserves sorted order while changing subtree height, which is the whole repair move in AVL. (Source: visualgo.net)'},
        'Insertion needs at most one single or double rotation — fix the first imbalanced ancestor and everything above it falls back into range. Deletion can require O(log n) rotations because removing a node shortens a subtree and can expose imbalance at multiple ancestors on the way up.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Rotations preserve the BST ordering invariant. In a right rotation at node Z, Z\'s left child Y rises and Z drops to the right. Y\'s right subtree (all values between Y and Z) becomes Z\'s new left child. Every key stays in its correct sorted position — only the shape changes. The same argument mirrors for left rotations.',
        'The height bound comes from the balance invariant applied at every node. The smallest AVL tree of height h has subtrees of height h-1 and h-2 (the loosest allowed imbalance). Call the minimum node count N(h). Then N(h) = N(h-1) + N(h-2) + 1 — the same recurrence as the Fibonacci sequence. Fibonacci numbers grow as phi^h (phi is about 1.618), so inverting gives h <= 1.44 * log2(n + 2). An AVL tree is never more than 44% taller than a perfectly balanced tree.',
        'At most two rotations per insert means the repair cost is constant. The O(log n) walk up to find the culprit dominates, and that walk is bounded by the height, which is itself O(log n). The whole operation — search, insert, rebalance — stays O(log n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search: O(log n), guaranteed. Height is at most 1.44 * log2(n). Doubling the keys adds roughly one comparison. 1,024 keys need at most 15 comparisons; 1,000,000 keys need at most 29.',
        'Insert: O(log n). One descent to find the leaf, O(log n) balance-factor updates walking back up, and at most one rotation (single or double, each O(1)). The constant factor per insert is small.',
        'Delete: O(log n). Same descent and rebalance walk, but deletion can trigger up to O(log n) rotations because shortening a subtree can cascade imbalance upward through multiple ancestors.',
        'Space: O(n). Each node stores one extra integer (the height or balance factor). No auxiliary structures are needed beyond the tree itself.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Read-heavy workloads with ordering requirements. AVL\'s tighter balance (height <= 1.44 log n vs red-black\'s 2 log n) means shorter search paths. When lookups outnumber mutations by a wide margin, those shorter paths add up.',
        'Real-time systems and databases that need worst-case guarantees. AVL delivers O(log n) on every single operation — no amortized exceptions, no unlucky input sequences. Any system that cannot tolerate occasional O(n) spikes benefits from this.',
        'In-memory ordered maps, symbol tables in compilers, and skeletons for interval trees and range trees. Any workload that needs sorted traversal, predecessor/successor queries, or range scans fits AVL naturally.',
        'Some C++ standard library implementations use AVL trees for std::map and std::set, choosing the lookup advantage over the mutation advantage of red-black trees.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Write-heavy workloads favor red-black trees. Red-black trees allow height up to 2 * log2(n) — longer search paths — but their looser invariant means fewer rotations per insert and delete. The Linux kernel\'s rbtree, Java\'s TreeMap, and most C++ std::map implementations chose red-black for this reason. When inserts and deletes dominate, AVL\'s stricter rebalancing costs more than its shorter lookups save.',
        'For exact-key lookup without ordering needs, a hash table is simpler and faster. O(1) amortized beats O(log n) when you never need sorted traversal, range scans, or predecessor queries.',
        'For disk-backed storage, B-trees dominate. A B-tree node holds many keys in one disk page, so one read eliminates a large key range. AVL\'s binary pointer chains cause one disk seek per level — orders of magnitude slower on spinning disks and still worse on SSDs.',
        'AVL also carries per-node storage overhead (one integer for height or balance factor) and implementation complexity. Getting the four rotation cases right, updating heights in the correct order after rotation, and handling deletion cascades are common sources of bugs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert 10 into an empty tree. Root = 10, height = 1, bf = 0.',
        'Insert 20. It goes right of 10 (20 > 10). Tree: 10 -> right 20. bf(10) = 0 - 1 = -1. No violation.',
        'Insert 30. It goes right of 20 (30 > 20). Now bf(10) = 0 - 2 = -2 — violation. The heavy path runs right-right: RR case. Left-rotate at 10: node 20 rises to root, 10 drops to 20\'s left child, 30 stays as 20\'s right child. Result: root = 20, left = 10, right = 30. All balance factors are 0. In-order sequence [10, 20, 30] is preserved.',
        'Insert 25. It goes right of 20 (25 > 20), then left of 30 (25 < 30). Tree: 20 at root, 10 left, 30 right, 25 as left child of 30. bf(30) = 1 - 0 = +1, bf(20) = 1 - 2 = -1. Every node is within {-1, 0, +1}. No rotation needed.',
        'Insert 28. It goes right of 20, left of 30, then right of 25. Now bf(30) = 2 - 0 = +2 — violation. The heavy path goes left (to 25) then right (to 28) — a zigzag. This is the Left-Right (LR) case. A single rotation cannot straighten a bent path. Step 1: left-rotate at 25, which lifts 28 above 25 and straightens the path into left-left form. Step 2: right-rotate at 30, which lifts 28 to replace 30, with 25 as 28\'s left child and 30 as 28\'s right child. The double rotation places the middle value (28) at the top of the repaired subtree. Final tree: root = 20, left = 10, right = 28 (left = 25, right = 30). Every balance factor is back in {-1, 0, +1}.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Adelson-Velsky & Landis, 1962, "An Algorithm for the Organization of Information" — the original four-page paper introducing the AVL tree, the first self-balancing BST. Knuth, The Art of Computer Programming Vol. 3, Section 6.2.3 — height bounds, rotation counts, and Fibonacci trees (the worst-case AVL shape).',
        'Prerequisite: Binary Search Tree — understand the ordering invariant and the shape failure before studying the fix.',
        'Looser balancing, fewer rotations: Red-Black Tree — allows height up to 2 log n, chosen by C++ std::map, Java TreeMap, and the Linux kernel for write-heavy workloads.',
        'Disk-optimized balancing: B-Tree — self-balancing with wide nodes that fit disk pages, the backbone of database indexes.',
        'Randomized alternative: Treap — combines BST ordering with random heap priorities to get expected O(log n) without explicit rotations on every insert.',
        'Amortized alternative: Splay Tree — no balance invariant at all; moves accessed nodes to the root by rotations, giving amortized O(log n) per operation with good cache locality for skewed access patterns.',
      ],
    },
  ],
};

