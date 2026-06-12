// Binary search tree: smaller values go left, larger (or equal) go right.
// Every comparison discards an entire subtree — binary search as a shape.

import { treeState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'binary-search-tree',
  title: 'Binary Search Tree',
  category: 'Data Structures',
  summary: 'Insert values by comparing downward, then watch a search skip half the tree at every node.',
  controls: [
    { id: 'values', label: 'Insert (in order)', type: 'number-list', defaultValue: '10, 4, 16, 2, 7, 12, 7' },
    { id: 'target', label: 'Then search for', type: 'number', defaultValue: '12' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  const target = parseNumber(input.target, { label: 'a search target' });

  const nodes = new Map(); // id -> {id, value, left, right}
  let rootId = null;
  let counter = 0;
  const snapshot = () => treeState([...nodes.values()], rootId);

  for (const value of values) {
    const id = `t${counter++}`;
    if (rootId === null) {
      nodes.set(id, { id, value, left: null, right: null });
      rootId = id;
      yield {
        state: snapshot(),
        highlight: { active: [id] },
        explanation: `Insert ${value} into an empty tree — it becomes the root. Every later value will find its place by comparing against it.`,
      };
      continue;
    }

    let currentId = rootId;
    while (true) {
      const current = nodes.get(currentId);
      const goLeft = value < current.value;
      yield {
        state: snapshot(),
        highlight: { compare: [currentId] },
        explanation: `Insert ${value}: compare with ${current.value} — ${value} is ${goLeft ? 'smaller, go LEFT' : value === current.value ? 'equal; this tree sends duplicates RIGHT (a policy every BST must pick)' : 'larger, go RIGHT'}.`,
        invariant: 'For every node: all values in its left subtree are smaller, all in its right subtree are larger or equal.',
      };
      const side = goLeft ? 'left' : 'right';
      if (current[side] === null) {
        nodes.set(id, { id, value, left: null, right: null });
        current[side] = id;
        yield {
          state: snapshot(),
          highlight: { active: [id] },
          explanation: `The ${side} child of ${current.value} is empty — ${value} hooks in right there. The comparisons that led here are exactly the path a future search for ${value} will retrace.`,
        };
        break;
      }
      currentId = current[side];
    }
  }

  // search
  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Now search for ${target}. Notice we never look at the whole tree — each comparison discards an entire subtree, just like binary search discards half an array.`,
  };

  let currentId = rootId;
  const path = [];
  while (currentId !== null) {
    const current = nodes.get(currentId);
    path.push(currentId);
    if (current.value === target) {
      yield {
        state: snapshot(),
        highlight: { found: [currentId], visited: path.slice(0, -1) },
        explanation: `Found ${target} after ${path.length} comparison${path.length === 1 ? '' : 's'} out of ${nodes.size} nodes. In a balanced tree the path length is about log₂(n) — but insert values in sorted order and the "tree" collapses into a chain with O(n) searches. That fragility is why self-balancing trees (AVL, red-black) exist.`,
      };
      return;
    }
    const goLeft = target < current.value;
    yield {
      state: snapshot(),
      highlight: { compare: [currentId], visited: path.slice(0, -1) },
      explanation: `Is it ${current.value}? No — ${target} is ${goLeft ? 'smaller, so it can ONLY be in the left subtree. The whole right side is eliminated' : 'larger, so it can ONLY be in the right subtree. The whole left side is eliminated'} without looking at it.`,
    };
    currentId = goLeft ? current.left : current.right;
  }

  yield {
    state: snapshot(),
    highlight: { visited: path },
    explanation: `Hit a dead end — ${target} is not in the tree, proven after only ${path.length} comparisons. The highlighted path is the only part of the tree we ever touched.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A BST is a node-based ordered structure. Each node stores a value, a left child, and a right child. Everything in the left subtree is smaller than the node; everything in the right subtree is larger. That rule turns comparisons into navigation: smaller goes left, larger goes right, equal follows whatever duplicate policy the implementation chooses.`,
        `The structure is the tree version of Binary Search, but with one huge caveat: the shape matters. A perfectly balanced tree with 1,023 nodes has height 10, so search is short. Insert the same values in sorted order without rebalancing and you get a 1,023-node chain, no better than Linked List for lookup. The data rule gives order; balance gives speed.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Search starts at the root. Compare the target with the current value. Equal means found. Smaller means move to the left child. Larger means move to the right child. Reaching a missing child proves the target is absent, because the ordering rule would have forced the value down that path if it existed.`,
        `Insertion uses the same walk, then attaches a new leaf where the search falls off the tree. Deletion has three cases. A leaf can disappear directly. A node with one child can be replaced by that child. A node with two children needs a replacement value, usually the in-order successor: the smallest value in the right subtree. After copying or moving that successor, the tree must still satisfy the ordering rule everywhere.`,
        `Tree Traversals reveal the hidden sorted order. An in-order traversal - left, node, right - visits values from smallest to largest. Pre-order and post-order are useful for copying, deleting, or serializing tree-shaped data.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Search, insert, and delete cost O(h), where h is the height of the tree. If the tree is balanced, h is O(log n). If it degenerates into a chain, h is O(n). Space is O(n) for the nodes, and recursive operations use O(h) call-stack space. Big-O Growth Rates is the reason self-balancing trees matter: logarithmic height keeps growing slowly, while linear height grows with every inserted value.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Sorted maps and sets often use balanced search trees. C++ std::map is commonly implemented with a red-black tree; Java TreeMap uses a red-black tree too. AVL Tree Rotations show the stricter balancing style, where rotations repair height differences after inserts and deletes. These structures are useful when you need ordered iteration, predecessor/successor queries, or range queries that Hash Table cannot provide.`,
        `Database Indexing usually uses B-Trees (How Databases Read), not simple binary nodes, because disk and SSD pages prefer wide nodes with many keys. Random Forest uses many decision trees for prediction, but those trees split feature space rather than maintaining the exact ordered-set invariant. Binary Heap (Priority Queue) is another tree-shaped structure, yet it optimizes only for the top priority, not full sorted lookup.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The main pitfall is assuming the average picture is guaranteed. A plain unbalanced implementation can be excellent on random insert order and terrible on sorted or nearly sorted insert order. If worst-case latency matters, use a self-balancing tree. Another common mistake is confusing the search-tree property with the heap property: a heap parent beats its children, but the left and right subtrees are not globally ordered around every node.`,
        `Duplicates need a policy before you code. You can reject them, count them inside the node, or consistently place equals on one side. Deletion is also easy to under-test; the two-child case is where many implementations lose subtrees or break the ordering invariant.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Binary Search first if the sorted-order logic is not automatic yet. Then learn Tree Traversals for in-order, pre-order, post-order, and level-order walks. AVL Tree Rotations explains how balance is repaired. Compare with Hash Table for exact lookup, B-Trees (How Databases Read) for databases, and Binary Heap (Priority Queue) for priority-first access.`,
      ],
    },
  ],
};
