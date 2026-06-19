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
      heading: 'How to read the animation',
      paragraphs: [
        'Every node carries a color label -- BLACK or RED. The animation shows two insertion scenarios that trigger the two different repair strategies.',
        'In the recolor case, watch the parent-uncle pair. Both are red, so the fix avoids rotation entirely: parent and uncle turn black, the grandparent turns red, and the violation floats upward. Highlighted "swap" and "compare" nodes mark the red parent and red uncle. When the violation reaches the root, the root simply turns black and the repair ends.',
        'In the rotation case, the uncle is black (a null leaf counts as black). The "swap" highlight marks the red-red chain that triggers a left rotation. The middle value lifts into the grandparent position, the old grandparent drops to its left, and recoloring restores the invariants. Follow the left-to-right layout before and after: the sorted order never changes. Rotations reshape the tree without disturbing the BST contract.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree gives O(log n) search when it is balanced, but its shape depends entirely on insertion order. Insert 1, 2, 3, 4, 5 in sequence and the tree becomes a right-leaning chain -- a linked list where every operation costs O(n).',
        'Rudolf Bayer solved this in 1972 with symmetric binary B-trees: binary trees that encode the structure of 2-3-4 trees using color annotations, so they stay balanced regardless of input order. Leonidas Guibas and Robert Sedgewick reformulated the idea in 1978, named it the red-black tree, and distilled the balance guarantee into five clean invariants. The result: a self-balancing BST with guaranteed O(log n) search, insert, and delete, no matter what order the keys arrive.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use a plain binary search tree. When input arrives in roughly random order, a BST stays reasonably balanced -- height is O(log n) on average, every operation walks one root-to-leaf path, and the code is short. No extra metadata, no rotations, no repair logic.',
        'Textbook examples insert keys like 5, 3, 7, 2, 4, 6, 8 and produce a nicely branching tree. For benign inputs, the plain BST is hard to beat.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sorted or nearly sorted input destroys the plain BST. Insert 1, 2, 3, ..., n and the tree degenerates into a chain of height n. Search goes from O(log n) to O(n). A million sorted keys means a million comparisons per lookup -- no better than a linked list.',
        'The plain BST has no way to detect or correct this. It tracks key order but knows nothing about its own shape. It cannot distinguish a deep chain from a wide tree until operations are already slow.',
        'Perfect balance -- equal-size subtrees at every node -- would fix the shape, but maintaining it requires global restructuring after each insert. The needed rule must be local (repair near the update path), strong (guarantee logarithmic height), and compatible with rotations that preserve sorted order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A red-black tree is a BST where every node carries one extra bit: a color, red or black. Five invariants govern the coloring. (1) Every node is red or black. (2) The root is black. (3) Every leaf (NIL sentinel) is black. (4) A red node must have two black children -- no two consecutive reds on any path. (5) Every path from a given node down to a descendant NIL contains the same number of black nodes. That count is the black-height.',
        'Insert follows ordinary BST placement: compare keys, walk left or right, attach at a leaf position. The new node starts red because adding a red node cannot change the black-height of any path. If the parent is black, the tree is still valid and insertion is done.',
        'If the parent is red, there is a red-red violation. The repair checks the uncle -- the parent\'s sibling. Case 1 (red uncle): recolor parent and uncle black, grandparent red, and repeat the check from the grandparent. No rotation needed. Case 2 (black uncle, inside child): rotate the parent to convert to an outside case. Case 3 (black uncle, outside child): rotate the grandparent, recolor, and stop. Insert needs at most 2 rotations.',
        'A left rotation around node x moves x down-left and lifts x\'s right child into x\'s position. A right rotation is the mirror. Both preserve in-order traversal: the sorted sequence before and after is identical.',
        'Deletion is more involved. Removing a black node creates a black-height deficit. The fixup examines the sibling and its children across four symmetric cases, performing at most 3 rotations and O(log n) recolorings to restore all five invariants.',
      ],
    },
    {
      heading: 'The 2-3-4 tree correspondence',
      paragraphs: [
        'A red-black tree is not an arbitrary set of coloring rules. It is a binary encoding of a 2-3-4 tree, and the correspondence explains why the invariants work.',
        'A 2-3-4 tree is a balanced search tree where each node holds 1, 2, or 3 keys and has 2, 3, or 4 children. It stays perfectly balanced -- every leaf is at the same depth -- because insertions split overfull nodes upward rather than growing the tree downward.',
        'To convert a 2-3-4 node to red-black form: a 2-node becomes a single black node. A 3-node becomes a black node with one red child (the second key). A 4-node becomes a black node with two red children (the outer keys). In every case the black node corresponds to the middle key, and red children are "glued" to it -- they belong to the same 2-3-4 node.',
        'This is why invariant 4 forbids consecutive reds: two reds in a row would mean a 2-3-4 node with more than 3 keys, which is illegal. It is why invariant 5 requires equal black-height on all paths: black nodes are the 2-3-4 tree levels, and a 2-3-4 tree has equal depth on every path. The recolor case (red uncle) corresponds to splitting a 4-node and pushing the middle key up. The rotation cases correspond to redistributing keys in a 3-node.',
        'Once you see the 2-3-4 tree hiding inside, every red-black operation has a clear structural meaning.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sorted order survives because insertion uses standard BST placement and every rotation preserves the in-order sequence.',
        'The height bound follows from black-height. A node with black-height b has exactly b black nodes on every downward path to a NIL. Invariant 4 says at most one red node can sit between consecutive black nodes, so the longest path alternates red and black with length 2b, while the shortest (all-black) path has length b. The longest path is at most twice the shortest.',
        'A subtree with black-height b contains at least 2^b - 1 internal nodes (the all-black, perfectly balanced case). So b <= log2(n + 1), and total height h <= 2 * log2(n + 1). The tree is not as tight as AVL (which guarantees h <= 1.44 * log2(n)), but it is balanced enough for worst-case logarithmic operations.',
        'Recoloring preserves local black-height: flipping a parent-uncle pair from red to black while flipping the grandparent from black to red keeps the same black count on every path through that region. Rotation plus recoloring fixes the black-uncle case in O(1) pointer changes without disturbing the rest of the tree.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search: O(log n) time, O(1) space. One root-to-leaf path, same as any BST.',
        'Insert: O(log n) time. The BST walk is O(log n). Repair walks back up with recoloring (O(log n) worst case) but performs at most 2 rotations, each O(1).',
        'Delete: O(log n) time. Finding and splicing the node is O(log n). The fixup performs at most 3 rotations and may recolor up to O(log n) ancestors.',
        'Space: one bit per node for color. Implementations typically pack the color into a pointer\'s low bit or struct alignment padding, so overhead is near zero.',
        'When n doubles, height grows by about 2. A tree of 1,000 keys has height at most 22. A tree of 1,000,000 keys: at most 40. Doubling the data costs roughly two more comparisons per search.',
        'Compared to AVL: AVL enforces stricter balance (h <= 1.44 * log2(n)), so AVL searches touch fewer nodes on average. But AVL deletion can require O(log n) rotations versus a constant 3 for red-black. Write-heavy workloads favor red-black; read-heavy workloads favor AVL. For small collections the difference is noise.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Linux kernel: the Completely Fair Scheduler (CFS) keys a red-black tree by virtual runtime to select the next process in O(log n). The vm_area_struct tree maps virtual memory regions for fast address lookup during page faults. The kernel\'s epoll implementation also uses red-black trees to manage file-descriptor registrations.',
        'C++ std::map and std::set are red-black trees in both libstdc++ and libc++. The C++ standard mandates O(log n) worst-case insert, find, and erase -- red-black trees meet this with a small, bounded rotation count per operation.',
        'Java TreeMap and TreeSet are red-black trees. They provide a sorted map with navigable operations (floorKey, ceilingKey, subMap) and guaranteed O(log n) performance.',
        'The common thread: any runtime or kernel that needs a general-purpose ordered container with worst-case guarantees and frequent mutation reaches for a red-black tree. The bounded rotation count keeps write costs predictable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For exact-key lookup without sorted order, a hash table is simpler and faster: O(1) expected versus O(log n).',
        'For disk-backed indexes, B-trees and B+ trees win. They pack hundreds of keys per node to match disk page sizes, so one I/O eliminates a large key range. A binary tree wastes one disk read per comparison.',
        'For read-heavy in-memory maps at scale, AVL trees give shorter search paths because of stricter balance. The difference is small but measurable when reads dominate writes.',
        'Implementation complexity is a real tax. Insertion has a manageable number of cases, but deletion must handle black-height deficits through multiple sibling configurations. The color rules are simple; the delete fixup is not. Small pointer mistakes create trees that pass most tests but silently corrupt under specific deletion sequences.',
        'Cache behavior is poor compared to sorted arrays or B-trees. Each node is a separate heap allocation, and pointer-chasing through scattered memory defeats hardware prefetchers. For small ordered collections, binary search over a sorted array is faster in practice.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert 10, 20, 30 into an empty red-black tree. This short sequence triggers both the root-recolor rule and a left rotation, showing the two core repair mechanisms.',
        'Insert 10: the tree is empty, so 10 becomes the root. New nodes start red, but invariant 2 requires a black root. Recolor 10 to black. Tree: 10(B).',
        'Insert 20: 20 > 10, so 20 becomes the right child. 20 is red, parent 10 is black. No red-red violation. Tree: 10(B) with right child 20(R).',
        'Insert 30: 30 > 10, then 30 > 20, so 30 becomes the right child of 20. Now 30 is red and its parent 20 is red -- a red-red violation. The uncle of 30 is 10\'s left child, which is a NIL (black). Black uncle, outside child (right-right): this is the rotation case.',
        'Left-rotate around 10: 20 lifts into the root position, 10 drops to 20\'s left child, 30 stays as 20\'s right child. Recolor 20 black (new root) and 10 red. The in-order sequence is still 10, 20, 30 -- sorted order survived the rotation.',
        'Final tree: 20(B) with left child 10(R) and right child 30(R). Every path from the root to a NIL leaf crosses exactly 1 black node (the root). No red node has a red child. All five invariants hold. Three sorted insertions that would have created a linked list in a plain BST produced a balanced tree of height 2.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bayer, "Symmetric Binary B-Trees: Data Structures and Maintenance Algorithms" (1972) -- the original structure encoding 2-3-4 trees into binary form. Guibas and Sedgewick, "A Dichromatic Framework for Balanced Trees" (1978) -- named the red-black tree and proved the five-invariant height bound. Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 13 -- the standard textbook treatment with full pseudocode for insert and delete fixups. Sedgewick, "Left-Leaning Red-Black Trees" (2008) -- a simplified variant restricting red links to left children, cutting implementation cases at the cost of slightly more rotations.',
        'Prerequisite: study binary search trees if BST insertion and in-order traversal are not yet familiar. Stricter balance alternative: AVL trees enforce a height difference of at most 1 between siblings -- faster search, more rotations on mutation. Disk-oriented generalization: B-trees and 2-3-4 trees, where wide nodes pack many keys per page. Simpler implementation path: left-leaning red-black trees (Sedgewick 2008). Amortized alternative: splay trees, which restructure on every access and give O(log n) amortized cost without storing any balance metadata.',
      ],
    },
  ],
};

