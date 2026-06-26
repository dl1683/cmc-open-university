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
    { heading: 'How to read the animation', paragraphs: ['Read the animation as a hierarchy over a changing forest. A dynamic forest is a set of trees where edges can be linked and cut. A top-tree cluster is a connected piece with at most two boundary vertices.', {type: 'note', text: 'At each frame, ask: which clusters changed, why the join or split is valid, and what the root cluster now summarizes. If you cannot answer the third question, the frame has not taught you anything yet.'}, {type: 'callout', text: 'A top tree works because every large tree query is reduced to constant-size facts at two-boundary clusters.'}, {type: 'image', src: './assets/gifs/top-tree-cluster-dynamic-forest.gif', alt: 'Animated walkthrough of the top tree cluster dynamic forest visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Static tree preprocessing breaks when edges appear and disappear. After each link or cut, queries may ask for path sums, component diameter, or nearest marked vertices. Top trees exist to update those answers without rescanning the whole component.', { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Tree_graph.svg/250px-Tree_graph.svg.png', alt: 'Small undirected tree graph with six labeled vertices', caption: 'Top trees start from ordinary graph-theory trees, then maintain a balanced hierarchy over their edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Tree_graph.svg.' },], },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is recomputation. After an edge changes, run DFS or BFS and rebuild the aggregate. Heavy-light decomposition helps static path queries, but a topology update can force a rebuild.'], },
    { heading: 'The wall', paragraphs: ['The wall is rich aggregate maintenance under dynamic topology. Connectivity alone is easier than maintaining diameter, center, or boundary-aware path facts. One edge cut in a million-edge tree should not require a million-edge scan if summaries can be repaired locally.'], },
    { heading: 'The core insight', paragraphs: ['Decompose every tree into clusters with at most two boundary vertices. Each cluster stores a constant-size summary of what the outside world needs through those boundaries. Compress joins path clusters, and rake folds side clusters into path clusters.'], },
    { heading: 'How it works', paragraphs: ['Each edge begins as a leaf cluster. Internal clusters are built by compress and rake joins until the root summarizes the component. expose(u, v) restructures the hierarchy so u and v become root boundaries, making the u-v path summary readable at the root.'], },
    { heading: 'Why it works', paragraphs: ['Correctness is structural induction. Leaf summaries are correct by construction. If two child summaries fully describe their clusters through their boundaries, a correct join rule makes the parent summary correct. The two-boundary rule keeps joins constant-size.'], },
    { heading: 'Cost and complexity', paragraphs: ['Balanced top trees support link, cut, and expose in O(log n) cluster changes when summaries are constant-size. Space is O(n) clusters. Doubling n adds about one hierarchy level, but implementation complexity is high because boundary orientation and inverse splits must be exact.'], },
    { heading: 'Real-world uses', paragraphs: ['Top trees fit dynamic network monitoring, reusable dynamic-forest libraries, and systems that need path or component facts after topology changes. Diameter maintenance is a natural example because the root can store endpoint candidates and distances after every link or cut.'], },
    { heading: 'Where it fails', paragraphs: ['Top trees are overkill for static trees. They also fail when the aggregate cannot be summarized through constant-size boundary facts. If each cluster must store all marked vertices or a sorted list, the logarithmic guarantee disappears.'], },
    { heading: 'Worked example', paragraphs: ['Take path A-B-C-D with weights 2, 5, and 3. Leaf clusters store those edge weights. Compress A-B and B-C into A-C with length 7, then compress A-C and C-D into A-D with length 10.', 'If a side edge C-E has weight 4, rake folds that branch at boundary C. For diameter, the summary compares A-D length 10 with A-E length 11 and D-E length 7. The root keeps A-E as the current diameter.'], },
    { heading: 'Sources and study next', paragraphs: ['Read Alstrup, Holm, de Lichtenberg, and Thorup on top trees, and Tarjan and Werneck on self-adjusting top trees. Study segment trees, heavy-light decomposition, Euler tour trees, link-cut trees, and dynamic diameter next.'], },
  ],
};
