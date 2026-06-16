// GNN neighbor sampling: train message-passing models on large graphs by
// sampling compact computation graphs instead of materializing all neighbors.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gnn-neighbor-sampling-training-case-study',
  title: 'GNN Neighbor Sampling Training Case Study',
  category: 'Papers',
  summary: 'How GraphSAGE, PinSage, Cluster-GCN, and PyG-style loaders make large-graph GNN training fit in memory.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fanout explosion', 'sampling loaders'], defaultValue: 'fanout explosion' },
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

function sampledGraph(title) {
  return graphState({
    nodes: [
      { id: 'seed', label: 'seed', x: 0.9, y: 3.6, note: 'target' },
      { id: 'a', label: 'n1', x: 2.8, y: 1.6, note: 'sampled' },
      { id: 'b', label: 'n2', x: 2.8, y: 3.6, note: 'sampled' },
      { id: 'c', label: 'n3', x: 2.8, y: 5.6, note: 'sampled' },
      { id: 'd', label: 'n4', x: 4.8, y: 0.9, note: '2-hop' },
      { id: 'e', label: 'n5', x: 4.8, y: 2.4, note: '2-hop' },
      { id: 'f', label: 'n6', x: 4.8, y: 4.8, note: '2-hop' },
      { id: 'g', label: 'n7', x: 4.8, y: 6.3, note: '2-hop' },
      { id: 'full', label: 'full', x: 7.2, y: 3.6, note: 'too big' },
      { id: 'batch', label: 'batch', x: 8.8, y: 3.6, note: 'subgraph' },
    ],
    edges: [
      { id: 'e-seed-a', from: 'seed', to: 'a' },
      { id: 'e-seed-b', from: 'seed', to: 'b' },
      { id: 'e-seed-c', from: 'seed', to: 'c' },
      { id: 'e-a-d', from: 'a', to: 'd' },
      { id: 'e-a-e', from: 'a', to: 'e' },
      { id: 'e-b-e', from: 'b', to: 'e' },
      { id: 'e-b-f', from: 'b', to: 'f' },
      { id: 'e-c-f', from: 'c', to: 'f' },
      { id: 'e-c-g', from: 'c', to: 'g' },
      { id: 'e-full-batch', from: 'full', to: 'batch' },
    ],
  }, { title });
}

function loaderGraph(title) {
  return graphState({
    nodes: [
      { id: 'csr', label: 'CSR graph', x: 0.8, y: 3.5, note: 'adjacency' },
      { id: 'seeds', label: 'seeds', x: 2.4, y: 2.0, note: 'targets' },
      { id: 'sampler', label: 'sampler', x: 3.9, y: 3.5, note: 'fanout' },
      { id: 'subgraph', label: 'subgraph', x: 5.7, y: 3.5, note: 'mini-batch' },
      { id: 'gnn', label: 'GNN', x: 7.3, y: 2.0, note: 'layers' },
      { id: 'loss', label: 'loss', x: 8.8, y: 3.5, note: 'labels' },
      { id: 'cache', label: 'feature cache', x: 3.9, y: 5.7, note: 'hot rows' },
      { id: 'optimizer', label: 'optimizer', x: 7.3, y: 5.7, note: 'update' },
    ],
    edges: [
      { id: 'e-csr-sampler', from: 'csr', to: 'sampler' },
      { id: 'e-seeds-sampler', from: 'seeds', to: 'sampler' },
      { id: 'e-sampler-subgraph', from: 'sampler', to: 'subgraph' },
      { id: 'e-cache-subgraph', from: 'cache', to: 'subgraph' },
      { id: 'e-subgraph-gnn', from: 'subgraph', to: 'gnn' },
      { id: 'e-gnn-loss', from: 'gnn', to: 'loss' },
      { id: 'e-loss-optimizer', from: 'loss', to: 'optimizer' },
    ],
  }, { title });
}

