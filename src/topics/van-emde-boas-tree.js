// van Emde Boas tree: recursive universe decomposition for integer keys.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'van-emde-boas-tree',
  title: 'van Emde Boas Tree',
  category: 'Data Structures',
  summary: 'A priority dictionary for bounded integers: recursively split the universe into summary and clusters to get O(log log U) operations.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['universe split', 'successor query'], defaultValue: 'universe split' },
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

function vebGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'vEB U=16', x: 4.8, y: 0.9, note: 'min=2 max=14' },
      { id: 'summary', label: 'summary U=4', x: 4.8, y: 2.7, note: 'nonempty clusters' },
      { id: 'c0', label: 'cluster 0', x: 1.0, y: 5.0, note: 'keys 0..3' },
      { id: 'c1', label: 'cluster 1', x: 3.4, y: 5.0, note: 'keys 4..7' },
      { id: 'c2', label: 'cluster 2', x: 6.2, y: 5.0, note: 'keys 8..11' },
      { id: 'c3', label: 'cluster 3', x: 8.8, y: 5.0, note: 'keys 12..15' },
      { id: 'min', label: 'global min 2', x: 1.0, y: 2.0, note: 'stored directly' },
      { id: 'max', label: 'global max 14', x: 8.8, y: 2.0, note: 'stored directly' },
    ],
    edges: [
      { id: 'e-root-summary', from: 'root', to: 'summary', weight: 'which clusters nonempty' },
      { id: 'e-summary-c0', from: 'summary', to: 'c0', weight: '0 present' },
      { id: 'e-summary-c1', from: 'summary', to: 'c1', weight: '1 present' },
      { id: 'e-summary-c2', from: 'summary', to: 'c2', weight: '2 present' },
      { id: 'e-summary-c3', from: 'summary', to: 'c3', weight: '3 present' },
      { id: 'e-root-min', from: 'root', to: 'min', weight: 'fast min' },
      { id: 'e-root-max', from: 'root', to: 'max', weight: 'fast max' },
    ],
  }, { title });
}

