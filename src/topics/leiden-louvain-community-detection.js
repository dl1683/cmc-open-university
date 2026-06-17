// Louvain and Leiden community detection: greedy local modularity moves,
// graph aggregation, and Leiden refinement for well-connected communities.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'leiden-louvain-community-detection',
  title: 'Leiden & Louvain Community Detection',
  category: 'Data Structures',
  summary: 'How large graphs are partitioned into dense communities: local modularity moves, aggregation, and Leiden refinement.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['Louvain pass', 'Leiden refinement'], defaultValue: 'Louvain pass' },
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

function communityGraph(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 0.8, y: 4.8, note: 'blue' },
      { id: 'b', label: 'B', x: 2.4, y: 5.5, note: 'blue' },
      { id: 'c', label: 'C', x: 2.3, y: 3.6, note: 'move?' },
      { id: 'd', label: 'D', x: 5.4, y: 3.7, note: 'orange' },
      { id: 'e', label: 'E', x: 6.9, y: 5.2, note: 'orange' },
      { id: 'f', label: 'F', x: 7.8, y: 3.0, note: 'orange' },
      { id: 'g', label: 'G', x: 4.2, y: 1.8, note: 'bridge' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b', weight: '3' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: '2' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: '2' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: '4' },
      { id: 'e-d-e', from: 'd', to: 'e', weight: '3' },
      { id: 'e-d-f', from: 'd', to: 'f', weight: '3' },
      { id: 'e-e-f', from: 'e', to: 'f', weight: '2' },
      { id: 'e-c-g', from: 'c', to: 'g', weight: '1' },
      { id: 'e-d-g', from: 'd', to: 'g', weight: '1' },
    ],
  }, { title });
}

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'graph', label: 'graph', x: 0.8, y: 3.4, note: 'weighted' },
      { id: 'singletons', label: 'singletons', x: 2.6, y: 5.2, note: 'start' },
      { id: 'move', label: 'local move', x: 4.5, y: 5.2, note: 'gain' },
      { id: 'partition', label: 'partition', x: 6.4, y: 5.2, note: 'communities' },
      { id: 'aggregate', label: 'aggregate', x: 6.4, y: 2.0, note: 'supernodes' },
      { id: 'next', label: 'next level', x: 8.4, y: 3.4, note: 'repeat' },
    ],
    edges: [
      { id: 'e-graph-singletons', from: 'graph', to: 'singletons' },
      { id: 'e-singletons-move', from: 'singletons', to: 'move' },
      { id: 'e-move-partition', from: 'move', to: 'partition' },
      { id: 'e-partition-aggregate', from: 'partition', to: 'aggregate' },
      { id: 'e-aggregate-next', from: 'aggregate', to: 'next' },
      { id: 'e-next-move', from: 'next', to: 'move' },
    ],
  }, { title });
}

function leidenGraph(title) {
  return graphState({
    nodes: [
      { id: 'louvain', label: 'Louvain', x: 0.8, y: 3.5, note: 'partition' },
      { id: 'check', label: 'check', x: 2.7, y: 3.5, note: 'connected?' },
      { id: 'bad', label: 'bad block', x: 4.6, y: 5.2, note: 'weak tie' },
      { id: 'split', label: 'refine', x: 6.2, y: 5.2, note: 'split' },
      { id: 'good', label: 'good blocks', x: 7.9, y: 3.5, note: 'well connected' },
      { id: 'aggregate', label: 'aggregate', x: 6.2, y: 1.8, note: 'supergraph' },
      { id: 'repeat', label: 'repeat', x: 4.6, y: 1.8, note: 'until stable' },
    ],
    edges: [
      { id: 'e-louvain-check', from: 'louvain', to: 'check' },
      { id: 'e-check-bad', from: 'check', to: 'bad' },
      { id: 'e-bad-split', from: 'bad', to: 'split' },
      { id: 'e-split-good', from: 'split', to: 'good' },
      { id: 'e-good-aggregate', from: 'good', to: 'aggregate' },
      { id: 'e-aggregate-repeat', from: 'aggregate', to: 'repeat' },
      { id: 'e-repeat-check', from: 'repeat', to: 'check' },
    ],
  }, { title });
}

