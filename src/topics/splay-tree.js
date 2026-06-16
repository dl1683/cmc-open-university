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
    explanation: 'A splay tree starts as an ordinary binary search tree. Search finds key 1, then the tree pays extra work immediately: it rotates the accessed key toward the root instead of leaving the shape unchanged.',
    invariant: 'The in-order key order must remain sorted after every rotation.',
  };

  yield {
    state: t(afterZigZig, 'n2', 'Zig-zig: rotate grandparent, then parent'),
    highlight: { active: ['n1', 'n2'], found: ['n2'], compare: ['n4', 'n8'] },
    explanation: 'Because 1 is a left child of 2 and 2 is a left child of 4, the splay step uses zig-zig. The double rotation lifts the whole accessed side, reducing the long path more aggressively than one rotation would.',
  };

  yield {
    state: t(afterZig, 'n1', 'Final zig puts the accessed key at the root'),
    highlight: { found: ['n1'], compare: ['n2', 'n4', 'n8'] },
    explanation: 'The last single rotation moves key 1 to the root. Recently touched keys become cheap to touch again, and nearby keys tend to move closer too. This is why splay trees reward temporal and sequential locality.',
  };

  yield {
    state: labelMatrix(
      'Splay steps',
      [
        { id: 'zig', label: 'zig' },
        { id: 'zigzig', label: 'zig-zig' },
        { id: 'zigzag', label: 'zig-zag' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['parent is root', 'one rotation'],
        ['same-side chain', 'two same-direction rotations'],
        ['opposite-side bend', 'two opposite rotations'],
        ['after every access', 'key becomes root'],
      ],
    ),
    highlight: { active: ['zigzig:effect'], found: ['result:effect'] },
    explanation: 'The algorithm has no stored heights, colors, or priorities. Its balancing information is the access sequence itself.',
  };
}

function* workingSetBehavior() {
  yield {
    state: labelMatrix(
      'Access sequence with locality',
      [
        { id: 'a1', label: 'access 8' },
        { id: 'a2', label: 'access 6' },
        { id: 'a3', label: 'access 8' },
        { id: 'a4', label: 'access 10' },
      ],
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
    explanation: 'Splay trees are adaptive. They do not promise every single access is cheap, but they make repeated and clustered access patterns cheap over time.',
  };

  yield {
    state: t(afterZig, 'n1', 'A hot item is deliberately kept at the root'),
    highlight: { found: ['n1'], compare: ['n2', 'n4', 'n8'] },
    explanation: 'A balanced tree minimizes worst-case height for all keys. A splay tree asks a different question: what if the next query is likely related to the last query? The last accessed key is made the root.',
  };

  yield {
    state: labelMatrix(
      'Amortized promises',
      [
        { id: 'single', label: 'one unlucky access' },
        { id: 'sequence', label: 'long sequence' },
        { id: 'working', label: 'working-set effect' },
        { id: 'static', label: 'static optimality intuition' },
      ],
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
    explanation: 'The hard idea is amortization. A dramatic restructure on one access is not wasted work; it stores credit in the shape of the tree for later accesses.',
  };

  yield {
    state: labelMatrix(
      'Choose the right tree',
      [
        { id: 'rb', label: 'Red-Black Tree' },
        { id: 'avl', label: 'AVL Tree' },
        { id: 'splay', label: 'Splay Tree' },
        { id: 'treap', label: 'Treap' },
      ],
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
    explanation: 'Splay trees are a conceptually important counterpoint to AVL and Red-Black trees: not all balance has to be stored in node metadata.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'A splay tree is a self-adjusting binary search tree. It stores keys in ordinary BST order, but after every search, insertion, or deletion helper step, it splays the touched node to the root using rotations. The tree has no balance factors, colors, random priorities, or explicit frequency counters.',
        'The central idea is adaptive balance. Red-Black Tree and AVL Tree maintain structural invariants that protect every operation. Splay trees instead use the access sequence as information: recently used keys and nearby keys tend to move close to the root, so locality becomes cheaper.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Splaying repeatedly examines the node, its parent, and sometimes its grandparent. If the parent is root, a single zig rotation finishes. If node and parent are both left children or both right children, zig-zig rotates the grandparent and then the parent. If they bend in opposite directions, zig-zag performs two opposite rotations.',
        'Each rotation preserves sorted in-order traversal. What changes is depth. The accessed key rises to the root, and the path it came from is compressed. Insert can add a key like a normal BST and splay it. Delete can splay the key, remove the root, and join the left and right subtrees.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One operation can still take O(n) in a bad shape. The guarantee is amortized: a long sequence of standard operations costs O(log n) amortized per operation. The analysis uses potential stored in subtree sizes, showing that expensive restructures are paid back by future shorter paths.',
        'That amortized framing is the whole lesson. A splay tree is not trying to make the current tree perfectly balanced at all times. It is continuously reorganizing around the workload that actually happened.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Splay trees are useful when access locality matters: caches, memory allocators, text editors, compression dictionaries, link-cut trees, and ordered sets where recently touched keys are likely to be touched again. They are also a gateway to deeper topics such as dynamic optimality and amortized analysis.',
        'A complete case study is a symbol table during interpretation. The same identifiers are accessed repeatedly inside a loop. A static balanced tree treats every name equally. A splay tree keeps the loop-local names near the root without separately measuring their frequency.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Splaying mutates the tree even on reads. That can be awkward in concurrent maps, persistent structures, or systems that expect lookups to be side-effect free. Another misconception is that the tree is always balanced. It is not; the sequence guarantee is amortized, not a per-operation height bound.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Sleator and Tarjan, Self-Adjusting Binary Search Trees, at https://www.cs.cmu.edu/~sleator/papers/self-adjusting.pdf. Study Binary Search Tree, AVL Tree, Red-Black Tree, Treap, Amortized Big-O Growth Rates, and Dynamic Programming next.',
      ],
    },
  ],
};
