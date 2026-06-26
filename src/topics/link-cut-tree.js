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
    explanation: `A ${topic.title} stores a changing forest. The visible tree edges are the represented forest; the hidden data structure is a set of auxiliary splay trees that store preferred root-to-${'d'} paths.`,
    invariant: `The represented forest is acyclic; auxiliary structure may rotate without changing real parent-child reachability in the ${'r'}-rooted tree.`,
  };

  yield {
    state: representedForest('access(d) exposes the root-to-d path'),
    highlight: { active: ['d', 'c', 'a', 'r', 'aux1', 'e-path-aux'], found: ['e-aux-query'], compare: ['aux2'] },
    explanation: `The access operation repeatedly splays ancestors and changes which child edge is preferred. After access(${'d'}), the path from the represented root ${'r'} to ${'d'} becomes one auxiliary splay tree.`,
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
    explanation: `Preferred paths are a representation trick in ${topic.title}. A normal tree path is rearranged into a splay tree so path data can be recomputed after rotations.`,
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
    explanation: `The ${topic.title} is best understood as two layers: tree topology for correctness, and splay-maintained path decompositions for amortized O(log n) speed.`,
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
    explanation: `${topic.title} supports online topology changes. Each public operation (${'findRoot'}, ${'link'}, ${'cut'}, ${'query'}) is a short recipe built from access, splay, path reversal, and local pointer edits.`,
  };

  yield {
    state: representedForest('Link operation attaches one tree under another'),
    highlight: { active: ['b', 'e', 'e-b-e'], found: ['r'], compare: ['d'] },
    explanation: `To link x under y, first makeRoot(x) so x has no represented parent from the ${topic.title} perspective, then set its parent pointer to y. The forest guard prevents cycles — e.g. ${'b'} can be linked under ${'r'}.`,
    invariant: `link(x, y) is legal only when x and y are in different represented trees of the ${topic.id} forest.`,
  };

  yield {
    state: representedForest('Cut operation removes one represented edge'),
    highlight: { active: ['c', 'd', 'e-c-d'], removed: ['e-r-b'], compare: ['aux1'] },
    explanation: `To cut edge (${'c'}, ${'d'}), expose the ${'c'}-to-${'d'} path so the edge is local in an auxiliary tree, then remove the child pointer. The user sees a forest split; the auxiliary paths are rebuilt lazily by future accesses.`,
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
    explanation: `The complete ${topic.id} case-study pattern is dynamic MST maintenance: when an edge is added, find the maximum-weight edge on the existing path and cut it if the new edge is better — all in amortized O(log n) per update.`,
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
        'There are two forests in the animation. The represented forest is the real dynamic tree the user cares about. The auxiliary trees are splay trees that temporarily organize preferred paths so path operations become searchable.',
        'A highlighted access step is not changing which original vertices are connected. It is reshaping auxiliary pointers so the path from a chosen node toward the root becomes exposed. Link and cut change represented-tree edges; rotations only change the auxiliary view.',
        {type: 'callout', text: 'A link-cut tree keeps the represented forest stable while constantly reshaping auxiliary splay trees so the path you need becomes searchable.'},
        {type: 'image', src: './assets/gifs/link-cut-tree.gif', alt: 'Animated walkthrough of the link cut tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many problems maintain a forest while edges are added, removed, and queried. A forest is a collection of trees, and a tree is a connected graph with no cycles. Queries often ask about the path between a node and the root or between two nodes.',
        'A normal tree representation handles parent pointers, but path queries become expensive after updates. Link-cut trees exist to support dynamic connectivity and path aggregate queries while the forest keeps changing.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach stores parent pointers and walks up the tree for every path query. To connect two trees, set one parent pointer. To cut an edge, clear the parent pointer. The update code is simple.',
        'That approach works when trees are shallow or queries are rare. It fails when a path can contain many nodes and operations are interleaved. Walking a path of length n for every query can dominate the runtime.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is changing topology. Heavy-light decomposition and Euler-tour tricks can make static or partly dynamic tree paths fast, but arbitrary link and cut operations break the fixed decomposition. Rebuilding after every update is too expensive.',
        'A path aggregate such as minimum edge weight, maximum value, or path sum needs more than connectivity. The structure must expose exactly the needed path, combine its values, and then survive the next topology change.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent each dynamic tree as a set of preferred paths, and store each preferred path in a splay tree. A splay tree is a self-adjusting binary search tree that moves recently accessed nodes toward the root through rotations. Link-cut trees use those rotations to change which path is preferred.',
        'The key operation is access(x). It repeatedly cuts and reconnects auxiliary right-child pointers so the represented path from x to its tree root becomes one exposed auxiliary path. Once exposed, path aggregates live in the splay metadata.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/AVL_Tree_Rebalancing.svg', alt: 'Tree rotation cases showing how local rotations preserve inorder structure.', caption: 'Splay trees use rotations with the same local-order preservation idea: reshape the tree without changing the path order. Source: Wikimedia Commons, CyHawk and contributors, CC BY-SA.'},
      ],
    },    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores auxiliary children, an auxiliary parent, a represented-tree parent, and aggregate metadata. Rotations update auxiliary pointers and recompute metadata. The represented parent relation records how auxiliary path pieces connect in the real forest.',
        'To expose a path, call access(x). The operation splays nodes while replacing right children with the previously exposed piece. After access, x sits at the end of the preferred path to the represented root.',
        'To make a tree rooted at x, expose x and flip the represented path with a lazy reversal flag. Link connects one root under another root after checking that they are in different trees. Cut exposes the edge and removes it only when that exact edge is present.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The represented-forest invariant is that link and cut change real edges, while rotations do not. A rotation only changes the binary shape of one auxiliary splay tree, so it preserves the order of the preferred path. Aggregate values are recomputed after every local pointer change.',
        'The access invariant is that after access(x), the preferred path from the represented root to x is represented by one auxiliary tree. Because every path query first exposes the needed path, reading the aggregate at the splay root gives the aggregate for exactly that represented path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each high-level operation costs O(log n) amortized time. Amortized means a single operation can be slower, but any long sequence of operations averages logarithmic cost per operation. The bound comes from the splay-tree potential argument.',
        'When n doubles, the expected operation count grows by about one more logarithmic level, not by a full path length. Space is O(n) because each represented node stores a constant number of pointers, flags, and aggregate fields. The hidden cost is implementation complexity and pointer-heavy memory access.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Link-cut trees fit dynamic graph algorithms where a changing forest is the backbone of the computation. Dynamic minimum spanning tree algorithms, network simplex variants, and online path aggregate problems can use them to maintain tree paths under updates.',
        'They are also common in advanced competitive programming problems with dynamic trees. The access pattern is many interleaved path queries, links, and cuts. If the tree is static, simpler structures usually win.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Link-cut trees are hard to implement and debug. Lazy reversal flags, auxiliary parents, represented parents, and aggregate recomputation must stay separate. Mixing those meanings is the usual bug.',
        'They are also not the best choice for every tree query. Static trees are better served by binary lifting, Euler tours, segment trees, or heavy-light decomposition. Fully dynamic general graphs need additional machinery beyond a dynamic forest.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes.', caption: 'The represented forest and the auxiliary forest are two graph layers over the same nodes; most bugs come from mixing their edge meanings. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with represented edges 1-2 and 2-3, rooted at 1. Suppose node values are 5, 7, and 4, and the path aggregate is sum. A query for path 1 to 3 should return 16.',
        'Call makeRoot(1), then access(3). The represented path 1-2-3 becomes the exposed auxiliary path. The splay metadata combines 5 + 7 + 4 and returns 16.',
        'Now cut edge 2-3. The represented forest becomes one tree with 1-2 and one singleton 3. A later path query from 1 to 3 first finds different roots, so the path aggregate is invalid rather than silently using stale auxiliary links.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Sleator and Tarjan, A Data Structure for Dynamic Trees, 1983. Study the original dynamic-trees paper for preferred paths, access, and the amortized analysis.',
        'Study next by role. Splay trees explain rotations and amortization. Heavy-light decomposition explains path decomposition on static trees. Euler-tour trees explain another dynamic-forest representation. Dynamic connectivity explains how forests support larger graph algorithms.',
      ],
    },
  ],
};
