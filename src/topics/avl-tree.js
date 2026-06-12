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
        `An AVL tree is a self-balancing binary search tree where every node tracks a balance factor: the height of its left subtree minus the height of its right subtree. The invariant is strict: this factor must stay in {−1, 0, +1}. The instant an insertion or deletion causes any node to drift to ±2, a rotation repairs it. Invented in 1962 by Adelson-Velsky and Landis, AVL trees were the first self-balancing BST and remain a textbook example of how to tame the worst case that kills ordinary BSTs (sorted input degenerating into a linked list).`,
        `The key property is height guarantee: an AVL tree with n nodes has height at most 1.44·log₂(n). This means search, insert, and delete operations run in O(log n) time in the absolute worst case, not just on average. There is no input that breaks you — not sorted, not reverse sorted, not adversarial. You pay for this insurance via rotations: every imbalanced insertion or deletion triggers one or two pointer-swap operations to rebalance the tree locally, then height repairs bubble upward only as far as needed.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `When you insert a value, you begin with a plain BST insert: follow the comparison tree downward and hook the new node in as a leaf. Then, walking back up toward the root, you recalculate balance factors and heights. The moment you find a node with |bf| ≥ 2, you have spotted the culprit and must repair it with rotations. There are four cases, distinguished by which subtree is heavy and which direction that heaviness leans. Left-Left (bf = +2, left child also leans left) gets one right rotation: the left child becomes the parent. Right-Right is its mirror: one left rotation. Left-Right (bf = +2, but the left child leans right) requires two rotations: rotate the left child left, then rotate the culprit right. Right-Left is the mirror of that. After any rotation, heights and balance factors refresh, and the walk continues upward. Because rotations preserve in-order sequence (the BST property), the tree remains a valid search structure.`,
        `Each rotation is a simple three-pointer swap: the middle value of three nodes lifts up to become the parent, one child gets a new subtree attachment, and the old parent drops down. Because AVL repair happens at the deepest unbalanced node and nowhere else, and because height repairs above that node diminish the deeper you go up the tree, you never need more than O(log n) rotations per insertion. In practice, many insertions need no rotation at all; when they do, usually one rotation suffices.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Search is O(log n) guaranteed, since the tree height is O(log n). Insert and delete are also O(log n): you traverse the tree in log n steps, perform the BST operation in O(log n) comparisons, and then perform at most two rotations while walking back up. The rebalancing bookkeeping (recalculating heights and balance factors) is O(log n) too. The trade-off is write amplification: a straightforward BST insert is a single pointer assignment, but an AVL insert adds height recomputation, balance-factor checks, and potentially rotations. For read-heavy workloads (many searches, few writes), AVL is overhead; for mixed workloads where you need the worst-case guarantee, AVL is necessary.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Pure AVL trees are rare in production code because red-black trees, which relax the balance constraint, are simpler to implement and rebalance faster on writes. You will encounter AVL's concept everywhere, though: C++ std::map and Java's TreeMap use red-black trees, which apply the same rotation idea with looser rules. Database indices and file systems often use B-Trees, which apply balance-by-splitting rather than rotations but solve the same problem: keeping a sorted structure shallow. Skip Lists achieve the same O(log n) guarantee without rotations at all, using randomization instead. The core idea — "detect imbalance and repair locally" — shows up in load balancing, neural network weight distributions, and anywhere a structure must stay roughly even under adversarial input.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Myth: AVL trees are "perfectly balanced." Wrong. AVL allows balance factors of −1 and +1, so trees can skew slightly; they are balanced enough to guarantee O(log n), not perfectly level. Myth: rotations are slow. Wrong; a rotation is three pointer assignments. The real cost is height recomputation. Myth: you need AVL for every BST. Wrong again; if your input is random or nearly sorted by other means, a plain BST stays shallow. AVL is insurance against worst-case adversarial input. The sneaky trap: implementing rotations correctly is fiddly. The pointer manipulations must preserve BST order and parent links; off-by-one errors silently corrupt the tree. Use visualizations (like the one here) to verify your understanding before coding.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Understand the foundation first: read Binary Search Tree to see how ordinary BSTs fail on sorted input, then Tree Traversals to internalize in-order sequences (the invariant AVL must preserve). Next, explore alternatives: B-Trees (How Databases Read) applies splitting instead of rotations, and Skip List uses randomization instead of tree structure. Finally, for the full trees arc, study how tree selection shapes system design in databases and key-value stores.`,
      ],
    },
  ],
};

