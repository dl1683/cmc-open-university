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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Expose path" shows the access operation turning a root-to-node path into a single auxiliary splay tree. "Link cut query" shows link, cut, and path-query operations changing the represented forest.',
        'Active (highlighted) nodes and edges mark the preferred path currently being exposed or modified. Compared (dimmed) nodes are side branches detached as virtual children during access. Found (green) markers show the result: the aggregate value read from the exposed path or the new forest edge after a link.',
        'The matrix frames show what changes before and after each operation. Read them as before/after snapshots of the internal state, not as the final answer.',
        'At each frame, ask: which preferred edges changed, which side branches were detached, and what aggregate is now readable from the auxiliary root.',
        {type: 'callout', text: 'A link-cut tree keeps the represented forest stable while constantly reshaping auxiliary splay trees so the path you need becomes searchable.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most tree algorithms assume the topology is fixed. Preprocess parents, depths, subtree sizes, or heavy paths once, then answer queries quickly. That assumption breaks when edges appear and disappear while path queries keep arriving.',
        'A link-cut tree maintains a changing forest online. It supports link (attach one tree under another), cut (remove a tree edge), findRoot (identify which tree a node belongs to), and path aggregates (sum, min, max along a root-to-node path) -- all in amortized O(log n) time per operation.',
        {
          type: 'quote',
          text: 'We introduce a form of self-adjusting binary search tree called the splay tree. [...] The amortized time per operation on a tree of n items is O(log n).',
          attribution: 'Sleator & Tarjan, "Self-Adjusting Binary Search Trees," JACM 1985',
        },
        'The price is representation complexity. The user-visible forest is not stored as an ordinary tree. It is decomposed into preferred paths, and each preferred path is maintained by an auxiliary splay tree. The splay tree is the engine that makes amortized logarithmic cost possible.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is to store the forest as a parent-pointer tree and walk the path from any node to the root whenever a query arrives. To link, set a parent pointer. To cut, clear one. To find the path aggregate, walk up and accumulate. This is simple and correct.',
        'For static trees, stronger tools exist. Heavy-Light Decomposition splits the tree into O(log n) chains, each backed by a segment tree, giving O(log^2 n) path queries. Euler Tour Trees flatten the tree into a sequence and support subtree aggregates. Binary lifting answers lowest-common-ancestor queries in O(log n) after O(n log n) preprocessing.',
        'These static methods work well when the tree does not change. They precompute DFS orderings, chain decompositions, or sparse tables that depend on stable parent-child relationships.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The parent-pointer walk costs O(n) per query on a path-shaped tree. If queries and topology changes interleave, there is no way to amortize the walks -- each one can scan the entire tree.',
        'Static decompositions break under topology changes. A single cut invalidates the DFS order that Heavy-Light Decomposition and Euler Tour Trees rely on. Rebuilding after every cut costs O(n), which is no better than the naive walk.',
        'The wall is storing a path as something searchable while the path itself keeps changing. The path endpoints move, interior nodes gain or lose children, and the decomposition must adapt without rebuilding from scratch.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A link-cut tree has two layers. The represented forest is the forest users ask about: the real tree edges, the real parent-child relationships. The auxiliary forest is an implementation layer made of splay trees that the user never sees directly.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/AVL_Tree_Rebalancing.svg', alt: 'Tree rotation cases showing how local rotations preserve inorder structure.', caption: 'Splay trees use rotations with the same local-order preservation idea: reshape the tree without changing the path order. Source: Wikimedia Commons, CyHawk and contributors, CC BY-SA.'},
        {
          type: 'diagram',
          text: 'Represented tree:           Preferred-path decomposition:\n\n      r                     Aux splay tree 1: [r - a - c - d]\n     / \\                      (preferred path, keyed by depth)\n    a   b                   \n    |    \\                  Aux splay tree 2: [b]\n    c     e                   (single-node path)\n    |                       \n    d                       Aux splay tree 3: [e]\n                              (single-node path)\n\n    Virtual edges (dashed) connect aux tree roots\n    to their represented parents in other aux trees.',
          label: 'Preferred-path decomposition and auxiliary splay trees',
        },
        'Each represented node has at most one preferred child. Preferred edges form vertex-disjoint paths from various nodes toward the root. Each preferred path is stored as one auxiliary splay tree, keyed by depth in the represented tree (shallower nodes on the left, deeper nodes on the right). Nodes not on the preferred path connect to the auxiliary structure through path-parent pointers -- virtual edges that point upward but are not reciprocated by a child pointer.',
        {
          type: 'code',
          language: 'javascript',
          text: '// access(x): expose the root-to-x path in one auxiliary splay tree\nfunction access(x) {\n  splay(x);              // make x the root of its aux tree\n  x.right = null;        // detach deeper preferred nodes\n  update(x);             // recompute aggregate\n\n  // walk up through path-parent pointers\n  while (x.pathParent !== null) {\n    let y = x.pathParent;\n    splay(y);            // make y root of its aux tree\n    y.right = x;         // attach x as preferred child of y\n    update(y);           // recompute aggregate\n    x.pathParent = null; // edge is now preferred, not virtual\n    splay(x);            // x becomes new aux root\n  }\n  // now root-to-x is one aux splay tree rooted at x\n}',
        },
        'access(x) is the central operation. It splays x to the root of its auxiliary tree, detaches any deeper preferred path, then walks upward through path-parent pointers. At each step it splays the ancestor, switches the preferred child edge to point toward x, and repeats. After access(x), the entire represented root-to-x path lives in a single auxiliary splay tree.',
        'makeRoot(x) calls access(x) then sets a lazy reversal flag on the auxiliary tree, which swaps left and right children throughout the path. This reverses depth order, making x the shallowest node -- effectively the represented root. The reversal flag is pushed down lazily, only when the code needs to descend into children.',
        'link(x, y): call makeRoot(x) so x has no represented parent, then set x.pathParent = y. The forest guard requires x and y to be in different represented trees. cut(x, y): call makeRoot(x), then access(y). If y.left == x and x.right == null, the edge is the direct represented edge; delete it by clearing pointers. query(x, y): call makeRoot(x), then access(y). The aggregate at the auxiliary root of y now holds the path aggregate from x to y.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Splay rotations preserve inorder traversal order. Since inorder order in an auxiliary tree corresponds to depth order in the represented tree, rotations can rebalance the auxiliary tree without changing which nodes are on the path or their relative depths.',
        'access changes which edges are preferred but never creates or deletes represented forest edges. Side branches become virtual children -- they point up through path-parent pointers but are not pointed to as children. The represented forest is unchanged; only the preferred-path decomposition is rearranged.',
        'link is correct because the forest guard prevents cycles: x must be a root (no represented parent) and must be in a different tree from y. cut is correct because access exposes the target edge so it can be verified as a direct parent-child relationship before deletion. Without that verification, cutting a non-adjacent pair would silently corrupt the forest.',
        'Amortized O(log n) follows from splay tree potential analysis. Define the potential of each node as log of its subtree size in the auxiliary tree. Each splay operation pays amortized O(log n) by the Access Lemma. Since access performs at most O(log n) splays on the path upward, and each splay is amortized O(log n), the total amortized cost is O(log^2 n) in a naive analysis -- but Sleator and Tarjan showed a tighter O(log n) bound using a global potential function across all auxiliary trees.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Link-cut tree: O(log n) amortized for access, link, cut, findRoot, and path aggregates; best when dynamic topology and path queries dominate.',
            'Euler tour tree: O(log n) amortized for link, cut, connectivity, and subtree aggregates; path aggregates need extra machinery.',
            'Top tree: O(log n) amortized for a broad set of dynamic-tree aggregates; more general but harder to implement because every cluster merge and split needs a contract.',
            'Implementation tax: link-cut trees need splay rotations and lazy reversal, Euler tour trees need a balanced BST over a changing sequence, and top trees need the highest abstraction burden.',
          ],
        },
        'Each node stores five pointers (left child, right child, parent in the auxiliary tree, path-parent, and a lazy reversal bit), plus whatever aggregate values the application needs. Memory overhead is roughly 5-7 pointers per node compared with 1-2 for a plain parent-pointer tree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes.', caption: 'The represented forest and the auxiliary forest are two graph layers over the same nodes; most bugs come from mixing their edge meanings. Source: Wikimedia Commons, David W., public domain.'},
        'Amortized O(log n) means individual operations can be expensive. A single access on a worst-case path can perform O(n) rotations, but the potential decrease guarantees that future operations on the same nodes are cheap. Over any sequence of m operations on an n-node forest, total work is O(m log n).',
        'When n doubles, each operation adds roughly one more splay step. For 1,000 nodes, access touches about 10 auxiliary tree levels. For 1,000,000 nodes, about 20. The dominant cost is splay rotations during access; link, cut, and query are thin wrappers around access.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The classic use is dynamic minimum spanning tree maintenance. When a new edge (u, v, w) arrives and u and v are already connected, expose the u-to-v path, find the maximum-weight edge on it, and compare. If w is smaller, cut the heavy edge and link the new one. The forest stays a spanning tree and the total weight decreases. Each update is O(log n) amortized.',
        'Network reliability analysis uses link-cut trees to maintain a spanning forest under edge insertions and deletions, answering "are u and v connected?" in O(log n). This is the dynamic connectivity problem restricted to forests.',
        'Competitive programming problems with online tree path queries -- path sum, path maximum, path XOR -- are the most common practical setting. The pattern is: maintain a forest, process link/cut/query operations in sequence, output aggregates. Link-cut trees solve this family directly.',
        'Compiler analyses that track changing dominator trees or incremental SSA construction can use link-cut trees when the dominator relation changes under code edits. The key fit is that dominators form a tree and edits produce local cuts and links.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For static trees, link-cut trees are overkill. Heavy-Light Decomposition gives O(log^2 n) path queries with a simpler implementation and better constant factors. A segment tree over DFS order handles subtree queries more naturally. Binary lifting answers LCA in O(log n) with less code.',
        'Link-cut trees do not solve fully dynamic general graph connectivity. They maintain a forest, not an arbitrary graph. General dynamic connectivity requires additional machinery -- level structures, replacement-edge search -- on top of a dynamic forest.',
        'Subtree aggregates are not native. A standard link-cut tree exposes path aggregates, not subtree sums. Extensions exist (maintaining virtual-subtree aggregates during access), but they add complexity. Euler Tour Trees handle subtree queries more naturally.',
        'Most implementation bugs come from confusing the two layers. The auxiliary parent pointer is not the represented tree parent. The path-parent pointer is not the auxiliary parent. Lazy reversal flags must be pushed before any directional decision (going left or right in the splay tree). Forgetting to push reversal before a cut verification is the single most common bug.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Sleator and Tarjan, "A Data Structure for Dynamic Trees," Journal of Computer and System Sciences 26(3), 1983. https://www.cs.cmu.edu/~sleator/papers/dynamic-trees.pdf',
            'Splay tree foundation: Sleator and Tarjan, "Self-Adjusting Binary Search Trees," JACM 32(3), 1985.',
            'Top trees alternative: Alstrup, Holm, de Lichtenberg, Thorup, "Maintaining Information in Fully Dynamic Trees with Top Trees," ACM Transactions on Algorithms, 2005.',
            'Practical implementation guide: competitive programming resources (CP-Algorithms, Codeforces tutorials on link-cut trees).',
          ],
        },
        {
          type: 'note',
          text: 'Prerequisite: study Splay Tree first -- link-cut trees inherit rotations, the zig-zig/zig-zag cases, and the amortized potential argument directly from splaying. Without understanding splay trees, the access operation is opaque.',
        },
        'Study Heavy-Light Decomposition and Euler Tour Tree to understand the static and alternative dynamic baselines. Study Top Tree for a cluster-based dynamic-tree model that handles subtree aggregates more naturally. Study dynamic connectivity (Holm, de Lichtenberg, Thorup 2001) for the general graph extension that uses link-cut trees as a building block.',
      ],
    },
  ],
};
