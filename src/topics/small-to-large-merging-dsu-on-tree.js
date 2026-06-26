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
  const bigSize = 7;
  const small1Size = 2;
  const small2Size = 1;
  const totalElements = bigSize + small1Size + small2Size;

  yield {
    state: mergeGraph('Always merge the smaller container into the larger one'),
    highlight: { active: ['big', 'small1', 'small2', 'insert', 'e-small1-insert', 'e-small2-insert'], found: ['stats'] },
    explanation: `Small-to-large merging keeps the largest child container (size ${bigSize}) and inserts every entry from ${small1Size + small2Size} smaller elements into it. The ${totalElements} total elements end up in one place, but total movement becomes much smaller.`,
    invariant: `An element only moves when its destination container at least doubles in size, so each of the ${totalElements} elements moves at most O(log ${totalElements}) times.`,
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
    explanation: `If an item moves from the smaller set into the larger set, its new container has at least twice as many items as before. With ${totalElements} total elements, that doubling can happen at most O(log ${totalElements}) times per element.`,
  };

  yield {
    state: mergeGraph('Swapping pointers avoids copying the largest set'),
    highlight: { active: ['swap', 'big', 'e-big-swap'], compare: ['small1', 'small2'], found: ['stats'] },
    explanation: `Implementation detail matters: pick the largest child set (size ${bigSize}) as the destination, then merge the ${small1Size} + ${small2Size} smaller entries into it. Do not allocate a fresh set and copy all ${totalElements} elements at every node.`,
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
    explanation: `The idea is broader than one named algorithm. All ${4} rows in the table share the same doubling argument: whenever repeated merges dominate runtime, ask whether smaller-to-larger movement gives an O(log ${totalElements}) bound per element.`,
  };
}

function* subtreeColorsCaseStudy() {
  const childCount = 3;
  const distinctColors = 2;
  const toolCount = 4;

  yield {
    state: treeCaseGraph('Subtree distinct colors by merging child maps'),
    highlight: { active: ['u', 'a', 'b', 'c', 'map', 'e-a-map', 'e-b-map', 'e-c-map'], found: ['distinct'] },
    explanation: `For each tree node, compute a map from color to frequency for its subtree. Node u has ${childCount} children, and the answer is the number of distinct keys (${distinctColors} colors here) in that map.`,
    invariant: `After processing node u and merging all ${childCount} child maps, the kept map contains exactly the colors in u's subtree.`,
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
    explanation: `The node keeps the largest child map, inserts entries from the other ${childCount - 1} smaller child maps, adds its own color, then records the map size (${distinctColors} distinct colors) as the subtree answer.`,
  };

  yield {
    state: treeCaseGraph('Keep the big child map alive and discard small maps'),
    highlight: { active: ['keep', 'map', 'e-keep-map'], compare: ['a', 'b', 'c'], found: ['distinct'] },
    explanation: `DSU-on-tree implementations often call the largest of the ${childCount} children the heavy child. Its data is kept; the remaining ${childCount - 1} smaller children are folded in and then their temporary containers can be released.`,
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
    explanation: `Among the ${toolCount} tree-query tools compared, small-to-large is strongest for aggregating rich subtree metadata like ${distinctColors}-color frequency maps. It is not the same tool as Heavy-Light Decomposition, which targets path queries.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each container holds metadata for a subtree, which means a node and all descendants under the chosen root. The active merge inserts entries from one child container into another.',
        {type: 'image', src: './assets/gifs/small-to-large-merging-dsu-on-tree.gif', alt: 'Animated walkthrough of the small to large merging dsu on tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe rule is size direction. When a smaller container moves into a larger one, every moved entry lands in a container at least twice as large as before.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Tree problems often ask for rich metadata at every subtree: distinct colors, frequency maps, label sets, or offline query ids. A single prefix sum cannot hold that structure.',
        {type: 'callout', text: 'Small-to-large merging is a doubling argument disguised as an implementation detail.'},
        'Small-to-large merging exists to stop the same entries from being copied into fresh containers at many ancestors. It reuses the largest child container and folds smaller ones into it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is postorder DFS where each node creates a fresh map. It copies every child map into that new map, adds the node value, and records the answer.',
        'That code is easy to understand and correct. It also hides copying cost because each ancestor may copy the same descendant entry again.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated movement. On a path-shaped tree, rebuilding every subtree touches about n + (n - 1) + ... + 1 entries.',
        'For n = 100,000, that sum is about five billion entry visits before counting hash-map overhead. The algorithm is doing bookkeeping, not new reasoning.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Always merge the smaller container into the larger container. If an entry moves, the destination size is at least twice its previous container size.',
        'An entry can move through container sizes 1, 2, 4, 8, and so on up to n. That gives at most O(log n) moves per entry.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Process children before the parent. Choose the largest child container as the kept container, merge every smaller child into it, add the current node payload, and read the answer for this subtree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Dsu_disjoint_sets_final.svg/500px-Dsu_disjoint_sets_final.svg.png', alt: 'Disjoint-set forest after several union operations', caption: 'Union by size is the closest named relative: attach the smaller structure to the larger so future work stays shallow. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Dsu_disjoint_sets_final.svg.'},
        'The name DSU on tree is historical. Most implementations do not call find or union; they borrow the smaller-into-larger amortization idea from Union-Find.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is by induction on the tree. Each child container already represents exactly its subtree; merging all child containers and the current node value creates exactly the parent subtree container.',
        'The cost proof charges work to moved entries. Each charged move at least doubles the container size for that entry. No entry can be charged more than floor(log2 n) + 1 times.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With O(1) average hash-map updates, total movement is O(n log n). With ordered maps, updates may cost O(log n), giving O(n log squared n).',
        'The movement bound does not make every implementation fast. JavaScript Map allocation, hashing, object churn, and recursion depth can dominate. Reusing the kept container is part of the algorithm, not polish.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The standard use is computing subtree answers such as distinct colors, most frequent label, or merged query endpoints. It works when an answer can be read from a merged container.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Subtree aggregation is easiest to reason about when ownership flows along directed parent-child edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The same accounting appears in log compaction, segment merging, union-by-size structures, and offline graph routines where rewriting the largest structure repeatedly is the cost to avoid.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for online updates, dynamic trees, path queries, and rerooted answers. A static postorder merge cannot answer a changing query stream by itself.',
        'It also fails when the statistic is not mergeable through container updates. Heavy-Light Decomposition, Euler Tour Trees, Link-Cut Trees, Mo on trees, or rerooting DP may be the right tool instead.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose node 1 has children 2 and 3, and node 2 has children 4 and 5. Colors are 1:A, 2:B, 3:A, 4:C, 5:B, and the task is distinct colors per subtree.',
        'Leaves start as sets: node 3 has {A}, node 4 has {C}, and node 5 has {B}. At node 2, merge one size-1 child set into the other and add B, producing {B, C}; answer[2] = 2.',
        'At node 1, keep node 2s size-2 set, merge node 3s {A}, and add A again. The set is {A, B, C}, so answer[1] = 3. The entry C moved only through growing containers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study USACO Guide small-to-large merging, CP-Algorithms on DSU union by size, Codeforces DSU-on-tree explanations, and SOI smaller-to-larger notes. Read for the doubling proof, not for one template.',
        'Next study Tree Traversals, Union-Find, Heavy-Light Decomposition, Rerooting DP, Euler Tour Trees, Virtual Tree LCA Compression, Mo on Trees, and Hash Map costs.',
      ],
    },
  ],
};
