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
      heading: 'Why this exists',
      paragraphs: [
        `A datacenter is not useful just because it owns many machines. The hard problem is turning those machines into a shared computer where production services stay healthy, batch jobs use spare capacity, failures are handled quickly, and teams do not hand-place processes one host at a time.`,
        `Borg is Google's cluster management system for that problem. The Borg paper describes a system that admits, schedules, starts, restarts, and monitors jobs across cells of machines. Its educational value is that scheduling is not only bin packing. It is resource allocation under priority, quota, isolation, locality, health, and failure constraints.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is direct placement. A team picks machines, starts processes, writes scripts to restart them, and reserves extra capacity so production does not fight experiments. That works for a small fleet because the mental model fits in a few people's heads.`,
        `The wall appears when the fleet becomes heterogeneous and shared. One team over-reserves, another fills a rack with correlated replicas, a machine dies, a batch job starves a service, and no one can tell whether the cluster is wasting capacity or protecting reliability. Manual placement loses both efficiency and control.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Make desired work declarative and let a control plane continuously reconcile it with the actual cluster. Users submit jobs made of tasks. The system stores desired state, checks policy, chooses machines, starts tasks, watches health, and repairs drift when machines or tasks fail.`,
        `The scheduler is the policy point. It does not simply find any machine with enough CPU and memory. It considers constraints, priority, quota, locality, anti-affinity, machine health, and disruption cost. Good placement is a resource fit plus an operational decision.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the placement view, follow the job from user API to Borgmaster to scheduler to candidate machines. The scheduler edges represent scoring, not blind first-fit placement. A highlighted machine matters only if it satisfies the job's resource request and policy constraints.`,
        `In the packing frame, compare the service task and the batch task. The service wants stability, low latency, and protection from correlated failure. The batch task wants throughput and can often tolerate preemption. Borg's utilization gain comes from mixing them without pretending they have the same priority.`,
        `In the priority and failure view, removed tasks are not visual noise. They show preemption or loss. The important state change is that lower-priority work gives way under pressure, and failed work is rescheduled only if the application and policy allow restart.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A Borg job describes one or more tasks, their resource needs, constraints, priority, and runtime behavior. The Borgmaster stores cluster state and exposes the control surface. The scheduler chooses placements. Borglets on machines start tasks, monitor them, and report state back to the control plane.`,
        `Placement has two phases in the mental model. First, filter out machines that cannot legally run the task: not enough resources, wrong attributes, bad health, violated constraints, or quota limits. Second, score feasible machines according to policy: spread replicas, improve packing, keep data local, avoid hot spots, and reduce correlated failure risk.`,
        `Borg mixes long-running services with batch jobs. High-priority production tasks receive stronger protection. Lower-priority batch jobs can fill idle resources and be preempted when capacity is needed elsewhere. That is how the system improves utilization without making all work equally important.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The invariant is reconciliation toward declared intent under policy. If a task should be running and its machine dies, the control plane can mark the task lost and try to place it elsewhere. If a low-priority task consumes capacity needed by a high-priority service, preemption restores the priority rule. If replicas are too concentrated, placement policy can spread future work across failure domains.`,
        `This works because the system separates application intent from machine accident. Users declare what should run. The platform observes what is actually running. The scheduler and restart logic close the gap. The application still has responsibilities: idempotent startup, persistent state design, readiness checks, graceful shutdown, and backpressure.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a frontend service needs ten replicas across failure domains and a log-processing batch job needs thousands of CPU-hours. A simple bin-packer might place work wherever CPU and memory fit. Borg-style scheduling adds policy. Frontend replicas should spread across racks or machines, keep enough reserved resources, and restart quickly. Batch tasks can pack tightly into spare capacity and lose their slots when production needs them.`,
        `Now machine 1 fails. The platform can notice missing health signals, mark the affected tasks lost, and ask the scheduler for new placements. If the frontend handles restart cleanly, users see little disruption. If the service stores local-only state or has slow startup, the scheduler cannot save it. Borg makes failure handling a platform behavior, not an application correctness proof.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The scheduler balances utilization, reliability, fairness, locality, and disruption. Overpacking raises utilization and can cause interference. Underpacking protects latency and wastes machines. Preemption protects important work and creates churn for lower-priority jobs. Locality saves network or disk work and can concentrate risk.`,
        `The control plane also becomes critical infrastructure. It needs durable state, careful rollout discipline, observability, and simulation or analysis tools. A bad scheduler policy can move a problem from one host to the whole fleet.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `A Borg-style scheduler wins when many teams share a fleet and run mixed workloads: serving systems, batch analytics, ML training, cron jobs, canaries, and experiments. Shared scheduling lets the organization buy fewer idle machines while still protecting production work with priority, quota, isolation, and health rules.`,
        `The ideas show up in Kubernetes, Mesos, Nomad, and cloud orchestration because the underlying problem is common. Jobs and tasks describe work. Schedulers bind work to nodes. Health checks and restart policy repair drift. Priority and quota encode fairness under scarcity.`,
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        `Do not use a Borg-scale mental model for a tiny deployment that fits on one host or a simple managed platform. The overhead is real: declarative specs, control-plane operation, debugging placement, capacity modeling, and rollout policy.`,
        `It is also the wrong abstraction for application-level load distribution. A cluster scheduler chooses where processes run. A load balancer chooses where requests go. A queue decides when work is consumed. Mixing those responsibilities makes outages harder to reason about.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The common failure is treating utilization as the only goal. High CPU graphs can mean efficient sharing or widespread interference. Without isolation, priority, and backpressure, spare-capacity batch work can damage latency-sensitive services.`,
        `Another failure is restart optimism. Restarting a broken binary faster only creates a faster crash loop. Health checks, readiness signals, canaries, circuit breakers, and rollback policy decide whether restart is recovery or amplification.`,
        `A third failure is hidden coupling. If all replicas land in the same rack, depend on the same storage path, or start at the same time after a failure, the scheduler can create correlated outages while appearing to satisfy resource requests.`,
      ],
    },
    {
      heading: 'Study next and sources',
      paragraphs: [
        `Study Load Balancer next to separate process placement from request routing. Study Sharding & Partitioning for data placement, Bulkheads & Resource Isolation for blast-radius control, Circuit Breakers & Deadlines for failing dependencies, Load Shedding & Graceful Degradation for overload policy, and Backpressure & Flow Control for producer-consumer stability.`,
        `Primary source: Large-scale cluster management at Google with Borg at https://research.google.com/pubs/archive/43438.pdf. For the modern open-source descendant vocabulary, compare Kubernetes scheduling, node affinity, taints, tolerations, priority, preemption, and eviction in the official Kubernetes docs at https://kubernetes.io/docs/concepts/scheduling-eviction/.`,
      ],
    },
  ],
};
