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
    explanation: 'Community detection looks for groups with many internal edges and fewer outside edges. The graph is usually weighted: strong relationships should count more than weak incidental links.',
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
    explanation: 'The second phase collapses each community into a supernode. Edges between communities become weighted edges between supernodes; internal edges become self-loop weight. Louvain then repeats the same local-move process on the smaller graph.',
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
    explanation: 'In retrieval systems, a badly connected community becomes a bad summary unit: unrelated entities get summarized together because one weak bridge held the partition together.',
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
      heading: 'What it is',
      paragraphs: [
        'Louvain and Leiden are community-detection algorithms for large graphs. Given a weighted graph, they partition nodes into groups that are denser internally than externally. The output is not a traversal path or a shortest path tree; it is a graph compression: many vertices become a smaller set of meaningful communities.',
        'The Louvain method, introduced by Blondel, Guillaume, Lambiotte, and Lefebvre, is a fast heuristic based on modularity optimization: https://arxiv.org/abs/0803.0476. It became popular because it scales well and naturally creates a hierarchy. Leiden, introduced by Traag, Waltman, and van Eck, keeps the useful hierarchy but adds refinement to guarantee better-connected communities: https://pmc.ncbi.nlm.nih.gov/articles/PMC6435756/.',
      ],
    },
    {
      heading: 'How Louvain works',
      paragraphs: [
        'Louvain alternates two phases. First, each node starts in its own community. The algorithm visits nodes and considers moving each node into one of its neighboring communities. A move is kept if it improves modularity, a score that compares the observed internal edge weight against what would be expected from node degrees. Second, once local moves stop improving the score, each community is collapsed into a supernode and the process repeats on the smaller graph.',
        'This is why Louvain belongs beside Compressed Sparse Row Graph and GraphBLAS Sparse Matrix Graph Case Study. On a huge graph, most of the work is neighbor scanning, weight aggregation, and rebuilding smaller graph levels. The conceptual algorithm is simple, but the data layout decides whether it can run on millions or billions of edges.',
      ],
    },
    {
      heading: 'What Leiden changes',
      paragraphs: [
        'The Leiden paper shows that Louvain can return badly connected communities, including disconnected ones in worst cases. Leiden adds a refinement phase between local moving and aggregation. Instead of blindly aggregating the Louvain partition, it splits and refines communities so the next level is built from better-connected parts. The `leidenalg` documentation summarizes this practical motivation and guarantee: https://leidenalg.readthedocs.io/en/stable/intro.html.',
        'The practical lesson is that a high modularity score is not the same as a good explanation of the graph. A community should be useful as a unit. If it contains two dense blobs connected by a weak bridge, a report, dashboard, or GraphRAG summary built over that community may mix unrelated stories.',
      ],
    },
    {
      heading: 'Complete case study: GraphRAG communities',
      paragraphs: [
        'In GraphRAG, the graph nodes are extracted entities and the edges are relationships from source documents. Community detection decides which entities get grouped before an LLM writes a community report. If the partition is coherent, a report can summarize a real theme such as "payment rollout failures" or "identity-provider incidents." If the partition is noisy, the report becomes a forced blend of unrelated evidence.',
        'A production pipeline should treat the community algorithm as a quality gate, not as decoration. Check whether high-degree hubs are swallowing unrelated entities. Inspect small communities for fragmentation. Compare global-search answers against source-backed local retrieval. Track which summary came from which entity set and which source chunks, because a clean partition is still not proof that every generated sentence is supported.',
      ],
    },
    {
      heading: 'Pitfalls and tuning',
      paragraphs: [
        'Community detection is not unique. Different random seeds, edge weights, resolution settings, and graph construction choices can produce different partitions. The resolution parameter controls granularity: too low can merge separate themes, while too high can fragment one theme into many tiny clusters. NetworkX exposes Louvain resolution, threshold, weight, and seed controls in its implementation docs: https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.community.louvain.louvain_communities.html.',
        'Do not read a community as objective truth. It is a model of the graph you built, and the graph may already contain extraction errors, missing edges, duplicate entities, or biased weights. For software architecture graphs, a community may mean a subsystem. For social graphs, it may mean a social group. For document graphs, it may mean a topic. The interpretation comes from the edge semantics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Louvain paper at https://arxiv.org/abs/0803.0476, original Louvain project page at https://perso.uclouvain.be/vincent.blondel/research/louvain.html, Leiden paper at https://pmc.ncbi.nlm.nih.gov/articles/PMC6435756/, Leiden arXiv entry at https://arxiv.org/abs/1810.08473, `leidenalg` docs at https://leidenalg.readthedocs.io/en/stable/intro.html, igraph Leiden docs at https://igraph.org/r/html/1.3.5/cluster_leiden.html, and NetworkX Louvain docs at https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.community.louvain.louvain_communities.html.',
        'Study Compressed Sparse Row Graph, GraphBLAS Sparse Matrix Graph Case Study, Graph BFS, PageRank, K-Means Clustering, Pregel Graph Processing Case Study, and GraphRAG Community Summary Case Study next.',
      ],
    },
  ],
};
