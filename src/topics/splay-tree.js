// Splay tree: every access rotates the touched node to the root.

import { treeState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'splay-tree',
  title: 'Splay Tree',
  category: 'Data Structures',
  summary: 'A self-adjusting binary search tree: every access splays the key to the root, buying amortized logarithmic performance and locality wins.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['zig-zig access', 'working-set behavior'], defaultValue: 'zig-zig access' },
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

function t(nodes, rootId, title) {
  return treeState(nodes, rootId, { title });
}

const startTree = [
  { id: 'n8', value: 8, left: 'n4', right: 'n12' },
  { id: 'n4', value: 4, left: 'n2', right: 'n6' },
  { id: 'n2', value: 2, left: 'n1', right: 'n3' },
  { id: 'n1', value: 1 },
  { id: 'n3', value: 3 },
  { id: 'n6', value: 6 },
  { id: 'n12', value: 12, left: 'n10', right: 'n14' },
  { id: 'n10', value: 10 },
  { id: 'n14', value: 14 },
];

const afterZigZig = [
  { id: 'n2', value: 2, left: 'n1', right: 'n4' },
  { id: 'n1', value: 1 },
  { id: 'n4', value: 4, left: 'n3', right: 'n8' },
  { id: 'n3', value: 3 },
  { id: 'n8', value: 8, left: 'n6', right: 'n12' },
  { id: 'n6', value: 6 },
  { id: 'n12', value: 12, left: 'n10', right: 'n14' },
  { id: 'n10', value: 10 },
  { id: 'n14', value: 14 },
];

const afterZig = [
  { id: 'n1', value: 1, right: 'n2' },
  { id: 'n2', value: 2, right: 'n4' },
  { id: 'n4', value: 4, left: 'n3', right: 'n8' },
  { id: 'n3', value: 3 },
  { id: 'n8', value: 8, left: 'n6', right: 'n12' },
  { id: 'n6', value: 6 },
  { id: 'n12', value: 12, left: 'n10', right: 'n14' },
  { id: 'n10', value: 10 },
  { id: 'n14', value: 14 },
];

function* zigZigAccess() {
  yield {
    state: t(startTree, 'n8', 'Access key 1 in a deep left-left path'),
    highlight: { active: ['n1'], compare: ['n8', 'n4', 'n2'] },
    explanation: `A splay tree starts as an ordinary binary search tree with ${startTree.length} nodes rooted at ${startTree[0].value}. Search finds key 1, then the tree pays extra work immediately: it rotates the accessed key toward the root instead of leaving the shape unchanged.`,
    invariant: `The in-order key order across all ${startTree.length} nodes must remain sorted after every rotation.`,
  };

  yield {
    state: t(afterZigZig, 'n2', 'Zig-zig: rotate grandparent, then parent'),
    highlight: { active: ['n1', 'n2'], found: ['n2'], compare: ['n4', 'n8'] },
    explanation: `Because 1 is a left child of ${afterZigZig[0].value} and ${afterZigZig[0].value} is a left child of ${afterZigZig[2].value}, the splay step uses zig-zig. The double rotation lifts the whole accessed side, reducing the long path more aggressively than one rotation would.`,
  };

  yield {
    state: t(afterZig, 'n1', 'Final zig puts the accessed key at the root'),
    highlight: { found: ['n1'], compare: ['n2', 'n4', 'n8'] },
    explanation: `The last single rotation moves key ${afterZig[0].value} to the root. Recently touched keys become cheap to touch again, and nearby keys tend to move closer too. This is why splay trees reward temporal and sequential locality.`,
  };

  const splayRows = [
    { id: 'zig', label: 'zig' },
    { id: 'zigzig', label: 'zig-zig' },
    { id: 'zigzag', label: 'zig-zag' },
    { id: 'result', label: 'result' },
  ];
  const splayCols = [
    { id: 'when', label: 'when' },
    { id: 'effect', label: 'effect' },
  ];
  yield {
    state: labelMatrix(
      'Splay steps',
      splayRows,
      splayCols,
      [
        ['parent is root', 'one rotation'],
        ['same-side chain', 'two same-direction rotations'],
        ['opposite-side bend', 'two opposite rotations'],
        ['after every access', 'key becomes root'],
      ],
    ),
    highlight: { active: ['zigzig:effect'], found: ['result:effect'] },
    explanation: `The algorithm uses ${splayRows.length - 1} rotation cases (plus the final result) and stores no heights, colors, or priorities. Its balancing information is the access sequence itself.`,
  };
}

function* workingSetBehavior() {
  const accessRows = [
    { id: 'a1', label: 'access 8' },
    { id: 'a2', label: 'access 6' },
    { id: 'a3', label: 'access 8' },
    { id: 'a4', label: 'access 10' },
  ];
  yield {
    state: labelMatrix(
      'Access sequence with locality',
      accessRows,
      [
        { id: 'tree', label: 'tree reaction' },
        { id: 'payoff', label: 'payoff' },
      ],
      [
        ['splay 8 to root', 'hot key cheap'],
        ['splay neighbor 6', 'local cluster rises'],
        ['8 near root already', 'short search'],
        ['10 near root side', 'sequential scan helps'],
      ],
    ),
    highlight: { found: ['a1:payoff', 'a3:payoff'], compare: ['a4:payoff'] },
    explanation: `Splay trees are adaptive. Across ${accessRows.length} accesses they do not promise every single operation is cheap, but they make repeated and clustered access patterns cheap over time.`,
  };

  yield {
    state: t(afterZig, 'n1', 'A hot item is deliberately kept at the root'),
    highlight: { found: ['n1'], compare: ['n2', 'n4', 'n8'] },
    explanation: `A balanced tree minimizes worst-case height for all ${afterZig.length} keys. A splay tree asks a different question: what if the next query is likely related to the last query? The last accessed key ${afterZig[0].value} is made the root.`,
  };

  const promiseRows = [
    { id: 'single', label: 'one unlucky access' },
    { id: 'sequence', label: 'long sequence' },
    { id: 'working', label: 'working-set effect' },
    { id: 'static', label: 'static optimality intuition' },
  ];
  yield {
    state: labelMatrix(
      'Amortized promises',
      promiseRows,
      [
        { id: 'cost', label: 'cost' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['can be O(n)', 'path may be long'],
        ['O(log n) amortized', 'rotations repay future searches'],
        ['recent keys cheaper', 'locality becomes structure'],
        ['frequent keys rise', 'tree adapts without counters'],
      ],
    ),
    highlight: { active: ['sequence:cost', 'working:meaning'], compare: ['single:cost'] },
    explanation: `The hard idea is amortization. Across ${promiseRows.length} cost scenarios, a dramatic restructure on one access is not wasted work; it stores credit in the shape of the tree for later accesses.`,
  };

  const treeChoiceRows = [
    { id: 'rb', label: 'Red-Black Tree' },
    { id: 'avl', label: 'AVL Tree' },
    { id: 'splay', label: 'Splay Tree' },
    { id: 'treap', label: 'Treap' },
  ];
  yield {
    state: labelMatrix(
      'Choose the right tree',
      treeChoiceRows,
      [
        { id: 'best', label: 'best when' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['general ordered map', 'predictable height'],
        ['lookup-heavy map', 'stricter balance'],
        ['locality-heavy access', 'amortized, mutates on read'],
        ['split and merge', 'randomized height'],
      ],
    ),
    highlight: { found: ['splay:best'], compare: ['rb:tradeoff', 'treap:best'] },
    explanation: `Compared against ${treeChoiceRows.length - 1} alternatives, splay trees are a conceptually important counterpoint to AVL and Red-Black trees: not all balance has to be stored in node metadata.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'zig-zig access') yield* zigZigAccess();
  else if (view === 'working-set behavior') yield* workingSetBehavior();
  else throw new InputError('Pick a splay-tree view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Active nodes trace the search path, found nodes show the accessed key moving upward, and compare nodes show bystanders whose depth changes. The invariant to watch is sorted in-order traversal after every rotation.', {type: 'callout', text: 'Splaying turns the last access into tree shape: recent and nearby keys move toward the root without stored balance metadata.'}, {type: 'image', src: './assets/gifs/splay-tree.gif', alt: 'Animated walkthrough of the splay tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Real ordered-map workloads often repeat recent or nearby keys. A splay tree adapts to that locality by moving every accessed key to the root.'], },
    { heading: 'The obvious approach', paragraphs: ['A plain binary search tree follows comparisons left and right. AVL and red-black trees add metadata to guarantee logarithmic worst-case height.'], },
    { heading: 'The wall', paragraphs: ['A plain tree can become a length-n chain. Balanced trees avoid that, but they still make a hot key pay the same path length on every lookup.'], },
    { heading: 'The core insight', paragraphs: ['After every access, rotate the touched node to the root with zig, zig-zig, or zig-zag steps. The tree stores no height or color; access history becomes the balancing signal.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Binary_search_tree.svg', alt: 'Binary search tree diagram with ordered values at nodes', caption: 'Splay trees preserve the ordinary BST order invariant while changing shape after each access. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_search_tree.svg.'}], },
    { heading: 'How it works', paragraphs: ['Search normally until the key is found or the search stops. Then splay the found or last visited node: zig handles a parent at the root, zig-zig handles two same-side edges, and zig-zag handles a bend.'], },
    { heading: 'Why it works', paragraphs: ['Rotations preserve binary-search order, so a sequence of rotations preserves correctness. The amortized proof charges expensive deep accesses against the path compression they create for future operations.'], },
    { heading: 'Cost and complexity', paragraphs: ['One operation can cost O(n), but any m operations on n nodes cost O(m log n) total. The node memory is small because no balance metadata is stored.'], },
    { heading: 'Real-world uses', paragraphs: ['Splay trees fit maps with temporal or spatial locality and operations that benefit from split and join. They also sit inside link-cut trees for dynamic forest operations.'], },
    { heading: 'Where it fails', paragraphs: ['It fails when each operation needs a hard worst-case latency bound. It also mutates on read, which complicates concurrency, snapshots, and APIs that promise read-only lookup.'], },
    { heading: 'Worked example', paragraphs: ['Start with root 8 and access key 1 on path 8 to 4 to 2 to 1. A left-left zig-zig rotates 4 right then 2 right, and a final zig rotates 8 right, making 1 the root while preserving sorted order.'], },
    { heading: 'Sources and study next', paragraphs: ['Study Sleator and Tarjan on self-adjusting binary search trees and Tarjan on amortized analysis. Then compare Binary Search Tree, AVL Tree, Red-Black Tree, Treap, Skip List, and Link-Cut Tree.'], },
  ],
};
