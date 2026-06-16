// Link-cut tree: dynamic trees with preferred paths backed by splay trees.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'link-cut-tree',
  title: 'Link-Cut Tree',
  category: 'Data Structures',
  summary: 'Maintain a forest that changes online: expose preferred paths, link trees, cut edges, and answer path queries in O(log n) amortized time.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['expose path', 'link cut query'], defaultValue: 'expose path' },
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

function representedForest(title) {
  return graphState({
    nodes: [
      { id: 'r', label: 'root r', x: 1.2, y: 1.2, note: 'represented tree' },
      { id: 'a', label: 'a', x: 0.7, y: 3.1, note: 'parent r' },
      { id: 'b', label: 'b', x: 2.1, y: 3.1, note: 'parent r' },
      { id: 'c', label: 'c', x: 0.4, y: 5.0, note: 'parent a' },
      { id: 'd', label: 'd', x: 1.0, y: 6.8, note: 'target' },
      { id: 'e', label: 'e', x: 2.6, y: 5.0, note: 'sibling branch' },
      { id: 'aux1', label: 'aux splay path', x: 5.2, y: 2.0, note: 'preferred path' },
      { id: 'aux2', label: 'virtual children', x: 5.2, y: 4.4, note: 'off path' },
      { id: 'query', label: 'path aggregate', x: 8.2, y: 3.2, note: 'min/max/sum' },
    ],
    edges: [
      { id: 'e-r-a', from: 'r', to: 'a', weight: 'tree edge' },
      { id: 'e-r-b', from: 'r', to: 'b', weight: 'tree edge' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: 'tree edge' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: 'tree edge' },
      { id: 'e-b-e', from: 'b', to: 'e', weight: 'tree edge' },
      { id: 'e-path-aux', from: 'd', to: 'aux1', weight: 'access(d)' },
      { id: 'e-aux-virtual', from: 'aux1', to: 'aux2', weight: 'detach side subtrees' },
      { id: 'e-aux-query', from: 'aux1', to: 'query', weight: 'aggregate path' },
    ],
  }, { title });
}

