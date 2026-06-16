// Pathways case study: a distributed ML orchestration layer that exposes more
// flexible accelerator programs than one rigid SPMD job.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'pathways-case-study',
  title: 'Pathways Case Study',
  category: 'Papers',
  summary: 'Google Pathways as an ML-systems lesson: asynchronous dataflow, futures, single-controller orchestration, and heterogeneous accelerator islands.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['async dataflow', 'accelerator orchestration'], defaultValue: 'async dataflow' },
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

function dataflowGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.7, note: 'program' },
      { id: 'controller', label: 'controller', x: 2.5, y: 3.7, note: 'single logical brain' },
      { id: 'opA', label: 'op A', x: 4.3, y: 2.1, note: 'future out' },
      { id: 'opB', label: 'op B', x: 4.3, y: 5.3, note: 'future out' },
      { id: 'island1', label: 'TPU island 1', x: 6.4, y: 2.1, note: 'accelerators' },
      { id: 'island2', label: 'TPU island 2', x: 6.4, y: 5.3, note: 'accelerators' },
      { id: 'join', label: 'join op', x: 8.4, y: 3.7, note: 'uses futures' },
    ],
    edges: [
      { id: 'e-client-controller', from: 'client', to: 'controller', weight: 'program graph' },
      { id: 'e-controller-opa', from: 'controller', to: 'opA', weight: 'schedule' },
      { id: 'e-controller-opb', from: 'controller', to: 'opB', weight: 'schedule' },
      { id: 'e-opa-island1', from: 'opA', to: 'island1', weight: 'compute' },
      { id: 'e-opb-island2', from: 'opB', to: 'island2', weight: 'compute' },
      { id: 'e-island1-join', from: 'island1', to: 'join', weight: 'future' },
      { id: 'e-island2-join', from: 'island2', to: 'join', weight: 'future' },
    ],
  }, { title });
}

function* asyncDataflow() {
  yield {
    state: dataflowGraph('Pathways represents ML work as asynchronous dataflow'),
    highlight: { active: ['client', 'controller', 'e-client-controller'], compare: ['opA', 'opB', 'join'] },
    explanation: 'Pathways is an orchestration layer for large accelerator programs. The client submits a computation graph. The controller schedules asynchronous operators whose outputs are futures, so the control plane can keep planning while data-plane work runs.',
  };

  yield {
    state: dataflowGraph('Independent operators can run on different islands'),
    highlight: { active: ['opA', 'opB', 'island1', 'island2', 'e-opa-island1', 'e-opb-island2'], found: ['join'] },
    explanation: 'The key move is to let independent pieces of a model program occupy different accelerator islands. The join waits on futures rather than forcing every participant through one rigid global step.',
    invariant: 'Dependencies constrain dataflow edges, not every line of host control.',
  };

  yield {
    state: labelMatrix(
      'What Pathways changes relative to rigid SPMD',
      [
        { id: 'parallelism', label: 'parallelism' },
        { id: 'control', label: 'control flow' },
        { id: 'resource', label: 'resource sharing' },
        { id: 'debug', label: 'debugging' },
      ],
      [
        { id: 'rigid', label: 'rigid SPMD pressure' },
        { id: 'pathways', label: 'Pathways direction' },
      ],
      [
        ['same program everywhere', 'heterogeneous computations'],
        ['barrier-shaped execution', 'async futures and joins'],
        ['job owns full slice', 'virtualized accelerator islands'],
        ['local step reasoning', 'global orchestration traces'],
      ],
    ),
    highlight: { active: ['parallelism:pathways', 'control:pathways', 'resource:pathways'], compare: ['debug:pathways'] },
    explanation: 'The system is built for more flexible ML programs: pipelining, model parallelism across islands, heterogeneous work, and centralized resource management.',
  };

  yield {
    state: labelMatrix(
      'Concept lineage',
      [
        { id: 'tensorflow', label: 'TensorFlow' },
        { id: 'ray', label: 'Ray' },
        { id: 'borg', label: 'Borg' },
        { id: 'pathways', label: 'Pathways' },
      ],
      [
        { id: 'idea', label: 'idea reused' },
        { id: 'specialization', label: 'specialization' },
      ],
      [
        ['dataflow graph', 'tensor and variable ops'],
        ['futures and tasks', 'dynamic distributed execution'],
        ['cluster scheduling', 'datacenter resource control'],
        ['async ML dataflow', 'accelerator orchestration'],
      ],
    ),
    highlight: { found: ['pathways:idea', 'pathways:specialization'], compare: ['tensorflow:idea', 'ray:idea', 'borg:idea'] },
    explanation: 'Pathways combines ideas that appear elsewhere on this site: TensorFlow-style graphs, Ray-style futures, and Borg-style resource management, specialized for accelerator-heavy ML.',
  };
}

