// Order-statistics tree: augment a balanced search tree with subtree sizes so
// rank and select become logarithmic operations.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'order-statistics-tree',
  title: 'Order-Statistics Tree',
  category: 'Data Structures',
  summary: 'Add subtree sizes to a balanced search tree so select(k), rank(x), and dynamic medians run in O(log n).',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['select by rank', 'rank after rotations'], defaultValue: 'select by rank' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function orderTree(title) {
  return graphState({
    nodes: [
      { id: 'n40', label: '40 size=7', x: 5.0, y: 0.8, note: 'root' },
      { id: 'n20', label: '20 size=3', x: 2.8, y: 2.7, note: 'left subtree' },
      { id: 'n60', label: '60 size=3', x: 7.2, y: 2.7, note: 'right subtree' },
      { id: 'n10', label: '10 size=1', x: 1.7, y: 4.7, note: 'rank 1' },
      { id: 'n30', label: '30 size=1', x: 3.9, y: 4.7, note: 'rank 3' },
      { id: 'n50', label: '50 size=1', x: 6.1, y: 4.7, note: 'rank 5' },
      { id: 'n70', label: '70 size=1', x: 8.3, y: 4.7, note: 'rank 7' },
    ],
    edges: [
      { id: 'e-40-20', from: 'n40', to: 'n20', weight: 'left' },
      { id: 'e-40-60', from: 'n40', to: 'n60', weight: 'right' },
      { id: 'e-20-10', from: 'n20', to: 'n10', weight: 'left' },
      { id: 'e-20-30', from: 'n20', to: 'n30', weight: 'right' },
      { id: 'e-60-50', from: 'n60', to: 'n50', weight: 'left' },
      { id: 'e-60-70', from: 'n60', to: 'n70', weight: 'right' },
    ],
  }, { title });
}

function* selectByRank() {
  yield {
    state: orderTree('Every node stores subtree size'),
    highlight: { active: ['n40', 'n20', 'n60'], found: ['n10', 'n30', 'n50', 'n70'] },
    explanation: 'An order-statistics tree starts as a balanced search tree, often a red-black tree, and adds one field: size[node] = size[left] + size[right] + 1.',
    invariant: 'The size field must be correct after every insert, delete, and rotation.',
  };

  yield {
    state: labelMatrix(
      'select(5)',
      [
        { id: 'root', label: 'at 40' },
        { id: 'right', label: 'go right' },
        { id: 'hit', label: 'at 60' },
        { id: 'answer', label: 'answer' },
      ],
      [{ id: 'calculation', label: 'calculation' }, { id: 'decision', label: 'decision' }],
      [
        ['leftSize + 1 = 4', '5 > 4, subtract 4'],
        ['target becomes 1', 'enter right subtree'],
        ['leftSize + 1 = 2', '1 < 2, go left'],
        ['node 50', '5th smallest'],
      ],
    ),
    highlight: { active: ['root:calculation', 'right:calculation', 'hit:calculation'], found: ['answer:decision'] },
    explanation: 'To select the kth smallest key, compare k with the rank of the current node inside its subtree. Move left, return current, or move right with k reduced by the left subtree plus one.',
  };

  yield {
    state: orderTree('Path for select(5) ends at 50'),
    highlight: { active: ['n40', 'n60', 'n50', 'e-40-60', 'e-60-50'], found: ['n50'], compare: ['n20'] },
    explanation: 'The tree does not need an inorder array. Subtree sizes let the search skip whole subtrees while still preserving dynamic inserts and deletes.',
  };

  yield {
    state: labelMatrix(
      'Operations unlocked by size',
      [
        { id: 'select', label: 'select(k)' },
        { id: 'rank', label: 'rank(x)' },
        { id: 'median', label: 'median' },
        { id: 'percentile', label: 'percentile' },
      ],
      [{ id: 'answer', label: 'answer' }, { id: 'cost' }],
      [
        ['kth smallest', 'O(log n)'],
        ['number of keys <= x', 'O(log n)'],
        ['select((n+1)/2)', 'O(log n)'],
        ['select(ceil(p*n))', 'O(log n)'],
      ],
    ),
    highlight: { found: ['select:cost', 'rank:cost', 'median:cost'] },
    explanation: 'This is the power of augmentation: one small field turns an ordered map into a dynamic ranking structure.',
  };
}

