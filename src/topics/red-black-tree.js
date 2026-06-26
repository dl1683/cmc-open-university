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
    explanation: `Start with a valid red-black tree: the root is ${baseNodes[0].label} (${baseNodes[0].note}), with children ${baseNodes[1].label} (${baseNodes[1].note}) and ${baseNodes[2].label} (${baseNodes[2].note}). Every node carries a color. The root is black, red nodes cannot have red children, and every path from a node to a null leaf crosses the same number of black nodes. Those color rules are the balance budget.`,
  };

  const inserted = [...baseNodes, node('n1', 1, 'RED new', 2, 5)];
  const insertedEdges = [...baseEdges, edge('n5', 'n1')];
  yield {
    state: tree(inserted, insertedEdges),
    highlight: { active: ['n1'], compare: ['n5'] },
    explanation: `Insert ${inserted[3].label} exactly like an ordinary BST: ${inserted[3].label} < ${inserted[0].label}, then ${inserted[3].label} < ${inserted[1].label}, so it becomes the left child of ${inserted[1].label}. The new node is colored ${inserted[3].note} because adding a red node does not immediately increase any black-height count.`,
    invariant: 'BST order is never optional: rotations and recoloring must preserve all in-order values.',
  };

  yield {
    state: tree(inserted, insertedEdges),
    highlight: { active: ['n1'], swap: ['n5'], compare: ['n20'] },
    explanation: `But now a red node has a red child: ${inserted[1].label} is ${inserted[1].note} and ${inserted[3].label} is ${inserted[3].note}. The uncle, ${inserted[2].label}, is also ${inserted[2].note}, so this is the cheap case. We do not rotate. We push blackness down one level by recoloring the parent and uncle black.`,
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
    explanation: `Recolor parent ${recolored[1].label} to ${recolored[1].note} and uncle ${recolored[2].label} to ${recolored[2].note}, recolor the grandparent ${recolored[0].label} to ${recolored[0].note}. The local black-height remains balanced: every path through ${recolored[1].label} and ${recolored[2].label} still sees the same black count. The only possible remaining violation has moved upward to the grandparent.`,
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
    explanation: `The root must always be black, so ${finalNodes[0].label} flips back to ${finalNodes[0].note}. Children ${finalNodes[1].label} (${finalNodes[1].note}) and ${finalNodes[2].label} (${finalNodes[2].note}) stay as they are, and leaf ${finalNodes[3].label} remains ${finalNodes[3].note}. Search remains ordinary BST search, but insert paid a small rebalancing tax so future searches do not degrade into a linked list.`,
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
    explanation: `This time the uncle is a black null leaf. The tree is valid before insertion: ${baseNodes[0].label} is ${baseNodes[0].note} and ${baseNodes[1].label} is ${baseNodes[1].note}, and both root-to-null sides have the same black-height. Red-black trees count the invisible null leaves as black.`,
  };

  const inserted = [...baseNodes, node('n30', 30, 'RED new', 9, 6)];
  const insertedEdges = [...baseEdges, edge('n20', 'n30')];
  yield {
    state: tree(inserted, insertedEdges),
    highlight: { active: ['n30'], compare: ['n20'] },
    explanation: `Insert ${inserted[2].label} as a normal BST: ${inserted[2].label} > ${inserted[0].label}, then ${inserted[2].label} > ${inserted[1].label}, so it becomes the right child of ${inserted[1].label}. The new node is colored ${inserted[2].note}.`,
  };

  yield {
    state: tree(inserted, insertedEdges),
    highlight: { swap: ['n20', 'n30'], active: ['n10'] },
    explanation: `Now we have a red-red violation: ${inserted[1].label} (${inserted[1].note}) and ${inserted[2].label} (${inserted[2].note}) are both red, but the uncle of ${inserted[2].label} is black (null). Because ${inserted[2].label} is an outside child (right child of a right child), one left rotation at the grandparent ${inserted[0].label} fixes the shape. If this were an inside child, we would first rotate the parent to convert it into this case.`,
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
    explanation: `Rotate left around ${rotatedNodes[1].label}: ${rotatedNodes[0].label} becomes ${rotatedNodes[0].note} and moves up; ${rotatedNodes[1].label} becomes ${rotatedNodes[1].note} and moves left; ${rotatedNodes[2].label} stays ${rotatedNodes[2].note}. The in-order sequence is still ${rotatedNodes[1].label}, ${rotatedNodes[0].label}, ${rotatedNodes[2].label}, so the BST contract survived the rotation.`,
    invariant: 'Rotations change shape, not sorted order. Recoloring restores the red-black invariants.',
  };

  yield {
    state: tree(rotatedNodes, rotatedEdges),
    highlight: { found: ['n20', 'n10', 'n30'] },
    explanation: `Done: root ${rotatedNodes[0].label} is ${rotatedNodes[0].note}, children ${rotatedNodes[1].label} (${rotatedNodes[1].note}) and ${rotatedNodes[2].label} (${rotatedNodes[2].note}) — no red node has a red child, and every path from ${rotatedNodes[0].label} to a null leaf crosses one black node below the root. The point of the color system is not perfect balance like AVL Tree Rotations; it is cheap-enough balance with very small insertion and deletion repair costs.`,
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
        'Each node is a binary-search-tree node plus one color bit. Red marks a node that is glued to a nearby black node for balancing purposes. Black nodes define the counted levels that keep every root-to-leaf path close in length.',
        'The recolor view shows the red-uncle case. Parent and uncle turn black, grandparent turns red, and the possible violation moves upward. The rotation view shows the black-uncle case, where a local pointer change repairs shape while in-order key order stays unchanged.',
        {type: 'callout', text: 'A red-black tree keeps a BST shallow by enforcing color rules that bound path imbalance, then repairs violations with local recolors and rotations.'},
      
        {type: 'image', src: './assets/gifs/red-black-tree.gif', alt: 'Animated walkthrough of the red black tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree, or BST, stores smaller keys to the left and larger keys to the right. It is fast only when its height is small. Sorted inserts such as 1, 2, 3, 4, 5 turn a plain BST into a chain.',
        'A red-black tree adds local rules that prevent that chain from forming. It does not require perfect balance. It only guarantees that no path becomes more than about twice as long as another, which is enough for worst-case logarithmic operations.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a plain BST. It is easy to implement, keeps keys sorted, and supports predecessor or range queries. With random insertion order, it often stays reasonably shallow.',
        'Another tempting approach is to rebuild the whole tree after it becomes ugly. That can restore balance, but it makes individual updates unpredictable. An ordered map used inside a runtime or kernel needs every operation to stay bounded.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is insertion order. The same set of keys can produce a balanced tree or a linked list depending only on arrival order. A data structure with that weakness cannot promise fast worst-case lookup.',
        'Perfect balance is too expensive to maintain after each update. The repair rule must be local enough to run along the search path, but strong enough to bound height for every possible sequence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Red-black trees encode a balanced multi-key tree inside a binary tree. Red links mean two keys belong to the same conceptual node. Black-height, the number of black nodes on a path to a leaf, represents the real balanced depth.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Red-black_trees_and_2%E2%80%933%E2%80%934_trees.svg', alt: 'Correspondence between 2-3-4 tree nodes and red-black tree encodings', caption: 'The 2-3-4 correspondence shows what red links mean: red children are keys glued into the same multi-key node as their black parent. Source: https://commons.wikimedia.org/wiki/File:Red-black_trees_and_2%E2%80%933%E2%80%934_trees.svg.'},
        'The color rules forbid two red nodes in a row and require equal black-height below each node. Those rules allow some slack, but not enough slack for a linear chain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion starts like ordinary BST insertion. The new node is placed where the search path ends and is colored red. Red is chosen because adding a red node does not change black-height.',
        'If the parent is black, the tree is valid. If the parent is red, the repair checks the uncle. A red uncle causes recoloring; a black uncle causes one rotation or two rotations depending on whether the new node is inside or outside.',
        'A rotation changes parent-child pointers without changing sorted order. In a left rotation, the right child rises and the old parent moves to its left. The in-order sequence remains identical, so the BST contract survives the repair.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Search correctness comes from the BST invariant: left keys are smaller and right keys are larger. Rotations preserve that invariant because they only rearrange a local three-part ordered shape. No key crosses to the wrong side of another key.',
        'The height bound comes from black-height. A path cannot contain two consecutive red nodes, so red nodes can at most double the number of black levels. A subtree with black-height b contains at least 2^b - 1 internal nodes, so b is at most log2(n + 1), and total height is at most 2 log2(n + 1).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, and delete each take O(log n) time because every operation follows one root-to-leaf path plus bounded local repair. Insert performs at most two rotations. Delete repair is harder but still logarithmic.',
        'Space overhead is one color bit per node. When n doubles, the height bound increases by about two levels, not by n. A tree with 1,000,000 keys has height at most about 40 under the standard bound.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Red-black trees are used for ordered maps and sets where worst-case behavior matters. C++ standard-library maps and Java TreeMap are common examples. They support lookup plus ordered operations such as floor, ceiling, and range iteration.',
        'Operating systems also use them when mutation must stay predictable. The Linux kernel uses red-black trees in scheduling and memory-management paths because the data stays ordered while inserts and deletes remain bounded.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For exact lookup without order, a hash table is usually faster and simpler. For disk-backed indexes, a B-tree is better because wide nodes match storage pages and reduce I/O. For tiny sorted collections, an array plus binary search often wins through cache locality.',
        'The implementation tax is deletion and testing. Many bugs appear only after a specific color configuration and delete sequence. The theory is compact, but production code must handle sentinel leaves and mirrored cases carefully.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert 10, then 20, then 30. The first key becomes root and is recolored black. The second key becomes a red right child of 10, which is valid because its parent is black.',
        'The third key becomes a red right child of 20. Now 20 and 30 are consecutive red nodes, and the uncle is the black NIL leaf on the left of 10. This is the outside right-right case.',
        'Left-rotate at 10. The tree becomes 20 as black root with red children 10 and 30. The sorted order is still 10, 20, 30, but the height is 2 instead of a length-3 chain.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Rudolf Bayer, Symmetric Binary B-Trees, 1972; Guibas and Sedgewick, A Dichromatic Framework for Balanced Trees, 1978. CLRS chapter 13 gives the standard insert and delete fixups.',
        'Study next: binary search trees for the ordering invariant, AVL trees for stricter balance, B-trees for page-oriented storage, and splay trees for amortized self-adjusting behavior.',
      ],
    },
  ],
};