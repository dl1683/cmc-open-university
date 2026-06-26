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
        'Each circle is a tree node holding a key. The number inside is the stored value. An active (highlighted) node is the freshly inserted value descending the tree by BST comparison -- smaller goes left, larger goes right, until it finds an empty slot and attaches as a leaf.',
        'After the insert lands, the algorithm walks back up toward the root and checks each ancestor\'s balance factor -- defined as bf = height(left subtree) - height(right subtree). A node highlighted as swap has bf = +2 or -2, meaning its subtrees differ in height by two levels. That node is the imbalanced ancestor that triggers a rotation.',
        'After the rotation fires, the repaired subtree appears as found. You can verify balance factors yourself: count the longest downward path from a node\'s left child to a leaf, do the same for the right child, and subtract. If the result is outside {-1, 0, +1}, a rotation is due. Switch to the sorted-input option to watch the worst case for a plain BST -- every other insert triggers a rotation, yet the tree stays short.',
        {type: 'callout', text: 'AVL keeps lookup latency bounded by making every mutation repair shape before height debt can spread.'},

        {type: 'image', src: './assets/gifs/avl-tree.gif', alt: 'Animated walkthrough of the avl tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree (BST) organizes keys by one rule: every key in a node\'s left subtree is smaller, every key in its right subtree is larger. This ordering invariant makes lookup fast -- at each node you compare once and discard an entire subtree. When the tree is roughly balanced, the height is about log2(n) and every operation touches at most that many nodes. For 1,000 keys in a balanced BST, lookup visits about 10 nodes.',
        'The ordering rule says nothing about shape. Feed a BST the sequence [1, 2, 3, 4, 5] and every key becomes the right child of the previous one. The tree is a right-leaning chain with height = n. Lookup is O(n) -- no better than scanning an unsorted array. The ordering invariant holds perfectly, but the shape invariant that would keep operations fast is missing entirely.',
        'Georgy Adelson-Velsky and Evgenii Landis published the fix in 1962 in a four-page paper titled "An Algorithm for the Organization of Information" (originally in Russian). Their idea: augment each node with a balance factor (left height minus right height) and require it to stay in {-1, 0, +1}. When an insert or delete pushes any node to +2 or -2, a local operation called a rotation repairs the shape before the imbalance can spread upward. The result is the first self-balancing BST: O(log n) height after every mutation, guaranteed, regardless of input order.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A plain BST is the natural ordered container. Insert starts at the root, compares the new key against each node, goes left or right, and attaches the key as a leaf when it hits an empty slot. For random input, BSTs behave well -- the expected height is roughly 4.3 * ln(n), which is about 1.4 * log2(n). A million random inserts produce a tree of height roughly 29, and lookups are fast.',
        'This works so well on average that many learners never encounter the failure. The ordering invariant is always maintained, logarithmic height appears to come for free, and the implementation is simple -- no extra bookkeeping, no repair logic, just compare and descend.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Insert [1, 2, 3, 4, 5] into a plain BST. Each key is larger than the last, so each attaches as the right child of the previous one. The tree becomes a right-leaning chain: height = 5, same as n. Lookup for the last element visits every node. It is a linked list wearing a BST label.',
        'This is not a contrived edge case. Auto-incrementing primary keys, timestamps, alphabetical names, and sequential IDs all produce nearly-sorted streams. Database bulk loads, log replay, and sorted file imports all hit this pattern. The BST ordering invariant holds, but without a shape invariant there is nothing preventing the tree from stretching into a chain. A single sorted batch of n inserts turns every subsequent operation into O(n).',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Shape can be repaired locally without breaking order. A rotation is a pointer rearrangement that lifts one node up, pushes another down, and reassigns one subtree between them. The in-order traversal sequence -- the sorted order of all keys -- does not change. Only the tree\'s vertical shape changes. A rotation takes O(1) time: three pointer swaps.',
        'The AVL invariant says: at every node, the heights of the left and right subtrees may differ by at most 1. This is tight enough to guarantee logarithmic height (at most 1.44 * log2(n)), but loose enough that a single rotation or a pair of rotations can always restore it after one insert. The invariant turns an unbounded shape problem into a local repair problem, and rotations are the repair tool.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every node stores a balance factor: bf = height(left subtree) - height(right subtree). The AVL rule requires bf to stay in {-1, 0, +1} at every node. After each insert or delete, walk back up from the modified leaf toward the root, recalculating balance factors. The first ancestor that reaches +2 or -2 is the culprit. Its heavy child and the direction of the grandchild determine which of four rotation cases to apply.',
        'Left-Left (LL) case: the culprit has bf = +2 and its left child has bf >= 0. The excess height runs in a straight line: left, then left again. One right rotation at the culprit fixes it. The left child Y rises to replace the culprit Z, and Z drops to become Y\'s right child. Y\'s old right subtree (keys between Y and Z) becomes Z\'s new left child. Three pointer swaps, O(1).',
        'Right-Right (RR) case: the mirror of LL. The culprit has bf = -2 and its right child has bf <= 0. One left rotation lifts the right child and tucks the culprit down to the left. Same three pointer swaps.',
        'Left-Right (LR) case: the culprit has bf = +2, but its left child leans right (bf < 0). The heavy path bends -- left then right -- forming a zigzag. A single rotation cannot straighten a zigzag because lifting the left child would just shift the bend upward. Fix: first left-rotate the left child to straighten the path into a left-left line, then right-rotate the culprit to complete the repair. Two rotations, still O(1) total.',
        'Right-Left (RL) case: the mirror of LR. The culprit has bf = -2 and its right child leans left. Right-rotate the child to straighten into RR form, then left-rotate the culprit.',
        {type: 'image', src: 'https://visualgo.net/img/tree_rotation.png', alt: 'Right and left tree rotations used to rebalance AVL trees.', caption: 'A rotation preserves sorted order while changing subtree height, which is the whole repair move in AVL. (Source: visualgo.net)'},
        'Insertion needs at most one single or double rotation. Once the deepest imbalanced ancestor is repaired, every ancestor above it falls back into {-1, 0, +1} because the repaired subtree\'s height returns to what it was before the insert. Deletion is different: removing a node shortens a subtree, and the height reduction can propagate upward, exposing imbalance at multiple ancestors. Deletion may require up to O(log n) rotations, one at each level on the path to the root.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Rotations preserve the BST ordering invariant. In a right rotation at node Z, Z\'s left child Y rises and Z drops to the right. Y\'s right subtree T2 contains all keys between Y and Z (by the BST rule), and it becomes Z\'s new left child. Every key stays in its correct sorted position -- only the parent-child relationships change. The same argument holds, mirrored, for left rotations. An in-order traversal before and after the rotation produces the same sequence.',
        'The height bound comes from the balance invariant applied recursively at every node. Consider the smallest possible AVL tree of height h. Its root has subtrees of height h-1 and h-2 (the maximum allowed imbalance). Call the minimum node count N(h). Then N(h) = N(h-1) + N(h-2) + 1. This recurrence mirrors the Fibonacci sequence. Fibonacci numbers grow as phi^h where phi = (1 + sqrt(5)) / 2, approximately 1.618. Inverting gives h <= 1.44 * log2(n + 2). An AVL tree with a million nodes has height at most 29. It is never more than 44% taller than a perfectly balanced tree of the same size.',
        'At most two rotations per insert means the per-insert repair cost is O(1). The O(log n) walk back up to the root to check balance factors dominates, and that walk is bounded by the height, which is itself O(log n). The entire insert operation -- descend, attach, walk back up, rotate if needed -- stays O(log n) worst case.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search: O(log n), guaranteed worst case. Height is at most 1.44 * log2(n). Doubling the number of keys adds roughly one more comparison. Concrete numbers: 1,000 keys need at most 15 comparisons; 1,000,000 keys need at most 29; 1,000,000,000 keys need at most 44.',
        'Insert: O(log n). One descent to find the leaf position (at most h comparisons), one walk back up updating balance factors (at most h nodes), and at most one rotation (single or double, each O(1)). The constant factor is small -- each node visit does one comparison, one height update, and one balance-factor check.',
        'Delete: O(log n). Same descent and rebalance walk as insert, but deletion can trigger up to O(log n) rotations. Removing a node shortens a subtree, and the height decrease can cascade imbalance upward through multiple ancestors, each needing its own rotation. In practice this cascade is rare, but the worst case is real.',
        'Space: O(n). Each node stores one extra integer (the height or balance factor -- one is derivable from the other). No auxiliary hash tables, arrays, or secondary structures are needed. For n nodes, the total overhead is n integers beyond what a plain BST stores.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Read-heavy ordered containers. AVL\'s tighter balance (height <= 1.44 * log2(n) vs. red-black\'s 2 * log2(n)) means shorter search paths. When lookups outnumber mutations by a wide margin -- symbol tables in compilers, in-memory dictionaries, configuration registries -- those shorter paths add up. Some C++ standard library implementations (notably LLVM\'s libc++) use AVL trees for std::map and std::set, choosing the lookup advantage over the mutation advantage of red-black trees.',
        'Real-time systems that need worst-case guarantees. AVL delivers O(log n) on every single operation with no amortized exceptions and no unlucky input sequences. Flight control systems, trading engines, and embedded schedulers that cannot tolerate occasional O(n) spikes use AVL or similar balanced trees precisely because the worst case equals the average case.',
        'Skeleton for augmented tree structures. Interval trees, range trees, and order-statistic trees all start with a balanced BST and add extra data per node. AVL provides the balanced skeleton, and the rotation logic carries over unchanged -- the augmented data is updated during the same rebalance walk. Any workload needing sorted traversal, predecessor/successor queries, or range scans fits AVL naturally.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Write-heavy workloads favor red-black trees. Red-black trees allow height up to 2 * log2(n) -- longer search paths -- but their looser color invariant means fewer rotations per insert (at most two) and per delete (at most three). The Linux kernel\'s rbtree, Java\'s TreeMap, and most C++ std::map implementations chose red-black for this reason. When inserts and deletes dominate, AVL\'s stricter rebalancing costs more than its shorter lookups save.',
        'For exact-key lookup without ordering needs, a hash table is simpler and faster. O(1) amortized average beats O(log n) when the workload never needs sorted traversal, range scans, or predecessor queries. A hash table with 1,000,000 entries resolves a lookup in 1-2 probes on average; an AVL tree needs up to 29 comparisons.',
        'For disk-backed storage, B-trees dominate. A B-tree node holds hundreds of keys in a single disk page, so one disk read eliminates a large key range. AVL\'s binary pointer chains cause one disk seek per level -- an AVL tree of a million keys needs up to 29 seeks, while a B-tree with branching factor 100 needs at most 3. The difference is orders of magnitude on spinning disks and still significant on SSDs.',
        'Implementation complexity is a practical cost. Getting the four rotation cases right, updating heights in the correct order after each rotation, and handling deletion cascades are common sources of bugs. Red-black trees have a comparable bug surface, but simpler balanced structures like treaps or skip lists can be easier to implement correctly for applications that do not need the tightest possible height bound.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert 10 into an empty tree. Root = 10, height = 1, bf = 0. The tree has one node and is trivially balanced.',
        'Insert 20. Compare: 20 > 10, go right. Attach 20 as the right child of 10. Heights: node 20 has height 1, node 10 has height 2. bf(10) = height(left) - height(right) = 0 - 1 = -1. Within {-1, 0, +1}. No rotation needed.',
        'Insert 30. Compare: 30 > 10, go right to 20. Compare: 30 > 20, go right. Attach 30 as the right child of 20. Walk back up: bf(20) = 0 - 1 = -1 (fine), bf(10) = 0 - 2 = -2 (violation). The heavy path runs right-right: this is the RR case. Left-rotate at node 10: node 20 rises to root, node 10 drops to 20\'s left child, node 30 stays as 20\'s right child. Result: root = 20, left = 10, right = 30, all balance factors are 0. The in-order sequence [10, 20, 30] is unchanged -- only the shape changed.',
        'Insert 25. Compare: 25 > 20, go right to 30. Compare: 25 < 30, go left. Attach 25 as the left child of 30. Walk back up: bf(30) = 1 - 0 = +1, bf(20) = 1 - 2 = -1. Every node is within {-1, 0, +1}. No rotation needed. Most inserts end here -- the tree absorbs the new key without any structural repair.',
        'Insert 28. Compare: 28 > 20, go right to 30. Compare: 28 < 30, go left to 25. Compare: 28 > 25, go right. Attach 28 as the right child of 25. Walk back up: bf(25) = 0 - 1 = -1 (fine), bf(30) = 2 - 0 = +2 (violation). The heavy path from 30 goes left to 25, then right to 28 -- a zigzag. This is the Left-Right (LR) case. A single rotation cannot straighten a bent path. Step 1: left-rotate at 25, which lifts 28 above 25 and converts the zigzag into a straight left-left line (30 -> 28 -> 25). Step 2: right-rotate at 30, which lifts 28 to replace 30, with 25 as 28\'s left child and 30 as 28\'s right child. The double rotation places the middle value (28) at the top of the repaired subtree. Final tree: root = 20, left child = 10, right child = 28 (with 25 on its left and 30 on its right). Every balance factor is back in {-1, 0, +1}.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Adelson-Velsky & Landis, "An Algorithm for the Organization of Information," 1962 -- the original four-page paper introducing the AVL tree, the first self-balancing BST. Knuth, The Art of Computer Programming Vol. 3, Section 6.2.3 -- height bounds, rotation counts, and Fibonacci trees (the sparsest possible AVL shape, which defines the worst-case height).',
        'Prerequisite: Binary Search Tree. Understand the ordering invariant (left < parent < right) and the shape failure (sorted input produces a chain) before studying the fix. The AVL tree is a direct response to the BST\'s shape problem, and the rotation mechanics assume you already know how BST insert and delete work.',
        'Looser balancing, fewer rotations: Red-Black Tree. Allows height up to 2 * log2(n), chosen by C++ std::map, Java TreeMap, and the Linux kernel for write-heavy workloads. The color invariant is weaker than AVL\'s height invariant, trading taller trees for cheaper mutations.',
        'Disk-optimized balancing: B-Tree. Self-balancing with wide nodes that pack many keys into a single disk page, the backbone of database indexes (MySQL InnoDB, PostgreSQL, SQLite). The branching factor reduces height from log2(n) to log_b(n), drastically cutting disk seeks.',
        'Randomized alternative: Treap. Combines BST ordering with random heap priorities to achieve expected O(log n) height without explicit balance factors or rotation case analysis. Simpler to implement than AVL at the cost of probabilistic rather than guaranteed bounds.',
        'Amortized alternative: Splay Tree. No balance invariant at all. Every access rotates the accessed node to the root, giving amortized O(log n) per operation and good cache locality for skewed access patterns where some keys are accessed far more often than others.',
      ],
    },
  ],
};

