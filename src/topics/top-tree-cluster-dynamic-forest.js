// Top tree: dynamic forests as balanced clusters with small boundary sets.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'top-tree-cluster-dynamic-forest',
  title: 'Top Tree Cluster Dynamic Forest',
  category: 'Data Structures',
  summary: 'Maintain dynamic trees through balanced clusters: expose paths, join or split clusters, and update path or whole-tree aggregates in O(log n).',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cluster interface', 'expose path', 'diameter case study'], defaultValue: 'cluster interface' },
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

function clusterGraph(title, notes = {}) {
  const note = (id, fallback = '') => notes[id] ?? fallback;
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 1.0, y: 5.4, note: note('a', 'vertex') },
      { id: 'b', label: 'B', x: 3.0, y: 5.4, note: note('b', 'vertex') },
      { id: 'c', label: 'C', x: 5.0, y: 5.4, note: note('c', 'vertex') },
      { id: 'd', label: 'D', x: 7.0, y: 5.4, note: note('d', 'vertex') },
      { id: 'e', label: 'E', x: 5.0, y: 7.0, note: note('e', 'leaf') },
      { id: 'ab', label: 'AB', x: 2.0, y: 3.7, note: note('ab', 'leaf C') },
      { id: 'bc', label: 'BC', x: 4.0, y: 3.7, note: note('bc', 'leaf C') },
      { id: 'cd', label: 'CD', x: 6.0, y: 3.7, note: note('cd', 'leaf C') },
      { id: 'ce', label: 'CE', x: 7.8, y: 5.8, note: note('ce', 'rake C') },
      { id: 'abc', label: 'ABC', x: 3.0, y: 2.2, note: note('abc', 'join') },
      { id: 'acd', label: 'A-D', x: 5.0, y: 1.0, note: note('acd', 'path C') },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b' },
      { id: 'e-b-c', from: 'b', to: 'c' },
      { id: 'e-c-d', from: 'c', to: 'd' },
      { id: 'e-c-e', from: 'c', to: 'e' },
      { id: 'e-ab-a', from: 'ab', to: 'a' },
      { id: 'e-ab-b', from: 'ab', to: 'b' },
      { id: 'e-bc-b', from: 'bc', to: 'b' },
      { id: 'e-bc-c', from: 'bc', to: 'c' },
      { id: 'e-cd-c', from: 'cd', to: 'c' },
      { id: 'e-cd-d', from: 'cd', to: 'd' },
      { id: 'e-ce-c', from: 'ce', to: 'c' },
      { id: 'e-ce-e', from: 'ce', to: 'e' },
      { id: 'e-ab-abc', from: 'ab', to: 'abc' },
      { id: 'e-bc-abc', from: 'bc', to: 'abc' },
      { id: 'e-abc-acd', from: 'abc', to: 'acd' },
      { id: 'e-cd-acd', from: 'cd', to: 'acd' },
    ],
  }, { title });
}

