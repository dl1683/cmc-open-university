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
      heading: 'Why this exists',
      paragraphs: [
        `A binary search tree gives ordered lookup with a simple rule: smaller keys go left, larger keys go right. The rule is enough to preserve sorted order, but it says nothing about shape. If keys arrive already sorted, each new key becomes the right child of the previous key, and the tree becomes a linked list.`,
        `AVL trees exist to protect ordered search from that shape failure. Every node tracks the height difference between its left and right subtrees. That balance factor must stay at -1, 0, or +1. When an insertion or deletion pushes a node to +2 or -2, a small rotation repairs the local shape before the height problem spreads.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious ordered map is a plain binary search tree. It is easy to implement, supports in-order traversal, and performs well when insert order happens to keep the tree short.`,
        `The wall is adversarial or unlucky input. Insert 10, 20, 30, 40, 50 into a plain BST and the search path has length five. Insert a million increasing keys and the worst lookup can walk a million nodes. The data is ordered, but the structure has stopped being a tree in the useful sense.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Add one shape invariant to the BST invariant. The BST invariant says every left key is smaller and every right key is larger. The AVL invariant says every node's two child heights differ by at most one. Together they give ordered lookup with worst-case logarithmic height.`,
        `Rotations are the repair operation because they change shape without changing sorted order. A rotation lifts the middle key of a local three-node pattern and pushes the old parent down. The in-order traversal stays the same; only the height profile changes.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `Watch each insertion in two phases. First it behaves like a normal BST insertion: compare downward and attach the new value at a leaf. Then the algorithm audits the path back to the root. The highlighted unbalanced node is the lowest ancestor whose balance factor left the allowed range.`,
        `The "all cases" input is chosen to show the four repairs. 30, 20, 10 creates a left-left case and a single right rotation. 40 and 50 create the mirror right-right case and a single left rotation. 25 creates a bent shape, which needs a double rotation because the heavy path turns once before reaching the inserted node.`,
        `The sorted input option shows the reason AVL exists. A plain BST would form a chain. The AVL version keeps rotating as needed, so the final search path stays short even though the insertion order is hostile.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Insertion starts with ordinary BST search. After the new leaf is attached, each ancestor updates its height or balance factor. The first ancestor with balance factor +2 or -2 is the culprit. Its heavy child tells the case.`,
        `Left-left means the culprit is too heavy on the left, and its left child is also left-heavy or balanced. One right rotation fixes it. Right-right is the mirror: one left rotation. Left-right means the culprit is left-heavy but the child leans right; rotate the child left, then rotate the culprit right. Right-left is the mirror double rotation.`,
        `Deletion uses the same invariant but can require more than one repair while walking upward, because removing a node can shorten a subtree and expose imbalance at several ancestors. The visualization focuses on insertion, where the first repaired ancestor is enough to restore the insertion path.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `A rotation preserves sorted order by preserving the in-order sequence. In a right rotation, the left child moves up, the old parent moves down to the right, and the subtree between them becomes the old parent's left child. Every key that was between those two values remains between them. The same argument mirrors for a left rotation.`,
        `The height guarantee comes from the balance invariant at every node. A subtree of height h must contain enough nodes in its two child subtrees, whose heights can differ by at most one. The smallest AVL tree of height h grows like a Fibonacci recurrence, so height grows logarithmically with the number of nodes. That is why search, insert, and delete stay O(log n) in the worst case.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Insert 30, then 20, then 10. The tree is still ordered, but node 30 has balance factor +2 because its left side is two levels deeper than its right side. The heavy path goes left then left, so a right rotation lifts 20, moves 30 down to the right, and keeps 10, 20, 30 in sorted order.`,
        `Now insert 40 and 50. The right side becomes too deep, so the mirror repair lifts 40 with a left rotation. Insert 25 after that and the heavy path bends: the unbalanced node leans left, but its child leans right. The tree first rotates the child to straighten the path, then rotates the culprit. That two-step repair is the left-right case.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Search takes O(log n) because height is logarithmic. Insert and delete also take O(log n): they perform one ordinary search path, update metadata on the way back, and rotate where needed. Insertion needs at most one single or double rotation after the new leaf is attached. Deletion can rotate at multiple ancestors.`,
        `The memory overhead is one height or balance field per node. The implementation overhead is parent and child pointer discipline. Compared with a hash table, AVL is slower for average exact-key lookup but supports sorted traversal, predecessor and successor queries, and range scans. Compared with a B-tree, AVL is pointer-heavy and better suited to memory than disk pages.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `AVL trees win when reads are frequent, order matters, and worst-case lookup time must be tight. They are useful for in-memory ordered maps, teaching libraries, index structures, and any setting where sorted traversal and predictable search depth matter more than minimizing rotations.`,
        `They also teach the central lesson behind self-balancing structures: if input order can be adversarial, the data structure must enforce shape. Hope is not an invariant.`,
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        `AVL is usually the wrong tool when you only need membership or exact-key lookup. A hash table is simpler and usually faster on average. AVL is also a poor match for disk-heavy storage engines, where wide B-tree nodes reduce page reads better than binary pointer chains.`,
        `It may be the wrong balanced tree for write-heavy in-memory maps. Red-black trees keep a looser balance invariant, so they often perform fewer rotations while still guaranteeing O(log n) operations. That is why many standard-library ordered maps use red-black trees rather than AVL trees.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first bug is rotating the wrong node. The repair belongs at the lowest ancestor whose balance factor became invalid, not at the new leaf. The second bug is choosing a single rotation for a bent case. Left-right and right-left patterns need two rotations because the middle value must become the local root.`,
        `The third bug is breaking the BST invariant while fixing height. Rotations are pointer rearrangements with strict ordering constraints. If the middle subtree is attached to the wrong side, the tree may look balanced while lookup returns wrong answers.`,
        `The fourth bug is stale metadata. If heights or balance factors are updated in the wrong order after a rotation, later repairs use false information and the tree can drift out of balance.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Search Tree first so the shape failure is obvious, then Tree Traversals so the rotation proof feels concrete. Compare AVL with Red-Black Tree, Skip List, and B-Trees: all preserve ordered access, but each pays a different maintenance cost. For performance intuition, revisit Binary Search and Big-O Growth Rates, then study Database Indexing to see why storage engines prefer wide trees.`,
      ],
    },
  ],
};
