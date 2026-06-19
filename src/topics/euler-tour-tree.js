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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Euler Tour Tree. A dynamic-forest representation: store each tree as an Euler-tour sequence in a balanced tree, then split and concatenate on link/cut..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An Euler tour tree represents each tree in a dynamic forest as a cyclic sequence of vertex visits. The sequence is stored in a balanced binary tree, so the implementation can split a component sequence, concatenate two component sequences, and maintain aggregate metadata over the represented tree.',
        'It is a dynamic data structure, not just a traversal order written into an array. The tour lives inside a sequence tree such as a treap, splay tree, or red-black tree. Link, cut, reroot, connectivity, and component-aggregate operations are expressed as edits or queries on that sequence tree.',
        'The design is strongest when the natural question is about a whole connected component: are two vertices in the same tree, how large is the component, or what aggregate value is stored over the component. Link-Cut Tree is usually the more direct tool for path aggregates; Euler tour trees make the whole tree visible.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first dynamic-forest implementation is an adjacency list plus DFS or BFS. Adding an edge between two trees is cheap. Asking whether two vertices are connected can be answered by traversal. Cutting an edge is the painful operation: the cut may split one component into two, and discovering the new components can cost O(n).',
        'Union-Find solves only the incremental half of the problem. It can merge components quickly, but it cannot delete a tree edge and recover the two resulting components. A static Euler-tour array has the opposite problem: it is useful for fixed-tree subtree ranges, but it does not survive link and cut updates without rebuilding.',
        'The wall is that a dynamic forest needs a representation whose own shape can separate and join whole trees. Euler tour trees cross that wall by turning topology changes into balanced-sequence operations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Walk each tree edge twice, once in each direction, and keep the resulting visit sequence. That sequence is cyclic: there is no permanent first vertex, only a chosen rotation for convenience. If two vertices belong to the same represented tree, their canonical occurrences live inside the same sequence tree.',
        'The central invariant is one sequence tree per represented component. Each tree edge has two directed occurrences in the tour. Those occurrences act like handles: they identify exactly where a future cut must split. Vertex occurrences carry or point to the metadata needed for component queries.',
        'A balanced sequence tree does not change what the Euler tour means. It only makes position-based surgery fast. Split, concatenate, and reroot preserve the tour interpretation as long as edge occurrences and component roots are updated consistently.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In the "tour sequence" view, watch the original tree become a repeated visit sequence. The repeated A and C entries are not visual noise; they are the reason an edge can later be removed by cutting around two directed occurrences.',
        'The balanced-tree and aggregate nodes show the implementation layer. The tour is not usually stored as a flat array because flat arrays make middle splits expensive. The balanced tree stores the same order while carrying metadata such as size, sum, or minimum over a component.',
        'In the "link cut updates" view, read each row as a reduction from a forest operation to sequence surgery. Reroot rotates a cyclic tour. Link concatenates two tours with two new directed edge visits. Cut removes two directed edge visits and leaves two valid tours behind.',
      ],
    }
  ],
};
