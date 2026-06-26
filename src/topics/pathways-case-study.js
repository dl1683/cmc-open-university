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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a distributed machine-learning program. A future is a placeholder for a value that will be produced later, an island is a group of accelerators with fast local links, and an edge means one operation must wait for another value before it can run.',
        'The safe inference is local: if two operators do not share a dependency edge, the runtime may schedule them at the same time on different islands. The join node is where the proof of readiness happens, because it can run only after all required futures are available.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Pathways exists because large machine-learning programs no longer fit one repeated step across identical devices. A system may train dense layers, sparse experts, preprocessing branches, retrieval calls, and serving-time decode work inside one logical program.',
        'A runtime is the control software that decides where work runs and when dependent work may continue. Pathways asks how one runtime can coordinate accelerator islands without forcing every model to pretend it is a uniform data-parallel loop.',
        {type:'callout', text:'Pathways treats a large ML program as a dependency graph over futures, letting independent work proceed while one logical runtime coordinates placement and transfers.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is single program, multiple data, often shortened to SPMD. Every accelerator runs the same program shape, receives a different shard of data or tensors, synchronizes at known collective operations, and repeats.',
        'That approach is not naive. It works well for many dense training jobs because it has simple failure modes, clear synchronization points, and a programming model close to array code.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the program has real branches. A sparse expert layer sends token groups to different experts, an image branch runs only for image inputs, and a serving graph may mix prompt processing, decode, tool calls, and state reuse.',
        'Lockstep execution either wastes devices on inactive paths or pushes orchestration into hand-written distributed code. The cost is not only slower hardware use; it is that model design starts being shaped by runtime limitations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make dependencies explicit and let the runtime schedule around them. A future names a value that will exist later, so operations can declare what they need without blocking unrelated work.',
        'The invariant is that every operation observes its declared inputs after their producers complete. The runtime does not promise that every device has the same program counter; it promises dependency-respecting execution over one logical program graph.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client submits program work to a controller. The controller builds a dataflow graph whose nodes are operations and whose edges are futures, then places runnable operations on accelerator islands.',
        'The data plane performs tensor compute and transfers tensors across links. The control plane tracks graph structure, placement, readiness, failures, and backpressure, so the controller coordinates compute without doing the matrix multiplication itself.',
        'Placement is the hard step. The runtime must account for accelerator memory, interconnect cost, parameter residency, activation size, hot experts, and joins on the critical path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a dependency argument. If the graph records every true data dependency, then any schedule that runs a node only after its input futures are ready produces the same dependency-respecting result as a sequential execution of that graph.',
        'Parallelism is safe because independence is explicit. Two branches can overlap only when neither consumes the other output, and the join restores order by waiting for the exact futures it needs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is control-plane work plus communication. If a graph has 10,000 operations, the controller must track readiness, queues, placement, retries, and traces for 10,000 units even if each tensor kernel runs elsewhere.',
        'When the number of devices doubles, useful throughput can rise only if dependencies expose enough parallel work and transfers do not dominate. A bad placement can turn a 20 ms compute step into a 120 ms path because tensors cross slow links before the join can run.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits multimodal models, sparse mixture-of-experts layers, pipeline-parallel training, multi-task training, and inference graphs that combine shared work with request-specific branches. The access pattern is irregular compute with explicit dependencies.',
        'It also fits research systems where model structure changes quickly. A shared runtime lets researchers express branches, joins, futures, and placement constraints without rebuilding distributed execution for every architecture.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the job is already a simple dense SPMD loop. The extra controller machinery can add scheduling overhead, trace volume, and operational surface without exposing new parallelism.',
        'It also fails when observability is weak. A future-based graph can stall because one expert is hot, one transfer sits on the critical path, or one island is fragmented, and the runtime must make that state visible enough to fix.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a request needs a text encoder that takes 40 ms, an image encoder that takes 70 ms only for image inputs, two expert groups that take 30 ms each, and a decoder join that takes 50 ms. A lockstep program may reserve all paths for every request and spend 190 ms of scheduled work even for text-only traffic.',
        'A Pathways-style graph schedules the 40 ms text path and the 70 ms image path only when their inputs exist. If text and image run together, the join waits 70 ms rather than 110 ms, then runs the 50 ms decoder, so critical-path latency is about 120 ms before transfer overhead instead of the sum of all branches.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Pathways: Asynchronous Distributed Dataflow for ML at https://arxiv.org/abs/2203.12533 and the MLSys paper PDF at https://proceedings.mlsys.org/paper_files/paper/2022/file/37385144cac01dff38247ab11c119e3c-Paper.pdf.',
        'Study TensorFlow Dataflow Case Study for graph execution, Ray Distributed Execution Case Study for futures, Borg Cluster Scheduler Case Study for resource control, Pipeline Parallelism and Tensor Parallelism for accelerator layouts, and Mixture of Experts for sparse routing.',
      ],
    },
  ],
};