function* louvainPass() {
  yield {
    state: communityGraph('A weighted graph has denser internal regions'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e', 'f'], compare: ['g'], found: ['e-a-b', 'e-d-e', 'e-d-f'] },
    explanation: 'Read the graph as a compression problem. Community detection tries to replace many related nodes with groups that have dense internal edges and fewer outside connections.',
  };

  yield {
    state: labelMatrix(
      'Local move score for node C',
      [
        { id: 'stay', label: 'stay alone' },
        { id: 'blue', label: 'join A,B' },
        { id: 'orange', label: 'join D,E,F' },
      ],
      [
        { id: 'internal', label: 'new internal weight' },
        { id: 'penalty', label: 'degree penalty' },
        { id: 'gain', label: 'delta modularity' },
      ],
      [
        ['0', 'low', '0.00'],
        ['4', 'medium', '+0.11'],
        ['4', 'lower here', '+0.16'],
      ],
    ),
    highlight: { active: ['orange:gain', 'orange:internal'], compare: ['blue:gain'], removed: ['stay:gain'] },
    explanation: 'Louvain greedily tries moving one node into neighboring communities. A move is kept when it improves modularity: more weight inside communities than expected under a degree-preserving null model.',
    invariant: 'The algorithm is heuristic: it optimizes a score greedily, not by checking every possible partition.',
  };

  yield {
    state: pipelineGraph('Louvain alternates local moves and aggregation'),
    highlight: { active: ['singletons', 'move', 'partition', 'e-singletons-move', 'e-move-partition'], compare: ['aggregate'] },
    explanation: 'The first phase starts with every node in its own community and repeatedly moves nodes when modularity improves. Once local moves stop helping, the current communities become the partition for this level.',
  };

  yield {
    state: pipelineGraph('Aggregation turns communities into supernodes'),
    highlight: { active: ['partition', 'aggregate', 'next', 'e-partition-aggregate', 'e-aggregate-next'], found: ['move'] },
    explanation: 'The aggregation frame is why Louvain creates a hierarchy. Communities become supernodes, edge weights are rolled up, and the same local-move game repeats on a smaller graph.',
  };

  yield {
    state: labelMatrix(
      'What the levels mean',
      [
        { id: 'level0', label: 'level 0' },
        { id: 'level1', label: 'level 1' },
        { id: 'level2', label: 'level 2' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'nodes', label: 'nodes' },
        { id: 'action', label: 'action' },
      ],
      [
        ['raw graph', 'move vertices'],
        ['community graph', 'move supernodes'],
        ['coarser graph', 'move again'],
        ['no gain', 'return hierarchy'],
      ],
    ),
    highlight: { active: ['level0:action', 'level1:action', 'level2:action'], found: ['stop:action'] },
    explanation: 'The result is naturally hierarchical. That hierarchy is why community detection is useful for graph indexes: each level gives a different compression of the same relationship structure.',
  };
}

function* leidenRefinement() {
  yield {
    state: leidenGraph('Leiden fixes a Louvain failure mode'),
    highlight: { active: ['louvain', 'check', 'bad', 'e-louvain-check', 'e-check-bad'], compare: ['good'] },
    explanation: 'Louvain can produce communities that score well by modularity but are weakly connected internally, or even disconnected after repeated aggregation. Leiden inserts a refinement step before aggregation.',
  };

  yield {
    state: labelMatrix(
      'Why refinement matters',
      [
        { id: 'louvain', label: 'Louvain community' },
        { id: 'refined1', label: 'refined part 1' },
        { id: 'refined2', label: 'refined part 2' },
        { id: 'final', label: 'Leiden result' },
      ],
      [
        { id: 'internal shape', label: 'internal shape' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['two blobs plus bridge', 'badly connected'],
        ['dense left blob', 'safe block'],
        ['dense right blob', 'safe block'],
        ['well-connected groups', 'better summary units'],
      ],
    ),
    highlight: { active: ['louvain:risk'], found: ['final:internal shape'], compare: ['refined1:internal shape', 'refined2:internal shape'] },
    explanation: 'The failure frame matters for GraphRAG. A weakly connected community may still score well, but it becomes a bad summary unit because unrelated entities are forced into one report.',
    invariant: 'Leiden refines communities before constructing the next aggregated graph.',
  };

  yield {
    state: leidenGraph('Refined communities become the next graph'),
    highlight: { active: ['split', 'good', 'aggregate', 'repeat', 'e-split-good', 'e-good-aggregate', 'e-aggregate-repeat'], compare: ['bad'] },
    explanation: 'After refinement, Leiden aggregates the refined partition and repeats. The paper proves stronger guarantees than Louvain: communities are connected, and iterative Leiden converges toward local optimality for subsets inside communities.',
  };

  yield {
    state: labelMatrix(
      'Community detection in GraphRAG',
      [
        { id: 'entities', label: 'entities' },
        { id: 'edges', label: 'relationships' },
        { id: 'cluster', label: 'Leiden/Louvain' },
        { id: 'summary', label: 'community report' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'quality gate', label: 'quality gate' },
      ],
      [
        ['graph nodes', 'entity resolution'],
        ['weighted edges', 'source support'],
        ['partition hierarchy', 'cohesive groups'],
        ['natural-language summary', 'citation provenance'],
      ],
    ),
    highlight: { active: ['cluster:artifact', 'cluster:quality gate'], found: ['summary:quality gate'], compare: ['edges:quality gate'] },
    explanation: 'GraphRAG uses community detection as an indexing primitive. The graph algorithm decides which entities get summarized together, so cluster quality directly affects global-search answer quality.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'Louvain pass') yield* louvainPass();
  else if (view === 'Leiden refinement') yield* leidenRefinement();
  else throw new InputError('Pick a community-detection view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large graphs are hard to understand one vertex at a time. A social graph may contain millions of accounts, a code graph may contain thousands of files and dependencies, and a document graph may contain extracted entities connected by citations, mentions, or shared facts. Community detection exists to compress that graph into groups that are denser internally than externally.',
        'Louvain and Leiden are two widely used algorithms for this job. They do not find shortest paths or connected components. They produce a partition: each node is assigned to a community, and repeated aggregation creates a hierarchy of coarser graph views. The output is useful when a community can stand in for a real subsystem, topic, group, or summary unit.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The simplest grouping rule is connected components: put every reachable node in the same group. That is often too coarse. One weak bridge between two dense clusters merges them into one component even when they mean different things. In a document graph, one shared entity can connect two unrelated themes. In a service graph, one shared library can connect several subsystems.',
        'Another reasonable attempt is global optimization. Define a score for the whole partition and search for the best grouping. The problem is that the number of possible partitions is enormous. Exhaustive search is hopeless for real graphs. Even medium graphs need a heuristic that improves a score locally while keeping the work close to the edges actually present.',
        'The wall is not only scale. It is interpretation. A partition that looks good by one score may still be bad as an explanation. A community can have a high modularity contribution while being internally weak, stretched through a bridge, or sensitive to a resolution setting. Community detection is useful only if the algorithmic grouping matches the meaning of the edges.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Louvain makes the search practical by combining greedy local moves with graph aggregation. Start with every node in its own community. Move a node into a neighboring community if the move improves modularity. When no local move helps, collapse each community into a supernode and repeat the same process on the smaller graph.',
        'Modularity is the score behind the usual Louvain story. It compares how much edge weight falls inside communities against how much would be expected under a degree-preserving null model. A good partition has more internal weight than the degree pattern alone would predict.',
        'Leiden keeps the local-move and aggregation idea but adds refinement before aggregation. The refinement step checks and improves the internal structure of communities so badly connected groups are less likely to become supernodes. That matters because aggregation makes mistakes durable. Once a bad community becomes a supernode, later levels may hide the internal flaw.',
      ],
    },
    {
      heading: 'How Louvain works',
      paragraphs: [
        'A Louvain pass begins with singleton communities. For each node, the algorithm considers communities found among its neighbors. It computes the modularity gain from moving the node into each candidate community and keeps a move only if the gain is positive. This local step is cheap because the node only needs to inspect adjacent edges and the summary statistics of nearby communities.',
        'After repeated local moves stop improving the score, Louvain builds a new graph. Each community becomes a supernode. Edges between original communities become weighted edges between supernodes. Edges inside a community become self-loop weight. The algorithm then runs local moves again on this smaller graph.',
        'The result is hierarchical. Level 0 is the original graph. Level 1 groups original nodes. Level 2 groups communities of communities. That hierarchy is useful for browsing, visualization, graph indexes, and summary systems because it gives several resolutions of the same relationship structure.',
      ],
    },
    {
      heading: 'What Leiden changes',
      paragraphs: [
        'Leiden was designed to fix a Louvain failure mode. Louvain can return communities that are weakly connected internally, and in some cases disconnected. The modularity score may still improve because the score is global and degree-based. But a disconnected or bridge-held group is a poor unit for explanation.',
        'Leiden inserts a refinement phase between local moving and aggregation. It starts from the candidate partition, then refines each community into better-connected parts before constructing the next aggregated graph. The practical effect is that the supernodes passed to the next level are more trustworthy units.',
        'Leiden still uses a heuristic objective; it does not discover objective social truth or semantic truth. Its improvement is narrower and important: it gives stronger guarantees about community connectivity and avoids some partitions Louvain can accept. If the downstream task treats each community as a report, dashboard item, or routing unit, that difference is not cosmetic.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The Louvain view proves that community detection is a compression loop. The graph has dense regions. A local move tests whether a node belongs better with a neighboring group. Aggregation then turns the accepted communities into supernodes, so the next pass works on a smaller graph. The visual is not showing a traversal. It is showing repeated score-improving compression.',
        'The Leiden view proves why refinement belongs before aggregation. The weak block is a warning: a group can be accepted by a score while still being a bad internal unit. Refinement splits that group into better-connected parts before the next graph is built. In GraphRAG terms, it decides whether unrelated entities are forced into one generated community report.',
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        'Louvain works as a scalable heuristic because each local move only needs local edge information and community totals, not a global search over all partitions. Aggregation then shrinks the graph, so later passes operate on fewer nodes. This is why the method can handle large sparse graphs when the data layout supports fast neighbor scans and weight aggregation.',
        'The correctness claim should be stated carefully. Louvain does not guarantee the globally best modularity partition. It greedily climbs toward a local optimum. The useful invariant is weaker: accepted moves improve the objective at the current level, and aggregation preserves the community-level edge weights needed to continue optimizing on a smaller graph.',
        'Leiden strengthens the structural side of the result. By refining communities before aggregation, it avoids using badly connected groups as the atoms of the next level. The final partition is still shaped by the chosen objective, resolution, weights, and random choices, but the communities are better candidates for meaningful units.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is edge scanning. In sparse graphs, good implementations are close to linear in the number of edges per pass, but there can be several passes and levels. Weighted graphs need careful aggregation. Huge graphs need memory-efficient adjacency layouts such as compressed sparse row, plus attention to cache locality and parallel updates.',
        'The main tradeoff is speed versus guarantees. Louvain is fast and simple, but it can produce weak communities. Leiden spends extra refinement work to improve the partition. Both depend on graph construction. If edge weights are noisy, entities are duplicated, or hub nodes connect everything, the algorithm will faithfully optimize a flawed graph.',
        'Resolution is another tax. Low resolution can merge distinct communities into large coarse blocks. High resolution can fragment one real theme into many small blocks. There is rarely one universally correct setting. The right granularity depends on whether the downstream task is browsing, alerting, visualization, recommendation, or summarization.',
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        'Social networks use community detection to find groups with dense interaction. Biology uses it to cluster protein or gene networks. Security teams use it to find related machines, accounts, or events. Software teams can apply it to dependency graphs to identify subsystems or architecture boundaries. Search and recommendation systems use communities as graph features or routing hints.',
        'GraphRAG makes the tradeoff especially visible. Nodes are entities extracted from documents. Edges are relationships supported by source text. Community detection decides which entities are summarized together before a language model writes a community report. A coherent community can produce a useful global summary. A noisy community can force the model to blend unrelated evidence.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not treat a community as objective truth. It is a result of the graph you built, the weights you chose, the objective you optimized, and the resolution you selected. If the graph has missing edges, duplicate entities, extraction errors, or biased weights, the partition inherits those flaws.',
        'Watch for hubs that swallow unrelated nodes, tiny fragments that should be one group, and bridge nodes that glue separate topics together. Compare several seeds and resolution settings. Inspect high-impact communities manually. In document systems, track the source chunks behind each edge and each generated summary, because a clean partition does not prove every sentence in the summary is supported.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study compressed sparse row graphs to understand the memory layout behind fast neighbor scans, GraphBLAS to see graph work as sparse matrix operations, PageRank for another global graph score, and k-means for the contrast between vector clustering and graph clustering. Pregel-style graph processing explains how large graph algorithms are distributed.',
        'For the original algorithms, read the Louvain paper by Blondel, Guillaume, Lambiotte, and Lefebvre, then the Leiden paper by Traag, Waltman, and van Eck. Implementation docs from NetworkX, igraph, and leidenalg are useful once the mechanism is clear, but the engineering lesson is broader: the graph objective only helps if the edge semantics make the resulting communities meaningful.',
      ],
    },
  ],
};
