// Ray case study: a distributed execution substrate for dynamic task graphs,
// actors, futures, object stores, and AI workloads.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ray-distributed-execution-case-study',
  title: 'Ray Distributed Execution Case Study',
  category: 'Papers',
  summary: 'Ray as the AI-systems lesson: dynamic task graphs, actors, futures, object stores, and heterogeneous scheduling.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['task graph and object store', 'actors and scheduling'], defaultValue: 'task graph and object store' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'driver', label: 'driver', x: 0.7, y: 3.8, note: 'Python program' },
      { id: 'scheduler', label: 'scheduler', x: 2.8, y: 3.8, note: 'tasks + resources' },
      { id: 'worker1', label: 'worker 1', x: 5.0, y: 1.6, note: 'CPU' },
      { id: 'worker2', label: 'worker 2', x: 5.0, y: 3.8, note: 'GPU' },
      { id: 'worker3', label: 'worker 3', x: 5.0, y: 6.0, note: 'CPU' },
      { id: 'object', label: 'object store', x: 7.3, y: 3.8, note: 'shared objects' },
      { id: 'gcs', label: 'global control', x: 9.0, y: 3.8, note: 'metadata' },
    ],
    edges: [
      { id: 'e-driver-scheduler', from: 'driver', to: 'scheduler', weight: 'submit tasks' },
      { id: 'e-scheduler-w1', from: 'scheduler', to: 'worker1', weight: 'task' },
      { id: 'e-scheduler-w2', from: 'scheduler', to: 'worker2', weight: 'GPU task' },
      { id: 'e-scheduler-w3', from: 'scheduler', to: 'worker3', weight: 'task' },
      { id: 'e-w1-object', from: 'worker1', to: 'object', weight: 'put/get' },
      { id: 'e-w2-object', from: 'worker2', to: 'object', weight: 'put/get' },
      { id: 'e-w3-object', from: 'worker3', to: 'object', weight: 'put/get' },
      { id: 'e-gcs-scheduler', from: 'gcs', to: 'scheduler', weight: 'metadata' },
    ],
  }, { title });
}

function* taskGraphAndObjectStore() {
  yield {
    state: architecture('Ray turns futures into a distributed task graph'),
    highlight: { active: ['driver', 'scheduler', 'worker1', 'worker2', 'worker3', 'e-driver-scheduler'], compare: ['object'] },
    explanation: 'Ray turns remote calls into futures. Dependencies among those futures form a task graph that can grow while the program runs, which fits AI workloads better than a fixed batch pipeline.',
  };

  yield {
    state: labelMatrix(
      'A small dynamic task graph',
      [
        { id: 'load', label: 'load batch' },
        { id: 'prep', label: 'preprocess' },
        { id: 'infer', label: 'GPU inference' },
        { id: 'score', label: 'score metrics' },
        { id: 'select', label: 'select next jobs' },
      ],
      [
        { id: 'inputs', label: 'inputs' },
        { id: 'resource', label: 'resource' },
        { id: 'output', label: 'future/object' },
      ],
      [
        ['dataset shard', 'CPU', 'obj A'],
        ['obj A', 'CPU', 'obj B'],
        ['obj B', 'GPU', 'obj C'],
        ['obj C', 'CPU', 'obj D'],
        ['obj D', 'driver logic', 'new tasks'],
      ],
    ),
    highlight: { active: ['load:output', 'prep:inputs', 'infer:inputs', 'score:inputs'], found: ['select:output'] },
    explanation: 'The key row is "select next jobs." Partial results can create new tasks, so the graph is not fully known at launch time. Reinforcement learning, tuning, simulation, and serving often have this shape.',
    invariant: 'Tasks consume object references and produce new object references.',
  };

  yield {
    state: architecture('Large objects move through an object store'),
    highlight: { active: ['object', 'worker1', 'worker2', 'worker3', 'e-w1-object', 'e-w2-object', 'e-w3-object'], found: ['scheduler'] },
    explanation: 'The object store keeps big tensors off the scheduler path. Workers pass references through control metadata and move large arrays through the data plane.',
  };

  yield {
    state: labelMatrix(
      'Ray compared with adjacent execution models',
      [
        { id: 'mapreduce', label: 'MapReduce' },
        { id: 'pregel', label: 'Pregel' },
        { id: 'ray', label: 'Ray' },
        { id: 'queue', label: 'message queue' },
      ],
      [
        { id: 'shape', label: 'program shape' },
        { id: 'best', label: 'best at' },
      ],
      [
        ['static batch stages', 'ETL and shuffle'],
        ['vertex supersteps', 'iterative graph algorithms'],
        ['dynamic task/actor graph', 'AI applications'],
        ['decoupled events', 'service integration'],
      ],
    ),
    highlight: { found: ['ray:shape', 'ray:best'], compare: ['mapreduce:shape', 'pregel:shape'] },
    explanation: 'Ray fills a different niche from MapReduce or Pregel. It is built for programs whose execution graph is dynamic, resource-hungry, and mixed across CPUs, GPUs, actors, and shared objects.',
  };
}