function* fanoutExplosion() {
  yield {
    state: sampledGraph('Sampling cuts a small computation graph out of a huge graph'),
    highlight: { active: ['seed', 'a', 'b', 'c', 'e-seed-a', 'e-seed-b', 'e-seed-c'], found: ['batch'], compare: ['full'] },
    explanation: 'A mini-batch GNN does not load the whole graph for one gradient step. It picks seed nodes, samples a bounded number of neighbors per layer, and builds the subgraph needed for those seed predictions.',
  };

  yield {
    state: labelMatrix(
      'Fanout grows by layer',
      [
        { id: 'full', label: 'full graph' },
        { id: 'sampled', label: 'sampled' },
        { id: 'cluster', label: 'cluster' },
      ],
      [
        { id: '1hop', label: '1 hop' },
        { id: '2hop', label: '2 hops' },
        { id: 'trade', label: 'tradeoff' },
      ],
      [
        ['all neighbors', 'explodes', 'accurate but huge'],
        ['10 neighbors', '10 x 10', 'biased but cheap'],
        ['local block', 'dense subgraph', 'keeps locality'],
      ],
    ),
    highlight: { active: ['sampled:1hop', 'sampled:2hop'], compare: ['full:2hop'], found: ['cluster:trade'] },
    explanation: 'The fanout problem is multiplicative. If each layer pulls every neighbor, a few high-degree nodes can make a batch enormous. Fixed fanout gives predictable memory at the cost of sampling noise.',
    invariant: 'Mini-batch GNN training is a sampling algorithm wrapped around message passing.',
  };

  yield {
    state: sampledGraph('Two-hop context is enough for a two-layer model'),
    highlight: { active: ['seed', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'e-a-d', 'e-b-f', 'e-c-g'], found: ['batch'] },
    explanation: 'A two-layer message-passing model only needs two-hop source nodes for one seed prediction. Sampling limits that dependency cone so GPU memory scales with batch size and fanout, not the entire graph.',
  };

  yield {
    state: labelMatrix(
      'Sampling methods',
      [
        { id: 'sage', label: 'GraphSAGE' },
        { id: 'pin', label: 'PinSage' },
        { id: 'cluster', label: 'Cluster-GCN' },
        { id: 'pyg', label: 'PyG loader' },
      ],
      [
        { id: 'idea', label: 'idea' },
        { id: 'best for', label: 'best for' },
      ],
      [
        ['sample neighbors', 'inductive nodes'],
        ['random walks', 'recommenders'],
        ['sample clusters', 'deep large GCNs'],
        ['loader abstraction', 'experiments'],
      ],
    ),
    highlight: { found: ['sage:idea', 'pin:idea', 'cluster:idea', 'pyg:idea'] },
    explanation: 'The family has several shapes. GraphSAGE samples neighborhoods. PinSage uses random walks to focus recommendations. Cluster-GCN samples dense subgraphs. PyG exposes these choices as loader abstractions.',
  };
}

