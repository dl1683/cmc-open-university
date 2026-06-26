// Finger trees: persistent sequences with fast access at both ends and
// monoidal measures that turn one tree shape into many indexed structures.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'finger-tree-measured-sequence',
  title: 'Finger Tree Measured Sequence',
  category: 'Data Structures',
  summary: 'A persistent 2-3 sequence tree: digits give fast ends, the middle recurses, and monoidal measures power split, indexing, priority, and interval queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['digits and spine', 'measured split', 'case studies'], defaultValue: 'digits and spine' },
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

function fingerShape(title) {
  return graphState({
    nodes: [
      { id: 'measure', label: 'measure', x: 4.9, y: 0.9, note: 'monoid' },
      { id: 'prefix', label: 'prefix', x: 1.2, y: 3.0, note: '1..4 items' },
      { id: 'middle', label: 'middle', x: 4.9, y: 3.0, note: 'recursive' },
      { id: 'suffix', label: 'suffix', x: 8.6, y: 3.0, note: '1..4 items' },
      { id: 'left', label: 'left end', x: 1.2, y: 5.2, note: 'O(1)' },
      { id: 'right', label: 'right end', x: 8.6, y: 5.2, note: 'O(1)' },
      { id: 'split', label: 'split', x: 4.9, y: 5.5, note: 'log n' },
    ],
    edges: [
      { id: 'e-measure-prefix', from: 'measure', to: 'prefix', weight: '' },
      { id: 'e-measure-middle', from: 'measure', to: 'middle', weight: '' },
      { id: 'e-measure-suffix', from: 'measure', to: 'suffix', weight: '' },
      { id: 'e-prefix-middle', from: 'prefix', to: 'middle', weight: '' },
      { id: 'e-middle-suffix', from: 'middle', to: 'suffix', weight: '' },
      { id: 'e-prefix-left', from: 'prefix', to: 'left', weight: '' },
      { id: 'e-suffix-right', from: 'suffix', to: 'right', weight: '' },
      { id: 'e-middle-split', from: 'middle', to: 'split', weight: '' },
    ],
  }, { title });
}

function* digitsAndSpine() {
  const hl1 = { active: ['prefix', 'middle', 'suffix'], found: ['left', 'right'] };
  yield {
    state: fingerShape('Deep node: prefix digit, recursive middle, suffix digit'),
    highlight: hl1,
    explanation: `A finger tree is a persistent sequence shaped as Empty, Single, or Deep. In Deep, ${hl1.active.length} components (${hl1.active.join(', ')}) form the structure, with ${hl1.found.length} fast-access ends (${hl1.found.join(', ')}). The 7-node graph shows all parts of a Deep finger tree connected by 8 edges.`,
    invariant: 'Digits stay small, so pushing or popping at either end touches only a constant-size edge before occasional recursive repair.',
  };

  const hl2Rows = [
    { id: 'prefix', label: 'prefix digit' },
    { id: 'middle', label: 'middle tree' },
    { id: 'suffix', label: 'suffix digit' },
    { id: 'node', label: 'Node2/3' },
  ];
  const hl2Cols = [
    { id: 'contains', label: 'contains' },
    { id: 'role', label: 'role' },
  ];
  const hl2 = { active: ['prefix:role', 'suffix:role'], found: ['middle:role', 'node:role'] };
  yield {
    state: labelMatrix(
      'Shape of a Deep node',
      hl2Rows,
      hl2Cols,
      [
        ['1..4 values', 'fast left'],
        ['nodes', 'recursion'],
        ['1..4 values', 'fast right'],
        ['2 or 3 children', 'balance'],
      ],
    ),
    highlight: hl2,
    explanation: `The recursive middle does not hold raw elements at the next level. It holds Node2 and Node3 packets. This ${hl2Rows.length}-row by ${hl2Cols.length}-column breakdown shows ${hl2.active.length} active roles (${hl2.active.join(', ')}) and ${hl2.found.length} found roles (${hl2.found.join(', ')}). That keeps the underlying 2-3-tree balance while making the ends cheap.`,
  };

  const hl3Rows = [
    { id: 'cons', label: 'push left' },
    { id: 'snoc', label: 'push right' },
    { id: 'viewl', label: 'pop left' },
    { id: 'viewr', label: 'pop right' },
  ];
  const hl3 = { found: ['cons:amortized', 'snoc:amortized', 'viewl:amortized', 'viewr:amortized'] };
  yield {
    state: labelMatrix(
      'Deque operations',
      hl3Rows,
      [
        { id: 'usual', label: 'usual touch' },
        { id: 'amortized', label: 'amortized' },
      ],
      [
        ['one digit', 'O(1)'],
        ['one digit', 'O(1)'],
        ['one digit', 'O(1)'],
        ['one digit', 'O(1)'],
      ],
    ),
    highlight: hl3,
    explanation: `The name "finger" means the structure gives efficient access near distinguished positions. All ${hl3.found.length} operations (${hl3Rows.map(r => r.label).join(', ')}) are amortized O(1), reflecting the ${hl3.found.length} highlighted cells. For the standard sequence, those fingers are the left and right ends.`,
  };

  const hl4 = { active: ['prefix', 'suffix', 'split'], compare: ['middle'], found: ['measure'] };
  yield {
    state: fingerShape('Persistence comes from path copying and sharing'),
    highlight: hl4,
    explanation: `Like RRB Tree Persistent Vector and Zipper Focused Tree, updates return a new root and share old pieces. ${hl4.active.length} active nodes (${hl4.active.join(', ')}) are path-copied, ${hl4.compare.length} node (${hl4.compare.join(', ')}) is compared for recursion, and ${hl4.found.length} node (${hl4.found.join(', ')}) anchors the cached summary. The old sequence stays valid for undo, snapshots, or concurrent readers.`,
  };
}

