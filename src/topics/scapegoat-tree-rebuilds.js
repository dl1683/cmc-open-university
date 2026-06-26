// Scapegoat trees: maintain logarithmic height by occasionally rebuilding a
// whole unbalanced subtree, instead of storing colors or rotating locally.

import { treeState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'scapegoat-tree-rebuilds',
  title: 'Scapegoat Tree Rebuilds',
  category: 'Data Structures',
  summary: 'A self-balancing BST with no per-node balance metadata: insert normally, find an overweight ancestor, and rebuild that subtree perfectly balanced.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['find scapegoat', 'rebuild subtree', 'tradeoff case study'], defaultValue: 'find scapegoat' },
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

function badTree(title = 'After inserting 30, the right side is too deep') {
  return treeState([
    { id: 'n10', value: '10', left: 'n5', right: 'n15' },
    { id: 'n5', value: '5', left: 'n2', right: 'n7' },
    { id: 'n2', value: '2' },
    { id: 'n7', value: '7' },
    { id: 'n15', value: '15', left: null, right: 'n20' },
    { id: 'n20', value: '20', left: null, right: 'n25' },
    { id: 'n25', value: '25', left: null, right: 'n30' },
    { id: 'n30', value: '30' },
  ], 'n10', { title });
}

function rebuiltTree(title = 'Rebuild the scapegoat subtree from sorted nodes') {
  return treeState([
    { id: 'n10', value: '10', left: 'n5', right: 'n20' },
    { id: 'n5', value: '5', left: 'n2', right: 'n7' },
    { id: 'n2', value: '2' },
    { id: 'n7', value: '7' },
    { id: 'n20', value: '20', left: 'n15', right: 'n25' },
    { id: 'n15', value: '15' },
    { id: 'n25', value: '25', left: null, right: 'n30' },
    { id: 'n30', value: '30' },
  ], 'n10', { title });
}

function* findScapegoat() {
  const insertedNode = 30;
  const treeNodes = [10, 5, 2, 7, 15, 20, 25, 30];
  const totalNodes = treeNodes.length;
  const insertPath = [10, 15, 20, 25, 30];
  const insertDepth = insertPath.length - 1;

  const sizes = { 30: 1, 25: 2, 20: 3, 15: 4 };
  const checks = { 30: 'ok leaf', 25: 'right heavy', 20: 'right heavy', 15: 'scapegoat' };

  const scapegoatNode = 15;
  const scapegoatSize = sizes[scapegoatNode];
  const ratio = scapegoatSize / totalNodes;
  const r2 = (v) => Math.round(v * 100) / 100;
  const rightSubCount = 3;
  const rightSubNodes = [20, 25, 30];

  const alphaLow = 0.5;
  const alphaHigh = 1;

  yield {
    state: badTree(),
    highlight: { active: ['n30'], visited: ['n10', 'n15', 'n20', 'n25'] },
    explanation: `Inserted node ${insertedNode} into a tree with ${totalNodes} nodes (${treeNodes.join(', ')}). The insertion path from root is ${insertPath.join(' -> ')}, reaching depth ${insertDepth}. If the depth exceeds the alpha-height bound, the tree walks back up looking for an overweight ancestor.`,
    invariant: `Search stays O(log ${totalNodes}) because any insert deeper than the alpha-height bound triggers rebuilding before the height can drift too far.`,
  };

  yield {
    state: labelMatrix(
      'Walk back up the insert path',
      [
        { id: 'n30', label: 'node 30' },
        { id: 'n25', label: 'parent 25' },
        { id: 'n20', label: 'parent 20' },
        { id: 'n15', label: 'parent 15' },
      ],
      [
        { id: 'subtree', label: 'subtree size' },
        { id: 'balance', label: 'alpha check' },
      ],
      [
        ['1', 'ok leaf'],
        ['2', 'right heavy'],
        ['3', 'right heavy'],
        ['4', 'scapegoat'],
      ],
    ),
    highlight: { active: ['n25:balance', 'n20:balance'], found: ['n15:balance'] },
    explanation: `Walking back: node ${insertedNode} has subtree size ${sizes[30]}, node 25 has size ${sizes[25]}, node 20 has size ${sizes[20]}, node ${scapegoatNode} has size ${sizes[15]}. Alpha check results: ${Object.entries(checks).map(([k, v]) => `${k} = ${v}`).join(', ')}. The scapegoat is the first ancestor whose child subtree is too large relative to the ancestor subtree.`,
  };

  yield {
    state: badTree('Node 15 is blamed for the imbalance'),
    highlight: { found: ['n15'], active: ['n20', 'n25', 'n30'], compare: ['n10', 'n5'] },
    explanation: `Node ${scapegoatNode} is the scapegoat: its subtree has ${scapegoatSize} nodes out of ${totalNodes} total (ratio ${r2(ratio)}). Its right subtree holds ${rightSubCount} nodes (${rightSubNodes.join(', ')}). The whole subtree rooted at ${scapegoatNode} is flattened and rebuilt — no local rotations like AVL or Red-Black trees.`,
  };

  yield {
    state: labelMatrix(
      'Scapegoat rule of thumb',
      [
        { id: 'alpha', label: 'alpha' },
        { id: 'high', label: 'higher alpha' },
        { id: 'low', label: 'lower alpha' },
        { id: 'height', label: 'height bound' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['0.5 < alpha < 1', 'balance tolerance'],
        ['tolerate more skew', 'fewer rebuilds'],
        ['stricter balance', 'more rebuilds'],
        ['log base 1/alpha', 'O(log n)'],
      ],
    ),
    highlight: { found: ['alpha:meaning', 'height:effect'], compare: ['high:effect', 'low:effect'] },
    explanation: `Alpha ranges from ${alphaLow} to ${alphaHigh} (exclusive). The height bound is log_{1/alpha}(n) — for n = ${totalNodes} and alpha = 2/3, that is ${r2(Math.log(totalNodes) / Math.log(1 / (2 / 3)))} levels. Alpha controls how much imbalance is tolerated before paying for a rebuild.`,
  };
}

function* rebuildSubtree() {
  const sorted = [15, 20, 25, 30];
  const count = sorted.length;
  const medianIdx = Math.floor((count - 1) / 2);
  const median = sorted[medianIdx];
  const leftHalf = sorted.slice(0, medianIdx);
  const rightHalf = sorted.slice(medianIdx + 1);

  const oldRoot = 15;
  const newRoot = median;
  const heightBefore = 4;
  const heightAfter = 2;

  const n = 8;
  const r2 = (v) => Math.round(v * 100) / 100;
  const log2n = r2(Math.log2(n));

  yield {
    state: badTree('Flatten the scapegoat subtree by inorder traversal'),
    highlight: { active: ['n15', 'n20', 'n25', 'n30'], compare: ['n10'] },
    explanation: `The rebuild starts with an inorder traversal of the scapegoat subtree. Because it is still a valid BST, inorder traversal produces ${count} sorted nodes: [${sorted.join(', ')}].`,
  };

  yield {
    state: labelMatrix(
      'Rebuild from sorted nodes',
      [
        { id: 'flatten', label: 'flatten' },
        { id: 'middle', label: 'choose median' },
        { id: 'left', label: 'left half' },
        { id: 'right', label: 'right half' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'result', label: 'result' },
      ],
      [
        ['15,20,25,30', 'sorted array'],
        ['20', 'new root'],
        ['15', 'left child'],
        ['25,30', 'right side'],
      ],
    ),
    highlight: { active: ['middle:data', 'middle:result'], found: ['left:result', 'right:result'] },
    explanation: `From sorted [${sorted.join(', ')}], the median is ${median} (index ${medianIdx}). Left half = [${leftHalf.join(', ')}], right half = [${rightHalf.join(', ')}]. The median becomes the new root, and left/right halves are built recursively.`,
  };

  yield {
    state: rebuiltTree(),
    highlight: { found: ['n20'], active: ['n15', 'n25', 'n30'], compare: ['n10'] },
    explanation: `The new subtree root is ${newRoot}, replacing old root ${oldRoot}. Height dropped from ${heightBefore} (chain ${oldRoot} -> 20 -> 25 -> 30) to ${heightAfter} (${newRoot} with children ${leftHalf.join(', ')} and 25 -> 30). The parent pointer from 10 now points to ${newRoot}.`,
  };

  yield {
    state: labelMatrix(
      'Operation costs',
      [
        { id: 'search', label: 'search' },
        { id: 'insert', label: 'insert' },
        { id: 'delete', label: 'delete' },
        { id: 'rebuild', label: 'one rebuild' },
      ],
      [
        { id: 'worst', label: 'worst case' },
        { id: 'amortized', label: 'amortized' },
      ],
      [
        ['O(log n)', 'O(log n)'],
        ['O(n)', 'O(log n)'],
        ['O(n)', 'O(log n)'],
        ['O(k)', 'paid rarely'],
      ],
    ),
    highlight: { found: ['search:worst', 'insert:amortized', 'delete:amortized'], compare: ['insert:worst', 'rebuild:worst'] },
    explanation: `Search is O(log n) worst case. Insert is O(n) worst case but O(log n) amortized. For n = ${n}, log2(${n}) = ${log2n}. A single update can trigger a linear rebuild, but enough imbalance had to accumulate first — the amortized cost stays logarithmic.`,
  };
}

function* tradeoffCaseStudy() {
  const scapegoatFields = 2;
  const avlrbFields = 3;
  const extraFields = avlrbFields - scapegoatFields;

  const rebuiltNodeCount = 4;

  const criteria = [
    { name: 'simple nodes', fit: 'good fit' },
    { name: 'search bound', fit: 'good fit' },
    { name: 'update bursts', fit: 'good fit' },
    { name: 'real-time update', fit: 'bad fit' },
  ];
  const goodFits = criteria.filter((c) => c.fit === 'good fit');
  const badFits = criteria.filter((c) => c.fit === 'bad fit');

  yield {
    state: labelMatrix(
      'Case study: ordered map without node metadata',
      [
        { id: 'node', label: 'node layout' },
        { id: 'insert', label: 'insert path' },
        { id: 'repair', label: 'repair' },
        { id: 'lookup', label: 'lookup' },
      ],
      [
        { id: 'scapegoat', label: 'scapegoat' },
        { id: 'rotation', label: 'AVL/RB' },
      ],
      [
        ['key + pointers', 'extra balance'],
        ['normal BST', 'normal BST'],
        ['rebuild subtree', 'rotate/recolor'],
        ['height bounded', 'height bounded'],
      ],
    ),
    highlight: { found: ['node:scapegoat', 'repair:scapegoat'], compare: ['node:rotation', 'repair:rotation'] },
    explanation: `Scapegoat nodes store ${scapegoatFields} pointers + key (no extra metadata). AVL/RB nodes add ${extraFields} extra balance field (${avlrbFields} fields total). That per-node saving matters across millions of nodes — scapegoat trades bursty rebuilds for leaner memory.`,
  };

  yield {
    state: rebuiltTree('Rebuilds can be cache-friendly in batches'),
    highlight: { active: ['n20', 'n15', 'n25', 'n30'], found: ['n10'] },
    explanation: `The rebuilt subtree has ${rebuiltNodeCount} nodes, relinked in sorted order. That burst is expensive, but freshly laid-out nodes can improve cache locality compared with scattered rotations over time.`,
  };

  yield {
    state: labelMatrix(
      'Choose scapegoat when',
      [
        { id: 'simple', label: 'simple nodes' },
        { id: 'search', label: 'search bound' },
        { id: 'bursts', label: 'update bursts' },
        { id: 'realtime', label: 'real-time update' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['metadata costly', 'good fit'],
        ['worst-case lookup', 'good fit'],
        ['amortized ok', 'good fit'],
        ['no long pause', 'bad fit'],
      ],
    ),
    highlight: { found: ['simple:decision', 'search:decision', 'bursts:decision'], compare: ['realtime:decision'] },
    explanation: `${criteria.length} criteria evaluated: ${goodFits.length} good fits (${goodFits.map((c) => c.name).join(', ')}) and ${badFits.length} bad fit (${badFits.map((c) => c.name).join(', ')}). The tradeoff is blunt: no per-node balance metadata and conceptual simplicity, in exchange for occasional O(k) rebuild pauses.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'find scapegoat') yield* findScapegoat();
  else if (view === 'rebuild subtree') yield* rebuildSubtree();
  else if (view === 'tradeoff case study') yield* tradeoffCaseStudy();
  else throw new InputError('Pick a scapegoat-tree view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The first view shows a binary search tree after one insertion makes a path too deep. Active nodes are the insertion path, and found marks the scapegoat ancestor whose child subtree is too large relative to its own subtree.',
      {type: 'callout', text: 'A scapegoat tree keeps nodes metadata-free by delaying repair until one unbalanced subtree can pay for a full rebuild.'},
      {type: 'image', src: './assets/gifs/scapegoat-tree-rebuilds.gif', alt: 'Animated walkthrough of the scapegoat tree rebuilds visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'A binary search tree is fast only while its height stays small. Scapegoat trees exist to keep O(log n) search without storing a height, color, or priority field in every node.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree diagram with parent and child nodes', caption: 'Scapegoat trees preserve the ordinary binary-search-tree shape; the novelty is when and how a subtree is rebuilt. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.'},
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is local rebalancing, as in AVL or red-black trees. Store balance metadata at each node, then rotate and update metadata after inserts and deletes.',
    ]},
    { heading: 'The wall', paragraphs: [
      'Local rebalancing buys smooth O(log n) updates, but it adds per-node metadata and tricky case logic. A plain tree has lean nodes and simple code, but sorted input can turn it into a linked list.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'Let the tree become a little unbalanced, but enforce a height bound using alpha, where 0.5 < alpha < 1. If an inserted leaf is too deep, some ancestor on that path must be overweight, and rebuilding that ancestor subtree restores balance.',
    ]},
    { heading: 'How it works', paragraphs: [
      'Insert as in a normal binary search tree, then check whether the depth exceeds log base 1/alpha of n. If it does, walk upward, compute subtree sizes, find the first overweight ancestor, flatten that subtree by inorder traversal, and rebuild from medians.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Binary_search_tree.svg', alt: 'Binary search tree diagram with ordered values at nodes', caption: 'Inorder traversal is safe because the subtree remains a valid BST even when its shape is too tall. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_search_tree.svg.'},
    ]},
    { heading: 'Why it works', paragraphs: [
      'Search correctness comes from the binary-search-tree invariant, and rebuilding preserves it because inorder traversal gives sorted keys. The scapegoat existence proof is a counting argument: if every ancestor satisfied the alpha weight bound, the path could not be deeper than the alpha height limit.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'Search is worst-case O(log n). A single insert can cost O(n) if it rebuilds a large subtree, but the subtree needed many prior cheap insertions before becoming unbalanced enough to pay that bill, so insert and delete are O(log n) amortized.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Scapegoat trees fit ordered maps where node size and implementation simplicity matter more than tail latency. They are also useful in teaching because the repair operation is one clear rebuild instead of many rotation cases.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'They fail in hard real-time and low-latency write-heavy systems because one operation can rebuild a large subtree. They are also awkward for concurrency because replacing a whole subtree is harder to publish atomically than rotating a few nodes.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'Insert 30 into the path 10 -> 15 -> 20 -> 25 -> 30. The subtree rooted at 15 contains [15, 20, 25, 30], so rebuilding chooses 20 as root, 15 as left child, and 25 with right child 30 on the right.',
      'With alpha = 2/3 and n = 8, the height bound is log base 1.5 of 8, about 5.13. The example shows the local repair: sorted order is unchanged, but the long right chain is shortened.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Primary source: Galperin and Rivest, Scapegoat Trees, SODA 1993. Study binary search trees, AVL trees, red-black trees, treaps, splay trees, and B-trees to compare how each structure pays for balance.',
    ]},
  ],
};