function* clusterInterface() {
  yield {
    state: clusterGraph('Leaf clusters correspond to tree edges'),
    highlight: { active: ['ab', 'bc', 'cd', 'ce'], compare: ['a', 'b', 'c', 'd', 'e'] },
    explanation: 'A top tree represents an underlying dynamic tree as a balanced tree of clusters. Leaf clusters correspond to original edges such as AB, BC, CD, and CE.',
    invariant: 'Every cluster is a connected subtree with at most two boundary vertices.',
  };

  yield {
    state: labelMatrix(
      'Two cluster joins',
      [
        { id: 'compress', label: 'compress' },
        { id: 'rake', label: 'rake' },
        { id: 'boundary', label: 'boundary' },
        { id: 'height', label: 'height' },
      ],
      [{ id: 'meaning' }, { id: 'result' }],
      [
        ['join paths', 'longer path'],
        ['attach side', 'same path'],
        ['<= 2 verts', 'small API'],
        ['balanced', 'O(log n)'],
      ],
    ),
    highlight: { active: ['compress:meaning', 'rake:meaning'], found: ['height:result'] },
    explanation: 'compress combines adjacent path clusters. rake folds a side subtree into a path cluster. The data structure keeps this cluster tree balanced.',
  };

  yield {
    state: clusterGraph('A root cluster summarizes the represented tree', {
      acd: 'root C',
      abc: 'child C',
      cd: 'child C',
      ce: 'side C',
    }),
    highlight: { found: ['acd'], active: ['abc', 'cd'], compare: ['ce'] },
    explanation: 'The root cluster can store an aggregate for the whole tree or for an exposed path. Children store smaller summaries, and joins recompute parent summaries.',
  };

  yield {
    state: labelMatrix(
      'User-defined cluster callbacks',
      [
        { id: 'create', label: 'create' },
        { id: 'join', label: 'join' },
        { id: 'split', label: 'split' },
        { id: 'destroy', label: 'destroy' },
      ],
      [{ id: 'when' }, { id: 'job' }],
      [
        ['edge born', 'base data'],
        ['clusters join', 'merge data'],
        ['clusters split', 'push tags'],
        ['edge gone', 'cleanup'],
      ],
    ),
    highlight: { active: ['create:job', 'join:job', 'split:job'], found: ['destroy:when'] },
    explanation: 'The top-tree interface is valuable because application data lives in small callbacks. Dynamic-tree machinery handles rebalancing; the user writes aggregate logic for cluster joins and splits.',
  };

  yield {
    state: labelMatrix(
      'Where top trees fit',
      [
        { id: 'top', label: 'Top' },
        { id: 'lct', label: 'LCT' },
        { id: 'ett', label: 'ETT' },
        { id: 'hld', label: 'HLD' },
      ],
      [{ id: 'best' }, { id: 'shape' }],
      [
        ['cluster', 'dyn'],
        ['splay', 'dyn'],
        ['seq', 'dyn'],
        ['array', 'static'],
      ],
    ),
    highlight: { found: ['top:best'], compare: ['lct:shape', 'ett:shape', 'hld:shape'] },
    explanation: 'Top trees, link-cut trees, and Euler tour trees all handle dynamic forests. Top trees are the cluster-summary interface: expose a path or tree, then read the root cluster.',
  };
}

function* exposePath() {
  yield {
    state: clusterGraph('Expose path A-D'),
    highlight: { active: ['a', 'b', 'c', 'd', 'ab', 'bc', 'cd', 'abc', 'acd'], compare: ['e', 'ce'] },
    explanation: 'expose(A, D) rearranges clusters so the root cluster boundary is A and D. Side subtrees such as CE can remain attached as raked information.',
    invariant: 'After expose(u, v), the root cluster represents the u-v path with u and v as boundary vertices.',
  };

  yield {
    state: labelMatrix(
      'Path aggregate example',
      [
        { id: 'ab', label: 'AB' },
        { id: 'bc', label: 'BC' },
        { id: 'cd', label: 'CD' },
        { id: 'root', label: 'A-D' },
      ],
      [{ id: 'edge' }, { id: 'sum' }],
      [
        ['4', '4'],
        ['6', '10'],
        ['3', '13'],
        ['path', '13'],
      ],
    ),
    highlight: { active: ['ab:sum', 'bc:sum', 'cd:sum'], found: ['root:sum'] },
    explanation: 'A path-sum aggregate is simple: each cluster stores its path sum. Exposing A-D makes the answer available at the root cluster.',
  };

  yield {
    state: labelMatrix(
      'Link and cut work',
      [
        { id: 'expose', label: 'expose' },
        { id: 'link', label: 'link' },
        { id: 'cut', label: 'cut' },
        { id: 'update', label: 'update' },
      ],
      [{ id: 'touch' }, { id: 'cost' }],
      [
        ['root path', 'O(log n)'],
        ['new edge', 'O(log n)'],
        ['old edge', 'O(log n)'],
        ['cluster path', 'O(log n)'],
      ],
    ),
    highlight: { found: ['link:cost', 'cut:cost', 'update:cost'], compare: ['expose:touch'] },
    explanation: 'Only logarithmically many clusters change when topology or weights change. Recompute summaries along those affected cluster paths.',
  };

  yield {
    state: clusterGraph('Cut edge C-D and rebuild affected clusters', {
      cd: 'cut',
      acd: 'split',
      abc: 'kept',
    }),
    highlight: { removed: ['cd', 'e-c-d'], active: ['acd'], found: ['abc'], compare: ['ce'] },
    explanation: 'A cut removes one leaf cluster and splits the affected top-tree path. Untouched clusters and summaries remain reusable.',
  };

  yield {
    state: labelMatrix(
      'Exposed-root queries',
      [
        { id: 'path', label: 'sum' },
        { id: 'min', label: 'min' },
        { id: 'mark', label: 'mark' },
        { id: 'diam', label: 'diam' },
      ],
      [{ id: 'store' }, { id: 'answer' }],
      [
        ['sum', 'root'],
        ['min', 'root'],
        ['dist', 'side'],
        ['ends', 'len'],
      ],
    ),
    highlight: { active: ['path:answer', 'min:answer'], found: ['diam:answer'], compare: ['mark:store'] },
    explanation: 'The pattern is uniform: define what each cluster stores, define how two children combine, expose the desired boundary, then read the root summary.',
  };
}

