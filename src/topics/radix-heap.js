// Radix heap: monotone integer-priority queue for shortest paths.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'radix-heap',
  title: 'Radix Heap',
  category: 'Data Structures',
  summary: 'A monotone integer priority queue: bucket keys by the most significant differing bit from the last extracted key, then redistribute when a bucket is opened.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bucket layout', 'dijkstra pop'], defaultValue: 'bucket layout' },
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

function radixGraph(title) {
  return graphState({
    nodes: [
      { id: 'last', label: 'last = 8', x: 0.8, y: 3.6, note: 'last extracted key' },
      { id: 'b0', label: 'B0 same', x: 2.7, y: 1.2, note: 'key 8' },
      { id: 'b1', label: 'B1 bit 0', x: 4.2, y: 2.4, note: '9' },
      { id: 'b2', label: 'B2 bit 1', x: 5.7, y: 3.6, note: '10..11' },
      { id: 'b3', label: 'B3 bit 2', x: 7.2, y: 4.8, note: '12..15' },
      { id: 'redistribute', label: 'redistribute', x: 8.8, y: 2.4, note: 'new last = bucket min' },
      { id: 'pop', label: 'extract min', x: 8.8, y: 5.6, note: 'monotone pop' },
    ],
    edges: [
      { id: 'e-last-b0', from: 'last', to: 'b0', weight: 'xor 0' },
      { id: 'e-last-b1', from: 'last', to: 'b1', weight: 'msb diff 0' },
      { id: 'e-last-b2', from: 'last', to: 'b2', weight: 'msb diff 1' },
      { id: 'e-last-b3', from: 'last', to: 'b3', weight: 'msb diff 2' },
      { id: 'e-bucket-redist', from: 'b2', to: 'redistribute', weight: 'open bucket' },
      { id: 'e-redist-pop', from: 'redistribute', to: 'pop', weight: 'min becomes exact' },
    ],
  }, { title });
}

function* bucketLayout() {
  yield {
    state: radixGraph('Buckets are relative to the last extracted key'),
    highlight: { active: ['last', 'b0', 'b1', 'b2', 'b3'], compare: ['redistribute'] },
    explanation: 'A radix heap assumes extracted keys never decrease. It groups integer keys by the most significant bit where the key differs from the last extracted key.',
    invariant: 'Every stored key is at least last; Dijkstra with nonnegative edges satisfies this monotone condition.',
  };

  yield {
    state: labelMatrix(
      'With last = 8',
      [
        { id: 'k8', label: 'key 8' },
        { id: 'k9', label: 'key 9' },
        { id: 'k10', label: 'key 10' },
        { id: 'k14', label: 'key 14' },
      ],
      [
        { id: 'xor', label: 'key xor last' },
        { id: 'bucket' },
      ],
      [
        ['0', 'B0 exact'],
        ['1', 'B1'],
        ['2', 'B2'],
        ['6', 'B3'],
      ],
    ),
    highlight: { active: ['k9:bucket', 'k10:bucket', 'k14:bucket'], found: ['k8:bucket'] },
    explanation: 'B0 contains keys equal to last and can be popped directly. Higher buckets cover ranges whose exact minimum is found when that bucket becomes the first nonempty bucket.',
  };

  yield {
    state: radixGraph('Opening a bucket finds its minimum and redistributes'),
    highlight: { active: ['b2', 'redistribute', 'pop', 'e-bucket-redist', 'e-redist-pop'], compare: ['b3'] },
    explanation: 'When B0 is empty, find the first nonempty bucket, scan it to find its minimum, set last to that minimum, and redistribute the bucket entries under the new last.',
  };

  yield {
    state: labelMatrix(
      'Priority-queue comparison',
      [
        { id: 'binary', label: 'Binary Heap' },
        { id: 'fibo', label: 'Fibonacci Heap' },
        { id: 'pairing', label: 'Pairing Heap' },
        { id: 'radix', label: 'Radix Heap' },
      ],
      [
        { id: 'keys', label: 'key model' },
        { id: 'best' },
      ],
      [
        ['any comparable keys', 'general purpose'],
        ['any comparable keys', 'theory for decrease-key'],
        ['any comparable keys', 'simple meldable heap'],
        ['nondecreasing integer keys', 'shortest paths with bounded words'],
      ],
    ),
    highlight: { found: ['radix:keys', 'radix:best'], compare: ['binary:best'] },
    explanation: 'Radix heaps are specialized. They buy speed by using integer bits and monotonicity instead of comparison-tree ordering.',
  };
}

