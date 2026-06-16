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
      heading: 'What it is',
      paragraphs: [
        'A Fibonacci heap is a meldable priority queue represented as a forest of heap-ordered trees. It keeps a pointer to the minimum root and deliberately leaves many trees unconsolidated until extract-min. That laziness is what makes insert, meld, and decrease-key cheap amortized operations.',
        'Compared with Binary Heap, the structure is less cache-friendly and much more complex. Its value is theoretical clarity: it shows how potential, marks, cuts, and deferred cleanup can buy operation bounds that matter inside graph algorithms.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insert creates a one-node tree and links it into the root list. Meld concatenates two root lists and updates the min pointer. Find-min reads that pointer. Extract-min removes the minimum root, promotes its children to roots, and consolidates roots by degree so at most one tree of each degree remains.',
        'Decrease-key is the signature operation. If decreasing a node keeps it above its children and not smaller than its parent, no structural work is needed. If it becomes smaller than its parent, cut it to the root list. If the parent was already marked, cascade the cut upward. Marks record nodes that have already lost one child.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The classic amortized bounds are O(1) for insert, meld, find-min, and decrease-key, and O(log n) for extract-min and delete. The analysis uses a potential function based on the number of roots and marked nodes. Extract-min spends the deferred cleanup work accumulated by earlier cheap operations.',
        'These are amortized bounds, not necessarily simple wall-clock wins. Pointer-heavy forests, complicated code, and memory overhead can make Binary Heap or pairing-heap variants faster in ordinary systems. The Fibonacci heap is still essential for understanding data-structure driven algorithm analysis.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The famous use case is Dijkstra with many decrease-key operations, where the theoretical bound improves to O(E + V log V) with Fibonacci heaps. Prim MST and other network optimization algorithms benefit from the same operation profile. The topic links directly to Dijkstra, Prim MST, Binary Heap, and amortized analysis.',
        'A complete case study is a road-network shortest path run. Each edge relaxation may reduce a tentative distance. A binary heap pays O(log V) for each priority improvement or inserts stale duplicates. A Fibonacci heap makes the conceptual decrease-key update O(1) amortized, moving the cost pressure to extract-min.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Fibonacci heaps are not usually the default production priority queue. They are hard to implement, difficult to tune, and pointer-heavy. Another misconception is that laziness means no invariant. Heap order, root lists, degree consolidation, marks, and cascading cuts are all strict contracts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Fredman and Tarjan, Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms, at https://www.cs.princeton.edu/courses/archive/fall03/cs528/handouts/fibonacci%20heaps.pdf. Study Binary Heap, Dijkstra, Prim MST, Amortized Big-O Growth Rates, Pairing Heap, and Soft Heap Approximate Priority Queue next.',
      ],
    },
  ],
};
