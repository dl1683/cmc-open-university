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
      heading: 'What it is',
      paragraphs: [
        'A treap is a binary search tree by key and a heap by random priority. The name combines tree and heap. Keys determine search order; priorities determine shape. If priorities are independent random values, the expected height is logarithmic.',
        'Treaps sit beside Binary Search Tree, AVL Tree, Red-Black Tree, Binary Heap, and Skip List. They are simpler than many deterministic balanced trees and make split and merge unusually natural.',
        'The priority is not a runtime scheduling priority. It is a persistent random rank attached to the key, often generated once at insertion time. Thinking of the priorities as a random permutation helps: the highest-priority key becomes root, then the same rule recursively shapes the left and right key ranges.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insert starts like BST insertion by key, then rotates the new node upward while its priority beats its parent. Delete can rotate a node down or merge its children. The heap invariant gives randomized balance without storing explicit heights or colors.',
        'Split partitions by key into two treaps. Merge combines two treaps when every key in the left treap is smaller than every key in the right treap. These two primitives can express insertion, deletion, range cuts, order statistics, and implicit sequence operations.',
        'That split/merge view is often cleaner than the rotation view. Insert can be written as split around the key, then merge(left, newNode), then merge(result, right). Delete can split out the key interval and discard it. The algorithm becomes pointer algebra over ordered sets.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, delete, split, and merge are O(log n) expected time with O(n) space. The guarantee is probabilistic, so worst-case shape is possible but unlikely with good priorities. Production code must use stable random priorities, avoid collisions, and test rotations carefully.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Treaps are useful for ordered maps, interval sets, randomized balanced dictionaries, editor-like sequence structures, and algorithms that repeatedly split and rejoin ordered collections. Their conceptual value is high: one structure exposes BST ordering, heap priority, randomization, rotations, and persistence-friendly path changes.',
        'A complete case-study pattern is the implicit treap used as a text buffer or sequence container. Keys are not stored explicitly; subtree sizes define positions. Splitting at position i cuts the document, merging glues it back together, and lazy tags can reverse or annotate ranges without rebuilding the sequence.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A treap is not a heap over keys. It is a heap over priorities and a search tree over keys. Another trap is thinking random priorities mean random answers. The set semantics are deterministic; only the balancing shape is randomized.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Randomized Search Trees by Aragon and Seidel at https://faculty.washington.edu/aragon/pubs/rst89.pdf. Study Implicit Treap Sequence Editor, Binary Search Tree, AVL Tree, Red-Black Tree, Binary Heap, Skip List, and Persistent Segment Tree next.',
      ],
    },
  ],
};
