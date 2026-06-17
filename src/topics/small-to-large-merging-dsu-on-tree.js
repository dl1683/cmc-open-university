// Small-to-large merging: always move the smaller container into the larger one,
// so each element changes containers only O(log n) times.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'small-to-large-merging-dsu-on-tree',
  title: 'Small-to-Large Merging & DSU on Tree',
  category: 'Data Structures',
  summary: 'Merge smaller maps or sets into larger ones so subtree statistics, component metadata, and offline tree queries avoid repeated full copying.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['merge sets', 'subtree colors case study'], defaultValue: 'merge sets' },
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

function mergeGraph(title) {
  return graphState({
    nodes: [
      { id: 'parent', label: 'node', x: 4.8, y: 0.8, note: 'answer here' },
      { id: 'big', label: 'big set', x: 2.4, y: 2.8, note: 'size 7' },
      { id: 'small1', label: 'small', x: 5.0, y: 2.8, note: 'size 2' },
      { id: 'small2', label: 'tiny', x: 7.2, y: 2.8, note: 'size 1' },
      { id: 'swap', label: 'swap', x: 2.4, y: 5.3, note: 'keep largest' },
      { id: 'insert', label: 'insert', x: 5.0, y: 5.3, note: 'move entries' },
      { id: 'stats', label: 'stats', x: 7.5, y: 5.3, note: 'update answer' },
    ],
    edges: [
      { id: 'e-parent-big', from: 'parent', to: 'big' },
      { id: 'e-parent-small1', from: 'parent', to: 'small1' },
      { id: 'e-parent-small2', from: 'parent', to: 'small2' },
      { id: 'e-big-swap', from: 'big', to: 'swap' },
      { id: 'e-small1-insert', from: 'small1', to: 'insert' },
      { id: 'e-small2-insert', from: 'small2', to: 'insert' },
      { id: 'e-insert-stats', from: 'insert', to: 'stats' },
    ],
  }, { title });
}

function treeCaseGraph(title) {
  return graphState({
    nodes: [
      { id: 'u', label: 'u', x: 4.8, y: 0.8, note: 'subtree' },
      { id: 'a', label: 'red', x: 2.2, y: 2.8, note: 'child A' },
      { id: 'b', label: 'blue', x: 5.0, y: 2.8, note: 'child B' },
      { id: 'c', label: 'red', x: 7.5, y: 2.8, note: 'child C' },
      { id: 'map', label: 'map', x: 3.2, y: 5.3, note: 'color -> count' },
      { id: 'distinct', label: 'distinct', x: 6.5, y: 5.3, note: 'answer' },
      { id: 'keep', label: 'keep', x: 8.5, y: 5.3, note: 'big child' },
    ],
    edges: [
      { id: 'e-u-a', from: 'u', to: 'a' },
      { id: 'e-u-b', from: 'u', to: 'b' },
      { id: 'e-u-c', from: 'u', to: 'c' },
      { id: 'e-a-map', from: 'a', to: 'map' },
      { id: 'e-b-map', from: 'b', to: 'map' },
      { id: 'e-c-map', from: 'c', to: 'map' },
      { id: 'e-map-distinct', from: 'map', to: 'distinct' },
      { id: 'e-keep-map', from: 'keep', to: 'map' },
    ],
  }, { title });
}

function* mergeSets() {
  yield {
    state: mergeGraph('Always merge the smaller container into the larger one'),
    highlight: { active: ['big', 'small1', 'small2', 'insert', 'e-small1-insert', 'e-small2-insert'], found: ['stats'] },
    explanation: 'Small-to-large merging keeps the largest child container and inserts every entry from smaller containers into it. The contents are the same, but the total movement becomes much smaller.',
    invariant: 'An element only moves when its destination container at least doubles in size.',
  };

  yield {
    state: labelMatrix(
      'Why the amortization works',
      [
        { id: 'first', label: 'first move' },
        { id: 'second', label: 'second move' },
        { id: 'third', label: 'third move' },
        { id: 'limit', label: 'limit' },
      ],
      [
        { id: 'container', label: 'container size' },
        { id: 'meaning' },
      ],
      [
        ['1 -> 2', 'doubles'],
        ['2 -> 4', 'doubles'],
        ['4 -> 8', 'doubles'],
        ['at most n', 'O(log n) moves'],
      ],
    ),
    highlight: { active: ['first:container', 'second:container', 'third:container'], found: ['limit:meaning'] },
    explanation: 'If an item moves from the smaller set into the larger set, its new container has at least twice as many items as before. That doubling can happen only logarithmically many times.',
  };

  yield {
    state: mergeGraph('Swapping pointers avoids copying the largest set'),
    highlight: { active: ['swap', 'big', 'e-big-swap'], compare: ['small1', 'small2'], found: ['stats'] },
    explanation: 'Implementation detail matters: pick the largest child set as the destination, then merge the smaller sets into it. Do not allocate a fresh set and copy everything at every node.',
  };

  yield {
    state: labelMatrix(
      'Where the trick appears',
      [
        { id: 'dsu', label: 'Union-Find' },
        { id: 'tree', label: 'DSU on tree' },
        { id: 'maps', label: 'component maps' },
        { id: 'logs', label: 'segment merges' },
      ],
      [
        { id: 'container', label: 'container' },
        { id: 'lesson' },
      ],
      [
        ['component parent', 'union by size'],
        ['subtree set', 'answer all nodes'],
        ['metadata map', 'move small map'],
        ['segments', 'merge compaction'],
      ],
    ),
    highlight: { active: ['dsu:lesson', 'tree:lesson'], found: ['maps:lesson'], compare: ['logs:lesson'] },
    explanation: 'The idea is broader than one named algorithm. Whenever repeated merges dominate runtime, ask whether smaller-to-larger movement gives a doubling bound.',
  };
}

