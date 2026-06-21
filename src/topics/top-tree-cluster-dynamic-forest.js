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
  const baseVertices = ['a', 'b', 'c', 'd', 'e'];
  const leafClusters = ['ab', 'bc', 'cd', 'ce'];
  const numVertices = baseVertices.length;
  const numLeafClusters = leafClusters.length;
  const leafLabels = leafClusters.map(c => c.toUpperCase());
  const maxBoundary = 2;
  const joinTypes = ['compress', 'rake'];
  const costBound = 'O(log n)';
  const rootLabel = 'A-D';
  const callbackNames = ['create', 'join', 'split', 'destroy'];
  const numCallbacks = callbackNames.length;
  const alternatives = ['LCT', 'ETT', 'HLD'];

  yield {
    state: clusterGraph('Leaf clusters correspond to tree edges'),
    highlight: { active: leafClusters, compare: baseVertices },
    explanation: `A top tree represents an underlying ${numVertices}-vertex dynamic tree as a balanced tree of clusters. ${numLeafClusters} leaf clusters correspond to original edges: ${leafLabels.join(', ')}.`,
    invariant: `Every cluster is a connected subtree with at most ${maxBoundary} boundary vertices.`,
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
        [`<= ${maxBoundary} verts`, 'small API'],
        ['balanced', costBound],
      ],
    ),
    highlight: { active: ['compress:meaning', 'rake:meaning'], found: ['height:result'] },
    explanation: `${joinTypes[0]} combines adjacent path clusters. ${joinTypes[1]} folds a side subtree into a path cluster. The data structure keeps this cluster tree balanced so operations cost ${costBound}.`,
  };

  yield {
    state: clusterGraph('A root cluster summarizes the represented tree', {
      acd: 'root C',
      abc: 'child C',
      cd: 'child C',
      ce: 'side C',
    }),
    highlight: { found: ['acd'], active: ['abc', 'cd'], compare: ['ce'] },
    explanation: `The root cluster ${rootLabel} can store an aggregate for the whole ${numVertices}-vertex tree or for an exposed path. Children store smaller summaries, and ${joinTypes.join('/')} joins recompute parent summaries.`,
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
    explanation: `The top-tree interface defines ${numCallbacks} callbacks (${callbackNames.join(', ')}). Application data lives in these small functions. Dynamic-tree machinery handles rebalancing; the user writes aggregate logic for cluster joins and splits.`,
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
    explanation: `Top trees, ${alternatives.join(', ')} all handle dynamic forests. Top trees are the cluster-summary interface: expose a path or tree, then read the root cluster in ${costBound}.`,
  };
}

function* exposePath() {
  const pathStart = 'A';
  const pathEnd = 'D';
  const pathLabel = `${pathStart}-${pathEnd}`;
  const sideCluster = 'CE';
  const costBound = 'O(log n)';
  const pathEdges = ['AB', 'BC', 'CD'];
  const numPathEdges = pathEdges.length;
  const edgeWeights = [4, 6, 3];
  const pathSum = edgeWeights.reduce((a, b) => a + b, 0);
  const operations = ['expose', 'link', 'cut', 'update'];
  const numOps = operations.length;
  const cutEdge = 'C-D';
  const queryTypes = ['sum', 'min', 'mark', 'diam'];
  const numQueryTypes = queryTypes.length;

  yield {
    state: clusterGraph(`Expose path ${pathLabel}`),
    highlight: { active: ['a', 'b', 'c', 'd', 'ab', 'bc', 'cd', 'abc', 'acd'], compare: ['e', 'ce'] },
    explanation: `expose(${pathStart}, ${pathEnd}) rearranges clusters so the root cluster boundary is ${pathStart} and ${pathEnd}. Side subtrees such as ${sideCluster} remain attached as raked information.`,
    invariant: `After expose(u, v), the root cluster represents the u-v path with exactly ${2} boundary vertices: u and v.`,
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
        [String(edgeWeights[0]), String(edgeWeights[0])],
        [String(edgeWeights[1]), String(edgeWeights[0] + edgeWeights[1])],
        [String(edgeWeights[2]), String(pathSum)],
        ['path', String(pathSum)],
      ],
    ),
    highlight: { active: ['ab:sum', 'bc:sum', 'cd:sum'], found: ['root:sum'] },
    explanation: `A path-sum aggregate: ${numPathEdges} edge clusters (${pathEdges.join(', ')}) with weights ${edgeWeights.join(', ')} accumulate to ${pathSum}. Exposing ${pathLabel} makes the total available at the root.`,
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
        ['root path', costBound],
        ['new edge', costBound],
        ['old edge', costBound],
        ['cluster path', costBound],
      ],
    ),
    highlight: { found: ['link:cost', 'cut:cost', 'update:cost'], compare: ['expose:touch'] },
    explanation: `All ${numOps} operations (${operations.join(', ')}) touch only ${costBound} clusters when topology or weights change. Summaries are recomputed along the affected cluster path.`,
  };

  yield {
    state: clusterGraph(`Cut edge ${cutEdge} and rebuild affected clusters`, {
      cd: 'cut',
      acd: 'split',
      abc: 'kept',
    }),
    highlight: { removed: ['cd', 'e-c-d'], active: ['acd'], found: ['abc'], compare: ['ce'] },
    explanation: `Cutting ${cutEdge} removes one leaf cluster and splits the top-tree path above it. The remaining cluster ABC and side cluster ${sideCluster} stay reusable.`,
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
    explanation: `The pattern is uniform across all ${numQueryTypes} query types (${queryTypes.join(', ')}): define what each cluster stores, define how ${2} children combine, expose the desired boundary, then read the root summary.`,
  };
}

