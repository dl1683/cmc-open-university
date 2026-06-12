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
    explanation: `The Binary Search Tree has a fatal flaw: feed it sorted input and it degenerates into a linked list — O(n) lookups. The AVL tree (1962, the first self-balancing BST) adds one number per node: the BALANCE FACTOR, bf = height(left) − height(right). Rule: bf must stay in {−1, 0, +1}. The instant an insert pushes any node to ±2, a ROTATION repairs it. Inserting: ${values.join(', ')}.`,
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
        : 'every node stays within {−1, 0, +1} — no repair needed. Most inserts end here.'}`,
      invariant: 'AVL promise: every node\'s subtree heights differ by at most 1.',
    };

    if (culprit) {
      const c = nodes.get(culprit);
      const heavyChild = bf(culprit) > 0 ? c.left : c.right;
      const childBf = bf(heavyChild);
      const sameDirection = (bf(culprit) > 0 && childBf >= 0) || (bf(culprit) < 0 && childBf <= 0);
      let caseName;
      if (sameDirection) {
        caseName = bf(culprit) > 0 ? 'Left-Left → one RIGHT rotation' : 'Right-Right → one LEFT rotation';
        if (bf(culprit) > 0) rotateRight(culprit); else rotateLeft(culprit);
      } else if (bf(culprit) > 0) {
        caseName = 'Left-Right → rotate the child LEFT, then the culprit RIGHT (double rotation)';
        rotateLeft(c.left);
        rotateRight(culprit);
      } else {
        caseName = 'Right-Left → rotate the child RIGHT, then the culprit LEFT (double rotation)';
        rotateRight(c.right);
        rotateLeft(culprit);
      }
      yield {
        state: view(),
        highlight: { found: [parentOf(culprit) === null ? rootId : culprit, culprit].filter((v, i, a) => a.indexOf(v) === i) },
        explanation: `${caseName}. A rotation is three pointer swaps that lift the middle value up and tuck the old parent down — the in-order sequence (sorted order) is PRESERVED, only the shape changes. Balance restored: every bf back inside {−1, 0, +1}.`,
      };
    }
  }

  const finalHeight = height(rootId);
  yield {
    state: view(),
    highlight: { found: [rootId] },
    explanation: `Done: ${values.length} inserts, final height ${finalHeight}${choice.startsWith('10') ? ' — the SORTED input that collapses a plain BST into a height-5 chain built a perfectly balanced tree instead. That is the entire point' : ''}. AVL guarantees height ≤ 1.44·log₂(n), so search/insert/delete are O(log n) FOREVER, worst case included. The trade: rotations on the way up cost a little per write. Red-black trees (inside C++ std::map and Java's TreeMap) relax the balance rule to rotate less; the Skip List gets the same O(log n) with coin flips instead of rotations; the B-Tree applies balance-by-splitting for disks. Same war, four armies.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `An AVL tree is a Binary Search Tree that refuses to become tall and skinny. Every node stores a balance factor: height(left subtree) minus height(right subtree). The allowed values are -1, 0, and +1. When an insert or delete pushes a node to +2 or -2, the tree repairs the local shape with a rotation. The demo shows this directly: after normal BST insertion, it highlights the first unbalanced node and then performs the appropriate single or double rotation.`,
        `Adelson-Velsky and Landis introduced AVL trees in 1962, making them the first published self-balancing search tree. Their point was worst-case protection. A plain Binary Search Tree can turn sorted input into a linked chain, so lookup becomes O(n). An AVL tree keeps height below about 1.44 log2(n + 2), which gives search, insert, and delete O(log n) worst-case time. Big-O Growth Rates is the difference between a lookup path that grows like 20 steps for a million items and one that can grow toward a million.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Insertion begins exactly like Binary Search: compare downward until you find the leaf position. Then the algorithm walks back up, recomputing heights. Four rotation cases cover every possible imbalance. Left-left means a right rotation; right-right means a left rotation. Left-right rotates the child left, then the culprit right. Right-left is the mirror. The visualization's order 30, 20, 10, 40, 50, 25 is chosen to trigger these cases, while the sorted-order option shows the kind of input that destroys an ordinary tree.`,
        `A rotation is not a re-sort. It is a small pointer rearrangement that preserves the in-order sequence, so Tree Traversals would still visit the keys in sorted order. For insertion, fixing the deepest unbalanced node takes one single rotation or one double rotation; deletion can require fixes higher up the path. That local repair is the whole trick: the search order stays the same, but the height drops back under control.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Search takes O(log n) because height is logarithmic. Insert and delete also take O(log n): find the position, update parent links, then repair balance information while returning toward the root. The memory overhead is one height or balance field per node. Compared with Hash Table lookup, AVL is slower for exact-key average-case access, but it preserves sorted order and supports range queries. Compared with B-Trees (How Databases Read), AVL is pointer-heavy and better suited to memory than disk pages.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `AVL trees show up where fast reads and predictable ordered lookup matter. Some in-memory indexes, language runtimes, and teaching libraries use them because their height bound is tighter than looser balanced trees. Database Indexing usually favors B-Trees (How Databases Read), because disk and SSD pages like wide nodes. Skip List structures solve the same sorted-set problem with randomness instead of rotations. The common systems lesson is the same: if input order can be adversarial, the structure must actively prevent degeneration.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `AVL does not mean perfectly level. It means every node's two child heights differ by at most one, which is enough for the logarithmic guarantee. Rotations are also not expensive in themselves; the hard part is updating heights, parent links, and child links without breaking the sorted invariant. Another common mistake is to rotate at the newly inserted leaf. You rotate at the lowest ancestor whose balance factor became invalid. Finally, AVL is not always the right answer: if you only need membership and not order, Hash Table is usually simpler and faster.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Search Tree first so the failure mode is obvious, then Tree Traversals so rotations feel safe rather than magical. Compare AVL Tree Rotations with Skip List and B-Trees (How Databases Read): all three preserve sorted access, but each pays a different maintenance cost. For performance intuition, revisit Binary Search and Big-O Growth Rates, then look at Database Indexing to see why real storage engines choose wider trees.`,
      ],
    },
  ],
};
