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
  yield {
    state: treapTree('Each node stores key|priority'),
    highlight: { active: ['n5'], compare: ['n2', 'n8'] },
    explanation: 'A treap obeys two promises at once. By key, it is a Binary Search Tree: left keys are smaller and right keys are larger. By random priority, it is a heap: parent priority beats child priority.',
    invariant: 'BST order by key; heap order by priority.',
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
    explanation: 'Search ignores priorities. Balance comes from random priorities. The resulting shape is the same as inserting keys in random priority order, regardless of the actual insertion order.',
  };

  yield {
    state: rotatedTree('Insert key 6 with higher priority and rotate up'),
    highlight: { found: ['n6'], compare: ['n5', 'n8'] },
    explanation: 'If a new node has higher priority than its parent, rotations restore heap order while preserving BST order. The rotations are the same local moves used by AVL and Red-Black trees, but the reason is priority, not height color bookkeeping.',
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
    explanation: 'Treaps trade deterministic worst-case balancing for simple expected guarantees. They are compact, fast, and especially elegant when split and merge are natural operations.',
  };
}

function* splitAndMerge() {
  yield {
    state: treapTree('Split by key <= 5 and > 5'),
    highlight: { active: ['n5'], found: ['n2', 'n1', 'n4'], compare: ['n8', 'n7', 'n9'] },
    explanation: 'Treap split partitions a tree into two treaps by key. All keys on the left are <= x, all keys on the right are > x, and both outputs preserve treap invariants.',
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
    explanation: 'Merge is priority-guided. If the left root has higher priority, it remains root and its right child becomes merge(left.right, right). Otherwise the right root wins symmetrically.',
    invariant: 'Split and merge are structural primitives, not afterthoughts.',
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
    explanation: 'Treaps are popular in competitive programming because split and merge make range operations simple. Add subtree sizes and lazy tags, and the same structure becomes an editable sequence.',
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
    explanation: 'A treap is not always the production default, but it is one of the cleanest ways to understand randomized balancing and composable tree operations.',
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
      heading: 'Why it exists',
      paragraphs: [
        'A plain binary search tree gives ordered search with very little code, but its height is controlled by insertion order. Insert sorted keys and the tree degenerates into a linked list. Balanced trees fix that, but AVL and Red-Black trees pay with deterministic repair cases and extra metadata.',
        'A treap exists as the small randomized alternative. It keeps the binary-search-tree order by key and uses a random priority to choose the shape. The result is a search tree whose expected height is logarithmic while still being simple enough to express with rotations, split, and merge.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The naive baseline is an unbalanced BST: compare by key, go left or right, and insert at a leaf. Search, insert, and delete are O(height). That is O(log n) only when the shape happens to be balanced.',
        'The wall is that real key order is not trustworthy. Timestamps, ids, sorted imports, and clustered workloads can all create long paths. A deterministic balanced tree solves the wall by measuring height or color. A treap solves it by assigning each key a persistent random rank that input order does not control.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'Every treap node has two fields that matter: key and priority. By key, the tree is a BST: all keys in the left subtree are smaller and all keys in the right subtree are larger. By priority, the tree is a heap: a parent priority beats each child priority.',
        'The priority is not a scheduling priority. It is a stable random rank, usually generated once when the key is inserted. If priorities are unique, the treap shape is exactly the Cartesian tree formed by sorted keys and heap priorities. Equivalently, it is the same shape as inserting keys in descending priority order.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the bst plus heap view, read each node label as key|priority. Search decisions use only the key part. Balance decisions use only the priority part. That split is the whole point of the structure.',
        'When key 6 appears with priority 95, it rotates above key 5 because its priority is higher. The rotation is safe because it preserves the in-order sequence of keys. The only thing it changes is which node is parent, so heap order can be restored locally.',
        'In the split and merge view, treat the root priority as the tie-breaker that decides which subtree root survives. Split partitions by key. Merge assumes all left keys are smaller than all right keys, then lets the higher-priority root own the combined tree.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Rotation-based insert starts like BST insertion. Put the new key at the leaf position dictated by key comparisons, then rotate it upward while its priority beats its parent. Each rotation keeps the keys in sorted order but fixes one heap violation.',
        'Deletion can rotate the target node downward until it becomes a leaf, or it can replace the node by merging its left and right subtrees. Both views are the same idea: preserve sorted key order while letting priorities decide roots.',
        'The split/merge formulation is often the cleanest. split(root, x) returns two treaps: keys <= x and keys > x. merge(left, right) requires max(left) < min(right), then picks the higher-priority root and recurses into one child. Insert becomes split, merge with the new node, then merge the rest. Range deletion becomes split around the interval and discard the middle.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'BST correctness comes from rotations and recursion preserving the in-order key sequence. A rotation does not move a key across a smaller or larger key; it only changes a local parent-child relationship. Split and merge preserve the same order by their preconditions: split partitions around x, and merge only combines non-overlapping key ranges.',
        'Heap correctness comes from always promoting the higher-priority root. During insert, rotations move the new node up until its parent has higher priority. During merge, the higher-priority root stays root and only one child is rebuilt recursively.',
        'The expected-height argument comes from random priorities. In any key interval, the highest-priority key is equally likely to be any key in that interval, so it behaves like a random pivot. The expected recursion depth is therefore logarithmic, like randomized quicksort or a randomly built BST.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with root 5|90, left child 2|70, and right child 8|65. By key, 2 is left of 5 and 8 is right of 5. By priority, 90 beats 70 and 65, so the heap invariant holds.',
        'Insert key 6 with priority 95. Search by key puts 6 between 5 and 8: it goes right from 5, then left from 8. But priority 95 beats 8 and 5, so rotations move 6 upward. After rotation, 6 becomes root, 5 remains its left side, and 8 remains its right side. The sorted order 1, 2, 4, 5, 6, 7, 8, 9 is unchanged.',
        'For split at key 5, every key <= 5 must land in the left output and every key > 5 in the right output. The recursion follows the root key comparison and reuses whole subtrees whenever their key range is already on the correct side. No array copy is needed; the operation rewires O(height) pointers.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Search, insert, delete, split, and merge are O(log n) expected time and O(n) space. The operations are small and pointer-local, which makes treaps attractive in contest code, persistent data structures, and custom ordered-set operations.',
        'The tradeoff is probabilistic balance. A bad random generator, priority collisions, or adversarially chosen priorities can produce poor height. Production code should use stable priorities with enough bits, define tie-breaking, and test rotations or split/merge code against sorted-order checks.',
        'Treaps also have ordinary pointer-tree costs: allocation overhead, cache misses, and no built-in range locality like a B-tree. They are elegant, but they are not automatically faster than a tuned ordered-map library.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Treaps win when the program needs ordered-set operations plus structural surgery. Splitting a set, deleting a key range, joining two ordered sets, maintaining order statistics, or building an editable sequence are natural operations instead of awkward extensions.',
        'An implicit treap is the classic example. It does not store explicit keys; subtree sizes define positions. split at position i cuts a sequence, merge glues sequences back together, and lazy tags can reverse or annotate ranges without rebuilding the whole array.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For an ordinary dictionary, the standard library map or set is usually the better production answer because it is heavily tested and has well-understood worst-case behavior. If deterministic height bounds are required, AVL, Red-Black, B-tree, or another deterministic structure may be a better fit.',
        'A treap also fails as an explanation if the two invariants get blurred. It is not a heap over keys, and randomized priorities do not make membership answers random. The set semantics are deterministic; only the balancing shape is randomized.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Randomized Search Trees by Aragon and Seidel at https://faculty.washington.edu/aragon/pubs/rst89.pdf. Study Binary Search Tree, AVL Tree, Red-Black Tree, Binary Heap, Skip List, Persistent Segment Tree, Rope, and Implicit Treap Sequence Editor next.',
        'A good next exercise is to implement both APIs: rotation-based insert/delete and split/merge-based insert/delete. Then add subtree sizes and verify that rank, select, split-by-position, and merge still preserve the BST and heap invariants.',
      ],
    },
  ],
};
