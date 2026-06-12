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
    'in-order': 'IN-ORDER visits left subtree → node → right subtree. On a binary search tree this produces the values in SORTED order — the structure of the tree does the sorting for you.',
    'pre-order': 'PRE-ORDER visits node → left subtree → right subtree. The node comes FIRST — which is exactly the order you need to copy a tree or serialize it to disk (parents must exist before children).',
    'post-order': 'POST-ORDER visits left subtree → right subtree → node. The node comes LAST — exactly the order for safely deleting a tree (children must be freed before their parent).',
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
      heading: 'What it is',
      paragraphs: [
        `A tree traversal is a systematic way to visit every node in a tree, one at a time. There are four major orders, each designed for a specific job. In-order visits the left subtree, then the node, then the right subtree — on a binary search tree this produces sorted output. Pre-order visits the node first, then its subtrees — perfect for copying or serializing a tree. Post-order visits subtrees first, then the node — the safe way to delete a tree. Level-order visits all nodes at depth d before visiting depth d+1 — also called breadth-first.`,
        `Why four traversals? Because the order matters for different tasks. An in-order walk on a BST magically produces sorted values without any sorting algorithm. A pre-order walk gives you the order you need to rebuild a tree from a sequence. A post-order walk is the only way to safely delete all nodes. Level-order is the natural choice when you want to process a tree in layers, like exploring a maze level by level.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `In-order, pre-order, and post-order are all recursive: they visit the left subtree recursively, the current node, and the right subtree recursively, in different orders. In-order: visit left, process node, visit right. Pre-order: process node, visit left, visit right. Post-order: visit left, visit right, process node. For level-order, instead of recursion, you use a queue: enqueue the root, then repeatedly dequeue a node, process it, and enqueue its children. The queue ensures you process all children before grandchildren.`,
        `The recursive orders can also be implemented iteratively using a stack, though they are more naturally expressed as recursive code. Level-order requires explicit queue management. The choice between orders is determined by what your algorithm needs: need sorted output? Use in-order. Need to rebuild the tree? Use pre-order. Need to delete the tree? Use post-order. Need to explore neighbors first? Use level-order.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `All four traversals visit every node exactly once and every edge exactly twice. With n nodes, the time complexity is O(n) and space complexity is O(h) where h is the height of the tree (for the recursive call stack or explicit queue). In a balanced tree, h = O(log n), but in a degenerate tree (a chain), h = O(n). Level-order uses a queue that can grow to the width of the tree — the maximum number of nodes at any depth.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `In-order traversal on a binary search tree is how databases and file systems list directory contents in sorted order. Pre-order traversal is used to serialize trees to disk and to copy trees in memory, ensuring parents are copied before their children. Post-order traversal is essential for garbage collection and memory cleanup — you must delete children before deleting parents. Level-order traversal is the basis of breadth-first search (BFS), which explores graphs level by level, finds shortest paths, and detects cycles. The JavaScript DOM is a tree; DOM traversal for rendering or event delegation uses these concepts.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Confusing traversal order with insertion order is common. The traversal order is independent of how the tree was built; in-order on a BST is always sorted regardless of insertion order. Another mistake is using the wrong traversal for your task: trying to delete a tree with pre-order will crash because parents are freed before children. Recursion depth can overflow the call stack on very deep trees — you must use an iterative approach with an explicit stack or queue. In level-order traversal, forgetting to enqueue children causes missed nodes. Finally, assuming all traversals have the same performance is wrong: level-order uses extra space for the queue, which can be large in a wide tree.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Search Tree to understand the structure being traversed. Explore Graph BFS, which uses the same level-order idea to traverse graphs instead of trees. Learn about Dijkstra's Shortest Path, which uses similar traversal concepts with priority. Understand the call stack by studying Recursion. Binary Heap uses a different tree structure with different traversal patterns worth comparing.`,
      ],
    },
  ],
};

