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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the cluster as one shared resource pool. A cell is a group of machines managed together, a job is a user submission, and a task is one runnable piece of that job. The active placement step asks whether a task can run on a machine under resource, policy, priority, and failure-domain constraints.',
        'The safe inference rule is admission before placement. Quota decides whether a job is allowed to consume capacity in the cell. Priority and scheduling then decide where tasks run and what lower-priority work may be moved or preempted.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Borg exists because a datacenter is too expensive to operate as isolated team-owned servers. Some services need low-latency reliability, while batch jobs can use leftover capacity. A scheduler has to share machines without letting flexible work harm production work.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Google_data_center.jpg/960px-Google_data_center.jpg',
          alt: 'Google data center in The Dalles, Oregon, seen from outside with a Google sign in front',
          caption: 'A datacenter is a fixed-cost resource pool before it is a set of servers. Borg was built to turn that pool into a shared computer. Source: Wikimedia Commons, Lambtron, CC BY-SA 4.0.',
        },
        {
          type: 'callout',
          text: 'Borg is not mainly a clever queue. It is a way to convert unused production headroom into useful batch throughput without letting batch work harm production.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is static partitioning. Give each team a set of machines, let them deploy by hand or with scripts, and keep spare capacity for spikes. This works while the organization is small and workloads are predictable.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Wikimedia_Servers-0051_17.jpg/960px-Wikimedia_Servers-0051_17.jpg',
          alt: 'A row of densely packed server racks in a Wikimedia data center',
          caption: 'Rows of servers invite the wrong abstraction: one team, one rack, one static placement plan. Borg treats the row as a shared resource pool. Source: Wikimedia Commons, Helpameout, CC BY-SA 3.0.',
        },
        'A second approach is a simple queue: take the next task and place it on the first machine with enough free CPU and memory. That ignores quota, priority, locality, machine health, restart behavior, and correlated failures. It answers capacity but not production safety.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is fragmentation plus policy. A cluster can have enough total free CPU and memory while no single machine has the right shape for a task. A placement can also be technically possible but violate quota, put replicas in one failure domain, or steal capacity from a higher-priority service.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/MareNostrum_4_supercomputer_at_Barcelona_Supercomputing_Center_1_br.jpg',
          alt: 'The MareNostrum 4 supercomputer with rows of racks inside a glass enclosure',
          caption: 'Large computing installations make fragmentation visible: capacity is valuable only when work can be placed into the free shape that remains. Source: Wikimedia Commons, Gemmaribasmaspoch, CC BY-SA 4.0.',
        },
        {
          type: 'callout',
          text: 'A cluster scheduler does not answer "is there room?" It answers "is there room under the right policy, priority, quota, locality, health, and failure-domain constraints?"',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make scheduling a control loop over declared intent. Users describe jobs, resource needs, constraints, priorities, and replica counts. Borg continuously compares desired state with actual machine state and moves tasks toward the safest feasible placement.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Distributed-parallel.svg',
          alt: 'Diagram comparing distributed systems with per-node memory and parallel systems with shared memory',
          caption: 'Borg makes distributed machines feel closer to one managed computer, while preserving the fact that each machine has its own local resources and failure modes. Source: Wikimedia Commons, Miym, CC BY-SA 3.0 or GFDL.',
        },
        {
          type: 'callout',
          text: 'Quota and priority solve different problems. Quota decides whether a job may enter the cell. Priority decides what happens after admitted jobs compete for scarce resources.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A user submits a job with one or more tasks. Borg checks quota, then the scheduler chooses machines that satisfy resource requests, constraints, health, and policy. The Borgmaster records desired state, and local agents on machines start, stop, and report tasks.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/GanttChartAnatomy.svg/960px-GanttChartAnatomy.svg.png',
          alt: 'Gantt chart with task bars, dependencies, progress markers, and a timeline',
          caption: 'Scheduling is easiest to see as placement over time: tasks occupy resources, dependencies constrain when work can move, and progress changes future feasibility. Source: Wikimedia Commons, Garrybooker and Malyszkz, public domain.',
        },
        {
          type: 'callout',
          text: 'The equivalence-class trick turns "schedule every task from scratch" into "schedule each distinct task shape." That is the difference between a datacenter scheduler and a quadratic classroom toy.',
        },
        'Borg groups similar tasks into equivalence classes so it does not repeat identical feasibility checks for every task. If 5,000 tasks have the same resource shape and constraints, the scheduler can reason about the shape once and apply the result many times.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is desired-state reconciliation. The persistent master state says which jobs should exist, and machine agents report what is actually running. If a machine dies, the mismatch becomes visible and the scheduler can place replacement tasks elsewhere.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Datacenter.jpg/960px-Datacenter.jpg',
          alt: 'Glass-fronted server racks in a data center aisle',
          caption: 'Every Borgmaster decision eventually becomes local machine work: start this task, stop that task, update resource controls, report state. Source: Wikimedia Commons, Wilweterings, public domain.',
        },
        'Priority and preemption make scarcity explicit. If a high-priority production task needs resources, lower-priority batch work can be evicted or delayed. The system is correct when admitted work is placed only on machines that satisfy constraints and when higher-priority work has a defined path to capacity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Scheduling cost grows with machines, tasks, constraints, and churn. A naive scheduler that compares 100,000 pending tasks against 10,000 machines has up to one billion feasibility checks. Borg-style equivalence classes, caching, and incremental updates reduce repeated work.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Datacenter-telecom_edit2.jpg',
          alt: 'Telecommunications equipment with yellow cabling in data center racks',
          caption: 'The network, power, rack, and cabling layout are part of the scheduling problem because correlated failure domains are physical. Source: Wikimedia Commons, Gregory Maxwell with edit by mixpix, GFDL 1.2.',
        },
        'The behavioral cost is preemption and coordination. A low-priority task may lose work if it is not checkpointed, and a bad constraint can make a job unschedulable even when the cluster has idle capacity. Resource requests are part of the program contract.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Borg-style scheduling fits large multi-tenant clusters that run services, batch jobs, storage systems, data processing, and maintenance work together. The access pattern is continuous submission, placement, monitoring, preemption, and repair. Kubernetes inherited many ideas from this lineage, although with a different public API and ecosystem.',
        'The model is valuable when utilization matters. Instead of reserving machines for each team, the cluster can run latency-sensitive services with headroom and backfill unused resources with batch work. The scheduler turns spare capacity into throughput while preserving policy boundaries.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'callout',
          text: 'Borg can restart a task. It cannot make an unsafe task safe. Distributed application correctness still requires replication, durable state, readiness, idempotent startup, and backpressure.',
        },
        'A scheduler cannot repair bad application semantics. If a task loses data on restart, ignores shutdown, or cannot tolerate duplicate startup, rescheduling only makes the failure move. The application must be designed for restart and partial failure.',
        'It also fails when declared resources are lies. If jobs request too little memory, machines suffer pressure and evictions. If jobs request too much, fragmentation rises and utilization falls. The scheduler can optimize the declared problem, not the hidden one.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A cell has 1,000 machines, each with 32 CPU units and 128 GB memory. A production service runs 2,000 tasks requesting 2 CPU and 4 GB each, using 4,000 CPU and 8 TB memory. The cluster still has large aggregate headroom, but it is spread unevenly across machines.',
        'A batch job submits 10,000 tasks, each requesting 1 CPU and 2 GB. Quota admits only 6,000 of them. The scheduler groups them into one equivalence class, finds machines with the right free shape, and places as many as possible without violating production priority or failure-domain constraints.',
        'Later a production rollout needs 500 more tasks. The scheduler preempts enough low-priority batch work to free 1,000 CPU and 2 TB memory. Batch throughput drops, but production gets capacity without a human moving machines between teams.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Google Borg paper, Kubernetes scheduler documentation, Omega scheduler work, and cluster-management papers that discuss utilization and preemption. Read them with the distinction between quota, priority, and placement constraints in mind.',
        'Study next by role. For scheduling theory, study bin packing and priority queues. For distributed systems, study desired-state reconciliation and leases. For operations, study resource requests, autoscaling, admission control, and failure-domain-aware placement.',
      ],
    },
  ],
};
