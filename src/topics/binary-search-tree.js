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