function* actorsAndScheduling() {
  yield {
    state: architecture('Actors keep mutable state near workers'),
    highlight: { active: ['driver', 'scheduler', 'worker2', 'object', 'e-scheduler-w2'], compare: ['gcs'] },
    explanation: 'Ray supports both stateless tasks and stateful actors. An actor is a worker-bound object that preserves state across method calls, which is useful for simulators, model replicas, parameter servers, and environment workers.',
  };

  yield {
    state: labelMatrix(
      'Tasks versus actors',
      [
        { id: 'task', label: 'remote task' },
        { id: 'actor', label: 'actor method' },
        { id: 'placement', label: 'placement group' },
        { id: 'autoscale', label: 'autoscaler' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'resource', label: 'resource view' },
        { id: 'use', label: 'use' },
      ],
      [
        ['stateless', 'CPU/GPU slots', 'parallel function calls'],
        ['stateful', 'pinned worker', 'models and simulators'],
        ['co-scheduled bundles', 'gang resources', 'distributed training'],
        ['cluster size changes', 'pending demand', 'elastic workloads'],
      ],
    ),
    highlight: { active: ['task:use', 'actor:use'], found: ['placement:resource', 'autoscale:resource'] },
    explanation: 'The useful abstraction is not merely "run this somewhere." Tasks, actors, placement groups, resource labels, and autoscaling let the program describe CPU, GPU, state, and colocation needs.',
  };

  yield {
    state: labelMatrix(
      'Failure and backpressure concerns',
      [
        { id: 'worker', label: 'worker crash' },
        { id: 'object', label: 'lost object' },
        { id: 'queue', label: 'task backlog' },
        { id: 'gpu', label: 'GPU bottleneck' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'system_response', label: 'system response' },
      ],
      [
        ['task failed', 'reconstruct or retry'],
        ['dependency missing', 'lineage/object recovery'],
        ['pending tasks grow', 'schedule/autoscale/backpressure'],
        ['slow expensive stage', 'placement and batching'],
      ],
    ),
    highlight: { active: ['queue:symptom', 'gpu:symptom'], found: ['worker:system_response', 'object:system_response'] },
    explanation: 'The hard part is stability, not launch. Dynamic workloads fail when dependencies are huge, queues grow without backpressure, objects disappear, or one GPU stage dominates the tail.',
  };

  yield {
    state: architecture('Ray connects algorithms to cluster scheduling'),
    highlight: { found: ['scheduler', 'worker1', 'worker2', 'worker3'], active: ['driver'], compare: ['gcs'] },
    explanation: 'Ray is where algorithmic topics meet systems topics: Hyperparameter Search, Policy Gradients, Feature Store, Distributed Tracing, Backpressure, and Borg-style scheduling all show up in one execution substrate.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'task graph and object store') yield* taskGraphAndObjectStore();
  else if (view === 'actors and scheduling') yield* actorsAndScheduling();
  else throw new InputError('Pick a Ray view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each object reference as a future, which is a handle for a value that may not exist yet. A downstream task can name that handle before the upstream task has finished.',
        'The scheduler view is a dependency graph plus resources. A task becomes runnable only when its input objects are ready and a worker with the required CPU, GPU, memory, or custom resource is available.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Ray is a distributed execution framework for programs whose work graph changes while they run. Reinforcement learning, simulation, hyperparameter search, training support, and serving workflows often create new tasks based on partial results.',
        'Static batch systems are strong when the plan is known in advance. Ray exists for Python programs that launch remote work, pass futures around, keep stateful workers alive, and make new scheduling decisions at runtime.',
        {type:'callout', text:'Ray exposes dynamic work as object references and actors, giving the runtime a live dependency graph it can schedule without forcing the program into a fixed batch plan.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg', alt:'Directed acyclic graph with arrows showing dependencies between nodes.', caption:'Directed acyclic graph. Ray turns object references into a live dependency graph that schedules ready tasks as upstream objects finish. Source: Wikimedia Commons, David W., Public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to glue together multiprocessing, queues, object storage, Kubernetes jobs, and custom retry logic. That can work for a narrow pipeline.',
        'It becomes difficult when the same application needs futures, object locality, resource labels, actor state, retries, autoscaling, and dependency-aware scheduling at once. The glue code becomes the distributed runtime.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is dynamic dependency management. A plain queue can hold tasks, but it does not naturally know that task C should wait for object A, run near object B, and use one GPU.',
        'Stateful workers add another wall. A simulator, model replica, or parameter server needs warm state and ordered method execution, not just stateless function calls.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Ray makes remote work look like function calls while exposing enough structure for the runtime to schedule it. Remote functions return object references, and those references form a live dependency graph.',
        'Ray also separates stateless tasks from actors. Tasks are good for parallel computation, while actors are long-lived workers with state, resources, and method calls.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A driver submits remote tasks and actor calls. The control plane tracks task state, object references, actor handles, resource requirements, placement constraints, retries, and object locations.',
        'Large results go through the object store and worker data path instead of through scheduler messages. That keeps the scheduler focused on metadata while tensors, batches, and arrays move on the data plane.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness property is dependency preservation. A task should not run until its input objects exist, and an actor method should observe actor state in the order guaranteed by that actor.',
        'Performance comes from exposing parallelism without violating those constraints. The runtime can run ready independent tasks while blocked tasks wait on their references or resources.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every Ray task pays scheduling overhead. If a task does 200 microseconds of useful work but scheduling and object bookkeeping cost 1 millisecond, the distributed version is slower than local batching.',
        'Object size changes behavior too. Ten thousand 1 KB objects stress metadata and scheduling, while ten 1 GB objects stress memory, spilling, network transfer, and downstream backpressure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ray fits reinforcement learning, simulation, hyperparameter tuning, batch inference, model-serving support code, distributed training orchestration, and agent evaluation. The common shape is remote calls plus futures plus large objects plus stateful workers plus resource constraints.',
        'It is useful when Python control flow is part of the algorithm. The driver can branch based on completed trials, launch more rollouts, reschedule failed work, or keep actors warm for repeated calls.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Ray is the wrong tool when a simpler execution model matches the job. SQL engines, streaming engines, Kubernetes jobs, and local multiprocessing can be better when the workload is declarative, durable-stream oriented, coarse-grained, or single-machine.',
        'It also fails when task granularity is wrong. Too many tiny tasks create scheduler pressure, oversized objects create memory pressure, and unbounded submission creates backpressure problems.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A tuning job launches 200 trials, each using 2 CPUs for 30 seconds and producing a 20 MB result. On a cluster with 40 CPUs, at most 20 trials run at once, so the compute floor is about 10 waves or 300 seconds before scheduling and data movement.',
        'If each trial instead takes 200 ms, the same 200 trials have only 40 seconds of total CPU work. A 1 ms scheduling cost per task adds 200 ms of pure scheduling overhead, and object-store pressure can dominate if every trial writes many small intermediate objects.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Ray OSDI paper, the arXiv version, the USENIX presentation, and Ray Core documentation. These define the programming model around tasks, actors, object references, and scheduling.',
        'Study futures and promises, DAG scheduling, actor models, object stores, backpressure, distributed tracing, placement scheduling, MapReduce, Pregel, parameter servers, reinforcement learning, and autoscaling next.',
      ],
    },
  ],
};
