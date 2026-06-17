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
    explanation: 'Read the controller as the logical owner of the program, not the place where accelerator compute happens. Operators produce futures, so the control plane can keep scheduling while data-plane work runs on accelerator islands.',
  };

  yield {
    state: dataflowGraph('Independent operators can run on different islands'),
    highlight: { active: ['opA', 'opB', 'island1', 'island2', 'e-opa-island1', 'e-opb-island2'], found: ['join'] },
    explanation: 'The key move is to let independent pieces of a model program occupy different accelerator islands. The join waits on futures, so unrelated work does not have to march through one rigid lockstep step.',
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
    explanation: 'Large ML jobs are placement problems disguised as model code. The runtime must decide where computation and tensors live, then coordinate communication over accelerator interconnects.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Pathways exists because large ML programs stopped looking like one uniform operation repeated across identical devices. Data parallel training still matters, but modern systems also need tensor parallelism, pipeline stages, sparse experts, multimodal branches, preprocessing, retrieval, serving-time routing, and work that changes shape by input. A rigid runtime can make these programs run, but it often forces researchers to rewrite the model around the limitations of the execution system.',
        'The Pathways paper is best treated as a control-plane case study. It asks how one logical runtime can express a distributed ML program, place pieces of that program on accelerator islands, track asynchronous dependencies, and keep expensive hardware busy. The topic connects TensorFlow Dataflow Case Study, Ray Distributed Execution Case Study, Borg Cluster Scheduler Case Study, Parameter Server Case Study, Pipeline Parallelism, Tensor Parallelism, and Mixture of Experts. Each of those topics covers one pressure; Pathways puts the pressures into one serving and training runtime.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is SPMD: single program, multiple data. Give every accelerator the same program shape, split the data or tensors, synchronize at collective boundaries, and repeat. This is a strong baseline. It is simple to reason about, maps well to many dense training jobs, and keeps the programming model close to ordinary array code.',
        'The wall appears when the model is not naturally one repeated step. A sparse expert layer routes different tokens to different experts. A multimodal model may run a vision tower only for image inputs. A pipeline may keep one island busy with early layers while another runs later layers. A serving graph may mix prompt processing, decode, tool calls, and state reuse. Lockstep execution either wastes devices on inactive work or pushes the complexity into hand-built distributed code.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that dependencies should constrain the dataflow graph, not every line of host control. If operation B only needs the output of operation A, then B must wait for A. But unrelated operations should not wait merely because the host program was written as a sequence. Futures are the handle that makes this explicit: an operation can return a value that will exist later, and dependent operations can wait on that value while independent work proceeds.',
        'This changes the invariant. The runtime does not promise that all devices are at the same program counter. It promises that every operation observes its declared inputs after their producers complete, and that placement, transfer, and execution are coordinated by a single logical program view. That invariant is broad enough for heterogeneous model code but still precise enough for scheduling and debugging.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client submits an ML program to a controller. The controller represents the program as asynchronous dataflow: operators consume inputs, produce futures, and may run on different accelerator islands. The data plane does the tensor compute on TPUs or GPUs. The control plane owns graph structure, dependency tracking, placement, and coordination. The controller is logical authority, not the place where matrix multiplication happens.',
        'Placement is the hard middle layer. The runtime must decide where parameters, activations, operators, and futures live. It must know which accelerator islands are available, which communication links are expensive, which operations can overlap, and which join waits on the critical path. For dense data parallelism, placement may be straightforward. For model shards, pipeline stages, and sparse experts, placement becomes a first-order part of the program.',
        'The visualization separates those concerns. The client and controller show expression of the program. The independent operators show asynchronous scheduling. The accelerator islands show where compute happens. The join node shows that futures, not global clock ticks, define when downstream work can continue.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The idea works when the control plane and data plane are separated cleanly. The controller can keep a global dependency view, but it should not move every byte or execute every tensor kernel itself. Accelerators do the heavy compute. Interconnects move tensor data. The controller schedules, observes, and reacts. This is the same broad pattern as Borg, Kubernetes, Ray, and many database systems: centralize enough control to make good decisions, distribute enough execution to use the hardware.',
        'It also works because futures expose hidden parallelism. A sequential host loop may imply that one operator finishes before another starts. A dataflow graph can show that the two operators are independent and can run on separate islands. The runtime can overlap prefill-like work with decode-like work, branch-specific work with shared work, and transfer with compute when dependencies allow it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a multimodal assistant with a vision encoder, a text encoder, a sparse expert block, and a shared decoder. Some requests include images. Others are text-only. Some tokens route to one expert group, while others route to another. A strict SPMD program can make every device execute the same large shape, but it wastes work on paths that are inactive for a given request.',
        'A Pathways-style runtime can express the useful shape directly. The image path produces a future only when image input exists. The text path runs independently. Expert routing sends token groups to different accelerator islands. The shared decoder joins the futures it needs. The mechanism is not magic; it is dependency-aware placement and scheduling. The payoff is that the model architecture does not have to pretend to be uniform.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'An implementation needs a graph representation, a future API, a placement planner, a scheduler, a transfer manager, and an observability model. The graph representation should make dependencies explicit. The future API should distinguish value readiness from host blocking. The placement planner should reason about accelerator memory, interconnect cost, operator shape, and data locality. The scheduler should keep independent work moving without starving long critical paths.',
        'The control plane also needs backpressure and admission control. A flexible graph can create too many outstanding futures, too many transfers, or too much live activation state. Without limits, the runtime can keep the program logically correct while making the machine thrash. Practical systems need quotas, priority, cancellation, retry rules, and clear ownership of resource budgets.',
        'Observability should be part of the design, not an afterthought. Track future wait time, controller queue depth, accelerator utilization, operator runtime, transfer volume, cross-island bandwidth, placement decisions, cache or state residency, retries, and straggler islands. A distributed ML runtime without traces is a system where the most expensive bugs look like idle hardware.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is control-plane complexity. The runtime must place operations, manage futures, coordinate data movement, gang-schedule accelerator work, and diagnose distributed stalls. Communication can dominate if model shards are placed poorly. The single logical controller must avoid becoming a bottleneck as the number of operators, devices, and clients grows.',
        'Evaluation should include more than peak FLOPs. Measure scheduling overhead, transfer overhead, critical-path latency, accelerator utilization by island, future wait time, failure recovery, priority fairness, multi-tenant interference, and trace quality. A runtime that can express a beautiful graph but leaves hardware idle has failed the systems test.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Pathways-like ideas win when the program has real heterogeneity. Multimodal models, sparse activation, model-parallel training, pipeline-parallel execution, multi-task training, large inference graphs, and research systems that try new parallelism patterns all benefit from a runtime that can express more than one rigid step shape.',
        'The approach also wins when developer time is the scarce resource. If every new model architecture requires a custom distributed runtime, system work becomes the gate on research. A shared control plane lets researchers express branches, joins, futures, and placement constraints at a higher level while the runtime handles the common distributed machinery.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The wrong tool is a flexible dataflow runtime for a uniform dense job that already runs well as SPMD. If the model has one simple repeated shape, the extra controller machinery may add scheduling overhead, debugging surface, and operational risk without much benefit. Simpler execution can be easier to optimize and easier to trust.',
        'The approach also fails when placement and observability are weak. A future-based program can stall because one transfer is on the critical path, one expert is hot, one island is fragmented, or one controller queue is overloaded. If the system cannot explain those stalls, flexibility turns into opacity. The runtime must make distributed state inspectable enough for ordinary ML engineers to fix production problems.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not reduce Pathways to a slogan about one model doing every task. The durable technical lesson is the orchestration layer: asynchronous dataflow over accelerator islands with futures as dependency handles. The question is how a runtime expresses and schedules flexible ML programs without wasting accelerator hardware.',
        'Do not confuse a single logical controller with centralized compute. Compute remains distributed. The controller is the authority that coordinates graph execution. Also do not assume that futures remove synchronization costs. Futures make dependencies explicit; they do not make data movement free. The hard failures are familiar systems failures: bad placement, hot routes, transfer bottlenecks, weak admission control, and insufficient traces.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Pathways: Asynchronous Distributed Dataflow for ML at https://arxiv.org/abs/2203.12533 and the MLSys paper PDF at https://proceedings.mlsys.org/paper_files/paper/2022/file/37385144cac01dff38247ab11c119e3c-Paper.pdf. Study TensorFlow Dataflow Case Study for graph execution, Ray Distributed Execution Case Study for futures, Borg Cluster Scheduler Case Study for resource control, Pipeline Parallelism and Tensor Parallelism for accelerator layouts, Mixture of Experts for sparse routing, and LLM Inference Cost Stack Case Study for the serving-side economics of placement and state.',
      ],
    },
  ],
};