function* subtreeColorsCaseStudy() {
  yield {
    state: treeCaseGraph('Subtree distinct colors by merging child maps'),
    highlight: { active: ['u', 'a', 'b', 'c', 'map', 'e-a-map', 'e-b-map', 'e-c-map'], found: ['distinct'] },
    explanation: 'For each tree node, compute a map from color to frequency for its subtree. The answer for the node is the number of keys in that map.',
    invariant: 'After processing node u, its kept map contains exactly the colors in u\'s subtree.',
  };

  yield {
    state: labelMatrix(
      'Subtree merge at node u',
      [
        { id: 'big', label: 'largest child' },
        { id: 'smallA', label: 'small child A' },
        { id: 'smallB', label: 'small child B' },
        { id: 'self', label: 'node u color' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'answer' },
      ],
      [
        ['reuse map', 'base'],
        ['insert colors', 'update counts'],
        ['insert colors', 'update counts'],
        ['add u', 'distinct size'],
      ],
    ),
    highlight: { active: ['big:action', 'smallA:action', 'smallB:action'], found: ['self:answer'] },
    explanation: 'The node keeps the largest child map, inserts entries from smaller child maps, adds its own color, then records the map size as the subtree distinct-color answer.',
  };

  yield {
    state: treeCaseGraph('Keep the big child map alive and discard small maps'),
    highlight: { active: ['keep', 'map', 'e-keep-map'], compare: ['a', 'b', 'c'], found: ['distinct'] },
    explanation: 'DSU-on-tree implementations often call the largest child the heavy child. Its data is kept; smaller children are folded in and then their temporary containers can be released.',
  };

  yield {
    state: labelMatrix(
      'Compare tree-query tools',
      [
        { id: 'small', label: 'small-to-large' },
        { id: 'hld', label: 'HLD' },
        { id: 'mo', label: 'Mo on tree' },
        { id: 'euler', label: 'Euler + BIT' },
      ],
      [
        { id: 'best', label: 'best for' },
        { id: 'constraint' },
      ],
      [
        ['subtree maps', 'offline DFS'],
        ['path queries', 'segment tree'],
        ['offline path stats', 'toggle logic'],
        ['add/query order', 'invertible ops'],
      ],
    ),
    highlight: { active: ['small:best', 'small:constraint'], compare: ['hld:best', 'mo:best'], found: ['euler:best'] },
    explanation: 'Small-to-large is strongest for aggregating rich subtree metadata. It is not the same tool as Heavy-Light Decomposition, which targets path queries.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'merge sets') yield* mergeSets();
  else if (view === 'subtree colors case study') yield* subtreeColorsCaseStudy();
  else throw new InputError('Pick a small-to-large view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Tree problems often ask for rich metadata at every subtree: distinct colors, frequency maps, sets of labels, pending query ids, or component summaries. The naive answer rebuilds a container for every node and repeats work across overlapping subtrees.',
        'Small-to-large merging exists to stop that repeated copying. It keeps the largest child container and folds smaller containers into it, so individual elements are not moved over and over without bound.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is postorder DFS where each node allocates a fresh map, copies all child maps into it, adds itself, and records the answer. It is simple and can become quadratic on a chain of large subtrees.',
        'Another tempting approach is to use Union-Find because the phrase "DSU on tree" suggests it. That name is misleading. Most DSU-on-tree solutions do not call find or union; they reuse the smaller-into-larger amortization idea.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated movement. If a large map is copied into fresh parent maps again and again, the same entries pay for many ancestors.',
        'The second wall is that subtree metadata is often too rich for prefix sums alone. A single counter may be easy, but a map from color to count or label to frequency needs careful container movement.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Always move the smaller container into the larger one. If an element moves, its destination container has at least twice as many elements as its previous container.',
        'That doubling is the proof. An element can live in containers of size 1, 2, 4, 8, and so on only O(log n) times before reaching size n. The total movement becomes manageable.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The containers can be sets, hash maps, ordered maps, heaps, vectors, or custom frequency tables. The destination pointer matters: reuse the largest child container instead of allocating a fresh one and copying everything.',
        'For tree queries, the DFS frame typically stores the kept container, temporary child containers, the current node payload, and the answer for the current subtree. If containers are mutable, ownership and reference discipline matter.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The merge-sets view shows the rule that matters: the smaller container is consumed by the larger container. Do not focus on the labels alone. The educational point is that each moved element lands in a container at least twice as large as before.',
        'The subtree-colors view shows the tree-query pattern. The largest child map stays alive, smaller child maps are folded into it, the current node adds its own color, and the answer is read from the kept map. That is why the method can compute every subtree answer without rebuilding every subtree from scratch.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For subtree aggregation, recursively process children. Pick the largest child container as the destination. For each smaller child, iterate through its entries and insert them into the destination. Then add the current node payload and record the answer for this node.',
        'In the distinct-colors case, each leaf starts with its own color. Each parent keeps the largest child set, inserts colors from smaller child sets, inserts its own color, and records set.size.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Suppose an element is moved from one set into another. Because it came from the smaller set, the destination has size at least as large as its old set, so the element\'s container size at least doubles.',
        'A size can double from 1 to at most n only O(log n) times. That is why arbitrary-looking merges become efficient when the direction is always smaller into larger.',
        'This proof is worth learning because it appears far outside tree problems. Whenever work is charged to an item that moves only into a structure at least twice as large, the item can be charged only logarithmically many times. The technique is an amortization pattern, not a trick for one contest problem.',
      ],
    },
    {
      heading: 'Implementation review',
      paragraphs: [
        'A good implementation makes ownership explicit. The kept container belongs to the current subtree after the merge. Smaller containers should not be queried afterward unless the code deliberately keeps snapshots. In languages with mutable maps, accidental aliasing can create wrong answers that look like algorithmic mistakes.',
        'The second review point is update semantics. If the answer needs counts, insert means increment. If it needs distinct values, insert means set membership. If it needs the most frequent color, the merge must update both color counts and a secondary frequency summary. Small-to-large controls movement, but the statistic still has to be maintained correctly.',
        'The third review point is recursion shape. Deep trees can overflow the call stack in JavaScript, and object-heavy maps can dominate runtime even when the amortized movement proof is correct. Production-style implementations may need iterative DFS, coordinate compression, typed arrays, or explicit pool reuse.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'If inserts into the destination container cost O(log n), subtree set merging often costs O(n log^2 n). With hash maps or integer-frequency arrays, it can be closer to O(n log n) or O(n) for movement plus update costs.',
        'The exact bound depends on the container, value compression, ordered iteration, and custom statistics. The idea controls movement; the container controls per-entry update cost.',
        'For teaching, it is useful to separate movement count from update cost. The small-to-large rule bounds how often each element is moved. It does not promise that each move is constant time. A balanced tree, hash table, sorted vector, or frequency array changes the final bound.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for subtree metadata, component metadata, offline tree queries, frequency maps, distinct-value counts, and situations where repeated merge cost dominates the algorithm.',
        'It is the right mental neighbor of Union-Find union by size, but it also appears in log compaction, segment merging, and any system where rewriting the largest structure repeatedly is the real cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when queries are online, path-oriented, or require updates between answers. Heavy-Light Decomposition, Euler Tour Tree, Link-Cut Tree, or another dynamic structure may fit better.',
        'It also fails if the implementation merges in arbitrary order or keeps references to discarded small containers after their entries have moved. The destination is now the authoritative container.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Given a tree where every node has a color, compute for every node how many distinct colors appear in its subtree. The naive solution walks the whole subtree for every node. Small-to-large does one postorder DFS and reuses the largest child set at every parent.',
        'Virtual Tree LCA Compression is the adjacent tool when the query gives a small marked subset and asks for DP only on the induced subtree. Rerooting DP is the adjacent tool when every possible root needs an answer. Small-to-large keeps rich metadata while walking the whole rooted tree.',
        'A complete implementation also has to decide what happens after recording an answer. Some variants keep containers for ancestors; others clear temporary data to save memory. That choice depends on whether later queries need the exact subtree container or only the stored answer.',
      ],
    },
    {
      heading: 'Common mistakes',
      paragraphs: [
        'The most common mistake is merging large into small because it is more convenient in the code. That destroys the doubling proof. Another mistake is treating the heavy child idea as the same as Heavy-Light Decomposition. Both notice large subtrees, but HLD decomposes paths while DSU-on-tree aggregates subtree data.',
        'A third mistake is forgetting that root choice changes subtree meaning. Small-to-large answers are for the rooted tree used by the DFS. If the problem asks for rerooted answers, this technique may be only one part of the solution, not the whole algorithm.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: USACO Guide small-to-large merging at https://usaco.guide/plat/merging, CP-Algorithms DSU section on merging sets at https://cp-algorithms.com/data_structures/disjoint_set_union.html, Codeforces DSU on tree explanation at https://codeforces.com/blog/entry/67696, and SOI smaller-to-larger notes at https://soi.ch/wiki/smaller-to-larger/. Study Rerooting DP: All Roots Tree DP, Virtual Tree LCA Compression, Union-Find, Tree Traversals, Heavy-Light Decomposition, Mo\'s Algorithm, and Euler Tour Tree next.',
      ],
    },
  ],
};
