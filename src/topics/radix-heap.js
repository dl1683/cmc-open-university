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
  const lastKey = 8;
  const bucketCount = 4; // B0 through B3 shown
  const heapTypes = 4; // binary, fibo, pairing, radix in comparison

  yield {
    state: radixGraph('Buckets are relative to the last extracted key'),
    highlight: { active: ['last', 'b0', 'b1', 'b2', 'b3'], compare: ['redistribute'] },
    explanation: `A radix heap assumes extracted keys never decrease. It groups integer keys by the most significant bit where the key differs from the last extracted key (last = ${lastKey} in this example).`,
    invariant: `Every stored key is at least last (${lastKey}); Dijkstra with nonnegative edges satisfies this monotone condition.`,
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
    explanation: `B0 contains keys equal to last (${lastKey}) and can be popped directly. The ${bucketCount} buckets shown cover ranges whose exact minimum is found when that bucket becomes the first nonempty bucket.`,
  };

  yield {
    state: radixGraph('Opening a bucket finds its minimum and redistributes'),
    highlight: { active: ['b2', 'redistribute', 'pop', 'e-bucket-redist', 'e-redist-pop'], compare: ['b3'] },
    explanation: `When B0 is empty, find the first nonempty bucket among the ${bucketCount} shown, scan it to find its minimum, set last to that minimum, and redistribute the bucket entries under the new last.`,
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
    explanation: `Radix heaps are specialized. Compared to the other ${heapTypes - 1} heap types shown, they buy speed by using integer bits and monotonicity instead of comparison-tree ordering.`,
  };
}