function* diameterCaseStudy() {
  yield {
    state: clusterGraph('Maintain network diameter under link/cut'),
    highlight: { active: ['acd', 'abc', 'cd', 'ce'], found: ['a', 'd'], compare: ['e'] },
    explanation: 'A dynamic network dashboard may need the current tree diameter after links fail or recover. A top tree can store diameter endpoints and length in every cluster.',
  };

  yield {
    state: labelMatrix(
      'Cluster diameter summary',
      [
        { id: 'inside', label: 'inside' },
        { id: 'left', label: 'left bdry' },
        { id: 'right', label: 'right bdry' },
        { id: 'best', label: 'best pair' },
      ],
      [{ id: 'keeps' }, { id: 'why' }],
      [
        ['diam len', 'child best'],
        ['far from L', 'cross'],
        ['far from R', 'cross'],
        ['endpoints', 'answer'],
      ],
    ),
    highlight: { active: ['inside:keeps', 'left:keeps', 'right:keeps'], found: ['best:why'] },
    explanation: 'For diameter, a cluster stores enough boundary distances to test whether the best pair stays inside one child or crosses between children.',
  };

  yield {
    state: labelMatrix(
      'Join recomputes candidates',
      [
        { id: 'c1', label: 'child 1' },
        { id: 'c2', label: 'child 2' },
        { id: 'cross', label: 'cross' },
        { id: 'parent', label: 'parent' },
      ],
      [{ id: 'candidate' }, { id: 'take' }],
      [
        ['diam C1', 'maybe'],
        ['diam C2', 'maybe'],
        ['farL + farR', 'maybe'],
        ['max of all', 'diam'],
      ],
    ),
    highlight: { active: ['c1:candidate', 'c2:candidate', 'cross:candidate'], found: ['parent:take'] },
    explanation: 'The parent cluster does not scan all vertices. It compares a constant-size set of candidates derived from child summaries.',
  };

  yield {
    state: clusterGraph('After a link, only a logarithmic cluster path updates', {
      ce: 'new side',
      acd: 'new diam?',
      a: 'end?',
      e: 'end?',
    }),
    highlight: { active: ['ce', 'e-ce-c', 'acd'], found: ['a', 'e'], compare: ['d'] },
    explanation: 'When a side edge links in, the top tree rebuilds affected clusters and recomputes diameter summaries on that path. The dashboard reads the new root summary.',
  };

  yield {
    state: labelMatrix(
      'Production cautions',
      [
        { id: 'api', label: 'API' },
        { id: 'lazy', label: 'lazy' },
        { id: 'boundary', label: 'bdry' },
        { id: 'debug', label: 'debug' },
      ],
      [{ id: 'rule' }, { id: 'risk' }],
      [
        ['small', 'fast'],
        ['push', 'stale'],
        ['<=2', 'expose'],
        ['brute', 'bug'],
      ],
    ),
    highlight: { active: ['api:rule', 'boundary:rule'], found: ['debug:risk'], compare: ['lazy:risk'] },
    explanation: 'The cluster interface is clean only if each summary is small, joins are constant time, and expose boundary rules are tested against tiny brute-force dynamic trees.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cluster interface') yield* clusterInterface();
  else if (view === 'expose path') yield* exposePath();
  else if (view === 'diameter case study') yield* diameterCaseStudy();
  else throw new InputError('Pick a top-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A top tree is a dynamic-forest data structure built around clusters. Each cluster is a connected part of an underlying tree with at most two boundary vertices. A balanced binary tree of clusters represents the whole dynamic tree.',
        'The interface is the point. Instead of writing rotations or preferred-path machinery directly, the application defines what a cluster stores and how child clusters join or split. The data structure handles expose, link, cut, and rebalancing.',
        'Top trees are most useful for dynamic path and tree aggregates: path sums, path minimums, nearest marked vertices, tree diameter, center, median, and similar summaries that can be recomputed from small child summaries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Leaf clusters correspond to underlying tree edges. Internal clusters are formed by joining neighboring clusters. A compress join combines path clusters into a longer path; a rake join folds a side subtree into a path cluster. The root cluster summarizes the represented tree or an exposed path.',
        'expose(u, v) rearranges the cluster tree so u and v become the boundary vertices of the root cluster. Once exposed, a path aggregate is simply the root cluster summary. link creates a new edge cluster and joins it into the forest. cut removes an edge cluster and splits the affected cluster tree.',
        'The user-level aggregate must be small and composable. For a path sum, store a number. For diameter, store best endpoints plus distances from boundary vertices. For nearest marked vertex, store the closest marked vertex seen from each boundary side.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A balanced top tree supports expose, link, cut, and many aggregate updates in O(log n) time, assuming cluster joins and splits take O(1). Space is O(n) clusters and summaries.',
        'The exact implementation can be built over topology trees or dynamic trees. The educational value is the abstraction: dynamic topology changes touch logarithmically many clusters, and aggregate logic is localized to join and split callbacks.',
        'If a cluster summary grows with cluster size, the bound is lost. Top trees reward summaries that behave like monoids or small boundary-aware records.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A network operations system maintains a tree-shaped failover topology. Links can fail or recover, and the dashboard asks for the current diameter: the two sites farthest apart by weighted path distance. Recomputing all-pairs distances after every update is not viable.',
        'Each top-tree cluster stores its best internal diameter and the farthest endpoint from each boundary vertex. When two clusters join, the parent considers the child diameters and the cross-boundary candidate. A link or cut updates only the affected cluster path, so the dashboard can read the diameter from the root summary after O(log n) structural work.',
        'The same cluster pattern can maintain path minimums for capacity, nearest marked failed site, or center and median summaries, as long as the summary can be combined from child cluster records.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Top trees are not simpler to implement than every dynamic-tree structure. Their advantage is a clean aggregate interface once the cluster machinery exists. For basic dynamic path queries, Link-Cut Tree may be more familiar. For component aggregates, Euler Tour Tree may be more direct.',
        'Do not store full vertex lists inside clusters unless the tree is tiny. That turns logarithmic updates into large scans. The whole method depends on constant-size summaries and correct boundary handling.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Maintaining Information in Fully Dynamic Trees with Top Trees at https://arxiv.org/abs/cs/0310065, the ACM DOI page at https://dl.acm.org/doi/10.1145/1103963.1103966, Dynamic Trees in Practice at https://renatowerneck.wordpress.com/wp-content/uploads/2016/06/tw09-dyntrees-jea.pdf, and the Top tree overview at https://en.wikipedia.org/wiki/Top_tree.',
        'Study Link-Cut Tree, Euler Tour Tree, Heavy-Light Decomposition, Rerooting DP: All Roots Tree DP, Centroid Decomposition, and Segment Tree next.',
      ],
    },
  ],
};
