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
        explanation: `${value} becomes the root because the tree is empty. Every later insertion will preserve order by comparing downward from this first pivot.`,
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
        explanation: `At ${current.value}, the ordering rule chooses the next subtree: ${value} is ${goLeft ? 'smaller, so only the LEFT side can contain its slot' : value === current.value ? 'equal, and this tree sends duplicates RIGHT because every BST needs a duplicate policy' : 'larger, so only the RIGHT side can contain its slot'}.`,
        invariant: 'For every node: all values in its left subtree are smaller, all in its right subtree are larger or equal.',
      };
      const side = goLeft ? 'left' : 'right';
      if (current[side] === null) {
        nodes.set(id, { id, value, left: null, right: null });
        current[side] = id;
        yield {
          state: snapshot(),
          highlight: { active: [id] },
          explanation: `The ${side} child of ${current.value} is empty, so ${value} becomes a leaf there. The comparison path that placed it is exactly the path a future search for ${value} will retrace.`,
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
      heading: `Why this exists`,
      paragraphs: [
        `A binary search tree exists for dynamic ordered data. You want to insert and delete keys while still asking ordered questions: is this key present, what is the next larger key, what lies between 20 and 40, and how do I iterate in sorted order?`,
        `A sorted array handles the ordered questions well, but middle insertions and deletions shift the suffix. A linked list inserts cheaply but searches linearly. A hash table is fast for exact lookup but gives no sorted order. A BST tries to keep order and updates in the same structure.`,
      ],
    },
    {
      heading: `The reasonable baseline`,
      paragraphs: [
        `The first baseline is a sorted array. Binary search gives O(log n) lookup, and the memory layout is compact. The price is update cost: inserting near the front can move almost every element.`,
        `The second baseline is a linked list. It can splice nodes without shifting an array, but it cannot jump to the middle for search. Finding the insertion point is still O(n).`,
        `The third baseline is a hash table. It is usually better for exact lookup when you do not need order. It cannot answer predecessor, successor, or range queries without extra structure.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is preserving sorted order while allowing local edits. Arrays preserve order globally but pay for insertion with movement. Lists edit locally but lose fast navigation.`,
        `A plain BST has a second wall: shape. The ordering rule says where values belong, but it does not force the tree to stay short. Insert sorted values into an unbalanced BST and the tree becomes a chain.`,
      ],
    },
    {
      heading: `Invariant and layout`,
      paragraphs: [
        `Each node stores a key and two child pointers. Every key in the left subtree is smaller than the node key. Every key in the right subtree is larger, or larger-or-equal if the duplicate policy sends equals right.`,
        `That rule is local, but it applies to every subtree. A subtree is itself a binary search tree with a lower and upper bound inherited from its ancestors.`,
        `The layout is pointer-based, not array-based. Unlike a binary heap, a BST is not required to be complete. Its runtime depends on height, not on the number of nodes alone.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Search starts at the root. If the target equals the current key, search is done. If the target is smaller, move left. If it is larger, move right. A missing child proves absence because the ordering rule would have forced the key down that path.`,
        `Insertion uses the same walk and attaches a new leaf where search falls off the tree. The new node starts with no children, so only the edge from its parent needs to satisfy the ordering rule.`,
        `Deletion has three cases. A leaf can be removed. A node with one child can be replaced by that child. A node with two children is replaced by its in-order successor, the smallest key in the right subtree, or by its in-order predecessor from the left subtree.`,
        `In-order traversal visits left subtree, node, then right subtree. Because the invariant holds recursively, that traversal yields the keys in sorted order.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Search is correct because each comparison proves one entire subtree impossible. If target is smaller than node.key, every key in the right subtree is too large. If target is larger, every key in the left subtree is too small.`,
        `Insertion is correct because it follows the same proof path until it reaches the only missing child where the key can fit. Attaching the key there preserves the ancestor bounds that led to that position.`,
        `Deletion is correct in the two-child case because the successor is the smallest key greater than the deleted node. It can replace the deleted key without violating the left side, and removing it from its old spot is a simpler leaf or one-child deletion.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Search, insert, and delete cost O(h), where h is the height of the tree. A balanced tree has h = O(log n). A degenerate chain has h = O(n).`,
        `The difference is large. A balanced tree with 1,023 nodes has height about 10. A chain with 1,023 nodes can take 1,023 comparisons. Doubling a balanced tree adds about one level; doubling a chain doubles the worst path.`,
        `Space is O(n) for the nodes. Recursive implementations use O(h) stack space. Pointer chasing costs more cache misses than array search, which is one reason static sorted arrays still win when updates are absent.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Balanced BSTs win in sorted maps and sets. They support exact lookup, insertion, deletion, ordered iteration, predecessor, successor, floor, ceiling, and range scans in one structure.`,
        `They are useful when keys change over time and sorted order is part of the API. Examples include in-memory indexes, language runtime maps with ordered semantics, interval structures built on ordered endpoints, and sweep-line algorithms that maintain an active ordered set.`,
        `The plain BST is also the teaching base for AVL trees, red-black trees, treaps, splay trees, and scapegoat trees. Those structures keep the same search invariant and add a rule that repairs shape.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `An unbalanced BST fails under sorted, reverse-sorted, or adversarial insertion order. If worst-case latency matters, use a self-balancing tree instead of hoping the input is random.`,
        `A BST is the wrong default for exact lookup when order is irrelevant. A hash table is usually faster and simpler. A sorted array is often better for static data because binary search is compact and cache-friendly.`,
        `Databases usually use B-trees or B+ trees rather than binary nodes. Storage devices prefer wide nodes that pack many keys into one page; a binary pointer tree wastes page reads.`,
        `Duplicates need a policy before implementation: reject them, count them in the node, or place equals consistently on one side. Deletion, especially the two-child case, needs tests that prove no subtree is lost.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Write the comparison contract first. Decide whether keys are numbers, strings, objects with a comparator, or records with separate key and value fields. Decide how equality behaves before insert, search, and delete are written; changing the duplicate policy later can corrupt traversal order.`,
        `Test the shape-changing cases directly: delete the root, delete a leaf, delete a node with one child, delete a node with two children, insert duplicates, and search for missing keys that fall between existing values. For production ordered maps, prefer a balanced tree from the standard library or a well-tested package instead of a hand-written plain BST.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `Insert 10, 4, 16, 2, 7, and 12. The value 12 goes right from 10 because it is larger, then left from 16 because it is smaller. A later search for 12 follows the same path and never inspects 2, 4, or 7.`,
        `Insert 1, 2, 3, 4, 5 into a plain BST and every value goes to the right child of the previous value. The invariant still holds, but the tree is now a linked list. Correctness survived; performance did not.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Binary Search first for the sorted-order elimination idea. Study Tree Traversals for in-order, pre-order, post-order, and level-order walks. Then study AVL Tree, Red-Black Tree, Treap, Splay Tree, and Scapegoat Tree to see different ways of keeping height under control.`,
        `Compare with Hash Table for unordered exact lookup, B-Tree for storage indexes, Binary Heap for priority-first access, and k-d Tree for search trees over multidimensional points.`,
      ],
    },
  ],
};
