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
      heading: 'What it is',
      paragraphs: [
        'A radix heap is a priority queue for monotone integer keys. It assumes every key inserted is at least the last extracted key. Under that condition, it buckets keys by bit distance from the last extracted key and supports efficient extract-min for shortest-path workloads.',
        'The structure is not a general replacement for Binary Heap. It is specialized for integer priorities and nondecreasing extract order, which is why Dijkstra with nonnegative edge weights is the canonical use case.',
        'The main idea is to spend comparisons only when a bucket becomes relevant. Until then, keys sit in coarse buckets determined by the most significant bit where they differ from the current lower bound.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Maintain last, the most recently extracted key. Bucket 0 stores keys equal to last. Higher buckets store ranges grouped by the most significant bit of key xor last. Insertion computes that bucket and appends the item.',
        'If bucket 0 is empty, find the first nonempty bucket, scan it to find the smallest key, set last to that key, and redistribute every item in that bucket according to the new last. Then bucket 0 contains at least one extractable minimum.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost depends on the machine word size or key range. Items may be redistributed several times, but each redistribution moves them to a lower, more precise bucket relative to the new last. This gives strong bounds for integer shortest-path variants.',
        'The engineering tradeoff is specialization. You need integer keys, monotone inserts relative to extract-min, and careful handling of overflow or large key ranges. For arbitrary priorities, a binary, pairing, or Fibonacci heap is safer.',
        'A useful implementation habit is to assert the monotone precondition at insertion time during testing. If a caller ever inserts a key below last, the bucket invariant is broken and future extract-min results can be wrong.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Radix heaps are used in algorithm engineering for shortest paths, routing, timetable search, graph preprocessing, and systems where priorities are bounded nonnegative counters or distances.',
        'A complete case study is road-network routing with integer travel times. Dijkstra pops settled distances in nondecreasing order. Relaxed distances are never below the settled distance, so the radix heap condition holds.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A radix heap is not the same as a bucket queue with one bucket per distance. It uses bit ranges and redistribution to handle large key spaces compactly. It is also not valid if later insertions can have keys below last.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'References: Ahuja, Mehlhorn, Orlin, and Tarjan, Faster Algorithms for the Shortest Path Problem, at https://ise.ncsu.edu/wp-content/uploads/sites/9/2016/02/ShortestPath.pdf, and Mehlhorn priority queue notes at https://people.mpi-inf.mpg.de/~mehlhorn/ftp/Toolbox/PriorityQueues.pdf. Study Dijkstra, Binary Heap, Pairing Heap, Fibonacci Heap, and van Emde Boas Tree next.',
      ],
    },
  ],
};
