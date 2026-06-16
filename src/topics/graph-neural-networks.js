// Graph neural networks: update each node by aggregating messages from its
// neighbors, then repeat until local structure has become learned features.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'graph-neural-networks',
  title: 'Graph Neural Networks',
  category: 'AI & ML',
  summary: 'Message passing for graph data: nodes collect neighbor features, update embeddings, and support node, edge, and graph predictions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['message passing', 'oversmoothing'], defaultValue: 'message passing' },
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

function citationGraph(title) {
  return graphState({
    nodes: [
      { id: 'paperA', label: 'paper A', x: 1.0, y: 3.0, note: 'GNN' },
      { id: 'paperB', label: 'paper B', x: 2.9, y: 1.6, note: 'systems' },
      { id: 'paperC', label: 'paper C', x: 3.0, y: 4.7, note: 'ML' },
      { id: 'paperD', label: 'paper D', x: 5.2, y: 3.1, note: 'unknown' },
      { id: 'paperE', label: 'paper E', x: 7.4, y: 2.1, note: 'database' },
      { id: 'paperF', label: 'paper F', x: 7.3, y: 4.7, note: 'unknown' },
    ],
    edges: [
      { id: 'e-a-b', from: 'paperA', to: 'paperB', weight: 'cites' },
      { id: 'e-a-c', from: 'paperA', to: 'paperC', weight: 'cites' },
      { id: 'e-b-d', from: 'paperB', to: 'paperD', weight: 'cites' },
      { id: 'e-c-d', from: 'paperC', to: 'paperD', weight: 'cites' },
      { id: 'e-d-e', from: 'paperD', to: 'paperE', weight: 'cites' },
      { id: 'e-d-f', from: 'paperD', to: 'paperF', weight: 'cites' },
    ],
  }, { title });
}

function* messagePassing() {
  yield {
    state: citationGraph('Nodes start with local features and graph edges'),
    highlight: { active: ['paperD'], compare: ['paperB', 'paperC', 'paperE', 'paperF'] },
    explanation: 'A Graph Neural Network starts with node features and edges. Paper D has its own text features, but its neighbors also carry signal. Message passing lets D learn from the nodes attached to it.',
  };

  yield {
    state: citationGraph('Neighbors send messages into the target node'),
    highlight: { active: ['paperB', 'paperC', 'paperE', 'paperF', 'e-b-d', 'e-c-d', 'e-d-e', 'e-d-f'], found: ['paperD'] },
    explanation: 'Each neighbor computes a message, usually from its embedding and the edge type. The target aggregates those messages with a permutation-invariant operation such as sum, mean, max, or attention.',
    invariant: 'Neighbor aggregation cannot depend on arbitrary node ordering.',
  };

  yield {
    state: labelMatrix(
      'One node update',
      [
        { id: 'self', label: 'self feature' },
        { id: 'neighbors', label: 'neighbor messages' },
        { id: 'aggregate', label: 'aggregate' },
        { id: 'update', label: 'new embedding' },
      ],
      [
        { id: 'content', label: 'content' },
        { id: 'operation', label: 'operation' },
      ],
      [
        ['paper D text', 'linear layer'],
        ['B, C, E, F', 'sum or attention'],
        ['combined neighborhood', 'normalize'],
        ['embedding h_D_1', 'MLP plus activation'],
      ],
    ),
    highlight: { active: ['neighbors:operation', 'aggregate:operation', 'update:content'] },
    explanation: 'The update rule is neural-network plumbing on graph structure: transform self features, aggregate neighbor messages, combine them, and pass through a learned update function.',
  };

  yield {
    state: labelMatrix(
      'Prediction heads reuse the same embeddings',
      [
        { id: 'node', label: 'node task' },
        { id: 'edge', label: 'edge task' },
        { id: 'graph', label: 'graph task' },
        { id: 'rank', label: 'ranking task' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'readout', label: 'readout' },
      ],
      [
        ['what label for this node?', 'node embedding'],
        ['should this edge exist?', 'pair of embeddings'],
        ['what property of whole graph?', 'pool all nodes'],
        ['which neighbor matters most?', 'attention weights or scores'],
      ],
    ),
    highlight: { found: ['node:readout', 'edge:readout', 'graph:readout'], active: ['rank:readout'] },
    explanation: 'After several message-passing layers, the learned embeddings can feed node classification, link prediction, graph classification, recommendation, ranking, or molecular property prediction.',
  };
}

