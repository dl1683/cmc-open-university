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
      heading: `Why it exists`,
      paragraphs: [
        `The naive way to "process a tree" is to visit nodes whenever you happen to reach them. That loses the dependency the task cares about. Copying needs parents before children, deletion needs children before parents, sorted output from a BST needs left side before node before right side, and breadth-first work needs all shallow nodes before deeper ones.`,
        `A traversal is a contract about what is known when a node is processed. Depth-first traversals use the call stack to keep unfinished subtrees, while level-order uses a queue to preserve depth order. The correctness argument is the visit invariant: each node is emitted exactly once, and the chosen order is maintained recursively or by FIFO frontier discipline.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "For each traversal, watch when the node itself is emitted relative to its children. In-order waits until the left subtree is done. Pre-order emits the node before descending. Post-order delays the node until both children finish. Level-order ignores recursion and works outward by depth.",
        "The highlighted frontier is the data structure doing the remembering. In recursive depth-first traversal, the call stack remembers ancestors whose right subtrees are unfinished. In iterative traversal, an explicit stack does that job. In level-order traversal, the queue stores the next nodes at the current and next depth.",
        "After each frame, ask what information is guaranteed at the moment a node is visited. That question is the difference between memorizing four names and understanding which traversal a real algorithm needs.",
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Take a search tree with root 8, left child 3, right child 10, and deeper values 1, 6, 14. In-order emits 1, 3, 6, 8, 10, 14 because the search-tree invariant puts smaller keys left and larger keys right. The traversal is not sorting by comparison at runtime; it is harvesting sorted order already encoded in the tree shape.`,
        `Pre-order emits 8 before its descendants, so it is useful when rebuilding shape. A serializer can write the parent first, then enough null markers or subtree sizes to reconstruct children. Post-order emits children before parents, so it fits deletion, freeing memory, evaluating expression trees, and computing subtree sizes. Level-order emits 8, then 3 and 10, then the next layer, which is exactly what UI outlines, shortest-depth searches, and breadth-first diagnostics often need.`,
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
      heading: `Iterative versions`,
      paragraphs: [
        `Recursive code is the cleanest way to learn traversals, but production code often needs iterative forms. A pre-order traversal can push the right child, then the left child, so the left subtree is popped first. In-order traversal pushes a chain of left children, pops the next node, then moves to the right child. Post-order is trickier because the node must wait for both children; common solutions use two stacks, a last-visited pointer, or explicit frame states.`,
        `These iterative forms make the hidden state visible. They also avoid call-stack overflow on deep trees. JavaScript engines do not guarantee tail-call optimization for ordinary recursive tree walks, so hostile or highly skewed input should use an explicit stack or a balanced tree shape.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The proof for depth-first traversal is structural induction. The traversal handles the left subtree correctly, handles the current node at the promised moment, and handles the right subtree correctly. Because every subtree follows the same rule and the base case stops at null children, every reachable node is emitted exactly once.`,
        `The proof for level-order is a queue invariant. Before depth d is processed, the queue contains nodes in left-to-right order for that depth, followed by no deeper nodes ahead of them. Dequeueing a node and enqueuing its children preserves the next depth frontier. That is the same FIFO idea that makes graph BFS find shortest unweighted paths, except trees do not need a visited set unless parent links or sharing are present.`,
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
        `A final mistake is choosing a traversal because it is familiar rather than because it matches the dependency. If parent metadata must exist before child work, choose pre-order. If child summaries must exist before parent work, choose post-order. If sorted search-tree keys are needed, choose in-order. If shallowest nodes must be seen first, choose level-order.`,
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