function* dijkstraPop() {
  yield {
    state: labelMatrix(
      'Dijkstra distance queue',
      [
        { id: 'start', label: 'pop dist 8' },
        { id: 'relaxA', label: 'relax edge +1' },
        { id: 'relaxB', label: 'relax edge +6' },
        { id: 'next', label: 'next pop' },
      ],
      [
        { id: 'key', label: 'new key' },
        { id: 'bucket' },
      ],
      [
        ['last = 8', 'B0 drained'],
        ['9', 'B1'],
        ['14', 'B3'],
        ['9', 'first nonempty bucket'],
      ],
    ),
    highlight: { active: ['relaxA:bucket', 'relaxB:bucket'], found: ['next:key'] },
    explanation: 'Dijkstra with nonnegative edges pops vertices in nondecreasing distance. That is exactly the monotone property radix heaps require.',
  };

  yield {
    state: radixGraph('Relaxed distances go into bit-distance buckets'),
    highlight: { active: ['last', 'b1', 'b3', 'e-last-b1', 'e-last-b3'], compare: ['b2'] },
    explanation: 'A newly relaxed distance is compared to the last popped distance, not to every other queued item. The bucket number is derived from the highest differing bit.',
  };

  yield {
    state: labelMatrix(
      'Redistribution cost',
      [
        { id: 'scan', label: 'scan bucket' },
        { id: 'min', label: 'find min' },
        { id: 'move', label: 'move entries' },
        { id: 'amortized', label: 'amortized' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'why' },
      ],
      [
        ['bucket size', 'only when opened'],
        ['new last', 'tightens bucket ranges'],
        ['to lower buckets', 'bit distance decreases'],
        ['bounded by word bits', 'entries move limited times'],
      ],
    ),
    highlight: { found: ['amortized:why', 'move:why'], compare: ['scan:work'] },
    explanation: 'Redistribution can scan a whole bucket, but each move lowers an item into a more precise bucket. The total cost is controlled by key word length.',
    invariant: 'After redistribution, B0 contains the new last key if it is still present.',
  };

  yield {
    state: labelMatrix(
      'Complete routing case study',
      [
        { id: 'graph', label: 'road graph' },
        { id: 'weights', label: 'integer travel times' },
        { id: 'dijkstra', label: 'Dijkstra pops' },
        { id: 'queue', label: 'radix heap' },
      ],
      [
        { id: 'condition', label: 'condition' },
        { id: 'lesson' },
      ],
      [
        ['nonnegative edges', 'monotone distances'],
        ['bounded integers', 'bit buckets apply'],
        ['nondecreasing', 'last never goes backward'],
        ['redistribute buckets', 'avoid comparison heap overhead'],
      ],
    ),
    highlight: { found: ['dijkstra:lesson', 'queue:lesson'], compare: ['weights:condition'] },
    explanation: 'The case-study rule is simple: if shortest-path keys are nonnegative integers and pop order is monotone, a radix heap may beat a comparison heap.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bucket layout') yield* bucketLayout();
  else if (view === 'dijkstra pop') yield* dijkstraPop();
  else throw new InputError('Pick a radix-heap view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The bucket layout view shows the radix heap from the inside: a small variable called last (the most recently extracted key) and a row of buckets numbered B0 through BW, where W is the word size. Active highlights mark the bucket being inspected or redistributed. Found highlights mark the item confirmed as the next minimum. Compare highlights mark buckets or entries used as contrast.',
        { type: 'callout', text: 'A radix heap is legal only because extracted keys move forward; without monotonicity the bucket order lies.' },
        {
          type: 'note',
          text: 'B0 is special. It holds keys exactly equal to last and can be popped with no scanning. Every other bucket covers a power-of-two range relative to last.',
        },
        'The Dijkstra pop view shows how shortest-path relaxations feed into the bucket structure. Watch how a newly relaxed distance lands in a bucket determined by its highest differing bit from last, not by comparison against other queued distances.',
        {
          type: 'bullets',
          items: [
            'At each frame, identify which bucket changed and why.',
            'When redistribution fires, trace where each item moves and confirm that the new bucket index is lower than the old one.',
            'Check that last never decreases -- that is the monotone invariant the entire structure depends on.',
          ],
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dijkstra settles vertices in nondecreasing distance order. Once distance 8 is settled, no future settled distance can be 7. The priority queue already knows a lower bound on every future extraction, yet a comparison heap ignores that bound and pays O(log n) per operation anyway.',
        {
          type: 'quote',
          text: 'If the sequence of extracted minima is monotone, the priority queue is doing unnecessary work maintaining a total order it will never query out of sequence.',
          attribution: 'Ahuja, Mehlhorn, Orlin, Tarjan -- Faster Algorithms for the Shortest Path Problem (1990)',
        },
        'A radix heap exists to exploit this monotone property. It groups integer keys into a small number of buckets based on their bit-level distance from the last extracted key, replacing per-operation comparisons with word-level operations and lazy redistribution.',
        {
          type: 'note',
          text: 'The precondition is strict: keys must be nonnegative integers, and every inserted key must be >= the last extracted key. Dijkstra with nonnegative edge weights satisfies both by construction.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard tool is a binary min-heap. It handles any comparable key, supports insert and extract-min in O(log n), and needs no assumptions about key ordering or type.',
        {
          type: 'bullets',
          items: [
            'Binary heap: O(log n) insert, O(log n) extract-min, any comparable key.',
            'Unsorted array: O(1) insert, O(n) extract-min, any comparable key.',
            'Bucket queue: O(1) insert, O(C) empty-slot scan, integer keys in 0..C.',
          ],
        },
        'For Dijkstra on road graphs with millions of vertices, the binary heap works but spends most of its time on sift-up and sift-down operations that maintain a total order the algorithm never actually needs. Distances are popped in nondecreasing order by construction -- the heap is proving something already guaranteed.',
        'A bucket queue with one slot per possible distance avoids comparisons entirely, but if edge weights reach into the millions, the array is enormous and extract-min may scan thousands of empty slots.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The binary heap wastes work: it maintains a total order among all queued keys even though Dijkstra only ever asks for the minimum, and that minimum is always >= the previous one. Every edge relaxation pays O(log n) for an invariant stronger than what the algorithm requires.',
        'The bucket queue wastes space: it allocates one slot per possible distance value. With 32-bit integer weights, that is 4 billion slots. Even if most are empty, scanning past them on extract-min costs O(C) worst case, where C is the maximum edge weight.',
        {
          type: 'diagram',
          text: 'Binary heap:     too many comparisons, no monotone exploit\n                     |\nBucket queue:    too much space, O(C) empty-slot scan\n                     |\n                 THE WALL\n                     |\nRadix heap:      O(W+1) buckets, bit-relative ranges, lazy redistribution',
          label: 'The tradeoff gap radix heaps fill',
        },
        'The wall is a choice between paying O(log n) per operation for generality the workload does not need, or paying O(C) space for precision the workload does not need yet. A radix heap uses only W+1 buckets (where W is the word size, typically 32 or 64) and defers precision until it is needed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The heap maintains a variable last (initially 0) and an array of W+1 buckets. Bucket 0 holds keys equal to last. Bucket i (for i >= 1) holds keys whose XOR with last has its most significant set bit at position i-1.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/RadixHeap1.png', alt: 'Radix heap bucket ranges increasing by powers of two', caption: 'Radix heap buckets get wider by powers of two, so distant keys stay coarse until extraction advances last. Source: Wikimedia Commons, RadixHeap1.png, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:RadixHeap1.png' },
        {
          type: 'code',
          language: 'javascript',
          text: 'function bucketIndex(key, last) {\n  if (key === last) return 0;\n  const diff = key ^ last;           // XOR: which bits differ?\n  return 1 + Math.floor(Math.log2(diff)); // 1 + position of highest set bit\n}',
        },
        {
          type: 'note',
          text: 'The XOR trick is the core mechanism. Two keys that differ only in low bits land in low buckets (narrow range, close to last). Keys that differ in a high bit land in high buckets (wide range, far from last).',
        },
        'Insert: verify key >= last, compute the bucket index, append the item. No comparisons against other queued items. O(1).',
        'Extract-min: if B0 is nonempty, remove and return any item (all have key == last). If B0 is empty, find the lowest nonempty bucket Bk, scan Bk to find its minimum key m, set last = m, then redistribute every item in Bk into buckets computed relative to the new last. After redistribution, m sits in B0. Return it.',
        {
          type: 'bullets',
          items: [
            'Step 1, last = 8: insert keys 8, 9, 10, 14; buckets become B0={8}, B1={9}, B2={10}, B3={14}.',
            'Step 2, last = 8: extract-min from B0; return 8, and B0 becomes empty.',
            'Step 3, last moves 8 -> 9: B0 is empty, open B1, find min = 9, redistribute B1, and return 9.',
            'Step 4, last moves 9 -> 10: open B2, find min = 10, and redistribute {10,14} under last = 10.',
            'Step 5, last = 10: B0={10}, B2={14}; return 10 before the wider bucket is needed.',
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one monotone invariant: every stored key is >= last, and last never decreases.',
        {
          type: 'bullets',
          items: [
            'B0 safety: every key in B0 equals last, which is the global minimum among stored keys. Extracting any B0 item is correct.',
            'Bucket ordering: if Bk is the first nonempty bucket, every key in Bk has its highest differing bit at position k-1. Every key in a higher bucket Bj (j > k) differs from last at a more significant bit, so it must be larger than every key in Bk.',
            'Redistribution preserves the invariant: the new last is the minimum of Bk, which is >= the old last. All remaining items in Bk have key >= new last, so they can be re-bucketed under the new last without violating monotonicity.',
          ],
        },
        {
          type: 'quote',
          text: 'The XOR of a key with last encodes how far the key is from the current lower bound in bit-significance space. The most significant set bit of that XOR is a coarse distance measure that respects integer ordering.',
          attribution: 'Intuition behind the bucket assignment rule',
        },
        'The key insight is that redistribution does not sort -- it refines. A coarse bucket is split into finer buckets only when the proof boundary (last) advances far enough to make the finer distinctions meaningful. This lazy refinement is why the structure avoids O(log n) per operation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Insert: O(1) worst case and amortized, using XOR, most-significant-bit lookup, and append.',
            'Extract-min when B0 is nonempty: O(1), because every item in B0 has key equal to last.',
            'Extract-min with redistribution: O(bucket size) for that opening, amortized O(log C) moves per item where C is the maximum key difference.',
            'Space: O(n + W), storing n items plus W+1 buckets for the word size.',
          ],
        },
        'The amortized bound comes from tracking how many times each item moves between buckets. Each redistribution lowers an item into a bucket with a smaller index. An item starts in bucket at most W and ends in bucket 0, so it can be redistributed at most W times total across its lifetime.',
        {
          type: 'note',
          text: 'For Dijkstra with n vertices, m edges, and maximum edge weight C: total cost is O(m + n log C). With 32-bit weights, log C <= 32, so every vertex pays at most 32 bucket moves across its entire life in the queue.',
        },
        'Contrast with a binary heap: Dijkstra costs O(m log n) with a binary heap. For dense graphs where m is close to n^2, the radix heap saves a factor of log n / log C. For sparse road graphs where m is roughly n, the saving is still meaningful when n is millions and C is bounded by word size.',
        {
          type: 'code',
          language: 'text',
          text: 'n = 1,000,000 vertices, 32-bit weights:\n  Binary heap:  ~20 comparisons per operation  (log2 1M ~ 20)\n  Radix heap:   ~32 bucket moves per item TOTAL (over all operations)\n  \nn = 1,000,000,000 vertices:\n  Binary heap:  ~30 comparisons per operation\n  Radix heap:   still 32 bucket moves per item total',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Road network routing: millions of intersections, nonnegative integer travel times in seconds or milliseconds. The monotone property holds by Dijkstra, and edge weights fit in 32 bits.',
            'Graph preprocessing: contraction hierarchies and similar techniques run many Dijkstra queries during offline preprocessing. Shaving constant factors off each query compounds over millions of runs.',
            'Discrete-event simulation: when timestamps are integer ticks and events only schedule into the future, the queue is monotone by construction.',
            'SSSP with bounded weights: if the maximum edge weight C is small, the radix heap degenerates to a few active buckets and behaves like a fast bucket queue without the space penalty.',
          ],
        },
        {
          type: 'quote',
          text: 'The radix heap is not a better priority queue. It is a priority queue that trades generality for speed on the exact workload shape that Dijkstra produces.',
          attribution: 'Design principle',
        },
        'The practical gain is most visible when profiling shows that sift-up and sift-down dominate a Dijkstra workload. Replacing O(log n) comparisons with O(1) inserts and bounded redistribution removes that bottleneck without changing the algorithm.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Negative edge weight: relaxation can produce key < last, so the item lands in the wrong bucket and extract-min can return the wrong value.',
            'Floating-point keys: XOR on floats is meaningless for ordering, so bucket assignment is invalid.',
            'Decrease-key workloads: A* or potentials can modify queued keys; use duplicate inserts and stale-entry skipping instead.',
            'Arbitrary key range: keys wider than the machine word grow the bucket count and make most-significant-bit lookup less direct.',
            'Non-monotone usage: the invariant is violated, and the heap can produce wrong results silently.',
          ],
        },
        'The most dangerous failure is silent: if a caller inserts a key below last (due to a bug, overflow, or negative edge), the heap does not crash. It places the item in a bucket based on the XOR, which may be a high bucket. The item is then returned late or never, producing wrong results without an error.',
        {
          type: 'note',
          text: 'Production implementations should assert key >= last on every insert. A failed assertion is better than a silently wrong shortest-path tree.',
        },
        'Duplicate entries from lazy decrease-key (insert new distance, skip stale on pop) work correctly but increase the constant factor. Each stale entry still costs bucket moves and scan time before being discarded.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'The radix heap was introduced by Ahuja, Mehlhorn, Orlin, and Tarjan in 1990 as part of a family of faster shortest-path algorithms. The two-level variant for even better bounds appears in the same paper.',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Ahuja, Mehlhorn, Orlin, Tarjan. "Faster Algorithms for the Shortest Path Problem." Journal of the ACM, 1990. https://ise.ncsu.edu/wp-content/uploads/sites/9/2016/02/ShortestPath.pdf',
            'Priority queue survey: Mehlhorn and Sanders. "Algorithms and Data Structures: The Basic Toolbox," Chapter 6. https://people.mpi-inf.mpg.de/~mehlhorn/ftp/Toolbox/PriorityQueues.pdf',
            'Implementation reference: the LEDA library (Library of Efficient Data types and Algorithms) includes a radix heap used in its shortest-path routines.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Dijkstra, because it supplies the monotone-distance proof that makes radix heaps legal.',
            'Prerequisite: Binary Heap, because it is the comparison baseline radix heaps improve upon.',
            'Alternative: Fibonacci Heap, with O(1) amortized decrease-key for general keys; better theory, worse practice.',
            'Alternative: Pairing Heap, simpler than Fibonacci with strong empirical performance for general keys.',
            'Extension: van Emde Boas Tree, another integer-key structure with O(log log U) operations but O(U) space.',
            'Extension: Two-level radix heap, which reduces amortized cost further for very large key ranges.',
          ],
        },
      ],
    },
  ],
};
