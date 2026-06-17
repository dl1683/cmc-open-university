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
      heading: 'Why This Exists',
      paragraphs: [
        'A binary search tree is attractive because it keeps keys in sorted order while supporting search, insertion, deletion, predecessor, successor, and range traversal. The problem is that the tree shape depends on update order. Insert sorted keys into a plain tree and the structure can collapse into a linked list.',
        'Once the height becomes linear, every operation that should feel like ordered lookup becomes a scan through a chain. Search, insert, and delete degrade from O(log n) to O(n). A sorted map cannot rely on users to insert data in a friendly order.',
        'A red-black tree exists to keep the tree height under control with small per-node metadata. It adds one color bit to each node and repairs updates with recoloring and rotations. The goal is not perfect balance. The goal is predictable worst-case height with cheap enough maintenance for real ordered maps.',
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The first approach is to use an ordinary binary search tree and hope the data stays mixed. That works for random-looking insertions and small inputs. It is simple, easy to implement, and keeps sorted traversal almost for free.',
        'The next approach is to rebalance aggressively after every update. AVL trees do this by maintaining a tight height condition. They are excellent when lookup speed matters more than update cost, but their stricter balance can require more repair work after modifications.',
        'Red-black trees choose a looser balance rule. They allow the tree to be somewhat uneven, but not so uneven that paths become linear. That looser rule is why they have been common in ordered maps with frequent inserts and deletes.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'A plain tree has no memory of balance pressure. It knows only key order, so it cannot tell the difference between a healthy branching tree and a one-sided chain until operations are already slow.',
        'Perfect balance is also too expensive to maintain directly. Rebuilding or globally reshaping the tree after each insertion would destroy the update performance that made the structure useful in the first place.',
        'The needed condition must be local enough to repair near the update path, strong enough to imply logarithmic height, and compatible with rotations that preserve sorted order. The color rules are that compromise.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is to count black nodes instead of exact height. Every path from a node down to a null leaf must contain the same number of black nodes. Red nodes may appear between black nodes, but a red node cannot have a red child.',
        'Those two rules are enough to bound height. Equal black-height prevents one side from having far fewer black anchors than another. The no-red-red rule prevents a path from stretching by inserting an unlimited run of red nodes between black anchors.',
        'The tree remains a binary search tree throughout. Colors control balance, but key order is still the main invariant: all left keys are smaller, all right keys are larger, and in-order traversal returns the keys sorted.',
      ],
    },
    {
      heading: 'The Color Rules',
      paragraphs: [
        'A red-black tree uses five rules. Each node is red or black. The root is black. The null leaves are treated as black. A red node cannot have a red child. Every path from a node to descendant null leaves has the same black-height.',
        'The null-leaf rule may feel odd at first, but it makes the math and deletion cases consistent. Missing children are not ignored; they are black endpoints for the path count.',
        'Black-height is the balance budget. A red link can make one path longer than another, but red links cannot stack. That gives the tree flexibility without letting the height escape.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'Insertion starts exactly like ordinary binary search tree insertion. Compare the key at each node, move left or right, and attach the new node at a leaf position. The new node starts red because adding a red leaf does not immediately increase the black-height of any root-to-null path.',
        'If the parent is black, insertion is done. The new red child does not break the no-red-red rule, and no path gained a black node. If the parent is red, there is a local violation because a red node now has a red child.',
        'The repair looks at the parent, uncle, and grandparent. If the uncle is red, recolor parent and uncle black, recolor the grandparent red, and continue repairing from the grandparent. If the uncle is black, rotate around the grandparent after possibly rotating the parent to turn an inside case into an outside case.',
        'Rotations are pointer changes that preserve in-order sequence. A left rotation around x moves x down to the left and its right child up. A right rotation is the mirror image. The keys still appear in sorted order; only the local shape changes.',
      ],
    },
    {
      heading: 'Animation Walkthrough',
      paragraphs: [
        'The visual shows two insertion repairs. In the red-uncle case, the new node 1 is inserted under red parent 5 while uncle 20 is also red. Because both parent and uncle are red, the fix is recoloring, not rotation.',
        'Parent 5 and uncle 20 turn black, grandparent 10 turns red, and then the root rule turns 10 back to black. The local black-height stays balanced, and the possible violation has moved upward until it disappears at the root.',
        'In the outside-child case, the new node 30 forms a right-right chain under 10 and 20, and the uncle is a black null leaf. A left rotation around 10 moves 20 up. Recoloring makes 20 black and leaves 10 and 30 red. The sorted order is still 10, 20, 30.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The correctness argument has two parts: sorted order and height. Sorted order survives because insertion follows ordinary BST placement and every rotation preserves the in-order sequence of the affected keys.',
        'The height argument comes from black-height. If a subtree has black-height b, every path to a null leaf has b black nodes. Since red nodes cannot be adjacent, the longest path can have at most one red node between consecutive black nodes. So the longest path is less than twice the length of a black-only path.',
        'A subtree with black-height b contains at least 2^b - 1 internal nodes. That means b is O(log n), and because the full height is at most about 2b, the total height is also O(log n). The tree is not perfectly balanced, but it is balanced enough for worst-case logarithmic operations.',
        'Each insertion repair restores all completed lower subtrees before moving upward. Recoloring preserves local black-height. Rotation plus recoloring repairs the black-uncle shape and stops the red-red problem in that region.',
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        'Search is O(log n) time because it follows one root-to-leaf path. It uses O(1) extra space in an iterative implementation, or O(log n) call-stack space if written recursively.',
        'Insertion and deletion are O(log n) because they first search for a position or node. Insertion may recolor up the tree, but it needs only a constant number of rotations once the decisive black-uncle case is reached. Deletion is more complex because removing a black node can create a black-height deficit.',
        'When n doubles, the height grows by only a small additive amount. That is the practical value of logarithmic height: a million keys are not a million comparisons. The hidden cost is pointer chasing and branchy code, which can be slower than array-based search for small or cache-sensitive data.',
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        'Implement the tree around a small set of invariants, not around memorized case names. After every update, assert BST order, root black, no red-red edge, and equal black-height for all paths in debug builds or tests.',
        'Use sentinel null leaves if they simplify deletion logic. Many bugs come from treating null children inconsistently. If nulls count as black in the theory, the implementation needs a clear way to represent that rule.',
        'Keep rotations boring and well tested. A rotation should update child pointers, parent pointers, and the root pointer when needed, without changing key order. Most red-black tree failures are pointer failures disguised as color failures.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Red-black trees are useful when you need ordered operations with frequent updates: sorted maps, sorted sets, predecessor and successor queries, range iteration, interval indexes, event queues, and scheduler-like structures.',
        'They appear in production libraries because they give deterministic worst-case bounds with small metadata. Java TreeMap and TreeSet are red-black trees. C++ std::map and std::set are commonly implemented with red-black trees. Operating-system kernels have used them in ordered lookup paths where predictable update behavior matters.',
        'They also make a good teaching bridge. They connect simple BST order, local rotations, invariants, worst-case reasoning without amortization, and the engineering tradeoff between strict and loose balance.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'A red-black tree is the wrong structure when exact lookup is all you need and sorted order does not matter. A hash table is usually simpler and faster for that access pattern.',
        'It is also the wrong mental model for disk and SSD indexes. B-trees and B+ trees pack many keys per node to reduce page reads. A binary pointer tree wastes locality by spreading one comparison across many allocations.',
        'For read-heavy in-memory ordered maps, AVL trees can be faster because their stricter balance gives shorter search paths. For append-heavy sorted arrays with rare updates, binary search over an array can beat a tree through cache locality.',
        'The main implementation trap is deletion. Insertion has a small set of memorable cases. Deletion must repair double-black or black-height deficits through sibling cases, and small pointer mistakes can leave a tree that works for many inputs before failing under one deletion sequence.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Binary Search Tree first if the base ordering invariant is not automatic yet. Then study AVL Tree Rotations to compare strict height balance against red-black loose balance.',
        'Study B-Trees and B+ Tree Leaf Sibling Scan to see why databases use wide nodes rather than binary pointer nodes. Study Skip List for another ordered map that gets expected logarithmic search without rotations. Study Treap to see randomized priority as a different way to avoid bad insertion order.',
      ],
    },
  ],
};
