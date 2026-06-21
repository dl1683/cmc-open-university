// Treap: a binary search tree by key and a heap by random priority.

import { treeState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'treap',
  title: 'Treap',
  category: 'Data Structures',
  summary: 'Random priorities turn a binary search tree into an expected-balanced structure with split and merge as first-class operations.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bst plus heap', 'split and merge'], defaultValue: 'bst plus heap' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function treapTree(title) {
  return treeState([
    { id: 'n5', value: '5|90', left: 'n2', right: 'n8' },
    { id: 'n2', value: '2|70', left: 'n1', right: 'n4' },
    { id: 'n8', value: '8|65', left: 'n7', right: 'n9' },
    { id: 'n1', value: '1|30', left: null, right: null },
    { id: 'n4', value: '4|40', left: null, right: null },
    { id: 'n7', value: '7|20', left: null, right: null },
    { id: 'n9', value: '9|10', left: null, right: null },
  ], 'n5', { title });
}

function rotatedTree(title) {
  return treeState([
    { id: 'n6', value: '6|95', left: 'n5', right: 'n8' },
    { id: 'n5', value: '5|90', left: 'n2', right: null },
    { id: 'n2', value: '2|70', left: 'n1', right: 'n4' },
    { id: 'n8', value: '8|65', left: 'n7', right: 'n9' },
    { id: 'n1', value: '1|30', left: null, right: null },
    { id: 'n4', value: '4|40', left: null, right: null },
    { id: 'n7', value: '7|20', left: null, right: null },
    { id: 'n9', value: '9|10', left: null, right: null },
  ], 'n6', { title });
}

function* bstPlusHeap() {
  const nodeCount = 7;
  const rootKey = 5;
  const rootPriority = 90;
  const newKey = 6;
  const newPriority = 95;
  const expectedComplexity = 'O(log n)';

  yield {
    state: treapTree('Each node stores key|priority'),
    highlight: { active: ['n5'], compare: ['n2', 'n8'] },
    explanation: `A treap with ${nodeCount} nodes obeys two promises at once. By key, it is a Binary Search Tree: left keys are smaller and right keys are larger. By random priority (root ${rootKey} has priority ${rootPriority}), it is a heap: parent priority beats child priority.`,
    invariant: `BST order by key; heap order by priority across all ${nodeCount} nodes.`,
  };

  yield {
    state: labelMatrix(
      'The two invariants check different fields',
      [
        { id: 'search', label: 'search key 7' },
        { id: 'balance', label: 'balance shape' },
        { id: 'priority', label: 'random priority' },
        { id: 'height', label: 'expected height' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'result', label: 'result' },
      ],
      [
        ['key comparisons', 'BST path'],
        ['priority heap', 'randomized rotations'],
        ['assigned on insert', 'history-independent shape in expectation'],
        ['random priorities', 'O(log n) expected'],
      ],
    ),
    highlight: { found: ['search:result', 'height:result'], active: ['priority:uses'] },
    explanation: `Search ignores priorities. Balance comes from random priorities, giving ${expectedComplexity} expected height. The resulting shape is the same as inserting all ${nodeCount} keys in random priority order, regardless of the actual insertion order.`,
  };

  yield {
    state: rotatedTree('Insert key 6 with higher priority and rotate up'),
    highlight: { found: ['n6'], compare: ['n5', 'n8'] },
    explanation: `Inserting key ${newKey} with priority ${newPriority} (higher than root priority ${rootPriority}) triggers rotations that restore heap order while preserving BST order. The rotations are the same local moves used by AVL and Red-Black trees, but the reason is priority, not height color bookkeeping.`,
  };

  yield {
    state: labelMatrix(
      'Treap complexity',
      [
        { id: 'find', label: 'find' },
        { id: 'insert', label: 'insert' },
        { id: 'delete', label: 'delete' },
        { id: 'splitmerge', label: 'split/merge' },
      ],
      [
        { id: 'time', label: 'expected time' },
        { id: 'why', label: 'why' },
      ],
      [
        ['O(log n)', 'expected height'],
        ['O(log n)', 'search plus rotations'],
        ['O(log n)', 'rotate or merge children'],
        ['O(log n)', 'priority-guided recursion'],
      ],
    ),
    highlight: { found: ['find:time', 'insert:time', 'delete:time', 'splitmerge:time'] },
    explanation: `Treaps trade deterministic worst-case balancing for simple expected guarantees. All four core operations (find, insert, delete, split/merge) run in ${expectedComplexity} expected time, making treaps compact, fast, and especially elegant when split and merge are natural operations.`,
  };
}

