// TensorFlow case study: represent ML computation as a dataflow graph that can
// be placed across heterogeneous devices and distributed workers.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tensorflow-dataflow-case-study',
  title: 'TensorFlow Dataflow Case Study',
  category: 'Papers',
  summary: 'TensorFlow as the ML-systems lesson: graphs of tensors and stateful ops placed across CPUs, GPUs, TPUs, and workers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['graph execution', 'placement and state'], defaultValue: 'graph execution' },
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

function graph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input batch', x: 0.7, y: 3.8, note: 'tensor' },
      { id: 'matmul', label: 'MatMul', x: 2.5, y: 3.0, note: 'GPU op' },
      { id: 'bias', label: 'BiasAdd', x: 4.2, y: 3.0, note: 'GPU op' },
      { id: 'relu', label: 'ReLU', x: 5.8, y: 3.0, note: 'GPU op' },
      { id: 'loss', label: 'loss', x: 7.4, y: 3.8, note: 'scalar' },
      { id: 'grad', label: 'gradients', x: 5.8, y: 5.7, note: 'backprop' },
      { id: 'var', label: 'variables', x: 2.5, y: 5.7, note: 'state' },
      { id: 'update', label: 'optimizer', x: 4.2, y: 5.7, note: 'mutates state' },
    ],
    edges: [
      { id: 'e-input-mm', from: 'input', to: 'matmul', weight: 'tensor' },
      { id: 'e-var-mm', from: 'var', to: 'matmul', weight: 'weights' },
      { id: 'e-mm-bias', from: 'matmul', to: 'bias', weight: 'activation' },
      { id: 'e-bias-relu', from: 'bias', to: 'relu', weight: 'activation' },
      { id: 'e-relu-loss', from: 'relu', to: 'loss', weight: 'prediction' },
      { id: 'e-loss-grad', from: 'loss', to: 'grad', weight: 'reverse' },
      { id: 'e-grad-update', from: 'grad', to: 'update', weight: 'gradient' },
      { id: 'e-update-var', from: 'update', to: 'var', weight: 'assign' },
    ],
  }, { title });
}

