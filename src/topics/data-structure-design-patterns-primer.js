// A capstone primer that links advanced data structures by recurring design
// patterns: locality, indirection, summaries, persistence, and precomputation.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'data-structure-design-patterns-primer',
  title: 'Data Structure Design Patterns Primer',
  category: 'Concepts',
  summary: 'A cross-linking primer for advanced structures: locality, indirection, summaries, persistence, approximation, and precomputation as reusable design moves.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pattern map', 'tradeoff audit'], defaultValue: 'pattern map' },
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

function* patternMap() {
  const designMoves = 5;
  const moveLinks = 4;
  const pipelineSteps = 5;
  const routeCategories = 4;
  const plotPoints = 5;

  yield {
    state: graphState({
      nodes: [
        { id: 'locality', label: 'locality', x: 0.8, y: 2.8, note: 'bytes' },
        { id: 'summary', label: 'summary', x: 2.7, y: 2.8, note: 'shrink' },
        { id: 'precompute', label: 'precompute', x: 4.8, y: 2.8, note: 'repeat' },
        { id: 'version', label: 'version', x: 6.9, y: 2.8, note: 'history' },
        { id: 'approx', label: 'approx', x: 8.8, y: 2.8, note: 'bounded error' },
      ],
      edges: [
        { id: 'e-locality-summary', from: 'locality', to: 'summary', weight: '' },
        { id: 'e-summary-precompute', from: 'summary', to: 'precompute', weight: '' },
        { id: 'e-precompute-version', from: 'precompute', to: 'version', weight: '' },
        { id: 'e-version-approx', from: 'version', to: 'approx', weight: '' },
      ],
    }, { title: 'Five reusable moves behind advanced structures' }),
    highlight: { active: ['locality', 'summary', 'precompute'], found: ['version', 'approx'] },
    explanation: `Advanced structures usually come from one of ${designMoves} reusable moves connected by ${moveLinks} links: change layout, summarize state, precompute a query shape, preserve versions, or accept bounded error.`,
  };

  yield {
    state: labelMatrix(
      'Reusable design moves',
      [
        { id: 'locality', label: 'local' },
        { id: 'summary', label: 'sum' },
        { id: 'precompute', label: 'pre' },
      ],
      [
        { id: 'question', label: 'ask' },
        { id: 'example', label: 'ex' },
      ],
      [
        ['bytes?', 'Swiss'],
        ['shrink?', 'FM'],
        ['repeat?', 'Pinot'],
      ],
    ),
    highlight: { active: ['locality:example', 'summary:example'], found: ['precompute:example'] },
    explanation: `The same move appears in many topics: SwissTable is a locality lesson, FM-index is a summary lesson, and Pinot star-tree is a precomputation lesson — ${designMoves - 2} of ${designMoves} moves shown here.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'problem', label: 'problem', x: 0.8, y: 2.8, note: 'workload' },
        { id: 'shape', label: 'shape', x: 2.5, y: 2.8, note: 'query/update' },
        { id: 'pattern', label: 'pattern', x: 4.2, y: 2.8, note: 'choose move' },
        { id: 'structure', label: 'structure', x: 6.2, y: 2.8, note: 'data layout' },
        { id: 'system', label: 'system', x: 8.2, y: 2.8, note: 'case study' },
      ],
      edges: [
        { id: 'e-problem-shape', from: 'problem', to: 'shape', weight: '' },
        { id: 'e-shape-pattern', from: 'shape', to: 'pattern', weight: '' },
        { id: 'e-pattern-structure', from: 'pattern', to: 'structure', weight: '' },
        { id: 'e-structure-system', from: 'structure', to: 'system', weight: '' },
      ],
    }, { title: 'Design starts from workload shape, not names' }),
    highlight: { active: ['shape', 'pattern'], found: ['structure', 'system'] },
    explanation: `The question is not "which famous structure do I know?" The ${pipelineSteps}-step pipeline asks: "what shape of work repeats, and what invariant would make that work cheap?"`,
    invariant: `A data structure is a workload-specific invariant with an update cost — each of the ${pipelineSteps} pipeline stages refines that invariant.`,
  };

  yield {
    state: labelMatrix(
      'Pattern to topic routes',
      [
        { id: 'layout', label: 'layout' },
        { id: 'range', label: 'range' },
        { id: 'text', label: 'text' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'starter', label: 'starter' },
        { id: 'advanced', label: 'advanced' },
      ],
      [
        ['B-tree', 'SwissTable'],
        ['segment tree', 'fractional'],
        ['suffix array', 'FM-index'],
        ['LRU', 'SIEVE/S3'],
      ],
    ),
    highlight: { found: ['layout:advanced', 'text:advanced', 'cache:advanced'] },
    explanation: `This primer is a map through the repo. Across ${routeCategories} route categories, each advanced topic is easier if you first name the pattern it amplifies from simpler material.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'query speed gained', min: 0, max: 10 }, y: { label: 'update/storage cost paid', min: 0, max: 10 } },
      series: [
        { id: 'points', label: 'design moves', points: [
          { x: 8, y: 7 }, { x: 6, y: 2 }, { x: 4, y: 4 }, { x: 9, y: 8 }, { x: 5, y: 1 },
        ] },
      ],
      markers: [
        { id: 'pinot', x: 9, y: 8, label: 'pre-agg' },
        { id: 'swiss', x: 6, y: 2, label: 'layout' },
        { id: 'filter', x: 5, y: 1, label: 'approx' },
      ],
    }),
    highlight: { active: ['points'], found: ['pinot', 'swiss', 'filter'] },
    explanation: `Every design move buys speed somewhere and pays somewhere else. The ${plotPoints} plotted points show that the engineering question is whether the workload spends more often on the path you made cheap.`,
  };
}

