// Euler tour tree: represent every tree as a balanced sequence of visits.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'euler-tour-tree',
  title: 'Euler Tour Tree',
  category: 'Data Structures',
  summary: 'A dynamic-forest representation: store each tree as an Euler-tour sequence in a balanced tree, then split and concatenate on link/cut.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tour sequence', 'link cut updates'], defaultValue: 'tour sequence' },
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

function ettGraph(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 1.0, y: 1.4, note: 'tree root' },
      { id: 'b', label: 'B', x: 0.3, y: 3.5, note: 'child' },
      { id: 'c', label: 'C', x: 1.7, y: 3.5, note: 'child' },
      { id: 'd', label: 'D', x: 1.7, y: 5.5, note: 'leaf' },
      { id: 'tour', label: 'Euler tour sequence', x: 4.4, y: 2.1, note: 'A B A C D C A' },
      { id: 'balanced', label: 'balanced BST', x: 6.7, y: 2.1, note: 'stores tour' },
      { id: 'aggregate', label: 'tree aggregate', x: 8.6, y: 3.9, note: 'size/sum/connectivity' },
      { id: 'finger', label: 'edge handles', x: 4.4, y: 5.2, note: 'find split points' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'tree edge' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: 'tree edge' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: 'tree edge' },
      { id: 'e-tree-tour', from: 'a', to: 'tour', weight: 'walk edges twice' },
      { id: 'e-tour-balanced', from: 'tour', to: 'balanced', weight: 'store sequence' },
      { id: 'e-balanced-agg', from: 'balanced', to: 'aggregate', weight: 'maintain metadata' },
      { id: 'e-finger-balanced', from: 'finger', to: 'balanced', weight: 'split/concat positions' },
    ],
  }, { title });
}

