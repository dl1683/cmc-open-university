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
    explanation: `Read the graph as a compression problem. ${topic.title} tries to replace many related nodes with groups that have dense internal edges and fewer outside connections.`,
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
    explanation: `Louvain greedily tries moving one node into each of the ${3} neighboring communities. A move is kept when it improves modularity — the best delta here is ${'+0.16'}, so node C joins the orange cluster.`,
    invariant: `${topic.title} is heuristic: it optimizes a score greedily, not by checking every possible partition.`,
  };

  yield {
    state: pipelineGraph('Louvain alternates local moves and aggregation'),
    highlight: { active: ['singletons', 'move', 'partition', 'e-singletons-move', 'e-move-partition'], compare: ['aggregate'] },
    explanation: `The first phase starts with every node in its own community and repeatedly moves nodes when modularity improves. The pipeline graph shows ${6} stages — once local moves stop helping, the current communities become the partition for this level.`,
  };

  yield {
    state: pipelineGraph('Aggregation turns communities into supernodes'),
    highlight: { active: ['partition', 'aggregate', 'next', 'e-partition-aggregate', 'e-aggregate-next'], found: ['move'] },
    explanation: `The aggregation frame is why Louvain creates a hierarchy. Communities become supernodes, edge weights are rolled up, and the same local-move game repeats on a smaller graph — this is the core loop in ${topic.title}.`,
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
    explanation: `The result is naturally hierarchical across ${4} rows — level 0 through the stop condition. That hierarchy is why ${topic.category.toLowerCase()} like community partitions are useful for graph indexes: each level gives a different compression of the same relationship structure.`,
  };
}

