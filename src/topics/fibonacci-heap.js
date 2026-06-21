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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a forest of heap-ordered trees linked by a horizontal root list. Each tree satisfies heap order: every parent key is less than or equal to its children. The found highlight marks the min pointer, the root holding the smallest key in the entire heap.',
        {type: 'callout', text: 'Fibonacci heaps buy cheap decrease-key by delaying cleanup and charging that cleanup to stored potential.'},
        'Nodes labeled "marked" have already lost one child since becoming a non-root. If a marked node loses a second child, it gets cut to the root list and unmarked. This is the cascading cut, and it is the mechanism that keeps tree degrees small.',
        'In the "lazy root list" view, watch how insert just splices a new singleton into the root list (no restructuring), and how extract-min pays for all that deferred work by linking roots of equal degree until no two share a degree. In the "decrease-key cascade" view, watch a node get cut from its parent and appear in the root list, then check whether the parent was already marked and triggers a cascade.',
        'At each step, ask two questions: what deferred work was just created, and what deferred work was just paid off. That tension between laziness and cleanup is the entire design.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Fredman and Tarjan built the Fibonacci heap in 1987 to fix one specific bottleneck. Dijkstra and Prim both spend most of their priority-queue time calling decrease-key, not extract-min. With a binary heap, decrease-key costs O(log n), and on a dense graph with E edges that means E log V work just on key decreases. Extract-min only happens V times.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Fibonacci_heap.png/330px-Fibonacci_heap.png', alt: 'Fibonacci heap forest with marked nodes and a minimum pointer', caption: 'A Fibonacci heap is a forest of heap-ordered trees with marks that record previous child loss. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Fibonacci_heap.png.'},
        'The question: can decrease-key be made O(1) without ruining extract-min? If so, Dijkstra drops from O((V + E) log V) to O(V log V + E). On dense graphs where E approaches V squared, that is the difference between O(V squared log V) and O(V squared). The log factor on the dominant term disappears.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A binary heap packs a complete tree into a flat array. Children of index i sit at 2i+1 and 2i+2, so the structure is implicit: no pointers, no per-node allocation, no mark bits. Insert and extract-min cost O(log n) by bubbling up or sifting down through at most log n levels. Decrease-key costs O(log n) the same way: lower the key, then bubble up.',
        'The code is short, the memory layout is cache-friendly, and for most workloads the binary heap is the right priority queue. It earned its dominance.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dijkstra relaxes every edge, and each relaxation may call decrease-key. With V vertices and E edges, that is up to E decrease-key calls and V extract-min calls. A binary heap charges O(log V) for both, giving total cost O((V + E) log V).',
        'On a dense graph, E is close to V squared. Binary-heap Dijkstra becomes O(V squared log V). With a Fibonacci heap, the E decrease-key calls cost O(1) each and only the V extract-min calls cost O(log V), giving O(V squared + V log V) = O(V squared). The log factor on the dominant term is gone.',
        'Prim MST has the same profile: E decrease-key operations at O(log V) each make the priority queue the bottleneck. The log factor on decrease-key is not intrinsic to shortest paths or minimum spanning trees. It is an artifact of the binary heap.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The structure is a circular doubly-linked list of heap-ordered trees, plus a min pointer to the root with the smallest key. Each node stores its key, its degree (child count), a mark bit, and pointers to its parent, one child, and its left and right siblings.',
        'Insert: create a one-node tree, splice it into the root list, update the min pointer if the new key is smaller. No restructuring. O(1).',
        'Find-min: follow the min pointer. O(1).',
        'Meld: concatenate two root lists, keep the smaller min pointer. O(1).',
        'Decrease-key: lower the node key. If it is still at least its parent key, done. Otherwise, cut the node from its parent, clear its mark, move it to the root list, and update the min pointer. Then check the parent: if it is a root, stop; if it is unmarked, mark it; if it is already marked, cut it too and repeat upward. This is the cascading cut. Amortized O(1).',
        'Extract-min: remove the min root, promote all its children to the root list, then consolidate. Consolidation walks the root list and links any two roots with the same degree: the larger-keyed root becomes a child of the smaller. Repeat until every root has a distinct degree, then scan to find the new min. Amortized O(log n).',
        'Delete: decrease the key to negative infinity, then extract-min. Amortized O(log n).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The potential function is phi = t + 2m, where t counts root-list trees and m counts marked nodes. Think of each tree in the root list as carrying one coin of stored work, and each marked node as carrying two coins.',
        'Insert adds one tree, depositing one coin. Actual work is O(1), amortized cost is O(1).',
        'Decrease-key with no cascading cut: O(1) actual work, one new root (+1 coin), possibly one new mark (+2 coins). Amortized cost: O(1). With cascading cuts: each cascade step does O(1) actual work but removes a mark (-2 coins) and adds one root (+1 coin), netting -1 coin. The cascade finances itself from the marks it clears. Only the final parent may gain a new mark (+2 coins). Total amortized cost: still O(1).',
        'Extract-min does O(D + t) actual work, where D is the maximum degree and t is the pre-consolidation root count. Consolidation links roots until at most D+1 survive, dropping phi by at least t - (D+1). That potential drop pays for the O(t) linking work. The residual O(D) comes from the degree-table scan.',
        'The degree bound D is O(log n) because of cascading cuts. A node of degree k has at least F(k+2) descendants, where F is the Fibonacci sequence (hence the name). Since F(k+2) grows exponentially, k can be at most about 1.44 log2 n. Without cascading cuts, a node could lose children indefinitely, its degree would overstate its subtree size, and the O(log n) bound would collapse.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert O(1), find-min O(1), decrease-key O(1) amortized, meld O(1), extract-min O(log n) amortized, delete O(log n) amortized. All bounds are amortized over a sequence starting from an empty heap.',
        'Binary heap comparison: insert O(log n), decrease-key O(log n), meld O(n), everything else the same. The Fibonacci heap wins on decrease-key and meld. The binary heap wins on constant factors, cache behavior, and code simplicity.',
        'Space is O(n) but the constant is high. Each node carries parent, child, left, and right pointers, a degree counter, and a mark bit. A binary heap stores the same n keys in a contiguous array with zero per-node overhead.',
        'Doubling n adds roughly one more consolidation level to extract-min (one more bit in the degree bound). Decrease-key stays O(1) regardless. The savings compound when E is much larger than V: E decrease-key calls at O(1) each versus E calls at O(log V) each.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Dijkstra with a Fibonacci heap runs in O(V log V + E). On a dense graph with E near V squared, binary-heap Dijkstra costs O(V squared log V); Fibonacci-heap Dijkstra costs O(V squared). The log factor on the edge-processing term vanishes.',
        'Prim MST gets the same improvement: O(E + V log V) instead of O((V + E) log V).',
        'Minimum spanning arborescence (Edmonds/Chu-Liu) and certain network flow algorithms also benefit, because their inner loops perform many decrease-key and meld operations.',
        'The Fibonacci heap is a theoretical cornerstone. Even when practitioners choose simpler heaps, the Fibonacci heap sets the benchmark that other priority queues are measured against.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Constant factors are large. Every node is a separately allocated object with five pointers and a mark bit. Pointer chasing destroys cache locality. A binary heap in a flat array often beats a Fibonacci heap in wall-clock time for graphs with millions of nodes.',
        'Pairing heaps are simpler, have better cache behavior, and achieve the same O(1) amortized insert and meld. Their decrease-key is conjectured O(1) amortized but proven only O(log log n). In practice, pairing heaps usually win.',
        'Amortized bounds hide worst-case spikes. A single extract-min after many lazy inserts can do O(n) actual work. Real-time systems needing bounded per-operation latency should look at Brodal queues, which achieve the same bounds in the worst case, or accept a simpler structure with predictable costs.',
        'Decrease-key needs a direct pointer (handle) to the node. If the caller cannot maintain handles, it must search for the node first, destroying the O(1) bound. Many practical Dijkstra implementations dodge this by inserting duplicate entries into a binary heap and skipping stale extractions.',
        'The implementation is intricate: circular doubly-linked sibling lists, parent-child link surgery during cuts and consolidation, mark-bit propagation, degree-table bookkeeping. One pointer bug corrupts the entire forest. Fibonacci heaps are rarely implemented outside textbooks and algorithm libraries.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert 3: root list = [3], min = 3. Insert 7: root list = [3, 7], min = 3. Insert 1: root list = [3, 7, 1], min = 1. Insert 5: root list = [3, 7, 1, 5], min = 1. Four singleton trees, phi = 4 trees + 0 marks = 4. Every insert was O(1): just splice and maybe update the min pointer.',
        'Extract-min removes 1 (no children). Consolidate the remaining roots [3, 7, 5], all degree 0. Link 7 under 3 (both degree 0; 7 > 3, so 7 becomes a child of 3). Now 3 has degree 1, 5 has degree 0. No degree conflict remains. Root list = [3, 5], min = 3. phi drops from 4 to 2. The two units of released potential paid for the linking work.',
        'Decrease-key 7 to 2. Node 7 is a child of 3. The new key 2 is less than the parent key 3, so cut 7 from 3 and move it to the root list. Root list = [3, 5, 2], min = 2. Node 3 loses a child: since 3 is unmarked and is a root, no mark is set. phi = 3 trees + 0 marks = 3. Amortized cost: O(1).',
        'If 3 were a non-root and had another child that we decreased, 3 would first get marked (losing one child is tolerated). If 3 then lost a second child, the mark means 3 itself gets cut to the root list (cascading cut). The mark removal releases 2 coins of potential, and the new root costs 1 coin, so the cascade step is self-financing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Michael L. Fredman and Robert E. Tarjan, "Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms," Journal of the ACM 34(3), 1987.',
        'Prerequisite: study Binary Heap to understand the baseline, and Amortized Analysis (potential method) to follow the accounting argument.',
        'Extensions: Brodal Queue achieves the same bounds in worst case, not just amortized. Strict Fibonacci Heap (Brodal and Okasaki) provides a purely functional variant with worst-case bounds.',
        'Alternatives: Pairing Heap is simpler and faster in practice. Binomial Heap is the structural middle ground, with O(log n) meld and O(log n) decrease-key.',
        'Applications: Dijkstra shortest paths and Prim MST are the canonical use cases. Study those algorithms to see why O(1) decrease-key changes the overall bound.',
      ],
    },
  ],
};
