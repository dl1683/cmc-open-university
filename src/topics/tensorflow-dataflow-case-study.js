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
    explanation: 'TensorFlow made ML computation explicit as a graph of operations over tensors. That graph can represent forward computation, gradient computation, and state updates.',
  };

  yield {
    state: graph('Backpropagation is graph structure too'),
    highlight: { active: ['loss', 'grad', 'update', 'var', 'e-loss-grad', 'e-grad-update', 'e-update-var'], found: ['matmul'] },
    explanation: 'Gradients are not magic outside the system. They are added to the graph and scheduled like other operations, then optimizer ops mutate variable state.',
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
    explanation: 'TensorFlow maps graph nodes to devices. The placement problem mixes hardware, tensor sizes, communication, state ownership, and available kernels.',
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
      heading: 'What it is',
      paragraphs: [
        'TensorFlow is a system for large-scale machine learning that represents computation as a dataflow graph. Nodes are operations, edges are tensors, and stateful operations hold variables that can be updated during training.',
        'The case study matters because it shows how an ML framework becomes a distributed systems problem: graph construction, placement, scheduling, kernels, communication, state ownership, checkpointing, and debugging.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A program builds a graph of tensor operations. The runtime places operations on devices such as CPUs, GPUs, TPUs, and remote workers, then executes according to graph dependencies. Automatic differentiation adds gradient computation, and optimizer operations update variables.',
        'The graph representation gives the runtime opportunities for parallelism, placement, memory planning, and graph rewrites. Distributed execution adds choices such as synchronous replicas, asynchronous replicas, parameter servers, and collective communication.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'TensorFlow-style graphs expose optimization opportunities but can make dynamic control flow, debugging, and performance attribution harder. Placement mistakes create hidden transfer costs. Stateful variables require checkpointing and consistency decisions. Hardware-specific kernels can dominate real performance.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TensorFlow has been used for training and inference in speech, vision, recommendation, robotics, information retrieval, natural language processing, and production ML services. Its graph ideas influenced later ML compiler and serving stacks.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A dataflow graph is not automatically fast. It gives the runtime information, but kernels, placement, communication, and memory still decide performance. Another misconception is that graph systems and dynamic task systems solve the same problem; TensorFlow and Ray optimize different workload shapes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: USENIX OSDI paper at https://www.usenix.org/system/files/conference/osdi16/osdi16-abadi.pdf, USENIX page at https://www.usenix.org/conference/osdi16/technical-sessions/presentation/abadi, and arXiv system paper at https://arxiv.org/abs/1603.04467. Study Backpropagation, Neural Network Forward Pass, Ray Distributed Execution Case Study, Parameter Server Case Study, and Borg Cluster Scheduler Case Study next.',
      ],
    },
  ],
};
