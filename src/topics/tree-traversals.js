// Tree traversals: four different orders to visit every node — and why
// each one exists. In-order on a BST comes out sorted; level-order is a
// queue in action; pre/post-order are how you copy and delete trees.

import { treeState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'tree-traversals',
  title: 'Tree Traversals',
  category: 'Data Structures',
  summary: 'In-order, pre-order, post-order, and level-order — four ways to walk a tree, each with a job.',
  controls: [
    { id: 'values', label: 'Tree values (insert order)', type: 'number-list', defaultValue: '8, 3, 12, 1, 6, 10, 14' },
    { id: 'order', label: 'Traversal', type: 'select', options: ['in-order', 'pre-order', 'post-order', 'level-order'], defaultValue: 'in-order' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  const order = input.order;

  // Build a BST silently — insertion is its own topic (Binary Search Tree).
  const nodes = new Map();
  let rootId = null;
  let counter = 0;
  for (const value of values) {
    const id = `t${counter++}`;
    nodes.set(id, { id, value, left: null, right: null });
    if (rootId === null) { rootId = id; continue; }
    let cur = nodes.get(rootId);
    for (;;) {
      const side = value < cur.value ? 'left' : 'right';
      if (cur[side] === null) { cur[side] = id; break; }
      cur = nodes.get(cur[side]);
    }
  }
  const snapshot = () => treeState([...nodes.values()], rootId);

  const intros = {
    'in-order': 'IN-ORDER visits left subtree â†’ node â†’ right subtree. On a binary search tree this produces the values in SORTED order — the structure of the tree does the sorting for you.',
    'pre-order': 'PRE-ORDER visits node â†’ left subtree â†’ right subtree. The node comes FIRST — which is exactly the order you need to copy a tree or serialize it to disk (parents must exist before children).',
    'post-order': 'POST-ORDER visits left subtree â†’ right subtree â†’ node. The node comes LAST — exactly the order for safely deleting a tree (children must be freed before their parent).',
    'level-order': 'LEVEL-ORDER visits the tree one level at a time, left to right — also called breadth-first. No recursion here: it runs on a QUEUE.',
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `${intros[order]} Watch the output sequence grow as we visit.`,
  };

  const visited = [];
  const output = [];
  const visit = function* (id, note) {
    const node = nodes.get(id);
    visited.push(id);
    output.push(node.value);
    yield {
      state: snapshot(),
      highlight: { active: [id], visited: visited.slice(0, -1) },
      explanation: `Visit ${node.value}. ${note} Output so far: [${output.join(', ')}].`,
    };
  };

  if (order === 'level-order') {
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift();
      const node = nodes.get(id);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
      yield* visit(id, `Dequeue it, then enqueue its children — the queue (front to back: ${queue.length ? queue.map((q) => nodes.get(q).value).join(', ') : 'empty'}) guarantees this level finishes before the next begins.`);
    }
  } else {
    const walk = function* (id) {
      if (id === null) return;
      const node = nodes.get(id);
      if (order === 'pre-order') yield* visit(id, 'Node first, THEN its subtrees.');
      yield* walk(node.left);
      if (order === 'in-order') yield* visit(id, 'Left subtree done — the node goes between its left and right.');
      yield* walk(node.right);
      if (order === 'post-order') yield* visit(id, 'Both subtrees done — only now does the node itself get visited.');
    };
    yield* walk(rootId);
  }

  const outro = {
    'in-order': `[${output.join(', ')}] — sorted! That is not a coincidence: in-order + BST = sorted output, always. This is how databases read an index in order.`,
    'pre-order': `[${output.join(', ')}] — every parent appears before its children. Feed this sequence back into BST insertion and you rebuild the exact same tree.`,
    'post-order': `[${output.join(', ')}] — every child appears before its parent. The root comes dead last, the only safe moment to delete it.`,
    'level-order': `[${output.join(', ')}] — top to bottom, left to right. This is breadth-first search wearing its tree costume; the same queue trick explores graphs, mazes, and shortest paths.`,
  };

  yield {
    state: snapshot(),
    highlight: { visited },
    explanation: `Done: ${outro[order]}`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows the same binary search tree visited in four different orders. Active means the current node is being emitted, and visited means the node has already been placed in the output sequence.',
        'In-order emits left subtree, node, then right subtree. Pre-order emits node before children, post-order emits children before node, and level-order emits all nodes at one depth before moving deeper.',
        'The safe inference depends on the order. In a binary search tree, in-order output is sorted because every left key is smaller and every right key is larger; in level-order, the queue proves that no deeper node can leave before a shallower one.',
        {type: 'callout', text: 'Traversal order is a dependency contract: it decides whether a node is processed before children, after children, between subtrees, or by depth.'},
        {type: 'image', src: './assets/gifs/tree-traversals.gif', alt: 'Animated walkthrough of the tree traversals visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A tree traversal is a rule for visiting every node exactly once. The rule matters because different tasks need different information available at the moment a node is processed.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Sorted_binary_tree_ALL_RGB.svg/330px-Sorted_binary_tree_ALL_RGB.svg.png', alt: 'Binary search tree showing traversal paths in different colors.', caption: 'Traversal diagrams make the invisible order visible: the same tree can emit different sequences depending on where the node visit happens. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'Sorted output needs left before node before right. Copying needs parents before children, deletion needs children before parents, and breadth-first work needs shallow nodes before deeper nodes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to process a node whenever the walk first reaches it. That gives pre-order, which is useful for copying, but it is wrong for sorted output and unsafe for deletion.',
        'Another common shortcut is to use recursion without naming the order. That hides the real contract: the placement of the visit line relative to recursive calls determines the algorithm.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A tree does not have one natural output sequence. The same shape can emit several correct sequences, and only the task tells you which one is correct.',
        'The wall appears when the traversal order violates a dependency. If a parent summary needs child values, pre-order is too early; if children need parent context, post-order is too late.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Traversal is dependency scheduling on a tree. Move the node visit before, between, after, or across levels, and you change what is known when work happens.',
        'Depth-first traversal uses a stack, often the call stack, to remember unfinished ancestors. Level-order traversal uses a queue so first-in shallow nodes leave before children that were discovered later.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In-order recursively walks left, visits the node, then walks right. Pre-order visits first, then recurses left and right; post-order recurses first and visits last.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Sorted_binary_tree_breadth-first_traversal.svg/250px-Sorted_binary_tree_breadth-first_traversal.svg.png', alt: 'Binary search tree annotated in breadth-first traversal order.', caption: 'Breadth-first traversal shows why level-order needs a queue: every node at one depth must leave before children at the next depth. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'Level-order enqueues the root, then repeatedly dequeues one node, visits it, and enqueues its children from left to right. The queue is the data structure that preserves depth order.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Depth-first correctness follows by structural induction. If the left and right subtrees are traversed correctly and the current node is emitted at the promised moment, then the whole subtree is correct.',
        'Level-order correctness follows from the queue invariant. Before processing depth d, the queue holds the depth-d nodes in left-to-right order, and enqueuing their children appends the depth d + 1 frontier behind them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every traversal touches each of n nodes once, so time is O(n). Depth-first space is O(h), where h is tree height, because the stack holds one root-to-leaf path.',
        'Level-order space is O(w), where w is maximum width. In a complete tree, the last level can hold about n / 2 nodes, so the queue can grow linearly even though the algorithm still visits each node once.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Databases and search trees use in-order traversal to read keys in sorted order. Serializers and clone routines use pre-order because the parent must exist before children can attach to it.',
        'Expression evaluators, compilers, destructors, and subtree-size computations use post-order because child results must exist first. UI outlines, shortest-depth searches, and graph BFS use level-order queue discipline.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'In-order is sorted only for a tree that obeys the binary search tree invariant. On an arbitrary binary tree, in-order is just a left-node-right walk with no sorting guarantee.',
        'Recursive traversal can overflow the JavaScript call stack on a million-node chain. Use an explicit stack or queue for adversarial depth, or use a balanced tree to keep height under control.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For insertion order 8, 3, 12, 1, 6, 10, 14, the root is 8, the left subtree contains 3 with children 1 and 6, and the right subtree contains 12 with children 10 and 14.',
        'In-order emits 1, 3, 6, 8, 10, 12, 14. Pre-order emits 8, 3, 1, 6, 12, 10, 14; post-order emits 1, 6, 3, 10, 14, 12, 8; level-order emits 8, 3, 12, 1, 6, 10, 14.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study binary search trees to understand why in-order becomes sorted, and study recursion to understand the implicit call stack behind depth-first traversal. Study queues and graph BFS to see level-order generalized beyond trees.',
        'Then study tries, heaps, topological sort, rerooting DP, and virtual tree compression. Each reuses the same idea that visit order encodes a dependency contract.',
      ],
    },
  ],
};