function* tradeoffAudit() {
  const auditQuestions = 5;
  const tradeoffNodes = 6;
  const tradeoffEdges = 6;
  const failureModes = 4;
  const frontierPoints = 5;

  yield {
    state: labelMatrix(
      'Before choosing a structure',
      [
        { id: 'ops', label: 'ops' },
        { id: 'dist', label: 'dist' },
        { id: 'bytes', label: 'bytes' },
        { id: 'error', label: 'error' },
        { id: 'change', label: 'change' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['query/update mix?', 'wrong cost'],
        ['skew/heavy tails?', 'bad average'],
        ['cache lines?', 'pointer chase'],
        ['false positives ok?', 'bad answer'],
        ['versions needed?', 'lost history'],
      ],
    ),
    highlight: { found: ['ops:ask', 'dist:ask', 'bytes:ask', 'error:ask', 'change:ask'] },
    explanation: `The practical audit starts before code. Answer ${auditQuestions} questions — operation mix, distribution, memory layout, error tolerance, and versioning needs — before choosing the structure.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'exact', label: 'exact', x: 0.9, y: 2.8, note: 'truth' },
        { id: 'approx', label: 'approx', x: 2.6, y: 2.8, note: 'cheap' },
        { id: 'static', label: 'static', x: 4.3, y: 3.5, note: 'build once' },
        { id: 'dynamic', label: 'dynamic', x: 4.3, y: 2.1, note: 'updates' },
        { id: 'local', label: 'local', x: 6.2, y: 2.8, note: 'CPU' },
        { id: 'remote', label: 'remote', x: 8.1, y: 2.8, note: 'system' },
      ],
      edges: [
        { id: 'e-exact-approx', from: 'exact', to: 'approx', weight: '' },
        { id: 'e-approx-static', from: 'approx', to: 'static', weight: '' },
        { id: 'e-approx-dynamic', from: 'approx', to: 'dynamic', weight: '' },
        { id: 'e-static-local', from: 'static', to: 'local', weight: '' },
        { id: 'e-dynamic-local', from: 'dynamic', to: 'local', weight: '' },
        { id: 'e-local-remote', from: 'local', to: 'remote', weight: '' },
      ],
    }, { title: 'Tradeoffs compound across levels' }),
    highlight: { active: ['approx', 'static', 'dynamic'], found: ['local', 'remote'] },
    explanation: `A local data-structure choice often becomes a system behavior: ${tradeoffNodes} nodes and ${tradeoffEdges} edges show how false positives affect storage IO, cache policy affects latency, and pre-aggregation affects freshness.`,
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'index', label: 'index' },
        { id: 'cache', label: 'cache' },
        { id: 'text', label: 'text' },
        { id: 'graph', label: 'graph' },
      ],
      [
        { id: 'smell', label: 'smell' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['too broad', 'predicate data'],
        ['scan poison', 'admission'],
        ['updates slow', 'piece/rope'],
        ['frontier huge', 'summaries'],
      ],
    ),
    highlight: { found: ['index:fix', 'cache:fix', 'text:fix'] },
    explanation: `Good design often starts by naming the failure mode of the simple structure. Each of the ${failureModes} failure modes shown here is fixed by adding the smallest invariant that removes it.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'implementation complexity', min: 0, max: 10 }, y: { label: 'operational risk', min: 0, max: 10 } },
      series: [
        { id: 'frontier', label: 'design frontier', points: [{ x: 1, y: 1 }, { x: 3, y: 2 }, { x: 5, y: 4 }, { x: 7, y: 7 }, { x: 9, y: 9 }] },
      ],
      markers: [
        { id: 'simple', x: 2, y: 2, label: 'simple' },
        { id: 'fancy', x: 8, y: 8, label: 'fancy' },
        { id: 'fit', x: 5, y: 3.5, label: 'fit' },
      ],
    }),
    highlight: { active: ['frontier'], found: ['fit'], compare: ['fancy'] },
    explanation: `The best structure is not the cleverest structure. The ${frontierPoints} frontier points show that it is the simplest one that makes the dominant workload cheap and leaves enough observability to know when that assumption stops holding.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pattern map') yield* patternMap();
  else if (view === 'tradeoff audit') yield* tradeoffAudit();
  else throw new InputError('Pick a data-structure design-pattern view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The pattern-map view draws five reusable design patterns as nodes in a graph: augmentation, lazy deletion, amortization, path compression, and fractional cascading. Highlighted (active) nodes mark the pattern currently being explained. Dimmer (found) nodes are patterns already linked to concrete data structures you can study elsewhere on this site.',
        'The tradeoff-audit view switches to a matrix format. Each row poses a question you should answer about your workload before selecting a pattern -- things like operation mix, skew, memory layout, error tolerance, and versioning needs. The closing scatterplot maps each pattern by the query speed it buys (x-axis) against the update or storage cost it charges (y-axis). A point near the top-right buys a lot but charges a lot; one near the bottom-left is modest but cheap.',
        'Watch the composition steps closely. Union-find sits at the intersection of path compression and union by rank. B+ trees fuse wide-node locality with separator summaries and linked leaves. Single patterns solve single bottlenecks; composed patterns solve system-level problems.',
        {type: 'image', src: './assets/gifs/data-structure-design-patterns-primer.gif', alt: 'Animated walkthrough of the data structure design patterns primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most data-structure courses are catalogs: here is an array, here is a linked list, here is a hash table. Each gets its own page, its own Big-O chart, its own set of operations. That teaches the parts, but it does not explain how engineers design new structures or bend existing ones to fit a specific workload.',
        { type: 'callout', text: 'Advanced structures are usually simple invariants plus one maintained shortcut that removes repeated work.' },
        'Behind every useful modification to a data structure is a reusable pattern -- a design move that recurs across many structures under different names. Augmentation appears in order-statistic trees and interval trees. Lazy deletion appears in binary heaps, B-trees, and LSM storage engines. Amortization appears in dynamic arrays and splay trees. Path compression appears in union-find and suffix links. Fractional cascading appears in layered range trees and computational geometry.',
        'This primer names those five patterns explicitly. The goal is recognition: once you can name the pattern, you can apply it to structures the catalog never mentioned, because the move is independent of the specific data layout.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'When a data structure does not support an operation efficiently, the obvious fix is to compute the answer from scratch each time. Need the rank of a node in a binary search tree (BST)? Walk the entire left subtree and count nodes. Need to delete an arbitrary element from a binary heap? Scan all n elements to find it, remove it, then re-heapify. Need to merge two disjoint sets? Copy every element of one set into the other.',
        'All of these are correct. For small inputs they are fast enough. The trouble arrives with scale. Counting subtree sizes on every rank query turns an O(log n) lookup into an O(n) walk. Linear-scanning a heap before every delete wastes the structure the heap already provides. Copying set members on every merge makes a sequence of n merges cost O(n^2) total instead of nearly O(n).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated work. Each naive approach recomputes something that could have been maintained incrementally as the structure changed. Counting subtree sizes recomputes the same counts on every rank query, even though the tree only changed by one insertion since the last query. Scanning a heap for a delete target ignores the parent-child ordering the heap already maintains. Copying set elements moves data that a smarter representation could leave in place.',
        'These costs compound multiplicatively. A system that makes n rank queries, each costing O(n), pays O(n^2) total. A system that makes n set merges, each copying O(n) elements, also pays O(n^2). At 10,000 elements, O(n^2) means 100 million operations; O(n log n) means about 130,000. That is the difference between a system that ships and one that times out.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every advanced data structure is a simple structure plus one maintained shortcut that eliminates the repeated work. The shortcut costs something to maintain on updates, but it makes the dominant query shape cheap. The engineering question is always: does the workload hit the cheap path often enough to justify the maintenance cost?',
        'The five patterns in this primer are five different ways to build that shortcut. Augmentation stores extra data so queries read local metadata instead of walking the structure. Lazy deletion defers expensive cleanup so deletes become instant marks. Amortization spreads a rare expensive operation over many cheap ones so the average stays low. Path compression rewires traversal paths so future walks are shorter. Fractional cascading threads pointers between sorted lists so one binary search unlocks the rest.',
        'Each pattern has a different cost profile, a different correctness argument, and a different failure mode. But the meta-pattern is always the same: identify the repeated work, then maintain just enough extra state to skip it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Augmentation adds a metadata field to each node so queries can be answered from local information instead of subtree traversals. In an order-statistic tree, each node stores the count of nodes in its subtree (including itself). To find the rank of a value, you walk from the root toward the target. At each node, if you go right, you add the left subtree\'s size plus one (for the current node) to a running total. Insertions and deletions update sizes along the affected root-to-leaf path -- O(log n) extra work per mutation -- but rank queries drop from O(n) to O(log n).',
        {
          type: 'diagram',
          label: 'Augmented BST with subtree sizes',
          text: '        [15] size=7\n       /           \\\n    [10] size=3   [20] size=3\n    /    \\        /    \\\n  [5]    [12]  [17]   [25]\n  s=1    s=1   s=1    s=1\n\nRank of 17: left subtree of 15 has size 3,\nplus 15 itself = 4, then 17 is in left subtree\nof 20, so rank = 3 + 1 + 1 = 5.',
        },
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Binary_tree_in_array.svg/500px-Binary_tree_in_array.svg.png', alt: 'Binary tree nodes mapped onto array cells with arrows to children', caption: 'Implicit layouts are a recurring pattern: store structure in positions so navigation becomes arithmetic. Source: https://en.wikipedia.org/wiki/Binary_heap.' },
        'Lazy deletion marks elements as removed without immediately restructuring. A binary heap supporting arbitrary deletes marks the target with a tombstone flag. When extract-min pops an element, it checks the flag: if the element is dead, it discards it and pops again. The heap property holds for all live elements because marking does not move anything. The tradeoff is that dead entries consume memory and slow extract-min by an amount proportional to consecutive tombstones at the top.',
        'Amortization accepts occasional expensive operations as long as the average cost over a sequence stays cheap. A dynamic array (like Python\'s list or Java\'s ArrayList) starts with capacity c. Appends cost O(1) until the array is full, at which point the array allocates a new block of size 2c, copies all n elements, and frees the old block. That copy costs O(n), but it happens only after n cheap appends. Using the banker\'s method: charge each append 2 credits -- one to pay for the append itself, one saved for the future copy. When the array doubles, the n saved credits exactly cover the n-element copy. Amortized cost per append: O(1).',
        'Path compression rewires long chains during traversal so future traversals are fast. In a union-find (disjoint-set) structure, each element has a parent pointer. find(x) follows parent pointers from x up to the root of x\'s tree. Path compression makes every node along that path point directly to the root before returning. The next find on any of those nodes costs O(1). Combined with union by rank -- always attach the shorter tree under the taller root -- a sequence of m operations on n elements costs O(m * alpha(n)), where alpha is the inverse Ackermann function. alpha(n) is at most 4 for any n up to 2^(2^(2^(2^16))), which dwarfs the number of atoms in the universe. For all practical purposes, treat it as O(1) per operation.',
        'Fractional cascading eliminates redundant binary searches across multiple sorted lists. Suppose you have k sorted lists, each of length n, and you want to find where a query value q would sit in every list. The naive approach runs k independent binary searches: O(k log n). Fractional cascading threads every other element from list i+1 into list i, along with a pointer back to the original position in list i+1. Now the augmented list 1 is roughly 1.5x longer, but a single O(log n) binary search in it yields the position in list 1, and the pointer immediately narrows the search in list 2 to a constant-size window. Each subsequent list takes O(1). Total: O(log n + k) instead of O(k log n).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each pattern has a correctness argument rooted in invariant preservation -- the pattern introduces a shortcut, and correctness depends on that shortcut staying consistent with the underlying data.',
        'Augmentation is correct because the metadata is updated on every structural change. If every insertion, deletion, and tree rotation maintains subtree sizes along the affected path, then the size stored at any node always equals the number of its descendants plus one. Rank queries read correct sizes because no mutation leaves a stale count. The key requirement is that the augmented field must be computable from the node\'s own data and its children\'s augmented fields -- this is called decomposability. Subtree size satisfies it: size(node) = size(left) + size(right) + 1.',
        'Lazy deletion is correct because marking an element dead does not violate the structural invariant for live elements. A min-heap with tombstones still satisfies the heap property among live nodes: every live parent is smaller than its live children (dead nodes are simply invisible). The correctness risk is at extraction: extract-min must loop, discarding dead entries, until it finds a live minimum. The loop terminates because the heap is finite.',
        'Amortization is correct because the expensive operation cannot happen frequently enough to dominate total cost. A potential function formalizes this. Define potential Phi as the number of elements stored since the last resize. Each cheap append raises Phi by 1. A resize drops Phi from n to 0 while doing O(n) real work. The amortized cost of an operation is its real cost plus the change in potential. Cheap appends: 1 + 1 = 2. Resize: n + (0 - n) = 0. Total amortized cost over n appends: O(n). The potential is always non-negative, so amortized cost is an upper bound on real cost.',
        'Path compression is correct because flattening a tree does not change set membership -- it only changes internal shape. The root remains the same representative, so find still returns the correct answer. Union by rank keeps trees shallow (height at most log n without compression), and compression makes them shallower still. Tarjan\'s 1975 proof uses a potential function based on ranks and depths to show the O(m * alpha(n)) bound for m operations.',
        'Fractional cascading is correct because the threaded pointers preserve relative sorted order between lists. When an element from list i+1 is promoted into list i, its pointer back to list i+1 lands within one position of where the query value actually belongs in list i+1. So after the initial binary search, each subsequent list needs at most a constant number of comparisons to locate the query value exactly.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Augmentation adds O(log n) extra work per update (one field update per ancestor on the root-to-leaf path) and O(n) extra space (one field per node). When input size doubles, the per-update cost grows by roughly one step (log doubles from 13 to 14 around n = 8,192 to 16,384). Space doubles linearly. The payoff is that queries like rank, select, or interval-overlap drop from O(n) to O(log n).',
        'Lazy deletion makes the delete operation itself O(1) -- just flip a flag. The cost moves to extract-min, which must skip tombstones. In the worst case, if you delete n/2 elements without any extractions, the heap holds n/2 dead entries, and the next extract-min might pop and discard all of them before finding a live element. Periodic rebuilds (compact the heap by filtering out tombstones and re-heapifying in O(n)) keep the tombstone ratio bounded. Space overhead is at most O(n) extra dead entries.',
        'Amortization gives O(1) amortized cost per append in a dynamic array, but the worst-case cost of a single append is O(n) when a resize triggers. After a resize to capacity 2n, the array wastes up to n empty slots, so space overhead is at most 2x. When input doubles, one additional resize event occurs. The amortized cost per operation does not change -- it stays O(1) -- because each resize is "paid for" by the preceding cheap appends.',
        'Path compression yields O(alpha(n)) amortized per find, where alpha(n) <= 4 for any n that could ever appear in practice. Space is O(n) for the parent-pointer array. When input doubles, alpha stays effectively constant. But "amortized" matters: a single find on a deep, uncompressed chain can cost O(log n). The guarantee is over sequences, not individual operations.',
        'Fractional cascading costs O(log n + k) for a query across k sorted lists, each of length n. The augmented storage is O(n * k) because each list roughly doubles (half its elements are promoted copies from the next list). The first binary search costs O(log n); each subsequent list costs O(1). When n doubles, the first search grows by one step; the per-list O(1) cost is unchanged.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Augmentation powers rank/select in databases and text editors. PostgreSQL\'s B-tree indexes can be augmented with aggregate metadata for fast COUNT queries over ranges. Interval trees augment BST nodes with the maximum right endpoint in each subtree, enabling O(log n + k) overlap queries for scheduling systems and computational geometry. Java\'s TreeMap, backed by a red-black tree, supports headMap().size() in O(log n) when augmented with subtree counts.',
        'Lazy deletion is standard in priority-queue-based algorithms. Dijkstra\'s shortest-path algorithm pushes updated distances into the heap without removing stale entries; stale entries are simply discarded when they surface at the top. Kafka uses tombstone records in compacted logs to signal key deletion -- the tombstone propagates through log segments, and physical removal happens during compaction. LSM-tree storage engines (LevelDB, RocksDB, Cassandra) use tombstones across sorted levels, deferring physical deletion to background compaction jobs.',
        'Amortization is everywhere resizable collections exist. Python\'s list, Java\'s ArrayList, Go\'s slice, and Rust\'s Vec all use geometric growth (typically 1.5x or 2x) with amortized O(1) append. Splay trees use amortization via rotations: accessing a node rotates it to the root, and while individual accesses can cost O(n), any sequence of m accesses costs O(m log n) amortized. This makes splay trees self-optimizing for skewed workloads without storing any balance metadata.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Bplustree.png/500px-Bplustree.png', alt: 'B plus tree with internal routing keys and linked leaves', caption: 'B+ trees combine several patterns at once: wide-node locality, separator summaries, and linked leaves for range scans. Source: https://en.wikipedia.org/wiki/B%2B_tree.' },
        'Path compression is the backbone of connectivity algorithms. Kruskal\'s minimum spanning tree algorithm uses union-find to test whether adding an edge creates a cycle: find the roots of both endpoints, and if they match, skip the edge. Connected-component labeling in image processing merges adjacent pixels with the same label. Compiler type systems use union-find to track equivalence classes during type unification. In all these cases, the nearly-constant per-operation cost makes union-find practical for millions of elements.',
        'Fractional cascading appears in computational geometry (layered range trees for orthogonal range queries) and in any system where the same query value must be located in multiple sorted indexes simultaneously. Multi-level indexing in databases and geographic information systems uses the same idea: resolve the query once in the top-level index, then follow pointers down through subordinate indexes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Augmentation fails when the extra field is not decomposable -- meaning you cannot compute it from a node\'s children alone. Subtree size works: size(node) = size(left) + size(right) + 1. Median does not: you cannot compute the median of a subtree from the medians of its children. Augmentation also fails when the tree is unbalanced: in a degenerate chain of n nodes, every insertion updates O(n) ancestors, so the maintenance cost overwhelms the query savings. Use a balanced tree (AVL, red-black) to keep augmentation cost at O(log n).',
        'Lazy deletion fails when tombstones accumulate faster than they are cleaned. A heap where most operations are deletes and few are extract-mins fills with dead entries, degrading memory and extraction performance. Any system using tombstones needs a compaction policy (rebuild when tombstone ratio exceeds a threshold) and monitoring to detect tombstone bloat. Without that policy, lazy deletion becomes a slow memory leak.',
        'Amortization fails when worst-case latency matters. A single O(n) resize in a dynamic array can blow a real-time audio buffer\'s deadline. Amortized bounds do not always compose safely -- nesting two amortized structures can cause their expensive operations to coincide, producing a spike larger than either bound predicts. In concurrent settings, a resize blocks all threads, turning a local amortized cost into a system-wide pause. Deamortization techniques (copying a constant fraction of elements per append instead of all at once) exist but add implementation complexity.',
        'Path compression fails when you need undo. Compression mutates parent pointers, so rolling back a union requires either snapshotting the entire parent array or using weighted union without compression (which gives O(log n) per find instead of O(alpha(n))). Path compression also destroys the ability to enumerate elements in a specific set: after compression, the tree is a flat star, and there is no child-pointer structure to traverse. You need an auxiliary linked list per set if enumeration matters.',
        'Fractional cascading fails when the sorted lists change frequently. Every insertion or deletion into any list requires rebuilding the promoted pointers, which costs O(k) in the worst case. For fully dynamic lists, other approaches (like range trees with fractional cascading only on the static dimension) are more appropriate. Fractional cascading also doubles the storage of each list, which matters when memory is tight.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Walk through each pattern on a concrete instance to see the cost savings.',
        'Augmentation: start with a balanced BST holding the values [5, 10, 12, 15, 17, 20, 25] rooted at 15. Each node stores its subtree size: root has size 7, its children have size 3 each, and leaves have size 1. Query: what is the rank of 17 (its 1-based position in sorted order)? Start at root 15. Going right to 20 means all of 15\'s left subtree (size 3) plus 15 itself are smaller, so running count = 3 + 1 = 4. At node 20, going left to 17, so we do not add anything yet. At node 17, we arrive: count += left subtree size of 17 (which is 0) + 1 = 5. Rank of 17 is 5. Cost: 3 node visits. Without augmentation, you would do an in-order traversal counting nodes until you hit 17 -- visiting all 7 nodes in the worst case.',
        'Lazy deletion: you have a min-heap [3, 5, 8, 10, 12] and want to delete 8. Without lazy deletion, you scan the array to find 8 at index 2, swap it with the last element, remove it, and bubble down -- O(n) scan plus O(log n) repair. With lazy deletion, you mark 8 as dead in O(1) using a hash set of dead elements. The heap array is unchanged. Later, when extract-min pops 3, it returns 3 (live). Next extract-min pops 5, returns 5 (live). Next extract-min pops 8, sees it is dead, discards it, and pops 10 instead. The tombstone is cleared automatically during extraction.',
        'Amortization: a dynamic array starts with capacity 4. Append elements 1, 2, 3, 4 -- four O(1) appends. Append element 5: the array is full, so allocate capacity 8, copy [1, 2, 3, 4] (cost 4), then place 5 (cost 1). Total cost for 5 appends: 4 * 1 + (4 + 1) = 9. Amortized cost per append: 9/5 = 1.8. Continue appending 6, 7, 8 -- three more O(1) appends. Total after 8 appends: 9 + 3 = 12. Amortized cost: 12/8 = 1.5. As n grows, the amortized cost converges toward 2 (for growth factor 2) but never exceeds 3.',
        'Path compression: start with 8 elements {0..7} each in its own set. Union(0,1), union(2,3), union(4,5), union(6,7) -- four unions, creating four pairs. Union(0,2) merges the {0,1} and {2,3} trees; union(4,6) merges {4,5} and {6,7}. Now two trees of size 4 remain. Union(0,4) merges everything into one tree of size 8. Without compression, find(7) might walk 3 hops: 7->6->4->0. With path compression on that find, nodes 7, 6, and 4 all get their parent set directly to root 0. The next find(7) costs 1 hop, find(6) costs 1 hop, and find(4) costs 1 hop. Seven operations total, and every future find is nearly free.',
        'Fractional cascading: three sorted lists of length 4. L1 = [2, 5, 8, 11], L2 = [3, 6, 9, 12], L3 = [1, 4, 7, 10]. Query q = 6. Naive approach: binary search each list independently. 3 * ceil(log2(4)) = 3 * 2 = 6 comparisons. With fractional cascading, promote every other element of L3 into L2, and every other element of the augmented L2 into L1. Binary search the augmented L1 for q = 6: O(log n) = ~3 comparisons. The result includes a pointer to the position in augmented L2, which narrows the search to 2 adjacent elements: O(1). That result points into L3, again O(1). Total: ~3 + 1 + 1 = 5 comparisons. The savings grow with k: for k = 10 lists, naive costs 10 * log(n) while cascading costs log(n) + 10.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'Cormen, Leiserson, Rivest, Stein. Introduction to Algorithms (CLRS), chapters 13-14 (augmenting data structures), chapter 17 (amortized analysis), chapter 21 (disjoint-set forests). Chazelle and Guibas, "Fractional Cascading: I. A Data Structuring Technique" (1986). Tarjan, "Efficiency of a Good but Not Linear Set Union Algorithm" (1975). Tarjan, "Amortized Computational Complexity" (1985).',
        },
        'Prerequisites: Binary Search Trees, Heaps, and Big-O Growth. These give you the structural vocabulary that the patterns modify. If you do not know what a heap property is or how tree rotations work, start there.',
        'Direct extensions: study Order-Statistic Trees for augmentation in practice (rank and select via subtree sizes), Union-Find for path compression composed with union by rank, Splay Trees for amortization via rotations without stored balance data, and Segment Trees for augmentation applied to arbitrary range queries. Each of these is a single pattern made concrete.',
        'For production applications: study Dijkstra\'s algorithm for lazy deletion in the priority queue, Dynamic Arrays for amortization via geometric growth, and LSM-Tree storage engines for lazy deletion via tombstones across sorted run levels. These case studies show the patterns carrying real system weight at scale, not just passing asymptotic benchmarks.',
      ],
    },
  ],
};