function* measuredSplit() {
  const ms1Rows = [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b' },
    { id: 'c', label: 'c' },
    { id: 'd', label: 'd' },
    { id: 'e', label: 'e' },
  ];
  const ms1Cols = [
    { id: 'size', label: 'size' },
    { id: 'prefix', label: 'prefix sum' },
  ];
  const ms1Hl = { active: ['c:prefix'], found: ['d:prefix'] };
  yield {
    state: labelMatrix(
      'Measure each element by size',
      ms1Rows,
      ms1Cols,
      [
        ['1', '1'],
        ['1', '2'],
        ['1', '3'],
        ['1', '4'],
        ['1', '5'],
      ],
    ),
    highlight: ms1Hl,
    explanation: `A measure is an associative summary. This ${ms1Rows.length}-element by ${ms1Cols.length}-column table shows ${ms1Hl.active.length} active cell (${ms1Hl.active.join(', ')}) and ${ms1Hl.found.length} found cell (${ms1Hl.found.join(', ')}). If every element has size 1, internal summaries are counts. Split at index 3 becomes: find the first place where the accumulated count crosses 3.`,
    invariant: 'Measures must combine associatively so summaries can be cached at internal nodes and recomputed locally after updates.',
  };

  const ms2Hl = { active: ['measure', 'middle', 'split'], found: ['prefix', 'suffix'] };
  yield {
    state: fingerShape('Split follows cached measures down the tree'),
    highlight: ms2Hl,
    explanation: `The split operation does not scan the whole sequence. It walks ${ms2Hl.active.length} active nodes (${ms2Hl.active.join(', ')}) by comparing the target predicate with cached measures, descends into one child, and rebuilds the ${ms2Hl.found.length} sides (${ms2Hl.found.join(', ')}) around the split point.`,
  };

  const ms3Rows = [
    { id: 'seq', label: 'sequence' },
    { id: 'prio', label: 'priority q' },
    { id: 'interval', label: 'intervals' },
    { id: 'search', label: 'ordered search' },
  ];
  const ms3Hl = { found: ['seq:query', 'prio:query', 'interval:query'], active: ['seq:measure'] };
  yield {
    state: labelMatrix(
      'Swap the measure, get a different structure',
      ms3Rows,
      [
        { id: 'measure', label: 'measure' },
        { id: 'query', label: 'query' },
      ],
      [
        ['count', 'index/split'],
        ['minimum priority', 'find min'],
        ['max endpoint', 'overlap'],
        ['ordered key summary', 'split by key'],
      ],
    ),
    highlight: ms3Hl,
    explanation: `This is why finger trees are called general-purpose. ${ms3Rows.length} use-cases (${ms3Rows.map(r => r.label).join(', ')}) share the same tree shape, with ${ms3Hl.found.length} query cells highlighted (${ms3Hl.found.join(', ')}) and ${ms3Hl.active.length} active measure (${ms3Hl.active.join(', ')}). The measure decides what question can be routed quickly.`,
  };

  const ms4Rows = [
    { id: 'ends', label: 'ends' },
    { id: 'concat', label: 'concat' },
    { id: 'split', label: 'split' },
    { id: 'index', label: 'index' },
  ];
  const ms4Hl = { found: ['ends:cost', 'concat:cost', 'split:cost'], compare: ['index:reason'] };
  yield {
    state: labelMatrix(
      'Complexities',
      ms4Rows,
      [
        { id: 'cost', label: 'cost' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['amortized O(1)', 'digits'],
        ['O(log min(n,m))', 'join smaller side'],
        ['O(log n)', 'measure descent'],
        ['O(log n)', 'count measure'],
      ],
    ),
    highlight: ms4Hl,
    explanation: `Finger trees are not flat arrays. Across ${ms4Rows.length} operations (${ms4Rows.map(r => r.label).join(', ')}), ${ms4Hl.found.length} cost cells (${ms4Hl.found.join(', ')}) are highlighted and ${ms4Hl.compare.length} reason cell (${ms4Hl.compare.join(', ')}) is compared. They trade tight cache locality for persistent structure, fast ends, efficient concatenation, and flexible measured search.`,
  };
}

function* caseStudies() {
  const cs1Rows = [
    { id: 'haskell', label: 'Data.Sequence' },
    { id: 'rope', label: 'rope/editor' },
    { id: 'prio', label: 'priority queue' },
    { id: 'interval', label: 'interval index' },
  ];
  const cs1Hl = { active: ['haskell:need', 'haskell:measure'], found: ['rope:measure', 'interval:measure'] };
  yield {
    state: labelMatrix(
      'Complete case-study routes',
      cs1Rows,
      [
        { id: 'need', label: 'need' },
        { id: 'measure', label: 'measure' },
      ],
      [
        ['persistent deque', 'size'],
        ['split near index', 'chunk length'],
        ['find best task', 'min priority'],
        ['overlap query', 'max endpoint'],
      ],
    ),
    highlight: cs1Hl,
    explanation: `Haskell Data.Sequence is the canonical production-facing case study: a persistent finite sequence built on finger-tree ideas. ${cs1Rows.length} case studies (${cs1Rows.map(r => r.label).join(', ')}) are listed, with ${cs1Hl.active.length} active cells (${cs1Hl.active.join(', ')}) and ${cs1Hl.found.length} found measure cells (${cs1Hl.found.join(', ')}). The same measured-tree recipe adapts to text, priority, and interval workloads.`,
  };

  const cs2Hl = { active: ['split', 'measure'], found: ['prefix', 'suffix'], compare: ['middle'] };
  yield {
    state: fingerShape('Editor case study: split and rejoin persistent text chunks'),
    highlight: cs2Hl,
    explanation: `A rope-like editor can store chunks in a measured finger tree where the measure is character count. ${cs2Hl.active.length} active nodes (${cs2Hl.active.join(', ')}) drive the split, ${cs2Hl.found.length} found nodes (${cs2Hl.found.join(', ')}) form the result sides, and ${cs2Hl.compare.length} compared node (${cs2Hl.compare.join(', ')}) holds the recursive spine. Cursor movement and split-at-position use cached sizes, while edits share most unchanged chunks.`,
  };

  const cs3Rows = [
    { id: 'versions', label: 'versions' },
    { id: 'ends', label: 'two ends' },
    { id: 'splits', label: 'split/join' },
    { id: 'arrays', label: 'tight arrays' },
  ];
  const cs3Hl = { found: ['versions:decision', 'ends:decision', 'splits:decision'], compare: ['arrays:decision'] };
  yield {
    state: labelMatrix(
      'When to choose it',
      cs3Rows,
      [
        { id: 'signal', label: 'signal' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['undo/snapshots', 'good fit'],
        ['deque-heavy', 'good fit'],
        ['measured routing', 'good fit'],
        ['numeric loops', 'bad fit'],
      ],
    ),
    highlight: cs3Hl,
    explanation: `The practical rule is conservative. ${cs3Hl.found.length} scenarios (${cs3Hl.found.join(', ')}) are good fits, while ${cs3Hl.compare.length} scenario (${cs3Hl.compare.join(', ')}) is a bad fit among ${cs3Rows.length} total use-cases (${cs3Rows.map(r => r.label).join(', ')}). Use a finger tree when persistence plus measured split/join are first-class operations. Do not use it to replace a simple array in hot numeric code.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'digits and spine') yield* digitsAndSpine();
  else if (view === 'measured split') yield* measuredSplit();
  else if (view === 'case studies') yield* caseStudies();
  else throw new InputError('Pick a finger-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation builds a finger tree step by step, showing how elements enter through the prefix and suffix digits, how overflow pushes nodes into the recursive middle spine, and how a measured split descends through cached summaries to find a target index. Each frame labels the current operation and highlights the nodes being touched.',
        {type: 'image', src: './assets/gifs/finger-tree-measured-sequence.gif', alt: 'Animated walkthrough of the finger tree measured sequence visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Watch the digit arrays at the left and right ends first. Most push and pop operations only change these small arrays. When a digit grows past four elements, the animation shows three of them bundled into a node and pushed into the middle spine -- that is the key structural event.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A linked list gives you a fast front but O(n) indexing and O(n) concatenation. A balanced binary search tree gives you O(log n) access everywhere but makes deque-style push and pop heavier than necessary. A flat array copies the whole thing on every persistent update. Each structure solves part of the problem and fails the rest.',
        {type: 'callout', text: 'The measure is the index: once every subtree carries a monoidal summary, split and search become guided descent.'},
        'Finger trees exist because Ralf Hinze and Ross Paterson wanted one shape that handles fast ends (amortized O(1) push/pop), efficient split and concatenation (O(log n)), full persistence (old versions survive), and summary-guided search -- all at once. The price is pointer overhead and implementation complexity, but the generality is real.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The most natural persistent sequence is a balanced tree -- an AVL tree or a 2-3 tree keyed by position. You get O(log n) access, split, and concat. Push to either end is also O(log n) because you walk to a leaf, insert, and rebalance along the path.',
        'That O(log n) per push feels wasteful when your workload is dominated by deque operations -- add to front, remove from back, peek at either end. A purely functional deque (like Okasaki\'s) can do those in amortized O(1), but it gives up efficient indexing and splitting. You want both.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The conflict is between two shapes. A flat deque keeps the ends close but cannot split or index without scanning. A balanced tree can split and index but buries the ends under O(log n) layers of nodes. Making one structure do both means somehow keeping the ends exposed while maintaining balanced depth.',
        'There is a second, subtler wall. Even if you solve the structural problem, you still need the tree to answer queries like "where is index 42?" or "where is the minimum priority?" without scanning every element. That requires some kind of cached summary at every internal node, and that summary must survive rebalancing without corruption.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Start with a 2-3 tree. Now peel off the leftmost and rightmost few elements and hold them in small arrays called digits (one to four elements each). The rest of the tree becomes the middle spine, but here is the recursive trick: the spine is itself a finger tree whose elements are not raw values but nodes of two or three values from the level below.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Finger-tree_from_2-3_tree.jpg/330px-Finger-tree_from_2-3_tree.jpg', alt: 'Transformation from a 2-3 tree into a finger tree with exposed ends', caption: 'A finger tree pulls the ends of a balanced tree close to the top while keeping the middle recursive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Finger-tree_from_2-3_tree.jpg.'},
        'This gives you two things at once. The digits at the ends make push and pop touch only a small array most of the time -- amortized O(1). The recursive spine preserves balanced depth, so split and concat stay O(log n). The shape is a 2-3 tree that has been turned inside out: the ends are pulled to the surface while the middle stays deep.',
        'The second insight is the measure. Attach a value to every element. Define a way to combine two values into one that is associative and has an identity element -- this combination is called a monoid. (Associative means (a + b) + c = a + (b + c); the identity element e satisfies e + a = a + e = a.) Cache the combined measure at every internal node. Now the tree can answer "where does this predicate first become true?" by descending through cached summaries instead of scanning elements.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A finger tree has three cases. Empty holds nothing. Single holds one element. Deep holds a prefix digit (1-4 elements), a middle spine (a finger tree of 2-3 nodes), and a suffix digit (1-4 elements).',
        'To push an element onto the left: if the prefix has fewer than four elements, just prepend it. If the prefix already has four elements, take three of them, bundle them into a Node3, push that node into the middle spine recursively, and keep the new element plus the remaining one as the new two-element prefix. The recursive push into the spine is rare -- it happens at most once per three pushes -- so the amortized cost is O(1). Pop works symmetrically.',
        'To split at a position guided by a predicate on the measure: start at the root. The prefix, spine, and suffix each carry a cached measure. Accumulate measures left to right. If the predicate triggers within the prefix, split the prefix digit. If it triggers within the spine, recursively split the spine to find the target node, then split that node. If it triggers in the suffix, split the suffix. Rebuild the left and right trees from the pieces.',
        'Concatenation takes two trees and a list of middle elements. It dismantles the suffix of the left tree and the prefix of the right tree, groups the combined elements into 2-3 nodes, and pushes those nodes into the merged spine. The grouping into nodes is always possible because the total count is between 2 and 12, and any count in that range can be partitioned into groups of 2 and 3.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The amortized O(1) for push and pop follows from a debit argument. Each element in a full four-element digit carries one unit of debit for the future recursive push. When the digit overflows, the three bundled elements pay for the recursive call. Since each push adds at most one debit and each overflow spends exactly three, the debits never accumulate.',
        'The O(log n) for split holds because the spine is a finger tree of nodes, each node groups 2 or 3 elements, and the spine of the spine groups 2-3 nodes of 2-3 elements (so 4-9 elements per spine-of-spine element). The depth grows as O(log n). Split walks down and back up once, doing O(1) work per level.',
        'The measure stays correct through rebalancing because the monoid is associative. When you bundle three elements into a Node3, the node\'s measure is the combination of those three element measures. When you split a node back apart, the pieces recombine to the same total regardless of grouping order. This is exactly the property that associativity guarantees.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Push/pop at either end: amortized O(1). Each operation touches at most one digit and occasionally triggers a recursive push that is paid for by earlier cheap operations.',
        'Indexing (via size measure and split): O(log n). The tree descends through cached sizes, doing O(1) comparisons at each level, across O(log n) levels.',
        'Split: O(log n). Walk down the spine guided by the measure, then rebuild the two halves on the way back up.',
        'Concatenation: O(log(min(n, m))). The work is proportional to the depth of the smaller tree, because the dismantled digits from both sides get grouped into at most 4 nodes per level.',
        'Space: O(n) total. Each element appears once. Internal nodes add O(n) overhead for cached measures and pointers. Persistence is free in the sense that old versions share untouched subtrees with new versions, so an update allocates O(log n) new nodes while keeping the rest.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Haskell\'s Data.Sequence is a finger tree measured by size. It is the standard persistent sequence in the Haskell ecosystem, used whenever a program needs indexed access, efficient ends, and the ability to keep old versions.',
        'Text editors built on persistent data structures often use finger trees measured by character count. Split at the cursor position, insert new text, concatenate the halves. Old versions become undo history for free. Alternatives like ropes and piece tables solve similar problems but lack the general measure mechanism.',
        'Priority queues can be built from finger trees measured by minimum priority. The leftmost element with the smallest priority is always accessible via the cached measure at the root. This is less common in practice because specialized heap structures are simpler and faster, but it demonstrates the generality.',
        'Interval trees can use a finger tree measured by maximum endpoint. Ordered insertion plus the max-endpoint measure lets you find all intervals overlapping a query point by splitting at the query value and checking the measure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cache locality is poor. A finger tree is a web of small heap-allocated nodes connected by pointers. On workloads where a flat array or a B-tree would keep data in a few cache lines, a finger tree scatters it across memory. For tight numeric loops or sequential scans, arrays win by a large constant factor.',
        'Implementation complexity is high. The three cases (Empty, Single, Deep), the digit overflow/underflow logic, the recursive spine of nodes-of-nodes, and the measure bookkeeping add up to a structure that is difficult to implement correctly and difficult to debug. Most languages outside Haskell lack mature finger tree libraries.',
        'The monoid law is a hard requirement. If you choose a combine operation that is not associative, cached summaries will silently give wrong answers after rebalancing. There is no runtime check for associativity -- the programmer must prove it.',
        'For mutable workloads where persistence is not needed, the allocation overhead of path copying is pure waste. A mutable deque or dynamic array will be faster and simpler.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build a finger tree from the sequence [10, 20, 30, 40, 50, 60, 70, 80] with the size measure (each element has measure 1, combined by addition, identity 0). Push 10: the tree is Single(10). Push 20 onto the left: Deep(prefix=[20], middle=Empty, suffix=[10]). Push 30 onto the left: Deep(prefix=[30, 20], middle=Empty, suffix=[10]). Continue pushing 40, 50 onto the left: Deep(prefix=[50, 40, 30, 20], middle=Empty, suffix=[10]). The prefix now has four elements.',
        'Push 60 onto the left. The prefix overflows: bundle [40, 30, 20] into Node3(40, 30, 20) with cached measure 3, push that node into the middle spine, and set the new prefix to [60, 50]. The tree is now Deep(prefix=[60, 50], middle=Single(Node3(40,30,20)), suffix=[10]). The root\'s cached measure is 6 (two prefix elements + three in the spine node + one suffix element).',
        'Now split at index 4 (find the 5th element, 0-indexed). The prefix measure is 2, the spine measure is 3, the suffix measure is 1. Accumulate: prefix gives 2 (not past 4), prefix + spine gives 5 (past 4). So the target is inside the spine. Descend into the spine: the single Node3(40, 30, 20) has measure 3. Accumulated from the prefix, we need index 4 - 2 = 2 within this node. Element 0 is 40, element 1 is 30, element 2 is 20. The split point is at element 20. Left tree gets [60, 50, 40, 30], right tree gets [20, 10].',
        'Change the measure to "minimum value" with combine = Math.min and identity = Infinity. The same tree caches the minimum in each subtree. The root\'s measure becomes 10, immediately telling you the global minimum without scanning. Split where the predicate "measure <= 10" first becomes true, and you find element 10 directly. Same structure, different measure, different query.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ralf Hinze and Ross Paterson, "Finger Trees: A Simple General-purpose Data Structure," Journal of Functional Programming 16(2), 2006. PDF at https://www.cs.ox.ac.uk/ralf.hinze/publications/FingerTrees.pdf, DOI at https://dl.acm.org/doi/10.1017/S0956796805005769.',
        'For a gentler introduction to the measure mechanism: "Monoids and Finger Trees" by Heinrich Apfelmus, https://apfelmus.nfshost.com/articles/monoid-fingertree.html. For the canonical library implementation: Haskell Data.Sequence documentation at https://hackage.haskell.org/package/containers/docs/Data-Sequence.html.',
        'Study next: Implicit Treap Sequence Editor for a simpler randomized alternative, RRB Tree Persistent Vector for an array-like persistent sequence, Text Rope Data Structure and Piece Table Text Buffer for text-editing applications, Zipper Focused Tree for cursor-based traversal, and Persistent Segment Tree for another measured persistent structure.',
      ],
    },
  ],
};
