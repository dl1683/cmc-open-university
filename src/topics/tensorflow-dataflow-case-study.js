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
      heading: 'Why this exists',
      paragraphs: [
        'Large-scale machine learning is not just a set of equations. A training job has to place tensor operations on CPUs, GPUs, TPUs, and remote workers; move data between them; update state; checkpoint progress; and recover enough information to debug slow or wrong runs.',
        'TensorFlow made that problem explicit by representing computation as a dataflow graph. Nodes are operations, edges are tensors, and stateful nodes hold variables. Once computation is a graph, the runtime can schedule, place, rewrite, partition, and execute it across devices.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an imperative loop: run this tensor operation, then the next, then the next. That is easy to debug for small models, but it hides the global structure. The runtime sees calls one at a time instead of seeing the dependency graph it could optimize.',
        'Another simple approach is hand-written distributed training. A researcher can decide which machine owns each variable and which GPU runs each layer, but that quickly becomes brittle. The program starts mixing model logic with placement, communication, checkpointing, and failure handling.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is scale. A model step may contain thousands of operations, large tensors, device-specific kernels, and communication between workers. A single bad placement can move tensors across the network or PCIe boundary repeatedly. A single straggler can stall synchronous training.',
        'State is the second wall. Variables persist across steps; activations do not. Gradients are derived from the forward pass; optimizer slots may persist beside variables. Checkpointing has to capture the right state without treating every intermediate tensor as permanent.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Expose the computation as a graph so the system can reason about dependencies before execution. If the runtime knows that two branches are independent, it can run them in parallel. If it knows a tensor is consumed only once, it can plan memory reuse. If it knows where a variable lives, it can place update operations nearby.',
        'The graph is also a contract between the user program and the runtime. The user describes tensor operations and state. The runtime chooses kernels, device placement, communication edges, execution order, and sometimes graph rewrites. The abstraction pays off when the runtime can optimize better than a hand-written loop.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'In the graph-execution view, follow the forward path from input to loss, then the backward path from loss to gradients to optimizer update. The variables node is state: it persists across steps, unlike activation tensors that can be freed after use.',
        'In the placement-and-state view, each row is a scheduling decision. CPUs may parse input, GPUs or TPUs run dense linear algebra, parameter devices own state, and collectives or parameter servers move updates. TensorFlow is not one execution policy; it exposes several consistency and throughput choices.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A program builds a graph of tensor operations. Automatic differentiation adds gradient operations for training. Optimizer operations update variables. The runtime then partitions and places graph nodes on available devices such as CPUs, GPUs, TPUs, or remote workers.',
        'Execution follows graph dependencies. An operation can run when its input tensors are ready and an appropriate kernel exists for the chosen device. The runtime may insert send and receive operations between devices, choose kernels, reuse memory buffers, and coordinate variable updates.',
        'Distributed execution adds policy choices. Synchronous replicas aggregate gradients before applying an update, which keeps workers on the same training step but waits for slow workers. Asynchronous replicas improve throughput but can apply stale gradients. Parameter-server designs centralize variable ownership; collective all-reduce spreads communication differently.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A simple image classifier reads a batch, decodes images on CPU, sends tensors to a GPU, runs convolutions, computes loss, creates gradients, and updates variables. In a graph runtime, those dependencies are visible. Input preprocessing can overlap with GPU compute. Temporary activations can be freed after backpropagation. Variable updates can be grouped and checkpointed.',
        'Now distribute the same training job. Four workers compute gradients on their local batches. In synchronous training, the gradients are combined and the same update is applied everywhere. In asynchronous training, workers may send gradients to parameter servers at different times. The graph and runtime define where communication happens and what consistency model the training loop receives.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Dataflow works because dependencies are explicit. If operation B needs tensor A, the edge says so. If two operations have no dependency, the runtime can schedule them independently. This gives the system room to exploit parallelism, choose placements, and insert communication without the user writing every scheduling decision.',
        'The model also matches the mathematical structure of neural networks well enough for many workloads. Forward operations produce tensors. Backward operations consume them to produce gradients. Variables provide persistent state. Checkpoints capture variables and other needed state so training can continue after interruption.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Graph systems add build time, runtime planning, and debugging complexity. When a placement decision is bad, the user may see only slow training, not the hidden tensor transfer that caused it. When the graph is large, error messages and performance traces can be hard to connect back to the original model code.',
        'The payoff depends on workload shape. Static or mostly static tensor programs benefit from global optimization, kernel fusion, memory planning, and distributed scheduling. Highly dynamic workloads may prefer a more imperative task system or eager execution because the graph boundary can become friction.',
        'Graph rewrites are powerful but risky to explain poorly. Constant folding, common subexpression elimination, layout changes, fusion, and device-specific lowering can make the executed program differ from the naive graph a learner drew. The right lesson is that the graph is an optimization surface, not merely a visualization.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'TensorFlow-style dataflow wins for production ML systems that need repeatable execution, accelerator placement, graph optimization, distributed training, checkpointing, and serving. It has been used across speech, vision, recommendation, robotics, information retrieval, natural language processing, and production inference systems.',
        'It is also a useful case study because it turns a machine-learning framework into a systems topic. Graph construction, automatic differentiation, kernel dispatch, device placement, communication, state ownership, and checkpointing are all data-structure and runtime problems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A dataflow graph is not automatically fast. It gives the runtime information, but kernels, placement, communication, batching, memory, and hardware topology still decide performance. A graph with poor placement can be slower than a simple local loop.',
        'It also does not solve every programming model. Dynamic control flow, irregular workloads, interactive debugging, and Python-side logic can be awkward when the main abstraction expects a graph. Later systems and TensorFlow modes draw the boundary differently because no single abstraction fits all ML work.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failures include hidden device transfers, slow input pipelines, unsupported kernels, excessive graph size, checkpoint mismatches, stale gradients in asynchronous training, stragglers in synchronous training, and memory pressure from retained activations. A good trace separates graph construction, placement, kernel time, communication, and input stalls.',
        'The main misconception is that the graph is the model. The graph is an execution representation of the model plus training machinery. The real system includes data ingestion, hardware, kernels, optimizers, checkpoints, metrics, and debugging tools.',
        'A second misconception is that static graphs and eager execution are moral opposites. They are different debugging and optimization boundaries. Eager execution makes local behavior easier to inspect; graph execution gives the system more global structure to optimize and distribute.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: TensorFlow OSDI paper at https://www.usenix.org/system/files/conference/osdi16/osdi16-abadi.pdf, USENIX page at https://www.usenix.org/conference/osdi16/technical-sessions/presentation/abadi, and arXiv system paper at https://arxiv.org/abs/1603.04467.',
        'Study Backpropagation, Neural Network Forward Pass, Automatic Differentiation, Parameter Server Case Study, Ray Distributed Execution Case Study, Borg Cluster Scheduler Case Study, XLA compiler material, and GPU Kernel Fusion for adjacent runtime ideas.',
      ],
    },
  ],
};
