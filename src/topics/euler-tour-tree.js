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
    explanation: 'An Euler tour tree represents a rooted tree by walking each edge down and back up. The resulting visit sequence can be stored in a balanced binary tree.',
    invariant: 'One represented tree corresponds to one cyclic tour sequence.',
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
    explanation: 'Vertices may appear multiple times. The repeated visits are not wasted; they give link and cut operations precise places to split and concatenate the tour.',
  };

  yield {
    state: ettGraph('A balanced tree stores the tour and its metadata'),
    highlight: { active: ['tour', 'balanced', 'aggregate', 'e-tour-balanced', 'e-balanced-agg'], compare: ['finger'] },
    explanation: 'The sequence is stored in a balanced tree such as a treap, splay tree, or red-black tree with split and concatenate operations. Metadata on the sequence can answer component-size or aggregate queries.',
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
    explanation: 'Euler tour trees, link-cut trees, and top trees solve overlapping dynamic-forest problems but optimize different query shapes. ETT is especially natural for connectivity and whole-tree aggregates.',
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
    explanation: 'The public dynamic-forest operations reduce to sequence surgery. Balanced-tree split and concatenate are the primitive moves.',
  };

  yield {
    state: ettGraph('link(B, X) splices two cyclic tours together'),
    highlight: { active: ['b', 'tour', 'balanced', 'finger', 'e-finger-balanced'], found: ['aggregate'] },
    explanation: 'To link two trees, reroot their tours at the chosen endpoints, insert the two directed edge visits, and concatenate the sequences into one balanced tree.',
    invariant: 'link is legal only when the endpoints are in different components.',
  };

  yield {
    state: ettGraph('cut(C, D) removes two directed edge visits'),
    highlight: { active: ['c', 'd', 'e-c-d', 'finger'], removed: ['e-a-b'], compare: ['balanced'] },
    explanation: 'To cut an edge, use stored handles for the two directed occurrences of that edge in the tour. Splitting around them separates the sequence into the two resulting components.',
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
    explanation: 'A network-monitoring system with only tree-shaped active links can maintain connectivity and component sizes online without recomputing DFS after every failure.',
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
      heading: 'What It Is',
      paragraphs: [
        'An Euler tour tree represents each tree in a dynamic forest as a cyclic sequence of vertex visits. The sequence is stored in a balanced binary tree, so the implementation can split a component sequence, concatenate two component sequences, and maintain aggregate metadata over the represented tree.',
        'It is a dynamic data structure, not just a traversal order written into an array. The tour lives inside a sequence tree such as a treap, splay tree, or red-black tree. Link, cut, reroot, connectivity, and component-aggregate operations are expressed as edits or queries on that sequence tree.',
        'The design is strongest when the natural question is about a whole connected component: are two vertices in the same tree, how large is the component, or what aggregate value is stored over the component. Link-Cut Tree is usually the more direct tool for path aggregates; Euler tour trees make the whole tree visible.',
      ],
    },
    {
      heading: 'The Baseline and the Wall',
      paragraphs: [
        'The first dynamic-forest implementation is an adjacency list plus DFS or BFS. Adding an edge between two trees is cheap. Asking whether two vertices are connected can be answered by traversal. Cutting an edge is the painful operation: the cut may split one component into two, and discovering the new components can cost O(n).',
        'Union-Find solves only the incremental half of the problem. It can merge components quickly, but it cannot delete a tree edge and recover the two resulting components. A static Euler-tour array has the opposite problem: it is useful for fixed-tree subtree ranges, but it does not survive link and cut updates without rebuilding.',
        'The wall is that a dynamic forest needs a representation whose own shape can separate and join whole trees. Euler tour trees cross that wall by turning topology changes into balanced-sequence operations.',
      ],
    },
    {
      heading: 'Core Insight and Invariant',
      paragraphs: [
        'Walk each tree edge twice, once in each direction, and keep the resulting visit sequence. That sequence is cyclic: there is no permanent first vertex, only a chosen rotation for convenience. If two vertices belong to the same represented tree, their canonical occurrences live inside the same sequence tree.',
        'The central invariant is one sequence tree per represented component. Each tree edge has two directed occurrences in the tour. Those occurrences act like handles: they identify exactly where a future cut must split. Vertex occurrences carry or point to the metadata needed for component queries.',
        'A balanced sequence tree does not change what the Euler tour means. It only makes position-based surgery fast. Split, concatenate, and reroot preserve the tour interpretation as long as edge occurrences and component roots are updated consistently.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the "tour sequence" view, watch the original tree become a repeated visit sequence. The repeated A and C entries are not visual noise; they are the reason an edge can later be removed by cutting around two directed occurrences.',
        'The balanced-tree and aggregate nodes show the implementation layer. The tour is not usually stored as a flat array because flat arrays make middle splits expensive. The balanced tree stores the same order while carrying metadata such as size, sum, or minimum over a component.',
        'In the "link cut updates" view, read each row as a reduction from a forest operation to sequence surgery. Reroot rotates a cyclic tour. Link concatenates two tours with two new directed edge visits. Cut removes two directed edge visits and leaves two valid tours behind.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'To build the structure for one tree, choose any root, perform an Euler walk, and create sequence nodes for the vertex visits or directed edge events used by the chosen variant. Store those nodes in a balanced tree that supports split by position and concatenate by tree root.',
        'For link(u, v), first verify that u and v are in different components. Reroot the first tour at u and the second tour at v, insert the two directed occurrences for the new edge, and concatenate the pieces into one sequence tree. Component metadata is recomputed by the balanced-tree join logic.',
        'For cut(u, v), use the stored handles for the two directed occurrences of edge (u, v). Split the cyclic sequence around those occurrences, discard the edge tokens, and join the remaining intervals into the two component tours. Connectivity is then a root comparison on the balanced sequence trees.',
      ],
    },
    {
      heading: 'Why It Is Correct',
      paragraphs: [
        'An Euler tour of a tree is connected because the walk can move between any two vertices through tree edges, and every tree edge appears in both directions. If a represented edge is removed, the two directed occurrences are exactly the two places where the walk crosses between the two sides of that edge.',
        'Splitting around those two occurrences separates the tour into the two walks that remain after the edge is gone. Linking works in reverse: if two components are disjoint, inserting the two directed edge occurrences gives a valid walk of the new combined tree.',
        'Aggregates are correct when each represented vertex contributes through a chosen canonical occurrence or through a carefully weighted occurrence scheme. Without that discipline, repeated vertices would double-count component values.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'With a balanced sequence tree, reroot, link, and cut take O(log n). Connectivity is usually O(log n) or O(1) with maintained component-root handles. Component aggregate updates follow the same O(log n) sequence edits, and reading a maintained aggregate at the sequence root is O(1).',
        'The tradeoff is implementation complexity. Vertices may have multiple occurrences, edge handles must survive rotations and splits, and the sequence tree needs careful parent/root bookkeeping. Bugs usually appear as stale handles, wrong canonical occurrences, or aggregates that count repeated visits.',
        'Euler tour trees are less direct for path queries because the sequence exposes an entire component walk, not a preferred path between two vertices. For dynamic path minimum, maximum, or sum queries, Link-Cut Tree or Top Tree Cluster Dynamic Forest may fit better.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'For the tree A with children B and C, and C with child D, one tour is A B A C D C A. The second A is the return from B, the middle C is the return from D, and the final A closes the walk back at the root.',
        'If the edge C-D is cut, the two directed crossings C->D and D->C identify the boundary of the D side. Splitting around them leaves one tour for D and one tour for A-B-C. No DFS is needed to discover that D became its own component.',
        'If a new edge links B to X in another component, reroot the first tour at B, reroot the second at X, insert B->X and X->B, and concatenate. The resulting single sequence tree is the certificate that the components are now connected.',
      ],
    },
    {
      heading: 'Where It Wins and Fails',
      paragraphs: [
        'Euler tour trees win in online forest maintenance: network links that fail and recover, dynamic spanning forests inside larger graph algorithms, component-size dashboards, and algorithms that need fast link, cut, and connectivity while the active structure remains a forest.',
        'They fail as a drop-in answer for fully dynamic general graph connectivity. A non-tree edge can become a replacement edge after a tree edge is cut, and finding such replacements needs extra data structures layered above the forest representation.',
        'They are also the wrong tool when the tree is static. For fixed trees, ordinary Euler entry and exit times, LCA preprocessing, Heavy-Light Decomposition, or Segment Tree ranges are simpler and often faster.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary references: MIT 6.851 Euler tour tree notes at https://courses.csail.mit.edu/6.851/spring07/scribe/lec05.pdf and Dynamic Trees in Practice at https://renatowerneck.wordpress.com/wp-content/uploads/2016/06/tw09-dyntrees-jea.pdf.',
        'Study Link-Cut Tree to compare path-oriented dynamic trees, Splay Tree to understand one common split/concatenate substrate, Top Tree Cluster Dynamic Forest for cluster-based dynamic trees, Tree Traversals for the Euler walk itself, Union-Find for the incremental-only baseline, and Segment Tree for aggregate metadata over ordered sequences.',
      ],
    },
  ],
};
