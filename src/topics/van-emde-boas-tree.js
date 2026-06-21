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
      heading: 'Why this exists',
      paragraphs: [
        `Ordered sets need more than membership. A scheduler wants the next timestamp. A simulator wants the next event time. A database index may need predecessor and successor, not just exact lookup. Balanced search trees solve this for arbitrary comparable keys, but they pay O(log n) comparisons because they only learn order by comparing against stored keys.`,
        {
          type: 'callout',
          text: 'A van Emde Boas tree wins by treating an integer key as geography: high bits choose the region, low bits choose the local position.',
        },
        `A van Emde Boas tree exists for a narrower problem: keys are integers drawn from a fixed universe U, usually 0 through U - 1. That extra structure changes the game. Integers have bits. The universe can be split. Empty ranges can be skipped by arithmetic on key parts instead of by comparisons against many stored keys.`,
        `The famous result is O(log log U) time for membership, insert, delete, predecessor, and successor, with minimum and maximum available directly. The bound is universe-sensitive, not n-sensitive. That makes vEB trees a landmark in integer predecessor data structures, even though their classic layout is often too memory-heavy for everyday code.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious ordered-set baseline is a balanced binary search tree. It stores only the n present keys and gives O(log n) search, insert, delete, predecessor, and successor for any comparable key type. If keys are strings, tuples, or arbitrary objects, a comparison tree is the natural tool.`,
        `The wall appears when the keys are machine integers and the universe is known. A comparison tree treats key 1000000 and key 1000001 as opaque values; it learns their relation only by comparison. But integer keys already contain structure. The high bits locate a region. The low bits locate a position inside that region. Empty regions can be summarized. A comparison tree does not use that geography.`,
        `A bitset is the other obvious baseline. For a small dense universe, membership is a bit test and successor can use word scans. The wall is a large sparse universe. A bitset for 64-bit keys is impossible, while a balanced tree gives up integer structure. vEB uses the universe recursively without scanning it linearly.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is recursive universe decomposition. For a universe of size U, split each key x into high(x) and low(x), each drawn from a universe of about sqrt(U). The high part chooses a cluster. The low part is the key inside that cluster. A summary structure records which clusters are nonempty. The summary is itself a smaller vEB tree.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/VebDiagram.svg', alt: 'Example van Emde Boas tree with clusters and auxiliary structure', caption: 'The diagram shows the recursive split: a root stores min and max, clusters store local keys, and aux tracks nonempty clusters. Source: Wikimedia Commons, Dcoetzee, public domain.'},
        `Each node stores its global minimum and maximum directly. That makes empty and one-element nodes cheap, gives O(1) min and max at the current node, and avoids storing the minimum redundantly inside a cluster. The recursive machinery handles the rest.`,
        `The operation depth comes from shrinking U to sqrt(U) at each recursive step. Taking square roots repeatedly halves the number of bits. A 64-bit universe becomes 32 bits, then 16, then 8, then 4, then 2. That is why the time is O(log log U): the recursion follows bit-length, not number of stored keys.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Membership checks the node's min and max first. If x equals either, the answer is immediate. Otherwise, x is split into high and low pieces, and the query recurses into the selected cluster. If the cluster does not exist or is empty, x is absent.`,
        `Insertion also starts with min and max. If the tree is empty, x becomes both. If x is smaller than the current min, the structure swaps x with min so the smallest key remains direct. The remaining x is inserted into its high cluster at low(x). If that cluster was empty, its high index is inserted into the summary first. The summary must contain a cluster id if and only if that cluster has a key.`,
        `Successor shows the design. To find successor(x), first handle x smaller than min: min is the answer. Otherwise split x. If x's cluster has a value larger than low(x), recurse there and combine the same high part with the returned low part. If not, ask the summary for the next nonempty cluster after high(x). The answer is that cluster's minimum, recombined with the new high part. Predecessor mirrors this logic.`,
        `Deletion has the trickiest edge cases. Removing the only key empties the node. Removing min requires finding the next key from the first nonempty cluster and that cluster's minimum, then deleting that low key from the cluster. If a cluster becomes empty, its id leaves the summary. Max is repaired symmetrically.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The universe-split view proves how one integer becomes two coordinates. For U = 16, key 14 becomes cluster 3, offset 2. The same rule recurses inside the cluster. The visual is a map of integer ranges, with each cluster covering a contiguous block of the universe.`,
        `The summary node proves the skip mechanism. It records nonempty clusters, so a successor query does not scan cluster 0, cluster 1, cluster 2, and so on. It asks a smaller ordered set of cluster ids for the next occupied region. If a cluster is absent from the summary, every key in that cluster is absent. That invariant is the reason empty ranges disappear from the search.`,
        `The successor example proves the recombination step. A query for successor of 6 checks cluster 1 because 6 lives there. When cluster 1 has no larger low value, the summary moves to cluster 2. The answer is high 2 plus the minimum low value in cluster 2, giving key 9.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument rests on two invariants. First, each stored key other than the direct min is stored in exactly one cluster determined by high(x), at local position low(x). Second, the summary contains exactly the ids of nonempty clusters. Insert and delete maintain both invariants by updating the cluster and then adding or removing the cluster id in the summary when emptiness changes.`,
        `For successor, the proof splits by cases. If x is below the node's min, min is the answer. If x has a larger low value in its own cluster, that local successor is also the global successor because later clusters are larger and earlier clusters are smaller. If no local successor exists, every key in the current cluster is too small or absent, so the next possible answer is in the next nonempty cluster reported by the summary. The minimum of that cluster is the first key greater than x.`,
        `The time recurrence follows the same decomposition. Each operation does constant work plus one or a small constant number of recursive calls on a universe of size sqrt(U). The solution is O(log log U). The algorithm is fast in theory because it cuts the number of key bits roughly in half at each level.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The classic vEB tree pays heavily in space. A direct implementation allocates an array of sqrt(U) clusters at each node, and total space can be proportional to the universe rather than to stored keys. That is acceptable for small universes and theory, but painful for huge sparse ranges.`,
        `Lazy allocation reduces practical space by creating clusters only when keys arrive, but it adds pointer chasing, allocation overhead, and more complicated deletion. Replacing cluster arrays with hash maps can help sparse universes, but then the implementation inherits hash-table constants and randomized or amortized behavior. The clean asymptotic story becomes an engineering tradeoff.`,
        `Cache behavior is another tax. B-trees and arrays can be cache-friendly because they pack many keys together. A pointer-heavy recursive vEB tree may jump around memory. For dense small universes, a bitset with word-level find-first-set operations can beat vEB. For disk or SSD indexes, wide nodes often matter more than O(log log U).`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `vEB trees win as a concept whenever bounded integer keys and predecessor queries are the center of the problem. They teach how escaping the comparison model changes what is possible. They also explain why word-RAM assumptions matter: constant-time arithmetic and bit operations on key pieces are part of the model.`,
        `Possible use cases include priority queues with bounded integer priorities, discrete-event simulation with bounded tick values, schedulers over small time wheels, packet indexes over fixed-width fields, and teaching integer predecessor structures. Production code may use a bucket queue, radix heap, calendar queue, bitset, B-tree, or trie, but vEB gives the reference point for recursive universe splitting.`,
        `The structure is also a gateway to X-fast tries, Y-fast tries, fusion trees, radix trees, and cache-aware predecessor indexes. Those descendants ask the same question: how can integer bits replace comparison-tree work while controlling space?`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `vEB is the wrong tool for arbitrary comparable keys. Strings, compound objects, locale-dependent ordering, and custom comparators do not naturally split into fixed high and low integer parts. You can map some domains to integers, but if the mapping is unstable or huge, the universe assumption becomes a liability.`,
        `It is also weak for huge sparse universes when implemented directly. A 64-bit key space makes U enormous even if only a few thousand keys are stored. Lazy variants help, but simpler structures may use memory better and run faster. If the workload needs range scans, persistence, disk locality, or concurrent updates, a B-tree or log-structured design may be easier.`,
        `The O(log log U) headline can mislead learners. It is not automatically faster than O(log n). Constants, memory layout, branch behavior, word size, and universe fit decide real performance. A vEB tree with poor locality can lose to a balanced tree on ordinary input sizes. The lesson is that integer structure can beat comparison bounds when the universe and machine model fit.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study binary search trees first to understand the comparison baseline, then heaps for priority queues and bitsets for dense integer universes. After vEB, study radix tries, adaptive radix trees, X-fast and Y-fast tries, fusion trees, integer sorting, word-RAM algorithms, and cache-oblivious layouts.`,
        `Primary sources worth reading are Peter van Emde Boas's "Preserving order in a forest in less than logarithmic time" at https://doi.org/10.1109/SFCS.1975.26 and advanced data-structure lecture notes such as MIT 6.851's predecessor-structure material. The older CWI URL sometimes circulated for this title points to an unrelated paper, so use the DOI or a trusted course copy of the original paper.`,
      ],
    },
  ],
};
