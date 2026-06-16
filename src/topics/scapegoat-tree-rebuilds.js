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
  yield {
    state: badTree(),
    highlight: { active: ['n30'], visited: ['n10', 'n15', 'n20', 'n25'] },
    explanation: 'A scapegoat tree inserts like a normal Binary Search Tree. If the new node lands too deep for the allowed alpha-height bound, the tree walks back up the insertion path looking for an overweight ancestor.',
    invariant: 'Search stays O(log n) because any too-deep insert triggers rebuilding before the height can drift too far.',
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
    explanation: 'The scapegoat is an ancestor whose child subtree is too large relative to the ancestor subtree. Rebuilding there is enough to repair the excessive depth created by the insert.',
  };

  yield {
    state: badTree('Node 15 is blamed for the imbalance'),
    highlight: { found: ['n15'], active: ['n20', 'n25', 'n30'], compare: ['n10', 'n5'] },
    explanation: 'Unlike AVL Tree Rotations or Red-Black Tree recoloring, the repair is not a small local rotation. The whole subtree rooted at the scapegoat is flattened and rebuilt.',
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
    explanation: 'Alpha is the tuning knob. It controls how much imbalance is tolerated before the structure pays for a rebuild.',
  };
}

function* rebuildSubtree() {
  yield {
    state: badTree('Flatten the scapegoat subtree by inorder traversal'),
    highlight: { active: ['n15', 'n20', 'n25', 'n30'], compare: ['n10'] },
    explanation: 'The rebuild starts with an inorder traversal of the scapegoat subtree. Because it is still a valid BST, inorder traversal produces sorted nodes: 15, 20, 25, 30.',
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
    explanation: 'Rebuilding is simple and deterministic: gather nodes into an array, choose the median as root, and recursively build balanced left and right halves.',
  };

  yield {
    state: rebuiltTree(),
    highlight: { found: ['n20'], active: ['n15', 'n25', 'n30'], compare: ['n10'] },
    explanation: 'The rebuilt subtree is shorter and balanced. The parent pointer from 10 now points to 20 instead of 15, while the rest of the tree remains untouched.',
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
    explanation: 'A single update can trigger a linear rebuild of a subtree, but the amortized cost is logarithmic because enough imbalance had to accumulate before the rebuild became necessary.',
  };
}

function* tradeoffCaseStudy() {
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
    explanation: 'The complete case study is a memory-sensitive ordered map. Scapegoat nodes do not need color, height, priority, or weight fields, but updates sometimes pay a bursty rebuild cost.',
  };

  yield {
    state: rebuiltTree('Rebuilds can be cache-friendly in batches'),
    highlight: { active: ['n20', 'n15', 'n25', 'n30'], found: ['n10'] },
    explanation: 'Rebuilding can copy or relink a subtree in sorted order. That burst is expensive, but it can also improve locality compared with years of tiny rotations that leave allocation history scattered.',
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
    explanation: 'The tradeoff is blunt: excellent conceptual simplicity and no per-node balance metadata, in exchange for occasional O(k) rebuild pauses.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'A scapegoat tree is a self-balancing binary search tree that keeps node records simple. Nodes store the ordinary key and child pointers; they do not need AVL heights, red-black colors, random priorities, or explicit balance fields. Balance is maintained by occasionally rebuilding an entire subtree.',
        'The name comes from the repair step. After an insertion makes the new node too deep, the algorithm walks back up the insertion path and finds an ancestor whose subtree is too unbalanced under an alpha weight-balance rule. That ancestor is the scapegoat. Rebuilding its subtree restores enough height balance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion begins exactly like ordinary Binary Search Tree insertion. Track the depth of the new leaf. If that depth is within the allowed logarithmic height bound, stop. If it is too deep, climb toward the root and compute subtree sizes until finding an ancestor where one child is larger than alpha times the ancestor subtree size.',
        'Repair is intentionally heavy-handed. Traverse the scapegoat subtree in sorted order, store the nodes in an array, then recursively choose medians to rebuild a balanced subtree. Deletion is often handled with a global size counter: if the current node count falls too far below the historical maximum, rebuild the whole tree.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search is worst-case O(log n) because the tree height is kept logarithmic. Insert and delete can cost O(n) in the worst case when they trigger a large rebuild, but their amortized cost is O(log n). The proof idea is that a subtree is rebuilt only after enough imbalance has accumulated to pay for the rebuild.',
        'The alpha parameter must be between 0.5 and 1. A value near 0.5 enforces stricter balance and more frequent rebuilds. A value nearer 1 tolerates more skew, reducing rebuild frequency but increasing search-path length. This makes scapegoat trees unusually explicit about the latency tradeoff.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A complete case study is an ordered map where node memory overhead matters and updates do not require hard real-time latency. Red-Black Tree stores color metadata and repairs with local rotations. AVL Tree Rotations store or derive height balance. Treap stores random priorities. Scapegoat Tree stores none of that per node and pays with occasional subtree rebuilds.',
        'This can be attractive in teaching, embedded code, or specialized indexes where a clean node layout matters more than worst-case update latency. It is less attractive for latency-critical services where a single O(k) rebuild pause is unacceptable. In that setting, Red-Black Tree, AVL, Treap, B-Tree, or Skip List may be easier to budget operationally.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common misconception is that scapegoat trees are unbalanced most of the time. They are not perfectly weight-balanced at every node, but they maintain a logarithmic height bound. Another mistake is saying they use rotations. The defining repair is partial rebuilding, not a small local rotation sequence.',
        'Implementation pitfalls cluster around size computation and parent paths. Finding the scapegoat needs subtree sizes, but storing sizes in every node weakens the "no metadata" story. Recomputing sizes during the upward walk is simpler but costs more. Production code must choose that tradeoff deliberately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Galperin and Rivest, "Scapegoat Trees", PDF at https://people.csail.mit.edu/rivest/pubs/GR93.pdf and ACM-SIAM proceedings page at https://dl.acm.org/doi/10.5555/313559.313676. Clear implementation reference: Open Data Structures, Scapegoat Trees at https://opendatastructures.org/newhtml/ods/latex/scapegoat.html. Study Binary Search Tree, AVL Tree Rotations, Red-Black Tree, Treap, Splay Tree, B-Trees, and Data Structure Design Patterns Primer next.',
      ],
    },
  ],
};
