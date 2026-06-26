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
  const numNodes = 6;
  const numEdges = 6;
  const neighborsOfD = ['B', 'C', 'E', 'F'];
  const taskTypes = ['node', 'edge', 'graph', 'ranking'];

  yield {
    state: citationGraph('Nodes start with local features and graph edges'),
    highlight: { active: ['paperD'], compare: ['paperB', 'paperC', 'paperE', 'paperF'] },
    explanation: `A Graph Neural Network starts with ${numNodes} node features and ${numEdges} edges. Paper D has its own text features, but its ${neighborsOfD.length} neighbors also carry signal. Message passing lets D learn from the nodes attached to it.`,
  };

  yield {
    state: citationGraph('Neighbors send messages into the target node'),
    highlight: { active: ['paperB', 'paperC', 'paperE', 'paperF', 'e-b-d', 'e-c-d', 'e-d-e', 'e-d-f'], found: ['paperD'] },
    explanation: `Each of D's ${neighborsOfD.length} neighbors (${neighborsOfD.join(', ')}) computes a message from its embedding. The target aggregates those messages with a permutation-invariant operation such as sum, mean, max, or attention.`,
    invariant: `Neighbor aggregation across ${neighborsOfD.length} incoming messages cannot depend on arbitrary node ordering.`,
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
    explanation: `The update rule aggregates ${neighborsOfD.length} neighbor messages into paper D's new embedding: transform self features, aggregate neighbor messages, combine them, and pass through a learned update function.`,
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
    explanation: `After several message-passing layers across ${numNodes} nodes and ${numEdges} edges, the learned embeddings can feed ${taskTypes.length} task types: ${taskTypes.join(', ')} — including classification, link prediction, and molecular property prediction.`,
  };
}