function* dijkstraPop() {
  const lastKey = 8;
  const edgeWeightA = 1;
  const edgeWeightB = 6;
  const costRows = 4; // scan, min, move, amortized

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
    explanation: `Dijkstra with nonnegative edges pops vertices in nondecreasing distance. After popping dist ${lastKey}, relaxing edges +${edgeWeightA} and +${edgeWeightB} produces keys ${lastKey + edgeWeightA} and ${lastKey + edgeWeightB} -- both >= last.`,
  };

  yield {
    state: radixGraph('Relaxed distances go into bit-distance buckets'),
    highlight: { active: ['last', 'b1', 'b3', 'e-last-b1', 'e-last-b3'], compare: ['b2'] },
    explanation: `A newly relaxed distance is compared to the last popped distance (${lastKey}), not to every other queued item. The bucket number is derived from the highest differing bit between the key and ${lastKey}.`,
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
    explanation: `Redistribution can scan a whole bucket, but each move lowers an item into a more precise bucket. The ${costRows} cost rows show that the total cost is controlled by key word length.`,
    invariant: `After redistribution, B0 contains the new last key (was ${lastKey}) if it is still present.`,
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
    explanation: `The case-study rule is simple: if shortest-path keys are nonnegative integers (like edges +${edgeWeightA} and +${edgeWeightB} from dist ${lastKey}) and pop order is monotone, a radix heap may beat a comparison heap.`,
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
        'Read last as the key most recently extracted from the priority queue. A priority queue returns the smallest key next; a radix heap is a specialized priority queue for nondecreasing integer keys.',
        { type: 'callout', text: 'A radix heap is legal only because extracted keys move forward; without monotonicity the bucket order lies.' },
        'Buckets are measured relative to last. B0 holds keys equal to last, and higher buckets hold keys whose binary representation first differs from last at a more significant bit.',
        'The safe inference is monotonicity. When Dijkstra with nonnegative edges pops distance 8, every future distance inserted is at least 8, so no hidden smaller key can appear behind last.',
      
        {type: 'image', src: './assets/gifs/radix-heap.gif', alt: 'Animated walkthrough of the radix heap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dijkstra shortest paths repeatedly extracts the smallest tentative distance and then inserts larger or equal distances produced by nonnegative edge weights. That pop sequence is monotone, meaning it never decreases.',
        'A binary heap handles any comparable key, but it pays O(log n) per operation to maintain a general order. A radix heap uses the monotone integer property to replace most comparisons with bucket placement.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a binary min-heap. It is simple, general, and gives O(log n) insert and extract-min.',
        'A plain bucket queue is another attempt for integer distances. It gives cheap inserts when the maximum key range is small, but one bucket per possible distance is too much space for large integer ranges.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The binary heap maintains more order than Dijkstra needs. The algorithm only needs the next minimum, and the next minimum is known to be at least the previous one.',
        'The bucket queue maintains too much precision too early. Allocating one slot per distance value wastes memory and can scan many empty buckets when distances are sparse.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store keys in coarse buckets based on the most significant bit where key differs from last. Farther keys stay coarse until last advances near them.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/RadixHeap1.png', alt: 'Radix heap bucket ranges increasing by powers of two', caption: 'Radix heap buckets get wider by powers of two, so distant keys stay coarse until extraction advances last. Source: Wikimedia Commons, RadixHeap1.png, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:RadixHeap1.png' },
        'When B0 is empty, open the lowest nonempty bucket, find its minimum, set last to that minimum, and redistribute only that bucket under the new last.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For integer key x, compute diff = x xor last. If diff is 0, x goes to B0; otherwise it goes to bucket 1 plus the index of the highest set bit in diff.',
        'Extract-min first returns from B0 if possible. If B0 is empty, the heap scans bucket headers to find the lowest nonempty bucket, scans that bucket to find its minimum m, sets last = m, and re-buckets the scanned entries.',
        'After redistribution, the minimum key is in B0. Other entries from the opened bucket move to lower or equal precision buckets relative to the new last.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on every stored key being at least last. Under that invariant, any key in B0 equals last and is a global minimum.',
        'If Bk is the lowest nonempty bucket, no higher bucket can contain a smaller key because a higher most-significant differing bit means the key is farther above last. Scanning Bk finds the true next minimum.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert is O(1) for fixed-width machine integers: compute a highest-set-bit index and append to a bucket. B0 extraction is O(1).',
        'Redistribution scans a whole bucket, but an item can move down through at most W bucket levels for W-bit keys. That gives O(nW) total redistribution movement across many operations, often written as O(n log C) for maximum key gap C.',
        'For 32-bit distances, W is at most 32. Doubling the number of queued items does not increase W, while a binary heap adds another comparison level whenever n doubles enough to raise log2 n.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Radix heaps fit Dijkstra on road networks with nonnegative integer travel times. Distances are monotone, weights are bounded machine integers, and priority-queue overhead can dominate large searches.',
        'They can also fit discrete-event simulations where event times are integer ticks and every new event is scheduled at or after the current time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A radix heap is wrong for non-monotone workloads. If a caller inserts key 7 after last is 8, the bucket calculation no longer preserves priority order.',
        'It is also a poor fit for floating-point keys, negative edge relaxations, arbitrary comparators, or workloads that need true decrease-key without lazy duplicate handling.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let last = 8, which is binary 1000. Insert keys 8, 9, 10, and 14. Their xor values with last are 0, 1, 2, and 6, so they go to B0, B1, B2, and B3.',
        'Extract 8 from B0. B0 is now empty, so open the lowest nonempty bucket B1. Its minimum is 9, set last = 9, redistribute B1, and return 9.',
        'Now open the next lowest nonempty bucket when needed. Key 10 is closer to last than key 14, so the redistribution process reveals 10 before 14 without maintaining a full comparison heap.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ahuja, Mehlhorn, Orlin, and Tarjan, Faster Algorithms for the Shortest Path Problem, Journal of the ACM, 1990.',
        'Study Dijkstra first because it supplies monotone extracted distances. Then study binary heaps, bucket queues, Dial\'s algorithm, pairing heaps, Fibonacci heaps, and van Emde Boas trees for the surrounding priority-queue design space.',
      ],
    },
  ],
};