function* universeSplit() {
  yield {
    state: vebGraph('Store bounded integer keys by recursively splitting U'),
    highlight: { active: ['root', 'summary', 'e-root-summary'], found: ['min', 'max'] },
    explanation: 'A van Emde Boas tree assumes keys are integers in a fixed universe U. It stores global min and max directly, then recursively tracks which high-order clusters contain low-order keys.',
    invariant: 'Every key x is decomposed into high(x) for the cluster and low(x) for the position inside that cluster.',
  };

  yield {
    state: labelMatrix(
      'For U=16, sqrt(U)=4',
      [
        { id: 'x2', label: 'key 2' },
        { id: 'x5', label: 'key 5' },
        { id: 'x9', label: 'key 9' },
        { id: 'x14', label: 'key 14' },
      ],
      [
        { id: 'high', label: 'high cluster' },
        { id: 'low', label: 'low offset' },
      ],
      [
        ['0', '2'],
        ['1', '1'],
        ['2', '1'],
        ['3', '2'],
      ],
    ),
    highlight: { active: ['x5:high', 'x5:low', 'x14:high'], compare: ['x2:low'] },
    explanation: 'A key splits into high and low pieces. For U=16, key 14 lives in cluster 3 at offset 2. The same rule recurses inside the cluster.',
  };

  yield {
    state: vebGraph('Summary says which clusters are nonempty'),
    highlight: { active: ['summary', 'c0', 'c1', 'c2', 'c3', 'e-summary-c0', 'e-summary-c1', 'e-summary-c2', 'e-summary-c3'], compare: ['root'] },
    explanation: 'The summary is itself a smaller van Emde Boas tree. It answers: which cluster should I visit next? This is how successor and predecessor skip empty ranges.',
  };

  yield {
    state: labelMatrix(
      'Operation costs',
      [
        { id: 'member', label: 'member' },
        { id: 'insert', label: 'insert' },
        { id: 'delete', label: 'delete' },
        { id: 'succ', label: 'successor' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['O(log log U)', 'recurse on sqrt universe'],
        ['O(log log U)', 'update cluster and summary'],
        ['O(log log U)', 'repair min/max cases'],
        ['O(log log U)', 'skip to next cluster'],
      ],
    ),
    highlight: { found: ['succ:reason', 'insert:cost'], compare: ['delete:reason'] },
    explanation: 'Each recursive step shrinks U to roughly sqrt(U), so the depth is log log U. This is universe-sensitive, not n-sensitive.',
  };
}

function* successorQuery() {
  yield {
    state: labelMatrix(
      'Successor of 6 with keys {2,5,9,14}',
      [
        { id: 'step1', label: 'split 6' },
        { id: 'step2', label: 'cluster 1' },
        { id: 'step3', label: 'summary successor' },
        { id: 'answer', label: 'combine' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'result', label: 'result' },
      ],
      [
        ['high=1 low=2', 'look in cluster 1'],
        ['max low is 1', 'no local successor'],
        ['next nonempty cluster after 1', 'cluster 2'],
        ['high 2 + low min 1', 'key 9'],
      ],
    ),
    highlight: { active: ['step2:result', 'step3:result'], found: ['answer:result'] },
    explanation: 'Successor first tries the same cluster. If the cluster has no larger low value, the summary finds the next nonempty cluster, and that cluster minimum completes the answer.',
  };

  yield {
    state: vebGraph('The query skips entire empty key ranges'),
    highlight: { active: ['summary', 'c1', 'c2', 'e-summary-c2'], removed: ['c0'], found: ['c2'] },
    explanation: 'The summary is the skip index. Instead of scanning 7, then 8, then 9, the structure jumps from cluster 1 to cluster 2 and takes cluster 2 minimum.',
    invariant: 'If a cluster is absent from summary, every key in that cluster is absent.',
  };

  yield {
    state: labelMatrix(
      'Where vEB wins and loses',
      [
        { id: 'bounded', label: 'bounded integers' },
        { id: 'sparse', label: 'huge sparse U' },
        { id: 'cache', label: 'cache behavior' },
        { id: 'word', label: 'word-RAM theory' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['fast predecessor', 'O(log log U)'],
        ['many empty clusters', 'space can be painful'],
        ['recursive pointers', 'constants can lose'],
        ['integer universe matters', 'different from comparison trees'],
      ],
    ),
    highlight: { found: ['bounded:effect', 'word:lesson'], compare: ['sparse:lesson', 'cache:effect'] },
    explanation: 'van Emde Boas trees are a theory landmark. In production, B-trees, radix trees, skip lists, or bitsets often win unless the universe and workload fit very well.',
  };

  yield {
    state: labelMatrix(
      'Compare predecessor structures',
      [
        { id: 'bst', label: 'balanced BST' },
        { id: 'heap', label: 'binary heap' },
        { id: 'bitset', label: 'bitset' },
        { id: 'veb', label: 'vEB tree' },
      ],
      [
        { id: 'successor', label: 'successor' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['O(log n)', 'comparison-based'],
        ['not natural', 'min only'],
        ['word scans', 'great for dense small U'],
        ['O(log log U)', 'universe-dependent space'],
      ],
    ),
    highlight: { active: ['veb:successor', 'veb:tradeoff'], compare: ['bst:successor', 'bitset:tradeoff'] },
    explanation: 'The right lesson is not that vEB replaces every ordered set. It shows how integer keys let you beat comparison-tree bounds by using the universe itself as structure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'universe split') yield* universeSplit();
  else if (view === 'successor query') yield* successorQuery();
  else throw new InputError('Pick a van-Emde-Boas-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A van Emde Boas tree is an ordered dictionary for integer keys drawn from a fixed universe U. It supports membership, insert, delete, minimum, maximum, predecessor, and successor. Its famous bound is O(log log U) for most operations.',
        'The structure is not comparison-based. It uses the binary representation of keys and recursively decomposes the universe. That is why its complexity depends on U, the key universe, rather than only on n, the number of stored keys.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores min and max directly. The remaining keys are split into high(x) and low(x). high(x) chooses a cluster; low(x) is the key inside that cluster. A summary structure records which clusters are nonempty. Both cluster and summary are smaller van Emde Boas trees.',
        'For successor(x), the tree first checks whether x has a successor inside its own cluster. If not, the summary finds the next nonempty cluster, and the minimum inside that cluster becomes the successor. Predecessor is symmetric.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The recursive universe size changes from U to roughly sqrt(U), yielding O(log log U) depth. The classic layout has high space overhead if implemented naively because it allocates many clusters. Practical variants allocate lazily or use hash maps for sparse universes.',
        'The min/max special cases matter. If a node has zero or one key, operations should avoid descending. Insert may swap with min so the global minimum stays directly available. Delete must repair min or max by consulting summary and cluster minima.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'van Emde Boas trees are most important as a theoretical predecessor structure and as a gateway to integer data structures. They influence thinking about IP lookup, priority queues with bounded keys, calendar queues, word-RAM algorithms, and fast predecessor search. X-Fast & Y-Fast Tries continue the same story with hashed prefixes and representative buckets; Fusion Tree Word-RAM Predecessor shows the packed-word branch of that family.',
        'A complete case study is a discrete-event simulator with timestamps in a bounded tick range. If events are keyed by small integer time slots, a vEB-style structure can find the next scheduled event faster than a comparison heap in theory, while exposing the engineering tradeoff between asymptotic speed and memory locality.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The O(log log U) headline hides constants, pointer chasing, and space. For dense small universes, a bitset plus word operations may be simpler and faster. For huge sparse universes, a B-tree, radix tree, or skip list may use memory better. The key is matching the data structure to the universe size.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: van Emde Boas, Preserving Order in a Forest in Less Than Logarithmic Time, available via https://ir.cwi.nl/pub/6886. Study Binary Search, Binary Heap, B-Trees, Adaptive Radix Tree, X-Fast & Y-Fast Tries, Fusion Tree Word-RAM Predecessor, and Big-O Growth Rates next.',
      ],
    },
  ],
};
