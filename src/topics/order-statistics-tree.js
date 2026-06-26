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
  const nodeCount = 7;
  const rootSize = nodeCount;
  const leftChildSize = 3;
  const rightChildSize = 3;
  const leafSize = 1;
  const targetRank = 5;
  const resultKey = 50;
  yield {
    state: orderTree('Every node stores subtree size'),
    highlight: { active: ['n40', 'n20', 'n60'], found: ['n10', 'n30', 'n50', 'n70'] },
    explanation: `An order-statistics tree with ${nodeCount} nodes starts as a balanced search tree, often a red-black tree, and adds one field: size[node] = size[left] + size[right] + ${leafSize}.`,
    invariant: `The root's size field equals ${rootSize} — the total node count — and must stay correct after every insert, delete, and rotation.`,
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
    explanation: `To select the kth smallest key, compare k with the rank of the current node inside its subtree. At the root, leftSize + 1 = ${leftChildSize} + 1 = ${leftChildSize + 1}, so select(${targetRank}) moves right with target reduced to ${targetRank - (leftChildSize + 1)}.`,
  };

  yield {
    state: orderTree('Path for select(5) ends at 50'),
    highlight: { active: ['n40', 'n60', 'n50', 'e-40-60', 'e-60-50'], found: ['n50'], compare: ['n20'] },
    explanation: `The tree does not need an inorder array. select(${targetRank}) lands on node ${resultKey} by skipping entire subtrees — subtree sizes let the search prune without walking every key.`,
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
    explanation: `This is the power of augmentation: one small field per node unlocks ${4} operations — select, rank, median, and percentile — all in O(log n).`,
  };
}

