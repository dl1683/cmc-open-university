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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Louvain pass" walks through the greedy local-move and aggregation cycle that produces a hierarchical partition. "Leiden refinement" shows the extra step Leiden inserts to fix badly connected communities before aggregation. Active highlights mark the node or community under evaluation. Found highlights mark a decision that has been locked in. Compare highlights mark alternatives being weighed against the active choice.',
        'In the matrix frames, rows are candidate moves and columns are the quantities that determine whether a move improves modularity. The highlighted cell is the winning option. Follow the delta-modularity column: a positive value means the move is accepted, zero means no improvement, and the algorithm moves on.',
        'At each frame, ask three things: what partition exists right now, what move is being tested, and whether the move improved the objective or exposed a structural flaw.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large graphs are hard to understand one vertex at a time. A social network may have millions of accounts, a code dependency graph may have thousands of modules, and a knowledge graph built from documents may have millions of entity-relationship triples. Humans cannot reason about structure at that scale without compression. Community detection compresses a graph into groups that are denser internally than externally, so each group can stand in for a topic, team, subsystem, or summary unit.',
        {
          type: 'quote',
          text: 'Community structure is one of the most relevant features of graphs representing real systems. Its identification is critical for understanding the function, organization, and dynamics of complex networks.',
          attribution: 'Blondel, Guillaume, Lambiotte, Lefebvre -- "Fast unfolding of communities in large networks" (2008)',
        },
        'Louvain (Blondel et al., 2008) and Leiden (Traag, Waltman, van Eck, 2019) are the two most widely deployed algorithms for this job. Both optimize modularity -- a score that measures how much edge weight falls inside communities compared to what a random graph with the same degree sequence would produce. The output is a hierarchical partition: communities of nodes, then communities of communities, at increasing levels of coarseness.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest grouping rule is connected components: run BFS or union-find and put every reachable node in the same bucket. That works when groups are literally disconnected, but real graphs rarely cooperate. One weak bridge between two dense clusters merges them into a single component even though they represent different topics. In a citation graph, one shared reference connects two unrelated research areas. In a service dependency graph, one shared logging library connects every microservice.',
        'A more principled attempt is global optimization: define a quality score for the whole partition and search for the best one. The trouble is combinatorial. The number of ways to partition n nodes into groups is the Bell number, which grows faster than exponential. For 100 nodes, the Bell number exceeds 4 * 10^115. Exhaustive search is hopeless; even approximate global search is expensive for graphs with millions of edges.',
        'So the field needs a heuristic that improves a score locally, scales to large graphs, and produces partitions that are useful -- not just high-scoring.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall has two faces. The first is scale: the number of possible partitions is astronomical, so any practical algorithm must be greedy or approximate. The second is structural: a partition can score well by modularity while being internally broken.',
        'Louvain hits the structural wall. Because it optimizes modularity greedily and then aggregates communities into supernodes, it can produce communities that are disconnected internally. Imagine two dense clusters A and B connected by a single bridge edge. Louvain may merge them into one community because the combined modularity contribution is higher than keeping them separate. The modularity score is happy, but the community is held together by one edge. Remove that edge and the "community" falls into two pieces that share nothing.',
        {
          type: 'note',
          text: 'Traag, Waltman, and van Eck (2019) proved this is not a rare edge case. They constructed families of graphs where Louvain provably returns disconnected communities, and showed the problem persists across random seeds and resolution values. The bug is architectural: aggregation locks in mistakes that later passes cannot undo.',
        },
        'There is a deeper wall called the resolution limit, identified by Fortunato and Barthelemy (2007). Modularity optimization cannot detect communities smaller than a scale that depends on the total edge weight of the graph. Two perfectly clear clusters can be merged into one community if the graph is large enough, because the null-model penalty for splitting them becomes smaller than the gain from combining them. No amount of algorithmic cleverness fixes this; it is a property of the modularity function itself.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Both algorithms follow a two-phase loop: local moves, then aggregation. Louvain runs the loop directly. Leiden inserts a refinement step between the two phases.',
        {
          type: 'diagram',
          text: [
            'LOUVAIN LOOP:',
            '',
            '  [singleton partition] --> LOCAL MOVE PHASE --> [improved partition]',
            '        ^                   (greedy node moves        |',
            '        |                    that increase Q)         v',
            '        |                                      AGGREGATION PHASE',
            '        |                                      (communities become',
            '        +---------- repeat until no gain <----  supernodes)',
            '',
            '',
            'LEIDEN LOOP:',
            '',
            '  [singleton partition] --> LOCAL MOVE PHASE --> [candidate partition]',
            '        ^                                              |',
            '        |                                              v',
            '        |                                      REFINEMENT PHASE',
            '        |                                      (split badly connected',
            '        |                                       communities)',
            '        |                                              |',
            '        |                                              v',
            '        +---------- repeat until no gain <---- AGGREGATION PHASE',
          ].join('\n'),
          label: 'Louvain vs Leiden: the refinement phase is the key difference',
        },
        'In the local move phase, every node starts in its own singleton community. The algorithm visits each node, computes the modularity gain from moving it into each neighboring community, and executes the best positive move. It repeats until a full pass over all nodes produces no improvement. The modularity gain for moving node i into community C is computed from local information only: the edge weight from i to nodes in C, the total degree of C, and the degree of i.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Modularity gain from moving node i into community C',
            '// Q = (1/2m) * sum_ij [ A_ij - (k_i * k_j)/(2m) ] * delta(c_i, c_j)',
            '//',
            '// Delta Q for moving node i from its current community to C:',
            'function modularityGain(edgeWeightToC, totalWeightC, degreeI, totalEdgeWeight) {',
            '  const m2 = 2 * totalEdgeWeight;',
            '  // Gain from new internal edges minus null-model penalty',
            '  return (edgeWeightToC / m2) - (totalWeightC * degreeI) / (m2 * m2);',
            '}',
            '',
            '// Example: node C (degree 9) considering community {D,E,F}',
            '// edgeWeightToC = 4 (edge C-D has weight 4)',
            '// totalWeightC  = 8 (sum of degrees of D,E,F inside their community)',
            '// degreeI       = 9 (total degree of node C)',
            '// totalEdgeWeight = 21 (sum of all edge weights in graph)',
            'const gain = modularityGain(4, 8, 9, 21);',
            '// gain > 0, so the move is accepted',
          ].join('\n'),
        },
        'In the aggregation phase, each community becomes a single supernode in a new, smaller graph. Edges between nodes in different communities become weighted edges between the corresponding supernodes. Edges between nodes in the same community become self-loop weight on that supernode. The algorithm then runs local moves again on this compressed graph. The hierarchy emerges naturally: level 0 is the original graph, level 1 groups original nodes, level 2 groups communities of communities.',
        'Leiden adds the refinement phase between local moves and aggregation. It takes the candidate partition from the local move phase and checks each community for internal connectivity. If a community is poorly connected -- for example, held together by a single bridge edge -- the refinement step splits it into well-connected subcommunities. Only the refined partition is passed to aggregation. This prevents broken communities from becoming permanent supernodes that later passes cannot decompose.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Louvain works as a scalable heuristic because each local move decision uses only local information: the edges from one node to its neighbors and the aggregate statistics of nearby communities. No global partition search is needed. Aggregation then shrinks the graph, so later passes operate on fewer nodes with heavier edges. For sparse graphs, the total work per level is proportional to the number of edges, and the number of levels is typically logarithmic in the graph size.',
        'The correctness claim must be stated carefully. Louvain does not guarantee the globally optimal modularity partition. It greedily climbs toward a local optimum, and different random orderings of nodes produce different results. The useful invariant is weaker but real: every accepted move strictly increases modularity at the current level, and aggregation faithfully preserves the edge weight structure needed to continue optimizing at the next level.',
        'Leiden strengthens the structural guarantee. The Leiden paper proves that every community in the final partition is gamma-connected: for any two nodes in a community, there exists a path between them that stays inside the community and whose edges all exceed a weight threshold determined by the resolution parameter gamma. This rules out the disconnected-community failure mode of Louvain. The guarantee holds because refinement splits any community that violates it before aggregation can lock it in.',
        'Neither algorithm escapes the resolution limit. Both optimize modularity (or a parameterized variant), so both are blind to communities below the resolution-dependent size threshold. This is not a bug in the algorithm; it is a property of the objective function. If you need to detect small communities in a large graph, you need either a different objective (like the constant Potts model) or multi-resolution analysis.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Algorithm', 'Time per pass', 'Space', 'Guarantees', 'Key weakness'],
          rows: [
            ['Louvain', 'O(m) amortized per level', 'O(n + m)', 'Greedy modularity increase', 'Disconnected communities possible'],
            ['Leiden', 'O(m) amortized per level', 'O(n + m)', 'Communities are gamma-connected', 'Refinement adds constant-factor overhead'],
            ['Label propagation', 'O(m) per iteration', 'O(n)', 'None (non-deterministic)', 'Unstable; oscillates on ambiguous graphs'],
            ['Spectral clustering', 'O(n^3) or O(n*m) with Lanczos', 'O(n^2) for eigenvectors', 'Based on graph Laplacian spectrum', 'Requires k upfront; expensive on large graphs'],
            ['Infomap', 'O(m) per iteration', 'O(n + m)', 'Minimizes description length (map equation)', 'Different objective; may disagree with modularity'],
          ],
        },
        'For Louvain and Leiden, the dominant cost is scanning edges during the local move phase. Each node inspects its neighbors and computes modularity gain for each neighboring community. In sparse graphs with good data layouts (compressed sparse row or adjacency arrays), this is close to linear in the number of edges per pass. Multiple passes and multiple levels add constant factors, but the graph shrinks at each level, so total work is typically O(m log n) in practice.',
        'Memory is O(n + m): the adjacency structure plus per-node community labels and per-community degree totals. Leiden requires additional bookkeeping for the refinement step -- tracking subcommunities within each community -- but this does not change the asymptotic bound.',
        'The practical cost difference between Louvain and Leiden is small. Leiden is roughly 2-3x slower per pass due to refinement, but it often converges in fewer levels because the refined partition is a better starting point for the next aggregation. For graphs with millions of edges, both run in seconds on a single core.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Social network analysis is the original home. Facebook, Twitter, and LinkedIn use community detection to identify friend groups, interest clusters, and coordinated behavior. Biology uses it to cluster protein interaction networks, gene co-expression networks, and neural connectomes. Security teams use it to find clusters of related accounts, IP addresses, or transactions in fraud graphs.',
        'GraphRAG (retrieval-augmented generation over knowledge graphs) makes the stakes concrete. Nodes are entities extracted from documents. Edges are relationships supported by source text. Community detection decides which entities get summarized together before a language model writes a community report. A coherent community produces a focused summary. A disconnected community forces the model to blend unrelated evidence into one report, degrading answer quality for every downstream query that touches it.',
        'Software engineering applies community detection to dependency graphs to find module boundaries, to call graphs to identify subsystems, and to co-change graphs (files that change together in commits) to detect hidden coupling. The output guides refactoring: if two modules are in the same community by co-change but in different directories, the code organization does not match the actual development pattern.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A community is not ground truth. It is a function of the graph you built, the weights you assigned, the objective you optimized, and the resolution parameter you chose. If the graph has missing edges, duplicate entities, extraction errors, or biased weights, the partition inherits every flaw. Garbage graph in, garbage communities out.',
        'The resolution limit means small communities can be invisible. Two perfectly distinct clusters of 10 nodes each can be merged into one community in a graph with 10,000 nodes, because the modularity penalty for splitting them is too small to notice. Multi-resolution sweeps help (run the algorithm at several resolution values and compare), but they multiply the interpretation burden.',
        'Hub nodes are a persistent headache. A node connected to many communities will be assigned to one of them, dragging unrelated neighbors along. In knowledge graphs, high-degree entities like "United States" or "machine learning" connect nearly everything and distort community boundaries. Practical pipelines often cap node degree or remove hubs before clustering.',
        'Nondeterminism makes reproducibility harder than it looks. Both Louvain and Leiden depend on the order in which nodes are visited, which is typically randomized. Different seeds produce different partitions with similar modularity scores. For research or production pipelines, run multiple seeds and use consensus clustering or stability analysis to identify robust communities.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Blondel, Guillaume, Lambiotte, Lefebvre -- "Fast unfolding of communities in large networks," Journal of Statistical Mechanics (2008). The original Louvain paper; defines the two-phase loop and demonstrates scalability to networks with 10^8 edges.',
            'Traag, Waltman, van Eck -- "From Louvain to Leiden: guaranteeing well-connected communities," Scientific Reports (2019). Proves Louvain can return disconnected communities and introduces the refinement phase that fixes it.',
            'Fortunato, Barthelemy -- "Resolution limit in community detection," PNAS (2007). Proves that modularity optimization has a fundamental resolution limit: communities below a size threshold are invisible to the objective function.',
            'Newman, Girvan -- "Finding and evaluating community structure in networks," Physical Review E (2004). Defines the modularity function Q and establishes the null-model framework.',
            'Rosvall, Bergstrom -- "Maps of random walks on complex networks reveal community structure," PNAS (2008). The Infomap algorithm; a contrasting approach that minimizes description length instead of maximizing modularity.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Graph Representations (adjacency list, CSR) -- the data layout that makes neighbor scans fast.',
            'Prerequisite: Breadth-First Search -- the traversal primitive behind connected-component checks.',
            'Extension: PageRank -- another global graph score, but for node importance rather than community structure.',
            'Contrast: K-Means Clustering -- community detection partitions a graph by edge density; k-means partitions vectors by distance. Same goal, different geometry.',
            'Application: GraphRAG and Knowledge Graphs -- where community quality directly controls summary quality.',
          ],
        },
      ],
    },
  ],
};

