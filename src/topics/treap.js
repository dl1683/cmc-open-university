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
        'Each node label is key|priority. The key controls left and right placement like a binary search tree, while the priority controls vertical placement like a max heap.',
        'In the insert view, key 6 arrives with priority 95 and rotates upward because its priority beats its parents. In the split and merge view, the same invariants are preserved while the tree is cut by key or joined by priority.',
        {type: 'callout', text: 'A treap balances by choosing random priorities once, then letting ordinary rotations enforce the heap rule while BST order stays untouched.'},
        {type: 'image', src: './assets/gifs/treap.gif', alt: 'Animated walkthrough of the treap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree is fast only while its height stays small. Sorted insertions can turn it into a linked list, making search, insert, and delete O(n).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Tree_graph.svg/250px-Tree_graph.svg.png', alt: 'Simple tree graph with one root and branching children.', caption: 'A tree is useful only while height stays controlled; treaps use priorities to keep the search paths short in expectation. Source: Wikimedia Commons, Dnu72, public domain.'},
        'A treap exists to get expected logarithmic height with less balancing machinery than AVL or Red-Black trees. Random priorities make the shape behave like a binary search tree built from a random insertion order.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a plain binary search tree. Compare keys, go left or right, and insert at the first empty child.',
        'That works well for random input because height is usually logarithmic. It fails on common ordered inputs such as timestamps, sorted imports, and increasing IDs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Deterministic balanced trees repair height with metadata and case analysis. AVL trees track height differences, and Red-Black trees track color invariants, both of which make deletion and rotations harder to implement correctly.',
        'The wall is engineering complexity. We want search-tree order and short paths without making every mutation a delicate balancing proof.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Give every key a random priority and maintain two invariants: BST order by key and heap order by priority. The highest-priority key in any interval becomes the root of that interval.',
        'Because priorities are random, each key in an interval is equally likely to become that interval root. This is the same distributional shape as a random BST, regardless of insertion order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insert first follows normal BST search by key. Then rotations move the new node upward until its parent has higher priority or it becomes the root.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Sorted_binary_tree_ALL_RGB.svg/330px-Sorted_binary_tree_ALL_RGB.svg.png', alt: 'Binary search tree with traversal paths shown in color.', caption: 'The binary-search-tree order is the invariant rotations must preserve: left-to-right traversal still lists keys in sorted order. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'Split(root, x) returns two treaps with keys <= x and > x. Merge(left, right) assumes every left key is smaller than every right key, then chooses the higher-priority root and recurses on one child.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Rotations preserve BST order because they rearrange one parent-child relationship without moving a key across a smaller or larger boundary. Heap order is restored by promoting the higher-priority node at each local violation.',
        'Expected balance comes from random priorities. For any search path, a node becomes an ancestor only when it has the highest priority in a relevant interval, and the expected number of such winners is O(log n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, delete, split, and merge all take O(log n) expected time. Space is O(n), with each node storing a key, priority, and two child pointers.',
        'When n doubles, expected height increases by a small constant. There is no deterministic worst-case bound, but with independent 64-bit priorities, bad height is extremely unlikely for ordinary workloads.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Treaps are useful when split and merge are first-class operations. Range deletion, ordered-set union, persistent sets, order statistics, and implicit sequence editors are compact with treap primitives.',
        'They are also useful in competitive programming and teaching because the implementation is short. The same rotations as AVL and Red-Black trees appear, but priority explains when to use them.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A standard library map or hash table is usually better for ordinary production lookup. It is tested, tuned, deterministic, and often more cache-friendly than a hand-rolled pointer tree.',
        'Treaps also inherit pointer-chasing costs and expected-only guarantees. If an adversary can choose or predict priorities, the tree can be forced toward linear height.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert (5, 0.8), (3, 0.4), (7, 0.6), and (2, 0.9). The first three form root 5 with children 3 and 7 because both child priorities are lower than 0.8.',
        'Insert 2 as the left child of 3 by key order. Priority 0.9 beats 3, so rotate right at 3; it also beats 5, so rotate right at 5, leaving 2 as root. In-order traversal is still 2, 3, 5, 7, and heap order holds by priority.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Seidel and Aragon, Randomized Search Trees, 1989 and 1996. Blelloch and Reid-Miller cover fast set operations with treaps.',
        'Study binary search trees, heaps, rotations, randomized algorithms, skip lists, AVL trees, Red-Black trees, and implicit treaps next.',
      ],
    },
  ],
};
