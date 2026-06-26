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
        'Each circle is a node holding one number. Lines connect parents to children: left children sit to the left, right children to the right. The tree grows downward from the root at the top.',
        'During insertion, the highlighted node is the one being compared against. The algorithm asks: is the new value smaller (go left) or larger-or-equal (go right)? It walks down until it finds an empty child slot, then attaches the new value as a leaf.',
        'During search, the highlighted node is the current candidate. Dimmed nodes mark the path already checked. When the algorithm goes left, the entire right subtree is never entered -- one comparison eliminated every key inside it. A "found" marker means the target matched. If the walk reaches a null child, the target is provably absent: the ordering rule guarantees that if it existed, it would have been placed along exactly this path.',
        {type: 'callout', text: 'A BST is editable binary search: each comparison chooses a subtree, but only balanced height preserves the logarithmic promise.'},
        {type: 'image', src: 'https://courses.grainger.illinois.edu/cs225/fa2021/assets/notes/bst/bstsearch.png', alt: 'Binary search tree search path with left and right decisions.', caption: 'Search follows one comparison path and ignores the rejected subtree. (Source: courses.grainger.illinois.edu)'},
        {type: 'image', src: './assets/gifs/binary-search-tree.gif', alt: 'Animated walkthrough of the binary search tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sorted arrays let you find any key fast (binary search, O(log n)), iterate in order, and answer range queries by slicing a contiguous block. But they are frozen. Inserting a single key into the middle means shifting every later element one slot right -- O(n) work per update. A hash table gives O(1) exact lookup, but it cannot answer "what is the next key after 42?" without scanning everything.',
        'A binary search tree (BST) fills the gap: it keeps keys in sorted order using a tree of nodes linked by pointers, so you get binary-search-speed lookups and you can insert or delete a key by changing a few pointers instead of shifting an array. It is binary search reshaped into a structure you can edit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Keep data in a sorted array. Binary search gives O(log n) lookup. Min is the first element, max is the last, and range queries are a contiguous slice. For data that never changes, this is hard to beat.',
        'The cost appears when the data moves. Inserting a key into position 500 of a million-element array shifts 999,500 elements one slot right. Deleting does the reverse. If the application performs thousands of updates per second -- say, maintaining a real-time leaderboard -- each update touches most of the array even though only one key changed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A sorted array needs contiguous memory so binary search can jump to the midpoint in O(1). Keeping it contiguous forces every insertion to shift a suffix. A linked list fixes the shift cost (rewire two pointers), but loses random access, so search falls back to O(n) -- you have to walk node by node because there is no way to jump to the middle.',
        'The tension is clean: you need one comparison to eliminate half the candidates (the binary search property), and you need insertion to touch only a few pointers (the linked structure property). Arrays give the first but not the second. Linked lists give the second but not the first. Neither alone solves the problem.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store the keys in a tree where each node obeys one rule: every key in its left subtree is strictly smaller, and every key in its right subtree is larger or equal. This single constraint -- called the BST property -- means that a comparison at any node tells you which subtree the target must be in and which subtree is impossible. You get the halving behavior of binary search without needing a contiguous array.',
        'Insertion is the same walk as search: compare downward until you hit a null child, then attach the new key there. The path that placed it is exactly the path a future search will retrace. Nothing else in the tree moves -- no shifting, no copying, just one new pointer from parent to child.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The BST property holds recursively: for every node N, all keys in N\'s left subtree are strictly less than N\'s key, and all keys in N\'s right subtree are greater than or equal to N\'s key. Every subtree is itself a valid BST.',
        'Search starts at the root. Compare the target to the current node\'s key. If equal, return the node. If the target is smaller, move to the left child. If larger, move to the right child. If you reach a null pointer, the key is absent. Each step follows one edge downward, so total comparisons equal the depth of the target node (or the depth of the null slot where it would have been).',
        'Insertion follows the same comparison path from root to a null pointer, then attaches the new key as a leaf at that null slot. Only the parent\'s child pointer changes; no other node moves.',
        {type: 'image', src: 'https://courses.grainger.illinois.edu/cs225/fa2021/assets/notes/bst/insert.png', alt: 'Inserting a new key into a binary search tree by comparisons.', caption: 'Insertion is search for the null slot where the key must live. (Source: courses.grainger.illinois.edu)'},
        'Min is found by following left children from the root until there are no more. Max follows right children. In-order traversal -- visit left subtree, then the node, then right subtree -- visits every key in sorted order.',
        'Deletion has three cases. Case 1 (leaf): the node has no children. Remove it by setting the parent\'s pointer to null. Case 2 (one child): the node has exactly one child. Replace the node with that child; the child inherits the deleted node\'s position and all ordering constraints hold because the child\'s subtree was already correctly placed relative to the grandparent. Case 3 (two children): you cannot simply remove the node because both subtrees need a parent. The fix: find the in-order successor -- the smallest key in the right subtree, found by following left pointers from the right child until you hit null. Copy the successor\'s key into the node being deleted, then delete the successor from its original position. The successor has at most one child (a right child, because it was the leftmost node in its subtree), so its deletion reduces to Case 1 or Case 2.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Search correctness rests on the BST property. When the target is smaller than the current key, every key in the right subtree is at least as large (by the BST property), so none of them can match. The algorithm only discards subtrees that provably cannot contain the target. If the target exists, the comparison path leads to it; if it does not exist, the path leads to the null slot where it would have been, proving absence.',
        'Insertion preserves the BST property because the comparison path proves the new key fits between the bounds established by its ancestors. Each left turn proves the new key is smaller than that ancestor; each right turn proves it is larger or equal. Placing the key at the end of this path respects every ancestor\'s constraint.',
        'Deletion in the two-child case works because the in-order successor is the smallest key strictly greater than the deleted key. Replacing the deleted key with the successor preserves the left subtree (all keys are still smaller than the replacement) and the right subtree (all remaining keys are still larger than the replacement, since the successor was the minimum among them). Removing the successor from its old position is a one-child or leaf deletion, both of which are already correct.',
        'In-order traversal produces sorted output by structural induction. The left subtree contains only smaller keys and is visited first. The current node comes next. The right subtree contains only larger keys and is visited last. Each subtree is itself a valid BST, so the same argument applies recursively.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, and delete all cost O(h), where h is the height of the tree. In a balanced tree with n keys, h = floor(log2(n)), so every operation is O(log n). In a degenerate tree -- one that has collapsed into a chain -- h = n - 1, and every operation is O(n). The difference between log and linear is the entire story of BST performance.',
        'Concrete numbers: a balanced BST with 1,000,000 keys has height about 20, so any lookup touches at most 20 nodes. A degenerate chain with the same 1,000,000 keys has height 999,999. Doubling the data in a balanced tree adds one level; doubling a chain doubles the worst-case path length.',
        'Average case under random insertion order: Reed (2003) proved the expected height is approximately 4.31 * log2(n). For 1,000 random keys, expected height is about 43 versus the ideal 10 -- workable, but 4x the optimum. Any non-random insertion pattern (sorted, nearly sorted, adversarial) can push the tree toward linear height.',
        'Space is O(n): each node stores one key and two child pointers. Pointer chasing means worse cache performance than binary search on a packed array, because each comparison may load a different cache line. Recursive implementations also use O(h) stack space for traversal.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Balanced BSTs (specifically red-black trees) power the ordered map and set in most standard libraries: C++ std::map and std::set, Java TreeMap and TreeSet, .NET SortedDictionary. These give O(log n) insert, delete, and lookup, plus in-order iteration, floor/ceiling queries, predecessor/successor, and range scans -- operations a hash table cannot support.',
        'Sweep-line algorithms in computational geometry maintain a sorted "active set" of segments using a BST. Interval trees (for finding all overlapping intervals) and order-statistic trees (for answering "what is the k-th smallest element?") are direct BST extensions. Database engines sometimes use BST-derived structures for in-memory indices, though B-trees dominate for disk-backed storage.',
        'Any access pattern that involves ordered operations -- "give me everything between 20 and 40," "what is the next key after this one," "iterate smallest to largest" -- fits a BST naturally. If your workload mixes lookups and updates and needs sorted order, a balanced BST is almost always the right structure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Without a balancing mechanism, a BST degenerates under sorted, reverse-sorted, or adversarial input. Insert the sequence [1, 2, 3, ..., n] and every node goes right, producing a chain with O(n) operations. If worst-case guarantees matter, you need AVL trees (which rotate after every insert/delete to keep height within 1.44 * log2(n)) or red-black trees (which use a weaker balance invariant but amortize rotations).',
        'For exact-key lookup when sorted order does not matter, a hash table is simpler and faster. O(1) average access beats O(log n), and hash tables have better cache behavior because they use contiguous arrays internally. If you never need predecessor, successor, range scan, or sorted iteration, a BST adds complexity for no benefit.',
        'On disk-backed storage, a binary node wastes page reads. Each pointer chase may load a different disk page for a single key comparison. B-trees and B+ trees pack hundreds of keys per node so one page read eliminates a wide range of candidates, which is why every major database uses them instead of binary trees.',
        'Repeated Hibbard deletions (always replacing with the in-order successor) gradually skew an initially random tree, degrading expected height over time (Knuth, TAOCP Vol 3, Section 6.2). Alternating between successor and predecessor replacement mitigates the drift, but a self-balancing variant avoids the problem entirely.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert the sequence [8, 3, 10, 1, 6, 14, 4, 7] into an empty BST. 8 is first, so it becomes the root. 3 < 8, go left -- empty slot, so 3 becomes the left child of 8. 10 > 8, go right -- empty slot, so 10 becomes the right child of 8. 1 < 8, go left to 3; 1 < 3, go left -- empty, so 1 becomes the left child of 3. 6 < 8, go left to 3; 6 > 3, go right -- empty, so 6 becomes the right child of 3. 14 > 8, go right to 10; 14 > 10, go right -- empty, so 14 becomes the right child of 10. 4 < 8, go left to 3; 4 > 3, go right to 6; 4 < 6, go left -- empty, so 4 becomes the left child of 6. 7 < 8, go left to 3; 7 > 3, go right to 6; 7 > 6, go right -- empty, so 7 becomes the right child of 6.',
        'Final shape: root 8, left subtree rooted at 3 (with left child 1 and right child 6, where 6 has children 4 and 7), right subtree rooted at 10 (right child 14). Height is 3. In-order traversal: 1, 3, 4, 6, 7, 8, 10, 14 -- sorted, confirming the BST property holds.',
        'Now search for 6. Compare 6 to root 8: 6 < 8, go left. Compare 6 to 3: 6 > 3, go right. Compare 6 to 6: match. Found in 3 comparisons out of 8 nodes. The path length equals the depth of the target node.',
        'Deletion Case 1 (leaf): delete 1. It has no children. Set 3\'s left pointer to null. Tree still valid.',
        'Deletion Case 2 (one child): delete 10. It has one child (14). Replace 10 with 14 -- set 8\'s right pointer to 14. The subtree below 14 (empty) is correctly placed relative to 8.',
        'Deletion Case 3 (two children): delete 3 (assuming 1 is still present). Node 3 has left child 1 and right child 6. Find the in-order successor: go right to 6, then follow left pointers -- 6\'s left child is 4, and 4 has no left child, so 4 is the successor. Copy 4 into the slot where 3 was. Delete the original 4 from its old position (it was a leaf, so this is Case 1). The tree now has 4 where 3 was, with left child 1 and right child 6 (whose left child is gone, right child 7). In-order traversal: 1, 4, 6, 7, 8, 14 -- still sorted.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/BST_node_deletion.png/500px-BST_node_deletion.png', alt: 'Binary search tree deletion cases with successor replacement.', caption: 'Two-child deletion preserves order by moving the successor into the removed node position. (Source: Wikimedia Commons)'},
        'Degenerate case: insert [1, 2, 3, 4, 5, 6, 7, 8]. Every value is larger than the previous root-to-leaf path, so every insertion goes right. The result is a right-skewed chain of height 7. Searching for 8 takes 8 comparisons instead of 3. Same keys, different insertion order, completely different performance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hibbard 1962 ("Some Combinatorial Properties of Certain Trees With Applications to Searching and Sorting") introduced the standard deletion algorithm. Knuth 1973 (The Art of Computer Programming, Vol 3, Section 6.2) provides the comprehensive average-case analysis and documents the asymmetric degradation from repeated successor-based deletion. Reed 2003 proved the expected height of a random BST is approximately 4.31 * log2(n).',
        'Prerequisite: Binary Search -- the BST invariant is binary search stored as a tree shape. If binary search on an array is unclear, the tree version will feel arbitrary.',
        'Natural extensions: AVL Tree (Adelson-Velsky and Landis 1962, the first self-balancing BST, guarantees height at most 1.44 * log2(n) via rotations after every insert/delete). Red-Black Tree (weaker balance invariant but amortized O(1) rotations per operation; used in C++ std::map, Java TreeMap, and the Linux CFS scheduler). B-Tree (widens nodes to hold many keys per node, reducing disk reads; the standard index structure in every major database).',
        'Randomized alternative: Treap -- combines BST key ordering with random heap priorities to achieve expected O(log n) height without deterministic rotations. Simpler to implement than AVL or red-black trees when probabilistic guarantees suffice.',
        'Contrasting alternative: Hash Table -- O(1) average lookup but no ordered operations. If you only need exact-key access, a hash table is simpler and faster. If you need sorted iteration, range queries, or predecessor/successor, a BST is the right tool.',
      ],
    },
  ],
};