function* rankAfterRotations() {
  yield {
    state: labelMatrix(
      'rank(50)',
      [
        { id: 'start', label: 'start at 50' },
        { id: 'self', label: 'own left subtree' },
        { id: 'parent', label: 'move to 60' },
        { id: 'root', label: 'move to 40' },
      ],
      [{ id: 'add', label: 'add' }, { id: 'running_rank', label: 'running rank' }],
      [
        ['size(left 50)+1 = 1', '1'],
        ['none', '1'],
        ['50 is left child', '1'],
        ['came from right subtree: size(left 40)+1 = 4', '5'],
      ],
    ),
    highlight: { active: ['start:add', 'root:add'], found: ['root:running_rank'] },
    explanation: 'Rank can be computed by walking upward. Start with the node position inside its own subtree. Whenever the path comes from a right child, add the parent and the parents left subtree.',
  };

  yield {
    state: orderTree('Rotations must repair size fields locally'),
    highlight: { active: ['n40', 'n60', 'e-40-60'], compare: ['n50', 'n70'], found: ['n20'] },
    explanation: 'Balanced trees rotate during inserts and deletes. The order-statistics augmentation survives rotations because only a small local set of size fields changes.',
    invariant: 'Update child pointers first, then recompute sizes bottom-up for the rotated nodes.',
  };

  yield {
    state: labelMatrix(
      'Case study: live leaderboard',
      [
        { id: 'insert', label: 'new score' },
        { id: 'rank', label: 'player rank' },
        { id: 'page', label: 'page around rank' },
        { id: 'median', label: 'median score' },
      ],
      [{ id: 'operation', label: 'operation' }, { id: 'why_tree', label: 'why tree' }],
      [
        ['insert/update key', 'dynamic changes'],
        ['count higher scores', 'rank query'],
        ['select rank +/- window', 'ordered pagination'],
        ['select middle', 'distribution summary'],
      ],
    ),
    highlight: { found: ['rank:why_tree', 'page:why_tree'], active: ['insert:operation'] },
    explanation: 'A live leaderboard needs both updates and rank queries. A sorted array gives rank but inserts are expensive; a heap gives top values but not arbitrary rank. The augmented tree covers both.',
  };

  yield {
    state: labelMatrix(
      'Alternatives',
      [
        { id: 'fenwick', label: 'Fenwick Tree' },
        { id: 'segment', label: 'Segment Tree' },
        { id: 'ost', label: 'Order-stat tree' },
        { id: 'array', label: 'Sorted array' },
      ],
      [{ id: 'best_when', label: 'best when' }, { id: 'limit' }],
      [
        ['keys are small integers', 'coordinate compression needed'],
        ['range aggregates matter', 'more memory'],
        ['ordered dynamic keys', 'implementation complexity'],
        ['mostly static', 'updates are expensive'],
      ],
    ),
    highlight: { found: ['ost:best_when'], compare: ['array:limit', 'fenwick:limit'] },
    explanation: 'Order-statistics trees are not the only ranking tool. They are the natural choice when keys are dynamic and not conveniently mapped into a dense integer range.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'select by rank') yield* selectByRank();
  else if (view === 'rank after rotations') yield* rankAfterRotations();
  else throw new InputError('Pick an order-statistics-tree view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'An order-statistics tree is a balanced binary search tree augmented with subtree sizes. It supports the usual ordered-map operations, plus select(k), which returns the kth smallest key, and rank(x), which returns how many keys are less than or equal to x.',
      'The augmentation is small but powerful. Each node stores size = size(left) + size(right) + 1. With that field, the search can skip entire subtrees while still handling dynamic inserts and deletes.',
    ] },
    { heading: 'How it works', paragraphs: [
      'To select(k), stand at a node and compute leftSize + 1. If k equals that number, the current node is the answer. If k is smaller, go left. If k is larger, go right after subtracting leftSize + 1. This is ordinary binary-search-tree navigation, but the branch condition is rank inside the subtree rather than key comparison.',
      'To compute rank(x), search for x while accumulating the sizes of skipped left subtrees and current nodes. Or, if you already have the node pointer, walk upward and add the parent plus its left subtree whenever you climb from a right child.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'If the base tree is balanced, insert, delete, lookup, select, and rank are O(log n). The additional memory is one integer per node. The difficult part is maintenance: every rotation and structural update must recompute size fields locally and in the right order.',
      'This is a model example of data-structure augmentation. You keep the balancing logic from Red-Black Tree or AVL Tree, add a field with a local recomputation rule, and gain a new set of queries without changing the asymptotic update cost.',
      'Duplicates require an explicit policy. You can store counts per key, store duplicate records as separate nodes with tie-breakers, or make the key composite. The size formula must count whatever the API promises rank and select will count.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A live leaderboard needs dynamic score updates, rank lookup for a player, percentile display, and pagination around a rank. A heap can show the top score but cannot efficiently answer arbitrary rank. A sorted array can answer rank but makes updates expensive. An order-statistics tree keeps the set sorted while supporting both updates and rank/select queries.',
      'The same pattern appears in event streams, trading books, online medians, and scheduling systems where "what is the kth item?" matters while the set changes.',
      'For a leaderboard, the key is usually not just score. It may be score plus timestamp plus user id, so ties are deterministic and rank pages do not jump unpredictably between requests.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: CLRS-style chapter on augmenting data structures and order-statistic trees, https://bobson.ludost.net/books/algo/book6/chap15.htm, and libstdc++ policy-based data-structure design notes, https://gcc.sourceware.org/onlinedocs/libstdc++/manual/policy_data_structures_design.html. Study Red-Black Tree, AVL Tree, Fenwick Tree, Segment Tree, and Treap next.',
    ] },
  ],
};