function* leidenRefinement() {
  yield {
    state: leidenGraph('Leiden fixes a Louvain failure mode'),
    highlight: { active: ['louvain', 'check', 'bad', 'e-louvain-check', 'e-check-bad'], compare: ['good'] },
    explanation: `Louvain can produce communities that score well by modularity but are weakly connected internally, or even disconnected after repeated aggregation. The Leiden half of ${topic.title} inserts a refinement step among the ${7} pipeline nodes before aggregation.`,
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
    explanation: `The failure frame matters for GraphRAG. A weakly connected community may still score well, but it becomes a bad summary unit because unrelated entities are forced into one report — this is why ${topic.title} matters in practice.`,
    invariant: `Leiden refines communities before constructing the next aggregated graph, a guarantee that plain Louvain in the ${topic.category} toolbox does not provide.`,
  };

  yield {
    state: leidenGraph('Refined communities become the next graph'),
    highlight: { active: ['split', 'good', 'aggregate', 'repeat', 'e-split-good', 'e-good-aggregate', 'e-aggregate-repeat'], compare: ['bad'] },
    explanation: `After refinement, Leiden aggregates the refined partition and repeats through ${7} pipeline stages. The paper proves stronger guarantees than Louvain: communities are connected, and iterative Leiden converges toward local optimality for subsets inside communities.`,
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
    explanation: `GraphRAG uses ${topic.title} as an indexing primitive. The graph algorithm decides which entities get summarized together across the ${4} rows shown, so cluster quality directly affects global-search answer quality.`,
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
        'Nodes are vertices in a graph, and edges are relationships between them. A community is a group with more internal edge weight than the grouping would have by chance. The animation marks active nodes, proposed moves, refined groups, and compressed supernodes.',
        'Read every move as a modularity test. Modularity is a score that compares observed internal edges with the internal edges expected from node degrees alone. A move is safe only when the score improves and the later refinement step does not hide a broken community inside a supernode.',
        {type: 'callout', text: 'Leiden adds a repair step to a greedy compression loop, so communities are not allowed to become permanent supernodes while internally broken.'},
        {type: 'image', src: './assets/gifs/leiden-louvain-community-detection.gif', alt: 'Animated walkthrough of the leiden louvain community detection visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large graphs often contain local structure that is not visible from individual edges. A social graph, citation graph, fraud graph, or dependency graph can have millions of vertices, so a human cannot inspect every connection and name groups by hand. Community detection compresses the graph into groups while trying to preserve dense local structure.',
        'Louvain exists because exact modularity maximization is too expensive for large graphs. Leiden exists because Louvain can freeze communities that look good from the outside while being poorly connected inside. The extra refinement pass repairs that failure before compression.',
        {type: 'image', src: 'https://media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41598-019-41695-z/MediaObjects/41598_2019_41695_Fig1_HTML.png', alt: 'Louvain and Leiden community-detection passes showing local moves, refinement, and aggregation.', caption: 'The Leiden paper visualizes the extra refinement step that separates it from Louvain. Source: Traag, Waltman, and van Eck, Scientific Reports 2019, CC BY 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is greedy grouping. Move each node into the neighboring community that gives the largest modularity gain, then compress each community into one node and repeat. This is the Louvain pattern.',
        'The approach is reasonable because it uses local edge evidence and shrinks the graph after every round. If a node sends most of its edge weight into one group, moving it there often improves the score. Compression lets the next pass reason about larger structure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that modularity gain is not the same as internal connectivity. Louvain can create a community whose parts are only weakly connected, then compress that community into a permanent supernode. Later passes cannot see and repair the weak interior.',
        'Resolution is another wall. Modularity can merge small real communities into larger ones when the graph is large. A higher score can still hide useful local structure if the quality function rewards the wrong scale.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Leiden keeps greedy movement and graph compression, but inserts refinement before aggregation. A tentative community is split into connected subcommunities when its interior is not strong enough. Only refined communities become supernodes.',
        'That changes the invariant. Louvain mainly preserves nondecreasing quality. Leiden preserves nondecreasing quality while adding the rule that compressed communities must be internally connected under the refinement criterion.',
      ],
    },    {
      heading: 'How it works',
      paragraphs: [
        'A Leiden iteration has local moving, refinement, and aggregation. Local moving considers a node and moves it to a neighboring community only when the chosen quality score improves. Nodes with no improving move stay where they are.',
        'Refinement then works inside each tentative community. It builds connected pieces and merges only moves that are valid inside that community. Aggregation compresses those refined pieces into supernodes and sums edge weights between them.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows.', caption: 'Community detection starts from a graph; the algorithmic question is which directed or undirected edge evidence belongs inside one compressed group. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The algorithm is heuristic, so correctness does not mean global optimality. The claim is that each accepted local move improves or preserves the selected quality rule, and refinement prevents disconnected or badly connected interiors from being compressed as one unit.',
        'Aggregation is safe because it preserves total edge weight between refined groups. A move in the compressed graph corresponds to moving whole refined communities in the original graph. Since refinement happened first, later passes do not inherit a broken interior as an unchangeable node.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'On sparse graphs, one pass is close to linear in the number of edges because node moves inspect neighboring communities rather than all communities. If m is the number of edges, the practical cost is usually a small multiple of m per pass. The number of passes depends on the graph and resolution setting.',
        'When the graph doubles in edges and average degree stays similar, one pass roughly doubles in work. Memory is O(n + m) for vertices, edges, labels, and compressed graphs. The dominant behavior is repeated neighbor scanning plus rebuilding aggregate edge weights.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Leiden-style methods are used to summarize social networks, citation graphs, payment graphs, biological networks, and knowledge graphs. The access pattern is many local edge-weight checks followed by compression. That fits large sparse graphs where local neighborhoods are much smaller than the whole graph.',
        'They also work as preprocessing. A graph model can use community ids as features, or an analyst can inspect suspicious groups rather than raw accounts. The output is a hypothesis about graph structure, not proof of one real-world cause.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The result depends on the graph construction, quality function, resolution parameter, and random order. Weighted, directed, temporal, and bipartite graphs can change what a community means. A clean partition can be an artifact of preprocessing.',
        'Leiden also returns a hard partition. A person, paper, or account can naturally belong to multiple groups, but the algorithm assigns each node to one community. Use overlapping or dynamic community methods when that assumption is wrong.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose A, B, C form a triangle with edge weight 3 on each side, and D, E, F form another triangle with weight 3. There is one bridge edge C-D with weight 1. Each triangle has internal weight 9, while the bridge between triangles has weight 1.',
        'A low-resolution greedy pass might join all six nodes because the combined group improves the score. Leiden then refines inside that tentative group. The two triangles are strong connected pieces, and the single bridge is weak evidence for one community.',
        'Aggregation can therefore create two supernodes, {A,B,C} and {D,E,F}, connected by weight 1. A later pass may merge them if the quality function still rewards it. The important point is that the weak interior was not hidden before refinement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Traag, Waltman, and van Eck, From Louvain to Leiden: guaranteeing well-connected communities, Scientific Reports 2019. Study Blondel et al. on Louvain for the baseline and modularity for the quality score.',
        'Study next by role. BFS, DFS, and connected components give the graph basics. Modularity and resolution limits explain the scoring tradeoff. Spectral clustering, Infomap, stochastic block models, and overlapping community detection provide contrasting approaches.',
      ],
    },
  ],
};