function* samplingLoaders() {
  yield {
    state: loaderGraph('A sampling loader is the data plane for GNN training'),
    highlight: { active: ['csr', 'seeds', 'sampler', 'subgraph', 'gnn', 'e-csr-sampler', 'e-seeds-sampler', 'e-sampler-subgraph', 'e-subgraph-gnn'], found: ['loss'] },
    explanation: 'The loader owns the graph data structure. It reads adjacency, samples neighbors for seed nodes, gathers features, builds a compact subgraph, and hands that subgraph to the GNN forward pass.',
  };

  yield {
    state: labelMatrix(
      'Loader output fields',
      [
        { id: 'nodes', label: 'nodes' },
        { id: 'edges', label: 'edges' },
        { id: 'features', label: 'features' },
        { id: 'mapping', label: 'mapping' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why' },
      ],
      [
        ['seed plus sampled', 'compute embeddings'],
        ['local adjacency', 'message passing'],
        ['row tensors', 'model input'],
        ['global to local ids', 'scatter results'],
      ],
    ),
    highlight: { active: ['nodes:contains', 'edges:contains', 'features:contains', 'mapping:contains'] },
    explanation: 'A sampled batch is not just a list of nodes. It is a mini graph with remapped ids, edge index or CSR slices, feature tensors, labels, and masks for which seed nodes contribute loss.',
  };

  yield {
    state: loaderGraph('The feature cache often decides throughput'),
    highlight: { active: ['csr', 'cache', 'sampler', 'subgraph', 'e-cache-subgraph', 'e-sampler-subgraph'], compare: ['gnn'] },
    explanation: 'At scale, sampling can become IO-bound. The adjacency may fit in memory while features live on CPU, SSD, or remote storage. Hot feature caching and pinned transfers can matter as much as the GNN layer.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'bias', label: 'sampling bias' },
        { id: 'leak', label: 'split leakage' },
        { id: 'degree', label: 'high degree' },
        { id: 'fresh', label: 'stale graph' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['misses useful neighbors', 'importance sampling'],
        ['future edges visible', 'time split'],
        ['batch blowup', 'cap fanout'],
        ['old embeddings', 'refresh cadence'],
      ],
    ),
    highlight: { active: ['bias:control', 'leak:control', 'degree:control', 'fresh:control'] },
    explanation: 'Scaling GNNs is not only memory work. The sampler changes the training distribution, graph splits can leak information, and stale graph snapshots can make offline accuracy disappear online.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fanout explosion') yield* fanoutExplosion();
  else if (view === 'sampling loaders') yield* samplingLoaders();
  else throw new InputError('Pick a GNN sampling view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Neighbor sampling is the training trick that makes Graph Neural Networks practical on graphs too large for full-batch message passing. Instead of updating every node over every edge in one step, the loader chooses seed nodes, samples bounded neighborhoods, gathers features, and trains on the resulting computation graph. This turns a graph-scale problem into a sequence of subgraph mini-batches.',
        'GraphSAGE introduced the core inductive idea: learn an aggregation function that samples and aggregates local neighborhoods so embeddings can be generated for unseen nodes: https://arxiv.org/abs/1706.02216. That idea connects Graph Neural Networks to ordinary mini-batch training while preserving graph structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a two-layer GNN, one seed prediction depends on sampled one-hop neighbors and sampled two-hop neighbors. If fanout is 10 and 10, each seed pulls at most about 100 second-hop sources before overlaps. A full-neighbor batch has no such bound: one high-degree node can explode memory. The sampled subgraph contains local node ids, edge indices or CSR slices, feature tensors, labels, and masks that say which seed nodes contribute loss.',
        'PinSage applies graph convolutions at web scale for recommendations by combining random walks with graph convolution and a training strategy for hard examples: https://arxiv.org/abs/1806.01973. Cluster-GCN takes another path: cluster the graph, then sample dense graph blocks so training keeps locality and reduces memory: https://arxiv.org/abs/1905.07953.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is shaped by seed batch size, fanout per layer, feature width, number of layers, edge density, sampling algorithm, and feature locality. Sampling lowers memory but introduces variance and bias. It can also move the bottleneck from matrix multiplication to data loading. If feature rows are fetched from CPU memory, SSD, or a remote feature store, the sampler and cache become part of the training system.',
        'Compressed Sparse Row Graph is the natural adjacency layout for many samplers because neighbor lists are contiguous slices. PyTorch Geometric NeighborLoader exposes fanout-based sampling for large graphs and heterogeneous graphs: https://pytorch-geometric.readthedocs.io/en/2.5.2/tutorial/neighbor_loader.html. The loader abstraction is important because model code should not be hard-wired to one sampling strategy.',
      ],
    },
    {
      heading: 'Case studies and uses',
      paragraphs: [
        'Pinterest PinSage is the canonical production case: recommendations over a graph with billions of nodes and edges require sampling, random walks, distributed inference, and offline embedding refresh. Fraud detection, recommender systems, citation graphs, supply-chain risk, code graphs, molecular graphs, and knowledge graphs face the same training pressure whenever full-batch message passing is too large.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Sampling is not free accuracy. Uniform sampling can miss rare but important neighbors. Random node splits can leak neighborhood information that would not exist at deployment time. High-degree nodes can still dominate batches if fanout and seed selection are careless. Stale graph snapshots can make embeddings lag reality. Evaluate by slices: degree buckets, time windows, cold-start nodes, edge types, and online metrics when possible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: GraphSAGE at https://arxiv.org/abs/1706.02216, PinSage at https://arxiv.org/abs/1806.01973, Cluster-GCN at https://arxiv.org/abs/1905.07953, PyTorch Geometric NeighborLoader docs at https://pytorch-geometric.readthedocs.io/en/2.5.2/tutorial/neighbor_loader.html, and PyG sampler docs at https://pytorch-geometric.readthedocs.io/en/2.5.1/modules/sampler.html. Study Graph Neural Networks, Compressed Sparse Row Graph, Graph BFS, PageRank, Embeddings & Similarity, Data Leakage & Contamination, and GPU All-Reduce next.',
      ],
    },
  ],
};
