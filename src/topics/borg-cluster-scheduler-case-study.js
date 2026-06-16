// Borg case study: cluster management as a scheduling, isolation, failure, and
// resource-efficiency problem across services and batch jobs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'borg-cluster-scheduler-case-study',
  title: 'Borg Cluster Scheduler Case Study',
  category: 'Papers',
  summary: 'Google Borg as the datacenter operating-system lesson: jobs, tasks, cells, constraints, priorities, quotas, and failure handling.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['placement and packing', 'priority and failure'], defaultValue: 'placement and packing' },
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

function cluster(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user/API', x: 0.7, y: 4.0, note: 'submit job' },
      { id: 'borgmaster', label: 'Borgmaster', x: 2.6, y: 4.0, note: 'control plane' },
      { id: 'sched', label: 'scheduler', x: 4.5, y: 4.0, note: 'placement' },
      { id: 'm1', label: 'machine 1', x: 6.8, y: 2.0, note: 'CPU 70%, RAM 50%' },
      { id: 'm2', label: 'machine 2', x: 6.8, y: 4.0, note: 'CPU 35%, RAM 80%' },
      { id: 'm3', label: 'machine 3', x: 6.8, y: 6.0, note: 'CPU 10%, RAM 20%' },
      { id: 'taskA', label: 'service task', x: 9.0, y: 2.0, note: 'high priority' },
      { id: 'taskB', label: 'batch task', x: 9.0, y: 6.0, note: 'low priority' },
    ],
    edges: [
      { id: 'e-user-master', from: 'user', to: 'borgmaster', weight: 'job spec' },
      { id: 'e-master-sched', from: 'borgmaster', to: 'sched', weight: 'pending tasks' },
      { id: 'e-sched-m1', from: 'sched', to: 'm1', weight: 'score' },
      { id: 'e-sched-m2', from: 'sched', to: 'm2', weight: 'score' },
      { id: 'e-sched-m3', from: 'sched', to: 'm3', weight: 'score' },
      { id: 'e-m1-taskA', from: 'm1', to: 'taskA', weight: 'run' },
      { id: 'e-m3-taskB', from: 'm3', to: 'taskB', weight: 'run' },
    ],
  }, { title });
}

function* placementAndPacking() {
  yield {
    state: cluster('Borg schedules jobs into a cell of machines'),
    highlight: { active: ['user', 'borgmaster', 'sched'], compare: ['m1', 'm2', 'm3'] },
    explanation: 'Borg accepts jobs, breaks them into tasks, and places those tasks on machines in a cell. It hides resource management, restarts, machine failure, and placement details from users. This is the datacenter as a computer: the scheduler is part of the operating system.',
  };

  yield {
    state: labelMatrix(
      'Placement is a constraint and scoring problem',
      [
        { id: 'svc', label: 'frontend service' },
        { id: 'batch', label: 'log batch job' },
        { id: 'ml', label: 'training worker' },
        { id: 'stateful', label: 'stateful shard' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'avoid', label: 'avoid' },
        { id: 'score', label: 'preferred' },
      ],
      [
        ['low latency', 'same rack copies', 'spread out'],
        ['throughput', 'preempting prod', 'pack tightly'],
        ['GPU/CPU', 'network hotspot', 'near data'],
        ['disk locality', 'correlated failure', 'stable host'],
      ],
    ),
    highlight: { active: ['svc:score', 'batch:score'], compare: ['stateful:avoid'] },
    explanation: 'A scheduler is not just first-fit bin packing. It considers constraints, priorities, quotas, machine health, locality, anti-affinity, and failure domains. The same tension appears in Load Balancer and Sharding & Partitioning, but Borg applies it to processes over machines.',
    invariant: 'Good placement is a policy decision plus a resource fit.',
  };

  yield {
    state: cluster('Packing batch work around services improves utilization'),
    highlight: { found: ['m1', 'm3', 'taskA', 'taskB'], active: ['e-m3-taskB'], compare: ['m2'] },
    explanation: 'Borg mixes long-running services with batch jobs to raise utilization. Batch work can fill idle resources, but it must be lower priority and preemptible so production services remain healthy. This is Bulkheads & Resource Isolation at cluster scale.',
  };
}