function* oversmoothing() {
  yield {
    state: labelMatrix(
      'Layer 0: nodes are distinguishable',
      [
        { id: 'a', label: 'paper A' },
        { id: 'b', label: 'paper B' },
        { id: 'd', label: 'paper D' },
        { id: 'f', label: 'paper F' },
      ],
      [
        { id: 'topic', label: 'topic signal' },
        { id: 'degree', label: 'degree signal' },
      ],
      [
        ['GNN-heavy', 'medium'],
        ['systems', 'low'],
        ['mixed', 'high'],
        ['unknown', 'low'],
      ],
    ),
    highlight: { active: ['a:topic', 'b:topic', 'd:topic', 'f:topic'] },
    explanation: 'At layer 0, each node has its own features. The graph helps, but the model should not erase identity. Distinguishing local features is often crucial for node-level tasks.',
  };

  yield {
    state: labelMatrix(
      'Layer 1: local neighborhoods mix',
      [
        { id: 'a', label: 'paper A' },
        { id: 'b', label: 'paper B' },
        { id: 'd', label: 'paper D' },
        { id: 'f', label: 'paper F' },
      ],
      [
        { id: 'topic', label: 'topic signal' },
        { id: 'degree', label: 'degree signal' },
      ],
      [
        ['ML plus systems', 'medium'],
        ['GNN plus mixed', 'medium'],
        ['many fields', 'high'],
        ['mixed plus database', 'medium'],
      ],
    ),
    highlight: { found: ['a:topic', 'b:topic', 'd:topic', 'f:topic'] },
    explanation: 'After one layer, each node knows about one-hop neighbors. This is the useful part: structure becomes part of the representation.',
  };

  yield {
    state: labelMatrix(
      'Too many layers: everything starts to look alike',
      [
        { id: 'a', label: 'paper A' },
        { id: 'b', label: 'paper B' },
        { id: 'd', label: 'paper D' },
        { id: 'f', label: 'paper F' },
      ],
      [
        { id: 'topic', label: 'topic signal' },
        { id: 'degree', label: 'degree signal' },
      ],
      [
        ['graph average', 'average'],
        ['graph average', 'average'],
        ['graph average', 'average'],
        ['graph average', 'average'],
      ],
    ),
    highlight: { compare: ['a:topic', 'b:topic', 'd:topic', 'f:topic'], removed: ['a:degree', 'b:degree', 'd:degree', 'f:degree'] },
    explanation: 'Oversmoothing happens when repeated neighbor averaging makes node embeddings too similar. The model can lose the very local distinctions it needed to predict.',
  };

  yield {
    state: labelMatrix(
      'Common fixes',
      [
        { id: 'residual', label: 'residual links' },
        { id: 'attention', label: 'attention' },
        { id: 'sampling', label: 'neighbor sampling' },
        { id: 'positional', label: 'positional features' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'why', label: 'why it helps' },
      ],
      [
        ['keep old embedding', 'identity survives depth'],
        ['weight neighbors', 'ignore weak edges'],
        ['limit fanout', 'control noise and cost'],
        ['encode structure', 'break graph symmetries'],
      ],
    ),
    highlight: { active: ['residual:why', 'attention:why', 'sampling:why', 'positional:why'] },
    explanation: 'GNN engineering is mostly about controlling information flow: enough propagation to use structure, enough preservation to keep nodes distinct, and enough sampling to make large graphs trainable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'message passing') yield* messagePassing();
  else if (view === 'oversmoothing') yield* oversmoothing();
  else throw new InputError('Pick a graph-neural-network view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Graph Neural Networks learn on data where relationships matter. A node could be a molecule atom, user, product, paper, repository, bank account, road intersection, protein, or permission object. Edges encode bonds, purchases, citations, calls, friendships, transactions, roads, or relations. Ordinary Neural Network Forward Pass layers expect vectors in fixed positions. GNNs respect graph structure by letting each node update itself from its neighbors.',
        'The dominant pattern is message passing. Every layer computes messages along edges, aggregates incoming messages at each node, and updates node embeddings with a learned function. After several layers, a node embedding contains information from its multi-hop neighborhood. A readout head then predicts node labels, edge existence, whole-graph properties, recommendations, rankings, or risk scores.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A message-passing layer has three pieces. First, transform each node and edge into messages. Second, aggregate messages with a permutation-invariant operation such as sum, mean, max, or attention. Third, combine the aggregate with the node state using an MLP, activation, normalization, residual connection, or gated update. Backpropagation trains the message and update functions from the task loss.',
        'Graph Attention Networks replace uniform neighbor averaging with learned attention weights. Molecular Message Passing Neural Networks use edge types such as bond structure. Recommender GNNs propagate user and item signals. Authorization and social graph systems may use GNN-like embeddings, but production policy still needs explicit checks such as Zanzibar Authorization Case Study when correctness is non-negotiable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is proportional to node embeddings, edge count, layer count, and sampling strategy. Full-batch message passing over a billion-edge graph is not practical for ordinary training. Large systems sample neighbors, train mini-batches of subgraphs, cache embeddings, or separate offline embedding refresh from online inference. Graphs also create data leakage traps: if train and test nodes share edges, the model may learn from future or forbidden structure.',
        'Oversmoothing is the classic depth failure. Repeated averaging can make nearby nodes indistinguishable. Oversquashing is another failure: too much distant information is compressed through too few edges. Residual links, normalization, attention, positional features, careful depth, and graph rewiring all try to preserve useful signal while still moving information through the graph.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GNNs are used for molecular property prediction, fraud detection, recommender systems, citation classification, traffic prediction, knowledge graphs, code graphs, protein interaction networks, social graph embeddings, and supply-chain risk. They connect naturally to Graph BFS, PageRank, Embeddings & Similarity, and Multi-Index RAG because all of those topics treat relationships as first-class evidence.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A GNN is not automatically better because the data can be drawn as a graph. If edges are noisy, stale, leaked, or policy-driven artifacts, message passing can spread bad evidence. Another misconception is that attention weights are explanations. They are learned routing coefficients and should be validated like Saliency Maps. Finally, graph splits must be designed carefully: random node splits can leak neighborhood information that would not exist at deployment time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Graph Neural Networks: A Review of Methods and Applications at https://arxiv.org/abs/1812.08434, Neural Message Passing for Quantum Chemistry at https://arxiv.org/abs/1704.01212, and Graph Attention Networks at https://arxiv.org/abs/1710.10903. Study Graph BFS, PageRank, Embeddings & Similarity, Backpropagation, Saliency Maps, and Multi-Index RAG next.',
      ],
    },
  ],
};
