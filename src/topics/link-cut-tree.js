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
      heading: 'Why This Exists',
      paragraphs: [
        'Many tree algorithms assume the topology is fixed. Preprocess parents, depths, subtree ranges, or heavy paths once, then answer queries quickly. That breaks when edges are linked and cut while path queries keep arriving.',
        'A link-cut tree maintains a changing forest online. It can link two trees, cut an existing tree edge, find the root of a node, and answer path aggregates such as maximum edge, minimum value, or sum in amortized O(log n) time.',
        'The price is representation complexity. The tree the user cares about is not stored directly as one ordinary tree. It is represented through preferred paths, and those paths are maintained by auxiliary splay trees.',
      ],
    },
    {
      heading: 'The Baseline And The Wall',
      paragraphs: [
        'The reasonable baseline is a DFS or BFS from one endpoint whenever a path query arrives. That is simple and correct, but one query can scan O(n) nodes. If updates and queries interleave, repeated scans dominate the algorithm.',
        'For static trees, Heavy-Light Decomposition, Euler tours, binary lifting, and segment trees solve many path problems. Their preprocessing depends on stable parent-child relationships. A cut or link can invalidate the numbering or decomposition they rely on.',
        'The wall is storing a path as something searchable while the path itself keeps changing. Link-cut trees solve this by changing the representation around the most recent accesses rather than rebuilding a global decomposition.',
      ],
    },
    {
      heading: 'Core Invariant',
      paragraphs: [
        'A link-cut tree has two layers. The represented forest is the forest users ask about. The auxiliary forest is an implementation layer made of splay trees.',
        'Each represented node has at most one preferred child. Preferred edges form vertex-disjoint paths. Each preferred path is stored as one auxiliary splay tree ordered by depth in the represented tree.',
        'Auxiliary rotations may change parent, left-child, and right-child pointers inside a splay tree. They must not change which represented tree edges exist. This separation is the invariant that keeps the structure understandable.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'access(x) is the central operation. It walks upward through auxiliary roots, splays each one, detaches the old preferred child, and makes the path toward x preferred. After access(x), the represented root-to-x path is exposed in the auxiliary tree rooted at x.',
        'makeRoot(x) exposes x and toggles a lazy reversal flag so x becomes the represented root of its tree. The reversal flag is pushed through the splay tree only when code needs to descend through affected children.',
        'link(x, y) first makes x the root, then attaches x under y if they are in different represented trees. cut(x, y) makes x the root, exposes y, verifies that the edge is the direct represented edge, and deletes it. query(x, y) makes x the root, accesses y, and reads the aggregate stored on the exposed path ending at y.',
        'The implementation discipline is to name the layers in code. Functions that rotate auxiliary trees should not decide represented connectivity. Functions that link and cut represented edges should expose and verify the relevant path first. Without that separation, bugs look like random pointer corruption because one operation silently changes both meanings of parent.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Splay rotations preserve the inorder order of an auxiliary tree. Since that inorder order is path order by represented-tree depth, rotations can rebalance and expose nodes without changing the represented path.',
        'access changes which edges are preferred, but it does not create or delete represented forest edges. Side branches become virtual children. The root-to-x path becomes one auxiliary tree, so a path aggregate can be read from one maintained summary.',
        'link is correct only with the forest guard: x and y must be in different represented trees. cut is correct only after the target edge is exposed and verified as a direct edge. Those guards keep the represented structure acyclic.',
      ],
    },
    {
      heading: 'Cost And Behavior',
      paragraphs: [
        'Each operation is amortized O(log n). A single access can perform many rotations, but splay-tree potential analysis bounds the average cost over a sequence.',
        'The memory footprint is high compared with static tree methods. Each node stores auxiliary children, an auxiliary parent, represented-parent information or path-parent links, aggregate values, and lazy reversal state.',
        'Constant factors matter. Link-cut trees are used when dynamic topology is central enough to pay for complicated pointer code. For a fixed tree, simpler preprocessing usually wins.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'The classic use is dynamic minimum spanning tree maintenance. When a new edge connects two vertices already in the tree, expose the path between them and find the maximum-weight edge. If the new edge is lighter, cut the heavy edge and link the new one.',
        'The structure also fits online tree path problems: dynamic connectivity for forests, changing rooted trees, network designs restricted to forest topology, and competitive-programming problems with link, cut, and path sum or max operations.',
        'Top trees solve a similar family with explicit clusters and user-defined join and split summaries. Link-cut trees expose preferred paths through splay trees; top trees expose a cluster interface that can be easier to extend for some whole-tree aggregates.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'A link-cut tree is the wrong first tool for static trees. Heavy-Light Decomposition, Euler Tour Tree techniques, binary lifting, or a segment tree over a DFS order are easier to implement and debug when topology is fixed.',
        'It also does not solve fully dynamic general graph connectivity by itself. The represented structure is a forest. General graphs need additional machinery to decide which replacement edges preserve connectivity after cuts.',
        'Most implementation bugs come from mixing the two layers. Auxiliary parent pointers are not the same as represented tree parents. Lazy reversal flags must be pushed before directional decisions. Aggregates for noncommutative operations need a clear left-to-right path order.',
        'The other failure is using it without a small test oracle. Because the structure is amortized and pointer-heavy, random link, cut, and query sequences should be checked against a slow forest implementation during development. If the simple oracle disagrees, the bug is usually in expose, lazy reversal, or edge verification.',
      ],
    },
    {
      heading: 'Concrete Example',
      paragraphs: [
        'Suppose the represented tree has path r-a-c-d and a side branch r-b-e. A query from r to d needs the values on r, a, c, and d. access(d) changes preferred edges until that path is stored in one auxiliary splay tree, while b and e remain virtual side branches.',
        'For a dynamic MST step, add an edge between two vertices already connected by the tree. makeRoot(u), access(v), and the aggregate at v can report the heaviest edge on the u-to-v path. If the new edge is lighter, cut that heaviest edge and link the new edge. The forest stays a tree, and the total weight improves.',
        'For teaching, make students trace one access by hand before showing the full data structure. The path that becomes preferred is the user-visible story. The rotations are the maintenance story. Confusing those two stories is why link-cut trees feel harder than they are.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Splay Tree first because link-cut trees inherit both rotations and amortized analysis from splaying. Study Tree Traversals, Heavy-Light Decomposition, Segment Tree, and Euler Tour Tree to understand the static and alternate dynamic baselines. Study Top Tree Cluster Dynamic Forest for a cluster-based dynamic-tree model.',
        'Primary source: Sleator and Tarjan, A Data Structure for Dynamic Trees, https://www.cs.cmu.edu/~sleator/papers/dynamic-trees.pdf.',
      ],
    },
  ],
};