function* priorityAndFailure() {
  yield {
    state: labelMatrix(
      'Priority decides what survives resource pressure',
      [
        { id: 'prod', label: 'prod service' },
        { id: 'canary', label: 'canary' },
        { id: 'batch', label: 'batch analytics' },
        { id: 'best', label: 'best-effort job' },
      ],
      [
        { id: 'priority', label: 'priority' },
        { id: 'resource', label: 'resource promise' },
        { id: 'pressure', label: 'under pressure' },
      ],
      [
        ['high', 'reserved quota', 'keep running'],
        ['medium', 'bounded', 'maybe shrink'],
        ['low', 'opportunistic', 'preempt'],
        ['lowest', 'spare capacity', 'evict first'],
      ],
    ),
    highlight: { found: ['prod:pressure'], removed: ['batch:pressure', 'best:pressure'] },
    explanation: 'Borg uses priorities and quotas to let different workloads share one cluster. When capacity is tight, lower-priority tasks can be preempted. Without this, batch jobs and experiments would either starve production or leave expensive machines idle.',
  };

  yield {
    state: cluster('Machine failure triggers restart and reschedule'),
    highlight: { removed: ['m1', 'taskA', 'e-m1-taskA'], active: ['borgmaster', 'sched', 'm2', 'm3'], found: ['e-sched-m2', 'e-sched-m3'] },
    explanation: 'Machines fail. Borg notices missing health signals, marks tasks lost, and restarts them elsewhere if policy allows. The scheduler turns failure handling into a platform behavior. Users still need readiness checks, idempotent startup, and sane dependencies.',
    invariant: 'The platform can restart tasks; the application must tolerate restart.',
  };

  yield {
    state: labelMatrix(
      'Borg ideas that became mainstream',
      [
        { id: 'jobs', label: 'jobs and tasks' },
        { id: 'constraints', label: 'constraints' },
        { id: 'health', label: 'health checks' },
        { id: 'quota', label: 'quota and priority' },
        { id: 'isolation', label: 'containers/isolation' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'site', label: 'study link' },
      ],
      [
        ['declarative desired work', 'Message Queues'],
        ['scheduler policy', 'Load Balancer'],
        ['restart loops', 'Circuit Breakers & Deadlines'],
        ['fairness under scarcity', 'Load Shedding & Graceful Degradation'],
        ['shared machines safely', 'Bulkheads & Resource Isolation'],
      ],
    ),
    highlight: { active: ['quota:lesson', 'isolation:lesson'], found: ['health:site'] },
    explanation: 'Kubernetes did not appear from nowhere. Borg showed the shape of a mature cluster manager: declarative jobs, health, restart, quotas, placement constraints, priority, and operational feedback loops.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'placement and packing') yield* placementAndPacking();
  else if (view === 'priority and failure') yield* priorityAndFailure();
  else throw new InputError('Pick a Borg view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Borg is Google\'s cluster management system. It admits, schedules, starts, restarts, and monitors jobs across large cells of machines. It runs both long-lived services and batch jobs, which lets Google share infrastructure while preserving production reliability.',
        'The case study matters because cluster scheduling is where algorithms become operations. Bin packing, priorities, quotas, health checks, failure handling, isolation, and policy all meet in one system.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Users submit jobs made of tasks. The control plane stores job state and the scheduler picks machines for tasks based on resource requests, constraints, priorities, locality, and current machine state. Agents on machines start and monitor tasks, while the control plane restarts or reschedules failed tasks.',
        'Borg mixes services and batch work. High-priority production tasks get stronger guarantees. Lower-priority batch tasks can use spare capacity and be preempted when needed. This raises utilization without treating all work as equally urgent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The scheduler must balance utilization, reliability, fairness, locality, and disruption. Overpacking causes interference. Underpacking wastes machines. Preemption improves availability for important work but creates churn for low-priority jobs. Health checks and restart policy can save a service or amplify a bad rollout.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Borg influenced Kubernetes, Mesos, Nomad, and modern cloud orchestration. Its ideas appear anywhere teams run services and batch workloads on shared fleets: jobs, tasks, desired state, health checks, resource isolation, placement rules, quotas, and priorities.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A cluster scheduler cannot make unreliable applications reliable by itself. It can restart tasks and isolate resources, but the service still needs idempotent startup, persistent state design, readiness signals, graceful shutdown, and backpressure. Another misconception is that high utilization is automatically good; without isolation and priority, utilization becomes interference.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "Large-scale cluster management at Google with Borg" at https://research.google.com/pubs/archive/43438.pdf. Study Load Balancer, Sharding & Partitioning, Bulkheads & Resource Isolation, Circuit Breakers & Deadlines, Load Shedding & Graceful Degradation, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