function* diameterCaseStudy() {
  const diamEndpoints = ['A', 'D'];
  const sideVertex = 'E';
  const summaryFields = ['inside', 'left bdry', 'right bdry', 'best pair'];
  const numSummaryFields = summaryFields.length;
  const maxBoundary = 2;
  const numCandidates = 3;
  const costBound = 'O(log n)';
  const sideEdge = 'CE';
  const rootCluster = 'A-D';
  const cautionCategories = ['API', 'lazy', 'bdry', 'debug'];
  const numCautions = cautionCategories.length;

  yield {
    state: clusterGraph('Maintain network diameter under link/cut'),
    highlight: { active: ['acd', 'abc', 'cd', 'ce'], found: ['a', 'd'], compare: ['e'] },
    explanation: `A dynamic network dashboard needs the current tree diameter after links fail or recover. The diameter endpoints here are ${diamEndpoints.join(' and ')}, with side vertex ${sideVertex}. A top tree stores diameter endpoints and length in every cluster.`,
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
    explanation: `Each cluster keeps ${numSummaryFields} fields (${summaryFields.join(', ')}). These boundary distances test whether the best pair stays inside one child or crosses between children via the ${maxBoundary} boundary vertices.`,
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
    explanation: `The parent cluster compares ${numCandidates} constant-size candidates (diam C1, diam C2, farL + farR) derived from child summaries. No vertex scan is needed.`,
  };

  yield {
    state: clusterGraph('After a link, only a logarithmic cluster path updates', {
      ce: 'new side',
      acd: 'new diam?',
      a: 'end?',
      e: 'end?',
    }),
    highlight: { active: ['ce', 'e-ce-c', 'acd'], found: ['a', 'e'], compare: ['d'] },
    explanation: `When side edge ${sideEdge} links in, the top tree rebuilds ${costBound} affected clusters and recomputes diameter summaries along that path. The dashboard reads root cluster ${rootCluster} for the new diameter.`,
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
        [`<=${maxBoundary}`, 'expose'],
        ['brute', 'bug'],
      ],
    ),
    highlight: { active: ['api:rule', 'boundary:rule'], found: ['debug:risk'], compare: ['lazy:risk'] },
    explanation: `${numCautions} production cautions (${cautionCategories.join(', ')}): summaries must be small, joins constant time, boundary count at most ${maxBoundary}, and expose rules tested against brute-force dynamic trees.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has three views. "Cluster interface" shows how a five-vertex tree decomposes into leaf clusters (one per edge) and internal clusters built by compress and rake joins. "Expose path" shows how expose(A, D) rearranges the cluster hierarchy so the root cluster spans the A-D path, then demonstrates link, cut, and path-aggregate queries. "Diameter case study" shows how each cluster stores boundary distances and internal diameter so the tree diameter can be read from the root after any topology change.',
        'Active nodes are the clusters or vertices being modified right now. Found nodes are results: the root cluster holding a final aggregate, or the endpoints of a diameter. Compare nodes are side structures (raked subtrees, alternative endpoints) that participate in the logic but are not the primary focus of the current step.',
        {
          type: 'note',
          text: 'At each frame, ask: which clusters changed, why the join or split is valid, and what the root cluster now summarizes. If you cannot answer the third question, the frame has not taught you anything yet.',
        },
        {
          type: 'callout',
          text: 'A top tree works because every large tree query is reduced to constant-size facts at two-boundary clusters.',
        },
      
        {type: 'image', src: './assets/gifs/top-tree-cluster-dynamic-forest.gif', alt: 'Animated walkthrough of the top tree cluster dynamic forest visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A dynamic forest is a collection of trees where edges appear and vanish over time. After each change, queries ask about paths ("what is the sum from u to v?"), components ("what is the diameter of this tree?"), or marked subsets ("where is the nearest flagged vertex?"). The challenge is answering these queries without rescanning the whole component after every link or cut.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Tree_graph.svg/250px-Tree_graph.svg.png', alt: 'Small undirected tree graph with six labeled vertices', caption: 'Top trees start from ordinary graph-theory trees, then maintain a balanced hierarchy over their edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Tree_graph.svg.' },
        'Static decompositions -- Heavy-Light Decomposition, Euler tour arrays, binary lifting -- assume fixed topology. They answer path and subtree queries efficiently, but rebuilding them after a structural change costs O(n) in the worst case. Link-Cut Trees handle dynamic topology but expose only path aggregates natively; component-wide queries like diameter require extra bookkeeping. Euler Tour Trees handle dynamic connectivity and some component aggregates, but lack the boundary-aware path interface needed for richer summaries.',
        {
          type: 'quote',
          text: 'We present a data structure, called top tree, that maintains a dynamic forest and can report summary information about paths and trees.',
          attribution: 'Alstrup, Holm, de Lichtenberg, Thorup -- "Maintaining Information in Fully Dynamic Trees with Top Trees" (2005)',
        },
        'Top trees solve this by decomposing each tree into a balanced hierarchy of clusters, each with at most two boundary vertices. Application logic lives in small per-cluster summaries. The data structure handles all rebalancing; the user writes only the combine rule.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing a team tries is recomputation. After a link or cut, walk the affected component with BFS or DFS, recompute whatever aggregate is needed, and return the answer. This is correct and simple. For a 200-node network with one topology change per second, it is fast enough.',
        'The next step up is a static decomposition rebuilt on change. Keep a Heavy-Light Decomposition with segment trees over each heavy chain. Path queries run in O(log^2 n). When an edge is cut or linked, rebuild the HLD from scratch. Rebuilding is O(n), but if changes are rare relative to queries, the amortized cost may be acceptable.',
        'Both approaches share a property: the cost of a topology change scales with the component size, not with the change size. A single edge cut in a million-node tree triggers a million-node rebuild even though only one edge disappeared.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not connectivity -- Euler Tour Trees already solve dynamic connectivity in O(log n). The wall is rich aggregates under dynamic topology. Consider maintaining the diameter of a tree that changes shape. Diameter is a non-local property: it depends on the two farthest vertices, which can be anywhere. When an edge is cut, the old diameter might split across the two new components, and a new diameter must be found in each. A naive scan is O(n) per change.',
        'Link-Cut Trees offer O(log n) amortized path operations, but their splay-based structure gives amortized bounds, not worst-case. For real-time systems that need guaranteed per-operation latency, amortized O(log n) is not the same as worst-case O(log n). Link-Cut Trees also lack a native interface for non-path queries like diameter, center, or median -- those require custom extensions that fight the splay structure.',
        'The deeper problem is interface. HLD, ETT, and LCT each encode tree information in their own way (chains, Euler sequences, preferred paths). None of them offer a generic framework where the user defines a small summary type and a combine rule, and the data structure handles everything else. Every new aggregate requires rethinking the encoding.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A top tree decomposes a tree into clusters. Each cluster is a connected subtree of the original tree with at most two boundary vertices -- the points where the cluster connects to the rest of the tree. Leaf clusters correspond to individual edges. Internal clusters are formed by joining two adjacent clusters.',
        {
          type: 'diagram',
          label: 'Cluster hierarchy for path A-B-C-D with side edge C-E',
          text: [
            '            [A-----D]          root cluster (compress)',
            '           /         \\',
            '      [A---C]       [C-D]      internal / leaf',
            '     /       \\',
            '  [A-B]     [B-C]              leaf clusters',
            '',
            '  Side branch C-E is raked into [C-D] or handled',
            '  separately, folding its information into the',
            '  path cluster without adding a third boundary.',
          ].join('\n'),
        },
        'Two join operations build the hierarchy. Compress takes two path clusters that share an internal vertex (degree-2 in the path) and merges them into a longer path cluster. The shared vertex stops being a boundary. Rake takes a cluster attached as a side branch at a boundary vertex and folds it into the path cluster at that vertex. The side cluster disappears; its information is absorbed into the path cluster summary. Rake never adds boundaries -- it removes the side attachment point.',
        'The key operations are expose, link, and cut. expose(u, v) restructures the cluster hierarchy so that u and v become the boundary vertices of the root cluster. This makes any path aggregate between u and v readable from the root summary in O(1). link(u, v) creates a new edge cluster and merges two component hierarchies. cut(u, v) locates the edge cluster, removes it, and splits the hierarchy into two valid top trees. All three operations touch O(log n) clusters when the hierarchy is balanced.',
        {
          type: 'code',
          language: 'text',
          text: [
            'expose(u, v):',
            '  1. Soft-expose u: splice clusters until u is a boundary of the root',
            '  2. Soft-expose v: splice until v is the other boundary of the root',
            '  3. Root cluster now represents the u-v path',
            '  4. Read the root summary for the path aggregate',
            '',
            'join(A, B):  -- A and B share a boundary vertex',
            '  parent.summary = combine(A.summary, B.summary)',
            '  parent.boundary = (A.boundary UNION B.boundary) \\ {shared vertex}',
            '',
            'split(P):    -- inverse of join',
            '  push lazy tags from P to children',
            '  restore A.summary and B.summary',
          ].join('\n'),
        },
        'The user defines four callbacks: create (initialize a leaf cluster from an edge), join (combine two child summaries into a parent summary), split (push lazy tags from parent to children before breaking apart), and destroy (clean up when an edge is removed). The top-tree engine calls these automatically during restructuring. The user never touches the cluster hierarchy directly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on a local invariant: every cluster summary is a complete, self-contained summary of the connected subgraph it represents, parameterized only by its boundary vertices. If both children satisfy this invariant and the join callback is correct, the parent satisfies it too. This is structural induction over the cluster hierarchy.',
        'The two-boundary restriction is what makes the join callback tractable. A cluster with two boundaries behaves like a directed pipe: information enters at one boundary and exits at the other, with possible internal structure folded in. The parent needs to combine two pipes that share an endpoint. With at most two boundaries per cluster, the number of cases in a join is constant. If clusters could have k boundaries, the join would need to track O(k^2) boundary-to-boundary interactions, and the constant-time guarantee would collapse.',
        'Balance ensures that only O(log n) clusters sit on the path from any leaf to the root. A topology change (link or cut) modifies one leaf cluster, then repairs summaries upward along O(log n) ancestors. Expose rearranges at most O(log n) clusters. Because each join or split is O(1) by the constant-size summary contract, the total work per operation is O(log n) worst-case -- not amortized.',
        {
          type: 'note',
          text: 'The worst-case O(log n) bound distinguishes top trees from link-cut trees, which achieve O(log n) amortized via splaying. Self-adjusting top trees (Tarjan and Werneck, 2005) trade the worst-case guarantee for better practical performance by allowing the hierarchy to adapt to access patterns, similar to splay trees.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Link and cut: top trees give O(log n) worst-case updates; link-cut trees give O(log n) amortized updates; Euler tour trees also update dynamically; heavy-light decomposition usually needs an O(n) rebuild after topology changes.',
            'Path aggregate: top trees expose the requested path and answer from the root summary in O(log n) worst-case; link-cut trees handle path aggregates natively with amortized bounds; Euler tour trees do not expose the same path-summary interface.',
            'Component-wide or non-local aggregate: top trees can support diameter, center, and related summaries when the cluster summary is constant-size; other dynamic-tree structures need custom extensions or recomputation.',
            'Space: all four families are O(n) when the per-node or per-cluster summary is constant-size.',
          ],
        },
        'When n doubles, top tree operations add one more level to the cluster hierarchy -- one more join or split. The cost grows as log base 2: a million-node tree needs about 20 cluster levels; a billion-node tree needs about 30. Each level costs one combine call, so the wall-clock time per operation scales with the cost of the combine function times the tree height.',
        'Space is O(n) clusters. Each cluster stores its user-defined summary, two child pointers, boundary vertex identifiers, and lazy tags. For a path-sum aggregate, the summary is one number. For diameter, it is a handful of distances and endpoint identifiers. If the summary is constant-size, the total space is linear in the number of edges.',
        'The hidden cost is implementation complexity. A correct top-tree engine must handle compress and rake joins, their inverses, lazy propagation on split, boundary orientation and reversal, and the expose algorithm that splices the hierarchy. Testing against brute-force dynamic trees on small random inputs is essential -- most bugs are boundary-orientation errors that produce plausible but wrong summaries.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Dynamic network monitoring: maintain diameter, center, or bottleneck capacity of a tree-shaped network as links fail and recover. Each topology change updates O(log n) cluster summaries instead of rescanning the component.',
            'Reusable dynamic-forest libraries: once the cluster engine works, adding a new aggregate means defining a summary type and a combine rule. Path sum, path min, nearest marked vertex, and diameter all share the same engine.',
            'Real-time systems requiring worst-case guarantees: top trees offer O(log n) worst-case per operation, unlike link-cut trees whose O(log n) is amortized. A single expensive splay in a link-cut tree can violate a latency SLA.',
            'Non-local tree queries under dynamic topology: diameter, center, median, and radius are properties of the whole tree, not just a path. Top trees handle these through custom cluster summaries without requiring a separate data structure.',
          ],
        },
        'The pattern is always the same: define what each cluster stores, define how two children combine, and the engine handles topology. This separation of concerns is the real payoff. A team that builds the engine once can serve many aggregates without reimplementing the dynamic-tree machinery.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Top trees are overkill when the tree is static. Heavy-Light Decomposition with segment trees is simpler to implement, easier to debug, and sufficient for static path and subtree queries. If the topology never changes, the dynamic machinery adds complexity without benefit.',
        'They fail when the aggregate is not composable from constant-size boundary-aware summaries. If a cluster needs to store all vertices, a sorted list of values, or an unbounded set of marked nodes, the join callback is no longer O(1), and the logarithmic guarantee disappears. The data structure is only as fast as the combine rule.',
        'For competitive programming, top trees are rarely the right choice. The implementation is long, error-prone, and hard to debug under contest time pressure. Link-Cut Trees cover most contest problems involving dynamic trees, and HLD covers static ones. Top trees earn their keep in library code and production systems, not in one-off solutions.',
        {
          type: 'note',
          text: 'Self-adjusting top trees (Tarjan and Werneck, 2005) sacrifice the worst-case bound for practical speed by adapting the cluster hierarchy to access patterns. In experiments, they outperform balanced top trees on skewed workloads but lose the worst-case guarantee. Choose based on whether your system needs guaranteed latency or average throughput.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Alstrup, Holm, de Lichtenberg, Thorup -- "Maintaining Information in Fully Dynamic Trees with Top Trees," ACM Transactions on Algorithms, 2005. Defines the cluster interface, compress/rake joins, and the O(log n) worst-case bound.',
            'Self-adjusting variant: Tarjan and Werneck -- "Self-Adjusting Top Trees," SODA 2005. Trades worst-case for practical speed via access-adaptive restructuring.',
            'Implementation reference: Eppstein, Galil, Italiano, Nissenzweig -- "Sparsification," JACM 1997. Context for how top trees fit into the broader dynamic-graph toolbox.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Heavy-Light Decomposition -- static path queries on trees.',
            'Prerequisite: Link-Cut Tree -- dynamic path queries with amortized bounds.',
            'Prerequisite: Euler Tour Tree -- dynamic connectivity and subtree aggregates.',
            'Prerequisite: Segment Tree -- range queries that top tree summaries generalize.',
            'Extension: self-adjusting top trees -- access-adaptive cluster hierarchies.',
            'Application: dynamic diameter, center, and radius maintenance in network monitoring.',
          ],
        },
        'The essential question for any proposed top-tree aggregate is: can two child cluster summaries be joined into a parent summary using only constant-size, boundary-aware information? If yes, the aggregate fits the framework. If no, a different data structure is needed.',
      ],
    },
  ],
};
