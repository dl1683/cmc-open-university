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
        'A top tree is a data structure for a dynamic forest: a set of trees where edges can be linked and cut while queries keep asking about paths or whole components. Its basic unit is a cluster, a connected piece of an underlying tree with at most two boundary vertices.',
        'Clusters are arranged in a balanced binary tree. Leaves usually represent original edges. Internal nodes represent the union of two neighboring clusters. The root cluster summarizes a whole represented tree, or after an expose operation, the path between two chosen vertices.',
        'The useful abstraction is that application logic lives in small cluster summaries. The data structure handles link, cut, expose, split, join, and rebalancing. The application defines how to combine two child summaries into one parent summary.',
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        'Static tree techniques assume the topology stays put. Heavy-Light Decomposition, Euler tours, binary lifting, rerooting DP, and segment trees over tree orderings all become much harder when an edge can disappear and a new edge can attach two components.',
        'The naive dynamic answer is to recompute after every change. If a link or cut changes a large component, that can mean scanning thousands or millions of vertices just to refresh a path sum, a diameter, or the nearest marked node.',
        'Top trees exist for workloads that need both dynamic topology and rich aggregates. They keep the repair local: a topology update changes only logarithmically many clusters in the balanced representation, provided each cluster summary can be recomputed in constant time.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach for a path query is to run a DFS or BFS from u to v, collect the path, and compute the answer. That is correct and often fine for a single query. It fails when updates and queries are interleaved at high volume.',
        'The next approach is to keep a static decomposition, such as Heavy-Light Decomposition. That works until link and cut change parent-child relationships and heavy paths. Rebuilding the decomposition after every topology change loses the point.',
        'The wall is not just connectivity. Euler Tour Trees can maintain dynamic connectivity and some component aggregates well. The harder need is boundary-aware path and tree summaries: after exposing u-v, the summary must know exactly how information flows through the two path endpoints.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent the dynamic tree as a hierarchy of connected clusters, and require every cluster to expose at most two boundary vertices. That restriction is the whole trick. A cluster with two boundaries behaves like a path-shaped object with possible side material folded into it. A cluster with one or zero boundaries can summarize a rooted or whole component piece.',
        'If two clusters touch in a valid way, join them and recompute a parent summary from the child summaries plus boundary information. If an update breaks a relationship, split clusters on the search path and rebuild the balanced hierarchy.',
        'Path queries become expose operations. expose(u, v) rearranges the cluster hierarchy so u and v are the boundary vertices of the root cluster. Once that happens, a path aggregate is not a traversal anymore. It is a field on the root summary.',
      ],
    },
    {
      heading: 'Reading the cluster-interface view',
      paragraphs: [
        'In the cluster-interface view, read each cluster as a contract. It promises: I represent a connected piece of the underlying tree, I have at most two boundary vertices, and my summary is enough for my parent to combine me with a neighboring cluster.',
        'The boundary count matters. If a cluster had many open boundary vertices, the parent would need a large table of ways information could enter and leave. With at most two boundaries, a path summary can stay small: left-to-right value, right-to-left value when needed, best internal value, and boundary distances or flags.',
        'The animation is showing whether the summary API is valid. A good top-tree aggregate does not ask for all vertices in a cluster. It asks for constant-size records that can be joined, split, and lazily reversed without losing meaning.',
      ],
    },
    {
      heading: 'Reading the expose-path view',
      paragraphs: [
        'In the expose-path view, the structural work is the point. The data structure is not walking the underlying u-v path directly. It is rearranging the cluster hierarchy until that path is represented by the root cluster with u and v as boundaries.',
        'After expose(u, v), a path query should look almost boring. The answer is already in the root summary. For a path sum, read the sum. For a path minimum, read the min. For a nearest marked vertex, compare the boundary-aware nearest records.',
        'This is also where bugs appear. Boundary orientation must be correct after reversals. Lazy tags must be pushed before summaries are trusted. A cluster that accidentally has three boundary vertices is no longer a valid top-tree cluster, even if its stored numbers look plausible.',
      ],
    },
    {
      heading: 'Reading the diameter case study',
      paragraphs: [
        'For diameter, each cluster summary needs enough information to answer two questions: what is the best diameter entirely inside this cluster, and how far is the farthest relevant endpoint from each boundary?',
        'When two clusters join, the parent diameter is the best of three candidates: the left child diameter, the right child diameter, or a cross-boundary path that uses the farthest endpoint from one child plus the farthest endpoint from the other child plus the connecting edge or shared boundary distance.',
        'The diameter view is useful because it is richer than a path sum but still constant-size. It shows why top trees are not just dynamic connectivity. They are a framework for maintaining derived facts about changing trees.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A top tree maintains leaf clusters for edges and internal clusters for unions of adjacent clusters. A compress join combines two path clusters into a longer path. A rake join folds a side cluster into a path cluster without creating extra exposed boundaries.',
        'link(u, v) creates a new edge cluster and joins the two previously separate components. cut(u, v) exposes or locates the edge cluster for that edge, removes it, and repairs the two resulting component hierarchies. expose(u, v) repeatedly splits and joins clusters until the desired path is the root cluster.',
        'Every operation depends on a user-defined combine function. For a sum, combine adds child sums. For a min, combine takes a minimum and applies lazy updates. For diameter, combine evaluates child and cross candidates. The top-tree engine supplies the cluster structure; the application supplies the summary algebra.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is local: every cluster summary is a complete summary of exactly the connected underlying subgraph represented by that cluster, viewed through its boundary vertices. If both children satisfy the invariant and the join rule is correct, the parent satisfies it too.',
        'Because the cluster hierarchy is balanced, a link, cut, expose, or update changes only O(log n) levels of summaries. The algorithm does not need to revisit unaffected clusters because their represented subgraphs and boundary summaries have not changed.',
        'The two-boundary rule is what keeps joins constant-time. It prevents a parent from needing to remember arbitrary interactions among many open attachment points. A valid summary can be small, boundary-aware, and composable.',
      ],
    },
    {
      heading: 'Worked case study: failover diameter',
      paragraphs: [
        'Consider a tree-shaped failover network. Vertices are sites, weighted edges are network links, and operators repeatedly cut failed links, add recovered links, and ask for the current diameter: the two sites farthest apart by weighted path distance.',
        'Recomputing the diameter from scratch after every change would require scanning the whole component. A top tree instead stores, for each cluster, the best internal diameter and the farthest endpoint distance from each boundary. When two clusters join, the parent checks the two child diameters and the cross path formed by the farthest boundary-facing endpoints.',
        'After a cut or link, only the clusters on the repaired hierarchy paths need new summaries. The dashboard can read the current component diameter from the root cluster. The same pattern can maintain nearest failed site, minimum residual capacity on a path, or total maintenance cost across an exposed path.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Balanced top trees support expose, link, cut, and many boundary-aware aggregate operations in O(log n) time when cluster joins, splits, reversals, and lazy updates are O(1). Space is O(n) clusters plus the stored summaries.',
        'That bound depends on the summary staying small. If a cluster stores a list of all vertices, all marked nodes, or an unbounded table of cases, the asymptotic guarantee is gone. The data structure is only as good as the combine contract.',
        'The implementation cost is high. You must maintain cluster validity, orientation, lazy propagation, split and join cases, and tests against brute-force dynamic trees. Top trees are an abstraction win after the engine exists, not a quick implementation trick.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Top trees win when the forest changes online and queries need path or whole-tree summaries richer than connectivity: dynamic diameter, path min or max, path sum, nearest marked vertex, center-like summaries, and custom records that can be composed from two child clusters.',
        'They are especially attractive in libraries or systems that need many dynamic-tree aggregates behind one interface. Once the cluster engine is reliable, adding a new aggregate can be mostly a matter of defining summary fields and combine rules.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'They fail when the problem is simpler than the machinery. If the tree is static, Heavy-Light Decomposition or Euler tour plus a segment tree is usually easier. If only dynamic connectivity is needed, Euler Tour Trees or Link-Cut Trees may be more direct.',
        'They also fail when the aggregate is not local to two-boundary clusters. Queries that need arbitrary global ordering, large sets per cluster, or non-composable constraints can break the constant-time join assumption.',
        'For one-off contest code, top trees are often too much. For a reusable dynamic-forest engine with serious aggregate requirements, the abstraction can be worth the complexity.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Heavy-Light Decomposition, Euler Tour Tree, Link-Cut Tree, Segment Tree, and rerooting DP before implementing a top tree. The essential question for any proposed aggregate is: can two child cluster summaries be joined into a parent summary using only constant-size boundary-aware information?',
      ],
    },
  ],
};
