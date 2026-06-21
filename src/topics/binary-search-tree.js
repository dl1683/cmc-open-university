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
      heading: 'How to read the animation',
      paragraphs: [
        'Each circle is a node holding one numeric key. Lines connect parents to children: left children sit to the left, right children to the right. The tree grows downward from a single root.',
        'During insertion, the highlighted node is the comparison point. The algorithm asks one question at each node: is the new value smaller (go left) or larger (go right)? The path of comparisons ends at an empty slot, where the new value becomes a leaf.',
        'During search, the highlighted node is the current candidate. Visited nodes (dimmed) mark the path already checked. When a subtree is not entered, every key inside it was eliminated by a single comparison at the parent. The found marker means the target matched. If the search reaches a missing child, the target is provably absent: the ordering rule would have forced it down exactly this path if it existed.',
        {type: 'callout', text: 'A BST is editable binary search: each comparison chooses a subtree, but only balanced height preserves the logarithmic promise.'},
        {type: 'image', src: 'https://courses.grainger.illinois.edu/cs225/fa2021/assets/notes/bst/bstsearch.png', alt: 'Binary search tree search path with left and right decisions.', caption: 'Search follows one comparison path and ignores the rejected subtree. (Source: courses.grainger.illinois.edu)'},
      
        {type: 'image', src: './assets/gifs/binary-search-tree.gif', alt: 'Animated walkthrough of the binary search tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree gives you sorted order and dynamic updates in the same structure. You can insert keys, delete keys, search for keys, iterate in sorted order, answer range queries, and find predecessors and successors -- all without rebuilding anything.',
        'A sorted array handles the ordered queries well: binary search finds any key in O(log n), and range scans are a contiguous slice. But the array is rigid. A hash table handles exact lookups in O(1) on average, but it cannot answer "what is the next key after 42?" without scanning everything. A BST bridges the gap: binary search on a shape you can edit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Keep data in a sorted array. Binary search gives O(log n) lookup. Predecessor, successor, and range queries are trivial because everything sits contiguously in order. Min is the first element. Max is the last. For data that never changes, this is hard to beat.',
        'The cost appears when the data moves. Inserting a key into the middle of a sorted array shifts every later element one position right: O(n) work. Deleting shifts them left: O(n) again. With 1,000,000 records and frequent updates, each insert or delete moves hundreds of thousands of elements even though only one key changed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A sorted array cannot give both fast search and fast insertion. Binary search needs contiguous random-access memory to jump to the midpoint, so the array must stay packed. But staying packed means every insert shifts a suffix. A linked list fixes the shift cost (just rewire pointers), but loses random access, so search drops to O(n).',
        'The core tension: you need a structure where one comparison eliminates half the remaining candidates and inserting a new key touches only a few pointers. Arrays give the first property but not the second. Linked lists give the second but not the first.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The BST property: for every node, all keys in its left subtree are strictly smaller and all keys in its right subtree are larger or equal. This holds recursively -- every subtree is itself a valid BST.',
        'Search starts at the root. If the target equals the current key, return it. If smaller, move to the left child. If larger, move to the right child. If you reach a null pointer, the key is absent. Each step follows one edge downward, so search costs O(h) where h is the height.',
        'Insertion follows the same comparison path from root to a null pointer, then attaches the new key as a leaf there. The path that placed the key is exactly the path a future search will retrace. Only the parent\'s child pointer changes; nothing else in the tree moves.',
        {type: 'image', src: 'https://courses.grainger.illinois.edu/cs225/fa2021/assets/notes/bst/insert.png', alt: 'Inserting a new key into a binary search tree by comparisons.', caption: 'Insertion is search for the null slot where the key must live. (Source: courses.grainger.illinois.edu)'},
        'Finding the minimum means following left children from the root until there are no more. Finding the maximum means following right children. In-order traversal (left subtree, node, right subtree) visits every key in sorted order.',
        'Deletion has three cases. Case 1 -- leaf: the node has no children. Remove it by setting the parent\'s pointer to null. Case 2 -- one child: the node has exactly one child. Replace the node with that child; the child inherits the deleted node\'s position and all ordering constraints are preserved. Case 3 -- two children: the node has both a left and a right child. You cannot simply remove it because both subtrees need a parent. The fix: find the in-order successor (the smallest key in the right subtree -- follow left pointers from the right child until you hit null). Copy the successor\'s key into the node being deleted. Then delete the successor from its original position. The successor is the leftmost node in some subtree, so it has at most one child (a right child), which reduces to Case 1 or Case 2.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Search correctness follows from the BST property. If the target is smaller than the current key, every key in the right subtree is at least as large, so none can match. The search only discards subtrees that provably cannot contain the target.',
        'Insertion correctness follows from the same logic. The comparison path leads to the unique null slot where the new key belongs. Attaching it there preserves every ancestor\'s ordering constraint because the path of comparisons already proved the key fits between those bounds.',
        'Deletion correctness in the two-child case rests on the choice of successor. The in-order successor is the smallest key strictly greater than the deleted node. Replacing the deleted key with the successor preserves the left subtree (all keys still smaller than the replacement) and the right subtree (all keys still larger, minus the successor which was moved up). Removing the successor from its old spot is a leaf or one-child deletion, both already correct.',
        'In-order traversal produces sorted output by induction. The left subtree contains all smaller keys and is traversed first. The current key comes next. The right subtree contains all larger keys and is traversed last. Each subtree is itself a BST, so the same argument applies recursively down to single nodes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, and delete each cost O(h), where h is the tree\'s height. In a balanced tree, h = floor(log2(n)), so all operations are O(log n). In a degenerate tree (a chain), h = n and every operation is O(n).',
        'The gap matters. A balanced BST with 1,000,000 keys has height about 20. A chain with 1,000,000 keys needs up to 1,000,000 comparisons. Doubling the keys in a balanced tree adds one level; doubling a chain doubles the worst-case path.',
        'Average case with random insertion order: the expected height is about 4.31 * log2(n) (Reed, 2003). For 1,000 random keys, expected height is roughly 43 versus the optimal 10. Workable but 4x the ideal, and any non-random pattern can push it toward linear.',
        'Space is O(n). Each node stores a key and two child pointers. Pointer chasing means more cache misses than binary search on a packed array, which is why sorted arrays still win for static, read-heavy data. Recursive implementations also use O(h) stack space.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Balanced BSTs power the ordered map and set in most standard libraries. C++ std::map and std::set use a red-black tree. Java TreeMap and TreeSet do the same. These give O(log n) insert, delete, and lookup, plus sorted iteration, floor, ceiling, predecessor, successor, and range queries -- operations a hash table cannot support at all.',
        'BSTs underlie sweep-line algorithms (maintaining a sorted active set), interval trees (finding overlapping intervals), and order-statistic trees (answering "what is the k-th smallest element?"). Database indices sometimes use BST-derived structures, though B-trees dominate on disk because wide nodes reduce page reads.',
        'Whenever the access pattern involves ordered operations -- "give me everything between 20 and 40," "what is the next key after this one," "iterate from smallest to largest" -- a BST-based structure is the natural fit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Without balancing, a BST degenerates under sorted, reverse-sorted, or adversarial input. Insert [1, 2, 3, ..., n] and the tree becomes a right-leaning chain with O(n) operations. If worst-case guarantees matter, use AVL trees or red-black trees instead of hoping the input is random.',
        'For exact-key lookup when order is irrelevant, a hash table is simpler and faster. O(1) average access beats O(log n), and hash tables have better cache behavior because they use contiguous arrays internally. If you never need predecessor, successor, range scan, or sorted iteration, a BST adds complexity for no benefit.',
        'On disk-backed storage, binary nodes waste page reads. Each pointer chase loads a new page for a single key comparison. B-trees and B+ trees pack hundreds of keys per node so one page read eliminates a large range, which is why databases use them instead.',
        'Repeated Hibbard deletions (always replacing with the in-order successor) can gradually skew an initially random tree, degrading expected height over time (Knuth, TAOCP Vol 3, Section 6.2). Alternating between successor and predecessor replacement, or using a balanced variant, avoids this drift.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert [8, 3, 10, 1, 6, 14, 4, 7] into an empty BST. 8 is first, so it becomes the root. 3 < 8, go left, empty slot -- 3 becomes left child of 8. 10 > 8, go right, empty slot -- 10 becomes right child of 8. 1 < 8, go left to 3; 1 < 3, go left, empty slot -- 1 becomes left child of 3. 6 < 8, go left to 3; 6 > 3, go right, empty slot -- 6 becomes right child of 3. 14 > 8, go right to 10; 14 > 10, go right, empty slot -- 14 becomes right child of 10. 4 < 8, go left to 3; 4 > 3, go right to 6; 4 < 6, go left, empty slot -- 4 becomes left child of 6. 7 < 8, go left to 3; 7 > 3, go right to 6; 7 > 6, go right, empty slot -- 7 becomes right child of 6.',
        'The tree now has 8 at the root, left subtree rooted at 3 (children 1 and 6, where 6 has children 4 and 7), and right subtree rooted at 10 (right child 14). In-order traversal: 1, 3, 4, 6, 7, 8, 10, 14 -- sorted.',
        'Deletion Case 1 (leaf): delete 1. Node 1 has no children. Set 3\'s left pointer to null. Done.',
        'Deletion Case 2 (one child): delete 10. Node 10 has one child (14). Replace 10 with 14. Now 8\'s right child is 14 directly.',
        'Deletion Case 3 (two children): delete 3. Node 3 has two children: left child 1 (already removed above, so now absent) and right child 6. For the full two-child case, imagine 1 is still present. Node 3 has children 1 (left) and 6 (right). Find the in-order successor of 3: go to the right child (6), then follow left pointers -- 6\'s left child is 4, and 4 has no left child, so 4 is the successor. Copy 4 into the node that held 3. Delete the original 4 from its old position -- 4 was a leaf (or had only a right child), so removal is Case 1 or Case 2. The tree now has 4 where 3 was, with left child 1 and right child 6 (whose left child is gone, right child is 7). In-order traversal: 1, 4, 6, 7, 8, 10, 14 -- still sorted.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/BST_node_deletion.png/500px-BST_node_deletion.png', alt: 'Binary search tree deletion cases with successor replacement.', caption: 'Two-child deletion preserves order by moving the successor into the removed node position. (Source: Wikimedia Commons)'},
        'Degenerate case: insert [1, 2, 3, 4, 5, 6, 7, 8] into an empty BST. Every value is larger than the last, so every insertion goes right. The tree becomes a right-skewed chain of height 7. Searching for 8 takes 8 comparisons instead of 3. Same keys, different order, completely different performance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hibbard 1962 ("Some Combinatorial Properties of Certain Trees With Applications to Searching and Sorting") introduced the standard deletion algorithm for BSTs. Knuth 1973 (The Art of Computer Programming, Vol 3, Section 6.2) gives the comprehensive average-case analysis and proves the asymmetry introduced by repeated successor-based deletion. Reed 2003 proved the expected height of a random BST is approximately 4.31 * log2(n).',
        'Prerequisite: Binary Search -- the BST invariant is binary search stored as a tree shape. If binary search on an array is unclear, the tree version will feel arbitrary.',
        'Natural extensions: AVL Tree (the first self-balancing BST, Adelson-Velsky and Landis 1962, guarantees height at most 1.44 * log2(n) via rotations after every insert or delete). Red-Black Tree (weaker balance invariant but amortized O(1) rotations per operation; used in C++ std::map, Java TreeMap, and the Linux CFS scheduler). B-Tree (widens nodes to hold many keys, reducing disk reads; the standard index structure in databases).',
        'Randomized alternative: Treap -- combines BST ordering with random heap priorities to achieve expected O(log n) height without deterministic rotations. Simpler to implement than AVL or red-black trees when randomized guarantees are acceptable.',
        'Contrasting alternative: Hash Table -- O(1) average lookup but no ordered operations. Choose a hash table when you only need exact key access; choose a BST when you need sorted iteration, range queries, or predecessor/successor.',
      ],
    },
  ],
};