function* splitAndMerge() {
  const nodeCount = 7;
  const splitKey = 5;
  const rootKey = 5;
  const rootPriority = 90;
  const leftCount = 3;
  const rightCount = 3;
  const expectedComplexity = 'O(log n)';
  const opCount = 4;

  yield {
    state: treapTree('Split by key <= 5 and > 5'),
    highlight: { active: ['n5'], found: ['n2', 'n1', 'n4'], compare: ['n8', 'n7', 'n9'] },
    explanation: `Treap split partitions the ${nodeCount}-node tree at key ${splitKey}, producing a left treap with ${leftCount} nodes (<= ${splitKey}) and a right treap with ${rightCount} nodes (> ${splitKey}). Both outputs preserve treap invariants.`,
  };

  yield {
    state: labelMatrix(
      'Merge is the inverse when all left keys are smaller',
      [
        { id: 'pre', label: 'precondition' },
        { id: 'root', label: 'choose root' },
        { id: 'recurse', label: 'recurse' },
        { id: 'done', label: 'result' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['max(left) < min(right)', 'BST order safe'],
        ['higher priority root wins', 'heap order safe'],
        ['merge one child', 'local recursion'],
        ['one treap', 'both invariants preserved'],
      ],
    ),
    highlight: { found: ['pre:effect', 'root:effect', 'done:effect'] },
    explanation: `Merge is priority-guided and runs in ${expectedComplexity} expected time. If the left root has higher priority (e.g., priority ${rootPriority} for key ${rootKey}), it remains root and its right child becomes merge(left.right, right). Otherwise the right root wins symmetrically.`,
    invariant: `Split and merge are ${expectedComplexity} structural primitives, not afterthoughts.`,
  };

  yield {
    state: labelMatrix(
      'Operations built from split and merge',
      [
        { id: 'insert', label: 'insert key' },
        { id: 'delete', label: 'delete range' },
        { id: 'rank', label: 'rank/select' },
        { id: 'rope', label: 'sequence treap' },
      ],
      [
        { id: 'recipe', label: 'recipe' },
        { id: 'extra', label: 'extra field' },
      ],
      [
        ['split, merge node, merge', 'none'],
        ['split around range, discard middle', 'none'],
        ['walk by subtree sizes', 'size'],
        ['implicit keys by position', 'size and lazy tags'],
      ],
    ),
    highlight: { active: ['insert:recipe', 'delete:recipe', 'rope:recipe'], compare: ['rank:extra'] },
    explanation: `Treaps are popular in competitive programming because split and merge make all ${opCount} listed operations run in ${expectedComplexity}. Add subtree sizes and lazy tags, and the same structure becomes an editable sequence.`,
  };

  yield {
    state: labelMatrix(
      'When to choose a treap',
      [
        { id: 'library', label: 'standard ordered map' },
        { id: 'treap', label: 'custom split/merge' },
        { id: 'avlrb', label: 'AVL/Red-Black' },
        { id: 'skip', label: 'Skip List' },
      ],
      [
        { id: 'best', label: 'best when' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['ordinary dictionary', 'already tested'],
        ['range surgery', 'randomized guarantees'],
        ['deterministic bounds', 'more cases'],
        ['simple probabilistic levels', 'pointer overhead'],
      ],
    ),
    highlight: { found: ['treap:best'], compare: ['library:best', 'avlrb:tradeoff'] },
    explanation: `A treap (like our ${nodeCount}-node example rooted at key ${rootKey}) is not always the production default, but it is one of the cleanest ways to understand randomized balancing and composable tree operations.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bst plus heap') yield* bstPlusHeap();
  else if (view === 'split and merge') yield* splitAndMerge();
  else throw new InputError('Pick a treap view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each node label reads key|priority. The key determines left-right placement: smaller keys go left, larger keys go right (BST rule). The priority determines vertical placement: a parent always has higher priority than its children (max-heap rule). Together the two fields lock every node into exactly one position in the tree.',
        'Active (highlighted) nodes mark the current decision point. Found nodes show subtrees whose positions are settled. Compared nodes are the two candidates being weighed against each other.',
        'In the "bst plus heap" view, watch the insert of key 6 with priority 95. Because 95 outranks every existing priority, the new node rotates upward through two levels. Each rotation swaps a parent-child pair and rewires two pointers, but the left-to-right key order never changes. That single move is the entire balancing mechanism: no colors, no height counters, no case tables.',
        'In the "split and merge" view, follow the partition. Split walks down by key comparisons, rewiring one pointer per level. Merge walks down by priority comparisons and does the same. Both finish in O(height) steps with no array copies and no rebalancing metadata.',
        {type: 'callout', text: 'A treap balances by choosing random priorities once, then letting ordinary rotations enforce the heap rule while BST order stays untouched.'},
      
        {type: 'image', src: './assets/gifs/treap.gif', alt: 'Animated walkthrough of the treap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree gives ordered search, insert, and delete in O(h) time, where h is the tree height. When keys arrive in random order, h is O(log n) in expectation and everything is fast. When keys arrive sorted, h becomes n and the tree degenerates into a linked list. Insert 1, 2, 3, 4, 5 in order and every operation costs O(n).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Tree_graph.svg/250px-Tree_graph.svg.png', alt: 'Simple tree graph with one root and branching children.', caption: 'A tree is useful only while height stays controlled; treaps use priorities to keep the search paths short in expectation. Source: Wikimedia Commons, Dnu72, public domain.'},
        'Deterministic balanced trees (AVL, Red-Black) fix this by measuring and repairing the shape after every mutation. They deliver worst-case O(log n), but the implementation cost is real: AVL tracks height differences and rotates on imbalance; Red-Black encodes balance as a coloring invariant with four insert-repair cases and six delete-repair cases. Deletion alone fills a page of careful analysis.',
        'Seidel and Aragon asked a different question in their 1989 paper (later revised and published in 1996 as "Randomized Search Trees"): can randomness give us balance for free? Their answer was the treap. Attach a random priority to each key. Maintain BST order on keys and max-heap order on priorities. The random priorities make the tree shape equivalent to a BST built by inserting keys in random order, giving expected O(log n) height regardless of the actual insertion sequence. The mechanism is just rotations, and split and merge fall out as natural first-class operations.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Start with a plain BST. Compare the search key at each node, go left if smaller, go right if larger, insert at the first empty slot. The code is short, the logic is clean, and when keys arrive in uniformly random order, the expected height is O(log n). For 1,000 random keys, height is roughly 20. For 1,000,000, roughly 40.',
        'Real workloads are not random. Sorted imports, auto-incrementing IDs, timestamps, and alphabetical insertions all produce nearly sorted sequences. A BST built from sorted input has height n. Search becomes a linear scan, insert appends to the tail, and the tree offers no advantage over a linked list.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'We cannot control the order users insert keys. The BST shape is at the mercy of the input sequence, and the input sequence is at the mercy of the application.',
        'Deterministic balanced trees solve this with explicit repair: measure the shape (height difference for AVL, color invariant for Red-Black), detect violations, and apply local rotations chosen from a fixed case table. Both deliver worst-case O(log n), but each deletion in a Red-Black tree requires checking six cases, and a single AVL rotation can propagate back to the root. The code is correct but brittle to write, hard to verify by hand, and carries per-node metadata (height or color) that the application never asked for.',
        'The wall is the gap between wanting O(log n) height and wanting simple, short code. Can we get balance without engineering a repair machine?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A treap node stores two fields: a key and a random priority. The key obeys BST order (left subtree keys smaller, right subtree keys larger). The priority obeys max-heap order (parent priority higher than both children). When priorities are unique, these two constraints pin every node to exactly one position in the tree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Sorted_binary_tree_ALL_RGB.svg/330px-Sorted_binary_tree_ALL_RGB.svg.png', alt: 'Binary search tree with traversal paths shown in color.', caption: 'The binary-search-tree order is the invariant rotations must preserve: left-to-right traversal still lists keys in sorted order. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'Insert: walk down by key comparisons and place the new node at a leaf, exactly as in a plain BST. Then walk back up: if the new node has higher priority than its parent, rotate it up. A right rotation at a node x makes x\'s left child the new parent and x becomes the right child; a left rotation is the mirror. Each rotation rewires two pointers and preserves the in-order key sequence. The new node bubbles up until the heap property holds. At most O(height) rotations, one per ancestor on the path.',
        'Delete: find the target by key. Rotate it downward by promoting whichever child has higher priority, then repeat. The target sinks one level per rotation. When it becomes a leaf, remove it. An alternative: merge the target\'s left and right subtrees and replace the target with the result.',
        'Split(root, x): partition the treap into two treaps, one with all keys <= x and the other with all keys > x. If the root key <= x, the root and its left subtree belong to the left output; recurse into the right subtree. Otherwise the root and its right subtree go to the right output; recurse left. One pointer is rewired per level. Cost: O(height).',
        'Merge(left, right): given two treaps where max(left keys) < min(right keys), compare the two roots by priority. The higher-priority root becomes the new root. If the left root wins, recursively merge its right child with the entire right treap; if the right root wins, recursively merge its left child with the entire left treap. Cost: O(height).',
        'Split and merge subsume insert and delete. Insert key k: split at k, create a one-node treap for k, merge left part with the new node, merge the result with the right part. Delete key k: split at k-1, split the right part at k, discard the single-node middle piece, merge the two remaining treaps.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BST correctness is preserved by rotations: a rotation swaps a parent and child but never moves any key past a larger or smaller key, so the in-order traversal is unchanged. Split partitions by a key threshold, so every key lands on the correct side. Merge requires max(left) < min(right), so the combined in-order sequence stays sorted.',
        'Heap correctness is preserved by always promoting the higher-priority node. Insert rotates the new node up until its parent outranks it. Delete rotates the target down by always promoting the stronger child. Merge picks the higher-priority root at each level.',
        'The balance argument is the core of the treap idea. Assign each of n keys a random priority drawn independently from a continuous distribution (so ties have probability zero). Consider any contiguous key interval containing m keys. The key with the highest priority becomes the root of that interval, and because priorities are random, each of the m keys is equally likely to win. This is exactly the same distribution as choosing a uniformly random pivot in quicksort, or equivalently, inserting the m keys in a uniformly random order into a BST.',
        'The treap built from n keys with random priorities is therefore structurally identical, in distribution, to a BST built by inserting the same n keys in the order determined by their priority ranking. That order is a uniformly random permutation of the keys. A random BST has expected depth O(log n) for any node and expected height O(log n) overall. The treap inherits these bounds regardless of the actual insertion order, because the priorities, not the insertion order, determine the shape.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, delete, split, and merge all run in O(log n) expected time. Space is O(n): one node per key, storing a key, a priority, and two child pointers.',
        'When n doubles, expected height grows by about 1. A treap with 1,000 keys has expected height around 20. With 1,000,000 keys, around 40. The growth rate matches binary search: doubling the input adds one level.',
        'Insert performs a BST walk (O(log n) expected) plus at most O(log n) rotations on the way back up. In expectation the number of rotations per insert is less than 2, because the new node only rotates past ancestors with lower priority, and the expected number of such ancestors is bounded by the harmonic sum argument.',
        'There is no worst-case guarantee. An adversary who chooses priorities can force height n. In practice, 64-bit random priorities give negligible collision probability up to billions of keys, and the probability that the height exceeds c * log n drops exponentially in c. For all practical purposes, the expected bound behaves like a guarantee.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Competitive programming loves treaps because split and merge make range operations composable. Delete all keys in [a, b]: split at a-1, split at b, discard the middle, merge the rest. Order statistics: store subtree sizes and walk by rank. Reversible sequences: use an implicit treap with lazy reversal tags. These operations are awkward extensions on Red-Black trees but fall out naturally from split and merge.',
        'Implicit treaps drop explicit keys entirely. Each node\'s position in the sequence is defined by the size of its left subtree. Split at position i and merge give O(log n) insert-at-position, delete-at-position, reverse-subarray, and range-query. The implicit treap becomes a flexible alternative to segment trees when the problem requires structural edits (inserting or removing elements, not just updating values).',
        'Simplicity is a real engineering advantage. A correct treap (insert, delete, split, merge) fits in under 50 lines of code. A correct Red-Black tree with deletion is several times longer and harder to verify by hand. In contests or interviews where implementation time matters, the treap wins.',
        'Persistent data structures benefit from treaps because split and merge create new roots by path-copying O(log n) nodes and leaving the old tree intact. Persistent treaps support functional ordered sets and historical queries without full-tree duplication.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For an ordinary dictionary (insert, lookup, delete, no range surgery), the language standard library\'s balanced tree or hash map is almost always better. It is heavily tested, deterministic, and tuned for cache performance. A hand-rolled treap is unlikely to beat it on throughput in production.',
        'When worst-case O(log n) is a hard requirement, AVL, Red-Black, or B-trees provide it deterministically. A treap\'s O(log n) is an expected bound over random priority choices. In adversarial settings where an attacker can observe or predict priorities (e.g., an online judge with anti-hash tests), the treap can be forced into worst-case behavior. Cryptographic PRNGs mitigate this but add overhead.',
        'Treaps share the pointer-tree tax. Each node is a separate heap allocation, pointer chasing defeats CPU cache prefetching, and there is no spatial locality for range scans. A B-tree or sorted array is better when data lives on disk or when cache line utilization dominates throughput.',
        'Random number generation adds a small per-insertion cost. On extremely hot paths with millions of insertions per second, even a fast PRNG (xorshift64, splitmix64) is measurable overhead compared to a deterministic tree that needs no random bits.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert four keys with pre-chosen priorities: (5, pri 0.8), (3, pri 0.4), (7, pri 0.6), (2, pri 0.9).',
        'Insert (5, 0.8): tree is empty. Node 5|0.8 becomes the root.',
        'Insert (3, 0.4): key 3 < 5, so BST insert places 3 as the left child of 5. Priority 0.4 < 0.8, so the heap property holds. No rotation. Tree: 5|0.8 with left child 3|0.4.',
        'Insert (7, 0.6): key 7 > 5, so BST insert places 7 as the right child of 5. Priority 0.6 < 0.8, heap property holds. Tree: root 5|0.8, left child 3|0.4, right child 7|0.6.',
        'Insert (2, 0.9): key 2 < 5, go left to 3|0.4. Key 2 < 3, place as left child of 3. Now check heap property: priority 0.9 > 0.4 (parent 3), so rotate right at 3. Node 2|0.9 takes 3\'s position, 3 becomes right child of 2. Now 2|0.9 is left child of 5|0.8. Priority 0.9 > 0.8 (parent 5), so rotate right at 5. Node 2|0.9 becomes the new root, 5 becomes right child of 2.',
        'Final tree: root 2|0.9, right child 5|0.8 (left child 3|0.4, right child 7|0.6). Verify BST: in-order traversal gives 2, 3, 5, 7. Verify heap: 0.9 > 0.8 > 0.6 and 0.8 > 0.4. Both invariants hold. Two rotations moved node 2 from a leaf to the root because its priority was the highest.',
        'This is the key observation: the final tree is the same tree you would get by inserting the keys in priority order (2 first, then 5, then 7, then 3). The random priorities turned an adversarial insertion order into a random one.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Seidel and Aragon, "Randomized Search Trees," FOCS 1989, revised in Algorithmica 16(4/5), 1996. The paper defines the treap, proves expected O(log n) bounds via the random-BST equivalence, and extends the idea to finger searches. Blelloch and Reid-Miller, "Fast Set Operations Using Treaps," Journal of Computer and System Sciences 57(2), 1998, extends treaps to persistent and parallel settings.',
        'Prerequisites: Binary Search Tree (the key ordering a treap maintains), Binary Heap (the priority ordering a treap maintains).',
        'Natural extensions: Implicit Treap Sequence Editor (implicit keys, lazy tags, sequence operations), Skip List (another randomized structure achieving O(log n) with a layered linked-list design instead of a tree).',
        'Alternatives: Red-Black Tree (deterministic worst-case O(log n), more complex code), AVL Tree (deterministic, tightest balance, more rotation cases), Splay Tree (amortized O(log n) via self-adjustment, no random bits, but no worst-case per-operation bound).',
      ],
    },
  ],
};
