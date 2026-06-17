// Fibonacci heap: defer consolidation so meld and decrease-key are cheap
// amortized operations.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fibonacci-heap',
  title: 'Fibonacci Heap',
  category: 'Data Structures',
  summary: 'A meldable priority queue that keeps a lazy root list, cuts decreased keys, and pays for cleanup during extract-min.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lazy root list', 'decrease-key cascade'], defaultValue: 'lazy root list' },
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

function heapGraph(title, variant = 'root-list') {
  const marked = variant === 'marked';
  const cut = variant === 'cut';
  const consolidated = variant === 'consolidated';
  const nodes = [
    { id: 'min', label: cut ? '2' : '3', x: 1.0, y: 2.0, note: cut ? 'new min' : 'min root' },
    { id: 'r7', label: '7', x: consolidated ? 4.0 : 3.0, y: 2.0, note: 'root' },
    { id: 'r18', label: '18', x: consolidated ? 6.5 : 5.0, y: 2.0, note: marked ? 'marked' : 'root' },
    { id: 'r24', label: '24', x: 7.0, y: 2.0, note: consolidated ? 'child' : 'root' },
    { id: 'c26', label: '26', x: 5.8, y: 4.1, note: marked ? 'marked' : 'child' },
    { id: 'c35', label: cut ? '2' : '35', x: cut ? 1.0 : 5.0, y: cut ? 2.0 : 6.0, note: cut ? 'cut to root list' : 'child' },
    { id: 'c41', label: '41', x: 6.6, y: 6.0, note: 'child' },
  ];
  const edges = [
    { id: 'e-min-r7', from: 'min', to: 'r7', weight: 'root list' },
    { id: 'e-r7-r18', from: 'r7', to: 'r18', weight: 'root list' },
    { id: 'e-r18-r24', from: 'r18', to: 'r24', weight: consolidated ? 'linked' : 'root list' },
    { id: 'e-r18-c26', from: 'r18', to: 'c26', weight: 'child' },
    { id: 'e-c26-c41', from: 'c26', to: 'c41', weight: 'child' },
  ];
  if (!cut) edges.push({ id: 'e-c26-c35', from: 'c26', to: 'c35', weight: 'child' });
  else edges.push({ id: 'e-min-r18', from: 'min', to: 'r18', weight: 'root list' });
  return graphState({ nodes, edges }, { title });
}

function* lazyRootList() {
  yield {
    state: heapGraph('A Fibonacci heap is a forest plus a min pointer'),
    highlight: { found: ['min'], active: ['r7', 'r18', 'r24'], compare: ['e-min-r7', 'e-r7-r18'] },
    explanation: 'Unlike a binary heap, a Fibonacci heap is not one compact tree. It is a root list of heap-ordered trees plus a pointer to the minimum root. Laziness is the design feature.',
  };

  yield {
    state: labelMatrix(
      'Cheap operations defer structure',
      [
        { id: 'insert', label: 'insert' },
        { id: 'meld', label: 'meld' },
        { id: 'find', label: 'find-min' },
        { id: 'cleanup', label: 'cleanup' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'cost', label: 'amortized cost' },
      ],
      [
        ['add one root', 'O(1)'],
        ['concatenate root lists', 'O(1)'],
        ['read min pointer', 'O(1)'],
        ['extract-min consolidates', 'O(log n)'],
      ],
    ),
    highlight: { found: ['insert:cost', 'meld:cost', 'find:cost'], compare: ['cleanup:cost'] },
    explanation: 'Fibonacci heaps make the common priority-queue updates cheap by postponing consolidation. The bill comes due when the minimum is extracted.',
    invariant: 'Every tree still obeys heap order: parent key <= child key.',
  };

  yield {
    state: heapGraph('Extract-min links roots by degree', 'consolidated'),
    highlight: { removed: ['min'], active: ['r7', 'r18', 'r24', 'e-r18-r24'], found: ['r7'] },
    explanation: 'During extract-min, the old minimum is removed, its children become roots, and roots with equal degree are linked until no two root trees share a degree. This restores a logarithmic bound on root-list size.',
  };

  yield {
    state: labelMatrix(
      'Priority queues compared',
      [
        { id: 'binary', label: 'binary heap' },
        { id: 'binomial', label: 'binomial heap' },
        { id: 'fib', label: 'Fibonacci heap' },
        { id: 'pairing', label: 'pairing heap' },
      ],
      [
        { id: 'decrease', label: 'decrease-key' },
        { id: 'extract', label: 'extract-min' },
        { id: 'fit', label: 'best lesson' },
      ],
      [
        ['O(log n)', 'O(log n)', 'simple and cache-friendly'],
        ['O(log n)', 'O(log n)', 'structured forest'],
        ['O(1) amortized', 'O(log n)', 'network optimization theory'],
        ['fast practical', 'amortized subtle', 'simpler self-adjusting heap'],
      ],
    ),
    highlight: { active: ['fib:decrease', 'fib:fit'], compare: ['binary:fit'] },
    explanation: 'Fibonacci heaps are famous because decrease-key becomes O(1) amortized. That changes theoretical bounds for shortest paths and other graph algorithms with many key decreases.',
  };
}