function* acceleratorOrchestration() {
  yield {
    state: labelMatrix(
      'Accelerator islands create placement choices',
      [
        { id: 'data', label: 'data parallel' },
        { id: 'model', label: 'model parallel' },
        { id: 'pipeline', label: 'pipeline parallel' },
        { id: 'sparse', label: 'sparse activation' },
      ],
      [
        { id: 'placement', label: 'placement shape' },
        { id: 'hard part', label: 'hard part' },
      ],
      [
        ['replicate model shards', 'gradient synchronization'],
        ['split parameters', 'cross-island communication'],
        ['stage layers', 'bubble and balance'],
        ['activate some work', 'routing and load balance'],
      ],
    ),
    highlight: { active: ['model:placement', 'pipeline:placement', 'sparse:placement'], compare: ['data:hard part'] },
    explanation: 'Large ML jobs are placement problems. The runtime must decide where computation and tensors live, then coordinate communication over accelerator interconnects.',
  };

  yield {
    state: dataflowGraph('The controller virtualizes accelerator resources'),
    highlight: { active: ['controller', 'island1', 'island2', 'e-controller-opa', 'e-controller-opb'], found: ['join'] },
    explanation: 'The paper emphasizes a single-controller model for complex parallelism patterns. That controller does not mean one CPU doing all compute; it means one logical authority coordinates distributed accelerator work.',
  };

  yield {
    state: labelMatrix(
      'Why ML research wants this abstraction',
      [
        { id: 'multi', label: 'multimodal models' },
        { id: 'task', label: 'multi-task training' },
        { id: 'expert', label: 'experts and routers' },
        { id: 'serve', label: 'large inference' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'system pressure', label: 'system pressure' },
      ],
      [
        ['different subnetworks', 'heterogeneous compute'],
        ['shared and task-specific paths', 'dynamic control'],
        ['conditional compute', 'load balance hot experts'],
        ['pipeline across devices', 'latency and utilization'],
      ],
    ),
    highlight: { found: ['multi:need', 'task:need', 'expert:need'], active: ['expert:system pressure'] },
    explanation: 'Pathways was motivated by research directions where one model or one program may not run as a single uniform computation. Mixture of Experts (MoE) is the obvious local example.',
  };

  yield {
    state: labelMatrix(
      'Case-study lessons',
      [
        { id: 'control', label: 'control plane' },
        { id: 'data', label: 'data plane' },
        { id: 'placement', label: 'placement' },
        { id: 'observability', label: 'observability' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['centralize expression', 'controller bottleneck if weak'],
        ['parallelize execution', 'hidden transfer costs'],
        ['optimize globally', 'fragmented accelerator islands'],
        ['trace futures and ops', 'opaque distributed stalls'],
      ],
    ),
    highlight: { active: ['control:lesson', 'data:lesson', 'placement:lesson'], compare: ['observability:danger'] },
    explanation: 'The deeper lesson is control-plane design. Flexible ML programs need a runtime that can express them, place them, observe them, and recover when the distributed execution graph stalls.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'async dataflow') yield* asyncDataflow();
  else if (view === 'accelerator orchestration') yield* acceleratorOrchestration();
  else throw new InputError('Pick a Pathways view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Pathways is a Google ML systems case study about orchestrating large accelerator computations. The paper describes an asynchronous distributed dataflow runtime designed for programs that span many accelerator islands, including TPU pods. The key abstraction is not a new neural layer. It is a control plane that can express more flexible model-parallel, pipeline-parallel, and heterogeneous computations while still driving hardware efficiently.',
        'The case study belongs next to TensorFlow Dataflow Case Study, Ray Distributed Execution Case Study, Borg Cluster Scheduler Case Study, and Mixture of Experts (MoE). Those topics each expose part of the problem: dataflow graphs, futures, cluster resources, and conditional computation. Pathways combines those pressures in the setting of modern ML workloads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client program submits a graph of asynchronous operators. Operators consume and produce futures, so the control plane can continue scheduling around unresolved data dependencies. The runtime places work onto accelerator islands and coordinates transfers over their interconnects. The paper argues for a single-controller model because complex parallelism patterns are easier to express when one logical controller owns the global program view.',
        'This is different from a rigid SPMD job where every device executes the same program step in lockstep. Pathways aims to support non-SPMD computations, pipeline stages, model shards across islands, and heterogeneous parts of a larger ML program. It still needs high accelerator utilization, so the abstraction has to be flexible without becoming slow.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is control-plane sophistication. The runtime must place operations, manage futures, coordinate data movement, gang-schedule accelerator work, and expose enough observability for engineers to debug stalls. Communication can dominate if model shards are placed poorly. A single logical controller simplifies expression but must be engineered so it does not become the bottleneck.',
        'The system also changes how failures are diagnosed. In ordinary training, a slow step may be blamed on a device or collective. In an asynchronous dataflow program, the stall can come from a future dependency, a transfer, a placement decision, a hot expert, or resource contention between clients. Distributed tracing discipline becomes part of ML infrastructure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The Pathways paper is directly relevant to large model training, multimodal models, sparse activation, large inference graphs, and research systems that need to try new parallelism patterns quickly. It also explains why ML frameworks increasingly look like distributed operating systems. They schedule accelerators, virtualize resources, coordinate memory movement, and provide a programming model for scientists who should not hand-code every device transfer.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Pathways should not be reduced to a branding phrase about one model doing every task. The durable technical lesson is the orchestration layer: asynchronous dataflow over accelerator islands with a control plane that can express flexible parallel programs. Another misconception is that a single-controller design means centralized computation. The compute is distributed; the controller is the logical authority that coordinates it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Pathways: Asynchronous Distributed Dataflow for ML at https://arxiv.org/abs/2203.12533 and the MLSys PDF at https://proceedings.mlsys.org/paper_files/paper/2022/file/37385144cac01dff38247ab11c119e3c-Paper.pdf. Study TensorFlow Dataflow Case Study, Ray Distributed Execution Case Study, Borg Cluster Scheduler Case Study, Parameter Server Case Study, Transformer Block, and Mixture of Experts (MoE) next.',
      ],
    },
  ],
};