function* graphExecution() {
  yield {
    state: graph('TensorFlow represents computation as a dataflow graph'),
    highlight: { active: ['input', 'matmul', 'bias', 'relu', 'loss', 'e-input-mm', 'e-mm-bias'], compare: ['var'] },
    explanation: 'Read the graph as the runtime sees the program: operations are nodes, tensors are edges, and dependencies decide what can run in parallel. The forward path is only the first half of training.',
  };

  yield {
    state: graph('Backpropagation is graph structure too'),
    highlight: { active: ['loss', 'grad', 'update', 'var', 'e-loss-grad', 'e-grad-update', 'e-update-var'], found: ['matmul'] },
    explanation: 'Gradients are not magic outside the system. They are graph work too: the loss creates reverse edges, gradients feed optimizer ops, and those ops mutate variable state.',
    invariant: 'Edges carry tensors; stateful ops own persistent variables.',
  };

  yield {
    state: labelMatrix(
      'Why a graph helps the runtime',
      [
        { id: 'parallel', label: 'parallelism' },
        { id: 'placement', label: 'placement' },
        { id: 'memory', label: 'memory planning' },
        { id: 'rewrite', label: 'graph rewrites' },
      ],
      [
        { id: 'signal', label: 'graph signal' },
        { id: 'payoff', label: 'payoff' },
      ],
      [
        ['independent ops', 'run concurrently'],
        ['device constraints', 'CPU/GPU/TPU mapping'],
        ['tensor lifetimes', 'reuse buffers'],
        ['known subgraphs', 'fuse or optimize ops'],
      ],
    ),
    highlight: { found: ['parallel:payoff', 'placement:payoff', 'rewrite:payoff'], active: ['memory:signal'] },
    explanation: 'The graph gives the runtime information that ordinary imperative code hides: dependencies, tensor sizes, candidate devices, and rewrite opportunities.',
  };

  yield {
    state: labelMatrix(
      'Graph systems lineage',
      [
        { id: 'dataflow', label: 'Dataflow Model' },
        { id: 'tensorflow', label: 'TensorFlow' },
        { id: 'ray', label: 'Ray' },
        { id: 'autograd', label: 'Autograd' },
      ],
      [
        { id: 'graph', label: 'graph represents' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['event pipeline', 'windows and time'],
        ['tensor computation', 'stateful ML ops'],
        ['dynamic task graph', 'actors and futures'],
        ['derivative program', 'local differentiation'],
      ],
    ),
    highlight: { found: ['tensorflow:graph', 'tensorflow:difference'], compare: ['ray:difference'] },
    explanation: 'TensorFlow sits in a family of graph-based systems, but its graph is specialized for tensor computation, placement, automatic differentiation, and stateful training.',
  };
}

function* placementAndState() {
  yield {
    state: labelMatrix(
      'Place ops across heterogeneous devices',
      [
        { id: 'input', label: 'input pipeline' },
        { id: 'matmul', label: 'matrix multiply' },
        { id: 'embedding', label: 'embedding lookup' },
        { id: 'update', label: 'variable update' },
      ],
      [
        { id: 'device', label: 'device' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['CPU', 'IO and parsing'],
        ['GPU/TPU', 'dense linear algebra'],
        ['CPU/GPU', 'depends on table and batch'],
        ['parameter device', 'owns state'],
      ],
    ),
    highlight: { active: ['matmul:device', 'embedding:device'], found: ['update:reason'] },
    explanation: 'Placement is the hidden systems problem. The runtime maps graph nodes to devices while balancing kernels, tensor sizes, communication cost, state ownership, and available hardware.',
  };

  yield {
    state: graph('Variables make the graph stateful'),
    highlight: { active: ['var', 'update', 'e-update-var'], compare: ['input', 'loss'] },
    explanation: 'Variables hold model parameters across steps. That is the difference between a pure dataflow graph and a training system: some ops mutate shared state in a controlled way.',
  };

  yield {
    state: labelMatrix(
      'Distributed training choices',
      [
        { id: 'sync', label: 'synchronous replicas' },
        { id: 'async', label: 'asynchronous replicas' },
        { id: 'ps', label: 'parameter server' },
        { id: 'collective', label: 'collective all-reduce' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['stable gradients', 'waits for slow workers'],
        ['high throughput', 'stale gradients'],
        ['central state abstraction', 'server bottlenecks'],
        ['balanced communication', 'topology sensitive'],
      ],
    ),
    highlight: { found: ['sync:benefit', 'collective:benefit'], compare: ['async:cost', 'ps:cost'] },
    explanation: 'TensorFlow supported multiple distributed execution patterns. The broader lesson is that ML systems must expose enough control for researchers and production engineers to choose consistency, throughput, and hardware tradeoffs.',
  };

  yield {
    state: labelMatrix(
      'Case-study lessons',
      [
        { id: 'abstraction', label: 'abstraction' },
        { id: 'runtime', label: 'runtime' },
        { id: 'kernels', label: 'kernels' },
        { id: 'debug', label: 'debugging' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['graphs reveal dependencies', 'too static for dynamic workloads'],
        ['places and schedules ops', 'hidden transfer costs'],
        ['hardware-specific speed', 'kernel fragmentation'],
        ['large graph state', 'hard failure attribution'],
      ],
    ),
    highlight: { active: ['abstraction:lesson', 'runtime:lesson'], compare: ['debug:danger'] },
    explanation: 'This is why later systems draw different boundaries. Ray makes dynamic tasks easy. TensorFlow makes tensor graphs and hardware placement explicit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'graph execution') yield* graphExecution();
  else if (view === 'placement and state') yield* placementAndState();
  else throw new InputError('Pick a TensorFlow view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read nodes as operations and edges as tensors, which are multidimensional arrays flowing between operations. Variables are stateful nodes that persist across training steps, while activations and gradients are temporary tensors used during one step.',
        'The safe inference rule is dependency-based scheduling. If two operations do not depend on each other, the runtime may run them in parallel or place them on different devices; if one consumes another tensor, the edge enforces order.',
        {type:'callout', text:'TensorFlow made ML training a schedulable graph so the runtime could reason about tensors, state, placement, and device boundaries before execution.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large machine-learning jobs are systems problems as much as math problems. They need data input, tensor kernels, accelerator placement, gradient computation, variable updates, checkpoints, and distributed communication.',
        'TensorFlow exists as a dataflow case study because it made the computation graph explicit. Once operations, tensors, state, and dependencies are visible, a runtime can schedule, place, rewrite, partition, and execute the program across hardware.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an imperative loop that calls one tensor operation after another. That is easy to understand for a small model on one machine.',
        'A second obvious approach is to hand-place distributed work. The researcher or engineer decides which device owns each variable and which GPU runs each layer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The imperative loop hides global structure. The runtime sees one call at a time rather than the full dependency graph, so it has less room to overlap work, plan memory, fuse operations, or avoid bad transfers.',
        'Hand placement does not scale as models and clusters grow. Model logic becomes tangled with device names, communication edges, checkpointing, failure behavior, and performance debugging.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Expose the ML step as a graph before execution. Nodes are operations such as MatMul, BiasAdd, ReLU, loss, gradient, and optimizer update; edges carry tensors; variables hold persistent model state.',
        'The invariant is dependency correctness. An operation can run only after its input tensors are ready, and state updates must respect the training semantics chosen by the program.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A program builds a graph for forward computation. Automatic differentiation adds backward operations that consume loss and intermediate tensors to compute gradients.',
        'The runtime places graph nodes on CPUs, GPUs, TPUs, or remote workers. It may insert send and receive edges, select kernels, reuse buffers, fuse operations, and schedule independent nodes in parallel.',
        'Distributed training adds consistency choices. Synchronous replicas aggregate gradients before updating state, while asynchronous replicas may update sooner with stale gradients; parameter servers and collectives define different communication patterns.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Dataflow works because dependencies are explicit. If the graph says operation B consumes the tensor from operation A, the runtime has a proof that A must finish before B; if no path connects two operations, they can be candidates for parallel execution.',
        'The model fits neural-network training because forward tensors, gradient tensors, optimizer updates, and persistent variables have clear roles. Checkpoints can record variables and needed state without treating every temporary activation as permanent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Graph execution adds build time, placement work, runtime planning, and debugging complexity. When a tensor crosses PCIe or the network unexpectedly, the user may see slow training before seeing the hidden transfer.',
        'Cost depends on graph size, tensor sizes, kernel availability, memory pressure, communication topology, and synchronization policy. A static graph can enable global optimization, but a highly dynamic workload may pay more friction than it saves.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TensorFlow-style graphs fit production training and inference where repeatability, accelerator placement, graph optimization, checkpointing, and distributed execution matter. They have been used in vision, speech, recommendation, robotics, information retrieval, and natural-language systems.',
        'The case study also teaches runtime design. Automatic differentiation, kernel dispatch, device placement, memory planning, and distributed state ownership are data-structure problems inside an ML framework.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A graph is not automatically fast. Poor placement, unsupported kernels, slow input pipelines, excessive communication, retained activations, or straggling workers can make a graph execution slower than a simpler local loop.',
        'It can also be awkward for dynamic control flow and interactive debugging. Eager execution and dynamic task systems draw different boundaries because some work benefits from immediate local behavior more than global graph planning.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one training step decodes 256 images on CPU, sends a batch tensor to a GPU, runs 20 dense and convolution operations, computes loss, creates gradients, and updates 50 variable tensors. In a graph, input decoding can overlap with GPU compute, and temporary activations can be freed after their gradient consumers finish.',
        'Now use four workers. Synchronous training waits until all four gradient sets arrive before one update, which keeps steps aligned but can wait for a slow worker; asynchronous training may apply gradients sooner but risks stale updates from older weights.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the TensorFlow OSDI paper at https://www.usenix.org/system/files/conference/osdi16/osdi16-abadi.pdf, the USENIX page at https://www.usenix.org/conference/osdi16/technical-sessions/presentation/abadi, and the arXiv version at https://arxiv.org/abs/1603.04467. Study dataflow, automatic differentiation, backpropagation, parameter servers, all-reduce, XLA, GPU kernel fusion, Ray, and distributed tracing next.',
      ],
    },
  ],
};