function* decreaseKeyCascade() {
  yield {
    state: heapGraph('Decrease-key may violate heap order', 'marked'),
    highlight: { active: ['c35'], compare: ['c26', 'e-c26-c35'] },
    explanation: 'Suppose node 35 is decreased to 2. It is now smaller than its parent 26, violating heap order. Instead of bubbling through the tree, Fibonacci heaps cut the node out.',
  };

  yield {
    state: heapGraph('Cut the decreased node to the root list', 'cut'),
    highlight: { active: ['c35', 'min'], compare: ['c26'], found: ['c35'] },
    explanation: 'The decreased node is cut from its parent and moved to the root list. The min pointer updates to the new value. This is why decrease-key is cheap: one local cut can finish the operation.',
  };

  yield {
    state: labelMatrix(
      'Cascading cut rule',
      [
        { id: 'parent0', label: 'parent lost no child before' },
        { id: 'parent1', label: 'parent already marked' },
        { id: 'root', label: 'parent is root' },
        { id: 'potential', label: 'potential accounting' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'why', label: 'why' },
      ],
      [
        ['mark parent', 'one lost child tolerated'],
        ['cut parent too', 'prevent high-degree damage'],
        ['do not mark root', 'roots can be consolidated later'],
        ['marks and roots pay', 'amortized O(1) decrease'],
      ],
    ),
    highlight: { found: ['parent1:action', 'potential:why'], compare: ['parent0:action'] },
    explanation: 'If a non-root node loses one child, mark it. If it later loses another, cut it too. Cascading cuts keep tree degrees controlled without eager rebalancing.',
  };

  yield {
    state: labelMatrix(
      'Algorithmic consequences',
      [
        { id: 'dijkstra', label: 'Dijkstra' },
        { id: 'prim', label: 'Prim MST' },
        { id: 'edmonds', label: 'branching' },
        { id: 'practice', label: 'production code' },
      ],
      [
        { id: 'operation', label: 'dominant operation' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['decrease-key', 'better asymptotic bound'],
        ['decrease-key', 'same priority-queue pressure'],
        ['meld and decrease', 'network optimization use case'],
        ['constant factors', 'binary/pairing heaps often win'],
      ],
    ),
    highlight: { active: ['dijkstra:lesson', 'prim:lesson'], compare: ['practice:lesson'] },
    explanation: 'The right lesson is not that every program should use Fibonacci heaps. The lesson is how amortized data-structure design changes the shape of graph algorithm bounds.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lazy root list') yield* lazyRootList();
  else if (view === 'decrease-key cascade') yield* decreaseKeyCascade();
  else throw new InputError('Pick a Fibonacci-heap view.');
}

export const article = {
  sections: [
    {
      heading: 'Why Fibonacci heaps exist',
      paragraphs: [
        'Fibonacci heaps exist because some graph algorithms spend most of their priority-queue time lowering priorities. Dijkstra, Prim, and network optimization algorithms may perform many decrease-key operations compared with extract-min operations. If every decrease costs O(log n), that cost can dominate the run.',
        'A Fibonacci heap is a meldable priority queue represented as a forest of heap-ordered trees. It keeps a pointer to the minimum root and deliberately leaves many trees unconsolidated until extract-min. Insert, meld, find-min, and decrease-key are cheap amortized operations because the heap postpones structural cleanup.',
        'The structure is not famous because it is the easiest heap to ship. It is famous because it shows how a data structure can change an algorithmic bound by moving work to the operation that can best afford it.',
      ],
    },
    {
      heading: 'The binary heap baseline and its wall',
      paragraphs: [
        'A binary heap is compact, simple, and usually fast. It stores a near-complete tree in an array, so insert, delete-min, and decrease-key by position cost O(log n). For many programs, that is the right answer because the memory layout is friendly and the code is small.',
        'The wall appears in algorithms with many priority decreases. Each edge relaxation in Dijkstra may improve a tentative distance. Each improvement wants to lower a key. Paying O(log n) for each one can make the priority queue the main cost. Some implementations avoid decrease-key by inserting duplicate entries, but that changes memory use and still leaves extra work during extraction.',
        'Fibonacci heaps ask whether every local priority decrease really needs eager tree repair. The answer is no. A node whose key becomes too small can be cut to the root list. The forest may become messier, but that mess is tracked and later cleaned up during extract-min.',
      ],
    },
    {
      heading: 'Core insight and invariants',
      paragraphs: [
        'The core insight is controlled laziness. Do not keep one perfectly tidy tree. Keep a root list of heap-ordered trees, remember the minimum root, and postpone consolidation until the minimum is removed. Cheap operations may create more roots or marked nodes, and the amortized proof accounts for that future cleanup.',
        'The first invariant is heap order inside every tree: a parent key is less than or equal to each child key. The second invariant is the min pointer: it names a root with the smallest key in the whole heap. The third invariant is the cut rule: a non-root node that loses a second child must be cut, which keeps tree degrees bounded.',
        'The name comes from that degree bound. Because nodes are cut after losing too many children, a node of degree k must have a subtree size that grows at least like Fibonacci numbers. That is why the maximum degree remains O(log n).',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The lazy-root-list view shows a forest plus a min pointer. The roots are not a bug. They are deferred work. Each root is a heap-ordered tree that has not yet been linked with another tree of the same degree. The min pointer explains why find-min is O(1): the heap does not scan the forest every time it needs the smallest key.',
        'The extract-min frame shows cleanup at the right time. Removing the minimum exposes its children and then links roots by degree until no two root trees have the same degree. That step restores a small root-list bound after many earlier operations were allowed to be cheap.',
        'The decrease-key view focuses on a local violation. A child key becomes smaller than its parent, so heap order is broken. The repair is to cut that node to the root list. If the parent had already lost a child, the cut cascades upward. Marks make that rule visible.',
      ],
    },
    {
      heading: 'Basic operations',
      paragraphs: [
        'Insert creates a one-node tree and splices it into the root list. It updates the min pointer if the new key is smaller. No bubbling through an array is needed. Meld concatenates two root lists and keeps the smaller of the two min pointers. That is why meld is O(1) amortized.',
        'Find-min reads the min pointer. Delete-min, usually called extract-min, does the major cleanup. It removes the minimum root, promotes that root children to the root list, then links roots of equal degree. When two roots have the same degree, the larger-key root becomes a child of the smaller-key root.',
        'Delete of an arbitrary node is commonly implemented by decreasing its key below all others, cutting it to the top through the normal rules, and then extracting it as the minimum. Practical implementations may also provide a direct delete helper, but the conceptual operation comes from decrease-key plus extract-min.',
      ],
    },
    {
      heading: 'Decrease-key and cascading cuts',
      paragraphs: [
        'Decrease-key is the signature operation. If lowering a node keeps it no smaller than its parent, no structural repair is needed. If it becomes smaller than its parent, heap order is violated. The heap cuts that node from its parent and moves it to the root list. The min pointer updates if the decreased key is now smallest.',
        'The parent then matters. If the parent is a root, stop. Roots can lose children because they will be handled during later consolidation. If the parent is not a root and has not lost a child before, mark it. If it was already marked, cut it too and continue upward.',
        'This rule is what keeps high-degree trees honest. A non-root node may lose one child, but losing a second child forces it to become a root. That prevents an old parent from keeping a large degree while its subtree shrinks too much.',
      ],
    },
    {
      heading: 'Extract-min and consolidation',
      paragraphs: [
        'Extract-min removes the minimum root. Its children become roots because removing their parent would otherwise orphan them. The heap then scans the root list and links roots of equal degree until each degree appears at most once. This step is similar in spirit to binomial-heap consolidation, but Fibonacci heaps delay it until needed.',
        'The degree table used during consolidation only needs O(log n) slots because of the Fibonacci degree bound. Each link reduces the number of roots by one. At the end, the heap rebuilds or scans the root list to set the new min pointer.',
        'This is the operation where earlier laziness is paid back. Many inserts and cuts may have created many roots. Extract-min performs the linking work that those operations avoided. The amortized cost remains O(log n) because the root count and mark count carried accounting credit.',
      ],
    },
    {
      heading: 'Why the amortized proof works',
      paragraphs: [
        'The proof tracks stored disorder. Many roots mean extract-min has more consolidation to do. Marked nodes mean future cascading cuts may happen. The potential function assigns credit to those conditions, so cheap operations are allowed to create some future work as long as they create enough accounting credit to pay for it.',
        'Classic amortized bounds are O(1) for insert, meld, find-min, and decrease-key, and O(log n) for extract-min and delete. These are not worst-case bounds for each individual call. They are sequence bounds under the potential method.',
        'The cut rule and the degree bound are tied together. Because a non-root node is cut after losing a second child, a high-degree node must still own a large enough subtree. That keeps extract-min from needing a degree table larger than logarithmic size.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the root list contains trees rooted at 3, 7, 18, and 24, and the min pointer names 3. Inserting 2 does not rebuild the heap. It creates a one-node tree, splices that tree into the root list, and moves the min pointer to 2. The operation is fast because it avoids bubbling through a compact array.',
        'Now suppose a child key 35 is decreased to 2 under parent 26. The parent-child order is invalid because 2 is smaller than 26. The heap cuts that child out and adds it to the root list. If parent 26 had already lost one child before, it is cut too. The mark decides whether the cut stops or cascades.',
        'Later, extract-min removes the root with key 2. Its children, if any, become roots. Then the heap links roots by degree. The deferred work finally happens, but it happens in a batch where linking can restore a compact degree profile.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The famous use case is Dijkstra with many decrease-key operations, where the theoretical bound improves to O(E + V log V) with Fibonacci heaps. Prim MST and other network optimization algorithms have the same priority-queue pressure. The structure matters when decrease-key is common and real.',
        'Meld is another win. Concatenating root lists is cheap, so workloads that combine priority queues can benefit in theory. Binomial heaps also support meld well, but Fibonacci heaps combine cheap meld with cheap amortized decrease-key.',
        'As a learning topic, Fibonacci heaps are one of the clearest examples of data-structure design changing algorithm analysis. The forest, marks, cuts, and degree rule all exist to support a bound, not just to make a neat implementation.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Fibonacci heaps are rarely the default production priority queue. They are pointer-heavy, allocation-heavy, hard to implement correctly, and less cache-friendly than binary heaps. Constant factors can dominate the asymptotic gain, especially for small or medium inputs.',
        'They need handles for real decrease-key. If a codebase does not keep a pointer or index to the heap node for each item, decrease-key cannot be O(1) because the item must first be found. Many practical Dijkstra implementations use duplicate entries in a binary heap instead, accepting extra extracts for simpler code.',
        'The bounds are amortized. A specific extract-min can be expensive after many lazy operations. If a system needs tight per-operation latency, a simpler heap with predictable behavior may be easier to operate. If memory ownership is complex, cascading cuts and root-list manipulation can become a source of bugs.',
        'Laziness also does not mean weak invariants. Heap order, min pointer validity, mark rules, parent-child links, sibling lists, degree counts, and consolidation table logic all need to be correct. A small pointer bug can corrupt the whole forest.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Represent each node with key, degree, mark bit, parent, child, and sibling links. Keep a direct handle from the external item to its node if decrease-key is part of the API. Without handles, the advertised operation bound is not available.',
        'Test local operations before whole algorithms. Verify that cut removes a node from its child list, clears its parent, adds it to the root list, and clears its mark. Verify that cascading cut stops at roots and marks an unmarked non-root parent. Verify that consolidation leaves at most one root per degree and preserves heap order.',
        'Instrumentation helps. Track root count, marked-node count, max degree, extract-min link count, and cascading-cut depth. These counters make it easier to see whether the heap is following the expected amortized story or slowly accumulating a structural bug.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Fredman and Tarjan, Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms, at https://www.cs.princeton.edu/courses/archive/fall03/cs528/handouts/fibonacci%20heaps.pdf. Study Binary Heap, Dijkstra, Prim MST, Amortized Big-O Growth Rates, Pairing Heap, and Soft Heap Approximate Priority Queue next.',
      ],
    },
  ],
};
