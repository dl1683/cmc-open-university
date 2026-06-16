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
      heading: 'What it is',
      paragraphs: [
        'An Euler tour tree is a dynamic-forest representation. It stores each tree as the sequence produced by an Euler tour, then places that sequence inside a balanced binary tree that supports split and concatenate.',
        'The idea is different from Link-Cut Tree and Top Tree Cluster Dynamic Forest. Link-cut trees expose preferred paths. Euler tour trees expose the whole component as a sequence. Top trees expose balanced clusters. ETT is especially natural for connectivity, component size, and whole-tree aggregates.',
        'The representation is powerful because dynamic tree updates become sequence edits. Instead of relabeling an entire component after every link or cut, the data structure performs a logarithmic number of balanced-tree operations at the boundary points of the changed edge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Walk every tree edge in both directions. The visited vertex sequence becomes a cyclic tour. Store the sequence in a balanced tree with metadata such as component size, sum of vertex weights, or minimum value. Keep handles to the sequence positions representing each directed edge.',
        'To link two trees, reroot their tours at the endpoints and concatenate the tours with the new directed edge visits inserted. To cut an edge, split around the two directed visits and reconnect the remaining pieces into two separate tours.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With a balanced tree supporting split and concatenate, link and cut take O(log n). Connectivity can be answered by checking whether two vertex occurrences belong to the same sequence tree. Component aggregates are maintained as balanced-tree metadata.',
        'The hard implementation details are representation choices. A vertex can appear many times in a tour, so code needs a canonical occurrence for component lookup. Edge handles must remain valid across rotations and sequence splits.',
        'Path aggregates are less direct than component aggregates because a simple Euler sequence represents whole-component traversal, not one root-to-node preferred path. That is the key reason Link-Cut Tree remains valuable beside Euler tour trees.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Euler tour trees are used in dynamic connectivity algorithms, network simplex variants, graph libraries, online forest aggregates, and research systems that maintain components under edge insertions and deletions.',
        'A complete case study is an operations graph whose active topology is a forest. When a link fails, cut its edge occurrences. When a link is restored, link two components. The dashboard can answer whether two sites are connected and how many devices remain in each component without rerunning graph traversal.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
      'An Euler tour tree is not the Euler-tour array used only for static subtree queries, though the intuition is related. The dynamic version needs a balanced sequence data structure. It also does not directly solve fully dynamic general graph connectivity without additional levels and replacement-edge machinery.',
      'For a static tree with many marked-subset queries, Virtual Tree LCA Compression usually wants only Euler entry times and an LCA structure, not a dynamic Euler tour tree. Use the dynamic structure when link and cut updates are the point.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: MIT 6.851 Euler tour tree notes at https://courses.csail.mit.edu/6.851/spring07/scribe/lec05.pdf and Dynamic Trees in Practice at https://renatowerneck.wordpress.com/wp-content/uploads/2016/06/tw09-dyntrees-jea.pdf. Study Top Tree Cluster Dynamic Forest, Virtual Tree LCA Compression, Link-Cut Tree, Splay Tree, Tree Traversals, Union-Find, and Segment Tree next.',
      ],
    },
  ],
};
