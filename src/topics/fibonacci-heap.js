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
  const rootNodes = ['min', 'r7', 'r18', 'r24'];
  const childNodes = ['c26', 'c35', 'c41'];
  const totalNodes = rootNodes.length + childNodes.length;
  yield {
    state: heapGraph('A Fibonacci heap is a forest plus a min pointer'),
    highlight: { found: ['min'], active: ['r7', 'r18', 'r24'], compare: ['e-min-r7', 'e-r7-r18'] },
    explanation: `Unlike a binary heap, a Fibonacci heap is not one compact tree. These ${totalNodes} nodes form a root list of ${rootNodes.length} heap-ordered trees plus a pointer to the minimum root. Laziness is the design feature.`,
  };

  const ops = [
    { id: 'insert', label: 'insert', cost: 'O(1)' },
    { id: 'meld', label: 'meld', cost: 'O(1)' },
    { id: 'find', label: 'find-min', cost: 'O(1)' },
    { id: 'cleanup', label: 'cleanup', cost: 'O(log n)' },
  ];
  const cheapOps = ops.filter(o => o.cost === 'O(1)');
  yield {
    state: labelMatrix(
      'Cheap operations defer structure',
      ops.map(({ id, label }) => ({ id, label })),
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
    explanation: `${cheapOps.length} of ${ops.length} operations run in O(1) by postponing consolidation. The bill comes due when the minimum is extracted at O(log n).`,
    invariant: `Every tree across the ${rootNodes.length}-root forest still obeys heap order: parent key <= child key.`,
  };

  yield {
    state: heapGraph('Extract-min links roots by degree', 'consolidated'),
    highlight: { removed: ['min'], active: ['r7', 'r18', 'r24', 'e-r18-r24'], found: ['r7'] },
    explanation: `During extract-min, the old minimum is removed, its ${childNodes.length} children become roots, and roots with equal degree are linked until no two root trees share a degree. This restores a logarithmic bound on root-list size.`,
  };

  const heapVariants = [
    { id: 'binary', label: 'binary heap' },
    { id: 'binomial', label: 'binomial heap' },
    { id: 'fib', label: 'Fibonacci heap' },
    { id: 'pairing', label: 'pairing heap' },
  ];
  yield {
    state: labelMatrix(
      'Priority queues compared',
      heapVariants,
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
    explanation: `Among ${heapVariants.length} priority queues compared, Fibonacci heaps are the only one with O(1) amortized decrease-key. That changes theoretical bounds for shortest paths and other graph algorithms with many key decreases.`,
  };
}

function* decreaseKeyCascade() {
  const oldKey = 35;
  const newKey = 2;
  const parentKey = 26;
  yield {
    state: heapGraph('Decrease-key may violate heap order', 'marked'),
    highlight: { active: ['c35'], compare: ['c26', 'e-c26-c35'] },
    explanation: `Suppose node ${oldKey} is decreased to ${newKey}. It is now smaller than its parent ${parentKey}, violating heap order. Instead of bubbling through the tree, Fibonacci heaps cut the node out.`,
  };

  yield {
    state: heapGraph('Cut the decreased node to the root list', 'cut'),
    highlight: { active: ['c35', 'min'], compare: ['c26'], found: ['c35'] },
    explanation: `The decreased node (now key ${newKey}) is cut from its parent ${parentKey} and moved to the root list. The min pointer updates to ${newKey}. This is why decrease-key is cheap: one local cut can finish the operation.`,
  };

  const cascadeRules = [
    { id: 'parent0', label: 'parent lost no child before' },
    { id: 'parent1', label: 'parent already marked' },
    { id: 'root', label: 'parent is root' },
    { id: 'potential', label: 'potential accounting' },
  ];
  const maxChildLoss = 1;
  yield {
    state: labelMatrix(
      'Cascading cut rule',
      cascadeRules,
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
    explanation: `The ${cascadeRules.length} cascading-cut rules: if a non-root node loses ${maxChildLoss} child, mark it. If it later loses another (exceeding the ${maxChildLoss}-loss tolerance), cut it too. Cascading cuts keep tree degrees controlled without eager rebalancing.`,
  };

  const algorithms = [
    { id: 'dijkstra', label: 'Dijkstra' },
    { id: 'prim', label: 'Prim MST' },
    { id: 'edmonds', label: 'branching' },
    { id: 'practice', label: 'production code' },
  ];
  const decreaseKeyUsers = algorithms.filter(a => a.id !== 'practice');
  yield {
    state: labelMatrix(
      'Algorithmic consequences',
      algorithms,
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
    explanation: `${decreaseKeyUsers.length} of ${algorithms.length} algorithms benefit from O(1) decrease-key. The right lesson is not that every program should use Fibonacci heaps — the lesson is how amortized data-structure design changes the shape of graph algorithm bounds.`,
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
        'The visualization shows a forest of heap-ordered trees connected by a horizontal root list. Each tree obeys heap order: every parent key is less than or equal to its children\'s keys. The found highlight marks the min pointer, the root holding the smallest key in the entire heap.',
        {type: 'callout', text: 'Fibonacci heaps buy cheap decrease-key by delaying cleanup and charging that cleanup to stored potential.'},
        'Nodes labeled "marked" have already lost one child since becoming a non-root node. If a marked node loses a second child, it gets cut to the root list and unmarked. This cascading cut mechanism keeps tree degrees bounded.',
        'Switch between the two views. In "lazy root list," watch insert splice a singleton into the root list with zero restructuring, and watch extract-min pay for all that deferred work by linking roots of equal degree until no duplicates remain. In "decrease-key cascade," watch a node get severed from its parent, appear in the root list, and then check whether the parent\'s mark bit triggers a chain of further cuts upward.',
        'At each step, track two things: what deferred work was just created, and what deferred work was just paid off. The entire data structure is a negotiation between laziness and eventual cleanup.',
        {type: 'image', src: './assets/gifs/fibonacci-heap.gif', alt: 'Animated walkthrough of the fibonacci heap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Fredman and Tarjan invented the Fibonacci heap in 1987 to solve one specific bottleneck in graph algorithms. Dijkstra\'s shortest-path algorithm and Prim\'s minimum spanning tree both call decrease-key far more often than extract-min. With V vertices and E edges, there are up to E decrease-key calls but only V extract-min calls. A binary heap charges O(log V) for both operations, so the total cost is O((V + E) log V), and on dense graphs the decrease-key calls dominate.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Fibonacci_heap.png/330px-Fibonacci_heap.png', alt: 'Fibonacci heap forest with marked nodes and a minimum pointer', caption: 'A Fibonacci heap is a forest of heap-ordered trees with marks that record previous child loss. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Fibonacci_heap.png.'},
        'The question Fredman and Tarjan asked: can decrease-key be made O(1) without ruining extract-min? If yes, Dijkstra drops from O((V + E) log V) to O(V log V + E). On a dense graph where E approaches V squared, that is the difference between O(V squared log V) and O(V squared). The log factor on the dominant term vanishes entirely.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A binary heap stores a complete tree in a flat array. Children of index i sit at positions 2i+1 and 2i+2, so the structure is implicit: no pointers, no per-node allocation, no mark bits. Insert and extract-min both cost O(log n) by bubbling up or sifting down through at most log n levels. Decrease-key works the same way: lower the key, then bubble up.',
        'Binary heaps are short to implement, cache-friendly because of contiguous memory layout, and fast for most practical workloads. For general-purpose priority-queue needs, a binary heap is the right default.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dijkstra relaxes every edge, and each edge relaxation may call decrease-key. With V vertices and E edges, there are up to E decrease-key calls and only V extract-min calls. A binary heap charges O(log V) for both, so the total priority-queue cost is O((V + E) log V).',
        'On a dense graph where E is near V squared, binary-heap Dijkstra becomes O(V squared log V). The log factor sits on top of the already-quadratic edge processing. Prim\'s MST has the same profile: E decrease-key calls at O(log V) each make the priority queue the bottleneck.',
        'The log factor on decrease-key is not intrinsic to shortest-path or MST algorithms. It is an artifact of the binary heap\'s structure, which forces every key change to percolate through O(log n) levels. If decrease-key could run in O(1), the log factor on the dominant E term would disappear.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of maintaining rigid tree structure after every operation, defer all restructuring. Insert just splices a new singleton into the root list. Decrease-key just cuts the affected node and drops it into the root list. The forest grows messy and wide, but every cheap operation deposits potential energy that will finance future cleanup.',
        'The cleanup happens during extract-min: after removing the minimum root and promoting its children, consolidation links roots of equal degree until no two share the same degree. This is the only expensive operation, and the potential stored by all those lazy inserts and cuts pays for the linking work.',
        'Cascading cuts are the second half of the insight. When a non-root node loses a child, it gets marked. If it loses a second child, it gets cut to the root list too, and the cascade continues upward. This rule prevents any node from losing too many children while staying deep in the tree, which would inflate its degree beyond what its subtree size justifies. The cascade keeps the maximum degree bounded at O(log n), and that bound is what makes extract-min logarithmic rather than linear.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The structure is a circular doubly-linked list of heap-ordered trees, plus a min pointer to the root with the smallest key. Each node stores its key, its degree (number of children), a mark bit, and pointers to its parent, one child, and its left and right siblings in the sibling ring.',
        'Insert: create a one-node tree, splice it into the root list, update the min pointer if the new key is smaller. No restructuring at all. O(1).',
        'Find-min: return the key at the min pointer. O(1).',
        'Meld: concatenate the two root lists by splicing their circular linked lists together, then keep the smaller min pointer. O(1).',
        'Decrease-key: lower the node\'s key. If the node still satisfies heap order with its parent, done. Otherwise, cut the node from its parent, clear its mark, move it to the root list, and update the min pointer if needed. Then check the parent: if it is a root, stop. If it is unmarked, mark it (this is its first child loss). If it is already marked, cut it too, unmark it, and repeat upward. This chain is the cascading cut. Amortized O(1).',
        'Extract-min: remove the min root, splice all its children into the root list, then consolidate. Consolidation uses a degree-indexed array: walk each root, and if another root already occupies that degree slot, link the two (larger key becomes child of smaller), increment the winner\'s degree, and continue. When no collisions remain, scan the array to find the new minimum. Amortized O(log n).',
        'Delete: decrease the key to negative infinity, then extract-min. Amortized O(log n).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The potential function is phi = t + 2m, where t is the number of trees in the root list and m is the number of marked nodes. Each root tree carries one coin of stored work; each marked node carries two coins.',
        'Insert adds one tree, depositing one coin. Actual work is O(1), and the potential increase is +1, so the amortized cost is O(1).',
        'Decrease-key without cascading: O(1) actual work, one new root (+1 coin), and at most one new mark (+2 coins). Amortized cost: O(1). With cascading cuts: each cascade step does O(1) work, removes a mark (-2 coins), and adds one root (+1 coin), netting -1 coin. The cascade pays for itself from the marks it clears. Only the final parent may gain a new mark (+2 coins). Total amortized cost across the entire chain: still O(1).',
        'Extract-min does O(D + t) actual work, where D is the maximum degree and t is the pre-consolidation root count. After consolidation, at most D+1 roots survive, so phi drops by at least t - (D+1). That potential release pays for the O(t) linking work. The remaining O(D) cost comes from scanning the degree array.',
        'The degree bound D = O(log n) follows from cascading cuts. A node of degree k has at least F(k+2) descendants, where F is the Fibonacci sequence. Since F(k+2) grows exponentially (roughly as phi^k where phi is the golden ratio), k can be at most about 1.44 log2 n. This size bound is why the structure is named after Fibonacci. Without cascading cuts, nodes could lose children indefinitely, their degrees would overstate subtree sizes, and the logarithmic bound would collapse.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert O(1), find-min O(1), decrease-key O(1) amortized, meld O(1), extract-min O(log n) amortized, delete O(log n) amortized. All bounds are amortized over a sequence of operations starting from an empty heap.',
        'Compared to a binary heap: binary heap insert is O(log n), decrease-key is O(log n), and meld is O(n). The Fibonacci heap wins on all three. The binary heap wins on constant factors, cache locality, and implementation simplicity.',
        'Space is O(n) but with a large constant. Each node carries parent, child, left, and right pointers plus a degree counter and a mark bit. A binary heap stores the same n keys in a contiguous array with zero per-node overhead, so for the same n, actual memory consumption can differ by 5-10x.',
        'Doubling n adds roughly one more level to the degree bound, so extract-min costs about one additional linking step. Decrease-key stays O(1) regardless of n. The practical savings over a binary heap compound when E is much larger than V: E decrease-key calls at O(1) each versus E calls at O(log V) each means the gap widens as graphs get denser.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dijkstra\'s algorithm with a Fibonacci heap runs in O(V log V + E). On a dense graph with E near V squared, binary-heap Dijkstra costs O(V squared log V) while Fibonacci-heap Dijkstra costs O(V squared). The log factor on the edge-processing term vanishes.',
        'Prim\'s MST gets the same improvement: O(E + V log V) instead of O((V + E) log V). Any graph algorithm whose inner loop calls decrease-key more than extract-min benefits from the same asymptotic gain.',
        'Minimum spanning arborescence (Edmonds/Chu-Liu) and certain network flow algorithms also benefit, because they perform many decrease-key and meld operations in tight loops. The Fibonacci heap is also used inside some implementations of Nagamochi-Ibaraki minimum cut.',
        'In practice, Fibonacci heaps appear more often in algorithm libraries and reference implementations than in production code. Their primary role is theoretical: they set the benchmark that other priority queues are measured against, and they prove that O(1) decrease-key is achievable without sacrificing O(log n) extract-min.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Constant factors are large. Every node is a separately allocated object with five pointers and a mark bit, so pointer chasing destroys cache locality. On graphs with millions of nodes, a binary heap in a flat array often wins in wall-clock time despite worse asymptotic bounds.',
        'Pairing heaps are simpler, have better cache behavior, and achieve the same O(1) amortized insert and meld. Their decrease-key is conjectured O(1) amortized but only proven O(log log n). In practice, pairing heaps usually outperform Fibonacci heaps.',
        'Amortized bounds hide worst-case spikes. A single extract-min after a long sequence of lazy inserts can do O(n) actual work. Real-time systems that need bounded per-operation latency should use Brodal queues (same bounds, worst-case) or accept a simpler structure with predictable per-operation costs.',
        'Decrease-key requires a direct pointer (handle) to the node being decreased. If the caller cannot maintain handles, it must search for the node first, destroying the O(1) bound. Many practical Dijkstra implementations sidestep this by inserting duplicate entries into a binary heap and discarding stale extractions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start empty. Insert 3: root list = [3], min = 3, phi = 1 + 0 = 1. Insert 7: root list = [3, 7], min = 3, phi = 2. Insert 1: root list = [3, 7, 1], min = 1, phi = 3. Insert 5: root list = [3, 7, 1, 5], min = 1, phi = 4. Four singleton trees, zero marks. Every insert was O(1) actual work plus one coin deposited into the potential.',
        'Extract-min: remove node 1 (it has no children). The remaining roots are [3, 7, 5], all degree 0. Consolidation begins: 3 goes into degree-0 slot. Next, 7 also has degree 0 and collides with 3. Since 7 > 3, link 7 under 3. Now 3 has degree 1 and goes into the degree-1 slot. Next, 5 has degree 0, no collision. Consolidation ends. Root list = [3, 5], min = 3, phi = 2. Phi dropped from 4 to 2; those two released coins paid for the two linking comparisons.',
        'Decrease-key: change node 7 (child of 3) from key 7 to key 2. The new key 2 is less than parent key 3, violating heap order. Cut 7 from 3, move it to the root list, update min to 2. Root list = [3, 5, 2], min = 2, phi = 3 + 0 = 3. Node 3 lost a child, but 3 is a root so no mark is set. Amortized cost: O(1) actual work + 1 coin for the new root = O(1).',
        'Now suppose 3 were a non-root with two children, 8 and 9. Decrease 8 to 0: cut 8 from 3, move 8 to root list, mark 3 (first child loss). Phi gains +1 root and +2 for the mark, net +3. Next, decrease 9 to 0: cut 9 from 3. Node 3 is already marked, so cascading cut fires: cut 3 from its parent too, unmark 3, move both to root list. The mark removal releases 2 coins, the two new roots cost 2 coins, and the O(1) work per cut is covered. If 3\'s parent was also marked, the cascade would continue upward, each step self-financing from the released mark potential.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Michael L. Fredman and Robert E. Tarjan, "Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms," Journal of the ACM 34(3), 1987. This is the original paper and still the clearest treatment of the potential argument.',
        'Prerequisite: study Binary Heap to understand the baseline priority queue, and the potential method of amortized analysis to follow the coin-based accounting argument used throughout this article.',
        'Extensions: Brodal Queue achieves the same operation costs in the worst case, not just amortized. Strict Fibonacci Heap by Brodal, Lagogiannis, and Tarjan provides worst-case bounds with a cleaner structure.',
        'Alternatives: Pairing Heap is simpler and typically faster in practice. Binomial Heap is the structural middle ground between binary and Fibonacci heaps, with O(log n) for all operations including meld.',
        'Applications: Dijkstra shortest paths and Prim MST are the canonical use cases. Study those algorithms to see exactly where O(1) decrease-key shaves the log factor off the overall running time.',
      ],
    },
  ],
};
