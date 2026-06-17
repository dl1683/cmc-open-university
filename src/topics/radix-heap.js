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
      heading: 'Why This Exists',
      paragraphs: [
        'A comparison priority queue treats priorities as opaque values. That is the right default when keys can arrive in any order. Some workloads reveal more structure: every extracted key is at least the previous extracted key, and every new key is an integer no smaller than that last extracted key.',
        'Dijkstra with nonnegative integer edge weights has exactly this shape. Once the algorithm settles distance 8, no later unsettled distance can be below 8. The queue can use that monotone lower bound instead of comparing every key through a binary heap.',
        'A radix heap exists for this narrow case. It trades generality for buckets based on bits, then spends scanning work only when a bucket becomes the next possible source of the minimum.',
      ],
    },
    {
      heading: 'The Baseline And The Wall',
      paragraphs: [
        'The reasonable baseline is a binary heap. It works for any comparable priority and gives O(log n) insert and extract-min. For shortest paths, that means every edge relaxation pays comparison-heap overhead even though distances only move forward.',
        'A second baseline is a bucket queue with one bucket per possible distance. That can be fast when distances are small. It becomes wasteful when the key range is large, sparse, or unknown, because the structure may need to scan empty distance buckets.',
        'The wall is using either too little information or too much space. A radix heap keeps a small number of bit-range buckets and relies on the last extracted key to make those ranges meaningful.',
      ],
    },
    {
      heading: 'Core Layout',
      paragraphs: [
        'The structure stores last, the most recently extracted key. Every item in the heap must have key >= last. Bucket 0 stores keys equal to last.',
        'For every other key, compute key xor last and find the most significant set bit. That bit chooses the bucket. Keys that differ from last only in low bits go into low buckets. Keys that differ in a higher bit go into coarser higher buckets.',
        'The buckets are relative to last, not absolute distances. When last changes, one opened bucket is redistributed because the bit distances from the new lower bound have changed.',
        'This relative layout is the point most people miss. The heap is not building a calendar of every possible distance. It keeps rough ranges around the only distance that matters now: the last one proved minimal. As that proof boundary moves forward, one rough range is refined just enough to reveal the next exact minimum.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'insert checks the precondition key >= last, computes the bucket from the highest differing bit, and appends the item. The queue does not compare the new key against every other queued key.',
        'extract-min first removes an item from bucket 0 if one exists. If bucket 0 is empty, the heap finds the first nonempty bucket, scans that bucket to find its minimum key, sets last to that minimum, and redistributes every item from that bucket under the new last.',
        'After redistribution, the minimum item from the opened bucket lands in bucket 0. The heap can now return it. Other items from the bucket usually move to lower buckets because last is closer to them than the old lower bound was.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The monotone invariant is the proof. Since no stored key is below last, bucket 0 contains exactly the keys that are equal to the current lower bound. Those keys are safe to extract immediately.',
        'If bucket 0 is empty, the first nonempty bucket contains the smallest possible bit range above last. Any key in a higher bucket differs from last at a more significant bit, so it cannot be smaller than the minimum key found in the first nonempty bucket.',
        'Redistribution restores the invariant for the new last. No key moves below last, and each key is placed according to its new highest differing bit. The heap has not sorted the bucket; it has made the next exact minimum visible.',
      ],
    },
    {
      heading: 'Cost And Behavior',
      paragraphs: [
        'With W-bit unsigned keys, the heap has W + 1 buckets. insert is O(1) word work after the monotone check. extract-min may scan a bucket, but an item can only be redistributed a limited number of times as its highest differing bit drops.',
        'A useful way to remember the cost is total movement, not one unlucky operation. One extract can scan a large bucket. Across a sequence, each item pays for a bounded number of bucket moves tied to key word length or key range.',
        'For shortest paths with fixed-width integer distances, this can beat a comparison heap by avoiding O(log n) comparisons per queue operation. If priorities are arbitrary objects, floating-point values, or can move backward, the radix heap model no longer applies.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Radix heaps fit shortest-path engines with nonnegative integer weights: road routing, timetable search after integer time discretization, graph preprocessing, and workloads where priorities are bounded counters.',
        'They also fit event or simulation queues when time only moves forward and timestamps are integer ticks. The structure is most attractive when the key range is too large for one bucket per value but the monotone property is guaranteed by the algorithm.',
        'They are especially worth considering when profiling shows comparison-heap work dominating a monotone workload. The gain is not mystical; it comes from replacing repeated comparisons with word operations, append-only buckets, and occasional bucket scans whose total movement is bounded.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'The main failure mode is violating key >= last. A negative edge in Dijkstra, an event scheduled in the past, or an overflowed distance can put a key into a bucket that no longer represents the true order.',
        'Duplicate entries need a policy. Many shortest-path implementations avoid decrease-key by inserting a new distance and skipping stale entries when popped. That works only if stale detection is explicit.',
        'Large integer ranges and arbitrary-precision keys increase the bucket count or the cost of finding the most significant differing bit. A binary heap is safer when the word-size assumption is false or the monotone proof is not local to the caller.',
      ],
    },
    {
      heading: 'Concrete Example',
      paragraphs: [
        'Let last = 8. Key 8 goes to bucket 0 because key xor last is 0. Key 9 differs in the lowest bit, so it goes to bucket 1. Keys 10 and 11 go to bucket 2. Keys 12 through 15 go to bucket 3.',
        'If bucket 0 is empty and bucket 1 contains 9, extraction sets last to 9 and returns 9. If bucket 1 were empty and bucket 2 contained 10 and 11, the heap would scan bucket 2, choose 10 as the new last, redistribute 10 and 11, then pop 10 from bucket 0.',
        'In Dijkstra, this means a relaxed vertex with distance 14 can sit in a coarse bucket while distance 9 is still pending. The queue does not need to know exactly how 14 compares with every other future key yet. It only needs to preserve enough order to expose the next settled distance when the lower buckets empty.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Dijkstra first because it supplies the monotone-distance proof. Study Binary Heap to understand the general comparison baseline. Study Pairing Heap and Fibonacci Heap for priority queues that support general keys and decrease-key. Study van Emde Boas Tree for another integer-key structure with a different space and universe-size tradeoff.',
        'References: Ahuja, Mehlhorn, Orlin, and Tarjan, Faster Algorithms for the Shortest Path Problem, https://ise.ncsu.edu/wp-content/uploads/sites/9/2016/02/ShortestPath.pdf, and Mehlhorn priority queue notes, https://people.mpi-inf.mpg.de/~mehlhorn/ftp/Toolbox/PriorityQueues.pdf.',
      ],
    },
  ],
};
