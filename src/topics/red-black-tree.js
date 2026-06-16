// Red-black tree insertion: the balanced binary-search tree behind many
// ordered maps. The color invariant caps the longest root-to-leaf path at
// less than twice the shortest one, so search stays logarithmic.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'red-black-tree',
  title: 'Red-Black Tree',
  category: 'Data Structures',
  summary: 'Binary-search-tree order plus color rules: recolor and rotate after insertions to stay balanced.',
  controls: [
    { id: 'case', label: 'Insertion case', type: 'select', options: ['red uncle: recolor', 'outside child: rotate'], defaultValue: 'red uncle: recolor' },
  ],
  run,
};

function node(id, value, color, x, y) {
  return { id, label: String(value), note: color, x, y, color };
}

function edge(from, to) {
  return { id: `${from}-${to}`, from, to };
}

function tree(nodes, edges, meta = {}) {
  return graphState({ nodes, edges }, meta);
}

function* recolorCase() {
  const baseNodes = [
    node('n10', 10, 'BLACK root', 5, 1),
    node('n5', 5, 'RED parent', 3, 3),
    node('n20', 20, 'RED uncle', 7, 3),
  ];
  const baseEdges = [edge('n10', 'n5'), edge('n10', 'n20')];

  yield {
    state: tree(baseNodes, baseEdges),
    highlight: {},
    explanation: 'Start with a valid red-black tree: it is still a Binary Search Tree, but every node carries a color. The root is black, red nodes cannot have red children, and every path from a node to a null leaf crosses the same number of black nodes. Those color rules are the balance budget.',
  };

  const inserted = [...baseNodes, node('n1', 1, 'RED new', 2, 5)];
  const insertedEdges = [...baseEdges, edge('n5', 'n1')];
  yield {
    state: tree(inserted, insertedEdges),
    highlight: { active: ['n1'], compare: ['n5'] },
    explanation: 'Insert 1 exactly like an ordinary BST: 1 < 10, then 1 < 5, so it becomes the left child of 5. New nodes start red because adding a red node does not immediately increase any black-height count.',
    invariant: 'BST order is never optional: rotations and recoloring must preserve all in-order values.',
  };

  yield {
    state: tree(inserted, insertedEdges),
    highlight: { active: ['n1'], swap: ['n5'], compare: ['n20'] },
    explanation: 'But now a red node has a red child: 5 is red and 1 is red. The uncle, 20, is also red, so this is the cheap case. We do not rotate. We push blackness down one level by recoloring the parent and uncle black.',
  };

  const recolored = [
    node('n10', 10, 'RED grandparent', 5, 1),
    node('n5', 5, 'BLACK', 3, 3),
    node('n20', 20, 'BLACK', 7, 3),
    node('n1', 1, 'RED', 2, 5),
  ];
  yield {
    state: tree(recolored, insertedEdges),
    highlight: { active: ['n10'], sorted: ['n5', 'n20'] },
    explanation: 'Recolor parent and uncle to black, recolor the grandparent to red. The local black-height remains balanced: every path through 5 and 20 still sees the same black count. The only possible remaining violation has moved upward to the grandparent.',
  };

  const finalNodes = [
    node('n10', 10, 'BLACK root', 5, 1),
    node('n5', 5, 'BLACK', 3, 3),
    node('n20', 20, 'BLACK', 7, 3),
    node('n1', 1, 'RED', 2, 5),
  ];
  yield {
    state: tree(finalNodes, insertedEdges),
    highlight: { found: ['n10', 'n5', 'n20', 'n1'] },
    explanation: 'The root must always be black, so 10 flips back to black and the repair stops. Search remains ordinary BST search, but insert paid a small rebalancing tax so future searches do not degrade into a linked list.',
    invariant: 'After repair: root black, no red-red edge, equal black-height on all downward paths.',
  };
}

