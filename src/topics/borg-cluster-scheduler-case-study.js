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
        'The animation has two views. The placement view follows work from a user request to the Borgmaster, then to the scheduler, then to candidate machines. The priority view shows what happens when scarcity or failure forces the system to choose which tasks survive.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the current decision point: admission, feasibility checking, scoring, restart, or preemption.',
            'Compare markers are not decoration. They show that the scheduler is choosing among machines with different remaining CPU, memory, locality, health, and failure-domain properties.',
            'Removed markers mean a real operational event: a task was evicted, preempted, failed, killed, or lost. Borg can restart tasks, but the application must be written so restart is safe.',
          ],
        },
        'At each frame, ask one question: what policy rule made this placement legal. If the answer is only "there was enough CPU", the important part of Borg has been missed.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Borg exists because a datacenter is a capital asset before it is a software platform. The expensive thing is not one process. It is the building, power, cooling, network fabric, racks, machines, disks, flash, operational staff, and the idle headroom kept for rare traffic spikes. A scheduler is the mechanism that decides whether that capital works or sits idle.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Google_data_center.jpg/960px-Google_data_center.jpg',
          alt: 'Google data center in The Dalles, Oregon, seen from outside with a Google sign in front',
          caption: 'A datacenter is a fixed-cost resource pool before it is a set of servers. Borg was built to turn that pool into a shared computer. Source: Wikimedia Commons, Lambtron, CC BY-SA 4.0.',
        },
        'The 2015 Borg paper gives the economic shape of the problem. A median Borg cell had about 10,000 machines after excluding test cells, and some cells were much larger. The workload mixed long-running services with batch jobs. In a representative cell, production jobs were allocated about 70% of CPU but used about 60%; they were allocated about 55% of memory but used about 85%. Those gaps are not trivia. They are the money problem.',
        {
          type: 'callout',
          text: 'Borg is not mainly a clever queue. It is a way to convert unused production headroom into useful batch throughput without letting batch work harm production.',
        },
        'Google could have separated production services and batch jobs into different clusters. The paper reports that this would have needed 20-30% more machines in the median cell. It also reports that 98% of machines in shared Borg cells, and 83% across all machines managed by Borg, ran both production and non-production tasks at the same time. That is the first-principles reason Borg needed priorities, quota, isolation, preemption, and scheduling policy: sharing saves machines, but only if the platform can say who yields under pressure.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is static ownership. Give teams machines, let them start processes, and ask them to keep enough spare capacity for peak traffic and failures. For a small fleet, this is reasonable. Ownership is clear, debugging is local, and a human can remember which process runs where.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Wikimedia_Servers-0051_17.jpg/960px-Wikimedia_Servers-0051_17.jpg',
          alt: 'A row of densely packed server racks in a Wikimedia data center',
          caption: 'Rows of servers invite the wrong abstraction: one team, one rack, one static placement plan. Borg treats the row as a shared resource pool. Source: Wikimedia Commons, Helpameout, CC BY-SA 3.0.',
        },
        'The next obvious approach is a simple batch scheduler. Put jobs in a queue, wait for free machines, and launch them when enough resources are available. This works for homogeneous scientific jobs where the goal is often throughput or turnaround time. It is not enough for Google, where the same cell must run user-facing services, MapReduce-style batch jobs, storage systems, monitoring jobs, canaries, and experiments.',
        'The third obvious approach is fixed-size virtual machines or slots. That simplifies scheduling because every request is rounded into known shapes. Borg rejected that fit. The paper says Borg users request CPU in milli-cores and memory or disk in bytes, and that rounding production requests up to power-of-two buckets would require 30-50% more resources in the median case. The easy abstraction wastes the expensive resource.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Manual placement fails because every local decision hides a global cost. A team that reserves too much memory protects itself but strands memory for everyone else. A team that packs replicas into one rack saves space but creates a correlated failure. A batch user that grabs idle CPU improves utilization until a production spike arrives. A one-host restart script works until the host, rack, power domain, or package cache becomes the bottleneck.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/MareNostrum_4_supercomputer_at_Barcelona_Supercomputing_Center_1_br.jpg',
          alt: 'The MareNostrum 4 supercomputer with rows of racks inside a glass enclosure',
          caption: 'Large computing installations make fragmentation visible: capacity is valuable only when work can be placed into the free shape that remains. Source: Wikimedia Commons, Gemmaribasmaspoch, CC BY-SA 4.0.',
        },
        'The wall is multidimensional fragmentation. A machine with free CPU but no memory is not free. A machine with memory but the wrong processor, OS version, package cache, external IP property, disk bandwidth, or failure-domain position may be useless for a specific task. A scheduler that sees only one resource dimension will strand the others.',
        {
          type: 'callout',
          text: 'A cluster scheduler does not answer "is there room?" It answers "is there room under the right policy, priority, quota, locality, health, and failure-domain constraints?"',
        },
        'The paper measures this as cell compaction: remove machines, repack the workload from scratch, and ask how small the cell could be while still fitting the work. Better policy requires fewer machines for the same workload. This is why average utilization is a weak metric. A cluster can look busy while the wrong resource shapes remain stranded.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the datacenter as a computer and make process placement a continuous control-plane problem. Users declare desired work. Borg stores that intent, admits it if quota allows, schedules tasks onto machines, starts them, monitors them, restarts them, and repairs drift when machines fail or policy changes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Distributed-parallel.svg',
          alt: 'Diagram comparing distributed systems with per-node memory and parallel systems with shared memory',
          caption: 'Borg makes distributed machines feel closer to one managed computer, while preserving the fact that each machine has its own local resources and failure modes. Source: Wikimedia Commons, Miym, CC BY-SA 3.0 or GFDL.',
        },
        'The deep move is separation of intent from placement. A job says what should run. A task is one replica or unit of that job. A cell is the pool of machines managed as one scheduling unit. The scheduler binds pending tasks to machines. Borglets on each machine enforce the local decision. If reality drifts from intent, Borg tries to reconcile it.',
        'That control loop only works because Borg admits that work has rank. Monitoring and production are higher-priority bands. Batch and best-effort work are lower-priority bands. Quota decides whether work may enter the scheduling system. Priority decides what happens when admitted work competes for actual machine resources.',
      ],
    },
    {
      heading: 'Borg vocabulary',
      paragraphs: [
        {
          type: 'table',
          headers: ['Term', 'Plain meaning', 'Why it matters'],
          rows: [
            ['Cell', 'One managed pool of machines, often about 10,000 machines in the median non-test case reported by the paper', 'The scheduler gets the pooling benefit only inside the cell boundary'],
            ['Job', 'A named unit submitted by a user, usually made of one or more similar tasks', 'Job configuration is declarative desired state, not a shell script for one host'],
            ['Task', 'One running replica or worker, mapped to Linux processes in a container on a machine', 'Scheduling operates mainly on tasks because each task consumes local resources'],
            ['Alloc', 'A reserved set of resources on one machine where one or more tasks can run', 'Allocs keep resources across restarts and let related helper tasks share a local resource envelope'],
            ['Alloc set', 'A group of allocs across machines', 'It lets future jobs run inside already-reserved resource envelopes'],
            ['Priority band', 'Monitoring, production, batch, and best effort in decreasing priority order', 'The band determines who can preempt whom under scarcity'],
            ['Quota', 'A vector of CPU, RAM, disk, and other resources at a priority for a time period, often months', 'Quota is admission control; insufficient quota rejects the job before scheduling'],
          ],
        },
        'Allocs are easy to miss and important. An alloc is not just a task. It is a resource envelope on a specific machine. It can hold resources between task restarts, reserve room for future work, or group related tasks such as a web server and a local logsaver. If the alloc moves, its tasks move with it.',
        {
          type: 'callout',
          text: 'Quota and priority solve different problems. Quota decides whether a job may enter the cell. Priority decides what happens after admitted jobs compete for scarce resources.',
        },
      ],
    },
    {
      heading: 'How scheduling works',
      paragraphs: [
        'When a job is submitted, the Borgmaster records it persistently and adds its tasks to the pending queue. The scheduler scans pending tasks from high to low priority, with round-robin fairness within a priority so one large job does not block everyone behind it.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/GanttChartAnatomy.svg/960px-GanttChartAnatomy.svg.png',
          alt: 'Gantt chart with task bars, dependencies, progress markers, and a timeline',
          caption: 'Scheduling is easiest to see as placement over time: tasks occupy resources, dependencies constrain when work can move, and progress changes future feasibility. Source: Wikimedia Commons, Garrybooker and Malyszkz, public domain.',
        },
        'Borg scheduling has two major phases. Feasibility checking filters machines that cannot legally run the task: wrong attributes, insufficient available resources, violated hard constraints, unhealthy machine state, quota effects, or resources held by tasks that cannot be evicted. Scoring then chooses among feasible machines.',
        'The score is policy, not pure bin packing. The paper lists user preferences, minimizing the number and priority of preempted tasks, preferring machines that already have the task packages, spreading tasks across power and failure domains, and packing high- and low-priority tasks together so high-priority tasks can expand during spikes. If the chosen machine needs room, Borg preempts lower-priority tasks from lowest to highest priority and puts the evicted tasks back into the pending queue.',
        {
          type: 'table',
          headers: ['Placement force', 'What it wants', 'What it can break'],
          rows: [
            ['Worst fit', 'Spread load and leave headroom everywhere', 'Fragments the cell and makes large tasks harder to place'],
            ['Best fit', 'Pack machines tightly and leave some machines empty', 'Punishes estimation errors and bursty workloads'],
            ['Borg hybrid scoring', 'Reduce stranded resources across CPU, memory, disk, locality, priority, and failure domains', 'Requires richer policy, measurement, and simulation'],
          ],
        },
        'Borg originally used a variant of E-PVM scoring, which spread load but left fragmentation. Pure best fit packed tightly but hurt bursty work and low-CPU batch tasks. The paper says Borg\'s hybrid scoring gave about 3-5% better packing efficiency than best fit for Google\'s workloads. At Borg scale, a few percent is a datacenter-sized number.',
      ],
    },
    {
      heading: 'Equivalence classes',
      paragraphs: [
        'The most important scheduler optimization is the one a data-structures student should recognize immediately: avoid repeating identical work. Tasks in the same Borg job usually have identical requirements and constraints. Rather than checking every pending task against every machine and scoring every feasible machine, Borg computes feasibility and scoring once per equivalence class: the group of tasks with identical requirements.',
        'This is memoization for scheduling. If 5,000 workers have the same shape, the scheduler should not ask the same feasibility question 5,000 times for every machine in a 10,000-machine cell. It should ask once for that shape, then reuse the answer until relevant machine or task properties change.',
        {
          type: 'callout',
          text: 'The equivalence-class trick turns "schedule every task from scratch" into "schedule each distinct task shape." That is the difference between a datacenter scheduler and a quadratic classroom toy.',
        },
        'Borg combines equivalence classes with score caching and relaxed randomization. Score caching keeps feasibility and scoring results until machine or task properties change. Relaxed randomization examines machines in random order until it finds enough feasible candidates, then picks the best among that sample. The paper reports that scheduling an entire cell from scratch usually took a few hundred seconds with these techniques, but did not finish after more than 3 days when they were disabled. Normal online scheduling passes over the pending queue completed in less than half a second.',
      ],
    },
    {
      heading: 'Control plane and lifecycle',
      paragraphs: [
        'A Borg cell contains the machines, a logically centralized Borgmaster, and a Borglet on every machine. The Borgmaster has a main process and a separate scheduler. The main process handles client RPCs, maintains object state machines for machines, tasks, allocs, and other objects, communicates with Borglets, and stores state durably.',
        'The Borgmaster is logically single but replicated five times. The paper says each replica keeps most cell state in memory and records state in a Paxos-based store on local disks. One elected master mutates state. Master election and failover typically take about 10 seconds, but can take up to a minute in a large cell because some in-memory state must be reconstructed.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Datacenter.jpg/960px-Datacenter.jpg',
          alt: 'Glass-fronted server racks in a data center aisle',
          caption: 'Every Borgmaster decision eventually becomes local machine work: start this task, stop that task, update resource controls, report state. Source: Wikimedia Commons, Wilweterings, public domain.',
        },
        'The Borglet is the local agent. It starts and stops tasks, restarts failed tasks, manages local resources by manipulating kernel settings, rolls logs, and reports machine and task state. This split is the same idea as an operating system: a central policy layer makes placement decisions, and local agents enforce them close to the resource.',
        'Task lifecycle is explicit. A job or task can be submitted and accepted, become pending, be scheduled, run, finish, fail, be killed, be lost, be evicted, be updated, or be rejected. Updates are rolling and can limit how many tasks are disrupted at once. Some updates only change metadata; others require restart or rescheduling.',
        'Preemption is also a lifecycle event. Tasks can ask for a SIGTERM before SIGKILL so they can clean up, save state, finish current requests, or stop accepting new ones. The paper reports that the notice is delivered about 80% of the time. The remaining 20% is the lesson: graceful shutdown is an expectation, not a guarantee.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Borg works because it protects one invariant: declared intent is reconciled against actual cluster state under policy. If a task should be running and its machine fails, the system marks it lost and attempts a new placement. If a low-priority task occupies resources needed by higher-priority work, preemption restores the priority rule. If replicas are too concentrated, future placements can spread them across machines, racks, and power domains.',
        'The economic proof is pooling. A large shared cell absorbs variance better than many small cells. One team\'s idle headroom can run another team\'s batch job. One machine\'s unused CPU can pair with another task\'s memory footprint. One user\'s spike does not require every user to own a private peak-sized fleet.',
        'The paper\'s numbers support this. Splitting production and non-production work would need 20-30% more machines in the median cell. Splitting heavy users into separate cells could require 2-16 times as many cells and 20-150% additional machines. About 20% of the workload in a median cell ran in reclaimed resources. Fine-grained resource requests avoided the 30-50% overhead caused by coarse buckets.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Datacenter-telecom_edit2.jpg',
          alt: 'Telecommunications equipment with yellow cabling in data center racks',
          caption: 'The network, power, rack, and cabling layout are part of the scheduling problem because correlated failure domains are physical. Source: Wikimedia Commons, Gregory Maxwell with edit by mixpix, GFDL 1.2.',
        },
        'The correctness argument is not that Borg always finds an optimal placement. It does not. The correctness argument is that placement decisions preserve explicit policy constraints: admitted quota, priority ordering, hard constraints, resource limits, failure-domain rules, and restart semantics. The optimality target is practical: enough feasible, policy-respecting placements fast enough for a live cell.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a frontend service asks for 1,000 replicas across a cell. Each task needs CPU, memory, ports, a package cache, and separation across machines and racks. A log-processing batch job asks for 20,000 workers that can tolerate eviction. A simple bin-packer would place both wherever CPU and memory fit. Borg-style scheduling adds the missing policy.',
        'The frontend tasks are production priority. They should avoid correlated failure, keep enough headroom for spikes, and restart quickly if a machine disappears. The batch tasks are lower priority. They can pack into reclaimed resources left by production reservations and can be preempted when production needs capacity.',
        'Now production traffic spikes. High-priority latency-sensitive tasks may need more CPU for several seconds. Borg can throttle or kill non-production tasks, never production tasks in this resource-reclamation path. If a machine runs out of non-compressible resources such as memory, lower-quality or lower-priority work pays first.',
        'Now a machine fails. The Borglet stops reporting. The Borgmaster marks affected tasks lost and asks the scheduler to place replacements. If the frontend stores persistent state in a distributed system, has readiness checks, and handles repeated startup safely, the platform can hide much of the failure. If the service stores critical state only on the failed local disk, Borg cannot make the application correct.',
        {
          type: 'callout',
          text: 'Borg can restart a task. It cannot make an unsafe task safe. Distributed application correctness still requires replication, durable state, readiness, idempotent startup, and backpressure.',
        },
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost', 'What Borg spends', 'Why it is worth spending'],
          rows: [
            ['Control-plane complexity', 'Paxos state, master election, schedulers, Borglets, checkpoints, simulators, UIs, and traces', 'The alternative is every team reinventing fragile placement and restart logic'],
            ['Scheduling CPU and memory', 'Busy Borgmasters used 10-14 CPU cores and up to 50 GiB RAM in the paper', 'This is small compared with tens of thousands of machines under management'],
            ['Startup latency', 'Median task startup was typically about 25 seconds, with package installation about 80% of that time', 'Package caching and placement locality can reduce avoidable startup work'],
            ['Preemption churn', 'Lower-priority tasks are killed and returned to the pending queue', 'Production work gets protected when scarcity appears'],
            ['Performance interference', 'Shared machines can expose cache, memory bandwidth, CPU, and disk contention', 'Pooling still saved more machines than the interference cost in the paper\'s analysis'],
          ],
        },
        'The dominant tradeoff is utilization versus predictability. Overpacking saves machines but raises interference and preemption. Underpacking protects latency but wastes capital. Borg\'s answer is not one magic packing rule. It is priority bands, quota, isolation, resource reclamation, failure-domain spreading, package locality, and policy-aware scoring.',
        'Another tradeoff is centralization versus scale. Borg uses a logically centralized control plane because it makes policy, quota, state, and debugging coherent. It survives scale through replication, sharding of read and Borglet communication paths, separate scheduler processes, score caching, equivalence classes, and random sampling.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Borg wins when many teams share a large heterogeneous fleet and run mixed workloads: serving systems, batch analytics, storage systems, cron jobs, canaries, experiments, data pipelines, and internal platform services. The larger and more varied the pool, the more valuable the scheduler becomes.',
        'It also wins when failures are normal. Borg reduces recovery time by turning restart, replacement, health monitoring, task history, and name-service updates into platform behavior. A human does not need to SSH into a host to discover that a task died and should be restarted elsewhere.',
        'The ideas became mainstream because they are structural. Kubernetes uses pods, nodes, labels, taints, tolerations, affinity, priority, preemption, controllers, and kubelets. The vocabulary changed. The core pattern stayed: declare desired work, bind it to machines, enforce locally, observe reality, and reconcile drift.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Borg-style scheduling fails when it is treated as a substitute for application design. The scheduler can restart and move stateless or replicated work. It cannot repair a service that stores unique state on a local disk, takes minutes to warm, ignores SIGTERM, starts without readiness checks, or overloads dependencies after a mass restart.',
        'It also fails when utilization becomes the only goal. High utilization can mean efficient sharing, or it can mean latency-sensitive services are living next to noisy neighbors with bad isolation. The paper reports that 50% of machines ran 9 or more tasks, and a 90th-percentile machine had about 25 tasks and about 4,500 threads. That density is useful only if isolation, monitoring, and overload policy are real.',
        'A Borg-scale system is the wrong tool for small deployments where a managed platform or a few fixed services are enough. The overhead is not just code. It is capacity planning, quota markets, policy debugging, simulator fidelity, rollout safety, observability, user education, and incident response.',
        'It is also the wrong abstraction for request routing. A cluster scheduler decides where processes run. A load balancer decides where requests go. A queue decides when work is consumed. Mixing those layers makes overload and failure harder to reason about.',
      ],
    },
    {
      heading: 'Failure modes to watch',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Fragmentation: a cell has plenty of total resources, but no machine has the right CPU-memory-disk-network shape for the pending task.',
            'Priority inversion: low-priority or best-effort work damages production because isolation, preemption, or throttling is too weak.',
            'Preemption cascade: high-priority work evicts slightly lower-priority work, which evicts another layer. Borg reduces this by preventing production-band tasks from preempting one another.',
            'Correlated failure: replicas satisfy CPU and memory constraints but land in the same rack, power domain, package-cache failure, storage dependency, or rollout wave.',
            'Restart amplification: a bad binary, broken dependency, or overloaded database gets restarted faster, spreading the incident instead of healing it.',
            'Quota hoarding: teams overbuy high-priority quota to protect themselves, reducing the capacity available to everyone else.',
          ],
        },
        'The engineering lesson is that every scheduling policy creates incentives. If users are punished for under-requesting memory, they over-request. If over-requesting is free, the cell fragments. If batch work is too protected, production suffers. If batch work is too disposable, useful throughput disappears. Borg is a policy system because the technical problem and the organizational problem are the same problem.',
      ],
    },
    {
      heading: 'Study next and sources',
      paragraphs: [
        {
          type: 'table',
          headers: ['Role', 'Study next', 'Why'],
          rows: [
            ['Prerequisite', 'Bulkheads & Resource Isolation', 'Borg only works because shared machines have isolation boundaries'],
            ['Neighbor', 'Load Balancer', 'Separate process placement from request routing'],
            ['Neighbor', 'Sharding & Partitioning', 'Compare task placement with data placement'],
            ['Failure mode', 'Circuit Breakers & Deadlines', 'A restarted task still needs safe dependency behavior'],
            ['Overload policy', 'Load Shedding & Graceful Degradation', 'Priority and preemption are cluster-level overload tools'],
            ['Flow control', 'Backpressure & Flow Control', 'Batch and service work need pressure signals, not only restarts'],
            ['Modern descendant', 'Kubernetes Scheduling & Eviction', 'Pods, nodes, priority, preemption, taints, tolerations, affinity, and kubelets are the public vocabulary for many Borg ideas'],
          ],
        },
        'Primary source: Abhishek Verma, Luis Pedrosa, Madhukar Korupolu, David Oppenheimer, Eric Tune, and John Wilkes, "Large-scale cluster management at Google with Borg," EuroSys 2015, https://research.google.com/pubs/archive/43438.pdf.',
        'Use the paper for the real numbers in this article: median cell size around 10,000 machines; production allocation and usage gaps; 20-30% extra machines for separating production and non-production; 30-50% overhead from coarse resource buckets; about 20% workload running in reclaimed resources in a median cell; 10-14 CPU cores and up to 50 GiB RAM for a busy Borgmaster; less-than-half-second online scheduling passes; and more than 3 days for full-cell scheduling when key scheduler optimizations were disabled.',
      ],
    },
  ],
};
