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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/order-statistics-tree.gif', alt: 'Animated walkthrough of the order statistics tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A normal search tree answers key questions: is 50 present, what is the next key after 50, what is the smallest key. Many systems also need position questions: what is the 5th smallest key, what rank does this score have, what is the current median after thousands of updates.',
        'Those position questions are easy on a sorted array and awkward on a plain balanced tree. The array knows positions but moves many elements on update. The tree updates cheaply but does not know how many keys sit inside each subtree.',
        {type: 'callout', text: 'Order statistics add one count to each balanced-tree node so whole subtrees become rank-sized blocks.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree diagram with parent and child nodes', caption: 'A search tree becomes rank-aware when each node also stores the size of its left and right subtrees. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
      ],
    },
    {
      heading: 'The naive tools break on different sides',
      paragraphs: [
        'A sorted array gives select(k) by indexing and rank(x) by binary search. Its update cost is the problem: inserting near the front may shift almost every element. When the set changes continuously, the cheap query is bought with expensive maintenance.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Min-heap.png', alt: 'Complete binary min heap with the smallest value at the root', caption: 'A heap exposes the extreme item efficiently, but its shape does not encode the full sorted rank order needed for select(k). Source: Wikimedia Commons, Vikingstad, public domain.'},
        'A heap gives the minimum or maximum quickly, but it has no sorted order for the middle. Finding the 500th item in a heap is not a heap operation. A plain balanced search tree keeps updates and lookups logarithmic, but without counts it cannot skip a subtree by rank.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'An order-statistics tree is a balanced binary search tree with one extra field per node: size = size(left) + size(right) + 1. The field turns every node into a local rank boundary. If the left subtree has three nodes, the current node is the fourth key inside that subtree.',
        'The invariant is small and strict: after every insert, delete, and rotation, every stored size must equal the real number of nodes below it. If that invariant holds, rank and select can treat an entire subtree as a counted block instead of walking through it.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the select view, watch the left subtree size at each node. The highlighted path is not searching for a key value; it is searching for a rank. When the query moves right, the visualization subtracts the current node and its whole left subtree because those ranks are already accounted for.',
        'In the rotation view, focus on the two nodes connected by the rotation and the size labels near them. The shape changes to preserve balance, but the inorder sequence must stay the same. The important state change is the bottom-up repair of sizes after pointers move.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'To run select(k), stand at a node and compute leftSize + 1. If k is equal to that number, return the node. If k is smaller, the answer is in the left subtree. If k is larger, subtract leftSize + 1 and search the right subtree for the remaining rank.',
        'To run rank(x), search for x while keeping a counter. Every time the search moves right from a node, add size(left) + 1 because every key in that left subtree and the current node is less than or equal to the right branch. If the key is found, add its own left subtree and stop according to the duplicate policy.',
        'Rotations are the maintenance test. A left rotation or right rotation changes only a small parent-child neighborhood. After the pointers are correct, recompute the lower rotated node first and the upper rotated node second. Ancestors can then recompute from their children as usual.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the shown tree, select(5) starts at 40. The left subtree has three nodes, so 40 is rank 4 inside the whole tree. The target rank 5 is larger, so the search goes right and asks for rank 1 inside the right subtree.',
        'At 60, the left subtree has one node, so 60 is rank 2 inside that subtree. The remaining target rank is 1, so the search goes left and returns 50. The algorithm skipped the entire left half of the original tree with one size read.',
        'For rank(50), count 50 as rank 1 inside its own tiny subtree. Climbing to 60 adds nothing because 50 came from the left. Climbing to 40 from the right adds size(left of 40) + 1 = 4. The final rank is 5.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A binary search tree partitions each subtree into three ordered parts: all left keys, the current key, and all right keys. The size field gives the exact number of ranks in the left part. Select uses that number to decide which part contains the kth key; rank uses it to count parts that are skipped.',
        'The correctness argument is an invariant argument. The search tree invariant gives the order. The size invariant gives the count. Every select or rank step preserves the meaning of the remaining question: either the answer is in the chosen subtree, or the skipped subtree has been fully counted.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'With a balanced base tree, lookup, insert, delete, select, and rank are O(log n). Doubling the number of keys adds about one more level to the path. The extra space is one counter per node.',
        'The hidden cost is implementation discipline. Every update path must refresh sizes, and every rotation must refresh them in the right order. A single stale size can make select return the wrong key while ordinary lookup still appears healthy.',
        'Duplicates need an explicit design. You can store one node per record with a composite key, store a multiplicity count per key, or define rank as less-than rather than less-than-or-equal. The size formula and public API must agree.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Order-statistics trees fit live leaderboards, online medians, percentile displays, ranked feeds, matching engines, and ordered pagination where inserts and deletes happen between rank queries. The structure is useful when the application needs both sorted order and positions inside that order.',
        'A leaderboard key is rarely just score. It is usually score plus timestamp plus user id, or another tie-breaker that makes ranking deterministic. Without a stable tie policy, pages around a rank can jump even when the tree is correct.',
      ],
    },
    {
      heading: 'Where it is not the right tool',
      paragraphs: [
        'If keys are dense small integers, a Fenwick tree or segment tree over frequencies may be simpler and faster. If the data is mostly static, a sorted array gives excellent locality and trivial select. If the only query is top-k, a heap or partial selection structure may be enough.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in nodes', caption: 'For disk-backed sorted data, a wide B-tree may beat a binary order-statistics tree because it spends fewer page reads per level. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
        'It is also a poor fit when the team cannot afford custom tree maintenance risk. Many languages do not ship order-statistics trees in the standard library. A library tree with a proven augmentation is safer than a clever local implementation used in a money path.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common bug is forgetting that balancing changes metadata. Insert and delete code may update sizes along the search path and still be wrong after a rotation. Test rotations directly with rank and select, not only with inorder traversal.',
        'Another failure mode is counter overflow in long-lived systems with many duplicate records or logical weights. If size means total record count rather than distinct key count, use a counter type that matches the maximum population.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Red-Black Tree or AVL Tree for the balancing layer, Fenwick Tree and Segment Tree for dense-key rank queries, Treap for randomized balanced order-statistics, and Wavelet Tree or Wavelet Matrix for rank/select over static sequences.',
        'Sources worth reading: the CLRS order-statistic tree and augmentation chapter at https://bobson.ludost.net/books/algo/book6/chap15.htm, and the GNU policy-based data structures notes at https://gcc.sourceware.org/onlinedocs/libstdc++/manual/policy_data_structures_design.html.',
      ],
    },
  ],
};