function* rotationCase() {
  const baseNodes = [
    node('n10', 10, 'BLACK grandparent', 4, 2),
    node('n20', 20, 'RED parent', 7, 4),
  ];
  const baseEdges = [edge('n10', 'n20')];

  yield {
    state: tree(baseNodes, baseEdges),
    highlight: {},
    explanation: 'This time the uncle is a black null leaf. The tree is valid before insertion: 10 is black, 20 is red, and both root-to-null sides have the same black-height. Red-black trees count the invisible null leaves as black.',
  };

  const inserted = [...baseNodes, node('n30', 30, 'RED new', 9, 6)];
  const insertedEdges = [...baseEdges, edge('n20', 'n30')];
  yield {
    state: tree(inserted, insertedEdges),
    highlight: { active: ['n30'], compare: ['n20'] },
    explanation: 'Insert 30 as a normal BST: 30 > 10, then 30 > 20, so it becomes the right child of 20. Again, the new node starts red.',
  };

  yield {
    state: tree(inserted, insertedEdges),
    highlight: { swap: ['n20', 'n30'], active: ['n10'] },
    explanation: 'Now we have a red-red violation, but the uncle is black. Because the new node is an outside child (right child of a right child), one left rotation at the grandparent fixes the shape. If this were an inside child, we would first rotate the parent to convert it into this case.',
  };

  const rotatedNodes = [
    node('n20', 20, 'BLACK new root', 5, 1),
    node('n10', 10, 'RED', 3, 3),
    node('n30', 30, 'RED', 7, 3),
  ];
  const rotatedEdges = [edge('n20', 'n10'), edge('n20', 'n30')];
  yield {
    state: tree(rotatedNodes, rotatedEdges),
    highlight: { active: ['n20'], sorted: ['n10', 'n30'] },
    explanation: 'Rotate left around 10, then recolor: 20 becomes black and moves up; 10 becomes red and moves left; 30 stays red. The in-order sequence is still 10, 20, 30, so the BST contract survived the rotation.',
    invariant: 'Rotations change shape, not sorted order. Recoloring restores the red-black invariants.',
  };

  yield {
    state: tree(rotatedNodes, rotatedEdges),
    highlight: { found: ['n20', 'n10', 'n30'] },
    explanation: 'Done: no red node has a red child, and every path from 20 to a null leaf crosses one black node below the root. The point of the color system is not perfect balance like AVL Tree Rotations; it is cheap-enough balance with very small insertion and deletion repair costs.',
  };
}

export function* run(input) {
  const chosen = String(input.case);
  if (chosen === 'red uncle: recolor') yield* recolorCase();
  else if (chosen === 'outside child: rotate') yield* rotationCase();
  else throw new InputError('Pick a red-black insertion case.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A red-black tree is a self-balancing Binary Search Tree. It stores keys in normal sorted-tree order, then adds one bit of metadata per node: red or black. The colors enforce a loose balance guarantee: no root-to-leaf path is more than twice as long as any other. That is enough to keep search, insert, and delete at O(log n), without the stricter rotation pressure of AVL Tree Rotations.',
        'The five rules are the whole machine: every node is red or black, the root is black, every null leaf is black, red nodes cannot have red children, and every path from a node to descendant null leaves has the same number of black nodes. The animation shows insertion because it is the easiest place to see why the rules work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion begins exactly like an ordinary Binary Search Tree insertion. Walk left for smaller keys, right for larger keys, and attach the new node at a leaf position. The new node starts red. Starting red is conservative: a red node does not change the black-height of any path, so the only rule it can violate is the red-red rule with its parent.',
        'If the parent and uncle are red, recolor them black and recolor the grandparent red. This preserves black-height locally and moves any violation upward. If the parent is red but the uncle is black, use rotations. Outside cases need one rotation at the grandparent. Inside cases need two: rotate the parent first, then rotate the grandparent. After rotation, recolor the new subtree root black and its children red.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search is O(log n) time and O(1) extra space, exactly like any balanced BST. Insert and delete are also O(log n), mostly because the initial search path is O(log n). The fix-up phase performs O(log n) recolor steps in the worst case, but only a constant number of rotations for insertion. That small rotation bound is why red-black trees are often preferred in ordered maps that receive many updates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Red-black trees appear in production runtimes and kernels because they are predictable ordered dictionaries. Java TreeMap and TreeSet are red-black trees. C++ std::map and std::set are typically implemented with a red-black tree. Linux uses red-black trees in subsystems that need ordered scheduling or range lookup. Databases often use B-Trees for disk indexes, but in-memory ordered maps frequently choose red-black trees because pointer-level rotations are cheap.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A red-black tree is not always shallower than an AVL tree. AVL trees maintain tighter balance and can win on read-heavy workloads. Red-black trees usually win when updates are frequent because they rebalance less aggressively. Another trap: rotations must preserve the BST invariant. If a rotation changes the in-order sequence, the tree is broken no matter what the colors say.',
        'The hardest production bug class is deletion, not insertion. Deleting a black node can create a black-height deficit that must be pushed and repaired through sibling cases. Many libraries hide this complexity, but implementing a red-black tree from scratch requires careful tests around delete-min, delete-root, and consecutive deletions.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read AVL Tree Rotations to compare strict height balance against color-based balance. Study B-Trees (How Databases Read) to see why disk and SSD indexes pack many keys per node instead of using binary pointers. Then revisit Skip List, which gets expected O(log n) ordered search without rotations by using probabilistic express lanes.',
      ],
    },
  ],
};