function* oversmoothing() {
  const trackedNodes = ['A', 'B', 'D', 'F'];
  const fixes = ['residual links', 'attention', 'neighbor sampling', 'positional features'];

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
    explanation: `At layer 0, each of the ${trackedNodes.length} tracked nodes (${trackedNodes.join(', ')}) has its own features. The graph helps, but the model should not erase identity. Distinguishing local features is often crucial for node-level tasks.`,
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
    explanation: `After one layer, each of the ${trackedNodes.length} nodes knows about one-hop neighbors. This is the useful part: structure becomes part of the representation.`,
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
    explanation: `Oversmoothing happens when repeated neighbor averaging makes all ${trackedNodes.length} node embeddings converge to the same graph average. The model can lose the very local distinctions it needed to predict.`,
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
    explanation: `GNN engineering uses ${fixes.length} common fixes — ${fixes.join(', ')} — to control information flow: enough propagation to use structure, enough preservation to keep nodes distinct, and enough sampling to make large graphs trainable.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views, selectable from the control. The "message passing" view walks through a citation graph where six papers are connected by citation edges. Watch node D in particular: it starts with only its own features, then receives messages from its four neighbors (B, C, E, F) along the highlighted edges. The animation then shows the update rule as a table — self features, neighbor messages, aggregate, new embedding — so you can see that one GNN layer is just a structured neural-network computation. The final frame shows how the same learned embeddings feed four different task types.',
        {type: 'image', src: './assets/gifs/graph-neural-networks.gif', alt: 'Animated walkthrough of the graph neural networks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The "oversmoothing" view tracks four nodes (A, B, D, F) across layers. At layer 0, each node has distinct topic and degree signals. After one layer, neighborhoods mix usefully. After too many layers, every node collapses to the graph average. The last frame shows four common engineering fixes. Orange highlighting marks the active operation; green marks found or completed states; red marks removed or degraded signal.',
        'Pay attention to which edges light up during message passing — those are the information channels. When the oversmoothing view shows all nodes converging to identical values, that is the visual proof of the depth problem every GNN practitioner must manage.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Much of the world is not a table, a sequence, or an image. A molecule is atoms connected by bonds. A citation network is papers connected by references. A social platform is users connected by follows, messages, and shared content. A fraud detection system sees accounts, devices, cards, and merchants linked by transactions. In all of these domains, the relationship between entities carries as much signal as the entities themselves. A standard neural network cannot use that relationship structure because it expects every input to be a fixed-length vector with features in fixed positions.',
        {type: 'callout', text: 'A GNN makes relationships trainable by turning each edge into a route for feature messages, then preserving permutation behavior at every update.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/GNN_building_blocks.png', alt: 'Graph neural network building blocks showing equivariant layers, pooling, and readout', caption: 'The building blocks separate node updates from graph-level readout, which is why one embedding pipeline can serve node, edge, and graph tasks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:GNN_building_blocks.png.'},
        'A graph neural network (GNN) learns a vector representation — called an embedding — for each node by combining that node\'s own features with information gathered from its neighbors. After training, these embeddings encode both what a node is and where it sits in the graph. A prediction head attached to the embeddings can then answer node-level questions (what category is this paper?), edge-level questions (should this link exist?), or graph-level questions (is this molecule toxic?).',
        'The key constraint is permutation invariance. A graph with nodes listed as [A, B, C] and the same graph listed as [C, A, B] must produce the same predictions. Any operation that depends on the arbitrary ordering of a neighbor list would break this contract. GNNs enforce it by using aggregation functions — sum, mean, max, or attention-weighted combinations — that produce the same output regardless of input order.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing a reasonable engineer would try is to flatten the graph into a fixed-size feature vector. Concatenate the adjacency matrix (or a row of it) with the node features, and feed the result into a standard dense network. This works on toy graphs with a fixed number of nodes. It fails in practice because real graphs vary in size — a social network has millions of nodes, a molecule has tens — and the adjacency matrix is usually sparse, so most of the flattened vector is zeros.',
        'The second reasonable attempt is hand-engineered graph features. Compute degree, PageRank, clustering coefficient, betweenness centrality, or neighborhood label histograms for each node, then train an ordinary classifier on those features. This approach is not stupid — it often works well and still appears in production systems. The limitation is that these features are fixed before training begins. If the downstream task needs a specific notion of "neighborhood similarity" that PageRank does not capture, the model has no way to learn it from the loss signal.',
        'A third shortcut is to ignore the graph entirely and train only on node attributes — the text of a paper, the SMILES string of a molecule, the profile of a user. This can outperform graph methods when attributes are rich and edges are noisy. But it discards the reason the graph was collected. A paper\'s topic is easier to predict when you know what other papers cite it. A suspicious account is easier to flag when it shares a device fingerprint with known fraudulent accounts.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Flattening hits the wall at variable-size graphs. A dense layer with n-squared input weights cannot accept a graph with n+1 nodes. Even if you pad to the maximum size, the model learns position-dependent weights — feature 17 corresponds to "edge to node 17" — which breaks as soon as nodes are reordered. Permutation invariance is not a nice-to-have; it is a correctness requirement.',
        'Hand-engineered features hit the wall at task specificity. PageRank captures global importance but not local role. Degree captures connectivity but not the content of connections. Clustering coefficient captures local density but misses long-range dependencies. Every new task might need a different feature, and the engineer must guess which features matter before seeing the loss. The representation is frozen at design time, not learned from data.',
        'Ignoring the graph hits the wall at relational evidence. In a citation network with 3,000 unlabeled papers, a paper\'s own abstract may be ambiguous between "machine learning" and "statistics." But if 8 of its 10 citations are known ML papers, the classification becomes easy. That neighborhood evidence is exactly what the graph provides, and a node-only model cannot use it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is message passing: instead of encoding the entire graph at once, each node collects information only from its immediate neighbors, aggregates it with an order-independent function, and updates its own embedding. One round of message passing lets each node see one hop. Two rounds let information flow two hops. The model learns what messages to send, how to aggregate them, and how to update — all from the task loss.',
        'Permutation invariance falls out of the aggregation choice. If you sum the neighbor messages, the result does not depend on the order you iterate through the neighbor list. The same is true for mean, max, or any function symmetric in its inputs. This is why GNNs can handle graphs of different sizes and node orderings without any special padding or alignment.',
        'Parameter sharing makes this practical. The message function and update function are the same for every node — the model does not learn a separate rule for node 7 versus node 42. A GNN trained on molecules with 20 atoms can run inference on molecules with 200 atoms, because the learned operations are local: transform a neighbor\'s features, aggregate, update. The graph provides the wiring; the weights provide the computation.',
        'Depth controls the receptive field but is not free. After k layers, each node\'s embedding can contain information from nodes up to k hops away. But more layers mean more averaging, which can wash out local detail (oversmoothing), and more compression of distant signals through narrow graph bottlenecks (oversquashing). Practical GNNs rarely exceed 3-5 layers.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A message-passing layer operates in three phases. In the message phase, each edge (u, v) produces a message vector. The simplest message is a linear transformation of the source node\'s embedding: m_uv = W * h_u, where W is a learned weight matrix and h_u is node u\'s current embedding. Richer variants include the target embedding, edge type, edge weight, or timestamps. In a molecular graph, the message might concatenate the source atom embedding with a one-hot bond-type vector. In a heterogeneous knowledge graph, different relation types may use entirely different weight matrices.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Message_Passing_Neural_Network.png', alt: 'Message passing neural network node receiving messages from four neighbors', caption: 'The center node update is the core primitive: neighbors send messages, the node aggregates them, and the update writes a new representation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Message_Passing_Neural_Network.png.'},
        'In the aggregation phase, each node collects messages from all its neighbors and reduces them to a single vector. Sum aggregation preserves information about how many neighbors contributed — if three neighbors each send a "fraud" signal, the sum is three times larger than one neighbor\'s signal. Mean aggregation normalizes by degree, which prevents high-degree hub nodes from dominating. Max aggregation selects the strongest signal per dimension. Attention aggregation (as in GAT) learns a scalar weight for each neighbor based on the content of both embeddings, then computes a weighted sum. Each choice has a tradeoff: sum can blow up for high-degree nodes, mean can dilute strong signals, max discards multiplicity, and attention adds parameters and computation.',
        'In the update phase, the node combines the aggregated neighborhood message with its own current embedding and produces a new embedding. A typical update is h_v\' = ReLU(W_self * h_v + agg_neighbors), though GRU-style gating, layer normalization, residual connections, and dropout are all common. Residual connections are important in practice: they let the node retain its previous embedding even if the neighborhood signal is noisy, which directly mitigates oversmoothing.',
        'After stacking L message-passing layers, the final node embeddings are fed to task-specific heads. For node classification, a linear layer maps each embedding to class logits. For link prediction, a pair of embeddings is combined (dot product, concatenation, or bilinear) and scored. For graph classification, all node embeddings are pooled — summed, averaged, or attention-weighted — into a single graph vector, then classified. Training uses standard backpropagation through all layers, with the task loss driving what messages and updates the model learns to compute.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'GNNs work because many real-world graphs exhibit homophily: connected nodes tend to share labels or properties. In a citation network, papers citing each other are often in the same subfield. In a social network, friends often share demographics or interests. Message passing exploits homophily by letting each node borrow evidence from its neighbors. If 8 of your 10 neighbors are labeled "ML," the aggregated message carries strong evidence that you are also "ML." This is the same intuition behind label propagation, but GNNs learn what to propagate rather than propagating raw labels.',
        'The correctness argument rests on two properties. First, permutation equivariance: if you relabel the nodes, the embeddings permute in the same way, so no prediction depends on arbitrary node IDs. A formal statement is that for any permutation matrix P, applying P to the adjacency matrix and feature matrix produces embeddings that are P-permuted — same values, just reordered. Second, locality with controlled depth: after k layers, node v\'s embedding depends only on nodes within k hops. This means the model cannot hallucinate long-range structure that the graph does not support.',
        'Parameter sharing provides generalization. Because the same message and update functions apply at every node, the model learns a general rule — "how to process a neighborhood" — rather than memorizing node-specific patterns. This is analogous to how convolutional filters in image models learn edge detectors that work at any spatial position. A GNN trained on small molecules generalizes to larger ones because the local bond patterns it learned still apply.',
        'The theoretical expressive power of message-passing GNNs is bounded by the Weisfeiler-Lehman (WL) graph isomorphism test. Two graphs that the 1-WL test cannot distinguish will also produce identical embeddings under any message-passing GNN. This is a real limitation — certain non-isomorphic graphs collapse to the same representation — but in practice, 1-WL equivalence covers most cases encountered in molecular, social, and citation graphs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One message-passing layer over a graph with E edges and d-dimensional embeddings costs O(E * d) for message computation plus O(N * d) for updates, where N is the number of nodes. A k-layer GNN repeats this k times, so total training cost per forward pass is O(k * E * d). For Cora (2,708 nodes, 5,429 edges, d=64, k=2), this is roughly 2 * 5,429 * 64 = 695,000 multiply-adds per forward pass — trivial on a modern GPU. For ogbn-papers100M (111 million nodes, 1.6 billion edges), the same calculation gives numbers that do not fit in GPU memory without engineering tricks.',
        'Neighbor sampling (introduced by GraphSAGE) controls cost by limiting how many neighbors each node collects messages from. If you sample s neighbors per node per layer and stack k layers, each node\'s computational tree has at most s^k nodes. With s=15 and k=2, the tree has at most 225 nodes regardless of the actual graph degree. This trades variance (sampled neighborhoods are noisy) for tractability. Mini-batch training samples a batch of target nodes, expands their k-hop neighborhoods (with sampling), computes embeddings bottom-up, and applies the loss only on the target batch.',
        'Memory is the practical bottleneck. During training, intermediate embeddings must be stored for backpropagation. A graph with 10 million nodes and d=256 requires 10M * 256 * 4 bytes = 10 GB just for one layer\'s node embeddings, before accounting for messages, gradients, or optimizer state. Techniques like gradient checkpointing, feature caching (store previous-layer embeddings and reuse them across epochs), and graph partitioning (split the graph across machines) address this. Inference is cheaper because no gradients are stored, but serving latency depends on whether embeddings are precomputed or computed on the fly.',
        'When the input doubles — twice as many edges — cost roughly doubles per layer. When embedding dimension doubles, cost also doubles. Adding a layer multiplies cost linearly but expands the receptive field exponentially in the graph. The practical sweet spot is 2-4 layers with d between 64 and 256, with neighbor sampling for graphs above a few hundred thousand edges.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'In drug discovery, GNNs predict molecular properties by treating atoms as nodes and bonds as edges. Gilead used message-passing networks to screen candidate molecules for antiviral activity, reducing wet-lab experiments by filtering computationally. The key fit: molecular properties depend on local bond neighborhoods (functional groups), and GNNs learn those patterns directly from the graph. SchNet and DimeNet extend this to 3D geometry by encoding interatomic distances and angles into the message function.',
        'In fraud detection, a transaction graph connects accounts, devices, cards, and merchants. A fraudulent account often shares device fingerprints with other flagged accounts or transacts in suspicious patterns. PayPal and Alibaba have published work using GNNs to score transactions by aggregating risk signals from the neighborhood — the same message-passing idea applied to a heterogeneous financial graph. The graph provides evidence that no single transaction record contains.',
        'In recommendation systems, a bipartite graph links users to items through interactions (views, clicks, purchases). PinSage at Pinterest runs GNN inference on a graph with 3 billion nodes and 18 billion edges to generate item embeddings for visual search. The graph lets the model propagate user preferences: if users who liked item A also liked item B, the embeddings of A and B move closer. This is collaborative filtering made differentiable through message passing.',
        'In traffic forecasting, road segments are nodes and intersections are edges. Google Maps uses a GNN variant to predict travel times by propagating congestion signals along the road network. Spatial-temporal GNNs combine graph message passing with temporal sequence modeling to capture how traffic jams propagate through a city over time.',
        'Other deployed uses include protein interaction prediction (AlphaFold uses geometric message passing over residue graphs), knowledge graph completion (predicting missing links in Freebase or Wikidata), program analysis (representing code as control-flow and data-flow graphs for bug detection), and supply-chain risk modeling (propagating disruption signals through supplier-manufacturer-retailer networks).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Oversmoothing is the most common failure. After too many message-passing layers with mean or sum aggregation, all node embeddings converge toward the graph\'s global average. The model loses the local distinctions it needs for node-level prediction. Mathematically, repeated application of a normalized adjacency matrix acts like a low-pass filter that kills high-frequency signal. In practice, GNN accuracy often peaks at 2-3 layers and degrades beyond 5-6. Residual connections, jumping knowledge (concatenating embeddings from all layers), and PairNorm help but do not eliminate the problem.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/de/GNN_representational_limits.png', alt: 'Two non-isomorphic graphs that a GNN cannot distinguish under Weisfeiler-Lehman limits', caption: 'Some different graphs collapse to the same message-passing evidence, so GNN failure can be structural rather than only data or optimization noise. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:GNN_representational_limits.png.'},
        'Oversquashing is a different problem. When two nodes are far apart in the graph but the task requires their interaction, information must pass through many intermediate nodes, each of which aggregates messages from its own neighborhood. The distant signal gets compressed (squashed) at every hop. Bottleneck nodes — those with high betweenness centrality that sit on many shortest paths — are particularly vulnerable. Graph rewiring (adding virtual edges to reduce diameter) and graph transformers (all-pairs attention bypasses the local message structure) are active research directions addressing this.',
        'The Weisfeiler-Lehman expressiveness ceiling means standard message-passing GNNs cannot distinguish certain non-isomorphic graphs. Two graphs that produce identical multisets of neighbor labels at every refinement step will receive identical embeddings. Higher-order GNNs (k-WL) can distinguish more graphs but cost O(N^k) memory. For most practical tasks this ceiling does not bind, but for graph isomorphism or substructure counting, it is a hard limit.',
        'Data leakage in graph splits is subtle and dangerous. In a node classification task, a random 80/20 train-test split means test nodes are still connected to training nodes. The GNN can aggregate training labels from neighbors during message passing, achieving artificially high accuracy that does not reflect true generalization. Inductive splits (hold out entire subgraphs) or temporal splits (train on past edges, test on future edges) are necessary but harder to implement and often reduce measured performance.',
        'Finally, bad edges spread bad signal. If the graph encodes stale relationships (a user who unfollowed), biased policies (a lending algorithm that encoded racial proxies into connection patterns), or noisy co-occurrences (two papers cited together by accident), the GNN will learn from those edges. Garbage structure in, garbage embeddings out. GNNs do not clean the graph; they amplify whatever structure is present.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a citation graph with 5 papers. Paper A cites B and C. Paper B cites D. Paper C cites D. Paper D cites E. Each paper has a 3-dimensional feature vector representing its topic distribution: A=[1,0,0] (pure ML), B=[0,1,0] (pure systems), C=[0.5,0.5,0] (ML+systems), D=[0,0,1] (theory), E=[0,1,0] (systems). We want to classify D\'s field using a 1-layer GNN with sum aggregation and no activation function, using a weight matrix W = identity (for simplicity, so messages equal source embeddings).',
        'Step 1: compute messages. D\'s neighbors are B, C, and E (papers that cite D or that D cites). Their embeddings are B=[0,1,0], C=[0.5,0.5,0], E=[0,1,0]. With W=I, each message equals the source embedding.',
        'Step 2: aggregate. Using sum: agg_D = [0,1,0] + [0.5,0.5,0] + [0,1,0] = [0.5, 2.5, 0]. Using mean: agg_D = [0.5/3, 2.5/3, 0] = [0.167, 0.833, 0]. The sum tells us that D\'s neighborhood has strong systems signal (2.5) and some ML signal (0.5). The mean normalizes by degree.',
        'Step 3: update. A simple update adds self and neighborhood: h_D\' = h_D + agg_D = [0,0,1] + [0.5,2.5,0] = [0.5, 2.5, 1]. D\'s new embedding now reflects both its own theory focus (dimension 3 = 1) and its neighborhood\'s systems+ML character. A classifier on this vector would likely label D as "systems-adjacent theory" rather than "pure theory." After a second layer, D would also incorporate A\'s pure-ML signal (since A connects to B and C, which connect to D), further enriching the representation.',
        'This toy example shows the key mechanism: D started with no systems signal at all, but after one round of message passing, systems is its dominant feature dimension. The graph structure changed the representation. In a real GNN, the weight matrix W would be learned to emphasize whichever message dimensions the classification loss rewards, and a nonlinear activation would let the model capture more complex patterns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational references are: Kipf and Welling, "Semi-Supervised Classification with Graph Convolutional Networks" (ICLR 2017, introduced GCN), Gilmer et al., "Neural Message Passing for Quantum Chemistry" (ICML 2017, unified message-passing framework), Velickovic et al., "Graph Attention Networks" (ICLR 2018, attention-based aggregation), and Hamilton, Ying, Leskovec, "Inductive Representation Learning on Large Graphs" (NeurIPS 2017, GraphSAGE with neighbor sampling). For a comprehensive survey, see Wu et al., "A Comprehensive Survey on Graph Neural Networks" (IEEE TNNLS 2021).',
        'Study Graph BFS and PageRank first to understand graph propagation without learning. Then study Embeddings and Similarity to understand what a learned vector representation means, Backpropagation to understand how GNN weights are trained, and Attention to understand the aggregation mechanism used in GAT. These four topics are prerequisites; GNNs combine all of them.',
        'For natural extensions, study Graph Attention Networks (attention-weighted aggregation), GraphSAGE (neighbor sampling for large graphs), heterogeneous graph neural networks (different node and edge types), and temporal graph learning (edges with timestamps). For the expressiveness ceiling, study the Weisfeiler-Lehman test and higher-order GNNs.',
        'For system-level context, connect this topic to Feature Stores (precomputed node features), Data Leakage and Contamination (graph split pitfalls), and Approximate Nearest Neighbor Search (serving GNN embeddings at scale). Understanding GNNs alongside these system topics bridges the gap between research prototypes and production deployment.',
      ],
    },
  ],
};
