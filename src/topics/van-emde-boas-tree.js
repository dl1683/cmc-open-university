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
  const U = 16;
  const sqrtU = Math.sqrt(U);
  const numClusters = sqrtU;
  const minKey = 2;
  const maxKey = 14;

  yield {
    state: vebGraph('Store bounded integer keys by recursively splitting U'),
    highlight: { active: ['root', 'summary', 'e-root-summary'], found: ['min', 'max'] },
    explanation: `A van Emde Boas tree assumes keys are integers in a fixed universe U=${U}. It stores global min=${minKey} and max=${maxKey} directly, then recursively tracks which of ${numClusters} high-order clusters contain low-order keys.`,
    invariant: `Every key x is decomposed into high(x) = floor(x / ${sqrtU}) for the cluster and low(x) = x mod ${sqrtU} for the position inside that cluster.`,
  };

  const keys = [2, 5, 9, 14];
  const highOf = (k) => Math.floor(k / sqrtU);
  const lowOf = (k) => k % sqrtU;
  const labelsByRow = keys.map((k) => [String(highOf(k)), String(lowOf(k))]);

  yield {
    state: labelMatrix(
      `For U=${U}, sqrt(U)=${sqrtU}`,
      keys.map((k) => ({ id: `x${k}`, label: `key ${k}` })),
      [
        { id: 'high', label: 'high cluster' },
        { id: 'low', label: 'low offset' },
      ],
      labelsByRow,
    ),
    highlight: { active: ['x5:high', 'x5:low', 'x14:high'], compare: ['x2:low'] },
    explanation: `A key splits into high and low pieces. For U=${U}, key ${maxKey} lives in cluster ${highOf(maxKey)} at offset ${lowOf(maxKey)}. The same rule recurses inside the cluster.`,
  };

  yield {
    state: vebGraph('Summary says which clusters are nonempty'),
    highlight: { active: ['summary', 'c0', 'c1', 'c2', 'c3', 'e-summary-c0', 'e-summary-c1', 'e-summary-c2', 'e-summary-c3'], compare: ['root'] },
    explanation: `The summary is itself a smaller van Emde Boas tree over ${numClusters} cluster ids. It answers: which cluster should I visit next? This is how successor and predecessor skip empty ranges in a universe of ${U}.`,
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
    explanation: `Each recursive step shrinks U=${U} to roughly sqrt(U)=${sqrtU}, so the depth is log log ${U} = ${Math.log2(Math.log2(U))}. This is universe-sensitive, not n-sensitive.`,
  };
}

