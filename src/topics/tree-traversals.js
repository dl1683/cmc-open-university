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
