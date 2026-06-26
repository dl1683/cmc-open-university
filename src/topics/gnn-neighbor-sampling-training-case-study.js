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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a mini-batch being built from a graph. A graph neural network, or GNN, updates node representations by aggregating neighbor information, and neighbor sampling chooses a bounded subset of neighbors for training. Active nodes are being expanded, visited nodes are already in the sampled computation graph, and found seed nodes contribute loss.',
        'The safe inference rule is dependency depth. A two-layer GNN prediction for a seed node needs sampled one-hop neighbors and sampled two-hop sources, but it does not need the entire graph in every batch.',
        {type:'callout', text:'Neighbor sampling makes the loader part of the model by bounding each batch while preserving the dependency cone that message passing needs.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/98/Network-graph.png', alt:'Colorful graph visualization with clustered nodes and edges.', caption:'Network graph visualization by Savionasc, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'GNNs are useful because a node often depends on its neighborhood. A fraud account, product, paper, molecule atom, or social profile can be better understood by aggregating nearby attributes and edges.',
        'Full-batch training does not fit large graphs. A production graph can have millions or billions of nodes and edges, while one GPU batch needs bounded memory and predictable feature reads.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full-neighbor message passing. Load the graph, aggregate from every neighbor for every layer, compute loss, and update the model.',
        'That approach is clean on small citation graphs. It also matches the mathematical layer definition, so it is the right starting point for understanding correctness before scaling.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is neighborhood explosion. If each node has 100 neighbors, then a two-layer full-neighbor expansion for one seed can reach about 10,000 second-hop nodes before overlaps.',
        'A second wall is data movement. The model may spend less time on matrix multiplication than on sampling adjacency, fetching feature rows, remapping node ids, and transferring tensors to the GPU.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A k-layer GNN only needs a k-hop computation graph for the current seed batch. If the loader samples a fixed fanout per layer, batch size is controlled by seed count and fanout instead of whole-graph degree.',
        'The loader becomes part of the algorithm. Different sampling policies change training distribution, gradient noise, representation quality, feature-cache behavior, and the meaning of validation metrics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a seed batch of target nodes. For the last GNN layer, sample a bounded number of one-hop neighbors needed to compute seed embeddings.',
        'For earlier layers, sample neighbors of those sampled neighbors, continuing backward until the computation graph covers the required depth. The loader gathers features, remaps global node ids to batch-local ids, builds edge indices or compressed sparse row slices, and marks which seeds contribute loss.',
        'Training then runs message passing on the sampled subgraph. Over many batches, different sampled neighborhoods expose the model to enough local evidence to learn useful aggregation weights.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The computation graph is correct for the sampled estimator because every message used by the batch has its required source features and edges. The model is not pretending the sampled graph is the whole graph; it is training on a bounded estimate of the full aggregation.',
        'The method works when sampled neighbors preserve enough signal over repeated batches. If important neighbors have a nonzero chance of being sampled and gradients are averaged across many seeds, the model can learn from local structure without materializing the whole graph each step.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With seed batch B and fanouts 15 and 10 for a two-layer model, the upper bound before overlap is B times 15 times 10 second-hop sources plus intermediate nodes. For B = 512, that is at most 76,800 second-hop samples before deduplication.',
        'Cost grows with fanout, layer count, feature width, and feature locality. Doubling fanout can more than double loader time because it increases neighbor sampling, feature fetches, edge tensors, and GPU transfer size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Neighbor sampling is used in recommendation graphs, fraud graphs, citation graphs, knowledge graphs, code graphs, and large social or marketplace graphs. It is strongest when local neighborhoods contain useful signal but the full graph is too large for full-batch training.',
        'GraphSAGE, PinSage, Cluster-GCN, and library loaders such as PyTorch Geometric NeighborLoader are different points in this design space. They vary in whether they sample neighbors, random walks, clusters, or typed graph neighborhoods.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Uniform sampling can miss rare but important neighbors. High-degree hubs can dominate exposure, while cold-start or low-degree nodes may receive weak context.',
        'Evaluation can also fail. Random splits may leak future or neighboring information, stale graph snapshots can hide drift, and offline accuracy can improve while online recommendation or fraud metrics get worse.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a two-layer GNN trains on 256 seed nodes with fanout 10 then 5. Before overlap, the loader samples up to 2,560 first-hop nodes and 12,800 second-hop source nodes, plus edges and feature rows for all sampled nodes.',
        'Full-neighbor expansion on the same graph might see average degree 80. The same 256 seeds could reach about 20,480 first-hop nodes and 1,638,400 second-hop paths before overlap, which can exceed memory and make the GPU wait on data loading.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read GraphSAGE, PinSage, Cluster-GCN, PyTorch Geometric NeighborLoader documentation, and sampler documentation for the systems view. Study compressed sparse row graphs, message passing neural networks, PageRank, random walks, and embeddings next.',
        'Then study data leakage in graph splits, feature stores, GPU input pipelines, negative sampling, and distributed graph training. At scale, the sampler is not plumbing; it is part of the model and part of the performance profile.',
      ],
    },
  ],
};
