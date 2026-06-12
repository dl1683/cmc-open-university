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
      heading: 'What it is',
      paragraphs: [
        `A binary search tree is a tree where every node has at most two children (left and right), and the data is organized by a simple rule: all values smaller than a node go in its left subtree, all larger values go in its right subtree. This shape encodes binary search. Instead of searching a sorted array by jumping to the middle, you start at the root and compare: if your target is smaller, go left; if larger, go right. Every comparison eliminates half the remaining tree.`,
        `A BST is self-maintaining: when you insert a new value, the comparison rules automatically place it in the correct position. When you search, you follow the comparisons downward, never looking at irrelevant subtrees. This makes BSTs fast, sorted, and elegant. However, insertion order matters: if you insert values in sorted order, the tree degenerates into a linked list, and all the speed advantages vanish.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To insert a value, start at the root. Compare the value with the current node: if smaller, go left; if larger, go right; if equal, either skip it or insert it anyway (each BST decides its duplicate policy). Follow the comparisons down until you reach an empty slot, then place the new node there. The tree grows depth-first, balanced or unbalanced depending on insertion order.`,
        `To search for a value, start at the root and follow the same comparison logic: smaller goes left, larger goes right. At each node, you compare once and eliminate an entire subtree. Keep going until you find the value or reach an empty slot (proving it is absent). This is why a balanced BST is fast: with n values, the search path is at most about log₂(n) comparisons. Deletion is more complex: you must handle the case where the deleted node has two children, which requires either promoting its successor or its predecessor.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `In a balanced BST, search, insertion, and deletion are all O(log n) because each comparison cuts the search space in half. However, if values are inserted in sorted order, the tree becomes a chain, and all operations degrade to O(n). In-order traversal of a BST returns values in sorted order — this is often a hidden cost if you do not realize you are walking every node. Space complexity is O(n) for n values. Self-balancing variants like red-black trees and AVL trees guarantee O(log n) even in the worst case, at the cost of extra bookkeeping during insertion and deletion.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `BSTs are the foundation of sorted maps and sets in many standard libraries (C++ std::map, Java TreeMap). Databases use variants of BSTs (B-trees, B+ trees) as the core indexing structure for fast range queries and sorted iteration. File systems use BSTs for directory lookups. Game engines use BSTs for spatial partitioning (every node represents a subtree of space). Expression trees, which compilers use to parse and optimize code, are a variant of BSTs. Any system that needs fast search, sorted order, and dynamic insertion benefits from a BST or its balanced variant.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest trap is assuming a BST is always fast — unbalanced trees with O(n) depth are common when insertion order is sorted or nearly sorted. Always use a self-balancing BST (AVL, red-black) if worst-case guarantees matter. Another mistake is confusing a BST with a heap: both are trees, but a heap is shaped like a complete binary tree with a different ordering rule (parent smaller or larger than children), not a BST shape. Trying to implement deletion without handling the two-child case leads to orphaned subtrees. Finally, duplicates complicate the design: some trees reject them, some put them on the right, some have a counter in each node — pick a strategy and stick with it.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Tree Traversals to understand in-order, pre-order, and post-order walks of trees. Explore Binary Heap (Priority Queue) to see a different tree structure with different guarantees. Learn Dijkstra's Shortest Path, which uses a priority queue (often a heap) to select nodes in order of distance. Understand self-balancing variants by reading about Red-Black Trees or AVL Trees. Hash Table provides an alternative to BST for O(1) average lookup without requiring sorted order.`,
      ],
    },
  ],
};

