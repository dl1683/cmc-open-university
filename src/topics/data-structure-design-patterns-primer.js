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
    explanation: 'Advanced structures usually come from a reusable move: change layout, summarize state, precompute a query shape, preserve versions, or accept bounded error.',
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
    explanation: 'The same move appears in many topics: SwissTable is a locality lesson, FM-index is a summary lesson, and Pinot star-tree is a precomputation lesson.',
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
    explanation: 'The question is not "which famous structure do I know?" It is "what shape of work repeats, and what invariant would make that work cheap?"',
    invariant: 'A data structure is a workload-specific invariant with an update cost.',
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
    explanation: 'This primer is a map through the repo. Each advanced topic is easier if you first name the pattern it amplifies from simpler material.',
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
    explanation: 'Every design move buys speed somewhere and pays somewhere else. The engineering question is whether the workload spends more often on the path you made cheap.',
  };
}

function* tradeoffAudit() {
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
    explanation: 'The practical audit starts before code. Name operation mix, distribution, memory layout, error tolerance, and versioning needs before choosing the structure.',
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
    explanation: 'A local data-structure choice often becomes a system behavior: false positives affect storage IO, cache policy affects latency, and pre-aggregation affects freshness.',
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
    explanation: 'Good design often starts by naming the failure mode of the simple structure, then adding the smallest invariant that removes it.',
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
    explanation: 'The best structure is not the cleverest structure. It is the simplest one that makes the dominant workload cheap and leaves enough observability to know when that assumption stops holding.',
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
        'The pattern-map view draws five reusable design moves -- augmentation, lazy deletion, amortization, path compression, fractional cascading -- as nodes in a graph. Active nodes (highlighted) are the pattern currently under discussion. Found nodes are patterns already connected to concrete structures.',
        'The tradeoff-audit view is a matrix. Each row is a question you should answer about your workload before choosing a pattern. The plot at the end maps patterns by the speed they buy against the cost they charge. A pattern near the top-right corner buys a lot but charges a lot; one near the bottom-left is cheap but modest.',
        'Watch how patterns compose: union-find appears at the intersection of path compression and union by rank. That composition is the real lesson. Single patterns solve single problems; composed patterns solve systems problems.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Data structures are usually taught as a catalog: arrays, linked lists, trees, hash tables. Each one gets its own page, its own Big-O table, its own set of operations. That works for learning the parts, but it does not explain how experienced engineers design new structures or modify existing ones to fit a workload.',
        { type: 'callout', text: 'Advanced structures are usually simple invariants plus one maintained shortcut that removes repeated work.' },
        'Behind every useful modification to a data structure is a reusable pattern -- a move that appears in many contexts under different names. Augmentation shows up in order-statistic trees and interval trees. Lazy deletion shows up in heaps and B-trees. Amortization shows up in dynamic arrays and splay trees. Path compression shows up in union-find and suffix links. Fractional cascading shows up in multi-level search structures and computational geometry.',
        'This primer names those patterns explicitly so you can recognize them when they appear and apply them when you need them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'When a data structure does not support an operation efficiently, the obvious fix is to compute the answer from scratch each time. Need the rank of a node in a BST? Walk the left subtree and count. Need to delete from a heap? Find the element by linear scan, remove it, and rebuild. Need to merge two disjoint sets? Copy one set into the other.',
        'This works. It is correct. For small inputs, it is fast enough. The approach fails only when scale arrives: counting subtree sizes on every query turns O(log n) lookups into O(n) walks; rebuilding heaps after every delete wastes work that could have been saved; copying sets on every merge makes a sequence of n merges cost O(n^2) instead of nearly O(n).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated work. Each of the naive approaches above recomputes something that could have been maintained incrementally. Counting subtree sizes recomputes the same subtree sizes on every rank query. Scanning a heap for the delete target ignores the heap structure. Copying set elements moves data that a smarter representation could leave in place.',
        'The deeper wall is that these costs compound. A system that makes n queries, each costing O(n), pays O(n^2). A system that makes n merges, each copying O(n) elements, also pays O(n^2). At scale, the difference between O(n^2) and O(n log n) or O(n alpha(n)) is the difference between a system that works and one that does not.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each pattern solves repeated work in a different way. Here are the five patterns and how they operate.',
        {
          type: 'table',
          headers: ['Pattern', 'Core move', 'Classic example', 'What it buys'],
          rows: [
            ['Augmentation', 'Store extra data at each node', 'Order-statistic tree (subtree sizes in BST)', 'O(log n) rank/select without traversal'],
            ['Lazy deletion', 'Mark deleted, clean up later', 'Binary heap with tombstones', 'O(log n) delete without search'],
            ['Amortization', 'Spread rare expensive ops over many cheap ones', 'Dynamic array doubling', 'O(1) amortized append despite O(n) copies'],
            ['Path compression', 'Shortcut long chains during traversal', 'Union-find: point nodes directly at root', 'Nearly O(1) find after compression'],
            ['Fractional cascading', 'Thread pointers between sorted lists', 'Multi-level binary search', 'O(log n + k) search across k sorted lists'],
          ],
        },
        'Augmentation adds metadata to nodes so queries can be answered from local information instead of subtree walks. In an order-statistic tree, each node stores the size of its subtree. To find the rank of a node, walk from root to target, accumulating sizes of left subtrees and the node itself. Insertions and deletions update sizes along the path -- O(log n) extra work per mutation, but rank queries drop from O(n) to O(log n).',
        {
          type: 'diagram',
          label: 'Augmented BST with subtree sizes',
          text: '        [15] size=7\n       /           \\\n    [10] size=3   [20] size=3\n    /    \\        /    \\\n  [5]    [12]  [17]   [25]\n  s=1    s=1   s=1    s=1\n\nRank of 17: left subtree of 15 has size 3,\nplus 15 itself = 4, then 17 is in left subtree\nof 20, so rank = 3 + 1 + 1 = 5.',
        },
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Binary_tree_in_array.svg/500px-Binary_tree_in_array.svg.png', alt: 'Binary tree nodes mapped onto array cells with arrows to children', caption: 'Implicit layouts are a recurring pattern: store structure in positions so navigation becomes arithmetic. Source: https://en.wikipedia.org/wiki/Binary_heap.' },
        'Lazy deletion marks elements as removed without immediately restructuring. A binary heap supporting arbitrary deletes can mark the target and ignore it when it surfaces at the top during extract-min. The heap property is maintained for all live elements; dead ones are garbage-collected on contact. The tradeoff is that the heap may hold dead weight, wasting memory and slightly slowing extract-min until tombstones are purged.',
        'Amortization accepts occasional expensive operations as long as the average over a sequence stays cheap. A dynamic array doubles its capacity when full. The doubling costs O(n), but it happens only after n cheap O(1) appends. Spread over the sequence, each append costs O(1) amortized. The banker method assigns two credits per append -- one to pay for the append itself, one saved for the future copy. When the array doubles, the saved credits pay the bill.',
        'Path compression flattens long chains so future traversals are fast. In union-find, find(x) walks from x to the root of its tree. Path compression makes every node along that path point directly to the root. The next find on any of those nodes is O(1). Combined with union by rank (always attach the shorter tree under the taller one), a sequence of n operations on n elements costs O(n * alpha(n)), where alpha is the inverse Ackermann function -- effectively constant for any practical input size.',
        'Fractional cascading eliminates redundant binary searches across multiple sorted lists. Given k sorted lists and a query value, naive binary search costs O(k log n). Fractional cascading threads every other element from list i+1 into list i, with pointers back to the original position. The first list still requires O(log n) binary search, but each subsequent list follows a pointer and does O(1) work. Total cost drops to O(log n + k).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each pattern has a correctness argument rooted in invariant preservation.',
        'Augmentation works because the stored metadata is updated on every structural change. If every insertion, deletion, and rotation maintains subtree sizes along the affected path, then the size at any node always equals the number of descendants plus one. The rank query reads correct sizes because no mutation leaves a stale count.',
        'Lazy deletion works because marking an element dead does not violate the structural invariant for live elements. A heap with tombstones still satisfies the heap property among live nodes. The correctness risk is that extract-min must skip dead elements at the top, so the implementation must loop until it finds a live minimum.',
        'Amortization works because the expensive operation cannot happen often enough to dominate the total cost. The potential function (or credit argument) proves this: each cheap operation raises potential by a bounded amount, and each expensive operation drops potential by at least as much as it costs. The total cost is bounded by the sum of amortized costs plus the net potential change, which is non-negative.',
        'Path compression works because flattening a tree does not change which elements belong to which set -- it only changes the internal shape. The root stays the same, so find still returns the correct representative. Union by rank ensures trees stay shallow, and compression makes them shallower still. Tarjan proved the combined bound of O(n * alpha(n)) using a potential function based on rank and depth.',
        'Fractional cascading works because the threaded pointers preserve the relative order between lists. Each pointer from list i to list i+1 lands within one position of the correct answer, so a constant number of comparisons suffice to locate the query value in the next list.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Pattern', 'Time cost', 'Space cost', 'When input doubles'],
          rows: [
            ['Augmentation', 'O(log n) extra per update to maintain metadata', 'O(n) -- one extra field per node', 'Update cost grows by ~1 step; space doubles'],
            ['Lazy deletion', 'O(1) delete (mark), amortized O(log n) cleanup', 'Up to O(n) tombstones in worst case', 'Tombstone overhead can double; periodic rebuild keeps it bounded'],
            ['Amortization', 'O(1) amortized per operation', 'O(n) after doubling (up to 2x waste)', 'One extra doubling event; amortized cost unchanged'],
            ['Path compression', 'O(alpha(n)) amortized per find', 'O(n) for parent pointers', 'alpha(n) stays effectively constant; space doubles'],
            ['Fractional cascading', 'O(log n + k) for search across k lists', 'O(n * k) augmented storage', 'First search grows by ~1 step; per-list cost unchanged'],
          ],
        },
        'Amortization deserves extra attention because the amortized cost is not the worst-case cost of any single operation. A dynamic array append is usually O(1), but occasionally O(n). If your system cannot tolerate occasional latency spikes -- real-time audio, hard-deadline robotics -- amortized O(1) is not the same as worst-case O(1). Deamortization techniques exist (incremental doubling, rebuilding a fraction per operation) but add implementation complexity.',
        'Path compression has an amortized cost of O(alpha(n)) per operation, where alpha(n) <= 4 for any n that fits in the observable universe. For practical purposes, treat it as O(1). But the amortized qualifier matters: a single find can still cost O(log n) if the tree is deep and uncompressed. The guarantee is over sequences of operations, not individual ones.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Augmentation wins whenever you need to answer aggregate queries about subtrees or subranges without scanning. Order-statistic trees power rank/select in databases and text editors. Interval trees augment BSTs with maximum endpoints to find all overlapping intervals in O(log n + k). Red-black trees augmented with subtree sizes power Java TreeMap operations like headMap().size().',
        'Lazy deletion wins in priority queues that must support cancellation. Dijkstra implementations often push updated distances without removing stale entries; the heap skips stale entries when they surface. Kafka consumer groups use tombstone-based deletion in compacted logs. LSM-tree storage engines use tombstones across levels, deferring physical deletion to compaction.',
        'Amortization wins in any dynamic collection that grows unpredictably. Every resizable array in every major language runtime (Python list, Java ArrayList, Go slice, Rust Vec) uses geometric growth with amortized O(1) append. Splay trees use amortization to achieve O(log n) amortized access without storing balance metadata, which simplifies the implementation at the cost of unpredictable individual operations.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Bplustree.png/500px-Bplustree.png', alt: 'B plus tree with internal routing keys and linked leaves', caption: 'B+ trees combine several patterns at once: wide-node locality, separator summaries, and linked leaves for range scans. Source: https://en.wikipedia.org/wiki/B%2B_tree.' },
        'Path compression wins in connectivity and equivalence problems. Union-find with path compression and union by rank is the backbone of Kruskal minimum spanning tree, connected components in image processing, equivalence class tracking in compilers, and online graph connectivity. The nearly-constant per-operation cost makes it practical for millions of elements.',
        'Fractional cascading wins in computational geometry (layered range trees, multi-level search) and any setting where the same query must be resolved against multiple sorted indexes simultaneously.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Augmentation fails when the metadata is expensive to maintain. If every insertion requires updating O(n) ancestor nodes (as in a degenerate tree), the augmentation cost overwhelms the query savings. Augmentation also assumes the extra field is cheap to compute from children. If the aggregate function is not decomposable (cannot be computed from left-child and right-child aggregates), augmentation does not apply directly.',
        'Lazy deletion fails when tombstones accumulate faster than they are cleaned. A heap where most operations are deletes and few are extract-mins will fill with dead entries, degrading both memory and extract-min performance. Systems using tombstones need a compaction or rebuild policy, and that policy needs monitoring.',
        'Amortization fails when worst-case guarantees matter. A single O(n) resize in a dynamic array can blow a latency budget. Amortized bounds also do not compose safely with other amortized bounds in all cases -- the accounting can interfere. In concurrent settings, a resize can block all threads, turning an amortized cost into a system-wide pause.',
        'Path compression fails when you need a persistent (undoable) union-find. Compression mutates the tree structure, so rolling back requires either copying the whole structure or using a weighted union without compression (which gives O(log n) instead of O(alpha(n))). Path compression also makes it impossible to enumerate elements in a specific set without auxiliary data structures.',
        'Fractional cascading fails when the sorted lists change frequently. The threaded pointers must be rebuilt on insertions and deletions, which costs O(k) per update in the worst case. For dynamic lists, other structures (e.g., range trees with fractional cascading only on the static dimension) are more appropriate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'Cormen, Leiserson, Rivest, Stein. Introduction to Algorithms (CLRS), chapters 13-14 (augmenting data structures), chapter 17 (amortized analysis), chapter 21 (disjoint-set forests). Chazelle and Guibas, "Fractional Cascading" (1986). Tarjan, "Efficiency of a Good but Not Linear Set Union Algorithm" (1975).',
        },
        'Prerequisites: Binary Search Trees, Heaps, and Big-O Growth. These provide the structural vocabulary that the patterns modify.',
        'Direct extensions: study Order-Statistic Trees for augmentation in practice, Union-Find for path compression and union by rank composed, Splay Trees for amortization via rotations, and Segment Trees for augmentation applied to range queries.',
        'For production applications: study Dijkstra (lazy deletion in the priority queue), Dynamic Arrays (amortization via geometric growth), and LSM-Tree storage engines (lazy deletion via tombstones across sorted levels). Each case study shows a pattern carrying real system weight, not just passing an asymptotic benchmark.',
      ],
    },
  ],
};