function* rankAfterRotations() {
  const nodeCount = 7;
  const edgeCount = 6;
  const rankTarget = 50;
  const rankResult = 5;
  const rootLeftSize = 3;
  const leaderboardOps = 4;
  const alternativeCount = 4;
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
    explanation: `Rank of ${rankTarget} is computed by walking upward. Start with rank 1 inside its own subtree, then at root 40 add size(left) + 1 = ${rootLeftSize} + 1 = ${rootLeftSize + 1}, reaching final rank ${rankResult}.`,
  };

  yield {
    state: orderTree('Rotations must repair size fields locally'),
    highlight: { active: ['n40', 'n60', 'e-40-60'], compare: ['n50', 'n70'], found: ['n20'] },
    explanation: `Balanced trees rotate during inserts and deletes. Across all ${nodeCount} nodes and ${edgeCount} edges, the order-statistics augmentation survives because only a small local set of size fields changes.`,
    invariant: `Update child pointers first, then recompute sizes bottom-up for the rotated nodes — the total must still equal ${nodeCount}.`,
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
    explanation: `A live leaderboard needs all ${leaderboardOps} operations shown — insert, rank, pagination, and median. A sorted array gives rank but inserts are expensive; the augmented tree covers all ${leaderboardOps} in O(log n).`,
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
    explanation: `Among ${alternativeCount} alternatives — Fenwick, segment tree, order-stat tree, and sorted array — the order-statistics tree is the natural choice when keys are dynamic and not mapped into a dense integer range.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'The select view shows a balanced search tree where every node stores subtree size. For select(k), compare k with leftSize + 1 at the current node; moving right subtracts the left subtree and the current node. The rank view does the inverse by adding skipped left subtrees while searching for a key.',
      {type: 'image', src: './assets/gifs/order-statistics-tree.gif', alt: 'Animated walkthrough of the order statistics tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      {type: 'callout', text: 'Order statistics add one count to each balanced-tree node so whole subtrees become rank-sized blocks.'},
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree diagram with parent and child nodes', caption: 'A search tree becomes rank-aware when each node also stores the size of its left and right subtrees. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
      'A normal search tree answers whether a key exists and what comes next. Many systems also need position questions: the 5th smallest key, the rank of a score, or the current median after updates.',
      'An order-statistics tree augments a balanced binary search tree with one maintained count per node. That count turns a whole subtree into a block of known ranks.',
    ]},
    { heading: 'The obvious approach', paragraphs: [
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Min-heap.png', alt: 'Complete binary min heap with the smallest value at the root', caption: 'A heap exposes the extreme item efficiently, but its shape does not encode the full sorted rank order needed for select(k). Source: Wikimedia Commons, Vikingstad, public domain.'},
      'A sorted array gives select(k) by indexing and rank(x) by binary search. It is excellent for mostly static data. Inserts and deletes are the problem because they shift many elements.',
      'A heap gives the minimum or maximum quickly, but it does not store full sorted order. Finding the 500th element in a heap is not a heap operation.',
    ]},
    { heading: 'The wall', paragraphs: [
      'The wall is dynamic order plus position. Arrays know positions but update poorly; plain balanced trees update well but do not know how many keys a subtree contains. Without counts, select(k) becomes an inorder walk.',
      'Two heaps can maintain a median, but not arbitrary rank, select, pagination, or percentile queries. The structure needs balance for updates and counts for positions.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'The core insight is that a search-tree node already partitions order into left subtree, current key, and right subtree. If the left subtree has three nodes, the current node is rank four inside that subtree. One size field makes that fact available in O(1).',
      'The invariant is size(node) = size(left) + size(right) + 1, adjusted if duplicates are stored as multiplicities. If the invariant holds everywhere, rank and select can skip whole subtrees safely.',
    ]},
    { heading: 'How it works', paragraphs: [
      'To select(k), compute r = size(left) + 1. If k equals r, return the node; if k is smaller, go left; if k is larger, go right with k - r. The meaning of k is preserved after each move.',
      'To compute rank(x), search for x while accumulating skipped smaller keys. When the search moves right from a node, add size(left) + 1 because all those keys are smaller than anything in the right branch. Rotations after insert/delete must recompute size fields bottom-up.',
    ]},
    { heading: 'Why it works', paragraphs: [
      'Correctness uses two invariants. The binary-search-tree invariant gives order, and the size invariant gives exact counts. Select compares the target rank with the count boundary at each node.',
      'Rank is the same proof in reverse. Whenever the search moves right, the entire left subtree and current node have been passed, so adding their count is exact. No skipped subtree can contain the target rank later.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'With a balanced base tree, lookup, insert, delete, select, and rank cost O(log n). Doubling n adds about one tree level. Space is O(n) plus one count per node.',
      'The hidden cost is maintenance risk. One stale size field can make rank or select wrong while ordinary lookup still passes. Tests must cover rotations, deletion cases, duplicate policy, and counter overflow.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Order-statistics trees fit live leaderboards, dynamic medians, percentile dashboards, ranked feeds, matching engines, and ordered pagination. These workloads update keys while asking for positions inside the sorted order.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in nodes', caption: 'For disk-backed sorted data, a wide B-tree may beat a binary order-statistics tree because it spends fewer page reads per level. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
      'A leaderboard usually needs a composite key such as score, timestamp, and user id. Without a stable tie-breaker, pages around a rank can jump even when the tree is correct.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'If keys are dense small integers, a Fenwick tree or segment tree over frequencies can be simpler and faster. If data is mostly static, a sorted array has better locality. If only top-k matters, a heap may be enough.',
      'It also fails when a team cannot afford custom balanced-tree maintenance. Many standard libraries do not include this augmentation, so a proven library can be safer than local rotation code.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'In the shown seven-node tree, root 40 has left subtree size 3. select(5) compares 5 with 3 + 1 = 4, then moves right and asks for rank 1 in the right subtree. At node 60, leftSize + 1 = 2, so rank 1 moves left and returns 50.',
      'For rank(50), start with 1 for node 50. Moving up to 60 adds nothing because 50 was a left child. Moving up to 40 from the right adds size(left of 40) + 1 = 4, so the rank is 5.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: CLRS Introduction to Algorithms, the order-statistic tree and augmentation chapter; GNU policy-based data structures documentation for tree_order_statistics_node_update; standard red-black and AVL tree rotation references.',
      'Study Balanced BST, Red-Black Tree, AVL Tree, Fenwick Tree, Segment Tree, Treap, Wavelet Tree, and online median algorithms next. The checkpoint is repairing size fields after a rotation without changing inorder order.',
    ]},
  ],
}




;
