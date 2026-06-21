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
      heading: 'Why this exists',
      paragraphs: [
        'Graph Neural Networks exist because much of the world is not naturally a table, a sequence, or an image. A molecule is atoms connected by bonds. A citation network is papers connected by references. A fraud system sees accounts, devices, cards, merchants, and transactions. A recommender sees users, products, sessions, follows, purchases, and views. In these problems, the relationship is not decoration. It is part of the evidence.',
        {type: 'callout', text: 'A GNN makes relationships trainable by turning each edge into a route for feature messages, then preserving permutation behavior at every update.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/GNN_building_blocks.png', alt: 'Graph neural network building blocks showing equivariant layers, pooling, and readout', caption: 'The building blocks separate node updates from graph-level readout, which is why one embedding pipeline can serve node, edge, and graph tasks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:GNN_building_blocks.png.'},
        'A standard neural network layer expects features in fixed positions. Feature 17 means the same thing for every row. A graph breaks that assumption. One node may have two neighbors and another may have ten thousand. Node order is arbitrary. The same graph can be stored with nodes listed in any order, but the answer should not change just because the file was reordered. A graph model needs to be permutation-aware and relationship-aware.',
        'A Graph Neural Network, or GNN, learns node embeddings by mixing each node with information from its neighbors. After one layer, a node knows about one-hop neighbors. After two layers, it can contain information from two-hop neighborhoods. A prediction head can then answer node questions, edge questions, whole-graph questions, or ranking questions using embeddings that carry both local features and graph structure.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive approach is to flatten the graph. Put the adjacency matrix beside the node features, feed everything into a dense model, and hope the network learns the structure. This breaks as soon as graphs vary in size. It also wastes space, because most real graphs are sparse, and it ties the model to an arbitrary node order.',
        'Another naive approach is hand-built graph features. Compute degree, PageRank, clustering coefficient, shortest-path counts, or neighborhood label histograms, then train a normal model. These features are useful and still show up in production. The problem is that they freeze the representation before learning starts. If the task needs a specific notion of neighborhood evidence, the model cannot easily learn it from the loss.',
        'A third shortcut is to ignore the graph and train only on node attributes. That can work when attributes are strong, but it misses the reason the graph was collected. A paper about graph learning may be easier to classify because of the papers it cites. A suspicious account may be obvious because it shares devices with other suspicious accounts. A product recommendation may depend less on the product text than on the pattern of users who co-viewed it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is message passing. Instead of flattening the whole graph, each node repeatedly asks its neighbors for messages. The node aggregates those messages with an operation that does not depend on neighbor order, combines the result with its own current state, and writes a new embedding.',
        'This gives the model the right inductive bias. Local graph structure is used directly, weights are shared across nodes, and the same layer can run on graphs of different sizes. A node with three neighbors and a node with three thousand neighbors both use the same message, aggregate, and update pattern. The aggregate may be a sum, mean, max, attention-weighted sum, or typed relation-specific combine.',
        'The depth of the network controls the receptive field. One message-passing layer sees immediate neighbors. Two layers let information travel through neighbors of neighbors. More layers can see farther, but depth is not automatically better. Graph information can become too mixed, too compressed, or too noisy. A good GNN is not simply the deepest GNN. It is a controlled information-flow system.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A basic message-passing layer has three steps. First, compute messages on edges. A message can depend on the source node embedding, the target node embedding, the edge type, edge weight, timestamp, or direction. In a citation graph, a message might say that a neighboring paper has a systems topic. In a molecular graph, it might include bond type. In a recommender graph, it might include event type such as view, cart, purchase, or dislike.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Message_Passing_Neural_Network.png', alt: 'Message passing neural network node receiving messages from four neighbors', caption: 'The center node update is the core primitive: neighbors send messages, the node aggregates them, and the update writes a new representation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Message_Passing_Neural_Network.png.'},
        'Second, aggregate incoming messages at each node. The aggregate must be permutation-invariant because neighbors have no meaningful list order. Sum is common because it preserves count-like information. Mean controls scale when degree varies. Max selects strong signals. Attention lets the model weight neighbors differently, but attention weights should not be treated as complete explanations without validation.',
        'Third, update the node embedding. The update function may be a linear layer, MLP, gated recurrent unit, residual block, normalization layer, or activation function. Backpropagation trains the message and update functions from the task loss. The same embedding can feed several heads: node classification, link prediction, graph classification, retrieval, recommendation, ranking, anomaly detection, or risk scoring.',
        'Large graphs require extra machinery. Full-batch training over every edge can be too expensive, so systems use neighbor sampling, subgraph sampling, cached embeddings, mini-batches, partitioning, or offline refresh. Heterogeneous graphs may use separate parameters per relation type. Dynamic graphs must decide whether an edge was visible at training time or whether it leaks future information.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first visual proves the message-passing contract on a citation graph. Paper D starts with its own features, but papers B, C, E, and F are attached to it. The active edges are not just lines on a diagram. They are the channels through which neighboring embeddings can become evidence for D.',
        'The update table proves that a GNN layer is ordinary neural-network computation placed on graph structure. There is a self feature, a set of neighbor messages, an aggregate, and a new embedding. The prediction-head table proves that the same learned embeddings can be reused for several task shapes: node labels, missing edges, whole-graph properties, or rankings.',
        'The oversmoothing view proves the main depth warning. At layer 0, nodes are distinguishable. After one layer, local neighborhoods mix in a useful way. After too many averaging layers, embeddings begin to look like the graph average. The visual is showing the balance every GNN has to manage: enough propagation to use relationships, enough preservation to keep identity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'GNNs work when the graph carries useful statistical structure. In homophilous graphs, connected nodes often share labels or properties. Friends may like similar pages. Papers in the same area cite each other. In molecular graphs, local bond neighborhoods determine chemical behavior. Message passing gives the model a way to learn these local patterns instead of receiving them as hand-coded features.',
        'The reason this is trainable is parameter sharing. The model does not learn a separate rule for every node. It learns how to transform messages, combine neighborhoods, and update embeddings across the graph. That lets it generalize to nodes and edges not seen in exactly the same configuration during training.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The basic cost grows with edges, embedding dimension, and layer count. If a layer sends messages over E edges using d-dimensional embeddings, the work is roughly proportional to E*d, plus update costs. Add more layers and the cost repeats. On a billion-edge graph, a naive full pass is not a classroom matrix multiply. It is a distributed systems problem.',
        'Neighbor sampling reduces cost but introduces variance. Sampling too few neighbors can miss important evidence. Sampling too many can explode the batch. Caching embeddings reduces compute but can make features stale. Partitioning improves locality but can cut across important edges. Online inference may need fast lookups, while offline training may tolerate heavier subgraph construction.',
        'The modeling tradeoffs are just as real. More layers expand the receptive field but increase oversmoothing. Long-range dependencies can be oversquashed when too much distant information must pass through narrow graph cuts. Attention can help select neighbors, but it costs more and can overfit. Positional features can break symmetries, but they add design choices. GNN engineering is mostly controlled information flow under cost constraints.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'GNNs are used in molecular property prediction, drug discovery screens, citation classification, fraud detection, recommender systems, traffic forecasting, knowledge graphs, program analysis, protein interaction networks, supply-chain risk, social graph embeddings, and entity resolution. They are especially natural when the question depends on both an item and its neighborhood.',
        'A fraud system may score a transaction by combining merchant features, card history, device links, and nearby risky accounts. A molecule model may predict toxicity by passing messages along bonds. A recommender may propagate preferences between users and items. A code-analysis graph may use syntax, data flow, and call edges. These are not all the same model, but they share the same idea: relationships become trainable evidence.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is believing that any graph-shaped data deserves a GNN. Bad edges spread bad signal. Stale edges can teach the past. Policy-generated edges can encode bias. Random train-test splits can leak neighborhood information because a test node may be directly connected to training nodes whose labels reveal the answer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/de/GNN_representational_limits.png', alt: 'Two non-isomorphic graphs that a GNN cannot distinguish under Weisfeiler-Lehman limits', caption: 'Some different graphs collapse to the same message-passing evidence, so GNN failure can be structural rather than only data or optimization noise. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:GNN_representational_limits.png.'},
        'The second failure mode is oversmoothing. Repeated aggregation makes embeddings too similar, especially in deep GNNs with simple averaging. Oversquashing is different: useful distant information exists, but too many signals are compressed through too few edges. A third failure is degree domination, where high-degree nodes drown out low-degree local evidence unless aggregation is normalized or sampled carefully.',
        'A fourth failure is explanation theater. Attention weights, influential neighbors, and subgraph saliency can be useful debugging tools, but they are not proof that the model is using the graph for the right reason. For safety, compliance, or authorization, learned graph scores should not replace explicit policy checks. A Zanzibar-style permission decision needs correctness guarantees that a GNN embedding does not provide.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Graph BFS and PageRank first to understand graph propagation without learning. Then study Embeddings and Similarity, Backpropagation, Activation Functions, and Attention. Graph Attention Networks, GraphSAGE, molecular message passing, heterogeneous graph neural networks, and temporal graph learning are natural next steps.',
        'For system design, connect this topic to Feature Stores, Data Leakage and Contamination, Approximate Nearest Neighbor Search, Multi-Index RAG, and Zanzibar Authorization Case Study. For primary sources, read Graph Neural Networks: A Review of Methods and Applications, Neural Message Passing for Quantum Chemistry, Graph Attention Networks, and Inductive Representation Learning on Large Graphs.',
      ],
    },
  ],
};
