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
      heading: `What it is`,
      paragraphs: [
        `A tree traversal is a disciplined order for visiting every node exactly once. The order is not cosmetic; it determines what information is available when a node is processed. In-order visits left subtree, node, right subtree. Pre-order visits node before children. Post-order visits children before node. Level-order visits nodes by depth from the root.`,
        `On a Binary Search Tree, in-order traversal emits keys in sorted order because every left key is smaller and every right key is larger by invariant. Pre-order is useful for copying or serializing structure because parents appear before descendants. Post-order is useful for deletion and expression evaluation because children finish before parents. Level-order is breadth-first traversal on a tree and uses a Queue instead of the call stack.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The depth-first orders are naturally recursive. To traverse a subtree, handle its left child, its own node, and its right child in the order demanded by the task. Recursion supplies the implicit stack of unfinished calls. The same walks can be written iteratively with an explicit stack, which is safer for very deep or adversarial trees.`,
        `Level-order is different. Enqueue the root. Repeatedly dequeue one node, visit it, and enqueue its children from left to right. That queue discipline guarantees all nodes at depth d appear before any node at depth d + 1. Graph BFS generalizes the same frontier idea to graphs, adding a seen set because graphs can cycle back to previously visited nodes.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Every traversal touches n nodes, so time is O(n). Depth-first space is O(h), where h is tree height: O(log n) for a balanced tree, O(n) for a chain. Level-order space is O(w), where w is maximum width; a complete tree can have about n / 2 nodes on its last level, so the queue can be O(n).`,
        `Edges are not repeatedly searched; each parent-child link is followed a constant number of times. Big-O Growth Rates matters when choosing the tree shape too: a balanced search tree keeps height logarithmic, while sorted insertions into an unbalanced tree can create a linear chain.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Databases and filesystems use ordered index walks related to in-order traversal. Compilers traverse abstract syntax trees in pre-order for analysis passes and post-order for code generation when child results must exist first. Memory managers and destructors use post-order cleanup. Trie (Prefix Tree) autocomplete harvests completions with a subtree walk. Virtual Tree LCA Compression uses DFS entry order to sort marked nodes before building an auxiliary tree. Rerooting DP: All Roots Tree DP uses postorder and preorder passes to reuse subtree results. Binary Heap (Priority Queue) is also tree-shaped, but most heap algorithms navigate by index arithmetic rather than general traversal.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Traversal order is not insertion order. The same inserted values can yield different shapes depending on insertion sequence, and the same shape can be visited in several orders. In-order is sorted only when the tree obeys the search-tree invariant; it is not magically sorted for arbitrary trees. Duplicate-key policy also matters: equal keys must consistently go left, right, or into a count field.`,
        `Another pitfall is recursion depth. A million-node chain can overflow a JavaScript call stack. Use an explicit stack or queue for hostile input. Topological Sort may look like a traversal too, but it runs on directed dependency graphs and chooses in-degree-zero nodes rather than parent-child order.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study the search-tree lesson to connect in-order traversal with sorted output. Queue and Graph BFS explain level-order traversal beyond trees. Recursion explains the implicit call stack behind depth-first walks. Rerooting DP: All Roots Tree DP, Virtual Tree LCA Compression, Trie (Prefix Tree), Binary Heap (Priority Queue), and Topological Sort show how different structures reuse the same visit-each-node discipline for different jobs.`,
      ],
    },
  ],
};
