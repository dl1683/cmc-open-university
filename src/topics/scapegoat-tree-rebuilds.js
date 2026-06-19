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
      heading: 'How to read the animation',
      paragraphs: [
        'The "find scapegoat" view shows a BST after an insertion that violates the height bound. The highlighted path walks upward from the too-deep leaf, computing subtree sizes at each ancestor. Watch the matrix frame: each row tests one ancestor against the alpha-weight condition. The row marked "scapegoat" is the first ancestor whose child subtree is disproportionately large relative to the ancestor subtree. That ancestor is blamed for the bad depth.',
        'The "rebuild subtree" view shows the repair. The scapegoat subtree is flattened by inorder traversal into a sorted array, then rebuilt by choosing medians recursively. The tree before and after tells the whole story: the lopsided chain becomes a balanced subtree, and the parent pointer is redirected to the new root. No rotations happen -- the entire subtree is torn down and reconstructed.',
        'The "tradeoff case study" view compares node layouts side by side. Scapegoat nodes carry only a key and child pointers. AVL nodes add a height or balance factor. Red-black nodes add a color bit. The cost matrix shows where scapegoat trees pay for that simplicity: bursty O(k) rebuilds instead of steady O(1) rotations.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'quote', text: 'We describe a form of self-balancing search tree that, unlike AVL trees and red-black trees, requires no balance information to be stored at the nodes.', attribution: 'Igal Galperin and Ronald L. Rivest, SODA (1993)'},
        'Every self-balancing BST must answer the same question: how do you keep the tree short enough that search stays O(log n)? AVL trees store a balance factor at every node and rotate after each insert. Red-black trees store a color bit and rebalance with rotations and recoloring. Treaps store a random priority and rotate to maintain heap order. All three approaches require per-node metadata that the application never asked for.',
        'Galperin and Rivest asked: what if nodes stored nothing extra? No heights, no colors, no priorities. The tree would insert like a plain BST most of the time, and when the shape drifted too far from balanced, it would find the guilty subtree and rebuild it from scratch. The repair is expensive when it happens, but it happens rarely enough that the amortized cost stays logarithmic.',
        'The result is a structure where the node record is as lean as a plain BST -- just a key and two child pointers -- while search is still guaranteed O(log n). The tradeoff is that some insertions and deletions trigger a burst of O(k) work to flatten and rebuild a subtree of size k.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to keep a BST balanced is local repair after every mutation. AVL trees check the balance factor of each ancestor on the insertion path and rotate when one side becomes two levels deeper than the other. Red-black trees recolor and rotate to maintain five structural invariants. Both approaches guarantee O(log n) worst-case search, insert, and delete. The repair is small -- at most O(log n) rotations per operation, often just one or two.',
        'This works well, and production systems from the Linux kernel (red-black trees in the scheduler and memory maps) to database indexes (AVL-based in-memory indexes) rely on it. The approach is mature, well-understood, and has tight worst-case bounds.',
        'Teams reach for these structures by default because they provide smooth, predictable latency. Every operation costs O(log n), no operation costs more, and the constant factors are small. If the workload needs guaranteed per-operation bounds, local rotation-based trees are the standard tool.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The cost of local repair is structural overhead at every node. An AVL node stores a balance factor (or full height). A red-black node stores a color bit. A treap node stores a random priority. These fields exist solely to guide rebalancing -- the application data does not need them. In memory-constrained environments or when node records are cache-line-aligned, that extra field per node is real cost multiplied by millions of nodes.',
        'The deeper issue is implementation complexity. Red-black insertion has multiple cases (uncle red, uncle black, left-left, left-right, and mirrors). AVL deletion has cascading rotations that can propagate to the root. Getting these right is notoriously error-prone. Sedgewick observed that most textbook red-black tree implementations contain bugs, and left-leaning red-black trees were designed partly to reduce the case count.',
        'A plain BST avoids all of that: no metadata, no rotations, simple insertion. But a plain BST degrades to a linked list under sorted input, giving O(n) search. The wall is the gap between "no metadata but O(n) worst case" and "per-node metadata with O(log n) guarantees." Scapegoat trees occupy that gap: no per-node metadata, but still O(log n) search, at the cost of occasional expensive rebuilds.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insert a key exactly as in a plain BST: compare, go left or right, attach a leaf. While descending, track the depth of the new leaf. After insertion, check: is the depth greater than log_{1/alpha}(n), where n is the current tree size and alpha is a parameter between 0.5 and 1? If not, the tree is fine. No repair is needed, and the operation costs O(log n).',
        'If the new leaf is too deep, the tree must find the scapegoat. Walk back up the insertion path (using parent pointers or a stack saved during descent). At each ancestor, compute the sizes of its left and right subtrees. The scapegoat is the first ancestor where one child subtree exceeds alpha times the ancestor subtree size. By a counting argument, such an ancestor must exist on any too-deep path.',
        {type: 'code', text: 'function findScapegoat(node, size) {\n  // Walk up from the inserted node.\n  // size = size of the subtree rooted at node.\n  let childSize = size;\n  let parent = node.parent;\n  while (parent !== null) {\n    let siblingSize = subtreeSize(sibling(node, parent));\n    let parentSize = childSize + siblingSize + 1;\n    // alpha check: is the child too heavy?\n    if (childSize > ALPHA * parentSize) {\n      return parent;  // this ancestor is the scapegoat\n    }\n    childSize = parentSize;\n    node = parent;\n    parent = parent.parent;\n  }\n  return null;  // should not happen if depth > log bound\n}', language: 'javascript'},
        'Once the scapegoat is found, rebuild its entire subtree. Traverse the subtree inorder to collect nodes into a sorted array. Then recursively pick medians: the middle element becomes the root, the left half becomes the left subtree, the right half becomes the right subtree. Reattach the rebuilt subtree to the scapegoat\'s parent. The result is a perfectly balanced subtree.',
        {type: 'diagram', text: '  Before rebuild:          After rebuild:\n\n      15                      20\n       \\                    /    \\\n        20                15      25\n         \\                         \\\n          25                        30\n           \\\n            30\n\n  Inorder: [15, 20, 25, 30]\n  Median:  20 (index 1)\n  Left:    [15]        -> leaf 15\n  Right:   [25, 30]    -> 25 with right child 30', label: 'Weight-balanced subtree rebuild from sorted inorder traversal'},
        'Deletion uses lazy counting. The tree tracks two numbers: n (the current node count) and maxN (the maximum node count since the last full rebuild). Delete a node normally. If n drops below alpha * maxN, rebuild the entire tree from the root and reset maxN = n. This prevents a long sequence of deletions from leaving a tree that is technically within the height bound but has degenerate shape from accumulated holes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The height bound is the first guarantee. If the tree has n nodes and maximum height at most log_{1/alpha}(n), then every search path visits at most log_{1/alpha}(n) nodes. Since alpha is a constant between 0.5 and 1, this is O(log n). The scapegoat rebuild enforces this bound: any insertion that would violate it triggers a rebuild that shortens the offending path.',
        'The scapegoat existence proof is a pigeonhole argument. If a path has depth greater than log_{1/alpha}(n), then along that path the subtree sizes must shrink by at least a factor of alpha at each level. But the root subtree has size n and a leaf has size 1. If every ancestor were within the alpha bound, the depth could be at most log_{1/alpha}(n). Since the depth exceeds that, at least one ancestor must violate the bound -- that ancestor is the scapegoat.',
        'The amortized cost argument uses a potential function. After a rebuild, the rebuilt subtree is perfectly balanced, so it takes many insertions into that subtree before it becomes unbalanced enough to trigger another rebuild. Specifically, a subtree of size k must absorb at least Omega(k) insertions before it can become unbalanced enough to be rebuilt again. The O(k) rebuild cost is charged to those Omega(k) insertions, giving each insertion O(1) amortized rebuild cost. Combined with the O(log n) insertion path, the total amortized insertion cost is O(log n).',
        'The deletion rule works by the same accounting. If n drops below alpha * maxN, at least (1 - alpha) * maxN deletions happened since the last full rebuild. The O(n) full rebuild is charged to those Omega(n) deletions, keeping amortized deletion cost at O(log n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'table', headers: ['Property', 'Scapegoat tree', 'AVL tree', 'Red-black tree', 'Treap'], rows: [
          ['Per-node metadata', 'None', 'Balance factor or height', 'Color bit (1 bit)', 'Random priority'],
          ['Search (worst case)', 'O(log n)', 'O(log n)', 'O(log n)', 'O(n) expected O(log n)'],
          ['Insert (worst case)', 'O(n)', 'O(log n)', 'O(log n)', 'O(n) expected O(log n)'],
          ['Insert (amortized)', 'O(log n)', 'O(log n)', 'O(log n)', 'O(log n) expected'],
          ['Delete (worst case)', 'O(n)', 'O(log n)', 'O(log n)', 'O(n) expected O(log n)'],
          ['Delete (amortized)', 'O(log n)', 'O(log n)', 'O(log n)', 'O(log n) expected'],
          ['Rotations per update', '0 (rebuild instead)', '1-2 (insert), O(log n) (delete)', '1-3', '0-2 expected'],
          ['Rebalance mechanism', 'Subtree rebuild', 'Single/double rotation', 'Rotation + recolor', 'Rotation by priority'],
          ['Height bound', 'log_{1/alpha}(n)', '1.44 log n', '2 log n', 'O(log n) expected'],
        ]},
        'The defining tradeoff: scapegoat trees trade worst-case update cost for structural simplicity. A single insert can cost O(n) when it triggers a rebuild of a large subtree. But amortized over a sequence of operations, the cost per operation is O(log n). AVL and red-black trees never have that spike -- every operation is worst-case O(log n) -- but they pay with per-node metadata and rotation logic.',
        'The alpha parameter controls the tradeoff between search speed and rebuild frequency. With alpha = 0.5, the tree is always nearly perfectly balanced (height at most log2(n)), but rebuilds happen often. With alpha near 1, the tree tolerates significant skew (height up to n in the degenerate case), and rebuilds are rare. In practice, alpha between 0.55 and 0.75 balances search depth against rebuild cost. Common default: alpha = 2/3.',
        {type: 'note', text: 'The O(n) worst case is not as bad as it sounds. A rebuild of a subtree of size k takes O(k) time, but that subtree absorbed at least Omega(k) cheap insertions before the rebuild was triggered. The expensive operations are rare precisely because they require many cheap operations to set up. In practice, the latency spike matters only for real-time systems where every single operation must complete within a bound.'},
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Memory-constrained environments benefit most. If nodes are large records and every extra field per node costs real memory, eliminating the balance metadata matters. A scapegoat tree node is just a key (or key-value pair) and two child pointers. For millions of nodes, saving 4-8 bytes per node can mean megabytes of savings.',
        'Teaching and prototyping are strong use cases. The scapegoat tree is one of the simplest self-balancing BSTs to implement correctly. There are no rotation cases to enumerate, no color invariants to maintain, no priority comparisons. The rebuild is a single function: flatten inorder, then build balanced. A correct implementation fits in under 100 lines. For a data structures course, it teaches amortized analysis and weight-balanced invariants without the case-analysis overhead of red-black trees.',
        'Batch-oriented workloads where occasional pauses are acceptable also benefit. If the system can tolerate an occasional O(k) rebuild -- for example, an offline index builder or a configuration store that updates infrequently -- the scapegoat tree provides balanced search with minimal implementation and memory overhead. The rebuild can even improve cache locality: the rebuilt subtree is freshly allocated in a contiguous block, which can be friendlier to the cache than a tree that has been rotated thousands of times over scattered allocations.',
        'Persistent or functional settings work well too. Since the rebuild creates a fresh subtree rather than mutating nodes in place, it integrates naturally with copy-on-write storage. There is no need to reason about which rotations are safe to share with old versions -- the rebuild produces an entirely new structure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hard real-time systems cannot use scapegoat trees. A single insertion that triggers a rebuild of a subtree with k nodes costs O(k), and k can be as large as n. If the system has a deadline per operation -- a packet router, a game physics loop, an audio callback -- that spike is unacceptable. Red-black trees or B-trees provide O(log n) worst-case guarantees per operation.',
        'Concurrent data structures are difficult. Rebuilding a subtree requires exclusive access to every node in that subtree. During the rebuild, readers and writers targeting keys in that subtree must wait or be redirected. Lock-free or wait-free variants are not straightforward because the rebuild touches O(k) nodes atomically. Compare this with red-black trees, where a rotation touches at most 3 nodes and can be made lock-free with compare-and-swap.',
        'High-frequency update workloads where amortized bounds are not good enough also suffer. If the workload is write-heavy with uniform key distribution, the rebuild spikes happen often enough to affect tail latency. A treap provides expected O(log n) per operation with low variance and no spikes. A skip list provides similar expected bounds with simpler concurrency.',
        {type: 'bullets', items: [
          'Real-time systems: use red-black or B-tree for worst-case O(log n).',
          'Concurrent maps: use skip list or lock-free red-black tree.',
          'Write-heavy uniform workloads: use treap or randomized skip list.',
          'Disk-backed storage: use B-tree or B+ tree (scapegoat rebuilds would be I/O disasters).',
        ]},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'Igal Galperin and Ronald L. Rivest, "Scapegoat Trees," Proceedings of the 4th Annual ACM-SIAM Symposium on Discrete Algorithms (SODA), 1993. The original paper defining the structure, the alpha-weight condition, and the amortized analysis.',
          'Pat Morin, Open Data Structures, Chapter 8.1: ScapegoatTree. Clear implementation walkthrough with pseudocode and amortized cost proof. Free online at opendatastructures.org.',
          'Erik Demaine and Charles Leiserson, MIT 6.851 Advanced Data Structures, Lecture 4. Covers scapegoat trees in the context of weight-balanced and amortized data structures, with connections to BB[alpha] trees.',
        ]},
        {type: 'note', text: 'The name "scapegoat" is metaphorical: when the tree becomes too tall, the algorithm walks up the insertion path looking for someone to blame. The guilty ancestor is rebuilt, absorbing the punishment for all the small imbalances that accumulated below it. Galperin and Rivest chose the name deliberately.'},
        'Study Binary Search Tree first if the BST invariant and insertion logic are not yet familiar. Study AVL Tree Rotations and Red-Black Tree to understand the local-repair alternative that scapegoat trees avoid. Study Splay Tree for another amortized self-balancing BST that uses a different mechanism (move-to-root via rotations rather than subtree rebuild). Study Treap for a randomized alternative with expected O(log n) per operation. Study B-Trees for the disk-oriented balanced tree that solves the problem scapegoat trees solve poorly: I/O-bound workloads.',
      ],
    },
  ],
};
