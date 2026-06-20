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
        'The "placement and packing" view traces a job from user submission through the Borgmaster and scheduler to candidate machines. Active nodes are the current stage of the scheduling pipeline. Compare nodes are machines being evaluated. Found nodes are placed tasks running on their assigned machines.',
        'The "priority and failure" view shows what happens under resource pressure and machine loss. Removed nodes are preempted or failed tasks. Active nodes are the control-plane components responding to the event. Found nodes are the surviving machines that absorb rescheduled work.',
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and an edge leads to it, that stage has received or produced data. If a downstream node is not yet active, no scheduling decision has reached it. Removed nodes represent real loss -- preemption or crash -- not visual decoration.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Verma et al., EuroSys 2015',
          text: 'Borg provides three main benefits: it (1) hides the details of resource management and failure handling so its users can focus on application development instead; (2) operates with very high reliability and availability, and supports applications that do the same; and (3) lets us run workloads across tens of thousands of machines effectively.',
        },
        'A datacenter is not useful just because it owns many machines. The hard problem is turning those machines into a shared computer where production services stay healthy, batch jobs use spare capacity, failures are handled quickly, and teams do not hand-place processes one host at a time. At Google\'s scale -- hundreds of thousands of machines across dozens of datacenters -- this is not a convenience. It is an economic necessity.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Google_Modular_Data_Center.jpg',
          alt: 'Google modular data center showing shipping-container-sized computing units in a large facility',
          caption: 'A Google modular data center. Each container-sized unit holds thousands of servers. Borg treats these machines as a single shared pool, scheduling work across them without human placement decisions. Source: Wikimedia Commons, Google, CC BY 2.5.',
        },
        'The economics are stark. A machine sitting idle still draws 50-60% of its peak power. A thousand idle machines cost millions of dollars per year in power and cooling alone. But if you pack machines too aggressively, production services suffer latency spikes from resource contention. Borg exists to navigate this tension: maximize utilization without sacrificing the reliability of latency-sensitive services.',
        'Borg is Google\'s cluster management system, running since the mid-2000s. The 2015 EuroSys paper by Verma et al. describes a system that admits, schedules, starts, restarts, and monitors jobs across cells of machines. Its educational value is that scheduling is not only bin packing. It is resource allocation under priority, quota, isolation, locality, health, and failure constraints -- with real numbers showing it works at a scale few organizations have attempted.',
        {
          type: 'callout',
          text: 'Borg is not a research prototype. It manages virtually all of Google\'s production workloads. According to the 2015 paper, a median Borg cell contains about 10,000 machines, and some cells are much larger. The system runs hundreds of thousands of jobs from thousands of different applications simultaneously.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is direct placement. A team picks machines, starts processes, writes scripts to restart them, and reserves extra capacity so production does not fight experiments. That works for a small fleet because the mental model fits in a few people\'s heads.',
        'Slightly better: partition the fleet. Give each team a dedicated cluster. Team A gets 200 machines, team B gets 300. No interference, no scheduling complexity. Each team runs its own scripts, manages its own failures, and buys enough slack capacity to handle peaks independently.',
        {
          type: 'table',
          headers: ['Approach', 'Works until', 'What breaks'],
          rows: [
            ['Manual placement', '~50 machines', 'One person cannot track resource state across hundreds of hosts'],
            ['Per-team clusters', '~5 teams', 'Each team over-provisions for peak; aggregate utilization drops to 20-30%'],
            ['Shared cluster, no priorities', '~100 machines', 'A batch job starves a production service; no one knows who to preempt'],
            ['Shared cluster, static quotas', '~1,000 machines', 'Quotas are set by negotiation, not usage; 40% of reserved capacity sits idle'],
          ],
        },
        'The wall appears when the fleet becomes heterogeneous and shared. One team over-reserves, another fills a rack with correlated replicas, a machine dies, a batch job starves a service, and no one can tell whether the cluster is wasting capacity or protecting reliability. Manual placement loses both efficiency and control.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg',
          alt: 'Dense server racks in a datacenter showing the physical reality of thousands of machines that need coordinated management',
          caption: 'Server racks in a large-scale datacenter. Each rack holds dozens of machines with different CPU, memory, and disk configurations. A cluster scheduler must track every machine\'s current load, health, and attributes to make placement decisions. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.',
        },
        'Google\'s cell compaction experiments in the Borg paper quantified the cost of partitioning. Segregating production and non-production work into separate cells would require 20-30% more machines to achieve the same workload throughput. That is the utilization tax of not sharing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'callout',
          text: 'Make desired work declarative and let a control plane continuously reconcile it with the actual cluster. Users submit jobs made of tasks. The system stores desired state, checks policy, chooses machines, starts tasks, watches health, and repairs drift -- forever, without human intervention.',
        },
        'The scheduler is the policy point. It does not simply find any machine with enough CPU and memory. It considers constraints, priority, quota, locality, anti-affinity, machine health, and disruption cost. Good placement is a resource fit plus an operational decision.',
        'Borg decomposes this into a clear hierarchy of abstractions. A cell is a set of machines managed as a unit. A job is a set of identical tasks (one binary, one configuration, multiple instances). An alloc is a reserved set of resources on a machine where tasks can be placed. Priority determines which tasks survive resource pressure. Quota determines which jobs are admitted in the first place.',
        {
          type: 'diagram',
          alt: 'Borg abstraction hierarchy from cells down to tasks',
          label: 'Borg\'s abstraction hierarchy',
          body: `  Site (datacenter campus)
       |
       +--- Cell (unit of management, ~10K machines)
              |
              +--- Machine (one physical or virtual host)
              |       |
              |       +--- Alloc (reserved resource slice)
              |               |
              |               +--- Task (one running instance)
              |
              +--- Job (template: N tasks with same binary + config)
              |
              +--- Priority band (monitoring > prod > batch > best-effort)
              |
              +--- Quota (admission control: can this job enter the cell?)`,
          text: `  Site (datacenter campus)
       |
       +--- Cell (unit of management, ~10K machines)
              |
              +--- Machine (one physical or virtual host)
              |       |
              |       +--- Alloc (reserved resource slice)
              |               |
              |               +--- Task (one running instance)
              |
              +--- Job (template: N tasks with same binary + config)
              |
              +--- Priority band (monitoring > prod > batch > best-effort)
              |
              +--- Quota (admission control: can this job enter the cell?)`,
        },
        'This hierarchy separates concerns cleanly. Users think in jobs and tasks. Operators think in cells and machines. The scheduler connects the two layers through constraint satisfaction and scoring. No user needs to know which specific machine runs their task.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the placement view, follow the job from user API to Borgmaster to scheduler to candidate machines. The scheduler edges represent scoring, not blind first-fit placement. A highlighted machine matters only if it satisfies the job\'s resource request and policy constraints.',
        'In the packing frame, compare the service task and the batch task. The service wants stability, low latency, and protection from correlated failure. The batch task wants throughput and can often tolerate preemption. Borg\'s utilization gain comes from mixing them without pretending they have the same priority.',
        'In the priority and failure view, removed tasks are not visual noise. They show preemption or loss. The important state change is that lower-priority work gives way under pressure, and failed work is rescheduled only if the application and policy allow restart.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Borg\'s architecture has three main components: the Borgmaster, the scheduler, and the Borglet. Understanding how they interact reveals the full lifecycle of a job from submission to execution.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Google_Borg_cluster_birth.jpg/640px-Google_Borg_cluster_birth.jpg',
          alt: 'Early Google cluster hardware showing the physical infrastructure that Borg was built to manage',
          caption: 'Early Google cluster hardware. Borg evolved from managing racks like these to orchestrating cells of 10,000+ heterogeneous machines. The system\'s design reflects lessons learned from over a decade of cluster management at increasing scale. Source: Wikimedia Commons, Google, CC BY 2.0.',
        },
        {
          type: 'bullets',
          items: [
            'Borgmaster: the control plane, replicated five times using Paxos for fault tolerance. Stores all cell state: jobs, tasks, machines, allocs. Handles client RPCs, manages state transitions, and communicates with Borglets. One elected master handles mutating operations; the other four replicas serve read-only traffic and stand ready for failover.',
            'Scheduler: operates asynchronously from the Borgmaster. Scans the pending queue, applies feasibility checking (can this task physically run here?) and then scoring (which feasible machine is best?). Uses equivalence classes to avoid rescoring identical machines -- if 1,000 machines have the same attributes, score one and apply the result to all.',
            'Borglet: a local agent on every machine. Starts and stops tasks, manages local resources, reports machine state back to the Borgmaster via periodic heartbeats. If the Borgmaster loses contact with a Borglet, it marks the machine\'s tasks as lost and reschedules them.',
          ],
        },
        {
          type: 'callout',
          text: 'The Borgmaster is not a single point of failure. It runs as five replicas, with state replicated via Paxos consensus. A cell survives the loss of any two Borgmaster replicas. The elected leader handles writes; followers serve reads and maintain hot standby state for fast failover.',
        },
        'The scheduling pipeline has two phases. First, feasibility checking: filter out machines that cannot legally run the task. Not enough CPU or memory. Wrong machine attributes (no GPU, wrong kernel version). Hard constraints violated (must be in rack X, must not colocate with job Y). Machine unhealthy or draining.',
        'Second, scoring: rank feasible machines by desirability. The Borg paper describes two scoring strategies that bracket the design space. Worst-fit spreads tasks across machines, leaving room on each for future work and reducing correlated failure. Best-fit packs tasks tightly, maximizing the number of machines left completely empty (which can be powered down). In practice, a hybrid called E-PVM performed best -- it reduces stranded resources by packing along the dimension with the most slack.',
        {
          type: 'table',
          headers: ['Scheduling phase', 'What it does', 'Key optimization'],
          rows: [
            ['Feasibility checking', 'Filter machines that cannot run the task', 'Equivalence classes: identical machines share one feasibility result'],
            ['Scoring', 'Rank feasible machines by desirability', 'E-PVM: pack by slack dimension to reduce stranded resources'],
            ['Preemption analysis', 'If no feasible machine exists, find lowest-cost eviction', 'Only preempt tasks with strictly lower priority; cascade detection'],
            ['Commitment', 'Assign task to chosen machine, notify Borglet', 'Optimistic concurrency: re-check state before committing'],
          ],
        },
        'The equivalence class optimization deserves emphasis. In a cell with 10,000 machines, many are identical -- same CPU, same memory, same disk, same kernel. Rather than scoring all of them, the scheduler groups machines into equivalence classes and scores one representative per class. This reduces scheduling latency from minutes to seconds for large jobs.',
        {
          type: 'code',
          language: 'javascript',
          body: `// Simplified equivalence class optimization.
// Instead of scoring 10,000 machines individually,
// group identical machines and score one per group.
function scheduleTask(task, machines) {
  // Phase 1: feasibility check with equivalence classes
  const classes = groupByAttributes(machines);  // ~50 classes, not 10K machines
  const feasible = [];
  for (const eqClass of classes) {
    if (isFeasible(task, eqClass.representative)) {
      feasible.push(...eqClass.members);
    }
  }
  if (feasible.length === 0) return tryPreemption(task, machines);

  // Phase 2: score one representative per feasible class
  let bestScore = -Infinity, bestMachine = null;
  for (const eqClass of groupByAttributes(feasible)) {
    const score = scoreForTask(task, eqClass.representative);
    if (score > bestScore) {
      bestScore = score;
      bestMachine = pickRandom(eqClass.members);  // spread within class
    }
  }
  return assign(task, bestMachine);
}`,
        },
        'Priority and preemption are central to Borg\'s mixed-workload strategy. The paper describes four priority bands, from highest to lowest:',
        {
          type: 'table',
          headers: ['Priority band', 'Examples', 'Preemption behavior', 'Quota type'],
          rows: [
            ['Monitoring', 'Health checks, cluster telemetry', 'Never preempted', 'Reserved -- always guaranteed'],
            ['Production', 'User-facing services, databases', 'Preempts batch and best-effort', 'Reserved -- capacity guaranteed by quota'],
            ['Batch', 'MapReduce, analytics pipelines', 'Preempts best-effort; preempted by prod', 'Bounded -- admitted if quota allows'],
            ['Best-effort', 'Experiments, dev jobs, speculative work', 'Preempted by everything above', 'Opportunistic -- uses only spare capacity'],
          ],
        },
        'Preemption cascades are a real risk. If a production task preempts a batch task, and that batch task gets rescheduled onto a machine where it preempts a best-effort task, which itself triggers another rescheduling -- the system can thrash. Borg mitigates this by never allowing tasks within the same priority band to preempt each other, and by preferring to preempt the lowest-priority tasks first.',
        {
          type: 'note',
          text: 'Allocs (resource reservations) are a Borg concept that Kubernetes inherited as the "pod" abstraction. An alloc reserves a fixed set of resources on a machine -- CPU, memory, disk -- and one or more tasks can be placed inside it. This lets related tasks share a resource envelope and be scheduled together, similar to how containers in a Kubernetes pod share a network namespace and resource limits.',
        },
      ],
    },
    {
      heading: 'Job lifecycle walkthrough',
      paragraphs: [
        'Understanding Borg requires tracing a job\'s complete lifecycle from submission to completion. Here is the path a typical web-serving job takes through the system:',
        {
          type: 'table',
          headers: ['Step', 'Component', 'Action', 'State change'],
          rows: [
            ['1. Submit', 'User via BCL/API', 'Declare job: 50 tasks, 0.5 CPU + 2 GB RAM each, production priority', 'Job enters Borgmaster pending queue'],
            ['2. Admit', 'Borgmaster', 'Check quota: does this user have production quota for 25 CPUs + 100 GB RAM?', 'Job accepted or rejected'],
            ['3. Schedule', 'Scheduler', 'For each of 50 tasks: feasibility check, scoring, machine assignment', 'Tasks assigned to machines across failure domains'],
            ['4. Deploy', 'Borglet', 'Pull binary package, configure container isolation (cgroups), start process', 'Tasks enter RUNNING state'],
            ['5. Health check', 'Borglet + Borgmaster', 'Periodic heartbeats confirm tasks alive; HTTP health endpoint confirms ready', 'Tasks marked healthy or unhealthy'],
            ['6. Steady state', 'All components', 'Borglet reports utilization; Borgmaster stores state; scheduler handles new tasks', 'Continuous reconciliation loop'],
            ['7. Failure', 'Borglet detects crash or Borgmaster loses heartbeat', 'Mark task LOST, return to pending queue', 'Scheduler finds new machine for failed task'],
            ['8. Update', 'User via rolling update', 'Submit new job version; Borg drains old tasks, schedules new ones', 'Gradual migration with configurable batch size'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Desktop_computer_clipart_-_Yellow_theme.svg',
          alt: 'Computer workstation representing a single machine in a cluster that receives task assignments from the scheduler',
          caption: 'Each machine in a Borg cell runs a Borglet agent that manages local tasks. The Borglet starts and stops containers, enforces resource limits via Linux cgroups, and reports machine state to the Borgmaster via periodic heartbeats. Source: Wikimedia Commons, Videoplasty.com, CC BY-SA 4.0.',
        },
        'The Borglet is the unsung workhorse. It runs on every machine in the cell and handles the messy reality of process management: setting up Linux cgroups for CPU and memory isolation, managing container images, enforcing resource limits, detecting task crashes, and reporting utilization metrics. If a Borglet stops responding, the Borgmaster does not immediately kill its tasks -- it waits for the Borglet to recover, since the tasks may still be running fine. Only after a timeout does it mark the machine\'s tasks as lost.',
        'Heartbeat-based health monitoring has a fundamental tradeoff. Short heartbeat intervals detect failures fast but generate enormous network traffic across 10,000 machines. Long intervals reduce traffic but delay failure detection. The Borg paper does not publish exact intervals, but the design makes the tradeoff explicit: the Borgmaster polls Borglets rather than requiring Borglets to push, which lets the control plane manage its own load.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is reconciliation toward declared intent under policy. If a task should be running and its machine dies, the control plane marks the task lost and places it elsewhere. If a low-priority task consumes capacity needed by a high-priority service, preemption restores the priority rule. If replicas are too concentrated, placement policy spreads future work across failure domains.',
        'This works because the system separates application intent from machine accident. Users declare what should run. The platform observes what is actually running. The scheduler and restart logic close the gap continuously, without human intervention.',
        {
          type: 'callout',
          text: 'The key insight from the Borg paper\'s utilization analysis: mixing production services with batch jobs on the same machines improves cluster utilization dramatically. The cell compaction experiments showed that segregating workloads by type would require 20-30% more machines. Batch work fills the valleys in production demand curves.',
        },
        'Resource reclamation makes this work in practice. Users tend to over-request resources as a safety margin. Borg observes actual usage and reclaims the gap between requested and consumed resources, making it available to lower-priority tasks. The paper reports that about 20% of workload runs in reclaimed resources -- work that would otherwise require additional machines.',
        {
          type: 'table',
          headers: ['Mechanism', 'What it protects', 'How'],
          rows: [
            ['Priority bands', 'Production services from batch interference', 'Higher priority always wins preemption; same band never preempts'],
            ['Quota system', 'Fairness across teams', 'Admission control: job rejected if team has no quota, before it touches machines'],
            ['Resource reclamation', 'Utilization', 'Actual usage tracked; gap between request and usage given to best-effort tasks'],
            ['Equivalence classes', 'Scheduling latency', '10,000 machines become ~50 groups; score one per group'],
            ['Paxos replication', 'Control plane availability', 'Five Borgmaster replicas; any two can fail without losing state'],
            ['Borglet heartbeats', 'Task health visibility', 'Periodic polling detects machine failure; triggers rescheduling'],
          ],
        },
        'The application still has responsibilities: idempotent startup, persistent state design, readiness checks, graceful shutdown, and backpressure. Borg can restart a task, but it cannot make a task safe to restart. That contract between platform and application is the foundation of reliable cluster management.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a frontend service needs ten replicas across failure domains and a log-processing batch job needs thousands of CPU-hours. Walk through the scheduling decisions step by step.',
        {
          type: 'table',
          headers: ['Decision', 'Frontend service (production priority)', 'Log processor (batch priority)'],
          rows: [
            ['Admission', 'Team has production quota for 10 tasks at 2 CPU + 4 GB each', 'Team has batch quota; admitted below production'],
            ['Feasibility', '6,000 of 10,000 machines have enough free resources', '8,000 machines feasible (lower resource request per task)'],
            ['Scoring', 'Spread across racks (anti-affinity); avoid machines with high CPU utilization', 'Pack tightly (best-fit); prefer machines with idle CPU from over-provisioned prod tasks'],
            ['Placement', '10 tasks placed on 10 different racks', '500 tasks packed onto machines with reclaimed resources'],
            ['Under pressure', 'Never preempted; batch tasks evicted if needed', 'Preempted to make room for new production tasks; requeued'],
          ],
        },
        'Now machine 7 fails. The Borgmaster loses the Borglet heartbeat and, after a timeout, marks the machine\'s tasks as lost. The frontend task on machine 7 returns to the pending queue. The scheduler finds a new machine in a different rack (maintaining the anti-affinity constraint) and the Borglet on that machine starts the replacement task. Total disruption: one replica down for the detection interval plus scheduling plus startup time.',
        'The batch tasks that were on machine 7 also return to the pending queue. But the scheduler treats them differently: they have lower priority, so they wait until feasible machines have spare capacity. Some may land in reclaimed resources on machines where production tasks are using less than they requested. If the cell is full of production work, batch tasks wait.',
        {
          type: 'note',
          text: 'The Borg paper reports real numbers from Google\'s production traces: a median cell runs about 10,000 machines with over 4,000 distinct jobs and 150,000+ tasks concurrently. Tasks range from less than 0.1 CPU cores to jobs requesting hundreds of cores. The scheduler handles this heterogeneity through the equivalence class optimization, which reduces per-task scheduling cost from linear in machines to linear in distinct machine types.',
        },
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'Why it matters'],
          rows: [
            ['Control plane complexity', 'Five Borgmaster replicas with Paxos consensus', 'A scheduling bug becomes a fleet-wide incident; the control plane is the most critical infrastructure'],
            ['Scheduling latency', 'Seconds to minutes for large jobs (thousands of tasks)', 'Equivalence classes help, but a 10,000-task job still requires significant computation'],
            ['Preemption churn', 'Batch tasks may be killed and restarted repeatedly', 'Work that has been preempted three times has wasted all its prior compute; checkpointing helps'],
            ['Resource reclamation risk', 'Tasks running in reclaimed resources can be killed instantly', 'The gap between requested and actual usage is not guaranteed; a usage spike reclaims the reclaimed'],
            ['Over-requesting waste', 'Users pad resource requests as safety margin', 'Without reclamation, 30-50% of requested resources sit idle; with reclamation, the slack goes to batch'],
            ['Isolation imperfection', 'CPU contention between tasks on the same machine', 'Linux cgroups provide hard memory limits but only soft CPU shares; noisy neighbors are real'],
          ],
        },
        'The scheduler balances utilization, reliability, fairness, locality, and disruption. Overpacking raises utilization and can cause interference. Underpacking protects latency and wastes machines. Preemption protects important work and creates churn for lower-priority jobs. Locality saves network or disk work and can concentrate risk.',
        'The control plane also becomes critical infrastructure. It needs durable state, careful rollout discipline, observability, and simulation or analysis tools. A bad scheduler policy can move a problem from one host to the whole fleet.',
        {
          type: 'callout',
          text: 'The Borg paper\'s most surprising finding: resource reclamation is so effective that about 20% of all work runs in reclaimed resources -- the gap between what users requested and what they actually consumed. Without reclamation, Google would need significantly more machines to run the same workload.',
        },
      ],
    },
    {
      heading: 'From Borg to Kubernetes',
      paragraphs: [
        'Borg is a proprietary system. Its open-source successor is Kubernetes, designed by many of the same engineers. Understanding the Borg-to-Kubernetes lineage reveals which ideas were fundamental and which were Google-specific.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Kubernetes_logo.svg',
          alt: 'Kubernetes logo -- the seven-spoked ship wheel representing container orchestration',
          caption: 'Kubernetes, originally released by Google in 2014, is the open-source descendant of Borg. The name comes from the Greek word for helmsman. Many core Kubernetes concepts -- pods, labels, replica sets, priority, preemption -- map directly to Borg abstractions. Source: Wikimedia Commons, The Linux Foundation, Apache 2.0.',
        },
        {
          type: 'table',
          headers: ['Borg concept', 'Kubernetes equivalent', 'What changed'],
          rows: [
            ['Cell', 'Cluster', 'Name change; concept identical'],
            ['Alloc', 'Pod', 'Borg allocs reserve resources; K8s pods are the scheduling unit with co-located containers'],
            ['Job + tasks', 'Deployment + pods (or Job + pods)', 'K8s separates long-running (Deployment) from batch (Job) more explicitly'],
            ['Borgmaster', 'API server + etcd + controller-manager', 'K8s decomposed the monolith into separate components'],
            ['Borglet', 'kubelet', 'Same role: local agent that manages containers on a node'],
            ['Priority bands', 'PriorityClass', 'K8s made priority a first-class API object with named classes'],
            ['Equivalence classes', 'Not directly exposed', 'K8s scheduler uses similar optimizations internally but does not expose the abstraction'],
            ['BCL (Borg Config Language)', 'YAML + Helm/Kustomize', 'K8s chose declarative YAML; templating tools filled the gap BCL provided'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Kubernetes_architecture_diagram.png',
          alt: 'Kubernetes architecture diagram showing the control plane components (API server, scheduler, controller manager, etcd) and worker node components (kubelet, kube-proxy, container runtime)',
          caption: 'Kubernetes architecture. Compare this to Borg: the API server replaces the Borgmaster\'s RPC surface, etcd replaces Paxos-replicated state, the scheduler is a separate process (as in Borg), and the kubelet is the Borglet renamed. The decomposition into independent components was a deliberate lesson from Borg\'s monolithic design. Source: Wikimedia Commons, Khtan66, CC BY-SA 4.0.',
        },
        'The Borg paper itself documents lessons learned that shaped Kubernetes. Jobs are the wrong grouping mechanism -- labels and label selectors are more flexible. One IP per machine forces port conflicts between tasks -- one IP per pod avoids this. Monolithic Borgmaster makes development harder -- decomposing into API server, scheduler, and controllers was intentional.',
        {
          type: 'note',
          text: 'Brendan Burns, one of Kubernetes\' creators, has said: "The thing we learned from Borg is that you want the user experience to be decoupled from the systems engineering." Borg\'s API evolved around internal Google infrastructure. Kubernetes was designed API-first, with the intention of being portable across cloud providers and on-premise datacenters.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A Borg-style scheduler wins when many teams share a fleet and run mixed workloads: serving systems, batch analytics, ML training, cron jobs, canaries, and experiments. Shared scheduling lets the organization buy fewer idle machines while still protecting production work with priority, quota, isolation, and health rules.',
        {
          type: 'bullets',
          items: [
            'Mixed workload efficiency: production services have predictable demand curves with peaks and valleys. Batch work fills the valleys. Without a shared scheduler, each workload type needs its own peak-capacity fleet.',
            'Failure as a platform feature: individual machines fail frequently at Google\'s scale (the paper reports that tasks are evicted at a rate of about 5% per month, and machines fail or are drained regularly). Borg turns failure recovery into an automated control loop, not an operator-driven incident.',
            'Multi-tenancy without partitioning: hundreds of teams share one cell. Quotas and priorities provide isolation without requiring separate clusters. This is cheaper and more efficient than giving each team its own fleet.',
            'Declarative operations: teams specify what they want (50 replicas, spread across racks, production priority) and Borg continuously works to maintain that state. No runbooks for "what to do when machine X dies."',
          ],
        },
        'The ideas show up in Kubernetes, Mesos, Nomad, and cloud orchestration because the underlying problem is common. Jobs and tasks describe work. Schedulers bind work to nodes. Health checks and restart policy repair drift. Priority and quota encode fairness under scarcity.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Do not use a Borg-scale mental model for a tiny deployment that fits on one host or a simple managed platform. The overhead is real: declarative specs, control-plane operation, debugging placement, capacity modeling, and rollout policy.',
        {
          type: 'table',
          headers: ['Scenario', 'Why Borg-style scheduling is overkill', 'Better alternative'],
          rows: [
            ['Single-server app', 'No scheduling decision to make; one machine, one process', 'systemd, Docker Compose'],
            ['Homogeneous batch-only workload', 'No priority conflicts; simple FIFO queue suffices', 'Slurm, PBS, or a cloud batch service'],
            ['Fully managed PaaS', 'The cloud provider runs the scheduler; you do not need to operate one', 'AWS Lambda, Cloud Run, Heroku'],
            ['Application-level load distribution', 'Borg places processes; it does not route requests', 'nginx, Envoy, a load balancer'],
          ],
        },
        'It is also the wrong abstraction for application-level load distribution. A cluster scheduler chooses where processes run. A load balancer chooses where requests go. A queue decides when work is consumed. Mixing those responsibilities makes outages harder to reason about.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failure is treating utilization as the only goal. High CPU graphs can mean efficient sharing or widespread interference. Without isolation, priority, and backpressure, spare-capacity batch work can damage latency-sensitive services.',
        {
          type: 'table',
          headers: ['Failure mode', 'Mechanism', 'Mitigation'],
          rows: [
            ['Preemption cascade', 'Evicted task lands on a machine where it preempts another task, which triggers another eviction', 'Never preempt within the same priority band; prefer evicting lowest-priority tasks first'],
            ['Resource reclamation whiplash', 'Batch task uses reclaimed resources; production task spikes usage; batch task killed instantly', 'Checkpoint batch work frequently; treat reclaimed resources as unreliable'],
            ['Correlated replica failure', 'All replicas placed in same rack; rack power fails; all instances down simultaneously', 'Anti-affinity constraints and failure-domain-aware scoring'],
            ['Restart storm', 'Many tasks crash simultaneously (bad binary push); all restart at once; thundering herd', 'Staggered restart with exponential backoff; canary deployments'],
            ['Control plane overload', 'Borgmaster overwhelmed by heartbeats or scheduling requests during cell-wide event', 'Rate limiting; priority-based request queuing; shed low-priority scheduling work first'],
          ],
        },
        'Another failure is restart optimism. Restarting a broken binary faster only creates a faster crash loop. Health checks, readiness signals, canaries, circuit breakers, and rollback policy decide whether restart is recovery or amplification.',
        'A third failure is hidden coupling. If all replicas land in the same rack, depend on the same storage path, or start at the same time after a failure, the scheduler can create correlated outages while appearing to satisfy resource requests.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Google_Modular_Data_Center.jpg',
          alt: 'Google modular data center units illustrating the physical failure domains that a cluster scheduler must account for',
          caption: 'Failure domains are physical. Rack switches fail, power distribution units trip, and cooling zones overheat. A scheduler that ignores physical topology can place all replicas in the same blast radius, turning a single hardware failure into a full service outage. Source: Wikimedia Commons, Google, CC BY 2.5.',
        },
      ],
    },
    {
      heading: 'Study next and sources',
      paragraphs: [
        'Primary source: Verma et al., "Large-scale cluster management at Google with Borg," EuroSys 2015, at https://research.google.com/pubs/archive/43438.pdf. This paper is unusually detailed for a production systems paper -- it includes real utilization data, cell compaction experiments, and failure statistics from Google\'s fleet.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: operating system process scheduling -- how a single OS decides which process gets CPU time. Borg applies the same concepts (priority, preemption, fairness) at datacenter scale.',
            'Extension: Kubernetes scheduling -- the open-source descendant with node affinity, taints, tolerations, PriorityClasses, preemption, and eviction. Official docs at https://kubernetes.io/docs/concepts/scheduling-eviction/.',
            'Extension: Omega (Schwarzkopf et al., EuroSys 2013) -- Google\'s follow-up research on shared-state optimistic concurrency scheduling, addressing Borg\'s centralized scheduler bottleneck.',
            'Related: Load Balancer -- separates process placement from request routing; Borg places processes, load balancers route traffic.',
            'Related: Bulkheads and Resource Isolation -- blast-radius control at the application level; Borg provides machine-level isolation via cgroups.',
            'Related: Circuit Breakers and Deadlines -- what applications must do internally, because Borg can restart a task but cannot fix a broken dependency.',
            'Contrast: Mesos (two-level scheduling with resource offers) and Nomad (single-binary simplicity) represent different points in the cluster scheduler design space.',
          ],
        },
        {
          type: 'quote',
          attribution: 'Verma et al., EuroSys 2015',
          text: 'By far the most important lesson we have learned is the value of a shared computing environment. Borg enables us to deploy thousands of applications written by thousands of developers, running on tens of thousands of machines, and achieving high utilization -- all with minimal operational overhead.',
        },
      ],
    },
  ],
};
