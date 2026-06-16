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
    explanation: 'Ray programs submit remote functions and get futures back. Dependencies among futures form a dynamic task graph, which is a better fit for AI workloads than a fixed batch pipeline.',
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
    explanation: 'The graph can change while it runs. Reinforcement learning, hyperparameter search, simulation, and model serving often create more work based on partial results. Ray makes that dynamism a first-class execution model.',
    invariant: 'Tasks consume object references and produce new object references.',
  };

  yield {
    state: architecture('Large objects move through an object store'),
    highlight: { active: ['object', 'worker1', 'worker2', 'worker3', 'e-w1-object', 'e-w2-object', 'e-w3-object'], found: ['scheduler'] },
    explanation: 'Instead of sending large tensors through the scheduler, workers put objects into a distributed object store and pass references. That is essential for ML workloads where intermediate arrays and model outputs are large.',
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
    explanation: 'The useful abstraction is not just "run this somewhere." Ray exposes tasks, actors, resource labels, and placement so applications can express the shape of distributed AI work.',
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
    explanation: 'The hard part is not launching tasks. It is keeping a dynamic workload stable when tasks fail, dependencies are large, queues grow, and GPU stages dominate tail latency.',
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
      heading: 'What it is',
      paragraphs: [
        'Ray is a distributed execution framework for emerging AI applications. It supports dynamic task graphs, futures, stateful actors, resource-aware scheduling, and a distributed object store. The design targets workloads such as reinforcement learning, hyperparameter search, simulation, model serving, and distributed training.',
        'The case study matters because AI workloads often do not look like static batch pipelines. They create tasks based on partial results, mix CPUs and GPUs, move large tensors, and keep long-lived state. Ray gives those patterns direct runtime support.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A driver submits remote functions and actors. The scheduler places tasks according to dependencies and resources. Workers execute tasks or actor methods. Large outputs go into a distributed object store and are referenced by object ids. Control metadata is maintained separately so the system can coordinate scheduling, object location, and failures.',
        'This architecture lets the application build a dynamic DAG at runtime. A reinforcement learning loop can run environment actors, train a policy on GPUs, score results, and launch new rollouts without forcing the workflow into fixed map and reduce stages.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Ray exposes real distributed-systems costs: object movement, scheduling overhead, task granularity, GPU utilization, actor placement, backpressure, retries, lineage reconstruction, and cluster autoscaling. Tiny tasks can drown in overhead. Huge objects can overwhelm memory and network. Stateful actors improve locality but create placement and recovery concerns.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ray is used for reinforcement learning, distributed training, batch inference, hyperparameter search, data processing, model serving, simulation, and agent workloads. It is a useful bridge between algorithmic AI topics and systems topics such as Borg scheduling, distributed tracing, backpressure, and object storage.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Ray is not just a faster multiprocessing library. It is a distributed runtime with scheduling, object storage, actors, and failure semantics. Another misconception is that dynamic task graphs remove the need for workload design. Task granularity, object sizes, placement, and backpressure still decide whether the system performs well.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: "Ray: A Distributed Framework for Emerging AI Applications" at https://www.usenix.org/system/files/osdi18-moritz.pdf, the arXiv version at https://arxiv.org/abs/1712.05889, and Ray documentation at https://docs.ray.io/en/latest/ray-core/walkthrough.html. Study Hyperparameter Search, Policy Gradients, Feature Store: Offline/Online Consistency, LLM Serving Autoscaling Warm Pool, Borg Cluster Scheduler Case Study, Pregel Graph Processing Case Study, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