function* exposePath() {
  yield {
    state: representedForest('Start with an ordinary represented forest'),
    highlight: { active: ['r', 'a', 'c', 'd', 'e-r-a', 'e-a-c', 'e-c-d'], compare: ['b', 'e'] },
    explanation: 'A link-cut tree stores a changing forest. The visible tree edges are the represented forest; the hidden data structure is a set of auxiliary splay trees that store preferred root-to-node paths.',
    invariant: 'The represented forest is acyclic; auxiliary structure may rotate without changing real parent-child reachability.',
  };

  yield {
    state: representedForest('access(d) exposes the root-to-d path'),
    highlight: { active: ['d', 'c', 'a', 'r', 'aux1', 'e-path-aux'], found: ['e-aux-query'], compare: ['aux2'] },
    explanation: 'The access operation repeatedly splays ancestors and changes which child edge is preferred. After access(d), the path from the represented root to d becomes one auxiliary splay tree.',
  };

  yield {
    state: labelMatrix(
      'What access changes',
      [
        { id: 'preferred', label: 'preferred edge' },
        { id: 'splay', label: 'splay root' },
        { id: 'virtual', label: 'virtual child' },
        { id: 'aggregate', label: 'aggregate' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after access(d)' },
      ],
      [
        ['recent query history', 'root-to-d path'],
        ['many auxiliary roots', 'd becomes aux root'],
        ['side branches inline sometimes', 'side branches detached'],
        ['scattered along path', 'stored in one splay tree'],
      ],
    ),
    highlight: { active: ['preferred:after', 'aggregate:after'], compare: ['virtual:after'] },
    explanation: 'Preferred paths are a representation trick. A normal tree path is rearranged into a splay tree so path data can be recomputed after rotations.',
  };

  yield {
    state: labelMatrix(
      'Mental model',
      [
        { id: 'tree', label: 'represented tree' },
        { id: 'aux', label: 'auxiliary tree' },
        { id: 'makeroot', label: 'makeRoot(x)' },
        { id: 'path', label: 'path query' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['the forest users care about', 'changes by link/cut'],
        ['splay tree over a preferred path', 'rotates amortized O(log n)'],
        ['reverse exposed path', 'lazy reversal flag'],
        ['expose endpoints then read aggregate', 'amortized logarithmic'],
      ],
    ),
    highlight: { found: ['aux:cost', 'path:cost'], active: ['makeroot:meaning'] },
    explanation: 'The data structure is best understood as two layers: tree topology for correctness, and splay-maintained path decompositions for speed.',
  };
}

function* linkCutQuery() {
  yield {
    state: labelMatrix(
      'Core operations',
      [
        { id: 'findroot', label: 'findRoot(x)' },
        { id: 'link', label: 'link(x, y)' },
        { id: 'cut', label: 'cut(x, y)' },
        { id: 'query', label: 'query(x, y)' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['access then descend left', 'detect same tree'],
        ['makeRoot(x), attach under y', 'only if separate trees'],
        ['expose edge, delete it', 'edge must exist'],
        ['makeRoot(x), access(y)', 'path is in y aux tree'],
      ],
    ),
    highlight: { active: ['link:move', 'cut:move', 'query:move'], compare: ['link:guard'] },
    explanation: 'Link-cut trees support online topology changes. Each public operation is a short recipe built from access, splay, path reversal, and local pointer edits.',
  };

  yield {
    state: representedForest('Link operation attaches one tree under another'),
    highlight: { active: ['b', 'e', 'e-b-e'], found: ['r'], compare: ['d'] },
    explanation: 'To link x under y, first makeRoot(x) so x has no represented parent from the data structure perspective, then set its parent pointer to y. The forest guard prevents cycles.',
    invariant: 'link(x, y) is legal only when x and y are in different represented trees.',
  };

  yield {
    state: representedForest('Cut operation removes one represented edge'),
    highlight: { active: ['c', 'd', 'e-c-d'], removed: ['e-r-b'], compare: ['aux1'] },
    explanation: 'To cut edge (c, d), expose the c-to-d path so the edge is local in an auxiliary tree, then remove the child pointer. The user sees a forest split; the auxiliary paths are rebuilt lazily by future accesses.',
  };

  yield {
    state: labelMatrix(
      'Where link-cut trees show up',
      [
        { id: 'mst', label: 'dynamic MST' },
        { id: 'network', label: 'network connectivity' },
        { id: 'compiler', label: 'dominators/relinking' },
        { id: 'contest', label: 'online tree paths' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'whyLct', label: 'why LCT fits' },
      ],
      [
        ['replace heavy edges', 'fast path max queries'],
        ['links and failures', 'dynamic forest topology'],
        ['changing parent relations', 'cut and expose paths'],
        ['path sum/min/max under updates', 'amortized O(log n)'],
      ],
    ),
    highlight: { found: ['mst:whyLct', 'contest:whyLct'], compare: ['network:need'] },
    explanation: 'The complete case-study pattern is dynamic MST maintenance: when an edge is added, find the maximum-weight edge on the existing path and cut it if the new edge is better.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'expose path') yield* exposePath();
  else if (view === 'link cut query') yield* linkCutQuery();
  else throw new InputError('Pick a link-cut-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A link-cut tree is a dynamic-tree data structure. It maintains a forest while edges are linked and cut online, and it answers path queries such as path maximum, path minimum, path sum, connectivity, and root finding in amortized logarithmic time.',
        'The important shift from a normal tree is that the stored representation is not the same as the logical tree. Users see a represented forest. Internally, the structure keeps preferred paths, and each preferred path is stored as an auxiliary splay tree.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The access operation is the center of the design. access(x) rewires preferred-child choices so the represented root-to-x path becomes one auxiliary splay tree. Because the auxiliary tree is a splay tree, rotations preserve path order while making the recently accessed node easy to touch again.',
        'Operations are recipes. makeRoot(x) exposes x and flips the path with a lazy reversal flag. link(x, y) makes x a root and attaches it under y. cut(x, y) exposes that edge and deletes a local pointer. query(x, y) makes x the root, accesses y, and reads the aggregate stored at y.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The guarantee is amortized O(log n) per operation, inherited from splay trees. A single operation may rotate a lot, but a sequence of operations is bounded by potential analysis. The implementation is pointer-heavy because each node tracks auxiliary children, represented parent links, path aggregates, and lazy reversal flags.',
        'The data structure is powerful precisely because it separates topology from path representation. That also makes it hard to debug. Most bugs come from mixing represented-tree parent pointers with auxiliary-tree parent pointers, or from forgetting to push a reversal flag before descending.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Link-cut trees appear in dynamic graph algorithms, especially dynamic minimum spanning tree variants, online network connectivity, algorithms that repeatedly reparent trees, and competitive-programming path-query problems where both topology and edge weights change.',
        'A complete case study is dynamic MST maintenance. When a new weighted edge connects two vertices already in the tree, expose the path between them and find the maximum-weight edge. If the new edge is lighter, cut the heavy edge and link the new one. Without a dynamic-tree structure, that path scan can dominate the algorithm.',
        'Top Tree Cluster Dynamic Forest solves a similar dynamic-forest family through explicit clusters and user-defined join/split summaries. Link-cut trees expose preferred paths through splay trees; top trees expose a cluster interface for path and whole-tree aggregates such as diameter.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A link-cut tree is not the right first choice for static trees. Heavy-Light Decomposition, Euler-tour techniques, or a simple DFS order are easier when topology does not change. It also does not magically make arbitrary graph connectivity trivial; the represented structure is a forest, while fully dynamic general graphs require more machinery.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Sleator and Tarjan, A Data Structure for Dynamic Trees, at https://www.cs.cmu.edu/~sleator/papers/dynamic-trees.pdf. Study Top Tree Cluster Dynamic Forest, Euler Tour Tree, Splay Tree, Tree Traversals, Union-Find, Segment Tree, and Dynamic Programming next.',
      ],
    },
  ],
};