function* successorQuery() {
  const query = 6;
  const sqrtU = 4;
  const queryHigh = Math.floor(query / sqrtU);
  const queryLow = query % sqrtU;
  const nextCluster = 2;
  const nextClusterMin = 1;
  const answer = nextCluster * sqrtU + nextClusterMin;

  yield {
    state: labelMatrix(
      `Successor of ${query} with keys {2,5,9,14}`,
      [
        { id: 'step1', label: `split ${query}` },
        { id: 'step2', label: `cluster ${queryHigh}` },
        { id: 'step3', label: 'summary successor' },
        { id: 'answer', label: 'combine' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'result', label: 'result' },
      ],
      [
        [`high=${queryHigh} low=${queryLow}`, `look in cluster ${queryHigh}`],
        ['max low is 1', 'no local successor'],
        [`next nonempty cluster after ${queryHigh}`, `cluster ${nextCluster}`],
        [`high ${nextCluster} + low min ${nextClusterMin}`, `key ${answer}`],
      ],
    ),
    highlight: { active: ['step2:result', 'step3:result'], found: ['answer:result'] },
    explanation: `Successor first tries the same cluster ${queryHigh} where key ${query} lives. If the cluster has no larger low value, the summary finds the next nonempty cluster ${nextCluster}, and that cluster's minimum completes the answer: key ${answer}.`,
  };

  yield {
    state: vebGraph('The query skips entire empty key ranges'),
    highlight: { active: ['summary', 'c1', 'c2', 'e-summary-c2'], removed: ['c0'], found: ['c2'] },
    explanation: `The summary is the skip index. Instead of scanning ${query + 1}, then ${query + 2}, then ${answer}, the structure jumps from cluster ${queryHigh} to cluster ${nextCluster} and takes cluster ${nextCluster}'s minimum.`,
    invariant: `If a cluster is absent from summary, every key in that cluster's range of ${sqrtU} values is absent.`,
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
    explanation: `van Emde Boas trees achieve O(log log U) predecessor queries -- a theory landmark. In production, B-trees, radix trees, skip lists, or bitsets often win unless the universe (here U=${sqrtU * sqrtU}) and workload fit very well.`,
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
    explanation: `The right lesson is not that vEB replaces every ordered set. It shows how integer keys let you beat comparison-tree O(log n) by achieving O(log log U) -- using the universe of ${sqrtU * sqrtU} itself as structure.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The universe-split view treats an integer key as two coordinates. The high part chooses a cluster, the low part chooses the position inside that cluster, and the summary records which clusters are nonempty.',
        {type: 'image', src: './assets/gifs/van-emde-boas-tree.gif', alt: 'Animated walkthrough of the van emde boas tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Ordered sets need operations beyond membership. Schedulers, simulators, packet queues, and event systems often need the next key after x, which is the successor operation.',
        {
          type: 'callout',
          text: 'A van Emde Boas tree wins by treating an integer key as geography: high bits choose the region, low bits choose the local position.',
        },
        'Balanced search trees answer predecessor and successor for arbitrary comparable keys in O(log n). A van Emde Boas tree exists for the narrower case where keys are integers from a fixed universe, so the key bits can guide the search.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious ordered-set structure is a balanced binary search tree. It stores only the keys present and works for strings, tuples, and any objects with a comparison function.',
        'A second obvious structure is a bitset over the universe. It gives O(1) membership and fast word-level scans for dense small universes, but it needs one bit for every possible key.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A comparison tree ignores integer structure. It learns that 1,000,000 is before 1,000,001 by comparison even though the binary representation already contains shared high bits and nearby low bits.',
        'A bitset fails when the universe is huge and sparse. A 32-bit universe needs 2 to the 32 bits, or 512 MB, even if only 1000 keys are present.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is recursive universe decomposition. For universe size U, split each key into high(x) and low(x), each from a universe of about sqrt(U).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/VebDiagram.svg', alt: 'Example van Emde Boas tree with clusters and auxiliary structure', caption: 'The diagram shows the recursive split: a root stores min and max, clusters store local keys, and aux tracks nonempty clusters. Source: Wikimedia Commons, Dcoetzee, public domain.'},
        'The high part selects a cluster, and the low part is stored inside that cluster. A summary vEB tree stores the ids of nonempty clusters, so successor can skip empty regions instead of scanning them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores min and max directly. If the tree is empty, insertion sets both; if a new key is smaller than min, it swaps with min so the direct minimum remains available.',
        'For the remaining key, insertion computes high and low. If the chosen cluster was empty, its id is inserted into the summary, then the low value is inserted into the cluster.',
        'Successor first handles keys below min. Otherwise it looks for a larger low value in the same cluster; if none exists, it asks the summary for the next nonempty cluster and returns that cluster minimum recombined with the new high part.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The main invariant is exact placement: every stored key other than the direct min is represented in exactly one cluster chosen by high(x), at local position low(x). The summary contains a cluster id if and only if that cluster is nonempty.',
        'The successor proof follows from contiguous ranges. If a larger low value exists in the same cluster, it is smaller than anything in a later cluster; otherwise every remaining candidate must be in a later nonempty cluster, and the summary finds the first such cluster.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time recurrence is T(U) = T(sqrt(U)) + O(1), which solves to O(log log U). A 64-bit universe shrinks by bit length as 64, 32, 16, 8, 4, 2, so the recursion depth is small.',
        'The classic space cost is the tax. Allocating arrays of clusters can make space proportional to U, while lazy allocation saves memory but adds pointers, allocation overhead, and worse cache locality.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'vEB trees are most useful as a theoretical and specialized integer predecessor structure. They fit bounded integer priorities, simulation event times, packet or timer wheels with known ranges, and teaching word-RAM algorithms.',
        'Production systems often choose a radix heap, bucket queue, bitset, B-tree, or adaptive radix tree instead. Those structures may lose the clean O(log log U) result but win on memory layout, concurrency, or disk locality.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The structure is wrong for arbitrary comparable keys. Strings and custom objects do not naturally split into fixed high and low integer parts unless a stable bounded encoding already exists.',
        'It can also lose on ordinary machines despite the asymptotic headline. Pointer chasing, cache misses, large sparse universes, and complicated deletion can make a balanced tree faster for realistic input sizes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let U = 16, so keys run from 0 to 15 and sqrt(U) = 4. Key 14 splits into high = floor(14 / 4) = 3 and low = 14 mod 4 = 2.',
        'Insert keys 2, 3, 9, and 14. The direct min is 2 and max is 14; key 3 goes to cluster 0 low 3, key 9 to cluster 2 low 1, and key 14 to cluster 3 low 2, while the summary stores cluster ids 0, 2, and 3.',
        'To find successor(6), split 6 into high 1 and low 2. Cluster 1 is empty, so the summary successor of 1 is 2; cluster 2 has min low 1, and recombining gives 2 * 4 + 1 = 9.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Peter van Emde Boas, Preserving order in a forest in less than logarithmic time, FOCS 1975, DOI https://doi.org/10.1109/SFCS.1975.26. MIT 6.851 lecture notes on predecessor structures give a modern teaching path through the same idea.',
        'Study balanced binary search trees and bitsets first. Then study radix tries, X-fast tries, Y-fast tries, fusion trees, word-RAM algorithms, integer sorting, and cache-aware layouts to see how integer structure and memory behavior trade places.',
      ],
    },
  ],
};