function* tourSequence() {
  yield {
    state: ettGraph('A tree becomes a cyclic Euler tour sequence'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e-a-b', 'e-a-c', 'e-c-d'], compare: ['tour'] },
    explanation: `An Euler tour tree represents a rooted tree with ${4} vertices by walking each of the ${3} edges down and back up. The resulting visit sequence of ${7} entries can be stored in a balanced binary tree.`,
    invariant: `One represented tree of ${4} nodes corresponds to one cyclic tour sequence of ${7} visits.`,
  };

  yield {
    state: labelMatrix(
      'Tour for A with children B and C, C child D',
      [
        { id: 't0', label: 'A' },
        { id: 't1', label: 'B' },
        { id: 't2', label: 'A' },
        { id: 't3', label: 'C' },
        { id: 't4', label: 'D' },
        { id: 't5', label: 'C' },
        { id: 't6', label: 'A' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['start', 'enter A'],
        ['down edge A-B', 'visit B'],
        ['up edge B-A', 'return A'],
        ['down edge A-C', 'visit C'],
        ['down edge C-D', 'visit D'],
        ['up edge D-C', 'return C'],
        ['up edge C-A', 'return A'],
      ],
    ),
    highlight: { active: ['t1:event', 't2:event', 't4:event', 't5:event'], found: ['t6:meaning'] },
    explanation: `Vertices may appear multiple times across the ${7} tour entries. The repeated visits are not wasted; they give link and cut operations precise places to split and concatenate the tour.`,
  };

  yield {
    state: ettGraph('A balanced tree stores the tour and its metadata'),
    highlight: { active: ['tour', 'balanced', 'aggregate', 'e-tour-balanced', 'e-balanced-agg'], compare: ['finger'] },
    explanation: `The ${7}-element sequence is stored in a balanced tree such as a treap, splay tree, or red-black tree with split and concatenate operations. Metadata on the sequence can answer component-size or aggregate queries over the ${4} represented vertices.`,
  };

  yield {
    state: labelMatrix(
      'ETT versus Link-Cut Tree',
      [
        { id: 'ett', label: 'Euler Tour Tree' },
        { id: 'lct', label: 'Link-Cut Tree' },
        { id: 'hld', label: 'Heavy-Light' },
        { id: 'uf', label: 'Union-Find' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['dynamic connectivity and subtree aggregates', 'path aggregates need extra work'],
        ['dynamic path aggregates', 'harder implementation'],
        ['static path queries', 'topology fixed'],
        ['incremental connectivity', 'cannot cut'],
      ],
    ),
    highlight: { found: ['ett:best', 'lct:best'], compare: ['uf:limit'] },
    explanation: `Comparing ${4} dynamic-forest structures, Euler tour trees, link-cut trees, and top trees solve overlapping problems but optimize different query shapes. ETT is especially natural for connectivity and whole-tree aggregates.`,
  };
}

function* linkCutUpdates() {
  yield {
    state: labelMatrix(
      'Split and concatenate operations',
      [
        { id: 'reroot', label: 'reroot(v)' },
        { id: 'link', label: 'link(u, v)' },
        { id: 'cut', label: 'cut(u, v)' },
        { id: 'connected', label: 'connected(u, v)' },
      ],
      [
        { id: 'sequenceMove', label: 'sequence move' },
        { id: 'result' },
      ],
      [
        ['rotate tour at v', 'v becomes tour start'],
        ['concat tour u + edge + tour v', 'one component'],
        ['split around edge visits', 'two components'],
        ['compare tour roots', 'same balanced tree?'],
      ],
    ),
    highlight: { active: ['link:sequenceMove', 'cut:sequenceMove'], found: ['connected:result'] },
    explanation: `The ${4} public dynamic-forest operations reduce to sequence surgery. Balanced-tree split and concatenate are the primitive moves.`,
  };

  yield {
    state: ettGraph('link(B, X) splices two cyclic tours together'),
    highlight: { active: ['b', 'tour', 'balanced', 'finger', 'e-finger-balanced'], found: ['aggregate'] },
    explanation: `To link two trees, reroot their tours at the chosen endpoints, insert the ${2} directed edge visits, and concatenate the sequences into one balanced tree storing up to ${8} nodes.`,
    invariant: `link is legal only when the endpoints are in different components among the ${4} vertices.`,
  };

  yield {
    state: ettGraph('cut(C, D) removes two directed edge visits'),
    highlight: { active: ['c', 'd', 'e-c-d', 'finger'], removed: ['e-a-b'], compare: ['balanced'] },
    explanation: `To cut the edge C-D, use stored handles for the ${2} directed occurrences of that edge in the ${7}-visit tour. Splitting around them separates the sequence into the two resulting components.`,
  };

  yield {
    state: labelMatrix(
      'Complete dynamic-connectivity case study',
      [
        { id: 'add', label: 'fiber link added' },
        { id: 'fail', label: 'fiber link fails' },
        { id: 'ask', label: 'are sites connected?' },
        { id: 'size', label: 'component size' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['link endpoints', 'O(log n)'],
        ['cut edge handles', 'O(log n)'],
        ['compare tour roots', 'O(log n) or better with handles'],
        ['read aggregate', 'O(1) after update'],
      ],
    ),
    highlight: { found: ['add:cost', 'fail:cost', 'size:cost'], compare: ['ask:operation'] },
    explanation: `A network-monitoring system with only tree-shaped active links can maintain connectivity and component sizes online. All ${4} operations run in O(log n) without recomputing DFS after every failure.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tour sequence') yield* tourSequence();
  else if (view === 'link cut updates') yield* linkCutUpdates();
  else throw new InputError('Pick an Euler-tour-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The "tour sequence" view shows how a rooted tree with four vertices becomes a cyclic visit sequence of seven entries. The "link cut updates" view shows how link, cut, and connectivity operations reduce to splitting and concatenating that sequence inside a balanced tree.',
        {type: 'callout', text: 'Euler tour trees make dynamic forest edits look like sequence surgery: rotate, split, and concatenate tours while component identity stays explicit.'},
        'Active highlights mark the nodes or edges being processed in the current step. Found highlights mark results that are now established: a completed tour, a confirmed connectivity answer, an updated aggregate. Compare highlights point to the structure being contrasted or about to change.',
        'In the matrix frames, each row is a single operation or event. Read them left to right: the sequence move column tells you what happens to the tour, and the result column tells you what the forest gains. The graph frames show the two-layer architecture: the represented tree on the left, the tour and its balanced-tree storage on the right.',
        {type:'image', src: './assets/gifs/euler-tour-tree.gif', alt: 'Animated walkthrough of the euler tour tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems maintain a forest of trees that changes over time. A network gains and loses links. A game map connects and disconnects regions. A compiler builds and modifies dominator trees. In each case, the fundamental questions are the same: are two nodes in the same tree, how large is their component, and what happens when an edge is added or removed?',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Stirling_permutation_Euler_tour.svg/250px-Stirling_permutation_Euler_tour.svg.png',
          alt: 'Euler tour of a tree with directed traversal arcs around the nodes',
          caption: 'An Euler tour turns a tree into a repeated traversal sequence. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Stirling_permutation_Euler_tour.svg',
        },
        'The Euler tour tree, introduced by Henzinger and King in 1999 and refined by Tarjan, answers all of these in O(log n) time per operation. It represents each tree in the forest as a cyclic sequence of vertex visits, stored inside a balanced binary search tree that supports split and concatenate. Topology changes become sequence surgery.',
        'The name comes from Leonhard Euler\'s idea of traversing every edge exactly once. Here the tour visits every directed edge exactly once: each undirected tree edge produces two directed visits, one going down and one going back up. A tree with n vertices and n-1 edges yields a tour of 2n-1 visits.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store the forest as an adjacency list. To check connectivity, run BFS or DFS from one vertex and see if it reaches the other. To add an edge, append it to both adjacency lists. To remove an edge, delete it from both lists and then run a traversal to figure out which vertices ended up in which component.',
        'This works. Connectivity queries cost O(n) in the worst case because the traversal might visit every vertex. Link is O(1). Cut is O(n) because after deleting the edge you need a full traversal to identify the two new components. For a sequence of m operations on a forest of n vertices, the total cost is O(mn).',
        'Union-Find improves the link side: it merges components in near-O(1) amortized time and answers connectivity in near-O(1). But Union-Find cannot cut. Once two components are merged, the data structure has no mechanism to split them apart. If your forest only grows, Union-Find is excellent. If edges can be deleted, it is useless.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The core difficulty is that cutting an edge can split one tree into two, and no pointer-based tree representation makes that split cheap. An adjacency list does not know which vertices are on which side of the deleted edge without a traversal. A parent-pointer tree can walk to the root in O(depth), but splitting the tree at an interior edge still requires relabeling one side.',
        'Static Euler tours solve a different problem. If you flatten a fixed tree into a visit sequence and store it in an array, you can answer subtree queries with range operations. But inserting or deleting an edge in the middle of a flat array costs O(n) to shift elements. The array representation is rigid.',
        'The wall is this: a dynamic forest needs a representation where splitting and joining trees is a cheap structural operation, not an O(n) relabeling or reshuffling. The representation itself must be decomposable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Walk each tree edge twice, once in each direction, and record the sequence of vertex visits. A tree with root A, children B and C, and C\'s child D produces the tour A B A C D C A. This tour has 2n-1 = 7 entries for n = 4 vertices. Every vertex appears at least once; internal vertices appear multiple times because the walk returns through them.',
        'The tour is cyclic. There is no inherent first vertex. A B A C D C A and B A C D C A B encode the same tree with different starting rotations. This cyclic property is what makes reroot possible: to change the root, rotate the tour so the new root\'s occurrence comes first.',
        'Now store this cyclic sequence in a balanced BST that supports split and concatenate (a treap, splay tree, or red-black tree with sequence operations). Each tree edge has exactly two directed occurrences in the tour. Keep a pointer to each occurrence. To cut an edge, split the sequence at those two occurrences. To link two trees, concatenate their tours with two new directed occurrences inserted. The balanced BST guarantees each split and concatenate costs O(log n).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each tree in the forest is stored as a separate balanced BST whose in-order traversal gives the Euler tour. Each node in the balanced BST holds one tour entry: a vertex label, plus optional aggregate data. For every undirected edge (u, v) in the represented tree, the data structure maintains pointers to the two BST nodes representing the directed visits u-to-v and v-to-u.',
        'Connectivity: two vertices u and v are in the same tree if and only if their tour entries live in the same balanced BST. Each BST node can find its root in O(log n) by walking up. If the roots match, u and v are connected.',
        'Reroot(v): find v\'s first occurrence in the tour. Split the cyclic sequence at that position. The piece before v\'s occurrence goes to the end. Concatenate the two halves in the new order. The tour now starts at v, which means v is the new root. Cost: one split plus one concatenate, O(log n).',
        'Link(u, v): u and v must be in different trees. Reroot u\'s tree at u and reroot v\'s tree at v. Create two new BST nodes for the directed visits u-to-v and v-to-u. Concatenate: tour(u) + [u-to-v visit] + tour(v) + [v-to-u visit]. The result is one BST encoding the merged tree. Cost: two reroots plus one concatenate, O(log n).',
        'Cut(u, v): the edge (u, v) must exist. Look up the two stored pointers for the directed visits u-to-v and v-to-u in the BST. Split the tour at these two positions. The middle piece becomes one new tree\'s tour. The outer pieces concatenate to form the other tree\'s tour. Cost: two splits plus one concatenate, O(log n).',
        'Subtree aggregates: each BST node maintains an aggregate (size, sum, min, max) over its subtree in the balanced BST. Because a vertex\'s subtree in the represented tree corresponds to a contiguous range in the tour, the BST\'s subtree aggregate directly answers questions about the represented subtree. Updates propagate in O(log n) during splits and concatenates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three invariants. First, the Euler tour of a tree with n vertices always has exactly 2n-1 entries. Adding an edge between two trees of sizes a and b creates a tour of length (2a-1) + (2b-1) + 2 = 2(a+b) - 1, which is correct for a tree of size a+b. Removing an edge from a tree of size n splits the tour into two pieces whose lengths sum to (2n-1) - 2 = 2(n-1) - 1, but the split distributes them correctly into tours of sizes 2a-1 and 2b-1 where a+b = n.',
        'Second, the tour is cyclic, so any rotation of the sequence represents the same tree with a different root. Reroot does not add or remove entries. It only changes the starting position, which preserves the tour length invariant and all edge occurrences.',
        'Third, the balanced BST preserves the sequence order under split and concatenate. These operations do not reorder elements; they only restructure the tree shape. In-order traversal before and after yields the same sequence (or the intended rearrangement of it). Aggregates are recomputed bottom-up during restructuring, which takes O(log n) because the BST has O(log n) height.',
        'The O(log n) bound for every operation follows from the balanced BST guarantee: split and concatenate on a balanced BST of size m each cost O(log m). The tour has at most 2n-1 entries, so each operation costs O(log n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every operation (link, cut, reroot, connected, subtree aggregate) costs O(log n) time, where n is the number of vertices in the affected component. The constant factor depends on the choice of balanced BST. Splay trees give amortized O(log n) with small constants and no extra per-node metadata. Treaps give expected O(log n) with a random priority per node. Red-black trees give worst-case O(log n) with a color bit per node.',
        'Space is O(n) for the entire forest. Each vertex has one canonical occurrence in the tour. Each edge contributes two directed occurrences. For a forest with n vertices and n-1 edges total, the tour entries sum to 2n-1 across all components. Each BST node stores a vertex label, left/right/parent pointers, and any aggregate fields. The edge-occurrence pointers add two words per edge.',
        'Compared to link-cut trees, Euler tour trees are better at subtree aggregates (a contiguous range in the tour vs. scattered preferred paths) and worse at path aggregates (a path in the represented tree does not correspond to a contiguous range in the tour). If your queries are about whole components or subtrees, ETT is the cleaner tool. If your queries are about root-to-vertex paths, link-cut trees are the direct choice.',
        'Compared to Union-Find, ETT is more expensive per operation (O(log n) vs. near-O(1)) but supports cut. If edges are only added, Union-Find wins. If edges can be deleted, Union-Find cannot help.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dynamic connectivity in networks. A fiber-optic network has tree-shaped active links. When a link fails, the ETT cuts that edge in O(log n) and immediately knows the two resulting components. When a backup link activates, the ETT links the two components. Monitoring dashboards can query component size or any aggregate maintained on the tour.',
        'Offline dynamic connectivity. Holm, de Lichtenberg, and Thorup\'s 2001 algorithm for fully dynamic graph connectivity uses Euler tour trees as the forest representation inside a hierarchical decomposition. Each level of the hierarchy maintains a spanning forest stored as ETTs. The overall algorithm answers connectivity queries in O(log^2 n) amortized time.',
        'Minimum spanning forest maintenance. When a non-tree edge is inserted with weight less than the heaviest edge on the tree path between its endpoints, the old edge is cut and the new edge is linked. ETTs handle the structural updates while a separate mechanism identifies the replacement edge.',
        'Competitive programming. Problems involving dynamic forests with subtree queries (add a value to all vertices in a subtree, query the sum over a subtree) map directly to ETT with lazy propagation on the balanced BST. The implementation is more straightforward than link-cut trees for these specific query shapes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Path aggregates are expensive. Querying the sum or maximum along the path from u to v in the represented tree does not correspond to a contiguous range in the Euler tour. The path visits are interleaved with subtree visits of side branches. Link-cut trees handle path aggregates natively; ETTs require auxiliary structures or accept O(n) per path query.',
        'Implementation complexity is real. A correct ETT requires a balanced BST with split, concatenate, and aggregate maintenance, plus careful bookkeeping of edge-occurrence pointers. Bugs in pointer updates during split and concatenate are common and hard to debug because the tour "looks right" in most test cases but fails on specific rotation orders.',
        'The constant factor matters for small n. For forests with fewer than a few hundred vertices, the adjacency-list-plus-DFS approach is faster in practice because it avoids the overhead of balanced-BST rotations and pointer chasing. ETTs pay off only when n is large enough that O(log n) is meaningfully better than O(n).',
        'No support for general graphs. ETTs represent forests, not arbitrary graphs. If the graph has cycles, you need a higher-level algorithm (like Holm et al.) that maintains a spanning forest and handles non-tree edges separately. The ETT is one component of that algorithm, not a standalone solution for general dynamic connectivity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with a tree of five vertices: A is the root, B and C are children of A, D is a child of C, and E is a child of C. The Euler tour rooted at A is: A B A C D C E C A. That is 2(5)-1 = 9 entries. Store this sequence in a balanced BST. Each undirected edge has two directed occurrences. Edge A-B has occurrences at positions 0-1 (A to B) and 1-2 (B to A). Edge A-C has occurrences at positions 2-3 and 8-0 (wrapping cyclically). Edge C-D has occurrences at positions 3-4 and 4-5. Edge C-E has occurrences at positions 5-6 and 6-7.',
        'Cut edge C-D. Look up the two directed occurrences: the visit C-to-D (between positions 3 and 4) and the visit D-to-C (between positions 4 and 5). Split the tour around these two occurrences. Remove the two directed-edge entries. The piece containing D becomes the tour: D. That is 2(1)-1 = 1 entry, correct for a single vertex. The remaining piece concatenates to: A B A C E C A. That is 2(4)-1 = 7 entries, correct for a tree with 4 vertices. Two balanced BSTs now exist, one for each component.',
        'Link vertices D and E. First, reroot D\'s tour at D. It is already just D, so no change. Reroot E\'s component at E. The current tour is A B A C E C A. Rotate so E comes first: E C A A B A C. Create two directed-edge entries for D-E. Concatenate: D + [D-to-E] + E C A A B A C + [E-to-D]. The result is D E C A A B A C E D, but we can simplify by noting the new tour is: D E C A B A C E D. Wait, let us be precise. The tour of the 4-vertex tree rooted at E after rerooting is E C A B A C E (reading cyclically from E). The concatenation is: [D] + [D-to-E] + [E C A B A C E] + [E-to-D] = D E C A B A C E D. That is 2(5)-1 = 9 entries. Correct.',
        'Query connectivity of B and D. Walk from B\'s BST node to the root of its balanced BST. Walk from D\'s BST node to the root of its balanced BST. After the link operation, both reach the same root. They are connected. Before the link, they would have reached different roots. Cost: O(log 5) for each root-finding walk, which is at most 3 comparisons in a balanced BST of 9 nodes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The Euler tour tree was introduced by Henzinger and King in "Randomized Fully Dynamic Graph Algorithms with Polylogarithmic Time per Operation" (1999). Tarjan refined the approach and connected it to his earlier work on splay trees and link-cut trees. Holm, de Lichtenberg, and Thorup used ETTs as the forest backbone in their deterministic O(log^2 n) dynamic connectivity algorithm (2001).',
        'Prerequisites: balanced BSTs with split and concatenate (study treaps or splay trees first), basic graph traversal (DFS and BFS), and Union-Find (to understand why the incremental-only solution is insufficient). Understanding the static Euler tour for subtree range queries helps build intuition for why the cyclic tour works.',
        'Study next: link-cut trees for path aggregates in dynamic forests, top trees for the most general dynamic-tree interface, and the Holm-de Lichtenberg-Thorup algorithm for fully dynamic connectivity in general graphs. For competitive programming, practice ETT problems that require lazy propagation on the balanced BST (subtree add, subtree sum).',
      ],
    },
  ],
};
