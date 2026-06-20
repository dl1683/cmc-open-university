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
      heading: 'Why Ray exists',
      paragraphs: [
        'Ray is a distributed execution framework built for programs that do not fit cleanly into a fixed batch pipeline. The original OSDI paper framed the target as emerging AI applications: reinforcement learning, simulation, training, serving, and search workloads that create new work while they run. These applications mix short CPU tasks, long-lived stateful workers, GPU computation, large tensors, and feedback loops.',
        'A static system can be excellent when the work graph is known in advance. MapReduce works well for batch stages. Pregel works well for vertex-centric graph supersteps. A message queue works well for decoupled services. Ray targets a different shape: a Python program launches remote tasks and actors, receives futures, branches based on partial results, and keeps submitting more work. The execution graph is a live data structure, not a file written before the job starts.',
        {type:'callout', text:'Ray exposes dynamic work as object references and actors, giving the runtime a live dependency graph it can schedule without forcing the program into a fixed batch plan.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg', alt:'Directed acyclic graph with arrows showing dependencies between nodes.', caption:'Directed acyclic graph. Ray turns object references into a live dependency graph that schedules ready tasks as upstream objects finish. Source: Wikimedia Commons, David W., Public domain.'},
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The obvious approach is to glue together existing tools. Use multiprocessing on one machine, a queue for distributed tasks, object storage for large data, Kubernetes for placement, and custom retry logic around failures. That can work for a narrow application. Many teams ship useful systems that way.',
        'The wall appears when the application needs all of those pieces at once. A reinforcement-learning loop may keep simulator state alive in actors, send batches to GPU learners, score policies, and launch new rollouts based on the results. A hyperparameter search may spawn thousands of short trials but keep large datasets shared. A serving workflow may need placement constraints so model shards or replicas sit near the right resources. Hand-rolled queues do not naturally expose futures, object locality, resource labels, actor state, lineage, and autoscaling as one programming model.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to make dynamic distributed execution feel like ordinary function calls while keeping enough runtime structure for scheduling. A Ray remote function returns an object reference, commonly treated like a future. That reference can be passed to other remote calls before the value is ready. The dependency graph formed by these references tells the runtime which tasks are ready and which objects must be available first.',
        'Ray also makes stateful actors first-class. A task is a stateless remote call. An actor is a long-lived worker-bound object with methods and internal state. That distinction is central for AI workloads. Stateless tasks are good for parallel preprocessing or scoring. Actors are good for simulators, model replicas, parameter servers, environment workers, and services that benefit from warm state or local resources.',
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        'The main data structures are the task graph, object references, worker leases, actor handles, resource requirements, placement groups, object-store metadata, and control-plane metadata. A driver submits tasks. The scheduler places ready tasks on workers that satisfy CPU, GPU, memory, and custom resource constraints. Workers execute tasks and put large results in an object store. Downstream tasks receive object references rather than shipping large values through the scheduler.',
        'Separating control and data is the important systems move. The control plane tracks dependencies, task state, actor state, object locations, and scheduling decisions. The data plane moves large objects between workers and object stores. If large tensors flowed through scheduler messages, the scheduler would become the bottleneck. Object references let the runtime coordinate work with small metadata while keeping large arrays on the data path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Ray works when the runtime can see enough of the dependency structure to schedule around it. Object references reveal that task B depends on the output of task A. Resource annotations reveal that a task needs a GPU or a custom accelerator. Actor handles reveal that a method must run near the actor state. Placement groups reveal that a set of resources should be co-scheduled. These facts let the runtime make decisions that a plain queue cannot make safely.',
        'The correctness property is dependency preservation. A task should not run until its input objects are ready. An actor method should observe actor state in the order guaranteed by the actor execution model. A downstream task should receive the object version produced by the upstream task it references. Performance comes from exposing enough parallelism while preserving those ordering and dependency constraints.',
      ],
    },
    {
      heading: 'Cost behavior',
      paragraphs: [
        'Ray does not remove distributed-systems cost. It makes the cost programmable. Every task pays scheduling overhead. Tiny tasks can drown in that overhead. Every large object pays memory and network cost. Huge objects can spill, copy, or block downstream workers. Every stateful actor can become a hot spot if many calls serialize through one worker. Every GPU task can leave expensive hardware idle if input objects arrive late or batches are too small.',
        'When the workload scales, tail behavior matters more than the happy path. A few slow object transfers can hold many dependent tasks. A backlog of pending GPU tasks can make CPU preprocessing look successful while the cluster is actually bottlenecked. Autoscaling can add nodes after demand appears, but cold-start delay still exists. A good Ray design makes task granularity, object size, placement, and backpressure explicit.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Ray is useful when work is dynamic, resource-aware, stateful, and tied to large objects. Reinforcement learning is the classic example: environment actors generate experience, learners train on GPUs, evaluators score policies, and the driver chooses what to run next. Hyperparameter tuning has a similar shape because trial results create future search decisions. Simulation workloads often keep state alive across many calls.',
        'It also fits batch inference, model serving support code, data processing, distributed training orchestration, agent evaluation, and online experimentation systems where Python control logic matters. The common access pattern is not just parallel map. It is remote calls plus futures plus large shared objects plus stateful workers plus resource constraints. If those are all present, Ray gives the application a coherent execution substrate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Ray is the wrong tool when a simpler execution model already matches the job. A SQL engine is better for declarative relational queries. A streaming engine is better for event-time windows and durable streams. Kubernetes jobs may be enough for coarse batch tasks. A local multiprocessing pool may be enough for one-machine parallelism. Ray adds a runtime, scheduler, object store, failure model, and operational surface. Those costs should buy real flexibility.',
        'It can also fail when the workload is designed against the runtime. Too many tiny tasks create scheduler pressure. Oversized objects create memory and network pressure. Unbounded task submission creates backpressure problems. Poor actor placement creates hot spots. Unclear resource labels cause GPUs to sit idle or starve. Treating Ray like magic multiprocessing usually produces disappointing systems.',
      ],
    },
    {
      heading: 'Failure handling',
      paragraphs: [
        'Distributed execution means partial failure is normal. Workers crash. Objects can be lost. Nodes disappear. Tasks retry. Actors may need restart policies or checkpointed state. Lineage can help reconstruct lost objects when the producing task can be rerun, but lineage is not free and not always enough. A long-lived actor with unique in-memory state needs a different recovery plan than a stateless preprocessing task.',
        'Backpressure is the failure mode that looks like success until it is too late. The driver can submit tasks faster than the cluster can run them. Object stores can fill with results that downstream stages are not consuming. GPU queues can grow while CPU stages keep producing. A robust workload has explicit limits: maximum in-flight tasks, bounded object sizes, actor concurrency controls, and dashboards that show pending work by stage and resource.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Monitor pending tasks, runnable tasks, task runtime distribution, scheduler delay, object-store memory, object spill volume, object transfer size, actor mailbox depth, actor restart count, worker failure count, retry count, GPU utilization, CPU utilization, autoscaler decisions, and end-to-end critical path length. The useful question is not whether the cluster is busy. It is whether the bottlenecked resource is doing the right work.',
        'Debugging should follow references. If a task waits, ask which object reference or resource requirement blocks it. If an actor is hot, ask whether state can be sharded or calls can be batched. If object-store pressure is high, ask which objects are largest, longest-lived, and most copied. If GPU utilization is low, inspect upstream data readiness and placement.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources are the OSDI paper at https://www.usenix.org/system/files/osdi18-moritz.pdf, the arXiv version at https://arxiv.org/abs/1712.05889, the USENIX presentation page at https://www.usenix.org/conference/osdi18/presentation/moritz, and Ray Core documentation at https://docs.ray.io/en/latest/ray-core/walkthrough.html.',
        'Study futures and promises, DAG scheduling, actor models, object stores, backpressure, distributed tracing, placement scheduling, Borg and Omega schedulers, Pregel, MapReduce, parameter servers, reinforcement learning, hyperparameter search, and LLM serving autoscaling next. Ray is valuable because it sits at the intersection: algorithmic control flow becomes a distributed-systems scheduling problem.',
      ],
    },
  ],
};
